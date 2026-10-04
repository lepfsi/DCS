import assert from 'assert';
import { inDepartmentScope, canViewDoc } from '../src/business';

// Périmètre département → domaines (DCS §14-15, wireframes §31) :
// absent/vide = non restreint ; présent = liste blanche de familles.
function main() {
  const scopes: Record<string, string[]> = { RH: ['HR'], Finance: ['FINANCE'], Opérations: [] };

  // Sans configuration ou département absent : rien ne change.
  assert.strictEqual(inDepartmentScope('Finance', 'HR', {}), true, 'scope vide = non restreint');
  assert.strictEqual(inDepartmentScope('Juridique', 'FINANCE', scopes), true, 'département non listé = non restreint');
  assert.strictEqual(inDepartmentScope('Opérations', 'LEGAL', scopes), true, 'liste vide = non restreint');
  assert.strictEqual(inDepartmentScope(undefined, 'HR', scopes), true, 'sans département = non restreint');

  // Restriction : seule la famille autorisée passe.
  assert.strictEqual(inDepartmentScope('RH', 'HR', scopes), true, 'RH voit le domaine HR');
  assert.strictEqual(inDepartmentScope('RH', 'FINANCE', scopes), false, 'RH ne voit pas Finance');
  assert.strictEqual(inDepartmentScope('Finance', 'FINANCE', scopes), true, 'Finance voit Finance');
  assert.strictEqual(inDepartmentScope('Finance', 'HR', scopes), false, 'Finance ne voit pas HR');
  assert.strictEqual(inDepartmentScope('Finance', 'finance', scopes), false, 'la casse compte (familles en MAJUSCULES)');

  // Combinaison avec la confidentialité existante (restricted reste prioritaire, règle additive).
  const restrictedDoc = { ownerId: 'owner-1', confidentiality: 'restricted' };
  const outsider = { id: 'someone-else', role: 'reviewer' };
  assert.strictEqual(canViewDoc(restrictedDoc, outsider), false, 'restricted invisible hors owner/admin/doc_manager');
  assert.strictEqual(canViewDoc(restrictedDoc, { id: 'someone-else', role: 'admin' }), true, 'admin voit un restricted');

  console.log('test-scope OK (périmètre département : absent/vide = libre, liste = restreint)');
}
main();
