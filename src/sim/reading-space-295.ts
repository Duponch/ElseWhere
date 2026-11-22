import {isNovelBook295,NOVEL_MAX_HIT_POINTS_295} from './book-state-295.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {knownCell256} from './exploration-visibility-256.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {reservedSource} from './materials.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {captureStandability,canStandAt} from './furniture-travel.ts';
import {deconstructionReserved} from './deconstruction-rules.ts';
import {isDiningSeat,isDiningTable,adjacentTable,seatAt,seatCells} from './dining.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {footprintCells} from './definitions.ts';
import {storageCells,storageAt} from './shelf-storage.ts';
import {storageCapacity} from './ground-placement.ts';
import {cellIndex,inBounds,routeToCell} from './pathfinding.ts';
import {firePosition} from './fire-rules.ts';
import type {ReadingTask295} from './reading-state-295.ts';
import type {NeedContext} from './needs.ts';
import type {Cell,MaterialPile,Pawn,World} from './types.ts';

const same=(a:Cell,b:Cell):boolean=>a.x===b.x&&a.z===b.z;
const distance=(a:Cell,b:Cell):number=>(a.x-b.x)**2+(a.z-b.z)**2;
const around=(c:Cell):Cell[]=>[{x:c.x,z:c.z},{x:c.x,z:c.z-1},{x:c.x+1,z:c.z},{x:c.x,z:c.z+1},{x:c.x-1,z:c.z}];
const books=new WeakMap<World,Map<number,{source:MaterialPile[];index:number;pile:MaterialPile}>>();
/** Cache is an address hint, never ownership. Exact array slot is checked on
 * every use, including in-place splice/replacement at unchanged array length. */
export function readingPile295(world:World,id:number):MaterialPile|undefined {
 let index=books.get(world);if(!index){index=new Map();books.set(world,index);}
 const old=index.get(id);
 if(old&&old.source===world.piles&&world.piles[old.index]===old.pile&&old.pile.id===id)return old.pile;
 const at=world.piles.findIndex(p=>p.id===id);if(at<0){index.delete(id);return;}
 const pile=world.piles[at]!;
 if(!index.has(id)&&index.size>=64)index.delete(index.keys().next().value!);
 index.set(id,{source:world.piles,index:at,pile});return pile;
}
export const readableNovel295=(pile:MaterialPile):boolean=>pile.kind==='book'&&pile.item==='novel'&&pile.quantity===1&&isNovelBook295(pile.book)&&(pile.damage??0)<NOVEL_MAX_HIT_POINTS_295;
export function readingBook295(world:World,pawn:Pawn,task:ReadingTask295):MaterialPile|undefined {
 const pile=readingPile295(world,task.bookId);if(!pile||!readableNovel295(pile)||!materialAllowedForPlayer256(pile))return;
 if(task.stage==='pickup')return pile.owner.type==='ground'||(pile.owner.type==='inventory'||pile.owner.type==='pawn')&&pile.owner.pawnId===pawn.id?pile:undefined;
 return pile.owner.type==='pawn'&&pile.owner.pawnId===pawn.id?pile:undefined;
}
export function readingSourceAllowed295(world:World,pawn:Pawn,pile:MaterialPile,manual=false):boolean {
 if(!readableNovel295(pile)||!materialAllowedForPlayer256(pile)||reservedSource(world,pile.id,pawn.id)>0)return false;
 return pile.owner.type==='ground'?allowedAreaAllows(world,pawn,pile.owner)&&knownCell256(world,cellIndex(world,pile.owner.x,pile.owner.z))
  :manual&&(pile.owner.type==='inventory'||pile.owner.type==='pawn')&&pile.owner.pawnId===pawn.id;
}
const fireCells=(world:World):Set<number>=>new Set((world.fires?.items??[]).flatMap(f=>{const c=firePosition(world,f);return c?[cellIndex(world,c.x,c.z)]:[];}));
export function readingPickupCandidates295(world:World,pawn:Pawn,bookId?:number):ReadingTask295[] {
 const candidates:ReadingTask295[]=[],standable=captureStandability(world),reserved=reservedServiceCells(world,pawn.id),fires=fireCells(world);
 const piles=bookId===undefined?world.piles:[readingPile295(world,bookId)].filter((p):p is MaterialPile=>!!p);
 for(const pile of piles){
  if(!readingSourceAllowed295(world,pawn,pile,bookId!==undefined))continue;
  const source=pile.owner.type==='ground'?pile.owner:pawn;
  for(const target of around(source))if(inBounds(world,target.x,target.z)&&standable(target)&&!fires.has(cellIndex(world,target.x,target.z))&&!reserved.has(cellIndex(world,target.x,target.z)))
   candidates.push({activity:'read',bookId:pile.id,stage:'pickup',phase:'travel',target,buildingId:null,elapsed:0,...bookId!==undefined?{manual:true as const}:{}});
 }
 return candidates;
}
export function readingTaskSiteValid295(world:World,task:ReadingTask295):boolean {
 if(!inBounds(world,task.target.x,task.target.z))return false;
 if((world.fires?.items??[]).some(f=>{const c=firePosition(world,f);return !!c&&same(c,task.target);}))return false;
 if(task.stage==='return')return task.phase==='active'||!!storageAt(world,task.target);
 if(!canStandAt(world,task.target))return false;
 if(task.stage==='pickup')return true;
 if(task.seatId!==undefined&&!world.structures.some(s=>s.id===task.seatId&&seatAt(s,task.target)&&isDiningSeat(s.kind)&&targetBuildingPlayerUse263(world,s)&&!deconstructionReserved(world,s.id)))return false;
 return task.buildingId===null||adjacentTable(world,task.target)?.id===task.buildingId;
}
export interface ReadingPlace295 {target:Cell;buildingId:number|null;seatId?:number;path:Cell[]}
/** None means budget deferred, not unreachable. Empty seats fall back to a
 * real nearby surface, then the current standing place; never a remote chair. */
export function chooseReadingPlace295(world:World,pawn:Pawn,context:NeedContext):ReadingPlace295|null {
 const standable=captureStandability(world),reserved=reservedServiceCells(world,pawn.id),fires=fireCells(world),key=(c:Cell)=>cellIndex(world,c.x,c.z);
 const valid=(c:Cell)=>inBounds(world,c.x,c.z)&&standable(c)&&allowedAreaAllows(world,pawn,c)&&!reserved.has(key(c))&&!fires.has(key(c));
 // Schema 365: a couch offers each of its two cells as a seat.
 const seats=world.structures.flatMap(s=>!isDiningSeat(s.kind)||!targetBuildingPlayerUse263(world,s)||deconstructionReserved(world,s.id,pawn.id)?[]:seatCells(s).filter(c=>distance(pawn,c)<=32**2&&valid(c))
  .map(c=>({target:{x:c.x,z:c.z},seatId:s.id,buildingId:adjacentTable(world,c)?.id??null})));
 const surfaces:Omit<ReadingPlace295,'path'>[]=[];
 for(const s of world.structures)if(isDiningTable(s.kind)&&targetBuildingPlayerUse263(world,s)&&!deconstructionReserved(world,s.id,pawn.id)&&distance(pawn,s)<=32**2)
  for(const cell of footprintCells(s))for(const target of around(cell).slice(1))if(valid(target))surfaces.push({target,buildingId:s.id});
 const candidates=[...seats,...surfaces,...(valid(pawn)?[{target:{x:pawn.x,z:pawn.z},buildingId:null}]:[])];
 if(!candidates.length)return {target:{x:pawn.x,z:pawn.z},buildingId:null,path:[]};
 let reach:ReturnType<NeedContext['search']>|undefined;
 for(const group of [seats,surfaces,candidates.slice(seats.length+surfaces.length)]){
  if(!group.length)continue;
  reach??=context.search(new Set(group.map(c=>key(c.target))));if(!reach)return null;
  const settled=reach;
  const reachable=group.flatMap(c=>{const path=routeToCell(world,c.target,settled);return path?[{...c,path}]:[];});
  reachable.sort((a,b)=>a.path.length-b.path.length||key(a.target)-key(b.target));if(reachable.length)return reachable[0]!;
 }
 return {target:{x:pawn.x,z:pawn.z},buildingId:null,path:[]};
}
export function chooseReadingStorage295(world:World,pawn:Pawn,pile:MaterialPile,context:NeedContext):{target:Cell;path:Cell[]}|null|undefined {
 const standable=captureStandability(world),reserved=reservedServiceCells(world,pawn.id),fires=fireCells(world),key=(c:Cell)=>cellIndex(world,c.x,c.z);
 const candidates=storageCells(world).filter(s=>allowedAreaAllows(world,pawn,s)&&!reserved.has(key(s))&&!fires.has(key(s))&&storageCapacity(world,s,pile,pawn.id)>=1)
  .flatMap(s=>around(s).filter(c=>inBounds(world,c.x,c.z)&&standable(c)&&!reserved.has(key(c))&&!fires.has(key(c))).map(contact=>({zone:s,contact})));
 if(!candidates.length)return undefined;
 const reach=context.search(new Set(candidates.map(c=>key(c.contact))));if(!reach)return null;
 const reachable=candidates.flatMap(c=>{const path=routeToCell(world,c.contact,reach);return path?[{target:{x:c.zone.x,z:c.zone.z},path,priority:c.zone.priority}]:[];});
 reachable.sort((a,b)=>b.priority-a.priority||a.path.length-b.path.length||key(a.target)-key(b.target));return reachable[0];
}
