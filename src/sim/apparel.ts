import {assignPileOwner} from './pile-index.ts';
import { apparelDefinition,apparelLabel,conflictsWith,hasApparelParts,wornApparel } from './apparel-rules.ts';
import { dropRetainingIdentity } from './ground-placement.ts';
import { adjacent } from './pathfinding.ts';
import { reservedSource } from './materials.ts';
import { releaseWork } from './work-release.ts';
import type { NeedContext } from './needs.ts';
import type { MaterialPile,Pawn,World } from './types.ts';

/** Common capacity/exhaustion checks are owned by the equipment command. */
export function apparelReason(world:World,pawn:Pawn,pile:MaterialPile|undefined,action:'wear'|'remove',accepted:boolean):string|undefined {
  if(!pile?.apparel||pile.kind!=='apparel')return 'Vêtement introuvable.';
  if(action==='remove')return pile.owner.type==='apparel'&&pile.owner.pawnId===pawn.id?undefined:'Ce vêtement n’est pas porté par ce colon.';
  if(!hasApparelParts(pawn,pile))return 'Aucune partie du corps ne peut porter ce vêtement.';
  if(pile.owner.type!=='ground')return 'Ce vêtement n’est plus au sol.';
  if(reservedSource(world,pile.id,pawn.id)>0)return 'Ce vêtement est réservé.';
  if(accepted&&pile.apparel.forbidden)return 'Ce vêtement est interdit.';
}
function report(world:World,message:string):void{world.events.push({tick:world.tick,type:'job',message});if(world.events.length>80)world.events.shift();}
export function processApparel(world:World,pawn:Pawn,pile:MaterialPile,context:NeedContext):void {
  const task=pawn.equipmentTask!;
  if(task.action==='wear') {
    if(pile.owner.type!=='ground')return;
    if((pawn.x!==pile.owner.x||pawn.z!==pile.owner.z)&&!adjacent(pawn,pile.owner)){context.move(pile.owner,false);return;}
  }
  pawn.path=[];pawn.state='working';task.progress++;
  if(task.action==='wear') {
    const old=wornApparel(world,pawn).sort((a,b)=>apparelDefinition(a).coverage.outerLayer-apparelDefinition(b).coverage.outerLayer).reverse().find(p=>conflictsWith(p,pile));
    // The Core wear driver uses a cumulative buffer, removing at most one
    // incompatible piece per update; it does not wait until the final swap.
    if(old&&task.progress>=apparelDefinition(old).equipTicks) {
      if(!dropRetainingIdentity(world,old,pawn)){report(world,`${pawn.name} ne peut pas déposer ${apparelLabel(old)}.`);releaseWork(world,pawn);return;}
      delete old.apparel!.forbidden;delete old.apparel!.forced;
    }
  }
  if(task.progress<task.duration!)return;
  if(task.action==='remove') {
    if(dropRetainingIdentity(world,pile,pawn)){delete pile.apparel!.forced;pile.apparel!.forbidden=true;report(world,`${pawn.name} retire ${apparelLabel(pile)}.`);}
    else report(world,`${pawn.name} conserve ${apparelLabel(pile)} : aucun dépôt disponible.`);
  } else if(!wornApparel(world,pawn).some(p=>conflictsWith(p,pile))) {
    assignPileOwner(pile,{type:'apparel',pawnId:pawn.id});delete pile.apparel!.forbidden;if(task.automatic)delete pile.apparel!.forced;else pile.apparel!.forced=true;report(world,`${pawn.name} porte ${apparelLabel(pile)}.`);
  }
  releaseWork(world,pawn);
}
