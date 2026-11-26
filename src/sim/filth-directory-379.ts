import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import {isFilthKind,type FilthKind,type FilthRecord} from './filth-rules.ts';
import type {RoomTopology} from './room-topology.ts';
import type {Cell,World} from './types.ts';

const EMPTY:readonly FilthRecord[]=Object.freeze([]);
interface Entry {cell:number;id:number}
interface RoomView {topology:RoomTopology;rooms:Map<number,FilthRecord[]>}
function sortedHas(cells:readonly number[],index:number):boolean {let lo=0,hi=cells.length;while(lo<hi){const mid=(lo+hi)>>>1;if(cells[mid]!<index)lo=mid+1;else hi=mid;}return cells[lo]===index;}
/** Private membership, not a cleanliness total. Every list keeps the source
 * array order; consumers still add the literal per-record values in that
 * order, so a fractional floor prefix retains its exact double result. */
class FilthDirectory379 {
 readonly entries=new Map<FilthRecord,Entry>();
 readonly byCell=new Map<number,FilthRecord[]>();
 readonly byId=new Map<number,FilthRecord>();
 private readonly views:RoomView[]=[];
 private homeSource:readonly number[]|undefined;
 private homeLength=-1;
 private homeRows:FilthRecord[]|undefined;
 count=0;
 constructor(readonly owner:object,public source:FilthRecord[],readonly width:number,readonly height:number){}
 private roomIds(topology:RoomTopology,cell:number):number[] {
  const label=topology.labelAt(cell);if(label!==undefined&&label>0)return [label];
  if(label!==-2)return [];
  const x=cell%this.width,z=Math.floor(cell/this.width),ids:number[]=[];
  const add=(i:number)=>{const id=topology.labelAt(i);if(id!==undefined&&id>0&&!ids.includes(id))ids.push(id);};
  if(x>0)add(cell-1);if(x+1<this.width)add(cell+1);if(z>0)add(cell-this.width);if(z+1<this.height)add(cell+this.width);return ids;
 }
 append(record:FilthRecord):boolean {
  if(this.entries.has(record)||this.byId.has(record.id)||!Number.isSafeInteger(record.id)||!isFilthKind(record.kind)
    ||!Number.isSafeInteger(record.x)||!Number.isSafeInteger(record.z)||record.x<0||record.z<0||record.x>=this.width||record.z>=this.height)return false;
  const cell=record.z*this.width+record.x;this.entries.set(record,{cell,id:record.id});this.byId.set(record.id,record);this.count++;
  const list=this.byCell.get(cell);if(list)list.push(record);else this.byCell.set(cell,[record]);
  if(this.homeRows&&this.homeSource&&sortedHas(this.homeSource,cell))this.homeRows.push(record);
  for(const view of this.views)for(const id of this.roomIds(view.topology,cell)){const rows=view.rooms.get(id);if(rows)rows.push(record);else view.rooms.set(id,[record]);}
  return true;
 }
 remove(record:FilthRecord):boolean {
  const entry=this.entries.get(record);if(!entry)return false;
  this.entries.delete(record);this.byId.delete(entry.id);this.count--;
  const list=this.byCell.get(entry.cell)!;list.splice(list.indexOf(record),1);if(!list.length)this.byCell.delete(entry.cell);
  if(this.homeRows&&this.homeSource&&sortedHas(this.homeSource,entry.cell)){const at=this.homeRows.indexOf(record);if(at>=0)this.homeRows.splice(at,1);}
  for(const view of this.views)for(const id of this.roomIds(view.topology,entry.cell)){const rows=view.rooms.get(id);if(rows){rows.splice(rows.indexOf(record),1);if(!rows.length)view.rooms.delete(id);}}
  return true;
 }
 room(topology:RoomTopology,id:number):readonly FilthRecord[] {
  let at=this.views.findIndex(view=>view.topology===topology),view=at<0?undefined:this.views[at];
  if(!view){
   view={topology,rooms:new Map()};
   for(const [record,entry] of this.entries)for(const room of this.roomIds(topology,entry.cell)){const rows=view.rooms.get(room);if(rows)rows.push(record);else view.rooms.set(room,[record]);}
   // Research and ordinary cleanliness own separate topology snapshots. Keep
   // just their two most recently used views, never a history of old maps.
   if(this.views.length===2)this.views.shift();this.views.push(view);
  }else if(at!==this.views.length-1){this.views.splice(at,1);this.views.push(view);}
  return view.rooms.get(id)??EMPTY;
 }
 home(source:readonly number[]|undefined):readonly FilthRecord[] {
  if(!source?.length)return EMPTY;
  // Every home-area producer assigns a fresh sorted array (engine commands
  // and initial scenarios); no home membership depends on a filth clock.
  if(this.homeSource!==source||this.homeLength!==source.length){
   const rows:FilthRecord[]=[];for(const [record,entry] of this.entries)if(sortedHas(source,entry.cell))rows.push(record);
   this.homeSource=source;this.homeLength=source.length;this.homeRows=rows;
  }
  if(verifyTerrainWriteCaches){let at=0;for(const [record,entry] of this.entries)if(sortedHas(source,entry.cell)&&this.homeRows![at++]!==record)throw Error('Closed home filth directory differs from the current area');if(at!==this.homeRows!.length)throw Error('Closed home filth directory differs from the current area');}
  return this.homeRows!;
 }
 verify():void {
  if(this.source.length!==this.count)throw Error('Closed filth directory lost membership');
  const expected=this.entries.entries();
  for(const record of this.source){const next=expected.next(),entry=next.value?.[1];
   if(next.done||next.value[0]!==record||entry!.id!==record.id||entry!.cell!==record.z*this.width+record.x||this.byId.get(record.id)!==record)throw Error('Closed filth directory differs from its source order or immutable geometry');
  }
  if(!expected.next().done)throw Error('Closed filth directory lost membership');
 }
}
const directories=new WeakMap<World,FilthDirectory379>();
/** Only the actual SIM owner may rely on the two audited membership writers.
 * Unknown arrays/lengths/owners rebuild; public callers retain native scans. */
function directory(world:World):FilthDirectory379|undefined {
 const owner=terrainJournalReadOwner(),source=world.filth?.items;if(!owner||!source)return;
 let cached=directories.get(world);
 if(!cached||cached.owner!==owner||cached.source!==source||cached.count!==source.length||cached.width!==world.width||cached.height!==world.height){
  cached=new FilthDirectory379(owner,source,world.width,world.height);
  for(const record of source)if(!cached.append(record)){directories.delete(world);return;}
  directories.set(world,cached);
 }
 if(verifyTerrainWriteCaches)cached.verify();return cached;
}
export function filthAtCell379(world:World,cell:Cell):readonly FilthRecord[] {
 const index=directory(world);return index?index.byCell.get(cell.z*world.width+cell.x)??EMPTY:(world.filth?.items??EMPTY).filter(record=>record.x===cell.x&&record.z===cell.z);
}
export function filthAtKind379(world:World,cell:Cell,kind:FilthKind):FilthRecord|undefined {
 const index=directory(world);return index?(index.byCell.get(cell.z*world.width+cell.x)??EMPTY).find(record=>record.kind===kind):world.filth?.items.find(record=>record.x===cell.x&&record.z===cell.z&&record.kind===kind);
}
export function filthById379(world:World,id:number):FilthRecord|undefined {const index=directory(world);return index?index.byId.get(id):world.filth?.items.find(record=>record.id===id);}
export function filthInRoom379(world:World,topology:RoomTopology,id:number):readonly FilthRecord[]|undefined {return directory(world)?.room(topology,id);}
export function filthInHome379(world:World):readonly FilthRecord[]|undefined {return directory(world)?.home(world.home);}
/** Called immediately after the real push, never before the identity commit. */
export function filthAppended379(world:World,record:FilthRecord):void {
 const cached=directories.get(world);if(!cached)return;const source=world.filth?.items;
 if(cached.owner!==terrainJournalReadOwner()||source!==cached.source||source.length!==cached.count+1||source.at(-1)!==record||!cached.append(record))directories.delete(world);
}
/** The literal filter above this call removed every occurrence of `record`.
 * An untracked source cannot transfer a directory to the new array. */
export function filthRemoved379(world:World,before:FilthRecord[],record:FilthRecord):void {
 const cached=directories.get(world);if(!cached)return;const source=world.filth?.items,found=cached.entries.has(record);
 if(cached.owner!==terrainJournalReadOwner()||cached.source!==before||cached.count!==before.length||!source||source.length!==cached.count-(found?1:0)){directories.delete(world);return;}
 if(found)cached.remove(record);cached.source=source;
}
