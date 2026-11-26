import {filterPileEntries} from './pile-identity-directory.ts';
import {interruptWork} from './interrupted-cargo.ts';
import { ANIMAL_MEAT_ITEMS } from './biome-items.ts';
import { emptySpoilage, isPerishable, ticksUntilRot } from './food-preservation.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { releaseWork } from './work-release.ts';
import type { World } from './types.ts';
import {thermalPileOwners379} from './perishable-pile-owners-379.ts';

/** Expire before actions: a last-tick ingredient cannot be ingested or cooked.
 * Only an expiry allocates a set or reconciles tasks; normal checks leave ages intact. */
export function expireFood(world: World): void {
  let expired: Set<number> | undefined;
  let losses: ReturnType<typeof emptySpoilage> | undefined;
  for (const pile of thermalPileOwners379(world)) if (pile.kind!=='corpse' && isPerishable(pile.item) && ticksUntilRot(pile, world.tick) <= 0) {
    (expired ??= new Set()).add(pile.id);
    losses??=emptySpoilage();losses[pile.item]=(losses[pile.item]??0)+pile.quantity;
  }
  if (!expired) return;
  const expiredCarriers=new Set(world.piles.filter(p=>expired.has(p.id)&&p.owner.type==='pawn').map(p=>p.owner.type==='pawn'?p.owner.pawnId:-1));
  world.piles = filterPileEntries(world.piles,pile => !expired.has(pile.id));
  for (const pawn of world.pawns) {
    // A retained payload still ages normally; its loss does not cancel sleep.
    if(pawn.interruptedCargo&&expiredCarriers.has(pawn.id)){delete pawn.interruptedCargo;pawn.planCooldown=0;}
    const c = pawn.cooking, h = pawn.haul, n = pawn.need;
    const affected = c && (c.ingredients.some(i => expired.has(i.pileId)) || c.productId !== null && expired.has(c.productId))
      || h && expired.has(h.phase === 'pickup' ? h.sourcePileId : h.carryPileId!)
      || pawn.animalHandling && expired.has(pawn.animalHandling.phase==='pickup'?pawn.animalHandling.sourcePileId:pawn.animalHandling.carryPileId!)
      || pawn.animalFeed && expired.has(pawn.animalFeed.phase==='pickup'?pawn.animalFeed.sourcePileId:pawn.animalFeed.carryPileId!)
      || pawn.animalCare?.medicine && expired.has(pawn.animalCare.phase==='pickup'?pawn.animalCare.medicine.sourcePileId:pawn.animalCare.medicine.carryPileId!)
      || pawn.tend?.medicine && expired.has(pawn.tend.phase==='pickup'?pawn.tend.medicine.sourcePileId:pawn.tend.medicine.carryPileId!)
      || pawn.feed && expired.has((pawn.feed.phase==='pickup'?pawn.feed.sourcePileId:pawn.feed.carryPileId)??-1)
      || pawn.ward?.kind==='food' && expired.has(pawn.ward.phase==='pickup'?pawn.ward.sourcePileId:pawn.ward.carryPileId!)
      || n?.kind === 'eat' && expired.has((n.phase === 'pickup' ? n.sourcePileId : n.carryPileId)??-1);
    if(affected&&c?.recipe==='make-pemmican'){interruptWork(world,pawn,true);continue;}
    if (!affected || releaseWork(world, pawn)) continue;
    // Another ingredient may still be carried when a remote reservation rots.
    // Retain that cargo until a physical drop is possible, without dangling IDs
    // or pretending that an incomplete recipe can resume its work progress.
    if (c) {
      c.ingredients = c.ingredients.filter(i => i.stage === 'held' && !expired.has(i.pileId));
      c.phase = 'interrupted'; c.progress = 0; delete c.workTicks; c.productId = null; c.storageId = null;
      pawn.path = []; pawn.state = pawn.moveCooldown > 0 ? 'moving' : 'working';
    }
  }
  for (const item of ['raw-fungus','pemmican','hay','nutrient-paste-meal','berries', 'milk', 'rice', 'potato', 'corn', 'simple-meal','fine-meal','vegetarian-fine-meal','carnivore-fine-meal','lavish-meal','vegetarian-lavish-meal','carnivore-lavish-meal','herbal-medicine','agave-fruit',...ANIMAL_MEAT_ITEMS] as const) if (losses![item]) {
    world.spoiled[item]=(world.spoiled[item]??0)+losses![item]!;
    world.events.push({ tick: world.tick, type: 'need', message: `${losses![item]} ${ITEM_DEFINITIONS[item].label} ont pourri.` });
  }
  if (world.events.length > 80) world.events.splice(0, world.events.length - 80);
}
