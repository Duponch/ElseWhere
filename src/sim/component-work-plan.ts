import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import {componentWorkpiecePlaceFree,cookingSpot} from './cooking-bills.ts';
import {footprintCells} from './definitions.ts';
import {groundCapacity} from './ground-placement.ts';
import {reservedSource} from './materials.ts';
import {isComponentRecipe} from './production-recipes.ts';
import {routeToCell,routeToJob,type Reachability} from './pathfinding.ts';
import type {CookingBill} from './cooking-types.ts';
import type {CookingPlan} from './cooking-planner.ts';
import type {Cell,Pawn,Structure,World} from './types.ts';
import { billWork } from './production-recipes.ts';

/** A bound component workpiece waits for its author; fresh steel cannot bypass it. */
export function planComponentWork(world:World,pawn:Pawn,station:Structure,bill:CookingBill,reach:Reachability,budget:{pairs:number}):{handled:boolean;plan?:CookingPlan} {
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  if(!allows(station))return {handled:false};
  if(!isComponentRecipe(bill.recipe))return {handled:false};
  const bound=world.piles.find(p=>p.componentWork?.billId===bill.id),spot=cookingSpot(station);
  const candidates=bound?[bound]:world.piles.filter(p=>p.componentWork?.recipe===bill.recipe&&!p.componentWork.billId&&(
      p.componentWork.recipe==='make-component'?bill.filters.steel:p.componentWork.parts.every(part=>bill.filters[part.item])
    )&&p.owner.type==='ground'&&allows(p.owner)&&(p.owner.x-station.x)**2+(p.owner.z-station.z)**2<=bill.radius**2)
    .sort((a,b)=>((a.owner as Cell).x-pawn.x)**2+((a.owner as Cell).z-pawn.z)**2-(((b.owner as Cell).x-pawn.x)**2+((b.owner as Cell).z-pawn.z)**2)||a.id-b.id);
  for(const piece of candidates){
    if(piece.componentWork!.authorId!==pawn.id||piece.owner.type!=='ground'||!allows(piece.owner)||reservedSource(world,piece.id)>0)continue;
    if(budget.pairs--<=0){budget.pairs=0;return {handled:true};}
    const source=piece.owner;
    const placed=componentWorkpiecePlaceFree(world,source,spot,bill.recipe,station);
    // The bench surface is worked from the reserved spot. An interior surface
    // cell need not have an independent path from the far side of the bench.
    const surface=bill.recipe==='make-advanced-component'&&placed&&Math.abs(source.x-spot.x)+Math.abs(source.z-spot.z)>1;
    const path=surface?routeToCell(world,spot,reach):routeToJob(world,source,reach,true);if(!path)continue;
    const cell=placed?source:[station,{x:spot.x-1,z:spot.z},{x:spot.x+1,z:spot.z},{x:spot.x,z:spot.z-1},{x:spot.x,z:spot.z+1},...footprintCells(station)].find(c=>allows(c)&&componentWorkpiecePlaceFree(world,c,spot,bill.recipe,station)&&groundCapacity(world,c,piece.item,pawn.id)>=1);
    if(!cell)continue;
    return {handled:true,plan:{station,priority:workPriority(pawn,billWork(bill)),target:surface?spot:source,path,task:{recipe:bill.recipe,stationId:station.id,billId:bill.id,spot,actionCell:{x:source.x,z:source.z},phase:'gather',ingredients:[{pileId:piece.id,item:'unfinished-component',quantity:1,stage:placed?'placed':'source',cell:{x:cell.x,z:cell.z}}],progress:0,productId:null,storageId:null}}};
  }
  return {handled:!!bound};
}
