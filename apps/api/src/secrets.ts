import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Secrets au repos (sécurité) : jamais en clair dans data/db.json — même si le fichier
// fuit (backup, git, vol de disque), les secrets restent indéchiffrables.
// AES-256-GCM, clé dérivée de DCS_SECRET (env production ; repli dev explicitement non-secret).

export const SECRETS_AT_REST = new Set(['smtpPass', 'aiApiKey']);
export const SECRET_MASK = '********';

let atRestKey: Buffer | null = null;
function key(): Buffer {
  if (!atRestKey) atRestKey = scryptSync(process.env.DCS_SECRET ?? 'dcs-dev-at-rest-secret', 'dcs-secrets-v1', 32);
  return atRestKey;
}

export function encryptAtRest(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `enc:v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function decryptAtRest(v: any): any {
  if (typeof v !== 'string' || !v.startsWith('enc:v1:')) return v;
  try {
    const [, , ivB64, tagB64, dataB64] = v.split(':');
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    d.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');
  } catch { return ''; } // clé changée : rien ne fuit, l'admin ressaisit le secret
}

// Migration : les secrets historiquement stockés en clair sont chiffrés.
// Renvoie la liste des clés migrées (l'appelant persiste).
export function migrateSecretsAtRest(settings: Array<{ key: string; value: any }>): string[] {
  const migrated: string[] = [];
  for (const s of settings) {
    if (SECRETS_AT_REST.has(s.key) && typeof s.value === 'string' && s.value !== '' && !s.value.startsWith('enc:v1:')) {
      s.value = encryptAtRest(s.value);
      migrated.push(s.key);
    }
  }
  return migrated;
}
