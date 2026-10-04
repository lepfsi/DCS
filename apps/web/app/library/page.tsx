'use client';
import { useEffect, useState } from 'react';
import { Download, Printer, ShieldCheck, ShieldX, Archive, Globe, GlobeOff } from 'lucide-react';
import { api, me } from '@/lib/api';
import Pager, { paginate } from '../pager';
import { Empty, toast } from '@/components/ui';
import { downloadArtifact, printArtifact } from '@/components/ui';
import { FAMILY_LABEL, fmtDateTime } from '@/lib/ui';

const KINDS = [
  { key: 'issued', label: 'Documents officiels', hint: 'Émis et prêts à imprimer — le PDF de chaque document fait foi.' },
  { key: 'archived', label: 'Archives', hint: 'Documents archivés, conservés selon la politique du domaine. Le PDF officiel reste disponible.' },
];

// Bibliothèque (§18-19, §34) : les PDF officiels, avec les données, prêts pour impression.
// Les gestionnaires décident de la publication au registre public, document par document.
export default function LibraryPage() {
  const [kind, setKind] = useState('issued');
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ issued: number; archived: number }>({ issued: 0, archived: 0 });
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const canManage = role === 'admin' || role === 'doc_manager';

  function loadCounts() {
    api('/library?kind=issued').then((r) => setCounts((c) => ({ ...c, issued: r.data.length }))).catch(() => {});
    api('/library?kind=archived').then((r) => setCounts((c) => ({ ...c, archived: r.data.length }))).catch(() => {});
  }
  function load(k: string) {
    setKind(k); setPage(0); setErr(''); setMsg('');
    api(`/library?kind=${k}`).then((r) => setRows(r.data)).catch((e) => setErr(e.message));
  }
  useEffect(() => { load('issued'); loadCounts(); me().then((u) => setRole(u.role)).catch(() => {}); }, []);

  async function toggleRegister(d: any) {
    setErr(''); setMsg('');
    try {
      await api(`/documents/${d.id}/visibility`, { method: 'PATCH', body: JSON.stringify({ publicRegister: !d.publicRegister }) });
      setMsg(!d.publicRegister ? `${d.reference} publié au registre public (/public).` : `${d.reference} retiré du registre public.`);
      toast(!d.publicRegister ? `${d.reference} publié au registre public.` : `${d.reference} retiré du registre public.`);
      load(kind); loadCounts();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
  }
  async function download(id: string, ref: string, rev: number) {
    setMsg(''); setErr('');
    try { await downloadArtifact(id, `${ref}-rev${rev}.pdf`); } catch (e: any) { setErr(`Téléchargement impossible : ${e.message}`); }
  }
  async function print(id: string) {
    setMsg(''); setErr('');
    try { await printArtifact(id); setMsg('Préparation de l\'impression… vérifiez la boîte de dialogue.'); } catch (e: any) { setErr(`Impression impossible : ${e.message}`); }
  }
  const shown = rows.filter((d) => (d.reference + d.title).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1>Bibliothèque</h1>
      <p className="subtitle">{KINDS.find((k) => k.key === kind)!.hint}</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      {msg && <div className="alert-ok" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="tabs">
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => load(k.key)} className={'tab' + (kind === k.key ? ' active' : '')}>
            {k.key === 'archived' && <Archive size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}{k.label} ({counts[k.key as 'issued' | 'archived']})
          </button>
        ))}
      </div>
      <input className="input" style={{ maxWidth: 320, marginBottom: 12 }} placeholder="Référence, titre…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <table className="tbl">
        <thead>
          <tr>
            <th>Référence</th><th>Document</th><th>Catégorie</th><th>Révision</th>
            <th>{kind === 'archived' ? 'Archivé le' : 'Émis le'}</th><th>PDF officiel</th>
            {kind === 'issued' && <th>Registre public</th>}<th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginate(shown, page, pageSize).map((d) => (
            <tr key={d.id}>
              <td><a href={`/documents/${d.id}`}>{d.reference}</a></td>
              <td>{d.title}</td>
              <td>{FAMILY_LABEL[d.family] ?? d.family}</td>
              <td>rév. {d.revision}</td>
              <td>{fmtDateTime(kind === 'archived' ? d.archivedAt : d.issuedAt)}</td>
              <td>
                {d.artifact
                  ? d.artifact.verified
                    ? <span className="badge st-issued"><ShieldCheck size={11} style={{ verticalAlign: -1 }} /> vérifié</span>
                    : <span className="badge st-rejected"><ShieldX size={11} style={{ verticalAlign: -1 }} /> altéré</span>
                  : <span className="muted">manquant</span>}
              </td>
              {kind === 'issued' && (
                <td>
                  {d.publicRegister
                    ? <span className="badge st-issued"><Globe size={11} style={{ verticalAlign: -1 }} /> public</span>
                    : <span className="muted" style={{ fontSize: 12 }}>non publié</span>}
                  {canManage && (
                    <button className="btn" style={{ marginLeft: 6, padding: '2px 8px', fontSize: 12 }} onClick={() => toggleRegister(d)}>
                      <GlobeOff size={11} style={{ verticalAlign: -1 }} /> {d.publicRegister ? 'Retirer' : 'Publier'}
                    </button>
                  )}
                </td>
              )}
              <td>
                {d.artifact && (
                  <>
                    <button className="btn" onClick={() => download(d.artifact.id, d.reference, d.artifact.revision)}><Download size={12} style={{ verticalAlign: -2 }} /> Télécharger</button>{' '}
                    <button className="btn" onClick={() => print(d.artifact.id)}><Printer size={12} style={{ verticalAlign: -2 }} /> Imprimer</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && !err && (
        kind === 'issued'
          ? <Empty title="Aucun document officiel émis pour l'instant." hint="Émettez un document : son PDF officiel apparaîtra ici, prêt à imprimer." action={<a className="btn" href="/documents">Ouvrir le registre</a>} />
          : <Empty title="Aucune archive." hint="Les documents archivés se conservent ici avec leur PDF officiel." />
      )}
      <Pager total={shown.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />
      <p className="micro" style={{ marginTop: 10 }}>L'impression utilise toujours le PDF officiel vérifié (SHA-256) — jamais une copie régénérée. Publication au registre public : décision explicite, document par document.</p>
    </div>
  );
}
