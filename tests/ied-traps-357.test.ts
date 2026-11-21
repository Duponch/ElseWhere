import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {constructionRecipe,constructionSkillRequired,validConstructionMaterial} from '../src/sim/construction-materials.ts';
import {STRUCTURE_DEFINITIONS} from '../src/sim/definitions.ts';
import {pileFlammability,pileMaxHp,structureFlammability,structureLeavesResources,structureMaxHp} from '../src/sim/thing-damage-rules.ts';
import {groupPackedMassGrams258} from '../src/sim/group-freight-mass-258.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {DETERIORATION_RATES} from '../src/sim/deterioration-content.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {RESEARCH_SCALE,needsHighTechBench,researchCost,researchPrerequisite,researchUnlocked,selectResearch} from '../src/sim/research.ts';
import {validateResearch,validIedResearchTransport357} from '../src/sim/research-save.ts';
import {IED_COMMON_357,IED_RESEARCH_357,IED_TRAPS_357,MORTAR_SHELL_TAG_357,SHELL_FACTS_357,iedsUnlocked357,startIedWick357} from '../src/sim/ied-traps-357.ts';
import {trySpringIedTrap357} from '../src/sim/ied-trap-spring-357.ts';
import {initialSpikeTrapState,spikeTrapKnowsOf,spikeTrapPlacementAllowed,spikeTrapSpringChance,spikeTrapTargetKey,SPIKE_TRAP_SEARCH_COST} from '../src/sim/spike-trap-state.ts';
import {applySpikeTrapSwitch} from '../src/sim/spike-traps.ts';
import {damageStructure} from '../src/sim/thing-damage.ts';
import {navigationCosts} from '../src/sim/furniture-travel.ts';
import {blockedCells,reachableCells,routeToCell} from '../src/sim/pathfinding.ts';
import {startTravel} from '../src/sim/movement.ts';
import {caravanDealsIn332,generateCaravanStock332} from '../src/sim/trader-caravans-332.ts';
import {structureBeauty} from '../src/sim/room-beauty.ts';
import {architectToolAvailable} from '../src/ui/architect-availability.ts';
import {legacyHumanAge} from '../src/sim/human-age.ts';
import {medicalCamp} from './scenarios/health.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Command,type Pawn,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
function until(w:World,done:()=>boolean,limit=4000){
  for(let i=0;i<limit&&!done();i++){stepWorld(w);if(i%250===0)expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);}
  expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs.map(j=>({kind:j.kind,status:j.status,progress:j.progress})),pawns:w.pawns.map(p=>({state:p.state,job:p.jobId}))})).toBe(true);
  expect(validateWorld(w)).toEqual([]);
}
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const knownIeds=():World['research']=>({project:null,points:0,ieds:{points:IED_RESEARCH_357.scaledCost,completedAt:0}});
/** Declared open 32² field: two healthy humans on soil, no building, plan or pile. */
function field(){
  const w=medicalCamp(2);w.structures=[];w.jobs=[];w.resources=[];w.piles=[];w.packed=[];delete w.home;w.tiles=w.tiles.map(()=>({terrain:'soil'}));
  for(const [i,p] of w.pawns.entries()){p.age=legacyHumanAge();delete p.health;Object.assign(p,{x:4+i,z:4,hunger:100,rest:100,restZeroTicks:0,collapsePending:false,state:'idle',path:[],motion:null,moveCooldown:0});}
  w.research=knownIeds();refreshStock(w);return {w,colonist:w.pawns[0]!,raider:w.pawns[1]!};
}
const trap=(w:World,kind:'ied-high-explosive'|'ied-incendiary',x:number,z:number):Structure=>{const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'steel',spikeTrap:initialSpikeTrapState(w,{x,z})};w.structures.push(s);refreshStock(w);return s;};
const injuries=(p:Pawn)=>(p.health?.injuries.length??0)+(p.health?.missing.length??0);

test('the IED traps, the IEDs research and the two shells carry the Core facts',()=>{
  expect(IED_COMMON_357).toMatchObject({shellCount:2,maxHitPoints:40,coreWork:1400,constructionSkill:3,beauty:-4,massGrams:2000,flammability:1,radius:3.9,wickCore:15,startWickHitPoints:8,peacefulWildAnimalFactor:.25});
  expect(IED_TRAPS_357['ied-high-explosive']).toMatchObject({defName:'TrapIED_HighExplosive',shell:'shell-high-explosive',damage:'bomb'});
  expect(IED_TRAPS_357['ied-incendiary']).toMatchObject({defName:'TrapIED_Incendiary',shell:'shell-incendiary',damage:'flame'});
  for(const kind of ['ied-high-explosive','ied-incendiary'] as const){
    const shell=IED_TRAPS_357[kind].shell;
    expect(constructionRecipe({kind,material:'steel'})).toEqual({ingredients:[{item:shell,quantity:2}],work:140,coreWork:1400});
    expect(validConstructionMaterial(kind,'steel',357)).toBe(true);expect(validConstructionMaterial(kind,'wood',357)).toBe(false);expect(validConstructionMaterial(kind,'steel',356)).toBe(false);
    expect(constructionSkillRequired(kind,357)).toBe(3);
    expect(STRUCTURE_DEFINITIONS[kind]).toMatchObject({width:1,depth:1,blocksMovement:false});
    const s={kind,material:'steel'} as Structure;
    expect(structureMaxHp(s)).toBe(40);expect(structureFlammability(s)).toBe(1);expect(structureLeavesResources(s)).toBe(false);
    expect(structureBeauty(s)).toBe(-4);
    expect(groupPackedMassGrams258({building:{kind}} as never,357)).toBe(2000);expect(groupPackedMassGrams258({building:{kind}} as never,356)).toBeUndefined();
  }
  expect(IED_RESEARCH_357).toMatchObject({points:500,techLevel:'Industrial'});
  expect(researchCost('ieds')).toBe(500*RESEARCH_SCALE);expect(needsHighTechBench('ieds')).toBe(false);
  for(const item of ['shell-high-explosive','shell-incendiary'] as const){
    expect(ITEM_DEFINITIONS[item]).toMatchObject({kind:'shell',stackLimit:25});
    expect(pileMaxHp({item,kind:'shell'},357)).toBe(60);expect(pileMaxHp({item,kind:'shell'},356)).toBe(0);expect(pileFlammability({item,kind:'shell'})).toBe(1);
    expect(tradeCatalogueEntry(item)).toMatchObject({baseMarketValue:55,maxHitPoints:60,healthAffectsPrice:true,playerCanBuy:true,playerCanSell:true});
    expect(DETERIORATION_RATES[item]).toBe(1.5);
  }
  expect(SHELL_FACTS_357).toMatchObject({marketValue:55,massGrams:1250,maxHitPoints:60,flammability:1,deterioration:1.5,stackLimit:25});
});

test('combat-supplier and pirate caravans stock shells from the Core MortarShell tag at 357 and buy them back',()=>{
  // The tag pool keeps Core's five trader-sellable shells; three are not represented.
  expect(MORTAR_SHELL_TAG_357).toEqual(['shell-high-explosive','shell-incendiary',null,null,null]);
  for(const kind of ['outlander-combat','outlander-slaver'] as const)for(const item of ['shell-high-explosive','shell-incendiary'])expect(caravanDealsIn332(kind).has(item as never)).toBe(true);
  expect(caravanDealsIn332('outlander-bulk').has('shell-high-explosive')).toBe(false);
  let found=0;
  for(let seed=1;seed<40;seed++){
    const now=generateCaravanStock332(seed*7919,5,100,3000,'outlander-combat',357),before=generateCaravanStock332(seed*7919,5,100,3000,'outlander-combat',356);
    const shells=now.piles.filter(p=>p.kind==='shell');
    expect(before.piles.some(p=>p.kind==='shell')).toBe(false);
    // Every other generator draws exactly as before; the tag only appends, on
    // its own sub-stream, so the caravan's RNG continues unchanged.
    expect(now.piles.slice(0,before.piles.length).map(p=>[p.item,p.quantity])).toEqual(before.piles.map(p=>[p.item,p.quantity]));
    expect(now.rng).toBe(before.rng);
    for(const p of shells){expect(p.quantity).toBeGreaterThanOrEqual(3);expect(p.quantity).toBeLessThanOrEqual(15);}
    found+=shells.length;
  }
  expect(found).toBeGreaterThan(0);
});

test('IEDs is researched at a simple desk, then a high-explosive trap is built from two delivered shells',()=>{
  const w=deconstructionCamp(1,32);w.resources=[];w.research={project:null,points:0};
  const pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.research=1;pawn.priorities.build=2;pawn.priorities.basic=3;pawn.schedule.fill('work');
  pawn.skills.intellectual={level:12,xp:0,dailyXp:0,passion:0};pawn.skills.construction={level:8,xp:0,dailyXp:0,passion:0};
  w.structures.push({id:w.nextId++,kind:'research-bench',x:17,z:12,orientation:0,footprint:'standard',material:'wood'} as Structure);
  addGroundMaterial(w,'shell',3,{x:12,z:16},'shell-high-explosive');refreshStock(w);expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'designate',kind:'ied-high-explosive',x:20,z:20,material:'steel'}).ok).toBe(false);
  expect(architectToolAvailable(w,'ied-high-explosive')).toBe(false);expect(researchPrerequisite(w,'ieds')).toBeUndefined();
  accept(w,{type:'research-project',project:'ieds'});expect(w.research!.ieds).toEqual({points:0});
  until(w,()=>(w.research!.ieds!.points)>0,600);
  // Declared prepared: the first 490 points stand for days of the same desk work.
  w.research!.ieds!.points=490*RESEARCH_SCALE;expect(validateWorld(w)).toEqual([]);
  until(w,()=>researchUnlocked(w,'ieds'),6000);
  expect(iedsUnlocked357(w)).toBe(true);expect(w.events.some(e=>e.message.includes('EEI'))).toBe(true);
  expect(architectToolAvailable(w,'ied-high-explosive')).toBe(true);
  accept(w,{type:'designate',kind:'ied-high-explosive',x:20,z:20,material:'steel'});
  // NeverAdjacentTrap: no other trap, plan or frame in the eight neighbours.
  expect(applyCommand(w,{type:'designate',kind:'ied-incendiary',x:21,z:21,material:'steel'}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'spike-trap',x:19,z:20,material:'wood'}).ok).toBe(false);
  until(w,()=>w.structures.some(s=>s.kind==='ied-high-explosive'),6000);
  const built=w.structures.find(s=>s.kind==='ied-high-explosive')!;
  expect(built).toMatchObject({x:20,z:20,material:'steel',spikeTrap:{autoRebuild:false,touching:[]}});expect(built.iedWick357).toBeUndefined();
  expect(quantity(w,'shell-high-explosive')).toBe(1);
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('a raider walks onto a high-explosive IED through real ticks: wick, Bomb explosion, destruction and rebuild plan',()=>{
  const {w,colonist,raider}=field();raider.faction='outlaws';Object.assign(raider,{x:15,z:16});
  w.home=[16*w.width+16];
  const s=trap(w,'ied-high-explosive',16,16),wall=fixtureBuilding(w,'wall',17,18) as Structure;wall.material='steel';
  expect(s.spikeTrap!.autoRebuild).toBe(true);expect(validateWorld(w)).toEqual([]);
  expect(spikeTrapKnowsOf(w,raider)).toBe(false);expect(spikeTrapSpringChance(w,raider,s.kind)).toBe(1);
  expect(startTravel(w,raider,s)).toBe(true);
  const health=injuries(raider);
  until(w,()=>!!s.iedWick357,40);
  // Lit on the contact Core with the raider as instigator; 14 more Core ticks.
  expect(s.iedWick357!.endCore-s.iedWick357!.startedAtCore).toBe(14);expect(s.iedWick357!.instigatorKey).toBe(`pawn:${raider.id}`);
  expect(s.spikeTrap!.touching).toEqual([`pawn:${raider.id}`]);expect(w.structures).toContain(s);
  // Save and reload with the wick burning; both copies continue identically.
  const copy=deserializeWorld(serializeWorld(w));expect(copy).toEqual(w);
  until(w,()=>!w.structures.includes(s),10);
  const plan=w.jobs.find(j=>j.kind==='ied-high-explosive')!;
  expect(plan).toMatchObject({x:16,z:16,construction:'blueprint',material:'steel',progress:0});
  expect(w.destroyed?.lost['shell-high-explosive' as never]).toBe(2);
  expect(w.piles.some(p=>p.item==='shell-high-explosive')).toBe(false);
  stepWorld(w,4);
  expect(injuries(raider)).toBeGreaterThan(health);
  // Bomb 50 x buildingDamageFactorImpassable 4 on a 300 HP steel wall.
  expect(structureMaxHp(wall)).toBe(300);expect(wall.damage).toBe(200);
  expect(injuries(colonist)).toBe(0);
  expect(validateWorld(w)).toEqual([]);
  stepWorld(copy,w.tick-copy.tick);expect(serializeWorld(copy)).toBe(serializeWorld(w));
});

test('a raider on an incendiary IED starts fires and burns the area; a colonist knows of it and walks around',()=>{
  const {w,colonist,raider}=field();raider.faction='outlaws';Object.assign(raider,{x:15,z:16});Object.assign(colonist,{x:14,z:10});
  const s=trap(w,'ied-incendiary',16,16);
  // A colonist knows the trap: Core's 800 path cost (Core units) and a route around it.
  expect(spikeTrapKnowsOf(w,colonist)).toBe(true);expect(spikeTrapSpringChance(w,colonist,s.kind)).toBe(.005);
  const i=s.z*w.width+s.x;expect(Math.round(SPIKE_TRAP_SEARCH_COST*.03)).toBe(800);
  expect(navigationCosts(w,colonist).costs!.get(i)!-(navigationCosts(w,raider).costs?.get(i)??0)).toBe(800);
  const blocked=blockedCells(w),route=routeToCell(w,{x:17,z:16},reachableCells(w,{...colonist,x:15,z:16} as Pawn,blocked,new Set()))!;
  expect(route.some(c=>c.x===16&&c.z===16)).toBe(false);
  expect(routeToCell(w,{x:17,z:16},reachableCells(w,raider,blocked,new Set()))).toEqual([{x:16,z:16},{x:17,z:16}]);
  expect(startTravel(w,raider,s)).toBe(true);
  until(w,()=>!w.structures.includes(s),40);
  expect(w.bombWaves?.some(wave=>wave.ied357?.damage==='flame')||(w.fires?.items.length??0)>0).toBe(true);
  stepWorld(w,4);
  expect((w.fires?.items.length??0)).toBeGreaterThan(0);
  expect(raider.health?.injuries.some(j=>j.kind==='burn')).toBe(true);
  expect(w.destroyed?.lost['shell-incendiary' as never]).toBe(2);
  expect(w.jobs.some(j=>j.kind==='ied-incendiary')).toBe(false); // outside Home: no automatic rebuild
  expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('spring chances, bullets, low hit points and the auto-rebuild switch follow Building_Trap and CompExplosive',()=>{
  const {w,colonist,raider}=field();const s=trap(w,'ied-high-explosive',16,16);
  // A colonist rarely springs it (0.5 %); a neutral outlander never; a wild calm animal at 0.2 x 0.25.
  raider.faction='outlanders';expect(spikeTrapSpringChance(w,raider,s.kind)).toBe(0);
  const wild={species:'deer',state:'idle'} as never;expect(spikeTrapSpringChance(w,wild,s.kind)).toBeCloseTo(.05);expect(spikeTrapSpringChance(w,wild,'spike-trap')).toBeCloseTo(.2);
  Object.assign(colonist,{x:16,z:16});w.rng=123456789;
  const rng=w.rng;expect(trySpringIedTrap357(w,s,spikeTrapTargetKey(colonist),w.tick*10)).toBe(false);
  expect(w.rng).not.toBe(rng);expect(s.spikeTrap!.touching).toEqual([spikeTrapTargetKey(colonist)]);expect(s.iedWick357).toBeUndefined();
  // A second contact of the same toucher draws nothing.
  const again=w.rng;trySpringIedTrap357(w,s,spikeTrapTargetKey(colonist),w.tick*10);expect(w.rng).toBe(again);
  // A bullet lights the wick without detonating (startWickOnDamageTaken Bullet).
  const shot=trap(w,'ied-high-explosive',8,24);
  expect(damageStructure(w,shot,5,'bullet',w.rng,{core:w.tick*10,rawAmount:5})).toBe(true);
  expect(shot.damage).toBe(5);expect(shot.iedWick357).toMatchObject({startedAtCore:w.tick*10,endCore:w.tick*10+15});
  // Fire to 8 hit points or less lights it too (startWickHitPointsPercent 0.2).
  const burnt=trap(w,'ied-incendiary',24,8);
  expect(damageStructure(w,burnt,31,'fire')).toBe(true);expect(burnt.iedWick357).toBeUndefined();
  expect(damageStructure(w,burnt,1,'fire')).toBe(true);expect(burnt.iedWick357).toBeDefined();
  // A Bomb hit of at least its hit points detonates it at once (chain reaction).
  const chained=trap(w,'ied-high-explosive',24,24),waves=w.bombWaves?.length??0;
  expect(damageStructure(w,chained,100,'bomb',w.rng,{core:w.tick*10,rawAmount:50})).toBe(true);
  expect(w.structures).not.toContain(chained);expect(w.bombWaves!.length).toBe(waves+1);expect(w.bombWaves!.at(-1)!.ied357).toEqual({damage:'bomb'});
  // CanSetAutoRearm needs the finished research.
  expect(applySpikeTrapSwitch(w,{structureId:s.id,on:true}).ok).toBe(true);expect(s.spikeTrap!.autoRebuild).toBe(true);
  w.research={project:null,points:0};expect(applySpikeTrapSwitch(w,{structureId:s.id,on:false}).ok).toBe(false);
  w.research=knownIeds();expect(spikeTrapPlacementAllowed(w,{x:17,z:17})).toBe(false);
  expect(startIedWick357(s,w.tick*10)).toBe(true);expect(startIedWick357(s,w.tick*10)).toBe(false);
  expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('at schema 356 the traps, shells and research are refused; a 356 save migrates by its number only',()=>{
  const {w}=field();trap(w,'ied-high-explosive',16,16);expect(validateWorld(w)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(w),356))).toThrow();
  const shells=field().w;shells.research={project:null,points:0};addGroundMaterial(shells,'shell',5,{x:10,z:10},'shell-incendiary');refreshStock(shells);expect(validateWorld(shells)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(shells),356))).toThrow();
  const researched=field().w;expect(validateWorld(researched)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(researched),356))).toThrow();
  expect(validIedResearchTransport357(researched,356)).toBe(false);expect(validIedResearchTransport357(researched,357)).toBe(true);
  expect(validateResearch({...researched,research:{project:'ieds',points:0}} as World,357)).not.toEqual([]);
  const old=deconstructionCamp(1,32);old.schemaVersion=356 as World['schemaVersion'];old.research={project:null,points:0};
  expect(selectResearch(old,'ieds').ok).toBe(false);expect(old.research.ieds).toBeUndefined();
  // A trap plan needs the research, even in a valid 357 save.
  const order=deconstructionCamp(1,32);order.research={project:null,points:0};
  order.jobs.push({id:order.nextId++,kind:'ied-high-explosive',x:6,z:6,orientation:0,footprint:'standard',material:'steel',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}} as World['jobs'][number]);
  expect(validateWorld(order)).not.toEqual([]);
  // Migration: an IED-free current save, relabelled 356, loads unchanged.
  const plain=deconstructionCamp(2,32),current=serializeWorld(plain);
  const migrated=deserializeWorld(asOldSchema(current,356));
  expect(serializeWorld(migrated)).toBe(current);expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(migrated.research?.ieds).toBeUndefined();expect(migrated.structures.some(s=>s.kind==='ied-high-explosive'||s.kind==='ied-incendiary')).toBe(false);
});
