'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StateBadge, DocPreview, Dialog } from '@/components/ui';
import { eventLabel, fmtDateTime, ROLE_LABEL, actorLabel } from '@/lib/ui';

// Surface de décision (spec §16) : l'approbateur voit le document, la revue, ce qu'il engage.
export default function ApprovePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [wf, setWf] = useState<any>(null);
  const [assignees, setAssignees] = useState<any>(null);
  const [typeLabel, setTypeLabel] = useState('');
  const [comment, setComment] = useState('');
  const [rejectDlg, setRejectDlg] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/documents/${params.id}`).then((r) => setDoc(r.data)).catch((e) => setErr(e.message));
    api(`/documents/${params.id}/schema`).then((r) => setSchema(r.data)).catch(() => {});
    api(`/documents/${params.id}/workflow`).then((r) => setWf(r.data)).catch(() => {});
    api(`/documents/${params.id}/assignees`).then((r) => setAssignees(r.data)).catch(() => {});
  }, [params.id]);
  useEffect(() => {
    if (doc) api('/document-types').then((r) => setTypeLabel(r.data.find((t: any) => t.type_code === doc.type_code)?.label ?? '')).catch(() => {});
  }, [doc]);

  async function decide(action: 'approve' | 'reject', extra: Record<string, any> = {}) {
    setErr(''); setBusy(true);
    try {
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      router.push(`/documents/${params.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const reviews = (wf?.history ?? []).filter((h: any) => ['submitted_for_review', 'approval_granted', 'changes_requested'].includes(h.eventType));
  if (!doc) return <p className="muted">Chargement du document…</p>;
  return (
    <div>
      <h1>Approbation</h1>
      <p className="subtitle">{doc.title} · Révision {doc.currentRevision} · <StateBadge state={doc.state} /></p>
      {err && <div className="alert-err"><strong>Impossible de décider : </strong>{err}</div>}
      <div className="split">
        <div>
          <DocPreview doc={doc} schema={schema} values={doc.fields} typeLabel={typeLabel} />
          <p style={{ textAlign: 'center', marginTop: 8 }}><a href={`/documents/${doc.id}`}>Ouvrir le workspace complet</a></p>
        </div>
        <div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Revue effectuée</h2>
            {reviews.length === 0 && <p className="subtitle">Aucune revue enregistrée avant approbation.</p>}
            {reviews.map((h: any) => (
              <div key={h.id} style={{ fontSize: 13, padding: '4px 0' }}>
                <span className="muted">{fmtDateTime(h.createdAt)}</span> — <strong>{actorLabel(h)}</strong> {eventLabel(h.eventType)}{h.reason ? ` : ${h.reason}` : ''}
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Décision</h2>
            <p className="subtitle">L'approbation engage la responsabilité de l'organisation. Elle est distincte de la revue.</p>
            <label className="lbl">Commentaire de décision (facultatif)</label>
            <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex : périmètre et conditions vérifiés." />
            <p style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={busy} onClick={() => decide('approve', { comment: comment || undefined })}>Approuver</button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setRejectDlg(true)}>Rejeter</button>
            </p>
            {(wf?.expectedSignatures ?? []).length > 0
              ? (assignees?.signers ?? []).length > 0
                ? <p className="micro">Après approbation : signature attendue de {assignees.signers.map((u: any) => `${u.displayName} (${ROLE_LABEL[u.role] ?? u.role})`).join(', ')}.</p>
                : <p className="micro" style={{ color: 'var(--danger)' }}>Après approbation : signature requise, mais aucun signataire n'est disponible dans le périmètre.</p>
              : <p className="micro">Après approbation : émission du document par un gestionnaire.</p>}
          </div>
        </div>
      </div>

      {/* Rejet (§27) : dialogue contextualisé avec motif obligatoire. */}
      <Dialog open={rejectDlg} title="Rejeter le document ?" onClose={() => setRejectDlg(false)}
        footer={<><button className="btn" onClick={() => setRejectDlg(false)}>Annuler</button><button className="btn btn-danger" disabled={!rejectReason.trim() || busy} onClick={() => decide('reject', { reason: rejectReason.trim() })}>Rejeter</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>Cette décision mettra fin au processus : le document ne pourra pas être émis en l'état.</p>
        <label className="lbl">Motif *</label>
        <textarea className="input" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
      </Dialog>
    </div>
  );
}
