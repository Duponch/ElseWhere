import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {bedSlotCell,pawnBedSlot} from './bed-slots.ts';
import {footprintCells} from './definitions.ts';
import {groundFire} from './fire-rules.ts';
import type {Pawn,Structure,World} from './types.ts';
import { structureById } from './structure-navigation.ts';

export type CoupleBedWorld285=Pick<World,'schemaVersion'|'tick'|'structures'>;
export type CoupleBedPawn285=Pick<Pawn,'id'|'x'|'z'|'state'|'bedId'|'bedSlot'|'moveCooldown'|'motion'|'coupleTask285'>;

/** Bed usability is distinct from a reader's physical lying posture. */
export function coupleBedBurning285(world:Pick<World,'fires'>,bed:Structure):boolean {
 if(!world.fires?.items.length)return false;
 const cells=footprintCells(bed);
 return world.fires.items.some(f=>groundFire(f)&&cells.some(c=>c.x===f.x&&c.z===f.z));
}

/** Confirmed physical posture only. Admission, partner and exclusive claims
 * belong to the task's simulation/owner guards, never to a renderer query. */
export function coupleBed285(world:CoupleBedWorld285,pawn:CoupleBedPawn285):Structure|undefined {
 const task=pawn.coupleTask285;
 if(!isSchema285OrLater(world.schemaVersion)||!task||pawn.state==='dead'||pawn.moveCooldown!==0||(pawn.motion?.end??0)>world.tick)return;
 const bed=structureById(world,task.bedId);
 if(!bed||bed.kind!=='double-bed'||bed.medical||bed.prisoner||pawnBedSlot(pawn,bed)!==task.slot)return;
 const cell=bedSlotCell(bed,task.slot);
 return cell&&pawn.x===cell.x&&pawn.z===cell.z?bed:undefined;
}
