import assert from 'assert';
import { DEFAULT_BRANDING, mergeBranding, sanitizeProposal, extractJson, brandingSchema } from '../src/branding';
import { generatePdfBuffer } from '../src/pdf';

// Branding documentaire (UI-14) : le profil de marque pilote le rendu PDF.
// 1. fusion contrôlée : un patch partiel (admin ou IA) ne casse jamais le profil ;
// 2. extraction JSON robuste des réponses IA ;
// 3. le PDF généré embarque l'identité (nom société, couleurs, pied de page paginé).

async function main() {
  // Les défauts sont toujours conformes au schéma.
  const check = brandingSchema.safeParse(DEFAULT_BRANDING);
  assert.ok(check.success, 'les défauts de branding doivent être valides');

  // Fusion : seules les clés fournies changent, le logoKey n'est jamais écrasé par JSON.
  const current = { ...DEFAULT_BRANDING, logoKey: 'branding-logo.png' };
  const merged = mergeBranding(current, { companyName: 'Acme SARL', colors: { primary: '#112233' }, page: { margin: 999 }, header: { align: 'bogus' } });
  assert.strictEqual(merged.companyName, 'Acme SARL');
  assert.strictEqual(merged.colors.primary, '#112233');
  assert.strictEqual(merged.colors.accent, DEFAULT_BRANDING.colors.accent, 'les couleurs absentes sont conservées');
  assert.strictEqual(merged.page.margin, 90, 'marge bornée au maximum');
  assert.strictEqual(merged.header.align, 'left', 'alignement invalide → valeur actuelle');
  assert.strictEqual(merged.logoKey, 'branding-logo.png', 'logoKey préservé : seul l\'upload le change');
  assert.strictEqual(mergeBranding(current, null).companyName, 'DailyOps.Tech', 'patch nul = profil inchangé');

  // Extraction IA : blocs ```json, préambules, JSON nu.
  const fenced = extractJson('Voici mon analyse :\n```json\n{"companyName":"X","datePosition":"footer"}\n```');
  assert.strictEqual(fenced.companyName, 'X');
  assert.strictEqual(extractJson('aucun json ici...'), null);

  // Proposition IA partielle → formalisée avec les défauts, jamais de profil cassé.
  const proposal = sanitizeProposal({ companyName: 'Nouvelle Société', colors: { primary: '#00AA88' }, signatureBlock: { labels: ['Direction', 'Client'] } });
  assert.ok(proposal, 'proposition formalisée');
  assert.strictEqual(proposal!.companyName, 'Nouvelle Société');
  assert.strictEqual(proposal!.colors.primary, '#00AA88');
  assert.strictEqual(proposal!.datePosition, DEFAULT_BRANDING.datePosition, 'clé absente → défaut');
  assert.strictEqual(proposal!.signatureBlock.labels.length, 2);

  // Rendu : le PDF produit un buffer avec SHA-256, déterministe pour la même entrée.
  const opts = { reference: 'DO-BIZ-2026-0001', title: 'Proposition Test', typeCode: 'DO-BIZ-PROPOSAL', templateVersion: '1.0', fields: { client: 'Acme', scope: 'Audit' }, revision: 0, docDate: '3 octobre 2026' };
  const a = await generatePdfBuffer(opts, DEFAULT_BRANDING, null);
  const b = await generatePdfBuffer(opts, DEFAULT_BRANDING, null);
  assert.ok(a.buffer.length > 1000, 'PDF substantiel');
  assert.strictEqual(a.sha256, b.sha256, 'rendu déterministe à profil identique');
  assert.match(a.sha256, /^[0-9a-f]{64}$/);
  // Le nom de l'entreprise figure dans le PDF (métadonnées Author).
  assert.ok(a.buffer.includes(Buffer.from(DEFAULT_BRANDING.companyName, 'latin1')) || a.buffer.includes(Buffer.from('DailyOps', 'utf8')), 'identité présente dans le PDF');

  console.log('test-branding OK (fusion contrôlée, extraction IA, rendu PDF déterministe)');
}
main();
