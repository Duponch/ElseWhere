import {structureFamily379} from './structure-family-379.ts';
import { advanceFlowerPot,createFlowerPotState,daylilyStatus } from './flower-pot.ts';
import type { LightEnvironment } from './light-environment.ts';
import { plantTemperatureFactor,sowingTemperatureAllowed } from './plants.ts';
import type { TemperatureView } from './temperature.ts';
import type { Job,World } from './types.ts';

const due=(world:World,id:number,kind:'sow'|'cut')=>world.jobs.some(j=>j.flowerPotId===id&&j.kind===kind);
const job=(world:World,id:number,kind:'sow'|'cut',x:number,z:number):Job=>({id:world.nextId++,flowerPotId:id,kind,x,z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});

/** Pots share the ordinary Grow work queue; growth itself remains a sparse
 * state on the structure and never creates a second map resource. */
export function advanceFlowerPots(world:World,light:LightEnvironment,temperature:TemperatureView):void {
  if(world.schemaVersion<90)return;
  for(const pot of structureFamily379(world,'flower-pots',kind=>kind==='flower-pot')){if(pot.kind!=='flower-pot')continue;pot.flower??=createFlowerPotState();
    if(pot.flower.plant)pot.flower=advanceFlowerPot(pot.flower,world.tick,{growthFactor:plantTemperatureFactor(temperature.at(world,pot)),glow:light.lightAt(pot)});
  }
  if(world.tick%10)return;
  for(const pot of structureFamily379(world,'flower-pots',kind=>kind==='flower-pot')){if(pot.kind!=='flower-pot'||!pot.flower)continue;
    if(pot.flower.plant&&daylilyStatus(pot.flower.plant)==='dead'){if(!due(world,pot.id,'cut')&&Number.isSafeInteger(world.nextId+1))world.jobs.push(job(world,pot.id,'cut',pot.x,pot.z));}
    else if(pot.flower.allowSow&&!pot.flower.plant&&sowingTemperatureAllowed(temperature.at(world,pot))&&!due(world,pot.id,'sow')&&Number.isSafeInteger(world.nextId+1))world.jobs.push(job(world,pot.id,'sow',pot.x,pot.z));
  }
}
