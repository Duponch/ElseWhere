import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {notifyShipRootDestruction298} from './ship-root-destruction-proof-298.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {startFirefoamWick290,registerFirefoamWave290} from './firefoam-290.ts';
import {rebuildFirefoamPopper290} from './firefoam-rebuild-290.ts';
import {reconcileFirefoamManual290} from './firefoam-manual-290.ts';
import {detachMissingProstheticBills273} from './prosthetic-work-273.ts';
import {prepareLinkedShelfRetirement286} from './linked-storage-lifecycle-286.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {isPlayerCasket271} from './cryptosleep-state-271.ts';
import {damagePlayerCryptosleep271} from './cryptosleep-removal-271.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {damageShipCasket277} from './ship-casket-removal-277.ts';
import {fermentationContents265} from './fermentation-state-265.ts';
import {damageCaveHiveProp256} from './cave-hive-damage-256.ts';
import {setMaterialForbidden256} from './material-permission-256.ts';
import {damageEmptyAncientCasket256} from './ancient-casket-empty-removal-256.ts';
import {isAncientCasket256} from './ancient-casket-state-256.ts';
import {ancientCasketRemovalRefusal256} from './ancient-casket-physical-256.ts';
import {commitGraveRelease} from './burial.ts';
import {planAnimalBodyRetirement256} from './animal-body-retirement-256.ts';
import {isDeteriorationItem} from './deterioration-content.ts';
import {destroyMinifiedTree} from './tree-transfer.ts';
import {commitShelfRemoval} from './shelf-retirement.ts';
import {prepareRemovedFogStructure256,commitRemovedFogBlocker256} from './exploration-runtime-256.ts';
import {removeHydroponicPlants} from './hydroponics.ts';
import {rebuildSpikeTrap} from './spike-trap-rebuild.ts';
import {detachMissingFlakBills} from './flak-work.ts';
import { releaseStructureMelee } from './melee-state.ts';
import {invalidateAnimalPens} from './animal-pens.ts';
import {detachMissingGunBills} from './gun-work.ts';
import {detachMissingComponentBills} from './component-work.ts';
import {detachMissingArtBills} from './art-work.ts';
import { constructionRecipe } from './construction-materials.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { addMaterial,refreshStock } from './materials.ts';
import { interruptWork,hasTravellingCargo } from './interrupted-cargo.ts';
import { commitDrop,releaseAssignments } from './work-release.ts';
import { releaseFurniture } from './furniture-transfer.ts';
import { planStructureDestruction } from './thing-destruction.ts';
import {prepareBedOwnershipTransition256} from './actor-bed-transition-256.ts';
import {prepareCoupleRelease285} from './couple-release-285.ts';
import { reconcileRoofSupport } from './roofing.ts';
import { reconcilePower } from './power.ts';
import { detachMissingBills } from './unfinished.ts';
import { ensureFireState } from './fire-rules.ts';
import { destroyHumanCorpse } from './human-corpses.ts';
import { neutralLossPlan } from './destruction-losses.ts';
import { miniTurretExplosive,registerBombWave,startTurretWick } from './bomb-creation.ts';
import type { BombInstigatorKey } from './mini-turret-state.ts';
import { pileDamage,pileMaxHp,resourceMaxHp,structureMaxHp } from './thing-damage-rules.ts';
import type { MaterialPile,Pawn,Resource,Structure,World } from './types.ts';
import { wallDoorBlueprint296 } from './wall-door-state-296.ts';
export { pileDamage,pileMaxHp,resourceMaxHp,structureMaxHp,copyThingDamage,mergeThingDamage } from './thing-damage-rules.ts';

const positive=(n:number)=>Number.isSafeInteger(n)&&n>0;
const addSafe=(a:number,b:number)=>Number.isSafeInteger(a+b);
const at=(a:{x:number;z:number},b:{x:number;z:number})=>a.x===b.x&&a.z===b.z;
function removeJobs(world:World,ids:Set<number>,retainTravellingCargo=false):void {
  if(!ids.size)return;
  for(const p of world.pawns)if(p.jobId!==null&&ids.has(p.jobId))interruptWork(world,p,retainTravellingCargo);
  for(const p of world.pawns)p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!ids.has(o));
  world.jobs=world.jobs.filter(j=>!ids.has(j.id));
}
/** Infection invalidates an earlier harvest, including a manual designation.
 * Cut work and construction clearance keep their existing owners. */
export function cancelResourceHarvests(world:World,resource:Resource):void {
  removeJobs(world,new Set(world.jobs.filter(job=>job.kind==='harvest'&&at(job,resource)).map(job=>job.id)));
}
/** `list.filter(c=>c!==r)` (a new array, the rest in order), by two copies
 * around the single occurrence instead of a test per resource. */
function withoutResource(list:readonly Resource[],r:Resource):Resource[] {
  const at=list.indexOf(r);
  if(at<0||list.indexOf(r,at+1)>=0)return list.filter(c=>c!==r);
  return list.slice(0,at).concat(list.slice(at+1));
}
/** Shared destructive plant boundary; the cause never creates a harvest. */
export function damageResource(world:World,r:Resource,amount:number,reason:'fire'|'frost'|'darkness'|'age'|'bullet'|'bomb'|'rotting'|'blight'|'roof'|'fallout'='fire'):boolean {
  const max=resourceMaxHp(r);if(!max||!positive(amount)||!world.resources.includes(r))return false;
  const damage=(r.damage??0)+amount;if(damage<max){r.damage=damage;return true;}
  const ledger=reason==='fire'?ensureFireState(world).ledger:undefined;
  const woodPotential=r.kind==='tree'?r.amount:0;
  const neutral=reason==='bullet'||reason==='bomb'||reason==='roof'||reason==='fallout'?neutralLossPlan(world,{resources:{[r.kind]:1},...(woodPotential?{woodPotentialLost:woodPotential}:{})}):undefined;
  if(neutral===null)return false;
  if(ledger&&(!addSafe(ledger.resources[r.kind]??0,1)||!addSafe(ledger.woodPotentialLost,woodPotential)))return false;
  const jobs=new Set(world.jobs.filter(j=>at(j,r)&&['mine','chop','cut','harvest','extract-tree'].includes(j.kind)).map(j=>j.id));
  removeJobs(world,jobs,reason==='roof');world.resources=withoutResource(world.resources,r);
  // The clearance step ended without a harvest. Keep its construction intent,
  // materials and unrelated queued work, but release this now-obsolete claim:
  // an unsupplied blueprint cannot retain a finishing-work reservation.
  for(const job of world.jobs)if(job.clearance?.resourceId===r.id){
    for(const p of world.pawns){
      if(p.jobId===job.id)releaseAssignments(world,p);
      p.orders.queue=p.orders.queue.filter(order=>order!==job.id);
    }
    delete job.clearance;delete job.installationWork;job.reservedBy=null;job.status='pending';
  }
  for(const a of world.wildlife?.animals??[])if(a.meal?.kind==='plant'&&a.meal.id===r.id){delete a.meal;a.path=[];a.nextDecision=world.tick;}
  if(ledger){ledger.resources[r.kind]=(ledger.resources[r.kind]??0)+1;ledger.woodPotentialLost+=woodPotential;}if(neutral)world.destroyed=neutral;return true;
}
function referencesPile(p:Pawn,id:number):boolean {
  const c=p.cooking,h=p.haul,n=p.need;
  return !!(p.recreation.task?.activity==='read'&&p.recreation.task.bookId===id||p.equipmentTask?.itemId===id||c&&(c.productId===id||c.ingredients.some(i=>i.pileId===id))
    ||h&&(h.sourcePileId===id||h.carryPileId===id)||n?.kind==='eat'&&(n.sourcePileId===id||n.carryPileId===id)
    ||p.animalHandling&&(p.animalHandling.sourcePileId===id||p.animalHandling.carryPileId===id)
    ||p.animalFeed&&(p.animalFeed.sourcePileId===id||p.animalFeed.carryPileId===id)
    ||p.animalCare?.medicine&&(p.animalCare.medicine.sourcePileId===id||p.animalCare.medicine.carryPileId===id)
    ||p.tend?.medicine&&(p.tend.medicine.sourcePileId===id||p.tend.medicine.carryPileId===id)
    ||p.feed&&(p.feed.sourcePileId===id||p.feed.carryPileId===id)||p.ward?.kind==='food'&&(p.ward.sourcePileId===id||p.ward.carryPileId===id));
}
/** A destroyed stack loses all its units. Other carried ingredients survive. */
export function damagePile(world:World,pile:MaterialPile,amount:number,cause:'fire'|'bullet'|'bomb'|'deterioration'|'roof'|'roof-thick'='fire',knownIndex?:number):boolean {
  if(cause==='deterioration'&&(world.schemaVersion<252||pile.owner.type!=='ground'||!isDeteriorationItem(pile.item)))return false;
  const max=pileMaxHp(pile,world.schemaVersion);if(!max&&cause!=='roof-thick'||!positive(amount)||!(knownIndex!==undefined&&Number.isInteger(knownIndex)&&knownIndex>=0&&knownIndex<world.piles.length&&world.piles[knownIndex]===pile||world.piles.includes(pile)))return false;
  const damage=pileDamage(pile)+amount;
  if(damage<max){if(pile.apparel)pile.apparel.hitPoints=max-damage;else if(pile.weapon)pile.weapon.hitPoints=max-damage;else pile.damage=damage;return true;}
  if(pile.kind==='plant')return destroyMinifiedTree(world,pile);
  if(pile.humanCorpse){
    if(cause==='deterioration'||!destroyHumanCorpse(world,pile,cause==='roof-thick'?'roof':cause))return false;
    for(const p of world.pawns){
      if(referencesPile(p,pile.id))interruptWork(world,p,cause==='roof'||cause==='roof-thick');
      if(p.interruptedCargo&&!world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!world.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))delete p.interruptedCargo;
    }
    refreshStock(world);return true;
  }
  if(world.schemaVersion>=256&&pile.corpse){
    const contents=planAnimalBodyRetirement256(world,pile.id,true,cause==='fire'?'fire':'neutral');if(!contents||!contents.commit())return false;
    for(const p of world.pawns){if(p.droppedWeaponId!==undefined&&contents.pileIds.has(p.droppedWeaponId))delete p.droppedWeaponId;
      if([...contents.pileIds].some(id=>referencesPile(p,id)))interruptWork(world,p,cause==='roof'||cause==='roof-thick');
      if(p.interruptedCargo&&!world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!world.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))delete p.interruptedCargo;}
    for(const a of world.wildlife?.animals??[])if(a.meal?.kind==='pile'&&contents.pileIds.has(a.meal.id)){delete a.meal;a.path=[];a.nextDecision=world.tick;}
    refreshStock(world);return true;
  }
  const neutral=cause==='fire'?undefined:neutralLossPlan(world,{items:{[pile.item]:pile.quantity}});if(neutral===null)return false;
  const state=cause==='fire'?ensureFireState(world):undefined,loss=state?.ledger.items[pile.item]??0;if(state&&!addSafe(loss,pile.quantity))return false;
  // Retire the source before releasing consumers; releasing must not drop a burnt pile back onto the ground.
  world.piles=world.piles.filter(p=>p!==pile);
  for(const p of world.pawns){
    if(p.droppedWeaponId===pile.id)delete p.droppedWeaponId;
    if(referencesPile(p,pile.id))interruptWork(world,p,cause==='deterioration'||cause==='roof'||cause==='roof-thick');
    if(p.interruptedCargo&&!world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!world.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))delete p.interruptedCargo;
  }
  for(const a of world.wildlife?.animals??[])if(a.meal?.kind==='pile'&&a.meal.id===pile.id){delete a.meal;a.path=[];a.nextDecision=world.tick;}
  if(state)state.ledger.items[pile.item]=loss+pile.quantity;if(neutral)world.destroyed=neutral;refreshStock(world);return true;
}
/** Damage installed or packed furniture. Salvage is preflighted before a fatal hit.
 * Quarter raw-material restitution follows the existing cooler adaptation. */
export type StructureDamageCause='fire'|'melee'|'bullet'|'bomb'|'roof'|'roof-thick';
export interface StructureDamageContext {core:number;rawAmount:number;instigatorKey?:BombInstigatorKey;detonate?:true;firefoamDetonate290?:true}
export function damageStructure(world:World,s:Structure,amount:number,cause:StructureDamageCause='fire',rng=world.rng,external?:StructureDamageContext):boolean {
  if(isPlayerCasket271(s))return damagePlayerCryptosleep271(world,s,amount,cause,rng,external);
  if(isShipCasket277(s))return damageShipCasket277(world,s,amount,cause,rng,external);
  if(s.kind==='insect-hive'||s.kind==='glow-pod')return damageCaveHiveProp256(world,s,amount,cause,rng,external);
  if(isAncientCasket256(s))return damageEmptyAncientCasket256(world,s,amount,cause,rng,external);
  if(s.kind==='ship-chunk'&&!isSchema256Or257(world.schemaVersion))return false;
  const packed=world.packed.find(p=>p.building===s),installed=world.structures.includes(s),max=structureMaxHp(s);
  if(!max&&cause!=='roof-thick'||!positive(amount)||!installed&&!packed)return false;
  if(external&&(!Number.isFinite(external.rawAmount)||external.rawAmount<0||!Number.isSafeInteger(external.core)||(isCorePhysicalSchema297(Number(world.schemaVersion))?external.core!==effectiveCore297(world):external.core<Math.max(0,(world.tick-1)*10)||external.core>world.tick*10)))return false;
  const core=external?.core??(isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):world.tick*10),explosive=world.schemaVersion>=193&&installed&&s.kind==='mini-turret'&&!!s.turret&&miniTurretExplosive(s.id);
  const detonates=explosive&&(external?.detonate|| (external?.rawAmount??amount)>=max-(s.damage??0));
  const foam=(Number(world.schemaVersion)===290||(Number(world.schemaVersion)===291||(Number(world.schemaVersion)===292||(Number(world.schemaVersion)===293||(Number(world.schemaVersion)===294||Number(world.schemaVersion)===295||Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion)))))))&&installed&&s.kind==='firefoam-popper'&&!!s.firefoam290;
  const foamDetonates=foam&&(external?.firefoamDetonate290|| (external?.rawAmount??amount)>=max-(s.damage??0));
  const emits=detonates||foamDetonates;
  if(foam&&(!Number.isSafeInteger(core+150)||foamDetonates&&(world.firefoam290?.waves.length??0)>=world.width*world.height))return false;
  if(explosive&&!Number.isSafeInteger(core+240)||detonates&&(!Number.isSafeInteger(core+5)||world.bombWaves&&world.bombWaves.length>=world.width*world.height))return false;
  const damage=emits?max:(s.damage??0)+amount;
  if(damage<max){s.damage=damage;if(cause!=='fire')world.rng=rng;if(explosive&&max-damage<=Math.round(max*.2))startTurretWick(world,s,core,external?.instigatorKey);if(foam&&cause==='fire')startFirefoamWick290(world,s,core);return true;}
  const bedOwnership=prepareBedOwnershipTransition256(world,s,'destroy');
  const fogRemoval=prepareRemovedFogStructure256(world,s);
  const owner=packed?.owner,origin=owner?.type==='ground'?owner:owner?.type==='pawn'||owner?.type==='inventory'?world.pawns.find(p=>p.id===owner.pawnId)??s:s;
  // Refusing a fatal hit must not create a fire ledger or advance its stream.
  const state=cause==='fire'&&!emits?(world.fires??ensureFireState({...world})):undefined;
  const ids=new Set(world.jobs.filter(j=>j.repair?.structureId===s.id||j.fixBreakdown?.structureId===s.id||j.deconstruction?.structureId===s.id||j.furniture?.structureId===s.id||j.flick?.structureId===s.id).map(j=>j.id));
  const wallDoorBlueprints=s.kind==='wall'?world.jobs.filter(j=>ids.has(j.id)).flatMap(j=>{const b=wallDoorBlueprint296(j);return b?[b]:[];}):[];
  const breakdownIds=new Set(world.jobs.filter(j=>j.fixBreakdown?.structureId===s.id).map(j=>j.id));
  const delivered=world.piles.filter(p=>p.owner.type==='job'&&breakdownIds.has(p.owner.jobId));
  const serviceLoss=delivered.reduce((sum,p)=>sum+(p.item==='component'?p.quantity:0),0);
  const actors=world.pawns.filter(p=>{
    const h=p.haul;
    return p.jobId!==null&&ids.has(p.jobId)||p.research?.stationId===s.id||p.cooking?.stationId===s.id||p.brewing?.barrelId===s.id
      ||h&&(h.whole&&h.sourcePileId===s.id||(h.destination.type==='fuel'||h.destination.type==='turret'||h.destination.type==='fermenting-barrel')&&h.destination.structureId===s.id||h.destination.type==='job'&&ids.has(h.destination.jobId))
      ||p.need?.kind==='sleep'&&p.need.bedId===s.id||p.coupleTask285?.bedId===s.id||p.recreation.task?.buildingId===s.id||p.recreation.task?.seatId===s.id||p.rescue?.bedId===s.id;
  });
  const plan=planStructureDestruction(emits?{...world,nextId:world.nextId+1}:world,s,actors,origin,state?.rng??rng,cause==='roof-thick');if(!plan)return false;
  if(emits&&!Number.isSafeInteger(world.nextId+1+(plan.salvage?.drops.length??0)))return false;
  const {salvage,drops}=plan;
  const destruction=world.destroyed??{count:0,lost:{}},lost={...destruction.lost};
  const fermentation=fermentationContents265(s);if(fermentation)lost[fermentation.item]=(lost[fermentation.item]??0)+fermentation.quantity;
  for(const cost of constructionRecipe(s).ingredients){const key=cost.item as keyof typeof lost,quantity=cost.quantity-(salvage?.returned.get(cost.item)??0);if(quantity)lost[key]=(lost[key]??0)+quantity;}
  if(serviceLoss)lost.component=(lost.component??0)+serviceLoss;
  const fuelLost=s.fuel?.ticks??0,fuelBurned=s.fuel?.burned??0;
  const energy=s.battery?(s.battery.stored+(s.battery.half?.5:0)):0;
  const totals=state?.ledger??destruction;
  if(!addSafe(totals.fuelTicksLost??0,fuelLost)||!addSafe(totals.fuelTicksBurned??0,fuelBurned)||!addSafe(destruction.count,1)||!Object.values(lost).every(Number.isSafeInteger)||!Number.isSafeInteger(((totals.batteryEnergyLost??0)+energy)*2)
    ||state&&(!addSafe(state.ledger.structures,1)||!addSafe(state.ledger.items.component??0,serviceLoss)))return false;
  const coupleIds=new Set(actors.filter(p=>p.coupleTask285?.bedId===s.id).map(p=>p.id));
  const coupleRelease=coupleIds.size?prepareCoupleRelease285(world,coupleIds):undefined;
  const linked=prepareLinkedShelfRetirement286(world,[s]);if(!linked.ok||!linked.current())return false;
  if(s.kind==='sarcophagus'&&!commitGraveRelease(world,s,plan.graveRelease))return false;
  if(!linked.commit())throw Error('Admitted linked shelf destruction changed during grave release');
  coupleRelease?.commit();
  if(state)world.fires=state;
  const waveId=emits?world.nextId++:undefined;
  if(plan.rubble){world.filth=plan.rubble.filth;world.nextId=plan.rubble.nextId;}
  commitShelfRemoval(world,plan.shelfRemoval);
  world.structures=world.structures.filter(b=>b!==s);world.packed=world.packed.filter(p=>p!==packed);
  bedOwnership?.commit();
  for(const p of world.pawns)if(p.bombRefuge?.sourceId===s.id){
    p.bombRefuge.endCore=Math.min(p.bombRefuge.endCore,core);
    if(waveId===undefined&&!p.moveCooldown&&!(p.motion&&p.motion.end>world.tick)&&!p.melee?.strike&&!p.shooting?.stance&&!p.stun){delete p.bombRefuge;p.path=[];if(p.state!=='dead'&&p.state!=='downed')p.state='idle';}
  }
  invalidateAnimalPens(world);
  // Commit exactly the floor preview before health/roof/task interruption can
  // cause other deposits. Those later effects see the already occupied floor.
  for(const p of actors){
    if(hasTravellingCargo(world,p))continue;
    const held=world.piles.find(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
    if(held&&drops.has(held.id))commitDrop(world,held,p,drops);
    const pack=world.packed.find(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
    if(pack&&drops.has(pack.building.id))releaseFurniture(world,p,drops);
  }
  if(delivered.length)world.piles=world.piles.filter(p=>!delivered.includes(p));
  if(state){if(salvage||plan.rubble)state.rng=salvage?.rng??plan.rubble!.rng;}else world.rng=salvage?.rng??plan.rubble?.rng??rng;
  if(salvage)for(const drop of salvage.drops){addMaterial(world,ITEM_DEFINITIONS[drop.item].kind,drop.quantity,{type:'ground',...drop.cell},drop.item);if('forbidden'in drop&&typeof drop.forbidden==='boolean'){const pile=world.piles.find(p=>p.item===drop.item&&p.owner.type==='ground'&&p.owner.x===drop.cell.x&&p.owner.z===drop.cell.z)!;setMaterialForbidden256(pile,drop.forbidden);}}
  for(const p of actors)interruptWork(world,p,true);
  for(const a of world.wildlife?.animals??[])if(a.manhunter?.door?.targetId===s.id)delete a.manhunter.door;
  removeJobs(world,ids,cause==='roof'||cause==='roof-thick');
  world.jobs.push(...wallDoorBlueprints);
  for(const p of world.pawns){
    if(p.bedId===s.id){p.bedId=null;delete p.bedSlot;}
    if(p.need?.kind==='eat'&&p.need.dining?.tableId===s.id)p.need.dining.tableId=null;
  }
  releaseStructureMelee(world,s.id);
  world.destroyed={...destruction,count:destruction.count+1,lost};
  if(state){state.ledger.structures++;state.ledger.batteryEnergyLost+=energy;state.ledger.fuelTicksLost+=fuelLost;state.ledger.fuelTicksBurned+=fuelBurned;
    if(serviceLoss)state.ledger.items.component=(state.ledger.items.component??0)+serviceLoss;
  }else {
    if(fuelLost)world.destroyed.fuelTicksLost=(destruction.fuelTicksLost??0)+fuelLost;
    if(fuelBurned)world.destroyed.fuelTicksBurned=(destruction.fuelTicksBurned??0)+fuelBurned;
    if(energy)world.destroyed.batteryEnergyLost=(destruction.batteryEnergyLost??0)+energy;
  }
  if(world.fires)world.fires.batteryWicks=world.fires.batteryWicks.filter(w=>w.structureId!==s.id);
  if(s.kind==='hydroponics-basin')removeHydroponicPlants(world,s);
  detachMissingBills(world);detachMissingFlakBills(world);detachMissingGunBills(world);detachMissingArtBills(world);detachMissingComponentBills(world);detachMissingProstheticBills273(world);reconcilePower(world);if(installed)reconcileRoofSupport(world,false,s);refreshStock(world);
  if(installed&&s.kind==='spike-trap')rebuildSpikeTrap(world,s);
  if(foam)rebuildFirefoamPopper290(world,s);
  if(waveId!==undefined){if(foamDetonates)registerFirefoamWave290(world,s,waveId,core);else registerBombWave(world,s,waveId,core,external?.instigatorKey??s.turret?.wick?.instigatorKey);}
  for(const p of world.pawns)if(p.firefoamTask290?.structureId===s.id)reconcileFirefoamManual290(world,p);
  commitRemovedFogBlocker256(world,fogRemoval);notifyShipRootDestruction298(world,s);return true;
}
