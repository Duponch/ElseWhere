import {isLongswordItem270,longswordMaterial270,longswordUnits270} from './longsword-content-270.ts';
import {isSpearItem272,spearMaterial272,spearUnits272} from './spear-content-272.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {isMaceItem269,maceMaterial269,maceUnits269} from './mace-content-269.ts';
import type {WeaponItem} from './equipment-rules.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {isSmithingApparel267,smithingApparelUnits267,type SmithingApparel267} from './smithing-apparel-267.ts';
import { healthRandom } from './health.ts';
import { reservedSource,refreshStock } from './materials.ts';
import { productionStationUsable,productionWorkTotal } from './production-recipes.ts';
import { isWeaponItem } from './equipment-rules.ts';
import { pawnBody } from './health-rules.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { cookingSpot,ingredientWithinReach } from './cooking-bills.ts';
import { workPriority } from './work-types.ts';
import { isSmeltingRecipe,smeltingIngredientAllowed,smeltingProduct,smeltingYield,validSmeltingIngredients } from './smelting-rules.ts';
import type { CookingBill } from './cooking-types.ts';
import type { ProductionContext } from './production-output.ts';
import type { Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** One indivisible input becomes one complete legal metal pile after preflight. */
export function finishSmelting(world:World,pawn:Pawn,bill:CookingBill,context:ProductionContext):boolean {
  const task=pawn.cooking;
  if(world.schemaVersion<222||!task||task.recipe==='smelt-apparel'&&world.schemaVersion<267||task.recipe==='smelt-slag'&&!isSchema256Or257(world.schemaVersion)||!isSmeltingRecipe(task.recipe)||task.phase!=='work'||task.progress!==productionWorkTotal(task.recipe)
    ||!validSmeltingIngredients(task.ingredients,task.recipe)||task.ingredients[0]!.stage!=='placed'||(pawn.motion?.end??0)>world.tick||pawn.stun||pawn.draft
    ||pawn.state==='dead'||pawn.state==='downed'||pawnBody(pawn).capacities.manipulation<=0||backgroundWorkRefusal(pawn,'craft'))return false;
  const station=structureById(world,task.stationId),ingredient=task.ingredients[0]!,weapon=world.piles.find(p=>p.id===ingredient.pileId);
  if(!station||station.kind!=='electric-smelter'||!productionStationUsable(station)||!station.bills?.includes(bill)
    ||bill.id!==task.billId||bill.recipe!==task.recipe||!isSmeltingRecipe(bill.recipe)||bill.suspended||!(task.recipe==='smelt-slag'?['times','until','forever']:['times','forever']).includes(bill.mode)
    ||!Number.isSafeInteger(bill.target)||bill.target<0||bill.target>9999||bill.mode==='times'&&bill.target<=0
    ||workPriority(pawn,'craft')===0&&pawn.orders.active!=='cook'
    ||task.spot.x!==cookingSpot(station).x||task.spot.z!==cookingSpot(station).z||!ingredientWithinReach(ingredient.cell,task.spot,station)
    ||pawn.x!==task.spot.x||pawn.z!==task.spot.z||!weapon||!(task.recipe==='smelt-slag'?weapon.item==='slag-steel-chunk':task.recipe==='smelt-apparel'?isSmithingApparel267(weapon.item):isWeaponItem(weapon.item))||weapon.item!==ingredient.item
    ||!smeltingIngredientAllowed(bill,weapon)||weapon.owner.type!=='ground'||weapon.owner.x!==ingredient.cell.x||weapon.owner.z!==ingredient.cell.z
    ||reservedSource(world,weapon.id,pawn.id)>0||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)
    ||world.piles.length>32768||!Number.isSafeInteger(world.nextId+1))return false;
  const item=task.recipe==='smelt-slag'?'steel':smeltingProduct(weapon.item as WeaponItem|SmithingApparel267);
  const maximum=task.recipe==='smelt-apparel'?Math.ceil(smithingApparelUnits267(weapon.item as SmithingApparel267)*.25):task.recipe==='smelt-slag'?15:isSpearItem272(weapon.item)?Math.ceil(spearUnits272(spearMaterial272(weapon.item))*.25):isLongswordItem270(weapon.item)?Math.ceil(longswordUnits270(longswordMaterial270(weapon.item))*.25):isMaceItem269(weapon.item)?Math.ceil(maceUnits269(maceMaterial269(weapon.item))*.25):19;
  // silver/gold425 fit their500-unit stacks. Ordinary metals fit75. Reserve
  // the entire potential output before drawing or removing the original.
  if(!Number.isSafeInteger(maximum)||maximum<1||maximum>ITEM_DEFINITIONS[item].stackLimit)return false;
  const random={rng:world.rng},quantity=task.recipe==='smelt-slag'?15:smeltingYield(weapon.item as WeaponItem|SmithingApparel267,()=>healthRandom(random));
  // Consuming this whole input frees the single output slot, including at the pile limit.
  world.piles=world.piles.filter(p=>p!==weapon);
  const id=world.nextId++;world.piles.push({id,item,kind:item,quantity,owner:{type:'pawn',pawnId:pawn.id}});
  world.rng=random.rng;task.ingredients=[];task.productId=id;task.phase='output';task.progress=0;task.storageId=null;
  delete task.workTicks;delete task.storageQuantity;
  pawn.path=[];pawn.planCooldown=0;
  if(bill.mode==='times')bill.target--;
  refreshStock(world);context.event(task.recipe==='smelt-slag'?`${pawn.name} a extrait 15 acier d’une scorie.`:`${pawn.name} a fondu ${task.recipe==='smelt-apparel'?'un vêtement':'une arme'} et récupéré ${quantity} ${ITEM_DEFINITIONS[item].label.toLowerCase()}.`);
  return true;
}
