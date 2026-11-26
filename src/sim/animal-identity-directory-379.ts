import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

interface Directory {owner:object;count:number;first:WildAnimal|undefined;last:WildAnimal|undefined;ids:Map<unknown,WildAnimal>}
const directories=new WeakMap<readonly WildAnimal[],Directory>();
/** Actual fauna producers push new originals, splice removals or replace the
 * entire array. They never replace an array slot or edit a resident id. With
 * those audited operations, equal length/first/last identify equal ordered
 * members (a replacement append changes the tail). Public Worlds retain the
 * literal first-match scan, including unmarked slot and id edits. */
export function animalById379(world:World,id:unknown):WildAnimal|undefined {
 const source=world.wildlife?.animals;if(!source)return;
 const owner=terrainJournalReadOwner();if(!owner)return source.find(animal=>animal.id===id);
 // Map uses SameValueZero; the original strict find never matches NaN.
 if(id!==id)return;
 let index=directories.get(source);
 if(!index||index.owner!==owner||index.count!==source.length||index.first!==source[0]||index.last!==source[source.length-1]){
  const ids=new Map<unknown,WildAnimal>();for(const animal of source)if(!ids.has(animal.id))ids.set(animal.id,animal);
  index={owner,count:source.length,first:source[0],last:source[source.length-1],ids};directories.set(source,index);
 }
 const result=index.ids.get(id);
 if(verifyTerrainWriteCaches&&result!==source.find(animal=>animal.id===id))throw Error('Closed animal identity directory differs from the first matching original');
 return result;
}
