import {beforeAll,describe,it,expect} from 'vitest';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {generateGeographicWorldDraft256,type GeographicWorldDraft256} from '../src/sim/world-geographic-draft.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {captureGeneratedGeography256} from '../src/sim/world-geography-owner-256.ts';
import {createGeographicPlanet256} from '../src/sim/planet-factory-256.ts';
import {geographicLocalSite256} from '../src/sim/site-geographic-256.ts';
import {planetFactionTargets256} from '../src/sim/planet-faction-targets-256.ts';
import {canPlaceWorldSettlement} from '../src/sim/world-settlement-placement.ts';
import {createWildPlantMapReader256,createActualWildPlantMapReader256} from '../src/sim/wild-plant-runtime-map-256.ts';
import {actualPlantPhysicalMasks256} from '../src/sim/actual-plant-physical-masks-256.ts';
import {createActualPlantSpatialSession256,createActualPlantSpatialSpawner256} from '../src/sim/actual-plant-spatial-session-256.ts';
import {PlantSpatialRegions256} from '../src/sim/wild-plant-spatial-regions-256.ts';
import {createPlantGenerationRegions256,plantRegionsNear256,touchablePlantRegions256} from '../src/sim/wild-plant-regions-256.ts';
import {createWildPlantSpawner256,createSpatialWildPlantSpawner256} from '../src/sim/wild-plant-spawner-256.ts';
import {validatePlantMap256} from '../src/sim/wild-plant-generation-256.ts';
import {actualPlantRuntimeSessionFactory256} from '../src/sim/wild-plant-runtime-session-256.ts';
import {LOCAL_BIOME_RULES_256} from '../src/sim/local-biome-rules-v256.ts';
import {createWildPlantResource256} from '../src/sim/wild-plant-acquisition-v256.ts';
import {createWildFloraState256,advanceWildFlora256,plantRegrowthMtb256} from '../src/sim/wild-plant-runtime-256.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {healthRandom} from '../src/sim/health.ts';
import {geyserCells256} from '../src/sim/local-geyser-state-256.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {sowDaylily} from '../src/sim/flower-pot.ts';
import type {World,Structure,Job,Tile} from '../src/sim/types.ts';

const f=Math.fround;
let draft:GeographicWorldDraft256,planet:ReturnType<typeof createGeographicPlanet256>;
// Genuine immutable campaign owner. Local terrain/owners below are declared
// unit fixtures; they do not claim natural generation or full-save admission.
beforeAll(()=>{
 const generation=generateGeographicWorldDraft256({seed:'Elsewhere',settings:defaultWorldGenerationSettings(),tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'Colonie'});
 let next=generation.next();while(!next.done)next=generation.next();draft=next.value;
 const owner=captureGeneratedGeography256(draft),targets=planetFactionTargets256(draft.factions,owner.surface.tiles);if(!targets)throw Error('Missing actual faction owner');
 const home=owner.surface.tiles.find(t=>t.biome==='temperate-forest'&&canPlaceWorldSettlement(owner.surface.tiles,t.id,{settlementTiles:targets.occupied}));if(!home)throw Error('Missing actual temperate tile');
 planet=createGeographicPlanet256({geography:owner,factions:draft.factions,homeTile:home.id,adoptedAt:0,nextGroupId:1});
},120000);
function prepare(){
 const world=deconstructionCamp(1,32);world.planet=planet;world.worldFactions=draft.factions;world.site=geographicLocalSite256(planet,planet.homeTile);world.seed=world.site.mapSeed>>>0;
 world.tiles=world.tiles.map(()=>({terrain:'soil-natural'}));world.resources=[];world.structures=[];world.jobs=[];world.piles=[];world.packed=[];world.growingZones=[];delete world.roofing;delete world.geysers;
 return world;
}
const coldReader=()=>createWildPlantMapReader256(actualPlantPhysicalMasks256,()=>1);
function session(world:World,input:ReturnType<ReturnType<typeof coldReader>['capture']>,desiredPlants:number){
 return createActualPlantSpatialSession256(world,{width:world.width,height:world.height,rules:input.rules,densityFactor:input.densityFactor,tileMinTemperature:input.tileMinTemperature,tileMaxTemperature:input.tileMaxTemperature,desiredPlants});
}
function populated(){
 const world=prepare(),terrains:Tile['terrain'][]=['soil-natural','rich-soil','gravel','mossy-soil','marsh','water-shallow','river-shallow','sand','ice','rock'];
 for(let c=0;c<world.tiles.length;c++)world.tiles[c]={terrain:terrains[Math.floor(c/32)%terrains.length]!,...(c%29===0?{snowDepth:.199999999}:{}),...(c%37===0?{bridge:true as const}:{}),...(c%41===0?{floor:'wood-planks' as const}:{}),...(c%47===0?{terrain:'rough-stone' as const,stone:'granite' as const}:{}),...(c%43===0?{terrain:'rock' as const,collapsedRock:{id:world.nextId++,terrain:'soil-natural' as const}}:{})};
 for(const [i,kind] of (['wall','door','fence','fence-gate','table-square','bed','shelf','sleeping-spot','hydroponics-basin','power-conduit','power-switch'] as const).entries())fixtureBuilding(world,kind,2+i*2,3);
 world.jobs=[{id:world.nextId++,kind:'wall',x:10,z:10,construction:'frame',status:'pending',reservedBy:null,progress:0,orientation:0,footprint:'standard',escrow:{wood:0,food:0}},
  {id:world.nextId++,kind:'wall',x:12,z:10,construction:'blueprint',status:'pending',reservedBy:null,progress:0,orientation:0,footprint:'standard',escrow:{wood:0,food:0}},
  {id:world.nextId++,kind:'lay-floor',x:14,z:10,construction:'frame',status:'pending',reservedBy:null,progress:0,orientation:0,footprint:'standard',escrow:{wood:0,food:0}}] satisfies Job[];
 for(let i=0;i<20;i++){
  const plant=createWildPlantResource256(world,world.nextId++,1+i%10,14+Math.floor(i/10),(['grass','pine','bush','cypress'] as const)[i%4]!,.4,true);if(!plant)throw Error('Missing real unit plant');world.resources.push(plant);
 }
 const pot=fixtureBuilding(world,'flower-pot',25,15) as Structure;pot.flower={allowSow:false,plant:sowDaylily(world.tick)};
 const packed=fixtureBuilding(world,'bed',27,27);world.structures=world.structures.filter(s=>s!==packed);world.packed=[{building:packed,owner:{type:'ground',x:28,z:27}}];
 addMaterial(world,'chunk',1,{type:'ground',x:10,z:18});addMaterial(world,'wood',4,{type:'ground',x:12,z:18});addMaterial(world,'chunk',1,{type:'inventory',pawnId:world.pawns[0]!.id});
 world.roofing={constructed:[40],build:[],remove:[],cursor:0,natural:{thin:Array.from({length:32},(_,i)=>20*32+i),thick:[21*32+12]}};
 world.geysers={revision:1,atTick:world.tick,items:[{id:world.nextId++,x:21,z:25,ticksUntilSpray:10,sprayTicksLeft:0}]};
 return world;
}

describe('V425 ephemeral spatial flora',()=>{
 it('preserves raw geyser Map-key observations without adding coordinate validation or changing existing guards',()=>{
  const world=prepare(),input=coldReader().capture(world),n=world.width*world.height;
  const raw=[{x:4,z:4},{x:-1,z:0},{x:31,z:31},{x:2000,z:2000},{x:.5,z:.125},
   {x:.5,z:.015625},{x:NaN,z:0},{x:Infinity,z:0},{x:-Infinity,z:0},{x:-0,z:0},{x:'',z:0}];
  for(const point of raw){
   const geyser={id:world.nextId,x:point.x,z:point.z,ticksUntilSpray:10,sprayTicksLeft:0} as unknown as NonNullable<World['geysers']>['items'][number];
   world.geysers={revision:1,atTick:world.tick,items:[geyser]};
   // Legacy Map keys are intentionally not normalized: strings/fractions/NaN
   // never matched numeric valid queries, while edge spill/cancellation can.
   const legacy=new Map<unknown,number>();for(const key of geyserCells256(world.width,geyser))legacy.set(key,8);
   const actual=session(world,input,0);
   for(let c=0;c<n;c++){
    expect(actual.spatial.cell(c).blocksPlanting).toBe(legacy.has(c));
    expect(actual.spatial.cell(c).occupied).toBe(false);
   }
   for(const c of [-1,n,.5,NaN,Infinity])expect(()=>actual.spatial.cell(c)).toThrow('Invalid actual spatial plant cell');
  }
  world.geysers!.items[0]!.x=Symbol('raw coordinate') as unknown as number;
  expect(()=>session(world,input,0)).toThrow(TypeError);
  delete world.geysers;
  world.resources=[{id:world.nextId,kind:'rock',x:-1,z:0,amount:1}];
  expect(()=>session(world,input,0)).toThrow('Physical plant owner outside its actual map');
 });
 it('preserves exact chunk components, BFS order, float sums and diagonal contacts',()=>{
  const width=37,height=29,n=width*height,types=Uint8Array.from({length:n},(_,c)=>c%31===0?2:c%19===0?3:c%17===0?0:c%23===0?4:1),base=Float32Array.from({length:n},(_,c)=>(c%11)/7),walk=Uint8Array.from(types,v=>v===1||v===3?1:0);
  const cold=createPlantGenerationRegions256(width,height,types,base),lazy=new PlantSpatialRegions256(width,height,c=>types[c]!,c=>base[c]!);
  for(let c=0;c<n;c++){
   const expected=cold.regions[cold.at[c]!],actual=lazy.regionAt(c);
   expect(actual&&{...actual,id:0,neighbours:[]}).toEqual(expected&&{...expected,id:0,neighbours:[]});
  }
  for(const c of [0,11,12,36,37*11+11,37*12+12,n-1])for(const radius of [0,7,12,20,25.5,40]){
   const expected=plantRegionsNear256(cold,c,radius),actual=lazy.near(c,radius);
   expect(actual.map(r=>r.cells[0])).toEqual(expected.map(r=>r.cells[0]));
   for(const region of actual)for(const plant of [c,Math.max(0,c-1),Math.min(n-1,c+width+1)]){
    const contact=touchablePlantRegions256(cold,plant,walk).map(id=>cold.regions[id]!.cells[0]);
    expect(lazy.touches(plant,region,c=>!!walk[c])).toBe(contact.includes(region.cells[0]));
   }
  }
 });
 it('reads only reached chunks and their adjacency fringe for a local250² query',()=>{
  let reads=0;const lazy=new PlantSpatialRegions256(250,250,()=>{reads++;return 1;},()=>1);
  expect(lazy.near(125*250+125,20).length).toBeGreaterThan(1);expect(reads).toBeLessThan(10000);
 });
 it('matches all physical cold classifications, real potted/crop owners, surfaces and float32 snow',()=>{
  const world=populated(),before=JSON.stringify(world),input=coldReader().capture(world),actual=session(world,input,0);
  expect(actual.existing).toEqual(input.existing);
  for(let c=0;c<world.tiles.length;c++)expect(actual.spatial.cell(c)).toMatchObject({fertility:input.fertility[c],naturalRoof:!!input.naturalRoof[c],water:!!input.water[c],baseWater:!!input.baseWater[c],terrainDefId:input.terrainDefIds[c],terrainTags:input.terrainTags[c],occupied:!!input.occupied[c],blocksPlanting:!!input.blocksPlanting[c],snowDepth:input.snowDepth[c],sandDepth:input.sandDepth[c],regionType:input.regionTypes[c],walkableNoDoor:!!input.walkableNoDoor[c]});
  expect(JSON.stringify(world)).toBe(before);
 });
 it('keeps species choices, staged new plants and every random draw identical to the complete oracle',()=>{
  const world=populated(),captured=coldReader().capture(world);let placed=0;
  for(const biome of ['temperate-forest','cold-bog','tropical-swamp','desert'] as const){
   const input={...captured,rules:LOCAL_BIOME_RULES_256[biome]},order=validatePlantMap256(input),cold=createWildPlantSpawner256(input,order),lazy=createSpatialWildPlantSpawner256(session(world,input,cold.desiredPlants),order),a=new WorldGenerationRandom(3157),b=new WorldGenerationRandom(3157);
   for(let i=0;i<160;i++){
    const cell=(i*719)%world.tiles.length,expected=cold.pick(cell,a,cold.desiredPlants,true),actual=lazy.pick(cell,b,cold.desiredPlants,true);
    expect(actual).toBe(expected);expect(b.state).toEqual(a.state);expect(lazy.desiredAt(cell)).toBe(cold.desiredAt(cell));
    if(expected!==undefined){const plant={cell,defId:expected,nonStump:true};cold.record(plant);lazy.record(plant);placed++;}
   }
  }
  expect(placed).toBeGreaterThan(0);
 });
 it('transfers one actual population exactly, including crops, pot owners and staged record invalidation',()=>{
  const world=populated();
  world.resources.push({id:world.nextId++,kind:'rice',x:29,z:29,amount:6,growth:.2,growthTick:world.tick});
  world.resources.reverse();const before=structuredClone(world),captured=coldReader().capture(world);let placed=0;
  for(const biome of ['temperate-forest','cold-bog','tropical-swamp','desert'] as const){
   const input={...captured,rules:LOCAL_BIOME_RULES_256[biome]},order=validatePlantMap256(input),desired=createWildPlantSpawner256(input,order).desiredPlants;
   const literal=createSpatialWildPlantSpawner256(session(world,input,desired),order);
   const prepared=createActualPlantSpatialSpawner256(world,{width:world.width,height:world.height,rules:input.rules,densityFactor:input.densityFactor,
    tileMinTemperature:input.tileMinTemperature,tileMaxTemperature:input.tileMaxTemperature,desiredPlants:desired},order);
   const a=new WorldGenerationRandom(3157),b=new WorldGenerationRandom(3157);
   for(let i=0;i<320;i++){
    const cell=(i*719)%world.tiles.length,expected=literal.pick(cell,a,desired,true),actual=prepared.pick(cell,b,desired,true);
    expect(actual).toBe(expected);expect(b.state).toEqual(a.state);expect(prepared.desiredAt(cell)).toBe(literal.desiredAt(cell));
    if(expected!==undefined){const row={cell,defId:expected,nonStump:true};literal.record(row);prepared.record(row);placed++;}
   }
  }
  expect(placed).toBeGreaterThan(0);expect(world).toStrictEqual(before);
 });
 it('follows each replaced resources array exactly: removals, appends, reorders, replaced and duplicate plants',()=>{
  // The prepared spawner keeps one capture per World and follows the next
  // array when resources were only removed or appended; anything else is
  // rebuilt. Every step must draw exactly what a complete cold capture draws.
  const world=populated(),captured=coldReader().capture(world),input={...captured,rules:LOCAL_BIOME_RULES_256['temperate-forest']};
  const order=validatePlantMap256(input),desired=createWildPlantSpawner256(input,order).desiredPlants;
  const header={width:world.width,height:world.height,rules:input.rules,densityFactor:input.densityFactor,tileMinTemperature:input.tileMinTemperature,tileMaxTemperature:input.tileMaxTemperature,desiredPlants:desired};
  const plant=(x:number,z:number,species:'grass'|'bush'|'pine')=>{const p=createWildPlantResource256(world,world.nextId++,x,z,species,.4,true);if(!p)throw Error('Missing real unit plant');return p;};
  const compare=()=>{
   const literal=createSpatialWildPlantSpawner256(session(world,input,desired),order),prepared=createActualPlantSpatialSpawner256(world,header,order);
   const a=new WorldGenerationRandom(77),b=new WorldGenerationRandom(77);let picked=0;
   for(let cell=0;cell<world.tiles.length;cell+=3){
    const expected=literal.pick(cell,a,desired,true),actual=prepared.pick(cell,b,desired,true);
    expect(actual).toBe(expected);expect(b.state).toEqual(a.state);expect(prepared.desiredAt(cell)).toBe(literal.desiredAt(cell));
    if(expected!==undefined)picked++;
   }
   return picked;
  };
  let picked=compare();
  const firstPlant=()=>world.resources.find(r=>r.species!==undefined)!;
  const steps:((r:World['resources'])=>World['resources'])[]=[
   r=>r.filter((_,i)=>i%3!==1),
   r=>[...r,plant(20,20,'grass'),plant(21,20,'bush')],
   r=>{const gone=firstPlant();return [...r.filter(x=>x!==gone),plant(gone.x,gone.z,'pine')];},
   r=>[...r],
   r=>[...r].reverse(),
   r=>r.map((x,i)=>i===2?{...x}:x),
   r=>r.slice(0,-1),
   r=>[...r.slice(1),r[0]!],
  ];
  for(const step of steps){world.resources=step(world.resources);picked+=compare();}
  expect(picked).toBeGreaterThan(0);
  // A duplicate plant is refused, and leaves no partial capture behind.
  const valid=world.resources,kept=firstPlant();
  world.resources=[...valid,plant(kept.x,kept.z,'grass')];
  expect(()=>createActualPlantSpatialSpawner256(world,header,order)).toThrow('Invalid existing initial plant');
  world.resources=valid.filter(x=>x!==kept);compare();
  world.resources=[...world.resources,kept];compare();
 });
 it('keeps actual population duplicate refusals and failure atomicity before returning a spawner',()=>{
  for(const duplicatePot of [false,true]){
   const world=populated(),input=coldReader().capture(world),order=validatePlantMap256(input);
   const row=duplicatePot?world.structures.find(s=>s.kind==='flower-pot')!:world.resources[0]!;
   world.resources.push({id:world.nextId++,kind:'rice',x:row.x,z:row.z,amount:6,growth:.2,growthTick:world.tick});
   const before=structuredClone(world),header={width:world.width,height:world.height,rules:input.rules,densityFactor:input.densityFactor,
    tileMinTemperature:input.tileMinTemperature,tileMaxTemperature:input.tileMaxTemperature,desiredPlants:0};
   expect(()=>createActualPlantSpatialSession256(world,header)).toThrow('Invalid existing initial plant');
   expect(()=>createActualPlantSpatialSpawner256(world,header,order)).toThrow('Invalid existing initial plant');
   expect(world).toStrictEqual(before);
  }
 });
 it('does not grant runtime trust to generic readers, copies or replaced methods',()=>{
  const actual=createActualWildPlantMapReader256(()=>1),generic=coldReader();expect(actualPlantRuntimeSessionFactory256(actual)).toBeTypeOf('function');
  expect(actualPlantRuntimeSessionFactory256(generic)).toBeUndefined();expect(actualPlantRuntimeSessionFactory256({...actual})).toBeUndefined();
  const capture=actual.capture;actual.capture=world=>capture(world);expect(actualPlantRuntimeSessionFactory256(actual)).toBeUndefined();
 });
 it('keeps real renewal RNG, IDs and persisted counters exact after in-place terrain/owner edits and a cold reconstruction',()=>{
  const actualReader=createActualWildPlantMapReader256(()=>1),cold=coldReader(),world=prepare();world.flora=createWildFloraState256(world,actualReader);
  let restored:World={...structuredClone(world),planet:world.planet,worldFactions:world.worldFactions};
  const signature=(w:World)=>({tick:w.tick,rng:w.rng,nextId:w.nextId,flora:structuredClone(w.flora),resources:structuredClone(w.resources)});
  const seedFor=(chance:number)=>{for(let seed=1;seed<1000000;seed++){const stream={rng:seed};if(f(healthRandom(stream))<chance&&plantRegrowthMtb256(30,()=>f(healthRandom(stream))))return seed;}throw Error('Missing bounded renewal event witness');};
  for(let step=0;step<18;step++){
   if(world.flora?.revision!==2)throw Error('Missing actual counters');
   const seed=seedFor(world.flora.desired/world.flora.fertile);world.rng=seed;restored.rng=seed;
   if(step===3){world.tiles[11]!.floor='wood-planks';restored.tiles[11]!.floor='wood-planks';}
   if(step===5){world.tiles[12]!.terrain='water-shallow';restored.tiles[12]!.terrain='water-shallow';}
   if(step===7){world.resources.splice(0,1);restored.resources.splice(0,1);}
   if(step===9){fixtureBuilding(world,'wall',10,10);fixtureBuilding(restored,'wall',10,10);}
   if(step===11){world.structures[0]!.kind='door';restored.structures[0]!.kind='door';}
   if(step===13)restored={...restored,flora:JSON.parse(JSON.stringify(restored.flora)),resources:JSON.parse(JSON.stringify(restored.resources))};
   world.tick++;restored.tick++;advanceWildFlora256(world,actualReader);advanceWildFlora256(restored,cold);expect(signature(world)).toEqual(signature(restored));
  }
  expect(world.resources.length).toBeGreaterThan(0);
 });
});
