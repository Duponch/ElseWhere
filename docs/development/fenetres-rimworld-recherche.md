# Fenêtres comme RimWorld — lot 7 : Recherche

Reprise du 24 novembre, interface seule, schéma 377 inchangé. Référence : `MainTabWindow_Research` et les `ResearchProjectDef` de RimWorld 1.6 Core installés. Le catalogue natif existait déjà sous forme de graphe compact ; il ne suivait ni les positions de Core ni sa géométrie.

## Ce que voit le joueur

- Les 54 projets actuellement implémentés ont chacun une vignette de 140 × 50 aux coordonnées de Core (pas horizontal de 190, vertical de 100, marge de 20). Comparaison indépendante de toutes les coordonnées avec les définitions installées : **54/54 identiques**. Les emplacements des recherches pas encore implémentées restent vides. Le graphe de 4 170 × 650 se parcourt horizontalement et verticalement au besoin.
- Les liens sont ceux des prérequis visibles de la table de simulation ; ils partent du bord droit du prérequis vers le bord gauche du projet. Ceux du projet sélectionné sont mis en évidence (4 points au lieu de 2), comme le jeu de base. Les prérequis cachés restent affichés dans le dossier et toujours appliqués par les règles.
- Fenêtre pleine largeur disponible, colonne de gauche de 22 % (au moins 270 si l'écran le permet), écart de 10 ; titre du projet sur 50, commande de lancement de 55. Onglet Principal et recherche de 200 × 24 en haut du graphe sur un écran nominal. À l'échelle réduite, ces éléments se redistribuent sans perdre les commandes ni les faits.
- Une recherche par nom, détail ou identifiant atténue les autres nœuds sans leur retirer leur place ni leurs liens. Elle sélectionne et amène au premier résultat ; aucun projet n'est lancé sans le geste habituel. Les choix restent des brouillons de l'interface et sont réinitialisés lors d'un changement réel de partie.

## Adaptations et coût

La petite commande de lancement direct sur chaque vignette et les informations de préparation du travail d'Elsewhere sont conservées. La colonne de gauche reste entièrement défilable (Core sépare son panneau de progression fixe). L'apparence carton et l'échelle de texte commune sont gardées, sans copier les textes ni les images du jeu. Le graphe DOM historique ne change pas.

Les coordonnées, les liens et les chaînes recherchables sont préparés hors des images. Les liens sont des segments plutôt que des courbes échantillonnées ; la nouvelle grande largeur est une étendue de défilement, pas une texture de 4 170 points : seules les pièces dans la fenêtre sont dessinées. Le recentrage est demandé une fois par nouvelle recherche ou retour au projet actif, et ne fait pas sauter le défilement à chaque instantané.

Banc empaqueté par esbuild, construction de la page et disposition des 54 projets (carte témoin, 1 440 × 860), sept passages alternés de 300 compositions. Deux relevés : 0,218 → 0,217 ms puis 0,397 → 0,214 ms. Aucun ralentissement observé ; la référence est variable, pas de gain d'images par seconde revendiqué.

## Vérifications

`tests/native-research-tree-v479.test.ts` requalifié avec les 54 projets actuels, les 41 liens historiques exactement inchangés (empreinte extraite de la copie d'origine), la nouvelle géométrie Core, les liens réels, les actions, la recherche, les propriétaires et l'échelle. L'ancien témoin qui avançait artificiellement l'horloge rétablit aussi le budget de chemin au tick donné. Les 12 tests de recherche sont verts ; passe ciblée : 49 tests verts, quatre échecs historiques connus dans `native-structure-layout-v479`, aucun nouvel échec.

Typage intégral réussi. Passe liée : 326 tests verts, 10 échecs répertoriés, plus les deux défauts de témoin reproduits avant ce lot (`daylight-speed-engine-v492` et ordre des colonnes Copier/Coller de `bill-clipboard`). Le second témoin a été aligné en passant sur l'ordre livré au lot 5.

Contrôle visuel dans le vrai client encore impossible dans la session (accès réseau local refusé).
