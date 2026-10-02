import assert from 'assert';
import { isOverdue, priorityOf, isExpiring } from '../src/workflow';

function main() {
  const NOW = '2026-10-01T00:00:00.000Z';
  assert.strictEqual(isOverdue('2020-01-01T00:00:00.000Z', 'in_review', '2026-10-01T00:00:00.000Z'), true);
  // Pas d'échéance, état terminal, échéance future → pas de retard
  assert.strictEqual(isOverdue(undefined, 'in_review', '2026-10-01T00:00:00.000Z'), false);
  assert.strictEqual(isOverdue('2020-01-01T00:00:00.000Z', 'issued', '2026-10-01T00:00:00.000Z'), false);
  assert.strictEqual(isOverdue('2030-01-01T00:00:00.000Z', 'draft', '2026-10-01T00:00:00.000Z'), false);
  // Priorités
  assert.strictEqual(priorityOf({ overdue: true, state: 'draft' }), 'overdue');
  assert.strictEqual(priorityOf({ overdue: false, state: 'changes_requested' }), 'high');
  assert.strictEqual(priorityOf({ overdue: false, state: 'in_review' }), 'high');
  assert.strictEqual(priorityOf({ overdue: false, state: 'draft' }), 'normal');
  // Échéance proche : entre aujourd'hui et +7j, état actif, pas en retard.
  assert.strictEqual(isExpiring('2026-10-05T00:00:00.000Z', 'in_review', NOW), true);
  assert.strictEqual(isExpiring('2026-10-01T00:00:00.000Z', 'in_review', NOW), true);
  assert.strictEqual(isExpiring('2020-01-01T00:00:00.000Z', 'in_review', NOW), false);
  assert.strictEqual(isExpiring('2026-12-01T00:00:00.000Z', 'in_review', NOW), false);
  assert.strictEqual(isExpiring('2026-10-05T00:00:00.000Z', 'issued', NOW), false);
  assert.strictEqual(isExpiring(undefined, 'in_review', NOW), false);
  console.log('test-inbox OK (échéances, priorités)');
}
main();
