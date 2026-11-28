/** Already implemented systemic clinical owners, imported from actual
 * RimWorld hediff and immunity records. Required EW-only clocks/parameters
 * have explicit adaptations; no disease is rolled or created speculatively. */
import type {Pawn} from '../../sim/types.ts';
import type {MedicalRecord} from '../../sim/injury-types.ts';
import type {ImportContext} from './convert.ts';
import type {XmlNode} from './xml.ts';
import {num,text,items} from './xml.ts';
import {BLOOD_UNIT} from '../../sim/injury-rules.ts';
import {HEAT_UNIT} from '../../sim/heat-severity.ts';
import {MALNUTRITION_UNIT} from '../../sim/malnutrition.ts';
import {FLU_UNIT,FLU_TEND_DURATION_CORE,FLU_TEND_DURATION_CORE317,FLU_TEND_OVERLAP_CORE317} from '../../sim/flu-rules.ts';
import {IMMUNE_DISEASE_UNIT,immuneDiseaseTendCore,IMMUNE_DISEASE_TEND_OVERLAP_CORE} from '../../sim/immune-diseases-rules.ts';
import type {ImmuneDiseaseKind} from '../../sim/immune-diseases-types.ts';
import {MECHANITE_UNIT307,MECHANITE_MIN307,MECHANITE_TEND_DURATION_CORE307,MECHANITE_TEND_OVERLAP_CORE307,type MechaniteKind307} from '../../sim/mechanites-307.ts';
import {validCryptosleepSicknessState256} from '../../sim/cryptosleep-sickness-256.ts';
import {validatePawnHealthRecord} from '../../sim/health-save.ts';
import {medicalStatus,reconcileMedicalDeath} from '../../sim/injury-state.ts';
import {validFlu} from '../../sim/flu-save.ts';
import {validImmuneDiseases} from '../../sim/immune-diseases-save.ts';
import {validMechanites307} from '../../sim/mechanites-307.ts';
import {ANIMAL_AGE_CONDITION_DEFINITIONS_256,type AnimalAgeConditionKind256} from '../../sim/animal-age-condition-data-256.ts';
import type {AnimalAgeConditionCase256} from '../../sim/animal-age-condition-state-256.ts';
import {HUMAN_PART_MAP} from './map-pawns.ts';
import {validateMedicalRecord} from '../../sim/injury-validation.ts';
import {INFECTION_UNIT,INFECTION_TEND_DURATION_CORE,INFECTION_TEND_OVERLAP_CORE} from '../../sim/infection-rules.ts';
import {PARASITE_TEND_DURATION_CORE306,PARASITE_TEND_OVERLAP_CORE306,type ParasiteKind306} from '../../sim/parasites-306.ts';
import {ANESTHETIC_UNIT,ANESTHETIC_INTERVAL,ANESTHETIC_DELAY_MIN_CORE,ANESTHETIC_DELAY_MAX_CORE,anestheticStage} from '../../sim/anesthetic.ts';
import {FOOD_POISON_UNIT,foodCanCarryPoison,rawFoodPoisonChance,type FoodPoisonCause} from '../../sim/food-poisoning.ts';
import {ITEM_MAP} from './map-items.ts';
import {isDropped,lookup} from './mapping.ts';
import {PENOXYCYLINE_DECREMENTS_337,PENOXYCYLINE_FACTS_337} from '../../sim/penoxycyline-337.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';

const immune:Readonly<Record<string,ImmuneDiseaseKind>>={Malaria:'malaria',Plague:'plague',SleepingSickness:'sleeping-sickness'};
const mechanites:Readonly<Record<string,MechaniteKind307>>={FibrousMechanites:'fibrous-mechanites',SensoryMechanites:'sensory-mechanites'};
const parasites:Readonly<Record<string,ParasiteKind306>>={GutWorms:'gut-worms',MuscleParasites:'muscle-parasites'};
const ageConditions=ANIMAL_AGE_CONDITION_DEFINITIONS_256;
const alcoholDefs=new Set(['AlcoholHigh','AlcoholTolerance','AlcoholAddiction','Hangover','AlcoholHangover','Cirrhosis','AlcoholBrainDamage']);
const systemic=new Set(['BloodLoss','Heatstroke','Hypothermia','Malnutrition','CryptosleepSickness','Flu','WoundInfection','ToxicBuildup','Anesthetic','FoodPoisoning','PenoxycylineHigh',...alcoholDefs,...Object.keys(immune),...Object.keys(mechanites),...Object.keys(parasites),...Object.keys(ageConditions)]);
export const isStoredHumanMedicalDef=(def:string)=>systemic.has(def);
const scaled=(raw:number,unit:number)=>Math.max(0,Math.min(unit,Math.round(raw*unit)));
const f=Math.fround;
const medicalValid=(h:MedicalRecord,version:number)=>validateMedicalRecord(h,true,true,true,true,false,false,true,true,true,true,true,version,true)===null;
const partOf=(node:XmlNode)=>text(node,'part/body')==='Human'?HUMAN_PART_MAP[num(node,'part/index')??-1]:undefined;
const sourceBorn=(row:XmlNode,tick:number)=>Math.max(0,Math.min(tick,Math.floor((num(row,'tickAdded')??0)/10)));
function immunity(node:XmlNode,def:string):number {
 const row=items(node,'healthTracker/immunity/imList').find(n=>text(n,'hediffDef')===def);
 return num(row,'immunity')??0;
}

/** The native model and the saved Core hediff share these exact component
 * values. For debugging hediffs placed on the whole body, do not invent an
 * organ to satisfy the anatomical owner. */
function ageCondition(h:MedicalRecord,row:XmlNode,kind:AnimalAgeConditionKind256,bornAt:number,age:number):{represented:boolean;exact:boolean;why?:string} {
 const part=partOf(row),severity=num(row,'severity'),d=ageConditions[kind];
 if(!h.humanHealthScale&&(kind==='BadBack'||kind==='Frail')){
  const value=kind==='BadBack'?'bad-back':'frail';if(!(h.ageAilments??=[]).includes(value))h.ageAilments.push(value);
  return {represented:true,exact:false,why:'Ancien propriétaire clinique conservé ; dossier anatomique natif indisponible.'};
 }
 if(!part||severity===undefined||severity<d.min||severity>d.max||!Number.isSafeInteger(age)||age<0)return {represented:false,exact:false,why:'Condition anatomique sans partie ou sévérité native admissible.'};
 const ageCore=Math.min(age,(h.tick-bornAt)*10+10);
 const c:AnimalAgeConditionCase256={id:h.animalAgeConditions?.nextId??1,kind,part,bornAt,ageCore,severity:f(severity),noPain:text(row,'noPain')==='True'};
 if(kind==='Asthma'||kind==='Carcinoma')c.tend={ticksLeft:num(row,'tendTicksLeft')??-1,quality:f(num(row,'tendQuality')??0),totalQuality:f(num(row,'totalTendQuality')??0)};
 if(kind==='Carcinoma'){
  const modes:Readonly<Record<string,0|1|2>>={Growing:0,Stable:1,Remission:2},mode=modes[text(row,'growthMode')??'Growing'];
  const growing=num(row,'severityPerDayGrowingRandomFactor'),remission=num(row,'severityPerDayRemissionRandomFactor');
  if(mode===undefined||growing===undefined||remission===undefined)return {represented:false,exact:false,why:'Facteurs réels de croissance/rémission non enregistrés.'};
  c.growth={mode,growingFactor:f(growing),remissionFactor:f(remission)};
 }
 if(kind==='HeartArteryBlockage'){
  const factor=num(row,'severityPerDayNotImmuneRandomFactor');if(factor===undefined)return {represented:false,exact:false,why:'Facteur de progression natif manquant.'};c.severityFactor=f(factor);
 }
 if(kind==='HeartAttack'){
  const factor=num(row,'intervalFactor');if(factor===undefined)return {represented:false,exact:false,why:'Intervalle clinique aléatoire source absent.'};c.intervalFactor=f(factor);
 }
 if(kind==='Dementia')c.skillDecayRemainders={}; // float Core has no EW integer XP remainder
 h.animalAgeConditions??={revision:1,nextId:1,cases:[]};h.animalAgeConditions.cases.push(c);h.animalAgeConditions.nextId++;
 return {represented:true,exact:ageCore===age&&kind!=='Dementia',why:ageCore!==age?'Age clinique antérieur à la chronologie admissible.':kind==='Dementia'?'Reliquats fractionnaires d’expérience propres à ElseWhere initialisés sans tirage.':undefined};
}

const drugRecord=(node:XmlNode,drug:string)=>items(node,'drugs/drugTakeRecords').find(row=>text(row,'drug')===drug);
function alcoholState(h:MedicalRecord,node:XmlNode,rows:readonly XmlNode[]):boolean {
 const dose=drugRecord(node,'Beer'),last=num(dose,'lastTakenTicks'),count=num(dose,'timesTakenThisDay');
 if(last===undefined||!Number.isSafeInteger(last)||last<0||Math.floor(last/10)>h.tick||count===undefined||!Number.isSafeInteger(count)||count<1)return false;
 const lookup=(...defs:string[])=>rows.find(r=>defs.includes(text(r,'def')??''));
 const value=(...defs:string[])=>num(lookup(...defs),'severity')??0;
 const addiction=lookup('AlcoholAddiction'),need=num(items(node,'needs/needs').find(n=>text(n,'def')==='Chemical_Alcohol'),'curLevel');
 if(addiction&&(need===undefined||num(addiction,'severity')===undefined))return false;
 h.alcohol={bornAt:Math.min(Math.floor(last/10),...rows.map(r=>sourceBorn(r,h.tick))),lastDoseTick:Math.floor(last/10),dosesToday:count,high:f(value('AlcoholHigh')),tolerance:f(value('AlcoholTolerance')),hangover:f(value('Hangover','AlcoholHangover')),
  ...addiction?{addiction:{severity:f(num(addiction,'severity')!),need:f(need!)}}:{},...lookup('Cirrhosis')?{cirrhosis:true}:{},...lookup('AlcoholBrainDamage')?{brainDamage:true}:{}};
 return true;
}

/** Terminal or suspended owners supply their own factual clinical frontier;
 * the live importer deliberately may not fabricate a death from a living
 * pawn's incompatible record. */
export function importStoredHumanMedicalState(ctx:ImportContext,p:Pawn,node:XmlNode,options?:{allowTerminal?:boolean;sourceLimitCore?:number}):void {
 const {w,notes}=ctx;
 if(!p.health)return;
 const rows=items(node,'healthTracker/hediffSet/hediffs').filter(r=>options?.sourceLimitCore===undefined||(num(r,'tickAdded')??0)<=options.sourceLimitCore).sort((a,b)=>(num(a,'tickAdded')??0)-(num(b,'tickAdded')??0));
 let alcoholResult:{represented:boolean;why?:string}|undefined;
 for(const row of rows){
  const def=text(row,'def')??'';if(!isStoredHumanMedicalDef(def))continue;
  // The native clinical case is structurally admissible but not executable
  // on a living human: both human-age and human-condition-frontier explicitly
  // require the original memory deletion/conditional-thought authority.
  // Never bypass those real runtime guards just to make a valid JSON record.
  if(def==='Alzheimers'&&!options?.allowTerminal){
   notes.def('health',def,'dropped',undefined,'Le modèle ElseWhere ne compose pas encore les oublis de souvenirs ni les pensées conditionnelles d’Alzheimer chez un humain vivant ; le dossier clinique est conservable uniquement dans un propriétaire terminal démontré.',1,'model');continue;
  }
  const h=p.health;if(!h)continue;
  const prev:MedicalRecord=structuredClone(h),state=p.state,now=h.tick*10,observed=options?.sourceLimitCore??effectiveCore297(w);
  const age=num(row,'ageTicks')??0,bornAt=sourceBorn(row,h.tick),severity=num(row,'severity');
  let exact=severity===undefined||severity>=0&&severity<=1,represented=false,why:string|undefined;
  const tend=(duration:number,overlap:number,min=duration)=>{const quality=num(row,'tendQuality'),remaining=num(row,'tendTicksLeft')??0;if(quality===undefined||remaining<=0)return undefined;
   const source=observed+remaining,expiresAtCore=Math.min(now+duration+overlap-1,Math.max(bornAt*10+min,Math.round(source)));
   if(source!==expiresAtCore||quality>1.3||quality<0)exact=false;return {quality:scaled(quality/1.3,1300),expiresAtCore};};
  if(def==='CryptosleepSickness'){
   const remainingCore=num(row,'ticksToDisappear'),initialCore=num(row,'disappearsAfterTicks'),noiseSeed=num(row,'seed');
   const receipt={remainingCore,initialCore,noiseSeed};
   if(validCryptosleepSicknessState256(receipt)){h.cryptosleepSickness=receipt;represented=true;}
  }else if(Object.hasOwn(ageConditions,def)){
   const result=ageCondition(h,row,def as AnimalAgeConditionKind256,bornAt,age);({represented,exact,why}=result);
  }else if(alcoholDefs.has(def)){
   if(alcoholResult){notes.def('health',def,alcoholResult.represented?'adapted':'dropped',alcoholResult.represented?def:undefined,alcoholResult.why);continue;}
   represented=alcoholState(h,node,rows.filter(r=>alcoholDefs.has(text(r,'def')??'')));exact=false;
   why=represented?'Doses source réelles et conditions alcooliques reprises ; date arrondie au pas local.':'Le modèle alcoolique exige un véritable DrugTakeRecord Beer et, en cas d’addiction, le niveau du besoin chimique.';
  }else if(severity!==undefined){
   if(def==='BloodLoss'){h.bloodLoss=scaled(severity,BLOOD_UNIT);represented=true;}
   else if(def==='Heatstroke'&&severity>0){h.heatstroke=scaled(severity,HEAT_UNIT);represented=true;}
   else if(def==='Hypothermia'&&severity>0){h.hypothermia=scaled(severity,HEAT_UNIT);represented=true;}
   else if(def==='Malnutrition'&&severity>0){h.malnutrition=scaled(severity,MALNUTRITION_UNIT);represented=true;}
   else if(def==='ToxicBuildup'&&severity>0){h.toxicBuildup={severity:f(severity),bornAt};represented=true;}
   else if(def==='WoundInfection'){
    const part=partOf(row),value=scaled(severity,INFECTION_UNIT);
    if(part&&value>0){
     h.infections??={nextId:1,cases:[],immunity:scaled(immunity(node,def),INFECTION_UNIT)};
     if(!h.infections.cases.some(c=>c.part===part)){
      const dressing=tend(INFECTION_TEND_DURATION_CORE,INFECTION_TEND_OVERLAP_CORE);
      h.infections.cases.push({id:h.infections.nextId++,part,bornAt,severity:value,luck:1_000_000,...dressing?{tend:dressing}:{}});
      represented=true;exact=false;why='Partie, sévérité, immunité et soins repris ; coefficient de vitesse individuel sans équivalent enregistré.';
     }
    }else why='Une infection ElseWhere appartient à une partie anatomique réelle ; aucune partie inventée pour une infection globale.';
   }else if(def==='Anesthetic'&&severity>0){
    const remaining=num(row,'ticksToDisappear'),expiresAtCore=remaining===undefined?undefined:Math.round(observed+remaining),phase=p.id%ANESTHETIC_INTERVAL;
    const steps=Math.floor((h.tick-phase)/ANESTHETIC_INTERVAL)-Math.floor((bornAt-phase)/ANESTHETIC_INTERVAL),loss=steps*8_000_000;
    const actual=ANESTHETIC_UNIT-Math.floor(loss/3),source=Math.round(severity*ANESTHETIC_UNIT);
    if(expiresAtCore!==undefined&&expiresAtCore>now&&expiresAtCore-bornAt*10>=ANESTHETIC_DELAY_MIN_CORE&&expiresAtCore-bornAt*10<=ANESTHETIC_DELAY_MAX_CORE&&actual>0&&Math.abs(source-actual)<=2_675_000&&anestheticStage(source)===anestheticStage(actual)){
     h.anesthetic={bornAt,expiresAtCore,severity:actual,remainder:loss%3};represented=true;exact=source===actual;why='Cadence entière de décroissance du propriétaire local, fin d’anesthésie source conservée.';
    }else why='La durée ou la sévérité source ne respecte pas la cadence d’anesthésie déterministe existante.';
   }else if(def==='FoodPoisoning'&&severity>0){
    const source=text(row,'source'),m=source?lookup(ITEM_MAP,source):undefined;
    // The current schema requires the actual food; Core often omits the
    // consumed source def entirely. Never manufacture a meal or its cause.
    if(m&&!isDropped(m)){
     const item=m.to,rawCause=text(row,'cause'),known:Readonly<Record<string,FoodPoisonCause>>={FilthyKitchen:'filthy-kitchen',IncompetentCook:'incompetent-cook',DangerousFood:'dangerous-food',Unknown:'unknown'};
     const cause=rawCause?known[rawCause]:foodCanCarryPoison(item)?'unknown':rawFoodPoisonChance(item)>0?'dangerous-food':undefined;
     if(cause&&((cause==='dangerous-food'&&rawFoodPoisonChance(item)>0)||(cause!=='dangerous-food'&&foodCanCarryPoison(item)))){h.foodPoisoning={severity:scaled(severity,FOOD_POISON_UNIT),bornAt,cause,item};represented=true;exact=!!rawCause;}
    }
    if(!represented)why='L’aliment réellement contaminant n’est pas enregistré ou non représenté ; le propriétaire actuel exige son type exact.';
   }else if(def==='PenoxycylineHigh'&&severity>0){
    const dose=drugRecord(node,'Penoxycyline'),last=num(dose,'lastTakenTicks'),count=num(dose,'timesTakenThisDay');
    if(last!==undefined&&Number.isSafeInteger(last)&&last>=0&&last<=now&&count!==undefined&&Number.isSafeInteger(count)&&count>=1){
     // The local hash phase is a representation constraint. Derive the
     // number of remaining pulses from the actual saved float, then admit
     // only the deadline compatible with the real recorded last dose.
     let current=f(severity),remaining=0;while(current>0&&remaining<=PENOXYCYLINE_DECREMENTS_337){current=f(current+PENOXYCYLINE_FACTS_337.severityPerInterval);remaining++;}
     const min=last+(PENOXYCYLINE_DECREMENTS_337-1)*200+1,max=last+PENOXYCYLINE_DECREMENTS_337*200,until=Math.min(max,Math.max(min,observed+remaining*200));
     if(until>now&&Math.abs(until-(observed+remaining*200))<400){h.penoxycyline337={lastDoseCore:last,dosesToday:count,untilCore:until};represented=true;exact=false;}
    }
    if(!represented)why='Dose, persistance et sévérité ne disposent pas d’un reçu temporel compatible.';
   }else if(def==='Flu'||immune[def]){
    const value=scaled(severity,def==='Flu'?FLU_UNIT:IMMUNE_DISEASE_UNIT),im=scaled(immunity(node,def),IMMUNE_DISEASE_UNIT);
    // Core's actual episode exists, but our luck component has no saved
    // counterpart. Use the neutral rate, not a fresh random draw.
    const episode={bornAt,severity:value,immunity:im,luck:1_000_000};
    if(def==='Flu'){
     h.flu=episode;const dressing=tend(FLU_TEND_DURATION_CORE317,FLU_TEND_OVERLAP_CORE317,FLU_TEND_DURATION_CORE);
     if(value&&dressing)h.flu.tend={...dressing,core317:true};
     represented=validFlu(h,true,true);
    }else{
     const kind=immune[def]!,duration=immuneDiseaseTendCore(kind);
     h.immuneDiseases??={};h.immuneDiseases[kind]=episode;
     const dressing=tend(duration,IMMUNE_DISEASE_TEND_OVERLAP_CORE);if(value&&dressing)h.immuneDiseases[kind]!.tend=dressing;
     represented=validImmuneDiseases(h.immuneDiseases,h,w.schemaVersion);
    }
    exact=false;
   }else if(parasites[def]){
    const kind=parasites[def]!,total=scaled((num(row,'totalTendQuality')??0)/3,3000),dressing=tend(PARASITE_TEND_DURATION_CORE306,PARASITE_TEND_OVERLAP_CORE306);
    if(total<3000){h.parasites306??={};h.parasites306[kind]={bornAt,totalTend:total,...dressing?{tend:dressing}:{}};represented=true;}
   }else if(mechanites[def]){
    const kind=mechanites[def]!,remaining=num(row,'ticksToDisappear'),quality=num(row,'tendQuality'),tendLeft=num(row,'tendTicksLeft')??0;
    if(remaining!==undefined&&Number.isSafeInteger(remaining)&&remaining>0){
     h.mechanites307??={};h.mechanites307[kind]={bornAt,severity:Math.max(MECHANITE_MIN307,scaled(severity,MECHANITE_UNIT307)),disappearsAtCore:observed+remaining};
     const dressing=tend(MECHANITE_TEND_DURATION_CORE307,MECHANITE_TEND_OVERLAP_CORE307);if(quality!==undefined&&tendLeft>0&&dressing)h.mechanites307[kind]!.tend=dressing;
     represented=validMechanites307(h.mechanites307,w.schemaVersion,h.tick);
     exact=age<=h.tick*10&&age%10===0;
    }
   }
  }
  if(represented){
   if(options?.allowTerminal)delete h.death;
   reconcileMedicalDeath(h);
   // A committed terminal source is never inferred from a living
   // colonist's illness. Keep its actual severity only if representable.
   if(h.death&&!options?.allowTerminal)represented=false;
   else {const s=medicalStatus(h);if(s==='dead')p.state='dead';else if(s==='downed'&&p.state!=='downed'){p.state='downed';if(!options?.allowTerminal)exact=false;}else if(s==='mobile'&&(p.state==='downed'||p.state==='dead'))p.state='idle';}
  }
  if(!represented||!medicalValid(h,w.schemaVersion)||validatePawnHealthRecord(p,w,!!options?.allowTerminal||h.tick<w.tick).length){
   p.health=prev;p.state=state;
   notes.def('health',def,'dropped',undefined,why??'État systémique présent mais son dossier ne respecte pas les invariants du modèle actuel.');
   if(alcoholDefs.has(def))alcoholResult={represented:false,why};
  }else {notes.def('health',def,exact?'exact':'adapted',def,exact?undefined:why??'Sévérité, immunité et soins représentables repris ; âge, durée bornée ou vitesse sans équivalent exact sont adaptés.');if(alcoholDefs.has(def))alcoholResult={represented:true,why};}
 }
}
