import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {thermalPileOwners379,eggPileSnapshot379} from '../src/sim/perishable-pile-owners-379.ts';
import {appendPileEntries,filterPileEntries,splicePileEntries,markPileIdentityUnknownWrite} from '../src/sim/pile-identity-directory.ts';
import {updateFoodTemperatures} from '../src/sim/thermal-food.ts';
import {expireFood} from '../src/sim/food-expiration.ts';
import {freshRot,ROT_DAYS} from '../src/sim/food-preservation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {setTerrainWriteCacheVerification,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal.ts';
import {temperatureAt,outdoorTemperature} from '../src/sim/temperature.ts';
import {seasonalOutdoorTemperature,seasonTemperature,geographicSeasonTemperature256,geographicLongitudeOffsetCore256,geographicOutdoorTemperature262,climateTick,siteClimateDefinition} from '../src/sim/site-climate.ts';
import {annualNaturalLight,seasonalNaturalLight,naturalLight} from '../src/sim/environment.ts';
import {eclipseLightFactor} from '../src/sim/eclipse.ts';
import {volcanicGlow310,volcanicWinterStrength310} from '../src/sim/volcanic-winter-state-310.ts';
import {TICKS_PER_DAY,type MaterialPile,type World} from '../src/sim/types.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';

const fixture=():World=>{
 const w=createWorld(1379,32,32);w.structures=[];w.piles=[];w.resources=[];w.jobs=[];w.pawns=[];w.spoiled={berries:0,rice:0,'simple-meal':0};
 w.thermal={regions:[{cells:[10,11,12],temperature:3}]};return w;
};
const pile=(world:World,item:MaterialPile['item'],cell:number):MaterialPile=>({
 id:world.nextId++,item,kind:ITEM_DEFINITIONS[item].kind,quantity:1,owner:{type:'ground',x:cell%world.width,z:Math.floor(cell/world.width)},...freshRot(item,world.tick)
});

test('closed perishable/egg members follow native append/filter, unordered splice and item conversion with source order',()=>{
 const w=fixture(),owner={};w.piles=[pile(w,'steel',10),pile(w,'rice',11),pile(w,'duck-egg-fertilized',12),pile(w,'milk',13)];
 const capture=()=>withJournalTerrainReadScope(owner,()=>{
  return {thermal:[...thermalPileOwners379(w)],eggs:eggPileSnapshot379(w)};
 });
 const first=capture();expect(first.thermal.map(p=>p.item)).toEqual(['rice','duck-egg-fertilized','milk']);
 expect(first.eggs?.map(p=>p.item)).toEqual(['duck-egg-fertilized']);
 withJournalTerrainReadScope(owner,()=>{appendPileEntries(w.piles,pile(w,'wood',5),pile(w,'potato',6));w.piles=filterPileEntries(w.piles,p=>p.item!=='rice');});
 expect(capture().thermal.map(p=>p.item)).toEqual(['duck-egg-fertilized','milk','potato']);
 withJournalTerrainReadScope(owner,()=>splicePileEntries(w.piles,1,0,pile(w,'berries',7)));
 expect(capture().thermal.map(p=>p.item)).toEqual(['berries','duck-egg-fertilized','milk','potato']);
 const heldEgg=first.eggs![0]!;
 withJournalTerrainReadScope(owner,()=>{heldEgg.item='duck-egg-unfertilized';Object.assign(heldEgg,freshRot(heldEgg.item,w.tick));markPileIdentityUnknownWrite();});
 expect(capture().eggs?.map(p=>p.item)).toEqual(['duck-egg-unfertilized']);
 w.piles=[...w.piles].reverse();expect(capture().thermal.map(p=>p.item)).toEqual(['potato','milk','duck-egg-unfertilized','berries']);
 expect(thermalPileOwners379(w)).toBe(w.piles);expect(eggPileSnapshot379(w)).toBeUndefined();
});

test('temperature and expiration match exhaustive readers at every previous boundary and membership edit',()=>{
 const w=fixture(),owner={};w.piles=[pile(w,'steel',10),pile(w,'rice',11),pile(w,'milk',12),pile(w,'wood',15)];
 const literal=structuredClone(w);const checking=verifyTerrainWriteCaches;setTerrainWriteCacheVerification(true);
 try{
  for(let i=0;i<12;i++){
   const edit=(world:World)=>{
    world.tick++;
    if(i===1)appendPileEntries(world.piles,pile(world,'potato',10));
    if(i===2)world.piles=filterPileEntries(world.piles,p=>p.item!=='potato');
    if(i===3)splicePileEntries(world.piles,1,0,pile(world,'berries',10));
    if(i===4){const p=world.piles.find(p=>p.item==='milk')!;p.rot={progress:ROT_DAYS.milk*TICKS_PER_DAY,atTick:world.tick};}
    if(i===5)world.piles=world.piles.slice().reverse();
    if(i===6){const p=world.piles.find(p=>p.item==='rice')!;p.owner={type:'ground',x:20,z:20};}
    if(i===7)world.thermal={regions:[{cells:[10,11,12],temperature:8}]};
    if(world.thermal)world.thermal.regions[0]!.temperature=i*1.7-3;
   };
   withJournalTerrainReadScope(owner,()=>{edit(w);updateFoodTemperatures(w);expireFood(w);updateFoodTemperatures(w);});
   edit(literal);updateFoodTemperatures(literal);expireFood(literal);updateFoodTemperatures(literal);
   expect(w).toStrictEqual(literal);
  }
 }finally{setTerrainWriteCacheVerification(checking);}
});

test('closed point thermal membership keeps last-wins overlaps and rereads live region temperatures',()=>{
 const w=fixture(),owner={};w.thermal={regions:[{cells:[1,2],temperature:5},{cells:[2,3],temperature:9}]};
 const compare=()=>{const actual=withJournalTerrainReadScope(owner,()=>Array.from({length:5},(_,x)=>temperatureAt(w,{x,z:0})));
  expect(actual).toEqual(Array.from({length:5},(_,x)=>temperatureAt(w,{x,z:0})));return actual;};
 expect(compare()).toEqual([outdoorTemperature(w),5,9,9,outdoorTemperature(w)]);
 w.thermal.regions[1]!.temperature=-6;expect(compare()[2]).toBe(-6);
 w.thermal={regions:[{cells:[1,2],temperature:-4}]};expect(compare()[2]).toBe(-4);
});

test('pure climate scalar caches retain clock, adopted profile, geography and current incident arithmetic exactly',()=>{
 const w=fixture();delete w.climate;delete w.miscIncidents;
 const outside=(world:World,tick:number)=>{
  const climate=world.climate,sample=climate?tick-((tick-climate.adoptedAt)%6+6)%6:tick,civil=climateTick(world,sample),def=siteClimateDefinition(world);
  if(climate?.revision===4&&climate.irregular262)return geographicOutdoorTemperature262(def,climate.tileId,civil*10-geographicLongitudeOffsetCore256(def.longitude));
  const base=climate?.revision===4?geographicSeasonTemperature256(def,civil*10-geographicLongitudeOffsetCore256(def.longitude)):climate?seasonTemperature(def.latitude,def.meanTemperature,civil):21;
  return base+7*Math.cos(2*Math.PI*(civil%TICKS_PER_DAY/TICKS_PER_DAY+.32));
 };
 const light=(world:World,tick:number)=>{const civil=climateTick(world,tick),base=world.climate?seasonalNaturalLight(siteClimateDefinition(world).latitude,civil):naturalLight(civil);
  return volcanicGlow310(base*eclipseLightFactor(world,tick),volcanicWinterStrength310(world,tick));};
 const compare=()=>{for(const tick of [w.tick,w.tick+1,w.tick+5,w.tick+6,w.tick,w.tick+2]){
   expect(seasonalOutdoorTemperature(w,tick)).toBe(outside(w,tick));expect(annualNaturalLight(w,tick)).toBe(light(w,tick));
 }};
 compare();w.climate={revision:1,adoptedAt:0,calendarOrigin:240000,profile:'boreal-reference'};compare();
 w.climate={...w.climate,profile:'arid-reference'};compare();
 w.climate={revision:4,tileId:31,irregular262:true,adoptedAt:0,calendarOrigin:240000,definition:{latitude:-31,longitude:26,meanTemperature:3,amplitude:12,rainfall:500}};compare();
 w.climate.definition.latitude=27;w.climate.definition.longitude=-18;w.climate.definition.meanTemperature=5;w.climate.definition.amplitude=24;compare();
 w.climate.calendarOrigin+=9000;w.climate.tileId=41;compare();
 w.miscIncidents={volcanicWinter310:{startCore:0,endCore:450000},weather:{eclipse:{start:w.tick,end:w.tick+100}}} as World['miscIncidents'];compare();
});
