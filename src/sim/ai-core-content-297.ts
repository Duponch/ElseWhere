/** Prospective original Elsewhere data, derived from the verified Core facts.
 * This leaf grants no acquisition, stock, migration or construction admission. */
export const AI_CORE_CONTENT_SCHEMA_297=297 as const;
export const isAiCoreContentSchema297=(value:unknown):value is typeof AI_CORE_CONTENT_SCHEMA_297=>value===AI_CORE_CONTENT_SCHEMA_297;

/** Sellable lets a trader BUY the player's object. ExoticMisc does not let a
 * trader create this object for sale; the physical information/cache path owns
 * prospective acquisition. No current ItemId/MaterialKind is changed here. */
export const AI_CORE_CONTENT_297=Object.freeze({
 item:'ai-core' as const,kind:'ai-core' as const,label:'Cœur d’IA',nativeDef:'AIPersonaCore',
 stackLimit:1,maxHitPoints:100,massGrams:2000,baseMarketValue:4000,flammability:.2,
 techLevel:'Ultra' as const,tradeability:'Sellable' as const,
 tradeTags:Object.freeze(['ExoticMisc'] as const),traderCanSell:false,traderCanBuy:true,
});
export type AiCoreItem297=typeof AI_CORE_CONTENT_297.item;
export type AiCoreMaterialKind297=typeof AI_CORE_CONTENT_297.kind;
export const isAiCoreItem297=(value:unknown):value is AiCoreItem297=>value===AI_CORE_CONTENT_297.item;
