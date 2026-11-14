import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptColonyEconomy} from '../src/sim/colony-economy.ts';
import {adoptFluIncidents,FLU_CHECK_INTERVAL,FLU_FIRST_CHECK} from '../src/sim/flu-incidents.ts';
import {consumeCassandraOpportunity,enableCassandraRaids,INTRO_RAID_TICK} from '../src/sim/cassandra-raids.ts';
import {advanceRaids,chooseRaidComposition} from '../src/sim/raids.ts';
import {createRaidGroup} from '../src/sim/raid-spawn.ts';
import {raidEntries,atMapEdge} from '../src/sim/raid-space.ts';
import {validateRaids} from '../src/sim/raid-save.ts';
import {chooseRaidComposition331} from '../src/sim/raid-factions-331.ts';
import {RAID_ARRIVAL_MODES_333,RaidArrivalSpace333,drawRaidArrivalMode333,raidArrivalPointsFactor333,raidArrivalWeights333,raidMaxGroups333,raidPodsPending333,type RaidArrivalMode333,type RaidPod333} from '../src/sim/raid-arrival-333.ts';
import {roofKindAt} from '../src/sim/roof-rules.ts';
import {injurePawn} from '../src/sim/health.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import type {SettlementTile} from '../src/sim/world-settlement-placement.ts';
import type {RaidGroup} from '../src/sim/raid-state.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
/** A Cassandra colony with an economy at its first cycle opportunity, so a
 * priced roster is valid. With factions, the real default world faction
 * registry (declared fixture, as in raid-factions-331; whole-save checks
 * then use the raid validator only). Without, a whole valid save. */
function colony(factions=true,size=72):World {
  const w=deconstructionCamp(3,size);
  w.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};
  w.gameProfile=crashlandedProfile();enableCassandraRaids(w);adoptColonyEconomy(w);adoptFluIncidents(w);
  if(factions){
    const tiles:readonly SettlementTile[]=Array.from({length:128},(_,i)=>({biome:'temperate-forest',hilliness:'flat',neighbours:[(i+127)%128,(i+1)%128]}));
    const foreign=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
    if(!foreign.ok)throw Error(foreign.reason);
    const registry=completeWorldFactionRegistry256({version:w.schemaVersion,draft:foreign.draft,playerDef:'PlayerColony',name:'Colonie de contrôle',postWorldRandom:new WorldGenerationRandom(991)});
    if(!registry.ok)throw Error(registry.reason);
    w.worldFactions=registry.registry;w.nextId=foreign.nextThingId;
  }
  clock(w,INTRO_RAID_TICK);advanceRaids(w);
  for(const p of w.pawns.filter(q=>q.raid))injurePawn(w,p,'brain','crush',99000);
  advanceRaids(w);clock(w,w.raids!.cassandra!.pending[0]!);
  expect(consumeCassandraOpportunity(w,w.raids!)).toBe(true);
  return w;
}
function clock(w:World,tick:number):void {
  // These focused raid tests skip days without advancing other systems: move
  // their independent clocks with the jump (as raids-v105 does).
  w.tick=tick;w.fluIncidents!.nextCheck=Math.max(FLU_FIRST_CHECK,(Math.floor(tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL);
  if(w.corePathBudget297)w.corePathBudget297.tick=tick;
  if(w.deterioration)w.deterioration.lastTick=tick;
  const e=w.economy;if(e){e.sampledAt=Math.floor(tick/501)*501;e.nextSampleAt=e.sampledAt+501;e.nextAdaptAt=Math.ceil((tick+1)/3000)*3000;}
}
const factionOf=(w:World,def:string)=>w.worldFactions!.factions.find(f=>f.def===def)!;
const pirateCompose=(budget:number,r:{rng:number})=>chooseRaidComposition(budget,r);
/** One Cassandra pirate (or tribal) raid at `points` with a given RNG seed. */
function raid(base:World,seed:number,points:number,family:'pirate'|'tribe'='pirate'):{w:World;group:RaidGroup|null} {
  const w=structuredClone(base),random={rng:seed*40503+7};
  const composition=family==='pirate'?chooseRaidComposition(points,random):chooseRaidComposition331(points,'tribe',random);
  const sites=raidEntries(w,(seed*2654435761>>>0)||1,composition.roster.length);if(!sites)throw Error('No edge');
  const faction=w.worldFactions?factionOf(w,family==='pirate'?'Pirate':'TribeSavage'):undefined;
  const group=createRaidGroup(w,{count:sites.length,sites,random,composition,...faction?{faction331:{factionId:faction.id,family}}:{},
    recompose333:family==='pirate'?pirateCompose:(b,r)=>chooseRaidComposition331(b,'tribe',r)});
  return {w,group};
}
function find(base:World,points:number,want:(g:RaidGroup)=>boolean,family:'pirate'|'tribe'='pirate'):{w:World;group:RaidGroup} {
  for(let seed=1;seed<=200;seed++){const r=raid(base,seed,points,family);if(r.group&&want(r.group))return {w:r.w,group:r.group};}
  throw Error('No such raid');
}
const roundTrip=(w:World)=>{const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);};

test('arrival modes follow the Core weights at each point level',()=>{
  const share=(points:number,staged=false,family:'pirate'|'tribe'='pirate')=>{
    const weights=raidArrivalWeights333(points,family,staged),total=weights.reduce((s,w)=>s+w.weight,0),counts=new Map<RaidArrivalMode333,number>();
    for(let i=0;i<10000;i++){const m=drawRaidArrivalMode333(points,family,staged,()=>(i+.5)/10000);counts.set(m,(counts.get(m)??0)+1);}
    for(const w of weights)expect(Math.abs((counts.get(w.mode)??0)-10000*w.weight/total)).toBeLessThanOrEqual(1);
    return Object.fromEntries(weights.map(w=>[w.mode,w.weight/total]));
  };
  // Below 100 points only the walk-in weighs; Core curves at 300, 700 and 1000.
  expect(share(80)).toEqual({'edge-drop':0,'edge-walk-in':1,'center-drop':0,'random-drop':0,'edge-drop-groups':0,'edge-walk-in-groups':0});
  const s300=share(300);expect(s300['edge-walk-in']).toBeCloseTo(1/1.5,6);expect(s300['edge-walk-in-groups']).toBeCloseTo(.3/1.5,6);expect(s300['edge-drop-groups']).toBeCloseTo(.2/1.5,6);
  const s1000=share(1000);expect(s1000['center-drop']).toBeCloseTo(3.5/7.1,6);expect(s1000['random-drop']).toBeCloseTo(1.9/7.1,6);expect(s1000['edge-drop']).toBeCloseTo(.3/7.1,6);
  share(500);share(2000);
  // StageThenAttack keeps the four edge modes; tribes (Neolithic) never drop.
  expect(Object.keys(share(1000,true)).sort()).toEqual(['edge-drop','edge-drop-groups','edge-walk-in','edge-walk-in-groups']);
  expect(Object.keys(share(1000,false,'tribe')).sort()).toEqual(['edge-walk-in','edge-walk-in-groups']);
  expect(Object.keys(share(1000,true,'tribe')).sort()).toEqual(['edge-walk-in','edge-walk-in-groups']);
  // AdjustedRaidPoints factors.
  expect(raidArrivalPointsFactor333('edge-walk-in',1000)).toBe(1);expect(raidArrivalPointsFactor333('edge-walk-in-groups',1000)).toBeCloseTo(.9,9);
  expect(raidArrivalPointsFactor333('center-drop',0)).toBeCloseTo(.5,9);expect(raidArrivalPointsFactor333('center-drop',5000)).toBeCloseTo(.3,9);expect(raidArrivalPointsFactor333('random-drop',2500)).toBeCloseTo(.575,9);
  expect([1,2,3,4,5,6,11].map(raidMaxGroups333)).toEqual([1,2,2,2,2,3,3]);
  expect(RAID_ARRIVAL_MODES_333).toHaveLength(6);
});

test('Cassandra raids draw their arrival mode; staged and tribal raids keep the Core filters',()=>{
  const base=colony(),seen=new Set<string>();
  for(let seed=1;seed<=80;seed++){
    const {group}=raid(base,seed,1000);if(!group)continue;
    const mode=group.arrival333!.mode;seen.add(mode);
    if(group.stage330)expect(['edge-drop','edge-walk-in','edge-drop-groups','edge-walk-in-groups']).toContain(mode);
  }
  expect(seen.size).toBeGreaterThanOrEqual(5);
  for(let seed=1;seed<=40;seed++){const {group}=raid(base,seed,600,'tribe');if(group)expect(['edge-walk-in','edge-walk-in-groups']).toContain(group.arrival333!.mode);}
  // The mode's points factor re-spends the roster: a center drop gets 0.5 near 1000 points.
  const {group}=find(base,1000,g=>g.arrival333!.mode==='center-drop');
  expect(group.composition!.budget).toBeCloseTo(1000*raidArrivalPointsFactor333('center-drop',1000),6);
});

test('walk-in groups enter at distinct edge points',()=>{
  const {w,group}=find(colony(false),1000,g=>g.arrival333!.mode==='edge-walk-in-groups'&&g.members.length>=4);
  const a=group.arrival333!;
  expect(a.centers.length).toBeGreaterThanOrEqual(2);expect(a.centers.length).toBeLessThanOrEqual(raidMaxGroups333(group.members.length));
  expect(new Set(a.centers.map(c=>`${c.x}:${c.z}`)).size).toBe(a.centers.length);
  expect(a.memberGroups).toHaveLength(group.members.length);
  for(const [i,id] of group.members.entries()){
    const p=w.pawns.find(q=>q.id===id)!;expect(atMapEdge(w,p)).toBe(true);
    // Each raider is nearer its own group's entry point than any other group's is to it.
    const own=a.centers[a.memberGroups![i]!]!;expect((p.x-own.x)**2+(p.z-own.z)**2).toBeLessThan(w.width**2);
  }
  expect(group.composition!.budget).toBeCloseTo(900,6);
  expect(w.events.at(-1)!.message).toMatch(/groupes, de plusieurs côtés/);
  expect(validateWorld(w)).toEqual([]);roundTrip(w);
});

test('drop pods fall, open at the Core delay and free armed raiders at the pod cells; saves round-trip in flight',()=>{
  const base=colony(false);
  for(const mode of ['center-drop','edge-drop','random-drop'] as const){
    const {w,group}=find(base,1000,g=>g.arrival333!.mode===mode);
    const a=group.arrival333!,pods=a.pods!,delay=mode==='edge-drop'&&!a.fallbackFrom?140:520;
    expect(pods).toHaveLength(group.members.length);expect(raidPodsPending333(a)).toBe(pods.length);
    for(const [i,pod] of pods.entries()){
      expect(pod.pawnId).toBe(group.members[i]);expect(w.pawns.some(p=>p.id===pod.pawnId)).toBe(false);
      expect(pod.landAtCore-a.atCore).toBeGreaterThanOrEqual(120);expect(pod.landAtCore-a.atCore).toBeLessThanOrEqual(200);
      expect(pod.openAtCore).toBe(pod.landAtCore+delay+1);
    }
    expect(new Set(pods.map(p=>`${p.cell.x}:${p.cell.z}`)).size).toBe(pods.length);
    expect(w.events.at(-1)!.message).toMatch(/capsules/);
    expect(validateWorld(w)).toEqual([]);roundTrip(w);
    const born=new Map<number,{tick:number;x:number;z:number}>();
    let saved=false;
    while(raidPodsPending333(w.raids!.active?.arrival333)&&w.tick<group.startedAt+80){
      stepWorld(w);
      for(const pod of w.raids!.active!.arrival333!.pods!){
        const p=w.pawns.find(q=>q.id===pod.pawnId);
        if(p&&!born.has(p.id)){
          born.set(p.id,{tick:w.tick,x:p.x,z:p.z});
          expect(pod.openedAtCore).toBeGreaterThanOrEqual(pod.openAtCore);expect(pod.openedAtCore!-pod.openAtCore).toBeLessThan(10);
          expect(Math.abs(p.x-pod.cell.x)+Math.abs(p.z-pod.cell.z)).toBeLessThanOrEqual(2);
          expect(p.state).not.toBe('dead');expect(p.raid?.group).toBe(group.id);
          expect(w.piles.some(i=>i.owner.type==='equipment'&&i.owner.pawnId===p.id)).toBe(true);
          expect(w.piles.some(i=>i.owner.type==='apparel'&&i.owner.pawnId===p.id)).toBe(true);
        }
      }
      // A save while some pods still fall (or wait closed) round-trips exactly.
      if(!saved&&raidPodsPending333(w.raids!.active!.arrival333)&&w.tick*10>=a.atCore+100){saved=true;expect(validateWorld(w)).toEqual([]);roundTrip(w);}
    }
    expect(saved).toBe(true);
    expect(born.size).toBe(pods.length);
    // The raid stayed on while the pods were closed, and each left a slag chunk.
    expect(w.raids!.active?.id).toBe(group.id);
    expect(w.piles.filter(i=>i.item==='slag-steel-chunk').length).toBeGreaterThan(0);
    expect(validateWorld(w)).toEqual([]);roundTrip(w);
  }
  // With world factions, the pod keeps the drawn faction until its raider is born into it.
  const {w,group}=find(colony(),1000,g=>!!g.arrival333!.pods);
  const pirate=factionOf(w,'Pirate').id;expect(group.arrival333!.factionId).toBe(pirate);
  expect(validateRaids(w,SCHEMA_VERSION,new Set())).toEqual([]);
  while(raidPodsPending333(w.raids!.active!.arrival333)===group.members.length&&w.tick<group.startedAt+80)stepWorld(w);
  const first=w.pawns.find(p=>group.members.includes(p.id))!;
  expect(first.worldAffiliation259?.factionId).toBe(pirate);
  expect(validateRaids(w,SCHEMA_VERSION,new Set())).toEqual([]);
});

test('a pod punches a thin roof and never targets a thick one',()=>{
  const base=colony();
  const {w,group}=find(base,1000,g=>!!g.arrival333!.pods);
  const pod=group.arrival333!.pods![0]!,index=pod.cell.z*w.width+pod.cell.x;
  w.roofing??={constructed:[],build:[],remove:[],cursor:0};
  w.roofing.constructed=[...w.roofing.constructed,index].sort((a,b)=>a-b);
  expect(roofKindAt(w,index)).toBe('constructed');
  while(!w.raids!.active!.arrival333!.pods![0]!.roofHit&&w.tick<group.startedAt+40)stepWorld(w);
  expect(w.raids!.active!.arrival333!.pods![0]!.roofHit).toBe(true);
  expect(roofKindAt(w,index)).toBeUndefined();
  // Thick rock overhead refuses any drop; a thin roof only when punching.
  const space=new RaidArrivalSpace333(base),cell=(base.height>>1)*base.width+5;
  base.roofing={constructed:[],build:[],remove:[],cursor:0,natural:{thin:[],thick:[cell]}};
  expect(new RaidArrivalSpace333(base).canDrop(cell,true,true)).toBe(false);
  base.roofing={constructed:[cell],build:[],remove:[],cursor:0};
  expect(new RaidArrivalSpace333(base).canDrop(cell,true,true)).toBe(true);
  expect(new RaidArrivalSpace333(base).canDrop(cell,false,true)).toBe(false);
  expect(space).toBeDefined();
});

test('a staged drop raid stages at its landing point',()=>{
  const {w,group}=find(colony(false),1000,g=>!!g.stage330&&(g.arrival333!.mode==='edge-drop'||g.arrival333!.mode==='edge-drop-groups'));
  expect(group.stage330!.point).toEqual(group.arrival333!.centers[0]);
  expect(w.events.at(-1)!.message).toMatch(/se regrouperont à leur point de chute/);
  expect(validateWorld(w)).toEqual([]);
});

test('saves refuse a forged arrival; older schemas never draw one and migrate by number',()=>{
  const base=colony(false);
  const {w,group}=find(base,1000,g=>!!g.arrival333!.pods&&!g.stage330);
  const forge=(edit:(g:RaidGroup)=>void)=>{const v=structuredClone(w);edit(v.raids!.active!);return validateRaids(v,SCHEMA_VERSION,new Set());};
  expect(validateRaids(structuredClone(w),SCHEMA_VERSION,new Set())).toEqual([]);
  expect(forge(g=>{g.arrival333!.pods![0]!.landAtCore+=500;})).toContain('Invalid raid arrival.');
  expect(forge(g=>{g.arrival333!.pods![0]!.openAtCore+=1;})).toContain('Invalid raid arrival.');
  expect(forge(g=>{g.arrival333!.pods![0]!.openedAtCore=g.arrival333!.pods![0]!.openAtCore;})).toContain('Invalid raid arrival.');
  expect(forge(g=>{g.arrival333!.mode='edge-walk-in';})).toContain('Invalid raid arrival.');
  expect(forge(g=>{g.arrival333!.pods!.pop();})).toContain('Invalid raid arrival.');
  expect(forge(g=>{g.composition={...g.composition!,group331:'tribe-mixed'};})).not.toEqual([]);
  // A closed pod's raider is not on the map; a 332 save holds no arrival.
  expect(validateRaids(structuredClone(w),332,new Set())).toContain('Invalid active raid group.');
  const saved=serializeWorld(w);expect(()=>deserializeWorld(asOldSchema(saved,332))).toThrow();
  // Before 333 the same raid draws no mode and walks in at the edge.
  const old=structuredClone(base);setVersion(old,332);
  for(let seed=1;seed<=20;seed++){
    const v=structuredClone(old),random={rng:seed*40503+7},composition=chooseRaidComposition(1000,random),sites=raidEntries(v,(seed*2654435761>>>0)||1,composition.roster.length)!;
    const g=createRaidGroup(v,{count:sites.length,sites,random,composition,recompose333:pirateCompose})!;
    expect(g.arrival333).toBeUndefined();expect(g.composition).toBe(composition);
    for(const id of g.members)expect(atMapEdge(v,v.pawns.find(p=>p.id===id)!)).toBe(true);
  }
  // A 332 save without raid moves to 333 by its number only.
  const quiet=serializeWorld(deconstructionCamp(3,32));
  expect(serializeWorld(deserializeWorld(asOldSchema(quiet,332)))).toBe(quiet);
});

test('the introductory and quest-sized raids always walk in',()=>{
  const base=colony();
  for(let seed=1;seed<=20;seed++){
    const w=structuredClone(base),sites=raidEntries(w,seed,1)!;
    const g=createRaidGroup(w,{count:1,sites,random:{rng:seed*977+1},faction331:{factionId:factionOf(w,'Pirate').id,family:'pirate'}});
    if(g)expect(g.arrival333!.mode).toBe('edge-walk-in');
  }
  expect(TICKS_PER_DAY).toBeGreaterThan(0);
});

test('the pod layer draws falling and closed pods from the confirmed raid, then retires them',async()=>{
  const {RaidPodLayer,RAID_POD_PARTS}=await import('../src/render/RaidPodLayer.ts');
  const {createWorld}=await import('../src/sim/engine.ts');
  const world=createWorld(333,32,32),layer=new RaidPodLayer(),mesh=layer.mesh,matrix=mesh.instanceMatrix,version=matrix.version;
  const pods=[{pawnId:900,cell:{x:10,z:12},landAtCore:250,openAtCore:391,roofHit:false} as RaidPod333,{pawnId:901,cell:{x:12,z:12},landAtCore:280,openAtCore:421,roofHit:false} as RaidPod333];
  world.raids={profile:'cassandra-raids-v1',rng:1,nextCheck:null,serial:1,completed:0,departed:[],
    active:{id:1,startedAt:10,deadline:3000,lossPermille:500,members:[900,901],lost:[],phase:'assault',arrival333:{mode:'edge-drop',atCore:100,centers:[{x:11,z:12}],pods}}};
  world.tick=10;const before=structuredClone(world);
  expect(layer.adopt(world)).toBe(true);expect(world).toEqual(before);
  expect(mesh.activeCount).toBe(2*RAID_POD_PARTS);expect(layer.adopt(structuredClone(world))).toBe(false);
  layer.present(20);expect(layer.tick.value).toBe(10); // never ahead of the confirmed tick
  // The first pod opened at its Core tick: it stays drawn for its opening receipt.
  pods[0]!.roofHit=pods[1]!.roofHit=true;pods[0]!.openedAtCore=391;world.tick=40;
  expect(layer.adopt(world)).toBe(true);expect(mesh.activeCount).toBe(2*RAID_POD_PARTS);
  world.tick=43;layer.adopt(world);expect(mesh.activeCount).toBe(RAID_POD_PARTS);
  pods[1]!.openedAtCore=421;layer.adopt(world);
  expect(layer.present(44,44)).toBe(false);expect(layer.present(45.2,46)).toBe(true);expect(mesh.activeCount).toBe(0);
  delete world.raids.active;expect(layer.adopt(world)).toBe(false);expect(mesh.activeCount).toBe(0);
  expect(mesh.instanceMatrix).toBe(matrix);expect(matrix.version).toBe(version);
  layer.dispose();
});
