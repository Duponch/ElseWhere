import { pawnBody } from './health-rules.ts';
import { appearanceOf } from './pawn-appearance.ts';
import { artificialPartCount361,pawnBeauty361,traitDegree } from './traits.ts';
import {coreAlzheimerNullifies382} from './human-alzheimer-382.ts';
import {coreSocialSituationIndex382} from './core-thought-indices-382.ts';
import type { Pawn,World } from './types.ts';

/** Schema 361: the situational social thoughts of the Core trait set
 * (Thoughts_Situation_Social), each a fixed opinion offset while the cause
 * lasts. Numbers and conditions from Core ThoughtDefs and ThoughtWorkers:
 * - Pretty +20 / +40 (beauty 1 / 2), Ugly -20 / -40 (beauty -1 / -2): not
 *   for a blind observer, nullified by Kind and Ascetic;
 * - AnnoyingVoice and CreepyBreathing -25: an observer who hears, not Kind;
 * - Man / Woman -25: a misandrist / misogynist observer, by the other's sex;
 * - TranshumanistAppreciation +8 per artificial part, BodyPuristDisgust -8
 *   per part (five stages, at most 40);
 * - HardWorkerVsLazy: a hard worker or industrious observer, -5 / -20 / -30
 *   for a neutral / lazy / slothful other (none for another hard worker);
 * - TeetotalerVsChemicalInterest and ChemicalInterestVsTeetotaler: -20
 *   (interest) or -30 (fascination), both ways.
 * Only between people who know each other (same faction or a shared cause). */
export interface TraitOpinionCause361 {kind:`trait-${string}`;count:1;value:number;nextChange:number;label:string;description:string}
const cause=(id:string,value:number,label:string,description:string):TraitOpinionCause361=>({kind:`trait-${id}`,count:1,value,nextChange:Infinity,label,description});

/** World pawns by id: the array position is remembered and checked on every
 * read, so a moved or replaced entry is found again (no stale person). */
const positions=new WeakMap<readonly Pawn[],Map<number,number>>();
export function pawnById361(world:World,id:number):Pawn|undefined {
  let map=positions.get(world.pawns);let index=map?.get(id);
  if(index===undefined||world.pawns[index]?.id!==id){map=new Map(world.pawns.map((p,i)=>[p.id,i]));positions.set(world.pawns,map);index=map.get(id);}
  return index===undefined?undefined:world.pawns[index];
}
export function traitOpinionCauses361(world:World,pawn:Pawn,other:Pawn,known:boolean):TraitOpinionCause361[] {
  if(!known||other===pawn||other.state==='dead')return [];
  const out:TraitOpinionCause361[]=[],mine=pawn.traits??[],theirs=other.traits??[];
  const beauty=pawnBeauty361(other);
  if(beauty&&!mine.includes('kind')&&!mine.includes('ascetic')&&pawnBody(pawn).capacities.sight>0){
    if(beauty>=1)out.push(beauty>=2?cause('pretty',40,'Physiquement éblouissant','Sa beauté frappe ceux qui la voient.'):cause('pretty',20,'Physiquement attirant','Son apparence plaît à ceux qui la voient.'));
    else if(beauty<=-1)out.push(beauty<=-2?cause('ugly',-40,'Physiquement hideux','Sa laideur rebute ceux qui la voient.'):cause('ugly',-20,'Physiquement repoussant','Son apparence déplaît à ceux qui la voient.'));
  }
  if((theirs.includes('annoying-voice')||theirs.includes('creepy-breathing'))&&!mine.includes('kind')&&pawnBody(pawn).capacities.hearing>0){
    if(theirs.includes('annoying-voice'))out.push(cause('annoying-voice',-25,'Voix agaçante','Sa voix agace ceux qui l’entendent.'));
    if(theirs.includes('creepy-breathing'))out.push(cause('creepy-breathing',-25,'Respiration inquiétante','Sa respiration met mal à l’aise ceux qui l’entendent.'));
  }
  if(mine.includes('misandrist')||mine.includes('misogynist')){
    const sex=other.appearance?.sex??appearanceOf(other,world.seed).sex;
    if(mine.includes('misandrist')&&sex==='male')out.push(cause('man',-25,'Homme','Ce misandre n’aime pas les hommes.'));
    if(mine.includes('misogynist')&&sex==='female')out.push(cause('woman',-25,'Femme','Ce misogyne n’aime pas les femmes.'));
  }
  if(mine.includes('body-modder')||mine.includes('body-purist')){
    const parts=Math.min(5,artificialPartCount361(other));
    if(parts&&mine.includes('body-modder'))out.push(cause('body-modder',8*parts,'Corps modifié apprécié',`${artificialPartCount361(other)} partie(s) artificielle(s) qui plaisent à ce transhumaniste.`));
    if(parts&&mine.includes('body-purist'))out.push(cause('body-purist',-8*parts,'Corps modifié répugnant',`${artificialPartCount361(other)} partie(s) artificielle(s) qui dégoûtent ce puriste.`));
  }
  if((traitDegree(pawn,'Industriousness')??0)>0){
    const degree=traitDegree(other,'Industriousness')??0;
    if(degree<=0)out.push(cause('hard-worker-vs-lazy',degree===0?-5:degree===-1?-20:-30,'Travailleur contre moins zélé','Ce travailleur méprise ceux qui en font moins.'));
  }
  const drug=traitDegree(pawn,'DrugDesire'),otherDrug=traitDegree(other,'DrugDesire');
  if(drug!==undefined&&otherDrug!==undefined){
    if(drug<0&&otherDrug>0)out.push(cause('teetotaler-vs-chemical',otherDrug===1?-20:-30,'Abstinent contre amateur de drogues','Cet abstinent désapprouve son goût pour les drogues.'));
    if(drug>0&&otherDrug<0)out.push(cause('chemical-vs-teetotaler',drug===1?-20:-30,'Amateur de drogues contre abstinent','Son abstinence agace cet amateur de drogues.'));
  }
  // Core Thought_SituationalSocial.OpinionOffset is zero when its owner has a
  // nullifying hediff, just like mood effects. Relationship defs and memory
  // opinions are not filtered here. Ordinary actors allocate no extra data.
  if(Number(world.schemaVersion)>=382&&out.length&&pawn.health?.animalAgeConditions?.cases.some(c=>c.kind==='Alzheimers')){
    for(let i=out.length-1;i>=0;i--){
      const index=coreSocialSituationIndex382(out[i]!.kind);
      if(index!==undefined&&coreAlzheimerNullifies382(pawn,index)){
        // Keep the active thought in the social explanation (Core does so),
        // but with a zero contribution and the explicit nullifying condition.
        out[i]!.value=0;out[i]!.description+=' (Annulé par la maladie d’Alzheimer.)';
      }
    }
  }
  return out;
}

/** Pawn_RelationsTracker.SecondaryLovinChanceFactor, sexuality part: 0 for an
 * asexual; a gay person only for the same sex; a person without a sexuality
 * trait only for the other sex; a bisexual for both. Then PrettinessFactor of
 * the other: 0.3 below 0 beauty, 2.3 above. Schema 361 only (callers gate). */
export function romanceTraitFactor361(world:Pick<World,'seed'>,pawn:Pawn,other:Pawn):number {
  const t=pawn.traits;
  if(t?.includes('asexual'))return 0;
  if(!t?.includes('bisexual')){
    const same=(pawn.appearance?.sex??appearanceOf(pawn,world.seed).sex)===(other.appearance?.sex??appearanceOf(other,world.seed).sex);
    if(t?.includes('gay')?!same:same)return 0;
  }
  const beauty=pawnBeauty361(other);
  return beauty<0?.3:beauty>0?2.3:1;
}
