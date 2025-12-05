import { IRule, ConfigNode, RuleResult } from '@gecko/core';

/**
 * Rule: Ensure IP addresses configured on interfaces are not Multicast or Broadcast addresses.
 * - Multicast Range: 224.0.0.0 to 239.255.255.255 (Class D)
 * - Broadcast: 255.255.255.255
 */
export const NoMulticastBroadcastIp: IRule = {
    id: 'NET-IP-001',
    selector: 'ip address',
    metadata: {
        level: 'error',
        obu: 'Network Engineering',
        owner: 'NetOps',
        remediation: 'Configure a valid unicast IP address (Class A, B, or C).'
    },
    check: (node: ConfigNode): RuleResult => {
        // Standard format: "ip address <IP> <MASK>" or "ip address <IP> <MASK> secondary"
        // params[0] = "ip"
        // params[1] = "address"
        // params[2] = <IP>
        
        const ip = node.params[2];

        if (!ip) {
            // If parsing failed or syntax is incomplete, this rule might not apply, 
            // or it's a syntax error. We'll skip validation here.
            return {
                passed: true,
                message: 'Incomplete ip address command ignored.',
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'info',
                loc: node.loc
            };
        }

        // Basic IPv4 validation regex (simplified for logic, production might need stricter)
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(ipv4Regex);

        if (!match) {
             return {
                passed: false,
                message: `Invalid IP address format: ${ip}`,
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'error',
                loc: node.loc
            };
        }

        const firstOctet = parseInt(match[1], 10);

        // Check Multicast (224 - 239)
        if (firstOctet >= 224 && firstOctet <= 239) {
            return {
                passed: false,
                message: `Invalid assignment: ${ip} is a Multicast address.`,
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'error',
                loc: node.loc
            };
        }

        // Check Broadcast (255.255.255.255)
        if (ip === '255.255.255.255') {
            return {
                passed: false,
                message: `Invalid assignment: ${ip} is a Broadcast address.`,
                ruleId: 'NET-IP-001',
                nodeId: node.id,
                level: 'error',
                loc: node.loc
            };
        }
        
        // Also check 0.0.0.0? (Usually invalid for assignment unless special cases)
        // For this specific requirement, we focus on Multicast/Broadcast.

        return {
            passed: true,
            message: `IP address ${ip} is valid.`,
            ruleId: 'NET-IP-001',
            nodeId: node.id,
            level: 'info',
            loc: node.loc
        };
    }
};
