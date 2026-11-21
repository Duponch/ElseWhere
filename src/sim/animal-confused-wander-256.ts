import {naturalTerrainCosts256} from './natural-terrain-movement-256.ts';
import {furnitureDelay} from './furniture-travel.ts';
import {duckTerrainOverride256,duckMapHasWater256,duckWanderWaterAllowed256} from './duck-water-256.ts';
import {duckFlying256} from './duck-flight-state-256.ts';
import {notifyDuckFlightJob256} from './duck-flight-runtime-256.ts';
import {animalComfyRange256,isAnimalSpecies256} from './animal-core-v256.ts';
import {actualNativeSevenFacts256} from './actual-animal-profile-256.ts';
import {TemperatureView,thermalLayout} from './temperature.ts';
import {groundFire} from './fire-rules.ts';
import {isPassageDoor} from './door-rules.ts';
import {spikeTrapKnowsOf} from './spike-trap-state.ts';
import {isTrapKind357} from './ied-traps-357.ts';
import {reservedServiceCells} from './service-reservations.ts';
import type {animalNavigation} from './wildlife-navigation.ts';
import type {InitialAnimalRandom256} from './initial-animal-age-256.ts';
import type {ActualAnimalMind256} from './animal-condition-mental-state-256.ts';
import type {Cell,World} from './types.ts';
type Nav=Pick<ReturnType<typeof animalNavigation>,'free'|'occupy'|'step'>;
export interface AnimalWanderReachability256 {canReach(cell:Cell):boolean;pathTo(cell:Cell):Cell[]|undefined}
type Region={cells:Cell[];members:Set<number>;x0:number;x1:number;z0:number;z1:number;portal:boolean};
const directions=[[0,-1],[1,0],[0,1],[-1,0]] as const;
/** On-demand LIVE physical regions: at most the twelve-cell chunks whose
 * rectangle meets radius7, thirteen admitted regions. No generation reader,
 * periodic grid scan or reusable cache. Native RegionLink order remains an
 * explicit presentation/navigation adaptation, not a bit-parity claim. */
export function liveAnimalWanderRegions256(w:World,a:Cell,nav:Nav):Region[]{
 const byCell=new Map<number,Region>(),denied=new Set<number>(),portals=new Set(w.structures.filter(s=>isPassageDoor(s.kind)).map(s=>s.z*w.width+s.x));
 const intersects=(cx:number,cz:number)=>{const x0=cx*12,z0=cz*12,x1=Math.min(w.width-1,x0+11),z1=Math.min(w.height-1,z0+11),dx=Math.max(x0-a.x,0,a.x-x1),dz=Math.max(z0-a.z,0,a.z-z1);return dx*dx+dz*dz<=49;};
 const regionAt=(c:Cell):Region|undefined=>{
  if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height||!intersects(Math.floor(c.x/12),Math.floor(c.z/12)))return;
  const i=c.z*w.width+c.x,known=byCell.get(i);if(known)return known;if(denied.has(i))return;
  if(!nav.occupy(c)){denied.add(i);return;}
  const portal=portals.has(i),r:Region={cells:[],members:new Set(),x0:c.x,x1:c.x,z0:c.z,z1:c.z,portal},queue=[c],cx=Math.floor(c.x/12),cz=Math.floor(c.z/12);byCell.set(i,r);
  for(let q=0;q<queue.length;q++){
   const p=queue[q]!,pi=p.z*w.width+p.x;r.cells.push(p);r.members.add(pi);r.x0=Math.min(r.x0,p.x);r.x1=Math.max(r.x1,p.x);r.z0=Math.min(r.z0,p.z);r.z1=Math.max(r.z1,p.z);
   if(portal)continue;
   for(const [dx,dz] of directions){const n={x:p.x+dx,z:p.z+dz},ni=n.z*w.width+n.x;if(n.x<0||n.z<0||n.x>=w.width||n.z>=w.height||Math.floor(n.x/12)!==cx||Math.floor(n.z/12)!==cz||byCell.has(ni)||denied.has(ni)||portals.has(ni))continue;
    if(nav.occupy(n)&&nav.step(p,n)){byCell.set(ni,r);queue.push(n);}else if(!nav.occupy(n))denied.add(ni);
   }
  }return r;
 };
 const root=regionAt(a);if(!root)return [];const admitted=[root],seen=new Set([root]);
 for(let q=0;q<admitted.length&&admitted.length<13;q++)for(const p of admitted[q]!.cells){for(const [dx,dz] of directions){const n={x:p.x+dx,z:p.z+dz};if(!nav.step(p,n))continue;const r=regionAt(n);if(!r||seen.has(r))continue;seen.add(r);admitted.push(r);if(admitted.length===13)return admitted;}}
 return admitted;
}
const shuffle=(list:number[],random:InitialAnimalRandom256)=>{for(let i=0;i<list.length-1;i++){const j=random.integer(i,list.length);[list[i],list[j]]=[list[j]!,list[i]!];}};
function near(w:World,root:Cell,radius:number,accept:(c:Cell)=>boolean,random:InitialAnimalRandom256):Cell|undefined {
 // Core includes Size in the tentative range; the actual predicate rejects
 // that out-of-bounds coordinate. Preserve those draws before the fallback.
 const x0=Math.max(0,root.x-radius),x1=Math.min(w.width,root.x+radius),z0=Math.max(0,root.z-radius),z1=Math.min(w.height,root.z+radius);
 for(let n=0;n<20;n++){const c={x:random.integer(x0,x1+1),z:random.integer(z0,z1+1)};if(accept(c))return c;}
 const xs=Array.from({length:x1-x0+1},(_,i)=>x0+i),zs=Array.from({length:z1-z0+1},(_,i)=>z0+i);shuffle(xs,random);shuffle(zs,random);
 for(const x of xs)for(const z of zs){const c={x,z};if(accept(c))return c;}return;
}
/** One quota-granted job choice. Reachability is a SINGLE resumable existing
 * physical search shared by every ticket/fallback, not one flood per draw. */
export function chooseClinicalWanderDestination256(w:World,a:Cell,nav:Nav,reach:AnimalWanderReachability256,random:InitialAnimalRandom256,reader:{comfy:{minimum:number;maximum:number};water:boolean;knowsTraps:boolean;delayCore(cell:Cell):number;destinationAllowed(cell:Cell):boolean}):Cell {
 const regions=liveAnimalWanderRegions256(w,a,nav),total=regions.reduce((n,r)=>n+r.cells.length,0),doors=new Set(w.structures.filter(s=>isPassageDoor(s.kind)).map(s=>s.z*w.width+s.x)),fire=new Set((w.fires?.items??[]).filter(groundFire).map(f=>f.z*w.width+f.x));
 const knownTraps=new Set(reader.knowsTraps?w.structures.filter(s=>isTrapKind357(s.kind)&&!!s.spikeTrap).map(s=>s.z*w.width+s.x):[]),reserved=reservedServiceCells(w),temperature=new TemperatureView(w,thermalLayout(w)),range=reader.comfy;
 if(!range)throw Error('Confused original has no actual native thermal profile');
 const danger=(c:Cell)=>{const t=temperature.at(w,c);return t>=range.minimum-10&&t<=range.maximum+10?0:t>=range.minimum-90&&t<=range.maximum+90?1:2;};
 const inside=(c:Cell)=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
 const valid=(c:Cell,attempt:number)=>{
  if(!inside(c)||!nav.occupy(c)||attempt<10&&!nav.free(c))return false;const i=c.z*w.width+c.x,t=w.tiles[i]!;
  if(!reach.canReach(c)||knownTraps.has(i)||doors.has(i)||fire.has(i)||reserved.has(i))return false;
  const terrain=!t.bridge&&!t.floor&&naturalTerrainCosts256(t.terrain),water=!!terrain&&terrain.water;
  if(attempt<10&&(water&&!reader.water||reader.delayCore(c)>20||danger(c)>1)||attempt>=10&&attempt<15&&danger(c)===2)return false;
  return reader.destinationAllowed(c);
 };
 if(total)for(let attempt=0;attempt<35;attempt++){
  let candidate:Cell|undefined;
  for(let ticket=0;ticket<5;ticket++){
   let roll=Math.fround(random.value()*total),region=regions.at(-1)!;for(const r of regions){roll=Math.fround(roll-r.cells.length);if(roll<=0){region=r;break;}}
   let c:Cell|undefined;for(let retry=0;retry<1000;retry++){const p={x:random.integer(region.x0,region.x1+1),z:random.integer(region.z0,region.z1+1)};if(region.members.has(p.z*w.width+p.x)){c=p;break;}}c??=region.cells[0]!;
   if((c.x-a.x)**2+(c.z-a.z)**2<=49){candidate=c;break;}
  }
  if(candidate&&valid(candidate,attempt))return candidate;
 }
 const can=(c:Cell,maxDanger:number)=>{
  if(!inside(c)||!nav.occupy(c)||!reach.canReach(c))return false;
  const permitted=Math.max(maxDanger,danger(a));if(danger(c)>permitted)return false;
  // Region.Allows permits intermediate Some; Deadly cannot be entered from
  // a safer origin under Danger.None. Check the actual retained physical
  // route, not merely its endpoint. Alternate-route ties remain the existing
  // navigation adaptation rather than a claim of native RegionLink parity.
  return permitted>=2||!!reach.pathTo(c)?.every(p=>danger(p)<2);
 };
 // The second radius7 pass intentionally omits the destination validator;
 // later passes allow deadly danger exactly as the primary fallback does.
 return near(w,a,7,c=>can(c,0),random)??near(w,a,7,c=>can(c,0),random)??near(w,a,7,c=>can(c,2),random)??near(w,a,20,c=>can(c,0),random)??near(w,a,30,c=>can(c,2),random)??near(w,a,5,c=>can(c,2),random)??{x:a.x,z:a.z};
}
export function chooseAnimalConfusedDestination256(w:World,a:ActualAnimalMind256,nav:Nav,reach:AnimalWanderReachability256,random:InitialAnimalRandom256):Cell {
 const seven=actualNativeSevenFacts256(a),comfy=isAnimalSpecies256(a.species)?animalComfyRange256(a.species):seven?{minimum:seven.comfyMin,maximum:seven.comfyMax}:undefined;
 if(!comfy)throw Error('Confused original has no actual native thermal profile');
 return chooseClinicalWanderDestination256(w,a,nav,reach,random,{comfy,water:a.species==='duck',knowsTraps:spikeTrapKnowsOf(w,a),delayCore:c=>furnitureDelay(w,a,c,duckTerrainOverride256(w,a))*10,destinationAllowed:c=>duckWanderWaterAllowed256(w,a,c,a.species==='duck'&&duckMapHasWater256(w),()=>random.value())});
}
/** Returns true while owning this real local job. Quota refusal is entirely
 * before the flag/timer/random stream is changed. The caller keeps ordinary
 * emergency food/rest/fire/impact priorities ahead of this method. */
export function processAnimalConfusedWander256(w:World,a:ActualAnimalMind256,nav:Nav,services:{takeSearch():boolean;createReachability():AnimalWanderReachability256;random:InitialAnimalRandom256;move():void}):boolean {
 if(!a.confusion)return false;const mind=a.wander;if(!mind)throw Error('Confused original has no actual mind');
 if(a.motion&&a.motion.end>w.tick||a.stun||a.strike)return true;
 const old=mind.job;
 if(old?.kind==='wait'&&old.untilCore>w.tick*10)return true;
 if(old?.kind==='goto'&&a.path.length){services.move();return true;}
 if(old)delete mind.job;
 if(!services.takeSearch())return true;
 // A completed Goto is no longer CurJob. Active Goto was retained above;
 // this decision therefore starts from no current Wander job.
 const wasGoto=false,wait=mind.nextMoveOrderIsWait&&!duckFlying256(a.flight);
 if(!wasGoto)mind.nextMoveOrderIsWait=!mind.nextMoveOrderIsWait;
 const startWait=()=>{notifyDuckFlightJob256(w,a,'other',()=>services.random.value());a.path=[];a.state='idle';mind.job={kind:'wait',untilCore:w.tick*10+services.random.integer(125,201)};};
 if(wait&&!wasGoto){startWait();return true;}
 const reach=services.createReachability(),destination=chooseAnimalConfusedDestination256(w,a,nav,reach,services.random);
 if(destination.x===a.x&&destination.z===a.z&&!wasGoto){startWait();return true;}
 const path=reach.pathTo(destination);if(!path){mind.nextMoveOrderIsWait=false;return true;}
 notifyDuckFlightJob256(w,a,'GotoWander',()=>services.random.value());mind.job={kind:'goto',destination};a.path=path;a.state='moving';services.move();return true;
}
