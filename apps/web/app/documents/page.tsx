'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Pager, { paginate } from '../pager';
import { StateBadge } from '@/components/ui';
import { FAMILY_LABEL, actionLabel, fmtDate } from '@/lib/ui';

const FAMILIES = ['', 'OFFICIAL', 'BUSINESS', 'LEGAL', 'CERTIFICATE', 'HR', 'FINANCE'];
const STATES = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed', 'issued', 'archived'];
const STATE_LABELS: Record<string, string> = {
  draft: 'Brouillon', in_review: 'En revue', changes_requested: 'Modifications demandées', approved: 'Approuvé',
  ready_to_sign: 'À signer', signed: 'Signé', issued: 'Émis', archived: 'Archivé',
};
// Action attendue par état (§20 : toujours séparer état du document et action attendue).
const EXPECTED: Record<string, string> = {
  draft: 'À finaliser par le responsable', in_review: 'Revue attendue', changes_requested: 'Corrections attendues',
  approved: 'Préparation de la signature', ready_to_sign: 'Signature attendue', signed: 'Émission attendue',
  issued: '', archived: '',
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
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
  useEffect(() => { load(); api('/document-types').then((r) => setTypes(r.data)).catch(() => {}); }, []);
  const typeLabel = (code: string) => types.find((t) => t.type_code === code)?.label ?? code;
  const inProgress = docs.filter((d) => ['draft', 'in_review', 'changes_requested'].includes(d.state)).length;
  return (
    <div>
      <h1>Documents</h1>
      <p className="subtitle">Tous les documents contrôlés de l'organisation.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <p className="micro">{counters?.total ?? docs.length} documents | {inProgress} en cours | {counters?.approve ?? '-'} à approuver | {counters?.expiring ?? '-'} échéances proches</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Référence, titre, client…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select className="input" style={{ maxWidth: 160 }} value={family} onChange={(e) => setFamily(e.target.value)}>
          {FAMILIES.map((f) => <option key={f} value={f}>{f ? FAMILY_LABEL[f] : 'Toutes les catégories'}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 180 }} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Tous les états</option>
          {STATES.map((s) => <option key={s} value={s}>{STATE_LABELS[s]}</option>)}
        </select>
        <button className="btn" onClick={load}>Rechercher</button>
        <button className="btn" onClick={() => { setSortDesc(!sortDesc); load(); }}>Tri : {sortDesc ? 'plus récents' : 'plus anciens'}</button>
        <a className="btn btn-primary" href="/documents/new">+ Créer un document</a>
      </div>
      <table className="tbl">
        <thead><tr><th>Référence</th><th>Document</th><th>Type</th><th>Catégorie</th><th>État</th><th>Action attendue</th><th>Responsable</th><th>Révision</th><th>Échéance</th><th>Mise à jour</th></tr></thead>
        <tbody>
          {paginate(docs, page, pageSize).map((d) => (
            <tr key={d.id}>
              <td><a href={`/documents/${d.id}`}>{d.reference}</a></td>
              <td>{d.title}</td>
              <td>{typeLabel(d.type_code)}</td>
              <td>{FAMILY_LABEL[d.family] ?? d.family}</td>
              <td><StateBadge state={d.state} /></td>
              <td className="muted" style={{ fontSize: 12.5 }}>{EXPECTED[d.state] ?? ''}</td>
              <td>{d.owner ?? '—'}</td>
              <td>rév. {d.currentRevision}</td>
              <td>{d.dueAt ? fmtDate(d.dueAt) : '—'}</td>
              <td>{fmtDate(d.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && !err && <div className="empty"><strong>Aucun document ne correspond.</strong><p><a href="/documents/new">Créer le premier document</a></p></div>}
      <Pager total={docs.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />
    </div>
  );
}
