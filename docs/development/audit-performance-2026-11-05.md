# Audit performance, architecture et fidélité RimWorld — 5 novembre 2026

Branche : `perf/sim-render-audit`. Ce document résume l’état du projet, les mesures, ce qui a été corrigé, et ce qu’il reste à faire, par ordre d’impact.

## Synthèse (6 novembre, matin)

| Mesure | Avant | Après |
|---|---|---|
| Simulation, Les Éclaircies (3 colons) | 22,7 ms/tick, ×7,3 max | **11,5 ms/tick, ×14 max** |
| Simulation, Les Forges (80 colons) | 216 ms/tick, ×0,77 max | **62 ms/tick, ×2,7 max** (70,9 juste avant les contrôles indexés du 8 novembre) |
| Simulation, Les Aulnes intégrées | 30,4 ms/tick | **15,6 ms/tick** |
| Simulation, Les Aulnes sièges | 37,8 ms/tick | **21,6 ms/tick** |
| Client réel, Les Éclaircies à ×6 | 34 ticks/s (×6 non tenu), 113 im/s, p95 26 ms | **38 ticks/s (×6 tenu), 150 im/s, p95 11 ms** |
| Plus longue tâche, Les Éclaircies à ×6 | 290 ms | **136 ms**, et rare |
| Client réel, Les Forges à ×1 | p95 154 à 179 ms (mesure de l’agent rendu) | **p95 28 ms**, 107 im/s, temps réel tenu |
| Client réel, Les Forges à ×6 | — | **9,5 ticks/s** (6,7 avant les publications allégées) |
| Adoption d’une publication complète, Les Forges à ×1 (client réel) | 98 ms en moyenne, pics de 250 à 330 ms à chaque construction ou plante ajoutée | **≈ 65 ms**, pics des ressources ≤ 24 ms, mur ajouté ≈ 15 ms |
| Publications complètes, Les Forges à ×1 (Worker seul) | 6,8 par seconde (≈ 630 Ko chacune) | **≈ 1,9 par seconde** (≈ 3 avant les patchs de cargaison) |
| Chargement des Éclaircies (navigateur, profil neuf) | 119 s, panneau « Opération en attente » à 16 s | **64 s**, barre de progression, plus de panneau |
| Chargement d’une sauvegarde au schéma actuel (Éclaircies / Les Forges) | 78 / 82 s | **24 / 25 s** (39 à 46 / 41 s avant les ombres sans couleur) |
| Nouvelle partie, de « Générer » au jeu affiché | 116 à 121 s | **48 s** |
| Panne « Shared World/settings/camera/paint changed before publication » en jeu | en 1,2 s, caméra en mouvement à ×6 | **aucune** en 150 s |
| Gels d’affichage pour préparer des surfaces en jeu (×6, 60 s) | 105, 1,5 s gelée au total | **18**, 0,37 s |
| Ouverture d’un panneau du bas, Les Forges (Travail / Planning / Faune) | 506 / 786 à 1 058 / 296 ms | **61 / 62 / 32 ms** à la réouverture, 142 / 160 / 58 ms la première fois |
| Les Forges à ×1, 15 s : images au-dessus de 33 / 50 ms, p95 | 69 / 42, p95 29 ms | **39 / 29, p95 17 ms** |
| Worker seul, Les Forges à ×1 : temps réel tenu | 78 à 92 % | **≈ 100 %** (plantes, besoins et humeur à la cadence de RimWorld) |

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

### Interface : ouverture des panneaux (8 novembre)

**Constat.** Cliquer sur un bouton du bas (Faune, Travail, Planning…) figeait le jeu un moment avant d’afficher la fenêtre. Mesuré sur Les Forges (80 colons, 241 animaux), du clic à la première image qui montre la page : Planning 0,8 à 1,1 s, Travail 0,5 s, Animaux 0,4 s, Menu 0,4 s, Faune 0,3 s, Monde 1,4 s la première fois.

**Causes.**
- Chaque contrôle d’une page, case de tableau comprise, est une pièce de carton 3D : géométrie découpée, canvas peint, texture envoyée au GPU. Fermer la page les détruisait toutes ; la rouvrir les recréait.
- Chrome attribue une surface GPU à chaque petit canvas accéléré, puis le relit pour l’envoyer en texture WebGPU : des centaines de cases coûtaient des centaines de millisecondes de travail natif.
- Le globe du Monde construisait sa géométrie (environ 120 000 cases) à la première ouverture.
- Le Menu attendait la mise en pause et la relecture des sauvegardes avant de s’afficher.

**Corrections.**
- **Réserve de pièces.** Les pièces qui quittent une page sont mises en réserve, sans être détruites, puis retrouvées par identifiant à la page suivante ; leur peinture est comparée comme avant. Réserve bornée : 6 000 pièces et 16 millions de pixels de canvas ; les grandes feuilles de page n’y vont pas. La mise en réserve retire les pièces du lancer de rayons en un seul passage, au lieu d’un `indexOf` + `splice` par maillage.
- **Canvas logiciels** (`willReadFrequently`) pour les petites pièces.
- **Géométrie partagée.** Les contrôles de page ont 16 variantes de découpe, et les découpes identiques partagent leur géométrie. Ce partage est explicite (`sharedGeometry`) et la géométrie appartient à la fabrique ; les autres pièces gardent leur géométrie propre.
- **Préparation à l’avance.** Partie en pause, aucune page ouverte, caméra immobile depuis une seconde : les grands panneaux (Faune, Animaux, Travail, Planning, Assignations, Recherches, Architecte) sont construits à l’avance, leurs textures envoyées au GPU, puis mis en réserve.
- **Globe du Monde.** Géométrie et normales préparées derrière l’écran de chargement et mises en cache (les normales étaient recalculées à chaque affichage). Les boucles n’allouent plus rien par case ni par sommet ; mêmes valeurs.
- **Menu.** Il s’affiche tout de suite ; la pause et la liste des sauvegardes suivent. Un menu fermé avant la confirmation de la pause rend la vitesse comme une sortie ordinaire.
- **Rafraîchissement.** Avec une page de gestion ouverte, les rafraîchissements dus au monde passent de 5 à 2 par seconde ; les actions du joueur la rafraîchissent toujours immédiatement.

**Mesures**, Les Forges, client réel, du clic à la première image :

| Panneau | Avant | Première ouverture (préparée) | Réouverture |
|---|---|---|---|
| Travail | 506 ms | 142 ms | **61 ms** |
| Planning | 786 à 1 058 ms | 160 ms | **62 ms** |
| Animaux | 406 ms | 94 ms | **63 ms** |
| Faune | 296 ms | 58 ms | **32 ms** |
| Assignations | 324 ms | 90 ms | **45 ms** |
| Recherches | 113 à 203 ms | 58 ms | **29 ms** |
| Monde | 1 359 ms | 140 ms | **22 ms** |

Sans préparation à l’avance (partie non mise en pause), la première ouverture de Travail ou de Planning coûte encore environ 0,4 à 0,5 s.

**Tests.** Aucun échec propre à ces changements sur les 16 fichiers de l’interface native, comparés au commit de référence. Les deux échecs restants de `native-cardboard-art-v476` existent déjà sur ce commit (nouveaux pictogrammes).

**Ce qui reste.** Sur Les Forges, le jeu lui-même, sans panneau, a encore environ 25 images au-dessus de 50 ms en 8 s à ×1 : adoption des publications complètes du Worker et application du monde. C’est désormais le poste principal de fluidité en jeu sur une grande colonie.

### Fluidité en jeu sur Les Forges (8 novembre)

**Constat.** À ×1, sans panneau ouvert, Les Forges (80 colons, 241 animaux, 21 122 plantes, 1 778 tas) avaient environ 3 images par seconde au-dessus de 50 ms. Mesure image par image dans le client réel :
- chaque publication complète du Worker (≈ 1,7 par seconde) donnait **deux images longues consécutives** : l’adoption (≈ 70 ms, dont la mise à jour du HUD) puis l’application du monde (≈ 50 à 65 ms, sans rendu : la préparation des surfaces retenait l’affichage) ;
- chaque paquet de phase des acteurs (≈ 7 par seconde, ≈ 100 lignes d’acteurs et 2 100 cases de chemin) coûtait ≈ 15 ms au fil principal : copie défensive à la réception, lecture stricte, puis recopie des acteurs ;
- le Worker lui-même ne tenait que 70 à 85 % du temps réel à ×1 : une publication complète lui coûte ≈ 150 ms (encodage et envoi), soit plus de 20 % de son temps.

**Corrections.**
- **Cadence des publications calmes.** Leur intervalle suit maintenant leur coût mesuré dans le Worker : 8 fois le coût d’une publication, au moins 250 ms (inchangé sur une petite colonie) et au plus 1 s. Les ordres du joueur, la pause, les changements durs et les acteurs (phases, portes, tas portés) restent publiés aussitôt ; seuls les changements lents du monde (plantes, travaux, objets au sol, besoins) peuvent attendre jusqu’à 1 s sur une grande colonie.
- **Paquets de phase.** La copie à la réception crée chaque objet par une seule copie de ses propriétés après les mêmes vérifications, au lieu d’un `defineProperty` par clé ; les éléments de tableau sont nommés par leur indice numérique. La lecture stricte reconnaît les valeurs produites par cette capture (objets gelés, données propres, tableaux denses) sans relire tous leurs descripteurs ; ailleurs, les vérifications complètes restent. La mise à jour d’un acteur assigne les champs déjà présents au lieu de les redéfinir. Mêmes refus, mêmes messages, mêmes objets gelés : la suite stricte de capture (23 cas) passe.
- **HUD.** Sa mise à jour ordinaire attend 34 ms (deux images) au lieu de tomber dans l’image qui adopte la publication. Le dictionnaire des noms n’est plus retrié quand les noms n’ont pas changé.
- **Surfaces préparées des boîtes.** La taille des tas suit leur quantité ; une variante de surface qui disparaissait puis revenait relançait une préparation et retenait l’affichage une image. Les variantes déjà dessinées restent préparées (jusqu’à 384). L’identifiant de variante est mis en cache par modèle et par taille exacte, au lieu d’une clé JSON calculée pour chaque boîte d’un lot reconstruit.

**Mesures.** Client réel, Les Forges à ×1, 15 s, trois passages en alternance entre le commit de référence et ce lot, valeurs médianes :

| Mesure | Avant | Après |
|---|---|---|
| Images au-dessus de 33 ms | 69 | **39** |
| Images au-dessus de 50 ms | 42 | **29** |
| p95 du temps d’image | 29,2 ms | **16,7 ms** |
| p99 du temps d’image | 66,7 ms | 62,5 ms |
| Images figées au-dessus de 50 ms (sans rendu, puis l’image suivante) | 23 | **12** |
| Publications complètes appliquées | 32 | **16** |
| Application d’une publication complète | 40,6 ms | 52,4 ms (davantage de changements par publication) |
| Image d’adoption d’une publication complète | 67 ms | 63 ms |
| Ticks de simulation présentés | 91 | 88 (même cadence, à la variation près) |

En Node, sur les mêmes messages rejoués : un paquet de phase passe de ≈ 15 à ≈ 6,5 ms (capture 8,6 → 4,6 ms, lecture et mise à jour des acteurs 6,4 → 1,9 ms). Dans le Worker seul, les publications complètes passent de 1,3 à 0,8 par seconde et le Worker tient 92 % du temps réel au lieu de 78 % (variation entre passages importante).

Les préparations de surfaces après chaque application restent : sur la première minute, de nouvelles tailles de tas apparaissent encore (182 → 206 variantes), puis les retenues viennent surtout des chunks de végétation reconstruits, dont les adresses de texture doivent être résolues avant d’être dessinées.

**Tests.**
- Comparaison test par test avec le commit de référence sur 99 fichiers du pont et des publications, puis sur les 61 fichiers touchés par les derniers changements : aucune régression.
- La suite stricte de capture des phases (`native-phase-capture`) ne se chargeait plus depuis le 31 octobre : l’empreinte épinglée de `native-clone-resident.ts` n’avait pas été mise à jour. Les empreintes des trois fichiers sont à jour ; un cas attendait encore un refus d’allocation pour une phase « frontier », que le Full suivant explique depuis le 7 novembre : il vise désormais une phase ordinaire, où le refus s’applique toujours.
- Le harnais des tests du Worker en mode « frontier » exigeait le schéma 297 alors que le jeu est au 301 : 5 fichiers échouaient dès la préparation. Il accepte désormais la famille de schémas physiques actuelle ; 9 cas repassent, les mêmes 6 échouent avant et après ces changements.

**Scène d’acteurs figée sur place (second lot du 8 novembre).** À chaque publication complète, le fil principal recopiait et gelait les 321 acteurs et leurs trajectoires pour la scène des phases. Ces données viennent d’être décodées du message du Worker, et le fil principal ne fait que les lire : elles sont désormais vérifiées avec exactement les mêmes contrôles (budget, profondeur, nombres finis, données propres, tableaux denses, mêmes messages) puis gelées sur place, sans copie. Un test vérifie que le résultat et les refus sont ceux de la copie. Aucun code du fil principal n’écrit dans ces acteurs (recherche des écritures et des fonctions mutatrices de la simulation importées par l’interface ou le rendu).

En Node, sur les messages rejoués, l’adoption d’une publication complète passe d’environ 40 à 28 ms. Dans le client réel, en alternance avec la version publiée juste avant (trois passages chacun, médianes) : file d’adoption dans l’image d’une publication complète 35,5 → **17,8 ms**, p99 45,8 → **41,7 ms**, images au-dessus de 50 ms 10 → 9 en 15 s. Ce jour-là, la machine était plus rapide que lors de la première comparaison (150 images par seconde au lieu de 109 pour la même version de référence) : seules les comparaisons d’un même passage sont à rapprocher.

**Ce qui reste.** Le coût d’une publication complète elle-même : adoption ≈ 30 ms (vérification des acteurs ≈ 6 ms, trajectoires ≈ 5 ms, correctifs de collections, sections), application ≈ 50 ms répartie sur une vingtaine de couches (tas, cultures, propreté, ressources, structures). Les 20 000 croissances de plantes renvoyées à chaque publication (températures froides : chaque plante est réancrée à chaque tick) en représentent une part.

### Plantes, besoins et humeur à la cadence de RimWorld (8 novembre)

Deux règles de la simulation tournaient plus souvent que dans le vrai jeu ; les aligner améliore la fidélité et retire du travail à chaque tick. Source : la bibliothèque de RimWorld 1.6.4871 rev590, décompilée localement pour lecture (rien n’est recopié), voir [les cadences de RimWorld 1.6](../research/rimworld-16-tick-cadences.md). Les deux changements valent pour la famille de schémas actuelle (301) ; les schémas historiques gardent leur comportement, aucune donnée sauvegardée ne change de forme.

**Température des plantes.**
- Constat : par temps froid, sous 6 °C, le facteur de croissance suit la température. La simulation réancrait la croissance de toutes les plantes de la région à chaque variation, donc à chaque tick : environ 20 400 plantes sur Les Forges, toutes renvoyées à chaque publication complète.
- RimWorld : une plante lit sa température à son `TickLong`, tous les 2 000 ticks Core, au tick où `TicksGame % 2000 == id % 2000`.
- Désormais : chaque plante lit sa température une fois tous les 200 ticks locaux, dans le tick local qui contient cet instant.
  - Un facteur changé solde la croissance écoulée au facteur précédent, puis vaut jusqu’à la lecture suivante.
  - Les ticks écoulés depuis l’appel précédent sont tous lus, dans l’ordre.
- Adaptations conservées :
  - la lumière reste une intégrale continue, adaptation déjà documentée ;
  - la lecture s’applique à l’intervalle qui suit, alors que RimWorld l’applique à celui qui vient de s’écouler.

**Confort, souvenirs et humeur.**
- Constat : sur la carte, ils avançaient à chaque tick local. Chaque fois, `moodThoughts` reconstruisait toutes les pensées de chaque colon éveillé (parcours de tous les tas, des pions et des structures), et le confort recherchait les meubles autour.
- RimWorld : `Pawn_NeedsTracker` fait avancer chaque besoin une fois tous les 150 ticks, au tick haché du pion, par un pas de 150 ticks ; les pensées situationnelles sont recalculées à ce moment.
- Désormais : sur la carte, confort, expiration des souvenirs et humeur avancent une fois par 150 ticks Core (le tick local qui contient l’instant haché du colon), par un pas de 15 ticks locaux. Le calcul de l’instant est celui que les caravanes utilisaient déjà. C’est la passe des besoins de la carte (`updateNeeds`) qui choisit ce tick ; `updateWellbeing` fait un pas de la durée qu’on lui donne.
- Faim, repos et loisirs restent mis à jour à chaque tick local : leurs taux sont déjà ceux de RimWorld, et leur logique (sommeil médical, effondrement) dépend d’états lus à chaque tick.

**Mesures.**
- **Worker seul, en Node, Les Forges à ×1 :**
  - croissances de plantes renvoyées par publication complète : 20 437 → **472** ;
  - temps réel tenu : 78 à 92 % → **≈ 100 %** ;
  - retard médian des tâches : 120 à 270 ms → **moins de 1 ms** ;
  - sur 20 s :
    - `updateNeeds` 0,59 → 0,11 s ;
    - `updateWellbeing` 0,49 → 0,04 s ;
    - `moodThoughts` 0,36 → 0,03 s ;
    - publications complètes 4,6 → 2,3 s.
- **Client réel, Les Forges à ×1, 15 s, en alternance avec la version publiée (trois passages chacun, médianes) :**
  - images au-dessus de 33 ms : 29 → **15** ;
  - p99 : 36 → **30 ms** ;
  - application d’une publication complète : 30 → 28 ms ;
  - images au-dessus de 50 ms : 4 → 5, rares les deux fois sur cette machine ce jour-là.
  - Les publications complètes, moins coûteuses, sont un peu plus fréquentes (23 → 26 en 15 s) : leur intervalle suit leur coût.


**Tests.**
- Deux nouveaux fichiers : `plant-tick-long-temperature` (instant de lecture propre à chaque plante, rattrapage des ticks écoulés, schéma historique inchangé) et `needs-interval-150` (un pas tous les 15 ticks locaux par colon, à son instant, schéma historique par tick).
- Comparaison test par test avec le commit de référence sur 288 fichiers de simulation (plantes, cultures, climat, humeur, confort, pensées). Les cas qui attendaient l’ancienne cadence ont été mis à jour, avec la règle de RimWorld en commentaire :
  - le gel de la croissance par une vague de froid se lit au `TickLong` de la plante ;
  - le solde exact de la croissance entre régions, plafonds et ancres différents (`thermal-pass-v434`) se vérifie à un instant d’échantillonnage commun ;
- `survivor-colony` (trois jours de colonie) n’a pas pu tourner : il se bloque avant son premier cas, sans calcul, sur le commit de référence comme sur ce lot.
  - les tests unitaires qui appellent directement `updateWellbeing` gardent leur pas d’un tick.

### Chargement : ombres sans couleur, géographie allégée (8 novembre)

**Constat.** Au chargement des Forges, le fil principal passait 18,2 s à construire 209 shaders (temps JavaScript de Three.js, avant la compilation par le GPU). 45 d'entre eux, ceux de la passe d'ombre, en prenaient 7,2 s : 3,3 s pour les 21 espèces sauvages, 1,9 s pour les colons.

**Cause.** Pour la passe d'ombre, Three.js r186 multiplie l'alpha de l'ombre par `material.colorNode.a` dès que le matériau a une couleur. Chaque shader d'ombre reconstruisait donc tout le graphe de couleur du matériau (pigments, traits, sang, usure) pour n'en garder que l'alpha. Sur nos matériaux, cette couleur est un `vec3` : l'alpha lu vaut toujours 1 (`vec4(couleur, 1.0).w` dans le code généré).

**Correction** (`ReentrantRenderer`, adaptateur déjà propre à Three 0.186) : quand l'alpha ne peut pas changer l'ombre, le shader d'ombre garde la position, la profondeur et le masque d'exploration du matériau, sans son graphe de couleur.
- L'alpha n'atteint la carte d'ombre que par un test d'alpha copié du matériau, ou par des ombres colorées (`shadowMap.transmitted`). Le matériau de la passe d'ombre ne mélange rien et écrit la profondeur.
- Les matériaux avec `alphaTest`, `castShadowNode` ou des ombres colorées gardent le chemin de Three.js.
- Aucun graphe de couleur projetant une ombre ne contient de `discard` ni d'écriture : le seul `discard` dans une couleur est l'encre de cuisson des atlas, hors de la scène ombrée.

**Masque d'exploration partagé.** Une fois la couleur retirée, les variantes de matériau des colons (uni, texturé, natif, atlas) donnaient des shaders d'ombre identiques, mais chacun était construit à part : le masque d'exploration des acteurs était un graphe neuf par matériau, alors qu'il ne dépend d'aucun matériau. Ce graphe est maintenant un seul nœud, partagé par tous les acteurs sans masque propre, et l'adaptateur réutilise la même couleur d'ombre pour un même masque. Les variantes qui partagent leur pose partagent ainsi leur programme d'ombre : colons 13 → 9 compilations, ombres 45 → 41.

**Exactitude.** Captures figées (jeu en pause, horloge de la page gelée), avec et sans l'adaptateur : 0 pixel différent sur Les Forges et sur Les Éclaircies, ombres des colons, animaux, arbres, murs et nuages comprises. Deux sessions identiques donnent aussi 0 pixel d'écart.

**Géographie de la planète** (≈ 120 000 tuiles, reconstruite au chargement par le Worker puis par le fil principal) :
- les colonnes de la surface étaient validées deux fois : sur la valeur reçue, puis sur sa copie `structuredClone`. La copie n'est plus revalidée. Pour que l'acceptation reste la même, la validation exige désormais des propriétés énumérables, les seules que garde une copie ;
- le gel profond (≈ 1,3 million d'objets) gèle chaque objet avant ses enfants et s'arrête sur un objet déjà gelé, au lieu de tenir un ensemble des objets visités. Les arbres gelés sont des restaurations ou des sorties du générateur, dont les seuls objets gelés d'avance sont des tableaux vides constants : le résultat est le même.
- `restoreCampaignGeography256` : 1,74 → 1,20 s par fil (médiane, Node).

**Mesures.** Navigateur neuf (sans cache de shaders), build de production, trois passages en alternance avec le commit de référence, médianes ; de la demande de chargement à la partie affichée :

| Sauvegarde au schéma actuel | Référence | Ce lot |
|---|---|---|
| Les Forges | 32,1 s | **25,2 s** |
| Les Éclaircies | 30,1 s | **24,1 s** |
| dont préparation de l'affichage, Les Forges / Les Éclaircies | 24,6 / 23,4 s | **18,5 / 18,1 s** |
| dont arrivée du monde (Worker), Les Forges / Les Éclaircies | 7,6 / 6,7 s | **6,7 / 6,0 s** |

Temps JavaScript de construction des shaders au chargement des Forges : 18,2 s → 12,6 s ; passe d'ombre 7,2 → 1,0 s.

**Tests.** 225 fichiers (géographie, planète, ombres, rendu, masque d'exploration), comparés test par test au commit de référence : 1 153 réussis et 371 en échec des deux côtés, 0 régression. Les échecs sont ceux de tests anciens, déjà en échec sur la référence. Les tests du masque d'exploration ont été relancés après le partage du masque : seul échoue `origami-pipeline-budget`, qui appelle une méthode supprimée bien avant ce lot (`selectOrigamiPosition`, absente aussi de la référence).

**Ce qui reste au chargement**, Les Forges :
- shaders principaux des 21 espèces sauvages : 3,3 s. Chacune a sa propre texture d'animation, ses tables de traits et ses uniformes de groupe « rendu » : partager un programme demanderait de rendre ces ressources propres à chaque objet ;
- variantes de matériau des colons (≈ 2,5 s) : elles basculent d'elles-mêmes en jeu (corps natif, atlas en Gouache), sauf les variantes sans texture ;
- `InstancedMesh` : Three.js r186 met l'identifiant de l'objet dans la clé du programme, chaque lot de cultures (10 sur Les Forges, ≈ 130 ms chacun) reconstruit donc le sien ;
- application du monde (≈ 4,3 s), dont maillages des colons et tables de traits ≈ 1,1 s, végétation ≈ 1 s.


### Simulation des Forges : contrôles indexés (8 novembre)

**Constat.** Après le lot de chargement, le jeu affiché aux Forges est fluide à ×1 (142 images/s, p95 12 ms, 3 images au-dessus de 50 ms en 15 s). Mais ×3 et ×6 ne sont pas tenus : environ 10 ticks/s, soit 56 % de ×3 et 29 % de ×6. Le Worker de simulation est le goulot (Les Éclaircies tiennent ×6). La simulation seule coûtait 71 ms par tick, dont 22 % dans la planification du travail (`planWork`). Plusieurs contrôles y parcouraient toute la carte pour une réponse qui ne dépend que de quelques cases.

**Corrections.** Toutes rendent exactement la même réponse que le parcours qu'elles remplacent.
- **Inhumation.** Pour savoir s'il y a un corps à enterrer, le planificateur interrogeait `burialReason` pour chaque colon, vivant compris. Chaque appel cherchait d'abord la dépouille parmi les ≈ 1 800 tas. Pour un vivant, la réponse est toujours un refus : seuls les morts sont désormais examinés.
- **Chantiers libres.** `constructionSiteFree` parcourait les 241 animaux et les 80 colons pour chacun des ≈ 240 chantiers, à chaque planification. Un index des cases occupées est construit une fois par appel du planificateur, pendant lequel le monde ne change pas. Il reprend les mêmes conditions : position, case de service, case de repas, rectangle du déplacement en cours. Un rectangle de plus de 64 cases, ou une case hors de la carte, garde le parcours direct.
- **Petites plantes sous un cadre.** Chaque bâtisseur au travail sur un cadre parcourait les 21 000 ressources à chaque tick. Un index des petites plantes par case est tenu par tableau de ressources. Pendant qu'un monde tourne, ce tableau est remplacé, jamais modifié sur place (les ajouts de la génération changent sa longueur, ce qui reconstruit l'index), et une ressource ne change ni de type, ni d'espèce, ni de place.
- **Obstacles d'un chantier.** La première plante gênante, dans l'ordre du tableau, est trouvée par un index case → ressources, au lieu d'un `find` sur toutes les ressources.
- **Lit d'un colon.** Le contrôle « son lit existe-t-il ? » parcourait les 7 500 structures pour chaque colon, à chaque tick. L'index par identifiant confirme le cas courant (le lit existe) ; s'il ne le trouve pas, les parcours complets décident, comme avant.
- **Capacité de stockage.** Les contrôles d'occupation d'une case de stockage parcouraient les 7 500 structures. En simulation, ils passent par l'index partagé des emprises, qui donne, dans l'ordre du tableau, exactement les structures occupant une case de la carte. La validation des sauvegardes garde les parcours.

**Exactitude.** État complet sérialisé identique au bit près à celui du code de référence : Les Forges après 150 ticks (`84e7037d…`), Les Éclaircies (`e7e98a5d…`), Les Aulnes intégrées (`aaa91534…`) et Les Aulnes sièges (`a23ba92c…`) après 300 ticks.

**Mesures.**
Banc Node (`scripts/perf-save-bench.ts`), Les Forges, 150 ticks après 20 de chauffe, code de référence et branche en alternance, trois passes chacun. D'autres programmes chargeaient la machine pendant ces passes : les valeurs absolues sont plus hautes que le 6 novembre, seule la comparaison compte.

| Les Forges, simulation seule | Référence | Ce lot |
|---|---|---|
| Temps moyen par tick, trois passes | 92,2 / 90,0 / 89,8 ms | **86,4 / 79,9 / 79,0 ms** |
| Moyenne | 90,7 ms | **81,8 ms (−10 %)** |
| Médiane des ticks complets, moyenne des trois passes | 78,6 ms | **68,3 ms (−13 %)** |

Sur un profil pris plus tôt, machine moins chargée : 70,9 → 62,1 ms par tick (−12,3 %), et `planWork` −38 %.

Le Worker réel à ×6 (`scripts/perf-worker-run.ts`, 20 s) a donné 140 et 166 ticks pour la référence, 161 et 145 pour la branche : sous cette charge, l'écart entre deux passes dépasse le gain attendu, cette mesure ne permet pas de conclure.

**Tests.**
675 fichiers (construction, chantiers et plantes, besoins et lits, stockage, placement au sol, planification, inhumation), comparés test par test au commit de référence : 3 000 réussis et 1 630 en échec sur la branche, 2 997 et 1 633 sur la référence, 0 régression. Les échecs communs sont ceux de tests anciens, déjà en échec sur la référence. Les trois tests de plus qui passent (`test-colonies-v98` : energy-food-12, prison-12, weather-fire-12) dépassaient sur la référence leur délai de 60 s, à cause de la charge de la machine.

**Ce qui reste** dans la simulation des Forges (profil après ce lot) : planification du travail ≈ 16 %, déplacements des tâches internes (`advanceCoreMap297`) ≈ 12 %, faune ≈ 11 %, recherche ≈ 5 % (la propreté de la pièce est recalculée dès qu'une saleté change quelque part sur la carte), pousse des plantes sauvages ≈ 3 %.

### Simulation : éclairage et coûts de navigation mémorisés (8 novembre)

**Constat.** Après les contrôles indexés, le profil des Forges montrait 5 % du temps dans `navigationCosts`, reconstruit à chaque recherche de chemin. Près de la moitié de ce temps allait aux lectures d'éclairage de `humanMoveSpeedFactor297` (vitesse de marche d'un colon selon la lumière). Chaque lecture de l'éclairage :
- reconstruisait la liste des ≈ 150 sources de lumière (lampes, feux, plantes de grotte), avec leur tri ;
- la comparait champ par champ à la dernière carte de lumière calculée ;
- créait un nouvel objet `LightEnvironment`.

La reconstruction de `navigationCosts` reparcourait aussi toutes les emprises des 7 500 structures pour leurs délais de traversée, alors que ces délais ne dépendent que de leur type et de leurs cases.

**Corrections.** Toutes rendent exactement le même résultat.
- **Sources de lumière** (`lightSources`). La liste triée est gardée par liste de structures éclairantes. Elle est réutilisée tant que chaque structure garde son type, sa case et son activité (alimentée, allumée, combustible), et que les sources des plantes de grotte gardent leur identité. Une source dépend seulement de ces trois valeurs. La liste partagée est gelée : aucun lecteur ne la modifie.
- **Carte de lumière** (`LocalLightCache`). Si elle reçoit la même liste gelée, elle sait que les sources n'ont pas changé, sans comparer leurs champs. Si seule la topologie des pièces a changé, la recherche d'un obstacle modifié autour des sources lit directement le tableau des étiquettes de pièces, au lieu d'une recherche par case.
- **Environnement d'éclairage** (`LightEnvironmentCache`). Le même objet est rendu tant que topologie, toits, cartes de lumière et lumière du ciel n'ont pas changé.
- **Délais des structures** (`navigationCosts`). La part des structures (délais, cases à répétition, cases d'arrêt, pièges) est précalculée une fois par capture d'emprises, dans le même ordre d'insertion. Chaque recherche copie cette base et lit toujours en direct l'état des pièges, les cadres de chantier, les tas, le terrain, les portes et le feu.

**Exactitude.** État complet sérialisé identique au bit près à celui du commit précédent : Les Forges après 150 ticks (`84e7037d…`), Les Éclaircies (`e7e98a5d…`), Les Aulnes intégrées (`aaa91534…`) et Les Aulnes sièges (`a23ba92c…`) après 300 ticks.

**Mesures.**
Même banc Node (Les Forges, 150 ticks après 20 de chauffe), sous profileur, commit précédent puis ce lot :

| Les Forges, temps inclusif sur 150 ticks | Commit précédent | Ce lot |
|---|---|---|
| `navigationCosts` | 0,58 s | **0,37 s (−36 %)** |
| Lectures d'éclairage (`LightEnvironmentCache.read`) | 0,35 s | **0,31 s** |
| dont liste des sources (`lightSources`) | 0,11 s | **0,07 s** |

Le gain total est d'environ 2 % du temps de simulation. Trois passes alternées sans profileur donnent 74,2 ms par tick pour le commit précédent et 72,1 ms pour ce lot : l'écart est de l'ordre du bruit de la machine, qui était chargée, et la première paire est même inversée.

La carte de lumière elle-même coûte autant qu'avant : elle est réellement recalculée quand un obstacle change près d'une lampe ou qu'une source s'allume ou s'éteint, ce qui arrive souvent aux Forges, et ce calcul ne peut pas être fait par différence, la somme des sources étant plafonnée. Autre reste : la topologie des pièces relit les 62 500 cases du terrain dès qu'une case est écrite. La neige foulée à chaque pas suffit à déclencher cette relecture, alors que seules les roches comptent. La distinguer des remplacements de cases est un chantier à part.

**Tests.**
219 fichiers de tests (éclairage, navigation, chemins, pièges, portes, déplacements) : 1 157 réussis et 517 en échec. Les 142 fichiers ayant des échecs, relancés sur le commit précédent, donnent les mêmes 517 échecs : 0 régression. Après le dernier ajustement (comparaison des sources, topologie), 102 fichiers touchant la lumière, les pièces, la propreté et la beauté ont été relancés : 0 régression, y compris sur 17 fichiers nouveaux comparés au commit précédent (47 échecs identiques des deux côtés).

`prison-colony.test.ts` n'exécute aucun test sans variable de campagne longue, mais il empêche vitest de se terminer après son rapport. Il bloquait tout son paquet de 60 fichiers jusqu'au délai de garde : il est retiré des listes, et ses voisins ont été passés un par un.

### Simulation : animaux domestiques pris en charge (8 novembre)

**Constat.** Aux Forges (241 animaux), deux contrôles faits pour chaque animal domestique, à chaque tick, parcouraient tous les colons pour une réponse presque toujours négative :
- `animalClaimed` (« un colon s'occupe-t-il de cet animal ? ») construisait, pour chacun des 80 colons, la liste des animaux qu'il sert (mené, soigné, nourri, secouru, porté), puis y cherchait l'animal ;
- `animalHandlingHolding` (« un colon le tient-il pour une interaction ? ») cherchait d'abord l'animal parmi toute la faune, puis parcourait les colons.

**Corrections.** Mêmes réponses.
- `pawnServesAnimal` répond sans construire la liste, avec la même égalité que `includes` (NaN compris).
- `animalHandlingHolding` vérifie d'abord qu'un colon manipule cet animal. Les deux prises en charge possibles l'exigent ; sinon la réponse est non, sans chercher l'animal.

**Exactitude.** État complet identique au bit près sur Les Forges (150 ticks), Les Éclaircies et les deux versions des Aulnes (300 ticks).

**Mesures.** Sous profileur, Les Forges, 150 ticks : `animalHandlingHolding` 0,16 → 0,05 s, repos des animaux (`processAnimalRest`) 0,21 → 0,17 s. Environ 1 % de la simulation.

**Tests.**
90 fichiers de tests (premier paquet de la liste faune et tous les fichiers qui appellent directement ces fonctions ou le repos et la manipulation des animaux) : 467 réussis et 304 en échec. Les 47 fichiers ayant des échecs, relancés sur le commit précédent, y donnent les mêmes 304 échecs : 0 régression.

Les tests ont été passés fichier par fichier : la machine, chargée par d'autres programmes (2 Go de mémoire virtuelle libre), et quelques fichiers lents (chargement des Aulnes, 80 à 100 s) bloquaient les paquets de 60. Les fichiers optionnels (`*.optin.test.ts`), sans variables d'environnement, ne collectent aucun test et empêchent vitest de se terminer : ils sont exclus des listes.

### Simulation : propreté des laboratoires (8 novembre)

**Constat.** La vitesse de recherche dépend de la propreté de la pièce du banc. Aux Forges, `researchCleanliness` coûtait environ 2,3 % du tick. À chaque appel, sa capture de propreté était refaite, avec le parcours des ≈ 4 000 saletés de la carte. La capture était gardée par environnement de travail, et cet environnement est recréé à chaque fin de tâche ou de transport. Sur 393 calculs de pièce mesurés en 60 ticks, 346 (88 %) trouvaient exactement les mêmes saletés que le calcul précédent.

**Correction.** Mêmes résultats, au bit près.
- La capture est gardée par topologie des pièces, la seule entrée qu'elle tire de l'environnement de travail.
- Dans un même environnement, des saletés inchangées rendent la pièce déjà calculée, comme avant.
- Sinon, la capture passe à une « époque » suivante si le tableau des saletés est le même, seulement prolongé, et si le sol et les toits n'ont pas changé. Chaque pièce déjà calculée est alors remise à jour à sa demande, exactement comme une capture neuve la calculerait :
  - même départ de remplissage, même total du sol ;
  - les saletés ajoutées sont reprises à la suite, dans le même ordre ;
  - les scories et les sources de saleté sont relues.
  
  Si une condition manque, la capture est refaite. La suite des additions est donc la même qu'avant, et le résultat aussi, flottants compris.

**Exactitude.** État complet identique au bit près sur Les Forges (150 ticks), Les Éclaircies et les deux versions des Aulnes (300 ticks).

**Mesures.** Sous profileur, Les Forges, 150 ticks, part du temps de simulation : `researchCleanliness` ≈ 2,2 → 1,3 %. Le reste vient surtout de la relecture des scories parmi les ≈ 1 800 tas.

**Tests.**
102 fichiers de tests (recherche, propreté, nettoyage, pièces) : 474 réussis et 253 en échec. Les 74 fichiers ayant des échecs, relancés sur le commit précédent, y donnent les mêmes échecs, sauf `habitat-apparel-colony` (scénario de deux jours). Ce dernier dépasse son délai de 180 s selon la charge de la machine : 182,6 s sur la branche, 207 s sur le commit précédent relancé dans les mêmes conditions. Ce n'est pas une régression. `geothermal-migration-v440` a dépassé 300 s sur la branche.

Pour les lots suivants, `tmp/perf/known-failures.py` garde les échecs déjà constatés sur la référence. La comparaison porte sur le statut de chaque test : un test qui échouait déjà ne peut pas révéler une régression en échouant de nouveau. Seuls les fichiers aux échecs inconnus sont donc relancés sur la référence, soit 1 fichier ici au lieu de 74.

### Simulation : pièces de l'environnement de travail et nettoyage (8 novembre)

**Constat.** L'environnement de travail est reconstruit après chaque fin de tâche ou de transport. Il détermine les pièces, leur rôle et leur part d'extérieur, et il reparcourait à chaque fois les 7 500 structures des Forges, avec une recherche dans une liste de 30 types par structure. De son côté, le test d'éligibilité d'une saleté au nettoyage parcourait les tâches de nettoyage de tous les colons, pour chacune des ≈ 4 000 saletés de la carte.

**Corrections.** Mêmes résultats.
- Les pièces calculées sont réutilisées tant que restent identiques :
  - la topologie et l'ensemble des cases couvertes ;
  - la liste des structures, prouvée par le jeton partagé des emprises : types, cases et orientations sont immuables ;
  - la largeur de carte et la famille de règles.
- Les saletés déjà visées par la tâche d'un autre colon sont réunies une fois par appel dans un ensemble. `Set` et `includes` comparent de la même façon (SameValueZero).

**Exactitude.** État complet identique au bit près sur Les Forges (150 ticks), Les Éclaircies et les deux versions des Aulnes (300 ticks).

**Mesures.** Sous profileur, Les Forges, 150 ticks : `getEnvironment` 0,24 → 0,06 s, dont reconstruction des pièces 0,17 → 0,02 s ; éligibilité au nettoyage 0,05 → 0,01 s. Environ 1,4 % de la simulation.

**Tests.**
346 fichiers de tests (environnement de travail, nettoyage, saleté, recherche, production, rôles des pièces), en paquets parallèles : 1 757 réussis et 844 en échec. Seuls 8 fichiers avaient des échecs pas encore connus sur la référence ; relancés sur le commit précédent, ils donnent les mêmes échecs, à deux dépassements de délai près, dus à la charge du passage parallèle :
- `cryptosleep-mapremoved-v447` : 30,5 s pour une limite de 30 s. Relancé seul sur ce lot, il passe en 18,2 s.
- `habitat-apparel-colony` : 234 s pour une limite de 180 s, déjà observé à la limite des deux côtés.

0 régression.

### Chargement : traits des modèles plus rapides (8 novembre)

**Constat.** Au chargement des Éclaircies, le fil principal reste occupé presque sans pause pendant environ 25 secondes. La compilation des tables de traits des modèles (animaux, colons, surfaces naturelles) y prend 2,3 s, dont 2,1 s dans `createOrigamiBrushGeometry`. Cette fonction fabrique une géométrie temporaire de traits, uniquement pour en extraire les tables. Elle allouait :
- un `Vector3` à chaque lecture de sommet ;
- une clé de position en chaîne de caractères à chaque extrémité d'arête ;
- un test d'expression régulière par composante de chaque sommet émis.

**Corrections.** Mêmes résultats, au bit près.
- La source de chaque valeur émise (position, UV, normale de face, zéro, interpolation, premier sommet) est décidée une fois par attribut, dans le même ordre de priorité.
- Les calculs de `emit` (soustraction, longueur, normalisation, interpolation, produit vectoriel) se font sur des nombres, avec les mêmes opérations dans le même ordre que les `Vector3`.
- La clé de position arrondie d'un sommet est calculée une fois par sommet, dans le générateur comme dans `compileFaceStrokeTable`.

**Exactitude.** 175 sorties comparées entre l'ancien et le nouveau code, identiques au bit près : les géométries de traits des 53 espèces avec et sans usure, leurs tables compilées, et les 16 variantes du modèle humain.

**Mesures.** Node, toutes les espèces, deux passes de chaque côté : géométries de traits 1 227 / 1 416 ms → **1 029 / 942 ms** (−20 à −34 %). Les tables complètes ne montrent pas d'écart mesurable (1 586 / 1 662 contre 1 815 / 1 520 ms, à froid). Le gain attendu au chargement est de l'ordre de 0,3 à 0,5 s, trop faible pour ressortir du bruit d'un chargement complet sur une machine chargée. La version de ce matin et ce lot chargent Les Éclaircies dans le même temps, à environ 40 s sous la charge de ce soir.

**Tests.** 140 fichiers (traits, modèles origami, animaux, humains, surfaces) : 558 réussis et 40 en échec. Les 19 fichiers dont les échecs n'étaient pas encore connus, relancés sur le commit précédent, y donnent les mêmes échecs : 0 régression.

**Ce qui reste au chargement** (profil du fil principal, Les Éclaircies) :
- construction des shaders, environ 15 s sous charge : variantes de colons (dont environ 2,5 s de variantes préchauffées), une par espèce sauvage, et des maillages vides préchauffés pour éviter un gel en jeu ;
- application du monde, environ 7 s (blocs de végétation, maillages des colons, terrain) ;
- 14 programmes `Attached fire` qui ne font que reconstruire 2 codes déjà construits.

### Chargement : un seul programme pour les animaux sauvages (8 novembre)

**Constat.** Chaque espèce sauvage avait son propre matériau, donc son propre shader. three.js reconstruit alors tout le graphe de nœuds du shader pour chaque espèce, environ 215 ms de fil principal à chaque fois. Les programmes des espèces ne diffèrent pourtant que par quatre constantes et un tampon :
- la cadence des pas ;
- deux mesures de la pose couchée ;
- l'échelle du sang (lièvres) ;
- le tampon des traits.

Les 38 espèces absentes de la carte étaient en plus compilées en arrière-plan après le chargement.

**Correction.** Un programme partagé par toutes les espèces de même squelette et de même représentation des traits ; en pratique, un seul pour les 53 espèces. Le graphe est celui que chaque espèce construisait. Ses valeurs propres à l'espèce sont lues pour chaque objet dessiné, juste avant la mise à jour de ses liaisons GPU :
- constantes ;
- horloges ;
- cache d'animation ;
- texture de pelage ;
- tampon des traits.

three.js garde une copie des liaisons de groupe objet par objet dessiné. Chaque espèce garde donc ses propres liaisons d'une image à l'autre, sans en recréer.

Le maillage d'une espèce est retrouvé par son propre cache d'animation, que porte sa géométrie : maillage de jeu, maillage de précompilation ou outil. Un objet sans espèce est refusé plutôt que dessiné avec les ressources d'une autre. La préparation des atlas garde les ressources fixes de chaque espèce.

**Exactitude.** Pour les 15 espèces des Éclaircies, captures figées en gros plan, jeu en pause, entre la version précédente et ce lot : **0 pixel différent**. Un essai isolé (deux maillages, un matériau) confirme aussi une seule construction, les bonnes couleurs par objet et aucune liaison recréée sur 6 images.

**Mesures** (construction des shaders) :

| | Avant | Après |
|---|---|---|
| Les Éclaircies : constructions | 181 | 153 |
| Les Éclaircies : programmes des animaux (corps + ombre) | 15 + 15 | 1 + 1 |
| Les Forges : constructions | 205 | 165 |
| Les Forges : temps total de construction | 16,5 s | 11,2 s |
| Les Forges : corps des animaux (21 espèces) | 4,7 s | 0,2 s |
| Après le chargement des Éclaircies : préchauffage des 38 espèces absentes | 85 constructions, 8,2 s, jusqu'à 334 ms d'un bloc, sur 44 s | 48 constructions, 0,6 s, sur 18 s |

Sur Les Forges, la préparation de la scène passe de 26,5 à 21,2 s (une mesure de chaque côté). L'arrivée d'une nouvelle espèce en jeu ne compile plus de programme de corps.

**Tests.** 77 fichiers (faune, cache d'animation, pose des acteurs, scène) : 288 réussis et 88 en échec, ces 88 échouant de la même façon sur le commit précédent. Le seul écart trouvé en chemin, une compilation à froid du matériau animal sur un maillage de test, est corrigé par la recherche de l'espèce depuis sa géométrie.

### Chargement : préchauffage des colons limité au réglage courant (8 novembre)

**Constat.** Au chargement, le préchauffage des colons compilait quatre variantes de corps : avec et sans textures, chacune pour le squelette animé courant et pour le squelette d'origine de la vue rapprochée. Les variantes sans textures ne servent que si le joueur désactive les textures ; ce réglage change alors les matériaux de tous les autres calques, compilés à ce moment-là.

Par ailleurs, la doublure qui préchauffe l'usure des colons perdait son test alpha. Dans three r186, `NodeMaterial.copy` ne recopie pas `alphaTest`, accesseur hérité dont la valeur est stockée dans `_alphaTest`. La doublure compilait donc un programme que l'usure ne dessine jamais, et le vrai programme était reconstruit à son premier dessin.

**Corrections.**
- Seules les variantes du réglage de textures courant sont préchauffées : squelette courant, squelette d'origine et, avec textures, atlas du corps.
- La doublure d'usure reçoit le test alpha de l'usure réelle. Le préchauffage de l'usure pour la vue rapprochée compile lui aussi, désormais, le programme réellement utilisé.

**Mesures** (Les Forges, constructions de shaders des colons) : 9 → **6**. Disparaissent les deux variantes sans textures (490 et 213 ms) et la reconstruction de l'usure réelle (566 ms), soit environ 1,3 s de fil principal au chargement.

**Tests.** L'oracle du test v331 est mis à jour : le préchauffage couvre les deux variantes du réglage courant, vérifié pour chacun des deux réglages. 91 fichiers (scène, colons, faune) : 375 réussis et 111 en échec, ces derniers identiques sur le commit précédent. Les fichiers d'usure et de préchauffage, relancés après la correction du test alpha, n'ont aucun nouvel échec.

### Chargement : un seul programme pour les cultures (8 novembre)

**Constat.** Chaque espèce de culture (riz, pommes de terre, coton, maïs, houblon…) est dessinée par son propre `InstancedMesh`. Pour un `InstancedMesh`, three.js r186 ajoute l'identifiant de l'objet à la clé de cache du programme : il reconstruit donc tout le graphe de nœuds pour chaque lot, environ 200 ms chacun, même avec un matériau commun. Les lots remplacés au premier chargement (capacité portée à la taille de la carte) étaient reconstruits une fois de plus.

**Correction.** L'`InstancedMesh` reste le détenteur des données d'instances, avec la même API : matrices, couleurs, nombre, bornes. Les caméras ne le dessinent plus. Un maillage enfant ordinaire, sur une géométrie instanciée qui partage ses attributs, le dessine avec un programme commun à toutes les espèces. Ce programme reprend la transformation de three pour les instances :
- matrice lue dans le tampon de stockage de l'objet dessiné (même mécanisme que pour les animaux sauvages) ;
- transformation de la normale ;
- couleur d'instance, multipliée par three comme pour un `InstancedMesh`.

Les variantes de matériaux (avec et sans textures) sont des copies de ceux de la scène, tenues à jour à chaque mise à jour du calque. Elles reprennent aussi le test alpha, que `NodeMaterial.copy` ne recopie pas.

**Exactitude.** Captures figées, référence contre ce lot, **0 pixel différent** :
- les trois grands champs des Forges (≈ 830 plants chacun : riz, pommes de terre, coton), avec et sans textures ;
- les deux cultures des Éclaircies.

**Mesures** (constructions de shaders des cultures) : 10 → **2** sur Les Forges comme sur Les Éclaircies. Une reste au début du chargement, masquée par la lecture de la sauvegarde ; une sur le chemin critique au lieu de 4 à 5. Sur le chemin critique, cela retire environ 1 à 1,3 s de fil principal. L'apparition d'une nouvelle espèce de culture en jeu, comme le foin, ne reconstruit plus de programme.

**Tests.** 141 fichiers (cultures, scène, colons, faune) : tous les échecs sont identiques sur le commit précédent. Deux fichiers de campagne (`crashlanded-colony`, `survivor-colony`) ne collectent aucun test sans leur variable d'environnement et empêchent vitest de se terminer, comme les campagnes déjà exclues ; leurs groupes ont été lancés avec un délai.

### Chargement : feu attaché et marqueur d'abattage partagés entre espèces (9 novembre)

**Constat.** Après le partage du corps, chaque espèce sauvage gardait deux programmes à elle : le feu qui brûle sur l'animal et le marqueur d'abattage. Ils ne diffèrent d'une espèce à l'autre que par l'horloge et le cache d'animation de l'espèce, ainsi que par la hauteur du marqueur. Sur Les Forges, ils comptaient 22 et 21 constructions au chargement, et ils étaient encore compilés pour les espèces absentes, après le chargement.

**Correction.** Le programme partagé des corps fournit aussi ces deux matériaux. Leurs horloges, leur cache d'animation et la hauteur du marqueur sont lus pour chaque objet dessiné, par le même mécanisme que le corps.

Le feu attaché des animaux garde son mode « milieu continu » : son cache d'effets n'est jamais lu par le shader, ce que le code vérifie. Ce cache reste propre à chaque espèce, côté CPU, et il est libéré avec elle.

**Exactitude.** Les 15 espèces des Éclaircies, en gros plans figés : **0 pixel différent**. Un muffalo avec marqueur d'abattage forcé : image identique.

**Mesures** (Les Forges) : feu attaché 22 → **2** constructions (343 → 27 ms), marqueur 21 → **1** (374 → 17 ms). Au total, 154 → **114** constructions de shaders au chargement.

**Tests.** 78 fichiers (faune, feu, marqueur, scène) : 315 réussis et 89 en échec, ces derniers identiques sur le commit précédent.

### Planification du travail et régions à la RimWorld (9 novembre)

Refonte demandée : planification par niveaux de priorité comme RimWorld, puis accessibilité par régions. Détail, sources et suite dans [la note de conception](work-planner-rimworld.md).

- **Ordre des donneurs** (`src/sim/work-givers-rimworld.ts`) : registre des 20 types et des 105 donneurs du Core, avec la façon dont chacun cherche sa cible, relevée dans les classes du jeu. Pour les sauvegardes actuelles (schéma 301), chaque candidat appartient au donneur que RimWorld utiliserait. On compare d'abord les donneurs (priorité du colon, priorité naturelle, `priorityInType`, ordre des définitions), puis la cible : première région qui contient une cible valide pour les donneurs à recherche par régions, puis la plus proche à vol d'oiseau. Une famille qui ne peut plus gagner n'est pas évaluée.
- **Transport** : la chose transportable la plus proche du colon, puis sa meilleure réserve (priorité, puis case la plus proche de la chose). Pour une livraison : la destination d'abord, puis la ressource la plus proche. La fenêtre tournante de paires source × destination disparaît pour ces sauvegardes.
- **Régions** (`src/sim/regions.ts`) : blocs de 12 × 12, portes à part, liens, reconstruits seulement quand la grille change. L'accessibilité répond par composantes au lieu d'une inondation case par case, avec un résultat identique : l'état simulé des Forges reste le même bit à bit.
- **Effet sur Les Forges** (1 500 ticks depuis la même sauvegarde) : 127 chantiers restants au lieu de 170, 857 tas rangés au lieu de 800, 1,2 colon inactif en moyenne au lieu de 1,8. Le temps de simulation par tick ne change pas de façon mesurable : l'accessibilité y coûtait déjà peu.

Suite du même chantier :

- **Premier donneur qui trouve** : les familles de candidats sont évaluées dans l'ordre des donneurs du colon et l'évaluation s'arrête dès qu'aucune famille restante ne peut battre le meilleur candidat. La planification coûte 27 % de moins sur Les Forges (1 423 → 1 033 ms pour 100 ticks), pour exactement le même travail effectué.
- **Faits calculés à la demande** : les préalables (patients, factures, carburant, rang de production, tables de tas…) ne sont calculés que si une famille atteinte en a besoin. Encore −22 % (1 090 → 852 ms), état simulé identique bit à bit.
- **Liste d'urgence** (`CacheWorkGiversInOrder`) : seuil fixé par les seuls types qui ont un donneur ordinaire, lutte contre le feu avant les besoins pour un colon inactif ; nettoyage, gardiennage et postes des factures dans l'ordre de RimWorld.
- **Forge et couture séparées de l'artisanat** (schéma 302, migration 301 → 302 par numéro seul) : trois priorités et trois colonnes, comme les types Smithing, Tailoring et Crafting du Core.
- **Recherche** : la table au plus grand facteur de vitesse de recherche d'abord, puis la plus proche (`WorkGiver_Researcher` priorisé). L'analyseur relié est trouvé dans l'index des structures par type, au lieu d'un parcours de toutes les structures.
- **Priorités initiales** (`EnableAndInitialize`) : un humain qui rejoint la colonie (départ réel, arrivée, quête, rescapé, recrutement) a ses six types de travail les mieux maîtrisés et les six types toujours actifs à 3, le reste à 0, comme dans RimWorld. Les scénarios pédagogiques et les mondes de test gardent leurs priorités historiques.
- **Masque de terrain** : un raccourci qui sautait la revalidation du masque de cases marchables en l'absence d'écriture marquée (`terrainWriteCount`) a été retiré le jour même. Il supposait que toute écriture de case est marquée ; un test qui remplace directement une case (`shallow-water-v403`) l'a mis en défaut. Le gain attendu (de l'ordre de 1 % de la simulation) ne justifie pas ce risque sans vérification complète sous `VERIFY_TERRAIN_CACHES=1`. Le masque reste revalidé par identité des objets `Tile`.

### Simulation : stade de vie des animaux, porteurs et cases solides (9 novembre)

Trois parcours répétés, remplacés à l'identique (état simulé des Forges identique bit à bit, empreinte `7314918c…`) :

- **Stade de vie des animaux** (`trackedAnimalLifeStage256`) : lu plusieurs fois par animal et par tick (nutrition maximale, taille, besoins), il recréait à chaque lecture un objet complet. Le résultat ne dépend que de l'espèce et du stade : un enregistrement figé par espèce et stade suffit. Part du profil 0,96 % → 0,21 %.
- **Qui porte ce colon** (`carrierOf`) : un seul passage sur les colons au lieu d'un par sorte de portage (sauvetage ou cryptosommeil, caisson spatial, groupe, enlèvement), avec la même priorité entre sortes. Part 1,48 % → 1,30 % : le coût tient surtout au nombre d'appels.
- **Case solide pour atteindre une saleté ou un feu** (`firefighting.ts`) : les structures ancrées sur la case viennent de l'index partagé des ancrages au lieu d'un parcours de toutes les structures. Environ 0,6 % de la simulation.

Les chronos de cette séance sont trop bruités pour isoler ces gains (charge concurrente sur la machine) ; seules les parts du profil sont retenues.

- **Couchages des animaux** (`animal-rest.ts`, `animal-rescue.ts`) : seuls les couchages pour animaux peuvent être retenus ; l'index des structures par type les donne dans l'ordre d'origine, au lieu de filtrer toutes les structures de la carte.
- **Capture des acteurs pour la publication** (`captureCoreActorFast297`, dans `core-frozen-copy-297.ts`) : `captureCoreActor297` reste figée (son contenu est vérifié par empreinte par la preuve de capture des phases). Le publieur utilise une version rapide qui copie avec `frozenDataCopy297`, déjà prouvée indiscernable de la copie de référence ; un test compare les deux captures sur de vrais acteurs, leurs refus et chaque descripteur. Dans le vrai Worker (Les Forges, ×6, parts du profil) : capture des acteurs 6,0 % → 3,4 % du temps du Worker, publication 23,3 % → 21,6 %.

Mesure du vrai Worker (`scripts/perf-worker-run.ts`) : la publication vers l'affichage pèse presque autant que la simulation (≈ 35 % contre ≈ 50 %). Le plus gros poste restant est le clonage des messages (`structuredClone`, ≈ 4 %), fixé par la taille des publications (≈ 960 Ko par publication complète, 80 Ko par paquet frontière). Le réduire demande de changer le protocole de publication, chantier à part.

Outils de test trouvés cassés pendant ce lot, antérieurs à ces changements :
- les longues campagnes qui importent `tests/scenarios/wood-conservation.ts` se figent au chargement depuis le commit `432de2cf` (17 octobre) : les remplacements de modules (`vi.mock` avec `importOriginal`) s'attendent mutuellement. Le mode `spy: true` évite le blocage mais laisse passer des appels, donc il ne convient pas ;
- `npm run test:presentation` échoue depuis le commit `649bba01` (1ᵉʳ novembre) : trois fichiers de `src/sim` importent sans extension, ce que Node refuse. Une fois ce point corrigé, son banc (`harvest-sync-bench.mjs`) construit un monde que le moteur refuse (« Stale physical path budget »).

Pistes écartées : un index des tas par case (délai de déplacement, scories d'une pièce) ou des plantes (pousse sauvage) exigerait un journal de toutes les écritures de tas, environ 270 sites dans 131 fichiers. Un oubli fausserait silencieusement la simulation, sans moyen de le détecter à coût nul.

### Tri des échecs des longues campagnes (9 novembre)

Une fois les campagnes débloquées, quatre d'entre elles échouaient : délais dépassés, objectifs manqués. Chaque échec a été attribué à une cause : deux vrais défauts du jeu, deux attendus périmés, des délais trop courts.

**Défaut 1 — colon bloqué en livrant un mur en bois (depuis le 1ᵉʳ novembre).**
- Depuis le lot « finir le cadre » (schéma 301), le chemin vers un mur en bois en chantier vise aussi ses quatre cases diagonales, comme le contact de RimWorld. Les cadres de murs se touchent par les coins : `TouchPathEndModeUtility`, `CanInteractThroughCorners` ; la livraison se fait en mode `Touch`.
- La livraison du bois (`processHaul`, `src/sim/hauling.ts`) n'acceptait encore que les quatre cases droites. Un porteur arrivé en diagonale restait « en déplacement », chemin vide, sans jamais livrer. Un autre colon reprenait ensuite la même boucle.
- Exemple : « joueur ordinaire » graine 2048, un mur provisoire bloqué 4 jours à 3 bois sur 5, avec 88 bois posés à côté. Rejoué depuis la sauvegarde, il est livré et achevé en moins de 150 ticks après correction.
- Correction : la livraison à un cadre de mur en bois (schéma 301 et suivants) accepte les mêmes huit cases de contact que le chemin. Les autres chantiers gardent le contact droit.
- Test : `tests/frame-delivery-touch301.test.ts`, qui échoue sur l'ancien code.
- Effet : ce blocage coûtait aussi du temps de calcul. Le raid passe de plus de 270 s à 150 s.

**Défaut 2 — souvenirs expirés gardés jusqu'à l'intervalle du colon (depuis le 8 novembre).**
- Depuis la cadence RimWorld de 150 ticks (`wellbeingLocalTicks`, schéma 301), les souvenirs expirés (repas, cadavres vus, deuils…) n'étaient retirés qu'à l'intervalle du colon, toutes les 15 unités de temps.
- La validation de sauvegarde exige qu'aucun souvenir expiré ne subsiste. Entre l'expiration et l'intervalle, le monde était donc invalide, et une sauvegarde faite à ce moment-là était refusée.
- Observé dans « Atterrissage » au tick 136 840 : souvenir « cadavre décomposé aperçu » expiré à ce tick exact.
- Correction (`src/sim/needs.ts`) : hors de l'intervalle, les souvenirs expirés sont retirés à leur tick, comme avant le 8 novembre. L'humeur et le confort gardent la cadence de 150 ticks. À chaque intervalle, l'humeur lit les mêmes souvenirs qu'avant, puisque le pas d'humeur commence de toute façon par les faire expirer.
- Écart assumé avec RimWorld : un souvenir y reste présent jusqu'au prochain intervalle, soit au plus 149 ticks de plus. Il est retiré ici à son tick exact. Cela ne change rien à l'humeur calculée ; seules les règles d'empilement d'un nouveau souvenir identique pendant ce court délai pourraient différer.
- Test : nouveau cas dans `tests/needs-interval-150.test.ts`, qui échoue sur l'ancien code.

**Attendus périmés.**
- « Atterrissage » : le bilan comptait comme biens de la colonie les 13 composants du stock d'un vaisseau marchand en orbite (propriétaire `orbital-ship`). Il les exclut désormais (`tests/scenarios/survivor-player.ts`).
- « Joueur ordinaire » graine 93 : avec l'ordre de travail RimWorld (schéma 301), où la cuisine passe avant la cueillette, le cuisinier transforme en repas unitaires tout stock de 10 unités. Les 40 unités d'un lot de quatre ne s'accumulent jamais : 34 cuissons unitaires, aucun lot.
  - L'attendu « au moins un lot » est remplacé par : un lot est exigé dès qu'il a été observé réalisable, c'est-à-dire ingrédients suffisants et réserve de repas non atteinte, lu par `queryCookingBillStatus`.
  - Les graines 42 et 2048 font toujours des lots.
  - En septembre, le stock à la fin du jour 1 était de 66 unités avec 1 repas ; il est aujourd'hui de 22 unités avec 6 repas.

**Délais.** Temps mesurés seuls, sur le code corrigé, avec une autre session active par moments : raid 150 s, Survivants 91 à 114 s (ancre 14 à 20 s), joueur ordinaire 210 à 342 s, Atterrissage 1 292 s. Nouveaux plafonds :

| Campagne | Ancien plafond | Nouveau plafond |
| --- | --- | --- |
| Raid | 180 s | 360 s |
| Survivants | 180 s | 360 s |
| Ancre et préparation des Survivants | 20 s | 60 s |
| Joueur ordinaire | 240 s | 600 s |
| Atterrissage | 1 200 s | 2 400 s |

Ce sont des plafonds de sécurité, pas des budgets de performance. Ils laissent de la marge à une machine chargée.

**Suite complète sur les corrections (10 novembre).** 1 862 fichiers (campagnes et tests facultatifs à part) : 8 627 tests réussis. Comparés à la liste des échecs connus (`tmp/perf/known-failures.json`), 13 échecs n'y figurent pas :
- 11 délais dépassés sous charge (paludisme ×3, deuil, cryptosommeil, alimentation, orage, habitat, scène V180, filtre de formation, refus de quête). Relancés seuls, ils passent tous, en 13 à 27 s pour un plafond de 30 s : marge faible, défaut antérieur.
- `main-terminal298` (« MainUI14 exact source mismatch ») échoue de la même façon sur `main` sans les corrections.
- `origami-endpoint-color` lit un fichier de `three` dans le `node_modules` du dossier de travail isolé, vide : artefact de l'environnement, le cas passe sur `main`.

Aucun échec ne vient des deux corrections. Attention, en comparant à la liste : lire les rapports JSON de Vitest en UTF-8, sinon les titres accentués ne correspondent plus et apparaissent à tort comme nouveaux.

**Changements de vitesse lents : le Worker n'est pas en cause.** Le contrôle de présentation relève des changements de vitesse lents (140 ms à 1,6 s, presque tous vers ou depuis ×6). La sonde `scripts/speed-latency-probe.ts` fait tourner le vrai Worker de présentation sous Node, sur le monde du contrôle (graine 42, 250², rectangle de minage, ×1 puis 6, 1, 3 toutes les 2 s, 17 changements). La demande de vitesse y passe par un minuteur, comme un message du navigateur : elle attend la fin de la tâche en cours du Worker.
- Attente avant traitement : 0,2 à 29,5 ms ; réponse 5,6 à 7,7 ms après.
- La simulation avance au nouveau rythme dès la tâche suivante : de ×1 à ×6, 18 ticks en 528 ms jusqu'à la publication suivante (34 par seconde pour 36 attendus).
- Paquets d'acteurs toutes les 31 ms environ, quelle que soit la vitesse.
- Retard de la boucle du Worker : médiane 10,8 ms, maximum 40 ms.

Le retard vient donc du fil principal : adoption des messages ou lecture du temps par l'affichage (`src/render/MotionTimeline.ts`). Piste à vérifier, pas une cause établie : en mode fin, chaque changement de vitesse remet le défilement en attente d'une réserve (`buffering`) et réinitialise l'estimation du débit confirmé. L'enregistrement des lots du Worker du contrôle (`HARVEST_TRACE=1`) est périmé : il cherche `stepWorld(world);` dans `simulation.worker.ts`, qui ne fait plus que déléguer à `simulation-runtime.ts`. Il faut le refaire côté fil principal avant de corriger.

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
5. ~~**Ordre des types de travail à priorité égale.**~~ Corrigé pour les sauvegardes actuelles, voir « Planification du travail et régions à la RimWorld ». `compareCandidate` utilise des rangs ad hoc ; par exemple l’artisanat passe avant la construction et la recherche avant le ménage. RimWorld suit l’ordre naturel de l’onglet Travail : Pompier > Patient > Docteur > Repos > Basique > Gardien > Animaux > Cuisine > Chasse > Construction > Culture > Minage > Coupe > Artisanat > Transport > Ménage > Recherche.
6. **Priorités par défaut.** Ici : 1 / 2 / 3. Dans RimWorld, les priorités manuelles sont désactivées par défaut et tout ce qui est autorisé vaut 3. Conséquence actuelle : un colon blessé ou malade continue de travailler au lieu de se reposer.
7. **Pas de ×12 automatique** quand tous les colons dorment (`TickManager.NothingHappeningInGame`).
8. **Cultures Core manquantes** : fraise, herbe à fumer, psychoïde, soie du diable.
9. ~~**Coût de déplacement**~~ — *à vérifier, probablement fidèle.* L’audit initial annonçait un arrondi entier de `TicksPerMove`. Cet arrondi date d’avant RimWorld 1.5. Le code d’Elsewhere reproduit en float32 `CostToMoveIntoCell` et `CostToPayThisTick` de la version 1.6 (build 4871), paiement fractionnaire compris, aussi bien pour les humains que pour les animaux. L’allure appliquée après le coût de terrain et le plafond de 450 est elle aussi fidèle. Point non retenu.

Ces correctifs n’ont **pas** été appliqués dans ce lot :

- **Points 1 à 4 et 8.** La validation des sauvegardes énumère, version par version, le contenu admis : types de souvenirs, cultures, champs… Tout ajout de contenu impose donc une montée de schéma ; la dernière a touché 129 fichiers. La refonte des prédicats de schéma de cette nuit réduit ce coût. L’étape suivante est de faire accepter par les validateurs le contenu connu des définitions courantes, au lieu de listes figées par version.
- **Points 5 et 6.** Ils changent un comportement que des centaines de tests épinglent au tick près.
- **Point 5.** Il demande de réorganiser la planification en « WorkGivers » ordonnés comme dans RimWorld : type de travail, puis `priorityInType`, puis distance. Ce n’est pas un simple changement de constantes.

### Écarts corrigés le 8 novembre : obscurité, crématorium, laboratoire

Source : les définitions XML de RimWorld 1.6.4871 et sa bibliothèque, décompilée localement pour lecture (rien n'est recopié). Les quatre corrections valent pour la famille de schémas actuelle (301) ; les schémas historiques gardent leur comportement, aucune donnée sauvegardée ne change de forme.

- **Obscurité et mécanoïdes.** Dans RimWorld, le facteur d'obscurité de la vitesse de déplacement (`StatPart_Glow` de `MoveSpeed` : ×0,8 sans lumière, ×1 à partir de 30 % de lumière) ne s'applique qu'aux humanoïdes (`humanlikeOnly`). Ici, les mécanoïdes ralentissaient aussi de 20 % dans le noir. Ils marchent désormais à pleine vitesse la nuit.
- **Obscurité et cécité.** Le même facteur, sur la vitesse de déplacement et sur la vitesse de travail globale (`WorkSpeedGlobal`), est ignoré pour un pion incapable de voir (`ignoreIfIncapableOfSight`, vue à 0). Le lissage des sols le faisait déjà ; c'est maintenant le cas de la marche, de la recherche, des établis et des autres travaux.
- **Crématorium électrique.** Il dérive de `BuildingBase`, sans `workTableRoomRole` (la [note de la crémation](../research/cremation-core-v314.md) le relevait déjà). Il ne subit donc pas le facteur ×0,8 hors d'un atelier et ne compte pas pour faire d'une pièce un atelier. Ici, il perdait 20 % hors d'un atelier.
- **Rôle « laboratoire ».** `RoomRoleWorker_Laboratory` compte 60 points par bâtiment de rôle Laboratoire (bancs de recherche, laboratoire de drogues), et non 54. Le multi-analyseur, équipement sans ce rôle, ne compte pas. Exemple : une pièce avec un banc de recherche, un multi-analyseur et trois établis d'atelier est un atelier (81 contre 60), et non plus un laboratoire (108 contre 81).

Les autres rôles de pièce relus (atelier 27 par établi, cuisine 28 par cuisinière, salle à manger 12 par table, loisirs 7, chambre et dortoir) étaient déjà conformes, comme la liste des établis pénalisés hors de leur pièce. Le banc de recherche avancé a bien, lui aussi, un facteur ×0,8 hors laboratoire : la règle actuelle était juste.

**Exactitude et tests.**
- Aucune des quatre parties de référence n'est touchée sur les durées mesurées. Les Forges après 150 ticks (deux passes), Les Éclaircies, Les Aulnes intégrées et Les Aulnes sièges après 300 ticks gardent leur empreinte : ces quatre règles n'y produisent aucune différence dans ces fenêtres.
- Le nouveau fichier `tests/darkness-room-fidelity-301.test.ts` (5 cas) vérifie chaque règle, avec son comportement historique au schéma 300.
- 402 fichiers de tests (mécanoïdes, crémation, recherche, établis, lumière, déplacement) : 0 régression face au commit précédent. Les fichiers ayant des échecs, relancés sur le commit précédent, y donnent les mêmes échecs, sauf un attendu : `cremation-presentation-v314` vérifiait qu'un crématorium seul fait de sa pièce un atelier ; son attendu suit désormais la règle de RimWorld (pièce sans rôle, aucun facteur).
- `energy-colony.test.ts` et `prison-colony.test.ts`, campagnes longues, ne collectent aucun test sans leurs variables d'environnement, puis empêchent vitest de se terminer : le blocage est identique sur le commit précédent. Ils ont été retirés des listes, car ils bloquaient tout leur paquet de tests.

## 6. Feuille de route recommandée (par gain attendu)

1. **Coût d’une publication complète sur le thread principal** (voir « Patchs de cargaison »). Sur Les Forges, environ 75 ms d’application par publication, jusqu’à 250 ms, plus l’admission du message. Il en reste 1,3 à 1,5 par seconde, presque toutes calmes ; les autres changements de dépendances (lit, repas, loisirs…) n’en provoquent plus que 0,1 par seconde.

   Prochaines étapes :
   - ~~profiler `applyWorld`~~ et ~~rendre incrémentaux le mobilier et les ajouts de ressources~~ : fait, voir « Coût d’adoption d’une publication complète » et « Mobilier par zones ». Restent des postes diffus de 5 à 11 ms par adoption : tas, cultures, propreté ;
   - ~~rendre la copie défensive des paquets de phase moins coûteuse~~ et ~~adapter l’intervalle des publications calmes à leur coût~~ : fait, voir « Fluidité en jeu sur Les Forges » ;
   - réduire le coût d’une publication complète elle-même (adoption ≈ 40 ms, application ≈ 50 ms sur Les Forges), puis l’étaler : chacune donne encore deux images longues consécutives ;
   - ~~ne plus renvoyer à chaque publication les 20 000 croissances de plantes~~ : fait, voir « Plantes, besoins et humeur à la cadence de RimWorld » ;
   - planificateur de travail par niveaux de priorité, avec arrêt au premier niveau trouvé et listes tenues à jour, comme RimWorld (voir [les cadences de RimWorld 1.6](../research/rimworld-16-tick-cadences.md#recherche-de-travail)) : c’est désormais le premier poste de la simulation (≈ 10 %).
2. **Rendu three.js** : environ 36 à 48 % du thread principal en jeu, pour 148 maillages visibles et 72 appels de dessin. Postes :
   - uniformes par objet : 11 % ;
   - passe d’ombre : 6,5 % ;
   - matrices : 6 %. 650 des 830 objets recalculent leur matrice à chaque image, dont 616 maillages invisibles.

   Passer en `matrixAutoUpdate = false` les objets statiques, avec une mise à jour explicite quand ils bougent, est le levier le plus sûr.
3. **Reconstruction d’un chunk de végétation** : encore 50 à 130 ms, mais rare, à l’apparition d’une plante dans le chunk. La découper en plusieurs images (corps, puis usure), ou calculer les tableaux dans un Worker.
4. **Chargement.** Fait en grande partie (voir « Lancement d’une partie », « Second lot de chargement » et « Chargement : ombres sans couleur, géographie allégée ») : 24 s pour une sauvegarde au schéma actuel des Éclaircies, contre 119 s au départ, avec une barre de progression. Restent, par gain attendu :
   - ~~le passage d’ombres de la scène~~ : programmes d’ombre sans graphe de couleur, 7,2 → 1,0 s de construction sur Les Forges ;
   - ~~un programme partagé entre espèces sauvages~~ : fait, voir « Chargement : un seul programme pour les animaux sauvages » (4,7 → 0,2 s sur Les Forges) ;
   - ~~variantes des colons hors réglage courant~~ : fait, voir « Chargement : préchauffage des colons limité au réglage courant » (≈ 1,3 s) ;
   - ~~un programme partagé entre lots instanciés de cultures~~ : fait, voir « Chargement : un seul programme pour les cultures » (10 → 2 constructions) ;
   - l’adoption du monde (≈ 4,3 s sur Les Forges) ;
   - avec l’accord du projet, la fusion des validations historiques (24 à 57 s pour une ancienne sauvegarde).
5. **Simulation, 80 colons (≈ 62 ms par tick, voir « Simulation des Forges : contrôles indexés »).** Le profil est plat : planification du travail ≈ 16 % (ménage, chantiers, accessibilité), déplacements ≈ 12 %, faune ≈ 11 %, coûts de navigation reconstruits à chaque recherche ≈ 3 % (≈ 5 % avant « Simulation : éclairage et coûts de navigation mémorisés »), recherche ≈ 4 % (dont propreté des laboratoires ≈ 1,3 %, voir « Simulation : propreté des laboratoires »). Ensuite, passer en `TickRare` / `TickLong` ce que RimWorld ne met pas à jour à chaque tick.
6. **Contenu sans montée de schéma** (voir § 5), puis les écarts RimWorld 1 à 4 et 8.
7. ~~**Planificateur en WorkGivers** façon RimWorld~~ — *fait* : ordre des donneurs, transport, régions, liste d'urgence, forge et couture séparées de l'artisanat, recherche par vitesse de table et priorités initiales (`EnableAndInitialize`) (voir « Planification du travail et régions à la RimWorld »).
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
