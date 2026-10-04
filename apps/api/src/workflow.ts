// Moteur workflow P3 (DCS §6, §13-14) - pur, testable sans DB.
// Pas de lifecycle unique : chaque type suit sa workflow_key ; la machine ci-dessous
// est le socle commun, les gardes (signature, SoD) dépendent des steps du workflow.

export interface TransitionDef {
  action: string; from: string[]; to: string;
  roles: string[]; requiresReason?: boolean; needsRoleParam?: boolean;
  requiresArtifact?: boolean;
}

export const TRANSITIONS: TransitionDef[] = [
  { action: 'submit', from: ['draft'], to: 'in_review', roles: ['author', 'doc_manager', 'admin'] },
  { action: 'request_changes', from: ['in_review'], to: 'changes_requested', roles: ['reviewer', 'approver', 'doc_manager', 'admin'], requiresReason: true },
  { action: 'revise', from: ['changes_requested'], to: 'draft', roles: ['author', 'doc_manager', 'admin'] },
  { action: 'approve', from: ['in_review'], to: 'approved', roles: ['reviewer', 'approver', 'admin'] },
  { action: 'reject', from: ['in_review'], to: 'rejected', roles: ['approver', 'admin'], requiresReason: true },
  { action: 'generate_final', from: ['approved'], to: 'ready_to_sign', roles: ['author', 'doc_manager', 'admin'], requiresArtifact: true },
  { action: 'sign', from: ['ready_to_sign', 'signed'], to: 'signed', roles: ['signer', 'approver', 'doc_manager', 'admin'], needsRoleParam: true },
  { action: 'issue', from: ['signed', 'approved', 'ready_to_sign'], to: 'issued', roles: ['doc_manager', 'approver', 'admin'] },
  { action: 'cancel', from: ['draft', 'in_review', 'changes_requested'], to: 'cancelled', roles: ['author', 'doc_manager', 'admin'], requiresReason: true },
  { action: 'expire', from: ['issued'], to: 'expired', roles: ['doc_manager', 'admin'] },
  { action: 'revoke', from: ['issued'], to: 'revoked', roles: ['doc_manager', 'admin'], requiresReason: true },
  { action: 'supersede', from: ['issued'], to: 'superseded', roles: ['doc_manager', 'admin'], requiresReason: true },
  { action: 'archive', from: ['issued'], to: 'archived', roles: ['doc_manager', 'admin'] },
];

export interface TransitionCtx {
  role: string; // rôle principal (messages)
  roles?: string[]; // rôles effectifs cumulés (défaut : [role])
  userId: string; isOwner: boolean;
  reason?: string; roleParam?: string;
  workflowSteps: string[]; signatureRoles: string[];
  hasArtifactOnRevision: boolean; hasSignature: boolean;
  existingSignatures: string[]; // rôles déjà signés sur la révision courante
  permissions: string[]; // autorités cumulées des rôles (matrice éditable)
  grantedPermissions?: string[]; // escalades ponctuelles (top management) sur CE document
  signatureRequired?: boolean; // ce type exige une signature avant émission
}

// Matrice d'autorité par défaut : qui peut quoi, tous workflows confondus.
// Le workflow (TRANSITIONS + workflow_key par type) dit QUELLES étapes existent ;
// la matrice dit QUI a l'autorité d'agir. Les deux doivent passer (ET logique).
// Resserrer = retirer une permission (ex. approve au reviewer pour séparer revue et approbation).
export const DEFAULT_MATRIX: Record<string, string[]> = {
  admin: ['view', 'edit', 'review', 'approve', 'sign', 'issue', 'admin'],
  doc_manager: ['view', 'edit', 'review', 'sign', 'issue'],
  author: ['view', 'edit'],
  reviewer: ['view', 'review', 'approve'],
  approver: ['view', 'review', 'approve', 'sign', 'issue'],
  signer: ['view', 'sign'],
  viewer: ['view'],
};

export const ACTION_PERM: Record<string, string> = {
  submit: 'edit', request_changes: 'review', revise: 'edit', approve: 'approve', reject: 'approve',
  generate_final: 'edit', sign: 'sign', issue: 'issue', cancel: 'edit', expire: 'edit',
  revoke: 'edit', supersede: 'edit', archive: 'edit',
};

export function transitionsFor(state: string, roleOrRoles: string | string[]): TransitionDef[] {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return TRANSITIONS.filter((t) => t.from.includes(state) && (t.roles.some((r) => roles.includes(r)) || roles.includes('admin')));
}

// États actifs : une échéance dépassée y signale un retard (US-4.4).
const ACTIVE_STATES = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed'];

export function isOverdue(dueAt: string | null | undefined, state: string, nowIso: string = new Date().toISOString()): boolean {
  if (!dueAt || !ACTIVE_STATES.includes(state)) return false;
  return dueAt < nowIso;
}

export function priorityOf(args: { overdue: boolean; state: string }): 'overdue' | 'high' | 'normal' {
  if (args.overdue) return 'overdue';
  if (args.state === 'changes_requested' || args.state === 'in_review') return 'high';
  return 'normal';
}

// Échéance proche (file Expiring) : due entre aujourd'hui et +days jours, état actif, non en retard.
export function isExpiring(dueAt: string | null | undefined, state: string, nowIso: string = new Date().toISOString(), days = 7): boolean {
  const ACTIVE = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed'];
  if (!dueAt || !ACTIVE.includes(state)) return false;
  const t = new Date(dueAt).getTime(); const n = new Date(nowIso).getTime();
  return t >= n && t <= n + days * 86400000;
}

// Workflows stricts : le préparateur (owner) ne peut ni approuver ni autoriser la fin.
function isStrict(steps: string[]) {
  return steps.includes('authorized_by') || steps.join(',').includes('reviewed_by,authorized_by');
}

// Garde propriétaire (contrôle d'accès) : un auteur n'agit que sur SES documents.
// doc_manager et admin conservent la supervision.
const AUTHOR_OWNER_ONLY = new Set(['submit', 'revise', 'cancel', 'generate_final']);

export function resolveTransition(state: string, action: string, ctx: TransitionCtx): { to: string } {
  const def = TRANSITIONS.find((t) => t.action === action && t.from.includes(state));
  if (!def) {
    const err: any = new Error(`action '${action}' impossible depuis l'état '${state}'`);
    err.status = 409; throw err;
  }
  const mine = ctx.roles ?? [ctx.role]; // rôles effectifs cumulés
  const isAdmin = mine.includes('admin');
  const granted = ctx.grantedPermissions ?? [];
  if (!def.roles.some((r) => mine.includes(r)) && !isAdmin && !granted.includes(ACTION_PERM[action] ?? '')) {
    const err: any = new Error(`rôle '${ctx.role}' non autorisé pour '${action}'`);
    err.status = 403; throw err;
  }
  const need = ACTION_PERM[action];
  if (need && !isAdmin && !ctx.permissions.includes(need) && !granted.includes(need)) {
    const err: any = new Error(`rôle '${ctx.role}' non autorisé pour '${action}' (permission '${need}' requise)`);
    err.status = 403; throw err;
  }
  if (AUTHOR_OWNER_ONLY.has(action) && ctx.role === 'author' && !ctx.isOwner) {
    const err: any = new Error(`action réservée au responsable du document`);
    err.status = 403; throw err;
  }
  if (def.requiresReason && !(ctx.reason && ctx.reason.trim())) {
    const err: any = new Error(`motif obligatoire pour '${action}'`);
    err.status = 422; throw err;
  }
  if (def.requiresArtifact && !ctx.hasArtifactOnRevision) {
    const err: any = new Error(`artefact PDF requis sur la révision courante avant '${action}' (générez d'abord)`);
    err.status = 422; throw err;
  }
  // Émission : les workflows avec étape signature exigent l'état signed ;
  // les types marqués « signature requise » l'exigent aussi, même sans étape dédiée.
  if (action === 'issue' && (ctx.workflowSteps.includes('sign') || ctx.signatureRequired) && state !== 'signed') {
    const err: any = new Error(ctx.signatureRequired && !ctx.workflowSteps.includes('sign')
      ? `émission impossible : signature électronique requise pour ce type de document`
      : `émission impossible : signature requise (état actuel '${state}')`);
    err.status = 422; throw err;
  }
  // Signature : rôle param requis, dans les signature_roles du type, non rejoué sur la révision.
  if (action === 'sign') {
    if (!ctx.roleParam || !ctx.signatureRoles.includes(ctx.roleParam)) {
      const err: any = new Error(`rôle de signature invalide (attendus: ${ctx.signatureRoles.join(', ')})`);
      err.status = 422; throw err;
    }
    if (ctx.existingSignatures.includes(ctx.roleParam)) {
      const err: any = new Error(`rôle '${ctx.roleParam}' déjà signé sur cette révision`);
      err.status = 409; throw err;
    }
  }
  // Séparation des devoirs : le owner ne finalise pas un workflow strict.
  if ((action === 'approve' || action === 'issue') && isStrict(ctx.workflowSteps) && ctx.isOwner && !isAdmin) {
    const err: any = new Error(`séparation des devoirs : le préparateur ne peut pas '${action}' sur ce type`);
    err.status = 403; throw err;
  }
  return { to: def.to };
}
