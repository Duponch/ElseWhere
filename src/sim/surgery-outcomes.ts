import {medicalModel} from './body-model.ts';
import { BODY_PARTS,HUMAN_BODY,BODY_INDEX,BODY_COVERAGE,type BodyPartId } from './body-definition.ts';
import { HP_UNIT,isWithinPart } from './injury-rules.ts';
import { partMissing,remainingPartHealth,reconcileMedicalDeath } from './injury-state.ts';
import type { MedicalRecord,MedicalRandom } from './injury-types.ts';
import { applySurgeryDamage,checkedSurgeryRandom,type SurgeryDamageHit,type SurgeryDamageKind } from './surgery-damage.ts';

export type SurgeryOutcomeKind='success'|'minor'|'catastrophic'|'ridiculous';
export interface SurgeryOutcome {kind:SurgeryOutcomeKind;record:MedicalRecord;hits:SurgeryDamageHit[]}
/** Derived from Core BodyPartTagDef.vital, not local armor groups. Paired
 * lungs/kidneys remain protected even while their other member functions. */
const VITAL=new Set<BodyPartId>(['brain','neck','heart','left-lung','right-lung','left-kidney','right-kidney','liver','stomach']);
const PROTECTED=new Set(HUMAN_BODY.filter(p=>p.parent===null||HUMAN_BODY.some(child=>VITAL.has(child.id)&&isWithinPart(child.id,p.id))).map(p=>p.id));
export const surgeryPartProtected=(part:BodyPartId):boolean=>PROTECTED.has(part);
export function surgeryMinimumProtectedHealth(record:MedicalRecord,part:BodyPartId):number {
  let minimum=999999;
  for(let id:BodyPartId|null=part;id!==null;id=BODY_PARTS[id].parent)if(PROTECTED.has(id))minimum=Math.min(minimum,remainingPartHealth(record,id)/HP_UNIT);
  return minimum;
}
export function surgeryDamageCandidates(record:MedicalRecord,part:BodyPartId,wholeBody=false):BodyPartId[] {
  return HUMAN_BODY.filter(p=>!p.conceptual&&!partMissing(record,p.id)&&
    (wholeBody||p.id===part||p.parent===part||p.id===BODY_PARTS[part].parent)&&
    surgeryMinimumProtectedHealth(record,p.id)>=2&&
    (p.id!=='brain'||remainingPartHealth(record,p.id)/HP_UNIT>=medicalModel(record).byId[p.id].hp/2+1)).map(p=>p.id);
}
const roundEven=(n:number):number=>{const floor=Math.floor(n);return n-floor===.5?floor+floor%2:Math.round(n);};
/** This guard applies before damage-worker propagation, as in HealthUtility;
 * it is not a new global immunity to every propagated layer. */
export function surgeryProtectedDamage(record:MedicalRecord,part:BodyPartId,damage:number):number {
  const minimum=surgeryMinimumProtectedHealth(record,part);
  if(minimum-damage<1)damage=roundEven(minimum-1);
  const hp=remainingPartHealth(record,part)/HP_UNIT,max=medicalModel(record).byId[part].hp;
  if(part==='brain'&&hp-damage<max*.5)damage=Math.max(roundEven(hp-max*.5),1);
  return Math.max(0,damage);
}
/** Caller awards actual-work XP and revalidates all physical guards first.
 * A successful result leaves anatomy untouched for amputateSurgicalLimb.
 * Failure operates on a clone, with one explicit authoritative random stream. */
export function resolveSurgeryOutcome(record:MedicalRecord,part:BodyPartId,chance:number,random:MedicalRandom,options:{allowMissingPart?:true;nativeScratch382?:boolean}={}):SurgeryOutcome {
  const missing=partMissing(record,part),parent=BODY_PARTS[part]?.parent;
  const allowedMissing=options.allowMissingPart&&record.missing.some(m=>m.part===part)&&parent&&!partMissing(record,parent);
  if(record.body!==undefined||record.death||!BODY_PARTS[part]||BODY_PARTS[part].conceptual||missing&&!allowedMissing||!Number.isFinite(chance)||chance<0||chance>.98)throw new RangeError('Invalid surgery outcome');
  const draw=()=>checkedSurgeryRandom(random),next=structuredClone(record);reconcileMedicalDeath(next);
  if(next.death)throw new RangeError('Invalid surgery outcome');
  if(draw()<chance)return {kind:'success',record:next,hits:[]};
  // Dedicated death chance is zero for RemoveBodyPart; local RNG does not draw
  // a ticket for this impossible branch or absent Biotech outcomes.
  const kind:SurgeryOutcomeKind=draw()<.45?'catastrophic':draw()<.05?'ridiculous':'minor';
  const hits:SurgeryDamageHit[]=[],whole=kind==='ridiculous';let left=kind==='minor'?20:65;
  while(left>0&&!next.death){
    const candidates=surgeryDamageCandidates(next,part,whole),total=candidates.reduce((n,id)=>n+BODY_COVERAGE[BODY_INDEX[id]],0);if(!total)break;
    let roll=draw()*total,selected=candidates.at(-1)!;
    for(const id of candidates){roll-=BODY_COVERAGE[BODY_INDEX[id]];if(roll<0){selected=id;break;}}
    const amount=remainingPartHealth(next,selected)/HP_UNIT*(.5+.5*draw()),floor=Math.floor(amount);
    const rounded=floor+(draw()<amount-floor?1:0),damage=surgeryProtectedDamage(next,selected,Math.max(3,rounded));if(!damage)break;
    const damageKind=(['cut','scratch','stab','crush'] as const)[Math.floor(draw()*4)]! as SurgeryDamageKind;
    hits.push(applySurgeryDamage(next,selected,damage,damageKind,draw,options.nativeScratch382));left-=damage;
  }
  return {kind,record:next,hits};
}
