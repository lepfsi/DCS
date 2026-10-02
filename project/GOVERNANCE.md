# GOVERNANCE - Rôles, RBAC, règles

**Source :** PRD §15, §29.

## Rôles

Admin · Document Manager · Author · Reviewer · Approver · Signer · Viewer/Auditor.

## Autorité : deux couches (combo acté)

1. **Workflow par type** (`workflow_key`) : dit QUELLES étapes existent et quels rôles y participent.
   Ex : `legal_strict` impose revue + autorisation + signature ; la criticité du document
   se règle ici, pas dans les individus.
2. **Matrice d'autorité** (éditable dans Administration, persistée en settings) : dit QUI a
   l'autorité d'agir, tous workflows confondus. Les deux couches doivent passer (ET logique).

Défaut (comportement historique préservé) :

| Permission | admin | doc_mgr | author | reviewer | approver | signer | viewer |
|---|---|---|---|---|---|---|---|
| view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| edit | ✓ | ✓ | ✓ | - | - | - | - |
| review | ✓ | ✓ | - | ✓ | ✓ | - | - |
| approve | ✓ | - | - | ✓ | ✓ | - | - |
| sign | ✓ | ✓ | - | - | ✓ | ✓ | - |
| issue | ✓ | ✓ | - | - | ✓ | - | - |
| admin | ✓ | - | - | - | - | - | - |

Resserrer = décocher. Ex : retirer `approve` au reviewer sépare revue et approbation
par construction (vérifié : le reviewer est alors bloqué avec permission explicite).

## Départements

Chaque utilisateur a un département (Direction, Technique, Finance, RH, Juridique,
Opérations), visible et modifiable dans Administration. Il sert aujourd'hui au
périmètre d'affectation ; le routage par département est une extension prévue,
pas un comportement silencieux.

## Règles

- **Séparation des devoirs** opposable (ex. `legal_strict` : préparateur ≠ autorisateur final).
- Chaque template a un **owner** (exactitude contenu) + **publisher** autorisé (mise en release).
- Modifs templates légaux = revue élevée + versioning explicite.
- Numérotation, vérification certificats, config audit = capacités admin protégées.
- Niveaux de confidentialité hérités par les artefacts.
- Événements eux-mêmes auditables : publish/retire template, config numbering, rôles, accès audit.
