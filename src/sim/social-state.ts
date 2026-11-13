import {memoryExpiry271,memoryAge271,memoryReadTick271} from './suspended-memory-271.ts';
import { TICKS_PER_DAY,type Pawn,type World } from './types.ts';
import { pawnBody } from './health-rules.ts';
import { effectiveSkillLevel } from './work-types.ts';
import { relationshipIndex } from './relationship-runtime.ts';
import { RELATIONSHIP_OPINION,type RelationshipViewKind } from './relationship-state.ts';
import { expireRomanceMemories,romanceOpinionCauses,type RomanceOpinionKind } from './romance-memories.ts';
import {coupleOpinionOffset285,COUPLE_MEMORY_DURATION_285} from './couple-memories-285.ts';

export type SocialKind='chitchat'|'deep-talk'|'rapport'|'kind-words'|'slight'|'insult'|'fight-cathartic'|'fight-angering'|'recruited-me';
export type SocialInteractionKind=SocialKind|'romance-attempt'|'breakup';
export interface SocialMemory { otherId:number;kind:SocialKind;at:number;offset:number;suspendedTicks?:number }
export interface SocialState {
  rng:number; wants?:true;
  last?:{otherId:number;kind:SocialInteractionKind;tick:number;initiated:boolean};
  /** Reciprocal marker for an actual physical social fight, not an interaction roll. */
  fight?:{opponentId:number;startedAt:number};
  memories:SocialMemory[];
}
export const SOCIAL_LABELS:Readonly<Record<SocialInteractionKind,string>>=Object.freeze({'chitchat':'Bavardage','deep-talk':'Discussion approfondie',rapport:'Rapprochement','kind-words':'Mots gentils',slight:'Vexation',insult:'Insulte','fight-cathartic':'Bagarre cathartique','fight-angering':'Bagarre rageante','recruited-me':'M’a recruté','romance-attempt':'Tentative amoureuse',breakup:'Rupture'});
export const DEEP_TALK_DURATION=20*TICKS_PER_DAY;
/** Core ThoughtDef RecruitedMe (schema 319): 120 days. */
export const RECRUITED_ME_DURATION=120*TICKS_PER_DAY;
export const RECRUITED_ME_OPINION=20;
export const socialMemoryDuration=(kind:SocialKind):number=>kind==='recruited-me'?RECRUITED_ME_DURATION:DEEP_TALK_DURATION;
export const INSULT_MOOD_DURATION=2*TICKS_PER_DAY;

/** Independent stream: social rolls never perturb mining, medicine or raids. */
export function socialRandom(state:{rng:number}):number {
  let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng/4294967296;
}
export function socialSeed(seed:number,id:number):number {return (Math.imul(seed^0x6a09e667,1664525)^Math.imul(id,1013904223))>>>0||1;}
export function socialImpact(pawn:Pawn):number {
  const c=pawnBody(pawn).capacities;
  return Math.max(.2,(.82+.0275*effectiveSkillLevel(pawn,'social',pawn.skills.social?.level??0))*(.1+.9*Math.min(1,c.talking/.95))*(.7+.3*Math.min(1,c.hearing/.95)));
}
/** Stable symmetric affinity; adult ages are not yet modeled (age offset 0).
 * Same asymmetric normal family as Core, independent seed/PRNG, not identical pairs. */
export function socialCompatibility(seed:number,a:number,b:number):number {
  const state={rng:socialSeed(seed,Math.min(a,b))^Math.imul(Math.max(a,b),37)};state.rng=state.rng>>>0||1;
  const n=Math.sqrt(-2*Math.log(Math.max(1/4294967296,socialRandom(state))))*Math.sin(2*Math.PI*socialRandom(state));
  return .3+n*(n>0?1.4:1);
}
export function deepTalkWeight(compatibility:number):number {
  const points=[[-1.5,0],[-.5,.1],[.5,1],[1,1.8],[2,3]] as const;
  if(compatibility<=-1.5)return 0;
  for(let i=1;i<points.length;i++){const [x,y]=points[i]!,[px,py]=points[i-1]!;if(compatibility<=x)return .075*(py+(y-py)*(compatibility-px)/(x-px));}
  return .225;
}
export function memoryOffset(memory:SocialMemory,tick:number):number {
  const age=Math.max(0,memoryAge271(memory,memory.at,tick));
  if(memory.kind==='chitchat')return Math.min(10,Math.max(0,memory.offset-Math.floor(age/TICKS_PER_DAY)));
  const duration=socialMemoryDuration(memory.kind);
  return memory.offset*Math.max(0,Math.min(1,(duration-age)/(duration*.3)));
}
function roundPositiveOpinion(n:number):number {const lo=Math.floor(n);return n<=0?0:Math.max(1,n-lo===.5?lo+lo%2:Math.round(n));}
function roundOpinion(n:number):number {return n<0?-roundPositiveOpinion(-n):roundPositiveOpinion(n);}
export type OpinionCauseKind=SocialKind|`relation-${RelationshipViewKind}`|`romance-${RomanceOpinionKind}`|'couple-intimacy';
export interface OpinionCause {kind:OpinionCauseKind;count:number;value:number;nextChange:number;label:string;description:string}
const relationLabels:Readonly<Record<RelationshipViewKind,string>>={parent:'Parent',child:'Enfant',sibling:'Fratrie',lover:'Partenaire',spouse:'Conjoint','ex-lover':'Ancien partenaire','ex-spouse':'Ancien conjoint'};
export function opinionCauses(pawn:Pawn,otherId:number,tick:number,world?:World):OpinionCause[] {
  tick=memoryReadTick271(pawn,tick);
  const memories=pawn.social?.memories.filter(m=>m.otherId===otherId&&memoryOffset(m,tick)!==0)??[];
  const causes:OpinionCause[]=(['chitchat','deep-talk','rapport','kind-words','slight','insult','fight-cathartic','fight-angering','recruited-me'] as const).flatMap(kind=>{
    const group=memories.filter(m=>m.kind===kind).sort((a,b)=>b.at-a.at);if(!group.length)return [];
    const value=roundOpinion(group.reduce((s,m,i)=>s+memoryOffset(m,tick)*((kind==='deep-talk'||kind==='kind-words'||kind==='slight'||kind==='insult'||kind==='fight-cathartic'||kind==='fight-angering') ? .9**i : 1),0));
    const nextChange=kind==='chitchat'?memoryExpiry271(group[0]!,group[0]!.at+(Math.floor((memoryAge271(group[0]!,group[0]!.at,tick))/TICKS_PER_DAY)+1)*TICKS_PER_DAY):Math.min(...group.map(m=>memoryExpiry271(m,m.at+socialMemoryDuration(kind))));
    return [{kind,count:group.length,value,nextChange,label:SOCIAL_LABELS[kind],description:'Souvenir dirigé d’un échange social réel.'}];
  });
  if(world&&world.schemaVersion>=195&&world.relationships?.links.length)for(const kind of relationshipIndex(world).kinds(pawn.id,otherId)){
    causes.push({kind:`relation-${kind}`,count:1,value:RELATIONSHIP_OPINION[kind],nextChange:Infinity,label:relationLabels[kind],description:'Lien personnel connu ; son effet n’est pas une conversation expirante.'});
  }
  for(const cause of romanceOpinionCauses(pawn,otherId,tick))causes.push({...cause,kind:`romance-${cause.kind}`,value:roundOpinion(cause.value)});
  if(pawn.coupleMemories285){
    const value=coupleOpinionOffset285(pawn,otherId,tick);
    if(value>0){
      const group=pawn.coupleMemories285.filter(m=>m.otherId===otherId&&memoryExpiry271(m,m.at+COUPLE_MEMORY_DURATION_285)>tick);
      causes.push({kind:'couple-intimacy',count:group.length,value,nextChange:Math.min(...group.map(m=>memoryExpiry271(m,m.at+COUPLE_MEMORY_DURATION_285))),label:'Moment intime partagé',
        description:'Souvenir dirigé du partenaire réel ; opinion décroissante pendant les derniers 30 % des trois jours, cumul dégressif.'});
    }
  }
  return causes;
}
export const opinionOf=(pawn:Pawn,otherId:number,tick:number,world?:World):number=>pawn.state==='dead'?0:Math.max(-100,Math.min(100,opinionCauses(pawn,otherId,tick,world).reduce((s,c)=>s+c.value,0)));

/** InsultedMood is a separate two-day thought in Core, with fixed -5 per
 * occurrence before stacking, independent of the speaker's SocialImpact. */
function socialMoodMemories(pawn:Pawn,tick:number,kind:'insult'|'kind-words'):{otherId:number;count:number;offset:number;expiresAt:number}[] {
  tick=memoryReadTick271(pawn,tick);
  const active=(pawn.social?.memories??[]).filter(m=>m.kind===kind&&memoryExpiry271(m,m.at+INSULT_MOOD_DURATION)>tick)
    .sort((a,b)=>b.at-a.at||a.otherId-b.otherId).slice(0,10);
  const groups=new Map<number,{otherId:number;count:number;offset:number;expiresAt:number}>();
  for(const [index,m] of active.entries()){
    let group=groups.get(m.otherId);if(!group){group={otherId:m.otherId,count:0,offset:0,expiresAt:memoryExpiry271(m,m.at+INSULT_MOOD_DURATION)};groups.set(m.otherId,group);}
    group.count++;group.offset+=(kind==='insult'?-5:5)*.9**index;group.expiresAt=Math.max(group.expiresAt,memoryExpiry271(m,m.at+INSULT_MOOD_DURATION));
  }
  return [...groups.values()];
}
export const insultMoodMemories=(pawn:Pawn,tick:number)=>socialMoodMemories(pawn,tick,'insult');
export const kindWordsMoodMemories=(pawn:Pawn,tick:number)=>socialMoodMemories(pawn,tick,'kind-words');

/** Cleanup runs on retained dead actors too. Merging chitchat never refreshes its clock. */
export function expireSocialMemories(pawn:Pawn,tick:number):void {
  if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))return;
  if(pawn.romanceMemories)expireRomanceMemories(pawn,tick);
  const s=pawn.social;if(!s)return;
  for(const m of s.memories)if(m.kind==='chitchat'){
    const days=Math.floor((memoryAge271(m,m.at,tick))/TICKS_PER_DAY);if(days>0){m.offset=Math.max(0,m.offset-days);m.at+=days*TICKS_PER_DAY;}
  }
  if(s.memories.some(m=>memoryOffset(m,tick)===0))s.memories=s.memories.filter(m=>memoryOffset(m,tick)!==0);
}
export function addSocialMemory(state:SocialState,otherId:number,kind:SocialKind,tick:number,impact:number):void {
  const same=state.memories.filter(m=>m.kind===kind&&m.otherId===otherId);
  if(kind==='chitchat'&&same.length){same[0]!.offset+=.66*impact;return;}
  if(kind!=='chitchat'&&same.length>=(kind==='recruited-me'?1:kind==='rapport'?50:kind==='fight-cathartic'||kind==='fight-angering'?5:10))state.memories.splice(state.memories.indexOf(same.reduce((a,b)=>a.at<=b.at?a:b)),1);
  const all=state.memories.filter(m=>m.kind===kind);
  if(all.length>=300)state.memories.splice(state.memories.indexOf(all.reduce((a,b)=>a.at<=b.at?a:b)),1);
  state.memories.push({otherId,kind,at:tick,offset:(kind==='chitchat'?.66:kind==='rapport'?2:kind==='kind-words'?15:kind==='slight'?-5:kind==='insult'?-15:kind==='fight-cathartic'?38:kind==='fight-angering'?-22:15)*(kind==='recruited-me'?0:impact)+(kind==='recruited-me'?RECRUITED_ME_OPINION:0)});
}

/** Called once when an actual social fight ends, including before its first
 * strike. Each eligible participant draws from their own persisted stream. */
export function addFightAftermath(world:World,a:Pawn,b:Pawn):void {
  for(const [pawn,other] of [[a,b],[b,a]] as const){
    if(pawn.state==='dead'||other.state==='dead')continue;
    const state=pawn.social??={rng:socialSeed(world.seed,pawn.id),memories:[]};
    expireSocialMemories(pawn,world.tick);
    addSocialMemory(state,other.id,socialRandom(state)<.5?'fight-cathartic':'fight-angering',world.tick,1);
  }
}
