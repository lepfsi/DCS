import assert from 'assert';
import { encryptAtRest, decryptAtRest, migrateSecretsAtRest, SECRETS_AT_REST } from '../src/secrets';

// Secrets au repos : AES-256-GCM. Même si data/db.json fuit (git, backup, disque),
// smtpPass et aiApiKey restent indéchiffrables sans DCS_SECRET.

function main() {
  const secret = 'P@ssw0rd-SMTP-2026!';
  const enc = encryptAtRest(secret);
  assert.ok(enc.startsWith('enc:v1:'), 'format chiffré explicite');
  assert.ok(!enc.includes(secret), 'le secret ne figure JAMAIS en clair dans la valeur stockée');
  assert.strictEqual(decryptAtRest(enc), secret, 'aller-retour : décryptage exact');
  // Non-secrets et valeurs vides : laissés tels quels.
  assert.strictEqual(decryptAtRest('valeur-normale'), 'valeur-normale');
  assert.strictEqual(decryptAtRest(587), 587);
  assert.strictEqual(decryptAtRest(''), '');
  // Altération : tag falsifié → rien ne fuit (chaîne vide, pas d'exception ni de contenu).
  const parts = enc.split(':');
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from('0000000000000000').toString('base64')}:${parts[4]}`;
  assert.strictEqual(decryptAtRest(tampered), '', 'valeur altérée → vide, aucun contenu révélé');
  // Migration : les secrets en clair deviennent chiffrés, une seule fois.
  const rows: Array<{ key: string; value: any }> = [
    { key: 'smtpPass', value: 'mon-mot-de-passe-ovh' },
    { key: 'aiApiKey', value: '' },
    { key: 'smtpHost', value: 'smtp.example.com' },
  ];
  const migrated = migrateSecretsAtRest(rows);
  assert.deepStrictEqual(migrated, ['smtpPass'], 'seule la valeur non vide en clair est migrée');
  assert.ok(String(rows[0].value).startsWith('enc:v1:'), 'smtpPass chiffré au repos');
  assert.strictEqual(rows[1].value, '', 'valeur vide non touchée');
  assert.strictEqual(rows[2].value, 'smtp.example.com', 'paramètre non secret intact');
  assert.deepStrictEqual(migrateSecretsAtRest(rows), [], 'idempotent : rien à re-migrer');
  // Registre des secrets connus.
  assert.ok(SECRETS_AT_REST.has('smtpPass') && SECRETS_AT_REST.has('aiApiKey'));

  console.log('test-secrets OK (chiffrement au repos AES-256-GCM, masque, migration)');
}
main();
