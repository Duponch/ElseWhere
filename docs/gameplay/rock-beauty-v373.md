# V373 — Beauté de la roche brute et murs vus par les colons

**Schéma 373, non publié.** Un mur de roche naturelle brute enlaidit maintenant la pièce qu'il borde, comme dans RimWorld 1.6 : −2 de beauté pour le granite, le calcaire, le grès et l'ardoise, −1 pour le marbre ; un filon de minerai et des rochers effondrés comptent 0. Lisser un mur rapporte donc +3 à la pièce (granite −2 → +1, marbre −1 → +2), et non plus +1. La beauté perçue par un colon (le besoin de beauté) lit aussi, comme le jeu de base, les murs et les portes qui bordent la pièce où il se trouve, et, depuis une porte, les deux pièces qu'elle sépare. Migration 372 → 373 par le seul numéro ; en dessous de 373 rien ne change.

**Les parties existantes sentent le changement dès leur chargement** : c'est la règle du jeu de base, et non un bénéfice ou une pénalité rétroactifs. Une chambre creusée dans la roche devient plus laide, une pièce aux murs lissés plus belle qu'avant ; la beauté perçue de tous les colons, à l'intérieur comme à l'extérieur, compte désormais les murs qui bordent ce qu'ils voient. Rien n'est enregistré de plus dans la sauvegarde : les valeurs sont relues à chaque calcul.

## Ce que fait le jeu de base (faits repris)

Référence : RimWorld 1.6.4871, classes décompilées `RoomStatWorker_Beauty`, `RoomStatWorker_Wealth`, `BeautyUtility`, `Need_Beauty`, `Room` (`ContainedAndAdjacentThings`, `IsDoorway`), `RegionListersUpdater` (`GetTouchableRegions`), `TouchPathEndModeUtility` (`IsCornerTouchAllowed`, `IsConsideredEdificeForCornerTouch`), `ThingDef` (`Fillage`), `Thing.GetBeauty` ; définitions `ThingDefs_Buildings/Buildings_Natural.xml`, `ThingDefs_Misc/Various_Stone.xml`, `Stats/Stats_Basics_General.xml`. Seuls des faits ont été repris ; les textes sont écrits pour Elsewhere.

- **Beauté des roches.** `RockBase` (toutes les roches naturelles, `Buildings_Natural.xml`) ne définit pas de beauté : la statistique `Beauty` vaut alors sa valeur par défaut 0. `UglyRockBase` (`Various_Stone.xml`) pose **Beauty −2** ; `Sandstone`, `Granite`, `Limestone` et `Slate` en héritent, `Marble` la remplace par **−1**. Les filons (`MineableSteel`, `MineableSilver`, `MineableGold`, `MineableUranium`, `MineablePlasteel`, `MineableJade`, `MineableComponentsIndustrial`) et `CollapsedRocks` dérivent de `RockBase` : **0**. Les parois lissées (`Smoothed<Roche>`) valent **1** (`SmoothedMarble` **2**), d'où un gain de **+3** pour chaque pierre. Aucune roche ne définit `BeautyOutdoors`, donc `Thing.GetBeauty` rend la même valeur dehors et dedans.
- **Beauté de pièce** (`RoomStatWorker_Beauty`) : somme de `CellBeauty` sur les cases de la pièce, puis, pour chaque chose de `ContainedAndAdjacentThings` qui n'est pas dans la pièce, `CellBeauty` de sa case, **une fois par case** ; division par la courbe du nombre de cases de la pièce (20 à 0 case, 40 à 40, puis le nombre lui-même). Les choses voisines sont celles inscrites dans les régions de la pièce : `RegionListersUpdater.GetTouchableRegions` inscrit un édifice dans la région de chacune des huit cases voisines d'où il est touchable ; un édifice qui porte le toit (roche, mur, porte) l'est aussi en diagonale (`IsConsideredEdificeForCornerTouch`), donc les murs d'angle comptent.
- **Beauté d'une case** (`BeautyUtility.CellBeauty`) : si une chose pleine (`Fillage` Full, `fillPercent` > 0,99, comme la roche) occupe la case, seule la somme des choses pleines compte, sans le sol ; sinon les autres choses plus le sol. Une case de mur n'a pas de pièce et se lit « dehors ».
- **Beauté perçue** (`BeautyUtility.AverageBeautyPerceptible`, `FillBeautyRelevantCells`) : les cases du rayon 8,9 autour du colon (`GenRadial`), non couvertes de brouillard, qui appartiennent à une pièce visible **ou touchent une de ses cases parmi leurs huit voisines** ; moyenne de `CellBeauty` sur ces cases, chacune comptée une fois. Les pièces visibles : celle du colon ; s'il se tient dans une porte (`Room.IsDoorway`), aussi les pièces des régions voisines de la porte, c'est-à-dire les deux côtés. Une case de mur ne donne aucune pièce, donc rien à voir.
- **Besoin** (`Need_Beauty`) : niveau instantané `baseLevel + beauté × 0,1` borné à [0, 1], seuils de catégorie 0,01 / 0,15 / 0,35 / 0,65 / 0,85 / 0,99 (déjà repris, V90 puis V313).

## Ce qu'Elsewhere en fait

- **Valeurs.** `src/sim/rock-beauty-373.ts` donne la beauté d'une roche brute selon sa pierre (−2, marbre −1), 0 pour un filon, des rochers effondrés, une roche de pierre inconnue et sous le schéma 373. La paroi lissée garde sa valeur de V367.
- **Pièce.** Les deux lecteurs de pièce comptent la roche brute de la bordure : la qualité de pièce (impression, beauté, richesse, `room-quality.ts`) dans la boucle qui comptait déjà les parois lissées de la bordure, et la carte de beauté (`room-beauty.ts`, besoin et inspection de case) qui place la valeur de chaque roche sur sa case, comme une chose pleine. La bordure reste celle d'avant : les huit voisines des cases de la pièce qui sont des murs ou des portes, chacune une fois. Les murs construits y étaient déjà : leur pièce ne change pas.
- **Beauté perçue.** À partir de 373, la moyenne lit les cases du rayon qui appartiennent à la pièce du colon ou touchent une de ses cases, sans les cases couvertes de brouillard ; une case de mur ou de porte compte ses choses (même règle que la bordure de pièce), une case d'une autre pièce compte comme dans sa propre pièce. Depuis une porte, la porte, les pièces de ses quatre voisines orthogonales et leurs bordures sont lues ; avant 373 un colon dans une porte percevait 0. Un colon dehors voit aussi les faces des murs et des massifs qui bordent l'extérieur.
- **Inspection.** L'environnement d'une pièce et la beauté perçue d'une case suivent ces règles. L'inspection d'un massif de roche brute indique « Beauté −2 pour la pièce qu'elle borde ; lissée, elle compterait 1 » (marbre −1 et 2), celle d'une paroi lissée rappelle la valeur de la roche brute. L'inspection de pièce se recalcule désormais quand un mur de sa bordure est lissé : avant, le lissage ne changeant pas la forme des pièces, l'ancien résultat restait affiché jusqu'au prochain changement dans la pièce (défaut de V367 corrigé).
- **Sauvegardes et transport.** Aucun champ nouveau ; la migration 372 → 373 ne change que le numéro. Le brouillard lu par la perception est celui des cartes géographiques (`foggedCell256`) ; les murs qui bordent une zone découverte sont découverts avec elle, comme dans le jeu de base.

## Adaptations

- **Pierre inconnue.** Une roche des cartes historiques sans pierre connue compte 0 : la pierre ne peut pas être devinée (elle ne peut pas non plus être lissée).
- **Case de bordure.** Elsewhere compte toutes les choses d'une case de mur ou de porte, comme la bordure de pièce le faisait déjà ; le jeu de base ne garde que les choses pleines (la porte, sans la saleté posée sur son seuil). L'écart ne touche que la saleté et les objets posés sur une porte.
- **Dehors.** Comme avant, une pièce qui touche le bord de la carte est « dehors » pour les valeurs extérieures du sol et de la saleté, là où le jeu de base regarde la part de toit ouvert (`PsychologicallyOutdoors`).
- **Ordre de lecture.** Les cases du rayon sont lues ligne par ligne, et non dans l'ordre radial du jeu de base ; la moyenne est la même à l'arrondi près.

## Performances

Le calcul réutilise l'index des pièces (`RoomTopologyCache`) et la bordure déjà calculée par pièce ; aucun parcours de tous les murs n'est ajouté. La valeur d'une roche est relue sur sa case dans les boucles qui lisaient déjà ces cases. La perception teste en plus, pour chaque case du rayon hors de la pièce, ses huit voisines dans l'index (étiquettes entières, sans allocation).

Mesure (`scripts/rock-beauty-373-bench.ts`, empaqueté par esbuild sans `--keep-names`, sur Les Forges : 250 × 250, 132 pièces fermées, 80 colons éveillés, 7 512 structures, 809 cases de roche dont 200 filons). Le code d'avant le lot (origin/main au schéma 372) et le nouveau code (règles 373) ont été lancés en alternance, deux fois chacun, 40 passages par mesure ; médianes en millisecondes, machine partagée avec d'autres travaux :

| Passe | Avant (deux séries) | Après, règles 373 (deux séries) |
|---|---|---|
| Statistiques de toutes les pièces (`RoomQualityCapture`, 132 pièces) | 331,5 · 352,0 | 356,5 · 346,6 |
| Carte de beauté complète et beauté de toutes les pièces | 11,1 · 10,6 | 10,8 · 10,4 |
| Impulsion du besoin de beauté (carte partielle et perception des 80 colons) | 4,10 · 4,07 | 4,00 · 4,07 |
| Perception seule des 80 colons (carte déjà construite) | 0,656 · 0,667 | 0,839 · 0,828 |

Les statistiques de pièce et la carte de beauté ne changent pas au-delà du bruit de mesure (± 4 %). La perception seule coûte environ 0,17 ms de plus par impulsion pour 80 colons (+ 26 %), soit moins de 0,01 ms par tick puisque l'impulsion a lieu tous les 20 ticks ; l'impulsion entière reste dans le bruit. Le nouveau code sous les règles 372 mesure la même chose que l'ancien.

## Ce qui reste

- **Réparation** des parois lissées et **peinture** (Ideology) : inchangés depuis V367.
- **Saleté sur une porte** comptée dans la bordure (voir Adaptations).
- La **richesse** de pièce n'est pas concernée : la roche brute n'a pas de valeur marchande (`RoomStatWorker_Wealth` la compte à 0).

## Contrôles

- `tests/rock-beauty-373.test.ts`, 7 cas : faits du jeu de base (valeurs des cinq pierres, filons, rochers effondrés, pierre inconnue, gain +3) ; une pièce creusée de 3 × 3 compte ses 16 murs de granite (−32, marbre −16, un filon 0) dans les deux lecteurs de pièce et dans l'inspection, l'inspection du massif affiche sa beauté ; un colon lisse une face par de vrais ticks : la pièce gagne 3 (1 sous 372) et l'inspection de pièce se met à jour sans changement de topologie, marbre +3, rechargement identique ; une pièce de murs construits garde sa beauté de pièce et son colon voit maintenant ses murs ; beauté perçue d'un colon dans la pièce creusée (−59 / 25 au lieu de −3), comparée à un calcul indépendant écrit comme `FillBeautyRelevantCells`, brouillard exclu, carte partielle du besoin identique, besoin qui monte en 373 et descend en 372 ; depuis une porte, les deux côtés sont lus (0 avant 373) ; sous 373 rien ne change, migration 372 par le seul numéro, une partie chargée compte aussitôt ses murs.
- `tests/smooth-walls-367.test.ts` : le gain de beauté du lissage au schéma courant passe de 1 à 3 (Core), le cas de 372 est couvert par le nouveau fichier.
- `tests/beauty-need.test.ts` : le colon du premier cas se tient dehors à côté d'un massif dont il voit maintenant les faces brutes ; sa cible passe juste sous 40 (environ 39,6 avec le fauteuil) : le niveau de départ est mis à 39 et le cas vérifie en plus que le fauteuil relève la beauté perçue.
