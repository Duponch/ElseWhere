import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validNovelPile295} from './book-save-295.ts';
import type { PowerParentReader } from './power-parent-validation.ts';
import type { ValidationIdentityContext } from './validation-identities.ts';
import { isColonist } from './affiliation.ts';
import { captureHumanOwners } from './human-owners.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { validatePileRecordShape } from './material-record-save.ts';
import { validatePreservation } from './food-preservation-save.ts';
import { microelectronicsUnlocked } from './research.ts';
import { orbitalConsoleSpot,ORBITAL_BULK_EXTRAS } from './orbital-rules.ts';
import { orbitalBeerCatalogue265,orbitalNovelCatalogue295,ORBITAL_STOCK } from './orbital-stock.ts';
import { ORBITAL_TRADE_SCHEMA_338,orbitalMayHold338 } from './orbital-trade-338.ts';
import { pileMaxHp } from './thing-damage-rules.ts';
import { serviceCell } from './service-reservations.ts';
import { validatePower } from './power-save.ts';
import { ORBITAL_ACTIVE_CHECKS,ORBITAL_CHECK,ORBITAL_CYCLE,ORBITAL_DELIVERY_LIMIT,ORBITAL_FALL_TICKS,ORBITAL_LIFETIME,ORBITAL_OPEN_TICKS,ORBITAL_SHIP_LIMIT } from './orbital-state.ts';
import type { NumericMembershipSink } from './numeric-membership.ts';
import type { World } from './types.ts';

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const kinds=['orbital-beacon','comms-console'];
const orbitalOwner=(v:unknown)=>obj(v)&&(v.type==='orbital-ship'||v.type==='orbital-cargo');

/** Real owners, not historical receipt references, reserve the global namespace.
 * Invoke after the shared map, archive, group and ballistic registrations. */
export function registerOrbitalThingIds(w:World,ids:NumericMembershipSink):string[] {
  const errors:string[]=[];
  for(const owner of [...(w.orbital?.ships??[]),...(w.orbital?.pending??[])]){
    if(!int(owner.id,1,w.nextId-1)||ids.has(owner.id))errors.push('Duplicate or invalid orbital entity ID.');
    else ids.add(owner.id);
  }
  return errors;
}

/** Same original-World contract in file loading and SnapshotDecoder. Power
 * outages and urgent needs can be saved just before runtime reconciliation;
 * an active ready task still requires its exact settled physical contact. */
export function validOrbitalTransport(w:World,version:number,powerTopology?:PowerParentReader,identities?:ValidationIdentityContext):boolean {
  try {
    const humans=captureHumanOwners(w),foreign=humans.slots.filter(s=>s.kind!=='map');
    if(foreign.some(s=>s.pawn&&Object.hasOwn(s.pawn,'orbitalTrade')||s.items.some(i=>orbitalOwner(i.owner)))
      ||w.civilianPost?.stock.some(i=>Object.hasOwn(i,'owner')&&orbitalOwner((i as unknown as Record<string,unknown>).owner)))return false;
    const packs=[...(w.packed??[]),...foreign.flatMap(s=>s.packed)],buildings=[...w.structures,...packs.map(p=>p.building)];
    const content=[...buildings,...w.jobs,...w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.flick,j.fixBreakdown].filter(Boolean))];
    if(version<216)return !Object.hasOwn(w,'orbital')&&w.pawns.every(p=>!Object.hasOwn(p,'orbitalTrade'))
      &&content.every(s=>!s||!kinds.includes(s.kind))&&w.piles.every(p=>!orbitalOwner(p.owner));
    if(content.some(s=>s&&kinds.includes(s.kind)&&!(w.developerTest381===true&&developerResearchPlacement381(w,s)))&&!microelectronicsUnlocked(w))return false;
    if(packs.some(p=>p.building.kind==='comms-console')||buildings.some(s=>s.kind==='orbital-beacon'&&s.orientation!==0))return false;
    for(const kind of kinds)if(validatePower(w,version,kind as 'orbital-beacon'|'comms-console',powerTopology).length)return false;
    const state:unknown=w.orbital;
    if(state===undefined)return !Object.hasOwn(w,'orbital')&&w.pawns.every(p=>!Object.hasOwn(p,'orbitalTrade'))&&w.piles.every(p=>!orbitalOwner(p.owner));
    if(!obj(state)||!keys(state,['profile','adoptedAt','rng','cycleStart','scheduledAt','nextCheckAt','ships','pending'])
      ||state.profile!=='orbital-v1'||!int(state.adoptedAt,0,w.tick)||!int(state.rng,1,0xffffffff)
      ||!int(state.cycleStart,state.adoptedAt,w.tick+ORBITAL_CHECK)||state.cycleStart%ORBITAL_CHECK!==0
      ||!int(state.scheduledAt,state.cycleStart,state.cycleStart+(ORBITAL_ACTIVE_CHECKS-1)*ORBITAL_CHECK)
      ||(state.scheduledAt-state.cycleStart)%ORBITAL_CHECK!==0
      ||!int(state.nextCheckAt,state.cycleStart,w.tick+ORBITAL_CHECK)||state.nextCheckAt%ORBITAL_CHECK!==0
      ||state.nextCheckAt>state.cycleStart+ORBITAL_CYCLE||!Array.isArray(state.ships)||state.ships.length>ORBITAL_SHIP_LIMIT
      ||!Array.isArray(state.pending)||state.pending.length>ORBITAL_DELIVERY_LIMIT)return false;
    const cell=(v:unknown)=>obj(v)&&keys(v,['x','z'])&&int(v.x,0,w.width-1)&&int(v.z,0,w.height-1);
    const ids=new Set<number>(),ships=new Set<number>(),deliveries=new Set<number>(),deliveryCells=new Set<number>();
    const localOwners=identities?identities.orbital(w,packs):new Set([...w.pawns,...w.resources,...w.structures,...w.jobs,...w.piles,...w.stockpiles,...w.growingZones,...packs.map(p=>p.building)].map(o=>o.id));
    for(const s of state.ships){
      if(!obj(s)||!keys(s,['id','kind','name','arrivedAt','departAt','announced'])||!int(s.id,1,w.nextId-1)||ids.has(s.id)||localOwners.has(s.id)||humans.byId.has(s.id)
        ||!['bulk','exotic'].includes(String(s.kind))||typeof s.name!=='string'||s.name.trim().length===0||s.name.length>80
        ||!int(s.arrivedAt,state.adoptedAt,w.tick)||!int(s.departAt,w.tick+1)||s.departAt!==s.arrivedAt+ORBITAL_LIFETIME||typeof s.announced!=='boolean')return false;
      ids.add(s.id);ships.add(s.id);
    }
    for(const d of state.pending){
      if(!obj(d)||!keys(d,['id','shipId','negotiatorId','cell','createdAt','landAt','openAt'])||!int(d.id,1,w.nextId-1)||ids.has(d.id)||localOwners.has(d.id)||humans.byId.has(d.id)
        ||!int(d.shipId,1,w.nextId-1)||!int(d.negotiatorId,1,w.nextId-1)||d.shipId===d.negotiatorId||d.id===d.shipId||d.id===d.negotiatorId
        ||localOwners.has(d.shipId)||humans.byId.has(d.shipId)
        ||!humans.byId.has(d.negotiatorId)&&!w.trade?.recent.some(r=>r.negotiatorId===d.negotiatorId&&r.traderId===d.shipId&&r.tick===d.createdAt)
        ||!cell(d.cell)||!int(d.createdAt,state.adoptedAt,w.tick)||!int(d.landAt)||d.landAt!==d.createdAt+ORBITAL_FALL_TICKS
        ||!int(d.openAt)||d.openAt!==d.landAt+ORBITAL_OPEN_TICKS)return false;
      const source=w.orbital!.ships.find(s=>s.id===d.shipId);
      if(source&&(Number(d.createdAt)<source.arrivedAt||Number(d.createdAt)>=source.departAt))return false;
      const destination=d.cell as unknown as {x:number;z:number},index=destination.z*w.width+destination.x;
      if(deliveryCells.has(index))return false;deliveryCells.add(index);
      ids.add(d.id);deliveries.add(d.id);
    }
    if(w.orbital!.pending.some(d=>deliveries.has(d.shipId)))return false;
    if(w.piles.length>32768)return false;
    const cargo=new Set<number>();
    for(const p of w.piles){
      if(!orbitalOwner(p.owner))continue;
      const o=p.owner;
      if(o.type!=='orbital-ship'&&o.type!=='orbital-cargo')return false;
      const ship=o.type==='orbital-ship'?w.orbital!.ships.find(s=>s.id===o.shipId):undefined;
      // Schema 338: Core WillTrade of the ship's kind (its stock or its purchases).
      const current338=version>=ORBITAL_TRADE_SCHEMA_338;
      const allowed=current338?ship?orbitalMayHold338(ship.kind,p.item):orbitalMayHold338('bulk',p.item)||orbitalMayHold338('exotic',p.item):ship?(version===295||(version===296||isCorePhysicalSchema297(version)))&&orbitalNovelCatalogue295(version,ship.kind,p.item)||orbitalBeerCatalogue265(version,ship.kind,p.item)||ORBITAL_STOCK[ship.kind].some(([item])=>item===p.item)||ship.kind==='bulk'&&ORBITAL_BULK_EXTRAS.has(p.item)
        :(version===295||(version===296||isCorePhysicalSchema297(version)))&&orbitalNovelCatalogue295(version,'bulk',p.item)||orbitalBeerCatalogue265(version,'bulk',p.item)||Object.values(ORBITAL_STOCK).some(stock=>stock.some(([item])=>item===p.item))||ORBITAL_BULK_EXTRAS.has(p.item);
      if(!obj(o)||!keys(o,o.type==='orbital-ship'?['type','shipId']:['type','deliveryId'])
        ||o.type==='orbital-ship'&&!ships.has(o.shipId)||o.type==='orbital-cargo'&&!deliveries.has(o.deliveryId)
        ||!int(p.id,1,w.nextId-1)||ids.has(p.id)||!Object.hasOwn(ITEM_DEFINITIONS,p.item)
        ||p.kind!==ITEM_DEFINITIONS[p.item].kind||!int(p.quantity,1,ITEM_DEFINITIONS[p.item].stackLimit)
        ||['corpse','mech-corpse','unfinished','weapon',...current338?[]:['apparel'],'chunk','blocks'].includes(p.kind)
        ||!allowed||!validNovelPile295(p,version)||p.haulRequested!==undefined||Object.keys(p).some(k=>!['id','kind','item','quantity','owner','rot','foodPoison','damage',...((version===295||(version===296||isCorePhysicalSchema297(version)))&&p.kind==='book'?['book','forbidden']:[]),...current338?['forbidden',...p.kind==='apparel'?['apparel']:[]]:[]].includes(k))
        ||p.damage!==undefined&&!int(p.damage,p.kind==='book'?0:1,pileMaxHp(p)-1)||validatePileRecordShape(p as unknown as Record<string,unknown>,w,version).length
        ||validatePreservation({...w,piles:[p]},version).length)return false;
      ids.add(p.id);if(o.type==='orbital-cargo')cargo.add(o.deliveryId);
    }
    if([...deliveries].some(id=>!cargo.has(id)))return false;
    const consoles=new Set<number>(),claimedShips=new Set<number>(),spots=new Set<number>();
    for(const p of w.pawns){
      if(!Object.hasOwn(p,'orbitalTrade'))continue;
      const t:unknown=p.orbitalTrade;
      if(!obj(t)||!keys(t,['shipId','consoleId','spot','phase','startedAt'])||!int(t.shipId,1,w.nextId-1)||!ships.has(t.shipId)
        ||!int(t.consoleId,1,w.nextId-1)||!cell(t.spot)||!['approach','ready'].includes(String(t.phase))||!int(t.startedAt,state.adoptedAt,w.tick))return false;
      if(t.startedAt<w.orbital!.ships.find(s=>s.id===t.shipId)!.arrivedAt)return false;
      const console=w.structures.find(s=>s.id===t.consoleId&&s.kind==='comms-console'),spot=t.spot as unknown as {x:number;z:number};
      if(!console)return false;
      const expected=orbitalConsoleSpot(console),index=spot.z*w.width+spot.x;
      if(expected.x!==spot.x||expected.z!==spot.z||consoles.has(console.id)||claimedShips.has(t.shipId)||spots.has(index))return false;
      if(t.phase==='ready'&&(p.state!=='idle'||p.x!==spot.x||p.z!==spot.z||p.path.length||p.moveCooldown!==0||(p.motion?.end??0)>w.tick)
        ||t.phase==='approach'&&p.state!=='moving')return false;
      if(!isColonist(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.draft||p.mental?.crisis||p.interruptedCargo
        ||p.jobId!==null||p.haul||p.need||p.cooking||p.research||p.hunting||p.deepWork||p.animalHandling||p.animalCare||p.animalFeed
        ||p.rescue||p.tend||p.surgery||p.feed||p.ward||p.equipmentTask||p.burial||p.cleaning||p.firefighting
        ||p.shooting||p.melee||p.flee||p.tactics||p.burning||p.heatRefuge||p.bombRefuge||p.trade
        ||p.recreation.task||p.orders.active!==null||p.orders.queue.length||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))return false;
      for(const other of w.pawns)if(other!==p){const c=serviceCell(other,w);if(c&&c.x===spot.x&&c.z===spot.z)return false;}
      consoles.add(console.id);claimedShips.add(t.shipId);spots.add(index);
    }
    return true;
  }catch{return false;}
}
import {developerResearchPlacement381} from './developer-import-381.ts';
