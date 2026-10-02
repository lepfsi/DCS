import { db, save, withLock } from './store';

export const FAMILY_CODES: Record<string, string> = {
  OFFICIAL: 'OFF', BUSINESS: 'BIZ', LEGAL: 'LEG', CERTIFICATE: 'CER',
  HR: 'HR', FINANCE: 'FIN',
};

// Allocation transactionnelle : DO-[CODE]-[YEAR]-[SEQ4]. Anti-collision via mutex (P1 file-based).
// Prod Postgres : BEGIN; SELECT last_seq FROM numbering_sequences WHERE family=$1 AND year=$2 FOR UPDATE; UPDATE...
export async function allocateReference(family: string, year?: number): Promise<string> {
  return withLock(async () => {
    const y = year ?? new Date().getFullYear();
    const code = FAMILY_CODES[family] ?? family.slice(0, 3).toUpperCase();
    const key = `${family}-${y}`;
    const next = (db.sequences[key] ?? 0) + 1;
    db.sequences[key] = next;
    await save();
    return `DO-${code}-${y}-${String(next).padStart(4, '0')}`;
  });
}
