import {type BuildableFixtureKind} from './helpers/legacy-fixture-guards.ts';
import { writeTestFileSync } from './test-output.ts';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect,onTestFailed,test } from 'vitest';
import { isColonist } from '../src/sim/affiliation.ts';
import { CASSANDRA_ACTIVE_TICKS,CASSANDRA_CYCLE_START,CASSANDRA_CYCLE_TICKS } from '../src/sim/cassandra-raids.ts';
import { canDesignate } from '../src/sim/engine.ts';
import { groundCapacity } from '../src/sim/ground-placement.ts';
import { addGroundMaterial } from '../src/sim/materials.ts';
import { COMPLEX_FURNITURE_RESEARCH_COST,complexFurnitureUnlocked } from '../src/sim/research.ts';
import { applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld } from '../src/sim/index.ts';
import { SCHEMA_VERSION,TICKS_PER_DAY,type Cell,type Command,type DesignateCommand,type StructureKind,type World } from '../src/sim/types.ts';

const fixtureBytes=gunzipSync(readFileSync(new URL('./fixtures/colony-v89.json.gz',import.meta.url)));
const load=()=>deserializeWorld(fixtureBytes.toString('utf8'));
const accept=(world:World,command:Command)=>expect(applyCommand(world,command),JSON.stringify(command)).toMatchObject({ok:true});
const living=(world:World)=>world.pawns.filter(p=>isColonist(p)&&p.state!=='dead');

function site(world:World,kind:BuildableFixtureKind,material:'wood'|'steel',anchor:Cell):Cell {
  for(let radius=2;radius<=24;radius++)for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
    const command:DesignateCommand={type:'designate',kind,material,x:anchor.x+dx,z:anchor.z+dz,orientation:0};
    if(canDesignate(world,command).ok)return {x:command.x,z:command.z};
  }
  throw Error(`No physical site for ${kind}.`);
}

test('V89 colony migration: habitat and tailoring survive two days, then the replacement is physically worn',()=>{
  const raw=JSON.parse(fixtureBytes.toString('utf8')) as World;
  expect(raw.schemaVersion).toBe(89);
  let world=load();const start=world.tick,initialLiving=living(world).map(p=>p.id),initialCleaned=world.filth!.cleaned;
  onTestFailed(()=>writeTestFileSync('tmp/habitat-apparel-colony-failed.json',JSON.stringify(world)));
  expect(world.schemaVersion).toBe(SCHEMA_VERSION);expect(world.scenario).toMatchObject({id:'crashlanded',revision:2});expect(complexFurnitureUnlocked(world)).toBe(false);
  expect(validateWorld(world)).toEqual([]);
  const horizon=start+2*TICKS_PER_DAY;
  const agenda=world.raids!.cassandra!;
  const afterCampaign=CASSANDRA_CYCLE_START+agenda.cycle*CASSANDRA_CYCLE_TICKS+CASSANDRA_ACTIVE_TICKS;
  const policyDeadline=Math.min(horizon+TICKS_PER_DAY,afterCampaign-100);
  expect(policyDeadline).toBeGreaterThan(horizon);
  // This campaign amortizes habitat, tailoring, policy, hygiene and persistence.
  // Keep the already-covered dangerous incident on its own controlled frontier.
  world.raids!.nextCheck=afterCampaign;world.raids!.cassandra!.pending=[afterCampaign];

  const researcher=world.pawns.find(p=>p.name==='Ada')!,builder=world.pawns.find(p=>p.name==='Noé')!,tailor=world.pawns.find(p=>p.name==='Assaillant 9.2')!,wearer=world.pawns.find(p=>p.name==='Mina')!;
  const initialShirtIds=new Set(world.piles.filter(p=>p.item==='cloth-shirt').map(p=>p.id));
  const initialTailoringCompleted=world.tailoring?.completed??0;
  accept(world,{type:'priority',pawnId:researcher.id,work:'research',value:1});
  for(const work of ['hunt','mine','gather','build','haul','grow','cook','craft','basic','warden','clean'] as const)accept(world,{type:'priority',pawnId:researcher.id,work,value:0});
  accept(world,{type:'priority',pawnId:builder.id,work:'build',value:1});
  accept(world,{type:'priority',pawnId:tailor.id,work:'craft',value:1});accept(world,{type:'priority',pawnId:tailor.id,work:'clean',value:2});
  for(const work of ['warden','basic','hunt','research','mine','gather','build','haul','grow','cook'] as const)accept(world,{type:'priority',pawnId:tailor.id,work,value:0});
  accept(world,{type:'research-project',project:'complex-furniture'});
  world.research!.complexFurniture!.points=COMPLEX_FURNITURE_RESEARCH_COST-2_000_000;

  const storage=world.stockpiles.find(s=>groundCapacity(world,s,'cloth')>=60)!;expect(storage).toBeDefined();
  // A dedicated textile and apparel storage: other things (weapons, food…)
  // would rightly be hauled to it as their best storage and fill its cells.
  accept(world,{type:'stockpile',enabled:true,x:storage.x,z:storage.z,filters:{...(Object.fromEntries(Object.keys(storage.filters).map(k=>[k,false])) as typeof storage.filters),textile:true,unfinished:true,apparel:true},priority:4,capacity:75});
  addGroundMaterial(world,'textile',60,storage,'cloth');
  // One empty apparel-only cell next to it: the other storage cells hold one
  // stack each, and hauling fills them with whatever is closest to haulers.
  let apparelCell:Cell|undefined;
  for(let r=1;r<=8&&!apparelCell;r++)for(let dz=-r;dz<=r&&!apparelCell;dz++)for(let dx=-r;dx<=r&&!apparelCell;dx++){
    const c={x:storage.x+dx,z:storage.z+dz};
    if(world.stockpiles.some(s=>s.x===c.x&&s.z===c.z)||world.piles.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z)||world.structures.some(s=>s.x===c.x&&s.z===c.z))continue;
    if(applyCommand(world,{type:'stockpile',enabled:true,x:c.x,z:c.z,filters:{...(Object.fromEntries(Object.keys(storage.filters).map(k=>[k,false])) as typeof storage.filters),apparel:true},priority:4,capacity:75}).ok)apparelCell=c;
  }
  expect(apparelCell).toBeDefined();
  const maintainedIndex=world.apparelPolicies!.findIndex(p=>p.id===2),maintained={...world.apparelPolicies![maintainedIndex]!,minHitPointsPercent:.9};world.apparelPolicies![maintainedIndex]=maintained;
  const oldShirtId=world.piles.find(p=>p.owner.type==='apparel'&&p.owner.pawnId===wearer.id&&p.item==='cloth-shirt')!.id;
  accept(world,{type:'apparel-policy-assign',pawnId:wearer.id,policyId:maintained.id,automatic:true});

  const anchor={x:119,z:110},benchCell=site(world,'electric-tailor-bench','wood',anchor);
  accept(world,{type:'designate',kind:'electric-tailor-bench',material:'wood',...benchCell,orientation:0});
  let chairCell:Cell|undefined,benchId:number|undefined,producedShirtId:number|undefined,billAdded=false,productionStopped=false,checkpoint=false,cleaningEnabled=false,minimumLiving=initialLiving.length;
  while(world.tick<horizon){
    if(complexFurnitureUnlocked(world)&&!chairCell){chairCell=site(world,'dining-chair','wood',anchor);accept(world,{type:'designate',kind:'dining-chair',material:'wood',...chairCell,orientation:0});}
    const bench=world.structures.find(s=>s.kind==='electric-tailor-bench');
    if(bench&&!billAdded){benchId=bench.id;accept(world,{type:'bill-add',structureId:bench.id,recipe:'shirt'});const bill=bench.bills![0]!;accept(world,{type:'bill-update',structureId:bench.id,billId:bill.id,settings:{...bill,filters:{...bill.filters,cloth:true,'light-leather':false},destination:'stockpile'}});billAdded=true;}
    if(bench&&billAdded&&!productionStopped&&(world.tailoring?.completed??0)>initialTailoringCompleted){
      const produced=world.piles.filter(p=>p.item==='cloth-shirt'&&!initialShirtIds.has(p.id));
      expect(produced).toHaveLength(1);producedShirtId=produced[0]!.id;
      // Stop production only once the tailor has put the shirt down: disabling
      // his work while he carries it to storage drops it on the spot, as in
      // RimWorld, and it then waits for an ordinary hauler.
      if(produced[0]!.owner.type==='pawn'){stepWorld(world,50);continue;}
      const bill=bench.bills![0]!;accept(world,{type:'bill-update',structureId:bench.id,billId:bill.id,settings:{...bill,suspended:true}});accept(world,{type:'priority',pawnId:tailor.id,work:'craft',value:0});accept(world,{type:'priority',pawnId:tailor.id,work:'clean',value:1});productionStopped=true;
    }
    if(!cleaningEnabled&&chairCell&&world.structures.some(s=>s.kind==='dining-chair'&&s.x===chairCell!.x&&s.z===chairCell!.z)&&world.structures.some(s=>s.kind==='electric-tailor-bench')){accept(world,{type:'priority',pawnId:builder.id,work:'build',value:0});accept(world,{type:'priority',pawnId:builder.id,work:'clean',value:1});cleaningEnabled=true;}
    stepWorld(world,50);minimumLiving=Math.min(minimumLiving,living(world).length);
    if(!checkpoint&&world.piles.some(p=>p.unfinished?.recipe==='shirt'&&p.unfinished.progress>0)){
      const saved=serializeWorld(world),copy=deserializeWorld(saved);stepWorld(world,30);stepWorld(copy,30);
      expect(serializeWorld(copy)).toBe(serializeWorld(world));world=deserializeWorld(saved);checkpoint=true;
    }
    if((world.tick-start)%600===0)expect(validateWorld(world),`tick ${world.tick}`).toEqual([]);
  }

  expect(world.tick).toBe(horizon);
  expect(producedShirtId).toBeDefined();
  const equippedReplacement=()=>world.piles.find(p=>p.id===producedShirtId&&p.item==='cloth-shirt'&&p.owner.type==='apparel'&&p.owner.pawnId===wearer.id);
  // A finished shirt must first reach an accepting stockpile. The periodic
  // apparel check may fall just before that delivery, so allow one further
  // day for the autonomous, physical pickup rather than declaring success at
  // the two-day observation boundary with a bare pawn.
  while(!equippedReplacement()&&world.tick<policyDeadline){stepWorld(world,Math.min(50,policyDeadline-world.tick));minimumLiving=Math.min(minimumLiving,living(world).length);}
  const chair=world.structures.find(s=>s.kind==='dining-chair'&&chairCell&&s.x===chairCell.x&&s.z===chairCell.z);
  const replacement=equippedReplacement(),oldShirt=world.piles.find(p=>p.id===oldShirtId)!;
  expect(complexFurnitureUnlocked(world)).toBe(true);expect(world.research!.complexFurniture!.completedAt).toBeGreaterThan(start);expect(chair?.quality).toBeDefined();
  expect(benchId,JSON.stringify({tick:world.tick,jobs:world.jobs.filter(j=>j.kind==='electric-tailor-bench'),structures:world.structures.filter(s=>s.kind==='electric-tailor-bench'),pawns:living(world).map(p=>({name:p.name,state:p.state,jobId:p.jobId,haul:p.haul}))})).toBeDefined();expect(world.tailoring?.completed).toBeGreaterThanOrEqual(1);expect(replacement,'The maintained policy must equip the new shirt.').toBeDefined();expect(replacement?.apparel?.forced).toBeUndefined();expect(oldShirt.owner.type).toBe('ground');
  expect(checkpoint).toBe(true);expect(productionStopped).toBe(true);expect(world.tick).toBeLessThanOrEqual(policyDeadline);expect(minimumLiving).toBe(initialLiving.length);expect(living(world).map(p=>p.id).sort((a,b)=>a-b)).toEqual([...initialLiving].sort((a,b)=>a-b));
  expect(cleaningEnabled).toBe(true);expect(world.filth!.cleaned).toBeGreaterThan(initialCleaned);
  expect(living(world).every(p=>p.state!=='downed'&&p.hunger>0&&p.rest>0)).toBe(true);
  expect(validateWorld(world)).toEqual([]);expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  // Keep the original V90 proof immutable; this is a fresh current-schema run.
  writeTestFileSync('tmp/habitat-apparel-colony-current.json',JSON.stringify({schemaVersion:SCHEMA_VERSION,controlled:true,source:'tests/fixtures/colony-v89.json.gz',interventions:['60 cloth supplied','complex-furniture research prefilled except last 2 points','raids deferred beyond observation','maintained apparel threshold 90%'],startTick:start,endTick:world.tick,days:(world.tick-start)/TICKS_PER_DAY,minimumLiving,chair,benchId,tailored:world.tailoring?.completed,replacementId:replacement!.id,oldShirtId,cleaned:world.filth!.cleaned-initialCleaned,unfinishedContinuationExact:checkpoint,valid:true},null,2));
},180_000);
