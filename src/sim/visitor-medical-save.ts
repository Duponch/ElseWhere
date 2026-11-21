import {isDoubleBedKind} from './bed-kinds.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import { hasVisitorMedicalGuestMarker,validVisitorMedicalDeparture,validVisitorShape } from './visitor-save.ts';
import { validRescueShape,validateRescues } from './rescue-save.ts';
import { validTendShape,validateCare } from './care-save.ts';
import { validFeedShape,validateFeeding } from './feeding-save.ts';
import { isBedKind } from './bed-kinds.ts';
import { validateMedicalRecord } from './injury-validation.ts';
import { medicalStatus } from './injury-state.ts';
import type { Pawn,World } from './types.ts';

const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const colonialFields=['animalHandling','animalCare','animalFeed','animalRescue','allowedAreaReturn','deepWork','research','hunting','burial','cleaning','firefighting',
  'ward','equipmentTask','priorityWork','rescue','tend','surgery','surgeryRequest','feed','draft','trade'] as const;

/** Isolated prospective guest/visitor-rescue domain. Cheap scans find owners;
 * only participants acquire clinical checks. No paths, room flood or migration. */
export function validVisitorMedicalTransport(w:World):boolean {
  try {
    const patients=new Set<number>(),rescued=new Set<number>();
    for(const p of w.pawns)if(hasVisitorMedicalGuestMarker(p))patients.add(p.id);
    for(const d of w.visitors?.departed??[])if(hasVisitorMedicalGuestMarker(d.pawn)&&!validVisitorMedicalDeparture(d,w))return false;
    // The ordinary stream pays only presence scans, no owner index, while no
    // prospective guest or rescue exists. Archives keep their departure clock.
    if(!patients.size&&!w.pawns.some(p=>p.rescue))return true;
    const byId=new Map(w.pawns.map(p=>[p.id,p]));
    for(const actor of w.pawns)if(actor.rescue&&byId.get(actor.rescue.patientId)?.visitor)rescued.add(actor.rescue.patientId);
    if(!patients.size&&!rescued.size)return true;
    if(w.schemaVersion<237||byId.size!==w.pawns.length)return false;
    for(const id of new Set([...patients,...rescued])){
      const p=byId.get(id)!;
      if(!validVisitorShape(p as unknown as Record<string,unknown>,w.schemaVersion,w)
        ||p.faction!=='outlanders'||p.prisoner||p.podRescue||p.raid)return false;
      const v=p.visitor!,g=w.visitors?.groups.find(g=>g.id===v.group);
      if(!g||!g.members.includes(id)||g.phase!==v.phase||patients.has(id)&&!integer(v.medicalGuestAt,g.startedAt,w.tick))return false;
      if(p.orders.active!==null||p.orders.queue.length||p.jobId!==null||p.haul!==null||p.cooking!==null||p.recreation.task!==null
        ||colonialFields.some(k=>p[k]!==undefined)||Object.values(p.priorities).some(n=>n!==0))return false;
      if(!v.personalFoodIds.every(id=>w.piles.some(pile=>pile.id===id&&pile.kind==='food'
        &&(pile.owner.type==='inventory'||pile.owner.type==='pawn')&&pile.owner.pawnId===p.id)))return false;
      if(!patients.has(id)&&(p.bedId!==null||p.need?.kind==='sleep'&&p.need.bedId!==null))return false;
      if(p.bedId!==null){
        const bed=w.structures.find(b=>b.id===p.bedId&&isBedKind(b.kind));
        if(!bed||bed.medical||bed.prisoner||isDoubleBedKind(bed.kind)||w.pawns.some(other=>other.id!==id&&other.bedId===bed.id))return false;
      }
      const need=p.need;
      if(need?.kind==='sleep'&&need.bedId!==null){
        const bed=w.structures.find(b=>b.id===need.bedId&&isBedKind(b.kind));
        if(!bed||bed.prisoner||isDoubleBedKind(bed.kind)||!bed.medical&&p.bedId!==bed.id
          ||need.target.x!==bed.x||need.target.z!==bed.z
          ||w.pawns.some(other=>other.id!==id&&other.need?.kind==='sleep'&&other.need.bedId===bed.id))return false;
        if(need.phase==='sleep'?(p.state!=='downed'&&p.state!=='sleeping'&&p.state!=='resting'
          ||p.path.length||p.x!==bed.x||p.z!==bed.z||p.moveCooldown>0):p.state!=='moving')return false;
      }
      if(p.medicalSleep!==undefined&&(p.medicalSleep!==true||p.state!=='downed'&&p.state!=='resting'||p.moveCooldown>0))return false;
      const h=p.health;
      if(!h||validateMedicalRecord(h,true,true,true,true,false,false,true,true,true,true,true,w.schemaVersion,w.schemaVersion>=127)!==null
        ||(h.death?medicalCivilTick271(h)>w.tick:medicalCivilTick271(h)!==w.tick))return false;
      const status=medicalStatus(h);if(status==='mobile'?p.state==='downed'||p.state==='dead':p.state!==status)return false;
    }
    for(const actor of w.pawns){
      if(actor.rescue&&rescued.has(actor.rescue.patientId)&&!validRescueShape(actor.rescue,w.schemaVersion))return false;
      if(actor.tend&&patients.has(actor.tend.patientId)&&!validTendShape(actor.tend,w.schemaVersion,w))return false;
      if(actor.feed&&patients.has(actor.feed.patientId)&&!validFeedShape(actor.feed,w.schemaVersion,w))return false;
    }
    return !validateRescues(w,false,undefined,rescued).length&&!validateCare(w,undefined,patients).length&&!validateFeeding(w,patients).length;
  }catch{return false;}
}

/** Admission is historical inside one epoch. A load creates a new epoch and
 * may legitimately resume an older branch. Never rewrite an observed pickup. */
export function validVisitorMedicalTransition(previous:World,next:World):boolean {
  const present=(w:World)=>w.pawns.some(hasVisitorMedicalGuestMarker)||(w.visitors?.departed??[]).some(d=>hasVisitorMedicalGuestMarker(d.pawn));
  if(!present(previous)&&!present(next))return true;
  const marked=(w:World):Pawn[]=>[...w.pawns.filter(hasVisitorMedicalGuestMarker),...(w.visitors?.departed??[]).filter(d=>hasVisitorMedicalGuestMarker(d.pawn)).map(d=>d.pawn)];
  const before=marked(previous),after=marked(next);
  if(!before.length&&!after.length)return true;
  const old=new Map(before.map(p=>[p.id,p.visitor!.medicalGuestAt!])),current=new Map(after.map(p=>[p.id,p.visitor!.medicalGuestAt!]));
  if(old.size!==before.length||current.size!==after.length)return false;
  for(const [id,at]of old)if(current.get(id)!==at)return false;
  for(const [id,at]of current)if(!old.has(id)&&at<previous.tick)return false;
  return true;
}
