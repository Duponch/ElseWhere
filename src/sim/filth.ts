import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {structureAnchors} from './structure-navigation.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isSmoothedStone281} from './smooth-floor-terrain-281.ts';
import {terrainAcceptsFilth256} from './natural-terrain-runtime-256.ts';
import { isRoofed } from './roof-rules.ts';
import { isGrowingTerrain } from './soil.ts';
import { captureCleanliness } from './filth-room.ts';
import { ensureFilth,filthRandom,filthCheckPeriod,FILTH_DEFINITIONS,type FilthKind,type FilthRecord } from './filth-rules.ts';
import type { Cell,Pawn,World } from './types.ts';
export type { FilthKind,FilthRecord,FilthState,FilthFeet } from './filth-rules.ts';
export { FILTH_KINDS,FILTH_DEFINITIONS } from './filth-rules.ts';
export { roomCleanliness,captureCleanliness } from './filth-room.ts';
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const inside=(w:World,c:Cell)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
/** Filth needs walkable ground, not an empty storage slot. Tables/chunks can
 * carry traces; walls, cooler shells and natural rock cannot. */
function filthWalkable(w:World,c:Cell):boolean {
  if(!inside(w,c)||!terrainAcceptsFilth256(w.tiles[c.z*w.width+c.x]!))return false;
  // The structures anchored on this in-map cell, from the shared anchor index:
  // the same set as testing every structure's anchor against it.
  return !structureAnchors(w).anchoredAt(c.x,c.z).some(s=>s.kind==='vent'||s.kind==='wall'||s.kind==='cooler');
}
function accepted(w:World,c:Cell,kind:FilthKind,spontaneous=false):boolean {
  const tile=w.tiles[c.z*w.width+c.x]!;
  if(tile.floor||tile.bridge)return true;
  if(!spontaneous)return tile.terrain==='rough-stone'||isSmoothedStone281(tile.terrain)||kind!=='dirt'&&kind!=='trash';
  if(isRoofed(w,c.z*w.width+c.x))return true;
  const room=captureCleanliness(w).room(c);return !!room&&room.cells.size-room.covered<Math.ceil(room.cells.size*.25);
}
function put(w:World,c:Cell,kind:FilthKind,spontaneous=false):boolean {
  if(!filthWalkable(w,c))return false;
  const found=w.filth?.items.find(f=>same(f,c)&&f.kind===kind);
  if(found){if(found.thickness>=5)return false;found.thickness++;found.grownCore=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10;return true;}
  if(!accepted(w,c,kind,spontaneous)||!Number.isSafeInteger(w.nextId+1)||(w.filth?.items.length??0)>=w.width*w.height*(w.schemaVersion>=290?10:w.schemaVersion>=256?9:6))return false;
  const state=ensureFilth(w),d=FILTH_DEFINITIONS[kind],period=filthCheckPeriod(w),now=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10;
  // A cell's phase is stable; adding another trace never rerolls rain chronology.
  const phase=((Math.imul(c.z*w.width+c.x,1103515245)>>>0)%(period));
  const nextCheckCore=now+((phase-now%period+period)%period||period);
  state.items.push({id:w.nextId++,kind,x:c.x,z:c.z,thickness:1,grownCore:now,expiresAfterCore:Math.floor((d.minDays+filthRandom(state)*(d.maxDays-d.minDays))*60000),nextCheckCore});return true;
}
/** Actual deposits only. A blocked/full cell tries the eight neighbors in a
 * private shuffled order; rejected terrain alone does not spill outward. */
export function addFilth(w:World,c:Cell,kind:FilthKind,count=1,spontaneous=false):boolean {
  if(w.schemaVersion<89||kind==='firefoam'&&(Number(w.schemaVersion)!==290&&(Number(w.schemaVersion)!==291&&(Number(w.schemaVersion)!==292&&(Number(w.schemaVersion)!==293&&(Number(w.schemaVersion)!==294&&(Number(w.schemaVersion)!==295&&(Number(w.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(w.schemaVersion)))))))))||w.schemaVersion<256&&(kind==='rock-rubble'||kind==='building-rubble'||kind==='slime')||!inside(w,c)||!Object.hasOwn(FILTH_DEFINITIONS,kind)||!Number.isSafeInteger(count)||count<1||count>100)return false;
  let made=false;
  for(let n=0;n<count;n++){
    if(put(w,c,kind,spontaneous)){made=true;continue;}
    if(filthWalkable(w,c)&&!(w.filth?.items.some(f=>same(f,c)&&f.kind===kind&&f.thickness>=5)))continue;
    const around:Cell[]=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(dx||dz)around.push({x:c.x+dx,z:c.z+dz});
    const state=ensureFilth(w);for(let i=around.length-1;i>0;i--){const j=Math.floor(filthRandom(state)*(i+1));[around[i],around[j]]=[around[j]!,around[i]!];}
    for(const target of around)if(inside(w,target)&&put(w,target,kind)){made=true;break;}
  }return made;
}
export function removeFilth(w:World,f:FilthRecord):void {
  if(!w.filth)return;w.filth.items=w.filth.items.filter(v=>v!==f);
  for(const p of w.pawns)if(p.cleaning?.targets.includes(f.id)){
    const task=p.cleaning,active=task.targets[0]===f.id;task.targets=task.targets.filter(id=>id!==f.id);
    if(active){task.progress=0;task.phase='approach';p.path=[];}
    if(!task.targets.length){delete p.cleaning;p.planCooldown=0;if(p.state==='working')p.state='idle';}
  }
}
export function thinFilth(w:World,f:FilthRecord):void {if(f.thickness>1)f.thickness--;else removeFilth(w,f);}
export function advanceFilth(w:World,rainRate:number):void {
  if(!w.filth?.items.length)return;const state=w.filth,now=w.tick*10,period=filthCheckPeriod(w);
  for(const f of [...state.items])while(f.nextCheckCore<=now&&state.items.includes(f)){
    const when=f.nextCheckCore;f.nextCheckCore+=period;
    if(FILTH_DEFINITIONS[f.kind].rain&&!isRoofed(w,f.z*w.width+f.x)&&filthRandom(state)<Math.max(0,Math.min(1,rainRate)))thinFilth(w,f);
    if(when-f.grownCore>f.expiresAfterCore&&state.items.includes(f))removeFilth(w,f);
  }
}
/** Call once on physical entry, not on edge commitment (x/z can be ahead of
 * rendered arrival). No timers based on wall time or idle standing generation. */
export function recordFilthMovement(w:World,p:Pawn):void {
  if(w.schemaVersion<89||p.state==='dead')return;
  const state=ensureFilth(w),tile=w.tiles[p.z*w.width+p.x]!,feet=p.filthFeet??={carried:[]};
  if(filthRandom(state)<.05)for(let i=feet.carried.length-1;i>=0;i--){const c=feet.carried[i]!;if(filthWalkable(w,p)&&accepted(w,p,c.kind)&&addFilth(w,p,c.kind)){if(--c.thickness===0)feet.carried.splice(i,1);}}
  const gain=(kind:FilthKind)=>{const held=feet.carried.find(c=>c.kind===kind);if(held){if(held.thickness<5)held.thickness++;}else feet.carried.push({kind,thickness:1});};
  if(filthRandom(state)<.1){
    if(!tile.floor&&!tile.bridge&&isGrowingTerrain(tile.terrain)){feet.lastTerrain='dirt';if(!feet.carried.some(c=>c.kind==='dirt'))gain('dirt');}
    for(const f of [...state.items])if(f.kind!=='rock-rubble'&&f.kind!=='building-rubble'&&same(f,p)&&f.thickness>1&&w.tick*10-f.grownCore>400){gain(f.kind);thinFilth(w,f);}
  }
  if(filthRandom(state)<.005)addFilth(w,p,feet.lastTerrain&&filthRandom(state)<.66?'dirt':'trash',1,true);
  if(!feet.carried.length&&!feet.lastTerrain)delete p.filthFeet;
}
export function recordFilthMovement297(w:World,p:Pawn):boolean {
  if(!isCorePhysicalSchema297(Number(w.schemaVersion)))throw Error('Physical filth entry requires297');
  let changed=false;
  if(p.state==='dead')return false;
  const state=ensureFilth(w),tile=w.tiles[p.z*w.width+p.x]!,feet=p.filthFeet??={carried:[]};
  if(filthRandom(state)<.05)for(let i=feet.carried.length-1;i>=0;i--){const c=feet.carried[i]!;if(filthWalkable(w,p)&&accepted(w,p,c.kind)&&addFilth(w,p,c.kind)){changed=true;if(--c.thickness===0)feet.carried.splice(i,1);}}
  const gain=(kind:FilthKind)=>{const held=feet.carried.find(c=>c.kind===kind);if(held){if(held.thickness<5)held.thickness++;}else feet.carried.push({kind,thickness:1});};
  if(filthRandom(state)<.1){
    if(!tile.floor&&!tile.bridge&&isGrowingTerrain(tile.terrain)){feet.lastTerrain='dirt';if(!feet.carried.some(c=>c.kind==='dirt'))gain('dirt');}
    for(const f of [...state.items])if(f.kind!=='rock-rubble'&&f.kind!=='building-rubble'&&same(f,p)&&f.thickness>1&&effectiveCore297(w)-f.grownCore>400){gain(f.kind);thinFilth(w,f);changed=true;}
  }
  if(filthRandom(state)<.005)changed=addFilth(w,p,feet.lastTerrain&&filthRandom(state)<.66?'dirt':'trash',1,true)||changed;
  if(!feet.carried.length&&!feet.lastTerrain)delete p.filthFeet;
  return changed;
}
/** Parent supplies the actual medical bleed rate per day and posture, so a
 * transported patient deposits at their physical carrier rather than old cell. */
export function bleedFilth(w:World,cell:Cell,rate:number,lying:boolean,bodySize=1):boolean {
  if(w.schemaVersion<89||!Number.isFinite(rate)||rate<.1||!inside(w,cell))return false;
  return filthRandom(ensureFilth(w))<Math.min(1,rate*bodySize*(lying?.0004:.004)*10)&&addFilth(w,cell,'blood');
}

/** Only already-carried traces on the new animal/mechanical carrier. No new
 * ambient dirt/trash behaviour is inferred for their older controllers. */
export function recordShipCasketFilthMovement277(w:World,p:Cell&{state:string;filthFeet?:import('./filth-rules.ts').FilthFeet}):void {
 if(!isSchema277OrLater(w.schemaVersion)||p.state==='dead'||!p.filthFeet)return;const feet=p.filthFeet,state=ensureFilth(w);
 if(filthRandom(state)<.05)for(let i=feet.carried.length-1;i>=0;i--){const carried=feet.carried[i]!;if(filthWalkable(w,p)&&accepted(w,p,carried.kind)&&addFilth(w,p,carried.kind)&&--carried.thickness===0)feet.carried.splice(i,1);}
 if(!feet.carried.length&&!feet.lastTerrain)delete p.filthFeet;
}
