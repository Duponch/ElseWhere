import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/index';
import {captureActorPhaseDependencies297,equalActorPhaseDependencies297,patchableDependencyChanges297} from '../src/bridge/actor-phase-dependencies-297';
import {ensureFireState} from '../src/sim/fire-rules';
import {enableWildlife} from '../src/sim/wildlife';

// A capture given an earlier capture keeps the owned copy of every row that is
// exactly equal: same values as a capture from scratch, unchanged rows by identity.
const frozenDeep=(value:unknown):boolean=>value===null||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value as object).every(frozenDeep);
type Data={human:unknown[];animalGroups:unknown[];map:unknown};

test('an unchanged World keeps every owned row and section of the held capture',()=>{
 const world=createWorld(11,48,48),first=captureActorPhaseDependencies297(world),again=captureActorPhaseDependencies297(world,first);
 const a=first.data as Data,b=again.data as Data;
 expect(again).not.toBe(first);expect(b).toEqual(a);expect(Object.keys(b)).toEqual(Object.keys(a));
 expect(b.human).toBe(a.human);expect(b.animalGroups).toBe(a.animalGroups);expect(b.map).toBe(a.map);
 expect(equalActorPhaseDependencies297(first,again)).toBe(true);expect(patchableDependencyChanges297(first,again)).toEqual({humans:[],cargo:false});
 expect(frozenDeep(again.data)).toBe(true);
});

test('a changed human gets a new owned row; every other row is the held one, and the values are those of a capture from scratch',()=>{
 const world=createWorld(11,48,48),held=captureActorPhaseDependencies297(world),pawn=world.pawns[0]!;
 pawn.state='sleeping';
 const reused=captureActorPhaseDependencies297(world,held),scratch=captureActorPhaseDependencies297(world);
 const before=held.data as Data,after=reused.data as Data;
 expect(after).toEqual(scratch.data);expect(equalActorPhaseDependencies297(reused,scratch)).toBe(true);
 expect(after.human).not.toBe(before.human);expect(after.human[0]).not.toBe(before.human[0]);
 for(let i=1;i<after.human.length;i++)expect(after.human[i]).toBe(before.human[i]);
 expect(after.animalGroups).toBe(before.animalGroups);
 // The publisher's decision is the same with either capture.
 expect(patchableDependencyChanges297(held,reused)).toEqual(patchableDependencyChanges297(held,scratch));
 expect(patchableDependencyChanges297(held,reused)).toEqual({humans:[pawn.id],cargo:false});
 expect(frozenDeep(reused.data)).toBe(true);
 // The live record is never retained.
 pawn.state='idle';expect(after).toEqual(scratch.data);
});

test('a capture that is not one of this module is ignored, never trusted',()=>{
 const world=createWorld(11,48,48),real=captureActorPhaseDependencies297(world),forged={format:real.format,data:structuredClone(real.data)} as typeof real;
 const result=captureActorPhaseDependencies297(world,forged);
 expect(result.data).toEqual(real.data);expect((result.data as Data).human).not.toBe((forged.data as Data).human);
});

test('warmed owned key lists still observe same-tick live value and key changes',()=>{
 const world=createWorld(11,48,48),pawn=world.pawns[0]!,appearance=pawn.appearance!;
 const held=captureActorPhaseDependencies297(world),original=JSON.stringify(held.data),color=appearance.hairColor,tick=world.tick;
 for(let i=0;i<3;i++)expect(equalActorPhaseDependencies297(held,captureActorPhaseDependencies297(world,held))).toBe(true);
 appearance.hairColor=color^0x000101;
 const changed=captureActorPhaseDependencies297(world,held),scratch=captureActorPhaseDependencies297(world);
 expect(changed.data).toEqual(scratch.data);expect(equalActorPhaseDependencies297(held,changed)).toBe(false);
 expect(JSON.stringify(held.data)).toBe(original);expect(world.tick).toBe(tick);
 appearance.hairColor=color;
 expect((captureActorPhaseDependencies297(world,held).data as Data).human).toBe((held.data as Data).human);
 // Extra own keys must still reach the complete copy's refusal, even after
 // an otherwise equal live record warmed the comparison's owned key cache.
 for(const key of ['hidden',Symbol('extra')]){
  Object.defineProperty(appearance,key,{value:1,enumerable:typeof key==='symbol',configurable:true});
  expect(()=>captureActorPhaseDependencies297(world,held)).toThrow('Core phase requires plain own data');
  expect(()=>captureActorPhaseDependencies297(world)).toThrow('Core phase requires plain own data');
  Reflect.deleteProperty(appearance,key);
 }
 expect(JSON.stringify(held.data)).toBe(original);
});

test('attachment indexing keeps fire array order, live size edits and removals for humans and animals',()=>{
 const world=createWorld(11,48,48);enableWildlife(world,2);
 const pawn=world.pawns[0]!,animal=world.wildlife!.animals[0]!,state=ensureFireState(world);
 const fire=(attachment:{attachedPawnId:number}|{attachedAnimalId:number}|{},size:number)=>({id:world.nextId++,x:0,z:0,size,bornCore:0,nextPulseCore:15,complexCore:0,spreadCore:0,...attachment});
 state.items=[fire({attachedPawnId:pawn.id},.4),fire({},.5),fire({attachedAnimalId:animal.id},.6),fire({attachedPawnId:pawn.id},.7),fire({attachedAnimalId:animal.id},.8)];
 const rows=(value:ReturnType<typeof captureActorPhaseDependencies297>)=>{
  const data=value.data as {human:unknown[][];animalGroups:[string,unknown[][]][]};
  return {human:data.human.find(row=>row[0]===pawn.id)!.at(-1),animal:data.animalGroups.flatMap(group=>group[1]).find(row=>row[0]===animal.id)!.at(-1)};
 };
 const first=captureActorPhaseDependencies297(world),before=JSON.stringify(first.data);
 expect(rows(first)).toEqual({human:[[state.items[0]!.id,.4],[state.items[3]!.id,.7]],animal:[[state.items[2]!.id,.6],[state.items[4]!.id,.8]]});
 state.items[0]!.size=.9;state.items.splice(2,1);
 const after=captureActorPhaseDependencies297(world,first);
 expect(rows(after)).toEqual({human:[[state.items[0]!.id,.9],[state.items[2]!.id,.7]],animal:[[state.items[3]!.id,.8]]});
 expect(after.data).toEqual(captureActorPhaseDependencies297(world).data);expect(JSON.stringify(first.data)).toBe(before);
});
