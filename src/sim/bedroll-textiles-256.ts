/** Numeric stuff facts resolved from installed Core1.6.4871 XML; original data DTO.
 * Legacy materials and recipes remain literal. These soft materials enter new
 * bedroll recipes prospectively at256; item HP is never used as a stuff factor. */
export const BEDROLL_TEXTILES_256=Object.freeze({
 "dog-leather":Object.freeze({"category":"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1,"beautyOffset":0,"restFactor":1}),
 "cloth":Object.freeze({category:"fabric" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1,"flammabilityFactor":1.2,"beautyFactor":1.0,"beautyOffset":0,"restFactor":1}),
 "light-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.0,"flammabilityFactor":1,"beautyFactor":1,"beautyOffset":0,"restFactor":1}),
 "plainleather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1,"beautyOffset":0,"restFactor":1}),
 "bluefur":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1.3,"beautyOffset":0,"restFactor":1}),
 "camelhide":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1.3,"beautyOffset":0,"restFactor":1}),
 "foxfur":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.0,"flammabilityFactor":1,"beautyFactor":2.0,"beautyOffset":0,"restFactor":1}),
 "bear-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1.9,"beautyOffset":0,"restFactor":1}),
 "bird-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.0,"flammabilityFactor":1,"beautyFactor":1,"beautyOffset":0,"restFactor":1}),
 "chinchilla-fur":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.0,"flammabilityFactor":1,"beautyFactor":3.6,"beautyOffset":0,"restFactor":1}),
 "elephant-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.5,"flammabilityFactor":1,"beautyFactor":1.6,"beautyOffset":0,"restFactor":1}),
 "guinea-pig-fur":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":0.6,"flammabilityFactor":1,"beautyFactor":2.8,"beautyOffset":0,"restFactor":1}),
 "heavy-fur":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.5,"flammabilityFactor":1,"beautyFactor":1.85,"beautyOffset":0,"restFactor":1}),
 "lizard-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.0,"flammabilityFactor":1,"beautyFactor":1.2,"beautyOffset":0,"restFactor":1}),
 "panthera-fur":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1.7,"beautyOffset":0,"restFactor":1}),
 "pig-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1,"beautyOffset":0,"restFactor":1}),
 "rhinoceros-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.5,"flammabilityFactor":1,"beautyFactor":2.4,"beautyOffset":0,"restFactor":1}),
 "wolf-leather":Object.freeze({category:"leathery" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":1,"beautyFactor":1.7,"beautyOffset":0,"restFactor":1}),
 "muffalo-wool":Object.freeze({category:"fabric" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1,"flammabilityFactor":1.7,"beautyFactor":1.5,"beautyOffset":0,"restFactor":1}),
 "alpaca-wool":Object.freeze({category:"fabric" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1,"flammabilityFactor":1.7,"beautyFactor":1.5,"beautyOffset":0,"restFactor":1}),
 "bison-wool":Object.freeze({category:"fabric" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1,"flammabilityFactor":1.7,"beautyFactor":1.5,"beautyOffset":0,"restFactor":1}),
 "megasloth-wool":Object.freeze({category:"fabric" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1,"flammabilityFactor":1.7,"beautyFactor":1.5,"beautyOffset":0,"restFactor":1}),
 // Schema 358 (construction gates it): Core DevilstrandCloth statFactors MaxHitPoints 1.3, Flammability 0.4, Beauty 3.2.
 "devilstrand":Object.freeze({category:"fabric" as const,"workFactor":1,"workOffset":0,"hitPointsFactor":1.3,"flammabilityFactor":0.4,"beautyFactor":3.2,"beautyOffset":0,"restFactor":1}),
});
export type BedrollTextile256=keyof typeof BEDROLL_TEXTILES_256;
export const BEDROLL_MATERIALS_256=Object.freeze(Object.keys(BEDROLL_TEXTILES_256) as BedrollTextile256[]);
export const isBedrollTextile256=(value:unknown):value is BedrollTextile256=>typeof value==='string'&&Object.hasOwn(BEDROLL_TEXTILES_256,value);
export const isProspectiveFurnitureTextile256=(value:unknown):boolean=>isBedrollTextile256(value)&&value!=='cloth'&&value!=='light-leather';

/** Base item market values, not a sale price or a stuff factor. */
export const BEDROLL_TEXTILE_MARKET_VALUES_256=Object.freeze({
 "dog-leather":2,
 "cloth":1.5,
 "light-leather":1.9,
 "plainleather":2.1,
 "bluefur":2.3,
 "camelhide":2.3,
 "foxfur":3.5,
 "bear-leather":3.4,
 "bird-leather":1.8,
 "chinchilla-fur":6.5,
 "elephant-leather":3.0,
 "guinea-pig-fur":5.0,
 "heavy-fur":3.3,
 "lizard-leather":2.1,
 "panthera-fur":3.0,
 "pig-leather":1.9,
 "rhinoceros-leather":4.2,
 "wolf-leather":3.0,
 "muffalo-wool":2.7,
 "alpaca-wool":3.8,
 "bison-wool":2.7,
 "megasloth-wool":2.7,
 "devilstrand":5.5,
});
