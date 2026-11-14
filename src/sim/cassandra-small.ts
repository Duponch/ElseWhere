import {homeIncidentsBlocked261} from './temp-map-incidents-261.ts';
import { isColonist } from './affiliation.ts';
import { ANIMAL_SPECIES } from './animal-species.ts';
import { startAnimalManhunter } from './animal-manhunter.ts';
import { computeThreatPoints,summaryHealthPercent } from './threat-points.ts';
import { TICKS_PER_DAY,type World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';

export const SMALL_INTRO_TICK=204*TICKS_PER_DAY/60;
export const SMALL_CHECK_INTERVAL=100;
export const SMALL_CYCLE_START=11*TICKS_PER_DAY;
export const SMALL_ACTIVE_TICKS=276*SMALL_CHECK_INTERVAL;
export const SMALL_CYCLE_TICKS=636*SMALL_CHECK_INTERVAL;
export const SMALL_REFIRE_TICKS=2*TICKS_PER_DAY;
/** Core-only home-map ThreatSmall has one definition. CaravanDemand is not a
 * home-map ticket; DLC incidents are outside this profile. Five is a weight,
 * not a five-percent daily chance. No absent ticket is reassigned. */
export const SMALL_RAW_WEIGHT=5;
export const SMALL_ANIMAL_WEIGHT=5;

export interface CassandraSmallCalendar {
  profile:'cassandra-small-v1';
  adoptedAt:number;
  rng:number;
  nextCheck:number;
  cycle:number;
  pending:number[];
  introDone:boolean;
  opportunities:number;
  incidents:number;
  lastIncidentTick?:number;
}

function random(state:CassandraSmallCalendar):number {
  let value=state.rng;
  value^=value<<13;value^=value>>>17;value^=value<<5;
  state.rng=value>>>0;
  return state.rng/0x100000000;
}
export function smallCycleAt(tick:number):number {
  return tick<SMALL_CYCLE_START?-1:Math.floor((tick-SMALL_CYCLE_START)/SMALL_CYCLE_TICKS);
}
export function smallNextCheck(tick:number):number {
  return Math.max(SMALL_CYCLE_START,(Math.floor(tick/SMALL_CHECK_INTERVAL)+1)*SMALL_CHECK_INTERVAL);
}
export function smallAcceptance(points:number):number {
  return Math.max(0,Math.min(1,(2800-points)/2000));
}

/** Loading/migrating alone must not adopt. A resumed colony skips the entire
 * already-started cycle and consumes no retrospective random draws. */
export function adoptSmallIncidents(world:World):void {
  if(homeIncidentsBlocked261(world)||world.schemaVersion<183||!world.gameProfile||world.smallIncidents)return;
  world.smallIncidents={profile:'cassandra-small-v1',adoptedAt:world.tick,
    rng:((world.seed^0x5a11c201)>>>0)||1,nextCheck:smallNextCheck(world.tick),
    cycle:smallCycleAt(world.tick),pending:[],introDone:world.tick>=SMALL_INTRO_TICK,
    opportunities:0,incidents:0};
}

/** Sleep, ordinary fleeing and food hunting do not make a wild Core animal
 * immune. The separate controller owns waking and interruption on success. */
export function smallAnimalCandidates(world:World):WildAnimal[] {
  const maximum=world.tick<7*TICKS_PER_DAY?40:150;
  const fog=world.schemaVersion>=328;
  return world.wildlife?.animals.filter(animal=>!animal.domestic&&animal.state!=='dead'&&!(fog&&world.tiles[Math.round(animal.z)*world.width+Math.round(animal.x)]?.fogged)&&
    animal.state!=='downed'&&!animal.manhunter&&!animal.retaliation&&
    ANIMAL_SPECIES[animal.species].combatPower<=maximum)??[];
}

/** Select only among actual local animals. A refusal never allocates an animal
 * or substitutes another incident; injury and wildlife PRNGs are untouched. */
export function resolveSelectedSmallAnimal(world:World,state:CassandraSmallCalendar=world.smallIncidents!):boolean {
  if(!state||!world.gameProfile||world.schemaVersion<183||
    state.lastIncidentTick!==undefined&&world.tick-state.lastIncidentTick<SMALL_REFIRE_TICKS)return false;
  const candidates=smallAnimalCandidates(world);
  if(!candidates.length)return false;
  const animal=candidates[Math.floor(random(state)*candidates.length)]!;
  if(!startAnimalManhunter(world,animal))return false;
  state.incidents++;state.lastIncidentTick=world.tick;
  world.events.push({tick:world.tick,type:'need',message:`Un ${ANIMAL_SPECIES[animal.species].label} sauvage est en rage : fuyez, abritez-vous derrière une porte fermée ou défendez les personnes exposées.`});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
  return true;
}

function consumeOpportunity(world:World,state:CassandraSmallCalendar):void {
  state.opportunities++;
  // The only Core home-map ticket has positive effective weight even after
  // recent-incident factors. Eligibility is checked without renormalization.
  if(random(state)*SMALL_RAW_WEIGHT<SMALL_ANIMAL_WEIGHT)resolveSelectedSmallAnimal(world,state);
}

function acceptanceNow(world:World):number {
  if(!world.economy)return 1;
  const colonists=world.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&!p.prisoner&&!p.visitor);
  return smallAcceptance(computeThreatPoints({timeFactorWholeDays:world.schemaVersion>=328,knownWealth:world.economy.wealth.knownStorytellerWealth,
    freeColonists:colonists.length,
    colonistHealthSum:colonists.reduce((sum,p)=>sum+(p.health?summaryHealthPercent(p.health):1),0),
    elapsedDays:world.tick/TICKS_PER_DAY,adaptationDays:world.economy.adaptationDays,
    seedBucket:Math.floor(world.tick/250)}).points);
}

/** Core's RoundRandom(uniform(.2,1)) yields zero/one, expectation .6. The date
 * is drawn before acceptance. Persisting acceptance at cycle opening adapts
 * Core's repeated seeded regeneration using the current threat points. */
function prepareCycle(world:World,state:CassandraSmallCalendar):void {
  const fractionalCount=.2+.8*random(state);
  const count=random(state)<fractionalCount?1:0;
  if(!count)return;
  const start=SMALL_CYCLE_START+state.cycle*SMALL_CYCLE_TICKS;
  const time=start+Math.floor(random(state)*(SMALL_ACTIVE_TICKS/SMALL_CHECK_INTERVAL))*SMALL_CHECK_INTERVAL;
  const acceptance=acceptanceNow(world);
  if(acceptance<1&&random(state)>=acceptance)return;
  // The storyteller suppresses controls at DaysPassed <= minDaysPassed.
  // Keep the first cycle's slot zero silent instead of moving its date.
  if(time===SMALL_CYCLE_START)return;
  state.pending=[time];
}

/** O(1) between checks; points are read only at a future cycle opening and the
 * animal list only at an actual opportunity. A jumped span is never replayed. */
export function advanceSmallIncidents(world:World):void {
  if(homeIncidentsBlocked261(world))return;
  const state=world.smallIncidents;
  if(!state||!world.gameProfile||world.schemaVersion<183)return;
  if(!state.introDone&&world.tick>=SMALL_INTRO_TICK){
    state.introDone=true;
    if(world.tick===SMALL_INTRO_TICK)consumeOpportunity(world,state);
  }
  if(world.tick<state.nextCheck)return;
  state.nextCheck=smallNextCheck(world.tick);
  const cycle=smallCycleAt(world.tick);
  if(cycle!==state.cycle){
    state.cycle=cycle;state.pending=[];
    if(world.tick===SMALL_CYCLE_START+cycle*SMALL_CYCLE_TICKS)prepareCycle(world,state);
  }
  if(state.pending[0]!==undefined&&state.pending[0]<=world.tick){
    const due=state.pending[0]===world.tick;
    state.pending=[];
    if(due)consumeOpportunity(world,state);
  }
}
