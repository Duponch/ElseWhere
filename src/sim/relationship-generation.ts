import {isTraitsSchema361} from './traits.ts';
import { arrivalRandom } from './arrival-state.ts';
import { factionOf,isColonist } from './affiliation.ts';
import { HUMAN_YEAR_TICKS,validHumanAge,type HumanAge } from './human-age.ts';
import { captureRelationshipPeople } from './relationship-namespace.ts';
import { relationshipIndex,tryAddRelationship } from './relationship-runtime.ts';
import { validOfferedRelationship } from './relationship-save.ts';
import { MAX_RELATIONSHIP_LINKS,RELATIONSHIP_VERSION,areCloseKin,livingPartnerId,parentAgeFactor,
  type OfferedRelationship,type RelationshipAge,type RelationshipLink,type RelationshipState } from './relationship-state.ts';
import type { Pawn,World } from './types.ts';

// Local prospective pacing, not the Core relation definition's generation weight.
export const INITIAL_COUPLE_CHANCE=.2;
export const OFFERED_FAMILY_CHANCE=.2;
export interface WeightedOfferedRelationship { relationship:OfferedRelationship;weight:number }
const ageYears=(age:HumanAge):RelationshipAge=>({biologicalYears:age.biologicalTicks/HUMAN_YEAR_TICKS,chronologicalYears:age.chronologicalTicks/HUMAN_YEAR_TICKS});

/** Original people with real recorded ages. Lightweight raid/prison departure
 * identities remain known to the graph but cannot supply an invented age. */
function agedPeople(w:World):Map<number,Pawn> {
  const people=captureRelationshipPeople(w),owners=[...w.pawns,
    ...(w.scout&&'pawn' in w.scout?[w.scout.pawn]:[]),...(w.commercialTrip&&'pawn' in w.commercialTrip?[w.commercialTrip.pawn]:[]),
    ...(w.visitors?.departed??[]).map(d=>d.pawn),...(w.podRescues?.departed??[]).map(d=>d.pawn)];
  return new Map(owners.filter(p=>people.has(p.id)&&p.age!==undefined&&validHumanAge(p.age,w.schemaVersion)).map(p=>[p.id,p]));
}
/** All candidates precede the family draws. A fresh owner has no ancestry or
 * partner yet; the existing sibling component supplies at most two parents. */
export function relationshipOfferCandidates(w:World,age:HumanAge):WeightedOfferedRelationship[] {
  if(w.schemaVersion<RELATIONSHIP_VERSION||age===undefined||!validHumanAge(age,w.schemaVersion)
    ||!Number.isSafeInteger(w.nextId+2)||(w.relationships?.links.length??0)>=MAX_RELATIONSHIP_LINKS)return [];
  const index=relationshipIndex(w),people=agedPeople(w),candidateAge=ageYears(age),plans:WeightedOfferedRelationship[]=[];
  for(const other of [...people.values()].sort((a,b)=>a.id-b.id)){
    const otherAge=ageYears(other.age!),parents=index.parents(other.id);
    // Core's existing faction distinction is represented; request/technology,
    // fertility and orientation factors absent locally stay explicitly neutral.
    const base=factionOf(other)==='colony'?1:factionOf(other)==='outlaws'?.65*.7:.65;
    const parent=parentAgeFactor(otherAge,candidateAge),child=parents.length<2?parentAgeFactor(candidateAge,otherAge):0;
    if(parent>0)plans.push({relationship:{kind:'parent',otherId:other.id},weight:base*parent});
    if(child>0)plans.push({relationship:{kind:'child',otherId:other.id},weight:base*child});
    const gap=Math.abs(candidateAge.chronologicalYears-otherAge.chronologicalYears);
    let sibling=.4*(gap>40?.2:gap>10?.65:1);
    for(const id of parents){const known=people.get(id);sibling*=known?parentAgeFactor(ageYears(known.age!),candidateAge):0;}
    if(sibling>0)plans.push({relationship:{kind:'sibling',otherId:other.id},weight:base*sibling});
  }
  return plans;
}
export function chooseOfferedRelationship(plans:readonly WeightedOfferedRelationship[],random:{rng:number}):OfferedRelationship|undefined {
  if(!plans.length)return;
  if(arrivalRandom(random)>=OFFERED_FAMILY_CHANCE)return;
  const total=plans.reduce((n,p)=>n+p.weight,0);let remaining=arrivalRandom(random)*total;
  for(const plan of plans){remaining-=plan.weight;if(remaining<0)return {...plan.relationship};}
  return {...plans.at(-1)!.relationship};
}
export function offeredRelationshipLink(candidateId:number,relationship:OfferedRelationship,tick:number):RelationshipLink {
  return relationship.kind==='parent'?{kind:'parent',aId:candidateId,bId:relationship.otherId,recordedAt:tick}:
    relationship.kind==='child'?{kind:'parent',aId:relationship.otherId,bId:candidateId,recordedAt:tick}:
      {kind:'sibling',aId:Math.min(candidateId,relationship.otherId),bId:Math.max(candidateId,relationship.otherId),recordedAt:tick};
}
/** Undefined means a historical/unrelated offer; null means a conflict. Only a
 * temporary World receives the proposed human and the validated graph. */
export function prepareRelationshipAdmission(w:World,pawn:Pawn,relationship?:OfferedRelationship):RelationshipState|undefined|null {
  if(relationship===undefined)return;
  if(!validOfferedRelationship(relationship,w.schemaVersion)||pawn.id!==w.nextId||!Number.isSafeInteger(w.nextId+2))return null;
  const draft:World={...w,nextId:w.nextId+2,pawns:[...w.pawns,pawn]};
  return tryAddRelationship(draft,offeredRelationshipLink(pawn.id,relationship,w.tick))?draft.relationships!:null;
}
/** New-game only. Core's generation age factors are distinct from spontaneous
 * romance's age curve/selection threshold; direct close family is excluded. */
export function initializeCampRelationships(w:World):void {
  if(w.schemaVersion<RELATIONSHIP_VERSION)return;
  const people=captureRelationshipPeople(w),index=relationshipIndex(w),adults=w.pawns.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead'
    &&p.age&&p.age.biologicalTicks>=18*HUMAN_YEAR_TICKS&&!livingPartnerId(index,people,p.id)).sort((a,b)=>a.id-b.id);
  const plans:{link:RelationshipLink;weight:number}[]=[];
  for(let i=0;i<adults.length;i++)for(let j=i+1;j<adults.length;j++){
    const a=adults[i]!,b=adults[j]!;
    if(areCloseKin(index,a.id,b.id))continue;
    const aAge=a.age!.biologicalTicks/HUMAN_YEAR_TICKS,bAge=b.age!.biologicalTicks/HUMAN_YEAR_TICKS,gap=Math.abs(aAge-bAge);
    if(gap>40)continue;
    const weight=Math.min(1,(aAge-14)/13)*Math.min(1,(bAge-14)/13)*Math.max(.001,1-.999*gap/20)*(index.knownBloodRelated(a.id,b.id)?.01:1);
    for(const [kind,factor] of [['lover',.35],['spouse',.4]] as const)plans.push({link:{kind,aId:a.id,bId:b.id,recordedAt:w.tick},weight:weight*factor});
  }
  if(!plans.length)return;
  const random={rng:((w.seed^0x214c017)>>>0)||1};
  if(arrivalRandom(random)>=INITIAL_COUPLE_CHANCE)return;
  let remaining=arrivalRandom(random)*plans.reduce((n,p)=>n+p.weight,0),selected=plans.at(-1)!;
  for(const plan of plans){remaining-=plan.weight;if(remaining<0){selected=plan;break;}}
  if(!tryAddRelationship(w,selected.link))throw Error('Initial relationship contradicted its prepared graph.');
}

/** Prospective chooser graph for the three selected candidates. The finite
 * couple rule is the same local pacing/age weighting as ordinary new camps,
 * but its endpoints are candidate identities, not future Thing allocations.
 * Sorting identities makes reorder alone preserve the advertised couple. No
 * relatives, off-map people or links to candidates left behind are invented. */
export function generateStartingCandidateRelationships(seed:number,people:readonly (Pick<Pawn,'id'|'age'>&Partial<Pick<Pawn,'traits'|'appearance'>>)[],version=0):RelationshipState {
  const adults=people.filter(p=>p.age&&p.age.biologicalTicks>=18*HUMAN_YEAR_TICKS).slice().sort((a,b)=>a.id-b.id);
  const plans:{link:RelationshipLink;weight:number}[]=[];
  for(let i=0;i<adults.length;i++)for(let j=i+1;j<adults.length;j++){
    const a=adults[i]!,b=adults[j]!;
    // Schema 361: Core LovePartnerRelationGenerationChance, the earlier
    // person as `other`: same sex only with a gay other, never otherwise.
    if(isTraitsSchema361(version)&&a.appearance&&b.appearance&&(a.appearance.sex===b.appearance.sex)!==!!a.traits?.includes('gay'))continue;
    const aAge=a.age!.biologicalTicks/HUMAN_YEAR_TICKS,bAge=b.age!.biologicalTicks/HUMAN_YEAR_TICKS,gap=Math.abs(aAge-bAge);
    if(gap>40)continue;
    const weight=Math.min(1,(aAge-14)/13)*Math.min(1,(bAge-14)/13)*Math.max(.001,1-.999*gap/20);
    for(const [kind,factor] of [['lover',.35],['spouse',.4]] as const)plans.push({link:{kind,aId:a.id,bId:b.id,recordedAt:0},weight:weight*factor});
  }
  if(!plans.length)return {links:[]};
  const random={rng:((seed^0x214c017)>>>0)||1};
  if(arrivalRandom(random)>=INITIAL_COUPLE_CHANCE)return {links:[]};
  let remaining=arrivalRandom(random)*plans.reduce((n,p)=>n+p.weight,0),selected=plans.at(-1)!;
  for(const plan of plans){remaining-=plan.weight;if(remaining<0){selected=plan;break;}}
  return {links:[{...selected.link}]};
}
