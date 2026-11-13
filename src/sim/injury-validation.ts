import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validCoveredInFirefoamField290} from './firefoam-actor-state-290.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {medicalCivilTick271,validMedicalCivilHeader271} from './suspended-human-clock-271.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {validAlcoholHeader265} from './alcohol-state-265.ts';
import {validScariaRecord261} from './animal-scaria-261.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {validHumanHealthScaleHeader256} from './native-human-clinical-scale-256.ts';
import {validToxicBuildupHeader256} from './toxic-buildup-256.ts';
import {validAnimalAgeConditions256} from './animal-age-condition-state-256.ts';
import {validCryptosleepSicknessHeader256} from './cryptosleep-sickness-256.ts';
import {validAnimalGrowthMedicalHeader256} from './animal-growth-runtime-256.ts';
import {validAnimalExecutionProof256} from './animal-execution-v256.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import { validInfections } from './infection-save.ts';
import { validFoodPoisoning } from './food-poisoning-save.ts';
import { validFlu } from './flu-save.ts';
import { validImmuneDiseases } from './immune-diseases-save.ts';
import { isParasites306,validParasites306 } from './parasites-306.ts';
import { isMechanites307,validMechanites307 } from './mechanites-307.ts';
import { validAnesthetic } from './anesthetic.ts';
import { validArtificialParts } from './artificial-parts-save.ts';
import { medicalModel,modelHasPart } from './body-model.ts';
import { isAnimalSpecies,isAnimalSpeciesInVersion,type AnimalSpeciesId } from './animal-species.ts';
import { mechanoidBodyModel } from './mechanoid-anatomy.ts';
import { isMechanoidKind,type MechanoidKind } from './mechanoid-definition.ts';
import { BLOOD_UNIT,HP_UNIT,INJURY_RULES,injuryPartRules,isWithinPart } from './injury-rules.ts';
import { createMedicalRecord,reconcileMedicalDeath,remainingPartHealth,medicalStatus } from './injury-state.ts';
import type { MedicalRecord } from './injury-types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
/** Strict isolated record validator. World ownership/migration is not implemented
 * by this function and must precede accepting a medical Pawn field. */
export function validateMedicalRecord(value:unknown,allowGunshot=true,allowBite=true,allowHeat=true,allowCold=true,animal=false,allowExecution=false,allowInfection=true,allowMalnutrition=true,allowBurn=true,allowStab=true,allowFoodPoison=true,version=91,allowFlu=false,mechanical:boolean|MechanoidKind=false):string|null {
  const mechanicalKind=mechanical===true?'scyther':isMechanoidKind(mechanical)?mechanical:undefined;
  if(mechanical){allowHeat=false;allowCold=false;allowInfection=false;allowMalnutrition=false;allowFoodPoison=false;allowFlu=false;}
  const species=object(value)&&isAnimalSpecies(value.body)?value.body:undefined;
  const fail='Invalid medical record';
  if(!validCoveredInFirefoamField290(value,version))return fail;
  if(!validMedicalCivilHeader271(value,version,!mechanical&&(!animal||isSchema277OrLater(version))))return fail;
  if(!validAlcoholHeader265(value,version,!animal&&!mechanical))return fail;
  if(!validScariaRecord261(value,version,animal))return fail;
  if(!validHumanHealthScaleHeader256(value,version,!animal&&!mechanical))return fail;
  const clinicalAnimal=animal&&species&&(isAnimalSpecies256(species)||object(value)&&Object.hasOwn(value,'animalGrowth'));
  if(!validCryptosleepSicknessHeader256(value,version,!!mechanical)||!validToxicBuildupHeader256(value,version,!!mechanical))return fail;
  if(!validAnimalGrowthMedicalHeader256(value,version,!!animal&&!!species))return fail;
  if(clinicalAnimal&&(!object(value)||version<256||!integer(value.tick)||!Number.isSafeInteger(value.animalBirthTick)||Number(value.animalBirthTick)>value.tick||!Number.isSafeInteger(value.tick-Number(value.animalBirthTick))))return fail;
  const model=mechanicalKind?mechanoidBodyModel(mechanicalKind):animal&&species?medicalModel({body:species,tick:Number((value as Record<string,unknown>).tick),animalBirthTick:(value as Record<string,unknown>).animalBirthTick as number,animalGrowth:(value as Record<string,unknown>).animalGrowth as number}):medicalModel({humanHealthScale:object(value)?value.humanHealthScale as number:undefined}),BODY_PARTS=model.byId,PART_INJURY_RULES=injuryPartRules(model);
  const bodyPartExists=(id:unknown)=>modelHasPart(model,id);
  if(!object(value)||!keys(value,[...(isSchema271OrLater(version)&&!mechanical&&(!animal||isSchema277OrLater(version))?['civilTick271']:[]),...((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&animal?['scaria261']:[]),...(animal||mechanical?['body']:[]),...(clinicalAnimal&&version>=256?['animalBirthTick']:[]),...(animal&&species&&version>=256?['animalGrowth','animalAgeConditions']:[]),'tick','nextInjuryId','injuries','missing','bloodLoss','death',...((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))?['coveredInFirefoam290']:[]),...(isSchema265OrLater(version)&&!animal&&!mechanical?['alcohol']:[]),...(allowHeat?['heatstroke']:[]),...(allowCold?['hypothermia']:[]),...(allowInfection?['infections']:[]),...(allowMalnutrition?['malnutrition']:[]),...(allowFoodPoison?['foodPoisoning']:[]),...(version>=256&&!mechanical?['cryptosleepSickness','toxicBuildup',...(!animal?['animalAgeConditions','humanHealthScale']:[])]:[]),...(allowFlu&&!animal&&!mechanical?['flu']:[]),...(version>=207&&!animal&&!mechanical?['immuneDiseases']:[]),...(isParasites306(version)&&!animal&&!mechanical?['parasites306']:[]),...(isMechanites307(version)&&!animal&&!mechanical?['mechanites307']:[]),...(version>=138&&!animal&&!mechanical?['ageAilments']:[]),...(version>=179&&!mechanical&&(!animal||isSchema277OrLater(version))?['anesthetic']:[]),...(version>=210&&!animal&&!mechanical?['artificialParts']:[])])||!integer(value.tick)||!integer(value.nextInjuryId,1)||!integer(value.bloodLoss,0,mechanical?0:BLOOD_UNIT)||!Array.isArray(value.injuries)||!Array.isArray(value.missing))return fail;
  if(mechanical&&(!mechanicalKind||version<(mechanicalKind==='scyther'?194:197)||value.body!==mechanicalKind||animal))return fail;
  if(animal&&(!species||!isAnimalSpeciesInVersion(species,version)||version<91&&species!=='hare'||version<178&&species==='red-fox'))return fail;
  if(value.heatstroke!==undefined&&(!allowHeat||!integer(value.heatstroke,1,1_000_000_000)))return fail;
  if(value.hypothermia!==undefined&&(!allowCold||!integer(value.hypothermia,1,1_000_000_000)))return fail;
  if(value.malnutrition!==undefined&&(!allowMalnutrition||!integer(value.malnutrition,1,1_000_000_000)))return fail;
  if(!validFoodPoisoning(value.foodPoisoning,value.tick,allowFoodPoison,version)||animal&&object(value.foodPoisoning)&&value.foodPoisoning.cause==='dangerous-food')return fail;
  if(!validFlu(value as unknown as MedicalRecord,allowFlu&&!animal,version>=317)||!validImmuneDiseases(value.immuneDiseases,value as unknown as MedicalRecord,version)||!validParasites306(value.parasites306,version,Number(value.tick))||!validMechanites307(value.mechanites307,version,Number(value.tick)))return fail;
  if(!validAnesthetic(value.anesthetic,value.tick,version>=179&&!mechanical&&(!animal||isSchema277OrLater(version)),undefined,medicalCivilTick271(value as unknown as MedicalRecord),version))return fail;
  if(value.ageAilments!==undefined&&(!Array.isArray(value.ageAilments)||value.ageAilments.length<1||value.ageAilments.length>2||new Set(value.ageAilments).size!==value.ageAilments.length||value.ageAilments.some(a=>a!=='bad-back'&&a!=='frail')))return fail;
  const ids=new Set<number>();let total=0;
  for(const i of value.injuries) {
    if(!object(i)||!keys(i,['id','part','kind','severity','bornAt','scar','tended',...(allowInfection?['infection']:[])])||!integer(i.id,1,value.nextInjuryId-1)||ids.has(i.id)||
      !bodyPartExists(i.part)||BODY_PARTS[i.part].conceptual||typeof i.kind!=='string'||!Object.hasOwn(INJURY_RULES,i.kind)||version<193&&i.kind==='shredded'||i.kind==='frostbite'&&(!isSchema256Or257(version)||animal||!!mechanical||!Object.hasOwn(value,'humanHealthScale')||!object(i.scar)||i.scar.pain===undefined)||!allowGunshot&&i.kind==='gunshot'||!allowBite&&i.kind==='bite'||!allowBurn&&i.kind==='burn'||!allowStab&&i.kind==='stab'||i.kind==='execution-cut'&&(!animal||!allowExecution||Number(i.severity)>1000||i.scar!==undefined)||!integer(i.severity,1)||!integer(i.bornAt,0,value.tick)||
      i.tended!==undefined&&!integer(i.tended,0,1300))return fail;
    if(mechanical&&(i.tended!==undefined||i.scar!==undefined||i.infection!==undefined||i.kind==='execution-cut'))return fail;
    ids.add(i.id);total+=i.severity;if(!Number.isSafeInteger(total*100))return fail;
    if(i.scar!==undefined&&(!object(i.scar)||!keys(i.scar,['threshold','pain'])||i.kind==='bruise'||PART_INJURY_RULES[i.part].scarFactor===0||!integer(i.scar.threshold,1,i.severity)||
      PART_INJURY_RULES[i.part].delicate&&i.scar.pain===undefined||
      i.scar.pain!==undefined&&(![0,1,3,6].includes(i.scar.pain as number)||i.scar.threshold!==i.severity)))return fail;
  }
  // Initial generation may retain a nonFresh anatomical loss on the same
  // prospective animal/owner already admitted by its native clinical header.
  const animalNonFresh=version>=256&&animal&&(!!clinicalAnimal||Object.hasOwn(value,'animalAgeConditions'));
  for(const m of value.missing) {
    // An added shoulder replaces its direct biological clavicle too. This is
    // an owned synthetic-child marker, never permission to lose arbitrary
    // indestructible bones. The full AddedPart guard below checks the rest.
    const shoulderChild273=isSchema273OrLater(version)&&!animal&&!mechanical&&object(m)&&(m.part==='left-clavicle'||m.part==='right-clavicle')
      &&Object.getOwnPropertyDescriptor(m,'nonFresh')?.value===true&&Array.isArray(value.artificialParts)
      &&value.artificialParts.some(p=>object(p)&&p.kind==='prosthetic-arm'&&p.part===(m.part==='left-clavicle'?'left-shoulder':'right-shoulder')&&p.installedAt===m.bornAt);
    if(!object(m)||!keys(m,['part','bornAt','tended',...(version>=210&&!animal&&!mechanical||animalNonFresh?['nonFresh']:[])])||!bodyPartExists(m.part)||BODY_PARTS[m.part].parent===null||BODY_PARTS[m.part].conceptual||!BODY_PARTS[m.part].destroyable&&!shoulderChild273&&!(version>=256&&!mechanical&&(Object.hasOwn(value,'animalAgeConditions')||animalNonFresh)&&Object.getOwnPropertyDescriptor(m,'nonFresh')?.value===true)||!integer(m.bornAt,0,value.tick)||m.tended!==undefined&&(mechanical||m.tended!==true))return fail;
  }
  if(animal)for(const m of value.missing){const descriptor=Object.getOwnPropertyDescriptor(m,'nonFresh');if(descriptor&&(!animalNonFresh||!Object.hasOwn(descriptor,'value')||descriptor.enumerable!==true||descriptor.value!==true))return fail;}
  const record=value as unknown as MedicalRecord;
  if(!validAnimalAgeConditions256(value,version,animal,record.tick,model,record.missing))return fail;
  for(const [index,m] of record.missing.entries()) {
    if(record.missing.some((other,j)=>j!==index&&(isWithinPart(m.part,other.part,model)||isWithinPart(other.part,m.part,model)))||record.injuries.some(i=>isWithinPart(i.part,m.part,model)))return fail;
  }
  if(!validArtificialParts(record,version,!animal&&!mechanical)||!validInfections(record,model,allowInfection,allowBurn,allowStab,version))return fail;
  for(const i of record.injuries)if(BODY_PARTS[i.part].parent!==null&&remainingPartHealth(record,i.part)===0)return fail;
  if(value.death!==undefined&&(!object(value.death)||!keys(value.death,['tick','cause'])||value.death.tick!==medicalCivilTick271(record)||!(mechanical?['vital-failure','trauma','downed']:['blood-loss','vital-failure','trauma',...(version>=256?['toxic-buildup']:[]),...(isSchema256Or257(version)&&!animal&&Object.hasOwn(value,'humanHealthScale')?['heart-artery-blockage','heart-attack']:[]),...(animal?['downed',...((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))?['scaria']:[]),...(version>=256?['heart-artery-blockage','heart-attack']:[]),...(allowExecution?['execution']:[])]:[]),...(allowHeat?['heatstroke']:[]),...(allowCold?['hypothermia']:[]),...(allowInfection?['infection']:[]),...(allowMalnutrition?['malnutrition']:[]),...(allowFlu&&!animal?['flu']:[]),...(version>=207&&!animal?['malaria','plague',...(version>=309?['sleeping-sickness']:[])]:[])]).includes(value.death.cause as string)))return fail;
  const living:MedicalRecord={...createMedicalRecord(record.tick),...(record.coveredInFirefoam290?{coveredInFirefoam290:{...record.coveredInFirefoam290}}:{}),...record.civilTick271!==undefined?{civilTick271:record.civilTick271}:{},...record.humanHealthScale!==undefined?{humanHealthScale:record.humanHealthScale}:{},...(mechanicalKind?{body:mechanicalKind}:animal?{body:species as AnimalSpeciesId}:{}),...record.animalBirthTick!==undefined?{animalBirthTick:record.animalBirthTick}:{},...record.animalGrowth!==undefined?{animalGrowth:record.animalGrowth}:{},...record.animalAgeConditions?{animalAgeConditions:record.animalAgeConditions}:{},...record.alcohol?{alcohol:record.alcohol}:{},injuries:record.injuries,missing:record.missing,bloodLoss:record.bloodLoss,...record.heatstroke?{heatstroke:record.heatstroke}:{},...record.hypothermia?{hypothermia:record.hypothermia}:{},...record.infections?{infections:record.infections}:{},...record.malnutrition?{malnutrition:record.malnutrition}:{},...record.foodPoisoning?{foodPoisoning:record.foodPoisoning}:{},...record.cryptosleepSickness?{cryptosleepSickness:record.cryptosleepSickness}:{},...record.toxicBuildup?{toxicBuildup:{severity:record.toxicBuildup.severity,bornAt:record.toxicBuildup.bornAt,...record.toxicBuildup.vomit?{vomit:record.toxicBuildup.vomit}:{}}}:{},...record.flu?{flu:record.flu}:{},...record.immuneDiseases?{immuneDiseases:record.immuneDiseases}:{},...record.parasites306?{parasites306:record.parasites306}:{},...record.mechanites307?{mechanites307:record.mechanites307}:{},...record.ageAilments?{ageAilments:record.ageAilments}:{},...record.anesthetic?{anesthetic:record.anesthetic}:{},...record.artificialParts?{artificialParts:record.artificialParts}:{}};
  reconcileMedicalDeath(living);
  if(record.death?.cause==='execution'){
    // Hunting's historical finishing blow requires a downed animal. V309 also
    // slaughters a mobile owned animal: its terminal neck incision is retained,
    // except when at most one HP remains and a further cut could remove the neck.
    const slaughter=clinicalAnimal?version>=256&&!living.death&&validAnimalExecutionProof256(record):version>=220&&!living.death&&(record.injuries.some(i=>i.kind==='execution-cut'&&i.part==='neck'&&i.bornAt===record.tick)
      ||remainingPartHealth(record,'neck')<=HP_UNIT);
    return animal&&allowExecution&&(medicalStatus(living)==='downed'||slaughter)?null:fail;
  }
  if(record.death?.cause==='scaria')return (version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&animal&&!!record.scaria261&&record.scaria261.manhunterCore>0&&record.tick*10-record.scaria261.manhunterCore>300000&&!living.death?null:fail;
  if(record.death?.cause==='downed')return !living.death&&medicalStatus(living)==='downed'?null:fail;
  if(!!living.death!==!!record.death||living.death?.cause!==record.death?.cause)return fail;
  return null;
}
export const validateScytherMedicalRecord=(value:unknown,version=194):string|null=>
  validateMedicalRecord(value,true,true,false,false,false,false,false,false,true,true,false,version,false,true);
export const validateMechanoidMedicalRecord=(value:unknown,version:number,kind:MechanoidKind):string|null=>
  !isMechanoidKind(kind)?'Invalid mechanical body':validateMedicalRecord(value,true,true,false,false,false,false,false,false,true,true,false,version,false,kind);
