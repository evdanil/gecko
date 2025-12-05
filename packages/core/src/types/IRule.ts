// packages/core/src/types/IRule.ts

import { ConfigNode } from "./ConfigNode"; // Assuming ConfigNode is defined elsewhere

/**
 * Represents the outcome of a rule check.
 */
export interface RuleResult {
    /**
     * True if the rule passed, false if it failed.
     */
    passed: boolean;
    /**
     * A message explaining the rule's outcome, especially on failure.
     */
    message: string;
    /**
     * The ID of the rule that was checked.
     */
    ruleId: string;
    /**
     * The ID of the node that was checked.
     */
    nodeId: string;
    /**
     * The level of the result (error, warning, info).
     */
    level: 'error' | 'warning' | 'info';
    /**
     * Optional: Remediation steps if the rule failed.
     */
    remediation?: string;
    /**
     * Optional: The specific lines in the configuration where the issue was found.
     */
    loc?: {
        startLine: number;
        endLine: number;
    };
}

/**
 * Contextual information passed to a rule's check function.
 * This might include global settings, other AST nodes, or environmental data.
 * For now, it's a basic placeholder.
 */
export interface Context {
    // Add properties as needed during engine implementation
    // Example: globalVariables: Record<string, any>;
    // Example: fileMetadata: { path: string; };
    // Example: getNodesOfType: (type: NodeType) => ConfigNode[];
}

/**
 * Defines the structure of a configuration validation rule.
 */
export interface IRule {
    /**
     * A unique identifier for the rule (e.g., "NET-SEC-001").
     */
    id: string;

    /**
     * An optional selector string (e.g., "interface", "router bgp")
     * that determines which `ConfigNode` types this rule should be applied to.
     * This is used for optimization to avoid running rules on irrelevant nodes.
     */
    selector?: string;

    /**
     * The function that contains the core logic of the rule.
     * It takes a `ConfigNode` and a `Context` object, and returns a `RuleResult`.
     */
    check: (node: ConfigNode, context: Context) => RuleResult;

    /**
     * Metadata associated with the rule, used for reporting and categorization.
     */
    metadata: {
        level: 'error' | 'warning' | 'info';
        obu: string;      // Organizational Business Unit
        owner: string;    // Owner of the rule logic
        remediation?: string; // Suggested steps to fix the violation
    };
}
