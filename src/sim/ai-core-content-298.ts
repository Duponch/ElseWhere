import {isSchema298OrLater} from './schema-compatibility-257.ts';
/** Prospective original Elsewhere data, derived from the verified Core facts.
 * This leaf grants no acquisition, stock, migration or construction admission. */
export const AI_CORE_CONTENT_SCHEMA_298=298 as const;
export const isAiCoreContentSchema298=(value:unknown):value is typeof AI_CORE_CONTENT_SCHEMA_298|299|300|301|302|303|304|305|306|307|308|309|310|311|312|313|314|315|316|317|318|319|320|321|322|323|324|325|326=>isSchema298OrLater(value);

/** Sellable lets a trader BUY the player's object. ExoticMisc does not let a
 * trader create this object for sale; the physical information/cache path owns
 * prospective acquisition. No current ItemId/MaterialKind is changed here. */
export const AI_CORE_CONTENT_298=Object.freeze({
 item:'ai-core' as const,kind:'ai-core' as const,label:'Cœur d’IA',nativeDef:'AIPersonaCore',
 stackLimit:1,maxHitPoints:100,massGrams:2000,baseMarketValue:4000,flammability:.2,
 techLevel:'Ultra' as const,tradeability:'Sellable' as const,
 tradeTags:Object.freeze(['ExoticMisc'] as const),traderCanSell:false,traderCanBuy:true,
});
export type AiCoreItem298=typeof AI_CORE_CONTENT_298.item;
export type AiCoreMaterialKind298=typeof AI_CORE_CONTENT_298.kind;
export const isAiCoreItem298=(value:unknown):value is AiCoreItem298=>value===AI_CORE_CONTENT_298.item;
