import {assignPileOwner} from './pile-index.ts';
import {validAiCorePile298} from './victory-content-save-298.ts';
import {isNovelBook295} from './book-state-295.ts';
import { copyPileCondition } from './pile-condition.ts';
import { groundCapacity,nearbyGround } from './ground-placement.ts';
import { transferPile } from './materials.ts';
import { canStandAt } from './furniture-travel.ts';
import { isRoofed } from './roof-rules.ts';
import { isPowerActive } from './power-rules.ts';
import { rotAge } from './food-preservation.ts';
import type { Cell,MaterialOwner,MaterialPile,World } from './types.ts';

export function orbitalDraftPiles(w:World):MaterialPile[] {return w.piles.map(p=>({...p,owner:{...p.owner},...copyPileCondition(p)}));}
export function orbitalTake(w:World,id:number,quantity:number,owner:MaterialOwner):boolean {
  const pile=w.piles.find(p=>p.id===id);if(!pile||!Number.isSafeInteger(quantity)||quantity<=0||quantity>pile.quantity)return false;
  if((pile.item==='ai-core'||pile.kind==='ai-core')&&(!validAiCorePile298(pile,w.schemaVersion)||quantity!==1))return false;
  if((pile.item==='novel'||pile.kind==='book')&&(w.schemaVersion<295||pile.item!=='novel'||pile.kind!=='book'||quantity!==1||pile.quantity!==1||!isNovelBook295(pile.book)||owner.type==='job'||owner.type==='equipment'||owner.type==='apparel'||owner.type==='grave'))return false;
  let part=pile;
  if(quantity!==pile.quantity){
    if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1))return false;
    pile.quantity-=quantity;part={...pile,id:w.nextId++,quantity,owner:{...pile.owner},...copyPileCondition(pile)};w.piles.push(part);
  }
  if(owner.type==='ground')return transferPile(w,part,owner);
  assignPileOwner(part,{...owner});delete part.haulRequested;
  if(part.rot)part.rot={progress:rotAge(part,w.tick),atTick:w.tick,rate:0};
  return true;
}
export function orbitalLandingFree(w:World,c:Cell):boolean {
  return canStandAt(w,c)&&!isRoofed(w,c.z*w.width+c.x)&&!w.packed.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z)
    &&!w.pawns.some(p=>p.x===c.x&&p.z===c.z||p.motion&&p.motion.end>w.tick&&p.motion.from.x===c.x&&p.motion.from.z===c.z)
    &&!w.orbital?.pending.some(p=>p.cell.x===c.x&&p.cell.z===c.z);
}
/** Core first outdoor beacon is not filtered by power. The fallback uses actual
 * powered machines and an eight-cell local expansion to find open sky. */
export function orbitalLandingCells(w:World):Cell[] {
  const cells:Cell[]=[],seen=new Set<number>();
  const add=(c:Cell)=>{const key=c.z*w.width+c.x;if(!seen.has(key)&&orbitalLandingFree(w,c)){seen.add(key);cells.push(c);}};
  for(const s of w.structures)if(s.kind==='orbital-beacon'&&!isRoofed(w,s.z*w.width+s.x)){
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]])add({x:s.x+dx!,z:s.z+dz!});
    if(cells.length)break;
  }
  for(const s of w.structures)if((s.kind==='orbital-beacon'||s.kind==='comms-console')&&isPowerActive(s))for(const c of nearbyGround(w,s,8))add(c);
  return cells;
}
/** One whole delivery on a draft. If the final stack fails, callers discard it. */
export function orbitalDeposit(w:World,deliveryId:number,origin:Cell):boolean {
  const items=w.piles.filter(p=>p.owner.type==='orbital-cargo'&&p.owner.deliveryId===deliveryId);
  for(const item of items){let remaining=item.quantity;
    for(const cell of nearbyGround(w,origin,8)){
      if(isRoofed(w,cell.z*w.width+cell.x))continue;
      const n=Math.min(remaining,groundCapacity(w,cell,item));
      if(n&&!orbitalTake(w,item.id,n,{type:'ground',...cell}))return false;
      remaining-=n;if(!remaining)break;
    }
    if(remaining)return false;
  }
  return true;
}
