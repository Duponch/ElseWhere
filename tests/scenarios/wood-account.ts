import {requiredMaterial} from '../../src/sim/construction-materials.ts';
import type {World} from '../../src/sim/types.ts';

/** Read-only nominal account. Keep this leaf independent of player policies
 * and engine imports so instrumentation can register before its producers. */
export function woodAccount(world:World):number {
  return (world.packed??[]).reduce((n,p)=>n+requiredMaterial(p.building,'wood'),0) + world.deconstructed.lostWood + (world.destroyed?.lost.wood??0) + world.deconstructed.fuelTicks/600 + world.piles.filter(p=>p.kind==='wood'&&p.owner.type!=='orbital-ship').reduce((n,p)=>n+p.quantity,0) + world.resources.filter(r=>r.kind==='tree').reduce((n,r)=>n+r.amount,0) + world.structures.reduce((n,s)=>n+(s.fuel ? ((s.fuel?.ticks??0)+(s.fuel?.burned??0))/600 : requiredMaterial(s,'wood')),0);
}
