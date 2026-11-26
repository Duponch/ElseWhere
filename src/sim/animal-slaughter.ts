import {clearReleaseForSlaughter364} from './execute-release-364.ts';
import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {planAnimalDeathExplosion256,isExplosiveAnimal256} from './animal-death-explosion-v256.ts';
import {animalExecutionPart256} from './animal-execution-v256.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { isColonist } from './affiliation.ts';
import { backgroundWorkRefusal,violentWorkRefusal } from './colonist-backgrounds.ts';
import { animalClaimed } from './animal-rest-state.ts';
import { animalBodySize } from './animal-life.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import { roundYield } from './cooking-statistics.ts';
import { addFilth } from './filth.ts';
import type { AnimalHandlingTask, DomesticCommand } from './domestic-state.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { healthRandom } from './health.ts';
import { addResolvedInjury,remainingPartHealth } from './injury-state.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { meleeContact } from './melee-space.ts';
import type { NeedContext } from './needs.ts';
import { routeToJob,type Reachability } from './pathfinding.ts';
import { reconcileAnimalHealth } from './wildlife-health.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { workPriority } from './work-types.ts';
import { releaseWork } from './work-release.ts';
import type { Cell,CommandResult,Pawn,World } from './types.ts';

/** Core JobDriver_Slaughter waits 180 ticks: eighteen on the local clock. */
export const SLAUGHTER_WORK_TICKS=18;
export type SlaughterTask=AnimalHandlingTask&{kind:'slaughter';phase:'approach'|'interact'};
export interface SlaughterProposal {task:SlaughterTask;path:Cell[];target:Cell}
/** Cardinal contact needs no terrain census; only diagonal flanks need it. */
export function slaughterContact(world:World,a:Cell,b:Cell):boolean {
  const dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);
  return dx<=1&&dz<=1&&(!dx||!dz||meleeContact(world,a,b));
}

export function slaughterHandlerAvailable(pawn:Pawn):boolean {
  return isColonist(pawn)&&(workPriority(pawn,'handle')>0||pawn.animalHandling?.forced378===true&&!backgroundWorkRefusal(pawn,'handle'))&&!violentWorkRefusal(pawn)
    &&!pawn.draft&&!pawn.mental?.crisis&&!pawn.flee&&!pawn.burning&&!pawn.stun&&!pawn.interruptedCargo&&!medicalWorkRefusal(pawn)
    &&pawnBody(pawn).capacities.moving>0&&pawnBody(pawn).capacities.manipulation>0;
}
export function slaughterTargetAvailable(world:World,animal:WildAnimal,exceptPawn?:Pawn,targets?:ReadonlySet<number>):boolean {
  return (!exceptPawn||allowedAreaAllows(world,exceptPawn,animal))&&slaughterIntent(world,animal,world.schemaVersion,targets)&&animal.state!=='dead'&&!animal.health?.death
    &&!animal.manhunter&&!animal.burning&&!animal.flee&&!animal.threat&&!animal.retaliation&&!animal.strike&&!animal.stun
    &&!(animal.health?.foodPoisoning?.vomit||animal.health?.cryptosleepSickness?.vomit||animal.health?.toxicBuildup?.vomit||animal.health?.toxicBuildup?.vomitRequestedAt!==undefined)
    &&!animalClaimed(world,animal.id,exceptPawn?.id);
}
export function slaughterHolding(world:World,pawn:Pawn,animal:WildAnimal):boolean {
  return world.schemaVersion>=220&&pawn.animalHandling?.kind==='slaughter'&&pawn.animalHandling.animalId===animal.id
    &&pawn.animalHandling.phase==='interact'&&slaughterHandlerAvailable(pawn)&&slaughterTargetAvailable(world,animal,pawn)
    &&pawn.moveCooldown===0&&(pawn.motion?.end??0)<=world.tick&&(animal.motion?.end??0)<=world.tick
    &&slaughterContact(world,pawn,animal);
}
export function slaughterWanted(world:World,pawn:Pawn):boolean {
  if(world.schemaVersion<220||!slaughterHandlerAvailable(pawn))return false;
  const targets=autoSlaughterTargets(world);
  return !!world.wildlife?.animals.some(a=>allowedAreaAllows(world,pawn,a)&&slaughterTargetAvailable(world,a,undefined,targets));
}
export function slaughterProposal(world:World,pawn:Pawn,reach:Reachability,animalId?:number):SlaughterProposal|undefined {
  if(world.schemaVersion<220||!slaughterHandlerAvailable(pawn))return;
  const targets=autoSlaughterTargets(world);
  const animals=(world.wildlife?.animals??[]).filter(a=>(animalId===undefined||a.id===animalId)&&allowedAreaAllows(world,pawn,a)&&slaughterTargetAvailable(world,a,animalId===undefined?undefined:pawn,targets))
    .sort((a,b)=>(a.x-pawn.x)**2+(a.z-pawn.z)**2-((b.x-pawn.x)**2+(b.z-pawn.z)**2)||a.id-b.id);
  for(const animal of animals){
    const path=slaughterContact(world,pawn,animal)?[]:routeToJob(world,animal,reach,false);if(!path)continue;
    return {task:{animalId:animal.id,kind:'slaughter',phase:'approach',sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0},path,target:animal};
  }
}
export function startSlaughter(pawn:Pawn,proposal:SlaughterProposal):void {
  pawn.animalHandling=proposal.task;pawn.path=proposal.path;pawn.state=proposal.path.length?'moving':'working';pawn.planCooldown=0;
}
export function slaughterRefusal(world:World,animal:WildAnimal|undefined):string|undefined {
  return world.schemaVersion<220?'L’abattage est indisponible dans cette version.'
    :!animal||animal.state==='dead'||animal.health?.death?'Animal vivant introuvable.'
    :!animal.domestic?'Seul un animal possédé peut être abattu.':undefined;
}
export function designateSlaughter(world:World,command:Extract<DomesticCommand,{type:'slaughter'}>):CommandResult {
  const invalid=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!Number.isSafeInteger(command.animalId)||typeof command.enabled!=='boolean')return invalid('Ordre d’abattage invalide.');
  const animal=world.wildlife?.animals.find(a=>a.id===command.animalId),reason=slaughterRefusal(world,animal);
  if(reason)return invalid(reason);
  if(!command.enabled){
    delete animal!.domestic!.slaughter;
    if(!slaughterIntent(world,animal!))for(const pawn of world.pawns)if(pawn.animalHandling?.kind==='slaughter'&&pawn.animalHandling.animalId===animal!.id)interruptWork(world,pawn);
  } else {animal!.domestic!.slaughter=true;if(world.schemaVersion>=364)clearReleaseForSlaughter364(world,animal!);}
  for(const pawn of world.pawns)pawn.planCooldown=0;
  return {ok:true};
}
export function processSlaughter(world:World,pawn:Pawn,task:SlaughterTask,context:NeedContext):void {
  const animal=world.wildlife?.animals.find(a=>a.id===task.animalId);
  if(world.schemaVersion<220||!animal||!slaughterHandlerAvailable(pawn)||!slaughterTargetAvailable(world,animal,pawn)){
    interruptWork(world,pawn);return;
  }
  if(!slaughterContact(world,pawn,animal)||(pawn.motion?.end??0)>world.tick||(animal.motion?.end??0)>world.tick||pawn.moveCooldown>0){
    task.phase='approach';task.progress=0;
    if(!slaughterContact(world,pawn,animal))context.move(animal,false);
    else {pawn.path=[];pawn.state=(pawn.motion?.end??0)>world.tick?'moving':'idle';}
    return;
  }
  releaseAnimalThermalRefuge288(world,animal);task.phase='interact';pawn.path=[];pawn.state='working';
  if(++task.progress<SLAUGHTER_WORK_TICKS)return;
  const record=animal.health?(world.schemaVersion>=256&&isExplosiveAnimal256(animal.species)?structuredClone(animal.health):animal.health):createAnimalMedicalRecord256(world,animal);
  const random={rng:world.rng},part=animalExecutionPart256(record,()=>healthRandom(random));
  const remaining=remainingPartHealth(record,part),damage=Math.min(1000,Math.max(0,Math.floor(remaining)-1000));
  const blood=Math.max(1,roundYield(animalBodySize(animal)*8,()=>healthRandom(random)));
  if(damage>0)addResolvedInjury(record,part,'execution-cut',damage,()=>healthRandom(random));
  if(!record.death)record.death={tick:world.tick,cause:'execution'};
  const death=planAnimalDeathExplosion256(world,animal,record);death.commit();
  animal.health=record;world.rng=random.rng;delete animal.domestic!.slaughter;
  reconcileAnimalHealth(world,animal);
  // Local filth uses layers at the contact cell and spills only to its eight
  // neighbors. A refused deposit never blocks or reverses the clinical death.
  if(blood>0)addFilth(world,animal,'blood',blood);
  context.event(`${pawn.name} a abattu l’animal ${animal.id}.`);
  if(!releaseWork(world,pawn))interruptWork(world,pawn);
}
