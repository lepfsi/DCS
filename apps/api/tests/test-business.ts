import assert from 'assert';
import { computeTotals, checkTxTransition, prefillFields } from '../src/business';

function main() {
  // Totaux : remise puis taxe sur le net, arrondi 2 décimales.
  const t = computeTotals(
    [{ label: 'Audit', qty: 1, unitPrice: 750000 }, { label: 'Formation', qty: 2, unitPrice: 250000 }],
    { discount: 10, taxRate: 19.25, currency: 'XAF' },
  );
  assert.strictEqual(t.subtotal, 1250000);
  assert.strictEqual(t.discountAmount, 125000);
  assert.strictEqual(t.taxable, 1125000);
  assert.strictEqual(t.taxAmount, 216562.5);
  assert.strictEqual(t.total, 1341562.5);
  assert.strictEqual(t.currency, 'XAF');
  const zero = computeTotals([], {});
  assert.strictEqual(zero.total, 0);
  // Transactions : graphe de statuts documentaire (pas de retour en arrière).
  checkTxTransition('draft', 'pending');
  checkTxTransition('pending', 'paid');
  assert.throws(() => checkTxTransition('paid', 'pending'), /impossible/);
  assert.throws(() => checkTxTransition('draft', 'paid'), /impossible/);
  // Pré-remplissage : client, projet, lignes valorisées, conditions.
  const f = prefillFields({
    customer: { id: 'c', name: 'Acme', address: 'Douala', createdAt: '' },
    project: { id: 'p', title: 'Refonte SI', code: 'PRJ-001', createdAt: '' } as any,
    services: [{ id: 's', name: 'Audit', unitPrice: 750000, currency: 'XAF', createdAt: '' }],
  });
  assert.strictEqual(f.client, 'Acme');
  assert.strictEqual(f.project_title, 'Refonte SI');
  assert.strictEqual(f.fees, 750000);
  assert.ok(Array.isArray(f.items) && f.items.length === 1);
  assert.ok(f.payment_terms && f.validity);
  const empty = prefillFields({});
  assert.ok(empty.payment_terms && empty.validity && !empty.client);
  console.log('test-business OK (totaux, statuts, prefill)');
}
main();
