import * as vscode from 'vscode';
import { SchemaAwareParser, RuleEngine, IRule } from '@gecko/core';
import { allRules } from '@gecko/rules-default';

let outputChannel: vscode.OutputChannel;

// Supported language IDs for automatic scanning
const SUPPORTED_LANGUAGES = ['network-config', 'plaintext'];

export function activate(context: vscode.ExtensionContext) {
    console.log('GECKO: Activate function called.');
    try {
        outputChannel = vscode.window.createOutputChannel("GECKO Linter");
        outputChannel.appendLine(`[${new Date().toISOString()}] GECKO extension activating...`);

        const diagnosticCollection = vscode.languages.createDiagnosticCollection('gecko');
        context.subscriptions.push(diagnosticCollection);

        // Register scan command
        context.subscriptions.push(vscode.commands.registerCommand('gecko.scan', () => {
            outputChannel.appendLine(`[${new Date().toISOString()}] Command 'gecko.scan' triggered.`);
            if (vscode.window.activeTextEditor) {
                scanDocument(vscode.window.activeTextEditor.document, diagnosticCollection, true);
                vscode.window.showInformationMessage('GECKO: Scan completed.');
            } else {
                outputChannel.appendLine(`[${new Date().toISOString()}] No active editor found.`);
                vscode.window.showErrorMessage('GECKO: No active editor found.');
            }
        }));

        // Register set language command
        context.subscriptions.push(vscode.commands.registerCommand('gecko.setLanguage', async () => {
            if (vscode.window.activeTextEditor) {
                await vscode.languages.setTextDocumentLanguage(
                    vscode.window.activeTextEditor.document,
                    'network-config'
                );
                vscode.window.showInformationMessage('GECKO: Language set to Network Config');
            }
        }));

        // Scan on open, save, and change
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => scanDocument(doc, diagnosticCollection)));
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => scanDocument(doc, diagnosticCollection)));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => scanDocument(e.document, diagnosticCollection)));

        // Clear diagnostics when document closes
        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
            diagnosticCollection.delete(doc.uri);
        }));

        outputChannel.appendLine(`[${new Date().toISOString()}] Event listeners registered.`);

        // Scan active editor on activation
        if (vscode.window.activeTextEditor) {
            outputChannel.appendLine(`[${new Date().toISOString()}] Scanning initial active editor: ${vscode.window.activeTextEditor.document.fileName}`);
            scanDocument(vscode.window.activeTextEditor.document, diagnosticCollection);
        }

        // Scan all open documents
        vscode.workspace.textDocuments.forEach(doc => scanDocument(doc, diagnosticCollection));

        outputChannel.appendLine(`[${new Date().toISOString()}] GECKO extension activation finished.`);

    } catch (error) {
        console.error("GECKO Activation Error:", error);
        if (outputChannel) {
             outputChannel.appendLine(`[${new Date().toISOString()}] CRITICAL ACTIVATION ERROR: ${error instanceof Error ? error.message : String(error)}`);
             if (error instanceof Error && error.stack) {
                 outputChannel.appendLine(error.stack);
             }
        }
        vscode.window.showErrorMessage("GECKO Extension failed to activate. Check Output channel.");
    }
}

function scanDocument(document: vscode.TextDocument, collection: vscode.DiagnosticCollection, force: boolean = false) {
    // Skip unsupported languages unless forced (manual scan command)
    if (!force && !SUPPORTED_LANGUAGES.includes(document.languageId)) {
        return;
    }

    // Skip very large files to avoid performance issues
    if (document.getText().length > 1_000_000) {
        outputChannel.appendLine(`[${new Date().toISOString()}] Skipping large file: ${document.fileName}`);
        return;
    }

    const fileName = document.fileName;
    outputChannel.appendLine(`[${new Date().toISOString()}] Scanning document: ${fileName} (${document.languageId})`);

    try {
        const text = document.getText();

        const parser = new SchemaAwareParser();
        const nodes = parser.parse(text);
        outputChannel.appendLine(`[${new Date().toISOString()}] Parse complete. Root nodes: ${nodes.length}`);

        const engine = new RuleEngine();
        const results = engine.run(nodes, allRules);
        outputChannel.appendLine(`[${new Date().toISOString()}] Engine run complete. Results: ${results.length}`);

        const diagnostics: vscode.Diagnostic[] = [];

        for (const result of results) {
            if (!result.passed && result.loc) {
                const startLine = result.loc.startLine;

                // Validate line numbers against document
                if (startLine >= 0 && startLine < document.lineCount) {
                    const line = document.lineAt(startLine);
                    const range = line.range;

                    const severity = result.level === 'error' ? vscode.DiagnosticSeverity.Error :
                                     result.level === 'warning' ? vscode.DiagnosticSeverity.Warning :
                                     vscode.DiagnosticSeverity.Information;

                    const diagnostic = new vscode.Diagnostic(range, result.message, severity);
                    diagnostic.source = 'GECKO';
                    diagnostic.code = result.ruleId;
                    diagnostics.push(diagnostic);

                    outputChannel.appendLine(`[${new Date().toISOString()}] [${result.ruleId}] Line ${startLine}: ${result.message}`);
                } else {
                    outputChannel.appendLine(`[${new Date().toISOString()}] WARNING: Line ${startLine} out of bounds (doc lines: ${document.lineCount})`);
                }
            }
        }

        collection.set(document.uri, diagnostics);
        outputChannel.appendLine(`[${new Date().toISOString()}] Diagnostics set. Count: ${diagnostics.length}`);

    } catch (e) {
        outputChannel.appendLine(`[${new Date().toISOString()}] SCAN ERROR: ${e instanceof Error ? e.message : String(e)}`);
        console.error('GECKO Scan Error:', e);
    }
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
