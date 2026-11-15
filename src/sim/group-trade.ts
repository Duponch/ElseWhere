import {GROUP_FREIGHT_SCHEMA,freightGroup} from './group-freight.ts';
import type { GroupState } from './group-state.ts';
import type { GroupMassCapture } from './group-capture.ts';
import type { CivilianPost,CommercialBuyLine } from './commercial-state.ts';
import { bestGroupNegotiator } from './trade-negotiator.ts';
import { soldSilver338 } from './trade-goodwill-338.ts';
import { quoteOwnerTrade,draftOwnerTrade,type CommercialDirection,type CommercialOwnerContext,type OwnerQuote } from './commercial-owner-kernel.ts';
type AwayGroup=Extract<GroupState,{members:unknown}>;
export interface GroupTradeEnvironment {
  tick:number;nextId:number;version:number;siteTile:number;siteOpen:boolean;post:CivilianPost|undefined;
  /** Root's single actual decision capture; route context must reference this object too. */
  mass:GroupMassCapture;pileCountElsewhere:number;
  siteOwner?:{settlementId:number;factionId:number;postId:number};
}
function captureGroupTrade(group:AwayGroup,e:GroupTradeEnvironment):CommercialOwnerContext|undefined {
  if(group.phase!=='at-site'||group.tile!==e.siteTile||!e.siteOpen||!e.post||group.lastPersonalTick!==e.tick)return;
  const negotiator=bestGroupNegotiator(group.members,e.version);if(!negotiator)return;
  return {tick:e.tick,nextId:e.nextId,version:e.version,scope:`group:${group.id}:site:${e.siteTile}`,members:group.members,...group.animalOwners?{additionalInventoryOwners:group.animalOwners.members}:{},negotiator,items:group.items,post:e.post,mass:e.mass,
    ...(e.version>=256&&(group.travel||group.reorganization)?{groupProspective:true as const}:{}),
    ...(e.version>=GROUP_FREIGHT_SCHEMA&&freightGroup(group)?{groupFreight:true as const}:{}),
    ledgerStamp:[group.baseline,group.ledger,group.freight,group.reorganization,group.travel,group.packed,group.animalOwners,...e.siteOwner?[e.siteOwner]:[]],pileCountElsewhere:e.pileCountElsewhere,inventoryLimit:e.version>=256?Number.MAX_SAFE_INTEGER:256};
}
export function quoteGroupTrade(group:AwayGroup,e:GroupTradeEnvironment,direction:CommercialDirection,lines:readonly CommercialBuyLine[]):OwnerQuote {
  const context=captureGroupTrade(group,e);
  return context?quoteOwnerTrade(context,direction,lines):{ok:false,reason:'Groupe présent, comptoir et négociateur réellement disponibles requis.'};
}
/** Confirmation re-reads the actual phase/owners/stock/mass, including meals,
 * care and loss transitions. Signature is correlated content, not a cached tick. */
export function draftGroupTrade(group:AwayGroup,e:GroupTradeEnvironment,direction:CommercialDirection,lines:readonly CommercialBuyLine[],signature:string):{group:AwayGroup;post:CivilianPost;nextId:number;sold338:number}|null {
  const context=captureGroupTrade(group,e);if(!context)return null;
  const quote=quoteOwnerTrade(context,direction,lines);if(!quote.ok||quote.signature!==signature)return null;
  const draft=draftOwnerTrade(context,quote);if(!draft)return null;
  const ledger={...group.ledger,bought:{medicine:group.ledger.bought.medicine+draft.bought.medicine,component:group.ledger.bought.component+draft.bought.component},
    sold:{cloth:group.ledger.sold.cloth+draft.sold.cloth,'muffalo-wool':group.ledger.sold['muffalo-wool']+draft.sold['muffalo-wool']},
    silverPaid:group.ledger.silverPaid+draft.silverPaid,silverEarned:group.ledger.silverEarned+draft.silverEarned};
  if(![ledger.bought.medicine,ledger.bought.component,ledger.sold.cloth,ledger.sold['muffalo-wool'],ledger.silverPaid,ledger.silverEarned].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
  // Schema 338 goodwill input: the unrounded sell value of the goods sold.
  const sold338=direction==='sell'?soldSilver338(quote.selected.map(l=>({count:l.quantity,unitPrice:l.unitPrice}))):0;
  return {group:{...group,items:draft.items,ledger},post:draft.post,nextId:draft.nextId,sold338};
}
