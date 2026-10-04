'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, me } from '@/lib/api';
import { FAMILY_LABEL, fmtMoney } from '@/lib/ui';
import { SmartField } from '@/components/ui';

// Parcours guidé (spec §4) : Que créer ? → Quel document ? → Contexte → Formulaire → Vérifier.
// L'utilisateur ne voit jamais type_code, workflow_key ni schema.
const FAMILY_ORDER = ['BUSINESS', 'LEGAL', 'OFFICIAL', 'HR', 'CERTIFICATE', 'FINANCE'];
const FAMILY_HINT: Record<string, string> = {
  BUSINESS: 'Propositions, devis, rapports et documents clients',
  LEGAL: 'Contrats, NDA, avenants et engagements formels',
  OFFICIAL: 'Lettres, notes et communications officielles',
  HR: 'Attestations, contrats et notifications du personnel',
  CERTIFICATE: 'Certificats de formation, participation et contribution',
  FINANCE: 'Factures, reçus et documents financiers',
};

export default function NewDocPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [types, setTypes] = useState<any[]>([]);
  const [family, setFamily] = useState('');
  const [type, setType] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [tplOpts, setTplOpts] = useState<Array<{ tplId: string; name: string; version: string; versionId: string }>>([]);
  const [tplVersionId, setTplVersionId] = useState('');
  const [schema, setSchema] = useState<any>(undefined);
  const [values, setValues] = useState<Record<string, any>>({});
  const [role, setRole] = useState('');
  const [err, setErr] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [selCustomer, setSelCustomer] = useState('');
  const [selProject, setSelProject] = useState('');
  const [selServices, setSelServices] = useState<string[]>([]);
  const [selDueAt, setSelDueAt] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api('/document-types').then((r) => setTypes(r.data)).catch((e) => setErr(e.message));
    api('/customers').then((r) => setCustomers(r.data)).catch(() => {});
    api('/projects').then((r) => setProjects(r.data)).catch(() => {});
    api('/services').then((r) => setServices(r.data)).catch(() => {});
    api('/people').then((r) => setPeople(r.data)).catch(() => {});
    me().then((u) => setRole(u.role)).catch(() => {});
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('customer')) setSelCustomer(sp.get('customer')!);
    if (sp.get('project')) setSelProject(sp.get('project')!);
  }, []);
  // Modèles publiés du type choisi (spec : un modèle publié = exploitable, le système propose, l'utilisateur choisit).
  useEffect(() => {
    if (step !== 3 || !type) return;
    setTplOpts([]); setTplVersionId('');
    api('/templates').then((r) => {
      const opts = (r.data as any[])
        .filter((t) => t.type_code === type.type_code)
        .flatMap((t) => (t.versions ?? []).filter((v: any) => v.status === 'approved').map((v: any) => ({ tplId: t.id, name: t.name, version: v.version, versionId: v.id })));
      setTplOpts(opts);
      if (opts.length > 0) setTplVersionId(opts[0].versionId);
    }).catch(() => {});
  }, [step, type]);
  useEffect(() => {
    if (step !== 4 || !type) return;
    setSchema(undefined); setValues({});
    const chosen = tplOpts.find((o) => o.versionId === tplVersionId);
    if (!chosen) { setSchema(null); return; }
    api(`/templates/${chosen.tplId}/schema`).then((s) => {
      setSchema(s.data);
      // Niveau 2 (§13) : valeurs par défaut du modèle, puis contexte métier par-dessus.
      const base: Record<string, any> = {};
      for (const f of s.data.fields ?? []) {
        if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '' && f.type !== 'computed') base[f.key] = f.defaultValue;
      }
      setValues(base);
      prefill(base);
    }).catch(() => setSchema(null));
  }, [step, type, tplVersionId, tplOpts]);

  const canManageTemplates = role === 'admin' || role === 'doc_manager';

  async function ensureTemplate() {
    setErr('');
    try {
      await api('/templates/ensure', { method: 'POST', body: JSON.stringify({ type_code: type.type_code }) });
      const r = await api('/templates');
      const tpl = r.data.find((t: any) => t.type_code === type.type_code);
      if (tpl) setSchema((await api(`/templates/${tpl.id}/schema`)).data);
    } catch (e: any) { setErr(e.message); }
  }

  // Pré-remplissage (§6) : les informations connues s'injectent dès que le contexte change.
  async function prefill(base?: Record<string, any>) {
    try {
      const q = [`customerId=${selCustomer}`, `projectId=${selProject}`, `serviceIds=${selServices.join(',')}`].filter((x) => !x.endsWith('=')).join('&');
      if (!q) return;
      const r = await api(`/documents/prefill?${q}`);
      setValues({ ...(base ?? values), ...r.data });
    } catch { /* le pré-remplissage n'échoue jamais le parcours */ }
  }
  useEffect(() => { if (step >= 4) prefill(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selCustomer, selProject, selServices.join(',')]);

  async function create() {
    setErr(''); setCreating(true);
    try {
      const business: any = {};
      if (selCustomer) business.customerId = selCustomer;
      if (selProject) business.projectId = selProject;
      if (selServices.length > 0) business.serviceIds = selServices;
      const r = await api('/documents', { method: 'POST', body: JSON.stringify({ type_code: type.type_code, title: title.trim(), fields: values, templateVersionId: tplVersionId || undefined, dueAt: selDueAt ? new Date(selDueAt).toISOString() : undefined, ...(Object.keys(business).length > 0 ? { business } : {}) }) });
      router.push(`/documents/${r.data.id}`);
    } catch (e: any) { setErr(e.message); setCreating(false); }
  }

  const familyTypes = types.filter((t) => t.family === family);
  const missing = schema ? (schema.required ?? []).filter((k: string) => values[k] === undefined || values[k] === '' || values[k] == null) : [];
  const labelOf = (k: string) => schema?.fields?.find((f: any) => f.key === k)?.label ?? k;
  const [attempted, setAttempted] = useState(false);

  // Validation explicite (§7) : rien ne reste silencieux — les champs manquants
  // sont nommés, surlignés, et l'écran défile jusqu'au premier d'entre eux.
  function goVerify() {
    setAttempted(true);
    if (missing.length > 0) {
      setTimeout(() => document.getElementById(`field-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setAttempted(false);
    setStep(5);
  }

  return (
    <div>
      <h1>Créer un document</h1>
      <p className="subtitle">{step === 1 ? 'Que voulez-vous créer ?' : step === 2 ? 'Quel document ?' : step === 3 ? 'Dans quel contexte ?' : step === 4 ? 'Renseignez le document' : 'Vérification avant création'}</p>
      {err && <div className="alert-err"><strong>Impossible de continuer : </strong>{err}</div>}

      {step > 1 && (
        <p className="micro" style={{ marginBottom: 10 }}>
          {FAMILY_LABEL[family]}{type ? ` · ${type.label}` : ''} — <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setStep(step === 4 || step === 5 ? 3 : step - 1)}>Modifier</button>
        </p>
      )}

      {step === 1 && (
        <div className="grid2">
          {FAMILY_ORDER.map((f) => (
            <button key={f} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => { setFamily(f); setStep(2); }}>
              <strong>{FAMILY_LABEL[f]}</strong>
              <div className="micro" style={{ marginTop: 2 }}>{FAMILY_HINT[f]}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{types.filter((t) => t.family === f).length} document(s) disponible(s)</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          {familyTypes.map((t) => (
            <div key={t.type_code} className="card" style={{ marginBottom: 8, borderColor: type?.type_code === t.type_code ? 'var(--accent)' : undefined }}>
              <strong>{t.label}</strong>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Document « {FAMILY_LABEL[t.family]} » · informations vérifiées à la création</div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => { setType(t); setStep(3); }}>Utiliser ce document</button>
            </div>
          ))}
          {familyTypes.length === 0 && <div className="empty"><strong>Aucun document dans cette catégorie pour l'instant.</strong></div>}
        </div>
      )}

      {step === 3 && type && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3 style={{ marginTop: 0 }}>Modèle et contexte</h3>
          {tplOpts.length === 0 && <p className="subtitle">Aucun modèle publié pour ce document — il faudra d'abord en préparer un dans la bibliothèque de modèles.</p>}
          {tplOpts.length > 0 && (
            <>
              <label className="lbl">Modèle à utiliser</label>
              {tplOpts.length === 1
                ? <p className="muted" style={{ fontSize: 13.5, margin: '0 0 10px' }}>« {tplOpts[0].name} » (version {tplOpts[0].version}) — modèle publié, prêt pour ce document.</p>
                : (
                  <select className="input" value={tplVersionId} onChange={(e) => setTplVersionId(e.target.value)}>
                    {tplOpts.map((o) => <option key={o.versionId} value={o.versionId}>{o.name} — version {o.version}</option>)}
                  </select>
                )}
            </>
          )}
          <p className="subtitle" style={{ marginTop: 10 }}>Les informations connues seront reprises automatiquement dans le document.</p>
          <label className="lbl">Client</label>
          <select className="input" value={selCustomer} onChange={(e) => setSelCustomer(e.target.value)}>
            <option value="">— Aucun client</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="lbl">Projet</label>
          <select className="input" value={selProject} onChange={(e) => setSelProject(e.target.value)}>
            <option value="">— Aucun projet</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {services.length > 0 && (
            <>
              <label className="lbl">Prestations</label>
              <div>{services.map((s) => (
                <label key={s.id} style={{ marginRight: 14, fontSize: 13.5 }}>
                  <input type="checkbox" checked={selServices.includes(s.id)} onChange={() => setSelServices(selServices.includes(s.id) ? selServices.filter((x) => x !== s.id) : [...selServices, s.id])} /> {s.name} ({fmtMoney(s.unitPrice, s.currency)})
                </label>
              ))}</div>
            </>
          )}
          <label className="lbl">Responsable</label>
          <p className="muted" style={{ fontSize: 13 }}>Vous — désigné automatiquement comme responsable du document.</p>
          <label className="lbl">Échéance (facultative)</label>
          <input className="input" type="date" value={selDueAt} onChange={(e) => setSelDueAt(e.target.value)} />
          <p className="micro" style={{ marginTop: 4 }}>Quand ce document doit-il être traité ? L'échéance déclenche rappels, file « À surveiller » et escalade. Sans date, le processus du type peut en fixer une par défaut.</p>
          <p style={{ marginTop: 14 }}><button className="btn btn-primary" onClick={() => setStep(4)}>Continuer</button></p>
        </div>
      )}

      {step === 4 && type && (
        <div style={{ maxWidth: 640 }}>
          <div className="card">
            <label className="lbl">Titre du document *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Ex : ${type.label} — ${customers.find((c) => c.id === selCustomer)?.name ?? 'nouveau contexte'}`} />
          </div>
          {schema === undefined && <p className="muted" style={{ marginTop: 12 }}>Préparation du formulaire…</p>}
          {schema === null && (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Ce document n'est pas encore prêt.</strong>
              <p className="subtitle">Un document naît toujours d'un modèle validé. {canManageTemplates ? 'Vous pouvez générer le brouillon du modèle, le compléter puis le publier.' : 'Demandez à un gestionnaire de préparer ce type de document.'}</p>
              {canManageTemplates && <button className="btn btn-primary" onClick={ensureTemplate}>Préparer le modèle</button>}
              <p style={{ marginTop: 8 }}><a href="/templates">Ouvrir la bibliothèque de modèles</a></p>
            </div>
          )}
          {schema && (
            <div className="card" style={{ marginTop: 12 }}>
              {attempted && missing.length > 0 && (
                <div className="alert-err" style={{ marginTop: 0, marginBottom: 6 }}>
                  <strong>Informations obligatoires manquantes ({missing.length}) :</strong>{' '}
                  {missing.map(labelOf).join(', ')}. Complétez les champs surlignés pour continuer.
                </div>
              )}
              {(schema.fields ?? []).map((f: any) => (
                <SmartField key={f.key} f={f} value={values[f.key]} values={values} showErrors={attempted}
                  lists={{
                    customers: customers.map((c) => ({ id: c.id, name: c.name })),
                    projects: projects.map((p) => ({ id: p.id, name: p.title })),
                    services: services.map((s) => ({ id: s.id, name: s.name })),
                    people: people.map((p) => ({ id: p.id, name: p.fullName })),
                  }}
                  onChange={(v) => setValues({ ...values, [f.key]: v })} />
              ))}
              {(schema.fields ?? []).length === 0 && <p className="subtitle">Ce modèle ne définit pas encore de champs à renseigner.</p>}
            </div>
          )}
          {schema && (
            <p style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => setStep(3)}>Retour</button>{' '}
              <button className="btn btn-primary" onClick={goVerify} disabled={!title.trim()}>Vérifier</button>
            </p>
          )}
        </div>
      )}

      {step === 5 && schema && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3 style={{ marginTop: 0 }}>Vérification</h3>
          {missing.length === 0 ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
              <div>✓ {FAMILY_LABEL[family]} — {type.label}</div>
              {tplOpts.find((o) => o.versionId === tplVersionId) && <div>✓ Modèle : {tplOpts.find((o) => o.versionId === tplVersionId)!.name} (version {tplOpts.find((o) => o.versionId === tplVersionId)!.version})</div>}
              <div>✓ Titre : {title}</div>
              <div>{selCustomer ? `✓ Client : ${customers.find((c) => c.id === selCustomer)?.name}` : '○ Aucun client associé (facultatif)'}</div>
              <div>{selProject ? `✓ Projet : ${projects.find((p) => p.id === selProject)?.title}` : '○ Aucun projet associé (facultatif)'}</div>
              <div>{selDueAt ? `✓ Échéance : ${new Date(selDueAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : (types.find((t) => t.type_code === type.type_code)?.defaultDueDays ?? 0) > 0 ? `○ Échéance : automatique (J+${types.find((t) => t.type_code === type.type_code)?.defaultDueDays} à la soumission, selon le processus)` : '○ Aucune échéance'}</div>
              <div>✓ Toutes les informations obligatoires sont renseignées</div>
            </div>
          ) : (
            <div className="alert-err">
              <strong>Informations manquantes : </strong>
              <ul style={{ margin: '6px 0 0 18px' }}>{missing.map((k: string) => <li key={k}>{labelOf(k)}</li>)}</ul>
            </div>
          )}
          <p className="subtitle" style={{ marginTop: 8 }}>La référence, la version et le suivi seront attribués automatiquement à la création.</p>
          <p style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setStep(4)}>Modifier</button>{' '}
            <button className="btn btn-primary" onClick={create} disabled={creating || !title.trim() || missing.length > 0}>{creating ? 'Création…' : 'Créer le brouillon'}</button>
          </p>
        </div>
      )}
    </div>
  );
}
