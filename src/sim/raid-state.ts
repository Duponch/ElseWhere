import type { Cell,MaterialPile } from './types.ts';

export interface RaiderState { group:number; exiting:boolean; goal:Cell|null; kidnap261?:import('./caravan-kidnap-261.ts').RaiderKidnap261 }
export interface RaidDeparture { group:number; pawnId:number; name:string; cell:Cell; tick:number; items:MaterialPile[];reason?:'released';capturedAt?:number;releasedAt?:number }
/** Available pirate projections only; these are Core pawn-kind combatPower
 * costs, not the market prices of their limited local equipment. */
export const RAID_ROLE_COST=Object.freeze({drifter:35,thrasher:50,scavenger:50,pirate:65} as const);
export type RaidRole=keyof typeof RAID_ROLE_COST;
export interface RaidComposition {budget:number;roster:RaidRole[]}
const PIRATE_MAX_PAWN_COST:readonly (readonly [number,number])[]=[[0,35],[70,50],[700,100],[1300,150],[100000,10000]];
/** Core Factions_Misc.xml pirate curve with MaxPawnCost's cheapest-kind floor.
 * The local immediate attack uses one required pawn, so that cap adds nothing. */
export function pirateMaxPawnCost(points:number):number {
  let value=PIRATE_MAX_PAWN_COST.at(-1)![1];
  for(let i=1;i<PIRATE_MAX_PAWN_COST.length;i++){
    const [x,y]=PIRATE_MAX_PAWN_COST[i]!;
    if(points<=x){const [priorX,priorY]=PIRATE_MAX_PAWN_COST[i-1]!;value=priorY+(y-priorY)*(points-priorX)/(x-priorX);break;}
  }
  return Math.max(35*1.2,value);
}
export type CaravanRaidProvenance261={revision:1;bornAtCore:number;factionId:number}&(
 |{kind:'assault';sourceGroupId:number;kidnapLord261?:import('./caravan-kidnap-lord-261.ts').KidnapLord261}|{kind:'defend-caravan';sourceGroupId:number;traderId:number;guardIds:number[];defendSpot:Cell}|{kind:'pressure';sourceMapId:number});
export interface RaidGroup {shipReactor275?:import('./ship-reactor-threats-275.ts').ShipReactorRaidSource275;tempIncident261?:import('./temp-map-raids-261.ts').TempRaidSource261; id:number; startedAt:number; deadline:number|null; lossPermille:number|null; members:number[]; lost:number[]; phase:'assault'|'withdraw';
  /** Schema 330 Core StageThenAttack: the group defends this point until the
   * Core tick untilCore or 30 % losses, then assaults. Absent: immediate. */
  stage330?:{point:Cell;untilCore:number}; reason?:'losses'|'timeout'|'colony-down'|'trader-lost'|'non-hostile'; composition?:RaidComposition; originQuestId?:number;caravan261?:CaravanRaidProvenance261 }
export interface RaidResult {destroyed277?:number;shipReactor275?:import('./ship-reactor-threats-275.ts').ShipReactorRaidSource275;tempIncident261?:import('./temp-map-raids-261.ts').TempRaidSource261; mechanoid?:true;mechComposition?:import('./mechanoid-raid-state.ts').MechanoidRaidComposition; id:number; tick:number; reason:'defended'|'withdrawn'|'colony-down'; killed:number; downed:number; escaped:number;captured?:number;composition?:RaidComposition; originQuestId?:number;caravan261?:CaravanRaidProvenance261;memberCount261?:number }
export interface RaidCalendar {extraMechActive261?:import('./mechanoid-raid-state.ts').MechanoidRaidGroup[];extraActive261?:RaidGroup[];extraResults261?:RaidResult[]; mechanoid?:import('./mechanoid-raid-state.ts').MechanoidRaidPolicy;mechActive?:import('./mechanoid-raid-state.ts').MechanoidRaidGroup; profile:'camp-raids-v1'|'cassandra-raids-v1'|'camp-pressure-v1'|'ship-reactor-raids-v1'; rng:number; nextCheck:number|null; serial:number; completed:number; active?:RaidGroup; last?:RaidResult; departed:RaidDeparture[];cassandra?:import('./cassandra-raids.ts').CassandraRaidAgenda }
export function raidRandom(s:Pick<RaidCalendar,'rng'>):number {let x=s.rng;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
