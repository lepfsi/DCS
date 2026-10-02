# 06 - Architecture technique + API + sécurité

**Source :** PRD §17-18, §20.

## Architecture cible

```
[ Next.js / React ]  ── form engine + live preview (split view Inbox/Workspace)
        │ REST (`api/openapi.yaml`)
[ Node.js + TypeScript ] ── domaines : documents, templates, workflow,
                             signatures, audit, integrations
        ├── PostgreSQL (transactionnel, champs structurés, états workflow)
        ├── Stockage objet S3-compatible (PDF, DOCX, pièces jointes, artefacts)
        ├── Moteur de rendu HTML/CSS → PDF (déterministe, versionné)
        └── Jobs (génération PDF, notifs, QR, hashing, intégrations)
```

- Auth : IdP organisation ou auth locale sécurisée au départ ; MFA pour privilégiés.
- Observabilité (logs, métriques, statut jobs) **séparée** de l'audit trail métier.

## Stratégie API-first

Même si la première UI est interne, contrats stables dès le départ.
Domaines : `/documents, /document-types, /templates, /template-versions, /clients,
/projects, /workflows, /approvals, /signatures, /artifacts, /audit-events,
/certificates, /verification`.

Contrat de référence : `api/openapi.yaml`.

Intégrations futures (données entrantes, DCS reste system of record du lifecycle) :
CRM (clients/projets), compta (factures), email (distribution), stockage (archive),
IdP (utilisateurs), e-signature (signature externe), automation (notifications).

> Ne pas construire CRM, compta ou e-signature provider dans DCS.

## Sécurité / intégrité (baseline)

- Transport chiffré, stockage chiffré où pertinent, moindre privilège, MFA privilégiés,
  sessions sécurisées, secrets protégés, backups, contrôle des pièces jointes,
  access logging, rate limiting, downloads sécurisés, rétention explicite.
- **Intégrité artefacts :** SHA-256 calculé et stocké avec artefact + records d'émission/signature.
- Sont eux-mêmes auditables : publication/retrait template, config numérotation,
  changements de rôles, accès audit.
- Niveaux de confidentialité sur documents, hérités par artefacts.
- Séparation des devoirs opposable pour documents sensibles
  (ex. interdire préparer + approuver final par la même personne si politique l'exige).
