import { expect,test,vi } from 'vitest';
import { generateWorld } from '../src/sim/generation.ts';
import { newDoorState } from '../src/sim/door-rules.ts';
import { readyDoorEntry } from '../src/sim/doors.ts';
import { addMaterial } from '../src/sim/materials.ts';
import { blockedCells,reachableCells } from '../src/sim/pathfinding.ts';
import { createPrisonerState } from '../src/sim/prisoner-state.ts';
import { capturePrisonTopology,prisonBedValid,prisonDoorPassable,prisonerAllowedCell,prisonerEscapeRoute,prisonRoom } from '../src/sim/prison-space.ts';
import { RoomTopologyCache } from '../src/sim/room-topology.ts';
import type { Structure } from '../src/sim/types.ts';
import { markTerrainCellChanged } from '../src/sim/terrain-mutation-journal';

function prison(){
  const w=generateWorld(42,32,32);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.jobs=[];w.resources=[];w.piles=[];w.packed=[];w.stockpiles=[];delete w.wildlife;
  w.tick=100;w.roofing={constructed:[],build:[],remove:[],cursor:0};w.pawns=w.pawns.slice(0,1);
  const pawn=w.pawns[0]!;Object.assign(pawn,{x:10,z:11,faction:'outlaws',path:[],motion:null,jobId:null,need:null,bedId:null});pawn.prisoner=createPrisonerState(w,pawn);
  for(let z=8;z<=14;z++)for(let x=8;x<=14;x++)if(x===8||z===8||x===14||z===14)w.structures.push({id:w.nextId++,kind:x===14&&z===11?'door':'wall',x,z,orientation:0,footprint:'standard',material:'wood',...(x===14&&z===11?{door:newDoorState(w.tick)}:{})});
  const bed:Structure={id:w.nextId++,kind:'bed',x:10,z:10,orientation:0,footprint:'standard',material:'wood',prisoner:true};w.structures.push(bed);
  const door=w.structures.find(s=>s.kind==='door')!;
  return {w,pawn,bed,door};
}
test('prison room is enclosed, has a marked bed and needs no roof; role and in-place breaches update immediately',()=>{
  const {w,pawn,bed,door}=prison();
  const room=prisonRoom(w,pawn);expect(room).toMatchObject({kind:'space',cellCount:25,touchesMapEdge:false});expect(w.roofing!.constructed).toEqual([]);expect(prisonBedValid(w,bed)).toBe(true);
  expect(prisonRoom(w,door)).toBeUndefined();expect(prisonRoom(w,{x:0,z:0})).toBeUndefined();expect(prisonRoom(w,{x:8,z:8})).toBeUndefined();
  delete bed.prisoner;expect(prisonRoom(w,pawn)).toBeUndefined();expect(prisonBedValid(w,bed)).toBe(false);bed.prisoner=true;
  expect(prisonRoom(w,pawn)).toEqual(room);bed.medical=true;expect(prisonBedValid(w,bed)).toBe(true);
  Object.assign(bed,{x:13,z:13,orientation:1});expect(prisonBedValid(w,bed)).toBe(false);Object.assign(bed,{x:10,z:10,orientation:0});
  const i=w.structures.findIndex(s=>s.kind==='wall'&&s.x===8&&s.z===11),wall=w.structures.splice(i,1)[0]!;
  expect(prisonRoom(w,pawn)).toBeUndefined();expect(prisonBedValid(w,bed)).toBe(false);w.structures.push(wall);expect(prisonBedValid(w,bed)).toBe(true);
  // Rock is a real barrier too; a terrain edit (a replaced, marked Tile, as
  // every physical writer does) must invalidate the room.
  w.structures.splice(w.structures.indexOf(wall),1);w.tiles[11*w.width+8]={terrain:'rock'};markTerrainCellChanged(w.tiles,11*w.width+8);expect(prisonBedValid(w,bed)).toBe(true);
  w.tiles[11*w.width+8]={terrain:'grass'};markTerrainCellChanged(w.tiles,11*w.width+8);expect(prisonBedValid(w,bed)).toBe(false);
});

test('escape requires an opening, preserves budget waits and uses a real weighted path through held or obstructed doors',()=>{
  const {w,pawn,door}=prison();let searches=0;
  const search=(goals:ReadonlySet<number>)=>{searches++;return reachableCells(w,pawn,blockedCells(w),new Set(),goals);};
  expect(prisonerEscapeRoute(w,pawn,search)).toBeUndefined();expect(prisonerEscapeRoute(w,pawn,search)).toBeUndefined();expect(searches).toBe(0);
  Object.assign(door.door!,{open:true,holdOpen:true,from:0,changedAt:w.tick});expect(prisonDoorPassable(w,door)).toBe(false);expect(prisonerEscapeRoute(w,pawn,search)).toBeUndefined();
  w.tick+=20;expect(prisonDoorPassable(w,door)).toBe(true);let waits=0;expect(prisonerEscapeRoute(w,pawn,()=>{waits++;return null;})).toBeNull();expect(waits).toBe(1);
  const path=prisonerEscapeRoute(w,pawn,search)!;expect(path).toBeDefined();expect(path.some(c=>c.x===door.x&&c.z===door.z)).toBe(true);
  const edge=path.at(-1)!;expect(edge.x===0||edge.z===0||edge.x===31||edge.z===31).toBe(true);expect(searches).toBe(1);
  const diagonal=path.some((c,i)=>{const previous=i?path[i-1]!:pawn;return c.x!==previous.x&&c.z!==previous.z&&(c.x===door.x&&previous.z===door.z||previous.x===door.x&&c.z===door.z);});expect(diagonal).toBe(false);
  door.door!.holdOpen=false;expect(prisonDoorPassable(w,door)).toBe(false);expect(readyDoorEntry(w,pawn,door)).toBe(false);expect(prisonerEscapeRoute(w,pawn,search)).toBeUndefined();expect(searches).toBe(1);
  addMaterial(w,'wood',1,{type:'ground',x:door.x,z:door.z});expect(prisonDoorPassable(w,door)).toBe(true);expect(prisonerEscapeRoute(w,pawn,search)).toEqual(path);
  w.piles=[];const prior={x:pawn.x,z:pawn.z};Object.assign(pawn,{x:door.x,z:door.z});expect(prisonDoorPassable(w,door)).toBe(true);Object.assign(pawn,prior);expect(prisonDoorPassable(w,door)).toBe(false);
  // A preserved edge endpoint blocks closing until the body has cleared it.
  pawn.motion={from:{x:door.x,z:door.z},to:{x:pawn.x,z:pawn.z},start:w.tick-1,end:w.tick+1};expect(prisonDoorPassable(w,door)).toBe(true);w.tick++;expect(prisonDoorPassable(w,door)).toBe(false);pawn.motion=null;
  w.structures.splice(w.structures.indexOf(door),1);expect(prisonerEscapeRoute(w,pawn,search)?.length).toBeGreaterThan(0);
  Object.assign(pawn,{x:31,z:11});const before=searches;expect(prisonerEscapeRoute(w,pawn,search)).toEqual([]);expect(searches).toBe(before);
});

test('captives move within their room and only an escape intention allows other rooms; door chains and water remain physical',()=>{
  const {w,pawn,door}=prison();
  expect(prisonerAllowedCell(w,pawn,{x:12,z:12})).toBe(true);expect(prisonerAllowedCell(w,pawn,{x:15,z:11})).toBe(false);expect(prisonerAllowedCell(w,pawn,{x:10,z:10})).toBe(true);
  pawn.prisoner!.escape={x:31,z:11};expect(prisonerAllowedCell(w,pawn,{x:15,z:11})).toBe(true);expect(prisonerAllowedCell(w,pawn,door)).toBe(false);expect(prisonerAllowedCell(w,pawn,{x:-1,z:11})).toBe(false);
  Object.assign(door.door!,{open:true,holdOpen:true,from:1});expect(prisonerAllowedCell(w,pawn,door)).toBe(true);
  const second:Structure={...door,id:w.nextId++,x:15,door:{...door.door!}};w.structures.push(second);
  const search=(goals:ReadonlySet<number>)=>reachableCells(w,pawn,blockedCells(w),new Set(),goals);
  const path=prisonerEscapeRoute(w,pawn,search)!;expect(path.some(c=>c.x===14&&c.z===11)).toBe(true);expect(path.some(c=>c.x===15&&c.z===11)).toBe(true);
  // Topological air spaces include water; the route must still reject a moat.
  for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++)if(x===0||z===0||x===31||z===31)w.tiles[z*w.width+x]={terrain:'water'};
  expect(prisonerEscapeRoute(w,pawn,search)).toBeUndefined();expect(prisonerAllowedCell(w,pawn,{x:31,z:11})).toBe(false);
  delete pawn.prisoner!.escape;expect(prisonerAllowedCell(w,pawn,{x:15,z:11})).toBe(false);delete pawn.prisoner;expect(prisonerAllowedCell(w,pawn,{x:15,z:11})).toBe(true);
});

test('ordinary friendly door passage is not FreePassage, while held doors and genuine obstructions remain escape routes',()=>{
  const {w,pawn,door}=prison();Object.assign(door.door!,{open:true,from:1,changedAt:w.tick,closeAt:w.tick+11,lastTouch:w.tick});
  const guard=structuredClone(pawn);guard.id=w.nextId++;guard.faction='colony';delete guard.prisoner;Object.assign(guard,{x:door.x,z:door.z,state:'idle',motion:null,path:[]});w.pawns.push(guard);
  const search=(goals:ReadonlySet<number>)=>reachableCells(w,pawn,blockedCells(w),new Set(),goals);
  // Core WillCloseSoon excludes an upright authorized pawn standing in the
  // door, even though that pawn is also a momentary physical obstruction.
  expect(prisonDoorPassable(w,door)).toBe(false);expect(readyDoorEntry(w,pawn,door)).toBe(false);expect(prisonerEscapeRoute(w,pawn,search)).toBeUndefined();
  addMaterial(w,'wood',1,{type:'ground',x:door.x,z:door.z});expect(prisonDoorPassable(w,door)).toBe(false);
  door.door!.holdOpen=true;expect(prisonDoorPassable(w,door)).toBe(true);expect(prisonerEscapeRoute(w,pawn,search)?.length).toBeGreaterThan(0);door.door!.holdOpen=false;
  guard.state='downed';expect(prisonDoorPassable(w,door)).toBe(true);guard.state='dead';expect(prisonDoorPassable(w,door)).toBe(true);
  w.piles=[];expect(prisonDoorPassable(w,door)).toBe(true);guard.state='idle';expect(prisonDoorPassable(w,door)).toBe(false);
  // The shared movement representation captures both ends of a body crossing
  // the doorway; an outgoing friendly edge must not trigger an escape either.
  Object.assign(guard,{x:door.x+1,z:door.z,state:'moving',motion:{from:{x:door.x,z:door.z},to:{x:door.x+1,z:door.z},start:w.tick-1,end:w.tick+2},path:[]});expect(prisonDoorPassable(w,door)).toBe(false);
  addMaterial(w,'wood',1,{type:'ground',x:door.x,z:door.z});w.tick+=2;guard.motion=null;guard.state='idle';expect(prisonDoorPassable(w,door)).toBe(true);
  // Only a real cardinal approach whose next cell is the door counts. A
  // neighboring idle colon or a path to another cell leaves the obstruction.
  guard.state='moving';guard.path=[{x:door.x,z:door.z}];expect(prisonDoorPassable(w,door)).toBe(false);
  guard.path=[{x:guard.x+1,z:guard.z}];expect(prisonDoorPassable(w,door)).toBe(true);guard.path=[{x:door.x,z:door.z}];guard.z++;expect(prisonDoorPassable(w,door)).toBe(true);guard.z--;
  guard.state='downed';expect(prisonDoorPassable(w,door)).toBe(true);guard.state='moving';door.door!.forbidden=true;expect(prisonDoorPassable(w,door)).toBe(true);door.door!.forbidden=false;
  guard.faction='outlaws';expect(prisonDoorPassable(w,door)).toBe(true);w.pawns.pop();expect(prisonDoorPassable(w,door)).toBe(true);
  w.piles=[];expect(prisonDoorPassable(w,door)).toBe(false);
});

test('a synchronous prison query batch shares one capture, while later default queries revalidate same-tick barrier mutations',()=>{
  const {w,pawn,bed,door}=prison(),cells=[pawn,bed,door,{x:8,z:8},{x:12,z:12},{x:15,z:11},{x:0,z:0}];
  const expected=cells.map(c=>({room:prisonRoom(w,c),allowed:prisonerAllowedCell(w,pawn,c)}));
  const read=vi.spyOn(RoomTopologyCache.prototype,'read');
  try{
    const captured=capturePrisonTopology(w),room=captured.at(pawn.x,pawn.z);expect(read).toHaveBeenCalledTimes(1);
    expect(cells.map(c=>({room:prisonRoom(w,c,captured),allowed:prisonerAllowedCell(w,pawn,c,captured)}))).toEqual(expected);
    expect(prisonBedValid(w,bed,captured)).toBe(true);expect(prisonerEscapeRoute(w,pawn,()=>{throw Error('Closed prison must not request a route');},captured)).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(1);
    // A new decision reads the real barriers even when tick and array identity
    // did not change. Previously returned enclosure snapshots stay immutable.
    const wall=w.structures.find(s=>s.kind==='wall'&&s.x===8&&s.z===11)!;w.structures.splice(w.structures.indexOf(wall),1);
    expect(prisonRoom(w,pawn)).toBeUndefined();expect(read).toHaveBeenCalledTimes(2);expect(captured.at(pawn.x,pawn.z)).toBe(room);
    expect(prisonBedValid(w,bed)).toBe(false);expect(prisonerAllowedCell(w,pawn,{x:15,z:11})).toBe(true);
    w.tiles[11*w.width+8]={...w.tiles[11*w.width+8]!,terrain:'rock'};markTerrainCellChanged(w.tiles,11*w.width+8);expect(prisonBedValid(w,bed)).toBe(true);expect(prisonerAllowedCell(w,pawn,{x:15,z:11})).toBe(false);
  }finally{read.mockRestore();}
});
