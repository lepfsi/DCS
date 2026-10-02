# 03 - Parcours utilisateur, lifecycle, Inbox, UX

**Source :** PRD §05-07, §23, §28.

## Parcours cœur (15 étapes)

```
1 Inbox → 2 New Document → 3 Famille → 4 Type → 5 Charger client/projet →
6 Formulaire → 7 Preview → 8 Save draft → 9 Submit for review →
10 Review / change request → 11 Approve → 12 Generate final →
13 Sign → 14 Issue → 15 Archive
```

Chaque transition significative = événement d'audit (acteur, timestamp, état avant/après, révision/artefact).

## State machine

**Recommandé :** `Draft → In Review → Changes Requested → Approved → Ready to Sign → Signed → Issued → Archived`

**Optionnels :** `Rejected, Cancelled, Expired, Revoked, Superseded`.

Règles :
- Pas de saut d'étape obligatoire.
- Signé/émis = immuable → correction = nouvelle révision ou remplacement selon politique du type.
- Transitions sensibles exigent motif / commentaire / pièce jointe.

Voir matrice machine : `workflows/definitions.json`.

## Inbox - surface de contrôle

Question directrice : **« Qu'est-ce qui requiert mon attention ? »**

Files : My Drafts · Needs My Review · Needs My Approval · Needs My Signature ·
Changes Requested · Recently Issued · Expiring/Renewal · Certificates · Archived.

Colonnes : n° document, titre, type, client/destinataire, owner, état, révision,
action en attente, ancienneté, échéance, dernière activité.

Actions contextuelles : Open, Review, Approve, Request Changes, Sign, Generate,
Download, Share, Archive, Revoke, Cancel.

Compteurs opérationnels : ex. 4 en attente de review, 2 de signature, 1 en retard.

## Navigation + workspace

Nav : **Inbox · Documents · Templates · Clients · Projects · Certificates · Reports · Administration.**

Workspace document = **split view** : métadonnées structurées + workflow d'un côté,
prévisualisation du document de l'autre.

> Ne pas reproduire les motifs décoratifs du site public DailyOps.
> App ops : état, responsabilité, échéances, preuve d'abord.
> Chaque écran doit rendre la **prochaine action opérationnelle évidente**.

## Recherche / reporting

Recherche sur métadonnées structurées (pas seulement noms de fichiers).
Filtres : famille, type, référence, statut, client, projet, owner, plage de dates,
reviewer, approver, signer, confidentialité, version template, statut certificat.
Full-text : phase ultérieure. Champs structurés = source de vérité du reporting.

Rapports : émis, actions en attente, durée de cycle d'approbation, révisions/document,
usage templates, statut certificats, workflows en retard, activité d'audit.
