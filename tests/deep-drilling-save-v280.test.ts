import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots.ts';
import {validDeepDrillingTransport} from '../src/sim/deep-drilling-save.ts';
import {deepWorkSpot,deepWorkReason} from '../src/sim/deep-drilling-rules.ts';
import {discoverDeepDeposit} from '../src/sim/deep-resources.ts';
import {validDeepResearchTransport} from '../src/sim/research-save.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {deepDrillingCamp} from './helpers/deep-drilling-v280.ts';
import {medicalCamp} from './scenarios/health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';

function camp(kind?:'drill'|'scan',working=false){
  const f=deepDrillingCamp(),w=f.world;
  const drill=w.structures.find(s=>s.id===f.drillId)!,scanner=w.structures.find(s=>s.id===f.scannerId)!;
  drill.deepDrill={progress:123.25,yieldPct:.015,rng:731,lastUsedAt:w.tick};
  scanner.deepScanner={daysWorking:.25,lastScanAt:w.tick,lastUserSpeed:1.3};
  const actor=w.pawns.find(p=>p.id===(kind==='scan'?f.researcherId:f.minerId))!;
  if(kind){const station=kind==='drill'?drill:scanner,spot=deepWorkSpot(station);
    actor.deepWork={structureId:station.id,spot,kind};actor.path=[];actor.state=working?'working':'moving';
    if(working){actor.x=spot.x;actor.z=spot.z;actor.moveCooldown=0;delete actor.motion;}
  }
  return {w,actor,drill,scanner};
}
const checkpoint=(w:World)=>new SnapshotDecoder().adopt(structuredClone(new SnapshotEncoder().encode(w,0,1)));
function refused(w:World){
  expect(validDeepDrillingTransport(w,w.schemaVersion)&&validDeepResearchTransport(w,w.schemaVersion)).toBe(false);
  expect(checkpoint(w).status).toBe('resync');expect(()=>deserializeWorld(JSON.stringify(w))).toThrow();
}

test('acquired reserves and both physical building histories round trip without creating stock',()=>{
  const {w,drill,scanner}=camp(),stock=structuredClone(w.stock),piles=structuredClone(w.piles);
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  const result=checkpoint(w);expect(result.status).toBe('applied');
  if(result.status==='applied'){expect(result.world.deepResources).toEqual(w.deepResources);expect(result.world.structures).toEqual(w.structures);}
  expect(w.stock).toEqual(stock);expect(w.piles).toEqual(piles);
  for(const orientation of [1,2,3] as const){drill.orientation=orientation;scanner.orientation=orientation;
    expect(validateWorld(w)).toEqual([]);expect(checkpoint(w).status).toBe('applied');}
});

test('uranium and jade are valid finite reserves in current saves and snapshots, but not before 382',()=>{
  const {w}=camp();w.deepResources!.cells=[{index:10,item:'uranium',count:285},{index:11,item:'jade',count:7}];
  expect(validDeepDrillingTransport(w,381)).toBe(false);expect(validDeepDrillingTransport(w,w.schemaVersion)).toBe(true);
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  const result=checkpoint(w);expect(result.status).toBe('applied');
  if(result.status==='applied')expect(result.world.deepResources).toEqual(w.deepResources);
});

test('drilling and scanning retain their actual station claims at approach and working checkpoints',()=>{
  for(const kind of ['drill','scan'] as const)for(const working of [false,true]){
    const {w,actor}=camp(kind,working);expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    const result=checkpoint(w);expect(result.status).toBe('applied');
    if(result.status==='applied')expect(result.world.pawns.find(p=>p.id===actor.id)!.deepWork).toEqual(actor.deepWork);
  }
});

test('214 migration is neutral and does not adopt reserves, machines, research, work, stock or RNG',()=>{
  const w=medicalCamp();w.schemaVersion=214 as World['schemaVersion'];delete w.deepResources;
  const before=structuredClone(w),loaded=deserializeWorld(JSON.stringify(w));
  expect(loaded).toEqual({...before,schemaVersion:SCHEMA_VERSION});expect(w).toEqual(before);
  expect(Object.hasOwn(loaded,'deepResources')).toBe(false);expect(loaded.pawns.every(p=>!Object.hasOwn(p,'deepWork'))).toBe(true);
});

test('future own-undefined fields are rejected before migration and by the native snapshot boundary',()=>{
  for(const field of ['deepResources','deepWork','deepDrill','deepScanner','deepDrilling','groundScanner'] as const){
    const w=medicalCamp();w.schemaVersion=214 as World['schemaVersion'];
    if(field==='deepResources')Object.assign(w,{[field]:undefined});
    else if(field==='deepWork')Object.assign(w.pawns[0]!,{[field]:undefined});
    else if(field==='deepDrilling'||field==='groundScanner')w.research={points:0,project:null,[field]:undefined};
    else {const s=camp().drill;s.kind='wood-generator';Object.assign(s,{deepDrill:undefined,deepScanner:undefined});w.structures.push(s);}
    expect(validDeepDrillingTransport(w,214)&&validDeepResearchTransport(w,214)).toBe(false);
    expect(checkpoint(w).status).toBe('resync');
  }
  const future=camp().w;future.schemaVersion=214 as World['schemaVersion'];refused(future);
});

test('reserve cells require sorted unique bounded indices, real mineral identities and positive integer stock',()=>{
  for(const cells of [[{index:10,item:'steel',count:1},{index:9,item:'gold',count:1}],
    [{index:10,item:'steel',count:1},{index:10,item:'gold',count:1}],
    [{index:-1,item:'steel',count:1}],[{index:1024,item:'steel',count:1}],
    [{index:10,item:'component',count:1}],[{index:10,item:'steel',count:0}],
    [{index:10,item:'steel',count:301}],[{index:10,item:'steel',count:1.5}],
    [{index:10,item:'steel',count:1,visible:true}]]){
    const {w}=camp();w.deepResources!.cells=cells as never;refused(w);
  }
});

test('reserve clocks, private RNG and unknown fields have an exact shared boundary',()=>{
  for(const patch of [{rng:0},{rng:0x100000000},{rng:1.5},{adoptedAt:3001},{discoveries:-1},{discoveries:.5},{extra:1},{cells:null}]){
    const {w}=camp();Object.assign(w.deepResources!,patch);refused(w);
  }
  const absent=camp('drill').w;delete absent.deepResources;refused(absent);
});

test('machine histories reject wrong owners, nonfinite progress, future clocks and unknown fields',()=>{
  for(const patch of [{progress:NaN},{progress:10001},{yieldPct:-.01},{rng:0},{lastUsedAt:3001},{extra:1}]){
    const {w,drill}=camp();Object.assign(drill.deepDrill!,patch);refused(w);
  }
  for(const patch of [{daysWorking:Infinity},{daysWorking:-1},{lastScanAt:3001},{lastUserSpeed:0},{extra:1}]){
    const {w,scanner}=camp();Object.assign(scanner.deepScanner!,patch);refused(w);
  }
  const mismatch=camp();mismatch.scanner.deepDrill=mismatch.drill.deepDrill;refused(mismatch.w);
  const incomplete=camp();delete incomplete.scanner.deepScanner!.lastUserSpeed;refused(incomplete.w);
});

test('station identity, task kind and exact interaction cells cannot be substituted',()=>{
  for(const mutate of [(v:ReturnType<typeof camp>)=>{v.actor.deepWork!.structureId=v.w.nextId;},
    (v:ReturnType<typeof camp>)=>{v.actor.deepWork!.kind='scan';},
    (v:ReturnType<typeof camp>)=>{v.actor.deepWork!.spot.x++;},
    (v:ReturnType<typeof camp>)=>{Object.assign(v.actor.deepWork!,{progress:1});},
    (v:ReturnType<typeof camp>)=>{v.actor.priorities.mine=0;}]){const v=camp('drill');mutate(v);refused(v.w);}
});

test('one station has one operator and working requires settled physical contact',()=>{
  const duplicate=camp('drill'),other=duplicate.w.pawns.find(p=>p!==duplicate.actor)!;
  other.deepWork=structuredClone(duplicate.actor.deepWork);other.state='moving';other.priorities.mine=1;refused(duplicate.w);
  for(const mutate of [(v:ReturnType<typeof camp>)=>{v.actor.x--;},
    (v:ReturnType<typeof camp>)=>{v.actor.path=[{x:v.actor.x,z:v.actor.z+1}];},
    (v:ReturnType<typeof camp>)=>{v.actor.moveCooldown=1;}]){const v=camp('drill',true);mutate(v);refused(v.w);}
});

test('an operator cannot borrow carried cargo or another medical or production owner',()=>{
  for(const task of ['animalFeed','animalCare','rescue','surgery','research','cooking'] as const){
    const v=camp('drill');Object.assign(v.actor,{[task]:{}});refused(v.w);
  }
  const held=camp('drill');addMaterial(held.w,'steel',1,{type:'pawn',pawnId:held.actor.id},'steel');refreshStock(held.w);refused(held.w);
});

test('an existing research service cannot share the deep operator interaction cell',()=>{
  const {w,actor,drill}=camp(),other=w.pawns.find(p=>p!==actor)!,spot=deepWorkSpot(drill);
  const station=fixtureBuilding(w,'research-bench',spot.x,spot.z-1,2);
  Object.assign(station,{material:'wood'});
  w.research!.project='air-conditioning';w.research!.airConditioning={points:0};
  other.research={stationId:station.id,spot:{...spot},worked:0};other.state='moving';other.path=[];
  expect(validateWorld(w)).toEqual([]);expect(checkpoint(w).status).toBe('applied');
  expect(deepWorkReason(w,actor,drill)).toMatch(/réservée/);
  actor.deepWork={structureId:drill.id,kind:'drill',spot:{...spot}};actor.state='moving';
  refused(w);
});

test('a legal post-shot cooldown and a deep work mandate have distinct exclusive owners',()=>{
  const {w,actor,drill}=camp(),core=w.tick*10;
  actor.shooting={order:null,stance:{phase:'cooldown',startedAtCore:core-10,endsAtCore:core+86}};
  expect(validateWorld(w)).toEqual([]);expect(checkpoint(w).status).toBe('applied');
  expect(deepWorkReason(w,actor,drill)).toMatch(/indisponible/);
  actor.deepWork={structureId:drill.id,kind:'drill',spot:deepWorkSpot(drill)};actor.state='moving';
  refused(w);
});

test('a packed drill keeps its acquired work history, while a scanner cannot be minified',()=>{
  const {w,drill}=camp();w.structures=w.structures.filter(s=>s!==drill);drill.power={on:false,parentId:null};
  w.packed.push({building:drill,owner:{type:'ground',x:8,z:8}});
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);expect(checkpoint(w).status).toBe('applied');
  drill.deepDrill!.lastUsedAt=w.tick+1;refused(w);
  const scanner=camp();scanner.w.structures=scanner.w.structures.filter(s=>s!==scanner.scanner);
  scanner.w.packed.push({building:scanner.scanner,owner:{type:'ground',x:8,z:8}});refused(scanner.w);
});

test('deep research prerequisites and acquired machines share file and Decoder gates',()=>{
  for(const mutate of [(w:World)=>{delete w.research!.microelectronics;},
    (w:World)=>{delete w.research!.deepDrilling;},
    (w:World)=>{delete w.research!.groundScanner;},
    (w:World)=>{w.research!.deepDrilling!.points--;},
    (w:World)=>{w.research!.groundScanner!.completedAt=w.tick+1;}]){const {w}=camp();mutate(w);refused(w);}
});

test('in-place reserve and sparse machine deltas preserve retained views and invalid adoption is atomic',()=>{
  const {w,drill}=camp('drill',true),encoder=new SnapshotEncoder({structureDelta:true}),decoder=new SnapshotDecoder();
  const first=decoder.adopt(structuredClone(encoder.encode(w,0,1)));expect(first.status).toBe('applied');if(first.status!=='applied')throw Error('Missing first view');
  const retained=structuredClone(first.world);w.deepResources!.cells[0]!.count--;drill.deepDrill!.progress=456.5;
  const second=decoder.adopt(structuredClone(encoder.encode(w,0,1)));expect(second.status).toBe('applied');expect(first.world).toEqual(retained);
  if(second.status!=='applied')throw Error('Missing second view');const accepted=structuredClone(second.world);
  expect(second.world.deepResources!.cells[0]!.count).toBe(299);expect(second.world.structures.find(s=>s.id===drill.id)!.deepDrill!.progress).toBe(456.5);
  w.deepResources!.rng=0;expect(decoder.adopt(structuredClone(encoder.encode(w,0,1))).status).toBe('resync');expect(second.world).toEqual(accepted);
  w.deepResources!.rng=731;expect(decoder.adopt(structuredClone(encoder.encode(w,0,1,true))).status).toBe('applied');expect(first.world).toEqual(retained);
});

test('save continuation preserves the private discovery stream without touching world RNG or material stock',()=>{
  const {w}=camp(),loaded=deserializeWorld(serializeWorld(w)),rng=w.rng,stock=structuredClone(w.stock),piles=structuredClone(w.piles);
  expect(discoverDeepDeposit(w)).toBe(true);expect(discoverDeepDeposit(loaded)).toBe(true);
  expect(loaded).toEqual(w);expect(w.rng).toBe(rng);expect(w.stock).toEqual(stock);expect(w.piles).toEqual(piles);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('archived packed drill histories use their departure clock, not the later live map clock',()=>{
  const {w,drill}=camp();w.structures=w.structures.filter(s=>s!==drill);drill.deepDrill!.lastUsedAt=w.tick-1;
  // This focused transport fixture supplies only fields traversed by the deep
  // guard; complete departure/cohort validity remains owned by pod-rescue-save.
  w.podRescues={departed:[{tick:w.tick-1,pawn:{},packed:[{building:drill,owner:{type:'inventory',pawnId:1}}]}]} as never;
  expect(validDeepDrillingTransport(w,215)).toBe(true);
  drill.deepDrill!.lastUsedAt=w.tick;expect(validDeepDrillingTransport(w,215)).toBe(false);
});
