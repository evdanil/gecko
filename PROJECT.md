# Project Design Document: GECKO 🦎
**Generic Engine for Configuration Knowledge & Oversight**

## 1. Project Summary & Purpose
**Purpose:**
To build a high-performance, fault-tolerant scanning engine capable of validating text-based configurations (specifically Network/Device configs like Cisco IOS, Juniper, etc.) against complex business and security rules.

**Key Capabilities:**
1.  **Bun-Powered Speed:** Leverages Bun's native test runner and bundler for near-instant feedback loops during rule development.
2.  **Snippet Resilience:** Uses a "Schema-Aware Permissive Parser" to scan partial code snippets, flattened text, and sanitized input without crashing.
3.  **Rich Metadata:** Rules support enterprise tagging (`level`, `obu`, `owner`) for detailed SARIF reporting.
4.  **Isomorphic Logic:** The exact same scanning logic runs in the **VS Code Extension** (real-time) and the **CI/CD Pipeline** (headless).
5.  **Context Awareness:** Understands hierarchical configuration structures (Blocks, Interfaces) even when indentation is missing.

---

## 2. Technology Stack

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Language** | **TypeScript** (Strict Mode) | Strong typing for AST and Rules. |
| **Runtime (Dev/CLI)** | **Bun** | Ultra-fast startup, native TypeScript support (no `ts-node`), and built-in testing. |
| **Runtime (Editor)** | **Node.js** (Electron) | *Constraint:* VS Code runs on Node. We use Bun to *build* the extension, but it runs on Node. |
| **Repo Mgmt** | **Bun Workspaces** | Native monorepo support via `workspaces` in `package.json`. |
| **Testing** | **bun:test** | Native, Jest-compatible test runner. Orders of magnitude faster than Jest/Vitest. |
| **Bundling** | **bun build** | Replaces Webpack/Esbuild. Compiles TS to CommonJS for VS Code. |
| **Logic Engine** | **json-logic-js** | Portable rule conditions. |
| **CLI** | **Commander.js** | Argument parsing for the CLI tool. |

---

## 3. Architecture: The Monorepo Structure

We use a Monorepo to separate the "Core" logic from the presentation layers.

```text
/gecko
  ├── package.json        # Defines workspaces: ["packages/*"]
  ├── bun.lockb           # Binary lockfile (fast install)
  │
  ├── packages/
  │   ├── core/           # The Brain.
  │   │   ├── src/
  │   │   │   ├── parser/ # The Permissive Parser (Schema-Aware)
  │   │   │   ├── engine/ # The Rule Evaluator
  │   │   │   └── types/  # Shared Interfaces (AST, Rules)
  │   │   └── test/       # Unit tests (run via bun test)
  │   │
  │   ├── cli/            # The Automation Tool.
  │   │   ├── src/        # File I/O, Globbing, SARIF generation.
  │   │   └── index.ts    # Entry point.
  │   │
  │   ├── vscode/         # The Editor Extension.
  │   │   ├── src/        # LSP Client/Server.
  │   │   └── package.json # VS Code manifest.
  │   │
  │   └── rules-default/  # (Optional) A library of common network rules.
```

---

## 4. detailed Data Structures

### A. The Abstract Syntax Tree (ConfigNode)
The output of the parser. It normalizes flattened text into a tree.

```typescript
export type NodeType = 'section' | 'command' | 'comment' | 'virtual_root';

export interface ConfigNode {
    id: string;        // "interface GigabitEthernet1"
    type: NodeType;
    rawText: string;   
    params: string[];  // ["interface", "Gi0/1"]
    
    children: ConfigNode[];
    
    // Critical for "Snippet Resilience"
    source: 'base' | 'snippet'; 
    loc: {
        startLine: number;
        endLine: number;
    };
}
```

### B. The Rule Definition
```typescript
export interface IRule {
    id: string;           // "NET-SEC-001"
    
    // Optimization: Only run on specific nodes
    selector: string;     // "interface" or "router bgp"
    
    // Logic: Programmatic or Declarative
    check: (node: ConfigNode, context: Context) => RuleResult;

    metadata: {
        level: 'error' | 'warning' | 'info';
        obu: string;      
        owner: string;    
        remediation?: string;
    };
}
```

---

## 5. Implementation Plan

### Phase 1: The Core Parser (Powered by Bun Test)
*Goal: Turn messy text into a clean Tree structure. Speed is key here.*

1.  **Sanitizer:** Implement `src/parser/Sanitizer.ts` to clean Unicode spaces.
2.  **Schema Definition:** Define `BlockStarters` (regex for keywords like `interface`, `vlan`).
3.  **Permissive Parser:**
    *   Implement the `IndentStrategy` (structural) and `SchemaStrategy` (flat text).
    *   **Bun Benefit:** Create `test/parser.test.ts`. Run `bun test --watch`. The instant feedback loop will allow you to perfect the regexes rapidly.
4.  **Virtual Context:** Logic to detect "Orphan" commands (e.g., a floating `ip address` command) and wrap them in a `virtual_root` so rules can still validate them.

### Phase 2: The Rules Engine
*Goal: Apply logic to the Tree.*

1.  **Traversal:** Implement a walker to visit nodes.
2.  **Evaluator:** Create `src/engine/Runner.ts`.
    *   It accepts `ConfigNode` and `IRule[]`.
    *   It filters AST nodes based on `rule.selector`.
    *   It executes `rule.check(node)`.
3.  **Testing:** Write tests for complex rules (e.g., "Interface must have description AND proper IP mask"). `bun test` handles thousands of these checks in milliseconds.

### Phase 3: The CLI (Standalone Binary)
*Goal: CI/CD integration.*

1.  **Development:** Use `bun run packages/cli/index.ts` to run locally.
2.  **Reporting:** Implement a SARIF generator function.
3.  **Build (Bun Superpower):**
    *   Instead of shipping a node script, we compile to a single binary.
    *   Command: `bun build ./index.ts --compile --outfile gecko`
    *   Result: A standalone executable that runs without installing Node.js in the CI runner.

### Phase 4: VS Code Extension
*Goal: Real-time feedback.*

1.  **Setup:**
    *   The Extension Host runs Node.js.
    *   We write in TypeScript.
    *   We use **Bun** to bundle the code.
2.  **Bundling:**
    *   Script: `bun build ./src/extension.ts --outdir=dist --target=node`
    *   This generates the CommonJS required by VS Code, but does it 10x faster than Webpack.
3.  **Integration:**
    *   Map `RuleResult` objects to `vscode.Diagnostic` objects.
    *   Handle `onDidChangeTextDocument` events to trigger the `@gecko/core` parser.

---

## 6. Development Roadmap

1.  **Initialization:**
    *   `mkdir gecko && cd gecko`
    *   `bun init`
    *   Configure `package.json` workspaces.
2.  **Core Foundation:**
    *   Implement `ConfigNode` interface.
    *   Implement `SchemaAwareParser`.
    *   Verify with `bun test`.
3.  **Rule MVP:**
    *   Create one sample rule ("No public IP on management interface").
    *   Run it through the Engine.
4.  **CLI Wrapper:**
    *   Build the CLI to accept a filename, parse it, and print JSON results.
5.  **VS Code:**
    *   Wire up the parser to the VS Code Diagnostic Collection.

---

## 7. Next Steps (To Be Updated)

1.  Run the **Bun Init** sequence.
2.  Create the `packages/core` folder structure.
3.  Your first coding task: Write the **BlockStarters** regex list in `@gecko/core`.
