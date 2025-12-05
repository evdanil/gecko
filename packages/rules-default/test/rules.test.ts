import { describe, expect, test } from 'bun:test';
import { SchemaAwareParser, RuleEngine } from '@gecko/core';
import { NoMulticastBroadcastIp } from '../src/index';
import { readFile } from 'fs/promises';
import { join } from 'path';

const fixturesDir = join(import.meta.dir, 'fixtures');

describe('Default Rules Integration', () => {
    const parser = new SchemaAwareParser();
    const engine = new RuleEngine();
    // We are testing the default set of rules
    const rules = [NoMulticastBroadcastIp];

    test('valid-config.txt should pass all network rules', async () => {
        const configPath = join(fixturesDir, 'valid-config.txt');
        const config = await readFile(configPath, 'utf-8');
        
        const nodes = parser.parse(config);
        const results = engine.run(nodes, rules);

        // Filter for failures only
        const failures = results.filter(r => !r.passed);
        
        expect(failures).toHaveLength(0);
    });

    test('invalid-ip.txt should detect multicast and broadcast violations', async () => {
        const configPath = join(fixturesDir, 'invalid-ip.txt');
        const config = await readFile(configPath, 'utf-8');
        
        const nodes = parser.parse(config);
        const results = engine.run(nodes, rules);

        const failures = results.filter(r => !r.passed);

        // Expect 2 failures (one multicast, one broadcast)
        expect(failures).toHaveLength(2);

        // Verify specific error messages or IDs
        const multicastError = failures.find(r => r.message.includes('Multicast'));
        const broadcastError = failures.find(r => r.message.includes('Broadcast'));

        expect(multicastError).toBeDefined();
        expect(broadcastError).toBeDefined();
        
        expect(multicastError?.ruleId).toBe('NET-IP-001');
    });
});
