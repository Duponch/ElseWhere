# Chantiers obligatoires en attente

Ouverts le 9 novembre 2026. Ces chantiers **doivent être faits**, quel que soit l'ordre des autres priorités. Toute IA ou personne qui reprend le projet (feuille de route, bilan, nouvelle session) doit les traiter ou les reporter explicitement, jamais les oublier. Retirer un chantier de cette note, et du renvoi en tête d'`AGENTS.md`, seulement une fois fait et vérifié.

Ordre recommandé au départ : **1 avant 2**. La refonte de la publication touche ce que surveille le contrôle de présentation, l'un des outils cassés du chantier 1.

**Dernière décision de l'utilisateur (10 novembre, soir) : passer au chantier 4 (simulation) maintenant.** Le chantier 3 est mis en pause avec ses sauts résiduels (4 à 20 par passage, quatre classes décrites plus bas) ; le contrôle de présentation sert d'indicateur pendant le chantier 4 : une régression y ferait remonter nettement le nombre de sauts. La classe « rattrapage après une salve du Worker » relève de toute façon du chantier 4. Reprendre ensuite le reste du chantier 3, puis le reste du chantier 2.

Décision précédente, du même jour, après les deux premières tranches du chantier 2 : le chantier 3 (retard des changements de vitesse) maintenant, puis le chantier 4 (simulation). Le reste du chantier 2 passe après, son gain étant modeste.**

Ordre précédent, du même jour : chantier 2 d'abord, puis le chantier 3. Les outils du chantier 1 sont réparés. Il en restait un point, le retard des changements de vitesse : il est sorti du chantier 1 et devient le chantier 3, **à reprendre dès que le chantier 2 est fini et vérifié**, sans attendre une nouvelle demande.

## 1. Réparer les outils de test cassés

**État au 10 novembre, nuit : échecs des campagnes triés, deux vrais défauts du jeu corrigés, suite complète sans nouvel échec dû aux corrections.** Détail dans l'[audit](audit-performance-2026-11-05.md), section « Tri des échecs des longues campagnes (9 novembre) ».

**Reste de ce chantier : le délai des changements de vitesse, déplacé au chantier 3 ci-dessous.**

Historique de l'état précédent (outillage réparé, échecs révélés à trier) :
- Les longues campagnes ne se figent plus. Les sondes espionnent les fonctions exportées (`vi.spyOn` sur l'espace de noms du module) au lieu de remplacer les modules. Elles reconnaissent la même carte par son tableau de cases (`tests/scenarios/same-map.ts`), car la simulation peut leur passer l'objet racine de la campagne. Le bois détruit par un échec de construction est désormais compté (registre de bois en révision 2). Les campagnes d'instrumentation et de comptabilité du bois passent.
- `npm run test:presentation` va jusqu'au bout. Il révèle un vrai défaut, déjà présent avant le 9 novembre : un changement de vitesse met parfois 0,15 à 1,6 s à prendre effet, au lieu de moins de 0,1 s. Mesuré deux fois sur le code du 9 novembre au matin et sur le code du soir.
- **Triés le 9 novembre au soir** (échecs déjà présents en grande partie sur le code du matin) :
  - délais écrits en dur dépassés (raid 180 s, « joueur ordinaire » 240 s, ancre des survivants 20 s, survivants 180 s) : mesurés seuls, plafonds relevés ;
  - objectifs de partie manqués : « Atterrissage » (composants d'un marchand en orbite comptés, puis monde invalide par un souvenir expiré), « joueur ordinaire » (mur bloqué faute de livraison en diagonale ; lot de quatre jamais réalisable en graine 93), « Survivants » (même mur bloqué).

  Pour chacun, il fallait établir s'il s'agissait d'une règle volontairement changée depuis le 17 octobre (attendu à mettre à jour) ou d'une régression du jeu (à corriger) : voir l'audit.


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

**État au 10 novembre : deux tranches faites.** La part de la publication dans le Worker passe de ≈ 32 % à ≈ 24 % sur Les Forges à ×6 (même banc, passages alternés), et le jeu y avance de 12 à 16 % plus vite ; les paquets d'acteurs passent de 65 à ≈ 33 Ko à ×1 et coûtent 2,0 ms au fil principal au lieu de 5,5 ; la publication complète passe de 865 à 728 Ko à ×1. Détail dans l'[audit](audit-performance-2026-11-05.md), section « Publication du Worker allégée (10 novembre) ». Le contrôle de présentation échoue toujours, mais sur le seul retard des changements de vitesse (chantier 3).

**Reste dans ce chantier : la publication complète** (≈ 980 Ko, une par seconde, 11 à 12 % du Worker et ≈ 80 ms au fil principal). Par ordre de gain attendu : compteurs des colons et des animaux par colonnes au lieu de fiches entières (393 Ko), sections immuables retenues (66 Ko), horloge de pourriture des tas (59 Ko). À faire aussi : la mesure dans le vrai client (images longues à ×1 sur Les Forges), impossible le 10 novembre faute de mémoire libre. Outil à utiliser pour chaque étape : `scripts/publication-replay-record.ts` (mêmes messages, ou même contenu reconstruit, qu'avant).

**Fait le 10 novembre (seconde tranche) : la fiche d'âge des plantes en trois nombres.** Constat d'origine, gardé pour mémoire : une plante dont seule la fiche d'âge a avancé (`plantLife` : `age`, `darkTicks`, `nextCheck`, tous les 200 ticks) est renvoyée comme une fiche complète. Côté affichage, une fiche complète compte comme un changement « de base » de la ressource (`baseEdge` dans `src/bridge/resident-presentation-assembler.ts`, `resourceBaseUpdated` dans `src/bridge/snapshots.ts`), que lisent l'index des ressources de la scène (`src/render/scene-resource-index.ts`), la partition des cultures (`src/render/crop-presentation-partition.ts`) et la validation (`src/sim/owned-validation-resources.ts`). Sur Les Forges, cela fait ≈ 1 080 changements de base par publication complète pour rien de visible. Une voie compacte pour ces trois nombres, sur le modèle de la croissance (`growth`, déjà lue à trois endroits : l'encodeur et le décodeur de `snapshots.ts`, deux chemins de l'assembleur), retirerait les 272 Ko et ces changements de base. À vérifier avant : qu'aucun de ces trois lecteurs ne dépend de la fiche d'âge ; `leaflessAt` (feuillage) doit rester une fiche complète.

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

## 3. Retard des changements de vitesse (à reprendre après le chantier 2)

**État au 10 novembre, soir : le retard est corrigé, le contrôle de présentation ne passe pas encore.** Les 22 changements de vitesse passent sous 100 ms sur trois passages (maximum 94 ms). La cause n'était pas la vitesse : à chaque roche minée, les matériaux des rochers étaient marqués « à reconstruire » sans raison et toute la scène était recompilée (120 à 330 ms sans image, 36 fois en 45 s) ; l'affichage prenait aussi jusqu'à 0,2 s de retard à ×6 sans jamais le rattraper. Détail dans l'[audit](audit-performance-2026-11-05.md), section « Changements de vitesse lents et gels d'image en minant (10 novembre) ».

**Suite du 10 novembre, soir.** Les changements de vitesse ne figent plus et ne sautent plus : l'affichage joue à la vitesse moyenne jusqu'à la nouvelle réserve (délai maximum 37 à 41 ms sur quatre passages tracés, un cas à 106 ms sur deux passages ordinaires). Le témoin des sauts modélise maintenant le `PawnTweener` de RimWorld : il reste **4 à 20 sauts par passage**, en quatre classes décrites dans l'[audit](audit-performance-2026-11-05.md), section « Changements de vitesse sans gel ni saut ». Les causes sont surtout côté Worker (salves après une pause d'environ 100 ms en minant, corrections d'arêtes) ou d'ordre d'adoption (départ appris une image trop tard). Aucune case rocheuse occupée sur les six derniers passages.

**État antérieur (même soir) : témoin des « sauts » réécrit.** Les acteurs écrivent désormais leur position courante au lieu d'un segment de trajet : la preuve de continuité se fait sur la position affichée, qui doit être sur son arête confirmée à l'instant affiché, à 0,0002 case près, dans les deux images (`confirmedTravelExcess` dans `scripts/harvest-assertions.ts`). Sur un passage, 954 alertes sur 985 sont ainsi prouvées continues ; il reste **31 écarts**, contre ≈ 1 100 avant.

**Reste pour fermer ce chantier**, par classe (un passage, à refaire au calme) :
- 17 images où le colon est affiché hors de son arête, mais à moins de 0,30 case : c'est l'approche de son poste de travail. L'ancienne preuve tolérait cette enveloppe sur les segments ; il faut l'équivalent sur la position, à partir des transitions d'approche que le contrôle enregistre déjà (`approach`, `workOffset`).
- 6 images d'arrivée : le temps affiché a dépassé la fin de la dernière arête confirmée et le colon est au bout de l'arête, ou à moins de 0,30 case.
- 6 images au premier passage de ×1 à ×6 (les trois colons, deux fois) : la position bouge de 0,7 case sans que le temps affiché avance, puis le temps saute de 1,4 tick en une image. Cause tracée image par image (`start-trace` du contrôle) : à une accélération, l'affichage se fige 30 à 70 ms le temps de remplir la réserve de la nouvelle vitesse, puis rejoint d'un coup ; les positions suivent une image plus tard. **Correction proposée, pas encore faite** : ne plus figer ni sauter à un changement de vitesse en cours de jeu, mais jouer ≈ 70 ms à la vitesse intermédiaire (moyenne de l'ancienne et de la nouvelle) jusqu'à ce que l'avance confirmée atteigne la nouvelle réserve, dans les deux sens. Cela donnerait aussi de la marge aux accélérations, et supprimerait le saut en avant d'environ 0,8 case fait aujourd'hui à chaque ralentissement de ×6 à ×1. À faire dans `MotionTimeline` avec ses tests de contrat (`fine-frontier-catchup297`, `confirmed-rate-events297`, `confirmed-supply-memory297`, `confirmed-underflow-recovery297`, `fine-overfull-join297`).
- 2 images où l'arête confirmée a été sautée ou remplacée.
- Les images où un colon est dessiné dans une case encore rocheuse (0 à 113 selon les passages).
- Les accélérations passent avec peu de marge (jusqu'à 94 ms au calme, 102 ms sous charge).

Noté le 10 novembre à la demande de l'utilisateur, pour y revenir après la refonte de la publication.

- **Symptôme** : au contrôle de présentation (`npm run test:presentation`), un changement de vitesse met parfois 0,14 à 1,6 s à se voir à l'écran, au lieu de moins de 0,1 s. Presque tous les cas sont vers ou depuis ×6. Défaut déjà présent avant le 9 novembre. C'est la seule raison pour laquelle ce contrôle ne passe pas encore.
- **Ce qui est établi** : le Worker n'est pas en cause. La sonde `scripts/speed-latency-probe.ts` (vrai Worker de présentation sous Node, monde du contrôle, 17 changements) mesure une attente de 0,2 à 29,5 ms avant traitement, une réponse 5,6 à 7,7 ms après, et la simulation au nouveau rythme dès la tâche suivante. Chiffres détaillés dans l'[audit](audit-performance-2026-11-05.md), paragraphe « Changements de vitesse lents : le Worker n'est pas en cause ».
- **Piste, pas une cause établie** : le défilement du temps côté affichage (`src/render/MotionTimeline.ts`). En mode fin, chaque changement de vitesse remet le défilement en attente d'une réserve (`buffering = true`, `ready = Infinity`) et réinitialise l'estimation du débit confirmé ; la reprise dépend ensuite de l'arrivée des paquets d'acteurs (`FINE_LATE_RECEIPT_MS297 = 100`). L'adoption des messages par le fil principal est l'autre candidat.
- **Lien avec le chantier 2** : la cause ne dépend pas du volume publié par le Worker. Mais la refonte change la forme et la cadence des messages que `MotionTimeline` reçoit : refaire la mesure après elle, pas avant.
- **Premier pas** : l'enregistrement de diagnostic du contrôle (`HARVEST_TRACE=1` dans `scripts/harvest-sync-bench.mjs`) est périmé. Il cherche `stepWorld(world);` et `advanceSimulation` dans `simulation.worker.ts`, qui ne fait plus que déléguer à `src/bridge/simulation-runtime.ts`. Le refaire côté fil principal : pour chaque changement, heure de la demande, de la réponse, de chaque message adopté, et état de `MotionTimeline` (attente, réserve, débit) image par image. Corriger seulement une fois la cause vue dans cette trace.
- **Contraintes** : la présentation suit le tick confirmé ; pas de temps affiché non joué, pas de faux accusé de réception. Le critère du contrôle (`visibleSpeedResponse` dans `scripts/harvest-assertions.ts`) ne doit pas être assoupli.
- **Fini quand** : `npm run test:presentation` passe sur `main`, plusieurs passages de suite.
- **Relevé du 10 novembre, après la première tranche du chantier 2** (un passage, client réel) : 3 changements de vitesse sur 22 au-dessus de 100 ms (142, 171 et 194 ms, tous vers ×1 ou ×6), contre des retards jusqu'à 1,6 s la veille. Mesure à refaire plusieurs fois avant d'en conclure quoi que ce soit.
- **Autres attentes du même contrôle, masquées par celle-ci.** L'assertion sur la vitesse échoue la première et arrête le contrôle ; avec `HARVEST_VERIFY_SPEED=0`, la suivante échouerait aussi, et déjà avant le 10 novembre : 1 018 à 1 134 « sauts » de position et 57 à 116 images où un colon est dessiné dans une case encore rocheuse (`jumpCount`, `solidOccupancyCount` dans le rapport `artifacts/harvest-sync-verification.json`). À trier dans ce chantier : vrai défaut d'affichage ou seuil du contrôle périmé.

## 4. Alléger la simulation des grandes colonies (en cours depuis le 10 novembre au soir)

Décidé par l'utilisateur le 10 novembre. À faire après le chantier 3, pas avant.

- **Constat** (Worker réel, Les Forges, ×6, après les deux tranches du chantier 2) : un tick coûte ≈ 100 ms, dont ≈ 70 ms de simulation et ≈ 24 ms de publication. Le jeu joue ≈ 10 ticks par seconde pour 36 demandés. Même avec une publication gratuite, il plafonnerait vers 14.
- **Ce qu'il faut** : ×3 demande moins de 55 ms par tick tout compris (simulation vers 35 à 40 ms, presque deux fois moins) ; ×6 demande moins de 28 ms (simulation vers 15 à 18 ms, environ quatre fois moins). Tenir ×3 sur Les Forges est l'objectif réaliste ; ×6 sur 80 colons et 241 animaux n'est pas promis.
- **Profil plat**, pas de coupable unique (parts du Worker à ×6) : animaux ≈ 12 %, déplacements physiques ≈ 8 %, planification du travail ≈ 7 %, soins et repos des animaux ≈ 5 % chacun, températures ≈ 4 %, flore sauvage ≈ 3 %. Détail des optimisations déjà faites dans l'[audit](audit-performance-2026-11-05.md), sections « Simulation… ».
- **Piste principale** : ne plus tout recalculer à chaque tick, comme RimWorld (`TickRare` toutes les 250 ticks, `TickLong` toutes les 2 000), voir [les cadences de RimWorld 1.6](../research/rimworld-16-tick-cadences.md). Tout changement de cadence est un changement de règle : il passe par un nouveau schéma et se vérifie contre le vrai jeu.
- **Premier pas** : une liste de cibles chiffrées tirée du profil (gain attendu, risque pour les règles), avant de toucher au code.
- **Contraintes** : une optimisation pure garde l'état simulé identique bit à bit (`scripts/perf-save-bench.ts`) ; la simulation reste déterministe.
- **Fini quand** : ×3 est tenu sur Les Forges (18 ticks par seconde au banc `scripts/perf-worker-run.ts`), sans régression des règles.

**Cibles chiffrées (10 novembre, soir).** Banc `scripts/perf-save-bench.ts` (simulation seule, Node, Les Forges, 200 ticks) : 72 à 89 ms par tick selon la charge de la machine, empreinte d'état `7314918c…`. Parts du profil (temps inclusif) :

| Poste | Part | Nature | Piste |
|---|---|---|---|
| Faune (`advanceWildlife`) | 11,7 % | structurelle | relations porteur / réservation / maniement cherchées sur tous les pions à chaque animal (≈ 3 %), recherche de menaces proches (`considerFlee`, 1,7 %), navigation |
| Déplacements fins (ticks Core intermédiaires) | 11,4 % | structurelle | `startTravel` 4,7 % (vitesse, gêne du mobilier, cases hostiles recalculées à chaque pas), `canStep` 2,6 %, grille des cases bloquées 1,3 % |
| Planification du travail (`planWork`) | 10,3 % | structurelle | ménage 1,9 %, chemins vers les tâches 1 %, accessibilité 0,8 % |
| Température de surface et flore sauvage | 6,9 % | exacte | flore 4,5 %, dont capture spatiale de la carte reconstruite à chaque tick où une plante peut pousser (≈ 2,7 %) |
| Cuisine, recherche, réparations, énergie | 2 à 3 % chacun | exacte surtout | réparations : tous les bâtiments testés à chaque tick |
| Corps de `stepLocalWorld` | 5 % | à détailler | |
| Récupération mémoire | 3,7 % | diffuse | allocations par tick |
| Lectures des champs partagés de la carte (`tick`, `nextId`…) | 1,7 % | exacte | chaque lecture passe par une fonction de renvoi vers la campagne |

« Exacte » : même état bit à bit, vérifié par l'empreinte sur Les Forges et Les Éclaircies. « Structurelle » : refonte d'un sous-système qui garde les règles, à prouver par l'empreinte ou, si l'ordre des tirages change, par les tests du domaine. Aucun changement de cadence n'est envisagé pour l'instant : un tick local vaut déjà 10 ticks de RimWorld, la simulation tourne donc déjà dix fois moins souvent que le jeu pour la plupart des systèmes.

Le profil est plat : il n'y a pas de levier unique. Les postes exacts réunis valent ≈ 15 à 20 % ; atteindre ×3 demande aussi les trois refontes structurelles. **C'est un chantier de plusieurs jours.**

**Fait le 10 novembre au soir (exact, même empreinte sur Les Forges et Les Éclaircies) :**
- grille des cases bloquées : la vérification complète des 62 500 cases à chaque construction est sautée quand aucune case n'a été écrite (compteur d'écritures du terrain, déjà utilisé par d'autres caches ; `VERIFY_TERRAIN_CACHES=1` refait la vérification et lève une erreur sur une écriture non signalée) ;
- réparations : le test « endommagé » passe en premier, les autres tests, plus coûteux, ne sont faits que pour les rares bâtiments endommagés ;
- deux constructeurs de scénarios remplaçaient des cases sans les signaler au compteur : ils le font désormais.

## Méthode de test (décidée le 10 novembre)

La suite complète prend environ 4 heures : elle ne doit plus bloquer le travail.

- **Avant chaque commit** : `sh scripts/test-related.sh` (les tests qui importent les fichiers modifiés, choisis par Vitest ; quelques minutes).
- **Avant de pousser un changement large** : `sh scripts/test-fast.sh` (tout sauf les fichiers les plus lents de `scripts/slow-tests.txt`, qui font ≈ 80 % du temps).
- **Une fois par nuit** : `sh scripts/test-chunked.sh` (suite complète), triée le lendemain contre la liste des échecs connus (`tmp/perf/known-failures.json`, à lire en UTF-8).
- **Pendant une suite** : continuer à coder et à vérifier dans un second dossier de travail ; seules les mesures de vitesse attendent une machine au calme.
- **Décidé par l'utilisateur le 10 novembre** : les 272 fichiers dont tous les tests échouent depuis longtemps (anciennes preuves figées sur de vieux formats, ≈ 13 % du temps de la suite complète) sont listés dans `tests/retired-tests.txt` et sortis du lancement par défaut, sans être supprimés ; `RETIRED_TESTS=1` les relance.

## Références

- Mesures et décisions détaillées : [audit de performance](audit-performance-2026-11-05.md), section « Simulation : stade de vie des animaux, porteurs et cases solides (9 novembre) ».
- Planification du travail à la RimWorld : [note de conception](work-planner-rimworld.md).
