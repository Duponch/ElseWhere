import {constructionRecipe,deliveredMaterial} from './construction-materials.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {reservedDestination,reservedSource} from './materials.ts';
import {carryStackLimit379} from './carry-quantity-379.ts';
import {canReach} from './work-planner.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import type {Reachability} from './pathfinding.ts';
import type {Job,Pawn,World} from './types.ts';

export function constructionMissingLabel379(world:World,job:Job):string {
  return constructionRecipe(job).ingredients.map(c=>({item:c.item,quantity:Math.max(0,c.quantity-deliveredMaterial(world,job,c.item))}))
    .filter(c=>c.quantity>0).map(c=>`${c.quantity} ${ITEM_DEFINITIONS[c.item].label}`).join(' + ');
}
/** Read only after real admission found no trip. Explain the exact required
 * Stuff rather than suggesting that another material can replace it. */
export function constructionSupplyRefusal379(world:World,pawn:Pawn,job:Job,reach?:Reachability):string {
  const reasons:string[]=[];
  for(const cost of constructionRecipe(job).ingredients){
    const missing=Math.max(0,cost.quantity-deliveredMaterial(world,job,cost.item));if(!missing)continue;
    const label=ITEM_DEFINITIONS[cost.item].label,enroute=reservedDestination(world,{type:'job',jobId:job.id},undefined,cost.item);
    if(enroute>=missing){reasons.push(`${label} : ${missing} à livrer, déjà réservés pour ce chantier.`);continue;}
    let forbidden=0,reserved=0,outside=0,inaccessible=0,available=0;
    for(const pile of world.piles){
      if(pile.item!==cost.item||pile.owner.type!=='ground')continue;
      if(!materialAllowedForPlayer256(pile)){forbidden+=pile.quantity;continue;}
      if(!allowedAreaAllows(world,pawn,pile.owner)){outside+=pile.quantity;continue;}
      const held=Math.min(pile.quantity,reservedSource(world,pile.id));reserved+=held;
      const free=pile.quantity-held;if(free<=0)continue;
      if(reach&&!canReach(world,pile.owner,reach,true))inaccessible+=free;else available+=free;
    }
    const states:string[]=[];
    if(forbidden)states.push(`${forbidden} interdits`);
    if(reserved)states.push(`${reserved} réservés`);
    if(outside)states.push(`${outside} hors zone autorisée`);
    if(inaccessible)states.push(`${inaccessible} inaccessibles`);
    if(available&&carryStackLimit379(world,pawn,cost.item)===0)states.push('capacité de portage insuffisante');
    states.push(`${available} disponibles`);
    reasons.push(`${label} : ${missing} à livrer ; ${states.join(', ')}.`);
  }
  return reasons.join(' ')||'Les matériaux requis sont déjà livrés.';
}
