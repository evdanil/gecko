#!/usr/bin/env bun
import { Command } from 'commander';
import { SchemaAwareParser, RuleEngine, IRule } from '@gecko/core';
import { NoMulticastBroadcastIp } from '@gecko/rules-default';
import { readFile } from 'fs/promises';
import { generateSarif } from './src/sarif';

const program = new Command();

program
  .name('gecko')
  .description('Generic Engine for Configuration Knowledge & Oversight')
  .version('0.0.1')
  .argument('<file>', 'Path to the configuration file')
  .option('--ast', 'Output the AST instead of rule results')
  .option('-f, --format <format>', 'Output format (json, sarif)', 'json')
  .action(async (file, options) => {
    try {
      // Check if file exists/readable happens in readFile
      const content = await readFile(file, 'utf-8');
      const parser = new SchemaAwareParser();
      const nodes = parser.parse(content);

      if (options.ast) {
        console.log(JSON.stringify(nodes, null, 2));
        return;
      }

      // Active Rules
      const rules: IRule[] = [
           NoMulticastBroadcastIp
      ];

      const engine = new RuleEngine();
      const results = engine.run(nodes, rules);

      // Output results based on format
      if (options.format === 'sarif') {
          console.log(generateSarif(results));
      } else {
          console.log(JSON.stringify(results, null, 2));
      }

    } catch (error) {
      console.error('Error processing file:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
