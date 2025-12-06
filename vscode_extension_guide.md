# VS Code Extension Architecture & Implementation Guide for Real-Time Network Configuration Validation

This document provides a **complete, practical, production-grade guide** to building a VS Code extension that:

- Scans **Cisco / Aruba / F5 / Palo Alto** configuration files  
- Runs a **database of checks** against live user edits  
- Flags issues in real time  
- Supports **manual scans** via context-menu actions  
- Reports results through Diagnostics, Output panel, Status Bar, and notifications  
- Follows **best practices**, maintains high performance, and stays maintainable  
- Remains ready to migrate to **LSP** if needed

---

## 1. Project Setup

### 1.1 Scaffolding
Install the VS Code extension generator:

```bash
npm install -g yo generator-code
yo code
```

Choose:

- **New Extension (TypeScript)**  
- Yes to Webpack bundling (optional but recommended)

This creates a project with:

```
package.json
src/extension.ts
.vscode/launch.json
```

### 1.2 Activation Events

```json
"activationEvents": [
  "onLanguage:network-config",
  "onCommand:netconfig.scanFile",
  "onCommand:netconfig.scanSelection"
]
```

### 1.3 Define Your Language

```json
"contributes": {
  "languages": [
    {
      "id": "network-config",
      "aliases": ["Network Config"],
      "extensions": [".cfg", ".conf", ".txt"],
      "filenames": ["startup-config", "running-config"]
    }
  ]
}
```

---

## 2. Real-Time Scanning Architecture

### 2.1 Event Listener

```ts
vscode.workspace.onDidChangeTextDocument(event => {
  const doc = event.document;
  if (doc.languageId !== 'network-config') return;
  scheduleScan(doc);
});
```

### 2.2 Debounce Logic

```ts
let scanTimer: NodeJS.Timeout | null = null;

function scheduleScan(doc: vscode.TextDocument) {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(() => runScan(doc), 300);
}
```

---

## 3. Diagnostics (Real-Time Error Highlighting)

### 3.1 Create Collection

```ts
const diag = vscode.languages.createDiagnosticCollection("netconfig");
```

### 3.2 Running the Scan

```ts
async function runScan(doc: vscode.TextDocument) {
  const text = doc.getText();
  const issues = rulesEngineAnalyze(text);
  const diagnostics: vscode.Diagnostic[] = [];

  for (const issue of issues) {
    const range = new vscode.Range(
      new vscode.Position(issue.line, issue.start),
      new vscode.Position(issue.line, issue.end)
    );

    diagnostics.push(new vscode.Diagnostic(
      range,
      issue.message,
      convertSeverity(issue.severity)
    ));
  }

  diag.set(doc.uri, diagnostics);
}
```

---

## 4. Rule Engine Design

### Example Rule Format

```json
[
  {
    "id": "NO_HTTP",
    "pattern": "ip http server",
    "message": "HTTP server should not be enabled",
    "severity": "error"
  }
]
```

---

## 5. Context Menu Commands

### 5.1 Define Commands

```json
"contributes": {
  "commands": [
    { "command": "netconfig.scanFile", "title": "Scan Config File" },
    { "command": "netconfig.scanSelection", "title": "Scan Selected Text" }
  ]
}
```

### 5.2 Add to Menus

```json
"menus": {
  "explorer/context": [
    {
      "command": "netconfig.scanFile",
      "when": "resourceExtname =~ /^\\.(cfg|conf|txt)$/",
      "group": "navigation"
    }
  ],
  "editor/context": [
    {
      "command": "netconfig.scanSelection",
      "when": "editorHasSelection && editorLangId == network-config",
      "group": "navigation"
    }
  ]
}
```

---

## 6. Reporting to the User

### Output Channel

```ts
const output = vscode.window.createOutputChannel("NetConfig Scanner");
output.appendLine(`Scanned ${doc.fileName}`);
```

### Status Bar

```ts
const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
status.text = "$(shield) Config OK";
status.show();
```

### Notification

```ts
vscode.window.showInformationMessage("Scan complete.");
```

---

## 7. Performance Best Practices

- Debounce scans (300–500 ms)  
- Avoid scanning entire workspaces automatically  
- Keep rule engine independent  
- Dispose resources properly  
- Move to LSP if scans become CPU heavy  

---

## 8. When to Use LSP

Use LSP when:

- Scans become heavy  
- You want cross-editor support  
- You need indexing, auto-complete, hovers  

---

## 9. Recommended Folder Structure

```
src/
  extension.ts
  scanner/
    rules.json
    engine.ts
  util/
    debounce.ts
    severity.ts
```

---

## 10. Summary

Follow these principles:

- Real-time scanning with debounce  
- Diagnostics for inline issues  
- Output/StatusBar for supporting UX  
- Context menu for manual checks  
- Keep engine decoupled from VS Code  
- Prepare for LSP scalability  

