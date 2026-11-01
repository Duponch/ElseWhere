import {expect,test} from 'vitest';
import fs from 'node:fs';
import {createWorld} from '../src/sim/index.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {validHumanIngestionPawn299,validHumanIngestionProjection299} from '../src/sim/human-ingestion-save-299.ts';
import {deserializeCampaign,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';

test('299 field admission rejects future, inherited, non-data and beyond-own-frontier history without reading getters',()=>{
 expect(SCHEMA_VERSION).toBe(299);
 for(const v of [2,255,296,297,298]){
  expect(validHumanIngestionPawn299({},v)).toBe(true);
  expect(validHumanIngestionPawn299({lastIngestAtCore299:0},v,0)).toBe(false);
 }
 expect(validHumanIngestionPawn299({lastIngestAtCore299:127},299,127)).toBe(true);
 expect(validHumanIngestionPawn299({lastIngestAtCore299:128},299,127)).toBe(false);
 expect(validHumanIngestionPawn299({lastIngestAtCore299:128},299,130)).toBe(true); // completed macro batch, not endpoint127
 for(const x of [-1,.5,NaN,Infinity,undefined])expect(validHumanIngestionPawn299({lastIngestAtCore299:x},299,127)).toBe(false);
 let reads=0;const accessor={};Object.defineProperty(accessor,'lastIngestAtCore299',{enumerable:true,get(){reads++;return 0;}});
 expect(validHumanIngestionPawn299(accessor,299,127)).toBe(false);expect(reads).toBe(0);
 expect(validHumanIngestionPawn299(Object.create({lastIngestAtCore299:0}),299,127)).toBe(false);
 const hidden={};Object.defineProperty(hidden,'lastIngestAtCore299',{value:0});expect(validHumanIngestionPawn299(hidden,299,127)).toBe(false);
});

test('BingeFood provider is own-data true only299 on eat, independent of current crisis and incompatible with forced/alcohol',()=>{
 const task={kind:'eat',foodBinge299:true};
 expect(validHumanIngestionPawn299({need:task},299,0)).toBe(true);
 expect(validHumanIngestionPawn299({need:{kind:'eat'}},298,0)).toBe(true);
 expect(validHumanIngestionPawn299({need:task},298,0)).toBe(false);
 for(const bad of [{...task,kind:'sleep'},{...task,foodBinge299:false},{...task,forced:true},{...task,alcoholReason:'binge'}])expect(validHumanIngestionPawn299({need:bad},299,0)).toBe(false);
 let reads=0;const hidden={kind:'eat'};Object.defineProperty(hidden,'foodBinge299',{enumerable:true,get(){reads++;return true;}});
 expect(validHumanIngestionPawn299({need:hidden},299,0)).toBe(false);expect(reads).toBe(0);
 const inherited=Object.assign(Object.create({foodBinge299:true}),{kind:'eat'});
 expect(validHumanIngestionPawn299({need:inherited},299,0)).toBe(false);
});

test('projection checks use holder/away/registry clocks and never the selected-map phase',()=>{
 // A declared field-only projection fixture, not an admitted World or Native receipt.
 const p={lastIngestAtCore299:127},base={schemaVersion:299,tick:20,phaseCore297:9,pawns:[],structures:[],packed:[]} as unknown as World;
 const away={...base,group:{members:[p],lastPersonalTick:12}} as unknown as World;
 expect(validHumanIngestionProjection299(away,299)).toBe(false); // selected209 cannot authorize this owner120
 (away.group as {lastPersonalTick:number}).lastPersonalTick=13;
 expect(validHumanIngestionProjection299(away,299)).toBe(true); // confirmed completed batch130
 const held={...base,structures:[{cryptosleep:{heldAt:12,heldAtCore297:126,human:p}}]} as unknown as World;
 expect(validHumanIngestionProjection299(held,299)).toBe(false);
 p.lastIngestAtCore299=126;expect(validHumanIngestionProjection299(held,299)).toBe(true);
 p.lastIngestAtCore299=127;
 const registry={...base,worldPawns:{owners:[{kind:'human',clockCore:120,physicalClockCore297:126,actor:p}]}} as unknown as World;
 expect(validHumanIngestionProjection299(registry,299)).toBe(false);
 p.lastIngestAtCore299=126;expect(validHumanIngestionProjection299(registry,299)).toBe(true);
});

test('strict real298 fixture migrates number-only to299 and keeps unknown ingestion/provider history absent',()=>{
 const file=process.env.SCHEMA298_FIXTURE??new URL('./fixtures/food-binge-cadence299-canonical298.json',import.meta.url);
 const raw=fs.readFileSync(file,'utf8'),before=JSON.parse(raw);expect(before.schemaVersion).toBe(298);
 const after=deserializeCampaign(raw),expected=structuredClone(before);expected.schemaVersion=299;
 expect(after).toStrictEqual(expected);expect(JSON.parse(raw)).toStrictEqual(before);
 if(!('pawns'in after))throw Error('Canonical local fixture expected');
 for(const p of after.pawns){expect(Object.hasOwn(p,'lastIngestAtCore299')).toBe(false);if(p.need)expect(Object.hasOwn(p.need,'foodBinge299')).toBe(false);}
 const forbidden=structuredClone(before);forbidden.pawns[0].lastIngestAtCore299=0;
 expect(()=>deserializeCampaign(JSON.stringify(forbidden))).toThrow('Invalid version298 save:');
});

test('prepared299 metadata survives strict Whole reload and checkpoint/delta Full readers without Native authority',()=>{
 const w=createWorld(82991,32,32),p=w.pawns[0]!;expect(validateWorld(w)).toEqual([]);
 // Authored0Core metadata fixture. It is not claimed to be a played ingestion.
 addMaterial(w,'food',1,{type:'pawn',pawnId:p.id},'survival-meal');const pile=w.piles.find(i=>i.item==='survival-meal'&&i.owner.type==='pawn'&&i.owner.pawnId===p.id);
 if(!pile)throw Error('Fixture food allocation failed');
 p.lastIngestAtCore299=0;p.need={kind:'eat',foodBinge299:true,phase:'ingest',sourcePileId:pile.id,carryPileId:pile.id,quantity:1,progress:0,dining:{target:{x:p.x,z:p.z},seatId:null,tableId:null}};p.state='eating';p.path=[];p.needCooldown=0;refreshStock(w);
 expect(validateWorld(w)).toEqual([]);
 const before=structuredClone(w),saved=serializeWorld(w),restored=deserializeCampaign(saved);expect(restored).toStrictEqual(before);expect(w).toStrictEqual(before);
 const encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),strict=new SnapshotDecoder(),resident=new ResidentPresentationAssembler();
 const a=structuredClone(encoder.encode(w,0,0,true)),sa=strict.adopt(structuredClone(a)),ra=resident.adopt(a);
 expect(sa.status).toBe('applied');expect(ra.status).toBe('applied');if(sa.status!=='applied'||ra.status!=='applied')throw Error('Prepared Full refused');
 expect(ra.world).toStrictEqual(sa.world);const old=structuredClone(ra.world);
 if(p.need?.kind!=='eat')throw Error('Prepared task missing');p.need.progress=1;
 const b=structuredClone(encoder.encode(w,0,0)),sb=strict.adopt(structuredClone(b)),rb=resident.adopt(b);expect(b.kind).toBe('delta');
 expect(sb.status).toBe('applied');expect(rb.status).toBe('applied');if(sb.status!=='applied'||rb.status!=='applied')throw Error('Prepared delta refused');
 expect(rb.world).toStrictEqual(sb.world);expect(rb.world.pawns[0]!.lastIngestAtCore299).toBe(0);expect(rb.world.pawns[0]!.need).toMatchObject({foodBinge299:true,progress:1});expect(ra.world).toStrictEqual(old);
 const bad=structuredClone(b);bad.revision++;if(bad.kind==='delta')bad.baseRevision++;
 bad.world.pawns[0]!.lastIngestAtCore299=1;expect(resident.adopt(bad).status).toBe('resync');
});
