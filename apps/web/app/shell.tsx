'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Search, LayoutDashboard, Inbox, FileText, Files, Building2, FolderKanban, Briefcase, Receipt, Shapes, Palette, Settings, LogOut, FileSignature } from 'lucide-react';
import { API_BASE, clearToken } from '@/lib/api';
import { Toaster } from '@/components/ui';

// Navigation cible (spec §28) : groupes courts, les détails vivent dans leur contexte.
const NAV = [
  { group: 'Accueil', items: [
    { href: '/', label: 'Accueil', Icon: LayoutDashboard },
    { href: '/inbox', label: 'Inbox', Icon: Inbox },
    { href: '/documents', label: 'Documents', Icon: FileText },
    { href: '/library', label: 'Bibliothèque', Icon: Files },
  ]},
  { group: 'Contexte', items: [
    { href: '/records?tab=customers', label: 'Clients', Icon: Building2 },
    { href: '/records?tab=projects', label: 'Projets', Icon: FolderKanban },
    { href: '/records?tab=services', label: 'Services', Icon: Briefcase },
    { href: '/records?tab=transactions', label: 'Transactions', Icon: Receipt },
  ]},
  { group: 'Ressources', items: [
    { href: '/templates', label: 'Modèles', Icon: Shapes },
    { href: '/branding', label: 'Identité', Icon: Palette },
  ]},
  { group: 'Administration', items: [
    { href: '/admin', label: 'Administration', Icon: Settings },
  ]},
];

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dcs_token') ?? sessionStorage.getItem('dcs_token');
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any>(null);
  const timer = useRef<any>(null);
  function onChange(v: string) {
    setQ(v);
    clearTimeout(timer.current);
    if (v.trim().length < 2) { setRes(null); return; }
    timer.current = setTimeout(async () => {
      const t = token();
      if (!t) return;
      try {
        const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(v)}`, { headers: { Authorization: `Bearer ${t}` } });
        if (r.ok) setRes((await r.json()).data);
      } catch { /* silencieux : la recherche ne bloque jamais */ }
    }, 300);
  }
  return (
    <div className="searchbox">
      <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--muted)' }}><Search size={15} /></span>
      <input className="input" style={{ paddingLeft: 32 }} placeholder="Search documents, records, people..." value={q} onChange={(e) => onChange(e.target.value)} onBlur={() => setTimeout(() => setRes(null), 200)} />
      {res && (
        <div className="searchresults">
          {res.documents?.length > 0 && <div className="searchgroup">Documents</div>}
          {(res.documents ?? []).map((d: any) => <a key={d.id} className="searchitem" href={`/documents/${d.id}`}>{d.reference} - {d.title}</a>)}
          {res.customers?.length > 0 && <div className="searchgroup">Records</div>}
          {(res.customers ?? []).map((c: any) => <a key={c.id} className="searchitem" href={`/records/customer/${c.id}`}>{c.name}</a>)}
          {(res.projects ?? []).map((p: any) => <a key={p.id} className="searchitem" href={`/records/project/${p.id}`}>{p.title}</a>)}
          {res.templates?.length > 0 && <div className="searchgroup">Templates</div>}
          {(res.templates ?? []).map((t: any) => <a key={t.id} className="searchitem" href="/templates">{t.name}</a>)}
          {res.documents?.length === 0 && res.customers?.length === 0 && <div className="searchitem">Aucun résultat.</div>}
        </div>
      )}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState('');
  const bare = path === '/login' || path.startsWith('/verify') || path.startsWith('/public');

  // Query string courante (pour l'état actif des liens Contexte avec onglet).
  useEffect(() => { setSearch(window.location.search); }, [path]);

  useEffect(() => {
    const t = token();
    if (!t) {
      if (!bare) router.push('/login');
      return;
    }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUser(j?.user ?? null))
      .catch(() => {});
    fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUnread(j?.unreadCount ?? 0))
      .catch(() => {});
  }, [path]);

  function logout() {
    clearToken();
    router.push('/login');
  }

  if (bare) return <><Toaster /><main className="content">{children}</main></>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><strong>DailyOps</strong><small>DCS - Document Control</small></div>
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.group} className="navgroup">
              <span className="navsep">{g.group}</span>
              {g.items.map((n) => {
                const [base, query] = n.href.split('?');
                const active = base === '/' ? path === '/' : path.startsWith(base) && (!query || search.includes(query));
                return (
                  <a key={n.href} href={n.href} className={'navlink' + (active ? ' active' : '')}>
                    <n.Icon size={15} style={{ verticalAlign: -2, marginRight: 8 }} /><span className="lbl">{n.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: 16, fontSize: 11, opacity: 0.6 }}>
          Better documents.<br />Smoother operations.
          <div style={{ marginTop: 8 }}>v1.0.0</div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <GlobalSearch />
          <div className="topuser">
            <a href="/signature" title="Ma signature électronique" style={{ color: 'var(--ink)' }} aria-label="Ma signature électronique">
              <FileSignature size={16} style={{ verticalAlign: -3 }} />
            </a>
            <a href="/notifications" className="bell" title="Notifications" style={{ color: 'var(--ink)' }}>
              <Bell size={17} />
              {unread > 0 && <span className="count">{unread}</span>}
            </a>
            <span>{user ? `${user.displayName} (${user.role}${user.department ? ` · ${user.department}` : ''})` : '...'}</span>
            <button className="btn" onClick={logout} title="Logout"><LogOut size={14} /></button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
