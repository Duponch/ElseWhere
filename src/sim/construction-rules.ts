import {isTrapKind357} from './ied-traps-357.ts';
import {shipComputerSensorsPlacementRefusal298} from './ship-computer-sensors-placement-298.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {shipCasketPlacementRefusal277} from './ship-casket-placement-277.ts';
import {isShipPartKind276} from './ship-part-content-276.ts';
import {shipPartPlacementRefusal276} from './ship-reactor-placement-275.ts';
import {isRoofed} from './roof-rules.ts';
import {geothermalPlacementRefusal264} from './geothermal-placement-264.ts';
import {marshSupportsFootprint} from './marsh.ts';
import { workPriority } from './work-types.ts';
import { constructionPlantBlocks } from './construction-plants.ts';
import { furnitureWorkTarget } from './furniture-rules.ts';
import { clearsGroundItems } from './occupancy.ts';
import { footprintCells, STRUCTURE_DEFINITIONS } from './definitions.ts';
import type { Cell, HaulDestination, Job, MaterialPile, Pawn, Resource, World } from './types.ts';
import { serviceCell } from './service-reservations.ts';
import { spikeTrapPlacementAllowed } from './spike-trap-state.ts';
import { isShelfKind,shelfFixedAccepts } from './shelf-storage.ts';
import { structureById } from './structure-navigation.ts';
import {wallLampSupported363} from './wall-lamp-363.ts';
import { resourceArrayDelta } from './resource-array-delta.ts';
import { pileIndex,pileIndexMismatch,verifyPileIndex } from './pile-index.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';

export const isConstruction = (job: Pick<Job,'kind'>): boolean => job.kind==='build-bridge'||job.kind==='install'||job.kind==='lay-floor'||job.kind in STRUCTURE_DEFINITIONS;
export const containsCell = (job: Job, cell: Cell): boolean => footprintCells(job).some(c=>c.x===cell.x&&c.z===cell.z);
/** Old saves are validated with the old solid-plan contract before migration. */
export const jobBlocksTransit = (world: World, job: Job): boolean => world.schemaVersion<16&&(job.kind==='wall'||job.kind==='table');
export const constructionWorkTarget = (world: World, job: Job): Cell => job.clearance ? world.resources.find(r=>r.id===job.clearance!.resourceId)??job : furnitureWorkTarget(world,job);
export const constructionHaulId = (destination: HaulDestination): number|undefined => destination.type==='job'?destination.jobId:destination.type==='aside'?destination.constructionId:undefined;
export const constructionHaulPriority = (pawn: Pawn): number => Math.min(workPriority(pawn,'build')||Infinity,workPriority(pawn,'haul')||Infinity);
export const asBuilder = (pawn: Pawn): boolean => workPriority(pawn,'build')>0&&workPriority(pawn,'build')<= (workPriority(pawn,'haul')||Infinity);

export interface ConstructionObstruction { plant?:Resource; pile?:MaterialPile; pack?:import('./furniture-rules.ts').PackedFurniture }
interface ConstructionSiteDirectory379 {
 readonly owner:object;readonly source:readonly Job[];readonly count:number;readonly first?:Job;readonly last?:Job;readonly width:number;readonly version:number;
 readonly sites:Map<number,number[]>;readonly ids:readonly number[];readonly clearItems:Set<number>;readonly shelves:Set<number>;readonly jobs:Map<number,Job>;
}
const constructionSiteDirectories379=new WeakMap<readonly Job[],ConstructionSiteDirectory379>();
const constructionSiteWork={geometryBuilds:0,footprints:0,groundScans:0,indexedGroundReads:0};
export const constructionSiteWork379=()=>({...constructionSiteWork});
/** Construction footprint topology belongs to the actual jobs collection,
 * not to the actor who happens to plan a task. Every live geometry writer
 * creates a new job, appends it, or replaces the jobs array; status, progress,
 * reservation and blueprint→frame transitions never move a footprint. A
 * public observation revokes the directory. Partial/ad-hoc candidates use
 * their own one-shot directory. Mutable resource and pile state stays live. */
function constructionSites379(world:World,candidates:readonly Job[],owner:object):ConstructionSiteDirectory379 {
 const source=world.jobs,cached=candidates===source?constructionSiteDirectories379.get(source):undefined;
 if(cached&&cached.owner===owner&&cached.count===source.length&&cached.first===source[0]&&cached.last===source[source.length-1]&&cached.width===world.width&&cached.version===world.schemaVersion)return cached;
 const sites=new Map<number,number[]>(),ids=new Set<number>(),clearItems=new Set<number>(),shelves=new Set<number>(),jobs=new Map<number,Job>();
 for(const job of source)if(!jobs.has(job.id))jobs.set(job.id,job);
 for(const job of candidates)if(isConstruction(job)){
  ids.add(job.id);if(clearsGroundItems(world,job.furniture?.kind??job.kind))clearItems.add(job.id);
  if(isShelfKind(job.furniture?.kind??job.kind))shelves.add(job.id);
  for(const c of footprintCells(job)){const cell=c.z*world.width+c.x,rows=sites.get(cell);if(rows)rows.push(job.id);else sites.set(cell,[job.id]);}
  constructionSiteWork.footprints++;
 }
 const next={owner,source,count:source.length,first:source[0],last:source[source.length-1],width:world.width,version:world.schemaVersion,sites,ids:[...ids],clearItems,shelves,jobs};
 if(candidates===source)constructionSiteDirectories379.set(source,next);
 constructionSiteWork.geometryBuilds++;return next;
}
/** Query only the physical footprint cells of real plans. Each cell's pile
 * list is in original order. Most plans contain no blocker; a multi-cell plan
 * with a different blocker in two cells uses one exact shared source-order
 * merge. Invalid out-of-map piles keep the original scalar scan. */
function constructionGroundObstructions379(world:World,sites:ReadonlyMap<number,number[]>,clearItems:ReadonlySet<number>,shelves:ReadonlySet<number>,result:Map<number,ConstructionObstruction>):void {
 const index=pileIndex(world);
 if(!index||index.groundOutside){constructionSiteWork.groundScans++;for(const pile of world.piles)if(pile.owner.type==='ground')for(const id of sites.get(pile.owner.z*world.width+pile.owner.x)??[])if(clearItems.has(id)&&(!shelves.has(id)||!shelfFixedAccepts(pile)))result.get(id)!.pile??=pile;return;}
 constructionSiteWork.indexedGroundReads++;
 let ambiguous:Map<number,Set<MaterialPile>>|undefined;
 for(const [cell,ids] of sites){const rows=index.groundAt.get(cell);if(!rows?.length)continue;
  for(const id of ids)if(clearItems.has(id)){
   const choice=shelves.has(id)?rows.find(p=>!shelfFixedAccepts(p)):rows[0];if(!choice)continue;
   const row=result.get(id)!,previous=row.pile;
   if(!previous)row.pile=choice;
   else if(previous!==choice){let options=ambiguous?.get(id);if(!options){options=new Set([previous]);(ambiguous??=new Map()).set(id,options);}options.add(choice);}
  }
 }
 if(ambiguous?.size){
  constructionSiteWork.groundScans++;
  const byPile=new Map<MaterialPile,number[]>();for(const [id,options] of ambiguous)for(const pile of options){const rows=byPile.get(pile);if(rows)rows.push(id);else byPile.set(pile,[id]);}
  for(const pile of world.piles){for(const id of byPile.get(pile)??[])if(ambiguous.delete(id))result.get(id)!.pile=pile;if(!ambiguous.size)break;}
 }
}
/** One synchronous planner decision. Keep array ordering for multi-cell sites,
 * and discard this index before any transfer, cutting or construction occurs.
 * Small plants are not blockers; their Frame/final destruction is committed
 * separately after the physical placement and custody preflight succeeds. */
export function constructionObstructions(world:World,candidates:readonly Job[]=world.jobs):ReadonlyMap<number,ConstructionObstruction> {
  const owner=terrainJournalReadOwner();
  if(!owner){retireResourceCellIndex379(world);constructionSiteDirectories379.delete(world.jobs);return scanConstructionObstructions(world,candidates);}
  const resources=resourceCellIndex(world);if(!resources.unique)return scanConstructionObstructions(world,candidates);
  const {sites,ids,clearItems,shelves,jobs}=constructionSites379(world,candidates,owner),result=new Map<number,ConstructionObstruction>();
  for(const id of ids)result.set(id,{});
  if(!sites.size)return result;
  // Query only the footprint cells. A resident source ordinal chooses the
  // same first plant across a multi-cell footprint as the old whole-array walk.
  const selected=new Map<number,number>();
  for(const [cell,ids] of sites)for(const resource of resources.byCell.get(cell)??[])for(const id of ids)if(constructionPlantBlocks(jobs.get(id)!,resource)){
    const order=resources.order.get(resource)!;if(order<(selected.get(id)??Infinity)){selected.set(id,order);result.get(id)!.plant=resource;}
  }
  constructionGroundObstructions379(world,sites,clearItems,shelves,result);
  for(const pack of world.packed??[])if(pack.owner.type==='ground')for(const id of sites.get(pack.owner.z*world.width+pack.owner.x)??[])if(clearItems.has(id)&&jobs.get(id)?.furniture?.structureId!==pack.building.id)result.get(id)!.pack??=pack;
  if(verifyTerrainWriteCaches){const expected=scanConstructionObstructions(world,candidates);if(expected.size!==result.size)throw Error('Construction obstruction directory changed membership');for(const [id,row] of expected){const actual=result.get(id);if(!actual||row.plant!==actual.plant||row.pile!==actual.pile||row.pack!==actual.pack)throw Error('Construction obstruction directory changed source order');}}
  return result;
}
function scanConstructionObstructions(world:World,candidates:readonly Job[]):ReadonlyMap<number,ConstructionObstruction> {
  const sites=new Map<number,number[]>(),result=new Map<number,ConstructionObstruction>(),clearItems=new Set<number>(),shelves=new Set<number>();
  for(const job of candidates)if(isConstruction(job)) {
    result.set(job.id,{});if(clearsGroundItems(world,job.furniture?.kind??job.kind))clearItems.add(job.id);
    if(isShelfKind(job.furniture?.kind??job.kind))shelves.add(job.id);
    for(const c of footprintCells(job)) {
      const cell=c.z*world.width+c.x,ids=sites.get(cell)??[];
      ids.push(job.id);sites.set(cell,ids);
    }
  }
  if(!sites.size)return result;
  for(const resource of world.resources)for(const id of sites.get(resource.z*world.width+resource.x)??[])if(constructionPlantBlocks(world.jobs.find(j=>j.id===id)!,resource))result.get(id)!.plant??=resource;
  for(const pile of world.piles)if(pile.owner.type==='ground')for(const id of sites.get(pile.owner.z*world.width+pile.owner.x)??[])if(clearItems.has(id)&&(!shelves.has(id)||!shelfFixedAccepts(pile)))result.get(id)!.pile??=pile;
  for(const pack of world.packed??[])if(pack.owner.type==='ground')for(const id of sites.get(pack.owner.z*world.width+pack.owner.x)??[])if(clearItems.has(id)&&world.jobs.find(j=>j.id===id)?.furniture?.structureId!==pack.building.id)result.get(id)!.pack??=pack;
  return result;
}
type ResourceCellIndex={length:number;readonly owner:object|undefined;readonly width:number;readonly byCell:Map<number,Resource[]>;readonly order:Map<Resource,number>;nextOrder:number;readonly unique:boolean};
const resourceCellIndexes=new WeakMap<readonly Resource[],ResourceCellIndex>();
/** The list whose index was last built or derived (deriving moves it on). */
let lastResourceList:readonly Resource[]|undefined;
function retireResourceCellIndex379(world:World):void {resourceCellIndexes.delete(world.resources);if(lastResourceList===world.resources)lastResourceList=undefined;}
const RESOURCE_CELL_DELTA_LIMIT=256;
function buildResourceCellIndex(list:readonly Resource[],width:number):ResourceCellIndex {
  const byCell=new Map<number,Resource[]>(),order=new Map<Resource,number>();let unique=true;
  for(let i=0;i<list.length;i++){const r=list[i]!,key=r.z*width+r.x,at=byCell.get(key);if(at)at.push(r);else byCell.set(key,[r]);if(order.has(r))unique=false;else order.set(r,i);}
  return {length:list.length,owner:terrainJournalReadOwner(),width,byCell,order,nextOrder:list.length,unique};
}
/** Moves the index of `previous` to `next` when `next` is `previous` with some
 * resources dropped and new ones appended (resourceArrayDelta): each cell
 * list keeps array order. Validated before any change; false leaves it intact. */
function deriveResourceCellIndex(previous:readonly Resource[],index:ResourceCellIndex,next:readonly Resource[]):boolean {
  const width=index.width;if(previous.length!==index.length)return false;
  const delta=resourceArrayDelta(previous,next,RESOURCE_CELL_DELTA_LIMIT);if(!delta)return false;
  if(!index.unique||!Number.isSafeInteger(index.nextOrder+next.length-delta.appendedFrom))return false;
  const removed=new Set(delta.removed),added=new Set<Resource>();
  for(let k=delta.appendedFrom;k<next.length;k++){const r=next[k]!;if(index.order.has(r)&&!removed.has(r)||added.has(r))return false;added.add(r);}
  for(const r of delta.removed){const at=index.byCell.get(r.z*width+r.x);if(!at||!at.includes(r))return false;}
  for(const r of delta.removed){const key=r.z*width+r.x,at=index.byCell.get(key)!;at.splice(at.indexOf(r),1);if(!at.length)index.byCell.delete(key);index.order.delete(r);}
  for(let k=delta.appendedFrom;k<next.length;k++){const r=next[k]!,key=r.z*width+r.x,at=index.byCell.get(key);if(at)at.push(r);else index.byCell.set(key,[r]);index.order.set(r,index.nextOrder++);}
  index.length=next.length;resourceCellIndexes.delete(previous);resourceCellIndexes.set(next,index);
  return true;
}
function resourceCellIndex(world:World):ResourceCellIndex {
  const list=world.resources,width=world.width,owner=terrainJournalReadOwner();let index=resourceCellIndexes.get(list);
  if(index&&index.owner===owner&&index.length===list.length&&index.width===width)return index;
  const previous=lastResourceList,old=previous&&previous!==list?resourceCellIndexes.get(previous):undefined;
  if(!index&&previous&&old&&old.owner===owner&&old.width===width&&deriveResourceCellIndex(previous,old,list))index=old;
  else {index=buildResourceCellIndex(list,width);resourceCellIndexes.set(list,index);}
  lastResourceList=list;return index;
}
/** The first resource, in array order, whose cell key `z*width+x` is one of
 * the keys and that is accepted: the same answer as `world.resources.find`
 * with that key test. Indexed per resources array, which a running World
 * replaces instead of editing in place; a resource never moves. */
function firstResourceAt(world:World,keys:ReadonlySet<number>,accept:(resource:Resource)=>boolean):Resource|undefined {
  if(!terrainJournalReadOwner()){retireResourceCellIndex379(world);return world.resources.find(r=>keys.has(r.z*world.width+r.x)&&accept(r));}
  const index=resourceCellIndex(world);
  let found:Resource|undefined,several:Set<Resource>|undefined;
  for(const key of keys)for(const r of index.byCell.get(key)??[])if(accept(r)){if(found)(several??=new Set([found])).add(r);else found=r;break;}
  // Several cells hold one: the first of them in array order.
  if(several)for(const r of world.resources)if(several.has(r))return r;
  return found;
}
/** The first ground pile, in array order, on one of the keys `z*width+x` and
 * accepted: `world.piles.find` with that test, read from the pile index. */
function firstGroundPileAt(world:World,keys:ReadonlySet<number>,accept:(pile:MaterialPile)=>boolean):MaterialPile|undefined {
  const scan=()=>world.piles.find(p=>p.owner.type==='ground'&&keys.has(p.owner.z*world.width+p.owner.x)&&accept(p));
  const index=pileIndex(world);if(!index||index.groundOutside)return scan();
  let found:MaterialPile|undefined,several:Set<MaterialPile>|undefined;
  for(const key of keys)for(const p of index.groundAt.get(key)??[])if(accept(p)){if(found)(several??=new Set([found])).add(p);else found=p;break;}
  if(several){found=undefined;for(const p of world.piles)if(several.has(p)){found=p;break;}}
  if(verifyPileIndex&&found!==scan())pileIndexMismatch('construction site pile');
  return found;
}
export function constructionObstruction(world: World, job: Job):ConstructionObstruction {
  const cells=new Set(footprintCells(job).map(c=>c.z*world.width+c.x));
  const plant=firstResourceAt(world,cells,r=>constructionPlantBlocks(job,r));
  const kind=job.furniture?.kind??job.kind;
  const pile=clearsGroundItems(world,kind)?firstGroundPileAt(world,cells,p=>!isShelfKind(kind)||!shelfFixedAccepts(p)):undefined;
  const pack=(job.kind==='sow'||clearsGroundItems(world,job.furniture?.kind??job.kind))?world.packed?.find(p=>p.owner.type==='ground'&&cells.has(p.owner.z*world.width+p.owner.x)&&p.building.id!==job.furniture?.structureId):undefined;
  return {plant,pile,pack};
}
type MotionBox = { from: Cell; to: Cell; end: number };
/** Cells that `constructionSiteFree` finds occupied by animals and pawns,
 * indexed once for a read-only scan of many jobs (one planner call), instead
 * of scanning every animal and pawn for each job. It applies exactly the same
 * conditions; motion boxes too large to enumerate are kept and tested as is. */
export class ConstructionOccupancy {
  private readonly width:number;
  private readonly height:number;
  private readonly animalCells=new Set<number>();
  private readonly animalBoxes:MotionBox[]=[];
  private readonly pawnCells=new Map<number,number[]>();
  private readonly pawnBoxes:{id:number;box:MotionBox}[]=[];
  constructor(private readonly world: World) {
    this.width=world.width;this.height=world.height;
    const tick=world.tick;
    for(const a of world.wildlife?.animals??[]){
      this.point(a.x,a.z,cell=>this.animalCells.add(cell));
      const m=a.motion;if(m&&m.end>tick&&!this.box(m,cell=>this.animalCells.add(cell)))this.animalBoxes.push(m);
    }
    for(const p of world.pawns){
      if(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))continue;
      const add=(cell:number)=>{const ids=this.pawnCells.get(cell);if(ids)ids.push(p.id);else this.pawnCells.set(cell,[p.id]);};
      this.point(p.x,p.z,add);
      const service=serviceCell(p,world);if(service)this.point(service.x,service.z,add);
      if(p.feed?.paste&&(p.feed.phase==='pickup'||p.feed.phase==='collect'))this.point(p.feed.spot.x,p.feed.spot.z,add);
      const edge=p.motion;if(edge&&edge.end>tick&&!this.box(edge,add))this.pawnBoxes.push({id:p.id,box:edge});
    }
  }
  private inside(x:number,z:number):boolean {return Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<this.width&&z<this.height;}
  /** Only an in-map integer cell can equal an in-map footprint cell. */
  private point(x:number,z:number,add:(cell:number)=>void):void {if(this.inside(x,z))add(z*this.width+x);}
  /** Every in-map integer cell of the closed box, or false when too large. */
  private box(m:MotionBox,add:(cell:number)=>void):boolean {
    const x0=Math.max(0,Math.ceil(Math.min(m.from.x,m.to.x))),x1=Math.min(this.width-1,Math.floor(Math.max(m.from.x,m.to.x)));
    const z0=Math.max(0,Math.ceil(Math.min(m.from.z,m.to.z))),z1=Math.min(this.height-1,Math.floor(Math.max(m.from.z,m.to.z)));
    if(x1>=x0&&z1>=z0&&(x1-x0+1)*(z1-z0+1)>64)return false;
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)add(z*this.width+x);
    return true;
  }
  private static within(m:MotionBox,c:Cell):boolean {return c.x>=Math.min(m.from.x,m.to.x)&&c.x<=Math.max(m.from.x,m.to.x)&&c.z>=Math.min(m.from.z,m.to.z)&&c.z<=Math.max(m.from.z,m.to.z);}
  /** Whether an animal occupies one of the cells. */
  animalOn(cells:readonly Cell[]):boolean {
    return cells.some(c=>this.inside(c.x,c.z)?this.animalCells.has(c.z*this.width+c.x)||this.animalBoxes.some(m=>ConstructionOccupancy.within(m,c)):this.directAnimal(c));
  }
  /** Whether a pawn other than the worker occupies one of the cells. */
  pawnOn(cells:readonly Cell[],workerId:number|undefined):boolean {
    return cells.some(c=>{
      if(!this.inside(c.x,c.z))return this.directPawn(c,workerId);
      const ids=this.pawnCells.get(c.z*this.width+c.x);
      return !!ids&&ids.some(id=>id!==workerId)||this.pawnBoxes.some(b=>b.id!==workerId&&ConstructionOccupancy.within(b.box,c));
    });
  }
  /** A cell outside the map keeps the original scans. */
  private directAnimal(c:Cell):boolean {
    const world=this.world;
    return !!world.wildlife?.animals.some(a=>{const m=a.motion;return a.x===c.x&&a.z===c.z||!!m&&m.end>world.tick&&ConstructionOccupancy.within(m,c);});
  }
  private directPawn(c:Cell,workerId:number|undefined):boolean {
    const world=this.world;
    return world.pawns.some(p=>p.id!==workerId&&!(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))&&pawnOnCell(world,p,c));
  }
}
function pawnOnCell(world:World,p:Pawn,c:Cell):boolean {
  const edge=p.motion;
  const service=serviceCell(p,world);
  return p.x===c.x&&p.z===c.z || service?.x===c.x&&service.z===c.z || !!(p.feed?.paste&&(p.feed.phase==='pickup'||p.feed.phase==='collect')&&p.feed.spot.x===c.x&&p.feed.spot.z===c.z) || !!edge&&edge.end>world.tick&&c.x>=Math.min(edge.from.x,edge.to.x)&&c.x<=Math.max(edge.from.x,edge.to.x)&&c.z>=Math.min(edge.from.z,edge.to.z)&&c.z<=Math.max(edge.from.z,edge.to.z);
}
/** A frame is traversable. Completion must not materialize a building across
 * a person, an active edge (including its diagonal corner), or a service.
 * `occupancy`, when given, must be captured from this same unchanged World. */
export function constructionSiteFree(world: World, job: Job, workerId?: number, obstacle=constructionObstruction(world,job), occupancy?: ConstructionOccupancy): boolean {
  if(world.schemaVersion>=382&&job.kind==='install'&&job.furniture?.kind==='wall-lamp'&&!wallLampSupported363(world,job,true))return false;
  if(isShipCasketKind277(job.kind)&&shipCasketPlacementRefusal277(world,{...job,kind:job.kind},job.id))return false;
  if(isShipComputerSensorsKind298(job.kind)&&shipComputerSensorsPlacementRefusal298(world,{...job,kind:job.kind},job.id))return false;
  if(isShipPartKind276(job.kind)&&shipPartPlacementRefusal276(world,{...job,kind:job.kind},job.id))return false;
  if(job.kind==='geothermal-generator'&&geothermalPlacementRefusal264(world,job,job.id))return false;
  if(obstacle.plant||obstacle.pile||obstacle.pack||job.kind!=='build-bridge'&&!marshSupportsFootprint(world,footprintCells(job),job.kind==='install'?{kind:job.furniture?.kind??'install',material:world.packed.find(p=>p.building.id===job.furniture?.structureId)?.building.material??structureById(world,job.furniture?.structureId)?.material}:job))return false;
  if(isTrapKind357(job.furniture?.kind??job.kind)&&!spikeTrapPlacementAllowed(
    {...world,jobs:world.jobs.filter(j=>j!==job)},job,job.furniture?.structureId))return false;
  const cells=footprintCells(job);
  // A shelf may retain ordinary floor items, but cannot acquire an engaged
  // exclusive ingredient staging cell while its owner is away gathering.
  if(isShelfKind(job.furniture?.kind??job.kind)&&world.pawns.some(p=>
    [...(p.cooking&&p.cooking.phase!=='interrupted'?p.cooking.ingredients:[]),...(p.surgery?.ingredients??[])]
      .some(i=>cells.some(c=>c.x===i.cell.x&&c.z===i.cell.z))))return false;
  if(isTrapKind357(job.furniture?.kind??job.kind)&&world.mechanoids?.some(a=>a.state!=='dead'&&cells.some(c=>{const m=a.motion;return a.x===c.x&&a.z===c.z||!!m&&m.end>world.tick&&c.x>=Math.min(m.from.x,m.to.x)&&c.x<=Math.max(m.from.x,m.to.x)&&c.z>=Math.min(m.from.z,m.to.z)&&c.z<=Math.max(m.from.z,m.to.z);})))return false;
  if(job.kind==='ground-scanner'&&cells.some(c=>isRoofed(world,c.z*world.width+c.x)))return false;
  if(occupancy)return !occupancy.animalOn(cells)&&!occupancy.pawnOn(cells,workerId);
  if(world.wildlife?.animals.some(a=>cells.some(c=>{
    const m=a.motion;return a.x===c.x&&a.z===c.z||!!m&&m.end>world.tick&&c.x>=Math.min(m.from.x,m.to.x)&&c.x<=Math.max(m.from.x,m.to.x)&&c.z>=Math.min(m.from.z,m.to.z)&&c.z<=Math.max(m.from.z,m.to.z);
  })))return false;
  return !world.pawns.some(p=>p.id!==workerId&&!(p.state==='dead'&&(p.body?.pileId!==undefined||p.body?.lostAt!==undefined))&&cells.some(c=>pawnOnCell(world,p,c)));
}
