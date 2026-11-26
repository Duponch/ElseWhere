import type {MaterialPile,World} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';

export type VisualAnimal=Pick<WildAnimal,'id'|'species'|'state'|'x'|'z'|'sex'|'ageTicks'|'growthTracker'|'arrivalRotation'|'motion'|'meal'|'strike'|'stun'|'threat'|'predation'|'manhunter'|'health'|'domestic'>&{corpsePile?:MaterialPile;carrierId?:number};

/** Snapshot membership only. Preserve source order within each species: live
 * actors first, then physical corpses, including ground handoffs. No World
 * object or owner is changed to prepare the resident presentation batches. */
export function wildlifePresentationGroups(world:World,transferCarrier?:(pileId:number)=>number|undefined,corpses:readonly MaterialPile[]=world.piles):Map<string,VisualAnimal[]> {
  const groups=new Map<string,VisualAnimal[]>(),rescues=new Map<number,number>();
  for(const pawn of world.pawns){
    const rescue=pawn.animalRescue;
    if(rescue?.phase==='carry'&&!rescues.has(rescue.animalId))rescues.set(rescue.animalId,pawn.id);
  }
  const append=(animal:VisualAnimal)=>{
    let group=groups.get(animal.species);
    if(!group){group=[];groups.set(animal.species,group);}
    group.push(animal);
  };
  for(const animal of world.wildlife?.animals??[]){
    const carrierId=rescues.get(animal.id);
    append(carrierId===undefined?animal:{...animal,carrierId});
  }
  for(const pile of corpses){
    const corpse=pile.corpse;
    if(!corpse||pile.owner.type==='job')continue;
    append({id:corpse.animalId,species:corpse.species,state:'dead',
      x:pile.owner.type==='ground'?pile.owner.x:0,z:pile.owner.type==='ground'?pile.owner.z:0,
      sex:corpse.sex,ageTicks:corpse.ageTicks,health:corpse.health,corpsePile:pile,
      carrierId:pile.owner.type==='pawn'?pile.owner.pawnId:transferCarrier?.(pile.id)});
  }
  return groups;
}
