import {expect,test} from 'vitest';
import {ResidentActorsEncoder,ResidentActorsFrameOwner,createResidentActorTransportMemoInternal} from '../src/bridge/resident-actors-section';
import {createResidentConstructionValidators379,validConstructionTransport379} from '../src/sim/construction-forbid-save-379';
import {createPersonalOrdersTransportValidators378,validPersonalOrdersTransport378,validPersonalOrdersProjection378} from '../src/bridge/personal-orders-transport-378';
import {createResidentOwnerLeafRun379,isOrdinaryResidentOwnerRecord379,residentOwnerArray379,residentOwnerRecord379} from '../src/bridge/resident-owner-records-379';
import type {SnapshotMessage} from '../src/bridge/snapshots';
import type {World} from '../src/sim/types';
import {fixture} from './resident-presentation-fixtures-v427';

type Row=Record<string,any>;
/** Own construction exercises the same representation fact as native clone
 * observation, without granting a fabricated MessageEvent any provenance. */
function owned(v:any):any {
 if(v===null||typeof v!=='object'||ArrayBuffer.isView(v))return v;
 if(Array.isArray(v)){const a=residentOwnerArray379();for(const value of v)a.push(owned(value));return a;}
 const out=residentOwnerRecord379({},{});for(const key of Object.keys(v))Object.defineProperty(out,key,{value:owned(v[key]),enumerable:true,writable:true,configurable:true});return out;
}
function validators(){
 const hits:{value:object;role:number}[]=[];
 const memo=(keys:ReadonlySet<PropertyKey>)=>{
  const actual=createResidentActorTransportMemoInternal(keys);
  return {...actual,read:(value:object,version:number,role:number)=>{const result=actual.read(value,version,role);if(result!==undefined)hits.push({value,role});return result;}};
 };
 return {hits,construction:createResidentConstructionValidators379(isOrdinaryResidentOwnerRecord379,createResidentOwnerLeafRun379,memo),personal:createPersonalOrdersTransportValidators378(isOrdinaryResidentOwnerRecord379,memo)};
}
function harness(human:Row[],trusted=true){
 const encoder=new ResidentActorsEncoder(),reader=new ResidentActorsFrameOwner();let revision=0;
 const capture=()=>{
  revision++;const packet={type:'snapshot',kind:revision===1?'checkpoint':'delta',epoch:1,revision,baseRevision:revision-1,speed:0,stepMs:0,world:{nextId:1000,tick:0,pawns:human,wildlife:{animals:[]}}} as unknown as SnapshotMessage<true>;
  const encoded=encoder.prepare(packet);encoder.commit(encoded);const wire=structuredClone(encoded.packet),columns=structuredClone(encoded.actors);
   const raw=trusted?owned(columns):columns,draft=reader.prepare(wire,raw);if(!draft)throw Error('Rejected actor representation');reader.commit(draft.packet.world as World,draft);
  return {view:draft.packet.world,raw,wire};
 };
 return {capture,reader};
}

test('existing owned actor seal retains transport projections across numeric-only edits',()=>{
 const v=validators(),human=[{id:1,hunger:.5,x:0,identity378:{revision:1,title:'Mine'},orders:{active:null,queue:[]}}],h=harness(human);
 const a=h.capture(),old=structuredClone(a.view),packet={world:a.view};
 expect(v.construction.transport(packet,379)).toBe(validConstructionTransport379(packet,379));expect(v.personal.transport(packet,379)).toBe(validPersonalOrdersTransport378(packet,379));
 const source=a.raw.pawns.full[0];expect(a.view.pawns[0]).toBe(source);expect(Object.isFrozen(source)).toBe(true);expect(Object.isFrozen(source.identity378)).toBe(true);
 human[0]!.hunger=.25;human[0]!.x=1;const b=h.capture();expect(b.view.pawns[0]).not.toBe(a.view.pawns[0]);
 const start=v.hits.length;expect(v.construction.transport({world:b.view},379)).toBe(true);expect(v.personal.transport({world:b.view},379)).toBe(true);
 expect(v.hits.slice(start).filter(hit=>hit.value===b.view.pawns)).toHaveLength(2);expect(a.view).toStrictEqual(old);
});

test('construction role, schema and marker dependencies remain independent on immutable projections',()=>{
 const v=validators(),human=[{id:1,hunger:.5,kind:'wall',construction:'blueprint',forbidden379:true}],h=harness(human),a=h.capture();
 expect(v.construction.transport({jobs:a.view.pawns},379)).toBe(true);
 expect(v.construction.transport({jobs:a.view.pawns},378)).toBe(false);
 expect(v.construction.transport({resources:a.view.pawns},379)).toBe(false);
 human[0]!.construction='completed';const b=h.capture();expect(v.construction.transport({jobs:b.view.pawns},379)).toBe(false);
 expect(v.construction.transport({jobs:a.view.pawns},379)).toBe(true);
});

test('personal identity replacement invalidates the projection and cached features keep actual owner-clock validation',()=>{
 const v=validators(),world=fixture(),h=harness(world.pawns as unknown as Row[]),a=h.capture();
 const first={...world,pawns:a.view.pawns} as World;expect(v.personal.projection(first)).toBe(validPersonalOrdersProjection378(first));
 world.pawns[0]!.identity378={revision:1,title:'Mine',banishedAt:world.tick+1};const b=h.capture(),next={...world,pawns:b.view.pawns} as World;
 expect(v.personal.transport({world:next},379)).toBe(true);expect(v.personal.projection(next)).toBe(false);expect(validPersonalOrdersProjection378(next)).toBe(false);
 world.pawns[0]!.identity378={revision:1,title:''};const c=h.capture();expect(v.personal.transport({world:c.view},379)).toBe(false);
});

test('prototype pollution after a successful cached adoption is reread, including after a strict sibling callback',()=>{
 const v=validators(),h=harness([{id:1,hunger:.5}]),a=h.capture();expect(v.construction.transport({resources:a.view.pawns},379)).toBe(true);
 const sibling=new Proxy({}, {getOwnPropertyDescriptor(target,key){if(key==='destinations')Object.defineProperty(Object.prototype,'forbidden379',{value:true,configurable:true});return Reflect.getOwnPropertyDescriptor(target,key);}});
 try{
  expect(v.construction.transport({resources:[sibling,a.view.pawns]},379)).toBe(false);
  expect(v.construction.transport({resources:a.view.pawns},379)).toBe(false);
 }finally{delete (Object.prototype as Row).forbidden379;}
 expect(v.construction.transport({resources:a.view.pawns},379)).toBe(true);
});

test('a frozen caller Proxy keeps its strict traps and receives no immutable graph proof',()=>{
 const v=validators(),reader=new ResidentActorsFrameOwner();let poisoned=false;
 const row=new Proxy({id:1,hunger:.5},{has(target,key){return key==='forbidden379'&&poisoned||Reflect.has(target,key);}}),rows={mode:'rows',reset:true,count:1,removed:[],full:[row],numbers:new Float64Array(),values:[],tails:new Float64Array()};
 const packet={type:'snapshot',kind:'checkpoint',epoch:1,revision:1,stepMs:0,speed:0,world:{nextId:10,tick:0,pawns:0}} as unknown as SnapshotMessage<true>;
 const draft=reader.prepare(packet,{pawns:rows,animals:{mode:'literal'}});expect(draft).toBeDefined();const pawns=draft!.packet.world.pawns;expect(pawns[0]).toBe(row);expect(Object.isFrozen(row)).toBe(true);
 expect(v.construction.transport({resources:pawns},379)).toBe(true);poisoned=true;expect(v.construction.transport({resources:pawns},379)).toBe(false);
});
