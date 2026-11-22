import {schemaAtLeast} from './schema-range.ts';
import type {Pawn,World} from './types.ts';

export const isSchema371OrLater=schemaAtLeast(371);

/** Schema 371: a plant that appears on a cell where a growing zone's sowing
 * is pending withdraws that sowing. RimWorld's WildPlantSpawner does not look
 * at sowing (it is not a Thing there): the plant grows, and WorkGiver_GrowerSow
 * then asks for the blocking plant to be cut before sowing. Elsewhere keeps
 * sowing as a stored intention, which cannot stand under a plant, so it is
 * removed, its grower released, and the zone's ordinary discovery finds the
 * cut-then-sow intention again. Called after a step that may create plants,
 * with the World.nextId of before that step: only resources created by the
 * step are read, and nothing is drawn. */
export function withdrawSowingUnderNewPlants371(world:World,nextIdBefore:number,release:(pawn:Pawn)=>void):void {
  if(!isSchema371OrLater(Number(world.schemaVersion))||world.nextId===nextIdBefore)return;
  let cells:Set<number>|undefined;
  for(const resource of world.resources)if(resource.id>=nextIdBefore)(cells??=new Set()).add(resource.z*world.width+resource.x);
  if(!cells)return;
  let ids:Set<number>|undefined;
  for(const job of world.jobs)if(job.kind==='sow'&&job.growingZoneId!==undefined&&cells.has(job.z*world.width+job.x))(ids??=new Set()).add(job.id);
  if(!ids)return;
  for(const pawn of world.pawns)if(pawn.jobId!==null&&ids.has(pawn.jobId))release(pawn);
  world.jobs=world.jobs.filter(job=>!ids.has(job.id));
}
