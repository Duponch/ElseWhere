import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Fresh physical capture for Site3 generation/rare decisions. No World is
 * manufactured, stepped, changed or retained. Re-capture after any mutation. */
import {footprintCells} from './definitions.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {terrainAvailable256,terrainSupportsAffordance256} from './natural-terrain-runtime-256.ts';
import {roofCells} from './roof-rules.ts';
import {WILD_PLANT_GENERATION_FACTS_256} from './wild-plant-generation-data-256.ts';
import {START_STRUCTURE_PHYSICS_256,type StartThingPhysics256} from './player-start-physics-256.ts';
import {assertLocalDimensions256} from './local-cell-selection-256.ts';
import type {World,Cell,Resource} from './types.ts';
/** Real owner fields only. This structural subset is never cast to World. */
export type ActualStartMap256=Pick<World,'width'|'height'|'tiles'|'structures'|'resources'|'piles'|'jobs'|'packed'|'roofing'>&{readonly schemaVersion:number;readonly site?:{readonly revision:number}};
export type ActualRegionType256='normal'|'portal'|'fence'|'impassable-air'|'none';
export interface ActualDistrictSummary256 {readonly id:number;readonly type:'normal'|'portal'|'fence';readonly touchesMapEdge:boolean;readonly cellCount:number}
export interface ActualLocalDistrictCapture256 {
 readonly width:number;readonly height:number;
 standable(cell:number):boolean;
 normalWalkable(cell:number):boolean;
 regionType(cell:number):ActualRegionType256;
 district(cell:number):ActualDistrictSummary256|null;
 edifice(cell:number):boolean;
 heavy(cell:number):boolean;
 roofed(cell:number):boolean;
 /** Effective captured-anchor behavior in the current FindPlayerStartSpot. */
 capturedAnchorOpenAreaIncludes(cell:number):boolean;
}
const plants=new Map<string,0|1>();
for(const row of Object.values(WILD_PLANT_GENERATION_FACTS_256)){
 if(row.passability!=='Standable'&&row.passability!=='PassThroughOnly')throw Error('Unresolved wild plant physical fact');
 plants.set(row.species,row.passability==='PassThroughOnly'?1:0);
}
function plantPassability(resource:Resource):0|1 {
 if(resource.kind==='rock')throw Error('Unresolved historical Resource.rock has no actual Core ThingDef');
 if(resource.species!==undefined){const value=plants.get(resource.species);if(value===undefined)throw Error('Unresolved actual plant passability');return value;}
 // Actual cultivated species have unambiguous existing owner identities.
 if(resource.kind==='rice'||resource.kind==='potato'||resource.kind==='corn'||resource.kind==='cotton'||resource.kind==='healroot'||resource.kind==='haygrass'||resource.kind==='hops'||resource.kind==='devilstrand')return 0;
 throw Error('Actual wild plant is missing its species; no tree/berry substitution');
}
const structures=new Map<string,StartThingPhysics256>(Object.entries(START_STRUCTURE_PHYSICS_256));
function structurePhysics(kind:string):StartThingPhysics256 {
 const physics=structures.get(kind);if(!physics)throw Error('Unresolved actual structure physical definition');return physics;
}
/** Normal and Fence districts are cardinal same-type connected components.
 * Regions can be spatially split internally without changing this aggregate.
 * Portal is one cell. ImpassableFreeAirExchange/None are not GetDistrict's
 * default Set_Passable. This is not a standability or pawn reachability flood. */
export function captureActualLocalDistricts256(map:ActualStartMap256):ActualLocalDistrictCapture256 {
 const {width,height}=map;assertLocalDimensions256(width,height);const n=width*height;
 if(!isSchema256Or257(map.schemaVersion)||map.site?.revision!==3||map.tiles.length!==n)throw Error('Actual Site3 map required for prospective district capture');
 const walk=new Uint8Array(n),nonStand=new Uint8Array(n),edifice=new Uint8Array(n),door=new Uint8Array(n),fence=new Uint8Array(n),full=new Uint8Array(n),heavy=new Uint8Array(n),roof=new Uint8Array(n);
 const index=(cell:Cell)=>{if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=width||cell.z>=height)throw Error('Physical owner outside its actual map');return cell.z*width+cell.x;};
 const valid=(cell:number)=>Number.isInteger(cell)&&cell>=0&&cell<n;
 for(let i=0;i<n;i++){
  const tile=map.tiles[i]!;if(!tile||!terrainAvailable256(tile.terrain,map.schemaVersion))throw Error('Unresolved actual terrain physical definition');
  walk[i]=tile.bridge||tile.floor||naturalTerrainWalkable256(tile.terrain)?1:0;
  heavy[i]=terrainSupportsAffordance256(tile,'Heavy',map)?1:0;
  // Solid rock is a real Mineable owner above its retained substrate.
  if(tile.terrain==='rock'||tile.collapsedRock){walk[i]=0;nonStand[i]=edifice[i]=full[i]=1;}
 }
 for(const cell of roofCells(map)){if(!valid(cell))throw Error('Actual roof outside its map');roof[cell]=1;}
 const place=(cell:Cell,physics:StartThingPhysics256)=>{
  const i=index(cell);if(physics.passability===2)walk[i]=0;if(physics.passability!==0)nonStand[i]=1;
  if(physics.edifice){if(edifice[i])throw Error('Overlapping actual edifices lack a unique edifice owner');edifice[i]=1;if(physics.door)door[i]=1;if(physics.fence)fence[i]=1;}
  if(physics.fullFill)full[i]=1;
 };
 for(const structure of map.structures){const physics=structurePhysics(structure.kind);for(const cell of footprintCells(structure))place(cell,physics);}
 for(const job of map.jobs)if(job.construction==='frame'){
  // Terrain frames are Ethereal/Standable/non-edifice. A blueprint is not a Thing Frame.
  if(job.kind==='lay-floor'||job.kind==='build-bridge'){index(job);continue;}
  const kind=job.furniture?.kind??job.kind;if(!Object.hasOwn(START_STRUCTURE_PHYSICS_256,kind))throw Error('Unresolved actual construction Frame');
  const target=structurePhysics(kind);
  // Current frame generator inherits target passability capped at Through,
  // and isEdifice; it does NOT inherit Door class/isFence. fillPercent=.2.
  const physics:StartThingPhysics256={defId:'actual-frame',passability:target.passability===0?0:1,edifice:target.edifice,door:false,fence:false,fullFill:false};
  for(const cell of footprintCells(job))place(cell,physics);
 }
 for(const resource of map.resources){const i=index(resource);if(plantPassability(resource))nonStand[i]=1;}
 for(const pile of map.piles)if(pile.owner.type==='ground'){
  const i=index(pile.owner);if(pile.kind==='chunk')nonStand[i]=1;
  // Ordinary Item/Corpse owners are Standable; carried/job inventories are
  // not spawned and never borrow their container's cell.
 }
 for(const pack of map.packed)if(pack.owner.type==='ground')index(pack.owner);
 const types=new Uint8Array(n),ids=new Int32Array(n);ids.fill(-1);
 const summaries:ActualDistrictSummary256[]=[],queue=new Int32Array(n);
 let hasNoEdifice=false;
 for(let i=0;i<n;i++){
  if(!edifice[i])hasNoEdifice=true;
  types[i]=door[i]?4:fence[i]?8:walk[i]?2:full[i]?0:1;
 }
 for(let start=0;start<n;start++){
  const type=types[start]!;if(ids[start]!==-1||(type!==2&&type!==4&&type!==8))continue;
  const id=summaries.length;let head=0,tail=1,touchesMapEdge=false;queue[0]=start;ids[start]=id;
  const visit=(next:number)=>{if(ids[next]===-1&&types[next]===type){ids[next]=id;queue[tail++]=next;}};
  while(head<tail){
   const cell=queue[head++]!,x=cell%width,z=Math.floor(cell/width);if(x===0||z===0||x===width-1||z===height-1)touchesMapEdge=true;
   if(type===4)continue;
   if(z>0)visit(cell-width);if(x<width-1)visit(cell+1);if(z<height-1)visit(cell+width);if(x>0)visit(cell-1);
  }
  summaries.push(Object.freeze({id,type:type===2?'normal':type===4?'portal':'fence',touchesMapEdge,cellCount:tail}));
 }
 return Object.freeze({width,height,
  standable:(cell:number)=>valid(cell)&&!!walk[cell]&&!fence[cell]&&!nonStand[cell],
  normalWalkable:(cell:number)=>valid(cell)&&!!walk[cell],
  regionType:(cell:number):ActualRegionType256=>!valid(cell)?'none':types[cell]===2?'normal':types[cell]===4?'portal':types[cell]===8?'fence':types[cell]===1?'impassable-air':'none',
  district:(cell:number)=>valid(cell)&&ids[cell]!>=0?summaries[ids[cell]!]!:null,
  edifice:(cell:number)=>valid(cell)&&!!edifice[cell],heavy:(cell:number)=>valid(cell)&&!!heavy[cell],roofed:(cell:number)=>valid(cell)&&!!roof[cell],
  capturedAnchorOpenAreaIncludes:(cell:number)=>valid(cell)&&hasNoEdifice,
 });
}
