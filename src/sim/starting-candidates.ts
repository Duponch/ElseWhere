import {isSchema256Or257} from './schema-compatibility-257.ts';
import {constructHumanConditionMind256} from './human-condition-mind-256.ts';
import { assignBackground,assignBornBackground,generateBackground } from './background-generation.ts';
import { giveCoreSkills372,isSkills372,skillStream372 } from './skill-generation-372.ts';
import { FACTION_BACKSTORY_FILTERS_370,backstoryStream370,drawCoreBackground370,isBackstories370 } from './core-backstory-draw-370.ts';
import { BACKGROUND_SKILL_IDS,backgroundSkillRefusal,backgroundWorkRefusal,violentWorkRefusal } from './colonist-backgrounds.ts';
import { HUMAN_YEAR_TICKS,crashlandedHumanAge } from './human-age.ts';
import { generateStartingCandidateRelationships } from './relationship-generation.ts';
import type { RelationshipState } from './relationship-state.ts';
import type { PawnSkills,SkillRecord } from './skills.ts';
import { startingPawn } from './starting-pawns.ts';
import { LEGACY_TRAIT_IDS,TRAITS,isTraitsSchema361,type TraitId } from './traits.ts';
import { applyTraitSkillGains361,drawCoreTraits361,traitForbidsPassion361 } from './trait-generation-361.ts';
import { traitForcedPassions362 } from './trait-links-362.ts';
import { bornWimpRecord362 } from './wimp-record-362.ts';
import { SCHEMA_VERSION,type Pawn,type WorkType } from './types.ts';

export const STARTING_CANDIDATE_COUNT=8;
export const STARTING_PARTY_COUNT=3;
export const STARTING_CANDIDATE_NAME_MAX=80;
/** Installed Core WorkTypes.xml requireCapableColonist flags, translated to
 * the delivered work table. Doctor is not required by this particular check.
 * Required means a creation warning, never a minimum skill or a priority. */
export const STARTING_REQUIRED_WORK:readonly WorkType[]=Object.freeze(['firefight','warden','build','grow','mine','gather','craft','haul','clean']);

/** A prospective identity is a roster slot and its generation, never a Thing
 * allocation. Only the materialized Pawn enters a save; no new schema field. */
export interface StartingCandidateDescriptor {
  serial:number;
  generation:number;
  nameOverride?:string;
}
export interface StartingParty {
  version:1;
  seed:number;
  selected:[StartingCandidateDescriptor,StartingCandidateDescriptor,StartingCandidateDescriptor];
}
export interface StartingPartyPreview {pawns:Pawn[];relationships:RelationshipState}

const uint32=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=0xffffffff;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
  &&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
function exactKeys(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]):boolean {
  return required.every(key=>Object.hasOwn(value,key))&&Reflect.ownKeys(value).every(key=>{
    if(typeof key!=='string'||!required.includes(key)&&!optional.includes(key))return false;
    const field=Object.getOwnPropertyDescriptor(value,key)!;
    return field.enumerable===true&&Object.hasOwn(field,'value');
  });
}
function validDescriptors(value:unknown,count:number):value is StartingCandidateDescriptor[] {
  if(!Array.isArray(value)||value.length!==count||Reflect.ownKeys(value).length!==count+1)return false;
  for(let index=0;index<count;index++){
    const field=Object.getOwnPropertyDescriptor(value,String(index));
    if(!field||field.enumerable!==true||!Object.hasOwn(field,'value')||!validStartingCandidateDescriptor(field.value))return false;
  }
  return new Set(value.map(d=>d.serial)).size===count;
}
export const validStartingCandidateName=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=STARTING_CANDIDATE_NAME_MAX&&value.trim()===value&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value);
export function validStartingCandidateDescriptor(value:unknown):value is StartingCandidateDescriptor {
  if(!object(value)||!exactKeys(value,['serial','generation'],['nameOverride'])
    ||!Number.isInteger(value.serial)||Number(value.serial)<1||Number(value.serial)>STARTING_CANDIDATE_COUNT||!uint32(value.generation))return false;
  return !Object.hasOwn(value,'nameOverride')||validStartingCandidateName(value.nameOverride);
}
function validSelection(value:unknown):value is StartingParty['selected'] {
  return validDescriptors(value,STARTING_PARTY_COUNT);
}
export function validStartingParty(value:unknown):value is StartingParty {
  return object(value)&&exactKeys(value,['version','seed','selected'])&&value.version===1&&uint32(value.seed)&&validSelection(value.selected);
}
function requireSeed(seed:number):void {if(!uint32(seed))throw new Error('La graine des candidats est invalide.');}
function requireDescriptor(descriptor:StartingCandidateDescriptor):void {
  if(!validStartingCandidateDescriptor(descriptor))throw new Error('Le candidat de départ est invalide.');
}

/** Core StartingPawnUtility.DefaultStartingPawnRequest: in the tutorial every
 * starting or optional pawn is generated with mustBeCapableOfViolence. */
export interface StartingCandidateRules {capableOfViolence?:boolean}
/** PawnGenerator's own retry: a person who refuses violent work is not born;
 * the next generation of the same entry is tried instead (bounded). */
function admitted(seed:number,descriptor:StartingCandidateDescriptor,rules:StartingCandidateRules):StartingCandidateDescriptor {
  let current=descriptor;
  for(let attempt=0;rules.capableOfViolence&&attempt<100&&violentWorkRefusal(previewStartingCandidate(seed,current))!==undefined;attempt++)current=rerollStartingCandidate(current);
  return current;
}
export function createStartingCandidateRoster(seed:number,rules:StartingCandidateRules={}):StartingCandidateDescriptor[] {
  requireSeed(seed);
  const roster=Array.from({length:STARTING_CANDIDATE_COUNT},(_,i)=>admitted(seed,{serial:i+1,generation:0},rules));
  // The first birth plus at most twenty whole-team renewals mirrors Core's
  // bounded starter-generation check. Reserves are not repeatedly regenerated.
  for(let attempt=0;attempt<20&&startingPartyMissingWork(seed,roster.slice(0,STARTING_PARTY_COUNT)).length;attempt++){
    for(let index=0;index<STARTING_PARTY_COUNT;index++)roster[index]=admitted(seed,rerollStartingCandidate(roster[index]!),rules);
  }
  return roster;
}
/** A new person replaces this entry. Moving an entry does not change its
 * descriptor; editing its name does not change its generated appearance. */
export function rerollStartingCandidate(descriptor:StartingCandidateDescriptor):StartingCandidateDescriptor {
  requireDescriptor(descriptor);
  if(descriptor.generation===0xffffffff)throw new Error('La limite de renouvellement de ce candidat est atteinte.');
  return {serial:descriptor.serial,generation:descriptor.generation+1};
}
/** Core RandomizePawn uses a do/while with num <= 20: one renewal is mandatory,
 * with at most twenty more attempts to cover the selected team. Renewing a
 * reserve cannot repair a missing selected skill, but remains equally bounded.
 * The rest of the roster and every caller-owned descriptor stay untouched. */
export function rerollStartingCandidateForRoster(seed:number,roster:readonly StartingCandidateDescriptor[],serial:number,rules:StartingCandidateRules={}):StartingCandidateDescriptor[] {
  requireSeed(seed);
  if(!validDescriptors(roster,STARTING_CANDIDATE_COUNT))throw new Error('La liste doit contenir huit candidats distincts.');
  const result=roster.map(d=>({...d})),index=result.findIndex(d=>d.serial===serial);
  if(index<0)throw new Error('Le candidat à renouveler est absent de la liste.');
  for(let attempt=0;attempt<21;attempt++){
    result[index]=admitted(seed,rerollStartingCandidate(result[index]!),rules);
    if(!startingPartyMissingWork(seed,result.slice(0,STARTING_PARTY_COUNT)).length)break;
  }
  return result;
}
export function startingPartyFromRoster(seed:number,roster:readonly StartingCandidateDescriptor[]):StartingParty {
  requireSeed(seed);
  if(!validDescriptors(roster,STARTING_CANDIDATE_COUNT))throw new Error('La liste doit contenir huit candidats distincts.');
  return {version:1,seed,selected:roster.slice(0,STARTING_PARTY_COUNT).map(d=>({...d})) as StartingParty['selected']};
}

// Private, independently addressed birth channels. Neither preview, reroll nor
// name editing touches terrain generation or a simulation/incident RNG.
function hash(seed:number,serial:number,generation:number,salt:number):number {
  let n=(seed^Math.imul(serial,0x9e3779b1)^Math.imul(generation,0x85ebca6b)^salt)>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
}
const NAMES=['Ada','Noé','Mina','Iris','Sacha','Léonie','Tao','Émile','Alma','Nils','Salomé','Basile','Rose','Marin','Lou','Camille','Jules','Léna','Maël','Inès','Alex','Charlie','Lucie','Simon','Ari','Éloïse','Robin','Gaël','Ambre','Eden','Milo','Soline'] as const;
/** The pre-361 draw ranks exactly the nine historical ids, in key order. */
const TRAIT_IDS=LEGACY_TRAIT_IDS;

/** Original bounded distributions over implemented content, not Core's full
 * pawn generator. Every skill has a real record; background gains apply once.
 * The trait subset has no imposed biography traits or skill modifiers.
 * Schema 372: the skills and passions are Core's (skill-generation-372.ts). */
export function previewStartingCandidate(seed:number,descriptor:StartingCandidateDescriptor,version:number=SCHEMA_VERSION):Pawn {
  requireSeed(seed);requireDescriptor(descriptor);
  const identity=descriptor.serial,birthSeed=hash(seed,identity,descriptor.generation,0x333b17),draw=(salt:number)=>hash(seed,identity,descriptor.generation,salt)/0x100000000;
  const originalName=NAMES[Math.floor(draw(0x333a11)*NAMES.length)]!;
  const pawn=startingPawn(identity,originalName,0,0,0,55,birthSeed);
  // Name is a separately editable label. Use the birth label for the visual
  // hash so a rename cannot create a different person on final materialization.
  if(descriptor.nameOverride!==undefined)pawn.name=descriptor.nameOverride;
  pawn.age=crashlandedHumanAge(birthSeed,identity,pawn.age!);
  // Schema 372: Core's GenerateSkills replaces the local birth levels below
  // (their private draws are then simply not read).
  const core372=isSkills372(version);
  const skills={lastResetTick:-1} as PawnSkills;
  BACKGROUND_SKILL_IDS.forEach((skill,index)=>{
    skills[skill]={level:core372?0:Math.floor(draw(0x333510+index)*5),xp:0,dailyXp:0,passion:0};
  });
  pawn.skills=skills;
  // Schema 370: Core's draw for a Colonist of the player colony (Offworld);
  // the tutorial's violence rule is the whole-candidate retry of admitted().
  // From 372 the background adds no gain (Core's skills read it).
  const background=isBackstories370(version)?drawCoreBackground370(backstoryStream370(birthSeed,identity),pawn.age.biologicalTicks,FACTION_BACKSTORY_FILTERS_370.PlayerColony!)
    :generateBackground(birthSeed,identity,pawn.age);
  if(core372)assignBornBackground(version,pawn,background);else assignBackground(pawn,background);
  // Schema 361: Core order, traits before skills and passions (their skill
  // gains change the levels the passion ranking reads; Brawler forbids a
  // shooting passion). New salts only; every pre-361 draw is unchanged.
  const core361=isTraitsSchema361(version)?drawCoreTraits361({draw:salt=>draw(salt),sex:pawn.appearance?.sex??'none',ageYears:pawn.age.biologicalTicks/HUMAN_YEAR_TICKS,background:pawn.background!,...version>=362?{schema:version}:{}}):undefined;
  if(core372&&core361){
    // Schema 372: Core's GenerateSkills (levels with the backstory and trait
    // gains, then the passions, forced and conflicting ones included) on the
    // candidate's private skill stream; a rerolled candidate has a new one.
    if(core361.length)pawn.traits=core361;
    giveCoreSkills372(pawn,skillStream372(birthSeed,identity));
    bornWimpRecord362(pawn,0);
    return pawn;
  }
  if(core361)applyTraitSkillGains361(pawn.skills,core361);
  // A finite weighted passion budget rewards stronger available skills. This
  // is a local distribution, not a claim to reproduce Core's Gaussian budget.
  const eligible=BACKGROUND_SKILL_IDS.filter(skill=>!backgroundSkillRefusal(pawn,skill)&&!(core361&&traitForbidsPassion361(core361,skill)))
    .map((skill,index)=>({skill,rank:pawn.skills[skill]!.level+draw(0x333610+index)*3}))
    .sort((a,b)=>b.rank-a.rank||BACKGROUND_SKILL_IDS.indexOf(a.skill)-BACKGROUND_SKILL_IDS.indexOf(b.skill));
  let budget=3+Math.floor(draw(0x33360f)*4);
  for(let index=0;index<eligible.length&&budget>0;index++){
    const record=pawn.skills[eligible[index]!.skill] as SkillRecord;
    const major=budget>=2&&draw(0x333650+index)<.4;
    record.passion=major?2:1;budget-=major?2:1;
  }
  if(core361){
    if(core361.length)pawn.traits=core361;
    // Schema 362: a tortured artist's forced Art passion (after the local
    // budget, no draw) and a wimp's pain shock threshold on its record.
    traitForcedPassions362(pawn);bornWimpRecord362(pawn,0);
    return pawn;
  }
  const traits:TraitId[]=[],groups=new Set<string>(),count=draw(0x333700)<.35?3:2;
  const choices=TRAIT_IDS.map((id,index)=>({id,rank:draw(0x333710+index)})).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
  for(const {id} of choices){
    const group=TRAITS[id].group;if(groups.has(group))continue;
    traits.push(id);groups.add(group);if(traits.length===count)break;
  }
  pawn.traits=traits;
  return pawn;
}

/** Only these allocation-dependent fields change. All birth data, nested
 * records and needs are freshly owned and identical to the advertised person. */
export function materializeStartingCandidate(seed:number,descriptor:StartingCandidateDescriptor,id:number,x:number,z:number,version?:number):Pawn {
  if(!Number.isSafeInteger(id)||id<=0||!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0)throw new Error('Placement du candidat invalide.');
  // Without a version: the current traits of the preview, and no 256 mind (the historical default 255).
  const pawn=previewStartingCandidate(seed,descriptor,version??SCHEMA_VERSION);
  pawn.id=id;pawn.x=x;pawn.z=z;if(version!==undefined&&isSchema256Or257(version))constructHumanConditionMind256(pawn,version);
  return pawn;
}
export function previewStartingParty(seed:number,selected:readonly StartingCandidateDescriptor[],version:number=SCHEMA_VERSION):StartingPartyPreview {
  requireSeed(seed);
  if(!validSelection(selected))throw new Error('Trois candidats distincts doivent être choisis.');
  const pawns=selected.map(d=>previewStartingCandidate(seed,d,version));
  return {pawns,relationships:generateStartingCandidateRelationships(seed,pawns,version)};
}
/** True delivered incapacities only. The nine current traits have no work
 * disable tags; their mood, learning and social effects are not incapacities.
 * Zero skill, work priority or an initial age ailment cannot make this warning.
 * Deliberate team reordering may leave gaps; the caller may continue anyway. */
export function startingPartyMissingWork(seed:number,selected:readonly StartingCandidateDescriptor[]):readonly WorkType[] {
  requireSeed(seed);
  if(!validSelection(selected))throw new Error('Trois candidats distincts doivent être choisis.');
  const pawns=selected.map(d=>previewStartingCandidate(seed,d));
  return STARTING_REQUIRED_WORK.filter(work=>pawns.every(p=>backgroundWorkRefusal(p,work)!==undefined));
}
