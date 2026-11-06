import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {notifyDuckFlightJob256} from './duck-flight-runtime-256.ts';
import {prospectiveHuman259} from './group-human-admission-259.ts';
import {healthRandom} from './health.ts';
import {cancelGroupPreparation} from './group-authority.ts';
import {captureGroupMass} from './group-capture.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import type {World,Pawn,Cell} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {NeedContext} from './needs.ts';
import type {PreparingGroup,AwayGroup} from './group-capture.ts';
import type {GroupAnimalPreparation256,GroupAnimalPreparationLine256} from './group-animal-state-256.ts';
import {animalClaimed} from './animal-rest-state.ts';
import {animalBody} from './wildlife-health.ts';
import {slaughterContact} from './animal-slaughter.ts';
import {localWorldGroups,boundWorldGroup} from './world-map-context.ts';
const finished=(w:World,a:{motion?:{end:number}|null})=>!a.motion||a.motion.end<=w.tick;
export function groupAnimalPreparation(w:World,id:number):{group:PreparingGroup;line:GroupAnimalPreparationLine256}|undefined {
 for(const row of localWorldGroups(w)){const g=row.state;if(!('manifest'in g))continue;const line=g.animalPreparation?.lines.find(l=>l.animalId===id);if(line)return {group:g,line};}
 const g=w.group;if(g&&'manifest'in g){const line=g.animalPreparation?.lines.find(l=>l.animalId===id);if(line)return {group:g,line};}return;
}
/** Active services/captured edges are never erased to obtain an eligible animal. */
function animalFormationReason256(w:World,a:WildAnimal,preparing:boolean,ordinaryAdmission=false):string|undefined {
 if(w.schemaVersion<256||!w.wildlife?.animals.includes(a)||!a.domestic||a.state==='dead'||a.health?.death)return 'Animal domestique vivant et présent requis.';
 if(a.haul&&a.haul.phase!=='holding')return 'Cet animal doit terminer son transport local.';
 const held=groupAnimalPreparation(w,a.id);if(held&&(!preparing||held.group!==w.group))return 'Cet animal appartient déjà à une formation.';
 if(animalClaimed(w,a.id,preparing?held?.line.handlerId:undefined)||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.stun||a.predation||a.mating||a.exiting||a.manhunter||a.confusion||a.eggLay||a.exitFlight||(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined)||a.domestic.slaughter)return 'Cet animal doit terminer son activité ou son danger.';
 const ordinary=ordinaryAdmission&&a.state==='moving'&&a.wander?.job?.kind==='goto'&&!a.meal&&!a.animalRest&&!a.flight&&!a.motion?.animalFlight&&!a.hiveJob;
 if(!preparing&&!ordinary&&(a.path.length||!finished(w,a)||!['idle','sleeping','downed'].includes(a.state)))return 'Cet animal doit terminer son déplacement.';
 return;
}
/** Historical admission, unloading and existing formations keep this contract. */
export function groupAnimalReason256(w:World,a:WildAnimal,preparing=false):string|undefined {return animalFormationReason256(w,a,preparing);}
/** New actual259/admission2 only. The existing ungathered line suppresses later
 * wandering decisions; the handler still waits for BOTH captured edges before
 * contact/gathering. No motion, health, service or dangerous task is cleared. */
export function groupAnimalFormationReason259(w:World,a:WildAnimal):string|undefined {return animalFormationReason256(w,a,false,(Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&!w.group&&prospectiveHuman259(w));}
export function previewGroupAnimals256(w:World,ids:readonly number[],members:readonly Pawn[],reachable:(p:Pawn,c:Cell)=>boolean):{kind:'ready';animals:WildAnimal[];preparation?:GroupAnimalPreparation256}|{kind:'refused';reason:string} {
 if(!ids.length)return {kind:'ready',animals:[]};if(w.schemaVersion<256||!members.length||new Set(ids).size!==ids.length)return {kind:'refused',reason:'Sélection animale invalide.'};
 const animals:WildAnimal[]=[],lines:GroupAnimalPreparationLine256[]=[],carriers=new Set<number>();
 for(const id of ids){const a=w.wildlife?.animals.find(a=>a.id===id);if(!Number.isSafeInteger(id)||id<1||id>=w.nextId||!a)return {kind:'refused',reason:'Animal original absent.'};const reason=groupAnimalFormationReason259(w,a);if(reason)return {kind:'refused',reason};
  const carry=a.state==='downed'||animalBody(a).capacities.moving<=0,handler=members.find(p=>(!carry||!carriers.has(p.id))&&reachable(p,a));if(!handler)return {kind:'refused',reason:'Un conducteur accessible est requis pour chaque animal ; chaque patient doit avoir son propre porteur.'};
  if(carry)carriers.add(handler.id);animals.push(a);lines.push({animalId:id,handlerId:handler.id,mode:carry?'carry':'lead',gathered:false});
 }
 return {kind:'ready',animals,preparation:{revision:1,lines}};
}
export function groupAnimalCarrier256(w:World,id:number):Pawn|undefined {const held=groupAnimalPreparation(w,id);return held?.line.mode==='carry'&&held.line.gathered?w.pawns.find(p=>p.id===held.line.handlerId):undefined;}
function followCarrier256(a:WildAnimal,p:Pawn):void {a.x=p.x;a.z=p.z;a.path=[];if(p.motion){a.motion={...p.motion,from:{...p.motion.from},to:{...p.motion.to},...p.motion.stagger?{stagger:p.motion.stagger.map(s=>({...s}))}:{},...p.motion.stuns?{stuns:p.motion.stuns.map(s=>({...s}))}:{}};delete a.motion.snowEntryPending;}else delete a.motion;}
export function syncGroupCarriedAnimals256(w:World,p:Pawn):void {
 for(const a of w.wildlife?.animals??[])if(groupAnimalCarrier256(w,a.id)===p)followCarrier256(a,p);
}
/** Same effect and order as syncGroupCarriedAnimals256 for every pawn in turn.
 * An animal's carrier depends only on group preparation lines and the pawn
 * list, which these updates never change, so it is resolved once per animal
 * instead of once per (pawn, animal) pair. */
export function syncAllGroupCarriedAnimals256(w:World):void {
 const animals=w.wildlife?.animals;if(!animals?.length)return;
 let byCarrier:Map<Pawn,WildAnimal[]>|undefined;
 for(const a of animals){const carrier=groupAnimalCarrier256(w,a.id);if(!carrier)continue;byCarrier??=new Map();const list=byCarrier.get(carrier);if(list)list.push(a);else byCarrier.set(carrier,[a]);}
 if(!byCarrier)return;
 for(const p of w.pawns){const list=byCarrier.get(p);if(list)for(const a of list)followCarrier256(a,p);}
}
/** Runs inside the existing human group intent, before meeting/loading/exit.
 * No waypoint or carrying link is acquired until both original edges finish. */
export function processGroupAnimalHandler256(w:World,g:PreparingGroup,p:Pawn,ctx:NeedContext):boolean {
 const lines=g.animalPreparation?.lines.filter(l=>l.handlerId===p.id)??[];for(const line of lines){const a=w.wildlife?.animals.find(a=>a.id===line.animalId);if(!a||groupAnimalReason256(w,a,true)||line.mode==='lead'&&(a.state==='downed'||animalBody(a).capacities.moving<=0)){cancelGroupPreparation(w);return true;}
  if(!line.gathered){if(!finished(w,p)||p.moveCooldown>0)return true;if(!slaughterContact(w,p,a)){ctx.move(a,false);return true;}if(!finished(w,a))return true;
   delete a.animalThermalRefuge288;line.gathered=true;notifyDuckFlightJob256(w,a,'other',()=>healthRandom(w));a.path=[];delete a.animalRest;delete a.meal;if(line.mode==='carry')syncGroupCarriedAnimals256(w,p);
  }
  if(line.mode==='carry')syncGroupCarriedAnimals256(w,p);
  else if(Math.hypot(p.x-a.x,p.z-a.z)>8){p.path=[];p.state='idle';return true;}
 }return false;
}
export interface GroupAnimalMove256 {route(a:WildAnimal,goals:Cell[]):Cell[]|null|undefined;move(a:WildAnimal):void;free(c:Cell):boolean}
/** Called by the existing wildlife pass AFTER clinical/need evolution, before
 * downed/moving/task fallbacks. route spends that pass's one shared search. */
export function processGroupAnimalOnMap256(w:World,a:WildAnimal,c:GroupAnimalMove256):boolean {
 const held=groupAnimalPreparation(w,a.id);if(!held||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.stun||a.manhunter||(a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined))return false;const {line}=held,p=w.pawns.find(p=>p.id===line.handlerId);if(!p)return false;
 if(!line.gathered)return true;if(a.state==='downed'&&line.mode==='lead')return true;if(line.mode==='carry'){syncGroupCarriedAnimals256(w,p);return true;}
 if(!finished(w,a))return true;if(Math.hypot(a.x-p.x,a.z-p.z)<=1.5){a.path=[];a.state='idle';return true;}
 const goals:Cell[]=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const cell={x:p.x+dx,z:p.z+dz};if(c.free(cell))goals.push(cell);}
 if(a.path.length){const end=a.path[a.path.length-1]!;if(!goals.some(c=>c.x===end.x&&c.z===end.z))a.path=[];}
 if(!a.path.length){const route=c.route(a,goals);if(route===null)return true;if(!route)return true;a.path=route;}
 if(a.path.length)c.move(a);return true;
}
export function groupAnimalsReadyForDeparture256(w:World,g:PreparingGroup):boolean {
 return !g.animalPreparation||g.animalPreparation.lines.every(l=>{const a=w.wildlife?.animals.find(a=>a.id===l.animalId),p=w.pawns.find(p=>p.id===l.handlerId);return !!a&&!!p&&l.gathered&&!groupAnimalReason256(w,a,true)&&finished(w,a)&&finished(w,p)&&!a.path.length&&(l.mode==='carry'?a.x===p.x&&a.z===p.z:Math.hypot(a.x-p.x,a.z-p.z)<=1.5);});
}
/** Cancellation releases future intent only. A carried original retains its
 * captured edge; it is neither teleported to its from-cell nor healed. */
export function releaseGroupAnimals256(w:World,g:PreparingGroup):void {if(!g.animalPreparation)return;for(const p of w.pawns)syncGroupCarriedAnimals256(w,p);for(const l of g.animalPreparation.lines){const a=w.wildlife?.animals.find(a=>a.id===l.animalId);if(a){a.path=[];a.nextDecision=w.tick;}}}

export function processGroupAnimalDelivery256(w:World,g:PreparingGroup,p:Pawn,ctx:NeedContext):boolean {
 const line=g.manifest.slice(0,g.cursor).find(l=>l.animalCarrierId!==undefined&&!l.deliveredToAnimal&&l.carrierId===p.id);if(!line)return false;
 const a=w.wildlife?.animals.find(a=>a.id===line.animalCarrierId),pile=w.piles.find(i=>i.id===line.carriedPileId);if(!a||groupAnimalReason256(w,a,true)||!pile||pile.owner.type!=='inventory'||pile.owner.pawnId!==p.id||pile.item!==line.item||pile.quantity!==line.quantity){cancelGroupPreparation(w);return true;}
 if(!finished(w,p)||p.moveCooldown>0)return true;if(!slaughterContact(w,p,a)){ctx.move(a,false);return true;}if(!finished(w,a))return true;
 const allAnimals=g.animalPreparation!.lines.map(l=>w.wildlife!.animals.find(a=>a.id===l.animalId)!),ids=new Set([...g.memberIds,...allAnimals.map(a=>a.id)]),items=w.piles.filter(p=>'pawnId'in p.owner&&ids.has(p.owner.pawnId)),mass=captureGroupMass(w.pawns.filter(p=>g.memberIds.includes(p.id)),items,!!g.freight,w.schemaVersion,w.packed.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId)),allAnimals),carrier=mass?.carriers.find(p=>p.pawnId===a.id),unit=groupCaravanPileMass256(pile,!!g.freight,w.schemaVersion);if(!carrier||unit===undefined||carrier.grams+pile.quantity*unit>carrier.capacityGrams){cancelGroupPreparation(w);return true;}
 pile.owner={type:'inventory',pawnId:a.id};line.deliveredToAnimal=true;p.path=[];p.state='idle';return true;
}
export const pendingGroupAnimalDeliveries256=(g:PreparingGroup):boolean=>g.manifest.slice(0,g.cursor).some(l=>l.animalCarrierId!==undefined&&!l.deliveredToAnimal);

export function groupAnimalChoices256(w:World):readonly {animal:WildAnimal;ok:boolean;reason?:string}[] {return (w.wildlife?.animals??[]).filter(a=>!!a.domestic&&a.state!=='dead').map(animal=>{const reason=w.group?'Un groupe est déjà engagé.':groupAnimalFormationReason259(w,animal);return {animal,ok:!reason,...reason?{reason}:{}};});}
export function groupAnimalClaimed256(w:World,id:number,exceptPawn?:number):boolean {
 for(const row of localWorldGroups(w)){const g=row.state;if('manifest'in g){const l=g.animalPreparation?.lines.find(l=>l.animalId===id);if(l&&l.handlerId!==exceptPawn)return true;}else if(g.phase==='unloading'&&g.animalIds?.includes(id)&&!(exceptPawn!==undefined&&g.memberIds.includes(exceptPawn)))return true;}return false;
}
