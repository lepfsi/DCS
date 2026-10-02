import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { documentCreateSchema, templateDefinitionSchema, titleField } from '../src/validation';
import { db, save, repoRoot } from '../src/store';
import { seedAll } from '../src/seed';

async function main() {
  // Titre requis : vide ou absent refuse.
  assert.throws(() => documentCreateSchema.parse({ type_code: 'X', title: '' }), /title/);
  assert.throws(() => documentCreateSchema.parse({ type_code: 'X' }), /title/);
  assert.strictEqual(titleField.parse('Lettre').length > 0, true);
  const ok = documentCreateSchema.parse({ type_code: 'X', title: 'T', fields: {} });
  assert.strictEqual(ok.title, 'T');
  // Définition template : champs typés, type inconnu refuse.
  const def = templateDefinitionSchema.parse({ blocks: [], required: ['a'], fields: [{ key: 'a', label: 'A', type: 'text', required: true }] });
  assert.strictEqual(def.required[0], 'a');
  assert.throws(() => templateDefinitionSchema.parse({ fields: [{ key: 'a', label: 'A', type: 'nope', required: true }] }), /type/);
  // Seed idempotent : chaque type du catalogue a un template, sans doublon au second passage.
  await seedAll();
  const n1 = db.templates.length;
  const cat = JSON.parse(fs.readFileSync(path.join(repoRoot(), 'templates', 'catalogue.json'), 'utf-8'));
  for (const t of cat.types) {
    assert.ok(db.templates.some((x) => x.type_code === t.type_code), `template manquant pour ${t.type_code}`);
  }
  await seedAll();
  assert.strictEqual(db.templates.length, n1, 'seed idempotent');
  await save();
  console.log(`test-admin OK (validation, seed couvre ${cat.types.length} types)`);
}
main();
