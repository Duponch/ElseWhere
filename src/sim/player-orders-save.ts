import {isSchema269OrLater} from './schema-compatibility-257.ts';
import {validCraftingFuelDestination269} from './fuel-purpose-save-269.ts';
import { validForcedConsumePawnShape } from './consume-save.ts';
import { MAX_QUEUED_ORDERS } from './player-orders.ts';
import type { World } from './types.ts';
import { CARRY_CAPACITY } from './definitions.ts';
import {carryQuantityBound379} from './carry-quantity-379.ts';
import {validConstructionBatchShape379} from './construction-batch-379.ts';
import { queuedHaulReason } from './player-hauling.ts';
import { isCookingOrder } from './order-types.ts';
import { validCookingOrder } from './player-cooking-save.ts';
import { queuedCookingReason } from './player-cooking.ts';

export function initializePlayerOrders(world:World):void {
  (world as {schemaVersion:number}).schemaVersion=17;
  for(const pawn of world.pawns)pawn.orders={active:null,queue:[]};
}
export function validatePlayerOrders(world:World,version:number,shapesOnly=false):string[] {
  const errors:string[]=[],reserved=new Set<number>();
  const jobs=new Map(world.jobs.map(j=>[j.id,j]));
  for(const pawn of world.pawns) {
    const orders=pawn.orders;
    if(version<17){if(orders!==undefined)errors.push('Legacy save contains player orders.');continue;}
    if(!orders||typeof orders!=='object'||Array.isArray(orders)||!(orders.active===null||typeof orders.active==='number'&&Number.isSafeInteger(orders.active)&&orders.active>0||version>=89&&orders.active==='bury'||version>=52&&orders.active==='equipment'||version>=18&&orders.active==='haul'||version>=20&&orders.active==='cook'||version>=48&&orders.active==='feed'||version>=47&&orders.active==='tend'||version>=46&&orders.active==='rescue'||version>=234&&orders.active==='consume')
      ||!Array.isArray(orders.queue)||orders.queue.length>MAX_QUEUED_ORDERS||orders.queue.some(id=>typeof id==='number'?!Number.isSafeInteger(id)||id<1:version<18||!(version>=20&&validCookingOrder(id,world)||validQueuedHaul(id,version,world)))) {
      errors.push('Invalid player order state.');continue;
    }
    if(orders.active==='consume'?!validForcedConsumePawnShape(pawn,version,world):orders.active==='bury'?!pawn.burial:orders.active==='equipment'?!pawn.equipmentTask:orders.active==='haul'?!pawn.haul||!['job','stockpile',...(version>=19?['fuel','aside']:[]),...(version>=193?['turret']:[]),...(version>=217?['hopper']:[])].includes(pawn.haul.destination.type):orders.active==='cook'?!pawn.cooking:orders.active==='feed'?!pawn.feed:orders.active==='tend'?!pawn.tend:orders.active==='rescue'?!pawn.rescue:orders.active!==null&&orders.active!==pawn.jobId)errors.push('Active order has no matching job.');
    if(pawn.haul?.destination.type==='turret'&&(version<193||pawn.haul.destination.forced!==undefined&&(pawn.haul.destination.forced!==true||orders.active!=='haul')||orders.active==='haul'&&!pawn.haul.destination.forced))errors.push('Invalid forced turret service intent.');
    if(pawn.haul?.destination.type==='fuel'&&pawn.haul.destination.forced!==undefined&&(version<19||pawn.haul.destination.forced!==true||orders.active!=='haul'||version<20&&pawn.haul.destination.forCooking))errors.push('Invalid forced refuel purpose.');
    if(version>=19&&orders.active==='haul'&&pawn.haul?.destination.type==='fuel'&&!pawn.haul.destination.forced)errors.push('Forced refuel has no persistent intent.');
    if(version>=19&&orders.active==='haul'&&pawn.haul?.destination.type==='aside'&&pawn.haul.destination.constructionId===undefined&&!(version>=20&&pawn.haul.destination.growingZoneId!==undefined))errors.push('Forced clearing has no parent intent.');
    for(const id of orders.queue) {
      if(typeof id!=='number')continue;
      const job=jobs.get(id);
      if(reserved.has(id)||id===pawn.jobId)errors.push('Duplicate queued order reservation.');
      reserved.add(id);
      if(!job||job.reservedBy!==pawn.id||job.status!=='active')errors.push('Queued order reservation mismatch.');
      if(job?.clearance&&(job.clearance.progress!==0||job.clearance.workRemainder!==undefined))errors.push('Waiting clearing already has work progress.');
    }
  }
  // Only inspect cross-references after every queue has passed its shape check.
  if(!shapesOnly&&!errors.length&&version>=18)for(const pawn of world.pawns)for(const task of pawn.orders.queue)if(typeof task!=='number'&&(isCookingOrder(task)?queuedCookingReason(world,task):queuedHaulReason(world,task)))errors.push('Invalid queued work reservation.');
  return errors;
}
function validQueuedHaul(value:unknown,version:number,world:World):boolean {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const t=value as Record<string,unknown>,d=t.destination as Record<string,unknown>;
  if(Object.hasOwn(t,'constructionBatch379'))return validConstructionBatchShape379(t,version)&&t.phase==='pickup'&&t.carryPileId===null;
  const id=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0;
  if(Object.keys(t).some(k=>!['sourcePileId','quantity','phase','destination','carryPileId',...(version>=26?['whole']:[])].includes(k))||!id(t.sourcePileId)||!id(t.quantity)||(t.quantity as number)>(t.whole===true?1:carryQuantityBound379({schemaVersion:version},world.piles.find(p=>p.id===t.sourcePileId)?.item))||t.phase!=='pickup'||t.carryPileId!==null||!d||typeof d!=='object'||Array.isArray(d))return false;
  if(!validCraftingFuelDestination269(d,version)||Object.hasOwn(d,'forCrafting')&&!world.structures.some(s=>s.id===d.structureId&&s.kind==='fueled-smithy'))return false;
  if(t.whole!==undefined&&(version<26||t.whole!==true||t.quantity!==1||!['stockpile','aside'].includes(String(d.type))))return false;
  if(version>=217&&d.type==='hopper')return id(d.structureId)&&Object.keys(d).every(k=>['type','structureId'].includes(k));
  if(version>=193&&d.type==='turret')return id(d.structureId)&&d.forced===true&&Object.keys(d).every(k=>['type','structureId','forced'].includes(k));
  if(version>=19&&d.type==='fuel')return id(d.structureId)&&d.forced===true&&(d.forCooking===undefined||version>=20&&d.forCooking===true&&world.structures.some(s=>s.id===d.structureId&&(s.kind==='campfire'||version>=84&&s.kind==='fueled-stove'||version>=267&&s.kind==='fueled-smithy')))&&Object.keys(d).every(k=>['type','structureId','forced',...(version>=20?['forCooking']:[]),...(isSchema269OrLater(version)?['forCrafting']:[])].includes(k));
  if(version>=20&&d.type==='aside'&&d.growingZoneId!==undefined)return validSowingDestination(d,world)&&Object.keys(d).every(k=>['type','growingZoneId','sowCell','x','z'].includes(k));
  if(version>=19&&d.type==='aside')return id(d.constructionId)&&Number.isInteger(d.x)&&Number(d.x)>=0&&Number(d.x)<world.width&&Number.isInteger(d.z)&&Number(d.z)>=0&&Number(d.z)<world.height&&(d.forConstruction===undefined||typeof d.forConstruction==='boolean')&&Object.keys(d).every(k=>['type','constructionId','forConstruction','x','z'].includes(k));
  return d.type==='stockpile'?id(d.stockpileId)&&Object.keys(d).every(k=>['type','stockpileId'].includes(k))
    :d.type==='job'&&id(d.jobId)&&(d.forConstruction===undefined||typeof d.forConstruction==='boolean')&&Object.keys(d).every(k=>['type','jobId','forConstruction'].includes(k));
}
export function validSowingDestination(d:Record<string,unknown>,world:World):boolean {
  const cell=(c:unknown)=>!!c&&typeof c==='object'&&Number.isInteger((c as {x:unknown}).x)&&Number((c as {x:unknown}).x)>=0&&Number((c as {x:unknown}).x)<world.width&&Number.isInteger((c as {z:unknown}).z)&&Number((c as {z:unknown}).z)>=0&&Number((c as {z:unknown}).z)<world.height;
  return d.type==='aside'&&Number.isSafeInteger(d.growingZoneId)&&Number(d.growingZoneId)>0&&cell(d)&&cell(d.sowCell)&&d.constructionId===undefined&&d.forConstruction===undefined;
}
