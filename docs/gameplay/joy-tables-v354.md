# Tables de jeu du jeu de base V354

Le lot ajoute les quatre bâtiments de loisir de RimWorld 1.6 qui manquaient : **table de billard**, **table de poker**, **anneau de lancer de pierres** et **plateau du jeu royal d'Ur**. Chacun se construit par un vrai chantier payé, puis sert à un colon qui s'ennuie, avec ses gains de joie, sa lassitude, son expérience et sa place dans une salle de loisirs. Schéma 354 ; une partie 353 migre par le seul numéro, sans rien recevoir rétroactivement.

## Ce que fait le jeu

- **Table de billard** (Architecte → Loisirs) : 2 × 3, orientable, 80 bois, métal ou pierre + 80 tissu + 30 bois (une table en bois demande donc 110 bois), Construction 6, recherche Mobilier complexe. Toutes les cases autour doivent rester praticables : un mur, un meuble ou de la roche contre la table refuse le plan. Deux joueurs au plus. Le joueur prend une case autour de la table, joue un coup de 600 ticks du jeu de base, puis va à une autre case tirée au hasard autour de la table ; la partie dure 4 000 ticks du jeu de base depuis son début, marches comprises. Famille dextérité, gain de joie ×1,3 (selon la qualité), expérience de Tir. Pendant un coup, les colons conversent aussi souvent qu'en détente sociale.
- **Table de poker** : 2 × 2, non orientable, 50 bois, métal ou pierre + 50 tissu + 25 bois, Construction 6, Mobilier complexe. Quatre joueurs au plus, chacun assis sur un siège posé contre un bord de la table. Famille réflexion, gain ×1,3 (selon la qualité), expérience d'Intellect, confort du siège.
- **Anneau de lancer de pierres** : 1 × 1, 20 bois, métal ou pierre, sans recherche ni qualité. Trois joueurs, sur les mêmes places de lancer que les fers à cheval (à cinq cases, vue dégagée). Famille dextérité, gain ×1, expérience de Tir.
- **Plateau du jeu royal d'Ur** : 1 × 1, orientable, 35 bois, métal ou pierre, sans recherche, beauté 2 (selon la qualité). Deux joueurs, sur un siège adjacent s'il y en a un, sinon debout sur une case voisine libre. Famille réflexion, gain ×0,8 (selon la qualité), expérience d'Intellect.

Comme dans le jeu de base, l'anneau et le plateau d'Ur ne s'affichent dans l'Architecte que pour une faction joueuse **tribale**. Toutes les colonies d'Elsewhere commencent aujourd'hui en colonie industrielle : ces deux bâtiments existent donc dans la simulation (construction, usage, sauvegarde, minification) mais restent cachés au joueur tant qu'aucun départ tribal n'existe.

Les quatre bâtiments se désinstallent et se transportent emballés, comptent dans la richesse (le tissu inclus), la beauté de la pièce et l'alerte « Sources de loisirs insuffisantes ». Chacun vaut 7 points pour le rôle **salle de loisirs** d'une pièce. Le joueur termine son loisir à 100 % de joie, au bout de la durée, ou s'il perd la manipulation (ou la vue, pour le billard et le poker) ; à la fin de chaque coup de billard et à la fin des autres jeux, la pièce laisse son souvenir de salle de loisirs selon son impression.

## Faits du jeu de base utilisés

RimWorld 1.6, `Data/Core/Defs` et classes décompilées (faits seulement, aucun code copié).

- `ThingDefs_Buildings/Buildings_Joy.xml` : `BilliardsTable` (taille 2×3, `costStuffCount` 80, `costList` Cloth 80 + WoodLog 30, `WorkToBuild` 12 000, PV 250, masse 60, beauté 0, `JoyGainFactor` 1,3, `fillPercent` 0,4, `pathCost` 42, `terrainAffordanceNeeded` Medium, `constructionSkillPrerequisite` 6, `PlaceWorker_NeverAdjacentUnstandable`, recherche `ComplexFurniture`) ; `PokerTable` (2×2 non orientable, 50 + Cloth 50 + WoodLog 25, 10 000, PV 250, masse 30, beauté 0, 1,3, 0,4, 42, Construction 6, `ComplexFurniture`) ; `HoopstoneRing` (`BuildingBase`, sans qualité, 20, 100, PV 100, masse 4, 1, `pathCost` 14, `maxTechLevelToBuild` Neolithic, zone de lancer 5~5 de largeur 3) ; `GameOfUrBoard` (orientable, 35, 6 000, PV 90, masse 2, beauté 2, 0,8, `fillPercent` 0,2, `pathCost` 14, `maxTechLevelToBuild` Neolithic). Tous en Metallic/Woody/Stony ; les trois tables ont `CompQuality`.
- `Stats/Stats_Building_Special.xml` : `JoyGainFactor` avec `StatPart_Quality` 0,76 / 0,88 / 1 / 1,12 / 1,24 / 1,4 / 1,8, minimum 0,3.
- `Joy/JoyGivers.xml`, dans l'ordre de chargement : `Play_Hoopstone` (`JoyGiver_WatchBuilding`, chance de base 2, Manipulation), `Play_Billiards` (`JoyGiver_PlayBilliards`, 4, Vue + Manipulation), `Play_GameOfUr` (`JoyGiver_InteractBuildingSitAdjacent`, 2, `requireChair` false, Manipulation), `Play_Chess` (2), `Play_Poker` (`JoyGiver_InteractBuildingSitAdjacent`, 4, Vue + Manipulation). `JobGiver_GetJoy` tire parmi les donneurs dans cet ordre avec le poids chance × max(0,001 ; (1 − lassitude)^5).
- `JobDefs/Jobs_Joy.xml` : `joyDuration` 4 000 pour les quatre ; `joyMaxParticipants` 3 / 2 / 2 / 4 ; `joySkill` Tir 0,003, Tir 0,004, Intellect 0,0015, Intellect 0,004 par tick.
- `JobDriver_PlayBilliards` : coups de 600 ticks, `Toils_Misc.FindRandomAdjacentReachableCell` (case adjacente en 8 directions, praticable, réservable, atteignable), fin quand `TicksGame > startTick + joyDuration`, `RandomSocialMode.SuperActive`, `TryGainRecRoomThought` à la fin de chaque coup. `JoyGiver_PlayBilliards.ThingHasStandableSpaceOnAllSides`.
- `JobDriver_SitFacingBuilding` (Ur), `JobDriver_PlayPoker` (même conduite avec effet de cartes) : assis face au bâtiment, confort de la case, durée `joyDuration`. `JobDriver_PlayHoopstone` : `JobDriver_WatchBuilding` avec un lancer de pierre tous les 400 ticks (effet seulement).
- `JoyUtility.JoyTickCheckEnd` : gain 0,36/2 500 par tick × facteur du bâtiment ; `RoomRoleWorker_RecRoom` : 7 points par bâtiment d'un donneur `countsForRecRoom` ; `Designator_Build.Visible` : `maxTechLevelToBuild` comparé au niveau technologique de la faction joueuse.

## Adaptations

- Chaque coup de billard tire sa case suivante sans remise parmi les cases praticables et non réservées, et la cherche seule ; le jeu de base tire avec remise jusqu'à cent fois. Le chronomètre de la partie part de l'arrivée à la première case (comme les autres loisirs d'Elsewhere), pas du lancement de la tâche ; les marches entre les coups, elles, comptent.
- Comme pour les échecs et la télévision, le choix porte au hasard sur toutes les places atteignables des bâtiments disponibles, et non sur le bâtiment atteignable le plus proche.
- Les sièges reconnus sont ceux des repas (tabouret, chaise, fauteuil). Le plateau d'Ur préfère un siège quand une place assise est atteignable.
- La pierre lancée de l'anneau, le bruit du billard et l'effet de cartes du poker ne sont pas dessinés ; la pose de lancer des fers à cheval sert à l'anneau et au billard.
- La règle de placement du billard regarde les murs, meubles et roches déjà construits ; un plan voisin non construit ne la bloque pas.
- Le récit « partie jouée » (`taleOnCompletion PlayedGame`) n'existe pas dans Elsewhere.

## Ce qui reste

- Aucun départ tribal : l'anneau et le plateau d'Ur restent invisibles dans l'Architecte d'une colonie industrielle, comme dans le jeu de base.
- Les autres loisirs absents (promenade, contemplation d'œuvres, bonhomme de neige, visite de tombe, télescope, chocolat) et les téléviseurs plats restent à faire.

## Vérification

`tests/joy-tables-354.test.ts` : recettes, coûts et facteurs relus aux définitions ; Architecte (recherche, faction tribale) ; refus du billard contre un mur ou la roche et de la table de poker tournée ; construction réelle des quatre bâtiments par un colon qui livre bois et tissu ; usage par un colon qui s'ennuie au fil des ticks (joie, lassitude et compétence ne montent qu'en jouant) ; billard qui change de case entre les coups, sauvegardé pendant une marche puis rechargé à l'identique ; poker à quatre joueurs sur cinq sièges, cinquième joueur refusé ; rôle de salle de loisirs ; poids des tirages entre les six jeux ; colonie sans ces bâtiments identique entre 353 et 354, refus à 353 et migration par le numéro.
