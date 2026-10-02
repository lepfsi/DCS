'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ApprovePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [wf, setWf] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    api(`/documents/${params.id}`).then((r) => setDoc(r.data)).catch((e) => setErr(e.message));
    api(`/documents/${params.id}/workflow`).then((r) => setWf(r.data)).catch(() => {});
  }, [params.id]);

  async function decide(action: 'approve' | 'reject') {
    setErr('');
    if (action === 'reject' && !comment.trim()) { setErr('Un motif est requis pour rejeter.'); return; }
    try {
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action, comment: comment || undefined }) });
      router.push(`/documents/${params.id}`);
    } catch (e: any) { setErr(e.message); }
  }

  const reviews = (wf?.history ?? []).filter((h: any) => ['submitted_for_review', 'approval_granted', 'changes_requested'].includes(h.eventType));
  if (!doc) return <p>Chargement...</p>;
  return (
    <div>
      <h1>Approval</h1>
      <p className="subtitle">{doc.reference} - {doc.title} (révision {doc.currentRevision})</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <div className="card">
        <h2>Review context</h2>
        {reviews.map((h: any) => (
          <div key={h.id} style={{ fontSize: 13, padding: '4px 0' }}>
            {h.createdAt.slice(0, 16).replace('T', ' ')} - {h.eventType} ({h.actorRole}){h.reason ? ` : ${h.reason}` : ''}
          </div>
        ))}
        {reviews.length === 0 && <p className="subtitle">Aucune revue enregistrée.</p>}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h2>Approval decision</h2>
        <p className="subtitle">L'approbation engage la responsabilité de l'organisation. Elle est distincte de la revue.</p>
        <label className="lbl">Approval context (périmètre et conditions vérifiés)</label>
        <textarea className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Contexte de décision" />
        <p style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => decide('approve')}>Approve</button>{' '}
          <button className="btn btn-danger" onClick={() => decide('reject')}>Reject</button>
        </p>
      </div>
    </div>
  );
}
