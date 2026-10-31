import {expect,test,vi} from 'vitest';
import {flameBurst,advanceFires} from '../src/sim/fire';
import {advanceDuckFlyers256} from '../src/sim/duck-flyer-runtime-256';
import {hitSkyfallerRoof256} from '../src/sim/roofing';
import {damageStructure} from '../src/sim/thing-damage';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {emptyFireLedger} from '../src/sim/fire-rules';
import type {World} from '../src/sim/types';
import type {ThermalLayout} from '../src/sim/thermal-topology';

// A declared peripheral thermal service avoids a room/Engine fixture. FireContent,
// fire RNG, both public fire producers, and the structure damage guard are real.
vi.mock('../src/sim/temperature.ts',async importOriginal=>({...await importOriginal<typeof import('../src/sim/temperature')>(),reconcileTemperature:(w:World)=>({rooms:[],doors:[],indices:new Int32Array(w.width*w.height).fill(-1)})}));
const layout=():ThermalLayout=>({rooms:[],doors:[],indices:new Int32Array(25).fill(-1)});
function fireFixture(version:number,phase=0){
 const wall={id:10,kind:'wall',material:'wood',x:2,z:2,damage:0};
 const world={schemaVersion:version,tick:16,...version>=297?{phaseCore297:phase}:{},seed:1234,rng:5678,nextId:30,width:5,height:5,
  tiles:Array.from({length:25},()=>({terrain:'grass',height:0})),resources:[],piles:[],packed:[],jobs:[],pawns:[],structures:[wall],events:[],home:[],
  roofing:{constructed:[],build:[],remove:[],cursor:0},fires:{rng:12345,clockCore:150,items:[],embers:[],batteryWicks:[],ledger:emptyFireLedger()}} as unknown as World;
 return {world,wall};
}
function fireOutcome(kind:'lightning'|'pulse',version:number,phase=0){
 const h=fireFixture(version,phase),initial={tick:h.world.tick,phase:h.world.phaseCore297,rng:h.world.rng};
 if(kind==='lightning')expect(flameBurst(h.world,{x:2,z:2},.25,159)).toBe(true);
 else{
  h.world.fires!.items.push({id:11,x:2,z:2,size:.5,bornCore:9,nextPulseCore:159,complexCore:135,spreadCore:0});
  advanceFires(h.world,{rainRate:0},layout());
 }
 expect({tick:h.world.tick,phase:h.world.phaseCore297,rng:h.world.rng}).toEqual(initial);
 return {damage:h.wall.damage,fires:structuredClone(h.world.fires),nextId:h.world.nextId,events:structuredClone(h.world.events)};
}

test('real fire pulse159 and lightning159 damage a structure at the committed297/298 owner without changing pulse dates or fire RNG',()=>{
 for(const kind of ['lightning','pulse'] as const){
  const historical=fireOutcome(kind,296);expect(historical.damage).toBeGreaterThan(0);
  for(const[version,phase]of [[297,0],[298,0],[298,3]] as const){
   const actual=fireOutcome(kind,version,phase);expect(actual).toEqual(historical);
   if(kind==='pulse')expect(actual.fires!.items[0]).toMatchObject({bornCore:9,nextPulseCore:174,complexCore:0});
   else expect(actual.fires!.items[0]).toMatchObject({bornCore:159,nextPulseCore:174});
  }
 }
});

function duckFixture(version:number,phase=0){
 const animal={id:1,species:'duck',x:2,z:2,state:'idle',path:[],nextDecision:0,ageTicks:0};
 const flyer={revision:1,id:2,kind:'arrival',cell:{x:2,z:2},startedAtCore:0,atCore:580,totalCore:600,remainingCore:20,personalTick:0,animal,roofHit:false};
 const world={schemaVersion:version,tick:59,...version>=297?{phaseCore297:phase}:{},width:5,height:5,nextId:3,rng:5678,
  roofing:{constructed:[12],build:[],remove:[],cursor:0},wildlife:{profile:'geographic-fauna-v3',rng:12345,animals:[],flyers:[flyer]}} as unknown as World;
 return {world,flyer,animal};
}
// Service-clock probe invokes the unchanged real HitRoof guard on a roof-free
// partial view. This contract tests the producer's timestamp, not roof collapse.
const roofClockProbe=(w:World,c:{x:number;z:number},core:number)=>hitSkyfallerRoof256({...w,roofing:{constructed:[],build:[],remove:[],cursor:0}},c,core);

test('the real duck holder admits inner impact585 at current590/593 and preserves holder progress, original identity and RNG',()=>{
 for(const[version,phase]of [[296,0],[297,0],[298,0],[298,3]] as const){
  const h=duckFixture(version,phase),seen:number[]=[];
  advanceDuckFlyers256(h.world,{hitRoof:(w,c,core)=>{seen.push(core);return roofClockProbe(w,c,core);}});
  expect(seen).toEqual([version===296?585:590+phase]);expect(h.flyer.roofHit).toBe(true);
  expect(h.flyer).toMatchObject({atCore:590,remainingCore:10,totalCore:600,startedAtCore:0});
  expect(h.flyer.animal).toBe(h.animal);expect(h.world.wildlife!.animals).toEqual([]);expect(h.world.wildlife!.flyers![0]).toBe(h.flyer);
  expect(h.world.tick).toBe(59);expect(h.world.phaseCore297).toBe(version>=297?phase:undefined);expect(h.world.nextId).toBe(3);expect(h.world.rng).toBe(5678);expect(h.world.wildlife!.rng).toBe(12345);
 }
});

test('strict damage/roof guards still reject wrong Core and a false roof service never marks or releases the duck',()=>{
 for(const version of [297,298]){
  const h=fireFixture(version,3),before=JSON.stringify(h.wall);
  expect(damageStructure(h.world,h.world.structures[0]!,10,'fire',h.world.rng,{core:159,rawAmount:10})).toBe(false);expect(JSON.stringify(h.wall)).toBe(before);
  expect(roofClockProbe(h.world,{x:2,z:2},159)).toBe(false);expect(roofClockProbe(h.world,{x:2,z:2},effectiveCore297(h.world))).toBe(true);
  const d=duckFixture(version,3),seen:number[]=[];
  advanceDuckFlyers256(d.world,{hitRoof:(_w,_c,core)=>{seen.push(core);return false;}});
  expect(seen).toHaveLength(1);expect(seen[0]).toBeLessThanOrEqual(effectiveCore297(d.world));expect(d.flyer.roofHit).toBe(false);expect(d.world.wildlife!.animals).toEqual([]);expect(d.world.wildlife!.flyers![0]).toBe(d.flyer);expect(d.world.nextId).toBe(3);expect(d.world.wildlife!.rng).toBe(12345);
 }
});
