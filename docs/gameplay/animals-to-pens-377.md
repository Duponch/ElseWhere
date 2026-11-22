# Mener les animaux à l'enclos, corde et clôtures — schéma 377

Lot 2 de la vague 2 du [chantier des retours du 22 novembre](../development/chantier-retours-20261122.md), point 18, avec le retour ajouté en cours de lot sur les canards qui sortent de l'enclos d'une partie importée. **Changement de règles : schéma 377** (base 376, migration par le seul numéro).

## Ce que fait RimWorld 1.6

Relu dans le code du jeu (1.6.4871) :

- **Travail** : `WorkGiver_TakeToPen`, type Animaux (Handling), priorité 130 dans le type (`TakeRoamingAnimalsToPen` 160, `RebalanceAnimalsInPens` 60), manipulation requise. L'enclos est choisi par `AnimalPenUtility.GetPenAnimalShouldBeTakenTo` (enclos fermé qui accepte l'animal, atteignable avec les règles de clôture de l'animal) ; la place visée est une case libre de la région du marqueur (`FindPlaceInPenToStand`).
- **Tâche** (`JobDriver_RopeToDestination`, `JobDriver_RopeToPen`) : le colon va sur une case **cardinale** voisine de l'animal où tous deux peuvent marcher (`RopeAttachmentInteractionCell`, ordre nord, est, sud, ouest) et la reprend si l'animal bouge ; il passe la corde (`Toils_Rope.RopePawn`, 30 ticks : l'animal arrête son activité et attend) ; il cherche ensuite l'animal le plus proche à 10 cases au plus qui va au même enclos (jusqu'à 10 bêtes) ; puis il marche vers sa place dans l'enclos **à l'allure de l'animal le plus lent** (`locomotionUrgencySameAs` : le coût de chaque case est le plus grand du sien et de celui de l'animal). Chaque bête est détachée dès qu'elle se trouve dans l'enclos ; la tâche finit quand il n'en reste plus. Tant qu'il tient des bêtes bloquées par les clôtures, le colon évite lui-même les clôtures (`ShouldAvoidFences`).
- **Corde tendue** (`Pawn_PathFollower`) : en entrant dans une case, si une bête est à plus de 8 cases (`RopeLength`), le colon attend 60 ticks puis réessaie.
- **Bête tenue** (`JobDriver_FollowRoper`) : quand le colon marche à moins de 7,2 cases, elle vise une case de **la route du colon** 2 à 5 cases derrière lui (selon son rang sur la corde), décalée d'un côté pour deux bêtes sur trois (`HashOffset`) ; sinon elle rejoint le colon. Elle marche au pas Jog, ouvre les portes que son colon peut ouvrir.
- **Portes et clôtures** : un animal d'enclos (« roamer ») est bloqué par les clôtures (`FenceBlocked`) et ne peut ouvrir ni porte ni portillon sauf s'il est tenu à la corde (`Building_Door.PawnCanOpen`) ; une porte ouverte qui va se refermer ne le laisse pas passer (`CanPhysicallyPass` : seulement une porte maintenue ouverte, ou s'il est hostile). Le canard est un animal d'enclos (`roamMtbDays` 7) ; seul son vol passe une clôture, mais ses destinations sont choisies comme à pied (atteignabilité `ShouldAvoidFences`).

## Ce qui n'allait pas dans Elsewhere (mesuré)

Même cour (enclos muré avec une porte, trois muffles dehors), avant le lot :

- la **bête de tête cherchait sa propre route** vers l'entrée de l'enclos, et le colon allait se placer à côté de la case suivante de la bête, pas à pas ; à chaque pas le colon effaçait sa route et devait attendre le délai de planification (20 ticks) pour en chercher une autre ;
- les bêtes tenues marchaient au pas lent (Walk, 50 ticks au moins par case) au lieu du Jog ;
- les autres bêtes allaient vers la position ancienne du colon, sans suivre sa route, jusqu'à **9 cases** derrière ;
- résultat : 3 bêtes rentrées en **346 ticks** (≈ 58 s à ×1), dont 114 ticks pour 6 cases ; le colon semblait buter.

**La corde à travers les murs.** Les bêtes ne suivant pas la route du colon, elles pouvaient se trouver de l'autre côté d'un mur, d'un enclos ou d'un bâtiment, et la corde était tirée droit entre les deux.

## Corrections (schéma 377)

- **Le colon marche sa propre route** vers sa place dans l'enclos, en évitant les clôtures, et les bêtes **suivent sa trace** 2 à 5 cases derrière (ordre de marche de `FollowRoper`, même décalage `HashOffset`, porté en arithmétique 32 bits). Il garde les 5 dernières cases de sa route (`trail377`) pour cela.
- Approche sur une case cardinale commune, reprise si l'animal bouge ; corde passée en 30 ticks (`ropeUntil377`) ; recherche d'une autre bête à 10 cases ; allure du plus lent (gardée comme facteur de vitesse de l'arête, donc rejouée à l'identique après chargement) ; attente de 60 ticks si une corde dépasse 8 cases (`ropeWait377`).
- Les bêtes tenues marchent au pas Jog dans la continuation fine des ticks de jeu (plus d'à-coups au rythme des ticks macro) et ouvrent les portes que leur colon peut ouvrir.
- Même cour : 3 bêtes rentrées en **77 ticks**, au plus 5,1 cases d'écart ; vers un autre enclos (sortie d'un enclos par sa porte, entrée dans l'autre) en 110 ticks.
- **Dessin de la corde** : elle passe par les cases de la trace du colon entre lui et la bête (au plus quatre coudes, un seul lot GPU résident comme avant) ; elle épouse la porte ou l'angle au lieu de traverser le mur. Sans trace (anciennes parties), elle reste droite.

**Adaptations.** RimWorld choisit au hasard la place dans l'enclos ; Elsewhere prend la case du marqueur (ou la case libre la plus proche). Les décisions des bêtes tenues sont prises à chaque tick macro (10 ticks de jeu), leurs pas à chaque tick de jeu. Une bête qui ne peut plus rejoindre son colon interrompt toute la tâche (RimWorld ne lâche que cette corde). L'allure suit à chaque case la bête la plus lente encore dehors.

## Les canards qui sortent de l'enclos (partie importée « Yes »)

Reproduit sur la conversion de la sauvegarde de l'utilisateur (gardée hors du dépôt) : **31 sorties en 600 ticks**. Trois causes :

1. **Import** : RimWorld n'enregistre aucune affectation d'enclos (un animal appartient à l'enclos où il se trouve, `GetCurrentPenOf`) ; l'import ne donnait donc à aucun animal son enclos, et la règle d'Elsewhere qui retient un animal dans son enclos ne s'appliquait pas. L'import affecte maintenant chaque animal d'enclos debout dans un enclos fermé qui l'accepte.
2. **Règle** : un **canard qui marchait** passait les clôtures (lecteur de navigation des canards toujours « franchit les clôtures »). Depuis 377, un canard est bloqué par les clôtures comme tout animal d'enclos, en marchant comme en vol pour le choix de sa destination.
3. **Règle** : un **portillon ouvert** par un colon qui passe laissait sortir le troupeau, et une bête restée sur sa case le gardait ouvert. Depuis 377, un animal d'enclos ne franchit une porte ou un portillon que s'il est maintenu ouvert, tenu à la corde, en formation de caravane, ou s'il est enragé (règle `CanPhysicallyPass`).

Après correction : **aucune sortie en 2 000 ticks** sur la même partie ; dans une partie ordinaire avec un enclos clôturé dont le portillon s'ouvre sans cesse, aucun muffle ni canard ne sort.

**Regroupement.** Sur la partie importée, trois bisons placés hors de l'enclos sont ramenés à la corde par les éleveurs en 191 ticks (corde dessinée sans traverser de mur). L'**état d'errance** du jeu de base (`MentalState_Roaming` : un animal d'enclos laissé dehors finit par partir vers le bord de la carte, et `JobDriver_RopeRoamerToUnenclosedPen` le ramène) **n'existe pas encore dans Elsewhere** : reste à faire.

## Dans le vrai client

Serveur de développement, son et musique coupés, cour préparée (enclos muré avec porte, enclos clôturé avec portillon, trois muffles, un éleveur) chargée par « Charger une partie » :

- à ×1, les trois muffles dehors sont encordés l'un après l'autre et entrent par la porte derrière l'éleveur, à moins de 6 cases de lui (rentrés en moins de 90 ticks, 86 dans la même cour sans affichage) ;
- à ×3, les mêmes bêtes affectées à l'autre enclos sortent par la porte de l'enclos muré et entrent par le portillon de l'enclos clôturé (fini au tick 114) ; mise en pause pendant la sortie : l'éleveur est devant la porte, les cordes partent de lui, passent par l'embrasure et rejoignent chaque bête à l'intérieur, aucune ne traverse le mur ; ensuite les bêtes restent dans l'enclos clôturé (240 ticks observés) ;
- aucune erreur dans la console. Le panneau du navigateur étant masqué, la cadence d'image n'y était pas mesurable.

## Coût

Simulation, banc ciblé sur Les Forges (160 animaux dans 4 enclos, mêmes ticks en schéma 377 et réétiqueté 376 sur deux copies, 8 blocs alternés de 30 ticks, banc `tsx`, mesure bruitée) : **91,3 ms par tick macro en 377 contre 92,3 ms en 376** (médianes), aucun coût notable. Au passage, la même partie en 376 laissait **5 bêtes sortir de leurs enclos en 280 ticks** et occupait 4 éleveurs à les ramener ; en 377 aucune ne sort. La passe des cordes ne fait rien sans tâche de conduite ; le lecteur de navigation garde un lecteur par règle de portes et un ensemble des animaux de caravane calculé une fois par passe. Dessin : 120 sommets par corde au lieu de 24, toujours un seul dessin pour toutes les cordes, aucune mise à jour sans changement d'arête ou de coude.

## Preuves

`tests/animal-leading-core-377.test.ts` (11 cas) : trois muffles encordés un par un (30 ticks de corde) et menés par la porte, corde dessinée sans traverser de mur, au plus 9 cases d'écart, fini en moins de 160 ticks ; bêtes derrière un long mur qui suivent le colon ; sortie d'un enclos et entrée dans un autre ; sauvegarde et chargement au milieu de la conduite, mêmes ticks ; attente de 60 ticks d'une corde tendue ; allure du plus lent et trace ; ordre de marche 2 à 5 cases derrière et décalage `HashOffset` (valeurs C#) ; sauvegarde 376 refusée avec les champs 377, chargée par le seul numéro sans eux et menée au bout ; canard bloqué par les clôtures (aussi en vol) depuis 377 ; affectation d'enclos à l'import ; muffles et canards qui restent derrière un portillon qui s'ouvre sans cesse.
