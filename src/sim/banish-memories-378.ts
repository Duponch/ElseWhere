import type {Pawn,World} from './types.ts';
import {campaignLivingObservers} from './campaign-people.ts';
import {isColonist} from './affiliation.ts';
/** Thought_Banished.ShouldDiscard after the same original really rejoins.
 * No relation, grief about mortal danger or other historical memory is erased. */
export function discardBanishMemoriesOnRejoin378(w:World,returned:Pawn):void {
 if(Number(w.schemaVersion)<378||!isColonist(returned))return;
 if(returned.identity378?.banishedAt!==undefined){delete returned.identity378.banishedAt;if(Object.keys(returned.identity378).length===1)delete returned.identity378;}
 for(const {pawn:p} of campaignLivingObservers(w)){
  if(!isColonist(p)||!p.roomMemories)continue;
  const next=p.roomMemories.filter(m=>m.otherId!==returned.id||m.kind!=='colonist-banished'&&m.kind!=='colonist-banished-to-die');
  if(next.length===p.roomMemories.length)continue;if(next.length)p.roomMemories=next;else delete p.roomMemories;
 }
}
