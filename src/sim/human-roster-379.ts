import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {Pawn} from './types.ts';

interface HumanRoster {
  owner:object;
  count:number;
  first?:Pawn;
  last?:Pawn;
  byId:Map<number,number>;
  queued:Pawn[];
}
const rosters=new WeakMap<readonly Pawn[],HumanRoster>();

// Actual arrivals append to the roster. Departures, map transfers and
// reordering replace the array. All identifiers belong to the original pawn.
function roster(rows:readonly Pawn[]):HumanRoster|undefined {
  const owner=terrainJournalReadOwner();
  if(!owner){rosters.delete(rows);return;}
  const cached=rosters.get(rows);
  if(cached?.owner===owner&&cached.count===rows.length&&cached.first===rows[0]&&cached.last===rows.at(-1))return cached;
  const byId=new Map<number,number>(),queued:Pawn[]=[];
  for(let i=0;i<rows.length;i++){
    const pawn=rows[i]!;
    if(!byId.has(pawn.id))byId.set(pawn.id,i);
    if(pawn.orderedQueue378?.length)queued.push(pawn);
  }
  const next={owner,count:rows.length,first:rows[0],last:rows.at(-1),byId,queued};
  rosters.set(rows,next);return next;
}

export function humanById379(rows:readonly Pawn[],id:unknown):Pawn|undefined {
  const index=roster(rows);
  if(!index)return rows.find(pawn=>pawn.id===id);
  const slot=index.byId.get(id as number),found=slot===undefined?undefined:rows[slot];
  if(found&&found.id!==id){rosters.delete(rows);return rows.find(pawn=>pawn.id===id);}
  if(verifyTerrainWriteCaches&&found!==rows.find(pawn=>pawn.id===id))throw Error('Human roster identity differs from live order');
  return found;
}

/** Creating the first queued order enrolls its owner. Cancellation and
 * hand-off may leave candidates in the list: readers examine the live queue.
 * Invalidating here also covers a temporary direct-order dispatch which
 * restores its tail after a reader saw an empty queue. */
export function markOrderedHuman379(rows:readonly Pawn[],pawn:Pawn):void {
  const current=rosters.get(rows);
  if(current&&!current.queued.includes(pawn))rosters.delete(rows);
}
export function orderedHumanCandidates379(rows:readonly Pawn[]):readonly Pawn[] {
  const index=roster(rows);if(!index)return rows;
  if(verifyTerrainWriteCaches){
    const expected=rows.filter(pawn=>pawn.orderedQueue378?.length);
    const actual=index.queued.filter(pawn=>pawn.orderedQueue378?.length);
    if(actual.length!==expected.length||actual.some((pawn,i)=>pawn!==expected[i]))throw Error('Unmarked future order or human roster change');
  }
  return index.queued;
}
