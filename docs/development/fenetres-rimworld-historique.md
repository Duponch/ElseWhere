# Fenêtres comme RimWorld — lot 9 : Historique

Reprise du 24 novembre, interface seule. Dans Core, `MainTabWindow_History` demande 1 010 × 640 ; onglets Graphiques, Messages et Statistiques, liste de messages à gauche et détail sélectionné à droite. Rangées de 30, colonnes épingle et icône de 30, date de 90, marge de 5, recherche de 240 × 24 à (720, 8), graphique de 450.

## Contenu et limites

- Les lettres archivées et les lignes du journal ont une sélection, un texte complet à droite, une recherche, des filtres et les véritables commandes d'ouverture/épinglage. La sélection ne modifie ni l'archive ni le monde ; les anciennes activations restent disponibles. Les deux colonnes défilent indépendamment.
- Le suivi économique garde actuellement un seul relevé du patrimoine. Graphiques affiche **ce relevé uniquement** (objets, bâtiments, sols, personnes évaluées), avec l'indication d'incomplétude ; Statistiques reprend les autres faits de simulation déjà présents. Pas de courbe passée inventée ni de nouveau stockage. Messages reste l'onglet initial tant que les séries historiques du jeu de base manquent.
- Sur les petits écrans, le bandeau des filtres peut défiler et les actions trop grandes restent accessibles dans la liste.

## Coût et vérifications

Les cellules fixes du journal sont composées directement, sans mesurer ni mettre en page le texte entier des messages non sélectionnés. Deux versions empaquetées, journal synthétique de 200 messages, 7 passages alternés de 150 compositions complètes : médiane 0,678 → 0,327 ms (−52 %). 64 tests ciblés verts avant cette optimisation exacte de la géométrie ; nouveau contrôle lié lancé sur la copie d'intégration. Aucun changement de schéma. Contrôle visuel réel encore bloqué par l'accès au navigateur local.
