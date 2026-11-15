import {beforeAll,expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {deserializeCampaign,deserializeWorld,serializeCampaign,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {opinionCauses,opinionOf} from '../src/sim/social-state.ts';
import {lostThoughtsAt} from '../src/sim/world-map-lost.ts';
import {nutrientPasteUnlocked} from '../src/sim/research.ts';
import {materialAllowedForPlayer256} from '../src/sim/material-permission-256.ts';
import {placeHumanSleepingSpot} from '../src/sim/human-sleeping-spot.ts';
import {adoptWeather} from '../src/sim/weather.ts';
import {temperatureAt} from '../src/sim/temperature.ts';
import {darknessThought343,lightAtPawn343,standingInWater343} from '../src/sim/first-days-343.ts';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft.ts';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings.ts';
import {captureGeneratedGeography256} from '../src/sim/world-geography-owner-256.ts';
import {createGeographicNewGame256} from '../src/sim/geographic-new-game-256.ts';
import {ACTUAL_SHRINES_750_256} from '../src/sim/ancient-temple-orchestration-256.ts';
import {createStartingCandidateRoster} from '../src/sim/starting-candidates.ts';
import {startingOriginalRequestFromRoster256} from '../src/sim/starting-original-request-256.ts';
import {preparePlanetNavigation256} from '../src/sim/planet-route-256.ts';
import {GroupCampaignRuntime256} from '../src/sim/group-campaign-runtime-256.ts';
import {GroupCaravanPhysical256} from '../src/sim/group-caravan-physical-256.ts';
import {createGroupCampaignGeometry256} from '../src/sim/group-campaign-geometry-256.ts';
import {createWorld} from '../src/sim/engine.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type Pawn,type World} from '../src/sim/types.ts';
import type {CoreStartingArrivalPending256} from '../src/sim/starting-pod-state-256.ts';

const drain=<Y,T>(it:Generator<Y,T,void>):T=>{let s=it.next();while(!s.done)s=it.next();return s.value;};
const memory=(p:Pawn,kind:string)=>p.roomMemories?.find(m=>m.kind===kind);
const ids=(w:World,p:Pawn)=>moodThoughts(w,p).map(t=>t.id);
const FIRST_DAYS=['slept-in-cold','slept-in-heat','slept-outside','slept-on-ground','soaking-wet','darkness'];

/** One real geographic Crashlanded factory (the player's new-game path),
 * tile and roster chosen once so that the drawn starting pet is a husky
 * that can learn Obedience, hence bonded. No retry or repair. */
let geographic:World;
beforeAll(()=>{
 const settings:ReturnType<typeof defaultWorldGenerationSettings>={...defaultWorldGenerationSettings(),rainfall:4,temperature:2};
 const draft=drain(generateGeographicWorldDraft256({seed:'Camp2274 preview 256 🌲',settings,tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'QA343'}));
 const geography=captureGeneratedGeography256(draft),roster=createStartingCandidateRoster(343017);
 geographic=drain(createGeographicNewGame256({draft,geography,tile:27029,size:200,scenario:'crashlanded',startingParty:startingOriginalRequestFromRoster256(343017,roster)},{shrines750:ACTUAL_SHRINES_750_256})) as World;
},180000);

test('a new geographic Crashlanded game at 343: opinions, optimism, research, bonded pet and forbidden supplies',()=>{
 const w=geographic;expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(w)).toEqual([]);
 const arrival=w.startingArrival as CoreStartingArrivalPending256,colonists=arrival.pods.map(p=>p.pawn);
 expect(colonists).toHaveLength(3);
 // CrashedTogether: +25 of each starting colonist toward each other one.
 for(const p of colonists)for(const q of colonists)if(p!==q){
  expect(opinionCauses(p,q.id,0,w).find(c=>c.kind==='crashed-together')).toMatchObject({value:25,count:1,label:'Naufragés ensemble'});
  expect(opinionOf(p,q.id,0,w)).toBeGreaterThanOrEqual(25);
 }
 // It fades in the last 30 % of its 20 days, then is gone.
 const [a,b]=colonists as [Pawn,Pawn];
 expect(opinionCauses(a,b.id,14*TICKS_PER_DAY,w).find(c=>c.kind==='crashed-together')!.value).toBe(25);
 expect(opinionCauses(a,b.id,17*TICKS_PER_DAY,w).find(c=>c.kind==='crashed-together')!.value).toBe(12);
 expect(opinionCauses(a,b.id,20*TICKS_PER_DAY,w).some(c=>c.kind==='crashed-together')).toBe(false);
 // NewColonyOptimism (+10, 8 days) then NewColonyHope (+5, 8 days).
 const memories=w.worldGroups!.lostMemories;
 expect(memories).toEqual(colonists.map(p=>({receiverId:p.id,mapId:0,otherId:null,kind:'new-colony-start343',at:0})));
 expect(moodThoughts(w,a).find(t=>t.id==='lost-new-colony-null')).toMatchObject({label:'Optimisme de nouvelle colonie',offset:10});
 const people={get:()=>undefined};
 expect(lostThoughtsAt(a,8*TICKS_PER_DAY,memories,people)).toMatchObject([{label:'Espoir de nouvelle colonie',offset:5}]);
 expect(lostThoughtsAt(a,16*TICKS_PER_DAY,memories,people)).toEqual([]);
 // ClassicStart research: NutrientPaste with the four already delivered.
 expect(nutrientPasteUnlocked(w)).toBe(true);
 expect(w.research).toMatchObject({completedAt:0,airConditioning:{completedAt:0},stonecutting:{completedAt:0},complexFurniture:{completedAt:0},nutrientPaste:{completedAt:0}});
 // The starting pet exists, bonded to its master who can handle it.
 const pets=arrival.pods.flatMap(p=>p.animals);expect(pets).toHaveLength(1);
 const pet=pets[0]!;expect(pet.species).toBe('husky');
 expect(pet.startingPet).toMatchObject({masterId:pet.startingPet!.bondedPawnId,obedience:{steps:3,wanted:true}});
 expect(colonists.some(p=>p.id===pet.startingPet!.bondedPawnId)).toBe(true);
 // Core forbids drop-pod contents and the things scattered near the start.
 const podItems=arrival.pods.flatMap(p=>p.items.filter(i=>i.owner.type==='starting-pod'));
 expect(podItems.length).toBeGreaterThan(5);expect(podItems.every(i=>!materialAllowedForPlayer256(i))).toBe(true);
 const scattered=w.piles.filter(p=>p.owner.type==='ground'&&['steel','wood','survival-meal'].includes(p.item));
 expect(scattered.length).toBeGreaterThan(0);expect(scattered.every(p=>!materialAllowedForPlayer256(p))).toBe(true);
 // Exact reload at tick 0, capsules still incoming.
 const raw=serializeCampaign(w);expect(serializeCampaign(deserializeCampaign(raw))).toBe(raw);
});

test('bonded animal master thought once the capsules open, and its loss when the master is cleared',()=>{
 const w=deserializeCampaign(serializeCampaign(geographic)) as World;
 if(w.planet?.revision===3)preparePlanetNavigation256(w.planet);const runtime=new GroupCampaignRuntime256(createGroupCampaignGeometry256(w),new GroupCaravanPhysical256());runtime.bootstrap(w);
 for(let i=0;i<200&&w.startingArrival?.phase!=='opened';i++)stepWorld(w,1,undefined,runtime);
 expect(w.startingArrival?.phase).toBe('opened');expect(validateWorld(w)).toEqual([]);
 const pet=w.wildlife!.animals.find(a=>a.startingPet)!,master=w.pawns.find(p=>p.id===pet.startingPet!.masterId)!;
 expect(moodThoughts(w,master).find(t=>t.id==='bonded-animal-master')).toMatchObject({offset:5,label:`Maître de son compagnon lié : ${pet.startingPet!.name}`});
 for(const p of w.pawns)if(p!==master)expect(ids(w,p).some(id=>id.includes('bonded-animal'))).toBe(false);
 // Items left the capsules forbidden.
 expect(w.piles.filter(p=>p.owner.type==='ground'&&['silver','component','medicine','survival-meal'].includes(p.item)).every(p=>!materialAllowedForPlayer256(p))).toBe(true);
 const raw=serializeCampaign(w);expect(serializeCampaign(deserializeCampaign(raw))).toBe(raw);
 // Without a respected master, the bonded pawn has NotBondedAnimalMaster.
 delete pet.startingPet!.masterId;
 expect(moodThoughts(w,master).find(t=>t.id==='not-bonded-animal-master')).toMatchObject({offset:-3});
 expect(ids(w,master)).not.toContain('bonded-animal-master');
 pet.state='dead';expect(ids(w,master).some(id=>id.includes('bonded-animal'))).toBe(false);
});

test('Atterrissage simple start at 343 also gives the start thoughts and NutrientPaste, once',()=>{
 const w=createScenarioWorld(42,64,'crashlanded');expect(validateWorld(w)).toEqual([]);
 for(const p of w.pawns){
  expect(moodThoughts(w,p).find(t=>t.id==='lost-new-colony-null')?.offset).toBe(10);
  for(const q of w.pawns)if(p!==q)expect(opinionCauses(p,q.id,0,w).find(c=>c.kind==='crashed-together')?.value).toBe(25);
 }
 expect(nutrientPasteUnlocked(w)).toBe(true);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 // Survivors (not a Core scenario) receives no Crashlanded start.
 const survivors=createScenarioWorld(42,64,'survivors');
 expect(survivors.worldGroups?.lostMemories??[]).toEqual([]);expect(survivors.pawns.every(p=>!p.social)).toBe(true);
});

/** Prepared physical fixture, from a fresh world at tick 0 (night): grass,
 * one adult, a closed 5×5 room (walls 8..14, door at 11,8) under a built roof,
 * open sky elsewhere. Every thought below comes from the real tick. */
function camp():World {
 const w=createWorld(343,32,32);
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 w.pawns=w.pawns.slice(0,1);const p=w.pawns[0]!;Object.assign(p,{x:20,z:20,hunger:100,rest:100});
 p.priorities={handle:0,clean:0,firefight:0,warden:0,basic:0,hunt:0,research:0,patient:0,bedrest:0,doctor:0,art:0,craft:0,mine:0,gather:0,build:0,haul:0,grow:0,cook:0} as Pawn['priorities'];
 const wall=(x:number,z:number)=>{w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});};
 for(let x=8;x<=14;x++){if(x!==11)wall(x,8);wall(x,14);}for(let z=9;z<=13;z++){wall(8,z);wall(14,z);}
 w.structures.push({id:w.nextId++,kind:'door',x:11,z:8,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
 w.roofing={constructed:[9,10,11,12,13].flatMap(z=>[9,10,11,12,13].map(x=>z*w.width+x)).sort((a,b)=>a-b),build:[],remove:[],cursor:0};
 refreshStock(w);return w;
}
function sleepAt(w:World,p:Pawn,bedId:number|null,x:number,z:number):number {
 p.x=x;p.z=z;p.bedId=bedId;p.rest=0;p.schedule.fill('sleep');p.need={kind:'sleep',phase:'sleep',bedId,target:{x,z}};p.state='sleeping';
 stepWorld(w);if(p.need?.kind!=='sleep'||!p.need.roomRest)throw Error('sleep task missing');return p.need.roomRest.nextAt;
}
function regionTemperature(w:World,p:Pawn,value:number):void {const r=w.thermal!.regions.find(r=>r.cells.includes(p.z*w.width+p.x))!;r.temperature=value;}
function walkTo(w:World,p:Pawn,x:number,z:number):void {
 expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x,z},queue:false}).ok).toBe(true);
 for(let i=0;i<300&&(p.x!==x||p.z!==z||p.motion&&p.motion.end>w.tick);i++)stepWorld(w);
 expect([p.x,p.z]).toEqual([x,z]);
}
const draft=(w:World,p:Pawn,enabled=true)=>{expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled}).ok).toBe(true);stepWorld(w);};

test('sleeping spot indoors in the cold: on ground and cold, not outside, after the persisted delay',()=>{
 const w=camp(),p=w.pawns[0]!;
 expect(placeHumanSleepingSpot(w,{type:'designate',kind:'sleeping-spot',x:11,z:11,orientation:0}).ok).toBe(true);
 const spot=w.structures.at(-1)!;
 const first=sleepAt(w,p,spot.id,spot.x,spot.z);
 stepWorld(w,first-w.tick-1);expect(FIRST_DAYS.filter(k=>k.startsWith('slept-')).some(k=>memory(p,k))).toBe(false);
 // Asleep in the dark: the light sample is recorded, the thought is not shown.
 expect(memory(p,'darkness')).toBeDefined();expect(ids(w,p)).not.toContain('environment-dark');
 regionTemperature(w,p,8);stepWorld(w);
 expect(temperatureAt(w,p)).toBeLessThan(16);
 expect(memory(p,'slept-on-ground')).toMatchObject({stage:0,expiresAt:w.tick+6000});
 expect(memory(p,'slept-in-cold')).toMatchObject({expiresAt:w.tick+6000});
 expect(memory(p,'slept-outside')).toBeUndefined();expect(memory(p,'slept-in-heat')).toBeUndefined();
 expect(moodThoughts(w,p).filter(t=>t.id.startsWith('slept-')).map(t=>[t.id,t.offset])).toEqual([['slept-in-cold',-4],['slept-on-ground',-4]]);
 // Save/reload while active, then the same continuation.
 const raw=serializeWorld(w),replay=deserializeWorld(raw);expect(serializeWorld(replay)).toBe(raw);
 stepWorld(w,30);stepWorld(replay,30);expect(serializeWorld(replay)).toBe(serializeWorld(w));
});

test('a real bed in a hot room: heat only; the observation replaces the earlier sleep memories',()=>{
 const w=camp(),p=w.pawns[0]!;
 const bed={id:w.nextId++,kind:'bed' as const,x:11,z:11,orientation:0 as const,footprint:'standard' as const,material:'wood' as const,quality:'normal' as const};w.structures.push(bed);
 p.roomMemories=[{kind:'slept-on-ground',stage:0,expiresAt:w.tick+4000},{kind:'slept-outside',stage:0,expiresAt:w.tick+4000}];
 const first=sleepAt(w,p,bed.id,bed.x,bed.z);stepWorld(w,first-w.tick-1);
 expect(memory(p,'slept-outside')).toBeDefined();
 regionTemperature(w,p,35);stepWorld(w);expect(temperatureAt(w,p)).toBeGreaterThan(26);
 expect(memory(p,'slept-in-heat')).toMatchObject({expiresAt:w.tick+6000});
 for(const k of ['slept-in-cold','slept-outside','slept-on-ground'])expect(memory(p,k)).toBeUndefined();
 expect(validateWorld(w)).toEqual([]);
});

test('sleeping on the bare ground outside: outside and ground, then they expire one day later',()=>{
 const w=camp(),p=w.pawns[0]!;
 const first=sleepAt(w,p,null,20,20);stepWorld(w,first-w.tick);
 expect(memory(p,'slept-outside')).toBeDefined();expect(memory(p,'slept-on-ground')).toBeDefined();
 const t=temperatureAt(w,p);expect(!!memory(p,'slept-in-cold')).toBe(t<16);expect(!!memory(p,'slept-in-heat')).toBe(t>26);
 // Waking applies the bed thoughts once more (Core applyBedThoughtsOnLeave).
 p.rest=100;p.schedule.fill('work');stepWorld(w);expect(p.need).toBeNull();
 const expiresAt=memory(p,'slept-outside')!.expiresAt;expect(expiresAt).toBe(w.tick+6000);
 draft(w,p);
 stepWorld(w,expiresAt-w.tick-1);expect(memory(p,'slept-outside')).toBeDefined();
 stepWorld(w);expect(memory(p,'slept-outside')).toBeUndefined();expect(memory(p,'slept-on-ground')).toBeUndefined();
 expect(validateWorld(w)).toEqual([]);
});

test('soaking wet: rain without roof, water underfoot, renewed every 120 Core ticks, expires 0.1 day after',()=>{
 const w=camp(),p=w.pawns[0]!;adoptWeather(w);
 draft(w,p);walkTo(w,p,11,11);
 Object.assign(w.weather!,{current:'rain',previous:'rain',durationCore:160000});
 stepWorld(w,13);expect(memory(p,'soaking-wet')).toBeUndefined();
 walkTo(w,p,20,20);stepWorld(w,12);
 const gained=memory(p,'soaking-wet')!.expiresAt-600;expect(gained).toBeGreaterThan(w.tick-12);expect(gained).toBeLessThanOrEqual(w.tick);
 expect(moodThoughts(w,p).find(t=>t.id==='soaking-wet')).toMatchObject({offset:-3,label:'Trempé'});
 stepWorld(w,12);expect(memory(p,'soaking-wet')!.expiresAt).toBe(gained+12+600);
 const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
 // Under the roof it is no longer renewed, and ends 600 ticks after the last renewal.
 walkTo(w,p,11,11);const last=memory(p,'soaking-wet')!.expiresAt;
 stepWorld(w,last-w.tick-1);expect(memory(p,'soaking-wet')).toBeDefined();
 stepWorld(w);expect(memory(p,'soaking-wet')).toBeUndefined();
 // Water terrain, in clear weather; a bridge keeps the feet dry.
 Object.assign(w.weather!,{current:'clear',previous:'clear'});
 w.tiles[20*w.width+21]={terrain:'water-shallow'};walkTo(w,p,21,20);
 expect(standingInWater343(w,p)).toBe(true);stepWorld(w,12);expect(memory(p,'soaking-wet')).toBeDefined();
 w.tiles[20*w.width+21]={terrain:'water-shallow',bridge:true};expect(standingInWater343(w,p)).toBe(false);
 expect(validateWorld(w)).toEqual([]);
});

test('darkness: awake after a dark light sample, gone with light; never while asleep',()=>{
 const w=camp(),p=w.pawns[0]!;
 stepWorld(w,2000);draft(w,p);
 walkTo(w,p,20,20);expect(lightAtPawn343(w,p)).toBeGreaterThan(.3);stepWorld(w,16);
 expect(memory(p,'darkness')).toBeUndefined();
 walkTo(w,p,11,11);expect(lightAtPawn343(w,p)).toBeLessThanOrEqual(.3);
 let sampled=-1;for(let i=0;i<16&&sampled<0;i++){stepWorld(w);if(memory(p,'darkness'))sampled=w.tick;}
 expect(sampled).toBeGreaterThan(0);expect(memory(p,'darkness')).toMatchObject({stage:0,expiresAt:sampled+30});
 expect(moodThoughts(w,p).find(t=>t.id==='environment-dark')).toMatchObject({offset:-5,kind:'situation'});
 expect(moodThoughts(w,p).some(t=>t.id==='darkness')).toBe(false);
 stepWorld(w,15);expect(memory(p,'darkness')!.expiresAt).toBe(sampled+15+30);
 const raw=serializeWorld(w),replay=deserializeWorld(raw);expect(serializeWorld(replay)).toBe(raw);
 stepWorld(w,20);stepWorld(replay,20);expect(serializeWorld(replay)).toBe(serializeWorld(w));
 expect(darknessThought343({...p,state:'sleeping'},w.tick)).toBeUndefined();
 walkTo(w,p,20,20);stepWorld(w,16);
 expect(memory(p,'darkness')).toBeUndefined();expect(ids(w,p)).not.toContain('environment-dark');
 expect(validateWorld(w)).toEqual([]);
});

test('nothing changes below 343: the same states give no first-days memory',()=>{
 // In-memory 342 world (a loaded 342 save is migrated to 343 by number).
 const w=camp(),p=w.pawns[0]!;w.schemaVersion=342 as typeof SCHEMA_VERSION;
 adoptWeather(w);Object.assign(w.weather!,{current:'rain',previous:'rain',durationCore:160000});
 draft(w,p);walkTo(w,p,11,11);stepWorld(w,40);walkTo(w,p,20,20);stepWorld(w,40);draft(w,p,false);
 const first=sleepAt(w,p,null,20,20);stepWorld(w,first-w.tick+1);
 expect(p.roomMemories?.some(m=>FIRST_DAYS.includes(m.kind))??false).toBe(false);
 expect(ids(w,p).some(id=>['environment-dark','soaking-wet','bonded-animal-master'].includes(id)||id.startsWith('slept-'))).toBe(false);
});

test('migration 342 → 343 by number only, and strict refusal of 343 content in a 342 save',()=>{
 const current=createScenarioWorld(42,64,'crashlanded'),old=asOldSchema(serializeWorld(current),342);
 const raw=JSON.parse(old);expect(raw.schemaVersion).toBe(342);
 expect(raw.worldGroups.lostMemories).toEqual([]);expect(raw.pawns.every((p:Record<string,unknown>)=>!p.social)).toBe(true);
 const migrated=deserializeWorld(old);expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
 // Nothing is granted retroactively.
 expect(migrated.worldGroups!.lostMemories).toEqual([]);
 for(const p of migrated.pawns){expect(p.social).toBeUndefined();expect(p.roomMemories).toBeUndefined();expect(ids(migrated,p)).not.toContain('lost-new-colony-null');}
 expect(migrated.research!.nutrientPaste).toEqual(current.research!.nutrientPaste);
 const mutate=(f:(r:Record<string,any>)=>void)=>{const r=JSON.parse(old);f(r);return JSON.stringify(r);};
 for(const invalid of [
  mutate(r=>{r.pawns[0].roomMemories=[{kind:'soaking-wet',stage:0,expiresAt:r.tick+100}];}),
  mutate(r=>{r.pawns[0].roomMemories=[{kind:'darkness',stage:0,expiresAt:r.tick+10}];}),
  mutate(r=>{r.worldGroups.lostMemories=[{receiverId:r.pawns[0].id,mapId:0,otherId:null,kind:'new-colony-start343',at:0}];}),
  mutate(r=>{r.pawns[0].social={rng:7,memories:[{otherId:r.pawns[1].id,kind:'crashed-together',at:0,offset:25}]};}),
 ])expect(()=>deserializeWorld(invalid)).toThrow();
 // Current saves bound the new memories too.
 const now=JSON.parse(serializeWorld(current));
 for(const [p,f] of [
  [0,(m:Record<string,any>)=>{m.pawns[0].roomMemories=[{kind:'soaking-wet',stage:0,expiresAt:m.tick+601}];}],
  [0,(m:Record<string,any>)=>{m.pawns[0].roomMemories=[{kind:'darkness',stage:1,expiresAt:m.tick+10}];}],
  [0,(m:Record<string,any>)=>{m.pawns[0].social.memories[0].offset=24;}],
  [0,(m:Record<string,any>)=>{m.worldGroups.lostMemories[0].at=1;}],
 ] as const){void p;const r=structuredClone(now);f(r);expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
});
