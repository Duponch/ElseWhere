import {expect,test} from 'vitest';
import {validPartyHistoricalTransport292} from '../src/sim/party-save-292.ts';
import {INTRO_VISITOR_TICK} from '../src/sim/visitor-state.ts';
import type {VisitorGroup} from '../src/sim/visitor-state.ts';

// Declared transport component, not a saved World/campaign. This row follows
// the real constructor at visitors.ts114; no arrival/Engine/RNG is played.
function publication(members:unknown=[64378,64381]){
 const group:VisitorGroup={id:1,kind:'visitor',members:members as number[],entry:{x:0,z:2},spot:{x:4,z:4},phase:'arriving',startedAt:15000,arrivedAt:null,durationCore:8000,hostile:false};
 return {type:'snapshot',kind:'delta',world:{schemaVersion:298,tick:15000,width:8,height:8,nextId:64385,visitors:{profile:'cassandra-visitors-v1',groups:[group],departed:[]}}};
}

test('the real intro VisitorGroup number-ID shape passes Party transport at Core150000 without mutating historical or physical payloads',()=>{
 expect(INTRO_VISITOR_TICK*10).toBe(150000);
 for(const version of [291,292,296,297,298]){
  const packet=publication(),before=JSON.stringify(packet),ids=packet.world.visitors.groups[0]!.members;
  packet.world.schemaVersion=version;const expected=JSON.stringify(packet);
  expect(validPartyHistoricalTransport292(packet,version)).toBe(true);expect(validPartyHistoricalTransport292(packet.world,version)).toBe(true);expect(JSON.stringify(packet)).toBe(expected);expect(packet.world.visitors.groups[0]!.members).toBe(ids);
  expect(JSON.parse(before).world.tick).toBe(packet.world.tick);
 }
});

test('visitor IDs cannot admit Pawn objects, Party payloads, accessors, sparse arrays or non-ID values',()=>{
 for(const members of [[0],[-1],[1.5],['64378'],[null],[{}],[{id:64378,partyMemories292:[{at:0,power:.5}],recreation:{}}],{upserted:[64378]}])expect(validPartyHistoricalTransport292(publication(members),298)).toBe(false);
 const hole=new Array(1);expect(validPartyHistoricalTransport292(publication(hole),298)).toBe(false);
 let reads=0;const getter:number[]=[];Object.defineProperty(getter,'0',{enumerable:true,configurable:true,get(){reads++;return 64378;}});expect(validPartyHistoricalTransport292(publication(getter),298)).toBe(false);expect(reads).toBe(0);
 const hidden=[64378];Object.defineProperty(hidden,'0',{enumerable:false,value:64378});expect(validPartyHistoricalTransport292(publication(hidden),298)).toBe(false);
 const packet=publication([64378]);(packet.world.visitors.groups[0] as unknown as Record<string,unknown>).partyStartedAtCore=150000;expect(validPartyHistoricalTransport292(packet,298)).toBe(false);
});

test('ordinary custody members stay actor records and Party markers retain their historical owner fences',()=>{
 const member={id:7,recreation:{},partyMemories292:[{at:0,power:.5}]},packet={world:{worldGroups:{groups:[{state:{members:[member]}}]}}};
 expect(validPartyHistoricalTransport292(packet,298)).toBe(true);expect(validPartyHistoricalTransport292(packet,291)).toBe(false);
 expect(validPartyHistoricalTransport292({world:{worldGroups:{groups:[{state:{members:[7]}}]}}},298)).toBe(false);
 expect(validPartyHistoricalTransport292({world:{members:[{partyStartedAtCore:0}]}},298)).toBe(false);
 const future=publication([64378]);(future.world.visitors.groups[0] as unknown as Record<string,unknown>).party292={adoptedAtCore:0,nextCheckCore:5000,rng:1,pending:false};expect(validPartyHistoricalTransport292(future,298)).toBe(false);
});
