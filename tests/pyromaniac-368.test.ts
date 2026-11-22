import {expect,test,vi} from 'vitest';

/* Schema 368: the Pyromaniac trait (Traits_Singular.xml), its Firefighting
 * disable and its fire-starting spree (MentalStates_Mood.xml, JobGiver_
 * FireStartingSpree, JobDriver_Ignite), and its PyromaniacNearFire thought.
 * The mood-caused spree is forced through the break stream only (the mental
 * stream at the sampled check, as the 211 crisis tests do); the trait's
 * random spree through its own stream (fire-spree-stream-368), scripted for
 * one pawn as Rand.PushState would. Every walk, wait and fire comes from
 * real ticks of stepWorld. */
const hook=vi.hoisted(()=>({randomState:new Set<number>()}));
vi.mock('../src/sim/fire-spree-stream-368.ts',async importOriginal=>{
  const real=await importOriginal<typeof import('../src/sim/fire-spree-stream-368.ts')>();
  return {...real,fireSpreeRoll368:(seed:number,id:number,tick:number,salt:number)=>salt===real.FIRE_SPREE_SALT_368.randomState&&hook.randomState.has(id)?0:real.fireSpreeRoll368(seed,id,tick,salt)};
});

import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {startFire} from '../src/sim/fire.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {CORE_TRAIT_DEFS,CORE_TRAIT_DEF_NAMES,TRAITS,traitDefCommonality,traitDefsConflict,traitDisablingWorkTag,validTraits} from '../src/sim/traits.ts';
import {drawCoreTraits361,giveBornTraits361,offeredTraits361,traitBirthDraw361} from '../src/sim/trait-generation-361.ts';
import {createStartingCandidateRoster,previewStartingCandidate} from '../src/sim/starting-candidates.ts';
import {backgroundWorkRefusal,violentWorkRefusal} from '../src/sim/colonist-backgrounds.ts';
import {backgroundRestrictionRows} from '../src/ui/background-inspection.ts';
import {workPriority} from '../src/sim/work-types.ts';
import {enableAndInitializeWork} from '../src/sim/work-initialization.ts';
import {firefightingTargets} from '../src/sim/firefighting.ts';
import {MENTAL_CRISIS_CATALOG} from '../src/sim/mental-catalog.ts';
import {mentalCrisisStatus} from '../src/sim/mental-presentation.ts';
import {mentalState,type FireSpreeCrisis368} from '../src/sim/mental-state.ts';
import {FIRE_SPREE_WAIT_CORE_368,igniteCandidates368,isPyromaniac368} from '../src/sim/fire-spree-368.ts';
import {IGNITE_COOLDOWN_CORE_368,IGNITE_WARMUP_CORE_368} from '../src/sim/pyromaniac-368.ts';
import {pyromaniacFiresNear368} from '../src/sim/pyromaniac-thought-368.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import {asOldSchema,numberOnlyWorld} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type Structure,type World} from '../src/sim/types.ts';

const idle={handle:0,clean:0,firefight:0,warden:0,basic:0,hunt:0,research:0,patient:0,bedrest:0,doctor:0,art:0,craft:0,mine:0,gather:0,build:0,haul:0,grow:0,cook:0} as Pawn['priorities'];

/** Prepared fixture from a fresh world at tick 0: grass, nothing on the map,
 * three adults without background who take no work. */
function camp(version=SCHEMA_VERSION as number):World {
  const w=createWorld(368,32,32);
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
  w.pawns=w.pawns.slice(0,3);
  for(const p of w.pawns){Object.assign(p,{hunger:100,rest:100});p.priorities={...idle};delete p.background;delete p.traits;}
  w.schemaVersion=version as typeof SCHEMA_VERSION;refreshStock(w);return w;
}
const fed=(w:World)=>{for(const p of w.pawns){p.hunger=100;p.rest=100;p.recreation.level=100;}};
const spree=(p:Pawn)=>p.mental?.crisis?.kind==='fire-starting-spree'?p.mental.crisis as FireSpreeCrisis368:undefined;
/** The pyromaniac's region holds two wood piles and a wooden stool; the
 * other two colonists stand far away, in another block. */
function playground(){
  const w=camp(),[pyro,b,c]=w.pawns as [Pawn,Pawn,Pawn];
  pyro.traits=['pyromaniac'];Object.assign(pyro,{x:6,z:6});Object.assign(b,{x:26,z:26});Object.assign(c,{x:28,z:26});
  addGroundMaterial(w,'wood',10,{x:3,z:6},'wood');addGroundMaterial(w,'wood',10,{x:6,z:10},'wood');
  const stool:Structure=fixtureBuilding(w,'stool',9,3);stool.material='wood';
  refreshStock(w);return {w,pyro,b,c,stool};
}
/** An extreme mood break is due at the pawn's next sampled check (the 211
 * crisis tests' exposure); the break stream (world.rng) is then tried from 1
 * until the real step starts a crisis (a bounded producer witness). */
function breakNow(w:World,p:Pawn):World {
  p.mood=0;const m=mentalState(p);m.below=[2100,2100,2100];m.cooldown=0;
  while((w.tick+1+p.id)%15!==0){fed(w);stepWorld(w,1);}
  p.mood=0;mentalState(p).below=[2100,2100,2100];
  const before=serializeWorld(w);
  for(let rng=1;rng<=64;rng++){
    const trial=deserializeWorld(before);trial.rng=rng;stepWorld(trial,1);
    const q=trial.pawns.find(q=>q.id===p.id)!;
    if(q.mental?.crisis)return trial;
  }
  throw Error('No break within the witness bound');
}

test('Core data: Pyromaniac exists from 368, conflicts with nothing and disables Firefighting; the spree is an extreme break',()=>{
  expect(isPyromaniac368(367)).toBe(false);expect(isPyromaniac368(368)).toBe(true);
  expect([TRAITS.pyromaniac.def,TRAITS.pyromaniac.degree,TRAITS.pyromaniac.since,TRAITS.pyromaniac.disabledWorkTags]).toEqual(['Pyromaniac',0,368,['firefighting']]);
  expect(CORE_TRAIT_DEFS.Pyromaniac).toMatchObject({commonality:.8,conflicts:[],exclusionTags:[],requiredWorkTags:[],allowOnHostileSpawn:true,degrees:['pyromaniac']});
  expect(CORE_TRAIT_DEF_NAMES.filter(d=>traitDefsConflict('Pyromaniac',d))).toEqual([]);
  // No older degree disables work (the channel is inert below 368).
  expect(Object.values(TRAITS).filter(t=>t.disabledWorkTags?.length).map(t=>t.def)).toEqual(['Pyromaniac']);
  expect(validTraits(['pyromaniac'],367)).toBe(false);expect(validTraits(['pyromaniac'],368)).toBe(true);
  expect(validTraits(['pyromaniac','gourmand','kind'],368)).toBe(true);
  expect(MENTAL_CRISIS_CATALOG['fire-starting-spree']).toMatchObject({intensity:2,weight:1,minCore:6000,maxCore:10000,recoveryMtb:.033});
  expect([IGNITE_WARMUP_CORE_368,IGNITE_COOLDOWN_CORE_368,FIRE_SPREE_WAIT_CORE_368]).toEqual([180,78,[80,140]]);
});

test('generation draws Pyromaniac from 368 at Core\'s frequency; below 368 every draw is the one of the code before this lot',()=>{
  const drawable=CORE_TRAIT_DEF_NAMES.filter(d=>CORE_TRAIT_DEFS[d].degrees.some(id=>(TRAITS[id].since??0)<=368));
  expect(drawable).toContain('Pyromaniac');
  const N=14000,first:Record<string,number>={};
  for(let i=0;i<N;i++){
    const traits=drawCoreTraits361({draw:traitBirthDraw361(368368,i+1),sex:'male',ageYears:30,schema:368});
    expect(validTraits(traits,368)).toBe(true);const def=TRAITS[traits[0]!].def;first[def]=(first[def]??0)+1;
  }
  const total=drawable.reduce((s,d)=>s+traitDefCommonality(d,'male'),0),expected=.8/total,observed=first.Pyromaniac!/N;
  expect(Math.abs(observed-expected)).toBeLessThan(4*Math.sqrt(expected*(1-expected)/N)+.002);
  // A past that forbids firefighting does not refuse the trait (no requiredWorkTags).
  let sheltered=0;
  for(let i=0;i<4000;i++)if(drawCoreTraits361({draw:traitBirthDraw361(77,i+1),sex:'female',ageYears:30,background:{childhood:'sheltered-child'},schema:368}).includes('pyromaniac'))sheltered++;
  expect(sheltered).toBeGreaterThan(0);
  // Below 368 (hash of the same draws computed with the code at the start of this lot).
  for(const schema of [362,367]){
    let h=0;const mix=(s:string)=>{for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;};
    for(let i=0;i<2000;i++)mix(JSON.stringify(drawCoreTraits361({draw:traitBirthDraw361(367367,i+1),sex:i%2?'male':'female',ageYears:20+i%40,...i%5===0?{hostile:true}:{},schema})));
    for(let i=0;i<240;i++){const p=previewStartingCandidate(3000+i,{serial:1+i%8,generation:i%3},schema);mix(JSON.stringify([p.traits,p.skills,p.health??null]));}
    expect(h).toBe(2473787427);
  }
  const old=camp(367);
  for(let id=1000;id<1600;id++){
    const p={...structuredClone(old.pawns[0]!),id};delete p.traits;giveBornTraits361(old,p);
    expect(p.traits??[]).not.toContain('pyromaniac');
    expect(offeredTraits361(old.seed,id,p.age,undefined,367)??[]).not.toContain('pyromaniac');
  }
  // Tutorial candidates still all fight (the trait removes Firefighting only).
  const roster=createStartingCandidateRoster(368,{capableOfViolence:true});
  for(const d of roster)expect(violentWorkRefusal(previewStartingCandidate(368,d))).toBeUndefined();
});

test('no firefighting: refusal, Work tab priority, initial work, direct order and the real work loop',()=>{
  const w=camp(),[pyro,b]=w.pawns as [Pawn,Pawn];
  pyro.traits=['pyromaniac','kind'];Object.assign(pyro,{x:10,z:10});Object.assign(b,{x:12,z:10});
  expect(traitDisablingWorkTag(pyro,'firefighting')).toBe('pyromaniac');
  expect(backgroundWorkRefusal(pyro,'firefight')).toBe('Incendie impossible. Incapacité liée au trait : Pyromane.');
  expect(backgroundWorkRefusal(pyro,'haul')).toBeUndefined();expect(violentWorkRefusal(pyro)).toBeUndefined();
  expect(backgroundRestrictionRows(pyro)).toEqual([{label:'Incendie',reason:'Incendie impossible. Incapacité liée au trait : Pyromane.'}]);
  // A past's incapacity keeps its own wording, the trait's comes after it.
  expect(backgroundWorkRefusal({background:{childhood:'sheltered-child'},traits:['pyromaniac']},'firefight')).toContain('passé');
  // Pawn_WorkSettings.EnableAndInitialize: Firefighter always starts active, unless disabled.
  enableAndInitializeWork(pyro);enableAndInitializeWork(b);
  expect([pyro.priorities.firefight,b.priorities.firefight]).toEqual([0,3]);
  // The Work tab cannot enable it; a stored priority reads 0.
  expect(applyCommand(w,{type:'priority',pawnId:pyro.id,work:'firefight',value:1}).ok).toBe(false);
  pyro.priorities.firefight=1;expect(workPriority(pyro,'firefight')).toBe(0);
  // A fire in the home area: the other colonist fights it, the pyromaniac never.
  addGroundMaterial(w,'wood',20,{x:11,z:12},'wood');refreshStock(w);
  w.home=[];for(let z=0;z<32;z++)for(let x=0;x<32;x++)w.home.push(z*32+x);
  expect(startFire(w,{x:11,z:12},.5)).toBe(true);
  const fire=w.fires!.items[0]!;
  expect(firefightingTargets(w,pyro)).toEqual([]);expect(firefightingTargets(w,b).map(f=>f.id)).toEqual([fire.id]);
  const order=applyCommand(w,{type:'order-extinguish',pawnId:pyro.id,fireId:fire.id});
  expect(order.ok).toBe(false);expect(order.ok?'':order.reason).toContain('Pyromane');
  let fought=false;
  for(let t=0;t<120&&w.fires?.items.length;t++){fed(w);stepWorld(w,1);expect(pyro.firefighting).toBeUndefined();if(b.firefighting)fought=true;}
  expect(fought).toBe(true);expect(validateWorld(w)).toEqual([]);
});

test('an extreme break of a pyromaniac is a fire-starting spree: real ticks light its region, a save mid-ignite continues exactly, recovery gives catharsis',()=>{
  const fixture=playground();let w=fixture.w;const stoolId=fixture.stool.id,pyroId=fixture.pyro.id;
  const targets=igniteCandidates368(w,fixture.pyro).map(t=>t.value.id).sort((a,b)=>a-b);
  expect(targets).toEqual([...w.piles.map(p=>p.id),stoolId].sort((a,b)=>a-b));
  w=breakNow(w,fixture.pyro);
  let pyro=w.pawns.find(p=>p.id===pyroId)!;
  const c0=spree(pyro);expect(c0).toBeDefined();expect(c0!.notMood362).toBeUndefined();
  expect(w.events.some(e=>e.message.includes('commence une frénésie incendiaire'))).toBe(true);
  expect(w.letters352?.stack.at(-1)).toBeDefined();
  expect(validateWorld(w)).toEqual([]);
  const ignited:number[]=[],warmups:number[]=[],waits:number[]=[];let reloadChecked=false;
  let prev:FireSpreeCrisis368|undefined=structuredClone(spree(pyro));
  let copy:World|undefined,copyTicks=0;
  for(let t=0;t<1500&&spree(pyro);t++){
    fed(w);
    const c=spree(pyro)!;
    // Reload a save taken during a warmup; both runs then step 120 ticks alike.
    if(!copy&&!reloadChecked&&c.stanceCore!==null&&!c.cast)copy=deserializeWorld(serializeWorld(w));
    stepWorld(w,1);pyro=w.pawns.find(p=>p.id===pyroId)!;
    if(copy){fed(copy);stepWorld(copy,1);if(++copyTicks===120){expect(serializeWorld(copy)).toBe(serializeWorld(w));reloadChecked=true;copy=undefined;}}
    const now=spree(pyro);
    if(now&&prev){
      // A warmup of 3 s (180 ticks) once the pawn touches its target.
      if(now.stanceCore!==null&&!now.cast&&prev.stanceCore===null)warmups.push(now.stanceCore-w.tick*10);
      // The cast: a fire at the target, then a cooldown of 1.3 s (78 ticks).
      if(now.cast&&!prev.cast&&now.igniteId!==null){
        ignited.push(now.igniteId);expect(now.stanceCore).toBe(w.tick*10+IGNITE_COOLDOWN_CORE_368);
        expect(w.fires?.items.some(f=>f.attachedPawnId===undefined)).toBe(true);
      }
      // nextMoveOrderIsWait: a wait of 80 to 140 ticks after each job.
      if(prev.waitNext&&!now.waitNext)waits.push(Math.round((now.waitUntil-w.tick)*10));
    }
    prev=structuredClone(now);
    expect(pyro.firefighting).toBeUndefined();
  }
  expect(reloadChecked).toBe(true);
  expect(spree(pyro)).toBeUndefined();
  expect(ignited.length).toBeGreaterThan(0);
  for(const id of ignited)expect(targets).toContain(id);
  expect(w.fires!.ledger.ignitions).toBeGreaterThanOrEqual(ignited.length);
  // Mood-caused: Catharsis on recovery.
  expect(pyro.mental!.catharsis).toHaveLength(1);
  expect(warmups.length).toBeGreaterThan(0);expect(new Set(warmups)).toEqual(new Set([IGNITE_WARMUP_CORE_368]));
  expect(waits.length).toBeGreaterThan(1);for(const wait of waits)expect(wait).toBeGreaterThanOrEqual(80),expect(wait).toBeLessThanOrEqual(140);
  expect(validateWorld(w)).toEqual([]);
});

test('the trait\'s random spree (MTB 50 days at any mood) is not caused by mood: no catharsis; other colonists never get it',()=>{
  const {w,pyro,b}=playground();pyro.mood=80;
  hook.randomState.add(pyro.id);hook.randomState.add(b.id);
  try{
    for(let t=0;t<15&&!spree(pyro);t++){fed(w);stepWorld(w,1);}
    const c=spree(pyro);expect(c).toBeDefined();expect(c!.notMood362).toBe(true);
    expect(b.mental?.crisis).toBeUndefined();
    expect(w.events.some(e=>e.message.includes('Dernière cause : Pyromane'))).toBe(true);
    expect(mentalCrisisStatus(w,pyro)).toContain('Frénésie incendiaire');
    hook.randomState.clear();
    for(let t=0;t<1100&&spree(pyro);t++){fed(w);stepWorld(w,1);}
    expect(spree(pyro)).toBeUndefined();expect(pyro.mental!.catharsis).toEqual([]);
  }finally{hook.randomState.clear();}
});

test('PyromaniacNearFire: +2 per fire within 8 cells in the same room, lit campfires included, at most four',()=>{
  const w=camp(),[pyro,b]=w.pawns as [Pawn,Pawn];
  pyro.traits=['pyromaniac'];Object.assign(pyro,{x:10,z:10});Object.assign(b,{x:12,z:12});
  const fireThought=()=>moodThoughts(w,pyro).find(t=>t.id==='pyromaniac-near-fire');
  expect(pyromaniacFiresNear368(w,pyro)).toBe(0);expect(fireThought()).toBeUndefined();
  const campfire=fixtureBuilding(w,'campfire',12,10);expect(campfire.fuel?.ticks).toBeGreaterThan(0);
  expect(fireThought()).toMatchObject({label:'Beau feu',offset:2});
  campfire.fuel!.ticks=0;expect(fireThought()).toBeUndefined();campfire.fuel!.ticks=100;
  // A burning wood pile: the fire and the pile both count (FireUtility.NumFiresAt).
  addGroundMaterial(w,'wood',10,{x:10,z:14},'wood');expect(startFire(w,{x:10,z:14},.5)).toBe(true);
  expect(pyromaniacFiresNear368(w,pyro)).toBe(3);expect(fireThought()).toMatchObject({label:'Beau feu ×3',offset:6});
  // Out of range (9 cells) and beyond the stack limit.
  addGroundMaterial(w,'wood',10,{x:19,z:10},'wood');expect(startFire(w,{x:19,z:10},.5)).toBe(true);
  expect(pyromaniacFiresNear368(w,pyro)).toBe(3);
  addGroundMaterial(w,'wood',10,{x:8,z:10},'wood');expect(startFire(w,{x:8,z:10},.5)).toBe(true);
  expect(pyromaniacFiresNear368(w,pyro)).toBe(4);expect(fireThought()).toMatchObject({label:'Beau feu ×4',offset:8});
  // Another room: a walled pyromaniac sees none of them.
  for(let x=1;x<=5;x++)for(let z=1;z<=5;z++)if(x===1||x===5||z===1||z===5)w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});
  Object.assign(pyro,{x:3,z:3});expect(pyromaniacFiresNear368(w,pyro)).toBe(0);
  // Only the pyromaniac feels it.
  expect(moodThoughts(w,b).some(t=>t.id==='pyromaniac-near-fire')).toBe(false);
});

test('strict saves: the spree and the trait from 368 only; malformed spree jobs refused; 367 migrates by number only',()=>{
  const {w,pyro,b}=playground();
  const current=serializeWorld(w);
  // 367: the trait is stripped by the old-schema helper; the save then migrates by number only.
  const old=JSON.parse(asOldSchema(current,367));
  expect(serializeWorld(deserializeWorld(JSON.stringify(old)))).toBe(serializeWorld(numberOnlyWorld(old)));expect(old.pawns.find((p:Pawn)=>p.id===pyro.id).traits).toBeUndefined();
  const forged=structuredClone(old);forged.pawns.find((p:Pawn)=>p.id===pyro.id).traits=['pyromaniac'];
  expect(()=>deserializeWorld(JSON.stringify(forged))).toThrow();
  // A live spree, saved mid-job.
  const s=breakNow(w,pyro),p=s.pawns.find(q=>q.id===pyro.id)!;
  for(let t=0;t<400&&spree(p)?.igniteId==null;t++){fed(s);stepWorld(s,1);}
  expect(spree(p)?.igniteId).not.toBeNull();
  const live=serializeWorld(s);expect(serializeWorld(deserializeWorld(live))).toBe(live);
  // Kept and refused below 368 (the old-schema helper strips only the trait).
  expect(()=>deserializeWorld(asOldSchema(live,367))).toThrow();
  const bad=(edit:(c:Record<string,unknown>,raw:Record<string,unknown>)=>void)=>{
    const raw=JSON.parse(live);const q=raw.pawns.find((x:Pawn)=>x.id===pyro.id);edit(q.mental.crisis,raw);
    expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow();
  };
  bad(c=>{delete c.waitNext;});
  bad(c=>{c.cast='yes';});
  bad(c=>{c.igniteId=null;c.stanceCore=s.tick*10+10;c.target=null;});
  bad(c=>{c.stanceCore=null;c.cast=true;});
  bad(c=>{c.stanceCore=s.tick*10+500;c.target=null;});
  bad(c=>{c.igniteId=b.id;});
  bad(c=>{c.extra=1;});
  bad((_c,raw)=>{(raw.pawns as Pawn[]).find(x=>x.id===pyro.id)!.traits=['kind'];});
  bad((_c,raw)=>{(raw.pawns as Pawn[]).find(x=>x.id===pyro.id)!.prisoner={capturedAt:0,mode:'maintain'} as never;});
});
