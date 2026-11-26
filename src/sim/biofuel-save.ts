import type { PowerParentReader } from './power-parent-validation.ts';
import {carryQuantityBound379} from './carry-quantity-379.ts';
import type { StagingGeometryReader } from './staging-validation.ts';
import { captureHumanOwners } from './human-owners.ts';
import { footprintCells } from './definitions.ts';
import { fuelItem,fuelLimit,FUEL_UNIT_TICKS,REFUEL_WORK_TICKS } from './fuel.ts';
import { reservedSource } from './materials.ts';
import { validatePileRecordShape } from './material-record-save.ts';
import { validatePower } from './power-save.ts';
import { biofuelRefiningUnlocked,BIOFUEL_RESEARCH_COST } from './research.ts';
import { validBiofuelProductionTransport } from './cooking-save.ts';
import { isBiofuelRecipe } from './production-recipes.ts';
import type { HaulTask,MaterialPile,Structure,World } from './types.ts';

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const kinds=['biofuel-refinery','chemfuel-generator'];
const chem=(p:unknown)=>obj(p)&&(p.item==='chemfuel'||p.kind==='chemfuel');
/** Remove the remainder before division to keep the reserve bound exact. */
const maximumChemfuelBurned=(tick:number)=>Math.floor(tick/20)*9+Math.floor((tick%20)*9/20);

const maximumTorchBurned=(tick:number)=>Math.floor(tick/5)*19+Math.floor((tick%5)*19/5);

/** The former fuel bounds are retained literally. Only the new generator has
 * a strict four-field contract and its own saved twentieths of a reserve unit. */
export function validBuildingFuelShape(value:unknown,kind:unknown,version:number,tick:number):boolean {
  if(!obj(value)||version<10||!int(value.ticks,0,fuelLimit(kind))||typeof value.autoRefuel!=='boolean')return false;
  if(kind==='fueled-smithy')return version>=267&&keys(value,['ticks','burned','autoRefuel'])
    &&int(tick)&&int(value.burned,0,tick*8);
  if(kind==='torch-lamp')return version>=249&&keys(value,['ticks','burned','autoRefuel','burnRemainder'])
    &&int(tick)&&int(value.burned,0,maximumTorchBurned(tick))&&int(value.burnRemainder,0,4)
    &&(value.burned<maximumTorchBurned(tick)||value.burnRemainder<=((tick%5)*19)%5)
    &&(value.ticks!==0||value.burnRemainder===0);
  if(kind==='chemfuel-generator')return version>=218&&keys(value,['ticks','burned','autoRefuel','burnRemainder'])
    &&int(tick)&&int(value.burned,0,maximumChemfuelBurned(tick))&&int(value.burnRemainder,0,19)
    &&(value.ticks!==0||value.burnRemainder===0);
  return int(value.burned,0,tick*(kind==='wood-generator'?3:kind==='fueled-stove'?16:1))
    &&(kind==='wood-generator'?int(value.burnRemainder,0,4):value.burnRemainder===undefined);
}
function validChemfuelPile(p:MaterialPile,w:World,version:number,tick:number):boolean {
  return obj(p)&&keys(p as unknown as Record<string,unknown>,['id','kind','item','quantity','owner'],['damage','haulRequested'])
    &&p.kind==='chemfuel'&&p.item==='chemfuel'&&int(p.quantity,1,150)&&int(p.id,1,w.nextId-1)
    &&(!Object.hasOwn(p,'damage')||int(p.damage,1,49))&&(!Object.hasOwn(p,'haulRequested')||p.haulRequested===true&&p.owner.type==='ground')
    &&validatePileRecordShape(p as unknown as Record<string,unknown>,w,version,tick).length===0;
}

/** Original owners and clocks are shared by file loading and SnapshotDecoder.
 * No research, fuel, stock, item identity or task is synthesized by this guard. */
export function validBiofuelTransport(w:World,version:number,powerTopology?:PowerParentReader,indexStaging=false,geometry?:StagingGeometryReader):boolean {
  try {
    const owners=captureHumanOwners(w),foreign=owners.slots.filter(s=>s.kind!=='map');
    const packs=[...(w.packed??[]),...foreign.flatMap(s=>s.packed)];
    const content=[...w.structures,...w.jobs,...packs.map(p=>p.building),...w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.flick,j.fixBreakdown].filter(Boolean))];
    const futureMachines=content.some(s=>s&&kinds.includes(s.kind));
    const futureTasks=owners.slots.some(s=>s.pawn&&(isBiofuelRecipe(s.pawn.cooking?.recipe)
      ||s.pawn.orders?.queue?.some(o=>obj(o)&&obj(o.cooking)&&isBiofuelRecipe(o.cooking.recipe))));
    const records=[w.spoiled,w.destroyed?.items,w.fires?.ledger?.items,w.trade?.bought,w.trade?.sold];
    if(version<218)return !futureMachines&&!futureTasks&&!Object.hasOwn(w.research??{},'biofuelRefining')&&w.research?.project!=='biofuel-refining'
      &&![...w.piles,...foreign.flatMap(s=>s.items),...(w.civilianPost?.stock??[])].some(chem)
      &&!w.stockpiles.some(z=>Object.hasOwn(z.filters??{},'chemfuel')||Object.hasOwn(z.items??{},'chemfuel'))
      &&!records.some(v=>v&&Object.hasOwn(v,'chemfuel'))
      &&!w.trade?.recent.some(r=>r.lines.some(l=>'item' in l&&l.item==='chemfuel'));
    // Neither machine is minifiable. A material can survive in genuine human
    // possessions, but an off-map owner cannot keep a local refinery intention.
    if(packs.some(p=>kinds.includes(p.building.kind))||foreign.some(s=>s.pawn&&(isBiofuelRecipe(s.pawn.cooking?.recipe)
      ||s.pawn.orders?.queue?.some(o=>obj(o)&&obj(o.cooking)&&isBiofuelRecipe(o.cooking.recipe)))))return false;
    const research:unknown=w.research?.biofuelRefining;
    if(Object.hasOwn(w.research??{},'biofuelRefining')&&(!obj(research)||!keys(research,['points'],['completedAt'])||!int(research.points,0,BIOFUEL_RESEARCH_COST)
      ||(Object.hasOwn(research,'completedAt')?!int(research.completedAt,0,w.tick)||research.points!==BIOFUEL_RESEARCH_COST||w.research?.project==='biofuel-refining':research.points===BIOFUEL_RESEARCH_COST)))return false;
    if(w.research?.project==='biofuel-refining'&&!research||content.some(s=>s?.kind==='biofuel-refinery')&&!biofuelRefiningUnlocked(w))return false;
    for(const kind of kinds)if(validatePower(w,version,kind as Structure['kind'],powerTopology).length)return false;
    for(const s of [...w.structures,...w.jobs])if(kinds.includes(s.kind)){
      if(s.material!=='steel'||s.footprint!=='standard'||!int(s.orientation,0,s.kind==='chemfuel-generator'?0:3)
        ||footprintCells(s).some(c=>!int(c.x,0,w.width-1)||!int(c.z,0,w.height-1)))return false;
      if(w.structures.includes(s as Structure)){
        const structure=s as Structure;
        if(structure.kind==='chemfuel-generator'?!validBuildingFuelShape(structure.fuel,structure.kind,version,w.tick)||!structure.fuel!.ticks&&structure.power?.on:structure.fuel!==undefined)return false;
      }else if(Object.hasOwn(s,'fuel')||Object.hasOwn(s,'power'))return false;
    }
    for(const p of w.piles)if(chem(p)&&!validChemfuelPile(p,w,version,w.tick))return false;
    for(const slot of foreign)for(const p of slot.items)if(chem(p)&&!validChemfuelPile(p,w,version,slot.validationTick))return false;
    // Local production has no negotiated acquisition/sale before schema 338,
    // where only the orbital bulk goods trader (Core Chemfuel 200~600) trades
    // it: a receipt naming a person on the map as its trader stays refused.
    if(w.civilianPost?.stock.some(chem)||w.spoiled&&Object.hasOwn(w.spoiled,'chemfuel')
      ||version<338&&[w.trade?.bought,w.trade?.sold].some(v=>v&&Object.hasOwn(v,'chemfuel'))
      ||w.trade?.recent.some(r=>r.lines.some(l=>'item' in l&&l.item==='chemfuel')&&(version<338||w.pawns.some(p=>p.id===r.traderId))))return false;
    for(const z of w.stockpiles)if(Object.hasOwn(z.filters??{},'chemfuel')&&typeof z.filters.chemfuel!=='boolean'
      ||Object.hasOwn(z.items??{},'chemfuel')&&typeof z.items!.chemfuel!=='boolean')return false;
    const reservations=new Map<number,number>();
    for(const slot of owners.slots){
      const pawn=slot.pawn;if(!pawn)continue;
      for(const task of [pawn.haul,...pawn.orders.queue.filter(o=>obj(o)&&obj(o.destination)).map(o=>o as HaulTask)]){
        if(!task||task.destination?.type!=='fuel')continue;
        const targetId=task.destination.structureId,target=w.structures.find(s=>s.id===targetId);
        const pile=slot.kind==='map'?w.piles.find(p=>p.id===(task.phase==='pickup'?task.sourcePileId:task.carryPileId)):slot.items.find(p=>p.id===task.carryPileId);
        if(target?.kind!=='chemfuel-generator'&&!chem(pile))continue;
        const queued=pawn.haul!==task;
        if(slot.kind!=='map'||target?.kind!=='chemfuel-generator'||!pile||pile.item!==fuelItem(target.kind)||task.whole!==undefined
          ||!obj(task)||!keys(task as unknown as Record<string,unknown>,['sourcePileId','quantity','phase','destination','carryPileId'],queued?[]:['pickupCell','serviceProgress'])
          ||!obj(task.destination)||!keys(task.destination as unknown as Record<string,unknown>,['type','structureId'],['forced'])
          ||!int(task.sourcePileId,1,w.nextId-1)||!int(task.quantity,1,carryQuantityBound379(w,pile.item))||!['pickup','deliver'].includes(task.phase)
          ||Object.hasOwn(task.destination,'forced')&&task.destination.forced!==true||queued&&(task.phase!=='pickup'||task.destination.forced!==true)
          ||!queued&&(task.destination.forced===true?pawn.orders.active!=='haul':pawn.orders.active!==null)
          ||task.pickupCell!==undefined&&(!obj(task.pickupCell)||!keys(task.pickupCell as unknown as Record<string,unknown>,['x','z'])||!int(task.pickupCell.x,0,w.width-1)||!int(task.pickupCell.z,0,w.height-1))
          ||task.serviceProgress!==undefined&&(task.phase!=='deliver'||!int(task.serviceProgress,1,REFUEL_WORK_TICKS-1)))return false;
        if(task.phase==='pickup'?(task.carryPileId!==null||pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity)
          :(!int(task.carryPileId,1,w.nextId-1)||pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||pile.quantity!==task.quantity))return false;
        if(task.serviceProgress!==undefined&&(pawn.state!=='working'||pawn.path.length||!footprintCells(target).some(c=>Math.abs(c.x-pawn.x)+Math.abs(c.z-pawn.z)<=1)))return false;
        const sum=(reservations.get(target.id)??0)+task.quantity;
        if(!target.fuel||sum>Math.floor((fuelLimit(target.kind)-target.fuel.ticks)/FUEL_UNIT_TICKS))return false;
        reservations.set(target.id,sum);
      }
    }
    return validBiofuelProductionTransport(w,version,powerTopology!==undefined,indexStaging,geometry);
  }catch{return false;}
}
