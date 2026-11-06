import {schemaAtLeast} from './schema-range.ts';
/** Closed supported geographic schema range. Historical contracts stay literal. */
export const isSchema256Or257=schemaAtLeast(256);
/** Capabilities introduced in263 continue through289. This is a closed family:
 * neither a future schema nor fields introduced after each guarded contract are admitted here. */
export const isSchema263OrLater=schemaAtLeast(263);
/** Brewing capabilities remain literal on265 and continue on the supported289. */
export const isSchema265OrLater=schemaAtLeast(265);

/** Smithing capabilities introduced267 continue only on the supported289. */
export const isSchema267OrLater=schemaAtLeast(267);

/** Mace and crafting-fuel records continue through the supported closed family. */
export const isSchema269OrLater=schemaAtLeast(269);

/** Long blades continue only in the supported closed schema family. */
export const isSchema270OrLater=schemaAtLeast(270);

/** Civil/active clocks and actual cryptosleep owners remain a closed family. */
export const isSchema271OrLater=schemaAtLeast(271);

/** Spears introduced272 continue on the supported289 only. */
export const isSchema272OrLater=schemaAtLeast(272);

/** Industrial prostheses continue only through the supported closed family. */
export const isSchema273OrLater=schemaAtLeast(273);

/** Diplomatic gifts and hysteresis continue only through the supported family. */
export const isSchema274OrLater=schemaAtLeast(274);

/** Ship reactor capabilities have no historical or future admission. */
export const isSchema275OrLater=schemaAtLeast(275);

/** Hull/engine research continues only through the supported closed family. */
export const isSchema276OrLater=schemaAtLeast(276);

/** Spatial cryptosleep continues only through the supported closed family. */
export const isSchema277OrLater=schemaAtLeast(277);

/** Apparel reserve settings have no historical or future admission. */
export const isSchema278OrLater=schemaAtLeast(278);

/** Ordinary apparel inventory begins only in the current closed family. */
export const isSchema279OrLater=schemaAtLeast(279);

/** Therapeutic captive surgery begins only in the supported closed family. */
export const isSchema280OrLater=schemaAtLeast(280);

/** Natural stone floor smoothing begins only in this supported family. */
export const isSchema281OrLater=schemaAtLeast(281);

/** Prospective animal learning and local hauling remain a closed family. */
export const isSchema282OrLater=schemaAtLeast(282);

/** Explicit bill worker policies begin only in this supported family. */
export const isSchema283OrLater=schemaAtLeast(283);

/** World trade requests and prospective corpse-wear provenance are introduced284 and closed through289. */
export const isSchema284OrLater=schemaAtLeast(284);

/** Adult couple capabilities continue only through the supported family. */
export const isSchema285OrLater=schemaAtLeast(285);

/** Linked storage remains active in the supported closed family. */
export const isSchema286OrLater=schemaAtLeast(286);

/** Animal areas and local thermal owner admission remain a closed family. */
export const isSchema287OrLater=schemaAtLeast(287);

/** Thermal refuge continues on the closed current family; future295 remains refused. */
export const isSchema288OrLater=schemaAtLeast(288);

/** Production reserve capabilities in the closed current family. */
export const isSchema289OrLater=schemaAtLeast(289);

/** ToxicFallout continues only in these two explicitly supported schemas. */
export const isSchema294OrLater=schemaAtLeast(294);

/** Content introduced in298 continues unchanged only through supported299. */
export const isSchema298OrLater=schemaAtLeast(298);

/** Human ingestion provenance and provider rules continue in the closed300 family. */
export const isSchema299OrLater=schemaAtLeast(299);

/** Closed continuation of civil ownership/admission300; no historical activation. */
export const isSchema300OrLater=schemaAtLeast(300);
/** Introduced 290 to 292; formerly enumerated as literal lists in callers. */
export const isSchema290OrLater=schemaAtLeast(290);
export const isSchema291OrLater=schemaAtLeast(291);
export const isSchema292OrLater=schemaAtLeast(292);
