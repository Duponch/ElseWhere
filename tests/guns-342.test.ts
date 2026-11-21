import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {rangedRound,rangedWeaponProfile,rangedTimings} from '../src/sim/ranged-statistics.ts';
import {WEAPON_QUALITIES,isRangedWeaponItem,weaponMaxHitPoints} from '../src/sim/equipment-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {GUN_REQUIREMENTS,PRODUCTION_RECIPES,PRODUCTION_WORK_SCALE,productionWorkTotal,stationRecipes} from '../src/sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {generateVisitorStock,VISITOR_RANGED_POOL,VISITOR_RANGED_ITEMS342} from '../src/sim/trade-stock.ts';
import {generateCaravanStock332} from '../src/sim/trader-caravans-332.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {validWeaponShape} from '../src/sim/equipment-save.ts';
import {validatePileRecordShape} from '../src/sim/material-record-save.ts';
import {validShootingShape} from '../src/sim/shooting-save.ts';
import {validGunsResearchTransport342,validateResearch} from '../src/sim/research-save.ts';
import {GUNSMITHING_RESEARCH_COST,MACHINING_RESEARCH_COST,MICROELECTRONICS_RESEARCH_COST,SMITHING_RESEARCH_COST,RESEARCH_SCALE,researchCost,researchPrerequisite,researchStationUsable,researchUnlocked,needsHighTechBench,needsResearchAnalyzer,selectResearch} from '../src/sim/research.ts';
import {productionResearchUnlocked} from '../src/sim/machining.ts';
import {meleeTools} from '../src/sim/melee-statistics.ts';
import {raidRoleWeapon} from '../src/sim/raid-spawn.ts';
import {smeltingYield} from '../src/sim/smelting-rules.ts';
import {gunKindWeapon340} from '../src/sim/blowback-340.ts';
import {CORE_GUN_CANDIDATES_342,GUNS_FACTS_342,GUNS_ITEMS_342,gunKindWeapon342,type Gun342} from '../src/sim/guns-342.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {assignPileOwner} from '../src/sim/pile-index.ts';
import {firingCamp} from './scenarios/shooting.ts';
import {asOldSchema,asNumberOnly} from './scenarios/old-schema.ts';
import {advanceUntil} from './scenarios/machining-v101.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {newPowerState} from '../src/sim/power-rules.ts';
import {newBuildingFuel} from '../src/sim/fuel.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const guns=GUNS_ITEMS_342;
const GAS=1000*RESEARCH_SCALE,RIFLING=1400*RESEARCH_SCALE,BLOWBACK=500*RESEARCH_SCALE;
/** Declared 32² workshop: one crafter-researcher, a simple research desk, a
 * fuelled generator powering a built machining table, 340 steel and 29
 * components. Smithing, Machining, Gunsmithing, BlowbackOperation and
 * Microelectronics are known at the start. With `hiTech`, a powered advanced
 * research desk stands next to the generator. */
function workshop(hiTech=false){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.research=1;pawn.priorities.craft=1;pawn.priorities.basic=3;pawn.schedule.fill('work');
  pawn.skills.intellectual={level:12,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:10,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:0,smithing:{points:SMITHING_RESEARCH_COST,completedAt:0},machining:{points:MACHINING_RESEARCH_COST,completedAt:0},gunsmithing:{points:GUNSMITHING_RESEARCH_COST,completedAt:0},
    blowbackOperation:{points:BLOWBACK,completedAt:0},microelectronics:{points:MICROELECTRONICS_RESEARCH_COST,completedAt:0}};
  w.structures.push({id:w.nextId++,kind:'research-bench',x:6,z:8,orientation:0,footprint:'standard',material:'wood'} as Structure);
  w.structures.push({id:w.nextId++,kind:'wood-generator',x:12,z:8,orientation:0,footprint:'standard',material:'steel',power:newPowerState('wood-generator'),fuel:{...newBuildingFuel('wood-generator'),ticks:45_000,autoRefuel:false}} as Structure);
  const station={id:w.nextId++,kind:'machining-table',x:15,z:8,orientation:0,footprint:'standard',material:'steel',power:newPowerState('machining-table'),bills:[]} as Structure;
  w.structures.push(station);
  const desk=hiTech?{id:w.nextId++,kind:'hi-tech-research-bench',x:12,z:11,orientation:0,footprint:'standard',material:'steel',power:newPowerState('hi-tech-research-bench')} as Structure:undefined;
  if(desk)w.structures.push(desk);
  for(const [i,amount] of [75,75,75,75,40].entries())addGroundMaterial(w,'steel',amount,{x:3+i,z:13},'steel');
  addGroundMaterial(w,'component',29,{x:9,z:13},'component');refreshStock(w);
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(w)).toEqual([]);
  return {world:w,pawn,station,desk};
}
/** Declared prepared research: both projects done at the fixture start. */
const withGuns=(w:World)=>{w.research!.gasOperation={points:GAS,completedAt:w.tick};w.research!.precisionRifling={points:RIFLING,completedAt:w.tick};return w;};

test('the five guns have the Core recipes, values and ranged statistics',()=>{
  const core:Record<Gun342,{steel:number;component:number;work:number;skill:number;mass:number;damage:number;ap:number;range:number;warmup:number;cooldown:number;speed:number;stop:number;acc:number[];burst?:{shots:number;ticksBetween:number}}>={
    'chain-shotgun':{steel:70,component:5,work:31000,skill:6,mass:4500,damage:18,ap:.14,range:12.9,warmup:72,cooldown:81,speed:.55,stop:3,acc:[.57,.64,.55,.45],burst:{shots:3,ticksBetween:10}},
    'heavy-smg':{steel:75,component:4,work:24000,skill:5,mass:3500,damage:12,ap:.18,range:22.9,warmup:54,cooldown:99,speed:.48,stop:.5,acc:[.85,.65,.35,.20],burst:{shots:3,ticksBetween:11}},
    lmg:{steel:75,component:5,work:34000,skill:6,mass:8500,damage:12,ap:.18,range:25.9,warmup:108,cooldown:96,speed:.46,stop:1,acc:[.40,.48,.35,.26],burst:{shots:6,ticksBetween:7}},
    'assault-rifle':{steel:60,component:7,work:40000,skill:6,mass:3500,damage:11,ap:.165,range:30.9,warmup:60,cooldown:102,speed:.70,stop:.5,acc:[.60,.70,.65,.55],burst:{shots:3,ticksBetween:10}},
    'sniper-rifle':{steel:60,component:8,work:45000,skill:7,mass:4000,damage:25,ap:.375,range:44.9,warmup:210,cooldown:90,speed:1,stop:1.5,acc:[.50,.70,.88,.90]},
  };
  expect([ITEM_DEFINITIONS['chain-shotgun'].label,ITEM_DEFINITIONS['heavy-smg'].label,ITEM_DEFINITIONS.lmg.label,ITEM_DEFINITIONS['assault-rifle'].label,ITEM_DEFINITIONS['sniper-rifle'].label])
    .toEqual(['Fusil à chaîne','Mitraillette lourde','Fusil-mitrailleur','Fusil d’assaut','Fusil de précision']);
  for(const gun of guns){
    const c=core[gun],f=GUNS_FACTS_342[gun],recipe=f.recipe,p=rangedWeaponProfile(gun,'normal')!;
    expect(ITEM_DEFINITIONS[gun]).toMatchObject({kind:'weapon',stackLimit:1});expect(isRangedWeaponItem(gun)).toBe(true);expect(weaponMaxHitPoints(gun)).toBe(100);
    expect(GUN_REQUIREMENTS[recipe]).toEqual({steel:c.steel,component:c.component,skill:c.skill});
    expect(PRODUCTION_RECIPES[recipe]).toMatchObject({station:'machining-table',work:'craft',units:c.steel+c.component,workTicks:c.work/10,outputUnits:1});
    expect(f.massGrams).toBe(c.mass);
    expect(tradeCatalogueEntry(gun)!.baseMarketValue).toBeCloseTo(c.steel*1.9+c.component*32+c.work*.0036,9);
    expect(p).toMatchObject({damage:c.damage,range:c.range,warmupCoreTicks:c.warmup,cooldownCoreTicks:c.cooldown,stoppingPower:c.stop});
    expect(p.projectileTilesPerCoreTick).toBeCloseTo(c.speed,12);expect(p.armorPenetration).toBeCloseTo(c.ap,12);expect(p.accuracy).toEqual(c.acc);
    expect(p.burst).toEqual(c.burst);
    // Core AdjustedFullCycleTime: warmup + cooldown + (shots-1) x ticksBetween.
    expect(rangedTimings(p).learningCycleSeconds).toBeCloseTo((c.warmup+c.cooldown+(c.burst?(c.burst.shots-1)*c.burst.ticksBetween:0))/60,12);
    // Quality scales damage and penetration as for every ranged weapon.
    expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile(gun,q)!.damage)).toEqual(WEAPON_QUALITIES.map((_,i)=>rangedRound(c.damage*[.9,1,1,1,1,1.25,1.5][i]!)));
    // Smelting returns a quarter of the steel, no component.
    const yields=new Set([0,.25,.5,.75,.999].map(r=>smeltingYield(gun,()=>r)));
    for(const y of yields)expect([Math.floor(c.steel/4),Math.ceil(c.steel/4)]).toContain(y);
  }
  expect(stationRecipes({kind:'machining-table'})).toEqual(expect.arrayContaining(guns.map(g=>GUNS_FACTS_342[g].recipe)));
  expect(stationRecipes({kind:'crafting-spot'})).not.toContain('make-lmg');
  // Grip (Blunt 9) and barrel (Blunt and Poke 9), as every gun.
  const w=firingCamp(),pawn=w.pawns[0]!;w.piles=[];addMaterial(w,'weapon',1,{type:'equipment',pawnId:pawn.id},'lmg');
  expect(meleeTools(w,pawn).filter(t=>['grip','barrel','barrel-poke'].includes(t.id)).map(t=>[t.id,t.kind,t.damage]).sort()).toEqual([['barrel','blunt',9],['barrel-poke','poke',9],['grip','blunt',9]]);
});

test('GasOperation follows BlowbackOperation on the simple desk; PrecisionRifling needs it, Microelectronics and a powered advanced desk',()=>{
  const {world:w,pawn}=workshop();pawn.priorities.craft=0;
  expect([researchCost('gas-operation'),researchCost('precision-rifling')]).toEqual([GAS,RIFLING]);
  expect([needsHighTechBench('gas-operation'),needsHighTechBench('precision-rifling')]).toEqual([false,true]);
  expect([needsResearchAnalyzer('gas-operation'),needsResearchAnalyzer('precision-rifling')]).toEqual([false,false]);
  expect(researchPrerequisite(w,'gas-operation')).toBeUndefined();expect(researchPrerequisite(w,'precision-rifling')).toBe('Emprunt de gaz');
  for(const gun of guns)expect(productionResearchUnlocked(w,GUNS_FACTS_342[gun].recipe)).toBe(false);
  const noBlowback=structuredClone(w);delete noBlowback.research!.blowbackOperation;
  expect(researchPrerequisite(noBlowback,'gas-operation')).toBe('Culasse non calée');
  const refused=applyCommand(noBlowback,{type:'research-project',project:'gas-operation'});expect(refused.ok).toBe(false);if(!refused.ok)expect(refused.reason).toContain('Culasse non calée');
  // Refusals are atomic.
  const before=serializeWorld(w),early=applyCommand(w,{type:'research-project',project:'precision-rifling'});
  expect(early.ok).toBe(false);if(!early.ok)expect(early.reason).toContain('Emprunt de gaz');expect(serializeWorld(w)).toBe(before);
  // The projects do not exist below 342.
  const old=structuredClone(w);old.schemaVersion=341 as World['schemaVersion'];
  for(const project of ['gas-operation','precision-rifling'] as const)expect(selectResearch(old,project).ok).toBe(false);
  expect(old.research?.gasOperation).toBeUndefined();
  accept(w,{type:'research-project',project:'gas-operation'});expect(w.research!.gasOperation).toEqual({points:0});
  advanceUntil(w,()=>(w.research!.gasOperation!.points)>0,400);expect(pawn.research).toBeDefined();expect(validateWorld(w)).toEqual([]);
  // Declared shortcut to the last points, then real desk work to completion.
  w.research!.gasOperation!.points=GAS-1;
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  advanceUntil(w,()=>researchUnlocked(w,'gas-operation'),800);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(w.research!.gasOperation!.completedAt).toBeGreaterThanOrEqual(w.research!.blowbackOperation!.completedAt!);
  for(const gun of ['chain-shotgun','heavy-smg','lmg'] as const)expect(productionResearchUnlocked(w,GUNS_FACTS_342[gun].recipe)).toBe(true);
  for(const gun of ['assault-rifle','sniper-rifle'] as const)expect(productionResearchUnlocked(w,GUNS_FACTS_342[gun].recipe)).toBe(false);
  // Microelectronics is the second parent.
  const noMicro=structuredClone(w);delete noMicro.research!.microelectronics;
  expect(researchPrerequisite(noMicro,'precision-rifling')).toBe('Microélectronique');
  // Selectable now, but the simple desk cannot serve it: no point accrues.
  accept(w,{type:'research-project',project:'precision-rifling'});expect(w.research!.precisionRifling).toEqual({points:0});
  const simple=w.structures.find(s=>s.kind==='research-bench')!;
  expect(researchStationUsable(w,simple,'precision-rifling')).toBe(false);
  for(let i=0;i<300;i++)stepWorld(w);
  expect(w.research!.precisionRifling).toEqual({points:0});expect(validateWorld(w)).toEqual([]);
});

test('PrecisionRifling progresses at the powered advanced desk; completion unlocks the assault and sniper rifles',()=>{
  const {world:w,pawn,desk}=workshop(true);pawn.priorities.craft=0;
  w.research!.gasOperation={points:GAS,completedAt:0};
  advanceUntil(w,()=>researchStationUsable(w,desk!,'precision-rifling'),200);
  accept(w,{type:'research-project',project:'precision-rifling'});
  advanceUntil(w,()=>(w.research!.precisionRifling!.points)>0,600);
  expect(pawn.research?.stationId).toBe(desk!.id);expect(validateWorld(w)).toEqual([]);
  w.research!.precisionRifling!.points=RIFLING-1;
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  advanceUntil(w,()=>researchUnlocked(w,'precision-rifling'),800);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  for(const gun of guns)expect(productionResearchUnlocked(w,GUNS_FACTS_342[gun].recipe)).toBe(true);
  expect(applyCommand(w,{type:'research-project',project:'precision-rifling'}).ok).toBe(false);
  expect(validateWorld(w)).toEqual([]);
});

test('a crafter makes all five guns at the powered machining table from their exact steel and components',()=>{
  const {world:w,pawn,station}=workshop();withGuns(w);pawn.priorities.research=0;
  expect([quantity(w,'steel'),quantity(w,'component')]).toEqual([340,29]);
  advanceUntil(w,()=>station.power?.on===true,100);
  for(const gun of guns)accept(w,{type:'bill-add',structureId:station.id,recipe:GUNS_FACTS_342[gun].recipe});
  for(const bill of station.bills!)accept(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:{...bill,destination:'drop'}});
  for(const gun of guns){
    const recipe=GUNS_FACTS_342[gun].recipe;
    advanceUntil(w,()=>w.piles.some(p=>p.gunWork?.recipe===recipe&&p.gunWork.progress>0),2500);
    const work=w.piles.find(p=>p.gunWork?.recipe===recipe)!.gunWork!;
    expect(work.authorId).toBe(pawn.id);expect(work.parts.reduce((n,p)=>n+p.quantity,0)).toBe(GUNS_FACTS_342[gun].units);
    // Declared shortcut: the paid workpiece jumps near the end of its work.
    const jump=Math.max(work.progress,productionWorkTotal(recipe)-60*PRODUCTION_WORK_SCALE);work.progress=jump;
    if(pawn.cooking?.recipe===recipe&&pawn.cooking.phase==='work')pawn.cooking.progress=jump;
    expect(validateWorld(w)).toEqual([]);
    if(gun==='lmg'){const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
      advanceUntil(w,()=>w.piles.some(p=>p.item===gun),2500);stepWorld(resumed,w.tick-start);expect(serializeWorld(resumed)).toBe(serializeWorld(w));}
    else advanceUntil(w,()=>w.piles.some(p=>p.item===gun),2500);
    // Declared test move: no hauler here, so the dropped gun is set aside to
    // keep the staging cells around the table free for the next bill.
    advanceUntil(w,()=>!pawn.cooking,300);
    const made=w.piles.find(p=>p.item===gun)!;expect(made.owner.type).toBe('ground');assignPileOwner(made,{type:'ground',x:20+guns.indexOf(gun),z:24});expect(validateWorld(w)).toEqual([]);
  }
  expect(w.piles.some(p=>p.item==='unfinished-gun')).toBe(false);
  // 340 steel and 29 components were used: nothing remains.
  expect([quantity(w,'steel'),quantity(w,'component')]).toEqual([0,0]);
  for(const gun of guns){const made=w.piles.find(p=>p.item===gun)!;expect(made.kind).toBe('weapon');expect(made.weapon?.hitPoints).toBe(100);expect(WEAPON_QUALITIES).toContain(made.weapon?.quality);}
  const rifle=w.piles.find(p=>p.item==='assault-rifle')!;
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:rifle.id,action:'equip',queue:false});
  advanceUntil(w,()=>rifle.owner.type==='equipment',300);expect(validateWorld(w)).toEqual([]);
});

/** Shooter 10 cells (or 20) from a drafted target in an open 32² camp. */
function armed(gun:Gun342,far=false){
  const w=firingCamp(),shooter=w.pawns[0]!,target=w.pawns[far?2:1]!;w.piles=[];
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:shooter.id},gun);
  expect(validateWorld(w)).toEqual([]);
  return {w,shooter,target};
}
const emissions=(w:World,gun:string,seen:Map<number,number>)=>{for(const p of w.projectiles??[])if(p.weaponItem===gun)seen.set(p.id,p.emittedAtCore);};
const sorted=(seen:Map<number,number>)=>[...seen.values()].sort((a,b)=>a-b);

for(const gun of ['chain-shotgun','heavy-smg','lmg','assault-rifle'] as const){
  test(`an equipped colonist fires the ${gun} burst with its Core shot count and spacing, then cools down`,()=>{
    const p=rangedWeaponProfile(gun,'normal')!,b=p.burst!,{w,shooter,target}=armed(gun),start=effectiveCore297(w),T=start+p.warmupCoreTicks;
    accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
    expect(shooter.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:T,weaponItem:gun});
    const seen=new Map<number,number>(),xp=shooter.skills.shooting.xp;
    advanceUntil(w,()=>shooter.shooting?.stance?.phase==='cooldown',30);emissions(w,gun,seen);
    // Between shots: the Core gap stance (ticksBetweenBurstShots + 1) aimed at the burst's own target.
    const gap=shooter.shooting!.stance!;if(gap.phase!=='cooldown'||!gap.burst)throw Error('no burst');
    expect(gap.burst.targetId).toBe(target.id);expect(gap.endsAtCore-gap.startedAtCore).toBe(b.ticksBetween+1);
    expect(shooter.skills.shooting.xp).toBeGreaterThan(xp);const learned=shooter.skills.shooting.xp;
    for(let i=0;i<8;i++){stepWorld(w);emissions(w,gun,seen);}
    // Shots at T, then ticksBetween-1, then ticksBetween apart (Pawn.Tick before VerbTick).
    const expected=Array.from({length:b.shots},(_,i)=>i===0?T:T+i*b.ticksBetween-1);
    expect(sorted(seen).slice(0,b.shots)).toEqual(expected);
    expect(sorted(seen).filter(c=>c<T+b.shots*b.ticksBetween+p.cooldownCoreTicks)).toHaveLength(b.shots);
    expect(shooter.skills.shooting.xp).toBe(learned);
    const last=expected.at(-1)!,after=shooter.shooting!.stance!;
    expect(after).toMatchObject({phase:'cooldown',startedAtCore:last,weaponItem:gun});
    expect(after.phase==='cooldown'&&after.burst).toBeFalsy();
    expect(after.endsAtCore-after.startedAtCore-(after.clock?.pausedCore??0)).toBe(p.cooldownCoreTicks);
    // The next burst starts after the cooldown and a new warmup.
    for(let i=0;i<30;i++){stepWorld(w);emissions(w,gun,seen);}
    expect(sorted(seen)[b.shots]).toBe(last+p.cooldownCoreTicks+p.warmupCoreTicks);
    expect(validateWorld(w)).toEqual([]);
  });
}

test('a sniper rifle fires one bullet after a 210-tick warmup, then cools down 90 ticks',()=>{
  const {w,shooter,target}=armed('sniper-rifle',true),start=effectiveCore297(w);
  accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  expect(shooter.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:start+210,weaponItem:'sniper-rifle'});
  const seen=new Map<number,number>();let cooldown=false;
  for(let i=0;i<55;i++){stepWorld(w);emissions(w,'sniper-rifle',seen);
    const s=shooter.shooting?.stance;
    if(!cooldown&&s?.phase==='cooldown'){cooldown=true;expect(s.burst).toBeUndefined();expect(s.startedAtCore).toBe(start+210);expect(s.endsAtCore-s.startedAtCore-(s.clock?.pausedCore??0)).toBe(90);}
  }
  expect(cooldown).toBe(true);
  // One bullet per cycle: 210, then 210 + 90 + 210.
  expect(sorted(seen).slice(0,2)).toEqual([start+210,start+510]);
  // The bullet covers 20 cells at 1 cell per Core tick.
  expect(validateWorld(w)).toEqual([]);
});

test('a save in the middle of an LMG burst resumes the remaining shots at the same ticks; the burst is saved strictly',()=>{
  const {w,shooter,target}=armed('lmg'),T=effectiveCore297(w)+108;
  accept(w,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  advanceUntil(w,()=>{const s=shooter.shooting?.stance;return s?.phase==='cooldown'&&!!s.burst&&s.burst.shotsLeft<=3;},30);
  const core=effectiveCore297(w),shooting=shooter.shooting!,stance=shooting.stance! as Extract<NonNullable<typeof shooting.stance>,{phase:'cooldown'}>;
  expect(stance.burst!.shotsLeft).toBeGreaterThan(0);
  expect(validShootingShape(shooting,342,w.tick,core)).toBe(true);
  // Strict burst shape: at most five shots left for six, a single-shot weapon has none.
  expect(validShootingShape({...shooting,stance:{...stance,burst:{...stance.burst!,shotsLeft:6}}},342,w.tick,core)).toBe(false);
  expect(validShootingShape({...shooting,stance:{...stance,weaponItem:'sniper-rifle'}},342,w.tick,core)).toBe(false);
  expect(validShootingShape({...shooting,stance:{...stance,burst:{...stance.burst!,targetId:target.id,extra:1}}},342,w.tick,core)).toBe(false);
  expect(validShootingShape(shooting,341,w.tick,core)).toBe(false);
  const copy=deserializeWorld(serializeWorld(w));expect(serializeWorld(copy)).toBe(serializeWorld(w));
  const seen=new Map<number,number>(),copySeen=new Map<number,number>();
  for(let i=0;i<6;i++){stepWorld(w);stepWorld(copy);emissions(w,'lmg',seen);emissions(copy,'lmg',copySeen);}
  expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(sorted(copySeen)).toEqual(sorted(seen));
  for(const c of sorted(seen).filter(c=>c<T+40))expect([T,T+6,T+13,T+20,T+27,T+34]).toContain(c);
  expect(shooter.shooting?.stance).toMatchObject({phase:'cooldown',startedAtCore:T+34});
});

test('from 342 the Gun kinds that can afford them carry the new guns; 341 keeps the 340 draw and no Gun kind ever draws the sniper rifle',()=>{
  const at=(schemaVersion:number)=>({schemaVersion,seed:12345}) as World;
  const counts=new Map<string,number>();
  for(let id=1;id<=3000;id++){
    for(const role of ['scavenger','pirate','town-guard','town-councilman','mercenary-gunner','villager','drifter','tribal-archer'] as const){
      const now=raidRoleWeapon(role,{world:at(342),pawnId:id}),old=raidRoleWeapon(role,{world:at(341),pawnId:id}),v340=raidRoleWeapon(role,{world:at(340),pawnId:id});
      expect(old).toBe(v340);expect(guns).not.toContain(old);
      // Money below the cheapest new gun (heavy SMG 356.9): nothing changes.
      if(role==='scavenger'||role==='pirate'||role==='town-councilman'||role==='villager'||role==='drifter'||role==='tribal-archer')expect(now).toBe(old);
      counts.set(`${role}:${now}`,(counts.get(`${role}:${now}`)??0)+1);
    }
  }
  // Town_Guard (250~400): the heavy SMG only. Mercenary_Gunner (330~650): the four Gun-tagged guns.
  expect(counts.get('town-guard:heavy-smg')).toBeGreaterThan(0);
  for(const gun of ['chain-shotgun','lmg','assault-rifle','sniper-rifle'])expect(counts.get(`town-guard:${gun}`)).toBeUndefined();
  for(const gun of ['chain-shotgun','heavy-smg','lmg','assault-rifle'])expect(counts.get(`mercenary-gunner:${gun}`)).toBeGreaterThan(0);
  for(const role of ['scavenger','pirate','town-guard','town-councilman','mercenary-gunner'])expect(counts.get(`${role}:sniper-rifle`)).toBeUndefined();
  // Core weaponTags: the sniper rifle is SniperRifle only, never Gun.
  expect(CORE_GUN_CANDIDATES_342.map(c=>c.core)).not.toContain('Gun_SniperRifle');
  expect(CORE_GUN_CANDIDATES_342.filter(c=>c.item&&guns.includes(c.item as Gun342)).map(c=>c.item)).toEqual(['chain-shotgun','heavy-smg','lmg','assault-rifle']);
  // Below 342 the dispatcher is the 340 draw, bit for bit.
  for(let id=1;id<=500;id++)expect(gunKindWeapon342('Mercenary_Gunner','fixed',7,id,341)).toBe(gunKindWeapon340('Mercenary_Gunner','fixed',7,id));
  // Same person, same gun at any later schema.
  expect(raidRoleWeapon('mercenary-gunner',{world:at(342),pawnId:77})).toBe(raidRoleWeapon('mercenary-gunner',{world:at(345),pawnId:77}));
});

test('visitors and caravan traders may sell the five guns from schema 342, with the same random draws',()=>{
  expect(VISITOR_RANGED_POOL.slice(8,13).map(c=>c.value)).toEqual([405,355,425,480,530]);
  expect(VISITOR_RANGED_ITEMS342).toEqual({8:'chain-shotgun',9:'heavy-smg',10:'lmg',11:'assault-rifle',12:'sniper-rifle'});
  const sold=new Map<string,number>();
  for(let n=1;n<=4000;n++){
    const seed=Math.imul(n,1013904223)>>>0,now=generateVisitorStock(seed,100,101,700,342),old=generateVisitorStock(seed,100,101,700,341);
    expect(now.rng).toBe(old.rng);
    for(const p of old.piles)expect(now.piles).toContainEqual(expect.objectContaining({item:p.item,quantity:p.quantity}));
    for(const gun of guns)if(now.piles.some(p=>p.item===gun))sold.set(gun,(sold.get(gun)??0)+1);
    expect(old.piles.some(p=>guns.includes(p.item as Gun342))).toBe(false);
  }
  for(const gun of guns)expect(sold.get(gun)).toBeGreaterThan(0);
  let caravan=0;
  for(let seed=1;seed<=60;seed++){
    const now=generateCaravanStock332(seed,100,101,0,'outlander-combat',342),old=generateCaravanStock332(seed,100,101,0,'outlander-combat',341);
    expect(now.rng).toBe(old.rng);expect(old.piles.some(p=>guns.includes(p.item as Gun342))).toBe(false);
    if(now.piles.some(p=>guns.includes(p.item as Gun342)))caravan++;
  }
  expect(caravan).toBeGreaterThan(0);
});

test('before schema 342 the guns, their recipes, bullets, stances and research are refused',()=>{
  const w=firingCamp();
  for(const gun of guns){
    const recipe=GUNS_FACTS_342[gun].recipe;
    expect(validBillSettings(newCookingBill(1,recipe),recipe,342)).toBe(true);
    expect(validBillSettings(newCookingBill(1,recipe),recipe,341)).toBe(false);
    expect(validTuqueCatalogueTransport({bills:[{recipe}]},341)).toBe(false);
    const pile={id:1,kind:'weapon',item:gun,quantity:1,owner:{type:'ground',x:1,z:1},weapon:{quality:'normal',hitPoints:100}};
    expect(validWeaponShape(pile,342)).toBe(true);expect(validWeaponShape(pile,341)).toBe(false);
    expect(validatePileRecordShape(pile,w,341)).toEqual(['Future gas-operated or precision gun catalogue.']);
    for(const v of [341,340,325])expect(validTuqueCatalogueTransport({piles:[{item:gun}]},v)).toBe(false);
    expect(validTuqueCatalogueTransport({projectiles:[{weaponItem:gun}]},341)).toBe(false);
    expect(validTuqueCatalogueTransport({stockpiles:[{filters:{items:{[gun]:true}}}]},341)).toBe(false);
    expect(validTuqueCatalogueTransport({piles:[{item:gun}]},342)).toBe(true);
  }
  // A real heavy SMG aim, then its real burst gap, relabelled 341.
  const {w:m,shooter,target}=armed('heavy-smg');
  accept(m,{type:'shoot',pawnIds:[shooter.id],targetId:target.id});
  expect(validShootingShape(shooter.shooting,342,m.tick,effectiveCore297(m))).toBe(true);
  expect(validShootingShape(shooter.shooting,341,m.tick,effectiveCore297(m))).toBe(false);
  advanceUntil(m,()=>shooter.shooting?.stance?.phase==='cooldown',10);
  expect(validShootingShape(shooter.shooting,342,m.tick,effectiveCore297(m))).toBe(true);
  expect(validShootingShape(shooter.shooting,341,m.tick,effectiveCore297(m))).toBe(false);
  // Research records: refused before 342; parents completed first.
  const research=(r:Partial<NonNullable<World['research']>>)=>({...firingCamp(),research:{project:null,points:0,gunsmithing:{points:GUNSMITHING_RESEARCH_COST,completedAt:0},blowbackOperation:{points:BLOWBACK,completedAt:0},...r}}) as World;
  const begun=research({gasOperation:{points:12}});
  expect(validGunsResearchTransport342(begun,342)).toBe(true);expect(validGunsResearchTransport342(begun,341)).toBe(false);
  expect(validateResearch(begun,341)).not.toEqual([]);
  const orphan=research({gasOperation:{points:12}});delete orphan.research!.blowbackOperation;
  expect(validGunsResearchTransport342(orphan,342)).toBe(false);
  // PrecisionRifling needs both GasOperation and Microelectronics completed.
  const rifling=research({gasOperation:{points:GAS,completedAt:0},precisionRifling:{points:5}});
  expect(validGunsResearchTransport342(rifling,342)).toBe(false);
  rifling.research!.microelectronics={points:MICROELECTRONICS_RESEARCH_COST,completedAt:0};
  expect(validGunsResearchTransport342(rifling,342)).toBe(true);
  expect(validGunsResearchTransport342(research({project:'gas-operation'}),342)).toBe(false);
  // A bill needs its completed research.
  const billed=research({});billed.structures=[{id:900,kind:'machining-table',x:2,z:2,orientation:0,footprint:'standard',material:'steel',bills:[newCookingBill(1,'make-sniper-rifle')]} as Structure];
  expect(validGunsResearchTransport342(billed,342)).toBe(false);
  // A whole 341 save holding an LMG is refused, never migrated.
  const withGun=firingCamp();addMaterial(withGun,'weapon',1,{type:'ground',x:2,z:2},'lmg');
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withGun),341))).toThrow();
});

test('a schema 341 save migrates to 342 by its number only',()=>{
  const current=serializeWorld(firingCamp());
  expect(serializeWorld(deserializeWorld(asOldSchema(current,341)))).toBe(asNumberOnly(current,341));
  const {world}=workshop(true);const save=serializeWorld(world);
  expect(serializeWorld(deserializeWorld(asOldSchema(save,341)))).toBe(asNumberOnly(save,341));
  // Migrated research keeps BlowbackOperation, nothing granted.
  const migrated=deserializeWorld(asOldSchema(save,341));
  expect(migrated.research!.gasOperation).toBeUndefined();expect(researchUnlocked(migrated,'gas-operation')).toBe(false);
});
