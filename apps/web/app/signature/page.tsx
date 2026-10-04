'use client';
import { useEffect, useState } from 'react';
import { FileSignature, ShieldCheck, Lock, Unlock } from 'lucide-react';
import { api } from '@/lib/api';
import { Dialog, toast } from '@/components/ui';

// Ma signature électronique : LA porte d'entrée de la fonctionnalité (§17).
// Activation volontaire (nom légal + passphrase), statut de verrouillage (15 min glissantes),
// changement de passphrase, désactivation. On ne signe jamais à la place de quelqu'un.
export default function SignaturePage() {
  const [me, setMe] = useState<any>(null);
  const [name, setName] = useState('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [passDlg, setPassDlg] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', next: '', next2: '' });
  const [offDlg, setOffDlg] = useState(false);
  const [offPass, setOffPass] = useState('');

  function load() {
    api('/auth/me').then((r) => { setMe(r.user); setName(r.user.displayName ?? ''); }).catch((e) => setErr(e.message));
  }
  useEffect(() => { load(); }, []);

  async function activate() {
    setBusy(true); setErr('');
    if (pass1 !== pass2) { setErr('Les deux passphrases ne correspondent pas.'); setBusy(false); return; }
    try {
      await api('/me/signature', { method: 'POST', body: JSON.stringify({ signatureName: name.trim(), passphrase: pass1 }) });
      toast('Signature électronique activée.');
      setPass1(''); setPass2('');
      load();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
    setBusy(false);
  }
  async function changePass() {
    setBusy(true); setErr('');
    if (passForm.next !== passForm.next2) { setErr('Les deux nouvelles passphrases ne correspondent pas.'); setBusy(false); return; }
    try {
      await api('/me/signature/passphrase', { method: 'POST', body: JSON.stringify({ current: passForm.current, next: passForm.next }) });
      toast('Passphrase modifiée.');
      setPassDlg(false); setPassForm({ current: '', next: '', next2: '' });
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
    setBusy(false);
  }
  async function deactivate() {
    setBusy(true); setErr('');
    try {
      await api('/me/signature/deactivate', { method: 'POST', body: JSON.stringify({ passphrase: offPass }) });
      toast('Signature électronique désactivée.');
      setOffDlg(false); setOffPass('');
      load();
    } catch (e: any) { setErr(e.message); toast(e.message, 'err'); }
    setBusy(false);
  }

  if (!me) return <p className="muted">Chargement…</p>;
  const activated = me.signingActivated && me.hasPass;
  return (
    <div style={{ maxWidth: 640 }}>
      <h1><FileSignature size={20} style={{ verticalAlign: -3 }} /> Ma signature électronique</h1>
      <p className="subtitle">Signez les documents en ligne : le PDF émis s'imprime déjà signé — plus besoin de signature manuscrite. C'est un acte personnel, protégé par votre passphrase.</p>
      {err && <div className="alert-err"><strong>Erreur : </strong>{err}</div>}

      {!activated ? (
        <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
          <h2 style={{ marginTop: 0 }}>Activer ma signature</h2>
          <p className="subtitle">Trois informations, une seule fois. Ensuite, votre passphrase vous sera demandée à chaque signature (redemandée après 15 minutes sans usage).</p>
          <label className="lbl">Votre nom légal — tel qu'il figurera sur les documents signés *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="lbl">Passphrase de signature * (6 caractères minimum)</label>
          <input className="input" type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} autoComplete="new-password" />
          <label className="lbl">Confirmez la passphrase *</label>
          <input className="input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
          <p style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={activate} disabled={busy || name.trim().length < 3 || pass1.length < 6 || pass1 !== pass2}>
              Activer ma signature
            </button>
          </p>
          <p className="micro">La passphrase est stockée hachée : personne ne peut la lire, pas même un administrateur. Vous restez seul à pouvoir signer en votre nom.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
            <h2 style={{ marginTop: 0 }}>Statut</h2>
            <dl className="kv">
              <dt>Nom de signature</dt><dd><strong>{me.signatureName}</strong></dd>
              <dt>État</dt>
              <dd>
                {me.signatureUnlocked
                  ? <><Unlock size={13} style={{ verticalAlign: -2, color: 'var(--ok)' }} /> Déverrouillée — vous pouvez signer sans ressaisir votre passphrase (fenêtre de 15 minutes glissante)</>
                  : <><Lock size={13} style={{ verticalAlign: -2 }} /> Verrouillée — votre passphrase sera demandée à la prochaine signature</>}
              </dd>
            </dl>
            <p className="micro" style={{ marginTop: 8 }}>La fenêtre se réinitialise à chaque signature : utilisez-la régulièrement et elle reste ouverte ; laissez-la dormir 15 minutes et elle se referme.</p>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <h2 style={{ marginTop: 0 }}>Gérer</h2>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { setPassDlg(true); setErr(''); }}>Changer ma passphrase</button>
              <button className="btn btn-danger" onClick={() => { setOffDlg(true); setErr(''); }}>Désactiver ma signature</button>
            </p>
            <p className="micro" style={{ marginTop: 8 }}>Où signer ? Ouvrez un document attendant votre signature (Inbox → À faire → À signer, ou son workspace, onglet Processus) : le bouton « Signer électroniquement » y apparaît.</p>
          </div>
        </>
      )}

      <Dialog open={passDlg} title="Changer ma passphrase" onClose={() => setPassDlg(false)}
        footer={<><button className="btn" onClick={() => setPassDlg(false)}>Annuler</button><button className="btn btn-primary" onClick={changePass} disabled={busy || passForm.current.length < 6 || passForm.next.length < 6 || passForm.next !== passForm.next2}>Modifier</button></>}>
        <label className="lbl">Passphrase actuelle *</label>
        <input className="input" type="password" value={passForm.current} onChange={(e) => setPassForm({ ...passForm, current: e.target.value })} autoFocus />
        <label className="lbl">Nouvelle passphrase *</label>
        <input className="input" type="password" value={passForm.next} onChange={(e) => setPassForm({ ...passForm, next: e.target.value })} autoComplete="new-password" />
        <label className="lbl">Confirmez la nouvelle passphrase *</label>
        <input className="input" type="password" value={passForm.next2} onChange={(e) => setPassForm({ ...passForm, next2: e.target.value })} autoComplete="new-password" />
      </Dialog>
      <Dialog open={offDlg} title="Désactiver ma signature ?" onClose={() => setOffDlg(false)}
        footer={<><button className="btn" onClick={() => setOffDlg(false)}>Annuler</button><button className="btn btn-danger" onClick={deactivate} disabled={busy || offPass.length < 6}>Désactiver</button></>}>
        <p className="subtitle" style={{ marginBottom: 8 }}>Vous ne pourrez plus signer de documents tant que vous ne l'aurez pas réactivée. Les signatures déjà réalisées restent valables et prouvées.</p>
        <label className="lbl">Confirmez avec votre passphrase *</label>
        <input className="input" type="password" value={offPass} onChange={(e) => setOffPass(e.target.value)} autoFocus />
      </Dialog>
    </div>
  );
}
