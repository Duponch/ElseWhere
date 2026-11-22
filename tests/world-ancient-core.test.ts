// World generation steps 300 and 400 as the game runs them
// (src/sim/world-ancient-core.ts) and the movement difficulty they use
// (src/sim/world-core-movement.ts), on hand-made planets. Real saves are
// compared by the opt-in test of tests/planet-parity.test.ts.
import {describe,expect,it} from 'vitest';
import {coreAncientChains,generateCoreAncientRoads,generateCoreAncientSites,verseRoundRandom,ANCIENT_SITES_SEED_PART} from '../src/sim/world-ancient-core';
import {coreYearPercent,coreLatitudeSection,coreWinter,coreMovementDifficulty,coreSeasonalTemperature} from '../src/sim/world-core-movement';
import {VerseRand,hashCombineInt} from '../src/sim/verse-rand';
import type {WorldRoadLink} from '../src/sim/world-roads';
import type {WorldSurfaceTile} from '../src/sim/world-surface-geography';
import type {Vector3} from '../src/sim/verse-vector';
const f=Math.fround;
const at=(latitude:number,longitude:number):Vector3=>{const la=latitude*Math.PI/180,lo=longitude*Math.PI/180;return [f(100*Math.cos(la)*Math.sin(lo)),f(100*Math.sin(la)),f(-100*Math.cos(la)*Math.cos(lo))];};
function drain<Y,T>(it:Generator<Y,T,void>):T{let r=it.next();while(!r.done)r=it.next();return r.value;}
const euclid=(tiles:readonly {center:Vector3}[])=>(a:number,b:number)=>Math.hypot(...tiles[a]!.center.map((v,i)=>v-tiles[b]!.center[i]!));
function surfaceTile(id:number,center:Vector3,neighbours:number[],o:Partial<WorldSurfaceTile>={}):WorldSurfaceTile {
 return {id,center,corners:[],neighbours,biome:'temperate-forest',hilliness:'flat',elevation:100,meanTemperature:15,rainfall:1000,swampiness:0,rivers:[],riverDistance:0,...o};
}

describe('ancient road chains (GenerateProspectiveRoads)',()=>{
 // Four sites along the equator, 5° apart, and one 3° north of the first.
 const tiles=[at(0,0),at(0,5),at(0,10),at(0,15),at(3,0)].map(center=>({center}));
 const chains=coreAncientChains(tiles,[0,1,2,3,4],euclid(tiles));
 const chain=(i:number,j:number)=>chains[i*5+j];
 it('one chain per ordered pair of sites, in order',()=>expect(chains).toHaveLength(25));
 it('keeps the sites within 15° of the heading and moves to the nearest',()=>{
  expect(chain(0,1)).toEqual([0,1,2,3]);expect(chain(0,3)).toEqual([0,1,2,3]);
  expect(chain(3,0)).toEqual([3,2,1,0]);expect(chain(1,3)).toEqual([1,2,3]);
 });
 it('a site to itself heads north',()=>{
  expect(chain(0,0)).toEqual([0,4]);expect(chain(0,4)).toEqual([0,4]);
  expect(chain(1,1)).toEqual([1]);expect(chain(4,0)).toEqual([4,0]);
 });
});

describe('ancient roads (WorldGenStep_AncientRoads)',()=>{
 // Sixteen tiles along the equator, 1° apart, each the neighbour of the next.
 const strip=()=>Array.from({length:16},(_,id)=>surfaceTile(id,at(0,id),[id-1,id+1].filter(n=>n>=0&&n<16)));
 it('draws the longest chain of at least four sites along the world paths',()=>{
  const tiles=strip(),roads:WorldRoadLink[][]=tiles.map(()=>[]);
  roads[3]!.push({neighbour:4,road:'dirt-path'});roads[4]!.push({neighbour:3,road:'dirt-path'});
  const progress=[...generateCoreAncientRoads(tiles,Float32Array.from(tiles,()=>1),[0,5,10,15],roads)];
  // 16 chains, longest first: 0→15 (three times) and 15→0 (three times) have
  // four sites; the first is drawn, every other chain shares a site.
  expect(progress.map(p=>p.completed)).toEqual([1]);
  for(let id=0;id<15;id++){
   const link=roads[id]!.find(l=>l.neighbour===id+1),back=roads[id+1]!.find(l=>l.neighbour===id);
   expect(link?.road).toBe(id===3?'ancient-asphalt-highway':'ancient-asphalt-road');expect(back?.road).toBe(link?.road);
  }
 });
 it('three sites make no road',()=>{
  const tiles=strip(),roads:WorldRoadLink[][]=tiles.map(()=>[]);
  drain(generateCoreAncientRoads(tiles,Float32Array.from(tiles,()=>1),[0,5,10],roads));
  expect(roads.every(l=>l.length===0)).toBe(true);
 });
 it('a segment longer than 1.5 × its distance in tiles is dropped',()=>{
  // Sites 0, 5, 10, 15 but the strip detours: 5 → 10 must go through six
  // extra tiles, eight nodes for a distance of about 4.5 tiles (6.7 allowed).
  const tiles=strip();
  const detour=Array.from({length:6},(_,k)=>surfaceTile(16+k,at(2+k*.1,5+k),[]));
  for(let k=0;k<6;k++)detour[k]!.neighbours=[k===0?5:15+k,k===5?10:17+k];
  tiles[5]!.neighbours=[4,16];tiles[10]!.neighbours=[21,11];
  const all=[...tiles,...detour],roads:WorldRoadLink[][]=all.map(()=>[]);
  drain(generateCoreAncientRoads(all,Float32Array.from(all,()=>1),[0,5,10,15],roads));
  expect(roads[0]!.map(l=>l.neighbour)).toEqual([1]);expect(roads[16]).toEqual([]);expect(roads[12]!.map(l=>l.neighbour).sort()).toEqual([11,13]);
 });
});

describe('ancient sites (WorldGenStep_AncientSites)',()=>{
 it('RoundRandom(tiles / 100 000 × Range(10, 20)) sites, drawn before the first site',()=>{
  const plain={biome:'temperate-forest' as const,hilliness:'flat' as const,neighbours:[] as number[]};
  const tiles=Array.from({length:100000},()=>plain),seed=12345;
  const sites=drain(generateCoreAncientSites(tiles,seed));
  // Same stream, read by hand: the range draw, then the rounding draw.
  const r=new VerseRand(hashCombineInt(seed,ANCIENT_SITES_SEED_PART)),x=r.rangeFloat(10,20),count=Math.trunc(x)+(r.value<x%1?1:0);
  expect(sites).toHaveLength(count);expect(count).toBeGreaterThanOrEqual(10);
  // First site: 100 tile draws, all of weight 1; each draw after the first
  // replaces the choice when Range(0, n) ≥ n − 1.
  let chosen=r.range(0,100000),total=1;
  for(let k=1;k<100;k++){const id=r.range(0,100000),sum=f(total+1);if(r.rangeFloat(0,sum)>=total)chosen=id;total=sum;}
  expect(sites[0]).toBe(chosen);
 });
 it('GenMath.RoundRandom',()=>{
  const r=new VerseRand(7),value=new VerseRand(7).value;
  expect(verseRoundRandom(2.25,r)).toBe(value<.25?3:2);
  expect(verseRoundRandom(3,new VerseRand(7))).toBe(3);
 });
});

describe('movement difficulty at tick 0 (WorldPathGrid)',()=>{
 it('year percent with the time zone of the longitude',()=>{
  expect(coreYearPercent(0,0)).toBe(0);
  // −100 / 15 → −7 zones → −17 500 ticks → 3 582 500 of 3 600 000.
  expect(coreYearPercent(0,-100)).toBe(f(3582500/3600000));
  expect(coreYearPercent(0,7.6)).toBe(f(2500/3600000));expect(coreYearPercent(0,7.4)).toBe(0);
  // 37.5 / 15 = 2.5, rounded half to even: 2 zones.
  expect(coreYearPercent(0,37.5)).toBe(f(5000/3600000));
 });
 it('latitude sections (normal temperature: equatorial to 15°, seasonal to 75°)',()=>{
  expect(coreLatitudeSection(10,3)).toEqual({equatorial:1,seasonal:0,polar:0});
  expect(coreLatitudeSection(50,3)).toEqual({equatorial:0,seasonal:1,polar:0});
  expect(coreLatitudeSection(72.5,3)).toEqual({equatorial:0,seasonal:.5,polar:.5});
  expect(coreLatitudeSection(-17.5,3)).toEqual({equatorial:.5,seasonal:.5,polar:0});
  expect(coreLatitudeSection(50,0)).toEqual({equatorial:0,seasonal:0,polar:1});
  expect(coreLatitudeSection(50,6)).toEqual({equatorial:1,seasonal:0,polar:0});
 });
 it('winter at the start of the year: half in the north, none in the south',()=>{
  expect(coreWinter(0,50,3)).toEqual({winter:.5,permanentWinter:0});
  expect(coreWinter(0,-50,3)).toEqual({winter:0,permanentWinter:0});
  expect(coreWinter(0,72.5,3)).toEqual({winter:.25,permanentWinter:.5});
 });
 it('biome, relief and the winter offset',()=>{
  // 50° N at tick 0: cos(2π(0 − 10/12)) = ½ of an amplitude ≈ 21.8 °C below
  // the mean: −10 °C gives about −21 °C (full winter), 30 °C about 19 °C.
  const north=at(50,0),south=at(-50,0);
  expect(coreSeasonalTemperature({center:north,meanTemperature:-10},0)).toBeLessThan(-20);
  expect(coreMovementDifficulty(surfaceTile(0,north,[],{meanTemperature:f(-10)}),3,0)).toBe(2);
  expect(coreMovementDifficulty(surfaceTile(0,north,[],{meanTemperature:30}),3,0)).toBe(1);
  expect(coreMovementDifficulty(surfaceTile(0,south,[],{meanTemperature:f(-10)}),3,0)).toBe(1);
  expect(coreMovementDifficulty(surfaceTile(0,at(10,0),[],{hilliness:'mountainous',meanTemperature:25}),3,0)).toBe(4);
  // Polar at 80°: permanent winter 1 → +2 on a swamp's 4.
  expect(coreMovementDifficulty(surfaceTile(0,at(80,0),[],{biome:'temperate-swamp',meanTemperature:-30}),3,0)).toBe(6);
  expect(coreMovementDifficulty(surfaceTile(0,north,[],{biome:'ocean'}),3,0)).toBe(1000);
  expect(coreMovementDifficulty(surfaceTile(0,north,[],{hilliness:'impassable'}),3,0)).toBe(1000);
 });
});
