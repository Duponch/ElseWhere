import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { isGunRecipe } from './production-recipes.ts';
import { cookingSpot,ingredientPlaceFree } from './cooking-bills.ts';
import { groundCapacity } from './ground-placement.ts';
import { reservedSource } from './materials.ts';
import { routeToJob,type Reachability } from './pathfinding.ts';
import type { CookingPlan } from './cooking-planner.ts';
import type { CookingBill } from './cooking-types.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';
import { billWork } from './production-recipes.ts';

/** An unfinished weapon is owned by its author; materials cannot start a second
 * copy while the linked object is held, unreachable or assigned elsewhere. */
export function planGunWork(world:World,pawn:Pawn,station:Structure,bill:CookingBill,reach:Reachability,budget:{pairs:number}):{handled:boolean;plan?:CookingPlan} {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(!allows(station))return {handled:false};
  if(!isGunRecipe(bill.recipe))return {handled:false};
  const bound=world.piles.find(p=>p.gunWork?.billId===bill.id),spot=cookingSpot(station);
  const candidates=bound?[bound]:world.piles.filter(p=>p.gunWork?.recipe===bill.recipe&&!p.gunWork.billId&&p.gunWork.parts.every(part=>bill.filters[part.item])&&p.owner.type==='ground'&&allows(p.owner)&&(p.owner.x-station.x)**2+(p.owner.z-station.z)**2<=bill.radius**2)
    .sort((a,b)=>((a.owner as Cell).x-pawn.x)**2+((a.owner as Cell).z-pawn.z)**2-(((b.owner as Cell).x-pawn.x)**2+((b.owner as Cell).z-pawn.z)**2)||a.id-b.id);
  for(const pile of candidates){
    if(pile.gunWork!.authorId!==pawn.id||pile.owner.type!=='ground'||!allows(pile.owner)||reservedSource(world,pile.id)>0)continue;
    if(budget.pairs--<=0){budget.pairs=0;return {handled:true};}
    const source=pile.owner,path=routeToJob(world,source,reach,true);if(!path)continue;
    const placed=ingredientPlaceFree(world,source,spot,bill.recipe,station);
    const cell=placed?source:[station,{x:spot.x-1,z:spot.z},{x:spot.x+1,z:spot.z},{x:spot.x,z:spot.z-1},{x:spot.x,z:spot.z+1}].find(c=>allows(c)&&ingredientPlaceFree(world,c,spot,bill.recipe,station)&&groundCapacity(world,c,pile.item,pawn.id)>=1);
    if(!cell)continue;
    return {handled:true,plan:{station,priority:workPriority(pawn,billWork(bill)),target:source,path,task:{recipe:bill.recipe,stationId:station.id,billId:bill.id,spot,actionCell:{x:source.x,z:source.z},phase:'gather',ingredients:[{pileId:pile.id,item:'unfinished-gun',quantity:1,stage:placed?'placed':'source',cell:{x:cell.x,z:cell.z}}],progress:0,productId:null,storageId:null}}};
  }
  return {handled:!!bound};
}
