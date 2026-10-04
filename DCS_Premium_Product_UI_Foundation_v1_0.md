# DailyOps Document Control System
## Premium Product & Operational UI Foundation v1.0

**Statut :** spécification de référence pour la refonte fonctionnelle, UX et UI
**Périmètre :** création, templates, workflow, validation, signature, émission, PDF, impression, preuve, Inbox, Records, administration
**Priorité :** fondation opérationnelle avant branding documentaire

---

## 0. Décision centrale

Le DCS possède déjà un moteur substantiel : domaines documentaires, templates, schémas dynamiques, workflow, Inbox, révisions, relations documentaires, contexte métier, audit, artefacts PDF et certificats. Le dépôt confirme que ces capacités existent déjà ; le problème principal est désormais l’abstraction de l’expérience utilisateur, pas l’absence du moteur.

La création actuelle expose encore trop directement la mécanique interne : sélection de type technique, schema, champs techniques, JSON de preview, transitions et `prompt()` navigateur. Le workspace affiche également révisions, diff, relations, workflow, artefacts, preuve et audit comme des blocs techniques juxtaposés. La refonte doit donc conserver le moteur et reconstruire la couche humaine au-dessus.

> **L’utilisateur travaille avec le document. DCS travaille avec la complexité.**

---

# 1. Principe produit

DCS doit être perçu comme un **atelier documentaire intelligent**, pas comme un moteur de templates.

Le principe devient :

> **L’utilisateur décrit ce qu’il veut faire. Le système sait comment le faire.**

L’utilisateur final ne doit jamais avoir besoin de connaître :

- JSON
- schema
- `type_code`
- `workflow_key`
- clés de champs
- endpoints
- transitions techniques
- UUID
- hashes
- artefacts
- états machine

Ces éléments restent dans le moteur, l’API ou l’administration avancée.

---

# 2. Expérience cible

Un utilisateur doit pouvoir dire :

> « Je veux créer une proposition pour Acme concernant la migration réseau. »

Le produit doit alors guider :

```text
Choisir le document
        ↓
Choisir le contexte
        ↓
Remplir le formulaire
        ↓
Vérifier
        ↓
Prévisualiser
        ↓
Créer le brouillon
        ↓
Soumettre en revue
        ↓
Revoir
        ↓
Approuver
        ↓
Signer
        ↓
Générer
        ↓
Émettre
        ↓
Télécharger / Imprimer / Transmettre
        ↓
Archiver / Prouver
```

Le workflow interne reste plus riche, mais son expression UI doit être simple.

---

# 3. Deux couches à séparer

## 3.1 Couche utilisateur

Elle parle de :

- Proposition
- Contrat
- Facture
- Rapport
- Lettre
- Attestation
- Certificat
- Client
- Projet
- Validation
- Signature
- Version
- Aperçu
- PDF
- Impression
- Historique

## 3.2 Couche système

Elle gère :

- document types
- schemas
- fields
- workflow definitions
- transition guards
- RBAC / SoD
- revisions
- template versions
- audit events
- document links
- artifact hashes
- API
- persistence
- retention

### Règle

> **La couche système ne doit pas contaminer la couche utilisateur.**

---

# 4. Nouveau modèle de création

## Étape 1 — Que voulez-vous créer ?

Présenter des catégories compréhensibles :

```text
Commercial
  Proposition
  Devis
  Facture
  Rapport

Juridique
  Contrat
  NDA
  Avenant

Officiel
  Lettre
  Note
  Procès-verbal

RH
  Attestation
  Contrat
  Notification

Certificats
  Formation
  Participation
  Contribution
```

Les familles techniques restent internes.

## Étape 2 — Quel document ?

Chaque type doit afficher :

- nom humain
- description
- usage
- informations demandées
- processus de validation éventuel

Exemple :

```text
Proposition commerciale
Présenter une offre à un client.

[ Utiliser ce modèle ]
```

## Étape 3 — Contexte

```text
Client
[ Rechercher ou sélectionner ]

Projet
[ Rechercher ou sélectionner ]

Prestation(s)
[ Ajouter ]

Responsable
[ automatiquement sélectionné ]
```

Les informations connues sont pré-remplies.

## Étape 4 — Remplir

Le template génère automatiquement le formulaire. L’utilisateur ne voit jamais le schema.

## Étape 5 — Vérifier

```text
Vérification
✓ Client identifié
✓ Objet renseigné
✓ Prestations renseignées
✓ Montants cohérents
✓ Validité renseignée

Aucune anomalie détectée.

[ Voir l’aperçu ] [ Modifier ] [ Créer le brouillon ]
```

## Étape 6 — Brouillon

Le système attribue automatiquement :

- référence
- révision
- owner
- état
- contexte métier
- template utilisé
- date

---

# 5. Le formulaire est l’interface du template

Le template ne doit plus être perçu comme un objet technique. Il définit une expérience de saisie.

Un champ peut définir :

- libellé humain
- aide
- type
- obligatoire/facultatif
- valeur par défaut
- source de données
- format
- validation
- visibilité
- ordre
- section
- dépendance
- calcul

Exemple :

```text
Montant HT      → saisie
TVA             → configuration / calcul
Total TTC       → calcul automatique
```

## Champs intelligents

Le système doit pouvoir proposer :

- Texte
- Texte long
- Nombre
- Montant
- Date
- Liste
- Personne
- Client
- Projet
- Adresse
- Tableau
- Pièce jointe
- Champ calculé

Le gestionnaire ne renseigne plus une clé technique ; il construit un formulaire.

---

# 6. Pré-remplissage et calcul

Le DCS doit exploiter son Business Data Layer.

Si le client est sélectionné :

```text
Acme Corporation
Yaoundé
Contact : Jean Dupont
Email : ...
Téléphone : ...
```

Ces informations sont injectées automatiquement dans le document lorsque le template le permet.

Pour les documents financiers/commerciaux, les calculs doivent être automatiques :

```text
Prestation             Qté       PU        Total
Audit infrastructure    1      350 000     350 000
Durcissement réseau     2      180 000     360 000
Documentation           1      120 000     120 000
---------------------------------------------------
Sous-total                                  830 000
TVA                                         149 400
---------------------------------------------------
Total TTC                                   979 400
```

---

# 7. Validation inline

Les erreurs doivent être compréhensibles et localisées.

Mauvais :

```text
Validation failed
```

Cible :

```text
Date de validité
Cette date doit être postérieure à la date du document.
```

Chaque formulaire doit gérer :

- valeur manquante
- format incorrect
- incohérence métier
- dépendance non satisfaite
- valeur hors plage
- doublon pertinent

---

# 8. Autosave

Le moteur possède déjà un autosave débouncé. L’UI doit le rendre rassurant :

```text
Enregistrement…
```

puis :

```text
Enregistré il y a quelques secondes
```

États UI :

- Enregistrement…
- Enregistré
- Modification locale
- Erreur d’enregistrement
- Hors connexion

Jamais de vocabulaire HTTP/API.

---

# 9. Document Workspace : cœur du produit

Le workspace actuel rassemble trop de mécanique dans une même surface. Il doit devenir le **Document Control Workspace**.

Structure cible :

```text
← Documents

Proposition Acme                         Brouillon · Rév. 3
DO-BIZ-2026-0042

[ Modifier ] [ Prévisualiser ] [ Soumettre ] [ ••• ]

────────────────────────────────────────────────────────

INFORMATIONS
Client       Acme Corporation
Projet       Migration réseau
Responsable  Steve

────────────────────────────────────────────────────────

CONTENU                         APERÇU
Objet                           ┌───────────────┐
[.........................]     │               │
                                │ rendu A4      │
Validité                        │ du document   │
[.........................]     │               │
                                └───────────────┘

────────────────────────────────────────────────────────

PROCESSUS
✓ Brouillon → ✓ Revue → ○ Approbation → ○ Signature → ○ Émission

────────────────────────────────────────────────────────

Documents associés | Historique | Preuve
```

### Onglets principaux

1. Contenu
2. Aperçu
3. Processus
4. Documents associés
5. Historique
6. Preuve

Tout ne doit pas être visible simultanément.

---

# 10. Le JSON doit disparaître

Le JSON ne doit plus apparaître dans l’expérience standard :

- Preview
- Document Workspace
- Review
- Approval
- Create

Il peut rester disponible uniquement en administration/diagnostic, sous un mode avancé.

Le preview standard doit être un **vrai document rendu**, idéalement A4.

---

# 11. Branding documentaire : explicitement reporté

La priorité actuelle n’est pas de produire un système graphique sophistiqué.

Pas maintenant :

- thèmes multiples
- branding complexe
- éditeur type Canva
- effets graphiques
- variations marketing
- couvertures sophistiquées

La fondation doit d’abord garantir :

- contenu exact
- formulaires fiables
- workflow fiable
- validation
- versioning
- génération
- PDF
- impression
- archivage
- preuve

> **Document correctness before document branding.**

Le branding deviendra une couche de rendu au-dessus d’une fondation déjà stable.

---

# 12. Template Control Center

Le gestionnaire doit pouvoir préparer un modèle sans coder.

## Informations générales

```text
Nom
[ Proposition commerciale ]

Description
[ Document utilisé pour présenter une offre ]

Type
[ Proposition commerciale ]
```

## Construction du formulaire

```text
Informations client
  ☰ Nom du client
  ☰ Adresse
  ☰ Contact

Informations commerciales
  ☰ Objet
  ☰ Validité
  ☰ Conditions

Prestations
  ☰ Ligne de prestation
  ☰ Quantité
  ☰ Prix unitaire
  ☰ Total
```

### Ajouter un champ

```text
Que voulez-vous demander ?

○ Texte
○ Texte long
○ Nombre
○ Montant
○ Date
○ Liste
○ Personne
○ Client
○ Projet
○ Tableau
○ Pièce jointe
○ Champ calculé
```

Le système génère la structure technique automatiquement.

---

# 13. Trois niveaux de configuration

## Niveau 1 — Simple

- nom
- type
- obligatoire
- aide
- ordre

## Niveau 2 — Avancé

- valeur par défaut
- source de données
- condition d’affichage
- validation
- calcul

## Niveau 3 — Technique

Réservé aux administrateurs :

- schema brut
- definition
- metadata
- workflow binding

La majorité des utilisateurs ne doit jamais atteindre le niveau 3.

---

# 14. Publication des templates

Cycle :

```text
Brouillon
   ↓
Test
   ↓
Validation
   ↓
Publié
   ↓
Retiré
```

Une version publiée ne doit pas être modifiée silencieusement. Toute modification structurelle produit une nouvelle version.

## Test de template

```text
Créer un document d'essai

✓ Tous les champs s'affichent
✓ Les champs obligatoires fonctionnent
✓ Les calculs sont corrects
✓ Le rendu est stable
✓ Le PDF est générable

[ Publier le modèle ]
```

---

# 15. Review Workspace

Le reviewer ne doit pas refaire le travail du créateur. Il doit examiner et décider.

```text
REVUE DU DOCUMENT
Proposition Acme · Rév. 3

DOCUMENT                         CONTRÔLES
┌─────────────────────┐          □ Contenu correct
│                     │          □ Périmètre correct
│ aperçu réel         │          □ Montants vérifiés
│                     │          □ Informations client
└─────────────────────┘

Commentaires
[................................................]

[ Demander des modifications ] [ Valider la revue ]
```

### Demande de modification

Remplacer le prompt navigateur par un vrai dialogue :

```text
Demander des modifications

Motif
[ Le montant doit être corrigé. ]

Section concernée
[ Prestations ▼ ]

Priorité
○ Normale  ○ Importante

[ Annuler ] [ Envoyer ]
```

---

# 16. Approval Workspace

L’approbateur doit voir :

1. le document
2. la version
3. la revue effectuée
4. les points contrôlés
5. le contexte de décision
6. la décision attendue

```text
APPROBATION

Proposition Acme
Révision 3

Revue terminée par Jean Dupont

✓ Contenu
✓ Périmètre
✓ Montants

Commentaire
[................................]

[ Approuver ] [ Rejeter ]
```

L’approbation doit rester distincte de la revue.

---

# 17. Signature

La signature doit être extrêmement simple :

```text
SIGNATURE REQUISE

Proposition Acme
Révision 3

Vous êtes attendu comme : Directeur

✓ Document approuvé
✓ Version préparée
✓ Aucun changement depuis l’approbation

[ Consulter le document ]
[ Signer le document ]
```

Si plusieurs signataires existent, afficher clairement l’ordre et ce qui est déjà réalisé.

---

# 18. Génération et émission

Avant génération :

```text
DOCUMENT PRÊT À ÊTRE ÉMIS

✓ Informations complètes
✓ Revue terminée
✓ Approbation obtenue
✓ Signatures obtenues

[ Générer le document final ]
```

Après émission :

```text
DOCUMENT ÉMIS

DO-BIZ-2026-0042
Proposition Acme
Révision 4
Émis le 02 octobre 2026

[ Télécharger le PDF officiel ]
[ Imprimer ]
[ Partager ]
[ Voir la preuve ]
```

L’artefact final devient immuable. Une correction produit une nouvelle révision ou un nouveau document selon la politique du type.

---

# 19. Impression

L’impression doit être une fonction de premier ordre.

```text
Imprimer le document

Format       [ A4 ]
Orientation  [ Portrait ]
Copies       [ 1 ]
Pages        ○ Toutes ○ Sélection

[ Annuler ] [ Imprimer ]
```

Pour un document émis, l’impression doit utiliser le même artefact officiel que le PDF faisant foi. Il ne faut pas générer une autre version documentaire au moment de l’impression.

---

# 20. Workflow : traduction humaine

Le moteur peut conserver :

```text
draft
in_review
changes_requested
approved
ready_to_sign
signed
issued
archived
```

Mais l’interface affiche :

```text
Brouillon
   ↓
En revue
   ↓
Approuvé
   ↓
À signer
   ↓
Signé
   ↓
Émis
```

### Séparer toujours

**État du document** : `Approuvé`

**Action attendue** : `Votre signature est requise`

Cette distinction doit être présente dans Overview, Inbox et Workspace.

---

# 21. Inbox : centre de travail

L’Inbox doit répondre à :

> **Qu’est-ce que je dois faire maintenant ?**

Files :

```text
À faire
  Mes brouillons
  À revoir
  À approuver
  À signer
  Modifications demandées

À surveiller
  Échéances proches
  Expirants
  Exceptions

Terminé
  Récemment émis
  Archivés
```

Chaque élément doit afficher :

- document
- état
- action attendue
- échéance
- owner
- contexte
- raison de la tâche
- action principale

Exemple :

```text
Proposition Acme                         À revoir
DO-BIZ-2026-0042 · Rév. 3
Client Acme · échéance aujourd’hui
Le montant et le périmètre doivent être vérifiés.

[ Ouvrir la revue ]
```

---

# 22. Documents : registre global

La table doit privilégier le contexte opérationnel :

| Colonne | Finalité |
|---|---|
| Référence | identification |
| Document | titre |
| Type | type humain |
| Client / destinataire | contexte |
| Projet | contexte |
| Responsable | owner |
| État | lifecycle |
| Action | action attendue |
| Révision | version |
| Échéance | date |
| Dernière activité | fraîcheur |

Recherche par : référence, titre, contenu, client, projet, owner, type, état, date, numéro et relations.

---

# 23. Records = Business Context Layer

Les Records ne doivent pas devenir un CRM.

Ils donnent le contexte documentaire.

## Client

```text
Acme Corporation

Informations
Contacts
Projets
Documents
Transactions
Historique
```

## Projet

```text
Migration réseau 2026

Client : Acme Corporation

Documents
Proposal
SOW
Contract
Reports
Invoices

Services
...

Timeline
...
```

Le document reste l’objet central.

---

# 24. Relations documentaires

Ne pas montrer les types techniques par défaut :

```text
relates_to
invoices
derives_from
evidences
supersedes
```

Afficher plutôt :

```text
Documents associés

Proposition
   ↓
Contrat de service
   ↓
Projet
   ↓
Rapport d’intervention
   ↓
Facture
   ↓
Preuve de paiement
```

Les codes techniques peuvent rester dans les détails avancés.

---

# 25. Versioning et diff

L’utilisateur voit :

```text
Révision 4 — Version actuelle
Révision 3 — Modifications demandées
Révision 2 — Approuvée
Révision 1 — Brouillon initial
```

Le diff doit être humain :

```text
Modification de la proposition

Montant
Avant : 500 000 FCFA
Après : 650 000 FCFA

Modifié par : Jean Dupont
Révision : 4
Motif : Mise à jour du périmètre
```

Jamais un JSON brut dans l’expérience standard.

---

# 26. Audit et preuve

## Historique humain

```text
02 oct. 14:32
Jean Dupont — a modifié le montant

02 oct. 15:04
Jean Dupont — a soumis le document en revue

02 oct. 15:21
Marie Martin — a validé la revue

02 oct. 16:10
Direction — a approuvé le document
```

## Dossier de preuve

```text
Identité
✓ Référence unique

Version
✓ Révision 4

Workflow
✓ Revue enregistrée
✓ Approbation enregistrée
✓ Signature enregistrée

Document final
✓ PDF disponible
✓ Fichier vérifié

Historique
✓ Audit complet

Intégrité
✓ Vérification réussie
```

SHA-256, UUID et détails techniques restent disponibles en mode avancé.

---

# 27. Erreurs et confirmations

Supprimer progressivement :

- `prompt()`
- `alert()`
- `confirm()`

Les remplacer par dialogs, drawers, formulaires inline et confirmations contextualisées.

### Exemple de rejet

```text
Rejeter le document ?

Cette décision empêchera son émission.

Motif
[................................]

[ Annuler ] [ Rejeter ]
```

### Exemple d’émission

```text
Émettre ce document ?

Après émission, cette version deviendra définitive.

[ Annuler ] [ Émettre ]
```

---

# 28. Navigation cible

```text
ACCUEIL
Inbox
Documents

CONTEXTE
Clients
Projets
Services
Transactions

RESSOURCES
Templates

ADMINISTRATION
Types de documents
Workflows
Utilisateurs & rôles
Numérotation
Conservation
Activité système
```

La navigation doit rester courte ; les détails apparaissent dans leur contexte.

---

# 29. Overview

L’Overview doit répondre en moins de cinq secondes :

- qu’est-ce qui m’attend ?
- qu’est-ce qui est en retard ?
- qu’est-ce qui vient d’être modifié ?
- qu’est-ce qui requiert mon attention ?

Éviter les KPI décoratifs massifs.

Structure :

```text
Bonjour Steve

Voici ce qui requiert votre attention.

À faire
04 À revoir
02 À approuver
01 À signer

À surveiller
03 Échéances proches
01 Exception

────────────────────────
Votre activité
...

Documents récents
...
```

---

# 30. Design system premium

Le premium doit venir de :

- typographie
- whitespace
- alignement
- densité maîtrisée
- hiérarchie
- précision
- bordures discrètes
- profondeur légère

Pas de :

- rainbow cards
- gradients systématiques
- gros KPI décoratifs
- grille de boîtes identiques partout
- décoration sans fonction

### Couleur

- Navy : structure / identité
- Turquoise : action principale
- Gris : neutre
- Rouge : erreur / blocage
- Orange : attention
- Vert : validation

La couleur doit être sémantique.

---

# 31. Bibliothèque de composants

## UI

- Sidebar
- Topbar
- Breadcrumb
- CommandPalette
- Button
- Input
- Select
- Dialog
- Drawer
- Toast
- EmptyState
- ErrorState
- LoadingState
- ConfirmDialog

## Documents

- DocumentHeader
- DocumentStatus
- DocumentMeta
- ActionBar
- DocumentForm
- DocumentPreview
- WorkflowStepper
- RevisionList
- DocumentTimeline
- DocumentRelations
- DocumentEvidence

## Workflow

- ReviewChecklist
- ReviewDecision
- ApprovalDecision
- SignaturePanel
- ActionPanel

## Formulaires

- Field
- CurrencyField
- DateField
- EntitySearch
- EntitySelect
- Repeater
- LineItems
- ConditionalSection
- ValidationMessage

---

# 32. États UI obligatoires

Chaque écran doit gérer explicitement :

- loading
- loaded
- empty
- error
- unauthorized
- read-only
- saving
- saved
- dirty
- blocked
- processing
- success

Aucun message API brut ne doit remonter directement dans l’interface finale.

---

# 33. Permissions

Une permission ne doit pas simplement faire disparaître une action critique.

Exemple :

```text
Vous pouvez consulter ce document.

L’approbation est réservée au responsable désigné.

[ Voir le processus ]
```

L’utilisateur comprend :

- ce qu’il peut faire ;
- ce qu’il ne peut pas faire ;
- pourquoi ;
- qui doit agir si pertinent.

---

# 34. Documents émis = lecture seule intelligente

Un document émis doit afficher :

```text
Document émis

Cette version est définitive.
Les modifications créent une nouvelle révision ou un nouveau document selon la politique du type.
```

Actions disponibles :

- télécharger
- imprimer
- partager
- voir preuve
- voir historique
- créer à partir de ce document si autorisé

---

# 35. Création dérivée

La fonction technique `derive` doit devenir :

> **Créer à partir de ce document**

Exemple :

```text
Créer à partir de la proposition

○ Contrat de service
○ Facture
○ Rapport
```

Le système récupère automatiquement les données compatibles.

---

# 36. Chaîne documentaire

La continuité doit être naturelle :

```text
PROPOSITION
    ↓
CONTRAT
    ↓
PROJET
    ↓
RAPPORT
    ↓
FACTURE
    ↓
PREUVE
```

Chaque document doit pouvoir réutiliser le contexte déjà connu.

---

# 37. Finance et HR restent bornés

Finance reste documentaire : pro forma, facture, avoir, reçu, relance, paiement documentaire.

Pas de :

- grand livre
- trésorerie
- consolidation
- banque

HR reste documentaire : contrats, attestations, notifications, certificats et documents RH.

Pas de SIRH complet.

---

# 38. Administration = lieu de complexité

L’administration est le seul espace où l’on assume la richesse technique.

## Types de documents

- nom
- domaine
- champs
- template
- workflow
- règles
- permissions

## Templates

- structure
- champs
- versions
- publication

## Workflows

- étapes
- acteurs
- conditions
- SoD
- notifications

## Numérotation

- famille
- année
- séquence
- format

## Conservation

- durée
- archivage
- expiration
- politique de suppression

## Activité système

Vue technique réservée aux administrateurs.

---

# 39. Couche frontend recommandée

Le frontend doit séparer pages, composants et traduction des données API.

```text
apps/web/
  components/
    ui/
    documents/
    workflow/
    forms/
    records/
    templates/

  lib/
    document-ui/
    workflow-ui/
    permissions/
    formatting/

  app/
    inbox/
    documents/
    records/
    templates/
    admin/
```

L’API reste orientée machine ; une couche UI traduit les données.

Exemple :

```text
API:
state = "changes_requested"

UI:
label = "Modifications demandées"
tone = "warning"
action = "Modifier le document"
```

Même principe pour workflow, permissions, relations, audit et artefacts.

---

# 40. Ne pas réécrire le moteur

La refonte UI doit préserver les capacités déjà construites :

- autosave
- révisions
- workflow
- signatures
- audit
- artefacts
- relations
- contexte métier
- certificats

Le frontend devient un **adaptateur humain** au-dessus du moteur existant.

---

# 41. Happy path prioritaire

Le premier parcours à rendre parfait est :

```text
Créer une proposition
↓
Choisir client
↓
Choisir projet
↓
Remplir formulaire
↓
Prévisualiser
↓
Enregistrer
↓
Soumettre
↓
Revue
↓
Approbation
↓
Signature
↓
PDF
↓
Émission
↓
Téléchargement
↓
Impression
↓
Preuve
```

Ce parcours doit être réalisable sans jamais voir :

- JSON
- schema
- code
- état technique
- prompt navigateur
- identifiant interne

---

# 42. Critères d’acceptation — création

- [ ] l’utilisateur comprend immédiatement quoi créer
- [ ] les types sont nommés en langage métier
- [ ] les données connues sont pré-remplies
- [ ] le formulaire est dynamique
- [ ] aucune connaissance technique n’est nécessaire
- [ ] les erreurs sont localisées et expliquées
- [ ] l’autosave est visible
- [ ] l’aperçu est un vrai document
- [ ] le brouillon est créé automatiquement avec référence et version

# 43. Critères — workflow

- [ ] le reviewer voit le document réel
- [ ] il voit uniquement les contrôles nécessaires
- [ ] il peut demander des modifications précises
- [ ] l’approbateur comprend ce qu’il engage
- [ ] le signataire comprend pourquoi il signe
- [ ] les actions sont contextualisées
- [ ] les refus demandent un motif lorsque nécessaire

# 44. Critères — émission

- [ ] toutes les validations nécessaires sont terminées
- [ ] le PDF officiel est généré
- [ ] la version émise est immuable
- [ ] le téléchargement fonctionne
- [ ] l’impression utilise l’artefact officiel
- [ ] l’historique est traçable
- [ ] la preuve est vérifiable

---

# 45. Tests UX à imposer

## Test 1 — utilisateur non technique

Créer une proposition sans explication technique.

## Test 2 — commercial

Créer une proposition sans connaître les templates.

## Test 3 — reviewer

Comprendre son action en moins de 10 secondes.

## Test 4 — approbateur

Comprendre ce qu’il approuve sans ouvrir Administration.

## Test 5 — signataire

Identifier précisément le document et la version signée.

## Test 6 — impression

Obtenir une copie papier du document officiel sans connaître les artefacts.

## Test 7 — administrateur

Accéder à la complexité complète lorsqu’elle est nécessaire.

---

# 46. Matrice utilisateur / moteur

| Sujet | L’utilisateur voit | Le moteur gère |
|---|---|---|
| Type | Proposition commerciale | `type_code` |
| Formulaire | Champs métier | schema |
| Workflow | Revue → Approbation → Signature | state machine |
| Statut | Approuvé | `approved` |
| Action | Votre signature est requise | transition guard |
| Version | Révision 4 | revision ID |
| PDF | Document officiel | artifact |
| Preuve | Dossier de preuve | hash + audit |
| Relation | Contrat associé | document_links |
| Client | Acme | customerId |
| Projet | Migration réseau | projectId |
| Template | Modèle de proposition | template version |
| Erreur | Revue incomplète | transition guard |
| Permission | Approbation réservée | RBAC / SoD |

---

# 47. Ce qui doit disparaître de l’UI standard

- [ ] JSON preview
- [ ] clés techniques de champs
- [ ] `type_code`
- [ ] `workflow_key`
- [ ] endpoints
- [ ] types de relations techniques
- [ ] SHA brut
- [ ] UUID
- [ ] `prompt()`
- [ ] `alert()`
- [ ] `confirm()`
- [ ] `Generate final PDF`
- [ ] `Save draft` lorsqu’un libellé métier est possible
- [ ] états machine bruts

# 48. Ce qui doit apparaître

- Créer un document
- Continuer
- Enregistrer
- Enregistré
- Prévisualiser
- Modifier
- Soumettre en revue
- Demander des modifications
- Valider la revue
- Approuver
- Rejeter
- Signer
- Émettre
- Télécharger le PDF officiel
- Imprimer
- Créer à partir de ce document
- Voir les documents associés
- Voir l’historique
- Voir la preuve

---

# 49. Plan d’implémentation

## UI-01 — Design Foundation

Tokens, typographie, spacing, surfaces, boutons, inputs, tables, badges, dialogs, drawers, alertes, états vides et états de chargement.

## UI-02 — Application Shell

Sidebar, topbar, breadcrumb, recherche, command palette, responsive.

## UI-03 — Create Document

Refonte complète du parcours guidé.

## UI-04 — Document Workspace

Priorité maximale : contenu + aperçu + actions + processus + historique + preuve.

## UI-05 — Review

Surface de revue centrée sur le document réel.

## UI-06 — Approval

Surface de décision.

## UI-07 — Signature

Surface de signature.

## UI-08 — Issuance / PDF / Print

Finalisation, téléchargement et impression.

## UI-09 — Inbox

Centre de travail personnel.

## UI-10 — Documents

Registre global.

## UI-11 — Records

Business Context Layer.

## UI-12 — Templates

Template Control Center.

## UI-13 — Administration

Complexité technique spécialisée.

## UI-14 — Branding documentaire

Seulement après stabilisation de toute la fondation.

---

# 50. Ordre de développement recommandé

```text
1. Design system
2. Shell
3. Create
4. Document Workspace
5. Review
6. Approval
7. Signature
8. Issue / PDF / Print
9. Inbox
10. Documents
11. Records
12. Templates
13. Administration
14. Branding documentaire
```

Ne pas commencer par les animations, les thèmes ou le branding. Le produit doit d’abord prouver que son flux documentaire est humainement fluide.

---

# 51. Definition of Done — Premium Foundation

La fondation est considérée comme solide lorsque :

```text
Un utilisateur non technique
        ↓
choisit un type de document
        ↓
sélectionne son contexte
        ↓
remplit un formulaire
        ↓
obtient un aperçu réel
        ↓
enregistre un brouillon
        ↓
soumet en revue
        ↓
un reviewer valide
        ↓
un approbateur décide
        ↓
un signataire signe
        ↓
le système génère le PDF
        ↓
le document est émis
        ↓
l’utilisateur télécharge
        ↓
l’utilisateur imprime
        ↓
le système conserve la preuve
```

Sans aucune connaissance technique du DCS.

---

# 52. Hors priorité

Pour ne pas diluer le projet :

- branding documentaire avancé
- thèmes multiples
- éditeur graphique type Canva
- marketplace de templates
- personnalisation esthétique poussée
- animations complexes
- analytics sophistiqués
- ERP
- CRM
- comptabilité générale
- trésorerie
- SIRH complet

Ces sujets peuvent venir après stabilisation de la fondation.

---

# 53. Vision finale

DCS ne doit pas être perçu comme :

> « un système qui transforme des JSON en PDF et fait passer des statuts ».

Il doit être perçu comme :

> **un environnement dans lequel une organisation crée, contrôle, valide, signe, émet et conserve ses documents sans avoir à gérer elle-même la mécanique documentaire.**

La valeur du produit est précisément de rendre cette mécanique invisible.

## Principe directeur final

```text
L’utilisateur choisit.
L’utilisateur renseigne.
L’utilisateur vérifie.
L’utilisateur décide.

DCS :
pré-remplit,
valide,
versionne,
fait circuler,
contrôle,
notifie,
génère,
fige,
trace,
prouve,
archive.
```

La sensation recherchée est simple :

> **« Je sais exactement quoi faire, et le système s’occupe du reste. »**

---

## Annexe A — Mapping avec l’implémentation actuelle

La refonte doit s’appuyer sur ce qui existe déjà :

- `/documents/new` sait déjà charger les types, récupérer le template et son schema, pré-remplir le contexte métier et créer un brouillon.
- `/documents/[id]` sait déjà charger document, preview, révisions, liens, audit, workflow, record et certificats ; il supporte aussi autosave, génération PDF, téléchargement, dérivation et transitions.
- Review et Approval existent déjà comme routes séparées.
- Templates possède déjà une gestion des versions, des champs et de publication.
- Documents et Inbox existent déjà comme surfaces fonctionnelles.

La priorité est donc une **refonte de présentation et d’interaction**, pas une réécriture du moteur métier.

---

## Annexe B — Règle d’or de chaque écran

Chaque écran doit répondre immédiatement à trois questions :

1. **Où suis-je ?**
2. **Que puis-je faire maintenant ?**
3. **Quelle est la prochaine étape ?**

Si l’utilisateur doit chercher dans l’interface pour comprendre son action, l’écran n’est pas terminé.

---

## Annexe C — Règle d’or de chaque document

À tout moment, un utilisateur doit pouvoir comprendre :

```text
Quel document ?
Quelle version ?
Dans quel état ?
Qui doit agir ?
Que dois-je faire ?
Quel est le contenu ?
Quel est le contexte ?
Quelle est la prochaine étape ?
```

C’est cette structure qui doit devenir le véritable squelette du DCS.
