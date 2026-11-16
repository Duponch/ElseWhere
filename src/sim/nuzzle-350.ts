import {isMoodPool350,gainMoodPoolMemory350} from './mood-pool-memories-350.ts';
export {validAnimalNuzzle350,type AnimalNuzzle350} from './mood-pool-memories-350.ts';
import {isAnimalSpecies256,animalCore256} from './animal-core-v256.ts';
import {actualAnimalName256} from './starting-pet-state-256.ts';
import {animalSpecies} from './animal-species.ts';
import {isColonist} from './affiliation.ts';
import {isAggressiveMentalCrisis} from './mental-state.ts';
import {carrierOf} from './rescue-state.ts';
import {captureRoomQuality} from './room-quality.ts';
import type {AnimalAreaPolicy287} from './animal-area-policy-287.ts';
import type {ActualAnimalMind256} from './animal-condition-mental-state-256.ts';
import type {Cell,Pawn,World} from './types.ts';

/* Schema 350: tame animals nuzzle colonists (Animal.xml think tree, tame
 * animal branch after mating: ThinkNode_ChancePerHour_Nuzzle and
 * JobGiver_Nuzzle; JobDriver_Nuzzle; InteractionWorker_Nuzzle). Core facts:
 * - at most one check per 2 500 ticks, with the chance of an event of mean
 *   time nuzzleMtbHours hours over one hour (Rand.MTBEventOccurs(mtb, 2500,
 *   2500): 1/mtb), seeded by the animal and the hour (not a game stream);
 * - a random humanlike of the animal's faction within 40 cells, in the same
 *   room, standing where the animal may go, able to interact casually (not
 *   drafted, awake, not in an aggressive mental state);
 * - the animal walks to touch it (the job expires after 3 000 ticks), then
 *   the person gains Nuzzled (+4, a day, stack 3, ×0.5).
 * Adaptations: the hourly check is made when the animal is idle and free
 * (the think tree reaches the node only then); the chance and target are
 * kept on the animal's mind state (AnimalWanderState256.nuzzle350). */
const NUZZLE_CHECK_CORE=2500,NUZZLE_EXPIRY_CORE=3000;
/** RaceProperties.nuzzleMtbHours; the legacy species have none (-1). */
export function nuzzleMtbHours350(species:string):number {
 return isAnimalSpecies256(species)?animalCore256(species).race.nuzzleMtbHours:-1;
}
/** Rand.MTBEventOccurs under RandSeedForHour: a value drawn from the animal
 * and the hour, below 1/mtb. */
export function nuzzleHourChance350(seed:number,id:number,core:number,mtbHours:number):boolean {
 let h=(seed^Math.imul(id,0x9e3779b1)^Math.imul(Math.floor(core/2500),0x85ebca6b)^0x350a2e)>>>0;
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
 return (h>>>0)/0x100000000<1/mtbHours;
}
/** CanCasuallyInteractNow, for a colonist of the animal's faction. */
export function nuzzleRecipient350(w:World,p:Pawn):boolean {
 return w.pawns.includes(p)&&isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead'&&!p.health?.death&&!p.draft&&p.state!=='sleeping'&&!p.medicalSleep
  &&!(p.mental&&p.mental.crisis&&isAggressiveMentalCrisis(p.mental.crisis))&&!carrierOf(w,p.id)&&p.cryptosleepHeldAt271===undefined&&p.shipCryptosleepHeldAt277===undefined;
}
const touching=(a:Cell,b:Cell)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z))<=1;
const around=(c:Cell):Cell[]=>[{x:c.x-1,z:c.z},{x:c.x+1,z:c.z},{x:c.x,z:c.z-1},{x:c.x,z:c.z+1},{x:c.x-1,z:c.z-1},{x:c.x+1,z:c.z-1},{x:c.x-1,z:c.z+1},{x:c.x+1,z:c.z+1}];
interface NuzzleServices350 {
 policy?:AnimalAreaPolicy287;
 takeSearch():boolean;
 route(goals:Cell[]):Cell[]|undefined|null;
 random():number;
}
/** Called for an idle, free tame animal with no path, before hauling (Core
 * order). True when the animal spent its decision on the nuzzle job. */
export function processNuzzle350(w:World,a:ActualAnimalMind256,s:NuzzleServices350):boolean {
 const mind=a.wander;
 if(!isMoodPool350(w.schemaVersion)||!mind||!a.domestic||a.state==='dead'||a.state==='downed'||a.state==='sleeping'||a.state==='eating'||(a.motion?.end??0)>w.tick)return false;
 const core=w.tick*10,job=mind.nuzzle350;
 if(job?.targetId!==undefined){
  const t=w.pawns.find(p=>p.id===job.targetId);
  const inside=(c:Cell)=>!s.policy||s.policy.has(c.z*w.width+c.x);
  if(!t||!nuzzleRecipient350(w,t)||core-job.startCore!>=NUZZLE_EXPIRY_CORE||!inside(t)){mind.nuzzle350={tryCore:job.tryCore};return false;}
  if(touching(a,t)){
   mind.nuzzle350={tryCore:job.tryCore};a.path=[];a.state='idle';
   gainMoodPoolMemory350(t,'nuzzled',w.tick);
   const name=actualAnimalName256(a)??animalSpecies(a.species).label;
   w.events.push({tick:w.tick,type:'need',message:`${name} vient se frotter contre ${t.name}.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);
   return true;
  }
  if(!s.takeSearch())return true;
  const path=s.route(around(t).filter(inside));
  if(!path?.length){mind.nuzzle350={tryCore:job.tryCore};return false;}
  a.path=path;a.state='moving';a.nextDecision=w.tick;return true;
 }
 const mtb=nuzzleMtbHours350(a.species);
 if(mtb<=0||job&&core<job.tryCore+NUZZLE_CHECK_CORE)return false;
 mind.nuzzle350={tryCore:core};
 if(!nuzzleHourChance350(w.seed,a.id,core,mtb))return false;
 const topology=captureRoomQuality(w).topology,room=topology.at(a.x,a.z);
 const sameRoom=(c:Cell)=>{const r=topology.at(c.x,c.z);return !!room&&!!r&&r.kind===room.kind&&(r.kind!=='space'||room.kind!=='space'||r.id===room.id);};
 const candidates=w.pawns.filter(p=>nuzzleRecipient350(w,p)&&(p.x-a.x)**2+(p.z-a.z)**2<=40**2&&sameRoom(p)&&(!s.policy||s.policy.has(p.z*w.width+p.x)));
 if(!candidates.length)return false;
 const t=candidates[Math.floor(s.random()*candidates.length)]!;
 mind.nuzzle350={tryCore:core,targetId:t.id,startCore:core};delete mind.job;a.path=[];
 return true;
}
