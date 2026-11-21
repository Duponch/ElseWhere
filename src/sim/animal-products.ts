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

/** Core 1.6.4871 nominal quantities/intervals, converted to Lisière's 6,000-tick day. */
export const ANIMAL_PRODUCTS = Object.freeze({
  milk: Object.freeze({species:'dromedary',item:'milk',quantity:18,days:2,work:400/10,rank:-.9}),
  shear: Object.freeze({species:'muffalo',item:'muffalo-wool',quantity:120,days:15,work:1700/10,rank:-.85}),
} as const);
const YIELD_BY_ANIMALS_LEVEL=[.60,.70,.75,.80,.85,.90,.95,.975,1,1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.10,1.12,1.13] as const;
export type AnimalProductKind=keyof typeof ANIMAL_PRODUCTS;
export type ProductTask=AnimalHandlingTask & {kind:AnimalProductKind;phase:'approach'|'interact'};
export const productKind=(a:WildAnimal):AnimalProductKind|undefined=>isAnimalSpecies256(a.species)?animalProductDefinition256(a)?.kind:animalLifeStage(a)!=='adult'?undefined:a.species==='muffalo'?'shear':a.species==='dromedary'&&a.sex==='female'?'milk':undefined;
export const animalProductDefinition=(a:WildAnimal)=>isAnimalSpecies256(a.species)?animalProductDefinition256(a):productKind(a)?ANIMAL_PRODUCTS[productKind(a)!]:undefined;
export const productFullness=(a:WildAnimal):number=>a.domestic?.productFullness??0;
export const productReady=(a:WildAnimal):boolean=>!!a.domestic&&!!productKind(a)&&productFullness(a)>=1;

/** Hunger bands inferred from Core's herbivore 45% want-to-eat threshold. */
export function productGrowthFactor(a:WildAnimal):number {
  return animalGrowthFactor(a);
}
/** One bounded animal pass per simulation tick, with no map or pile search. */
export function advanceAnimalProducts(world:World):void {
  for(const a of world.wildlife?.animals??[]){
    const kind=productKind(a);if(world.schemaVersion<256&&isAnimalSpecies256(a.species))continue;if(!kind||!a.domestic||a.state==='dead')continue;
    const previous=a.domestic.productFullness??0;
    if(previous>=1)continue;
    a.domestic.productFullness=Math.min(1,previous+productGrowthFactor(a)/(animalProductDefinition(a)!.days*TICKS_PER_DAY));
  }
}
const available=(a:WildAnimal):boolean=>productReady(a)&&a.state!=='dead'&&a.state!=='downed'&&a.state!=='sleeping'&&a.state!=='eating'
  &&!a.stun&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.meal;
export const productHandlerAvailable=(p:Pawn):boolean=>{
  if(!isColonist(p)||workPriority(p,'handle')===0||p.draft||p.mental?.crisis||p.flee||p.interruptedCargo||medicalWorkRefusal(p))return false;
  const body=pawnBody(p).capacities;return body.moving>0&&body.manipulation>0;
};
const claimed=(world:World)=>new Set(world.pawns.flatMap(animalServiceIds));
export function productWanted(world:World,pawn:Pawn):boolean {
  if(!productHandlerAvailable(pawn)||!world.wildlife?.animals.some(available))return false;
  const reserved=claimed(world);
  return world.wildlife.animals.some(a=>allowedAreaAllows(world,pawn,a)&&available(a)&&!reserved.has(a.id));
}
export interface ProductProposal {task:ProductTask;path:Cell[];target:Cell}
export function productProposal(world:World,pawn:Pawn,reach:Reachability):ProductProposal|undefined {
  if(!productWanted(world,pawn))return;
  const reserved=claimed(world);
  const animals=world.wildlife!.animals.filter(a=>allowedAreaAllows(world,pawn,a)&&available(a)&&!reserved.has(a.id))
    .sort((a,b)=>animalProductDefinition(a)!.rank-animalProductDefinition(b)!.rank
      ||(a.x-pawn.x)**2+(a.z-pawn.z)**2-((b.x-pawn.x)**2+(b.z-pawn.z)**2)||a.id-b.id);
  for(const animal of animals){
    const path=routeToJob(world,animal,reach,false);if(!path)continue;
    return {task:{animalId:animal.id,kind:productKind(animal)!,sourcePileId:0,carryPileId:null,quantity:0,phase:'approach',step:0,progress:0},path,target:animal};
  }
}
export function startProduct(pawn:Pawn,proposal:ProductProposal):void {
  pawn.animalHandling=proposal.task;pawn.path=proposal.path;pawn.state=proposal.path.length?'moving':'working';pawn.planCooldown=0;
}
/** A completed gesture gathers at most one physical stack batch. A failed
 * placement retains maturity and does not consume the one yield draw. */
export function processProduct(world:World,pawn:Pawn,task:ProductTask,ctx:NeedContext):void {
  if(!allowedAreaServicesAllowed(world,pawn)){if(!releaseWork(world,pawn))interruptWork(world,pawn);return;}
  const animal=world.wildlife?.animals.find(a=>a.id===task.animalId);
  if(!animal||world.schemaVersion<256&&isAnimalSpecies256(animal.species)||!available(animal)||productKind(animal)!==task.kind||!productHandlerAvailable(pawn)) {interruptWork(world,pawn);return;}
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
