import type {Cell} from './types.ts';

/** Schema 374: the Core RimWorld 1.6 egg box (facts only, nothing copied).
 * - ThingDef EggBox (ThingDefs_Buildings/Buildings_Misc.xml), BuildingBase:
 *   1 × 1, not rotatable, stuffCategories Metallic and Woody, costStuffCount
 *   20, WorkToBuild 2000, MaxHitPoints 50, Mass 3, Flammability 1, pathCost
 *   10, fillPercent 0.3, designationCategory Misc, uiOrder 2060, minifiable,
 *   no research and no construction skill. No Beauty stat (0).
 * - CompProperties_ThingContainer, compClass CompEggContainer: stackLimit 25,
 *   minCountToEmpty 20, drawStackLabel. CompThingContainer.Accepts: an empty
 *   box takes any def; a box with content takes the same def while its total
 *   is below the stack limit (the whole laid stack is then added, so a box may
 *   hold up to 24 + 3 = 27 tortoise eggs). CompEggContainer.Accepts: fertilized
 *   or unfertilized eggs only, never while its eggs are ruined. CanEmpty: the
 *   first stack counts minCountToEmpty or more, or the eggs are ruined.
 * - JobGiver_LayEgg: an animal of the player's faction first looks for the
 *   best egg box (GenClosest.ClosestThing_Regionwise_ReachablePrioritized from
 *   its position, PathEndMode.OnCell, Danger.Some, maxDistance 30, minRegions
 *   10): the box must be spawned, not forbidden, reservable, within 30 cells
 *   (InHorDistOf) and accept the next egg def; its priority is 0.5 when empty,
 *   else 5 × the contained stack count; the highest priority wins, then the
 *   smallest squared distance. Without a box: the old egg piles, then a wander
 *   cell (unchanged here). JobDriver_LayEgg: go on the cell, wait 500 ticks,
 *   then the produced egg goes into the box if it is still there and accepts
 *   it, else near the animal on the ground.
 * - WorkGiverDef EmptyEggBox: Hauling, priorityInType 20, Manipulation.
 *   WorkGiver_EmptyEggBox: the box must be spawned, reservable, hold eggs that
 *   CanEmpty (unless forced) and a better storage must exist
 *   (StoreUtility.TryFindBestBetterStorageFor, StoragePriority.Unstored). The
 *   job (JobDriver_EmptyThingContainer) reserves the box and the store cell,
 *   goes to touch the box, waits 120 ticks extracting the contents, drops them
 *   all near the hauler, then carries the stack to the store cell.
 * - CompThingContainer.PostDeSpawn: a box that is destroyed, deconstructed or
 *   uninstalled drops its contents near its cell. Contents are not spawned:
 *   they are not hauled, eaten or counted as resources while inside; they keep
 *   their rot and incubation (the box only protects from deterioration). */
export const EGG_BOX_SCHEMA_374=374 as const;
export const isEggBoxSchema374=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=EGG_BOX_SCHEMA_374;
export const EGG_BOX_KINDS_374=['egg-box'] as const;
export type EggBoxKind374=typeof EGG_BOX_KINDS_374[number];
export const isEggBoxKind374=(value:unknown):value is EggBoxKind374=>value==='egg-box';
export const EGG_BOX_374=Object.freeze({
 defName:'EggBox',label:'Boîte à œufs',stuff:20,coreWork:2000,maxHitPoints:50,mass:3,flammability:1,pathCost:10,fillPercent:.3,uiOrder:2060,
 /** CompProperties_ThingContainer. */
 stackLimit:25,minCountToEmpty:20,
 /** JobGiver_LayEgg search radius and JobDriver_LayEgg wait, in Core ticks. */
 maxSearchRadius:30,layCoreTicks:500,
 /** JobDriver_EmptyThingContainer.OpenTicks, in Core ticks (one local tick is ten). */
 extractCoreTicks:120,
} as const);
/** Most eggs one box can hold: a stack is accepted below the limit, then added whole (3 tortoise eggs at most). */
export const EGG_BOX_MAX_CONTENT_374=EGG_BOX_374.stackLimit-1+3;
/** Local ticks of the extraction wait (120 Core ticks). */
export const EGG_BOX_EXTRACT_TICKS_374=EGG_BOX_374.extractCoreTicks/10;
export const EGG_BOX_MATERIALS_374=['wood','steel'] as const;
export type EggBoxMaterial374=typeof EGG_BOX_MATERIALS_374[number];
export const isEggBoxMaterial374=(value:unknown):value is EggBoxMaterial374=>value==='wood'||value==='steel';
/** The egg-box owner of a pile held inside an installed box. */
export interface EggBoxOwner374 {type:'egg-box374';structureId:number}
export const eggBoxOwner374=(structureId:number):EggBoxOwner374=>({type:'egg-box374',structureId});
/** InHorDistOf(30): squared horizontal distance at most 900. */
export const withinEggBoxRadius374=(a:Cell,b:Cell):boolean=>(a.x-b.x)**2+(a.z-b.z)**2<=EGG_BOX_374.maxSearchRadius**2;
/** GetScore of JobGiver_LayEgg.GetBestEggBox: 0.5 when empty, else 5 × the contained stack. */
export const eggBoxScore374=(contained:number):number=>contained>0?contained*5:.5;
