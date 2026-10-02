# BACKLOG - Phases DCS (v1.0 §19) + User Stories

Référence produit : `DailyOps_Document_Control_System_Project_Foundation_v1_0.md`.
Principe : **l'utilisateur gère la décision, le système gère la mécanique** (§2, §8).

## Règles produit (arbitrages actés)

- Pas d'impasse : s'il manque un template, le système propose de générer le brouillon
  (mécanique) ; la publication reste une décision humaine. Idem partout : chaque état
  vide explique la cause et l'action suivante.
- Titre toujours requis (API + UI) : jamais de nom par défaut qui survive par précipitation.
- Pas de bouton qui finit en 403 sec : l'UI connaît le rôle, masque ou explique qui appeler.
- Records explicites (créés au hub), documents liés (référencés) : les deux restent visibles.
- Admin administre vraiment : utilisateurs, rôles, activation, politiques persistées.
  On ne verrouille jamais son propre accès.
- Toute erreur de validation répond 422 JSON ; aucun handler async ne fait tomber le process.
Chaque US a des critères d'acceptation testables. Statut : Phase 1 ✅ construite et vérifiée.

## Phase 1 - Foundation ✅ FAIT

Modèle, types, métadonnées, numérotation, templates, statuts.

- **US-1.1** Auth + users/rôles (admin, doc_manager, author, reviewer, approver, signer, viewer).
  - Accept : RBAC sur routes protégées ; 403 vérifié (test + API réelle).
- **US-1.2** Types (23, 6 domaines) + templates draft → publish (approved) / retire.
  - Accept : seul approved crée/génère ; retired non sélectionnable.
- **US-1.3** Création document → référence `DO-XXX-YYYY-####` transactionnelle.
  - Accept : 20 créations concurrentes → 0 collision ; jalon `DO-OFF-2026-0001` ✅.
- **US-1.4** Génération PDF déterministe + pré-contrôles + SHA-256.
  - Accept : régénération même révision → même hash ✅ (`50181256…`).
- **US-1.5** Inbox de base + compteurs. Accept : files par permission.
- **US-1.6** Audit de base (created, draft_saved, revision_created, generated, downloaded), append-only.

## Phase 2 - Document Builder

Formulaires dynamiques (ne demander que le requis du type), génération, preview, révisions+diff, **relations inter-documents** (DCS §12 : Proposal → Contract → Invoice, `document_links`).

- **US-2.1** Form engine par type (champs, validations, conditions) + autosave.
- **US-2.2** Preview live + pré-contrôles avant génération.
- **US-2.3** Révisions : timeline, diff, nouvelle version sans effacer l'ancienne (§13.2).
- **US-2.4** Liaisons : créer un document dérivé (ex. devis depuis proposition) avec lien typé (`derives_from, amends, supersedes, invoices, relates_to`).
- **US-2.5** Chaînes HR (Job → Employment Doc → Decision → Notification) et finance (liens proposal/contract/project).

## Phase 3 - Workflow

Review, approval, signature, issuance, expiry, archive - **configuré par type** (§6, pas de lifecycle unique).

- **US-3.1** Submit → Review (approve / request_changes motif obligatoire / comment + pièce).
- **US-3.2** Approve / reject (motif obligatoire) + séparation des devoirs (ex. `legal_strict`, `hr_strict`).
- **US-3.3** Signatures = événements + preuve (§13.5) ; issuance = record officiel (§13.6).
- **US-3.4** Expiry / revoke / supersede / cancel avec motifs ; lifecycles financiers (Validated → Issued → Sent → Paid).
- **US-3.5** Notifications et rappels sur transitions et échéances.

## Phase 4 - Document Inbox

Files d'action : To Review, To Approve, To Sign, Expiring, Exceptions, Recently Completed (§7).

- **US-4.1** Queues par rôle avec compteurs opérationnels.
- **US-4.2** Chaque item répond : quoi ? action ? pourquoi ? échéance ? quoi de neuf ? (§7.2).
- **US-4.3** Vues décision : historique review/approval/signature visible avant de décider.
- **US-4.4** Priorités + retards (blocked, overdue, incomplet).

## Phase 5 - Record & Evidence

Audit trail complet, intégrité, historique, evidence package, traçabilité (§13).

- **US-5.1** 20+ types d'événements avec acteur, timestamp, états avant/après, version, contexte.
- **US-5.2** Détection de modification non autorisée (hash chaîné / vérification SHA-256).
- **US-5.3** Correction sans effacement : revision / supersession / cancellation / revocation.
- **US-5.4** Vue synthèse : Status, Version, Owner, Pending Action, Related Records, histories (§16).

## Phase 6 - Business Data

Minimum structuré pour exécuter les documents, sans devenir CRM/ERP (§10).

- **US-6.1** Customers, People/Contacts, Employees, Projects, Services/Products, Transactions, Relationships.
- **US-6.2** Réutilisation : proposition auto-remplie (client, projet, service, prix, conditions) - cas §9.
- **US-6.3** Champs monétaires : devises, taxes, remises, totaux, échéances, statut de paiement (frontière §11 : pas de grand livre).
- **US-6.4** Recherche : référence, type, client, employé, projet, statut, dates, acteurs, document lié (§16).

## Phase 7 - Domain Expansion

- **US-7.1** Official (16 types §5.1), Business (20 §5.2), Legal (20 §5.3), Certificate + vérification QR (12 §5.4).
- **US-7.2** HR (12 §5.5, pas un SIRH) avec confidentialité renforcée.
- **US-7.3** Finance documentaire bornée (§11) : pro forma, avoir, reçu, échéancier, relance - sans comptabilité.
- **US-7.4** Rationaliser les doublons BIZ/FIN (ex. facture) lors de l'expansion.

## Phase 8 - Automation

Règles, routage auto, rappels, documents dérivés, transitions automatiques (§8, §19).

- **US-8.1** Routage : reviewers/approvers déterminés par le type + règles.
- **US-8.2** Rappels d'échéance et escalade sans changer l'état (sauf politique explicite).
- **US-8.3** Transitions auto autorisées (ex. archive après délai) + traçabilité.
- **US-8.4** Intégrations seulement si elles suppriment du travail (§18) : IdP, email, stockage, e-signature, compta (export, pas de grand livre).

## Non-fonctionnel transverse

- NFR-1 Rendu déterministe versionné ; NFR-2 SHA-256 systématique ; NFR-3 backups + restore testé ;
  NFR-4 rate limiting + downloads sécurisés ; NFR-5 rétention/archivage explicites ; NFR-6 confidentialité par sensibilité (HR, contrats, disciplinaire).
