export const API_BASE = process.env.NEXT_PUBLIC_API ?? 'http://localhost:3001/api/v1';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('dcs_token') ?? sessionStorage.getItem('dcs_token');
}

export const API_DOWN_HINT = `API injoignable (${API_BASE}) - démarrez-la : dossier apps/api → node dist/src/index.js`;

export async function apiHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

export async function api(path: string, opts: RequestInit = {}) {
  const t = token();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(opts.headers ?? {}) },
    });
  } catch {
    throw new Error(API_DOWN_HINT);
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.detail ? `${j.error} - ${j.detail}` : j.error;
    } catch { /* corps non JSON */ }
    if (msg.includes('invalid_credentials')) msg = 'Email ou mot de passe incorrect.';
    if (res.status === 401 && t && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      clearToken();
      window.location.href = '/login';
      throw new Error('Session expirée - reconnectez-vous.');
    }
    if (res.status === 401 && !t) msg = msg.startsWith('Email ou mot') ? msg : 'Non connecté - passez par /login';
    throw new Error(msg);
  }
  return res.json();
}

export function setToken(t: string, remember = true) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem('dcs_token', t);
  meCache = null;
}
export function clearToken() { localStorage.removeItem('dcs_token'); sessionStorage.removeItem('dcs_token'); meCache = null; }

let meCache: any = null;
export function clearMe() { meCache = null; }
// Rôle courant (cache session) : l'UI n'affiche que ce que le rôle permet, avec explication.
export async function me() {
  if (meCache) return meCache;
  meCache = (await api('/auth/me')).user;
  return meCache;
}
