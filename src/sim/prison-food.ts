import {selfFoodPermission299} from './human-ingestion-clock299.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { capturePrisonTopology,prisonRoom,prisonerAllowedCell } from './prison-space.ts';
import type { RoomTopology } from './room-topology.ts';
import { FOOD_ITEMS,allowedFood } from './food-policy.ts';
import type { MaterialPile,Pawn,World } from './types.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';

/** A captive chooses food already inside their room without the warden's diet
 * restriction. Free colonists leave that room's food for its residents. */
export const selfAllowedFood=(world:World,pawn:Pawn)=>pawn.prisoner?FOOD_ITEMS:allowedFood(world,pawn);
export function prisonFood(world:World,pile:MaterialPile,topology?:RoomTopology):boolean {
  return pile.kind==='food'&&pile.owner.type==='ground'&&world.structures.some(s=>s.prisoner)&&!!prisonRoom(world,pile.owner,topology);
}
/** Retain only within one synchronous query, never across a world mutation. */
export function prisonFoodChecker(world:World):(pile:MaterialPile)=>boolean {
  let topology:RoomTopology|undefined,marked:boolean|undefined;
  return pile=>{
    if(pile.kind!=='food'||pile.owner.type!=='ground')return false;
    marked??=world.structures.some(s=>s.prisoner);
    return marked&&!!prisonRoom(world,pile.owner,topology??=capturePrisonTopology(world));
  };
}
export function selfFoodAccessible(world:World,pawn:Pawn,pile:MaterialPile,topology?:RoomTopology,ignoreForbidden=false):boolean {
  if(pile.owner.type!=='ground'||!selfFoodPermission299(pile,ignoreForbidden))return false;
  if(!allowedAreaAllows(world,pawn,pile.owner))return false;
  return pawn.prisoner?prisonerAllowedCell(world,pawn,pile.owner,topology):!prisonFood(world,pile,topology);
}
/** A supplier may use public food or food reserved for this patient's room,
 * never another prison's stock. This is separate from the patient's diet. */
export function assistedFoodAccessible(world:World,getter:Pawn,eater:Pawn,pile:MaterialPile,topology?:RoomTopology):boolean {
  if(pile.owner.type!=='ground'||!eggAllowedForPlayer256(pile))return false;
  if(!allowedAreaAllows(world,getter,pile.owner))return false;
  if(selfFoodAccessible(world,getter,pile,topology))return true;
  const room=eater.prisoner?prisonRoom(world,eater,topology):undefined;
  return room!==undefined&&room===prisonRoom(world,pile.owner,topology);
}
