# Audit performance, architecture et fidélité RimWorld — 5 novembre 2026

Branche : `perf/sim-render-audit`. Ce document résume l’état du projet, les mesures, ce qui a été corrigé, et ce qu’il reste à faire, par ordre d’impact.

## Synthèse (6 novembre, matin)

| Mesure | Avant | Après |
|---|---|---|
| Simulation, Les Éclaircies (3 colons) | 22,7 ms/tick, ×7,3 max | **11,5 ms/tick, ×14 max** |
| Simulation, Les Forges (80 colons) | 216 ms/tick, ×0,77 max | **81,5 ms/tick, ×2,0 max** |
| Simulation, Les Aulnes intégrées | 30,4 ms/tick | **15,6 ms/tick** |
| Simulation, Les Aulnes sièges | 37,8 ms/tick | **21,6 ms/tick** |
| Client réel, Les Éclaircies à ×6 | 34 ticks/s (×6 non tenu), 113 im/s, p95 26 ms | **38 ticks/s (×6 tenu), 150 im/s, p95 11 ms** |
| Plus longue tâche, Les Éclaircies à ×6 | 290 ms | **136 ms**, et rare |
| Client réel, Les Forges à ×1 | p95 154 à 179 ms (mesure de l’agent rendu) | **p95 28 ms**, 107 im/s, temps réel tenu |
| Client réel, Les Forges à ×6 | — | **9,5 ticks/s** (6,7 avant les publications allégées) |
| Adoption d’une publication complète, Les Forges à ×1 (client réel) | 98 ms en moyenne, pics de 250 à 330 ms à chaque construction ou plante ajoutée | **≈ 65 ms**, pics des ressources ≤ 24 ms, mur ajouté ≈ 15 ms |
| Publications complètes, Les Forges à ×1 (Worker seul) | 6,8 par seconde (≈ 630 Ko chacune) | **≈ 1,9 par seconde** (≈ 3 avant les patchs de cargaison) |
| Chargement des Éclaircies (navigateur, profil neuf) | 119 s, panneau « Opération en attente » à 16 s | **64 s**, barre de progression, plus de panneau |
| Chargement d’une sauvegarde au schéma actuel (Éclaircies / Les Forges) | 78 / 82 s | **39 à 46 / 41 s** |
| Nouvelle partie, de « Générer » au jeu affiché | 116 à 121 s | **48 s** |
| Panne « Shared World/settings/camera/paint changed before publication » en jeu | en 1,2 s, caméra en mouvement à ×6 | **aucune** en 150 s |
| Gels d’affichage pour préparer des surfaces en jeu (×6, 60 s) | 105, 1,5 s gelée au total | **18**, 0,37 s |

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
| Les Forges (80 colons, 7 512 structures, 250×250) | 216 ms/tick | **81,5 ms/tick (−62 %)** | ×0,77 → **×2,0** : le temps réel ×1 est tenu avec de la marge |
| Les Éclaircies (3 colons, 250×250) | 22,7 ms/tick | **11,5 ms/tick (−49 %)** | ×7,3 → **×14** |
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
17. **Grille de blocage** (`blockedCells`, appelée par chaque déplacement et chaque planification). L’union du masque de terrain et des cases de structures pleines est calculée une fois par géométrie partagée. Chaque appel la copie, puis ajoute les portes interdites et les chantiers, qui sont des faits vivants.
18. **Navigation animale.** Les cases de murs, clôtures, bouches et climatiseurs viennent d’un masque partagé par géométrie, au lieu d’un `Set` reconstruit à chaque tick et pour chaque variante de navigation.
19. **Éclairage local** (`LocalLightCache`). La clé texte des 144 lampes des Forges était reconstruite à chaque lecture. Elle est remplacée par une comparaison champ par champ, d’égalité strictement identique.

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

**Les Forges (80 colons), client réel.** À ×1 : 96 à 98 images/s, p95 36 ms, 14 longues tâches en 15 s. Le temps réel est tenu : 6,5 ticks/s pour 6 demandés. Le thread principal est saturé (≈ 104 % d’occupation) :

| Poste | Part | Cause |
|---|---|---|
| Rendu three.js | 36 % | Coût par objet (uniformes, matrices) ; passe d’ombre ≈ 6 % |
| Adoption des publications | 18 % | Une publication **complète** de ≈ 630 Ko à chaque tick macro (6,8 par seconde). Copie gelée des acteurs : 9,5 % |
| Application du monde | 12,6 % | Dont la reconstruction du mobilier (≈ 50 ms) quand le nombre de structures change |

Le mode « frontière » (deltas d’acteurs) ne joue presque jamais sur une grande colonie. Chaque tick, au moins une des dépendances de pose capturées pour 80 colons et 241 animaux change : pose de travail, lit, repas, cargaison… La publication complète redevient alors obligatoire. C’est désormais la priorité côté client (voir la feuille de route). *Mesure faite avant les publications allégées décrites ci-dessous.*

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

### Publications allégées sur les grandes colonies (6 novembre, matin)

Sur Les Forges, le Worker publiait la partie complète (≈ 630 Ko) à presque chaque tick macro. Mesures de cause, sur 30 ticks : 28 publications provoquées par les poses, et à l’intérieur des ticks une vingtaine de publications « dures » dues aux traces de pas et aux portes. Chaque publication coûte une copie de tous les acteurs des deux côtés.

Les changements, sans effet sur la simulation (empreintes inchangées) :

1. **Patch de pose.** Quand, d’un tick à l’autre, seules la pose de contact et la pose d’animation de certains colons changent (`poseOnlyDependencyChanges297`), le paquet frontière porte `poses297`. Chaque patch contient l’enregistrement complet du colon, sa tâche, et la pose de contact calculée par le Worker sur le monde vivant : pose de travail, décalage, orientation vers la cible.
   L’affichage relance alors sa mise à jour des colons, celle d’une publication complète, sur une vue « monde publié, colons à jour, tâches transmises ».
2. **Patch de porte.** Une porte qui s’ouvre ou se ferme est transmise dans `doors297` (`open`, `from`, `changedAt`) au lieu d’imposer une publication complète.
   - Repasser par une porte déjà ouverte ou prolonger son délai de fermeture ne change rien de visible : ce n’est plus signalé.
   - Seule une porte qui dissipe réellement du brouillard reste une barrière dure.
3. **Changements différés.** Ces changements sont publiés par la prochaine publication calme (au plus toutes les 250 ms), comme les autres changements lents du monde :
   - traces de saleté et neige foulée ;
   - abandon d’une promenade d’oisiveté ;
   - identifiants alloués à autre chose qu’un projectile.
4. **Acteurs inchangés non renvoyés.** À chaque tick, tous les acteurs étaient renvoyés ; seuls ceux dont les champs physiques ont changé le sont désormais.

Les patchs s’accumulent côté affichage jusqu’à la publication complète suivante, qui les remplace. Hors du mode frontière, toutes les anciennes barrières sont conservées.

**Vérification dans le client réel** (Les Forges, ×1, 30 s), en comparant chaque patch avec ce que calcule la publication complète suivante :

- 142 colons patchés sont restés sur la même case, dans le même état et sur la même tâche. Leurs positions cibles, décalage de contact compris, et leurs poses de travail sont **identiques**. Seule l’orientation des colons en mouvement ou oisifs diffère : leur cap évolue entre les deux instants.
- 22 portes patchées : état (`open`, `from`, `changedAt`) **identique** dans les 22 cas.
- Aucun arrêt ni défaut graphique sur Les Éclaircies (×1, ×6) ni sur Les Forges (×1, ×6).

Fichiers épinglés modifiés volontairement, avec mise à jour de leur empreinte :
- `core-phase-data-297.ts` : le lecteur strict valide `poses297` et `doors297`, et accepte en mode frontière des allocations non expliquées par un projectile ;
- `core-movement-297.ts` : sépare les changements différés et les portes.

| Les Forges | Avant | Après |
|---|---|---|
| Worker seul, ×1 | 79 à 86 % du temps réel, 6,8 publications complètes/s | **98 %**, ≈ 3/s |
| Worker seul, ×3 | ≈ 4,3 ticks/s | **≈ 7,5 ticks/s** |
| Client réel, ×1 | 96 im/s, p95 36 ms | **107 im/s, p95 28 ms** |
| Client réel, ×6 | 6,7 ticks/s, p95 33 ms | **9,5 ticks/s, p95 21 ms** |
| Paquet de phase moyen | ≈ 120 Ko | ≈ 75 Ko |

Côté thread principal, l’adoption des publications complètes est passée de 13,9 % à 7,8 % du temps. Le thread reste saturé à ×1 sur Les Forges :
- le rendu prend environ 36 % ;
- la désérialisation et la copie défensive des paquets de phase environ 7 %, dans un fichier épinglé ;
- l’application du monde environ 12 %.

### Patchs de cargaison (7 novembre)

Après les patchs de pose et de porte, la dernière dépendance d’acteur qui imposait encore des publications complètes sur Les Forges était la cargaison des colons : environ 2,2 par seconde à ×1. Ramasser ou déposer un objet change à la fois le tas porté et les tas au sol.

Les changements, sans effet sur la simulation (empreinte des Éclaircies inchangée) :

1. **Patch de tas** (`piles297`). Quand le tas porté d’un colon change, le paquet frontière suivant porte l’enregistrement complet de chaque tas dont la présentation diffère de ce que l’affichage détient, et les identifiants des tas disparus.
   - Le Worker garde une copie des tas tels qu’envoyés : prise à la publication complète, mise à jour à chaque patch envoyé.
   - La comparaison ignore seulement l’horloge de pourriture (`rot`). Elle avance sur environ 320 denrées par seconde et n’est lue que par l’inspection, qui lit la publication complète.
2. **Affichage.** Une vue « publication complète + tas patchés » suit les mêmes étapes qu’une adoption complète :
   - animation de prise et de dépose ;
   - mise à jour incrémentale des morceaux de tas : seuls les tas remplacés sont recalculés ;
   - cargaison des colons.

   La publication complète suivante reprend les animations depuis les derniers tas affichés : aucune animation n’est rejouée.
3. **Âge maximal du monde publié** (500 ms). À ×6 sur une grande colonie, le Worker est saturé et ses lots sont longs. Les publications calmes ne partent qu’en fin de lot : sans les publications dures de cargaison, elles tombaient à 0,1 par seconde dans la simulation du Worker. En mode frontière, une publication calme part désormais dès que le monde publié a 500 ms, même au milieu d’un lot.

**Défaut corrigé pendant le développement.** La première version recalculait les supports des tas (7 512 structures) à chaque patch : 5,4 ms en moyenne, jusqu’à 80 ms. Le patch utilise maintenant les supports déjà préparés, comme une adoption complète : 0,5 ms en moyenne, 1 ms au plus.

**Vérification dans le client réel**, en comparant chaque colon patché avec la publication complète suivante, lorsque son tas porté est resté le même :

| Partie | Colons comparés | Cargaison identique (type et taille) |
|---|---|---|
| Les Forges ×1, 30 s | 212 | 212 |
| Les Forges ×6, 25 s | 186 | 186 |
| Les Éclaircies ×1 et ×6 | 34 | 34 |

Aucune animation de prise ou de dépose rejouée en double, aucune erreur.

**Mesures, Les Forges.** Worker seul (Node, 20 s) :

| | Avant | Après |
|---|---|---|
| ×1, publications complètes | 2,8/s | **1,9/s** |
| ×1, paquets d’acteurs | 5,4/s | **6,9/s** |
| ×6, publications complètes | 2,5/s | **1,5/s** |
| ×6, paquets d’acteurs | 4,3/s | **5,5/s** |

Client réel, deux passes par build, avec une machine chargée par d’autres applications :

| | Avant | Après |
|---|---|---|
| ×1, publications complètes adoptées | 1,6 à 1,75/s | 1,3 à 1,45/s |
| ×1, application des publications et des paquets | ≈ 13,8 % du thread principal | ≈ 14,2 % |
| ×6, publications complètes adoptées | 1,05 à 1,45/s | 0,95 à 1,3/s |

Dans le client, le gain reste faible : chaque patch de tas coûte environ 5 ms au thread principal, ce qui compense une partie des publications évitées. Le gain net est côté Worker.

Ces mesures confirment surtout le coût d’une publication complète pour le thread principal sur Les Forges : environ 75 ms d’application (`applyWorld`), jusqu’à 250 ms, plus l’admission du message (`drainFrame`, 13 à 17 % du temps du thread). Ces pics sont des micro-gels. Réduire ce coût est désormais le levier principal, devant le nombre de publications.

Fichier épinglé modifié volontairement, avec mise à jour de son empreinte : `core-phase-data-297.ts`, dont le lecteur strict valide `piles297`.

### Coût d’adoption d’une publication complète (7 novembre, après-midi)

**Mesure.** Le temps de chaque étape d’`applyWorld` a été relevé dans le client réel, publication par publication (Les Forges, ×1, 30 s) : 36 adoptions, 98 ms en moyenne, médiane 65 ms, maximum 331 ms. La première source des pics était la reconstruction des structures : 9 adoptions sur 36, 101 ms en moyenne, jusqu’à 251 ms. Le mobilier de toute la carte forme un seul lot de 15 139 pièces ; il était entièrement recalculé dès qu’une structure changeait. Sur 40 s, les 9 reconstructions avaient toutes la même cause : un colon terminait un sac de sable.

**1. Raccourci pour les types dessinés hors du mobilier.** Les sacs de sable sont dessinés par leur propre lot, et aucun des 40 producteurs du mobilier ne les lit.
- La signature des structures enregistre maintenant les types des structures changées depuis la dernière reconstruction du mobilier.
- Si ce sont uniquement des sacs de sable, seul leur lot est refait.
- Tout autre changement garde la reconstruction complète : autre type, insertion au milieu du tableau, axes des portes, mobilier emballé, réinitialisation, vue coupée, lot non possédé, ou lampe solaire qui a changé d’état.

Garde : `tests/furniture-independent-kinds.test.ts`. Plus de 300 sacs de sable collés à 45 types de structures (murs, portes, clôtures, enclos, conduits, ventilations, lits…) ne changent aucune pièce du mobilier, en vue normale comme en vue coupée, à l’ajout comme au retrait.

**2. Jeton d’appartenance des structures.** La topologie des pièces et la liste des lampes demandaient un jeton qui construisait l’index partagé des structures. Côté thread principal, chaque publication complète apporte un nouveau tableau de structures : l’index (~8 ms sur Les Forges) était construit pour rien. C’est le cas de l’info-bulle de survol de la carte, qui calcule la lumière de la case survolée.

Le jeton n’est maintenant utilisé que si l’index existe déjà ; sinon le balayage, moins coûteux, est fait directement. Empreintes des Éclaircies et des Forges inchangées ; temps par tick de la simulation inchangé à la précision de la mesure.

**Vérification dans le client réel.** Après 40 s de jeu, dont 10 passages par le raccourci, les lots du mobilier (15 139 pièces) et des sacs de sable (65) sont identiques octet par octet (matrices et couleurs) à une reconstruction complète forcée. Aucune erreur.

**Mesures**, Les Forges ×1, comparées au commit précédent dans les mêmes conditions, 2 passes de 40 s par build :

| Par adoption complète | Avant | Après |
|---|---|---|
| Moyenne | 86,8 / 86,5 ms | **71,1 / 73,0 ms** |
| Médiane | 61 / 58 ms | 61 / 59 ms |
| Reconstruction des structures, cumul sur 40 s | 944 / 779 ms | **112 / 123 ms** |
| Lumière de la case survolée, monde reçu (hors navigateur) | médiane 9,6 à 20 ms | **4,3 à 5,1 ms** |

**Ce qui reste.** Le pic maximal reste vers 190 à 225 ms.
- Il vient surtout des morceaux de ressources : un ajout de plante (semis, repousse) reconstruit tout le morceau de carte concerné, 50 à 118 ms, dont la fusion des géométries et l’usure des arêtes. Les retraits sont déjà traités sans reconstruction.
- Une vraie construction (mur, meuble) reconstruit encore tout le mobilier, ~100 ms.

Rendre ces deux reconstructions incrémentales demande de découper leurs lots par zone de la carte : c’est la prochaine étape, plus profonde.

### Mobilier par zones et ajouts de ressources à part (7 novembre, soir)

Les deux reconstructions qui restaient sont maintenant limitées à ce qui change.

**1. Mobilier par zones.** Le lot unique du mobilier est rangé par zones de 32 × 32 cases (`furniture-zones.ts`). Chaque zone contient ses pièces, dans l’ordre historique des producteurs, suivies de places réservées : des pièces invisibles de 0,1 mm, 1 m sous le sol, au moins 8 par zone ou un huitième de ses pièces. Le lot reste un seul maillage, donc un seul appel de dessin.

Quand des structures changent :
- les zones à moins de 2 cases d’une structure modifiée, ajoutée ou retirée sont recalculées, en un seul passage, avec le monde complet comme contexte. S’y ajoutent les zones des appareils alimentés par une structure modifiée (fil d’alimentation) ;
- seules les pièces qui diffèrent sont écrites sur le GPU.

La portée de 2 cases couvre les seuls producteurs qui regardent leurs voisins : portes (murs adjacents), enclos (clôtures adjacentes) et électricité (conduits adjacents et fil vers la structure qui alimente). Tous les autres ne lisent que leur propre structure, et uniquement des champs suivis par la signature des structures.

La reconstruction complète reste faite dans ces cas : réinitialisation, vue coupée, autre lot, lampe solaire qui change d’état, zone qui déborde de ses places réservées, première pièce dans une zone vide.

**Vérification du découpage**, hors navigateur, sur 4 parties de référence (Les Forges, Les Éclaircies, Les Aulnes intégrées et sièges), en vue normale et coupée : chaque zone calculée seule donne exactement les mêmes pièces, dans le même ordre, que la reconstruction complète restreinte à la zone. C’est vrai même sans marge de voisins.

**2. Ajouts de ressources à part.** Une plante ou un arbre qui apparaît (semis, repousse) dans un morceau dont les autres membres n’ont pas changé d’identité va dans un morceau compagnon (`Resources x:z+`), reconstruit seul. Le morceau principal se contente de redimensionner ou de masquer.
- Le compagnon est fondu dans son morceau, par une reconstruction complète, au-delà de 24 ressources, à un changement d’identité ou à une mise à jour complète.
- Ses maillages passent par le même compilateur statique que les autres : pas d’appel de dessin supplémentaire, sauf ceux de l’usure des arêtes.

**Vérifications dans le client réel.**
- **Mobilier.** Après chaque session (Les Forges ×1, Les Aulnes ×3, Les Éclaircies ×3), les pièces visibles des lots du mobilier et des sacs de sable (matrices et couleurs) sont identiques à une reconstruction complète forcée.
- **Ressources.** Les Forges ×1, 60 s : 28 morceaux compagnons construits, 9 compagnons actifs à la fin. Les triangles visibles, ressource par ressource, sont comparés à une reconstruction complète de tous les morceaux : 1 162 556 triangles des deux côtés. 23 ressources sur 11 767 diffèrent d’au plus 0,0001 unité. Elles sont toutes dans des morceaux principaux, sur des plantes en croissance : c’est le redimensionnement existant, pas le compagnon.
- **Erreurs.** Aucune.

**Tests.** Nouveau `tests/furniture-zones.test.ts` : changements à cheval sur des frontières de zones (mur contre une porte, clôtures, conduits, alimentation), retrait au milieu du tableau, colis de meuble, débordement, zone vide, réinitialisation, vue coupée. Chaque étape est comparée, pièce par pièce, à l’oracle historique disposé par zones.

Oracles adaptés au nouveau découpage, sans retirer d’assertion :
- `furniture-resident-presentation`, `furniture-box-batches`, `graphics-style-common-objects` et `furniture-independent-kinds` comparent le lot à `laidOut` (placements historiques disposés par zones, places réservées comprises) ;
- `resource-deltas-v97` compare, ressource par ressource, les triangles dessinés avec la mise à jour complète (avant : égalité de structure du graphe de scène) ;
- `resource-partition-v429` cherche la plante née dans son morceau ou son compagnon.

Les deux tests de ressources adaptés passent aussi sur le code d’origine. Sur 173 fichiers comparés à la base, aucun échec propre à la branche hors ces adaptations. Seule exception : le test des pots de fleurs des Aulnes, qui dépasse son délai de 20 s sur la machine actuelle comme sur le code d’origine ; ses assertions passent avec un délai plus long.

**Mesures**, Les Forges ×1, comparées au commit précédent, 2 passes de 40 s par build :

| | Avant | Après |
|---|---|---|
| Adoption d’une publication complète, moyenne | 78,7 / 82,2 ms | **66,2 / 68,7 ms** |
| Ressources, coût moyen par adoption | 18,9 / 18,0 ms | **4,4 / 4,5 ms** |
| Ressources, pire cas | 154 / 116 ms | **20 / 24 ms** |
| Ajout d’un mur en acier (mesure ciblée dans le navigateur) | ~100 ms (tout le mobilier) | **13 à 16 ms** |

Le pire cas restant (~220 ms) est la toute première mise en place du mobilier après un chargement. Les postes suivants sont diffus, de 5 à 11 ms en moyenne chacun : tas, cultures, propreté.

**Régression d’une nuit précédente corrigée côté test.** `tests/prison-break-combat-v269.test.ts` transformait une porte en mur en modifiant l’objet sur place. Cela viole le contrat de l’index partagé des structures : le type et la position d’une structure ne changent jamais sur place. Le test remplace maintenant le tableau, comme la simulation, et ses assertions sont inchangées. Il passe sur la branche et sur le code d’origine.

### Lancement d’une partie (7 novembre, nuit)

**Constat.** Au lancement d’une partie, le joueur attendait près de deux minutes. Le panneau « Opération en attente » apparaissait dès qu’une requête dépassait 15 s : chargement d’une ancienne sauvegarde ou création de colonie.

**Mesures.** Build de production instrumenté, Chromium avec WebGPU, profil de navigateur neuf (sans cache de shaders), même machine.

| Étape (chargement des Éclaircies, schéma 263) | Avant | Après |
|---|---|---|
| Worker : lecture, montée de 38 versions, vérification, première publication | 26 s | 24 s |
| Création du rendu | 3 s | 4 s |
| Première adoption du monde (`setWorld`) | 7 s | 6 s |
| Peinture des arbres et des roches | 20 s | **7,5 s** |
| Compilation des matériaux de la scène | 32,5 s | **11 s** |
| Personnages, 1re variante, avec le premier passage d’ombres | 29 s | **14 s** |
| Autres variantes des personnages, ombres finales | 9 s | 8 s |
| **Total** | **119 s** | **75 s** |

Nouvelle partie : 116 à 121 s avant, **72 s** après (planète 11 s, carte 10 s, affichage 51 s au lieu de 96 s).

Un second lancement, avec le cache de shaders du navigateur déjà rempli, ne gagnait que 24 s avant ce lot : l’essentiel du coût est la construction des shaders en JavaScript (TSL vers WGSL), pas leur compilation par le pilote.

**Cause principale.** Three.js r186 compile les objets un par un : il construit le shader d’un objet, puis attend que le GPU ait créé son pipeline avant de passer à l’objet suivant. Le processeur et le GPU ne travaillent donc jamais en même temps : environ 45 s d’attente pure sur Les Éclaircies.

**Corrections.**
1. **Compilation recouverte.** `ReentrantRenderer.compileAsync` laisse Three parcourir les mêmes objets, dans le même ordre, avec les mêmes programmes et pipelines. Il rassemble seulement les promesses de création de pipeline et les attend une seule fois, à la fin de l’appel. Les rendus ordinaires gardent la création synchrone.
2. **Échauffement des ombres en parallèle.** Les passages d’ombres cachés, un par variante de corps des personnages, créaient leurs pipelines de façon synchrone, un par un dans le processus GPU. Ils les créent maintenant en asynchrone, en parallèle (`renderWarmingPipelines`). Un objet dont le pipeline n’est pas prêt n’est pas dessiné pendant ce passage invisible : c’est la vérification de Three lui-même. Le dernier passage d’ombres reste un rendu ordinaire et réenregistre les lots retenus du paysage (`landscape.needsUpdate`) avec des pipelines prêts.
3. **Validation des sauvegardes indexée.** Les vérifications par case (chantier sur une structure, piles sur une étagère, occupation du sol) lisent un index des structures par case au lieu de parcourir toutes les structures. Les Forges en Node : 92 s → 68 s. Mêmes verdicts : une structure hors carte fait revenir aux parcours d’origine.

**Exactitude.**
- Les Forges et Les Éclaircies, chargées puis réécrites : **identiques à l’octet** au code d’origine, avec et sans suivi de progression.
- Les Éclaircies chargées dans le navigateur : terrain, ombres, structures et personnages affichés, aucune erreur.

**Barre de progression.**
- **Worker.** Un message `operation-progress` signale chaque étape atteinte : lecture, montée de version (*i* / *N*), vérification, restauration, publication. La création de colonie garde ses étapes de génération de carte et ajoute vérification et publication. Ces messages ne répondent jamais à la requête et ne disent rien de son résultat.
- **Client.** Chaque progrès réarme le délai de 15 s de la requête. Une requête déjà signalée en attente repasse « en cours ». Le panneau d’attente n’apparaît plus que si le Worker cesse de signaler son avancement pendant 15 s. Pendant un lancement, cet avertissement s’affiche dans la page de chargement, avec le bouton « Arrêter la simulation ».
- **Affichage.** `SceneRenderCore.preparationProgress` signale peinture des surfaces, compilation (objets compilés / total), variantes des personnages et ombres. Le thread principal laisse passer une image avant chaque long travail synchrone, pour que l’écran se mette à jour.
- **Page de chargement native** (`native-launch.ts`, modèle `launch-progress.ts`) : barre globale pondérée par les durées mesurées, sous-barre de l’étape en cours, étape et détail, liste des étapes cochées, temps écoulé. L’interface HTML historique affiche un panneau simple équivalent.
- **Génération de la planète** (menu « Nouvelle partie ») : barre et libellés en français, au lieu des noms internes des phases.

**Ce qui reste**, par gain attendu :
- **Faune.** Chacune des 53 espèces a son propre shader (≈ 250 ms de construction) et sa variante d’ombre, compilés au chargement même pour les espèces absentes : 15 seulement sont présentes sur Les Éclaircies. Partager un même shader de squelette entre espèces (proportions en données plutôt qu’en code) supprimerait l’essentiel de ce coût. L’autre option, compiler les espèces absentes après l’affichage, réintroduit un risque de saccade à l’arrivée d’une nouvelle espèce.
- **Variantes des personnages.** Six variantes de corps sont compilées, avec leurs ombres ; une ou deux seulement servent au réglage graphique courant.
- **Anciennes sauvegardes.** La montée de version revalide la sauvegarde complète à chaque version : 24 s pour Les Éclaircies, 57 s pour Les Forges dans le navigateur. Fusionner ces validations demande l’accord du projet, qui exige de valider strictement chaque ancien schéma avant sa migration.
- **Première adoption du monde** (6 s) et **création du rendu** (3 à 4 s).

### Panne d’affichage en pleine partie, puis second lot de chargement (7 novembre, nuit)

**Panne « Affichage interrompu ».** En jeu, quand de nouveaux arbres, plantes ou animaux demandent une préparation de leurs surfaces partagées, la préparation vérifiait avant publication que la caméra n’avait pas bougé. Un simple déplacement pendant ce travail asynchrone l’annulait, et l’annulation remontait comme une panne : « Shared World/settings/camera/paint changed before publication ». Reproduit dans le navigateur en 1,2 s (Les Éclaircies ×6, caméra en mouvement).

Correction :
- les surfaces préparées dépendent de la densité (mode de projection, pixels physiques par case), déjà vérifiée à part, pas de l’endroit où regarde la caméra : la position n’est plus comparée ;
- une préparation devenue obsolète lève `SurfacePreparationSuperseded` (nouvelle demande, densité, réglage, peinture, modèle d’acteur, cohorte d’arbres). L’admission du monde annule ses étapes et recommence depuis l’état courant, jusqu’à 8 fois de suite, puis à l’image suivante. Les autres erreurs arrêtent toujours l’affichage.

Vérifié : 150 s à ×6 avec caméra en mouvement et zooms, 144 préparations, aucune panne. Nouveau test `surface-preparation-supersession`.

**Gels d’affichage en jeu.** Chaque préparation de surfaces suspend les images. L’atlas du corps des colons (style Gouache) est refusé pour tous les colons dès qu’une pose n’est plus rigide (travail au sol, accroupi), puis réadmis : environ deux préparations par seconde à ×6.
- Le passage d’une pose rigide à une pose déformée revient au rendu Source tout de suite, mais seulement si l’atlas est réellement dessiné.
- Le retour à l’atlas attend 6 s de poses rigides stables, et seulement dans le style Gouache qui le cuit. Le style par défaut ne prépare plus rien sur un changement de pose.

Les Éclaircies ×6, 60 s : 105 gels → 18, 1,5 s → 0,37 s de temps gelé ; préparations de l’atlas des colons 125 → 1. Nouveau test `body-atlas-pose-hysteresis`.

**Second lot de chargement.** Pour une sauvegarde au schéma actuel, le Worker prend 8 à 11 s ; tout le reste est la préparation de l’affichage.

| Coupe | Effet mesuré |
|---|---|
| Espèces animales absentes de la carte compilées plus tard (38 sur 53 aux Éclaircies) | compilation de la scène 15 → 3 s, premier passage d’ombres 20 → 11 s |
| Six variantes de corps des colons compilées ensemble, un seul échauffement des ombres | variantes 13 → 10 s, ombres finales 0,7 → 0 s |
| Rendu créé pendant le chargement par le Worker | 4 à 6 s masquées |

Détails :
- **Espèces absentes.** Au chargement, seules les espèces présentes sont préparées. Les autres sont compilées ensuite, une par une, sur une doublure détachée qui partage les attributs du squelette : même clé de cache, rien n’est dessiné. Cette compilation ne tourne que si la partie est en pause et la caméra immobile depuis une seconde, car chaque espèce coûte des images. Vérifié : après l’échauffement, la première apparition d’une espèce absente ne reconstruit ni son corps ni son feu. Une espèce qui apparaît avant son tour est compilée à sa première apparition, comme avant ; son ombre l’est toujours à ce moment.
- **Variantes des colons.** Chaque variante passe par une doublure qui partage la géométrie du corps ; le corps garde son propre matériau. Le test v331 vérifie le nouveau protocole : chaque variante, les deux caméras, un seul échauffement des ombres qui les couvre toutes, état du corps restauré après un échec.
- **Rendu anticipé.** Le rendu ne dépend pas du monde : il est créé dès le début du chargement d’une première colonie.

| Lancement (navigateur, profil neuf) | Avant ce lot | Après |
|---|---|---|
| Les Éclaircies, schéma actuel | 78 à 85 s | **39 à 46 s** |
| Les Forges, schéma actuel | 82 s | **41 s** |
| Les Éclaircies, ancienne sauvegarde (schéma 263) | 75 s | **64 s** |
| Nouvelle partie | 72 s | **48 s** |

La machine varie d’environ 15 % d’une passe à l’autre. À ×1, les 40 premières secondes de jeu n’ont pas plus d’images au-dessus de 50 ms qu’avec l’échauffement désactivé.

**Ce qui reste au lancement**, sauvegarde au schéma actuel : adoption du monde 5 à 7 s, préparation des surfaces avec une compilation complète de la scène 8 à 11 s, passage d’ombres 9 à 10 s.

**En jeu, Les Forges ×1** (profil du client réel) :
- rendu Three.js : environ 39 % du fil principal ;
- adoption des publications du Worker : environ 16 %. Copie défensive des paquets de phase (`frozenDataCopy297`) et lecture des phases (`readCorePhaseData297`), fichiers épinglés ;
- application du monde : environ 12 %.

Seuls 9 shaders sont construits en 25 s de jeu.

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

1. **Coût d’une publication complète sur le thread principal** (voir « Patchs de cargaison »). Sur Les Forges, environ 75 ms d’application par publication, jusqu’à 250 ms, plus l’admission du message. Il en reste 1,3 à 1,5 par seconde, presque toutes calmes ; les autres changements de dépendances (lit, repas, loisirs…) n’en provoquent plus que 0,1 par seconde.

   Prochaines étapes :
   - ~~profiler `applyWorld`~~ et ~~rendre incrémentaux le mobilier et les ajouts de ressources~~ : fait, voir « Coût d’adoption d’une publication complète » et « Mobilier par zones ». Restent des postes diffus de 5 à 11 ms par adoption : tas, cultures, propreté ;
   - rendre la copie défensive des paquets de phase moins coûteuse (`native-message-capture.ts`, épinglé) ;
   - ensuite seulement, adapter l’intervalle des publications calmes à leur coût réel : c’est un compromis avec le délai d’affichage des changements lents du monde.
2. **Rendu three.js** : environ 36 à 48 % du thread principal en jeu, pour 148 maillages visibles et 72 appels de dessin. Postes :
   - uniformes par objet : 11 % ;
   - passe d’ombre : 6,5 % ;
   - matrices : 6 %. 650 des 830 objets recalculent leur matrice à chaque image, dont 616 maillages invisibles.

   Passer en `matrixAutoUpdate = false` les objets statiques, avec une mise à jour explicite quand ils bougent, est le levier le plus sûr.
3. **Reconstruction d’un chunk de végétation** : encore 50 à 130 ms, mais rare, à l’apparition d’une plante dans le chunk. La découper en plusieurs images (corps, puis usure), ou calculer les tableaux dans un Worker.
4. **Chargement.** Fait en grande partie (voir « Lancement d’une partie » et « Second lot de chargement ») : 39 à 46 s pour une sauvegarde au schéma actuel des Éclaircies, contre 119 s au départ, avec une barre de progression. Restent, par gain attendu :
   - le passage d’ombres de la scène (9 à 10 s) et la compilation complète faite pendant la préparation des surfaces (8 à 11 s) ;
   - l’adoption du monde (5 à 7 s) ;
   - avec l’accord du projet, la fusion des validations historiques (24 à 57 s pour une ancienne sauvegarde).
5. **Simulation, 80 colons (81,5 ms par tick).** Le profil est désormais plat : planification du travail ≈ 15 % (ménage, chantiers, cuisine), faune ≈ 10 %, déplacement ≈ 16 %, température de surface ≈ 6 %, recherche ≈ 4 %. Ensuite, passer en `TickRare` / `TickLong` ce que RimWorld ne met pas à jour à chaque tick.
6. **Contenu sans montée de schéma** (voir § 5), puis les écarts RimWorld 1 à 4 et 8.
7. **Planificateur en WorkGivers** façon RimWorld (écarts 5 et 6), avec mise à jour des tests.
8. **×12 pendant le sommeil**, une fois le débit suffisant. Le jeu de vitesses publié (`0|1|3|6`) apparaît dans 17 fichiers, dont 2 épinglés.

### Outils de mesure

| Outil | Usage |
|---|---|
| `scripts/perf-load-profile.ts` | Chargement d’une sauvegarde par le vrai Worker, en Node : durée et étapes signalées, profil CPU optionnel |
| `scripts/perf-newgame-profile.ts` | Nouvelle partie par le vrai Worker, en Node : génération de la planète, du site et de la colonie, étapes et profil |
| `scripts/perf-save-bench.ts` | Débit de simulation et empreinte d’état ; `PROFILE=…` pour un profil CPU, `VERIFY_TERRAIN_CACHES=1` pour la vérification des caches de terrain |
| `scripts/perf-worker-run.ts` | Worker de production à une vitesse donnée : ticks tenus, publications par seconde et tailles, `FULL_REASONS=1` pour les causes de publication complète |
| `scripts/perf-client-profile.mjs` | Client réel (Chromium, WebGPU) : images/s, percentiles, longues tâches, profils en pause, ×1 et ×6 |
| `scripts/perf-chunk-bench.mjs` | Reconstruction forcée de tous les chunks de végétation, avec empreinte de la géométrie |
| `scripts/perf-profile-classify.mjs` | Longues tâches d’un profil, totalisées par cause |
| `scripts/perf-profile-summary.mjs`, `-callers`, `-callees`, `-lines`, `-longtasks` | Lecture des profils |
