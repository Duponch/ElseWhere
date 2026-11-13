import {BEDROLL_TEXTILES_256,type BedrollTextile256} from './bedroll-textiles-256.ts';
import {SCHEMA_VERSION} from './types.ts';
import { isBedKind } from './bed-kinds.ts';
import { WEAPON_QUALITIES,type WeaponQuality } from './equipment-rules.ts';

/** Core 1.6.4871 names adapted to the stable ids proposed for V90. */
export const HABITAT_FURNITURE_KINDS=['shelf','small-shelf','double-bed','bedroll','bed','hospital-bed','table','stool','dining-chair','armchair','end-table','dresser','table-square','table-long','flower-pot','chess-table'] as const;
export type HabitatFurnitureKind=typeof HABITAT_FURNITURE_KINDS[number];
export type FurnitureQuality=WeaponQuality;
export const FURNITURE_QUALITIES=WEAPON_QUALITIES;
export type FurnitureMaterial='jade'|'wood'|'steel'|'granite-blocks'|'limestone-blocks'|'marble-blocks'|'sandstone-blocks'|'slate-blocks'|BedrollTextile256;
export type FurnitureStuffCategory='woody'|'metallic'|'stony'|'fabric'|'leathery';

export interface FurnitureDefinition {
  readonly label:string;
  readonly width:number;
  readonly depth:number;
  readonly stuff:number;
  readonly categories:readonly FurnitureStuffCategory[];
  readonly coreWork:number;
  readonly constructionSkill:number;
  readonly research:'complex-furniture'|'hospital-bed'|null;
  readonly coreResearch?:'complex-furniture'|'hospital-bed'|null;
  readonly maxHitPoints:number;
  readonly beauty:number;
  readonly comfort?:number;
  readonly restEffectiveness?:number;
  readonly seats?:number;
  readonly quality:boolean;
}

const definition=(value:FurnitureDefinition):FurnitureDefinition=>Object.freeze({...value,categories:Object.freeze([...value.categories])});
const hard=Object.freeze(['woody','metallic','stony'] as const);
/** Direct transcription of the local Core Def values. Work is in Core ticks,
 * before the stuff work factor and offset. */
export const FURNITURE_DEFINITIONS:Readonly<Record<HabitatFurnitureKind,FurnitureDefinition>>=Object.freeze({
  shelf:definition({label:'Étagère',width:2,depth:1,stuff:20,categories:hard,coreWork:500,constructionSkill:0,research:'complex-furniture',maxHitPoints:100,beauty:0,quality:false}),
  'small-shelf':definition({label:'Petite étagère',width:1,depth:1,stuff:10,categories:hard,coreWork:250,constructionSkill:0,research:'complex-furniture',maxHitPoints:50,beauty:0,quality:false}),
  // Core gates the bed behind Complex furniture. Lisière already shipped it;
  // V90 keeps it unlocked while retaining the reference prerequisite here.
  bedroll:definition({label:'Sac de couchage',width:1,depth:2,stuff:40,categories:['fabric','leathery'],coreWork:600,constructionSkill:0,research:null,maxHitPoints:75,beauty:0,comfort:.68,restEffectiveness:.95,quality:true}),
  bed:definition({label:'Lit',width:1,depth:2,stuff:45,categories:hard,coreWork:800,constructionSkill:0,research:null,coreResearch:'complex-furniture',maxHitPoints:140,beauty:1,comfort:.75,restEffectiveness:1,quality:true}),
  'double-bed':definition({label:'Lit double',width:2,depth:2,stuff:85,categories:hard,coreWork:1500,constructionSkill:0,research:'complex-furniture',coreResearch:'complex-furniture',maxHitPoints:200,beauty:2,comfort:.75,restEffectiveness:1,quality:true}),
  'hospital-bed':definition({label:'Lit d’hôpital',width:1,depth:2,stuff:40,categories:['metallic'],coreWork:2800,constructionSkill:8,research:'hospital-bed',coreResearch:'hospital-bed',maxHitPoints:150,beauty:2,comfort:.8,restEffectiveness:1,quality:true}),
  table:definition({label:'Table 1×2',width:1,depth:2,stuff:28,categories:hard,coreWork:750,constructionSkill:0,research:null,maxHitPoints:75,beauty:.5,seats:6,quality:true}),
  stool:definition({label:'Tabouret',width:1,depth:1,stuff:25,categories:hard,coreWork:450,constructionSkill:0,research:null,maxHitPoints:75,beauty:0,comfort:.5,seats:1,quality:true}),
  'dining-chair':definition({label:'Chaise de salle à manger',width:1,depth:1,stuff:45,categories:['woody','metallic'],coreWork:8000,constructionSkill:4,research:'complex-furniture',maxHitPoints:100,beauty:8,comfort:.7,seats:1,quality:true}),
  armchair:definition({label:'Fauteuil',width:1,depth:1,stuff:110,categories:['fabric','leathery'],coreWork:14000,constructionSkill:5,research:'complex-furniture',maxHitPoints:120,beauty:4,comfort:.8,seats:1,quality:true}),
  'end-table':definition({label:'Table de chevet',width:1,depth:1,stuff:30,categories:hard,coreWork:1000,constructionSkill:0,research:'complex-furniture',maxHitPoints:75,beauty:3,quality:true}),
  dresser:definition({label:'Commode',width:2,depth:1,stuff:50,categories:hard,coreWork:2000,constructionSkill:0,research:'complex-furniture',maxHitPoints:120,beauty:5,quality:true}),
  'table-square':definition({label:'Table 2×2',width:2,depth:2,stuff:50,categories:hard,coreWork:1500,constructionSkill:0,research:null,maxHitPoints:100,beauty:1,seats:8,quality:true}),
  'table-long':definition({label:'Table 2×4',width:2,depth:4,stuff:95,categories:hard,coreWork:3000,constructionSkill:0,research:null,maxHitPoints:150,beauty:2,seats:12,quality:true}),
  'flower-pot':definition({label:'Pot de fleurs',width:1,depth:1,stuff:20,categories:hard,coreWork:250,constructionSkill:0,research:null,maxHitPoints:75,beauty:0,quality:true}),
  'chess-table':definition({label:'Table d’échecs',width:1,depth:1,stuff:70,categories:hard,coreWork:8000,constructionSkill:0,research:'complex-furniture',maxHitPoints:100,beauty:4,quality:true}),
});

export interface FurnitureMaterialFactors {
  readonly category:FurnitureStuffCategory;
  readonly workFactor:number;
  readonly workOffset:number;
  readonly hitPointsFactor:number;
  readonly flammabilityFactor:number;
  readonly beautyFactor:number;
  readonly beautyOffset:number;
  readonly restFactor:number;
}
const material=(value:FurnitureMaterialFactors):FurnitureMaterialFactors=>Object.freeze(value);
/** Hard-stuff work/rest values already used by construction-materials.ts;
 * HP, fire and beauty are the matching current Core stuff factors. */
export const FURNITURE_MATERIALS:Readonly<Record<FurnitureMaterial,FurnitureMaterialFactors>>=Object.freeze({
  ...BEDROLL_TEXTILES_256,
  jade:material({category:'stony',workFactor:5,workOffset:0,hitPointsFactor:.5,flammabilityFactor:0,beautyFactor:2.5,beautyOffset:10,restFactor:1}),
  wood:material({category:'woody',workFactor:.7,workOffset:0,hitPointsFactor:.65,flammabilityFactor:1,beautyFactor:1,beautyOffset:0,restFactor:1}),
  steel:material({category:'metallic',workFactor:1,workOffset:0,hitPointsFactor:1,flammabilityFactor:.4,beautyFactor:1,beautyOffset:0,restFactor:1}),
  'granite-blocks':material({category:'stony',workFactor:6,workOffset:140,hitPointsFactor:1.7,flammabilityFactor:0,beautyFactor:1,beautyOffset:0,restFactor:.9}),
  'limestone-blocks':material({category:'stony',workFactor:6,workOffset:140,hitPointsFactor:1.55,flammabilityFactor:0,beautyFactor:1,beautyOffset:0,restFactor:.9}),
  'marble-blocks':material({category:'stony',workFactor:5.5,workOffset:140,hitPointsFactor:1.2,flammabilityFactor:0,beautyFactor:1,beautyOffset:1,restFactor:.9}),
  'sandstone-blocks':material({category:'stony',workFactor:5,workOffset:140,hitPointsFactor:1.4,flammabilityFactor:0,beautyFactor:1,beautyOffset:0,restFactor:.9}),
  'slate-blocks':material({category:'stony',workFactor:6,workOffset:140,hitPointsFactor:1.3,flammabilityFactor:0,beautyFactor:1,beautyOffset:0,restFactor:.9}),
  cloth:material({category:'fabric',workFactor:1,workOffset:0,hitPointsFactor:1,flammabilityFactor:1.2,beautyFactor:1,beautyOffset:0,restFactor:1}),
  'light-leather':material({category:'leathery',workFactor:1,workOffset:0,hitPointsFactor:1,flammabilityFactor:1,beautyFactor:1,beautyOffset:0,restFactor:1}),
});

export const QUALITY_BEAUTY:Readonly<Record<FurnitureQuality,number>>=Object.freeze({awful:-.1,poor:.5,normal:1,good:2,excellent:3,masterwork:5,legendary:8});
export const QUALITY_COMFORT:Readonly<Record<FurnitureQuality,number>>=Object.freeze({awful:.76,poor:.88,normal:1,good:1.12,excellent:1.24,masterwork:1.45,legendary:1.7});
export const QUALITY_REST:Readonly<Record<FurnitureQuality,number>>=Object.freeze({awful:.86,poor:.92,normal:1,good:1.08,excellent:1.14,masterwork:1.25,legendary:1.6});

/** Core 1.6.4871 sculpture recipes. WorkToMake is distinct from the work
 * needed to build a structure on the map. */
export const SCULPTURE_DEFINITIONS=Object.freeze({
  'small-sculpture':Object.freeze({stuff:50,coreWorkToMake:18000,maxHitPoints:90,beauty:50}),
  'large-sculpture':Object.freeze({stuff:100,coreWorkToMake:30000,maxHitPoints:150,beauty:100}),
});
export type SculptureKind=keyof typeof SCULPTURE_DEFINITIONS;
export type SculptureMaterial=Extract<FurnitureMaterial,'jade'|'wood'|'steel'|'granite-blocks'|'limestone-blocks'|'marble-blocks'|'sandstone-blocks'|'slate-blocks'>;
/** WorkToMake and Beauty are not the WorkToBuild/Beauty factors of ordinary
 * furniture. Core stones have no WorkToMake offset. */
export const SCULPTURE_MATERIALS:Readonly<Record<SculptureMaterial,Readonly<{makeFactor:number;beautyFactor:number;beautyOffset:number}>>>=Object.freeze({
  jade:Object.freeze({makeFactor:1.4,beautyFactor:2.5,beautyOffset:10}),
  wood:Object.freeze({makeFactor:.7,beautyFactor:1,beautyOffset:0}),
  steel:Object.freeze({makeFactor:1,beautyFactor:1,beautyOffset:0}),
  'sandstone-blocks':Object.freeze({makeFactor:1.1,beautyFactor:1.1,beautyOffset:0}),
  'marble-blocks':Object.freeze({makeFactor:1.15,beautyFactor:1.35,beautyOffset:1}),
  'granite-blocks':Object.freeze({makeFactor:1.3,beautyFactor:1,beautyOffset:0}),
  'limestone-blocks':Object.freeze({makeFactor:1.3,beautyFactor:1,beautyOffset:0}),
  'slate-blocks':Object.freeze({makeFactor:1.3,beautyFactor:1.1,beautyOffset:0}),
});
export const isSculptureKind=(value:unknown):value is SculptureKind=>typeof value==='string'&&Object.hasOwn(SCULPTURE_DEFINITIONS,value);
export const isSculptureMaterial=(value:unknown):value is SculptureMaterial=>isFurnitureMaterial(value)&&['woody','metallic','stony'].includes(FURNITURE_MATERIALS[value].category);
export function sculptureWorkToMakeCore(kind:SculptureKind,materialName:SculptureMaterial):number {
  return SCULPTURE_DEFINITIONS[kind].coreWorkToMake*SCULPTURE_MATERIALS[materialName].makeFactor;
}
export function sculptureMaxHitPoints(kind:SculptureKind,materialName:SculptureMaterial):number {
  return Math.round(SCULPTURE_DEFINITIONS[kind].maxHitPoints*FURNITURE_MATERIALS[materialName].hitPointsFactor);
}
/** StatWorker applies stuff offset before quality. Above 100 Beauty it rounds
 * to the nearest multiple of five using Core's midpoint-to-even rule. */
export function sculptureBeauty(value:FurnitureLike,version:number=SCHEMA_VERSION):number {
  if(!isSculptureKind(value.kind))return 0;
  const material=isSculptureMaterial(value.material)?SCULPTURE_MATERIALS[value.material]:undefined;
  if(Number(version)>=311)return coreBeauty311(SCULPTURE_DEFINITIONS[value.kind].beauty,material?.beautyFactor??1,material?.beautyOffset??0,QUALITY_BEAUTY[furnitureQuality(value.quality)]);
  const raw=(SCULPTURE_DEFINITIONS[value.kind].beauty*(material?.beautyFactor??1)+(material?.beautyOffset??0))*QUALITY_BEAUTY[furnitureQuality(value.quality)];
  if(raw<=100)return raw;
  const units=raw/5,lower=Math.floor(units),fraction=units-lower;
  return 5*(fraction===.5?lower+(lower%2):Math.round(units));
}

export interface FurnitureLike {kind:string;material?:string;quality?:string}
export interface FurnitureCell {x:number;z:number}
export interface FurnitureStructureLike extends FurnitureLike,FurnitureCell {id?:number;orientation?:0|1|2|3;footprint?:string;cells?:readonly FurnitureCell[]}
export interface FurnitureWorldLike {
  structures:readonly FurnitureStructureLike[];
  cellsOf?:(structure:FurnitureStructureLike)=>readonly FurnitureCell[];
  lineOfSight?:(from:FurnitureCell,to:FurnitureCell)=>boolean;
}
export const isHabitatFurnitureKind=(value:unknown):value is HabitatFurnitureKind=>typeof value==='string'&&(HABITAT_FURNITURE_KINDS as readonly string[]).includes(value);
export const isFurnitureQuality=(value:unknown):value is FurnitureQuality=>typeof value==='string'&&(FURNITURE_QUALITIES as readonly string[]).includes(value);
export const isFurnitureMaterial=(value:unknown):value is FurnitureMaterial=>typeof value==='string'&&Object.hasOwn(FURNITURE_MATERIALS,value);
/** Legacy structures had normal quality by contract; an unknown future value
 * is not silently accepted by serialization, but pure stat reads stay neutral. */
export const furnitureQuality=(value:unknown):FurnitureQuality=>isFurnitureQuality(value)?value:'normal';

export function materialAllowed(kind:HabitatFurnitureKind,value:unknown):value is FurnitureMaterial {
  if(!isFurnitureMaterial(value))return false;
  return FURNITURE_DEFINITIONS[kind].categories.includes(FURNITURE_MATERIALS[value].category);
}
export function furnitureWorkToBuildCore(kind:HabitatFurnitureKind,materialName:FurnitureMaterial):number {
  const d=FURNITURE_DEFINITIONS[kind],m=FURNITURE_MATERIALS[materialName];return d.coreWork*m.workFactor+m.workOffset;
}
export function furnitureMaxHitPoints(kind:HabitatFurnitureKind,materialName:FurnitureMaterial):number {
  return FURNITURE_DEFINITIONS[kind].maxHitPoints*FURNITURE_MATERIALS[materialName].hitPointsFactor;
}
/** Schema 311: Core Beauty finalisation. The stuff factor applies to a positive
 * base only, the stuff offset is added, the quality factor applies to a
 * positive value only, then the value is rounded (midpoint to even) and, above
 * 100, to the nearest multiple of five. */
export function roundCoreBeauty311(value:number):number {
  const even=(x:number)=>{const f=Math.floor(x);return x-f===.5?(f%2===0?f:f+1):Math.round(x);};
  const v=even(value);return v>100?5*even(v/5):v;
}
export const coreBeauty311=(base:number,factor:number,offset:number,quality:number):number=>{
  let v=base>0?base*factor:base;v+=offset;if(v>0)v*=quality;return roundCoreBeauty311(v);
};
/** Core stuff Beauty factors that the furniture table had at 1 before 311. */
const BEAUTY_FACTOR311:Readonly<Record<string,number>>=Object.freeze({'marble-blocks':1.35,'sandstone-blocks':1.1,'slate-blocks':1.1});
export const furnitureBeautyFactor311=(material:unknown,version:number):number=>
  Number(version)>=311&&typeof material==='string'&&Object.hasOwn(BEAUTY_FACTOR311,material)?BEAUTY_FACTOR311[material]!:isFurnitureMaterial(material)?FURNITURE_MATERIALS[material].beautyFactor:1;
export function furnitureBeauty(value:FurnitureLike,version:number=SCHEMA_VERSION):number {
  if(!isHabitatFurnitureKind(value.kind))return 0;
  if(Number(version)>=311){
    // Core: shelves have Beauty 0.5 (ShelfBase), the hospital bed has none.
    const base=value.kind==='shelf'||value.kind==='small-shelf'?.5:value.kind==='hospital-bed'?0:FURNITURE_DEFINITIONS[value.kind].beauty;
    const m=isFurnitureMaterial(value.material)?FURNITURE_MATERIALS[value.material]:undefined;
    return coreBeauty311(base,furnitureBeautyFactor311(value.material,version),m?.beautyOffset??0,QUALITY_BEAUTY[furnitureQuality(value.quality)]);
  }
  const base=FURNITURE_DEFINITIONS[value.kind].beauty,m=isFurnitureMaterial(value.material)?FURNITURE_MATERIALS[value.material]:undefined;
  const scaled=base>0?base*(m?.beautyFactor??1)*QUALITY_BEAUTY[furnitureQuality(value.quality)]:base;
  return scaled+(m?.beautyOffset??0);
}
export function seatComfort(value:FurnitureLike):number {
  if(!isHabitatFurnitureKind(value.kind))return 0;
  const base=FURNITURE_DEFINITIONS[value.kind].comfort;return base===undefined?0:base*QUALITY_COMFORT[furnitureQuality(value.quality)];
}

export interface BedFacilities {endTable?:boolean;dresser?:boolean}
export const bedFacilityOffset=(facilities:BedFacilities={}):number=>(facilities.endTable?.05:0)+(facilities.dresser?.05:0);
export function bedComfort(value:FurnitureLike,facilities:BedFacilities={}):number {
  if(!isBedKind(value.kind))return 0;
  if(value.kind==='sleeping-spot')return .4;
  return ((FURNITURE_DEFINITIONS[value.kind].comfort??0)+bedFacilityOffset(facilities))*QUALITY_COMFORT[furnitureQuality(value.quality)];
}
export const comfortNeedCeiling=(comfort:number):number=>Math.max(0,Math.min(1,comfort));
export function bedRestEffectiveness(value:FurnitureLike):number {
  if(!isBedKind(value.kind))return 0;
  if(value.kind==='sleeping-spot')return .8;
  const materialFactor=isFurnitureMaterial(value.material)?FURNITURE_MATERIALS[value.material].restFactor:1;
  return (FURNITURE_DEFINITIONS[value.kind].restEffectiveness??1)*materialFactor*QUALITY_REST[furnitureQuality(value.quality)];
}

export const cardinalToBedHead=(head:FurnitureCell,table:FurnitureCell):boolean=>Math.abs(head.x-table.x)+Math.abs(head.z-table.z)===1;
const footprintCenter=(cells:readonly FurnitureCell[]):FurnitureCell=>{
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const cell of cells){minX=Math.min(minX,cell.x);maxX=Math.max(maxX,cell.x);minZ=Math.min(minZ,cell.z);maxZ=Math.max(maxZ,cell.z);}
  return {x:(minX+maxX)/2,z:(minZ+maxZ)/2};
};
/** Core measures an unconstrained facility from the two occupied rectangles'
 * true centres. The central footprint owner supplies those cells. */
export function dresserCoversBed(bedCells:readonly FurnitureCell[],dresserCells:readonly FurnitureCell[],maxDistance=6):boolean {
  if(!bedCells.length||!dresserCells.length||!Number.isFinite(maxDistance)||maxDistance<0)return false;
  const bed=footprintCenter(bedCells),dresser=footprintCenter(dresserCells);
  return (bed.x-dresser.x)**2+(bed.z-dresser.z)**2<=maxDistance*maxDistance;
}

const DIRECTIONS=[[0,1],[1,0],[0,-1],[-1,0]] as const;
const direction=(orientation=0):readonly [number,number]=>DIRECTIONS[orientation%4]??DIRECTIONS[0];
function localCells(structure:FurnitureStructureLike):readonly FurnitureCell[] {
  if(structure.cells)return structure.cells;
  if(isBedKind(structure.kind)&&(structure.kind==='hospital-bed'||structure.footprint!=='legacy-single')){const [dx,dz]=direction(structure.orientation);return [structure,{x:structure.x+dx,z:structure.z+dz}];}
  if(structure.kind==='dresser'){const [dx,dz]=direction(((structure.orientation??0)+1)%4);return [structure,{x:structure.x+dx,z:structure.z+dz}];}
  return [structure];
}
/** Integration helper: only the structure actually occupied is comfortable.
 * The optional cellsOf callback lets the central footprint owner override the
 * local V90 fallback without importing engine types here. */
export function comfortForStructure(world:FurnitureWorldLike,structure:FurnitureStructureLike):number {
  if(structure.kind==='sleeping-spot')return .4;
  if(!isBedKind(structure.kind))return seatComfort(structure);
  const cellsOf=world.cellsOf??localCells,bedCells=cellsOf(structure),head=bedCells[0]??structure;
  const visible=(facilityCells:readonly FurnitureCell[])=>!world.lineOfSight||bedCells.some(b=>facilityCells.some(f=>world.lineOfSight!(b,f)));
  const endTable=world.structures.some(candidate=>{if(candidate.kind!=='end-table')return false;const cells=cellsOf(candidate);return cardinalToBedHead(head,cells[0]??candidate)&&visible(cells);});
  const dresser=world.structures.some(candidate=>{if(candidate.kind!=='dresser')return false;const cells=cellsOf(candidate);return dresserCoversBed(bedCells,cells)&&visible(cells);});
  return bedComfort(structure,{endTable,dresser});
}
