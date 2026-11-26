import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateCampaignSchema378} from '../src/sim/serialization.ts';
import {validConstructionTransport379} from '../src/sim/construction-forbid-save-379.ts';
import {validatePawnRecordShape,validateDetachedPawnRecordShape,validateAwayPawnRecordShape,validateShipCasketPawnShape277,validateRetainedShipCasketPawnShape277,validateRetainedPlayerCasketPawnShape271} from '../src/sim/pawn-record-save.ts';
import {SCHEMA_VERSION,type Pawn} from '../src/sim/types.ts';

const batch=()=>({sourcePileId:10,quantity:5,phase:'pickup',destination:{type:'job',jobId:20},carryPileId:null,constructionBatch379:{item:'wood',sources:[{pileId:10,quantity:5}],destinations:[{jobId:20,quantity:5}]}});
const opportunity=()=>({sourcePileId:10,quantity:5,phase:'pickup',destination:{type:'stockpile',stockpileId:20},carryPileId:11,haulOpportunity379:{quantity:2}});

test('378 migration changes only the version after its complete original validation',()=>{
 const original=JSON.parse(serializeWorld(createWorld(379,20,20)));original.schemaVersion=378;
 expect(validateCampaignSchema378(original)).toEqual([]);const before=JSON.stringify(original);
 expect(JSON.parse(serializeWorld(deserializeWorld(before)))).toEqual({...original,schemaVersion:SCHEMA_VERSION});expect(JSON.stringify(original)).toBe(before);
});

test('379 descriptor preflight reaches every retained owner lane before reconstruction',()=>{
 const lanes=[
  (body:unknown)=>({pawns:[body]}),
  (body:unknown)=>({secondarySite:{map:{pawns:[body]}}}),
  (body:unknown)=>({worldMaps:{sites:[{map:{pawns:[body]}}]}}),
  (body:unknown)=>({campaignMap:{groups:[{state:{members:[body]}}]}}),
  (body:unknown)=>({worldGroups:{groups:[{state:{pending261:{retained:{people:[body]}}}}]}}),
  (body:unknown)=>({worldPawns:{owners:[{actor:body}]}}),
  (body:unknown)=>({worldFactions:{leaders:[{pawn:body}]}}),
  (body:unknown)=>({worldPawns:{heldCaskets259:[{casket:{casket:{humans:[body]}}}]}}),
  (body:unknown)=>({worldPawns:{heldPlayerCaskets271:[{casket:{cryptosleep:{human:body}}}]}}),
  (body:unknown)=>({worldPawns:{heldShipCaskets277:[{casket:{shipCryptosleep277:{occupant:{pawn:body}}}}]}}),
  (body:unknown)=>({banishedDepartures378:[{pawn:body}]}),
  (body:unknown)=>({orbital:{ships:[{departures:[{cargo:{people:[body]}}]}]}}),
 ];
 for(const envelope of lanes)for(const task of [batch(),opportunity()]){
  expect(validConstructionTransport379(envelope({haul:task}),379)).toBe(true);
  expect(validConstructionTransport379(envelope({haul:task}),378)).toBe(false);
  const malformed={...task};Object.defineProperty(malformed,Object.hasOwn(task,'constructionBatch379')?'constructionBatch379':'haulOpportunity379',{enumerable:true,get(){throw Error('accessor executed');}});
  expect(validConstructionTransport379(envelope({haul:malformed}),379)).toBe(false);
 }
});

test('shared Pawn shape guards reject future batch/opportunity fields in their actual owner records',()=>{
 const w=createWorld(379,20,20),p=w.pawns[0]!,context={width:w.width,height:w.height,tick:w.tick,nextId:w.nextId};
 const guards=[
  (body:Pawn)=>validatePawnRecordShape(body as unknown as Record<string,unknown>,w,378),
  (body:Pawn)=>validateDetachedPawnRecordShape(body as unknown as Record<string,unknown>,context,378),
  (body:Pawn)=>validateAwayPawnRecordShape(body as unknown as Record<string,unknown>,context,378,w.tick,new Set()),
  (body:Pawn)=>validateShipCasketPawnShape277(body as unknown as Record<string,unknown>,w,378,w.tick,w.nextId-1),
  (body:Pawn)=>validateRetainedShipCasketPawnShape277(body as unknown as Record<string,unknown>,context,378,w.tick,w.nextId-1),
  (body:Pawn)=>validateRetainedPlayerCasketPawnShape271(body as unknown as Record<string,unknown>,context,378,w.tick,{casketId:w.nextId-1,heldAt:w.tick}),
 ];
 for(const task of [batch(),opportunity()])for(const guard of guards){
  expect(guard({...p,haul:task} as unknown as Pawn).some(e=>/future construction/.test(e))).toBe(true);
  expect(guard({...p,orders:{active:null,queue:[task]}} as unknown as Pawn).some(e=>/future construction/.test(e))).toBe(true);
 }
});

test('379 permission/material provenance is rejected outside its real building or job lane',()=>{
 const job={kind:'bed',construction:'blueprint',forbidden379:true},building={kind:'electric-tailor-bench',material:'steel',tailorSteel379:true};
 for(const marker of [job,building]){
  expect(validConstructionTransport379({pawns:[marker]},379)).toBe(false);
  expect(validConstructionTransport379({worldPawns:{owners:[{actor:marker}]}},379)).toBe(false);
 }
 expect(validConstructionTransport379({jobs:[job],packed:[{building}]},379)).toBe(true);
 expect(validConstructionTransport379({jobs:[job],structures:[job]},379)).toBe(false);
 for(const key of ['forbidden379','tailorSteel379','constructionBatch379','haulOpportunity379']){
  const body={};Object.defineProperty(body,key,{enumerable:true,value:undefined});expect(validConstructionTransport379({pawns:[body]},378)).toBe(false);
 }
});
