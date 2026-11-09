import type { BackgroundSkillId } from './colonist-backgrounds.ts';
import type { Cell, Job, Structure, WorkType } from './types.ts';
import { isButcherStation, isStove } from './food-workstations.ts';
import { schemaAtLeast } from './schema-range.ts';

/** RimWorld's work assignment order (Core 1.6, Pawn_WorkSettings and
 * JobGiver_Work): work types sorted by the pawn's priority, then by their
 * natural priority; inside a type, work givers by priorityInType, then by
 * definition order. The first giver that finds a target gives the job, and
 * its target is the closest one in straight-line distance. Rule data only. */
export const rimWorkGiverOrder301=schemaAtLeast(301);

/** Natural priority of RimWorld's work types, and the work type of ours that
 * holds the pawn's priority for it. */
// Defs/WorkTypeDefs/WorkTypes.xml, in definition order (rule data only):
// naturalPriority, alwaysStartActive and relevantSkills.
export const RIM_WORK_TYPES={
  Firefighter:{natural:1400,work:'firefight',always:true,skills:[]},Patient:{natural:1350,work:'patient',always:true,skills:[]},
  Doctor:{natural:1300,work:'doctor',always:false,skills:['medicine']},PatientBedRest:{natural:1200,work:'bedrest',always:true,skills:[]},
  BasicWorker:{natural:1150,work:'basic',always:true,skills:[]},Warden:{natural:1100,work:'warden',always:false,skills:['social']},
  Handling:{natural:1050,work:'handle',always:false,skills:['animals']},Cooking:{natural:1000,work:'cook',always:false,skills:['cooking']},
  Hunting:{natural:950,work:'hunt',always:false,skills:['shooting','animals']},Construction:{natural:900,work:'build',always:false,skills:['construction']},
  Growing:{natural:700,work:'grow',always:false,skills:['plants']},Mining:{natural:600,work:'mine',always:false,skills:['mining']},
  PlantCutting:{natural:500,work:'gather',always:false,skills:['plants']},Smithing:{natural:470,work:'smith',always:false,skills:['crafting']},
  Tailoring:{natural:450,work:'tailor',always:false,skills:['crafting']},Art:{natural:430,work:'art',always:false,skills:['artistic']},
  Crafting:{natural:400,work:'craft',always:false,skills:['crafting']},Hauling:{natural:300,work:'haul',always:true,skills:[]},
  Cleaning:{natural:200,work:'clean',always:true,skills:[]},Research:{natural:100,work:'research',always:false,skills:['intellectual']},
} as const satisfies Record<string,{natural:number;work:WorkType;always:boolean;skills:readonly BackgroundSkillId[]}>;
export type RimWorkTypeId=keyof typeof RIM_WORK_TYPES;

// Generated from RimWorld 1.6 Core Defs/WorkGiverDefs/WorkGivers.xml (rule data only).
// defName, work type, priorityInType, emergency; order = definition order (stable tie-break).
export const RIM_WORK_GIVER_TABLE=[
  ['FightFires','Firefighter',0,true],
  ['PatientGoToBedEmergencyTreatment','Patient',0,true],
  ['PatientGoToBedTreatment','Patient',0,false],
  ['DoctorTendEmergency','Doctor',110,true],
  ['DoctorTendToHumanlikes','Doctor',100,false],
  ['DoctorTendToSelf','Doctor',90,false],
  ['DoctorTendToSelfEmergency','Doctor',95,false],
  ['DoctorFeedHumanlikes','Doctor',80,false],
  ['DoBillsMedicalHumanOperation','Doctor',70,false],
  ['DoctorRescue','Doctor',60,false],
  ['DoctorTendToAnimals','Doctor',50,false],
  ['DoctorFeedAnimals','Doctor',40,false],
  ['DoBillsMedicalAnimalOperation','Doctor',30,false],
  ['TakeToBedToOperate','Doctor',20,false],
  ['VisitSickPawn','Doctor',10,false],
  ['PatientGoToBedRecuperate','PatientBedRest',0,false],
  ['Flick','BasicWorker',500,false],
  ['BasicReleasePrisoner','BasicWorker',100,false],
  ['Open','BasicWorker',50,false],
  ['EjectFuel','BasicWorker',50,false],
  ['ExtractSkull','BasicWorker',20,false],
  ['DoExecution','Warden',110,false],
  ['ExecuteGuiltyColonist','Warden',110,false],
  ['ReleasePrisoner','Warden',100,false],
  ['TakePrisonerToBed','Warden',90,false],
  ['FeedPrisoner','Warden',80,false],
  ['DeliverFoodToPrisoner','Warden',70,false],
  ['ChatWithPrisoner','Warden',60,false],
  ['TakeRoamingAnimalsToPen','Handling',160,false],
  ['HandlingFeedPatientAnimals','Handling',150,false],
  ['TakeToPen','Handling',130,false],
  ['Slaughter','Handling',100,false],
  ['ReleaseToWild','Handling',100,false],
  ['Milk','Handling',90,false],
  ['Shear','Handling',85,false],
  ['Tame','Handling',80,false],
  ['Train','Handling',70,false],
  ['RebalanceAnimalsInPens','Handling',60,false],
  ['DoBillsCook','Cooking',100,false],
  ['DoBillsCookCampfire','Cooking',97,false],
  ['DoBillsButcherFlesh','Cooking',90,false],
  ['CookFillHopper','Hauling',50,false],
  ['DoBillsBrew','Cooking',30,false],
  ['HunterHunt','Hunting',100,false],
  ['FixBrokenDownBuilding','Construction',120,false],
  ['Uninstall','Construction',110,false],
  ['ExtractTree','PlantCutting',110,false],
  ['BuildRoofs','Construction',100,false],
  ['RemoveRoofs','Construction',90,false],
  ['DeconstructForBlueprint','Construction',85,false],
  ['ConstructFinishFrames','Construction',80,false],
  ['ConstructDeliverResourcesToFrames','Construction',70,false],
  ['ConstructDeliverResourcesToBlueprints','Construction',60,false],
  ['Replant','Growing',60,false],
  ['FillIn','Construction',51,false],
  ['Deconstruct','Construction',50,false],
  ['Repair','Construction',40,false],
  ['PaintBuilding','Art',200,false],
  ['PaintFloor','Art',200,false],
  ['RemovePaintBuilding','Art',202,false],
  ['RemovePaintFloor','Art',202,false],
  ['ConstructRemoveFloors','Construction',30,false],
  ['ConstructRemoveFoundations','Construction',30,false],
  ['ConstructSmoothFloors','Construction',20,false],
  ['ConstructSmoothWalls','Construction',10,false],
  ['GrowerHarvest','Growing',100,false],
  ['GrowerSow','Growing',50,false],
  ['Mine','Mining',100,false],
  ['Drill','Mining',50,false],
  ['PlantsCut','PlantCutting',0,false],
  ['DoBillsMakeWeapons','Smithing',115,false],
  ['DoBillsMachiningTable','Smithing',75,false],
  ['DoBillsFabricationBench','Smithing',50,false],
  ['DoBillsMakeApparel','Tailoring',110,false],
  ['DoBillsSculpt','Art',100,false],
  ['DoBillsUseCraftingSpot','Crafting',100,false],
  ['DoBillsRefinery','Crafting',97,false],
  ['DoBillsProduceDrugs','Crafting',95,false],
  ['DoBillsStonecut','Crafting',90,false],
  ['DoBillsSmelter','Crafting',80,false],
  ['RearmTurrets','Hauling',150,false],
  ['Refuel','Hauling',140,false],
  ['UnloadCarriers','Hauling',130,false],
  ['HelpGatheringItemsForCaravan','Hauling',120,false],
  ['LoadTransporters','Hauling',110,false],
  ['HaulToPortal','Hauling',105,false],
  ['Strip','Hauling',100,false],
  ['HaulCorpses','Hauling',90,false],
  ['DoBillsCremate','Hauling',40,false],
  ['DoBillsHaulCampfire','Hauling',30,false],
  ['TakeBeerOutOfFermentingBarrel','Hauling',20,false],
  ['FillFermentingBarrel','Hauling',19,false],
  ['HaulGeneral','Hauling',15,false],
  ['DeliverResourcesToFrames','Hauling',10,false],
  ['DeliverResourcesToBlueprints','Hauling',9,false],
  ['HaulMerge','Hauling',5,false],
  ['EmptyEggBox','Hauling',20,false],
  ['CleanClearSnow','Cleaning',10,false],
  ['CleanFilth','Cleaning',5,false],
  ['Research','Research',100,false],
  ['LongRangeScan','Research',50,false],
  ['GroundPenetratingScan','Research',50,false],
  ['PlantSeed','Growing',80,false],
  ['StudyArchotechStructures','Research',110,false],
  ['Hack','Research',130,false],
] as const;
export type RimWorkGiverId=typeof RIM_WORK_GIVER_TABLE[number][0];
export interface RimWorkGiver {readonly id:RimWorkGiverId;readonly type:RimWorkTypeId;readonly priorityInType:number;readonly emergency:boolean;readonly order:number;readonly work:WorkType;readonly natural:number}
const givers=new Map<RimWorkGiverId,RimWorkGiver>(RIM_WORK_GIVER_TABLE.map(([id,type,priorityInType,emergency],order)=>[id,Object.freeze({id,type,priorityInType,emergency,order,work:RIM_WORK_TYPES[type].work,natural:RIM_WORK_TYPES[type].natural})]));
export function rimWorkGiver(id:RimWorkGiverId):RimWorkGiver {return givers.get(id)!;}

/** RimWorld's order of two givers for one pawn, given the pawn's priority
 * (1 highest) for each giver's work type: negative when a comes first. */
export function compareRimWorkGivers(a:RimWorkGiver,priorityA:number,b:RimWorkGiver,priorityB:number):number {
  return priorityA-priorityB||b.natural-a.natural||b.priorityInType-a.priorityInType||a.order-b.order;
}
/** Straight-line squared distance on the map plane (IntVec3.LengthHorizontalSquared). */
export const horizontalDistanceSquared=(a:Cell,b:Cell):number=>(a.x-b.x)**2+(a.z-b.z)**2;

/** The bill giver of a production station (WorkGiver_DoBill definitions). */
export function stationWorkGiver(station:Pick<Structure,'kind'>):RimWorkGiverId {
  const kind=station.kind;
  if(isStove(kind))return 'DoBillsCook';
  if(kind==='campfire')return 'DoBillsCookCampfire';
  if(isButcherStation(kind))return 'DoBillsButcherFlesh';
  if(kind==='brewery')return 'DoBillsBrew';
  if(kind==='fueled-smithy'||kind==='electric-smithy')return 'DoBillsMakeWeapons';
  if(kind==='machining-table')return 'DoBillsMachiningTable';
  if(kind==='fabrication-bench')return 'DoBillsFabricationBench';
  if(kind==='tailor-bench'||kind==='electric-tailor-bench')return 'DoBillsMakeApparel';
  if(kind==='art-bench')return 'DoBillsSculpt';
  if(kind==='biofuel-refinery')return 'DoBillsRefinery';
  if(kind==='drug-lab')return 'DoBillsProduceDrugs';
  if(kind==='stonecutter')return 'DoBillsStonecut';
  if(kind==='electric-smelter')return 'DoBillsSmelter';
  if(kind==='electric-crematorium')return 'DoBillsCremate';
  return 'DoBillsUseCraftingSpot';
}

/** The giver of a designated job (designations, blueprints and frames). */
export function jobWorkGiver(job:Pick<Job,'kind'|'growingZoneId'|'flowerPotId'|'installationWork'>&{wallDoor296?:{plan?:unknown}}):RimWorkGiverId {
  switch(job.kind){
    case 'flick':return 'Flick';
    case 'fix-breakdown':return 'FixBrokenDownBuilding';
    case 'uninstall':return 'Uninstall';
    case 'build-roof':return 'BuildRoofs';
    case 'remove-roof':return 'RemoveRoofs';
    case 'deconstruct':return job.wallDoor296?.plan?'DeconstructForBlueprint':'Deconstruct';
    case 'repair':return 'Repair';
    case 'remove-floor':return 'ConstructRemoveFloors';
    case 'remove-bridge':return 'ConstructRemoveFoundations';
    case 'smooth-floor':return 'ConstructSmoothFloors';
    case 'mine':return 'Mine';
    case 'extract-tree':return 'ExtractTree';
    case 'replant-tree':return 'Replant';
    case 'sow':return 'GrowerSow';
    case 'harvest':return job.growingZoneId!==undefined||job.flowerPotId!==undefined?'GrowerHarvest':'PlantsCut';
    case 'chop':case 'cut':return 'PlantsCut';
    default:return 'ConstructFinishFrames';
  }
}

/** How each giver finds its target (JobGiver_Work, GenClosest): a thing
 * scanner whose request is stored in regions searches region by region from
 * the pawn (breadth first, at most `maxRegions` non-door regions) and takes
 * the closest thing of the first region holding a valid one, then falls back
 * to the globally closest reachable thing; other thing scanners take the
 * globally closest reachable thing; cell scanners the closest cell. Rule data
 * generated from the Core 1.6 work giver classes. */
export interface RimWorkGiverSearch {scan:'things'|'cells'|'none';regionwise:boolean;maxRegions:number;pathEnd:'touch'|'on-cell'|'interaction'|'closest-touch'|'none';prioritized:boolean}
export const RIM_WORK_GIVER_SEARCH:Record<RimWorkGiverId,RimWorkGiverSearch>={
  FightFires:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  PatientGoToBedEmergencyTreatment:{scan:'none',regionwise:false,maxRegions:30,pathEnd:'none',prioritized:false},
  PatientGoToBedTreatment:{scan:'none',regionwise:false,maxRegions:30,pathEnd:'none',prioritized:false},
  DoctorTendEmergency:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoctorTendToHumanlikes:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoctorTendToSelf:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoctorTendToSelfEmergency:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoctorFeedHumanlikes:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  DoBillsMedicalHumanOperation:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoctorRescue:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  DoctorTendToAnimals:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoctorFeedAnimals:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  DoBillsMedicalAnimalOperation:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  TakeToBedToOperate:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  VisitSickPawn:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  PatientGoToBedRecuperate:{scan:'none',regionwise:false,maxRegions:30,pathEnd:'none',prioritized:false},
  Flick:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  BasicReleasePrisoner:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  Open:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  EjectFuel:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  ExtractSkull:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  DoExecution:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  ExecuteGuiltyColonist:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  ReleasePrisoner:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  TakePrisonerToBed:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  FeedPrisoner:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  DeliverFoodToPrisoner:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  ChatWithPrisoner:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  TakeRoamingAnimalsToPen:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  HandlingFeedPatientAnimals:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  TakeToPen:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  Slaughter:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  ReleaseToWild:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  Milk:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  Shear:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  Tame:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  Train:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  RebalanceAnimalsInPens:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  DoBillsCook:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsCookCampfire:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsButcherFlesh:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  CookFillHopper:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  DoBillsBrew:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  HunterHunt:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'on-cell',prioritized:false},
  FixBrokenDownBuilding:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  Uninstall:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  ExtractTree:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  BuildRoofs:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  RemoveRoofs:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'closest-touch',prioritized:true},
  DeconstructForBlueprint:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructFinishFrames:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructDeliverResourcesToFrames:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructDeliverResourcesToBlueprints:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  Replant:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  FillIn:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  Deconstruct:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  Repair:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  PaintBuilding:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  PaintFloor:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  RemovePaintBuilding:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  RemovePaintFloor:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructRemoveFloors:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructRemoveFoundations:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructSmoothFloors:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  ConstructSmoothWalls:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  GrowerHarvest:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  GrowerSow:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  Mine:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  Drill:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  PlantsCut:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  DoBillsMakeWeapons:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsMachiningTable:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsFabricationBench:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsMakeApparel:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsSculpt:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsUseCraftingSpot:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsRefinery:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsProduceDrugs:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsStonecut:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsSmelter:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  RearmTurrets:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  Refuel:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  UnloadCarriers:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  HelpGatheringItemsForCaravan:{scan:'none',regionwise:false,maxRegions:30,pathEnd:'none',prioritized:false},
  LoadTransporters:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  HaulToPortal:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  Strip:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'closest-touch',prioritized:false},
  HaulCorpses:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  DoBillsCremate:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  DoBillsHaulCampfire:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  TakeBeerOutOfFermentingBarrel:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  FillFermentingBarrel:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  HaulGeneral:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  DeliverResourcesToFrames:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  DeliverResourcesToBlueprints:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  HaulMerge:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  EmptyEggBox:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  CleanClearSnow:{scan:'cells',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
  CleanFilth:{scan:'things',regionwise:true,maxRegions:4,pathEnd:'touch',prioritized:false},
  Research:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:true},
  LongRangeScan:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  GroundPenetratingScan:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'interaction',prioritized:false},
  PlantSeed:{scan:'things',regionwise:true,maxRegions:30,pathEnd:'touch',prioritized:false},
  StudyArchotechStructures:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:true},
  Hack:{scan:'things',regionwise:false,maxRegions:30,pathEnd:'touch',prioritized:false},
};
