import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {sourceReservationCandidates379} from './source-reservation-candidates-379.ts';
import {assignPileOwner} from './pile-index.ts';
import {orderedHumanCandidates379} from './human-roster-379.ts';
import {terrainJournalReadOwner,terrainReadScope} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import {pileById,appendPileEntries} from './pile-identity-directory.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {validAiCorePile298} from './victory-content-save-298.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isNovelBook295} from './book-state-295.ts';
import {animalContentsOwner256,animalContentsLocation256} from './animal-local-contents-256.ts';
import {animalHaulContents282} from './animal-haul-contents-282.ts';
import {isFutureEcologyItem256} from './cave-products-256.ts';
import {canMergeEggPile256} from './animal-egg-permission-v256.ts';
import {validEggPile256} from './animal-egg-save-v256.ts';
import { groupReservedQuantities,groupReservedQuantity } from './group-reservations.ts';
import { commercialReservedQuantity,commercialReservedSources } from './commercial-reservations.ts';
import { removeIdentity } from './collection-remove.ts';
import { pawnContentsLocation } from './human-corpses.ts';
import { copyPileCondition,mergePileContamination,mergePileEgg256 } from './pile-condition.ts';
import { isColonist } from './affiliation.ts';
import { mergeThingDamage,pileMaxHp } from './thing-damage-rules.ts';
import { newApparelState,isApparelItem,APPAREL } from './apparel-rules.ts';
import { apparelCompatible } from './armor.ts';
import { groundCapacity, planGroundPlacement } from './ground-placement.ts';
import { shelfAt } from './shelf-storage.ts';
import { isWeaponItem, newWeaponState } from './equipment-rules.ts';
import { freshRot, mergeRot, rotAge } from './food-preservation.ts';
import { ITEM_DEFINITIONS, legacyItem } from './items.ts';
import type { ItemId } from './items.ts';
import { MAX_STACK } from './definitions.ts';
import { isCookingOrder,orderedTargets378 } from './order-types.ts';
import { haulReservations } from './haul-reservations.ts';
import type { Cell, HaulDestination, MaterialKind, MaterialOwner, MaterialPile, Stock, World } from './types.ts';

/** Foreign owners must already exist. Metadata references are never authority
 * to mint off-map stacks; these piles do not contribute to colony stock. */
function validOrbitalOwner(world:World,owner:MaterialOwner):boolean {
  return owner.type==='orbital-ship'?world.schemaVersion>=216&&Array.isArray(world.orbital?.ships)&&world.orbital!.ships.some(s=>s?.id===owner.shipId)
    :owner.type==='orbital-cargo'?world.schemaVersion>=216&&Array.isArray(world.orbital?.pending)&&world.orbital!.pending.some(d=>d?.id===owner.deliveryId):true;
}

export function pileCell(world: World, pile: MaterialPile): Cell | null {
  const owner = pile.owner;
  if (owner.type === 'ground') return { x: owner.x, z: owner.z };
  if (owner.type === 'pawn'||owner.type==='equipment'||owner.type==='apparel'||owner.type==='inventory'){const pawn=world.pawns.find(p=>p.id===owner.pawnId);return pawn?pawnContentsLocation(world,pawn)?.cell??null:owner.type==='inventory'?animalContentsLocation256(world,owner.pawnId)?.cell??null:null;}
  if(owner.type==='grave'||owner.type==='orbital-ship'||owner.type==='orbital-cargo'||owner.type==='starting-pod'||owner.type==='world-site263'||owner.type==='trade-request284')return null;
  // Schema 374: an installed egg box holds its eggs at its own cell (PositionHeld).
  if(owner.type==='egg-box374'){const box=world.structures.find(b=>b.id===owner.structureId&&b.kind==='egg-box');return box?{x:box.x,z:box.z}:null;}
  return world.jobs.find(job => job.id === owner.jobId) ?? null;
}
export function deliveredStock(world: World, jobId: number): Stock {
  const stock: Stock = { wood: 0, food: 0 };
  for (const pile of world.piles) if ((pile.kind === 'wood' || pile.kind === 'food') && pile.owner.type === 'job' && pile.owner.jobId === jobId) stock[pile.kind] += pile.quantity;
  return stock;
}
export function refreshStock(world: World): void {
  const stock: Stock = { wood: 0, food: 0 };
  const delivered = new Map(world.jobs.map(job => [job.id, { wood: 0, food: 0 }]));
  for (const pile of world.piles) {
    if(pile.kind!=='wood'&&pile.kind!=='food')continue;
    if (pile.owner.type === 'job') {
      const value = delivered.get(pile.owner.jobId);
      if (value) value[pile.kind] += pile.quantity;
    } else if(colonyPile(world,pile)) stock[pile.kind] += pile.quantity;
  }
  world.stock = stock;
  for (const job of world.jobs) job.escrow = delivered.get(job.id)!;
}
const sameOwner = (a: MaterialOwner, b: MaterialOwner): boolean => a.type === b.type
  && (a.type === 'ground' && b.type === 'ground' ? a.x === b.x && a.z === b.z
    : (a.type==='pawn'||a.type==='equipment'||a.type==='apparel'||a.type==='inventory')&&(b.type==='pawn'||b.type==='equipment'||b.type==='apparel'||b.type==='inventory') ? a.pawnId === b.pawnId
      : a.type==='orbital-ship'&&b.type==='orbital-ship'?a.shipId===b.shipId
      : a.type==='orbital-cargo'&&b.type==='orbital-cargo'?a.deliveryId===b.deliveryId
      : a.type==='egg-box374'&&b.type==='egg-box374'?a.structureId===b.structureId
      : a.type === 'job' && b.type === 'job' && a.jobId === b.jobId);

/** Number of new physical identities after filling every compatible stack. */
export function materialIdentityCount(world:World,quantity:number,owner:MaterialOwner,item:ItemId,condition:Pick<MaterialPile,'egg'|'eggForbidden'>={}):number {
  const limit=ITEM_DEFINITIONS[item].stackLimit;
  let remaining=quantity;
  for(const pile of world.piles)if(pile.item===item&&sameOwner(pile.owner,owner)&&canMergeEggPile256(pile,condition))remaining-=Math.max(0,limit-pile.quantity);
  return Math.ceil(Math.max(0,remaining)/limit);
}
export function materialCanFit(world: World, kind: MaterialKind, quantity: number, owner: MaterialOwner, item: ItemId = legacyItem(kind),subject?:MaterialPile): boolean {
  if(kind==='ai-core'||item==='ai-core'){
    if(!isSchema298OrLater(world.schemaVersion)||kind!=='ai-core'||item!=='ai-core'||quantity!==1||subject&&(subject.kind!==kind||subject.item!==item||subject.quantity!==1)||owner.type==='equipment'||owner.type==='apparel'||owner.type==='grave')return false;
  }
  if(kind==='book'||item==='novel'){
    if(world.schemaVersion<295||kind!=='book'||item!=='novel'||quantity!==1||!subject||subject.item!==item||subject.kind!==kind||subject.quantity!==1||!isNovelBook295(subject.book)||owner.type==='job'||owner.type==='equipment'||owner.type==='apparel'||owner.type==='grave')return false;
  }
  if(world.schemaVersion<256&&(isFutureEcologyItem256(item)||item==='slag-steel-chunk')||!validOrbitalOwner(world,owner))return false;
  if((kind==='prosthesis'||kind==='corpse'||kind==='mech-corpse'||kind==='weapon'||kind==='apparel')&&owner.type==='job')return false;
  if(owner.type==='apparel'&&(kind!=='apparel'||quantity!==1||!isApparelItem(item)||world.piles.some(p=>p.owner.type==='apparel'&&p.owner.pawnId===owner.pawnId&&!apparelCompatible(APPAREL[p.item as keyof typeof APPAREL].coverage,APPAREL[item].coverage))))return false;
  if(owner.type==='equipment'&&(kind!=='weapon'||quantity!==1||world.piles.some(p=>p.owner.type==='equipment'&&p.owner.pawnId===owner.pawnId)))return false;
  const bookCarrier=(kind==='book'||kind==='ai-core')&&subject&&(subject.owner.type==='pawn'||subject.owner.type==='inventory')?subject.owner.pawnId:undefined;
  if (owner.type === 'ground' && quantity > groundCapacity(world, owner, subject??item,bookCarrier)) return false;
  const needed=(kind==='book'||kind==='ai-core')&&subject&&world.piles.includes(subject)?0:materialIdentityCount(world,quantity,owner,item,subject??{});
  return world.piles.length + needed <= 32768 && Number.isSafeInteger(world.nextId + needed);
}

export function addMaterial(world: World, kind: MaterialKind, quantity: number, owner: MaterialOwner, item: ItemId = legacyItem(kind),condition:Pick<MaterialPile,'egg'|'eggForbidden'>={}): void {
  if((kind==='ai-core'||item==='ai-core')&&(!isSchema298OrLater(world.schemaVersion)||kind!=='ai-core'||item!=='ai-core'))throw Error('AI cores require their current singleton content domain.');
  if(kind==='book'||item==='novel')throw new Error('A Novel requires an original generated book.');
  if(world.schemaVersion<256&&(isFutureEcologyItem256(item)||item==='slag-steel-chunk'))throw Error('Future animal item.');
  if(kind==='plant')throw new Error('A minified tree requires an original Resource.');
  if(kind==='corpse'||kind==='mech-corpse')throw new Error('A corpse requires an existing dead owner identity.');
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_STACK * 32768) throw new Error('Material quantity exceeds supported range.');
  if (!Object.hasOwn(ITEM_DEFINITIONS, item) || ITEM_DEFINITIONS[item].kind !== kind) throw new Error('Unknown or incompatible item.');
  if(!validEggPile256({item,...condition},world.schemaVersion,world.tick,world.nextId))throw Error('Invalid egg creation context.');
  const limit = ITEM_DEFINITIONS[item].stackLimit;
  if (owner.type === 'ground' && (!Number.isInteger(owner.x) || !Number.isInteger(owner.z) || owner.x < 0 || owner.z < 0 || owner.x >= world.width || owner.z >= world.height)) throw new Error('Invalid material position.');
  if (owner.type === 'ground' && (['water', 'rock'].includes(world.tiles[owner.z * world.width + owner.x]!.terrain)
    || world.structures.some(item => (item.kind === 'wall'||item.kind==='cooler') && item.x === owner.x && item.z === owner.z)
    || world.schemaVersion<16&&world.jobs.some(item => (item.kind === 'wall'||item.kind==='cooler') && item.x === owner.x && item.z === owner.z))) throw new Error('Material destination is impassable.');
  if ((owner.type === 'pawn'||owner.type==='equipment'||owner.type==='apparel'||owner.type==='inventory') && !world.pawns.some(pawn => pawn.id === owner.pawnId)&&!(owner.type==='inventory'&&world.schemaVersion>=256&&animalContentsOwner256(world,owner.pawnId)!==undefined)) throw new Error('Material carrier does not exist.');
  if (owner.type === 'job' && !world.jobs.some(job => job.id === owner.jobId)) throw new Error('Material construction does not exist.');
  if (!materialCanFit(world, kind, quantity, owner, item,{item,kind,quantity,owner,id:0,...condition})) throw new Error('Material pile limit exceeded.');
  for (const pile of world.piles) {
    if (!quantity) break;
    if (pile.item !== item || !sameOwner(pile.owner, owner)||!canMergeEggPile256(pile,condition)) continue;
    const moved = Math.min(limit - pile.quantity, quantity);
    mergePileEgg256(pile,moved,condition.egg);mergePileContamination(pile,moved);mergeThingDamage(pile,moved,0,pileMaxHp(pile,world.schemaVersion));mergeRot(pile, moved, 0, world.tick);
    markPileContentWrite379(pile).quantity += moved; quantity -= moved;
  }
  while (quantity > 0) {
    const moved = Math.min(limit, quantity);
    appendPileEntries(world.piles,{ id: world.nextId++, kind, item, quantity: moved, owner: { ...owner },...copyPileCondition(condition), ...freshRot(item, world.tick),...kind==='weapon'&&isWeaponItem(item)?{weapon:newWeaponState(item)}:kind==='apparel'&&isApparelItem(item)?{apparel:newApparelState(item,undefined,world.schemaVersion)}:{}});
    quantity -= moved;
  }
  refreshStock(world);
}
export function addGroundMaterial(world: World, kind: MaterialKind, quantity: number, cell: Cell, item: ItemId = legacyItem(kind),condition:Pick<MaterialPile,'egg'|'eggForbidden'>={}): void {
  if(!tryAddGroundMaterial(world,kind,quantity,cell,item,condition))throw new Error('No room for ground material.');
}
/** Synchronous preflight and commit, retaining the ordinary argument errors.
 * A capacity/identity refusal changes nothing and returns false, so producers
 * need not calculate and discard the same placement before adding it. */
export function tryAddGroundMaterial(world: World, kind: MaterialKind, quantity: number, cell: Cell, item: ItemId = legacyItem(kind),condition:Pick<MaterialPile,'egg'|'eggForbidden'>={}): boolean {
  if(kind==='book'||item==='novel')throw new Error('A Novel requires an original generated book.');
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_STACK * 32768) throw new Error('Invalid ground quantity.');
  if (!Object.hasOwn(ITEM_DEFINITIONS,item) || ITEM_DEFINITIONS[item].kind!==kind) throw new Error('Invalid ground item.');
  const plan = planGroundPlacement(world, quantity, cell, item);
  const needed=plan?.reduce((n,p)=>n+materialIdentityCount(world,p.quantity,{type:'ground',...p.cell},item,condition),0)??0;
  if (!plan || world.piles.length + needed > 32768 || !Number.isSafeInteger(world.nextId + needed)) return false;
  for (const part of plan) addMaterial(world, kind, part.quantity, { type:'ground', ...part.cell }, item,condition);
  return true;
}
/** Move the existing stack, merging only when possible. No allocation or identity budget needed. */
export function transferPile(world:World,pile:MaterialPile,owner:MaterialOwner):boolean {
  if(!world.piles.includes(pile)||!validOrbitalOwner(world,owner))return false;
  if((pile.kind==='ai-core'||pile.item==='ai-core')&&(!validAiCorePile298(pile,world.schemaVersion)||!materialCanFit(world,pile.kind,pile.quantity,owner,pile.item,pile)))return false;
  if((pile.kind==='book'||pile.item==='novel')&&sameOwner(pile.owner,owner))return (Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))&&pile.kind==='book'&&pile.item==='novel'&&pile.quantity===1&&isNovelBook295(pile.book)&&owner.type!=='job'&&owner.type!=='equipment'&&owner.type!=='apparel'&&owner.type!=='grave';
  if((pile.kind==='book'||pile.item==='novel')&&!materialCanFit(world,pile.kind,pile.quantity,owner,pile.item,pile))return false;
  if(sameOwner(pile.owner,owner))return true;
  if(pile.kind==='plant'){if(owner.type!=='ground'&&owner.type!=='pawn'&&owner.type!=='inventory')return false;if(owner.type==='ground'&&groundCapacity(world,owner,pile,pile.owner.type==='pawn'?pile.owner.pawnId:undefined)<1)return false;assignPileOwner(pile,{...owner});refreshStock(world);return true;}
  if((pile.kind==='corpse'||pile.kind==='mech-corpse')&&owner.type!=='ground'&&owner.type!=='pawn')return false;
  const carrier=pile.owner.type==='pawn'||animalHaulContents282(world,pile)&&pile.owner.type==='inventory'?pile.owner.pawnId:undefined;
  if(owner.type==='ground'&&groundCapacity(world,owner,pile,carrier)<pile.quantity)return false;
  if(owner.type==='ground'&&shelfAt(world,owner)){
    let remaining=pile.quantity;
    for(const target of world.piles)if(target!==pile&&target.item===pile.item&&sameOwner(target.owner,owner)&&canMergeEggPile256(target,pile)){
      const moved=Math.min(remaining,ITEM_DEFINITIONS[pile.item].stackLimit-target.quantity);if(moved<=0)continue;
      mergePileEgg256(target,moved,pile.egg);mergePileContamination(target,moved,pile.foodPoison);mergeThingDamage(target,moved,pile.damage,pileMaxHp(target,world.schemaVersion));mergeRot(target,moved,rotAge(pile,world.tick),world.tick);markPileContentWrite379(target).quantity+=moved;remaining-=moved;if(!remaining)break;
    }
    if(remaining){markPileContentWrite379(pile).quantity=remaining;assignPileOwner(pile,{...owner});}else removeIdentity(world.piles,pile);
    refreshStock(world);return true;
  }
  const target=world.piles.find(p=>p!==pile&&p.item===pile.item&&sameOwner(p.owner,owner)&&canMergeEggPile256(p,pile)&&p.quantity+pile.quantity<=ITEM_DEFINITIONS[pile.item].stackLimit);
  if(target){mergePileEgg256(target,pile.quantity,pile.egg);mergePileContamination(target,pile.quantity,pile.foodPoison);mergeThingDamage(target,pile.quantity,pile.damage,pileMaxHp(target,world.schemaVersion));mergeRot(target,pile.quantity,rotAge(pile,world.tick),world.tick);markPileContentWrite379(target).quantity+=pile.quantity;removeIdentity(world.piles,pile);}else assignPileOwner(pile,{...owner});
  refreshStock(world);return true;
}
/** Split only the delivered fraction. The held source identity and its states survive. */
export function depositMaterialPart(world:World,source:MaterialPile,cell:Cell,quantity:number,exceptPawn?:number):boolean {
  if((source.kind==='ai-core'||source.item==='ai-core')&&(!validAiCorePile298(source,world.schemaVersion)||quantity!==1))return false;
  if((source.kind==='book'||source.item==='novel')&&(quantity!==1||source.quantity!==1||!isNovelBook295(source.book)))return false;
  if(!world.piles.includes(source)||!Number.isSafeInteger(quantity)||quantity<1||quantity>source.quantity||groundCapacity(world,cell,source,exceptPawn)<quantity)return false;
  if(quantity===source.quantity)return transferPile(world,source,{type:'ground',x:cell.x,z:cell.z});
  const targets=world.piles.filter(p=>p!==source&&p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z&&p.item===source.item&&canMergeEggPile256(p,source)&&p.quantity<ITEM_DEFINITIONS[source.item].stackLimit);
  const residual=targets.reduce((n,p)=>n+ITEM_DEFINITIONS[source.item].stackLimit-p.quantity,0),needed=Math.ceil(Math.max(0,quantity-residual)/ITEM_DEFINITIONS[source.item].stackLimit);
  if(world.piles.length+needed>32768||!Number.isSafeInteger(world.nextId+needed))return false;
  let remaining=quantity;
  for(const target of targets){const moved=Math.min(remaining,ITEM_DEFINITIONS[source.item].stackLimit-target.quantity);mergePileEgg256(target,moved,source.egg);mergePileContamination(target,moved,source.foodPoison);mergeThingDamage(target,moved,source.damage,pileMaxHp(target,world.schemaVersion));mergeRot(target,moved,rotAge(source,world.tick),world.tick);markPileContentWrite379(target).quantity+=moved;remaining-=moved;if(!remaining)break;}
  while(remaining){const moved=Math.min(remaining,ITEM_DEFINITIONS[source.item].stackLimit);appendPileEntries(world.piles,{...source,...copyPileCondition(source),id:world.nextId++,quantity:moved,owner:{type:'ground',x:cell.x,z:cell.z}});remaining-=moved;}
  markPileContentWrite379(source).quantity-=quantity;refreshStock(world);return true;
}
function physicalReservedSource(world: World, pileId: number, exceptPawn?: number, exceptTreeJob?:number,exceptPawns?:ReadonlySet<number>): number {
  const candidates=sourceReservationCandidates379(world);
  let quantity = commercialReservedQuantity(world,pileId,exceptPawn)+groupReservedQuantity(world,pileId);
  for(const j of candidates?.trees??world.jobs)if(j.id!==exceptTreeJob&&j.tree?.kind==='replant'&&j.tree.phase==='pickup'&&j.tree.sourcePileId===pileId&&j.reservedBy!==exceptPawn&&!exceptPawns?.has(j.reservedBy??-1))quantity++;
  if(world.scout?.phase==='loading'&&world.scout.pawnId!==exceptPawn&&world.scout.sourcePileId===pileId)quantity+=world.scout.quantity;
  for(const a of candidates?.animals??world.wildlife?.animals??[])if(a.id!==exceptPawn&&!exceptPawns?.has(a.id)){
    if(a.meal?.kind==='pile'&&a.meal.id===pileId)quantity+=a.meal.quantity;
    if(a.haul?.phase==='pickup'&&a.haul.sourcePileId===pileId)quantity+=a.haul.quantity;
  }
  for (const pawn of candidates?.people??world.pawns) {
    if (pawn.id !== exceptPawn&&!exceptPawns?.has(pawn.id)) {
      if(pawn.recreation.task?.activity==='read'&&pawn.recreation.task.stage==='pickup'&&pawn.recreation.task.bookId===pileId)quantity++;
      if(pawn.burial?.phase==='pickup'&&pawn.burial.corpseId===pileId)quantity++;
      if(pawn.hunting?.animalId===pileId)quantity++;
      if((pawn.equipmentTask?.action==='equip'||pawn.equipmentTask?.action==='wear')&&pawn.equipmentTask.itemId===pileId)quantity++;
      for(const i of pawn.cooking?.ingredients??[])if(i.pileId===pileId&&i.stage!=='held')quantity+=i.quantity;
      if(pawn.animalHandling?.phase==='pickup'&&pawn.animalHandling.sourcePileId===pileId)quantity+=pawn.animalHandling.quantity;
      if(pawn.animalCare?.phase==='pickup'&&pawn.animalCare.medicine?.sourcePileId===pileId)quantity+=pawn.animalCare.medicine.quantity;
      if(pawn.surgery?.phase==='pickup'&&pawn.surgery.medicine?.sourcePileId===pileId)quantity+=pawn.surgery.medicine.quantity;
      for(const i of pawn.surgery?.ingredients??[])if(i.pileId===pileId&&i.stage!=='held')quantity+=i.quantity;
      if(pawn.tend?.phase==='pickup'&&pawn.tend.medicine?.sourcePileId===pileId)quantity+=pawn.tend.medicine.quantity;
      if(pawn.need?.kind==='eat'&&pawn.need.phase==='pickup')for(const ingredient of pawn.need.paste?.ingredients??[])if(ingredient.pileId===pileId)quantity+=ingredient.quantity;
      if(pawn.feed?.phase==='pickup')for(const ingredient of pawn.feed.paste?.ingredients??[])if(ingredient.pileId===pileId)quantity+=ingredient.quantity;
      if(pawn.feed?.phase==='pickup'&&pawn.feed.sourcePileId===pileId)quantity+=pawn.feed.quantity;
      if(pawn.animalFeed?.phase==='pickup'&&pawn.animalFeed.sourcePileId===pileId)quantity+=pawn.animalFeed.quantity;
      if(pawn.ward?.kind==='food'&&pawn.ward.phase==='pickup'&&pawn.ward.sourcePileId===pileId)quantity+=pawn.ward.quantity;
      if(pawn.haul?.constructionBatch379){for(const source of pawn.haul.constructionBatch379.sources)if(source.pileId===pileId)quantity+=source.quantity;}
      else if(pawn.haul?.phase==='pickup'&&pawn.haul.sourcePileId===pileId)quantity+=pawn.haul.haulOpportunity379?.quantity??pawn.haul.quantity;
      if (pawn.need?.kind === 'eat' && pawn.need.phase === 'pickup' && pawn.need.sourcePileId === pileId) quantity += pawn.need.quantity ?? 1;
    }
    const queue=exceptPawns?.has(pawn.id)?undefined:pawn.orders?.queue;
    if(queue?.length)for(const task of queue)if(typeof task!=='number') {
      if(isCookingOrder(task)){for(const i of task.cooking.ingredients)if(i.pileId===pileId)quantity+=i.quantity;}
      else if(task.constructionBatch379){for(const source of task.constructionBatch379.sources)if(source.pileId===pileId)quantity+=source.quantity;}
      else if(task.sourcePileId===pileId)quantity+=task.haulOpportunity379?.quantity??task.quantity;
    }
  }
  return quantity;
}
/** A generalized future order retains the chosen Thing but not a guessed
 * ingredient or destination. Its exclusive target claim protects the
 * currently unallocated portion, without confiscating quantities physically
 * acquired by already-running jobs. The actual provider determines its amount
 * when it starts. In particular a corpse's retained pawn/animal identity is
 * the same target as the physical ground pile. */
function queuedPileIds378(world:World,exceptPawn?:number,exceptPawns?:ReadonlySet<number>):Set<number>|undefined {
 if(Number(world.schemaVersion)<378)return;
 let ids:Set<number>|undefined;
 for(const p of orderedHumanCandidates379(world.pawns)){
  if(p.id===exceptPawn||exceptPawns?.has(p.id)||!p.orderedQueue378?.length)continue;
  for(const order of p.orderedQueue378)for(const t of orderedTargets378(order)){
   if(t.kind==='pile')(ids??=new Set()).add(t.id);
   if(t.kind==='pawn'||t.kind==='animal')for(const pile of world.piles)if(t.kind==='pawn'?pile.humanCorpse?.pawnId===t.id:pile.corpse?.animalId===t.id)(ids??=new Set()).add(pile.id);
  }
 }
 return ids;
}
/** A single-source query needs only membership, not every queued pile id.
 * Resolve a corpse's retained identity at most once, only if a queued order
 * targets a person or animal. Read afresh on every call, including while paused. */
function queuedPileClaimed378(world:World,pileId:number,exceptPawn?:number,exceptPawns?:ReadonlySet<number>):boolean {
 if(Number(world.schemaVersion)<378)return false;
 let pile:MaterialPile|undefined,readPile=false;
 for(const pawn of orderedHumanCandidates379(world.pawns)){
  if(pawn.id===exceptPawn||exceptPawns?.has(pawn.id)||!pawn.orderedQueue378?.length)continue;
  for(const order of pawn.orderedQueue378)for(const target of orderedTargets378(order)){
   if(target.kind==='pile'&&target.id===pileId)return true;
   if(target.kind!=='pawn'&&target.kind!=='animal')continue;
   if(!readPile){pile=pileById(world,pileId);readPile=true;}
   if(target.kind==='pawn'?pile?.humanCorpse?.pawnId===target.id:pile?.corpse?.animalId===target.id)return true;
  }
 }
 return false;
}
export function reservedSource(world: World, pileId: number, exceptPawn?: number, exceptTreeJob?:number,exceptPawns?:ReadonlySet<number>): number {
 const physical=physicalReservedSource(world,pileId,exceptPawn,exceptTreeJob,exceptPawns);
 if(!queuedPileClaimed378(world,pileId,exceptPawn,exceptPawns))return physical;
 const pile=world.piles.find(p=>p.id===pileId&&p.owner.type==='ground');if(!pile)return physical;
 const all=exceptPawn===undefined&&exceptTreeJob===undefined&&!exceptPawns?physical:physicalReservedSource(world,pileId);
 return physical+Math.max(0,pile.quantity-all);
}
/** One immutable, synchronous MULTI-SOURCE proposal. The caller discards this
 * reader before installing/releasing a task, consuming a pile or invoking a
 * movement/commit callback. Each next proposal gets a fresh reader, even in
 * the same tick. Public callers retain the exact live scalar function.
 *
 * Optional IDs restrict compilation to this proposal's sources. Contributions
 * follow physicalReservedSource literally: commercial + group first, tree
 * jobs, scout, animals, then every pawn's active fields followed by its queue.
 * This order also preserves IEEE addition for non-integral synthetic inputs.
 * Own waiting orders remain reserved; exceptPawns excludes both active and
 * queued work, while scout/commercial keep their original exception rules. */
export function createSourceReservationRead379(world:World,pileIds?:readonly number[],exceptPawn?:number,exceptTreeJob?:number,exceptPawns?:ReadonlySet<number>):(pileId:number)=>number {
 const owner=terrainJournalReadOwner(),scope=terrainReadScope();
 let physical:Map<number,number>|undefined,answers:Map<number,number>|undefined;
 const ids=pileIds?new Set(pileIds):undefined;
 const scalar=(id:number)=>reservedSource(world,id,exceptPawn,exceptTreeJob,exceptPawns);
 const initial=(id:number)=>commercialReservedQuantity(world,id,exceptPawn)+groupReservedQuantity(world,id);
 const capture=()=>{
  const candidates=sourceReservationCandidates379(world);
  const result=new Map<number,number>();
  const add=(id:number|null|undefined,n:number)=>{
   if(typeof id!=='number'||!Number.isSafeInteger(id)||ids&&!ids.has(id))return;
   result.set(id,(result.has(id)?result.get(id)!:initial(id))+n);
  };
  for(const j of candidates?.trees??world.jobs)if(j.id!==exceptTreeJob&&j.tree?.kind==='replant'&&j.tree.phase==='pickup'&&j.reservedBy!==exceptPawn&&!exceptPawns?.has(j.reservedBy??-1))add(j.tree.sourcePileId,1);
  if(world.scout?.phase==='loading'&&world.scout.pawnId!==exceptPawn)add(world.scout.sourcePileId,world.scout.quantity);
  for(const a of candidates?.animals??world.wildlife?.animals??[])if(a.id!==exceptPawn&&!exceptPawns?.has(a.id)){
   if(a.meal?.kind==='pile')add(a.meal.id,a.meal.quantity);
   if(a.haul?.phase==='pickup')add(a.haul.sourcePileId,a.haul.quantity);
  }
  for(const p of candidates?.people??world.pawns){
   if(p.id!==exceptPawn&&!exceptPawns?.has(p.id)){
    if(p.recreation.task?.activity==='read'&&p.recreation.task.stage==='pickup')add(p.recreation.task.bookId,1);
    if(p.burial?.phase==='pickup')add(p.burial.corpseId!,1);
    if(p.hunting)add(p.hunting.animalId,1);
    if(p.equipmentTask?.action==='equip'||p.equipmentTask?.action==='wear')add(p.equipmentTask.itemId,1);
    for(const i of p.cooking?.ingredients??[])if(i.stage!=='held')add(i.pileId,i.quantity);
    if(p.animalHandling?.phase==='pickup')add(p.animalHandling.sourcePileId,p.animalHandling.quantity);
    if(p.animalCare?.phase==='pickup'&&p.animalCare.medicine)add(p.animalCare.medicine.sourcePileId,p.animalCare.medicine.quantity);
    if(p.surgery?.phase==='pickup'&&p.surgery.medicine)add(p.surgery.medicine.sourcePileId,p.surgery.medicine.quantity);
    for(const i of p.surgery?.ingredients??[])if(i.stage!=='held')add(i.pileId,i.quantity);
    if(p.tend?.phase==='pickup'&&p.tend.medicine)add(p.tend.medicine.sourcePileId,p.tend.medicine.quantity);
    if(p.need?.kind==='eat'&&p.need.phase==='pickup')for(const i of p.need.paste?.ingredients??[])add(i.pileId,i.quantity);
    if(p.feed?.phase==='pickup')for(const i of p.feed.paste?.ingredients??[])add(i.pileId,i.quantity);
    if(p.feed?.phase==='pickup')add(p.feed.sourcePileId!,p.feed.quantity);
    if(p.animalFeed?.phase==='pickup')add(p.animalFeed.sourcePileId,p.animalFeed.quantity);
    if(p.ward?.kind==='food'&&p.ward.phase==='pickup')add(p.ward.sourcePileId,p.ward.quantity);
    if(p.haul?.constructionBatch379){for(const source of p.haul.constructionBatch379.sources)add(source.pileId,source.quantity);}
    else if(p.haul?.phase==='pickup')add(p.haul.sourcePileId,p.haul.haulOpportunity379?.quantity??p.haul.quantity);
    if(p.need?.kind==='eat'&&p.need.phase==='pickup')add(p.need.sourcePileId!,p.need.quantity??1);
   }
   if(!exceptPawns?.has(p.id))for(const task of p.orders?.queue??[])if(typeof task!=='number'){
    if(isCookingOrder(task)){for(const i of task.cooking.ingredients)add(i.pileId,i.quantity);}
    else if(task.constructionBatch379){for(const source of task.constructionBatch379.sources)add(source.pileId,source.quantity);}
    else add(task.sourcePileId,task.haulOpportunity379?.quantity??task.quantity);
   }
  }
  return result;
 };
 return id=>{
  if(!owner||owner!==terrainJournalReadOwner()||scope!==terrainReadScope()||!Number.isSafeInteger(id)||ids&&!ids.has(id))return scalar(id);
  if(!physical){physical=capture();answers=new Map();}
  let quantity:number;
  if(answers!.has(id))quantity=answers!.get(id)!;
  else{
   quantity=physical.has(id)?physical.get(id)!:initial(id);
   if(queuedPileClaimed378(world,id,exceptPawn,exceptPawns)){
    const pile=world.piles.find(p=>p.id===id&&p.owner.type==='ground');
    if(pile){const all=exceptPawn===undefined&&exceptTreeJob===undefined&&!exceptPawns?quantity:physicalReservedSource(world,id);quantity+=Math.max(0,pile.quantity-all);}
   }
   answers!.set(id,quantity);
  }
  if(verifyTerrainWriteCaches&&!Object.is(quantity,scalar(id)))throw Error('Source reservation reader crossed a mutation inside its immutable proposal');
  return quantity;
 };
}
/** Batch form of reservedSource for a single read-only decision over many piles.
 * Active work by exceptPawn is excluded, but its queued orders still reserve.
 * The map is discarded before the next world mutation. */
export function reservedSourcesByPile(world: World, exceptPawn?: number): ReadonlyMap<number, number> {
  const candidates=sourceReservationCandidates379(world);
  const quantities = new Map<number, number>();
  const add = (pileId: number, quantity: number): void => {
    quantities.set(pileId, (quantities.get(pileId) ?? 0) + quantity);
  };
  if(world.scout?.phase==='loading'&&world.scout.pawnId!==exceptPawn)add(world.scout.sourcePileId,world.scout.quantity);
  for(const j of candidates?.trees??world.jobs)if(j.tree?.kind==='replant'&&j.tree.phase==='pickup'&&j.reservedBy!==exceptPawn)add(j.tree.sourcePileId,1);
  for(const [id,quantity] of commercialReservedSources(world,exceptPawn))add(id,quantity);
  for(const [id,quantity] of groupReservedQuantities(world))add(id,quantity);
  for (const animal of candidates?.animals??world.wildlife?.animals??[])if (animal.id !== exceptPawn){
    if(animal.meal?.kind==='pile')add(animal.meal.id, animal.meal.quantity);
    if(animal.haul?.phase==='pickup')add(animal.haul.sourcePileId,animal.haul.quantity);
  }
  for (const pawn of candidates?.people??world.pawns) {
    if (pawn.id !== exceptPawn) {
      if(pawn.recreation.task?.activity==='read'&&pawn.recreation.task.stage==='pickup')add(pawn.recreation.task.bookId,1);
      if (pawn.burial?.phase === 'pickup' && pawn.burial.corpseId !== undefined) add(pawn.burial.corpseId, 1);
      if (pawn.hunting) add(pawn.hunting.animalId, 1);
      if (pawn.equipmentTask?.action === 'equip' || pawn.equipmentTask?.action === 'wear') add(pawn.equipmentTask.itemId, 1);
      for (const ingredient of pawn.cooking?.ingredients ?? [])
        if (ingredient.stage !== 'held') add(ingredient.pileId, ingredient.quantity);
      if (pawn.animalHandling?.phase === 'pickup') add(pawn.animalHandling.sourcePileId, pawn.animalHandling.quantity);
      if (pawn.animalCare?.phase === 'pickup' && pawn.animalCare.medicine) add(pawn.animalCare.medicine.sourcePileId, pawn.animalCare.medicine.quantity);
      if (pawn.surgery?.phase === 'pickup' && pawn.surgery.medicine) add(pawn.surgery.medicine.sourcePileId, pawn.surgery.medicine.quantity);
      for(const i of pawn.surgery?.ingredients??[])if(i.stage!=='held')add(i.pileId,i.quantity);
      if (pawn.tend?.phase === 'pickup' && pawn.tend.medicine) add(pawn.tend.medicine.sourcePileId, pawn.tend.medicine.quantity);
      if(pawn.need?.kind==='eat'&&pawn.need.phase==='pickup')for(const ingredient of pawn.need.paste?.ingredients??[])add(ingredient.pileId,ingredient.quantity);
      if(pawn.feed?.phase==='pickup')for(const ingredient of pawn.feed.paste?.ingredients??[])add(ingredient.pileId,ingredient.quantity);
      if (pawn.feed?.phase === 'pickup'&&pawn.feed.sourcePileId!==null) add(pawn.feed.sourcePileId, pawn.feed.quantity);
      if (pawn.animalFeed?.phase === 'pickup') add(pawn.animalFeed.sourcePileId, pawn.animalFeed.quantity);
      if (pawn.ward?.kind === 'food' && pawn.ward.phase === 'pickup') add(pawn.ward.sourcePileId, pawn.ward.quantity);
      if(pawn.haul?.constructionBatch379){for(const source of pawn.haul.constructionBatch379.sources)add(source.pileId,source.quantity);}
      else if (pawn.haul?.phase === 'pickup') add(pawn.haul.sourcePileId, pawn.haul.haulOpportunity379?.quantity??pawn.haul.quantity);
      if (pawn.need?.kind === 'eat' && pawn.need.phase === 'pickup'&&pawn.need.sourcePileId!==null) add(pawn.need.sourcePileId, pawn.need.quantity ?? 1);
    }
    for (const task of pawn.orders?.queue ?? []) if (typeof task !== 'number') {
      if (isCookingOrder(task)) for (const ingredient of task.cooking.ingredients) add(ingredient.pileId, ingredient.quantity);
      else if(task.constructionBatch379){for(const source of task.constructionBatch379.sources)add(source.pileId,source.quantity);}
      else add(task.sourcePileId, task.haulOpportunity379?.quantity??task.quantity);
    }
  }
 for(const pileId of queuedPileIds378(world,exceptPawn)??[]){
  const pile=world.piles.find(p=>p.id===pileId&&p.owner.type==='ground');if(!pile)continue;
  const physical=exceptPawn===undefined?quantities.get(pileId)??0:physicalReservedSource(world,pileId);
  add(pileId,Math.max(0,pile.quantity-physical));
 }
  return quantities;
}
export function sameDestination(a: HaulDestination, b: HaulDestination): boolean {
  return a.type === b.type && (a.type === 'job' && b.type === 'job' ? a.jobId === b.jobId
    : a.type === 'fuel' && b.type === 'fuel' ? a.structureId === b.structureId
    : a.type === 'turret' && b.type === 'turret' ? a.structureId === b.structureId
    : a.type === 'fermenting-barrel' && b.type === 'fermenting-barrel' ? a.structureId === b.structureId
    : a.type === 'hopper' && b.type === 'hopper' ? a.structureId === b.structureId
    : a.type === 'stockpile' && b.type === 'stockpile' ? a.stockpileId === b.stockpileId
      : a.type === 'aside' && b.type === 'aside' && a.x === b.x && a.z === b.z);
}
export function reservedDestination(world: World, destination: HaulDestination, exceptPawn?: number, item?:ItemId): number {
  let quantity = 0;
  for(const task of haulReservations(world,exceptPawn)){
    if(task.constructionBatch379){
      if(destination.type==='job'&&(item===undefined||task.constructionBatch379.item===item))for(const target of task.constructionBatch379.destinations)if(target.jobId===destination.jobId)quantity+=target.quantity;
    }else if(sameDestination(task.destination,destination)
      &&(item===undefined||!task.whole&&pileById(world,task.phase==='pickup'?task.sourcePileId:task.carryPileId)?.item===item))quantity+=task.quantity;
  }
  return quantity;
}
export function groundQuantity(world: World, cell: Cell): number {
  let quantity = 0;
  for (const pile of world.piles) if (pile.owner.type === 'ground' && pile.owner.x === cell.x && pile.owner.z === cell.z) quantity += pile.quantity;
  return quantity;
}

/** Colony HUD excludes possessions of neutral or hostile people. */
export function colonyPile(world:World,pile:MaterialPile):boolean {const o=pile.owner;return o.type==='ground'||(o.type==='pawn'||o.type==='equipment'||o.type==='apparel')&&world.pawns.some(p=>p.id===o.pawnId&&isColonist(p))||animalHaulContents282(world,pile);}
