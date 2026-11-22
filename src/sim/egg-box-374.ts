import {EGG_BOX_374,EGG_BOX_EXTRACT_TICKS_374,EGG_BOX_MAX_CONTENT_374,eggBoxOwner374,eggBoxScore374,isEggBoxSchema374,withinEggBoxRadius374} from './egg-box-state-374.ts';
import {ANIMAL_EGG_CONTENT_256,eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import {mergeFertilizedEgg256,type FertilizedEggState256} from './animal-egg-state-v256.ts';
import {freshRot,mergeRot} from './food-preservation.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {storageCapacity} from './ground-placement.ts';
import {refreshStock,reservedSource} from './materials.ts';
import {storageCells,storageCellAccepts,type StorageCell} from './shelf-storage.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {structuresOfKind} from './structure-navigation.ts';
import {allowedAreaAllows,allowedAreaWorkAllowed} from './allowed-area-state.ts';
import {medicalWorkRefusal,pawnBody} from './health-rules.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {workPriority} from './work-types.ts';
import {horizontalDistanceSquared} from './work-givers-rimworld.ts';
import {adjacent,routeToJob,type Reachability} from './pathfinding.ts';
import {releaseWork} from './work-release.ts';
import {CARRY_CAPACITY} from './definitions.ts';
import type {ItemId} from './items.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Cell,HaulTask,MaterialPile,Pawn,Structure,World} from './types.ts';

/** Installed egg boxes of the player (spawned, not a foreign base's). */
export function eggBoxes374(w:World):Structure[] {
 if(!isEggBoxSchema374(w.schemaVersion))return [];
 // The shared per-kind index (cached per structure membership): no full scan when there is no box.
 const boxes=structuresOfKind(w,'egg-box');
 return boxes.length?boxes.filter(s=>targetBuildingPlayerUse263(w,s)):[];
}
export const installedEggBox374=(w:World,id:number):Structure|undefined=>isEggBoxSchema374(w.schemaVersion)?w.structures.find(s=>s.id===id&&s.kind==='egg-box'&&targetBuildingPlayerUse263(w,s)):undefined;
/** CompThingContainer.ContainedThing: the eggs held by a box. */
export const eggBoxContent374=(w:Pick<World,'piles'>,boxId:number):MaterialPile|undefined=>w.piles.find(p=>p.owner.type==='egg-box374'&&p.owner.structureId===boxId);
/** CompEggContainer.Accepts(ThingDef): eggs only; an empty box takes any egg,
 * a filled one the same def while below the stack limit. Ruined eggs are
 * turned into unfertilized eggs on the tick they ruin, so a box never keeps them. */
export function eggBoxAccepts374(w:Pick<World,'piles'>,boxId:number,item:ItemId):boolean {
 if(!eggSpeciesForItem256(item))return false;
 const pile=eggBoxContent374(w,boxId);
 return !pile||pile.item===item&&pile.quantity<EGG_BOX_374.stackLimit;
}
/** A hauler extracting the content reserves the box (JobDriver_EmptyThingContainer). */
export function eggBoxClaimed374(w:World,boxId:number,exceptPawn?:number):boolean {
 const pile=eggBoxContent374(w,boxId);
 return !!pile&&w.pawns.some(p=>p.id!==exceptPawn&&p.haul?.phase==='pickup'&&p.haul.sourcePileId===pile.id);
}
/** CompEggContainer.CanEmpty (the eggs are never ruined inside, see eggBoxAccepts374). */
export const eggBoxCanEmpty374=(pile:MaterialPile|undefined):boolean=>!!pile&&pile.quantity>=EGG_BOX_374.minCountToEmpty;

/** JobGiver_LayEgg.GetBestEggBox for an animal of the player (a domestic
 * animal): the usable boxes within 30 cells and their priority. The route
 * reader keeps the highest priority, then the smallest squared distance, then
 * the cheapest path (the region search order is not reproduced). */
export interface EggBoxLayChoice374 {goals:Cell[];rank:(c:Cell)=>number;boxAt:(c:Cell)=>number|undefined}
export function eggBoxLayChoice374(w:World,a:WildAnimal,item:ItemId,pen?:ReadonlySet<number>):EggBoxLayChoice374|undefined {
 if(!isEggBoxSchema374(w.schemaVersion)||!a.domestic)return;
 const byCell=new Map<number,{id:number;rank:number}>(),goals:Cell[]=[];
 for(const box of eggBoxes374(w)){
  const key=box.z*w.width+box.x;
  if(byCell.has(key)||!withinEggBoxRadius374(a,box)||pen&&!pen.has(key)||!eggBoxAccepts374(w,box.id,item)||eggBoxClaimed374(w,box.id))continue;
  const score=eggBoxScore374(eggBoxContent374(w,box.id)?.quantity??0);
  // Higher score first, then the squared distance (at most 900).
  byCell.set(key,{id:box.id,rank:(1000-score)*1000+horizontalDistanceSquared(a,box)});goals.push({x:box.x,z:box.z});
 }
 if(!goals.length)return;
 return {goals,rank:c=>byCell.get(c.z*w.width+c.x)?.rank??Infinity,boxAt:c=>byCell.get(c.z*w.width+c.x)?.id};
}
/** JobDriver_LayEgg final toil, box branch: innerContainer.TryAdd merges the
 * new stack into the held one (weighted incubation, as CompHatcher absorbs). */
export function addEggsToBox374(w:World,box:Structure,item:ItemId,quantity:number,egg:FertilizedEggState256|undefined):void {
 const pile=eggBoxContent374(w,box.id);
 if(!pile){w.piles.push({id:w.nextId++,kind:'food',item,quantity,owner:eggBoxOwner374(box.id),...egg?{egg}:{},...freshRot(item,w.tick)});return;}
 if(pile.item!==item)throw Error('Egg box holds another kind of egg.');
 // The held stack may still be at the previous tick (eggs advance after the
 // animals): the new eggs join it at that frontier, progress 0.
 if(pile.egg&&egg)pile.egg=mergeFertilizedEgg256(pile.egg,pile.quantity,{...egg,atTick:pile.egg.atTick},quantity);
 mergeRot(pile,quantity,0,w.tick);pile.quantity+=quantity;
}

const capable=(w:World,p:Pawn)=>!backgroundWorkRefusal(p,'haul')&&!medicalWorkRefusal(p)&&!p.collapsePending&&(p.faction??'colony')==='colony'&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!p.draft&&!p.stun&&!p.burning&&!p.mental?.crisis&&p.state!=='dead'&&p.state!=='downed'&&pawnBody(p).capacities.manipulation>0&&allowedAreaWorkAllowed(w,p)&&workPriority(p,'haul')>0;
/** WorkGiver_EmptyEggBox has a target: a box whose eggs may be emptied. */
export function eggBoxEmptyWanted374(w:World,p:Pawn):boolean {
 return isEggBoxSchema374(w.schemaVersion)&&workPriority(p,'haul')>0&&eggBoxes374(w).some(b=>eggBoxCanEmpty374(eggBoxContent374(w,b.id)));
}
/** StoreUtility.TryFindBestBetterStorageFor from Unstored: the highest
 * priority storage that takes the eggs, then the cell closest to the box. */
export function eggBoxStorage374(w:World,p:Pawn,pile:MaterialPile,box:Cell,reachable:(cell:StorageCell)=>boolean,allows:(cell:Cell)=>boolean=c=>allowedAreaAllows(w,p,c)):{zone:StorageCell;capacity:number}|undefined {
 let best:{zone:StorageCell;capacity:number;d:number}|undefined;
 for(const zone of storageCells(w)){
  if(best&&zone.priority<best.zone.priority)continue;
  const d=horizontalDistanceSquared(box,zone);
  if(best&&zone.priority===best.zone.priority&&(d>best.d||d===best.d&&zone.id>best.zone.id))continue;
  if(!storageCellAccepts(w,zone,pile)||!allows(zone))continue;
  const capacity=storageCapacity(w,zone,pile,p.id);
  if(capacity<=0||!reachable(zone))continue;
  best={zone,capacity,d};
 }
 return best&&{zone:best.zone,capacity:best.capacity};
}
export interface EggBoxProposal374 {boxId:number;pileId:number;quantity:number;stockpileId:number;cell:Cell;path:Cell[]}
/** WorkGiver_EmptyEggBox, closest box first (scanner order). */
export function eggBoxEmptyProposal374(w:World,p:Pawn,reach:Reachability,allows:(cell:Cell)=>boolean,storeReachable:(cell:StorageCell)=>boolean):EggBoxProposal374|undefined {
 if(!isEggBoxSchema374(w.schemaVersion)||!capable(w,p))return;
 const boxes=eggBoxes374(w).map((box,order)=>({box,order,d:horizontalDistanceSquared(p,box)})).sort((a,b)=>a.d-b.d||a.order-b.order);
 for(const {box} of boxes){
  const pile=eggBoxContent374(w,box.id);
  if(!eggBoxCanEmpty374(pile)||!allows(box)||eggBoxClaimed374(w,box.id,p.id)||reservedSource(w,pile!.id,p.id)>0)continue;
  const storage=eggBoxStorage374(w,p,pile!,box,storeReachable,allows);if(!storage)continue;
  const path=routeToJob(w,box,reach,true);if(!path)continue;
  return {boxId:box.id,pileId:pile!.id,quantity:Math.min(CARRY_CAPACITY,pile!.quantity,storage.capacity),stockpileId:storage.zone.id,cell:{x:box.x,z:box.z},path};
 }
}
/** The job reserves the box and the store cell: a hauling task whose source is
 * the held stack, with the extraction wait before the eggs are dropped. */
export function startEggBoxEmpty374(p:Pawn,proposal:EggBoxProposal374):void {
 p.haul={sourcePileId:proposal.pileId,quantity:proposal.quantity,phase:'pickup',destination:{type:'stockpile',stockpileId:proposal.stockpileId},carryPileId:null,eggBox374:0};
 p.path=proposal.path;p.state=proposal.path.length?'moving':'working';p.planCooldown=0;
}
const touching=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z||adjacent(a,b);
/** JobDriver_EmptyThingContainer up to TryDropAll: touch the box, wait 120
 * Core ticks, then every held egg is dropped near the hauler; the ordinary
 * pickup of the hauling task then carries what the task holds to storage. */
export function processEggBoxExtraction374(w:World,p:Pawn,task:HaulTask,move:(target:Cell,allowTarget:boolean)=>void):void {
 const source=w.piles.find(x=>x.id===task.sourcePileId);
 const box=source?.owner.type==='egg-box374'?installedEggBox374(w,source.owner.structureId):undefined;
 if(!source||!box||source.quantity<task.quantity||!capable(w,p)||!allowedAreaAllows(w,p,box)){releaseWork(w,p);return;}
 if(!touching(p,box)){if(task.eggBox374)task.eggBox374=0;move(box,true);return;}
 if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
 p.path=[];p.state='working';task.eggBox374=(task.eggBox374??0)+1;
 if(task.eggBox374<EGG_BOX_EXTRACT_TICKS_374)return;
 if(!dropRetainingIdentity(w,source,{x:p.x,z:p.z})){releaseWork(w,p);return;}
 delete task.eggBox374;refreshStock(w);
}
/** CompThingContainer.PostDeSpawn: the content of a removed box goes to the
 * ground near its cell, identity and count kept (preview on `view`). */
export function dropEggBoxContent374(view:World,box:Structure):number|null|undefined {
 const pile=eggBoxContent374(view,box.id);if(!pile)return undefined;
 return dropRetainingIdentity(view,pile,{x:box.x,z:box.z})?pile.id:null;
}

/** Inspector reading (CompThingContainer.CompInspectStringExtra). */
export function eggBoxInspection374(w:World,box:Structure):{label:string;quantity:number;item?:ItemId;incubation?:number}|undefined {
 if(box.kind!=='egg-box'||!isEggBoxSchema374(w.schemaVersion))return;
 const pile=eggBoxContent374(w,box.id);
 if(!pile)return {label:'Rien',quantity:0};
 return {label:pile.item,quantity:pile.quantity,item:pile.item,...pile.egg?{incubation:pile.egg.progress}:{}};
}

/** Strict validation of the held eggs and of the extraction tasks. */
export function validateEggBoxes374(w:World,version:number):string[] {
 const errors:string[]=[];
 const held=w.piles.filter(p=>p.owner.type==='egg-box374');
 const extracting=w.pawns.filter(p=>p.haul&&Object.hasOwn(p.haul,'eggBox374'));
 if(!isEggBoxSchema374(version)){
  if(held.length)errors.push('Egg box content in an older save.');
  if(extracting.length)errors.push('Egg box extraction in an older save.');
  for(const a of w.wildlife?.animals??[])if(a.eggLay&&Object.hasOwn(a.eggLay,'box374'))errors.push('Egg box laying in an older save.');
  return errors;
 }
 const seen=new Set<number>();
 for(const pile of held){
  const owner=pile.owner as {type:'egg-box374';structureId:number};
  const box=w.structures.find(s=>s.id===owner.structureId);
  const species=eggSpeciesForItem256(pile.item);
  if(!box||box.kind!=='egg-box')errors.push('Egg box content without its installed box.');
  if(seen.has(owner.structureId))errors.push('Egg box holds several stacks.');
  seen.add(owner.structureId);
  if(!species||pile.kind!=='food'||!Number.isSafeInteger(pile.quantity)||pile.quantity<1||pile.quantity>EGG_BOX_MAX_CONTENT_374||Object.hasOwn(pile,'eggForbidden')||Object.hasOwn(pile,'forbidden'))errors.push('Invalid egg box content.');
  if(species&&pile.egg&&pile.item!==ANIMAL_EGG_CONTENT_256[species].fertilizedItem)errors.push('Invalid egg box incubation.');
 }
 for(const p of extracting){
  const t=p.haul!,progress=t.eggBox374,source=w.piles.find(x=>x.id===t.sourcePileId);
  if(!Number.isSafeInteger(progress)||progress!<0||progress!>=EGG_BOX_EXTRACT_TICKS_374||t.phase!=='pickup'||t.carryPileId!==null||t.destination.type!=='stockpile'||t.whole||t.serviceProgress!==undefined||t.pickupCell!==undefined)errors.push('Invalid egg box extraction.');
  else if(!source||source.owner.type!=='egg-box374'||source.quantity<t.quantity)errors.push('Egg box extraction without its eggs.');
 }
 for(const p of w.pawns)if(p.haul?.phase==='pickup'&&!Object.hasOwn(p.haul,'eggBox374')&&w.piles.find(x=>x.id===p.haul!.sourcePileId)?.owner.type==='egg-box374')errors.push('Egg box eggs hauled without extraction.');
 for(const a of w.wildlife?.animals??[]){
  const id=a.eggLay?.box374;if(id===undefined)continue;
  const box=w.structures.find(s=>s.id===id);
  if(!Number.isSafeInteger(id)||id<1||id>=w.nextId||box&&box.kind!=='egg-box'||box&&(box.x!==a.eggLay!.target.x||box.z!==a.eggLay!.target.z))errors.push('Invalid egg box laying target.');
 }
 return errors;
}
