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
Usage: gecko [options] <file>

Arguments:
  file                   Path to the configuration file to scan

Options:
  -f, --format <format>  Output format: "json" (default) or "sarif"
  --ast                  Output the Abstract Syntax Tree (AST) instead of validation results
  -V, --version          Output the version number
  -h, --help             Display help for command
```

**Examples:**
```bash
# Scan and output JSON (Default)
.\gecko.exe network.conf

# Scan and generate SARIF report for CI/CD
.\gecko.exe network.conf --format sarif > results.sarif

# Inspect how GECKO parses a file (Debug mode)
.\gecko.exe network.conf --ast
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
```

### Quick setup tip for Bun Workspaces
When you create your `package.json` in the root folder, ensure you add the workspaces configuration so Bun knows where to look:

**`package.json` (Root)**
```json
{
  "name": "gecko-monorepo",
  "module": "index.ts",
  "type": "module",
  "workspaces": [
    "packages/*"
  ]
}
