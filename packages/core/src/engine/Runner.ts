// packages/core/src/engine/Runner.ts

import { ConfigNode } from '../types/ConfigNode';
import { IRule, RuleResult, Context } from '../types/IRule';

/**
 * The Rule Engine responsible for validating a configuration AST against a set of rules.
 */
export class RuleEngine {
    /**
     * Runs a set of rules against a configuration AST.
     *
     * @param nodes The root nodes of the configuration AST.
     * @param rules The list of rules to apply.
     * @param context Optional global context to pass to rules.
     * @returns An array of RuleResult objects representing the outcomes of applied rules.
     */
    public run(nodes: ConfigNode[], rules: IRule[], context: Partial<Context> = {}): RuleResult[] {
        const results: RuleResult[] = [];
        
        // Helper to recursively visit nodes
        const visit = (node: ConfigNode) => {
            // Check each rule against the current node
            for (const rule of rules) {
                if (this.matchesSelector(node, rule.selector)) {
                    try {
                        // Create context with full AST for cross-reference validation
                        const ruleContext: Context = {
                            ...context,
                            ast: nodes,
                        };

                        const result = rule.check(node, ruleContext);
                        
                        // We only collect results if the rule failed or explicitly returned a result
                        // (Depending on desired verbosity. Usually we want all results or just failures.
                        //  Let's assume the rule returns a result if it ran. 
                        //  Typical SARIF generation needs both pass and fail, but mostly fails are interesting.
                        //  For now, keep everything returned.)
                        if (result) {
                             results.push(result);
                        }
                    } catch (error) {
                        // Handle rule execution errors gracefully
                        results.push({
                            passed: false,
                            message: `Rule execution error: ${error instanceof Error ? error.message : String(error)}`,
                            ruleId: rule.id,
                            nodeId: node.id,
                            level: 'error',
                            loc: node.loc
                        });
                    }
                }
            }

            // Recurse into children
            for (const child of node.children) {
                visit(child);
            }
        };

        for (const node of nodes) {
            visit(node);
        }

        return results;
    }

    /**
     * Checks if a node matches a rule's selector.
     * 
     * @param node The configuration node.
     * @param selector The selector string (e.g., "interface", "router bgp").
     * @returns True if the node matches the selector.
     */
    private matchesSelector(node: ConfigNode, selector?: string): boolean {
        if (!selector) {
            // If no selector is provided, the rule applies to all nodes? 
            // Or maybe specific types? Let's assume no selector means "run on everything" 
            // or "manual check inside rule". 
            // PROJECT.md implies selector is for optimization. 
            // Let's assume empty selector matches nothing or everything. 
            // Safe bet: if no selector, maybe it's a global rule?
            // But global rules usually target the 'virtual_root' or check the whole file.
            // Let's assume it matches everything for flexibility, but usually rules have selectors.
            return true; 
        }

        // Simple case-insensitive startsWith match for now.
        // "interface" matches "interface GigabitEthernet1"
        // "router bgp" matches "router bgp 65000"
        // "ip address" matches "ip address 1.1.1.1 ..."
        const normalizedId = node.id.toLowerCase();
        const normalizedSelector = selector.toLowerCase();

        return normalizedId.startsWith(normalizedSelector);
    }
}
