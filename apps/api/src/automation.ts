// Automatisation P8 (DCS §8, §19) : le système exécute le déterministe.
// Règles : routage par rôles, rappels sans changement d'état, transitions auto
// uniquement si la politique l'autorise, webhooks si utiles (DCS §18).

export interface Webhook { id: string; url: string; events: string[]; active: boolean; createdBy: string; createdAt: string; }

// Rappel : doc actif en retard, pas rappelé depuis 24h.
export function needsReminder(doc: { dueAt?: string | null; state: string; lastReminderAt?: string | null }, nowIso: string): boolean {
  const ACTIVE = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed'];
  if (!ACTIVE.includes(doc.state)) return false;
  if (!doc.dueAt || doc.dueAt >= nowIso) return false;
  if (!doc.lastReminderAt) return true;
  return doc.lastReminderAt <= dayBefore(nowIso);
}

function dayBefore(nowIso: string): string {
  return new Date(new Date(nowIso).getTime() - 86400000).toISOString();
}

// Escalade : retard de plus de 3 jours remonte vers doc_manager et admin.
export function needsEscalation(doc: { dueAt?: string | null; state: string }, nowIso: string): boolean {
  if (!doc.dueAt) return false;
  const ACTIVE = ['in_review', 'approved', 'ready_to_sign', 'signed'];
  if (!ACTIVE.includes(doc.state)) return false;
  return new Date(doc.dueAt).getTime() < new Date(nowIso).getTime() - 3 * 86400000;
}

// Archivage auto : émis depuis plus de N jours, politique désactivée par défaut (0).
export function autoArchiveDue(doc: { state: string; updatedAt: string }, days: number, nowIso: string): boolean {
  if (days <= 0 || doc.state !== 'issued') return false;
  return new Date(doc.updatedAt).getTime() < new Date(nowIso).getTime() - days * 86400000;
}

export function webhookPayload(event: string, doc: { id: string; reference: string; type_code: string; state: string }): object {
  return { event, documentId: doc.id, reference: doc.reference, type_code: doc.type_code, state: doc.state, at: new Date().toISOString() };
}
