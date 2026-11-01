import {footprintCells,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {blockedCells,inBounds} from './pathfinding.ts';
import {RoomTopologyCache} from './room-topology.ts';
import {isPassageDoor} from './door-rules.ts';
import {groundMaxStacks,shelfAt,shelfStorageCells,storageCellAccepts} from './shelf-storage.ts';
import type {Cell,Structure,World} from './types.ts';
import {directDropWood301,readWoodLeavings301,type WoodLeavingsHolder301} from './wood-direct-drop-301.ts';

/** These are real local work tables. Beds/chairs and ground storage policies
 * deliberately do not become placement vetoes. */
const WORK_TABLES=new Set<Structure['kind']>(['fueled-smithy','electric-smithy','brewery','electric-crematorium','electric-smelter','biofuel-refinery','drug-lab','art-bench','machining-table','fabrication-bench','fueled-stove','electric-stove','butcher-table','stonecutter','tailor-bench','electric-tailor-bench']);
/** Stable input order breaks equal distances locally. The native runtime's
 * equal-distance Array.Sort order has not been established; this remains a
 * declared geometry adaptation, not an assertion of bit-identical placement. */
const RADIAL:readonly Cell[]=Object.freeze(Array.from({length:27*27},(_,i)=>({x:i%27-13,z:Math.floor(i/27)-13}))
 .filter(c=>c.x*c.x+c.z*c.z<=166).sort((a,b)=>a.x*a.x+a.z*a.z-b.x*b.x-b.z*b.z));
export type WoodPlaceQuality301=0|1|2|3|4;

/** A single synchronous failure transaction owns this view. Never retain after
 * another geometry change or publish the temporary leavings owner. */
export class WoodNearDrop301 {
 private readonly walk:Uint8Array;
 private readonly normal:Uint8Array;
 private readonly buildings=new Map<number,Structure[]>();
 private readonly rooms;
 private reachable:Uint8Array|undefined;
 constructor(private readonly world:World,private readonly origin:Cell){
  this.normal=blockedCells(world,true);this.walk=this.normal.slice();
  this.rooms=new RoomTopologyCache().read(world);
  for(const s of world.structures)for(const c of footprintCells(s)){
   const i=c.z*world.width+c.x,list=this.buildings.get(i);
   if(list)list.push(s);else this.buildings.set(i,[s]);
   // Native placement checks both Normal and FenceBlocked walkability.
   if(s.kind==='fence')this.walk[i]=1;
   if(STRUCTURE_DEFINITIONS[s.kind].blocksMovement&&!isPassageDoor(s.kind))this.normal[i]=this.walk[i]=1;
  }
 }
 private canReach(cell:Cell):boolean{
  const w=this.world;
  if(!this.reachable){
   const seen=this.reachable=new Uint8Array(w.width*w.height),queue=new Int32Array(seen.length);
   let head=0,tail=0;
   if(inBounds(w,this.origin.x,this.origin.z)){const i=this.origin.z*w.width+this.origin.x;seen[i]=1;queue[tail++]=i;}
   while(head<tail){
    const i=queue[head++]!,x=i%w.width,z=Math.floor(i/w.width);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dz)continue;const nx=x+dx,nz=z+dz;
     if(!inBounds(w,nx,nz))continue;const n=nz*w.width+nx;
     if(seen[n]||this.normal[n])continue;
     if(dx&&dz&&(this.normal[z*w.width+nx]||this.normal[nz*w.width+x]))continue;
     seen[n]=1;queue[tail++]=n;
    }
   }
  }
  return this.reachable[cell.z*w.width+cell.x]===1;
 }
 quality(cell:Cell,holder:WoodLeavingsHolder301):WoodPlaceQuality301{
  const w=this.world,source=readWoodLeavings301(holder).pile;
  if(!source||!inBounds(w,cell.x,cell.z)||this.walk[cell.z*w.width+cell.x])return 0;
  const piles=w.piles.filter(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);
  const packs=w.packed.filter(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);
  const partial=piles.some(p=>p.item==='wood'&&p.kind==='wood'&&p.quantity<75);
  if(!partial&&piles.length+packs.length>=groundMaxStacks(w,cell))return 0;
  const shelf=shelfAt(w,cell);
  if(shelf){const storage=shelfStorageCells(shelf).find(c=>c.x===cell.x&&c.z===cell.z);
   // Read the actual destination's acceptance, never the ground zone policy.
   if(!storage||!storageCellAccepts(w,storage,source as World['piles'][number]))return 0;
  }
  const a=this.rooms.at(this.origin.x,this.origin.z),b=this.rooms.at(cell.x,cell.z);
  if(a?.kind!=='space'||b?.kind!=='space'||a.id!==b.id)return this.canReach(cell)?2:1;
  if(partial)return 4;
  const occupants=this.buildings.get(cell.z*w.width+cell.x)??[];
  if(occupants.some(s=>isPassageDoor(s.kind)||WORK_TABLES.has(s.kind))
   ||w.pawns.some(p=>p.state==='downed'&&p.x===cell.x&&p.z===cell.z))return 2;
  if(w.resources.some(r=>r.x===cell.x&&r.z===cell.z))return 3;
  return 4;
 }
 choose(holder:WoodLeavingsHolder301):Cell|undefined{
  let best:Cell|undefined,quality:WoodPlaceQuality301=0;
  for(const limit of [9,RADIAL.findIndex(c=>c.x*c.x+c.z*c.z>9),RADIAL.length]){
   for(let i=0;i<limit;i++){const d=RADIAL[i]!,cell={x:this.origin.x+d.x,z:this.origin.z+d.z},q=this.quality(cell,holder);
    if(q>quality){best=cell;quality=q;if(q===4)return best;}
   }
   if(quality>=3)return best;
  }
  return quality>0?best:undefined;
 }
 drop(holder:WoodLeavingsHolder301):{success:boolean;transferred:number;remaining:number}{
  const before=readWoodLeavings301(holder).quantity;
  if(before<=0)return {success:true,transferred:0,remaining:0};
  for(;;){
   const current=readWoodLeavings301(holder).quantity,cell=this.choose(holder);
   if(!cell)return {success:false,transferred:before-current,remaining:current};
   const result=directDropWood301(this.world,holder,cell);
   if(result.success)return {success:true,transferred:before,remaining:0};
   if(result.remaining>=current)return {success:false,transferred:before-result.remaining,remaining:result.remaining};
  }
 }
}
