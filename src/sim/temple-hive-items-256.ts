/** Approved bounded GenPlaceNear adaptation for this PassThrough/None Hive:
 * keep every original lot/minified owner and ID, without merging or wiping.
 * All destinations are prepared before any owner is changed. */
import {assignPileOwner} from './pile-index.ts';
import type {World} from './types.ts';
import {captureHiveClosewalk256} from './cave-hive-closewalk-256.ts';
import {caveRadialPattern256} from './local-cave-radial-256.ts';
export function planTempleHiveItemsAside256(w:World,cell:number):{commit():boolean}|null {
 const x=cell%w.width,z=Math.floor(cell/w.width),piles=w.piles.filter(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z),packs=w.packed.filter(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z);
 const rows=[...piles,...packs];if(!rows.length)return {commit:()=>true};
 const capture=captureHiveClosewalk256(w),occupied=new Set<number>([cell]);
 for(const p of [...w.piles,...w.packed])if(p.owner.type==='ground')occupied.add(p.owner.z*w.width+p.owner.x);
 const {count,offsets}=caveRadialPattern256(20),plans:{row:typeof rows[number];before:string;target:{type:'ground';x:number;z:number}}[]=[];
 for(const row of rows){let target:{type:'ground';x:number;z:number}|undefined;
  for(let i=0;i<count;i++){const [dx,dz]=offsets[i]!,nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=w.width||nz>=w.height)continue;const at=nz*w.width+nx;
   if(occupied.has(at)||!capture.physical.normalWalkable(at)||capture.physical.edifice(at)||!capture.reach.canReach(cell,at,'closed'))continue;
   target={type:'ground',x:nx,z:nz};occupied.add(at);break;
  }
  if(!target)return null;plans.push({row,before:JSON.stringify(row.owner),target});
 }
 const basePiles=w.piles,basePacks=w.packed;let done=false;
 return {commit(){if(done||w.piles!==basePiles||w.packed!==basePacks||plans.some(p=>JSON.stringify(p.row.owner)!==p.before))return false;done=true;for(const p of plans)assignPileOwner(p.row,p.target);return true;}};
}
