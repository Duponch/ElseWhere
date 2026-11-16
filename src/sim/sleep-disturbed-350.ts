import {memoryExpiry271} from './suspended-memory-271.ts';
import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {sharedLightEnvironmentCache} from './light-environment.ts';
import {MOOD_POOL_MEMORIES_350,gainMoodPoolMemory350,isMoodPool350} from './mood-pool-memories-350.ts';
import type {Pawn,World} from './types.ts';

/* Schema 350, SleepDisturbed (Pawn.CheckForDisturbedSleep, GenClamor,
 * Pawn_PathFollower.TryEnterNextPathCell): a humanlike pawn entering a cell
 * makes a movement clamor every twelfth cell (cellsUntilClamor); every pawn
 * within 7 cells × its hearing, reached through open regions, hears it. A
 * sleeping colonist with mood, not disturbed in the last 300 Core ticks,
 * gains SleepDisturbed unless the mover is its lover or spouse.
 * Adaptations: the twelfth cell is drawn from the pawn's identity and the
 * Core tick (one cell in twelve on average, no saved counter), and the hearer
 * must be in the mover's room: a door, open or closed, ends the clamor. */
export function movementClamor350(w:World,mover:Pawn,coreTick:number):void {
 if(!isMoodPool350(w.schemaVersion)||mover.state==='dead')return;
 let h=(Math.imul(mover.id,0x9e3779b1)^Math.imul(coreTick,0x85ebca6b)^0x350c1a)>>>0;
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
 if((h>>>0)%12!==0)return;
 let room:number|null|undefined;
 for(const q of w.pawns){
  if(q===mover||q.state!=='sleeping'&&!q.medicalSleep||!isColonist(q)||q.prisoner||q.visitor||q.health?.death||q.cryptosleepHeldAt271!==undefined||q.shipCryptosleepHeldAt277!==undefined)continue;
  const hearing=Math.max(0,Math.min(1,pawnBody(q).capacities.hearing));
  if(hearing<=0||(q.x-mover.x)**2+(q.z-mover.z)**2>(7*hearing)**2)continue;
  const last=q.roomMemories?.filter(m=>m.kind==='sleep-disturbed').reduce((n,m)=>Math.max(n,memoryExpiry271(m,m.expiresAt)-MOOD_POOL_MEMORIES_350['sleep-disturbed'].duration),-Infinity)??-Infinity;
  if(w.tick-last<30)continue;
  if(w.relationships?.links.some(l=>(l.kind==='lover'||l.kind==='spouse')&&(l.aId===q.id&&l.bId===mover.id||l.bId===q.id&&l.aId===mover.id)))continue;
  room??=roomOf350(w,mover.x,mover.z);
  if(room===null||roomOf350(w,q.x,q.z)!==room)continue;
  gainMoodPoolMemory350(q,'sleep-disturbed',w.tick);
 }
}
function roomOf350(w:World,x:number,z:number):number|null {
 const space=sharedLightEnvironmentCache(w).read(w).topology.at(x,z);
 return space?.kind==='space'?space.id:null;
}
