import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, stepWorld } from '../src/sim/engine';
import { constructionRecipe, constructionSkillRequired, validConstructionMaterial } from '../src/sim/construction-materials';
import { footprintCells } from '../src/sim/definitions';
import { initialRecreation, recreationKind } from '../src/sim/recreation-rules';
import { recreationSiteValid } from '../src/sim/recreation-space';
import { availableJoyTables354 } from '../src/sim/joy-table-recreation-354';
import { joyTableParts354 } from '../src/render/joy-table-parts354';
import { actualPlantPhysicalMasks256 } from '../src/sim/actual-plant-physical-masks-256';
import { deserializeWorld, serializeWorld, validateWorld } from '../src/sim/serialization';
import { addGroundMaterial, refreshStock } from '../src/sim/materials';
import { COMPLEX_FURNITURE_RESEARCH_COST } from '../src/sim/research';
import { WorkEnvironmentCache } from '../src/sim/work-environment';
import { structureRoomMarketValue } from '../src/sim/room-market-value';
import { structureBeauty } from '../src/sim/room-beauty';
import { architectToolAvailable } from '../src/ui/architect-availability';
import {
  JOY_TABLES_354, JOY_TABLE_KINDS_354, joyTableGainFactor354, joyTableRing354, joyTableTechAllows354, type JoyTableKind354,
} from '../src/sim/joy-tables-354';
import { asOldSchema } from './scenarios/old-schema';
import { initializeDeclaredFixtureTick297 } from './scenarios/initial-core-clock-v492';
import { enclosedRoom } from './scenarios/cleanliness';
import { SCHEMA_VERSION, type Pawn, type Structure, type World } from '../src/sim/types';

const SLOW=60000;
/** Open 40×40 grass map, Complex furniture done, pawns idle, fed and rested. */
function open(seed=354,pawns=1):World {
  const w=createWorld(seed,40,40);initializeDeclaredFixtureTick297(w,2000);
  if(w.deterioration)w.deterioration.lastTick=w.tick;
  w.research={project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];
  // More players than the three generated colonists: copies of the first one, with their own identities.
  if(pawns>w.pawns.length){const original=structuredClone(w.pawns[0]!);w.pawns=Array.from({length:pawns},(_,i)=>({...structuredClone(original),id:w.nextId++,name:`Joueur ${i}`}));}
  else w.pawns=w.pawns.slice(0,pawns);
  for(const [i,p] of w.pawns.entries()){p.x=8+i;p.z=8;p.path=[];p.state='idle';p.hunger=100;p.rest=100;}
  refreshStock(w);return w;
}
/** A bored player: only `kind` is not bored, so only that joy giver can draw. */
function bored(p:Pawn,kind:'dexterity'|'cerebral',level=10):void {
  p.schedule.fill('recreation');p.priorities={...p.priorities,build:0,haul:0,research:0};
  p.recreation=initialRecreation(level);
  for(const k of ['solitary','dexterity','cerebral','social','television'] as const)if(k!==kind){p.recreation.tolerance[k]=80;p.recreation.bored[k]=true;}
}
function place(w:World,kind:Structure['kind'],x:number,z:number,extra:Partial<Structure>={}):Structure {
  const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood',...extra};
  w.structures.push(s);return s;
}

describe('schema 354 joy tables: Core 1.6 billiards, poker, hoopstone ring and Game of Ur', () => {
 it('takes every number from Buildings_Joy, JoyGivers and Jobs_Joy', () => {
  // Stuff plus costList (Cloth then WoodLog); a wooden table merges its WoodLog.
  expect(constructionRecipe({kind:'billiards-table',material:'wood'}).ingredients).toEqual([{item:'wood',quantity:110},{item:'cloth',quantity:80}]);
  expect(constructionRecipe({kind:'billiards-table',material:'steel'}).ingredients).toEqual([{item:'steel',quantity:80},{item:'cloth',quantity:80},{item:'wood',quantity:30}]);
  expect(constructionRecipe({kind:'billiards-table',material:'steel'}).coreWork).toBe(12000);
  expect(constructionRecipe({kind:'billiards-table',material:'wood'}).coreWork).toBe(8400);
  expect(constructionRecipe({kind:'poker-table',material:'steel'}).ingredients).toEqual([{item:'steel',quantity:50},{item:'cloth',quantity:50},{item:'wood',quantity:25}]);
  expect(constructionRecipe({kind:'poker-table',material:'steel'}).coreWork).toBe(10000);
  expect(constructionRecipe({kind:'hoopstone-ring',material:'wood'}).ingredients).toEqual([{item:'wood',quantity:20}]);
  expect(constructionRecipe({kind:'hoopstone-ring',material:'steel'}).coreWork).toBe(100);
  expect(constructionRecipe({kind:'game-of-ur-board',material:'granite-blocks'}).ingredients).toEqual([{item:'granite-blocks',quantity:35}]);
  expect(constructionRecipe({kind:'game-of-ur-board',material:'steel'}).coreWork).toBe(6000);
  expect(JOY_TABLE_KINDS_354.map(k=>constructionSkillRequired(k))).toEqual([0,6,0,6]);
  for(const kind of JOY_TABLE_KINDS_354){
   expect(validConstructionMaterial(kind,'wood',354)).toBe(true);
   expect(validConstructionMaterial(kind,'slate-blocks',354)).toBe(true);
   expect(validConstructionMaterial(kind,'cloth',354)).toBe(false);
   expect(validConstructionMaterial(kind,'wood',353)).toBe(false);
  }
  const f=JOY_TABLES_354;
  expect([f['hoopstone-ring'].baseChance,f['billiards-table'].baseChance,f['game-of-ur-board'].baseChance,f['poker-table'].baseChance]).toEqual([2,4,2,4]);
  expect([f['hoopstone-ring'].maxParticipants,f['billiards-table'].maxParticipants,f['game-of-ur-board'].maxParticipants,f['poker-table'].maxParticipants]).toEqual([3,2,2,4]);
  expect(joyTableGainFactor354('billiards-table','normal')).toBeCloseTo(1.3,12);
  expect(joyTableGainFactor354('poker-table','legendary')).toBeCloseTo(1.3*1.8,12);
  expect(joyTableGainFactor354('game-of-ur-board','awful')).toBeCloseTo(.8*.76,12);
  expect(joyTableGainFactor354('hoopstone-ring','legendary')).toBe(1);
  expect(['hoopstone','billiards','game-of-ur','poker'].map(a=>recreationKind(a as 'poker'))).toEqual(['dexterity','dexterity','cerebral','cerebral']);
  // Beauty: Game of Ur 2 with its quality, the others 0; wealth counts the cloth.
  const w=open();
  expect(structureBeauty({kind:'game-of-ur-board',x:0,z:0,material:'wood',quality:'good'},w.schemaVersion)).toBe(4);
  expect(structureBeauty({kind:'billiards-table',x:0,z:0,material:'wood',quality:'masterwork'},w.schemaVersion)).toBe(0);
  const plain=place(w,'poker-table',20,20,{material:'steel',quality:'normal'});
  expect(structureRoomMarketValue(plain)).toBe(Math.round((50*1.9+50*1.5+25*1.2+10000*.0036)/5)*5);
 });

 it('hides the Neolithic hoopstone ring and Game of Ur board from an industrial colony, as Designator_Build', () => {
  const w=open();
  expect(architectToolAvailable(w,'billiards-table')).toBe(true);
  expect(architectToolAvailable(w,'poker-table')).toBe(true);
  expect(architectToolAvailable(w,'hoopstone-ring')).toBe(false);
  expect(architectToolAvailable(w,'game-of-ur-board')).toBe(false);
  expect(joyTableTechAllows354('hoopstone-ring',{worldFactions:{playerFactionId:1,factions:[{id:1,def:'PlayerTribe'}]}})).toBe(true);
  expect(joyTableTechAllows354('game-of-ur-board',{worldFactions:{playerFactionId:1,factions:[{id:1,def:'PlayerColony'}]}})).toBe(false);
  delete w.research!.complexFurniture;
  expect(architectToolAvailable(w,'billiards-table')).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'poker-table',x:20,z:20,material:'wood'}).ok).toBe(false);
  const old=open();(old as {schemaVersion:number}).schemaVersion=353;
  expect(architectToolAvailable(old,'billiards-table')).toBe(false);
  expect(applyCommand(old,{type:'designate',kind:'billiards-table',x:20,z:20,material:'wood'}).ok).toBe(false);
 });

 it('refuses a billiards table without standable cells all around, and turning the poker table', () => {
  const w=open();
  place(w,'wall',22,19);
  expect(applyCommand(w,{type:'designate',kind:'billiards-table',x:20,z:20,material:'wood'}).ok).toBe(false);
  w.tiles[30*w.width+30]={terrain:'rock',stone:'granite'} as World['tiles'][number];
  expect(applyCommand(w,{type:'designate',kind:'billiards-table',x:31,z:31,material:'wood'}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'billiards-table',x:25,z:25,material:'wood',orientation:1}).ok).toBe(true);
  expect(footprintCells(w.jobs.at(-1)!)).toHaveLength(6);
  expect(applyCommand(w,{type:'designate',kind:'poker-table',x:10,z:25,material:'wood',orientation:1}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'poker-table',x:10,z:25,material:'wood'}).ok).toBe(true);
  expect(validateWorld(w)).toEqual([]);
 });

 for(const kind of JOY_TABLE_KINDS_354)it(`a colonist delivers the materials and builds a ${kind} through a real construction job`, () => {
  const w=open(),builder=w.pawns[0]!,f=JOY_TABLES_354[kind];
  builder.schedule.fill('work');builder.priorities.build=1;builder.priorities.haul=1;builder.recreation.level=90;
  builder.skills.construction={level:8,xp:0,dailyXp:0,passion:0};
  addGroundMaterial(w,'wood',f.stuff+f.wood,{x:8,z:10},'wood');
  if(f.cloth)addGroundMaterial(w,'textile',f.cloth,{x:9,z:10},'cloth');
  refreshStock(w);
  expect(applyCommand(w,{type:'designate',kind,x:20,z:20,material:'wood'}).ok).toBe(true);
  for(let i=0;i<4000&&!w.structures.some(s=>s.kind===kind);i++)stepWorld(w);
  const built=w.structures.find(s=>s.kind===kind)!;
  expect(built).toBeDefined();expect(built.material).toBe('wood');
  if(f.quality)expect(built.quality).toBeDefined();else expect(built.quality).toBeUndefined();
  expect(w.jobs.some(j=>j.kind===kind)).toBe(false);
  expect(w.piles.filter(p=>p.item==='wood'||p.item==='cloth').reduce((n,p)=>n+p.quantity,0)).toBe(0);
  expect(validateWorld(w)).toEqual([]);
 },SLOW);

 /** Builds the scene for one kind, a bored player and, for seated games, chairs. */
 function scene(kind:JoyTableKind354,seats:boolean,players=1){
  const w=open(354,players),table=place(w,kind,20,20,{quality:JOY_TABLES_354[kind].quality?'normal':undefined});
  if(!JOY_TABLES_354[kind].quality)delete table.quality;
  // Cardinal neighbours of the 2×2 poker table (or 1×1 board): five seats for poker.
  if(seats)for(const c of kind==='poker-table'?[{x:19,z:20},{x:22,z:20},{x:20,z:19},{x:20,z:22},{x:21,z:22}]:[{x:19,z:20},{x:21,z:20},{x:20,z:19},{x:20,z:21}])
   place(w,'stool',c.x,c.z,{quality:'normal'});
  for(const p of w.pawns)bored(p,JOY_TABLES_354[kind].joyKind);
  return {w,table};
 }
 const SKILL={'hoopstone-ring':'shooting','billiards-table':'shooting','game-of-ur-board':'intellectual','poker-table':'intellectual'} as const;
 for(const kind of JOY_TABLE_KINDS_354)it(`a bored colonist walks to the ${kind} and plays: joy, tolerance and skill rise only while playing`, () => {
  const {w,table}=scene(kind,kind==='poker-table'),p=w.pawns[0]!,f=JOY_TABLES_354[kind],skill=SKILL[kind];
  const kindKey=f.joyKind;let traveled=false,played=0;
  const startJoy=p.recreation.level;
  for(let i=0;i<500&&played<120;i++){
   const joy=p.recreation.level,tol=p.recreation.tolerance[kindKey],xp=p.skills[skill]?.xp??0;
   stepWorld(w);
   const task=p.recreation.task;
   if(!task)continue;
   expect(task.activity).toBe(f.activity);expect(task.buildingId).toBe(table.id);
   expect(recreationSiteValid(w,task)).toBe(true);
   if(task.phase==='travel')traveled=true;
   if(task.phase==='active'&&p.state==='recreating'){
    played++;
    expect(p.recreation.level).toBeGreaterThan(joy);
    expect(p.recreation.tolerance[kindKey]).toBeGreaterThan(tol);
    expect(p.skills[skill]!.xp).toBeGreaterThan(xp);
   }
   if(i%50===0)expect(validateWorld(w)).toEqual([]);
  }
  expect(traveled).toBe(true);expect(played).toBeGreaterThanOrEqual(100);
  expect(p.recreation.level).toBeGreaterThan(startJoy);
  if(kind==='poker-table')expect(p.recreation.task!.seatId).toBeDefined();
  if(kind==='game-of-ur-board')expect(p.recreation.task!.seatId).toBeUndefined();
  if(kind==='hoopstone-ring'){const t=p.recreation.task!.target;expect(Math.max(Math.abs(t.x-20),Math.abs(t.z-20))).toBe(5);}
 },SLOW);

 it('a billiards player walks around the table between 600-tick shots, the game clock running', () => {
  const {w,table}=scene('billiards-table',false),p=w.pawns[0]!;
  const ring=joyTableRing354(footprintCells(table)),places=new Set<string>();
  let walkedBetween=false,saved:string|undefined;
  for(let i=0;i<450;i++){
   stepWorld(w);
   const task=p.recreation.task;if(!task)break;
   expect(ring.some(c=>c.x===task.target.x&&c.z===task.target.z)).toBe(true);
   if(task.phase==='active')places.add(`${task.target.x},${task.target.z}`);
   if(task.phase==='travel'&&task.elapsed>0){walkedBetween=true;saved??=serializeWorld(w);}
   if(task.activity==='billiards')expect(task.shot354).toBeLessThanOrEqual(60);
  }
  expect(walkedBetween).toBe(true);expect(places.size).toBeGreaterThan(1);
  // Saved while walking to the next shot: the reloaded game continues identically.
  const a=deserializeWorld(saved!),b=deserializeWorld(saved!);
  expect(validateWorld(a)).toEqual([]);
  stepWorld(a,40);stepWorld(b,40);expect(a).toEqual(b);
 },SLOW);

 it('poker fills four of five seats: a fifth player is refused (joyMaxParticipants 4)', () => {
  const {w,table}=scene('poker-table',true,5);
  for(let i=0;i<200;i++)stepWorld(w);
  const players=w.pawns.filter(p=>p.recreation.task?.activity==='poker');
  expect(players.length).toBe(4);expect(new Set(players.map(p=>p.recreation.task!.seatId)).size).toBe(4);
  expect(players.every(p=>p.recreation.task!.buildingId===table.id)).toBe(true);
  // A save mid-game reloads exactly and continues identically.
  const saved=serializeWorld(w),a=deserializeWorld(saved);
  expect(a).toEqual(w);stepWorld(a,30);stepWorld(w,30);expect(a).toEqual(w);
  // The fifth colonist finds the table full; a hand-made fifth player on the free seat is refused.
  const fifth=w.pawns.find(p=>p.recreation.task?.activity!=='poker')!;
  expect(availableJoyTables354(w,fifth.id)?.get('poker')??[]).toEqual([]);
  const raw=JSON.parse(saved),extra=raw.pawns.find((q:Pawn)=>q.id===fifth.id),seat=w.structures.find(s=>s.kind==='stool'&&!players.some(p=>p.recreation.task!.seatId===s.id))!;
  delete extra.idleWander300;delete extra.motion;
  Object.assign(extra,{x:seat.x,z:seat.z,path:[],moveCooldown:0,state:'recreating',jobId:null});
  extra.recreation.task={activity:'poker',target:{x:seat.x,z:seat.z},buildingId:table.id,seatId:seat.id,phase:'active',elapsed:1};
  expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/Too many joy building participants/);
 },SLOW);

 it('the plant masks know the four buildings: the zero-fill hoopstone ring is an edifice, the tables give cover', () => {
  const w=open();
  const ring=place(w,'hoopstone-ring',5,5),billiards=place(w,'billiards-table',20,20,{quality:'normal'});
  place(w,'game-of-ur-board',10,30,{quality:'normal'});place(w,'poker-table',30,30,{quality:'normal'});
  const masks=actualPlantPhysicalMasks256(w) as unknown as Record<string,Uint8Array>;
  const at=(c:{x:number;z:number})=>c.z*w.width+c.x;
  expect(masks.coverOrEdifice![at(ring)]).toBe(1);
  for(const c of footprintCells(billiards))expect(masks.coverOrEdifice![at(c)]).toBe(1);
  expect(masks.fullFill![at(billiards)]).toBe(0);
 });

 it('each building has its own low-poly boxes inside its footprint, for every orientation', () => {
  for(const kind of JOY_TABLE_KINDS_354)for(const orientation of [0,1,2,3] as const){
   const s:Structure={id:9,kind,x:20,z:20,orientation,footprint:'standard',material:'steel',quality:'normal'};
   const parts=joyTableParts354([s]),cells=footprintCells(s);
   expect(parts.length).toBeGreaterThan(5);
   const minX=Math.min(...cells.map(c=>c.x))-.5,maxX=Math.max(...cells.map(c=>c.x))+.5,minZ=Math.min(...cells.map(c=>c.z))-.5,maxZ=Math.max(...cells.map(c=>c.z))+.5;
   for(const p of parts){
    expect(p.targetId).toBe(9);
    expect(p.x-(p.sx??0)/2).toBeGreaterThanOrEqual(minX-1e-9);expect(p.x+(p.sx??0)/2).toBeLessThanOrEqual(maxX+1e-9);
    expect(p.z-(p.sz??0)/2).toBeGreaterThanOrEqual(minZ-1e-9);expect(p.z+(p.sz??0)/2).toBeLessThanOrEqual(maxZ+1e-9);
    expect(p.y-(p.sy??0)/2).toBeGreaterThanOrEqual(-1e-9);
   }
  }
 });

 it('the four buildings make a recreation room, each worth 7 as RoomRoleWorker_RecRoom', () => {
  const w=open();enclosedRoom(w,{x:10,z:10},9);
  place(w,'hoopstone-ring',12,12);
  expect(new WorkEnvironmentCache().read(w).room({x:12,z:13})?.role).toBe('recreation');
  place(w,'bed',15,15,{quality:'normal'});
  // One bed alone makes a bedroom (100000): joy buildings do not outweigh it.
  expect(new WorkEnvironmentCache().read(w).room({x:12,z:13})?.role).toBe('bedroom');
 });

 it('the joy giver draws follow the Core weights among the buildings present', () => {
  // Every giver available, zero tolerance: weights 2.5 horseshoes, 2 hoopstone,
  // 4 billiards, 2 Game of Ur, 2 chess, 4 poker (skygaze bored).
  const base=open(1,1);
  place(base,'horseshoes',30,8);place(base,'hoopstone-ring',8,30);place(base,'billiards-table',20,20,{quality:'normal'});
  place(base,'game-of-ur-board',30,30,{quality:'normal'});place(base,'chess-table',14,30,{quality:'normal'});place(base,'stool',13,30,{quality:'normal'});
  place(base,'poker-table',30,20,{quality:'normal'});place(base,'stool',29,20,{quality:'normal'});
  const p0=base.pawns[0]!;bored(p0,'dexterity');p0.recreation.tolerance.cerebral=0;p0.recreation.bored.cerebral=false;
  const json=serializeWorld(base),counts=new Map<string,number>();
  const runs=240;
  for(let r=0;r<runs;r++){
   const w=deserializeWorld(json);w.rng=(0x9e3779b9*(r+1))>>>0||1;
   for(let i=0;i<5&&!w.pawns[0]!.recreation.task;i++)stepWorld(w);
   const a=w.pawns[0]!.recreation.task?.activity??'none';counts.set(a,(counts.get(a)??0)+1);
  }
  const share=(a:string)=>(counts.get(a)??0)/runs;
  expect(counts.get('none')??0).toBe(0);
  expect(share('billiards')).toBeGreaterThan(4/16.5-.09);expect(share('billiards')).toBeLessThan(4/16.5+.09);
  expect(share('poker')).toBeGreaterThan(4/16.5-.09);expect(share('poker')).toBeLessThan(4/16.5+.09);
  for(const a of ['horseshoes','hoopstone','game-of-ur','chess'])expect(share(a)).toBeGreaterThan(.04);
 },SLOW);

 it('a colony without any of these buildings draws exactly as before; at 353 they are refused; 353 migrates by number only', () => {
  const make=()=>{const w=open(77,2);place(w,'horseshoes',30,8);place(w,'chess-table',14,30,{quality:'normal'});place(w,'stool',13,30,{quality:'normal'});place(w,'stool',15,30,{quality:'normal'});
   for(const p of w.pawns){bored(p,'dexterity');p.recreation.tolerance.cerebral=0;p.recreation.bored.cerebral=false;}return w;};
  const now=make(),old=make();(old as {schemaVersion:number}).schemaVersion=353;
  for(let i=0;i<300;i++){stepWorld(now);stepWorld(old);}
  expect(now.pawns.some(p=>p.recreation.task)).toBe(true);
  const strip=(x:World)=>{const c=structuredClone(x) as Partial<World>;delete c.schemaVersion;return JSON.stringify(c);};
  expect(strip(old)).toBe(strip(now));
  // Migration 353 -> 354: number only.
  const current=serializeWorld(now),migrated=deserializeWorld(asOldSchema(current,353));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(strip(migrated)).toBe(strip(now));
  // A 353 save holding a joy building, or a joy activity, is refused.
  const withTable=open();place(withTable,'billiards-table',20,20,{quality:'normal'});
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withTable),353))).toThrow();
  expect(validateWorld(withTable)).toEqual([]);
 },SLOW);
});
