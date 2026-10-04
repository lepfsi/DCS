import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db, save, repoRoot } from './store';
import { seedUsers } from './auth';
import { DEFAULT_MATRIX } from './workflow';
import { DEFAULT_BRANDING } from './branding';

// Définitions démo : la source de vérité des formulaires dynamiques (P2).
const DEMO: Record<string, { name: string; status: 'approved' | 'draft'; definition: any }> = {
  'DO-OFF-LETTER': { name: 'Official Letter v1', status: 'approved', definition: { blocks: ['header', 'metadata', 'address', 'subject', 'body', 'signature'], required: ['recipient', 'subject', 'body'], fields: [
    { key: 'recipient', label: 'Destinataire', type: 'text', required: true },
    { key: 'subject', label: 'Objet', type: 'text', required: true },
    { key: 'body', label: 'Contenu', type: 'textarea', required: true },
    { key: 'sender', label: 'Expéditeur', type: 'text', required: false },
    { key: 'letter_date', label: 'Date', type: 'date', required: false }] } },
  'DO-BIZ-PROPOSAL': { name: 'Service Proposal v1', status: 'approved', definition: { blocks: ['header', 'commercial_table', 'clauses', 'signature'], required: ['client', 'scope', 'fees'], fields: [
    { key: 'client', label: 'Client', type: 'text', required: true },
    { key: 'scope', label: 'Périmètre', type: 'textarea', required: true },
    { key: 'fees', label: 'Honoraires (XAF)', type: 'currency', required: true },
    { key: 'validity', label: 'Validité', type: 'date', required: false },
    { key: 'payment_terms', label: 'Conditions de paiement', type: 'text', required: false }] } },
  'DO-LEG-NDA': { name: 'NDA v1', status: 'draft', definition: { blocks: ['header', 'clauses', 'legal_signature'], required: ['party_a', 'party_b', 'purpose'], fields: [
    { key: 'party_a', label: 'Partie A', type: 'text', required: true },
    { key: 'party_b', label: 'Partie B', type: 'text', required: true },
    { key: 'purpose', label: 'Objet', type: 'textarea', required: true }] } },
  'DO-HR-WORK-CERT': { name: 'Work Certificate v1', status: 'approved', definition: { blocks: ['header', 'body', 'signature'], required: ['employee', 'subject', 'body'], fields: [
    { key: 'employee', label: 'Employé', type: 'text', required: true },
    { key: 'subject', label: 'Objet', type: 'text', required: true },
    { key: 'body', label: 'Contenu', type: 'textarea', required: true }] } },
  'DO-FIN-RECEIPT': { name: 'Receipt v1', status: 'approved', definition: { blocks: ['header', 'payment_table', 'signature'], required: ['client', 'amount'], fields: [
    { key: 'client', label: 'Client', type: 'text', required: true },
    { key: 'amount', label: 'Montant (XAF)', type: 'currency', required: true },
    { key: 'payment_date', label: 'Date de paiement', type: 'date', required: false },
    { key: 'method', label: 'Moyen de paiement', type: 'text', required: false }] } },
};

// Données métier démo (P6) : juste de quoi exécuter des documents, pas un CRM.
async function seedBusiness() {
  if (db.customers.length > 0) return;
  const now = new Date().toISOString();
  const c1 = randomUUID(); const c2 = randomUUID();
  db.customers.push(
    { id: c1, name: 'Acme Cameroun', address: 'Bonanjo, Douala', taxId: 'M0000123456A', email: 'contact@acme.cm', phone: '+237 233 00 00 00', createdAt: now },
    { id: c2, name: 'Groupe Sahel Services', address: 'Bastos, Yaoundé', email: 'info@sahelservices.cm', createdAt: now },
  );
  db.people.push(
    { id: randomUUID(), fullName: 'J. Fotso', title: 'DAF', email: 'j.fotso@acme.cm', customerId: c1, createdAt: now },
    { id: randomUUID(), fullName: 'M. Diallo', title: 'DG', email: 'm.diallo@sahelservices.cm', customerId: c2, createdAt: now },
  );
  db.employees.push(
    { id: randomUUID(), fullName: 'S. Mbarga', title: 'Directeur', email: 's.mbarga@dailyops.tech', createdAt: now },
    { id: randomUUID(), fullName: 'A. Nkomo', title: 'Consultante', email: 'a.nkomo@dailyops.tech', createdAt: now },
  );
  db.projects.push(
    { id: randomUUID(), title: 'Refonte SI', code: 'PRJ-001', customerId: c1, status: 'active', createdAt: now },
    { id: randomUUID(), title: 'Audit 2026', code: 'PRJ-002', customerId: c2, status: 'active', createdAt: now },
  );
  db.services.push(
    { id: randomUUID(), name: 'Audit technique', unitPrice: 750000, currency: 'XAF', description: 'Audit complet', createdAt: now },
    { id: randomUUID(), name: 'Accompagnement MOA', unitPrice: 450000, currency: 'XAF', createdAt: now },
    { id: randomUUID(), name: 'Formation', unitPrice: 250000, currency: 'XAF', createdAt: now },
  );
  await save();
}

const SETTING_SEED: Record<string, any> = {
  autoArchiveAfterDays: 0, reminderIntervalHours: 24, escalationAfterDays: 3, certExpiryWarnDays: 30,
  permissionMatrix: DEFAULT_MATRIX, departmentScopes: {},
  branding: DEFAULT_BRANDING,
  smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPass: '', smtpFrom: '',
  aiEnabled: false, aiApiKey: '', aiBaseUrl: '', aiModel: '',
};

// Seed : types (upsert) + templates démo + brouillons pour les 52 types + politiques.
export async function seedAll() {
  await seedUsers();
  const cat = JSON.parse(fs.readFileSync(path.join(repoRoot(), 'templates', 'catalogue.json'), 'utf-8'));
  for (const t of cat.types) {
    const existing = db.documentTypes.find((x) => x.type_code === t.type_code);
    if (!existing) {
      db.documentTypes.push({ type_code: t.type_code, family: t.family, label: t.label, workflow_key: t.workflow_key, signature_roles: t.signature_roles, outputs: t.outputs, defaultConfidentiality: t.defaultConfidentiality });
    } else if (t.defaultConfidentiality && !existing.defaultConfidentiality) {
      existing.defaultConfidentiality = t.defaultConfidentiality;
    }
  }
  const owner = db.users.find((u) => u.role === 'admin') ?? db.users[0];
  for (const [type_code, demo] of Object.entries(DEMO)) {
    let tpl = db.templates.find((t) => t.type_code === type_code);
    if (!tpl) {
      const tId = randomUUID(); const vId = randomUUID();
      db.templates.push({ id: tId, type_code, name: demo.name, ownerId: owner.id, createdAt: new Date().toISOString() });
      db.templateVersions.push({ id: vId, templateId: tId, version: '1.0', status: demo.status, definition: demo.definition, publishedAt: demo.status === 'approved' ? new Date().toISOString() : undefined });
    } else {
      // Backfill : versions sans fields reçoivent la définition démo à jour.
      for (const v of db.templateVersions.filter((v) => v.templateId === tpl!.id)) {
        if (!Array.isArray((v.definition as any)?.fields)) v.definition = demo.definition;
      }
    }
  }
  await seedBusiness();
  for (const [k, v] of Object.entries(SETTING_SEED)) {
    if (!db.settings.find((s) => s.key === k)) db.settings.push({ key: k, value: v, updatedAt: new Date().toISOString() });
  }
  // Aucune impasse : chaque type du catalogue a au moins un brouillon à compléter puis publier.
  for (const t of cat.types) {
    if (!db.templates.find((x) => x.type_code === t.type_code)) {
      const tId = randomUUID(); const vId = randomUUID();
      db.templates.push({ id: tId, type_code: t.type_code, name: `${t.label} v1`, ownerId: owner.id, createdAt: new Date().toISOString() });
      db.templateVersions.push({ id: vId, templateId: tId, version: '1.0', status: 'draft', definition: { blocks: [], required: [], fields: [] } });
    }
  }
  await save();
}
