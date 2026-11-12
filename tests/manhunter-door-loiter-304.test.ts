import {expect,test} from 'vitest';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {processAnimalManhunter} from '../src/sim/animal-manhunter.ts';
import {animalDoorPassingNavigation,animalNavigation} from '../src/sim/wildlife-navigation.ts';
import {blockedCells} from '../src/sim/pathfinding.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import type {World} from '../src/sim/types.ts';

// Both colonists inside a walled room whose only door is closed; a manhunter
// outside cannot reach them without bashing the door (JobGiver_Manhunter).
function shelter(version:number){
 const w=deconstructionCamp(2,32);w.resources.push({id:w.nextId++,kind:'berries',x:25,z:25,amount:10,growth:1,growthTick:w.tick});enableWildlife(w,1);w.schemaVersion=version as World['schemaVersion'];
 w.pawns[0]!.x=4;w.pawns[0]!.z=10;w.pawns[1]!.x=8;w.pawns[1]!.z=6;
 for(let x=2;x<=10;x++)for(const z of [4,12])fixtureBuilding(w,'wall',x,z);
 for(let z=5;z<=11;z++){fixtureBuilding(w,'wall',2,z);if(z===8){const door=fixtureBuilding(w,'door',10,z);door.door=newDoorState(w.tick);}else fixtureBuilding(w,'wall',10,z);}
 const a=w.wildlife!.animals[0]!;Object.assign(a,{x:25,z:25,path:[],state:'idle',nextDecision:w.tick});delete a.motion;
 a.health={...createMedicalRecord(w.tick),body:a.species};a.manhunter={startedAtCore:w.tick*10,rng:12345,zeroRestTicks:0};
 return {w,a};
}
const decide=(w:World,a:World['wildlife'] extends infer S?NonNullable<S>['animals'][number]:never)=>(w.corePathBudget297={tick:w.tick,remaining:8,pairs:32768},
 processAnimalManhunter(w,a,animalNavigation(w),blockedCells(w,true),()=>true,()=>animalDoorPassingNavigation(w,a)));

test('schema 304: a manhunter whose targets are shut behind a door walks to loiter near that door',()=>{
 const {w,a}=shelter(304);
 expect(decide(w,a)).toBe(true);
 expect(a.manhunter!.targetId).toBeUndefined();
 // A Goto to a cell of the regions near the cell before the door (11, 8),
 // outside the room; the first step is already taken.
 const end=a.path.at(-1)??{x:a.x,z:a.z};
 expect(a.path.length+(a.x!==25||a.z!==25?1:0)).toBeGreaterThan(0);
 expect(end.x>10||end.z<4||end.z>12).toBe(true);
 expect(Math.max(Math.abs(end.x-11),Math.abs(end.z-8))).toBeLessThanOrEqual(36);
});

test('schema 303 keeps the earlier rule: no route, the manhunter stays where it is',()=>{
 const {w,a}=shelter(303);
 expect(decide(w,a)).toBe(true);
 expect(a.path).toEqual([]);expect({x:a.x,z:a.z}).toEqual({x:25,z:25});
});
