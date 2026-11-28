import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import type {World,StructureKind} from '../src/sim/types.ts';
import {batteryWattDays} from '../src/sim/power-battery.ts';
import {doorOpenness} from '../src/sim/door-rules.ts';
import {validateDoors} from '../src/sim/door-save.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {validMiniTurretShape} from '../src/sim/mini-turret-save.ts';
import {validGeothermalWorld264} from '../src/sim/geothermal-state-264.ts';
import {validLocalGeyserState256} from '../src/sim/local-geyser-save-256.ts';
import {buildStructure,ImportContext} from '../src/import/rimworld/convert.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {admitImportedStructureOwner,importNaturalGeysers,restoreImportedPowerState} from '../src/import/rimworld/convert-building-state.ts';
import {reconcilePower} from '../src/sim/power.ts';
import {placeRwsFootprint} from '../src/import/rimworld/local-coordinates.ts';
import {BUILDING_MAP} from '../src/import/rimworld/map-buildings.ts';
import {isDropped} from '../src/import/rimworld/mapping.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
function context(geo=false){
 const save=readRwsSave(fixture),w=createWorld(17,20,20);w.pawns=[];w.structures=[];w.piles=[];w.packed=[];
 if(geo)w.site={revision:3} as World['site'];
 return new ImportContext(save,save.maps[0]!,w,new ImportNotes(),geo);
}
const thing=(def:string,extra='',pos='(10, 0, 10)')=>readThing(parseXml(`<thing Class="Building"><def>${def}</def><id>${def}123</id><pos>${pos}</pos>${extra}</thing>`));
const placed={x:10,z:10,orientation:0 as const};
const make=(ctx:ImportContext,def:string,kind:StructureKind,extra:string)=>buildStructure(ctx,thing(def,extra),kind,placed)!;

describe('RWS physical building state',()=>{
 it('retains charge, setpoints, switch intent and exact partial fuel, including empty tanks',()=>{
  const ctx=context(),battery=make(ctx,'Battery','battery','<storedPower>412.375</storedPower>');
  expect(batteryWattDays(battery.battery!)).toBe(412.375);
  const heater=make(ctx,'Heater','heater','<targetTemperature>23</targetTemperature><switchOn>False</switchOn>');
  expect(heater.heater?.target).toBe(23);expect(heater.power).toMatchObject({switchOn:false,on:false});
  const cooler=make(ctx,'Cooler','cooler','<targetTemperature>-3</targetTemperature>');expect(cooler.cooler?.target).toBe(-3);
  expect(make(ctx,'PassiveCooler','passive-cooler','<fuel>24.2182312</fuel><allowAutoRefuel>False</allowAutoRefuel>').fuel).toMatchObject({ticks:14531,autoRefuel:false});
  expect(make(ctx,'PassiveCooler','passive-cooler','').fuel?.ticks).toBe(0);
 });
 it('keeps the original translated transmission parent and operating state instead of restarting consumers',()=>{
  const ctx=context(),wire=thing('PowerConduit'),far=thing('HiddenConduit'),consumer=thing('Cooler','<parentThing>Thing_PowerConduit123</parentThing><targetTemperature>-3</targetTemperature>');
  const broken=thing('Heater','<parentThing>Thing_HiddenConduit123</parentThing><powerOn>False</powerOn>');
  for(const [t,k,x,z] of [[wire,'power-conduit',9,8],[far,'power-conduit',11,8],[consumer,'cooler',10,9],[broken,'heater',12,8]] as const){
   ctx.map.things.push(t);const b=buildStructure(ctx,t,k,{x,z,orientation:0})!;ctx.w.structures.push(b);ctx.thingIds.set(t.id,b.id);
  }
  reconcilePower(ctx.w);restoreImportedPowerState(ctx);
  expect(ctx.w.structures[2]!.power).toMatchObject({parentId:ctx.thingIds.get(wire.id),on:true});
  expect(ctx.w.structures[3]!.power).toMatchObject({parentId:ctx.thingIds.get(far.id),on:false});
 });
 it('keeps the logical opening, displayed pose, closing delay and a forbidden door',()=>{
  const ctx=context(),s=make(ctx,'Door','door','<stuff>WoodLog</stuff><open>True</open><ticksOpen>166572</ticksOpen><ticksUntilClose>63</ticksUntilClose><forbidden>True</forbidden>');
  expect(s.door).toMatchObject({open:true,holdOpen:false,forbidden:true,closeAt:ctx.w.tick+6.3});expect(doorOpenness(s,ctx.w.tick)).toBe(1);
 });
 it('retains ammunition and drill/scanner worker progress in authoritative state',()=>{
  const ctx=context(),turret=make(ctx,'Turret_MiniTurret','mini-turret','<fuel>46</fuel><allowAutoRefuel>False</allowAutoRefuel><holdFire>True</holdFire>');
  expect(turret.turret).toMatchObject({ammoQ:184,holdFire:true,autoReload:false});expect(validMiniTurretShape(turret.turret,ctx.w.schemaVersion)).toBe(true);
  const drill=make(ctx,'DeepDrill','deep-drill','<portionProgress>7821.19629</portionProgress><portionYieldPct>0.778327346</portionYieldPct><lastUsedTick>4000</lastUsedTick>');
  expect(drill.deepDrill).toMatchObject({progress:7821.19629,yieldPct:0.778327346});expect(drill.deepDrill!.rng).toBeGreaterThan(0);
  const scanner=make(ctx,'GroundPenetratingScanner','ground-scanner','<daysWorkingSinceLastFinding>1.76934767</daysWorkingSinceLastFinding><lastUserSpeed>1.90400016</lastUserSpeed><lastScanTick>4000</lastScanTick>');
  expect(scanner.deepScanner).toMatchObject({daysWorking:1.76934767,lastUserSpeed:1.90400016});
 });
 it('preserves an almost closing open door at a nonzero Core phase',()=>{
  const ctx=context();ctx.w.tick=1230575;ctx.w.phaseCore297=6;
  Object.assign(ctx.save,{ticksGame:12305756});
  const door=make(ctx,'Door','door','<open>True</open><ticksOpen>38</ticksOpen><ticksUntilClose>1</ticksUntilClose><lastFriendlyTouchTick>12305732</lastFriendlyTouchTick>');
  ctx.w.structures.push(door);
  expect(door.door?.changedAt).toBe(effectiveCore297(ctx.w)/10);
  expect(door.door?.closeAt).toBe(1230575.7);
  expect(door.door?.lastTouch).toBe(1230573.2);
  expect(validateDoors(ctx.w,ctx.w.schemaVersion)).toEqual([]);
 });
 it('retains the wind cache, cut intent and barrel owner rather than treating them as fresh construction',()=>{
  const ctx=context();
  const wind=make(ctx,'WindTurbine','wind-turbine','<cachedPowerOutput>547.288025</cachedPowerOutput><updateCounter>20</updateCounter><autoCutFilter><allowedDefs><li>Plant_TreeOak</li></allowedDefs></autoCutFilter>');
  expect(wind.wind).toEqual({cachedWatts:547,updateCounter:2,autoCut:true});
  const barrel=make(ctx,'FermentingBarrel','fermenting-barrel','<wortCount>8</wortCount><progress>0.7</progress><ruinedPercent>0.14</ruinedPercent>');
  expect(barrel.fermentation).toEqual({wort:8,progress:.7,ruin:.14});
 });
 it('creates the exact original geothermal owner from a source geyser, without using generated positions',()=>{
  const ctx=context(true),g=thing('SteamGeyser');ctx.map.things.push(g);
  importNaturalGeysers(ctx);const source=ctx.w.geysers!.items[0]!;
  expect(source).toMatchObject({x:10,z:8});expect(ctx.thingIds.get(g.id)).toBe(source.id);
  expect(validLocalGeyserState256(ctx.w.geysers,20,20,ctx.w.tick,ctx.w.nextId)).toBe(true);
  const t=thing('GeothermalGenerator'),p=placeRwsFootprint(ctx.coordinates,'geothermal-generator',t.pos!,0,[6,6])!;
  const s=buildStructure(ctx,t,'geothermal-generator',p)!;
  expect(admitImportedStructureOwner(ctx,t,s)).toBe(true);ctx.w.structures.push(s);
  expect(s).toMatchObject({x:8,z:6,orientation:0,geothermal:{geyserId:source.id}});expect(validGeothermalWorld264(ctx.w)).toBe(true);
  const other=buildStructure(ctx,t,'geothermal-generator',{...p,x:p.x+1})!;
  expect(admitImportedStructureOwner(ctx,t,other)).toBe(false);
 });
 it('stages ancient holders for the separate original occupant transfer',()=>{
  const ctx=context(),empty=thing('AncientCryptosleepCasket','<contentsKnown>True</contentsKnown><innerContainer><innerList/></innerContainer>');
  const s=buildStructure(ctx,empty,'ancient-cryptosleep-casket',placed)!;
  expect(admitImportedStructureOwner(ctx,empty,s)).toBe(true);expect(s.casket).toMatchObject({contentsKnown:true,humans:[],animals:[],items:[]});
  const occupied=thing('AncientCryptosleepCasket','<innerContainer><innerList><li Class="Pawn"><def>Human</def></li></innerList></innerContainer>');
  const staged=buildStructure(ctx,occupied,'ancient-cryptosleep-casket',placed)!;
  expect(admitImportedStructureOwner(ctx,occupied,staged)).toBe(true);expect(staged.casket?.humans).toEqual([]);
 });
 it('restores an already started ship reactor by its original startup deadline',()=>{
  const ctx=context();ctx.w.tick=200_000;ctx.w.phaseCore297=1;Object.assign(ctx.save,{ticksGame:2_000_001});
  const source=thing('Ship_Reactor','<hibernateState>Starting</hibernateState><hibernateendStartupTick>2500000</hibernateendStartupTick>');
  const s=buildStructure(ctx,source,'ship-reactor',placed)!;
  expect(admitImportedStructureOwner(ctx,source,s)).toBe(true);
  expect(s.shipReactor275).toEqual({state:'starting',startCore:1660000,endCore:2500000});
 });
 it('maps existing monument, egg box and ship part definitions rather than reporting them absent',()=>{
  for(const def of ['Column','Urn','SteleLarge','SteleGrand','EggBox','ShipChunk','Ship_Beam','Ship_ComputerCore','Ship_SensorCluster','Ship_Engine','Ship_CryptosleepCasket','Ship_Reactor']){
   expect(BUILDING_MAP[def]).toBeDefined();expect(isDropped(BUILDING_MAP[def]!)).toBe(false);
  }
 });
});
