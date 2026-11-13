import {processToxicVomit256,toxicVomitEngagement256} from './toxic-vomit-256.ts';
import {processAlcoholVomit265} from './alcohol-vomit-265.ts';
import {cancelMelee} from './melee-state.ts';
import {cancelShooting} from './shooting-state.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import {assessMedical} from './injury-state.ts';
import {cryptosleepVomitChance256} from './cryptosleep-sickness-256.ts';
import {carrierOf} from './rescue-state.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {animalNutritionMax} from './animal-life.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import { exposeFoodPoisoningAtRecord,ingestionFoodPoison } from './food-poisoning.ts';
import { processFoodPoisoningVomit,processVomit,type FoodPoisonVomitContext } from './food-poisoning-runtime.ts';
import { fluVomitChance } from './flu-rules.ts';
import { immuneDiseaseVomitChance } from './immune-diseases-rules.ts';
import { createMedicalRecord } from './injury-state.ts';
import { healthRandom,reconcilePawnHealth } from './health.ts';
import { reconcileAnimalHealth } from './wildlife-health.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { addFilth } from './filth.ts';
import { canStandAt } from './furniture-travel.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { animalSpecies } from './animal-species.ts';
import type { MaterialPile,Pawn,World } from './types.ts';

/** Selected difficulty applies at ingestion, including animals. The historical
 * camp retains factor one; a new mechanism never pretends it is Adventure. */
export function ingestFoodRisk(w:World,p:Pawn|WildAnimal,food:Pick<MaterialPile,'item'|'foodPoison'>,human=true):void {
  if(w.schemaVersion<89)return;
  const cause=ingestionFoodPoison(food,human,w.gameProfile?.difficulty==='adventure-story'?.75:1,()=>healthRandom(w));
  if(!cause)return;
  p.health??=human?createMedicalRecord(w.tick):createAnimalMedicalRecord256(w,p as WildAnimal);
  p.health.foodPoisoning=exposeFoodPoisoningAtRecord(p.health,cause,food.item,w.tick);
  if(human)reconcilePawnHealth(w,p as Pawn);else reconcileAnimalHealth(w,p as WildAnimal);
  w.events.push({tick:w.tick,type:'need',message:`${human?(p as Pawn).name:animalSpecies((p as WildAnimal).species).label+' '+p.id} souffre d’une intoxication alimentaire.`});
  if(w.events.length>80)w.events.splice(0,w.events.length-80);
}
/** Captured movement finishes before a vomiting episode interrupts the job.
 * Carried material is released through the ordinary conservative mechanism. */
export function processPawnVomiting(w:World,p:Pawn):boolean {
  const state=p.health?.foodPoisoning,flu=p.health?.flu,malaria=p.health?.immuneDiseases?.malaria,crypto=p.health?.cryptosleepSickness,toxic=p.health?.toxicBuildup,alcohol=p.health?.alcohol;
  if((!state&&!flu&&!malaria&&!crypto&&!toxic&&!alcohol)||p.state==='dead')return false;
  const context:FoodPoisonVomitContext={
    awake:!['sleeping','downed'].includes(p.state)&&!p.stun,position:p,foodLevel:p.hunger,foodMax:100,
    random:()=>healthRandom(w),canStand:c=>canStandAt(w,c),deposit:c=>addFilth(w,c,'vomit'),
    start:()=>{if(p.moveCooldown>0)return false;if(alcohol)delete alcohol.vomit;interruptWork(w,p);p.path=[];p.state='idle';return true;},
  };
  const toxicContext:FoodPoisonVomitContext={...context,awake:!carrierOf(w,p.id)&&p.state!=='sleeping'&&!p.medicalSleep&&!p.stun&&!!p.health&&assessMedical(p.health).canBeAwake,start:()=>{if(p.moveCooldown>0)return false;const down=p.state==='downed';cancelMelee(p);cancelShooting(p);interruptWork(w,p);p.path=[];p.state=down?'downed':'idle';return true;}};
  if(toxic&&!toxicContext.awake&&p.health)cancelToxicVomit256(p.health);
  if(alcohol&&!toxicContext.awake){delete alcohol.vomit;delete alcohol.vomitRequestedAt;}
  // An active malaria episode keeps its owner; otherwise the historical
  // food poisoning/Flu order runs first, followed by malaria only if idle.
  const activeMalaria=!!malaria?.vomit;
  let chosen:ReturnType<typeof processVomit>|undefined;
  if((alcohol?.vomit||alcohol?.vomitRequestedAt!==undefined)&&p.health)chosen=processAlcoholVomit265(p.health,w.tick,p.id,toxicContext,toxicVomitEngagement256(p,w.tick));
  else if((toxic?.vomit||toxic?.vomitRequestedAt!==undefined)&&p.health)chosen=processToxicVomit256(p.health,w.tick,p.id,toxicContext,toxicVomitEngagement256(p,w.tick));
  else if(crypto?.vomit&&!carrierOf(w,p.id))chosen=processVomit(crypto,w.tick,p.id%60,context,cryptosleepVomitChance256(crypto));
  else if(activeMalaria)chosen=processVomit(malaria!,w.tick,p.id%60,context,immuneDiseaseVomitChance(malaria));
  else{
    const result=state?.vomit?processFoodPoisoningVomit(state,w.tick,p.id%60,context):
      flu?.vomit?processVomit(flu,w.tick,p.id%60,context,fluVomitChance(flu)):
      state?processFoodPoisoningVomit(state,w.tick,p.id%60,context):undefined;
    chosen=result?.active||!flu?result:processVomit(flu,w.tick,p.id%60,context,fluVomitChance(flu));
    if(!chosen?.active&&malaria)chosen=processVomit(malaria,w.tick,p.id%60,context,immuneDiseaseVomitChance(malaria));
  }
  if(!chosen?.active&&crypto&&!carrierOf(w,p.id))chosen=processVomit(crypto,w.tick,p.id%60,context,cryptosleepVomitChance256(crypto));
  if(toxic&&p.health?.toxicBuildup===toxic&&!toxic.severity&&!toxic.vomit&&!Object.hasOwn(toxic,'vomitRequestedAt'))delete p.health.toxicBuildup;
  if(crypto&&p.health?.cryptosleepSickness===crypto&&!crypto.remainingCore&&!crypto.vomit)delete p.health.cryptosleepSickness;
  // Evolution retains residual malaria while its physical episode is active.
  // Completing that episode can exhaust the final reason to keep the record.
  const diseases=p.health?.immuneDiseases;
  if(malaria&&diseases?.malaria===malaria&&!malaria.severity&&!malaria.immunity&&!malaria.vomit){
    delete diseases.malaria;if(!diseases.plague&&!diseases['sleeping-sickness'])delete p.health!.immuneDiseases;
  }
  if(!chosen)return false;
  if(toxic?.vomitRequestedAt!==undefined)return false;
  if(alcohol?.vomitRequestedAt!==undefined)return false;
  p.hunger=chosen.foodLevel;
  if(chosen.active){p.path=[];if(!['dead','downed','sleeping'].includes(p.state))p.state='idle';p.planCooldown=0;}
  return chosen.active;
}
export function processAnimalVomiting(w:World,a:WildAnimal):boolean {
  const state=a.health?.foodPoisoning,crypto=a.health?.cryptosleepSickness,toxic=a.health?.toxicBuildup;if((!state&&!crypto&&!toxic)||a.state==='dead')return false;
  const context:FoodPoisonVomitContext={
    awake:!['sleeping','downed'].includes(a.state)&&!a.stun,position:a,foodLevel:a.food,foodMax:a.growthTracker?animalNutritionMax(a):animalSpecies(a.species).nutrition,
    random:()=>healthRandom(w),canStand:c=>canStandAt(w,c),deposit:c=>addFilth(w,c,'vomit'),
    start:()=>{if(a.motion&&a.motion.end>w.tick||a.strike&&a.strike.untilCore>w.tick*10)return false;delete a.animalThermalRefuge288;a.path=[];delete a.meal;delete a.strike;delete a.retaliation;a.state='idle';return true;},
  };
  const toxicContext:FoodPoisonVomitContext={...context,awake:!animalCarrier(w,a.id)&&a.state!=='sleeping'&&!a.stun&&!!a.health&&assessMedical(a.health).canBeAwake,start:()=>{if(a.motion&&a.motion.end>w.tick||a.strike&&a.strike.untilCore>w.tick*10)return false;const down=a.state==='downed';delete a.animalThermalRefuge288;a.path=[];delete a.meal;delete a.strike;delete a.retaliation;a.state=down?'downed':'idle';return true;}};
  if(toxic&&!toxicContext.awake&&a.health)cancelToxicVomit256(a.health);
  let result=(toxic?.vomit||toxic?.vomitRequestedAt!==undefined)&&a.health?processToxicVomit256(a.health,w.tick,a.id,toxicContext,toxicVomitEngagement256(a,w.tick)):crypto?.vomit?processVomit(crypto,w.tick,a.id%60,context,cryptosleepVomitChance256(crypto)):state?processFoodPoisoningVomit(state,w.tick,a.id%60,context):undefined;
  if(!result?.active&&crypto&&!animalCarrier(w,a.id))result=processVomit(crypto,w.tick,a.id%60,context,cryptosleepVomitChance256(crypto));
  if(toxic&&a.health?.toxicBuildup===toxic&&!toxic.severity&&!toxic.vomit&&!Object.hasOwn(toxic,'vomitRequestedAt'))delete a.health.toxicBuildup;
  if(crypto&&a.health?.cryptosleepSickness===crypto&&!crypto.remainingCore&&!crypto.vomit)delete a.health.cryptosleepSickness;
  if(!result)return false;a.food=result.foodLevel;if(result.active)a.nextDecision=w.tick+1;return result.active;
}
