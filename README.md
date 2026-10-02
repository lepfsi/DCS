# DCS - DailyOps Document Control System

> **Document Control is the product.**
> Plateforme d'opérations documentaires : Create → Review → Approve → Sign → Issue → Prove → Archive.
> L'utilisateur gère la décision, le système gère la mécanique.

- **Référence produit :** `DailyOps_Document_Control_System_Project_Foundation_v1_0.md` (v1.0 - fait foi ;
  l'ancien PRD (`OpsDocs_..._PRD_v1_0.pdf`) reste en archive de travail)
- **5 piliers :** Document Engine · Workflow Engine · Document Inbox · Record & Evidence · Business Data

## Ordre de construction (8 phases DCS §19)

P1 Foundation ✅ (modèle, numérotation, templates, statuts - jalon `DO-OFF-2026-0001` atteint)
→ P2 Builder ✅ (schémas dynamiques, preview, diff, liens `document_links`, dérivation)
→ P3 Workflow par type ✅ (transitions gardées, SoD, signatures-événements, notifications) → P4 Inbox ✅ (files par rôle, items enrichis, priorités, exceptions, aperçu décision) → P5 Record et Evidence ✅ (chaine d'intégrité, vérification artefacts, dossier de preuve) → P6 Business Data ✅ (customers, projects, services, transactions, pré-remplissage, recherche) → P7 Expansion domaines ✅ (52 types, certificats + vérification publique, confidentialité HR) → P8 Automation ✅ (routage assignés, rappels, escalade, archivage auto, webhooks).
Voir `project/ROADMAP.md`.

## Démarrage (PowerShell)

```powershell
# API (port 3001 par défaut)
cd apps\api; node dist/src/index.js
# Web
cd ..\web; npm run dev   # http://localhost:3000/login
```

## Arborescence

```
DailyOpsDocs/
├── README.md                        ← ce fichier
├── OpsDocs_Document_Operations_System_PRD_v1_0.pdf  ← source
├── docs/                            ← PRD formalisé (7 fiches)
│   ├── 01-vision-objectifs.md
│   ├── 02-taxonomie-piliers.md
│   ├── 03-parcours-lifecycle-inbox.md
│   ├── 04-builder-moteur-templates.md
│   ├── 05-workflow-signatures-audit.md
│   ├── 06-architecture.md
│   └── 07-modele-donnees.md
├── project/                         ← pilotage
│   ├── BACKLOG.md                   ← Epics P1-P5 + US + critères d'acceptation
│   ├── ROADMAP.md                   ← phases, jalons, DoD v1
│   ├── GOVERNANCE.md                ← rôles, RBAC, règles de gestion
│   └── LAUNCH-CHECKLIST.md
├── db/schema.sql                    ← modèle PostgreSQL v1 (source de vérité)
├── api/openapi.yaml                 ← API-first (11 domaines)
├── templates/catalogue.json         ← 17 types initiaux + exemple DO-BIZ-PROPOSAL
├── workflows/definitions.json       ← state machine + matrices par type
├── apps/api/                       ← squelette Node.js + TypeScript
├── apps/web/                        ← squelette Next.js (Inbox + Workspace)
└── infra/docker-compose.yml
```

## Les 5 piliers (DCS §21) + 6 domaines (§5)

Piliers : Document Engine · Workflow Engine · Document Inbox · Record & Evidence · Business Data.
Domaines du même moteur : Official · Business · Legal/Formal · Certificate · **HR** (pas un SIRH) · **Finance** (bornée : pas de grand livre).

## Familles documentaires

| Famille | Préfixe | Exemples |
|---|---|---|
| OFFICIAL | `DO-OFF-YYYY-####` | lettre officielle, communiqué, note, PV |
| BUSINESS | `DO-BIZ-YYYY-####` | proposition, devis, facture, rapport d'intervention |
| LEGAL / FORMAL | `DO-LEG-YYYY-####` | NDA, contrat de service, lettre d'engagement, avenant |
| CERTIFICATE | `DO-CER-YYYY-####` | stage, formation/participation, contribution |
| HR | `DO-HR-YYYY-####` | attestation de travail, contrat de travail, notification RH |
| FINANCE | `DO-FIN-YYYY-####` | pro forma, avoir, reçu, relance (pas de comptabilité) |

Référence humaine `DO-[FAMILLE]-[ANNÉE]-[SÉQUENCE]` (transactionnelle, anti-collision) + `UUID` technique interne.

## Lifecycle

```
Draft → In Review → Changes Requested → Approved → Ready to Sign → Signed → Issued → Archived
                                    ↘ Rejected / Cancelled / Expired / Revoked / Superseded
```

- Transitions non contournables, chaque transition = événement d'audit.
- Artefact signé/émis = **immuable**. Correction = nouvelle révision ou remplacement selon politique du type.

## Definition of Done v1

Un utilisateur autorisé peut : créer depuis un type approuvé → saisir structuré → sauvegarder/réviser →
faire circuler en workflow → enregistrer review/approval/signature → générer un PDF émis immuable
avec référence unique → le retrouver → inspecter la timeline d'audit complète.
+ Certificats : ID unique + endpoint de vérification reflétant validité/révocation.

## Prochaines actions

1. Parcours complet wireframe : Overview → Inbox deux volets → Documents table → Create 2 étapes → Review/Approval → Records → Templates → Administration
2. Mise en service : revoir `project/LAUNCH-CHECKLIST.md` (sauvegarde, rétention, procédures admin)
