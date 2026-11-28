import {PowerTopologyCache,bestPowerParent,validPowerParent} from './power-topology.ts';
import type {World} from './types.ts';

/** Keep historical exact power relationships when still physically admitted.
 * A parent at the old free-cell range boundary may be outside the correct
 * support-wall range. Only that consumer is reconnected, without allocating
 * anything or drawing RNG. Applies to every actual local map owner. */
export function migrateWallLampPower382(world:World):void {
  const maps=[world,...(world.worldMaps?.sites.flatMap(s=>s.map?[s.map]:[])??[]),...(world.secondarySite?[world.secondarySite.map]:[])];
  for(const map of maps){
    const lamps=map.structures.filter(s=>s.kind==='wall-lamp'&&s.power?.parentId!=null);
    if(!lamps.length)continue;
    const topology=new PowerTopologyCache().read(map as World);
    for(const lamp of lamps){
      if(validPowerParent(topology,lamp,lamp.power!.parentId!,382))continue;
      lamp.power!.parentId=bestPowerParent(topology,lamp,undefined,382);
      lamp.power!.on=false;
    }
  }
}
