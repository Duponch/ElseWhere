import {assignPileOwner} from './pile-index.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {isColonist} from './affiliation.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {pawnBody} from './health-rules.ts';
import {carrierOf} from './rescue-state.ts';
import {reservedSource} from './materials.ts';
import {routeToJob,blockedCells} from './pathfinding.ts';
import {search,type SearchBudget} from './work-planner.ts';
import {isRoofed} from './roof-rules.ts';
import {assignmentAt} from './schedule.ts';
import {urgentMedicalTask} from './urgent-care.ts';
import {drugPolicyFor265,type BeerPolicy265} from './alcohol-policy-265.ts';
import {captureGroupMass} from './group-capture.ts';
import {planInventoryPickup,commitInventoryPickup} from './inventory-pickup.ts';
import {copyPileCondition} from './pile-condition.ts';
import {createMedicalRecord} from './injury-state.ts';
import {ingestAlcoholDose265} from './alcohol-clinical-265.ts';
import {healthRandom,reconcilePawnHealth,updatePawnHealth} from './health.ts';
import {gainRecreation} from './recreation-rules.ts';
import {nativeHumanBiologicalCore256} from './native-human-identity-256.ts';
import type {AlcoholReason265} from './alcohol-state-265.ts';
import type {NeedContext} from './needs.ts';
import type {MaterialPile,NeedTask,Pawn,World} from './types.ts';
type Eat=Extract<NeedTask,{kind:'eat'}>;
export const beerPile265=(pile:MaterialPile|undefined):pile is MaterialPile&{kind:'beer';item:'beer'}=>!!pile&&pile.kind==='beer'&&pile.item==='beer'&&pile.quantity>0;
const sourceCache=new WeakMap<World,{tick:number;piles:MaterialPile[];length:number;beer:MaterialPile[]}>();
function beers(world:World):MaterialPile[]{let cache=sourceCache.get(world);if(!cache||cache.tick!==world.tick||cache.piles!==world.piles||cache.length!==world.piles.length){cache={tick:world.tick,piles:world.piles,length:world.piles.length,beer:world.piles.filter(beerPile265)};sourceCache.set(world,cache);}return cache.beer;}
/** Read-only UI refusal. Explicit orders bypass a policy, as Core direct
 * ingestion does; permission, owner and physiological ability still apply. */
export function alcoholDrinkReason265(world:World,pawn:Pawn,pile:MaterialPile|undefined):string|null {
 if(!isSchema265OrLater(world.schemaVersion))return 'La bière nécessite une sauvegarde actuelle.';
 if(!world.pawns.includes(pawn)||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue)return 'Choisissez un colon humain libre.';
 if(['downed','dead'].includes(pawn.state)||pawn.health?.death||pawn.health?.body!==undefined)return 'Ce colon ne peut pas boire.';
 if(pawn.mental?.crisis||carrierOf(world,pawn.id))return 'Ce colon ne peut pas recevoir cet ordre.';
 if(!beerPile265(pile)||!world.piles.includes(pile)||pile.owner.type!=='ground')return 'Choisissez une vraie pile de bière au sol.';
 if(!materialAllowedForPlayer256(pile))return 'Cette bière est interdite.';
 if(!allowedAreaAllows(world,pawn,pile.owner))return 'Cette bière est hors de la zone autorisée.';
 const body=pawnBody(pawn);if(body.capacities.eating<=0||body.capacities.manipulation<=0)return 'Ce colon doit pouvoir boire et manipuler la bière.';
 if(pile.quantity-reservedSource(world,pile.id,pawn.id)<1)return 'Cette bière est déjà réservée.';
 return null;
}
const idleForJoy=(p:Pawn)=>p.jobId===null&&!p.brewing&&!p.openCasket&&!p.haul&&!p.cooking&&!p.hunting&&!p.research&&!p.burial&&!p.cleaning&&!p.recreation.task&&!p.deepWork&&!p.orbitalTrade&&!p.animalHandling&&!p.animalCare&&!p.animalFeed&&!p.animalRescue&&!p.rescue&&!p.tend&&!p.feed&&!p.ward&&!p.surgery&&!p.trade&&!p.equipmentTask&&!p.firefighting;
/** No decision PRNG: a stable per-day appointment replaces Core's temporary
 * seeded stream without touching the gameplay stream or replaying past days. */
export function scheduledAlcoholDue265(tick:number,pawn:Pawn,e:BeerPolicy265):boolean {
 const a=pawn.health?.alcohol;
 if(!e.allowScheduled||e.onlyIfMoodBelow<1&&pawn.mood>=e.onlyIfMoodBelow*100||e.onlyIfJoyBelow<1&&pawn.recreation.level>=e.onlyIfJoyBelow*100)return false;
 const day=Math.floor(tick/6000),last=a?Math.floor(a.lastDoseTick/6000):-Infinity;
 if(e.daysFrequency<1){if(last===day&&(a?.dosesToday??0)>=Math.round(1/e.daysFrequency))return false;}
 else if(day-last<Math.round(e.daysFrequency))return false;
 let bits=(Math.imul(pawn.id,0x9e3779b1)^Math.imul(day+1,0x85ebca6b))>>>0;bits^=bits<<13;bits^=bits>>>17;bits^=bits<<5;
 const dayFraction=(tick%6000)/6000;return dayFraction>=.1+(bits>>>0)/0x100000000*.25;
}
export function alcoholChoice265(world:World,pawn:Pawn):AlcoholReason265|undefined {
 const e=drugPolicyFor265(world,pawn).beer;
 if(pawn.mental?.crisis?.kind==='drug-binge')return 'binge';
 if(e.allowedForAddiction&&pawn.health?.alcohol?.addiction&&(pawn.health.alcohol.addiction.need<=Math.fround(.1)))return 'addiction';
 if(scheduledAlcoholDue265(world.tick,pawn,e))return 'scheduled';
 const assignment=assignmentAt(world,pawn);
 if(e.allowedForJoy&&!pawn.recreation.bored.chemical&&idleForJoy(pawn)&&world.tick>=500&&pawn.hunger>20&&assignment!=='work'&&assignment!=='sleep'&&pawn.recreation.level<(assignment==='anything'?35:95))return 'joy';
 if(e.takeToInventory>0&&idleForJoy(pawn))return 'inventory';
}
function inventoryCount(world:World,pawn:Pawn):number{return beers(world).reduce((n,p)=>n+(p.owner.type==='inventory'&&p.owner.pawnId===pawn.id?p.quantity:0),0);}
/** Real carried mass, including equipment/clothes and minified possessions.
 * The OrderedTakeGroup maximum3 is a separate policy bound. */
export function alcoholInventorySpace265(world:World,pawn:Pawn):number {
 const held=world.piles.filter(p=>['inventory','equipment','apparel'].includes(p.owner.type)&&'pawnId'in p.owner&&p.owner.pawnId===pawn.id),packed=world.packed.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===pawn.id);
 const mass=captureGroupMass([pawn],held,true,world.schemaVersion,packed);if(!mass)return 0;
 return Math.max(0,Math.min(3-inventoryCount(world,pawn),Math.floor((mass.capacityGrams-mass.grams)/300)));
}
export interface AlcoholNeedPlan265 {task:Eat;path:{x:number;z:number}[];source:MaterialPile}
export function planAlcoholNeed265(world:World,pawn:Pawn,context:NeedContext,reason:AlcoholReason265):AlcoholNeedPlan265|null|undefined {
 const all=beers(world);if(!all.length)return;
 const wanted=reason==='inventory'?Math.min(drugPolicyFor265(world,pawn).beer.takeToInventory-inventoryCount(world,pawn),alcoholInventorySpace265(world,pawn)):1;
 if(wanted<=0)return;
 if(reason!=='inventory'){
  const owned=all.find(p=>p.owner.type==='inventory'&&p.owner.pawnId===pawn.id&&materialAllowedForPlayer256(p));
  if(owned)return {source:owned,path:[],task:{kind:'eat',alcoholReason:reason,phase:'pickup',sourcePileId:owned.id,carryPileId:null,quantity:1,progress:0,dining:null}};
 }
 const candidates=all.filter(p=>p.owner.type==='ground'&&(reason==='binge'||materialAllowedForPlayer256(p)&&allowedAreaAllows(world,pawn,p.owner))&&!world.tiles[p.owner.z*world.width+p.owner.x]?.fogged&&p.quantity>reservedSource(world,p.id,pawn.id));
 if(!candidates.length)return;
 const goals=new Set(candidates.map(p=>{const o=p.owner as {x:number;z:number};return o.z*world.width+o.x;})),reach=context.search(goals);if(!reach)return null;
 let best:AlcoholNeedPlan265|undefined;
 for(const source of candidates){if(source.owner.type!=='ground')continue;const path=routeToJob(world,source.owner,reach,true);if(!path)continue;
  if(!best||path.length<best.path.length||path.length===best.path.length&&source.id<best.source.id)best={source,path,task:{kind:'eat',alcoholReason:reason,phase:'pickup',sourcePileId:source.id,carryPileId:null,quantity:Math.min(wanted,source.quantity-reservedSource(world,source.id,pawn.id)),progress:0,dining:null}};
 }
 return best;
}
/** Clinical mental admission uses the same bounded search quota. Core's
 * availability check ignores forbidden status, but still needs actual reach. */
export function alcoholBingeAdmission265(world:World,pawn:Pawn,budget?:SearchBudget):boolean|null {
 if(!isSchema265OrLater(world.schemaVersion)||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.mental?.crisis||['dead','downed','sleeping'].includes(pawn.state)||carrierOf(world,pawn.id))return false;
 const candidates=beers(world).filter(p=>p.owner.type==='ground'&&!world.tiles[p.owner.z*world.width+p.owner.x]?.fogged&&(isRoofed(world,p.owner.z*world.width+p.owner.x)||(p.owner.x-pawn.x)**2+(p.owner.z-pawn.z)**2<=45**2));
 if(!candidates.length)return false;
 const reach=search(world,pawn,blockedCells(world),new Set(),budget??{remaining:1,pairs:0},new Set(candidates.map(p=>{const o=p.owner as {x:number;z:number};return o.z*world.width+o.x;})));if(!reach)return null;
 return candidates.some(p=>p.owner.type==='ground'&&!!routeToJob(world,p.owner,reach,true));
}
/** The engine calls after urgent ordinary needs and before work/recreation.
 * Search/release share its real tick-local navigation and conservative cargo. */
export function processAutomaticAlcohol265(world:World,pawn:Pawn,context:NeedContext):boolean {
 if(!isSchema265OrLater(world.schemaVersion)||pawn.need||pawn.needCooldown>0||pawn.orders.active!==null||pawn.draft||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||['dead','downed','sleeping'].includes(pawn.state)||pawn.medicalSleep||pawn.health?.death||pawn.health?.body!==undefined||carrierOf(world,pawn.id)||urgentMedicalTask(pawn,world)||pawn.interruptedCargo||pawn.burning||pawn.bombRefuge||pawn.heatRefuge||pawn.stun||pawn.melee||pawn.shooting||pawn.mental?.crisis&&pawn.mental.crisis.kind!=='drug-binge')return false;
 if(!beers(world).length)return false;
 const reason=alcoholChoice265(world,pawn);if(!reason)return false;
 const body=pawnBody(pawn);if(body.capacities.eating<=0||body.capacities.manipulation<=0)return false;
 const plan=planAlcoholNeed265(world,pawn,context,reason);if(plan===null)return true;
 if(!plan){pawn.needCooldown=20;return false;}
 if(plan.task.quantity<plan.source.quantity&&(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1)))return false;
 if(!context.release())return true;
 pawn.need=plan.task;pawn.path=plan.path;pawn.state='moving';pawn.planCooldown=0;pawn.needCooldown=0;return true;
}
/** Contact has been checked by processEating. No amount is granted for simply
 * reserving this task; actual inventory receives the original/split pile. */
export function completeAlcoholInventory265(world:World,pawn:Pawn,source:MaterialPile,task:Eat):boolean {
 if(task.alcoholReason!=='inventory'||task.phase!=='pickup'||source.owner.type!=='ground')return false;
 const quantity=Math.min(task.quantity,alcoholInventorySpace265(world,pawn));if(quantity<1)return false;
 const plan=planInventoryPickup(world,source,pawn.id,quantity);if(!plan||!commitInventoryPickup(world,plan))return false;
 pawn.need=null;pawn.path=[];pawn.state='idle';pawn.needCooldown=20;pawn.planCooldown=0;return true;
}
/** Owning inventory is inside the same actor; this is not another person's
 * cargo. Taking one unit preserves any remainder and the container identity. */
export function takeOwnedBeer265(world:World,pawn:Pawn,source:MaterialPile,task:Eat):boolean {
 if(source.owner.type!=='inventory'||source.owner.pawnId!==pawn.id||task.quantity!==1)return false;
 if(source.quantity===1){assignPileOwner(source,{type:'pawn',pawnId:pawn.id});task.carryPileId=source.id;}
 else {if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return false;source.quantity--;const id=world.nextId++;world.piles.push({id,item:'beer',kind:'beer',quantity:1,owner:{type:'pawn',pawnId:pawn.id},...copyPileCondition(source)});task.carryPileId=id;}
 task.phase='choose-spot';pawn.path=[];pawn.state='moving';return true;
}
/** Called only after the real held unit was removed at the ingest contact. */
export function ingestBeer265(world:World,pawn:Pawn):void {
 if(!isSchema265OrLater(world.schemaVersion))throw Error('Future beer ingestion');
 if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
 pawn.health??=createMedicalRecord(world.tick);
 ingestAlcoholDose265(pawn.health,alcoholBodySize265(pawn),world.tick,()=>healthRandom(world));
 gainRecreation(pawn.recreation,'chemical',17);reconcilePawnHealth(world,pawn);
}
export const alcoholBodySize265=(pawn:Pawn):number=>pawn.nativeHuman&&nativeHumanBiologicalCore256(pawn)<18*3600000?Math.fround(.8):1;
