import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {addFilth,removeFilth,thinFilth,recordFilthMovement297} from '../src/sim/filth.ts';
import {captureCleanliness} from '../src/sim/filth-room.ts';
import {filthAtCell379,filthAtKind379,filthById379,filthInRoom379,filthInHome379} from '../src/sim/filth-directory-379.ts';
import {inHome} from '../src/sim/repairs.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal.ts';
import type {FilthRecord} from '../src/sim/filth-rules.ts';
import type {World} from '../src/sim/types.ts';

afterEach(()=>setTerrainWriteCacheVerification(false));
function fixture():World {
 const world=createWorld(88,24,24);world.tick=2000;world.structures=[];world.resources=[];world.jobs=[];world.piles=[];
 world.tiles=world.tiles.map((_,i)=>({terrain:'grass',floor:i%2?'steel-tile':'sterile-tile'}));
 for(let z=2;z<=8;z++)for(let x=2;x<=8;x++)if(x===2||x===8||z===2||z===8)world.structures.push({id:world.nextId++,kind:x===2&&z===5?'door':'wall',x,z,orientation:0,footprint:'standard'});
 world.roofing={constructed:[],build:[],remove:[],cursor:0};
 world.home=Array.from({length:world.width*world.height},(_,i)=>i).filter(i=>i%world.width<9&&Math.floor(i/world.width)<9);
 const items:FilthRecord[]=[];
 for(let i=0;i<180;i++){const inside=i%7===0;items.push({id:world.nextId++,kind:i%3?'dirt':'blood',x:inside?3+i%5:10+i%12,z:inside?3+Math.floor(i/7)%5:10+Math.floor(i/12)%12,thickness:1+i%3,grownCore:0,expiresAfterCore:3000000,nextCheckCore:world.tick*10+100});}
 items.push({id:world.nextId++,kind:'ash',x:2,z:5,thickness:1,grownCore:0,expiresAfterCore:1000000,nextCheckCore:world.tick*10+100});
 world.filth={rng:91,items,cleaned:0};return world;
}
function continuation(source:World,closed:boolean):unknown[] {
 const owner={},results:unknown[]=[],observe=()=>{
  const capture=captureCleanliness(source),inside={x:4,z:4},door={x:2,z:5},outside={x:15,z:15};
  results.push({world:structuredClone(source),rooms:[capture.room(inside),capture.room(door),capture.room(outside)],cell:[...filthAtCell379(source,inside)],id:filthById379(source,source.filth!.items[3]!.id),home:[...(filthInHome379(source)??source.filth!.items.filter(f=>inHome(source,f.z*source.width+f.x)))]});
 };
 const run=(action:()=>void)=>closed?withJournalTerrainReadScope(owner,action):action();
 run(observe);
 for(let step=0;step<14;step++)run(()=>{
  source.tick++;if(step%2===0)addFilth(source,{x:3+step%5,z:4},step%3?'dirt':'blood');
  if(step===7)source.home=source.home!.filter(i=>i%source.width<6);
  if(step%3===0)removeFilth(source,source.filth!.items[3]!);if(step%4===0)thinFilth(source,source.filth!.items.at(-1)!);
  const pawn=source.pawns[0]!;pawn.x=4;pawn.z=4;pawn.filthFeet={carried:[{kind:'blood',thickness:2}]};recordFilthMovement297(source,pawn);
  observe();
 });
 run(()=>{source.filth!.items=source.filth!.items.slice().reverse();observe();});
 return results;
}
test('filth producer indexing preserves every source-ordered room sum, movement draw and membership commit',()=>{
 const source=fixture(),expected=continuation(structuredClone(source),false);
 setTerrainWriteCacheVerification(true);expect(continuation(structuredClone(source),true)).toStrictEqual(expected);
});
test('room captures skip unrelated filth after committed removals without changing fractional floor accumulation',()=>{
 const world=fixture(),owner={},inside={x:4,z:4};
 withJournalTerrainReadScope(owner,()=>filthAtCell379(world,inside));
 const other=world.filth!.items.find(record=>record.x>10)!,x=other.x;let reads=0;
 Object.defineProperty(other,'x',{configurable:true,enumerable:true,get(){reads++;return x;}});
 const first=withJournalTerrainReadScope(owner,()=>captureCleanliness(world).cleanliness(inside));expect(reads).toBe(0);
 withJournalTerrainReadScope(owner,()=>removeFilth(world,world.filth!.items[0]!));
 const next=withJournalTerrainReadScope(owner,()=>captureCleanliness(world).cleanliness(inside));expect(reads).toBe(0);
 expect(captureCleanliness(world).cleanliness(inside)).toBe(next);expect(reads).toBeGreaterThan(0);expect(first).not.toBeNull();
});
test('unknown arrays and malformed duplicate identities retain exhaustive ordering, while verification rejects unmarked edits',()=>{
 const world=fixture(),owner={},read=()=>withJournalTerrainReadScope(owner,()=>filthAtCell379(world,{x:4,z:4}));read();
 world.filth!.items.reverse();setTerrainWriteCacheVerification(true);expect(read).toThrow('differs from its source order');
 setTerrainWriteCacheVerification(false);world.filth!.items=world.filth!.items.slice();read();
 const original=world.filth!.items[0]!;world.filth!.items=[...world.filth!.items,{...original}];
 const capture=captureCleanliness(world),space=capture.topology.at(4,4)!;
 expect(withJournalTerrainReadScope(owner,()=>filthInRoom379(world,capture.topology,space.kind==='space'?space.id:0))).toBeUndefined();
 expect(withJournalTerrainReadScope(owner,()=>filthAtKind379(world,original,original.kind))).toBe(original);
});
