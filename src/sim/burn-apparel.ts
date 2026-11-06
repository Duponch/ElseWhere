import { allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { isColonist } from './affiliation.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { canStandAt } from './furniture-travel.ts';
import { cookingSpot,ingredientPlaceFree,validBillSettings } from './cooking-bills.ts';
import {burnApparelIngredientAllowed,isBurnApparelRecipe,validBurnApparelIngredients} from './burn-apparel-rules.ts';
import {foodStationUsable} from './food-workstations.ts';
import { neutralLossPlan } from './destruction-losses.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { refreshStock,reservedSource } from './materials.ts';
import { productionStationUsable,productionWorkTotal } from './production-recipes.ts';
import { workPriority } from './work-types.ts';
import type { CookingBill } from './cooking-types.ts';
import type { ProductionContext } from './production-output.ts';
import type { Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** Destroy one original garment atomically. No output, identity allocation, XP or RNG. */
export function finishBurnApparel(world:World,pawn:Pawn,bill:CookingBill,context:ProductionContext):boolean {
  const task=pawn.cooking;
  if(world.schemaVersion<251||!task||!isBurnApparelRecipe(task.recipe)||task.phase!=='work'||task.progress!==productionWorkTotal(task.recipe)
    ||!validBurnApparelIngredients(task.ingredients)||task.ingredients[0]!.stage!=='placed'
    ||task.productId!==null||task.storageId!==null||Object.hasOwn(task,'storageQuantity')||Object.hasOwn(task,'workTicks')
    ||!world.pawns.includes(pawn)||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue
    ||(pawn.motion?.end??0)>world.tick||pawn.moveCooldown>0||pawn.stun||pawn.draft||pawn.burning||pawn.mental?.crisis||pawn.collapsePending
    ||medicalWorkRefusal(pawn)||backgroundWorkRefusal(pawn,'haul')||workPriority(pawn,'haul')===0||!allowedAreaWorkAllowed(world,pawn))return false;
  const station=structureById(world,task.stationId),ingredient=task.ingredients[0]!,garment=world.piles.find(p=>p.id===ingredient.pileId);
  if(!station||station.kind!=='electric-crematorium'&&station.kind!=='campfire'||!productionStationUsable(station)||!foodStationUsable(station)||!station.bills?.includes(bill)
    ||bill.id!==task.billId||!isBurnApparelRecipe(bill.recipe)||!validBillSettings(bill,bill.recipe,world.schemaVersion)||bill.suspended||!['times','forever'].includes(bill.mode)||bill.destination!=='drop'
    ||!Number.isSafeInteger(bill.target)||bill.target<0||bill.target>9999||bill.mode==='times'&&bill.target<=0
    ||task.spot.x!==cookingSpot(station).x||task.spot.z!==cookingSpot(station).z
    ||!ingredientPlaceFree(world,ingredient.cell,task.spot,task.recipe,station)||!canStandAt(world,ingredient.cell)
    ||pawn.x!==task.spot.x||pawn.z!==task.spot.z||!garment||garment.item!==ingredient.item||!burnApparelIngredientAllowed(bill,garment)
    ||garment.owner.type!=='ground'||garment.owner.x!==ingredient.cell.x||garment.owner.z!==ingredient.cell.z
    ||reservedSource(world,garment.id,pawn.id)>0||pawn.interruptedCargo
    ||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id))return false;
  const loss=neutralLossPlan(world,{items:{[garment.item]:1}});if(!loss)return false;
  world.piles=world.piles.filter(p=>p!==garment);world.destroyed=loss;
  if(bill.mode==='times')bill.target--;
  pawn.cooking=null;if(pawn.orders.active==='cook')pawn.orders.active=null;
  pawn.path=[];pawn.state='idle';pawn.planCooldown=0;
  refreshStock(world);context.event(`${pawn.name} a brûlé un vêtement sans récupérer de matière ni combustible.`);
  return true;
}
