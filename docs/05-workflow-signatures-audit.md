# 05 - Review/Approval, signatures, audit, certificats, notifications

**Source :** PRD §12-14, §19, §22.

## Review vs Approval

- **Reviewer** : vérifie exactitude, complétude, contenu, conformité interne.
- **Approver** : exerce l'autorité d'autoriser l'émission.

Rôles suggérés : Prepared by, Reviewed by, Approved by, Authorized by, Signed by, Accepted by.
Chaque type définit rôles mandatory / optional / N/A.

Ex. proposition : Prepared → Reviewed → Approved → Issued.
Ex. NDA : Prepared → authorized review → Authorized → signatures.

Actions reviewer : approve review, request changes, comment, attach evidence.
Actions approver : approve, reject, request changes. **Toute décision est auditable.**

## Signatures = événements workflow + preuve

Rôle de signature indépendant de sa représentation visuelle
(nom/titre/date, image uploadée, e-signature intégrée, combinaison).

Métadonnées minimales : identité signataire, rôle, timestamp, contexte d'authentification,
révision document, hash artefact, statut signature.

- Hash **SHA-256** par artefact émis, stocké avec artefact + événement d'émission/signature.
- Signatures externes : intégrer un provider e-signature dédié en phase ultérieure
  (ne pas réinventer un mécanisme légalement suffisant dans le MVP).

## Audit trail (sous-système de premier plan)

Doit répondre : **qui a fait quoi, sur quel document, quand, depuis quel état,
vers quel état, avec quelle preuve ?**

Événements : created, field_updated, attachment_added/removed, draft_saved,
revision_created, submitted_for_review, review_started, review_approved,
changes_requested, approval_granted/rejected, generated, regenerated,
signature_requested/completed, issued, downloaded, shared, archived, restored,
cancelled, revoked, superseded, template_changed.

Chaque événement : event ID, document ID, actor ID, actor role, event type, timestamp,
source/app, previous state, new state, revision, change summary, reason/comment,
related artifact, integrity metadata.

- Append-only ; utilisateurs ordinaires ne peuvent ni éditer ni supprimer.
- Rétention explicite et gouvernée.
- UI : timeline lisible + inspecteur d'événements structurés pour admins.

Exemple `DO-BIZ-2026-0042` : 09:14 created (A) → 09:22 client/scope updated →
09:40 rev.1 → 10:05 submitted → 10:21 changes requested (B, pricing) →
10:37 rev.2 → 10:52 review approved → 11:03 approval → 11:07 PDF + SHA-256 →
11:12 signature → 11:13 issued → 11:14 downloaded.

## Certificats / vérification

Flow spécialisé : le destinataire prouve l'authenticité sans accès interne.
- ID certificat unique + QR `verify.dailyops.tech/DO-CER-2026-00482`.
- Page publique : validité, n°, titulaire (si autorisé), programme/titre, issue date, émetteur, statut.
- Jamais de données workflow internes.
- Statuts : Valid, Revoked, Expired, Superseded, Not Found.

## Notifications / automatisation

Event-driven : submitted, changes requested, approval granted, signature requested/completed,
issued, certificat proche d'expiration, workflow overdue.
- Démarrer : in-app + email (autres canaux = intégrations).
- Notifications liées au work item, respectant les permissions.
- Jobs planifiés : surfaçage des retards **sans** changement d'état automatique
  sauf politique explicite.
