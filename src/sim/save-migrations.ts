import {markPileWrite} from './pile-index.ts';
import { dropRetainingIdentity } from './ground-placement.ts';
import type { World } from './types.ts';
import { MAX_STACK } from './definitions.ts';
import { addGroundMaterial, addMaterial, refreshStock } from './materials.ts';
import { validateLegacyWorld } from './legacy-validation.ts';
import { legacyItem } from './items.ts';

/** Legacy cells, IDs and completed beds remain untouched; only previously abstract materials gain owners. */
export function migrateLegacy(input: Record<string, unknown>): World {
  const errors = validateLegacyWorld(input);
  if (errors.length) throw new Error(`Invalid legacy save: ${errors.join(' ')}`);
  const world = input as unknown as World;
  const initial = { ...world.stock };
  const plannedPiles = Math.ceil(initial.wood / MAX_STACK) + Math.ceil(initial.food / MAX_STACK) + world.jobs.filter(job => job.escrow.wood > 0).length;
  if (plannedPiles > 32768 || !Number.isSafeInteger(world.nextId + plannedPiles)) throw new Error('Legacy material stock exceeds the supported migration capacity.');
  Object.assign(world, { schemaVersion: 4 }); world.piles = []; world.stockpiles = []; world.logisticsCursor = 0;
  for (const pawn of world.pawns) { pawn.haul = null; pawn.priorities.haul = 3; }
  initializeNeeds(world);
  initializeDining(world);
  for (const item of [...world.structures, ...world.jobs]) { item.orientation = 0; item.footprint = item.kind === 'bed' ? 'legacy-single' : 'standard'; }
  const allocations = world.jobs.map(job => ({ id: job.id, wood: job.escrow.wood }));
  // A deterministic walkable drop point nearest the old camp; no terrain is regenerated or repaired.
  const origin = world.pawns[0] ?? { x: Math.floor(world.width / 2), z: Math.floor(world.height / 2) };
  const blocked = new Set([...world.structures, ...world.jobs].filter(item => item.kind === 'wall').map(item => item.z * world.width + item.x));
  const cells = world.tiles.map((tile, index) => ({ tile, x: index % world.width, z: Math.floor(index / world.width), index }))
    .filter(cell => !['water', 'rock'].includes(cell.tile.terrain) && !blocked.has(cell.index));
  cells.sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.z - origin.z) - Math.abs(b.x - origin.x) - Math.abs(b.z - origin.z) || a.index - b.index);
  const drop = cells[0];
  if (!drop && (initial.wood || initial.food)) throw new Error('Legacy stock has no valid material drop location.');
  if (drop) { addGroundMaterial(world, 'wood', initial.wood, drop); addGroundMaterial(world, 'food', initial.food, drop); }
  for (const allocation of allocations) addMaterial(world, 'wood', allocation.wood, { type: 'job', jobId: allocation.id });
  refreshStock(world); initializeFood(world); return world;
}
export function initializeNeeds(world: World): void {
  for (const pawn of world.pawns) {
    pawn.need = null; pawn.bedId = null; pawn.needCooldown = 0;
    // Old ground sleep has no reserved destination. Reconsider it with current
    // rules on the next tick; never move the pawn or change its need levels here.
    if (pawn.state === 'sleeping') { pawn.state = 'idle'; pawn.path = []; pawn.planCooldown = 0; }
  }
}
export function initializeDining(world: World): void {
  for (const pawn of world.pawns) {
    // Old saves have no comfort history: neutral initial level, no invented memory.
    pawn.comfort = 50; pawn.memories = [];
    if (pawn.need?.kind === 'eat') pawn.need.dining = pawn.need.phase === 'ingest' ? { target: { x: pawn.x, z: pawn.z }, seatId: null, tableId: null } : null;
  }
}
export function initializeFood(world: World): void {
  (world as unknown as {schemaVersion:number}).schemaVersion = 5; world.foodRules = 'legacy';
  for (const pile of world.piles) pile.item = legacyItem(pile.kind);
  markPileWrite();
  for (const pawn of world.pawns) if (pawn.need?.kind === 'eat') pawn.need.quantity = 1;
}

/** V5 permitted several stacks per floor cell. Relocate overflow, retaining every ID/unit.
 * Reject an unplaceable migration rather than modifying terrain or losing materials. */
export function initializeSpatial(world: World): void {
  const occupied=new Set<string>();
  for(const pile of world.piles) if(pile.owner.type==='ground') {
    const key=`${pile.owner.x}:${pile.owner.z}`;
    if(occupied.has(key)) {
      const origin={...pile.owner};
      if(!dropRetainingIdentity(world,pile,origin)) throw new Error('Cannot migrate overlapping floor stacks: no nearby free cell.');
    }
    if(pile.owner.type==='ground') occupied.add(`${pile.owner.x}:${pile.owner.z}`);
  }
  // Capacity/type rules changed: cancel outstanding haul intentions with physical drops.
  for(const pawn of world.pawns) {
    pawn.motion=null;pawn.moveCooldown=0;
    if(pawn.haul) {
      const carry=world.piles.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
      if(carry&&!dropRetainingIdentity(world,carry,pawn)) throw new Error('Cannot migrate carried material.');
      pawn.haul=null;pawn.path=[];pawn.state='idle';pawn.planCooldown=0;
    }
  }
  (world as unknown as {schemaVersion:number}).schemaVersion=6;refreshStock(world);
}

/** V6 surviving bushes are mature. Preserve IDs, yield and ongoing orders. */
export function initializePlants(world: World): void {
  for (const plant of world.resources) if (plant.kind === 'berries') { plant.growth = 1; plant.growthTick = world.tick; }
  (world as unknown as {schemaVersion:number}).schemaVersion = 7;
}
