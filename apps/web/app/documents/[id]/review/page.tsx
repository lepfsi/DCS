'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StateBadge, DocPreview } from '@/components/ui';
import { ROLE_LABEL, actorLabel, fmtDateTime } from '@/lib/ui';

const CHECKS = ['Contenu correct', 'Périmètre correct', 'Montants vérifiés', 'Informations client exactes'];

// Surface de revue (spec §15) : le reviewer examine le document réel et décide, sans JSON.
export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [assignees, setAssignees] = useState<any>(null);
  const [typeLabel, setTypeLabel] = useState('');
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false));
  const [comment, setComment] = useState('');
  const [section, setSection] = useState('Prestations');
  const [urgent, setUrgent] = useState(false);
  const [changesDlg, setChangesDlg] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/documents/${params.id}`).then((r) => setDoc(r.data)).catch((e) => setErr(e.message));
    api(`/documents/${params.id}/schema`).then((r) => setSchema(r.data)).catch(() => {});
    api(`/documents/${params.id}/assignees`).then((r) => setAssignees(r.data)).catch(() => {});
    api('/document-types').then((r) => setTypeLabel(r.data.find((t: any) => t.type_code === doc?.type_code)?.label ?? '')).catch(() => {});
  }, [params.id]);
  useEffect(() => {
    if (doc) api('/document-types').then((r) => setTypeLabel(r.data.find((t: any) => t.type_code === doc.type_code)?.label ?? '')).catch(() => {});
  }, [doc]);

  async function decide(action: 'approve' | 'request_changes', extra: Record<string, any> = {}) {
    setErr(''); setBusy(true);
    try {
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      router.push(`/documents/${params.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  if (!doc) return <p className="muted">Chargement du document…</p>;
  return (
    <div>
      <h1>Revue du document</h1>
      <p className="subtitle">{doc.title} · Révision {doc.currentRevision} · <StateBadge state={doc.state} /></p>
      {err && <div className="alert-err"><strong>Impossible de décider : </strong>{err}</div>}
      <div className="split">
        <div>
          <DocPreview doc={doc} schema={schema} values={doc.fields} typeLabel={typeLabel} />
          <p style={{ textAlign: 'center', marginTop: 8 }}><a href={`/documents/${doc.id}`}>Ouvrir le workspace complet</a></p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Contrôles de revue</h2>
          {CHECKS.map((c, i) => (
            <label key={c} style={{ display: 'block', marginTop: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((x, j) => (j === i ? !x : x)))} /> {c}
            </label>
          ))}
          <label className="lbl" style={{ marginTop: 14 }}>Commentaire (conservé comme preuve)</label>
          <textarea className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Remarques factuelles" />
          <p style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy || checks.some((c) => !c)} onClick={() => decide('approve', { comment: comment || undefined })}>Valider la revue</button>
            <button className="btn btn-warn" disabled={busy} onClick={() => setChangesDlg(true)}>Demander des modifications</button>
          </p>
          <p className="micro" style={{ marginTop: 12 }}>La décision est enregistrée avec acteur, horodatage et version.</p>
          {(assignees?.approvers ?? []).length > 0 && (
            <p className="micro" style={{ marginBottom: 0 }}>
              Après validation : approbation attendue de {(assignees.approvers ?? []).map((u: any) => `${u.displayName} (${ROLE_LABEL[u.role] ?? u.role})`).join(', ')}.
            </p>
          )}
        </div>
      </div>

      {/* Demande de modifications (§15) : vrai dialogue, avec motif, section et priorité. */}
      {changesDlg && (
        <div className="dlg-overlay" onClick={() => setChangesDlg(false)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <div className="dlg-head"><strong>Demander des modifications</strong><button className="dlg-x" onClick={() => setChangesDlg(false)}>✕</button></div>
            <div className="dlg-body">
              <p className="subtitle">Le préparateur recevra votre demande avec ces précisions.</p>
              <label className="lbl">Motif *</label>
              <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex : le montant doit être corrigé." autoFocus />
              <label className="lbl">Section concernée</label>
              <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
                {['Général', ...((schema?.fields ?? []).map((f: any) => f.label))].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="lbl" style={{ marginTop: 10 }}>Priorité</label>
              <label style={{ marginRight: 14, fontSize: 13.5 }}><input type="radio" checked={!urgent} onChange={() => setUrgent(false)} /> Normale</label>
              <label style={{ fontSize: 13.5 }}><input type="radio" checked={urgent} onChange={() => setUrgent(true)} /> Importante</label>
            </div>
            <div className="dlg-foot">
              <button className="btn" onClick={() => setChangesDlg(false)}>Annuler</button>
              <button className="btn btn-primary" disabled={!comment.trim() || busy} onClick={() => decide('request_changes', { reason: `${urgent ? '[IMPORTANT] ' : ''}${comment}${section && section !== 'Général' ? ` (section : ${section})` : ''}` })}>Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
