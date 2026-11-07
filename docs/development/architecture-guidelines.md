# Guide d’architecture et de performance

Ce guide fixe les règles qui gardent la simulation rapide et le code évolutif au fil des ajouts. Il complète le [rapport d’audit du 5 novembre 2026](audit-performance-2026-11-05.md).

## 1. Chaîne d’exécution

| Étage | Fichiers | Budget à ×6 (36 ticks macro/s) |
|---|---|---|
| Simulation (Worker) | `src/sim/**` ; un tick macro = 10 pas « Core » à 60 Hz | ≤ 15 ms par tick macro au total (~55 % d’un cœur) |
| Publication (Worker) | `src/bridge/simulation-runtime.ts`, `presentation.worker.ts`, encodeurs | Une publication complète coûte des dizaines de ms : il faut en publier peu |
| Adoption (thread principal) | `resident-presentation-assembler.ts`, `native-clone-resident.ts` | < 10 ms par publication |
| Rendu | `src/render/**` | 16,6 ms par image, dont ≤ 4 ms de CPU three.js |

Une seconde de jeu à ×6 représente 36 ticks macro et environ 360 pas Core. Tout coût payé « par tick » est donc multiplié par 36, et tout coût payé « par pas » par 360.

## 2. Règles de simulation

1. **Jamais de balayage O(carte) ou O(structures) par acteur et par pas.** Pour une requête de cellule, d’identifiant ou de type, passer par l’index partagé de `structure-navigation.ts` :
   - `captureStructureNavigation` (emprises par case) ;
   - `structureAnchors` (structures ancrées sur une case) ;
   - `structureById` ;
   - `structuresOfKind` ;
   - `structureMembershipToken` (jeton d’invalidation).
2. **Les caches inter-ticks sont permis s’ils ont un contrat d’invalidation exact, écrit en commentaire.** Contrats existants :
   - `world.structures` ne change qu’en ajoutant ou retirant des éléments, ou par remplacement du tableau ; le type, la position et l’orientation d’une structure sont immuables. Validation : identité, longueur, premier et dernier élément.
   - `world.resources` est remplacé à chaque changement de composition ; un cache keyé par identité du tableau est exact. Les champs de croissance (`growth`, `growthTick`, `growthThermalFactor`, `growthLight`, `plantLife`) peuvent changer en place et ne doivent jamais être mis en cache sans revalidation.
   - Le terrain d’une tuile (`terrain`, `collapsedRock`) ne change jamais en place : une édition remplace l’objet `Tile`. Valider par identité des objets tuile. `snowDepth` et `floor` peuvent être édités autrement : ne pas les inclure dans ce contrat.
   - Les tableaux de toits (`roofing.constructed`, `natural.thin`, `natural.thick`) sont triés et jamais modifiés en place (voir `roofIdentity`).
   - **Écritures physiques des cases.** Toute écriture en place d’une case (remplacement de la `Tile`, ou modification de `floor`, `bridge`, `snowDepth`…) doit être suivie de `markTerrainCellChanged(world.tiles, index)`, et une transaction globale de `invalidateTerrainJournal`. `terrainWriteCount(tiles)` compte ces appels, que le journal de présentation soit actif ou non : même tableau et même compte prouvent qu’aucune case n’a changé. La topologie des pièces et la couche de coûts de terrain de `navigationCosts` s’appuient dessus. Un écrivain qui oublierait la marque est détecté par `VERIFY_TERRAIN_CACHES=1` dans le banc (`setTerrainWriteCacheVerification`), qui recalcule et compare à chaque lecture.
   - Avant d’en écrire un nouveau, vérifier tous les sites de mutation, par exemple avec `grep "structures\.push\|structures\.splice"`.
   - Un cache qui n’a besoin que du jeton pour éviter un balayage peu coûteux utilise `peekStructureMembershipToken` : il ne construit pas l’index. Côté thread principal, chaque publication complète apporte un nouveau tableau de structures, et construire l’index (~8 ms sur Les Forges) pour un seul jeton coûte plus que le balayage évité.
   - Les tests doivent respecter les mêmes contrats : pour changer le type d’une structure, remplacer le tableau, jamais l’objet sur place.
3. **Les faits mutables sont lus en direct.** Un cache ne retient que l’appartenance et la géométrie, jamais l’état d’une porte, le carburant, l’alimentation ou la croissance.
4. **Ce qui est paresseux n’est pas gratuit.** Une fermeture appelée une fois par tick qui reconstruit un `Map` de 28 000 entrées coûte encore 36 fois par seconde. Préférer un index incrémental ou partagé.
5. **Pas de chaîne de caractères comme clé de cache sur des données volumineuses.** Ce motif a été retiré de la topologie thermique (`[...roofs].join(',')`) et du groupement des plantes (`${region}:${max}`).
6. **Cadence RimWorld.** Avant d’ajouter un système « à chaque tick », vérifier sa cadence dans RimWorld : `Tick`, `TickRare` (250 ticks) ou `TickLong` (2 000 ticks). Rappel : un tick macro d’Elsewhere vaut 10 ticks RimWorld.

## 3. Vérifier qu’une optimisation est exacte

```bash
npx esbuild scripts/perf-save-bench.ts --bundle --platform=node --format=esm --outfile=tmp/perf/bench.mjs
node tmp/perf/bench.mjs public/test-saves/v419/les-eclaircies.json 300 0
node tmp/perf/bench.mjs public/test-saves/v432/les-forges-crash-test.json 40 0
```

Le champ `stateSha256` est l’empreinte SHA-256 de l’état complet sérialisé. Une optimisation pure doit la laisser **identique** :

- `1bac02a8…9183` pour Les Éclaircies (300 ticks) ;
- `5d2cc273…be53` pour Les Forges (40 ticks).

Si une **règle de jeu** change volontairement, l’empreinte change : il faut le noter dans le message de commit.

Pour profiler, ajouter `PROFILE=tmp/perf/x.cpuprofile` à la commande du banc, puis lancer `scripts/perf-profile-summary.mjs`, `perf-profile-callees.mjs` ou `perf-profile-lines.mjs`.

Pour mesurer la chaîne réelle du Worker à ×6 (simulation, encodage, sidecars), utiliser `scripts/perf-worker-run.ts`.

## 4. Tests

Une partie des 1 900 fichiers de tests est obsolète : par exemple, certains attendent encore le schéma 297. Ne pas lancer toute la suite. Sélectionner :

- les tests récents, modifiés dans les dernières semaines (`git log --since`) ;
- qui touchent les modules modifiés.

Les lancer sur la branche **et** sur un worktree de `HEAD`, puis comparer test par test. Seuls les tests qui passent sur `HEAD` et échouent sur la branche sont des régressions.

Limiter le parallélisme (`--maxWorkers=3`) : chaque worker charge des parties lourdes et fait gonfler le fichier d’échange sur C:.

## 5. Versions de schéma

Les prédicats `isSchemaNNNOrLater` énumèrent aujourd’hui leurs versions en littéraux, de même que les listes `[290,…,301].includes(...)` et les tests `===301`. Chaque montée de version doit donc les mettre à jour à la main.

Règle pour le code nouveau :

- comparer numériquement à une borne inférieure, jusqu’à `SCHEMA_VERSION` ;
- n’utiliser une égalité stricte que pour un comportement réellement limité à une version historique.

## 6. Fichiers épinglés

`vitest.config.ts` épingle l’empreinte SHA-256 de quatre fichiers :

- `src/bridge/native-message-capture.ts` ;
- `src/bridge/core-phase-data-297.ts` ;
- `src/bridge/native-clone-resident.ts` ;
- `src/sim/core-movement-297.ts`.

Toute modification de ces fichiers doit mettre à jour l’épingle correspondante, sinon la configuration de test échoue.

## 7. Hygiène de `tmp/`

`tmp/` n’est pas versionné et a atteint plus de 80 Go. Les liens de la documentation vers `tmp/` sont désormais informatifs (`check:docs` ne les exige plus).

- Inventaire : `node scripts/tmp-inventory.mjs`. Il ne suit pas les jonctions.
- Supprimer d’abord les campagnes de mesure anciennes.
- **Ne jamais faire `rm -rf` sur un dossier qui contient une jonction** (par exemple `witness/node_modules`). Retirer d’abord la jonction avec `cmd /c rmdir`, sinon sa cible peut être effacée.
