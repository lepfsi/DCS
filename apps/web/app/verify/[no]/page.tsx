'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { FAMILY_LABEL, fmtDate, fmtDateTime } from '@/lib/ui';

// Vérification publique (§34) : un certificat par numéro, ou un document officiel
// émis par sa référence. Sans connexion, données minimales, intégrité affichée.
export default function VerifyPage({ params }: { params: { no: string } }) {
  const [cert, setCert] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [none, setNone] = useState(false);
  useEffect(() => {
    fetch(`${API_BASE}/verification/${encodeURIComponent(params.no)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.status && j.data.status !== 'Not Found') { setCert(j.data); return; }
        return fetch(`${API_BASE}/public/documents/${encodeURIComponent(params.no)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((jj) => { if (jj?.data) setDoc(jj.data); else setNone(true); });
      })
      .catch(() => setNone(true));
  }, [params.no]);
  return (
    <div style={{ maxWidth: 620, margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: 24 }}>
        <h1 style={{ marginBottom: 2 }}>Vérification publique</h1>
        <p className="subtitle">Référence : <strong>{params.no}</strong></p>
        {!cert && !doc && !none && <p className="muted">Vérification en cours…</p>}
        {none && <div className="alert-err"><strong>[NON TROUVÉ]</strong> Aucun certificat ni document officiel émis ne correspond à cette référence.</div>}

        {cert && (
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <p className="micro" style={{ marginBottom: 6 }}>Certificat</p>
            <p>Statut : <strong>{String(cert.status).toUpperCase()}</strong></p>
            <p>Titulaire : <strong>{cert.holderName}</strong></p>
            <p>Programme : {cert.programTitle}</p>
            <p>Délivré le : {cert.issuedAt}{cert.expiresAt ? ` · expire le ${cert.expiresAt}` : ''}</p>
            <p>Émetteur : {cert.issuer}</p>
          </div>
        )}

        {doc && (
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <p className="micro" style={{ marginBottom: 6 }}>Document officiel émis</p>
            <p><strong>{doc.title}</strong></p>
            <p>Référence : {doc.reference} · Révision {doc.revision}</p>
            <p>Catégorie : {FAMILY_LABEL[doc.family] ?? doc.family}</p>
            <p>Émis le : {fmtDateTime(doc.issuedAt)}</p>
            <p>Émetteur : {doc.issuer}</p>
            <p>Intégrité du document officiel :{' '}
              {doc.integrity === null
                ? <span className="muted">non vérifiable (PDF absent)</span>
                : doc.integrity.verified
                  ? <span className="badge st-issued"><ShieldCheck size={11} style={{ verticalAlign: -1 }} /> fichier vérifié (SHA-256 {doc.integrity.sha256})</span>
                  : <span className="badge st-rejected"><ShieldX size={11} style={{ verticalAlign: -1 }} /> fichier altéré ou manquant</span>}
            </p>
            <p className="micro" style={{ marginTop: 8 }}>Vérifié le {fmtDate(new Date().toISOString())} · Ce contrôle porte sur l'existence et l'intégrité, pas sur le contenu.</p>
          </div>
        )}
        <p style={{ marginTop: 16 }}><a href="/public">← Registre public des documents officiels</a></p>
      </div>
    </div>
  );
}
