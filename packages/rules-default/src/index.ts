import { IRule } from '@gecko/core';
import { NoMulticastBroadcastIp, InterfaceDescriptionRequired, NoPlaintextPasswords, SSHVersion2Required, VTYAccessClassRequired } from './network-rules';

export * from './network-rules';

/** All default rules bundled together */
export const allRules: IRule[] = [
    NoMulticastBroadcastIp,
    InterfaceDescriptionRequired,
    NoPlaintextPasswords,
    SSHVersion2Required,
    VTYAccessClassRequired,
];
