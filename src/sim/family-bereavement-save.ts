import {memoryExpiry271,validSuspendedMemory271} from './suspended-memory-271.ts';
import { captureRelationshipPeople } from './relationship-namespace.ts';
import { FAMILY_DEATH_DURATION,FAMILY_DEATH_LABELS,FAMILY_DEATH_LIMIT,type FamilyDeathKind,type FamilyDeathMemory } from './family-bereavement.ts';
import { captureRelationshipIndex,closestFamilyRelation,type RelationshipPeople,type RelationshipIndex } from './relationship-state.ts';
import type { World } from './types.ts';
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,lo:number,hi=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=lo&&value<=hi;
export function validFamilyBereavementShape(value:unknown,version:number,tick:number,civilTick=tick):value is FamilyDeathMemory[]|undefined {
  if(value===undefined)return true;
  if(version<195||!Array.isArray(value)||!value.length||value.length>5*FAMILY_DEATH_LIMIT)return false;
  const seen=new Set<number>(),counts=new Map<FamilyDeathKind,number>();
  for(const m of value){
    if(!object(m)||Object.keys(m).length!==3+Number(Object.hasOwn(m,'suspendedTicks'))+Number(Object.hasOwn(m,'banishedToDie378'))||Object.keys(m).some(k=>!['otherId','kind','at','suspendedTicks',...(version>=378?['banishedToDie378']:[])].includes(k))||Object.hasOwn(m,'banishedToDie378')&&m.banishedToDie378!==true||!validSuspendedMemory271(m,version,tick,Number(m.at))||!integer(m.otherId,1)||seen.has(m.otherId)
      ||typeof m.kind!=='string'||!Object.hasOwn(FAMILY_DEATH_LABELS,m.kind)||!integer(m.at,0,civilTick)||memoryExpiry271(m,m.at+FAMILY_DEATH_DURATION)<=Math.max(tick,m.at))return false;
    seen.add(m.otherId);const kind=m.kind as FamilyDeathKind,count=(counts.get(kind)??0)+1;counts.set(kind,count);if(count>FAMILY_DEATH_LIMIT)return false;
  }
  return true;
}
export function validFamilyBereavement(value:unknown,pawnId:number,version:number,world:World,people?:RelationshipPeople,activeTick=world.tick,civilTick=activeTick):boolean {
  if(!validFamilyBereavementShape(value,version,activeTick,civilTick))return false;
  if(value===undefined)return true;
  const known=people??captureRelationshipPeople(world);if(!known.has(pawnId))return false;
  const indexes=new Map<number,RelationshipIndex>();
  return value.every(memory=>{
    const deceased=known.get(memory.otherId);
    if(memory.otherId===pawnId||!deceased||(!memory.banishedToDie378&&(deceased.status!=='dead'||deceased.deathAt===undefined||memory.at<deceased.deathAt)))return false;
    const at=memory.banishedToDie378?memory.at:deceased.deathAt!;
    let index=indexes.get(at);
    if(!index){index=captureRelationshipIndex({links:(world.relationships?.links??[]).filter(link=>link.recordedAt<=at)});indexes.set(at,index);}
    return `${closestFamilyRelation(index,pawnId,memory.otherId)}-died`===memory.kind;
  });
}
