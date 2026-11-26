import {selfFoodPermission299} from './human-ingestion-clock299.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { capturePrisonTopology,hasPrisonBedMark379,prisonRoom,prisonerAllowedCell } from './prison-space.ts';
import type { RoomTopology } from './room-topology.ts';
import { FOOD_ITEMS,allowedFood } from './food-policy.ts';
import type { MaterialPile,Pawn,World } from './types.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import {terrainJournalReadOwner,terrainReadScope} from './terrain-read-scope.ts';

/** A captive chooses food already inside their room without the warden's diet
 * restriction. Free colonists leave that room's food for its residents. */
export const selfAllowedFood=(world:World,pawn:Pawn)=>pawn.prisoner?FOOD_ITEMS:allowedFood(world,pawn);
export function prisonFood(world:World,pile:MaterialPile,topology?:RoomTopology):boolean {
  return pile.kind==='food'&&pile.owner.type==='ground'&&hasPrisonBedMark379(world)&&!!prisonRoom(world,pile.owner,topology);
}
/** Retain only within one synchronous query, never across a world mutation. */
type PrisonFoodChecker=(pile:MaterialPile)=>boolean;
export function prisonFoodChecker(world:World,topology?:RoomTopology):PrisonFoodChecker {
  let marked:boolean|undefined;
  return pile=>{
    if(pile.kind!=='food'||pile.owner.type!=='ground')return false;
    marked??=hasPrisonBedMark379(world);
    return marked&&!!prisonRoom(world,pile.owner,topology??=capturePrisonTopology(world));
  };
}
/** Local pure-query reader, invalid as soon as the exclusive read scope
 * ends. It is never supplied by a caller of the public eligibility APIs. */
function closedPrisonFoodChecker379(world:World,topology?:RoomTopology):PrisonFoodChecker|undefined {
  const owner=terrainJournalReadOwner(),scope=terrainReadScope();if(!owner)return;
  const check=prisonFoodChecker(world,topology);
  return pile=>terrainJournalReadOwner()===owner&&terrainReadScope()===scope?check(pile):prisonFood(world,pile,topology);
}
function selfFoodAccessibleWithChecker379(world:World,pawn:Pawn,pile:MaterialPile,topology:RoomTopology|undefined,ignoreForbidden:boolean,readPrisonFood?:PrisonFoodChecker):boolean {
  if(pile.owner.type!=='ground'||!selfFoodPermission299(pile,ignoreForbidden))return false;
  if(!allowedAreaAllows(world,pawn,pile.owner))return false;
  return pawn.prisoner?prisonerAllowedCell(world,pawn,pile.owner,topology):!(readPrisonFood?readPrisonFood(pile):prisonFood(world,pile,topology));
}
export function selfFoodAccessible(world:World,pawn:Pawn,pile:MaterialPile,topology?:RoomTopology,ignoreForbidden=false):boolean {
  return selfFoodAccessibleWithChecker379(world,pawn,pile,topology,ignoreForbidden);
}
/** Bound to this actor/world and one pure food loop. No injected predicate
 * and no mutable state shared across search callbacks, admissions or release.
 * Outside the owner scope, the closure performs the independent live reads. */
export function createSelfFoodAccessibilityQuery379(world:World,pawn:Pawn,topology?:RoomTopology,ignoreForbidden=false):PrisonFoodChecker {
  const check=closedPrisonFoodChecker379(world,topology);
  return pile=>selfFoodAccessibleWithChecker379(world,pawn,pile,topology,ignoreForbidden,check);
}
/** A supplier may use public food or food reserved for this patient's room,
 * never another prison's stock. This is separate from the patient's diet. */
function assistedFoodAccessibleWithChecker379(world:World,getter:Pawn,eater:Pawn,pile:MaterialPile,topology:RoomTopology|undefined,readPrisonFood?:PrisonFoodChecker):boolean {
  if(pile.owner.type!=='ground'||!eggAllowedForPlayer256(pile))return false;
  if(!allowedAreaAllows(world,getter,pile.owner))return false;
  if(selfFoodAccessibleWithChecker379(world,getter,pile,topology,false,readPrisonFood))return true;
  const room=eater.prisoner?prisonRoom(world,eater,topology):undefined;
  return room!==undefined&&room===prisonRoom(world,pile.owner,topology);
}
export function assistedFoodAccessible(world:World,getter:Pawn,eater:Pawn,pile:MaterialPile,topology?:RoomTopology):boolean {
  return assistedFoodAccessibleWithChecker379(world,getter,eater,pile,topology);
}
export function createAssistedFoodAccessibilityQuery379(world:World,getter:Pawn,eater:Pawn,topology?:RoomTopology):PrisonFoodChecker {
  const check=closedPrisonFoodChecker379(world,topology);
  return pile=>assistedFoodAccessibleWithChecker379(world,getter,eater,pile,topology,check);
}
