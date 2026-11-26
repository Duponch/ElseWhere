import {expect,test} from 'vitest';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {fixture} from './resident-presentation-fixtures-v427';
import type {MaterialPile,Resource} from '../src/sim/types';

// Literal historical replacement oracle: key order, own undefined and exact
// numbers determine whether a compact tuple rebuilds the whole record.
function same(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const left=Object.keys(a),right=Object.keys(b);
 return left.length===right.length&&left.every((key,i)=>key===right[i]&&same((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
}
type Data=Record<string,unknown>;
test('plant age compact selection agrees with literal replacement across nested key and presence edits',()=>{
 const edits:((resource:Resource)=>void)[]=[
  ()=>{},r=>{r.plantLife!.darkTicks=2;},r=>{r.plantLife!.leaflessAt=1;},
  r=>{const life=r.plantLife!,age=life.age;delete (life as Partial<typeof life>).age;life.age=age;},
  r=>{(r.plantLife as unknown as Data).representation=undefined;},r=>{(r as unknown as Data).representation=undefined;},
  r=>{r.growth=.25;},r=>{r.plantLife!.age=-0;},
 ];
 for(const edit of edits){
  const world=fixture(),resource=world.resources[0]!,encoder=new SnapshotEncoder({plantLifeDelta:true});
  resource.plantLife={since:0,age:0,darkTicks:0,nextCheck:200};
  const before=structuredClone(resource);encoder.encode(world,0,1);resource.plantLife.age=1;resource.plantLife.nextCheck=400;edit(resource);
  const life=resource.plantLife!,expected=same({...before,plantLife:{...before.plantLife,age:life.age,darkTicks:life.darkTicks,nextCheck:life.nextCheck}},resource);
  const packet=encoder.encode(world,0,1);if(packet.kind!=='delta')throw Error('Expected delta');
  expect(!!packet.resources?.life).toBe(expected);expect(packet.resources?.upserted.some(r=>r.id===resource.id)??false).toBe(!expected);
 }
});

test('pile clock compact selection agrees with literal replacement across clock shape and nested edits',()=>{
 const edits:((pile:MaterialPile)=>void)[]=[
  ()=>{},p=>{p.rot!.rate=.5;},p=>{p.rot!.rate=undefined;},
  p=>{p.rot={atTick:p.rot!.atTick,progress:p.rot!.progress};},
  p=>{(p.rot as unknown as Data).representation=undefined;},p=>{(p as unknown as Data).representation=undefined;},
  p=>{p.quantity++;},p=>{(p.owner as unknown as Data).representation=undefined;},
  p=>{p.rot!.progress=-0;},
 ];
 for(const edit of edits){
  const world=fixture(),encoder=new SnapshotEncoder({pileRotDelta:true}),pile={id:world.nextId++,kind:'food',item:'rice',quantity:2,
   owner:{type:'ground',x:4,z:4},rot:{progress:0,atTick:0}} as MaterialPile;
  world.piles.push(pile);const before=structuredClone(pile);encoder.encode(world,0,1);pile.rot={progress:1,atTick:1};edit(pile);
  const rot=pile.rot!,expected=same({...before,rot:rot.rate===undefined?{progress:rot.progress,atTick:rot.atTick}:{progress:rot.progress,atTick:rot.atTick,rate:rot.rate}},pile);
  const packet=encoder.encode(world,0,1);if(packet.kind!=='delta')throw Error('Expected delta');
  expect(!!packet.piles?.rotClock).toBe(expected);expect(packet.piles?.upserted.some(p=>p.id===pile.id)??false).toBe(!expected);
 }
});
