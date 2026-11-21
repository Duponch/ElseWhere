import { footprintContains } from './definitions.ts';
import { WALL_LAMP_363,wallLampWallCell363 } from './furniture-c-363.ts';
import type { Cell,World } from './types.ts';

/** Schema 363 WallLamp (Placeworker_AttachedToWall, GenConstruct). The wall in
 * front of the rotation is a wall (supportsWallAttachments) or a natural rock
 * wall. A wall plan counts at placement (BuiltDefOf of a blueprint or frame);
 * the lamp itself can only be finished on a real wall (GenConstruct.CanConstruct). */
export function wallLampSupported363(world:Pick<World,'width'|'height'|'tiles'|'structures'|'jobs'>,lamp:Cell&{orientation?:number},finishedOnly:boolean):boolean {
  const c=wallLampWallCell363(lamp);
  if(c.x<0||c.z<0||c.x>=world.width||c.z>=world.height)return false;
  if(world.tiles[c.z*world.width+c.x]?.terrain==='rock')return true;
  if(world.structures.some(s=>s.kind==='wall'&&footprintContains(s,c)))return true;
  return !finishedOnly&&world.jobs.some(j=>j.kind==='wall'&&j.x===c.x&&j.z===c.z);
}
export function wallLampPlacementRefusal363(world:World,lamp:Cell&{orientation?:number}):string|undefined {
  return wallLampSupported363(world,lamp,false)?undefined:'Placez l’applique contre un mur ou une paroi rocheuse, tournée vers lui.';
}
/** CompGlower of the wall lamp: radius 11, colour (214,148,94), at its own cell. */
export const WALL_LAMP_GLOW_363=Object.freeze({radius:WALL_LAMP_363.glowRadius,red:WALL_LAMP_363.red,green:WALL_LAMP_363.green,blue:WALL_LAMP_363.blue});
