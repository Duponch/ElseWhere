import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isVictoryResearchProject298} from './victory-research-content-298.ts';
import {validVictoryResearchDomain298} from './victory-research-298.ts';
import {validForestryResearch291} from './forestry-save-291.ts';
import {firefoamResearchUnlocked290} from './firefoam-content-290.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {validShipCasketResearchDomain277,shipCryptosleepUnlocked277} from './ship-casket-research-277.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
import {validShipEngineResearchDomain276} from './ship-engine-research-276.ts';
import {shipEngineUnlocked276,shipBasicsUnlocked275} from './research.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {SHIP_BASICS_RESEARCH_COST275,SHIP_REACTOR_RESEARCH_COST275,shipReactorUnlocked275,needsHighTechBench,needsResearchAnalyzer} from './research.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {isSchema272OrLater,isSchema270OrLater,isSchema271OrLater} from './schema-compatibility-257.ts';
import {PROSTHETICS_RESEARCH_COST273,CRYPTOSLEEP_RESEARCH_COST271,cryptosleepUnlocked271,LONG_BLADES_RESEARCH_COST,longBladesUnlocked270,smithingUnlocked,BREWING_RESEARCH_COST,GEOTHERMAL_POWER_RESEARCH_COST,geothermalPowerUnlocked,PEMMICAN_RESEARCH_COST,pemmicanUnlocked} from './research.ts';
/** Brewing research is prospective. Owning a recovered brewery or bought beer
 * does not require completing the construction research. */
export function validBrewingResearchTransport265(world:World,version:number):boolean {
  try{
    const state=world.research,p=state?.brewing,project=state?.project;
    if(state&&Object.hasOwn(state,'brewing')){
      if(version<265||!record(p)||Object.getPrototypeOf(p)!==Object.prototype
        ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
        ||!Object.hasOwn(p,'points')||!int(p.points,0,BREWING_RESEARCH_COST)
        ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==BREWING_RESEARCH_COST||project==='brewing':p.points>=BREWING_RESEARCH_COST))return false;
    }
    return project!=='brewing'||version>=265&&p!==undefined;
  }catch{return false;}
}
import {PEMMICAN_SCHEMA_VERSION,isPemmicanRecipe} from './pemmican-content.ts';
import type { PowerParentReader } from './power-parent-validation.ts';
import { BIOFUEL_REFINING_RESEARCH_COST,biofuelRefiningUnlocked,NUTRIENT_PASTE_RESEARCH_COST,DEEP_DRILLING_RESEARCH_COST,GROUND_SCANNER_RESEARCH_COST,deepDrillingUnlocked,groundScannerUnlocked,STERILE_MATERIALS_RESEARCH_COST,VITALS_MONITOR_RESEARCH_COST,sterileMaterialsUnlocked,vitalsMonitorUnlocked,DRUG_PRODUCTION_RESEARCH_COST,MEDICINE_PRODUCTION_RESEARCH_COST,drugProductionUnlocked,medicineProductionUnlocked,HYDROPONICS_RESEARCH_COST,hydroponicsUnlocked,GUN_TURRETS_RESEARCH_COST,gunTurretsUnlocked,TUBE_TELEVISION_RESEARCH_COST,tubeTelevisionUnlocked,PACKAGED_SURVIVAL_MEALS_RESEARCH_COST,packagedSurvivalMealsUnlocked,HOSPITAL_BED_RESEARCH_COST,hospitalBedUnlocked,MACHINING_RESEARCH_COST,GUNSMITHING_RESEARCH_COST,PLATE_ARMOR_RESEARCH_COST,FLAK_ARMOR_RESEARCH_COST,RECON_ARMOR_RESEARCH_COST,MICROELECTRONICS_RESEARCH_COST,MULTI_ANALYZER_RESEARCH_COST,FABRICATION_RESEARCH_COST,ADVANCED_FABRICATION_RESEARCH_COST,AUTODOORS_RESEARCH_COST,microelectronicsUnlocked,multiAnalyzerUnlocked,fabricationUnlocked,advancedFabricationUnlocked,reconArmorUnlocked,autodoorsUnlocked,machiningUnlocked,researchPrerequisite,STONECUTTING_RESEARCH_COST,SMITHING_RESEARCH_COST,COMPLEX_FURNITURE_RESEARCH_COST,CLOTHING_RESEARCH_COST,AIR_CONDITIONING_COST,BATTERIES_RESEARCH_COST,SOLAR_POWER_RESEARCH_COST,airConditioningUnlocked,clothingUnlocked,batteriesUnlocked,solarPowerUnlocked,complexFurnitureUnlocked,flakArmorUnlocked } from './research.ts';
import { cookingSpot } from './cooking-bills.ts';
import { canStandAt } from './furniture-travel.ts';
import { validatePower } from './power-save.ts';
import { constructionCapacity } from './construction-materials.ts';
import { reservedSource } from './materials.ts';
import type { World } from './types.ts';
import { gunsmithingUnlocked } from './research.ts';
import { smithyConstructionUnlocked267 } from './research.ts';
import { isGunRecipe,isFlakRecipe } from './production-recipes.ts';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
/** Prospective ship projects. Recovered structures do not invent knowledge;
 * each paid new ship-part construction requires its completed research. */
export function validShipResearchTransport275(world:World,version:number):boolean {
 try{
  if(!validShipCasketResearchDomain277(world.research,version,world.tick)||!validShipEngineResearchDomain276(world.research,version,world.tick))return false;
  const state=world.research;
  for(const [key,project,cost] of [['shipBasics','ship-basics',SHIP_BASICS_RESEARCH_COST275],['shipReactor','ship-reactor',SHIP_REACTOR_RESEARCH_COST275]] as const){
   const p=state?.[key];
   if(state&&Object.hasOwn(state,key)){
    if(!isSchema275OrLater(version)||!record(p)||Object.getPrototypeOf(p)!==Object.prototype||!Object.hasOwn(p,'points')
     ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
     ||!int(p.points,0,cost)||!!researchPrerequisite(world,project)
     ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==cost||state.project===project:p.points>=cost))return false;
   }
   if(state?.project===project&&(!isSchema275OrLater(version)||!p))return false;
  }
  if(world.jobs.some(j=>(j.kind==='ship-computer'||j.kind==='ship-sensors')&&!((isSchema298OrLater(Number(version)))&&world.research?.[j.kind==='ship-computer'?'shipComputer':'shipSensors']?.completedAt!==undefined)))return false;
  if(world.jobs.some(j=>j.kind==='ship-reactor')&&!(isSchema275OrLater(version)&&shipReactorUnlocked275(world)))return false;
  if(world.jobs.some(j=>j.kind==='ship-beam')&&!(isSchema276OrLater(version)&&shipBasicsUnlocked275(world)))return false;
  if(world.jobs.some(j=>j.kind==='ship-cryptosleep-casket')&&!(isSchema277OrLater(version)&&shipCryptosleepUnlocked277(world)))return false;
  if(world.jobs.some(j=>j.kind==='ship-engine')&&!(isSchema276OrLater(version)&&shipEngineUnlocked276(world)))return false;
  if(state?.project==='ship-basics'||state?.project==='ship-reactor'||state?.project==='ship-engine'||state?.project==='ship-cryptosleep')for(const pawn of world.pawns){
   const task=pawn.research;if(task&&(!world.structures.some(s=>s.id===task.stationId&&s.kind==='hi-tech-research-bench')
    ||task.facilityId===undefined||!world.structures.some(s=>s.id===task.facilityId&&s.kind==='multi-analyzer')))return false;
  }
  return true;
 }catch{return false;}
}
/** Sparse transport guard for the new research record only. Recovered physical
 * prostheses need no fabrication knowledge; the runtime gates new work. */
export function validProstheticsResearchTransport273(world:World,version:number):boolean {
  try{
    const state=world.research,p=state?.prosthetics;
    if(state&&Object.hasOwn(state,'prosthetics')){
      if(!isSchema273OrLater(version)||!record(p)||Object.getPrototypeOf(p)!==Object.prototype
        ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
        ||!Object.hasOwn(p,'points')||!int(p.points,0,PROSTHETICS_RESEARCH_COST273)
        ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==PROSTHETICS_RESEARCH_COST273||state.project==='prosthetics':p.points>=PROSTHETICS_RESEARCH_COST273)
        ||!!researchPrerequisite(world,'prosthetics'))return false;
    }
    return state?.project!=='prosthetics'||isSchema273OrLater(version)&&p!==undefined;
  }catch{return false;}
}
/** Existing Smithing research unlocks new construction. A recovered/minified
 * bench is still usable without replaying its construction research. */
export function validSmithyResearchTransport267(world:World,version:number):boolean {
  try {
    const smithy=(kind:unknown)=>kind==='fueled-smithy'||kind==='electric-smithy';
    if(version>=267)return !world.jobs.some(j=>smithy(j.kind)&&!smithyConstructionUnlocked267(world));
    const marked=(v:unknown):boolean=>record(v)&&(smithy(v.kind)
      ||['furniture','deconstruction','repair','fixBreakdown'].some(k=>record(v[k])&&smithy(v[k].kind)));
    return !world.structures.some(marked)&&!world.jobs.some(marked)&&!(world.packed??[]).some(p=>marked(p.building))
      &&![...(world.visitors?.departed??[]),...(world.podRescues?.departed??[])].some(d=>(d.packed??[]).some(p=>marked(p.building)));
  }catch{return false;}
}
/** New research/content only; reconstructed snapshots reuse this guard without
 * another historical research, world or terrain validation. */
export function validDeepResearchTransport(world:World,version:number):boolean {
  try {
    const state=world.research,project=state?.project;
    const progress=(p:unknown,cost:number,active:boolean)=>record(p)&&Object.keys(p).every(k=>k==='points'||k==='completedAt')&&int(p.points,0,cost)
      &&(p.completedAt===undefined?p.points<cost:int(p.completedAt,0,world.tick)&&p.points===cost&&!active);
    if(state)for(const [key,id,cost] of [['deepDrilling','deep-drilling',DEEP_DRILLING_RESEARCH_COST],['groundScanner','ground-scanner',GROUND_SCANNER_RESEARCH_COST]] as const){
      if(Object.hasOwn(state,key)&&(version<215||!progress(state[key],cost,project===id)||!!researchPrerequisite(world,id)))return false;
      if(project===id&&(version<215||!state[key]))return false;
    }
    const allowed=(s:unknown):boolean=>{
      if(!record(s))return false;
      const kinds=[s.kind,record(s.furniture)?s.furniture.kind:undefined,record(s.deconstruction)?s.deconstruction.kind:undefined];
      return (!kinds.includes('deep-drill')||version>=215&&deepDrillingUnlocked(world))
        &&(!kinds.includes('ground-scanner')||version>=215&&groundScannerUnlocked(world));
    };
    for(const s of world.structures)if(!allowed(s))return false;
    for(const j of world.jobs)if(!allowed(j))return false;
    for(const p of world.packed??[])if(!allowed(p.building)||p.building.kind==='ground-scanner')return false;
    for(const departed of [world.visitors?.departed??[],world.podRescues?.departed??[]])for(const d of departed)for(const p of d.packed??[])
      if(!allowed(p.building)||p.building.kind==='ground-scanner')return false;
    if((project==='cryptosleep'||project==='deep-drilling'||project==='ground-scanner')&&world.pawns.some(p=>p.research&&!world.structures.some(s=>s.id===p.research!.stationId&&s.kind==='hi-tech-research-bench')))return false;
    return true;
  }catch{return false;}
}
/** Sparse V211 guard, shared by files and reconstructed snapshots. Terrain is
 * checked in the existing floor/checkpoint/delta traversal, not scanned here. */
export function validHospitalSupportTransport(world:World,version:number,powerTopology?:PowerParentReader):boolean {
  try {
    const state=world.research,project=state?.project;
    const progress=(p:unknown,cost:number,active:boolean)=>record(p)&&Object.keys(p).every(k=>k==='points'||k==='completedAt')&&int(p.points,0,cost)
      &&(p.completedAt===undefined?p.points<cost:int(p.completedAt,0,world.tick)&&p.points===cost&&!active);
    if(state){
      for(const [key,id,cost] of [['sterileMaterials','sterile-materials',STERILE_MATERIALS_RESEARCH_COST],['vitalsMonitor','vitals-monitor',VITALS_MONITOR_RESEARCH_COST]] as const){
        if(Object.hasOwn(state,key)&&(version<211||!progress(state[key],cost,project===id)))return false;
        if(project===id&&(version<211||!state[key]))return false;
      }
      if(state.vitalsMonitor!==undefined&&researchPrerequisite(world,'vitals-monitor'))return false;
    }
    const content=[...world.structures,...world.jobs,...(world.packed??[]).map(p=>p.building)];
    const monitorContent=content.filter(s=>s.kind==='vitals-monitor');
    if(content.some(s=>s.kind==='vitals-monitor'||'furniture' in s&&s.furniture?.kind==='vitals-monitor'||'deconstruction' in s&&s.deconstruction?.kind==='vitals-monitor')&&!vitalsMonitorUnlocked(world))return false;
    for(const s of monitorContent)if(version<211||s.material!=='steel'||s.footprint!=='standard'||!int(s.orientation,0,3)
      ||Object.hasOwn(s,'quality')||Object.hasOwn(s,'breakdown')||Object.hasOwn(s,'emp'))return false;
    for(const j of world.jobs)if(j.kind==='vitals-monitor'&&(Object.hasOwn(j,'power')||Object.hasOwn(j,'battery')))return false;
    if(monitorContent.some(s=>world.structures.includes(s as World['structures'][number])||(world.packed??[]).some(p=>p.building===s))&&validatePower(world,version,'vitals-monitor',powerTopology).length)return false;
    for(const departed of [world.visitors?.departed??[],world.podRescues?.departed??[]])for(const d of departed)for(const p of d.packed??[]){
      const s=p.building;if(s.kind!=='vitals-monitor')continue;
      if(!vitalsMonitorUnlocked(world)||s.material!=='steel'||s.footprint!=='standard'||!int(s.orientation,0,3)||Object.hasOwn(s,'quality')||Object.hasOwn(s,'breakdown')||Object.hasOwn(s,'emp')
        ||!record(s.power)||Object.keys(s.power).some(k=>!['on','parentId','switchOn'].includes(k))||s.power.on!==false||s.power.parentId!==null||s.power.switchOn!==undefined&&typeof s.power.switchOn!=='boolean')return false;
    }
    for(const j of world.jobs)if(j.floor==='sterile-tile'&&!sterileMaterialsUnlocked(world))return false;
    const silver=new Map<number,number>();
    for(const p of world.piles)if(p.item==='silver'&&p.owner.type==='job'){
      const j=world.jobs.find(j=>p.owner.type==='job'&&j.id===p.owner.jobId);
      if(version<211||!j||j.kind!=='lay-floor'||j.floor!=='sterile-tile'||j.construction!=='frame'||!int(p.quantity,1,12))return false;
      const quantity=(silver.get(j.id)??0)+p.quantity;if(quantity>12)return false;silver.set(j.id,quantity);
    }
    for(const p of world.pawns){
      const h=p.haul;if(!h||h.destination.type!=='job'||h.whole)continue;
      const pile=world.piles.find(i=>i.id===(h.phase==='pickup'?h.sourcePileId:h.carryPileId));if(pile?.item!=='silver')continue;
      const j=world.jobs.find(j=>h.destination.type==='job'&&j.id===h.destination.jobId);
      if(version<211||!j||j.kind!=='lay-floor'||j.floor!=='sterile-tile'||!int(h.quantity,1,10)||constructionCapacity(world,j,pile.item,p.id)<h.quantity
        ||(h.phase==='pickup'?h.carryPileId!==null||pile.owner.type!=='ground'||reservedSource(world,pile.id)>pile.quantity:
          pile.owner.type!=='pawn'||pile.owner.pawnId!==p.id||pile.quantity!==h.quantity))return false;
    }
    if(world.deconstructed&&Object.hasOwn(world.deconstructed,'lostSilver')&&(version<211||!int(world.deconstructed.lostSilver)))return false;
    if(world.destroyed?.lost&&Object.hasOwn(world.destroyed.lost,'silver')&&(version<211||!int((world.destroyed.lost as Record<string,unknown>).silver,1)))return false;
    return true;
  }catch{return false;}
}
/** The bridge already validates the historical research envelope separately. */
export function validMedicineResearchTransport(world:World,version:number):boolean {
  const state=world.research,project=state?.project;
  if(state){
    if(version<206&&(Object.hasOwn(state,'drugProduction')||Object.hasOwn(state,'medicineProduction')||project==='drug-production'||project==='medicine-production'))return false;
    const progress=(p:unknown,cost:number,active:boolean):boolean=>record(p)&&Object.keys(p).every(k=>k==='points'||k==='completedAt')&&int(p.points,0,cost)
      &&(p.completedAt===undefined?p.points<cost:int(p.completedAt,0,world.tick)&&p.points===cost&&!active);
    if(state.drugProduction!==undefined&&!progress(state.drugProduction,DRUG_PRODUCTION_RESEARCH_COST,project==='drug-production'))return false;
    if(project==='drug-production'&&!state.drugProduction)return false;
    if(state.medicineProduction!==undefined&&(!progress(state.medicineProduction,MEDICINE_PRODUCTION_RESEARCH_COST,project==='medicine-production')||!!researchPrerequisite(world,'medicine-production')))return false;
    if(project==='medicine-production'&&!state.medicineProduction)return false;
  }
  const content=[...world.structures,...world.jobs,...(world.packed??[]).map(p=>p.building)];
  if(project==='medicine-production'&&world.pawns.some(p=>p.research&&!world.structures.some(s=>s.id===p.research!.stationId&&s.kind==='hi-tech-research-bench')))return false;
  if(!drugProductionUnlocked(world)&&content.some(s=>s.kind==='drug-lab'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='drug-lab'))return false;
  if(!medicineProductionUnlocked(world)&&(content.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-medicine'))||world.pawns.some(p=>p.cooking?.recipe==='make-medicine'||(p.orders?.queue??[]).some(o=>typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking.recipe==='make-medicine'))))return false;
  return true;
}
export function validateResearch(world:World,version:number):string[]{
  if(!validVictoryResearchDomain298(world.research,version,world.tick))return ['Invalid or future computer, sensors or long-range research.'];
  if(!validForestryResearch291(world.research,version,world.tick))return ['Invalid or future tree sowing research.'];
  if(!validFirefoamResearchTransport290(world,version))return ['Invalid or future firefoam research.'];
  const errors:string[]=[],state=world.research;
  if(state!==undefined){
    const progress=(p:unknown,cost:number,active:boolean,root=false)=>record(p)&&Object.keys(p).every(k=>['points','completedAt',...(root?['project',...(isSchema298OrLater(version)?['shipComputer','shipSensors','longRangeMineralScanner']:[]),...(version>=75?['airConditioning']:[]),...(version>=85?['batteries','solarPower']:[]),...(version>=89?['stonecutting','smithing']:[]),...(version>=90?['complexFurniture']:[]),...(version>=101?['machining','gunsmithing']:[]),...(version>=109?['plateArmor','flakArmor']:[]),...(version>=123?['microelectronics','multiAnalyzer','fabrication']:[]),...(version>=139?['advancedFabrication']:[]),...(version>=143?['autodoors']:[]),...(version>=148?['reconArmor']:[]),...(version>=187?['hospitalBed']:[]),...(version>=188?['packagedSurvivalMeals']:[]),...(version>=190?['tubeTelevision']:[]),...(version>=193?['gunTurrets']:[]),...(version>=203?['hydroponics']:[]),...(version>=206?['drugProduction','medicineProduction']:[]),...(version>=211?['sterileMaterials','vitalsMonitor']:[]),...(version>=215?['deepDrilling','groundScanner']:[]),...(version>=217?['nutrientPaste']:[]),...(version>=218?['biofuelRefining']:[]),...(version>=248?['pemmican']:[]),...(version>=264?['geothermalPower']:[]),...(version>=265?['brewing']:[]),...(isSchema270OrLater(version)?['longBlades']:[]),...(isSchema271OrLater(version)?['cryptosleep']:[]),...(isSchema273OrLater(version)?['prosthetics']:[]),...(isSchema275OrLater(version)?['shipBasics','shipReactor']:[]),...(isSchema276OrLater(version)?['shipEngine']:[]),...(isSchema277OrLater(version)?['shipCryptosleep']:[]),...((version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))))?['treeSowing291']:[]),...((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))?['firefoam']:[])]:[])].includes(k))&&int(p.points,0,cost)
      &&(p.completedAt===undefined?p.points<cost:int(p.completedAt,0,world.tick)&&p.points===cost&&!active);
    if(version<73||!record(state)||state.project!==null&&!isVictoryResearchProject298(state.project)&&state.project!=='complex-clothing'&&(version<75||state.project!=='air-conditioning')&&(version<85||state.project!=='batteries'&&state.project!=='solar-power')&&(version<89||state.project!=='stonecutting'&&state.project!=='smithing')&&(version<90||state.project!=='complex-furniture')&&(version<101||state.project!=='machining'&&state.project!=='gunsmithing')&&(version<109||state.project!=='plate-armor'&&state.project!=='flak-armor')&&(version<123||state.project!=='microelectronics'&&state.project!=='multi-analyzer'&&state.project!=='fabrication')&&(version<139||state.project!=='advanced-fabrication')&&(version<143||state.project!=='autodoors')&&(version<148||state.project!=='recon-armor')&&(version<187||state.project!=='hospital-bed')&&(version<188||state.project!=='packaged-survival-meals')&&(version<190||state.project!=='tube-television')&&(version<193||state.project!=='gun-turrets')&&(version<203||state.project!=='hydroponics')&&(version<206||state.project!=='drug-production'&&state.project!=='medicine-production')&&(version<211||state.project!=='sterile-materials'&&state.project!=='vitals-monitor')&&(version<215||state.project!=='deep-drilling'&&state.project!=='ground-scanner')&&(version<217||state.project!=='nutrient-paste')&&(version<218||state.project!=='biofuel-refining')&&(version<248||state.project!=='pemmican')&&(version<264||state.project!=='geothermal-power')&&(version<265||state.project!=='brewing')&&(!isSchema270OrLater(version)||state.project!=='long-blades')&&(!isSchema271OrLater(version)||state.project!=='cryptosleep')&&(!isSchema273OrLater(version)||state.project!=='prosthetics')&&(!isSchema275OrLater(version)||state.project!=='ship-basics'&&state.project!=='ship-reactor')&&(!isSchema276OrLater(version)||state.project!=='ship-engine')&&(!isSchema277OrLater(version)||state.project!=='ship-cryptosleep')&&((version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))))))||state.project!=='tree-sowing')&&((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||state.project!=='firefoam')
      ||!progress(state,CLOTHING_RESEARCH_COST,state.project==='complex-clothing'||version<75&&state.project!==null,true)
      ||state.airConditioning!==undefined&&(version<75||!progress(state.airConditioning,AIR_CONDITIONING_COST,state.project==='air-conditioning'))
      ||state.project==='air-conditioning'&&!state.airConditioning
      ||state.batteries!==undefined&&(version<85||!progress(state.batteries,BATTERIES_RESEARCH_COST,state.project==='batteries'))
      ||state.solarPower!==undefined&&(version<85||!progress(state.solarPower,SOLAR_POWER_RESEARCH_COST,state.project==='solar-power'))
      ||state.stonecutting!==undefined&&(version<89||!progress(state.stonecutting,STONECUTTING_RESEARCH_COST,state.project==='stonecutting'))
      ||state.smithing!==undefined&&(version<89||!progress(state.smithing,SMITHING_RESEARCH_COST,state.project==='smithing'))
      ||state.complexFurniture!==undefined&&(version<90||!progress(state.complexFurniture,COMPLEX_FURNITURE_RESEARCH_COST,state.project==='complex-furniture'))
      ||state.machining!==undefined&&(version<101||!progress(state.machining,MACHINING_RESEARCH_COST,state.project==='machining')||!!researchPrerequisite(world,'machining'))
      ||state.gunsmithing!==undefined&&(version<101||!progress(state.gunsmithing,GUNSMITHING_RESEARCH_COST,state.project==='gunsmithing')||!!researchPrerequisite(world,'gunsmithing'))
      ||state.plateArmor!==undefined&&(version<109||!progress(state.plateArmor,PLATE_ARMOR_RESEARCH_COST,state.project==='plate-armor')||!!researchPrerequisite(world,'plate-armor'))
      ||state.flakArmor!==undefined&&(version<109||!progress(state.flakArmor,FLAK_ARMOR_RESEARCH_COST,state.project==='flak-armor')||!!researchPrerequisite(world,'flak-armor'))
      ||state.microelectronics!==undefined&&(version<123||!progress(state.microelectronics,MICROELECTRONICS_RESEARCH_COST,state.project==='microelectronics'))
      ||state.multiAnalyzer!==undefined&&(version<123||!progress(state.multiAnalyzer,MULTI_ANALYZER_RESEARCH_COST,state.project==='multi-analyzer')||!!researchPrerequisite(world,'multi-analyzer'))
      ||state.fabrication!==undefined&&(version<123||!progress(state.fabrication,FABRICATION_RESEARCH_COST,state.project==='fabrication')||!!researchPrerequisite(world,'fabrication'))
      ||state.advancedFabrication!==undefined&&(version<139||!progress(state.advancedFabrication,ADVANCED_FABRICATION_RESEARCH_COST,state.project==='advanced-fabrication')||!!researchPrerequisite(world,'advanced-fabrication'))
      ||state.reconArmor!==undefined&&(version<148||!progress(state.reconArmor,RECON_ARMOR_RESEARCH_COST,state.project==='recon-armor')||!!researchPrerequisite(world,'recon-armor'))
      ||state.hospitalBed!==undefined&&(version<187||!progress(state.hospitalBed,HOSPITAL_BED_RESEARCH_COST,state.project==='hospital-bed')||!!researchPrerequisite(world,'hospital-bed'))
      ||state.project==='hospital-bed'&&!state.hospitalBed
      ||state.packagedSurvivalMeals!==undefined&&(version<188||!progress(state.packagedSurvivalMeals,PACKAGED_SURVIVAL_MEALS_RESEARCH_COST,state.project==='packaged-survival-meals'))
      ||state.project==='packaged-survival-meals'&&!state.packagedSurvivalMeals
      ||state.sterileMaterials!==undefined&&(version<211||!progress(state.sterileMaterials,STERILE_MATERIALS_RESEARCH_COST,state.project==='sterile-materials'))
      ||state.project==='sterile-materials'&&!state.sterileMaterials
      ||Object.hasOwn(state,'firefoam')&&((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||!progress(state.firefoam,600_000_000,state.project==='firefoam'))
      ||state.project==='firefoam'&&!state.firefoam
      ||state.brewing!==undefined&&(version<265||!progress(state.brewing,BREWING_RESEARCH_COST,state.project==='brewing'))
      ||state.project==='brewing'&&!state.brewing
      ||state.prosthetics!==undefined&&(!isSchema273OrLater(version)||!progress(state.prosthetics,PROSTHETICS_RESEARCH_COST273,state.project==='prosthetics')||!!researchPrerequisite(world,'prosthetics'))
      ||state.project==='prosthetics'&&!state.prosthetics
      ||state.longBlades!==undefined&&(!isSchema270OrLater(version)||!progress(state.longBlades,LONG_BLADES_RESEARCH_COST,state.project==='long-blades')||!!researchPrerequisite(world,'long-blades'))
      ||state.project==='long-blades'&&!state.longBlades
      ||state.cryptosleep!==undefined&&(!isSchema271OrLater(version)||!progress(state.cryptosleep,CRYPTOSLEEP_RESEARCH_COST271,state.project==='cryptosleep')||!!researchPrerequisite(world,'cryptosleep'))
      ||state.project==='cryptosleep'&&!state.cryptosleep
      ||state.pemmican!==undefined&&(version<248||!progress(state.pemmican,PEMMICAN_RESEARCH_COST,state.project==='pemmican'))
      ||state.project==='pemmican'&&!state.pemmican
      ||state.biofuelRefining!==undefined&&(version<218||!progress(state.biofuelRefining,BIOFUEL_REFINING_RESEARCH_COST,state.project==='biofuel-refining'))
      ||state.project==='biofuel-refining'&&!state.biofuelRefining
      ||state.nutrientPaste!==undefined&&(version<217||!progress(state.nutrientPaste,NUTRIENT_PASTE_RESEARCH_COST,state.project==='nutrient-paste'))
      ||state.project==='nutrient-paste'&&!state.nutrientPaste
      ||state.deepDrilling!==undefined&&(version<215||!progress(state.deepDrilling,DEEP_DRILLING_RESEARCH_COST,state.project==='deep-drilling')||!!researchPrerequisite(world,'deep-drilling'))
      ||state.project==='deep-drilling'&&!state.deepDrilling
      ||state.groundScanner!==undefined&&(version<215||!progress(state.groundScanner,GROUND_SCANNER_RESEARCH_COST,state.project==='ground-scanner')||!!researchPrerequisite(world,'ground-scanner'))
      ||state.project==='ground-scanner'&&!state.groundScanner
      ||state.vitalsMonitor!==undefined&&(version<211||!progress(state.vitalsMonitor,VITALS_MONITOR_RESEARCH_COST,state.project==='vitals-monitor')||!!researchPrerequisite(world,'vitals-monitor'))
      ||state.project==='vitals-monitor'&&!state.vitalsMonitor
      ||state.drugProduction!==undefined&&(version<206||!progress(state.drugProduction,DRUG_PRODUCTION_RESEARCH_COST,state.project==='drug-production'))
      ||state.project==='drug-production'&&!state.drugProduction
      ||state.medicineProduction!==undefined&&(version<206||!progress(state.medicineProduction,MEDICINE_PRODUCTION_RESEARCH_COST,state.project==='medicine-production')||!!researchPrerequisite(world,'medicine-production'))
      ||state.project==='medicine-production'&&!state.medicineProduction
      ||state.hydroponics!==undefined&&(version<203||!progress(state.hydroponics,HYDROPONICS_RESEARCH_COST,state.project==='hydroponics'))
      ||state.project==='hydroponics'&&!state.hydroponics
      ||state.gunTurrets!==undefined&&(version<193||!progress(state.gunTurrets,GUN_TURRETS_RESEARCH_COST,state.project==='gun-turrets')||!!researchPrerequisite(world,'gun-turrets'))
      ||state.project==='gun-turrets'&&!state.gunTurrets
      ||state.tubeTelevision!==undefined&&(version<190||!progress(state.tubeTelevision,TUBE_TELEVISION_RESEARCH_COST,state.project==='tube-television')||!!researchPrerequisite(world,'tube-television'))
      ||state.project==='tube-television'&&!state.tubeTelevision
      ||state.autodoors!==undefined&&(version<143||!progress(state.autodoors,AUTODOORS_RESEARCH_COST,state.project==='autodoors'))
      ||state.project==='machining'&&!state.machining||state.project==='gunsmithing'&&!state.gunsmithing
      ||state.project==='plate-armor'&&!state.plateArmor||state.project==='flak-armor'&&!state.flakArmor
      ||state.project==='microelectronics'&&!state.microelectronics||state.project==='multi-analyzer'&&!state.multiAnalyzer||state.project==='fabrication'&&!state.fabrication||state.project==='advanced-fabrication'&&!state.advancedFabrication||state.project==='recon-armor'&&!state.reconArmor||state.project==='autodoors'&&!state.autodoors
      ||state.project==='stonecutting'&&!state.stonecutting||state.project==='smithing'&&!state.smithing
      ||state.project==='complex-furniture'&&!state.complexFurniture
      ||state.project==='batteries'&&!state.batteries||state.project==='solar-power'&&!state.solarPower)errors.push('Invalid research project.');
  }
  if(!validShipResearchTransport275(world,version))errors.push('Invalid or future ship research or construction.');
  if(!validProstheticsResearchTransport273(world,version))errors.push('Invalid or future prosthetics research.');
  if(!validCryptosleepResearchTransport271(world,version))errors.push('Invalid or future cryptosleep research or construction.');
  if(!validLongBladesResearchTransport270(world,version))errors.push('Invalid or future long-blade research or production.');
  if(!validBrewingResearchTransport265(world,version))errors.push('Invalid or future brewing research.');
  if(!validSmithyResearchTransport267(world,version))errors.push('Invalid or future smithy construction.');
  if(!validGeothermalResearchTransport(world,version))errors.push('Invalid or future geothermal research or content.');
  if(!validPemmicanResearchTransport(world,version))errors.push('Invalid or future pemmican research or production.');
  if(!validHospitalSupportTransport(world,version))errors.push('Invalid or future hospital support research or content.');
  if(!validDeepResearchTransport(world,version))errors.push('Invalid or future deep drilling research or content.');
  if(!airConditioningUnlocked(world)&&[...world.structures,...world.jobs].some(s=>s.kind==='cooler'))errors.push('Locked cooler.');
  const electricalContent=[...world.structures,...world.jobs,...(world.packed??[]).map(p=>p.building)];
  if(!biofuelRefiningUnlocked(world)&&electricalContent.some(s=>s.kind==='biofuel-refinery'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='biofuel-refinery'))errors.push('Locked biofuel refinery.');
  if(!drugProductionUnlocked(world)&&electricalContent.some(s=>s.kind==='drug-lab'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='drug-lab'))errors.push('Locked drug lab.');
  if(!medicineProductionUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-medicine'))||world.pawns.some(p=>p.cooking?.recipe==='make-medicine'||(p.orders?.queue??[]).some(o=>typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking.recipe==='make-medicine'))))errors.push('Locked medicine production.');
  if(!hydroponicsUnlocked(world)&&electricalContent.some(s=>s.kind==='hydroponics-basin'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='hydroponics-basin'))errors.push('Locked hydroponics basin.');
  if(!batteriesUnlocked(world)&&electricalContent.some(s=>s.kind==='battery'))errors.push('Locked battery.');
  if(!solarPowerUnlocked(world)&&electricalContent.some(s=>s.kind==='solar-generator'))errors.push('Locked solar generator.');
  if(version>=90&&!complexFurnitureUnlocked(world)&&electricalContent.some(s=>['dining-chair','armchair','end-table','dresser',...(version>=244?['vent']:[]),...(version>=122?['chess-table']:[])].includes(s.kind)))errors.push('Locked complex furniture.');
  if(!machiningUnlocked(world)&&electricalContent.some(s=>s.kind==='machining-table'))errors.push('Locked machining table.');
  if(version>=123&&!microelectronicsUnlocked(world)&&electricalContent.some(s=>s.kind==='hi-tech-research-bench'))errors.push('Locked hi-tech research bench.');
  if(version>=123&&!multiAnalyzerUnlocked(world)&&electricalContent.some(s=>s.kind==='multi-analyzer'))errors.push('Locked multi-analyzer.');
  if(version>=123&&!fabricationUnlocked(world)&&electricalContent.some(s=>s.kind==='fabrication-bench'))errors.push('Locked fabrication bench.');
  if(version>=143&&!autodoorsUnlocked(world)&&electricalContent.some(s=>s.kind==='autodoor'))errors.push('Locked autodoor.');
  if(version>=193&&!gunTurretsUnlocked(world)&&electricalContent.some(s=>s.kind==='mini-turret'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='mini-turret'))errors.push('Locked gun turrets.');
  if(version>=190&&!tubeTelevisionUnlocked(world)&&electricalContent.some(s=>s.kind==='tube-television'||'furniture' in s&&(s.furniture as {kind?:string}|undefined)?.kind==='tube-television'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='tube-television'))errors.push('Locked television.');
  if(version>=187&&!hospitalBedUnlocked(world)&&electricalContent.some(s=>s.kind==='hospital-bed'||'furniture' in s&&(s.furniture as {kind?:string}|undefined)?.kind==='hospital-bed'||'deconstruction' in s&&(s.deconstruction as {kind?:string}|undefined)?.kind==='hospital-bed'))errors.push('Locked hospital bed.');
  if(version>=188&&!packagedSurvivalMealsUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='cook-survival-meal'))||world.pawns.some(p=>p.cooking?.recipe==='cook-survival-meal'||(p.orders?.queue??[]).some(o=>typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking.recipe==='cook-survival-meal'))))errors.push('Locked packaged survival production.');
  if(version>=245&&!clothingUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='tuque'))
    ||world.piles.some(p=>p.unfinished?.recipe==='tuque')||world.pawns.some(p=>p.cooking?.recipe==='tuque'||(p.orders?.queue??[]).some(o=>typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking.recipe==='tuque'))))errors.push('Locked tuque production.');
  // Obtained weapons need no research; only the local fabrication chain does.
  if(version>=101&&!gunsmithingUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>isGunRecipe(b.recipe)&&b.recipe!=='make-emp-launcher'))
    ||world.piles.some(p=>p.gunWork&&p.gunWork.recipe!=='make-emp-launcher')||world.pawns.some(p=>p.cooking&&isGunRecipe(p.cooking.recipe)&&p.cooking.recipe!=='make-emp-launcher')))errors.push('Locked gunsmithing production.');
  if((version<208||!microelectronicsUnlocked(world))&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-emp-launcher'))
    ||world.piles.some(p=>p.gunWork?.recipe==='make-emp-launcher')||world.pawns.some(p=>p.cooking?.recipe==='make-emp-launcher'||(p.orders?.queue??[]).some(o=>typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking.recipe==='make-emp-launcher'))))errors.push('Locked or future EMP production.');
  if(version>=109&&!flakArmorUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-flak-vest'||b.recipe==='make-flak-helmet'))
    ||world.piles.some(p=>p.flakWork?.recipe==='make-flak-vest'||p.flakWork?.recipe==='make-flak-helmet')||world.pawns.some(p=>p.cooking&&(p.cooking.recipe==='make-flak-vest'||p.cooking.recipe==='make-flak-helmet'))))errors.push('Locked flak armor production.');
  if(version>=148&&!reconArmorUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-recon-helmet'||b.recipe==='make-recon-armor'))
    ||world.piles.some(p=>p.flakWork?.recipe==='make-recon-helmet'||p.flakWork?.recipe==='make-recon-armor')||world.pawns.some(p=>p.cooking?.recipe==='make-recon-helmet'||p.cooking?.recipe==='make-recon-armor'||(p.orders?.queue??[]).some(o=>typeof o!=='number'&&typeof o==='object'&&o!==null&&'cooking' in o&&(o.cooking.recipe==='make-recon-helmet'||o.cooking.recipe==='make-recon-armor')))))errors.push('Locked recon helmet production.');
  if(version<141&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-flak-helmet'))
    ||world.piles.some(p=>p.item==='unfinished-flak-helmet'||p.flakWork?.recipe==='make-flak-helmet')
    ||world.pawns.some(p=>p.cooking?.recipe==='make-flak-helmet'||p.orders?.queue?.some(o=>typeof o!=='number'&&typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking.recipe==='make-flak-helmet'))))errors.push('Future flak helmet production.');
  if(version>=123&&!fabricationUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-component'))
    ||world.piles.some(p=>p.componentWork)||world.pawns.some(p=>p.cooking?.recipe==='make-component'||(p.orders?.queue??[]).some(order=>typeof order!=='number'&&'cooking' in order&&order.cooking.recipe==='make-component'))))errors.push('Locked component production.');
  if(version>=139&&!advancedFabricationUnlocked(world)&&(electricalContent.some(s=>'bills' in s&&s.bills?.some(b=>b.recipe==='make-advanced-component'))
    ||world.piles.some(p=>p.componentWork?.recipe==='make-advanced-component')||world.pawns.some(p=>p.cooking?.recipe==='make-advanced-component'||(p.orders?.queue??[]).some(order=>typeof order!=='number'&&'cooking' in order&&order.cooking.recipe==='make-advanced-component'))))errors.push('Locked advanced component production.');
  const stations=new Set<number>();
  for(const pawn of world.pawns){
    if(version<73?pawn.priorities.research!==undefined:!int(pawn.priorities.research,0,4))errors.push('Invalid or future research priority.');
    const task=pawn.research;if(task===undefined)continue;
    if(version<73||!record(task)||Object.keys(task).some(k=>!['stationId','spot','worked',...(version>=123?['facilityId']:[])].includes(k))||!int(task.stationId,1)||!record(task.spot)||!int(task.spot.x,0,world.width-1)||!int(task.spot.z,0,world.height-1)||!int(task.worked,0,399)||task.facilityId!==undefined&&!int(task.facilityId,1)){errors.push('Invalid research task.');continue;}
    const station=world.structures.find(s=>s.id===task.stationId&&(s.kind==='research-bench'||version>=123&&s.kind==='hi-tech-research-bench')),spot=station&&cookingSpot(station);
    const project=state?.project,facility=task.facilityId===undefined?undefined:world.structures.find(s=>s.id===task.facilityId&&s.kind==='multi-analyzer');
    // A saved link may have just lost its range, visibility or power. Preserve
    // that interrupted checkpoint; runtime eligibility is checked at work.
    const facilityNear=!!station&&!!facility;
    if(!station||!spot||spot.x!==task.spot.x||spot.z!==task.spot.z||!canStandAt(world,task.spot)||stations.has(task.stationId)||!state?.project||pawn.priorities.research===0
      ||project!==undefined&&project!==null&&needsHighTechBench(project)&&station.kind!=='hi-tech-research-bench'||project!==undefined&&project!==null&&needsResearchAnalyzer(project)&&!facilityNear||task.facilityId!==undefined&&(station.kind!=='hi-tech-research-bench'||!facilityNear)
      ||pawn.heatRefuge||pawn.jobId!==null||pawn.haul||pawn.cooking||pawn.need||pawn.recreation.task||pawn.tend||pawn.ward||pawn.feed||pawn.rescue||pawn.equipmentTask||pawn.draft||pawn.shooting||pawn.flee||pawn.tactics||pawn.melee||pawn.raid||pawn.mental?.crisis||!['moving','working'].includes(pawn.state)||pawn.orders.active!==null)errors.push('Invalid research ownership.');
    if(pawn.state==='working'&&(pawn.x!==task.spot.x||pawn.z!==task.spot.z||pawn.path.length))errors.push('Research working away from its station.');
    stations.add(task.stationId);
  }
  if(version>=73&&!clothingUnlocked(world)&&[...world.structures,...world.jobs,...world.packed.map(p=>p.building)].some(s=>s.kind==='tailor-bench'))errors.push('Locked tailoring bench.');
  if(version>=90&&!clothingUnlocked(world)&&[...world.structures,...world.jobs,...world.packed.map(p=>p.building)].some(s=>s.kind==='electric-tailor-bench'))errors.push('Locked electric tailoring bench.');
  return errors;
}

/** Sparse catalogue/research guard reused by reconstructed snapshots. */
export function validPemmicanResearchTransport(world:World,version:number):boolean {
  try{
    const state=world.research,project=state?.project;
    if(state&&Object.hasOwn(state,'pemmican')){
      const p=state.pemmican;
      if(version<PEMMICAN_SCHEMA_VERSION||!record(p)||Object.keys(p).some(k=>k!=='points'&&k!=='completedAt')
        ||!int(p.points,0,PEMMICAN_RESEARCH_COST)
        ||(p.completedAt===undefined?p.points>=PEMMICAN_RESEARCH_COST:!int(p.completedAt,0,world.tick)||p.points!==PEMMICAN_RESEARCH_COST||project==='pemmican'))return false;
    }
    if(project==='pemmican'&&(version<PEMMICAN_SCHEMA_VERSION||!state?.pemmican))return false;
    const content=world.structures.some(s=>s.bills?.some(b=>isPemmicanRecipe(b.recipe)))
      ||(world.packed??[]).some(p=>p.building.bills?.some(b=>isPemmicanRecipe(b.recipe)))
      ||world.pawns.some(p=>isPemmicanRecipe(p.cooking?.recipe)||(p.orders?.queue??[]).some(o=>typeof o==='object'&&o!==null&&'cooking' in o&&isPemmicanRecipe(o.cooking.recipe)));
    return !content||version>=PEMMICAN_SCHEMA_VERSION&&pemmicanUnlocked(world);
  }catch{return false;}
}
/** Sparse V264 envelope/content guard for saves and reconstructed snapshots.
 * Root campaign research applies to every actual local or terminal owner;
 * terrain, people and historical research are deliberately not revalidated. */
export function validGeothermalResearchTransport(world:World,version:number):boolean {
  try{
    const state=world.research,project=state?.project;
    if(state&&Object.hasOwn(state,'geothermalPower')){
      const p=state.geothermalPower;
      if(version<264||!record(p)||Object.getPrototypeOf(p)!==Object.prototype
        ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
        ||!Object.hasOwn(p,'points')||!int(p.points,0,GEOTHERMAL_POWER_RESEARCH_COST)
        ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==GEOTHERMAL_POWER_RESEARCH_COST||project==='geothermal-power':p.points>=GEOTHERMAL_POWER_RESEARCH_COST))return false;
    }
    if(project==='geothermal-power'&&(version<264||!state?.geothermalPower))return false;
    // A completed, validated record unlocks all local maps through the single
    // campaign authority. No progress record is created for an old campaign.
    if(version>=264&&geothermalPowerUnlocked(world))return true;
    const marked=(v:unknown):boolean=>record(v)&&(v.kind==='geothermal-generator'||Object.hasOwn(v,'geothermal'));
    const content=(v:unknown):boolean=>marked(v)||record(v)&&[v.furniture,v.deconstruction,v.repair,v.fixBreakdown].some(marked);
    const packed=(records:readonly {building:unknown}[]|undefined):boolean=>(records??[]).some(p=>content(p.building));
    const local=(map:Pick<World,'structures'|'jobs'|'packed'|'visitors'|'podRescues'|'group'|'groupLosses'>):boolean=>
      (map.structures??[]).some(content)||(map.jobs??[]).some(content)||packed(map.packed)
      ||!!(map.group&&'packed' in map.group&&packed(map.group.packed))
      ||(map.groupLosses??[]).some(l=>packed(l.packed))
      ||[map.visitors?.departed??[],map.podRescues?.departed??[]].some(records=>records.some(d=>packed(d.packed)));
    if(local(world)||world.secondarySite&&local(world.secondarySite.map)
      ||world.worldMaps?.sites.some(site=>site.map&&local(site.map)))return false;
    const groups=world.worldGroups;
    if(groups&&(groups.groups.some(g=>'packed' in g.state&&packed(g.state.packed))
      ||groups.losses.some(l=>packed(l.packed))||(groups.animalLosses??[]).some(l=>packed(l.packed))
      ||groups.abandonedPawns.some(p=>packed(p.packed))
      ||groups.abandonedContents.some(c=>c.humans.some(p=>packed(p.packed))||c.animals.some(a=>packed(a.packed)))))return false;
    // Reconstructed MAIN views retain these real freight owners in their
    // campaign projection instead of transporting the inactive map registry.
    const projection=world.campaignMap;
    if(projection?.revision===2&&(projection.groups.some(g=>'packed' in g.state&&packed(g.state.packed))
      ||projection.groupLosses.some(l=>packed(l.packed))||(projection.animalLosses??[]).some(l=>packed(l.packed))))return false;
    return true;
  }catch{return false;}
}

/** Sparse prospective research/content guard shared with public snapshots. */
export function validLongBladesResearchTransport270(world:World,version:number):boolean {
 try{
  const state=world.research,p=state?.longBlades;
  if(state&&Object.hasOwn(state,'longBlades')){
   if(!isSchema270OrLater(version)||!record(p)||Object.getPrototypeOf(p)!==Object.prototype||!Object.hasOwn(p,'points')
    ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
    ||!int(p.points,0,LONG_BLADES_RESEARCH_COST)||!smithingUnlocked(world)
    ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==LONG_BLADES_RESEARCH_COST||state.project==='long-blades':p.points>=LONG_BLADES_RESEARCH_COST))return false;
  }
  if(state?.project==='long-blades'&&(!isSchema270OrLater(version)||!p))return false;
  const usesRecipe=(accept:(recipe:unknown)=>boolean)=>{
   const bill=(value:{bills?:readonly {recipe:string}[]})=>value.bills?.some(b=>accept(b.recipe));
   return world.structures.some(bill)||(world.packed??[]).some(q=>bill(q.building))
    ||world.piles.some(q=>accept(q.smithingWork?.recipe))
    ||world.pawns.some(q=>accept(q.cooking?.recipe)||q.orders.queue.some(o=>typeof o==='object'&&o!==null&&'cooking'in o&&accept(o.cooking.recipe)));
  };
  if(!isSchema272OrLater(version)&&usesRecipe(recipe=>recipe==='make-spear'))return false;
  if(isSchema270OrLater(version)&&longBladesUnlocked270(world))return true;
  return !usesRecipe(recipe=>recipe==='make-longsword'||recipe==='make-spear');
 }catch{return false;}
}

/** Prospective ordinary player casket only. Ancients retain their own authority. */
export function validCryptosleepResearchTransport271(world:World,version:number):boolean {
 try{
  const state=world.research,p=state?.cryptosleep;
  if(state&&Object.hasOwn(state,'cryptosleep')){
   if(!isSchema271OrLater(version)||!record(p)||Object.getPrototypeOf(p)!==Object.prototype||!Object.hasOwn(p,'points')
    ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
    ||!int(p.points,0,CRYPTOSLEEP_RESEARCH_COST271)||!multiAnalyzerUnlocked(world)
    ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==CRYPTOSLEEP_RESEARCH_COST271||state.project==='cryptosleep':p.points>=CRYPTOSLEEP_RESEARCH_COST271))return false;
  }
  if(state?.project==='cryptosleep'&&(!isSchema271OrLater(version)||!p))return false;
  const marked=(v:unknown):boolean=>record(v)&&(v.kind==='cryptosleep-casket'||Object.hasOwn(v,'cryptosleep')||record(v.deconstruction)&&v.deconstruction.kind==='cryptosleep-casket'||record(v.furniture)&&v.furniture.kind==='cryptosleep-casket');
  if((world.packed??[]).some(q=>marked(q.building)))return false;
  // An installed original can be recovered before knowing how to build one.
  // Research gates paid new construction, never opening or using that object.
  if(world.jobs.some(j=>j.kind==='cryptosleep-casket')&&!(isSchema271OrLater(version)&&cryptosleepUnlocked271(world)))return false;
  return true;
 }catch{return false;}
}

/** New research is optional and data-only. Recovered installed/packed devices
 * remain usable without research; only new construction needs completion. */
export function validFirefoamResearchTransport290(world:World,version:number):boolean {
 try{
  const state=world.research;
  if(state&&'firefoam' in state){
   const descriptor=Object.getOwnPropertyDescriptor(state,'firefoam');
   if((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)return false;
   const p=descriptor.value;
   if(!p||typeof p!=='object'||Object.getPrototypeOf(p)!==Object.prototype
    ||!Reflect.ownKeys(p).every(k=>typeof k==='string'&&(k==='points'||k==='completedAt')&&Object.getOwnPropertyDescriptor(p,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(p,k)!,'value'))
    ||!Object.hasOwn(p,'points')||!int(p.points,0,600_000_000)
    ||(Object.hasOwn(p,'completedAt')?!int(p.completedAt,0,world.tick)||p.points!==600_000_000||state.project==='firefoam':p.points>=600_000_000))return false;
  }
  if(state?.project==='firefoam'&&((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||!Object.hasOwn(state,'firefoam')))return false;
  return !world.jobs.some(j=>j.kind==='firefoam-popper')||(version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))&&firefoamResearchUnlocked290(world);
 }catch{return false;}
}
