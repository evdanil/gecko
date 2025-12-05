// packages/cli/src/sarif.ts

import { RuleResult, IRule } from '@gecko/core';

interface SarifRule {
    id: string;
    name: string;
    shortDescription: { text: string };
    defaultConfiguration: { level: string };
    helpUri?: string;
}

/**
 * Generates a SARIF report from the given rule results.
 *
 * @param results The array of RuleResult objects.
 * @param filePath The path to the scanned file.
 * @param rules Optional array of rules to include metadata in report.
 * @returns A string containing the JSON-formatted SARIF report.
 */
export function generateSarif(results: RuleResult[], filePath: string, rules?: IRule[]): string {
    const sarifResults = results.map(result => {
        return {
            ruleId: result.ruleId,
            level: result.level === 'info' ? 'note' : result.level,
            message: {
                text: result.message
            },
            locations: result.loc ? [
                {
                    physicalLocation: {
                        artifactLocation: {
                            uri: filePath
                        },
                        region: {
                            startLine: result.loc.startLine + 1, // SARIF is 1-based
                            endLine: result.loc.endLine + 1
                        }
                    }
                }
            ] : []
        };
    });

    // Build rule definitions from provided rules
    const sarifRules: SarifRule[] = rules?.map(rule => ({
        id: rule.id,
        name: rule.id,
        shortDescription: { text: rule.metadata.remediation ?? rule.id },
        defaultConfiguration: {
            level: rule.metadata.level === 'info' ? 'note' : rule.metadata.level
        }
    })) ?? [];

    const report = {
        version: "2.1.0",
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [
            {
                tool: {
                    driver: {
                        name: "GECKO",
                        version: "0.0.1",
                        informationUri: "https://github.com/gecko/gecko",
                        rules: sarifRules
                    }
                },
                results: sarifResults
            }
        ]
    };

    return JSON.stringify(report, null, 2);
}
