// packages/cli/src/sarif.ts

import { RuleResult } from '@gecko/core';

/**
 * Generates a SARIF report from the given rule results.
 * 
 * @param results The array of RuleResult objects.
 * @returns A string containing the JSON-formatted SARIF report.
 */
export function generateSarif(results: RuleResult[]): string {
    const sarifResults = results.map(result => {
        return {
            ruleId: result.ruleId,
            level: result.level === 'info' ? 'note' : result.level, // SARIF uses 'note', 'warning', 'error'
            message: {
                text: result.message
            },
            locations: result.loc ? [
                {
                    physicalLocation: {
                        artifactLocation: {
                            uri: 'config' // specific file path could be passed if available
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
                        rules: [] // Ideally populate with rule metadata
                    }
                },
                results: sarifResults
            }
        ]
    };

    return JSON.stringify(report, null, 2);
}
