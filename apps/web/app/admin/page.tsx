'use client';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api, me } from '@/lib/api';

const ROLES = ['admin', 'doc_manager', 'author', 'reviewer', 'approver', 'signer', 'viewer'];
const PERMS = ['view', 'edit', 'review', 'approve', 'sign', 'issue', 'admin'];
const DEPARTMENTS = ['Direction', 'Technique', 'Finance', 'RH', 'Juridique', 'Opérations'];
const RETENTION = [
  ['Official', '7 years'],
  ['Legal', 'Contract + 7 years'],
  ['Finance', 'Applicable policy'],
  ['Certificate', 'Permanent'],
  ['HR', 'Controlled policy'],
];

function Section({ title, count, open, children }: { title: string; count?: string; open?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(!!open);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <ChevronDown size={15} style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
        <strong>{title}</strong>
        {count && <span className="micro">{count}</span>}
      </button>
      {isOpen && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [numbering, setNumbering] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [nu, setNu] = useState({ email: '', displayName: '', role: 'author', department: 'Technique', password: '' });
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/admin/users').then((r) => setUsers(r.data)).catch((e) => setErr(`users: ${e.message}`));
    me().then((u) => setRole(u.role)).catch(() => {});
    api('/admin/settings').then((r) => setMatrix(r.data.permissionMatrix ?? {})).catch(() => {});
    api('/admin/numbering').then((r) => setNumbering(r.data)).catch(() => {});
    api('/document-types').then((r) => setTypes(r.data)).catch(() => {});
    api('/audit-events').then((r) => setActivity(r.data.slice(-15).reverse())).catch(() => {});
  }, []);
  async function createUser() {
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify(nu) });
      setNu({ email: '', displayName: '', role: 'author', department: 'Technique', password: '' });
      api('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    } catch (e: any) { setErr(`users: ${e.message}`); }
  }
  async function togglePerm(r: string, p: string) {
    try {
      const next = { ...matrix, [r]: matrix[r].includes(p) ? matrix[r].filter((x) => x !== p) : [...matrix[r], p] };
      await api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ key: 'permissionMatrix', value: next }) });
      setMatrix(next);
    } catch (e: any) { setErr(`matrix: ${e.message}`); }
  }
  async function patchUser(id: string, patch: any) {
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      api('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    } catch (e: any) { setErr(`users: ${e.message}`); }
  }
  return (
    <div>
      <h1>Administration</h1>
      <p className="subtitle">Configuration, users, roles and policies.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <p><a className="btn" href="/automation">Automation policies</a></p>
      <Section title="Roles and permissions" open>
        <p className="subtitle">Le workflow dit quelles étapes existent, la matrice dit qui a l'autorité. Resserrer = décocher (ex : retirer approve au reviewer sépare revue et approbation par construction).</p>
        <table className="tbl">
          <thead><tr><th>Role</th>{PERMS.map((p) => <th key={p}>{p}</th>)}</tr></thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r}>
                <td><strong>{r}</strong></td>
                {PERMS.map((p) => (
                  <td key={p}>
                    <input type="checkbox" checked={(matrix[r] ?? []).includes(p)} disabled={role !== 'admin'} onChange={() => togglePerm(r, p)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {role !== 'admin' && <p className="subtitle">Matrice modifiable par un administrateur.</p>}
      </Section>
      <Section title="Users" count={`${users.length}`} open>
        {role !== 'admin' && <p className="subtitle">Gestion des utilisateurs réservée aux administrateurs (rôle actuel : {role || '...'}).</p>}
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Active</th>{role === 'admin' && <th>Actions</th>}</tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.department ?? '-'}</td><td>{u.isActive ? 'yes' : 'no'}</td>
                {role === 'admin' && (
                  <td>
                    <select value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })} style={{ maxWidth: 120 }}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>{' '}
                    <select value={u.department ?? ''} onChange={(e) => patchUser(u.id, { department: e.target.value || null })} style={{ maxWidth: 120 }}>
                      <option value="">-</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>{' '}
                    <button className="btn" onClick={() => patchUser(u.id, { isActive: !u.isActive })}>{u.isActive ? 'Désactiver' : 'Activer'}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {role === 'admin' && (
          <div style={{ marginTop: 12 }}>
            <h3>Nouvel utilisateur</h3>
            <label className="lbl">Email (requis)</label>
            <input className="input" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
            <label className="lbl">Nom affiché (requis)</label>
            <input className="input" value={nu.displayName} onChange={(e) => setNu({ ...nu, displayName: e.target.value })} />
          <label className="lbl">Rôle</label>
          <select className="input" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="lbl">Département</label>
          <select className="input" value={nu.department} onChange={(e) => setNu({ ...nu, department: e.target.value })}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
            <label className="lbl">Mot de passe (min 6, requis)</label>
            <input className="input" type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
            <p style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={createUser}>Créer</button></p>
            <p className="micro">On ne modifie jamais son propre rôle ni son activation : voir un autre administrateur.</p>
          </div>
        )}
      </Section>
      <Section title="Document numbering" count={`${numbering.length} séquences`}>
        <table className="tbl">
          <thead><tr><th>Sequence</th><th>Last</th></tr></thead>
          <tbody>
            {numbering.map((n) => (
              <tr key={n.key}><td>{n.key}</td><td>{String(n.last).padStart(4, '0')}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Document types" count={`${types.length}`}>
        <table className="tbl">
          <thead><tr><th>Code</th><th>Family</th><th>Workflow</th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.type_code}><td>{t.type_code}</td><td>{t.family}</td><td>{t.workflow_key}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Retention and archival">
        <table className="tbl">
          <thead><tr><th>Domain</th><th>Retention</th></tr></thead>
          <tbody>
            {RETENTION.map(([d, r]) => (
              <tr key={d}><td>{d}</td><td>{r}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="micro">Retention rules are configurable and auditable. Archive, supersede, revoke available in the workspace.</p>
      </Section>
      <Section title="System activity" count={`${activity.length}`}>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Actor</th><th>Event</th><th>Object</th></tr></thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id}><td>{a.createdAt.slice(0, 10)}</td><td>{a.actorRole}</td><td>{a.eventType}</td><td style={{ fontSize: 11 }}>{a.documentId.slice(0, 8)}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
