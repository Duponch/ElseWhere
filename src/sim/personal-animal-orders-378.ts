import {isColonist} from './affiliation.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {handlingProposal,handlingSkill,startHandling,tameRefusal,TAME_COOLDOWN} from './animal-handling.ts';
import {animalClaimed} from './animal-rest-state.ts';
import {slaughterProposal,slaughterRefusal,startSlaughter} from './animal-slaughter.ts';
import {slaughterIntent} from './auto-slaughter.ts';
import {backgroundWorkRefusal,violentWorkRefusal} from './colonist-backgrounds.ts';
import {equippedWeapon,isRangedWeaponItem} from './equipment-rules.ts';
import {medicalWorkRefusal,pawnBody} from './health-rules.ts';
import {huntingProposal} from './hunting.ts';
import {mentalCrisisRefusal} from './mental-presentation.ts';
import {blockedCells,reachableCells,routeToJob} from './pathfinding.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {carrierOf} from './rescue-state.ts';
import {clearReleasedPawnAssignments259,planCommandDrops,releaseWork,type DropPlan} from './work-release.ts';
import {workPriority} from './work-types.ts';
import type {Cell,CommandResult,Pawn,World} from './types.ts';
import type {PersonalAnimalAction378,PersonalAnimalOrderCommand378} from './personal-animal-order-state-378.ts';

export {isForcedPersonalAnimalOrder378} from './personal-animal-order-state-378.ts';
export type {PersonalAnimalAction378,PersonalAnimalOrderCommand378} from './personal-animal-order-state-378.ts';
export interface PersonalAnimalOrderOption378 {
  jobId:0;animalId:number;animalAction:PersonalAnimalAction378;label:string;enabled:boolean;reason?:string;
}
const labels:Readonly<Record<PersonalAnimalAction378,string>>={hunt:'Prioriser la chasse',tame:"Prioriser l'apprivoisement",slaughter:"Prioriser l'abattage"};
const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
type HuntingProposal=NonNullable<ReturnType<typeof huntingProposal>>;
type HandlingProposal=NonNullable<ReturnType<typeof handlingProposal>>;
type SlaughterProposal=NonNullable<ReturnType<typeof slaughterProposal>>;
type Proposal={kind:'hunt';value:HuntingProposal}|{kind:'tame';value:HandlingProposal}|{kind:'slaughter';value:SlaughterProposal};
type Plan={reason:string}|{pawn:Pawn;drops:DropPlan;proposal:Proposal};

/** Admission reads a private post-release actor and the existing planned
 * drops. The actual owners, routes, animal and food stay untouched until all
 * eligibility and route checks have succeeded. */
function afterRelease(world:World,pawn:Pawn,drops:DropPlan):{world:World;pawn:Pawn} {
  const actor={...pawn,orders:{active:null,queue:[]},recreation:{...pawn.recreation}};
  // The real coupled/party notifier runs only on commit. This private own
  // record has no pair or event side effects and grants no simulation work.
  delete actor.coupleTask285;
  clearReleasedPawnAssignments259(actor);
  const view={...world,pawns:world.pawns.map(p=>p.id===pawn.id?actor:p),
    piles:world.piles.map(p=>drops.has(p.id)?{...p,owner:{type:'ground' as const,...drops.get(p.id)!}}:p),
    packed:world.packed.map(p=>drops.has(p.building.id)?{...p,owner:{type:'ground' as const,...drops.get(p.building.id)!}}:p)};
  return {world:view,pawn:actor};
}
function plan(world:World,command:PersonalAnimalOrderCommand378):Plan {
  if(Number(world.schemaVersion)<378)return {reason:'Cet ordre personnel est indisponible dans cette version.'};
  if(!Number.isSafeInteger(command.pawnId)||!Number.isSafeInteger(command.animalId)||typeof command.queue!=='boolean'
    ||!Object.hasOwn(labels,command.action))return {reason:'Ordre personnel animal invalide.'};
  const pawn=world.pawns.find(p=>p.id===command.pawnId),animal=world.wildlife?.animals.find(a=>a.id===command.animalId);
  if(!pawn)return {reason:'Colon introuvable.'};
  if(!isColonist(pawn)||pawn.prisoner)return {reason:'Seul un colon libre peut recevoir un ordre de travail.'};
  const medical=medicalWorkRefusal(pawn);if(medical)return {reason:medical};
  if(carrierOf(world,pawn.id))return {reason:'Ce colon est transporté.'};
  if(pawn.mental?.crisis)return {reason:mentalCrisisRefusal(pawn)??'Ce colon traverse une crise.'};
  if(pawn.draft)return {reason:"Démobilisez ce colon avant de lui confier ce travail."};
  if(pawn.flee||pawn.burning||pawn.stun)return {reason:'Ce colon doit sortir du danger avant de travailler.'};
  if(pawn.interruptedCargo)return {reason:"Ce colon doit d'abord déposer sa cargaison interrompue."};
  if(pawn.collapsePending||world.restRules==='legacy'&&pawn.rest===0)return {reason:'Ce colon doit récupérer de son épuisement.'};
  const work=command.action==='hunt'?'hunt':'handle',background=backgroundWorkRefusal(pawn,work)
    ??(command.action==='slaughter'?violentWorkRefusal(pawn):undefined);
  if(background)return {reason:background};
  if(!workPriority(pawn,work))return {reason:'Ce travail est désactivé dans le tableau Travail.'};
  const capacities=pawnBody(pawn).capacities;
  if(capacities.moving<=0)return {reason:'Ce colon ne peut pas se déplacer pour ce travail.'};
  if(!animal||animal.state==='dead'||animal.health?.death)return {reason:'Animal vivant introuvable.'};
  const area=allowedAreaReason(world,pawn,animal);if(area)return {reason:area};
  if(animalClaimed(world,animal.id,pawn.id))return {reason:'Cet animal est réservé par un autre travailleur.'};
  if(command.action==='hunt'){
    if(animal.domestic)return {reason:'Un animal domestique allié ne peut pas être chassé.'};
    if(!world.hunting?.targets.includes(animal.id))return {reason:"Cet animal n'est pas désigné pour la chasse."};
    if(pawn.hunting?.animalId===animal.id)return {reason:'Ce colon chasse déjà cet animal.'};
    const weapon=equippedWeapon(world,pawn);
    if(!weapon||weapon.item==='emp-launcher'||!isRangedWeaponItem(weapon.item))return {reason:'Une arme de chasse à distance est nécessaire.'};
  } else if(command.action==='tame'){
    const refusal=tameRefusal(world,animal);if(refusal)return {reason:refusal};
    if(!animal.taming?.designated)return {reason:"Cet animal n'est pas désigné pour l'apprivoisement."};
    if(pawn.animalHandling?.animalId===animal.id&&pawn.animalHandling.kind==='tame')return {reason:'Ce colon apprivoise déjà cet animal.'};
    if((pawn.skills.animals?.level??0)<handlingSkill(animal.species))return {reason:`Animaux ${handlingSkill(animal.species)} nécessaire pour apprivoiser cet animal.`};
    if(world.tick-(animal.taming.lastAttempt??-TAME_COOLDOWN)<TAME_COOLDOWN)return {reason:"Une tentative d'apprivoisement a eu lieu trop récemment."};
    if(capacities.talking<=0||capacities.hearing<=0)return {reason:'Ce colon doit pouvoir parler et entendre cet animal.'};
    if(['downed','sleeping','eating'].includes(animal.state))return {reason:"Cet animal n'est pas disponible pour une interaction."};
  } else {
    const refusal=slaughterRefusal(world,animal);if(refusal)return {reason:refusal};
    if(!slaughterIntent(world,animal))return {reason:"Cet animal n'est pas désigné pour l'abattage."};
    if(pawn.animalHandling?.animalId===animal.id&&pawn.animalHandling.kind==='slaughter')return {reason:'Ce colon abat déjà cet animal.'};
  }
  const drops=planCommandDrops(world,{type:'clear-orders',pawnId:pawn.id});
  if(!drops)return {reason:"Pas de place pour déposer la cargaison avant ce travail."};
  const view=afterRelease(world,pawn,drops),reach=reachableCells(view.world,view.pawn,blockedCells(view.world),new Set());
  if(command.action==='hunt'){
    const value=huntingProposal(view.world,view.pawn,reach,animal.id);
    return value?{pawn,drops,proposal:{kind:'hunt',value}}:{reason:'Aucune position de chasse accessible avec cette arme.'};
  }
  if(command.action==='tame'){
    if(!routeToJob(view.world,animal,reach,false))return {reason:'Aucun accès praticable à cet animal.'};
    const value=handlingProposal(view.world,view.pawn,reach,animal.id);
    return value?.task.kind==='tame'?{pawn,drops,proposal:{kind:'tame',value}}:{reason:"Aucune nourriture adaptée, libre et accessible pour les deux repas d'apprivoisement, ou animal indisponible."};
  }
  const value=slaughterProposal(view.world,view.pawn,reach,animal.id);
  return value?{pawn,drops,proposal:{kind:'slaughter',value}}:{reason:"Animal indisponible ou aucun accès praticable pour l'abattage."};
}

/** Full, read-only admission used both by the menu and by the general FIFO. */
export function personalAnimalOrderReason378(world:World,command:PersonalAnimalOrderCommand378):string|undefined {
  const result=plan(world,command);return 'reason' in result?result.reason:undefined;
}
export function queryPersonalAnimalOrderOptions378(world:World,pawnId:number,cell:Cell,queue=false):PersonalAnimalOrderOption378[] {
  if(Number(world.schemaVersion)<378||!world.pawns.some(p=>p.id===pawnId&&isColonist(p)&&!p.prisoner))return [];
  const options:PersonalAnimalOrderOption378[]=[];
  for(const animal of world.wildlife?.animals??[]){
    if(animal.x!==cell.x||animal.z!==cell.z||animal.state==='dead')continue;
    const actions:PersonalAnimalAction378[]=[];
    if(world.hunting?.targets.includes(animal.id))actions.push('hunt');
    if(animal.taming?.designated)actions.push('tame');
    if(slaughterIntent(world,animal))actions.push('slaughter');
    for(const action of actions){
      const reason=personalAnimalOrderReason378(world,{type:'order-animal-378',pawnId,animalId:animal.id,action,queue});
      options.push({jobId:0,animalId:animal.id,animalAction:action,label:labels[action],enabled:!reason,...reason?{reason}:{}});
    }
  }
  return options;
}
/** The general queue calls this direct entry when its head is activated. */
export function applyPersonalAnimalOrder378(world:World,command:PersonalAnimalOrderCommand378):CommandResult {
  if(command.queue)return fail('La mise en file doit passer par la file générale des ordres.');
  const result=plan(world,command);if('reason' in result)return fail(result.reason);
  const {pawn,drops,proposal}=result;
  if(!releaseWork(world,pawn,drops))return fail("Impossible d'interrompre ce travail.");
  clearQueuedOrders(world,pawn);delete pawn.priorityWork;
  proposal.value.task.forced378=true;
  if(proposal.kind==='hunt'){
    pawn.hunting=proposal.value.task;pawn.path=proposal.value.path;pawn.state=pawn.path.length||pawn.moveCooldown>0?'moving':'working';pawn.planCooldown=0;
  } else if(proposal.kind==='tame')startHandling(pawn,proposal.value,world);
  else startSlaughter(pawn,proposal.value);
  world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : ${labels[command.action]}.`});
  if(world.events.length>80)world.events.shift();
  return {ok:true};
}
