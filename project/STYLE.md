# STYLE — Standard de présentation DCS

Référence obligatoire pour tout code, UI et document produits dans ce repo.

## 1. Ponctuation

- Trait d'union `-` uniquement. Pas de tiret long (`-`, `–`) dans le code, l'UI ni les docs.
- Séparateurs sobres autorisés : `·` `|` `/` `:`.
- `...` trois points simples, pas de fioritures typographiques.

## 2. Icones et signaux visuels

- Aucun emoji dans l'UI, les messages d'erreur, les logs ni les PDF (pas de ✅ ❌ ⚠️ ⏰ 🔺 ⛔ ✓).
- Signaler par du texte et du CSS : libellés `[EN RETARD]`, `[PRIORITAIRE]`, `[OK]`, `[KO]`, `[signé]`, préfixes `Erreur :`, `Manquants :`.
- Flèches fonctionnelles `→` `←` admises uniquement comme séparateurs de flux (steps, transitions), jamais comme décoration.
- Si une icone graphique est nécessaire : SVG inline propre ou bibliothèque professionnelle. Pas d'emoji déguisé en icone.

## 3. Anti "vibe coded"

- Pas de dégradés violets/bleus génériques, pas de `lorem ipsum`, pas de TODO visible dans l'UI.
- Pas de pied de page "généré par IA" ni de mentions d'outillage dans le produit.
- Police système, mise en page sobre : l'état, la responsabilité et l'échéance d'abord.
- Chaque écran montre la prochaine action opérationnelle, sans texte de remplissage.

## 4. Langue

- UI et messages en français. Codes techniques (`type_code`, états, rôles) en anglais snake_case, inchangés.
- Erreurs API : `error` machine en snake_case + `detail` humain si besoin.
