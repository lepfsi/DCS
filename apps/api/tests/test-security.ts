import assert from 'assert';
import { resolveTransition, transitionsFor, DEFAULT_MATRIX, ACTION_PERM } from '../src/workflow';

// Sécurité documentaire (contrôle d'accès) :
// 1. un auteur n'agit que sur ses propres documents (submit/cancel/revise/generate_final) ;
// 2. les escalades (grants) accordées par le management dépannent l'autorité à la demande.

function ctx(over: any = {}) {
  return {
    role: 'author', userId: 'a1', isOwner: false,
    workflowSteps: ['draft', 'reviewed_by', 'authorized_by', 'sign', 'issued'],
    signatureRoles: ['manager'], hasArtifactOnRevision: false, hasSignature: false,
    existingSignatures: [], permissions: DEFAULT_MATRIX.author,
    ...over,
  } as any;
}

function main() {
  // Garde propriétaire : un auteur ne peut pas annuler le brouillon d'un autre.
  assert.throws(() => resolveTransition('draft', 'cancel', ctx({ isOwner: false })), /responsable du document/);
  assert.throws(() => resolveTransition('draft', 'submit', ctx({ isOwner: false })), /responsable du document/);
  assert.throws(() => resolveTransition('changes_requested', 'revise', ctx({ isOwner: false })), /responsable du document/);
  assert.throws(() => resolveTransition('approved', 'generate_final', ctx({ isOwner: false, hasArtifactOnRevision: true })), /responsable du document/);
  // Le propriétaire, lui, agit normalement.
  assert.deepStrictEqual(resolveTransition('draft', 'submit', ctx({ isOwner: true })), { to: 'in_review' });
  // Et un gestionnaire/admin garde la supervision sans être propriétaire.
  assert.deepStrictEqual(resolveTransition('draft', 'cancel', ctx({ role: 'doc_manager', permissions: DEFAULT_MATRIX.doc_manager, reason: 'doublon' })), { to: 'cancelled' });

  // Escalades (top management) : un auteur doté d'un grant 'approve' peut approuver CE document.
  // SoD conservée : l'escalade vise quelqu'un d'autre que le préparateur (isOwner: false).
  assert.throws(() => resolveTransition('in_review', 'approve', ctx({ isOwner: false })), /non autorisé/, 'sans grant, un auteur n\'approuve pas');
  assert.deepStrictEqual(
    resolveTransition('in_review', 'approve', ctx({ isOwner: false, grantedPermissions: ['approve'] })),
    { to: 'approved' },
    'avec grant approve, l\'auteur escaladé approuve',
  );
  // Le grant est ponctuel : il ne débloque pas le refus (permission approve requise des deux côtés).
  assert.throws(() => resolveTransition('in_review', 'reject', ctx({ isOwner: false, grantedPermissions: ['review'] })), /non autorisé/);
  // Un grant 'sign' ne permet pas d'approuver.
  assert.throws(() => resolveTransition('in_review', 'approve', ctx({ isOwner: false, grantedPermissions: ['sign'] })), /non autorisé/);
  // Un grant 'sign' permet de signer (état ready_to_sign, rôle paramètre valide).
  assert.deepStrictEqual(
    resolveTransition('ready_to_sign', 'sign', ctx({ isOwner: false, grantedPermissions: ['sign'], roleParam: 'manager', hasArtifactOnRevision: true })),
    { to: 'signed' },
  );

  // Cohérence : chaque action a une permission mappée.
  assert.strictEqual(ACTION_PERM.sign, 'sign');
  assert.strictEqual(ACTION_PERM.issue, 'issue');
  assert.strictEqual(ACTION_PERM.request_changes, 'review');

  // Rôles combinés (PDG = approbateur + signataire) : les autorités se cumulent.
  assert.ok(transitionsFor('ready_to_sign', ['approver', 'signer']).some((t) => t.action === 'sign'), 'un cumul approbateur+signataire signe');
  assert.ok(!transitionsFor('ready_to_sign', ['viewer']).some((t) => t.action === 'sign'), 'un lecteur ne signe pas');
  assert.deepStrictEqual(
    resolveTransition('ready_to_sign', 'sign', ctx({ role: 'approver', roles: ['approver', 'signer'], permissions: DEFAULT_MATRIX.approver, roleParam: 'manager', hasArtifactOnRevision: true })),
    { to: 'signed' },
    'le PDG approbateur+signataire signe (contexte à rôles effectifs)',
  );
  // Signature requise par type : l'émission est bloquée tant que le document n'est pas signé.
  assert.throws(
    () => resolveTransition('approved', 'issue', ctx({ role: 'doc_manager', permissions: DEFAULT_MATRIX.doc_manager, signatureRequired: true })),
    /émission impossible : signature/,
  );
  assert.deepStrictEqual(
    resolveTransition('signed', 'issue', ctx({ role: 'doc_manager', permissions: DEFAULT_MATRIX.doc_manager, signatureRequired: true })),
    { to: 'issued' },
    'signé, l\'émission passe',
  );

  console.log('test-security OK (garde propriétaire, escalades, rôles combinés, signature requise)');
}
main();
