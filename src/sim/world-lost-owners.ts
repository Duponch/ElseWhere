import {isSchema285OrLater} from './schema-compatibility-257.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {isPlayerCasket271} from './cryptosleep-state-271.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {heldCasketRemovalPermitted259} from './world-pawn-casket-259.ts';
import type {CampMapRemoved256} from './world-pawn-map-removed-256.ts';
import {cleanMapRemovedMechanical259} from './world-pawn-mechanical-259.ts';
import {clearActualGuest259} from './world-affiliation-259.ts';
import {detachHiveInsect256} from './cave-hive-lifecycle-256.ts';
import {CORE_STARTING_ARRIVAL_PROFILE_256} from './starting-pod-state-256.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
/** Map removal freezes the same episode and strips only its spatial job. */
import {isAncientCasket256,ancientCasketHasContents256,ancientCasketMapRemovalBoundary256} from './ancient-casket-state-256.ts';
import {cancelCryptosleepVomit256} from './cryptosleep-sickness-256.ts';
import {captureDuckMapRemovedOwners256} from './duck-owner-capture-256.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {World,Pawn,Cell} from './types.ts';
import type {AbandonedMapContents,AbandonedWorldPawn,CampaignState} from './world-map-state.ts';
import type {HumanOwnershipCapture,HumanOwnerSlot} from './human-owners.ts';
import {captureHumanOwners} from './human-owners.ts';
import {releaseAssignments,commitDrop} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {releaseFurniture} from './furniture-transfer.ts';
import {animalCarrier} from './animal-rest-state.ts';
const localFields=['allowedAreaId','allowedAreaReturn','bedSlot','priorityWork','transitExit','draft','flee','bombRefuge','tactics','melee','shooting','stagger','stun','meleeThreat','equipmentDropPending','droppedWeaponId','surgeryRequest','burning','filthFeet'] as const;
function stopAtOccupiedCell(p:Pawn,tick:number):void {if(p.motion&&p.motion.end>tick){p.x=p.motion.from.x;p.z=p.motion.from.z;}delete p.motion;p.path=[];p.moveCooldown=0;}
/** One actual DeSpawn/StopDead cleanup, shared by the real removal and its
 * per-record private preflight. No World clone or future-cell arrival. */
export function cleanMapRemovedAnimal256(animal:WildAnimal,tick:number):void {
 delete animal.animalThermalRefuge288;delete animal.animalAreaReturn287;delete animal.haul;
 if(animal.health){cancelCryptosleepVomit256(animal.health);cancelToxicVomit256(animal.health);}if(animal.motion&&animal.motion.end>tick){animal.x=animal.motion.from.x;animal.z=animal.motion.from.z;}if(animal.wander)delete animal.wander.job;animal.path=[];for(const key of ['motion','meal','predation','exiting','flee','threat','retaliation','strike','stun','stagger','sleepUntilCore','mating','taming','animalRest','eggLay','burning','flight','exitFlight'] as const)delete animal[key];if(animal.domestic){delete animal.domestic.bedId;delete animal.domestic.penMarkerId;delete animal.domestic.slaughter;}if(animal.manhunter){delete animal.manhunter.targetId;delete animal.manhunter.door;}if(animal.state!=='dead'&&animal.state!=='downed')animal.state='idle';
}
/** Rare removal transition. Normal interruption/edge continuation is a different contract. */
export function detachMapOwners(map:World,mapId:number,tile:number,removalPlan?:CampMapRemoved256,drops260?:ReadonlyMap<number,Cell>,releaseCouples285?:()=>void):AbandonedMapContents {
 if(map.startingArrival?.profile===CORE_STARTING_ARRIVAL_PROFILE_256&&map.startingArrival.phase!=='opened')throw Error('Core initial capsules require actual discharge before MapRemoved');
 const retainedCaskets=heldCasketRemovalPermitted259(map,removalPlan);
 const casketRemoval=ancientCasketMapRemovalBoundary256(map);if(casketRemoval&&!retainedCaskets)throw Error(casketRemoval);
 if(map.structures.some(s=>isPlayerCasket271(s)&&s.cryptosleep.human)&&!retainedCaskets)throw Error('Occupied player casket requires its actual current MapRemoved permit.');
 if(map.structures.some(s=>isShipCasket277(s)&&s.shipCryptosleep277.occupant)&&!retainedCaskets)throw Error('Occupied spatial casket requires its actual current MapRemoved permit.');
 if(isSchema285OrLater(map.schemaVersion)&&map.pawns.some(p=>p.coupleTask285)&&!releaseCouples285)throw Error('Entered couple stages require the actual admitted MapRemoved pair release.');
 const heldAnimals=captureDuckMapRemovedOwners256(map),animalRows:AbandonedMapContents['animals']=[...(map.wildlife?.animals??[]).map(animal=>({animal})),...heldAnimals];
 const animalIds=new Set<number>();for(const row of animalRows){if(animalIds.has(row.animal.id))throw Error('Duplicate actual MapRemoved animal owner');animalIds.add(row.animal.id);}
 const before=captureHumanOwners(map,{},false),holders=new Map<number,number>(),animalHolders=new Map<number,number>();
 for(const p of map.pawns){if(p.rescue?.phase==='carry')holders.set(p.rescue.patientId,p.id);if(p.animalRescue?.phase==='carry')animalHolders.set(p.animalRescue.animalId,p.id);}
 if(map.schemaVersion>=256)for(const a of map.wildlife?.animals??[]){const carrier=animalCarrier(map,a.id);if(carrier)animalHolders.set(a.id,carrier.id);}
 releaseCouples285?.();
 // StopDead before cleanup or cargo search; no prospective endpoint is reached.
 for(const p of map.pawns){stopAtOccupiedCell(p,map.tick);if(p.health){cancelCryptosleepVomit256(p.health);cancelToxicVomit256(p.health);}}
 const guests=new Map<number,AbandonedWorldPawn['guest']>();
 for(const p of map.pawns){

  // Ordinary current jobs drop carry before Despawn. Rescue keeps its held Pawn.
  const hasJob=hasMapRemovalJob259(p);
  if(hasJob&&!p.rescue&&!p.animalRescue){const carry=map.piles.find(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
   if(drops260){
    // The source seal was consumed before Reform changed any holder. These
    // cells are the one jointly admitted plan, never a second placement scan.
    const pack=map.packed.find(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
    if(carry&&!drops260.has(carry.id)||pack&&!drops260.has(pack.building.id))throw Error('Missing admitted Reform MapRemoved drop');
    if(carry)commitDrop(map,carry,p,drops260);releaseFurniture(map,p,drops260);
   }else {if(carry)dropRetainingIdentity(map,carry,p);releaseFurniture(map,p);}
  }
  clearQueuedOrders(map,p);releaseAssignments(map,p,true);
  const guest:NonNullable<AbandonedWorldPawn['guest']>={};for(const key of ['prisoner','visitor','podRescue','raid'] as const)if(p[key]!==undefined&&!(map.schemaVersion>=259&&p.worldAffiliation259&&key==='prisoner')){Object.assign(guest,{[key]:p[key]});}if(guest.prisoner){delete guest.prisoner.escape;if(guest.prisoner.breakout)delete guest.prisoner.breakout.active;}if(guest.visitor)guest.visitor.goal=null;if(guest.raid)guest.raid.goal=null;if(Object.keys(guest).length)guests.set(p.id,guest);
  if(map.schemaVersion>=259&&p.worldAffiliation259)cleanMapRemovedHumanRecord259(p,map.tick);else {
  for(const key of ['prisoner','visitor','podRescue','raid'] as const)delete p[key];
  for(const key of localFields)delete p[key];p.bedId=null;delete p.interruptedCargo;
  if(p.social)delete p.social.fight;
  if(p.mental?.crisis?.kind==='confused-wander'){p.mental.crisis.target=null;p.mental.crisis.waitUntil=map.tick;}
  }
 }
 // Rescue cleanup can copy the carrier's idle `null` edge to a patient that
 // appeared earlier in the array. No local motion survives either ordering.
 for(const p of map.pawns){delete p.motion;p.path=[];p.moveCooldown=0;}
 const humans:AbandonedWorldPawn[]=before.slots.filter(s=>!['scout-away','commercial-away','group-away','group-loss',...retainedCaskets?['ancient-casket','player-casket','ship-casket']:[]].includes(s.kind)).map(s=>{
  const local=s.kind==='map',pawn=s.pawn,items=local?map.piles.filter(i=>'pawnId'in i.owner&&i.owner.pawnId===s.id&&['pawn','inventory','equipment','apparel'].includes(i.owner.type)):[...s.items],packed=local?map.packed.filter(i=>i.owner.type!=='ground'&&i.owner.pawnId===s.id):[...s.packed];
  if(local&&pawn&&(items.some(i=>i.owner.type==='pawn')||packed.some(i=>i.owner.type==='pawn')))pawn.interruptedCargo=true;
  return {id:s.id,name:s.name,kind:local?'world-lost':s.kind,clock:s.validationTick,...pawn?{pawn}:{},items,packed,...holders.has(s.id)?{carriedById:holders.get(s.id)!}:{},...s.place.kind==='starting-pod'?{podId:s.place.podId}:{},...guests.has(s.id)?{guest:guests.get(s.id)!}:{}};
 });
 const animals:AbandonedMapContents['animals']=animalRows.map(row=>{const animal=row.animal;detachHiveInsect256(map,animal);cleanMapRemovedAnimal256(animal,map.tick);const items=map.schemaVersion>=256?map.piles.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===animal.id):[],packed=map.schemaVersion>=256?map.packed.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===animal.id):[];return {...row,animal,...animalHolders.has(animal.id)?{carriedById:animalHolders.get(animal.id)!}:{},...items.length?{items}:{},...packed.length?{packed}:{}};});
 // Real DeSpawn interrupts local jobs/Lord goals but preserves physical timers.
 if(Number(map.schemaVersion)===259||Number(map.schemaVersion)===260||(Number(map.schemaVersion)===261||(Number(map.schemaVersion)===262||isSchema263OrLater(Number(map.schemaVersion))))){for(const m of map.mechanoids??[])cleanMapRemovedMechanical259(m,map.tick);if(map.raids?.mechActive)delete map.raids.mechActive;}
 // The actual261 removal retires the additional local Lord header too. Its
 // original actors are transferred by MapRemoved; the array owns no copies.
 if((Number(map.schemaVersion)===261||(Number(map.schemaVersion)===262||isSchema263OrLater(Number(map.schemaVersion))))&&map.raids&&Object.hasOwn(map.raids,'extraMechActive261'))delete map.raids.extraMechActive261;
 const pods=map.startingArrival&&map.startingArrival.phase!=='opened'?map.startingArrival.pods.map(p=>({id:p.id,pawnId:p.pawn.id,items:p.items.filter(i=>i.owner.type==='starting-pod')})):[];
 const retainedItems=new Set([...humans.flatMap(h=>h.items),...animals.flatMap(a=>a.items??[])].map(i=>i.id)),retainedPacked=new Set([...humans.flatMap(h=>h.packed),...animals.flatMap(a=>a.packed??[])].map(p=>p.building.id));
 const lost:AbandonedMapContents['lost']={items:{},structures:map.structures.length-(retainedCaskets?map.structures.filter(s=>isAncientCasket256(s)&&ancientCasketHasContents256(s.casket)||isPlayerCasket271(s)&&s.cryptosleep.human||isShipCasket277(s)&&s.shipCryptosleep277.occupant).length:0),resources:map.resources.length,packed:map.packed.filter(p=>!retainedPacked.has(p.building.id)).length};
 for(const pile of map.piles)if(!retainedItems.has(pile.id))lost.items[pile.item]=(lost.items[pile.item]??0)+pile.quantity;
 return {mapId,tile,removedAt:map.tick,context:{seed:map.seed,width:map.width,height:map.height,...map.climate?{climate:map.climate}:{},...map.site?{site:map.site}:{},...map.scenario?{scenario:map.scenario}:{}},filthPresent:!!map.filth,humans,animals,pods,lost};
}
/** Compact physical owners. A known world Pawn never becomes a local actor or a caravan. */
export function captureLostOwners(root:CampaignState):HumanOwnershipCapture {
 const slots:HumanOwnerSlot[]=[],byId=new Map<number,HumanOwnerSlot>(),people=new Map<number,import('./relationship-state.ts').RelationshipPerson>();
 for(const archive of root.worldGroups?.abandonedContents??[])for(const h of archive.humans){if(byId.has(h.id))throw Error('Duplicate lost human owner');const dead=h.pawn?.state==='dead'||h.pawn?.health?.death!==undefined,deathAt=h.pawn?.health?.death?.tick,slot:HumanOwnerSlot={id:h.id,name:h.name,kind:h.kind,simulation:h.pawn?'frozen':'identity-only',place:h.podId!==undefined?{kind:'starting-pod',podId:h.podId}:{kind:'archive'},status:dead?'dead':'departed',validationTick:h.clock,...h.pawn?{pawn:h.pawn}:{},...deathAt!==undefined?{deathAt}:{},items:h.items,packed:h.packed};slots.push(slot);byId.set(h.id,slot);people.set(h.id,{id:h.id,name:h.name,status:slot.status,...deathAt!==undefined?{deathAt}:{}});}
 return {byId,people,slots,pawnOwners:slots.filter(s=>s.pawn),local:[],away:[],contained:slots.filter(s=>s.kind==='starting-pod'),terminals:[],frozen:slots.filter(s=>s.kind!=='starting-pod'),census:{localOwned:0,localLiving:0,localDead:0,containedOwned:slots.filter(s=>s.kind==='starting-pod').length,containedLiving:slots.filter(s=>s.kind==='starting-pod'&&s.status!=='dead').length,containedPiles:0,legacyAwayOwned:0,legacyAwayLiving:0,groupAwayOwned:0,groupAwayLiving:0,terminalOwned:0,frozenPawnArchives:slots.filter(s=>s.pawn&&s.kind!=='starting-pod').length,simpleDepartureIdentities:slots.filter(s=>!s.pawn).length,knownHumans:people.size,mapPiles:0,legacyTravelPiles:0,groupTravelPiles:0,terminalPiles:0,archivedPiles:slots.reduce((n,s)=>n+s.items.length,0),postPiles:0,archivedPacked:slots.reduce((n,s)=>n+s.packed.length,0)}};
}

/** Final own-record MapDeiniter cleanup after REAL work notifiers. No clinical
 * tick, faction choice, new dossier or chronology is performed here. */
export function cleanMapRemovedHumanRecord259(p:Pawn,tick:number):void {
 delete p.orderedQueue378;
 if(p.prisoner){delete p.prisoner.escape;if(p.prisoner.breakout)delete p.prisoner.breakout.active;}
 clearActualGuest259(p);for(const k of ['visitor','podRescue','raid'] as const)delete p[k];
 for(const key of localFields)delete p[key];p.bedId=null;delete p.interruptedCargo;
 if(p.social)delete p.social.fight;
 if(p.mental?.crisis?.kind==='confused-wander'){p.mental.crisis.target=null;p.mental.crisis.waitUntil=tick;}
 delete p.motion;p.path=[];p.moveCooldown=0;
}

/** The existing ordinary-job DeSpawn carry-drop decision, shared with its
 * actual259 preflight. An interrupted owner without a job is not omitted. */
export function hasMapRemovalJob259(p:Pawn):boolean {return p.jobId!==null||!!p.cryptosleepTask||!!p.haul||!!p.cooking||!!p.need||!!p.orders.active||!!p.recreation.task||!!p.animalHandling||!!p.animalCare||!!p.animalFeed||!!p.tend||!!p.feed||!!p.surgery||!!p.rescue||!!p.animalRescue||!!p.trade||!!p.orbitalTrade||!!p.deepWork||!!p.research||!!p.hunting||!!p.cleaning||!!p.firefighting||!!p.burial||!!p.ward||!!p.equipmentTask||!!p.melee?.order||!!p.shooting?.order||!!p.tactics||!!p.mental?.crisis||!!p.flee||!!p.burning;}
