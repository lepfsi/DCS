'use client';
import { useEffect, useState } from 'react';
import { Plus, Send, Bot, Gauge, Database, Hash, Clock, Activity, Users as UsersIcon, KeyRound, Map, FileEdit } from 'lucide-react';
import { api, me } from '@/lib/api';
import { Dialog, StateBadge, toast } from '@/components/ui';
import { ROLE_LABEL, PERM_LABEL, FAMILY_LABEL, eventLabel, fmtDate, fmtDateTime, actorLabel } from '@/lib/ui';

// Administration (§38) : sous-menu clair, un élément = une page indépendante (?tab=).
const ROLES = ['admin', 'doc_manager', 'author', 'reviewer', 'approver', 'signer', 'viewer'];
const PERMS = ['view', 'edit', 'review', 'approve', 'sign', 'issue', 'admin'];
const DEPARTMENTS = ['Direction', 'Technique', 'Finance', 'RH', 'Juridique', 'Opérations'];
const FAMILIES = ['OFFICIAL', 'BUSINESS', 'LEGAL', 'CERTIFICATE', 'HR', 'FINANCE'];
const RETENTION: Array<[string, string]> = [
  ['Officiel', '7 ans'],
  ['Juridique', 'Contrat + 7 ans'],
  ['Finance', 'Selon politique applicable'],
  ['Certificats', 'Permanent'],
  ['RH', 'Politique contrôlée'],
];
const TABS = [
  { key: 'users', label: 'Utilisateurs', Icon: UsersIcon, adminOnly: false },
  { key: 'roles', label: 'Autorité des rôles', Icon: KeyRound, adminOnly: false },
  { key: 'scopes', label: 'Périmètres des départements', Icon: Map, adminOnly: false },
  { key: 'oversight', label: 'Pilotage & escalades', Icon: Gauge, adminOnly: true },
  { key: 'smtp', label: 'Notifications email', Icon: Send, adminOnly: true },
  { key: 'ai', label: 'Assistant IA', Icon: Bot, adminOnly: true },
  { key: 'types', label: 'Types de documents', Icon: FileEdit, adminOnly: false },
  { key: 'numbering', label: 'Numérotation', Icon: Hash, adminOnly: false },
  { key: 'retention', label: 'Conservation', Icon: Clock, adminOnly: false },
  { key: 'activity', label: 'Activité système', Icon: Activity, adminOnly: false },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<any[]>([]);
  const [numbering, setNumbering] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [matrixDraft, setMatrixDraft] = useState<Record<string, string[]>>({});
  const [matrixMsg, setMatrixMsg] = useState('');
  const [scopes, setScopes] = useState<Record<string, string[]>>({});
  const [scopesDraft, setScopesDraft] = useState<Record<string, string[]>>({});
  const [scopesMsg, setScopesMsg] = useState('');
  const [srDraft, setSrDraft] = useState<Record<string, string>>({});
  const [ddDraft, setDdDraft] = useState<Record<string, string>>({});
  const [rqDraft, setRqDraft] = useState<Record<string, boolean>>({});
  const [srMsg, setSrMsg] = useState('');
  const [rolesDlg, setRolesDlg] = useState<any>(null);
  const [rolesDraft, setRolesDraft] = useState<{ principal: string; additional: string[] }>({ principal: 'author', additional: [] });
  const [userDlg, setUserDlg] = useState(false);
  const [nu, setNu] = useState({ email: '', displayName: '', role: 'author', department: 'Technique', password: '' });
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpMsg, setSmtpMsg] = useState('');
  const [ai, setAi] = useState({ enabled: false, baseUrl: '', model: '', apiKey: '' });
  const [aiMsg, setAiMsg] = useState('');
  const [oversight, setOversight] = useState<any>(null);
  const [escDlg, setEscDlg] = useState<{ id: string; ref: string } | null>(null);
  const [escForm, setEscForm] = useState({ userId: '', permission: 'approve', note: '' });
  const [err, setErr] = useState('');
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const explicit = sp.get('tab');
    if (explicit && TABS.some((x) => x.key === explicit)) setTab(explicit);
    me().then((u) => {
      setRole(u.role);
      // Sans onglet explicite : les non-admins atterrissent sur une page lisible.
      if (!explicit && u.role !== 'admin') setTab('types');
      if (u.role === 'admin') {
        api('/admin/users').then((r) => setUsers(r.data)).catch((e) => setErr(`utilisateurs : ${e.message}`));
        api('/management/oversight').then((r) => setOversight(r.data)).catch(() => {});
      }
      // La lecture des paramètres est accessible à tous (matrice + périmètres) ; secrets admin.
      api('/admin/settings').then((r) => {
        const d = r.data;
        setMatrix(d.permissionMatrix ?? {}); setMatrixDraft(d.permissionMatrix ?? {});
        setScopes(d.departmentScopes ?? {}); setScopesDraft(d.departmentScopes ?? {});
        if (u.role === 'admin') {
          setSmtp({ host: d.smtpHost ?? '', port: d.smtpPort ?? 587, secure: !!d.smtpSecure, user: d.smtpUser ?? '', pass: d.smtpPass ?? '', from: d.smtpFrom ?? '' });
          setAi({ enabled: !!d.aiEnabled, baseUrl: d.aiBaseUrl ?? '', model: d.aiModel ?? '', apiKey: d.aiApiKey ?? '' });
        }
      }).catch(() => {});
    }).catch(() => {});
    api('/admin/numbering').then((r) => setNumbering(r.data)).catch(() => {});
    api('/document-types').then((r) => setTypes(r.data)).catch(() => {});
    api('/audit-events').then((r) => setActivity(r.data.slice(-15).reverse())).catch(() => {});
  }, []);
  async function createUser() {
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify(nu) });
      toast(`Utilisateur ${nu.displayName} créé.`);
      setNu({ email: '', displayName: '', role: 'author', department: 'Technique', password: '' });
      setUserDlg(false);
      api('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    } catch (e: any) { setErr(`création : ${e.message}`); toast(`Création impossible : ${e.message}`, 'err'); }
  }
  // Matrice d'autorités : édition locale, puis enregistrement explicite (bouton).
  async function saveMatrix() {
    setMatrixMsg('Enregistrement…');
    if (await saveSetting('permissionMatrix', matrixDraft)) {
      setMatrix(matrixDraft);
      setMatrixMsg('');
      toast('Autorités des rôles enregistrées.');
    } else { setMatrixMsg(''); toast('Enregistrement impossible — voir le message d\'erreur.', 'err'); }
  }
  // Périmètres : même logique — rien n'est appliqué avant « Enregistrer ».
  async function saveScopes() {
    setScopesMsg('Enregistrement…');
    if (await saveSetting('departmentScopes', scopesDraft)) {
      setScopes(scopesDraft);
      setScopesMsg('');
      toast('Périmètres des départements enregistrés.');
    } else { setScopesMsg(''); toast('Enregistrement impossible — voir le message d\'erreur.', 'err'); }
  }
  // Rôles de signature, échéance et exigence de signature par type : redéfinissables par l'admin.
  async function saveSignRoles(code: string) {
    const roles = (srDraft[code] ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const days = ddDraft[code] !== undefined ? ddDraft[code] : undefined;
    const body: any = {};
    if (roles.length > 0) body.signature_roles = roles;
    if (days !== undefined && days !== '') body.defaultDueDays = Number(days);
    if (rqDraft[code] !== undefined) body.requires_signature = rqDraft[code];
    if (Object.keys(body).length === 0) { setSrMsg('Rien à enregistrer.'); return; }
    setSrMsg('Enregistrement…');
    try {
      await api(`/document-types/${code}`, { method: 'PATCH', body: JSON.stringify(body) });
      const r = await api('/document-types');
      setTypes(r.data);
      setSrMsg('');
      toast(`Configuration de « ${code} » enregistrée.`);
    } catch (e: any) { setSrMsg(e.message); toast(e.message, 'err'); }
  }
  async function patchUser(id: string, patch: any) {
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      toast('Utilisateur mis à jour.');
      api('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    } catch (e: any) { setErr(`utilisateurs : ${e.message}`); toast(`Mise à jour impossible : ${e.message}`, 'err'); }
  }
  // Rôles combinables : le principal + des rôles additionnels (PDG = approbateur + signataire).
  async function saveRoles() {
    if (!rolesDlg) return;
    try {
      await api(`/admin/users/${rolesDlg.id}`, { method: 'PATCH', body: JSON.stringify({ role: rolesDraft.principal, roles: rolesDraft.additional }) });
      toast(`Rôles de ${rolesDlg.displayName} enregistrés.`);
      setRolesDlg(null);
      api('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    } catch (e: any) { toast(e.message, 'err'); }
  }
  async function saveSetting(key: string, value: any): Promise<boolean> {
    try { await api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value }) }); return true; }
    catch (e: any) { setErr(`${key} : ${e.message}`); return false; }
  }
  async function saveSmtp() {
    setSmtpMsg('Enregistrement…');
    for (const [k, v] of [['smtpHost', smtp.host], ['smtpPort', Number(smtp.port) || 587], ['smtpSecure', !!smtp.secure], ['smtpUser', smtp.user], ['smtpPass', smtp.pass], ['smtpFrom', smtp.from]] as Array<[string, any]>) {
      if (!(await saveSetting(k, v))) { setSmtpMsg(''); toast('Enregistrement impossible — voir le message d\'erreur.', 'err'); return; }
    }
    setSmtpMsg('');
    toast('Paramètres SMTP enregistrés.');
  }
  async function testSmtp() {
    setSmtpMsg('Test en cours…');
    try {
      const r = await api('/admin/smtp-test', { method: 'POST', body: JSON.stringify(smtpTo ? { to: smtpTo } : {}) });
      setSmtpMsg('');
      toast(r.data.sent ? `Test réussi — email envoyé à ${smtpTo}.` : 'Test réussi — connexion SMTP validée.');
    } catch (e: any) { setSmtpMsg(`Échec : ${e.message}`); toast(`Test SMTP échoué : ${e.message}`, 'err'); }
  }
  async function saveAi() {
    setAiMsg('Enregistrement…');
    for (const [k, v] of [['aiEnabled', !!ai.enabled], ['aiBaseUrl', ai.baseUrl], ['aiModel', ai.model], ['aiApiKey', ai.apiKey]] as Array<[string, any]>) {
      if (!(await saveSetting(k, v))) { setAiMsg(''); toast('Enregistrement impossible — voir le message d\'erreur.', 'err'); return; }
    }
    setAiMsg('');
    toast(ai.enabled && ai.apiKey ? 'Assistant IA activé et enregistré.' : 'Paramètres de l\'assistant IA enregistrés.');
  }
  async function confirmEscalate() {
    if (!escDlg || !escForm.userId) return;
    try {
      await api(`/documents/${escDlg.id}/escalate`, { method: 'POST', body: JSON.stringify({ userId: escForm.userId, permission: escForm.permission, note: escForm.note || undefined }) });
      toast(`Autorité « ${escForm.permission} » accordée sur ${escDlg.ref} — la personne est notifiée.`);
      setEscDlg(null); setEscForm({ userId: '', permission: 'approve', note: '' });
      api('/management/oversight').then((r) => setOversight(r.data)).catch(() => {});
    } catch (e: any) { setErr(`escalade : ${e.message}`); toast(e.message, 'err'); setEscDlg(null); }
  }
  const visibleTabs = TABS.filter((t) => !t.adminOnly || role === 'admin');
  const T = visibleTabs.find((t) => t.key === tab) ?? visibleTabs[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1>Administration</h1>
          <p className="subtitle">Utilisateurs, autorités, périmètres et politiques du système.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {role === 'admin' && <button className="btn btn-primary" onClick={() => setUserDlg(true)}><Plus size={14} style={{ verticalAlign: -2 }} /> Nouvel utilisateur</button>}
          <a className="btn" href="/automation">Automatisation</a>
        </div>
      </div>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}

      {/* Sous-menu : chaque élément ouvre sa page indépendante. */}
      <div className="tabs">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={'tab' + (T.key === t.key ? ' active' : '')}>
            <t.Icon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{t.label}
          </button>
        ))}
      </div>

      {/* ---- Utilisateurs ---- */}
      {T.key === 'users' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Utilisateurs {role === 'admin' && `(${users.length})`}</h2>
          {role === 'admin' ? (
            <>
              <table className="tbl">
                <thead><tr><th>Nom</th><th>Email</th><th>Rôles</th><th>Département</th><th>Actif</th><th>Signature</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.displayName}</td>
                      <td style={{ fontSize: 12.5 }}>{u.email}</td>
                      <td>{(u.roles ?? [u.role]).map((r: string) => <span key={r} className="badge" style={{ marginRight: 3 }}>{ROLE_LABEL[r] ?? r}</span>)}</td>
                      <td>{u.department ?? '—'}</td>
                      <td>{u.isActive ? <span className="badge st-issued">Actif</span> : <span className="badge st-rejected">Inactif</span>}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{u.signatureName ? `activée (${u.signatureName})` : 'non activée'}</td>
                      <td>
                        <button className="btn" onClick={() => { setRolesDlg(u); setRolesDraft({ principal: u.role, additional: (u.roles ?? [u.role]).filter((r: string) => r !== u.role) }); }}>Rôles…</button>{' '}
                        <select value={u.department ?? ''} onChange={(e) => patchUser(u.id, { department: e.target.value || null })} style={{ maxWidth: 120 }} className="input">
                          <option value="">—</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>{' '}
                        <button className="btn" onClick={() => patchUser(u.id, { isActive: !u.isActive })}>{u.isActive ? 'Désactiver' : 'Activer'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="micro" style={{ marginTop: 8 }}>Les rôles se combinent : un PDG = Approbateur + Signataire. Les autorités se cumulent — aucune case obligatoire à un seul poste.</p>
              <p className="micro" style={{ marginTop: 8 }}>Un changement de rôle s'applique immédiatement — l'utilisateur voit ses nouveaux droits à sa prochaine action (sa session ne fige plus rien).</p>
            </>
          ) : (
            <p className="subtitle" style={{ margin: 0 }}>La consultation et la gestion des comptes sont réservées aux administrateurs. Votre rôle : {(ROLE_LABEL[role] ?? role) || '…'}.</p>
          )}
        </div>
      )}

      {/* ---- Autorité des rôles ---- */}
      {T.key === 'roles' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Autorité des rôles</h2>
          <p className="subtitle">Le processus définit les étapes ; cette matrice définit qui a l'autorité d'agir. Modifiez librement, puis enregistrez — rien n'est appliqué avant.</p>
          <table className="tbl">
            <thead><tr><th>Rôle</th>{PERMS.map((p) => <th key={p}>{PERM_LABEL[p]}</th>)}</tr></thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r}>
                  <td><strong>{ROLE_LABEL[r]}</strong></td>
                  {PERMS.map((p) => (
                    <td key={p}>
                      <input type="checkbox"
                        checked={(matrixDraft[r] ?? []).includes(p)}
                        disabled={role !== 'admin'}
                        onChange={() => setMatrixDraft({
                          ...matrixDraft,
                          [r]: (matrixDraft[r] ?? []).includes(p) ? (matrixDraft[r] ?? []).filter((x: string) => x !== p) : [...(matrixDraft[r] ?? []), p],
                        })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {role === 'admin' && (
            <p style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={saveMatrix} disabled={JSON.stringify(matrixDraft) === JSON.stringify(matrix)}>Enregistrer les autorités</button>
              <button className="btn" onClick={() => { setMatrixDraft(matrix); setMatrixMsg(''); }}>Réinitialiser</button>
              {matrixMsg && <span className="micro">{matrixMsg}</span>}
              {JSON.stringify(matrixDraft) !== JSON.stringify(matrix) && !matrixMsg && <span className="micro" style={{ color: 'var(--warn)' }}>modifications non enregistrées</span>}
            </p>
          )}
          {role !== 'admin' && <p className="subtitle" style={{ marginTop: 10 }}>Lecture seule — les autorités sont modifiées par un administrateur.</p>}
          <p className="micro" style={{ marginTop: 8 }}>Ces autorités régissent les actions sur les documents. L'accès à l'espace Administration, lui, est porté par le rôle : attribuez le rôle « Administrateur » depuis l'onglet Utilisateurs.</p>
        </div>
      )}

      {/* ---- Périmètres des départements ---- */}
      {T.key === 'scopes' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Périmètres des départements <span className="badge">{Object.keys(scopes).length} restreint(s)</span></h2>
          <p className="subtitle">Un département sans aucune case cochée accède à tous les domaines. Cocher au moins un domaine le restreint : visibilité, création, routage et assignations.</p>
          <table className="tbl">
            <thead><tr><th>Département</th>{FAMILIES.map((f) => <th key={f}>{FAMILY_LABEL[f]}</th>)}<th>État</th></tr></thead>
            <tbody>
              {DEPARTMENTS.map((d) => (
                <tr key={d}>
                  <td><strong>{d}</strong></td>
                  {FAMILIES.map((f) => (
                    <td key={f}>
                      <input type="checkbox"
                        checked={(scopesDraft[d] ?? []).includes(f)}
                        disabled={role !== 'admin'}
                        onChange={() => {
                          const cur = scopesDraft[d] ?? [];
                          const nextList = cur.includes(f) ? cur.filter((x: string) => x !== f) : [...cur, f];
                          const next = { ...scopesDraft };
                          if (nextList.length === 0) delete next[d];
                          else next[d] = nextList;
                          setScopesDraft(next);
                        }} />
                    </td>
                  ))}
                  <td>{(scopesDraft[d] ?? []).length === 0 ? <span className="badge st-issued">Tous domaines</span> : <span className="badge st-brouillon">{scopesDraft[d].length} domaine(s)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {role === 'admin' && (
            <p style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={saveScopes} disabled={JSON.stringify(scopesDraft) === JSON.stringify(scopes)}>Enregistrer les périmètres</button>
              <button className="btn" onClick={() => { setScopesDraft(scopes); setScopesMsg(''); }}>Réinitialiser</button>
              {scopesMsg && <span className="micro">{scopesMsg}</span>}
              {JSON.stringify(scopesDraft) !== JSON.stringify(scopes) && !scopesMsg && <span className="micro" style={{ color: 'var(--warn)' }}>modifications non enregistrées</span>}
            </p>
          )}
          <p className="micro" style={{ marginTop: 8 }}>Chaque enregistrement est tracé dans l'audit.</p>
        </div>
      )}

      {/* ---- Pilotage & escalades ---- */}
      {T.key === 'oversight' && role === 'admin' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Pilotage & escalades (direction)</h2>
          {oversight ? (
            <>
              <p className="subtitle">{oversight.counts.total} documents · {oversight.counts.active} en cours · {oversight.counts.overdue} en retard · {oversight.counts.stalled} stagnent (≥ 3 jours dans le même état).</p>
              {oversight.stalled.length === 0 && <p className="subtitle" style={{ color: 'var(--ok)' }}>Aucun document bloqué. Le parcours documentaire suit son cours normal.</p>}
              {oversight.stalled.length > 0 && (
                <table className="tbl">
                  <thead><tr><th>Référence</th><th>Document</th><th>État</th><th>Jours</th><th>Responsable</th><th>Échéance</th><th>Action</th></tr></thead>
                  <tbody>
                    {oversight.stalled.map((d: any) => (
                      <tr key={d.id}>
                        <td><a href={`/documents/${d.id}`}>{d.reference}</a></td>
                        <td>{d.title}</td>
                        <td><StateBadge state={d.state} /></td>
                        <td>{d.daysInState}{d.overdue ? <span style={{ color: 'var(--danger)' }}> (retard)</span> : ''}</td>
                        <td>{d.owner}</td>
                        <td>{d.dueAt ? fmtDate(d.dueAt) : '—'}</td>
                        <td><button className="btn" onClick={() => setEscDlg({ id: d.id, ref: d.reference })}><Gauge size={12} style={{ verticalAlign: -2 }} /> Escalader</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="micro" style={{ marginTop: 8 }}>Escalader = accorder à une personne l'autorité de relire, approuver ou signer un document précis. Action tracée et notifiée.</p>
            </>
          ) : <p className="subtitle">Chargement du pilotage…</p>}
        </div>
      )}

      {/* ---- SMTP ---- */}
      {T.key === 'smtp' && role === 'admin' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Notifications par email (SMTP)</h2>
          <div className="grid2">
            <div>
              <label className="lbl">Serveur SMTP *</label>
              <input className="input" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.example.com" />
              <label className="lbl">Port</label>
              <input className="input" type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} />
              <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} /> Connexion chiffrée (TLS/SSL)</label>
            </div>
            <div>
              <label className="lbl">Utilisateur</label>
              <input className="input" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} autoComplete="off" />
              <label className="lbl">Mot de passe</label>
              <input className="input" type="password" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} autoComplete="new-password" />
              <label className="lbl">Expéditeur (De)</label>
              <input className="input" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder="dcs@dailyops.tech" />
            </div>
          </div>
          <p style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={saveSmtp}>Enregistrer</button>
            <button className="btn" onClick={testSmtp} disabled={!smtp.host}><Send size={12} style={{ verticalAlign: -2 }} /> Tester la connexion</button>
            <input className="input" style={{ maxWidth: 220 }} placeholder="Email de test (facultatif)" value={smtpTo} onChange={(e) => setSmtpTo(e.target.value)} />
            {smtpMsg && <span className="micro">{smtpMsg}</span>}
          </p>
          <p className="micro">Une fois configuré, chaque notification de tâche part aussi par email (envoi best-effort, jamais bloquant).</p>
        </div>
      )}

      {/* ---- Assistant IA ---- */}
      {T.key === 'ai' && role === 'admin' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Assistant IA (aide à la rédaction)</h2>
          <label style={{ fontSize: 13.5, display: 'block', marginBottom: 8 }}>
            <input type="checkbox" checked={ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} /> Activer l'agent d'assistance
          </label>
          <div className="grid2">
            <div>
              <label className="lbl">URL de l'API (compatible OpenAI)</label>
              <input className="input" value={ai.baseUrl} onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
              <label className="lbl">Modèle</label>
              <input className="input" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} placeholder="gpt-4o-mini" />
            </div>
            <div>
              <label className="lbl">Clé API</label>
              <input className="input" type="password" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} autoComplete="new-password" />
            </div>
          </div>
          <p style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={saveAi}><Bot size={12} style={{ verticalAlign: -2 }} /> Enregistrer</button>
            {aiMsg && <span className="micro">{aiMsg}</span>}
          </p>
          <p className="micro">Activé, l'assistant propose des rédactions dans les documents (champs texte long) et peut analyser un document-modèle pour l'identité visuelle. L'utilisateur relit et décide toujours.</p>
        </div>
      )}

      {/* ---- Types de documents ---- */}
      {T.key === 'types' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Types de documents ({types.length})</h2>
          <p className="subtitle">Chaque type suit un processus. « Signature requise » fait entrer la signature électronique dans le cycle : l'émission est bloquée jusqu'à la signature, et le suivi l'affiche comme étape. L'échéance par défaut fixe le compte à rebours automatique (0 = aucune).</p>
          <table className="tbl">
            <thead><tr><th>Document</th><th>Catégorie</th><th>Signataires (qualités)</th><th>Échéance (jours)</th><th>Signature requise</th>{role === 'admin' && <th></th>}</tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.type_code}>
                  <td>{t.label}</td>
                  <td>{FAMILY_LABEL[t.family] ?? t.family}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {role === 'admin'
                      ? <input className="input" style={{ maxWidth: 200 }} value={srDraft[t.type_code] ?? (t.signature_roles ?? []).join(', ')} onChange={(e) => setSrDraft({ ...srDraft, [t.type_code]: e.target.value })} placeholder="Ex : Directeur Général, Directeur Technique" />
                      : (t.signature_roles ?? []).join(', ')}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {role === 'admin'
                      ? <input className="input" type="number" min={0} max={365} style={{ maxWidth: 90 }} value={ddDraft[t.type_code] ?? String(t.defaultDueDays ?? 0)} onChange={(e) => setDdDraft({ ...ddDraft, [t.type_code]: e.target.value })} />
                      : (t.defaultDueDays ?? 0)}
                  </td>
                  <td>
                    {role === 'admin'
                      ? <input type="checkbox" checked={rqDraft[t.type_code] ?? !!t.requires_signature} onChange={(e) => setRqDraft({ ...rqDraft, [t.type_code]: e.target.checked })} />
                      : (t.requires_signature ? <span className="badge st-issued">Oui</span> : <span className="muted">Non</span>)}
                  </td>
                  {role === 'admin' && (
                    <td>
                      <button className="btn" onClick={() => saveSignRoles(t.type_code)} disabled={
                        (srDraft[t.type_code] === undefined || srDraft[t.type_code] === (t.signature_roles ?? []).join(', '))
                        && (ddDraft[t.type_code] === undefined || ddDraft[t.type_code] === String(t.defaultDueDays ?? 0))
                        && (rqDraft[t.type_code] === undefined || rqDraft[t.type_code] === !!t.requires_signature)}>Enregistrer</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {srMsg && <p className="micro" style={{ marginTop: 6 }}>{srMsg}</p>}
          <p className="micro" style={{ marginTop: 8 }}><Database size={11} style={{ verticalAlign: -1 }} /> Les rôles saisis doivent correspondre aux rôles de signature attendus par le processus (ex : manager, directeur). Séparez par des virgules.</p>
        </div>
      )}

      {/* ---- Numérotation ---- */}
      {T.key === 'numbering' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Numérotation ({numbering.length} séquences)</h2>
          <table className="tbl">
            <thead><tr><th>Séquence</th><th>Dernier numéro</th></tr></thead>
            <tbody>
              {numbering.map((n) => (
                <tr key={n.key}><td>{n.key}</td><td>{String(n.last).padStart(4, '0')}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="micro">Format : DO-[CODE]-[ANNÉE]-[SÉQUENCE] — génération centralisée, sans collision.</p>
        </div>
      )}

      {/* ---- Conservation ---- */}
      {T.key === 'retention' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Conservation et archivage</h2>
          <table className="tbl">
            <thead><tr><th>Catégorie</th><th>Durée de conservation</th></tr></thead>
            <tbody>
              {RETENTION.map(([d, r]) => (
                <tr key={d}><td>{d}</td><td>{r}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="micro">Archive, remplace, révoque : disponibles dans le workspace du document. Règles configurables et auditées.</p>
        </div>
      )}

      {/* ---- Activité système ---- */}
      {T.key === 'activity' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Activité système ({activity.length} derniers événements)</h2>
          <table className="tbl">
            <thead><tr><th>Quand</th><th>Acteur</th><th>Événement</th></tr></thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12.5 }} className="muted">{fmtDateTime(a.createdAt)}</td>
                  <td>{actorLabel(a)}</td>
                  <td>{eventLabel(a.eventType)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {activity.length === 0 && <p className="subtitle">Aucune activité enregistrée.</p>}
        </div>
      )}

      <Dialog open={!!rolesDlg} title={`Rôles de ${rolesDlg?.displayName ?? ''}`} onClose={() => setRolesDlg(null)}
        footer={<><button className="btn" onClick={() => setRolesDlg(null)}>Annuler</button><button className="btn btn-primary" onClick={saveRoles}>Enregistrer les rôles</button></>}>
        <p className="subtitle">Les rôles se cumulent : un PDG approbateur qui signe = rôle principal Approbateur + rôle additionnel Signataire. Les autorités des deux s'additionnent.</p>
        <label className="lbl">Rôle principal</label>
        <select className="input" value={rolesDraft.principal} onChange={(e) => setRolesDraft({ ...rolesDraft, principal: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <label className="lbl">Rôles additionnels</label>
        {ROLES.filter((r) => r !== rolesDraft.principal).map((r) => (
          <label key={r} style={{ display: 'block', marginTop: 4, fontSize: 13.5 }}>
            <input type="checkbox" checked={rolesDraft.additional.includes(r)}
              onChange={() => setRolesDraft({
                ...rolesDraft,
                additional: rolesDraft.additional.includes(r) ? rolesDraft.additional.filter((x) => x !== r) : [...rolesDraft.additional, r],
              })} /> {ROLE_LABEL[r]}
          </label>
        ))}
      </Dialog>

      <Dialog open={userDlg} title="Nouvel utilisateur" onClose={() => setUserDlg(false)}>
        <label className="lbl">Nom affiché *</label>
        <input className="input" value={nu.displayName} onChange={(e) => setNu({ ...nu, displayName: e.target.value })} autoFocus />
        <label className="lbl">Email *</label>
        <input className="input" type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
        <label className="lbl">Rôle</label>
        <select className="input" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <label className="lbl">Département</label>
        <select className="input" value={nu.department} onChange={(e) => setNu({ ...nu, department: e.target.value })}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="lbl">Mot de passe * (6 caractères minimum)</label>
        <input className="input" type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
        <p style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setUserDlg(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={createUser} disabled={!nu.email || !nu.displayName || nu.password.length < 6}>Créer l'utilisateur</button>
        </p>
      </Dialog>

      <Dialog open={!!escDlg} title={escDlg ? `Escalader ${escDlg.ref}` : ''} onClose={() => setEscDlg(null)}
        footer={<><button className="btn" onClick={() => setEscDlg(null)}>Annuler</button><button className="btn btn-primary" onClick={confirmEscalate} disabled={!escForm.userId}>Accorder l'autorité</button></>}>
        <p className="subtitle">La personne désignée peut voir ce document et agir à l'étape choisie. L'autorité est ponctuelle et tracée.</p>
        <label className="lbl">Personne *</label>
        <select className="input" value={escForm.userId} onChange={(e) => setEscForm({ ...escForm, userId: e.target.value })}>
          <option value="">Choisir…</option>
          {users.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.displayName} — {ROLE_LABEL[u.role] ?? u.role}{u.department ? ` (${u.department})` : ''}</option>)}
        </select>
        <label className="lbl">Autorité accordée</label>
        <select className="input" value={escForm.permission} onChange={(e) => setEscForm({ ...escForm, permission: e.target.value })}>
          <option value="review">Relire</option>
          <option value="approve">Approuver</option>
          <option value="sign">Signer</option>
        </select>
        <label className="lbl">Note (facultative)</label>
        <input className="input" value={escForm.note} onChange={(e) => setEscForm({ ...escForm, note: e.target.value })} placeholder="Ex : direction validée en comité" />
      </Dialog>
    </div>
  );
}
