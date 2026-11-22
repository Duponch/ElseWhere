import {beforeAll,expect,test} from 'vitest';
import {generateGeographicWorldDraft256,type GeographicWorldDraft256} from '../src/sim/world-geographic-draft.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {captureGeneratedGeography256,type CampaignGeography256} from '../src/sim/world-geography-owner-256.ts';
import {createGeographicPlanet256} from '../src/sim/planet-factory-256.ts';
import {planetFactionTargets256} from '../src/sim/planet-faction-targets-256.ts';
import {canPlaceWorldSettlement} from '../src/sim/world-settlement-placement.ts';
import {planetTiles,planetTile,planetTileCount,planetGeographicHeader256,bindPlanetGeography256,preparePlanetHydration256} from '../src/sim/planet-geography-256.ts';
import {validPlanetGeographyHistorical256} from '../src/sim/planet-geography-historical-256.ts';
import {validatePlanet} from '../src/sim/planet-save.ts';
import {validatePlanetContext,validatedPlanetFor,sameValidatedPlanetGeography} from '../src/sim/planet-validation-context.ts';
import {generatePlanet} from '../src/sim/planet-generation.ts';
import type {GeographicPlanetState,PlanetValidationWorld} from '../src/sim/planet-state.ts';
import {PlanetGeographyTransportEncoder256,PlanetGeographyTransportDecoder256} from '../src/bridge/planet-geography-transport-256.ts';
let draft:GeographicWorldDraft256,owner:CampaignGeography256,planet:GeographicPlanetState,metadata:PlanetValidationWorld;
/** One actual original30% draft (historical terrain, geometry revision 1: these
 * oracles validate it at schema 256), shared by these domain oracles. No local map,
 * campaign ticks, browser, benchmark, healing or multiple-colony run. ROOT
 * may reuse its acquired draft fixture at this single preparation boundary. */
beforeAll(()=>{
 const iterator=generateGeographicWorldDraft256({seed:'Elsewhere',settings:defaultWorldGenerationSettings(),tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'Colonie',terrain:'historical'});let next=iterator.next();while(!next.done)next=iterator.next();draft=next.value;owner=captureGeneratedGeography256(draft);
 const targets=planetFactionTargets256(draft.factions,owner.surface.tiles);if(!targets)throw Error('Invalid actual faction geography');const home=owner.surface.tiles.find(t=>canPlaceWorldSettlement(owner.surface.tiles,t.id,{settlementTiles:targets.occupied}));if(!home)throw Error('Actual draft has no admissible prepared starting tile');
 planet=createGeographicPlanet256({geography:owner,factions:draft.factions,homeTile:home.id,adoptedAt:0,nextGroupId:1});metadata={schemaVersion:256,tick:0,planet,worldFactions:draft.factions};
},120000);

test('legacy revisions1/2 stay literal162 arrays under current version and never receive geography or factions',()=>{
 for(const revision of [1,2] as const){const p=generatePlanet(216,{biome:'temperate-forest',latitude:10,longitude:20,meanTemperature:12,rainfall:900},0,revision);const w={schemaVersion:256,tick:0,planet:p},bytes=JSON.stringify(p);expect(validatePlanet(p,w,255)).toEqual([]);expect(validatePlanet(p,w,256)).toEqual([]);expect(planetTiles(p)).toBe(p.tiles);expect(planetTileCount(p)).toBe(162);const a=validatePlanetContext(w,256);expect(a.ok).toBe(true);if(!a.ok)throw Error(a.errors.join(' '));const equal={...w,planet:structuredClone(p)},b=validatePlanetContext(equal,256,a.context);expect(b.ok).toBe(true);if(!b.ok)throw Error(b.errors.join(' '));expect(sameValidatedPlanetGeography(a.context,b.context)).toBe(true);expect(JSON.stringify(p)).toBe(bytes);expect(Object.hasOwn(p,'geography')).toBe(false);expect(Object.hasOwn(w,'worldFactions')).toBe(false);}
});

test('actual119904 geometry is accessed by its single exact owner; warm contexts compare scalars and preserve mutable group allocator',()=>{
 expect(planetTileCount(planet)).toBe(119904);expect(planetTiles(planet)).toBe(owner.surface.tiles);expect(planetTile(planet,planet.homeTile)).toBe(owner.surface.tiles[planet.homeTile]);expect(Object.hasOwn(planet,'tiles')).toBe(false);expect(validatePlanet(planet,metadata,256)).toEqual([]);
 const first=validatePlanetContext(metadata,256);if(!first.ok)throw Error(first.errors.join(' '));const changed={...planet,nextGroupId:2},m={...metadata,planet:changed},second=validatePlanetContext(m,256,first.context);if(!second.ok)throw Error(second.errors.join(' '));expect(sameValidatedPlanetGeography(first.context,second.context)).toBe(true);expect(validatedPlanetFor(second.context,m,256)).toBe(changed);expect(validatedPlanetFor(first.context,m,256)).toBeUndefined();
 const targets=planetFactionTargets256(draft.factions,owner.surface.tiles),other=targets?.civilianTiles.find(id=>id!==planet.civilianTile);if(other===undefined)throw Error('Actual default registry lacks second civilian target');const relinked={...planet,civilianTile:other},r={...metadata,planet:relinked},third=validatePlanetContext(r,256,first.context);if(!third.ok)throw Error(third.errors.join(' '));expect(sameValidatedPlanetGeography(first.context,third.context)).toBe(true);expect(validatedPlanetFor(first.context,r,256)).toBeUndefined();expect(validatedPlanetFor(third.context,r,256)).toBe(relinked);
 const header=planetGeographicHeader256(planet);expect(Object.keys(header)).toEqual(['revision','adoptedAt','generationSeed','homeTile','civilianTile','nextGroupId']);expect(bindPlanetGeography256(header,owner).geography).toBe(owner.definition);
});

test('cold JSON restores only recorded geometry and exact columns, and never mutates raw input or accepts an unowned warm definition',()=>{
 const text=JSON.stringify(planet),raw=JSON.parse(text);expect(Object.hasOwn(raw,'tiles')).toBe(false);expect(Object.hasOwn(raw.geography.surface,'corners')).toBe(false);expect(Object.hasOwn(raw.geography.surface,'neighbours')).toBe(false);expect(validatePlanet(raw,{...metadata,planet:raw},256).length).toBeGreaterThan(0);
 const hydrated=preparePlanetHydration256(raw,256);expect(hydrated.owner).not.toBe(owner);expect(JSON.stringify(raw)).toBe(text);expect(JSON.stringify(hydrated.planet)).toBe(text);expect(validatePlanet(hydrated.planet,{...metadata,planet:hydrated.planet},256)).toEqual([]);
 for(const id of [0,planet.homeTile,planet.civilianTile??planet.homeTile])expect(planetTile(hydrated.planet,id)).toEqual(planetTile(planet,id));expect(hydrated.owner.roads[planet.homeTile]).toEqual(owner.roads[planet.homeTile]);expect(hydrated.owner.mutators[planet.homeTile]).toBe(owner.mutators[planet.homeTile]);expect(preparePlanetHydration256(hydrated.planet,256).owner).toBe(hydrated.owner);
},120000);

test('starting admission and civilian target use real faction settlements, with no fabricated post or water/impassable repair',()=>{
 const bad=owner.surface.tiles.find(t=>t.biome==='ocean'||t.biome==='lake'||t.hilliness==='impassable');if(!bad)throw Error('Actual world lacks forbidden terrain witness');expect(()=>createGeographicPlanet256({geography:owner,factions:draft.factions,homeTile:bad.id,adoptedAt:0,nextGroupId:1})).toThrow();const npc=draft.factions.settlements[0];if(!npc)throw Error('Actual default factions lack settlement');expect(()=>createGeographicPlanet256({geography:owner,factions:draft.factions,homeTile:npc.tile,adoptedAt:0,nextGroupId:1})).toThrow();const neighbor=owner.surface.tiles[npc.tile]!.neighbours[0]!;expect(()=>createGeographicPlanet256({geography:owner,factions:draft.factions,homeTile:neighbor,adoptedAt:0,nextGroupId:1})).toThrow();
 expect(draft.factions.settlements.some(s=>s.tile===planet.civilianTile)).toBe(true);expect(validatePlanet({...planet,civilianTile:null},metadata,256).length).toBeGreaterThan(0);
 const none={...draft.factions,settlements:[]},noTarget={...planet,civilianTile:null};expect(validatePlanet(noTarget,{...metadata,worldFactions:none},256)).toEqual([]);expect(validatePlanet(planet,{...metadata,worldFactions:none},256).length).toBeGreaterThan(0);expect(Object.keys(owner.definition)).toEqual(['revision','surface','mutators','factions']);
});

test('old255 and every historical map reject future geography/factions before migration; getters and transport disguises grant no authority',()=>{
 const legacy=generatePlanet(216,{biome:'temperate-forest',latitude:10,longitude:20,meanTemperature:12,rainfall:900},0,2),old={schemaVersion:255,tick:0,planet:legacy,secondarySite:{map:{}}},bytes=JSON.stringify(old);expect(validPlanetGeographyHistorical256(old,255)).toBe(true);
 for(const target of ['root','secondary','registered'] as const){const raw=JSON.parse(bytes);const map=target==='root'?raw:target==='secondary'?raw.secondarySite.map:(raw.worldMaps={sites:[{map:{}}]}).sites[0].map;map.worldFactions=undefined;expect(validPlanetGeographyHistorical256(raw,255)).toBe(false);delete map.worldFactions;map.planet={revision:2,geography:undefined};expect(validPlanetGeographyHistorical256(raw,255)).toBe(false);}
 expect(validatePlanet(planet,{...metadata,schemaVersion:255},255).length).toBeGreaterThan(0);const packet={schemaVersion:256,world:{schemaVersion:255,planet}};expect(validPlanetGeographyHistorical256(packet.world,packet.world.schemaVersion)).toBe(false);expect(JSON.stringify(old)).toBe(bytes);
 let reads=0;const fake={...planet,geography:{get surface(){reads++;return owner.definition.surface;}}};expect(validatePlanet(fake,metadata,256).length).toBeGreaterThan(0);expect(()=>preparePlanetHydration256(fake,256)).toThrow();expect(reads).toBe(0);const header={...planetGeographicHeader256(planet)};Object.defineProperty(header,'homeTile',{get(){reads++;return planet.homeTile;},enumerable:true});expect(()=>bindPlanetGeography256(header,owner)).toThrow();expect(reads).toBe(0);
});


test('connection publishes actual geography once, admits a cold owner atomically, then uses bounded references across local/globe states',()=>{
 const encoder=new PlanetGeographyTransportEncoder256(),decoder=new PlanetGeographyTransportDecoder256();
 const state={schemaVersion:256,planet,tick:0,rng:123,nextId:draft.nextThingId,worldFactions:draft.factions};
 const before=JSON.stringify(state),first=encoder.encode(state,true);
 expect(Object.hasOwn(first.state,'planet')).toBe(false);expect(first.geography?.packet.kind).toBe('definition');expect(JSON.stringify(state)).toBe(before);
 const incoming=structuredClone(first),prepared=decoder.prepare(incoming.state,incoming.geography,true,true);if(!prepared.ok)throw Error(prepared.reason);
 expect(prepared.state.planet?.revision).toBe(3);expect(Object.isFrozen(prepared)).toBe(true);expect(prepared.state.planet).not.toBe(planet);expect(prepared.state).toEqual(state);
 expect(validatePlanet(prepared.state.planet,prepared.state,256)).toEqual([]);expect(decoder.commit(prepared)).toBe(true);expect(decoder.commit(prepared)).toBe(false);
 const restored=prepared.state.planet!;if(restored.revision!==3)throw Error('Missing actual restored owner');
 for(let tick=1;tick<=40;tick++){
  const packet=encoder.encode({...state,tick,planet:{...planet,nextGroupId:2}});expect(packet.geography?.packet.kind).toBe('reference');expect(JSON.stringify(packet.geography).length).toBeLessThan(260);expect(Object.hasOwn(packet.state,'planet')).toBe(false);
  const read=decoder.prepare(structuredClone(packet.state),structuredClone(packet.geography),true,false);if(!read.ok)throw Error(read.reason);
  expect(read.state.tick).toBe(tick);expect(read.state.rng).toBe(123);expect(read.state.planet?.nextGroupId).toBe(2);expect(read.state.planet?.revision===3?read.state.planet.geography:null).toBe(restored.geography);expect(decoder.commit(read)).toBe(true);
 }
 expect(encoder.encode(state,true).geography?.packet.kind).toBe('definition');
},120000);

test('lost/ambiguous/future definitions and refused envelopes cannot poison the accepted connection owner',()=>{
 const encoder=new PlanetGeographyTransportEncoder256(),decoder=new PlanetGeographyTransportDecoder256(),state={schemaVersion:256,planet};
 const initial=encoder.encode(state,true),warm=encoder.encode(state);
 expect(decoder.prepare(warm.state,warm.geography,true,false).ok).toBe(false);
 const cold=decoder.prepare(initial.state,initial.geography,true,true);expect(cold.ok).toBe(true);
 // An abandoned outer snapshot never grants its geographic reference.
 expect(decoder.prepare(warm.state,warm.geography,true,false).ok).toBe(false);expect(decoder.commit(cold)).toBe(false);
 const retry=decoder.prepare(initial.state,initial.geography,true,true);if(!retry.ok)throw Error(retry.reason);expect(decoder.commit(retry)).toBe(true);
 const previous=retry.state.planet;
 expect(decoder.prepare({...warm.state,schemaVersion:255},warm.geography,true,false).ok).toBe(false);
 expect(decoder.prepare(state,warm.geography,true,false).ok).toBe(false);
 expect(decoder.prepare(state,undefined,false,false).ok).toBe(false);
 expect(decoder.prepare(warm.state,undefined,true,false).ok).toBe(false);
 const unknown=structuredClone(warm.geography!);unknown.packet.id++;expect(decoder.prepare(warm.state,unknown,true,false).ok).toBe(false);
 const read=decoder.prepare(warm.state,warm.geography,true,false);if(!read.ok)throw Error(read.reason);expect(read.state.planet?.revision===3&&previous?.revision===3?read.state.planet.geography===previous.geography:false).toBe(true);expect(decoder.commit(read)).toBe(true);
 const literal=generatePlanet(216,{biome:'temperate-forest',latitude:10,longitude:20,meanTemperature:12,rainfall:900},0,2),old={schemaVersion:255,planet:literal};
 const oldWire=encoder.encode(old);expect(oldWire.state).toBe(old);expect(Object.hasOwn(oldWire,'geography')).toBe(false);const oldRead=decoder.prepare(old,undefined,false,true);if(!oldRead.ok)throw Error(oldRead.reason);expect(oldRead.state).toBe(old);expect(decoder.commit(oldRead)).toBe(true);
});
