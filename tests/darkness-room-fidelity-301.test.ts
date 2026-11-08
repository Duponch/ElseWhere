import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {humanMoveSpeedFactor297} from '../src/sim/human-move-speed-297.ts';
import {LightEnvironmentCache} from '../src/sim/light-environment.ts';
import {glowAppliesToMechanoids,glowIgnoredByBlindPawn} from '../src/sim/glow-rules-301.ts';
import {pawnBody} from '../src/sim/health-rules.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {WorkEnvironmentCache} from '../src/sim/work-environment.ts';
import {cookingSpot} from '../src/sim/cooking-bills.ts';
import {enclosedRoom} from './scenarios/cleanliness.ts';
import {TICKS_PER_DAY,type Pawn,type Structure,type World} from '../src/sim/types.ts';

// RimWorld 1.6.4871: StatPart_Glow of MoveSpeed/WorkSpeedGlobal is humanlike
// only and ignored for a pawn incapable of sight; the electric crematorium has
// no workTableRoomRole; RoomRoleWorker_Laboratory scores 60 per lab building.
function night(schema=301):World {
  const w=createWorld(301,16,16);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.resources=[];
  w.roofing={constructed:[],build:[],remove:[],cursor:0};delete w.climate;delete w.gameProfile;w.tick=0;w.schemaVersion=schema as World['schemaVersion'];
  return w;
}
function blind(p:Pawn):void {const health=createMedicalRecord(0);health.missing=[{part:'left-eye',bornAt:0},{part:'right-eye',bornAt:0}];p.health=health;}

test('a blind pawn moves at full speed in the dark from schema 301, as in RimWorld 1.6',()=>{
  const w=night(),pawn=w.pawns[0]!,dark=new LightEnvironmentCache().read(w).speedAt(pawn);
  expect(dark).toBe(.8);
  const sighted=humanMoveSpeedFactor297(w,pawn),moving=pawnBody(pawn).capacities.moving;
  blind(pawn);expect(pawnBody(pawn).capacities.sight).toBe(0);
  expect(glowIgnoredByBlindPawn(w,pawn)).toBe(true);
  // Fresh missing eyes hurt: pain lowers consciousness, hence Moving; only the darkness factor is dropped.
  const blindMoving=pawnBody(pawn).capacities.moving,unseeing=humanMoveSpeedFactor297(w,pawn);
  expect(unseeing/blindMoving).toBeCloseTo(sighted/moving/.8,12);
  // Historical schemas keep the darkness factor for every actor.
  const old=night(300),oldPawn=old.pawns[0]!;blind(oldPawn);
  expect(glowIgnoredByBlindPawn(old,oldPawn)).toBe(false);
  expect(humanMoveSpeedFactor297(old,oldPawn)).toBeCloseTo(.8*unseeing,12);
});

test('a sighted pawn keeps the darkness factor; mechanoids ignore it from schema 301',()=>{
  const w=night(),pawn=w.pawns[0]!;
  expect(glowIgnoredByBlindPawn(w,pawn)).toBe(false);
  expect(glowAppliesToMechanoids(w)).toBe(false);
  expect(glowAppliesToMechanoids(night(300))).toBe(true);
});

function building(w:World,kind:Structure['kind'],x:number,z:number):Structure {
  const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'steel',power:{on:true,parentId:null}};w.structures.push(s);return s;
}

test('the electric crematorium has no room role factor and does not make a workshop from schema 301',()=>{
  for(const schema of [301,300]){
    const w=night(schema);w.tick=TICKS_PER_DAY/2;enclosedRoom(w,{x:2,z:2},9);
    const crematorium=building(w,'electric-crematorium',5,5),worker=cookingSpot(crematorium);
    const env=new WorkEnvironmentCache().read(w),room=env.room(worker)!;
    expect(room.psychologicallyOutdoors).toBe(false);
    // Alone in a room: before 301 it made a workshop by itself.
    expect(room.role).toBe(schema>=301?'none':'workshop');
    expect(env.production(crematorium,worker).roomRole).toBe(1);
    // With a dining table making the room a dining room, only the old rule penalizes it.
    building(w,'table',4,7);building(w,'table',6,7);building(w,'table',8,7);
    const dining=new WorkEnvironmentCache().read(w);
    expect(dining.room(worker)!.role).toBe('dining');
    expect(dining.production(crematorium,worker).roomRole).toBe(schema>=301?1:.8);
  }
});

test('laboratory scores 60 per lab building, and the multi-analyzer does not count, from schema 301',()=>{
  for(const schema of [301,300]){
    const w=night(schema);w.tick=TICKS_PER_DAY/2;enclosedRoom(w,{x:1,z:1},13);
    const desk=building(w,'research-bench',3,3);building(w,'multi-analyzer',3,6);
    // Three workshop benches score 81: more than one bench at 60, less than 54 + 54.
    building(w,'machining-table',8,3);building(w,'stonecutter',8,6);building(w,'art-bench',8,9);
    const role=new WorkEnvironmentCache().read(w).room(cookingSpot(desk))!.role;
    expect(role).toBe(schema>=301?'workshop':'laboratory');
  }
});

test('a blind worker ignores the darkness factor of a work table from schema 301',()=>{
  const w=night(),pawn=w.pawns[0]!,bench=building(w,'stonecutter',8,8),env=new WorkEnvironmentCache().read(w);
  expect(env.production(bench,pawn).lighting).toBe(.8);
  expect(env.production(bench,pawn,true).lighting).toBe(1);
});
