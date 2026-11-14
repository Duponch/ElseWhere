import {curve320,populationIntent320} from './population-intent-320.ts';
import type {World} from './types.ts';

/** Core StorytellerComp.TrySelectRandomIncident for Cassandra's home Misc
 * category (schema 329), with the 21 Core incidents of Incidents_Map_Misc.
 *
 * Incidents that cannot fire now leave the pool before weighting. One draw
 * first chooses the population group, with chance (0, 0.05) (1, 0.3)
 * (3, 0.45) on the population intent; a population incident is weighted by
 * max(intent + offset, 0.05), the offset being -0.4 when easy, 0 when medium
 * and +0.4 when hard. An empty or weightless group falls back to the whole
 * pool. Incidents Elsewhere does not have stay in the pool as absent tickets
 * (always able to fire, no effect), except the ransom demand, which needs a
 * kidnapped colonist. Recent-incident weighting is not represented. */
export interface MiscRow329 {
  readonly id:string;
  readonly weight:number;
  /** Population effect offset; null for an incident with no population effect. */
  readonly population:number|null;
  readonly eligible?:()=>boolean;
  readonly resolve?:()=>void;
}
export const MISC_POPULATION_CHANCE_329=[[0,.05],[1,.3],[3,.45]] as const;
export const MISC_MIN_POPULATION_FACTOR_329=.05;
/** Core StorytellerComp_ClassicIntro at day 4.4: a single weighted draw over
 * every home Misc incident (IncidentChanceFinal, so population incidents keep
 * their intent factor), with no CanFireNow filter and no group draw. A drawn
 * incident that cannot fire does nothing. */
export function drawIntroMiscIncident329(world:World,rows:readonly MiscRow329[],random:()=>number):MiscRow329|undefined {
  const intent=populationIntent320(world);
  const weight=(row:MiscRow329)=>row.weight*(row.population===null?1:Math.max(intent+row.population,MISC_MIN_POPULATION_FACTOR_329));
  const total=rows.reduce((sum,row)=>sum+weight(row),0);if(!(total>0))return undefined;
  let roll=random()*total;for(const row of rows){roll-=weight(row);if(roll<0)return row;}
  return rows.at(-1);
}
export function drawMiscIncident329(world:World,rows:readonly MiscRow329[],random:()=>number):MiscRow329|undefined {
  const pool=rows.filter(row=>!row.eligible||row.eligible());
  const intent=populationIntent320(world);
  const population=random()<curve320(intent,MISC_POPULATION_CHANCE_329);
  const weight=(row:MiscRow329)=>row.weight*(row.population===null?1:Math.max(intent+row.population,MISC_MIN_POPULATION_FACTOR_329));
  const pick=(list:readonly MiscRow329[]):MiscRow329|undefined=>{
    const total=list.reduce((sum,row)=>sum+weight(row),0);if(!(total>0))return undefined;
    let roll=random()*total;for(const row of list){roll-=weight(row);if(roll<0)return row;}
    return list.at(-1);
  };
  return pick(pool.filter(row=>population?row.population!==null:row.population===null))??pick(pool);
}
