# Passation du 23 novembre 2026

Ce document permet à un nouvel agent de reprendre Elsewhere sans relire l'historique. Il résume le contexte, ce qui vient d'être fait, ce qui n'est pas fini et la suite prévue. L'état de référence est `origin/main` au commit `63757f38` ou après, au **schéma 377**.

**Mise à jour du 24 novembre :** lire aussi le [bilan de la reprise](bilan-20261124.md). Les lots qui étaient urgents ici ont avancé dans les fichiers locaux du dépôt principal (toujours non committés) jusqu'aux boîtes de message, Options, accueil, chargement et pages de création (lot 12), puis au [gestionnaire des sauvegardes et au commerce local/orbital](fenetres-rimworld-sauvegardes-commerce.md) (lot 13), au [commerce des caravanes, rencontres et voyages individuels](fenetres-rimworld-commerce-monde.md) (lot 14), aux [fiches d'information et onglets animaux](fenetres-rimworld-information-animaux.md) (lot 15), à la [remise des demandes commerciales de quête](fenetres-rimworld-remise-commerciale.md) (lot 16), aux [statistiques de pièce et de beauté](fenetres-rimworld-environnement.md) (lot 17) et aux [gestes de sélection, raccourcis, recherche et jauges](fenetres-rimworld-gestes-20261124.md) (lot 18). Ne pas repartir de la version Git distante ni écraser ces modifications avec la copie `tmp/rule-wt` plus ancienne. Reprendre aux menus (tri et pâlissement) et info-bulles pendant le clic ; la file d'ordres générale demande un vrai chantier de simulation. Les compteurs de carrière, les aptitudes non implémentées et les autres nouvelles règles ne sont pas inventés par l'interface. Schéma 377 inchangé ; qualification visuelle réelle toujours ouverte.

## 1. Le projet et ses règles permanentes

**Elsewhere est un clone en 3D de RimWorld** (jeu de base 1.6, sans extensions), écrit en TypeScript :

- simulation déterministe dans un Worker (`src/sim`) ;
- pont de commandes (`src/bridge`) ;
- rendu Three.js/WebGPU en low poly, avec deux styles de peinture, Pastel et Gouache (`src/render`) ;
- interface « carton » native dessinée dans la scène (`src/ui3d`, `src/ui`).

L'utilisateur est le développeur. Il écrit en français et attend toutes les réponses en français, sans jargon.

Règles à ne jamais oublier :

- **Gameplay identique à RimWorld, pour toujours.** La source de vérité est le code de Ludeon, décompilé localement avec :
  ```
  dotnet E:/Code/RimWorld/tmp/reference-tools-v491/ilspycmd-8.2/tools/net6.0/any/ilspycmd.dll -t <Namespace.Classe> E:/Steam/steamapps/common/RimWorld/RimWorldWin64_Data/Managed/Assembly-CSharp.dll
  ```
  Les définitions sont dans `E:/Steam/steamapps/common/RimWorld/Data/Core/Defs/`.
  - Reprendre les mêmes algorithmes, constantes, ordres et tirages, **réécrits** dans notre code.
  - Ne jamais coller de code décompilé.
  - Ne jamais copier dans le dépôt les textes ou les images du jeu. Les textes du jeu installé sont lus à l'exécution, sur la machine du joueur (Options → « Textes de RimWorld »).
- **Le lore (histoires, noms, factions) est cloné pour l'instant mais reste séparable**, recensé dans `lore.html`, pour une réécriture future par l'utilisateur.
- **Toute règle persistante nouvelle exige un changement de schéma.** On migre en validant strictement l'ancien schéma, sans rien offrir de rétroactif.
- **Aucun coût de performances notable.** Les acteurs et effets restent dans des lots GPU résidents, sans recherche ni allocation par image. On mesure toujours avant et après.
- **Tests avec le son et la musique coupés.** Au plus `--maxWorkers=2` : la machine est partagée.
- **Interdits :**
  - le port 5173 et son serveur, qui sont ceux de l'utilisateur ;
  - toucher ou committer `references_UI/` ;
  - copier ou committer une sauvegarde `.rws` de l'utilisateur (les conversions vont dans `tmp/rws-import/`) ;
  - afficher `ELEVENLABS_API_KEY` ;
  - publier sur Cloudflare sans accord explicite (dernière publication Cloudflare : 13 novembre, `f13c7a36`) ;
  - forcer un push.
- **Commits et pushes sur `origin/main` sont autorisés.** Terminer chaque message de commit par `Co-Authored-By: …`.
- **Disque :**
  - exécuter `node scripts/check-storage.mjs` avant les lots lourds (il faut au moins 2 Gio libres par volume) ;
  - définir `TEMP`, `TMP` et `NPM_CONFIG_CACHE` sous `E:/Code/RimWorld/tmp/host-cache/` ;
  - ne jamais vider `tmp` globalement : il contient des preuves et des sauvegardes uniques.
- **Jonctions `node_modules`** :
  - une copie de travail se branche avec `cmd /c mklink /J node_modules E:\Code\RimWorld\node_modules` et se débranche avec `cmd /c rmdir node_modules` ;
  - **ne jamais effacer récursivement un dossier qui contient une jonction** : le 23 novembre, cela a supprimé une partie des dépendances partagées ;
  - vérifier qu'un port est libre (`Get-NetTCPConnection -LocalPort N`) avant de lancer Vite ;
  - ne jamais arrêter un processus qu'on n'a pas lancé ;
  - Vite écoute sur `localhost`, pas sur `127.0.0.1`.

## 2. Documents à lire, dans cet ordre

1. `AGENTS.md`, premier paragraphe : l'état courant, très dense.
2. `docs/development/chantiers-obligatoires.md` : quatre chantiers qu'il ne faut jamais oublier.
3. `docs/development/feuille-de-route-20261115.md` : « les bases d'abord ».
4. `docs/development/chantier-retours-20261122.md` : les 33 retours de l'utilisateur, cochés au fil des livraisons.
5. `docs/development/bilan-20261122.md` : les lots du 22 et du 23 novembre, les tests et, en section 5, ce qui reste.
6. `docs/development/rimworld-ui-reference.md` : dimensions de toutes les fenêtres de RimWorld lues dans le code, avec les écarts d'Elsewhere.
7. Notes des lots récents :
   - fenêtres : `fenetres-rimworld-fiche-bio.md`, `-onglets.md`, `-inspection.md`, `-hud.md`, `-tableaux.md` ;
   - `interactions-rimworld.md`, `developer-mode.md`, `audio-coverage-20261122.md`, `action-particles-20261122.md`, `retours-20261122-vague3-animations.md`, `rules-page.md`, `planet-parity.md`, `rws-import.md`, `lore.md` ;
   - `docs/gameplay/animals-to-pens-377.md`.
8. `docs/development/testing.md`.

## 3. Ce qui a été fait les 22 et 23 novembre (tout est publié sur origin/main)

- **Schémas 367 à 377** :
  - murs lissés ;
  - Pyromane ;
  - plans ;
  - les 166 histoires du jeu de base ;
  - semis retiré sous une plante nouvelle ;
  - compétences et passions à la naissance ;
  - beauté de la roche brute ;
  - boîte à œufs ;
  - conformité ;
  - même planète à graine égale (376) ;
  - **animaux menés à l'enclos et clôtures (377)**.

  Les campagnes « prison » et « Atterrissage » sont vertes au schéma 377.
- **Outils** :
  - import des sauvegardes RimWorld 1.6 (bouton dans « Charger une partie ») ;
  - comparaison de planète (`scripts/planet-parity.ts`) ;
  - page du lore ;
  - lecture des textes du jeu installé.
- **Chantier des retours** (`chantier-retours-20261122.md`) :
  - vague 1 :
    - pages développeur, page des sons ;
    - fin de marche, tête sur le lit, travail assis, corps à corps ;
    - petites corrections visuelles et sélection ;
  - vague 2 : fantômes des chantiers, clic sur le modèle, enclos, page des règles `rules.html` ;
  - vague 3 :
    - particules d'action redessinées (`src/render/ActionParticleLayer.ts`, catalogue `action-particle-catalogue.ts`) ;
    - gestes assis et animaux au repos, pelages, page `animations.html` ;
    - 111 sons du jeu générés et branchés, décodés à la demande dans une mémoire de 32 Mio (`src/audio/decoded-cache.ts`) ;
  - soir du 22 : interactions alignées sur le code de RimWorld :
    - menu flottant au clic droit, survol de case, info-bulles stables ;
    - sélection au rectangle, Maj pour la file, virgule et point pour changer de colon ;
    - roche nommée, jauges de travail ;
  - **mode développeur en jeu** (Options → Développeur) ;
  - **fenêtres identiques à RimWorld, lots 1 à 5** :
    - une seule échelle de texte en points RimWorld (`src/ui3d/native-ui-scale.ts`) : un test échoue sur toute taille de texte locale ;
    - fiche Bio ;
    - barre d'inspection 432 × 165 et onglets ;
    - intérieurs des onglets du colon ;
    - inspection des animaux, bâtiments, plantes, objets et zones ;
    - barre des colons, alertes, lettres, colonne du temps ;
    - tableaux Travail, Planning, Assignations, Animaux, Faune.
- **Tests retirés ou requalifiés** :
  - `main-terminal298` est retiré : il épinglait l'empreinte de `main.ts` ;
  - la preuve `native-phase-capture297` est requalifiée (empreinte dans `vitest.config.ts`) ;
  - trois échecs anciens de rendu (`fixed-tree-world-admission`, `shared-surface-scene-transaction`) sont ajoutés aux échecs connus.

## 4. Ce qui n'est pas fini — à reprendre en premier

*Historique de la passation du 23 novembre : les travaux locaux du 24 couvrent maintenant les points 1 et 2, ainsi que les fenêtres jusqu'au lot 18. Voir le bilan actualisé avant de reprendre ; les preuves en client visuel et la publication ne sont pas acquises.*

1. **Défaut publié : le menu d'ordres reste bloqué.** Avec un colon sélectionné, un clic droit sur des objets au sol ouvre le menu, qui reste bloqué sur « Vérification des accès… ». Les options n'arrivent jamais et la console ne montre aucune erreur. Le défaut est vu dans le client sur la version `a5bb9546` et existe avant le lot 6.
   - Code : `nativeOrderPage` dans `src/ui3d/native-orders.ts`, environ lignes 95 à 260. Il affiche d'abord `message()`, attend `client.orderOptions`, puis appelle `read()` et `present()`.
   - Appel dans `src/main.ts`, `renderer.onContext`, vers la ligne 3188.
   - Pistes à vérifier :
     - la réponse du Worker arrive-t-elle ? (`order-options` dans `src/bridge/simulation-runtime.ts`, ligne 561) ;
     - `read()` voit-il la sélection changer et appeler `close()`, qui vide `nativeCustomPage` sans retirer la page affichée ?
     - la page flottante est-elle réellement remplacée par `showPage` après les lots des fenêtres ?
   - Défaut lié : le menu remplace la barre d'inspection du colon tant qu'il est ouvert, alors que RimWorld la garde.
   - Reproduction : `?scenario=camp&e2e=1&size=250`. Sélectionner Ada dans la barre des colons, puis faire un clic droit sur les provisions au sol près du point d'atterrissage.
2. **Lot 6 des fenêtres, non publié** : l'Architecte, le menu flottant et les info-bulles aux dimensions de RimWorld (`MainTabWindow_Architect`, `FloatMenu`, `ActiveTip`).
   - Le travail est sur la branche `worktree-agent-af125ac7cafdaf765`, commits `01e67bf0` et `def9404a`. Le brief est dans `tmp/handoff-20261123/brief-retours-w4-lot6.md`.
   - Trois tests de mise en page échouent : l'Architecte déborde quand l'interface est réduite (`native-layout-scale-v485`, `native-layout-v480`, `native-natural-structured-storage-layout`). Il faut les corriger avant intégration.
   - Le menu flottant de ce lot n'a pas été vu dans le client, à cause du défaut du point 1.

## 5. Suite prévue

**Court terme** (chantier des retours, section H, et vague 4 des fenêtres) :

- Les points 1 et 2 ci-dessus.
- Fenêtres restantes, dans l'ordre de la section 7 de la référence :
  - Recherche (RimWorld a un arbre, Elsewhere un catalogue) ;
  - Quêtes, Historique, Factions, Menu ;
  - dialogues, Options, chargement ;
  - pages de création de partie (`Page_*`) ;
  - onglets d'animaux restants.

  Restent aussi :
  - barres de défilement de 16 ;
  - boutons « renommer » et « bannir » de la fiche Bio (les gestes n'existent pas encore dans la simulation) ;
  - résumé des compétences d'équipe sur la page des colons de départ.
- **File de tous les ordres avec Maj** : équiper, porter, manger, secourir, soigner, capturer, arrêter, dépouiller, ouvrir, éteindre, attaquer. Cela demande une entrée de file générale dans la simulation, donc un **changement de schéma**.
- Reste du lot des interactions (`interactions-rimworld.md`, « reste à faire ») :
  - fenêtre des statistiques de pièce et de beauté (`EnvironmentStatsDrawer`, réglages G et T) : faite au lot 17 (voir note) ;
  - double-clic sur une zone : fait au lot 18 (zones de culture seulement, comme Core) ;
  - touches F, V, C, X, Ctrl, Z, Origine/Fin, Page haut/bas : faites au lot 18 ;
  - jauge de travail dessinée sur la cible : faite au lot 18 ;
  - options du menu triées par priorité ;
  - « Prioriser » la chasse, l'apprivoisement et l'abattage.
- **Sons** :
  - l'utilisateur doit encore écouter (page `sounds-review.html`), en particulier les raccords des boucles géothermie et insectes de nuit ;
  - événements encore muets : coups sur bâtiments, impacts sur métal et bois, destructions, effondrement de toit, capsules, pièges, jeux, geyser, vents de brouillard et de calotte, insectes de jungle ;
  - pré-décoder les tirs à l'arrivée d'un raid.
- **Mode développeur** : pose directe en mode divin, détruire bâtiments et plantes, ressusciter, créer un pion, traits, blessures, inspecteur, favoris, incidents chiffrés, date et conteur.
- **Particules** : nettoyage sur la case nettoyée, coups des animaux et mécanoïdes, éclairage par les lampes.
- **Animations** : frémissement des oreilles, poses de portage et de travail accroupi, modèles des reptiles et oiseaux, repas posé sur la table.

**Moyen terme** :

- Feuille de route « les bases d'abord » : accueil du nouveau joueur, alertes, fonctions de base les plus fréquentes.
- Chantiers obligatoires :
  - **2** : publication du Worker vers l'affichage (un journal des écritures des ressources ; mesurer dans le vrai client avec `scripts/perf-client-publication.mjs`) ;
  - **4** : simulation des grandes colonies (Les Forges : ≈ 50 ms par macro-tick avec le banc esbuild, ×3 pas encore tenu) ;
  - le chantier 3 (sauts résiduels du contrôle de présentation) est en pause à la demande de l'utilisateur.
- **Planète à graine égale** : il faut porter `PawnGenerator` (chefs de faction) pour poursuivre la chaîne des tirages (villages suivants, routes ordinaires), puis le chemin navigateur des noms.
- Import RimWorld : prisonniers, visiteurs, mécanoïdes, mémoire dans le navigateur.
- Page des règles : domaines encore partiels. Registre du lore : catégories laissées de côté.

**Long terme** :

- Les six ensembles de complétion du jeu de base (`core-completion-plan-20261020.md`) :
  1. expérience et performance ;
  2. économie, recherche et catalogue ;
  3. habitants, santé et animaux ;
  4. narration, combat, quêtes et diplomatie ;
  5. victoire ;
  6. campagnes durables.
- Une seule colonie comme référence. Les extensions viendront après.
- Publication Cloudflare quand l'utilisateur la demande.

## 6. Méthode d'intégration utilisée

- **Copie d'intégration** : `E:/Code/RimWorld/tmp/rule-wt`, en HEAD détaché sur `origin/main`.
  - Les agents travaillent dans `.claude/worktrees/agent-*`.
  - On intègre leurs commits par `git cherry-pick`.
  - Puis on publie par :
    ```
    git push origin HEAD:main
    git -C E:/Code/RimWorld merge --ff-only <sha>
    ```
  - Ne pas modifier la copie pendant qu'une campagne y tourne ; utiliser une seconde copie de travail.
- **Outils** copiés dans `E:/Code/RimWorld/tmp/handoff-20261123/` :
  - `bump.py` (changement de schéma) :
    ```
    python bump.py <ancien> <nouveau> "<note de migration>"
    ```
    Il modifie les gardes de schéma, `serialization.ts` et `types.ts`.
  - `c2_cmp.py` : compare un rapport JSON de vitest aux échecs connus de `E:/Code/RimWorld/tmp/perf/known-failures.json`.
    ```
    npx vitest run <fichiers> --reporter=json --outputFile=x.json
    PYTHONIOENCODING=utf-8 python c2_cmp.py x.json
    ```
  - `brief-common.md` et `brief-retours-w5.md` : les consignes données aux agents (base à mettre à jour).
- **Types** : `npx tsc --noEmit -p . > fichier 2>&1`. Toujours rediriger vers un fichier : un tube vers `head` masque le code de sortie.
- **Documentation** : `PYTHONIOENCODING=utf-8 python scripts/check-docs.py`. Seules les images `artifacts/*.png` manquantes de l'historique sont des erreurs connues. À chaque nouveau schéma, mettre à jour les six en-têtes « schéma NNN » des index et la ligne V en tête de la liste des versions.
- **Campagnes**, à lancer après chaque changement de règle :
  ```
  npx vitest run tests/crashlanded-colony.test.ts -t "24 jours" --maxWorkers=1
  npx vitest run tests/prison-colony.test.ts --maxWorkers=1
  ```
  Comptez environ 15 à 30 minutes chacune, beaucoup plus si la machine est chargée. Reprise possible avec `PRISON_CHECKPOINT` ou `CRASHLANDED_CHECKPOINT` et les fichiers `tmp/*-day*.json`.
- **Contrôle de présentation** :
  - `scripts/check-presentation.mjs` impose « miner puis abattre », et le minage échoue toujours sur 3 à 20 sauts résiduels connus (chantier 3) ;
  - lancer plutôt chaque action seule :
    ```
    HARVEST_URL=http://localhost:<port>/ HARVEST_BROWSER=chrome HARVEST_VERIFY=1 HARVEST_VERIFY_SPEED=1 HARVEST_SWITCHES=1 HARVEST_INITIAL_SPEED=1 HARVEST_SPEEDS=6,1,3 HARVEST_SECONDS=45 HARVEST_ACTIONS=chop node --experimental-transform-types scripts/harvest-sync-bench.mjs verification
    ```
  - critères : aucune erreur, changements de vitesse en moins de 100 ms, sauts au niveau connu.
- **Banc de simulation** :
  ```
  npx esbuild scripts/perf-save-bench.ts --bundle --platform=node --format=esm --outfile=tmp/perf/bundle/bench.mjs
  node tmp/perf/bundle/bench.mjs public/test-saves/v432/les-forges-crash-test.json 60 20
  ```
  Mesurer en alternance avant et après, car la machine est bruyante.
- **Parties de test** :
  - `public/test-saves/v432/les-forges-crash-test.json` : 80 colons, 241 animaux ;
  - nouvelle partie directe : `?scenario=camp&e2e=1&size=250` ;
  - configuration de prévisualisation `rule-wt-dev` (port 5341) dans `E:/Code/RimWorld/.claude/launch.json`.
- **Prudence** : quand un ancien test casse sur un nouveau comportement voulu, mettre à jour l'attente en gardant les vérifications de comportement, et le dire. Quand il casse sur un vrai défaut, corriger le code.

## 7. Préférences de l'utilisateur

- Messages courts, en français clair, sans identifiants internes.
- Dire ce qui change dans le jeu, ce qui reste et ce qui n'est pas vérifié.
- Quand il est absent : avancer en autonomie, corriger au fil de l'eau, puis faire un rapport au retour.
- Il signale ses retours de partie en listes. On les ajoute au chantier des retours et on les traite sans abandonner la feuille de route.
- Avancer un lot à la fois quand le budget d'utilisation est serré.
