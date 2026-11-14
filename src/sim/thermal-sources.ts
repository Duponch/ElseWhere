import { isPowerActive } from './power-rules.ts';
import { applyHeaterHeat } from './heater.ts';
import { SUN_LAMP_HEAT_PER_SECOND,sunLampActive } from './sun-lamp.ts';
import { cookingSpot } from './cooking-bills.ts';
import { filteredStructures } from './structure-navigation.ts';
import type { Structure, World } from './types.ts';
import type { ThermalLayout } from './thermal-topology.ts';

/** Heat per Core second, distributed over six local steps. Fuel consumption
 * stays independent: an idle or outdoor passive cooler still uses its wood.
 * As with the fire, continuous clamping replaces Core's staggered impulses. */
/** The only kinds the loop below changes anything for (any other structure
 * reaches no branch); kinds never change, so the shared filtered list has the
 * same structures, in the same order, as the scan. */
const THERMAL_SOURCE_KINDS=new Set<Structure['kind']>(['heater','insect-hive','sun-lamp','electric-smithy','electric-smelter','electric-crematorium','electric-stove','fueled-stove','wood-generator','chemfuel-generator','torch-lamp','campfire','passive-cooler']);
export function applyThermalSources(world:World,layout:ThermalLayout):void {
  const regions=world.thermal?.regions;
  for(const source of filteredStructures(world,'thermal-sources',s=>THERMAL_SOURCE_KINDS.has(s.kind))) {
    if(source.kind==='heater'){applyHeaterHeat(world,source,layout);continue;}
    if(!regions)continue;
    if(source.kind==='insect-hive') {
      const id=layout.indices[source.z*world.width+source.x]!;if(id<0)continue;
      const room=regions[id]!;if(room.temperature<38)room.temperature=Math.min(38,room.temperature+6/6/room.cells.length);continue;
    }
    if(source.kind==='sun-lamp') {
      if(!sunLampActive(world,source))continue;
      const id=layout.indices[source.z*world.width+source.x]!;if(id<0)continue;
      const room=regions[id]!;
      room.temperature=Math.min(1000,room.temperature+SUN_LAMP_HEAT_PER_SECOND/6/room.cells.length);
      continue;
    }
    if(source.kind==='electric-smithy'||source.kind==='electric-smelter'||source.kind==='electric-crematorium'){
      if(!isPowerActive(source))continue;
      const cell=source.kind==='electric-crematorium'?cookingSpot(source):source;
      const id=layout.indices[cell.z*world.width+cell.x]!;if(id<0)continue;
      const room=regions[id]!;room.temperature=Math.min(1000,room.temperature+(source.kind==='electric-smithy'?4:source.kind==='electric-crematorium'?12:9)/6/room.cells.length);continue;
    }
    if(source.kind==='electric-stove'?!isPowerActive(source):!source.fuel?.ticks)continue;
    const id=layout.indices[source.z*world.width+source.x]!;if(id<0)continue;
    const room=regions[id]!;
    if(source.kind==='fueled-stove'||source.kind==='electric-stove')room.temperature=Math.min(1000,room.temperature+(source.kind==='fueled-stove'?4:3)/6/room.cells.length);
    else if((source.kind==='wood-generator'||source.kind==='chemfuel-generator')&&isPowerActive(source))room.temperature=Math.min(1000,room.temperature+1/room.cells.length);
    else if(source.kind==='torch-lamp'&&room.temperature<23)room.temperature=Math.min(23,room.temperature+3.5/6/room.cells.length);
    else if(source.kind==='campfire'&&room.temperature<28)room.temperature=Math.min(28,room.temperature+21/6/room.cells.length);
    else if(source.kind==='passive-cooler'&&room.temperature>17)room.temperature=Math.max(17,room.temperature-11/6/room.cells.length);
  }
}
/** The work itself adds .1 heat per Core tick (one per local tick).
 * Heat is applied immediately; no ephemeral work flag affects save/replay. */
export function applyCookingHeat(world:World,station:Structure,fraction=1):void {
  if(station.kind!=='electric-crematorium'&&station.kind!=='electric-smelter'&&station.kind!=='fueled-stove'&&station.kind!=='electric-stove')return;
  const cell=station.kind==='electric-crematorium'?cookingSpot(station):station;
  const index=cell.z*world.width+cell.x;
  for(const room of world.thermal?.regions??[]) {
    let lo=0,hi=room.cells.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(room.cells[mid]!<index)lo=mid+1;else hi=mid;}
    if(room.cells[lo]===index){room.temperature=Math.min(1000,room.temperature+fraction*(station.kind==='electric-crematorium'||station.kind==='electric-smelter'?3.2:1)/room.cells.length);return;}
  }
}
