import fs from 'fs';
import path from 'path';
import { GENESIS, eventChainHash } from './chain';
import type { Customer, Person, Employee, Project, Service, Transaction, Certificate } from './business';
import type { Webhook } from './automation';

// Signature électronique (anti-usurpation) : activée par son propre titulaire avec
// un passphrase. La fenêtre de déverrouillage glisse à chaque usage (15 minutes).
export interface User { id: string; email: string; displayName: string; role: string; roles?: string[]; department?: string; passwordHash: string; isActive: boolean; signatureName?: string; signingActivated?: boolean; signaturePassHash?: string; signatureUnlockedUntil?: string; }
export interface DocumentType { type_code: string; family: string; label: string; workflow_key: string; signature_roles: string[]; outputs: string[]; defaultConfidentiality?: string; defaultDueDays?: number; requires_signature?: boolean; }
export interface Template { id: string; type_code: string; name: string; ownerId: string; createdAt: string; }
export interface TemplateVersion { id: string; templateId: string; version: string; status: 'draft' | 'approved' | 'retired'; definition: any; publishedAt?: string; }
export interface Setting { key: string; value: any; updatedAt: string; }
export interface DocBusiness { customerId?: string; projectId?: string; serviceIds?: string[]; transactionId?: string; }
export interface Document { id: string; reference: string; type_code: string; family: string; templateVersionId: string; title: string; state: string; ownerId: string; fields: Record<string, any>; currentRevision: number; dueAt?: string | null; lastReminderAt?: string | null; business?: DocBusiness; confidentiality?: string; publicRegister?: boolean; createdAt: string; updatedAt: string; }
export interface Revision { id: string; documentId: string; rev: number; snapshot: Record<string, any>; changeSummary?: string; createdBy: string; createdAt: string; }
export interface Artifact { id: string; documentId: string; revision: number; kind: 'pdf'; storageKey: string; sha256: string; templateVersionId: string; isAuthoritative: boolean; createdAt: string; }
export interface AuditEvent { id: string; documentId: string; revision?: number; artifactId?: string; actorId: string; actorRole: string; eventType: string; prevState?: string; newState?: string; changeSummary?: string; reason?: string; chain: string; createdAt: string; }

export interface DocLink { id: string; fromDocumentId: string; toDocumentId: string; link_type: string; createdBy: string; createdAt: string; }
export interface DocSignature { id: string; documentId: string; revision: number; role: string; signerId: string; artifactHash: string | null; signatureName?: string; createdAt: string; }
export interface Notification { id: string; documentId: string; kind: string; message: string; audience: string; read: boolean; createdAt: string; }
// Escalade ponctuelle (top management) : autorité accordée sur UN document précis.
export interface DocGrant { id: string; documentId: string; userId: string; permission: 'review' | 'approve' | 'sign'; grantedBy: string; note?: string; createdAt: string; }
// Assignation explicite : confier une étape du cycle à une CIBLE — une personne,
// un rôle (tous ses détenteurs), un département entier, ou un rôle dans un département.
// Le créateur reste propriétaire ; la cible acquiert visibilité + autorité de l'étape.
export type AssignTarget = 'user' | 'role' | 'department' | 'role_dept';
export interface DocAssignment {
  id: string; documentId: string; action: 'review' | 'approve' | 'sign';
  target: AssignTarget;
  userId?: string;        // cible : la personne
  role?: string;          // cible : le rôle (et filtre pour role_dept)
  department?: string;    // cible : le département (et filtre pour role_dept)
  assignedBy: string; note?: string; createdAt: string; fulfilledAt?: string | null;
}

export interface DB {
  users: User[];
  documentTypes: DocumentType[];
  templates: Template[];
  templateVersions: TemplateVersion[];
  documents: Document[];
  revisions: Revision[];
  artifacts: Artifact[];
  auditEvents: AuditEvent[];
  links: DocLink[];
  signatures: DocSignature[];
  grants: DocGrant[];
  assignments: DocAssignment[];
  notifications: Notification[];
  customers: Customer[];
  people: Person[];
  employees: Employee[];
  projects: Project[];
  services: Service[];
  transactions: Transaction[];
  certificates: Certificate[];
  webhooks: Webhook[];
  settings: Setting[];
  sequences: Record<string, number>;
}

// Racine repo = ancêtre contenant templates/catalogue.json (robuste src/ comme dist/).
export function repoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'templates', 'catalogue.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('repo root introuvable (templates/catalogue.json)');
}
// Dossier apps/api quel que soit __dirname (src/ ou dist/src/).
export function apiDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('apps/api introuvable (package.json)');
}
export function storageDir(): string {
  const d = path.join(apiDir(), 'storage');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const DB_PATH = path.join(apiDir(), 'data', 'db.json');

const emptyDB: DB = { users: [], documentTypes: [], templates: [], templateVersions: [], documents: [], revisions: [], artifacts: [], auditEvents: [], links: [], signatures: [], grants: [], assignments: [], notifications: [], customers: [], people: [], employees: [], projects: [], services: [], transactions: [], certificates: [], webhooks: [], settings: [], sequences: {} };

export const db: DB = load();

function load(): DB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      // Backfill pour bases créées avant l'ajout d'une collection (ex. links en P2).
      for (const [k, v] of Object.entries(emptyDB)) if (!(k in parsed)) parsed[k] = JSON.parse(JSON.stringify(v));
      // Migration assignations v1 → v2 : la personne nommée devient une cible 'user'.
      if (Array.isArray(parsed.assignments)) {
        for (const a of parsed.assignments as any[]) {
          if (!a.target && a.assigneeId) { a.target = 'user'; a.userId = a.assigneeId; delete a.assigneeId; }
        }
      }
      // Migration P5 : scelle les événements antérieurs à la chaine d'intégrité, dans l'ordre.
      if (parsed.auditEvents.some((e: any) => !e.chain)) {
        const prevByDoc: Record<string, string> = {};
        for (const evt of parsed.auditEvents) {
          if (!evt.chain) {
            const prev = prevByDoc[evt.documentId] ?? GENESIS;
            const { chain, ...content } = evt;
            evt.chain = eventChainHash(prev, content);
          }
          prevByDoc[evt.documentId] = evt.chain;
        }
      }
      return parsed;
    }
  } catch { /* corrupt -> reset */ }
  return JSON.parse(JSON.stringify(emptyDB));
}

let saveChain: Promise<void> = Promise.resolve();
export function save(): Promise<void> {
  saveChain = saveChain.then(() => {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  });
  return saveChain;
}

// Mutex générique pour sections critiques (numérotation) - simule SELECT ... FOR UPDATE (P1 dev file-based).
// En Postgres prod : SELECT ... FOR UPDATE sur numbering_sequences.
let lock: Promise<void> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const run = lock.then(fn);
  lock = run.then(() => undefined, () => undefined);
  return run;
}
