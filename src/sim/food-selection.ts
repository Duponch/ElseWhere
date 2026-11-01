import {ANIMAL_EGG_CONTENT_256,eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import { isAnimalMeat } from './biome-items.ts';
import { interactionGoals, routeCost, routeToJob, routeToCell, type Reachability } from './pathfinding.ts';
import { planPasteRequest,type PasteRequest } from './nutrient-paste.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { allowedFood, type FoodItemId } from './food-policy.ts';
import { selfAllowedFood,selfFoodAccessible,assistedFoodAccessible } from './prison-food.ts';
import { capturePrisonTopology } from './prison-space.ts';
import type { RoomTopology } from './room-topology.ts';
import { TICKS_PER_DAY } from './types.ts';
import type { Cell, MaterialPile, Pawn, World } from './types.ts';

/** Neutral adult. Reference mood curve maps raw-food -7 to
 * -82 optimality; survival packs have a -5 definition offset. The +12 bonus
 * for imminent spoilage is applied to physical piles; traits remain open. */
const FOOD_OFFSETS: Readonly<Partial<Record<ItemId, number>>> = {
  pemmican:6,kibble:-1270/9,
  wood: -Infinity, 'nutrient-paste-meal': -49, 'simple-meal': 16, 'fine-meal': 20, 'vegetarian-fine-meal': 20, 'carnivore-fine-meal': 20, 'lavish-meal': 24, 'vegetarian-lavish-meal': 24, 'carnivore-lavish-meal': 24, berries: 0, milk: 0, rice: -82, potato: -82, corn: -82, 'hare-meat': -82, 'survival-meal': -5, 'legacy-portion': 0,
};
export function foodScore(item: ItemId, distance: number): number {
  const species=eggSpeciesForItem256(item);
  if(species)return -distance-82-(item===ANIMAL_EGG_CONTENT_256[species].fertilizedItem?150:0);
  return (FOOD_OFFSETS[item] ?? (isAnimalMeat(item)||item==='agave-fruit'||item==='raw-fungus'?-82:-Infinity)) - distance;
}
export function pileFoodScore(world: World, pile: MaterialPile, distance: number): number {
  return foodScore(pile.item, distance) + (ticksUntilRot(pile, world.tick) < TICKS_PER_DAY / 2 ? 12 : 0);
}
export function foodSearchGoals(world: World, pawn: Pawn, sources: readonly MaterialPile[], topology?:RoomTopology,ignoreForbidden=false): Set<number> {
  if(!topology&&(pawn.prisoner||world.structures.some(s=>s.prisoner)))topology=capturePrisonTopology(world);
  const allowed = selfAllowedFood(world, pawn); sources = sources.filter(p => allowed.includes(p.item as FoodItemId)&&selfFoodAccessible(world,pawn,p,topology,ignoreForbidden));
  if (world.foodRules === 'legacy') return interactionGoals(world, sources.flatMap(p => p.owner.type === 'ground' ? [p.owner] : []));
  let best: MaterialPile | undefined, score = -Infinity;
  for (const pile of sources) {
    if (pile.owner.type !== 'ground') continue;
    const rank = pileFoodScore(world, pile, Math.abs(pawn.x-pile.owner.x)+Math.abs(pawn.z-pile.owner.z));
    if (rank > score || (rank === score && (!best || pile.id < best.id))) { best=pile; score=rank; }
  }
  // If this target is unreachable, the flood exhausts the connected component:
  // selectFood can then find the best accessible fallback without another search.
  return interactionGoals(world, best?.owner.type === 'ground' ? [best.owner] : []);
}
export function selectFood(world: World, pawn: Pawn, sources: readonly MaterialPile[], reachable: Reachability, eater: Pawn = pawn, topology?:RoomTopology,ignoreForbidden=false): { id: number; path: Cell[]; score: number } | undefined {
  const allowed = eater===pawn?selfAllowedFood(world,pawn):allowedFood(world,eater);
  if(!topology&&(pawn.prisoner||eater.prisoner||world.structures.some(s=>s.prisoner)))topology=capturePrisonTopology(world);
  let best: { id: number; path: Cell[]; score: number } | undefined;
  for (const pile of sources) {
    if (pile.owner.type !== 'ground' || !ITEM_DEFINITIONS[pile.item].nutrition || !allowed.includes(pile.item as FoodItemId)) continue;
    if(!(eater===pawn?selfFoodAccessible(world,pawn,pile,topology,ignoreForbidden):assistedFoodAccessible(world,pawn,eater,pile,topology)))continue;
    // Reference map search uses Manhattan distance for ranking, independently
    // of the Euclidean travel duration and actual reachability of the item.
    const distance = Math.abs(pawn.x - pile.owner.x) + Math.abs(pawn.z - pile.owner.z);
    const score = pileFoodScore(world, pile, distance);
    if (world.foodRules !== 'legacy' && best && score < best.score) continue;
    const path = routeToJob(world, pile.owner, reachable, true);
    if (!path) continue;
    const cost = routeCost(world, path, reachable);
    const rank = world.foodRules === 'legacy' ? -cost : score;
    if (!best || rank > best.score || (rank === best.score && pile.id < best.id)) best = { id: pile.id, path, score: rank };
  }
  return best;
}

export type FoodSourceSelection={kind:'pile';id:number;path:Cell[];score:number}
  |{kind:'paste';request:PasteRequest;path:Cell[];score:number};
/** Keep pile-only selectFood for callers that cannot operate a dispenser. */
export function selectFoodSource(world:World,pawn:Pawn,sources:readonly MaterialPile[],reachable:Reachability,eater:Pawn=pawn,topology?:RoomTopology,ignoreForbidden=false):FoodSourceSelection|undefined {
  const pile=selectFood(world,pawn,sources,reachable,eater,topology,ignoreForbidden);
  let best:FoodSourceSelection|undefined=pile?{kind:'pile',...pile}:undefined;
  for(const dispenser of world.structures){
    if(dispenser.kind!=='nutrient-paste-dispenser')continue;
    const request=planPasteRequest(world,pawn,dispenser,eater,topology);if(!request)continue;
    const score=foodScore('nutrient-paste-meal',Math.abs(pawn.x-dispenser.x)+Math.abs(pawn.z-dispenser.z));
    if(world.foodRules!=='legacy'&&best&&score<best.score)continue;
    const path=routeToCell(world,request.spot,reachable);if(!path)continue;
    const rank=world.foodRules==='legacy'?-routeCost(world,path,reachable):score;
    const bestId=best?.kind==='pile'?best.id:best?.request.dispenserId;
    if(!best||rank>best.score||rank===best.score&&dispenser.id<bestId!)best={kind:'paste',request,path,score:rank};
  }
  return best;
}
/** The partial flood targets the best ranked source, including its exact
 * machine interaction cell. An unreachable winner exhausts the component. */
export function foodSourceSearchGoals(world:World,pawn:Pawn,sources:readonly MaterialPile[],topology?:RoomTopology,ignoreForbidden=false):Set<number> {
  if(!topology&&(pawn.prisoner||world.structures.some(s=>s.prisoner)))topology=capturePrisonTopology(world);
  const goals=foodSearchGoals(world,pawn,sources,topology,ignoreForbidden),allowed=selfAllowedFood(world,pawn);
  let bestScore=-Infinity,bestId=Infinity;
  if(world.foodRules!=='legacy')for(const p of sources){
    if(p.owner.type!=='ground'||!allowed.includes(p.item as FoodItemId)||!selfFoodAccessible(world,pawn,p,topology,ignoreForbidden))continue;
    const score=pileFoodScore(world,p,Math.abs(pawn.x-p.owner.x)+Math.abs(pawn.z-p.owner.z));
    if(score>bestScore||score===bestScore&&p.id<bestId){bestScore=score;bestId=p.id;}
  }
  for(const dispenser of world.structures){
    if(dispenser.kind!=='nutrient-paste-dispenser')continue;
    const request=planPasteRequest(world,pawn,dispenser,pawn,topology);if(!request)continue;
    const index=request.spot.z*world.width+request.spot.x;
    if(world.foodRules==='legacy'){goals.add(index);continue;}
    const score=foodScore('nutrient-paste-meal',Math.abs(pawn.x-dispenser.x)+Math.abs(pawn.z-dispenser.z));
    if(score>bestScore||score===bestScore&&dispenser.id<bestId){bestScore=score;bestId=dispenser.id;goals.clear();goals.add(index);}
  }
  return goals;
}
