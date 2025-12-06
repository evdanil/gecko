import { IRule, ConfigNode, RuleResult, Context } from '@gecko/core';

/**
 * Rule: Ensure IP addresses configured on interfaces are not Multicast, Global Broadcast, 
 * or the Subnet Broadcast/Network ID addresses.
 */
export const NoMulticastBroadcastIp: IRule = {
    id: 'NET-IP-001',
    selector: 'ip address',
    metadata: {
        level: 'error',
        obu: 'Network Engineering',
        owner: 'NetOps',
        remediation: 'Configure a valid unicast IP address. Do not use Multicast, Broadcast, or Network ID addresses.'
    },
    check: (node: ConfigNode): RuleResult => {
        // Standard format: "ip address <IP> <MASK>"
        const ipStr = node.params[2];
        const maskStr = node.params[3];

        if (!ipStr) {
            return {
                passed: true,
                message: 'Incomplete ip address command.',
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'info',
                loc: node.loc
            };
        }

        // Helper to parse IP to 32-bit unsigned integer
        const parseIp = (addr: string): number | null => {
            const parts = addr.split('.').map(Number);
            if (parts.length !== 4 || parts.some(isNaN)) return null;
            return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
        };

        const ipNum = parseIp(ipStr);

        if (ipNum === null) {
             return {
                passed: false,
                message: `Invalid IP address format: ${ipStr}`,
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'error',
                loc: node.loc
            };
        }

        // 1. Check Multicast (224.0.0.0 - 239.255.255.255) -> First octet 224-239
        const firstOctet = (ipNum >>> 24);
        if (firstOctet >= 224 && firstOctet <= 239) {
             return {
                passed: false,
                message: `Invalid assignment: ${ipStr} is a Multicast address.`,
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'error',
                loc: node.loc
            };
        }

        // 2. Check Global Broadcast (255.255.255.255)
        // 255.255.255.255 as uint32 is 0xFFFFFFFF (4294967295)
        if (ipNum === 0xFFFFFFFF) {
             return {
                passed: false,
                message: `Invalid assignment: ${ipStr} is the Global Broadcast address.`,
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'error',
                loc: node.loc
            };
        }

        // 3. Check Subnet Validity if Mask is provided
        if (maskStr) {
            const maskNum = parseIp(maskStr);
            if (maskNum !== null) {
                // Skip /32 masks (255.255.255.255) - valid for loopbacks and host routes
                if (maskNum === 0xFFFFFFFF) {
                    return {
                        passed: true,
                        message: `IP address ${ipStr} with /32 mask is valid (host route/loopback).`,
                        ruleId: 'NET-IP-001',
                        nodeId: node.id,
                        level: 'info',
                        loc: node.loc
                    };
                }

                const networkAddr = (ipNum & maskNum) >>> 0;
                const broadcastAddr = (networkAddr | (~maskNum >>> 0)) >>> 0;

                if (ipNum === networkAddr) {
                    return {
                        passed: false,
                        message: `Invalid assignment: ${ipStr} is the Network ID for subnet ${maskStr}.`,
                        ruleId: 'NET-IP-001',
                        nodeId: node.id,
                        level: 'error',
                        loc: node.loc
                    };
                }

                if (ipNum === broadcastAddr) {
                    return {
                        passed: false,
                        message: `Invalid assignment: ${ipStr} is the Broadcast address for subnet ${maskStr}.`,
                        ruleId: 'NET-IP-001',
                        nodeId: node.id,
                        level: 'error',
                        loc: node.loc
                    };
                }
            }
        }

        return {
            passed: true,
            message: `IP address ${ipStr} is valid.`,
            ruleId: 'NET-IP-001',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};

/**
 * Rule: Ensure interfaces have a description configured.
 * Applies to interface sections (GigabitEthernet, FastEthernet, Loopback, Vlan, etc.)
 */
export const InterfaceDescriptionRequired: IRule = {
    id: 'NET-DOC-001',
    selector: 'interface',
    metadata: {
        level: 'warning',
        obu: 'Network Engineering',
        owner: 'NetOps',
        remediation: 'Add a description to the interface using the "description" command.'
    },
    check: (node: ConfigNode): RuleResult => {
        // Skip Null and Loopback interfaces - descriptions often optional
        const interfaceName = node.id.toLowerCase();
        if (interfaceName.includes('null') || interfaceName.includes('loopback')) {
            return {
                passed: true,
                message: 'Loopback/Null interface - description optional.',
                ruleId: 'NET-DOC-001',
                nodeId: node.id,
                level: 'info',
                loc: node.loc
            };
        }

        const hasDescription = node.children.some(child =>
            child.id.toLowerCase().startsWith('description')
        );

        if (!hasDescription) {
            return {
                passed: false,
                message: `Interface "${node.params.slice(1).join(' ')}" is missing a description.`,
                ruleId: 'NET-DOC-001',
                nodeId: node.id,
                level: 'warning',
                loc: node.loc
            };
        }

        return {
            passed: true,
            message: 'Interface has a description.',
            ruleId: 'NET-DOC-001',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};

/**
 * Rule: Detect plaintext passwords in configuration.
 * Looks for "password" commands without encryption type 7 or secret.
 */
export const NoPlaintextPasswords: IRule = {
    id: 'NET-SEC-001',
    selector: 'password',
    metadata: {
        level: 'error',
        obu: 'Security',
        owner: 'SecOps',
        remediation: 'Use "secret" instead of "password", or ensure password is encrypted (type 7 or higher).'
    },
    check: (node: ConfigNode): RuleResult => {
        const params = node.params;
        const nodeId = node.id.toLowerCase();

        // Skip global config commands that aren't password definitions
        // e.g., "password encryption aes", "service password-encryption"
        if (nodeId.includes('encryption') || nodeId.includes('service')) {
            return {
                passed: true,
                message: 'Global password configuration command.',
                ruleId: 'NET-SEC-001',
                nodeId: node.id,
                level: 'info',
                loc: node.loc
            };
        }

        // Check if it's "password 7 <encrypted>" which is acceptable
        // or "password 0 <plaintext>" which is not
        // Format: password [type] <value>
        if (params.length >= 2) {
            const typeOrValue = params[1];

            // If second param is a number, it's the encryption type
            if (typeOrValue === '7' || typeOrValue === '5' || typeOrValue === '8' || typeOrValue === '9') {
                return {
                    passed: true,
                    message: 'Password is encrypted.',
                    ruleId: 'NET-SEC-001',
                    nodeId: node.id,
                    level: 'info',
                    loc: node.loc
                };
            }

            // Type 0 is explicitly plaintext
            if (typeOrValue === '0') {
                return {
                    passed: false,
                    message: 'Plaintext password detected (type 0).',
                    ruleId: 'NET-SEC-001',
                    nodeId: node.id,
                    level: 'error',
                    loc: node.loc
                };
            }

            // If no type specified, it's likely plaintext
            if (!/^\d+$/.test(typeOrValue)) {
                return {
                    passed: false,
                    message: 'Possible plaintext password detected. Use encryption type 7 or "secret" command.',
                    ruleId: 'NET-SEC-001',
                    nodeId: node.id,
                    level: 'error',
                    loc: node.loc
                };
            }
        }

        return {
            passed: true,
            message: 'Password check passed.',
            ruleId: 'NET-SEC-001',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};

/**
 * Rule: SSH version 2 should be configured.
 * Detects "ip ssh version 1" as insecure.
 */
export const SSHVersion2Required: IRule = {
    id: 'NET-SEC-002',
    selector: 'ip ssh version',
    metadata: {
        level: 'error',
        obu: 'Security',
        owner: 'SecOps',
        remediation: 'Configure "ip ssh version 2" to use secure SSH protocol.'
    },
    check: (node: ConfigNode): RuleResult => {
        const params = node.params;

        // Format: ip ssh version <1|2>
        if (params.length >= 4) {
            const version = params[3];

            if (version === '1') {
                return {
                    passed: false,
                    message: 'SSH version 1 is insecure and deprecated.',
                    ruleId: 'NET-SEC-002',
                    nodeId: node.id,
                    level: 'error',
                    loc: node.loc
                };
            }

            if (version === '2') {
                return {
                    passed: true,
                    message: 'SSH version 2 is configured.',
                    ruleId: 'NET-SEC-002',
                    nodeId: node.id,
                    level: 'info',
                    loc: node.loc
                };
            }
        }

        return {
            passed: true,
            message: 'SSH version check inconclusive.',
            ruleId: 'NET-SEC-002',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};

/**
 * Rule: VTY lines should have access-class configured.
 * Ensures remote access is restricted by ACL.
 */
export const VTYAccessClassRequired: IRule = {
    id: 'NET-SEC-003',
    selector: 'line vty',
    metadata: {
        level: 'warning',
        obu: 'Security',
        owner: 'SecOps',
        remediation: 'Configure "access-class <ACL> in" under VTY lines to restrict remote access.'
    },
    check: (node: ConfigNode): RuleResult => {
        const hasAccessClass = node.children.some(child =>
            child.id.toLowerCase().startsWith('access-class')
        );

        if (!hasAccessClass) {
            return {
                passed: false,
                message: 'VTY lines missing access-class restriction.',
                ruleId: 'NET-SEC-003',
                nodeId: node.id,
                level: 'warning',
                loc: node.loc
            };
        }

        return {
            passed: true,
            message: 'VTY lines have access-class configured.',
            ruleId: 'NET-SEC-003',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};

/**
 * Rule: Validate OSPF network statements.
 *
 * Best practice: Use specific interface IPs with 0.0.0.0 wildcard mask.
 * Example: "network 192.168.1.1 0.0.0.0 area 0" (interface IP with /32)
 * Instead of: "network 192.168.1.0 0.0.0.255 area 0" (subnet range)
 *
 * Warnings:
 * 1. Network statement uses wildcard other than 0.0.0.0 (not best practice)
 * 2. Network statement IP doesn't match any configured interface IP
 */
export const OspfNetworkBestPractice: IRule = {
    id: 'NET-OSPF-001',
    selector: 'router ospf',
    metadata: {
        level: 'warning',
        obu: 'Network Engineering',
        owner: 'NetOps',
        remediation: 'Use specific interface IP addresses with 0.0.0.0 wildcard mask (e.g., "network 10.0.0.1 0.0.0.0 area 0").'
    },
    check: (node: ConfigNode, context: Context): RuleResult => {
        // Helper to parse IP to 32-bit unsigned integer
        const parseIp = (addr: string): number | null => {
            const parts = addr.split('.').map(Number);
            if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
            return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
        };

        // Collect all interface IPs from the AST
        const interfaceIps = new Set<number>();
        const collectInterfaceIps = (nodes: ConfigNode[]) => {
            for (const n of nodes) {
                if (n.id.toLowerCase().startsWith('interface')) {
                    // Look for "ip address" commands in interface children
                    for (const child of n.children) {
                        const childId = child.id.toLowerCase().trim();
                        if (childId.startsWith('ip address')) {
                            // Format: "ip address <IP> <MASK>"
                            const ipStr = child.params[2];
                            if (ipStr) {
                                const ip = parseIp(ipStr);
                                if (ip !== null) {
                                    interfaceIps.add(ip);
                                }
                            }
                        }
                    }
                }
                if (n.children.length > 0) {
                    collectInterfaceIps(n.children);
                }
            }
        };

        if (context.ast) {
            collectInterfaceIps(context.ast);
        }

        // Find network statements in this OSPF section
        const networkStatements = node.children.filter(child =>
            child.id.toLowerCase().trim().startsWith('network')
        );

        if (networkStatements.length === 0) {
            return {
                passed: true,
                message: 'No network statements found in OSPF configuration.',
                ruleId: 'NET-OSPF-001',
                nodeId: node.id,
                level: 'info',
                loc: node.loc
            };
        }

        const issues: string[] = [];

        for (const netStmt of networkStatements) {
            // Format: "network <IP> <WILDCARD> area <AREA>"
            const params = netStmt.params;
            const networkIpStr = params[1];
            const wildcardStr = params[2];

            if (!networkIpStr || !wildcardStr) {
                issues.push(`Line ${netStmt.loc.startLine}: Incomplete network statement "${netStmt.rawText.trim()}".`);
                continue;
            }

            const networkIp = parseIp(networkIpStr);
            const wildcard = parseIp(wildcardStr);

            if (networkIp === null) {
                issues.push(`Line ${netStmt.loc.startLine}: Invalid IP address "${networkIpStr}".`);
                continue;
            }

            if (wildcard === null) {
                issues.push(`Line ${netStmt.loc.startLine}: Invalid wildcard mask "${wildcardStr}".`);
                continue;
            }

            // Check 1: Best practice is to use 0.0.0.0 wildcard (exact match)
            if (wildcard !== 0) {
                issues.push(
                    `Line ${netStmt.loc.startLine}: Network statement "${networkIpStr} ${wildcardStr}" uses a broad wildcard. ` +
                    `Best practice: use interface IP with 0.0.0.0 wildcard for precise matching.`
                );
            }

            // Check 2: If using 0.0.0.0 wildcard, the IP should match a configured interface
            if (wildcard === 0 && interfaceIps.size > 0) {
                if (!interfaceIps.has(networkIp)) {
                    issues.push(
                        `Line ${netStmt.loc.startLine}: Network IP "${networkIpStr}" does not match any configured interface IP address.`
                    );
                }
            }

            // Check 3: If using broader wildcard, check if any interface falls within range
            if (wildcard !== 0 && interfaceIps.size > 0) {
                // The wildcard mask is inverted - matching any IP where (IP & ~wildcard) == (networkIp & ~wildcard)
                const invertedWildcard = (~wildcard) >>> 0;
                const networkBase = (networkIp & invertedWildcard) >>> 0;

                let matchesAnyInterface = false;
                for (const ifaceIp of interfaceIps) {
                    if ((ifaceIp & invertedWildcard) >>> 0 === networkBase) {
                        matchesAnyInterface = true;
                        break;
                    }
                }

                if (!matchesAnyInterface) {
                    issues.push(
                        `Line ${netStmt.loc.startLine}: Network "${networkIpStr} ${wildcardStr}" does not match any configured interface subnet.`
                    );
                }
            }
        }

        if (issues.length > 0) {
            return {
                passed: false,
                message: `OSPF network statement issues:\n${issues.join('\n')}`,
                ruleId: 'NET-OSPF-001',
                nodeId: node.id,
                level: 'warning',
                loc: node.loc
            };
        }

        return {
            passed: true,
            message: 'OSPF network statements follow best practices.',
            ruleId: 'NET-OSPF-001',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};
