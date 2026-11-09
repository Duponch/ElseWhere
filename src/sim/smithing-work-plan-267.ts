import {allowedAreaAllows,captureAllowedArea} from './allowed-area-state.ts';
import {workPriority} from './work-types.ts';
import {cookingSpot,ingredientPlaceFree} from './cooking-bills.ts';
import {groundCapacity} from './ground-placement.ts';
import {reservedSource} from './materials.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {routeToJob,type Reachability} from './pathfinding.ts';
import {smithingRecipeAvailable267,isSmithingRecipe267,smithingWorkpiece267} from './smithing-content-267.ts';
import type {CookingPlan} from './cooking-planner.ts';
import type {CookingBill} from './cooking-types.ts';
import type {Cell,Pawn,Structure,World} from './types.ts';
import { billWork } from './production-recipes.ts';

/** A bound unfinished piece blocks a second manufacture even if its author
 * is away or its current location cannot be reached. No ingredient substitution. */
export function planSmithingWork267(w:World,p:Pawn,s:Structure,b:CookingBill,reach:Reachability,budget:{pairs:number}):{handled:boolean;plan?:CookingPlan} {
 if(!isSmithingRecipe267(b.recipe)||!smithingRecipeAvailable267(b.recipe,w.schemaVersion))return {handled:false};
 const policy=captureAllowedArea(w,p),allows=(c:Cell)=>!policy||allowedAreaAllows(w,p,c,policy);
 if(!allows(s))return {handled:false};
 const bound=w.piles.find(q=>q.smithingWork?.billId===b.id),spot=cookingSpot(s);
 const candidates=bound?[bound]:w.piles.filter(q=>q.smithingWork?.recipe===b.recipe&&!q.smithingWork.billId&&b.filters[q.smithingWork.material]&&q.owner.type==='ground'&&allows(q.owner)&&(q.owner.x-s.x)**2+(q.owner.z-s.z)**2<=b.radius**2)
  .sort((a,b)=>((a.owner as Cell).x-p.x)**2+((a.owner as Cell).z-p.z)**2-(((b.owner as Cell).x-p.x)**2+((b.owner as Cell).z-p.z)**2)||a.id-b.id);
 for(const q of candidates){const u=q.smithingWork!;if(!materialAllowedForPlayer256(q)||u.authorId!==p.id||!b.filters[u.material]||q.owner.type!=='ground'||!allows(q.owner)||reservedSource(w,q.id)>0)continue;
  if(budget.pairs--<=0){budget.pairs=0;return {handled:true};}
  const source:Cell={x:q.owner.x,z:q.owner.z},path=routeToJob(w,source,reach,true);if(!path)continue;
  const placed=ingredientPlaceFree(w,source,spot,b.recipe,s),cell=placed?source:[s,{x:spot.x-1,z:spot.z},{x:spot.x+1,z:spot.z},{x:spot.x,z:spot.z-1},{x:spot.x,z:spot.z+1}].find(c=>allows(c)&&ingredientPlaceFree(w,c,spot,b.recipe,s)&&groundCapacity(w,c,q.item,p.id)>=1);
  if(!cell)continue;
  return {handled:true,plan:{station:s,priority:workPriority(p,billWork(b)),target:source,path,task:{recipe:b.recipe,stationId:s.id,billId:b.id,spot,actionCell:{...source},phase:'gather',ingredients:[{pileId:q.id,item:smithingWorkpiece267(b.recipe),quantity:1,stage:placed?'placed':'source',cell:{x:cell.x,z:cell.z}}],progress:0,productId:null,storageId:null}}};
 }
 return {handled:!!bound};
}
