import {isShipComputerSensorsKind298,SHIP_COMPUTER_CONTENT_298,SHIP_SENSORS_CONTENT_298} from './ship-computer-sensors-content-298.ts';
import {shipComputerSensorsCells298,shipComputerSensorsContains298} from './ship-computer-sensors-geometry-298.ts';
import {isShipPartKind276,SHIP_PART_DEFAULT_ORIENTATION_276,SHIP_BEAM_CONTENT_276,SHIP_ENGINE_CONTENT_276} from './ship-part-content-276.ts';
import {SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {shipCasketCells277,shipCasketContains277} from './ship-casket-geometry-277.ts';
import {shipPartCells276,shipPartContains276} from './ship-part-geometry-276.ts';
import {cryptosleepCells271} from './cryptosleep-content-271.ts';
import {ancientCasketCells256} from './ancient-casket-footprint-256.ts';
import {isAncientMonumentKind256,ANCIENT_MONUMENT_DEFS_256,ancientMonumentCells256} from './ancient-monument-props-256.ts';
import { isBedKind } from './bed-kinds.ts';
import {isJoyTableKind354,joyTableCells354,joyTableContains354} from './joy-tables-354.ts';
import {tableLargeCells363,tableLargeContains363} from './furniture-c-363.ts';
import type { Cell, Footprint, JobKind, Orientation, StructureKind } from './types.ts';

/** Immutable historical catalogue. Typed V30 construction recipes live in
 * construction-materials.ts; retain these values for untyped saved objects. */
export const MAX_STACK = 75;
export const CARRY_CAPACITY = 10;
export const MATERIAL_DEFINITIONS = Object.freeze({
  'ai-core':Object.freeze({id:'ai-core',label:'Cœur d’IA',unit:'unit',stackLimit:1}),
  chemfuel:Object.freeze({id:'chemfuel',label:'Biocarburant',unit:'unit',stackLimit:150}),
  neutroamine:Object.freeze({id:'neutroamine',label:'Neutroamine',unit:'unit',stackLimit:150}),
  component: Object.freeze({id:'component',label:'Composants',unit:'unit',stackLimit:50}),
  steel: Object.freeze({id:'steel',label:'Acier',unit:'unit',stackLimit:MAX_STACK}),
  chunk: Object.freeze({id:'chunk',label:'Fragments de roche',unit:'fragment',stackLimit:1}),
  wood: Object.freeze({ id: 'wood', label: 'Bois', unit: 'unit', stackLimit: MAX_STACK }),
  food: Object.freeze({ id: 'food', label: 'Nourriture', unit: 'portion', stackLimit: MAX_STACK, chairSearchRadius: 32, tableDesired: true }),
});
export const JOB_DURATION: Readonly<Record<JobKind, number>> = Object.freeze({'hoopstone-ring':10,'billiards-table':1200,'game-of-ur-board':600,'poker-table':1000,'tool-cabinet':180,'ship-computer':1600,'ship-sensors':3000,'firefoam-popper':150,'smooth-floor':280,'ship-cryptosleep-casket':SHIP_CASKET_CONTENT_277.work,'ship-beam':SHIP_BEAM_CONTENT_276.work,'ship-engine':SHIP_ENGINE_CONTENT_276.work,'ship-reactor':6500,'cryptosleep-casket':320,'fueled-smithy':300,'electric-smithy':300,brewery:200,'fermenting-barrel':60,column:75,urn:50,'stele-large':800,'stele-grand':1600,sarcophagus:240,'torch-lamp':10,'build-bridge':150,'remove-bridge':30,'extract-tree':80,'replant-tree':80, shelf:50,'small-shelf':25, 'spike-trap':320,'ied-high-explosive':140,'ied-incendiary':140,'electric-crematorium':450,'double-bed':150,'electric-smelter':350,'sleeping-spot':0,'animal-sleeping-spot':0,'biofuel-refinery':200,'chemfuel-generator':250,'geothermal-generator':1200, 'nutrient-paste-dispenser':220,hopper:30, 'orbital-beacon':80, 'comms-console':220, 'deep-drill':1000, 'ground-scanner':1200, 'vitals-monitor':600, 'drug-lab':350, 'hydroponics-basin':280, 'mini-turret':180, 'tube-television':1000, sandbags:18, 'fix-breakdown':100, fence:7,'fence-gate':50,'pen-marker':60, 'art-bench':250,'small-sculpture':0,'large-sculpture':0,'machining-table':300,'fabrication-bench':500,'hi-tech-research-bench':500,'multi-analyzer':1000, grave:80, 'lay-floor':1, 'remove-floor':1, heater:100, 'wind-turbine':330, flick:15, 'power-conduit':3.5, 'power-switch':20, battery:80, 'solar-generator':250, 'fueled-stove':200, 'electric-stove':200, 'butcher-table':200, 'butcher-spot':0, cooler:160,vent:40, 'research-bench':280,'tailor-bench':200,'electric-tailor-bench':250,'crafting-spot':0, repair:80, 'wood-generator':250, 'standing-lamp':30, 'sun-lamp':33, 'passive-cooler':20, 'build-roof':4, 'remove-roof':4, door:60, autodoor:110, stonecutter:200, mine:10, uninstall:12, install:1, deconstruct:1, chop:100, harvest:60, cut:60, sow:17, horseshoes:7, 'chess-table':800, campfire:20, wall:70, bedroll:60,bed:120, 'hospital-bed':280, table:53,'table-square':150,'table-long':300,'table-large':330,'double-bedroll':110,'double-sleeping-spot':0,'wall-lamp':33,stool:32,'dining-chair':800,armchair:1400,'end-table':100,dresser:200,'flower-pot':25 });
export const JOB_WOOD_COST: Readonly<Record<JobKind, number>> = Object.freeze({'hoopstone-ring':0,'billiards-table':0,'game-of-ur-board':0,'poker-table':0,'tool-cabinet':0,'ship-computer':0,'ship-sensors':0,'firefoam-popper':0,'smooth-floor':0,'ship-cryptosleep-casket':0,'ship-beam':0,'ship-engine':0,'ship-reactor':0,'cryptosleep-casket':0,'fueled-smithy':0,'electric-smithy':0,brewery:0,'fermenting-barrel':0,column:20,urn:20,'stele-large':125,'stele-grand':250,sarcophagus:60,'torch-lamp':20,'build-bridge':12,'remove-bridge':0,'extract-tree':0,'replant-tree':0, shelf:20,'small-shelf':10, 'spike-trap':45,'ied-high-explosive':0,'ied-incendiary':0,'electric-crematorium':0,'double-bed':85,'electric-smelter':0,'sleeping-spot':0,'animal-sleeping-spot':0,'biofuel-refinery':0,'chemfuel-generator':0,'geothermal-generator':0, 'nutrient-paste-dispenser':0,hopper:0, 'orbital-beacon':0, 'comms-console':0, 'deep-drill':0, 'ground-scanner':0, 'vitals-monitor':0, 'drug-lab':0, 'hydroponics-basin':0, 'mini-turret':0, 'tube-television':0, sandbags:0, 'fix-breakdown':0, fence:1,'fence-gate':25,'pen-marker':30, 'art-bench':0,'small-sculpture':0,'large-sculpture':0,'machining-table':0,'fabrication-bench':0,'hi-tech-research-bench':0,'multi-analyzer':0, grave:0, 'lay-floor':0, 'remove-floor':0, heater:0, 'wind-turbine':0, flick:0, 'power-conduit':0, 'power-switch':0, battery:0, 'solar-generator':0, 'fueled-stove':0, 'electric-stove':0, 'butcher-table':95, 'butcher-spot':0, cooler:0,vent:0, 'research-bench':0,'tailor-bench':0,'electric-tailor-bench':0,'crafting-spot':0, repair:0, 'wood-generator':0, 'standing-lamp':0, 'sun-lamp':0, 'passive-cooler':50, 'build-roof':0, 'remove-roof':0, door:25, autodoor:0, stonecutter:0, mine:0, uninstall:0, install:0, deconstruct:0, chop:0, harvest:0, cut:0, sow:0, horseshoes:10, 'chess-table':70, campfire:20, wall:5, bedroll:0,bed:8, 'hospital-bed':0, table:28,'table-square':50,'table-large':100,'double-bedroll':0,'double-sleeping-spot':0,'wall-lamp':0,'table-long':95,stool:25,'dining-chair':45,armchair:0,'end-table':30,dresser:50,'flower-pot':20 });
export const STRUCTURE_DEFINITIONS = Object.freeze({
  'hoopstone-ring':Object.freeze({id:'hoopstone-ring',width:1,depth:1,blocksMovement:false}),
  'billiards-table':Object.freeze({id:'billiards-table',width:2,depth:3,blocksMovement:false}),
  'game-of-ur-board':Object.freeze({id:'game-of-ur-board',width:1,depth:1,blocksMovement:false}),
  'poker-table':Object.freeze({id:'poker-table',width:2,depth:2,blocksMovement:false}),
  'firefoam-popper':Object.freeze({id:'firefoam-popper',width:1,depth:1,blocksMovement:false}),
  'ship-computer':Object.freeze({id:'ship-computer',width:SHIP_COMPUTER_CONTENT_298.width,depth:SHIP_COMPUTER_CONTENT_298.depth,blocksMovement:true}),
  'ship-sensors':Object.freeze({id:'ship-sensors',width:SHIP_SENSORS_CONTENT_298.width,depth:SHIP_SENSORS_CONTENT_298.depth,blocksMovement:true}),
  'ship-cryptosleep-casket':Object.freeze({id:'ship-cryptosleep-casket',width:1,depth:2,blocksMovement:false}),
  'ship-beam':Object.freeze({id:'ship-beam',width:2,depth:6,blocksMovement:true}),
  'ship-engine':Object.freeze({id:'ship-engine',width:3,depth:4,blocksMovement:true}),
  'ship-reactor':Object.freeze({id:'ship-reactor',width:6,depth:7,blocksMovement:true}),
  'cryptosleep-casket':Object.freeze({id:'cryptosleep-casket',width:1,depth:2,blocksMovement:false}),
  'fueled-smithy':Object.freeze({id:'fueled-smithy',width:3,depth:1,blocksMovement:false}),
  'electric-smithy':Object.freeze({id:'electric-smithy',width:3,depth:1,blocksMovement:false}),
  brewery:Object.freeze({id:'brewery',width:3,depth:1,blocksMovement:false}),
  'fermenting-barrel':Object.freeze({id:'fermenting-barrel',width:1,depth:1,blocksMovement:false}),
  'insect-hive':Object.freeze({id:'insect-hive',width:1,depth:1,blocksMovement:false}),'glow-pod':Object.freeze({id:'glow-pod',width:1,depth:1,blocksMovement:false}),
  'ancient-cryptosleep-casket':Object.freeze({id:'ancient-cryptosleep-casket',width:1,depth:2,blocksMovement:false}),
  column:Object.freeze({id:'column',width:1,depth:1,blocksMovement:false}),urn:Object.freeze({id:'urn',width:1,depth:1,blocksMovement:false}),
  'stele-large':Object.freeze({id:'stele-large',width:2,depth:2,blocksMovement:false}),'stele-grand':Object.freeze({id:'stele-grand',width:3,depth:3,blocksMovement:false}),sarcophagus:Object.freeze({id:'sarcophagus',width:1,depth:2,blocksMovement:false}),
  'ship-chunk':Object.freeze({id:'ship-chunk',width:2,depth:2,blocksMovement:false}),
  'ancient-road-barrier':Object.freeze({id:'ancient-road-barrier',width:1,depth:1,blocksMovement:false}),
  'ancient-road-lamp':Object.freeze({id:'ancient-road-lamp',width:1,depth:1,blocksMovement:false}),
  'torch-lamp':Object.freeze({id:'torch-lamp',width:1,depth:1,blocksMovement:false}),
  shelf:Object.freeze({id:'shelf',width:2,depth:1,blocksMovement:false}),
  'small-shelf':Object.freeze({id:'small-shelf',width:1,depth:1,blocksMovement:false}),
  'spike-trap':Object.freeze({id:'spike-trap',width:1,depth:1,blocksMovement:false}),
  'ied-high-explosive':Object.freeze({id:'ied-high-explosive',width:1,depth:1,blocksMovement:false}),
  'ied-incendiary':Object.freeze({id:'ied-incendiary',width:1,depth:1,blocksMovement:false}),
  'electric-crematorium':Object.freeze({id:'electric-crematorium',width:3,depth:2,blocksMovement:true}),
  'double-bed':Object.freeze({id:'double-bed',width:2,depth:2,blocksMovement:false}),
  'electric-smelter':Object.freeze({id:'electric-smelter',width:3,depth:1,blocksMovement:false}),
  'biofuel-refinery':Object.freeze({id:'biofuel-refinery',width:3,depth:2,blocksMovement:false}),
  'geothermal-generator':Object.freeze({id:'geothermal-generator',width:6,depth:6,blocksMovement:true}),
  'chemfuel-generator':Object.freeze({id:'chemfuel-generator',width:2,depth:2,blocksMovement:false}),
  'nutrient-paste-dispenser':Object.freeze({id:'nutrient-paste-dispenser',width:3,depth:4,blocksMovement:true}),
  hopper:Object.freeze({id:'hopper',width:1,depth:1,blocksMovement:false}),
  'orbital-beacon':Object.freeze({id:'orbital-beacon',width:1,depth:1,blocksMovement:false}),
  'comms-console':Object.freeze({id:'comms-console',width:3,depth:2,blocksMovement:false}),
  'deep-drill':Object.freeze({id:'deep-drill',width:1,depth:1,blocksMovement:false}),
  'ground-scanner':Object.freeze({id:'ground-scanner',width:3,depth:3,blocksMovement:false}),
  'vitals-monitor':Object.freeze({id:'vitals-monitor',width:1,depth:1,blocksMovement:false}),
  'drug-lab':Object.freeze({id:'drug-lab',width:3,depth:1,blocksMovement:false}),
  'hydroponics-basin':Object.freeze({id:'hydroponics-basin',width:1,depth:4,blocksMovement:false}),
  'mini-turret':Object.freeze({id:'mini-turret',width:1,depth:1,blocksMovement:false}),
  'tube-television':Object.freeze({id:'tube-television',width:1,depth:1,blocksMovement:false}),
  sandbags:Object.freeze({id:'sandbags',width:1,depth:1,blocksMovement:false}),
  fence:Object.freeze({id:'fence',width:1,depth:1,blocksMovement:false}),
  'fence-gate':Object.freeze({id:'fence-gate',width:1,depth:1,blocksMovement:false}),
  'pen-marker':Object.freeze({id:'pen-marker',width:1,depth:1,blocksMovement:false}),
  'art-bench':Object.freeze({id:'art-bench',width:3,depth:1,blocksMovement:false}),
  'fabrication-bench':Object.freeze({id:'fabrication-bench',width:5,depth:2,blocksMovement:false}),
  'hi-tech-research-bench':Object.freeze({id:'hi-tech-research-bench',width:5,depth:2,blocksMovement:false}),
  'multi-analyzer':Object.freeze({id:'multi-analyzer',width:2,depth:2,blocksMovement:false}),
  'small-sculpture':Object.freeze({id:'small-sculpture',width:1,depth:1,blocksMovement:false}),
  'large-sculpture':Object.freeze({id:'large-sculpture',width:1,depth:1,blocksMovement:false}),
  grave:Object.freeze({id:'grave',width:1,depth:2,blocksMovement:false}),
  heater:Object.freeze({id:'heater',width:1,depth:1,blocksMovement:false}),
  'wind-turbine':Object.freeze({id:'wind-turbine',width:7,depth:2,blocksMovement:false}),
  'power-conduit':Object.freeze({id:'power-conduit',width:1,depth:1,blocksMovement:false}),
  'power-switch':Object.freeze({id:'power-switch',width:1,depth:1,blocksMovement:false}),
  battery:Object.freeze({id:'battery',width:1,depth:2,blocksMovement:false}),
  'solar-generator':Object.freeze({id:'solar-generator',width:4,depth:4,blocksMovement:false}),
  'fueled-stove':Object.freeze({id:'fueled-stove',width:3,depth:1,blocksMovement:false}),
  'electric-stove':Object.freeze({id:'electric-stove',width:3,depth:1,blocksMovement:false}),
  'butcher-table':Object.freeze({id:'butcher-table',width:3,depth:1,blocksMovement:false}),
  'butcher-spot':Object.freeze({id:'butcher-spot',width:1,depth:1,blocksMovement:false}),
  cooler:Object.freeze({id:'cooler',width:1,depth:1,blocksMovement:true}),
  vent:Object.freeze({id:'vent',width:1,depth:1,blocksMovement:true}),
  'research-bench':Object.freeze({id:'research-bench',width:3,depth:2,blocksMovement:false}),
  'tailor-bench':Object.freeze({id:'tailor-bench',width:3,depth:1,blocksMovement:false}),
  'machining-table':Object.freeze({id:'machining-table',width:3,depth:1,blocksMovement:false}),
  'electric-tailor-bench':Object.freeze({id:'electric-tailor-bench',width:3,depth:1,blocksMovement:false}),
  'sleeping-spot':Object.freeze({id:'sleeping-spot',width:1,depth:2,blocksMovement:false}),
  'animal-sleeping-spot':Object.freeze({id:'animal-sleeping-spot',width:1,depth:1,blocksMovement:false}),
  'crafting-spot':Object.freeze({id:'crafting-spot',width:1,depth:1,blocksMovement:false}),
  'wood-generator': Object.freeze({id:'wood-generator',width:2,depth:2,blocksMovement:false}),
  'standing-lamp': Object.freeze({id:'standing-lamp',width:1,depth:1,blocksMovement:false}),
  'sun-lamp': Object.freeze({id:'sun-lamp',width:1,depth:1,blocksMovement:false}),
  'passive-cooler': Object.freeze({ id:'passive-cooler', width:1, depth:1, blocksMovement:false }),
  door: Object.freeze({ id:'door', width:1, depth:1, blocksMovement:false }),
  autodoor: Object.freeze({ id:'autodoor', width:1, depth:1, blocksMovement:false }),
  stonecutter: Object.freeze({ id: 'stonecutter', width: 3, depth: 1, blocksMovement: false }),
  horseshoes: Object.freeze({ id: 'horseshoes', width: 1, depth: 1, blocksMovement: false }),
  'chess-table': Object.freeze({ id: 'chess-table', width: 1, depth: 1, blocksMovement: false }),
  campfire: Object.freeze({ id: 'campfire', width: 1, depth: 1, blocksMovement: false }),
  wall: Object.freeze({ id: 'wall', width: 1, depth: 1, blocksMovement: true }),
  table: Object.freeze({ id: 'table', width: 1, depth: 2, blocksMovement: false }),
  'table-square':Object.freeze({id:'table-square',width:2,depth:2,blocksMovement:false}),
  'table-long':Object.freeze({id:'table-long',width:2,depth:4,blocksMovement:false}),
  // Schema 363 (Buildings_Furniture.xml): Table3x3c 3×3, BedrollDouble and DoubleSleepingSpot 2×2, WallLamp 1×1.
  'table-large':Object.freeze({id:'table-large',width:3,depth:3,blocksMovement:false}),
  'double-bedroll':Object.freeze({id:'double-bedroll',width:2,depth:2,blocksMovement:false}),
  'double-sleeping-spot':Object.freeze({id:'double-sleeping-spot',width:2,depth:2,blocksMovement:false}),
  'wall-lamp':Object.freeze({id:'wall-lamp',width:1,depth:1,blocksMovement:false}),
  stool: Object.freeze({ id: 'stool', width: 1, depth: 1, blocksMovement: false }),
  'dining-chair':Object.freeze({id:'dining-chair',width:1,depth:1,blocksMovement:false}),
  armchair:Object.freeze({id:'armchair',width:1,depth:1,blocksMovement:false}),
  'end-table':Object.freeze({id:'end-table',width:1,depth:1,blocksMovement:false}),
  dresser:Object.freeze({id:'dresser',width:2,depth:1,blocksMovement:false}),
  'tool-cabinet':Object.freeze({id:'tool-cabinet',width:2,depth:1,blocksMovement:false}),
  'flower-pot':Object.freeze({id:'flower-pot',width:1,depth:1,blocksMovement:false}),
  'hospital-bed':Object.freeze({id:'hospital-bed',width:1,depth:2,blocksMovement:false}),
  bedroll:Object.freeze({id:'bedroll',width:1,depth:2,blocksMovement:false}),
  bed: Object.freeze({ id: 'bed', width: 1, depth: 2, blocksMovement: false }),
});
type FootprintEntity = Cell & { kind: JobKind | StructureKind; deconstruction?: { kind: StructureKind }; flick?:{kind:StructureKind}; fixBreakdown?:{kind:StructureKind}; furniture?: { kind: StructureKind }; orientation?: Orientation; footprint?: Footprint };
const FOOTPRINT_DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
/** Hot point query without allocating the footprint's array or cells. */
export function footprintContains(entity: FootprintEntity, cell: Cell): boolean {
  const dx=cell.x-entity.x,dz=cell.z-entity.z;
  if(dx===0&&dz===0)return true;
  // The geothermal square reaches +5 from its minimum corner; rotated
  // historical footprints still reach -3. Keep the distant-query fast path.
  if(dx < -3||dx > 5||dz < -3||dz > 5)return false;
  if(entity.kind==='geothermal-generator'||entity.furniture?.kind==='geothermal-generator'||entity.deconstruction?.kind==='geothermal-generator'||entity.fixBreakdown?.kind==='geothermal-generator')return dx>=0&&dx<6&&dz>=0&&dz<6;
  if(entity.kind==='wind-turbine'||entity.furniture?.kind==='wind-turbine'||entity.deconstruction?.kind==='wind-turbine'||entity.fixBreakdown?.kind==='wind-turbine'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!,along=dx*d[0]+dz*d[1],across=dx*side[0]+dz*side[1];return along>=0&&along<=1&&Math.abs(across)<=3;}
  if(entity.kind==='solar-generator'||entity.furniture?.kind==='solar-generator'||entity.deconstruction?.kind==='solar-generator'||entity.fixBreakdown?.kind==='solar-generator')return dx>=0&&dx<4&&dz>=0&&dz<4;
  const kind=entity.furniture?.kind??entity.deconstruction?.kind??entity.flick?.kind??entity.fixBreakdown?.kind??entity.kind;
  if(isJoyTableKind354(kind))return joyTableContains354(kind,entity,entity.orientation??0,cell);
  if(kind==='table-large')return tableLargeContains363(entity,cell);
  if(kind==='table-square'||kind==='double-bed'||kind==='double-bedroll'||kind==='double-sleeping-spot'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [0,1].some(a=>[0,1].some(b=>dx===d[0]*a+side[0]*b&&dz===d[1]*a+side[1]*b));}
  if(kind==='table-long'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [0,1,2,3].some(a=>[0,1].some(b=>dx===d[0]*a+side[0]*b&&dz===d[1]*a+side[1]*b));}
  if(kind==='hi-tech-research-bench'||kind==='fabrication-bench'){
    const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;
    const along=dx*d[0]+dz*d[1],across=dx*side[0]+dz*side[1];
    return along>=0&&along<=1&&Math.abs(across)<=2;
  }
  if(kind==='multi-analyzer'){
    const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;
    const along=dx*d[0]+dz*d[1],across=dx*side[0]+dz*side[1];
    return along>=0&&along<=1&&across>=0&&across<=1;
  }
  if(isShipComputerSensorsKind298(kind))return shipComputerSensorsContains298(entity,cell);
  if(isShipPartKind276(kind))return shipPartContains276({x:entity.x,z:entity.z,kind,orientation:entity.orientation??SHIP_PART_DEFAULT_ORIENTATION_276[kind]},cell);
  if(kind==='ship-cryptosleep-casket')return shipCasketContains277(entity,cell,entity.orientation??2);
  if(kind==='cryptosleep-casket')return cryptosleepCells271(entity,entity.orientation??0).some(c=>c.x===cell.x&&c.z===cell.z);
  if(kind==='ancient-cryptosleep-casket')return ancientCasketCells256(entity,entity.orientation??0).some(c=>c.x===cell.x&&c.z===cell.z);
  if(kind==='ship-chunk')return dx>=0&&dx<=1&&dz>=0&&dz<=1;
  if(isAncientMonumentKind256(kind))return ancientMonumentCells256(kind,entity,entity.orientation??0).some(c=>c.x===cell.x&&c.z===cell.z);
  if(kind==='nutrient-paste-dispenser'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!,along=dx*d[0]+dz*d[1],across=dx*side[0]+dz*side[1];return along>=-1&&along<=2&&Math.abs(across)<=1;}
  if(kind==='hydroponics-basin'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,along=dx*d[0]+dz*d[1];return along>=0&&along<=3&&dx===d[0]*along&&dz===d[1]*along;}
  // All branches below occupy the anchor or its immediate neighbours.
  // Reject distant queries before reading optional payloads in large colonies.
  if(dx < -1||dx > 1||dz < -1||dz > 1)return false;
  if(kind==='ground-scanner')return true;
  if(kind==='chemfuel-generator'||kind==='wood-generator')return dx>=0&&dx<=1&&dz>=0&&dz<=1;
  if(kind==='electric-crematorium'||kind==='biofuel-refinery'||kind==='comms-console'||kind==='research-bench'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!,along=dx*d[0]+dz*d[1],across=dx*side[0]+dz*side[1];return along>=0&&along<=1&&Math.abs(across)<=1;}
  if(kind==='shelf'||kind==='tool-cabinet'){const d=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return dx===d[0]&&dz===d[1];}
  if(kind==='dresser'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!;return dx===d[0]&&dz===d[1];}
  if(kind==='fueled-smithy'||kind==='electric-smithy'||kind==='brewery'||kind==='electric-smelter'||kind==='drug-lab'||kind==='machining-table'||kind==='art-bench'||kind==='stonecutter'||kind==='tailor-bench'||kind==='electric-tailor-bench'||kind==='fueled-stove'||kind==='electric-stove'||kind==='butcher-table') {
    const d=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;
    return dx===d[0]&&dz===d[1]||dx===-d[0]&&dz===-d[1];
  }
  if((!isBedKind(kind)&&kind!=='table'&&kind!=='battery'&&kind!=='grave')||entity.footprint==='legacy-single')return false;
  const direction=FOOTPRINT_DIRECTIONS[entity.orientation??0]!;
  return dx===direction[0]&&dz===direction[1];
}
export function footprintCells(entity: FootprintEntity): Cell[] {
  const cells = [{ x: entity.x, z: entity.z }];
  const kind=entity.furniture?.kind??entity.deconstruction?.kind??entity.flick?.kind??entity.fixBreakdown?.kind??entity.kind;
  if(isShipComputerSensorsKind298(kind))return shipComputerSensorsCells298(entity);
  if(isJoyTableKind354(kind))return joyTableCells354(kind,entity,entity.orientation??0);
  if(kind==='table-large')return tableLargeCells363(entity);
  if(isShipPartKind276(kind))return shipPartCells276({x:entity.x,z:entity.z,kind,orientation:entity.orientation??SHIP_PART_DEFAULT_ORIENTATION_276[kind]});
  if(kind==='ship-cryptosleep-casket')return shipCasketCells277(entity,entity.orientation??2);
  if(kind==='cryptosleep-casket')return cryptosleepCells271(entity,entity.orientation??0);
  if(kind==='ancient-cryptosleep-casket')return ancientCasketCells256(entity,entity.orientation??0);
  if(kind==='ship-chunk')return Array.from({length:4},(_,i)=>({x:entity.x+i%2,z:entity.z+Math.floor(i/2)}));
  if(isAncientMonumentKind256(kind))return ancientMonumentCells256(kind,entity,entity.orientation??0);
  if(kind==='nutrient-paste-dispenser'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [-1,0,1,2].flatMap(a=>[-1,0,1].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));}
  if(kind==='ground-scanner')return [-1,0,1].flatMap(z=>[-1,0,1].map(x=>({x:entity.x+x,z:entity.z+z})));
  if(kind==='wind-turbine'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [0,1].flatMap(a=>[-3,-2,-1,0,1,2,3].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));}
  if(kind==='hydroponics-basin'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!;return [0,1,2,3].map(a=>({x:entity.x+d[0]*a,z:entity.z+d[1]*a}));}
  if(kind==='geothermal-generator')return Array.from({length:36},(_,i)=>({x:entity.x+i%6,z:entity.z+Math.floor(i/6)}));
  if(kind==='solar-generator')return Array.from({length:16},(_,i)=>({x:entity.x+i%4,z:entity.z+Math.floor(i/4)}));
  if(kind==='table-square'||kind==='double-bed'||kind==='double-bedroll'||kind==='double-sleeping-spot'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [0,1].flatMap(a=>[0,1].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));}
  if(kind==='table-long'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [0,1,2,3].flatMap(a=>[0,1].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));}
  if(kind==='chemfuel-generator'||kind==='wood-generator')return [...cells,{x:entity.x+1,z:entity.z},{x:entity.x,z:entity.z+1},{x:entity.x+1,z:entity.z+1}];
  if(kind==='hi-tech-research-bench'||kind==='fabrication-bench'){
    const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;
    return [0,1].flatMap(a=>[-2,-1,0,1,2].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));
  }
  if(kind==='multi-analyzer'){
    const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;
    return [0,1].flatMap(a=>[0,1].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));
  }
  if(kind==='electric-crematorium'||kind==='biofuel-refinery'||kind==='comms-console'||kind==='research-bench'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!,side=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [0,1].flatMap(a=>[-1,0,1].map(b=>({x:entity.x+d[0]*a+side[0]*b,z:entity.z+d[1]*a+side[1]*b})));}
  if(kind==='shelf'||kind==='tool-cabinet'){const d=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;return [...cells,{x:entity.x+d[0],z:entity.z+d[1]}];}
  if(kind==='dresser'){const d=FOOTPRINT_DIRECTIONS[entity.orientation??0]!;return [...cells,{x:entity.x+d[0],z:entity.z+d[1]}];}
  if(kind==='fueled-smithy'||kind==='electric-smithy'||kind==='brewery'||kind==='electric-smelter'||kind==='drug-lab'||kind==='machining-table'||kind==='art-bench'||kind==='stonecutter'||kind==='tailor-bench'||kind==='electric-tailor-bench'||kind==='fueled-stove'||kind==='electric-stove'||kind==='butcher-table') {
    const d=FOOTPRINT_DIRECTIONS[((entity.orientation??0)+1)%4]!;
    return [...cells,{x:entity.x-d[0],z:entity.z-d[1]},{x:entity.x+d[0],z:entity.z+d[1]}];
  }
  if ((!isBedKind(kind) && kind !== 'table' && kind !== 'battery' && kind !== 'grave') || entity.footprint === 'legacy-single') return cells;
  const direction = FOOTPRINT_DIRECTIONS[entity.orientation ?? 0]!;
  cells.push({ x: entity.x + direction[0]!, z: entity.z + direction[1]! });
  return cells;
}
