# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
bun install

# Run all tests (fast, uses bun:test)
bun test

# Run a single test file
bun test packages/core/test/parser.test.ts

# Run tests in watch mode
bun test --watch

# Build CLI binary (standalone executable, no Node.js required)
bun build packages/cli/index.ts --compile --outfile gecko.exe

# Run CLI during development
bun run packages/cli/index.ts <config-file>

# Run CLI with options
bun run packages/cli/index.ts config.txt --format sarif
bun run packages/cli/index.ts config.txt --ast
```

## Architecture Overview

GECKO is a TypeScript monorepo (Bun workspaces) for validating network device configurations (Cisco IOS, Juniper, etc.) against compliance rules.

### Package Structure

- **`@gecko/core`** - Core engine with zero external dependencies
  - `parser/SchemaAwareParser.ts` - Permissive parser that handles partial configs and snippets
  - `parser/BlockStarters.ts` - Regex patterns for section-starting keywords (interface, router, vlan, etc.)
  - `engine/Runner.ts` - Rule evaluation engine that traverses the AST
  - `types/ConfigNode.ts` - AST node structure
  - `types/IRule.ts` - Rule interface and result types

- **`@gecko/cli`** - Command-line tool using Commander.js, outputs JSON or SARIF

- **`@gecko/rules-default`** - Default rule library (NET-IP-001, etc.)

- **`@gecko/vscode`** - VS Code extension (builds with Bun, runs on Node/Electron)

### Key Concepts

**ConfigNode AST**: The parser transforms config text into a tree of `ConfigNode` objects with types: `section`, `command`, `comment`, `virtual_root`.

**Snippet Resilience**: Orphan commands (e.g., `ip address` without parent interface block) are wrapped in a `virtual_root` node so rules can still validate them.

**Selectors**: Rules use `selector` strings (e.g., `"ip address"`, `"interface"`) for case-insensitive prefix matching against `node.id` to optimize which nodes they evaluate.

**Rule Structure**:
```typescript
{
  id: 'NET-IP-001',
  selector: 'ip address',
  metadata: { level: 'error', obu: 'Business Unit', owner: 'Team' },
  check: (node: ConfigNode, context: Context) => RuleResult
}
```

### Isomorphic Design

The same `@gecko/core` logic runs in both:
- CLI (Bun runtime, compiles to standalone binary)
- VS Code extension (Node.js runtime via Electron)

## Coding Standards

### TypeScript

- **No `any` types** - Use `unknown` with type guards if strictly necessary
- Use advanced types: Generics, Conditional Types, Utility Types (`Pick`, `Omit`, `Partial`), Mapped Types
- Strict null checks and strict property initialization enabled
- Prefer `interface` for public APIs, `type` for unions/intersections

### Performance

- Consider Time/Space complexity (Big O) for algorithmic code
- Prefer appropriate data structures (Maps, Sets) over Arrays for lookups
- For large datasets or I/O, prefer Streams over buffering into memory

### Architecture

- Follow SOLID principles
- Create custom Error classes for domain-specific errors
- Sanitize inputs (especially in rule checks that parse user config data)
