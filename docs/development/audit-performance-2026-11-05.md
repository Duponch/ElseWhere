# Audit performance, architecture et fidélité RimWorld — 5 novembre 2026

Branche : `perf/sim-render-audit`. Ce document résume l’état du projet, les mesures, ce qui a été corrigé, et ce qu’il reste à faire, par ordre d’impact.

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

| Sauvegarde | Avant | Après | Vitesse max avant → après |
|---|---|---|---|
| Les Forges (80 colons, 7 512 structures, 250×250) | 216 ms/tick (sous-pas Core : 6,1 ms) | **138 ms/tick (−36 %)** (sous-pas Core : 1,6 ms, −73 %) | ×0,77 → **×1,21** : le temps réel ×1 est désormais tenu |
| Les Éclaircies (3 colons, 250×250) | 22,7 ms/tick | **16,3 ms/tick (−28 %)** | ×7,3 → **×10,2** |

Mesures faites machine au repos, Node 24, référence et branche lancées l’une après l’autre ; pour Les Éclaircies, moyenne de deux passes. Avec 80 colons, ×3 et ×6 restent hors de portée : il reste environ 117 ms par tick macro, à traiter avec la feuille de route ci-dessous.

**Déterminisme.** L’état sérialisé complet est identique au bit près avant et après, sur les deux sauvegardes. Empreintes : `1bac02a8…9183` et `fb205a07…9d72` (Éclaircies), `5d2cc273…be53` et `47b7bb58…bf08` (Forges).

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
6. **Repousse des plantes sauvages** (`wild-plant-runtime-256.ts`). La capture spatiale de toute la carte n’est plus construite pour une case que `pick()` rejette de toute façon (plante déjà présente, roche, neige ≥ 0,2, densité nulle). Ces conditions sont testées exactement.

## 4. Rendu et thread principal

Mesures sur Les Forges, dans Chromium sur un vrai GPU (WebGPU), en 1440×1000 à la vitesse ×1.

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
9. **Coût de déplacement non arrondi.** `TicksPerMove` utilise `RoundToInt` ; ici les diagonales sont 2,4 % plus lentes.

Ces correctifs n’ont **pas** été appliqués dans ce lot, pour deux raisons :

- les points 1 à 4 exigent une montée de schéma de sauvegarde, avec validateurs et migration ;
- les points 5, 6 et 9 changent un comportement que des centaines de tests de régression épinglent au tick près.

Chacun mérite un lot dédié avec mise à jour des tests.

## 6. Feuille de route recommandée (par gain attendu)

1. **Adoption des publications sur le thread principal**, soit ≈ 52 % de ce thread.
   - Ne plus relancer les validateurs de sauvegarde sur des sous-ensembles inchangés : mémoriser le verdict par tableau, ou valider une seule fois dans le Worker.
   - Copier les acteurs par partage structurel plutôt que par copie profonde.
   - Côté Worker, envoyer colons et animaux en deltas indexés par identifiant (≈ 400 des 764 Ko).
   - C’est le levier n° 1 contre les saccades.
2. **Chargement.** Fusionner les validateurs historiques en une seule passe et les sauter pour une sauvegarde au schéma courant produite par le jeu. Potentiel : chargement en quelques secondes au lieu de 30 à 140 s.
3. **Cadence RimWorld.** Passer en `TickRare` / `TickLong` les systèmes que RimWorld ne met pas à jour à chaque tick : éclairage et température des plantes, beauté, `reconcile*` coûteux. C’est à la fois plus fidèle et plus rapide.
4. **Index persistants** pour les ressources, les objets au sol et les tâches, avec un journal de mutations unique. Remplacer progressivement les balayages O(n) restants : `navigationCosts`, `planWork`, faune.
5. **×12 pendant le sommeil**, une fois le débit suffisant. Ce sera simple quand le type de vitesse publié (`0|1|3|6`) acceptera 12.
