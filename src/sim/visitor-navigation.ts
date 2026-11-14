import { isBedKind } from './bed-kinds.ts';
import { isColonist,distanceSquared } from './affiliation.ts';
import { candidateAccess } from './candidate-access.ts';
import { captureStandability } from './furniture-travel.ts';
import { blockedCells } from './pathfinding.ts';
import { isRoofed } from './roof-rules.ts';
import type { VisitorKind } from './visitor-state.ts';
import type { Cell,Pawn,World } from './types.ts';

export const visitorAtEdge=(w:World,c:Cell):boolean=>c.x===0||c.z===0||c.x===w.width-1||c.z===w.height-1;
const EMPTY:ReadonlySet<number>=new Set();
/** All captures are owned by this incident decision. No imaginary breach graph.
 * Exterior meeting-site selection is a documented local geometric adaptation. */
export function visitorArrival(w:World,salt:number,count:number,kind:VisitorKind,wide=false):{entry:Cell;sites:Cell[];spot:Cell;parking:Cell[]}|null {
  // Schema 332 caravans (up to 24 people) spread over a wider entry and halt.
  const reach=wide?7:5,halt=wide?36:16;
  const colonists=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead');if(!colonists.length)return null;
  const blocked=blockedCells(w),stand=captureStandability(w),occupied=new Set(w.pawns.flatMap(p=>[p.z*w.width+p.x,...p.motion&&p.motion.end>w.tick?[p.motion.from.z*w.width+p.motion.from.x]:[]]));
  const centers=w.structures.filter(s=>isBedKind(s.kind)&&!s.prisoner);
  const center=centers.length?{x:centers.reduce((n,c)=>n+c.x,0)/centers.length,z:centers.reduce((n,c)=>n+c.z,0)/centers.length}:colonists[0]!;
  const candidates:Cell[]=[],edges:Cell[]=[];
  for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++){
    const c={x,z},i=z*w.width+x;if(blocked[i]||!stand(c)||occupied.has(i))continue;
    if(visitorAtEdge(w,c))edges.push(c);
    const d=distanceSquared(c,center);if(d>=16&&d<=225&&!isRoofed(w,i))candidates.push(c);
  }
  if(!edges.length||!candidates.length)return null;
  const connected=new Uint8Array(blocked.length),queue=new Int32Array(blocked.length);let head=0,tail=0;
  const visit=(i:number)=>{if(!blocked[i]&&!connected[i]){connected[i]=1;queue[tail++]=i;}};
  for(const e of edges)visit(e.z*w.width+e.x);
  while(head<tail){const i=queue[head++]!,x=i%w.width;if(i>=w.width)visit(i-w.width);if(x+1<w.width)visit(i+1);if(i+w.width<blocked.length)visit(i+w.width);if(x)visit(i-1);}
  candidates.sort((a,b)=>Math.abs(distanceSquared(a,center)-64)-Math.abs(distanceSquared(b,center)-64)||a.z-b.z||a.x-b.x);
  // Pick an exterior colony site in a component that really reaches an edge.
  for(const spot of candidates){
    if(!connected[spot.z*w.width+spot.x])continue;
    const access=candidateAccess(w,spot,blocked,EMPTY),usable=edges.filter(c=>access.has(c.z*w.width+c.x));if(!usable.length)continue;
    const entry=usable[(salt>>>0)%usable.length]!;
    const near:Cell[]=[];
    for(let z=Math.max(0,entry.z-reach);z<=Math.min(w.height-1,entry.z+reach);z++)for(let x=Math.max(0,entry.x-reach);x<=Math.min(w.width-1,entry.x+reach);x++){
      const c={x,z},i=z*w.width+x;if(distanceSquared(entry,c)<=reach*reach&&!blocked[i]&&!occupied.has(i)&&stand(c)&&access.has(i))near.push(c);
    }
    near.sort((a,b)=>distanceSquared(a,entry)-distanceSquared(b,entry)||a.z-b.z||a.x-b.x);
    if(near.length<count)continue;
    if(kind==='traveler'){
      const far=usable.filter(c=>distanceSquared(c,entry)>=Math.min(w.width,w.height)**2/4).sort((a,b)=>distanceSquared(b,entry)-distanceSquared(a,entry)||a.z-b.z||a.x-b.x);
      if(!far.length)return null;
      const destination={...far[(salt>>>8)%Math.min(8,far.length)]!};
      return {entry:{...entry},sites:near.slice(0,count),spot:destination,parking:Array.from({length:count},()=>({...destination}))};
    }
    const parking=candidates.filter(c=>distanceSquared(c,spot)<=halt&&access.has(c.z*w.width+c.x)).slice(0,count);
    if(parking.length<count)continue;
    return {entry:{...entry},sites:near.slice(0,count),spot:{...spot},parking};
  }
  return null;
}
/** Exit selection is lazy and synchronous; ordinary route following belongs to
 * the engine's shared search budget. A sealed visitor waits, never teleports. */
export function visitorExit(w:World,p:Pawn):Cell|null {
  const stands=captureStandability(w),blocked=blockedCells(w),access=candidateAccess(w,p,blocked,EMPTY),edges:Cell[]=[];
  for(let x=0;x<w.width;x++){edges.push({x,z:0});edges.push({x,z:w.height-1});}
  for(let z=1;z<w.height-1;z++){edges.push({x:0,z});edges.push({x:w.width-1,z});}
  edges.sort((a,b)=>distanceSquared(p,a)-distanceSquared(p,b)||a.z-b.z||a.x-b.x);
  return edges.find(c=>stands(c)&&access.has(c.z*w.width+c.x))??null;
}
