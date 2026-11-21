import {isColonist} from './affiliation.ts';
import {coupleBed285} from './couple-bed-285.ts';
import {pawnBody} from './health-rules.ts';
import {currentMedicalBed} from './hospital-medical-stats.ts';
import {carrierOf} from './rescue-state.ts';
import {roofKindAt} from './roof-rules.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {MoodThought} from './mood.ts';
import type {Pawn,World} from './types.ts';

/* Schema 359: the outdoors need of RimWorld 1.6 Core (cabin fever), read from
 * Need_Outdoors, Need, Pawn_NeedsTracker, ThoughtWorker_NeedOutdoors,
 * GridsUtility.UsesOutdoorTemperature, Room.UsesOutdoorTemperature and the
 * defs NeedDef Outdoors (Needs.xml) and ThoughtDef NeedOutdoors
 * (Thoughts_Situation_Needs.xml). Older schemas never call this module. */
export const OUTDOORS_SCHEMA_359=359;
export const isOutdoors359=(version:unknown):boolean=>Number(version)>=OUTDOORS_SCHEMA_359;

const f=Math.fround;
/** Need_Outdoors.SetInitialLevel: 1. A colonist or prisoner without the saved
 * field (a new pawn, a migrated save, a pawn that regains the need) is here:
 * Pawn_NeedsTracker.AddNeed calls SetInitialLevel for a need that appears on
 * an existing pawn too, so an old colony starts every pawn at 1. */
export const OUTDOORS_INITIAL_359=1;
export const outdoorsLevel359=(p:Pick<Pawn,'outdoors359'>):number=>p.outdoors359??OUTDOORS_INITIAL_359;

/** NeedDef Outdoors: colonistAndPrisonersOnly, humanlike (Elsewhere's people
 * are all humanlike adults: Core's Child|Adult stage filter keeps them all).
 * The one hook for a trait that disables the need: Core's Undergrounder
 * (TraitDef disablesNeeds Outdoors) must make this false once the trait
 * exists; the step then removes the field, like Pawn_NeedsTracker.RemoveNeed. */
export const outdoorsNeedApplies359=(p:Pawn):boolean=>!!p.prisoner||isColonist(p)&&!p.visitor;

/** Need_Outdoors.CurCategory, strict and inclusive bounds as in Core. */
export type OutdoorsCategory359='free'|'need-fresh-air'|'cabin-fever-light'|'cabin-fever-severe'|'trapped'|'entombed';
export function outdoorsCategory359(level:number):OutdoorsCategory359 {
  return level>f(.8)?'free':level>f(.6)?'need-fresh-air':level>f(.4)?'cabin-fever-light':level>=f(.2)?'cabin-fever-severe':level>f(.05)?'trapped':'entombed';
}

/** Need_Outdoors.NeedInterval constants: the per-day rate of each place, the
 * thin-roof floor, the in-bed factor of a falling rate and the 0.0025 that
 * turns a rate into one interval's change (150 Core ticks: rate × 1/400 day). */
const RATE={'outdoors-open':8,'outdoors-thin':1,'outdoors-thick':f(-.4),'indoors-open':5,'indoors-thin':f(-.32),'indoors-thick':f(-.45)} as const;
export type OutdoorsPlace359=keyof typeof RATE;
const THIN_FLOOR=f(.2),IN_BED=f(.2),PER_INTERVAL=f(.0025);

/** Thermal rooms are the rooms that keep their own air: Room.UsesOutdoorTemperature
 * is false (not touching the map edge, fewer than a quarter of the cells
 * unroofed; a roofed door is a room of its own). Their cell lists are sorted
 * (temperature-save validates it), so one range test and a binary search per
 * room answer for a cell. Outside every such room, the cell uses the outdoor
 * temperature. */
function keepsOwnAir(world:Pick<World,'thermal'>,index:number):boolean {
  const regions=world.thermal?.regions;if(!regions)return false;
  for(const {cells} of regions){
    if(index<cells[0]!||index>cells[cells.length-1]!)continue;
    let low=0,high=cells.length-1;
    while(low<=high){const mid=(low+high)>>>1,value=cells[mid]!;if(value===index)return true;if(value<index)low=mid+1;else high=mid-1;}
  }
  return false;
}

/** Where Need_Outdoors.NeedInterval finds the pawn. Not spawned (carried by
 * another pawn) counts as outdoors under no roof, as in Core. Pawn.Position
 * is the cell the pawn stands in until it enters the next one: during a step
 * that is the step's origin. Roofs: constructed and thin rock roofs are thin
 * (RoofDef isThickRoof false), the overhead mountain is thick. */
export function outdoorsPlace359(world:World,pawn:Pawn):OutdoorsPlace359 {
  if(carrierOf(world,pawn.id))return 'outdoors-open';
  const at=pawn.motion&&pawn.motion.end>world.tick?pawn.motion.from:pawn,index=at.z*world.width+at.x;
  const roof=roofKindAt(world,index),side=keepsOwnAir(world,index)?'indoors':'outdoors';
  return `${side}-${roof===undefined?'open':roof==='natural-thick'?'thick':'thin'}`;
}

/** Need.IsFrozen with freezeWhileSleeping: suspended (a cryptosleep casket),
 * asleep or unable to be awake. Dead: the need no longer runs. */
function frozen(pawn:Pawn,body?:BodyAssessment):boolean {
  return pawn.state==='dead'||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined
    ||pawn.state==='sleeping'||!!pawn.medicalSleep||!(body??pawnBody(pawn)).canBeAwake;
}

/** One NeedInterval step from `level` at `place`. A falling level never drops
 * below the floor (0.2 under a thin roof or outdoors under a thick one, 0
 * indoors under a thick roof) and never rises because of it; a rising one
 * stops at 1. Single precision, as Core computes it. */
export function outdoorsStep359(level:number,place:OutdoorsPlace359,inBed:boolean):number {
  let rate:number=RATE[place];
  if(inBed&&rate<0)rate=f(rate*IN_BED);
  const change=f(rate*PER_INTERVAL);
  const next=change<0?Math.min(level,Math.max(f(level+change),place==='indoors-thick'?0:THIN_FLOOR)):Math.min(f(level+change),1);
  return Math.max(0,Math.min(1,next));
}
function store(pawn:Pawn,level:number):void {
  // Absent is the initial level 1: a pawn that never left the sky keeps no field.
  if(level!==outdoorsLevel359(pawn))pawn.outdoors359=level;
}

/** Need_Outdoors.NeedInterval on the map, at the pawn's own need interval
 * (the caller's wellbeing step). In a bed (awake: asleep is frozen) a falling
 * rate is five times slower (Pawn.InBed: the bed the pawn lies in now). */
export function advanceOutdoors359(world:World,pawn:Pawn,body?:BodyAssessment):void {
  if(!isOutdoors359(world.schemaVersion))return;
  if(!outdoorsNeedApplies359(pawn)){if(pawn.outdoors359!==undefined)delete pawn.outdoors359;return;}
  if(frozen(pawn,body))return;
  const place=outdoorsPlace359(world,pawn);
  // A falling rate means the pawn is on the map (a carried pawn is outdoors-open).
  const inBed=RATE[place]<0&&!!(coupleBed285(world,pawn)??currentMedicalBed(world,pawn,false));
  store(pawn,outdoorsStep359(outdoorsLevel359(pawn),place,inBed));
}

/** The same interval in a caravan on the world map: the pawn is not spawned,
 * which Need_Outdoors reads as outdoors under no roof (+8 per day). Caravan
 * pawns have no job, so they are awake unless they cannot be (Core's
 * RestUtility.Awake); the caller runs it at the pawn's hashed interval. */
export function advanceCaravanOutdoors359(pawn:Pawn,body?:BodyAssessment):void {
  if(!outdoorsNeedApplies359(pawn)){if(pawn.outdoors359!==undefined)delete pawn.outdoors359;return;}
  if(pawn.health?.death||frozen(pawn,body))return;
  store(pawn,outdoorsStep359(outdoorsLevel359(pawn),'outdoors-open',false));
}

/** ThoughtDef NeedOutdoors (ThoughtWorker_NeedOutdoors), stages 0 to 4. Not
 * for a pawn the colony holds (HostFaction: prisoners), nor while not spawned
 * (the def is not validWhileDespawned: carried, in a casket; the caravan pass
 * gives no such context). */
const THOUGHTS:Readonly<Record<Exclude<OutdoorsCategory359,'free'>,MoodThought>>=Object.freeze({
  entombed:Object.freeze({id:'outdoors-entombed',label:'Enseveli sous terre',offset:-9,kind:'situation' as const,description:'Plein air à 5 % ou moins : le poids de la roche au-dessus de lui devient insupportable, il lui faut le ciel et le vent.'}),
  trapped:Object.freeze({id:'outdoors-trapped',label:'Prisonnier sous terre',offset:-7,kind:'situation' as const,description:'Plein air sous 20 % : trop longtemps sous terre, il a besoin d’air frais et de ciel.'}),
  'cabin-fever-severe':Object.freeze({id:'outdoors-cabin-fever',label:'Syndrome de la cabane',offset:-5,kind:'situation' as const,description:'Plein air de 20 à 40 % : à force de rester à l’intérieur, le toit semble l’écraser.'}),
  'cabin-fever-light':Object.freeze({id:'outdoors-trapped-indoors',label:'Enfermé à l’intérieur',offset:-3,kind:'situation' as const,description:'Plein air de 40 à 60 % : cela fait trop longtemps qu’il n’a pas vu le ciel.'}),
  'need-fresh-air':Object.freeze({id:'outdoors-stuck-indoors',label:'Envie de prendre l’air',offset:-1,kind:'situation' as const,description:'Plein air de 60 à 80 % : il aimerait sortir respirer un peu.'}),
});
export function outdoorsThought359(world:World,pawn:Pawn):MoodThought|undefined {
  if(!isOutdoors359(world.schemaVersion)||pawn.prisoner||!outdoorsNeedApplies359(pawn))return;
  const category=outdoorsCategory359(outdoorsLevel359(pawn));
  if(category==='free'||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined||carrierOf(world,pawn.id))return;
  return THOUGHTS[category];
}

/** Strict save reading: absent before 359; from 359 absent (the initial
 * level) or a single-precision level between 0 and 1. */
export function validOutdoorsField359(item:Record<string,unknown>,version:number):boolean {
  if(!Object.hasOwn(item,'outdoors359'))return true;
  const v=item.outdoors359;
  return isOutdoors359(version)&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1&&f(v)===v;
}
