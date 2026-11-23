# Tableaux de colons et d'animaux comme RimWorld (vague 4, lot 5)

Points 17 et 32 du [chantier des retours](chantier-retours-20261122.md). Les chiffres viennent de `PawnTable`, `PawnColumnWorker_*`, `WidgetsWork` et `MainTabWindow_PawnTable` (décompilés), réécrits dans `src/ui3d/native-pawn-table.ts` ; aucun texte ni ressource de Ludeon n'est copié. Interface seule : pas de changement de schéma, les ordres passent toujours par les commandes existantes.

## Ce qui est repris du code du jeu

- **Ligne** : 30 (`GetMinCellHeight`). **En-tête du Travail** : 50 (`LabelRowHeight`), libellé écrit en entier au-dessus d'un trait vertical de 2 à 30 % d'opacité qui descend jusqu'à la colonne ; un libellé sur deux est descendu de 20 (`moveWorkTypeLabelDown`, le premier est descendu).
- **Case de priorité** : 25 × 25 centrée dans la colonne, 2,5 sous le haut de la ligne, un seul chiffre en police Titre (ou une coche en mode simple) ; la couleur de fond suit la compétence pertinente, la flamme de passion est une icône pâle (40 %) dans la case ; la compétence, l'incapacité et l'avertissement restent dans l'infobulle.
- **Largeurs de colonnes** (min / optimale / max) : nom 80 / 165, travail 32 / 39 / 80, planning 360 / 504 / 600 pour les 24 heures (15 / 21 / 25 chacune), politiques de tenue, drogues, nourriture, lecture 194 / 251, zone autorisée 200 / 273. `pawnTableWidths` reprend `PawnTable.RecacheColumnWidths` : minimums, puis le reste au prorata des largeurs optimales jusqu'à l'optimum, puis jusqu'au maximum, puis sans limite ; le dernier prend le reste. La fenêtre est aussi large que la somme des largeurs optimales le demande (au moins 998 − 16, au plus l'écran), et non plus toujours pleine largeur. Si les minimums ne tiennent pas, le jeu écrase les colonnes ; Elsewhere garde son défilement horizontal.
- **Ordre des colonnes** : copier/coller d'abord (Travail et Planning), puis les cases ; Assignations dans l'ordre du jeu (hostilité, tenue, port forcé, nourriture, drogues, lecture) avec la zone autorisée en dernier, comme le tableau Restreindre.
- **En-têtes** : plus aucun mot coupé (« Repo s ») : le minimum d'une colonne est son mot le plus long ; libellés du Travail en français complets (Incendie, Patient, Médecin, Repos, Corvées, Geôlier, Dressage, Cuisine, Chasse, Construire, Cultiver, Miner, Plantes, Forge, Couture, Art, Artisanat, Transport, Nettoyage, Recherche).
- **Priorités manuelles** : case en haut à gauche de la fenêtre, au-dessus du tableau, comme celle de `MainTabWindow_Work` (elle n'est plus un bouton du pied de fenêtre).

## Adaptations déclarées

- Colonne d'activité (192) gardée : le jeu ne l'a pas, mais elle existait ; les traits restent dans l'infobulle de la ligne.
- Copier et Coller sont deux colonnes de 58 avec leur texte (le jeu a une colonne de 36 avec deux icônes).
- La recherche locale des colons (nom ou identifiant) reste, **hors de l'en-tête du tableau** : dans la bande libre au-dessus, avec la case des priorités ; le jeu n'a pas d'équivalent, mais la retirer enlèverait une fonction sur 80 colons. Même chose pour la recherche et les filtres des tableaux Animaux et Faune.
- Animaux et Faune reçoivent la même géométrie (lignes de 30, largeurs par colonne, en-têtes sans mot coupé) ; leurs colonnes propres (Produit, Transport, Repérer, Tirer, Mêlée…) gardent leurs largeurs d'Elsewhere. Pas de colonne Faction ni Idéologie.
- Avertissement « compétence très faible » : le jeu dessine une surcouche sur la case, ici il reste dans l'infobulle.
- En-tête du Planning : 24 (le jeu : 15 pour les heures seules) ; en-tête des autres tableaux : 36 à 40 au lieu de 65 (la bande de 65 du jeu porte ses boutons « gérer », qui sont au pied de la fenêtre ici).

## Coût

Aucun parcours par image ajouté : la géométrie est calculée une fois par changement de page. Mesure Node, 80 colons : mise en page du Travail 0,45 → 0,65 ms, Planning 0,49 → 0,77 ms, Assignations 0,25 → 0,38 ms par recalcul (calcul des largeurs en plus) ; construction des pages inchangée (Travail ≈ 46–50 ms, dominée par les requêtes de compétences, déjà présente).

## Tests

`tests/native-pawn-table-rimworld.test.ts` (constantes, partage des largeurs, mots jamais coupés, lignes de 30, en-tête de 50, cases de 25 × 25) ; tests de tableaux de colons et d'animaux mis à jour aux nouvelles géométries.
