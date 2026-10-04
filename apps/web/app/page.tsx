'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Inbox as InboxIcon, Shapes } from 'lucide-react';
import { api } from '@/lib/api';
import { StateBadge } from '@/components/ui';
import { eventLabel, fmtDate, fmtDateTime, stateLabel, actorLabel } from '@/lib/ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour.';
  if (h < 18) return 'Bon après-midi.';
  return 'Bonsoir.';
}

// Ligne compteur cliquable : chaque chiffre de l'Accueil mène à la bonne file de l'Inbox.
function CountRow({ label, value, href, danger }: { label: string; value: any; href: string; danger?: boolean }) {
  return (
    <a href={href} className="link-plain" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
      <span>{label}</span>
      <strong style={danger && Number(value) > 0 ? { color: 'var(--danger)' } : undefined}>{value ?? '—'}</strong>
    </a>
  );
}

export default function OverviewPage() {
  const [counters, setCounters] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [lastUpd, setLastUpd] = useState<string>('');
  const [err, setErr] = useState('');

  const loadCounters = useCallback(() => {
    api('/inbox/counters').then((c) => {
      setCounters(c);
      setLastUpd(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }).catch(() => {});
  }, []);

  const loadPanels = useCallback(() => {
    (async () => {
      try {
        const docs = (await api('/documents')).data;
        const byId = new Map<string, any>(docs.map((d: any) => [d.id, d]));
        const audit = (await api('/audit-events')).data.slice(-5).reverse();
        setActivity(audit.map((a: any) => ({ ...a, ref: byId.get(a.documentId)?.reference ?? '—', docId: a.documentId })));
        const exc = (await api('/inbox?queue=exceptions')).data.slice(0, 5);
        const exp = (await api('/inbox?queue=expiring')).data.slice(0, 5);
        setAttention([...exc, ...exp.filter((d: any) => !exc.some((e: any) => e.id === d.id))].slice(0, 5));
        setRecent([...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5));
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  useEffect(() => {
    loadCounters();
    loadPanels();
    // Actualisation automatique : compteurs toutes les 30 s, tout le tableau au retour sur l'onglet.
    const id = setInterval(loadCounters, 30000);
    const onFocus = () => { loadCounters(); loadPanels(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [loadCounters, loadPanels]);

  return (
    <div>
      <h1>{greeting()}</h1>
      <p className="subtitle">Voici ce qui requiert votre attention aujourd'hui. <span className="micro">{lastUpd ? `Compteurs actualisés à ${lastUpd}` : ''}</span></p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}

      {/* §29 : À faire / À surveiller — mêmes compteurs de sections que l'Inbox (UI-09). */}
      <div className="grid2">
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <h2 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
            <a href="/inbox?section=todo" className="link-plain">À faire</a>
            <span className="badge">{counters?.todo ?? '—'}</span>
          </h2>
          <CountRow label="À revoir" value={counters?.review} href="/inbox?section=todo&queue=review" />
          <CountRow label="À approuver" value={counters?.approve} href="/inbox?section=todo&queue=approve" />
          <CountRow label="À signer" value={counters?.sign} href="/inbox?section=todo&queue=sign" />
          <CountRow label="Modifications demandées" value={counters?.changes} href="/inbox?section=todo&queue=changes" />
          <CountRow label="Mes brouillons" value={counters?.drafts} href="/inbox?section=todo&queue=mine" />
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--warn)' }}>
          <h2 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
            <a href="/inbox?section=watch" className="link-plain">À surveiller</a>
            <span className="badge">{counters?.watch ?? '—'}</span>
          </h2>
          <CountRow label="Échéances proches" value={counters?.expiring} href="/inbox?section=watch&queue=expiring" />
          <CountRow label="Exceptions" value={counters?.exceptions} href="/inbox?section=watch&queue=exceptions" danger />
          <CountRow label="Récemment émis" value={counters?.issued} href="/inbox?section=done&queue=issued" />
          <CountRow label="Archivés" value={counters?.archived} href="/inbox?section=done&queue=archived" />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ marginTop: 0 }}>Actions rapides</h2>
        <p>
          <a className="btn btn-primary" href="/documents/new"><Plus size={13} style={{ verticalAlign: -2 }} /> Créer un document</a>{' '}
          <a className="btn" href="/inbox"><InboxIcon size={13} style={{ verticalAlign: -2 }} /> Ouvrir la boîte de traitement</a>{' '}
          <a className="btn" href="/templates"><Shapes size={13} style={{ verticalAlign: -2 }} /> Modèles de documents</a>
        </p>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Votre activité <a href="/admin" style={{ fontSize: 12, fontWeight: 'normal' }}>Tout voir</a></h2>
          {activity.map((a) => (
            <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span className="muted">{fmtDateTime(a.createdAt)}</span> — <strong>{actorLabel(a)}</strong> {eventLabel(a.eventType)}
              {a.docId && a.ref !== '—' && <> · <a href={`/documents/${a.docId}`}>{a.ref}</a></>}
            </div>
          ))}
          {activity.length === 0 && <p className="subtitle">Aucune activité pour l'instant.</p>}
        </div>
        <div className="card">
          <h2>À surveiller <a href="/inbox?section=watch" style={{ fontSize: 12, fontWeight: 'normal' }}>Tout voir</a></h2>
          {attention.map((d) => (
            <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <a href={`/documents/${d.id}`}>{d.reference}</a> · {d.overdue ? <span style={{ color: 'var(--danger)' }}>en retard</span> : `échéance ${d.dueAt ? fmtDate(d.dueAt) : '—'}`} · {stateLabel(d.state)}
            </div>
          ))}
          {attention.length === 0 && <p className="subtitle">Rien d'urgent. Tout est sous contrôle.</p>}
        </div>
      </div>

      <h2>Documents récents <a href="/documents" style={{ fontSize: 12, fontWeight: 'normal' }}>Tout voir</a></h2>
      <table className="tbl">
        <thead><tr><th>Référence</th><th>Document</th><th>État</th><th>Mise à jour</th><th>Responsable</th></tr></thead>
        <tbody>
          {recent.map((d) => (
            <tr key={d.id}>
              <td><a href={`/documents/${d.id}`}>{d.reference}</a></td>
              <td>{d.title}</td>
              <td><StateBadge state={d.state} /></td>
              <td>{fmtDate(d.updatedAt)}</td>
              <td>{d.owner ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {recent.length === 0 && <div className="empty"><strong>Aucun document pour l'instant.</strong><p><a href="/documents/new">Créer le premier</a></p></div>}
    </div>
  );
}
