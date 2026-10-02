'use client';
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

export default function VerifyPage({ params }: { params: { no: string } }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`${API_BASE}/verification/${params.no}`).then((r) => r.json()).then(setData).catch(() => setData({ error: true }));
  }, [params.no]);
  const v = data?.data;
  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#fff', padding: 24 }}>
      <h1>Vérification de certificat</h1>
      <p>Référence : <strong>{params.no}</strong></p>
      {!v && <p>Chargement...</p>}
      {v && v.status === 'Not Found' && <p>[NON TROUVÉ] Ce certificat n'existe pas.</p>}
      {v && v.status !== 'Not Found' && (
        <div>
          <p>Statut : <strong>[{v.status.toUpperCase()}]</strong></p>
          <p>Titulaire : {v.holderName}</p>
          <p>Programme : {v.programTitle}</p>
          <p>Délivré le : {v.issuedAt}{v.expiresAt ? ` · expire le ${v.expiresAt}` : ''}</p>
          <p>Émetteur : {v.issuer}</p>
        </div>
      )}
    </div>
  );
}
