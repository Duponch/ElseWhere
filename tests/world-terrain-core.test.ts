// The game's terrain step for new games (geometry revision 2, schema 376) and
// its gating: existing planets keep the historical generator and mesh bit for
// bit. Measured tile by tile on real saves by scripts/planet-parity.ts (see
// docs/development/planet-parity.md and tests/planet-parity.test.ts).
import {beforeAll,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {createCoreTerrainStep,coreBiomeScore,CORE_TERRAIN_SEED_PART} from '../src/sim/world-terrain-core';
import {generateWorldPhysicalSurface,type WorldPhysicalSurface} from '../src/sim/world-surface-geography';
import {storeWorldSurface,restoreWorldSurface,validStoredWorldSurface,CORE_PLANET_GEOMETRY_SCHEMA} from '../src/sim/world-surface-storage';
import {cropSurfaceCells,generateCoveredSurfaceMesh,surfaceVisibilityAxis} from '../src/sim/world-surface-mesh';
import {geographyGeometryAllowed256,preparePlanetHydration256} from '../src/sim/planet-geography-256';
import {createGeographicPlanet256} from '../src/sim/planet-factory-256';
import {planetFactionTargets256} from '../src/sim/planet-faction-targets-256';
import {canPlaceWorldSettlement} from '../src/sim/world-settlement-placement';
import {validatePlanet} from '../src/sim/planet-save';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft';
import {captureGeneratedGeography256,restoreCampaignGeography256} from '../src/sim/world-geography-owner-256';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {hashCombineInt,stableStringHash} from '../src/sim/verse-rand';
const f=Math.fround,normal={coverage:.3,rainfall:3,temperature:3,population:3} as const;
function drain<Y,T>(it:Generator<Y,T,void>):T{let r=it.next();while(!r.done)r=it.next();return r.value;}
function digest(surface:WorldPhysicalSurface):string {
 const h=createHash('sha256');h.update(JSON.stringify(storeWorldSurface(surface,surface.tiles.map(()=>[]))));
 for(const t of surface.tiles){h.update(new Float32Array(t.center));for(const c of t.corners)h.update(new Float32Array(c));h.update(t.neighbours.join(','));}
 return h.digest('hex');
}
function digestCore(surface:WorldPhysicalSurface):string {
 const h=createHash('sha256');h.update(JSON.stringify(storeWorldSurface(surface,surface.tiles.map(()=>[]))));
 for(const t of surface.tiles){h.update(new Float32Array(t.center));h.update(t.neighbours.join(','));}
 return h.digest('hex');
}

describe('terrain step',()=>{
 it('is seeded as the first surface step and draws its 14 setup values first',()=>{
  const step=createCoreTerrainStep('poivre',normal);
  expect(step.rootSeed).toBe(stableStringHash('poivre'));
  expect(step.random.state).toEqual({seed:hashCombineInt(stableStringHash('poivre'),CORE_TERRAIN_SEED_PART)>>>0,iterations:14});
  const full=createCoreTerrainStep('poivre',{...normal,coverage:1});expect(full.random.state.iterations).toBe(14);
  expect(()=>step.generateTile(1,[0,0,-100])).toThrow();
 });
 it('scores biomes as the game biome workers, first highest score winning',()=>{
  const land={elevation:10,temperature:f(12.5),rainfall:f(1200),swampiness:f(.7)},never=()=>{throw Error('sea ice test on land');};
  expect(coreBiomeScore('temperate-forest',land,never)).toBe(f(15+(f(12.5)-7)+(1200-600)/180));
  expect(coreBiomeScore('temperate-swamp',land,never)).toBe(f(15+(f(12.5)-7)+(1200-600)/180+f(.7)*3));
  expect(coreBiomeScore('boreal-forest',land,never)).toBe(15);expect(coreBiomeScore('ocean',land,never)).toBe(-100);
  expect(coreBiomeScore('desert',{...land,rainfall:599},never)).toBe(f(f(12.5)+f(1e-4)));
  expect(coreBiomeScore('extreme-desert',{...land,rainfall:f(300)},never)).toBe(f(f(12.5)*f(2.7)-13-f(300)*f(.14)));
  const water={elevation:-5,temperature:-30,rainfall:100,swampiness:0};
  expect(coreBiomeScore('ocean',water,never)).toBe(0);expect(coreBiomeScore('tundra',water,never)).toBe(-100);
  expect(coreBiomeScore('sea-ice',water,()=>true)).toBe(f(f(-20+30*2)-23));expect(coreBiomeScore('sea-ice',water,()=>false)).toBe(-100);
 });
});

describe('geometry revision 2',()=>{
 it('keeps the historical mesh topology and only refines centres',()=>{
  const a=cropSurfaceCells(generateCoveredSurfaceMesh(.3),.3,surfaceVisibilityAxis(.3)),b=cropSurfaceCells(generateCoveredSurfaceMesh(.3,10,true),.3,surfaceVisibilityAxis(.3),true);
  expect(b.length).toBe(119904);expect(a.length).toBe(b.length);
  let moved=0;for(let i=0;i<a.length;i++){expect(b[i]!.neighbours).toEqual(a[i]!.neighbours);if(a[i]!.center.some((v,k)=>v!==b[i]!.center[k]))moved++;}
  expect(moved).toBeGreaterThan(0);
 },60_000);
 it('leaves the historical generator bit-identical',()=>{
  expect(digest(drain(generateWorldPhysicalSurface('Elsewhere',normal)))).toBe('e5077ed3a5675357af1ca4fb971fe867489ade6a5631031c1cfd6a7ef23ec17d');
 },60_000);
});

describe('new games',()=>{
 let core:WorldPhysicalSurface;
 beforeAll(()=>{core=drain(generateWorldPhysicalSurface('Elsewhere',normal,{core:true}));},60_000);
 it('generate the game terrain, then lakes and rivers',()=>{
  expect(core.geometryRevision).toBe(2);expect(core.tiles.length).toBe(119904);
  expect(digestCore(core)).toBe('4936dd53254bdf22ed3518bc09ea6629dfa8e418d97f1b848c531661f3376146');
  const tile=core.tiles[0]!;
  expect([tile.biome,tile.hilliness,tile.elevation,tile.meanTemperature,tile.rainfall,tile.swampiness]).toEqual(['temperate-forest','flat',101.65279388427734,14.559762954711914,1566.343505859375,0.45053422451019287]);
  expect(core.tiles.filter(t=>t.biome==='lake').length).toBe(40);
  expect(core.tiles.some(t=>t.rivers.length>0)).toBe(true);
 });
 it('store geometry revision 2 and restore the same centres and columns',()=>{
  const stored=storeWorldSurface(core,core.tiles.map(()=>[]));
  expect(stored.geometryRevision).toBe(2);expect(validStoredWorldSurface(stored)).toBe(true);
  const restored=restoreWorldSurface(JSON.parse(JSON.stringify(stored))).surface;
  expect(restored.geometryRevision).toBe(2);
  for(const id of [0,1,59951,119903]){const a=core.tiles[id]!,b=restored.tiles[id]!;expect(b.center).toEqual(a.center);expect(b.neighbours).toEqual(a.neighbours);expect([b.elevation,b.meanTemperature,b.rainfall,b.swampiness,b.biome,b.hilliness]).toEqual([a.elevation,a.meanTemperature,a.rainfall,a.swampiness,a.biome,a.hilliness]);}
  expect(validStoredWorldSurface({...stored,geometryRevision:3})).toBe(false);
  expect(restoreWorldSurface(storeWorldSurface({...core,geometryRevision:undefined},core.tiles.map(()=>[]))).surface.geometryRevision).toBeUndefined();
 },60_000);
 it('are the only saves allowed to hold geometry revision 2',()=>{
  expect(CORE_PLANET_GEOMETRY_SCHEMA).toBe(376);
  const geography=(revision:number)=>({revision:1,surface:{geometryRevision:revision},mutators:[],factions:[]});
  expect(geographyGeometryAllowed256(geography(2),375)).toBe(false);
  expect(geographyGeometryAllowed256(geography(2),376)).toBe(true);
  expect(geographyGeometryAllowed256(geography(1),256)).toBe(true);
 });
 it('use it through the geographic draft, historical terrain on request',()=>{
  const draft=drain(generateGeographicWorldDraft256({seed:'Elsewhere',settings:defaultWorldGenerationSettings(),tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'Colonie'}));
  expect(draft.surface.geometryRevision).toBe(2);
  const geography=captureGeneratedGeography256(draft);expect(geography.definition.surface.geometryRevision).toBe(2);
  const again=restoreCampaignGeography256(JSON.parse(JSON.stringify(geography.definition)));
  expect(again.surface.tiles[draft.surface.tiles.length-1]!.center).toEqual(draft.surface.tiles[draft.surface.tiles.length-1]!.center);
  // A save older than 376 cannot hold it: refused before any mesh is built.
  const targets=planetFactionTargets256(draft.factions,geography.surface.tiles)!,home=geography.surface.tiles.find(t=>canPlaceWorldSettlement(geography.surface.tiles,t.id,{settlementTiles:targets.occupied}))!;
  const planet=createGeographicPlanet256({geography,factions:draft.factions,homeTile:home.id,adoptedAt:0,nextGroupId:1}),raw=JSON.parse(JSON.stringify(planet));
  expect(()=>preparePlanetHydration256(raw,375)).toThrow(/geometry revision/);
  expect(preparePlanetHydration256(raw,376).owner.definition.surface.geometryRevision).toBe(2);
  const metadata={schemaVersion:376,tick:0,planet,worldFactions:draft.factions};
  expect(validatePlanet(planet,metadata,376)).toEqual([]);expect(validatePlanet(planet,{...metadata,schemaVersion:375},375)).toContain('Future planet geometry revision in a historical schema.');
  expect(()=>drain(generateGeographicWorldDraft256({seed:'x',settings:defaultWorldGenerationSettings(),tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'C',terrain:'other' as never}))).toThrow();
 },120_000);
});
