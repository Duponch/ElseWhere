import {isRoofed} from './roof-rules.ts';
import {annualNaturalLight} from './environment.ts';
import {sharedLightEnvironmentCache} from './light-environment.ts';
import {weatherTransition} from './weather.ts';
import {terrainIsWater256} from './natural-terrain-runtime-256.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {pawnBody} from './health-rules.ts';
import {isColonist} from './affiliation.ts';
import {readAnimalTraining282} from './animal-training-282.ts';
import {actualAnimalName256} from './starting-pet-state-256.ts';
import {firstDaysAdmitted343,removeFirstDaysMemory343,setFirstDaysMemory343} from './first-days-memories-343.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {MoodThought} from './mood.ts';
import type {Pawn,World} from './types.ts';
export {isFirstDays343,darknessThought343} from './first-days-memories-343.ts';

/* Schema 343: soaking wet, darkness samples and bonded animal masters. */
/** Pawn_MindState: every 120 Core ticks (hashed per pawn), a spawned pawn on
 * water terrain, or outside under rain (CurWeatherLerped: the previous weather
 * until half of the 4 000-tick transition), gains or renews SoakingWet. */
const WET_WEATHER=new Set(['rain','rainy-thunderstorm','foggy-rain']);
function lerpedWeather(w:World):string|undefined {const s=w.weather;if(!s)return;return weatherTransition(w)<.5?s.previous:s.current;}
export function standingInWater343(w:World,p:Pawn):boolean {
 const tile=w.tiles[p.z*w.width+p.x];return !!tile&&!tile.bridge&&!tile.floor&&(tile.terrain==='water'||terrainIsWater256(tile.terrain));
}
export function advanceSoakingWet343(w:World,p:Pawn):void {
 if(!firstDaysAdmitted343(w,p)||!groupPawnInterval256(p.id,Math.max(0,(w.tick-1)*10+1),120,10))return;
 const weather=lerpedWeather(w);
 if(standingInWater343(w,p)||weather!==undefined&&WET_WEATHER.has(weather)&&!isRoofed(w,p.z*w.width+p.x))setFirstDaysMemory343(p,'soaking-wet',w.tick);
}

/** PawnRecentMemory.RecentMemoryInterval, after the mood step of the same need
 * interval: light above 0.3 (PsychGlow Lit or Overlit) clears the darkness
 * entry, darkness records it. A blind pawn never has the thought. */
export function lightAtPawn343(w:World,p:Pawn):number {
 const index=p.z*w.width+p.x,sky=annualNaturalLight(w);
 if(Number.isFinite(sky)&&sky>.3&&!isRoofed(w,index))return sky;
 return sharedLightEnvironmentCache(w).read(w).lightAt({x:p.x,z:p.z});
}
export function sampleDarkness343(w:World,p:Pawn,body?:BodyAssessment):void {
 if(!firstDaysAdmitted343(w,p))return;
 if((body??pawnBody(p)).capacities.sight<=0||lightAtPawn343(w,p)>.3)removeFirstDaysMemory343(p,'darkness');
 else setFirstDaysMemory343(p,'darkness',w.tick);
}
/** ThoughtWorker_BondedAnimalMaster and NotBondedAnimalMaster: each living
 * spawned colony animal bonded to this pawn that has learned Obedience; +5
 * when this pawn is its respected master, -3 otherwise, at most three each.
 * The only bonds Elsewhere forms are those of the starting pet. */
export function bondedAnimalThoughts343(w:World,p:Pawn):MoodThought[] {
 const animals=w.wildlife?.animals;if(!animals?.length)return [];
 const mastered:string[]=[],other:string[]=[];
 for(const a of animals){
  const pet=a.startingPet;if(pet?.bondedPawnId!==p.id||a.state==='dead'||!a.domestic||a.shipCryptosleepHeldAt277!==undefined)continue;
  if(!readAnimalTraining282(a,'obedience').learned)continue;
  const name=actualAnimalName256(a)??'compagnon';
  if((a.training?.masterId??pet.masterId)===p.id&&isColonist(p))mastered.push(name);else other.push(name);
 }
 const thoughts:MoodThought[]=[];
 if(mastered.length)thoughts.push({id:'bonded-animal-master',label:`Maître de son compagnon lié : ${mastered.join(', ')}`,offset:5*Math.min(3,mastered.length),kind:'situation',description:'Un animal lié et obéissant suit ce colon comme maître. +5 par animal, trois au plus.'});
 if(other.length)thoughts.push({id:'not-bonded-animal-master',label:`Compagnon lié confié à un autre : ${other.join(', ')}`,offset:-3*Math.min(3,other.length),kind:'situation',description:'Un animal lié à ce colon a un autre maître ou aucun. −3 par animal, trois au plus.'});
 return thoughts;
}
