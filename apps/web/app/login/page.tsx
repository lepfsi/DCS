'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, ShieldCheck, FileCheck2, History } from 'lucide-react';
import { api, setToken, apiHealth, API_BASE, me } from '@/lib/api';

const DEMO = [
  { email: 'admin@dailyops.tech', password: 'admin123', role: 'admin' },
  { email: 'manager@dailyops.tech', password: 'manager123', role: 'doc_manager' },
  { email: 'author@dailyops.tech', password: 'author123', role: 'author' },
  { email: 'reviewer@dailyops.tech', password: 'reviewer123', role: 'reviewer' },
  { email: 'approver@dailyops.tech', password: 'approver123', role: 'approver' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiHealth().then((ok) => {
      setApiOk(ok);
      if (ok) me().then(() => router.push('/')).catch(() => {});
    });
  }, []);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr('');
    if (!email.trim() || !password) { setErr('Renseignez l\'email et le mot de passe.'); return; }
    if (apiOk === false) { setErr(`API injoignable (${API_BASE}). Démarrez-la : dossier apps/api, commande node dist/src/index.js. Vos identifiants sont conservés.`); return; }
    setLoading(true);
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
      setToken(r.token, remember);
      router.push('/');
    } catch (e: any) {
      setErr(`${e.message} Vos données sont intactes, réessayez.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div><strong style={{ fontSize: 20, letterSpacing: '0.04em' }}>DailyOps</strong></div>
        <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>Document Control System</div>
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, fontSize: 13 }}>
            <FileCheck2 size={16} /><span>Créer des documents contrôlés, sans ressaisie.</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, fontSize: 13 }}>
            <ShieldCheck size={16} /><span>Revues, approbations et signatures tracées.</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, fontSize: 13 }}>
            <History size={16} /><span>Preuve reconstituable à tout moment.</span>
          </div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 11, opacity: 0.6 }}>L'utilisateur gère la décision. Le système gère la mécanique.</div>
      </div>
      <div className="login-side">
        <div className="login-card">
          <h1>Connexion</h1>
          <p className="subtitle">Accédez à votre espace documentaire. Les accès sont créés par un administrateur.</p>
          <p className="micro">API : {apiOk === null ? 'vérification...' : apiOk ? '[OK] joignable' : '[KO] injoignable'}</p>
          {err && <div className="alert-err"><strong>Échec : </strong>{err}</div>}
          <form onSubmit={submit}>
            <label className="lbl" htmlFor="email">Email professionnel</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@dailyops.tech" />
            <label className="lbl" htmlFor="password">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input id="password" className="input" style={{ paddingRight: 40 }} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} title={show ? 'Masquer' : 'Afficher'} style={{ position: 'absolute', right: 8, top: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <label style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 13 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Rester connecté sur cet appareil
            </label>
            <p style={{ marginTop: 14 }}>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                <LogIn size={14} style={{ verticalAlign: -2 }} /> {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </p>
          </form>
          <h3>Comptes de démonstration</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DEMO.map((d) => (
              <button key={d.role} className="btn" onClick={() => { setEmail(d.email); setPassword(d.password); }}>{d.role}</button>
            ))}
          </div>
          <p className="micro" style={{ marginTop: 12 }}>Un clic remplit le formulaire. Chaque rôle voit ses files et ses actions.</p>
          <p className="micro" style={{ marginTop: 10 }}><a href="/public">Registre public des documents officiels →</a></p>
        </div>
      </div>
    </div>
  );
}
