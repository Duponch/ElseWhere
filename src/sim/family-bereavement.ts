import {memoryExpiry271,memoryReadTick271} from './suspended-memory-271.ts';
import { captureHumanOwners } from './human-owners.ts';
import { campaignLivingObservers } from './campaign-people.ts';
import { isColonist } from './affiliation.ts';
import { captureRelationshipPeople } from './relationship-namespace.ts';
import { relationshipIndex } from './relationship-runtime.ts';
import { captureRelationshipIndex,closestFamilyRelation,FAMILY_DEATH_MOOD,type FamilyDeathRelation } from './relationship-state.ts';
import { TICKS_PER_DAY,type Pawn,type World } from './types.ts';
import type { MoodThought } from './mood.ts';

export type FamilyDeathKind=`${FamilyDeathRelation}-died`;
export interface FamilyDeathMemory {otherId:number;kind:FamilyDeathKind;at:number;suspendedTicks?:number;banishedToDie378?:true}
export const FAMILY_DEATH_DURATION=30*TICKS_PER_DAY,FAMILY_DEATH_LIMIT=10;
export const FAMILY_DEATH_LABELS:Readonly<Record<FamilyDeathKind,string>>=Object.freeze({
  'parent-died':'parent','child-died':'enfant','sibling-died':'fratrie','lover-died':'partenaire','spouse-died':'conjoint',
});
export const familyDeathOffset=(kind:FamilyDeathKind):number=>FAMILY_DEATH_MOOD[kind.slice(0,-5) as FamilyDeathRelation];
export function expireFamilyBereavement(pawn:Pawn,tick:number):void {
  if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))return;
  if(!pawn.familyBereavement?.some(m=>memoryExpiry271(m,m.at+FAMILY_DEATH_DURATION)<=tick))return;
  pawn.familyBereavement=pawn.familyBereavement.filter(m=>memoryExpiry271(m,m.at+FAMILY_DEATH_DURATION)>tick);
  if(!pawn.familyBereavement.length)delete pawn.familyBereavement;
}
/** Only the real clinical death transition calls this producer. No load,
 * admission, grave or destruction can replay an old death. */
export function notifyFamilyDeath(world:World,deceased:Pawn):void {
  if(world.schemaVersion<195||!world.relationships?.links.length||deceased.state!=='dead'||!deceased.health?.death)return;
  const owners=captureHumanOwners(world);if(owners.byId.get(deceased.id)?.pawn!==deceased)return;
  const deathAt=deceased.health.death.tick,links=world.relationships.links;
  const index=links.some(link=>link.recordedAt>deathAt)?captureRelationshipIndex({links:links.filter(link=>link.recordedAt<=deathAt)}):relationshipIndex(world);
  for(const {pawn:p} of campaignLivingObservers(world)){
    if(p===deceased||!isColonist(p)||p.prisoner||p.visitor||p.state==='dead')continue;
    expireFamilyBereavement(p,world.tick);
    if(p.familyBereavement?.some(m=>m.otherId===deceased.id))continue;
    const relation=closestFamilyRelation(index,p.id,deceased.id);if(!relation)continue;
    const kind:FamilyDeathKind=`${relation}-died`,memories=(p.familyBereavement ??= []),same=memories.filter(m=>m.kind===kind);
    if(same.length>=FAMILY_DEATH_LIMIT){
      const oldest=same.reduce((a,b)=>a.at<b.at||a.at===b.at&&a.otherId<b.otherId?a:b),n=memories.indexOf(oldest);if(n>=0)memories.splice(n,1);
    }
    memories.push({otherId:deceased.id,kind,at:world.tick});
  }
}
export function familyBereavementThoughts(world:World,pawn:Pawn):MoodThought[] {return familyBereavementThoughtsAt(pawn,world.tick,captureRelationshipPeople(world));}
export function familyBereavementThoughtsAt(pawn:Pawn,tick:number,people:Pick<ReadonlyMap<number,{readonly name:string}>,'get'>):MoodThought[] {
  tick=memoryReadTick271(pawn,tick);
  if(!pawn.familyBereavement)return [];
  const groups=new Map<string,FamilyDeathMemory[]>();
  for(const m of pawn.familyBereavement){
    if(memoryExpiry271(m,m.at+FAMILY_DEATH_DURATION)<=tick)continue;
    const key=`${m.kind}:${people.get(m.otherId)?.name??'cette personne'}`,group=groups.get(key)??[];group.push(m);groups.set(key,group);
  }
  return [...groups.values()].map<MoodThought>(group=>{
    const memory=group[0]!,name=people.get(memory.otherId)?.name??'cette personne';
    return {id:`family-${memory.kind}-${memory.otherId}`,label:`Mort de ${name} (${FAMILY_DEATH_LABELS[memory.kind]})${group.length>1?` ×${group.length}`:''}`,
      offset:familyDeathOffset(memory.kind)*(1-.75**group.length)/.25,kind:'memory',expiresAt:Math.min(...group.map(m=>memoryExpiry271(m,m.at+FAMILY_DEATH_DURATION))),
      description:'Décès réel d’un proche ; lien capturé à la mort, distinct du souvenir d’un ami ou rival, durant trente jours.'};
  });
}
