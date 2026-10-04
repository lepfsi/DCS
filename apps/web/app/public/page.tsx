'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX, Search } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import Pager, { paginate } from '../pager';
import { FAMILY_LABEL, fmtDateTime } from '@/lib/ui';

// Registre public des documents officiels émis (§34 étendu) : transparence
// sans exposer l'entreprise — pas de connexion, données minimales, intégrité affichée.
export default function PublicRegisterPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [issuer, setIssuer] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch(`${API_BASE}/public/register`)
      .then((r) => {
        if (!r.ok) throw new Error(`API joignable mais route en erreur (HTTP ${r.status}) — l'API doit être redémarrée sur la dernière version (dossier apps/api → npm run build puis node dist/src/index.js).`);
        return r.json();
      })
      .then((j) => { setRows(j.data ?? []); setIssuer(j.issuer ?? ''); })
      .catch((e) => setErr(`Registre indisponible : ${e.message ?? 'API injoignable'}. Démarrez l'API (apps/api → node dist/src/index.js) puis rechargez.`));
  }, []);
  const shown = rows.filter((d) => (d.reference + ' ' + d.title).toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ maxWidth: 860, margin: '32px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: 24 }}>
        <h1 style={{ marginBottom: 2 }}>Registre public des documents officiels</h1>
        <p className="subtitle">{issuer || '—'} publie ici ses documents émis. Chacun peut vérifier l'existence, la version et l'intégrité du document officiel.</p>
        {err && <div className="alert-err">{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <span style={{ color: 'var(--muted)', alignSelf: 'center' }}><Search size={15} /></span>
          <input className="input" placeholder="Référence ou titre…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <table className="tbl">
          <thead><tr><th>Référence</th><th>Document</th><th>Catégorie</th><th>Émis le</th><th>Intégrité</th></tr></thead>
          <tbody>
            {paginate(shown, page, pageSize).map((d) => (
              <tr key={d.reference}>
                <td><a href={`/verify/${d.reference}`}>{d.reference}</a></td>
                <td>{d.title}</td>
                <td>{FAMILY_LABEL[d.family] ?? d.family}</td>
                <td style={{ fontSize: 12.5 }}>{fmtDateTime(d.issuedAt)}</td>
                <td>
                  {d.integrity === true && <span className="badge st-issued"><ShieldCheck size={11} style={{ verticalAlign: -1 }} /> vérifié</span>}
                  {d.integrity === false && <span className="badge st-rejected"><ShieldX size={11} style={{ verticalAlign: -1 }} /> altéré</span>}
                  {d.integrity === null && <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && !err && <div className="empty"><strong>Aucun document officiel publié{q ? ' pour cette recherche' : ''}.</strong></div>}
        <Pager total={shown.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />
        <p className="micro" style={{ marginTop: 10 }}>Les documents internes sensibles (RH, personnel, restreints) ne figurent jamais dans ce registre. Vérification unitaire : /verify/[référence].</p>
      </div>
    </div>
  );
}
