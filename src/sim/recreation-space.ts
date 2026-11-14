import { isBedKind } from './bed-kinds.ts';
import {volcanicWinterActive310} from './volcanic-winter-state-310.ts';
import {readingTaskSiteValid295} from './reading-space-295.ts';
import {partyTaskSiteValid292} from './party-space-292.ts';
import {toxicFalloutActive294} from './toxic-fallout-state-294.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { canStandAt, captureStandability } from './furniture-travel.ts';
import { isRoofed, roofIndex } from './roof-rules.ts';
import { footprintCells, footprintContains } from './definitions.ts';
import { isDiningSeat, isDiningTable } from './dining.ts';
import { canSocialize } from './social.ts';
import { inBounds } from './pathfinding.ts';
import { isRoomDoor } from './door-rules.ts';
import { isTelevisionCell,televisionSameRoom,tvActive,TELEVISION_MAX_PARTICIPANTS } from './television-recreation.ts';
import { captureRoomQuality } from './room-quality.ts';
import type { RoomTopology } from './room-topology.ts';
import type { Cell, Pawn, Structure, World } from './types.ts';
import type { RecreationTask } from './recreation-rules.ts';

/** Decision-local index: never reused after another actor can change the world. */
export interface RecreationSpace {
  standable: (cell:Cell)=>boolean; solids: Set<number>; walls: Set<number>; objects: Set<number>; resources?: Set<number>;
  pins: Map<number, Structure>; games: Map<number, Structure>; seats: Map<number, Structure>;
  gathers: Map<number, Structure>; patients?: Map<number,Pawn>;
  televisions?:Map<number,Structure>; roomTopology:()=>RoomTopology;
}
export function recreationSpace(world: World, resourceTargets?: readonly Cell[], includePatients=false,readTopology?:()=>RoomTopology): RecreationSpace {
  let topology:RoomTopology|undefined;
  const index: RecreationSpace = {standable:captureStandability(world),solids:new Set(),walls:new Set(),objects:new Set(),pins:new Map(),games:new Map(),seats:new Map(),gathers:new Map(),roomTopology:()=>topology??=(readTopology?.()??captureRoomQuality(world).topology)};
  for(const s of world.structures) {
    if(s.kind==='horseshoes')index.pins.set(s.id,s);
    if(s.kind==='chess-table')index.games.set(s.id,s);
    if(world.schemaVersion>=190&&s.kind==='tube-television'){index.televisions??=new Map();index.televisions.set(s.id,s);}
    if(isGatherSpot(s)&&gatherActive(s))index.gathers.set(s.id,s);
    if(isDiningSeat(s.kind))index.seats.set(s.z*world.width+s.x,s);
    for(const c of footprintCells(s))index.objects.add(c.z*world.width+c.x);
  }
  for(const job of world.jobs)index.objects.add(job.z*world.width+job.x);
  for(const s of [...world.structures,...world.jobs]) {
    if(!('status' in s)&&((s.kind==='wall'||s.kind==='cooler')||isRoomDoor(s.kind)&&!s.door!.open))index.walls.add(s.z*world.width+s.x);
    // Recreation also retains its historical rejection of wall/table plans.
    // Every ordinary stopping rule comes from the shared standability capture.
    if(s.kind==='wall'||s.kind==='table')for(const c of footprintCells(s))index.solids.add(c.z*world.width+c.x);
  }
  if(resourceTargets)captureRecreationResources(world,index,resourceTargets);
  if(includePatients){index.patients=new Map();for(const p of world.pawns)if(visitablePatient(world,p,false))index.patients.set(p.id,p);}
  return index;
}

/** Sky targets may be tried after another family in the same decision. Extend
 * that one index once, retaining only the at-most-24 relevant resource cells. */
export function captureRecreationResources(world:World,index:RecreationSpace,targets:readonly Cell[]):void {
  const wanted=new Set(targets.map(c=>c.z*world.width+c.x));index.resources=new Set();
  for(const r of world.resources){const cell=r.z*world.width+r.x;if(wanted.has(cell))index.resources.add(cell);}
}

export function horseshoeCells(pin: Cell): Cell[] {
  const cells: Cell[] = [];
  for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) for (const offset of [-1,0,1])
    cells.push({x: pin.x + dx! * 5 + dz! * offset, z: pin.z + dz! * 5 + dx! * offset});
  return cells;
}
export const isHorseshoeCell = (pin: Cell, cell: Cell): boolean => {
  const dx = Math.abs(pin.x-cell.x), dz = Math.abs(pin.z-cell.z);
  return dx === 5 && dz <= 1 || dz === 5 && dx <= 1;
};
export const chessCells = (table: Cell): Cell[] => [
  {x:table.x-1,z:table.z},{x:table.x+1,z:table.z},
  {x:table.x,z:table.z-1},{x:table.x,z:table.z+1},
];
export const isChessCell = (table: Cell, cell: Cell): boolean => Math.abs(table.x-cell.x)+Math.abs(table.z-cell.z)===1;
export const isGatherSpot = (s:Structure):boolean => isDiningTable(s.kind)||s.kind==='campfire';
export const gatherActive = (s:Structure):boolean => s.gatherSpot!==false&&(s.kind!=='campfire'||!!s.fuel?.ticks&&s.power?.switchOn!==false);
export const adjacentToTable = (table:Structure,cell:Cell):boolean => footprintCells(table).some(part=>Math.abs(part.x-cell.x)+Math.abs(part.z-cell.z)===1);
export const visitablePatient = (world:World,p:Pawn,requireLowJoy=true):boolean => {
  const need=p.need,anyBed=world.schemaVersion>=325;
  return need?.kind==='sleep'&&!!need.medical&&need.phase==='sleep'&&need.bedId!==null
    &&p.x===need.target.x&&p.z===need.target.z&&world.structures.some(s=>s.id===need.bedId&&isBedKind(s.kind)&&(anyBed||s.medical===true)&&s.x===p.x&&s.z===p.z)
    &&p.state==='resting'&&(!requireLowJoy||(world.schemaVersion>=319?p.recreation.level<30:p.recreation.level<=35))&&p.hunger>0&&p.rest>=33&&canSocialize(world,p,false)
    &&!(anyBed&&aboutToRecover325(p));
};
/** Core SickPawnVisitUtility.AboutToRecover (schema 325), for a patient
 * resting awake in bed: no disease still fought and less than 8 HP of
 * healing injuries (scars excluded) means nobody comes to visit. */
export const aboutToRecover325=(p:Pawn):boolean=>{
  const h=p.health;if(!h)return true;
  if(h.infections?.cases.length||h.flu||h.immuneDiseases&&Object.values(h.immuneDiseases).some(Boolean))return false;
  let severity=0;for(const injury of h.injuries)if(injury.scar===undefined)severity+=injury.severity;
  return severity<8000;
};
/** Core SickPawnVisitUtility.VisitChanceScore (schema 325): opinion from
 * 0.05 at -100 to 2 at +100, times 1 near to 0.2 at 150 cells and beyond. */
export const visitChanceScore325=(opinion:number,distance:number):number=>(.05+1.95*(opinion+100)/200)*Math.max(.2,Math.min(1,1-.8*distance/150));
export const visitPatient = (world:World,id:number,requireLowJoy=true):Pawn|undefined => world.pawns.find(p=>p.id===id&&visitablePatient(world,p,requireLowJoy));
export const nearVisitPatient = (patient:Pawn,cell:Cell):boolean => (patient.x-cell.x)**2+(patient.z-cell.z)**2<=5&&!(patient.x===cell.x&&patient.z===cell.z);

/** Tiny straight throwing segment; furniture passability and sight differ.
 * Walls and natural rock hide the pin; a table across the ray does not. */
export function clearThrow(world: World, pin: Cell, cell: Cell, space?: RecreationSpace): boolean {
  const walls = space ? [] : world.structures.filter(s => (s.kind === 'wall'||s.kind==='cooler')||isRoomDoor(s.kind)&&!s.door!.open);
  const steps = Math.max(Math.abs(cell.x-pin.x), Math.abs(cell.z-pin.z));
  for (let i=1; i<=steps; i++) {
    const x=Math.round(pin.x+(cell.x-pin.x)*i/steps), z=Math.round(pin.z+(cell.z-pin.z)*i/steps);
    if (!inBounds(world,x,z) || world.tiles[z*world.width+x]!.terrain === 'rock' || (space ? space.walls.has(z*world.width+x) : walls.some(w => w.x===x && w.z===z))) return false;
  }
  return true;
}
export function standableRecreationCell(world: World, cell: Cell, space?: RecreationSpace): boolean {
  return (world.schemaVersion<22||(space?space.standable(cell):canStandAt(world,cell)))&&inBounds(world,cell.x,cell.z) && !['rock','water'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain)
    && !(space ? space.solids.has(cell.z*world.width+cell.x) : world.structures.some(s=>['wall','table'].includes(s.kind)&&footprintContains(s,cell))||world.jobs.some(s=>['wall','table'].includes(s.kind)&&footprintContains(s,cell)));
}
export function recreationSiteValid(world: World, task: RecreationTask, space?: RecreationSpace,readTopology?:()=>RoomTopology): boolean {
  if(task.activity==='read')return readingTaskSiteValid295(world,task);
  if((toxicFalloutActive294(world)||volcanicWinterActive310(world))&&!isRoofed(world,roofIndex(world,task.target)))return false;
  if(task.activity==='party')return partyTaskSiteValid292(world,task,space?.roomTopology()??readTopology?.(),space?.standable);
  if(task.activity==='skygaze'&&isRoofed(world,roofIndex(world,task.target)))return false;
  if (!standableRecreationCell(world,task.target,space)) return false;
  if(task.activity==='watch-television') {
    const tv=space?space.televisions?.get(task.buildingId!):world.structures.find(s=>s.id===task.buildingId&&s.kind==='tube-television');
    const seat=space?space.seats.get(task.target.z*world.width+task.target.x):world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
    return world.schemaVersion>=190&&!!tv&&tvActive(tv)&&!!seat&&seat.id===task.seatId&&seat.x===task.target.x&&seat.z===task.target.z
      &&isTelevisionCell(tv,seat)&&!deconstructionReserved(world,tv.id)&&!deconstructionReserved(world,seat.id)
      &&clearThrow(world,tv,seat,space)&&televisionSameRoom(world,tv,seat,space?.roomTopology??readTopology);
  }
  if(task.activity==='chess') {
    const table=space?space.games.get(task.buildingId!):world.structures.find(s=>s.id===task.buildingId&&s.kind==='chess-table');
    const seat=space?space.seats.get(task.target.z*world.width+task.target.x):world.structures.find(s=>s.id===task.seatId&&(s.kind==='stool'||s.kind==='dining-chair'||s.kind==='armchair'));
    return !!table&&!!seat&&seat.id===task.seatId&&seat.x===task.target.x&&seat.z===task.target.z&&isChessCell(table,seat)
      &&!deconstructionReserved(world,table.id)&&!deconstructionReserved(world,seat.id);
  }
  if(task.activity==='social-relax') {
    const spot=space?space.gathers.get(task.buildingId!):world.structures.find(s=>s.id===task.buildingId&&isGatherSpot(s)&&gatherActive(s));
    if(!spot||!isGatherSpot(spot)||!gatherActive(spot)||deconstructionReserved(world,spot.id))return false;
    const seat=task.seatId===undefined?undefined:space?space.seats.get(task.target.z*world.width+task.target.x):world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
    if(spot.kind!=='campfire')return !!seat&&seat.id===task.seatId&&seat.x===task.target.x&&seat.z===task.target.z&&adjacentToTable(spot,task.target)&&!deconstructionReserved(world,seat.id);
    if((spot.x-task.target.x)**2+(spot.z-task.target.z)**2>15||!clearThrow(world,spot,task.target,space))return false;
    return seat?seat.id===task.seatId&&seat.x===task.target.x&&seat.z===task.target.z&&!deconstructionReserved(world,seat.id)
      :task.seatId===undefined&&!(space?space.objects.has(task.target.z*world.width+task.target.x):world.structures.some(s=>footprintContains(s,task.target))||world.jobs.some(j=>footprintContains(j,task.target)));
  }
  if(task.activity==='visit-sick') {
    const patient=space?.patients?space.patients.get(task.patientId!):visitPatient(world,task.patientId!,false);
    if(!patient||!nearVisitPatient(patient,task.target)||!clearThrow(world,patient,task.target,space))return false;
    const seat=task.seatId===undefined?undefined:space?space.seats.get(task.target.z*world.width+task.target.x):world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
    return seat?seat.id===task.seatId&&seat.x===task.target.x&&seat.z===task.target.z&&!deconstructionReserved(world,seat.id)
      :task.seatId===undefined&&!(space?space.objects.has(task.target.z*world.width+task.target.x):world.structures.some(s=>footprintContains(s,task.target))||world.jobs.some(j=>footprintContains(j,task.target)));
  }
  if(task.activity==='skygaze'&&space?.resources)return !space.objects.has(task.target.z*world.width+task.target.x)&&!space.resources.has(task.target.z*world.width+task.target.x);
  if (task.activity === 'skygaze') return !world.structures.some(s=>footprintContains(s,task.target))
    && !world.jobs.some(s=>s.x===task.target.x&&s.z===task.target.z)
    && !world.resources.some(r=>r.x===task.target.x&&r.z===task.target.z);
  const pin=space ? space.pins.get(task.buildingId!) : world.structures.find(s=>s.id===task.buildingId&&s.kind==='horseshoes');
  return !!pin && isHorseshoeCell(pin,task.target) && clearThrow(world,pin,task.target,space);
}
export function availablePins(world: World, pawnId: number): Structure[] {
  const users=new Map<number,number>();
  for(const p of world.pawns)if(p.id!==pawnId&&p.recreation?.task?.buildingId!=null) {
    const id=p.recreation.task.buildingId;users.set(id,(users.get(id)??0)+1);
  }
  return world.structures.filter(s=>s.kind==='horseshoes'&&!deconstructionReserved(world,s.id,pawnId)&&(users.get(s.id)??0)<3);
}
export function availableChessTables(world:World,pawnId:number):Structure[] {
  const users=new Map<number,number>();
  for(const p of world.pawns)if(p.id!==pawnId&&p.recreation?.task?.activity==='chess') {
    const id=p.recreation.task.buildingId!;users.set(id,(users.get(id)??0)+1);
  }
  return world.structures.filter(s=>s.kind==='chess-table'&&!deconstructionReserved(world,s.id,pawnId)&&(users.get(s.id)??0)<2);
}
export function availableTelevisions(world:World,pawnId:number):Structure[] {
  if(world.schemaVersion<190)return [];
  const users=new Map<number,number>();
  for(const p of world.pawns)if(p.id!==pawnId&&p.recreation?.task?.activity==='watch-television') {
    const id=p.recreation.task.buildingId!;users.set(id,(users.get(id)??0)+1);
  }
  return world.structures.filter(s=>tvActive(s)&&!deconstructionReserved(world,s.id,pawnId)&&(users.get(s.id)??0)<TELEVISION_MAX_PARTICIPANTS);
}
