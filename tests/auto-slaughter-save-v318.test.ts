import { expect,test } from 'vitest';
import { SnapshotDecoder,SnapshotEncoder } from '../src/bridge/snapshots.ts';
import { autoSlaughterTargets,slaughterIntent } from '../src/sim/auto-slaughter.ts';
import { validAutoSlaughterConfig,validAutoSlaughterTransport } from '../src/sim/auto-slaughter-save.ts';
import type { AutoSlaughterConfig,AutoSlaughterSpecies } from '../src/sim/auto-slaughter-state.ts';
import { validDomesticTasksTransport,validSlaughterTransport } from '../src/sim/domestic-save.ts';
import { validAnimalRestTransport } from '../src/sim/animal-rest-save.ts';
import { BLOOD_UNIT } from '../src/sim/injury-rules.ts';
import { reconcileAnimalHealth } from '../src/sim/wildlife-health.ts';
import { deserializeWorld,serializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { SCHEMA_VERSION,type World } from '../src/sim/types.ts';
import { herdCareCamp } from './helpers/veterinary-v277.ts';

const species=['hare','deer','gazelle','muffalo','dromedary'] as const;
const config=(kind:AutoSlaughterSpecies='muffalo',maxTotal=-1):AutoSlaughterConfig=>({
  species:kind,maxTotal,maxMales:-1,maxMalesYoung:-1,maxFemales:-1,maxFemalesYoung:-1,allowPregnant:false,
});
const checkpoint=(world:World)=>new SnapshotDecoder().adopt(structuredClone(new SnapshotEncoder().encode(world,0,0)));
function prepared(kind:AutoSlaughterSpecies='muffalo',phase:'approach'|'interact'='approach') {
  const {world:w}=herdCareCamp(kind),a=w.wildlife!.animals[0]!,p=w.pawns[0]!;
  p.priorities.handle=1;p.skills.animals={level:0,xp:0,dailyXp:0,passion:0};
  p.x=a.x-1;p.z=a.z;p.path=[];p.motion=null;p.moveCooldown=0;p.state=phase==='interact'?'working':'moving';
  p.animalHandling={animalId:a.id,kind:'slaughter',phase,sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0};
  w.autoSlaughter=[config(kind,0)];
  return {w,a,p};
}

test.each(species)('%s quota alone authorizes the original approach and contact owner through file and Decoder',kind=>{
  for(const phase of ['approach','interact'] as const){
    const {w,a}=prepared(kind,phase),frozen=structuredClone(w);
    expect(a.domestic!.slaughter).toBeUndefined();expect(slaughterIntent(w,a)).toBe(true);
    expect(autoSlaughterTargets(w).has(a.id)).toBe(true);expect(validSlaughterTransport(w,w.schemaVersion)).toBe(true);
    expect(validDomesticTasksTransport(w,w.schemaVersion)).toBe(true);expect(validateWorld(w)).toEqual([]);
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    const result=checkpoint(w);expect(result.status).toBe('applied');if(result.status==='applied')expect(result.world).toEqual(w);
    expect(w).toEqual(frozen);
  }
});

test('227 migration only changes the schema, preserving manual slaughter, original tasks, health, goods and RNG',()=>{
  const {w,a}=prepared();delete w.autoSlaughter;a.domestic!.slaughter=true;
  w.schemaVersion=227 as World['schemaVersion'];const before=structuredClone(w);
  expect(validAutoSlaughterTransport(w,227)).toBe(true);expect(validDomesticTasksTransport(w,227)).toBe(true);
  expect(autoSlaughterTargets(w,227).size).toBe(0);
  expect(deserializeWorld(JSON.stringify(w))).toEqual({...before,schemaVersion:SCHEMA_VERSION});
  expect(w).toEqual(before);expect(Object.hasOwn(before,'autoSlaughter')).toBe(false);
});

test('227 refuses the future policy before migration; even an undefined in-memory key is future',()=>{
  const {w,a,p}=prepared();delete p.animalHandling;p.state='idle';a.domestic!.slaughter=true;
  w.schemaVersion=227 as World['schemaVersion'];
  expect(validAutoSlaughterTransport(w,227)).toBe(false);expect(checkpoint(w).status).toBe('resync');
  expect(()=>deserializeWorld(JSON.stringify(w))).toThrow(/version 227.*Future auto slaughter/);
  Object.assign(w,{autoSlaughter:undefined});
  expect(validAutoSlaughterTransport(w,227)).toBe(false);expect(checkpoint(w).status).toBe('resync');
  // JSON omits undefined, while transport still sees and rejects its future key.
  delete w.autoSlaughter;expect(checkpoint(w).status).toBe('applied');
});

test('pre-migration future-key refusal also protects the version-one normalization path',()=>{
  expect(()=>deserializeWorld(JSON.stringify({schemaVersion:1,autoSlaughter:[config()]})))
    .toThrow(/version 1.*Future auto slaughter/);
});

test('quota-derived work has no authority in the old schema or without a matching limit; the manual mandate remains independent',()=>{
  const {w,a}=prepared();
  expect(slaughterIntent(w,a,227)).toBe(false);expect(validSlaughterTransport(w,227)).toBe(false);
  delete w.autoSlaughter;
  expect(slaughterIntent(w,a)).toBe(false);expect(validDomesticTasksTransport(w,w.schemaVersion)).toBe(false);
  expect(checkpoint(w).status).toBe('resync');expect(()=>serializeWorld(w)).toThrow();
  a.domestic!.slaughter=true;
  expect(slaughterIntent(w,a)).toBe(true);expect(validDomesticTasksTransport(w,w.schemaVersion)).toBe(true);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);expect(checkpoint(w).status).toBe('applied');
});

test('configuration fields are exact, bounded safe integers and distinct supported species',()=>{
  const mutations:((value:Record<string,unknown>)=>void)[]=[
    c=>{c.species='unknown-species';},c=>{c.species='human';},c=>{c.maxTotal=-2;},c=>{c.maxMales=.5;},
    c=>{c.maxMalesYoung=Number.MAX_SAFE_INTEGER+1;},c=>{c.maxFemales=Infinity;},
    c=>{c.maxFemalesYoung=NaN;},c=>{c.maxTotal='0';},c=>{c.allowPregnant=1;},
    c=>{delete c.maxTotal;},c=>{c.allowPregnant=undefined;},c=>{c.selectedIds=[];},
  ];
  for(const change of mutations){
    const {w,p}=prepared();delete p.animalHandling;p.state='idle';const invalid={...config()};
    change(invalid as unknown as Record<string,unknown>);w.autoSlaughter=[invalid];
    expect(validAutoSlaughterConfig(invalid)).toBe(false);expect(validAutoSlaughterTransport(w)).toBe(false);
    expect(validateWorld(w).length).toBeGreaterThan(0);expect(checkpoint(w).status).toBe('resync');
    expect(()=>deserializeWorld(JSON.stringify(w))).toThrow();
  }
  const {w,p}=prepared();delete p.animalHandling;p.state='idle';
  for(const invalid of [null,undefined,{},[config(),config()],Array.from({length:6},()=>config())]){
    Object.assign(w,{autoSlaughter:invalid});expect(validAutoSlaughterTransport(w)).toBe(false);expect(checkpoint(w).status).toBe('resync');
  }
  w.autoSlaughter=species.map(kind=>({...config(kind),maxTotal:Number.MAX_SAFE_INTEGER}));
  expect(validAutoSlaughterTransport(w)).toBe(true);expect(validateWorld(w)).toEqual([]);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('all unlimited or absent settings create no designation, task, identity or RNG history',()=>{
  const {w,a,p}=prepared();delete p.animalHandling;p.state='idle';w.autoSlaughter=[config()];
  const frozen=structuredClone(w);
  expect(autoSlaughterTargets(w).size).toBe(0);expect(slaughterIntent(w,a)).toBe(false);
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  expect(checkpoint(w).status).toBe('applied');expect(w).toEqual(frozen);
  delete w.autoSlaughter;const absent=structuredClone(w);
  expect(autoSlaughterTargets(w).size).toBe(0);expect(deserializeWorld(serializeWorld(w))).toEqual(absent);
  expect(Object.hasOwn(w,'autoSlaughter')).toBe(false);
});

test('same-tick policy replacement and removal retain earlier Decoder views; a rejected delta preserves authority',()=>{
  const {w,p}=prepared();delete p.animalHandling;p.state='idle';w.autoSlaughter=[config()];
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),first=decoder.adopt(structuredClone(encoder.encode(w,0,0)));
  expect(first.status).toBe('applied');if(first.status!=='applied')throw Error('Missing policy checkpoint');
  const retained=structuredClone(first.world),tick=w.tick,rng=w.rng,nextId=w.nextId;
  w.autoSlaughter=[config('muffalo',0)];const good=structuredClone(encoder.encode(w,0,0)),bad=structuredClone(good);
  bad.world.autoSlaughter![0]!.maxFemalesYoung=-2;
  expect(decoder.adopt(bad).status).toBe('resync');expect(first.world).toEqual(retained);
  const second=decoder.adopt(good);expect(second.status).toBe('applied');if(second.status!=='applied')throw Error('Missing valid policy delta');
  expect(second.world).toEqual(w);const secondRetained=structuredClone(second.world);
  delete w.autoSlaughter;const third=decoder.adopt(structuredClone(encoder.encode(w,0,0)));
  expect(third.status).toBe('applied');if(third.status==='applied'){
    expect(third.world).toEqual(w);expect(Object.hasOwn(third.world,'autoSlaughter')).toBe(false);
  }
  expect(first.world).toEqual(retained);expect(second.world).toEqual(secondRetained);
  expect(w.tick).toBe(tick);expect(w.rng).toBe(rng);expect(w.nextId).toBe(nextId);
});

test('227 corruption is refused before the neutral migration can hide its original ownership failure',()=>{
  const {w,a,p}=prepared();delete w.autoSlaughter;a.domestic!.slaughter=true;w.schemaVersion=227 as World['schemaVersion'];
  p.animalHandling!.quantity=1;
  expect(()=>deserializeWorld(JSON.stringify(w))).toThrow(/version 227/);
});

test('a selected quota animal cannot retain stale rest ownership; its independent bed assignment remains valid',()=>{
  const {w,a,p}=prepared();delete p.animalHandling;p.state='idle';
  const spot={id:w.nextId++,kind:'animal-sleeping-spot' as const,x:a.x,z:a.z,orientation:0 as const,footprint:'standard' as const};
  w.structures.push(spot);a.domestic!.bedId=spot.id;a.animalRest={spotId:spot.id,phase:'sleep'};
  expect(a.state).toBe('sleeping');expect(validAnimalRestTransport(w,w.schemaVersion)).toBe(false);
  expect(checkpoint(w).status).toBe('resync');expect(()=>serializeWorld(w)).toThrow();
  delete a.animalRest;
  expect(a.domestic!.bedId).toBe(spot.id);expect(validAnimalRestTransport(w,w.schemaVersion)).toBe(true);
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  expect(checkpoint(w).status).toBe('applied');
});

test('quota population still includes an original rescue patient and preserves the concurrent rescue claim',()=>{
  const {w,a,p}=prepared();delete p.animalHandling;
  a.health!.bloodLoss=Math.round(BLOOD_UNIT*.7);reconcileAnimalHealth(w,a);
  const spot={id:w.nextId++,kind:'animal-sleeping-spot' as const,x:p.x-3,z:p.z,orientation:0 as const,footprint:'standard' as const,medical:true as const};
  w.structures.push(spot);p.animalRescue={animalId:a.id,spotId:spot.id,phase:'approach'};
  expect(a.state).toBe('downed');expect(autoSlaughterTargets(w).has(a.id)).toBe(true);
  expect(validAnimalRestTransport(w,w.schemaVersion)).toBe(true);expect(validateWorld(w)).toEqual([]);
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);expect(checkpoint(w).status).toBe('applied');
});
