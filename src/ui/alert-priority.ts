import {TICKS_PER_DAY,type World} from '../sim/types';

/** Core AlertPriority: Medium < High < Critical (default Medium). */
export type CoreAlertPriority='critical'|'high'|'medium';
export const CORE_ALERT_PRIORITY_RANK:Readonly<Record<CoreAlertPriority,number>>=Object.freeze({critical:2,high:1,medium:0});

/** Core AlertsReadout.StartTickDelay, in Core ticks (one local tick is ten). */
export const CORE_ALERT_START_CORE_TICKS=600;
export const coreAlertsStarted=(world:Pick<World,'tick'>):boolean=>world.tick*10>=CORE_ALERT_START_CORE_TICKS;
/** Core GenDate.DaysPassed: whole days elapsed since the start of this game. */
export const coreDaysPassed=(world:Pick<World,'tick'>):number=>Math.floor(world.tick/TICKS_PER_DAY);

/** Core Map.IsPlayerHome: the colony's settled map, never a camp, battlefield or
 * visited site. A world without a campaign registry is its own historical home. */
export function isPlayerHomeMap(world:World):boolean {
  const campaign=world.campaignMap;
  if(!campaign)return true;
  if(campaign.revision!==2)return campaign.active==='home';
  const current=campaign.maps.find(map=>map.id===campaign.activeMapId);
  return !current||current.kind==='settlement';
}

/** Explicit priority of each status row family, the part of the key before
 * the first ':'. Core classes are named where an equivalent exists; the other
 * rows are Elsewhere projections and keep Core's default Medium unless they
 * announce a present danger. Labels are never parsed. */
const STATUS_PRIORITY:Readonly<Record<string,CoreAlertPriority>>=Object.freeze({
  // Alert_Critical subclasses.
  fire:'critical',                  // Alert_FireInHomeArea
  downed:'critical',                // Alert_ColonistNeedsRescuing
  hypothermia:'critical',           // Alert_Hypothermia
  'mood-risk-high':'critical',      // Alert_MajorOrExtremeBreakRisk
  'life-threatening':'critical',    // Alert_LifeThreateningHediff
  // High Core alerts.
  'colonist-unburied':'high',       // Alert_ColonistLeftUnburied
  'need-warden':'high',             // Alert_NeedWarden
  beds:'high',                      // Alert_NeedColonistBeds
  'food-reserves':'high',           // Alert_LowFood
  'mood-risk-minor':'high',         // Alert_MinorBreakRisk
  malnutrition:'high',              // Alert_StarvationColonists
  'colonist-needs-tend':'high',     // Alert_ColonistNeedsTend
  'need-defenses':'high',           // Alert_NeedDefenses
  exhaustion:'high',                // Alert_Exhaustion
  'low-medicine':'high',            // Alert_LowMedicine
  'need-warm-clothes':'high',       // Alert_NeedWarmClothes
  // Elsewhere rows describing a present danger.
  bleeding:'high','colonist-availability':'high','prison-break':'high','mechanical-threat':'high',
  manhunter:'high',mental:'high','turret-wick':'high','casket-wick':'high',
  // Medium Core alerts and Elsewhere information rows.
  idle:'medium','research-project':'medium','need-meal-source':'medium','need-joy-sources':'medium',
  // Lot B Medium Core alerts: Alert_TatteredApparel, Alert_Boredom,
  // Alert_NeedBatteries, the four pen alerts and Alert_StarvationAnimals.
  'tattered-apparel':'medium',boredom:'medium','need-batteries':'medium','animal-pen-needed':'medium',
  'animal-pen-not-enclosed':'medium','predator-in-pen':'medium','penned-animal-hungry':'medium','starvation-animals':'medium',
  blight:'medium',hungry:'medium',infection:'medium',flu:'medium',malaria:'medium',plague:'medium','sleeping-sickness':'medium',
  'sad-wander':'medium','food-binge':'medium',party:'medium','pending-jobs':'medium','no-stockpile':'medium',
  'disabled-construction':'medium','interrupted-cargo':'medium','food-policy-blocked':'medium',
  'availability-local':'medium','availability-away':'medium','availability-suspended':'medium','availability-death':'medium',
  'camp-pressure':'medium',
  // Alerts lot C (occasional Core alerts): Alert_ImmobileCaravan (Critical),
  // Alert_NeedDoctor, Alert_NeedMiner, Alert_PasteDispenserNeedsHopper (High),
  // Alert_AwaitingMedicalOperation, Alert_NeedResearchBench, Alert_CaravanIdle (Medium).
  'immobile-caravan':'critical','need-doctor':'high','need-miner':'high','paste-dispenser-hopper':'high',
  'awaiting-operation':'medium','need-research-bench':'medium','caravan-idle':'medium',
});
const DANGEROUS_INCIDENTS=new Set(['raid','mechanoid','manhunter','downed']);

/** One explicit order for the right-hand list. Domain (letter) rows map their
 * own severity: an active danger is High, the rest Medium. */
export function coreAlertPriority(row:{key:string;priority?:CoreAlertPriority;domain?:{severity:'info'|'warning'|'danger'}}):CoreAlertPriority {
  if(row.priority)return row.priority;
  if(row.domain)return row.domain.severity==='danger'?'high':'medium';
  const parts=row.key.split(':'),family=parts[0]!;
  if(family==='campaign')return DANGEROUS_INCIDENTS.has(parts[2]??'')?'high':'medium';
  return STATUS_PRIORITY[family]??'medium';
}
