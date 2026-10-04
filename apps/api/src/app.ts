import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { z } from 'zod';
import { randomUUID, createHash } from 'crypto';
import { db, save, storageDir, repoRoot } from './store';
import { authenticate, requireRoles, checkPassword, signToken, hashPassword, effectiveRoles } from './auth';
import { allocateReference } from './numbering';
import path from 'path';
import { logEvent, timeline, verifyChain } from './audit';
import { generatePdfBuffer, saveArtifactFile, validateRequired } from './pdf';
import { buildSchema, diffSnapshots, validateLink, LINK_TYPES } from './builder';
import { transitionsFor, resolveTransition, isOverdue, isExpiring, priorityOf, DEFAULT_MATRIX, ACTION_PERM, TRANSITIONS } from './workflow';
import { computeTotals, checkTxTransition, prefillFields, effectiveStatus, canViewDoc, inDepartmentScope, defaultConfidentiality } from './business';
import { needsReminder, needsEscalation, autoArchiveDue, webhookPayload } from './automation';
import nodemailer from 'nodemailer';
import { DEFAULT_BRANDING, mergeBranding, sanitizeProposal, extractJson, type BrandingWithLogo } from './branding';
import { SECRETS_AT_REST, SECRET_MASK, encryptAtRest, decryptAtRest, migrateSecretsAtRest } from './secrets';
import { businessSchema, documentCreateSchema, templateDefinitionSchema } from './validation';
import { seedAll } from './seed';

// Référentiel workflow (workflows/definitions.json) - steps et rôles par workflow_key.
const WF: any = JSON.parse(fs.readFileSync(path.join(repoRoot(), 'workflows', 'definitions.json'), 'utf-8'));
function stepsFor(type_code: string): string[] {
  const dt = db.documentTypes.find((t) => t.type_code === type_code);
  if (!dt) return [];
  return WF.workflows?.[dt.workflow_key]?.steps ?? [];
}
function sigRolesFor(type_code: string): string[] {
  return db.documentTypes.find((t) => t.type_code === type_code)?.signature_roles ?? [];
}
function workflowKeyFor(type_code: string): string {
  return db.documentTypes.find((t) => t.type_code === type_code)?.workflow_key ?? 'official_standard';
}
async function notify(documentId: string, kind: string, message: string, audience: string) {
  db.notifications.push({ id: randomUUID(), documentId, kind, message, audience, read: false, createdAt: new Date().toISOString() });
  await save();
  // Notification par email (best-effort) : jamais bloquante pour le flux documentaire.
  if (smtpConfigured() && audience.startsWith('user:')) {
    const uid = audience.slice(5);
    const u = db.users.find((x) => x.id === uid);
    if (u?.email) {
      smtpTransport().sendMail({ from: (setting('smtpFrom') as string) || (setting('smtpUser') as string), to: u.email, subject: `DailyOps DCS — ${kind}`, text: message }).catch(() => {});
    }
  }
}
// Routage (US-8.1) : notifie chaque utilisateur du rôle **dans le périmètre du domaine**,
// sinon audience rôle générique. Un reviewer RH n'est jamais sollicité sur un document Finance.
async function notifyRole(documentId: string, kind: string, message: string, role: string) {
  const family = db.documents.find((d) => d.id === documentId)?.family ?? '';
  const scopes = setting('departmentScopes') ?? {};
  const eligible = db.users.filter((u) => u.role === role && u.isActive && inDepartmentScope(u.department, family, scopes));
  if (eligible.length === 0) return notify(documentId, kind, message, `role:${role}`);
  for (const u of eligible) await notify(documentId, kind, `${message} (assigné : ${u.displayName})`, `user:${u.id}`);
}
// Webhooks (US-8.4) : diffusion best-effort, sans bloquer le flux documentaire.
async function dispatch(event: string, doc: { id: string; reference: string; type_code: string; state: string }) {
  const targets = db.webhooks.filter((w) => w.active && (w.events.includes(event) || w.events.includes('*')));
  for (const w of targets) {
    try {
      await fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(webhookPayload(event, doc)), signal: AbortSignal.timeout(5000) });
    } catch { /* best-effort : l'échec webhook ne bloque jamais le document */ }
  }
}
// Département frais en base (jamais le token : un changement admin s'applique immédiatement).
function deptOf(userId: string): string | undefined {
  return db.users.find((u) => u.id === userId)?.department;
}
// Escalades ponctuelles détenues par l'utilisateur sur un document (top management).
function grantsOf(documentId: string, userId: string): string[] {
  return db.grants.filter((g) => g.documentId === documentId && g.userId === userId).map((g) => g.permission);
}
// L'assignation vise-t-elle CET utilisateur ? Une personne nommée, son rôle,
// son département entier, ou son rôle dans son département.
function assignmentMatches(a: any, user: { id: string; role: string; roles?: string[]; department?: string }): boolean {
  const mine = user.roles ?? [user.role];
  switch (a.target) {
    case 'user': return a.userId === user.id;
    case 'role': return !!a.role && mine.includes(a.role);
    case 'department': return !!a.department && user.department === a.department;
    case 'role_dept': return !!a.role && !!a.department && mine.includes(a.role) && user.department === a.department;
    default: return false;
  }
}
// Autorités déléguées sur CE document : escalades + assignations actives (cibles incluses).
// L'assignation confère l'autorité de SON étape (relire, approuver, signer) à toute sa cible.
function delegatedAuthority(documentId: string, userId: string): string[] {
  const u = db.users.find((x) => x.id === userId);
  const fromAssignments = u
    ? db.assignments.filter((a) => a.documentId === documentId && !a.fulfilledAt && assignmentMatches(a, u)).map((a) => a.action)
    : [];
  return [...new Set([...grantsOf(documentId, userId), ...fromAssignments])];
}
// Autorités cumulées des rôles effectifs d'un utilisateur (matrice éditable).
function effectivePermissions(roles: string[]): string[] {
  const m = setting('permissionMatrix') ?? {};
  return [...new Set(roles.flatMap((r) => m[r] ?? []))];
}
// Besoin d'en connaître : l'utilisateur a-t-il, à cette étape du processus, une action légitime ?
// (matrice de permissions ET workflow). C'est le "besoin d'en connaître" dynamique.
// Les actions réservées au propriétaire ne comptent pas : elles ne créent pas d'accréditation.
const OWNER_ONLY_ACTIONS = ['submit', 'revise', 'cancel', 'generate_final'];
function hasPendingAuthority(d: { state: string }, user: { id: string; role: string; roles?: string[] }): boolean {
  const mine = user.roles ?? [user.role];
  const perms = effectivePermissions(mine);
  return transitionsFor(d.state, mine).some((t) => {
    const need = ACTION_PERM[t.action];
    return !!need && perms.includes(need) && !OWNER_ONLY_ACTIONS.includes(t.action);
  });
}
// Visibilité effective = confidentialité (canViewDoc) + périmètre département (§31)
// + besoin d'en connaître sur les documents confidentiels (accréditation).
// L'administrateur voit tout. Hors périmètre ou hors accréditation = invisible (404).
function visibleFor(d: { id: string; ownerId: string; family: string; state: string; confidentiality?: string | null }, user: { id: string; role: string }): boolean {
  if (!canViewDoc(d, user)) return false;
  if (user.role === 'admin') return true;
  if (!inDepartmentScope(deptOf(user.id), d.family, setting('departmentScopes'))) return false;
  if (d.confidentiality === 'confidential' && user.role !== 'doc_manager') {
    if (d.ownerId === user.id) return true;
    if (delegatedAuthority(d.id, user.id).length > 0) return true; // escalade ou assignation
    if (deptOf(user.id) && deptOf(user.id) === deptOf(d.ownerId)) return true; // même département = même accréditation
    return hasPendingAuthority(d, user); // étape en attente où l'utilisateur a autorité
  }
  return true;
}

// Actions réellement permises pour l'utilisateur sur CE document (rôles effectifs
// cumulés + matrice + propriétaire + escalades). L'exécution revalide côté workflow.
function allowedActions(d: any, user: { id: string; role: string; roles?: string[] }): string[] {
  const mine = user.roles ?? [user.role];
  const granted = delegatedAuthority(d.id, user.id);
  const grantedRole: Record<string, string> = { review: 'reviewer', approve: 'approver', sign: 'signer' };
  const defs = [...transitionsFor(d.state, mine)];
  for (const g of granted) defs.push(...transitionsFor(d.state, [grantedRole[g]]));
  const seen = new Set<string>(); const out: string[] = [];
  for (const t of defs) {
    if (seen.has(t.action)) continue;
    seen.add(t.action);
    const need = ACTION_PERM[t.action];
    const byGrant = granted.includes(need ?? '');
    if (!byGrant && t.roles.some((r) => mine.includes(r)) === false && !mine.includes('admin')) continue;
    if (['submit', 'revise', 'cancel', 'generate_final'].includes(t.action) && user.role === 'author' && d.ownerId !== user.id) continue;
    out.push(t.action);
  }
  return out;
}

// Garde confidentialité (US-7.2) : un restricted invisible vaut 404, sans fuite d'existence.
function requireVisible(req: any, res: any, next: any) {
  const found = db.documents.find((x) => x.id === req.params.id);
  if (!found || !visibleFor(found, req.user!)) return res.status(404).json({ error: 'not_found' });
  req.doc = found; next();
}

export const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Express 4 ignore les rejets des handlers async : tout rejet remonte ici vers le middleware d'erreur.
// Sans cela, une simple validation ratée fait tomber le process (constaté en test : titre vide = crash).
for (const m of ['get', 'post', 'patch', 'delete'] as const) {
  const orig = app[m].bind(app);
  (app as any)[m] = (path: any, ...handlers: any[]) =>
    orig(path, ...handlers.map((h: any) => (req: any, res: any, next: any) => {
      try {
        const r = h(req, res, next);
        if (r && typeof r.catch === 'function') r.catch(next);
      } catch (e) { next(e); }
    }));
}

// Requis par défaut (fallback) - la source de vérité est definition.required du template (P2).
const REQUIRED: Record<string, string[]> = {
  'DO-OFF-LETTER': ['recipient', 'subject', 'body'],
  'DO-BIZ-PROPOSAL': ['client', 'scope', 'fees'],
  'DO-LEG-NDA': ['party_a', 'party_b', 'purpose'],
  'DO-HR-WORK-CERT': ['employee', 'subject', 'body'],
  'DO-HR-EMPLOYMENT-CONTRACT': ['employee', 'role', 'start_date'],
  'DO-HR-NOTIFICATION': ['employee', 'subject', 'body'],
  'DO-FIN-PROFORMA': ['client', 'items', 'total'],
  'DO-FIN-CREDIT-NOTE': ['client', 'items', 'total'],
  'DO-FIN-RECEIPT': ['client', 'amount'],
  'DO-FIN-PAYMENT-NOTICE': ['client', 'amount', 'due_date'],
};

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, service: 'dcs-api', phase: 'P8-automation' }));

function templateOf(d: { templateVersionId: string }) {
  return db.templateVersions.find((v) => v.id === d.templateVersionId);
}
// Requis effectifs : definition.required du template d'abord, map REQUIRED en fallback.
function requiredFor(d: { type_code: string; templateVersionId: string }): string[] {
  const tv = templateOf(d);
  const fromTpl = (tv?.definition as any)?.required;
  if (Array.isArray(fromTpl) && fromTpl.length > 0) return fromTpl;
  return REQUIRED[d.type_code] ?? [];
}

// ---- Auth (US-1.1) ----
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
  const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.isActive);
  if (!u || !(await checkPassword(password, u.passwordHash))) return res.status(401).json({ error: 'invalid_credentials' });
  res.json({ token: signToken({ id: u.id, email: u.email, role: u.role, displayName: u.displayName }), user: { id: u.id, email: u.email, role: u.role } });
});
app.get('/api/v1/auth/me', authenticate, (req, res) => {
  const fresh = db.users.find((u) => u.id === req.user!.id);
  res.json({ user: { ...req.user, department: fresh?.department ?? null, roles: effectiveRoles(fresh ?? ({} as any)),
    signingActivated: !!(fresh?.signingActivated && fresh?.signaturePassHash), hasPass: !!fresh?.signaturePassHash,
    signatureName: fresh?.signatureName ?? null, signatureUnlocked: !!(fresh?.signatureUnlockedUntil && new Date(fresh.signatureUnlockedUntil).getTime() > Date.now()) } });
});

// ---- Signature électronique (anti-usurpation) : chacun active SA signature ----
// Activation : nom légal + passphrase (hachée, jamais en clair). La passphrase est
// exigée à la première signature, puis après chaque fenêtre de 15 min sans usage.
app.post('/api/v1/me/signature', authenticate, async (req, res) => {
  const p = z.object({ signatureName: z.string().min(3), passphrase: z.string().min(6) }).parse(req.body);
  const u = db.users.find((x) => x.id === req.user!.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  u.signatureName = p.signatureName.trim();
  u.signaturePassHash = await hashPassword(p.passphrase);
  u.signingActivated = true;
  u.signatureUnlockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
  await save();
  await logEvent({ documentId: 'settings', actorId: u.id, actorRole: u.role, eventType: 'signature_activated', changeSummary: u.signatureName });
  res.json({ data: { signatureName: u.signatureName, signingActivated: true } });
});
// Changement de passphrase : exige la passphrase courante.
app.post('/api/v1/me/signature/passphrase', authenticate, async (req, res) => {
  const p = z.object({ current: z.string().min(6), next: z.string().min(6) }).parse(req.body);
  const u = db.users.find((x) => x.id === req.user!.id);
  if (!u?.signingActivated || !u.signaturePassHash) return res.status(409).json({ error: 'not_activated' });
  if (!(await checkPassword(p.current, u.signaturePassHash))) return res.status(403).json({ error: 'signature_passphrase_invalid', detail: 'passphrase actuelle incorrecte' });
  u.signaturePassHash = await hashPassword(p.next);
  await save();
  res.json({ data: { ok: true } });
});
app.post('/api/v1/me/signature/deactivate', authenticate, async (req, res) => {
  const p = z.object({ passphrase: z.string().min(6) }).parse(req.body);
  const u = db.users.find((x) => x.id === req.user!.id);
  if (!u?.signingActivated || !u.signaturePassHash) return res.status(409).json({ error: 'not_activated' });
  if (!(await checkPassword(p.passphrase, u.signaturePassHash))) return res.status(403).json({ error: 'signature_passphrase_invalid' });
  u.signingActivated = false; u.signatureName = undefined; u.signaturePassHash = undefined; u.signatureUnlockedUntil = undefined;
  await save();
  res.json({ data: { signingActivated: false } });
});

// ---- Types (US-1.2) ----
app.get('/api/v1/document-types', authenticate, (_req, res) => res.json({ data: db.documentTypes }));
// Rôles de signature et échéance par défaut par type (workflow binding) :
// redéfinissables par l'administrateur. defaultDueDays = 0 → pas d'échéance auto.
app.patch('/api/v1/document-types/:type_code', authenticate, requireRoles('admin'), async (req, res) => {
  const dt = db.documentTypes.find((t) => t.type_code === req.params.type_code);
  if (!dt) return res.status(404).json({ error: 'not_found' });
  const p = z.object({ signature_roles: z.array(z.string().min(1)).min(1).optional(), defaultDueDays: z.number().min(0).max(365).optional(), requires_signature: z.boolean().optional() }).parse(req.body);
  if (p.signature_roles) dt.signature_roles = p.signature_roles.map((s) => s.trim());
  if (p.defaultDueDays !== undefined) dt.defaultDueDays = p.defaultDueDays;
  if (p.requires_signature !== undefined) dt.requires_signature = p.requires_signature;
  await save();
  await logEvent({ documentId: 'settings', actorId: req.user!.id, actorRole: req.user!.role, eventType: 'settings_changed', changeSummary: `type ${req.params.type_code} mis à jour` });
  res.json({ data: dt });
});

// ---- Templates (US-1.2) ----
app.get('/api/v1/templates', authenticate, (_req, res) => {
  res.json({ data: db.templates.map((t) => ({ ...t, versions: db.templateVersions.filter((v) => v.templateId === t.id) })) });
});
app.post('/api/v1/templates', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const p = z.object({ type_code: z.string(), name: z.string(), definition: z.any().optional() }).parse(req.body);
  const tId = randomUUID(); const vId = randomUUID();
  db.templates.push({ id: tId, type_code: p.type_code, name: p.name, ownerId: req.user!.id, createdAt: new Date().toISOString() });
  db.templateVersions.push({ id: vId, templateId: tId, version: '1.0', status: 'draft', definition: p.definition ?? { blocks: [], required: [] } });
  await save();
  await logEvent({ documentId: tId, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'template_changed', changeSummary: `template ${p.name} v1.0 draft` });
  res.status(201).json({ id: tId, versionId: vId });
});
app.post('/api/v1/template-versions/:id/publish', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const v = db.templateVersions.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'not_found' });
  v.status = 'approved'; v.publishedAt = new Date().toISOString();
  await save();
  await logEvent({ documentId: v.templateId, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'template_published', changeSummary: `version ${v.version}` });
  res.json({ ok: true, status: v.status });
});
app.post('/api/v1/template-versions/:id/retire', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const v = db.templateVersions.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'not_found' });
  v.status = 'retired';
  await save();
  await logEvent({ documentId: v.templateId, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'template_retired', changeSummary: `version ${v.version}` });
  res.json({ ok: true, status: v.status });
});
// Édition de la définition d'un brouillon (champs, requis, blocs). Les versions publiées sont intouchables.
app.patch('/api/v1/template-versions/:id', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const v = db.templateVersions.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'not_found' });
  if (v.status !== 'draft') return res.status(409).json({ error: 'only_draft_editable', detail: 'créez une nouvelle version pour modifier' });
  const p = z.object({ definition: templateDefinitionSchema }).parse(req.body);
  v.definition = p.definition;
  await save();
  res.json({ data: v });
});
// Génère le brouillon manquant (mécanique système) : la publication reste une décision humaine.
app.post('/api/v1/templates/ensure', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const p = z.object({ type_code: z.string() }).parse(req.body);
  if (!db.documentTypes.find((t) => t.type_code === p.type_code)) return res.status(400).json({ error: 'unknown_type' });
  let tpl = db.templates.find((t) => t.type_code === p.type_code);
  if (!tpl) {
    const tId = randomUUID(); const vId = randomUUID();
    db.templates.push({ id: tId, type_code: p.type_code, name: `${p.type_code} v1`, ownerId: req.user!.id, createdAt: new Date().toISOString() });
    db.templateVersions.push({ id: vId, templateId: tId, version: '1.0', status: 'draft', definition: { blocks: [], required: [], fields: [] } });
    await save();
    tpl = db.templates.find((t) => t.type_code === p.type_code)!;
  }
  res.status(201).json({ data: { ...tpl, versions: db.templateVersions.filter((v) => v.templateId === tpl!.id) } });
});

// ---- Recherche globale P9 (wireframe §43) : une ou deux interactions vers l'objet ----
app.get('/api/v1/search', authenticate, (req, res) => {
  const q = ((req.query.q as string) ?? '').toLowerCase();
  if (!q) return res.json({ data: { documents: [], customers: [], people: [], projects: [], services: [], templates: [] } });
  const vis = (d: any) => visibleFor(d, req.user!);
  res.json({
    data: {
      documents: db.documents.filter((d) => vis(d) && (d.reference + d.title).toLowerCase().includes(q)).slice(0, 10),
      customers: db.customers.filter((c) => (c.name + (c.email ?? '')).toLowerCase().includes(q)).slice(0, 5),
      people: db.people.filter((p) => (p.fullName + (p.email ?? '')).toLowerCase().includes(q)).slice(0, 5),
      projects: db.projects.filter((p) => (p.title + (p.code ?? '')).toLowerCase().includes(q)).slice(0, 5),
      services: db.services.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 5),
      templates: db.templates.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 5),
    },
  });
});

// Politiques persistées (US admin) : settings DB d'abord, env ensuite, défaut enfin.
// departmentScopes : Record<département, familles autorisées>. {} = aucun scoping (défaut sûr).
// SMTP (notifications mail) et IA (assistant rédaction) : config admin uniquement.
const SETTING_DEFAULTS: Record<string, any> = {
  autoArchiveAfterDays: 0, reminderIntervalHours: 24, escalationAfterDays: 3, certExpiryWarnDays: 30,
  permissionMatrix: DEFAULT_MATRIX, departmentScopes: {},
  branding: DEFAULT_BRANDING,
  smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPass: '', smtpFrom: '',
  aiEnabled: false, aiApiKey: '', aiBaseUrl: '', aiModel: '',
};
function setting(key: string): any {
  const found = db.settings.find((s) => s.key === key);
  if (found !== undefined) return SECRETS_AT_REST.has(key) ? decryptAtRest(found.value) : found.value;
  if (key === 'autoArchiveAfterDays' && process.env.AUTO_ARCHIVE_AFTER_DAYS !== undefined) return Number(process.env.AUTO_ARCHIVE_AFTER_DAYS);
  return SETTING_DEFAULTS[key];
}

// ---- Administration P9 (wireframes §30-35) ----
app.get('/api/v1/admin/users', authenticate, requireRoles('admin'), (_req, res) => {
  res.json({ data: db.users.map((u) => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role, roles: effectiveRoles(u), department: u.department ?? null, isActive: u.isActive, signingActivated: u.signingActivated ?? false, signatureName: u.signatureName ?? null })) });
});
app.get('/api/v1/admin/numbering', authenticate, requireRoles('admin', 'doc_manager'), (_req, res) => {
  res.json({ data: Object.entries(db.sequences).map(([key, last]) => ({ key, last })), pattern: 'DO-[CODE]-[YEAR]-[SEQ4]' });
});
// Utilisateurs : création, rôle, activation. On ne touche pas à son propre accès.
app.post('/api/v1/admin/users', authenticate, requireRoles('admin'), async (req, res) => {
  try {
    const p = z.object({ email: z.string().email(), displayName: z.string().min(1), role: z.enum(['admin', 'doc_manager', 'author', 'reviewer', 'approver', 'signer', 'viewer']), department: z.string().optional(), password: z.string().min(6) }).parse(req.body);
    if (db.users.some((u) => u.email.toLowerCase() === p.email.toLowerCase())) return res.status(409).json({ error: 'email_taken' });
    const u = { id: randomUUID(), email: p.email, displayName: p.displayName, role: p.role, department: p.department, passwordHash: await hashPassword(p.password), isActive: true };
    db.users.push(u); await save();
    res.status(201).json({ data: { id: u.id, email: u.email, displayName: u.displayName, role: u.role, department: u.department ?? null } });
  } catch (e: any) { res.status(e.status ?? 500).json({ error: e.message ?? 'create_failed' }); }
});
app.patch('/api/v1/admin/users/:id', authenticate, requireRoles('admin'), async (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const p = z.object({ role: z.enum(['admin', 'doc_manager', 'author', 'reviewer', 'approver', 'signer', 'viewer']).optional(), roles: z.array(z.enum(['admin', 'doc_manager', 'author', 'reviewer', 'approver', 'signer', 'viewer'])).max(6).optional(), department: z.string().nullable().optional(), isActive: z.boolean().optional(), password: z.string().min(6).optional() }).parse(req.body);
  if (u.id === req.user!.id && (p.role !== undefined || p.isActive === false)) {
    return res.status(403).json({ error: 'cannot_lock_self', detail: 'demandez à un autre administrateur' });
  }
  if (p.role !== undefined) u.role = p.role;
  // Rôles additionnels (combinables) : un PDG peut être approbateur ET signataire.
  if (p.roles !== undefined) u.roles = [...new Set([...p.roles.filter((r) => r !== u.role)])];
  if (p.department !== undefined) u.department = p.department ?? undefined;
  if (p.isActive !== undefined) u.isActive = p.isActive;
  if (p.password) u.passwordHash = await hashPassword(p.password);
  await save();
  res.json({ data: { id: u.id, email: u.email, displayName: u.displayName, role: u.role, department: u.department ?? null, isActive: u.isActive } });
});
// Politiques : lecture admin complète (secrets MASQUÉS, jamais renvoyés en clair) ;
// lecture publique limitée pour les autres rôles (matrice et périmètres seulement).
app.get('/api/v1/admin/settings', authenticate, (req, res) => {
  const mask = (k: string, v: any) => (SECRETS_AT_REST.has(k) && v ? SECRET_MASK : v);
  if (req.user!.role === 'admin') {
    return res.json({ data: Object.fromEntries(Object.keys(SETTING_DEFAULTS).map((k) => [k, mask(k, setting(k))])) });
  }
  res.json({ data: { permissionMatrix: setting('permissionMatrix'), departmentScopes: setting('departmentScopes') } });
});
app.patch('/api/v1/admin/settings', authenticate, requireRoles('admin'), async (req, res) => {
  const p = z.object({ key: z.string(), value: z.any() }).parse(req.body);
  if (!(p.key in SETTING_DEFAULTS)) return res.status(400).json({ error: 'unknown_setting' });
  // Sentinelle de masque : l'UI renvoie « ******** » si le secret n'a pas été ressaisi — on conserve l'existant.
  if (SECRETS_AT_REST.has(p.key) && p.value === SECRET_MASK) {
    return res.json({ data: { [p.key]: SECRET_MASK } });
  }
  if (p.key === 'departmentScopes') z.record(z.array(z.string())).parse(p.value);
  if (p.key === 'permissionMatrix') z.record(z.array(z.string())).parse(p.value);
  if (p.key === 'smtpPort') z.number().int().min(1).max(65535).parse(p.value);
  if (p.key === 'smtpSecure' || p.key === 'aiEnabled') z.boolean().parse(p.value);
  if (['smtpHost', 'smtpUser', 'smtpPass', 'smtpFrom', 'aiApiKey', 'aiBaseUrl', 'aiModel'].includes(p.key)) z.string().parse(p.value);
  const stored = SECRETS_AT_REST.has(p.key) && p.value !== '' ? encryptAtRest(String(p.value)) : p.value;
  const existing = db.settings.find((s) => s.key === p.key);
  if (existing) existing.value = stored;
  else db.settings.push({ key: p.key, value: stored, updatedAt: new Date().toISOString() });
  await save();
  await logEvent({ documentId: 'settings', actorId: req.user!.id, actorRole: req.user!.role, eventType: 'settings_changed', changeSummary: `${p.key} = ${SECRETS_AT_REST.has(p.key) ? (p.value ? '••••' : '(vidé)') : JSON.stringify(p.value)}` });
  res.json({ data: { [p.key]: SECRETS_AT_REST.has(p.key) && stored ? SECRET_MASK : setting(p.key) } });
});

// ---- SMTP (notifications par email) : config admin, envoi best-effort, test de connexion ----
function smtpConfigured(): boolean {
  return !!setting('smtpHost') && Number(setting('smtpPort')) > 0;
}
function smtpTransport() {
  const user = setting('smtpUser') as string;
  return nodemailer.createTransport({
    host: setting('smtpHost') as string, port: Number(setting('smtpPort')), secure: !!setting('smtpSecure'),
    auth: user ? { user, pass: setting('smtpPass') as string } : undefined,
  });
}
// Test admin : vérifie la connexion (et envoie un message si une adresse est fournie).
app.post('/api/v1/admin/smtp-test', authenticate, requireRoles('admin'), async (req, res) => {
  if (!smtpConfigured()) return res.status(422).json({ error: 'smtp_not_configured', detail: 'renseignez au moins hôte et port' });
  try {
    const t = smtpTransport();
    await t.verify();
    const to = z.object({ to: z.string().email().optional() }).parse(req.body ?? {}).to;
    if (to) {
      await t.sendMail({ from: (setting('smtpFrom') as string) || (setting('smtpUser') as string), to, subject: 'DailyOps DCS — test SMTP', text: 'Configuration SMTP validée. Les notifications documentaires arriveront sur cette adresse.' });
    }
    res.json({ data: { ok: true, sent: !!to } });
  } catch (e: any) { res.status(502).json({ error: 'smtp_test_failed', detail: e.message }); }
});

// ---- Assistant IA (rédaction) : activable et configurable par l'admin uniquement ----
// Statut public (pas de secret) : l'UI affiche l'aide uniquement si l'agent est armé.
app.get('/api/v1/ai/status', authenticate, (_req, res) => {
  res.json({ data: { enabled: !!setting('aiEnabled') && !!setting('aiApiKey') } });
});
// Assistance rédactionnelle : le contenu renvoyé reste sous contrôle de l'utilisateur (relire avant insertion).
app.post('/api/v1/ai/assist', authenticate, async (req, res) => {
  const p = z.object({ documentId: z.string().optional(), instruction: z.string().min(1), context: z.string().optional() }).parse(req.body);
  if (!setting('aiEnabled') || !setting('aiApiKey')) return res.status(409).json({ error: 'ai_disabled', detail: 'assistant non activé' });
  let docContext = '';
  if (p.documentId) {
    const d = db.documents.find((x) => x.id === p.documentId);
    if (d && visibleFor(d, req.user!)) docContext = `Document : ${d.reference} — ${d.title}. `;
  }
  const base = String(setting('aiBaseUrl') || 'https://api.openai.com/v1').replace(/\/+$/, '');
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setting('aiApiKey')}` },
      body: JSON.stringify({
        model: setting('aiModel') || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es l\'assistant rédactionnel du système de contrôle documentaire de DailyOps.Tech. Rédige en français un texte professionnel, factuel et prêt à insérer dans un document d\'entreprise. Réponds uniquement avec le texte demandé : pas d\'introduction, pas de commentaire, pas de balise.' },
          { role: 'user', content: `${docContext}${p.context ? `Contexte : ${p.context}. ` : ''}Consigne : ${p.instruction}` },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`fournisseur IA indisponible (HTTP ${r.status})`);
    const j: any = await r.json();
    const text: string | undefined = j.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('réponse vide du fournisseur IA');
    if (p.documentId) await logEvent({ documentId: p.documentId, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'ai_assisted', changeSummary: p.instruction.slice(0, 80) });
    res.json({ data: { text } });
  } catch (e: any) { res.status(502).json({ error: 'ai_failed', detail: e.message }); }
});

// ---- Pilotage direction (top management) : suivi du parcours + escalades de privilèges ----
// Vue transverse : documents actifs au point d'être bloqués (retard, stagnation ≥ 3 jours).
app.get('/api/v1/management/oversight', authenticate, requireRoles('admin'), (_req, res) => {
  const now = new Date().toISOString();
  const ACTIVE = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed'];
  const mapped = db.documents
    .filter((d) => ACTIVE.includes(d.state))
    .map((d) => ({
      id: d.id, reference: d.reference, title: d.title, type_code: d.type_code, family: d.family,
      state: d.state, owner: db.users.find((u) => u.id === d.ownerId)?.displayName ?? '—',
      confidentiality: d.confidentiality ?? 'internal', dueAt: d.dueAt ?? null,
      overdue: isOverdue(d.dueAt, d.state, now),
      daysInState: Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000),
    }));
  const stalled = mapped.filter((d) => d.overdue || d.daysInState >= 3).sort((a, b) => b.daysInState - a.daysInState);
  res.json({ data: {
    counts: { total: db.documents.length, active: mapped.length, stalled: stalled.length, overdue: stalled.filter((d) => d.overdue).length },
    stalled: stalled.slice(0, 50),
  } });
});
// Escalade : le management accorde une autorité ponctuelle (relire/approuver/signer) sur UN document.
// La personne peut alors voir le document et agir à cette étape ; tout est tracé et notifié.
app.post('/api/v1/documents/:id/escalate', authenticate, requireRoles('admin'), requireVisible, async (req, res) => {
  const d = (req as any).doc;
  const p = z.object({ userId: z.string(), permission: z.enum(['review', 'approve', 'sign']), note: z.string().optional() }).parse(req.body);
  const target = db.users.find((u) => u.id === p.userId && u.isActive);
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  const grant = { id: randomUUID(), documentId: d.id, userId: p.userId, permission: p.permission, grantedBy: req.user!.id, note: p.note, createdAt: new Date().toISOString() };
  db.grants.push(grant); await save();
  await logEvent({ documentId: d.id, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'escalation_granted', changeSummary: `${target.displayName} → ${p.permission}` });
  await notify(d.id, 'escalation', `${d.reference} — ${d.title} : autorité « ${p.permission} » accordée sur ce document`, `user:${target.id}`);
  res.status(201).json({ data: { ...grant, user: target.displayName } });
});

// ---- Données métier P6 : le minimum pour exécuter des documents (DCS §10) ----
type Coll = 'customers' | 'people' | 'employees' | 'projects' | 'services';
function crud(path: string, coll: Coll, schema: z.ZodTypeAny) {
  app.get(`/api/v1/${path}`, authenticate, (_req, res) => res.json({ data: db[coll] }));
  app.post(`/api/v1/${path}`, authenticate, requireRoles('admin', 'doc_manager', 'author'), async (req, res) => {
    const p = schema.parse(req.body);
    const obj = { id: randomUUID(), ...p, createdAt: new Date().toISOString() };
    (db[coll] as any[]).push(obj); await save();
    res.status(201).json({ data: obj });
  });
  app.get(`/api/v1/${path}/:id`, authenticate, (req, res) => {
    const o = (db[coll] as any[]).find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ error: 'not_found' });
    res.json({ data: o });
  });
}
const biz = () => {
  crud('customers', 'customers', z.object({ name: z.string(), address: z.string().optional(), taxId: z.string().optional(), email: z.string().optional(), phone: z.string().optional() }));
  crud('people', 'people', z.object({ fullName: z.string(), email: z.string().optional(), phone: z.string().optional(), title: z.string().optional(), customerId: z.string().optional() }));
  crud('employees', 'employees', z.object({ fullName: z.string(), title: z.string().optional(), email: z.string().optional() }));
  crud('projects', 'projects', z.object({ title: z.string(), code: z.string().optional(), customerId: z.string().optional(), status: z.string().optional() }));
  crud('services', 'services', z.object({ name: z.string(), unitPrice: z.number(), currency: z.string().default('XAF'), description: z.string().optional() }));
};
biz();
// Transactions : événement métier derrière proposition, commande, facture, paiement (US-6.3, frontière §11).
app.get('/api/v1/transactions', authenticate, (_req, res) => res.json({ data: db.transactions }));
app.post('/api/v1/transactions', authenticate, requireRoles('admin', 'doc_manager', 'author'), async (req, res) => {
  const p = z.object({ kind: z.enum(['proposal', 'order', 'invoice', 'payment']), customerId: z.string().optional(), projectId: z.string().optional(), documentIds: z.array(z.string()).default([]), amount: z.number().optional(), currency: z.string().default('XAF') }).parse(req.body);
  const t = { id: randomUUID(), ...p, status: 'draft' as const, createdBy: req.user!.id, createdAt: new Date().toISOString() };
  db.transactions.push(t); await save();
  res.status(201).json({ data: t });
});
app.get('/api/v1/transactions/:id', authenticate, (req, res) => {
  const t = db.transactions.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  res.json({ data: { ...t, documents: t.documentIds.map((id) => db.documents.find((d) => d.id === id)).filter(Boolean) } });
});
app.patch('/api/v1/transactions/:id', authenticate, requireRoles('admin', 'doc_manager', 'author'), async (req, res) => {
  try {
    const t = db.transactions.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'not_found' });
    const p = z.object({ status: z.string().optional(), addDocumentId: z.string().optional() }).parse(req.body);
    if (p.status) { checkTxTransition(t.status, p.status); t.status = p.status as any; }
    if (p.addDocumentId) {
      if (!db.documents.find((d) => d.id === p.addDocumentId)) return res.status(404).json({ error: 'unknown_document' });
      if (!t.documentIds.includes(p.addDocumentId)) t.documentIds.push(p.addDocumentId);
    }
    await save();
    res.json({ data: t });
  } catch (e: any) { res.status(e.status ?? 500).json({ error: e.message ?? 'update_failed' }); }
});
// Totaux canoniques : remises puis taxes (US-6.3).
app.post('/api/v1/business/totals', authenticate, (req, res) => {
  const p = z.object({ lines: z.array(z.object({ label: z.string(), qty: z.number(), unitPrice: z.number() })), taxRate: z.number().optional(), discount: z.number().optional(), currency: z.string().optional() }).parse(req.body);
  res.json({ data: computeTotals(p.lines, p) });
});
// Pré-remplissage proposition (cas §9) : à appeler avant POST /documents.
app.get('/api/v1/documents/prefill', authenticate, (req, res) => {
  const q = req.query as Record<string, string>;
  const customer = db.customers.find((c) => c.id === q.customerId) ?? null;
  const project = db.projects.find((p) => p.id === q.projectId) ?? null;
  const ids = (q.serviceIds ?? '').split(',').filter(Boolean);
  const services = db.services.filter((s) => ids.includes(s.id));
  res.json({ data: prefillFields({ customer, project, services }) });
});

// ---- Documents (US-1.3, recherche US-6.4) ----
app.get('/api/v1/documents', authenticate, (req, res) => {
  const { state, type_code, q, customer, project, owner, from, to, related, signer } = req.query as Record<string, string>;
  let list = db.documents.filter((d) => visibleFor(d, req.user!));
  if (state) list = list.filter((d) => d.state === state);
  if (type_code) list = list.filter((d) => d.type_code === type_code);
  if (q) list = list.filter((d) => (d.title + d.reference).toLowerCase().includes(q.toLowerCase()));
  if (customer) list = list.filter((d) => d.business?.customerId === customer);
  if (project) list = list.filter((d) => d.business?.projectId === project);
  if (owner) list = list.filter((d) => d.ownerId === owner);
  if (from) list = list.filter((d) => d.createdAt >= from);
  if (to) list = list.filter((d) => d.createdAt <= to);
  if (related) {
    const ids = new Set(db.links.filter((l) => l.fromDocumentId === related || l.toDocumentId === related).flatMap((l) => [l.fromDocumentId, l.toDocumentId]));
    list = list.filter((d) => ids.has(d.id));
  }
  if (signer) {
    const ids = new Set(db.signatures.filter((s) => s.signerId === signer).map((s) => s.documentId));
    list = list.filter((d) => ids.has(d.id));
  }
  // Traçabilité lisible : le nom du responsable accompagne chaque document (plus d'UUID en UI).
  res.json({ data: list.map((d) => ({ ...d, owner: db.users.find((u) => u.id === d.ownerId)?.displayName ?? null })) });
});
app.post('/api/v1/documents', authenticate, requireRoles('admin', 'doc_manager', 'author'), async (req, res) => {
  const p = documentCreateSchema.parse(req.body);
  const dt = db.documentTypes.find((t) => t.type_code === p.type_code);
  if (!dt) return res.status(400).json({ error: 'unknown_type' });
  if (req.user!.role !== 'admin' && !inDepartmentScope(deptOf(req.user!.id), dt.family, setting('departmentScopes'))) {
    return res.status(403).json({ error: 'out_of_scope', detail: `domaine '${dt.family}' hors du périmètre de votre département` });
  }
  let tv = p.templateVersionId ? db.templateVersions.find((v) => v.id === p.templateVersionId) : db.templateVersions.find((v) => db.templates.find((t) => t.id === v.templateId && t.type_code === p.type_code) && v.status === 'approved');
  if (!tv || tv.status !== 'approved') return res.status(422).json({ error: 'no_approved_template', detail: 'seule une version approved peut émettre/créer (US-1.2)' });
  const reference = await allocateReference(dt.family);
  const now = new Date().toISOString();
  const doc = { id: randomUUID(), reference, type_code: p.type_code, family: dt.family, templateVersionId: tv.id, title: p.title, state: 'draft', ownerId: req.user!.id, fields: p.fields, currentRevision: 0, dueAt: p.dueAt ?? null, business: p.business, confidentiality: p.confidentiality ?? defaultConfidentiality(dt.family, dt.defaultConfidentiality), createdAt: now, updatedAt: now };
  db.documents.push(doc);
  const revId = randomUUID();
  db.revisions.push({ id: revId, documentId: doc.id, rev: 0, snapshot: p.fields, changeSummary: 'création', createdBy: req.user!.id, createdAt: now });
  await save();
  await logEvent({ documentId: doc.id, revision: 0, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'created', newState: 'draft' });
  res.status(201).json({ data: doc });
});
app.get('/api/v1/documents/:id', authenticate, requireVisible, (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  res.json({ data: d, revisions: db.revisions.filter((r) => r.documentId === d.id), artifacts: db.artifacts.filter((a) => a.documentId === d.id) });
});
app.patch('/api/v1/documents/:id', authenticate, requireVisible, async (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  // Verrou d'édition (contrôle d'accès) : rôle éditeur requis, et l'auteur n'édite que SES brouillons.
  const perms = setting('permissionMatrix')?.[req.user!.role] ?? [];
  if (req.user!.role !== 'admin' && !perms.includes('edit')) return res.status(403).json({ error: 'forbidden', detail: 'permission d\'édition requise' });
  if (req.user!.role === 'author' && d.ownerId !== req.user!.id) return res.status(403).json({ error: 'forbidden', detail: 'un auteur n\'édite que ses propres documents' });
  if (d.state !== 'draft') return res.status(409).json({ error: 'edit_requires_draft', detail: 'modifiez via revise (changes_requested → draft) ou créez une nouvelle révision en brouillon' });
  const p = z.object({ title: z.string().optional(), fields: z.record(z.any()).optional(), dueAt: z.string().nullable().optional(), business: businessSchema }).parse(req.body);
  const prev = d.currentRevision;
  if (p.title) d.title = p.title;
  if (p.fields) d.fields = { ...d.fields, ...p.fields };
  if (p.dueAt !== undefined) d.dueAt = p.dueAt;
  if (p.business) d.business = { ...d.business, ...p.business };
  d.currentRevision = prev + 1; d.updatedAt = new Date().toISOString();
  db.revisions.push({ id: randomUUID(), documentId: d.id, rev: d.currentRevision, snapshot: d.fields, changeSummary: 'draft_saved', createdBy: req.user!.id, createdAt: new Date().toISOString() });
  await save();
  await logEvent({ documentId: d.id, revision: d.currentRevision, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'draft_saved', prevState: 'draft', newState: 'draft', changeSummary: `rev ${prev} → ${d.currentRevision}` });
  await logEvent({ documentId: d.id, revision: d.currentRevision, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'revision_created', changeSummary: `rev ${d.currentRevision}` });
  res.json({ data: d });
});
app.get('/api/v1/documents/:id/revisions', authenticate, requireVisible, (req, res) => res.json({ data: db.revisions.filter((r) => r.documentId === req.params.id).sort((a, b) => a.rev - b.rev) }));
app.get('/api/v1/documents/:id/audit', authenticate, requireVisible, (req, res) => res.json({ data: timeline(req.params.id) }));

// ---- Builder P2 : schémas, preview, diff, liens, dérivation ----
// Schéma du template ( approved, sinon dernière version ).
app.get('/api/v1/templates/:id/schema', authenticate, (req, res) => {
  const t = db.templates.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  const versions = db.templateVersions.filter((v) => v.templateId === t.id);
  const tv = versions.find((v) => v.status === 'approved') ?? versions[versions.length - 1];
  if (!tv) return res.status(404).json({ error: 'no_version' });
  res.json({ data: buildSchema(t.type_code, tv.version, tv.definition) });
});
// Schéma effectif d'un document (complété par les clés déjà saisies).
app.get('/api/v1/documents/:id/schema', authenticate, requireVisible, (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  const tv = templateOf(d);
  if (!tv) return res.status(404).json({ error: 'no_template' });
  res.json({ data: buildSchema(d.type_code, tv.version, tv.definition, Object.keys(d.fields)) });
});
// Preview structurée sans générer de PDF (US-2.2).
app.get('/api/v1/documents/:id/preview', authenticate, requireVisible, (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  const tv = templateOf(d);
  const schema = buildSchema(d.type_code, tv?.version ?? '?', tv?.definition ?? {}, Object.keys(d.fields));
  const missing = schema.required.filter((k) => d.fields[k] === undefined || d.fields[k] === '' || d.fields[k] == null);
  res.json({ data: { reference: d.reference, title: d.title, type_code: d.type_code, revision: d.currentRevision, state: d.state, blocks: schema.blocks, fields: d.fields, missing, canGenerate: missing.length === 0 } });
});
// Diff entre deux révisions (US-2.3). Défaut : première → dernière.
app.get('/api/v1/documents/:id/diff', authenticate, requireVisible, (req, res) => {
  const revs = db.revisions.filter((r) => r.documentId === req.params.id).sort((a, b) => a.rev - b.rev);
  if (revs.length === 0) return res.status(404).json({ error: 'no_revisions' });
  const from = req.query.from !== undefined ? Number(req.query.from) : revs[0].rev;
  const to = req.query.to !== undefined ? Number(req.query.to) : revs[revs.length - 1].rev;
  const a = revs.find((r) => r.rev === from); const b = revs.find((r) => r.rev === to);
  if (!a || !b) return res.status(404).json({ error: 'revision_not_found' });
  res.json({ data: diffSnapshots(from, a.snapshot, to, b.snapshot) });
});
// Liaisons typées (US-2.4, DCS §12).
app.post('/api/v1/document-links', authenticate, async (req, res) => {
  try {
    const p = z.object({ fromDocumentId: z.string(), toDocumentId: z.string(), link_type: z.string() }).parse(req.body);
    for (const id of [p.fromDocumentId, p.toDocumentId]) {
      const dd = db.documents.find((x) => x.id === id);
      if (!dd || !visibleFor(dd, req.user!)) return res.status(404).json({ error: 'not_found' });
    }
    validateLink(p.fromDocumentId, p.toDocumentId, p.link_type, (id) => db.documents.some((d) => d.id === id));
    if (db.links.some((l) => l.fromDocumentId === p.fromDocumentId && l.toDocumentId === p.toDocumentId && l.link_type === p.link_type))
      return res.status(409).json({ error: 'duplicate_link' });
    const link = { id: randomUUID(), ...p, createdBy: req.user!.id, createdAt: new Date().toISOString() };
    db.links.push(link); await save();
    await logEvent({ documentId: p.fromDocumentId, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'linked', changeSummary: `${p.link_type} → ${p.toDocumentId.slice(0, 8)}` });
    res.status(201).json({ data: link });
  } catch (e: any) { res.status(e.status ?? 500).json({ error: e.message ?? 'link_failed' }); }
});
app.get('/api/v1/documents/:id/links', authenticate, requireVisible, (req, res) => {
  const id = req.params.id;
  const out = db.links.filter((l) => l.fromDocumentId === id).map((l) => ({ ...l, direction: 'out', document: db.documents.find((d) => d.id === l.toDocumentId) }));
  const inn = db.links.filter((l) => l.toDocumentId === id).map((l) => ({ ...l, direction: 'in', document: db.documents.find((d) => d.id === l.fromDocumentId) }));
  res.json({ data: [...out, ...inn], link_types: LINK_TYPES });
});
// Dérivation : nouveau brouillon pré-rempli + lien derives_from (US-2.4).
app.post('/api/v1/documents/:id/derive', authenticate, requireVisible, requireRoles('admin', 'doc_manager', 'author'), async (req, res) => {
  const src = db.documents.find((x) => x.id === req.params.id);
  if (!src || !visibleFor(src, req.user!)) return res.status(404).json({ error: 'not_found' });
  const p = z.object({ type_code: z.string().optional(), title: z.string().optional() }).parse(req.body);
  const type_code = p.type_code ?? src.type_code;
  const dt = db.documentTypes.find((t) => t.type_code === type_code);
  if (!dt) return res.status(400).json({ error: 'unknown_type' });
  if (req.user!.role !== 'admin' && !inDepartmentScope(deptOf(req.user!.id), dt.family, setting('departmentScopes'))) {
    return res.status(403).json({ error: 'out_of_scope', detail: `domaine '${dt.family}' hors du périmètre de votre département` });
  }
  const tv = db.templateVersions.find((v) => db.templates.find((t) => t.id === v.templateId && t.type_code === type_code) && v.status === 'approved');
  if (!tv) return res.status(422).json({ error: 'no_approved_template' });
  const reference = await allocateReference(dt.family);
  const now = new Date().toISOString();
  const doc = { id: randomUUID(), reference, type_code, family: dt.family, templateVersionId: tv.id, title: p.title ?? `${src.title} (dérivé)`, state: 'draft', ownerId: req.user!.id, fields: { ...src.fields }, currentRevision: 0, business: src.business ? { ...src.business } : undefined, createdAt: now, updatedAt: now };
  db.documents.push(doc);
  db.revisions.push({ id: randomUUID(), documentId: doc.id, rev: 0, snapshot: doc.fields, changeSummary: `dérivé de ${src.reference}`, createdBy: req.user!.id, createdAt: now });
  const link = { id: randomUUID(), fromDocumentId: doc.id, toDocumentId: src.id, link_type: 'derives_from', createdBy: req.user!.id, createdAt: now };
  db.links.push(link);
  await save();
  await logEvent({ documentId: doc.id, revision: 0, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'derived', newState: 'draft', changeSummary: `derives_from ${src.reference}` });
  res.status(201).json({ data: doc, link });
});

// ---- Workflow P3 : transitions, signatures, issuance, clôture ----
// Actions possibles pour l'utilisateur courant : filtrées par rôle, matrice, propriétaire et escalades.
app.get('/api/v1/documents/:id/transitions', authenticate, requireVisible, (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  const allowed = new Set(allowedActions(d, req.user!));
  res.json({ data: transitionsFor(d.state, req.user!.role).filter((t: any) => allowed.has(t.action)), state: d.state, workflowKey: workflowKeyFor(d.type_code), steps: stepsFor(d.type_code) });
});
// Exécute une transition (garde-fou : état, rôle, motif, artefact, signature, SoD).
app.post('/api/v1/documents/:id/transition', authenticate, requireVisible, async (req, res) => {
  try {
    const p = z.object({ action: z.string(), reason: z.string().optional(), comment: z.string().optional(), role: z.string().optional(), dueAt: z.string().optional(), successorId: z.string().optional(), signaturePass: z.string().optional() }).parse(req.body);
    const d = (req as any).doc;
    if (!d) return res.status(404).json({ error: 'not_found' });
    // Signature électronique = acte personnel protégé par passphrase (anti-usurpation).
    // Fenêtre glissante de 15 minutes : sans usage depuis 15 min, la passphrase est redemandée.
    if (p.action === 'sign') {
      const u = db.users.find((x) => x.id === req.user!.id);
      if (!u?.signingActivated || !u.signaturePassHash) {
        return res.status(403).json({ error: 'signature_not_activated', detail: 'activez votre signature électronique (nom légal + passphrase) avant de signer' });
      }
      const unlocked = !!u.signatureUnlockedUntil && new Date(u.signatureUnlockedUntil).getTime() > Date.now();
      if (!unlocked) {
        if (!p.signaturePass) return res.status(403).json({ error: 'signature_passphrase_required', detail: 'saisissez votre passphrase pour déverrouiller votre signature' });
        if (!(await checkPassword(p.signaturePass, u.signaturePassHash))) {
          return res.status(403).json({ error: 'signature_passphrase_invalid', detail: 'passphrase incorrecte' });
        }
      }
      u.signatureUnlockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
    }
    const steps = stepsFor(d.type_code); const sigRoles = sigRolesFor(d.type_code);
    const sigs = db.signatures.filter((s) => s.documentId === d.id && s.revision === d.currentRevision);
    const arts = db.artifacts.filter((a) => a.documentId === d.id && a.revision === d.currentRevision && a.isAuthoritative);
    const { to } = resolveTransition(d.state, p.action, {
      role: req.user!.role, roles: req.user!.roles ?? [req.user!.role],
      userId: req.user!.id, isOwner: d.ownerId === req.user!.id,
      reason: p.reason ?? p.comment, roleParam: p.role,
      workflowSteps: steps, signatureRoles: sigRoles,
      hasArtifactOnRevision: arts.length > 0, hasSignature: sigs.length > 0,
      existingSignatures: sigs.map((s) => s.role),
      permissions: effectivePermissions(req.user!.roles ?? [req.user!.role]),
      grantedPermissions: delegatedAuthority(d.id, req.user!.id),
      signatureRequired: !!db.documentTypes.find((t) => t.type_code === d.type_code)?.requires_signature,
    });
    const from = d.state;
    // Échéance (§ cycle de gestion) : celle du demandeur s'applique ; sinon le type
    // en fixe une par défaut (ex : proposition = 30 jours). Le compte à rebours
    // alimente rappels, file À surveiller et escalade automatique.
    if (p.action === 'submit') {
      if (p.dueAt) d.dueAt = p.dueAt;
      else if (!d.dueAt) {
        const days = db.documentTypes.find((t) => t.type_code === d.type_code)?.defaultDueDays ?? 0;
        if (days > 0) d.dueAt = new Date(Date.now() + days * 86400000).toISOString();
      }
    }
    if (p.action === 'sign') {
      const signer = db.users.find((x) => x.id === req.user!.id);
      db.signatures.push({ id: randomUUID(), documentId: d.id, revision: d.currentRevision, role: p.role!, signerId: req.user!.id, artifactHash: arts[0]?.sha256 ?? null, signatureName: signer?.signatureName ?? req.user!.displayName, createdAt: new Date().toISOString() });
    }
    // Émission = document officiel prêt à imprimer (§18-19, §44) : le PDF faisant foi est
    // généré automatiquement s'il manque. Le système gère la mécanique, l'utilisateur décide.
    if (p.action === 'issue' && !arts.length) {
      const tv = templateOf(d);
      if (tv && tv.status === 'approved') {
        validateRequired(d.fields, requiredFor(d));
        // Signatures électroniques de la révision courante : le PDF émis est déjà signé.
        const sigLines = db.signatures
          .filter((s) => s.documentId === d.id && s.revision === d.currentRevision)
          .map((s) => ({
            role: s.role,
            name: s.signatureName ?? db.users.find((u) => u.id === s.signerId)?.displayName ?? 'Signataire',
            date: new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          }));
        const { buffer, sha256 } = await generatePdfBuffer({ reference: d.reference, title: d.title, typeCode: d.type_code, templateVersion: tv.version, fields: d.fields, revision: d.currentRevision, docDate: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), signatureLines: sigLines }, currentBranding(), await brandingLogoBuffer());
        const key = `${d.reference}-rev${d.currentRevision}.pdf`;
        saveArtifactFile(key, buffer);
        db.artifacts.forEach((a) => { if (a.documentId === d.id) a.isAuthoritative = false; });
        db.artifacts.push({ id: randomUUID(), documentId: d.id, revision: d.currentRevision, kind: 'pdf' as const, storageKey: key, sha256, templateVersionId: tv.id, isAuthoritative: true, createdAt: new Date().toISOString() });
        await logEvent({ documentId: d.id, revision: d.currentRevision, actorId: 'system', actorRole: 'system', eventType: 'generated', changeSummary: `PDF officiel généré à l'émission (sha256 ${sha256.slice(0, 12)}…)` });
      }
    }
    d.state = to; d.updatedAt = new Date().toISOString();
    // Assignations accomplies : l'étape confiée a été réalisée (même par quelqu'un d'autre).
    const FULFILLS: Record<string, string[]> = { request_changes: ['review'], approve: ['review', 'approve'], reject: ['review', 'approve'], sign: ['sign'] };
    for (const a of db.assignments.filter((x) => x.documentId === d.id && !x.fulfilledAt && (FULFILLS[p.action] ?? []).includes(x.action))) {
      a.fulfilledAt = new Date().toISOString();
    }
    await save();
    const EVENT: Record<string, string> = { submit: 'submitted_for_review', request_changes: 'changes_requested', revise: 'revision_created', approve: 'approval_granted', reject: 'approval_rejected', generate_final: 'generated', sign: 'signature_completed', issue: 'issued', cancel: 'cancelled', expire: 'expired', revoke: 'revoked', supersede: 'superseded', archive: 'archived' };
    await logEvent({ documentId: d.id, revision: d.currentRevision, actorId: req.user!.id, actorRole: req.user!.role, eventType: EVENT[p.action] ?? p.action, prevState: from, newState: to, reason: p.reason ?? p.comment, changeSummary: p.action === 'sign' ? `rôle ${p.role}` : undefined });
    // Remplacement tracé (US-5.3) : le successeur est lié, l'historique est préservé.
    let successorLink = null;
    if (p.action === 'supersede' && p.successorId) {
      const succ = db.documents.find((x) => x.id === p.successorId);
      if (!succ || succ.id === d.id) {
        const err: any = new Error('successeur invalide'); err.status = 422; throw err;
      }
      successorLink = { id: randomUUID(), fromDocumentId: succ.id, toDocumentId: d.id, link_type: 'supersedes', createdBy: req.user!.id, createdAt: new Date().toISOString() };
      db.links.push(successorLink);
      await save();
    }
    // Notifications (US-3.5) : owner sauf s'il agit + audience de l'étape suivante.
    // Priorité aux personnes ASSIGNÉES : la tâche va à son destinataire nommé,
    // sinon diffusion au rôle (filtrée par périmètre de département).
    const ref = `${d.reference} - ${d.title}`;
    if (d.ownerId !== req.user!.id) await notify(d.id, p.action, `${ref} : ${p.action} par ${req.user!.displayName}`, 'owner');
    const NEXT_AUDIENCE: Record<string, string> = { generate_final: 'role:signer', sign: 'owner', request_changes: 'owner', issue: 'owner' };
    if (NEXT_AUDIENCE[p.action]) await notify(d.id, p.action, `${ref} : action requise (${p.action})`, NEXT_AUDIENCE[p.action]);
    if (p.action === 'submit' || p.action === 'approve') {
      const stage = p.action === 'submit' ? 'review' : 'approve';
      const msgStage = `${ref} : étape ${stage === 'review' ? 'de revue' : 'd\'approbation'} confiée à vous`;
      const assigned = db.assignments.filter((a) => a.documentId === d.id && !a.fulfilledAt && a.action === stage);
      if (assigned.length > 0) {
        for (const a of assigned) {
          const aud = a.target === 'user' ? `user:${a.userId}` : a.target === 'role' ? `role:${a.role}` : a.target === 'department' ? `dept:${a.department}` : null;
          if (aud) await notify(d.id, 'assigned', msgStage, aud);
          else for (const u of db.users.filter((x) => x.isActive && (x.roles ?? [x.role]).includes(a.role!) && x.department === a.department)) {
            await notify(d.id, 'assigned', msgStage, `user:${u.id}`);
          }
        }
      } else if (p.action === 'submit') {
        await notifyRole(d.id, 'assigned', `${ref} : à relire`, 'reviewer');
      } else {
        await notifyRole(d.id, 'assigned', `${ref} : à approuver`, 'approver');
      }
    }
    await dispatch(p.action, d);
    res.json({ data: d, successorLink });
  } catch (e: any) { res.status(e.status ?? 500).json({ error: e.message ?? 'transition_failed' }); }
});
// Signatures enregistrées (US-3.3, preuve §13.5).
app.get('/api/v1/documents/:id/signatures', authenticate, requireVisible, (req, res) => {
  res.json({ data: db.signatures.filter((s) => s.documentId === req.params.id), expected: sigRolesFor(db.documents.find((d) => d.id === req.params.id)?.type_code ?? '') });
});
// Synthèse workflow : état, steps, actions, signatures, historique (vue décision US-4.3/P3).
app.get('/api/v1/documents/:id/workflow', authenticate, requireVisible, async (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  res.json({
    data: {
      state: d.state, workflowKey: workflowKeyFor(d.type_code), steps: stepsFor(d.type_code),
      transitions: (() => { const a = new Set(allowedActions(d, req.user!)); return transitionsFor(d.state, req.user!.role).filter((t: any) => a.has(t.action)); })(),
      signatures: db.signatures.filter((s) => s.documentId === d.id),
      expectedSignatures: sigRolesFor(d.type_code),
      escalations: db.grants.filter((g) => g.documentId === d.id).map((g) => ({ ...g, user: db.users.find((u) => u.id === g.userId)?.displayName ?? '?' })),
      assignments: db.assignments.filter((a) => a.documentId === d.id).map((a) => ({
        ...a,
        targetLabel: assignmentTargetLabel(a),
        byName: db.users.find((u) => u.id === a.assignedBy)?.displayName ?? '—',
      })),
      history: timeline(d.id),
    },
  });
});

// ---- Notifications P3 (US-3.5) ----
app.get('/api/v1/notifications', authenticate, (req, res) => {
  const me = req.user!;
  const myDocs = new Set(db.documents.filter((d) => d.ownerId === me.id).map((d) => d.id));
  const mine = me.roles ?? [me.role];
  const myDept = deptOf(me.id);
  const list = db.notifications.filter((n) =>
    n.audience === 'all'
    || (n.audience.startsWith('role:') && mine.includes(n.audience.slice(5)))
    || n.audience === `user:${me.id}`
    || n.audience === `dept:${myDept}`
    || (n.audience === 'owner' && myDocs.has(n.documentId)));
  const unread = req.query.unread === '1' ? list.filter((n) => !n.read) : list;
  res.json({ data: unread.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), unreadCount: list.filter((n) => !n.read).length });
});
app.post('/api/v1/notifications/:id/read', authenticate, async (req, res) => {
  const n = db.notifications.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'not_found' });
  n.read = true; await save();
  res.json({ ok: true });
});

// Assignés suggérés (US-8.1) : les détenteurs EFFECTIFS de chaque autorité à cette
// étape — pas seulement le rôle portant son nom. Un PDG approbateur+signataire
// apparaît à la signature comme à l'approbation. Filtrés par périmètre de domaine.
app.get('/api/v1/documents/:id/assignees', authenticate, requireVisible, (req, res) => {
  const d = (req as any).doc;
  const scopes = setting('departmentScopes') ?? {};
  const matrix = setting('permissionMatrix') ?? {};
  const holdersOf = (perm: string) => db.users.filter((u) => u.isActive && inDepartmentScope(u.department, d.family, scopes) &&
    effectiveRoles(u).some((r) => (matrix[r] ?? []).includes(perm) || r === 'admin'));
  const map = (arr: any[]) => arr.map((u) => ({ id: u.id, displayName: u.displayName, role: u.role, department: u.department ?? null }));
  res.json({ data: { reviewers: map(holdersOf('review')), approvers: map(holdersOf('approve')), signers: map(holdersOf('sign')) } });
});

// Graphe des relations (vue Relationships) : liens avec références lisibles.
app.get('/api/v1/relationships', authenticate, (req, res) => {
  const docs = new Map(db.documents.filter((d) => visibleFor(d, req.user!)).map((d) => [d.id, d]));
  res.json({
    data: db.links
      .filter((l) => docs.has(l.fromDocumentId) && docs.has(l.toDocumentId))
      .map((l) => ({ ...l, from: docs.get(l.fromDocumentId)!.reference, to: docs.get(l.toDocumentId)!.reference })),
  });
});

// ---- Automation P8 : webhooks, rappels, escalade, transitions auto ----
app.get('/api/v1/webhooks', authenticate, requireRoles('admin', 'doc_manager'), (_req, res) => res.json({ data: db.webhooks }));
app.post('/api/v1/webhooks', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const p = z.object({ url: z.string().url(), events: z.array(z.string()).min(1) }).parse(req.body);
  const w = { id: randomUUID(), url: p.url, events: p.events, active: true, createdBy: req.user!.id, createdAt: new Date().toISOString() };
  db.webhooks.push(w); await save();
  res.status(201).json({ data: w });
});
app.patch('/api/v1/webhooks/:id', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const w = db.webhooks.find((x) => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'not_found' });
  const p = z.object({ active: z.boolean().optional(), events: z.array(z.string()).optional() }).parse(req.body);
  if (p.active !== undefined) w.active = p.active;
  if (p.events) w.events = p.events;
  await save();
  res.json({ data: w });
});
app.delete('/api/v1/webhooks/:id', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const i = db.webhooks.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not_found' });
  db.webhooks.splice(i, 1); await save();
  res.json({ ok: true });
});
app.get('/api/v1/automation/policies', authenticate, (_req, res) => res.json({
  data: { reminderIntervalHours: setting('reminderIntervalHours'), escalationAfterDays: setting('escalationAfterDays'), autoArchiveAfterDays: setting('autoArchiveAfterDays'), certExpiryWarnDays: setting('certExpiryWarnDays') },
}));
// Run : rappels (sans changer l'état), escalade, archivage auto autorisé, certificats proches d'expiration.
app.post('/api/v1/automation/run', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const now = new Date().toISOString();
  let reminded = 0, escalated = 0, archived = 0, expiring = 0;
  for (const d of db.documents) {
    if (needsReminder(d, now)) {
      d.lastReminderAt = now;
      await notify(d.id, 'reminder', `${d.reference} - ${d.title} : en retard`, 'owner');
      reminded++;
    }
    if (needsEscalation(d, now)) {
      for (const u of db.users.filter((u) => (u.role === 'doc_manager' || u.role === 'admin') && u.isActive && inDepartmentScope(u.department, d.family, setting('departmentScopes')))) {
        await notify(d.id, 'escalation', `${d.reference} - ${d.title} : retard de plus de 3 jours`, `user:${u.id}`);
      }
      escalated++;
    }
    if (autoArchiveDue(d, setting('autoArchiveAfterDays'), now)) {
      const from = d.state;
      d.state = 'archived'; d.updatedAt = now;
      await logEvent({ documentId: d.id, revision: d.currentRevision, actorId: 'system', actorRole: 'system', eventType: 'archived', prevState: from, newState: 'archived', changeSummary: 'archivage automatique (politique)' });
      archived++;
    }
  }
  for (const c of db.certificates) {
    if (effectiveStatus(c, now) !== 'valid' || !c.expiresAt) continue;
    const daysLeft = (new Date(c.expiresAt).getTime() - new Date(now).getTime()) / 86400000;
    if (daysLeft <= 30 && daysLeft >= 0) {
      await notify(c.documentId, 'expiry', `Certificat ${c.certificateNo} : expire dans ${Math.ceil(daysLeft)} jours`, 'owner');
      expiring++;
    }
  }
  await save();
  res.json({ data: { reminded, escalated, archived, expiring } });
});

// ---- Preuve P5 : vérification et dossier de preuve (US-5.2, US-5.4) ----
function artifactCheck(a: { storageKey: string; sha256: string }): { ok: boolean; computed: string | null } {
  try {
    const buf = fs.readFileSync(path.join(storageDir(), a.storageKey));
    const computed = createHash('sha256').update(buf).digest('hex');
    return { ok: computed === a.sha256, computed };
  } catch {
    return { ok: false, computed: null };
  }
}
// Chaine d'audit : détecte altération, insertion ou suppression.
app.get('/api/v1/documents/:id/audit/verify', authenticate, requireVisible, (req, res) => {
  if (!db.documents.find((x) => x.id === req.params.id)) return res.status(404).json({ error: 'not_found' });
  res.json({ data: verifyChain(req.params.id) });
});
// Artefact : recalcule le SHA-256 du fichier stocké et compare.
app.get('/api/v1/artifacts/:id/verify', authenticate, (req, res) => {
  const a = db.artifacts.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  res.json({ data: { recorded: a.sha256, ...artifactCheck(a) } });
});
// Dossier de preuve : synthèse §16 exportable (statut, version, owner, signatures,
// liens, artefacts vérifiés, historique complet, état de la chaine).
app.get('/api/v1/documents/:id/record', authenticate, requireVisible, (req, res) => {
  const d = (req as any).doc;
  if (!d) return res.status(404).json({ error: 'not_found' });
  const tv = templateOf(d);
  const owner = db.users.find((u) => u.id === d.ownerId);
  const revs = db.revisions.filter((r) => r.documentId === d.id).sort((a, b) => a.rev - b.rev);
  res.json({
    data: {
      document: { id: d.id, reference: d.reference, type_code: d.type_code, title: d.title, state: d.state, currentRevision: d.currentRevision, dueAt: d.dueAt ?? null },
      owner: owner ? { displayName: owner.displayName, role: owner.role } : null,
      template: tv ? { version: tv.version, status: tv.status } : null,
      snapshot: revs[revs.length - 1]?.snapshot ?? d.fields,
      revisions: revs.length,
      artifacts: db.artifacts.filter((a) => a.documentId === d.id).map((a) => ({ id: a.id, revision: a.revision, kind: a.kind, sha256: a.sha256, isAuthoritative: a.isAuthoritative, fileOk: artifactCheck(a).ok })),
      signatures: db.signatures.filter((s) => s.documentId === d.id),
      expectedSignatures: sigRolesFor(d.type_code),
      links: db.links.filter((l) => l.fromDocumentId === d.id || l.toDocumentId === d.id),
      business: {
        customer: d.business?.customerId ? db.customers.find((c) => c.id === d.business!.customerId) ?? null : null,
        project: d.business?.projectId ? db.projects.find((p) => p.id === d.business!.projectId) ?? null : null,
        services: (d.business?.serviceIds ?? []).map((id: string) => db.services.find((s) => s.id === id)).filter(Boolean),
        transaction: d.business?.transactionId ? db.transactions.find((t) => t.id === d.business!.transactionId) ?? null : null,
      },
      pendingActions: allowedActions(d, req.user!),
      timeline: timeline(d.id),
      verification: verifyChain(d.id),
      exportedAt: new Date().toISOString(),
    },
  });
});

// ---- Certificats P7 : émission, vérification publique, révocation (US-7.1) ----
// Émission : famille CERTIFICATE, document émis, un certificat par document.
app.post('/api/v1/documents/:id/certificate', authenticate, requireVisible, requireRoles('admin', 'doc_manager'), async (req, res) => {
  try {
    const d = (req as any).doc;
    if (d.family !== 'CERTIFICATE') return res.status(422).json({ error: 'not_a_certificate' });
    if (d.state !== 'issued') return res.status(422).json({ error: 'issue_first', detail: 'émettez le document avant le certificat' });
    if (db.certificates.some((c) => c.documentId === d.id)) return res.status(409).json({ error: 'already_certified' });
    const p = z.object({ holderName: z.string(), programTitle: z.string(), expiresAt: z.string().nullable().optional() }).parse(req.body);
    const no = await allocateReference('CERTIFICATE');
    const web = process.env.PUBLIC_WEB ?? 'http://localhost:3000';
    const cert = { id: randomUUID(), certificateNo: no, documentId: d.id, holderName: p.holderName, programTitle: p.programTitle, issuedAt: new Date().toISOString().slice(0, 10), expiresAt: p.expiresAt ?? null, status: 'valid' as const, qrUrl: `${web}/verify/${no}`, issuedBy: req.user!.id, createdAt: new Date().toISOString() };
    db.certificates.push(cert);
    await save();
    await logEvent({ documentId: d.id, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'certificate_issued', changeSummary: no });
    await dispatch('certificate_issued', d);
    res.status(201).json({ data: cert });
  } catch (e: any) { res.status(e.status ?? 500).json({ error: e.message ?? 'certify_failed' }); }
});
app.get('/api/v1/certificates', authenticate, (_req, res) => res.json({ data: db.certificates }));
app.get('/api/v1/certificates/:no', authenticate, (req, res) => {
  const c = db.certificates.find((x) => x.certificateNo === req.params.no);
  if (!c) return res.status(404).json({ error: 'not_found' });
  res.json({ data: { ...c, effectiveStatus: effectiveStatus(c) } });
});
app.post('/api/v1/certificates/:no/revoke', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const c = db.certificates.find((x) => x.certificateNo === req.params.no);
  if (!c) return res.status(404).json({ error: 'not_found' });
  const p = z.object({ reason: z.string() }).parse(req.body);
  c.status = 'revoked';
  await save();
  await logEvent({ documentId: c.documentId, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'certificate_revoked', reason: p.reason, changeSummary: c.certificateNo });
  const cd = db.documents.find((x) => x.id === c.documentId);
  if (cd) await dispatch('certificate_revoked', cd);
  res.json({ data: { ...c, effectiveStatus: effectiveStatus(c) } });
});
// Vérification publique : sans auth, données minimales, jamais d'audit interne (US-7.1).
// ---- Registre public des documents officiels (§34 étendu) : sans authentification ----
// Opt-in explicite : le document est émis ET marqué public par un gestionnaire.
// Les documents confidentiels (RH) et restreints ne figurent jamais, quoi qu'il arrive.
function publicIssued(d: any): boolean {
  return d.state === 'issued' && d.publicRegister === true && ['public', 'internal'].includes(d.confidentiality ?? 'internal');
}
// Publication / retrait du registre public : décision explicente, tracée et notifiée.
app.patch('/api/v1/documents/:id/visibility', authenticate, requireVisible, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const d = (req as any).doc;
  const p = z.object({ publicRegister: z.boolean() }).parse(req.body);
  d.publicRegister = p.publicRegister;
  d.updatedAt = new Date().toISOString();
  await save();
  await logEvent({ documentId: d.id, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'visibility_changed', newState: d.state, changeSummary: p.publicRegister ? 'publié au registre public' : 'retiré du registre public' });
  res.json({ data: { publicRegister: d.publicRegister } });
});
app.get('/api/v1/public/register', (req, res) => {
  const q = ((req.query.q as string) ?? '').toLowerCase();
  const rows = db.documents
    .filter((d) => publicIssued(d) && (!q || (d.reference + ' ' + d.title).toLowerCase().includes(q)))
    .map((d) => {
      const issuedEvt = db.auditEvents.filter((a) => a.documentId === d.id && a.eventType === 'issued').pop();
      const art = db.artifacts.find((a) => a.documentId === d.id && a.isAuthoritative);
      return {
        reference: d.reference, title: d.title, family: d.family, revision: d.currentRevision,
        issuedAt: issuedEvt?.createdAt ?? d.updatedAt,
        integrity: art ? artifactCheck(art).ok : null,
      };
    })
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .slice(0, 200);
  res.json({ data: rows, issuer: currentBranding().companyName });
});
// Vérification publique d'un document émis par sa référence (étend /verification/:no).
app.get('/api/v1/public/documents/:ref', (req, res) => {
  const d = db.documents.find((x) => x.reference.toLowerCase() === String(req.params.ref).toLowerCase());
  if (!d || !publicIssued(d)) return res.status(404).json({ error: 'not_found' });
  const issuedEvt = db.auditEvents.filter((a) => a.documentId === d.id && a.eventType === 'issued').pop();
  const art = db.artifacts.find((a) => a.documentId === d.id && a.isAuthoritative);
  res.json({ data: {
    reference: d.reference, title: d.title, family: d.family, type_code: d.type_code,
    revision: d.currentRevision, issuedAt: issuedEvt?.createdAt ?? d.updatedAt,
    integrity: art ? { verified: artifactCheck(art).ok, sha256: art.sha256.slice(0, 16) + '…' } : null,
    issuer: currentBranding().companyName,
  } });
});

app.get('/api/v1/verification/:no', async (req, res) => {
  const c = db.certificates.find((x) => x.certificateNo === req.params.no);
  if (!c) return res.status(404).json({ data: { status: 'Not Found' } });
  res.json({ data: { certificateNo: c.certificateNo, holderName: c.holderName, programTitle: c.programTitle, issuedAt: c.issuedAt, expiresAt: c.expiresAt, status: effectiveStatus(c), issuer: 'DailyOps.Tech' } });
});

// ---- Artifacts PDF (US-1.4) ----
app.post('/api/v1/artifacts/generate', authenticate, async (req, res) => {
  try {
    const { documentId } = z.object({ documentId: z.string() }).parse(req.body);
    const d = db.documents.find((x) => x.id === documentId);
    if (!d || !visibleFor(d, req.user!)) return res.status(404).json({ error: 'not_found' });
    const tv = db.templateVersions.find((v) => v.id === d.templateVersionId);
    if (!tv || tv.status !== 'approved') return res.status(422).json({ error: 'template_not_approved' });
    validateRequired(d.fields, requiredFor(d));
    const { buffer, sha256 } = await generatePdfBuffer({ reference: d.reference, title: d.title, typeCode: d.type_code, templateVersion: tv.version, fields: d.fields, revision: d.currentRevision, docDate: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }, currentBranding(), await brandingLogoBuffer());
    const key = `${d.reference}-rev${d.currentRevision}.pdf`;
    saveArtifactFile(key, buffer);
    // Un seul artefact faisant foi : les précédents passent à false.
    db.artifacts.forEach((a) => { if (a.documentId === d.id) a.isAuthoritative = false; });
    const art = { id: randomUUID(), documentId: d.id, revision: d.currentRevision, kind: 'pdf' as const, storageKey: key, sha256, templateVersionId: tv.id, isAuthoritative: true, createdAt: new Date().toISOString() };
    db.artifacts.push(art);
    await save();
    await logEvent({ documentId: d.id, revision: d.currentRevision, artifactId: art.id, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'generated', changeSummary: `sha256 ${sha256.slice(0, 12)}…` });
    res.status(201).json({ data: art });
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: e.message ?? 'generate_failed', missing: e.missing });
  }
});
// ---- Bibliothèque & archives (§18-19, §34) : les PDF officiels prêts à imprimer ----
// kind=issued : documents émis (officiels) ; kind=archived : archives conservées.
// Chaque entrée porte l'artefact faisant foi et son état de vérification.
app.get('/api/v1/library', authenticate, (req, res) => {
  const kind = (req.query.kind as string) ?? 'issued';
  const states = kind === 'archived' ? ['archived'] : ['issued'];
  const rows = db.documents
    .filter((d) => visibleFor(d, req.user!) && states.includes(d.state))
    .map((d) => {
      const arts = db.artifacts.filter((a) => a.documentId === d.id);
      const art = arts.find((a) => a.isAuthoritative) ?? arts[arts.length - 1] ?? null;
      const issuedEvt = db.auditEvents.filter((a) => a.documentId === d.id && a.eventType === 'issued').pop();
      const archivedEvt = db.auditEvents.filter((a) => a.documentId === d.id && a.eventType === 'archived').pop();
      return {
        id: d.id, reference: d.reference, title: d.title, type_code: d.type_code, family: d.family,
        state: d.state, revision: d.currentRevision, owner: db.users.find((u) => u.id === d.ownerId)?.displayName ?? '—',
        issuedAt: issuedEvt?.createdAt ?? null, archivedAt: archivedEvt?.createdAt ?? null,
        publicRegister: d.publicRegister ?? false,
        artifact: art ? { id: art.id, revision: art.revision, verified: artifactCheck(art).ok, createdAt: art.createdAt } : null,
      };
    })
    .sort((a, b) => (b.issuedAt ?? b.archivedAt ?? '').localeCompare(a.issuedAt ?? a.archivedAt ?? ''));
  res.json({ data: rows, kind });
});

// ---- Branding documentaire (UI-14) : identité visuelle unique par entreprise ----
// Profil de marque : lu par tous (aucun secret), modifié par admin/gestionnaire.
function currentBranding(): BrandingWithLogo {
  const b = setting('branding');
  return b ? mergeBranding(DEFAULT_BRANDING, b) : { ...DEFAULT_BRANDING };
}
async function brandingLogoBuffer(): Promise<Buffer | null> {
  const key = currentBranding().logoKey;
  if (!key) return null;
  try { return fs.readFileSync(path.join(storageDir(), key)); } catch { return null; }
}
app.get('/api/v1/branding', authenticate, (_req, res) => {
  const b = currentBranding();
  // logoKey reste interne : le client passe par /branding/logo.
  const { logoKey, ...publicProfile } = b;
  res.json({ data: { ...publicProfile, hasLogo: !!logoKey } });
});
app.patch('/api/v1/branding', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const merged = mergeBranding(currentBranding(), req.body);
  const existing = db.settings.find((s) => s.key === 'branding');
  if (existing) existing.value = merged;
  else db.settings.push({ key: 'branding', value: merged, updatedAt: new Date().toISOString() });
  await save();
  await logEvent({ documentId: 'settings', actorId: req.user!.id, actorRole: req.user!.role, eventType: 'settings_changed', changeSummary: 'branding documentaire mis à jour' });
  const { logoKey, ...publicProfile } = merged;
  res.json({ data: { ...publicProfile, hasLogo: !!logoKey } });
});
// Upload du logo (admin/gestionnaire) : PNG/JPEG/WebP, ≤ 2 Mo décodés. Stocké hors DB.
app.post('/api/v1/branding/logo', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const p = z.object({ dataUrl: z.string().min(30) }).parse(req.body);
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(p.dataUrl);
  if (!m) return res.status(422).json({ error: 'invalid_image', detail: 'PNG, JPEG ou WebP attendu' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(422).json({ error: 'too_large', detail: '2 Mo maximum' });
  const ext = m[1].toLowerCase() === 'png' ? 'png' : m[1].toLowerCase() === 'webp' ? 'webp' : 'jpg';
  const key = `branding-logo.${ext}`;
  saveArtifactFile(key, buf);
  const b = currentBranding();
  b.logoKey = key;
  const existing = db.settings.find((s) => s.key === 'branding');
  if (existing) existing.value = b;
  else db.settings.push({ key: 'branding', value: b, updatedAt: new Date().toISOString() });
  await save();
  await logEvent({ documentId: 'settings', actorId: req.user!.id, actorRole: req.user!.role, eventType: 'settings_changed', changeSummary: 'logo documentaire mis à jour' });
  res.json({ data: { ok: true } });
});
app.get('/api/v1/branding/logo', authenticate, (_req, res) => {
  const key = currentBranding().logoKey;
  if (!key) return res.status(404).json({ error: 'no_logo' });
  try {
    const buf = fs.readFileSync(path.join(storageDir(), key));
    res.set('Content-Type', key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    res.send(buf);
  } catch { res.status(404).json({ error: 'no_logo' }); }
});
// Analyse IA d'un modèle uploadé (UI-14) : l'agent observe la structure du document
// (logo, couleurs, en-tête, pied, date, signatures) et la formalise en profil de marque.
// La proposition n'est PAS appliquée : elle est retournée pour décision humaine.
app.post('/api/v1/branding/analyze', authenticate, requireRoles('admin', 'doc_manager'), async (req, res) => {
  const p = z.object({ imageDataUrl: z.string().min(30) }).parse(req.body);
  if (!setting('aiEnabled') || !setting('aiApiKey')) return res.status(409).json({ error: 'ai_disabled', detail: 'activez l\'assistant IA dans l\'administration' });
  const size = Math.floor((p.imageDataUrl.length - (p.imageDataUrl.indexOf(',') + 1)) * 0.75);
  if (size > 4 * 1024 * 1024) return res.status(422).json({ error: 'too_large', detail: 'image ≤ 4 Mo' });
  const base = String(setting('aiBaseUrl') || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const prompt = `Analyse la mise en page de ce document d'entreprise (en-tête, logo, couleurs dominantes, pied de page, position de la date, zone de signature, marges). Produis UNIQUEMENT un JSON valide, sans commentaire, avec exactement ces clés :
{"companyName": string, "tagline": string, "colors": {"primary": "#rrggbb", "accent": "#rrggbb", "text": "#rrggbb"}, "page": {"margin": nombre entre 24 et 90}, "header": {"showLogo": bool, "showCompany": bool, "align": "left"|"right"|"center"}, "footer": {"left": string, "right": string, "showReference": bool}, "address": {"lines": [string]}, "datePosition": "top-right"|"below-header"|"footer", "signatureBlock": {"show": bool, "labels": [string]}}
Si une information n'est pas visible, utilise une valeur neutre cohérente. Le texte du footer.right doit contenir "Page {page}/{pages}" si le document est paginé.`;
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setting('aiApiKey')}` },
      body: JSON.stringify({
        model: setting('aiModel') || 'gpt-4o-mini',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: p.imageDataUrl } },
        ] }],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw new Error(`fournisseur IA indisponible (HTTP ${r.status})`);
    const j: any = await r.json();
    const text: string | undefined = j.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('réponse vide du fournisseur IA');
    const raw = extractJson(text);
    const proposal = sanitizeProposal(raw);
    if (!proposal) throw new Error('structure non reconnue — décrivez la mise en page manuellement ou réessayez avec une image plus nette');
    res.json({ data: { proposal, note: raw?.note } });
  } catch (e: any) { res.status(502).json({ error: 'analyze_failed', detail: e.message }); }
});

// ---- Annuaire (assignation) : répertoire interne minimal, sans PII inutile ----
app.get('/api/v1/users', authenticate, (_req, res) => {
  res.json({ data: db.users.filter((u) => u.isActive).map((u) => ({ id: u.id, displayName: u.displayName, roles: effectiveRoles(u), department: u.department ?? null })) });
});

// ---- Assignation (cycle de vie) : confier une étape à une cible ----
// Le propriétaire (ou un gestionnaire/admin) peut déléguer vers le haut comme vers
// le bas : une personne nommée, un rôle entier, un département entier, un rôle dans
// un département. Il reste propriétaire ; la cible acquiert visibilité + autorité
// de l'étape. Tout est tracé et notifié.
function assignmentTargetLabel(a: any): string {
  switch (a.target) {
    case 'user': return db.users.find((u) => u.id === a.userId)?.displayName ?? '—';
    case 'role': return `Tous les ${a.role === 'reviewer' ? 'relecteurs' : a.role === 'approver' ? 'approbateurs' : a.role === 'signer' ? 'signataires' : a.role}`;
    case 'department': return `Département ${a.department}`;
    case 'role_dept': return `${a.role === 'reviewer' ? 'Relecteurs' : a.role === 'approver' ? 'Approbateurs' : a.role === 'signer' ? 'Signataires' : a.role} — ${a.department}`;
    default: return '—';
  }
}
app.post('/api/v1/documents/:id/assign', authenticate, requireVisible, async (req, res) => {
  const d = (req as any).doc;
  const isOwner = d.ownerId === req.user!.id;
  const isManager = (req.user!.roles ?? [req.user!.role]).some((r) => r === 'admin' || r === 'doc_manager');
  if (!isOwner && !isManager) return res.status(403).json({ error: 'forbidden', detail: 'seul le responsable du document ou un gestionnaire peut assigner' });
  const Parsed = z.object({
    action: z.enum(['review', 'approve', 'sign']), note: z.string().optional(),
    target: z.enum(['user', 'role', 'department', 'role_dept']),
    userId: z.string().optional(), role: z.string().optional(), department: z.string().optional(),
  }).superRefine((t, ctx) => {
    if (t.target === 'user' && !t.userId) ctx.addIssue({ code: 'custom', message: 'personne requise' });
    if (t.target === 'role' && !t.role) ctx.addIssue({ code: 'custom', message: 'rôle requis' });
    if (t.target === 'department' && !t.department) ctx.addIssue({ code: 'custom', message: 'département requis' });
    if (t.target === 'role_dept' && (!t.role || !t.department)) ctx.addIssue({ code: 'custom', message: 'rôle et département requis' });
  });
  const p = Parsed.parse(req.body);
  if (p.target === 'user') {
    const u = db.users.find((x) => x.id === p.userId && x.isActive);
    if (!u) return res.status(404).json({ error: 'user_not_found' });
  }
  if (db.assignments.some((a) => a.documentId === d.id && !a.fulfilledAt && a.action === p.action
    && a.target === p.target && a.userId === p.userId && a.role === p.role && a.department === p.department)) {
    return res.status(409).json({ error: 'already_assigned' });
  }
  const a: any = { id: randomUUID(), documentId: d.id, action: p.action, target: p.target, assignedBy: req.user!.id, note: p.note, createdAt: new Date().toISOString(), fulfilledAt: null };
  if (p.userId) a.userId = p.userId;
  if (p.role) a.role = p.role;
  if (p.department) a.department = p.department;
  db.assignments.push(a); await save();
  const label = assignmentTargetLabel(a);
  await logEvent({ documentId: d.id, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'assigned', changeSummary: `${label} → ${p.action}${p.note ? ` (${p.note})` : ''}` });
  // Notification : la cible reçoit l'étape — personne, rôle, département ou sous-ensemble.
  const stageLabel = p.action === 'review' ? 'de revue' : p.action === 'approve' ? 'd\'approbation' : 'de signature';
  const msg = `${d.reference} - ${d.title} : étape ${stageLabel} confiée à vous${p.note ? ` — ${p.note}` : ''}`;
  if (p.target === 'user') await notify(d.id, 'assigned', msg, `user:${p.userId}`);
  else if (p.target === 'role') await notify(d.id, 'assigned', msg, `role:${p.role}`);
  else if (p.target === 'department') await notify(d.id, 'assigned', msg, `dept:${p.department}`);
  else for (const u of db.users.filter((x) => x.isActive && (x.roles ?? []).includes(p.role!) && x.department === p.department)) await notify(d.id, 'assigned', msg, `user:${u.id}`);
  res.status(201).json({ data: { ...a, targetLabel: label } });
});
app.get('/api/v1/documents/:id/assignments', authenticate, requireVisible, (req, res) => {
  res.json({ data: db.assignments.filter((a) => a.documentId === req.params.id).map((a) => ({
    ...a,
    targetLabel: assignmentTargetLabel(a),
    byName: db.users.find((u) => u.id === a.assignedBy)?.displayName ?? '—',
  })) });
});

app.get('/api/v1/artifacts/:id/download', authenticate, async (req, res) => {
  const a = db.artifacts.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  await logEvent({ documentId: a.documentId, artifactId: a.id, actorId: req.user!.id, actorRole: req.user!.role, eventType: 'downloaded' });
  res.download(path.join(storageDir(), a.storageKey), a.storageKey);
});

// ---- Inbox P4 : items enrichis (quoi ? action ? pourquoi ? échéance ? nouveauté ?) ----
// Chaque item expose : actions possibles pour mon rôle, dernière activité, âge,
// échéance + retard, champs manquants (incomplet), priorité. Tri : retard d'abord, puis ancienneté.
function enrichInbox(docs: any[], user: { id: string; role: string }) {
  const now = new Date().toISOString();
  return docs.map((d) => {
    const last = db.auditEvents.filter((a) => a.documentId === d.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
    const overdue = isOverdue(d.dueAt, d.state, now);
    const missing = requiredFor(d).filter((k) => d.fields[k] === undefined || d.fields[k] === '' || d.fields[k] == null);
    return {
      ...d,
      owner: db.users.find((u) => u.id === d.ownerId)?.displayName ?? null,
      customer: d.business?.customerId ? db.customers.find((c) => c.id === d.business!.customerId)?.name ?? null : null,
      project: d.business?.projectId ? db.projects.find((p) => p.id === d.business!.projectId)?.title ?? null : null,
      pendingActions: allowedActions(d, user),
      assignedToYou: !!(db.users.find((u) => u.id === user.id)
        && db.assignments.some((a) => a.documentId === d.id && !a.fulfilledAt && assignmentMatches(a, db.users.find((u) => u.id === user.id)!))),
      lastActivity: last ? { eventType: last.eventType, actorRole: last.actorRole, actorName: last.actorRole === 'system' ? 'Système' : db.users.find((u) => u.id === last.actorId)?.displayName ?? null, at: last.createdAt, reason: last.reason } : null,
      ageDays: Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000),
      overdue, missing, incomplete: missing.length > 0,
      priority: priorityOf({ overdue, state: d.state }),
    };
  }).sort((a, b) => {
    const rank: Record<string, number> = { overdue: 0, high: 1, normal: 2 };
    return rank[a.priority] - rank[b.priority] || a.createdAt.localeCompare(b.createdAt);
  });
}
// Sections Inbox (UI-09, spec §21) : À faire / À surveiller / Terminé.
// Chaque section a sa file agrégée + ses files fines (compteurs côté /counters).
const TODO_STATES = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed'];
app.get('/api/v1/inbox', authenticate, (req, res) => {
  const queue = (req.query.queue as string) ?? 'todo';
  let list = db.documents.filter((d) => visibleFor(d, req.user!));
  if (queue === 'todo') list = list.filter((d) => TODO_STATES.includes(d.state));
  if (queue === 'watch') list = list.filter((d) => isExpiring(d.dueAt, d.state) || isOverdue(d.dueAt, d.state) || requiredFor(d).some((k) => d.fields[k] === undefined || d.fields[k] === '' || d.fields[k] == null) || d.state === 'rejected');
  if (queue === 'done') list = list.filter((d) => d.state === 'issued' || d.state === 'archived');
  if (queue === 'mine') list = list.filter((d) => d.ownerId === req.user!.id && d.state === 'draft');
  if (queue === 'all') list = list;
  if (queue === 'review') list = list.filter((d) => d.state === 'in_review');
  if (queue === 'approve') list = list.filter((d) => d.state === 'approved');
  if (queue === 'sign') list = list.filter((d) => d.state === 'ready_to_sign' || d.state === 'signed');
  if (queue === 'changes') list = list.filter((d) => d.state === 'changes_requested');
  if (queue === 'completed') list = list.filter((d) => d.state === 'issued' || d.state === 'archived');
  if (queue === 'expiring') list = list.filter((d) => isExpiring(d.dueAt, d.state));
  if (queue === 'exceptions') list = list.filter((d) => {
    const overdue = isOverdue(d.dueAt, d.state);
    const missing = requiredFor(d).filter((k) => d.fields[k] === undefined || d.fields[k] === '' || d.fields[k] == null);
    return overdue || missing.length > 0 || d.state === 'rejected';
  });
  if (queue === 'issued') list = list.filter((d) => d.state === 'issued');
  if (queue === 'archived') list = list.filter((d) => d.state === 'archived');
  res.json({ data: enrichInbox(list, req.user!), queue });
});
app.get('/api/v1/inbox/counters', authenticate, (req, res) => {
  const vis = db.documents.filter((d) => visibleFor(d, req.user!));
  const isExc = (d: any) => isOverdue(d.dueAt, d.state) || requiredFor(d).some((k) => d.fields[k] === undefined || d.fields[k] === '' || d.fields[k] == null) || d.state === 'rejected';
  const mine = vis.filter((d) => d.ownerId === req.user!.id && d.state === 'draft').length;
  res.json({
    drafts: mine,
    review: vis.filter((d) => d.state === 'in_review').length,
    approve: vis.filter((d) => d.state === 'approved').length,
    sign: vis.filter((d) => d.state === 'ready_to_sign' || d.state === 'signed').length,
    changes: vis.filter((d) => d.state === 'changes_requested').length,
    expiring: vis.filter((d) => isExpiring(d.dueAt, d.state)).length,
    exceptions: vis.filter(isExc).length,
    issued: vis.filter((d) => d.state === 'issued').length,
    archived: vis.filter((d) => d.state === 'archived').length,
    total: vis.length,
    // Compteurs de sections (UI-09) : À faire / À surveiller / Terminé.
    todo: vis.filter((d) => TODO_STATES.includes(d.state)).length,
    watch: vis.filter((d) => isExpiring(d.dueAt, d.state) || isExc(d)).length,
    done: vis.filter((d) => d.state === 'issued' || d.state === 'archived').length,
  });
});

// ---- Audit (US-1.6, append-only : lecture seule) ----
app.get('/api/v1/audit-events', authenticate, (req, res) => {
  const { documentId } = req.query as Record<string, string>;
  if (documentId) return res.json({ data: timeline(documentId) });
  // Flux global : événements bruts enrichis du nom de l'acteur (lisible, pas de rôle technique).
  res.json({ data: db.auditEvents.slice(-200).map((a) => ({ ...a, actorName: a.actorRole === 'system' || a.actorId === 'system' ? 'Système' : db.users.find((u) => u.id === a.actorId)?.displayName })) });
});

// Erreurs de validation : 422 JSON structuré partout, jamais de 500 HTML.
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err?.name === 'ZodError') return res.status(422).json({ error: 'validation', issues: err.issues });
  res.status(500).json({ error: 'internal' });
});

export async function boot() {
  await seedAll();
  // Sécurité au repos : chiffre les secrets historiquement stockés en clair (une fois).
  if (migrateSecretsAtRest(db.settings as any).length > 0) await save();
}
