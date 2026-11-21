import {schemaAtLeast} from './schema-range.ts';
import {isColonist} from './affiliation.ts';
import {backgroundSkillRefusal,backgroundWorkRefusal,type BackgroundSkillId} from './colonist-backgrounds.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {pawnBody} from './health-rules.ts';
import {HUMAN_YEAR_TICKS} from './human-age.ts';
import {inspirationStream360} from './inspiration-stream-360.ts';
import {sendLetter352} from './letters-352.ts';
import type {BodyAssessment} from './body-capacities.ts';
import {TICKS_PER_DAY,type Pawn,type World,type WorkType} from './types.ts';

/* Inspirations of Core RimWorld 1.6 (schema 360).
 *
 * Core facts (Defs/InspirationDefs/Inspirations.xml; InspirationHandler,
 * Inspiration, InspirationWorker, InspirationDef, Rand.MTBEventOccurs,
 * GenCollection.RandomElementByWeightWithFallback):
 * - each pawn's handler checks every 100 Core ticks at its hashed tick
 *   (IsHashIntervalTick(100)), if it is not inspired and can be awake; under
 *   50 % mood nothing happens, from 50 % the mean time between inspirations
 *   goes linearly from 210 days down to 10 days at 100 % mood; the event is
 *   Rand.MTBEventOccurs(mtb, 60000, 100);
 * - the kind is drawn among the defs whose worker admits the pawn (a free
 *   colonist, not downed for the go frenzy, minimum age, required skills,
 *   work types, capacities, stats not disabled), weighted by the base
 *   commonality 1 times the best passion of the associated skills (none 1,
 *   minor 2.5, burning 5);
 * - all eight defs last 8 days of the pawn's own ticks; the four "inspired"
 *   kinds also end when used (the trade deal, the recruited prisoner, the
 *   tamed animal, the surgery, the created item); the begin letter is a
 *   PositiveEvent, the end a NeutralEvent message;
 * - a destroyed (dead) pawn loses its inspiration without a message; a downed
 *   pawn or a mental state keeps it (Pawn_MindState.Reset is only told to
 *   clear it on Destroy);
 * - effects: WorkSpeedGlobal ×1.8, MoveSpeed ×1.4, ShootingAccuracyPawn +8,
 *   TradePriceImprovement +0.18 (then the stat's 0.395 cap), certain
 *   recruitment of a prisoner set to recruit, certain taming, surgery
 *   success ×2 before the 0.98 clamp, created quality +2 levels up to
 *   legendary.
 *
 * Elsewhere keeps the active inspiration on the pawn (kind, start tick,
 * expiry tick, saved strictly from 360). Its draws come from an own stream
 * (inspiration-stream-360.ts); below 360 nothing is drawn or written. */
export const isInspirations360=schemaAtLeast(360);

export type InspirationKind360='work-frenzy'|'go-frenzy'|'shoot-frenzy'|'trade'|'recruitment'|'taming'|'surgery'|'creativity';
export interface Inspiration360 {
  kind:InspirationKind360;
  /** Local tick of the start. */
  start:number;
  /** Local tick of the end by expiry; moved later while the pawn is held in
   * cryptosleep (Core does not tick a suspended pawn). */
  until:number;
}

/** Core InspirationHandler.CheckStartInspirationIntervalTicks. */
export const INSPIRATION_CHECK_CORE_TICKS_360=100;
/** Core InspirationHandler.MinMood and the MTB days at 50 % and 100 % mood. */
export const INSPIRATION_MIN_MOOD_360=.5,INSPIRATION_MTB_DAYS_AT_MIN_360=210,INSPIRATION_MTB_DAYS_AT_MAX_360=10;
/** Core InspirationDef.baseDurationDays (8 for every Core def), in local ticks. */
export const INSPIRATION_DURATION_360=8*TICKS_PER_DAY;

type Capacity360='moving'|'talking'|'manipulation';
interface InspirationDef360 {
  readonly kind:InspirationKind360;
  readonly def:string;
  readonly label:string;
  readonly allowedOnDowned:boolean;
  readonly minAge:number;
  /** requiredNonDisabledStats: the stat's required skill must not be totally disabled. */
  readonly statSkill?:BackgroundSkillId;
  readonly skills?:readonly (readonly [BackgroundSkillId,number])[];
  readonly anySkill?:readonly (readonly [BackgroundSkillId,number])[];
  readonly work?:readonly WorkType[];
  readonly anyWork?:readonly WorkType[];
  readonly capacities?:readonly Capacity360[];
  readonly associated?:readonly BackgroundSkillId[];
  readonly begin:string;
}
/** Core InspirationDefs in their load order (the order of the weighted draw). */
export const INSPIRATIONS_360:readonly InspirationDef360[]=Object.freeze([
  {kind:'work-frenzy',def:'Frenzy_Work',label:'Frénésie de travail',allowedOnDowned:true,minAge:10,begin:'Pendant les 8 prochains jours, ce colon travaillera beaucoup plus vite : toutes ses tâches avancent 80 % plus vite.'},
  {kind:'go-frenzy',def:'Frenzy_Go',label:'Frénésie de mouvement',allowedOnDowned:false,minAge:0,capacities:['moving'],begin:'Pendant les 8 prochains jours, ce colon se déplacera 40 % plus vite.'},
  {kind:'shoot-frenzy',def:'Frenzy_Shoot',label:'Frénésie de tir',allowedOnDowned:true,minAge:8,statSkill:'shooting',associated:['shooting'],begin:'Pendant les 8 prochains jours, ce colon tirera avec une bien meilleure précision.'},
  {kind:'trade',def:'Inspired_Trade',label:'Commerce inspiré',allowedOnDowned:true,minAge:6,statSkill:'social',skills:[['social',3]],associated:['social'],begin:'Lors de son prochain échange avec un marchand, ce colon obtiendra des prix nettement meilleurs (+18 points d’avantage de négociation, plafonné comme d’habitude).\n\nL’inspiration prend fin après 8 jours, ou une fois l’échange conclu.'},
  {kind:'recruitment',def:'Inspired_Recruitment',label:'Recrutement inspiré',allowedOnDowned:true,minAge:10,statSkill:'social',skills:[['social',3]],work:['warden'],capacities:['talking'],associated:['social'],begin:'Ce colon convaincra le prochain prisonnier qu’il tente de recruter, quelle que soit sa résistance.\n\nL’inspiration prend fin après 8 jours, ou une fois le prisonnier recruté.'},
  {kind:'taming',def:'Inspired_Taming',label:'Apprivoisement inspiré',allowedOnDowned:true,minAge:0,statSkill:'animals',skills:[['animals',3]],work:['handle'],capacities:['talking'],associated:['animals'],begin:'Ce colon apprivoisera à coup sûr le prochain animal qu’il tente d’apprivoiser, quelle que soit la difficulté.\n\nL’inspiration prend fin après 8 jours, ou une fois l’animal apprivoisé.'},
  {kind:'surgery',def:'Inspired_Surgery',label:'Chirurgie inspirée',allowedOnDowned:true,minAge:13,statSkill:'medicine',skills:[['medicine',3]],work:['doctor'],capacities:['manipulation'],associated:['medicine'],begin:'Lors de sa prochaine opération, ce colon aura deux fois plus de chances de réussir. Un petit risque d’échec demeure.\n\nL’inspiration prend fin après 8 jours, ou une fois l’opération faite.'},
  {kind:'creativity',def:'Inspired_Creativity',label:'Créativité inspirée',allowedOnDowned:true,minAge:13,anySkill:[['construction',3],['artistic',3],['crafting',3]],anyWork:['art','smith','build','tailor'],capacities:['manipulation'],associated:['artistic'],begin:'Le prochain objet, la prochaine œuvre ou le prochain meuble que ce colon crée aura deux niveaux de qualité de plus, jusqu’à légendaire.\n\nL’inspiration prend fin après 8 jours, ou une fois la création terminée.'},
]);
const BY_KIND=new Map(INSPIRATIONS_360.map(d=>[d.kind,d]));
export const INSPIRATION_KINDS_360:readonly InspirationKind360[]=INSPIRATIONS_360.map(d=>d.kind);
export const inspirationLabel360=(kind:InspirationKind360):string=>BY_KIND.get(kind)!.label;

/** The active inspiration of a living pawn (Core Pawn.InspirationDef is null
 * once dead). Readers need no schema test: the field exists only from 360. */
export const inspirationKind360=(p:Pawn):InspirationKind360|undefined=>p.state==='dead'||p.health?.death?undefined:p.inspiration360?.kind;
/** Frenzy_Work: WorkSpeedGlobal factor 1.8 (every work stat has WorkSpeedGlobal
 * as a factor: construction, mining, plants, medicine, research, recipes…). */
export const workSpeedInspirationFactor360=(p:Pawn):number=>inspirationKind360(p)==='work-frenzy'?1.8:1;
/** Frenzy_Go: MoveSpeed factor 1.4. */
export const moveSpeedInspirationFactor360=(p:Pawn):number=>inspirationKind360(p)==='go-frenzy'?1.4:1;
/** Frenzy_Shoot: ShootingAccuracyPawn offset +8, before the stat's curve. */
export const shootingAccuracyInspirationOffset360=(p:Pawn):number=>inspirationKind360(p)==='shoot-frenzy'?8:0;
/** Inspired_Trade: TradePriceImprovement offset +0.18, before the stat's cap. */
export const tradePriceInspirationOffset360=(p:Pawn):number=>inspirationKind360(p)==='trade'?.18:0;
/** Inspired_Surgery: SurgeryOutcomeComp_Inspired factor 2, before ClampToRange(0, 0.98). */
export const SURGERY_INSPIRATION_FACTOR_360=2;
/** Inspired_Creativity: QualityUtility.AddLevels(quality, 2), at most legendary. */
export const CREATIVITY_QUALITY_LEVELS_360=2;

function announce(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}
/** Core InspirationHandler.EndInspiration: the end message (a NeutralEvent
 * message in Core; Elsewhere's messages are the colony journal). */
export function endInspiration360(world:World,pawn:Pawn):void {
  const current=pawn.inspiration360;if(!current)return;
  delete pawn.inspiration360;
  announce(world,`L’inspiration de ${pawn.name} prend fin (${inspirationLabel360(current.kind).toLowerCase()}).`);
}
/** The consumer of an "inspired" kind uses it up (Core EndInspiration(def)
 * after the deal, the recruitment, the taming, the surgery or the creation).
 * True when the pawn had that inspiration and it is now spent. */
export function useInspiration360(world:World,pawn:Pawn,kind:InspirationKind360):boolean {
  if(inspirationKind360(pawn)!==kind)return false;
  endInspiration360(world,pawn);
  return true;
}

const skillLevel=(p:Pawn,skill:BackgroundSkillId):number=>backgroundSkillRefusal(p,skill)?0:p.skills[skill]?.level??0;
/** Core PawnCapacitiesHandler.CapableOf: level above minForCapable (Moving 0.15, others 0). */
const capable=(body:BodyAssessment,capacity:Capacity360):boolean=>body.capacities[capacity]>(capacity==='moving'?.15:0);
const ageYears=(p:Pawn):number=>p.age?p.age.biologicalTicks/HUMAN_YEAR_TICKS:Number.POSITIVE_INFINITY;
/** Core Pawn.IsColonist: the player's faction, not a prisoner or a guest. */
export const inspirationColonist360=(p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue;

/** Core InspirationWorker.InspirationCanOccur for one def. */
export function inspirationCanOccur360(p:Pawn,kind:InspirationKind360,body:BodyAssessment=pawnBody(p)):boolean {
  const d=BY_KIND.get(kind)!;
  if(!inspirationColonist360(p)||!d.allowedOnDowned&&p.state==='downed')return false;
  if(d.statSkill&&backgroundSkillRefusal(p,d.statSkill))return false;
  if(d.skills&&!d.skills.every(([skill,level])=>skillLevel(p,skill)>=level))return false;
  if(d.anySkill&&!d.anySkill.some(([skill,level])=>skillLevel(p,skill)>=level))return false;
  if(d.work&&d.work.some(work=>backgroundWorkRefusal(p,work)))return false;
  if(d.anyWork&&!d.anyWork.some(work=>!backgroundWorkRefusal(p,work)))return false;
  if(d.capacities&&!d.capacities.every(capacity=>capable(body,capacity)))return false;
  return ageYears(p)>=d.minAge;
}
/** Core InspirationWorker.CommonalityFor: base 1 times the best passion factor. */
export function inspirationCommonality360(p:Pawn,kind:InspirationKind360):number {
  let factor=1;
  for(const skill of BY_KIND.get(kind)!.associated??[]){const passion=p.skills[skill]?.passion??0;factor=Math.max(factor,passion===2?5:passion===1?2.5:1);}
  return factor;
}
/** Core GetRandomAvailableInspirationDef: the filtered defs are an enumerable,
 * so RandomElementByWeightWithFallback keeps the first admitted def without a
 * draw, then for each later one draws Range(0, total + weight) >= total. */
export function randomAvailableInspiration360(p:Pawn,random:()=>number,body:BodyAssessment=pawnBody(p)):InspirationKind360|undefined {
  let chosen:InspirationKind360|undefined,total=0;
  for(const d of INSPIRATIONS_360){
    if(!inspirationCanOccur360(p,d.kind,body))continue;
    const weight=inspirationCommonality360(p,d.kind);
    if(total===0){if(weight>0){chosen=d.kind;total=weight;}continue;}
    if(random()*(total+weight)>=total)chosen=d.kind;
    total+=weight;
  }
  return chosen;
}
/** Core InspirationHandler.StartInspirationMTBDays: GenMath.LerpDouble(0.5, 1,
 * 210, 10, mood), or none under 50 % mood. */
export function inspirationMtbDays360(mood01:number):number|undefined {
  if(!(mood01>=INSPIRATION_MIN_MOOD_360))return undefined;
  return INSPIRATION_MTB_DAYS_AT_MIN_360+(mood01-INSPIRATION_MIN_MOOD_360)/(1-INSPIRATION_MIN_MOOD_360)*(INSPIRATION_MTB_DAYS_AT_MAX_360-INSPIRATION_MTB_DAYS_AT_MIN_360);
}
/** Core Rand.MTBEventOccurs(mtb, mtbUnit, ticksSinceLastCheck): a very small
 * chance is first gated by 1/8^n, as Core does, then compared. */
export function mtbEventOccurs360(mtb:number,unit:number,check:number,random:()=>number):boolean {
  if(mtb===Number.POSITIVE_INFINITY)return false;
  if(mtb<=0)return true;
  let chance=check/(mtb*unit),gate=1;
  if(chance<1e-4){while(chance<1e-4){chance*=8;gate/=8;}if(random()>gate)return false;}
  return random()<chance;
}

/** Core InspirationHandler.TryStartInspiration then Inspiration.PostStart:
 * the begin letter (PositiveEvent), the reason first. */
export function startInspiration360(world:World,pawn:Pawn,kind:InspirationKind360,reason=`Grâce à son excellente humeur, ${pawn.name} trouve l’inspiration !`):boolean {
  if(!isInspirations360(world.schemaVersion)||pawn.inspiration360||!inspirationCanOccur360(pawn,kind))return false;
  if(!Number.isSafeInteger(world.tick+INSPIRATION_DURATION_360))return false;
  pawn.inspiration360={kind,start:world.tick,until:world.tick+INSPIRATION_DURATION_360};
  const d=BY_KIND.get(kind)!;
  sendLetter352(world,{cls:'positive',title:`${d.label} : ${pawn.name}`,text:`${reason}\n\n${d.begin}`,targets:[{kind:'actor',id:pawn.id}]});
  return true;
}

/** Core InspirationHandlerTickInterval for one pawn of the map, each local tick
 * (ten Core ticks): the current inspiration ends at its expiry, then at the
 * pawn's hashed 100-tick interval a new one may start. A dead pawn loses it
 * silently. Before schema 360 this returns at once (no draw, no write). */
export function tickInspiration360(world:World,pawn:Pawn,body?:BodyAssessment):void {
  if(!isInspirations360(world.schemaVersion))return;
  if(pawn.state==='dead'||pawn.health?.death){if(pawn.inspiration360)delete pawn.inspiration360;return;}
  const current=pawn.inspiration360;
  if(current&&world.tick>=current.until)endInspiration360(world,pawn);
  if(pawn.inspiration360||!inspirationColonist360(pawn)||world.tick<1)return;
  if(!groupPawnInterval256(pawn.id,(world.tick-1)*10+1,INSPIRATION_CHECK_CORE_TICKS_360,10))return;
  const bodyNow=body??pawnBody(pawn);
  if(!bodyNow.canBeAwake)return;
  const mtb=inspirationMtbDays360(pawn.mood/100);
  if(mtb===undefined)return;
  const random=inspirationStream360(world.seed,pawn.id,world.tick);
  if(!mtbEventOccurs360(mtb,60000,INSPIRATION_CHECK_CORE_TICKS_360,random))return;
  const kind=randomAvailableInspiration360(pawn,random,bodyNow);
  if(kind)startInspiration360(world,pawn,kind);
}

const remaining=(ticks:number):string=>ticks>=TICKS_PER_DAY?`${(ticks/TICKS_PER_DAY).toFixed(1).replace('.',',')} jours`:`${Math.max(1,Math.ceil(ticks/(TICKS_PER_DAY/24)))} h`;
/** Core Inspiration.InspectLine: the label and the time left. */
export function inspirationInspectLine360(world:World,pawn:Pawn):{label:string;value:string;hint:string}|undefined {
  const kind=inspirationKind360(pawn),current=pawn.inspiration360;if(!kind||!current)return undefined;
  const d=BY_KIND.get(kind)!;
  return {label:`Inspiration : ${d.label.toLowerCase()}`,value:`expire dans ${remaining(Math.max(0,current.until-world.tick))}`,hint:d.begin};
}

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
/** Strict: absent below 360; a known kind, integer ticks, an expiry at least
 * the full duration after a start that is not in the future. */
export function validInspirationField360(item:Record<string,unknown>,version:number,tick:number):boolean {
  const d=Object.getOwnPropertyDescriptor(item,'inspiration360');
  if(!d)return !('inspiration360'in item);
  if(!isInspirations360(version)||!('value'in d)||d.enumerable!==true)return false;
  const v=d.value;
  if(!plain(v)||Reflect.ownKeys(v).length!==3||!['kind','start','until'].every(k=>Object.hasOwn(v,k))||!INSPIRATION_KINDS_360.includes(v.kind as InspirationKind360))return false;
  const {start,until}=v;
  return Number.isSafeInteger(start)&&Number.isSafeInteger(until)&&(start as number)>=0&&(start as number)<=tick&&(until as number)-(start as number)>=INSPIRATION_DURATION_360;
}
