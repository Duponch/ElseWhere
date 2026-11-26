import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {animalNavigation} from '../src/sim/wildlife-navigation.ts';
import {randomCellInRegionsNear304} from '../src/sim/animal-idle-wander-304.ts';
import {appendStructureEntries} from '../src/sim/structure-navigation.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import type {World} from '../src/sim/types.ts';

function fixture():World {
 const w=createWorld(379,24,24);w.tiles=w.tiles.map(()=>({terrain:'grass'}));
 w.structures=[];w.piles=[];w.jobs=[];w.resources=[];w.packed=[];
 for(let z=0;z<24;z++)w.structures.push({id:w.nextId++,kind:z===11?'door':'wall',x:12,z,orientation:0,footprint:'standard',...z===11?{door:newDoorState(w.tick)}:{}});
 return w;
}
function draw(w:World,proven:boolean):unknown[] {
 const nav=animalNavigation(w,false,false),{regionTopology:ignored,...cold}=nav;
 let rng=9134;const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;};
 return Array.from({length:12},()=>randomCellInRegionsNear304(w,proven?nav:cold,{x:10,z:11},8,random));
}

test('animal region producer witnesses preserve door crossings and terrain/membership changes exactly',()=>{
 const warm=fixture(),cold=structuredClone(warm),door=warm.structures.find(s=>s.kind==='door')!,coldDoor=cold.structures.find(s=>s.kind==='door')!;
 const initial=animalNavigation(warm,false,false).regionTopology()!;
 for(let phase=0;phase<5;phase++){
  if(phase===1){door.door!.open=coldDoor.door!.open=true;door.door!.from=coldDoor.door!.from=1;}
  if(phase===2){warm.tiles[11*24+10]={terrain:'rock'};cold.tiles[11*24+10]={terrain:'rock'};}
  if(phase===3){const fence={id:warm.nextId++,kind:'fence' as const,x:9,z:12,orientation:0 as const,footprint:'standard' as const};cold.nextId=warm.nextId;appendStructureEntries(warm,fence);cold.structures.push({...fence});}
  if(phase===4){door.door!.forbidden=coldDoor.door!.forbidden=true;}
  expect(draw(warm,true)).toEqual(draw(cold,false));
  const topology=animalNavigation(warm,false,false).regionTopology()!;
  if(phase<=1){expect(topology.base).toBe(initial.base);expect(topology.portals).toBe(initial.portals);}
  else expect(topology.base).not.toBe(initial.base);
 }
});
