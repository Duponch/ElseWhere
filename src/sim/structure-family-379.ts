import {captureStructureNavigation,type StructureNavigationGeometry} from './structure-navigation.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {Structure,World} from './types.ts';

type StructureSource=Pick<World,'structures'>&Partial<Pick<World,'width'|'height'|'tiles'>>;
type KindPredicate=(kind:Structure['kind'])=>boolean;
interface Family {readonly accepts:KindPredicate;readonly rows:readonly Structure[]}
interface Directory {
 readonly owner:object;readonly view:World;
 geometry:StructureNavigationGeometry;
 readonly members:Structure[];
 readonly byKind:Map<Structure['kind'],number[]>;
 readonly families:Map<string,Family>;
 readonly ordinals:WeakMap<Structure,number>;
 readonly damaged:Map<Structure,number>;
 damagedRows?:readonly Structure[];
 checkedKinds?:Structure['kind'][];
}
const directories=new WeakMap<readonly Structure[],Directory>();
/** Unknown/public transactions cannot advance a closed membership witness. */
export function invalidateStructureFamily379(world:Pick<World,'structures'>):void {directories.delete(world.structures);}

function appendKinds(directory:Directory,from:number):void {
 const members=directory.members;
 for(let i=from;i<members.length;i++){const s=members[i]!,kind=s.kind,rows=directory.byKind.get(kind);if(rows)rows.push(i);else directory.byKind.set(kind,[i]);directory.ordinals.set(s,i);if(s.damage){directory.damaged.set(s,i);directory.damagedRows=undefined;}}
 if(verifyTerrainWriteCaches)directory.checkedKinds=members.map(s=>s.kind);
}
function verify(source:readonly Structure[],directory:Directory):void {
 const members=directory.members,kinds=directory.checkedKinds;
 if(members.length!==source.length||!kinds||source.some((s,i)=>s!==members[i]||s.kind!==kinds[i]))throw Error('Unmarked structure-family membership/kind write');
}

/** Ordered candidate superset for one immutable kind family. Keep the existing
 * kind/component predicate in the caller: public, partial and unknown owners
 * receive the live original collection and therefore retain all historical
 * malformed/type-edge behavior. Only the exclusive deserialized simulation
 * owner narrows its actual source membership. A name has one kind predicate.
 *
 * Geometry's append writer retains its immutable entry prefix. That producer
 * witness advances all resident families using only appended entries; unknown
 * edits rebuild. Earlier returned lists are never edited in place. */
export function structureFamily379(world:StructureSource,name:string,acceptsKind:KindPredicate):readonly Structure[] {
 const source=world.structures,owner=terrainJournalReadOwner();
 if(!owner||Object.getPrototypeOf(source)!==Array.prototype){directories.delete(source);return source;}
 let directory=directories.get(source);
 if(directory?.owner!==owner){directories.delete(source);directory=undefined;}
 const width=world.width??directory?.view.width,height=world.height??directory?.view.height;
 if(width===undefined||height===undefined||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)return source;
 // A partial projection may borrow an already witnessed original array. A
 // newly projected array needs its real full map before it can be enrolled.
 if(!directory&&(!world.tiles||world.tiles.length!==width*height))return source;
 const view=directory&&directory.view.width===width&&directory.view.height===height?directory.view:({structures:source,width,height} as World);
 const geometry=captureStructureNavigation(view);
 if(directory&&(directory.view.width!==width||directory.view.height!==height))directory=undefined;
 if(!directory||verifyTerrainWriteCaches&&!directory.checkedKinds){
  directory={owner,view:{structures:source,width,height} as World,geometry,members:source.slice(),byKind:new Map(),families:new Map(),ordinals:new WeakMap(),damaged:new Map()};appendKinds(directory,0);directories.set(source,directory);
 }else if(directory.geometry!==geometry){
  const previous=directory.geometry.entries,next=geometry.entries,count=previous.length;
  const append=next.length>=count&&(count===0||next[0]===previous[0]&&next[count-1]===previous[count-1]);
  if(!append){directory={owner,view:{structures:source,width,height} as World,geometry,members:source.slice(),byKind:new Map(),families:new Map(),ordinals:new WeakMap(),damaged:new Map()};appendKinds(directory,0);directories.set(source,directory);}
  else{
   directory.geometry=geometry;for(let i=count;i<source.length;i++)directory.members.push(source[i]!);appendKinds(directory,count);
   for(const [key,family] of directory.families){const added:Structure[]=[];for(let i=count;i<directory.members.length;i++){const s=directory.members[i]!;if(family.accepts(s.kind))added.push(s);}if(added.length)directory.families.set(key,{accepts:family.accepts,rows:[...family.rows,...added]});}
  }
 }
 if(verifyTerrainWriteCaches)verify(source,directory);
 let family=directory.families.get(name);
 if(!family){
  const ordinals:number[]=[];for(const [kind,indices] of directory.byKind)if(acceptsKind(kind))ordinals.push(...indices);
  ordinals.sort((a,b)=>a-b);family={accepts:acceptsKind,rows:ordinals.map(i=>directory!.members[i]!)};directory.families.set(name,family);
 }
 if(verifyTerrainWriteCaches){const expected=source.filter(s=>acceptsKind(s.kind));if(expected.length!==family.rows.length||expected.some((s,i)=>s!==family!.rows[i]))throw Error('Structure family differs from its independent ordered filter');}
 return family.rows;
}

/** Notification at a committed installed-building damage transition. Amount
 * changes while already damaged keep the same live row; only membership edits
 * rebuild its tiny ordered list. New/unknown arrays are read at first use. */
export function structureDamageChanged379(world:Pick<World,'structures'>,structure:Structure):void {
 const directory=directories.get(world.structures);if(!directory||directory.owner!==terrainJournalReadOwner())return;
 const ordinal=directory.ordinals.get(structure);if(ordinal===undefined||world.structures[ordinal]!==structure)return;
 if(structure.damage){if(!directory.damaged.has(structure)){directory.damaged.set(structure,ordinal);directory.damagedRows=undefined;}}
 else if(directory.damaged.delete(structure))directory.damagedRows=undefined;
}
const noKind=()=>false;
export function damagedStructures379(world:StructureSource):readonly Structure[] {
 structureFamily379(world,'damage-membership',noKind);
 const directory=directories.get(world.structures);if(!directory||directory.owner!==terrainJournalReadOwner())return world.structures;
 if(verifyTerrainWriteCaches){const expected=world.structures.filter(s=>!!s.damage);if(expected.length!==directory.damaged.size||expected.some(s=>!directory.damaged.has(s)))throw Error('Unmarked structure damage membership write');}
 return directory.damagedRows??=Array.from(directory.damaged).sort((a,b)=>a[1]-b[1]).map(([s])=>s);
}
