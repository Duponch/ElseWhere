import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {ImportContext,buildStructure} from '../src/import/rimworld/convert.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {admitImportedNaturalBuilding,importCollapsedRock,importGatheringPolicy,importHydroponicPolicy} from '../src/import/rimworld/convert-natural-buildings.ts';
import {importRwsHiveOwners} from '../src/import/rimworld/convert-hive-owners.ts';
import {BUILDING_MAP} from '../src/import/rimworld/map-buildings.ts';
import {ROCK_MAP} from '../src/import/rimworld/map-terrain.ts';
import {placeRwsFootprint} from '../src/import/rimworld/local-coordinates.ts';
import {createWorld} from '../src/sim/engine.ts';
import {validCaveHiveBuilding256,validateCaveHiveOwners256} from '../src/sim/cave-hive-save-256.ts';
import {validLocalRoadPropStructure256} from '../src/sim/local-road-props-save-256.ts';
import {excavatedCollapsedRock256} from '../src/sim/collapsed-rocks-256.ts';
import {initializeHydroponicBasin} from '../src/sim/hydroponics.ts';
import type {World,StructureKind} from '../src/sim/types.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const thing=(def:string,id:number,extra='')=>readThing(parseXml(`<thing Class="Building"><def>${def}</def><id>${def}${id}</id><pos>(9, 0, 9)</pos>${extra}</thing>`));
function context(){
 const save=readRwsSave(fixture),w=createWorld(18,20,20);
 w.pawns=[];w.structures=[];w.growingZones=[];w.piles=[];w.packed=[];w.tick=137;
 w.wildlife={profile:'temperate-hares-v1',rng:1,animals:[],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 w.tiles=w.tiles.map(()=>({terrain:'soil-natural'}));w.tiles[9*20+9]!.fogged=true;
 w.worldFactions={revision:1,playerFactionId:7,factions:[{id:7,def:'PlayerColony'},{id:8,def:'Insect'}]} as World['worldFactions'];
 return new ImportContext(save,save.maps[0]!,w,new ImportNotes(),true,new Map([['Faction_8',8]]));
}
const built=(ctx:ImportContext,t:ReturnType<typeof thing>,kind:StructureKind)=>buildStructure(ctx,t,kind,{x:9,z:9,orientation:0})!;

describe('RWS actual natural building owners',()=>{
 it('retains the physical dormant Hive clock without inventing an active lord or insects',()=>{
  const ctx=context(),t=thing('Hive',3128,'<faction>Faction_8</faction><health>130</health><spawnedTick>0</spawnedTick><wakeUpSignalTag>CompCanBeDormant.WakeUp</wakeUpSignalTag><nextPawnSpawnTick>-1</nextPawnSpawnTick><spawnedPawns/><aggressive>True</aggressive><chosenKind>Megascarab</chosenKind><ticksPassedSinceLastHeal>1362</ticksPassedSinceLastHeal><nextHiveSpawnTick>373397</nextHiveSpawnTick><wasActivated>False</wasActivated><jelly_ticksUntilSpawn>28539</jelly_ticksUntilSpawn><pod_ticksUntilSpawn>46721</pod_ticksUntilSpawn>');
  const s=built(ctx,t,'insect-hive');expect(admitImportedNaturalBuilding(ctx,t,s),JSON.stringify([...ctx.notes.tallies.values()].flatMap(v=>[...v.values()]))).toBe(true);
  expect(s.caveHive).toEqual({revision:1,madeAtCore:0,awakeAtCore:null,temple:true,lastCore:1370,chosenKind:'megascarab',spawnedPawnIds:[],canSpawnPawns:true,nextPawnSpawnCore:-1,canSpawnHives:true,nextHiveSpawnCore:373397,wasActivated:false,jellyLeftCore:28539,podLeftCore:46721,healCore:1362,maintenanceCore:0});
  expect(s.factionId).toBe(8);expect(validCaveHiveBuilding256(s,ctx.w.schemaVersion,ctx.w)).toBe(true);
  const unproven=thing('Hive',3129,'<spawnedPawns><li>Thing_Megaspider33</li></spawnedPawns><aggressive>True</aggressive><faction>Faction_8</faction><nextPawnSpawnTick>-1</nextPawnSpawnTick>');
  expect(admitImportedNaturalBuilding(ctx,unproven,built(ctx,unproven,'insect-hive'))).toBe(false);
 });
 it('retains the enabled and cave-disabled clocks of an awake hive with no surviving spawned insects',()=>{
  const ctx=context(),base='<faction>Faction_8</faction><health>90</health><wokeUpTick>10</wokeUpTick><makeTick>10</makeTick><nextPawnSpawnTick>2359</nextPawnSpawnTick><spawnedPawns/><aggressive>True</aggressive><chosenKind>Megaspider</chosenKind><ticksPassedSinceLastHeal>1360</ticksPassedSinceLastHeal><nextHiveSpawnTick>373397</nextHiveSpawnTick><jelly_ticksUntilSpawn>28539</jelly_ticksUntilSpawn><pod_ticksUntilSpawn>46721</pod_ticksUntilSpawn><ticksSinceMaintain>1350</ticksSinceMaintain>';
  for(const enabled of [true,false]){
   const t=thing('Hive',3128,base+(enabled?'':'<canSpawnPawns>False</canSpawnPawns><canSpawnHives>False</canSpawnHives>'));
   const s=built(ctx,t,'insect-hive');expect(admitImportedNaturalBuilding(ctx,t,s)).toBe(true);
   expect(s.caveHive).toMatchObject({madeAtCore:10,awakeAtCore:10,maintenanceCore:1350,wasActivated:true,canSpawnPawns:enabled,canSpawnHives:enabled});
   expect(s.caveHive?.temple).toBe(enabled?true:undefined);expect(s.damage).toBe(40);
  }
 });
 it('reconnects the source Hive spawner and existing Lord, including active duty and the actual quiet timer',()=>{
  const ctx=context();Object.assign(ctx.save,{ticksGame:1376});ctx.w.worldMaps!.nextLordId=3;
  const base='<faction>Faction_8</faction><health>90</health><wokeUpTick>10</wokeUpTick><makeTick>10</makeTick><nextPawnSpawnTick>2359</nextPawnSpawnTick><aggressive>True</aggressive><chosenKind>Megaspider</chosenKind><ticksPassedSinceLastHeal>1360</ticksPassedSinceLastHeal><nextHiveSpawnTick>373397</nextHiveSpawnTick><jelly_ticksUntilSpawn>28539</jelly_ticksUntilSpawn><pod_ticksUntilSpawn>46721</pod_ticksUntilSpawn><ticksSinceMaintain>1350</ticksSinceMaintain>';
  const first=thing('Hive',100,base+'<spawnedPawns><li>Thing_Megaspider51</li><li>Thing_MegaspiderMissing</li></spawnedPawns>'),second=thing('Hive',101,base+'<spawnedPawns/>');
  const h1=built(ctx,first,'insect-hive'),h2=built(ctx,second,'insect-hive');h2.x=10;
  for(const [t,h] of [[first,h1],[second,h2]] as const){expect(admitImportedNaturalBuilding(ctx,t,h)).toBe(true);ctx.w.structures.push(h);ctx.thingIds.set(t.id,h.id);ctx.map.things.push(t);}
  const source=readThing(parseXml('<thing Class="Pawn"><def>Megaspider</def><id>Megaspider51</id><faction>Faction_8</faction></thing>'));
  const id=ctx.w.nextId++;ctx.map.things.push(source);ctx.thingIds.set(source.id,id);ctx.w.wildlife!.animals.push({id,species:'megaspider',sex:'male',x:8,z:9,ageTicks:1000,food:.8,rest:1,state:'idle',path:[],nextDecision:ctx.w.tick+1});
  const lord=parseXml('<lordManager><lords><li><loadID>23</loadID><faction>Faction_8</faction><ownedPawns><li>Thing_Megaspider51</li></ownedPawns><lordJob Class="LordJob_DefendAndExpandHive"><aggressive>True</aggressive></lordJob><curLordToilIdx>1</curLordToilIdx><lastPawnHarmTick>120</lastPawnHarmTick><lordToilData><keys><li>0</li><li>1</li></keys><values><li Class="LordToil_HiveRelatedData"><assignedHives><keys><li>Thing_Megaspider51</li></keys><values><li>Thing_Hive100</li></values></assignedHives></li><li Class="LordToil_HiveRelatedData"><assignedHives><keys><li>Thing_Megaspider51</li></keys><values><li>Thing_Hive101</li></values></assignedHives></li></values></lordToilData><triggerData><keys><li>10</li></keys><values><li Class="TriggerData_TicksPassed"><ticksPassed>100</ticksPassed></li></values></triggerData></li></lords></lordManager>');
  ctx.map.node.children.push(lord);importRwsHiveOwners(ctx);
  expect(ctx.w.wildlife!.animals[0]!.hive,JSON.stringify([...ctx.notes.tallies.get('building-state')!.values()])).toEqual({factionId:8,lordId:3,spawnerId:h1.id});
  expect(h1.caveHive?.spawnedPawnIds).toEqual([id]);expect(h2.caveHive?.spawnedPawnIds).toEqual([]);
  expect(ctx.w.wildlife!.hiveLords).toEqual([{id:3,factionId:8,aggressive:true,phase:'defend-aggressive',lastHarmCore:1276,memberIds:[id],assignedHives:[{pawnId:id,hiveId:h2.id}]}]);
  expect(ctx.w.worldMaps?.nextLordId).toBe(4);expect(validateCaveHiveOwners256(ctx.w,ctx.w.schemaVersion)).toEqual([]);
  const notes=[...ctx.notes.tallies.get('building-state')!.values()];
  expect(notes.find(n=>n.def==='Cache de mission de Lord')?.origin).toBe('model');
  expect(notes.find(n=>n.def==='Insecte engendré par une ruche')?.origin).toBe('importer');
 });
 it('preserves GlowPod HP, original Rare phase and lifespan under its actual faction',()=>{
  const ctx=context(),t=thing('GlowPod',3138,'<faction>Faction_8</faction><health>37</health><spawnedTick>0</spawnedTick><glowOn>True</glowOn><age>1249</age>');
  const s=built(ctx,t,'glow-pod');expect(admitImportedNaturalBuilding(ctx,t,s),JSON.stringify([...ctx.notes.tallies.values()].flatMap(v=>[...v.values()]))).toBe(true);
  expect(s.id%250).toBe(138);expect(s.factionId).toBe(8);expect(s.damage).toBe(13);
  expect(s.glowPod).toEqual({revision:1,madeAtCore:0,ageCore:1249,lastCore:1370});
  expect(validCaveHiveBuilding256(s,ctx.w.schemaVersion,ctx.w)).toBe(true);
 });
 it('admits the actually stored road props under their canonical orientation and owner',()=>{
  const ctx=context(),t=thing('AncientLamppost',771,'<health>238</health>');
  expect(BUILDING_MAP.AncientLamppost).toEqual({to:{kind:'ancient-road-lamp',size:[1,1]}});
  expect(placeRwsFootprint(ctx.coordinates,'ancient-road-lamp',t.pos!,3,[1,1])).toEqual({x:9,z:10,orientation:0,exact:true});
  const s=built(ctx,t,'ancient-road-lamp');expect(admitImportedNaturalBuilding(ctx,t,s)).toBe(true);
  expect(s.factionId).toBeNull();expect(s.damage).toBe(62);
  expect(validLocalRoadPropStructure256(s,ctx.w.schemaVersion,ctx.w)).toBe(true);
 });
 it('retains collapse rubble separately and restores the exact underlying surface when mined',()=>{
  const ctx=context(),t=thing('CollapsedRocks',490,'<health>310</health>');
  const tile=importCollapsedRock(ctx,{terrain:'soil-natural',floor:'wood-planks'},t);
  expect(tile).toMatchObject({terrain:'rock',floor:'wood-planks',collapsedRock:{id:ctx.thingIds.get(t.id),terrain:'soil-natural'},miningDamage:190});
  expect(excavatedCollapsedRock256(tile)).toEqual({terrain:'soil-natural',floor:'wood-planks'});
  expect(ROCK_MAP.CollapsedRocks).toEqual({to:{collapsed:true}});
  expect(ROCK_MAP.SmoothedGranite).toEqual({to:{stone:'granite',smoothed:true}});
 });
 it('keeps the saved table policy and native crop choice of a hydroponic basin',()=>{
  const ctx=context(),off=thing('Table2x2c',501),on=thing('Table2x2c',502,'<active>True</active>');
  const table=built(ctx,off,'table-square');importGatheringPolicy(ctx,off,table);expect(table.gatherSpot).toBe(false);
  importGatheringPolicy(ctx,on,table);expect(table.gatherSpot).toBeUndefined();
  const src=thing('HydroponicsBasin',503,'<plantDefToGrow>Plant_Cotton</plantDefToGrow>'),basin=built(ctx,src,'hydroponics-basin');
  ctx.w.structures.push(basin);initializeHydroponicBasin(ctx.w,basin);importHydroponicPolicy(ctx,src,basin);
  expect(ctx.w.growingZones[0]).toMatchObject({basinId:basin.id,plant:'cotton',allowSow:true,allowCut:true});
 });
});
