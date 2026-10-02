import assert from 'assert';
import { effectiveStatus, canViewDoc, defaultConfidentiality } from '../src/business';

function main() {
  // Statut effectif : révocation prioritaire, expiration calculée.
  assert.strictEqual(effectiveStatus({ status: 'revoked', expiresAt: null }), 'revoked');
  assert.strictEqual(effectiveStatus({ status: 'revoked', expiresAt: '2030-01-01' }), 'revoked');
  assert.strictEqual(effectiveStatus({ status: 'valid', expiresAt: '2020-01-01' }, '2026-10-01T00:00:00.000Z'), 'expired');
  assert.strictEqual(effectiveStatus({ status: 'valid', expiresAt: null }, '2026-10-01T00:00:00.000Z'), 'valid');
  assert.strictEqual(effectiveStatus({ status: 'valid', expiresAt: '2030-01-01' }, '2026-10-01T00:00:00.000Z'), 'valid');
  // Confidentialité : restricted visible par owner, admin, doc_manager uniquement.
  const restricted = { ownerId: 'u1', confidentiality: 'restricted' };
  assert.strictEqual(canViewDoc(restricted, { id: 'u1', role: 'author' }), true);
  assert.strictEqual(canViewDoc(restricted, { id: 'x', role: 'admin' }), true);
  assert.strictEqual(canViewDoc(restricted, { id: 'x', role: 'doc_manager' }), true);
  assert.strictEqual(canViewDoc(restricted, { id: 'x', role: 'reviewer' }), false);
  assert.strictEqual(canViewDoc({ ownerId: 'u1', confidentiality: 'internal' }, { id: 'x', role: 'viewer' }), true);
  assert.strictEqual(canViewDoc({ ownerId: 'u1' }, { id: 'x', role: 'viewer' }), true);
  // Défauts par famille.
  assert.strictEqual(defaultConfidentiality('HR'), 'confidential');
  assert.strictEqual(defaultConfidentiality('BUSINESS'), 'internal');
  assert.strictEqual(defaultConfidentiality('HR', 'restricted'), 'restricted');
  console.log('test-domain OK (certificats, confidentialité)');
}
main();
