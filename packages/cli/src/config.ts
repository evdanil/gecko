/**
 * Configuration file loader for GECKO CLI
 * Supports: gecko.config.js, gecko.config.ts, .geckorc.js, .geckorc.ts
 */
import { IRule } from '@gecko/core';
import { allRules as defaultRules } from '@gecko/rules-default';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

/** Configuration file structure */
export interface GeckoConfig {
    /** Additional rules to include */
    rules?: IRule[];

    /** Rule IDs to disable */
    disable?: string[];

    /** Whether to include default rules (default: true) */
    includeDefaults?: boolean;
}

/** Resolved configuration with final rule set */
export interface ResolvedConfig {
    rules: IRule[];
    disabledIds: Set<string>;
}

/** Config file names to search for (in order of priority) */
const CONFIG_FILES = [
    'gecko.config.ts',
    'gecko.config.js',
    '.geckorc.ts',
    '.geckorc.js',
];

/**
 * Find config file starting from given directory, walking up to root
 */
export function findConfigFile(startDir: string): string | null {
    let currentDir = resolve(startDir);
    const root = dirname(currentDir);

    while (currentDir !== root) {
        for (const configFile of CONFIG_FILES) {
            const configPath = resolve(currentDir, configFile);
            if (existsSync(configPath)) {
                return configPath;
            }
        }
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }

    return null;
}

/**
 * Load configuration from a file
 */
export async function loadConfigFile(configPath: string): Promise<GeckoConfig> {
    try {
        const module = await import(configPath);
        return module.default ?? module;
    } catch (error) {
        throw new Error(
            `Failed to load config file "${configPath}": ${error instanceof Error ? error.message : error}`
        );
    }
}

/**
 * Load rules from an external file (for --rules flag)
 */
export async function loadExternalRules(rulesPath: string): Promise<IRule[]> {
    try {
        const absolutePath = resolve(rulesPath);
        const module = await import(absolutePath);

        // Support: export default [], export const rules = [], or module.exports = []
        const rules = module.default ?? module.rules ?? module;

        if (!Array.isArray(rules)) {
            throw new Error('Rules file must export an array of rules');
        }

        return rules;
    } catch (error) {
        throw new Error(
            `Failed to load rules from "${rulesPath}": ${error instanceof Error ? error.message : error}`
        );
    }
}

export interface ResolveOptions {
    /** Path to config file (overrides auto-detection) */
    configPath?: string;

    /** Skip config file loading */
    noConfig?: boolean;

    /** Additional rules file path */
    rulesPath?: string;

    /** Rule IDs to disable (CLI override) */
    disableIds?: string[];

    /** Working directory for config file search */
    cwd?: string;
}

/**
 * Resolve final rule set from config file + CLI options
 */
export async function resolveRules(options: ResolveOptions = {}): Promise<IRule[]> {
    const {
        configPath,
        noConfig = false,
        rulesPath,
        disableIds = [],
        cwd = process.cwd(),
    } = options;

    let config: GeckoConfig = { includeDefaults: true };

    // Load config file (unless --no-config)
    if (!noConfig) {
        const foundConfigPath = configPath ?? findConfigFile(cwd);
        if (foundConfigPath) {
            config = await loadConfigFile(foundConfigPath);
        }
    }

    // Build rule map (for deduplication and override)
    const ruleMap = new Map<string, IRule>();

    // 1. Add default rules (if enabled)
    if (config.includeDefaults !== false) {
        for (const rule of defaultRules) {
            ruleMap.set(rule.id, rule);
        }
    }

    // 2. Add config file rules (override by ID)
    if (config.rules) {
        for (const rule of config.rules) {
            ruleMap.set(rule.id, rule);
        }
    }

    // 3. Add CLI --rules file (override by ID)
    if (rulesPath) {
        const externalRules = await loadExternalRules(rulesPath);
        for (const rule of externalRules) {
            ruleMap.set(rule.id, rule);
        }
    }

    // 4. Collect all disabled IDs (config + CLI)
    const allDisabledIds = new Set<string>([
        ...(config.disable ?? []),
        ...disableIds,
    ]);

    // 5. Filter out disabled rules
    const finalRules: IRule[] = [];
    for (const [id, rule] of ruleMap) {
        if (!allDisabledIds.has(id)) {
            finalRules.push(rule);
        }
    }

    return finalRules;
}
