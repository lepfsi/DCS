import assert from 'assert';
import { transitionsFor, resolveTransition, TransitionCtx, DEFAULT_MATRIX } from '../src/workflow';

const STRICT = ['prepared_by', 'reviewed_by', 'authorized_by', 'sign', 'issue'];
const SIMPLE = ['prepared_by', 'approved_by', 'issue'];
function ctx(over: Partial<TransitionCtx> = {}): TransitionCtx {
  const role = over.role ?? 'author';
  return { role, userId: 'u1', isOwner: true, workflowSteps: SIMPLE, signatureRoles: ['prepared_by', 'approved_by'], hasArtifactOnRevision: false, hasSignature: false, existingSignatures: [], permissions: DEFAULT_MATRIX[role] ?? [], ...over };
}

function main() {
  // Happy path nominal : draft → in_review → approved → ready_to_sign → signed → issued → archived
  let r = resolveTransition('draft', 'submit', ctx());
  assert.strictEqual(r.to, 'in_review');
  // Rôle refusé
  assert.throws(() => resolveTransition('draft', 'submit', ctx({ role: 'viewer', isOwner: false })), /non autorisé/);
  // Motif obligatoire
  assert.throws(() => resolveTransition('in_review', 'request_changes', ctx({ role: 'reviewer', isOwner: false })), /motif obligatoire/);
  r = resolveTransition('in_review', 'request_changes', ctx({ role: 'reviewer', isOwner: false, reason: 'prix flou' }));
  assert.strictEqual(r.to, 'changes_requested');
  // Saut d'étape impossible
  assert.throws(() => resolveTransition('draft', 'approve', ctx({ role: 'approver', isOwner: false })), /impossible/);
  // SoD : owner bloqué sur approve/issue en strict, autorisé en simple
  assert.throws(() => resolveTransition('in_review', 'approve', ctx({ role: 'approver', workflowSteps: STRICT })), /séparation des devoirs/);
  r = resolveTransition('in_review', 'approve', ctx({ role: 'approver', workflowSteps: SIMPLE }));
  assert.strictEqual(r.to, 'approved');
  // generate_final exige un artefact
  assert.throws(() => resolveTransition('approved', 'generate_final', ctx({ role: 'author' })), /artefact PDF requis/);
  r = resolveTransition('approved', 'generate_final', ctx({ role: 'author', hasArtifactOnRevision: true }));
  assert.strictEqual(r.to, 'ready_to_sign');
  // sign : rôle invalide / rejoué / ok
  assert.throws(() => resolveTransition('ready_to_sign', 'sign', ctx({ role: 'signer', isOwner: false, roleParam: 'nope' })), /rôle de signature invalide/);
  assert.throws(() => resolveTransition('ready_to_sign', 'sign', ctx({ role: 'signer', isOwner: false, roleParam: 'prepared_by', existingSignatures: ['prepared_by'] })), /déjà signé/);
  r = resolveTransition('ready_to_sign', 'sign', ctx({ role: 'signer', isOwner: false, roleParam: 'prepared_by' }));
  assert.strictEqual(r.to, 'signed');
  // issue : workflow avec sign exige l'état signed
  assert.throws(() => resolveTransition('approved', 'issue', ctx({ role: 'doc_manager', isOwner: false, workflowSteps: STRICT })), /signature requise/);
  r = resolveTransition('approved', 'issue', ctx({ role: 'doc_manager', isOwner: false, workflowSteps: SIMPLE }));
  assert.strictEqual(r.to, 'issued');
  // Workflow sans étape signature : émission possible après génération finale.
  r = resolveTransition('ready_to_sign', 'issue', ctx({ role: 'doc_manager', isOwner: false, workflowSteps: SIMPLE }));
  assert.strictEqual(r.to, 'issued');
  // revoke exige un motif ; transitions filtrées par rôle
  assert.throws(() => resolveTransition('issued', 'revoke', ctx({ role: 'doc_manager', isOwner: false })), /motif obligatoire/);
  assert.ok(transitionsFor('draft', 'viewer').length === 0);
  assert.ok(transitionsFor('in_review', 'reviewer').some((t) => t.action === 'request_changes' && t.requiresReason));
  // Matrice resserrée : sans la permission, même un rôle du workflow est bloqué.
  assert.throws(() => resolveTransition('in_review', 'approve', ctx({ role: 'reviewer', isOwner: false, workflowSteps: SIMPLE, permissions: ['view', 'review'] })), /permission 'approve' requise/);
  // Admin : passe la garde d'autorité (la SoD le bloque encore sauf bypass existant).
  r = resolveTransition('in_review', 'approve', ctx({ role: 'admin', isOwner: true, workflowSteps: STRICT, permissions: [] }));
  assert.strictEqual(r.to, 'approved');
  console.log('test-workflow OK (cycle nominal, gardes, SoD, motifs)');
}
main();
