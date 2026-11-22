import { COMPLEX_FURNITURE_RESEARCH_COST,TUBE_TELEVISION_RESEARCH_COST } from './research.ts';
import { isDiningSeat,seatAt } from './dining.ts';
import { isTelevisionCell,TELEVISION_MAX_PARTICIPANTS } from './television-recreation.ts';
import { RECREATION_DURATION } from './recreation-rules.ts';
import type { Pawn,Structure,World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):boolean=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const progress=(v:unknown,cost:number,tick:number,active=false):boolean=>object(v)&&Object.keys(v).every(k=>k==='points'||k==='completedAt')&&integer(v.points,0,cost)
  &&(v.completedAt===undefined?Number(v.points)<cost:!active&&v.points===cost&&integer(v.completedAt,0,tick));

function* livePawns(w:World):IterableIterator<Pawn> {
  yield* w.pawns;
  if(w.scout&&'pawn' in w.scout)yield w.scout.pawn;
  if(w.commercialTrip&&'pawn' in w.commercialTrip)yield w.commercialTrip.pawn;
}

/** Called only after strict validation of 189. Frozen departure archives retain
 * the recreation families recorded at departure; live travelers migrate too. */
export function initializeTelevisionRecreation(w:World):void {
  for(const p of livePawns(w)){p.recreation.tolerance.television=0;p.recreation.bored.television=false;}
  Object.assign(w,{schemaVersion:190});
}

/** Shared with the snapshot reader. Checks the durable content only, leaving
 * power topology, mutable visibility and runtime eligibility to their owners. */
export function validTelevisionState(w:World,version:number):boolean {
  const research=w.research,entry=research?.tubeTelevision,active=research?.project==='tube-television',unlocked=entry?.completedAt!==undefined;
  if((entry!==undefined||active)&&(version<190||!progress(entry,TUBE_TELEVISION_RESEARCH_COST,w.tick,active)
    ||!progress(research?.complexFurniture,COMPLEX_FURNITURE_RESEARCH_COST,w.tick)||research?.complexFurniture?.completedAt===undefined))return false;
  const building=(s:Structure,packed=false):boolean=>s.kind!=='tube-television'||version>=190&&unlocked&&s.material==='steel'&&s.footprint==='standard'
    &&integer(s.orientation,0,3)&&(s.damage===undefined||integer(s.damage,1,99))
    &&['quality','breakdown','medical','prisoner','bills','fuel','battery','cooler','door','wind','heater','flower','gatherSpot','art','grave','pen'].every(k=>(s as unknown as Record<string,unknown>)[k]===undefined)
    &&object(s.power)&&Object.keys(s.power).every(k=>['on','parentId','switchOn'].includes(k))&&typeof s.power.on==='boolean'
    &&(s.power.switchOn===undefined||typeof s.power.switchOn==='boolean')&&!(s.power.on&&s.power.switchOn===false)
    &&(s.power.parentId===null||integer(s.power.parentId,1,w.nextId-1)&&s.power.parentId!==s.id)
    &&(!packed||s.power.on===false&&s.power.parentId===null);
  for(const s of w.structures)if(!building(s))return false;
  for(const p of w.packed??[])if(!building(p.building,true))return false;
  for(const job of w.jobs){
    if(job.kind==='tube-television'&&(version<190||!unlocked||job.material!=='steel'||job.footprint!=='standard'||!integer(job.orientation,0,3)))return false;
    if((job.furniture?.kind==='tube-television'||job.deconstruction?.kind==='tube-television')&&(version<190||!unlocked||job.footprint!=='standard'||!integer(job.orientation,0,3)))return false;
  }
  for(const p of livePawns(w)){
    const joy=p.recreation;
    if(version<190){
      if(joy&&(object(joy.tolerance)&&Object.hasOwn(joy.tolerance,'television')||object(joy.bored)&&Object.hasOwn(joy.bored,'television')||joy.task?.activity==='watch-television'))return false;
    }else if(!joy||!object(joy.tolerance)||!object(joy.bored)||typeof joy.tolerance.television!=='number'||!Number.isFinite(joy.tolerance.television)
      ||joy.tolerance.television<0||joy.tolerance.television>100||typeof joy.bored.television!=='boolean'
      ||joy.tolerance.television>50&&!joy.bored.television||joy.tolerance.television<30&&joy.bored.television)return false;
  }
  return version<190||validTelevisionTasks(w);
}

/** Durable TV task invariants shared by save and snapshot readers. Power,
 * line of sight and room identity are deliberately rechecked by the next tick. */
export function validTelevisionTasks(w:World):boolean {
  let watching=false;
  for(const p of livePawns(w))if(p.recreation?.task?.activity==='watch-television'){watching=true;break;}
  if(!watching)return true;
  const users=new Map<number,number>(),places=new Map<number,boolean>(),seats=new Set<number>();
  for(const p of livePawns(w)){
    const task=p.recreation?.task;
    if(!task||task.activity==='skygaze')continue;
    const tvTask=task.activity==='watch-television';
    if(object(task.target)&&integer(task.target.x,0,w.width-1)&&integer(task.target.z,0,w.height-1)){
      const cell=Number(task.target.z)*w.width+Number(task.target.x),claimed=places.get(cell);
      if(claimed!==undefined&&(claimed||tvTask))return false;
      places.set(cell,tvTask);
    }else if(tvTask)return false;
    if(!tvTask)continue;
    if(!object(task)||Object.keys(task).some(k=>!['activity','target','buildingId','seatId','phase','elapsed'].includes(k))
      ||!integer(task.buildingId,1,w.nextId-1)||!integer(task.seatId,1,w.nextId-1)||!integer(task.elapsed,0,RECREATION_DURATION-1)
      ||!['travel','active'].includes(task.phase)||p.jobId!==null||p.haul||p.cooking||p.need
      ||p.research||p.hunting||p.feed||p.tend||p.surgery||p.rescue||p.burial||p.cleaning||p.animalHandling||p.animalCare||p.equipmentTask
      ||p.orders.active!==null)return false;
    const tv=w.structures.find(s=>s.id===task.buildingId&&s.kind==='tube-television'),seat=w.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
    const seatKey=seat?.kind==='couch'?-1-(Number(task.target.z)*w.width+Number(task.target.x)):seat?.id;
    if(!tv||!seat||!seatAt(seat,task.target as {x:number;z:number})||!isTelevisionCell(tv,task.target as {x:number;z:number})||seats.has(seatKey!))return false;
    if(task.phase==='travel'?(p.state!=='moving'||task.elapsed!==0):(p.state!=='recreating'||p.path.length>0||p.moveCooldown>0||p.x!==task.target.x||p.z!==task.target.z))return false;
    seats.add(seatKey!);const count=(users.get(tv.id)??0)+1;if(count>TELEVISION_MAX_PARTICIPANTS)return false;users.set(tv.id,count);
  }
  return true;
}
