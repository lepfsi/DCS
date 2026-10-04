'use client';
import { useEffect, useState } from 'react';
import { api, me } from '@/lib/api';
import { Plus, Trash2, ArrowUp, ArrowDown, Check, Eye, FileEdit, History, SlidersHorizontal } from 'lucide-react';
import Pager, { paginate } from '../pager';
import { FAMILY_LABEL, FIELD_TYPE_LABEL, DATASOURCE_LABEL, ROLE_LABEL, slugify } from '@/lib/ui';
import { Dialog, Empty, toast } from '@/components/ui';

// Template Control Center (spec §12-14) : le gestionnaire construit un formulaire,
// sans jamais voir de clé technique. Aéré : cartes, puces, un panneau à la fois.

const FAMILIES = ['ALL', 'OFFICIAL', 'BUSINESS', 'LEGAL', 'CERTIFICATE', 'HR', 'FINANCE'];
const STATUS_TABS = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Publiés' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'retired', label: 'Retirés' },
];
const VERSION_CHIP: Record<string, string> = { approved: 'publie', draft: 'brouillon', retired: 'retire' };
const VERSION_LABEL: Record<string, string> = { draft: 'Brouillon', approved: 'Publié', retired: 'Retiré' };

// Clé technique auto-générée depuis le libellé, dédupliquée : l'utilisateur ne la voit jamais.
function uniqueKey(label: string, existing: string[], selfKey?: string): string {
  const base = slugify(label);
  let key = base; let i = 2;
  while (existing.some((k) => k === key && k !== selfKey)) key = `${base}_${i++}`;
  return key;
}

function FieldBuilder({ version, onSaved, onCancel }: { version: any; onSaved: () => void; onCancel: () => void }) {
  const [fields, setFields] = useState<any[]>((version.definition?.fields ?? []).map((f: any) => ({ ...f })));
  const [advOpen, setAdvOpen] = useState<Record<number, boolean>>({});
  const [addDlg, setAddDlg] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  function set(i: number, patch: any) {
    setFields(fields.map((f, j) => {
      if (j !== i) return f;
      const next = { ...f, ...patch };
      if (patch.label !== undefined) next.key = uniqueKey(patch.label, fields.map((x) => x.key), f.key);
      // Type → source de données implicite (Client → Clients, Personne → Personnes…).
      if (patch.type !== undefined) {
        const TYPE_DS: Record<string, string> = { client: 'customers', person: 'people', project: 'projects' };
        if (TYPE_DS[patch.type]) next.dataSource = TYPE_DS[patch.type];
        else if (patch.type !== 'computed' && next.dataSource && !['list'].includes(patch.type)) next.dataSource = undefined;
      }
      return next;
    }));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
    setAdvOpen({});
  }
  function add() {
    if (!newField.label.trim()) return;
    const TYPE_DS: Record<string, string> = { client: 'customers', person: 'people', project: 'projects' };
    setFields([...fields, {
      key: uniqueKey(newField.label, fields.map((f) => f.key)), label: newField.label.trim(),
      type: newField.type, required: false, ...(TYPE_DS[newField.type] ? { dataSource: TYPE_DS[newField.type] } : {}),
    }]);
    setNewField({ label: '', type: 'text' });
    setAddDlg(false);
  }
  async function save() {
    setSaving(true); setMsg('');
    try {
      await api(`/template-versions/${version.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ definition: { blocks: version.definition?.blocks ?? [], required: fields.filter((f) => f.required).map((f) => f.key), fields } }),
      });
      setMsg('Formulaire enregistré.');
      toast('Formulaire du modèle enregistré.');
      onSaved();
    } catch (e: any) { setMsg(`Impossible d'enregistrer : ${e.message}`); }
    setSaving(false);
  }
  const numeric = (f: any) => f.type === 'number' || f.type === 'currency';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Champs demandés</h3>
        <button className="btn" onClick={() => setAddDlg(true)}><Plus size={13} style={{ verticalAlign: -2 }} /> Ajouter un champ</button>
      </div>
      {fields.length === 0 && <p className="subtitle" style={{ marginTop: 10 }}>Aucun champ pour l'instant. Ajoutez ce que le demandeur devra renseigner.</p>}
      {fields.map((f, i) => (
        <div key={f.key + i} className="card" style={{ marginTop: 10, padding: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className="dlg-x" title="Monter" onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
              <button className="dlg-x" title="Descendre" onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
            </span>
            <input className="input" style={{ flex: 1, minWidth: 180 }} value={f.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Ex : Montant HT" />
            <select className="input" style={{ maxWidth: 150 }} value={f.type} onChange={(e) => set(i, { type: e.target.value })}>
              {Object.entries(FIELD_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={!!f.required} onChange={(e) => set(i, { required: e.target.checked })} /> Obligatoire
            </label>
            <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setAdvOpen({ ...advOpen, [i]: !advOpen[i] })}>
              <SlidersHorizontal size={12} style={{ verticalAlign: -2 }} /> Avancé
            </button>
            <button className="dlg-x" title="Supprimer" onClick={() => setFields(fields.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>

          {/* Niveau 2 — Avancé (§13) : aide, défaut, source, condition, validation, calcul. */}
          {advOpen[i] && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="lbl" style={{ margin: 0 }}>Aide à la saisie</label>
                <input className="input" style={{ marginTop: 3 }} value={f.help ?? ''} onChange={(e) => set(i, { help: e.target.value })} placeholder="Ex : Montant hors taxes en XAF" />
              </div>
              <div>
                <label className="lbl" style={{ margin: 0 }}>Valeur par défaut</label>
                <input className="input" style={{ marginTop: 3 }} disabled={f.type === 'computed'} value={f.defaultValue ?? ''} onChange={(e) => set(i, { defaultValue: numeric(f) ? Number(e.target.value) : e.target.value })} placeholder="Pré-rempli à la création" />
              </div>
              <div>
                <label className="lbl" style={{ margin: 0 }}>Source de données</label>
                <select className="input" style={{ marginTop: 3 }} value={f.dataSource ?? ''} onChange={(e) => set(i, { dataSource: e.target.value || undefined })}>
                  <option value="">— Saisie libre —</option>
                  {Object.entries(DATASOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l} (choix parmi les fiches)</option>)}
                </select>
              </div>
              <div>
                <label className="lbl" style={{ margin: 0 }}>Afficher uniquement si</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  <select className="input" value={f.visibleIf?.field ?? ''} onChange={(e) => set(i, { visibleIf: e.target.value ? { field: e.target.value, equals: f.visibleIf?.equals ?? '' } : undefined })}>
                    <option value="">— Toujours visible —</option>
                    {fields.filter((_, j) => j !== i).map((o, j) => <option key={o.key + j} value={o.key}>{o.label}</option>)}
                  </select>
                  <input className="input" placeholder="est égal à…" value={f.visibleIf?.equals ?? ''} onChange={(e) => set(i, { visibleIf: f.visibleIf ? { ...f.visibleIf, equals: e.target.value } : undefined })} />
                </div>
              </div>
              {numeric(f) && (
                <div>
                  <label className="lbl" style={{ margin: 0 }}>Bornes de validation</label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                    <input className="input" type="number" placeholder="Min" value={f.min ?? ''} onChange={(e) => set(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input className="input" type="number" placeholder="Max" value={f.max ?? ''} onChange={(e) => set(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                </div>
              )}
              {f.type === 'list' && (
                <div>
                  <label className="lbl" style={{ margin: 0 }}>Options de la liste (séparées par des virgules)</label>
                  <input className="input" style={{ marginTop: 3 }} value={(f.options ?? []).join(', ')} onChange={(e) => set(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Option A, Option B, Option C" />
                </div>
              )}
              {f.type === 'computed' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="lbl" style={{ margin: 0 }}>Formule de calcul</label>
                  <input className="input" style={{ marginTop: 3 }} value={f.formula ?? ''} onChange={(e) => set(i, { formula: e.target.value })} placeholder="Ex : {quantite} * {prix_unitaire} ou {montant} * 1.1925" />
                  <p className="micro" style={{ marginTop: 4 }}>Référencez d'autres champs par leur libellé entre accolades. Opérations + - * / et parenthèses.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <p style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={onCancel}>Fermer</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>Enregistrer le formulaire</button>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </p>

      <Dialog open={addDlg} title="Quel type d'information ?" onClose={() => setAddDlg(false)}
        footer={<><button className="btn" onClick={() => setAddDlg(false)}>Annuler</button><button className="btn btn-primary" onClick={add} disabled={!newField.label.trim()}>Ajouter</button></>}>
        <label className="lbl">Type</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(FIELD_TYPE_LABEL).map(([k, l]) => (
            <button key={k} className={'tab' + (newField.type === k ? ' active' : '')} onClick={() => setNewField({ ...newField, type: k })}>{l}</button>
          ))}
        </div>
        <label className="lbl">Que faut-il demander ? *</label>
        <input className="input" value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} placeholder="Ex : Montant HT, Date de validité…" autoFocus />
      </Dialog>
    </div>
  );
}

// Niveau 3 (§13) : la définition brute reste accessible aux administrateurs, avec
// validation serveur à l'enregistrement — impossible de casser un modèle silencieusement.
function RawDefinition({ version, onSaved }: { version: any; onSaved: () => void }) {
  const [raw, setRaw] = useState(() => JSON.stringify(version.definition ?? {}, null, 2));
  const [msg, setMsg] = useState('');
  async function save() {
    setMsg('Enregistrement…');
    try {
      const parsed = JSON.parse(raw);
      await api(`/template-versions/${version.id}`, { method: 'PATCH', body: JSON.stringify({ definition: parsed }) });
      setMsg('Définition enregistrée (validée par le serveur).');
      onSaved();
    } catch (e: any) { setMsg(`Refusé : ${e.message}`); }
  }
  return (
    <div style={{ marginTop: 8 }}>
      <textarea className="input" rows={12} style={{ fontFamily: 'monospace', fontSize: 12 }} value={raw} onChange={(e) => setRaw(e.target.value)} />
      <p style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" onClick={save}>Enregistrer la définition</button>
        {msg && <span className="muted" style={{ fontSize: 12.5 }}>{msg}</span>}
      </p>
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
  const [newDlg, setNewDlg] = useState(false);
  const [newForm, setNewForm] = useState({ type_code: '', name: '' });
  const [err, setErr] = useState('');
  const canManage = role === 'admin' || role === 'doc_manager';

  function load() {
    setErr('');
    api('/templates').then((r) => setTpls(r.data)).catch((e) => setErr(e.message));
    api('/document-types').then((r) => { setTypes(r.data); setNewForm((f) => ({ ...f, type_code: f.type_code || r.data[0]?.type_code || '' })); }).catch(() => {});
    me().then((u) => setRole(u.role)).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function actVersion(id: string, action: 'publish' | 'retire') {
    try {
      await api(`/template-versions/${id}/${action}`, { method: 'POST' });
      toast(action === 'publish' ? 'Modèle publié — il peut désormais créer des documents officiels.' : 'Modèle retiré — il ne crée plus de nouveaux documents.');
      load();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
  }
  async function ensure(type_code: string) {
    try {
      await api('/templates/ensure', { method: 'POST', body: JSON.stringify({ type_code }) });
      toast('Brouillon de modèle préparé — complétez ses champs puis publiez.');
      load();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
  }
  async function create() {
    setErr('');
    if (!newForm.name.trim()) { setErr('Donnez un nom au modèle.'); return; }
    try {
      await api('/templates', { method: 'POST', body: JSON.stringify({ type_code: newForm.type_code, name: newForm.name.trim(), definition: { blocks: [], required: [], fields: [] } }) });
      toast(`Modèle « ${newForm.name.trim()} » créé en brouillon.`);
      setNewDlg(false); setNewForm({ ...newForm, name: '' }); load();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
  }

  const typeOf = (code: string) => types.find((t) => t.type_code === code);
  const missing = types.filter((t) => !tpls.some((x) => x.type_code === t.type_code));
  const shown = tpls.filter((t) => {
    if (family !== 'ALL' && typeOf(t.type_code)?.family !== family) return false;
    const vers = t.versions ?? [];
    if (status === 'all') return true;
    if (status === 'active') return vers.some((v: any) => v.status === 'approved');
    return vers.some((v: any) => v.status === status);
  });
  const openTpl = tpls.find((t) => t.id === open);
  const draftOf = (t: any) => (t.versions ?? []).find((v: any) => v.status === 'draft');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1>Modèles de documents</h1>
          <p className="subtitle">Chaque document naît d'un modèle. Seuls les modèles publiés créent des documents officiels.</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => setNewDlg(true)}><Plus size={14} style={{ verticalAlign: -2 }} /> Nouveau modèle</button>}
      </div>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}

      <div className="tabs">
        {FAMILIES.map((f) => (
          <button key={f} onClick={() => { setFamily(f); setPage(0); }} className={'tab' + (family === f ? ' active' : '')}>
            {f === 'ALL' ? 'Toutes catégories' : FAMILY_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="tabs" style={{ marginTop: 0 }}>
        {STATUS_TABS.map((s) => (
          <button key={s.key} onClick={() => { setStatus(s.key); setPage(0); }} className={'tab' + (status === s.key ? ' active' : '')}>{s.label}</button>
        ))}
      </div>

      <div className="grid2">
        {paginate(shown, page, pageSize).map((t) => {
          const vers = t.versions ?? [];
          const latest = vers[vers.length - 1];
          const fam = typeOf(t.type_code)?.family;
          return (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{t.name}</strong>
                {latest && <span className={`badge st-${VERSION_CHIP[latest.status] ?? ''}`}>{VERSION_LABEL[latest.status] ?? latest.status}</span>}
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                {typeOf(t.type_code)?.label ?? t.type_code}{fam ? ` · ${FAMILY_LABEL[fam]}` : ''}
              </p>
              <p className="micro" style={{ marginTop: 8 }}>v{(vers[vers.length - 1] ?? {}).version ?? '1.0'} · {vers.length} version(s)</p>
              <button className="btn" style={{ marginTop: 10 }} onClick={() => setOpen(open === t.id ? null : t.id)}>
                <History size={13} style={{ verticalAlign: -2 }} /> {open === t.id ? 'Fermer' : 'Gérer le modèle'}
              </button>
            </div>
          );
        })}
      </div>
      {shown.length === 0 && !err && <Empty title="Aucun modèle dans cette vue." action={canManage ? <button className="btn" onClick={() => setNewDlg(true)}>Créer un modèle</button> : undefined} />}
      <Pager total={shown.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />

      {openTpl && (
        <div className="card" style={{ marginTop: 16, borderTop: '3px solid var(--navy)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ margin: 0 }}>{openTpl.name}</h2>
              <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 0' }}>{typeOf(openTpl.type_code)?.label ?? openTpl.type_code}</p>
            </div>
            <button className="btn" onClick={() => setOpen(null)}>Fermer</button>
          </div>

          <h3>Versions</h3>
          {(openTpl.versions ?? []).slice().reverse().map((v: any) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5, flexWrap: 'wrap' }}>
              <span><strong>v{v.version}</strong> · {VERSION_LABEL[v.status] ?? v.status}</span>
              {canManage && v.status === 'draft' && <button className="btn btn-primary" onClick={() => actVersion(v.id, 'publish')}>Publier</button>}
              {canManage && v.status === 'approved' && <button className="btn btn-warn" onClick={() => actVersion(v.id, 'retire')}>Retirer</button>}
            </div>
          ))}
          {(openTpl.versions ?? []).length === 0 && <p className="subtitle">Aucune version.</p>}

          {(() => {
            const draft = draftOf(openTpl);
            if (draft) {
              return canManage
                ? <div style={{ marginTop: 16 }}><FieldBuilder version={draft} onSaved={load} onCancel={() => setOpen(null)} /></div>
                : <p className="subtitle" style={{ marginTop: 12 }}>La préparation des champs est réservée aux gestionnaires et administrateurs.</p>;
            }
            return (
              <div className="card" style={{ marginTop: 14, background: '#fafbfc' }}>
                <strong><Eye size={13} style={{ verticalAlign: -2 }} /> Version publiée : champs figés.</strong>
                <p className="subtitle" style={{ margin: '4px 0 0' }}>Les champs d'une version publiée ne se modifient pas en place. Créez un nouveau modèle pour faire évoluer le formulaire.</p>
              </div>
            );
          })()}

          {/* Niveau 3 — Technique (§13) : réservé aux administrateurs. La majorité n'y va jamais. */}
          {role === 'admin' && (() => {
            const draft = draftOf(openTpl);
            const wf = types.find((t) => t.type_code === openTpl.type_code)?.workflow_key;
            return (
              <details style={{ marginTop: 16 }}>
                <summary className="micro" style={{ cursor: 'pointer' }}>Niveau 3 — technique : définition brute et processus</summary>
                <p className="micro" style={{ marginTop: 8 }}>Processus lié au type : <code>{wf ?? '—'}</code> · Version : <code>{draft ? `v${draft.version} (brouillon éditable)` : 'publiée (figée)'}</code></p>
                {draft ? <RawDefinition version={draft} onSaved={load} /> : <p className="subtitle">La définition brute ne s'édite que sur un brouillon de version.</p>}
              </details>
            );
          })()}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Documents sans modèle {missing.length > 0 && <span className="badge">{missing.length}</span>}</h2>
        {missing.length === 0 && <p className="subtitle" style={{ margin: 0 }}>Tous les types de documents ont un modèle.</p>}
        {missing.slice(0, 8).map((t) => (
          <div key={t.type_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
            <span>{t.label}{t.family ? <span className="muted"> · {FAMILY_LABEL[t.family]}</span> : null}</span>
            {canManage
              ? <button className="btn" onClick={() => ensure(t.type_code)}><FileEdit size={12} style={{ verticalAlign: -2 }} /> Préparer</button>
              : <span className="muted" style={{ fontSize: 12 }}>à préparer par un gestionnaire</span>}
          </div>
        ))}
        {missing.length > 8 && <p className="micro">… et {missing.length - 8} autres.</p>}
      </div>

      {!canManage && <p className="subtitle" style={{ marginTop: 14 }}>Votre rôle ({(ROLE_LABEL[role] ?? role) || '…'}) permet de consulter les modèles. La préparation est réservée aux gestionnaires.</p>}

      <Dialog open={newDlg} title="Nouveau modèle" onClose={() => setNewDlg(false)}>
        <p className="subtitle">Le modèle naît en brouillon : vous définissez ensuite ses champs, puis vous le publiez.</p>
        <label className="lbl">Type de document</label>
        <select className="input" value={newForm.type_code} onChange={(e) => setNewForm({ ...newForm, type_code: e.target.value })}>
          {(missing.length > 0 ? missing : types).map((t) => <option key={t.type_code} value={t.type_code}>{t.label}</option>)}
        </select>
        <label className="lbl">Nom du modèle *</label>
        <input className="input" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Ex : Proposition commerciale v2" autoFocus />
        <p style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setNewDlg(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={create}><Check size={13} style={{ verticalAlign: -2 }} /> Créer le brouillon</button>
        </p>
      </Dialog>
    </div>
  );
}
