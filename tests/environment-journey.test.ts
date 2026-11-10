import { createWoodLedger,readWoodLedger,trackWoodStep,conservedWood,type WoodLedger } from './scenarios/wood-conservation.ts';
import {createRepairLedger,readRepairLedger,trackMaintenanceStep,type RepairLedger} from './scenarios/repair-conservation.ts';
import { writeTestFileSync } from './test-output.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect,onTestFailed,test } from 'vitest';
import { applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld } from '../src/sim/index.ts';
import { isColonist } from '../src/sim/affiliation.ts';
import { climateTick } from '../src/sim/site-climate.ts';
import { isPlant,plantGrowth } from '../src/sim/plants.ts';
import { ITEM_DEFINITIONS,type ItemId } from '../src/sim/items.ts';
import { foodAccount } from './scenarios/colony-player.ts';
import { metalAccount } from './scenarios/energy-player.ts';
import type { PrisonPlayerState } from './scenarios/prison-player.ts';
import { environmentDecisions,environmentSummary,newEnvironmentPlayer,observeEnvironment,type EnvironmentPlayerState } from './scenarios/environment-player.ts';
import { crashlandedThreatActive } from './scenarios/crashlanded-player.ts';
import type { Command,World } from '../src/sim/types.ts';

// Exact project-owned Lisière continuation after the published V86 recruitment.
// It contains no private RimWorld save and is never rewritten by this runner.
const fixtureBytes=gunzipSync(readFileSync('tests/fixtures/colony-v86.json.gz'));
const fixtureHash=createHash('sha256').update(fixtureBytes).digest('hex');
const expectedFixtureHash='8425c61539267e77315d43c91d5c036de5ea8a9b675d5ec48db8685c3818dbe5';
const prisonReport=JSON.parse(readFileSync('artifacts/prison-colony-v86.json','utf8')) as {player:PrisonPlayerState};
const loadFixture=()=>deserializeWorld(fixtureBytes.toString('utf8'));
interface Ledger {consumed:number;harvested:number;cooked:number;steelMined:number;componentsMined:number}
interface Checkpoint { woodLedger:WoodLedger;repairLedger:RepairLedger;
  protocol:'environment-v87';fixtureHash:string;world:string;player:EnvironmentPlayerState;ledger:Ledger;
  initial:{wood:number;food:number;animalEaten:number;steel:number;component:number};
  journal:{tick:number;reason:string;command:Command}[];observations:ReturnType<typeof environmentSummary>[];
}
const fireItem=(w:World,item:ItemId)=>w.fires?.ledger.items[item]??0;
const fireFood=(w:World)=>Object.entries(w.fires?.ledger.items??{}).reduce((n,[item,quantity])=>n+(ITEM_DEFINITIONS[item as ItemId].kind==='food'?quantity:0),0);

test('Environnement : préflight du vrai J76, adoption explicite, placements ordinaires et continuation',()=>{
  expect(fixtureHash).toBe(expectedFixtureHash);expect(JSON.parse(fixtureBytes.toString('utf8')).schemaVersion).toBe(86);
  const w=loadFixture(),before=serializeWorld(w),player=newEnvironmentPlayer(w,prisonReport.player);
  expect(w.tick).toBe(457698);expect(w.climate).toBeUndefined();expect(player.initialPeople).toHaveLength(4);
  expect(serializeWorld(w)).toBe(before);expect(player.heaters).toHaveLength(2);expect(player.wire.length).toBeGreaterThan(0);
  const resources=structuredClone(w.resources),piles=structuredClone(w.piles),growth=new Map(w.resources.filter(isPlant).map(r=>[r.id,plantGrowth(w,r)]));
  const adoption=environmentDecisions(w,player);expect(adoption.map(d=>d.command)).toEqual([{type:'climate-adopt'}]);
  expect(applyCommand(w,adoption[0]!.command)).toMatchObject({ok:true});
  expect(w.tick).toBe(457698);expect(w.piles).toEqual(piles);
  expect(w.resources.map(({plantLife:_,growth:__,growthTick:___,...r})=>r)).toEqual(resources.map(({plantLife:_,growth:__,growthTick:___,...r})=>r));
  for(const r of w.resources.filter(isPlant))expect(plantGrowth(w,r),`Preserved growth ${r.id}`).toBe(growth.get(r.id));
  const decisions=environmentDecisions(w,player);
  expect(decisions.filter(d=>d.command.type==='designate'&&d.command.kind==='heater')).toHaveLength(2);
  expect(decisions.some(d=>d.command.type==='designate'&&d.command.kind==='wind-turbine')).toBe(true);
  expect(decisions.some(d=>d.command.type==='designate'&&d.command.kind==='power-conduit')).toBe(true);
  for(const d of decisions)expect(applyCommand(w,d.command),JSON.stringify(d)).toMatchObject({ok:true});
  expect(validateWorld(w)).toEqual([]);stepWorld(w,250);observeEnvironment(w,player);
  for(const d of environmentDecisions(w,player))expect(applyCommand(w,d.command),JSON.stringify(d)).toMatchObject({ok:true});
  const copy=deserializeWorld(serializeWorld(w));stepWorld(w,120);stepWorld(copy,120);
  expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(validateWorld(w)).toEqual([]);
},180000);

function runEnvironmentJourney():void {
  expect(fixtureHash).toBe(expectedFixtureHash);
  const input=process.env.ENVIRONMENT_CHECKPOINT,resumed:Checkpoint|undefined=input?JSON.parse(readFileSync(input,'utf8')):undefined;
  if(resumed&&(resumed.protocol!=='environment-v87'||resumed.fixtureHash!==fixtureHash))throw Error('Environment checkpoint must descend from the committed V86 colony.');
  let w:World=resumed?deserializeWorld(resumed.world):loadFixture();
  const woodLedger=resumed?readWoodLedger(resumed.woodLedger):createWoodLedger();
  const repairLedger=resumed?readRepairLedger(resumed.repairLedger):createRepairLedger();
  const player=resumed?.player??newEnvironmentPlayer(w,prisonReport.player),started=performance.now();
  const ledger:Ledger=resumed?.ledger??{consumed:0,harvested:0,cooked:0,steelMined:0,componentsMined:0};
  const initial=resumed?.initial??{wood:conservedWood(w,woodLedger),food:foodAccount(w)+fireFood(w),animalEaten:w.wildlife?.eatenItems??0,steel:metalAccount(w,'steel')+fireItem(w,'steel'),component:metalAccount(w,'component')+fireItem(w,'component')};
  const journal:Checkpoint['journal']=resumed?.journal??[],observations:Checkpoint['observations']=resumed?.observations??[];
  const checkpoint=():Checkpoint=>({protocol:'environment-v87',fixtureHash,world:serializeWorld(w),player,ledger,woodLedger,repairLedger,initial,journal,observations});
  // A failed validator is itself evidence: preserve raw authoritative state
  // instead of asking the strict serializer to accept that invalid world.
  const failureFile='tmp/environment-failed-v87.json';onTestFailed(()=>writeTestFileSync(failureFile,JSON.stringify({protocol:'environment-v87',fixtureHash,world:JSON.stringify(w),player,ledger,woodLedger,repairLedger,initial,journal,observations,validation:validateWorld(w)})));
  const context=()=>JSON.stringify({tick:w.tick,ledger,latest:observations.at(-1),checkpoint:failureFile});
  const observe=()=>{
    observations.push(structuredClone(environmentSummary(w,player)));const c=context();
    expect(validateWorld(w),c).toEqual([]);
    expect(player.initialPeople.every(id=>w.pawns.some(p=>p.id===id&&isColonist(p)&&p.state!=='dead')),c).toBe(true);
    expect(conservedWood(w,woodLedger),c).toBeCloseTo(initial.wood,7);
    expect(metalAccount(w,'steel')+fireItem(w,'steel'),c).toBe(initial.steel+ledger.steelMined);
    expect(metalAccount(w,'component')+fireItem(w,'component')+repairLedger.spent,c).toBe(initial.component+ledger.componentsMined);
    expect(foodAccount(w)+fireFood(w)+ledger.consumed+9*ledger.cooked+(w.wildlife?.eatenItems??0)-initial.animalEaten,c).toBe(initial.food+ledger.harvested);
  };
  const continuation=()=>{
    const saved=serializeWorld(w),copy=deserializeWorld(saved);
    try{stepWorld(w,120);stepWorld(copy,120);expect(serializeWorld(copy),context()).toBe(serializeWorld(w));}
    catch(error){writeTestFileSync('tmp/environment-continuation-failed-v87.json',JSON.stringify({saved,actual:JSON.stringify(w),restored:JSON.stringify(copy),validation:validateWorld(w),failure:String(error)}));throw error;}
    finally{w=deserializeWorld(saved);}
  };
  // This 65-day diagnostic horizon crosses the natural mild winter and the
  // following spring. It schedules no fire, frost, raid or harvest. The optional
  // stop is a resumable bounded preflight, never a successful annual campaign.
  const until=process.env.ENVIRONMENT_UNTIL===undefined?undefined:Number(process.env.ENVIRONMENT_UNTIL);
  if(until!==undefined&&(!Number.isSafeInteger(until)||until<=w.tick||until>w.tick+2*6000))throw Error('A bounded environment diagnostic must stop within two days of its actual starting state.');
  const limit=Math.min(player.startTick+65*6000,until??Infinity);
  while(w.tick<limit){
    if(w.tick===player.startTick||w.tick%250===0||crashlandedThreatActive(w)&&w.tick%20===0){
      for(const d of environmentDecisions(w,player)){const result=applyCommand(w,d.command);expect(result,JSON.stringify({tick:w.tick,...d,result})).toMatchObject({ok:true});journal.push({tick:w.tick,...d});}
      if(w.tick%250===0)observe();
    }
    const beforeMilestones=Object.keys(player.milestones).join(',');
    const mines=w.jobs.filter(j=>j.kind==='mine').flatMap(j=>{const tile=w.tiles[j.z*w.width+j.x]!;return tile.ore?[{cell:j.z*w.width+j.x,ore:tile.ore}]:[];});
    trackMaintenanceStep(w,repairLedger,()=>trackWoodStep(w,woodLedger,()=>stepWorld(w)));
    for(const target of mines)if(w.tiles[target.cell]!.terrain!=='rock'){if(target.ore==='steel')ledger.steelMined+=40;else if(target.ore==='machinery')ledger.componentsMined+=2;}
    for(const e of w.events.filter(e=>e.tick===w.tick)){
      const eaten=e.message.match(/a mangé une portion \((\d+) ×/);
      if(eaten){ledger.consumed+=Number(eaten[1]);if(climateTick(w)%360000>=45*6000)player.winterMeals++;}
      const harvest=e.message.match(/a récolté (\d+) (baies|riz|pommes de terre|maïs)/);
      if(harvest){ledger.harvested+=Number(harvest[1]);if(player.milestones.springReturn!==undefined&&harvest[2]!=='baies')player.springHarvested+=Number(harvest[1]);}
      if(e.message.includes('a cuisiné 1 repas simple'))ledger.cooked++;
    }
    observeEnvironment(w,player);
    if(Object.keys(player.milestones).join(',')!==beforeMilestones){observe();continuation();writeTestFileSync('tmp/environment-phase-v87.json',JSON.stringify(checkpoint()));console.info(`Environnement J${(w.tick/6000).toFixed(3)} : ${Object.keys(player.milestones).join(', ')}.`);}
    if(w.tick%6000===0){observe();continuation();const data=JSON.stringify(checkpoint());writeTestFileSync('tmp/environment-latest-v87.json',data);writeTestFileSync(`tmp/environment-day${w.tick/6000}-v87.json`,data);console.info(`Environnement J${w.tick/6000} : ${observations.at(-1)!.date.season}, ${observations.at(-1)!.outside.toFixed(1)} °C, ${ledger.cooked} repas produits, ${player.winterMeals} ingestions en hiver, ${player.springHarvested} récoltés depuis le printemps.`);}
    if(player.milestones.springReturn!==undefined&&player.springHarvested>0&&['heatedHome','winterHeating','windSupply','nightBattery','winterGrowthSlowed'].every(k=>player.milestones[k]!==undefined)&&player.winterMeals>0)break;
  }
  observe();continuation();const final=environmentSummary(w,player),report={protocol:'environment-v87',fixtureHash,resumed:!!resumed,fromTick:resumed?JSON.parse(resumed.world).tick:player.startTick,runtimeMs:performance.now()-started,initial,woodLedger,repairLedger,ledger,player,journal,observations,final};
  if(until!==undefined){writeTestFileSync('artifacts/environment-diagnostic-v87.json',JSON.stringify(report));writeTestFileSync('tmp/environment-diagnostic-v87.json',JSON.stringify(checkpoint()));return;}
  writeTestFileSync('artifacts/environment-colony-v87.json',JSON.stringify(report));writeTestFileSync('tmp/environment-final-v87.json',serializeWorld(w));writeTestFileSync('tmp/environment-final-checkpoint-v87.json',JSON.stringify(checkpoint()));
  for(const name of ['winter','winterGrowthSlowed','heatedHome','winterHeating','windSupply','nightBattery','springReturn'])expect(player.milestones[name],context()).toBeGreaterThanOrEqual(player.startTick);
  expect(player.winterMeals,context()).toBeGreaterThan(0);expect(player.springHarvested,context()).toBeGreaterThan(0);expect(ledger.cooked,context()).toBeGreaterThan(0);
  expect(w.pawns.filter(p=>player.initialPeople.includes(p.id)).every(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed'&&p.hunger>0&&p.rest>0),context()).toBe(true);
  expect(journal.some(d=>d.command.type==='climate-adopt'),context()).toBe(true);
  expect(journal.some(d=>d.command.type==='wind-auto-cut'&&d.command.enabled),context()).toBe(true);
}

// Central scheduling explicitly enables this one common long campaign only
// after grouped contracts and native checks; ordinary test runs stay bounded.
test.skipIf(process.env.ENVIRONMENT_JOURNEY!=='1')('Environnement : colonie V86, énergie, réserves, hiver naturel et retour des récoltes',runEnvironmentJourney,3_600_000);
