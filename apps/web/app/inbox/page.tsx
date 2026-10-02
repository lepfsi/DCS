'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const QUEUES = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'To Review' },
  { key: 'approve', label: 'To Approve' },
  { key: 'sign', label: 'To Sign' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'exceptions', label: 'Exceptions' },
  { key: 'completed', label: 'Completed' },
];

const EMPTY: Record<string, string> = {
  all: 'No documents in this workspace yet.',
  review: 'No documents require your review. Everything is up to date.',
  approve: 'No documents await approval.',
  sign: 'No documents await signature.',
  expiring: 'No deadlines approaching.',
  exceptions: 'No exceptions. Everything is under control.',
  completed: 'No completed documents yet.',
};

function Priority({ d }: { d: any }) {
  if (d.overdue) return <span className="badge pri-overdue">EN RETARD</span>;
  if (d.priority === 'high') return <span className="badge pri-high">PRIORITAIRE</span>;
  return null;
}

function SelectedItem({ id, onAct }: { id: string; onAct: () => void }) {
  const [wf, setWf] = useState<any>(null);
  useEffect(() => { api(`/documents/${id}/workflow`).then((r) => setWf(r.data)).catch(() => {}); }, [id]);
  if (!wf) return <p>Chargement...</p>;
  return (
    <div>
      <div className="kv">
        <dt>Status</dt><dd><span className={`badge st-${wf.state}`}>{wf.state}</span></dd>
        <dt>Workflow</dt><dd>{wf.workflowKey}</dd>
        <dt>Signatures</dt><dd>{wf.signatures.length}/{wf.expectedSignatures.length}</dd>
      </div>
      <h3>Recent changes</h3>
      {wf.history.slice(-4).map((h: any) => (
        <div key={h.id} style={{ fontSize: 13, padding: '4px 0' }}>
          {h.createdAt.slice(0, 16).replace('T', ' ')} - {h.eventType} ({h.actorRole}){h.reason ? ` : ${h.reason}` : ''}
        </div>
      ))}
      <h3>Primary action</h3>
      <p>
        <a className="btn btn-primary" href={`/documents/${id}`}>Open</a>{' '}
        <a className="btn" href={`/documents/${id}/review`}>Review</a>{' '}
        <a className="btn" href={`/documents/${id}/approve`}>Approve</a>
      </p>
    </div>
  );
}

export default function InboxPage() {
  const [counters, setCounters] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [queue, setQueue] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');
  function load(q: string) {
    setQueue(q); setOpen(null); setErr('');
    api('/inbox/counters').then(setCounters).catch((e) => setErr(String(e.message)));
    api(`/inbox?queue=${q}`).then((r) => setDocs(r.data)).catch((e) => setErr(String(e.message)));
  }
  useEffect(() => { load('all'); }, []);
  return (
    <div>
      <h1>Document Inbox</h1>
      <p className="subtitle">Your actions keep the business moving.</p>
      {err ? (
        <div className="alert-err"><strong>Erreur : </strong>{err}</div>
      ) : (
        <p className="micro">
          To Review {counters?.review ?? '-'} | To Approve {counters?.approve ?? '-'} | To Sign {counters?.sign ?? '-'} | Expiring {counters?.expiring ?? '-'} | Exceptions {counters?.exceptions ?? '-'}
        </p>
      )}
      <div className="tabs">
        {QUEUES.map((q) => (
          <button key={q.key} onClick={() => load(q.key)} className={'tab' + (queue === q.key ? ' active' : '')}>{q.label}</button>
        ))}
      </div>
      <div className="split">
        <div>
          {docs.map((d) => (
            <div key={d.id} className="card" style={{ marginBottom: 8, borderColor: open === d.id ? 'var(--accent)' : undefined }}>
              <div><strong>{d.title}</strong></div>
              <div className="micro">{d.reference} · {d.type_code}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge st-${d.state}`}>{d.state}</span> <Priority d={d} />
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {d.pendingActions.join(', ') || 'no action'} · {d.dueAt ? `due ${d.dueAt.slice(0, 10)}` : 'no deadline'}
                {d.lastActivity && <span> · {d.lastActivity.eventType}</span>}
              </div>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'Hide' : 'Select'}</button>
            </div>
          ))}
          {docs.length === 0 && !err && <div className="empty"><strong>{EMPTY[queue]}</strong></div>}
        </div>
        <div className="card">
          <h2>Selected item</h2>
          {!open && <p className="subtitle">Select a document to see what is required.</p>}
          {open && <SelectedItem key={open} id={open} onAct={() => load(queue)} />}
        </div>
      </div>
    </div>
  );
}
