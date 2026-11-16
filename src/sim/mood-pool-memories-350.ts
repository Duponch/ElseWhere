import {memoryExpiry271} from './suspended-memory-271.ts';
import type {MoodThought} from './mood.ts';
import type {RoomMemory} from './room-experience.ts';
import type {Pawn,World} from './types.ts';

/* Schema 350 mood pool (mood-pool-350): the gate and the memories, in a leaf
 * module that the save readers and the memory owners can import. */
export const MOOD_POOL_SCHEMA_350=350;
export const isMoodPool350=(version:unknown):boolean=>Number(version)>=MOOD_POOL_SCHEMA_350;

/* Memories, kept in the pawn's roomMemories list (like the schema 343 sleep
 * memories) so that every owner of that list (caravans, couples, caskets,
 * archives) carries them unchanged. Durations in local ticks (1 local tick =
 * 10 Core ticks, a day = 6 000).
 * - SleepDisturbed (Thoughts_Memory_Misc): -1, 1 day, stack 3, ×1.
 * - Nuzzled: +4, 1 day, stack 3, ×0.5 (stage 0; stage 1 needs Odyssey).
 * - ReleasedHealthyPrisoner: +2, 6 days, stack 5, one per prisoner.
 * - BondedAnimalDied / BondedAnimalLost: -8, 20 days, stack 5, one per animal.
 * A memory of the last three kinds names its other pawn (otherId); Core puts
 * each other pawn in its own mood group, so they add up at full value. */
export type MoodPoolMemoryKind350='sleep-disturbed'|'nuzzled'|'released-prisoner'|'bonded-animal-died'|'bonded-animal-lost';
interface MoodPoolMemoryDef350 {readonly label:string;readonly offset:number;readonly duration:number;readonly stack:number;readonly multiplier:number;readonly perOther:boolean;readonly description:string}
export const MOOD_POOL_MEMORIES_350:Readonly<Record<MoodPoolMemoryKind350,MoodPoolMemoryDef350>>=Object.freeze({
 'sleep-disturbed':Object.freeze({label:'Sommeil perturbé',offset:-1,duration:6000,stack:3,multiplier:1,perOther:false,description:'Quelqu’un est passé tout près pendant le sommeil. Une chambre individuelle l’éviterait. Un jour, trois au plus.'}),
 nuzzled:Object.freeze({label:'Câlin d’un animal',offset:4,duration:6000,stack:3,multiplier:.5,perOther:false,description:'Un animal de la colonie est venu se frotter contre moi. Un jour, trois au plus, chaque câlin suivant compte à moitié.'}),
 'released-prisoner':Object.freeze({label:'Prisonnier libéré',offset:2,duration:36000,stack:5,multiplier:1,perOther:true,description:'La colonie a libéré un prisonnier en bonne santé. Six jours, cinq prisonniers au plus.'}),
 'bonded-animal-died':Object.freeze({label:'Compagnon lié mort',offset:-8,duration:120000,stack:5,multiplier:1,perOther:true,description:'Un animal lié à ce colon est mort. Vingt jours.'}),
 'bonded-animal-lost':Object.freeze({label:'Compagnon lié perdu',offset:-8,duration:120000,stack:5,multiplier:1,perOther:true,description:'Un animal lié à ce colon a été perdu. Vingt jours.'}),
});
const KINDS=Object.keys(MOOD_POOL_MEMORIES_350) as MoodPoolMemoryKind350[];
export const isMoodPoolMemory350=(kind:unknown):kind is MoodPoolMemoryKind350=>typeof kind==='string'&&(KINDS as string[]).includes(kind);

/** MemoryThoughtHandler.TryGainMemory: a full stack renews its oldest entry
 * (Thought_Memory.TryMergeWithExistingMemory); a per-other memory replaces
 * the one of the same pawn (stackLimitForSameOtherPawn 1), then the oldest
 * entries beyond the def's stack limit are removed. */
export function gainMoodPoolMemory350(p:Pawn,kind:MoodPoolMemoryKind350,tick:number,otherId?:number):void {
 const def=MOOD_POOL_MEMORIES_350[kind],list=p.roomMemories??[];
 const entry:RoomMemory={kind,stage:0,expiresAt:tick+def.duration,...def.perOther?{otherId:otherId!}:{}};
 const same=list.filter(m=>m.kind===kind),age=(m:RoomMemory)=>memoryExpiry271(m,m.expiresAt);
 const oldest=(items:readonly RoomMemory[])=>items.reduce((a,b)=>age(b)<age(a)?b:a);
 let next:RoomMemory[];
 if(def.perOther){
  next=list.filter(m=>!(m.kind===kind&&m.otherId===otherId));
  next.push(entry);
  for(let group=next.filter(m=>m.kind===kind);group.length>def.stack;group=next.filter(m=>m.kind===kind)){const drop=oldest(group);next=next.filter(m=>m!==drop);}
 }else if(same.length>=def.stack){const renew=oldest(same);next=list.map(m=>m===renew?entry:m);}
 else next=[...list,entry];
 p.roomMemories=next;
}
/** ThoughtHandler.MoodOffsetOfGroup: average offset × Σ multiplier^i; per-other
 * memories are separate groups, each at full value. */
export function moodPoolMemoryThoughts350(memories:readonly RoomMemory[],tick:number):MoodThought[] {
 const thoughts:MoodThought[]=[];
 for(const kind of KINDS){
  const active=memories.filter(m=>m.kind===kind&&memoryExpiry271(m,m.expiresAt)>tick);if(!active.length)continue;
  const def=MOOD_POOL_MEMORIES_350[kind];let sum=0,factor=1;
  for(let i=0;i<active.length;i++){sum+=factor;factor*=def.perOther?1:def.multiplier;}
  thoughts.push({id:`mood350-${kind}`,label:active.length>1?`${def.label} ×${active.length}`:def.label,offset:def.offset*sum,kind:'memory',
   description:def.description,expiresAt:Math.min(...active.map(m=>memoryExpiry271(m,m.expiresAt)))});
 }
 return thoughts;
}

/** PawnDiedOrDownedThoughtsUtility, Bond relation diedThought: the human a
 * dead animal was bonded to gains BondedAnimalDied. Called at the end of each
 * map tick, and before dead animals become corpses, for an animal whose death was committed this tick or the one
 * before (a Core sub-step may close it); one memory per animal. */
export function noteBondedAnimalDeaths350(w:World):void {
 if(!isMoodPool350(w.schemaVersion))return;
 for(const a of w.wildlife?.animals??[]){
  const bond=a.startingPet?.bondedPawnId,death=a.health?.death?.tick;
  if(bond===undefined||a.state!=='dead'||death===undefined||death<w.tick-1)continue;
  const human=w.pawns.find(p=>p.id===bond);
  if(human&&human.state!=='dead'&&!human.health?.death&&!human.roomMemories?.some(m=>m.kind==='bonded-animal-died'&&m.otherId===a.id))gainMoodPoolMemory350(human,'bonded-animal-died',w.tick,a.id);
 }
}
/* Schema 350 mental breaks (mental-breaks-350): their kinds, for the save
 * readers and the movement rules. */
export type MoodPoolCrisisKind350='psychotic-wander'|'wander-own-room'|'insulting-spree'|'targeted-insulting-spree';
export const MOOD_POOL_CRISES_350:readonly MoodPoolCrisisKind350[]=Object.freeze(['psychotic-wander','wander-own-room','insulting-spree','targeted-insulting-spree']);
export const isMoodPoolCrisis350=(kind:unknown):kind is MoodPoolCrisisKind350=>typeof kind==='string'&&(MOOD_POOL_CRISES_350 as readonly string[]).includes(kind);
/** Walk urgency: JobGiver_WanderAnywhere / WanderColony walk; the own room's
 * wander ambles (adaptation: walked); a spree chasing its target jogs. */
export function crisisWalks350(p:Pawn):boolean {
 const c=p.mental?.crisis;if(!c||p.need)return false;
 return c.kind==='psychotic-wander'||c.kind==='wander-own-room'||(c.kind==='insulting-spree'||c.kind==='targeted-insulting-spree')&&c.insultTargetId===null;
}

/* Schema 350 tame animal nuzzle (nuzzle-350): the mind state field. */
export interface AnimalNuzzle350 {tryCore:number;targetId?:number;startCore?:number}
/** Strict save shape of AnimalWanderState256.nuzzle350. */
export function validAnimalNuzzle350(value:unknown,version:number,clock:number):boolean {
 if(value===undefined)return true;
 if(!isMoodPool350(version)||!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>,keys=Object.keys(v),core=clock*10;
 const int=(x:unknown,min:number,max:number)=>Number.isSafeInteger(x)&&Number(x)>=min&&Number(x)<=max;
 if(!keys.every(k=>['tryCore','targetId','startCore'].includes(k))||!int(v.tryCore,0,core)||Number(v.tryCore)%10!==0)return false;
 if(v.targetId===undefined)return !('targetId'in v)&&!('startCore'in v);
 return int(v.targetId,1,Number.MAX_SAFE_INTEGER)&&v.startCore===v.tryCore;
}
