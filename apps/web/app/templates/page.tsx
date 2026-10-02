'use client';
import { useEffect, useState } from 'react';
import { api, me } from '@/lib/api';
import Pager, { paginate } from '../pager';

const FAMILIES = ['ALL', 'OFFICIAL', 'BUSINESS', 'LEGAL', 'CERTIFICATE', 'HR', 'FINANCE'];
const STATUSES = ['all', 'active', 'draft', 'retired'];
const FIELD_TYPES = ['text', 'textarea', 'number', 'currency', 'date'];

function FieldEditor({ version, onSaved }: { version: any; onSaved: () => void }) {
  const [fields, setFields] = useState<any[]>((version.definition?.fields ?? []).map((f: any) => ({ ...f })));
  const [msg, setMsg] = useState('');
  function set(i: number, patch: any) { setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f))); }
  async function save() {
    setMsg('');
    try {
      await api(`/template-versions/${version.id}`, { method: 'PATCH', body: JSON.stringify({ definition: { blocks: version.definition?.blocks ?? [], required: fields.filter((f) => f.required).map((f) => f.key), fields } }) });
      setMsg('Enregistré.');
      onSaved();
    } catch (e: any) { setMsg(`Erreur : ${e.message}`); }
  }
  return (
    <div style={{ marginTop: 8 }}>
      {fields.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
          <input className="input" placeholder="clé" value={f.key} onChange={(e) => set(i, { key: e.target.value })} style={{ maxWidth: 140 }} />
          <input className="input" placeholder="Libellé" value={f.label} onChange={(e) => set(i, { label: e.target.value })} style={{ maxWidth: 180 }} />
          <select className="input" value={f.type} onChange={(e) => set(i, { type: e.target.value })} style={{ maxWidth: 120 }}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label><input type="checkbox" checked={!!f.required} onChange={(e) => set(i, { required: e.target.checked })} /> requis</label>
          <button className="btn" onClick={() => setFields(fields.filter((_, j) => j !== i))}>Retirer</button>
        </div>
      ))}
      <p style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setFields([...fields, { key: '', label: '', type: 'text', required: false }])}>Ajouter un champ</button>{' '}
        <button className="btn btn-primary" onClick={save}>Enregistrer les champs</button>
        {msg && <span style={{ marginLeft: 8 }}>{msg}</span>}
      </p>
      <p className="micro">Les champs requis alimentent les pré-contrôles. La publication reste une action séparée.</p>
    </div>
  );
}

export default function TemplatesPage() {
  const [tpls, setTpls] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [family, setFamily] = useState('ALL');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [name, setName] = useState('');
  const [newType, setNewType] = useState('DO-BIZ-PROPOSAL');
  const [err, setErr] = useState('');
  const canManage = role === 'admin' || role === 'doc_manager';

  function load() {
    setErr('');
    api('/templates').then((r) => setTpls(r.data)).catch((e) => setErr(e.message));
    api('/document-types').then((r) => setTypes(r.data)).catch(() => {});
    me().then((u) => setRole(u.role)).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function actVersion(id: string, action: 'publish' | 'retire') {
    try {
      await api(`/template-versions/${id}/${action}`, { method: 'POST' });
      load();
    } catch (e: any) { setErr(e.message); }
  }
  async function create() {
    setErr('');
    if (!name.trim()) { setErr('Nommez le template avant de le créer.'); return; }
    try {
      await api('/templates', { method: 'POST', body: JSON.stringify({ type_code: newType, name: name.trim(), definition: { blocks: [], required: [], fields: [] } }) });
      setName('');
      load();
    } catch (e: any) { setErr(e.message); }
  }
  async function ensure(type_code: string) {
    setErr('');
    try {
      await api('/templates/ensure', { method: 'POST', body: JSON.stringify({ type_code }) });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  const missing = types.filter((t) => !tpls.some((x) => x.type_code === t.type_code));
  const shown = tpls.filter((t) => {
    const typeFam = types.find((x) => x.type_code === t.type_code)?.family;
    if (family !== 'ALL' && typeFam !== family) return false;
    const vers = t.versions ?? [];
    if (status === 'all') return true;
    if (status === 'active') return vers.some((v: any) => v.status === 'approved');
    return vers.some((v: any) => v.status === (status === 'draft' ? 'draft' : 'retired'));
  });

  return (
    <div>
      <h1>Templates</h1>
      <p className="subtitle">Controlled document definitions. Only approved versions may issue.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <div className="tabs">
        {FAMILIES.map((f) => (
          <button key={f} onClick={() => { setFamily(f); setPage(0); }} className={'tab' + (family === f ? ' active' : '')}>{f}</button>
        ))}
      </div>
      <div className="tabs">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(0); }} className={'tab' + (status === s ? ' active' : '')}>{s}</button>
        ))}
      </div>
      <table className="tbl">
        <thead><tr><th>Template</th><th>Type</th><th>Versions</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>
          {paginate(shown, page, pageSize).map((t) => (
            <tr key={t.id}>
              <td><strong>{t.name}</strong></td>
              <td style={{ fontSize: 12 }}>{t.type_code}</td>
              <td>{(t.versions ?? []).map((v: any) => `v${v.version}`).join(', ')}</td>
              <td>{(t.versions ?? []).map((v: any) => <span key={v.id} className="badge" style={{ marginRight: 4 }}>{v.status}</span>)}</td>
              <td><button className="btn" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Hide' : 'History'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (() => {
        const t = tpls.find((x) => x.id === open);
        return (
          <div className="card" style={{ marginTop: 8 }}>
            <h3>{t.name} - versions et champs</h3>
            {(t.versions ?? []).map((v: any) => (
              <div key={v.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div>v{v.version} · <span className="badge">{v.status}</span>
                  {canManage && v.status === 'draft' && <button className="btn" style={{ marginLeft: 8 }} onClick={() => actVersion(v.id, 'publish')}>Publish</button>}
                  {canManage && v.status === 'approved' && <button className="btn" style={{ marginLeft: 8 }} onClick={() => actVersion(v.id, 'retire')}>Retire</button>}
                </div>
                {v.status === 'draft' && (canManage
                  ? <FieldEditor version={v} onSaved={load} />
                  : <p className="subtitle">Brouillon modifiable par un gestionnaire ou administrateur.</p>)}
              </div>
            ))}
            {!canManage && <p className="subtitle">Publication et retrait réservés aux gestionnaires et administrateurs.</p>}
          </div>
        );
      })()}
      {shown.length === 0 && !err && <div className="empty"><strong>No templates in this view.</strong></div>}
      <Pager total={shown.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Types sans template ({missing.length})</h2>
        {missing.length === 0 && <p className="subtitle">Chaque type a au moins un brouillon.</p>}
        {missing.slice(0, 12).map((t) => (
          <div key={t.type_code} style={{ padding: '4px 0', fontSize: 13 }}>
            {t.type_code} - {t.label}{' '}
            {canManage
              ? <button className="btn" onClick={() => ensure(t.type_code)}>Générer le brouillon</button>
              : <span className="micro">brouillon à générer par un gestionnaire</span>}
          </div>
        ))}
        {missing.length > 12 && <p className="micro">... et {missing.length - 12} autres (filtrez par domaine dans Documents).</p>}
      </div>

      {canManage ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>New template (draft)</h2>
          <label className="lbl">Type</label>
          <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>
            {types.map((t) => <option key={t.type_code} value={t.type_code}>{t.type_code} - {t.label}</option>)}
          </select>
          <label className="lbl">Name (requis)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Service Proposal v2" />
          <p style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={create}>Create draft</button></p>
          <p className="micro">Les champs se définissent ensuite dans l'historique du template, sans JSON.</p>
        </div>
      ) : (
        <p className="subtitle" style={{ marginTop: 16 }}>Création et publication réservées aux gestionnaires et administrateurs (rôle actuel : {role || '...'}).</p>
      )}
    </div>
  );
}
