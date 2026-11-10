import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler';
import {readSnapshotChanges} from '../src/bridge/snapshot-changes';
import {readResidentResourceBaseChanges} from '../src/bridge/resident-resource-base-journal';
import {createPlantLife,PLANT_LIFE_INTERVAL} from '../src/sim/plant-life';
import {adoptSiteClimate} from '../src/sim/site-climate';
import {fixture} from './resident-presentation-fixtures-v427';

// Plant age tuples (resources.life): a plant whose age record alone advanced
// (age, darkTicks, nextCheck) is sent as three numbers. Real encoder, literal
// decoder and resident assembler; both readers must rebuild the live record.
type Delta=Extract<SnapshotMessage<true>,{kind:'delta'}>;
function harness(plantLifeDelta=true){
 const world=fixture(),encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta}),reader=new ResidentPresentationAssembler(),literal=new SnapshotDecoder();
 // An age record is only valid under a site climate.
 adoptSiteClimate(world);for(const r of world.resources)r.plantLife??=createPlantLife(world,r);
 const packet=()=>structuredClone(encoder.encode(world,0,1));
 const adopt=(value:SnapshotMessage<true>)=>{
  const expected=literal.adopt(structuredClone(value)),actual=reader.adopt(value);
  expect(expected.status,expected.status==='resync'?expected.reason:undefined).toBe('applied');expect(actual.status,actual.status==='resync'?actual.reason:undefined).toBe('applied');
  if(expected.status!=='applied'||actual.status!=='applied')throw Error('Real encoder/assembler or literal reader refused');
  expect(actual.world).toStrictEqual(expected.world);expect(JSON.stringify(actual.world)).toBe(JSON.stringify(expected.world));return actual.world;
 };
 /** The periodic check of the simulation (advancePlantLife) for the next `count`
  * due plants, in due order: the World moves to the check tick of each plant.
  * Returns their indices. */
 const check=(count:number,dark:readonly number[]=[]):number[]=>{
  const done:number[]=[];
  for(let n=0;n<count;n++){
   const index=world.resources.reduce((best,r,i)=>r.plantLife!.nextCheck<world.resources[best]!.plantLife!.nextCheck?i:best,0),life=world.resources[index]!.plantLife!;
   world.tick=life.nextCheck;if(world.corePathBudget297)world.corePathBudget297.tick=world.tick;if(world.deterioration)world.deterioration.lastTick=world.tick;
   const elapsed=world.tick-Math.max(life.since,life.nextCheck-PLANT_LIFE_INTERVAL);
   life.nextCheck+=PLANT_LIFE_INTERVAL;life.age+=elapsed;life.darkTicks=dark.includes(index)?life.darkTicks+elapsed:0;done.push(index);
  }
  return done;
 };
 return{world,encoder,reader,literal,packet,adopt,check};
}
function delta(packet:SnapshotMessage<true>):Delta{expect(packet.kind).toBe('delta');if(packet.kind!=='delta')throw Error('Expected real delta');return packet;}

test('an aged plant travels as three numbers; both readers rebuild the live record and report no base change',()=>{
 const h=harness(),a=h.adopt(h.packet());
 h.check(2,[1]);
 const packet=delta(h.packet()),rows=packet.resources!.life!;
 expect(packet.resources!.upserted).toEqual([]);expect(Object.hasOwn(packet.resources!,'growth')).toBe(false);expect(rows).toBeInstanceOf(Float64Array);
 expect([...rows]).toEqual(h.world.resources.flatMap(r=>[r.id,r.plantLife!.age,r.plantLife!.darkTicks,r.plantLife!.nextCheck]));
 expect(h.world.resources.every(r=>r.plantLife!.age>0)).toBe(true);
 const b=h.adopt(packet);
 // Exactly the live records, key order included.
 expect(JSON.stringify(b.resources)).toBe(JSON.stringify(h.world.resources));expect(b.resources).toStrictEqual(h.world.resources);
 expect(b.resources[0]).not.toBe(a.resources[0]);expect(a.resources[0]!.plantLife!.age).toBe(0);
 expect(readSnapshotChanges(a,b)).toEqual({resourceIndices:[0,1],tileIndices:[]});
 expect(readResidentResourceBaseChanges(a,b)!.edges[0]!.updated).toEqual([]);
});

test('without the option, or when anything else changed, the complete record is sent as before',()=>{
 const plain=harness(false),a=plain.adopt(plain.packet()),[aged]=plain.check(1) as [number];
 const literal=delta(plain.packet());expect(Object.hasOwn(literal.resources!,'life')).toBe(false);expect(literal.resources!.upserted.map(r=>r.id)).toEqual([plain.world.resources[aged]!.id]);
 const b=plain.adopt(literal);expect(readResidentResourceBaseChanges(a,b)!.edges[0]!.updated).toEqual([{id:plain.world.resources[aged]!.id,afterOrdinal:aged}]);

 const h=harness();h.adopt(h.packet());
 // Foliage lost at this check, or growth changed too: not an age-only change.
 const [first,second]=h.check(2) as [number,number];
 h.world.resources[first]!.plantLife!.leaflessAt=h.world.resources[first]!.plantLife!.nextCheck-PLANT_LIFE_INTERVAL;
 h.world.resources[second]!.growth=.9;
 const mixed=delta(h.packet());expect(Object.hasOwn(mixed.resources!,'life')).toBe(false);expect(mixed.resources!.upserted.map(r=>r.id).sort()).toEqual(h.world.resources.map(r=>r.id).sort());
 expect(JSON.stringify(h.adopt(mixed).resources)).toBe(JSON.stringify(h.world.resources));
 // The next ordinary check of the same plants: three numbers for one, and a
 // complete record for the one whose amount also changed.
 const [third,fourth]=h.check(2) as [number,number];h.world.resources[fourth]!.amount+=1;
 const next=delta(h.packet());expect([...next.resources!.life!]).toHaveLength(4);expect(next.resources!.life![0]).toBe(h.world.resources[third]!.id);expect(next.resources!.upserted.map(r=>r.id)).toEqual([h.world.resources[fourth]!.id]);
 expect(JSON.stringify(h.adopt(next).resources)).toBe(JSON.stringify(h.world.resources));
});

test('age and growth of different plants share one publication',()=>{
 const h=harness(),a=h.adopt(h.packet()),[aged]=h.check(1) as [number],other=1-aged;
 h.world.resources[other]!.growth=.61;h.world.resources[other]!.growthTick=h.world.tick;
 const packet=delta(h.packet());expect(packet.resources!.upserted).toEqual([]);expect([...packet.resources!.life!]).toHaveLength(4);expect([...packet.resources!.growth!]).toHaveLength(4);
 const b=h.adopt(packet);expect(JSON.stringify(b.resources)).toBe(JSON.stringify(h.world.resources));
 expect(readSnapshotChanges(a,b)!.resourceIndices.slice().sort()).toEqual([0,1]);expect(readResidentResourceBaseChanges(a,b)!.edges[0]!.updated).toEqual([]);
});

test('an invalid age tuple is refused by both readers, and the valid packet still commits',()=>{
 const variants:[string,(rows:Float64Array)=>Float64Array][]=[
  ['unknown plant',rows=>new Float64Array([999999,rows[1]!,rows[2]!,rows[3]!])],
  ['same plant twice',rows=>new Float64Array([...rows,...rows])],
  ['truncated tuple',rows=>rows.slice(0,3)],
  ['negative age',rows=>new Float64Array([rows[0]!,-1,rows[2]!,rows[3]!])],
  ['age that is not the elapsed time',rows=>new Float64Array([rows[0]!,rows[1]!+1,rows[2]!,rows[3]!])],
  ['fractional age',rows=>new Float64Array([rows[0]!,rows[1]!+.5,rows[2]!,rows[3]!])],
  ['not a number',rows=>new Float64Array([rows[0]!,Number.NaN,rows[2]!,rows[3]!])],
  ['more darkness than age',rows=>new Float64Array([rows[0]!,rows[1]!,rows[1]!+1,rows[3]!])],
  ['check in the past',rows=>new Float64Array([rows[0]!,rows[1]!,rows[2]!,0])],
 ];
 for(const[name,make]of variants){
  // Fresh readers each time: a refusal must leave nothing half applied.
  const h=harness();h.adopt(h.packet());h.check(1);
  const good=delta(h.packet()),bad={...structuredClone(good),resources:{removed:[],upserted:[],life:make(good.resources!.life!)}} as SnapshotMessage<true>;
  expect(h.literal.adopt(structuredClone(bad)).status,name).toBe('resync');expect(h.reader.adopt(bad).status,name).toBe('resync');
 }
 // A plant also sent whole cannot carry a tuple.
 const h=harness();h.adopt(h.packet());const [aged]=h.check(1) as [number];
 const good=delta(h.packet()),twice={...structuredClone(good),resources:{removed:[],upserted:[structuredClone(h.world.resources[aged]!)],life:good.resources!.life!}} as SnapshotMessage<true>;
 expect(h.literal.adopt(structuredClone(twice)).status).toBe('resync');expect(h.reader.adopt(twice).status).toBe('resync');
 const fresh=harness();fresh.adopt(fresh.packet());fresh.check(1);
 expect(JSON.stringify(fresh.adopt(delta(fresh.packet())).resources)).toBe(JSON.stringify(fresh.world.resources));
});
