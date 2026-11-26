import {filterPileEntries} from './pile-identity-directory.ts';
import { allowedAreaAllows,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { isArtMaterial, isArtRecipe, artWorkTotal, type ArtMaterial, type ArtRecipe } from './art-rules.ts';
import { ingredientPlaceFree } from './cooking-bills.ts';
import { groundCapacity, planGroundPlacement } from './ground-placement.ts';
import { healthRandom } from './health.ts';
import { addMaterial, refreshStock } from './materials.ts';
import { isCookingOrder } from './order-types.ts';
import { releaseAssignments } from './work-release.ts';
import type { Cell, CommandResult, MaterialPile, Pawn, World } from './types.ts';

export interface ArtWork {
  recipe: ArtRecipe;
  authorId: number;
  progress: number;
  material: ArtMaterial;
  /** One quantity per staged ingredient pile at incorporation. */
  parts: number[];
  billId?: number;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const artUnits = (recipe: ArtRecipe): number => recipe === 'small-sculpture' ? 50 : 100;

/** Incorporate the exact staged material only after a home for the workpiece is proved. */
export function beginArtWork(world: World, pawn: Pawn): MaterialPile | null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task = pawn.cooking, recipe = task?.recipe;
  if (!task || !isArtRecipe(recipe)) return null;
  if (task.ingredients.length === 1 && task.ingredients[0]?.item === 'unfinished-sculpture') {
    const ingredient = task.ingredients[0]!, existing = world.piles.find(p => p.id === ingredient.pileId);
    if (ingredient.quantity !== 1 || ingredient.stage !== 'placed' || existing?.item !== 'unfinished-sculpture'
      || existing.owner.type !== 'ground' || !existing.artWork || existing.artWork.recipe !== recipe
      || existing.artWork.authorId !== pawn.id || existing.artWork.billId !== undefined && existing.artWork.billId !== task.billId) return null;
    existing.artWork.billId = task.billId;
    return existing;
  }
  if (!task.ingredients.length) return null;
  const material = task.ingredients[0]?.item;
  if (!isArtMaterial(material,world.schemaVersion)) return null;
  const used = new Map<number, number>();
  let total = 0;
  for (const ingredient of task.ingredients) {
    if (ingredient.stage !== 'placed' || ingredient.item !== material || !integer(ingredient.quantity, 1, 75)) return null;
    const pile = world.piles.find(p => p.id === ingredient.pileId);
    if (!pile || pile.item !== material || pile.owner.type !== 'ground'
      || pile.owner.x !== ingredient.cell.x || pile.owner.z !== ingredient.cell.z) return null;
    total += ingredient.quantity;
    used.set(pile.id, (used.get(pile.id) ?? 0) + ingredient.quantity);
  }
  if (total !== artUnits(recipe) || [...used].some(([id,quantity]) => quantity > 75 || world.piles.find(p => p.id === id)!.quantity < quantity)) return null;
  const parts = [...used.values()];
  const piles = world.piles.map(p => used.has(p.id) ? {...p,quantity:p.quantity-used.get(p.id)!} : p).filter(p => p.quantity > 0);
  if (piles.length >= 32768 || !Number.isSafeInteger(world.nextId + 1)) return null;
  const shadow = {...world,piles}, spot = task.spot;
  const cells: Cell[] = [{x:spot.x,z:spot.z+1},{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z-1}];
  const cell = cells.find(c => allowedAreaAllows(world,pawn,c) && ingredientPlaceFree(shadow,c,spot,recipe) && groundCapacity(shadow,c,'unfinished-sculpture',pawn.id) >= 1);
  if (!cell) return null;
  const pile: MaterialPile = {id:world.nextId++,item:'unfinished-sculpture',kind:'unfinished',quantity:1,
    owner:{type:'ground',...cell},artWork:{recipe,authorId:pawn.id,progress:0,material,parts,billId:task.billId}};
  world.piles = [...piles,pile];
  task.ingredients = [{pileId:pile.id,item:'unfinished-sculpture',quantity:1,stage:'placed',cell:{...cell}}];
  refreshStock(world);
  return pile;
}

/** Each incorporated pile rounds independently; placement and ID budgets are checked
 * before changing assignments, the world or its random stream. */
export function cancelArtWork(world: World, itemId: number): CommandResult {
  const pile = world.piles.find(p => p.id === itemId);
  if (pile?.item !== 'unfinished-sculpture' || !pile.artWork || pile.owner.type !== 'ground')
    return {ok:false,code:'missing-target',reason:'Sculpture inachevée introuvable au sol.'};
  const random = {rng:world.rng};
  let refund = 0;
  for (const part of pile.artWork.parts) {
    const raw = part * .75, whole = Math.floor(raw);
    refund += whole + (raw > whole && healthRandom(random) < raw-whole ? 1 : 0);
  }
  const shadow = {...world,piles:world.piles.filter(p => p !== pile)};
  const material = pile.artWork.material, placements = planGroundPlacement(shadow,refund,pile.owner,material);
  if (!placements || shadow.piles.length + placements.length > 32768 || !Number.isSafeInteger(world.nextId + placements.length))
    return {ok:false,code:'occupied',reason:'Aucune place pour conserver tous les matériaux récupérés.'};
  for (const pawn of world.pawns) {
    if (pawn.cooking?.ingredients.some(i => i.pileId === itemId) || pawn.haul?.sourcePileId === itemId) releaseAssignments(world,pawn);
    pawn.orders.queue = pawn.orders.queue.filter(o => typeof o === 'number' || (isCookingOrder(o)
      ? !o.cooking.ingredients.some(i => i.pileId === itemId) : o.sourcePileId !== itemId));
  }
  world.piles = filterPileEntries(world.piles,p => p !== pile);
  for (const placement of placements) addMaterial(world,material === 'wood' ? 'wood' : material === 'steel' ? 'steel' : material === 'jade' ? 'jade' : 'blocks',placement.quantity,{type:'ground',...placement.cell},material);
  world.rng = random.rng;
  return {ok:true};
}

export function detachMissingArtBills(world: World): void {
  if (!world.piles.some(p => p.artWork?.billId)) return;
  const bills = new Set([...world.structures,...world.packed.map(p => p.building)].flatMap(s => s.bills?.map(b => b.id) ?? []));
  for (const pile of world.piles) if (pile.artWork?.billId && !bills.has(pile.artWork.billId)) delete pile.artWork.billId;
}

export function validArtWorkShape(p: Record<string, unknown>, version: number): boolean {
  if (p.item !== 'unfinished-sculpture') return p.artWork === undefined;
  const work = p.artWork, owner = p.owner;
  if (version < 104 || p.kind !== 'unfinished' || p.quantity !== 1 || !record(owner)
    || !['ground','pawn'].includes(String(owner.type)) || !record(work) || !isArtRecipe(work.recipe)) return false;
  if (Object.keys(work).some(k => !['recipe','authorId','progress','material','parts','billId'].includes(k))
    || !integer(work.authorId,1) || !isArtMaterial(work.material,version)
    || !integer(work.progress,0,artWorkTotal(work.recipe,work.material))
    || work.billId !== undefined && !integer(work.billId,1)
    || !Array.isArray(work.parts) || work.parts.length < 1 || work.parts.length > 100
    || !work.parts.every(n => integer(n,1,75))) return false;
  return work.parts.reduce((total:number,n:number) => total+n,0) === artUnits(work.recipe);
}

export function validateArtWorks(world: World, version: number): string[] {
  const errors: string[] = [], bound = new Set<number>();
  for (const pile of world.piles) {
    if (pile.item !== 'unfinished-sculpture' && pile.artWork === undefined) continue;
    if (!validArtWorkShape(pile as unknown as Record<string,unknown>,version)) {errors.push('Invalid unfinished sculpture.');continue;}
    const work = pile.artWork!;
    if (!world.pawns.some(p => p.id === work.authorId)) errors.push('Missing unfinished sculpture author.');
    if (work.billId !== undefined) {
      if (bound.has(work.billId) || ![...world.structures,...world.packed.map(p => p.building)]
        .some(s => s.bills?.some(b => b.id === work.billId && b.recipe === work.recipe))) errors.push('Invalid unfinished sculpture bound bill.');
      bound.add(work.billId);
    }
  }
  return errors;
}
