/** The 37 lessons of Core RimWorld 1.6's tutorial ("Apprendre à jouer"), as
 * InstructionDefs (Data/Core/Defs/Tutor/Instructions.xml): order, initiating
 * events, ending events, allowed action tags and the class that decides the
 * end. The action and event tags keep Core's names; the highlight tags are
 * those of Elsewhere's native controls (src/ui/native-highlight-tags.ts).
 * The French texts are Elsewhere's own. Interface data only. */
import {TUTORIAL_LESSONS_349,type TutorialLessonId349} from '../sim/tutorial-lessons-state-349';
import type {StructureKind} from '../sim/types';

/** Core Instruction classes, grouped by how they end. */
export type TutorialLessonKind349=
  | 'basic'          // Instruction_Basic: eventTagsEnd only
  | 'concept'        // Instruction_LearnConcept: the concept is learned
  | 'stockpile'      // Instruction_PlaceStockpile: exact 6 x 6 rect, ends on the designation
  | 'growing-zone'   // Instruction_PlaceGrowingZone: exact 10 x 8 rect, ends on the designation
  | 'unforbid'       // Instruction_UnforbidStartingResources
  | 'walls'          // Instruction_BuildRoomWalls
  | 'door'           // Instruction_BuildRoomDoor
  | 'in-room'        // Instruction_BuildInRoom
  | 'near-room'      // Instruction_BuildNearRoom
  | 'set-plant'      // Instruction_SetGrowingZonePlant
  | 'equip'          // Instruction_EquipWeapons
  | 'bill'           // Instruction_AddBill
  | 'mine'           // Instruction_MineSteel
  | 'chop'           // Instruction_ChopWood
  | 'expand-area'    // Instruction_ExpandAreaHome / BuildRoof
  | 'sandbags'       // Instruction_BuildSandbags
  | 'finish'         // Instruction_FinishConstruction
  | 'down-raider'    // Instruction_DownRaider
  | 'undraft';       // Instruction_UndraftAll

export interface TutorialLessonDef349 {
  id:TutorialLessonId349;
  kind:TutorialLessonKind349;
  /** Instruction text (French, Elsewhere's own words). */
  text:string;
  /** Short label shown on the map at the lesson's target (Core onMapInstruction). */
  onMap?:string;
  /** Core eventTagInitiate / eventTagInitiateSource. */
  initiate:string;
  initiateSource?:TutorialLessonId349;
  /** Core actionTagsAllowed. */
  allowed:readonly string[];
  /** Core eventTagsEnd. */
  end?:readonly string[];
  /** Native highlight tags of the controls to pulse. */
  highlight:readonly string[];
  /** Instruction_LearnConcept: the learning helper concept. */
  concept?:string;
  /** Instruction_BuildAtRoom / AddBill: the building and the count. */
  thing?:StructureKind;
  target?:number;
  /** Core startCentered: the first lesson opens centered on a dark overlay. */
  startCentered?:true;
  /** Core endTutorial. */
  endTutorial?:true;
  /** Core resetBuildDesignatorStuffs: building materials back to the default (wood). */
  resetStuff?:true;
}

const architect=(category:string,tool:string,material=false)=>['tab:architect',`category:${category}`,`tool:${tool}`,...material?[`material:${tool}`]:[]];
const build=(tag:string,stuff:readonly string[]=[])=>['MainTab-Architect-Open',`SelectDesignator-${tag}`,...stuff.map(s=>`SelectStuff-${tag}-${s}`),`Designate-${tag}`];
const pawnTabs=['ITab-Health-Open','ITab-Gear-Open','ITab-Needs-Open','ITab-Social-Open','ITab-Character-Open'];
const after=(id:TutorialLessonId349)=>`InstructionDeactivated-${id}`;

const DEFS:readonly TutorialLessonDef349[]=[
  {id:'CreateWorldParams',kind:'basic',initiate:'PageStart-CreateWorldParams',allowed:['GotoPrevPage','GotoNextPage'],end:['PageClosed'],highlight:['next-page'],startCentered:true,
    text:'Bienvenue ! Ce tutoriel montre les bases d’une colonie, pas à pas. Les réglages proposés pour la planète conviennent : appuyez sur Générer.'},
  {id:'ChooseLandingSite',kind:'basic',initiate:'PageStart-SelectStartingSite',allowed:['GotoPrevPage','ChooseBiome-TemperateForest-Flat-None','ITab-Planet-Open','ITab-Terrain-Open','GotoNextPage'],end:['PageClosed'],highlight:[],
    text:'Choisissez où atterrir : une forêt tempérée de plaine, le terrain le plus simple. La liste ne propose que ces lieux et le globe en marque un. Puis appuyez sur Suivant.'},
  {id:'ReorderCharacters',kind:'basic',initiate:'PageStart-ConfigureStartingPawns',allowed:['GotoPrevPage','ReorderPawn'],end:['ReorderPawnOptionalToStarting'],highlight:['reorder-pawn'],
    text:'Seuls les trois premiers candidats partent. Sélectionnez une personne laissée sur place et faites-la entrer dans l’équipe du départ (Choisir pour le départ, ou la flèche ↑).'},
  {id:'RandomizeCharacter',kind:'basic',initiate:'ReorderPawnOptionalToStarting',initiateSource:'ReorderCharacters',allowed:['GotoPrevPage','ReorderPawn','RandomizePawn'],end:['RandomizePawn'],highlight:['randomize-pawn'],
    text:'Un profil ne vous plaît pas ? Renouvelez-le avec le bouton ↻ à côté de son nom : une autre personne prend sa place.'},
  {id:'AcceptStartingPawns',kind:'basic',initiate:'RandomizePawn',allowed:['GotoPrevPage','ReorderPawn','RandomizePawn','ChangeDevelopmentStage','ChangeXenotype','GotoNextPage'],end:['PageClosed'],highlight:['next-page'],
    text:'Réorganisez, renouvelez ou renommez vos colons comme vous le voulez. Quand l’équipe vous plaît, appuyez sur Démarrer.'},
  {id:'MapCameraDolly',kind:'concept',concept:'camera-dolly',initiate:'GameStartDialogClosed',allowed:[],highlight:[],
    text:'Vous voilà sur la carte ! Déplacez la vue avec les flèches du clavier (ou Z, Q, S, D), ou en glissant avec le bouton du milieu de la souris.'},
  {id:'MapCameraZoom',kind:'concept',concept:'camera-zoom',initiate:after('MapCameraDolly'),allowed:[],highlight:[],
    text:'Très bien. Approchez et éloignez la vue avec la molette de la souris.'},
  {id:'Pause',kind:'concept',concept:'pause',initiate:after('MapCameraZoom'),allowed:[],highlight:['time-controls'],
    text:'Le temps peut s’arrêter : rien ne presse, vous pouvez donner tous vos ordres en pause. Mettez en pause et relancez avec la barre d’espace, ou avec les boutons de vitesse en bas à droite.'},
  {id:'TimeControls',kind:'concept',concept:'time-controls',initiate:after('Pause'),allowed:[],highlight:['time-controls'],
    text:'Le temps peut aussi aller plus vite. Changez de vitesse avec les touches 1, 2 et 3 ou avec les boutons en bas à droite.'},
  {id:'MakeStockpile',kind:'stockpile',initiate:after('TimeControls'),allowed:['MainTab-Architect-Open','SelectDesignator-ZoneAddStockpile_Resources','Designate-ZoneAddStockpile_Resources'],
    end:['Designate-ZoneAddStockpile_Resources'],highlight:['tools:zones','tool:stockpile'],onMap:'Réserve ici',
    text:'Vos colons rangent les biens dans des réserves. Ouvrez Zones, prenez Zone de stockage et tracez exactement le carré entouré sur la carte.'},
  {id:'EndStockpileDesignating',kind:'basic',initiate:after('MakeStockpile'),allowed:[],end:['ClearDesignatorSelection'],highlight:[],
    text:'Réserve tracée. Faites un clic droit (ou Échap) pour ranger l’outil.'},
  {id:'UnforbidStartingResources',kind:'unforbid',initiate:after('EndStockpileDesignating'),allowed:['ToggleForbidden','MainTab-Architect-Open','SelectDesignator-Unforbid','Designate-Unforbid'],
    highlight:['forbid','tools:orders','tool:allow'],onMap:'Interdit',
    text:'Les biens arrivés avec vous sont interdits : la croix rouge dit que personne n’y touche. Autorisez-les : sélectionnez-les puis Autoriser, ou prenez Ordres → Autoriser et tracez un rectangle.'},
  {id:'BuildRoomWalls',kind:'walls',initiate:after('UnforbidStartingResources'),allowed:build('Wall',['WoodLog']),highlight:architect('structure','wall',true),resetStuff:true,onMap:'Murs ici',
    text:'Construisez un abri. Architecte → Structure → Mur, en bois, sur tout le contour entouré.'},
  {id:'BuildRoomDoor',kind:'door',initiate:after('BuildRoomWalls'),allowed:build('Door',['WoodLog']),highlight:architect('structure','door',true),resetStuff:true,onMap:'Porte sur le contour',
    text:'Une pièce a besoin d’une porte : placez une porte en bois sur le contour, ailleurs que dans un coin.'},
  {id:'BuildBeds',kind:'in-room',thing:'bed',target:3,initiate:after('BuildRoomDoor'),allowed:build('Bed',['WoodLog']),highlight:architect('furniture','bed',true),resetStuff:true,onMap:'Lits ici',
    text:'Vos colons vont bâtir la pièce. Il leur faut des lits : placez trois lits en bois à l’intérieur (Architecte → Mobilier). Q et E les font tourner.'},
  {id:'BuildTorchLamp',kind:'in-room',thing:'torch-lamp',target:1,initiate:after('BuildBeds'),allowed:build('TorchLamp'),highlight:architect('furniture','torch-lamp'),onMap:'Lampe ici',
    text:'Éclairez la pièce : placez une lampe-torche à l’intérieur (Mobilier).'},
  {id:'BuildAnimalSleepingSpot',kind:'in-room',thing:'animal-sleeping-spot',target:1,initiate:after('BuildTorchLamp'),allowed:build('AnimalSleepingSpot'),highlight:architect('furniture','animal-sleeping-spot'),onMap:'Couchage ici',
    text:'Votre animal dort aussi : placez un emplacement de couchage animal dans la pièce (Mobilier).'},
  {id:'BuildHorseshoesPin',kind:'near-room',thing:'horseshoes',target:1,initiate:after('BuildAnimalSleepingSpot'),allowed:build('HorseshoesPin',['WoodLog','Steel']),highlight:architect('recreation','horseshoes',true),onMap:'Près de la pièce',
    text:'Vos colons ont besoin de se détendre. Placez un jeu de fers à cheval dehors, à moins de dix cases de la pièce (Architecte → Loisirs).'},
  {id:'MakeGrowingZone',kind:'growing-zone',initiate:after('BuildHorseshoesPin'),allowed:['MainTab-Architect-Open','SelectDesignator-ZoneAdd_Growing','Designate-ZoneAdd_Growing'],end:['Designate-ZoneAdd_Growing'],
    highlight:['tools:zones','tool:growing'],onMap:'Champ ici',
    text:'Il faut produire de quoi manger. Zones → Zone de culture : tracez exactement le rectangle entouré, sur un sol fertile.'},
  {id:'SetToGrowRice',kind:'set-plant',initiate:after('MakeGrowingZone'),allowed:['GrowingZoneSetPlant','GrowingZoneSetPlant-Plant_Rice'],end:['GrowingZoneSetPlant-Plant_Rice'],highlight:['growing-plant'],onMap:'Votre champ',
    text:'Choisissez ce qui sera semé. Rangez l’outil (clic droit), sélectionnez la zone de culture et réglez sa culture sur Riz.'},
  {id:'EquipWeapons',kind:'equip',initiate:after('SetToGrowRice'),allowed:[],highlight:[],onMap:'Arme',
    text:'Armez vos colons. Sélectionnez un colon, faites un clic droit sur une arme de départ et choisissez de vous en équiper. Faites-le pour chacun.'},
  {id:'BuildFueledStove',kind:'in-room',thing:'fueled-stove',target:1,initiate:after('EquipWeapons'),allowed:build('FueledStove'),highlight:architect('production','fueled-stove'),onMap:'Cuisinière ici',
    text:'Il faudra cuisiner : placez une cuisinière à bois dans la pièce (Architecte → Production).'},
  {id:'AddBillSimpleMeal',kind:'bill',thing:'fueled-stove',target:10,initiate:after('BuildFueledStove'),allowed:['ITab-Bills-Open','MainTab-Work-Open'],highlight:['inspector:bills'],onMap:'Sélectionnez-moi',
    text:'Des pommes de terre sont arrivées. La cuisine se commande sur le poste lui-même : une fois la cuisinière bâtie, sélectionnez-la, ouvrez Factures, ajoutez Repas simple et réglez le nombre à 10. Accélérez le temps si l’attente est longue.'},
  {id:'MineSteel',kind:'mine',initiate:after('AddBillSimpleMeal'),allowed:['MainTab-Architect-Open','SelectDesignator-Mine','Designate-Mine'],highlight:['tools:orders','tool:mine'],onMap:'Acier à miner',
    text:'Un filon d’acier est sorti de terre. Ordres → Miner : désignez toutes ses cases.'},
  {id:'ChopTrees',kind:'chop',target:10,initiate:after('MineSteel'),allowed:['MainTab-Architect-Open','SelectDesignator-PlantsHarvestWood','Designate-PlantsHarvestWood'],highlight:['tools:orders','tool:chop'],
    text:'Il faut du bois. Ordres → Couper : désignez dix arbres.'},
  {id:'OpenMainTabWork',kind:'basic',initiate:after('ChopTrees'),allowed:['MainTab-Work-Open'],end:['MainTab-Work-Open'],highlight:['tab:work'],
    text:'Ouvrez l’onglet Travail, en bas de l’écran.'},
  {id:'ChangeWorkSettings',kind:'concept',concept:'work-tab',initiate:after('OpenMainTabWork'),allowed:['MainTab-Work-Open'],highlight:['tab:work'],
    text:'Ici, vous décidez qui fait quoi : cochez ou décochez les cases des travaux de vos colons. Changez quelques réglages.'},
  {id:'BuildSimpleResearchBench',kind:'in-room',thing:'research-bench',target:1,initiate:after('ChangeWorkSettings'),allowed:['MainTab-Work-Open',...build('SimpleResearchBench',['WoodLog'])],
    highlight:architect('production','research-bench',true),resetStuff:true,onMap:'Établi ici',
    text:'La recherche ouvre de nouvelles constructions. Placez un bureau de recherche simple en bois dans la pièce (Production).'},
  {id:'OpenMainTabResearch',kind:'basic',initiate:after('BuildSimpleResearchBench'),allowed:['MainTab-Research-Open'],end:['MainTab-Research-Open'],highlight:['tab:research'],
    text:'Ouvrez l’onglet Recherches.'},
  {id:'SelectResearchProject',kind:'basic',initiate:after('OpenMainTabResearch'),allowed:['MainTab-Research-Open','MainTab-Work-Open'],end:['StartResearchProject'],highlight:['tab:research'],
    text:'Choisissez un projet de recherche. Un colon s’y mettra au bureau dès qu’il sera bâti.'},
  {id:'ExpandAreaHome',kind:'expand-area',target:30,initiate:after('SelectResearchProject'),allowed:['MainTab-Architect-Open','MainTab-Work-Open','SelectDesignator-AreaHomeExpand','Designate-AreaHomeExpand'],
    highlight:['tools:zones','tool:home'],
    text:'La zone de foyer marque ce que vos colons entretiennent : ils y éteignent les incendies et y réparent. Zones → Zone de foyer : agrandissez-la d’au moins trente cases.'},
  {id:'ExpandAreaBuildRoof',kind:'expand-area',target:10,initiate:after('ExpandAreaHome'),allowed:['MainTab-Architect-Open','MainTab-Work-Open','SelectDesignator-AreaBuildRoofExpand','Designate-AreaBuildRoofExpand'],
    highlight:['tools:zones','tool:build-roof'],
    text:'Les toits se commandent aussi. Zones → Construire un toit : tracez au moins dix cases, par exemple un auvent devant la porte.'},
  {id:'BuildSandbags',kind:'sandbags',initiate:after('ExpandAreaBuildRoof'),allowed:['MainTab-Architect-Open','MainTab-Work-Open','SelectDesignator-Sandbags','Designate-Sandbags'],
    highlight:architect('structure','sandbags'),onMap:'Sacs de sable ici',
    text:'Préparez une défense : placez des sacs de sable sur toutes les cases de l’anneau entouré (Architecte → Structure).'},
  {id:'FinishSandbags',kind:'finish',initiate:after('BuildSandbags'),allowed:['MainTab-Work-Open',...pawnTabs],highlight:[],
    text:'Attendez que vos colons aient fini toutes les constructions. Accélérez le temps au besoin.'},
  {id:'DownRaider',kind:'down-raider',initiate:after('FinishSandbags'),allowed:['Draft','Undraft','FireAtWillToggle','VerbTarget',...pawnTabs],highlight:['draft'],onMap:'À couvert ici',
    text:'Un pillard approche ! Mettez en pause, mobilisez vos colons (Mobiliser) et placez-les à couvert sur les cases marquées derrière les sacs de sable. Relancez le temps : ils tirent d’eux-mêmes.'},
  {id:'UndraftAll',kind:'undraft',initiate:after('DownRaider'),allowed:['Draft','Undraft'],highlight:['draft'],
    text:'La menace est écartée. Démobilisez tous vos colons pour qu’ils reprennent leur travail.'},
  {id:'ChooseStoryteller',kind:'basic',initiate:after('UndraftAll'),allowed:['MainTab-Menu-Open','ChooseStoryteller'],end:['ChooseStoryteller'],highlight:['tab:menu','choose-storyteller'],endTutorial:true,
    text:'Bravo, vous connaissez les bases ! Il reste à choisir qui racontera votre histoire : ouvrez le Menu et choisissez le narrateur. La partie continue ensuite normalement.'},
];
if(DEFS.length!==TUTORIAL_LESSONS_349.length||DEFS.some((d,i)=>d.id!==TUTORIAL_LESSONS_349[i]))throw Error('Tutorial lessons out of order.');
export const TUTORIAL_LESSON_DEFS_349:readonly TutorialLessonDef349[]=Object.freeze(DEFS);
const BY_ID=new Map(DEFS.map(d=>[d.id,d]));
export const tutorialLessonDef349=(id:TutorialLessonId349):TutorialLessonDef349=>BY_ID.get(id)!;
