/** A developer import is a test campaign, never an unlocked research tree.
 * Keep the admission evidence local to the map and bound to exact original
 * placed objects. No new building/order can inherit a different owner's
 * exception. The marker belongs to the campaign and survives map abandonment.
 */
import type {Structure,StructureKind,Tile,World} from './types.ts';
import type {ResearchProject} from './research.ts';
import {footprintCells,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {PRODUCTION_RECIPES,stationAccepts,type ProductionRecipe} from './production-recipes.ts';

export const DEVELOPER_IMPORT_SCHEMA=381;
export const DEV_BUILDING_RESEARCH381:Readonly<Partial<Record<StructureKind,ResearchProject>>>=Object.freeze({
 cooler:'air-conditioning','biofuel-refinery':'biofuel-refining','drug-lab':'drug-production',
 'hydroponics-basin':'hydroponics',battery:'batteries','solar-generator':'solar-power',
 'dining-chair':'complex-furniture',armchair:'complex-furniture','end-table':'complex-furniture',dresser:'complex-furniture',
 vent:'complex-furniture','chess-table':'complex-furniture','billiards-table':'complex-furniture','poker-table':'complex-furniture',
 'tool-cabinet':'complex-furniture',couch:'complex-furniture','machining-table':'machining',
 'hi-tech-research-bench':'microelectronics','orbital-beacon':'microelectronics','comms-console':'microelectronics',
 'multi-analyzer':'multi-analyzer','fabrication-bench':'fabrication',autodoor:'autodoors','mini-turret':'gun-turrets',
 'tube-television':'tube-television','hospital-bed':'hospital-bed','vitals-monitor':'vitals-monitor',
 'deep-drill':'deep-drilling','ground-scanner':'ground-scanner','geothermal-generator':'geothermal-power',
 'tailor-bench':'complex-clothing','electric-tailor-bench':'complex-clothing',
});
export interface DevConcreteCell381 {index:number;terrain:'sand'|'soft-sand';floor:'ancient-concrete'}
export type DevBuildingPose381=Pick<Structure,'id'|'kind'|'x'|'z'|'orientation'|'footprint'|'material'>;
export interface DevBuilding381 extends DevBuildingPose381 {research?:ResearchProject;support?:DevConcreteCell381[]}
export interface DevCrop381 {id:number;plant:'devilstrand';cells:number[]}
/** An existing order, not an unlocked production recipe. Its owner/recipe/ID
 * cannot be inherited by a different station or by a new/copy-pasted order. */
export interface DevBill381 {id:number;recipe:ProductionRecipe;station:DevBuildingPose381}
export interface DevPlacements381 {revision:1;floors:DevConcreteCell381[];buildings:DevBuilding381[];crops:DevCrop381[];bills?:DevBill381[]}

type DevReader=Partial<Pick<World,'developerTest381'|'developerPlacements381'|'structures'>>&{schemaVersion?:number};
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>
 required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&[...required,...optional].includes(k)&&
  Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value')&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true);
const dense=(v:unknown):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d?.enumerable&&Object.hasOwn(d,'value'));
const evidence=(w:DevReader):DevPlacements381|undefined=>Number(w.schemaVersion)>=DEVELOPER_IMPORT_SCHEMA&&w.developerTest381===true?w.developerPlacements381:undefined;

/** Only actual Core-placed concrete, not arbitrary impassable or unknown
 * terrain. Grave placement on installed concrete is a separate exception. */
export const devConcreteCell381=(tile:Pick<Tile,'terrain'|'floor'|'bridge'|'mineable'|'collapsedRock'>,index:number):DevConcreteCell381|undefined=>
 (tile.terrain==='sand'||tile.terrain==='soft-sand')&&tile.floor==='ancient-concrete'&&!tile.bridge&&!tile.mineable&&!tile.collapsedRock?
 {index,terrain:tile.terrain,floor:tile.floor}:undefined;
const matches=(row:DevConcreteCell381,tile:Parameters<typeof devConcreteCell381>[0],index:number)=>row.index===index&&row.terrain===tile.terrain&&devConcreteCell381(tile,index)!==undefined;
export const developerFloorException381=(w:DevReader,index:number,tile:Parameters<typeof devConcreteCell381>[0]):boolean=>
 !!evidence(w)?.floors.some(row=>matches(row,tile,index));
const samePose=(p:DevBuildingPose381,s:DevBuildingPose381)=>
 p.id===s.id&&p.kind===s.kind&&p.x===s.x&&p.z===s.z&&p.orientation===s.orientation&&p.footprint===s.footprint&&p.material===s.material;
const placed=(w:DevReader,s:unknown):DevBuilding381|undefined=>{
 const rows=evidence(w)?.buildings;if(!rows||!record(s)||!w.structures?.includes(s as unknown as Structure))return undefined;
 // Only installed records with their original pose/material are eligible;
 // a new construction job has a fresh ID and cannot borrow this authority.
 return rows.find(row=>samePose(row,s as unknown as DevBuildingPose381));
};
export const developerResearchPlacement381=(w:DevReader,s:unknown):boolean=>!!placed(w,s)?.research;
export const developerSupportPlacement381=(w:DevReader,s:Structure,index:number,tile:Parameters<typeof devConcreteCell381>[0]):boolean=>
 !!placed(w,s)?.support?.some(row=>matches(row,tile,index));
export const developerCropPlacement381=(w:DevReader,z:World['growingZones'][number]):boolean=>
 !!evidence(w)?.crops.some(row=>row.id===z.id&&row.plant===z.plant&&z.cells.every(c=>row.cells.includes(c)));
export const developerBillPlacement381=(w:DevReader,s:unknown,b:unknown):boolean=>{
 const rows=evidence(w)?.bills;if(!rows||!record(s)||!record(b)||!w.structures?.includes(s as unknown as Structure)
  ||!Array.isArray(s.bills)||!s.bills.includes(b))return false;
 return rows.some(row=>row.id===b.id&&row.recipe===b.recipe&&samePose(row.station,s as unknown as DevBuildingPose381));
};
/** Research validators can exempt individual imported bills while retaining
 * all their checks on actual tasks, workpieces and queued orders. */
export function unadmittedRecipeBill381<T extends {recipe:string}>(w:DevReader,s:{bills?:readonly T[]},accept:(b:T)=>boolean):boolean {
 if(w.developerTest381!==true)return !!s.bills?.some(accept);
 return !!s.bills?.some(b=>accept(b)&&!developerBillPlacement381(w,s,b));
}

/** Validate raw shape separately from the ordinary owner/geometry/reference
 * checks. Evidence may outlive demolished original entities, but never
 * changes a different ID, material, facing, floor or crop's admission.
 */
export function validDeveloperPlacements381(w:DevReader&Partial<Pick<World,'width'|'height'|'nextId'>>,version:number):boolean {
 try{
  if(Object.hasOwn(w,'developerTest381')&&(version<DEVELOPER_IMPORT_SCHEMA||w.developerTest381!==true))return false;
  if(!Object.hasOwn(w,'developerPlacements381'))return true;
  if(version<DEVELOPER_IMPORT_SCHEMA||w.developerTest381!==true||!int(w.width,1,400)||!int(w.height,1,400)||!int(w.nextId,1,Number.MAX_SAFE_INTEGER))return false;
  const p:unknown=w.developerPlacements381,max=w.width*w.height-1,next=w.nextId;
  if(!record(p)||!keys(p,['revision','floors','buildings','crops'],['bills'])||p.revision!==1||!dense(p.floors)||!dense(p.buildings)||!dense(p.crops)||p.floors.length>max+1||p.buildings.length>next||p.crops.length>next
    ||Object.hasOwn(p,'bills')&&(!dense(p.bills)||!p.bills.length||p.bills.length>next))return false;
  const validPose=(v:unknown):v is DevBuildingPose381=>record(v)&&keys(v,['id','kind','x','z','orientation','footprint'],['material'])
    &&int(v.id,1,next-1)&&typeof v.kind==='string'&&Object.hasOwn(STRUCTURE_DEFINITIONS,v.kind)
    &&int(v.x,0,w.width!-1)&&int(v.z,0,w.height!-1)&&int(v.orientation,0,3)&&v.footprint==='standard'
    &&(!Object.hasOwn(v,'material')||typeof v.material==='string');
  const validCell=(v:unknown):v is DevConcreteCell381=>record(v)&&keys(v,['index','terrain','floor'])&&int(v.index,0,max)&&['sand','soft-sand'].includes(String(v.terrain))&&v.floor==='ancient-concrete';
  const floorIndices=new Set<number>(),ids=new Set<number>();
  for(const row of p.floors){if(!validCell(row)||row.terrain!=='soft-sand'||floorIndices.has(row.index))return false;floorIndices.add(row.index);}
  for(const row of p.buildings){
   if(!record(row)||!keys(row,['id','kind','x','z','orientation','footprint'],['material','research','support'])||
     !int(row.id,1,next-1)||ids.has(row.id)||typeof row.kind!=='string'||!Object.hasOwn(STRUCTURE_DEFINITIONS,row.kind)
      ||!int(row.x,0,w.width-1)||!int(row.z,0,w.height-1)||!int(row.orientation,0,3)||row.footprint!=='standard'
      ||Object.hasOwn(row,'material')&&typeof row.material!=='string'||row.research===undefined&&row.support===undefined)return false;
   ids.add(row.id);
   if(Object.hasOwn(row,'research')&&(!row.research||row.research!==DEV_BUILDING_RESEARCH381[row.kind as StructureKind]))return false;
   if(Object.hasOwn(row,'support')){
    if(!dense(row.support)||!row.support.length)return false;
    const cells=new Set(footprintCells(row as unknown as Structure).map(c=>c.z*w.width!+c.x)),seen=new Set<number>();
    for(const cell of row.support){
     if(!validCell(cell)||!cells.has(cell.index)||seen.has(cell.index)||cell.terrain==='sand'&&row.kind!=='grave')return false;
     seen.add(cell.index);
    }
   }
  }
  for(const row of p.crops){
   if(!record(row)||!keys(row,['id','plant','cells'])||!int(row.id,1,next-1)||ids.has(row.id)||row.plant!=='devilstrand'||!dense(row.cells)||
      !row.cells.length||row.cells.some(c=>!int(c,0,max))||new Set(row.cells).size!==row.cells.length)return false;
   ids.add(row.id);
  }
  if(p.bills)for(const row of p.bills as unknown[]){
   if(!record(row)||!keys(row,['id','recipe','station'])||!int(row.id,1,next-1)||ids.has(row.id)
     ||typeof row.recipe!=='string'||!Object.hasOwn(PRODUCTION_RECIPES,row.recipe)||!validPose(row.station)||row.station.id===row.id
     ||!stationAccepts(row.station,row.recipe as ProductionRecipe))return false;
   ids.add(row.id);
  }
  return true;
 }catch{return false;}
}
