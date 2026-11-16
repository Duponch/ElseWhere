import {expect,test} from 'vitest';
import {asOldSchema} from './scenarios/old-schema.ts';
import {constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256.ts';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {damageAnimalWithBullet} from '../src/sim/wildlife-health.ts';
import {projectileProfile} from '../src/sim/ranged-statistics.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {healthRandom} from '../src/sim/health.ts';
import {strikeLivingTarget} from '../src/sim/living-melee.ts';
import {meleeTools} from '../src/sim/melee-statistics.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {applyCommand,createWorld,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {legacyHumanAge} from '../src/sim/human-age.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {animalRevengeChances348,harmRevengeChance348,manhunterOnDamageChance348,manhunterOnTameFailChance348,revengeInstigator348,rollManhunterOnTameFail348} from '../src/sim/animal-manhunter-revenge-348.ts';
import type {Pawn,World} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

// Controlled arena, as the hunting fixture (tests/scenarios/hunting.ts) with
// its own creation clock: a real armed hunter, a second
// colonist and freshly constructed Core animals. Every impact goes through
// the real producers.
function huntingCamp(seed=81733):World {
  const w=createWorld(seed,32,32);
  w.rng=seed;w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.stockpiles=[];w.growingZones=[];w.pawns=w.pawns.slice(0,2);
  for(const [i,p] of w.pawns.entries()){
    p.age=legacyHumanAge();delete p.health;Object.assign(p,{x:i===0?4:8,z:i===0?10:6,hunger:100,rest:100});p.recreation.level=100;p.schedule.fill('work');p.bedId=null;
    for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  }
  const hunter=w.pawns[0]!;hunter.priorities.hunt=1;hunter.skills.shooting.level=20;
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:hunter.id},'revolver');enableWildlife(w,0);refreshStock(w);
  return w;
}
type Def=keyof typeof INITIAL_ANIMAL_FACTS_256;
function spawn(w:World,def:Def,x:number,z:number):WildAnimal {
  const made=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256[def],id:w.nextId,cell:{x,z},tick:w.tick,random:new WorldGenerationRandom(w.seed+w.nextId)});
  if(made.status!=='ready')throw Error('construction blocked: '+made.reason);
  w.nextId++;const a=made.animal;Object.assign(a,{state:'idle',path:[],nextDecision:w.tick+80});delete a.motion;w.wildlife!.animals.push(a);return a;
}
function camp(def:Def){
  const w=huntingCamp();w.wildlife!.animals=[];w.hunting={targets:[],completed:0};
  const a=spawn(w,def,10,10),hunter=w.pawns[0]!;delete hunter.skills.animals;
  return {w,a,hunter};
}
const hit=()=>{const p=projectileProfile('revolver','normal')!;return {damage:p.damage,stoppingPower:p.stoppingPower,armorPenetration:p.armorPenetration};};
/** One real bullet impact from the hunter on a copy of the base world. */
function shoot(base:World,animalId:number,rng:number,schema?:number):World {
  const w=structuredClone(base);w.rng=rng;if(schema!==undefined)w.schemaVersion=schema as World['schemaVersion'];
  const a=w.wildlife!.animals.find(a=>a.id===animalId)!,hunter=w.pawns[0]!;
  damageAnimalWithBullet(w,a,hit(),effectiveCore297(w),hunter,hunter.id,`pawn:${hunter.id}`);
  return w;
}
const seeds=(n:number)=>Array.from({length:n},(_,i)=>(Math.imul(i+1,0x9e3779b1)>>>0)||1);
const enraged=(w:World,id:number)=>!!w.wildlife!.animals.find(a=>a.id===id)?.manhunter;

test('Core species data and the Wildlife table chances',()=>{
  expect(animalRevengeChances348('timber-wolf')).toEqual({onDamage:1,onTameFail:.3});
  expect(animalRevengeChances348('cougar')).toEqual({onDamage:.5,onTameFail:.3});
  expect(animalRevengeChances348('emu')).toEqual({onDamage:1,onTameFail:1});
  expect(animalRevengeChances348('muffalo')).toEqual({onDamage:.1,onTameFail:0});
  expect(animalRevengeChances348('deer')).toEqual({onDamage:0,onTameFail:0});
  const {w,a}=camp('Wolf_Timber');
  expect(manhunterOnDamageChance348(w,a)).toBe(1);expect(manhunterOnTameFailChance348(a)).toBe(.3);
  expect(manhunterOnDamageChance348({gameProfile:{...w.gameProfile!,difficulty:'peaceful' as never}},{species:'muffalo'})).toBeCloseTo(.025,10);
  // Scaria adds 0.5 before Core's single final clamp: 1.5 x 3 x 0.1 against a 90 % stealth.
  const scaria={species:'timber-wolf' as const,health:{scaria261:{manhunterCore:-999999}} as unknown as WildAnimal['health']};
  expect(manhunterOnDamageChance348(w,scaria)).toBe(1);expect(harmRevengeChance348(w,scaria,.9)).toBeCloseTo(.45,10);expect(harmRevengeChance348(w,a,.9)).toBeCloseTo(.3,10);
});

test('a hunted muffalo turns manhunter at 0.1 x 3 = 30 % per hit; a deer never does and draws nothing',()=>{
  const {w:base,a}=camp('Muffalo');expect(validateWorld(base)).toEqual([]);
  let starts=0;
  for(const rng of seeds(400)){const w=shoot(base,a.id,rng);if(enraged(w,a.id))starts++;}
  expect(starts/400).toBeGreaterThan(.23);expect(starts/400).toBeLessThan(.37);
  const deer=camp('Deer');
  for(const rng of seeds(200)){
    const now=shoot(deer.w,deer.a.id,rng),old=shoot(deer.w,deer.a.id,rng,347);
    expect(enraged(now,deer.a.id)).toBe(false);old.schemaVersion=now.schemaVersion;expect(old).toEqual(now);
  }
});

test('the hunter\'s stealth lowers the chance: a wolf (100 % x 3) against Shooting 10 and Animals 10',()=>{
  const {w:base,a,hunter}=camp('Wolf_Timber');
  expect(shoot(base,a.id,12345).wildlife!.animals.find(v=>v.id===a.id)!.manhunter).toBeDefined(); // chance clamped to 1, no draw
  hunter.skills.shooting.level=10;hunter.skills.animals={level:10,xp:0,dailyXp:0,passion:0};
  // HuntingStealth: 0.5 x 0.5 = 0.25 on the curve = 0.7583; chance 3 x 0.2417 = 0.725.
  expect(revengeInstigator348(base,`pawn:${hunter.id}`)!.stealth).toBeCloseTo(.75+.05*(.05/.3),10);
  let starts=0;for(const rng of seeds(400))if(enraged(shoot(base,a.id,rng),a.id))starts++;
  expect(starts/400).toBeGreaterThan(.65);expect(starts/400).toBeLessThan(.8);
});

test('below 348 a hit never enrages; at 348 an unlucky hit differs only by the one revenge draw',()=>{
  const {w:base,a}=camp('Muffalo');let compared=0;
  for(const rng of seeds(200)){
    const now=shoot(base,a.id,rng),old=shoot(base,a.id,rng,347);
    expect(enraged(old,a.id)).toBe(false);
    if(enraged(now,a.id))continue;
    // The 348 run spent exactly one Rand.Chance from the impact stream,
    // none after a killing shot (Core: no Notify_DamageTaken once dead).
    const advanced={rng:old.rng};if(now.wildlife!.animals.find(v=>v.id===a.id)?.state!=='dead')healthRandom(advanced);old.rng=advanced.rng;old.schemaVersion=now.schemaVersion;
    expect(old).toEqual(now);compared++;
  }
  expect(compared).toBeGreaterThan(100);
});

test('instigators: a wild animal or a hive faction never enrages; a colony animal or a turret has 90 % stealth',()=>{
  const {w,a}=camp('Muffalo'),dog=spawn(w,'Wolf_Timber',20,20),wild=spawn(w,'Wolf_Timber',22,22);
  dog.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+45000};
  expect(revengeInstigator348(w,`animal:${wild.id}`)).toBeUndefined();
  expect(revengeInstigator348(w,`animal:${dog.id}`)!.stealth).toBeCloseTo(.9,10);
  const turret={id:w.nextId++,kind:'mini-turret' as const,x:1,z:1,orientation:0 as const,footprint:'standard' as const,material:'steel' as const};w.structures.push(turret);
  expect(revengeInstigator348(w,`structure:${turret.id}`)!.stealth).toBeCloseTo(.9,10);
  expect(revengeInstigator348(w,`structure:${w.structures.find(s=>s.kind!=='mini-turret')?.id??-1}`)).toBeUndefined();
  // A predator hunting its prey is not enraged by that prey's retaliation.
  const {w:base,a:wolf,hunter}=camp('Wolf_Timber');wolf.predation={targetId:hunter.id,startedAtCore:base.tick*10,firstHit:false};
  for(const rng of seeds(20))expect(enraged(shoot(base,wolf.id,rng),wolf.id)).toBe(false);
  void a;
});

test('a melee blow by a colonist rolls the same chance on the impact stream',()=>{
  const {w:base,a,hunter}=camp('Wolf_Timber');hunter.x=a.x-1;hunter.z=a.z;hunter.melee={order:null,strike:null};
  let hits=0;
  for(const rng of seeds(60)){
    const w=structuredClone(base);w.rng=rng;const wolf=w.wildlife!.animals.find(v=>v.id===a.id)!,p=w.pawns[0]!;
    const tool=meleeTools(w,p)[0]!;const random={rng:w.rng};strikeLivingTarget(w,p,wolf,tool,effectiveCore297(w),random);
    if(p.melee!.strike?.outcome==='hit'&&wolf.state!=='dead'&&wolf.state!=='downed'){hits++;expect(wolf.manhunter).toBeDefined();expect(wolf.threat).toBeUndefined();expect(wolf.retaliation).toBeUndefined();}
    if(p.melee!.strike?.outcome!=='hit')expect(wolf.manhunter).toBeUndefined();
  }
  expect(hits).toBeGreaterThan(10);
});

test('the pack: with big threats one Rand.Value below 0.5 enrages the awake same-race animals within 24 cells',()=>{
  const {w:base,a}=camp('Wolf_Timber');
  const near=spawn(base,'Wolf_Timber',12,11),asleep=spawn(base,'Wolf_Timber',11,12),far=spawn(base,'Wolf_Timber',31,31),other=spawn(base,'Cougar',9,9);
  Object.assign(a,{x:2,z:2});Object.assign(near,{x:4,z:3});Object.assign(asleep,{x:3,z:4,state:'sleeping'});
  let spread=0,alone=0;
  for(const rng of seeds(80)){
    const w=shoot(base,a.id,rng),shot=w.wildlife!.animals.find(v=>v.id===a.id)!;
    if(shot.state==='dead'||shot.state==='downed'){expect(shot.manhunter).toBeUndefined();continue;}
    expect(enraged(w,a.id)).toBe(true);
    expect(enraged(w,asleep.id)).toBe(false);expect(enraged(w,far.id)).toBe(false);expect(enraged(w,other.id)).toBe(false);
    if(enraged(w,near.id)){spread++;expect(w.events.at(-1)!.message).toContain('Un congénère proche le rejoint');}else alone++;
  }
  expect(spread).toBeGreaterThan(20);expect(alone).toBeGreaterThan(20);
});

/** The animal-handling fixture: a skilled handler and berries beside a fresh animal. */
function tameCamp(def:Def){
  const w=huntingCamp(),p=w.pawns[0]!;w.wildlife!.animals=[];p.priorities.hunt=0;p.priorities.handle=1;w.pawns[1]!.hostilityResponse='ignore';
  p.skills.animals={level:20,xp:0,dailyXp:0,passion:0};p.x=4;p.z=10;
  const a=spawn(w,def,5,10);
  addMaterial(w,'food',6,{type:'ground',x:p.x,z:p.z},'berries');refreshStock(w);
  return {w,p,a};
}

test('a failed tame enrages at the species rate (timber wolf 30 %), never after a success, never below 348',()=>{
  const {w:base,a,p}=tameCamp('Wolf_Timber');let fails=0,starts=0;
  for(const rng of seeds(300)){
    const w=structuredClone(base);w.rng=rng;const wolf=w.wildlife!.animals[0]!;
    if(rollManhunterOnTameFail348(w,wolf,w.pawns[0]!))starts++;fails++;
  }
  expect(starts/fails).toBeGreaterThan(.23);expect(starts/fails).toBeLessThan(.37);
  for(const rng of seeds(50)){const w=structuredClone(base);w.rng=rng;w.schemaVersion=347 as World['schemaVersion'];expect(rollManhunterOnTameFail348(w,w.wildlife!.animals[0]!,w.pawns[0]!)).toBe(false);expect(w.rng).toBe(rng);}
  void a;void p;
});

test('an emu (100 %) whose real taming fails turns manhunter, keeps its designation, then attacks through stepWorld',()=>{
  const {w:base,a}=tameCamp('Emu');expect(validateWorld(base)).toEqual([]);
  expect(applyCommand(base,{type:'tame',animalId:a.id,enabled:true})).toMatchObject({ok:true});
  // The real handler works through the engine; seeds differ until an attempt fails.
  let w:World|undefined,successes=0;
  for(const rng of seeds(40)){
    const trial=structuredClone(base);trial.rng=rng;const emu=trial.wildlife!.animals.find(v=>v.id===a.id)!;
    for(let i=0;i<1200&&!emu.domestic&&!emu.manhunter;i++)stepWorld(trial);
    if(emu.domestic){successes++;expect(emu.manhunter).toBeUndefined();continue;}
    expect(emu.manhunter).toBeDefined();w=trial;break;
  }
  expect(w).toBeDefined();const emu=w!.wildlife!.animals.find(v=>v.id===a.id)!;
  expect(emu.taming?.designated).toBe(true);expect(emu.taming?.lastAttempt).toBeDefined();
  expect(w!.events.some(e=>e.message.includes('rejette l’apprivoisement'))).toBe(true);
  expect(validateWorld(w!)).toEqual([]);
  // Save and reload while enraged, then both continue identically.
  const copy=deserializeWorld(serializeWorld(w!));expect(copy).toEqual(w);
  for(const p of [...w!.pawns,...copy.pawns])p.hostilityResponse='ignore';
  let struck:number|undefined;
  for(let i=0;i<600&&struck===undefined&&emu.manhunter;i++){
    stepWorld(w!);stepWorld(copy);
    if(emu.strike?.outcome==='hit'&&w!.pawns.some(p=>p.id===emu.strike!.targetId))struck=emu.strike.targetId??undefined;
  }
  expect(struck).toBeDefined();expect(copy).toEqual(w);expect(validateWorld(w!)).toEqual([]);
  expect(w!.pawns.find(p=>p.id===struck)!.health?.injuries.length).toBeGreaterThan(0);
  void successes;
});

test('a hunt through the engine: the shot wolf turns manhunter, survives save and reload, then bites',()=>{
  const {w,a,hunter}=camp('Wolf_Timber');w.pawns[1]!.hostilityResponse='ignore';expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'hunt',animalId:a.id,enabled:true})).toMatchObject({ok:true});
  for(let i=0;i<1500&&!a.manhunter&&a.state!=='dead';i++)stepWorld(w);
  expect(a.manhunter).toBeDefined();expect(a.state).not.toBe('dead');
  expect(w.events.some(e=>e.message.startsWith('Vengeance : blessé'))).toBe(true);expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'hunt',animalId:a.id,enabled:false})).toMatchObject({ok:true});hunter.hostilityResponse='ignore';
  const copy=deserializeWorld(serializeWorld(w));expect(copy).toEqual(w);
  let bitten=false;
  for(let i=0;i<600&&!bitten&&a.manhunter;i++){stepWorld(w);stepWorld(copy);bitten=a.strike?.targetId===hunter.id;}
  expect(bitten).toBe(true);expect(copy).toEqual(w);expect(validateWorld(w)).toEqual([]);
});

test('migration 347 to 348 by number only; a 347 save cannot hold a tame designation on a manhunter',()=>{
  const {w,a}=camp('Wolf_Timber');const json=serializeWorld(w);
  const migrated=deserializeWorld(asOldSchema(json,347));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(migrated).toEqual(deserializeWorld(json));
  const enragedWorld=shoot(w,a.id,1);const wolf=enragedWorld.wildlife!.animals.find(v=>v.id===a.id)!;
  expect(wolf.manhunter).toBeDefined();wolf.taming={designated:true};
  expect(validateWorld(enragedWorld)).toEqual([]);
  expect(deserializeWorld(serializeWorld(enragedWorld))).toEqual(enragedWorld);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(enragedWorld),347))).toThrow(/Invalid version347 save/);
});
