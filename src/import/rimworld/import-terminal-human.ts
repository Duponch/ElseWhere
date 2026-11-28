/** Reconstruct the existing terminal human clinical model from the source's
 * actual terminal state. A body is not a proof of a particular cause. The
 * engine must derive its death from represented, pre-death evidence. */
import type {ImportContext} from './convert.ts';
import type {Pawn} from '../../sim/types.ts';
import type {XmlNode} from './xml.ts';
import {items,num,text} from './xml.ts';
import {HUMAN_PART_MAP,INJURY_MAP,ADDED_PART_MAP} from './map-pawns.ts';
import {lookup,isDropped,mappingStatus} from './mapping.ts';
import {BODY_PARTS,type BodyPartId} from '../../sim/body-definition.ts';
import type {MedicalRecord,Injury} from '../../sim/injury-types.ts';
import {createMedicalRecord,reconcileMedicalDeath,remainingPartHealth,medicalStatus} from '../../sim/injury-state.ts';
import {type ScarPain} from '../../sim/injury-rules.ts';
import {validateMedicalRecord} from '../../sim/injury-validation.ts';
import {installArtificialPart} from '../../sim/artificial-parts.ts';
import {nativeHumanHealthScaleForCore256} from '../../sim/native-human-clinical-scale-256.ts';
import {importStoredHumanMedicalState} from './import-human-medical-state.ts';

const pain:Readonly<Record<string,ScarPain>>={Painless:0,LowPain:1,MediumPain:3,HighPain:6};
const partOf=(h:XmlNode):BodyPartId|undefined=>text(h,'part/body')==='Human'?HUMAN_PART_MAP[num(h,'part/index')??-1]:undefined;
const partAncestor=(part:BodyPartId,target:BodyPartId):boolean=>{let p:BodyPartId|null=BODY_PARTS[part]?.parent??null;while(p){if(p===target)return true;p=BODY_PARTS[p].parent;}return false;};
const medicalValid=(m:MedicalRecord,version:number)=>validateMedicalRecord(m,true,true,true,true,false,false,true,true,true,true,true,version,true)===null;
export function importTerminalHumanMedical(ctx:ImportContext,p:Pawn,node:XmlNode,deathTick:number,downed=false,deathCore=deathTick*10+9,hasPhysicalCorpseOwner=false):boolean {
 const sourceState=text(node,'healthTracker/healthState');
 if(sourceState!==(downed?'Down':'Dead')||!Number.isSafeInteger(deathTick)||deathTick<0||deathTick>ctx.w.tick||!Number.isSafeInteger(deathCore)||deathCore<0)return false;
 const rows=items(node,'healthTracker/hediffSet/hediffs'),record=createMedicalRecord(deathTick),{notes,w}=ctx;
 if(p.nativeHuman&&p.age)record.humanHealthScale=nativeHumanHealthScaleForCore256(p.age.biologicalTicks*10+p.nativeHuman.biologicalCoreRemainder);
 if(p.traits?.includes('wimp'))record.wimp362=true;
 // A late injury to a corpse is not evidence that the living human died
 // from it. The corpse has an independent physical damage field.
 const born=(h:XmlNode):number|undefined=>{
  const tick=num(h,'tickAdded');if(tick!==undefined&&tick>deathCore)return undefined;
  // Scribe omits the default tickAdded=0.
  return tick===undefined?0:Math.max(0,Math.floor(tick/10));
 };
 const eligible=rows.filter(h=>born(h)!==undefined);
 if(!hasPhysicalCorpseOwner&&eligible.length!==rows.length)notes.def('health','Anatomie après décès','dropped',undefined,'Blessures corporelles postérieures à l’heure réelle de la mort non admises dans le dossier clinique terminal.',rows.length-eligible.length);
 let current=record;
 const tryEdit=(write:(draft:MedicalRecord)=>boolean):boolean=>{
  const draft=structuredClone(current);delete draft.death;
  if(!write(draft))return false;
  reconcileMedicalDeath(draft);
  if(!medicalValid(draft,w.schemaVersion))return false;
  current=draft;return true;
 };
 const outerMissing=eligible.filter(h=>h.attrs?.Class==='Hediff_MissingPart').flatMap(h=>{const part=partOf(h);return part?[{h,part}]:[];});
 const prosthesisRoots=eligible.filter(h=>h.attrs?.Class==='Hediff_AddedPart').flatMap(h=>{const part=partOf(h),m=lookup(ADDED_PART_MAP,text(h,'def')??'');return part&&m&&!isDropped(m)?[part]:[];});
 for(const {h,part} of outerMissing){
  if(outerMissing.some(m=>m.part!==part&&partAncestor(part,m.part))||prosthesisRoots.some(root=>part===root||partAncestor(part,root)))continue;
  if(BODY_PARTS[part]?.parent===null||!tryEdit(d=>{d.missing.push({part,bornAt:born(h)!,...text(h,'isFresh')==='True'?{}:{tended:true as const}});return true;})){
   notes.def('health','Partie manquante (décès)','dropped',undefined,'Anatomie terminale non admise.');
  }else notes.def('health','Partie manquante (décès)','exact',part);
 }
 for(const h of eligible.filter(h=>h.attrs?.Class==='Hediff_AddedPart')){
  const def=text(h,'def')??'',part=partOf(h),m=lookup(ADDED_PART_MAP,def);
  if(!part||!m||isDropped(m)||!tryEdit(d=>{if(!d.missing.some(x=>x.part===part))d.missing.push({part,bornAt:born(h)!,tended:true});return installArtificialPart(d,part,m.to);}))notes.def('health',def,'dropped',undefined,'Prothèse terminale non représentable.');
  else notes.def('health',def,mappingStatus(m),m.to);
 }
 for(const h of eligible.filter(h=>h.attrs?.Class==='Hediff_Injury')){
  const def=text(h,'def')??'',part=partOf(h),m=lookup(INJURY_MAP,def),severity=Math.round((num(h,'severity')??0)*1000);
  if(!part||!m||isDropped(m)||severity<=0||current.missing.some(x=>x.part===part||partAncestor(part,x.part))){
   notes.def('health',def,'dropped',undefined,'Blessure terminale non représentable.');continue;
  }
  const permanent=text(h,'isPermanent')==='True',quality=num(h,'tendQuality'),capacity=remainingPartHealth(current,part);
  // Do not invent damage to make a simulated death fit. Some blood-loss
  // cases also have a source injury larger than our compatible anatomy;
  // keep the admitted part of that injury only if separately reported.
  const kept=Math.min(severity,Math.max(0,capacity-1));
  if(kept<=0||!tryEdit(d=>{
   const injury:Injury={id:d.nextInjuryId++,part,kind:m.to,severity:kept,bornAt:born(h)!,
    ...permanent?{scar:{threshold:kept,pain:pain[text(h,'painCategory')??'Painless']??0}}:
    quality!==undefined?{tended:Math.max(0,Math.min(1300,Math.round(quality*1000)))}:{}};
   d.injuries.push(injury);return true;
  })){notes.def('health',def,'dropped',undefined,'Blessure terminale incompatible avec l’anatomie actuelle.');continue;}
  notes.def('health',def,kept!==severity||mappingStatus(m)!=='exact'?'adapted':'exact',m.to,kept!==severity?'Sévérité bornée par la capacité anatomique actuelle.':undefined);
 }
 p.health=current;
 {const state=medicalStatus(current);p.state=state==='mobile'?'idle':state;}
 importStoredHumanMedicalState(ctx,p,node,{allowTerminal:!downed,sourceLimitCore:deathCore});
 current=p.health!;
 // Only supported terminal physiological states with source severity are
 // sufficient to derive a cause; no declaration of "downed" or generic
 // execution is inferred from the bare Dead flag alone.
 if(downed?!!current.death:!current.death)return false;
 p.health=current;p.state=downed?(medicalStatus(current)==='downed'?'downed':'idle'):'dead';p.path=[];p.moveCooldown=0;p.orders={active:null,queue:[]};p.jobId=null;p.need=null;p.haul=null;p.cooking=null;p.recreation.task=null;p.bedId=null;delete p.bedSlot;delete p.medicalSleep;
 p.restZeroTicks=0;p.collapsePending=false;
 if(!downed)notes.def('health','Cause de décès terminale','adapted',current.death!.cause,'Cause déduite des lésions et états cliniques effectivement enregistrés, par les règles d’ElseWhere.');
 else notes.def('health','État à terre',p.state==='downed'?'exact':'adapted',p.state,'État clinique déduit des blessures réelles dans le modèle actuel ; pas d’incapacité inventée.');
 return true;
}
