import {expect,test,vi} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,serializeCampaign,validateWorld} from '../src/sim/serialization.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {moodTarget,moodThoughts,personalMoodThoughts} from '../src/sim/mood.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {OUTDOORS_INITIAL_359,advanceCaravanOutdoors359,advanceOutdoors359,outdoorsCategory359,outdoorsLevel359,outdoorsNeedApplies359,outdoorsPlace359,outdoorsStep359,outdoorsThought359} from '../src/sim/outdoors-need-359.ts';
import {GroupCampaignRuntime256} from '../src/sim/group-campaign-runtime-256.ts';
import {GroupCaravanPhysical256} from '../src/sim/group-caravan-physical-256.ts';
import {createGroupCampaignGeometry256} from '../src/sim/group-campaign-geometry-256.ts';
import {reorganizationCamp256} from './helpers/group-reorganization-v256.ts';
import {groupCoreTicks256,groupPawnInterval256} from '../src/sim/group-core-cadence-256.ts';
import {captureGroupMass} from '../src/sim/group-capture.ts';
import {planetTile} from '../src/sim/planet-geography-256.ts';
import {planetCostContext,planetEdgeCost} from '../src/sim/planet-navigation.ts';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector.ts';
import type {NativeUiActions,NativeUiState} from '../src/ui3d/native-contract.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const f=Math.fround;
/** One NeedInterval of Need_Outdoors at a per-day rate: rate × 0.0025 in single precision. */
const delta=(rate:number)=>f(f(rate)*f(.0025));
const thought=(w:World,p:Pawn)=>moodThoughts(w,p).find(t=>t.id.startsWith('outdoors'));
const idle={handle:0,clean:0,firefight:0,warden:0,basic:0,hunt:0,research:0,patient:0,bedrest:0,doctor:0,art:0,craft:0,mine:0,gather:0,build:0,haul:0,grow:0,cook:0} as Pawn['priorities'];

/** Prepared physical fixture from a fresh world at tick 0: grass, no
 * resources or piles, three adults who take no work. Every need step and
 * thought below comes from real ticks. */
function camp(version=SCHEMA_VERSION as number):World {
 const w=createWorld(359,32,32);
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 w.pawns=w.pawns.slice(0,3);expect(w.pawns).toHaveLength(3);
 for(const p of w.pawns){Object.assign(p,{hunger:100,rest:100});p.priorities={...idle};delete p.background;}
 w.schemaVersion=version as typeof SCHEMA_VERSION;refreshStock(w);return w;
}
const cells=(w:World,x0:number,z0:number,x1:number,z1:number)=>{const r:number[]=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)r.push(z*w.width+x);return r;};
/** Walls around the interior [x0..x1]×[z0..z1], with a door when given. */
function walls(w:World,x0:number,z0:number,x1:number,z1:number,door?:{x:number;z:number}):void {
 for(let x=x0-1;x<=x1+1;x++)for(let z=z0-1;z<=z1+1;z++){
  if(x>=x0&&x<=x1&&z>=z0&&z<=z1)continue;
  if(door&&door.x===x&&door.z===z)w.structures.push({id:w.nextId++,kind:'door',x,z,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
  else w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});
 }
}
function roof(w:World,built:number[],thick:number[]=[]):void {
 w.roofing={constructed:[...new Set(built)].sort((a,b)=>a-b),build:[],remove:[],cursor:0,...thick.length?{natural:{thin:[],thick:[...new Set(thick)].sort((a,b)=>a-b)}}:{}};
}
/** A room under the mountain (natural thick roof), a room under a built roof
 * and the open sky, one adult in each, drafted where they stand; the built
 * room has a door only when asked (an idle adult may walk out of it). */
function shelters(version?:number,door=false){
 const w=camp(version);
 walls(w,2,2,4,4);walls(w,2,10,4,12,door?{x:3,z:9}:undefined);
 roof(w,cells(w,2,10,4,12),cells(w,2,2,4,4));
 const [under,inside,sky]=w.pawns as [Pawn,Pawn,Pawn];
 Object.assign(under,{x:3,z:3});Object.assign(inside,{x:3,z:11});Object.assign(sky,{x:20,z:20});
 for(const p of w.pawns)expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
 return {w,under,inside,sky};
}
/** Real ticks; the fixture refills food and rest between chunks so that no
 * meal, sleep or collapse moves the adults out of their places. */
function live(w:World,ticks:number,each?:()=>void):void {
 for(let done=0;done<ticks;done+=150){for(const p of w.pawns){p.hunger=100;p.rest=100;}stepWorld(w,Math.min(150,ticks-done));each?.();}
}

test('Core categories, rates, floors and the in-bed factor of one need interval',()=>{
 expect(OUTDOORS_INITIAL_359).toBe(1);
 expect([1,f(.8001),f(.8),f(.6001),f(.6),f(.4001),f(.4),f(.2),f(.1999),f(.0501),f(.05),0].map(outdoorsCategory359)).toEqual(
  ['free','free','need-fresh-air','need-fresh-air','cabin-fever-light','cabin-fever-light','cabin-fever-severe','cabin-fever-severe','trapped','trapped','entombed','entombed']);
 const half=f(.5);
 expect(outdoorsStep359(half,'indoors-thick',false)).toBe(f(half+delta(-.45)));
 expect(outdoorsStep359(half,'indoors-thin',false)).toBe(f(half+delta(-.32)));
 expect(outdoorsStep359(half,'outdoors-thick',false)).toBe(f(half+delta(-.4)));
 expect(outdoorsStep359(half,'outdoors-thin',false)).toBe(f(half+delta(1)));
 expect(outdoorsStep359(half,'indoors-open',false)).toBe(f(half+delta(5)));
 expect(outdoorsStep359(half,'outdoors-open',false)).toBe(f(half+delta(8)));
 // Awake in a bed, a falling rate is multiplied by 0.2; a rising one is not.
 expect(outdoorsStep359(half,'indoors-thin',true)).toBe(f(half+f(f(f(-.32)*f(.2))*f(.0025))));
 expect(outdoorsStep359(half,'outdoors-open',true)).toBe(f(half+delta(8)));
 // Floors: 0.2 under a thin roof and outdoors under a thick one, 0 indoors
 // under a thick roof; a level already lower never rises from the floor.
 expect(outdoorsStep359(f(.2005),'indoors-thin',false)).toBe(f(.2));
 expect(outdoorsStep359(f(.2005),'outdoors-thick',false)).toBe(f(.2));
 expect(outdoorsStep359(f(.1),'indoors-thin',false)).toBe(f(.1));
 expect(outdoorsStep359(f(.0005),'indoors-thick',false)).toBe(0);
 expect(outdoorsStep359(f(.99),'outdoors-open',false)).toBe(1);
});

test('kept indoors the need falls with the five Core thoughts in order; thick roof to 0, thin roof stops at 20 %, the sky stays full',()=>{
 const {w,under,inside,sky}=shelters();
 expect([under,inside,sky].map(p=>outdoorsPlace359(w,p))).toEqual(['indoors-thick','indoors-thin','outdoors-open']);
 for(const p of w.pawns){expect(p.outdoors359).toBeUndefined();expect(outdoorsLevel359(p)).toBe(1);expect(thought(w,p)).toBeUndefined();}
 // Two need intervals (150 Core ticks each) in 30 local ticks.
 live(w,30);
 expect(under.outdoors359).toBe(f(f(1+delta(-.45))+delta(-.45)));
 expect(inside.outdoors359).toBe(f(f(1+delta(-.32))+delta(-.32)));
 expect(sky.outdoors359).toBeUndefined();
 const seen:string[]=[],floor:number[]=[];
 live(w,15000,()=>{const id=thought(w,under)?.id??'none';if(seen.at(-1)!==id)seen.push(id);floor.push(inside.outdoors359!);});
 expect(seen).toEqual(['none','outdoors-stuck-indoors','outdoors-trapped-indoors','outdoors-cabin-fever','outdoors-trapped','outdoors-entombed']);
 expect(under.outdoors359).toBe(0);expect(inside.outdoors359).toBe(f(.2));expect(Math.min(...floor)).toBe(f(.2));
 expect(sky.outdoors359).toBeUndefined();expect(thought(w,sky)).toBeUndefined();
 expect(thought(w,under)).toMatchObject({id:'outdoors-entombed',label:'Enseveli sous terre',offset:-9});
 expect(thought(w,inside)).toMatchObject({id:'outdoors-cabin-fever',label:'Syndrome de la cabane',offset:-5});
 // The thought weighs on the mood target like any other situation.
 const without=moodThoughts(w,under).filter(t=>!t.id.startsWith('outdoors'));
 expect(moodTarget(moodThoughts(w,under))).toBe(Math.max(0,moodTarget(without)-9));
 expect(validateWorld(w)).toEqual([]);
});

test('going out restores it; a room open to the outside is outdoors, an unroofed cell of a closed room rises slower',()=>{
 const {w,inside}=shelters(undefined,true);
 // Prepared low level; the walk and the recovery are real.
 inside.outdoors359=f(.3);
 expect(applyCommand(w,{type:'draft-move',pawnIds:[inside.id],target:{x:3,z:6},queue:false}).ok).toBe(true);
 for(let i=0;i<300&&(inside.x!==3||inside.z!==6||inside.motion&&inside.motion.end>w.tick);i++)stepWorld(w);
 expect([inside.x,inside.z]).toEqual([3,6]);expect(outdoorsPlace359(w,inside)).toBe('outdoors-open');
 const start=inside.outdoors359!;live(w,15);expect(inside.outdoors359).toBe(f(start+delta(8)));
 live(w,600);expect(inside.outdoors359).toBe(1);expect(thought(w,inside)).toBeUndefined();
 // Room.UsesOutdoorTemperature: a closed 3×3 room with three unroofed cells
 // (at least a quarter) uses the outdoor air, so its roofed part counts as
 // outdoors under a thin roof; with two unroofed cells it keeps its own air
 // and an unroofed cell of it is indoors without a roof.
 const r=camp();walls(r,10,10,12,12);walls(r,20,10,22,12);
 // An overhang of mountain roof held by one wall, open on three sides.
 r.structures.push({id:r.nextId++,kind:'wall',x:28,z:2,orientation:0,footprint:'standard'});
 roof(r,[...cells(r,10,10,12,12).filter(i=>i!==10*r.width+10&&i!==10*r.width+11&&i!==10*r.width+12),...cells(r,20,10,22,12).filter(i=>i!==10*r.width+20&&i!==10*r.width+21)],cells(r,26,2,27,3));
 const [open,closed,ledge]=r.pawns as [Pawn,Pawn,Pawn];
 Object.assign(open,{x:11,z:12,outdoors359:f(.5)});Object.assign(closed,{x:20,z:10,outdoors359:f(.5)});Object.assign(ledge,{x:26,z:2,outdoors359:f(.5)});
 for(const p of r.pawns)expect(applyCommand(r,{type:'draft',pawnIds:[p.id],enabled:true}).ok).toBe(true);
 expect([open,closed,ledge].map(p=>outdoorsPlace359(r,p))).toEqual(['outdoors-thin','indoors-open','outdoors-thick']);
 live(r,15);
 expect(open.outdoors359).toBe(f(f(.5)+delta(1)));expect(closed.outdoors359).toBe(f(f(.5)+delta(5)));expect(ledge.outdoors359).toBe(f(f(.5)+delta(-.4)));
 // A doorway under the roof is a room of its own, kept indoors.
 const d=camp();walls(d,2,2,4,4,{x:3,z:1});roof(d,[...cells(d,2,2,4,4),1*d.width+3]);
 Object.assign(d.pawns[0]!,{x:3,z:1});expect(applyCommand(d,{type:'draft',pawnIds:[d.pawns[0]!.id],enabled:true}).ok).toBe(true);
 expect(outdoorsPlace359(d,d.pawns[0]!)).toBe('indoors-thin');
 expect(validateWorld(r)).toEqual([]);
});

test('frozen asleep, five times slower awake in bed, prisoners keep the need without the thought, visitors and raiders have none',()=>{
 const {w,inside,sky}=shelters();
 live(w,30);const before=inside.outdoors359;
 inside.state='sleeping';advanceOutdoors359(w,inside);expect(inside.outdoors359).toBe(before);
 inside.state='idle';inside.medicalSleep=true;advanceOutdoors359(w,inside);expect(inside.outdoors359).toBe(before);
 delete inside.medicalSleep;advanceOutdoors359(w,inside);expect(inside.outdoors359).toBe(f(before!+delta(-.32)));
 // Awake in a bed (Pawn.InBed), a falling rate is five times slower.
 const bed={id:w.nextId++,kind:'bed' as const,x:inside.x,z:inside.z,orientation:0 as const,footprint:'standard' as const,material:'wood' as const};w.structures.push(bed);
 inside.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:bed.x,z:bed.z},medical:'bedrest'};inside.state='resting';
 const lying=inside.outdoors359!;advanceOutdoors359(w,inside);expect(inside.outdoors359).toBe(f(lying+f(f(f(-.32)*f(.2))*f(.0025))));
 inside.need=null;inside.state='idle';w.structures.pop();
 // Colonists and prisoners only (colonistAndPrisonersOnly).
 expect(outdoorsNeedApplies359({faction:'outlaws'} as Pawn)).toBe(false);
 expect(outdoorsNeedApplies359({faction:'outlaws',prisoner:{}} as Pawn)).toBe(true);
 expect(outdoorsNeedApplies359({faction:'outlanders',visitor:{}} as Pawn)).toBe(false);
 // A prisoner's need runs; ThoughtWorker_NeedOutdoors gives none to a held pawn.
 inside.outdoors359=f(.1);expect(thought(w,inside)).toMatchObject({id:'outdoors-trapped',offset:-7});
 inside.prisoner={} as NonNullable<Pawn['prisoner']>;expect(outdoorsThought359(w,inside)).toBeUndefined();
 delete inside.prisoner;
 // Carried by another pawn: not spawned, outdoors under no roof, and no thought.
 sky.rescue={phase:'carry',patientId:inside.id} as NonNullable<Pawn['rescue']>;
 expect(outdoorsPlace359(w,inside)).toBe('outdoors-open');expect(outdoorsThought359(w,inside)).toBeUndefined();
 delete sky.rescue;
 // A raider has no such need: the field goes, as Pawn_NeedsTracker.RemoveNeed.
 inside.faction='outlaws';advanceOutdoors359(w,inside);expect(inside.outdoors359).toBeUndefined();expect(thought(w,inside)).toBeUndefined();
});

test('in a caravan the need rises as under the open sky, at each member’s own interval, without a thought',()=>{
 const {w,g,members}=reorganizationCamp256(true);
 for(const p of members){p.hunger=100;p.rest=100;p.recreation.level=100;p.outdoors359=f(.5);}
 // A declared paused return edge, as tests/caravan-rest-v442.test.ts: the
 // caravan stays on the world map; no loading or journey is claimed.
 const home=w.planet!.homeTile,from=planetTile(w.planet!,home)!.neighbours.find(id=>planetTile(w.planet!,id)?.biome!=='ocean')!;
 const mass=captureGroupMass(g.members,g.items,!!g.freight,w.schemaVersion,g.packed,g.animalOwners?.members)!;
 const edge=planetEdgeCost(w.planet!,from,home,planetCostContext(w,mass))!;
 Object.assign(g,{tile:from,destination:home,phase:'travelling',route:[home],segment:{from,to:home,totalCore:f(edge),remainingCore:0},paused:true,stop:{kind:'paused'}});
 expect(validateWorld(w)).toEqual([]);
 const run=new GroupCampaignRuntime256(createGroupCampaignGeometry256(w),new GroupCaravanPhysical256());run.bootstrap(w);
 const ids=members.map(p=>p.id);
 for(let i=0;i<40;i++)stepWorld(w,1,undefined,run);
 const away=w.worldGroups!.groups.find(r=>r.state.id===g.id)!.state;expect('members'in away).toBe(true);
 for(const id of ids){
  const p=(away as typeof g).members.find(q=>q.id===id)!;
  // Core ticks of the local ticks after the departure tick, which runs no meter.
  let expected=f(.5),n=0;
  for(let t=(away as typeof g).departedAt+1;t<=w.tick;t++)for(const c of groupCoreTicks256(t))if(groupPawnInterval256(id,c,150,1)){expected=f(expected+delta(8));n++;}
  expect(n).toBeGreaterThanOrEqual(2);expect(p.outdoors359).toBe(expected);
  advanceCaravanOutdoors359(p);expect(p.outdoors359).toBe(f(expected+delta(8)));
  // NeedOutdoors is not valid while despawned: the caravan's mood context
  // (despawned313) never carries it, and would drop it if given.
  const offered={id:'outdoors-trapped-indoors',label:'',offset:-3,kind:'situation' as const,description:''};
  expect(personalMoodThoughts(p,{tick:w.tick,people:{get:()=>undefined},items:[],difficultyMood:0,schemaVersion:SCHEMA_VERSION,despawned313:true,outdoors359:offered}).some(t=>t.id.startsWith('outdoors'))).toBe(false);
 }
 expect(validateWorld(w)).toEqual([]);
 const copy=deserializeWorld(serializeCampaign(w));expect(serializeCampaign(copy)).toBe(serializeCampaign(w));
});

function needsPage(world:World,pawn:Pawn){
 const state:NativeUiState={world,epoch:359,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[pawn.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{};
 const actions:NativeUiActions={command:async()=>({ok:true}),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop,readState:()=>state};
 setNativeInspectorTab('needs');return buildNativeInspector(state,actions)!;
}

test('the Needs tab shows the outdoors bar, its tooltip and the thought',()=>{
 const {w,inside,sky}=shelters();inside.outdoors359=f(.55);live(w,15);
 const page=needsPage(w,inside),row=page.rows.find(r=>r.id==='need-outdoors')!;
 expect(row).toMatchObject({label:'Plein air',value:`${Math.round(inside.outdoors359!*100)} %`});
 expect(row.meter).toMatchObject({max:100});
 expect(row.hint).toContain('à 60 % ou moins : enfermé à l’intérieur (−3)');
 expect(page.rows.find(r=>r.id==='thought-outdoors-trapped-indoors')).toMatchObject({label:'Enfermé à l’intérieur',value:'-3'});
 expect(needsPage(w,sky).rows.find(r=>r.id==='need-outdoors')).toMatchObject({value:'100 %'});
});

test('save and reload mid-decay, then the same continuation; malformed levels are refused',()=>{
 const {w,under,inside}=shelters();live(w,600);
 expect(under.outdoors359).toBeLessThan(1);expect(inside.outdoors359).toBeLessThan(1);
 const raw=serializeWorld(w),loaded=deserializeWorld(raw);
 expect(serializeWorld(loaded)).toBe(raw);
 expect(loaded.pawns.map(p=>p.outdoors359)).toEqual(w.pawns.map(p=>p.outdoors359));
 live(w,450);live(loaded,450);
 expect(serializeWorld(loaded)).toBe(serializeWorld(w));
 const now=JSON.parse(raw),index=now.pawns.findIndex((p:Record<string,unknown>)=>p.outdoors359!==undefined);
 for(const bad of [1.5,-0.1,.1,'0.5',null,{level:.5},[]])
  {const r=structuredClone(now);r.pawns[index].outdoors359=bad;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
});

test('nothing changes below 359: no need, no thought, the same draws',()=>{
 const {w}=shelters(358);live(w,600);
 for(const p of w.pawns){expect(p.outdoors359).toBeUndefined();expect(thought(w,p)).toBeUndefined();}
 expect(needsPage(w,w.pawns[0]!).rows.some(r=>r.id==='need-outdoors')).toBe(false);
 // Under the open sky the 359 need stays full and stores nothing: the same
 // world, tick by tick, as at 358.
 const a=camp(358),b=camp(359);
 stepWorld(a,900);stepWorld(b,900);
 expect(b.pawns.every(p=>p.outdoors359===undefined)).toBe(true);
 // Later schemas only save the current number: relabel both after the run.
 a.schemaVersion=SCHEMA_VERSION;b.schemaVersion=SCHEMA_VERSION;expect(serializeWorld(a)).toBe(serializeWorld(b));
});

test('migration 358 → 359 by number only: every pawn starts at Core\'s initial level 1, nothing retroactive',()=>{
 const current=createScenarioWorld(42,64,'crashlanded');stepWorld(current,60);
 // The step 358 → 359 changes only the number of a save without the need.
 for(const p of current.pawns)delete p.outdoors359;
 const plain=serializeWorld(current);
 expect(serializeWorld(deserializeWorld(asOldSchema(plain,358)))).toBe(asNumberOnly(plain,358));
 // A 359 save with a lowered need loses it when relabelled 358.
 current.pawns[0]!.outdoors359=f(.35);expect(validateWorld(current)).toEqual([]);
 const json=serializeWorld(current),old=asOldSchema(json,358),raw=JSON.parse(old);
 expect(raw.schemaVersion).toBe(358);expect(raw.pawns.every((p:Record<string,unknown>)=>!('outdoors359' in p))).toBe(true);
 const migrated=deserializeWorld(old);expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
 for(const p of migrated.pawns){expect(p.outdoors359).toBeUndefined();expect(outdoorsLevel359(p)).toBe(1);expect(thought(migrated,p)).toBeUndefined();}
 // A 358 save cannot carry the 359 need.
 const r=JSON.parse(old);r.pawns[0].outdoors359=.5;
 expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();
 // From there the need runs as in a new game.
 stepWorld(migrated,30);expect(validateWorld(migrated)).toEqual([]);
});
