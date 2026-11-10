import {assignPileOwner} from './pile-index.ts';
import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {isSchema282OrLater} from './schema-compatibility-257.ts';
import {nextTrainable282,completeAnimalTraining282} from './animal-training-282.ts';
import {ANIMAL_TRAINING_CONVERSATION_CORE_282,ANIMAL_TRAINING_FINAL_CORE_282,type AnimalTrainingSkill282} from './animal-training-state-282.ts';
import {animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import {CORE_ANIMAL_LIFE_STAGES_256} from './animal-core-data-v256.ts';
import {animalHandlingFood256,animalHandlingSkill256} from './animal-domestic-v256.ts';
import {animalNutritionMax} from './animal-life.ts';
import {animalClaimed} from './animal-rest-state.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {allowedAreaServicesAllowed} from './allowed-area-services.ts';
import {workPriority,effectiveSkillLevel} from './work-types.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {isColonist} from './affiliation.ts';
import {pawnBody,medicalWorkRefusal} from './health-rules.ts';
import {animalBody} from './wildlife-health.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {reservedSource} from './materials.ts';
import {adjacent} from './pathfinding.ts';
import {copyPileCondition} from './pile-condition.ts';
import {learnSkill} from './skills.ts';
import {healthRandom} from './health.ts';
import {ingestFoodRisk} from './food-hygiene.ts';
import {releaseWork} from './work-release.ts';
import {interruptWork} from './interrupted-cargo.ts';
import type {NeedContext} from './needs.ts';
import type {AnimalHandlingTask} from './domestic-state.ts';
import type {Pawn,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

export type AnimalTrainingTask282=AnimalHandlingTask&{kind:'train';trainable:AnimalTrainingSkill282;feedUnits:number};
export const ANIMAL_TRAINING_CHAT_TICKS_282=ANIMAL_TRAINING_CONVERSATION_CORE_282/10;
export const ANIMAL_TRAINING_FINAL_TICKS_282=ANIMAL_TRAINING_FINAL_CORE_282/10;
let feedUnitsCeiling282:number|undefined;
const maxFeedUnits282=()=>feedUnitsCeiling282??=Math.max(...Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='food'&&i.nutrition>0).map(i=>Math.ceil(.3/(i.nutrition/100))));

export function animalTrainingHandlerAvailable282(p:Pawn):boolean {
 const c=pawnBody(p).capacities;
 return isColonist(p)&&!p.prisoner&&!p.visitor&&!p.draft&&!p.mental?.crisis&&!p.flee&&!p.interruptedCargo
  &&workPriority(p,'handle')>0&&!backgroundWorkRefusal(p,'handle')&&!medicalWorkRefusal(p)&&c.talking>0&&c.hearing>0&&c.manipulation>0;
}
function available(a:WildAnimal,allowHaul=false):boolean {
 return !!a.domestic&&(allowHaul||!a.haul||a.haul.phase==='holding')&&!['dead','downed','sleeping','eating'].includes(a.state)&&!a.health?.death
  &&a.shipCryptosleepHeldAt277===undefined&&!a.exiting&&!a.flight&&!a.exitFlight&&animalBody(a).canBeAwake
  &&!a.manhunter&&!a.confusion&&!a.stun&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike
  &&!(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined);
}
/** The tracker selects and gates a real lesson. Assignment of wanted itself
 * does not require these prerequisites, a ready trainer, food or cooldown. */
export function animalTrainingLesson282(w:World,p:Pawn,a:WildAnimal):AnimalTrainingSkill282|undefined {
 if(!isSchema282OrLater(w.schemaVersion)||!a.training||!available(a,true)||!animalTrainingHandlerAvailable282(p)
  ||(p.skills.animals?.level??0)<(animalHandlingSkill256(a.species)??Infinity)||!allowedAreaAllows(w,p,a)||animalClaimed(w,a.id,p.id))return;
 return nextTrainable282(w,a);
}
export function animalTrainingFood282(a:WildAnimal,item:ItemId):boolean {
 return ITEM_DEFINITIONS[item].kind==='food'&&ITEM_DEFINITIONS[item].nutrition>0&&animalHandlingFood256(a,item)===true;
}
export function animalTrainingFeedUnits282(a:WildAnimal,item:ItemId):number {
 return Math.max(1,Math.ceil(Math.min(.15*animalNutritionMax(a),.3)/(ITEM_DEFINITIONS[item].nutrition/100)));
}
export function animalTrainingStepTicks282(task:Pick<AnimalTrainingTask282,'step'|'feedUnits'|'feedDuration'>,a:WildAnimal,item:ItemId):number {
 if(task.step===5)return ANIMAL_TRAINING_FINAL_TICKS_282;
 if(task.step!==2&&task.step!==4)return ANIMAL_TRAINING_CHAT_TICKS_282;
 if(task.feedDuration!==undefined)return task.feedDuration;
 const required=Math.min(.15*animalNutritionMax(a),.3);
 return Math.max(1,Math.ceil(ANIMAL_TRAINING_CHAT_TICKS_282*task.feedUnits*(ITEM_DEFINITIONS[item].nutrition/100)/required));
}
/** Scalar upper envelope from this species' declared stages. It does not
 * recreate a past actor or pretend the current stage was the admitted one. */
function maxFeedTicks282(a:WildAnimal,units:number,item:ItemId):number {
 if(!isAnimalSpecies256(a.species))return 27000;
 const def=animalCore256(a.species),minimum=def.stats.MaxNutrition*def.race.baseBodySize*Math.min(...def.lifeStages.map(stage=>{
  const s=CORE_ANIMAL_LIFE_STAGES_256[stage.defId];return s.bodySizeFactor*s.foodMaxFactor;
 }));
 return Math.max(1,Math.ceil(ANIMAL_TRAINING_CHAT_TICKS_282*units*(ITEM_DEFINITIONS[item].nutrition/100)/Math.min(.15*minimum,.3)));
}
const factor=(value:number,weight:number,defect:number)=>Math.max(0,Math.min(1,1-weight*(1-Math.max(defect,Math.min(1,value)))));
/** New trainable chance only. The historical maintenance .75 stays literal.
 * The real bonded starter is evidence of Bond; a new master is not a bond. */
export function animalTrainingChance282(p:Pawn,a:WildAnimal):number {
 if(!isAnimalSpecies256(a.species))return 0;
 const f=Math.fround,c=pawnBody(p).capacities,level=effectiveSkillLevel(p,'animals',p.skills.animals?.level??0);
 let stat=f(f(.10)+f(f(.05)*level));
 stat=f(stat*f(factor(c.talking,.7,.2)));stat=f(stat*f(factor(c.hearing,.3,.05)));stat=f(stat*f(factor(c.manipulation,.5,.2)));
 stat=Math.max(.01,stat);const wildness=animalCore256(a.species).stats.Wildness;
 let chance=f(stat*f(f(1.5)-f(wildness)));if(a.startingPet?.bondedPawnId===p.id)chance=f(chance*5);
 return Math.max(0,Math.min(1,chance));
}

/** Current local adaptation carries precisely two feed portions. Core can
 * preload four sessions in inventory; no such extra stock is invented here. */
export function processAnimalTraining282(w:World,p:Pawn,task:AnimalTrainingTask282,ctx:NeedContext):void {
 const a=w.wildlife?.animals.find(a=>a.id===task.animalId),stop=()=>{if(!releaseWork(w,p))interruptWork(w,p);};
 if(!a||!a.training||!available(a)||!animalTrainingHandlerAvailable282(p)||!allowedAreaServicesAllowed(w,p)
  ||animalClaimed(w,a.id,p.id)||(p.skills.animals?.level??0)<(animalHandlingSkill256(a.species)??Infinity)
  ||task.finalStartedCore===undefined&&nextTrainable282(w,a)!==task.trainable){stop();return;}
 if(task.phase==='pickup'){
  const source=w.piles.find(i=>i.id===task.sourcePileId);
  if(!source||source.owner.type!=='ground'||source.forbidden||!eggAllowedForPlayer256(source)||!animalTrainingFood282(a,source.item)
   ||source.quantity-reservedSource(w,source.id,p.id)<task.quantity){stop();return;}
  if(!adjacent(p,source.owner)&&(p.x!==source.owner.x||p.z!==source.owner.z)){ctx.move(source.owner,false);return;}
  if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
  if(source.quantity===task.quantity){assignPileOwner(source,{type:'pawn',pawnId:p.id});task.carryPileId=source.id;}
  else{
   if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1)){stop();return;}
   source.quantity-=task.quantity;task.carryPileId=w.nextId++;
   w.piles.push({id:task.carryPileId,kind:'food',item:source.item,quantity:task.quantity,owner:{type:'pawn',pawnId:p.id},...copyPileCondition(source)});
  }
  task.phase='approach';p.path=[];p.state='moving';return;
 }
 const food=task.quantity>0?w.piles.find(i=>i.id===task.carryPileId&&i.owner.type==='pawn'&&i.owner.pawnId===p.id&&i.quantity===task.quantity&&eggAllowedForPlayer256(i)&&animalTrainingFood282(a,i.item)):undefined;
 if(task.quantity>0&&!food||task.quantity===0&&task.step!==5){stop();return;}
 if(!adjacent(p,a)||(a.motion?.end??0)>w.tick||(p.motion?.end??0)>w.tick||p.moveCooldown>0||a.meal){
  if(task.phase==='interact'){stop();return;}
  if(!adjacent(p,a))ctx.move(a,false);else{p.path=[];p.state='idle';}return;
 }
 releaseAnimalThermalRefuge288(w,a);task.phase='interact';p.path=[];p.state='working';
 const feeding=task.step===2||task.step===4;
 if(feeding&&task.progress===0&&food){
  if(task.feedUnits<animalTrainingFeedUnits282(a,food.item)){stop();return;}
  task.feedDuration=animalTrainingStepTicks282(task,a,food.item);
 }
 if(task.progress===0&&(task.step===0||task.step===1||task.step===3)&&p.skills.animals)learnSkill(p.skills.animals,70_000,p);
 if(task.step===5&&task.finalStartedCore===undefined){
  if(p.skills.animals)learnSkill(p.skills.animals,70_000,p);
  // The existing medical stream is this clone's declared attempt RNG.
  const success=healthRandom(w)<animalTrainingChance282(p,a);
  if(!completeAnimalTraining282(w,a,task.trainable,success,p.id)){stop();return;}
  task.finalStartedCore=w.tick*10;
  ctx.event(`${p.name} ${success?'a réussi':'n’a pas réussi'} la leçon ${task.trainable==='haul'?'de transport':task.trainable==='obedience'?'d’obéissance':'d’apprivoisement'} de ${a.id}.`);
 }
 const duration=task.step===5?ANIMAL_TRAINING_FINAL_TICKS_282:feeding?animalTrainingStepTicks282(task,a,food!.item):ANIMAL_TRAINING_CHAT_TICKS_282;
 if(++task.progress<duration)return;
 task.progress=0;
 if(feeding){
  const consumed=food!,risk={item:consumed.item,...consumed.foodPoison?{foodPoison:{...consumed.foodPoison}}:{}};
  consumed.quantity-=task.feedUnits;task.quantity-=task.feedUnits;
  if(!consumed.quantity){w.piles.splice(w.piles.indexOf(consumed),1);task.carryPileId=null;}
  a.food=Math.min(animalNutritionMax(a),a.food+task.feedUnits*ITEM_DEFINITIONS[consumed.item].nutrition/100);
  ingestFoodRisk(w,a,risk,false);
  delete task.feedDuration;
  if(a.state==='dead'||a.state==='downed'){stop();return;}
 }
 if(++task.step===6)stop();
}

const ownData=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&Object.hasOwn(d,'value');};
/** New human job branch only; the outer domestic guard owns all historic
 * fields and cross-service exclusivity. Temporary hunger/danger is runtime. */
export function validAnimalTrainingService282(w:World,p:Pawn,version:number):boolean {
 const raw=p.animalHandling;if(!raw||raw.kind!=='train')return true;
 if(!isSchema282OrLater(version)||!isSchema282OrLater(w.schemaVersion)||Object.getPrototypeOf(raw)!==Object.prototype)return false;
 const required=['animalId','kind','sourcePileId','carryPileId','quantity','phase','step','progress','trainable','feedUnits'],allowed=[...required,'finalStartedCore','feedDuration'];
 if(required.some(k=>!ownData(raw,k))||Reflect.ownKeys(raw).some(k=>typeof k!=='string'||!allowed.includes(k)||!ownData(raw,k)))return false;
 const t=raw as AnimalTrainingTask282,a=w.wildlife?.animals.find(a=>a.id===t.animalId),int=(x:unknown,lo:number,hi=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&Number(x)>=lo&&Number(x)<=hi;
 const feedCeiling=maxFeedUnits282();
 if(p.surgery||p.trade||p.orbitalTrade||p.deepWork||p.brewing||p.cryptosleepTask||p.shipCasketTask277||p.allowedAreaReturn||p.raid||p.podRescue)return false;
 if(!a?.domestic||!a.training||!int(t.animalId,1,w.nextId-1)||!['tameness','obedience','haul'].includes(t.trainable)
  ||!['pickup','approach','interact'].includes(t.phase)||!int(t.sourcePileId,1,w.nextId-1)||!int(t.feedUnits,1,feedCeiling)
  ||!int(t.step,0,5)||!int(t.progress,0)||!int(t.quantity,0,feedCeiling*2)||t.quantity!==t.feedUnits*(t.step<3?2:t.step<5?1:0)
  ||t.phase==='pickup'&&(t.step!==0||t.progress!==0||t.carryPileId!==null)||t.phase==='approach'&&t.progress!==0)return false;
 if(Object.hasOwn(t,'finalStartedCore')){
  if(!int(t.finalStartedCore,a.training.sinceCore,w.tick*10)||Number(t.finalStartedCore)%10!==0||t.step!==5||t.phase!=='interact'||!int(t.progress,1,ANIMAL_TRAINING_FINAL_TICKS_282-1)||a.training.lastAttemptCore!==t.finalStartedCore)return false;
 }else if(t.step===5&&t.progress!==0)return false;
 const feeding=t.step===2||t.step===4;
 if(Object.hasOwn(t,'feedDuration')? !feeding||t.phase!=='interact'||t.progress===0||!int(t.feedDuration,1)||t.progress>=Number(t.feedDuration):feeding&&t.progress>0)return false;
 if(t.quantity===0)return t.step===5&&t.carryPileId===null&&!w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
 const food=w.piles.find(i=>i.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
 if(!food||!animalTrainingFood282(a,food.item)||t.feedUnits>Math.ceil(.3/(ITEM_DEFINITIONS[food.item].nutrition/100)))return false;
 if(feeding? t.feedDuration!==undefined&&t.feedDuration>maxFeedTicks282(a,t.feedUnits,food.item):t.progress>=animalTrainingStepTicks282(t,a,food.item))return false;
 return t.phase==='pickup'?t.carryPileId===null&&food.owner.type==='ground'&&reservedSource(w,food.id)<=food.quantity&&!w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)
  :int(t.carryPileId,1,w.nextId-1)&&food.owner.type==='pawn'&&food.owner.pawnId===p.id&&food.quantity===t.quantity&&!w.piles.some(i=>i!==food&&i.owner.type==='pawn'&&i.owner.pawnId===p.id);
}
