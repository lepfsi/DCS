import assert from 'assert';
import { buildSchema, diffSnapshots, validateLink } from '../src/builder';

function main() {
  // Schéma depuis definition.fields
  const s = buildSchema('DO-OFF-LETTER', '1.0', { blocks: ['header'], required: ['a'], fields: [{ key: 'a', label: 'A', type: 'text', required: true }] });
  assert.deepStrictEqual(s.required, ['a']);
  // Fallback sans fields
  const f = buildSchema('X', '1.0', { required: ['k'] }, ['k', 'extra']);
  assert.strictEqual(f.fields.length, 2);
  assert.strictEqual(f.fields.find((x) => x.key === 'extra')!.required, false);
  // Diff
  const d = diffSnapshots(0, { a: 1, b: 'x', c: [1] }, 1, { a: 2, b: 'x', d: true });
  assert.deepStrictEqual(d.added, ['d']);
  assert.deepStrictEqual(d.removed, ['c']);
  assert.deepStrictEqual(d.changed, ['a']);
  // Liens : refus self + type invalide + doc inconnu, accept valide
  const exists = (id: string) => ['A', 'B'].includes(id);
  assert.throws(() => validateLink('A', 'A', 'relates_to', exists), /self_link/);
  assert.throws(() => validateLink('A', 'B', 'nope', exists), /invalid_link_type/);
  assert.throws(() => validateLink('A', 'Z', 'relates_to', exists), /unknown_document/);
  validateLink('A', 'B', 'invoices', exists);
  console.log('test-builder OK (schema, diff, liens)');
}
main();
