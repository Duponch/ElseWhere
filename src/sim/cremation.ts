import {planAnimalBodyRetirement256} from './animal-body-retirement-256.ts';
import { allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { isColonist } from './affiliation.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { canStandAt } from './furniture-travel.ts';
import { cookingSpot,ingredientPlaceFree,validBillSettings } from './cooking-bills.ts';
import { cremationIngredientAllowed,isCremationRecipe,validCremationIngredients } from './cremation-rules.ts';
import { neutralLossPlan } from './destruction-losses.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { destroyHumanCorpse } from './human-corpses.ts';
import { refreshStock,reservedSource } from './materials.ts';
import { productionStationUsable,productionWorkTotal } from './production-recipes.ts';
import { workPriority } from './work-types.ts';
import type { CookingBill } from './cooking-types.ts';
import type { ProductionContext } from './production-output.ts';
import type { Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** Retire one original body atomically. No output, identity allocation, XP or RNG. */
export function finishCremation(world:World,pawn:Pawn,bill:CookingBill,context:ProductionContext):boolean {
  const task=pawn.cooking;
  if(world.schemaVersion<225||!task||!isCremationRecipe(task.recipe)||task.phase!=='work'||task.progress!==productionWorkTotal(task.recipe)
    ||!validCremationIngredients(task.ingredients)||task.ingredients[0]!.stage!=='placed'
    ||task.productId!==null||task.storageId!==null||Object.hasOwn(task,'storageQuantity')||Object.hasOwn(task,'workTicks')
    ||!world.pawns.includes(pawn)||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue
    ||(pawn.motion?.end??0)>world.tick||pawn.moveCooldown>0||pawn.stun||pawn.draft||pawn.burning||pawn.mental?.crisis||pawn.collapsePending
    ||medicalWorkRefusal(pawn)||backgroundWorkRefusal(pawn,'haul')||workPriority(pawn,'haul')===0||!allowedAreaWorkAllowed(world,pawn))return false;
  const station=structureById(world,task.stationId),ingredient=task.ingredients[0]!,corpse=world.piles.find(p=>p.id===ingredient.pileId);
  if(!station||station.kind!=='electric-crematorium'||!productionStationUsable(station)||!station.bills?.includes(bill)
    ||bill.id!==task.billId||!isCremationRecipe(bill.recipe)||!validBillSettings(bill,bill.recipe,world.schemaVersion)||bill.suspended||!['times','forever'].includes(bill.mode)||bill.destination!=='drop'
    ||!Number.isSafeInteger(bill.target)||bill.target<0||bill.target>9999||bill.mode==='times'&&bill.target<=0
    ||task.spot.x!==cookingSpot(station).x||task.spot.z!==cookingSpot(station).z
    ||!ingredientPlaceFree(world,ingredient.cell,task.spot,task.recipe,station)||!canStandAt(world,ingredient.cell)
    ||pawn.x!==task.spot.x||pawn.z!==task.spot.z||!corpse||corpse.item!==ingredient.item||!cremationIngredientAllowed(world,bill,corpse)
    ||corpse.owner.type!=='ground'||corpse.owner.x!==ingredient.cell.x||corpse.owner.z!==ingredient.cell.z
    ||corpse.humanCorpse&&world.pawns.some(p=>p.id!==pawn.id&&p.burial?.bodyPawnId===corpse.humanCorpse!.pawnId)
    ||reservedSource(world,corpse.id,pawn.id)>0||pawn.interruptedCargo
    ||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id))return false;
  // All non-loss preflights precede the existing whole-human transaction.
  if(corpse.humanCorpse){
    if(!destroyHumanCorpse(world,corpse,'cremation'))return false;
  }else if(world.schemaVersion>=256){
    const contents=planAnimalBodyRetirement256(world,corpse.id,true);if(!contents||!contents.commit())return false;
  }else{
    const loss=neutralLossPlan(world,{items:{[corpse.item]:1}});if(!loss)return false;
    world.piles=world.piles.filter(p=>p!==corpse);world.destroyed=loss;
  }
  if(bill.mode==='times')bill.target--;
  pawn.cooking=null;if(pawn.orders.active==='cook')pawn.orders.active=null;
  pawn.path=[];pawn.state='idle';pawn.planCooldown=0;
  refreshStock(world);context.event(`${pawn.name} a incinéré une dépouille et ses possessions encore attachées.`);
  return true;
}
