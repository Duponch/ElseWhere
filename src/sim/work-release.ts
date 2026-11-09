import {releaseIdleWander300} from './idle-wander-300.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type {FactionCommsPawn298} from './faction-comms-state-298.ts';
import {preparePartyRelease292} from './party-release-292.ts';
import { wallDoorImplicitOrphan296 } from './wall-door-state-296.ts';
import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {releaseShipCasketCarry277} from './ship-casket-carry-277.ts';
import {prepareCoupleRelease285} from './couple-release-285.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import type {ReformDeparture260} from './group-reform-departure-260.ts';
import {hasTravellingCargo} from './interrupted-cargo.ts';
import { releaseSurgeryState } from './surgery-state.ts';
import { releaseAllowedAreaReturn } from './allowed-area-state.ts';
import { cancelHunting } from './hunting-state.ts';
import { leadRopees } from './animal-leading.ts';
import { finishRoomRest,rememberRoomUse } from './room-experience.ts';
import { feedingWork } from './feeding-rules.ts';
import { cancelAutomaticCombat } from './automatic-combat-state.ts';
import {releaseAnimalRescue} from './animal-rest-state.ts';
import { releaseRescue,releaseCryptosleepCarry271 } from './rescue-state.ts';
import { updatePawnHealth } from './health.ts';
import { isRoofJob } from './roof-rules.ts';
import { taskWork } from './production-recipes.ts';
import { furnitureIntentAt, furnitureSourceCells } from './furniture-rules.ts';
import { furnitureDropCell, releaseFurniture } from './furniture-transfer.ts';
import { resetWork } from './work-progress.ts';
import { zonesUnderPlan } from './construction-zones.ts';
import { isShelfKind } from './shelf-storage.ts';
import { constructionHaulId } from './construction-rules.ts';
import type { Cell, Command, MaterialPile, Pawn, World } from './types.ts';
import { disablesWork, workType } from './work-types.ts';
import { haulingWork } from './haul-aside.ts';
import { footprintCells } from './definitions.ts';
import { queryArea } from './designation.ts';
import { stockpileZoneCells } from './stockpile-zones.ts';
import { dropRetainingIdentity } from './ground-placement.ts';
import { structureById } from './structure-navigation.ts';
export type DropPlan=Map<number,Cell>;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;

/** Floor-bed retirement interrupts actual use/services, not unrelated owner work. */
export function humanSleepingSpotActors(world:World,ids:ReadonlySet<number>):Pawn[] {
  if(!ids.size)return [];
  const patients=new Set(world.pawns.filter(p=>ids.has(p.bedId??-1)||p.need?.kind==='sleep'&&ids.has(p.need.bedId??-1)).map(p=>p.id));
  return world.pawns.filter(p=>p.need?.kind==='sleep'&&ids.has(p.need.bedId??-1)
    ||p.rescue&&ids.has(p.rescue.bedId)||p.surgery&&ids.has(p.surgery.bedId)
    ||p.ward&&patients.has(p.ward.patientId)||p.feed&&patients.has(p.feed.patientId)||p.tend&&patients.has(p.tend.patientId));
}

/** Plan only ownership released by this command, before any command mutation.
 * Store the selected cells so a later greedy search cannot invalidate the plan. */
export function planCommandDrops(world:World,command:Command|import('./cave-glowpod-minification-256.ts').NaturalInstallPlan256):DropPlan|null {
  if(command.type==='designate'&&(command.kind==='sleeping-spot'||command.kind==='animal-sleeping-spot'))return new Map();
  const jobs=new Set<number>(),zones=new Set<number>(),pawns=new Set<number>();
  let retiringGrowingActors:Set<number>|undefined;
  if(command.type==='order-enter-ship-casket'||command.type==='order-carry-ship-casket'||command.type==='order-enter-cryptosleep'||command.type==='order-carry-cryptosleep'||command.type==='order-open-cryptosleep'||command.type==='order-bury'||command.type==='clean-room'||command.type==='order-faction-comms'||command.type==='order-orbital-trade'||command.type==='order-trade'||command.type==='order-extinguish'||command.type==='order-capture'||command.type==='order-arrest'||command.type==='order-equipment'||command.type==='order-feed'||command.type==='order-tend'||command.type==='order-drafted-tend'||command.type==='order-consume'||command.type==='order-animal-rescue'||command.type==='order-rescue'||command.type==='order-job'||command.type==='order-cook'||command.type==='order-haul'||command.type==='clear-orders') {
    pawns.add(command.pawnId);
  } else if(command.type==='designate') {
    const affected=zonesUnderPlan(world,command);for(const id of affected.deliveries)zones.add(id);
    if(affected.growing.size){
      retiringGrowingActors=new Set<number>();
      for(const job of world.jobs)if(job.growingZoneId!==undefined&&affected.growing.has(job.growingZoneId))jobs.add(job.id);
      for(const pawn of world.pawns)if(pawn.jobId!==null&&jobs.has(pawn.jobId)
        ||pawn.haul?.destination.type==='aside'&&affected.growing.has(pawn.haul.destination.growingZoneId??-1)){pawns.add(pawn.id);retiringGrowingActors.add(pawn.id);}
    }
    if(command.kind==='deconstruct'||command.kind==='uninstall')for(const job of world.jobs)if(job.fixBreakdown&&footprintCells(job).some(c=>same(c,command)))jobs.add(job.id);
  } else if(command.type==='cancel') {
    const job=world.jobs.find(j=>footprintCells(j).some(c=>same(c,command)))??furnitureIntentAt(world,command);if(job)jobs.add(job.id);
  } else if(command.type==='area'&&(command.action==='cancel'||command.action==='remove-stockpile')) {
    const selection=queryArea(world,command);if(!selection.ok)return new Map();
    const cells=new Set(selection.cells);
    if(command.action==='cancel')for(const job of world.jobs){if([...footprintCells(job),...furnitureSourceCells(world,job)].some(c=>cells.has(c.z*world.width+c.x)))jobs.add(job.id);}
    else for(const zone of world.stockpiles)if(cells.has(zone.z*world.width+zone.x))zones.add(zone.id);
  } else if(command.type==='area'&&command.action==='remove-snow-clear'){
    const selected=queryArea(world,command);if(!selected.ok)return new Map();const cells=new Set(selected.cells);for(const p of world.pawns)if(p.cleaning?.snowCell!==undefined&&cells.has(p.cleaning.snowCell))pawns.add(p.id);
  } else if(command.type==='area'&&(command.action==='remove-home'||command.action==='deconstruct')) {
    const selection=queryArea(world,command);if(!selection.ok)return new Map();
    const cells=new Set(selection.cells);
    for(const job of world.jobs)if(job.fixBreakdown&&(
      command.action==='remove-home'?cells.has(job.z*world.width+job.x):footprintCells(job).some(c=>cells.has(c.z*world.width+c.x))
    ))jobs.add(job.id);
  } else if(command.type==='growing-policy'||command.type==='area'&&command.action==='remove-growing') {
    const cells=command.type==='area'?queryArea(world,command):null;
    const ids=new Set(command.type==='growing-policy'?[command.zoneId]:cells?.ok?world.growingZones.filter(z=>z.cells.some(c=>cells.cells.includes(c))).map(z=>z.id):[]);
    for(const pawn of world.pawns)if(pawn.haul?.destination.type==='aside'&&ids.has(pawn.haul.destination.growingZoneId??-1))pawns.add(pawn.id);
  } else if(command.type==='shelf-policy') {
    for(const id of structureById(world,command.structureId)?.shelf?.cells??[])zones.add(id);
  } else if(command.type==='stockpile-policy') {
    for(const zone of stockpileZoneCells(world,command.stockpileId))zones.add(zone.id);
  } else if(command.type==='stockpile') {
    for(const p of world.pawns)if(p.haul?.whole&&p.haul.destination.type==='aside'&&same(p.haul.destination,command))pawns.add(p.id);
    const zone=world.stockpiles.find(z=>same(z,command));if(zone)for(const cell of stockpileZoneCells(world,zone.id))zones.add(cell.id);
  } else if(command.type==='priority'&&command.value===0) {
    const pawn=world.pawns.find(p=>p.id===command.pawnId),job=world.jobs.find(j=>j.id===pawn?.jobId);
    if(pawn?.ward&&command.work==='warden'||pawn?.animalHandling&&command.work==='handle'||(pawn?.animalCare||pawn?.animalFeed||pawn?.animalRescue)&&command.work==='doctor')pawns.add(pawn.id);
    if(pawn?.burial&&command.work==='haul'&&pawn.orders.active!=='bury'||pawn?.cleaning&&!pawn.cleaning.forced&&command.work==='clean')pawns.add(pawn!.id);
    if(pawn&&((pawn.surgery&&command.work==='doctor')||(pawn.tend&&command.work==='doctor'&&pawn.orders.active!=='tend')||(pawn.feed&&command.work===feedingWork(world.pawns.find(p=>p.id===pawn.feed!.patientId))&&pawn.orders.active!=='feed')||(pawn.brewing&&command.work==='haul')||(pawn.haul&&pawn.orders.active!=='haul'&&command.work===haulingWork(pawn.haul.destination))||(job&&workType(job)===command.work&&pawn.orders.active===null)||(pawn.cooking&&pawn.orders.active!=='cook'&&disablesWork(world,pawn,command.work,taskWork(pawn.cooking)))))pawns.add(pawn.id);
  } else if(command.type==='bill-remove'||command.type==='bill-update') {
    for(const pawn of world.pawns)if(pawn.cooking?.billId===command.billId&&pawn.cooking.stationId===command.structureId
      &&!(pawn.cooking.recipe==='burn-apparel'&&hasTravellingCargo(world,pawn)))pawns.add(pawn.id);
  } else if(command.type==='turret-auto-reload'&&!command.enabled) {
    for(const pawn of world.pawns)if(pawn.haul?.destination.type==='turret'&&!pawn.haul.destination.forced&&pawn.haul.destination.structureId===command.structureId)pawns.add(pawn.id);
  } else if(command.type==='refuel-policy' && !command.enabled) {
    for(const pawn of world.pawns)if(pawn.haul?.destination.type==='fuel'&&!pawn.haul.destination.forced&&pawn.haul.destination.structureId===command.structureId)pawns.add(pawn.id);
  } else if(command.type==='assign-bed') {
    const bed=structureById(world,command.bedId),owner=world.pawns.find(p=>p.id===command.pawnId);
    if(bed?.kind==='double-bed'){
      if((command.slot===0||command.slot===1)&&!(owner?.bedId===bed.id&&owner.bedSlot===command.slot)){
        const affected=new Set(world.pawns.filter(p=>p.bedId===bed.id&&p.bedSlot===command.slot||p.id===command.pawnId).map(p=>p.id));
        for(const pawn of world.pawns)if((pawn.need?.kind==='sleep'||pawn.coupleTask285!==undefined)&&affected.has(pawn.id)||pawn.rescue&&(affected.has(pawn.rescue.patientId)||pawn.rescue.bedId===bed.id&&pawn.rescue.bedSlot===command.slot))pawns.add(pawn.id);
      }
    }else if(command.slot===undefined){
      for(const pawn of world.pawns)if((pawn.need?.kind==='sleep'||pawn.coupleTask285!==undefined)&&(pawn.bedId===command.bedId||pawn.id===command.pawnId)
        ||owner?.bedSlot!==undefined&&pawn.rescue?.patientId===owner.id)pawns.add(pawn.id);
    }
  }
  for(const pawn of world.pawns)if((pawn.jobId!==null&&jobs.has(pawn.jobId))||(pawn.haul&&(jobs.has(constructionHaulId(pawn.haul.destination)??-1)||pawn.haul.destination.type==='stockpile'&&zones.has(pawn.haul.destination.stockpileId))))pawns.add(pawn.id);
  if(command.type==='designate'&&command.kind==='deconstruct'||command.type==='area'&&command.action==='deconstruct'){
    const selection=command.type==='area'?queryArea(world,command):null;const cells=selection?.ok?new Set(selection.cells):null;
    const spots=new Set(world.structures.filter(s=>(s.kind==='crafting-spot'||s.kind==='butcher-spot')&&(cells?cells.has(s.z*world.width+s.x):command.type==='designate'&&same(s,command))).map(s=>s.id));
    for(const p of world.pawns)if(p.cooking&&spots.has(p.cooking.stationId))pawns.add(p.id);
    const humanSpots=new Set(world.structures.filter(s=>s.kind==='sleeping-spot'&&(cells?footprintCells(s).some(c=>cells.has(c.z*world.width+c.x)):command.type==='designate'&&(command.targetId===undefined||command.targetId===s.id)&&footprintCells(s).some(c=>same(c,command)))).map(s=>s.id));
    for(const p of humanSleepingSpotActors(world,humanSpots))pawns.add(p.id);
  }
  // Zone retirement must not put a held object down at the logical end of
  // an edge still physically in progress. Growing actors are exactly those
  // canceled by removeZonesForPlan; construction and installation share this.
  if(command.type==='designate'&&(isShelfKind(command.kind)||retiringGrowingActors?.size))for(const pawn of world.pawns)
    if(pawns.has(pawn.id)&&(isShelfKind(command.kind)||retiringGrowingActors?.has(pawn.id))
      &&(pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick)
      &&(world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)
        ||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)))return null;
  return planSelectedDrops(world,jobs,pawns);
}
/** Preflight a single automatic job as one transaction, including material
 * already delivered and any piece still held by a carrier. */
export function planJobDrops(world:World,jobId:number):DropPlan|null {
  const pawns=new Set<number>();
  for(const pawn of world.pawns)if(pawn.jobId===jobId||pawn.haul?.destination.type==='job'&&pawn.haul.destination.jobId===jobId)pawns.add(pawn.id);
  return planSelectedDrops(world,new Set([jobId]),pawns);
}
export function planPawnDrops(world:World,pawnIds:ReadonlySet<number>):DropPlan|null {
  return planSelectedDrops(world,new Set(),new Set(pawnIds));
}
/** Placement-only read of the exact admitted departure writes. No registry,
 * authority, actor clone, ID, RNG or real-map replacement is created. The
 * ordinary placement helper still owns capacity, reservations and its private
 * pile/pack shadow. Departing drops and reduced/source-removed freight already
 * occupy their planned cells before the remaining actors ask for a slot. */
export function planReformRemainingDrops260(world:World,pawnIds:ReadonlySet<number>,departure:ReformDeparture260):DropPlan|null {
 const piles=(departure.valueAfter(world,'piles') as MaterialPile[]).map(p=>({...p,owner:departure.valueAfter(p,'owner') as MaterialPile['owner'],quantity:departure.valueAfter(p,'quantity') as number}));
 const packed=(departure.valueAfter(world,'packed') as World['packed']).map(p=>({...p,owner:departure.valueAfter(p,'owner') as typeof p.owner}));
 const placement={...world,pawns:departure.valueAfter(world,'pawns') as Pawn[],piles,packed};
 return planSelectedDrops(placement,new Set(),new Set(pawnIds),new Set(),new Set(),true);
}
/** Human occupied boundary only; animal admission/coordinates stay separate. */
export function reformHumanOrigin260(world:Pick<World,'tick'>,pawn:Pawn):Cell {const cell=pawn.motion&&pawn.motion.end>world.tick?pawn.motion.from:pawn;return {x:cell.x,z:cell.z};}
export function planReformDrops260(world:World,pawns:Set<number>,captured:Set<number>,vacated:ReadonlySet<number>=new Set(),origins?:ReadonlyMap<number,Cell>):DropPlan|null {return planSelectedDrops(world,new Set(),pawns,captured,vacated,true,origins);}
export function planSelectedDrops(world:World,jobs:Set<number>,pawns:Set<number>,captured:Set<number>=new Set(),vacated:ReadonlySet<number>=new Set(),stopDead260=false,origins?:ReadonlyMap<number,Cell>):DropPlan|null {
  const result:DropPlan=new Map();
  if(!jobs.size&&!pawns.size)return result;
  const shadow={...world,packed:world.packed?.filter(p=>!vacated.has(p.building.id)).map(p=>({...p,owner:{...p.owner}})),piles:world.piles.filter(p=>!vacated.has(p.id)).map(p=>({...p,owner:{...p.owner}}))};
  const add=(pile:MaterialPile,origin:Cell)=>{
    if(!dropRetainingIdentity(shadow,pile,origin)||pile.owner.type!=='ground')return false;
    result.set(pile.id,{x:pile.owner.x,z:pile.owner.z});return true;
  };
  for(const pawn of world.pawns)if(pawns.has(pawn.id)) {
    const origin=origins?.get(pawn.id)??(stopDead260?reformHumanOrigin260(world,pawn):pawn);
    const held=shadow.piles.filter(p=>(p.owner.type==='pawn'||captured.has(pawn.id)&&p.owner.type==='equipment')&&p.owner.pawnId===pawn.id);
    for(const pile of held)if(!add(pile,origin))return null;
    const pack=shadow.packed?.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
    if(pack){const cell=furnitureDropCell(shadow,origin,pawn.id);if(!cell)return null;pack.owner={type:'ground',...cell};result.set(pack.building.id,cell);}
  }
  for(const pile of shadow.piles)if(pile.owner.type==='job'&&jobs.has(pile.owner.jobId)) {
    const job=world.jobs.find(j=>pile.owner.type==='job'&&j.id===pile.owner.jobId)!;
    if(!add(pile,job))return null;
  }
  return result;
}
export function commitDrop(world:World,pile:MaterialPile,origin:Cell,plan?:ReadonlyMap<number,Cell>):boolean {
  const cell=plan?.get(pile.id);
  if(cell){pile.owner={type:'ground',...cell};return true;}
  return dropRetainingIdentity(world,pile,origin);
}
export function releaseWork(world:World,pawn:Pawn,plan?:DropPlan,ownerLoss=false):boolean {
  // Refuse an immutable collective issue before any furniture/cargo drop.
  if((Number(world.schemaVersion)===292||(Number(world.schemaVersion)===293||Number(world.schemaVersion)===294||Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion)))))&&(world.party292?.active?.members.some(m=>m.pawnId===pawn.id)||ownerLoss&&world.party292?.active?.organizerId===pawn.id)){try{if(!preparePartyRelease292(world,new Set([pawn.id]),{death:!!pawn.health?.death,finish:ownerLoss&&world.party292?.active?.organizerId===pawn.id}).current())return false;}catch{return false;}}
  if(!releaseFurniture(world,pawn,plan))return false;
  const held=world.piles.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
  if(held&&!commitDrop(world,held,pawn,plan))return false;
  delete pawn.interruptedCargo;
  releaseAssignments(world,pawn,false,ownerLoss);
  return true;
}
/** Release task/service claims independently of ownership. Only involuntary or tactical
 * interruption may use this while an object is still carried. */
export function releaseAssignments(world:World,pawn:Pawn,despawning=false,ownerLoss=despawning):void {
  if((Number(world.schemaVersion)===292||(Number(world.schemaVersion)===293||Number(world.schemaVersion)===294||Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion)))))&&(pawn.recreation.task?.activity==='party'||world.party292?.active?.members.some(m=>m.pawnId===pawn.id)||ownerLoss&&world.party292?.active?.organizerId===pawn.id))preparePartyRelease292(world,new Set([pawn.id]),{death:!!pawn.health?.death,finish:ownerLoss&&world.party292?.active?.organizerId===pawn.id}).commit();
  if(isSchema285OrLater(world.schemaVersion)&&pawn.coupleTask285)prepareCoupleRelease285(world,new Set([pawn.id])).commit();
  releaseAllowedAreaReturn(pawn);
  releaseAnimalRescue(world,pawn);
  if(pawn.animalHandling?.kind==='lead'){
    const ids=new Set(leadRopees(pawn.animalHandling));
    for(const animal of world.wildlife?.animals??[])if(ids.has(animal.id)){animal.path=[];animal.nextDecision=world.tick+1;}
  }
  finishRoomRest(world,pawn);
  if((pawn.recreation.task?.activity==='horseshoes'||pawn.recreation.task?.activity==='chess'||pawn.recreation.task?.activity==='watch-television')&&pawn.recreation.task.phase==='active'&&pawn.recreation.task.elapsed>0)rememberRoomUse(world,pawn,'recreation');
  if(pawn.recreation.task?.activity==='read'&&pawn.recreation.task.stage==='read'&&pawn.recreation.task.elapsed>0)rememberRoomUse(world,pawn,'recreation');
  cancelAutomaticCombat(pawn);cancelHunting(pawn);
  if(!despawning&&pawn.need?.kind==='sleep'&&pawn.need.medical&&pawn.health&&!pawn.health.death&&medicalCivilTick271(pawn.health)<world.tick)updatePawnHealth(world,pawn);
  releaseSurgeryState(world,pawn);
  delete pawn.openCasket;delete pawn.firefoamTask290;
  releaseShipCasketCarry277(world,pawn);
  releaseCryptosleepCarry271(world,pawn,despawning);
  releaseRescue(world,pawn,despawning);
  const releasedJob=world.jobs.find(j=>j.id===pawn.jobId);
  releasePawnJob259(releasedJob,pawn.id);
  if(releasedJob&&releasedJob.reservedBy===null&&wallDoorImplicitOrphan296(releasedJob)){
    world.jobs=world.jobs.filter(j=>j!==releasedJob);
    for(const p of world.pawns)p.orders.queue=p.orders.queue.filter(o=>o!==releasedJob.id);
  }
  clearReleasedPawnAssignments259(pawn);
}

/** Own-record half of the real release. Contextual claims/clinical/rescue
 * notifiers must run first on their actual owners; private preflight may reuse
 * this half only after checking that it has no cross-actor notifier. */
export function clearReleasedPawnAssignments259(pawn:Pawn):void {
  if(pawn.coupleTask285)throw Error('Entered couple stage requires its actual pair release before own-record cleanup');
  releaseIdleWander300(pawn,false);
  delete pawn.frameToil301;delete pawn.postureUntilCore301;
  delete (pawn as FactionCommsPawn298).factionComms298;
  delete pawn.brewing;delete pawn.orbitalTrade;delete pawn.deepWork;delete pawn.animalHandling;delete pawn.animalCare;delete pawn.animalFeed;delete pawn.burial;delete pawn.cleaning;delete pawn.trade;delete pawn.firefighting;delete pawn.ward;delete pawn.heatRefuge;delete pawn.research;delete pawn.tend;delete pawn.feed;delete pawn.medicalSleep;delete pawn.equipmentTask;
  delete pawn.shipCasketTask277;delete pawn.cryptosleepTask;delete pawn.rescue;delete pawn.animalRescue;delete pawn.surgery;delete pawn.hunting;delete pawn.openCasket;delete pawn.firefoamTask290;
  delete pawn.transitExit;
  pawn.orders.active=null;
  pawn.recreation.task=null;pawn.jobId=null;pawn.haul=null;pawn.cooking=null;pawn.need=null;pawn.path=[];if(pawn.state!=='downed'&&pawn.state!=='dead')pawn.state='idle';pawn.planCooldown=20;pawn.needCooldown=20;
}

/** Reform leaves unselected inventory on the same real map; no stock credit. */
export function planReformInventoryDrops260(world:World,piles:readonly MaterialPile[],packs:readonly import('./furniture-rules.ts').PackedFurniture[],prior:DropPlan,vacated:ReadonlySet<number>=new Set(),humanOrigins?:ReadonlyMap<number,Cell>):DropPlan|null {
 const shadow={...world,piles:world.piles.filter(p=>!vacated.has(p.id)).map(p=>({...p,...piles.find(q=>q.id===p.id),owner:{...p.owner}})),packed:world.packed.filter(p=>!vacated.has(p.building.id)).map(p=>({...p,owner:{...p.owner}}))};
 for(const [id,cell] of prior){const p=shadow.piles.find(p=>p.id===id);if(p)p.owner={type:'ground',...cell};const pack=shadow.packed.find(p=>p.building.id===id);if(pack)pack.owner={type:'ground',...cell};}
 const result:DropPlan=new Map();
 for(const p of piles){if(p.owner.type!=='inventory')return null;const ownerId=p.owner.pawnId,holder=world.pawns.find(q=>q.id===ownerId)??world.wildlife?.animals.find(q=>q.id===ownerId),copy=shadow.piles.find(q=>q.id===p.id);if(!holder||!copy||!dropRetainingIdentity(shadow,copy,humanOrigins?.get(ownerId)??holder)||copy.owner.type!=='ground')return null;result.set(p.id,{x:copy.owner.x,z:copy.owner.z});}
 for(const p of packs){if(p.owner.type!=='inventory')return null;const ownerId=p.owner.pawnId,holder=world.pawns.find(q=>q.id===ownerId)??world.wildlife?.animals.find(q=>q.id===ownerId),copy=shadow.packed.find(q=>q.building.id===p.building.id);if(!holder||!copy)return null;const cell=furnitureDropCell(shadow,humanOrigins?.get(ownerId)??holder,holder.id);if(!cell)return null;copy.owner={type:'ground',...cell};result.set(p.building.id,cell);}return result;
}

/** Existing job half of release, also reusable on a private Job record. */
export function releasePawnJob259(job:import('./types.ts').Job|undefined,pawnId:number):void {
  if(job?.reservedBy===pawnId){if(job.wallDoor296){delete job.wallDoor296.fromBlueprint;if(job.wallDoor296.manual&&!job.wallDoor296.plan)delete job.wallDoor296;}if(job.tree?.kind==='replant'){job.tree.phase='pickup';job.tree.carryPileId=null;job.tree.workCore=0;delete job.tree.durationCore;delete job.clearance;resetWork(job);}delete job.installationWork;delete job.clearance;delete job.pickTicks;job.reservedBy=null;job.status='pending';if(job.repair)delete job.repair.warmed;if(job.kind==='smooth-floor'||job.kind==='remove-bridge'||job.kind==='remove-floor'||job.kind==='flick'||job.kind==='repair'||job.kind==='fix-breakdown'||job.furniture||job.kind==='mine'||job.kind==='sow'||job.kind==='deconstruct'||isRoofJob(job))resetWork(job);}
}
