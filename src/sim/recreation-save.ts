import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validPartyTask292} from './party-save-292.ts';
import {validReadingPawnFields295,validReadingTask295} from './book-save-295.ts';
import {validReadingWorld295} from './book-transport-295.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import { initialRecreation, RECREATION_DURATION, RECREATION_KINDS, VISIT_SICK_DURATION } from './recreation-rules.ts';
import { adjacentToTable, isChessCell, isGatherSpot, isHorseshoeCell } from './recreation-space.ts';
import { isDiningSeat,seatAt } from './dining.ts';
import { footprintCells } from './definitions.ts';
import { inJoyTableRing354,isJoyTableActivity354,JOY_TABLE_ACTIVITIES_354,JOY_TABLE_BY_ACTIVITY_354,joyTableCardinalCell354,joyTableRequiresChair354 } from './joy-tables-354.ts';
import { validTelevisionTasks } from './television-save.ts';
import { isViewArtSchema366 } from './view-art-366.ts';
import { isSculptureKind } from './furniture-stats.ts';
import type { World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const meter=(v:unknown):boolean=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
export function initializeRecreation(world: World): void {
  Object.assign(world,{schemaVersion:15});
  // No invented past boredom, no RNG draws and no interruption at load time.
  for(const pawn of world.pawns){
    pawn.recreation=initialRecreation();
    delete (pawn.recreation.tolerance as Partial<typeof pawn.recreation.tolerance>).cerebral;
    delete (pawn.recreation.bored as Partial<typeof pawn.recreation.bored>).cerebral;
    delete (pawn.recreation.tolerance as Partial<typeof pawn.recreation.tolerance>).social;
    delete (pawn.recreation.bored as Partial<typeof pawn.recreation.bored>).social;
    delete (pawn.recreation.tolerance as Partial<typeof pawn.recreation.tolerance>).television;
    delete (pawn.recreation.bored as Partial<typeof pawn.recreation.bored>).television;
  }
}
function recreationNeedErrors(joy:unknown,version:number):string[] {
  const base=version>=190?RECREATION_KINDS:version>=124?RECREATION_KINDS.slice(0,4):version>=122?RECREATION_KINDS.slice(0,3):RECREATION_KINDS.slice(0,2);
  const chemical=isSchema265OrLater(version)&&record(joy)&&record(joy.tolerance)&&Object.hasOwn(joy.tolerance,'chemical');
  const reading=(version===295||(version===296||isCorePhysicalSchema297(version)))&&record(joy)&&record(joy.tolerance)&&Object.hasOwn(joy.tolerance,'reading');
  const kinds:readonly string[]=[...base,...chemical?['chemical']:[],...reading?['reading']:[]];
  if(!validReadingPawnFields295({recreation:joy},version))return ['Invalid or future reading need.'];
  if(!record(joy)||!meter(joy.level)||!record(joy.tolerance)||!record(joy.bored)
    ||Object.keys(joy.tolerance).length!==kinds.length||Object.keys(joy.bored).length!==kinds.length
    ||kinds.some(k=>!meter((joy.tolerance as Record<string,unknown>)[k])||typeof (joy.bored as Record<string,unknown>)[k]!=='boolean'))return ['Invalid recreation need.'];
  const errors:string[]=[];
  for(const kind of kinds){const value=joy.tolerance[kind] as number,bored=joy.bored[kind];if(value>50&&!bored||value<30&&bored)errors.push('Inconsistent recreation boredom.');}
  return errors;
}
/** Passive original owner: no spatial recreation task can be carried off-map.
 * Numeric need rules are the same ones used by the local site validator. */
export function validateRecreationRecordShape(pawn:Record<string,unknown>,version:number,clock:number):string[] {
  if(!validReadingPawnFields295(pawn,version))return ['Invalid or future reading policy or need.'];
  if(!Number.isSafeInteger(clock)||clock<0)return ['Invalid recreation clock.'];
  if(version<15)return [];
  const errors=recreationNeedErrors(pawn.recreation,version);
  if(record(pawn.recreation)&&(pawn.recreation.task!==null||pawn.state==='recreating'))errors.push('Off-map recreation cannot own a spatial activity.');
  return errors;
}
/** Called after basic pawn/coordinates validation; dynamic site availability is
 * rechecked before the next action, so an obstructed route is not a corrupt save. */
export function validateRecreation(world: World, version: number): string[] {
  if(version<15)return [];
  const errors:string[]=[], users=new Map<number,number>(), claimedChessSeats=new Set<number>(),claimedServiceCells=new Set<number>(),claimedPatients=new Set<number>();
  for(const pawn of world.pawns) {
    const joy:unknown=pawn.recreation;
    const needErrors=recreationNeedErrors(joy,version);errors.push(...needErrors);
    if(!record(joy)||needErrors.includes('Invalid recreation need.'))continue;
    const task=joy.task;
    if(task===null){if(pawn.state==='recreating')errors.push('Recreation state has no activity.');continue;}
    if(record(task)&&task.activity==='read'){
      if(!validReadingTask295(task,version)){errors.push('Invalid or future reading activity.');continue;}
      // Deferred place/return decisions have no reserved service place.
      if(task.stage==='read'||task.stage==='seat'&&task.phase==='travel'){
        const cell=Number((task.target as {x:number;z:number}).z)*world.width+Number((task.target as {x:number;z:number}).x);
        if(claimedServiceCells.has(cell))errors.push('Duplicate recreation service place.');
        claimedServiceCells.add(cell);
      }
      continue;
    }
    if(!record(task)||Object.keys(task).some(k=>!['activity','target','buildingId','seatId','patientId','phase','elapsed','partyStartedAtCore',...(version>=354&&task.activity==='billiards'?['shot354','since354']:[])].includes(k))
      ||!['skygaze','horseshoes',...(version>=122?['chess']:[]),...(version>=124?['social-relax','visit-sick']:[]),...(version>=190?['watch-television']:[]),...(version>=354?JOY_TABLE_ACTIVITIES_354:[]),...(isViewArtSchema366(version)?['view-art']:[]),...((version===292||(version===293||version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))?['party']:[])].includes(task.activity as string)||!['travel','active'].includes(task.phase as string)
      ||!Number.isInteger(task.elapsed)||(task.elapsed as number)<0||(task.elapsed as number)>=(task.activity==='party'?1502:task.activity==='visit-sick'?VISIT_SICK_DURATION:RECREATION_DURATION)
      ||!record(task.target)||!Number.isInteger(task.target.x)||!Number.isInteger(task.target.z)
      ||(task.target.x as number)<0||(task.target.z as number)<0||(task.target.x as number)>=world.width||(task.target.z as number)>=world.height) {errors.push('Invalid recreation activity.');continue;}
    if(!validPartyTask292(task,version,world.tick,world.width,world.height))errors.push('Invalid or future Party token.');
    if(pawn.jobId!==null||pawn.haul||pawn.cooking||pawn.need)errors.push('Recreation conflicts with another task.');
    if(task.seatId!==undefined&&(version<122||!['chess','social-relax','visit-sick',...(version>=190?['watch-television']:[]),...(version>=354?['game-of-ur','poker']:[])].includes(task.activity as string)||!Number.isSafeInteger(task.seatId)||Number(task.seatId)<1))errors.push('Invalid recreation seat.');
    if(task.patientId!==undefined&&(version<124||task.activity!=='visit-sick'||!Number.isSafeInteger(task.patientId)||Number(task.patientId)<1))errors.push('Invalid recreation patient.');
    // Schema 354: a billiards player walking to the next shot keeps the game clock.
    const billiardsWalk=version>=354&&task.activity==='billiards'&&task.phase==='travel'&&task.since354!==undefined;
    if(version>=354&&task.activity==='billiards'&&(!Number.isInteger(task.shot354)||Number(task.shot354)<0||Number(task.shot354)>=RECREATION_DURATION||task.phase==='travel'&&task.shot354!==0
      ||(task.phase==='active'||Number(task.elapsed)>0)!==(task.since354!==undefined)||task.since354!==undefined&&(!Number.isSafeInteger(task.since354)||Number(task.since354)<0||Number(task.since354)>world.tick)))errors.push('Invalid billiards shot.');
    if(task.phase==='travel'?(pawn.state!=='moving'||task.elapsed!==0&&!billiardsWalk):(pawn.state!=='recreating'||pawn.path.length>0||pawn.moveCooldown>0||pawn.x!==task.target.x||pawn.z!==task.target.z))errors.push('Invalid recreation phase or position.');
    if(task.activity==='party'){if(task.buildingId!==null||task.seatId!==undefined||task.patientId!==undefined)errors.push('Party cannot claim furniture or patient.');}
    else if(task.activity==='skygaze') {if(task.buildingId!==null||task.seatId!==undefined)errors.push('Skygazing cannot claim a building.');}
    else if(task.activity==='chess') {
      const table=world.structures.find(s=>s.id===task.buildingId&&s.kind==='chess-table');
      const seat=world.structures.find(s=>s.id===task.seatId&&(s.kind==='stool'||s.kind==='dining-chair'||s.kind==='armchair'||s.kind==='couch'));
      // A couch (schema 365) seats one player per cell; an older seat is its anchor.
      const seatKey=seat?.kind==='couch'?-1-(Number(task.target.z)*world.width+Number(task.target.x)):seat?.id;
      if(!table||!seat||!seatAt(seat,task.target as {x:number;z:number})||!isChessCell(table,task.target as {x:number;z:number}))errors.push('Invalid chess source or seat.');
      else {const count=(users.get(table.id)??0)+1;users.set(table.id,count);if(count>2)errors.push('Too many chess participants.');if(claimedChessSeats.has(seatKey!))errors.push('Duplicate chess seat.');claimedChessSeats.add(seatKey!);}
    } else if(version>=354&&isJoyTableActivity354(task.activity)) {
      // Schema 354 joy buildings: right kind, place and participant count.
      const facts=JOY_TABLE_BY_ACTIVITY_354[task.activity],table=world.structures.find(s=>s.id===task.buildingId&&s.kind===facts.kind),target=task.target as {x:number;z:number};
      const seat=task.seatId===undefined?undefined:world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
      const place=!table?false:task.activity==='hoopstone'?isHorseshoeCell(table,target)&&task.seatId===undefined
        :task.activity==='billiards'?inJoyTableRing354(footprintCells(table),target)&&task.seatId===undefined
        :joyTableCardinalCell354(footprintCells(table),target)&&(task.seatId===undefined?!joyTableRequiresChair354(task.activity):!!seat&&seatAt(seat,target));
      if(!table||!place)errors.push('Invalid joy building source or place.');
      else {const count=(users.get(table.id)??0)+1;users.set(table.id,count);if(count>facts.maxParticipants)errors.push('Too many joy building participants.');}
    } else if(isViewArtSchema366(version)&&task.activity==='view-art') {
      // Schema 366: one viewer per sculpture (Reserve), next to it, never seated.
      // A corner closed meanwhile is a runtime release, not a corrupt save.
      const art=world.structures.find(s=>s.id===task.buildingId&&isSculptureKind(s.kind));
      if(!art||task.seatId!==undefined||task.patientId!==undefined||!inJoyTableRing354(footprintCells(art),task.target as {x:number;z:number}))errors.push('Invalid art viewing source or place.');
      else {const count=(users.get(art.id)??0)+1;users.set(art.id,count);if(count>1)errors.push('Too many art viewers.');}
    } else if(task.activity==='watch-television') {
      // Durable TV identities and shared places are checked once below.
    } else if(task.activity==='social-relax') {
      if(task.patientId!==undefined)errors.push('Gathering cannot claim a patient.');
      const spot=world.structures.find(s=>s.id===task.buildingId&&isGatherSpot(s));
      const seat=world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
      // Fuel and the gather switch can change after this pawn's turn. The next
      // confirmed tick releases a stale task; saving that boundary must work.
      if(!spot)errors.push('Invalid gathering source.');
      else if(spot.kind==='campfire') {
        if((spot.x-Number(task.target.x))**2+(spot.z-Number(task.target.z))**2>15
          ||(task.seatId!==undefined&&(!seat||!seatAt(seat,task.target as {x:number;z:number}))))errors.push('Invalid campfire place.');
      } else if(!seat||!seatAt(seat,task.target as {x:number;z:number})||!adjacentToTable(spot,task.target as {x:number;z:number}))errors.push('Invalid gathering seat.');
    } else if(task.activity==='visit-sick') {
      if(task.buildingId!==null)errors.push('Visit cannot claim a building.');
      // Bed rest can end after the visitor has acted this tick. Preserve the
      // durable identity here and let recreationSiteValid cancel on resume.
      const patient=world.pawns.find(p=>p.id===task.patientId);
      const seat=world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
      if(!patient||patient.id===pawn.id
        ||task.seatId!==undefined&&(!seat||!seatAt(seat,task.target as {x:number;z:number})))errors.push('Invalid sick visit.');
      if(claimedPatients.has(Number(task.patientId)))errors.push('Duplicate sick visit.');
      claimedPatients.add(Number(task.patientId));
    } else {
      if(task.seatId!==undefined)errors.push('Horseshoes cannot claim a seat.');
      const pin=world.structures.find(s=>s.id===task.buildingId&&s.kind==='horseshoes');
      if(!pin||!isHorseshoeCell(pin,task.target as unknown as {x:number;z:number}))errors.push('Invalid horseshoes source or throwing spot.');
      else {const count=(users.get(pin.id)??0)+1;users.set(pin.id,count);if(count>3)errors.push('Too many horseshoes participants.');}
    }
    if(version>=124&&task.activity!=='skygaze'){
      const cell=Number(task.target.z)*world.width+Number(task.target.x);
      if(claimedServiceCells.has(cell))errors.push('Duplicate recreation service place.');
      claimedServiceCells.add(cell);
    }
  }
  if(version>=190&&!validTelevisionTasks(world))errors.push('Invalid television source, seat or activity.');
  if(!validReadingWorld295(world))errors.push('Invalid reading original, ownership, phase or reservation.');
  return errors;
}
