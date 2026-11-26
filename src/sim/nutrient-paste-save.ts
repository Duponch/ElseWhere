import {memoryExpiry271,validSuspendedMemory271} from './suspended-memory-271.ts';
import {carryQuantityBound379,carryShapeBound379} from './carry-quantity-379.ts';
import type { PowerParentReader } from './power-parent-validation.ts';
import { captureHumanOwners } from './human-owners.ts';
import { hopperAccepts,hopperCapacity,pasteHoppers,pasteSpot,type PasteRequest } from './nutrient-paste.ts';
import { reservedSource } from './materials.ts';
import { validatePileRecordShape } from './material-record-save.ts';
import { validatePreservation } from './food-preservation-save.ts';
import { nutrientPasteUnlocked,NUTRIENT_PASTE_RESEARCH_COST } from './research.ts';
import { validatePower } from './power-save.ts';
import { validDiningPlace } from './dining.ts';
import { feedingPlaceValid,feedingReason,feedingWork } from './feeding-rules.ts';
import { canStandAt } from './furniture-travel.ts';
import { reservedServiceCells } from './service-reservations.ts';
import type { World } from './types.ts';

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
export function validPasteRequestShape(v:unknown,w:World):boolean {
  if(!obj(v)||!keys(v,['dispenserId','spot'],['ingredients','producedAt'])||!int(v.dispenserId,1,w.nextId-1)||!obj(v.spot)||!keys(v.spot,['x','z'])||!int(v.spot.x,0,w.width-1)||!int(v.spot.z,0,w.height-1))return false;
  if(Object.hasOwn(v,'producedAt'))return !Object.hasOwn(v,'ingredients')&&int(v.producedAt,0,w.tick);
  return Array.isArray(v.ingredients)&&v.ingredients.length>0&&v.ingredients.length<=6
    &&v.ingredients.every(i=>obj(i)&&keys(i,['pileId','quantity'])&&int(i.pileId,1,w.nextId-1)&&int(i.quantity,1,6))
    &&new Set(v.ingredients.map(i=>i.pileId)).size===v.ingredients.length&&v.ingredients.reduce((n,i)=>n+i.quantity,0)===6;
}
/** Shared original-owner boundary for files and Decoder; no normalization or production. */
export function validNutrientPasteTransport(w:World,version:number,powerTopology?:PowerParentReader):boolean {
  try {
    const humans=captureHumanOwners(w),foreign=humans.slots.filter(s=>s.kind!=='map'),packs=[...(w.packed??[]),...foreign.flatMap(s=>s.packed)];
    const content=[...w.structures,...w.jobs,...packs.map(p=>p.building),...w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.flick,j.fixBreakdown].filter(Boolean))];
    const isPaste=(v:unknown)=>obj(v)&&(v.phase==='collect'||Object.hasOwn(v,'paste'));
    if(foreign.some(s=>s.pawn&&(isPaste(s.pawn.need)||isPaste(s.pawn.feed)||s.pawn.haul?.destination?.type==='hopper')))return false;
    const newKinds=['nutrient-paste-dispenser','hopper'],research:unknown=w.research?.nutrientPaste;
    if(version<217){
      if(content.some(s=>s&&newKinds.includes(s.kind))||Object.hasOwn(w.research??{},'nutrientPaste')||w.research?.project==='nutrient-paste'
        ||humans.slots.some(s=>s.pawn&&(isPaste(s.pawn.need)||isPaste(s.pawn.feed)||s.pawn.haul?.destination?.type==='hopper'||s.pawn.orders?.queue?.some(o=>obj(o)&&obj(o.destination)&&o.destination.type==='hopper')||s.pawn.memories?.some(m=>m?.kind==='ate-nutrient-paste')))
        ||[...w.piles,...foreign.flatMap(s=>s.items)].some(p=>p.item==='nutrient-paste-meal')||w.foodPolicies?.some(p=>p.allowed?.includes('nutrient-paste-meal'))
        ||[w.spoiled,w.destroyed?.items,w.fires?.ledger?.items,w.trade?.bought,w.trade?.sold].some(v=>v&&Object.hasOwn(v,'nutrient-paste-meal'))
        ||w.trade?.recent.some(r=>r.lines.some(l=>'item' in l&&l.item==='nutrient-paste-meal'))||w.stockpiles.some(z=>Object.hasOwn(z.items??{},'nutrient-paste-meal')))return false;
      return true;
    }
    if(Object.hasOwn(w.research??{},'nutrientPaste')&&(!obj(research)||!keys(research,['points'],['completedAt'])||!int(research.points,0,NUTRIENT_PASTE_RESEARCH_COST)
      ||(Object.hasOwn(research,'completedAt')? !int(research.completedAt,0,w.tick)||research.points!==NUTRIENT_PASTE_RESEARCH_COST||w.research?.project==='nutrient-paste':research.points===NUTRIENT_PASTE_RESEARCH_COST)))return false;
    if(w.research?.project==='nutrient-paste'&&!research||content.some(s=>s&&newKinds.includes(s.kind))&&!nutrientPasteUnlocked(w)||packs.some(p=>newKinds.includes(p.building.kind)))return false;
    if(validatePower(w,version,'nutrient-paste-dispenser',powerTopology).length)return false;
    for(const s of [...w.structures,...w.jobs])if(newKinds.includes(s.kind)){
      if(s.material!=='steel'||s.footprint!=='standard'||!int(s.orientation,0,3))return false;
      if(s.kind==='hopper'&&'power' in s&&s.power!==undefined)return false;
    }
    for(const pile of w.piles)if(pile.item==='nutrient-paste-meal'&&(validatePileRecordShape(pile as unknown as Record<string,unknown>,w,version).length||validatePreservation({...w,piles:[pile]},version).length))return false;
    for(const slot of humans.slots){
      const p=slot.pawn;
      if(p?.memories){const seen=new Set<string>();for(const m of p.memories){if(m?.kind!=='ate-nutrient-paste')continue;if(!obj(m)||!keys(m,['kind','expiresAt'],['suspendedTicks'])||!validSuspendedMemory271(m,version,slot.validationTick,Number(m.expiresAt)-6000)||!int(memoryExpiry271(m,Number(m.expiresAt)),slot.validationTick+1,slot.validationTick+6000)||seen.has(m.kind))return false;seen.add(m.kind);}}
      for(const pile of slot.items)if(pile.item==='nutrient-paste-meal'&&(validatePileRecordShape(pile as unknown as Record<string,unknown>,w,version,slot.validationTick).length||validatePreservation({...w,tick:slot.validationTick,piles:[pile]},version).length))return false;
    }
    const spots=new Set<number>();
    for(const pawn of w.pawns){
      if(isPaste(pawn.need)&&pawn.need?.kind!=='eat')return false;
      for(const task of [pawn.need?.kind==='eat'?pawn.need:undefined,pawn.feed]){
        if(!task)continue;
        if(!obj(task))return false;
        const has=Object.hasOwn(task,'paste');
        if(!has){if(task.sourcePileId===null||task.phase==='collect')return false;continue;}
        if(!validPasteRequestShape(task.paste,w)||task.sourcePileId!==null||task.quantity!==1)return false;
        const eating='kind' in task;
        if(!keys(task as unknown as Record<string,unknown>,eating?['kind','phase','sourcePileId','carryPileId','quantity','progress','dining','paste']:['patientId','spot','sourcePileId','carryPileId','quantity','phase','progress','paste'],eating?['workRemainder']:[])
          ||!['pickup','collect',...(eating?['choose-spot','travel','ingest']:['deliver','feed'])].includes(task.phase)
          ||!int(task.progress,0,eating?49:74)||!['ingest','feed'].includes(task.phase)&&task.progress!==0)return false;
        if(!eating){const t=pawn.feed!,patient=w.pawns.find(p=>p.id===t.patientId);if(!patient||feedingReason(w,pawn,patient,true)||!feedingPlaceValid(w,t,patient)||pawn.priorities[feedingWork(patient)]===0&&pawn.orders.active!=='feed')return false;}
        const req=task.paste! as PasteRequest,before=!Object.hasOwn(req,'producedAt');
        if(pawn.jobId!==null||pawn.haul||pawn.cooking||pawn.ward||pawn.tend||pawn.rescue||pawn.research||pawn.deepWork||pawn.orbitalTrade||pawn.surgery||pawn.animalHandling||pawn.animalCare||pawn.animalFeed||pawn.equipmentTask||pawn.recreation?.task||pawn.draft||pawn.shooting||pawn.melee||pawn.trade||pawn.burial||pawn.cleaning||pawn.firefighting||pawn.burning||pawn.flee||pawn.tactics||pawn.heatRefuge||pawn.interruptedCargo||pawn.need&&pawn.feed)return false;
        if(before){
          if(task.phase!=='pickup'||task.carryPileId!==null||task.progress!==0||pawn.state!=='moving')return false;
          const dispenser=w.structures.find(s=>s.id===req.dispenserId&&s.kind==='nutrient-paste-dispenser');if(!dispenser)return false;
          const spot=pasteSpot(dispenser),hoppers=pasteHoppers(w,dispenser);
          if(spot.x!==req.spot.x||spot.z!==req.spot.z||!canStandAt(w,spot))return false;
          for(const i of req.ingredients!){const p=w.piles.find(p=>p.id===i.pileId);if(!p||p.owner.type!=='ground'||!hopperAccepts(p.item)||!hoppers.some(h=>p.owner.type==='ground'&&h.x===p.owner.x&&h.z===p.owner.z)||reservedSource(w,p.id)>p.quantity)return false;}
        }else{
          if(task.phase==='pickup')return false;
          if([...w.pawns,...w.piles,...w.resources,...w.jobs].some(o=>o.id===req.dispenserId)||w.structures.some(s=>s.id===req.dispenserId&&s.kind!=='nutrient-paste-dispenser'))return false;
          if(task.phase!=='collect'&&w.tick-req.producedAt!<5)return false;
          const p=w.piles.find(p=>p.id===task.carryPileId);if(!p||p.item!=='nutrient-paste-meal'||p.kind!=='food'||p.quantity!==1||p.owner.type!=='pawn'||p.owner.pawnId!==pawn.id)return false;
          if(task.phase==='collect'&&(task.progress!==0||pawn.state!=='moving'||pawn.path.length||pawn.moveCooldown>0||(pawn.motion?.end??0)>w.tick||pawn.x!==req.spot.x||pawn.z!==req.spot.z))return false;
        }
        if('kind' in task&&(task.phase==='pickup'||task.phase==='collect')&&task.dining!==null)return false;
        if(eating&&task.phase==='choose-spot'&&(task.dining!==null||pawn.state!=='moving'))return false;
        if(eating&&(task.phase==='travel'||task.phase==='ingest')){
          const place=pawn.need?.kind==='eat'?pawn.need.dining:null;if(!place||!validDiningPlace(w,place))return false;
          if(task.phase==='ingest'?(pawn.state!=='eating'||pawn.path.length||pawn.x!==place.target.x||pawn.z!==place.target.z):pawn.state!=='moving')return false;
        }
        if(!eating){const t=pawn.feed!;if((t.phase==='pickup'||t.phase==='collect')&&reservedServiceCells(w,pawn.id).has(t.spot.z*w.width+t.spot.x))return false;if((t.phase==='deliver'||t.phase==='feed')&&(t.phase==='feed'?(pawn.state!=='working'||pawn.path.length||pawn.moveCooldown>0||pawn.x!==t.spot.x||pawn.z!==t.spot.z):pawn.state!=='moving'))return false;}
        if(task.phase==='pickup'||task.phase==='collect'){const index=req.spot.z*w.width+req.spot.x;if(spots.has(index)||reservedServiceCells(w,pawn.id).has(index))return false;spots.add(index);}
      }
      const h=pawn.haul;
      if(h?.destination.type==='hopper'){
        if(!keys(h.destination as unknown as Record<string,unknown>,['type','structureId'])||h.whole||h.serviceProgress!==undefined||!int(h.destination.structureId,1,w.nextId-1))return false;
        const id=h.destination.structureId,pile=w.piles.find(p=>p.id===(h.phase==='pickup'?h.sourcePileId:h.carryPileId)),target=w.structures.find(s=>s.id===id&&s.kind==='hopper');
        if(!int(h.quantity,1,carryQuantityBound379(w,pile?.item))||!['pickup','deliver'].includes(h.phase)||!int(h.sourcePileId,1,w.nextId-1)||!pile||!target||!hopperAccepts(pile.item)||hopperCapacity(w,target.id,pile.item,pawn.id)<h.quantity||pile.owner.type==='ground'&&pile.owner.x===target.x&&pile.owner.z===target.z)return false;
        if(h.phase==='pickup'?(h.carryPileId!==null||pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity):(pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||pile.quantity!==h.quantity))return false;
      }
      for(const queued of pawn.orders.queue)if(obj(queued)&&obj(queued.destination)&&queued.destination.type==='hopper'){
        const destination=queued.destination;
        if(!keys(destination,['type','structureId'])||!int(destination.structureId,1,w.nextId-1)||queued.phase!=='pickup'||queued.carryPileId!==null||!int(queued.sourcePileId,1,w.nextId-1)||!int(queued.quantity,1,carryShapeBound379(w.schemaVersion))||Object.hasOwn(queued,'whole')||Object.hasOwn(queued,'serviceProgress'))return false;
        const target=w.structures.find(s=>s.id===destination.structureId&&s.kind==='hopper'),pile=w.piles.find(p=>p.id===queued.sourcePileId);
        if(!target||!pile||pile.owner.type!=='ground'||!hopperAccepts(pile.item)||pile.owner.x===target.x&&pile.owner.z===target.z)return false;
      }
    }
    return true;
  }catch{return false;}
}
