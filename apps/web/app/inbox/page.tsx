'use client';
import { useEffect, useState } from 'react';
import { CircleCheck, Eye, CheckCircle2, FileSignature } from 'lucide-react';
import { api } from '@/lib/api';
import Pager, { paginate } from '../pager';
import { StateBadge } from '@/components/ui';
import { actionLabel, eventLabel, fmtDate } from '@/lib/ui';

// Boîte de travail (UI-09, spec §21) : trois sections, files fines, cartes riches.
// Chaque carte répond à : quel document, quel état, quelle action attendue,
// quelle échéance, quel contexte, pourquoi — et l'action principale en un clic.

const SECTIONS = [
  {
    key: 'todo', label: 'À faire', Icon: CircleCheck,
    hint: 'Documents qui attendent une action de votre part.',
    queues: [
      { key: 'todo', label: 'Tout', counter: 'todo' },
      { key: 'mine', label: 'Mes brouillons', counter: 'drafts' },
      { key: 'review', label: 'À revoir', counter: 'review' },
      { key: 'approve', label: 'À approuver', counter: 'approve' },
      { key: 'sign', label: 'À signer', counter: 'sign' },
      { key: 'changes', label: 'Modifications demandées', counter: 'changes' },
    ],
  },
  {
    key: 'watch', label: 'À surveiller', Icon: Eye,
    hint: 'Échéances proches et exceptions qui méritent votre vigilance.',
    queues: [
      { key: 'watch', label: 'Tout', counter: 'watch' },
      { key: 'expiring', label: 'Échéances proches', counter: 'expiring' },
      { key: 'exceptions', label: 'Exceptions', counter: 'exceptions' },
    ],
  },
  {
    key: 'done', label: 'Terminé', Icon: CheckCircle2,
    hint: 'Documents émis ou archivés — consultables avec leur preuve.',
    queues: [
      { key: 'done', label: 'Tout', counter: 'done' },
      { key: 'issued', label: 'Récemment émis', counter: 'issued' },
      { key: 'archived', label: 'Archivés', counter: 'archived' },
    ],
  },
];

// Action attendue par état (§20 : toujours séparer état du document et action attendue).
const EXPECTED: Record<string, string> = {
  draft: 'À finaliser', in_review: 'Relecture attendue', changes_requested: 'Corrections attendues',
  approved: 'Document final à préparer', ready_to_sign: 'Signature attendue', signed: 'Émission attendue',
};

const EMPTY_HINT: Record<string, string> = {
  todo: 'Aucun document n\'attend votre action. Tout est à jour.',
  mine: 'Aucun brouillon en cours de votre part.',
  review: 'Aucun document à relire.',
  approve: 'Aucun document n\'attend votre approbation.',
  sign: 'Aucun document n\'attend votre signature.',
  changes: 'Aucune modification demandée en cours.',
  watch: 'Aucune échéance proche ni exception. Tout est sous contrôle.',
  expiring: 'Aucune échéance proche.',
  exceptions: 'Aucune exception détectée.',
  done: 'Aucun document émis ni archivé pour l\'instant.',
  issued: 'Aucun document émis pour l\'instant.',
  archived: 'Aucune archive pour l\'instant.',
};

// File → section (liens profonds depuis l'Accueil : /inbox?section=…&queue=…).
const QUEUE_SECTION: Record<string, string> = {
  todo: 'todo', watch: 'watch', done: 'done',
  mine: 'todo', review: 'todo', approve: 'todo', sign: 'todo', changes: 'todo',
  expiring: 'watch', exceptions: 'watch',
  issued: 'done', archived: 'done',
};

export default function InboxPage() {
  const [counters, setCounters] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [section, setSection] = useState('todo');
  const [queue, setQueue] = useState('todo');
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [err, setErr] = useState('');

  function refreshCounters() {
    api('/inbox/counters').then(setCounters).catch(() => {});
  }
  function loadQueue(q: string) {
    setQueue(q); setOpen(null); setPage(0); setErr('');
    api(`/inbox?queue=${q}`).then((r) => setDocs(r.data)).catch((e) => setErr(String(e.message)));
  }
  function loadSection(s: string) {
    setSection(s);
    loadQueue(s); // « Tout » de la section = la file agrégée correspondante.
    refreshCounters();
  }
  useEffect(() => {
    // Ouverture sur la section/file demandée (liens profonds de l'Accueil et de l'Overview).
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('queue');
    const sec = sp.get('section');
    refreshCounters();
    if (q && QUEUE_SECTION[q]) {
      setSection(QUEUE_SECTION[q]);
      setQueue(q);
      api(`/inbox?queue=${q}`).then((r) => setDocs(r.data)).catch((e) => setErr(String(e.message)));
    } else if (sec && SECTIONS.some((s) => s.key === sec)) {
      setSection(sec);
      api(`/inbox?queue=${sec}`).then((r) => setDocs(r.data)).catch((e) => setErr(String(e.message)));
    } else {
      loadSection('todo');
    }
  }, []);

  const S = SECTIONS.find((s) => s.key === section)!;

  function dueLabel(d: any): { text: string; danger: boolean } | null {
    if (!d.dueAt) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (d.overdue) return { text: `en retard depuis le ${fmtDate(d.dueAt)}`, danger: true };
    if (d.dueAt.slice(0, 10) === today) return { text: 'échéance aujourd\'hui', danger: true };
    return { text: `échéance le ${fmtDate(d.dueAt)}`, danger: false };
  }

  function primaryAction(d: any): { label: string; href: string } {
    const first = (d.pendingActions ?? [])[0];
    if (first === 'approve' || first === 'reject') return { label: 'Ouvrir l\'approbation', href: `/documents/${d.id}/approve` };
    if (first === 'request_changes') return { label: 'Ouvrir la revue', href: `/documents/${d.id}/review` };
    if (first === 'sign') return { label: 'Signer le document', href: `/documents/${d.id}` };
    if (first === 'revise') return { label: 'Reprendre les corrections', href: `/documents/${d.id}` };
    return { label: 'Ouvrir le document', href: `/documents/${d.id}` };
  }

  return (
    <div>
      <h1>Boîte de traitement</h1>
      <p className="subtitle">{S.hint}</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}

      {/* Sections (§21) : À faire / À surveiller / Terminé, avec compteurs. */}
      <div className="tabs">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => loadSection(s.key)} className={'tab' + (section === s.key ? ' active' : '')}>
            <s.Icon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{s.label} ({counters ? counters[s.key] ?? 0 : '—'})
          </button>
        ))}
      </div>

      {/* Files fines de la section. */}
      <div className="tabs" style={{ marginTop: 0 }}>
        {S.queues.map((q) => (
          <button key={q.key} onClick={() => loadQueue(q.key)} className={'tab' + (queue === q.key ? ' active' : '')}>
            {q.label}{counters ? ` (${counters[q.counter] ?? 0})` : ''}
          </button>
        ))}
      </div>

      {/* Cartes riches : document, état, action attendue, échéance, contexte, raison, action principale. */}
      {paginate(docs, page, pageSize).map((d) => {
        const primary = primaryAction(d);
        const due = dueLabel(d);
        const raison = d.lastActivity?.reason ?? (d.lastActivity ? `Dernier événement : ${eventLabel(d.lastActivity.eventType)}` : null);
        const contexte = [d.customer, d.project].filter(Boolean).join(' · ') || null;
        return (
          <div key={d.id} className="card" style={{ marginBottom: 8, borderColor: open === d.id ? 'var(--accent)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <strong><a className="link-plain" href={`/documents/${d.id}`}>{d.title}</a></strong>
                <div className="micro" style={{ marginTop: 2 }}>{d.reference} · Révision {d.currentRevision}{d.owner ? ` · ${d.owner}` : ''}</div>
              </div>
              <StateBadge state={d.state} />
            </div>
            <div style={{ fontSize: 13, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {EXPECTED[d.state] && <span><strong>Action attendue :</strong> {EXPECTED[d.state]}</span>}
              {due && <span style={due.danger ? { color: 'var(--danger)' } : undefined}>{due.text}</span>}
              {contexte && <span className="muted">{contexte}</span>}
            </div>
            {d.overdue && <div style={{ marginTop: 4 }}><span className="badge pri-overdue">EN RETARD</span></div>}
            {d.assignedToYou && <div style={{ marginTop: 4 }}><span className="badge st-brouillon">Confié à vous</span></div>}
            {raison && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{raison}</div>}
            {d.missing?.length > 0 && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Informations manquantes ({d.missing.length}) — document incomplet.</div>}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn-primary" href={primary.href}>{primary.label}</a>
              <button className="btn" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'Réduire' : 'Détails'}</button>
            </div>
            {open === d.id && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 13 }}>
                {(d.pendingActions ?? []).length > 0
                  ? <div>Actions possibles pour vous : {(d.pendingActions ?? []).map(actionLabel).join(', ')}</div>
                  : <div className="muted">Aucune action attendue de vous à ce stade.</div>}
                {d.lastActivity && <div className="muted">Dernier événement : {eventLabel(d.lastActivity.eventType)} — {fmtDate(d.lastActivity.at)}</div>}
                <div className="muted">Créé le {fmtDate(d.createdAt)} · en attente depuis {d.ageDays} jour(s)</div>
                <p style={{ marginTop: 6 }}><a href={`/documents/${d.id}`}>Ouvrir le document complet</a></p>
              </div>
            )}
          </div>
        );
      })}
      {docs.length === 0 && !err && <div className="empty"><strong>{EMPTY_HINT[queue] ?? 'Rien à signaler.'}</strong></div>}
      <Pager total={docs.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />
    </div>
  );
}
