// Couche de traduction UI (spec Premium §3, §46) : l'API parle machine, l'UI parle métier.
// Aucune clé technique (state, action, type de lien, événement) ne doit apparaître brute.

export const FAMILY_LABEL: Record<string, string> = {
  OFFICIAL: 'Officiel', BUSINESS: 'Commercial', LEGAL: 'Juridique',
  CERTIFICATE: 'Certificats', HR: 'RH', FINANCE: 'Finance',
};

export const STATE_LABEL: Record<string, string> = {
  draft: 'Brouillon', in_review: 'En revue', changes_requested: 'Modifications demandées',
  approved: 'Approuvé', ready_to_sign: 'À signer', signed: 'Signé', issued: 'Émis',
  archived: 'Archivé', rejected: 'Rejeté', cancelled: 'Annulé', revoked: 'Révoqué',
  expired: 'Expiré', superseded: 'Remplacé',
};

export const ACTION_LABEL: Record<string, string> = {
  submit: 'Soumettre en revue', request_changes: 'Demander des modifications',
  revise: 'Reprendre en brouillon', approve: 'Approuver', reject: 'Rejeter',
  generate_final: 'Préparer la signature', sign: 'Signer', issue: 'Émettre',
  cancel: 'Annuler le document', expire: 'Marquer expiré', revoke: 'Révoquer',
  supersede: 'Remplacer par un nouveau', archive: 'Archiver',
};

export const EVENT_LABEL: Record<string, string> = {
  created: 'a créé le document', submitted_for_review: 'a soumis en revue',
  changes_requested: 'a demandé des modifications', revision_created: 'a créé une révision',
  draft_saved: 'a enregistré le brouillon', approval_granted: 'a approuvé',
  approval_rejected: 'a rejeté', generated: 'a généré le document', signature_completed: 'a signé',
  issued: 'a émis le document', cancelled: 'a annulé le document', expired: 'a enregistré l\'expiration',
  revoked: 'a révoqué le document', superseded: 'a remplacé le document', archived: 'a archivé le document',
  downloaded: 'a téléchargé le document', linked: 'a lié un document', derived: 'a créé un document à partir de celui-ci',
  template_changed: 'a modifié un modèle', template_published: 'a publié un modèle', template_retired: 'a retiré un modèle',
  certificate_issued: 'a émis un certificat', certificate_revoked: 'a révoqué un certificat',
  settings_changed: 'a modifié un paramètre',
  escalation_granted: 'a accordé une escalade de privilèges',
  ai_assisted: 'a utilisé l\'assistant IA',
  signature_activated: 'a activé sa signature électronique',
  visibility_changed: 'a modifié la visibilité au registre public',
  assigned: 'a confié une étape du document',
};

export const LINK_LABEL: Record<string, string> = {
  relates_to: 'associé à', amends: 'modifie', supersedes: 'remplace',
  invoices: 'facture', evidences: 'prouve', derives_from: 'créé à partir de',
};

export const CONF_LABEL: Record<string, string> = {
  public: 'Public', internal: 'Interne', confidential: 'Confidentiel', restricted: 'Restreint',
};

// Steps de workflow (machine) → étapes humaines du stepper.
export const STEP_LABEL: Record<string, string> = {
  draft: 'Brouillon', prepared_by: 'Préparation', reviewed_by: 'Revue', review: 'Revue',
  approval: 'Approbation', authorized_by: 'Approbation', sign: 'Signature', signature: 'Signature',
  issued: 'Émission', issue: 'Émission', archived: 'Archivage', archive: 'Archivage',
};

// Acteur d'un événement d'audit : le NOM de la personne avant tout, le rôle en repli.
// L'historique parle de personnes, pas de rôles techniques (spec §26).
export function actorLabel(a: any): string {
  if (a?.actorName) return a.actorName;
  if (a?.actorRole === 'system' || a?.actorId === 'system') return 'Système';
  return ROLE_LABEL[a?.actorRole] ?? a?.actorRole ?? '—';
}

export function stateLabel(s: string) { return STATE_LABEL[s] ?? s; }
export function actionLabel(a: string) { return ACTION_LABEL[a] ?? a; }
export function eventLabel(e: string) { return EVENT_LABEL[e] ?? e; }
export function linkLabel(l: string) { return LINK_LABEL[l] ?? l; }
export function familyLabel(f: string) { return FAMILY_LABEL[f] ?? f; }

// Rôles et permissions en langage humain (admin = lieu de complexité, mais lisible).
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur', doc_manager: 'Gestionnaire', author: 'Auteur',
  reviewer: 'Relecteur', approver: 'Approbateur', signer: 'Signataire', viewer: 'Lecteur',
};
export const PERM_LABEL: Record<string, string> = {
  view: 'Consulter', edit: 'Modifier', review: 'Relire', approve: 'Approuver',
  sign: 'Signer', issue: 'Émettre', admin: 'Administrer',
};

// Types de champs pour le constructeur de formulaires (§12) : jamais de clé technique visible.
export const FIELD_TYPE_LABEL: Record<string, string> = {
  text: 'Texte', textarea: 'Texte long', number: 'Nombre', currency: 'Montant', date: 'Date',
  list: 'Liste de choix', person: 'Personne', client: 'Client', project: 'Projet', computed: 'Champ calculé',
};
// Sources de données niveau 2 (§13) : le champ se remplit depuis le contexte métier.
export const DATASOURCE_LABEL: Record<string, string> = {
  customers: 'Clients', projects: 'Projets', services: 'Services', people: 'Personnes', employees: 'Employés',
};
// Type → source de données implicite (Client → Clients, Personne → Personnes…).
export const TYPE_DATASOURCE: Record<string, string> = { client: 'customers', person: 'people', project: 'projects' };

// Évaluation sécurisée d'une formule de calcul (§5) : "{quantite} * {prix}" → nombre.
// Substitution des références puis garde-fou : chiffres et opérateurs arithmétiques uniquement.
export function evaluateFormula(formula: string, values: Record<string, any>): number | null {
  const expr = (formula ?? '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
    const v = Number(values[k]);
    return Number.isFinite(v) ? String(v) : '0';
  });
  if (!expr.trim() || !/^[\d+\-*/().\s]+$/.test(expr)) return null;
  try {
    const result = Function(`"use strict"; return (${expr});`)();
    return typeof result === 'number' && Number.isFinite(result) ? Math.round(result * 100) / 100 : null;
  } catch { return null; }
}

export function slugify(label: string): string {
  const base = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'champ';
  return base;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function fmtMoney(n: any, currency?: string): string {
  if (n === undefined || n === null || n === '') return '-';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return `${num.toLocaleString('fr-FR')} ${currency ?? 'XAF'}`;
}

// Diff humain (§25) : rend chaque champ modifié "Avant → Après" avec son libellé.
// L'API ne renvoie que les clés (changed/added/removed) : les valeurs se relisent dans les snapshots.
export function humanizeDiff(diff: any, revs: Array<{ rev: number; snapshot: Record<string, any> }>, fields: any[]): Array<{ label: string; before: string; after: string }> {
  const labelOf = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
  const snap = (rev: number) => revs.find((r) => r.rev === rev)?.snapshot ?? {};
  const a = snap(diff?.from); const b = snap(diff?.to);
  const show = (v: any) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const out: Array<{ label: string; before: string; after: string }> = [];
  for (const k of diff?.changed ?? []) out.push({ label: labelOf(k), before: show(a[k]), after: show(b[k]) });
  for (const k of diff?.added ?? []) out.push({ label: labelOf(k), before: '—', after: show(b[k]) });
  for (const k of diff?.removed ?? []) out.push({ label: labelOf(k), before: show(a[k]), after: '—' });
  return out;
}
