import {isDoubleBedKind,isGroundSleepingSpotKind,isBedrollKind} from './bed-kinds.ts';
import { isBedKind } from './bed-kinds.ts';
import { bedSlotCell,pawnBedSlot } from './bed-slots.ts';
import { carrierOf } from './rescue-state.ts';
import { activeVitalsMonitor } from './vitals-monitor.ts';
import type { Pawn,Structure,World } from './types.ts';

/** Current physical service only. A reservation, journey or carried body is
 * not a bed use. Callers already resolving the carrier can supply that result. */
export function currentMedicalBed(world:World,pawn:Pawn,carried=!!carrierOf(world,pawn.id)):Structure|undefined {
  const need=pawn.need;
  if(carried||pawn.state==='dead'||pawn.health?.death||pawn.moveCooldown!==0||pawn.motion&&pawn.motion.end>world.tick||
    !['sleeping','resting','downed'].includes(pawn.state)||need?.kind!=='sleep'||need.phase!=='sleep'||need.bedId===null)return;
  return world.structures.find(bed=>{
    if(bed.id!==need.bedId||!isBedKind(bed.kind))return false;
    if(isDoubleBedKind(bed.kind)){
      const slot=pawnBedSlot(pawn,bed),cell=slot===undefined?undefined:bedSlotCell(bed,slot);
      return world.schemaVersion>=224&&!bed.medical&&!bed.prisoner&&!pawn.prisoner&&!pawn.visitor&&!!cell
        &&cell.x===pawn.x&&cell.z===pawn.z&&need.target.x===cell.x&&need.target.z===cell.z;
    }
    if(bed.kind==='sleeping-spot')return world.schemaVersion>=232&&bed.x===pawn.x&&bed.z===pawn.z&&need.target.x===bed.x&&need.target.z===bed.z;
    return (bed.kind!=='hospital-bed'||world.schemaVersion>=187)&&bed.x===pawn.x&&bed.z===pawn.z;
  });
}
/** Quality remains a separate consumer factor. With a World, a current powered
 * facility adds offsets to the hospital bed's definition statistics once. */
type BedDefinition=Pick<Structure,'kind'>&Partial<Pick<Structure,'id'>>;
function monitored(bed:BedDefinition,world:World|undefined):boolean {
  if(!world||bed.kind!=='hospital-bed'||bed.id===undefined)return false;
  const current=world.structures.find(s=>s.id===bed.id&&s.kind==='hospital-bed');
  return !!current&&!!activeVitalsMonitor(world,current);
}
export const bedTendOffset=(bed:BedDefinition|undefined,world?:World):number=>bed?.kind==='hospital-bed'?(monitored(bed,world)?.17:.1):0;
export const bedImmunityFactor=(bed:BedDefinition,world?:World):1|1.05|1.07|1.11|1.13=>isGroundSleepingSpotKind(bed.kind)?1:isBedrollKind(bed.kind)?1.05:bed.kind==='hospital-bed'?(monitored(bed,world)?1.13:1.11):1.07;
export const bedHealPerDay=(bed:BedDefinition):0|4|10=>isGroundSleepingSpotKind(bed.kind)?0:bed.kind==='hospital-bed'?10:4;
export const bedSurgeryFactor=(bed:BedDefinition,world?:World):number=>isGroundSleepingSpotKind(bed.kind)?.7:bed.kind==='hospital-bed'?(monitored(bed,world)?1.15:1.1):1;
