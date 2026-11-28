import {isSchema256Or257} from './schema-compatibility-257.ts';
import {nativeHumanBiologicalCore256,type NativeHumanIdentity256} from './native-human-identity-256.ts';
import {syncNativeHumanClinicalScale256} from './native-human-clinical-scale-256.ts';
import {ANIMAL_BIRTHDAY_KINDS_256,animalBirthdayChance256} from './animal-age-condition-data-256.ts';
import {tryApplyAnimalAgeCondition256} from './animal-birthday-application-256.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import {sendLetter352} from './letters-352.ts';
import {isColonist} from './affiliation.ts';
import { createMedicalRecord } from './injury-state.ts';
import { TICKS_PER_DAY, type Pawn, type World } from './types.ts';

/** Core's adult year spans sixty local days; Lisière's day has 6,000 ticks. */
export const HUMAN_YEAR_TICKS = 60 * TICKS_PER_DAY;
export const HUMAN_LIFE_EXPECTANCY = 80;
export interface HumanAge { biologicalTicks:number; chronologicalTicks:number }
export type HumanAgeAilment = 'bad-back' | 'frail';

/** The Core human age-generation curve after excluding child stages. The
 * integer-year approximation is sampled once per new actor, without advancing
 * the simulation's random stream. */
const AGE_WEIGHTS:readonly [number,number][] = [[18,100],[50,100],[60,30],[70,18],[80,10],[90,3],[100,0]];
const ageWeight=(age:number):number=>{
  for(let i=1;i<AGE_WEIGHTS.length;i++)if(age<=AGE_WEIGHTS[i]![0]){
    const [start,from]=AGE_WEIGHTS[i-1]!,[end,to]=AGE_WEIGHTS[i]!;
    return from+(to-from)*(age-start)/(end-start);
  }
  return 0;
};
const hash=(seed:number,id:number,salt:number):number=>{
  let value=(seed^Math.imul(id,0x9e3779b1)^salt)>>>0;
  value=Math.imul(value^(value>>>16),0x7feb352d);
  value=Math.imul(value^(value>>>15),0x846ca68b);
  return ((value^(value>>>16))>>>0)/0x100000000;
};
const TOTAL_ADULT_WEIGHT=Array.from({length:82},(_,i)=>ageWeight(i+18+.5)).reduce((a,b)=>a+b,0);
export function initialHumanAge(seed:number,id:number):HumanAge {
  let remaining=hash(seed,id,0x6a9e2c0d)*TOTAL_ADULT_WEIGHT;
  let years=18;
  for(;years<99;years++){const weight=ageWeight(years+.5);if(remaining<weight)break;remaining-=weight;}
  const ticks=Math.floor((years+hash(seed,id,0x469a832f))*HUMAN_YEAR_TICKS);
  return {biologicalTicks:ticks,chronologicalTicks:ticks};
}
/** Crashlanded's Colonist pawn kind always has a cryptosleep backstory in Core.
 * The site's starting year is 5500; other Lisière actor kinds do not claim
 * Core's pawn-kind-specific chronological-age distribution. */
export function crashlandedHumanAge(seed:number,id:number,age:HumanAge):HumanAge {
  const branch=hash(seed,id,0x29a5f6dc);
  const bounds:readonly [number,number]=branch<.7?[0,100]:branch<.95?[100,1000]:[1000,Math.max(1001,5500-2026-biologicalYears(age))];
  const years=bounds[0]+Math.floor(hash(seed,id,0x76b59a0e)*(bounds[1]-bounds[0]));
  return {...age,chronologicalTicks:age.biologicalTicks+years*HUMAN_YEAR_TICKS};
}
/** Old characters had no recorded birth. This neutral adult baseline preserves
 * their work and health, and never rolls a retroactive birthday condition. */
export const legacyHumanAge=():HumanAge=>({biologicalTicks:30*HUMAN_YEAR_TICKS,chronologicalTicks:30*HUMAN_YEAR_TICKS});
export const biologicalYears=(age:HumanAge):number=>Math.floor(age.biologicalTicks/HUMAN_YEAR_TICKS);
export const chronologicalYears=(age:HumanAge):number=>Math.floor(age.chronologicalTicks/HUMAN_YEAR_TICKS);

const interpolated=(ageFraction:number,points:readonly [number,number][]):number=>{
  if(ageFraction<=points[0]![0])return points[0]![1];
  for(let i=1;i<points.length;i++)if(ageFraction<points[i]![0]){
    const [a,b]=points[i-1]!,[c,d]=points[i]!;
    return b+(d-b)*(ageFraction-a)/(c-a);
  }
  return points.at(-1)![1];
};
const BAD_BACK_CHANCE:readonly [number,number][]=[[.5,0],[.625,.0093],[.75,.01395],[.875,.01395],[1,.0186]];
const FRAIL_CHANCE:readonly [number,number][]=[[.625,0],[.75,.01395],[.875,.02604]];
const IMMUNITY_BY_AGE:readonly [number,number][]=[[.65,1],[.8,.95],[1,.9],[1.2,.8],[1.5,.5]];
const AILMENT_CHANCES=[['bad-back',BAD_BACK_CHANCE],['frail',FRAIL_CHANCE]] as const;
const ageRandom=(world:World):number=>{let n=world.rng;n^=n<<13;n^=n>>>17;n^=n<<5;world.rng=n>>>0;return world.rng/0x100000000;};
export const humanAgeImmunityFactor=(age:HumanAge|undefined):number=>
  age?interpolated(biologicalYears(age)/HUMAN_LIFE_EXPECTANCY,IMMUNITY_BY_AGE):1;

/** Core generates old-age injuries for pre-existing years at actor creation.
 * This birthday replay is local to the identity and never consumes world RNG. */
export function initialHumanAilments(seed:number,id:number,age:HumanAge):HumanAgeAilment[] {
  const found:HumanAgeAilment[]=[];
  for(let year=41;year<biologicalYears(age);year++)for(let i=0;i<AILMENT_CHANCES.length;i++){
    const [kind,points]=AILMENT_CHANCES[i]!;
    if(found.includes(kind))continue;
    const chance=interpolated(year/HUMAN_LIFE_EXPECTANCY,points);
    if(chance>0&&hash(seed,id,Math.imul(year,0x51ed270b)^(i?0x18c39a6d:0x9e3779b9))<chance)found.push(kind);
  }
  return found;
}

export interface HumanAgeContext {tick:number;schemaVersion:number;random():number;notice(message:string):void;notifyBirthday?:boolean;world?:World;birthdayNotice?(message:string):void}
function nativeBirthday382(pawn:Pawn,years:number,c:HumanAgeContext):void {
  const record=pawn.health;
  if(!record||record.humanHealthScale===undefined)throw Error('Native birthday lacks its actual clinical record');
  const random=animalClinicalRandom256(c.random),fraction=Math.fround(Math.fround(years)/Math.fround(HUMAN_LIFE_EXPECTANCY)),added:string[]=[];
  for(const kind of ANIMAL_BIRTHDAY_KINDS_256){
    if(!(random.value()<animalBirthdayChance256(kind,fraction)))continue;
    const result=tryApplyAnimalAgeCondition256(record,kind,random);
    if(result.status==='blocked')throw Error('Native human birthday anatomy is unavailable');
    if(result.status==='applied'){
      for(const condition of result.added)condition.bornAt=c.tick-((record.civilTick271??record.tick)-record.tick);
      added.push(kind);
    }
  }
  if(added.length&&isColonist(pawn)){
    const message=`${pawn.name} : ${years} ans, nouvelles affections : ${added.join(', ')}.`;
    if(c.world)sendLetter352(c.world,{cls:'negative',title:`Anniversaire : ${pawn.name}`,text:message,targets:[{kind:'actor',id:pawn.id}]});
    else if(c.birthdayNotice)c.birthdayNotice(message);
    else if(c.notifyBirthday)c.notice(message);
  }
}
function birthdayAt(pawn:Pawn,years:number,c:HumanAgeContext):void {
  const fraction=years/HUMAN_LIFE_EXPECTANCY;
  const ailments=pawn.health?.ageAilments??[];
  for(const [kind,points] of AILMENT_CHANCES){
    if(ailments.includes(kind))continue;
    const chance=interpolated(fraction,points);
    if(chance<=0||c.random()>=chance)continue;
    const health=pawn.health??=createMedicalRecord(c.tick);
    (health.ageAilments??=[]).push(kind);
    const label=kind==='bad-back'?'un mal de dos chronique':'une fragilité générale';
    c.notice(`${pawn.name} développe ${label} à ${years} ans.`);
  }
}

/** One biological tick per living actor and world tick. Chronological age also
 * follows the world clock after death, just as Core derives it from birth time. */
export function advanceHumanAges(world:World):void {
  if(world.schemaVersion<138)return;
  for(const pawn of world.pawns)advanceHumanAge(world,pawn);
}
/** The same confirmed-clock rule also serves a retained off-map person. */
export function advanceHumanAge(world:World,pawn:Pawn):void {
  advanceHumanAgeAt(pawn,{tick:world.tick,schemaVersion:world.schemaVersion,random:()=>ageRandom(world),notice:message=>{
    world.events.push({tick:world.tick,type:'need',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);
  },world});
}
export function advanceHumanAgeAt(pawn:Pawn,c:HumanAgeContext):void {
  if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))return;
  if(c.schemaVersion<138)return;
    const age=pawn.age;if(!age)return;
    let nativeBirthday:number|undefined,nativeAfter:number|undefined;
    if(pawn.nativeHuman&&pawn.state!=='dead'&&!pawn.health?.death){
      const before=nativeHumanBiologicalCore256(pawn),after=before+10;
      if(c.schemaVersion<382&&pawn.health?.animalAgeConditions?.cases.some(c=>c.kind==='Alzheimers'))throw Error('Actual native Human Alzheimer memory/conditional-thought owner is not bound');
      if(!Number.isSafeInteger(after))throw Error('Native biological age exhausted');
      nativeAfter=after;
      if(Math.floor(before/3600000)!==Math.floor(after/3600000)){
        if(c.schemaVersion<382)throw Error('Actual native Human living birthday/notification frontier is not bound; historical birthdayAt is not a substitute');
        nativeBirthday=Math.floor(after/3600000);
      }
    }
    if(age.chronologicalTicks<Number.MAX_SAFE_INTEGER)age.chronologicalTicks++;
    if(pawn.state==='dead'||age.biologicalTicks>=Number.MAX_SAFE_INTEGER)return;
    age.biologicalTicks++;
    if(pawn.nativeHuman){syncNativeHumanClinicalScale256(pawn,nativeAfter??nativeHumanBiologicalCore256(pawn));if(nativeBirthday!==undefined)nativeBirthday382(pawn,nativeBirthday,c);}
    else if(age.biologicalTicks%HUMAN_YEAR_TICKS===0)birthdayAt(pawn,biologicalYears(age),c);
}

export function validHumanAge(value:unknown,version:number,native?:NativeHumanIdentity256):boolean {
  if(native&&!isSchema256Or257(version))return false;
  if(version<138)return value===undefined;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const age=value as Record<string,unknown>;
  return Object.keys(age).length===2&&Object.hasOwn(age,'biologicalTicks')&&Object.hasOwn(age,'chronologicalTicks')&&
    Number.isSafeInteger(age.biologicalTicks)&&Number(age.biologicalTicks)>=(native?13:18)*HUMAN_YEAR_TICKS&&
    Number.isSafeInteger(age.chronologicalTicks)&&Number(age.chronologicalTicks)>=Number(age.biologicalTicks);
}
