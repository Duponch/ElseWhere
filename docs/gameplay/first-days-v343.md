# Premiers jours d'un atterrissage et pensées de tous les jours — V343

Schéma 343. Un audit des bases a classé ces pensées parmi celles que toute partie du jeu de base rencontre dès les premiers jours, et qui manquaient. Chaque règle vient des définitions du jeu de base (ThoughtDefs, scénario Crashlanded, faction PlayerColony) et des classes qui les appliquent ; aucun texte du jeu n'est repris.

## Début d'une partie « Atterrissage forcé »

À la création d'une colonie (tick 0), et seulement là :

- **Naufragés ensemble** : chaque colon de départ gagne +25 d'opinion envers chacun des deux autres. Le souvenir dure 20 jours, un seul par personne, et son effet décroît pendant les derniers 30 % de sa durée (ScenPart_PlayerPawnsArriveMethod, arrivée en capsules ; Thought_MemorySocial). Il rapproche les trois survivants : les premières conversations et tentatives amoureuses en tiennent compte.
- **Optimisme de nouvelle colonie** : +10 d'humeur pendant 8 jours, puis **Espoir de nouvelle colonie** +5 pendant 8 jours (Game.InitNewGame). Le même souvenir existait déjà à l'installation d'une nouvelle colonie ; il est désormais aussi donné au départ.
- **Recherches de départ** : la faction du joueur commence avec les sept projets marqués ClassicStart. Elsewhere connaissait déjà Taille de pierre, Mobilier complexe, Vêtements complexes et Climatisation ; l'Électricité et le refroidisseur passif n'ont pas de projet. **Pâte nutritive** est désormais connue : le distributeur et la trémie se construisent dès le premier jour.

Vérifications faites, sans changement de règle :

- **L'animal de compagnie existe** dans la vraie création d'une partie (globe, lieu, huit candidats) : un animal tiré parmi les animaux de compagnie que les colons savent manier, lié à l'un d'eux et ayant appris l'obéissance s'il peut l'apprendre (un chat ou un cochon d'Inde n'est lié à personne), comme ScenPart_StartingAnimal. Le texte de la page Scénario le disait absent : il est corrigé, comme celui de l'équipement (pantalon et casque pare-balles présents).
- **Les provisions arrivent interdites**, comme dans le jeu de base : le contenu des capsules (DropThingGroupsNear) et les provisions dispersées autour du point d'arrivée ou sur la carte (GenStep_ScatterThings). Il faut les autoriser pour s'en servir.

Nouvelle pensée de l'animal lié :

- **Maître de son compagnon lié** : +5 d'humeur par animal lié vivant, présent sur la carte, appartenant à la colonie, ayant appris l'obéissance et dont ce colon est le maître, trois animaux au plus (ThoughtWorker_BondedAnimalMaster).
- **Compagnon lié confié à un autre** : −3 par animal lié dont le maître est quelqu'un d'autre ou personne (ThoughtWorker_NotBondedAnimalMaster).

## Sommeil

Au moment où Elsewhere observait déjà la chambre ou le dortoir (une à quatre heures après le coucher, puis chaque jour, et une dernière fois au lever si une observation a eu lieu), quatre souvenirs s'ajoutent, quel que soit le lit (Toils_LayDown.ApplyBedThoughts) :

| Souvenir | Condition | Effet | Durée |
|---|---|---|---|
| A dormi dans le froid | température ambiante sous 16 °C | −4 | 1 jour |
| A dormi dans la chaleur | température ambiante au-dessus de 26 °C | −4 | 1 jour |
| A dormi dehors | pièce à ciel ouvert : au moins 300 cases sans toit, ou bord de carte avec au moins la moitié sans toit | −4 | 1 jour |
| A dormi par terre | sans lit, ou sur un emplacement de couchage, qui ne coûte rien | −4 | 1 jour |

- Les seuils de température sont ceux du corps humain, sans les vêtements : le jeu de base lit la statistique de la race, pas celle du colon habillé.
- Chaque observation retire d'abord les quatre souvenirs puis donne ceux qui s'appliquent : une nuit au chaud dans un lit efface ceux de la nuit dehors.
- Un sac de couchage coûte du tissu : ce n'est pas dormir par terre.

## Météo et obscurité

- **Trempé** : −3, pendant 0,1 jour (2,4 heures de jeu) après la dernière exposition. Toutes les 120 ticks du jeu de base (2 secondes), un colon dehors sous la pluie, l'orage pluvieux ou la pluie dans le brouillard, ou les pieds dans l'eau (eau peu profonde, marais, rivière ; pas sur un pont), gagne le souvenir ou le renouvelle (Pawn_MindState). Pendant une transition, la météo précédente compte jusqu'à la moitié du changement. La neige ne mouille pas.
- **Dans l'obscurité** : −5 tant que le colon est éveillé et que le dernier relevé de lumière à sa position était sombre (lumière d'au plus 0,3). Le relevé a lieu à chaque passage des besoins (150 ticks), comme PawnRecentMemory : la pensée apparaît au passage suivant un relevé sombre et disparaît au premier relevé éclairé (ThoughtWorker_Dark, plus de 240 ticks sans lumière). Un colon aveugle ne l'a pas. La nuit dehors, sans lampe, est sombre.

## Adaptations

- Ces souvenirs sont donnés aux colons libres, comme ceux de la chambre ; le jeu de base les donne aussi aux prisonniers et aux visiteurs.
- La pensée de l'animal lié ne compte que les animaux de la carte du colon ; un colon en caravane ne l'a pas.
- Le relevé de lumière est gardé avec les souvenirs de pièce, sous la forme d'une marque de deux passages au plus ; ce n'est pas un souvenir et il n'apparaît pas comme tel.
- Le départ simplifié « Atterrissage » des essais (sans globe) donne aussi les pensées de départ et Pâte nutritive, mais garde ses provisions posées au sol, autorisées et sans animal : il n'a ni capsules ni dispersion.

## Sauvegardes

Une sauvegarde 342 passe à 343 en changeant seulement son numéro. Une colonie commencée avant n'obtient ni naufrage partagé, ni optimisme de départ, ni Pâte nutritive ; les nouveaux souvenirs viendront de ses nuits, de sa météo et de sa lumière. Une sauvegarde 342 qui contiendrait déjà l'un de ces souvenirs est refusée.

## Vérifications

`tests/first-days-343.test.ts` couvre :

- une vraie création de partie au globe à 343 : opinions de 25 et leur déclin, optimisme puis espoir, Pâte nutritive, animal lié à son maître, contenu des capsules et provisions dispersées interdits, rechargement identique ;
- la pensée du maître une fois les capsules ouvertes, et sa perte quand l'animal n'a plus de maître ;
- le départ simplifié ;
- chaque souvenir du sommeil, de la pluie, de l'eau et de l'obscurité sur des états réels, leur renouvellement et leur fin ;
- rien de tout cela sous 343 ;
- l'égalité au rechargement pendant que ces pensées sont actives ;
- la migration 342 → 343 et le refus de ces souvenirs dans une sauvegarde 342.

Les tests qui renumérotent une sauvegarde neuve d'« Atterrissage » comparent désormais sa migration à la même colonie sans les pensées de départ (`asMigratedCurrent` dans `tests/scenarios/old-schema.ts`) : une sauvegarde plus ancienne ne peut pas les contenir.

La campagne « Atterrissage » de 24 jours (graine 42) passe à 343 sans changer le joueur scripté. Un premier passage s'est arrêté au jour 22 sur le relevé des repas : un conseiller de caravane a mangé puis quitté la carte dans le même tick, et le test ne le retrouvait plus pour vérifier son repas. Le test retrouve désormais le mangeur parmi ceux qu'il avait vus avant le tick ; ce n'était pas un défaut du jeu.
