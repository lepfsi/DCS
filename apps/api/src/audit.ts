import { randomUUID } from 'crypto';
import { db, save } from './store';
import { GENESIS, eventChainHash } from './chain';

// Append-only : seule fonction d'écriture. Aucun update/delete exposé (US-1.6).
// Chaine d'intégrité (US-5.2) : chaque événement porte chain = sha256(prevChain + contenu).
// Toute modification ou suppression d'un maillon casse la vérification.
export async function logEvent(e: {
  documentId: string; revision?: number; artifactId?: string;
  actorId: string; actorRole: string; eventType: string;
  prevState?: string; newState?: string; changeSummary?: string; reason?: string;
}) {
  const prev = timeline(e.documentId).slice(-1)[0]?.chain ?? GENESIS;
  const evt = { id: randomUUID(), createdAt: new Date().toISOString(), ...e };
  const chain = eventChainHash(prev, evt);
  const full = { ...evt, chain };
  db.auditEvents.push(full as any);
  await save();
  return full;
}

// Journal lisible : chaque événement porte le NOM de son acteur (l'historique
// parle de personnes, pas de rôles techniques). L'enrichissement se fait à la
// lecture uniquement — le hachage de la chaîne porte sur l'événement brut.
function actorNameOf(actorId: string, actorRole: string): string | undefined {
  if (actorRole === 'system' || actorId === 'system') return 'Système';
  return db.users.find((u) => u.id === actorId)?.displayName;
}

export function timeline(documentId: string) {
  return db.auditEvents
    .filter((a) => a.documentId === documentId)
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
    .map((a) => ({ ...a, actorName: actorNameOf(a.actorId, a.actorRole) }));
}

// Revérifie la chaine : détecte altération, insertion ou suppression.
// Lit les événements BRUTS (sans enrichissement) : le hachage couvre le contenu stocké.
export function verifyChain(documentId: string): { ok: boolean; count: number; brokenAt?: string } {
  const events = db.auditEvents.filter((a) => a.documentId === documentId).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  let prev = GENESIS;
  for (const evt of events) {
    const { chain, ...content } = evt as any;
    if (eventChainHash(prev, content) !== chain) return { ok: false, count: events.length, brokenAt: (evt as any).id };
    prev = chain;
  }
  return { ok: true, count: events.length };
}
