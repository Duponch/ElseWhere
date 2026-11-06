import {allowedAreaAllows,allowedAreaWorkAllowed} from './allowed-area-state.ts';
import {ingredientPlaceFree} from './cooking-bills.ts';
import {groundCapacity,planGroundPlacement} from './ground-placement.ts';
import {healthRandom} from './health.ts';
import {addMaterial,refreshStock} from './materials.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {isCookingOrder} from './order-types.ts';
import {releaseAssignments} from './work-release.ts';
import {smithingRecipeAvailable267,isSmithingRecipe267,smithingMaterialFromIngredients267,smithingWorkpiece267,type SmithingMaterial267,type SmithingRecipe267} from './smithing-content-267.ts';
import type {Cell,CommandResult,MaterialPile,Pawn,World} from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface SmithingWork267 {
 recipe:SmithingRecipe267;material:SmithingMaterial267;authorId:number;progress:number;
 /** One receipt per incorporated physical pile, before its identity is retired. */
 parts:{item:SmithingMaterial267;quantity:number}[];billId?:number;
}
/** Transform only delivered, homogeneous parts; first prove the workpiece slot. */
export function beginSmithingWork267(w:World,p:Pawn):MaterialPile|null {
 const t=p.cooking;if(!t||!isSmithingRecipe267(t.recipe)||!smithingRecipeAvailable267(t.recipe,w.schemaVersion)||!allowedAreaWorkAllowed(w,p)||(p.motion?.end??0)>w.tick||p.moveCooldown>0||p.x!==t.spot.x||p.z!==t.spot.z)return null;
 const recipe=t.recipe,item=smithingWorkpiece267(recipe);
 const station=structureById(w,t.stationId);if(!station)return null;
 if(t.ingredients.length===1&&t.ingredients[0]!.item===item){
  const i=t.ingredients[0]!,existing=w.piles.find(q=>q.id===i.pileId),work=existing?.smithingWork;
  if(!existing||!materialAllowedForPlayer256(existing)||!work||existing.item!==item||work.recipe!==recipe||work.authorId!==p.id||i.stage!=='placed'||i.quantity!==1||existing.owner.type!=='ground'||existing.owner.x!==i.cell.x||existing.owner.z!==i.cell.z||!ingredientPlaceFree(w,i.cell,t.spot,recipe,station)||work.billId!==undefined&&work.billId!==t.billId)return null;
  work.billId=t.billId;return existing;
 }
 const material=smithingMaterialFromIngredients267(recipe,t.ingredients);if(!material)return null;
 const used=new Map<number,number>();
 for(const i of t.ingredients){const q=w.piles.find(q=>q.id===i.pileId);if(i.stage!=='placed'||!q||!materialAllowedForPlayer256(q)||q.item!==material||q.owner.type!=='ground'||q.owner.x!==i.cell.x||q.owner.z!==i.cell.z||!ingredientPlaceFree(w,i.cell,t.spot,recipe,station))return null;used.set(q.id,(used.get(q.id)??0)+i.quantity);}
 if([...used].some(([id,n])=>w.piles.find(q=>q.id===id)!.quantity<n))return null;
 const piles=w.piles.map(q=>used.has(q.id)?{...q,quantity:q.quantity-used.get(q.id)!}:q).filter(q=>q.quantity>0),shadow={...w,piles};
 if(piles.length>=32768||!Number.isSafeInteger(w.nextId+1))return null;
 const s=t.spot,cells:Cell[]=[{x:s.x,z:s.z+1},{x:s.x+1,z:s.z},{x:s.x-1,z:s.z},{x:s.x,z:s.z-1}];
 const cell=cells.find(c=>allowedAreaAllows(w,p,c)&&ingredientPlaceFree(shadow,c,s,recipe)&&groundCapacity(shadow,c,item,p.id)>=1);if(!cell)return null;
 const pile:MaterialPile={id:w.nextId++,kind:'unfinished',item,quantity:1,owner:{type:'ground',...cell},smithingWork:{recipe,material,authorId:p.id,progress:0,parts:[...used.values()].map(quantity=>({item:material,quantity})),billId:t.billId}};
 w.piles=[...piles,pile];t.ingredients=[{pileId:pile.id,item,quantity:1,stage:'placed',cell:{...cell}}];refreshStock(w);return pile;
}
/** Native Cancel refunds75% of each receipt. Refusal preserves both object/RNG. */
export function cancelSmithingWork267(w:World,id:number):CommandResult {
 const pile=w.piles.find(q=>q.id===id),u=pile?.smithingWork;
 if(!pile||!u||!smithingRecipeAvailable267(u.recipe,w.schemaVersion)||pile.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Ouvrage inachevé introuvable au sol.'};
 const random={rng:w.rng};let quantity=0;
 for(const part of u.parts){const raw=part.quantity*.75,whole=Math.floor(raw);quantity+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);}
 const shadow={...w,piles:w.piles.filter(q=>q!==pile)},placements=planGroundPlacement(shadow,quantity,pile.owner,u.material);
 if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(w.nextId+placements.length))return {ok:false,code:'occupied',reason:'Aucune place pour conserver les matériaux récupérés.'};
 for(const p of w.pawns){if(p.cooking?.ingredients.some(i=>i.pileId===id)||p.haul?.sourcePileId===id)releaseAssignments(w,p);p.orders.queue=p.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===id):o.sourcePileId!==id));}
 w.piles=w.piles.filter(q=>q!==pile);for(const placement of placements)addMaterial(w,u.material,placement.quantity,{type:'ground',...placement.cell},u.material);w.rng=random.rng;refreshStock(w);return {ok:true};
}
export function detachMissingSmithingBills267(w:World):void {
 if(!w.piles.some(q=>q.smithingWork?.billId))return;
 const bills=new Set([...w.structures,...w.packed.map(q=>q.building)].flatMap(s=>s.bills?.map(b=>b.id)??[]));
 for(const q of w.piles)if(q.smithingWork?.billId&&!bills.has(q.smithingWork.billId))delete q.smithingWork.billId;
}
