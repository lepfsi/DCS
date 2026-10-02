import assert from 'assert';
import { GENESIS, eventChainHash } from '../src/chain';
import { verifyChain, logEvent } from '../src/audit';
import { db, save } from '../src/store';

async function main() {
  // Chaine : chaque maillon dépend du précédent, ordre sensible.
  const h1 = eventChainHash(GENESIS, { a: 1 });
  const h2 = eventChainHash(h1, { a: 2 });
  assert.notStrictEqual(h1, h2);
  assert.strictEqual(eventChainHash(h1, { a: 2 }), h2, 'déterministe');
  assert.notStrictEqual(eventChainHash(h1, { a: 3 }), h2, 'contenu sensible');
  // Bout en bout sur un document jetable : chaine valide puis falsification détectée.
  const docId = 'test-evidence-doc';
  db.documents.push({ id: docId, reference: 'TEST', type_code: 'DO-OFF-LETTER', family: 'OFFICIAL', templateVersionId: 't', title: 't', state: 'draft', ownerId: 'u', fields: {}, currentRevision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
  await logEvent({ documentId: docId, actorId: 'u', actorRole: 'author', eventType: 'created' });
  await logEvent({ documentId: docId, actorId: 'u', actorRole: 'author', eventType: 'draft_saved' });
  assert.strictEqual(verifyChain(docId).ok, true);
  assert.strictEqual(verifyChain(docId).count, 2);
  const tampered = db.auditEvents.find((e) => e.documentId === docId);
  assert.ok(tampered, 'événement test présent');
  (tampered as any).eventType = 'issued';
  const v = verifyChain(docId);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.brokenAt, tampered.id);
  // Nettoyage : retire le document jetable et ses événements.
  db.documents.splice(db.documents.findIndex((d) => d.id === docId), 1);
  for (let i = db.auditEvents.length - 1; i >= 0; i--) {
    if (db.auditEvents[i].documentId === docId) db.auditEvents.splice(i, 1);
  }
  await save();
  console.log('test-evidence OK (chaine, falsification détectée)');
}
main();
