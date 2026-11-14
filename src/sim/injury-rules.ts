import type { BodyPartId } from './body-definition.ts';
import { HUMAN_MODEL,medicalModel,type BodyModel } from './body-model.ts';
import { isMechanoidKind } from './mechanoid-definition.ts';
import { artificialPartCovering } from './artificial-parts-rules.ts';
import type { MedicalRecord } from './injury-types.ts';

/** Adult natural body only. These are injury properties, not weapon/armor rules.
 * Provenance and unresolved version differences: docs/research/injuries-reference.md. */
export const HP_UNIT=1000;
export const PAIN_UNIT=800000;
/** Integer units make both thirds/day recovery and wound bleeding exact. */
export const BLOOD_UNIT=300_000_000;
export const MEDICAL_INTERVAL=6; // 60 Core ticks, day preserved at 6000 local ticks
export const HEAL_INTERVAL=60;
export const FRESH_MISSING_TICKS=9000;
export type InjuryKind='stab'|'burn'|'execution-cut'|'cut'|'crush'|'crack'|'bruise'|'gunshot'|'bite'|'shredded'|'frostbite';
export type ScarPain=0|1|3|6;
/** Per milli-HP: numerator of pain / PAIN_UNIT, and blood units per interval. */
export const INJURY_RULES=Object.freeze({
  frostbite:Object.freeze({label:'Gelure',painUnits:10,bleedUnits:0,scar:true,merge:true}),
  shredded:Object.freeze({label:'Lacération',painUnits:10,bleedUnits:18,scar:true,merge:true}),
  burn:Object.freeze({label:'Brûlure',painUnits:15,bleedUnits:0,scar:true,merge:true}),
  'execution-cut':Object.freeze({label:'Entaille d’achèvement',painUnits:10,bleedUnits:18,scar:false,merge:false}),
  bite:Object.freeze({label:'Morsure',painUnits:10,bleedUnits:18,scar:true,merge:false}),
  stab:Object.freeze({label:'Plaie perforante',painUnits:10,bleedUnits:18,scar:true,merge:false}),
  cut:Object.freeze({label:'Coupure',painUnits:10,bleedUnits:18,scar:true,merge:false}),
  crush:Object.freeze({label:'Écrasement',painUnits:10,bleedUnits:3,scar:true,merge:true}),
  crack:Object.freeze({label:'Fissure',painUnits:8,bleedUnits:0,scar:true,merge:false}),
  bruise:Object.freeze({label:'Contusion',painUnits:10,bleedUnits:0,scar:false,merge:false}),
  gunshot:Object.freeze({label:'Blessure par balle',painUnits:10,bleedUnits:18,scar:true,merge:false}),
});
const bone=(id:BodyPartId)=>['ribcage','sternum','pelvis','spine','skull','nose','jaw'].includes(id)||/-(clavicle|humerus|radius|femur|tibia)$/.test(id);
function partRules(model:BodyModel){return Object.freeze(Object.fromEntries(model.parts.map(part=>{
  if(part.nativeInjuryRule)return [part.id,Object.freeze({...part.nativeInjuryRule})];
  if(isMechanoidKind(model.kind))return [part.id,Object.freeze({solid:true,skin:false,bleed:0,delicate:false,scarFactor:0})];
  const solid=bone(part.id),eye=part.id.endsWith('-eye');
  const skin=part.depth==='outside'&&!eye&&!['jaw','tongue','waist'].includes(part.id);
  return [part.id,Object.freeze({solid,skin,bleed:solid||part.id==='tongue'?0:part.id==='heart'?5:part.id==='neck'?4:part.id==='head'?2:1,
    delicate:eye||part.id==='brain',scarFactor:part.id==='brain'?9999999:eye?15:part.id==='spine'?6:solid?0:1})];
})) as Record<BodyPartId,Readonly<{solid:boolean;skin:boolean;bleed:number;delicate:boolean;scarFactor:number}>>);}
export const PART_INJURY_RULES=partRules(HUMAN_MODEL);
const ANIMAL_INJURY_RULES=new Map<BodyModel,ReturnType<typeof partRules>>();
const ARTIFICIAL_INJURY_RULE=Object.freeze({solid:true,skin:false,bleed:0,delicate:false,scarFactor:0});
export const injuryPartRules=(model:BodyModel,record?:Pick<MedicalRecord,'body'|'artificialParts'>)=>{
  if(model.kind==='human')return record?.artificialParts?.length?Object.freeze(Object.fromEntries(model.parts.map(p=>[p.id,artificialPartCovering(record,p.id)?ARTIFICIAL_INJURY_RULE:PART_INJURY_RULES[p.id]])) as typeof PART_INJURY_RULES):PART_INJURY_RULES;
  let rules=ANIMAL_INJURY_RULES.get(model);if(!rules){rules=partRules(model);ANIMAL_INJURY_RULES.set(model,rules);}return rules;
};
export const medicalPartInjuryRule=(record:MedicalRecord,part:BodyPartId)=>artificialPartCovering(record,part)?ARTIFICIAL_INJURY_RULE:injuryPartRules(medicalModel(record))[part];

export function isWithinPart(candidate:BodyPartId,ancestor:BodyPartId,model=HUMAN_MODEL):boolean {
  for(let id:BodyPartId|null=candidate;id!==null;id=model.byId[id].parent)if(id===ancestor)return true;
  return false;
}
export function coagulationAge(severity:number):number {
  // Convert the rounded Core deadline, retaining its fractional local tick.
  const core=90000*Math.max(0,Math.min(1,(severity/HP_UNIT-1)/29)),floor=Math.floor(core);
  return (90000+(core-floor===.5?floor+floor%2:Math.round(core)))/10;
}
export function scarChance(part:BodyPartId,kind:InjuryKind,severity:number,model=HUMAN_MODEL,record?:Pick<MedicalRecord,'body'|'artificialParts'>):number {
  const rules=injuryPartRules(model,record)[part];
  return INJURY_RULES[kind].scar?Math.min(1,.02*rules.scarFactor*(rules.delicate?1:Math.max(0,Math.min(1,(severity/HP_UNIT-4)/10)))):0;
}
export function bloodConsciousness(loss:number):{consciousnessOffset:number;consciousnessMax?:number} {
  if(loss>=BLOOD_UNIT*.6)return {consciousnessOffset:-.4,consciousnessMax:.1};
  return {consciousnessOffset:loss>=BLOOD_UNIT*.45?-.4:loss>=BLOOD_UNIT*.3?-.2:loss>=BLOOD_UNIT*.15?-.1:0};
}
/** Only these boundaries can change capacities or cause blood-loss death. */
export function bloodStage(loss:number):number {
  return loss>=BLOOD_UNIT?5:loss>=BLOOD_UNIT*.6?4:loss>=BLOOD_UNIT*.45?3:loss>=BLOOD_UNIT*.3?2:loss>=BLOOD_UNIT*.15?1:0;
}
