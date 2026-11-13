import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {FIREFOAM_CONTENT_290} from './firefoam-content-290.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isShipCasketKind277,SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
import {isShipAddedKind276,SHIP_ADDED_CONTENT_276,SHIP_BEAM_CONTENT_276,SHIP_ENGINE_CONTENT_276} from './ship-part-content-276.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {isShipComputerSensorsKind298,SHIP_COMPUTER_SENSORS_CONTENT_298} from './ship-computer-sensors-content-298.ts';
import {SHIP_REACTOR_CONSTRUCTION_275} from './ship-reactor-content-275.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {CRYPTOSLEEP_CONSTRUCTION_271,CRYPTOSLEEP_PHYSICS_271} from './cryptosleep-content-271.ts';
import {isCaveHiveKind256} from './cave-hive-state-256.ts';
import {shipChunkRecipe256} from './ship-chunk-256.ts';
import {isAncientMonumentKind256,ancientMonumentMaterial256,ancientMonumentRecipe256} from './ancient-monument-props-256.ts';
import {isLocalRoadProp256,localRoadPropRecipe256} from './local-road-props-256.ts';
import type {LocalRoadProp256} from './local-road-data-256.ts';
import {BEDROLL_MATERIALS_256} from './bedroll-textiles-256.ts';
import { JOB_DURATION, JOB_WOOD_COST, STRUCTURE_DEFINITIONS } from './definitions.ts';
import { reservedDestination } from './materials.ts';
import type { ItemId } from './items.ts';
import type { Job, JobKind, StructureKind, World } from './types.ts';
import { flooringRecipe,type FloorKind } from './flooring.ts';
import { FURNITURE_DEFINITIONS,furnitureWorkToBuildCore,isHabitatFurnitureKind,isSculptureMaterial,materialAllowed } from './furniture-stats.ts';
import { ART_MATERIALS } from './art-rules.ts';
import { powerConstructionSkill } from './power-construction.ts';
import { SCHEMA_VERSION } from './types.ts';

import { BUILDING_MATERIALS, CONSTRUCTION_MATERIALS, isBlockMaterial,isUpholsteryMaterial, type ConstructionMaterial } from './building-materials.ts';
export type { ConstructionMaterial } from './building-materials.ts';
export interface ConstructionCost { item: ItemId; quantity:number }
export interface ConstructionRecipe { ingredients:readonly ConstructionCost[]; work:number; coreWork:number }
/** Replacement component is a physical delivery to a maintenance intention. */
const BREAKDOWN_RECIPE:ConstructionRecipe=Object.freeze({ingredients:Object.freeze([Object.freeze({item:'component' as const,quantity:1})]),work:100,coreWork:1000});
type ConstructionObject={kind:JobKind|LocalRoadProp256|'ship-chunk'|'ancient-cryptosleep-casket'|import('./cave-hive-state-256.ts').CaveHiveKind256;material?:ConstructionMaterial;floor?:FloorKind};
// Core base work before the stuff factor, in Core ticks. Absence of material
// deliberately keeps the V1–V29 historical recipe on existing objects.
const costs:Record<Exclude<StructureKind,LocalRoadProp256|'ship-chunk'|'ancient-cryptosleep-casket'|import('./cave-hive-state-256.ts').CaveHiveKind256>,number>={'ship-computer':150,'ship-sensors':140,'firefoam-popper':75,'ship-cryptosleep-casket':SHIP_CASKET_CONTENT_277.ingredients[0]!.quantity,'ship-beam':SHIP_BEAM_CONTENT_276.ingredients[0]!.quantity,'ship-engine':SHIP_ENGINE_CONTENT_276.ingredients[0]!.quantity,'ship-reactor':350,'cryptosleep-casket':180,'fueled-smithy':100,'electric-smithy':100,brewery:120,'fermenting-barrel':30,column:20,urn:20,'stele-large':125,'stele-grand':250,sarcophagus:60,'torch-lamp':20,shelf:20,'small-shelf':10,'spike-trap':45,'electric-crematorium':150,'double-bed':85,'electric-smelter':170,'sleeping-spot':0,'animal-sleeping-spot':0,'biofuel-refinery':150,'chemfuel-generator':100,'geothermal-generator':340,'nutrient-paste-dispenser':125,hopper:15,'orbital-beacon':40,'comms-console':120,'deep-drill':100,'ground-scanner':150,'vitals-monitor':50,'drug-lab':50,'hydroponics-basin':100,'mini-turret':100,'tube-television':80,sandbags:5,fence:1,'fence-gate':25,'pen-marker':30,'art-bench':75,'small-sculpture':50,'large-sculpture':100,'machining-table':150,'fabrication-bench':200,'hi-tech-research-bench':250,'multi-analyzer':40,grave:0,heater:50,'wind-turbine':100,'power-conduit':1,'power-switch':15,battery:70,'solar-generator':100,'fueled-stove':80,'electric-stove':80,'butcher-table':95,'butcher-spot':0,cooler:90,vent:30,'research-bench':75,'tailor-bench':75,'electric-tailor-bench':75,'crafting-spot':0,'wood-generator':100,'standing-lamp':20,'sun-lamp':40,'passive-cooler':50,door:25,autodoor:25,stonecutter:75,wall:5,bedroll:40,bed:45,'hospital-bed':40,table:28,'table-square':50,'table-long':95,stool:25,'dining-chair':45,armchair:110,'end-table':30,dresser:50,'flower-pot':20,campfire:20,horseshoes:10,'chess-table':70};
const work:Record<Exclude<StructureKind,LocalRoadProp256|'ship-chunk'|'ancient-cryptosleep-casket'|import('./cave-hive-state-256.ts').CaveHiveKind256>,number>={'ship-computer':16000,'ship-sensors':30000,'firefoam-popper':1500,'ship-cryptosleep-casket':SHIP_CASKET_CONTENT_277.coreWork,'ship-beam':SHIP_BEAM_CONTENT_276.coreWork,'ship-engine':SHIP_ENGINE_CONTENT_276.coreWork,'ship-reactor':65000,'cryptosleep-casket':3200,'fueled-smithy':3000,'electric-smithy':3000,brewery:2000,'fermenting-barrel':600,column:750,urn:500,'stele-large':8000,'stele-grand':16000,sarcophagus:2400,'torch-lamp':100,shelf:500,'small-shelf':250,'spike-trap':3200,'electric-crematorium':4500,'double-bed':1500,'electric-smelter':3500,'sleeping-spot':0,'animal-sleeping-spot':0,'biofuel-refinery':2000,'chemfuel-generator':2500,'geothermal-generator':12000,'nutrient-paste-dispenser':2200,hopper:300,'orbital-beacon':800,'comms-console':2200,'deep-drill':10000,'ground-scanner':12000,'vitals-monitor':6000,'drug-lab':3500,'hydroponics-basin':2800,'mini-turret':1800,'tube-television':10000,sandbags:180,fence:70,'fence-gate':500,'pen-marker':600,'art-bench':2500,'small-sculpture':0,'large-sculpture':0,'machining-table':3000,'fabrication-bench':5000,'hi-tech-research-bench':5000,'multi-analyzer':10000,grave:800,heater:1000,'wind-turbine':3300,'power-conduit':35,'power-switch':200,battery:800,'solar-generator':2500,'fueled-stove':2000,'electric-stove':2000,'butcher-table':2000,'butcher-spot':0,cooler:1600,vent:400,'research-bench':2800,'tailor-bench':2000,'electric-tailor-bench':2500,'crafting-spot':0,'wood-generator':2500,'standing-lamp':300,'sun-lamp':330,'passive-cooler':200,door:850,autodoor:1100,stonecutter:2000,wall:135,bedroll:600,bed:800,'hospital-bed':2800,table:750,'table-square':1500,'table-long':3000,stool:450,'dining-chair':8000,armchair:14000,'end-table':1000,dresser:2000,'flower-pot':250,campfire:200,horseshoes:100,'chess-table':8000};
const recipes=new Map<string,ConstructionRecipe>();
/** Only actual construction-table keys participate in stuff recipes. Natural
 * Hive/GlowPod definitions retain their separate spawn/recovery path. */
function hasConstructionRecipeStats(kind:JobKind):kind is keyof typeof costs {return Object.hasOwn(costs,kind)&&Object.hasOwn(work,kind);}
// Physical ingredient provenance for salvage and damage. A sculpture has no
// construction job: designation and save validation reject those jobs.
for(const kind of ['small-sculpture','large-sculpture'] as const)
  for(const material of ART_MATERIALS){
    const stats=BUILDING_MATERIALS[material],coreWork=Math.round(stats.workFactor+stats.workOffset);
    recipes.set(`${kind}:${material}`,Object.freeze({
      ingredients:Object.freeze([Object.freeze({item:material,quantity:costs[kind]})]),
      work:Math.ceil(coreWork/10),coreWork,
    }));
  }
for(const kind of Object.keys(JOB_DURATION) as JobKind[]) {
  if(kind==='firefoam-popper'){recipes.set('firefoam-popper:steel',FIREFOAM_CONTENT_290);continue;}
  if(isAncientMonumentKind256(kind))continue;
  if(kind==='electric-crematorium'){for(const material of CONSTRUCTION_MATERIALS.filter(isBlockMaterial)){const stats=BUILDING_MATERIALS[material],coreWork=Math.round(4500*stats.workFactor+stats.workOffset);const ingredients:ConstructionCost[]=[{item:material,quantity:150},{item:'steel',quantity:20},{item:'component',quantity:2}];recipes.set(`${kind}:${material}`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:Math.ceil(coreWork/10),coreWork}));}continue;}
  if(kind==='bedroll'){for(const material of BEDROLL_MATERIALS_256){const coreWork=furnitureWorkToBuildCore('bedroll',material);recipes.set(`bedroll:${material}`,Object.freeze({ingredients:Object.freeze([Object.freeze({item:material,quantity:40})]),work:Math.ceil(coreWork/10),coreWork}));}continue;}
  if(kind==='torch-lamp'){recipes.set('torch-lamp:wood',Object.freeze({ingredients:Object.freeze([Object.freeze({item:'wood' as const,quantity:20})]),work:10,coreWork:100}));continue;}
  if(kind==='vent'){recipes.set('vent:steel',Object.freeze({ingredients:Object.freeze([Object.freeze({item:'steel' as const,quantity:30})]),work:40,coreWork:400}));continue;}
  if(kind==='brewery'||kind==='fermenting-barrel'){const ingredients:ConstructionCost[]=[{item:'wood',quantity:kind==='brewery'?120:30},{item:'steel',quantity:kind==='brewery'?30:10}];recipes.set(`${kind}:wood`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;}
  if(isShipCasketKind277(kind)){recipes.set(`${kind}:steel`,SHIP_CASKET_CONTENT_277);continue;}
  if(isShipAddedKind276(kind)){recipes.set(`${kind}:steel`,SHIP_ADDED_CONTENT_276[kind]);continue;}
  if(isShipComputerSensorsKind298(kind)){const facts=SHIP_COMPUTER_SENSORS_CONTENT_298[kind];recipes.set(`${kind}:steel`,Object.freeze({ingredients:facts.ingredients,work:facts.work,coreWork:facts.coreWork}));continue;}
  if(kind==='ship-reactor'){recipes.set('ship-reactor:steel',SHIP_REACTOR_CONSTRUCTION_275);continue;}
  if(kind==='cryptosleep-casket'){recipes.set('cryptosleep-casket:steel',CRYPTOSLEEP_CONSTRUCTION_271);continue;}
  if(kind==='fueled-smithy'||kind==='electric-smithy'){const ingredients:ConstructionCost[]=[{item:'steel',quantity:100},...(kind==='electric-smithy'?[{item:'component' as const,quantity:3}]:[])];recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:300,coreWork:3000}));continue;}
  if(kind==='geothermal-generator'){const ingredients:ConstructionCost[]=[{item:'steel',quantity:340},{item:'component',quantity:8}];recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:1200,coreWork:12000}));continue;}
  if(kind==='electric-smelter'){const ingredients:ConstructionCost[]=[{item:'steel',quantity:170},{item:'component',quantity:2}];recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:350,coreWork:3500}));continue;}
  if(kind==='biofuel-refinery'||kind==='chemfuel-generator'){const ingredients:ConstructionCost[]=[{item:'steel',quantity:costs[kind]},{item:'component',quantity:3}];recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;}
  if(kind==='nutrient-paste-dispenser'||kind==='hopper'){const ingredients:ConstructionCost[]=[{item:'steel',quantity:costs[kind]},...(kind==='nutrient-paste-dispenser'?[{item:'component' as const,quantity:3}]:[])];recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;}
  if(kind==='orbital-beacon'||kind==='comms-console'){
    const ingredients:ConstructionCost[]=[{item:'steel',quantity:costs[kind]},{item:'component',quantity:kind==='orbital-beacon'?1:4}];
    recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;
  }
  if(kind==='deep-drill'||kind==='ground-scanner'){
    const ingredients:ConstructionCost[]=kind==='deep-drill'?[{item:'steel',quantity:100},{item:'component',quantity:2}]
      :[{item:'steel',quantity:150},{item:'component',quantity:4},{item:'advanced-component',quantity:1}];
    recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;
  }
  if(kind==='vitals-monitor'){recipes.set('vitals-monitor:steel',Object.freeze({ingredients:Object.freeze([{item:'steel' as const,quantity:50},{item:'component' as const,quantity:3}].map(c=>Object.freeze(c))),work:600,coreWork:6000}));continue;}
  if(kind==='hydroponics-basin'){recipes.set('hydroponics-basin:steel',Object.freeze({ingredients:Object.freeze([{item:'steel' as const,quantity:100},{item:'component' as const,quantity:1}].map(c=>Object.freeze(c))),work:280,coreWork:2800}));continue;}
  if(kind==='mini-turret'){recipes.set('mini-turret:steel',Object.freeze({ingredients:Object.freeze([{item:'steel' as const,quantity:100},{item:'component' as const,quantity:3}].map(c=>Object.freeze(c))),work:180,coreWork:1800}));continue;}
  if(kind==='tube-television'){recipes.set('tube-television:steel',Object.freeze({ingredients:Object.freeze([{item:'steel' as const,quantity:80},{item:'component' as const,quantity:4}].map(c=>Object.freeze(c))),work:1000,coreWork:10000}));continue;}
  if(kind==='sandbags'){recipes.set('sandbags:cloth',Object.freeze({ingredients:Object.freeze([Object.freeze({item:'cloth' as const,quantity:5})]),work:18,coreWork:180}));continue;}
  if(kind==='hospital-bed'){recipes.set('hospital-bed:steel',Object.freeze({ingredients:Object.freeze([{item:'steel' as const,quantity:120},{item:'component' as const,quantity:5}].map(c=>Object.freeze(c))),work:280,coreWork:2800}));continue;}
  if(kind==='lay-floor'||kind==='remove-floor'||kind==='build-bridge'||kind==='remove-bridge')continue;
  // Sculptures are finished furniture delivered by an art bill, never plans.
  if(kind==='small-sculpture'||kind==='large-sculpture')continue;
  if(kind==='drug-lab'){
    for(const material of ['wood','steel'] as const){
      const stats=BUILDING_MATERIALS[material],coreWork=Math.round(work[kind]*stats.workFactor+stats.workOffset);
      const ingredients:ConstructionCost[]=material==='steel'?[{item:'steel',quantity:125},{item:'component',quantity:6}]
        :[{item:material,quantity:50},{item:'steel',quantity:75},{item:'component',quantity:6}];
      recipes.set(`${kind}:${material}`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:Math.ceil(coreWork/10),coreWork}));
    }
    continue;
  }
  if(kind==='art-bench'){
    for(const material of ['wood','steel'] as const){
      const amounts=new Map<ConstructionMaterial,number>([[material,75],['steel',50]]);
      if(material==='steel')amounts.set('steel',125);
      const stats=BUILDING_MATERIALS[material],coreWork=Math.round(work[kind]*stats.workFactor+stats.workOffset);
      const ingredients=Object.freeze([...amounts].map(([item,quantity])=>Object.freeze({item,quantity})));
      recipes.set(`${kind}:${material}`,Object.freeze({ingredients,work:Math.ceil(coreWork/10),coreWork}));
    }
    continue;
  }
  if(kind==='grave'){recipes.set('grave:legacy',Object.freeze({ingredients:[],work:80,coreWork:800}));continue;}
  if(kind==='hi-tech-research-bench'||kind==='multi-analyzer'||kind==='fabrication-bench'){
    const ingredients:ConstructionCost[]=kind==='hi-tech-research-bench'
      ?[{item:'steel',quantity:250},{item:'component',quantity:10}]
      :kind==='multi-analyzer'
        ?[{item:'steel',quantity:40},{item:'plasteel',quantity:50},{item:'gold',quantity:20},{item:'component',quantity:8}]
        :[{item:'steel',quantity:200},{item:'component',quantity:12},{item:'advanced-component',quantity:2}];
    recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;
  }
  if(kind==='machining-table'||kind==='heater'||kind==='wind-turbine'||kind==='power-conduit'||kind==='power-switch'||kind==='battery'||kind==='solar-generator'){
    const components=kind==='machining-table'?5:kind==='heater'?1:kind==='wind-turbine'?2:kind==='power-switch'?1:kind==='battery'?2:kind==='solar-generator'?3:0;
    const ingredients:ConstructionCost[]=[{item:'steel',quantity:costs[kind]},...(components?[{item:'component' as const,quantity:components}]:[])];
    recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;
  }
  if(kind==='fueled-stove'||kind==='electric-stove'||kind==='butcher-table'){
    const material=kind==='butcher-table'?'wood':'steel';
    const ingredients:ConstructionCost[]=[{item:material,quantity:costs[kind]},...(kind==='electric-stove'?[{item:'component' as const,quantity:2}]:[])];
    const coreWork=work[kind]*BUILDING_MATERIALS[material].workFactor;
    recipes.set(`${kind}:${material}`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:coreWork/10,coreWork}));continue;
  }
  if(kind==='electric-tailor-bench')for(const material of ['wood','steel'] as const){const amounts=new Map<ConstructionMaterial,number>([[material,75],['steel',50]]);const ingredients:ConstructionCost[]=[...amounts].map(([item,quantity])=>Object.freeze({item,quantity}));ingredients.push(Object.freeze({item:'component',quantity:2}));const stats=BUILDING_MATERIALS[material],coreWork=Math.round(work[kind]*stats.workFactor+stats.workOffset);recipes.set(`${kind}:${material}`,Object.freeze({ingredients:Object.freeze(ingredients),work:Math.ceil(coreWork/10),coreWork}));}
  if(kind==='sleeping-spot'||kind==='animal-sleeping-spot'||kind==='crafting-spot'||kind==='butcher-spot'){recipes.set(`${kind}:legacy`,Object.freeze({ingredients:[],work:0,coreWork:0}));continue;}
  if(kind==='cooler'||kind==='wood-generator'||kind==='standing-lamp'||kind==='sun-lamp') {
    const ingredients:readonly ConstructionCost[]=kind==='cooler'?[{item:'steel',quantity:90},{item:'component',quantity:3}]:kind==='wood-generator'?[{item:'steel',quantity:100},{item:'component',quantity:2}]:[{item:'steel',quantity:costs[kind]}];
    recipes.set(`${kind}:steel`,Object.freeze({ingredients:Object.freeze(ingredients.map(c=>Object.freeze(c))),work:work[kind]/10,coreWork:work[kind]}));continue;
  }
  if(kind!=='research-bench'&&kind!=='tailor-bench'&&kind!=='electric-tailor-bench'&&kind!=='stonecutter'&&kind!=='passive-cooler'&&kind!=='armchair'&&kind!=='autodoor')recipes.set(`${kind}:legacy`,Object.freeze({ingredients:Object.freeze(JOB_WOOD_COST[kind]?[Object.freeze({item:'wood' as const,quantity:JOB_WOOD_COST[kind]})]:[]),work:JOB_DURATION[kind],coreWork:JOB_DURATION[kind]*10}));
  if(kind in STRUCTURE_DEFINITIONS&&hasConstructionRecipeStats(kind))for(const material of CONSTRUCTION_MATERIALS) {
    // Only the actual Stony furniture catalogue is broadened by prospective jade.
    if(material==='jade'&&(!isHabitatFurnitureKind(kind)||!materialAllowed(kind,material)))continue;
    if(kind==='electric-tailor-bench'||kind==='armchair'&&!isUpholsteryMaterial(material)||kind!=='armchair'&&isUpholsteryMaterial(material)||(kind==='campfire'||kind==='passive-cooler')&&material!=='wood'||(kind==='stonecutter'||kind==='tailor-bench')&&isBlockMaterial(material)||kind==='dining-chair'&&isBlockMaterial(material))continue;
    const k=kind;
    const stats=BUILDING_MATERIALS[material];
    const coreWork=material==='jade'&&isHabitatFurnitureKind(k)?furnitureWorkToBuildCore(k,material):Math.round(k==='campfire'||k==='passive-cooler'?work[k]:work[k]*stats.workFactor+stats.workOffset);
    const amounts=new Map<ConstructionMaterial,number>([[material,costs[k]]]);
    if(k==='research-bench')amounts.set('steel',(amounts.get('steel')??0)+25);
    if(k==='stonecutter')amounts.set('steel',(amounts.get('steel')??0)+30);
    if(k==='autodoor')amounts.set('steel',(amounts.get('steel')??0)+40);
    const ingredients:ConstructionCost[]=[...amounts].map(([item,quantity])=>Object.freeze({item,quantity}));
    if(k==='autodoor')ingredients.push(Object.freeze({item:'component',quantity:2}));
    recipes.set(`${kind}:${material}`,Object.freeze({ingredients:Object.freeze(ingredients),work:Math.ceil(coreWork/10),coreWork}));
  }
}
export function validConstructionMaterial(kind:unknown,material:unknown,version:number=SCHEMA_VERSION):boolean {
  if(isShipComputerSensorsKind298(kind))return isSchema298OrLater(version)&&material==='steel';
  if(kind==='firefoam-popper')return (version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))&&material==='steel';
  if(isShipCasketKind277(kind))return isSchema277OrLater(version)&&material==='steel';
  if(isShipAddedKind276(kind))return isSchema276OrLater(version)&&material==='steel';
  if(kind==='ship-reactor')return isSchema275OrLater(version)&&material==='steel';
  if(kind==='cryptosleep-casket')return isSchema271OrLater(version)&&material==='steel';
  if(kind==='ancient-cryptosleep-casket')return version>=256&&material===undefined;
  if(isAncientMonumentKind256(kind))return ancientMonumentMaterial256(kind,material,version);
  if(kind==='ship-chunk')return version>=256&&material===undefined;
  if(isCaveHiveKind256(kind))return version>=256&&material===undefined;
  if(isLocalRoadProp256(kind))return version>=256&&material===undefined;
  if(material==='jade')return version>=256&&(kind==='small-sculpture'||kind==='large-sculpture'||isHabitatFurnitureKind(kind)&&materialAllowed(kind,material))&&recipes.has(`${kind}:${material}`);
  if(kind==='bedroll')return version>=256&&materialAllowed('bedroll',material);
  if(kind==='torch-lamp')return version>=249&&material==='wood';
  if(kind==='shelf'||kind==='small-shelf')return version>=229&&materialAllowed(kind,material);
  if(kind==='double-bed')return version>=224&&materialAllowed('double-bed',material);
  if(kind==='electric-crematorium')return version>=225&&typeof material==='string'&&isBlockMaterial(material as ConstructionMaterial)&&recipes.has(`${kind}:${material}`);
  if(kind==='brewery'||kind==='fermenting-barrel')return version>=265&&material==='wood';
  if(kind==='fueled-smithy'||kind==='electric-smithy')return version>=267&&material==='steel';
  if(kind==='geothermal-generator')return version>=264&&material==='steel';
  if(kind==='electric-smelter')return version>=222&&material==='steel';
  if(kind==='biofuel-refinery'||kind==='chemfuel-generator')return version>=218&&material==='steel';
  if(kind==='nutrient-paste-dispenser'||kind==='hopper')return version>=217&&material==='steel';
  if(kind==='orbital-beacon'||kind==='comms-console')return version>=216&&material==='steel';
  if(kind==='deep-drill'||kind==='ground-scanner')return version>=215&&material==='steel';
  if(kind==='vitals-monitor')return version>=211&&material==='steel';
  if(kind==='hydroponics-basin')return version>=203&&material==='steel';
  if(kind==='spike-trap')return version>=226&&typeof material==='string'&&!isUpholsteryMaterial(material)&&recipes.has(`${kind}:${material}`);
  if(kind==='mini-turret')return version>=193&&material==='steel';
  if(kind==='tube-television')return version>=190&&material==='steel';
  if(kind==='sandbags')return version>=189&&material==='cloth';
  if(kind==='hospital-bed')return version>=187&&material==='steel';
  if(kind==='sun-lamp')return version>=177&&material==='steel';
  if(kind==='chess-table')return version>=122&&typeof material==='string'&&(CONSTRUCTION_MATERIALS as readonly string[]).includes(material)&&recipes.has(`${kind}:${material}`);
  if(kind==='autodoor')return version>=143&&typeof material==='string'&&recipes.has(`${kind}:${material}`);
  if(kind==='fence'||kind==='fence-gate'||kind==='pen-marker')return version>=119&&typeof material==='string'&&recipes.has(`${kind}:${material}`);
  if(kind==='drug-lab')return version>=206&&(material==='wood'||material==='steel');
  if(kind==='art-bench')return version>=104&&(material==='wood'||material==='steel');
  if(kind==='small-sculpture'||kind==='large-sculpture')return version>=104&&isSculptureMaterial(material);
  if(kind==='fabrication-bench'||kind==='hi-tech-research-bench'||kind==='multi-analyzer')return version>=123&&material==='steel';
  if(kind==='machining-table')return version>=101&&material==='steel';
  if(kind==='build-bridge'||kind==='remove-bridge')return version>=247&&material===undefined;
  if(kind==='grave'||kind==='lay-floor'||kind==='remove-floor')return version>=89&&material===undefined;
  if(kind==='heater'||kind==='wind-turbine')return version>=87&&material==='steel';
  if(kind==='power-conduit'||kind==='power-switch'||kind==='battery'||kind==='solar-generator')return version>=85&&material==='steel';
  if(kind==='fueled-stove'||kind==='electric-stove'||kind==='butcher-table')return version>=84&&material===(kind==='butcher-table'?'wood':'steel');
  if(kind==='vent')return version>=244&&material==='steel';
  if(kind==='cooler')return version>=75&&material==='steel';
  if(kind==='research-bench'||kind==='tailor-bench')return version>=73&&typeof material==='string'&&recipes.has(`${kind}:${material}`);
  if(kind==='electric-tailor-bench'||kind==='armchair'||kind==='dining-chair'||kind==='end-table'||kind==='dresser'||kind==='table-square'||kind==='table-long'||kind==='flower-pot')return version>=90&&typeof material==='string'&&recipes.has(`${kind}:${material}`);
  if(kind==='sleeping-spot')return version>=232&&material===undefined;
  if(kind==='animal-sleeping-spot')return version>=221&&material===undefined;
  if(kind==='crafting-spot')return material===undefined;
  if(kind==='wood-generator'||kind==='standing-lamp')return version>=42&&material==='steel';
  if(kind==='passive-cooler')return version>=40&&material==='wood';
  return material===undefined||typeof kind==='string'&&typeof material==='string'&&(CONSTRUCTION_MATERIALS as readonly string[]).includes(material)&&(version>=33||!isBlockMaterial(material))&&recipes.has(`${kind}:${material}`);
}
export const constructionMaterials=(kind:string):readonly ConstructionMaterial[]=>kind==='bedroll'?BEDROLL_MATERIALS_256:CONSTRUCTION_MATERIALS.filter(material=>validConstructionMaterial(kind,material));
/** Schema 311: Core constructionSkillPrerequisite of the wood-fired (4) and
 * chemfuel (6) generators, which required none here before. */
export const constructionSkillRequired=(kind:unknown,version:number=SCHEMA_VERSION):number=>Number(version)>=311&&kind==='wood-generator'?4:Number(version)>=311&&kind==='chemfuel-generator'?6:isShipComputerSensorsKind298(kind)?SHIP_COMPUTER_SENSORS_CONTENT_298[kind].constructionSkill:kind==='firefoam-popper'?5:kind==='cryptosleep-casket'?CRYPTOSLEEP_PHYSICS_271.constructionSkill:kind==='electric-smithy'?5:kind==='fueled-smithy'?4:kind==='sarcophagus'?5:kind==='spike-trap'?3:kind==='electric-crematorium'||kind==='electric-smelter'||kind==='biofuel-refinery'?4:kind==='nutrient-paste-dispenser'?5:kind==='comms-console'?5:kind==='drug-lab'?4:kind==='mini-turret'?5:kind==='tube-television'?7:kind==='autodoor'?6:kind==='cooler'?5:kind==='electric-stove'||kind==='electric-tailor-bench'||kind==='machining-table'?4:kind==='fabrication-bench'||kind==='hi-tech-research-bench'?6:kind==='multi-analyzer'?8:isHabitatFurnitureKind(kind)?FURNITURE_DEFINITIONS[kind].constructionSkill:powerConstructionSkill(kind as JobKind);
export function constructionRecipe(entity:ConstructionObject):ConstructionRecipe {
  if(entity.kind==='smooth-floor')return {ingredients:[],work:280,coreWork:2800};
  if(entity.kind==='ancient-cryptosleep-casket')return {ingredients:[{item:'steel',quantity:180},{item:'uranium',quantity:5}],work:.1,coreWork:1};
  if(isAncientMonumentKind256(entity.kind)){if(!ancientMonumentMaterial256(entity.kind,entity.material,256))throw Error('Missing actual ancient Stuff');return ancientMonumentRecipe256(entity.kind,entity.material);}
  // Fixed ingredients are for recovery/wealth, never Architecte jobs.
  if(entity.kind==='ship-chunk')return shipChunkRecipe256();
  if(isCaveHiveKind256(entity.kind))return {ingredients:[],work:0,coreWork:0}; // Natural spawn, never an Architecte recipe.
  if(isLocalRoadProp256(entity.kind))return localRoadPropRecipe256(entity.kind);
  if(entity.kind==='build-bridge')return {ingredients:[{item:'wood',quantity:12}],work:150,coreWork:1500};
  if(entity.kind==='remove-bridge')return {ingredients:[],work:30,coreWork:300};
  if(entity.kind==='fix-breakdown')return BREAKDOWN_RECIPE;
  if(entity.kind==='lay-floor'||entity.kind==='remove-floor')return flooringRecipe(entity.floor,entity.kind==='remove-floor');
  return recipes.get(`${entity.kind}:${entity.material??'legacy'}`)!;
}
export const requiredMaterial=(entity:ConstructionObject,item:ItemId):number=>constructionRecipe(entity).ingredients.find(c=>c.item===item)?.quantity??0;
export function deliveredMaterial(world:World,job:Job,item:ItemId):number {
  let amount=0;for(const pile of world.piles)if(pile.item===item&&pile.owner.type==='job'&&pile.owner.jobId===job.id)amount+=pile.quantity;
  return amount;
}
export function constructionSupplied(world:World,job:Job):boolean {
  return constructionRecipe(job).ingredients.every(c=>deliveredMaterial(world,job,c.item)===c.quantity);
}
export function constructionCapacity(world:World,job:Job,item:ItemId,exceptPawn?:number):number {
  return Math.max(0,requiredMaterial(job,item)-deliveredMaterial(world,job,item)-reservedDestination(world,{type:'job',jobId:job.id},exceptPawn,item));
}
