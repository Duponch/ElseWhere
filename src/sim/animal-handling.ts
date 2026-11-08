import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
// Scaria remains a real illness even after actual ClearMind.

import {tameHiveInsect256} from './cave-hive-lifecycle-256.ts';
import {startingPetFourNoTamenessDecay256} from './starting-pet-four-tameness-256.ts';
import {animalHandlingSkill256,tameWildnessFactor256,animalHandlingFood256,PEN_ANIMALS_256} from './animal-domestic-v256.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { isColonist } from './affiliation.ts';
import { animalSpecies } from './animal-species.ts';
import { animalNutritionMax } from './animal-life.ts';
import type { AnimalHandlingTask, DomesticCommand } from './domestic-state.ts';
import { ingestFoodRisk } from './food-hygiene.ts';
import { healthRandom } from './health.ts';
import { cancelHunting } from './hunting-state.ts';
import { medicalWorkRefusal, pawnBody } from './health-rules.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { reservedSource } from './materials.ts';
import type { NeedContext } from './needs.ts';
import { adjacent, routeToJob, type Reachability } from './pathfinding.ts';
import { copyPileCondition } from './pile-condition.ts';
import { learnSkill } from './skills.ts';
import { TICKS_PER_DAY, type Cell, type CommandResult, type Pawn, type World } from './types.ts';
import { animalBody } from './wildlife-health.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { releaseWork } from './work-release.ts';
import { leadingClaimIds,processLeading, type LeadingTask } from './animal-leading.ts';
import { processProduct, productHandlerAvailable, productKind, type ProductTask } from './animal-products.ts';
import { processSlaughter,slaughterHolding,type SlaughterTask } from './animal-slaughter.ts';
import { animalClaimed } from './animal-rest-state.ts';
import {advanceAnimalTraining282} from './animal-training-282.ts';
import {interruptAnimalHaul282} from './animal-hauling-282.ts';
import {animalTrainingLesson282,animalTrainingFood282,animalTrainingFeedUnits282,processAnimalTraining282,type AnimalTrainingTask282} from './animal-training-service-282.ts';

/** Core's 60,000-tick day is represented by 6,000 local ticks. */
export const TAME_COOLDOWN = TICKS_PER_DAY / 2;
export const TRAIN_COOLDOWN = TICKS_PER_DAY / 4;
export const TAMENESS_DECAY = TICKS_PER_DAY * 7.5;
export const MIN_HANDLING = 8;
export const handlingSkill = (species:WildAnimal['species']):number => animalHandlingSkill256(species)??(species==='dromedary'?2:species==='muffalo'?6:8);
export const canTameSpecies = (species:WildAnimal['species']):boolean => isAnimalSpecies256(species)||['hare','deer','gazelle','muffalo','dromedary'].includes(species);
const TALK_TICKS = 27;
const FINAL_TAME_TICKS = 35;
const FINAL_TRAIN_TICKS = 10;
const FOOD:ReadonlySet<ItemId> = new Set(['berries','rice','potato','corn','agave-fruit']);
/** Core interaction accepts foods through RawTasty, including Hay and Kibble.
 * All five local tameable species eat plants; both new foods have .05 nutrition. */
export const handlingFoodAllowed=(w:Pick<World,'schemaVersion'>,item:ItemId,a?:WildAnimal):boolean=>a&&w.schemaVersion>=256&&isAnimalSpecies256(a.species)?animalHandlingFood256(a,item)===true:FOOD.has(item)||w.schemaVersion>=227&&(item==='hay'||item==='kibble');
/** Core's collection group excludes pure Plant food even when it is a pile. */
export const handlingFoodCollectable=(w:Pick<World,'schemaVersion'>,item:ItemId,a?:WildAnimal):boolean=>a&&w.schemaVersion>=256&&isAnimalSpecies256(a.species)?animalHandlingFood256(a,item)===true:FOOD.has(item)||w.schemaVersion>=227&&item==='kibble';
export const handlingFeedUnits=(species:WildAnimal['species'],item:ItemId='berries'):number=>Math.max(1,Math.ceil(Math.min(.15*animalSpecies(species).nutrition,.3)/(isAnimalSpecies256(species)?ITEM_DEFINITIONS[item].nutrition/100:.05)));
const MAX_TAMENESS = 5;
/** All explicitly supported interaction foods have 0.05 nutrition per unit. */
export const HANDLING_FEED_TICKS=Math.ceil(TALK_TICKS*(ITEM_DEFINITIONS.berries.nutrition*10)/30);
export function handlingStepDuration(task:Pick<AnimalHandlingTask,'kind'|'step'>,species:WildAnimal['species']='hare'):number {
  const feedNutrition=Math.round(Math.min(.15*animalSpecies(species).nutrition,.3)*1000);
  return task.step===2||task.step===4?Math.ceil(TALK_TICKS*(ITEM_DEFINITIONS.berries.nutrition*10)/feedNutrition)
    :task.step===5?task.kind==='tame'?FINAL_TAME_TICKS:FINAL_TRAIN_TICKS:TALK_TICKS;
}

function animalAvailable(a:WildAnimal):boolean {
  return canTameSpecies(a.species)&&!['dead','downed','sleeping','eating'].includes(a.state)
    &&!a.manhunter&&!a.confusion&&!a.stun&&!a.burning&&!a.flee&&!(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined);
}
function handlerAvailable(p:Pawn):boolean {
  const body=pawnBody(p).capacities;
  return isColonist(p)&&workPriority(p,'handle')>0&&!p.draft&&!p.mental?.crisis&&!p.flee&&!p.interruptedCargo
    &&!medicalWorkRefusal(p)&&body.talking>0&&body.hearing>0&&body.manipulation>0;
}
function trainableAt(w:World,a:WildAnimal):boolean {
  return !a.training&&!startingPetFourNoTamenessDecay256(a.species)&&(a.species==='hare'||w.schemaVersion>=256&&isAnimalSpecies256(a.species)&&!PEN_ANIMALS_256.includes(a.species))&&!!a.domestic&&a.domestic.tameness<MAX_TAMENESS
    &&w.tick-(a.domestic.lastTraining??a.domestic.since)>=TRAIN_COOLDOWN;
}
function tameableAt(w:World,a:WildAnimal,p:Pawn):boolean {
  return !!a.taming?.designated&&!a.domestic&&(p.skills.animals?.level??0)>=handlingSkill(a.species)
    &&w.tick-(a.taming.lastAttempt??-TAME_COOLDOWN)>=TAME_COOLDOWN;
}
export function animalHandlingClaimed(w:World,id:number):boolean {
  return animalClaimed(w,id);
}
/** Only physical contact freezes wildlife movement, not a distant reservation. */
export function animalHandlingHolding(w:World,id:number):boolean {
  // Both holds below need a pawn handling this very animal id: without one,
  // the answer is false, without looking the animal up among all wildlife.
  if(!w.pawns.some(p=>p.animalHandling?.animalId===id))return false;
  const a=w.wildlife?.animals.find(a=>a.id===id);
  if(a&&w.pawns.some(p=>slaughterHolding(w,p,a)))return true;
  if(!a||!animalAvailable(a)||(a.motion?.end??0)>w.tick)return false;
  return w.pawns.some(p=>p.animalHandling?.animalId===id&&p.animalHandling.kind!=='lead'&&p.animalHandling.kind!=='slaughter'&&p.animalHandling.phase==='interact'
    &&allowedAreaAllows(w,p,a)&&p.moveCooldown===0&&adjacent(p,a)
    &&((p.animalHandling.kind==='milk'||p.animalHandling.kind==='shear')?productHandlerAvailable(p):handlerAvailable(p)));
}
export function handlingWanted(w:World,p:Pawn):boolean {
  if(!handlerAvailable(p))return false;
  return !!w.wildlife?.animals.some(a=>allowedAreaAllows(w,p,a)&&animalAvailable(a)&&!animalHandlingClaimed(w,a.id)
    &&(animalTrainingLesson282(w,p,a)!==undefined||trainableAt(w,a)||tameableAt(w,a,p)));
}
export interface HandlingProposal { task:AnimalHandlingTask; path:Cell[]; target:Cell }
export function handlingProposal(w:World,p:Pawn,reach:Reachability):HandlingProposal|undefined {
  if(!handlingWanted(w,p))return;
  const animals=w.wildlife!.animals.filter(a=>allowedAreaAllows(w,p,a)&&animalAvailable(a)&&!animalHandlingClaimed(w,a.id)
    &&(animalTrainingLesson282(w,p,a)!==undefined||trainableAt(w,a)||tameableAt(w,a,p)))
    .sort((a,b)=>(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.id-b.id);
  const sources=w.piles.filter(i=>i.kind==='food'&&eggAllowedForPlayer256(i)&&(w.schemaVersion>=256||handlingFoodCollectable(w,i.item))&&i.owner.type==='ground'&&allowedAreaAllows(w,p,i.owner))
    .sort((a,b)=>(a.owner.type==='ground'?(a.owner.x-p.x)**2+(a.owner.z-p.z)**2:Infinity)
      -(b.owner.type==='ground'?(b.owner.x-p.x)**2+(b.owner.z-p.z)**2:Infinity)||a.id-b.id);
  for(const a of animals) {
    const trainable=animalTrainingLesson282(w,p,a);

    // An inaccessible animal must not reserve food, a worker or its attempt.
    if(!routeToJob(w,a,reach,false))continue;
    for(const pile of sources) {
    if(pile.owner.type!=='ground'||!(trainable?!pile.forbidden&&animalTrainingFood282(a,pile.item):handlingFoodCollectable(w,pile.item,a)))continue;
    const feedUnits=trainable?animalTrainingFeedUnits282(a,pile.item):handlingFeedUnits(a.species,pile.item),feeds=feedUnits*2;
    if(pile.quantity-reservedSource(w,pile.id)<feeds)continue;
    const path=routeToJob(w,pile.owner,reach,true);if(!path)continue;
    return {task:{animalId:a.id,kind:trainable?'train':a.domestic?'maintain':'tame',...(trainable?{trainable,feedUnits}:{}),sourcePileId:pile.id,carryPileId:null,
      quantity:feeds,phase:'pickup',step:0,progress:0},path,target:pile.owner};
    }
  }
}
export function startHandling(p:Pawn,proposal:HandlingProposal,w?:World):void {
  if(proposal.task.kind==='train'){
    const a=w?.wildlife?.animals.find(a=>a.id===proposal.task.animalId);
    if(!w||!a||animalTrainingLesson282(w,p,a)!==proposal.task.trainable)return;
    // Admission alone revokes a physical haul. A failed Near drop keeps the
    // original cargo in holding while this distinct human service proceeds.
    if(a.haul&&a.haul.phase!=='holding')interruptAnimalHaul282(w,a);
  }
  p.animalHandling=proposal.task;p.path=proposal.path;p.state=proposal.path.length?'moving':'working';p.planCooldown=0;
}
export function tameRefusal(_w:World,a:WildAnimal|undefined):string|undefined {
  return !a||a.state==='dead'?'Animal vivant introuvable.'
    :a.health?.scaria261?'Cet animal souffre de scaria et ne peut pas être apprivoisé.'
    :a.manhunter?'Cet animal est en rage.'
    :!canTameSpecies(a.species)||_w.schemaVersion<256&&isAnimalSpecies256(a.species)?'Cette espèce n’est pas apprivoisable ici.'
    :a.domestic?'Cet animal appartient déjà à la colonie.':undefined;
}
export function applyTaming(w:World,cmd:Extract<DomesticCommand,{type:'tame'}>):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  const a=w.wildlife?.animals.find(a=>a.id===cmd.animalId);
  if(!Number.isSafeInteger(cmd.animalId)||typeof cmd.enabled!=='boolean')return fail('Ordre d’apprivoisement invalide.');
  const refusal=tameRefusal(w,a);if(refusal)return fail(refusal);
  if(!a)return fail('Animal vivant introuvable.');
  if(cmd.enabled) {
    if(!a.taming)a.taming={designated:true};else a.taming.designated=true;
  } else {
    const worker=w.pawns.find(p=>p.animalHandling&&leadingClaimIds(p.animalHandling).includes(a.id));
    if(worker&&!releaseWork(w,worker))return fail('Impossible de déposer la nourriture portée.');
    if(a.taming)a.taming.designated=false;
  }
  for(const p of w.pawns)p.planCooldown=0;
  return {ok:true};
}
function capacityFactor(value:number,weight:number,allowedDefect:number):number {
  return Math.max(0,Math.min(1,1-weight*(1-Math.max(allowedDefect,Math.min(1,value)))));
}
export function tameChance(p:Pawn):number {
  const c=pawnBody(p).capacities,level=p.skills.animals?.level??0;
  return Math.max(.01,(.04+.03*level)*.5
    *capacityFactor(c.talking,.9,.2)*capacityFactor(c.hearing,.3,.05)*capacityFactor(c.manipulation,.5,.2));
}
export function trainChance(p:Pawn):number {
  const c=pawnBody(p).capacities,level=p.skills.animals?.level??0;
  return Math.max(.01,(.10+.05*level)*.75
    *capacityFactor(c.talking,.7,.2)*capacityFactor(c.hearing,.3,.05)*capacityFactor(c.manipulation,.5,.2));
}
function stillValid(w:World,p:Pawn,a:WildAnimal,task:AnimalHandlingTask):boolean {
  return handlerAvailable(p)&&(p.skills.animals?.level??0)>=handlingSkill(a.species)&&animalAvailable(a)&&
    (task.kind==='tame'?!!a.taming?.designated&&!a.domestic:(!!a.domestic&&a.domestic.tameness<MAX_TAMENESS))
    &&!animalClaimed(w,a.id,p.id);
}
function carried(w:World,p:Pawn,task:AnimalHandlingTask) {
  return w.piles.find(i=>i.id===task.carryPileId&&i.owner.type==='pawn'&&i.owner.pawnId===p.id
    &&i.kind==='food'&&eggAllowedForPlayer256(i)&&handlingFoodAllowed(w,i.item,w.wildlife?.animals.find(a=>a.id===task.animalId))&&i.quantity===task.quantity);
}
function finish(w:World,p:Pawn,a:WildAnimal,task:AnimalHandlingTask,ctx:NeedContext):void {
  const skill=p.skills.animals;
  if(skill)learnSkill(skill,task.kind==='tame'?90_000:70_000,p);
  const success=healthRandom(w)<(task.kind==='tame'?tameChance(p)*tameWildnessFactor256(a.species):trainChance(p));
  if(task.kind==='tame') {
    if(success){if(isSchema287OrLater(w.schemaVersion)){delete a.animalThermalRefuge288;delete a.animalMapAreas287;delete a.animalAreaReturn287;}tameHiveInsect256(w,a);a.domestic={since:w.tick,care:'herbal',tameness:MAX_TAMENESS,nextDecay:w.tick+TAMENESS_DECAY,lastTraining:w.tick,...(productKind(a)?{productFullness:0}:{})};
      delete a.taming;delete a.flee;delete a.threat;delete a.retaliation;
      if(w.hunting)w.hunting.targets=w.hunting.targets.filter(id=>id!==a.id);
      for(const hunter of w.pawns)if(hunter.hunting?.animalId===a.id){cancelHunting(hunter);hunter.path=[];hunter.state='idle';hunter.planCooldown=0;}
      ctx.event(`${p.name} a apprivoisé ${animalSpecies(a.species).label} ${a.id}.`);
    } else ctx.event(`${p.name} n’a pas réussi à apprivoiser ${animalSpecies(a.species).label} ${a.id}.`);
  } else if(a.domestic) {
    if(success)a.domestic.tameness=Math.min(MAX_TAMENESS,a.domestic.tameness+1);
    ctx.event(`${p.name} ${success?'a entretenu':'n’a pas amélioré'} la familiarité de ${animalSpecies(a.species).label} ${a.id}.`);
  }
  if(!releaseWork(w,p))interruptWork(w,p);
}
interface HandlingContext extends NeedContext { candidates():Reachability|null; blocked():Uint8Array }
export function processHandling(w:World,p:Pawn,ctx:HandlingContext):void {
  if(!allowedAreaServicesAllowed(w,p)){interruptWork(w,p);return;}
  const task=p.animalHandling;if(!task)return;
  if(task.kind==='train'){processAnimalTraining282(w,p,task as AnimalTrainingTask282,ctx);return;}
  if(task.kind==='slaughter'){processSlaughter(w,p,task as SlaughterTask,ctx);return;}
  if(w.wildlife?.animals.some(a=>a.manhunter&&leadingClaimIds(task).includes(a.id))){interruptWork(w,p);return;}
  if(task.kind==='lead'){if(task.markerId===undefined){interruptWork(w,p);return;}processLeading(w,p,task as LeadingTask,ctx);return;}
  if(task.kind==='milk'||task.kind==='shear'){processProduct(w,p,task as ProductTask,ctx);return;}
  const a=w.wildlife?.animals.find(a=>a.id===task.animalId);
  if(!a||!stillValid(w,p,a,task)){interruptWork(w,p);return;}
  if(task.phase==='pickup') {
    const pile=w.piles.find(i=>i.id===task.sourcePileId);
    if(!pile||pile.owner.type!=='ground'||pile.kind!=='food'||!eggAllowedForPlayer256(pile)||!handlingFoodCollectable(w,pile.item,a)
      ||pile.quantity-reservedSource(w,pile.id,p.id)<task.quantity){interruptWork(w,p);return;}
    if(!adjacent(p,pile.owner)&&(p.x!==pile.owner.x||p.z!==pile.owner.z)){ctx.move(pile.owner,false);return;}
    if(pile.quantity===task.quantity){pile.owner={type:'pawn',pawnId:p.id};task.carryPileId=pile.id;}
    else {
      if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1)){interruptWork(w,p);return;}
      pile.quantity-=task.quantity;task.carryPileId=w.nextId++;
      w.piles.push({id:task.carryPileId,kind:'food',item:pile.item,quantity:task.quantity,
        owner:{type:'pawn',pawnId:p.id},...copyPileCondition(pile)});
    }
    task.phase='approach';p.path=[];p.state='moving';return;
  }
  const food=task.quantity>0?carried(w,p,task):undefined;
  if(task.quantity>0&&!food||task.quantity===0&&task.step!==5){interruptWork(w,p);return;}
  if(!adjacent(p,a)||(a.motion?.end??0)>w.tick||a.meal) {
    task.phase='approach';task.progress=0;
    if(!adjacent(p,a)){ctx.move(a,false);return;}
    p.path=[];p.state='idle';return;
  }
  releaseAnimalThermalRefuge288(w,a);task.phase='interact';p.path=[];p.state='working';
  if(task.kind==='tame'&&task.step===5&&task.progress===0&&a.taming
    &&(a.taming.lastAttempt===undefined||w.tick-a.taming.lastAttempt>=TAME_COOLDOWN))a.taming.lastAttempt=w.tick;
  if(task.kind==='maintain'&&task.step===5&&task.progress===0&&a.domestic
    &&w.tick-(a.domestic.lastTraining??a.domestic.since)>=TRAIN_COOLDOWN)a.domestic.lastTraining=w.tick;
  const feeding=task.step===2||task.step===4,final=task.step===5;
  const duration=handlingStepDuration(task,a.species);
  if(++task.progress<duration)return;
  task.progress=0;
  if(feeding) {
    const consumed=food!;
    const foodRisk={item:consumed.item,...consumed.foodPoison?{foodPoison:{...consumed.foodPoison}}:{}};
    const units=handlingFeedUnits(a.species,consumed.item);
    consumed.quantity-=units;task.quantity-=units;
    if(!consumed.quantity){w.piles.splice(w.piles.indexOf(consumed),1);task.carryPileId=null;}
    a.food=Math.min(animalNutritionMax(a),a.food+units*ITEM_DEFINITIONS[consumed.item].nutrition/100);
    ingestFoodRisk(w,a,foodRisk,false);
    if(a.state==='dead'||a.state==='downed'){interruptWork(w,p);return;}
  } else if(!final&&p.skills.animals)learnSkill(p.skills.animals,70_000,p);
  task.step++;
  if(task.step===6)finish(w,p,a,task,ctx);
}
/** Sparse caller: once per world tick, with no path or map scan. */
export function advanceTameness(w:World):void {
  for(const a of w.wildlife?.animals??[]) {
    if(a.training){advanceAnimalTraining282(w,a);continue;}
    const d=a.domestic;if(startingPetFourNoTamenessDecay256(a.species)||!d||!(a.species==='hare'||w.schemaVersion>=256&&isAnimalSpecies256(a.species)&&!PEN_ANIMALS_256.includes(a.species))||a.state==='dead'||w.tick<d.nextDecay)continue;
    while(a.domestic&&w.tick>=a.domestic.nextDecay) {
      a.domestic.tameness--;
      if(a.domestic.tameness<=0){if(isSchema287OrLater(w.schemaVersion)){delete a.animalThermalRefuge288;delete a.animalMapAreas287;delete a.animalAreaReturn287;}delete a.domestic;delete a.taming;break;}
      a.domestic.nextDecay+=TAMENESS_DECAY;
    }
  }
}
