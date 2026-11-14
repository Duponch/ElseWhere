import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots.ts';
import {adoptMiscIncidents,adoptWeatherIncidents,advanceMiscIncidents,MISC_FIRST_CHECK} from '../src/sim/cassandra-misc.ts';
import {adoptWorldIncidents,advanceWorldIncidents,WORLD_FIRST_CHECK} from '../src/sim/cassandra-world.ts';
import {validMiscIncidents} from '../src/sim/cassandra-misc-save.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {enableCassandraRaids} from '../src/sim/cassandra-raids.ts';
import {createWorld,refreshStock,stepWorld} from '../src/sim/index.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {adoptSiteClimate} from '../src/sim/site-climate.ts';
import {resolveSite} from '../src/sim/site.ts';
import {initializeWildFlora} from '../src/sim/wild-flora.ts';
import {adoptFluIncidents} from '../src/sim/flu-incidents.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';

function colony():World {
  const w=createWorld(265,32,32);w.pawns=[];w.resources=[];w.piles=[];w.jobs=[];w.structures=[];
  w.stockpiles=[];w.growingZones=[];refreshStock(w);w.gameProfile=crashlandedProfile();w.tick=MISC_FIRST_CHECK-1;
  w.scenario={id:'crashlanded',revision:8,landing:{x:4,z:4}};
  w.site=resolveSite(w.seed,{hilliness:'flat',biome:'boreal-forest'});
  if(w.site.revision===2)initializeWildFlora(w,w.site);
  enableCassandraRaids(w);adoptFluIncidents(w);adoptSiteClimate(w);adoptMiscIncidents(w);return w;
}
/** A world where an ordinary ticket selected the incident. Schema 329: the
 * cold snap comes from the Core Misc lottery and the eclipse from the World
 * component, so the private calendar seed is searched rather than fixed. */
const selectedCache=new Map<string,World>();
function selected(kind:'coldSnap'|'eclipse'):World {
  const cached=selectedCache.get(kind);if(cached)return structuredClone(cached);
  const base=colony();adoptWeatherIncidents(base);if(kind==='eclipse')adoptWorldIncidents(base);
  for(let seed=1;seed<200000;seed++){
    const w=structuredClone(base);
    if(kind==='coldSnap'){w.miscIncidents!.rng=seed;w.tick=MISC_FIRST_CHECK;advanceMiscIncidents(w);}
    else{w.tick=WORLD_FIRST_CHECK;w.worldIncidents!.nextCheck=w.tick;w.worldIncidents!.rng=seed;advanceWorldIncidents(w);}
    if(w.miscIncidents!.weather![kind]){selectedCache.set(kind,w);return structuredClone(w);}
  }
  throw Error('No calendar seed selects '+kind);
}

test('actual ordinary tickets select the two new incidents once, without spending World RNG',()=>{
  for(const kind of ['coldSnap','eclipse'] as const){
    const w=selected(kind),rng=w.rng,before=structuredClone(w);
    expect(w.miscIncidents!.opportunities).toBe(1);expect(validateWorld(w)).toEqual([]);
    advanceMiscIncidents(w);expect(w).toEqual(before);expect(w.rng).toBe(rng);
  }
  // A selected flashstorm ticket that cannot run never becomes a cold snap.
  const w=colony();adoptWeatherIncidents(w);w.miscIncidents!.rng=4;
  w.tick=MISC_FIRST_CHECK;advanceMiscIncidents(w);
  expect(w.miscIncidents!.weather).toEqual({adoptedAt:MISC_FIRST_CHECK-1,coldSnaps:0,eclipses:0});
});

test('schema199 validates first and migrates neutrally; adoption waits for an ordinary played step',()=>{
  const w=colony();w.schemaVersion=199 as World['schemaVersion'];const before=structuredClone(w);
  const restored=deserializeWorld(JSON.stringify(w));
  expect(restored).toEqual({...before,schemaVersion:SCHEMA_VERSION});expect(w).toEqual(before);
  stepWorld(restored,0);expect(restored.miscIncidents!.weather).toBeUndefined();
  const rng=restored.rng;stepWorld(restored,1);
  expect(restored.miscIncidents!.weather?.adoptedAt).toBe(before.tick);expect(restored.rng).toBe(rng);
  const forged=structuredClone(w);
  forged.miscIncidents!.weather={adoptedAt:forged.tick,coldSnaps:0,eclipses:0};
  expect(()=>deserializeWorld(JSON.stringify(forged))).toThrow('Invalid version 199 save');
});

test('weather histories reject impossible counts, clocks, durations, overlap and future fields',()=>{
  const w=selected('coldSnap');
  const corruptions:Array<(c:World)=>void>=[
    c=>{c.miscIncidents!.weather!.adoptedAt=c.tick+1;},
    c=>{c.miscIncidents!.weather!.coldSnaps=2;},
    c=>{c.miscIncidents!.weather!.lastColdSnapStart!++;},
    c=>{c.miscIncidents!.weather!.coldSnap!.end=c.tick;},
    c=>{c.miscIncidents!.weather!.coldSnap!.end=c.tick+21000;},
    c=>{c.miscIncidents!.weather!.coldSnap!.end=c.tick+8999;},
    c=>{Object.assign(c.miscIncidents!.weather!,{future:true});},
    c=>{c.miscIncidents!.weather!.coldSnaps=0;},
    c=>{c.miscIncidents!.heatwaves=1;c.miscIncidents!.lastHeatwaveStart=c.tick;
      c.miscIncidents!.active={start:c.tick,end:c.tick+9000};c.miscIncidents!.opportunities=2;},
  ];
  for(const corrupt of corruptions){const c=structuredClone(w);corrupt(c);expect(validMiscIncidents(c.miscIncidents,SCHEMA_VERSION,c)).toBe(false);}
  const e=selected('eclipse');e.miscIncidents!.weather!.eclipse!.end=e.tick+7500;
  expect(validateWorld(e).length).toBeGreaterThan(0);
});

test('strict snapshot rejection is atomic and a repaired checkpoint preserves old views',()=>{
  const w=selected('eclipse'),encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  const first=decoder.adopt(structuredClone(encoder.encode(w,0,6)));expect(first.status).toBe('applied');
  if(first.status!=='applied')throw Error('initial checkpoint');const before=structuredClone(first.world);
  w.tick++;w.miscIncidents!.weather!.eclipse!.end=w.tick+7500;
  expect(decoder.adopt(structuredClone(encoder.encode(w,0,6))).status).toBe('resync');
  expect(first.world).toEqual(before);w.miscIncidents!.weather!.eclipse!.end=before.miscIncidents!.weather!.eclipse!.end;
  expect(decoder.adopt(structuredClone(encoder.encode(w,0,6,true))).status).toBe('applied');expect(first.world).toEqual(before);
});

test('both incidents resume and expire through real simulation steps with one end notification',()=>{
  for(const kind of ['coldSnap','eclipse'] as const){
    const w=selected(kind),end=w.miscIncidents!.weather![kind]!.end;
    w.tick=end-3;stepWorld(w);const resumed=deserializeWorld(serializeWorld(w));
    stepWorld(w,3);stepWorld(resumed,3);expect(resumed).toEqual(w);expect(validateWorld(w)).toEqual([]);
    expect(w.miscIncidents!.weather![kind]).toBeUndefined();
    expect(w.events.filter(e=>e.message.startsWith(kind==='coldSnap'?'La vague de froid se termine':'L’éclipse se termine'))).toHaveLength(1);
  }
});
