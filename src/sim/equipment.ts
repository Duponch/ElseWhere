import {assignPileOwner} from './pile-index.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isMaceItem269} from './mace-content-269.ts';
import { apparelDuration } from './apparel-rules.ts';
import { allowedAreaReason,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { violentWorkRefusal } from './colonist-backgrounds.ts';
import { apparelReason,processApparel } from './apparel.ts';
import { equippedWeapon,weaponLabel,type EquipmentAction,type EquipmentCommand } from './equipment-rules.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { carrierOf } from './rescue-state.ts';
import { reservedSource } from './materials.ts';
import { groundCapacity,nearbyGround } from './ground-placement.ts';
import { adjacent,blockedCells,reachableCells,routeToJob,type Reachability } from './pathfinding.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { dropIncapacitatedEquipment } from './equipment-state.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,MaterialPile,Pawn,World } from './types.ts';

export function equipmentReason(world:World,pawn:Pawn,pile:MaterialPile|undefined,action:EquipmentAction,accepted=false):string|undefined {
  const reason=medicalWorkRefusal(pawn);if(reason)return reason;
  if(carrierOf(world,pawn.id)||pawn.equipmentDropPending||pawn.interruptedCargo)return 'Ce colon doit d’abord être libre de son portage.';
  if(pawn.collapsePending||world.restRules==='legacy'&&pawn.rest===0)return 'Ce colon doit récupérer de son épuisement.';
  if(action==='wear'||action==='remove')return apparelReason(world,pawn,pile,action,accepted);
  if(!pile||pile.kind!=='weapon'||world.schemaVersion<269&&isMaceItem269(pile.item)||world.schemaVersion<270&&isLongswordItem270(pile.item)||world.schemaVersion<272&&isSpearItem272(pile.item))return 'Arme introuvable.';
  if(action==='drop')return pile.owner.type==='equipment'&&pile.owner.pawnId===pawn.id?undefined:'Cette arme n’est pas équipée par ce colon.';
  const violence=violentWorkRefusal(pawn);if(violence)return violence;
  if(pile.owner.type!=='ground')return 'Cette arme n’est plus au sol.';
  if(reservedSource(world,pile.id,pawn.id)>0)return 'Cette arme est réservée par un autre travail.';
  if(accepted&&pile.weapon?.forbidden&&!pawn.equipmentTask?.automatic)return 'Cette arme est interdite.';
}
/** A replacement command will release this actor's waiting reservations, but
 * must still respect every other actor. The query and execution use this view. */
export function equipmentOrderReason(world:World,pawn:Pawn,pile:MaterialPile|undefined,action:EquipmentAction):string|undefined {
  const view=pawn.orders.queue.length?{...world,pawns:world.pawns.map(p=>p===pawn?{...p,orders:{...p.orders,queue:[]}}:p)}:world;
  return equipmentReason(view,pawn,pile,action);
}
function release(world:World,pawn:Pawn):void {releaseWork(world,pawn);}
function announce(world:World,message:string):void {world.events.push({tick:world.tick,type:'job',message});if(world.events.length>80)world.events.shift();}
const gearRecoveryRecipe=(recipe:unknown):boolean=>recipe==='smelt-weapon'||recipe==='smelt-apparel'||recipe==='burn-apparel';
function begin(pawn:Pawn,itemId:number,action:EquipmentAction,path:Cell[],automatic=false,duration?:number):void {
  pawn.equipmentTask={itemId,action,progress:0,...duration!==undefined?{duration}:{},...automatic?{automatic:true as const}:{}};
  if(action==='equip'||action==='drop')delete pawn.droppedWeaponId;pawn.path=path;pawn.state='moving';pawn.planCooldown=0;
  if(!automatic)pawn.orders.active='equipment';
}
export function applyEquipment(world:World,command:EquipmentCommand):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(command.type==='weapon-permission'||command.type==='apparel-permission'){
    const pile=world.piles.find(p=>p.id===command.itemId);
    const state=command.type==='weapon-permission'?pile?.weapon:pile?.apparel;
    if(!pile||!state||pile.owner.type!=='ground'||typeof command.allowed!=='boolean')return fail('Objet au sol introuvable.');
    if(command.allowed)delete state.forbidden;else state.forbidden=true;
    if(!command.allowed)for(const p of world.pawns){
      if(p.haul?.phase==='pickup'&&p.haul.sourcePileId===pile!.id)release(world,p);
      if(p.cooking&&gearRecoveryRecipe(p.cooking.recipe)&&p.cooking.ingredients.some(i=>i.pileId===pile.id))release(world,p);
      p.orders.queue=p.orders.queue.filter(o=>typeof o==='number'||('cooking' in o
        ?!gearRecoveryRecipe(o.cooking.recipe)||!o.cooking.ingredients.some(i=>i.pileId===pile.id)
        :o.sourcePileId!==pile.id));
    }
    return {ok:true};
  }
  const pawn=world.pawns.find(p=>p.id===command.pawnId);if(!pawn)return fail('Colon introuvable.');
  if(command.type==='forget-weapon'){delete pawn.droppedWeaponId;return {ok:true};}
  if(!['equip','drop','wear','remove'].includes(command.action)||typeof command.queue!=='boolean')return fail('Ordre d’équipement invalide.');
  if(command.queue)return fail('La file d’équipement n’est pas encore disponible.');
  const pile=world.piles.find(p=>p.id===command.itemId),reason=equipmentOrderReason(world,pawn,pile,command.action);if(reason)return fail(reason);
  const path=(command.action==='equip'||command.action==='wear')&&pile!.owner.type==='ground'?routeToJob(world,pile!.owner,reachableCells(world,pawn,blockedCells(world),new Set()),true):[];
  if(!path)return fail('Aucun chemin praticable vers cet objet.');
  const drops=planCommandDrops(world,command);if(!drops||!releaseWork(world,pawn,drops))return fail('Pas de place pour déposer la cargaison.');
  clearQueuedOrders(world,pawn);delete pawn.priorityWork;
  if(command.action==='equip')delete pile!.weapon!.forbidden;
  if(command.action==='wear')delete pile!.apparel!.forbidden;
  const duration=command.action==='wear'||command.action==='remove'?apparelDuration(world,pawn,pile!,command.action):undefined;
  begin(pawn,pile!.id,command.action,path,false,duration);return {ok:true};
}
/** Starts one low-priority apparel action without creating a parallel task
 * system. The ordinary equipment state machine owns travel, conflicts and the
 * final physical transfer. */
export function beginAutomaticEquipment(world:World,pawn:Pawn,itemId:number,action:'wear'|'remove',reachable?:Reachability):boolean {
  const pile=world.piles.find(p=>p.id===itemId),reason=equipmentReason(world,pawn,pile,action,true);if(reason)return false;
  if(pile?.owner.type==='ground'&&allowedAreaReason(world,pawn,pile.owner))return false;
  const path=action==='wear'&&pile!.owner.type==='ground'?routeToJob(world,pile!.owner,reachable??reachableCells(world,pawn,blockedCells(world),new Set()),true):[];
  if(!path)return false;
  begin(pawn,itemId,action,path,true,apparelDuration(world,pawn,pile!,action));return true;
}
export function reconcileEquipmentTasks(world:World):void {
  // A bed/service can disappear during another action or command, after this
  // pawn's health update. Reconcile before exposing a save, not one tick later.
  for(const pile of world.piles)if(pile.owner.type==='equipment'){
    const id=pile.owner.pawnId,pawn=world.pawns.find(p=>p.id===id);
    if(pawn?.health||pawn?.equipmentDropPending)dropIncapacitatedEquipment(world,pawn!,false,pile);
  }
  for(const pawn of world.pawns)if(pawn.equipmentTask&&(!allowedAreaWorkAllowed(world,pawn)||equipmentReason(world,pawn,world.piles.find(p=>p.id===pawn.equipmentTask!.itemId),pawn.equipmentTask.action,true)))release(world,pawn);
}
/** At contact the new gun leaves the floor and the old gun can use that freed
 * cell. Preflight both owners against the same view, then commit without IDs/RNG. */
function exchange(world:World,pawn:Pawn,pile:MaterialPile):boolean {
  const old=equippedWeapon(world,pawn),view=old?{...world,piles:world.piles.filter(p=>p!==pile)}:world;
  const drop=old?nearbyGround(view,pawn).find(c=>groundCapacity(view,c,old.item,pawn.id)>=1):undefined;
  if(old&&!drop)return false;
  if(old){assignPileOwner(old,{type:'ground',...drop!});delete old.weapon!.forbidden;}
  assignPileOwner(pile,{type:'equipment',pawnId:pawn.id});if(pawn.draft)delete pawn.draft.holdFire;delete pile.weapon!.forbidden;delete pawn.droppedWeaponId;return true;
}
export function processEquipment(world:World,pawn:Pawn,context:NeedContext):void {
  const task=pawn.equipmentTask;if(!task)return;
  const pile=world.piles.find(p=>p.id===task.itemId);
  if(!allowedAreaWorkAllowed(world,pawn)||equipmentReason(world,pawn,pile,task.action,true)){release(world,pawn);return;}
  if(task.action==='wear'||task.action==='remove'){processApparel(world,pawn,pile!,context);return;}
  if(task.action==='equip'){
    const cell=pile!.owner as Cell;
    if((pawn.x!==cell.x||pawn.z!==cell.z)&&!adjacent(pawn,cell)){context.move(cell,false);return;}
    if(exchange(world,pawn,pile!))announce(world,`${pawn.name} équipe ${weaponLabel(pile!)}.`);
    else announce(world,`${pawn.name} ne peut pas déposer son ancienne arme.`);
    release(world,pawn);return;
  }
  pawn.path=[];pawn.state='working';task.progress++;
  if(task.progress<3)return; // Core DropEquipment: 30 ticks, independent of skill.
  const drop=nearbyGround(world,pawn).find(c=>groundCapacity(world,c,pile!.item,pawn.id)>=1);
  if(drop){assignPileOwner(pile!,{type:'ground',...drop});pile!.weapon!.forbidden=true;announce(world,`${pawn.name} dépose ${weaponLabel(pile!)}.`);}
  else announce(world,`${pawn.name} garde son arme : aucun dépôt disponible.`);
  release(world,pawn);
}
/** Recover only the remembered primary weapon, not an unsolicited better gun.
 * Invoked at an idle decision after personal needs and accepted orders. */
export function recoverDroppedWeapon(world:World,pawn:Pawn,search:()=>Reachability|null):boolean {
  if(pawn.droppedWeaponId===undefined||equippedWeapon(world,pawn)||pawn.equipmentTask||pawn.orders.active!==null||pawn.jobId!==null||pawn.haul||pawn.cooking||pawn.tend||pawn.ward||pawn.feed||pawn.rescue||pawn.need||pawn.recreation.task)return false;
  const pile=world.piles.find(p=>p.id===pawn.droppedWeaponId);
  if(pile?.owner.type==='ground'&&allowedAreaReason(world,pawn,pile.owner))return false;
  if(equipmentReason(world,pawn,pile,'equip'))return false;
  const reach=search();if(!reach)return true;
  const path=routeToJob(world,pile!.owner as Cell,reach,true);if(!path)return false;
  begin(pawn,pile!.id,'equip',path,true);return true;
}
