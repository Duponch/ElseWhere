# Audit performance, architecture et fidélité RimWorld — 5 novembre 2026

Branche : `perf/sim-render-audit`. Ce document résume l’état du projet, les mesures, ce qui a été corrigé, et ce qu’il reste à faire, par ordre d’impact.

## Synthèse (6 novembre, fin de nuit)

| Mesure | Avant | Après |
|---|---|---|
| Simulation, Les Éclaircies (3 colons) | 22,7 ms/tick, ×7,3 max | **11,7 ms/tick, ×14 max** |
| Simulation, Les Forges (80 colons) | 216 ms/tick, ×0,77 max | **85 ms/tick, ×1,96 max** |
| Simulation, Les Aulnes intégrées | 30,4 ms/tick | **15,6 ms/tick** |
| Simulation, Les Aulnes sièges | 37,8 ms/tick | **21,6 ms/tick** |
| Client réel, Les Éclaircies à ×6 | 34 ticks/s (×6 non tenu), 113 im/s, p95 26 ms | **35,8 à 38,6 ticks/s (×6 tenu), 147 im/s, p95 15 ms** |
| Plus longue tâche, Les Éclaircies à ×6 | 290 ms | **136 ms**, et rare |
| Client réel, Les Forges à ×1 | p95 154 à 179 ms (mesure de l’agent rendu) | **p95 32 à 36 ms**, 92 à 98 im/s |

- **Exactitude.** Après chaque optimisation, l’état complet sérialisé reste identique au bit près sur les deux sauvegardes de référence.
- **Tests.** Chaque lot a été comparé test par test au commit d’origine : 0 régression.
- **Bug corrigé.** Les colons étaient invisibles en vue perspective sous WebGPU.
- **Architecture.**
  - Index partagés de structures : par case, par ancre, par identifiant, par type, vues filtrées.
  - Versions de schéma en plages numériques : une montée de version ne demande plus de modifier 30 prédicats.
  - Guide d’architecture : [architecture-guidelines.md](architecture-guidelines.md).
- **Disque.** 14 Go libérés dans `tmp/` (campagnes de mesure du 5 au 12 octobre). Les liens de documentation vers `tmp/` ne bloquent plus `check:docs`.

## 1. Diagnostic d’architecture

Le projet compte environ 195 000 lignes de TypeScript : 1 544 fichiers dans `src/sim`, 379 dans `src/render` et 1 882 fichiers de tests. Plusieurs schémas structurels expliquent la dégradation progressive des performances.

| Constat | Conséquence |
|---|---|
| Aucun index spatial persistant (structures, objets, toits, terrain). Les caches dérivés sont volontairement jetés à chaque tick (« No cross-tick cache »). | Grilles reconstruites en O(carte) à chaque tick ; balayages O(structures) à chaque pas de chaque colon (`doorAt`, `furnitureDelay`, `actorStepAllowed`…). |
| `stepLocalWorld` est une fonction monolithique d’environ 400 lignes qui appelle environ 200 systèmes à **chaque** tick. | RimWorld cadence beaucoup de systèmes en `TickRare` (250) ou `TickLong` (2 000). Ici tout est payé en permanence, y compris par une colonie de 3 colons. |
| Branches conditionnées par la version du schéma partout : `[290,…,301].includes(schemaVersion)`, suffixes `-256`, `-297`, … | La complexité devient combinatoire et chaque fonctionnalité ajoute des chemins « historiques ». |
| Chargement : plus de 40 validateurs « historical transport » parcourent chacun tout l’arbre JSON. | **30 s (3 colons) à 140 s (80 colons) pour charger une partie**, dont 87 % en validation pure. |
| Pont Worker → thread principal : à chaque publication, les colons et les animaux repartent en entier, puis le thread principal **revalide toute la partie** avec les validateurs de sauvegarde. | Mesures en production sur Les Forges : ≈ 764 Ko et ≈ 260 ms de préparation côté Worker par publication, puis **110 à 140 ms d’adoption côté thread principal**, soit ≈ 52 % de son temps. C’est la cause principale des saccades (p95 des images : 154 à 179 ms ; pics à 1,4–2 s). |
| Les tests épinglent des empreintes SHA de fichiers sources (`vitest.config.ts`) et des octets exacts de sauvegarde. | Toute optimisation de ces fichiers casse les tests sans aucun changement de comportement. |
| `AGENTS.md` (280 Ko) et `README.md` (118 Ko) servent de journal à l’agent précédent. | Bruit considérable pour toute reprise humaine ou IA. |

## 2. Mesures du débit de simulation (CPU, sans rendu)

Outil ajouté : `scripts/perf-save-bench.ts`. Il charge une vraie sauvegarde, exécute N ticks macro (10 Core par tick) et produit le temps par tick, la vitesse maximale soutenable et un **SHA-256 de l’état complet** comme preuve de déterminisme.

```bash
npx esbuild scripts/perf-save-bench.ts --bundle --platform=node --format=esm --keep-names --outfile=tmp/perf/bench.mjs
node tmp/perf/bench.mjs public/test-saves/v432/les-forges-crash-test.json 40
PROFILE=tmp/perf/out.cpuprofile node tmp/perf/bench.mjs public/test-saves/v419/les-eclaircies.json 300
node scripts/perf-profile-summary.mjs tmp/perf/out.cpuprofile
```

Rappel : la vitesse ×1 exige 6 ticks macro par seconde, la vitesse ×6 en exige 36.

| Sauvegarde | Avant | Après (6 novembre au matin) | Vitesse max avant → après |
|---|---|---|---|
| Les Forges (80 colons, 7 512 structures, 250×250) | 216 ms/tick | **85 ms/tick (−61 %)** | ×0,77 → **×1,96** : le temps réel ×1 est tenu avec de la marge |
| Les Éclaircies (3 colons, 250×250) | 22,7 ms/tick | **11,7 ms/tick (−48 %)** | ×7,3 → **×14** |
| Les Aulnes intégrées (v394) | 30,4 ms/tick | **15,6 ms/tick (−49 %)** | ×5,5 → **×10,7** |
| Les Aulnes sièges (v224) | 37,8 ms/tick | **21,6 ms/tick (−43 %)** | ×4,4 → **×7,7** |

Les deux versions ont été mesurées sur une machine au repos, l’une après l’autre, sous Node 24. Avec 80 colons, ×3 et ×6 restent hors de portée : la feuille de route ci-dessous indique les prochains leviers.

**Déterminisme.** Après chaque optimisation, l’état sérialisé complet reste identique au bit près à celui du code d’origine. Empreintes : `1bac02a8…9183` pour Les Éclaircies après 300 ticks, `5d2cc273…be53` pour Les Forges après 40 ticks. Les Aulnes intégrées (`e08f51d6…2458`) et Les Aulnes sièges (`b54b0f13…74b1`), 300 ticks chacune, ont aussi été comparées au code d’origine : identiques.

**Tests.** Beaucoup de tests sont obsolètes. Seuls les tests récents (modifiés depuis le 20 octobre) qui touchent les modules modifiés ont été lancés, plus les simulations complètes sur vraies sauvegardes et les tests de rendu concernés : 76 fichiers.

- Ils ont tous été joués sur le code d’origine (worktree de `HEAD`) **et** sur la branche, puis comparés test par test.
- Résultat : **0 régression**. Tous les échecs existaient déjà sur le code d’origine, par exemple des tests qui attendent encore le schéma 297 alors que le jeu est au schéma 301.

## 3. Optimisations appliquées (simulation)

Toutes les optimisations conservent exactement le résultat ; seule la façon de calculer change.

1. **Index partagé des structures** (`structure-navigation.ts`). Il donne l’emprise par case et l’ancre par case.
   - Il est mis en cache par identité du tableau, longueur, premier et dernier élément.
   - Cette clé est exacte parce que type, position et orientation ne sont jamais modifiés en place et que le tableau ne change que par `push` / `splice` ou par remplacement. Tous les sites de mutation ont été vérifiés.
   - Il est utilisé par `doorAt`, `actorStepAllowed`, `furnitureDelay`, `navigationCosts`, `canStandAt`, `captureStandability` et `blockedCells`.
   - `footprintContains ≡ footprintCells` a été vérifié par script pour tous les types et toutes les orientations (632 056 cas, 0 écart).
2. **Planificateur de transport** (`work-planner.ts`). Les faits qui ne dépendent que du tas sont calculés une fois par tas au lieu d’une fois par paire (jusqu’à 32 768 paires par tick). Les tests purs sont évalués du moins cher au plus cher.
3. **Masque de terrain franchissable** (`pathfinding.ts`). Il est revalidé par identité des objets `Tile`, car le terrain n’est jamais modifié en place. Il est réutilisé par la navigation animale.
4. **Topologie des pièces** (`room-topology.ts`). La validation ne rebalaye plus les 62 500 cases ni toutes les structures à chaque lecture de lumière : jeton d’appartenance des structures et identité des tuiles.
5. **Toits** (`roof-rules.ts`, `light-environment.ts`).
   - L’ensemble des cases couvertes est mis en cache ; il était recréé à chaque requête de vitesse d’un colon à l’intérieur.
   - Les trois `Array.includes` sont remplacés par une recherche binaire sur les tableaux triés.
6. **Repousse des plantes sauvages** (`wild-plant-runtime-256.ts`, `actual-plant-spatial-session-256.ts`).
   - Pas de capture spatiale pour une case que `pick()` rejette de toute façon.
   - La part de la capture qui dépend des ressources (≈ 28 000 plantes) est mise en cache par identité du tableau. La population est une surcouche copy-on-write.
7. **Recherche par identifiant et par type** (`structureById`, `structuresOfKind`).
   - 104 recherches linéaires `structures.find(s=>s.id===…)` ont été remplacées, dans 61 fichiers.
   - Le guidage des animaux vers les enclos parcourait 7 512 structures, deux fois par animal et par décision.
8. **Broutage** (`wildlife-food.ts`). Les plantes broutables sont calculées une fois par tick, au lieu d’une fois par animal affamé.
9. **Éclairage et thermique** (`light-sources.ts`, `thermal-topology.ts`, `plant-lighting.ts`, `thermal-plants.ts`).
   - Seules les structures qui émettent de la lumière sont parcourues.
   - La topologie thermique est validée sans construire de chaîne de plusieurs dizaines de Ko.
   - Après un remplacement des ressources, l’éclairage des plantes ne retraite que les plantes nouvelles.
10. **Croissance** (`plants.ts`). Raccourci exact pour les plantes mûres (`growth` égal à 1), qui sont l’immense majorité des plantes sauvages.
11. **Cultures** (`farming.ts`). Les emprises viennent de l’index partagé, et la validation d’une tâche se fait par requête ponctuelle.
12. **Balayages par type** (13 fichiers et `core-physics-297.ts`). Les `structures.some/filter(s=>s.kind==='X')` passent par l’index par type, dans le même ordre. C’est notamment le cas de la capture des acteurs de combat, refaite après chaque pas de déplacement.
13. **Délai de mobilier** (`furnitureDelay`, à chaque pas). Les 1 778 tas des Forges sont parcourus une seule fois, case testée d’abord, au lieu de deux passes qui évaluaient d’abord des conditions de version.
14. **Compteur d’écritures physiques des cases** (`terrainWriteCount`, dans `terrain-mutation-journal.ts`). Le projet impose déjà que toute écriture physique d’une case appelle `markTerrainCellChanged` : même tableau `Tile[]` et même compte prouvent qu’aucune case n’a changé. Deux usages :
    - la topologie des pièces (lumière, propreté, recherche) ne rebalaye plus les 62 500 tuiles à chaque lecture ;
    - la couche de coûts de terrain de `navigationCosts`, environ 6 ms par recherche sur Les Forges, est réutilisée tant que les tuiles ne changent pas.

    La forme des pièces pour la propreté (cases, voisins, ordre d’inondation, cases couvertes) est elle aussi partagée entre lectures. Elle ne dépend que de la topologie et des toits ; la somme des sols est relue à chaque fois, dans le même ordre.

    Le mode `VERIFY_TERRAIN_CACHES=1` du banc recalcule et compare à chaque lecture. Il n’a trouvé aucun écrivain non marqué sur quatre sauvegardes.
15. **Réseau électrique** (`power-topology.ts`). La clé texte de tous les transmetteurs n’est plus reconstruite à chaque lecture : le jeton d’appartenance et l’état des interrupteurs suffisent. La table des 7 512 structures par identifiant est partagée par jeton.
16. **Cases debout** (`captureStandability`). Le masque des structures non franchissables est calculé une fois par géométrie partagée ; seuls les chantiers et les blocs restent lus à chaque appel.

### Architecture

- **Versions de schéma** (`schema-range.ts`). Les 30 prédicats `isSchemaNNNOrLater` et 16 listes `[290,…,301].includes` sont remplacés par une plage numérique `[N, SCHEMA_VERSION]`. Les types sont générés automatiquement, l’équivalence a été vérifiée pour toutes les valeurs, et un test fige le contrat. Une montée de version ne demande plus de modifier ces dizaines de prédicats.
- **Guide d’architecture et de performance** : [architecture-guidelines.md](architecture-guidelines.md).

## 4. Rendu et thread principal

**Client réel, Les Éclaircies**, mesuré dans Chromium sur un vrai GPU (WebGPU), en 1440×1000, avec un build de production ; même protocole pour les deux versions.

| | ×1 : images/s · p95 · p99 | ×6 : images/s · p95 · p99 | Simulation à ×6 |
|---|---|---|---|
| Origine | 147 · 11,3 · 25,8 ms | 113 · 26,4 · 42,9 ms | 34 ticks/s (94 % de la cible) |
| Branche | 160 · 5,7 · 15,9 ms | 118 · 20,7 · 42,2 ms | 38,6 ticks/s (×6 tenu) |

**Saccades restantes à ×6.** Elles venaient de la reconstruction synchrone des chunks de la couche végétation (`ResourceLayer.updateWorldChunks`) : jusqu’à 290 ms d’un coup. Deux corrections, au résultat identique :

- **Budget par image** (`ac7528d5`) : au-delà de 6 ms, les chunks restants sont reportés aux images suivantes ; l’ancienne géométrie reste affichée entre-temps.
- **Reconstruction 2,2 fois plus rapide** (`c0186b8f`). Sur les 16 chunks des Éclaircies, on passe de 3,0 s à 1,3 s, soit 50 à 130 ms par chunk au lieu de 110 à 300 ms :
  - la fusion lit chaque gabarit une fois dans des tableaux simples, au lieu d’un accesseur par instance et par sommet ;
  - les sphères englobantes sont calculées directement sur les positions, avec l’arithmétique exacte de three.js ;
  - les sinus et cosinus du vent sont mémorisés ; 86 % des sommets répètent une phase ;
  - la vérification anti-collision des modèles préparés n’a plus lieu qu’une fois par gabarit.

  Un banc dans la page force la reconstruction de chaque chunk et calcule une empreinte de tous les attributs, index et sphères. Elle est identique avant et après.

Mesure du 6 novembre en fin de nuit, même protocole (fenêtres de 15 s) :

| Les Éclaircies | Images/s | p95 | p99 | Longues tâches | Simulation |
|---|---|---|---|---|---|
| ×1 | 168 | 5,7 ms | 15,7 ms | 0 | 6,5 ticks/s |
| ×6 | 147 | 15,4 ms | 26,1 ms | 2, la plus longue 136 ms (272 ms avant la reconstruction plus rapide) | 35,8 ticks/s |

Il reste une reconstruction de chunk de 50 à 130 ms, rare : elle n’a lieu qu’à l’apparition d’une plante dans le chunk, environ une fois toutes les 25 s à ×6 sur Les Éclaircies. Pour la faire disparaître, il faudrait découper la reconstruction d’un chunk sur plusieurs images, ou la confier à un Worker.

**Les Forges (80 colons), client réel.** À ×1 : 98 images/s, p95 36 ms, 14 longues tâches en 15 s. Le thread principal est saturé (≈ 104 % d’occupation) :

| Poste | Part | Cause |
|---|---|---|
| Rendu three.js | 36 % | Coût par objet (uniformes, matrices) ; passe d’ombre ≈ 6 % |
| Adoption des publications | 18 % | Une publication **complète** de ≈ 630 Ko à chaque tick macro (6,8 par seconde). Copie gelée des acteurs : 9,5 % |
| Application du monde | 12,6 % | Dont la reconstruction du mobilier (≈ 50 ms) quand le nombre de structures change |

Le mode « frontière » (deltas d’acteurs) ne joue presque jamais sur une grande colonie. Chaque tick, au moins une des dépendances de pose capturées pour 80 colons et 241 animaux change : pose de travail, lit, repas, cargaison… La publication complète redevient alors obligatoire. C’est désormais la priorité côté client (voir la feuille de route).

Mesures de l’agent rendu sur Les Forges, faites avant ces corrections, à ×1 :


- **En jeu**, le thread principal est saturé : environ 11,4 à 12 s de travail pour 10 s réelles. Intervalle entre images : moyenne 36,8 ms, médiane 8,4 ms, p95 154 à 179 ms.
- **En pause**, la médiane tombe à 4,2 ms : la boucle de rendu elle-même est saine.

| Poste | Part du thread principal | Cause |
|---|---|---|
| Adoption de chaque publication | ≈ 52 % | Validateurs de sauvegarde relancés sur toute la partie : mousse anti-feu 14 % + 3 %, roman 6 %, enclos 3 % (calculés deux fois)… Copie profonde gelée de tous les acteurs à chaque publication complète (8,8 %). Capture des messages natifs (≈ 11 %, dans des fichiers épinglés par les tests). |
| Rendu three.js | 14 à 16 % | 74 appels de dessin, ≈ 2,2 M de triangles. La passe d’ombre (≈ 234 appels, carte 2048²) est recalculée à **chaque image**. |
| Application du monde | ≈ 9 % | `ResourceLayer.updateWorldChunks` : pics jusqu’à 250 ms quand les plantes changent de stade. |
| Matrices | ≈ 0,4 ms par image | 614 des 764 objets recalculent leur matrice à chaque image, même immobiles. |

Corrections appliquées :

- **Bug : colons invisibles en vue perspective sous WebGPU.** Deux pipelines de shader dépassaient la limite par défaut de 16 variables inter-étages. Le jeu demande désormais la limite réelle de l’adaptateur, avec repli automatique. C’est vérifié dans le navigateur. Fichiers : `webgpu-device-limits.ts` et `ColonyRenderer.ts`.
- **`ResourceLayer`** : la table des ressources (21 000 entrées) était reconstruite pour chaque morceau de carte redessiné ; elle est maintenant construite une fois par mise à jour.
- **`StaticGeometry`** : moins d’allocations à la fusion des instances. Le résultat est identique au bit près.

Non modifié volontairement : le rafraîchissement des ombres à chaque image et le ratio de pixels / MSAA (choix visuels), les validateurs côté thread principal et les fichiers épinglés. Ce sont les prochains gros gains ; voir la feuille de route.

## 5. Écarts avec RimWorld (Core 1.5/1.6)

Une grande partie des règles chiffrées est fidèle : temps, faim, repos, loisirs, beauté, confort, humeur de base, seuils et MTB des crises, déplacement, compétences, vitesses de travail, cultures existantes, températures, santé, combat et Cassandra Classic.

Écarts confirmés, du plus important au moins important :

1. **Pensées de sommeil absentes** : *A dormi dehors*, *sur le sol*, *dans le froid*, *dans la chaleur*, −4 chacune pendant 1 jour.
   - Le début de partie est ainsi d’environ 8 à 12 points d’humeur plus facile que dans RimWorld.
   - Le type `Memory` n’accepte que les souvenirs de repas, validés par version dans `pawn-record-save.ts` et `visitor-save.ts`. Corriger demande donc une montée de schéma (302).
2. **Besoin « Plein air » (Need_Outdoors) absent**, avec les pensées *enfermé*, *fièvre de la cabane*… Ce n’est pas une simple constante : il faut un besoin nouveau, sauvegardé, donc une montée de schéma.
3. **Besoin « Taille de pièce » (Need_RoomSize) absent** : *exigu* −5 / −10, *spacieux* +5.
4. **Pensées de situation manquantes** :
   - obscurité −5 ;
   - nu −6 ;
   - vêtements de mort −5 à −14 ;
   - trempé −3 ;
   - travail passionné +8 / +14 (1.6).
5. **Ordre des types de travail à priorité égale.** `compareCandidate` utilise des rangs ad hoc ; par exemple l’artisanat passe avant la construction et la recherche avant le ménage. RimWorld suit l’ordre naturel de l’onglet Travail : Pompier > Patient > Docteur > Repos > Basique > Gardien > Animaux > Cuisine > Chasse > Construction > Culture > Minage > Coupe > Artisanat > Transport > Ménage > Recherche.
6. **Priorités par défaut.** Ici : 1 / 2 / 3. Dans RimWorld, les priorités manuelles sont désactivées par défaut et tout ce qui est autorisé vaut 3. Conséquence actuelle : un colon blessé ou malade continue de travailler au lieu de se reposer.
7. **Pas de ×12 automatique** quand tous les colons dorment (`TickManager.NothingHappeningInGame`).
8. **Cultures Core manquantes** : fraise, herbe à fumer, psychoïde, soie du diable.
9. ~~**Coût de déplacement**~~ — *à vérifier, probablement fidèle.* L’audit initial annonçait un arrondi entier de `TicksPerMove`. Cet arrondi date d’avant RimWorld 1.5. Le code d’Elsewhere reproduit en float32 `CostToMoveIntoCell` et `CostToPayThisTick` de la version 1.6 (build 4871), paiement fractionnaire compris, aussi bien pour les humains que pour les animaux. L’allure appliquée après le coût de terrain et le plafond de 450 est elle aussi fidèle. Point non retenu.

Ces correctifs n’ont **pas** été appliqués dans ce lot :

- **Points 1 à 4 et 8.** La validation des sauvegardes énumère, version par version, le contenu admis : types de souvenirs, cultures, champs… Tout ajout de contenu impose donc une montée de schéma ; la dernière a touché 129 fichiers. La refonte des prédicats de schéma de cette nuit réduit ce coût. L’étape suivante est de faire accepter par les validateurs le contenu connu des définitions courantes, au lieu de listes figées par version.
- **Points 5 et 6.** Ils changent un comportement que des centaines de tests épinglent au tick près.
- **Point 5.** Il demande de réorganiser la planification en « WorkGivers » ordonnés comme dans RimWorld : type de travail, puis `priorityInType`, puis distance. Ce n’est pas un simple changement de constantes.

## 6. Feuille de route recommandée (par gain attendu)

1. **Publications complètes sur une grande colonie.** Sur Les Forges, une publication complète de ≈ 630 Ko part à chaque tick macro : 6,8 par seconde à ×1. Le thread principal y passe ≈ 30 % de son temps (adoption 18 %, application 12,6 %), dont 9,5 % pour la copie gelée des acteurs. Les essais de partage structurel et de validation plus rapide de cette copie ne gagnent rien : c’est le parcours qui coûte, pas l’allocation. Il faut donc publier moins. Pistes :
   - porter dans le paquet de mouvement les dépendances de pose des acteurs changés (lit, cargaison, repas, pose de travail…), qui forcent aujourd’hui la publication complète ;
   - ou envoyer colons et animaux en deltas par champ : besoins et position changent à chaque tick, compétences, santé et équipement presque jamais.

   Les deux touchent des fichiers épinglés (`core-phase-data-297.ts`, `native-clone-resident.ts`).
2. **Rendu three.js** : environ 36 à 48 % du thread principal en jeu, pour 148 maillages visibles et 72 appels de dessin. Postes :
   - uniformes par objet : 11 % ;
   - passe d’ombre : 6,5 % ;
   - matrices : 6 %. 650 des 830 objets recalculent leur matrice à chaque image, dont 616 maillages invisibles.

   Passer en `matrixAutoUpdate = false` les objets statiques, avec une mise à jour explicite quand ils bougent, est le levier le plus sûr.
3. **Reconstruction d’un chunk de végétation** : encore 50 à 130 ms, mais rare, à l’apparition d’une plante dans le chunk. La découper en plusieurs images (corps, puis usure), ou calculer les tableaux dans un Worker.
4. **Chargement.** Fusionner les validateurs historiques en une seule passe et les sauter pour une sauvegarde au schéma courant produite par le jeu. Potentiel : quelques secondes au lieu de 30 à 140 s.
5. **Simulation, 80 colons (85 ms par tick).** Le profil est désormais plat : planification du travail ≈ 15 % (ménage, chantiers, cuisine), faune ≈ 10 %, déplacement ≈ 16 %, température de surface ≈ 6 %, recherche ≈ 4 %. Ensuite, passer en `TickRare` / `TickLong` ce que RimWorld ne met pas à jour à chaque tick.
6. **Contenu sans montée de schéma** (voir § 5), puis les écarts RimWorld 1 à 4 et 8.
7. **Planificateur en WorkGivers** façon RimWorld (écarts 5 et 6), avec mise à jour des tests.
8. **×12 pendant le sommeil**, une fois le débit suffisant. Le jeu de vitesses publié (`0|1|3|6`) apparaît dans 17 fichiers, dont 2 épinglés.

### Outils de mesure

| Outil | Usage |
|---|---|
| `scripts/perf-save-bench.ts` | Débit de simulation et empreinte d’état ; `PROFILE=…` pour un profil CPU, `VERIFY_TERRAIN_CACHES=1` pour la vérification des caches de terrain |
| `scripts/perf-worker-run.ts` | Worker de production à une vitesse donnée : ticks tenus, publications par seconde et tailles, `FULL_REASONS=1` pour les causes de publication complète |
| `scripts/perf-client-profile.mjs` | Client réel (Chromium, WebGPU) : images/s, percentiles, longues tâches, profils en pause, ×1 et ×6 |
| `scripts/perf-chunk-bench.mjs` | Reconstruction forcée de tous les chunks de végétation, avec empreinte de la géométrie |
| `scripts/perf-profile-classify.mjs` | Longues tâches d’un profil, totalisées par cause |
| `scripts/perf-profile-summary.mjs`, `-callers`, `-callees`, `-lines`, `-longtasks` | Lecture des profils |
