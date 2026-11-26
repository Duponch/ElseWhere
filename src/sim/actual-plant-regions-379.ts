import {PlantSpatialRegions256} from './wild-plant-spatial-regions-256.ts';
import {peekStructureMembershipToken} from './structure-navigation.ts';
import {roofIdentity,roofKindAt,sameRoofIdentity,type RoofIdentity} from './roof-rules.ts';
import {readNaturalPlantSubstrate256,terrainIsWater256} from './natural-terrain-runtime-256.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {captureTerrainReadCursor,readTerrainJournal,verifyTerrainWriteCaches,type TerrainJournalCursor} from './terrain-mutation-journal.ts';
import type {World} from './types.ts';

const f=Math.fround,BLOCKED=1,FULL=2,DOOR=16,FENCE=32;
interface Input {type:number;base:number;walkable:boolean}
/** Region inputs exclude ordinary occupancy and planting refusal: every
 * resource, item and construction Frame has fill below1. Only real structure
 * geometry and the physical terrain/roof can affect regions or their ordered
 * fertility sum. The composition checks that static catalog fact first. */
class ActualPlantRegions379 {
 readonly regions:PlantSpatialRegions256;
 readonly inputs:((Input|undefined)[]|undefined)[];
 readonly observed:number[]=[];
 bits:Uint8Array;
 readonly patchable:boolean;
 cursor:TerrainJournalCursor;
 constructor(readonly world:World,readonly owner:object,public token:object,readonly roofs:RoofIdentity,readonly tiles:World['tiles'],readonly width:number,readonly height:number,readonly ignoresFertility:boolean,writes:Int32Array|Uint8Array){
  // The runtime passes its immutable structural mask; the legacy public
  // literal write-list reader still copies and validates its own input.
  this.patchable=writes instanceof Uint8Array;
  this.bits=writes instanceof Uint8Array?writes:new Uint8Array(width*height);
  this.inputs=new Array(Math.ceil(width*height/256));
  if(writes instanceof Int32Array)for(let k=0;k<writes.length;k+=2){const c=writes[k]!;this.bits[c]=this.bits[c]!|writes[k+1]!;}
  this.cursor=captureTerrainReadCursor(tiles);
  this.regions=new PlantSpatialRegions256(width,height,c=>this.at(c).type,c=>this.at(c).base);
 }
 read(cell:number,mask=this.bits):Input {
  const tile=this.world.tiles[cell];if(!tile)throw Error('Actual plant terrain is absent');
  const substrate=readNaturalPlantSubstrate256(tile),roof=roofKindAt(this.world,cell),bits=mask[cell]!,solid=tile.terrain==='rock'||!!tile.collapsedRock;
  const normal=!!(tile.bridge||tile.floor||naturalTerrainWalkable256(tile.terrain))&&!solid&&!(bits&BLOCKED),door=!!(bits&DOOR);
  const fertility=f(substrate.fertility),snowDepth=f(tile.snowDepth??0),water=terrainIsWater256(tile.terrain);
  if(!Number.isFinite(fertility)||fertility<0||!Number.isFinite(snowDepth)||snowDepth<0)throw Error('Invalid actual spatial plant cell');
  let base=fertility;if(roof==='natural-thin'||roof==='natural-thick')base=f(base*.5);
  if(this.ignoresFertility&&!tile.bridge&&!tile.floor&&water&&base<=0)base=f(.1);
  return {type:door?2:bits&FENCE?3:normal?1:solid||bits&FULL?0:4,base,walkable:normal&&!door};
 }
 peek(cell:number):Input|undefined {return this.inputs[cell>>>8]?.[cell&255];}
 at(cell:number):Input {
  let page=this.inputs[cell>>>8],input=page?.[cell&255];
  if(!input){input=this.read(cell);if(!page){page=new Array(256);this.inputs[cell>>>8]=page;}page[cell&255]=input;this.observed.push(cell);}return input;
 }
 readonly walkableNoDoorAt=(cell:number):boolean=>this.at(cell).walkable;
 /** Only region-affecting bits can alter a captured region. The producer
  * passes immutable masks; future unobserved chunks read the new mask on
  * their first query. Already observed changes regenerate only their chunk. */
 updateInputs(bits:Uint8Array,token:object,cells:readonly number[]):void {
  if(bits===this.bits&&!cells.length){this.token=token;return;}
  const changed=new Set<number>(cells);
  if(bits!==this.bits)for(const cell of this.observed)if(((bits[cell]!^this.bits[cell]!)&(BLOCKED|FULL|DOOR|FENCE))!==0)changed.add(cell);
  // Validate every changed input before committing any of them. A refused
  // malformed tile must not leave a partially replaced mask, with old region
  // slots falsely certifying one of the already visited replacements.
  const dirty:number[]=[],updates:Input[]=[];
  for(const cell of changed){
   const old=this.peek(cell);if(!old)continue;
   const input=this.read(cell,bits);if(same(old,input))continue;
   dirty.push(cell);updates.push(input);
  }
  this.bits=bits;this.token=token;
  for(let k=0;k<dirty.length;k++){const cell=dirty[k]!;this.inputs[cell>>>8]![cell&255]=updates[k]!;}
  if(dirty.length)this.regions.invalidateAt(dirty);
 }
}
const bindings=new WeakMap<World,ActualPlantRegions379>();
const same=(a:Input,b:Input)=>a.type===b.type&&Object.is(a.base,b.base)&&a.walkable===b.walkable;
/** Closed map owner only. Changed marked cells revalidate just the regional
 * inputs already observed; future chunks read their current physical cells.
 * Unknown/bulk history, roofs, structures or authority changes start a fresh
 * topology. No decision, candidate, draw or plant-count cache is retained. */
export function actualPlantRegions379(world:World,writes:Int32Array|Uint8Array,ignoresFertility:boolean):Pick<ActualPlantRegions379,'regions'|'walkableNoDoorAt'>|undefined {
 const owner=terrainJournalReadOwner(),token=owner&&peekStructureMembershipToken(world);if(!owner||!token)return;
 const roofs=roofIdentity(world);let binding=bindings.get(world);
 if(binding&&binding.owner===owner&&binding.tiles===world.tiles&&binding.width===world.width&&binding.height===world.height&&binding.ignoresFertility===ignoresFertility&&sameRoofIdentity(binding.roofs,roofs)
   &&(binding.token===token||binding.patchable&&writes instanceof Uint8Array&&writes.length===binding.bits.length)){
  const delta=readTerrainJournal(world.tiles,binding.cursor);let valid=!!delta;
  if(delta){
   if(binding.patchable&&writes instanceof Uint8Array&&writes.length===binding.bits.length){
    binding.updateInputs(writes,token,delta.indices);
    if(verifyTerrainWriteCaches)for(const cell of binding.observed)if(!same(binding.peek(cell)!,binding.read(cell)))throw Error('Unmarked plant region input mutation under a closed terrain proof');
    binding.cursor=delta.cursor;return binding;
   }
   for(const cell of delta.indices){const old=binding.peek(cell);if(old&&!same(old,binding.read(cell))){valid=false;break;}}
   if(valid&&verifyTerrainWriteCaches)for(const cell of binding.observed)if(!same(binding.peek(cell)!,binding.read(cell)))throw Error('Unmarked plant region input mutation under a closed terrain proof');
   if(valid){binding.cursor=delta.cursor;return binding;}
  }
 }
 binding=new ActualPlantRegions379(world,owner,token,roofs,world.tiles,world.width,world.height,ignoresFertility,writes);bindings.set(world,binding);return binding;
}
