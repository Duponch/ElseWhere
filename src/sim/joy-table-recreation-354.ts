import { deconstructionReserved } from './deconstruction-rules.ts';
import { footprintCells } from './definitions.ts';
import { isDiningSeat } from './dining.ts';
import { pawnBody } from './health-rules.ts';
import {
  BILLIARDS_SHOT_TICKS_354, inJoyTableRing354, isJoyTableActivity354, isJoyTableKind354, isJoyTablesSchema354,
  JOY_TABLE_BY_ACTIVITY_354, joyTableCardinal354, joyTableCardinalCell354, joyTableGainFactor354, joyTableRequiresChair354,
  joyTableRing354, joyTableXpPerTick354, type JoyTableActivity354,
} from './joy-tables-354.ts';
import { cellIndex, routeToCell } from './pathfinding.ts';
import { learnSkill } from './skills.ts';
import type { NeedContext } from './needs.ts';
import { RECREATION_DURATION, type OrdinaryRecreationTask } from './recreation-rules.ts';
import type { Cell, Pawn, Structure, World } from './types.ts';

/** Joy givers of schema 354 (JoyGivers.xml): Play_Hoopstone and Play_Billiards
 * (dexterity), Play_GameOfUr and Play_Poker (cerebral). Nothing here runs or
 * draws below 354, and a colony without any of these buildings never reaches
 * a draw: the joy giver list is unchanged. */
export interface JoyTableSpace354 {
  readonly tables:ReadonlyMap<number,Structure>;
  readonly seats:ReadonlyMap<number,Structure>;
  readonly objects:ReadonlySet<number>;
  readonly standable:(cell:Cell)=>boolean;
}

/** JoyGiver.CanBeGivenTo: required capacities (Manipulation, plus Sight for
 * billiards and poker). */
export function joyTableCapable354(pawn:Pawn,activity:JoyTableActivity354):boolean {
  const body=pawnBody(pawn).capacities;
  return body.manipulation>0&&(!JOY_TABLE_BY_ACTIVITY_354[activity].needsSight||body.sight>0);
}
/** Buildings of each giver that still accept a player: Reserve(maxParticipants)
 * and no claimed deconstruction. One structure pass, one pawn pass. */
export function availableJoyTables354(world:World,pawnId:number):ReadonlyMap<JoyTableActivity354,Structure[]>|undefined {
  if(!isJoyTablesSchema354(world.schemaVersion))return undefined;
  let tables:Structure[]|undefined;
  for(const s of world.structures)if(isJoyTableKind354(s.kind))(tables??=[]).push(s);
  if(!tables)return undefined;
  const users=new Map<number,number>();
  for(const p of world.pawns)if(p.id!==pawnId&&p.recreation?.task&&isJoyTableActivity354(p.recreation.task.activity)){
    const id=p.recreation.task.buildingId!;users.set(id,(users.get(id)??0)+1);
  }
  const out=new Map<JoyTableActivity354,Structure[]>();
  for(const s of tables){
    const f=JOY_TABLE_BY_ACTIVITY_354[activityOf(s)];
    if((users.get(s.id)??0)>=f.maxParticipants||deconstructionReserved(world,s.id,pawnId))continue;
    const list=out.get(f.activity);if(list)list.push(s);else out.set(f.activity,[s]);
  }
  return out;
}
const activityOf=(s:Structure):JoyTableActivity354=>s.kind==='hoopstone-ring'?'hoopstone':s.kind==='billiards-table'?'billiards':s.kind==='game-of-ur-board'?'game-of-ur':'poker';
const KIND_OF:Readonly<Record<JoyTableActivity354,Structure['kind']>>=Object.freeze({hoopstone:'hoopstone-ring',billiards:'billiards-table','game-of-ur':'game-of-ur-board',poker:'poker-table'});

/** JoyGiver_PlayBilliards.ThingHasStandableSpaceOnAllSides. Out-of-map cells
 * are not standable. */
export function billiardsAllSidesStandable354(world:World,table:Structure,standable:(cell:Cell)=>boolean):boolean {
  for(const cell of joyTableRing354(footprintCells(table)))
    if(cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height||!standable(cell))return false;
  return true;
}

/** Candidate places for one giver. Hoopstone shares the horseshoes watch
 * area (watchBuildingStandDistanceRange 5~5, rect width 3); billiards any
 * 8-way adjacent cell; Game of Ur and poker a cardinal neighbour (a seat
 * first, Game of Ur also the bare cell since requireChair is false). */
export function joyTableCandidates354(world:World,activity:JoyTableActivity354,tables:readonly Structure[],space:JoyTableSpace354,reserved:ReadonlySet<number>,throwCells:(pin:Cell)=>Cell[]):OrdinaryRecreationTask[] {
  const out:OrdinaryRecreationTask[]=[];
  for(const table of tables){
    if(activity==='hoopstone'){for(const target of throwCells(table))if(!reserved.has(cellIndex(world,target.x,target.z)))out.push({activity,buildingId:table.id,target,phase:'travel',elapsed:0});continue;}
    const cells=footprintCells(table);
    if(activity==='billiards'){
      if(!billiardsAllSidesStandable354(world,table,space.standable))continue;
      for(const target of joyTableRing354(cells))if(!reserved.has(cellIndex(world,target.x,target.z)))out.push({activity,buildingId:table.id,target,phase:'travel',elapsed:0,shot354:0});
      continue;
    }
    for(const target of joyTableCardinal354(cells)){
      if(target.x<0||target.z<0||target.x>=world.width||target.z>=world.height)continue;
      const key=cellIndex(world,target.x,target.z);if(reserved.has(key))continue;
      const seat=space.seats.get(key);
      if(seat)out.push({activity,buildingId:table.id,seatId:seat.id,target,phase:'travel',elapsed:0});
      else if(!joyTableRequiresChair354(activity)&&!space.objects.has(key))out.push({activity,buildingId:table.id,target,phase:'travel',elapsed:0});
    }
  }
  return out;
}

/** Site check of a running or saved task. `table` is the building found by id. */
export function joyTableSiteValid354(world:World,task:OrdinaryRecreationTask,table:Structure|undefined,seat:Structure|undefined,objectAt:(cell:Cell)=>boolean,clearThrow:(pin:Cell,cell:Cell)=>boolean,isThrowCell:(pin:Cell,cell:Cell)=>boolean):boolean {
  const activity=task.activity;
  if(!isJoyTableActivity354(activity)||!isJoyTablesSchema354(world.schemaVersion)||!table||table.kind!==KIND_OF[activity]||deconstructionReserved(world,table.id))return false;
  if(activity==='hoopstone')return task.seatId===undefined&&isThrowCell(table,task.target)&&clearThrow(table,task.target);
  const cells=footprintCells(table);
  // JoyGiver_PlayBilliards checks every side at admission only; the driver
  // keeps playing while the table stands (EndOnDespawnedOrNull).
  if(activity==='billiards')return task.seatId===undefined&&inJoyTableRing354(cells,task.target);
  if(!joyTableCardinalCell354(cells,task.target))return false;
  if(task.seatId!==undefined)return !!seat&&seat.id===task.seatId&&isDiningSeat(seat.kind)&&seat.x===task.target.x&&seat.z===task.target.z&&!deconstructionReserved(world,seat.id);
  return !joyTableRequiresChair354(activity)&&!objectAt(task.target);
}

/** One active tick at the building (JoyUtility.JoyTickCheckEnd): JoyGainFactor
 * of the building with its quality, and the JobDef joySkill XP. */
export function joyTableActiveTick354(world:World,pawn:Pawn,task:OrdinaryRecreationTask):number {
  const activity=task.activity as JoyTableActivity354,f=JOY_TABLE_BY_ACTIVITY_354[activity];
  const table=world.structures.find(s=>s.id===task.buildingId);
  const skill=pawn.skills[f.skill]??={level:0,xp:0,dailyXp:0,passion:0};
  learnSkill(skill,joyTableXpPerTick354(activity),pawn);
  return joyTableGainFactor354(KIND_OF[activity] as Parameters<typeof joyTableGainFactor354>[0],table?.quality);
}

/** End of a 600-Core-tick billiards shot: Toils_Misc.FindRandomAdjacentReachableCell
 * draws a random cell 8-way adjacent to the table, then keeps it if it is
 * standable, reservable and reachable (the same cell may come again). Each
 * drawn cell is searched alone, as Core's CanReach, so a nearer cell never
 * hides a farther one. 'pending' waits for the shared navigation budget;
 * 'none' ends the game. */
export function nextBilliardsCell354(world:World,pawn:Pawn,task:OrdinaryRecreationTask,context:NeedContext,standable:(cell:Cell)=>boolean,reserved:ReadonlySet<number>,random:()=>number):'pending'|'none'|{target:Cell;path:Cell[]} {
  const table=world.structures.find(s=>s.id===task.buildingId&&s.kind==='billiards-table');
  if(!table)return 'none';
  const cells=joyTableRing354(footprintCells(table)).filter(c=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height&&standable(c)&&!reserved.has(cellIndex(world,c.x,c.z)));
  while(cells.length){
    const target=cells.splice(Math.floor(random()*cells.length),1)[0]!;
    if(target.x===pawn.x&&target.z===pawn.z)return {target,path:[]};
    const reach=context.search(new Set([cellIndex(world,target.x,target.z)]));
    if(!reach)return 'pending';
    const path=routeToCell(world,target,reach);
    if(path)return {target,path};
  }
  return 'none';
}
export const billiardsShotOver354=(task:OrdinaryRecreationTask):boolean=>task.activity==='billiards'&&(task.shot354??0)>=BILLIARDS_SHOT_TICKS_354;
/** JobDriver_PlayBilliards ends once joyDuration has passed since the game
 * began, walks between shots included (local ticks: 400 = 4000 Core ticks). */
export const billiardsGameOver354=(world:Pick<World,'tick'>,task:OrdinaryRecreationTask):boolean=>task.since354!==undefined&&world.tick+1-task.since354>=RECREATION_DURATION;
