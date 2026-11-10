import {assignPileOwner} from './pile-index.ts';
import type {World} from './types.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {furnitureDropCell} from './furniture-transfer.ts';
/** Real proposed local positions and collections from the enclosing entry
 * transaction; only wrapper owners are drafted, no map or building invented. */
export function planPackedInventoryDrop256(map:World):PackedFurniture[]|undefined {
 const packed=map.packed.map(p=>({...p,owner:{...p.owner}})),view={...map,packed};
 for(const pack of packed)if(pack.owner.type==='inventory'){const person=map.pawns.find(p=>p.id===(pack.owner as {pawnId:number}).pawnId);if(!person)return;const cell=furnitureDropCell(view,person,person.id);if(!cell)return;assignPileOwner(pack,{type:'ground',...cell});}return packed;
}