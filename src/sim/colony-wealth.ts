import {captureShipCasketHumans277,captureShipCasketAnimals277} from './ship-casket-state-277.ts';
import {APPAREL_TRADE_MATERIAL_VALUES_279} from './apparel-trade-279.ts';
import {hasSmoothedStoneSubstrate281} from './smooth-floor-terrain-281.ts';
import {animalHaulContents282} from './animal-haul-contents-282.ts';
import { factionOf } from './affiliation.ts';
import { floorRoomMarketValue, structureRoomMarketValue } from './room-market-value.ts';
import { pileMarketValue } from './trade-prices.ts';
import { tradeCatalogueEntry } from './trade-catalogue.ts';
import { isPlayerCasket271 } from './cryptosleep-state-271.ts';
import type { ItemId } from './items.ts';
import type { MaterialPile, Pawn, Structure, World } from './types.ts';

/** Values unavailable from the saved model are reported, never silently
 * replaced by a generic price. Known totals are lower bounds in that case. */
export interface ColonyWealth {
  readonly items: number;
  readonly structures: number;
  readonly floors: number;
  readonly pawnsKnown: number;
  readonly knownTotal: number;
  readonly knownStorytellerWealth: number;
  readonly unpricedPileIds: readonly number[];
  readonly unpricedPackedIds: readonly number[];
  readonly unpricedStructureIds: readonly number[];
  readonly unpricedPawnIds: readonly number[];
  readonly complete: boolean;
}

const colonyPawn = (p: Pawn | undefined): boolean => !!p && factionOf(p) === 'colony' && p.state !== 'dead' && !p.prisoner && !p.visitor;

/** The map's ground haulables count irrespective of their previous faction.
 * Contents held by a neutral trader or raider do not count. Construction
 * deliveries and grave contents remain physical piles and are counted once. */
function pileOnPlayerMap(pile: MaterialPile, pawns: ReadonlyMap<number, Pawn>): boolean {
  const owner = pile.owner;
  if (owner.type === 'ground' || owner.type === 'job' || owner.type === 'grave') return true;
  return 'pawnId' in owner&&colonyPawn(pawns.get(owner.pawnId));
}

const MATERIAL_VALUE: Readonly<Partial<Record<ItemId, number>>> = Object.freeze({
  ...APPAREL_TRADE_MATERIAL_VALUES_279,
  wood: 1.2, silver:1, steel: 1.9, jade:5, component: 32, 'advanced-component': 200, plasteel: 9, gold: 10, uranium: 6,
  'granite-blocks': .9, 'limestone-blocks': .9, 'marble-blocks': .9,
  'sandstone-blocks': .9, 'slate-blocks': .9,
});

/** Incorporated ingredients do not remain as separate piles. Their known
 * physical input value follows the unfinished workpiece across interruptions.
 * No value is assigned to progress or an unknown ingredient. */
function unfinishedIngredientValue(pile: MaterialPile): number | undefined {
  if (pile.artWork) {
    const unit = MATERIAL_VALUE[pile.artWork.material];
    return unit === undefined ? undefined : unit * pile.artWork.parts.reduce((a,b) => a+b,0);
  }
  if (pile.prostheticWork273 || pile.gunWork || pile.flakWork || pile.smithingWork) {
    let sum = 0;
    for (const part of (pile.prostheticWork273 ?? pile.smithingWork ?? pile.gunWork ?? pile.flakWork!).parts) {
      const unit = MATERIAL_VALUE[part.item];
      if (unit === undefined) return undefined;
      sum += unit * part.quantity;
    }
    return sum;
  }
  if (pile.componentWork) {
    if (pile.componentWork.recipe === 'make-component') return MATERIAL_VALUE.steel! * pile.componentWork.parts.reduce((a,b)=>a+b,0);
    let sum = 0;
    for (const part of pile.componentWork.parts) {
      const unit = MATERIAL_VALUE[part.item];
      if (unit === undefined) return undefined;
      sum += unit * part.quantity;
    }
    return sum;
  }
  if (pile.unfinished) {
    const material = pile.unfinished.material ?? 'cloth';
    const unit = MATERIAL_VALUE[material];
    return unit === undefined ? undefined : unit * pile.unfinished.parts.reduce((a,b) => a+b,0);
  }
  return undefined;
}

function knownPileValue(pile: MaterialPile, version: number): number | undefined {
  if (pile.kind === 'chunk') return 0; // Core ChunkRockBase has no cost, work or MarketValue.
  if (pile.kind === 'unfinished') return unfinishedIngredientValue(pile);
  // A known market value is independent of whether the visitor trades it.
  if (!tradeCatalogueEntry(pile.item)) return undefined;
  const unit = pileMarketValue(pile, version);
  return unit === undefined ? undefined : unit * pile.quantity;
}

export function colonyWealth(world: World): ColonyWealth {
  // Installed holders keep their original people and goods on this map.
  // Archived holders from removed maps are deliberately outside this reader.
  // Authority validation already owns the full contents guard. This read
  // visits only installed structures, without revalidating every held field.
  const held = world.structures.filter(isPlayerCasket271).flatMap(c=>{
    const h=c.cryptosleep;return h.human?[{pawn:h.human,items:h.items,packed:h.packed}]:[];
  });
  held.push(...captureShipCasketHumans277(world).map(h=>({pawn:h.pawn,items:[...h.items],packed:[...h.packed]})));
  const pawns = new Map(world.pawns.map(p => [p.id,p]));
  for (const owner of held) pawns.set(owner.pawn.id,owner.pawn);
  const unpricedPileIds: number[] = [], unpricedPackedIds: number[] = [], unpricedStructureIds: number[] = [], unpricedPawnIds: number[] = [];
  let items = 0, structures = 0, floors = 0;
  // Schema 327: Core counts only the player's own buildings and nothing under
  // the fog. A structure without a faction field is the colony's own.
  const fog327 = world.schemaVersion >= 327, player327 = world.worldFactions?.playerFactionId;
  const playerBuilding327 = (s: Structure): boolean => !fog327 || !Object.hasOwn(s,'factionId') || s.factionId === undefined || s.factionId !== null && s.factionId === player327;
  for (const piles of [world.piles,...held.map(owner=>owner.items)]) for (const pile of piles) {
    if (!pileOnPlayerMap(pile,pawns)&&!animalHaulContents282(world,pile)) continue;
    // Core WealthWatcher skips an item lying under the fog (schema 327).
    if (fog327 && pile.owner.type === 'ground' && world.tiles[pile.owner.z*world.width+pile.owner.x]?.fogged) continue;
    const value = knownPileValue(pile, world.schemaVersion);
    if (value === undefined) unpricedPileIds.push(pile.id);
    else items += value;
  }
  // Packed furniture is a physical item, not a second installed building.
  for (const packed of [world.packed,...held.map(owner=>owner.packed)]) for (const pack of packed) {
    const owner = pack.owner;
    if (owner.type !== 'ground' && !colonyPawn(pawns.get(owner.pawnId))) continue;
    try { items += structureRoomMarketValue(pack.building); }
    catch (error) { if (!(error instanceof RangeError)) throw error; unpricedPackedIds.push(pack.building.id); }
  }
  for (const building of world.structures) {
    if (!playerBuilding327(building)) continue;
    try {
      // WealthWatcher uses MarketValueIgnoreHp for artificial player buildings.
      structures += structureRoomMarketValue({...building,damage:0});
    } catch (error) { if (!(error instanceof RangeError)) throw error; unpricedStructureIds.push(building.id); }
  }
  for (const tile of world.tiles) {
    // Core counts the visible top terrain, including beneath a fallen edifice.
    // Preserve historical overlay counts; only the new bare substrate adopts
    // that fog boundary. A room's physical terrain value remains independent.
    if(tile.fogged&&(fog327||!tile.floor&&!tile.bridge&&hasSmoothedStoneSubstrate281(tile)))continue;
    floors += floorRoomMarketValue(tile);
  }
  // Pawn MarketValue needs age/life stage, all Core capacities, full skill set,
  // beauty and hediff price offsets. Those facts are absent from this save.
  for (const pawn of pawns.values()) if (colonyPawn(pawn)) unpricedPawnIds.push(pawn.id);
  for(const animal of [...world.wildlife?.animals??[],...captureShipCasketAnimals277(world).map(h=>h.animal)])if(animal.domestic&&animal.state!=='dead')unpricedPawnIds.push(animal.id);
  const pawnsKnown = 0, knownTotal = items + structures + floors + pawnsKnown;
  return {
    items,structures,floors,pawnsKnown,knownTotal,
    knownStorytellerWealth:items+pawnsKnown+(structures+floors)*.5,
    unpricedPileIds,unpricedPackedIds,unpricedStructureIds,unpricedPawnIds,
    complete:unpricedPileIds.length===0&&unpricedPackedIds.length===0&&unpricedStructureIds.length===0&&unpricedPawnIds.length===0,
  };
}
