# 07 - Modèle de données cœur

**Source :** PRD §10, §16. Implémentation : `db/schema.sql` (source de vérité).

## Entités

`User, Organization, Contact, Client, Project, DocumentType, Template, TemplateVersion,
Document, DocumentRevision, DocumentFieldValue, Artifact, WorkflowDefinition,
WorkflowInstance, WorkflowAction, SignatureRequest, SignatureEvent, AuditEvent,
Attachment, Certificate, VerificationRecord.`

## Relations clés

```
DocumentType 1──n Document ──1 TemplateVersion
Document 1──n DocumentRevision 1──n Artifact
Document 1──1 WorkflowInstance 1──n WorkflowAction
Document 1──n AuditEvent (→ Revision / Artifact optionnels)
Document 1──0..1 Certificate 1──n VerificationRecord
Document n──1 Client / Project / Contact (réutilisables)
SignatureRequest 1──n SignatureEvent
```

## Principes

1. **Données structurées séparées du rendu** : `document_field_values` requêtable
   (recherche, reporting, régénérabilité, intégrations). Le PDF n'est qu'un artefact.
2. **Identité double** : `uuid` technique + `reference` humaine immutable
   (`DO-[FAMILLE]-[ANNÉE]-[SÉQUENCE]`, allocation transactionnelle via `numbering_sequences`).
3. **4 concepts séparés** : TemplateVersion ≠ DocumentRevision ≠ Artifact ≠ Signed/Issued Record.
4. **Workflow gouverné** : instance liée au document, actions = décisions auditables.
5. **Audit append-only** : aucun UPDATE/DELETE applicatif sur `audit_events`
   (garde-fou DB : trigger + rôle lecture seule).
6. **Intégrité** : `artifacts.sha256` obligatoire pour tout artefact émis/signé.
7. **Certificats** : `certificates` + `verification_records` (page publique sans audit interne).

## Diagramme (texte)

```
[users]──[workflow_actions]──[workflow_instances]──[documents]──[document_revisions]──[artifacts]
              │                      │                    │                │                  │── sha256
              │                      │                    ├──[clients/contacts/projects]     │──[signature_events]
              │                      │                    └──[certificates]──[verification_records]
              └──[audit_events (append-only)]──(document, revision, artifact)
[document_types]──[templates]──[template_versions]──[documents.template_version]
[numbering_sequences] ──(allocation transactionnelle des références)
```

## Prochaines étapes modélisation

- [ ] Valider types de champs JSONB vs colonnes typées pour `field_values`.
- [ ] Choisir ORM (Prisma/Drizzle) - le SQL reste la référence.
- [ ] Ajouter RLS PostgreSQL si multi-tenant strict requis.
- [ ] Index full-text différé (Phase 3+), champs structurés d'abord.
