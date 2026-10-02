'use client';
import { useEffect, useState } from 'react';
import { api, me } from '@/lib/api';
import Pager, { paginate } from '../pager';

const TABS = ['customers', 'people', 'employees', 'projects', 'services', 'transactions', 'relationships'] as const;

const FORMS: Record<string, Array<{ key: string; label: string; type?: string }>> = {
  customers: [{ key: 'name', label: 'Nom (requis)' }, { key: 'address', label: 'Adresse' }, { key: 'email', label: 'Email' }, { key: 'taxId', label: 'NIF' }],
  people: [{ key: 'fullName', label: 'Nom complet (requis)' }, { key: 'title', label: 'Fonction' }, { key: 'email', label: 'Email' }],
  employees: [{ key: 'fullName', label: 'Nom complet (requis)' }, { key: 'title', label: 'Fonction' }, { key: 'email', label: 'Email' }],
  projects: [{ key: 'title', label: 'Titre (requis)' }, { key: 'code', label: 'Code' }, { key: 'status', label: 'Statut' }],
  services: [{ key: 'name', label: 'Nom (requis)' }, { key: 'unitPrice', label: 'Prix unitaire', type: 'number' }, { key: 'currency', label: 'Devise', type: 'currency' }],
  transactions: [],
  relationships: [],
};

const LABEL: Record<string, (r: any) => string> = {
  customers: (r) => r.name,
  people: (r) => r.fullName,
  employees: (r) => `${r.fullName} (${r.title ?? '-'})`,
  projects: (r) => `${r.title} (${r.code ?? '-'})`,
  services: (r) => `${r.name} - ${r.unitPrice} ${r.currency}`,
  transactions: (r) => `${r.kind} - ${r.amount ?? '-'} ${r.currency} [${r.status}]`,
  relationships: (r) => `${r.from} -[${r.link_type}]-> ${r.to}`,
};

const CURRENCIES = ['XAF', 'USD', 'EUR'];

function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value || 'XAF'} onChange={(e) => onChange(e.target.value)}>
      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

// Les transactions naissent des documents (proposition, facture, paiement) : on les rattache ici
// explicitement au client, projet et montant. Les relations naissent dans le workspace (Dériver, Lier).
function TxForm({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [kind, setKind] = useState('proposal');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => {
    api('/customers').then((r) => setCustomers(r.data)).catch(() => {});
    api('/projects').then((r) => setProjects(r.data)).catch(() => {});
  }, []);
  async function create() {
    try {
      await api('/transactions', { method: 'POST', body: JSON.stringify({ kind, customerId: customerId || undefined, projectId: projectId || undefined, amount: amount === '' ? undefined : Number(amount), currency }) });
      onDone();
    } catch (e: any) { onError(e.message); }
  }
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Nouvelle transaction</h2>
      <label className="lbl">Nature</label>
      <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="proposal">proposal</option><option value="order">order</option>
        <option value="invoice">invoice</option><option value="payment">payment</option>
      </select>
      <label className="lbl">Client</label>
      <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">-</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="lbl">Projet</label>
      <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">-</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <label className="lbl">Montant</label>
      <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="lbl">Devise</label>
      <CurrencySelect value={currency} onChange={setCurrency} />
      <p style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={create}>Créer</button></p>
      <p className="micro">Les documents se rattachent ensuite depuis la fiche transaction ou le workspace.</p>
    </div>
  );
}

export default function RecordsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('customers');
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [form, setForm] = useState<Record<string, any>>({});
  const [role, setRole] = useState('');
  const [err, setErr] = useState('');
  const canWrite = role !== 'viewer';
  function load(t: string) {
    setTab(t as any); setForm({}); setErr(''); setPage(0);
    api(`/${t}`).then((r) => setRows(r.data)).catch((e) => setErr(e.message));
  }
  useEffect(() => { load('customers'); me().then((u) => setRole(u.role)).catch(() => {}); }, []);
  async function create() {
    setErr('');
    const firstKey = (FORMS[tab] ?? [])[0]?.key;
    if (firstKey && !String(form[firstKey] ?? '').trim()) { setErr('Le premier champ est requis.'); return; }
    try {
      const body: any = { ...form };
      if (tab === 'services' && body.unitPrice !== undefined && body.unitPrice !== '') body.unitPrice = Number(body.unitPrice);
      await api(`/${tab}`, { method: 'POST', body: JSON.stringify(body) });
      setForm({});
      load(tab);
    } catch (e: any) { setErr(e.message); }
  }
  const shown = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1>Records</h1>
      <p className="subtitle">Business context for document operations. Not a CRM.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} onClick={() => load(t)} className={'tab' + (tab === t ? ' active' : '')}>{t}</button>
        ))}
      </div>
      <input className="input" style={{ maxWidth: 320, marginBottom: 12 }} placeholder="Search records..." value={q} onChange={(e) => setQ(e.target.value)} />
      <table className="tbl">
        <thead><tr><th>Name / Reference</th><th>Detail</th><th>Open</th></tr></thead>
        <tbody>
          {paginate(shown, page, pageSize).map((r) => (
            <tr key={r.id}>
              <td>{LABEL[tab](r)}</td>
              <td style={{ fontSize: 12 }}>{r.email ?? r.status ?? r.title ?? ''}</td>
              <td>{tab !== 'relationships' && <a href={`/records/${tab}/${r.id}`}>Open</a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && !err && <div className="empty"><strong>No records here.</strong></div>}
      <Pager total={shown.length} pageSize={pageSize} setPageSize={setPageSize} page={page} setPage={setPage} />
      {tab !== 'transactions' && tab !== 'relationships' && (canWrite ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Nouveau ({tab})</h2>
          <p className="subtitle">Les fiches se créent ici explicitement, puis se lient aux documents (wizard, workspace).</p>
          {(FORMS[tab] ?? []).map((f) => (
            <div key={f.key}>
              <label className="lbl">{f.label}</label>
              {f.type === 'currency'
                ? <CurrencySelect value={form[f.key] ?? 'XAF'} onChange={(v) => setForm({ ...form, [f.key]: v })} />
                : <input className="input" type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </div>
          ))}
          <p style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={create}>Créer</button></p>
        </div>
      ) : (
        <p className="subtitle" style={{ marginTop: 16 }}>Création réservée aux rôles opérationnels (rôle actuel : {role || '...'}).</p>
      ))}
      {tab === 'transactions' && canWrite && <TxForm onDone={() => load(tab)} onError={(m) => setErr(m)} />}
      {tab === 'transactions' && !canWrite && (
        <p className="subtitle" style={{ marginTop: 16 }}>Création réservée aux rôles opérationnels (rôle actuel : {role || '...'}).</p>
      )}
      {tab === 'relationships' && (
        <p className="subtitle" style={{ marginTop: 16 }}>Les relations naissent dans le workspace : Dériver un document, ou Lier deux documents (proposition → contrat → facture). Lecture seule ici.</p>
      )}
    </div>
  );
}
