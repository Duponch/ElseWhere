import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {ThermalRegion} from './temperature.ts';
import type {World} from './types.ts';

const EMPTY:ThermalRegion[]=[];
interface Owners {owner:object;width:number;height:number;regions:ThermalRegion[];cells:number[][];snapshots:number[][];slots:Int32Array}
const bindings=new WeakMap<World,Owners>();
export interface ThermalCellOwners379 {readonly regions:readonly ThermalRegion[];readonly slots:Int32Array}
/** Actual thermal geometry is replaced by reconcileTemperature, explosions
 * and roof transactions. Cell lists are never edited in place by a running
 * map. Only their ownership is retained here: temperatures remain live on the
 * current region objects, or are captured separately by a snapshot reader.
 * Public mutable Worlds keep their complete original construction. */
export function thermalCellOwners379(world:World):ThermalCellOwners379|undefined {
 const owner=terrainJournalReadOwner();if(!owner)return;
 const regions=world.thermal?.regions??EMPTY,size=world.width*world.height;let cached=bindings.get(world);
 if(!Number.isSafeInteger(size)||size<0)return;
 if(cached&&cached.owner===owner&&cached.width===world.width&&cached.height===world.height){
  // Some heat projections replace region records but deliberately retain the
  // immutable cell arrays. Those records inherit the same owner slots.
  if(cached.regions===regions||cached.cells.length===regions.length&&regions.every((r,i)=>r.cells===cached!.cells[i]&&r.cells.length===cached!.snapshots[i]!.length)){
   if(verifyTerrainWriteCaches){
    if(regions.length!==cached.snapshots.length||regions.some((r,i)=>r.cells.length!==cached!.snapshots[i]!.length||r.cells.some((cell,k)=>cell!==cached!.snapshots[i]![k])))throw Error('Unobserved thermal cell ownership mutation under a closed map owner');
   }
   cached.regions=regions;return cached;
  }
 }
 const slots=new Int32Array(size);
 for(let k=0;k<regions.length;k++)for(const cell of regions[k]!.cells){
  if(!Number.isInteger(cell)||cell<0||cell>=size){bindings.delete(world);return;}
  slots[cell]=k+1; // Last region wins, as in the public Map/point readers.
 }
 cached={owner,width:world.width,height:world.height,regions,cells:regions.map(r=>r.cells),snapshots:regions.map(r=>r.cells.slice()),slots};bindings.set(world,cached);return cached;
}
