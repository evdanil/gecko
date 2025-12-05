# GECKO 🦎
**Generic Engine for Configuration Knowledge & Oversight**

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6)
![Status](https://img.shields.io/badge/Status-Pre--Alpha-red)

> **"Adheres to any surface. Functions even when parts are missing."**

**GECKO** is an isomorphic, fault-tolerant scanning engine designed to validate complex device configurations (Cisco IOS, Juniper, YAML, etc.) against business and security compliance rules.

Unlike traditional static analysis tools that require complete files to function, GECKO is designed with **Permissive Parsing**, allowing it to scan code snippets, partial configurations, and flattened text directly in the IDE or CI/CD pipeline.

---

## 🏗 Architecture

GECKO is built as a TypeScript Monorepo to ensure the exact same validation logic runs in your editor and your build pipeline.

-   **`@gecko/core`**: The brain. Contains the "Schema-Aware" Parser and the Rule Evaluator. Zero dependencies on VS Code or CLI.
-   **`@gecko/cli`**: The headless runner. Scans files, directories, and outputs industry-standard **SARIF** reports for CI/CD integration.
-   **`@gecko/vscode`**: The editor extension. Provides real-time "red squiggles" and context-aware fixes while you type.

## ✨ Key Features

-   **Snippet Resilience (The "Tail" Effect):**
    GECKO can reconstruct context from partial snippets. If you paste an `ip address` command without an `interface` block, GECKO detects the "Orphan" state and applies relevant checks without crashing.

-   **Isomorphic Logic:**
    Write a rule once. It runs in the VS Code Extension (client-side) and the Node.js CLI (server-side).

-   **Enterprise Rule Metadata:**
    Rules support rich tagging for organizational compliance:
    -   `level`: Error, Warning, Info
    -   `obu`: Operating Business Unit
    -   `owner`: Team/User responsible
    -   `compliance_code`: ISO/NIST/CIS references

## 🚀 Getting Started (Development)

This project uses **pnpm** workspaces.

1.  **Clone the repo**
    ```bash
    git clone https://github.com/your-org/gecko.git
    cd gecko
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Build Core**
    ```bash
    pnpm --filter @gecko/core build
    ```

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
    selector: "section[key^='interface Gigabit']",
    check: (node) => {
        const hasDesc = node.children.some(c => c.key === 'description');
        return hasDesc ? { passed: true } : { passed: false, message: "Missing description" };
    }
}
```

## ⚖️ License

The **GECKO Engine** (`@gecko/core`, `@gecko/cli`, `@gecko/vscode`) is released under the **Apache License 2.0**.

-   ✅ You can use this engine for free.
-   ✅ You can build proprietary/closed-source Rule Sets on top of this engine.
-   ✅ You can integrate this into commercial CI/CD pipelines.

See [LICENSE](./LICENSE) for details.
