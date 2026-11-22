// The planet comparison tool (scripts/planet-parity.ts). The quantization
// and the report are checked on a hand-made fixture; the comparison with a
// real save is opt-in: PLANET_PARITY_SAVE=path/to/save.rws (several paths
// separated by ';'). Saves are only read.
import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {surfaceColumns,comparePlanetColumns,formatPlanetParity,roundHalfEven,saveColumns,savePlanetSettings,biomeConfusionTable,type PlanetColumns} from '../src/import/rimworld/planet-parity';
import {readRwsSave} from '../src/import/rimworld/rws-save';
import {generateWorldPhysicalSurface} from '../src/sim/world-surface-geography';
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
});
