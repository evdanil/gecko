# GECKO 🦎
**Generic Engine for Configuration Knowledge & Oversight**

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6)
![Runtime](https://img.shields.io/badge/Runtime-Bun-000000)
![Status](https://img.shields.io/badge/Status-Pre--Alpha-red)

> **"Adheres to any surface. Functions even when parts are missing."**

**GECKO** is an isomorphic, fault-tolerant scanning engine designed to validate complex device configurations (Cisco IOS, Juniper, YAML, etc.) against business and security compliance rules.

Built with **Bun** for extreme speed ⚡️, it features a **Permissive Parser** allowing it to scan code snippets, partial configurations, and flattened text directly in the IDE or CI/CD pipeline without crashing.

---

## 🏗 Architecture

GECKO is a **TypeScript Monorepo** managed by Bun workspaces.

-   **`@gecko/core`**: The brain. Contains the "Schema-Aware" Parser and the Rule Evaluator. Zero dependencies on VS Code or CLI.
-   **`@gecko/cli`**: The headless runner. Scans files, directories, and outputs industry-standard **SARIF** reports for CI/CD integration.
-   **`@gecko/vscode`**: The editor extension. Provides real-time "red squiggles" and context-aware fixes.

## ✨ Key Features

-   **Snippet Resilience (The "Tail" Effect):**
    GECKO can reconstruct context from partial snippets. If you paste an `ip address` command without an `interface` block, GECKO detects the "Orphan" state and applies relevant checks without crashing.

-   **Isomorphic Logic:**
    Write a rule once. It runs in the VS Code Extension (client-side) and the CLI (server-side).

-   **Enterprise Rule Metadata:**
    Rules support rich tagging: `level`, `obu` (Business Unit), `owner`, and `compliance_code`.

---

## 🚀 Getting Started

This project uses **[Bun](https://bun.sh)** for package management, testing, and bundling.

### 1. Prerequisites
Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
# Windows: powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. Installation
Clone the repo and install dependencies (fast):
```bash
git clone https://github.com/your-org/gecko.git
cd gecko
bun install
```

### 3. Development Workflow

**Build the Core Engine:**
```bash
bun run --filter @gecko/core build
```

**Run Unit Tests (Instant):**
```bash
bun test
```

**Build the CLI Binary:**
```bash
bun build packages/cli/index.ts --compile --outfile gecko.exe
```

**Run the Binary:**
```bash
# Windows
.\gecko.exe test-config.txt

# Linux/Mac
./gecko.exe test-config.txt
```

### 4. CLI Usage & Options

The compiled binary supports the following options:

```text
Usage: gecko [options] [file]

Arguments:
  file                     Path to the configuration file to scan

Options:
  -f, --format <format>    Output format: "json" (default) or "sarif"
  -q, --quiet              Only output failures (suppress passed results)
  --ast                    Output the AST instead of validation results
  -c, --config <path>      Path to config file (default: auto-detect)
  --no-config              Ignore config file
  -r, --rules <path>       Additional rules file to load
  -d, --disable <ids>      Comma-separated rule IDs to disable
  --list-rules             List all active rules and exit
  -V, --version            Output the version number
  -h, --help               Display help for command
```

**Examples:**
```bash
# Scan and output JSON (Default)
gecko network.conf

# Scan and generate SARIF report for CI/CD
gecko network.conf --format sarif > results.sarif

# Inspect how GECKO parses a file (Debug mode)
gecko network.conf --ast

# Quiet mode - only show failures
gecko network.conf --quiet

# List active rules (includes config file rules)
gecko --list-rules

# Disable specific rules via CLI
gecko network.conf --disable NET-DOC-001,NET-SEC-003

# Load additional proprietary rules
gecko network.conf --rules ./my-rules.js

# Ignore config file (use defaults only)
gecko network.conf --no-config
```

### 5. VS Code Extension

The VS Code extension provides real-time validation as you edit network configurations.

**Build the Extension:**
```bash
cd packages/vscode
bun run build
```

**Package as VSIX:**
```bash
cd packages/vscode
bun run package
# Creates: gecko-vscode-0.0.1.vsix
```

**Install the VSIX:**
```bash
code --install-extension packages/vscode/gecko-vscode-0.0.1.vsix
```

**Development (Extension Host):**
1. Open VS Code in `packages/vscode`
2. Press `F5` to launch Extension Development Host
3. Open any `.conf`, `.cfg`, or `.ios` file to see validation

**Extension Features:**
- Real-time scanning with 300ms debounce
- Status bar with error/warning counts
- Right-click context menu for manual scans
- Scan selected text only
- Debug logging toggle (`GECKO: Toggle Debug Logging`)

---

## 🚀 CI/CD Integration

GECKO supports configuration files and CLI options for integrating proprietary rules into CI/CD pipelines.

### Configuration File

Create a `gecko.config.js` (or `.geckorc.js`) in your project root:

```javascript
// gecko.config.js
module.exports = {
    // Include default rules (default: true)
    includeDefaults: true,

    // Disable specific default rules
    disable: ['NET-DOC-001', 'NET-SEC-003'],

    // Add proprietary/custom rules
    rules: [
        {
            id: 'ACME-BGP-001',
            selector: 'router bgp',
            metadata: {
                level: 'error',
                obu: 'ACME Corp',
                owner: 'Network Team',
                remediation: 'All BGP sessions must use authentication.',
            },
            check: (node) => {
                const hasPassword = node.children.some(c =>
                    c.id.toLowerCase().includes('password')
                );
                return {
                    passed: hasPassword,
                    message: hasPassword
                        ? 'BGP authentication configured'
                        : 'BGP session missing authentication',
                    ruleId: 'ACME-BGP-001',
                    nodeId: node.id,
                    level: 'error',
                    loc: node.loc,
                };
            },
        },
    ],
};
```

### External Rules File

For larger rule sets, use a separate file:

```javascript
// rules/proprietary.js
module.exports = [
    { id: 'PROP-001', selector: 'interface', /* ... */ },
    { id: 'PROP-002', selector: 'router ospf', /* ... */ },
];
```

Reference it via CLI or config:
```bash
# Via CLI
gecko network.conf --rules ./rules/proprietary.js

# Or in gecko.config.js
const propRules = require('./rules/proprietary.js');
module.exports = {
    rules: propRules,
};
```

### GitHub Actions Example

```yaml
# .github/workflows/network-lint.yml
name: Network Config Lint

on:
  push:
    paths:
      - '**.conf'
      - '**.cfg'
  pull_request:
    paths:
      - '**.conf'
      - '**.cfg'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install GECKO
        run: |
          git clone https://github.com/your-org/gecko.git /tmp/gecko
          cd /tmp/gecko && bun install
          bun build packages/cli/index.ts --compile --outfile /usr/local/bin/gecko

      - name: Lint configurations
        run: |
          gecko configs/*.conf --format sarif > results.sarif

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

### GitLab CI Example

```yaml
# .gitlab-ci.yml
network-lint:
  image: oven/bun:latest
  script:
    - git clone https://github.com/your-org/gecko.git /tmp/gecko
    - cd /tmp/gecko && bun install
    - bun run packages/cli/index.ts $CI_PROJECT_DIR/configs/router.conf --quiet
  rules:
    - changes:
        - "**/*.conf"
        - "**/*.cfg"
```

### Jenkins Pipeline Example

```groovy
// Jenkinsfile
pipeline {
    agent any
    stages {
        stage('Lint Network Configs') {
            steps {
                sh '''
                    gecko configs/*.conf --format sarif > gecko-results.sarif
                '''
                recordIssues(tools: [sarif(pattern: 'gecko-results.sarif')])
            }
        }
    }
}
```

### Config File Search Order

GECKO searches for config files starting from the scanned file's directory, walking up to the root:

1. `gecko.config.ts`
2. `gecko.config.js`
3. `.geckorc.ts`
4. `.geckorc.js`

### Priority & Override Rules

1. **Default rules** load first
2. **Config file rules** override by ID
3. **CLI `--rules`** override by ID
4. **CLI `--disable`** takes final precedence

```bash
# Full override example: config + extra rules + disable some
gecko network.conf \
    --config ./strict-config.js \
    --rules ./extra-rules.js \
    --disable NET-DOC-001
```

---

## 🔌 Extension API: Custom Rules

The GECKO VS Code extension exposes an API allowing other extensions to register custom/proprietary rules without modifying the core extension.

### Creating a Custom Rules Extension

**1. Create a new VS Code extension:**

```bash
npx yo code  # Select "New Extension (TypeScript)"
cd my-gecko-rules
```

**2. Add dependencies to `package.json`:**

```json
{
  "extensionDependencies": ["gecko.gecko-vscode"],
  "devDependencies": {
    "@gecko/core": "workspace:*"
  }
}
```

**3. Register rules in your extension:**

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import type { IRule, ConfigNode, RuleResult } from '@gecko/core';

const myProprietaryRules: IRule[] = [
    {
        id: 'PROP-BGP-001',
        selector: 'router bgp',
        metadata: {
            level: 'warning',
            obu: 'MyCompany',
            owner: 'Network Team',
            remediation: 'Ensure BGP neighbors have passwords configured.'
        },
        check: (node: ConfigNode): RuleResult => {
            const hasPassword = node.children.some(child =>
                child.id.toLowerCase().includes('password')
            );

            return {
                passed: hasPassword,
                message: hasPassword
                    ? 'BGP authentication configured.'
                    : 'BGP neighbors should have authentication configured.',
                ruleId: 'PROP-BGP-001',
                nodeId: node.id,
                level: 'warning',
                loc: node.loc
            };
        }
    }
];

export async function activate(context: vscode.ExtensionContext) {
    // Get GECKO extension API
    const geckoExtension = vscode.extensions.getExtension('gecko.gecko-vscode');

    if (!geckoExtension) {
        vscode.window.showErrorMessage('GECKO extension not found');
        return;
    }

    // Activate GECKO if not already active
    const geckoApi = await geckoExtension.activate();

    // Register custom rules
    geckoApi.registerRules(myProprietaryRules);

    vscode.window.showInformationMessage(
        `Registered ${myProprietaryRules.length} proprietary GECKO rules`
    );
}
```

### API Reference

The GECKO extension exports the following API:

| Method | Description |
|--------|-------------|
| `registerRules(rules: IRule[])` | Register custom rules. Rules with same ID as defaults will override them. |
| `disableRules(ruleIds: string[])` | Disable rules by ID. They won't run during scans. |
| `enableRules(ruleIds: string[])` | Re-enable previously disabled rules. |
| `getDisabledRules()` | Returns array of currently disabled rule IDs. |
| `getExternalRuleCount()` | Returns count of registered external rules. |
| `getActiveRuleCount()` | Returns count of total active rules (default + external - disabled). |

### Rule Override & Disable

**Override a default rule** by registering a rule with the same ID:

```typescript
// Replace the default NET-IP-001 with custom implementation
geckoApi.registerRules([{
    id: 'NET-IP-001',  // Same ID = override
    selector: 'ip address',
    metadata: { level: 'error', obu: 'MyCompany', owner: 'NetOps' },
    check: (node) => { /* custom logic */ }
}]);
```

**Disable rules** without replacing them:

```typescript
// Turn off specific rules
geckoApi.disableRules(['NET-DOC-001', 'NET-SEC-003']);

// Re-enable later if needed
geckoApi.enableRules(['NET-DOC-001']);
```

### Rule Interface

Rules must implement the `IRule` interface from `@gecko/core`:

```typescript
interface IRule {
    id: string;                    // Unique rule ID (e.g., 'PROP-001')
    selector?: string;             // Node selector (e.g., 'router bgp', 'interface')
    metadata: {
        level: 'error' | 'warning' | 'info';
        obu: string;               // Business unit
        owner: string;             // Rule owner/team
        remediation?: string;      // Fix instructions
    };
    check: (node: ConfigNode, context: Context) => RuleResult;
}
```

### Cross-Reference Rules

For rules that need to validate against the entire configuration (e.g., checking if OSPF networks match interface IPs), use the `context.getAst()` function:

```typescript
check: (node: ConfigNode, context: Context): RuleResult => {
    const ast = context.getAst?.();  // Get full config AST

    if (ast) {
        // Search other parts of the configuration
        // e.g., find all interface IPs
    }

    return { /* ... */ };
}
```

---

## 📝 Rule Definition Example

GECKO rules are flexible. They can be declarative or programmatic.

```typescript
// Example: Ensure Gigabit Interfaces have a description
export const InterfaceDescriptionRule = {
    id: "NET-001",
    metadata: {
        level: "error",
        obu: "Infra",
        description: "Public interfaces must have a description."
    },
    // Selector: "Find any section starting with 'interface Gigabit'"
    selector: "section[key^='interface Gigabit']",
    
    // Logic
    check: (node) => {
        const hasDesc = node.children.some(c => c.key === 'description');
        return hasDesc 
            ? { passed: true } 
            : { passed: false, message: "Missing description" };
    }
}
```

## ⚖️ License

The **GECKO Engine** (`@gecko/core`, `@gecko/cli`, `@gecko/vscode`) is released under the **Apache License 2.0**.

-   ✅ You can use this engine for free.
-   ✅ You can build proprietary/closed-source Rule Sets on top of this engine.
-   ✅ You can integrate this into commercial CI/CD pipelines.

See [LICENSE](./LICENSE) for details.