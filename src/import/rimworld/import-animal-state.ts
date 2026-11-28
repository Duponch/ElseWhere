/** Import the owners that the existing animal simulation already knows.
 * Reference-dependent records are attached only after every local pawn has
 * its true converted identity. Source clocks are translated at the boundary;
 * we never unlock a feature, create a substitute father or weaken admission. */
import type {ImportContext} from './convert.ts';
import type {RwsThing} from './rws-save.ts';
import {referencedThingId} from './rws-save.ts';
import {at,items as listItems,num,text,type XmlNode} from './xml.ts';
import {ANIMAL_MAP,INJURY_MAP} from './map-pawns.ts';
import {isDropped,lookup,mappingStatus} from './mapping.ts';
import type {WildAnimal} from '../../sim/wildlife-state.ts';
import type {BodyPartId} from '../../sim/body-definition.ts';
import type {ScarPain} from '../../sim/injury-rules.ts';
import {animalNutritionMax,adultAgeTicks,gestationTicks} from '../../sim/animal-life.ts';
import {productKind} from '../../sim/animal-products.ts';
import {createAnimalMedicalRecord256} from '../../sim/animal-clinical-age-v256.ts';
import {nativeAnimalAnatomy256} from '../../sim/native-animal-anatomy-256.ts';
import {animalPartId256} from '../../sim/animal-anatomy-v256.ts';
import {medicalModel} from '../../sim/body-model.ts';
import {medicalStatus,partMissing,reconcileMedicalDeath} from '../../sim/injury-state.ts';
import {BLOOD_UNIT} from '../../sim/injury-rules.ts';
import {validateMedicalRecord} from '../../sim/injury-validation.ts';
import {animalTrainingDecayPeriodCore282} from '../../sim/animal-training-282.ts';
import {ANIMAL_TRAINING_STEPS_282,type AnimalTrainingProgress282} from '../../sim/animal-training-state-282.ts';
import {validAnimalTrainingField282} from '../../sim/animal-training-save-282.ts';
import {ANIMAL_EGG_CONTENT_256,isEggSpecies256} from '../../sim/animal-egg-content-v256.ts';
import {validAnimalEggState256} from '../../sim/animal-egg-save-v256.ts';
import type {MedicalCare} from '../../sim/medicine-rules.ts';
import {isAutoSlaughterSpecies,defaultAutoSlaughterConfig} from '../../sim/auto-slaughter-state.ts';
import {validAutoSlaughterConfig} from '../../sim/auto-slaughter-save.ts';
import {penAnimalsForVersion} from '../../sim/animal-pens.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {ANIMAL_AGE_CONDITION_DEFINITIONS_256,type AnimalAgeConditionKind256} from '../../sim/animal-age-condition-data-256.ts';
import type {AnimalAgeConditionCase256} from '../../sim/animal-age-condition-state-256.ts';
import {HEAT_UNIT} from '../../sim/heat-severity.ts';
import {MALNUTRITION_UNIT} from '../../sim/malnutrition.ts';
import {validCryptosleepSicknessState256} from '../../sim/cryptosleep-sickness-256.ts';
import {importActorFilthFeet} from './convert-environment.ts';

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const bool=(value:string|undefined)=>value?.toLowerCase()==='true';
const CARE:Readonly<Record<string,MedicalCare>>={NoCare:'none',NoMeds:'dry',HerbalOrWorse:'herbal',NormalOrWorse:'industrial',Best:'best'};
const PAIN:Readonly<Record<string,ScarPain>>={Painless:0,LowPain:1,MediumPain:3,HighPain:6};
const suffix=(id:string)=>Number(/\d+$/.exec(id)?.[0]??Number.MAX_SAFE_INTEGER);
/** Native save validation requires both known parents to predate a child.
 * RWS map iteration order has no such guarantee. Core Thing IDs are assigned
 * when spawned and retain their numerical chronology. Reserve the imported
 * animals' identity space in that chronology before creating the first one. */
const allocations=new WeakMap<ImportContext,Map<string,number>>();
export function importedAnimalId(ctx:ImportContext,thing:RwsThing):number {
 let allocated=allocations.get(ctx);
 if(!allocated){
  allocated=new Map();
  const candidates=ctx.map.things.filter(t=>{const m=lookup(ANIMAL_MAP,t.def);return t.cls==='Pawn'&&!!t.pos&&!!m&&!isDropped(m);});
  candidates.sort((a,b)=>suffix(a.id)-suffix(b.id)||a.id.localeCompare(b.id));
  for(const t of candidates)allocated.set(t.id,ctx.w.nextId++);
  allocations.set(ctx,allocated);
 }
 const id=allocated.get(thing.id);
 if(id===undefined)throw Error('Identité animale non réservée.');
 return id;
}

/** Source elapsed time can predate the converted campaign's local origin.
 * Truncate chronologies to zero only where the current schema requires it. */
function pastLocal(ctx:ImportContext,sourceTick:number|undefined):number {
 return sourceTick===undefined?ctx.w.tick:clamp(Math.floor((effectiveCore297(ctx.w)-Math.max(0,ctx.save.ticksGame-sourceTick))/10),0,ctx.w.tick);
}
function ageOfHediff(ctx:ImportContext,h:XmlNode):number|undefined {
 return num(h,'ageTicks')??(num(h,'tickAdded')===undefined?undefined:Math.max(0,ctx.save.ticksGame-num(h,'tickAdded')!));
}
function bornAt(ctx:ImportContext,h:XmlNode):number {
 const added=num(h,'tickAdded');
 return pastLocal(ctx,added??(ageOfHediff(ctx,h)===undefined?undefined:ctx.save.ticksGame-ageOfHediff(ctx,h)!));
}
function admittedHealth(ctx:ImportContext,a:WildAnimal,allowDeath=false):boolean {
 if(!a.health)return false;
 // Compute, never invent, a terminal clinical cause when (and only when)
 // the source is the original pawn of a real corpse holder.
 delete a.health.death;
 if(allowDeath)reconcileMedicalDeath(a.health);
 return !validateMedicalRecord(a.health,true,true,true,true,true,true,true,true,true,true,true,ctx.w.schemaVersion)&&(allowDeath||medicalStatus(a.health)!=='dead');
}
export function importAnimalHealth(ctx:ImportContext,t:RwsThing,a:WildAnimal,options?:{allowDeath?:true;hasPhysicalCorpseOwner?:true}):void {
 const all=listItems(t.node,'healthTracker/hediffSet/hediffs').filter(h=>{
  if(h.attrs?.Class==='Hediff_Pregnant')return false;
  // Later scavenging/removal of corpse parts is not the animal's terminal
  // clinical proof. The outer carcass owner can represent that separately.
  if(options?.allowDeath&&num(h,'tickAdded')!==undefined&&num(h,'tickAdded')!>ctx.save.ticksGame){
   if(!options.hasPhysicalCorpseOwner)ctx.notes.def('health',t.def+': '+(text(h,'def')??'?'),'dropped',undefined,'État postmortem : hors du dossier clinique arrêté au décès.');return false;
  }
  return true;
 });
 if(!all.length)return;
 const body=nativeAnimalAnatomy256(a.species).body,record=createAnimalMedicalRecord256(ctx.w,a);a.health=record;
 const model=medicalModel(record);
 const allowDeath=options?.allowDeath===true;
 const bloodLoss=all.find(h=>text(h,'def')==='BloodLoss'),loss=num(bloodLoss,'severity');
 if(loss!==undefined&&loss>0&&loss<=1){
  record.bloodLoss=Math.round(loss*BLOOD_UNIT);
  if(admittedHealth(ctx,a,allowDeath))ctx.notes.def('health',t.def+': BloodLoss','exact','perte sanguine');
  else{record.bloodLoss=0;delete record.death;ctx.notes.def('health',t.def+': BloodLoss','dropped',undefined,'Perte sanguine vitale non compatible avec l’état source.');}
 }
 function partOf(h:XmlNode):BodyPartId|undefined {
  const index=num(h,'part/index');
  if(text(h,'part/body')!==body||index===undefined||!Number.isInteger(index)||index<0)return;
  try{const p=animalPartId256(body,index);return model.byId[p]?p:undefined;}catch{return;}
 }
 const missing=all.filter(h=>h.attrs?.Class==='Hediff_MissingPart');
 // Core stores descendants of a missing part too. Represent the outermost
 // loss exactly, not independent losses of parts that no longer exist.
 const missingParts=new Set(missing.map(partOf).filter((p):p is BodyPartId=>p!==undefined));
 for(const h of missing){
  const part=partOf(h);
  if(!part){ctx.notes.def('health',t.def+': MissingBodyPart','dropped',undefined,'Anatomie source incompatible.',1,'model');continue;}
  let ancestor=model.byId[part].parent,covered=false;
  while(ancestor){if(missingParts.has(ancestor)){covered=true;break;}ancestor=model.byId[ancestor].parent;}
  if(covered||record.missing.some(p=>p.part===part))continue;
  const tended=num(h,'tendQuality')!==undefined&&num(h,'tendTicksLeft')!==undefined;
  // Old injuries do not become a brand-new bleeding wound when translated
  // to the local origin. NonFresh is the native animal clinical marker.
  const nonFresh=!bool(text(h,'isFresh'))||bornAt(ctx,h)===0&&(ageOfHediff(ctx,h)??0)>ctx.w.tick*10+60000;
  // The native clinical schema stores two *exclusive* absence markers.
  // A previous tend already cancels bleeding; never duplicate it with
  // nonFresh, which is reserved for an untreated but permanent absence.
  record.missing.push({part,bornAt:bornAt(ctx,h),...tended?{tended:true as const}:nonFresh?{nonFresh:true as const}:{}});
  if(admittedHealth(ctx,a,allowDeath))ctx.notes.def('health',t.def+': MissingBodyPart',bool(text(h,'isFresh'))&&nonFresh&&!tended?'adapted':'exact','partie animale manquante',bool(text(h,'isFresh'))&&nonFresh&&!tended?'Perte ancienne ramenée à une absence non fraîche.':undefined);
  else {record.missing.pop();delete record.death;if(allowDeath)reconcileMedicalDeath(record);ctx.notes.def('health',t.def+': MissingBodyPart','dropped',part,'Partie manquante refusée par la simulation.');}
 }
 for(const h of all){
  const cls=h.attrs?.Class,def=text(h,'def')??'?';
  if(cls==='Hediff_MissingPart'||def==='BloodLoss'&&loss!==undefined&&loss>0&&loss<=1||allowDeath&&def==='ExecutionCut')continue;
  // Existing scalar clinical owners and native old-age conditions use the
  // same anatomy as animal wounds. Never substitute a guessed body part.
  if(['Heatstroke','Hypothermia','Malnutrition','CryptosleepSickness'].includes(def)||Object.hasOwn(ANIMAL_AGE_CONDITION_DEFINITIONS_256,def)){
   const prior=structuredClone(record);
   let represented=false,exact=true;
   const raw=num(h,'severity');
   if(def==='CryptosleepSickness'){
    const receipt={remainingCore:num(h,'ticksToDisappear'),initialCore:num(h,'disappearsAfterTicks'),noiseSeed:num(h,'seed')};
    if(validCryptosleepSicknessState256(receipt)){record.cryptosleepSickness=receipt;represented=true;}
   }else if(raw!==undefined&&raw>0){
    if(def==='Heatstroke'||def==='Hypothermia'||def==='Malnutrition'){
     const key=def==='Heatstroke'?'heatstroke':def==='Hypothermia'?'hypothermia':'malnutrition',unit=key==='malnutrition'?MALNUTRITION_UNIT:HEAT_UNIT;
     record[key]=Math.round(clamp(raw,0,1)*unit);represented=record[key]!>0;exact=raw<=1;
    }else if(Object.hasOwn(ANIMAL_AGE_CONDITION_DEFINITIONS_256,def)){
     const kind=def as AnimalAgeConditionKind256,part=partOf(h),definition=ANIMAL_AGE_CONDITION_DEFINITIONS_256[kind];
     const age=ageOfHediff(ctx,h)??0,born=bornAt(ctx,h);
     if(part&&!partMissing(record,part)&&raw>=definition.min&&raw<=definition.max&&Number.isSafeInteger(age)&&age>=0){
      const candidate:AnimalAgeConditionCase256={id:(record.animalAgeConditions?.nextId??1),kind,part,bornAt:born,ageCore:Math.min(age,(record.tick-born)*10+10),severity:Math.fround(raw),noPain:bool(text(h,'noPain'))};
      if(kind==='Asthma'||kind==='Carcinoma'){
       candidate.tend={ticksLeft:num(h,'tendTicksLeft')??-1,quality:Math.fround(num(h,'tendQuality')??0),totalQuality:Math.fround(num(h,'totalTendQuality')??0)};
      }
      if(kind==='Carcinoma'){
       // Core saves HediffGrowthMode as a enum name (Growing is 0).
       const modeName=text(h,'growthMode'),mode=modeName===undefined||modeName==='Growing'?0:modeName==='Stable'?1:modeName==='Remission'?2:undefined,
        growing=num(h,'severityPerDayGrowingRandomFactor'),remission=num(h,'severityPerDayRemissionRandomFactor');
       if((mode===0||mode===1||mode===2)&&growing!==undefined&&remission!==undefined)candidate.growth={mode,growingFactor:Math.fround(growing),remissionFactor:Math.fround(remission)};
      }
      if(kind==='HeartArteryBlockage'){const sf=num(h,'severityPerDayNotImmuneRandomFactor');if(sf!==undefined)candidate.severityFactor=Math.fround(sf);}
      if(kind==='HeartAttack'){const factor=num(h,'intervalFactor');if(factor!==undefined)candidate.intervalFactor=Math.fround(factor);}
      record.animalAgeConditions??={revision:1,nextId:1,cases:[]};
      record.animalAgeConditions.cases.push(candidate);record.animalAgeConditions.nextId++;
      exact=candidate.ageCore===age;represented=true;
     }
    }
   }
   if(represented&&admittedHealth(ctx,a,allowDeath))ctx.notes.def('health',t.def+': '+def,exact?'exact':'adapted',def,exact?undefined:'Chronologie clinique réduite à l’horloge compatible.');
   else {
    // Roll back every property introduced by this failed clinical trial.
    for(const key of Object.keys(record))if(!Object.hasOwn(prior,key))delete (record as unknown as Record<string,unknown>)[key];
    Object.assign(record,prior);ctx.notes.def('health',t.def+': '+def,'dropped',undefined,'État ou paramètres cliniques d’origine non admis.');
   }
   continue;
  }
  if(cls!=='Hediff_Injury'){ctx.notes.def('health',t.def+': '+def,'dropped',undefined,'État clinique animal sans correspondance directe dans cette étape.');continue;}
  const part=partOf(h),mapped=lookup(INJURY_MAP,def),severity=num(h,'severity');
  if(!part||!mapped||isDropped(mapped)||severity===undefined||severity<=0||partMissing(record,part)){
   ctx.notes.def('health',t.def+': '+def,'dropped',undefined,'Blessure ou anatomie non représentable.',1,!mapped?'unresolved':isDropped(mapped)||!part?'model':severity===undefined?'source':'both');continue;
  }
  // The native body model scales existing anatomical HP. Do not truncate
  // a clinical wound to make an invalid projected owner look valid.
  const milli=Math.max(1,Math.round(severity*1000)),permanent=bool(text(h,'isPermanent')),tend=num(h,'tendQuality');
  const wound={id:record.nextInjuryId++,part,kind:mapped.to,severity:milli,bornAt:bornAt(ctx,h),
   ...permanent?{scar:{threshold:milli,pain:PAIN[text(h,'painCategory')??'Painless']??0}}:tend!==undefined?{tended:Math.round(clamp(tend*1000,0,1300))}:{}};
  record.injuries.push(wound);
  if(admittedHealth(ctx,a,allowDeath))ctx.notes.def('health',t.def+': '+def,mappingStatus(mapped),mapped.to,'adapt' in mapped?mapped.adapt:undefined);
  else {record.injuries.pop();record.nextInjuryId--;delete record.death;if(allowDeath)reconcileMedicalDeath(record);ctx.notes.def('health',t.def+': '+def,'dropped',mapped.to,'État clinique refusé par la simulation.');}
 }
 // A Core ExecutionCut is explicit terminal proof, unlike an ordinary
 // nonfatal wound on a dead pawn. Keep its original localised incision only
 // if it satisfies the native execution validator without any fake damage.
 if(allowDeath&&!record.death){
  const h=all.find(h=>text(h,'def')==='ExecutionCut'),part=h?partOf(h):undefined,severity=h?num(h,'severity'):undefined;
  if(h&&part&&severity!==undefined&&severity>0&&severity<=1&&bornAt(ctx,h)===record.tick&&!partMissing(record,part)){
   record.injuries.push({id:record.nextInjuryId++,part,kind:'execution-cut',severity:Math.round(severity*1000),bornAt:record.tick});
   record.death={tick:record.tick,cause:'execution'};
   if(!validateMedicalRecord(record,true,true,true,true,true,true,true,true,true,true,true,ctx.w.schemaVersion))ctx.notes.def('health',t.def+': ExecutionCut','exact','exécution prouvée');
   else {record.injuries.pop();record.nextInjuryId--;delete record.death;ctx.notes.def('health',t.def+': ExecutionCut','dropped',undefined,'Preuve d’exécution non conforme au modèle clinique.');}
  }
 }
 if(!record.injuries.length&&!record.missing.length&&!record.bloodLoss&&!record.death&&!record.heatstroke&&!record.hypothermia&&!record.malnutrition&&!record.cryptosleepSickness&&!record.animalAgeConditions?.cases.length)delete a.health;
 else if(record.death)a.state='dead';
 else if(medicalStatus(record)==='downed')a.state='downed';
}

/** Scalar biological owners can be recovered before the reference pass. */
export function importAnimalState(ctx:ImportContext,t:RwsThing,a:WildAnimal):void {
 const growth=num(t.node,'ageTracker/growth'),nextGrowth=num(t.node,'ageTracker/nextGrowthCheckTick');
 if(a.growthTracker&&growth!==undefined&&growth>=0&&growth<=1){
  a.growthTracker.value=Math.fround(growth);
  a.growthTracker.nextCheckCore=growth===1&&(nextGrowth===undefined||!Number.isSafeInteger(nextGrowth))?null:
   ctx.w.tick*10+clamp(nextGrowth!==undefined&&Number.isSafeInteger(nextGrowth)?nextGrowth-ctx.save.ticksGame+(effectiveCore297(ctx.w)-ctx.w.tick*10):240,0,240);
 }
 const needs=listItems(t.node,'needs/needs');
 const rawFood=num(needs.find(n=>text(n,'def')==='Food'),'curLevel'),rawRest=num(needs.find(n=>text(n,'def')==='Rest'),'curLevel');
 // Need_Food.curLevel is actual nutrition, not a percentage (adult
 // large animals legitimately exceed one). The simulation uses this unit.
 const maximum=animalNutritionMax(a);
 a.food=rawFood===undefined?maximum*.8:clamp(rawFood,0,maximum);
 if(rawFood!==undefined&&a.food!==rawFood)ctx.notes.def('animals',t.def+': nourriture','adapted','nutrition','Valeur bornée aux capacités de cette espèce.',1,'model');
 if(rawRest!==undefined)a.rest=clamp(rawRest,0,1);
 if(a.wander&&at(t.node,'mindState'))a.wander.nextMoveOrderIsWait=bool(text(t.node,'mindState/nextMoveOrderIsWait'));
 const exit=num(t.node,'mindState/exitMapAfterTick');
 if(a.species==='thrumbo'&&!a.domestic&&exit!==undefined&&Number.isSafeInteger(exit)&&exit>0&&exit<2147483647){
  const converted=effectiveCore297(ctx.w)+exit-ctx.save.ticksGame;
  if(Number.isSafeInteger(converted)&&converted>0&&converted<=ctx.w.tick*10+150000){a.exitAtCore382=converted;ctx.notes.def('animals',t.def+': départ de visite','exact','échéance Core');}
  else ctx.notes.def('animals',t.def+': départ de visite','dropped',undefined,'Échéance de départ sans ancrage temporel admissible.',1,'source');
 }
 importActorFilthFeet(ctx,a,t.node,'animals');
 const d=a.domestic;
 if(d){
  d.since=pastLocal(ctx,num(t.node,'playerSettings/joinTick'));
  d.care=CARE[text(t.node,'playerSettings/medCare')??'']??'herbal';
  const kind=productKind(a),full=num(t.node,'milkFullness')??num(t.node,'woolGrowth');
  if(kind)d.productFullness=full===undefined?0:clamp(full,0,1);
  else {delete d.productFullness;if(full!==undefined&&full>0)ctx.notes.def('animals',t.def+': produit','dropped',undefined,'Produit laitier/laineux non représentable pour cette espèce ou son âge.',1,'model');}
 }
 importAnimalHealth(ctx,t,a);
}

type ImportedAnimal={thing:RwsThing;animal:WildAnimal};
/** TrainableDef.index follows the five Core 1.6 definitions in
 * TrainableDefs/Trainables.xml: Obedience, Release, Rescue, Haul, Tameness. */
function importTraining(ctx:ImportContext,t:RwsThing,a:WildAnimal,masterId:number|undefined,bondedId:number|undefined):void {
 const rawName=(text(t.node,'name/name')??text(t.node,'name/first'))?.trim().slice(0,80),
       name=rawName&&!/[\u0000-\u001f\u007f-\u009f]/.test(rawName)?rawName:undefined,
       d=a.domestic,training=at(t.node,'training');
 if(name)a.startingPet={revision:1,name};
 if(rawName&&!name)ctx.notes.def('animals',t.def+': nom','dropped',undefined,'Nom contenant des caractères de contrôle non admis.');
 if(!training)return;
 const steps=listItems(training,'steps/vals').map(n=>Number(n.text.trim())),learned=listItems(training,'learned/vals').map(n=>bool(n.text.trim())),
       wants=listItems(training,'wantedTrainables/vals').map(n=>bool(n.text.trim()));
 const progress=(index:number,max:number):AnimalTrainingProgress282=>{
  const hasSteps=Number.isSafeInteger(steps[index]),count=hasSteps?clamp(steps[index]!,0,max):learned[index]?max:0;
  return {steps:count,learned:count===max||count>0&&learned[index]===true,wanted:wants[index]??learned[index]??false};
 };
 const tameness=progress(4,ANIMAL_TRAINING_STEPS_282.tameness),obedience=progress(0,ANIMAL_TRAINING_STEPS_282.obedience),haul=progress(3,ANIMAL_TRAINING_STEPS_282.haul);
 if(d&&tameness.steps>0)d.tameness=tameness.steps;
 const period=animalTrainingDecayPeriodCore282(a),countDecay=num(training,'countDecayFrom'),now=ctx.w.tick*10;
 if(period!==undefined&&(d||tameness.wanted||obedience.steps||obedience.wanted||haul.steps||haul.wanted||masterId!==undefined)){
  const elapsed=countDecay===undefined?0:Math.max(0,ctx.save.ticksGame-countDecay),core=effectiveCore297(ctx.w);
  a.training={revision:1,sinceCore:(d?.since??pastLocal(ctx,countDecay))*10,lastLocalCore:now,nextDecayCore:Math.max(0,Math.min(now+period,core+period-elapsed)),
    tamenessWanted:tameness.wanted||(!wants.length&&!!d),obedience,haul,...masterId!==undefined?{masterId}:{}};
  if(!validAnimalTrainingField282(a,ctx.w.schemaVersion,ctx.w.tick,ctx.w.nextId,{actualHuman:id=>ctx.w.pawns.find(p=>p.id===id)})){
   delete a.training;ctx.notes.def('animals',t.def+': dressage','dropped',undefined,'Progression refusée pour ce profil animal.');
  } else ctx.notes.def('animals',t.def+': dressage',steps.length===5&&wants.length===5?'exact':'adapted','apprivoisement, obéissance, transport');
 }
 if(name&&bondedId!==undefined&&obedience.learned&&obedience.steps===3){
  a.startingPet={revision:1,name,bondedPawnId:bondedId,obedience:{steps:3,wanted:true},...masterId===bondedId?{masterId}:{}};
 }else if(bondedId!==undefined)ctx.notes.def('animals',t.def+': lien','dropped',undefined,'Lien sans nom ou obéissance complète non représentable.');
 if(masterId!==undefined&&!a.training?.masterId&&!a.startingPet?.masterId)ctx.notes.def('animals',t.def+': maître','dropped',undefined,'Maître non représentable pour ce profil.');
 for(const [idx,label] of [[1,'libération'],[2,'sauvetage']] as const)if(learned[idx]||wants[idx]||steps[idx]>0)ctx.notes.def('animals',t.def+': '+label,'dropped',undefined,'Aptitude non prise en charge dans Elsewhere.',1,'model');
 if(bool(text(t.node,'playerSettings/followDrafted'))||bool(text(t.node,'playerSettings/followFieldwork')))ctx.notes.def('animals',t.def+': suivi du maître','dropped',undefined,'Le modèle de dressage ne porte pas les deux politiques de suivi.',1,'model');
}

export function finalizeImportedAnimals(ctx:ImportContext,animals:readonly ImportedAnimal[]):void {
 const w=ctx.w,bySource=new Map(animals.map(r=>[r.thing.id,r.animal])),beds=new Set<number>();
 const from=(ref:string|undefined)=>{const id=referencedThingId(ref);return id?bySource.get(id):undefined;};
 const human=(ref:string|undefined)=>{const r=referencedThingId(ref),id=r?ctx.thingIds.get(r):undefined;return id!==undefined&&w.pawns.some(p=>p.id===id)?id:undefined;};
 for(const {thing:t,animal:a} of animals){
  const relations=listItems(t.node,'social/directRelations'),master=human(text(t.node,'playerSettings/master')),
        bonds=relations.filter(r=>text(r,'def')==='Bond'),bonded=bonds.map(r=>human(text(r,'otherPawn'))).filter((r):r is number=>r!==undefined);
  importTraining(ctx,t,a,master,bonded.find(id=>id===master)??bonded[0]);
  if(bonds.length>1)ctx.notes.def('animals',t.def+': liens multiples','adapted','un lien','Un seul lien humain peut être conservé.');
  if(bonds.length&&!bonded.length)ctx.notes.def('animals',t.def+': lien','dropped',undefined,'Identité humaine liée non importée.');
  const parents=relations.filter(r=>text(r,'def')==='Parent'),resolved=parents.map(r=>from(text(r,'otherPawn'))).filter((r):r is WildAnimal=>r!==undefined);
  const mother=resolved.find(p=>p.sex==='female'),father=resolved.find(p=>p.sex==='male');
  if(mother&&father&&mother.id<a.id&&father.id<a.id&&mother.species===a.species&&father.species===a.species){
   a.parents={motherId:mother.id,fatherId:father.id};ctx.notes.def('animals',t.def+': parents','exact','parents présents');
  }else if(parents.length)ctx.notes.def('animals',t.def+': parents','dropped',undefined,parents.length===1?'Le modèle exige deux parents ; une seule relation existe dans la source.':'Deux identités parentales antérieures ne sont pas toutes disponibles.',1,parents.length===1?'model':'both');
  const p=listItems(t.node,'healthTracker/hediffSet/hediffs').find(h=>h.attrs?.Class==='Hediff_Pregnant');
  if(p){
   const father=from(text(p,'father')),fraction=num(p,'severity'),duration=gestationTicks(a.species);
   if(father&&father.sex==='male'&&father.species===a.species&&father.id!==a.id&&a.sex==='female'&&a.ageTicks>=adultAgeTicks(a.species)&&father.ageTicks>=adultAgeTicks(father.species)&&duration>0&&fraction!==undefined){
    a.pregnancy={fatherId:father.id,progress:Math.round(clamp(fraction,0,1)*duration)};
    ctx.notes.def('animals',t.def+': gestation','adapted','gestation en cours','Progression convertie sur les ticks locaux ; père réel repris.',1,'model');
   }else ctx.notes.def('animals',t.def+': gestation','dropped',undefined,'Père ou état de gestation non représentable.');
  }
  if(a.eggLayer&&isEggSpecies256(a.species)){
   const father=from(text(t.node,'fertilizedBy')),fraction=num(t.node,'eggProgress')??0,
    fertilizations=Math.round(clamp(num(t.node,'fertilizationCount')??0,0,ANIMAL_EGG_CONTENT_256[a.species].fertilizationMaximum));
   a.eggLayer={progress:clamp(fraction,0,1),fertilizations:father?fertilizations:0,...father&&father.id!==a.id?{fatherId:father.id}:{}};
   if(!validAnimalEggState256(a,w.schemaVersion,w)){a.eggLayer={progress:clamp(fraction,0,1),fertilizations:0};ctx.notes.def('animals',t.def+': ponte','adapted','ponte sans père','Lien de fécondation non admis.');}
   else if(fertilizations&&!father)ctx.notes.def('animals',t.def+': ponte','adapted','ponte sans père','Père de la fécondation non importé.');
  }
  if(a.domestic){
   const bedRef=referencedThingId(text(t.node,'ownership/ownedBed')),bedId=bedRef?ctx.thingIds.get(bedRef):undefined;
   if(bedId!==undefined&&w.structures.some(s=>s.id===bedId&&s.kind==='animal-sleeping-spot'&&!s.medical)&&!beds.has(bedId)){
    a.domestic.bedId=bedId;beds.add(bedId);
   }else if(bedRef)ctx.notes.def('animals',t.def+': couchage','dropped',undefined,'Couchage normal compatible et libre non importé.');
  }
 }
 // Quotas now have the actual species owner, with bonded protection.
 for(const row of listItems(ctx.map.node,'autoSlaughterManager/configs')){
  const def=text(row,'animal')??'',mapped=lookup(ANIMAL_MAP,def),
        limits=['maxTotal','maxMales','maxMalesYoung','maxFemales','maxFemalesYoung'] as const;
  if(!limits.some(k=>num(row,k)!==undefined&&num(row,k)!>=0)&&!bool(text(row,'allowSlaughterPregnant'))&&!bool(text(row,'allowSlaughterBonded')))continue;
  if(!mapped||isDropped(mapped)||!isAutoSlaughterSpecies(mapped.to,w.schemaVersion)){
   ctx.notes.def('animals',def+': abattage automatique','dropped',undefined,'Espèce absente du système d’abattage automatique.',1,'model');continue;
  }
  const config=defaultAutoSlaughterConfig(mapped.to);
  for(const k of limits){const n=num(row,k);if(n!==undefined)config[k]=n;}
  config.allowPregnant=bool(text(row,'allowSlaughterPregnant'));
  if(bool(text(row,'allowSlaughterBonded')))config.allowBonded382=true;
  if(validAutoSlaughterConfig(config,w.schemaVersion)&&!w.autoSlaughter?.some(c=>c.species===config.species)){
   (w.autoSlaughter??=[]).push(config);ctx.notes.def('animals',def+': abattage automatique',mappingStatus(mapped),mapped.to);
  }
 }
 // Pen membership is resolved by the existing post-import enclosure solver.
 // Its accepted species must already reflect the marker's actual filter.
 const admissible=penAnimalsForVersion(w.schemaVersion);
 for(const t of ctx.map.things){
  if(t.def!=='PenMarker')continue;
  const marker=w.structures.find(s=>s.id===ctx.thingIds.get(t.id)&&s.kind==='pen-marker');
  if(!marker?.pen||!at(t.node,'animalFilter/allowedDefs'))continue;
  const accepted=new Set<WildAnimal['species']>();
  const omitted:string[]=[];
  for(const value of listItems(t.node,'animalFilter/allowedDefs')){
   const def=text(value)??'',m=lookup(ANIMAL_MAP,def);
   if(m&&!isDropped(m)&&admissible.includes(m.to))accepted.add(m.to);else if(def)omitted.push(def);
  }
  marker.pen.accepted=admissible.filter(species=>accepted.has(species));
  ctx.notes.def('animals','Filtre d’enclos',omitted.length?'adapted':'exact','espèces acceptées',omitted.length?'Certaines espèces ou catégories de filtre n’ont pas d’équivalent.':undefined);
  if(text(t.node,'label'))ctx.notes.def('animals','Nom d’enclos','dropped',undefined,'Le modèle de marqueur ne stocke pas son libellé.',1,'model');
  if(listItems(t.node,'autoCutFilter/allowedDefs').length)ctx.notes.def('animals','Filtre de coupe d’enclos','dropped',undefined,'Le modèle de marqueur ne stocke pas la politique de débroussaillage.',1,'model');
 }
}
