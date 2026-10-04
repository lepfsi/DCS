'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { stateLabel, fmtMoney, fmtDate, evaluateFormula, TYPE_DATASOURCE, DATASOURCE_LABEL } from '@/lib/ui';
import { API_BASE } from '@/lib/api';

// Télécharge l'artefact officiel (PDF faisant foi) depuis le stockage contrôlé.
export async function downloadArtifact(artifactId: string, filename: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dcs_token') : null;
  const r = await fetch(`${API_BASE}/artifacts/${artifactId}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error('fichier indisponible');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Impression (§19) : utilise le PDF officiel, jamais un rendu parallèle.
export async function printArtifact(artifactId: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dcs_token') : null;
  const r = await fetch(`${API_BASE}/artifacts/${artifactId}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error('fichier indisponible');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const f = document.createElement('iframe');
  f.style.display = 'none';
  f.src = url;
  document.body.appendChild(f);
  f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, '_blank'); } };
}

// Identité visuelle de l'entreprise : un seul fetch pour toute la session (cache module).
let brandingCache: any = null;
let brandingLogoUrl: string | null = null;
let brandingInflight: Promise<void> | null = null;
export function useBranding() {
  const [state, setState] = useState<{ branding: any; logoUrl: string | null } | null>(
    brandingCache ? { branding: brandingCache, logoUrl: brandingLogoUrl } : null,
  );
  useEffect(() => {
    if (brandingCache) { setState({ branding: brandingCache, logoUrl: brandingLogoUrl }); return; }
    brandingInflight ??= (async () => {
      const r = await fetch(`${API_BASE}/branding`, { headers: authHeader() });
      if (!r.ok) throw new Error('branding indisponible');
      brandingCache = (await r.json()).data;
      if (brandingCache.hasLogo) {
        const lr = await fetch(`${API_BASE}/branding/logo`, { headers: authHeader() });
        if (lr.ok) brandingLogoUrl = URL.createObjectURL(await lr.blob());
      }
    })();
    brandingInflight.then(() => setState({ branding: brandingCache, logoUrl: brandingLogoUrl })).catch(() => {});
  }, []);
  return state;
}
function authHeader(): Record<string, string> {
  const t = typeof window !== 'undefined' ? localStorage.getItem('dcs_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Champ intelligent (§5, §12-13) : rendu complet — libellé, aide, saisie selon le type,
// source de données métier, liste de choix, champ calculé, condition d'affichage, bornes.
// Un seul composant pour la création ET le workspace : même comportement partout.
export function SmartField({ f, value, values, lists, onChange, showErrors, children }: {
  f: any; value: any; values: Record<string, any>;
  lists: Record<string, Array<{ id: string; name: string }>>;
  onChange: (v: any) => void; showErrors?: boolean; children?: React.ReactNode;
}) {
  const [touched, setTouched] = useState(false);
  const empty = value === undefined || value === null || value === '';
  const requiredMissing = !!f.required && empty;
  const invalid = (touched || showErrors) && requiredMissing;
  // Champ calculé : la formule se réévalue en direct, la valeur remonte au document.
  const computed = f.type === 'computed' ? evaluateFormula(f.formula ?? '', values) : null;
  useEffect(() => {
    if (f.type === 'computed' && computed !== null && computed !== Number(value)) onChange(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed]);
  // Condition d'affichage niveau 2 : le champ n'existe que si la condition est remplie.
  if (f.visibleIf && values[f.visibleIf.field] !== f.visibleIf.equals) return null;
  if (f.type === 'computed') {
    return (
      <div style={{ marginTop: 10 }}>
        <label className="lbl" style={{ margin: 0 }}>{f.label}{f.required ? ' *' : ''}</label>
        <div className="input" style={{ background: '#fafbfc', fontWeight: 600 }}>
          {computed !== null ? fmtMoney(computed) : '—'}
        </div>
        {f.help && <p className="muted" style={{ fontSize: 12, margin: '3px 0 0' }}>{f.help}</p>}
      </div>
    );
  }
  const ds = f.dataSource ?? TYPE_DATASOURCE[f.type];
  const dsList = ds ? (lists[ds] ?? []) : [];
  const numeric = f.type === 'number' || f.type === 'currency';
  const outOfRange = (touched || showErrors) && numeric && value !== '' && value != null &&
    ((f.min !== undefined && Number(value) < f.min) || (f.max !== undefined && Number(value) > f.max));
  const errStyle = invalid ? { borderColor: 'var(--danger)', background: '#fdf6f6' } : undefined;
  return (
    <div id={`field-${f.key}`} style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="lbl" style={{ margin: 0, ...(invalid ? { color: 'var(--danger)' } : null) }}>{f.label}{f.required ? ' *' : ''}</label>
        {children}
      </div>
      {ds && dsList.length > 0 ? (
        <select className="input" style={{ marginTop: 4, ...errStyle }} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Choisir {DATASOURCE_LABEL[ds] ?? ds}…</option>
          {dsList.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
      ) : f.type === 'list' ? (
        <select className="input" style={{ marginTop: 4, ...errStyle }} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Choisir…</option>
          {(f.options ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea className="input" rows={4} style={{ marginTop: 4, ...errStyle }} value={value ?? ''} onChange={(e) => onChange(e.target.value)} onBlur={() => setTouched(true)} />
      ) : (
        <input
          className="input" style={{ marginTop: 4, ...errStyle }}
          type={numeric ? 'number' : f.type === 'date' ? 'date' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(numeric ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
          onBlur={() => setTouched(true)}
        />
      )}
      {f.help && <p className="muted" style={{ fontSize: 12, margin: '3px 0 0' }}>{f.help}</p>}
      {invalid && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '3px 0 0' }}>Ce champ est obligatoire.</p>}
      {outOfRange && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '3px 0 0' }}>
        {f.min !== undefined && Number(value) < f.min ? `Valeur minimale : ${f.min}` : `Valeur maximale : ${f.max}`}
      </p>}
    </div>
  );
}

// Toast global (§31, §32) : confirmation visible de chaque action réussie ou échouée.
// Usage direct depuis n'importe quelle page : toast('Enregistré.') — mounté une fois dans le shell.
type ToastItem = { id: number; text: string; kind: 'ok' | 'err' };
let toastListeners: Array<(t: ToastItem) => void> = [];
let toastSeq = 0;
export function toast(text: string, kind: 'ok' | 'err' = 'ok') {
  const item = { id: ++toastSeq, text, kind };
  toastListeners.forEach((l) => l(item));
}
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3500);
    };
    toastListeners.push(add);
    return () => { toastListeners = toastListeners.filter((l) => l !== add); };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast ' + (t.kind === 'ok' ? 'toast-ok' : 'toast-err')} onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}>
          <span>{t.kind === 'ok' ? '✓' : '✕'}</span> {t.text}
        </div>
      ))}
    </div>
  );
}

// Badge d'état traduit (§20 : l'interface affiche des états humains, jamais la machine).
export function StateBadge({ state }: { state: string }) {
  return <span className={`badge st-${state}`}>{stateLabel(state)}</span>;
}

// Dialogue modal : remplace prompt()/alert()/confirm() (spec §27).
export function Dialog({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="dlg-overlay" onClick={onClose}>
      <div className="dlg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="dlg-head">
          <strong>{title}</strong>
          <button className="dlg-x" onClick={onClose} aria-label="Fermer"><X size={15} /></button>
        </div>
        <div className="dlg-body">{children}</div>
        {footer && <div className="dlg-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Stepper de processus (§20) : Brouillon → Revue → Approbation → Signature → Émission.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="stepper">
      {steps.map((s, i) => (
        <div key={s + i} className={'step' + (i < current ? ' done' : i === current ? ' now' : '')}>
          <span className="dot">{i < current ? '✓' : i + 1}</span>
          <span className="step-lbl">{s}</span>
          {i < steps.length - 1 && <span className="step-line" />}
        </div>
      ))}
    </div>
  );
}

// Valeur de champ rendue humainement : montants formatés, dates fr, lignes en tableau.
export function FieldVal({ f, value }: { f: any; value: any }) {
  if (value === undefined || value === null || value === '') return <span className="muted">—</span>;
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && 'label' in value[0]) {
      return (
        <table className="tbl tbl-mini">
          <thead><tr><th>Prestation</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead>
          <tbody>
            {value.map((l: any, i: number) => (
              <tr key={i}><td>{l.label}</td><td>{l.qty}</td><td>{fmtMoney(l.unitPrice, f.currency)}</td><td>{fmtMoney((l.qty ?? 1) * (l.unitPrice ?? 0), f.currency)}</td></tr>
            ))}
          </tbody>
        </table>
      );
    }
    return <span>{value.join(', ')}</span>;
  }
  if (f.type === 'currency' || f.type === 'number') return <span>{fmtMoney(value, f.currency)}</span>;
  if (f.type === 'date') return <span>{fmtDate(value)}</span>;
  if (f.type === 'textarea') return <span style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</span>;
  return <span>{String(value)}</span>;
}

// Aperçu document réel (§10) : rendu type A4, jamais de JSON. L'habillage (logo,
// couleurs, en-tête, date, signatures, pied de page) vient du profil de marque.
export function DocPreview({ doc, schema, values, template, typeLabel }: { doc: any; schema: any; values: Record<string, any>; template?: any; typeLabel?: string }) {
  const br = useBranding();
  const branding = br?.branding;
  const logoUrl = br?.logoUrl;
  const dateLine = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const margin = branding?.page?.margin ?? 40;
  return (
    <div className="a4" style={{ padding: margin, borderColor: branding ? branding.colors.accent : undefined }}>
      <div className="a4-head" style={{ borderBottomColor: branding?.colors?.primary }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoUrl && branding?.header?.showLogo !== false && <img src={logoUrl} alt="logo" style={{ maxHeight: 40, maxWidth: 140, objectFit: 'contain' }} />}
          {branding?.header?.showCompany !== false && (
            <div>
              <strong style={{ fontSize: 14.5, color: branding?.colors?.primary }}>{branding?.companyName ?? 'DailyOps.Tech'}</strong>
              {branding?.tagline && <div className="micro" style={{ marginTop: 1 }}>{branding.tagline}</div>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {branding?.datePosition === 'top-right' && <div style={{ fontSize: 12.5 }}>{dateLine}</div>}
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{doc.reference}</div>
          <div className="micro">Révision {doc.currentRevision}{template ? ` · Modèle v${template.version}` : ''}</div>
          {branding?.address?.lines?.length > 0 && <div className="micro" style={{ marginTop: 3 }}>{branding.address.lines.join(' · ')}</div>}
        </div>
      </div>
      {branding?.datePosition === 'below-header' && <div style={{ textAlign: 'right', fontSize: 12.5, marginTop: 10 }}>{dateLine}</div>}
      <h2 className="a4-title" style={{ color: branding?.colors?.text }}>{doc.title}</h2>
      <div className="micro">{typeLabel ?? 'Document'}</div>
      <div style={{ marginTop: 14 }}>
        {(schema?.fields ?? []).map((f: any) => (
          <div key={f.key} className="a4-row">
            <span className="a4-lbl">{f.label}</span>
            <span className="a4-val"><FieldVal f={f} value={values[f.key]} /></span>
          </div>
        ))}
        {(schema?.fields ?? []).length === 0 && <p className="muted">Ce modèle ne définit pas encore de champs.</p>}
      </div>
      {branding?.signatureBlock?.show && (branding?.signatureBlock?.labels ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: 24, marginTop: 48 }}>
          {branding.signatureBlock.labels.map((lbl: string, i: number) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ borderBottom: '1px solid #c3c8cf', marginBottom: 4 }}>&nbsp;</div>
              <span className="micro">{lbl}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 11, color: '#9aa0a8' }}>
        <span>{[branding?.footer?.left, branding?.footer?.showReference !== false ? doc.reference : ''].filter(Boolean).join(' · ')}</span>
        <span>{(branding?.footer?.right ?? '').replace('{page}', '1').replace('{pages}', '1')}{branding?.datePosition === 'footer' ? ` · ${dateLine}` : ''}</span>
      </div>
    </div>
  );
}

// État vide contextualisé (spec §32, wireframes §40).
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint && <p style={{ margin: '6px 0 0' }}>{hint}</p>}
      {action && <p style={{ margin: '10px 0 0' }}>{action}</p>}
    </div>
  );
}
