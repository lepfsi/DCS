'use client';
import { useEffect, useState } from 'react';
import { api, me } from '@/lib/api';

export default function AutomationPage() {
  const [policies, setPolicies] = useState<any>(null);  const [hooks, setHooks] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('issued,revoked,certificate_issued');
  const [runResult, setRunResult] = useState<any>(null);
  const [hookErr, setHookErr] = useState('');
  const [role, setRole] = useState('');
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [err, setErr] = useState('');
  function load() {
    setErr(''); setHookErr('');
    api('/automation/policies').then((r) => { setPolicies(r.data); setDraft(r.data); }).catch((e) => setErr(e.message));
    api('/webhooks').then((r) => setHooks(r.data)).catch((e) => setHookErr(e.message));
    me().then((u) => setRole(u.role)).catch(() => {});
  }
  const canHook = role === 'admin' || role === 'doc_manager';
  useEffect(() => { load(); }, []);
  async function addHook() {
    setErr('');
    try {
      await api('/webhooks', { method: 'POST', body: JSON.stringify({ url, events: events.split(',').map((s) => s.trim()).filter(Boolean) }) });
      setUrl('');
      load();
    } catch (e: any) { setErr(e.message); }
  }
  async function toggleHook(id: string, active: boolean) {
    await api(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
    load();
  }
  async function run() {
    setErr('');
    try {
      const r = await api('/automation/run', { method: 'POST' });
      setRunResult(r.data);
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <div>
      <h1>Automation - le système exécute le déterministe</h1>
      {err && <p style={{ background: '#fff3f3', padding: 12 }}>Erreur : {err}</p>}
      <h2>Politiques</h2>
      <pre style={{ background: '#fff', padding: 12 }}>{JSON.stringify(policies, null, 2)}</pre>
      {role === 'admin' ? (
        <div className="card" style={{ marginTop: 8 }}>
          <h3>Ajuster (admin)</h3>
          {Object.keys(draft).map((k) => (
            <div key={k}>
              <label className="lbl">{k} {k === 'autoArchiveAfterDays' && '(0 = désactivé)'}</label>
              <input className="input" type="number" value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
            </div>
          ))}
          <p style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={async () => {
            setErr('');
            try {
              for (const [k, v] of Object.entries(draft)) {
                await api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ key: k, value: v }) });
              }
              load();
            } catch (e: any) { setErr(e.message); }
          }}>Enregistrer les politiques</button></p>
        </div>
      ) : (
        <p className="subtitle">Politiques modifiables par un administrateur (rôle actuel : {role || '...'}).</p>
      )}
      <button onClick={run}>Exécuter (rappels, escalade, archivage auto)</button>
      {runResult && <pre style={{ background: '#fff', padding: 12 }}>{JSON.stringify(runResult, null, 2)}</pre>}
      <h2>Webhooks (intégrations utiles uniquement)</h2>
      {!canHook && <p className="subtitle">Webhooks gérés par les gestionnaires et administrateurs (rôle actuel : {role || '...'}).</p>}
      {hookErr && canHook && <p style={{ background: '#fff3f3', padding: 12 }}>Erreur : {hookErr}</p>}
      {hooks.map((w) => (
        <div key={w.id} style={{ background: '#fff', padding: 12, marginBottom: 8 }}>
          <strong>{w.url}</strong> · {w.events.join(', ')} · {w.active ? '[actif]' : '[inactif]'}{' '}
          {canHook && <button onClick={() => toggleHook(w.id, w.active)}>{w.active ? 'Désactiver' : 'Activer'}</button>}
        </div>
      ))}
      {canHook && (
      <div style={{ background: '#fff', padding: 12 }}>
        <h3>Nouveau webhook</h3>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={{ width: '100%' }} />
        <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="issued,revoked ou *" style={{ width: '100%', marginTop: 8 }} />
        <button onClick={addHook} style={{ marginTop: 8 }}>Ajouter</button>
      </div>
      )}
    </div>
  );
}
