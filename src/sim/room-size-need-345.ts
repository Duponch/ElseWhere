import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {sharedLightEnvironmentCache} from './light-environment.ts';
import {carrierOf} from './rescue-state.ts';
import {roofCells} from './roof-rules.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {MoodThought} from './mood.ts';
import type {RoomSpace,RoomTopology} from './room-topology.ts';
import type {Pawn,World} from './types.ts';

/* Schema 345: two everyday mood pieces of RimWorld 1.6 Core, the passionate
 * work thought (passionate-work-345) and the room size need below, read from
 * Need_RoomSize, Need_Seeker, Need, Pawn_NeedsTracker, ThoughtWorker_NeedRoomSize,
 * Room.PsychologicallyOutdoors and the defs NeedDef RoomSize (Needs.xml) and
 * ThoughtDef NeedRoomSize (Thoughts_Situation_Needs.xml). Older schemas never
 * call this module. */
export const MOOD_BASICS_SCHEMA_345=345;
export const isMoodBasics345=(version:unknown):boolean=>Number(version)>=MOOD_BASICS_SCHEMA_345;

/** The saved need: its level (Core curLevel, 0 to 1) and whether its last
 * sample found the pawn in a room that is not psychologically outdoors (the
 * room the thought reads; kept with the level so that the inspector and the
 * simulation give the same thought without a room survey of their own). */
export interface RoomSizeNeed345 {level:number;indoors:boolean}

const f=Math.fround;
/** Need.SetInitialLevel: CurLevelPercentage 0.5. A colonist without a saved
 * need (a migrated save, a new colonist or prisoner) starts here. */
export const ROOM_SIZE_INITIAL_345=.5;
/** NeedDef RoomSize seekerRisePerHour = seekerFallPerHour = 0.90, applied as
 * def rate * 0.06 per NeedInterval (150 Core ticks, 0.06 hour). */
const STEP=f(f(.9)*f(.06));
const VERY_CRAMPED=f(.01),CRAMPED=f(.3),SPACIOUS=f(.7);
export type RoomSizeCategory345='very-cramped'|'cramped'|'normal'|'spacious';
export function roomSizeCategory345(level:number):RoomSizeCategory345 {
  return level<VERY_CRAMPED?'very-cramped':level<CRAMPED?'cramped':level<SPACIOUS?'normal':'spacious';
}

/** Need_RoomSize.RoomCellCountSpaceCurve, evaluated as SimpleCurve.Evaluate
 * with Mathf.Lerp in single precision. */
const CURVE:readonly (readonly [number,number])[]=[[3,0],[9,f(.25)],[16,f(.5)],[42,f(.71)],[100,1]];
export function roomSizeSpaceCurve345(cells:number):number {
  const x=f(cells);
  if(x<=CURVE[0]![0])return CURVE[0]![1];
  if(x>=CURVE.at(-1)![0])return CURVE.at(-1)![1];
  let i=1;while(x>CURVE[i]![0])i++;
  const [ax,ay]=CURVE[i-1]!,[bx,by]=CURVE[i]!,t=Math.max(0,Math.min(1,f(f(x-ax)/f(bx-ax))));
  return f(ay+f(f(by-ay)*t));
}

/** GenRadial.RadialPattern: the first five cells (the pawn's own cell, then
 * the four at distance 1), and the NumCellsInRadius(7.9) cells sampled for
 * the count (squared distance at most 62; the order does not change a count). */
const NEAR:readonly (readonly [number,number])[]=[[0,0],[0,-1],[1,0],[0,1],[-1,0]];
const SAMPLE:readonly (readonly [number,number])[]=(()=>{
  const cells:[number,number][]=[];
  for(let dz=-7;dz<=7;dz++)for(let dx=-7;dx<=7;dx++)if(dx*dx+dz*dz<=62)cells.push([dx,dz]);
  return Object.freeze(cells);
})();
export const ROOM_SIZE_SAMPLE_CELLS_345=SAMPLE.length;

/* Open-roof counts per room of one topology and roof set (both immutable
 * once read: a roof edit makes a new set, a barrier edit a new topology),
 * computed once by a pass over the roofed cells, never per pawn. */
const covered=new WeakMap<RoomTopology,{roofs:ReadonlySet<number>;bySpace:Map<number,number>}>();
function coveredCells(topology:RoomTopology,roofs:ReadonlySet<number>):Map<number,number> {
  const cached=covered.get(topology);if(cached?.roofs===roofs)return cached.bySpace;
  const bySpace=new Map<number,number>();
  for(const index of roofs){const label=topology.labelAt(index);if(label!==undefined&&label>0)bySpace.set(label,(bySpace.get(label)??0)+1);}
  covered.set(topology,{roofs,bySpace});return bySpace;
}
/** Room.PsychologicallyOutdoors: at least 300 open-roof cells, or touching the
 * map edge with half its cells open (same rule as work-environment). */
function spaceOutdoors(space:RoomSpace,bySpace:Map<number,number>):boolean {
  const open=space.cellCount-(bySpace.get(space.id)??0);
  return open>=300||space.touchesMapEdge&&open>=space.cellCount*.5;
}

/** Need_RoomSize.SpacePerceptibleNow. A door cell is a room of its own
 * (Room.IsDoorway), counted only when the pawn stands in it; a wall or rock
 * cell has no room. Not spawned (carried) or psychologically outdoors: 1. */
export function spacePerceptibleNow345(world:World,pawn:Pawn,topology:RoomTopology):{instant:number;indoors:boolean} {
  if(carrierOf(world,pawn.id))return {instant:1,indoors:false};
  const {width,height}=world,roofs=roofCells(world),bySpace=coveredCells(topology,roofs);
  // A room key: a space id (> 0), or -(cell index + 1) for a door's own room.
  const rooms:number[]=[];let indoors=false;
  for(let i=0;i<NEAR.length;i++){
    const x=pawn.x+NEAR[i]![0],z=pawn.z+NEAR[i]![1];
    const room=topology.at(x,z);if(!room||room.kind==='solid')continue;
    const index=z*width+x,door=room.kind==='doorway';
    // A door's room has one cell: outdoors only on the map edge, unroofed.
    const edge=x===0||z===0||x===width-1||z===height-1;
    const outdoors=door?edge&&!roofs.has(index):spaceOutdoors(room,bySpace);
    if(i===0){if(outdoors)return {instant:1,indoors:false};indoors=true;}
    const key=door?-(index+1):room.id;
    if((i===0||!door&&!outdoors)&&!rooms.includes(key))rooms.push(key);
  }
  let count=0;
  for(const [dx,dz] of SAMPLE){
    const x=pawn.x+dx,z=pawn.z+dz;if(x<0||z<0||x>=width||z>=height)continue;
    const index=z*width+x,label=topology.labelAt(index)!;
    if(label>0?rooms.includes(label):label===-2&&rooms.includes(-(index+1)))count++;
  }
  return {instant:roomSizeSpaceCurve345(count),indoors};
}

/** NeedDef RoomSize: colonistAndPrisonersOnly (the player's faction, or a
 * pawn the colony holds), humanlike. Visitors, raiders and animals have no
 * such need. */
export const roomSizeAdmitted345=(p:Pawn):boolean=>!!p.prisoner||isColonist(p)&&!p.visitor;
export const roomSizeLevel345=(p:Pawn):number=>p.roomSize345?.level??ROOM_SIZE_INITIAL_345;

/** Need_Seeker.NeedInterval, at the pawn's own need interval (the caller's
 * wellbeing step). Frozen (Need.IsFrozen): suspended in a casket, asleep or
 * unconscious (freezeWhileSleeping), dead. A pawn that no longer has the need
 * loses it (Pawn_NeedsTracker.RemoveNeed); a new one starts at 0.5. */
export function advanceRoomSize345(world:World,pawn:Pawn,body?:BodyAssessment,topology?:RoomTopology|(()=>RoomTopology)):void {
  if(!isMoodBasics345(world.schemaVersion))return;
  if(!roomSizeAdmitted345(pawn)){if(pawn.roomSize345)delete pawn.roomSize345;return;}
  if(pawn.state==='dead'||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined)return;
  if(pawn.state==='sleeping'||pawn.medicalSleep||!(body??pawnBody(pawn)).canBeAwake)return;
  const rooms=typeof topology==='function'?topology():topology??sharedLightEnvironmentCache(world).read(world).topology;
  const {instant,indoors}=spacePerceptibleNow345(world,pawn,rooms),old=pawn.roomSize345;
  let level=roomSizeLevel345(pawn);
  if(instant>level)level=Math.min(f(Math.min(1,f(level+STEP))),instant);
  else if(instant<level)level=Math.max(f(Math.max(0,f(level-STEP))),instant);
  if(!old||old.level!==level||old.indoors!==indoors)pawn.roomSize345={level,indoors};
}

/** ThoughtDef NeedRoomSize (ThoughtWorker_NeedRoomSize): awake, in a room
 * that is not psychologically outdoors, by category; nothing when normal. */
const THOUGHTS:Readonly<Record<Exclude<RoomSizeCategory345,'normal'>,MoodThought>>=Object.freeze({
  'very-cramped':Object.freeze({id:'room-size-confined',label:'Intérieur confiné',offset:-10,kind:'situation' as const,description:'Besoin d’espace sous 1 % : la pièce autour de ce colon est minuscule.'}),
  cramped:Object.freeze({id:'room-size-cramped',label:'Intérieur exigu',offset:-5,kind:'situation' as const,description:'Besoin d’espace sous 30 % : la pièce autour de ce colon est trop petite.'}),
  spacious:Object.freeze({id:'room-size-spacious',label:'Intérieur spacieux',offset:5,kind:'situation' as const,description:'Besoin d’espace d’au moins 70 % : une grande pièce entoure ce colon.'}),
});
export function roomSizeThought345(pawn:Pawn):MoodThought|undefined {
  const need=pawn.roomSize345;
  if(!need?.indoors||!roomSizeAdmitted345(pawn)||pawn.state==='sleeping'||pawn.medicalSleep)return;
  const category=roomSizeCategory345(need.level);
  return category==='normal'?undefined:THOUGHTS[category];
}

/** Strict save reading: absent before 345; from 345 absent (the initial
 * level) or exactly {level in [0, 1], indoors}. */
export function validRoomSizeField345(item:Record<string,unknown>,version:number):boolean {
  if(!Object.hasOwn(item,'roomSize345'))return true;
  if(!isMoodBasics345(version))return false;
  const v=item.roomSize345;
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
  const r=v as Record<string,unknown>,keys=Object.keys(r);
  return keys.length===2&&Object.hasOwn(r,'level')&&Object.hasOwn(r,'indoors')&&typeof r.level==='number'&&Number.isFinite(r.level)&&r.level>=0&&r.level<=1
    &&f(r.level)===r.level&&typeof r.indoors==='boolean';
}
