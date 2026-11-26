import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** CompSpawner's real new Thing is allocated even when Direct placement
 * absorbs the whole stack. A failed/stale plan consumes nothing. */
import type {World,Cell,MaterialPile} from './types.ts';
import {materialCanFit} from './materials.ts';
import {mergeThingDamage} from './thing-damage-rules.ts';
import {setMaterialForbidden256} from './material-permission-256.ts';
export function planHiveJellyDeposit256(w:World,cell:Cell,count:20|30,forbidden:boolean):{commit():boolean}|null {
 if(!isSchema256Or257(w.schemaVersion)||!Number.isSafeInteger(w.nextId+1)||!materialCanFit(w,'food',count,{type:'ground',...cell},'insect-jelly'))return null;
 const piles=w.piles,nextId=w.nextId,target=piles.find(p=>p.item==='insect-jelly'&&p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z&&p.quantity+count<=75),before=target?.quantity;
 if(!target&&piles.length>=32768)return null;
 let committed=false;
 return {commit(){if(committed||w.piles!==piles||w.nextId!==nextId||target&&target.quantity!==before)return false;
  committed=true;w.nextId++;
  if(target){mergeThingDamage(target,count,0,60);markPileContentWrite379(target).quantity+=count;if(forbidden)setMaterialForbidden256(target,true);}
  else {const made:MaterialPile={id:nextId,kind:'food',item:'insect-jelly',quantity:count,owner:{type:'ground',...cell}};setMaterialForbidden256(made,forbidden);appendPileEntries(w.piles,made);}
  return true;
 }};
}
