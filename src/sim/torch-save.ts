import {captureHumanOwners} from './human-owners.ts';
import {carryQuantityBound379} from './carry-quantity-379.ts';
import {validBuildingFuelShape} from './biofuel-save.ts';
import {reservedSource} from './materials.ts';
import {fuelLimit,FUEL_UNIT_TICKS,REFUEL_WORK_TICKS} from './fuel.ts';
import type {HaulTask,World} from './types.ts';

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const DOMAINS=['structures','jobs','packed','pawns','piles','visitors','prisonDepartures','podRescues','group','groupLosses','scout','commercialTrip','civilianPost','arrivals','startingArrival','raids','quests','destroyed','deconstructed'] as const;
function noTorch(value:unknown):boolean {
  if(Array.isArray(value))return value.every(noTorch);
  if(!obj(value))return true;
  for(const key of Object.keys(value)){
    if(key==='torch-lamp')return false;
    if(['tiles','resources','planet'].includes(key))continue;
    const child=value[key];
    if(['kind','buildingKind','structureKind','targetKind','item'].includes(key)&&child==='torch-lamp')return false;
    if(!noTorch(child))return false;
  }
  return true;
}
function domains(raw:Record<string,unknown>):boolean{return DOMAINS.every(key=>noTorch(raw[key]));}
/** Historical files/packets cannot smuggle a new building through an archive
 * or sparse upsert. No terrain, resource or planet traversal is performed. */
export function validTorchHistoricalTransport(value:unknown,version:number):boolean {
  try{
    if(version>=249||!obj(value))return true;
    const w=obj(value.world)?value.world:value;
    if(!domains(w)||obj(w.secondarySite)&&obj(w.secondarySite.map)&&!domains(w.secondarySite.map))return false;
    return w===value||noTorch(value.structures)&&noTorch(value.piles);
  }catch{return false;}
}

/** Current-map original owners only; shared by files and reconstructed Decoder
 * worlds, without a second full schema or grid validation. */
export function validTorchTransport(w:World,version:number):boolean {
  try{
    if(version<249)return validTorchHistoricalTransport(w,version);
    const torches=new Map(w.structures.filter(s=>s.kind==='torch-lamp').map(s=>[s.id,s]));
    for(const s of torches.values())if(s.material!=='wood'||s.orientation!==0||s.footprint!=='standard'
      ||Object.keys(s).some(k=>!['id','kind','x','z','orientation','footprint','material','damage','fuel'].includes(k))
      ||!validBuildingFuelShape(s.fuel,s.kind,version,w.tick))return false;
    for(const j of w.jobs){
      if(j.kind==='torch-lamp'&&(j.material!=='wood'||j.orientation!==0||j.footprint!=='standard'||Object.hasOwn(j,'fuel')||Object.hasOwn(j,'power')))return false;
      if(j.furniture?.kind==='torch-lamp'||j.flick?.kind==='torch-lamp')return false;
    }
    const owners=captureHumanOwners(w),foreign=owners.slots.filter(slot=>slot.kind!=='map');
    if([...(w.packed??[]),...foreign.flatMap(slot=>slot.packed)].some(p=>p.building.kind==='torch-lamp'))return false;
    const reservations=new Map<number,number>();
    for(const slot of owners.slots){
      const pawn=slot.pawn;if(!pawn)continue;
      for(const task of [pawn.haul,...pawn.orders.queue.filter(o=>obj(o)&&obj(o.destination)).map(o=>o as HaulTask)]){
        if(!task||task.destination?.type!=='fuel')continue;
        const target=torches.get(task.destination.structureId);if(!target)continue;
        const queued=pawn.haul!==task;
        const pile=slot.kind==='map'?w.piles.find(p=>p.id===(task.phase==='pickup'?task.sourcePileId:task.carryPileId)):undefined;
        if(slot.kind!=='map'||!pile||pile.item!=='wood'||!obj(task)
          ||!keys(task as unknown as Record<string,unknown>,['sourcePileId','quantity','phase','destination','carryPileId'],queued?[]:['pickupCell','serviceProgress'])
          ||!obj(task.destination)||!keys(task.destination as unknown as Record<string,unknown>,['type','structureId'],['forced'])
          ||!int(task.sourcePileId,1,w.nextId-1)||!int(task.quantity,1,carryQuantityBound379({schemaVersion:version},pile.item))||!['pickup','deliver'].includes(task.phase)
          ||Object.hasOwn(task.destination,'forced')&&task.destination.forced!==true||queued&&(task.phase!=='pickup'||task.destination.forced!==true)
          ||!queued&&(task.destination.forced===true?pawn.orders.active!=='haul':pawn.orders.active!==null)
          ||task.pickupCell!==undefined&&(!obj(task.pickupCell)||!keys(task.pickupCell as unknown as Record<string,unknown>,['x','z'])||!int(task.pickupCell.x,0,w.width-1)||!int(task.pickupCell.z,0,w.height-1))
          ||task.serviceProgress!==undefined&&(task.phase!=='deliver'||!int(task.serviceProgress,1,REFUEL_WORK_TICKS-1)))return false;
        if(task.phase==='pickup'?(task.carryPileId!==null||pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity)
          :(!int(task.carryPileId,1,w.nextId-1)||pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||pile.quantity!==task.quantity))return false;
        if(task.serviceProgress!==undefined&&(pawn.state!=='working'||pawn.path.length||Math.abs(target.x-pawn.x)+Math.abs(target.z-pawn.z)>1))return false;
        const sum=(reservations.get(target.id)??0)+task.quantity;
        if(!target.fuel||sum>Math.floor((fuelLimit(target.kind)-target.fuel.ticks)/FUEL_UNIT_TICKS))return false;
        reservations.set(target.id,sum);
      }
    }
    return true;
  }catch{return false;}
}
