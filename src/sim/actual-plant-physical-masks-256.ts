import {blockedCells} from './pathfinding.ts';
import {geyserCells256} from './local-geyser-state-256.ts';
import {STRUCTURE_DEFINITIONS,footprintCells} from './definitions.ts';
import {STRUCTURE_SHOT_FILL,FRAME_SHOT_FILL,resourceShotFill,itemShotFill} from './combat-content.ts';
import {isPassageDoor} from './door-rules.ts';
import {constructionFinalWipesPlants,constructionFrameWipesPlants} from './construction-plants.ts';
import type {World,StructureKind,Cell} from './types.ts';
import type {ExistingGenerationPlant256} from './wild-plant-generation-256.ts';
import type {PlantPhysicalMasks256} from './wild-plant-runtime-map-256.ts';
/** Exact current Core zero-fill exceptions closed from their resolved Defs.
 * All have Building.isEdifice=true despite zero fill, except PowerConduit.
 * SupportsPlants is separate: it never erases the spawner's earlier edifice
 * refusal (including SleepingSpot). Future zero-fill kinds must close facts. */
const ZERO_FILL_EDIFICES:ReadonlySet<StructureKind>=new Set(['power-switch','spike-trap','grave','bedroll','sleeping-spot','animal-sleeping-spot','crafting-spot','butcher-spot','horseshoes','hoopstone-ring']);
/** Fresh rare-capture data only; this function does not install an index,
 * mutate a World or classify furniture standability as normal walkability. */
export function actualPlantPhysicalMasks256(world:World):PlantPhysicalMasks256 {
 const n=world.width*world.height;
 if(world.schemaVersion<256||![world.width,world.height].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=400)||!Number.isSafeInteger(n)||n<1||n>160000||world.tiles.length!==n)throw Error('Invalid actual prospective plant map');
 const blocked=blockedCells(world,true),normalWalkable=Uint8Array.from(blocked,v=>v?0:1),door=new Uint8Array(n),fence=new Uint8Array(n),fullFill=new Uint8Array(n),coverOrEdifice=new Uint8Array(n),blocksPlanting=new Uint8Array(n);
 const index=(c:Cell)=>{if(!Number.isSafeInteger(c.x)||!Number.isSafeInteger(c.z)||c.x<0||c.z<0||c.x>=world.width||c.z>=world.height)throw Error('Physical plant owner outside its actual map');return c.z*world.width+c.x;};
 const filled=(c:Cell,fill:number,edifice=false,blocks=false)=>{if(!Number.isFinite(fill)||fill<0||fill>1)throw Error('Missing physical plant fill definition');const i=index(c);if(fill>.99)fullFill[i]=1;if(fill>=.01||edifice)coverOrEdifice[i]=1;if(blocks||fill>=.01||edifice)blocksPlanting[i]=1;};
 for(let i=0;i<n;i++){
  const tile=world.tiles[i]!;
  // A floor/bridge is the real walkable surface, not its water substrate.
  // Finished solid buildings below are re-applied from the same definition
  // used by blockedCells; this never opens a wall because a bridge is below.
  if(tile.bridge||tile.floor)normalWalkable[i]=1;
  if(tile.terrain==='rock'||tile.collapsedRock){normalWalkable[i]=0;fullFill[i]=coverOrEdifice[i]=blocksPlanting[i]=1;}
 }
 for(const structure of world.structures){
  if(!Object.hasOwn(STRUCTURE_SHOT_FILL,structure.kind)||!Object.hasOwn(STRUCTURE_DEFINITIONS,structure.kind))throw Error('Missing physical plant structure metadata');
  const fill=STRUCTURE_SHOT_FILL[structure.kind];
  if(fill<.01&&structure.kind!=='power-conduit'&&!ZERO_FILL_EDIFICES.has(structure.kind))throw Error('Unresolved zero-fill edifice metadata');
  const edifice=ZERO_FILL_EDIFICES.has(structure.kind);
  // This existing catalog resolves SupportsPlants before fill/edifice, exactly
  // BlocksPlanting(false). coverOrEdifice is deliberately independent.
  const blocks=constructionFinalWipesPlants(structure.kind);
  for(const cell of footprintCells(structure)){
   const i=index(cell);if(fill>.99)fullFill[i]=1;if(fill>=.01||edifice)coverOrEdifice[i]=1;if(blocks)blocksPlanting[i]=1;
   if(STRUCTURE_DEFINITIONS[structure.kind].blocksMovement)normalWalkable[i]=0;
   if(isPassageDoor(structure.kind))door[i]=1;else if(structure.kind==='fence')fence[i]=1;
  }
 }
 for(const job of world.jobs)if(job.construction==='frame'){
  const kind=job.furniture?.kind??job.kind;
  // Core terrain Frames are Ethereal/fill0; a mere blueprint is not a Frame.
  if(job.kind==='lay-floor'||job.kind==='build-bridge')continue;
  if(!constructionFrameWipesPlants(kind))throw Error('Missing actual Thing Frame metadata');
  for(const cell of footprintCells(job))filled(cell,FRAME_SHOT_FILL,false,true);
 }
 for(const plant of world.resources){const isPlant=plant.kind!=='rock';filled(plant,resourceShotFill(plant),false,isPlant);}
 for(const pile of world.piles)if(pile.owner.type==='ground')filled(pile.owner,itemShotFill(pile.item));
 for(const pack of world.packed)if(pack.owner.type==='ground'){
  // Core MinifiedThing is an Item: fill0/blockPlantsfalse/Standable. Its inner
  // Structure is NOT spawned and supplies neither edifice nor whole footprint.
  index(pack.owner);
 }
 // Core-only SandGrid does not allocate (CheckOdyssey); GetDepth then returns
 // exactly0. This is blown sand depth, not a Sand/SoftSand terrain identity.
 // Natural non-edifice/fill0: only blockPlants, never a movement/cover wall.
 for(const geyser of world.geysers?.items??[])for(const cell of geyserCells256(world.width,geyser))blocksPlanting[cell]=1;
 const sandDepth=new Float32Array(n);
 return {normalWalkable,door,fence,fullFill,coverOrEdifice,blocksPlanting,sandDepth};
}

/** A pot owns its real living plant directly, not through Resource. Keep its
 * actual cell/species in whole-map and region counts without inventing an ID,
 * a spawnable wild commonality or a Resource/clock. Dead retained V90 plants
 * contribute no live owner. Order follows the actual structure owner array. */
export function actualAdditionalPlantOwners256(world:Pick<World,'width'|'height'|'structures'>):ExistingGenerationPlant256[] {
 const owners:ExistingGenerationPlant256[]=[];
 for(const structure of world.structures)if(structure.kind==='flower-pot'&&structure.flower?.plant&&structure.flower.plant.hitPoints>0){
  if(!Number.isSafeInteger(structure.x)||!Number.isSafeInteger(structure.z)||structure.x<0||structure.z<0||structure.x>=world.width||structure.z>=world.height)throw Error('Actual potted plant outside its map');
  owners.push({cell:structure.z*world.width+structure.x,defId:'Plant_Daylily',nonStump:true});
 }
 return owners;
}
