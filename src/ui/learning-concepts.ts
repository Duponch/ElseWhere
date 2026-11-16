import type {LearningConcept} from './learning-helper';

/** Highlight tags of each learning notion: Core's ConceptDef.highlightTags
 * (Data/Core/Defs/Tutor/Concepts_*.xml, RimWorld 1.6) mapped to Elsewhere's
 * controls. Core's Architect → Zone and Architect → Orders paths are the
 * Zones and Orders palettes here; Core's ITab tabs are inspector tabs or
 * actions. Couchages and Recherche (Elsewhere notions) take the tags of the
 * tutorial instructions BuildBeds and OpenMainTabResearch. */
const HIGHLIGHT_TAGS:Readonly<Record<string,readonly string[]>>=Object.freeze({
  // ReformCaravan: MainTab-World-Closed, ReformCaravan.
  'reform-caravan':['tab:world','world:form-caravan'],
  // Drafting: Draft.
  drafting:['draft'],
  // BuildOrbitalTradeBeacon: MainTab-Architect-Closed, DesignationCategoryButton-Misc-Closed, Designator-Build-OrbitalTradeBeacon.
  'orbital-beacon':['tab:architect','category:production','tool:orbital-beacon'],
  // BillsTab: ITab-Bills-Closed.
  bills:['inspector:bills'],
  // DrugAddiction: ITab-Needs-Closed.
  addiction:['inspector:needs'],
  // DrugPolicies: MainTab-Assign-Closed, ManageDrugPolicies.
  'drug-policies':['tab:assign','manage-drug-policies'],
  // PrisonerTab: ITab-Prisoner-Closed.
  prisoners:['inspector:prisoner'],
  // Shelves: Designator-Build-Shelf.
  shelves:['tool:shelf'],
  // Books: MainTab-Assign-Closed, ReadingAssignPolicy.
  books:['tab:assign','reading-policy'],
  // TimeControls and Pause: TimeControls.
  'time-controls':['time-controls'],
  pause:['time-controls'],
  // Stockpiles: MainTab-Architect-Closed, DesignationCategoryButton-Zone-Closed, Designator-ZoneAddStockpile_Resources.
  stockpiles:['tools:zones','tool:stockpile'],
  // Forbidding: ToggleForbidden.
  forbidding:['forbid'],
  // BuildBeds instruction: Architect, Furniture, Designator-Build-Bed.
  beds:['tab:architect','category:furniture','tool:sleeping-spot','tool:bed'],
  // GrowingFood: Architect, Zone, Designator-ZoneAdd_Growing.
  growing:['tools:zones','tool:growing'],
  // Alerts: Alerts.
  alerts:['alerts'],
  // Mining: Architect, Orders, Designator-Mine.
  mining:['tools:orders','tool:mine'],
  // OpenMainTabResearch instruction: MainTab-Research-Closed.
  research:['tab:research'],
  // WorkTab: MainTab-Work-Closed.
  'work-tab':['tab:work'],
  // ForbiddingDoors: ToggleForbidden-Door.
  'forbidding-doors':['forbid-door'],
  // FormCaravan: MainTab-World-Closed, FormCaravan, ReformCaravan.
  'form-caravan':['tab:world','world:form-caravan'],
  // AnimalTaming: Architect, Orders, Designator-Tame (taming is asked in Faune here).
  'animal-taming':['tab:wildlife','tame'],
  // AnimalTraining: ITab-Training-Closed (training rows of the animal inspector).
  'animal-training':['animal-training'],
  // InfoCard: InfoCard.
  'info-card':['info-card'],
  // StorageTab: ITab-Storage-Closed.
  'storage-tab':['inspector:storage'],
  // HomeArea: Architect, Zone, Designator-AreaHomeExpand.
  'home-area':['tools:zones','tool:home'],
  // HostilityResponse: HostilityResponse.
  'hostility-response':['hostility-response'],
  // AllowedAreas: Architect, Schedule, Zone, AreaAllowedExpand, AreaAllowedClear (areas are assigned in Assignations here).
  'allowed-areas':['tools:zones','zones:allowed-areas','tab:assign'],
  // TimeAssignments: MainTab-Schedule-Closed.
  'time-assignments':['tab:schedule'],
  // Outfits: MainTab-Assign-Closed, ManageOutfits.
  outfits:['tab:assign','manage-outfits'],
  // HistoryTab: MainTab-History-Closed.
  'history-tab':['tab:history'],
});

/** The notions of the learning helper: French texts written for Elsewhere's
 * own controls and rules (no text taken from the reference game). Group,
 * priority, needsOpportunity and opportunityDecays are Core's ConceptDef
 * values (Data/Core/Defs/Tutor/Concepts_*.xml, RimWorld 1.6); the order is
 * Core's definition order, which settles equal desires. Two notions marked
 * core:'Elsewhere' cover first gestures that have no Core concept.
 * Update a text when its rule changes. */
const self=(id:string,core:string,priority:number,title:string,text:string):LearningConcept=>({id,core,group:'self-show',title,text,priority,needsOpportunity:false,opportunityDecays:true,highlightTags:HIGHLIGHT_TAGS[id]??[]});
const chance=(id:string,core:string,title:string,text:string,decays=true):LearningConcept=>({id,core,group:'opportunistic',title,text,priority:50,needsOpportunity:true,opportunityDecays:decays,highlightTags:HIGHLIGHT_TAGS[id]??[]});
const modal=(id:string,core:string,title:string,text:string):LearningConcept=>({id,core,group:'modal',title,text,priority:-1000,needsOpportunity:false,opportunityDecays:true});

export const LEARNING_CONCEPTS:readonly LearningConcept[]=Object.freeze([
  // Concepts_NotedOpportunistic: shown when the game raises an opportunity.
  chance('reform-caravan','ReformCaravan','Repartir d’une carte lointaine',
    'Un colon est tombé loin du foyer. Quand le calme revient, Monde permet de reformer le groupe pour rentrer avec ses blessés, ses animaux et ce qu’il a ramassé.'),
  chance('rescuing','Rescuing','Secourir un blessé',
    'Un colon à terre ne se relève pas seul. Sélectionnez un autre colon, faites un clic droit sur le blessé et choisissez Secourir : il le porte jusqu’à un couchage où il pourra être soigné.'),
  chance('capturing','Capturing','Capturer un ennemi',
    'Un ennemi est à terre. Un colon démobilisé peut le Capturer par un clic droit, s’il existe un couchage marqué Pour prisonniers dans une pièce fermée.'),
  chance('traders','InteractingWithTraders','Commercer',
    'Des marchands sont arrivés. Ouvrez Visiteurs · Commerce depuis son alerte et choisissez un négociateur : il rejoint le marchand et échange vos biens rangés contre les siens.'),
  chance('drafting','Drafting','Mobiliser',
    'Une attaque commence. Sélectionnez vos colons et mobilisez-les (R ou Mobiliser) : ils lâchent leur travail, se déplacent par clic droit et tirent sur les ennemis à portée.'),
  chance('orbital-beacon','BuildOrbitalTradeBeacon','Balise de commerce orbital',
    'Les marchands orbitaux ne prennent que les biens et l’argent posés près d’une balise de commerce orbital alimentée. Construisez-en une dans la pièce où vous rangez ce que vous voulez vendre.'),
  chance('animals-doors','AnimalsDontAttackDoors','Animaux en rage et portes',
    'Un animal en rage attaque les humains mais n’ouvre pas les portes. Restez à l’intérieur, portes fermées ; s’il poursuit quelqu’un qui vient de passer, il peut frapper la porte quelques fois.'),
  chance('bills','BillsTab','Factures de production',
    'Un poste de production est prêt. Inspectez-le et ouvrez Factures pour commander un travail : quantité à produire, ingrédients autorisés et exécutant se règlent dans chaque facture.',false),
  chance('comms','OpeningComms','Console de communication',
    'Une console alimentée permet de contacter les factions et les marchands orbitaux de passage. Un colon doit s’y rendre pour l’utiliser.'),
  chance('addiction','DrugAddiction','Dépendance',
    'Un colon est devenu dépendant à l’alcool. Privé de boisson, il souffre du manque jusqu’à ce que la dépendance passe ; sa politique de drogues règle ce qu’il a le droit de boire.'),
  chance('drug-policies','DrugPolicies','Politiques de drogues',
    'De l’alcool est rangé dans la colonie. Assignations attribue à chaque colon une politique de drogues : ce qu’il peut prendre, quand et en quelle quantité.'),
  chance('prisoners','PrisonerTab','Prisonniers',
    'Un prisonnier est détenu. Son onglet Prisonnier règle le travail des geôliers : le garder nourri et soigné, réduire sa résistance, tenter de le recruter ou le libérer.'),
  chance('door-speed','DoorOpenSpeed','Vitesse des portes',
    'Une porte en pierre s’ouvre plus de deux fois plus lentement qu’une porte en bois et ralentit chaque passage. Gardez-la à l’écart des allées fréquentées.'),
  chance('queue-orders','QueueOrders','File d’ordres',
    'Maintenez Maj en donnant un ordre à un colon pour l’ajouter à sa file au lieu de remplacer ce qu’il fait. Cela vaut aussi pour les déplacements d’un colon mobilisé.'),
  chance('shelves','Shelves','Étagères',
    'Une étagère construite range jusqu’à trois piles par case, avec ses propres filtres et sa priorité. Placez-la dans une pièce couverte pour protéger ce qu’elle porte.',false),
  chance('books','Books','Livres',
    'Un livre est arrivé dans la colonie. Les colons peuvent le lire pendant leurs loisirs ; rangez-le à l’abri, car un livre laissé dehors se détériore.'),
  // Concepts_NotedSelfshow: shown by priority alone, most important first.
  self('camera-dolly','CameraDolly',95,'Déplacer la vue',
    'Déplacez la caméra avec les flèches, ZQSD ou WASD, ou en glissant le bouton central de la souris. Le bouton droit glissé la fait tourner.'),
  self('camera-zoom','CameraZoom',94,'Zoomer',
    'La molette rapproche ou éloigne la vue. De près, les quantités et les qualités des objets s’affichent sur la carte.'),
  self('time-controls','TimeControls',93,'Vitesse du temps',
    'Les touches 1, 2 et 3, ou les boutons en bas à droite, règlent la vitesse sur ×1, ×3 et ×6. Accélérez quand la colonie travaille sans danger.'),
  self('pause','Pause',92,'Mettre en pause',
    'Espace met la partie en pause, puis la relance à la dernière vitesse. En pause, vous pouvez donner tous vos ordres : les colons les exécuteront à la reprise.'),
  self('stockpiles','Stockpiles',40,'Réserves',
    'Zones → Réserve trace une zone de rangement. Les colons affectés au Transport y portent les objets que ses filtres autorisent ; une réserve couverte les protège des intempéries.'),
  self('forbidding','Forbidding',40,'Interdire et autoriser',
    'Un objet interdit n’est ni pris ni transporté par vos colons. Inspectez-le pour l’autoriser ou l’interdire, ou appliquez l’ordre sur un rectangle.'),
  self('beds','Elsewhere',38,'Couchages',
    'Architecte → Meubles : un couchage au sol est gratuit et immédiat, un lit demande des matériaux et du travail mais repose mieux. Sans murs ni toit, aucun couchage n’abrite du froid ou de la pluie.'),
  self('growing','GrowingFood',37,'Cultures',
    'Zones → Culture trace un champ ; choisissez la plante dans son inspection. Un colon affecté à Culture sème puis récolte : la nourriture n’arrive qu’à maturité.'),
  self('equipping-weapons','EquippingWeapons',30,'S’équiper d’une arme',
    'Sélectionnez un seul colon, faites un clic droit sur une arme au sol et choisissez Équiper. Un colon sans arme se bat à mains nues.'),
  self('alerts','Alerts',27,'Alertes',
    'La colonne de droite liste les problèmes en cours. Survolez une alerte pour lire son explication ; un clic montre la personne ou le lieu concerné.'),
  self('mining','Mining',25,'Miner',
    'Ordres → Miner (touche M) désigne la roche à creuser. Les colons affectés au Minage la retirent et laissent au sol les blocs bruts ou le minerai.'),
  self('research','Elsewhere',21,'Recherche',
    'Ouvrez Recherche pour choisir un projet. Il avance au bureau de recherche, avec un colon affecté à Recherche dans Travail.'),
  self('work-tab','WorkTab',20,'Répartir le travail',
    'Travail (F1) règle les métiers de chaque colon : 1 est la priorité la plus forte, 4 la plus faible et 0 désactive le métier. Changez quelques priorités pour essayer.'),
  self('forbidding-doors','ForbiddingDoors',15,'Interdire une porte',
    'Une porte interdite depuis son inspection n’est plus franchie par vos colons. Cela les garde à l’abri pendant une attaque d’animaux en rage ou des retombées toxiques.'),
  self('cover','CoverAndShooting',13,'Couvert et tir',
    'Collé à des sacs de sable, un tireur profite d’un couvert bas contre les tirs venus de l’autre côté. Mobilisez vos colons et placez-les derrière avant l’arrivée de l’ennemi.'),
  self('form-caravan','FormCaravan',11,'Former un groupe de voyage',
    'Monde (F8) permet de former un groupe de voyage : choisissez les personnes, les animaux et les provisions, puis une destination sur la planète.'),
  self('animal-taming','AnimalTaming',10.1,'Apprivoiser',
    'Dans Faune, demandez l’apprivoisement d’un animal sauvage. Un colon affecté au Dressage l’approche avec de la nourriture ; certains animaux peuvent se défendre.'),
  self('animal-training','AnimalTraining',10,'Dresser',
    'Dans le dossier d’un animal de la colonie, choisissez ses apprentissages : l’Obéissance d’abord, puis le Transport pour les espèces qui en sont capables.'),
  self('info-card','InfoCard',9,'Fiche d’information',
    'Inspectez une pile d’objets au sol et ouvrez Information pour lire sa fiche détaillée : état, qualité, valeur et usages.'),
  self('storage-tab','StorageTab',7,'Réglages de réserve',
    'Inspectez une réserve ou une étagère pour régler ses filtres et sa priorité. Les objets quittent une réserve de priorité basse pour une réserve de priorité plus haute.'),
  self('home-area','HomeArea',7,'Zone de foyer',
    'Dans la zone de foyer, les colons réparent, nettoient et éteignent les incendies d’eux-mêmes. Étendez-la sur vos bâtiments depuis Zones.'),
  self('spoilage','SpoilageAndFreezers',6.5,'Pourriture et froid',
    'La nourriture pourrit à pleine vitesse dès 10 °C et ne pourrit plus à 0 °C ou en dessous. Une pièce fermée refroidie par un refroidisseur conserve les vivres.'),
  self('deterioration','Deterioration',6,'Détérioration',
    'Les objets laissés dehors perdent leurs points de vie, plus vite sous la pluie. Rangez-les sous un toit ou dans une pièce fermée.'),
  self('hostility-response','HostilityResponse',5,'Réaction aux menaces',
    'Assignations règle la réaction de chaque colon face à une menace : fuir, ignorer ou attaquer. Un colon mobilisé obéit à vos ordres à la place.'),
  self('allowed-areas','AllowedAreas',4.5,'Zones autorisées',
    'Assignations peut limiter un colon à une zone autorisée que vous dessinez. Restreignez-les à l’intérieur pendant une attaque d’animaux ou des retombées toxiques.'),
  self('medical-operations','MedicalOperations',4,'Opérations',
    'Dans l’onglet Santé d’un colon, vous pouvez demander une opération. Un médecin la réalise sur un lit médical, avec les médicaments et les pièces nécessaires.'),
  self('time-assignments','TimeAssignments',3,'Planning',
    'Planning (F2) règle heure par heure le sommeil, les loisirs et le travail de chaque colon.'),
  self('tile-inspector','TileInspector',2,'Inspecter une case',
    'Maintenez Alt au-dessus d’une case pour lire son terrain, sa fertilité, sa lumière, sa température et son toit.'),
  self('outfits','Outfits',2,'Politiques de tenue',
    'Assignations attribue à chaque colon une politique de tenue : il change de vêtements selon ses filtres et l’état de ce qu’il porte.'),
  self('fire-preparation','FirePreparation',2,'Prévenir les incendies',
    'Le bois brûle vite, l’acier moins, la pierre pas du tout. Gardez des colons affectés à Incendie et une zone de foyer sur vos bâtiments ; un diffuseur de mousse peut étouffer un départ de feu.'),
  self('history-tab','HistoryTab',1,'Historique',
    'Historique retrace les événements de la colonie et l’évolution de son patrimoine.'),
  self('friendly-fire','FriendlyFireSafety',1,'Tirs amis',
    'Un tir peut toucher un allié placé sur sa trajectoire. Gardez vos tireurs en ligne, sans personne entre eux et la cible.'),
  // Concepts_TriggeredModal: a one-time message, never in the list.
  modal('orbital-trade-beacon','TradeGoodsMustBeNearBeacon','Biens près des balises',
    'Seuls les biens et l’argent posés à portée d’une balise de commerce orbital alimentée peuvent servir à cet échange. Rangez-les près des balises avant de commercer.'),
  modal('flick-warning','SwitchFlickingDesignation','Actionner un appareil',
    'L’appareil ne change pas d’état tout de suite : un colon doit se rendre sur place pour l’actionner. La demande reste affichée jusqu’à son passage et peut être annulée.'),
  modal('max-colonies','MaxNumberOfPlayerSettlements','Plusieurs colonies',
    'Vous pourrez fonder plus d’une colonie. Chacune devra être nourrie et défendue par ses propres colons ; une seule colonie reste la façon de jouer la plus simple.'),
]);

/** Core concepts with no Elsewhere feature to teach yet, not listed here:
 * ShieldBelts, DrugBurning, ShotAccuracyTooltip, GroupGotoHereDragging,
 * TVForSickPeople, GettingMoreTraders, ManualWorkPriorities, ClickingMessages,
 * SetGrowingZonePlant (never shown automatically by Core either),
 * ArrestingCreatesEnemies, TradingRequiresPermit, WorldCameraMovement (front
 * menu) and the two Steam Deck notes. */
