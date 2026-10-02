import assert from 'assert';
import { needsReminder, needsEscalation, autoArchiveDue, webhookPayload } from '../src/automation';

const NOW = '2026-10-01T00:00:00.000Z';

function main() {
  // Rappels : actif + en retard + pas rappelé depuis 24h. Jamais de changement d'état ici.
  assert.strictEqual(needsReminder({ state: 'in_review', dueAt: '2020-01-01T00:00:00.000Z' }, NOW), true);
  assert.strictEqual(needsReminder({ state: 'issued', dueAt: '2020-01-01T00:00:00.000Z' }, NOW), false);
  assert.strictEqual(needsReminder({ state: 'in_review', dueAt: '2030-01-01T00:00:00.000Z' }, NOW), false);
  assert.strictEqual(needsReminder({ state: 'in_review', dueAt: '2020-01-01T00:00:00.000Z', lastReminderAt: '2026-09-30T12:00:00.000Z' }, NOW), false);
  assert.strictEqual(needsReminder({ state: 'in_review', dueAt: '2020-01-01T00:00:00.000Z', lastReminderAt: '2026-09-20T00:00:00.000Z' }, NOW), true);
  // Escalade : plus de 3 jours de retard sur états de décision.
  assert.strictEqual(needsEscalation({ state: 'in_review', dueAt: '2026-09-20T00:00:00.000Z' }, NOW), true);
  assert.strictEqual(needsEscalation({ state: 'in_review', dueAt: '2026-09-30T00:00:00.000Z' }, NOW), false);
  assert.strictEqual(needsEscalation({ state: 'draft', dueAt: '2026-09-20T00:00:00.000Z' }, NOW), false);
  // Archivage auto : politique désactivée par défaut, sinon émis ancien.
  assert.strictEqual(autoArchiveDue({ state: 'issued', updatedAt: '2020-01-01T00:00:00.000Z' }, 0, NOW), false);
  assert.strictEqual(autoArchiveDue({ state: 'issued', updatedAt: '2020-01-01T00:00:00.000Z' }, 30, NOW), true);
  assert.strictEqual(autoArchiveDue({ state: 'in_review', updatedAt: '2020-01-01T00:00:00.000Z' }, 30, NOW), false);
  assert.strictEqual(autoArchiveDue({ state: 'issued', updatedAt: NOW }, 30, NOW), false);
  // Payload webhook : champs stables, horodaté.
  const p: any = webhookPayload('issued', { id: 'd', reference: 'DO-OFF-2026-0001', type_code: 'DO-OFF-LETTER', state: 'issued' });
  assert.strictEqual(p.event, 'issued');
  assert.strictEqual(p.reference, 'DO-OFF-2026-0001');
  assert.ok(p.at);
  console.log('test-automation OK (rappels, escalade, archivage, webhooks)');
}
main();
