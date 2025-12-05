// packages/core/src/parser/BlockStarters.ts

/**
 * Defines regular expressions for keywords that start new configuration blocks.
 * These are used by the permissive parser to identify hierarchical structures.
 */
export const BlockStarters: RegExp[] = [
    /^interface\s+\S+/i,        // e.g., "interface GigabitEthernet1"
    /^router\s+(?!router-id)\S+/i, // e.g., "router bgp 65000", "router ospf 1". Negative lookahead avoids matching "router-id" if typed with space erronously, though "router-id" usually has no space.
    /^vlan\s+\d+/i,             // e.g., "vlan 10"
    /^access-list\s+\S+/i,      // e.g., "access-list 100 permit ip any any"
    /^line\s+(vty|console|aux)\s+\S+/i, // e.g., "line vty 0 4", "line console 0", "line aux 0"
    /^address-family\s+\S+/i,   // e.g., "address-family ipv4"
];

// Add any other common block starting keywords here.
