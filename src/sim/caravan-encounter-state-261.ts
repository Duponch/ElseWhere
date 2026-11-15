import type {Pawn,MaterialPile} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {WorldMapRecord,WorldGroupRecord} from './world-map-state.ts';
import type {WorldPawnOwner256} from './world-pawn-state-256.ts';

export const CARAVAN_ENCOUNTER_SCHEMA_261=261;
export const CARAVAN_INCIDENTS_261=['ambush','manhunter-ambush','meeting','demand'] as const;
export type CaravanIncident261=typeof CARAVAN_INCIDENTS_261[number];
/** Prospective permission belongs to the actual target. Absence stays historical. */
export interface EncounterAdmission261 {revision:1}
/** Effective current incidents only; intentionally not exhaustive Core StoryState. */
export interface CaravanStory261 {
 revision:1;lastFire:Partial<Record<CaravanIncident261,number>>;
 lastThreatCore?:number;lastFactionId?:number;recent:CaravanIncident261[];
}
export type RetainedArrival261=null|{kind:'enter';mapId:number}|{kind:'trade';settlementId:number;factionId:number;postId:number|null}|import('./world-sites-state-263.ts').WorldEntryTarget263|import('./peace-talks-state-293.ts').PeaceTalksArrival293;
export interface RetainedCaravan261 {
 passStory:boolean;
 next:null|{tile:number;leftFraction:number;paused:boolean};
 destination:null|{tile:number;action:RetainedArrival261};
}
export type CaravanBattlefield261={revision:1;won:boolean;retained:RetainedCaravan261}&(
 {kind:'ambush'|'attacked-caravan';factionId:number|null;peaceTalksSiteId293?:never}
 |{kind:'peace-talks';factionId:number;peaceTalksSiteId293:number});
export type CaravanDemandLine261={kind:'human'|'animal';id:number}|{kind:'pile'|'packed';id:number;quantity:number};
/** Same originals held here until the player's real decision. Never a ledger/post. */
interface EncounterForeignOwners261 {
 animalAmbush261?:never;
 revision:1;atCore:number;factionId:number;people:Pawn[];animals:WildAnimal[];
 items:MaterialPile[];packed:PackedFurniture[];
}
export type PendingCaravanEncounter261=
 | (EncounterForeignOwners261&{kind:'peace-talks';decision:'forced';peaceTalksSiteId293:number})
 | (EncounterForeignOwners261&{kind:'meeting';decision:'open'|'attack';traderId:number;guardIds:number[];
   /** Schema 338: the Core caravan trader kind of the met Trader group. */
   caravanKind338?:import('./trader-caravans-332.ts').CaravanTraderKind332})
 | (EncounterForeignOwners261&{kind:'ambush';decision:'forced'})
 | (Omit<EncounterForeignOwners261,'factionId'|'animalAmbush261'>&{kind:'ambush';decision:'forced';factionId:null;animalAmbush261:true})
 | (EncounterForeignOwners261&{kind:'demand';decision:'open'|'fight';demands:CaravanDemandLine261[]});
export interface CaravanTarget261 {encounters261?:EncounterAdmission261;story261?:CaravanStory261}
export type EncounterMap261=WorldMapRecord&CaravanTarget261&{battlefield261?:CaravanBattlefield261};
export type EncounterGroup261=WorldGroupRecord&CaravanTarget261&{pending261?:PendingCaravanEncounter261;arrival261?:{tile:number;action:NonNullable<RetainedArrival261>}};
/** A real faction tracker reference; guest HostFaction remains null after kidnapping. */
export interface CaravanCaptivity261 {factionId:number;atCore:number}
export type CaptiveWorldPawn261=WorldPawnOwner256&{captivity261?:CaravanCaptivity261};

export function copiedCaravanStory261(story:CaravanStory261|undefined):CaravanStory261|undefined {
 return story?{...story,lastFire:{...story.lastFire},recent:story.recent.slice()}:undefined;
}
/** No empty history at formation/load; only actual successful incidents call this. */
export function firedCaravanStory261(previous:CaravanStory261|undefined,incident:CaravanIncident261,atCore:number):CaravanStory261 {
 if(!Number.isSafeInteger(atCore)||atCore<0)throw Error('Invalid actual incident frontier');
 return {...previous,revision:1,lastFire:{...previous?.lastFire,[incident]:atCore},
  ...(incident==='ambush'||incident==='manhunter-ambush'?{lastThreatCore:atCore}:{}),recent:[incident,...previous?.recent??[]].slice(0,5)};
}
export function caravanIncidentTooRecent261(story:CaravanStory261|undefined,incident:CaravanIncident261,atCore:number):boolean {
 const last=story?.lastFire[incident];
 return incident!=='demand'&&last!==undefined&&atCore-last<10200;
}
