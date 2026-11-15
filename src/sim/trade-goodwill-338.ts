import {initialWorldGoodwill256,type WorldFactionRelationKind256} from './world-faction-catalog.ts';
import {validWorldRelationKind274,worldGoodwillChange274,worldNaturalGoodwill274} from './world-diplomacy-274.ts';
import type {WorldFactionRegistry256,WorldFactionRelation256} from './world-faction-state.ts';

/** Schema 338: Core Faction.Notify_PlayerTraded. After a trade with a trader
 * that belongs to a faction, the faction gains (int)(S / 600) goodwill, S
 * being the Float32 sum, over every tradeable the player SOLD, of count × unit
 * sell price (TradeDeal.TryExecute, CurTotalCurrencyCostForDestination).
 * Purchases count for nothing. The change goes through
 * Faction.TryAffectGoodwillWith: CanChangeGoodwillFor, a zero change does
 * nothing, natural-goodwill bonus, clamp to ±100 and relation thresholds.
 * A trader without a faction (orbital ship, historical visitor without a
 * world registry, civilian post) changes nothing. Facts only, nothing copied. */
export const TRADE_GOODWILL_SCHEMA_338=338;
const f32=Math.fround;
/** One sold line: units handed to the trader and the unit sell price. */
export interface SoldLine338 {count:number;unitPrice:number}
export function soldSilver338(lines:Iterable<SoldLine338>):number {
 let total=0;
 for(const l of lines)if(l.count>0)total=f32(total+f32(f32(l.count)*f32(l.unitPrice)));
 return total;
}
export const tradeGoodwillGain338=(sold:number):number=>Number.isFinite(sold)&&sold>0?Math.trunc(f32(f32(sold)/600)):0;
export interface TradeGoodwillPlan338 {relation:WorldFactionRelation256;factionName:string;requested:number;before:number;after:number;kindAfter:WorldFactionRelationKind256}
/** Pure plan of the change; `undefined` when nothing changes. */
export function planTradeGoodwill338(registry:WorldFactionRegistry256|undefined,factionId:number|null|undefined,sold:number,version:number):TradeGoodwillPlan338|undefined {
 if(version<TRADE_GOODWILL_SCHEMA_338||!registry||typeof factionId!=='number')return;
 const requested=tradeGoodwillGain338(sold);if(requested<=0)return;
 const player=registry.factions.find(f=>f.id===registry.playerFactionId),faction=registry.factions.find(f=>f.id===factionId);
 if(!player||!faction||player===faction)return;
 // CanChangeGoodwillFor: both factions have goodwill (visible, not
 // temporary), no permanent enmity, neither defeated, and no positive change
 // while the player attacks one of the faction's settlements.
 if(player.hidden||faction.hidden||player.lifecycle259?.temporary||faction.lifecycle259?.temporary||player.lifecycle259?.defeated||faction.lifecycle259?.defeated)return;
 if(initialWorldGoodwill256(player.def,faction.def)===-100)return;
 if(registry.settlements.some(s=>s.factionId===faction.id&&s.attack263&&s.attack263.mapId!==null))return;
 const a=Math.min(player.id,faction.id),b=Math.max(player.id,faction.id),relation=registry.relations.find(r=>r.aId===a&&r.bId===b);
 if(!relation||!validWorldRelationKind274(relation.goodwill,relation.kind,version))return;
 const natural=worldNaturalGoodwill274(faction);if(natural===undefined)return;
 const change=worldGoodwillChange274(relation.goodwill,relation.kind,natural,requested);
 if(!change||change.goodwillAfter===relation.goodwill)return;
 return {relation,factionName:faction.name,requested,before:relation.goodwill,after:change.goodwillAfter,kindAfter:change.kindAfter};
}
/** Commits a plan and returns the French message (Core message with reason). */
export function applyTradeGoodwill338(plan:TradeGoodwillPlan338):string {
 plan.relation.goodwill=plan.after;plan.relation.kind=plan.kindAfter;
 return `Relations avec ${plan.factionName} : ${plan.before} → ${plan.after} (commerce).`;
}
