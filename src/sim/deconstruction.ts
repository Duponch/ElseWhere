import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {notifyShipRootDestruction298} from './ship-root-destruction-proof-298.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
import {prepareLinkedShelfRetirement286} from './linked-storage-lifecycle-286.ts';
import {isShipPartKind276,isShipAddedKind276} from './ship-part-content-276.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {shipChunkNextRandom256} from './ship-chunk-leavings-256.ts';
import {isPlayerCasket271} from './cryptosleep-state-271.ts';
import {planCryptosleepRemoval271} from './cryptosleep-removal-271.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {planShipCasketRemoval277} from './ship-casket-removal-277.ts';
import {fermentationContents265} from './fermentation-state-265.ts';
import {drawShipChunkDeconstruction256} from './ship-chunk-leavings-256.ts';
import {isAncientCasket256} from './ancient-casket-state-256.ts';
import {planEmptyAncientCasketRemoval256} from './ancient-casket-empty-removal-256.ts';
import {planShelfRemoval,commitShelfRemoval} from './shelf-retirement.ts';
import {prepareRemovedFogStructure256,commitRemovedFogBlocker256} from './exploration-runtime-256.ts';
import {prepareBedOwnershipTransition256} from './actor-bed-transition-256.ts';
import { removeHydroponicPlants } from './hydroponics.ts';
import { constructionRecipe } from './construction-materials.ts';
import { releaseStructureMelee } from './melee-state.ts';
import { isBlockMaterial, isUpholsteryMaterial, type ConstructionMaterial, type BlockMaterial, type UpholsteryMaterial } from './building-materials.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import { deconstructionAvailable, deconstructionTarget } from './deconstruction-rules.ts';
import { groundPile, groundCapacity, planGroundPlacement } from './ground-placement.ts';
import { addMaterial,materialCanFit } from './materials.ts';
import { planGraveRelease,commitGraveRelease } from './burial.ts';
import type { Job, Pawn, World } from './types.ts';
import { retireWallDoorWork296 } from './wall-door-runtime-296.ts';

/** Preview the random rounding without changing authoritative RNG. Only a
 * successful, fully placeable removal consumes a draw or retires material. */
export function finishDeconstruction(world: World, pawn: Pawn, job: Job): boolean {
  const structure = deconstructionTarget(world, job);
  if (!structure || !deconstructionAvailable(world, job, pawn.id)) return false;
  const shipPart=isShipComputerSensorsKind298(structure.kind)||isShipPartKind276(structure.kind);if(shipPart&&!(isShipComputerSensorsKind298(structure.kind)?isSchema298OrLater(Number(world.schemaVersion)):isShipAddedKind276(structure.kind)?isSchema276OrLater(world.schemaVersion):isSchema275OrLater(world.schemaVersion)))return false;
  if(isPlayerCasket271(structure)){const plan=planCryptosleepRemoval271(world,structure,'deconstruct');return plan.ok&&plan.commit();}
  if(isShipCasket277(structure)){const plan=planShipCasketRemoval277(world,structure,'deconstruct');return plan.ok&&plan.commit();}
  if(isAncientCasket256(structure)){const plan=planEmptyAncientCasketRemoval256(world,structure,'deconstruct');return plan.ok&&plan.commit();}
  const bedOwnership=prepareBedOwnershipTransition256(world,structure,'destroy');
  const fogRemoval=prepareRemovedFogStructure256(world,structure);
  if(world.jobs.some(j=>j.fixBreakdown?.structureId===structure.id))return false;
  const shelfRemoval=planShelfRemoval(world,structure);if(!shelfRemoval)return false;
  const linked=prepareLinkedShelfRetirement286(world,[structure]);if(!linked.ok)return false;
  const structures = world.structures.filter(s => s.id !== structure.id);
  const jobs = world.jobs.filter(j => j.id !== job.id);
  // The preview owns piles and escrow: planning several ingredient refunds must
  // neither mutate live stacks nor promise one ground cell to incompatible items.
  const view = { ...world, structures, jobs: jobs.map(j => ({ ...j, escrow: { ...j.escrow } })), piles: shelfRemoval.view.piles };
  const graveRelease=planGraveRelease(view,structure);if(!graveRelease)return false;
  // Occupy the preview cell before planning any other restitution. The same
  // body identity will be moved there only after all preflights succeed.
  if(graveRelease.corpseId!==null)view.piles.find(p=>p.id===graveRelease.corpseId)!.owner={type:'ground',...graveRelease.cell!};
  const refunds: { item: ItemId; quantity: number; cell: { x:number; z:number } }[] = [];
  let rng = world.rng, lostWood = 0, lostSteel = 0, lostComponents=0,lostPlasteel=0,lostUranium=0,lostAdvancedComponents=0,lostAiCores=0,lostGold=0;
  if(structure.kind==='glow-pod')rng=shipChunkNextRandom256(rng).rng; // actual singleton leavingsRect, no material/filth under Deconstruct
  const shipRefunds=structure.kind==='ship-chunk'?drawShipChunkDeconstruction256(structure,rng):null;if(shipRefunds)rng=shipRefunds.rng;let shipRefundIndex=0;
  const lostBlocks:Partial<Record<BlockMaterial,number>>={...world.deconstructed.lostBlocks};
  // Prospective accounting only: older textile losses remain unknown.
  const lostTextiles:Partial<Record<UpholsteryMaterial,number>>={...world.deconstructed.lostTextiles};
  for (const cost of structure.kind === 'campfire' || structure.kind === 'passive-cooler' ? [] : constructionRecipe(structure).ingredients) {
    let quantity = structure.kind==='torch-lamp'||structure.kind==='power-conduit'?0:Math.floor(cost.quantity / 2);
    const shipRefund=shipRefunds?.entries[shipRefundIndex++];if(shipRefund)quantity=shipRefund.quantity;const refundOrigin=shipRefund?.origin??structure;
    if (structure.kind!=='ship-chunk'&&structure.kind!=='torch-lamp'&&structure.kind!=='power-conduit'&&cost.quantity % 2) {
      rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; rng >>>= 0;
      if (rng / 0x100000000 < .5) quantity++;
    }
    const drops = !quantity ? [] : groundCapacity(view, refundOrigin, cost.item) >= quantity
      ? [{ cell: { x: refundOrigin.x, z: refundOrigin.z }, quantity }] : planGroundPlacement(view, quantity, refundOrigin, cost.item);
    if (!drops) return false;
    const newPiles = drops.filter(d => !groundPile(view, d.cell)).length;
    if (view.piles.length + newPiles > 32768 || !Number.isSafeInteger(view.nextId + newPiles)) return false;
    for (const drop of drops) {
      if(!materialCanFit(view,ITEM_DEFINITIONS[cost.item].kind,drop.quantity,{type:'ground',...drop.cell},cost.item))return false;
      refunds.push({ ...drop, item: cost.item });
      addMaterial(view, ITEM_DEFINITIONS[cost.item].kind, drop.quantity, { type: 'ground', ...drop.cell }, cost.item);
    }
    if (cost.item === 'wood') lostWood += cost.quantity - quantity;
    else if(cost.item==='steel')lostSteel += cost.quantity - quantity;
    else if(cost.item==='component')lostComponents+=cost.quantity-quantity;
    // Prospective ship parts only: older generic removals keep their ledger.
    else if(shipPart&&cost.item==='plasteel')lostPlasteel+=cost.quantity-quantity;
    else if(shipPart&&cost.item==='uranium')lostUranium+=cost.quantity-quantity;
    else if(shipPart&&cost.item==='advanced-component')lostAdvancedComponents+=cost.quantity-quantity;
    else if(shipPart&&cost.item==='ai-core')lostAiCores+=cost.quantity-quantity;
    else if(shipPart&&cost.item==='gold')lostGold+=cost.quantity-quantity;
    else if(isBlockMaterial(cost.item))lostBlocks[cost.item]=(lostBlocks[cost.item]??0)+cost.quantity-quantity;
    else if(world.schemaVersion>=189&&isUpholsteryMaterial(cost.item))lostTextiles[cost.item]=(lostTextiles[cost.item]??0)+cost.quantity-quantity;
  }
  const fuelTicks = structure.fuel ? structure.fuel.ticks + structure.fuel.burned : 0;
  const ledger = world.deconstructed;
  const fermentation=fermentationContents265(structure),fermentationLostKey=fermentation?.item==='beer'?'lostBeer':'lostWort';
  if(fermentation&&!Number.isSafeInteger((ledger[fermentationLostKey]??0)+fermentation.quantity))return false;
  if (![(ledger.lostGold298??0)+lostGold,(ledger.lostAiCores298??0)+lostAiCores,(ledger.lostPlasteel275??0)+lostPlasteel,(ledger.lostUranium??0)+lostUranium,(ledger.lostAdvancedComponents271??0)+lostAdvancedComponents,(ledger.lostComponents??0)+lostComponents, ledger.count + 1, ledger.lostWood + lostWood, (ledger.lostSteel ?? 0) + lostSteel, ledger.fuelTicks + fuelTicks,...Object.values(lostBlocks),...Object.values(lostTextiles)].every(Number.isSafeInteger)) return false;
  if(!linked.current())return false;
  if(!commitGraveRelease(world,structure,graveRelease))return false;
  if(!linked.commit())throw Error('Admitted linked shelf deconstruction changed during grave release');
  commitShelfRemoval(world,shelfRemoval);
  world.structures = structures; world.jobs = jobs; world.rng = rng;
  if(job.wallDoor296)retireWallDoorWork296(world,job);
  bedOwnership?.commit();
  releaseStructureMelee(world,structure.id);
  for(const a of world.wildlife?.animals??[])if(a.manhunter?.door?.targetId===structure.id)delete a.manhunter.door;
  for (const d of refunds) addMaterial(world, ITEM_DEFINITIONS[d.item].kind, d.quantity, { type: 'ground', ...d.cell }, d.item);
  ledger.count++; ledger.lostWood += lostWood; ledger.fuelTicks += fuelTicks;
  if(fermentation)ledger[fermentationLostKey]=(ledger[fermentationLostKey]??0)+fermentation.quantity;
  if(lostComponents)ledger.lostComponents=(ledger.lostComponents??0)+lostComponents;
  if(lostPlasteel)ledger.lostPlasteel275=(ledger.lostPlasteel275??0)+lostPlasteel;
  if(lostUranium)ledger.lostUranium=(ledger.lostUranium??0)+lostUranium;
  if(lostGold)ledger.lostGold298=(ledger.lostGold298??0)+lostGold;
  if(lostAiCores)ledger.lostAiCores298=(ledger.lostAiCores298??0)+lostAiCores;
  if(lostAdvancedComponents)ledger.lostAdvancedComponents271=(ledger.lostAdvancedComponents271??0)+lostAdvancedComponents;
  if (lostSteel) ledger.lostSteel = (ledger.lostSteel ?? 0) + lostSteel;
  if(Object.keys(lostBlocks).length)ledger.lostBlocks=lostBlocks;
  if(Object.keys(lostTextiles).length)ledger.lostTextiles=lostTextiles;
  for (const p of world.pawns) {
    if(p.bombRefuge?.sourceId===structure.id){
      p.bombRefuge.endCore=Math.min(p.bombRefuge.endCore,world.tick*10);
      if(p.moveCooldown===0&&(p.motion?.end??0)<=world.tick&&!p.melee?.strike&&!p.shooting?.stance&&!p.stun){delete p.bombRefuge;p.path=[];p.planCooldown=0;if(p.state==='moving')p.state='idle';}
    }
    if (p.bedId === structure.id) {p.bedId = null;delete p.bedSlot;}
    // A table is not exclusively reserved by its eaters. Keep their actual meal
    // and position, remove the vanished surface before ingestion can benefit.
    if (p.need?.kind === 'eat' && p.need.dining?.tableId === structure.id) p.need.dining.tableId = null;
  }
  if(structure.kind==='hydroponics-basin')removeHydroponicPlants(world,structure);
  commitRemovedFogBlocker256(world,fogRemoval);
  notifyShipRootDestruction298(world,structure);
  return true;
}
