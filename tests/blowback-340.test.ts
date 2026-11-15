import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {rangedWeaponProfile,rangedTimings} from '../src/sim/ranged-statistics.ts';
import {WEAPON_QUALITIES,isRangedWeaponItem,weaponMaxHitPoints} from '../src/sim/equipment-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {GUN_REQUIREMENTS,PRODUCTION_RECIPES,stationRecipes} from '../src/sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {generateVisitorStock,VISITOR_RANGED_POOL,VISITOR_RANGED_ITEMS340} from '../src/sim/trade-stock.ts';
import {generateCaravanStock332} from '../src/sim/trader-caravans-332.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {validWeaponShape} from '../src/sim/equipment-save.ts';
import {validatePileRecordShape} from '../src/sim/material-record-save.ts';
import {validShootingShape} from '../src/sim/shooting-save.ts';
import {validBlowbackResearchTransport340,validateResearch} from '../src/sim/research-save.ts';
import {GUN_TURRETS_RESEARCH_COST,GUNSMITHING_RESEARCH_COST,MACHINING_RESEARCH_COST,SMITHING_RESEARCH_COST,RESEARCH_SCALE,researchCost,researchPrerequisite,researchUnlocked,needsHighTechBench,needsResearchAnalyzer,selectResearch} from '../src/sim/research.ts';
import {productionResearchUnlocked} from '../src/sim/machining.ts';
import {meleeTools} from '../src/sim/melee-statistics.ts';
import {raidRoleWeapon} from '../src/sim/raid-spawn.ts';
import {BLOWBACK_FACTS_340,CORE_GUN_CANDIDATES_340,GUN_KIND_MONEY_340,gunKindWeapon340} from '../src/sim/blowback-340.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {applyMeleeStun} from '../src/sim/stun.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {firingCamp} from './scenarios/shooting.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {advanceUntil} from './scenarios/machining-v101.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {newPowerState} from '../src/sim/power-rules.ts';
import {newBuildingFuel} from '../src/sim/fuel.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const guns=['autopistol','machine-pistol'] as const;
const BLOWBACK=500*RESEARCH_SCALE;
/** Declared 32² workshop: one crafter-researcher, a simple research desk, a
 * fuelled generator powering a built machining table, 90 steel and 5
 * components. Smithing, Machining and Gunsmithing are known at the start. */
function workshop(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.research=1;pawn.priorities.craft=1;pawn.priorities.basic=3;pawn.schedule.fill('work');
  pawn.skills.intellectual={level:12,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:10,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:0,smithing:{points:SMITHING_RESEARCH_COST,completedAt:0},machining:{points:MACHINING_RESEARCH_COST,completedAt:0},gunsmithing:{points:GUNSMITHING_RESEARCH_COST,completedAt:0}};
  w.structures.push({id:w.nextId++,kind:'research-bench',x:6,z:8,orientation:0,footprint:'standard',material:'wood'} as Structure);
  w.structures.push({id:w.nextId++,kind:'wood-generator',x:12,z:8,orientation:0,footprint:'standard',material:'steel',power:newPowerState('wood-generator'),fuel:{...newBuildingFuel('wood-generator'),ticks:45_000,autoRefuel:false}} as Structure);
  const station={id:w.nextId++,kind:'machining-table',x:15,z:8,orientation:0,footprint:'standard',material:'steel',power:newPowerState('machining-table'),bills:[]} as Structure;
  w.structures.push(station);
  addGroundMaterial(w,'steel',90,{x:5,z:13},'steel');addGroundMaterial(w,'component',5,{x:7,z:13},'component');refreshStock(w);
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(w)).toEqual([]);
  return {world:w,pawn,station};
}
/** Declared prepared research: BlowbackOperation done at the fixture start. */
const withBlowback=(w:World)=>{w.research!.blowbackOperation={points:BLOWBACK,completedAt:w.tick};return w;};

test('the autopistol and the machine pistol have the Core recipes, values and ranged statistics',()=>{
  for(const gun of guns){expect(ITEM_DEFINITIONS[gun]).toMatchObject({kind:'weapon',stackLimit:1});expect(isRangedWeaponItem(gun)).toBe(true);expect(weaponMaxHitPoints(gun)).toBe(100);}
  expect(ITEM_DEFINITIONS.autopistol.label).toBe('Pistolet automatique');expect(ITEM_DEFINITIONS['machine-pistol'].label).toBe('Pistolet-mitrailleur');
  const auto=rangedWeaponProfile('autopistol','normal')!,mp=rangedWeaponProfile('machine-pistol','normal')!;
  // Gun_Autopistol: single shot, Bullet_Autopistol 10 damage, default stopping power.
  expect(auto).toMatchObject({damage:10,range:25.9,warmupCoreTicks:18,cooldownCoreTicks:60,projectileTilesPerCoreTick:.55,stoppingPower:.5});
  expect(auto.burst).toBeUndefined();expect(auto.armorPenetration).toBeCloseTo(.15,12);expect(auto.accuracy).toEqual([.80,.70,.40,.30]);
  // Gun_MachinePistol: three shots 7 ticks apart after a 0.5 s warmup, 0.9 s cooldown.
  expect(mp).toMatchObject({damage:6,range:19.9,warmupCoreTicks:30,cooldownCoreTicks:54,projectileTilesPerCoreTick:.55,stoppingPower:.5,burst:{shots:3,ticksBetween:7}});
  expect(mp.armorPenetration).toBeCloseTo(.09,12);expect(mp.accuracy).toEqual([.90,.65,.35,.15]);
  expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile('autopistol',q)!.damage)).toEqual([9,10,10,10,10,12,15]);
  expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile('machine-pistol',q)!.damage)).toEqual([5,6,6,6,6,8,9]);
  // Core AdjustedFullCycleTime: warmup + cooldown + (3-1) x 7 ticks.
  expect(rangedTimings(mp).learningCycleSeconds).toBeCloseTo((30+54+14)/60,12);
  expect(rangedTimings(auto).learningCycleSeconds).toBeCloseTo((18+60)/60,12);
  expect(GUN_REQUIREMENTS['make-autopistol']).toEqual({steel:30,component:2,skill:4});
  expect(GUN_REQUIREMENTS['make-machine-pistol']).toEqual({steel:45,component:3,skill:4});
  expect(PRODUCTION_RECIPES['make-autopistol']).toMatchObject({station:'machining-table',work:'craft',units:32,workTicks:500});
  expect(PRODUCTION_RECIPES['make-machine-pistol']).toMatchObject({station:'machining-table',work:'craft',units:48,workTicks:1100});
  expect(stationRecipes({kind:'machining-table'})).toEqual(expect.arrayContaining(['make-autopistol','make-machine-pistol']));
  expect(stationRecipes({kind:'crafting-spot'})).not.toContain('make-autopistol');
  expect(tradeCatalogueEntry('autopistol')!.baseMarketValue).toBeCloseTo(30*1.9+2*32+5000*.0036,9);
  expect(tradeCatalogueEntry('machine-pistol')!.baseMarketValue).toBeCloseTo(45*1.9+3*32+11000*.0036,9);
  expect([BLOWBACK_FACTS_340.autopistol.massGrams,BLOWBACK_FACTS_340['machine-pistol'].massGrams]).toEqual([1200,2500]);
  // Grip (Blunt 9) and barrel (Blunt and Poke 9), as the revolver.
  const w=firingCamp(),pawn=w.pawns[0]!;w.piles=[];addMaterial(w,'weapon',1,{type:'equipment',pawnId:pawn.id},'machine-pistol');
  expect(meleeTools(w,pawn).filter(t=>['grip','barrel','barrel-poke'].includes(t.id)).map(t=>[t.id,t.kind,t.damage]).sort()).toEqual([['barrel','blunt',9],['barrel-poke','poke',9],['grip','blunt',9]]);
});

test('BlowbackOperation follows Gunsmithing on the simple desk; from 340 it is the gun turrets prerequisite',()=>{
  const {world:w,pawn}=workshop();pawn.priorities.craft=0;
  expect(researchCost('blowback-operation')).toBe(BLOWBACK);expect(needsHighTechBench('blowback-operation')).toBe(false);expect(needsResearchAnalyzer('blowback-operation')).toBe(false);
  expect(researchPrerequisite(w,'blowback-operation')).toBeUndefined();
  expect(researchPrerequisite(w,'gun-turrets')).toBe('Culasse non calée');
  for(const recipe of ['make-autopistol','make-machine-pistol'] as const)expect(productionResearchUnlocked(w,recipe)).toBe(false);
  // The old rule below 340: Gunsmithing alone opened the turrets.
  const old=structuredClone(w);old.schemaVersion=339 as World['schemaVersion'];
  expect(researchPrerequisite(old,'gun-turrets')).toBeUndefined();
  expect(selectResearch(old,'blowback-operation').ok).toBe(false);expect(old.research?.blowbackOperation).toBeUndefined();
  const noGunsmithing=structuredClone(w);delete noGunsmithing.research!.gunsmithing;
  expect(researchPrerequisite(noGunsmithing,'blowback-operation')).toBe('Armurerie');
  expect(applyCommand(noGunsmithing,{type:'research-project',project:'blowback-operation'}).ok).toBe(false);
  // Refusals are atomic.
  const before=serializeWorld(w);
  const turret=applyCommand(w,{type:'research-project',project:'gun-turrets'});
  expect(turret.ok).toBe(false);if(!turret.ok)expect(turret.reason).toContain('Culasse non calée');
  expect(serializeWorld(w)).toBe(before);
  accept(w,{type:'research-project',project:'blowback-operation'});expect(w.research!.blowbackOperation).toEqual({points:0});
  advanceUntil(w,()=>(w.research!.blowbackOperation!.points)>0,400);expect(pawn.research).toBeDefined();expect(validateWorld(w)).toEqual([]);
  // Declared shortcut to the last points, then real desk work to completion.
  w.research!.blowbackOperation!.points=BLOWBACK-1;
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  advanceUntil(w,()=>researchUnlocked(w,'blowback-operation'),800);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(w.research!.blowbackOperation).toEqual({points:BLOWBACK,completedAt:w.research!.blowbackOperation!.completedAt});
  expect(w.research!.blowbackOperation!.completedAt).toBeGreaterThanOrEqual(w.research!.gunsmithing!.completedAt!);
  for(const recipe of ['make-autopistol','make-machine-pistol'] as const)expect(productionResearchUnlocked(w,recipe)).toBe(true);
  expect(researchPrerequisite(w,'gun-turrets')).toBeUndefined();
  expect(applyCommand(w,{type:'research-project',project:'blowback-operation'}).ok).toBe(false);
  accept(w,{type:'research-project',project:'gun-turrets'});
  expect(validateWorld(w)).toEqual([]);
});

test('a save whose turrets were researched or begun under Gunsmithing alone keeps them from 340; nothing is granted',()=>{
  const {world:w}=workshop();
  w.research!.gunTurrets={points:GUN_TURRETS_RESEARCH_COST,completedAt:w.tick};
  const done=deserializeWorld(asOldSchema(serializeWorld(w),339));
  expect(done.schemaVersion).toBe(SCHEMA_VERSION);expect(researchUnlocked(done,'gun-turrets')).toBe(true);
  expect(done.research!.blowbackOperation).toBeUndefined();expect(researchUnlocked(done,'blowback-operation')).toBe(false);
  expect(validateWorld(done)).toEqual([]);
  // A turret project in progress stays selected and keeps its points.
  const {world:begun}=workshop();
  begun.research!.project='gun-turrets';begun.research!.gunTurrets={points:12*RESEARCH_SCALE};
  const kept=deserializeWorld(asOldSchema(serializeWorld(begun),339));
  expect(kept.research!.project).toBe('gun-turrets');expect(kept.research!.gunTurrets).toEqual({points:12*RESEARCH_SCALE});
  expect(validateWorld(kept)).toEqual([]);
  // Turrets still need Gunsmithing in any save.
  const orphan=structuredClone(done);delete orphan.research!.gunsmithing;
  expect(validateResearch(orphan,SCHEMA_VERSION)).not.toEqual([]);
});

test('a crafter makes both guns at the powered machining table from their exact steel and components; the work resumes exactly',()=>{
  const {world:w,pawn,station}=workshop();withBlowback(w);pawn.priorities.research=0;
  expect([quantity(w,'steel'),quantity(w,'component')]).toEqual([90,5]);
  advanceUntil(w,()=>station.power?.on===true,100);
  accept(w,{type:'bill-add',structureId:station.id,recipe:'make-autopistol'});
  accept(w,{type:'bill-add',structureId:station.id,recipe:'make-machine-pistol'});
  for(const bill of station.bills!)accept(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:{...bill,destination:'drop'}});
  advanceUntil(w,()=>w.piles.some(p=>p.gunWork?.recipe==='make-autopistol'&&p.gunWork.progress>0),1500);
  const work=w.piles.find(p=>p.gunWork)!.gunWork!;
  expect(work).toMatchObject({recipe:'make-autopistol',authorId:pawn.id});expect(work.parts.reduce((n,p)=>n+p.quantity,0)).toBe(32);
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  advanceUntil(w,()=>w.piles.some(p=>p.item==='autopistol'),3000);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  advanceUntil(w,()=>w.piles.some(p=>p.item==='machine-pistol'),4000,step=>{if(step%200===0)expect(validateWorld(w)).toEqual([]);});
  expect(w.piles.some(p=>p.item==='unfinished-gun')).toBe(false);
  // 75 steel and 5 components were used: 15 steel remain, no component.
  expect([quantity(w,'steel'),quantity(w,'component')]).toEqual([15,0]);
  for(const gun of guns){const made=w.piles.find(p=>p.item===gun)!;expect(made.kind).toBe('weapon');expect(made.weapon?.hitPoints).toBe(100);expect(WEAPON_QUALITIES).toContain(made.weapon?.quality);}
  const mp=w.piles.find(p=>p.item==='machine-pistol')!;
  advanceUntil(w,()=>mp.owner.type==='ground',200);
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:mp.id,action:'equip',queue:false});
  advanceUntil(w,()=>mp.owner.type==='equipment',300);expect(validateWorld(w)).toEqual([]);
});

/** Shooter 10 cells from a drafted target in an open 32² camp. */
function armed(gun:'autopistol'|'machine-pistol'){
  const w=firingCamp(),shooter=w.pawns[0]!,target=w.pawns[1]!;w.piles=[];
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:shooter.id},gun);
  expect(validateWorld(w)).toEqual([]);
  return {w,shooter,target};
}
const emissions=(w:World,gun:string,seen:Map<number,number>)=>{for(const p of w.projectiles??[])if(p.weaponItem===gun)seen.set(p.id,p.emittedAtCore);};

test('an autopistol fires one bullet after an 18-tick warmup, then cools down 60 ticks',()=>{
  const {w,shooter,target}=armed('autopistol'),start=effectiveCore297(w);
  accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  expect(shooter.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:start+18,weaponItem:'autopistol'});
  const seen=new Map<number,number>();let cooldown=false;
  for(let i=0;i<12;i++){stepWorld(w);emissions(w,'autopistol',seen);
    const s=shooter.shooting?.stance;
    if(!cooldown&&s?.phase==='cooldown'){cooldown=true;expect(s.burst).toBeUndefined();expect(s.startedAtCore).toBe(start+18);expect(s.endsAtCore-s.startedAtCore-(s.clock?.pausedCore??0)).toBe(60);}
  }
  expect(cooldown).toBe(true);
  // Shots at 18 and 18 + 60 + 18 Core ticks: one bullet per cycle.
  expect([...seen.values()].sort((a,b)=>a-b).slice(0,2)).toEqual([start+18,start+96]);
  expect(validateWorld(w)).toEqual([]);
});

test('a machine pistol fires a three-shot burst after one warmup, 6 then 7 ticks apart, then cools down; a save mid-burst resumes exactly',()=>{
  const {w,shooter,target}=armed('machine-pistol'),start=effectiveCore297(w),xp=shooter.skills.shooting.xp;
  accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  expect(shooter.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:start+30,weaponItem:'machine-pistol'});
  const seen=new Map<number,number>(),T=start+30;
  advanceUntil(w,()=>shooter.shooting?.stance?.phase==='cooldown',10);emissions(w,'machine-pistol',seen);
  // Between shots: the Core gap stance (ticksBetweenBurstShots + 1) aimed at the burst's own target.
  const gap=shooter.shooting!.stance!;
  expect(gap.phase==='cooldown'&&gap.burst).toBeTruthy();
  if(gap.phase!=='cooldown'||!gap.burst)throw Error('no burst');
  expect(gap.burst.targetId).toBe(target.id);expect(gap.burst.shotsLeft).toBeGreaterThan(0);
  expect(gap.endsAtCore-gap.startedAtCore).toBe(8);
  // One learning for the whole burst, over its full Core cycle.
  expect(shooter.skills.shooting.xp).toBeGreaterThan(xp);const learned=shooter.skills.shooting.xp;
  expect(validateWorld(w)).toEqual([]);
  const copy=deserializeWorld(serializeWorld(w));expect(serializeWorld(copy)).toBe(serializeWorld(w));
  for(let i=0;i<4;i++){stepWorld(w);stepWorld(copy);emissions(w,'machine-pistol',seen);}
  expect(serializeWorld(copy)).toBe(serializeWorld(w));
  const cores=[...seen.values()].sort((a,b)=>a-b);
  expect(cores.slice(0,3)).toEqual([T,T+6,T+13]);
  expect(cores.filter(c=>c<T+60)).toHaveLength(3);
  expect(shooter.skills.shooting.xp).toBe(learned);
  // After the third shot: the weapon cooldown, from that shot.
  const after=shooter.shooting!.stance!;
  expect(after).toMatchObject({phase:'cooldown',startedAtCore:T+13,weaponItem:'machine-pistol'});
  expect(after.phase==='cooldown'&&after.burst).toBeFalsy();
  expect(after.endsAtCore-after.startedAtCore-(after.clock?.pausedCore??0)).toBe(54);
  expect(shooter.lastAttack).toEqual({targetId:target.id,atCore:T+13});
  // The next burst starts after the cooldown and a new warmup.
  for(let i=0;i<10;i++){stepWorld(w);emissions(w,'machine-pistol',seen);}
  expect([...seen.values()].sort((a,b)=>a-b).slice(3,6)).toEqual([T+97,T+103,T+110]);
  expect(validateWorld(w)).toEqual([]);
});

test('a burst stops when its target leaves the range; the weapon cooldown then starts at that tick',()=>{
  const {w,shooter,target}=armed('machine-pistol'),start=effectiveCore297(w),T=start+30;
  accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  advanceUntil(w,()=>shooter.shooting?.stance?.phase==='cooldown',10);
  const gap=shooter.shooting!.stance!;if(gap.phase!=='cooldown'||!gap.burst)throw Error('no burst');
  const left=gap.burst.shotsLeft,fired=3-left,next=fired===1?T+6:T+13;
  // Declared test move: the target is set 22 cells away, beyond 19.9.
  target.x=shooter.x+22;
  const seen=new Map<number,number>();emissions(w,'machine-pistol',seen);const before=seen.size;
  for(let i=0;i<2;i++){stepWorld(w);emissions(w,'machine-pistol',seen);}
  expect(seen.size).toBe(before);
  expect(shooter.shooting?.stance).toMatchObject({phase:'cooldown',startedAtCore:next,endsAtCore:next+54});
});

test('a stun during a burst resets it; only the gap stance runs out, paused by the stun',()=>{
  const {w,shooter,target}=armed('machine-pistol');
  accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  advanceUntil(w,()=>shooter.shooting?.stance?.phase==='cooldown',10);
  const core=effectiveCore297(w),gap=shooter.shooting!.stance!;if(gap.phase!=='cooldown'||!gap.burst)throw Error('no burst');
  const ends=gap.endsAtCore;
  // A real melee stun (120 Core ticks) lands between two shots.
  applyMeleeStun(w,shooter,core);expect(validateWorld(w)).toEqual([]);
  const seen=new Map<number,number>();emissions(w,'machine-pistol',seen);const before=seen.size;
  stepWorld(w);emissions(w,'machine-pistol',seen);
  expect(seen.size).toBe(before);
  const s=shooter.shooting!.stance!;
  expect(s.phase).toBe('cooldown');if(s.phase!=='cooldown')return;
  expect(s.burst?.shotsLeft).toBe(0);expect(s.endsAtCore).toBeGreaterThan(ends);
  for(let i=0;i<4;i++){stepWorld(w);emissions(w,'machine-pistol',seen);}
  expect(seen.size).toBe(before);
});

test('visitors and caravan traders may sell both guns from schema 340, with the same random draws',()=>{
  expect(VISITOR_RANGED_POOL[1]!.value).toBe(139);expect(VISITOR_RANGED_POOL[2]!.value).toBe(220);
  expect(VISITOR_RANGED_ITEMS340).toEqual({1:'autopistol',2:'machine-pistol'});
  const sold={autopistol:0,'machine-pistol':0};
  for(let n=1;n<=4000;n++){
    const seed=Math.imul(n,1013904223)>>>0,now=generateVisitorStock(seed,100,101,700),old=generateVisitorStock(seed,100,101,700,339);
    expect(now.rng).toBe(old.rng);
    for(const p of old.piles)expect(now.piles).toContainEqual(expect.objectContaining({item:p.item,quantity:p.quantity}));
    for(const gun of guns)if(now.piles.some(p=>p.item===gun))sold[gun]++;
    expect(old.piles.some(p=>p.item==='autopistol'||p.item==='machine-pistol')).toBe(false);
  }
  expect(sold.autopistol).toBeGreaterThan(0);expect(sold['machine-pistol']).toBeGreaterThan(0);
  let caravan=0;
  for(let seed=1;seed<=60;seed++){
    const now=generateCaravanStock332(seed,100,101,0,'outlander-combat'),old=generateCaravanStock332(seed,100,101,0,'outlander-combat',339);
    expect(now.rng).toBe(old.rng);expect(old.piles.some(p=>p.item==='autopistol'||p.item==='machine-pistol')).toBe(false);
    if(now.piles.some(p=>p.item==='autopistol'||p.item==='machine-pistol'))caravan++;
  }
  expect(caravan).toBeGreaterThan(0);
});

test('from schema 340 the Gun kinds draw their gun as Core does; other kinds and older saves keep their weapon',()=>{
  const at=(schemaVersion:number)=>({schemaVersion,seed:12345}) as World;
  const counts=new Map<string,number>();
  for(let id=1;id<=3000;id++){
    for(const role of ['scavenger','pirate','town-guard','town-councilman','mercenary-gunner','villager','drifter','tribal-archer'] as const){
      const now=raidRoleWeapon(role,{world:at(340),pawnId:id}),old=raidRoleWeapon(role,{world:at(339),pawnId:id});
      expect(old).toBe(raidRoleWeapon(role));
      if(role==='villager'||role==='drifter'||role==='tribal-archer')expect(now).toBe(old);
      counts.set(`${role}:${now}`,(counts.get(`${role}:${now}`)??0)+1);
    }
  }
  // Town_Councilman (200 silver): revolver 135.4 or autopistol 139, by price.
  const councilAuto=counts.get('town-councilman:autopistol')!/3000;
  expect(councilAuto).toBeGreaterThan(.47);expect(councilAuto).toBeLessThan(.55);
  expect(counts.get('town-councilman:machine-pistol')).toBeUndefined();
  // Scavenger (200~300): every Core candidate is delivered, both new guns appear.
  for(const gun of guns)expect(counts.get(`scavenger:${gun}`)).toBeGreaterThan(0);
  for(const role of ['pirate','town-guard','mercenary-gunner'])expect(counts.get(`${role}:machine-pistol`)).toBeGreaterThan(0);
  // A Core gun Elsewhere lacks keeps the historical weapon (mercenary: shotgun).
  expect(gunKindWeapon340('Mercenary_Gunner','fixed',1,1)).toBeDefined();
  expect(CORE_GUN_CANDIDATES_340.filter(c=>c.price<=GUN_KIND_MONEY_340.Scavenger[1]).every(c=>c.item)).toBe(true);
  // Same person, same gun: the draw comes from the identity only.
  expect(raidRoleWeapon('pirate',{world:at(340),pawnId:77})).toBe(raidRoleWeapon('pirate',{world:at(345),pawnId:77}));
});

test('before schema 340 the guns, their recipes, bullets, stances, bursts and research are refused',()=>{
  for(const recipe of ['make-autopistol','make-machine-pistol'] as const){
    expect(validBillSettings(newCookingBill(1,recipe),recipe,340)).toBe(true);
    expect(validBillSettings(newCookingBill(1,recipe),recipe,339)).toBe(false);
    expect(validTuqueCatalogueTransport({bills:[{recipe}]},339)).toBe(false);
  }
  const w=firingCamp();
  for(const gun of guns){
    const pile={id:1,kind:'weapon',item:gun,quantity:1,owner:{type:'ground',x:1,z:1},weapon:{quality:'normal',hitPoints:100}};
    expect(validWeaponShape(pile,340)).toBe(true);expect(validWeaponShape(pile,339)).toBe(false);
    expect(validatePileRecordShape(pile,w,339)).toEqual(['Future autopistol or machine pistol catalogue.']);
    for(const v of [339,325,300])expect(validTuqueCatalogueTransport({piles:[{item:gun}]},v)).toBe(false);
    expect(validTuqueCatalogueTransport({projectiles:[{weaponItem:gun}]},339)).toBe(false);
    expect(validTuqueCatalogueTransport({stockpiles:[{filters:{items:{[gun]:true}}}]},339)).toBe(false);
    expect(validTuqueCatalogueTransport({piles:[{item:gun}]},340)).toBe(true);
  }
  // A real machine pistol aim, then its real burst gap, relabelled 339.
  const {w:m,shooter,target}=armed('machine-pistol');
  accept(m,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  expect(validShootingShape(shooter.shooting,340,m.tick,effectiveCore297(m))).toBe(true);
  expect(validShootingShape(shooter.shooting,339,m.tick,effectiveCore297(m))).toBe(false);
  advanceUntil(m,()=>shooter.shooting?.stance?.phase==='cooldown',10);
  const core=effectiveCore297(m),shooting=shooter.shooting!;
  expect(validShootingShape(shooting,340,m.tick,core)).toBe(true);
  expect(validShootingShape(shooting,339,m.tick,core)).toBe(false);
  // Strict burst shape: unknown keys, too many shots, a single-shot weapon.
  const stance=shooting.stance! as Extract<NonNullable<typeof shooting.stance>,{phase:'cooldown'}>;
  expect(validShootingShape({...shooting,stance:{...stance,burst:{...stance.burst!,extra:1}}},340,m.tick,core)).toBe(false);
  expect(validShootingShape({...shooting,stance:{...stance,burst:{...stance.burst!,shotsLeft:3}}},340,m.tick,core)).toBe(false);
  expect(validShootingShape({...shooting,stance:{...stance,weaponItem:'autopistol'}},340,m.tick,core)).toBe(false);
  expect(validShootingShape({...shooting,stance:{...stance,endsAtCore:stance.endsAtCore+1}},340,m.tick,core)).toBe(false);
  // Research record and selection: refused before 340, and needs Gunsmithing.
  const research=(r:World['research'],gunsmithing=true)=>({...firingCamp(),research:gunsmithing?{...r,gunsmithing:{points:GUNSMITHING_RESEARCH_COST,completedAt:0}}:r}) as World;
  const begun={project:null,points:0,blowbackOperation:{points:12}} as World['research'];
  expect(validBlowbackResearchTransport340(research(begun),340)).toBe(true);
  expect(validBlowbackResearchTransport340(research(begun),339)).toBe(false);
  expect(validBlowbackResearchTransport340(research(begun,false),340)).toBe(false);
  expect(validateResearch(research(begun),339)).not.toEqual([]);
  expect(validBlowbackResearchTransport340(research({project:'blowback-operation',points:0} as World['research']),340)).toBe(false);
  // A whole 339 save holding a machine pistol is refused, never migrated.
  const withGun=firingCamp();addMaterial(withGun,'weapon',1,{type:'ground',x:2,z:2},'machine-pistol');
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withGun),339))).toThrow();
});

test('a schema 339 save migrates to 340 by its number only',()=>{
  const current=serializeWorld(firingCamp());
  expect(serializeWorld(deserializeWorld(asOldSchema(current,339)))).toBe(current);
  const {world}=workshop();const save=serializeWorld(world);
  expect(serializeWorld(deserializeWorld(asOldSchema(save,339)))).toBe(save);
});
