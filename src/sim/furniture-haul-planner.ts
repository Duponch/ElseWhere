import { workPriority } from './work-types.ts';
import {captureOrderedWorkClaims378,orderedJobClaimed378,type OrderedWorkClaims378} from './ordered-work-claims-378.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { asBuilder, constructionHaulPriority, containsCell, isConstruction } from './construction-rules.ts';
import { furnitureAsideAllowed, furnitureSlot } from './furniture-haul-rules.ts';
import { reservedSource } from './materials.ts';
import { storageOccupancyAllows } from './occupancy.ts';
import { storageConditionAccepts,storageConditionKey } from './storage-condition.ts';
import { inBounds, type Reachability } from './pathfinding.ts';
import { canReach } from './work-planner.ts';
import type { PackedFurniture } from './furniture-rules.ts';
import type { Cell, HaulDestination, Job, Pawn, World } from './types.ts';

const distance=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z);
export interface FurnitureHaulCandidate { whole:true;priority:number;rank:number;distance:number;id:number;sourceId:number;quantity:number;target:Cell;destination:HaulDestination }

/** Cheap rejection before navigation, never a claim that a destination is free
 * or reachable. Rebuilt from authoritative state at every decision. */
export function mayImproveFurnitureStorage(world:World):boolean {
  if(!world.packed.length)return false;
  const zones=world.stockpiles.filter(z=>z.filters.furniture),byCell=new Map(zones.map(z=>[z.z*world.width+z.x,z]));
  if(!zones.length)return false;
  const highestByCondition=new Map<string,number>();
  const assigned=new Set(world.jobs.flatMap(j=>j.furniture?[j.furniture.structureId]:[]));
  return world.packed.some(p=>{
    if(p.owner.type!=='ground'||assigned.has(p.building.id)||reservedSource(world,p.building.id)!==0)return false;
    const key=storageConditionKey(p.building);let highest=highestByCondition.get(key);
    if(highest===undefined){highest=0;for(const z of zones)if(storageConditionAccepts(z,p.building))highest=Math.max(highest,z.priority);highestByCondition.set(key,highest);}
    const source=byCell.get(p.owner.z*world.width+p.owner.x),priority=source&&storageConditionAccepts(source,p.building)?source.priority:0;
    return priority<highest;
  });
}

export function planFurnitureTransport(world:World,pawn:Pawn,pack:PackedFurniture,blocked:Uint8Array,reach:Reachability,budget:{pairs:number},parent?:Job,storageAccess=new Map<number,boolean>(),claims:OrderedWorkClaims378=captureOrderedWorkClaims378(world,pawn.id)):FurnitureHaulCandidate|undefined {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(pack.owner.type!=='ground'||!allows(pack.owner)||parent&&(!allows(parent)||orderedJobClaimed378(claims,parent))||claims.structures?.has(pack.building.id)||reservedSource(world,pack.building.id)>0||world.jobs.some(j=>j.furniture?.structureId===pack.building.id))return;
  const work=parent?parent.kind==='sow'?workPriority(pawn,'grow')||Infinity:constructionHaulPriority(pawn):workPriority(pawn,'haul')||Infinity;
  if(!Number.isFinite(work)||parent?.reservedBy!==undefined&&parent.reservedBy!==null||!canReach(world,pack.owner,reach,true))return;
  const origin=pack.owner,current=world.stockpiles.find(z=>z.x===origin.x&&z.z===origin.z),priority=parent?0:current?.filters.furniture&&storageConditionAccepts(current,pack.building)?current.priority:0;
  let best:{cell:Cell;id:number;priority:number;cost:number}|undefined;
  if(!parent)for(const zone of world.stockpiles) {
    if(!allows(zone))continue;
    if(budget.pairs--<=0){budget.pairs=0;return;}
    if(!zone.filters.furniture||!storageConditionAccepts(zone,pack.building)||zone.priority<=priority||distance(zone,origin)===0)continue;
    // One synchronous decision sees unchanged occupancy/reservations. A source
    // does not change a destination's capacity or the actor's connectivity.
    let usable=storageAccess.get(zone.id);
    if(usable===undefined){usable=storageOccupancyAllows(world,zone)&&furnitureSlot(world,zone)&&canReach(world,zone,reach,true);storageAccess.set(zone.id,usable);}
    if(!usable)continue;
    const cost=distance(origin,zone);
    if(!best||zone.priority>best.priority||zone.priority===best.priority&&(cost<best.cost||cost===best.cost&&zone.id<best.id))best={cell:zone,id:zone.id,priority:zone.priority,cost};
  }
  let destination:HaulDestination|undefined=best?{type:'stockpile',stockpileId:best.id}:undefined;
  if(parent) {
    // Clear locally before ordinary storage: no distant stockpile detour.
    let target:Cell|undefined;
    {
      const queue:Cell[]=[origin],seen=new Set([origin.z*world.width+origin.x]);
      for(let i=0;i<queue.length&&budget.pairs>0;i++) {
        const c=queue[i]!;budget.pairs--;
        if(i>0&&allows(c)&&!world.pawns.some(p=>p.x===c.x&&p.z===c.z)&&furnitureAsideAllowed(world,c,undefined,pack.building)){target=c;break;}
        for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]) {
          const x=c.x+dx!,z=c.z+dz!,key=z*world.width+x;
          if(inBounds(world,x,z)&&!blocked[key]&&!seen.has(key)){seen.add(key);queue.push({x,z});}
        }
      }
    }
    if(!target)return;
    destination={type:'aside',x:target.x,z:target.z,...(parent.kind==='sow'?{growingZoneId:parent.growingZoneId,sowCell:{x:parent.x,z:parent.z}}:{constructionId:parent.id,forConstruction:asBuilder(pawn)})};
  }
  if(!destination)return;
  return {whole:true,priority:work,rank:parent?1:2+(5-best!.priority)/10,distance:distance(pawn,origin)+(best?.cost??0),id:pack.building.id,sourceId:pack.building.id,quantity:1,target:origin,destination};
}
export function furnitureStorageCandidates(world:World,pawn:Pawn,blocked:Uint8Array,reach:Reachability,budget:{pairs:number},claims:OrderedWorkClaims378=captureOrderedWorkClaims378(world,pawn.id)):FurnitureHaulCandidate[] {
  const policy=captureAllowedArea(world,pawn);
  const result:FurnitureHaulCandidate[]=[];
  const storageAccess=new Map<number,boolean>();
  for(const pack of world.packed) {
    if(policy&&pack.owner.type==='ground'&&!allowedAreaAllows(world,pawn,pack.owner,policy))continue;
    if(budget.pairs<=0)break;budget.pairs--;
    if(pack.owner.type!=='ground')continue;
    const owner=pack.owner,parent=world.jobs.find(j=>j.kind==='sow'&&j.x===owner.x&&j.z===owner.z);
    if(!parent&&world.jobs.some(j=>isConstruction(j)&&containsCell(j,owner)))continue;
    const proposal=planFurnitureTransport(world,pawn,pack,blocked,reach,budget,parent,storageAccess,claims);if(proposal)result.push(proposal);
  }
  return result;
}
