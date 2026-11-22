import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler';
import type {MaterialPile} from '../src/sim/types';
import {fixture} from './resident-presentation-fixtures-v427';

// Pile rot clock tuples (piles.rotClock): stored food re-anchors its rot clock at
// every rate change, and such a pile used to travel whole at every complete
// publication. A pile whose record differs only by its rot clock is now sent
// as three numbers. Real encoder, literal decoder and resident assembler; both
// readers must rebuild the live pile, key order included.
type Delta=Extract<SnapshotMessage<true>,{kind:'delta'}>;
function harness(pileRotDelta=true){
 const world=fixture(),encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0,pileRotDelta}),reader=new ResidentPresentationAssembler(),literal=new SnapshotDecoder();
 for(const [index,item] of (['simple-meal','rice'] as const).entries())
  world.piles.push({id:world.nextId++,kind:'food',item,quantity:5,owner:{type:'ground',x:6+index,z:4},rot:{progress:0,atTick:0}} as MaterialPile);
 const packet=()=>structuredClone(encoder.encode(world,0,1));
 const adopt=(value:SnapshotMessage<true>)=>{
  const expected=literal.adopt(structuredClone(value)),actual=reader.adopt(value);
  expect(expected.status,expected.status==='resync'?expected.reason:undefined).toBe('applied');expect(actual.status,actual.status==='resync'?actual.reason:undefined).toBe('applied');
  if(expected.status!=='applied'||actual.status!=='applied')throw Error('Real encoder/assembler or literal reader refused');
  expect(actual.world).toStrictEqual(expected.world);expect(JSON.stringify(actual.world)).toBe(JSON.stringify(expected.world));return actual.world;
 };
 /** The World moves `ticks` on; the food piles re-anchor their clock at a new rate. */
 const reanchor=(ticks:number,rate:number|undefined,piles=food())=>{
  world.tick+=ticks;if(world.corePathBudget297)world.corePathBudget297.tick=world.tick;if(world.deterioration)world.deterioration.lastTick=world.tick;
  for(const pile of piles){const rot=pile.rot!,progress=rot.progress+ticks*(rot.rate??1);pile.rot=rate===undefined?{progress,atTick:world.tick}:{progress,atTick:world.tick,rate};}
 };
 const food=()=>world.piles.filter(p=>p.rot);
 return{world,encoder,reader,literal,packet,adopt,reanchor,food};
}
function delta(packet:SnapshotMessage<true>):Delta{expect(packet.kind).toBe('delta');if(packet.kind!=='delta')throw Error('Expected real delta');return packet;}

test('a re-anchored rot clock travels as three numbers; both readers rebuild the live pile',()=>{
 const h=harness(),a=h.adopt(h.packet());
 h.reanchor(60,.5);
 const packet=delta(h.packet()),rows=packet.piles!.rotClock!;
 expect(packet.piles!.upserted).toEqual([]);expect(rows).toBeInstanceOf(Float64Array);
 expect([...rows]).toEqual(h.food().flatMap(p=>[p.id,p.rot!.progress,p.rot!.atTick,p.rot!.rate!]));
 const b=h.adopt(packet);
 expect(JSON.stringify(b.piles)).toBe(JSON.stringify(h.world.piles));expect(b.piles).toStrictEqual(h.world.piles);
 expect(b.piles[0]).toBe(a.piles[0]);expect(b.piles[1]).not.toBe(a.piles[1]);
 // Back to the full rate: the clock loses its `rate` key (NaN on the wire).
 h.reanchor(30,undefined);
 const back=delta(h.packet());expect(back.piles!.upserted).toEqual([]);expect(Number.isNaN(back.piles!.rotClock![3]!)).toBe(true);
 const c=h.adopt(back);expect(JSON.stringify(c.piles)).toBe(JSON.stringify(h.world.piles));expect(Object.hasOwn(c.piles[1]!.rot!,'rate')).toBe(false);
});

test('without the option, or when anything else changed, the complete pile is sent as before',()=>{
 const plain=harness(false);plain.adopt(plain.packet());plain.reanchor(60,.5);
 const literal=delta(plain.packet());expect(Object.hasOwn(literal.piles!,'rotClock')).toBe(false);expect(literal.piles!.upserted.map(p=>p.id)).toEqual(plain.food().map(p=>p.id));
 expect(JSON.stringify(plain.adopt(literal).piles)).toBe(JSON.stringify(plain.world.piles));

 const h=harness();h.adopt(h.packet());
 const [meal,rice]=h.food() as [MaterialPile,MaterialPile];
 h.reanchor(60,.5);meal.quantity=4;
 const mixed=delta(h.packet());expect(mixed.piles!.upserted.map(p=>p.id)).toEqual([meal.id]);expect([...mixed.piles!.rotClock!]).toEqual([rice.id,rice.rot!.progress,rice.rot!.atTick,.5]);
 expect(JSON.stringify(h.adopt(mixed).piles)).toBe(JSON.stringify(h.world.piles));
 // A clock with a key the tuple cannot carry, or in another key order, stays whole.
 h.reanchor(10,.25);(rice.rot as unknown as Record<string,unknown>).fallout294=3;meal.rot={atTick:meal.rot!.atTick,progress:meal.rot!.progress,rate:.25};
 const whole=delta(h.packet());expect(Object.hasOwn(whole.piles!,'rotClock')).toBe(false);expect(whole.piles!.upserted.map(p=>p.id).sort()).toEqual([meal.id,rice.id].sort());
});

test('an invalid rot tuple is refused by both readers, and the valid packet still commits',()=>{
 const variants:[string,(rows:Float64Array)=>Float64Array][]=[
  ['unknown pile',rows=>new Float64Array([999999,rows[1]!,rows[2]!,rows[3]!])],
  ['same pile twice',rows=>new Float64Array([...rows,...rows])],
  ['truncated tuple',rows=>rows.slice(0,3)],
  ['negative progress',rows=>new Float64Array([rows[0]!,-1,rows[2]!,rows[3]!])],
  ['progress not a number',rows=>new Float64Array([rows[0]!,Number.NaN,rows[2]!,rows[3]!])],
  ['clock in the future',rows=>new Float64Array([rows[0]!,rows[1]!,rows[2]!+1,rows[3]!])],
  ['fractional clock',rows=>new Float64Array([rows[0]!,rows[1]!,rows[2]!+.5,rows[3]!])],
  ['rate above one',rows=>new Float64Array([rows[0]!,rows[1]!,rows[2]!,1.5])],
 ];
 for(const[name,make]of variants){
  // Fresh readers each time: a refusal must leave nothing half applied.
  const h=harness();h.adopt(h.packet());h.reanchor(60,.5);
  const good=delta(h.packet()),bad={...structuredClone(good),piles:{removed:[],upserted:[],rotClock:make(good.piles!.rotClock!)}} as SnapshotMessage<true>;
  expect(h.literal.adopt(structuredClone(bad)).status,name).toBe('resync');expect(h.reader.adopt(bad).status,name).toBe('resync');
 }
 // A pile also sent whole cannot carry a tuple.
 const h=harness();h.adopt(h.packet());h.reanchor(60,.5);
 const good=delta(h.packet()),twice={...structuredClone(good),piles:{removed:[],upserted:[structuredClone(h.food()[0]!)],rotClock:good.piles!.rotClock!}} as SnapshotMessage<true>;
 expect(h.literal.adopt(structuredClone(twice)).status).toBe('resync');expect(h.reader.adopt(twice).status).toBe('resync');
 const fresh=harness();fresh.adopt(fresh.packet());fresh.reanchor(60,.5);
 expect(JSON.stringify(fresh.adopt(delta(fresh.packet())).piles)).toBe(JSON.stringify(fresh.world.piles));
});
