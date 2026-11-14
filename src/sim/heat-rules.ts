import { apparelInsulation } from './apparel-rules.ts';
export { apparelInsulation } from './apparel-rules.ts';
import { wornPiles } from './pile-index.ts';
import type { Pawn,World } from './types.ts';

export { HEAT_UNIT,HEAT_SERIOUS,heatStage,HEAT_LABELS,heatModifiers,heatExcess,nextHeatSeverity } from './heat-severity.ts';

export function comfortableTemperature(world:World,pawn:Pawn):{min:number;max:number} {
  let min=16,max=26;
  // The wearer's apparel piles in array order (from the pile index inside a step).
  for(const p of wornPiles(world,pawn.id)){const n=apparelInsulation(p);min-=n.cold;max+=n.heat;}
  return {min,max};
}
