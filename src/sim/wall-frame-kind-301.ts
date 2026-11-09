import type {Job,World} from './types.ts';
/** Domain predicate only, not an owner/admission capability. */
import {schemaAtLeast} from './schema-range.ts';
/** The wood wall FinishFrame family: schema 301 and later. */
export const isFinishFrameSchema301=schemaAtLeast(301);
export function isWoodWallFrame301(value:object):boolean{
 const j=value as Partial<Job>;
 return j.kind==='wall'&&j.material==='wood'&&j.construction==='frame'
  &&!('clearance'in j)&&!('furniture'in j)&&!('wallDoor296'in j);
}
/** Only this actual Frame producer changes contact goals. A wooden finished
 * wall targeted for repair/deconstruction keeps its separate historical path. */
export const woodWallTouch301=(w:Pick<World,'schemaVersion'>,target:object):boolean=>isFinishFrameSchema301(Number(w.schemaVersion))&&isWoodWallFrame301(target);
