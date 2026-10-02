# ROADMAP - 8 phases DCS

**Source :** `DailyOps_Document_Control_System_Project_Foundation_v1_0.md` §19.
Question guide : comment exécuter le travail documentaire avec moins d'étapes manuelles, plus de contrôle, de traçabilité, d'intégrité et de preuve ? (§22)

| Phase | Contenu | Jalon mesurable |
|---|---|---|
| **P1 Foundation** ✅ | modèle, types (23, 6 domaines), métadonnées, numérotation, templates, statuts | `DO-OFF-2026-0001` créé + PDF SHA-256 ✅ |
| **P2 Builder** ✅ | formulaires dynamiques, preview, révisions+diff, relations inter-documents | proposition → devis dérivé lié |
| **P3 Workflow** ✅ | review/approval/signature/issuance/expiry/archive par type + SoD | NDA complet : préparé→revu→autorisé→signé→émis |
| **P4 Inbox** ✅ | To Review/Approve/Sign, Expiring, Exceptions, Recently Completed | reviewer voit sa file avec échéances |
| **P5 Evidence** ✅ | audit 20+ événements, intégrité, evidence package | timeline §13 reconstituée sans effort |
| **P6 Business Data** ✅ | customers, people, employees, projects, services, transactions | proposition auto-remplie (cas §9) |
| **P7 Expansion** ✅ | Official, Business, Legal, Certificats+QR, HR, Finance bornée | 1er certificat vérifiable + 1er reçu finance |
| **P8 Automation** ✅ | routage, rappels, transitions auto, intégrations utiles | 0 relance manuelle sur un cycle standard |

## Règles de phasage (§17-18)

- Ne pas construire : ERP, CRM, comptabilité, cloud drive, e-signature générique, marketing builder.
- Finance bornée dès le début (§11) : documents + statuts de paiement oui ; grand livre non.
- HR = domaine documentaire, pas un SIRH.
- Intégrations seulement si elles suppriment du travail.
- Nouveaux documents via DCS d'abord ; historique migré progressivement.

## Definition of Success (§20)

> « I need this document. » → l'utilisateur choisit le type, fournit le requis,
> le système construit, route, fait relire/approuver/signer par les humains,
> émet, préserve la preuve, archive. Ni filenames, ni versions, ni relances manuelles.
