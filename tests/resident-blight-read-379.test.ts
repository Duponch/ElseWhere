import {expect,it} from 'vitest';
import {ResidentCollectionJournal379} from '../src/bridge/resident-collection-journal-379';
import {ResidentResourceBaseJournal} from '../src/bridge/resident-resource-base-journal';
import type {ResourceStructureCandidate} from '../src/bridge/snapshots';
import type {Resource,World} from '../src/sim/types';
import {ResidentBlightRead379} from '../src/ui/resident-blight-read-379';
import {knownPosition256} from '../src/ui/exploration-readers-256';
import {readCropBlight} from '../src/ui/core-colony-alerts';

const plant=(id:number,blighted=false):Resource=>({id,kind:'rice',x:id%32,z:Math.floor(id/32)%32,amount:1,growth:.5,...blighted?{blight:{since:0,severity:.1,lastHarmTick:0,nextCheck:200,rng:3}}:{}});
const world=(resources:Resource[]):World=>({schemaVersion:379,seed:42,width:32,height:32,resources,tiles:Array.from({length:1024},()=>({terrain:'soil-natural'})),site:{revision:3},exploration:{revision:1}} as unknown as World);
const slots=(map:World)=>new Map(map.resources.map((r,i)=>[r.id,i]));
const literal=(map:World)=>map.resources.filter(r=>r.blight&&knownPosition256(map,r));

it('reads only certified resource-base changes and current visibility, keeps target order and falls back after an order/directory gap',()=>{
 const read=new ResidentBlightRead379(),all=new ResidentCollectionJournal379('resources'),base=new ResidentResourceBaseJournal();
 const w=world(Array.from({length:5000},(_,i)=>plant(i+1,i===17||i===30)));
 w.tiles[w.resources[17]!.z*w.width+w.resources[17]!.x]!.fogged=true;
 all.reset(w,1,1,slots(w));base.reset(w,1,1,w.resources.length);
 expect(read.read(w)).toEqual(literal(w));expect(read.stats.resourceVisits).toBe(5000);
 // Growth transport changes a row but never its blight membership. Revealing a
 // hidden plant changes the alert even without a resource upsert.
 const a={...w,tiles:w.tiles.map(t=>({...t})),resources:w.resources.slice()};
 delete a.tiles[w.resources[17]!.z*w.width+w.resources[17]!.x]!.fogged;a.resources[50]={...a.resources[50]!,growth:.8};
 const edge:ResourceStructureCandidate={beforeCount:w.resources.length,afterCount:a.resources.length,removed:[],added:[],updated:[{id:51,afterOrdinal:50}]};
 all.append(w,a,1,2,slots(a),edge);base.append(w,a,1,2,{...edge,updated:[]},a.resources.length);
 expect(read.read(a)).toEqual(literal(a));expect(read.stats.resourceVisits).toBe(5002);expect(read.stats.fullReads).toBe(1);
 // Existing old blight removed, a new existing plant gets blight and a new
 // plant appears at the end: exact order is target ordinal, not Set order.
 const b={...a,resources:a.resources.filter(r=>r.id!==18)};
 b.resources[3]=plant(b.resources[3]!.id,true);b.resources.push(plant(5001,true));
 const changes:ResourceStructureCandidate={beforeCount:a.resources.length,afterCount:b.resources.length,removed:[{id:18,beforeOrdinal:17}],added:[{id:5001,afterOrdinal:b.resources.length-1}],updated:[{id:b.resources[3]!.id,afterOrdinal:3}]};
 all.append(a,b,1,3,slots(b),changes);base.append(a,b,1,3,changes,b.resources.length);
 expect(readCropBlight(b,()=>read.read(b))).toEqual(readCropBlight(b));expect(read.stats.fullReads).toBe(1);expect(read.stats.resourceVisits).toBeLessThan(5010);
 // Whole order changed: no edge, and a mutable public copy is never a proof.
 const c={...b,resources:b.resources.slice().reverse()};all.append(b,c,1,4,slots(c),undefined);base.append(b,c,1,4,undefined,c.resources.length);
 expect(read.read(c)).toEqual(literal(c));expect(read.stats.fullReads).toBe(2);
 const d={...c};expect(read.read(d)).toEqual(literal(d));d.resources[0]=plant(d.resources[0]!.id,false);expect(read.read(d)).toEqual(literal(d));expect(read.stats.fullReads).toBe(4);
});
