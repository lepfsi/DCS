'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, Wand2, Save, Check, X } from 'lucide-react';
import { api, me } from '@/lib/api';
import { Dialog, toast } from '@/components/ui';

// Studio d'identité documentaire (UI-14) : chacun voit, les gestionnaires ajustent,
// l'aperçu A4 reflète en direct ce que sera le PDF. L'IA peut copier la structure
// d'un document-modèle uploadé et la formaliser en profil de marque.

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('lecture impossible'));
    fr.readAsDataURL(file);
  });
}

// Aperçu A4 fidèle au profil : mêmes règles que le moteur PDF.
function BrandPreview({ b, logoUrl }: { b: any; logoUrl: string }) {
  const dateLine = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="a4" style={{ padding: b.page.margin, maxWidth: 520, margin: '0 auto' }}>
      <div className="a4-head" style={{ borderBottomColor: b.colors.primary }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoUrl && b.header.showLogo && <img src={logoUrl} alt="logo" style={{ maxHeight: 36, maxWidth: 120, objectFit: 'contain' }} />}
          {b.header.showCompany && (
            <div>
              <strong style={{ fontSize: 13.5, color: b.colors.primary }}>{b.companyName || '—'}</strong>
              {b.tagline && <div className="micro" style={{ marginTop: 1 }}>{b.tagline}</div>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          {b.datePosition === 'top-right' && <div style={{ fontSize: 12 }}>Le {dateLine}</div>}
          <div style={{ fontWeight: 600, fontSize: 12 }}>DO-BIZ-2026-0042</div>
          {b.address.lines.length > 0 && <div className="micro" style={{ marginTop: 3 }}>{b.address.lines.join(' · ')}</div>}
        </div>
      </div>
      {b.datePosition === 'below-header' && <div style={{ textAlign: 'right', fontSize: 12, marginTop: 8 }}>Le {dateLine}</div>}
      <h2 className="a4-title" style={{ fontSize: 16, color: b.colors.text }}>Proposition commerciale — Acme Ltd</h2>
      <div className="micro">Document d'exemple</div>
      <div style={{ marginTop: 12 }}>
        <div className="a4-row"><span className="a4-lbl">Client</span><span>Acme Ltd</span></div>
        <div className="a4-row"><span className="a4-lbl">Périmètre</span><span>Audit de l'infrastructure réseau</span></div>
        <div className="a4-row"><span className="a4-lbl">Honoraires</span><span>830 000 XAF</span></div>
      </div>
      {b.signatureBlock.show && b.signatureBlock.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginTop: 40 }}>
          {b.signatureBlock.labels.map((l: string, i: number) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ borderBottom: '1px solid #c3c8cf', marginBottom: 4 }}>&nbsp;</div>
              <span className="micro">{l}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 10.5, color: '#9aa0a8' }}>
        <span>{[b.footer.left, b.footer.showReference ? 'DO-BIZ-2026-0042' : ''].filter(Boolean).join(' · ')}</span>
        <span>{b.footer.right.replace('{page}', '1').replace('{pages}', '1')}{b.datePosition === 'footer' ? ` · Le ${dateLine}` : ''}</span>
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const [b, setB] = useState<any>(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [role, setRole] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [proposal, setProposal] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const logoInput = useRef<any>(null);
  const analyzeInput = useRef<any>(null);
  const canManage = role === 'admin' || role === 'doc_manager';

  function load() {
    api('/branding').then((r) => {
      setB(r.data); setHasLogo(!!r.data.hasLogo);
      if (r.data.hasLogo) {
        fetch(`${(process.env.NEXT_PUBLIC_API ?? 'http://localhost:3001/api/v1')}/branding/logo`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('dcs_token') ?? ''}` },
        }).then((lr) => lr.ok ? lr.blob() : null).then((blob) => blob ? setLogoUrl(URL.createObjectURL(blob)) : null).catch(() => {});
      }
    }).catch((e) => setErr(e.message));
  }
  useEffect(() => { load(); me().then((u) => setRole(u.role)).catch(() => {}); }, []);

  function set(patch: any) { setB({ ...b, ...patch }); }
  async function save() {
    setErr(''); setMsg('');
    try {
      await api('/branding', { method: 'PATCH', body: JSON.stringify(b) });
      setMsg('Identité enregistrée — les prochains documents générés l\'appliqueront.');
      toast('Identité des documents enregistrée.');
      load();
    } catch (e: any) { setErr(e.message); toast(`Enregistrement impossible : ${e.message}`, 'err'); }
  }
  async function uploadLogo(file: File) {
    setErr(''); setMsg('');
    try {
      const dataUrl = await readFile(file);
      await api('/branding/logo', { method: 'POST', body: JSON.stringify({ dataUrl }) });
      setMsg('Logo enregistré.');
      toast('Logo enregistré.');
      load();
    } catch (e: any) { setErr(e.message); toast(`Logo impossible : ${e.message}`, 'err'); }
  }
  async function analyze(file: File) {
    setErr(''); setMsg(''); setAnalyzing(true);
    try {
      const imageDataUrl = await readFile(file);
      const r = await api('/branding/analyze', { method: 'POST', body: JSON.stringify({ imageDataUrl }) });
      setProposal(r.data.proposal);
    } catch (e: any) { setErr(e.message); }
    setAnalyzing(false);
  }
  async function applyProposal() {
    if (!proposal) return;
    try {
      await api('/branding', { method: 'PATCH', body: JSON.stringify(proposal) });
      setProposal(null); setMsg('Proposition de l\'IA appliquée.');
      toast('Proposition de l\'assistant IA appliquée à l\'identité.');
      load();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
  }

  if (!b) return <p className="muted">Chargement de l'identité…</p>;
  const dateOptions = [
    { key: 'top-right', label: 'En haut à droite (classique)' },
    { key: 'below-header', label: 'Sous le titre' },
    { key: 'footer', label: 'Dans le pied de page' },
  ];
  return (
    <div>
      <h1>Identité des documents</h1>
      <p className="subtitle">Logo, couleurs, en-tête, pied de page, date et signatures : tout document généré porte cette identité. {canManage ? 'Modifiez, l\'aperçu suit en direct.' : 'Consultation — les ajustements sont réservés aux gestionnaires.'}</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}
      {msg && <div className="alert-ok" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="split">
        <div>
          <div style={{ position: 'sticky', top: 12 }}>
            <BrandPreview b={b} logoUrl={logoUrl} />
            <p className="micro" style={{ textAlign: 'center', marginTop: 8 }}>Aperçu fidèle : marges {b.page.margin} pt, couleur principale {b.colors.primary}.</p>
          </div>
        </div>
        <div>
          {canManage && (
            <>
              <div className="card">
                <h3 style={{ marginTop: 0 }}>Analyser un modèle avec l'IA</h3>
                <p className="subtitle" style={{ fontSize: 13 }}>Chargez une capture d'un document type de l'entreprise : l'agent copie la structure (logo, couleurs, en-tête, date, signatures) et la formalise. Vous validez avant application.</p>
                <input ref={analyzeInput} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])} />
                <button className="btn btn-primary" onClick={() => analyzeInput.current?.click()} disabled={analyzing}>
                  <Wand2 size={13} style={{ verticalAlign: -2 }} /> {analyzing ? 'Analyse en cours…' : 'Choisir une image et analyser'}
                </button>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Logo de l'entreprise</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo actuel" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', border: '1px solid var(--border)', padding: 4, borderRadius: 4 }} />
                    : <span className="muted" style={{ fontSize: 13 }}>Aucun logo — le nom de l'entreprise servira d'identifiant.</span>}
                  <div>
                    <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    <button className="btn" onClick={() => logoInput.current?.click()}><Upload size={13} style={{ verticalAlign: -2 }} /> {logoUrl ? 'Remplacer' : 'Téléverser'} (PNG/JPEG, ≤ 2 Mo)</button>
                  </div>
                </div>
                <label style={{ display: 'block', marginTop: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={b.header.showLogo} onChange={(e) => set({ header: { ...b.header, showLogo: e.target.checked } })} /> Afficher le logo dans l'en-tête
                </label>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Identité</h3>
                <label className="lbl">Nom de l'entreprise *</label>
                <input className="input" value={b.companyName} onChange={(e) => set({ companyName: e.target.value })} />
                <label className="lbl">Devise / slogan</label>
                <input className="input" value={b.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Ex : Better documents. Smoother operations." />
                <label className="lbl">Adresse et contacts (1 ligne par élément)</label>
                <textarea className="input" rows={3} value={b.address.lines.join('\n')} onChange={(e) => set({ address: { lines: e.target.value.split('\n').filter((l: string) => l.trim() !== '') } })} placeholder={'Douala, Cameroun\ncontact@dailyops.tech'} />
                <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={b.header.showCompany} onChange={(e) => set({ header: { ...b.header, showCompany: e.target.checked } })} /> Afficher le nom de l'entreprise dans l'en-tête
                </label>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Couleurs</h3>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {(['primary', 'accent', 'text'] as const).map((k) => (
                    <label key={k} style={{ fontSize: 13 }}>
                      {k === 'primary' ? 'Principale' : k === 'accent' ? 'Accent (lignes, touches)' : 'Texte'}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <input type="color" value={b.colors[k]} onChange={(e) => set({ colors: { ...b.colors, [k]: e.target.value } })} style={{ width: 42, height: 30, padding: 0, border: '1px solid var(--border)', borderRadius: 4 }} />
                        <input className="input" style={{ width: 92 }} value={b.colors[k]} onChange={(e) => set({ colors: { ...b.colors, [k]: e.target.value } })} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Page et mise en forme</h3>
                <label className="lbl">Marges : {b.page.margin} pt</label>
                <input type="range" min={24} max={90} value={b.page.margin} onChange={(e) => set({ page: { margin: Number(e.target.value) } })} style={{ width: '100%' }} />
                <label className="lbl">Position de la date</label>
                {dateOptions.map((o) => (
                  <label key={o.key} style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
                    <input type="radio" checked={b.datePosition === o.key} onChange={() => set({ datePosition: o.key })} /> {o.label}
                  </label>
                ))}
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Pied de page</h3>
                <label className="lbl">Texte à gauche</label>
                <input className="input" value={b.footer.left} onChange={(e) => set({ footer: { ...b.footer, left: e.target.value } })} />
                <label className="lbl">Texte à droite (<code>{'{page}'}</code> et <code>{'{pages}'}</code> pour la pagination)</label>
                <input className="input" value={b.footer.right} onChange={(e) => set({ footer: { ...b.footer, right: e.target.value } })} />
                <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={b.footer.showReference} onChange={(e) => set({ footer: { ...b.footer, showReference: e.target.checked } })} /> Rappeler la référence du document
                </label>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>Zone de signature</h3>
                <label style={{ display: 'block', fontSize: 13 }}>
                  <input type="checkbox" checked={b.signatureBlock.show} onChange={(e) => set({ signatureBlock: { ...b.signatureBlock, show: e.target.checked } })} /> Afficher des lignes de signature
                </label>
                {b.signatureBlock.show && (
                  <>
                    <label className="lbl">Libellés (1 par ligne, max 4)</label>
                    <textarea className="input" rows={2} value={b.signatureBlock.labels.join('\n')}
                      onChange={(e) => set({ signatureBlock: { ...b.signatureBlock, labels: e.target.value.split('\n').filter((l: string) => l.trim() !== '') } })}
                      placeholder={'Pour DailyOps.Tech\nLe client'} />
                  </>
                )}
              </div>

              <p style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={save}><Save size={13} style={{ verticalAlign: -2 }} /> Enregistrer l'identité</button>
                <span className="micro">S'applique aux prochains documents générés — les PDF déjà émis restent inchangés (preuve figée).</span>
              </p>
            </>
          )}
          {!canManage && (
            <div className="card">
              <p className="subtitle" style={{ margin: 0 }}>Votre rôle ({role || '…'}) permet de consulter l'identité documentaire. Les ajustements sont faits par un gestionnaire ou un administrateur, avec l'aide de l'IA si besoin.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!proposal} title="Proposition de l'assistant IA" onClose={() => setProposal(null)}
        footer={<><button className="btn" onClick={() => setProposal(null)}><X size={13} style={{ verticalAlign: -2 }} /> Ignorer</button><button className="btn btn-primary" onClick={applyProposal}><Check size={13} style={{ verticalAlign: -2 }} /> Appliquer</button></>}>
        <p className="subtitle">Structure détectée dans votre document-modèle. Vérifiez l'aperçu ci-contre avant d'appliquer — le profil actuel reste intact si vous ignorez.</p>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div><strong>Entreprise :</strong> {proposal?.companyName}</div>
          <div><strong>Slogan :</strong> {proposal?.tagline || '—'}</div>
          <div><strong>Couleurs :</strong> principale {proposal?.colors?.primary}, accent {proposal?.colors?.accent}</div>
          <div><strong>Marges :</strong> {proposal?.page?.margin} pt</div>
          <div><strong>Date :</strong> {proposal?.datePosition === 'top-right' ? 'en haut à droite' : proposal?.datePosition === 'below-header' ? 'sous le titre' : 'dans le pied de page'}</div>
          <div><strong>Signatures :</strong> {(proposal?.signatureBlock?.labels ?? []).join(', ') || '—'}</div>
        </div>
        <p className="micro" style={{ marginTop: 10 }}>Le logo ne se copie pas automatiquement : téléversez-le dans la section dédiée.</p>
      </Dialog>
    </div>
  );
}
