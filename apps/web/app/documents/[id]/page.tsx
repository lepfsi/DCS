'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_BASE } from '@/lib/api';
import { Download, FileText, FileSignature, Link2, Printer, GitBranch, Plus, ArrowLeft, Bot } from 'lucide-react';
import { StateBadge, Dialog, Stepper, FieldVal, DocPreview, Empty, SmartField, toast } from '@/components/ui';
import { actionLabel, eventLabel, linkLabel, familyLabel, stateLabel, actorLabel, CONF_LABEL, ROLE_LABEL, STEP_LABEL, fmtDate, fmtDateTime, humanizeDiff } from '@/lib/ui';

const REASON_HINT: Record<string, string> = {
  request_changes: 'Précisez au préparateur ce qui doit être corrigé.',
  reject: 'Cette décision empêchera l\'émission du document.',
  cancel: 'Cette action met fin au document sans l\'émettre.',
  revoke: 'La révocation retire le document de circulation en préservant l\'historique.',
  expire: 'L\'expiration clôt le document à sa date d\'échéance.',
  supersede: 'Le document sera remplacé par sa nouvelle version.',
};

export default function DocDetail({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [typeLabel, setTypeLabel] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [revs, setRevs] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [wf, setWf] = useState<any>(null);
  const [record, setRecord] = useState<any>(null);
  const [assignees, setAssignees] = useState<any>(null);
  const [cert, setCert] = useState<any>(null);
  const [certForm, setCertForm] = useState({ holderName: '', programTitle: '', expiresAt: '' });
  const [bizLists, setBizLists] = useState<any>({ customers: [], projects: [] });
  const [docList, setDocList] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [tab, setTab] = useState('contenu');
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [actionErr, setActionErr] = useState<{ msg: string; retry: () => void } | null>(null);
  const timer = useRef<any>(null);
  // Dialogues (§27) : remplacent prompt/alert/confirm.
  const [reasonDlg, setReasonDlg] = useState<{ action: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [signDlg, setSignDlg] = useState(false);
  const [signRole, setSignRole] = useState('');
  const [meSig, setMeSig] = useState<any>(null);
  const [signName, setSignName] = useState('');
  const [signPass, setSignPass] = useState('');
  const [signPass2, setSignPass2] = useState('');
  const [sigBusy, setSigBusy] = useState(false);
  const [sigErr, setSigErr] = useState('');
  const [deriveDlg, setDeriveDlg] = useState(false);
  const [deriveForm, setDeriveForm] = useState({ type_code: '', title: '' });
  const [revokeDlg, setRevokeDlg] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ toId: '', link_type: 'relates_to' });
  const [submitDlg, setSubmitDlg] = useState(false);
  const [submitDue, setSubmitDue] = useState('');
  const [assignDlg, setAssignDlg] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({ action: 'review', target: 'user', userId: '', role: 'reviewer', department: '', note: '' });
  const [dirUsers, setDirUsers] = useState<any[]>([]);
  const [dirQuery, setDirQuery] = useState('');
  const [aiOn, setAiOn] = useState(false);
  const [aiDlg, setAiDlg] = useState<{ key: string; label: string } | null>(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await api(`/documents/${params.id}`);
    setDoc(r.data); setValues(r.data.fields);
    setRevs((await api(`/documents/${params.id}/revisions`)).data);
    setLinks((await api(`/documents/${params.id}/links`)).data);
    setWf((await api(`/documents/${params.id}/workflow`)).data);
    setRecord((await api(`/documents/${params.id}/record`)).data);
    api(`/documents/${params.id}/assignees`).then((r) => setAssignees(r.data)).catch(() => {});
    setSchema((await api(`/documents/${params.id}/schema`)).data);
    api('/certificates').then((r) => setCert(r.data.find((c: any) => c.documentId === params.id) ?? null)).catch(() => {});
  }, [params.id]);

  useEffect(() => { refresh().catch((e) => setErr(e.message)); }, [refresh]);
  useEffect(() => {
    api('/customers').then((r) => setBizLists((b: any) => ({ ...b, customers: r.data }))).catch(() => {});
    api('/projects').then((r) => setBizLists((b: any) => ({ ...b, projects: r.data }))).catch(() => {});
    api('/people').then((r) => setBizLists((b: any) => ({ ...b, people: r.data }))).catch(() => {});
    api('/services').then((r) => setBizLists((b: any) => ({ ...b, services: r.data }))).catch(() => {});
    api('/documents').then((r) => setDocList(r.data.filter((d: any) => d.id !== params.id))).catch(() => {});
    api('/document-types').then((r) => { setTypes(r.data); }).catch(() => {});
    api('/ai/status').then((r) => setAiOn(!!r.data.enabled)).catch(() => {});
    api('/auth/me').then((r) => setMeSig(r.user)).catch(() => {});
    api('/users').then((r) => setDirUsers(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = types.find((x) => x.type_code === doc?.type_code);
    if (t) setTypeLabel(t.label);
  }, [types, doc]);

  // Autosave débouncé (§8) : états rassurants, jamais de vocabulaire HTTP.
  function edit(key: string, v: any) {
    const nv = { ...values, [key]: v };
    setValues(nv);
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api(`/documents/${params.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { [key]: v } }) });
        setSaveState('saved');
        refresh().catch(() => {});
      } catch { setSaveState('error'); }
    }, 800);
  }

  async function runAction(action: string, extra: Record<string, any> = {}) {
    setActionErr(null);
    try {
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      setOkMsg(action === 'issue' ? 'Document émis. Cette version est définitive.' : `Action « ${actionLabel(action)} » enregistrée.`);
      toast(action === 'issue' ? 'Document émis — son PDF officiel est dans la Bibliothèque.' : `« ${actionLabel(action)} » enregistré.`);
      refresh().catch(() => {});
    } catch (e: any) {
      setActionErr({ msg: `${e.message}. Vos données sont conservées, le processus est inchangé.`, retry: () => runAction(action, extra) });
    }
  }
  // Toute action passe par ici : motif ou rôle demandés en dialogue, jamais en prompt.
  function act(action: string, needsReason?: boolean, needsRole?: boolean, expected: string[] = []) {
    setOkMsg('');
    // Soumettre en revue = le compte à rebours démarre : l'échéance se règle ici.
    if (action === 'submit') {
      setSubmitDue(doc?.dueAt ? doc.dueAt.slice(0, 10) : '');
      setSubmitDlg(true);
      return;
    }
    if (needsRole) {
      setSignDlg(true); setSignRole(expected[0] ?? ''); setSignName(''); setSignPass(''); setSignPass2(''); setSigErr('');
      api('/auth/me').then((r) => setMeSig(r.user)).catch(() => setMeSig(null));
      return;
    }
    if (needsReason) { setReasonDlg({ action }); setReasonText(''); return; }
    runAction(action);
  }
  async function confirmSubmit() {
    setSubmitDlg(false);
    await runAction('submit', submitDue ? { dueAt: new Date(submitDue).toISOString() } : {});
  }
  // Échéance ajustable en brouillon (le responsable garde la main sur le planning).
  async function saveDueAt(v: string) {
    try {
      await api(`/documents/${params.id}`, { method: 'PATCH', body: JSON.stringify({ dueAt: v ? new Date(v).toISOString() : null }) });
      toast(v ? `Échéance fixée au ${new Date(v).toLocaleDateString('fr-FR')}.` : 'Échéance retirée.');
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: `${e.message}`, retry: () => saveDueAt(v) }); }
  }
  async function confirmReason() {
    if (!reasonDlg) return;
    if (!reasonText.trim()) return;
    await runAction(reasonDlg.action, { reason: reasonText.trim() });
    setReasonDlg(null); setReasonText('');
  }
  // Signature électronique : activation personnelle (nom + passphrase), puis
  // passphrase seulement quand la fenêtre de 15 minutes a expiré.
  async function activateSignature() {
    setSigBusy(true); setSigErr('');
    if (signPass !== signPass2) { setSigErr('Les deux passphrases ne correspondent pas.'); setSigBusy(false); return; }
    try {
      const r = await api('/me/signature', { method: 'POST', body: JSON.stringify({ signatureName: signName.trim(), passphrase: signPass }) });
      setMeSig((m: any) => ({ ...m, signingActivated: true, hasPass: true, signatureName: r.data.signatureName, signatureUnlocked: true }));
      toast('Signature électronique activée — vous pouvez signer.');
    } catch (e: any) { setSigErr(e.message); }
    setSigBusy(false);
  }
  async function confirmSign() {
    setSigBusy(true); setSigErr('');
    try {
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action: 'sign', role: signRole, ...(signPass ? { signaturePass: signPass } : {}) }) });
      setSignDlg(false); setSignPass('');
      setOkMsg(`Signature électronique enregistrée au nom de « ${meSig?.signatureName} » — le document émis s'imprimera signé.`);
      toast('Document signé électroniquement.');
      refresh().catch(() => {});
    } catch (e: any) { setSigErr(e.message); }
    setSigBusy(false);
  }
  const needsActivation = !meSig || !meSig.signingActivated || !meSig.hasPass;
  const needsPass = !needsActivation && !meSig.signatureUnlocked;

  async function generate() {
    setActionErr(null);
    try {
      const r = await api('/artifacts/generate', { method: 'POST', body: JSON.stringify({ documentId: params.id }) });
      setOkMsg('Document final généré.');
      toast('Document final généré — PDF en cours de téléchargement.');
      await refresh().catch(() => {});
      downloadArtifact(r.data.id);
    } catch (e: any) { setActionErr({ msg: `Génération impossible : ${e.message}. Les données sont conservées.`, retry: generate }); }
  }
  async function downloadArtifact(artifactId: string, filename?: string) {
    try {
      const token = localStorage.getItem('dcs_token');
      const r = await fetch(`${API_BASE}/artifacts/${artifactId}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('fichier indisponible');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename ?? `${doc?.reference ?? 'document'}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setActionErr({ msg: `Téléchargement impossible : ${e.message}.`, retry: () => downloadArtifact(artifactId, filename) }); }
  }
  // Impression (§19) : utilise le PDF officiel faisant foi, jamais un rendu parallèle.
  async function printArtifact(artifactId: string) {
    setActionErr(null);
    try {
      const token = localStorage.getItem('dcs_token');
      const r = await fetch(`${API_BASE}/artifacts/${artifactId}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error('fichier indisponible');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const f = document.createElement('iframe');
      f.style.display = 'none';
      f.src = url;
      document.body.appendChild(f);
      f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, '_blank'); } };
    } catch (e: any) { setActionErr({ msg: `Impression impossible : ${e.message}.`, retry: () => printArtifact(artifactId) }); }
  }

  async function confirmDerive() {
    try {
      const r = await api(`/documents/${params.id}/derive`, { method: 'POST', body: JSON.stringify({ type_code: deriveForm.type_code || undefined, title: deriveForm.title || undefined }) });
      window.location.href = `/documents/${r.data.id}`;
    } catch (e: any) { setActionErr({ msg: e.message, retry: confirmDerive }); setDeriveDlg(false); }
  }
  async function confirmLink() {
    if (!linkForm.toId) return;
    try {
      await api('/document-links', { method: 'POST', body: JSON.stringify({ fromDocumentId: params.id, toDocumentId: linkForm.toId, link_type: linkForm.link_type }) });
      setLinkForm({ toId: '', link_type: 'relates_to' }); setLinkOpen(false);
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: `Liaison impossible : ${e.message}`, retry: confirmLink }); setLinkOpen(false); }
  }
  async function linkBusiness(business: Record<string, string>) {
    await api(`/documents/${params.id}`, { method: 'PATCH', body: JSON.stringify({ business }) });
    refresh().catch(() => {});
  }
  async function confirmRevokeCert() {
    try {
      await api(`/certificates/${cert.certificateNo}/revoke`, { method: 'POST', body: JSON.stringify({ reason: revokeReason }) });
      setRevokeDlg(false); setRevokeReason('');
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: e.message, retry: confirmRevokeCert }); setRevokeDlg(false); }
  }
  async function issueCert() {
    try {
      await api(`/documents/${params.id}/certificate`, { method: 'POST', body: JSON.stringify({ ...certForm, expiresAt: certForm.expiresAt || null }) });
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: `Certificat refusé : ${e.message}`, retry: issueCert }); }
  }
  // Assistant IA (rédaction) : le texte proposé remplit le champ, l'utilisateur relit et garde la main.
  async function runAiAssist() {
    if (!aiDlg) return;
    setAiBusy(true);
    try {
      const r = await api('/ai/assist', { method: 'POST', body: JSON.stringify({ documentId: params.id, instruction: aiInstruction, context: `champ « ${aiDlg.label} »` }) });
      edit(aiDlg.key, r.data.text);
      setAiDlg(null); setAiInstruction('');
    } catch (e: any) { setActionErr({ msg: `Assistant indisponible : ${e.message}`, retry: runAiAssist }); setAiDlg(null); }
    setAiBusy(false);
  }

  if (err) return <div className="alert-err"><strong>Erreur : </strong>{err}</div>;
  if (!doc) return <p className="muted">Chargement du document…</p>;

  // Stepper humain (§20) : la chaîne dépend des étapes réelles du type — et de
  // l'exigence de signature, qui fait de « Signer » une étape pleine du cycle.
  const typeRequiresSign = !!types.find((t) => t.type_code === doc.type_code)?.requires_signature;
  const hasSign = (wf?.steps ?? []).some((s: string) => s.includes('sign')) || typeRequiresSign;
  const chain = hasSign ? ['draft', 'in_review', 'approved', 'ready_to_sign', 'signed', 'issued'] : ['draft', 'in_review', 'approved', 'issued'];
  const chainLabels = chain.map((s) => STEP_LABEL[s] ?? s);
  const stIdx = (s: string) => chain.indexOf(s === 'ready_to_sign' || s === 'changes_requested' ? 'in_review' : s === 'expired' || s === 'superseded' || s === 'revoked' || s === 'archived' ? 'issued' : s);
  const nowIdx = Math.max(0, stIdx(doc.state));
  const editable = doc.state === 'draft';
  const closed = ['issued', 'archived', 'rejected', 'cancelled', 'revoked', 'superseded', 'expired'].includes(doc.state);
  const activeStates = ['draft', 'in_review', 'changes_requested', 'approved', 'ready_to_sign', 'signed'];
  const isOverdue = !!doc.dueAt && activeStates.includes(doc.state) && doc.dueAt < new Date().toISOString();
  // Assignation : le responsable du document ou un gestionnaire peut confier une étape.
  const canAssign = doc.ownerId === meSig?.id || (meSig?.roles ?? [meSig?.role]).some((r: string) => r === 'admin' || r === 'doc_manager');
  const DEPTS = ['Direction', 'Technique', 'Finance', 'RH', 'Juridique', 'Opérations'];
  const ASSIGN_ROLES = ['reviewer', 'approver', 'signer', 'doc_manager', 'admin', 'author'];
  const RECO: Record<string, string[]> = { review: ['reviewer', 'doc_manager'], approve: ['approver', 'doc_manager'], sign: ['signer', 'approver'] };
  const officialArtifact = (record?.artifacts ?? []).find((a: any) => a.isAuthoritative && a.fileOk);
  const TABS = [
    { key: 'contenu', label: 'Contenu' },
    { key: 'apercu', label: 'Aperçu' },
    { key: 'processus', label: 'Processus' },
    { key: 'associes', label: `Documents associés (${links.length})` },
    { key: 'historique', label: 'Historique' },
    { key: 'preuve', label: 'Preuve' },
  ];

  return (
    <div>
      <p className="no-print"><a href="/documents" className="link-plain" style={{ fontSize: 13 }}><ArrowLeft size={13} style={{ verticalAlign: -2 }} /> Documents</a></p>
      <h1>{doc.title}</h1>
      <p className="subtitle">
        {doc.reference} · <StateBadge state={doc.state} /> · Révision {doc.currentRevision} · {typeLabel || familyLabel(doc.family)} · Confidentialité : {CONF_LABEL[doc.confidentiality ?? 'internal'] ?? doc.confidentiality}
        {isOverdue && <>{' '}<span className="badge pri-overdue">EN RETARD</span></>}
        {editable && saveState !== 'idle' && (
          <em className={'savestate ' + (saveState === 'saving' ? 'saving' : saveState === 'saved' ? 'saved' : 'error')}>
            {saveState === 'saving' ? ' · Enregistrement…' : saveState === 'saved' ? ' · Enregistré' : ' · Modification non enregistrée'}
          </em>
        )}
      </p>

      {okMsg && <div className="alert-ok no-print" style={{ marginBottom: 10 }}>{okMsg}</div>}
      {actionErr && (
        <div className="alert-err no-print" style={{ marginBottom: 10 }}>
          <strong>Échec : </strong>{actionErr.msg} <button className="btn" onClick={actionErr.retry}>Réessayer</button>
        </div>
      )}

      {/* ActionBar (§9) : actions contextualisées, libellés métier. */}
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        {(wf?.transitions ?? []).map((t: any) => (
          <button key={t.action} className={'btn ' + (['approve', 'issue', 'submit'].includes(t.action) ? 'btn-primary' : ['reject', 'cancel', 'revoke'].includes(t.action) ? 'btn-danger' : '')}
            onClick={() => act(t.action, t.requiresReason, t.needsRoleParam, wf.expectedSignatures)}>
            {actionLabel(t.action)}{t.requiresReason ? '…' : ''}
          </button>
        ))}
        {officialArtifact && (
          <>
            <button className="btn" onClick={() => downloadArtifact(officialArtifact.id, `${doc.reference}-rev${doc.currentRevision}.pdf`)}><Download size={13} style={{ verticalAlign: -2 }} /> Télécharger le PDF officiel</button>
            <button className="btn" onClick={() => printArtifact(officialArtifact.id)}><Printer size={13} style={{ verticalAlign: -2 }} /> Imprimer</button>
          </>
        )}
        <button className="btn" onClick={() => { setDeriveForm({ type_code: doc.type_code, title: '' }); setDeriveDlg(true); }}><GitBranch size={13} style={{ verticalAlign: -2 }} /> Créer à partir de ce document</button>
        <button className="btn" onClick={() => setLinkOpen(!linkOpen)}><Link2 size={13} style={{ verticalAlign: -2 }} /> Associer un document</button>
      </div>
      {(wf?.transitions ?? []).length === 0 && !closed && (
        <div className="card no-print" style={{ background: '#fafbfc', marginBottom: 12 }}>
          <strong>Lecture seule pour votre rôle.</strong>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>Vous pouvez consulter ce document, mais la prochaine action est réservée au responsable désigné. <a href="/inbox">Voir le processus</a></p>
        </div>
      )}
      {linkOpen && (
        <div className="card no-print" style={{ marginBottom: 12 }}>
          <h3>Associer un document</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="input" style={{ maxWidth: 320 }} value={linkForm.toId} onChange={(e) => setLinkForm({ ...linkForm, toId: e.target.value })}>
              <option value="">Choisir un document…</option>
              {docList.map((d: any) => <option key={d.id} value={d.id}>{d.reference} — {d.title}</option>)}
            </select>
            <select className="input" style={{ maxWidth: 220 }} value={linkForm.link_type} onChange={(e) => setLinkForm({ ...linkForm, link_type: e.target.value })}>
              {Object.entries({ relates_to: 'associé à', amends: 'modifie', supersedes: 'remplace', invoices: 'facture', evidences: 'prouve', derives_from: 'créé à partir de' }).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn btn-primary" onClick={confirmLink}>Associer</button>
          </div>
        </div>
      )}

      {/* INFORMATIONS (§9) */}
      <div className="card" style={{ marginBottom: 14 }}>
        <dl className="kv">
          <dt>Client</dt><dd>{record?.business?.customer?.name ?? '—'}</dd>
          <dt>Projet</dt><dd>{record?.business?.project?.title ?? '—'}</dd>
          <dt>Responsable</dt><dd>{record?.owner?.displayName ?? '—'}{record?.owner ? ` (${record.owner.role})` : ''}</dd>
          <dt>Échéance</dt>
          <dd>
            {editable
              ? <DueEditor initial={doc.dueAt?.slice(0, 10) ?? ''} onSave={saveDueAt} />
              : doc.dueAt
                ? <span style={isOverdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{fmtDate(doc.dueAt)}{isOverdue ? ' — en retard' : ''}</span>
                : <span className="muted">—</span>}
          </dd>
        </dl>
        {editable && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <select className="input" style={{ maxWidth: 260 }} value={doc.business?.customerId ?? ''} onChange={(e) => linkBusiness({ customerId: e.target.value })}>
              <option value="">Associer un client…</option>
              {bizLists.customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" style={{ maxWidth: 260 }} value={doc.business?.projectId ?? ''} onChange={(e) => linkBusiness({ projectId: e.target.value })}>
              <option value="">Associer un projet…</option>
              {bizLists.projects.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="tabs no-print">
        {TABS.map((t) => <button key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {tab === 'contenu' && (
        <div>
          {editable ? (
            <div className="card">
              {(schema?.fields ?? []).map((f: any) => (
                <SmartField key={f.key} f={f} value={values[f.key]} values={values}
                  lists={{
                    customers: (bizLists.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })),
                    projects: (bizLists.projects ?? []).map((p: any) => ({ id: p.id, name: p.title })),
                    people: (bizLists.people ?? []).map((p: any) => ({ id: p.id, name: p.fullName })),
                    services: (bizLists.services ?? []).map((s: any) => ({ id: s.id, name: s.name })),
                  }}
                  onChange={(v) => edit(f.key, v)}>
                  {aiOn && f.type === 'textarea' && (
                    <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => { setAiDlg({ key: f.key, label: f.label }); setAiInstruction(''); }}><Bot size={12} style={{ verticalAlign: -2 }} /> Assistance IA</button>
                  )}
                </SmartField>
              ))}
              {(schema?.fields ?? []).length === 0 && <Empty title="Ce modèle ne définit pas encore de champs." hint="Un gestionnaire les prépare dans la bibliothèque de modèles." />}
            </div>
          ) : (
            <div>
              <div className="card">
                {(schema?.fields ?? []).map((f: any) => (
                  <div key={f.key} className="a4-row" style={{ maxWidth: 720 }}>
                    <span className="a4-lbl">{f.label}</span>
                    <span><FieldVal f={f} value={values[f.key]} /></span>
                  </div>
                ))}
              </div>
              <p className="subtitle" style={{ marginTop: 10 }}>
                {closed
                  ? <>Ce document est clos. Son historique et sa preuve restent consultables.{doc.state === 'issued' && <> Son PDF officiel est disponible dans la <a href="/library">Bibliothèque</a>, prêt à télécharger et imprimer.</>}</>
                  : 'Document en lecture seule à cette étape du processus. Les modifications créent une nouvelle révision selon la politique du type.'}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'apercu' && (
        <div>
          <DocPreview doc={doc} schema={schema} values={values} template={record?.template} typeLabel={typeLabel} />
          {preview_missing().length > 0 && (
            <div className="alert-err" style={{ maxWidth: 720, margin: '12px auto' }}>
              <strong>Informations manquantes : </strong>{preview_missing().map((k: string) => schema?.fields?.find((f: any) => f.key === k)?.label ?? k).join(', ')}
            </div>
          )}
          {preview_missing().length === 0 && !officialArtifact && (wf?.transitions ?? []).some((t: any) => t.action === 'generate_final') && (
            <p style={{ textAlign: 'center', marginTop: 12 }}><button className="btn btn-primary" onClick={generate}><FileText size={13} style={{ verticalAlign: -2 }} /> Générer le document final</button></p>
          )}
          {officialArtifact && <p className="subtitle" style={{ textAlign: 'center', marginTop: 12 }}>Le PDF officiel de la révision {officialArtifact.revision} fait foi. Toute correction crée une nouvelle révision.</p>}
        </div>
      )}

      {tab === 'processus' && (
        <div>
          <div className="card">
            <Stepper steps={chainLabels} current={nowIdx} />
            <div style={{ marginTop: 16 }}>
              {expectedNow() ? (
                <div>
                  <span className="micro">En ce moment — {expectedNow()!.step}{expectedNow()!.assigned ? ' (personne assignée)' : ''}</span>
                  <div style={{ fontSize: 14.5, marginTop: 4 }}>
                    {expectedNow()!.people.length > 0
                      ? <>Attendu : <strong>{expectedNow()!.people.join(', ')}</strong></>
                      : <span style={{ color: 'var(--danger)' }}>Personne n'est disponible pour cette étape — assignez quelqu'un ou vérifiez les rôles/périmètres.</span>}
                  </div>
                </div>
              ) : (
                <span className="micro">Processus terminé — document {stateLabel(doc.state).toLowerCase()}.</span>
              )}
            </div>
            {canAssign && !closed && (
              <p style={{ marginTop: 12, marginBottom: 0 }}>
                <button className="btn" onClick={() => { setAssignForm({ action: doc.state === 'ready_to_sign' ? 'sign' : 'review', target: 'user', userId: '', role: RECO[doc.state === 'ready_to_sign' ? 'sign' : 'review']?.[0] ?? 'reviewer', department: '', note: '' }); setDirQuery(''); setAssignDlg(true); }}>Confier une étape à quelqu'un…</button>
              </p>
            )}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>Actions disponibles pour vous</h3>
            {(wf?.transitions ?? []).length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(wf?.transitions ?? []).map((t: any) => (
                  <button key={t.action} className="btn" onClick={() => act(t.action, t.requiresReason, t.needsRoleParam, wf.expectedSignatures)}>{actionLabel(t.action)}{t.requiresReason ? '…' : ''}</button>
                ))}
              </div>
            ) : <p className="subtitle" style={{ margin: 0 }}>Aucune action attendue de vous à cette étape.</p>}
            <h3>Signatures {(wf?.signatures ?? []).length}/{(wf?.expectedSignatures ?? []).length}</h3>
            {(wf?.signatures ?? []).length === 0 && <p className="subtitle">Aucune signature enregistrée sur ce document.</p>}
            {(wf?.signatures ?? []).map((s: any) => (
              <div key={s.id} style={{ fontSize: 13, padding: '4px 0' }}>✓ Signé électroniquement par <strong>{s.signatureName ?? s.signerId.slice(0, 8)}</strong> ({ROLE_LABEL[s.role] ?? s.role}) — révision {s.revision} — {fmtDateTime(s.createdAt)}</div>
            ))}
            {(wf?.expectedSignatures ?? []).length > 0 && (
              <p className="micro">Signatures attendues : {(wf?.expectedSignatures ?? []).map((r: string) => ROLE_LABEL[r] ?? r).join(', ')}</p>
            )}
            {closed && <p className="subtitle" style={{ marginTop: 8 }}>Ce document est à l'étape finale de son cycle.</p>}
          </div>

          {/* Parcours (§16) : QUI a fait QUOI à chaque étape du cycle — initiateur,
              revue, approbation, rejet, corrections, signature, émission, escalades. */}
          <div className="card" style={{ marginTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>Parcours du document</h3>
            {(wf?.history ?? []).filter((h: any) => [
              'created', 'submitted_for_review', 'changes_requested', 'approval_granted', 'approval_rejected',
              'signature_completed', 'issued', 'assigned', 'escalation_granted', 'rejected', 'revoked', 'superseded', 'archived', 'expired',
            ].includes(h.eventType)).slice(-10).reverse().map((h: any) => (
              <div key={h.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                <span className="muted">{fmtDateTime(h.createdAt)}</span> — <strong>{actorLabel(h)}</strong> {eventLabel(h.eventType)}
                {h.changeSummary && h.eventType === 'assigned' ? ` : ${h.changeSummary}` : ''}
                {h.reason ? ` — ${h.reason}` : ''}
              </div>
            ))}
            {(wf?.history ?? []).filter((h: any) => h.eventType === 'created').length === 0 && <p className="subtitle">Le parcours s'affichera au fil du cycle.</p>}
            <p className="micro" style={{ marginTop: 8 }}>Journal complet et preuves : onglets Historique et Preuve.</p>
          </div>

          {/* Signature électronique : panneau dédié quand l'étape est atteinte (§17). */}
          {(wf?.transitions ?? []).some((t: any) => t.action === 'sign') && (
            <div className="card" style={{ marginTop: 12, borderTop: '3px solid var(--accent)' }}>
              <h3 style={{ marginTop: 0 }}>Signature électronique</h3>
              {meSig?.signingActivated
                ? <p className="subtitle" style={{ margin: 0 }}>Votre signature « {meSig.signatureName} » est {meSig.signatureUnlocked ? 'déverrouillée — vous pouvez signer sans ressaisir votre passphrase (fenêtre de 15 min).' : 'verrouillée — votre passphrase sera demandée au moment de signer.'}</p>
                : <p className="subtitle" style={{ margin: 0 }}>Vous n'avez pas encore activé votre signature électronique. Activez-la avec votre nom légal et une passphrase : <a href="/signature">activer ma signature</a>.</p>}
              <p style={{ marginTop: 10 }}><button className="btn btn-primary" onClick={() => act('sign', false, true, wf.expectedSignatures)}><FileSignature size={13} style={{ verticalAlign: -2 }} /> Signer électroniquement…</button></p>
              <p className="micro" style={{ marginTop: 6 }}>Le document émis s'imprimera déjà signé — plus besoin de signature manuscrite.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'associes' && (
        <div className="card">
          {links.length === 0 && <Empty title="Aucun document associé" hint="Ce document n'est pas encore relié à la chaîne documentaire." action={<><button className="btn" onClick={() => setLinkOpen(true)}>Associer un document</button>{' '}<button className="btn" onClick={() => { setDeriveForm({ type_code: doc.type_code, title: '' }); setDeriveDlg(true); }}>Créer à partir de ce document</button></>} />}
          {links.map((l: any) => (
            <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              {l.direction === 'out'
                ? <span>Ce document <strong>{linkLabel(l.link_type)}</strong> <a href={`/documents/${l.document?.id}`}>{l.document?.reference} — {l.document?.title}</a></span>
                : <span><a href={`/documents/${l.document?.id}`}>{l.document?.reference} — {l.document?.title}</a> <strong>{linkLabel(l.link_type)}</strong> ce document</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'historique' && <HistoryTab doc={doc} revs={revs} schema={schema} />}

      {tab === 'preuve' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Dossier de preuve</h3>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div>{record?.document?.reference ? '✓' : '○'} Référence unique : {doc.reference}</div>
            <div>✓ Version : révision {doc.currentRevision} ({revs.length} révisions conservées)</div>
            <div>{(record?.signatures ?? []).length > 0 ? '✓' : '○'} Workflow : {(record?.signatures ?? []).length} signature(s) enregistrée(s)</div>
            <div>{officialArtifact ? '✓' : '○'} Document final : {officialArtifact ? `PDF révision ${officialArtifact.revision} vérifié` : 'pas encore généré'}</div>
            <div>✓ Historique : {record?.timeline?.length ?? 0} événements d\'audit</div>
            <div>{record?.verification?.ok ? '✓' : '✗'} Intégrité : {record?.verification?.ok ? `chaîne vérifiée (${record.verification.count} maillons)` : 'chaîne rompue — investigation requise'}</div>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="micro" style={{ cursor: 'pointer' }}>Détails techniques (mode avancé)</summary>
            <div style={{ fontSize: 12.5, marginTop: 8, color: 'var(--muted)' }}>
              {(record?.artifacts ?? []).map((a: any) => <div key={a.id}>PDF rév.{a.revision} — SHA-256 {a.sha256.slice(0, 16)}… — {a.fileOk ? 'fichier vérifié' : 'fichier manquant/altéré'}</div>)}
            </div>
          </details>
          {doc.family === 'CERTIFICATE' && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <h3>Certificat</h3>
              {cert ? (
                <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
                  <div>N° {cert.certificateNo} · {cert.effectiveStatus === 'valid' ? 'Valide' : cert.effectiveStatus === 'revoked' ? 'Révoqué' : 'Expiré'}</div>
                  <div>Titulaire : {cert.holderName} — {cert.programTitle}</div>
                  <div>Page publique de vérification : <a href={`/verify/${cert.certificateNo}`}>ouvrir</a></div>
                  {cert.effectiveStatus === 'valid' && <button className="btn btn-danger" onClick={() => setRevokeDlg(true)}>Révoquer le certificat…</button>}
                </div>
              ) : doc.state === 'issued' ? (
                <div style={{ maxWidth: 420 }}>
                  <p className="subtitle">Document émis : le certificat peut être créé.</p>
                  <label className="lbl">Titulaire *</label>
                  <input className="input" value={certForm.holderName} onChange={(e) => setCertForm({ ...certForm, holderName: e.target.value })} />
                  <label className="lbl">Intitulé du programme *</label>
                  <input className="input" value={certForm.programTitle} onChange={(e) => setCertForm({ ...certForm, programTitle: e.target.value })} />
                  <label className="lbl">Expiration (facultative)</label>
                  <input className="input" type="date" value={certForm.expiresAt} onChange={(e) => setCertForm({ ...certForm, expiresAt: e.target.value })} />
                  <p style={{ marginTop: 8 }}><button className="btn btn-primary" disabled={!certForm.holderName || !certForm.programTitle} onClick={issueCert}>Émettre le certificat</button></p>
                </div>
              ) : <p className="subtitle">Le document doit être émis avant de créer un certificat.</p>}
            </div>
          )}
        </div>
      )}

      {/* Dialogues contextualisés (§27) */}
      <Dialog open={assignDlg} title="Confier une étape de ce document" onClose={() => setAssignDlg(false)}
        footer={<><button className="btn" onClick={() => setAssignDlg(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={confirmAssign}
            disabled={assignForm.target === 'user' ? !assignForm.userId : assignForm.target === 'role' ? !assignForm.role : assignForm.target === 'department' ? !assignForm.department : (!assignForm.role || !assignForm.department)}>
            Confier l'étape
          </button></>}>
        <p className="subtitle">Déléguez vers le haut comme vers le bas : une personne, un rôle entier, un département — vous restez propriétaire du document. La cible voit le document et reçoit l'autorité de cette étape.</p>
        <label className="lbl">Étape à confier *</label>
        <select className="input" value={assignForm.action} onChange={(e) => setAssignForm({ ...assignForm, action: e.target.value })}>
          <option value="review">Relire (revue du document)</option>
          <option value="approve">Approuver (validation finale)</option>
          <option value="sign">Signer (signature électronique)</option>
        </select>

        <label className="lbl">Confier à *</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[{ k: 'user', l: 'Une personne' }, { k: 'role', l: 'Un rôle (tous)' }, { k: 'department', l: 'Un département' }, { k: 'role_dept', l: 'Rôle dans un département' }].map((t) => (
            <button key={t.k} className={'tab' + (assignForm.target === t.k ? ' active' : '')} onClick={() => setAssignForm({ ...assignForm, target: t.k, role: RECO[assignForm.action]?.[0] ?? 'reviewer', department: '', userId: '' })}>{t.l}</button>
          ))}
        </div>

        {assignForm.target === 'user' && (
          <>
            <input className="input" placeholder="Filtrer par nom, rôle ou département…" value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} />
            <select className="input" style={{ marginTop: 6 }} size={Math.min(7, Math.max(3, dirUsers.filter((u) => matchesDir(u)).length))}
              value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}>
              <option value="">Choisir une personne…</option>
              {dirUsers.filter((u) => matchesDir(u)).map((u) => (
                <option key={u.id} value={u.id}>{u.displayName} — {(u.roles ?? []).map((r: string) => ROLE_LABEL[r] ?? r).join(', ')}{u.department ? ` (${u.department})` : ''}</option>
              ))}
            </select>
          </>
        )}
        {assignForm.target === 'role' && (
          <select className="input" value={assignForm.role} onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}>
            {ASSIGN_ROLES.map((r) => <option key={r} value={r}>
              {ROLE_LABEL[r]}{RECO[assignForm.action]?.includes(r) ? ' — recommandé pour cette étape' : ''}
            </option>)}
          </select>
        )}
        {assignForm.target === 'department' && (
          <select className="input" value={assignForm.department} onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}>
            <option value="">Choisir un département…</option>
            {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {assignForm.target === 'role_dept' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={assignForm.role} onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}>
              {ASSIGN_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <select className="input" value={assignForm.department} onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}>
              <option value="">Département…</option>
              {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        <label className="lbl">Note (facultative)</label>
        <input className="input" value={assignForm.note} onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })} placeholder="Ex : priorité client, contexte particulier…" />
      </Dialog>

      <Dialog open={submitDlg} title="Soumettre en revue" onClose={() => setSubmitDlg(false)}
        footer={<><button className="btn" onClick={() => setSubmitDlg(false)}>Annuler</button><button className="btn btn-primary" onClick={confirmSubmit}>Soumettre</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>Le processus démarre : relecteurs et approbateurs sont notifiés selon le périmètre du document.</p>
        <label className="lbl">Échéance de traitement (facultative)</label>
        <input className="input" type="date" value={submitDue} onChange={(e) => setSubmitDue(e.target.value)} />
        {(types.find((t) => t.type_code === doc?.type_code)?.defaultDueDays ?? 0) > 0 && !submitDue && (
          <p className="micro" style={{ marginTop: 6 }}>Sans date, l'échéance sera fixée automatiquement à J+{types.find((t) => t.type_code === doc?.type_code)?.defaultDueDays} selon le processus du type.</p>
        )}
        <p className="micro" style={{ marginTop: 6 }}>L'échéance alimente les rappels, la file « À surveiller » et l'escalade automatique en cas de retard.</p>
      </Dialog>
      <Dialog open={!!reasonDlg} title={reasonDlg ? actionLabel(reasonDlg.action) : ''} onClose={() => setReasonDlg(null)}
        footer={<><button className="btn" onClick={() => setReasonDlg(null)}>Annuler</button><button className="btn btn-primary" onClick={confirmReason} disabled={!reasonText.trim()}>Confirmer</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>{reasonDlg ? REASON_HINT[reasonDlg.action] ?? 'Un motif est requis. Il sera conservé comme preuve.' : ''}</p>
        <label className="lbl">Motif *</label>
        <textarea className="input" rows={3} value={reasonText} onChange={(e) => setReasonText(e.target.value)} autoFocus />
      </Dialog>
      <Dialog open={signDlg} title="Signer électroniquement le document" onClose={() => setSignDlg(false)}
        footer={
          needsActivation
            ? <><button className="btn" onClick={() => setSignDlg(false)}>Annuler</button><button className="btn btn-primary" onClick={activateSignature} disabled={signName.trim().length < 3 || signPass.length < 6 || signPass !== signPass2 || sigBusy}>Activer ma signature</button></>
            : <><button className="btn" onClick={() => setSignDlg(false)}>Annuler</button><button className="btn btn-primary" onClick={confirmSign} disabled={!signRole || (needsPass && signPass.length < 6) || sigBusy}>Signer</button></>
        }>
        {!meSig && <p className="muted">Vérification de votre identité de signataire…</p>}
        {meSig && needsActivation && (
          <>
            <p className="subtitle" style={{ marginBottom: 8 }}>La signature électronique est un acte personnel. Activez-la une fois : votre nom légal figurera sur le document signé, et votre passphrase sera exigée pour chaque signature (personne d'autre ne peut signer à votre place).</p>
            <label className="lbl">Votre nom légal (figurera sur le document signé) *</label>
            <input className="input" value={signName} onChange={(e) => setSignName(e.target.value)} placeholder={meSig.displayName} autoFocus />
            <label className="lbl">Passphrase de signature * (6 caractères minimum)</label>
            <input className="input" type="password" value={signPass} onChange={(e) => setSignPass(e.target.value)} autoComplete="new-password" />
            <label className="lbl">Confirmez la passphrase *</label>
            <input className="input" type="password" value={signPass2} onChange={(e) => setSignPass2(e.target.value)} autoComplete="new-password" />
            <p className="micro" style={{ marginTop: 6 }}>La passphrase se redemande après 15 minutes sans signature. Elle est stockée hachée : impossible de la lire, même par un administrateur.</p>
          </>
        )}
        {meSig && !needsActivation && (
          <>
            <p className="subtitle" style={{ marginBottom: 8 }}>
              {needsPass
                ? <>Votre signature est verrouillée (inactive depuis plus de 15 minutes). Saisissez votre passphrase pour signer en tant que « {meSig.signatureName} ».</>
                : <>Votre signature est déverrouillée (utilisation récente). Le document s'imprimera signé « {meSig.signatureName} » — plus besoin de signature manuscrite.</>}
            </p>
            <label className="lbl">Vous signez en qualité de</label>
            <select className="input" value={signRole} onChange={(e) => setSignRole(e.target.value)}>
              {(wf?.expectedSignatures ?? []).map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>
            {needsPass && (
              <>
                <label className="lbl">Passphrase de signature *</label>
                <input className="input" type="password" value={signPass} onChange={(e) => setSignPass(e.target.value)} autoFocus />
              </>
            )}
          </>
        )}
        {sigErr && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>{sigErr}</p>}
        <p className="micro" style={{ marginTop: 10, marginBottom: 0 }}><a href="/signature">Gérer ma signature</a> — passphrase, verrouillage, désactivation.</p>
      </Dialog>
      <Dialog open={deriveDlg} title="Créer à partir de ce document" onClose={() => setDeriveDlg(false)}
        footer={<><button className="btn" onClick={() => setDeriveDlg(false)}>Annuler</button><button className="btn btn-primary" onClick={confirmDerive}><Plus size={13} style={{ verticalAlign: -2 }} /> Créer</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>Le nouveau brouillon reprend les informations compatibles. La chaîne documentaire est conservée.</p>
        <label className="lbl">Type de document</label>
        <select className="input" value={deriveForm.type_code} onChange={(e) => setDeriveForm({ ...deriveForm, type_code: e.target.value })}>
          {types.map((t: any) => <option key={t.type_code} value={t.type_code}>{t.label}</option>)}
        </select>
        <label className="lbl">Titre (facultatif)</label>
        <input className="input" value={deriveForm.title} onChange={(e) => setDeriveForm({ ...deriveForm, title: e.target.value })} placeholder={`${doc.title} (suite)`} />
      </Dialog>
      <Dialog open={revokeDlg} title="Révoquer le certificat ?" onClose={() => setRevokeDlg(false)}
        footer={<><button className="btn" onClick={() => setRevokeDlg(false)}>Annuler</button><button className="btn btn-danger" onClick={confirmRevokeCert} disabled={!revokeReason.trim()}>Révoquer</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>La révocation est publique : la page de vérification affichera « Révoqué ». L'historique est conservé.</p>
        <label className="lbl">Motif *</label>
        <textarea className="input" rows={3} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
      </Dialog>
      <Dialog open={!!aiDlg} title={`Assistant IA — ${aiDlg?.label ?? ''}`} onClose={() => setAiDlg(null)}
        footer={<><button className="btn" onClick={() => setAiDlg(null)}>Annuler</button><button className="btn btn-primary" onClick={runAiAssist} disabled={aiBusy || !aiInstruction.trim()}>{aiBusy ? 'Rédaction…' : 'Rédiger'}</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>Décrivez ce qui doit être rédigé. La proposition remplace le champ : relisez avant d'enregistrer.</p>
        <label className="lbl">Consigne *</label>
        <textarea className="input" rows={4} value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} placeholder="Ex : rédigez une introduction sur la migration réseau pour Acme, ton professionnel et factuel." autoFocus />
      </Dialog>
    </div>
  );

  function matchesDir(u: any): boolean {
    const q = dirQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${u.displayName} ${(u.roles ?? []).map((r: string) => ROLE_LABEL[r] ?? r).join(' ')} ${u.department ?? ''}`.toLowerCase();
    return hay.includes(q);
  }

  function preview_missing(): string[] {
    return (schema?.required ?? []).filter((k: string) => values[k] === undefined || values[k] === '' || values[k] == null);
  }

  // Prochaine autorité (§17, §33) : qui doit agir maintenant — la personne ASSIGNÉE
  // d'abord, sinon tous les détenteurs effectifs de l'autorité à cette étape.
  function activeAssignment(action: string) {
    return (wf?.assignments ?? []).filter((a: any) => a.action === action && !a.fulfilledAt);
  }
  function expectedNow(): { step: string; people: string[]; assigned: boolean } | null {
    const names = (arr: any[]) => (arr ?? []).map((u) => `${u.displayName} (${ROLE_LABEL[u.role] ?? u.role}${u.department ? `, ${u.department}` : ''})`);
    const assignedNames = (action: string) => activeAssignment(action).map((a: any) => `${a.targetLabel}${a.note ? ` — ${a.note}` : ''}`);
    const owner = record?.owner ? `${record.owner.displayName} (${ROLE_LABEL[record.owner.role] ?? record.owner.role})` : '';
    switch (doc?.state) {
      case 'draft': return { step: 'Finalisation du brouillon', people: owner ? [owner] : [], assigned: false };
      case 'in_review': {
        const a = [...assignedNames('review'), ...assignedNames('approve')];
        return { step: 'Revue et approbation', people: a.length > 0 ? a : names(assignees?.reviewers).concat(names(assignees?.approvers)), assigned: a.length > 0 };
      }
      case 'changes_requested': return { step: 'Corrections demandées', people: owner ? [owner] : [], assigned: false };
      case 'approved': return { step: 'Préparation du document final', people: owner ? [owner] : [], assigned: false };
      case 'ready_to_sign': {
        const a = assignedNames('sign');
        return { step: 'Signature', people: a.length > 0 ? a : names(assignees?.signers), assigned: a.length > 0 };
      }
      case 'signed': return { step: 'Émission du document', people: names(assignees?.approvers), assigned: false };
      default: return null;
    }
  }
  // Assignation : confier une étape à une personne, un rôle, un département
  // ou un rôle dans un département (§ délégation). Tracé et notifié.
  async function confirmAssign() {
    const body: any = { action: assignForm.action, target: assignForm.target, note: assignForm.note || undefined };
    if (assignForm.target === 'user') body.userId = assignForm.userId;
    if (assignForm.target === 'role' || assignForm.target === 'role_dept') body.role = assignForm.role;
    if (assignForm.target === 'department' || assignForm.target === 'role_dept') body.department = assignForm.department;
    try {
      await api(`/documents/${params.id}/assign`, { method: 'POST', body: JSON.stringify(body) });
      const who = assignForm.target === 'user'
        ? (dirUsers.find((u) => u.id === assignForm.userId)?.displayName ?? '—')
        : assignForm.target === 'role' ? `tous les ${ROLE_LABEL[assignForm.role] ?? assignForm.role}`
        : assignForm.target === 'department' ? `le département ${assignForm.department}`
        : `${ROLE_LABEL[assignForm.role] ?? assignForm.role} (${assignForm.department})`;
      toast(`Étape confiée à ${who} — notifié et tracé.`);
      setAssignDlg(false); setDirQuery('');
      refresh().catch(() => {});
    } catch (e: any) { setActionErr({ msg: e.message, retry: confirmAssign }); setAssignDlg(false); }
  }
}

// Échéance ajustable en brouillon : le responsable pilote le planning (cycle de gestion).
function DueEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  useEffect(() => { setV(initial); }, [initial]);
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input type="date" className="input" style={{ maxWidth: 160 }} value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onSave(v)} disabled={v === initial}>Enregistrer</button>
    </span>
  );
}

// Onglet Historique : révisions humaines + diff lisible (§25) + journal traduit (§26).
function HistoryTab({ doc, revs, schema }: { doc: any; revs: any[]; schema: any }) {
  const [diff, setDiff] = useState<any>(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [audit, setAudit] = useState<any[]>([]);
  useEffect(() => { api(`/documents/${doc.id}/audit`).then((r) => setAudit(r.data)).catch(() => {}); }, [doc.id]);
  async function loadDiff() {
    const q = [range.from && `from=${range.from}`, range.to && `to=${range.to}`].filter(Boolean).join('&');
    setDiff((await api(`/documents/${doc.id}/diff${q ? `?${q}` : ''}`)).data);
  }
  const fields = schema?.fields ?? [];
  const diffRows = diff ? humanizeDiff(diff, revs, fields) : [];
  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Révisions ({revs.length})</h3>
        {revs.slice().reverse().map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
            <span><strong>Révision {r.rev}</strong>{r.rev === doc.currentRevision ? ' — version actuelle' : ''} · {r.changeSummary ?? ''}</span>
            <span className="muted">{fmtDateTime(r.createdAt)}</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Comparer deux révisions</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" style={{ maxWidth: 160 }} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })}>
            <option value="">Révision de…</option>
            {revs.map((r) => <option key={r.id} value={r.rev}>Révision {r.rev}</option>)}
          </select>
          <span>→</span>
          <select className="input" style={{ maxWidth: 160 }} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })}>
            <option value="">à…</option>
            {revs.map((r) => <option key={r.id} value={r.rev}>Révision {r.rev}</option>)}
          </select>
          <button className="btn" onClick={loadDiff}>Comparer</button>
        </div>
        {diff && (
          <div style={{ marginTop: 12 }}>
            {diffRows.length === 0 && <p className="subtitle">Aucune différence entre ces deux révisions.</p>}
            {diffRows.map((d, i) => (
              <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                <strong>{d.label}</strong>
                <div className="muted">Avant : {d.before}</div>
                <div>Après : {d.after}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Journal du document</h3>
        {audit.slice().reverse().map((a) => (
          <div key={a.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="muted">{fmtDateTime(a.createdAt)}</span> — <strong>{actorLabel(a)}</strong> {eventLabel(a.eventType)}{a.reason ? ` : ${a.reason}` : ''}
          </div>
        ))}
        {audit.length === 0 && <p className="subtitle">Aucun événement enregistré.</p>}
      </div>
    </div>
  );
}
