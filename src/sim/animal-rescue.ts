import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import {claimLocalActorBed256,captureActorBeds256} from './actor-bed-local-256.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows,allowedAreaReason,releaseAllowedAreaReturn } from './allowed-area-state.ts';
import { isColonist,activeThreat,hostileTo } from './affiliation.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { workPriority } from './work-types.ts';
import { carrierOf } from './rescue-state.ts';
import { animalClaimed,releaseAnimalRescue,syncCarriedAnimals,type AnimalRescueTask } from './animal-rest-state.ts';
import { animalSpotAvailable,animalRestingSpot } from './animal-rest.ts';
import { veterinaryCareSpeciesAllowed } from './veterinary-rules.ts';
import { slaughterContact } from './animal-slaughter.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import { blockedCells,reachableCells,routeToCell,routeToJob,type Reachability } from './pathfinding.ts';
import { advanceAnimalHealth } from './wildlife-health.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,Pawn,Structure,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { structureById } from './structure-navigation.ts';

export interface AnimalRescueProposal {task:AnimalRescueTask;path:Cell[];target:WildAnimal}
export function animalRescueActorReady(w:World,p:Pawn):boolean {
  return w.schemaVersion>=221&&isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!p.draft&&!p.stun&&!p.burning&&!p.flee&&!p.mental?.crisis
    &&!p.collapsePending&&!(w.restRules==='legacy'&&p.rest===0)&&!carrierOf(w,p.id)&&!p.interruptedCargo
    &&!backgroundWorkRefusal(p,'doctor')&&workPriority(p,'doctor')>0&&!medicalWorkRefusal(p)&&pawnBody(p).capacities.moving>0
    &&!w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
}
function reason(w:World,p:Pawn,a:WildAnimal|undefined,direct=false,targets?:ReadonlySet<number>):string|undefined {
  if(!animalRescueActorReady(w,p))return 'Un colon libre et apte doit avoir Médecin activé.';
  if(!a||!w.wildlife?.animals.includes(a)||!a.domestic||!veterinaryCareSpeciesAllowed(a.species,w.schemaVersion,a)||a.state!=='downed'||a.health?.death||animalRestingSpot(w,a))return 'Cet animal possédé doit être à terre et hors couchage.';
  if(!direct&&p.animalRescue?.phase!=='carry'){const refusal=allowedAreaReason(w,p,a);if(refusal)return refusal;}
  if(direct&&a.domestic.care==='none')return 'Les soins de cet animal sont désactivés.';
  // A quota cannot revoke an existing physical rescue. Once deposited, however,
  // the selected patient must not repeatedly acquire a new rescue at that spot.
  // The explicit manual designation remains blocking even during carriage.
  if(a.domestic.slaughter||p.animalRescue?.animalId!==a.id&&slaughterIntent(w,a,w.schemaVersion,targets)
    ||a.manhunter||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.stun||(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined))return 'Le secours est suspendu par l’abattage ou le danger.';
  if(animalClaimed(w,a.id,p.id))return 'Un autre service a réservé cet animal.';
  return undefined;
}
function busy(p:Pawn):boolean {
  return !!(p.animalRescue||p.jobId!==null||p.need||p.haul||p.cooking||p.hunting||p.animalHandling||p.animalCare||p.animalFeed||p.rescue||p.feed||p.tend||p.surgery||p.ward||p.research||p.equipmentTask||p.burial||p.cleaning||p.firefighting||p.orbitalTrade||p.deepWork||p.trade||p.recreation.task||p.orders.active!==null||p.orders.queue.length||p.priorityWork||p.melee||p.shooting?.order||p.tactics);
}
export const animalRescueReason=(w:World,p:Pawn,a?:WildAnimal):string|undefined=>reason(w,p,a,true)
  ??(busy(p)?'Ce colon est déjà engagé dans une autre activité.':undefined);
function enemyNear(w:World,p:Pawn,a:WildAnimal):boolean {
  const near=(c:Cell)=>(c.x-a.x)**2+(c.z-a.z)**2<625;
  return w.pawns.some(other=>other!==p&&activeThreat(other)&&hostileTo(p,other)&&near(other))
    ||!!w.wildlife?.animals.some(other=>other.manhunter&&!['dead','downed'].includes(other.state)&&near(other))
    ||!!w.mechanoids?.some(m=>!['dead','downed'].includes(m.state)&&near(m));
}
export function animalRescueWanted(w:World,p:Pawn,targets?:ReadonlySet<number>):boolean {
  if(!animalRescueActorReady(w,p)||!w.structures.some(s=>s.kind==='animal-sleeping-spot'&&allowedAreaAllows(w,p,s)))return false;
  const selected=targets??autoSlaughterTargets(w);
  return !!w.wildlife?.animals.some(a=>!reason(w,p,a,false,selected)&&!enemyNear(w,p,a));
}
function proposalFor(w:World,p:Pawn,reach:Reachability,a:WildAnimal,direct=false,targets?:ReadonlySet<number>):AnimalRescueProposal|undefined {
  if(reason(w,p,a,direct,targets)||!direct&&enemyNear(w,p,a))return;
  const path=slaughterContact(w,p,a)?[]:routeToJob(w,a,reach,false);if(!path)return;
  const rank=(s:Structure)=>s.medical?0:a.domestic?.bedId===s.id?1:2;
  const bedOwners=w.schemaVersion>=256?captureActorBeds256(w):undefined;
  const spots=w.structures.filter(s=>allowedAreaAllows(w,p,s)&&animalSpotAvailable(w,s,a,p.id,bedOwners)).sort((x,y)=>rank(x)-rank(y)
    ||(x.x-a.x)**2+(x.z-a.z)**2-((y.x-a.x)**2+(y.z-a.z)**2)||x.id-y.id);
  for(const spot of spots)if(routeToCell(w,spot,reach))return {task:{animalId:a.id,spotId:spot.id,phase:'approach'},path,target:a};
}
export function animalRescueProposal(w:World,p:Pawn,reach:Reachability):AnimalRescueProposal|undefined {
  const targets=autoSlaughterTargets(w);
  if(!animalRescueWanted(w,p,targets))return;
  const animals=[...w.wildlife!.animals].sort((x,y)=>(x.x-p.x)**2+(x.z-p.z)**2-((y.x-p.x)**2+(y.z-p.z)**2)||x.id-y.id);
  for(const a of animals){const result=proposalFor(w,p,reach,a,false,targets);if(result)return result;}
}
export function startAnimalRescue(w:World,p:Pawn,proposal:AnimalRescueProposal):void {
  const a=proposal.target,s=structureById(w,proposal.task.spotId)!;
  if(!s.medical)claimLocalActorBed256(w,a,s);
  p.animalRescue=proposal.task;p.path=proposal.path;p.state='moving';p.planCooldown=0;
}
export function reconcileAnimalRescues(w:World,carrier?:Pawn):void {
  if(w.schemaVersion<221)return;
  for(const p of carrier?[carrier]:w.pawns){
    const t=p.animalRescue;if(!t)continue;
    const a=w.wildlife?.animals.find(a=>a.id===t.animalId),s=structureById(w,t.spotId);
    if(!allowedAreaServicesAllowed(w,p)||reason(w,p,a,!!t.forced)||!s||!a||!animalSpotAvailable(w,s,a,p.id))releaseAnimalRescue(w,p);
  }
}
export function processAnimalRescue(w:World,p:Pawn,ctx:NeedContext):void {
  const t=p.animalRescue;if(!t)return;
  const a=w.wildlife?.animals.find(a=>a.id===t.animalId),s=structureById(w,t.spotId);
  if(a&&!a.health?.death&&a.health&&a.health.tick<w.tick)advanceAnimalHealth(w,a);
  if(!allowedAreaServicesAllowed(w,p)||reason(w,p,a,!!t.forced)||!s||!a||!animalSpotAvailable(w,s,a,p.id)){releaseAnimalRescue(w,p);return;}
  if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
  p.state='moving';
  if(t.phase==='approach'){
    if(!slaughterContact(w,p,a)){ctx.move(a,false);return;}
    if((a.motion?.end??0)>w.tick)return;
    delete a.animalThermalRefuge288;delete a.animalRest;delete a.meal;delete a.mating;delete a.exiting;delete a.strike;a.path=[];
    if(a.health)cancelToxicVomit256(a.health);
    t.phase='carry';p.path=[];syncCarriedAnimals(w,p);ctx.event(`${p.name} porte l’animal ${a.id} vers un couchage.`);
  }
  if(p.x!==s.x||p.z!==s.z){ctx.move(s,true);syncCarriedAnimals(w,p);return;}
  syncCarriedAnimals(w,p);delete p.animalRescue;p.path=[];p.planCooldown=0;p.state='idle';
  delete a.motion;a.path=[];a.animalRest={spotId:s.id,phase:'sleep'};a.nextDecision=w.tick;
  if(!s.medical)claimLocalActorBed256(w,a,s);
}
export function applyAnimalRescue(w:World,c:{type:'order-animal-rescue';pawnId:number;animalId:number}):CommandResult {
  const fail=(msg:string):CommandResult=>({ok:false,code:'invalid-command',reason:msg});
  if(!c||typeof c!=='object'||Array.isArray(c)||c.type!=='order-animal-rescue'||Object.keys(c).length!==3
    ||Object.keys(c).some(k=>!['type','pawnId','animalId'].includes(k))||!Number.isSafeInteger(c.pawnId)||!Number.isSafeInteger(c.animalId))return fail('Ordre de secours invalide.');
  const p=w.pawns.find(p=>p.id===c.pawnId),a=w.wildlife?.animals.find(a=>a.id===c.animalId);if(!p||!a)return fail('Colon ou animal introuvable.');
  const refusal=animalRescueReason(w,p,a);if(refusal)return fail(refusal);
  const proposal=proposalFor(w,p,reachableCells(w,p,blockedCells(w),new Set()),a,true);if(!proposal)return fail('Aucun couchage animal libre et accessible.');
  if(w.schemaVersion>=223)proposal.task.forced=true;
  releaseAllowedAreaReturn(p);
  startAnimalRescue(w,p,proposal);return {ok:true};
}
