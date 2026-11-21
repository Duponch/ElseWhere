# Alertes de droite comme dans RimWorld 1.6 — lot C : alertes occasionnelles et raccourcis

Interface seulement : le schéma ne change pas (358), rien n'est sauvegardé et la simulation n'est pas touchée. Les alertes lisent la partie confirmée sans la modifier ni tirer de hasard, au même rythme que les [lots A](alerts-core-a.md) et [B](alerts-core-b.md) (au plus une lecture toutes les 400 ms, aucune avant 600 ticks du jeu de base). Référence : RimWorld 1.6.4871, classes `Alert_PasteDispenserNeedsHopper`, `Alert_AwaitingMedicalOperation`, `Alert_NeedDoctor`, `Alert_NeedMiner`, `Alert_NeedResearchBench`, `Alert_ImmobileCaravan`, `Alert_CaravanIdle`, `Alert_QuestExpiresSoon`, et celles qu'elles appellent (`HealthAIUtility`, `WorkGiver_PatientGoToBedTreatment`, `Bill_Medical`, `Need_Food`, `Caravan`, `Quest`, `QuestManager`, les `Designator_*`) ; définitions `MainButtonDefs`, `KeyBindings`, `DesignationCategories` et `QuestScriptDefs` du jeu de base. Seuls des faits ont été repris ; les textes sont écrits pour Elsewhere.

## Ce qui change pour le joueur

Huit alertes nouvelles, chacune avec la priorité du jeu de base, ses cas pour le clic gauche ou droit et une explication au survol.

| Alerte (classe) | Priorité | Règle |
|---|---|---|
| **Caravane immobilisée** (`Alert_ImmobileCaravan`) | Critique | Une caravane porte plus que sa capacité, quoi qu'elle fasse (en marche, à l'arrêt ou à destination). L'explication donne la charge et la capacité. Le clic ouvre Monde > groupe. |
| **Médecin nécessaire** (`Alert_NeedDoctor`) | Haute | Sur la carte du foyer, aucun colon libre conscient n'a le travail Médecin activé, alors qu'un colon a une blessure ou une maladie à soigner (soins non réglés sur « aucun »), ou est à terre dans un lit et affamé (faim sous 24 %). Les patients sont les cas. |
| **Mineur nécessaire** (`Alert_NeedMiner`) | Haute | Sur la carte du foyer, des roches sont désignées pour le minage et aucun colon libre conscient n'a le travail Minage activé. Le clic va au premier ordre de minage. |
| **Distributeur sans trémie** (`Alert_PasteDispenserNeedsHopper`) | Haute | Un distributeur de pâte nutritive n'a aucune trémie sur une case qui touche l'un de ses côtés (une trémie en diagonale ne compte pas, comme pour la simulation). Chaque distributeur concerné est un cas. |
| **Offre expirant dans …** (`Alert_QuestExpiresSoon`) | Haute | Une offre encore sans réponse et non masquée expire dans moins d'un jour du jeu de base (60 000 ticks). Une seule carte, pour l'offre qui expire la première ; le clic ouvre Quêtes. Voir plus bas. |
| **N patient(s) en attente d'opération** (`Alert_AwaitingMedicalOperation`) | Moyenne | Un colon ou un prisonnier de la colonie a une opération demandée, il est couché dans un lit et un médecin est disponible pour l'opérer. |
| **Bureau de recherche (avancé) nécessaire** (`Alert_NeedResearchBench`) | Moyenne | Le projet choisi se recherche à un bureau que la colonie n'a pas construit : un bureau avancé pour les projets qui l'exigent, n'importe quel bureau sinon. Le clic ouvre Recherche. |
| **Caravane inactive** (`Alert_CaravanIdle`) | Moyenne | Une caravane est à l'arrêt alors qu'elle pourrait repartir : arrivée à destination, à l'arrêt sans route, ou arrêtée par une destination inaccessible. Ni une caravane en marche, ni en pause, ni surchargée, ni au repos de nuit. Le clic ouvre Monde > groupe. |

Ordre dans la colonne : Critique, puis Haute, puis Moyenne, l'ordre d'apparition étant gardé à priorité égale (lot A).

## Les offres de quête

Dans le jeu de base, une offre arrive par une lettre « nouvelle quête » et reste dans l'onglet Quêtes ; elle ne devient une alerte que pendant son dernier jour. Elsewhere montrait au contraire chaque offre comme une carte permanente à droite (« Quête : … demande asile », « Demande commerciale : … »), pendant toute sa durée. Depuis le schéma 352, ces offres envoient déjà leur lettre (`letters-v352.md`) et restent dans Quêtes ; les deux cartes permanentes sont donc retirées, et seule l'alerte **Offre expirant dans …** apparaît, pendant le dernier jour :

- la **demande d'asile** dure 1 800 ticks d'Elsewhere (18 000 ticks du jeu de base, un peu plus de sept heures de jeu) : elle est entièrement dans son dernier jour, l'alerte l'accompagne donc du début à la fin ;
- la **demande commerciale** dure de 4 à 8 jours : l'alerte n'apparaît qu'au dernier jour. Une offre masquée par le joueur ne déclenche rien.

Une demande d'asile **acceptée** garde sa carte (« Quête : poursuite de … ») : elle annonce la poursuite qui vient et dure le temps de l'arrivée et de l'attaque. Les pourparlers de paix gardent aussi leur carte : dans le jeu de base, cette quête est acceptée d'office (`autoAccept`) et ne déclenche jamais cette alerte.

## Raccourcis

Le jeu de base donne une touche à chaque onglet principal (`MainButtonDefs`) et des lettres aux outils de chaque catégorie d'Architecte (`KeyBindings`, champ `hotKey` de chaque `Designator`), valables quand la catégorie est ouverte.

| Touche | Avant | Maintenant (comme le jeu de base) |
|---|---|---|
| Tab, F1, F2, F3 | Architecte, Travail, Planning, Assignations | inchangé |
| F4, F5, F6, F7 | — | Animaux, Faune, Recherche, Quêtes |
| F8 | Monde | inchangé |
| F9 | — | Historique |
| C | Abattre | **Annuler** (`Designator_Cancel`) |
| X | Annuler | **Déconstruire** (`Designator_Deconstruct`) |
| Palette Ordres ouverte | lettres globales | **B** abattre, **H** récolter, **Y** couper les plantes, **L** miner, **P** transporter, **F** interdire, **U** autoriser, C, X |
| Palette Zones ouverte | lettres globales | **B** réserve, **H** culture, **N** foyer, **M** retirer le foyer, **I** construire un toit, **J** retirer un toit, **O** ignorer le toit, C, X |

Chaque outil des palettes Ordres et Zones affiche sa lettre. Pendant une partie, F1 à F9 ne vont plus au navigateur : F5 ne recharge plus la page.

Différences gardées :

- **Lettres globales.** Le jeu de base n'a pas de lettre d'outil hors de la catégorie ouverte. Elsewhere garde ses raccourcis valables partout : M miner, B mur, L lit, S réserve, R récolter (ou mobiliser avec des colons sélectionnés), H aide. Dans une palette ouverte, les lettres du jeu de base passent d'abord (H y récolte au lieu d'ouvrir l'aide).
- **C et X partout.** Le jeu de base met Annuler et Déconstruire dans toutes les catégories d'Architecte ; Elsewhere les rend valables partout, comme ses autres lettres. Abattre n'a plus de lettre globale : B dans la palette Ordres, comme dans le jeu de base.
- **Outils sans équivalent.** Chasser (O), abattre un animal (M), apprivoiser et revendiquer (N) n'ont pas d'outil dans la palette Ordres d'Elsewhere ; supprimer une zone (Y) et les zones autorisées (K, L) n'ont pas d'outil de même rôle dans la palette Zones. Ces lettres gardent leur sens global.
- **Échap.** Le jeu de base ouvre le Menu quand rien n'est ouvert ni sélectionné ; Elsewhere ferme le panneau et retire la sélection, sans ouvrir le Menu.
- **Factions et Menu** n'ont pas de touche, comme dans le jeu de base.

## Adaptations

- **Une carte à la fois.** Comme aux lots A et B, seuls la carte affichée et ses colons sont lus.
- **Médecin disponible.** Le jeu de base demande un médecin qui peut atteindre le patient ; la recherche de chemin n'est pas faite au rythme des alertes. Elsewhere garde une demande d'opération par personne, jamais suspendue, et n'opère pas les animaux.
- **Mineur.** Elsewhere n'a ni filon à miner d'un seul ordre (`MineVein`) ni mécanoïde de la colonie. Le premier ordre montré est le premier que le joueur peut voir.
- **Bureau de recherche.** Comme dans le jeu de base, l'alerte ne regarde ni l'électricité ni le multi-analyseur ; le panneau Recherche continue d'expliquer ces manques.
- **Caravanes.** Les groupes d'Elsewhere tiennent lieu de caravanes : ceux du registre du monde (ou l'unique groupe d'une ancienne campagne), hors d'une carte locale. La charge est relue à chaque lecture avec la même capture que la marche (le jeu de base la garde 60 ticks). La marche d'Elsewhere s'arrête dès qu'un membre est à terre, en crise ou incapable de marcher (le jeu de base attend que tous le soient) : une telle caravane n'est pas inactive. Une caravane qui attend d'entrer sur une carte ou une réponse à une rencontre n'est pas inactive non plus. Les reconnaissances et voyages commerciaux, trajets automatiques d'Elsewhere, ne comptent pas. Une caravane n'est pas un cas qu'on peut viser sur la carte : le clic ouvre Monde > groupe.
- **Offres.** Le clic ouvre Quêtes sans y sélectionner l'offre. L'alerte est dessinée comme les cartes d'offre, en ocre, et commence après 600 ticks du jeu de base comme toute alerte. À égalité d'échéance, l'offre la plus récente l'emporte (ordre d'affichage du jeu de base). Une ancienne sauvegarde d'avant le schéma 352 n'a pas reçu de lettre pour une offre déjà présente : celle-ci reste dans Quêtes et dans l'alerte de son dernier jour.

## Absent et pourquoi

- `Alert_NoBabyFoodCaravan` : extension Biotech.
- Comptes à rebours des sites (`Alert_TimedMakeFactionHostile`, `Alert_TimedRaidsArriving`) : non traités dans ce lot.
- Lettres des outils de construction (Structure, Meubles, Production…) : seuls les onglets principaux et les palettes Ordres et Zones suivent le jeu de base.

## Coût mesuré

Mesure sur Les Forges (80 colons, 7 512 bâtiments, 256 ordres, 1 778 piles ; aucun distributeur, aucun ordre de minage, aucune opération demandée, aucune caravane), dans Node, banc empaqueté par esbuild sans `--keep-names`, sur une machine partagée avec d'autres lots en cours (chiffres bruités). Chaque lecture se fait sur un nouvel objet World qui partage les tableaux de la partie publiée. 500 lectures par mesure, médianes :

| Lecture | Médiane | 95 % |
|---|---|---|
| Les huit lecteurs du lot C ensemble | 0,12 ms | 0,17 ms |
| dont distributeur sans trémie (une passe sur les bâtiments) | 0,09 ms | 0,14 ms |
| dont bureau de recherche (passe arrêtée au premier bureau trouvé) | 0,012 ms | 0,014 ms |
| dont les six autres (médecin, mineur, opération, deux caravanes, offre) | moins de 0,002 ms chacun | — |
| Pire cas : tous les médecins et mineurs désactivés, projet avancé sans bureau avancé, une opération demandée | 0,23 ms | 0,45 ms |
| Liste entière, pour comparaison | 2,7 ms | 3,9 ms |

Le lot ajoute donc environ 0,1 à 0,2 ms par lecture, soit moins de 0,05 % du fil principal au rythme de 400 ms. Chaque lecteur s'arrête d'abord sur un fait bon marché (aucune demande d'opération, aucun ordre de minage, un médecin actif, aucune caravane) ; seul le distributeur parcourt la liste des bâtiments, une fois, et ne cherche les trémies que si un distributeur existe. Rien n'est gardé d'une lecture à l'autre ; aucune case de la carte n'est parcourue. Ces chiffres ne sont pas des images par seconde et n'ont pas été mesurés dans le navigateur. Banc : `npx esbuild scripts/alerts-c-bench.ts --bundle --platform=node --format=esm --outfile=tmp/perf/bundle/alerts-c.mjs`, puis `node tmp/perf/bundle/alerts-c.mjs public/test-saves/v432/les-forges-crash-test.json 500`.

## Contrôles

- `tests/alerts-core-c.test.ts`, 14 cas : distributeur dont la trémie est déconstruite par un colon puis reconstruite avec de l'acier livré, trémie en diagonale refusée comme par la simulation ; demande d'opération menée par la simulation jusqu'au lit, sans puis avec médecin disponible, jusqu'à l'opération faite ; blessé sans médecin qui rejoint seul son lit médical, puis médecin réactivé ; patient secouru jusqu'au lit par la simulation, compté seulement affamé, médecin à terre ignoré ; minage désigné sans mineur, mineur à terre, ordres finis par la simulation ; projet sans bureau, bureau simple, projet avancé et bureau avancé non alimenté ; caravane préparée du registre du monde, à l'arrêt de jour, en pause, en marche, destination inaccessible, à destination, en attente d'entrée, membre à terre, de nuit ; surcharge en tout état puis déchargement ; demande d'asile réelle avec l'alerte du début à l'échéance, acceptée (sa carte de poursuite reste) ou expirée par le producteur ; demande commerciale seulement dans son dernier jour (exactement un jour restant : pas encore), masquée, échue, la plus proche puis la plus récente à égalité, rien avant 600 ticks ; priorités et ordre de la liste ; lecture sans modification de la partie ; table des touches d'onglets, lettres globales et lettres des palettes cohérentes avec les lettres affichées sur les outils.
- Ancien test mis à jour parce qu'il décrivait la règle remplacée : la lettre affichée sur l'outil Miner dans la palette Ordres (`tests/native-tool-structure-v479.test.ts`, M devient L) ; ce cas échoue de toute façon plus tôt, sur un échec déjà connu (liste des outils de la palette).
- Voisins lancés (alert*, status*, notification*, native-hud*, quest*, trade-request*, caravan*, surgery*, research*, et les tests des palettes d'outils, des icônes, des distributeurs, de l'aide, de la disponibilité des colons, des risques d'humeur et des lignes de domaine), 52 fichiers : 378 cas réussis, 29 échecs, tous déjà connus, 24 cas en attente.
- Typage complet passé. Non vérifié dans un navigateur : rendu de la carte d'offre, touches F6 et F7 (certains navigateurs les réservent : focus de la barre d'adresse, navigation au curseur), lettres des palettes au clavier.
