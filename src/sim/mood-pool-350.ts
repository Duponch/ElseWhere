import {isColonist} from './affiliation.ts';
import {isBedKind} from './bed-kinds.ts';
import {captureRoomQuality} from './room-quality.ts';
import {addSocialMemory,expireSocialMemories,opinionOf,socialSeed} from './social-state.ts';
import {medicalBleed} from './injury-state.ts';
import {footprintCells} from './definitions.ts';
import {comfortForStructure,type FurnitureWorldLike} from './furniture-stats.ts';
import {isDiningSeat} from './dining.ts';
import type {MoodThought} from './mood.ts';
import {gainMoodPoolMemory350,isMoodPool350} from './mood-pool-memories-350.ts';
export {MOOD_POOL_SCHEMA_350,MOOD_POOL_MEMORIES_350,noteBondedAnimalDeaths350,gainMoodPoolMemory350,isMoodPool350,isMoodPoolMemory350,moodPoolMemoryThoughts350,type MoodPoolMemoryKind350} from './mood-pool-memories-350.ts';
import type {PsychicLevel350} from './psychic-state-350.ts';
import type {Pawn,Structure,World} from './types.ts';

/* Schema 350: the rest of the mood pool an ordinary colony meets in its first
 * seasons, read from the RimWorld 1.6 Core defs (ThoughtDefs,
 * MentalStateDefs/MentalStates_Mood.xml, IncidentDefs, GameConditionDefs) and
 * their classes. Older schemas never call this module. */
/* PsychicDrone thought (Thoughts_Situation_Special, ThoughtWorker_PsychicDrone):
 * a pawn on a map with an active psychic drone or soothe of its own gender.
 * Stages: soothe +16, low -12, moderate -22, high -30, extreme -40 (Core
 * incidents draw low, moderate or high). PsychicSensitivity is 1 here: no
 * Elsewhere trait or implant changes it. */
export const PSYCHIC_STAGES_350:Readonly<Record<PsychicLevel350,{readonly label:string;readonly offset:number}>>=Object.freeze({
 soothe:Object.freeze({label:'Apaisement psychique',offset:16}),low:Object.freeze({label:'Bourdonnement psychique faible',offset:-12}),
 moderate:Object.freeze({label:'Bourdonnement psychique modéré',offset:-22}),high:Object.freeze({label:'Bourdonnement psychique fort',offset:-30}),
 extreme:Object.freeze({label:'Bourdonnement psychique extrême',offset:-40}),
});
/** Elsewhere's humans carry their gender only in their drawn appearance. */
export const pawnGender350=(p:Pawn):'male'|'female'|'none'=>p.appearance?.sex??'none';
export function psychicDroneThought350(w:World,p:Pawn):MoodThought|undefined {
 const c=w.miscIncidents?.psychic350,now=w.tick*10;
 if(!isMoodPool350(w.schemaVersion)||!c||now<c.startCore||now>=c.endCore||!w.pawns.includes(p)||p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined||pawnGender350(p)!==c.gender)return;
 const stage=PSYCHIC_STAGES_350[c.level];
 return {id:`psychic-${c.level}`,label:stage.label,offset:stage.offset,kind:'situation',description:c.level==='soothe'
  ?'Une émission psychique lointaine apaise les esprits de ce genre sur cette carte, tant qu’elle dure.'
  :'Une émission psychique lointaine pousse les esprits de ce genre vers la folie sur cette carte, tant qu’elle dure.'};
}

/* HospitalPatientRoomStats (Thoughts_Situation_RoomStats,
 * ThoughtWorker_HospitalPatientRoomStats): lying in a medical bed in a room
 * whose role is Hospital (RoomRoleWorker_Hospital: a medical humanlike bed in
 * or beside the room, no prisoner bed), by the room's impressiveness stage. */
const HOSPITAL_OFFSETS_350=Object.freeze([-4,-2,null,null,1,2,3,4,5,6] as const);
const HOSPITAL_LABELS_350=Object.freeze(['Hôpital affreux','Hôpital terne',null,null,'Hôpital légèrement impressionnant','Hôpital assez impressionnant','Hôpital très impressionnant','Hôpital extrêmement impressionnant','Hôpital incroyablement impressionnant','Hôpital merveilleux'] as const);
export function lyingBed350(w:World,p:Pawn):Structure|undefined {
 const need=p.need;if(need?.kind!=='sleep'||need.phase!=='sleep'||need.bedId===null||p.moveCooldown>0||p.state==='dead')return;
 const bed=w.structures.find(s=>s.id===need.bedId&&isBedKind(s.kind));
 return bed&&footprintCells(bed).some(c=>c.x===p.x&&c.z===p.z)?bed:undefined;
}
export function hospitalPatientThought350(w:World,p:Pawn):MoodThought|undefined {
 if(!isMoodPool350(w.schemaVersion))return;
 const bed=lyingBed350(w,p);if(!bed?.medical)return;
 const room=captureRoomQuality(w).room(p);if(!room)return;
 const index=(x:number,z:number)=>z*w.width+x;let medical=false;
 for(const s of w.structures){
  if(!isBedKind(s.kind)||!footprintCells(s).some(c=>room.cells.has(index(c.x,c.z))||room.adjacent.has(index(c.x,c.z))))continue;
  if(s.prisoner)return;if(s.medical)medical=true;
 }
 const offset=HOSPITAL_OFFSETS_350[room.stage];if(!medical||offset==null)return;
 return {id:'hospital-patient-room',label:HOSPITAL_LABELS_350[room.stage]!,offset,kind:'situation',description:'Patient dans un lit médical d’un hôpital ; l’effet suit l’impression que donne la pièce.'};
}

/* OpinionOfMyLover (Thoughts_Situation_Social, Thought_OpinionOfMyLover):
 * the most liked living lover or spouse, a colonist; mood 0.1 × opinion, at
 * least 1 in magnitude, none at opinion 0. Adaptation: the partner must be on
 * the same map (an away partner is not read). */
export function opinionOfLoverThought350(w:World,p:Pawn):MoodThought|undefined {
 if(!isMoodPool350(w.schemaVersion))return;
 const links=w.relationships?.links;if(!links?.length)return;
 let best:{other:Pawn;spouse:boolean;opinion:number}|undefined;
 for(const l of links){
  if(l.kind!=='lover'&&l.kind!=='spouse'||l.aId!==p.id&&l.bId!==p.id)continue;
  const otherId=l.aId===p.id?l.bId:l.aId,other=w.pawns.find(q=>q.id===otherId);
  if(!other||other.state==='dead'||other.health?.death)continue;
  const opinion=opinionOf(p,other.id,w.tick,w);
  if(!best||opinion>best.opinion)best={other,spouse:l.kind==='spouse',opinion};
 }
 if(!best||!isColonist(best.other)||best.other.prisoner||best.opinion===0)return;
 const raw=.1*best.opinion,offset=raw<0?Math.min(raw,-1):Math.max(raw,1);
 return {id:`opinion-of-lover-${best.other.id}`,label:`Sentiment envers ${best.spouse?'son conjoint':'son partenaire'} ${best.other.name}`,offset,kind:'situation',
  description:'Vivre avec ce partenaire influence l’humeur : un dixième de l’opinion qu’on a de lui.'};
}

/* Small events. */
/** JobDriver_ReleasePrisoner: after the release, unless the prisoner would be
 * left to die (PawnBanishUtility.WouldBeLeftToDie: downed or bleeding more
 * than 0.4 per day), every free colonist and prisoner gains
 * ReleasedHealthyPrisoner (GenGuest.AddHealthyPrisonerReleasedThoughts).
 * Adaptation: the people of this map; the local temperature and
 * life-threatening disease tests are not read. */
export function releasedHealthyPrisoner350(w:World,prisoner:Pawn):void {
 if(!isMoodPool350(w.schemaVersion)||isColonist(prisoner)||prisoner.state==='downed'||(prisoner.health?medicalBleed(prisoner.health):0)>.4)return;
 for(const q of w.pawns)if(q!==prisoner&&q.state!=='dead'&&!q.health?.death&&(isColonist(q)&&!q.visitor||!!q.prisoner)&&q.cryptosleepHeldAt271===undefined&&q.shipCryptosleepHeldAt277===undefined)
  gainMoodPoolMemory350(q,'released-prisoner',w.tick,prisoner.id);
}
/* BondedAnimalLost (the Bond relation's lostThought) is given in
 * world-map-lost.ts, when a map is lost with a bonded animal left on it. */

/** Pawn_RelationsTracker.Notify_RescuedBy (RestUtility.TuckIntoBed of a
 * Rescue job): a humanlike rescued into a bed by another person gains the
 * RescuedMe opinion memory of its rescuer. Adaptations: colonists only, and
 * every completed rescue counts (Core arms it again only after a hostile
 * blow, a flag Elsewhere does not keep). */
export function rescuedMe350(w:World,patient:Pawn,rescuer:Pawn):void {
 if(!isMoodPool350(w.schemaVersion)||patient===rescuer||!isColonist(patient)||patient.prisoner||patient.state==='dead')return;
 const state=patient.social??={rng:socialSeed(w.seed,patient.id),memories:[]};
 expireSocialMemories(patient,w.tick);addSocialMemory(state,rescuer.id,'rescued-me',w.tick,1);
}

/** Toils_Recipe.DoRecipeWork: GainComfortFromCellIfPossible(chairsOnly): a
 * pawn working a bill gains comfort from the sittable building on its cell. */
export function benchSeatComfort350(w:World,p:Pawn,furniture:FurnitureWorldLike):number|undefined {
 const task=p.cooking;
 if(!isMoodPool350(w.schemaVersion)||!task||task.phase!=='work'||p.state!=='working'||p.x!==task.spot.x||p.z!==task.spot.z||p.moveCooldown>0)return;
 const seat=w.structures.find(s=>isDiningSeat(s.kind)&&s.x===p.x&&s.z===p.z);
 return seat?comfortForStructure(furniture,seat)*100:undefined;
}
