import { describe, expect, test } from 'bun:test';
import { SchemaAwareParser, RuleEngine } from '@gecko/core';
import { NoMulticastBroadcastIp, allRules } from '../src/index';
import { readFile } from 'fs/promises';
import { join } from 'path';

const fixturesDir = join(import.meta.dir, 'fixtures');

describe('IP Address Validation (NET-IP-001)', () => {
    const parser = new SchemaAwareParser();
    const engine = new RuleEngine();
    const ipRules = [NoMulticastBroadcastIp];

    test('valid-config.txt should pass IP validation', async () => {
        const configPath = join(fixturesDir, 'valid-config.txt');
        const config = await readFile(configPath, 'utf-8');

        const nodes = parser.parse(config);
        const results = engine.run(nodes, ipRules);

        const failures = results.filter(r => !r.passed);

        expect(failures).toHaveLength(0);
    });

    test('valid-long.txt should pass IP validation', async () => {
        const configPath = join(fixturesDir, 'valid-long.txt');
        const config = await readFile(configPath, 'utf-8');

        const nodes = parser.parse(config);
        const results = engine.run(nodes, ipRules);

        const failures = results.filter(r => !r.passed);

        expect(failures).toHaveLength(0);
    });

    test('invalid-ip.txt should detect multicast and broadcast violations', async () => {
        const configPath = join(fixturesDir, 'invalid-ip.txt');
        const config = await readFile(configPath, 'utf-8');

        const nodes = parser.parse(config);
        const results = engine.run(nodes, ipRules);

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

    test('/32 loopback addresses should be valid', () => {
        const config = `
interface Loopback0
 ip address 1.1.1.1 255.255.255.255
`;
        const nodes = parser.parse(config);
        const results = engine.run(nodes, ipRules);

        const failures = results.filter(r => !r.passed);
        expect(failures).toHaveLength(0);
    });
});

describe('All Rules Integration', () => {
    const parser = new SchemaAwareParser();
    const engine = new RuleEngine();

    test('allRules array should contain multiple rules', () => {
        expect(allRules.length).toBeGreaterThan(1);
    });

    test('valid-config.txt should pass all rules', async () => {
        const configPath = join(fixturesDir, 'valid-config.txt');
        const config = await readFile(configPath, 'utf-8');

        const nodes = parser.parse(config);
        const results = engine.run(nodes, allRules);

        // Only check for errors, not warnings
        const errors = results.filter(r => !r.passed && r.level === 'error');

        expect(errors).toHaveLength(0);
    });
});
