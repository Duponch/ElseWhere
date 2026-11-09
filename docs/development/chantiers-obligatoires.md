# Chantiers obligatoires en attente

Ouverts le 9 novembre 2026. Ces deux chantiers **doivent être faits**, quel que soit l'ordre des autres priorités. Toute IA ou personne qui reprend le projet (feuille de route, bilan, nouvelle session) doit les traiter ou les reporter explicitement, jamais les oublier. Retirer un chantier de cette note, et du renvoi en tête d'`AGENTS.md`, seulement une fois fait et vérifié.

Ordre recommandé : **1 avant 2**. La refonte de la publication touche ce que surveille le contrôle de présentation, l'un des outils cassés du chantier 1.

## 1. Réparer les outils de test cassés

**État au 9 novembre au soir : outillage réparé, échecs révélés à trier.**
- Les longues campagnes ne se figent plus. Les sondes espionnent les fonctions exportées (`vi.spyOn` sur l'espace de noms du module) au lieu de remplacer les modules. Elles reconnaissent la même carte par son tableau de cases (`tests/scenarios/same-map.ts`), car la simulation peut leur passer l'objet racine de la campagne. Le bois détruit par un échec de construction est désormais compté (registre de bois en révision 2). Les campagnes d'instrumentation et de comptabilité du bois passent.
- `npm run test:presentation` va jusqu'au bout. Il révèle un vrai défaut, déjà présent avant le 9 novembre : un changement de vitesse met parfois 0,15 à 1,6 s à prendre effet, au lieu de moins de 0,1 s. Mesuré deux fois sur le code du 9 novembre au matin et sur le code du soir.
- **Reste à trier**, échecs déjà présents en grande partie sur le code du 9 novembre au matin :
  - délais écrits en dur dépassés (raid 180 s, « joueur ordinaire » 240 s, ancre des survivants 20 s, survivants 180 s), à mesurer seul plutôt qu'en parallèle avant d'en conclure quoi que ce soit ;
  - objectifs de partie manqués : « Atterrissage » (stock d'acier et de composants inattendu au tick 41000, aucun riz récolté pendant les premiers jours), « joueur ordinaire » (déconstruction attendue absente, un compteur à 0), « Survivants » (une valeur attendue à 3, obtenue à 0).

  Pour chacun, il faut établir s'il s'agit d'une règle volontairement changée depuis le 17 octobre (attendu à mettre à jour) ou d'une régression du jeu (à corriger).


Deux filets de sécurité automatiques ne fonctionnent plus. Les régressions qu'ils devaient détecter peuvent passer inaperçues depuis les dates indiquées.

### 1a. Les longues campagnes se figent au chargement (depuis le 17 octobre)

- **Fichiers touchés** (tous sous `tests/`) : `campaign-instrumentation-repair-first`, `campaign-instrumentation-wood-first`, `campaign-wood-accounting`, `colony-player`, `crashlanded-colony`, `environment-journey`, `raid-colony`, `survivor-colony`, plus les facultatifs `energy-colony` et `prison-colony`. Ils simulent plusieurs jours de vraie partie et vérifient la conservation (bois, repas, entretien) et la reprise exacte après sauvegarde.
- **Symptôme** : le processus de test reste à 0 % de processeur, sans qu'aucun test ne se termine. Le lanceur par lots (`tmp/perf/run-tests-chunked3.sh`) les signalait « inachevés », et ils étaient exclus de la suite complète.
- **Cause** : `tests/scenarios/wood-conservation.ts` remplace `src/sim/gathering.ts`, `src/sim/wildlife-food.ts` et `src/sim/wild-flora.ts` par `vi.mock(chemin, async importOriginal => …)`. Ces trois modules s'importent mutuellement à travers le graphe de la simulation : chaque fabrique attend l'original d'une autre, encore en cours de chargement, d'où un blocage. `ingestion-conservation.ts` (`eating.ts`) et `repair-conservation.ts` (`breakdowns.ts`) suivent le même schéma.
- **Commit fautif** (bissection avec un test minimal qui importe seulement ce fichier) : `432de2cf` du 17 octobre (V412, formation de caravane depuis le travail actif). Bons : `23e1984f`, `01277e6f` ; mauvais : `432de2cf` et suivants.
- **Déjà essayé, écarté** : `vi.mock(chemin, { spy: true })` puis `vi.mocked(fn).mockImplementation(...)` avec `vi.importActual`. Le blocage disparaît, mais dans `crashlanded-colony.test.ts` les sondes ratent des appels (« confirmed chopping and grazing » : 0 enregistrement ; sonde des repas : producteur manquant). Selon l'ordre de chargement, certains modules reçoivent l'original au lieu de l'espion. À ne pas reprendre tel quel.
- **Écarts observés** lors d'un passage débloqué, sur `01563e9f`, à trier : `colony-player` « Mood discontinuity » vers le tick 13-14 ; `raid-colony` 80163 au lieu de 80168 ; `survivor-colony` valeurs de point de contrôle à 1-3 près ; `crashlanded-colony` « ingestion producer missing » au tick 1937. Certaines différences peuvent venir de règles volontairement changées depuis : ordre de travail RimWorld à partir du schéma 301, priorités initiales `EnableAndInitialize` au schéma 302.
- **Fini quand** : les campagnes vont au bout sans blocage, avec des sondes qui interceptent réellement chaque appel. Chaque échec est corrigé (attendu périmé) ou documenté comme vrai défaut, sans assouplir les règles. Aucune API de test ajoutée dans `src/`.

### 1b. `npm run test:presentation` échoue (depuis le 1ᵉʳ novembre)

- **Première cause** : depuis le commit `649bba01` (1ᵉʳ novembre, permissions par zone), trois fichiers de `src/sim` importent sans extension `.ts` : `area-material-permission-256.ts` (imports de `./schema-compatibility-257`, `./exploration-state-256`, etc.), `designation.ts` et `engine.ts` (import de `./area-material-permission-256`). Vite les résout, donc le jeu fonctionne, mais le banc tourne sous Node (`--experimental-transform-types`), qui les refuse (`ERR_MODULE_NOT_FOUND`). Ajouter les extensions suffit.
- **Seconde cause**, visible une fois la première corrigée : `scripts/harvest-sync-bench.mjs` (ligne ≈ 76, un `applyCommand`) construit un monde que le moteur refuse. Message « Stale physical path budget », dans `createCoreMovement297` (`src/sim/core-movement-297.ts`) via `observeAcceptedConsoleCommand298` : le `corePathBudget297.tick` du monde du banc ne correspond pas à `world.tick`. Il faut mettre le banc à jour, pas assouplir le moteur.
- **Précaution** : le contrôle utilise par défaut `http://127.0.0.1:5173/`, qui peut être le serveur de développement de l'utilisateur. Lancer son propre serveur sur un autre port et passer `HARVEST_URL`.
- **Fini quand** : `npm run test:presentation` passe sur `main`.

## 2. Refondre la publication du Worker vers l'affichage

- **Constat** (banc du vrai Worker `scripts/perf-worker-run.ts`, Les Forges, ×6, parts du profil) : la simulation (`stepWorld`) pèse ≈ 50 % du temps du Worker et la publication ≈ 35 %. Principaux postes :
  - `publishDuePhysical297` ≈ 22 % (dont publications complètes `publishActualFull297` ≈ 12 %) ;
  - préparation des phases (`preparePhase`) ≈ 6 % ;
  - observation des acteurs ≈ 4 % ;
  - clonage des messages (`structuredClone` au `postMessage`) ≈ 4 %.
- **Volumes envoyés** : publication résidente complète ≈ 957 Ko environ 0,9 fois par seconde (≈ 19 ms de clonage chacune) ; paquets frontière des acteurs ≈ 80 Ko environ 8 fois par seconde (≈ 3 ms chacun).
- **Déjà fait** : la capture des acteurs utilise une copie rapide prouvée identique (`captureCoreActorFast297`), soit 6,0 % → 3,4 %. Le reste dépend surtout du volume et de la forme des données envoyées.
- **Pistes** :
  - n'envoyer que ce qui a changé ;
  - espacer ou alléger les publications complètes ;
  - tampons transférables plutôt que clonage d'objets ;
  - éviter les copies profondes répétées des mêmes données.
- **Contraintes** :
  - la présentation suit le tick confirmé, et l'affichage doit rester identique ;
  - les fichiers `src/bridge/core-phase-data-297.ts`, `src/bridge/native-message-capture.ts` et `src/bridge/native-clone-resident.ts` sont figés par empreinte SHA (`phaseCapturePlugin` dans `vitest.config.ts`) : pour changer leur comportement, passer par une variante prouvée identique ailleurs, comme `core-frozen-copy-297.ts` ;
  - `npm run test:presentation` est requis, d'où le chantier 1 d'abord.
- **Fini quand** : la part de la publication dans le Worker a nettement baissé sur Les Forges, mesurée par le même banc dans les mêmes conditions. Les tests de publication et le contrôle de présentation doivent passer.

## Références

- Mesures et décisions détaillées : [audit de performance](audit-performance-2026-11-05.md), section « Simulation : stade de vie des animaux, porteurs et cases solides (9 novembre) ».
- Planification du travail à la RimWorld : [note de conception](work-planner-rimworld.md).
