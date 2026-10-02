'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const CHECKS = ['Contenu correct', 'Périmètre correct', 'Montants vérifiés'];

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api(`/documents/${params.id}`).then((r) => setDoc(r.data)).catch((e) => setErr(e.message)); }, [params.id]);

  async function decide(action: 'approve' | 'request_changes') {
    setErr('');
    if (action === 'request_changes' && !comment.trim()) { setErr('Un commentaire est requis pour demander des modifications.'); return; }
    if (action === 'approve' && checks.some((c) => !c)) { setErr('Cochez tous les points de contrôle avant d\'approuver la revue.'); return; }
    try {
      await api(`/documents/${params.id}/transition`, { method: 'POST', body: JSON.stringify({ action, comment: comment || undefined }) });
      router.push(`/documents/${params.id}`);
    } catch (e: any) { setErr(e.message); }
  }

  if (!doc) return <main className="content"><p>Chargement...</p></main>;
  return (
    <div>
      <h1>Review · {doc.reference}</h1>
      <p className="subtitle">{doc.title} - révision {doc.currentRevision}</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <div className="split">
        <div className="card">
          <h2>Document</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{JSON.stringify(doc.fields, null, 2)}</pre>
          <p><a href={`/documents/${doc.id}`}>Open workspace</a></p>
        </div>
        <div className="card">
          <h2>Review checklist</h2>
          {CHECKS.map((c, i) => (
            <label key={c} style={{ display: 'block', marginTop: 8 }}>
              <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((x, j) => (j === i ? !x : x)))} /> {c}
            </label>
          ))}
          <label className="lbl">Comments</label>
          <textarea className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Remarques factuelles (enregistrées comme preuve)" />
          <p style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => decide('approve')}>Approve</button>{' '}
            <button className="btn btn-danger" onClick={() => decide('request_changes')}>Request Changes</button>
          </p>
          <p className="micro">La décision est enregistrée avec acteur, horodatage et version.</p>
        </div>
      </div>
    </div>
  );
}
