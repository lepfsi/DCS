'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Pager, { paginate } from '../pager';

const FAMILIES = ['', 'OFFICIAL', 'BUSINESS', 'LEGAL', 'CERTIFICATE', 'HR', 'FINANCE'];

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [counters, setCounters] = useState<any>(null);
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('');
  const [state, setState] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [err, setErr] = useState('');
  function load() {
    setErr(''); setPage(0);
    const params = [`q=${encodeURIComponent(q)}`, state && `state=${state}`].filter(Boolean).join('&');
    api(`/documents?${params}`).then((r) => {
      let list = r.data;
      if (family) list = list.filter((d: any) => d.family === family);
      list = [...list].sort((a, b) => (sortDesc ? b.updatedAt.localeCompare(a.updatedAt) : a.updatedAt.localeCompare(b.updatedAt)));
      setDocs(list);
    }).catch((e) => setErr(e.message));
    api('/inbox/counters').then(setCounters).catch(() => {});
  }
  useEffect(() => { load(); }, []);
  const inProgress = docs.filter((d) => ['draft', 'in_review', 'changes_requested'].includes(d.state)).length;
  return (
    <div>
      <h1>Documents</h1>
      <p className="subtitle">Create, manage and track company documents.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <p className="micro">{counters?.total ?? docs.length} Documents | {inProgress} In Progress | {counters?.approve ?? '-'} Awaiting Approval | {counters?.expiring ?? '-'} Expiring</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search documents..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select className="input" style={{ maxWidth: 160 }} value={family} onChange={(e) => setFamily(e.target.value)}>
          {FAMILIES.map((f) => <option key={f} value={f}>{f || 'All domains'}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All statuses</option>
          {['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed', 'issued', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={load}>Filter</button>
        <button className="btn" onClick={() => setSortDesc(!sortDesc)}>Sort {sortDesc ? 'newest' : 'oldest'}</button>
        <a className="btn btn-primary" href="/documents/new">+ Create</a>
      </div>
      <table className="tbl">
        <thead><tr><th>Reference</th><th>Title</th><th>Type</th><th>Domain</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          {paginate(docs, page, pageSize).map((d) => (
            <tr key={d.id}>
              <td><a href={`/documents/${d.id}`}>{d.reference}</a></td>
              <td>{d.title}</td><td>{d.type_code}</td><td>{d.family}</td>
              <td><span className={`badge st-${d.state}`}>{d.state}</span></td>
              <td>{d.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && !err && <div className="empty"><strong>No documents match.</strong><p><a href="/documents/new">Create the first one</a></p></div>}
      <Pager total={docs.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />
    </div>
  );
}
