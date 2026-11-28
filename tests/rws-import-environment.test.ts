import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave,ImportContext} from '../src/import/rimworld/convert.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {importDeepResources,importMineableCondition,importPottedDaylily,importPlantCondition,importSnow,importWeather,importThermalTemperatures,importWildFloraSnapshot,importActorFilthFeet} from '../src/import/rimworld/convert-environment.ts';
import {importHistory} from '../src/import/rimworld/convert-history.ts';
import {rawShortHash} from '../src/import/rimworld/short-hash.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {createWildPlantResource256} from '../src/sim/wild-plant-acquisition-v256.ts';
import {initialPlantLifespanCore256} from '../src/sim/initial-plant-age-256.ts';
import {createPlantLife} from '../src/sim/plant-life.ts';
import {validPlantLife} from '../src/sim/plant-life-save.ts';
import {rockMaxHP} from '../src/sim/mining-rules.ts';
import type {Tile} from '../src/sim/types.ts';
import {createFlowerPotState} from '../src/sim/flower-pot.ts';
import {terrainRetainsSnow,snowFullCells} from '../src/sim/snow-surface.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
function context(){
 const save=readRwsSave(fixture),conversion=convertRwsSave(save,{planet:false}),w=conversion.world;
 const ctx=new ImportContext(save,save.maps[0]!,w,new ImportNotes(),false);
 for(const [source,id] of conversion.thingIds)ctx.thingIds.set(source,id);
 return ctx;
}
const thing=(body:string)=>readThing(parseXml(`<thing>${body}</thing>`));
const grid64=(xs:Uint16Array)=>{const b=Buffer.alloc(xs.length*2);xs.forEach((v,i)=>b.writeUInt16LE(v,i*2));return b.toString('base64');};
describe('RWS environmental and historical state',()=>{
 it('transposes actual ushort snow depths and deep deposits, without replacing unknown ores',()=>{
  const ctx=context(),{w}=ctx,full=snowFullCells(w);
  const dest=w.tiles.findIndex((t,i)=>terrainRetainsSnow(t.terrain,!!t.bridge)&&!full.has(i));
  const source=ctx.coordinates.index(dest),other=(source+1)%w.tiles.length;
  const snow=new Uint16Array(w.tiles.length);snow[source]=32768;
  Object.assign(ctx.map.grids,{snow});
  // Plain fixture has no weather adoption in some historical creation paths.
  importSnow(ctx);
  if(w.snow)expect(w.tiles[dest]!.snowDepth).toBe(Math.fround(32768/65535));
  else expect(ctx.notes.summary('snow').dropped).toBe(1);
  const defs=new Uint16Array(w.tiles.length),counts=new Uint16Array(w.tiles.length);
  const jade=(source+2)%w.tiles.length,unknown=(source+3)%w.tiles.length;
  defs[source]=rawShortHash('Steel');counts[source]=165;defs[other]=rawShortHash('Uranium');counts[other]=300;
  defs[jade]=rawShortHash('Jade');counts[jade]=42;defs[unknown]=65535;counts[unknown]=20;
  ctx.map.node.children.push(parseXml(`<deepResourceGrid><defGrid>${grid64(defs)}</defGrid><countGrid>${grid64(counts)}</countGrid></deepResourceGrid>`));
  importDeepResources(ctx);
  expect(w.deepResources?.cells).toEqual([{index:dest,item:'steel',count:165},{index:ctx.coordinates.index(other),item:'uranium',count:300},{index:ctx.coordinates.index(jade),item:'jade',count:42}].sort((a,b)=>a.index-b.index));
  expect(ctx.notes.summary('deep-resources')).toMatchObject({exact:3,dropped:1});
 });
 it('recovers mineable health and potted plant state without a duplicate resource',()=>{
  const ctx=context(),tile:Tile={terrain:'rock',stone:'granite'};
  importMineableCondition(ctx,tile,thing('<def>Granite</def><id>Mineable1</id><health>67</health>'));
  expect(tile.miningDamage).toBe(rockMaxHP(tile)-67);
  const pot={id:ctx.w.nextId++,kind:'flower-pot' as const,x:4,z:12,orientation:0 as const,footprint:'standard' as const,flower:createFlowerPotState()};
  const t=thing('<def>Plant_Daylily</def><pos>(4, 0, 7)</pos><growth>0.75</growth><health>45</health><age>54321</age><unlitTicks>3</unlitTicks>');
  expect(importPottedDaylily(ctx,t,new Map([[ctx.index(pot),pot]]))).toBe(true);
  expect(pot.flower.plant).toMatchObject({growth:.75,ageCore:54321,unlitCore:3,hitPoints:45});
  expect(importPottedDaylily(ctx,t,new Map([[ctx.index(pot),pot]]))).toBe(false);
 });
 it('keeps the actual wild age in its admitted offset, not the elapsed local tick',()=>{
  const ctx=context(),{w}=ctx,plant=createWildPlantResource256(w,w.nextId++,5,5,'oak',.8,false)!;
  // Cold creation context is sufficient for initial age; use ordinary
  // climate owner when present, otherwise explicitly qualify the age field.
  w.climate={...w.climate,revision:1,adoptedAt:w.tick} as never;
  const age=Math.min(100000,initialPlantLifespanCore256('oak')!-51);
  importPlantCondition(ctx,plant,thing(`<def>Plant_TreeOak</def><age>${age}</age><health>150</health>`));
  expect(plant.plantLife?.initialAgeCore).toBe(age);
 });
 it('restores compatible ordinary plant age and duration without light at the actual local frontier',()=>{
  const ctx=context(),{w}=ctx;w.tick=20000;w.climate={...w.climate,revision:1,adoptedAt:0} as never;
  const plant={id:w.nextId++,kind:'rice' as const,x:4,z:5,amount:6,growth:.7,growthTick:w.tick};
  const target={...plant,plantLife:createPlantLife(w,plant)};
  importPlantCondition(ctx,target,thing('<def>Plant_Rice</def><age>25050</age><unlitTicks>2000</unlitTicks><health>85</health>'));
  expect(target.plantLife.age).toBe(2505);expect(target.plantLife.darkTicks).toBe(200);
  expect(validPlantLife(target,w.schemaVersion,w)).toBe(true);
  expect(ctx.notes.summary('plant-state').exact).toBeGreaterThanOrEqual(2);
 });
 it('reads the actual wild spawner cycle rather than restarting the aggregation',()=>{
  const ctx=context(),{w}=ctx;w.site={revision:3} as never;
  ctx.map.node.children.push(parseXml('<wildPlantSpawner><cycleIndex>120</cycleIndex><calculatedWholeMapNumDesiredPlants>150.125</calculatedWholeMapNumDesiredPlants><calculatedWholeMapNumDesiredPlantsTmp>33.5</calculatedWholeMapNumDesiredPlantsTmp><calculatedWholeMapNumNonZeroFertilityCells>280</calculatedWholeMapNumNonZeroFertilityCells><calculatedWholeMapNumNonZeroFertilityCellsTmp>90</calculatedWholeMapNumNonZeroFertilityCellsTmp></wildPlantSpawner>'));
  expect(importWildFloraSnapshot(ctx)).toBe(true);
  expect(w.flora).toEqual({revision:2,cycleIndex:120,desired:150.125,desiredTmp:33.5,fertile:280,fertileTmp:90,hasCalculated:true,lastTick:w.tick});
 });
 it('keeps supported carried filth on the original actor without creating ground filth',()=>{
  const ctx=context(),actor=ctx.w.pawns[0]!;
  const source=parseXml('<thing><filth><lastTerrainFilthDef>Filth_Dirt</lastTerrainFilthDef><carriedFilth><li><def>Filth_Dirt</def></li><li><def>Filth_Dirt</def><thickness>2</thickness></li><li><def>Filth_Blood</def></li><li><def>Filth_AnimalFilth</def></li></carriedFilth></filth></thing>');
  const before=ctx.w.filth?.items.length??0;
  importActorFilthFeet(ctx,actor,source,'pawn-state');
  expect(actor.filthFeet).toEqual({lastTerrain:'dirt',carried:[{kind:'dirt',thickness:3},{kind:'blood',thickness:1}]});
  expect(ctx.w.filth?.items.length).toBe(before);
  expect(ctx.notes.summary('pawn-state').dropped).toBe(1);
 });
 it('preserves actual weather ages and archive entries and validates the complete reloaded world',()=>{
  const ctx=context(),{w}=ctx;
  ctx.map.node.children.push(parseXml('<weatherManager><curWeather>Clear</curWeather><lastWeather>Fog</lastWeather><curWeatherAge>63152</curWeatherAge></weatherManager>'));
  ctx.map.node.children.push(parseXml('<weatherDecider><curWeatherDuration>92110</curWeatherDuration></weatherDecider>'));
  // Fixture has no previously archived entries.
  ctx.save.game.children.push(parseXml('<history><archive><archivables><li Class="Message"><ID>1</ID><def>PositiveEvent</def><text>Message ancien</text><startingTick>2</startingTick></li><li Class="StandardLetter"><ID>2</ID><def>NeutralEvent</def><label>Une lettre</label><text>Contenu original</text><arrivalTick>3</arrivalTick></li></archivables><pinnedArchivables><li>Letter_2</li></pinnedArchivables></archive></history>'));
  importWeather(ctx);importHistory(ctx);
  expect(w.weather).toMatchObject({current:'clear',previous:'fog',ageCore:63152,durationCore:92110});
  expect(w.letters352?.archive).toMatchObject([{journal:'command',message:'Message ancien'},{cls:'neutral',title:'Une lettre',text:'Contenu original'}]);
  expect(w.letters352?.pinned).toEqual([2]);
  expect(validateWorld(w)).toEqual([]);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 });
 it('decodes room temperatures independently of thermostat settings and the current exterior climate',()=>{
  const ctx=context(),{w}=ctx,temperatures=new Uint16Array(w.tiles.length);
  temperatures.fill(32768-3*16);
  ctx.map.node.children.push(parseXml(`<temperatureCache><temperatures>${grid64(temperatures)}</temperatures></temperatureCache>`));
  importThermalTemperatures(ctx);
  expect(w.thermal?.regions.length).toBeGreaterThan(0);
  expect(w.thermal?.regions.every(r=>r.temperature===-3)).toBe(true);
  expect(validateWorld(w)).toEqual([]);
 });
});
