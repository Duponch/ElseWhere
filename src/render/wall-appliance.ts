import type {Structure} from '../sim/types';
import {doorLeafTop} from './door-parts';

/** Presentation only. Air transfer, blocking and the one-cell footprint stay
 * entirely in the simulation. A compact unit sits above a solid wall sill. */
export const WALL_APPLIANCE_TOP=doorLeafTop(false);
export const WALL_APPLIANCE_BOTTOM=WALL_APPLIANCE_TOP-.48;
export const isWallAppliance=(kind:Structure['kind']):boolean=>kind==='vent'||kind==='cooler';

/** The appliance is metal; the masonry around it belongs to the wall it
 * replaces. Read the two lateral neighbours, perpendicular to its airflow. */
export function wallApplianceSurroundMaterial(s:Structure,wallAt:(x:number,z:number)=>Structure['material']|undefined):Structure['material'] {
  const acrossX=s.orientation%2===0;
  const a=wallAt(s.x+(acrossX?1:0),s.z+(acrossX?0:1)),b=wallAt(s.x-(acrossX?1:0),s.z-(acrossX?0:1));
  return a!==undefined&&a===b?a:a??b??'wood';
}
