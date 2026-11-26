import {expect,test} from 'vitest';
import {decodeOwnedCorePhaseWire379,encodeCorePhaseWire379} from '../src/bridge/core-phase-wire-379';
import type {CorePhaseEnvelope297} from '../src/bridge/core-phase-projection-297';

function wire(x:number) {
 const phase:CorePhaseEnvelope297={type:'actor-frontier-297',audioCues:[],epoch:1,mapId:0,baseRevision:1,phaseSeq:1,nextId:100,
  fromCore:200,toCore:230,speed:1,actors:[{kind:'human',id:7,index:0,fields:{x,z:10,state:'moving',moveCooldown:0,planCooldown:0,path:[]}}],
  tracks:[],projectiles:{upserted:[],removed:[]}};
 return encodeCorePhaseWire379(phase)!.message;
}

test('a nested capture during dictionary extraction cannot overwrite the outer numeric snapshot',()=>{
 const outer=wire(12),inner=wire(17);
 let nested:CorePhaseEnvelope297|undefined;
 const strings=new Proxy(outer.phaseWire379.strings,{getOwnPropertyDescriptor(target,key){
  if(key==='0'&&!nested){
   nested=decodeOwnedCorePhaseWire379(inner) as CorePhaseEnvelope297;
   new Float64Array(outer.phaseWire379.numbers).fill(900);
   new Int32Array(outer.phaseWire379.words).fill(-1);
  }
  return Reflect.getOwnPropertyDescriptor(target,key);
 }});
 const held=decodeOwnedCorePhaseWire379({...outer,phaseWire379:{...outer.phaseWire379,strings}}) as CorePhaseEnvelope297;
 expect(nested?.actors[0]?.fields.x).toBe(17);
 expect(held.actors[0]?.fields.x).toBe(12);
 const next=wire(42);
 expect(()=>decodeOwnedCorePhaseWire379({...next,phaseWire379:{...next.phaseWire379,shapes:[]}})).toThrow();
 expect((decodeOwnedCorePhaseWire379(next) as CorePhaseEnvelope297).actors[0]?.fields.x).toBe(42);
 expect(held.actors[0]?.fields.x).toBe(12);
});
