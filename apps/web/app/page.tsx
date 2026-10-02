'use client';
import { useEffect, useState } from 'react';
import { Eye, CheckCircle2, PenLine, CalendarClock, Plus, Inbox, Shapes } from 'lucide-react';
import { api } from '@/lib/api';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour.';
  if (h < 18) return 'Bon après-midi.';
  return 'Bonsoir.';
}

export default function OverviewPage() {
  const [counters, setCounters] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const c = await api('/inbox/counters');
        setCounters(c);
        const docs = (await api('/documents')).data;
        const byId = new Map<string, any>(docs.map((d: any) => [d.id, d]));
        const audit = (await api('/audit-events')).data.slice(-5).reverse();
        setActivity(audit.map((a: any) => ({ ...a, ref: byId.get(a.documentId)?.reference ?? a.documentId.slice(0, 8) })));
        const exc = (await api('/inbox?queue=exceptions')).data.slice(0, 5);
        const exp = (await api('/inbox?queue=expiring')).data.slice(0, 5);
        setAttention([...exc, ...exp.filter((d: any) => !exc.some((e: any) => e.id === d.id))].slice(0, 5));
        setRecent([...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5));
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);
  return (
    <div>
      <h1>{greeting()}</h1>
      <p className="subtitle">Voici ce qui requiert votre attention aujourd'hui.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <div className="grid4">
        <div className="stat"><div className="n"><Eye size={18} style={{ verticalAlign: -3 }} /> {counters?.review ?? '-'}</div><div className="l">To Review</div></div>
        <div className="stat"><div className="n"><CheckCircle2 size={18} style={{ verticalAlign: -3 }} /> {counters?.approve ?? '-'}</div><div className="l">To Approve</div></div>
        <div className="stat"><div className="n"><PenLine size={18} style={{ verticalAlign: -3 }} /> {counters?.sign ?? '-'}</div><div className="l">To Sign</div></div>
        <div className="stat"><div className="n"><CalendarClock size={18} style={{ verticalAlign: -3 }} /> {counters?.expiring ?? '-'}</div><div className="l">Expiring</div></div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h2>Quick actions</h2>
        <p>
          <a className="btn btn-primary" href="/documents/new"><Plus size={13} style={{ verticalAlign: -2 }} /> Create Document</a>{' '}
          <a className="btn" href="/inbox"><Inbox size={13} style={{ verticalAlign: -2 }} /> Go to Inbox</a>{' '}
          <a className="btn" href="/templates"><Shapes size={13} style={{ verticalAlign: -2 }} /> Search Templates</a>
        </p>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Recent Activity <a href="/admin" style={{ fontSize: 12, fontWeight: 'normal' }}>View all</a></h2>
          {activity.map((a) => (
            <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              {a.ref} · {a.eventType} · {a.actorRole} · {a.createdAt.slice(0, 16).replace('T', ' ')}
            </div>
          ))}
          {activity.length === 0 && <p className="subtitle">Aucune activité.</p>}
        </div>
        <div className="card">
          <h2>Attention / Deadlines <a href="/inbox" style={{ fontSize: 12, fontWeight: 'normal' }}>View all</a></h2>
          {attention.map((d) => (
            <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <a href={`/documents/${d.id}`}>{d.reference}</a> · {d.overdue ? 'en retard' : `échéance ${d.dueAt?.slice(0, 10) ?? '-'}`} · {d.state}
            </div>
          ))}
          {attention.length === 0 && <p className="subtitle">Rien d'urgent.</p>}
        </div>
      </div>
      <h2>Recent Documents <a href="/documents" style={{ fontSize: 12, fontWeight: 'normal' }}>View all</a></h2>
      <table className="tbl">
        <thead><tr><th>Reference</th><th>Title</th><th>Type</th><th>Status</th><th>Updated</th><th>Owner</th></tr></thead>
        <tbody>
          {recent.map((d) => (
            <tr key={d.id}>
              <td><a href={`/documents/${d.id}`}>{d.reference}</a></td>
              <td>{d.title}</td><td>{d.type_code}</td>
              <td><span className={`badge st-${d.state}`}>{d.state}</span></td>
              <td>{d.updatedAt.slice(0, 10)}</td><td style={{ fontSize: 11 }}>{d.ownerId.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16 }}><a className="btn btn-primary" href="/documents/new">Create Document</a> <a className="btn" href="/inbox">Open Inbox</a></p>
    </div>
  );
}
