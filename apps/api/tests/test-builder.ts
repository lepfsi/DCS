import assert from 'assert';
import { buildSchema, diffSnapshots, validateLink } from '../src/builder';
import { templateDefinitionSchema } from '../src/validation';

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
  // Champs intelligents (§5, §12-13) : niveau 2 accepté et transmis par le schéma de définition.
  const def = templateDefinitionSchema.parse({
    blocks: [], required: ['montant'],
    fields: [
      { key: 'montant', label: 'Montant HT', type: 'currency', required: true, help: 'Hors taxes, en XAF', min: 0 },
      { key: 'client_nom', label: 'Client', type: 'client', required: true, dataSource: 'customers', defaultValue: '' },
      { key: 'tva', label: 'TVA', type: 'computed', required: false, formula: '{montant} * 0.1925', visibleIf: { field: 'montant', equals: 'x' } },
      { key: 'canaux', label: 'Canaux', type: 'list', required: false, options: ['Email', 'Courrier'] },
    ],
  });
  assert.strictEqual(def.fields[2].formula, '{montant} * 0.1925');
  assert.deepStrictEqual(def.fields[2].visibleIf, { field: 'montant', equals: 'x' });
  assert.deepStrictEqual(def.fields[3].options, ['Email', 'Courrier']);
  assert.strictEqual(def.fields[0].min, 0);
  // buildSchema transmet les attributs niveau 2 tels quels.
  const s2 = buildSchema('DO-BIZ-PROPOSAL', '1.0', def as any);
  assert.strictEqual(s2.fields.find((f) => f.key === 'tva')!.type, 'computed');
  console.log('test-builder OK (schema, diff, liens, champs intelligents)');
}
main();
