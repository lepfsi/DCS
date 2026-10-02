'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, me } from '@/lib/api';

const DOMAINS = ['OFFICIAL', 'BUSINESS', 'LEGAL', 'CERTIFICATE', 'HR', 'FINANCE'];

function FieldInput({ f, value, onChange }: { f: any; value: any; onChange: (v: any) => void }) {
  const common = { value: value ?? '', onChange: (e: any) => onChange(e.target.value), style: { width: '100%' } };
  if (f.type === 'textarea') return <textarea {...common} rows={4} className="input" />;
  const type = f.type === 'currency' || f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
  return <input {...common} className="input" type={type} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} />;
}

export default function NewDocPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [types, setTypes] = useState<any[]>([]);
  const [domain, setDomain] = useState('');
  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [schema, setSchema] = useState<any>(undefined);
  const [values, setValues] = useState<Record<string, any>>({});
  const [role, setRole] = useState('');
  const [err, setErr] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selCustomer, setSelCustomer] = useState('');
  const [selProject, setSelProject] = useState('');
  const [selServices, setSelServices] = useState<string[]>([]);

  useEffect(() => {
    api('/document-types').then((r) => setTypes(r.data)).catch((e) => setErr(e.message));
    api('/customers').then((r) => setCustomers(r.data)).catch(() => {});
    api('/projects').then((r) => setProjects(r.data)).catch(() => {});
    api('/services').then((r) => setServices(r.data)).catch(() => {});
    me().then((u) => setRole(u.role)).catch(() => {});
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('customer')) setSelCustomer(sp.get('customer')!);
    if (sp.get('project')) setSelProject(sp.get('project')!);
  }, []);
  useEffect(() => {
    if (step !== 3 || !type) return;
    setSchema(undefined); setValues({});
    api('/templates').then((r) => {
      const tpl = r.data.find((t: any) => t.type_code === type);
      if (!tpl) { setSchema(null); return; }
      api(`/templates/${tpl.id}/schema`).then((s) => setSchema(s.data)).catch(() => setSchema(null));
    }).catch(() => setSchema(null));
  }, [step, type]);

  const canManageTemplates = role === 'admin' || role === 'doc_manager';

  // Pas d'impasse : génère le brouillon manquant, la publication reste une décision humaine.
  async function ensureTemplate() {
    setErr('');
    try {
      await api('/templates/ensure', { method: 'POST', body: JSON.stringify({ type_code: type }) });
      const r = await api('/templates');
      const tpl = r.data.find((t: any) => t.type_code === type);
      if (tpl) {
        const s = await api(`/templates/${tpl.id}/schema`);
        setSchema(s.data);
      }
    } catch (e: any) { setErr(e.message); }
  }

  async function prefill() {
    setErr('');
    try {
      const q = [`customerId=${selCustomer}`, `projectId=${selProject}`, `serviceIds=${selServices.join(',')}`].filter((x) => !x.endsWith('=')).join('&');
      const r = await api(`/documents/prefill?type_code=${type}&${q}`);
      setValues({ ...values, ...r.data });
    } catch (e: any) { setErr(e.message); }
  }

  async function create() {
    setErr('');
    if (!title.trim()) { setErr('Le titre est requis : donnez un nom explicite au document.'); return; }
    if (!schema) return;
    try {
      const business: any = {};
      if (selCustomer) business.customerId = selCustomer;
      if (selProject) business.projectId = selProject;
      if (selServices.length > 0) business.serviceIds = selServices;
      const r = await api('/documents', { method: 'POST', body: JSON.stringify({ type_code: type, title: title.trim(), fields: values, ...(Object.keys(business).length > 0 ? { business } : {}) }) });
      router.push(`/documents/${r.data.id}`);
    } catch (e: any) { setErr(e.message); }
  }

  const domainTypes = types.filter((t) => t.family === domain);

  return (
    <div>
      <h1>Create Document</h1>
      <p className="subtitle">What do you want to create?</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}

      {step === 1 && (
        <div className="grid2">
          {DOMAINS.map((d) => (
            <button key={d} className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => { setDomain(d); setStep(2); }}>
              <strong>{d}</strong>
              <div className="micro">{types.filter((t) => t.family === d).length} types</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="micro">{domain} <button className="btn" onClick={() => setStep(1)}>Change</button></p>
          {domainTypes.map((t) => (
            <div key={t.type_code} className="card" style={{ marginBottom: 8, borderColor: type === t.type_code ? 'var(--accent)' : undefined }}>
              <strong>{t.label}</strong>
              <div className="micro">{t.type_code} · workflow {t.workflow_key}</div>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => { setType(t.type_code); setStep(3); }}>Continue</button>
            </div>
          ))}
          {domainTypes.length === 0 && <div className="empty"><strong>No types in this domain yet.</strong></div>}
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="micro">{domain} / {type} <button className="btn" onClick={() => setStep(2)}>Change</button></p>
          <label className="lbl">Title (requis)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Proposition Acme - refonte SI" />
          {schema === undefined && <p>Chargement du formulaire...</p>}
          {schema === null && (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Aucun template utilisable pour ce type.</strong>
              <p className="subtitle">Un document nait toujours d'un template approuvé. Le système peut générer le brouillon, un gestionnaire le complète puis le publie.</p>
              {canManageTemplates
                ? <button className="btn btn-primary" onClick={ensureTemplate}>Générer le brouillon</button>
                : <p className="subtitle">Votre rôle ({role || '...'}) ne gère pas les templates. Demandez à un gestionnaire ou administrateur de préparer ce type.</p>}
              <p style={{ marginTop: 8 }}><a href="/templates">Ouvrir la bibliothèque de templates</a></p>
            </div>
          )}
          {schema && domain === 'BUSINESS' && (
            <div className="card" style={{ marginTop: 12 }}>
              <h3>Contexte métier</h3>
              <label className="lbl">Client</label>
              <select className="input" value={selCustomer} onChange={(e) => setSelCustomer(e.target.value)}>
                <option value="">-</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="lbl">Projet</label>
              <select className="input" value={selProject} onChange={(e) => setSelProject(e.target.value)}>
                <option value="">-</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <div style={{ marginTop: 8 }}>Services : {services.map((s) => (
                <label key={s.id} style={{ marginRight: 12 }}>
                  <input type="checkbox" checked={selServices.includes(s.id)} onChange={() => setSelServices(selServices.includes(s.id) ? selServices.filter((x) => x !== s.id) : [...selServices, s.id])} /> {s.name} ({s.unitPrice})
                </label>
              ))}</div>
              <button className="btn" style={{ marginTop: 8 }} onClick={prefill}>Pré-remplir</button>
            </div>
          )}
          {schema && schema.fields.map((f: any) => (
            <div key={f.key}>
              <label className="lbl">{f.label} {f.required && '*'}</label>
              <FieldInput f={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
            </div>
          ))}
          {schema && schema.fields.length === 0 && (
            <p className="subtitle">Ce brouillon n'a pas encore de champs. Un gestionnaire les définit dans Templates, puis publie.</p>
          )}
          <p style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={create} disabled={!schema || !title.trim()}>Save draft</button>
          </p>
        </div>
      )}
    </div>
  );
}
