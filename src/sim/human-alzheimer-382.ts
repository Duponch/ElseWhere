import type {Pawn} from './types.ts';
import type {MoodThought} from './mood.ts';
import type {InitialAnimalRandom256} from './initial-animal-age-256.ts';
import {VerseRand} from './verse-rand.ts';
import {coreThoughtIndex382} from './core-thought-indices-382.ts';

/** One draw over individual stored occurrences, not aggregated mood rows.
 * Core uses a single list; ElseWhere still owns memories in separate stores.
 * This is uniform over represented occurrences, but the source list order
 * (and therefore exact seeded selection) is not yet preserved by import. */
export function forgetHumanMemory382(p:Pawn,random:InitialAnimalRandom256):boolean {
 const stores:{entries:unknown[];empty?:()=>void}[]=[{entries:p.memories}];
 for(const key of ['roomMemories','bereavement','deathThoughts','familyBereavement','romanceMemories','partyMemories292','coupleMemories285','deniedJoining','hiveDefeats'] as const){
  const entries=p[key];if(entries?.length)stores.push({entries,empty:()=>{delete p[key];if(key==='hiveDefeats')delete p.hiveDefeatSuspendedTicks271;}});
 }
 if(p.social?.memories.length)stores.push({entries:p.social.memories});
 if(p.mental?.catharsis.length)stores.push({entries:p.mental.catharsis});
 const candidates:{store:typeof stores[number];index:number}[]=[];
 for(const store of stores)for(let index=0;index<store.entries.length;index++){
  // Darkness is a recent perceptual sample, not a Thought_Memory.
  if(store.entries===p.roomMemories&&p.roomMemories?.[index]?.kind==='darkness')continue;
  candidates.push({store,index});
 }
 if(!candidates.length)return false;
 const {store:{entries,empty},index}=candidates[random.integer(0,candidates.length)]!;
 entries.splice(index,1);
 if(entries===p.hiveDefeats&&p.hiveDefeatSuspendedTicks271)p.hiveDefeatSuspendedTicks271.splice(index,1);
 if(!entries.length)empty?.();
 return true;
}

export function alzheimerStage382(severity:number):0|1|2|3 {
 return severity>=Math.fround(.8)?3:severity>=Math.fround(.5)?2:severity>=Math.fround(.2)?1:0;
}
const NULLIFICATION_CHANCES=[0,.15,.33,.5] as const;
function nullificationChance(p:Pawn):number {
 const cases=p.health?.animalAgeConditions?.cases;if(!cases?.length)return 0;
 let chance=0;
 for(const c of cases)if(c.kind==='Alzheimers')chance=Math.max(chance,NULLIFICATION_CHANCES[alzheimerStage382(c.severity)]);
 return Math.fround(chance);
}
function nullifies(p:Pawn,index:number,chance:number):boolean {
 if(index===248&&p.traits?.includes('wimp'))return false;
 const id=p.nativeHuman?.sourceThingId382??p.id;
 return new VerseRand((Math.imul(id,31)+Math.imul(index,139))|0).value<chance;
}
/** Core's private stable draw does not advance the simulation stream. */
export function coreAlzheimerNullifies382(p:Pawn,index:number):boolean {
 const chance=nullificationChance(p);return chance>0&&nullifies(p,index,chance);
}
export function alzheimerMoodThoughts382(p:Pawn,thoughts:readonly MoodThought[]):readonly MoodThought[] {
 const chance=nullificationChance(p);if(!chance)return thoughts;
 const result:MoodThought[]=[];
 for(const t of thoughts){const index=t.kind==='situation'?coreThoughtIndex382(t.id):undefined;
  if(index===undefined||!nullifies(p,index,chance))result.push(t);
  else if(index!==241)result.push({...t,offset:0}); // Thought_SituationalSocial hides its zero mood offset.
 }
 return result;
}
