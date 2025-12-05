#!/usr/bin/env bun
import { Command } from 'commander';
import { SchemaAwareParser, RuleEngine } from '@gecko/core';
import { allRules } from '@gecko/rules-default';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { generateSarif } from './src/sarif';

const program = new Command();

program
  .name('gecko')
  .description('Generic Engine for Configuration Knowledge & Oversight')
  .version('0.0.1')
  .argument('[file]', 'Path to the configuration file')
  .option('--ast', 'Output the AST instead of rule results')
  .option('-f, --format <format>', 'Output format (json, sarif)', 'json')
  .option('-q, --quiet', 'Only output failures (suppress passed results)')
  .action(async (file, options) => {
    if (!file) {
      program.help();
      return;
    }

    try {
      const filePath = resolve(file);
      const content = await readFile(filePath, 'utf-8');
      const parser = new SchemaAwareParser();
      const nodes = parser.parse(content);

      if (options.ast) {
        console.log(JSON.stringify(nodes, null, 2));
        return;
      }

      const engine = new RuleEngine();
      let results = engine.run(nodes, allRules);

      // Filter to failures only if quiet mode
      if (options.quiet) {
        results = results.filter(r => !r.passed);
      }

      // Output results based on format
      if (options.format === 'sarif') {
          console.log(generateSarif(results, filePath, allRules));
      } else {
          console.log(JSON.stringify(results, null, 2));
      }

      // Exit with error code if there are failures
      const hasFailures = results.some(r => !r.passed);
      if (hasFailures) {
        process.exit(1);
      }

    } catch (error) {
      console.error('Error processing file:', error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });

program.parse();
