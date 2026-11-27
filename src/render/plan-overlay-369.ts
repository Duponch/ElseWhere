import type {World} from '../sim/types';
import {PLAN_OVERLAY_ALPHA_369,planColorHex369} from '../sim/plans-369';
import type {Placement} from './primitives';

/** Schema 369 plans join the resident ground tint of the zones (one cell
 * texel each, uploaded only when the plans change): no mesh, draw call or
 * per-frame work per cell. Core draws them at the plan colour's alpha 0.4
 * (SectionLayer_Plans, MetaOverlays) whatever "show zones" says, so this
 * layer ignores the zone visibility toggle; a hidden plan is not drawn.
 * Presentation only: the World is never written. */
export const PLAN_TINT_OPACITY_369=PLAN_OVERLAY_ALPHA_369;

/** Literal fallback for renderers without the confirmed-intention reader.
 * Closed MAIN compares reusable primitive ranges instead, so it never pays
 * this serialization on stable frames. A hash alone cannot prove equality. */
export function planOverlaySignature369(world:Pick<World,'plans369'|'width'|'height'>):string {
 const state=world.plans369;if(!state)return '';
 const parts:string[]=[`${world.width}x${world.height}`];
 for(const plan of state.plans){
  parts.push(`${plan.id}:${plan.color}:${plan.hidden?1:0}:${plan.cells.join(',')}`);
 }
 return parts.join(';');
}
/** One tint texel per visible planned cell, in the plan's colour. */
export function planOverlayPlacements369(world:Pick<World,'plans369'|'width'|'height'>):Placement[] {
 const out:Placement[]=[];
 for(const plan of world.plans369?.plans??[]){
  if(plan.hidden)continue;
  const color=planColorHex369(plan.color);
  for(const cell of plan.cells)out.push({x:cell%world.width,y:0,z:Math.floor(cell/world.width),color});
 }
 return out;
}
