import { createHash } from 'crypto';

// Primitive d'intégrité partagée (audit + migration store). Aucune dépendance locale.
export const GENESIS = 'DCS-GENESIS';

export function eventChainHash(prev: string, e: object): string {
  return createHash('sha256').update(prev + '|' + JSON.stringify(e)).digest('hex');
}
