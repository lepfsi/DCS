# Branding DCS — Formalisation des templates depuis Pictures (v1.0 brouillon)

> Objectif : documents présentables + auditables. Le branding ne décore pas : il pilote le rendu PDF faisant foi et l'aperçu web à l'identique.
> Source code : `apps/api/src/branding.ts` (profil), `apps/api/src/pdf.ts` (rendu), `apps/web/app/branding/page.tsx` (studio), `POST /api/v1/branding/analyze` (formalisation IA d'un modèle uploadé).

## 1. Ce qui existe déjà (ne pas réinventer)

- Profil unique entreprise `branding` : companyName, tagline, colors {primary, accent, text}, page.margin 24-90, header {showLogo, showCompany, align}, footer {left, right Page {page}/{pages}, showReference}, address.lines[6], datePosition {top-right|below-header|footer}, signatureBlock {show, labels[4]}.
- `DEFAULT_BRANDING` = DailyOps.Tech / #0e2a47 / #0e9f8a / marge 48 / footer « Document contrôlé ».
- Logo : jamais en JSON, uniquement `POST /branding/logo` (PNG/JPEG/WebP ≤2Mo) → `branding-logo.{png,jpg,webp}` en storage, `logoKey` interne, `hasLogo` public.
- Rendu PDF déterministe (CreationDate figée 2026-01-01, SHA-256, header + règle accent + titre + champs + signatures + footer paginé toutes pages). Test `test-branding.ts` : même entrée → même hash.
- Studio `/branding` : aperçu A4 live = mêmes règles que PDF. Proposition IA → `sanitizeProposal` + `mergeBranding` (patch partiel ne casse jamais) → décision humaine Appliquer/Ignorer.
- Audit : tout changement branding = `settings_changed` chaîné. PDF déjà émis = immuable (nouveau branding = prochains documents uniquement).

## 2. Méthode Pictures → Templates formalisés

### Étape A — Inventaire (à faire côté utilisateur, shell indisponible ici)
```powershell
cd C:\Users\Utilisateur\DailyOpsDocs
Get-ChildItem .\Pictures | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
# ou : dir Pictures
```
Coller le résultat ici. Pour chaque fichier préciser : type doc visé (lettre, proposition, facture, PV, NDA, attestation, reçu...) + usage (header officiel ? certificat ? commercial ?).

### Étape B — Extraction charte par modèle
Pour chaque image/modèle, relever (grille UI-14, cf `POST /branding/analyze`) :
1. Logo (position, taille, fond clair/foncé) → à téléverser via `/branding/logo`
2. Couleurs : primaire (titres/header), accent (filet/soulignés), texte → hex `#RRGGBB`
3. En-tête : société affichée ? alignement left/center/right ? adresse ? référence à droite ?
4. Date : top-right / below-header / footer ?
5. Titre : casse, taille, sous-ligne type/rév/modèle ?
6. Corps : champs/blocs (adresse, objet, tableau commercial, clauses, montants XAF, TVA ?)
7. Signatures : combien de colonnes, quels libellés ?
8. Pied : mention légale / confidentialité ? pagination `Page {page}/{pages}` ? référence rappelée ?

### Étape C — Mapping DCS (présentable + auditable)
- **1 seul profil branding actif** (identité entreprise) + **N TemplateVersions** (structure par type).
  - Branding = commun à tous (logo, couleurs, header/footer, signatures par défaut).
  - TemplateVersion.definition = `{ blocks, required, fields[] }` par `type_code` (ex. DO-OFF-LETTER, DO-BIZ-PROPOSAL...). Cf `templates/catalogue.json` (52 types) + `docs/04-builder-moteur-templates.md`.
  - Ne jamais copier la géométrie page à la main : le Builder génère depuis `fields` (key, label, type text|textarea|number|currency|date, required).
- Règles d'audit :
  - Template brouillon → `approved` (publish) seul autorisé à émettre ; `retired` = historique non sélectionnable.
  - Versioning indépendant : Template vX.Y ≠ Document rév. N ≠ Artefact SHA-256.
  - Tout PDF = pré-contrôles (requis, pagination, signatures, footer, numérotation) + SHA-256 + event `generated`.

## 3. Fiche modèle à remplir (une par fichier Pictures)

```yaml
fichier: Pictures/<nom exact>
type_code_cible: DO-XXX-YYYY  # ex. DO-BIZ-INVOICE
usage: [officiel|commercial|legal|certificat|rh|finance]
logo: { présent: oui/non, position: haut-gauche, à_téléverser: oui }
couleurs: { primary: "#??????", accent: "#??????", text: "#232a33" }
header: { showCompany: true, align: left, adresse: "..." }
datePosition: top-right
blocs: [header, metadata, address, subject, body, commercial_table, signature]
champs_requis: [client, scope, fees]
signatures: ["Pour DailyOps.Tech", "Le client"]
footer: { left: "DailyOps.Tech — Document contrôlé", right: "Page {page}/{pages}", showReference: true }
notes_auditable: "..."
```

## 4. Prochaines actions dès réception liste

1. Je propose `branding` final (JSON fusionné, validé `brandingSchema`) + logo à uploader.
2. Je génère `definitions` par type (fields + required + blocks) prêtes pour `POST /templates` puis publish.
3. Je mets à jour `BrandPreview` + test `test-branding.ts` avec votre palette et je régénère un PDF témoin (hash vérifié).
4. Checklist lancement : `project/LAUNCH-CHECKLIST.md` + DoD v1 (créer → émettre → retrouver → timeline audit).

## 5. En attente utilisateur

- [ ] Coller `dir Pictures` (noms + extensions)
- [ ] Désigner 1 modèle pilote (ex. facture ou lettre) pour attaquer en premier
- [ ] Confirmer nom société / slogan / adresse à faire figurer (défaut : DailyOps.Tech / Douala, Cameroun)
