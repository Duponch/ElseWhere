// The planet comparison tool (scripts/planet-parity.ts). The quantization
// and the reports are checked on hand-made fixtures; the comparison with a
// real save is opt-in: PLANET_PARITY_SAVE=path/to/save.rws (several paths
// separated by ';'): terrain step, lakes, rivers and ancient roads must be
// identical. Saves are only read.
import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {surfaceColumns,comparePlanetColumns,formatPlanetParity,roundHalfEven,saveColumns,savePlanetSettings,biomeConfusionTable,compareAncientRoads,saveFactionSelection,type PlanetColumns} from '../src/import/rimworld/planet-parity';
import {readRwsSave,type RwsSave} from '../src/import/rimworld/rws-save';
import {shortHashTable} from '../src/import/rimworld/short-hash';
import {ROAD_MAP} from '../src/import/rimworld/map-world';
import {generateWorldPhysicalSurface} from '../src/sim/world-surface-geography';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft';
import type {WorldRoadLink} from '../src/sim/world-roads';
import type {WorldSurfaceTile} from '../src/sim/world-surface-geography';
const f=Math.fround;
function tile(id:number,o:Partial<WorldSurfaceTile>):WorldSurfaceTile {
 return {id,center:[0,0,-100],corners:[],neighbours:[],biome:'temperate-forest',hilliness:'flat',elevation:10,meanTemperature:10,rainfall:800,swampiness:0,rivers:[],riverDistance:0,...o};
}

describe('saved quantization',()=>{
 it('rounds as the game writes its surface layer',()=>{
  const cols=surfaceColumns([
   tile(0,{elevation:f(-159.4996),meanTemperature:f(-31.54998207092285),rainfall:f(1014.5),swampiness:f(.5)}),
   tile(1,{elevation:f(.25),meanTemperature:f(9.450011253356934),rainfall:f(778.5),swampiness:f(1.2),biome:'ocean',hilliness:'impassable'}),
  ]);
  // −159.4996 + 8192 is 8032.5004…, a float of 8032.50048828125: 8033 − 8192.
  expect([...cols.elevation]).toEqual([-159,1]);
  // (t + 300) × 10 evaluated in double then rounded to float: 2684.50018 → 2685.
  expect([...cols.temperature]).toEqual([2685,3094]);
  expect([...cols.rainfall]).toEqual([1014,778]);expect([...cols.swampiness]).toEqual([128,255]);
  expect(cols.biome).toEqual(['TemperateForest','Ocean']);expect([...cols.hilliness]).toEqual([1,5]);
  expect([0.5,1.5,-0.5,2.5000001].map(roundHalfEven)).toEqual([0,2,0,3]);
 });
 it('reports exact shares, errors and the biome confusion',()=>{
  const base=surfaceColumns([tile(0,{}),tile(1,{elevation:100}),tile(2,{biome:'desert'})]);
  const other:PlanetColumns={...base,elevation:Int32Array.from([10,103,10]),biome:['TemperateForest','TemperateForest','Desert']};
  const report=comparePlanetColumns(base,other);
  expect(report.allFieldsExact).toBe(2);
  const elevation=report.numeric.find(n=>n.field==='elevation')!;
  expect([elevation.exact,elevation.max,elevation.within[1]!.share]).toEqual([2,3,1]);
  expect(report.categorical.find(c=>c.field==='biome')!.exact).toBe(3);
  const text=formatPlanetParity(report);
  expect(text).toContain('toutes les colonnes exactes : 2');expect(biomeConfusionTable(report)).toContain('TemperateForest');
 });
 it('compares the ancient roads alone, link by link and by type',()=>{
  // Save links are (origin, index in the origin's neighbours, road short hash).
  const hash=new Map([...shortHashTable(Object.keys(ROAD_MAP))].map(([h,name])=>[name,h]));
  const neighbours=[[1,2],[0,2],[0,1,3],[2]];
  const save={world:{grid:{roads:[{origin:0,neighbourIndex:0,def:hash.get('AncientAsphaltRoad')!},{origin:1,neighbourIndex:1,def:hash.get('AncientAsphaltHighway')!},{origin:2,neighbourIndex:2,def:hash.get('DirtPath')!}]}}} as unknown as RwsSave;
  const roads:WorldRoadLink[][]=[[{neighbour:1,road:'ancient-asphalt-road'}],[{neighbour:0,road:'ancient-asphalt-road'},{neighbour:2,road:'ancient-asphalt-road'}],[{neighbour:1,road:'ancient-asphalt-road'},{neighbour:3,road:'dirt-road'}],[{neighbour:2,road:'dirt-road'}]];
  expect(compareAncientRoads(save,t=>neighbours[t]!,roads)).toEqual({saveLinks:2,generatedLinks:2,sameLink:2,sameLinkAndRoad:1});
 });
});

const saves=(process.env.PLANET_PARITY_SAVE??'').split(';').map(s=>s.trim()).filter(s=>s&&existsSync(s));
describe.skipIf(!saves.length)('real RimWorld saves (opt-in)',()=>{
 for(const path of saves)it(`the game terrain step matches ${path} tile by tile`,()=>{
  const save=readRwsSave(readFileSync(path,'utf8')),grid=save.world!.grid!,p=savePlanetSettings(save);
  const it=generateWorldPhysicalSurface(p.seed,p.settings,{core:true});let n=it.next();while(!n.done)n=it.next();
  const surface=n.value;expect(surface.tiles.length).toBe(grid.tiles);
  const report=comparePlanetColumns(saveColumns(grid,t=>surface.tiles[t]!.neighbours),surfaceColumns(surface.tiles));
  expect(report.allFieldsExact).toBe(grid.tiles);
  expect(report.rivers).toMatchObject({sameLinkAndRiver:report.rivers!.saveLinks,generatedLinks:report.rivers!.saveLinks,riverDistanceExact:grid.tiles});
 },600_000);
 for(const path of saves)it(`the game's ancient sites and roads match ${path}`,()=>{
  // Ordinary roads come later with a lower priority: they never replace an
  // ancient link, so the save's ancient links are exactly step 400's.
  const save=readRwsSave(readFileSync(path,'utf8')),p=savePlanetSettings(save),factions=saveFactionSelection(p.factions);
  expect(factions).not.toBeNull();
  const it=generateGeographicWorldDraft256({seed:p.seed,settings:{...p.settings,factions:factions!},tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'Comparaison'});
  let n=it.next();while(!n.done)n=it.next();const draft=n.value;
  const report=compareAncientRoads(save,t=>draft.surface.tiles[t]!.neighbours,draft.roads);
  expect(report.saveLinks).toBeGreaterThan(0);
  expect(report).toEqual({saveLinks:report.saveLinks,generatedLinks:report.saveLinks,sameLink:report.saveLinks,sameLinkAndRoad:report.saveLinks});
 },600_000);
});
