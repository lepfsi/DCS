'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_BASE } from '@/lib/api';
import { Download, FileText } from 'lucide-react';

function FieldInput({ f, value, onChange }: { f: any; value: any; onChange: (v: any) => void }) {
  const common = { value: value ?? '', onChange: (e: any) => onChange(e.target.value), style: { width: '100%' } };
  if (f.type === 'textarea') return <textarea {...common} rows={4} />;
  const type = f.type === 'currency' || f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
  return <input {...common} type={type} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} />;
}

export default function DocDetail({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saveState, setSaveState] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [revs, setRevs] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [diffRange, setDiffRange] = useState({ from: '', to: '' });
  const [links, setLinks] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [wf, setWf] = useState<any>(null);
  const [record, setRecord] = useState<any>(null);
  const [cert, setCert] = useState<any>(null);
  const [certForm, setCertForm] = useState({ holderName: '', programTitle: '', expiresAt: '' });
  const [bizLists, setBizLists] = useState<any>({ customers: [], projects: [] });
  const [linkBiz, setLinkBiz] = useState({ customerId: '', projectId: '' });
  const [err, setErr] = useState('');
  const timer = useRef<any>(null);

  const refresh = useCallback(async () => {
    const r = await api(`/documents/${params.id}`);
    setDoc(r.data); setValues(r.data.fields);
    setPreview((await api(`/documents/${params.id}/preview`)).data);
    setRevs((await api(`/documents/${params.id}/revisions`)).data);
    setLinks((await api(`/documents/${params.id}/links`)).data);
    setAudit((await api(`/documents/${params.id}/audit`)).data);
    setSchema((await api(`/documents/${params.id}/schema`)).data);
    setWf((await api(`/documents/${params.id}/workflow`)).data);
    setRecord((await api(`/documents/${params.id}/record`)).data);
    api('/certificates').then((r) => setCert(r.data.find((c: any) => c.documentId === params.id) ?? null)).catch(() => {});
  }, [params.id]);

  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, [refresh]);
  useEffect(() => {
    api('/customers').then((r) => setBizLists((b: any) => ({ ...b, customers: r.data }))).catch(() => {});
    api('/projects').then((r) => setBizLists((b: any) => ({ ...b, projects: r.data }))).catch(() => {});
    api('/documents').then((r) => setDocList(r.data.filter((d: any) => d.id !== params.id))).catch(() => {});
  }, []);

  // Autosave : PATCH débouncé → nouvelle révision à chaque sauvegarde (US-2.1/2.3).
  function edit(key: string, v: any) {
    const nv = { ...values, [key]: v };
    setValues(nv);
    setSaveState('modifié…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api(`/documents/${params.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { [key]: v } }) });
        setSaveState('enregistré');
        refresh().catch(() => {});
      } catch (e: any) { setSaveState(`erreur : ${e.message}`); }
    }, 800);
  }

  async function loadDiff() {
    const q = [diffRange.from && `from=${diffRange.from}`, diffRange.to && `to=${diffRange.to}`].filter(Boolean).join('&');
    setDiff((await api(`/documents/${params.id}/diff${q ? `?${q}` : ''}`)).data);
  }
  // Transition workflow : motif et rôle de signature demandés si requis. Échec = état d'erreur avec retry.
  const [actionErr, setActionErr] = useState<{ msg: string; retry: () => void } | null>(null);
  async function act(action: string, needsReason?: boolean, needsRole?: boolean, expected: string[] = []) {
    setActionErr(null);
    try {
      const reason = needsReason ? prompt(`Motif (obligatoire pour ${action}) :`) ?? '' : undefined;
      const role = needsRole ? prompt(`Rôle de signature (${expected.join(', ')}) :`) ?? '' : undefined;
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action, reason, role }) });
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: `Action ${action} refusée : ${e.message}. Données conservées, workflow inchangé.`, retry: () => act(action, needsReason, needsRole, expected) }); }
  }
  async function generate() {
    setActionErr(null);
    try {
      const r = await api('/artifacts/generate', { method: 'POST', body: JSON.stringify({ documentId: params.id }) });
      await refresh().catch(() => {});
      downloadArtifact(r.data.id);
    } catch (e: any) { setActionErr({ msg: `Génération impossible : ${e.message}. Données conservées.`, retry: generate }); }
  }
  // Téléchargement : le PDF faisant foi, direct depuis le stockage contrôlé.
  async function downloadArtifact(artifactId: string, filename?: string) {
    try {
      const token = localStorage.getItem('dcs_token');
      const r = await fetch(`${API_BASE}/artifacts/${artifactId}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename ?? `${doc?.reference ?? 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setActionErr({ msg: `Téléchargement impossible : ${e.message}.`, retry: () => downloadArtifact(artifactId, filename) }); }
  }
  async function derive() {
    const r = await api(`/documents/${params.id}/derive`, { method: 'POST', body: JSON.stringify({}) });
    alert(`Dérivé : ${r.data.reference}`);
  }
  // Liaison documentaire : relie ce document à un autre (proposition → contrat → facture).
  const [linkDoc, setLinkDoc] = useState({ toId: '', link_type: 'relates_to' });
  const [docList, setDocList] = useState<any[]>([]);
  async function linkDocument() {
    if (!linkDoc.toId) return;
    try {
      await api('/document-links', { method: 'POST', body: JSON.stringify({ fromDocumentId: params.id, toDocumentId: linkDoc.toId, link_type: linkDoc.link_type }) });
      setLinkDoc({ toId: '', link_type: 'relates_to' });
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: `Liaison impossible : ${e.message}.`, retry: linkDocument }); }
  }
  async function linkBusiness() {
    const business: any = {};
    if (linkBiz.customerId) business.customerId = linkBiz.customerId;
    if (linkBiz.projectId) business.projectId = linkBiz.projectId;
    await api(`/documents/${params.id}`, { method: 'PATCH', body: JSON.stringify({ business }) });
    refresh().catch(() => {});
  }

  if (err) return <p style={{ background: '#fff3f3', padding: 12 }}>Erreur : {err}</p>;
  if (!doc) return <p>Chargement…</p>;
  return (
    <div>
      <h2>{doc.reference} - {doc.title}</h2>
      <p>État : <strong>{doc.state}</strong> · rév. {doc.currentRevision} · {doc.type_code} · confidentialité : {doc.confidentiality ?? 'internal'} · <em>{saveState}</em></p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', padding: 16 }}>
          <h3>Formulaire (autosave)</h3>
          {(schema?.fields ?? []).map((f: any) => (
            <div key={f.key} style={{ marginTop: 8 }}>
              <label>{f.label} {f.required && '*'}</label>
              <FieldInput f={f} value={values[f.key]} onChange={(v) => edit(f.key, v)} />
            </div>
          ))}
          <h3>Preview (sans PDF)</h3>
          <pre>{JSON.stringify(preview?.fields, null, 2)}</pre>
          {preview && preview.missing.length > 0 && <p>Manquants : {preview.missing.join(', ')}</p>}
          {preview?.canGenerate && <button onClick={generate}>Generate final PDF</button>}
        </div>
        <div style={{ background: '#fff', padding: 16 }}>
          <h3>Révisions ({revs.length}) + diff</h3>
          <pre>{JSON.stringify(revs.map((r) => ({ rev: r.rev, at: r.createdAt.slice(0, 16), summary: r.changeSummary })), null, 2)}</pre>
          <div>
            <input placeholder="from" value={diffRange.from} onChange={(e) => setDiffRange({ ...diffRange, from: e.target.value })} style={{ width: 60 }} />
            <input placeholder="to" value={diffRange.to} onChange={(e) => setDiffRange({ ...diffRange, to: e.target.value })} style={{ width: 60 }} />
            <button onClick={loadDiff}>Diff</button>
          </div>
          {diff && <pre>{JSON.stringify(diff, null, 2)}</pre>}
          <h3>Liens ({links.length})</h3>
          {links.map((l: any) => <div key={l.id}>{l.direction === 'out' ? 'sortant' : 'entrant'} [{l.link_type}] {l.document?.reference} - {l.document?.title}</div>)}
          <button onClick={derive} style={{ marginTop: 8 }}>Dériver un document (derives_from)</button>
          <div style={{ marginTop: 8 }}>
            <select value={linkDoc.toId} onChange={(e) => setLinkDoc({ ...linkDoc, toId: e.target.value })} style={{ maxWidth: 260 }}>
              <option value="">Lier à...</option>
              {docList.map((d: any) => <option key={d.id} value={d.id}>{d.reference} - {d.title}</option>)}
            </select>
            <select value={linkDoc.link_type} onChange={(e) => setLinkDoc({ ...linkDoc, link_type: e.target.value })} style={{ marginLeft: 8, maxWidth: 140 }}>
              {['relates_to', 'amends', 'supersedes', 'invoices', 'evidences', 'derives_from'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={linkDocument} style={{ marginLeft: 8 }}>Lier</button>
          </div>
          <h3>Contexte métier</h3>
          <div style={{ fontSize: 13 }}>
            <div>Client : {record?.business?.customer?.name ?? '-'} · Projet : {record?.business?.project?.title ?? '-'}</div>
            <div>Services : {(record?.business?.services ?? []).map((s: any) => s.name).join(', ') || '-'}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <select value={linkBiz.customerId} onChange={(e) => setLinkBiz({ ...linkBiz, customerId: e.target.value })}>
              <option value="">Client...</option>
              {bizLists.customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={linkBiz.projectId} onChange={(e) => setLinkBiz({ ...linkBiz, projectId: e.target.value })} style={{ marginLeft: 8 }}>
              <option value="">Projet...</option>
              {bizLists.projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button onClick={linkBusiness} style={{ marginLeft: 8 }}>Lier</button>
          </div>
          <h3>Workflow - {wf?.workflowKey}</h3>
          <p>Steps : {(wf?.steps ?? []).join(' → ')}</p>
          {(wf?.transitions ?? []).length === 0 && !['issued', 'archived', 'rejected', 'cancelled', 'revoked', 'superseded', 'expired'].includes(doc.state) && (
            <div className="card" style={{ background: '#fafbfc' }}>
              <strong>Lecture seule pour votre rôle.</strong>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>Vous pouvez voir ce document, mais vous n'êtes pas autorisé à exécuter la prochaine action. L'information reste visible, seule l'action est réservée.</p>
            </div>
          )}
          {actionErr && (
            <div className="alert-err" style={{ marginBottom: 8 }}>
              <strong>Échec : </strong>{actionErr.msg} <button className="btn" onClick={actionErr.retry}>Retry</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(wf?.transitions ?? []).map((t: any) => (
              <button key={t.action} onClick={() => act(t.action, t.requiresReason, t.needsRoleParam, wf.expectedSignatures)}>
                {t.action}{t.requiresReason ? ' *' : ''}
              </button>
            ))}
          </div>
          <p>
            <a className="btn" href={`/documents/${doc.id}/review`}>Review workspace</a>{' '}
            <a className="btn" href={`/documents/${doc.id}/approve`}>Approval workspace</a>
          </p>
          <h4>Signatures ({(wf?.signatures ?? []).length}/{ (wf?.expectedSignatures ?? []).length})</h4>
          {(wf?.signatures ?? []).map((s: any) => <div key={s.id}>[signé] {s.role} - rév.{s.revision} - {s.createdAt.slice(0, 16)}</div>)}
          <p>Attendues : {(wf?.expectedSignatures ?? []).join(', ')}</p>
          <h3>Artefacts PDF</h3>
          {(record?.artifacts ?? []).map((a: any) => (
            <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={14} />
              <span>rév.{a.revision} · {a.sha256.slice(0, 12)}... · {a.fileOk ? '[vérifié]' : '[KO]'}{a.isAuthoritative ? ' · faisant foi' : ''}</span>
              <button className="btn" onClick={() => downloadArtifact(a.id, `${doc.reference}-rev${a.revision}.pdf`)}><Download size={13} style={{ verticalAlign: -2 }} /> Télécharger</button>
            </div>
          ))}
          {(record?.artifacts ?? []).length === 0 && <p className="subtitle">Aucun PDF généré. Le bouton Generate final PDF ci-dessus en crée un.</p>}
          <h3>Dossier de preuve</h3>
          {record ? (
            <div style={{ fontSize: 13 }}>
              <div>Chaine audit : {record.verification.ok ? `[OK] ${record.verification.count} maillons` : `[ROMPUE] à ${record.verification.brokenAt}`}</div>
              <div>Artefacts : {record.artifacts.map((a: any) => `${a.revision}:${a.sha256.slice(0, 8)}${a.fileOk ? '[OK]' : '[KO]'}`).join(', ') || '-'}</div>
              <div>Révisions : {record.revisions} · Liens : {record.links.length} · Événements : {record.timeline.length}</div>
              <div>Owner : {record.owner?.displayName} ({record.owner?.role}) · Template : v{record.template?.version} ({record.template?.status})</div>
            </div>
          ) : <p>Chargement...</p>}
          {doc.family === 'CERTIFICATE' && (
            <div style={{ marginTop: 12 }}>
              <h3>Certificat</h3>
              {cert ? (
                <div style={{ fontSize: 13 }}>
                  <div>N° {cert.certificateNo} · statut [{cert.effectiveStatus ?? cert.status}]</div>
                  <div>Titulaire : {cert.holderName} · {cert.programTitle}</div>
                  <div>Vérification : <a href={`/verify/${cert.certificateNo}`}>{cert.qrUrl}</a></div>
                  {(cert.effectiveStatus ?? cert.status) === 'valid' && (
                    <button onClick={async () => {
                      const reason = prompt('Motif de révocation :') ?? '';
                      await api(`/certificates/${cert.certificateNo}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
                      refresh().catch(() => {});
                    }}>Révoquer</button>
                  )}
                </div>
              ) : (
                <div>
                  <p>État document : {doc.state} (émission requise avant certification)</p>
                  <input placeholder="Titulaire" value={certForm.holderName} onChange={(e) => setCertForm({ ...certForm, holderName: e.target.value })} style={{ width: '100%' }} />
                  <input placeholder="Programme" value={certForm.programTitle} onChange={(e) => setCertForm({ ...certForm, programTitle: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  <input type="date" value={certForm.expiresAt} onChange={(e) => setCertForm({ ...certForm, expiresAt: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  <button onClick={async () => {
                    try {
                      await api(`/documents/${params.id}/certificate`, { method: 'POST', body: JSON.stringify({ ...certForm, expiresAt: certForm.expiresAt || null }) });
                      refresh().catch(() => {});
                    } catch (e: any) { alert(`Refusé : ${e.message}`); }
                  }} style={{ marginTop: 8 }}>Émettre le certificat</button>
                </div>
              )}
            </div>
          )}
          <h3>Timeline d'audit</h3>
          {audit.map((a) => <div key={a.id}>· {a.createdAt.slice(11, 19)} - {a.eventType} ({a.actorRole})</div>)}
        </div>
      </div>
    </div>
  );
}
