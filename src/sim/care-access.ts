import {shipCasketPatientClaimed277} from './ship-casket-carry-277.ts';
import { canStandAt } from './furniture-travel.ts';
import { routeToCell,routeCost,workNeighbours,type Reachability } from './pathfinding.ts';
import { reservedServiceCells } from './service-reservations.ts';
import type { Cell,Pawn,World } from './types.ts';
import { footprintCells } from './definitions.ts';
import { isRoomDoor } from './door-rules.ts';
import { structureById } from './structure-navigation.ts';

const SIDE:readonly Cell[]=[{x:0,z:1},{x:1,z:0},{x:0,z:-1},{x:-1,z:0}];
const BED_KINDS=new Set(['sleeping-spot','bedroll','bed','hospital-bed','double-bed']);
/** Schema 336 (Core Building_Bed.FindPreferredInteractionCell, which
 * JobDriver_TendPatient uses for a patient in bed): the cells a doctor may
 * tend from, in Core order relative to the patient's sleeping slot. For a
 * two-cell bed: beside the head, beside the foot, beyond the head and its
 * corners, beyond the foot and its corners, then the bed cells; a single-cell
 * bed: the four sides, the four corners, then its cell. A cell must be
 * standable and touch the bed (a corner only when one of its two sides can be
 * walked through without a door, Core's corner touch). Bed cells are kept only
 * when nothing else remains, then doors likewise. Undefined when the patient
 * is not lying in a bed. Lateral order follows the slot order of the bed
 * (Core's west is the side away from the second sleeping slot). */
export function bedInteractionCells336(world:World,patient:Pawn):Cell[]|undefined {
  const need=patient.need;if(need?.kind!=='sleep'||need.bedId===null)return;
  const bed=structureById(world,need.bedId);if(!bed||!BED_KINDS.has(bed.kind))return;
  const footprint=footprintCells(bed),inBed=(c:Cell)=>footprint.some(f=>f.x===c.x&&f.z===c.z);
  const head=need.target;if(!inBed(head))return;
  const o=((bed.orientation??0)%4+4)%4,south=SIDE[o]!,east=SIDE[(o+1)%4]!,west={x:-east.x,z:-east.z},north={x:-south.x,z:-south.z};
  const at=(...v:Cell[])=>({x:head.x+v.reduce((n,d)=>n+d.x,0),z:head.z+v.reduce((n,d)=>n+d.z,0)});
  let candidates:Cell[];
  if(footprint.length===1)candidates=[at(west),at(east),at(south),at(north),at(south,west),at(south,east),at(north,west),at(north,east),at()];
  else{
    // Slot 0 has the west edge, the last slot the east edge.
    const right=!inBed(at(west)),left=!inBed(at(east));
    candidates=[...right?[at(west)]:[],...left?[at(east)]:[],...right?[at(west,south)]:[],...left?[at(east,south)]:[],
      at(north),at(north,west),at(north,east),at(south,south),at(south,south,west),at(south,south,east),at(south),at()];
  }
  const inside=(c:Cell)=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height;
  const door=(c:Cell)=>world.structures.some(s=>isRoomDoor(s.kind)&&s.x===c.x&&s.z===c.z);
  const bedCell=(c:Cell)=>world.structures.some(s=>BED_KINDS.has(s.kind)&&footprintCells(s).some(f=>f.x===c.x&&f.z===c.z));
  const walkable=(c:Cell)=>inside(c)&&(canStandAt(world,c)||bedCell(c))&&!door(c);
  const touches=(c:Cell)=>{
    if(inBed(c))return true;
    if(footprint.some(f=>Math.abs(f.x-c.x)+Math.abs(f.z-c.z)===1))return true;
    // A corner of the bed: one of the two cells beside it must be open.
    const corner=footprint.find(f=>Math.abs(f.x-c.x)===1&&Math.abs(f.z-c.z)===1);if(!corner)return false;
    return walkable({x:c.x,z:corner.z})||walkable({x:corner.x,z:c.z});
  };
  let cells=candidates.filter(c=>inside(c)&&canStandAt(world,c)&&touches(c));
  if(cells.some(c=>!bedCell(c)))cells=cells.filter(c=>!bedCell(c));
  if(cells.some(c=>!door(c)))cells=cells.filter(c=>!door(c));
  return cells;
}

export const lyingPatient=(p:Pawn):boolean=>p.state!=='dead'&&p.moveCooldown===0&&p.need?.kind==='sleep'&&p.need.phase==='sleep'&&p.need.bedId!==null;
export const patientClaimed=(world:World,patientId:number,except:Pawn):boolean=>shipCasketPatientClaimed277(world,{kind:'human',id:patientId},except.id)||world.pawns.some(p=>p!==except&&(p.tend?.patientId===patientId||p.feed?.patientId===patientId||p.ward?.patientId===patientId||p.surgery?.patientId===patientId||p.rescue?.patientId===patientId||p.cryptosleepTask?.action==='carry'&&p.cryptosleepTask.patientId===patientId||p.id===patientId&&p.cryptosleepTask?.action==='enter'));
/** One decision owns this search and reservation view; never retained across ticks. */
export function bedsideAccess(world:World,doctor:Pawn,patient:Pawn,reach:Reachability,additionalReserved?:ReadonlySet<number>,interaction336=false):{spot:Cell;path:Cell[];cost:number}|undefined {
  const reserved=reservedServiceCells(world,doctor.id);let best:{spot:Cell;path:Cell[];cost:number}|undefined;
  // Schema 336 tending: the first reachable free cell in Core's bed order
  // (Core goes to its first cell; a reserved or unreachable one is skipped).
  const cells=interaction336&&world.schemaVersion>=336?bedInteractionCells336(world,patient):undefined;
  if(cells){
    for(const spot of cells)if(!reserved.has(spot.z*world.width+spot.x)&&!additionalReserved?.has(spot.z*world.width+spot.x)){
      const path=routeToCell(world,spot,reach);if(path)return {spot,path,cost:routeCost(world,path,reach)};
    }
    return;
  }
  for(const spot of workNeighbours(patient))if(canStandAt(world,spot)&&!reserved.has(spot.z*world.width+spot.x)&&!additionalReserved?.has(spot.z*world.width+spot.x)){
    const path=routeToCell(world,spot,reach);if(path){const cost=routeCost(world,path,reach);if(!best||cost<best.cost)best={spot,path,cost};}
  }
  return best;
}
