import {memoryExpiry271,validSuspendedMemory271} from './suspended-memory-271.ts';
import type { RelationshipPeople } from './relationship-state.ts';
import { deathMemoryDuration,type DeathMemoryKind } from './bereavement.ts';
import type { Pawn, World } from './types.ts';
import { isColonist } from './affiliation.ts';

const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min:number,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;

/** A sparse, prospective record: past deaths never acquire a thought on load. */
function validMemories(value:unknown,observer:Pawn|undefined,pawnId:number,version:number,tick:number,deathTick:(id:number)=>number|undefined,civilTick=tick,known?:(id:number)=>boolean):boolean {
  if(value===undefined)return true;
  if(version<170||!Array.isArray(value)||value.length<1||value.length>10||!observer||!isColonist(observer)&&!(version>=378&&observer.identity378?.banishedAt!==undefined)||observer.prisoner&&version<213)return false;
  const seen=new Set<number>();let friends=0,rivals=0;
  for(const memory of value){
    if(!object(memory)||Object.keys(memory).length!==4+Number(Object.hasOwn(memory,'suspendedTicks'))+Number(Object.hasOwn(memory,'banishedToDie378'))||Object.keys(memory).some(key=>!['otherId','kind','at','opinion','suspendedTicks',...(version>=378?['banishedToDie378']:[])].includes(key))||Object.hasOwn(memory,'banishedToDie378')&&memory.banishedToDie378!==true||!validSuspendedMemory271(memory,version,tick,Number(memory.at))
      ||!integer(memory.otherId,1)||memory.otherId===pawnId||seen.has(memory.otherId)
      ||(memory.kind!=='friend-died'&&memory.kind!=='rival-died')
      ||!integer(memory.at,0,civilTick)||!integer(memory.opinion,-100,100))return false;
    const deathAt=deathTick(memory.otherId as number);
    if(memory.banishedToDie378?version<378||!known?.(memory.otherId as number):deathAt===undefined||memory.at<deathAt)return false;
    const kind=memory.kind as DeathMemoryKind;
    if(kind==='friend-died'?(memory.opinion as number)<20:(memory.opinion as number)>-20)return false;
    if(memoryExpiry271(memory,memory.at+deathMemoryDuration(kind))<=Math.max(tick,memory.at))return false;
    seen.add(memory.otherId);
    if(kind==='friend-died')friends++;else rivals++;
    if(friends>5||rivals>5)return false;
  }
  return true;
}

export function validBereavement(value:unknown,pawnId:number,version:number,world:Pick<World,'pawns'|'tick'>,people?:RelationshipPeople):boolean {
  return validMemories(value,world.pawns.find(p=>p.id===pawnId),pawnId,version,world.tick,id=>{
    const known=people?.get(id),p=world.pawns.find(p=>p.id===id);
    return known?.status==='dead'?known.deathAt:p?.state==='dead'?p.health?.death?.tick:undefined;
  },world.tick,id=>!!people?.has(id)||world.pawns.some(p=>p.id===id));
}
export function validHumanBereavement(value:unknown,observer:Pawn,version:number,tick:number,people:RelationshipPeople,civilTick=tick):boolean {
  return validMemories(value,observer,observer.id,version,tick,id=>{const p=people.get(id);return p?.status==='dead'?p.deathAt:undefined;},civilTick,id=>people.has(id));
}
