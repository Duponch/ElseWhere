import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {pileById,splicePileEntries} from './pile-identity-directory.ts';
import {isColonist} from './affiliation.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {canMergeEggPile256,eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import {carryStackLimit379,carryQuantityBound379} from './carry-quantity-379.ts';
import {candidateAccess} from './candidate-access.ts';
import {mergeRot,rotAge} from './food-preservation.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {refreshStock,reservedSource,createSourceReservationRead379} from './materials.ts';
import {adjacent,blockedCells,routeToJob} from './pathfinding.ts';
import {mergePileContamination,mergePileEgg256} from './pile-condition.ts';
import {pileMaxHp,mergeThingDamage} from './thing-damage-rules.ts';
import {destinationCapacity,destinationCell} from './work-planner.ts';
import {haulingWork,workPriority} from './work-types.ts';
import {releaseWork} from './work-release.ts';
import type {Cell,HaulTask,MaterialPile,Pawn,World} from './types.ts';
import type {StorageGeometry} from './ground-placement.ts';

export interface HaulOpportunity379 {quantity:number}
const own=(v:object,k:string)=>Object.getOwnPropertyDescriptor(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min=1,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&own(v,k)?.enumerable&&Object.hasOwn(own(v,k)!,'value'));
export function validHaulOpportunityShape379(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object')return false;
 const marker=own(raw,'haulOpportunity379');if(!marker)return !('haulOpportunity379' in raw);
 if(version<379||!plain(raw)||!data(raw,['sourcePileId','quantity','phase','destination','carryPileId','haulOpportunity379'],['pickupCell'])||!marker.enumerable||!Object.hasOwn(marker,'value'))return false;
 const m=marker.value,d=raw.destination;
 if(Object.hasOwn(raw,'pickupCell')){const c=raw.pickupCell;if(!plain(c)||!data(c,['x','z'])||!int(c.x,0)||!int(c.z,0))return false;}
 return plain(m)&&data(m,['quantity'])&&int(m.quantity,1,500)&&int(raw.quantity,m.quantity+1,500)&&raw.phase==='pickup'&&int(raw.sourcePileId)&&int(raw.carryPileId)&&raw.sourcePileId!==raw.carryPileId
  &&plain(d)&&(d.type==='stockpile'?data(d,['type','stockpileId'],['forHunting'])&&int(d.stockpileId)&&(!Object.hasOwn(d,'forHunting')||d.forHunting===true):d.type==='fuel'&&data(d,['type','structureId'],['forced','forCooking','forCrafting'])&&int(d.structureId)&&['forced','forCooking','forCrafting'].every(k=>!Object.hasOwn(d,k)||d[k]===true));
}
const mergeable=(a:MaterialPile,b:MaterialPile)=>a.item===b.item&&a.kind===b.kind&&canMergeEggPile256(a,b);
function carryFor(w:World,p:Pawn,t:HaulTask):MaterialPile|undefined {return w.piles.find(i=>i.id===t.carryPileId&&i.owner.type==='pawn'&&i.owner.pawnId===p.id);}
export function validHaulOpportunity379(w:World,p:Pawn,t:HaulTask,version:number,storageGeometry?:StorageGeometry):boolean {
 if(!validHaulOpportunityShape379(t,version))return false;if(!t.haulOpportunity379)return true;
 const carry=carryFor(w,p,t),source=pileById(w,t.sourcePileId),target=destinationCell(w,t.destination);
 if(!isColonist(p)||p.prisoner||['dead','downed'].includes(p.state)||!carry||!source||source.owner.type!=='ground'||!target||!mergeable(carry,source)||!ITEM_DEFINITIONS[source.item]||ITEM_DEFINITIONS[source.item].stackLimit<=1)return false;
 if(w.piles.filter(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id).length!==1||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))return false;
 return materialAllowedForPlayer256(source)&&eggAllowedForPlayer256(source)&&allowedAreaAllows(w,p,source.owner)&&allowedAreaAllows(w,p,target)
  &&t.quantity===carry.quantity+t.haulOpportunity379.quantity&&t.quantity<=carryQuantityBound379(w,carry.item)
  &&source.quantity-reservedSource(w,source.id,p.id)>=t.haulOpportunity379.quantity
  &&destinationCapacity(w,t.destination,carry.kind,p.id,carry,storageGeometry)>=t.quantity
  &&(p.orders.active==='haul'||workPriority(p,haulingWork(t.destination))>0);
}
export function validateHaulOpportunities379(w:World,version:number,storageGeometry?:StorageGeometry):string[] {
 const errors:string[]=[];
 for(const p of w.pawns){
  if(p.haul&&!validHaulOpportunity379(w,p,p.haul,version,storageGeometry))errors.push('Invalid or future opportunistic hauling owner.');
  for(const q of p.orders.queue)if(typeof q==='object'&&q!==null&&'haulOpportunity379' in q)errors.push('Future queued job already owns opportunistic cargo.');
 }
 return errors;
}
function deliverHeld(w:World,p:Pawn,t:HaulTask):void {
 const carry=carryFor(w,p,t);delete t.haulOpportunity379;
 if(!carry){releaseWork(w,p);return;}
 t.phase='deliver';markPileContentWrite379(t).quantity=carry.quantity;p.path=[];p.planCooldown=0;p.state=(p.motion?.end??0)>w.tick||p.moveCooldown>0?'moving':'working';
}
/** Retire only the newly requested pickup; its existing real cargo survives. */
export function reconcileHaulOpportunities379(w:World):void {
 for(const p of w.pawns){const t=p.haul;if(t?.haulOpportunity379&&!validHaulOpportunity379(w,p,t,Number(w.schemaVersion)))deliverHeld(w,p,t);}
}
/** Core CheckForGetOpportunityDuplicate runs after the actual first pickup,
 * scans partial compatible stacks within8, and reserves only its next source. */
export function planNextHaulOpportunity379(w:World,p:Pawn):void {
 const t=p.haul;if(Number(w.schemaVersion)<379||!t||t.phase!=='deliver'||t.whole||t.constructionBatch379||t.destination.type!=='stockpile'&&t.destination.type!=='fuel')return;
 const carry=carryFor(w,p,t),target=destinationCell(w,t.destination);if(!carry||!target||ITEM_DEFINITIONS[carry.item].stackLimit<=1)return;
 const space=Math.min(carryStackLimit379(w,p,carry.item),destinationCapacity(w,t.destination,carry.kind,p.id,carry))-carry.quantity;if(space<=0)return;
 // No pickup/task mutation occurs until the chosen opportunity is installed.
 const reserved=createSourceReservationRead379(w,undefined,p.id);
 const candidates=w.piles.filter(i=>i.owner.type==='ground'&&i.id!==carry.id&&mergeable(carry,i)&&i.quantity<ITEM_DEFINITIONS[i.item].stackLimit&&materialAllowedForPlayer256(i)&&eggAllowedForPlayer256(i)&&allowedAreaAllows(w,p,i.owner)
  &&(i.owner.x-p.x)**2+(i.owner.z-p.z)**2<=64&&(i.owner.x!==target.x||i.owner.z!==target.z)&&i.quantity>reserved(i.id))
  .sort((a,b)=>{const x=a.owner as Cell,y=b.owner as Cell;return (x.x-p.x)**2+(x.z-p.z)**2-((y.x-p.x)**2+(y.z-p.z)**2)||a.id-b.id;});
 if(!candidates.length)return;
 const reach=candidateAccess(w,p,blockedCells(w),new Set(),true);
 for(const source of candidates){const path=routeToJob(w,source.owner as Cell,reach,true);if(!path)continue;const quantity=Math.min(space,source.quantity-reserved(source.id));if(quantity<1)continue;
  t.sourcePileId=source.id;markPileContentWrite379(t).quantity=carry.quantity+quantity;t.phase='pickup';t.haulOpportunity379={quantity};p.path=path;p.planCooldown=0;p.state=path.length?'moving':'working';return;
 }
}
export function processHaulOpportunity379(w:World,p:Pawn,move:(target:Cell,allowTarget:boolean)=>void):void {
 const t=p.haul;if(!t?.haulOpportunity379)return;
 if(!validHaulOpportunity379(w,p,t,Number(w.schemaVersion))){deliverHeld(w,p,t);return;}
 const carry=carryFor(w,p,t)!,source=pileById(w,t.sourcePileId)!,cell=source.owner as Cell;
 if(p.x!==cell.x||p.z!==cell.z){if(!adjacent(p,cell)){move(cell,true);return;}}
 if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
 const quantity=Math.min(t.haulOpportunity379.quantity,Math.max(0,carryStackLimit379(w,p,carry.item)-carry.quantity));if(quantity<=0){deliverHeld(w,p,t);return;}
 mergePileEgg256(carry,quantity,source.egg);mergePileContamination(carry,quantity,source.foodPoison);mergeThingDamage(carry,quantity,source.damage,pileMaxHp(carry,w.schemaVersion));mergeRot(carry,quantity,rotAge(source,w.tick),w.tick);
 markPileContentWrite379(carry).quantity+=quantity;markPileContentWrite379(source).quantity-=quantity;if(!source.quantity)splicePileEntries(w.piles,w.piles.indexOf(source),1);
 t.pickupCell={...cell};deliverHeld(w,p,t);refreshStock(w);planNextHaulOpportunity379(w,p);
}
