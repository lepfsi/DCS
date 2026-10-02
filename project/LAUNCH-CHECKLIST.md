# LAUNCH CHECKLIST

**Source :** PRD §30.

## Produit
- [ ] Catalogue 17 types validé (`templates/catalogue.json`)
- [ ] Matrice workflows validée (`workflows/definitions.json`)
- [ ] RBAC + SoD validés (`project/GOVERNANCE.md`)

## Design
- [ ] Tokens visuels DailyOps (header/footer, typo, blocs signature, système certificat)
- [ ] Maquettes Inbox + Workspace split-view (état/responsabilité/échéances d'abord)

## Engineering
- [ ] Repo + `db/schema.sql` appliqué + seed types/workflows
- [ ] Auth + MFA privilégiés
- [ ] Moteur templates + rendu HTML→PDF déterministe + stockage S3
- [ ] Audit append-only (trigger anti UPDATE/DELETE)

## Contenu
- [ ] 15-20 templates contrôlés construits et validés sur cas réels

## Tests
- [ ] Numérotation concurrente (0 collision)
- [ ] Permissions / refus 403 / SoD
- [ ] Rejet + motif, historique révisions + diff, PDF régénéré identique
- [ ] Intégrité artefact signé (SHA-256) + révocation certificat reflétée en vérification

## Ops
- [ ] Backup/restore, rétention, monitoring, procédures admin

## Lancement
- [ ] Nouveaux documents via DCS d'abord ; historique migré progressivement
- [ ] DoD v1 vérifiée de bout en bout
