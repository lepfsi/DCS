import assert from 'assert';
import { db } from '../src/store';
import { allocateReference } from '../src/numbering';

// Test anti-collision : N allocations concurrentes => références uniques et séquentielles.
async function main() {
  db.sequences['OFFICIAL-2026'] = 0;
  const N = 20;
  const refs = await Promise.all(Array.from({ length: N }, () => allocateReference('OFFICIAL', 2026)));
  assert.strictEqual(new Set(refs).size, N, 'collision détectée');
  const seqs = refs.map((r) => Number(r.split('-').pop())).sort((a, b) => a - b);
  assert.deepStrictEqual(seqs, Array.from({ length: N }, (_, i) => i + 1));
  console.log(`test-numbering OK (${N} refs uniques, ex. ${refs[0]})`);
}
main();
