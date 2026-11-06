import {canMergeEggPile256,EMPTY_EGG_CONDITION_256} from './animal-egg-permission-v256.ts';
import { groundOccupancyAllows, storageOccupancyAllows } from './occupancy.ts';
import { isCookingOrder } from './order-types.ts';
import { blockedCells, cellIndex, inBounds } from './pathfinding.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { storageAccepts } from './storage-filters.ts';
import { storageAt,storageCells,storageCellAccepts,shelfFixedAccepts,type StorageCell } from './shelf-storage.ts';
import type { Cell, HaulTask, MaterialPile, StockpileCell, World } from './types.ts';
import type { StagingGeometryReader } from './staging-validation.ts';
import { structureById } from './structure-navigation.ts';

/** Connected nearby cells, deterministic breadth first order. Never spill across a wall. */
export function nearbyGround(world: World, origin: Cell, radius = 12): Cell[] {
  if (!inBounds(world, origin.x, origin.z)) return [];
  const blocked = blockedCells(world), seen = new Set<number>([cellIndex(world, origin.x, origin.z)]);
  const queue: Cell[] = [{ x: origin.x, z: origin.z }], result: Cell[] = [];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    if (!blocked[cellIndex(world, c.x, c.z)]) result.push(c);
    for (const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const x = c.x + dx!, z = c.z + dz!, key = cellIndex(world,x,z);
      if (inBounds(world,x,z) && Math.abs(x-origin.x)+Math.abs(z-origin.z)<=radius && !seen.has(key) && !blocked[key]) { seen.add(key); queue.push({x,z}); }
    }
  }
  return result;
}
export function groundPile(world: World, cell: Cell): MaterialPile | undefined {
  return world.piles.find(p=>p.owner.type==='ground' && p.owner.x===cell.x && p.owner.z===cell.z);
}
export function groundPilesAt(world:World,cell:Cell):MaterialPile[] {return world.piles.filter(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);}
/** A merge target must fit the requested part, never an arbitrary first pile. */
export function groundMergePile(world:World,cell:Cell,item:ItemId,quantity=1):MaterialPile|undefined {
  return world.piles.find(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z&&p.item===item&&p.quantity+quantity<=ITEM_DEFINITIONS[item].stackLimit);
}
interface PlacementReservation {item?:ItemId;quantity:number;pawnId:number;queued?:true;exclusive?:true}
export interface GroundCapacityReader {piles:ReadonlyMap<number,readonly MaterialPile[]>;storage:ReadonlyMap<number,StorageCell>;reservations:ReadonlyMap<number,readonly PlacementReservation[]>;packed:ReadonlySet<number>}
/** Captured once during a synchronous read-only candidate scan. No reuse after writes. */
export function createGroundCapacityReader(world:World):GroundCapacityReader {
  const piles=new Map<number,MaterialPile[]>(),storage=new Map(storageCells(world).map(c=>[c.z*world.width+c.x,c])),byId=new Map(world.piles.map(p=>[p.id,p]));
  const reservations=new Map<number,PlacementReservation[]>(),storageById=new Map([...storage.values()].map(c=>[c.id,c]));
  const add=(cell:Cell,r:PlacementReservation)=>{const key=cell.z*world.width+cell.x,list=reservations.get(key);if(list)list.push(r);else reservations.set(key,[r]);};
  for(const p of world.piles)if(p.owner.type==='ground'){const key=p.owner.z*world.width+p.owner.x,list=piles.get(key);if(list)list.push(p);else piles.set(key,[p]);}
  const haul=(task:HaulTask,pawnId:number,queued?:true)=>{
    const d=task.destination,c=d.type==='stockpile'?storageById.get(d.stockpileId):d.type==='aside'?d:d.type==='hopper'?structureById(world,d.structureId):undefined;
    if(c){const p=byId.get(task.phase==='pickup'?task.sourcePileId:task.carryPileId!);add(c,{pawnId,queued,item:p?.item,quantity:task.quantity,...task.whole?{exclusive:true as const}:{}});}
  };
  for(const p of world.pawns){
    if(p.haul)haul(p.haul,p.id);
    for(const i of p.surgery?.ingredients??[])if(i.stage!=='placed')add(i.cell,{pawnId:p.id,quantity:i.quantity,exclusive:true});
    if(p.ward?.kind==='food'){const t=p.ward;add(t.spot,{pawnId:p.id,item:byId.get(t.phase==='pickup'?t.sourcePileId:t.carryPileId!)?.item,quantity:t.quantity,exclusive:true});}
    for(const task of p.orders?.queue??[])if(typeof task!=='number'){
      if(isCookingOrder(task)){for(const i of task.cooking.ingredients)if(i.stage!=='placed')add(i.cell,{pawnId:p.id,queued:true,item:i.item,quantity:i.quantity,exclusive:true});}
      else haul(task,p.id,true);
    }
    if(p.cooking){
      for(const i of p.cooking.ingredients)if(i.stage!=='placed')add(i.cell,{pawnId:p.id,item:i.item,quantity:i.quantity,exclusive:true});
      if(p.cooking.phase==='output'&&p.cooking.storageId!==null){const c=storageById.get(p.cooking.storageId),product=byId.get(p.cooking.productId!);if(c)add(c,{pawnId:p.id,item:product?.item,quantity:p.cooking.storageQuantity??product?.quantity??Infinity});}
    }
  }
  for(const a of world.wildlife?.animals??[])if(a.haul&&a.haul.phase!=='holding')haul(a.haul,a.id);
  return {piles,storage,reservations,packed:new Set(world.packed.filter(p=>p.owner.type==='ground').map(p=>p.owner.type==='ground'?p.owner.z*world.width+p.owner.x:-1))};
}
function shelfCapacity(world:World,cell:Cell,subject:ItemId|MaterialPile,exceptPawn:number|undefined,zone:StorageCell,geometry:StagingGeometryReader|undefined,reader?:GroundCapacityReader,policy=true):number {
  if(!(policy?storageCellAccepts(world,zone,subject):shelfFixedAccepts(subject))||!(geometry?geometry.groundAllows(cell):groundOccupancyAllows(world,cell)))return 0;
  if(policy&&!(geometry?.storageAllows?geometry.storageAllows(cell):storageOccupancyAllows(world,cell)))return 0;
  const facts=reader??createGroundCapacityReader(world),key=cell.z*world.width+cell.x;
  if(facts.packed.has(key))return 0;
  const piles=facts.piles.get(key)??[],reserved=new Map<ItemId,number>();
  if(piles.length>3)return 0;
  for(const r of facts.reservations.get(key)??[]){
    if(r.pawnId===exceptPawn&&!r.queued)continue;
    if(r.exclusive||!r.item||!Number.isSafeInteger(r.quantity)||r.quantity<1)return 0;
    reserved.set(r.item,(reserved.get(r.item)??0)+r.quantity);
  }
  const residual=new Map<ItemId,number>();
  for(const p of piles)if(p.item!==(typeof subject==='string'?subject:subject.item)||canMergeEggPile256(p,typeof subject==='string'?EMPTY_EGG_CONDITION_256:subject))residual.set(p.item,(residual.get(p.item)??0)+Math.max(0,ITEM_DEFINITIONS[p.item].stackLimit-p.quantity));
  let free=3-piles.length;
  for(const [item,n] of reserved){
    const stack=ITEM_DEFINITIONS[item].stackLimit,available=residual.get(item)??0,extra=Math.max(0,n-available),newStacks=Math.ceil(extra/stack);
    free-=newStacks;residual.set(item,Math.max(0,available-n)+newStacks*stack-extra);
  }
  if(free<0)return 0;
  const item=typeof subject==='string'?subject:subject.item,stack=ITEM_DEFINITIONS[item].stackLimit;
  return Math.max(0,(residual.get(item)??0)+free*stack);
}
/** One synchronous placement decision only; never retain across ownership changes. */
export function groundPileCells(world:World):ReadonlySet<number> {
  const cells=new Set<number>();
  for(const p of world.piles)if(p.owner.type==='ground')cells.add(p.owner.z*world.width+p.owner.x);
  return cells;
}
function cellCapacity(world: World, cell: Cell, item: ItemId, limit: number, exceptPawn?: number, zone:StockpileCell|null|undefined=world.stockpiles.find(z=>z.x===cell.x&&z.z===cell.z),geometry?:StagingGeometryReader,condition:Pick<MaterialPile,'egg'|'eggForbidden'>=EMPTY_EGG_CONDITION_256): number {
  if(world.packed?.some(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z))return 0;
  const pile = groundPile(world, cell);
  if (pile && (pile.item!==item||!canMergeEggPile256(pile,condition))) return 0;
  let capacity = Math.min(limit,ITEM_DEFINITIONS[item].stackLimit)-(pile?.quantity??0);
  if(capacity<=0||world.schemaVersion>=21&&(!(geometry?geometry.groundAllows(cell):groundOccupancyAllows(world,cell))||zone&&!(geometry?.storageAllows?geometry.storageAllows(cell):storageOccupancyAllows(world,cell))))return 0;
  // Hot capacity queries must not allocate an array/generator of every transport.
  for (const pawn of world.pawns) {
    if(pawn.id!==exceptPawn)for(const i of pawn.surgery?.ingredients??[])if(i.stage!=='placed'&&i.cell.x===cell.x&&i.cell.z===cell.z)return 0;
    if(pawn.id!==exceptPawn&&pawn.ward?.kind==='food'&&pawn.ward.spot.x===cell.x&&pawn.ward.spot.z===cell.z){
      const t=pawn.ward,food=world.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
      if(!food||food.item!==item)return 0;capacity-=t.quantity;
    }
    if(pawn.id!==exceptPawn&&pawn.haul)capacity-=reservedAt(world,pawn.haul,cell,item,zone??undefined);
    const queue=pawn.orders?.queue;
    if(queue?.length)for(const task of queue)if(typeof task!=='number') {
      if(isCookingOrder(task)) {
        for(const i of task.cooking.ingredients)if(i.stage!=='placed'&&i.cell.x===cell.x&&i.cell.z===cell.z){if(i.item!==item)return 0;capacity-=i.quantity;}
      } else capacity-=reservedAt(world,task,cell,item,zone??undefined);
    }
    if(capacity<=0)return 0;
  }
  for(const pawn of world.pawns)if(pawn.id!==exceptPawn&&pawn.cooking) {
    for(const i of pawn.cooking.ingredients)if(i.stage!=='placed'&&i.cell.x===cell.x&&i.cell.z===cell.z) {if(i.item!==item)return 0;capacity-=i.quantity;}
    if(zone&&pawn.cooking.phase==='output'&&pawn.cooking.storageId===zone.id){const product=world.piles.find(p=>p.id===pawn.cooking!.productId);if(!product||product.item!==item)return 0;capacity-=pawn.cooking.storageQuantity??product.quantity;}
  }
  for(const a of world.wildlife?.animals??[])if(a.id!==exceptPawn&&a.haul&&a.haul.phase!=='holding')capacity-=reservedAt(world,a.haul,cell,item,zone??undefined);
  return Math.max(0,capacity);
}
function reservedAt(world:World,task:HaulTask,cell:Cell,item:ItemId,zone?:StockpileCell):number {
  const d=task.destination;
  const hopper=d.type==='hopper'?world.structures.find(s=>s.kind==='hopper'&&s.id===d.structureId):undefined;
  if(!(zone&&d.type==='stockpile'&&d.stockpileId===zone.id)&&!(d.type==='aside'&&d.x===cell.x&&d.z===cell.z)&&!(hopper&&hopper.x===cell.x&&hopper.z===cell.z))return 0;
  if(task.whole)return Infinity;
  const pile=world.piles.find(p=>p.id===(task.phase==='pickup'?task.sourcePileId:task.carryPileId));
  return pile?.item===item?task.quantity:Infinity;
}
export function groundCapacity(world: World, cell: Cell, subject: ItemId|MaterialPile, exceptPawn?: number,geometry?:StagingGeometryReader,reader?:GroundCapacityReader): number {
  const item=typeof subject==='string'?subject:subject.item,zone=reader?reader.storage.get(cell.z*world.width+cell.x):geometry?.storageAt?geometry.storageAt(cell):storageAt(world,cell);
  return zone?.shelfId!==undefined?shelfCapacity(world,cell,subject,exceptPawn,zone,geometry,reader,false):cellCapacity(world,cell,item,ITEM_DEFINITIONS[item].stackLimit,exceptPawn,reader?zone??null:undefined,geometry,typeof subject==='string'?EMPTY_EGG_CONDITION_256:subject);
}
export function storageCapacity(world: World, zone: StorageCell, subject: ItemId|MaterialPile, exceptPawn?: number,geometry?:StagingGeometryReader,reader?:GroundCapacityReader): number {
  const item=typeof subject==='string'?subject:subject.item;
  return zone.shelfId!==undefined?shelfCapacity(world,zone,subject,exceptPawn,zone,geometry,reader):storageAccepts(zone,subject,world.tick) ? cellCapacity(world,zone,item,zone.capacity,exceptPawn,zone,geometry,typeof subject==='string'?EMPTY_EGG_CONDITION_256:subject) : 0;
}
export function planGroundPlacement(world: World, quantity: number, origin: Cell, item: ItemId, reachable?: (cell:Cell)=>boolean): {cell:Cell; quantity:number}[] | null {
  const result: {cell:Cell;quantity:number}[]=[];
  const facts=world.structures.some(s=>s.shelf)?createGroundCapacityReader(world):undefined;
  for (const cell of nearbyGround(world,origin)) {
    if(reachable&&!reachable(cell))continue;
    const moved=Math.min(quantity,groundCapacity(world,cell,item,undefined,undefined,facts));
    if(moved>0) {result.push({cell,quantity:moved});quantity-=moved;}
    if(!quantity) return result;
  }
  return quantity===0?result:null;
}
/** Retains identity, including an interrupted meal that will be reserved again. */
export function dropRetainingIdentity(world: World, pile: MaterialPile, origin: Cell): boolean {
  const carrier=pile.owner.type==='pawn'?pile.owner.pawnId:undefined;
  const occupied=groundPileCells(world);
  const facts=world.structures.some(s=>s.shelf)?createGroundCapacityReader(world):undefined;
  const cell=nearbyGround(world,origin).find(c=>!occupied.has(c.z*world.width+c.x)&&groundCapacity(world,c,pile,carrier,undefined,facts)>=pile.quantity);
  if(!cell) return false;
  pile.owner={type:'ground',...cell}; return true;
}
