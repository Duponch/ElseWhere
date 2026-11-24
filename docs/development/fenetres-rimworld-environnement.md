# Fenêtres RimWorld — lot 17 : statistiques de pièce et beauté

24 novembre 2026. Core 1.6.4871 : lecture locale de `Verse.EnvironmentStatsDrawer`, `Verse.BeautyDrawer`, des RoomStats/RoomRoles Core, des KeyBindings de jeu et de `GlobalControls.TemperatureString`. Reproduction de la présentation avec le papier, les textes et les pictogrammes originaux d'Elsewhere. Schéma 377 et simulation inchangés.

## Commandes et présentation

- Deux boutons indépendants parmi les réglages de vue, sur la deuxième rangée existante : statistiques de pièce (G), beauté (T). Tous deux désactivés au départ ; les raccourcis de palette et de saisie gardent leur priorité. Pas de déplacement du bloc de vitesse/lettres. Pas de fenêtre modale qui arrête la partie.
- Feuille non interactive près du curseur à 26 points sur chaque axe, retournée à gauche/en haut puis bornée par la fenêtre si nécessaire ; largeur nominale **424**, hauteur **49** (beauté), **195** (pièce), **233** (ensemble). Marges, titre, séparateur, cinq lignes de 23 sur un pas de 25, colonnes du relevé Core. Réduction géométrique sur les petits écrans et encre native. Valeurs dans leurs propres emplacements, stades et marqueurs des statistiques liées au rôle. Si les deux modes sont valides, les informations cohabitent dans la même feuille.
- Pièce : vrai rôle (ou pièce générique), impression, richesse, espace, beauté, propreté. Contours des cellules réellement membres de la pièce, pas d'encadré approximatif. Pas de statistiques de pièce au-dehors, sur une porte ou pour une pièce hors du domaine pris en charge (notamment plus de 60 régions). Aucune statistique inventée pour un rôle non implémenté.
- Beauté : moyenne effectivement perçue depuis la case indiquée, nombres non nuls de la perception (arrondis comme Core), gradation rouge/vert et quatre coins de la case survolée. Rayon et comportement aux murs/portes/bords hérités des règles de perception existantes (8,9 cases pour la règle actuelle). Aucun chiffre sur une case cachée. Les valeurs qui exposeraient une pièce partiellement inconnue ne sont pas affichées.
- Température : le bloc du bas à droite indique désormais aussi `Intérieur (sans toit : N)` si la région thermique a réellement des cases sans toiture ; pas de décompte de la partie non explorée.
- La feuille et les annotations de carte disparaissent sur l'interface, les dialogues, hors de la carte ou lors d'une sélection d'outil incompatible. Elles ne prennent pas les clics, ne sont pas un second menu et ne modifient pas la sélection.

## Données et rendu retenu

`src/ui3d/native-environment-stats.ts` lit `WorkEnvironmentCache`, `RoomQualityCapture` et la vraie perception `RoomBeautyCapture` sur le champ obtenu par `captureWorldBeauty`. La façade locale observe les lectures du champ immuable : elle ne réécrit ni le calcul de moyenne ni les valeurs du monde. Les seuils d'état/indications de rôle ajoutés sont des libellés de présentation. La fog et les familles historiques de règles restent respectées.

Les captures sont regroupées par révision de publication Full acceptée. Un changement de case relit immédiatement, une partie en cours rafraîchit le survol immobile au plus toutes les 250 ms ; le même échantillon est réutilisé et le cache de projection est plafonné à 96 échantillons. Aucune capture si les deux boutons sont coupés. La carte de beauté entière est lue seulement quand ce mode en a besoin, une fois par capture ; les déplacements du curseur dans cette capture réutilisent son champ. Les variantes du mode pièce réutilisent la qualité déjà lue d'une même pièce. Au changement de carte ou à la désactivation complète, les captures sont libérées.

`NativeStage` garde une feuille de papier, pose seule modifiée quand le pointeur bouge sans changer l'encre ; texture repeinte aux changements de contenu, taille ou police. `EnvironmentStatsOverlay` utilise deux géométries de bande résidentes et, seulement pour la beauté, un `MapLabelBatch` teinté (instanciation de glyphes numériques). Pas de modèle, de canvas ou de texture par case. Le lot ordinaire des étiquettes de ressources garde son format et sa profondeur habituels. Les annotations utilisent un dessin sans profondeur pour rester lisibles. Pas de parcours de la carte ajouté par image.

## Qualification et coût

- Première passe environnement : 15 suites, **101 tests verts**. Passe finale des deux lots après raccordement de la température, des géométries et de la feuille : 10 suites, **96 verts, 2 ignorés** (preuves opt-in) ; les passes se recouvrent, ne pas additionner. Couvre valeurs réelles et seuils, fog, cas historiques, taille/position de la feuille, rôles, cache borné, contours, couleurs, rétention des buffers, non-interactivité et boutons G/T. Le banc de rendu ne crée pas de GPU.
- Typage TypeScript complet et build Vite Pages réussis. Le build signale les avertissements de taille des chunks ; pas de mesure visuelle réelle ni de FPS revendiquée.
- Banc CPU `tmp/handoff-20261123/bench-environment-stats.ts`, carte préparée 250 × 250, 48 pièces couvertes, 1 872 structures et 3 072 cases de toit. Neuf révisions, 16 lectures de déplacement et 500 relectures de cache par révision. Résultat (`codex-lot17-bench.log`), médianes :

| Modes | Nouvelle révision (ms) | Déplacement/case, même révision (ms) | Relecture en cache (ms) |
|---|---:|---:|---:|
| Désactivés (appel direct du lecteur) | 0,0003 | 0,000113 | 0,000043 |
| Pièce | 1,927 | 0,00036 | 0,000085 |
| Beauté | 2,642 | 0,04797 | 0,000078 |
| Pièce et beauté | 2,676 | 0,01573 | 0,000090 |

Le premier accès à froid a coûté environ 7 à 25 ms selon la passe (ordre et JIT non contrôlés). Pour une partie en cours avec curseur immobile, la borne de quatre lectures/s limite le coût médian des nouveaux relevés combinés à environ 10,7 ms/s sur cette fixture. Ce banc ne mesure ni tout le fil principal, ni une sauvegarde Les Forges, ni le GPU ; les deux modes désactivés ne déclenchent aucun lecteur dans Main. Les agrégats CPU ne valent pas garantie de cadence d'image.

Lots 16 et 17 sont locaux et non publiés. Suite : gestes et raccourcis restants, puis file d'ordres générale à qualifier dans la simulation. La publication du Worker et les performances des grandes colonies restent les chantiers 2 et 4 obligatoires ; le chantier 3 est en pause.
