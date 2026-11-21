import { artisticSkill, artWorkTotal, isArtRecipe } from './art-rules.ts';
import { craftingQuality } from './crafting-quality.ts';
import { healthRandom } from './health.ts';
import { useInspiration360 } from './inspirations-360.ts';
import type { ProductionContext } from './production-output.ts';
import type { CookingTask } from './cooking-types.ts';
import type { Pawn, Structure, World } from './types.ts';

/** An authored workpiece becomes one whole, minifiable building. No material
 * or random state is consumed until the object and identity budgets are safe. */
export function completeArtProduction(world: World,pawn: Pawn,task: CookingTask,context: ProductionContext): boolean {
  if (!isArtRecipe(task.recipe) || task.phase !== 'work' || task.ingredients.length !== 1) return false;
  const ingredient = task.ingredients[0]!, workpiece = world.piles.find(p => p.id === ingredient.pileId);
  const work = workpiece?.artWork;
  if (ingredient.item !== 'unfinished-sculpture' || ingredient.quantity !== 1 || ingredient.stage !== 'placed'
    || workpiece?.item !== 'unfinished-sculpture' || workpiece.owner.type !== 'ground' || workpiece.quantity !== 1
    || !work || work.recipe !== task.recipe || work.authorId !== pawn.id || work.billId !== task.billId
    || task.progress < artWorkTotal(work.recipe,work.material) || work.progress !== task.progress
    || world.packed.some(p => p.owner.type === 'pawn' && p.owner.pawnId === pawn.id)
    || world.piles.some(p => p.owner.type === 'pawn' && p.owner.pawnId === pawn.id)
    || world.packed.length >= 32768 || !Number.isSafeInteger(world.nextId + 1)) return false;
  const station = world.structures.find(s => s.id === task.stationId);
  const bill = station?.bills?.find(b => b.id === task.billId && b.recipe === task.recipe);
  if (!station || !bill || bill.suspended) return false;
  const random = {rng:world.rng};
  const quality = craftingQuality(artisticSkill(pawn).level,() => healthRandom(random),useInspiration360(world,pawn,'creativity'));
  const building: Structure = {id:world.nextId,kind:work.recipe,x:task.spot.x,z:task.spot.z,
    orientation:0,footprint:'standard',material:work.material,quality,art:{authorId:pawn.id,createdAt:world.tick}};
  world.piles = world.piles.filter(p => p !== workpiece);
  world.packed.push({building,owner:{type:'pawn',pawnId:pawn.id}});
  world.nextId++;
  world.rng = random.rng;
  task.ingredients = [];
  task.productId = building.id;
  task.phase = 'output';
  task.progress = 0;
  task.storageId = null;
  delete task.storageQuantity;
  pawn.path = [];
  pawn.planCooldown = 0;
  if (bill.mode === 'times') bill.target = Math.max(0,bill.target-1);
  context.event(`${pawn.name} a achevé une ${work.recipe === 'small-sculpture' ? 'petite' : 'grande'} sculpture.`);
  return true;
}
