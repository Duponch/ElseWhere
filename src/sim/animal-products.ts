import {workSpeedGlobal361} from './traits.ts';
import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {animalProductDefinition256} from './animal-products-v256.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {workSpeedInspirationFactor360} from './inspirations-360.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { isColonist } from './affiliation.ts';
import { animalGrowthFactor, animalLifeStage } from './animal-life.ts';
import type { AnimalHandlingTask } from './domestic-state.ts';
import { pawnBody, medicalWorkRefusal } from './health-rules.ts';
import { healthRandom } from './health.ts';
import { planGroundPlacement } from './ground-placement.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { addGroundMaterial,materialIdentityCount } from './materials.ts';
import type { NeedContext } from './needs.ts';
import { adjacent, routeToJob, type Reachability } from './pathfinding.ts';
import { releaseWork } from './work-release.ts';
import { learnSkill } from './skills.ts';
import { TICKS_PER_DAY, type Cell, type Pawn, type World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { animalServiceIds } from './animal-rest-state.ts';
import {animalServiceDecisionCandidates379} from './source-reservation-candidates-379.ts';
import {animalById379} from './animal-identity-directory-379.ts';

/** Core 1.6.4871 nominal quantities/intervals, converted to Lisière's 6,000-tick day. */
export const ANIMAL_PRODUCTS = Object.freeze({
  milk: Object.freeze({species:'dromedary',item:'milk',quantity:18,days:2,work:400/10,rank:-.9}),
  shear: Object.freeze({species:'muffalo',item:'muffalo-wool',quantity:120,days:15,work:1700/10,rank:-.85}),
} as const);
const YIELD_BY_ANIMALS_LEVEL=[.60,.70,.75,.80,.85,.90,.95,.975,1,1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.10,1.12,1.13] as const;
export type AnimalProductKind=keyof typeof ANIMAL_PRODUCTS;
export type ProductTask=AnimalHandlingTask & {kind:AnimalProductKind;phase:'approach'|'interact'};
export const productKind=(a:WildAnimal):AnimalProductKind|undefined=>isAnimalSpecies256(a.species)?animalProductDefinition256(a)?.kind:animalLifeStage(a)!=='adult'?undefined:a.species==='muffalo'?'shear':a.species==='dromedary'&&a.sex==='female'?'milk':undefined;
export const animalProductDefinition=(a:WildAnimal)=>{if(isAnimalSpecies256(a.species))return animalProductDefinition256(a);const kind=productKind(a);return kind?ANIMAL_PRODUCTS[kind]:undefined;};
export const productFullness=(a:WildAnimal):number=>a.domestic?.productFullness??0;
export const productReady=(a:WildAnimal):boolean=>!!a.domestic&&productFullness(a)>=1&&!!productKind(a);

/** Hunger bands inferred from Core's herbivore 45% want-to-eat threshold. */
export function productGrowthFactor(a:WildAnimal):number {
  return animalGrowthFactor(a);
}
/** One bounded animal pass per simulation tick, with no map or pile search. */
export function advanceAnimalProducts(world:World):void {
  for(const a of world.wildlife?.animals??[]){
    if(!a.domestic||a.state==='dead'||world.schemaVersion<256&&isAnimalSpecies256(a.species))continue;
    const previous=a.domestic.productFullness??0;
    if(previous>=1)continue;
    const def=animalProductDefinition(a);if(!def)continue;
    a.domestic.productFullness=Math.min(1,previous+productGrowthFactor(a)/(def.days*TICKS_PER_DAY));
  }
}
const availableProductKind=(a:WildAnimal):AnimalProductKind|undefined=>!!a.domestic&&productFullness(a)>=1&&a.state!=='dead'&&a.state!=='downed'&&a.state!=='sleeping'&&a.state!=='eating'
  &&!a.stun&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.meal?productKind(a):undefined;
const available=(a:WildAnimal):boolean=>availableProductKind(a)!==undefined;
export const productHandlerAvailable=(p:Pawn):boolean=>{
  if(!isColonist(p)||workPriority(p,'handle')===0||p.draft||p.mental?.crisis||p.flee||p.interruptedCargo||medicalWorkRefusal(p))return false;
  const body=pawnBody(p).capacities;return body.moving>0&&body.manipulation>0;
};
const claimed=(world:World)=>{const ids=new Set<number>();for(const p of animalServiceDecisionCandidates379(world)??world.pawns)for(const id of animalServiceIds(p))ids.add(id);return ids;};
export function productWanted(world:World,pawn:Pawn):boolean {
  if(!productHandlerAvailable(pawn))return false;
  let reserved:Set<number>|undefined;
  for(const a of world.wildlife?.animals??[])if(available(a)&&allowedAreaAllows(world,pawn,a)&&!(reserved??=claimed(world)).has(a.id))return true;
  return false;
}
export interface ProductProposal {task:ProductTask;path:Cell[];target:Cell}
export function productProposal(world:World,pawn:Pawn,reach:Reachability):ProductProposal|undefined {
  if(!productHandlerAvailable(pawn))return;
  let reserved:Set<number>|undefined;
  const animals:{animal:WildAnimal;rank:number;kind:AnimalProductKind;distance:number}[]=[];
  // Candidate definition, ranking and distance are computed once in this
  // pure read, before the route search; no claim survives this proposal.
  for(const animal of world.wildlife?.animals??[]){const kind=availableProductKind(animal);if(!kind||!allowedAreaAllows(world,pawn,animal)||(reserved??=claimed(world)).has(animal.id))continue;
   const def=isAnimalSpecies256(animal.species)?animalProductDefinition256(animal)!:ANIMAL_PRODUCTS[kind];animals.push({animal,rank:def.rank,kind,distance:(animal.x-pawn.x)**2+(animal.z-pawn.z)**2});}
  animals.sort((a,b)=>a.rank-b.rank||a.distance-b.distance||a.animal.id-b.animal.id);
  for(const {animal,kind} of animals){
    const path=routeToJob(world,animal,reach,false);if(!path)continue;
    return {task:{animalId:animal.id,kind,sourcePileId:0,carryPileId:null,quantity:0,phase:'approach',step:0,progress:0},path,target:animal};
  }
}
export function startProduct(pawn:Pawn,proposal:ProductProposal):void {
  pawn.animalHandling=proposal.task;pawn.path=proposal.path;pawn.state=proposal.path.length?'moving':'working';pawn.planCooldown=0;
}
/** A completed gesture gathers at most one physical stack batch. A failed
 * placement retains maturity and does not consume the one yield draw. */
export function processProduct(world:World,pawn:Pawn,task:ProductTask,ctx:NeedContext):void {
  if(!allowedAreaServicesAllowed(world,pawn)){if(!releaseWork(world,pawn))interruptWork(world,pawn);return;}
  const animal=animalById379(world,task.animalId);
  if(!animal||world.schemaVersion<256&&isAnimalSpecies256(animal.species)||availableProductKind(animal)!==task.kind||!productHandlerAvailable(pawn)) {interruptWork(world,pawn);return;}
  if(!adjacent(pawn,animal)||(animal.motion?.end??0)>world.tick){
    if(task.phase==='interact')task.progress=0;
    task.phase='approach';
    if(!adjacent(pawn,animal))ctx.move(animal,false);
    else {pawn.path=[];pawn.state='idle';}
    return;
  }
  releaseAnimalThermalRefuge288(world,animal);task.phase='interact';pawn.path=[];pawn.state='working';
  const def=animalProductDefinition(animal)!;
  const body=pawnBody(pawn).capacities;
  const level=pawn.skills.animals?.level??0,sight=Math.min(1,body.sight);
  const rate=Math.max(.1,(.04+.12*level)*body.manipulation*(.5+.5*sight)*workSpeedInspirationFactor360(pawn)*workSpeedGlobal361(pawn));
  if(task.progress+rate<def.work){task.progress+=rate;return;}
  const plan=planGroundPlacement(world,def.quantity,pawn,def.item);
  const identities=plan?.reduce((n,part)=>n+materialIdentityCount(world,part.quantity,{type:'ground',...part.cell},def.item),0)??0;
  if(!plan||world.piles.length+identities>32768||!Number.isSafeInteger(world.nextId+identities)){
    task.progress=Math.max(0,def.work-rate);return;
  }
  const chance=Math.min(1,(YIELD_BY_ANIMALS_LEVEL[Math.min(20,level)]??1)*(.7+.3*body.manipulation)*(.8+.2*sight));
  const success=chance>=1||healthRandom(world)<chance;
  if(success)addGroundMaterial(world,ITEM_DEFINITIONS[def.item].kind,def.quantity,pawn,def.item);
  animal.domestic!.productFullness=0;
  if(pawn.skills.animals)learnSkill(pawn.skills.animals,task.kind==='milk'?40_000:170_000,pawn);
  ctx.event(`${pawn.name} ${success?(task.kind==='milk'?'a trait':'a tondu'):(task.kind==='milk'?'a perdu le lait de':'a perdu la laine de')} ${animal.id}.`);
  if(!releaseWork(world,pawn))interruptWork(world,pawn);
}
