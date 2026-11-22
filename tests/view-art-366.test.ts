import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../src/sim/engine';
import { footprintCells } from '../src/sim/definitions';
import { initialRecreation, RECREATION_GAIN, recreationKind } from '../src/sim/recreation-rules';
import { recreationSiteValid } from '../src/sim/recreation-space';
import { deserializeWorld, serializeWorld, validateWorld } from '../src/sim/serialization';
import { refreshStock } from '../src/sim/materials';
import { captureRoomQuality } from '../src/sim/room-quality';
import { inJoyTableRing354 } from '../src/sim/joy-tables-354';
import { sculptureBeauty } from '../src/sim/furniture-stats';
import {
  VIEW_ART_BASE_CHANCE_366, VIEW_ART_DURATION_366, viewArtCandidates366, viewArtGainFactor366, viewArtTouchCell366, viewArtWeight366,
} from '../src/sim/view-art-366';
import { JOY_KIND_LABELS } from '../src/ui/core-colony-alerts';
import { asNumberOnly, asOldSchema } from './scenarios/old-schema';
import { initializeDeclaredFixtureTick297 } from './scenarios/initial-core-clock-v492';
import { enclosedRoom } from './scenarios/cleanliness';
import { SCHEMA_VERSION, type Pawn, type Structure, type World } from '../src/sim/types';

const SLOW=60000;
/** Open 40×40 grass map, pawns idle, fed and rested. */
function open(seed=366,pawns=1):World {
  const w=createWorld(seed,40,40);initializeDeclaredFixtureTick297(w,2000);
  if(w.deterioration)w.deterioration.lastTick=w.tick;
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];
  w.roofing={constructed:[],build:[],remove:[],cursor:0};
  w.pawns=w.pawns.slice(0,pawns);
  for(const [i,p] of w.pawns.entries()){p.x=10+i;p.z=10;p.path=[];p.state='idle';p.hunger=100;p.rest=100;}
  refreshStock(w);return w;
}
/** A 13×13 walled room around (10,10), its 11×11 inside roofed: no sky to
 * gaze at, so ViewArt is the only Meditative giver left. */
function roofedRoom(w:World,origin={x:4,z:4},size=13):number[] {
  const room=enclosedRoom(w,origin,size);
  w.roofing={constructed:[...new Set([...(w.roofing?.constructed??[]),...room.cells])].sort((a,b)=>a-b),build:[],remove:[],cursor:0};
  return room.cells;
}
/** A bored player: only the Meditative (solitary) kind can be drawn. */
function bored(p:Pawn,level=10):void {
  p.schedule.fill('recreation');p.priorities={...p.priorities,build:0,haul:0,research:0};
  p.recreation=initialRecreation(level);
  for(const k of ['dexterity','cerebral','social','television'] as const){p.recreation.tolerance[k]=80;p.recreation.bored[k]=true;}
}
function place(w:World,kind:Structure['kind'],x:number,z:number,extra:Partial<Structure>={}):Structure {
  const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood',...extra};
  // A sculpture carries its factual provenance: an author and a creation tick.
  if(kind==='small-sculpture'||kind==='large-sculpture')s.art??={authorId:w.pawns[0]!.id,createdAt:0};
  w.structures.push(s);return s;
}
function scene(quality='normal',material='wood',kind:Structure['kind']='small-sculpture'){
  const w=open();roofedRoom(w);
  const art=place(w,kind,12,10,{material:material as Structure['material'],quality:quality as Structure['quality']});
  bored(w.pawns[0]!);
  return {w,art,p:w.pawns[0]!};
}
/** Steps until the first active viewing tick; returns the joy gained on it.
 * The Meditative tolerance was 0 before (it cannot fall below), so it now
 * holds 0.65 of the gain (JoyToleranceSet.Notify_JoyGained). */
function firstActiveGain(w:World,p:Pawn,limit=200):number {
  for(let i=0;i<limit;i++){
    expect(p.recreation.tolerance.solitary).toBe(0);
    stepWorld(w);
    const task=p.recreation.task;
    if(task?.activity==='view-art'&&task.phase==='active'&&p.state==='recreating')return p.recreation.tolerance.solitary/.65;
  }
  throw new Error('never viewed the sculpture');
}

describe('schema 366: viewing art as recreation (Core 1.6 JoyGiver_ViewArt)', () => {
 it('takes every number from JoyGivers, Jobs_Joy, the Beauty and JoyGainFactor stats', () => {
  expect(VIEW_ART_BASE_CHANCE_366).toBe(1);
  expect(VIEW_ART_DURATION_366).toBe(400); // joyDuration 4000 Core ticks
  expect(recreationKind('view-art')).toBe('solitary'); // Meditative
  const s=(kind:'small-sculpture'|'large-sculpture',material:string,quality:string)=>({id:1,kind,x:0,z:0,orientation:0,footprint:'standard',material,quality}) as Structure;
  const w=open();
  // Beauty over the def's abstract Beauty (50 small, 100 large), times the JoyGainFactor quality factor.
  expect(viewArtGainFactor366(w,s('small-sculpture','wood','normal'))).toBe(1);
  expect(viewArtGainFactor366(w,s('small-sculpture','wood','excellent'))).toBeCloseTo(3*1.24,12);
  expect(viewArtGainFactor366(w,s('small-sculpture','wood','poor'))).toBeCloseTo(.5*.88,12);
  expect(viewArtGainFactor366(w,s('small-sculpture','jade','legendary'))).toBeCloseTo(1080/50*1.8,12);
  expect(sculptureBeauty(s('large-sculpture','marble-blocks','good'),w.schemaVersion)).toBe(270);
  expect(viewArtGainFactor366(w,s('large-sculpture','marble-blocks','good'))).toBeCloseTo(2.7*1.12,12);
  // Awful: Beauty -5, so no joy at all (the driver keeps a non-positive ratio at 0).
  expect(viewArtGainFactor366(w,s('small-sculpture','wood','awful'))).toBe(0);
  // Draw weight Mathf.Max(Beauty, 0.5).
  expect(viewArtWeight366(w,s('small-sculpture','wood','awful'))).toBe(.5);
  expect(viewArtWeight366(w,s('large-sculpture','wood','normal'))).toBe(100);
  expect(JOY_KIND_LABELS.find(([k])=>k==='solitary')?.[1]).toContain('œuvres d’art');
 });

 it('a bored colonist walks next to the sculpture, views it through real ticks and gains joy by quality', () => {
  const {w,art,p}=scene();
  let traveled=false,viewed=0;
  for(let i=0;i<120&&viewed<60;i++){
   const joy=p.recreation.level,tol=p.recreation.tolerance.solitary;
   stepWorld(w);
   const task=p.recreation.task;if(!task)continue;
   expect(task.activity).toBe('view-art');expect(task.buildingId).toBe(art.id);
   expect(inJoyTableRing354(footprintCells(art),task.target)).toBe(true);
   expect(recreationSiteValid(w,task)).toBe(true);
   if(task.phase==='travel')traveled=true;
   if(task.phase==='active'&&p.state==='recreating'){
    viewed++;
    expect(p.x).toBe(task.target.x);expect(p.z).toBe(task.target.z);
    expect(p.recreation.level).toBeGreaterThan(joy);
    expect(p.recreation.tolerance.solitary).toBeGreaterThan(tol);
   }
   if(i%20===0)expect(validateWorld(w)).toEqual([]);
  }
  expect(traveled).toBe(true);expect(viewed).toBe(60);
  // Touch path end: the touch cell nearest to the colonist (10,10) is (11,10).
  expect(p.recreation.task!.target).toEqual({x:11,z:10});
  // First active tick, zero Meditative tolerance: exactly the job gain times the factor.
  for(const [quality,factor] of [['normal',1],['excellent',3*1.24],['poor',.5*.88],['awful',0]] as const){
   const sc=scene(quality);
   expect(firstActiveGain(sc.w,sc.p)).toBeCloseTo(RECREATION_GAIN*factor,10);
  }
 },SLOW);

 it('the viewing ends after joyDuration, or once joy is full, with the recreation room memory', () => {
  // An awful sculpture gives nothing: the viewer stays the whole 4000 Core ticks.
  const awful=scene('awful');
  let active=0;
  for(let i=0;i<600;i++){
   stepWorld(awful.w);const t=awful.p.recreation.task;
   if(t?.activity==='view-art'&&t.phase==='active')active=t.elapsed;
   else if(active>0)break;
  }
  expect(active).toBe(VIEW_ART_DURATION_366-1);
  expect(awful.p.recreation.task?.activity).not.toBe('view-art');
  // A legendary jade sculpture fills joy quickly; the room memory follows when the room is impressive enough.
  const rich=scene('legendary','jade','large-sculpture');
  let ended=false,steps=0;
  for(;steps<300&&!ended;steps++){
   stepWorld(rich.w);
   if(rich.p.recreation.task?.activity==='view-art'&&rich.p.recreation.task.phase==='active')continue;
   if(rich.p.recreation.level>99)ended=true;
  }
  expect(ended).toBe(true);expect(steps).toBeLessThan(80);
  const stage=captureRoomQuality(rich.w).room(rich.p)!.stage;
  expect(stage).toBeGreaterThanOrEqual(3);
  expect(rich.p.roomMemories?.find(m=>m.kind==='recreation')?.stage).toBe(stage);
 },SLOW);

 it('a sculpture outside the allowed area or out of reach is skipped; the reachable one is viewed', () => {
  // Allowed area without the sculpture's cell: never viewed.
  const {w,art,p}=scene();
  const cells:number[]=[];for(let z=5;z<=15;z++)for(let x=5;x<=11;x++)cells.push(z*w.width+x);
  const id=w.nextId++;w.allowedAreas=[{id,label:'Ouest',color:0x88aa66,cells}];p.allowedAreaId=id;
  expect(validateWorld(w)).toEqual([]);
  expect(viewArtCandidates366(w,p,()=>false)).toEqual([]);
  for(let i=0;i<150;i++){stepWorld(w);expect(p.recreation.task?.activity).not.toBe('view-art');}
  // Moving the boundary over the sculpture admits it.
  w.allowedAreas[0]!.cells=[...cells,10*w.width+12].sort((a,b)=>a-b);
  for(let i=0;i<150&&p.recreation.task?.activity!=='view-art';i++)stepWorld(w);
  expect(p.recreation.task?.buildingId).toBe(art.id);
  // A far more beautiful sculpture sealed in a walled, roofed cell is never chosen; the reachable awful one is.
  const sealed=open();roofedRoom(sealed);
  const awfulArt=place(sealed,'small-sculpture',12,10,{quality:'awful'});
  for(let z=20;z<=24;z++)for(let x=20;x<=24;x++)if(x===20||x===24||z===20||z===24)place(sealed,'wall',x,z);
  const locked=place(sealed,'large-sculpture',22,22,{material:'jade',quality:'legendary'});
  sealed.roofing!.constructed=[...sealed.roofing!.constructed,...[21,22,23].flatMap(z=>[21,22,23].map(x=>z*sealed.width+x))].sort((a,b)=>a-b);
  const q=sealed.pawns[0]!;bored(q);
  expect(viewArtCandidates366(sealed,q,()=>true)?.map(s=>s.id)).toEqual([awfulArt.id,locked.id]);
  for(let i=0;i<60&&!q.recreation.task;i++)stepWorld(sealed);
  expect(q.recreation.task?.activity).toBe('view-art');expect(q.recreation.task?.buildingId).toBe(awfulArt.id);
 },SLOW);

 it('Core validator: player faction, roof or enjoyable outdoors, fog, one viewer, and the art of a bedroom', () => {
  const w=open(366,2);roofedRoom(w);
  const [a,b]=w.pawns as [Pawn,Pawn];
  const art=place(w,'small-sculpture',12,10,{quality:'normal'});
  const all=()=>true;
  expect(viewArtCandidates366(w,a,all)?.map(s=>s.id)).toEqual([art.id]);
  // Another faction's sculpture, or one under the fog, is not offered.
  art.factionId=null;expect(viewArtCandidates366(w,a,all)).toEqual([]);delete art.factionId;
  w.tiles[10*w.width+12]={...w.tiles[10*w.width+12]!,fogged:true};expect(viewArtCandidates366(w,a,all)).toEqual([]);
  w.tiles[10*w.width+12]={terrain:'grass'};
  // Reserved by a viewer already there: one viewer at a time.
  b.recreation.task={activity:'view-art',buildingId:art.id,target:{x:13,z:10},phase:'travel',elapsed:0};
  expect(viewArtCandidates366(w,a,all)).toEqual([]);b.recreation.task=null;
  // An unroofed sculpture in the rain is skipped; a roofed one is still viewed.
  const outside=place(w,'small-sculpture',30,30,{quality:'normal'});
  w.weather={...w.weather!,previous:'rain',current:'rain',ageCore:10000};
  expect(viewArtCandidates366(w,a,all)?.map(s=>s.id)).toEqual([art.id]);
  w.weather={...w.weather!,previous:'clear',current:'clear',ageCore:10000};
  // The bedroom of one owner: only that owner views its art (avoidViewingArtIfUnowned).
  const bed=place(w,'bed',6,6,{quality:'normal'});a.bedId=bed.id;
  const ids=(p:Pawn)=>viewArtCandidates366(w,p,all)?.map(s=>s.id).filter(id=>id!==outside.id);
  expect(ids(a)).toEqual([art.id]);expect(ids(b)).toEqual([]);
  // Two owned beds make a barracks without an owner: nobody views its art.
  const bed2=place(w,'bed',8,6,{quality:'normal'});b.bedId=bed2.id;
  expect(ids(a)).toEqual([]);expect(ids(b)).toEqual([]);
  // Corner touch: a diagonal cell is lost once both cells between it and the sculpture are walls.
  expect(viewArtTouchCell366(w,art,{x:13,z:11})).toBe(true);
  place(w,'wall',13,10);place(w,'wall',12,11);
  expect(viewArtTouchCell366(w,art,{x:13,z:11})).toBe(false);
 });

 it('a save mid-view reloads exactly and continues identically; corrupt viewings are refused', () => {
  const {w,art,p}=scene();
  for(let i=0;i<200&&!(p.recreation.task?.activity==='view-art'&&p.recreation.task.phase==='active'&&p.recreation.task.elapsed>5);i++)stepWorld(w);
  expect(p.recreation.task?.phase).toBe('active');
  const saved=serializeWorld(w),a=deserializeWorld(saved);
  expect(validateWorld(a)).toEqual([]);expect(a).toEqual(w);
  stepWorld(a,40);stepWorld(w,40);expect(a).toEqual(w);
  // A second viewer of the same sculpture, a seat, or a viewer away from it is refused.
  const raw=JSON.parse(saved),viewer=raw.pawns[0];
  const two=structuredClone(raw),copy={...structuredClone(viewer),id:two.nextId++,name:'Double',x:13,z:10};
  copy.recreation.task={...viewer.recreation.task,target:{x:13,z:10}};
  delete copy.idleWander300;delete copy.motion;two.pawns.push(copy);
  expect(()=>deserializeWorld(JSON.stringify(two))).toThrow(/Too many art viewers/);
  const far=structuredClone(raw);Object.assign(far.pawns[0],{x:20,z:20});delete far.pawns[0].motion;delete far.pawns[0].idleWander300;far.pawns[0].recreation.task.target={x:20,z:20};
  expect(()=>deserializeWorld(JSON.stringify(far))).toThrow(/Invalid art viewing source or place/);
  const wrong=structuredClone(raw);wrong.pawns[0].recreation.task.buildingId=w.structures.find(s=>s.kind==='wall')!.id;
  expect(()=>deserializeWorld(JSON.stringify(wrong))).toThrow(/Invalid art viewing source or place/);
  expect(art.id).toBe(viewer.recreation.task.buildingId);
 },SLOW);

 it('below 366 nobody views art and the draws are unchanged; 365 migrates by number only', () => {
  // With a sculpture, a 365 game never offers the giver.
  const old=scene().w;(old as {schemaVersion:number}).schemaVersion=365;
  for(let i=0;i<200;i++){stepWorld(old);expect(old.pawns[0]!.recreation.task?.activity).not.toBe('view-art');}
  // Without a sculpture, 365 and 366 run bit-identically (skygaze outdoors).
  const make=()=>{const w=open(77,2);for(const p of w.pawns)bored(p);return w;};
  const now=make(),before=make();(before as {schemaVersion:number}).schemaVersion=365;
  for(let i=0;i<300;i++){stepWorld(now);stepWorld(before);}
  expect(now.pawns.some(p=>p.recreation.task?.activity==='skygaze')).toBe(true);
  const strip=(x:World)=>{const c=structuredClone(x) as Partial<World>;delete c.schemaVersion;return JSON.stringify(c);};
  expect(strip(before)).toBe(strip(now));
  // A sculpture nobody may view (another faction's) adds no choice and no draw at 366.
  const foreign=(version?:number)=>{const w=make();place(w,'small-sculpture',20,12,{quality:'legendary',factionId:null});if(version)(w as {schemaVersion:number}).schemaVersion=version;return w;};
  const f366=foreign(),f365=foreign(365);
  for(let i=0;i<300;i++){stepWorld(f366);stepWorld(f365);}
  expect(strip(f365)).toBe(strip(f366));
  // Migration 365 -> 366: number only, even with a sculpture standing.
  const idle=scene().w;const current=serializeWorld(idle),migrated=deserializeWorld(asOldSchema(current,365));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(serializeWorld(migrated)).toBe(asNumberOnly(current,365));
  // A 365 save holding a viewing is refused.
  const {w:viewing,p}=scene();
  for(let i=0;i<100&&p.recreation.task?.activity!=='view-art';i++)stepWorld(viewing);
  expect(p.recreation.task?.activity).toBe('view-art');
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(viewing),365))).toThrow();
 },SLOW);
});
