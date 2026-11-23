import {expect,test,vi} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {moodTarget,moodThoughts} from '../src/sim/mood.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {activeSkill345} from '../src/sim/passionate-work-345.ts';
import {ROOM_SIZE_SAMPLE_CELLS_345,advanceRoomSize345,roomSizeAdmitted345,roomSizeCategory345,roomSizeLevel345,roomSizeSpaceCurve345,spacePerceptibleNow345} from '../src/sim/room-size-need-345.ts';
import {sharedLightEnvironmentCache} from '../src/sim/light-environment.ts';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector.ts';
import type {NativeUiActions,NativeUiState} from '../src/ui3d/native-contract.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Pawn,type World} from '../src/sim/types.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const f=Math.fround;
const thought=(w:World,p:Pawn,prefix:string)=>moodThoughts(w,p).find(t=>t.id.startsWith(prefix));
const idle={handle:0,clean:0,firefight:0,warden:0,basic:0,hunt:0,research:0,patient:0,bedrest:0,doctor:0,art:0,craft:0,mine:0,gather:0,build:0,haul:0,grow:0,cook:0} as Pawn['priorities'];

/** Prepared physical fixture from a fresh world at tick 0: grass, no
 * resources or piles, three adults who take no work. Every need step and
 * thought below comes from the real tick. */
function camp(version=SCHEMA_VERSION as number):World {
 const w=createWorld(345,32,32);
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 w.pawns=w.pawns.slice(0,3);expect(w.pawns).toHaveLength(3);
 for(const p of w.pawns){Object.assign(p,{hunger:100,rest:100});p.priorities={...idle};delete p.background;}
 w.schemaVersion=version as typeof SCHEMA_VERSION;refreshStock(w);return w;
}
/** Walls around the interior [x0..x1]×[z0..z1], a built roof over it, and a
 * door at `door` on the border when given. */
function room(w:World,x0:number,z0:number,x1:number,z1:number,door?:{x:number;z:number}):void {
 for(let x=x0-1;x<=x1+1;x++)for(let z=z0-1;z<=z1+1;z++){
  if(x>=x0&&x<=x1&&z>=z0&&z<=z1)continue;
  if(door&&door.x===x&&door.z===z)w.structures.push({id:w.nextId++,kind:'door',x,z,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
  else w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});
 }
 const roof:number[]=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)roof.push(z*w.width+x);
 w.roofing={constructed:[...(w.roofing?.constructed??[]),...roof].sort((a,b)=>a-b),build:[],remove:[],cursor:0};
}
const draft=(w:World,p:Pawn,enabled=true)=>{expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled}).ok).toBe(true);};
function walkTo(w:World,p:Pawn,x:number,z:number):void {
 expect(applyCommand(w,{type:'draft-move',pawnIds:[p.id],target:{x,z},queue:false}).ok).toBe(true);
 for(let i=0;i<300&&(p.x!==x||p.z!==z||p.motion&&p.motion.end>w.tick);i++)stepWorld(w);
 expect([p.x,p.z]).toEqual([x,z]);
}
/** Three rooms: a 1×2 closet (two cells), a 3×3 bedroom (nine cells) and a
 * 12×12 hall, each pawn placed and drafted inside one of them. */
function rooms(version?:number):{w:World;closet:Pawn;small:Pawn;hall:Pawn} {
 const w=camp(version);
 room(w,2,2,3,2);room(w,2,8,4,10);room(w,15,15,26,26,{x:20,z:14});
 const [closet,small,hall]=w.pawns as [Pawn,Pawn,Pawn];
 Object.assign(closet,{x:2,z:2});Object.assign(small,{x:3,z:9});Object.assign(hall,{x:20,z:20});
 for(const p of w.pawns)draft(w,p);
 return {w,closet,small,hall};
}

test('Core curve, sample and categories of the room size need',()=>{
 // GenRadial.NumCellsInRadius(7.9): every cell at squared distance 62 or less.
 expect(ROOM_SIZE_SAMPLE_CELLS_345).toBe(193);
 expect([0,3,4,9,12.5,16,29,42,71,100,150].map(roomSizeSpaceCurve345)).toEqual([0,0,f(f(0+f(f(.25)*f(1/6)))),f(.25),f(f(.25)+f(f(.25)*.5)),.5,f(f(.5)+f(f(f(.71)-.5)*.5)),f(.71),f(f(.71)+f(f(1-f(.71))*.5)),1,1]);
 expect([0,f(.0099),f(.01),f(.2999),f(.3),f(.6999),f(.7),1].map(roomSizeCategory345)).toEqual(['very-cramped','very-cramped','cramped','cramped','normal','normal','spacious','spacious']);
});

test('the room size need falls in a small room, rises in a big one, with Core thought stages',()=>{
 const {w,closet,small,hall}=rooms();
 const light=()=>sharedLightEnvironmentCache(w).read(w).topology;
 expect(spacePerceptibleNow345(w,closet,light())).toEqual({instant:0,indoors:true});
 expect(spacePerceptibleNow345(w,small,light())).toEqual({instant:f(.25),indoors:true});
 expect(spacePerceptibleNow345(w,hall,light())).toEqual({instant:1,indoors:true});
 for(const p of w.pawns){expect(p.roomSize345).toBeUndefined();expect(roomSizeLevel345(p)).toBe(.5);expect(thought(w,p,'room-size')).toBeUndefined();}
 // Two need intervals (each 150 Core ticks, one step of 0.9 × 0.06).
 const step=f(f(.9)*f(.06));
 stepWorld(w,30);
 expect(closet.roomSize345).toEqual({level:f(f(.5-step)-step),indoors:true});
 expect(small.roomSize345).toEqual({level:f(f(.5-step)-step),indoors:true});
 expect(hall.roomSize345).toEqual({level:f(f(.5+step)+step),indoors:true});
 for(const p of w.pawns)expect(thought(w,p,'room-size')).toBeUndefined();
 // Three more: the bedroom is cramped, the hall spacious; ten in all: the
 // closet is confining and the bedroom stays at its own level.
 stepWorld(w,45);
 expect(roomSizeCategory345(small.roomSize345!.level)).toBe('cramped');
 expect(thought(w,small,'room-size')).toMatchObject({id:'room-size-cramped',label:'Intérieur exigu',offset:-5});
 expect(thought(w,hall,'room-size')).toMatchObject({id:'room-size-spacious',label:'Intérieur spacieux',offset:5});
 expect(thought(w,closet,'room-size')).toMatchObject({id:'room-size-cramped'});
 stepWorld(w,75);
 expect(closet.roomSize345).toEqual({level:0,indoors:true});expect(small.roomSize345!.level).toBe(f(.25));expect(hall.roomSize345!.level).toBe(1);
 expect(thought(w,closet,'room-size')).toMatchObject({id:'room-size-confined',label:'Intérieur confiné',offset:-10});
 // The thought weighs on the mood target like any other situation.
 const without=moodThoughts(w,closet).filter(t=>!t.id.startsWith('room-size'));
 expect(moodTarget(moodThoughts(w,closet))).toBe(Math.max(0,moodTarget(without)-10));
 expect(validateWorld(w)).toEqual([]);
 // Outdoors the need rises toward 1 and gives no thought.
 walkTo(w,hall,20,10);
 expect(spacePerceptibleNow345(w,hall,light())).toEqual({instant:1,indoors:false});
 stepWorld(w,15);
 expect(hall.roomSize345).toEqual({level:1,indoors:false});expect(thought(w,hall,'room-size')).toBeUndefined();
 // Standing in the doorway: the door's own cell and the hall behind it.
 walkTo(w,hall,20,14);
 const doorway=spacePerceptibleNow345(w,hall,light());expect(doorway.indoors).toBe(true);expect(doorway.instant).toBeGreaterThan(f(.71));
});

test('frozen asleep, absent for visitors and raiders, removed when the need ends',()=>{
 const {w,small}=rooms();
 stepWorld(w,30);const before=structuredClone(small.roomSize345);
 small.state='sleeping';advanceRoomSize345(w,small);expect(small.roomSize345).toEqual(before);
 expect(thought(w,small,'room-size')).toBeUndefined();
 small.state='idle';small.medicalSleep=true;advanceRoomSize345(w,small);expect(small.roomSize345).toEqual(before);
 delete small.medicalSleep;advanceRoomSize345(w,small);expect(small.roomSize345!.level).toBeLessThan(before!.level);
 // Colonists and prisoners only (colonistAndPrisonersOnly).
 expect(roomSizeAdmitted345({faction:'outlaws'} as Pawn)).toBe(false);
 expect(roomSizeAdmitted345({faction:'outlaws',prisoner:{}} as Pawn)).toBe(true);
 expect(roomSizeAdmitted345({faction:'outlanders',visitor:{}} as Pawn)).toBe(false);
 small.faction='outlaws';advanceRoomSize345(w,small);expect(small.roomSize345).toBeUndefined();
 expect(thought(w,small,'room-size')).toBeUndefined();
});

test('a colonist mining with a passion has the thought only while digging, and loses it when stopping or switching',()=>{
 const w=camp(),p=w.pawns[0]!;
 p.skills.mining={level:8,xp:0,dailyXp:0,passion:1};p.skills.construction.passion=0;p.priorities.mine=1;
 Object.assign(p,{x:20,z:24});
 w.tiles[17*w.width+20]={terrain:'rock',stone:'granite'};
 expect(applyCommand(w,{type:'designate',kind:'mine',x:20,z:17}).ok).toBe(true);
 let walked=false;
 for(let i=0;i<300&&p.state!=='working';i++){stepWorld(w);if(p.state==='moving'){walked=true;expect(thought(w,p,'passionate-work')).toBeUndefined();}}
 expect(walked).toBe(true);expect(p.state).toBe('working');expect(activeSkill345(w,p)).toBe('mining');
 expect(thought(w,p,'passionate-work')).toMatchObject({label:'Passion pour son travail',offset:8});
 p.skills.mining.passion=2;expect(thought(w,p,'passionate-work')).toMatchObject({label:'Passion brûlante pour son travail',offset:14});
 // It weighs on the mood target like any other situation.
 const all=moodThoughts(w,p),others=all.filter(t=>t.id!=='passionate-work');
 expect(moodTarget(all)).toBe(Math.min(100,moodTarget(others)+14));
 // Stopping: drafted, the job is released.
 draft(w,p);stepWorld(w);expect(p.jobId).toBeNull();expect(thought(w,p,'passionate-work')).toBeUndefined();
 // Switching to a job without passion: deconstruction (Construction).
 const wall={id:w.nextId++,kind:'wall' as const,x:24,z:24,orientation:0 as const,footprint:'standard' as const,material:'wood' as const};
 w.structures.push(wall);refreshStock(w);
 expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:wall.x,z:wall.z}).ok).toBe(true);
 p.priorities.mine=0;p.priorities.build=1;draft(w,p,false);
 for(let i=0;i<300&&!(p.state==='working'&&w.jobs.find(j=>j.id===p.jobId)?.kind==='deconstruct');i++)stepWorld(w);
 expect(activeSkill345(w,p)).toBe('construction');expect(thought(w,p,'passionate-work')).toBeUndefined();
 // The same work with a construction passion gives it back.
 p.skills.construction.passion=1;expect(thought(w,p,'passionate-work')).toMatchObject({offset:8});
 expect(validateWorld(w)).toEqual([]);
});

test('the active skill of each kind of work, at its work phase only',()=>{
 const w=camp(),p=w.pawns[0]!;
 const read=(patch:Partial<Pawn>)=>{const q={...p,state:'working' as const,haul:null,cooking:null,jobId:null,...patch} as Pawn;return activeSkill345(w,q);};
 const bill=(recipe:string,phase='work')=>({recipe,phase,stationId:1,billId:1,spot:{x:1,z:1},actionCell:{x:1,z:1},ingredients:[],progress:0,productId:null,storageId:null}) as unknown as Pawn['cooking'];
 expect(read({cooking:bill('simple-meal')})).toBe('cooking');
 expect(read({cooking:bill('butcher-creature')})).toBe('cooking');
 expect(read({cooking:bill('small-sculpture')})).toBe('artistic');
 expect(read({cooking:bill('make-medicine')})).toBe('intellectual');
 expect(read({cooking:bill('stone-blocks')})).toBe('crafting');
 expect(read({cooking:bill('smelt-weapon')})).toBeUndefined();
 expect(read({cooking:bill('simple-meal','gather')})).toBeUndefined();
 expect(read({research:{stationId:1,spot:{x:p.x,z:p.z}} as unknown as Pawn['research']})).toBe('intellectual');
 expect(read({research:{stationId:1,spot:{x:p.x+1,z:p.z}} as unknown as Pawn['research']})).toBeUndefined();
 expect(read({tend:{patientId:2,spot:{x:1,z:1},phase:'tend',progress:0}})).toBe('medicine');
 expect(read({tend:{patientId:2,spot:{x:1,z:1},phase:'approach',progress:0}})).toBeUndefined();
 expect(read({animalCare:{animalId:2,spot:{x:1,z:1},phase:'treat',progress:0}})).toBe('medicine');
 expect(read({surgery:{phase:'work'} as Pawn['surgery']})).toBe('medicine');
 expect(read({ward:{kind:'chat',patientId:2,spot:{x:1,z:1},phase:'rapport',progress:0,rapports:0}})).toBe('social');
 expect(read({ward:{kind:'chat',patientId:2,spot:{x:1,z:1},phase:'approach',progress:0,rapports:0}})).toBeUndefined();
 expect(read({ward:{kind:'chat',patientId:2,spot:{x:1,z:1},phase:'closing',progress:0,rapports:5}})).toBe('social');
 expect(read({ward:{kind:'food',patientId:2,sourcePileId:1,carryPileId:null,quantity:1,spot:{x:1,z:1},phase:'deliver'}})).toBeUndefined();
 const handling=(kind:string,step=0,phase='interact')=>({animalId:2,kind,sourcePileId:0,carryPileId:null,quantity:0,phase,step,progress:0}) as unknown as Pawn['animalHandling'];
 expect([read({animalHandling:handling('tame')}),read({animalHandling:handling('train',2)}),read({animalHandling:handling('train',5)}),read({animalHandling:handling('milk')}),read({animalHandling:handling('slaughter')}),read({animalHandling:handling('lead')}),read({animalHandling:handling('tame',0,'approach')})])
  .toEqual(['animals',undefined,'animals','animals',undefined,undefined,undefined]);
 expect(read({deepWork:{structureId:1,spot:{x:p.x,z:p.z},kind:'drill'}})).toBe('mining');
 expect(read({deepWork:{structureId:1,spot:{x:p.x,z:p.z},kind:'scan'}})).toBe('intellectual');
 // Hauling and plain walking have none, even with a map job.
 w.jobs=[{id:900,kind:'chop',x:1,z:1} as never,{id:901,kind:'flick',x:1,z:1} as never,{id:902,kind:'smooth-floor',x:1,z:1} as never,{id:903,kind:'wall',x:1,z:1,clearance:{resourceId:1,progress:0}} as never];
 expect([900,901,902,903].map(jobId=>read({jobId}))).toEqual(['plants',undefined,'construction','plants']);
 expect(read({jobId:900,haul:{} as Pawn['haul']})).toBeUndefined();
 expect(read({jobId:900,state:'moving'})).toBeUndefined();
 // Combat: an explicit or responding attack, not a drafted pawn's automatic fire.
 expect(read({state:'idle',shooting:{order:{targetId:2,weaponId:3,startedDowned:false},stance:null}})).toBe('shooting');
 expect(read({state:'idle',shooting:{order:{targetId:2,weaponId:3,startedDowned:false,auto:{kind:'draft'}},stance:null}})).toBeUndefined();
 expect(read({state:'idle',shooting:{order:{targetId:2,weaponId:3,startedDowned:false,hunt:true},stance:null}})).toBeUndefined();
 expect(read({state:'idle',melee:{order:{targetId:2,startedDowned:false,auto:'social'},strike:null}})).toBe('melee');
 expect(read({state:'idle',melee:{order:{targetId:2,startedDowned:false,auto:'draft'},strike:null}})).toBeUndefined();
});

test('nothing changes below 345: no need, no thought, the same states',()=>{
 const {w,closet,hall}=rooms(344);
 const p=w.pawns[2]!;p.skills.mining={level:8,xp:0,dailyXp:0,passion:2};
 stepWorld(w,200);
 for(const q of w.pawns){expect(q.roomSize345).toBeUndefined();expect(moodThoughts(w,q).some(t=>t.id.startsWith('room-size')||t.id==='passionate-work')).toBe(false);}
 void closet;void hall;
 // The same mining work at 344 gives no passion thought.
 const m=camp(344),q=m.pawns[0]!;q.skills.mining={level:8,xp:0,dailyXp:0,passion:2};q.priorities.mine=1;Object.assign(q,{x:20,z:24});
 m.tiles[17*m.width+20]={terrain:'rock',stone:'granite'};expect(applyCommand(m,{type:'designate',kind:'mine',x:20,z:17}).ok).toBe(true);
 for(let i=0;i<300&&q.state!=='working';i++)stepWorld(m);
 expect(q.state).toBe('working');expect(thought(m,q,'passionate-work')).toBeUndefined();
 // The inspector shows no room size gauge below 345.
 expect(needsPage(m,q).rows.some(r=>r.id==='need-room-size')).toBe(false);
});

function needsPage(world:World,pawn:Pawn){
 const state:NativeUiState={world,epoch:345,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[pawn.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{};
 const actions:NativeUiActions={command:async()=>({ok:true}),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop,readState:()=>state};
 setNativeInspectorTab('needs');return buildNativeInspector(state,actions)!;
}

const needsCard=(page:{rows:{id:string;card?:unknown}[]})=>page.rows.find(r=>r.id==='tab-card')!.card as import('../src/ui3d/native-tab-needs').NeedsSpec;
test('the Needs tab shows the room size need and its thought',()=>{
 const {w,small}=rooms();stepWorld(w,75);
 const spec=needsCard(needsPage(w,small));
 // Core does not list the room size (showOnNeedList is false): its value and rule are in the mood bar's tooltip.
 expect(spec.mood!.hint).toContain(`Espace : ${Math.round(small.roomSize345!.level*100)} %`);
 expect(spec.mood!.hint).toContain('sous 30 % intérieur exigu (−5)');
 expect(spec.thoughts.find(t=>t.label==='Intérieur exigu')).toMatchObject({offset:-5});
});

test('save and reload equality, then the same continuation',()=>{
 const {w,small,hall}=rooms();stepWorld(w,60);
 expect(small.roomSize345).toBeDefined();expect(hall.roomSize345).toBeDefined();
 const raw=serializeWorld(w),loaded=deserializeWorld(raw);
 expect(serializeWorld(loaded)).toBe(raw);
 expect(loaded.pawns.map(p=>p.roomSize345)).toEqual(w.pawns.map(p=>p.roomSize345));
 expect(loaded.pawns.map(p=>moodThoughts(loaded,p).map(t=>t.id))).toEqual(w.pawns.map(p=>moodThoughts(w,p).map(t=>t.id)));
 stepWorld(w,90);stepWorld(loaded,90);
 expect(serializeWorld(loaded)).toBe(serializeWorld(w));
 // A current save refuses malformed needs.
 const now=JSON.parse(raw);const index=now.pawns.findIndex((p:Record<string,unknown>)=>p.roomSize345);
 for(const bad of [{level:1.5,indoors:true},{level:-0.1,indoors:true},{level:.1,indoors:true},{level:.5},{level:.5,indoors:1},{level:.5,indoors:true,extra:0},[],null])
  {const r=structuredClone(now);r.pawns[index].roomSize345=bad;expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();}
});

test('migration 344 → 345 by number only: the need starts at its initial level, nothing retroactive',()=>{
 const current=createScenarioWorld(42,64,'crashlanded');stepWorld(current,60);
 expect(current.pawns.some(p=>p.roomSize345)).toBe(true);
 const old=asOldSchema(serializeWorld(current),344),raw=JSON.parse(old);
 expect(raw.schemaVersion).toBe(344);expect(raw.pawns.every((p:Record<string,unknown>)=>!('roomSize345' in p))).toBe(true);
 const migrated=deserializeWorld(old);expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
 for(const p of migrated.pawns){expect(p.roomSize345).toBeUndefined();expect(roomSizeLevel345(p)).toBe(.5);expect(moodThoughts(migrated,p).some(t=>t.id.startsWith('room-size'))).toBe(false);}
 // A 344 save cannot carry the 345 need.
 const r=JSON.parse(old);r.pawns[0].roomSize345={level:.5,indoors:true};
 expect(()=>deserializeWorld(JSON.stringify(r))).toThrow();
 // From there the need runs as in a new game.
 stepWorld(migrated,30);expect(migrated.pawns.some(p=>p.roomSize345)).toBe(true);expect(validateWorld(migrated)).toEqual([]);
});
