import {animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import {tutorialMode347} from './game-profile.ts';
import {actualAnimalProfile256} from './actual-animal-profile-256.ts';
import { animalBodySize,animalLifeStage } from './animal-life.ts';
import { freshMissing,partMissing } from './injury-state.ts';
import { medicalModel,animalPartBaseHp } from './body-model.ts';
import { HP_UNIT,injuryPartRules,isWithinPart } from './injury-rules.ts';
import type { World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';

export const PREDATION_MAX_CORE=5000;
/** Read-only biological projection; no navigation, reservations or random draw. */
export function animalSummaryHealth(a:WildAnimal):number {
  if(a.state==='dead'||a.health?.death)return 0;
  const record=a.health;if(!record)return 1;
  const model=medicalModel(record),rules=injuryPartRules(model);
  let result=1;
  for(const injury of record.injuries)if(injury.scar?.pain===undefined)
    result*=1-Math.min(injury.severity/HP_UNIT/(75*model.healthScale),.95);
  for(const missing of record.missing){
    if(!freshMissing(record,missing)||record.missing.some(parent=>parent!==missing&&isWithinPart(missing.part,parent.part,model)))continue;
    const part=model.byId[missing.part];
    if(!part.groups.length&&!model.parts.some(child=>child.parent===part.id)&&rules[part.id].bleed<=0)continue;
    result*=1-Math.min(animalPartBaseHp(a.species,part.id,a.growthTracker?.value)/(75*model.healthScale),.95);
  }
  return Math.max(.05,Math.min(1,result));
}

export function acceptableAnimalPrey(predator:WildAnimal,prey:WildAnimal):boolean {
  const p=actualAnimalProfile256(predator),t=actualAnimalProfile256(prey);
  if(isAnimalSpecies256(prey.species)&&!animalCore256(prey.species).race.canBePredatorPrey)return false;
  if(!p.predator||predator.domestic||predator.id===prey.id||['dead','downed'].includes(predator.state)
    ||prey.state==='dead'||animalBodySize(prey)>(p.maxPreySize??0)
    ||!p.melee.some(tool=>!predator.health||(tool.sourceParts??[tool.sourcePart]).some(part=>!partMissing(predator.health!,part))))return false;
  const health=animalSummaryHealth(predator);
  if(health<.25&&prey.state!=='downed')return false;
  if(prey.state!=='downed'&&(t.combatPower>2*p.combatPower
    ||t.combatPower*animalSummaryHealth(prey)*animalBodySize(prey)>=p.combatPower*health*animalBodySize(predator)))return false;
  // A wild predator has no faction. A player's animal is still possible prey.
  return true;
}
export function animalPreyScore(predator:WildAnimal,prey:WildAnimal):number {
  const health=Math.min(animalSummaryHealth(prey),prey.state==='downed'?.2:1);
  const stage=({baby:.2,juvenile:.5,adult:1} as const)[animalLifeStage(prey)];
  return -Math.hypot(prey.x-predator.x,prey.z-predator.z)
    -56*health*health*(actualAnimalProfile256(prey).combatPower/actualAnimalProfile256(predator).combatPower)*stage;
}
/** Biological order only. The caller filters contact places with one shared field. */
export function animalPreyCandidates(w:World,predator:WildAnimal):WildAnimal[] {
  // Core BestPawnToHuntForPredator: in tutorial mode the player's pawns are never prey.
  const tutorial=tutorialMode347(w);
  return (w.wildlife?.animals??[]).filter(prey=>acceptableAnimalPrey(predator,prey)&&!(tutorial&&prey.domestic))
    .sort((a,b)=>animalPreyScore(predator,b)-animalPreyScore(predator,a)||a.id-b.id);
}
/** Release the intention and its unstarted route, never the captured edge/recovery. */
export function cancelAnimalPredation(w:World,a:WildAnimal):void {
  if(!a.predation)return;
  delete a.predation;a.path=[];
  if(a.state==='moving'&&(a.motion?.end??0)<=w.tick)a.state='idle';
  a.nextDecision=Math.min(a.nextDecision,w.tick);
}
/** Dead retained actors and their same-ID corpse are transitions, not lost prey. */
export function animalPredationTarget(w:World,a:WildAnimal,core=w.tick*10):WildAnimal|undefined {
  const hunt=a.predation;if(!hunt)return;
  const target=w.wildlife?.animals.find(t=>t.id===hunt.targetId&&t.id!==a.id);
  if(!target||target.state==='dead'||core>hunt.startedAtCore+PREDATION_MAX_CORE&&(target.x-a.x)**2+(target.z-a.z)**2>4)return;
  return target;
}
export function reconcileAnimalPredation(w:World,a:WildAnimal,core=w.tick*10):void {
  const hunt=a.predation;if(!hunt)return;
  const target=w.wildlife?.animals.find(t=>t.id===hunt.targetId&&t.id!==a.id);
  const corpse=!target?w.piles.find(p=>p.id===hunt.targetId&&p.corpse?.animalId===hunt.targetId&&p.owner.type==='ground'):undefined;
  const cell=target??(corpse?.owner.type==='ground'?corpse.owner:undefined);
  if(!actualAnimalProfile256(a).predator||a.domestic||a.meal||a.burning||a.flee||['dead','downed'].includes(a.state)
    ||!cell||core>hunt.startedAtCore+PREDATION_MAX_CORE&&(cell.x-a.x)**2+(cell.z-a.z)**2>4)cancelAnimalPredation(w,a);
}
