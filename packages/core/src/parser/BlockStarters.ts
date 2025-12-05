// packages/core/src/parser/BlockStarters.ts

/**
 * Defines regular expressions for keywords that start new configuration blocks.
 * These are used by the permissive parser to identify hierarchical structures.
 *
 * Order matters: more specific patterns should come before generic ones.
 */
export const BlockStarters: RegExp[] = [
    // Interface blocks
    /^interface\s+\S+/i,                    // e.g., "interface GigabitEthernet1"

    // Routing protocol blocks
    /^router\s+(?!router-id)\S+/i,          // e.g., "router bgp 65000", "router ospf 1"
    /^address-family\s+\S+/i,               // e.g., "address-family ipv4 unicast"
    /^af-interface\s+\S+/i,                 // EIGRP named mode
    /^topology\s+\S+/i,                     // EIGRP topology

    // VLAN and L2
    /^vlan\s+\d+/i,                         // e.g., "vlan 10"
    /^spanning-tree\s+\S+/i,                // Spanning tree config

    // ACL and Security
    /^ip\s+access-list\s+\S+/i,             // e.g., "ip access-list extended MYACL"
    /^access-list\s+\S+/i,                  // e.g., "access-list 100 permit..."
    /^ip\s+prefix-list\s+\S+/i,             // e.g., "ip prefix-list PL1 seq 10..."
    /^route-map\s+\S+/i,                    // e.g., "route-map RM1 permit 10"
    /^crypto\s+map\s+\S+/i,                 // e.g., "crypto map MYMAP 10"
    /^crypto\s+isakmp\s+\S+/i,              // ISAKMP policies
    /^crypto\s+ipsec\s+\S+/i,               // IPsec config

    // QoS
    /^class-map\s+\S+/i,                    // e.g., "class-map match-any VOICE"
    /^policy-map\s+\S+/i,                   // e.g., "policy-map QOS-POLICY"

    // Line and management
    /^line\s+(vty|console|aux)\s+\S+/i,     // e.g., "line vty 0 4"
    /^line\s+\d+/i,                         // e.g., "line 0" (async lines)

    // Object groups (ASA/IOS)
    /^object-group\s+\S+/i,                 // e.g., "object-group network SERVERS"
    /^object\s+\S+/i,                       // ASA objects

    // AAA
    /^aaa\s+group\s+server\s+\S+/i,         // e.g., "aaa group server tacacs+ TAC_GROUP"

    // Voice
    /^dial-peer\s+voice\s+\S+/i,            // e.g., "dial-peer voice 100 pots"
    /^voice\s+register\s+\S+/i,             // e.g., "voice register pool 1"
    /^telephony-service/i,                  // Telephony service block
    /^ephone-dn\s+\S+/i,                    // SCCP directory numbers
    /^ephone\s+\S+/i,                       // SCCP phones

    // Other common blocks
    /^ip\s+vrf\s+\S+/i,                     // VRF definition
    /^vrf\s+definition\s+\S+/i,             // VRF definition (new syntax)
    /^key\s+chain\s+\S+/i,                  // Key chains
    /^track\s+\d+/i,                        // Object tracking
    /^redundancy/i,                         // Redundancy config
    /^controller\s+\S+/i,                   // Controller config (E1/T1)
    /^archive/i,                            // Archive config
    /^ip\s+sla\s+\d+/i,                     // IP SLA
    /^tacacs\s+server\s+\S+/i,              // TACACS server
    /^radius\s+server\s+\S+/i,              // RADIUS server
    /^snmp-server\s+view\s+\S+/i,           // SNMP views
    /^banner\s+(motd|login|exec)/i,         // Banner blocks
    /^control-plane/i,                      // Control plane config
];
