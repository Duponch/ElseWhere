import {SCHEMA_VERSION} from './types.ts';
import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {validatePileRecordShape} from './material-record-save.ts';
import {planetTileCount} from './planet-geography-256.ts';
import {tradeRequestContent284} from './trade-request-content-284.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {WEAPON_QUALITIES} from './equipment-rules.ts';
import {isPerishable,ROT_DAYS} from './food-preservation.ts';
import {TRADE_REQUEST_MAX_ENTRIES_284,TRADE_REQUEST_MAX_REWARD_STACKS_284,TRADE_REQUEST_MAX_CLEANUP_284,tradeRewardManifest284,sameTradeRewardManifest284} from './trade-request-holder-284.ts';
import type {NumericMembershipSink} from './numeric-membership.ts';
import type {World,MaterialPile} from './types.ts';
import type {WorldMapRecord,RetiredWorldMap} from './world-map-state.ts';
import type {WorldSitesState263} from './world-sites-state-263.ts';
import type {TradeRequests284,TradeRequest284,TradeRewardThing284} from './trade-request-state-284.ts';

const own=(v:object,key:string)=>Object.hasOwn(v,key);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const clock=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>int(v,min,max)&&v%10===0;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>own(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k)));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1;

export interface TradeRequestsValidationContext284 {
 schemaVersion:number;tick:number;nextId:number;planet?:World['planet'];worldFactions?:World['worldFactions'];worldSites263?:WorldSitesState263;
 worldMaps?:{sites:readonly Pick<WorldMapRecord,'id'|'tile'>[];retired?:readonly Pick<RetiredWorldMap,'id'|'tile'>[]};
 /** Campaign-only/public summaries have no complete retired-map registry. */
 maps?:readonly {id:number;tile:number|null}[];tradeRequests284?:unknown;
}

function manifest(value:unknown,nextId:number):value is TradeRewardThing284 {
 if(!record(value)||!keys(value,['id','item','quantity'],['quality'])||!int(value.id,1,nextId-1)||typeof value.item!=='string'||!own(ITEM_DEFINITIONS,value.item))return false;
 const def=ITEM_DEFINITIONS[value.item as keyof typeof ITEM_DEFINITIONS],qualified=def.kind==='weapon'||def.kind==='apparel';
 return int(value.quantity,1,def.stackLimit)&&(qualified?own(value,'quality')&&WEAPON_QUALITIES.includes(value.quality as typeof WEAPON_QUALITIES[number]):!own(value,'quality'));
}
function wealth(value:unknown):boolean {
 if(!record(value)||!keys(value,['basis','value','items','structures','floors','unpricedPiles','unpricedPacked','unpricedStructures','unpricedPawns'])||value.basis!=='known-material-v1')return false;
 return ['value','items','structures','floors'].every(k=>finite(value[k]))&&value.value===Number(value.items)+Number(value.structures)+Number(value.floors)
  &&['unpricedPiles','unpricedPacked','unpricedStructures','unpricedPawns'].every(k=>int(value[k]));
}

function entry(value:unknown,root:TradeRequestsValidationContext284,nextRequestId:number,adopted:number,manifests:Set<number>,held:Map<number,MaterialPile>,activeSettlements:Set<number>):string|undefined {
 if(!record(value)||!keys(value,['id','homeMapId','settlementId','factionId','giverId','tile','settlementName','offeredAtCore','offerExpiresAtCore','durationCore','family','quantity','baseMarketValue','wealth','rewardBudget','options','dismissed','status','cleanup'],['acceptedAtCore','expiresAtCore','selectedOptionId','closed','fulfillment','destinationLost']))return 'Invalid trade request fields.';
 const r=value as unknown as TradeRequest284,core=root.tick*10,content=tradeRequestContent284(r.family),factions=root.worldFactions!,planet=root.planet!;
 if(!int(r.id,1,nextRequestId-1)||!int(r.homeMapId)||!int(r.settlementId,1,factions.nextSettlementId-1)||!int(r.factionId,1,factions.nextFactionId-1)||r.factionId===factions.playerFactionId
  ||!factions.factions.some(f=>f.id===r.factionId)||!int(r.giverId,1,root.nextId-1)||!int(r.tile,0,planetTileCount(planet)-1)||typeof r.settlementName!=='string'||!r.settlementName.trim()||r.settlementName.length>160
  ||!clock(r.offeredAtCore,adopted,core)||!int(r.offerExpiresAtCore,r.offeredAtCore+240000,r.offeredAtCore+480000)||!int(r.durationCore,720000,1680000)||r.durationCore%60000
  ||!content||r.baseMarketValue!==content.baseMarketValue||!int(r.quantity,1)||!finite(r.quantity*r.baseMarketValue,Number.MIN_VALUE)||!wealth(r.wealth)||!finite(r.rewardBudget,Number.MIN_VALUE)
  ||typeof r.dismissed!=='boolean'||!['offered','accepted','succeeded','expired','failed'].includes(r.status)||!dense(r.options,3)||!r.options.length||!dense(r.cleanup,TRADE_REQUEST_MAX_CLEANUP_284))return 'Invalid trade request header or captured values.';
 if(root.worldMaps?.retired&&!root.worldMaps.sites.some(m=>m.id===r.homeMapId)&&!root.worldMaps.retired.some(m=>m.id===r.homeMapId))return 'Trade request lost its original home map proof.';
 const settlement=factions.settlements.find(s=>s.id===r.settlementId);
 const lostPresent=own(value,'destinationLost'),lost=r.destinationLost;
 if(lostPresent){
  if(settlement||!record(lost)||!keys(lost,['atCore','destroyedSiteId'])||!clock(lost.atCore,r.offeredAtCore,core)||!root.worldSites263||!int(lost.destroyedSiteId,1,root.worldSites263.nextId-1))return 'Invalid trade request destination-loss receipt.';
  const site=root.worldSites263.entries.find(s=>s.id===lost.destroyedSiteId);
  if(site&&(site.kind!=='destroyed-settlement'||site.sourceSettlementId!==r.settlementId||site.factionId!==r.factionId||site.tile!==r.tile||site.createdAtCore!==lost.atCore))return 'Trade destination-loss receipt differs from its actual destroyed Site.';
 }
 if(settlement?settlement.factionId!==r.factionId||settlement.tile!==r.tile:!lostPresent&&!root.worldSites263?.entries.some(s=>s.kind==='destroyed-settlement'&&s.sourceSettlementId===r.settlementId&&s.factionId===r.factionId&&s.tile===r.tile))return 'Trade request destination has no actual settlement or destroyed-source proof.';
 if(r.status==='offered'||r.status==='accepted'){if(activeSettlements.has(r.settlementId))return 'Two live trade requests refer to the same settlement.';activeSettlements.add(r.settlementId);}
 const accepted=own(value,'acceptedAtCore'),choice=own(value,'selectedOptionId'),expires=own(value,'expiresAtCore'),closed=own(value,'closed'),fulfilled=own(value,'fulfillment');
 if(accepted!==choice||accepted!==expires||accepted&&(!clock(r.acceptedAtCore,r.offeredAtCore,Math.min(core,r.offerExpiresAtCore-1))||!int(r.selectedOptionId,1,3)||!int(r.expiresAtCore)||r.expiresAtCore!==r.acceptedAtCore!+r.durationCore))return 'Invalid trade request acceptance or mission deadline.';
 if(r.status==='offered'?(accepted||closed||fulfilled||r.offerExpiresAtCore<=core):r.status==='accepted'?(!accepted||closed||fulfilled||r.expiresAtCore!<=core):!closed)return 'Trade request status differs from its clocks.';
 if(closed){
  if(!record(r.closed)||!keys(r.closed,['atCore','reason'])||!clock(r.closed.atCore,accepted?r.acceptedAtCore!:r.offeredAtCore,core))return 'Invalid trade request close receipt.';
  if(r.status==='succeeded'?(!accepted||r.closed.reason!=='fulfilled'||!fulfilled||r.closed.atCore>=r.expiresAtCore!):r.status==='failed'?(!accepted||r.closed.reason!=='hostile'||fulfilled||r.closed.atCore>=r.expiresAtCore!):r.status==='expired'?((accepted?r.closed.reason!=='mission-expired'||r.closed.atCore<r.expiresAtCore!:r.closed.reason!=='offer-expired'||r.closed.atCore<r.offerExpiresAtCore)||fulfilled):true)return 'Trade request close cause differs from its state.';
 }
 const optionIds=new Set<number>(),original=new Map<number,{optionId:number;thing:TradeRewardThing284}>();
 for(const option of r.options){
  if(!record(option)||!keys(option,['id','goodwill','original','items'])||!int(option.id,1,3)||optionIds.has(option.id)||!int(option.goodwill,0,50)||!dense(option.original,TRADE_REQUEST_MAX_REWARD_STACKS_284)||!dense(option.items,TRADE_REQUEST_MAX_REWARD_STACKS_284)||!option.original.length&&!option.goodwill)return 'Invalid trade reward option.';
  optionIds.add(option.id);
  for(const thing of option.original){if(!manifest(thing,root.nextId)||manifests.has(thing.id))return 'Invalid or repeated trade reward original manifest.';manifests.add(thing.id);original.set(thing.id,{optionId:option.id,thing});}
  const shouldHold=r.status==='offered'||r.status==='accepted'&&option.id===r.selectedOptionId;
  if(shouldHold?option.items.length!==option.original.length:option.items.length!==0)return 'Trade reward holder differs from the selected lifecycle.';
  for(const raw of option.items){
   if(!record(raw)||!int(raw.id,1,root.nextId-1)||held.has(raw.id)||!record(raw.owner)||!keys(raw.owner,['type','requestId','optionId'])||raw.owner.type!=='trade-request284'||raw.owner.requestId!==r.id||raw.owner.optionId!==option.id)return 'Invalid exclusive trade reward holder.';
   const p=raw as unknown as MaterialPile,o=original.get(p.id),tick=r.offeredAtCore/10;
   if(!o||o.optionId!==option.id||!sameTradeRewardManifest284(tradeRewardManifest284(p),o.thing)||validatePileRecordShape(raw,{width:1,height:1,tick,nextId:root.nextId,climate:undefined},root.schemaVersion,tick,undefined,undefined,{requestId:r.id,optionId:option.id}).length)return 'Invalid actual trade reward payload or original manifest.';
   if(isPerishable(p.item)&&(!p.rot||p.rot.atTick!==tick||p.rot.rate!==0||p.rot.progress<0||p.rot.progress>=ROT_DAYS[p.item]*6000))return 'Trade rewards must retain their original frozen clock.';
   held.set(p.id,p);
  }
 }
 if(accepted&&!optionIds.has(r.selectedOptionId!))return 'Selected trade reward option is absent.';
 const cleaned=new Set<number>();
 for(const c of r.cleanup){
  if(!record(c)||!keys(c,['id','item','quantity','optionId','atCore','reason'],['quality'])||!manifest({id:c.id,item:c.item,quantity:c.quantity,...own(c,'quality')?{quality:c.quality}:{}},root.nextId)||!int(c.optionId,1,3)||!clock(c.atCore,r.offeredAtCore,core)||cleaned.has(c.id))return 'Invalid trade reward cleanup receipt.';
  const source=original.get(c.id);if(!source||source.optionId!==c.optionId||!sameTradeRewardManifest284(c,source.thing))return 'Cleanup differs from the actual reward manifest.';
  const notChosen=accepted&&c.optionId!==r.selectedOptionId;
  if(notChosen?c.reason!=='not-chosen'||c.atCore!==r.acceptedAtCore:!closed||r.status==='succeeded'||c.reason!==r.closed!.reason||c.atCore!==r.closed!.atCore)return 'Trade reward cleanup cause or time differs from its transition.';
  cleaned.add(c.id);
 }
 const delivered=new Set<number>();
 if(fulfilled){
  const f=r.fulfillment;if(!record(f)||!keys(f,['atCore','groupId','consumed','delivered','goodwill'])||f.atCore!==r.closed?.atCore||!int(f.groupId,1,planet.nextGroupId-1)||!dense(f.consumed,4096)||!f.consumed.length||!dense(f.delivered,TRADE_REQUEST_MAX_REWARD_STACKS_284)||!record(f.goodwill)||!keys(f.goodwill,['before','afterBonus','afterReward','bonusRequested','rewardRequested']))return 'Invalid trade fulfillment receipt.';
  const goodwill=f.goodwill,chosen=r.options.find(o=>o.id===r.selectedOptionId)!;
  if(![goodwill.before,goodwill.afterBonus,goodwill.afterReward].every(n=>int(n,-100,100))||goodwill.afterBonus<goodwill.before||goodwill.afterReward<goodwill.afterBonus||goodwill.bonusRequested!==12||goodwill.rewardRequested!==chosen.goodwill)return 'Invalid trade fulfillment goodwill receipt.';
  const sources=new Set<number>(),consumedIds=new Set<number>();let total=0;
  for(const c of f.consumed){if(!record(c)||!keys(c,['sourceId','id','item','quantity'])||!int(c.sourceId,1,root.nextId-1)||!int(c.id,1,root.nextId-1)||sources.has(c.sourceId)||consumedIds.has(c.id)||!content.items.includes(c.item)||!int(c.quantity,1,ITEM_DEFINITIONS[c.item]?.stackLimit??0))return 'Invalid consumed trade inventory receipt.';sources.add(c.sourceId);consumedIds.add(c.id);total+=c.quantity;if(!Number.isSafeInteger(total))return 'Trade consumed quantity overflow.';}
  if(total!==r.quantity)return 'Consumed trade quantity differs from the contract.';
  for(const d of f.delivered){if(!record(d)||!keys(d,['id','item','quantity','pawnId'],['quality'])||!manifest({id:d.id,item:d.item,quantity:d.quantity,...own(d,'quality')?{quality:d.quality}:{}},root.nextId)||!int(d.pawnId,1,root.nextId-1)||delivered.has(d.id))return 'Invalid delivered trade reward receipt.';const source=original.get(d.id);if(!source||source.optionId!==r.selectedOptionId||!sameTradeRewardManifest284(d,source.thing))return 'Delivered reward differs from the chosen original.';delivered.add(d.id);}
 }
 for(const [id,{optionId}]of original){const expected=r.status==='offered'||r.status==='accepted'&&optionId===r.selectedOptionId?'held':r.status==='succeeded'&&optionId===r.selectedOptionId?'delivered':'cleaned';if(Number(held.has(id))+Number(cleaned.has(id))+Number(delivered.has(id))!==1||(expected==='held'?!held.has(id):expected==='delivered'?!delivered.has(id):!cleaned.has(id)))return 'An original trade reward is missing or accounted for twice.';}
 return undefined;
}

/** Strict authority guard. The caller has already validated actual campaign
 * registries; a scalar context is sufficient, with no fake local World. Adds
 * only live held Things, once, after the whole candidate passes. */
export function validateTradeRequests284(value:unknown,root:TradeRequestsValidationContext284,ids:NumericMembershipSink):string[] {
 try{
  if(!int(root.schemaVersion,1,SCHEMA_VERSION))return ['Unknown trade request schema.'];
  const field=Object.getOwnPropertyDescriptor(root,'tradeRequests284');
  if(field&&(!field.enumerable||!own(field,'value')))return ['Invalid trade request authority descriptor.'];
  if(field&&field.value!==value||!field&&'tradeRequests284'in root)return ['Trade request authority differs from its actual field.'];
  if(!isSchema284OrLater(root.schemaVersion))return field||'tradeRequests284'in root||value!==undefined?['Future284 trade requests in an older campaign.']:[];
  if(value===undefined)return field||'tradeRequests284'in root?['Undefined284 trade request authority.']:[];
  if(!plainWorldPawnData256(value)||!record(value)||!keys(value,['revision','adoptedAtCore','nextId','entries'])||value.revision!==1||!clock(value.adoptedAtCore,0,root.tick*10)||!int(value.nextId,1)||!dense(value.entries,TRADE_REQUEST_MAX_ENTRIES_284)||!clock(root.tick*10)||!int(root.nextId,1)||!root.planet||!root.worldFactions)return ['Invalid trade request authority or actual world context.'];
  const requests=value as unknown as TradeRequests284,requestIds=new Set<number>(),manifests=new Set<number>(),held=new Map<number,MaterialPile>(),active=new Set<number>();
  for(const r of requests.entries){if(requestIds.has(r.id))return ['Duplicate trade request ID.'];requestIds.add(r.id);const error=entry(r,root,requests.nextId,requests.adoptedAtCore,manifests,held,active);if(error)return [error];}
  if([...held.keys()].some(id=>ids.has(id)))return ['A trade reward Thing already has another physical owner.'];
  for(const id of held.keys())ids.add(id);
  return [];
 }catch{return ['Invalid trade request data or holder namespace.'];}
}

/** Cold historical transport fence only. Current284 admission uses the closed
 * request graph above, never a generic campaign walk on each publication. */
export function validTradeRequestHistorical284(value:unknown,version:number):boolean {
 if(!int(version,1,SCHEMA_VERSION))return false;if(isSchema284OrLater(version))return true;
 let budget=2_000_000;const active=new WeakSet<object>(),done=new WeakSet<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return typeof v!=='function'&&typeof v!=='symbol';
  if(active.has(v))return false;if(done.has(v))return true;
  if(!Array.isArray(v)&&!record(v))return false;
  if('tradeRequests284'in v)return false;
  const tag=Object.getOwnPropertyDescriptor(v,'type');if(tag&&(!own(tag,'value')||tag.value==='trade-request284'))return false;
  active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!own(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(!walk(d.value))return false;
  }
  active.delete(v);done.add(v);return true;
 };
 try{return walk(value);}catch{return false;}
}
