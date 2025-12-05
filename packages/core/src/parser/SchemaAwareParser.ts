// packages/core/src/parser/SchemaAwareParser.ts

import { ConfigNode, NodeType } from '../types/ConfigNode';
import { BlockStarters } from './BlockStarters';
import { sanitizeText } from './Sanitizer';

/**
 * Options for the SchemaAwareParser.
 */
export interface ParserOptions {
    /**
     * The starting line number for the input text, useful for snippets.
     * @default 0
     */
    startLine?: number;
    /**
     * Whether the input is a full configuration ('base') or a partial snippet ('snippet').
     * @default 'base'
     */
    source?: 'base' | 'snippet';
}

/**
 * Represents a line processed during parsing, including its content and indentation level.
 */
interface ParsedLine {
    original: string;
    sanitized: string;
    lineNumber: number; // Absolute line number in the original source
    indent: number;
    isBlockStarter: boolean;
}

/**
 * Implements a permissive parser that can interpret hierarchical configuration
 * structures even from flattened text or snippets, using both indentation
 * and schema-aware block starters.
 */
export class SchemaAwareParser {
    private readonly options: Required<ParserOptions>;

    constructor(options?: ParserOptions) {
        this.options = {
            startLine: options?.startLine ?? 0,
            source: options?.source ?? 'base',
        };
    }

    /**
     * Parses the input configuration text into an Abstract Syntax Tree (AST) of ConfigNodes.
     * It attempts to infer hierarchy using indentation and predefined block-starting keywords.
     *
     * @param configText The raw configuration text to parse.
     * @returns An array of top-level ConfigNodes representing the parsed configuration.
     */
    public parse(configText: string): ConfigNode[] {
        const lines = configText.split('\n');
        const lineContexts: ParsedLine[] = [];

        // Pre-process lines to get indentation and block starter info
        for (let i = 0; i < lines.length; i++) {
            const originalLine = lines[i];
            const sanitizedLine = sanitizeText(originalLine);

            // Skip empty lines and comments (lines starting with '!')
            if (sanitizedLine.length === 0 || sanitizedLine.startsWith('!')) {
                continue;
            }

            lineContexts.push({
                original: originalLine,
                sanitized: sanitizedLine,
                lineNumber: this.options.startLine + i,
                indent: originalLine.search(/\S|$/), // Get actual indentation of the line
                isBlockStarter: this.isSchemaBlockStarter(sanitizedLine),
            });
        }

        const rootNodes: ConfigNode[] = [];
        const parentStack: ConfigNode[] = []; // Stack of current parent nodes

        for (const currentLine of lineContexts) {
            const newNodeType: NodeType = currentLine.isBlockStarter ? 'section' : 'command';
            const newNode = this.createConfigNode(currentLine, newNodeType);

            // Adjust parentStack:
            // Pop nodes from the stack if:
            // 1. Their indent is greater than or equal to the current line's indent (indentation break).
            // 2. The current line is a BlockStarter, and the top of the stack is *not* a section.
            //    This forces BlockStarters to find a section parent, or become top-level.
            while (parentStack.length > 0) {
                const topOfStack = parentStack.at(-1)!;

                const isIndentationBreak = currentLine.indent <= topOfStack.indent;
                const isBlockStarterForcingPop = currentLine.isBlockStarter && topOfStack.type !== 'section';

                if (isIndentationBreak || isBlockStarterForcingPop) {
                    parentStack.pop();
                } else {
                    break; // Found a suitable parent
                }
            }
            
            let currentParent: ConfigNode | undefined = parentStack.at(-1);

            if (currentParent) {
                currentParent.children.push(newNode);
            } else {
                rootNodes.push(newNode);
            }

            parentStack.push(newNode); // Always push, let the while loop prune for next iteration.
        }

        // Apply Virtual Context logic for orphan commands at the end if necessary
        return this.applyVirtualContext(rootNodes);
    }

    /**
     * Checks if a sanitized line matches any of the defined BlockStarters regexes.
     * This is the "SchemaStrategy" part.
     */
    private isSchemaBlockStarter(sanitizedLine: string): boolean {
        return BlockStarters.some(regex => regex.test(sanitizedLine));
    }

    /**
     * Creates a ConfigNode object from a ParsedLine.
     */
    private createConfigNode(parsedLine: ParsedLine, type: NodeType): ConfigNode {
        // Splitting params: simple space-split for now.
        // TODO: Enhance for quoted strings, special characters etc.
        const params = parsedLine.sanitized.split(/\s+/).filter(p => p.length > 0);
        const id = parsedLine.sanitized; // Identifier for the node, can be refined later.

        return {
            id,
            type,
            rawText: parsedLine.original,
            params,
            children: [],
            source: this.options.source,
            loc: {
                startLine: parsedLine.lineNumber,
                endLine: parsedLine.lineNumber,
            },
            indent: parsedLine.indent, // Populate the new indent property
        };
    }

    /**
     * Logic to detect "Orphan" commands (e.g., a floating `ip address` command)
     * and wrap them in a `virtual_root` so rules can still validate them.
     * This function groups *consecutive* top-level commands under a single `virtual_root`.
     *
     * @param nodes An array of top-level ConfigNodes, potentially including orphans.
     * @returns A new array of ConfigNodes where consecutive top-level commands are wrapped.
     */
    private applyVirtualContext(nodes: ConfigNode[]): ConfigNode[] {
        const processedNodes: ConfigNode[] = [];
        let currentVirtualRoot: ConfigNode | null = null;

        for (const node of nodes) {
            if (node.type === 'command') {
                // If it's a top-level command, and no virtual root is active, create one.
                if (!currentVirtualRoot) {
                    currentVirtualRoot = {
                        id: `virtual_root_line_${node.loc.startLine}`,
                        type: 'virtual_root',
                        rawText: 'virtual_root',
                        params: ['virtual_root'],
                        children: [],
                        source: this.options.source,
                        loc: {
                            startLine: node.loc.startLine,
                            endLine: node.loc.endLine,
                        },
                    };
                    processedNodes.push(currentVirtualRoot);
                }
                // Add the command to the current virtual root
                currentVirtualRoot.children.push(node);
                // Extend the virtual root's span to cover this new child
                currentVirtualRoot.loc.endLine = Math.max(currentVirtualRoot.loc.endLine, node.loc.endLine);
            } else {
                // If we encounter a section, the current virtual root sequence is broken.
                // Reset virtual root and add the section directly.
                currentVirtualRoot = null;
                processedNodes.push(node);
            }
        }
        return processedNodes;
    }
}
