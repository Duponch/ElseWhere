import {isAnimalSpecies256,animalCore256} from './animal-core-v256.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {animalSpecies,type AnimalSpeciesId} from './animal-species.ts';
import {startAnimalManhunter} from './animal-manhunter.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {healthRandom} from './health.ts';
import {pawnBody} from './health-rules.ts';
import {mechaAssessment} from './mechanoid-health.ts';
import {animalBody} from './wildlife-health.ts';
import {effectiveSkillLevel} from './work-types.ts';
import {structureById} from './structure-navigation.ts';
import {RoomTopologyCache} from './room-topology.ts';
import type {BombInstigatorKey} from './mini-turret-state.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Pawn,World} from './types.ts';

/** Schema 348: a wild animal harmed by a person, or whose taming failed, may
 * turn manhunter as in Core 1.6 (Pawn_MindState.Notify_DamageTaken and
 * CheckStartMentalStateBecauseRecruitAttempted). Older schemas never draw. */
export const isManhunterRevengeSchema348=(version:number):boolean=>Number(version)>=348;

/** RaceProperties.manhunterOnDamageChance / manhunterOnTameFailChance. The
 * Core species carry them in their data; the seven historical species keep
 * their Core def's values (Hare, Snowhare, Deer, Gazelle, Dromedary, Fox_Red:
 * 0 and 0; Muffalo: 0.1 and 0). */
const LEGACY_REVENGE_348:Readonly<Record<string,{readonly onDamage:number;readonly onTameFail:number}>>=Object.freeze({
  hare:{onDamage:0,onTameFail:0},'snow-hare':{onDamage:0,onTameFail:0},deer:{onDamage:0,onTameFail:0},gazelle:{onDamage:0,onTameFail:0},
  dromedary:{onDamage:0,onTameFail:0},'red-fox':{onDamage:0,onTameFail:0},muffalo:{onDamage:.1,onTameFail:0},
});
export function animalRevengeChances348(species:AnimalSpeciesId):{onDamage:number;onTameFail:number} {
  if(isAnimalSpecies256(species)){const race=animalCore256(species).race;return {onDamage:race.manhunterOnDamageChance,onTameFail:race.manhunterOnTameFailChance};}
  return LEGACY_REVENGE_348[species]??{onDamage:0,onTameFail:0};
}
/** DifficultyDef.manhunterChanceOnDamageFactor: the Difficulty default 1,
 * only Peaceful lowers it to 0.25. allowBigThreats: true except Peaceful. */
const DAMAGE_FACTOR_348:Readonly<Record<string,number>>=Object.freeze({peaceful:.25});
export function manhunterChanceOnDamageFactor348(w:Pick<World,'gameProfile'>):number {
  const difficulty:string|undefined=w.gameProfile?.difficulty;
  return difficulty!==undefined&&Object.hasOwn(DAMAGE_FACTOR_348,difficulty)?DAMAGE_FACTOR_348[difficulty]!:1;
}
const allowBigThreats348=(w:Pick<World,'gameProfile'>):boolean=>(w.gameProfile?.difficulty as string|undefined)!=='peaceful';
const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
/** PawnUtility.GetManhunterOnDamageChance(pawn) without an instigator: the
 * Wildlife table value (species chance x difficulty, +0.5 with scaria). */
export function manhunterOnDamageChance348(w:Pick<World,'gameProfile'>,a:Pick<WildAnimal,'species'|'health'>):number {return clamp01(harmChance348(w,a));}
/** The same sum before Core's single final clamp. */
const harmChance348=(w:Pick<World,'gameProfile'>,a:Pick<WildAnimal,'species'|'health'>):number=>
  animalRevengeChances348(a.species).onDamage*manhunterChanceOnDamageFactor348(w)+(a.health?.scaria261?.5:0);
/** PawnUtility.GetManhunterOnTameFailChance(pawn). */
export const manhunterOnTameFailChance348=(a:Pick<WildAnimal,'species'>):number=>clamp01(animalRevengeChances348(a.species).onTameFail);

/** HuntingStealth postProcessCurve (SimpleCurve: linear, flat outside). */
const STEALTH_CURVE:readonly (readonly [number,number])[]=[[0,0],[.1,.5],[.2,.75],[.5,.8],[1,.9]];
function stealthCurve(x:number):number {
  if(!(x>STEALTH_CURVE[0]![0]))return STEALTH_CURVE[0]![1];
  for(let i=1;i<STEALTH_CURVE.length;i++){const [x1,y1]=STEALTH_CURVE[i]!;if(x<=x1){const [x0,y0]=STEALTH_CURVE[i-1]!;return y0+(x-x0)/(x1-x0)*(y1-y0);}}
  return STEALTH_CURVE.at(-1)![1];
}
/** StatDef HuntingStealth: base 1, skill factors 0.05 x Shooting and
 * 0.05 x Animals (only for a pawn with skills; the no-skill factor is 1),
 * the Moving capacity at weight 1, then the curve; minimum 0. */
function pawnHuntingStealth348(p:Pawn):number {
  const level=(skill:'shooting'|'animals')=>Math.max(0,Math.min(20,effectiveSkillLevel(p,skill,p.skills[skill]?.level??0)));
  return Math.max(0,stealthCurve(.05*level('shooting')*(.05*level('animals'))*pawnBody(p).capacities.moving));
}
const bodyStealth348=(moving:number):number=>Math.max(0,stealthCurve(moving));
interface RevengeInstigator348 {readonly id:number;readonly stealth:number}
/** The instigator conditions of Notify_DamageTaken: a Pawn or a turret, with
 * a faction that is humanlike or a pawn of at least ToolUser intelligence.
 * Every person has a humanlike faction; a mechanoid is a ToolUser; a colony
 * animal belongs to the player; a wild animal has no faction and a hive
 * insect's faction is neither humanlike nor intelligent. A turret has no
 * skill or body: its HuntingStealth is the curve of the base value 1. */
export function revengeInstigator348(w:World,key:BombInstigatorKey|string|undefined):RevengeInstigator348|undefined {
  if(!key)return;
  const colon=key.indexOf(':'),family=key.slice(0,colon),id=Number(key.slice(colon+1));
  if(!Number.isSafeInteger(id))return;
  if(family==='pawn'){const p=w.pawns.find(p=>p.id===id);return p?{id,stealth:pawnHuntingStealth348(p)}:undefined;}
  if(family==='mech'){const m=w.mechanoids?.find(m=>m.id===id);return m?{id,stealth:bodyStealth348(mechaAssessment(m).capacities.moving)}:undefined;}
  if(family==='animal'){const a=w.wildlife?.animals.find(a=>a.id===id);return a?.domestic?{id,stealth:bodyStealth348(animalBody(a).capacities.moving)}:undefined;}
  if(family==='structure'){const s=structureById(w,id);return s?.kind==='mini-turret'&&s.factionId!==null?{id,stealth:bodyStealth348(1)}:undefined;}
}
/** GetManhunterOnDamageChance(pawn, instigator) with Core's default distance:
 * (species x difficulty + scaria) x 3 x (1 - stealth), clamped once. */
export const harmRevengeChance348=(w:Pick<World,'gameProfile'>,a:Pick<WildAnimal,'species'|'health'>,stealth:number):number=>clamp01(harmChance348(w,a)*3*(1-stealth));
/** Rand.Chance: no draw at 0 or below, nor at 1 or above. */
function chance348(chance:number,random:{rng:number}):boolean {
  if(chance<=0)return false;if(chance>=1)return true;
  return healthRandom(random)<chance;
}
const spawned348=(w:World,a:WildAnimal)=>!!w.wildlife?.animals.includes(a)&&a.state!=='dead'&&!animalCarrier(w,a.id)&&a.shipCryptosleepHeldAt277===undefined;
/** In a mental state (Manhunter or WanderConfused) or with a faction (colony
 * animal or hive insect): Core's conditions refuse before any draw. */
const revengeRefused348=(a:WildAnimal)=>!!a.manhunter||!!a.confusion||!!a.domestic||!!a.hive;

const districtCaches=new WeakMap<World,RoomTopologyCache>();
/** Pawn_MindState.GetPackmates(pawn, 24): same race, same (no) faction,
 * spawned, within 24 cells horizontally and in the same district. The room
 * topology stands for the district (a door cell is its own district). */
function packmates348(w:World,a:WildAnimal):WildAnimal[] {
  let cache=districtCaches.get(w);if(!cache){cache=new RoomTopologyCache();districtCaches.set(w,cache);}
  const rooms=cache.read(w);
  const district=(x:number,z:number)=>{const cell=rooms.at(x,z);return cell?.kind==='space'?`s${cell.id}`:`c${x},${z}`;};
  const home=district(a.x,a.z);
  return (w.wildlife?.animals??[]).filter(m=>m!==a&&m.species===a.species&&!m.domestic&&!m.hive&&spawned348(w,m)
    &&(m.x-a.x)**2+(m.z-a.z)**2<=24*24&&district(m.x,m.z)===home);
}
/** StartManhunterBecauseOfPawnAction: the mental state starts (refused
 * asleep, downed, without moving or attack), then with big threats allowed
 * one Rand.Value below 0.5 spreads it to the awake packmates. One notice. */
function startRevenge348(w:World,a:WildAnimal,random:{rng:number},core:number,notice:(label:string)=>string):boolean {
  if(!startAnimalManhunter(w,a,core,!!a.health?.scaria261,true))return false;
  let joined=0;
  if(allowBigThreats348(w)&&healthRandom(random)<.5)
    for(const mate of packmates348(w,a))if(mate.state!=='sleeping'&&mate.state!=='downed'&&startAnimalManhunter(w,mate,core,!!mate.health?.scaria261,true))joined++;
  const pack=joined?` ${joined===1?'Un congénère proche le rejoint':`${joined} congénères proches le rejoignent`}.`:'';
  w.events.push({tick:w.tick,type:'need',message:`Vengeance : ${notice(`${animalSpecies(a.species).label} ${a.id}`)} est pris de rage et s’en prend désormais aux humains.${pack}`});
  if(w.events.length>80)w.events.splice(0,w.events.length-80);
  return true;
}
/** Pawn_MindState.Notify_DamageTaken after an external-violence impact on a
 * still living, spawned wild animal: unless it is predator-hunting that very
 * instigator, one Rand.Chance of the species chance x difficulty (+0.5 with
 * scaria), x3 (the clamped distance factor, Core passes no distance), x(1 -
 * the instigator's HuntingStealth), clamped. Draws from the impact stream. */
export function rollManhunterOnHarm348(w:World,a:WildAnimal,instigatorKey:BombInstigatorKey|string|undefined,random:{rng:number},core:number):boolean {
  if(!isManhunterRevengeSchema348(w.schemaVersion)||!instigatorKey||a.health?.death||!spawned348(w,a)||revengeRefused348(a))return false;
  const instigator=revengeInstigator348(w,instigatorKey);if(!instigator||a.predation?.targetId===instigator.id)return false;
  if(!chance348(harmRevengeChance348(w,a,instigator.stealth),random))return false;
  return startRevenge348(w,a,random,core,animal=>`blessé, ${animal}`);
}
/** Pawn_MindState.CheckStartMentalStateBecauseRecruitAttempted after a
 * failed tame attempt: one Rand.Chance of the species chance, no difficulty. */
export function rollManhunterOnTameFail348(w:World,a:WildAnimal,tamer:Pawn):boolean {
  if(!isManhunterRevengeSchema348(w.schemaVersion)||!spawned348(w,a)||revengeRefused348(a))return false;
  if(!chance348(manhunterOnTameFailChance348(a),w))return false;
  const core=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10;
  return startRevenge348(w,a,w,core,animal=>`${animal} rejette l’apprivoisement de ${tamer.name},`);
}
