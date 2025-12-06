import * as vscode from 'vscode';
import { SchemaAwareParser, RuleEngine } from '@gecko/core';
import { allRules } from '@gecko/rules-default';

// ============================================================================
// Singleton Instances - Reused across all scans to avoid GC pressure
// ============================================================================
const parser = new SchemaAwareParser();
const engine = new RuleEngine();

// ============================================================================
// Extension State
// ============================================================================
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let diagnosticCollection: vscode.DiagnosticCollection;

// Debounce timers per document URI
const debounceTimers = new Map<string, NodeJS.Timeout>();

// Track scan version to cancel stale results
const scanVersions = new Map<string, number>();

// Configuration
const SUPPORTED_LANGUAGES = ['network-config', 'plaintext'];
const DEBOUNCE_MS = 300;
const MAX_FILE_SIZE = 500_000; // 500KB - be conservative for real-time

// Debug mode - only log when explicitly enabled
let debugMode = false;

// ============================================================================
// Activation
// ============================================================================
export function activate(context: vscode.ExtensionContext) {
    try {
        // Create output channel (lazy - don't show unless needed)
        outputChannel = vscode.window.createOutputChannel("GECKO Linter");

        // Create status bar item
        statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        statusBarItem.command = 'gecko.scan';
        statusBarItem.tooltip = 'Click to scan current file';
        updateStatusBar('ready');
        statusBarItem.show();

        // Create diagnostic collection
        diagnosticCollection = vscode.languages.createDiagnosticCollection('gecko');

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('gecko.scan', cmdScanFile),
            vscode.commands.registerCommand('gecko.scanSelection', cmdScanSelection),
            vscode.commands.registerCommand('gecko.setLanguage', cmdSetLanguage),
            vscode.commands.registerCommand('gecko.toggleDebug', cmdToggleDebug),
        );

        // Register event handlers with debouncing
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(onDocumentChange),
            vscode.workspace.onDidSaveTextDocument(doc => scheduleScan(doc, 0)), // Immediate on save
            vscode.workspace.onDidOpenTextDocument(doc => scheduleScan(doc, 100)), // Quick on open
            vscode.workspace.onDidCloseTextDocument(onDocumentClose),
            vscode.window.onDidChangeActiveTextEditor(onActiveEditorChange),
        );

        // Register disposables
        context.subscriptions.push(
            outputChannel,
            statusBarItem,
            diagnosticCollection,
        );

        // Initial scan of active editor
        if (vscode.window.activeTextEditor) {
            scheduleScan(vscode.window.activeTextEditor.document, 0);
        }

        log('GECKO extension activated');

    } catch (error) {
        console.error("GECKO Activation Error:", error);
        vscode.window.showErrorMessage("GECKO Extension failed to activate.");
    }
}

// ============================================================================
// Commands
// ============================================================================
function cmdScanFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('GECKO: No active editor');
        return;
    }
    // Force scan regardless of language
    runScan(editor.document, true);
}

function cmdScanSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('GECKO: No active editor');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('GECKO: No text selected');
        return;
    }

    const text = editor.document.getText(selection);
    const startLine = selection.start.line;

    // Parse and scan selection
    updateStatusBar('scanning');

    try {
        const nodes = parser.parse(text);
        const results = engine.run(nodes, allRules);

        const diagnostics: vscode.Diagnostic[] = [];
        let errorCount = 0;
        let warningCount = 0;

        for (const result of results) {
            if (!result.passed && result.loc) {
                // Adjust line numbers relative to selection start
                const absoluteLine = startLine + result.loc.startLine;

                if (absoluteLine < editor.document.lineCount) {
                    const line = editor.document.lineAt(absoluteLine);
                    const severity = mapSeverity(result.level);

                    const diagnostic = new vscode.Diagnostic(line.range, result.message, severity);
                    diagnostic.source = 'GECKO';
                    diagnostic.code = result.ruleId;
                    diagnostics.push(diagnostic);

                    if (result.level === 'error') errorCount++;
                    if (result.level === 'warning') warningCount++;
                }
            }
        }

        // Merge with existing diagnostics (only update selection range)
        const existingDiagnostics = diagnosticCollection.get(editor.document.uri) ?? [];
        const outsideSelection = [...existingDiagnostics].filter(d =>
            d.range.end.line < selection.start.line || d.range.start.line > selection.end.line
        );

        diagnosticCollection.set(editor.document.uri, [...outsideSelection, ...diagnostics]);

        updateStatusBar('ready', errorCount, warningCount);
        vscode.window.showInformationMessage(
            `GECKO: Selection scanned - ${errorCount} errors, ${warningCount} warnings`
        );

    } catch (e) {
        updateStatusBar('error');
        log(`Selection scan error: ${e instanceof Error ? e.message : e}`);
    }
}

async function cmdSetLanguage() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await vscode.languages.setTextDocumentLanguage(editor.document, 'network-config');
        vscode.window.showInformationMessage('GECKO: Language set to Network Config');
        scheduleScan(editor.document, 0);
    }
}

function cmdToggleDebug() {
    debugMode = !debugMode;
    vscode.window.showInformationMessage(`GECKO: Debug logging ${debugMode ? 'enabled' : 'disabled'}`);
    if (debugMode) {
        outputChannel.show();
    }
}

// ============================================================================
// Event Handlers
// ============================================================================
function onDocumentChange(event: vscode.TextDocumentChangeEvent) {
    // Skip if no actual changes
    if (event.contentChanges.length === 0) return;

    scheduleScan(event.document, DEBOUNCE_MS);
}

function onDocumentClose(document: vscode.TextDocument) {
    const uri = document.uri.toString();

    // Clear pending timer
    const timer = debounceTimers.get(uri);
    if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(uri);
    }

    // Clear scan version
    scanVersions.delete(uri);

    // Clear diagnostics
    diagnosticCollection.delete(document.uri);
}

function onActiveEditorChange(editor: vscode.TextEditor | undefined) {
    if (editor) {
        // Update status bar for current document
        const diagnostics = diagnosticCollection.get(editor.document.uri);
        if (diagnostics) {
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
            updateStatusBar('ready', errors, warnings);
        } else {
            updateStatusBar('ready');
        }
    }
}

// ============================================================================
// Scanning Logic
// ============================================================================
function scheduleScan(document: vscode.TextDocument, delay: number) {
    // Skip unsupported languages
    if (!SUPPORTED_LANGUAGES.includes(document.languageId)) {
        return;
    }

    // Skip large files
    if (document.getText().length > MAX_FILE_SIZE) {
        log(`Skipping large file: ${document.fileName}`);
        return;
    }

    const uri = document.uri.toString();

    // Clear existing timer for this document
    const existingTimer = debounceTimers.get(uri);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    // Schedule new scan
    const timer = setTimeout(() => {
        debounceTimers.delete(uri);
        runScan(document, false);
    }, delay);

    debounceTimers.set(uri, timer);
}

function runScan(document: vscode.TextDocument, force: boolean) {
    const uri = document.uri.toString();

    // Skip unsupported languages unless forced
    if (!force && !SUPPORTED_LANGUAGES.includes(document.languageId)) {
        return;
    }

    // Increment scan version to invalidate in-flight scans
    const currentVersion = (scanVersions.get(uri) ?? 0) + 1;
    scanVersions.set(uri, currentVersion);

    updateStatusBar('scanning');

    try {
        const text = document.getText();

        // Quick exit for empty documents
        if (text.trim().length === 0) {
            diagnosticCollection.set(document.uri, []);
            updateStatusBar('ready');
            return;
        }

        const nodes = parser.parse(text);
        const results = engine.run(nodes, allRules);

        // Check if this scan is still current (not superseded by newer scan)
        if (scanVersions.get(uri) !== currentVersion) {
            log(`Scan cancelled (superseded): ${document.fileName}`);
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        let errorCount = 0;
        let warningCount = 0;

        for (const result of results) {
            if (!result.passed && result.loc) {
                const startLine = result.loc.startLine;

                if (startLine >= 0 && startLine < document.lineCount) {
                    const line = document.lineAt(startLine);
                    const severity = mapSeverity(result.level);

                    const diagnostic = new vscode.Diagnostic(line.range, result.message, severity);
                    diagnostic.source = 'GECKO';
                    diagnostic.code = result.ruleId;
                    diagnostics.push(diagnostic);

                    if (result.level === 'error') errorCount++;
                    if (result.level === 'warning') warningCount++;
                }
            }
        }

        // Final check before setting diagnostics
        if (scanVersions.get(uri) !== currentVersion) {
            return;
        }

        diagnosticCollection.set(document.uri, diagnostics);
        updateStatusBar('ready', errorCount, warningCount);

        log(`Scanned ${document.fileName}: ${errorCount} errors, ${warningCount} warnings`);

    } catch (e) {
        updateStatusBar('error');
        log(`Scan error: ${e instanceof Error ? e.message : e}`);
    }
}

// ============================================================================
// Utilities
// ============================================================================
function mapSeverity(level: string): vscode.DiagnosticSeverity {
    switch (level) {
        case 'error': return vscode.DiagnosticSeverity.Error;
        case 'warning': return vscode.DiagnosticSeverity.Warning;
        default: return vscode.DiagnosticSeverity.Information;
    }
}

function updateStatusBar(state: 'ready' | 'scanning' | 'error', errors = 0, warnings = 0) {
    switch (state) {
        case 'scanning':
            statusBarItem.text = '$(sync~spin) GECKO';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'error':
            statusBarItem.text = '$(error) GECKO';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
        case 'ready':
            if (errors > 0) {
                statusBarItem.text = `$(error) GECKO: ${errors}`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (warnings > 0) {
                statusBarItem.text = `$(warning) GECKO: ${warnings}`;
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                statusBarItem.text = '$(check) GECKO';
                statusBarItem.backgroundColor = undefined;
            }
            break;
    }
}

function log(message: string) {
    if (debugMode) {
        outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }
}

// ============================================================================
// Deactivation
// ============================================================================
export function deactivate() {
    // Clear all pending timers
    for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
    }
    debounceTimers.clear();
    scanVersions.clear();
}
