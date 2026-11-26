import {animalContentsLocation256} from './animal-local-contents-256.ts';
import { rotAge, rotRateAtTemperature } from './food-preservation.ts';
import { TemperatureView } from './temperature.ts';
import { pawnContentsLocation,updateHumanCorpseTemperatures } from './human-corpses.ts';
import type { World } from './types.ts';
import type { ThermalLayout } from './thermal-topology.ts';
import {thermalPileOwners379} from './perishable-pile-owners-379.ts';

/** Checkpoint the old rate before adopting temperature at the actual new owner.
 * Warm piles keep their anchors: no age mutations or geometry rebuild per tick. */
export function updateFoodTemperatures(world:World,layout?:ThermalLayout):void {
  updateHumanCorpseTemperatures(world,layout);
  const piles=thermalPileOwners379(world);
  let hasRot=false;
  if(Array.isArray(piles))hasRot=piles.some(p=>p.rot);
  else for(const pile of piles)if(pile.rot){hasRot=true;break;}
  if(!hasRot&&!world.wildlife?.animals.some(a=>a.corpseRot))return;
  const view=new TemperatureView(world,layout);
  // These membership captures are only needed by carried/reserved food. A
  // ground pile or retained animal corpse needs neither map; mutable owners
  // and their current positions are still read afresh on every invocation.
  let pawns:Map<number,World['pawns'][number]>|undefined,jobs:Map<number,World['jobs'][number]>|undefined;
  for(const pile of piles)if(pile.rot) {
    if(pile.humanCorpse)continue;
    const o=pile.owner,owner='pawnId' in o?(pawns??=new Map(world.pawns.map(p=>[p.id,p]))).get(o.pawnId):undefined;
    const contents=owner?.body?pawnContentsLocation(world,owner):!owner&&o.type==='inventory'&&world.schemaVersion>=256?animalContentsLocation256(world,o.pawnId):null;
    const cell=o.type==='ground'?o:owner?(contents?.cell??(owner.body?null:owner)):contents?.cell??(o.type==='job'?(jobs??=new Map(world.jobs.map(j=>[j.id,j]))).get(o.jobId):null);
    if(!cell)continue;
    const rate=contents?.suspended?0:rotRateAtTemperature(view.at(world,cell));
    if(rate===(pile.rot.rate??1))continue;
    const fallout=pile.rot.fallout294;pile.rot={progress:rotAge(pile,world.tick),atTick:world.tick,...rate!==1?{rate}:{},...fallout!==undefined?{fallout294:fallout}:{}};
  }
  // Retained bodies have the same thermal timeline as already transferable
  // corpses, including commands changing a room between simulation ticks.
  for(const a of world.wildlife?.animals??[])if(a.corpseRot){
    const rot=a.corpseRot,rate=rotRateAtTemperature(view.at(world,a));
    if(rate!==(rot.rate??1))a.corpseRot={progress:rot.progress+(world.tick-rot.atTick)*(rot.rate??1),atTick:world.tick,...rate!==1?{rate}:{},...rot.fallout294!==undefined?{fallout294:rot.fallout294}:{}};
  }
}
