# 04 - Builder dynamique + moteur de templates + identité/numérotation/versioning

**Source :** PRD §08-11, §21.

## Builder (form-driven)

L'utilisateur ne manipule **jamais la géométrie de page**. Le type définit :
nom, label, type, requis/optionnel, validation, source, défaut, condition de visibilité,
répétabilité, formatage, aide.

Types de champs : text, rich text, date, date range, number, currency, percentage,
address, person, organization, contact, project, service, line-item table,
checkbox, select, multi-select, attachment, calculated value, signature role.

Logique conditionnelle : ex. champs TVA si applicable, signataires ajoutés si sensible,
champs programme si certificat.

Capacités requises : autosave, validation, preview, récupération de brouillon, suivi des modifications.

## Moteur de templates

Templates = **assets système contrôlés**, pas des fichiers copiés.

Contenu : layout, composants réutilisables, liaisons de champs, conditions,
typographie, règles header/footer, règles de numérotation, blocs de signature,
règles de pages, config de sortie.

Blocs réutilisables : header DailyOps, bloc métadonnées, bloc adresse, bloc objet,
clauses standard, tableaux commerciaux, bloc signature légal, bloc certificat,
footer confidentialité, pied de page.

Versioning **indépendant** : template Proposition v1.3 peut générer `DO-BIZ-2026-0042` rév. 4.
Seule une version **approuvée** peut émettre. Version retirée = rendue pour historique,
non sélectionnable pour nouveau document.

## Numérotation / identité

Pattern : `DO-[FAMILLE]-[ANNÉE]-[SÉQUENCE]` ex. `DO-BIZ-2026-0043`.
Allocation **transactionnelle** (anti-collision en concurrence).
+ `UUID` interne (identifiant technique ; référence humaine = usage métier).

Métadonnées d'identité : type_code, titre, statut, owner, destinataire/client,
issue date, effective date, template version, confidentialité, état lifecycle.

## Versioning / révisions

Distinguer 4 concepts :
1. **Template Version** 2. **Document Revision** 3. **Generated Artifact** 4. **Signed/Issued Record**

- Brouillon révisable sans changer le n° document.
- PDF = artefact d'une révision donnée ; une fois émis = record faisant foi.
- Ex. `DO-BIZ-2026-0042 Rev.0 → Rev.1 → Rev.2 → approved → signed artifact → issued`.
- Changement post-signature = règles amendement/remplacement du type, jamais altération silencieuse.
- UI : timeline de révisions + diff entre révisions.

## Génération / sortie

- **PDF = format faisant foi.** DOCX = commodité éditable, ne remplace jamais silencieusement le PDF émis.
- Génération reproductible : `révision + template version + snapshot données` (conserver de quoi expliquer tout artefact).
- Pré-contrôles : champs requis, pagination, débordements, complétude signatures, numérotation, footer, intégrité fichier.
- Métadonnées du PDF final : n°, titre, émetteur, issue date, révision, identifiants applicatifs.
