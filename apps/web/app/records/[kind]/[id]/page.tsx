'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

async function relatedDocs(filter: string, id: string) {
  const r = await api(`/documents?${filter}=${id}`);
  return r.data;
}

export default function RecordDetail({ params }: { params: { kind: string; id: string } }) {
  const [rec, setRec] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/${params.kind}/${params.id}`);
        setRec(r.data ?? r);
        if (['customers', 'projects'].includes(params.kind)) {
          setDocs(await relatedDocs(params.kind === 'customers' ? 'customer' : 'project', params.id));
          const t = await api('/transactions');
          setTxs(t.data.filter((x: any) => (params.kind === 'customers' ? x.customerId : x.projectId) === params.id));
        }
        if (params.kind === 'transactions') {
          const t = await api(`/transactions/${params.id}`);
          setRec(t.data);
        }
      } catch (e: any) { setErr(e.message); }
    })();
  }, [params.kind, params.id]);

  async function advance(status: string) {
    try {
      const r = await api(`/transactions/${params.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setRec(r.data);
    } catch (e: any) { alert(`Refusé : ${e.message}`); }
  }

  if (err) return <div className="alert-err"><strong>Erreur : </strong>{err}</div>;
  if (!rec) return <p>Chargement...</p>;
  const title = rec.name ?? rec.fullName ?? rec.title ?? `${rec.kind} ${rec.id.slice(0, 8)}`;
  return (
    <div>
      <p><a href="/records">Records</a></p>
      <h1>{title}</h1>
      <p className="subtitle">{params.kind} · {rec.id}</p>
      <div className="card">
        <div className="kv">
          {Object.entries(rec).filter(([k]) => !['id', 'documentIds', 'documents'].includes(k)).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-')}</dd></div>
          ))}
        </div>
      </div>
      {(docs.length > 0 || ['customers', 'projects'].includes(params.kind)) && (
        <div>
          <h2>Related documents</h2>
          {docs.map((d: any) => (
            <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <a href={`/documents/${d.id}`}>{d.reference}</a> · {d.title} · <span className={`badge st-${d.state}`}>{d.state}</span>
            </div>
          ))}
          {docs.length === 0 && <p className="subtitle">No linked documents.</p>}
          <p><a className="btn btn-primary" href={`/documents/new?${params.kind === 'customers' ? 'customer' : 'project'}=${params.id}`}>Create Document</a></p>
        </div>
      )}
      {txs.length > 0 && (
        <div>
          <h2>Transactions</h2>
          {txs.map((t: any) => (
            <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              {t.kind} · {t.amount ?? '-'} {t.currency} · [{t.status}]
            </div>
          ))}
        </div>
      )}
      {params.kind === 'transactions' && (
        <div>
          <h2>Linked documents</h2>
          {(rec.documents ?? []).map((d: any) => (
            <div key={d.id} style={{ padding: '6px 0', fontSize: 13 }}>
              <a href={`/documents/${d.id}`}>{d.reference}</a> · {d.title}
            </div>
          ))}
          <h2>Status</h2>
          <p>
            {['pending', 'partial', 'paid'].map((s) => (
              <button key={s} className="btn" style={{ marginRight: 8 }} onClick={() => advance(s)}>{s}</button>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
