import * as vscode from 'vscode';
import { SchemaAwareParser, RuleEngine, IRule } from '@gecko/core';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('gecko');
    context.subscriptions.push(diagnosticCollection);

    // Scan on open and save
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(scanDocument));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(scanDocument));
    
    // Also scan active editor on activation
    if (vscode.window.activeTextEditor) {
        scanDocument(vscode.window.activeTextEditor.document);
    }

    function scanDocument(document: vscode.TextDocument) {
        // For this prototype, we scan 'plaintext' or maybe specific file extensions if configured.
        // We'll scan everything for demonstration purposes, but strictly only if content looks like config?
        // Let's stick to allowing it to run. 
        
        try {
            const parser = new SchemaAwareParser();
            const nodes = parser.parse(document.getText());

            // Dummy rules for VS Code demo
            const rules: IRule[] = [
                {
                    id: 'VSCODE-DEMO',
                    selector: 'interface',
                    metadata: { level: 'warning', obu: 'dev', owner: 'me' },
                    check: (node) => {
                        return {
                            passed: false,
                            message: `GECKO: Interface detected: ${node.id}`,
                            ruleId: 'VSCODE-DEMO',
                            nodeId: node.id,
                            level: 'warning',
                            loc: node.loc
                        };
                    }
                }
            ];

            const engine = new RuleEngine();
            const results = engine.run(nodes, rules);

            const diagnostics: vscode.Diagnostic[] = [];

            for (const result of results) {
                if (!result.passed && result.loc) {
                    // VS Code lines are 0-based.
                    const startLine = result.loc.startLine;
                    const endLine = result.loc.endLine;

                    // Validate line numbers against document
                    if (startLine < document.lineCount) {
                         const line = document.lineAt(startLine);
                         const range = line.range;

                        const severity = result.level === 'error' ? vscode.DiagnosticSeverity.Error :
                                         result.level === 'warning' ? vscode.DiagnosticSeverity.Warning :
                                         vscode.DiagnosticSeverity.Information;

                        const diagnostic = new vscode.Diagnostic(range, result.message, severity);
                        diagnostic.source = 'GECKO';
                        diagnostics.push(diagnostic);
                    }
                }
            }

            diagnosticCollection.set(document.uri, diagnostics);
        } catch (e) {
            console.error('GECKO Scan Error:', e);
        }
    }
}

export function deactivate() {}
