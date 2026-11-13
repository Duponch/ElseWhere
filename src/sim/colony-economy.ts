import { isColonist } from './affiliation.ts';
import { colonyWealth, type ColonyWealth } from './colony-wealth.ts';
import { expectationForWealth, type ColonyExpectation } from './expectations.ts';
import { advanceThreatAdaptationHalfDay, loseThreatAdaptationForColonistLoss, loseThreatAdaptationForViolentDowning } from './threat-points.ts';
import { TICKS_PER_DAY, type Pawn, type World } from './types.ts';

export const WEALTH_SAMPLE_INTERVAL = 501;
export const ADAPTATION_INTERVAL = TICKS_PER_DAY / 2;
interface PendingLoss { pawnId:number; kind:'downed'|'died'; population:number }
export interface ColonyEconomy {
  profile:'colony-prosperity-v1';
  adoptedAt:number;
  sampledAt:number;
  nextSampleAt:number;
  wealth:ColonyWealth;
  adaptationDays:number;
  nextAdaptAt:number;
  pendingLosses?:PendingLoss[];
}

export const freeColonist = (pawn:Pawn):boolean => isColonist(pawn)&&!pawn.prisoner&&!pawn.visitor&&pawn.state!=='dead';
export function colonyExpectation(world:World,pawn:Pawn):ColonyExpectation|undefined {
  // Schema 313: a prisoner of the colony on the map also has the map's expectations (Core).
  const prisoner313=Number(world.schemaVersion)>=313&&!!pawn.prisoner&&!pawn.visitor&&pawn.state!=='dead';
  return world.economy&&(freeColonist(pawn)||prisoner313)?expectationForWealth(world.economy.wealth.knownTotal):undefined;
}
/** Explicit on historical worlds: never infer yesterday's prosperity or losses. */
export function adoptColonyEconomy(world:World):boolean {
  if(world.economy)return false;
  world.economy={profile:'colony-prosperity-v1',adoptedAt:world.tick,sampledAt:world.tick,
    nextSampleAt:world.tick+WEALTH_SAMPLE_INTERVAL,wealth:colonyWealth(world),
    adaptationDays:0,nextAdaptAt:world.tick+ADAPTATION_INTERVAL};
  return true;
}
/** One shared census, outside each pawn's needs and outside render frames. */
export function sampleColonyEconomy(world:World):void {
  const state=world.economy;if(!state||world.tick<state.nextSampleAt)return;
  state.wealth=colonyWealth(world);state.sampledAt=world.tick;
  state.nextSampleAt=world.tick+WEALTH_SAMPLE_INTERVAL;
}
/** Called before the actual state transition. A death replaces a violent fall
 * queued during this tick; it must not charge the same loss twice. */
export function notifyColonyLoss(world:World,pawn:Pawn,kind:'downed'|'died'):void {
  const state=world.economy;if(!state||!freeColonist(pawn))return;
  const population=world.pawns.filter(freeColonist).length-(kind==='died'?1:0);
  const pending=state.pendingLosses??=[],previous=pending.find(p=>p.pawnId===pawn.id);
  if(previous){if(kind==='died'){previous.kind=kind;previous.population=population;}return;}
  pending.push({pawnId:pawn.id,kind,population});state.pendingLosses=pending;
}
/** Also flushed before advancing the next tick, so a paused damage command
 * has identical continuation before and after saving. */
export function flushColonyLosses(world:World):void {
  const state=world.economy;if(!state?.pendingLosses)return;
  for(const loss of state.pendingLosses)state.adaptationDays=loss.kind==='died'
    ?loseThreatAdaptationForColonistLoss(state.adaptationDays,loss.population)
    :loseThreatAdaptationForViolentDowning(state.adaptationDays,loss.population);
  delete state.pendingLosses;
}
export function advanceColonyAdaptation(world:World):void {
  const state=world.economy;if(!state)return;
  flushColonyLosses(world);
  if(world.tick>=state.nextAdaptAt){
    state.adaptationDays=advanceThreatAdaptationHalfDay(state.adaptationDays,world.tick/TICKS_PER_DAY);
    state.nextAdaptAt=world.tick+ADAPTATION_INTERVAL;
  }
}
