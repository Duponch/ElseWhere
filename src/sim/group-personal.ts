import {superImmune361} from './traits.ts';
import {medicalCivilTick271,medicalElapsedTicks271} from './suspended-human-clock-271.ts';
import {isSchema263OrLater,isSchema282OrLater} from '../sim/schema-compatibility-257.ts';
import {cancelAlcoholSpatial265} from './alcohol-state-265.ts';
import {advanceOffmapThermal259} from './offmap-thermal-259.ts';
import {humanConditionMedicalFrontier256} from './human-condition-frontier-256.ts';
import {commitToxicDeath256} from './toxic-buildup-256.ts';
import type { GroupState } from './group-state.ts';
import type {MedicalContext} from './injury-types.ts';
import type { Pawn } from './types.ts';
import { advanceMedical } from './injury-evolution.ts';
import { createMedicalRecord,medicalStatus } from './injury-state.ts';
import { pawnBody } from './health-rules.ts';
import { malnutritionRate } from './malnutrition.ts';
import { advanceHumanAgeAt,humanAgeImmunityFactor } from './human-age.ts';
import { tickSkillsAt } from './skills.ts';
import { expireMealMemoriesAt,personalMoodThoughts,updateMoodFromThoughts,moodFrozen,type PersonalMoodContext } from './mood.ts';
import { updateRecreation } from './recreation-rules.ts';
import { expireSocialMemories } from './social-state.ts';
import { hasMentalBreak,expireMentalCatharsisAt } from './mental-state.ts';
import { depletedHumanHunger,groupRestAfterInterval } from './human-need-rates.ts';

type ActiveGroup=Extract<GroupState,{members:unknown}>;
export interface GroupPersonalContext {
  tick:number;schemaVersion:number;seed:number;
  /** Actual current caravan tile; never a former map or fallback temperature. */
  ambientTemperature259?:number;
  seedFor?(person:Pawn):number;
  clinicalRestFor256?(person:Pawn):Pick<MedicalContext,'posture'|'restingBonus'|'bedHealPerDay'|'bedImmunityFactor'>;
  /** Only a validated prospective travel owner delegates meters to Core150. */
  deferNeedMeters256?:true;
  legacyFood:boolean;legacyRest:boolean;
  /** Captured from the real group before this pass. No old map job/state/bed lookup. */
  resting:boolean;
  infectionChanceFactor:number;
  /** One actual owner/wealth capture for the phase, without a former map room. */
  mood:Pick<PersonalMoodContext,'people'|'expectation'|'difficultyMood'>;
  joyToleranceFall:number;
  random():number;
  lostThoughts?(person:Pawn):readonly import('./mood.ts').MoodThought[];
  notice(person:Pawn,message:string):void;
}
export interface GroupPersonalResult {deceased:Pawn[];incapableIds:number[]}
/** Called once AFTER the local people pass. Root initializes lastPersonalTick
 * at actual departure and reserves terminal storage before that departure.
 * Root's fatal-tick barrier preserves the last confirmed publication/save;
 * it does not roll back a failed in-progress World or its RNG mutations. */
export function advanceGroupPersonal(group:ActiveGroup,c:GroupPersonalContext):GroupPersonalResult|null {
  if(c.deferNeedMeters256&&c.schemaVersion<256)throw Error('Future caravan needs cadence');
  if(group.lastPersonalTick===c.tick)return null;
  if(group.lastPersonalTick!==c.tick-1||!Number.isSafeInteger(c.tick)||c.tick<1||!group.members.length||new Set(group.members.map(p=>p.id)).size!==group.members.length||group.members.some(p=>p.state==='dead'||p.health?.death))throw Error('Invalid group personal frontier');
  const deceased:Pawn[]=[],incapableIds:number[]=[];
  // Stored group order is persisted: a local deterministic adaptation, not a
  // claim about WorldPawns' individual order. No reordering during this pass.
  for(const p of group.members){
    const healthBefore=p.health;
    // Preserve the local personal ordering and its birthday draw sequence.
    // A birthday may create a dossier AT this tick; that dossier owes zero clinical ticks.
    advanceHumanAgeAt(p,{tick:c.tick,schemaVersion:c.schemaVersion,random:c.random,notice:message=>c.notice(p,message)});
    if(c.schemaVersion>=84&&p.hunger<=0)p.health??=createMedicalRecord(group.lastPersonalTick);
    if(p.health){
      cancelAlcoholSpatial265(p.health);
      if(p.health.body||medicalCivilTick271(p.health)!==group.lastPersonalTick&&!(healthBefore===undefined&&medicalCivilTick271(p.health)===c.tick))throw Error('Invalid human clinical frontier');
      const firstInfection=p.health.infections?.nextId??1;
      const conditionFrontier=humanConditionMedicalFrontier256(p,p.health,c.tick,c.random,{kind:'caravan'});
      advanceMedical(p.health,medicalElapsedTicks271(p.health,c.tick),{civilTick:c.tick,phase:p.id%60,alcoholOwner:{id:p.id,spawned:false,awake:p.state!=='sleeping',inMentalState:!!p.mental?.crisis},toxicOwner:{id:p.id,spawned:false,awake:p.state!=='sleeping'},cryptosleepSicknessSpawned:false,posture:c.resting?'ground':'standing',starving:p.hunger<=0,
        malnutritionRate:malnutritionRate(p.id),infectionChanceFactor:c.infectionChanceFactor,hunger:p.hunger,rest:p.rest,
        restingBonus:c.resting&&p.state!=='downed',infectionSeed:((c.seedFor?.(p)??c.seed)^Math.imul(p.id,0x9e3779b1))>>>0,
        ageImmunityFactor:humanAgeImmunityFactor(p.age),...superImmune361(p),...c.deferNeedMeters256?c.clinicalRestFor256?.(p):{}},c.random,conditionFrontier);conditionFrontier?.commit();
      for(const infection of p.health.infections?.cases??[])if(infection.id>=firstInfection)c.notice(p,`${p.name} souffre d’une infection.`);
    }
    if(c.schemaVersion===259||c.schemaVersion===260||(c.schemaVersion===261||(Number(c.schemaVersion)===262||isSchema263OrLater(Number(c.schemaVersion)))))advanceOffmapThermal259(p,group.items,c.tick*10,c.ambientTemperature259!,()=>createMedicalRecord(c.tick));
    if(p.health?.death){commitToxicDeath256(p.health,c.random);
        // Terminal validation uses the death tick, including expirations that
        // were still valid at the previous living frontier. No age or XP now.
        p.state='dead';expireMealMemoriesAt(p,c.tick);expireSocialMemories(p,c.tick);expireMentalCatharsisAt(p,c.tick);
        deceased.push(p);continue;
    }
    // Exact extracted kernels. Positive/negative disabled XP and existing
    // historical birthdays/memories keep their rules and single World RNG.
    tickSkillsAt(p,c.tick);
    expireMealMemoriesAt(p,c.tick);
    expireSocialMemories(p,c.tick);
    expireMentalCatharsisAt(p,c.tick);
    const body=pawnBody(p),status=p.health?medicalStatus(p.health,body):'mobile';
    if(status==='dead'){p.state='dead';deceased.push(p);continue;}
    if(status==='downed'){p.state='downed';incapableIds.push(p.id);}
    else if(!hasMentalBreak(p))p.state=c.resting?'resting':'idle';
    // This bounded owner does not admit new spatial crisis jobs or accumulate
    // map exposure for replay on return. Existing personal thoughts still act.
    if(!c.deferNeedMeters256){p.hunger=depletedHumanHunger(p,c.legacyFood);p.rest=groupRestAfterInterval(p,c.resting,c.legacyRest);}
    if(p.mental?.cooldown&&!c.resting&&p.state!=='downed'&&!moodFrozen(p,body))p.mental.cooldown--;
    if(!c.deferNeedMeters256)updateRecreation(p,body,c.joyToleranceFall);
    updateMoodFromThoughts(p,personalMoodThoughts(p,{...c.mood,...isSchema282OrLater(c.schemaVersion)?{ambientTemperature460:c.ambientTemperature259}:{},lost:c.lostThoughts?.(p),tick:c.tick,items:group.items}),body);
  }
  // Death leaves immediately for Root's terminal owner at health.death.tick.
  // No terminal mutation, dose, route or ingestion can follow this result.
  group.lastPersonalTick=c.tick;
  return {deceased,incapableIds};
}
