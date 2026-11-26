import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Pawn} from '../src/sim/types';
import {hostileCells,actorStepAllowed,openHostileDoor} from '../src/sim/combat-navigation';
import {beginHumanThreatCandidates379} from '../src/sim/human-threat-candidates-379';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';

afterEach(()=>setTerrainWriteCacheVerification(false));
test('physical probe skips friendly candidates but reads sleeping, moving and mutual melee blockers exactly',()=>{
 const w=createWorld(44,18,18),base=w.pawns[0]!;
 w.structures=[];w.jobs=[];w.tiles=w.tiles.map(()=>({terrain:'grass'}));
 w.pawns=Array.from({length:50},(_,i):Pawn=>({...structuredClone(base),id:w.nextId++,x:2+i%12,z:2+Math.floor(i/12),state:'idle',orders:{active:null,queue:[]},need:null,cooking:null}));
 const observer=w.pawns[0]!,enemy=w.pawns[1]!,friend=w.pawns[2]!,bystander=w.pawns[30]!;
 enemy.faction='outlaws';enemy.state='sleeping';enemy.motion={from:{x:3,z:3},to:{x:3,z:2},start:w.tick,end:w.tick+5};
 friend.x=2;friend.z=3;
 let reads=0;const bx=bystander.x;Object.defineProperty(bystander,'x',{configurable:true,enumerable:true,get(){reads++;return bx;}});
 const expected=[...hostileCells(w,observer)],blocked={x:3,z:2},leaving={x:3,z:3};
 expect(expected).toEqual([2*w.width+3,3*w.width+3]);
 const expectedSteps=[actorStepAllowed(w,observer,blocked),actorStepAllowed(w,observer,leaving),actorStepAllowed(w,observer,{x:2,z:3})];
 reads=0;
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope({},()=>{
  const close=beginHumanThreatCandidates379(w);
  try{
   for(let i=0;i<20;i++){
    expect([...hostileCells(w,observer)]).toEqual(expected);
    expect([actorStepAllowed(w,observer,blocked),actorStepAllowed(w,observer,leaving),actorStepAllowed(w,observer,{x:2,z:3})]).toEqual(expectedSteps);
   }
   expect(reads).toBe(0);
   observer.melee={order:{targetId:friend.id,startedDowned:false,auto:'social'},strike:null};
   friend.melee={order:{targetId:observer.id,startedDowned:false,auto:'social'},strike:null};
   expect(actorStepAllowed(w,observer,{x:2,z:3})).toBe(false);
   // No structure may be mistaken for a door because of an anchor query.
   expect(openHostileDoor(w,observer,3,2)).toBe(false);
  }finally{close();}
 });
 expect(reads).toBeGreaterThan(0);expect(actorStepAllowed(w,observer,{x:2,z:3})).toBe(false);
});
