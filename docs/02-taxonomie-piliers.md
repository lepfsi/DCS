# 02 - Taxonomie + 13 piliers + types initiaux

**Source :** PRD §03-04, §25-26.

## Familles

| Famille | Rôle | Types initiaux (17) |
|---|---|---|
| OFFICIAL - DailyOps parle | institutionnel | Official Letter (`DO-OFF-LETTER`), Official Notice/Announcement, Information Note, Administrative Confirmation |
| BUSINESS - DailyOps délivre | commercial/mission | Service Proposal (`DO-BIZ-PROPOSAL`), Quotation, Invoice, Intervention Report, Service Report |
| LEGAL/FORMAL - DailyOps s'engage | contractuel | NDA (`DO-LEG-NDA`), Service Agreement, Engagement Letter, Amendment |
| CERTIFICATE - DailyOps reconnaît | preuve | Internship Certificate (`DO-CER-INTERNSHIP`), Training/Participation Certificate, Certificate of Contribution |

Chaque type a un `type_code` machine unique, ex. `DO-BIZ-PROPOSAL`, `DO-LEG-NDA`, `DO-OFF-LETTER`.

## Les 13 piliers (exigences structurantes)

1. **Library** - catalogue contrôlé familles/types.
2. **Builder** - formulaires guidés, pas d'édition de mise en page.
3. **Template Engine** - templates versionnés, placeholders, conditions, blocs réutilisables, signatures.
4. **Numbering** - référence centrale transactionnelle (`DO-BIZ-2026-0042`).
5. **Version & Revision** - distinguer template version / révision document / artefact / record signé.
6. **Review & Approval** - états, rôles, décisions, motifs de rejet/modification.
7. **Signatures** - Prepared/Reviewed/Approved/Authorized/Signed/Accepted by.
8. **Inbox** - files : brouillons, review, approbation, signature, modifications, archive.
9. **Audit Trail** - append-only, qui/quoi/quand.
10. **Data Reuse** - clients, contacts, projets, services, données société.
11. **Output** - PDF faisant foi, DOCX optionnel, download/share contrôlés.
12. **Certificates** - IDs, QR, validité, révocation.
13. **Integrations** - CRM, compta, email, stockage, identité, e-signature.

## Exemple de définition - proposition de service

```json
{
  "type_code": "DO-BIZ-PROPOSAL",
  "family": "BUSINESS",
  "fields": ["client", "contact", "proposal_date", "validity", "project_title",
    "executive_summary", "scope", "deliverables", "assumptions", "exclusions",
    "timeline", "fees", "taxes", "payment_terms", "acceptance"],
  "workflow": "author → reviewer → approver → issue",
  "signature_roles": ["prepared_by", "approved_by", "client_acceptance"],
  "outputs": ["pdf", "docx"],
  "confidentiality": "internal/client",
  "template_version": "1.0"
}
```

Voir le catalogue machine : `templates/catalogue.json`.
