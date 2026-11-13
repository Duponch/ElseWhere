/** Pure item/coverage/stat definitions. Keep catalogue initialization independent of medical, work and production runtime cycles. */
import {apparelCoverage,type ApparelCoverage,type ArmorRatings} from './armor.ts';
import {SMITHING_APPAREL_DEFINITIONS267,type SmithingApparel267,type ArmorStuff267} from './smithing-apparel-267.ts';
import {TEXTILE_MATERIALS308,TEXTILE_MATERIAL_FACTS308,TEXTILE_APPAREL_ITEMS308,type TextileApparelItem308,type TextileMaterial308} from './textile-apparel-308.ts';
/** The seven historical materials, then (schema 308) every other Core leather and wool. */
export const LEGACY_APPAREL_MATERIALS308 = ['cloth', 'light-leather', 'plainleather', 'bluefur', 'camelhide', 'muffalo-wool', 'foxfur'] as const;
export const APPAREL_MATERIALS = [...LEGACY_APPAREL_MATERIALS308, ...TEXTILE_MATERIALS308] as const;
export type ApparelMaterial = typeof APPAREL_MATERIALS[number];
/** Historical families admit every existing material. Tuques are a limited family. */
/** Schema 312: Core Apparel_BasicShirt (T-shirt) and Apparel_Jacket. */
export const GARMENT_FAMILIES312 = ['tshirt', 'jacket'] as const;
export type GarmentFamily312 = typeof GARMENT_FAMILIES312[number];
export const APPAREL_FAMILIES = ['tribalwear', 'shirt', 'pants', 'duster', 'parka', ...GARMENT_FAMILIES312] as const;
export type ApparelFamily = typeof APPAREL_FAMILIES[number] | 'tuque';

export interface ApparelMaterialDefinition {
  readonly label: string;
  readonly color: number;
  readonly armor: ArmorRatings;
  readonly coldInsulation: number;
  readonly heatInsulation: number;
}
export const APPAREL_MATERIAL_DEFINITIONS: Readonly<Record<ApparelMaterial, ApparelMaterialDefinition>> = Object.freeze({
  cloth: Object.freeze({label:'tissu',color:0xd8c8a2,armor:Object.freeze({sharp:.36,blunt:0,heat:.18}),coldInsulation:18,heatInsulation:18}),
  'light-leather': Object.freeze({label:'cuir léger',color:0xad8a61,armor:Object.freeze({sharp:.54,blunt:.14,heat:1.5}),coldInsulation:12,heatInsulation:12}),
  plainleather:Object.freeze({label:'cuir ordinaire',color:0xa88b63,armor:Object.freeze({sharp:.81,blunt:.24,heat:1.5}),coldInsulation:16,heatInsulation:16}),
  bluefur:Object.freeze({label:'fourrure bleue',color:0x839ac5,armor:Object.freeze({sharp:.81,blunt:.24,heat:1.5}),coldInsulation:20,heatInsulation:16}),
  camelhide:Object.freeze({label:'cuir de chameau',color:0xc3a375,armor:Object.freeze({sharp:.81,blunt:.24,heat:1.5}),coldInsulation:16,heatInsulation:24}),
  'muffalo-wool':Object.freeze({label:'laine de mufalo',color:0xb3c0ba,armor:Object.freeze({sharp:.36,blunt:0,heat:1.1}),coldInsulation:28,heatInsulation:12}),
  foxfur:Object.freeze({label:'fourrure de renard',color:0xb26422,armor:Object.freeze({sharp:.81,blunt:.21,heat:1.5}),coldInsulation:20,heatInsulation:16}),
  ...Object.fromEntries(TEXTILE_MATERIALS308.map(m=>{const f=TEXTILE_MATERIAL_FACTS308[m];return [m,Object.freeze({label:f.label,color:f.color,armor:f.armor,coldInsulation:f.coldInsulation,heatInsulation:f.heatInsulation})];})) as Record<TextileMaterial308,ApparelMaterialDefinition>,
});

interface ApparelFamilyDefinition {
  readonly label: string;
  readonly hitPoints: number;
  readonly equipTicks: number;
  readonly coverage: ApparelCoverage;
  readonly armorFactor: number;
  readonly coldFactor: number;
  readonly heatFactor: number;
}
export const APPAREL_FAMILY_DEFINITIONS: Readonly<Record<ApparelFamily, ApparelFamilyDefinition>> = Object.freeze({
  tribalwear: Object.freeze({label:'Tenue tribale',hitPoints:100,equipTicks:9,coverage:apparelCoverage(['skin'],['torso','legs']),armorFactor:.2,coldFactor:.55,heatFactor:.55}),
  shirt: Object.freeze({label:'Chemise',hitPoints:100,equipTicks:9,coverage:apparelCoverage(['skin'],['torso','neck','shoulders','arms']),armorFactor:.2,coldFactor:.26,heatFactor:.1}),
  pants: Object.freeze({label:'Pantalon',hitPoints:100,equipTicks:12,coverage:apparelCoverage(['skin'],['legs']),armorFactor:.2,coldFactor:.2,heatFactor:.08}),
  duster: Object.freeze({label:'Cache-poussière',hitPoints:200,equipTicks:18,coverage:apparelCoverage(['shell'],['torso','neck','shoulders','arms','legs']),armorFactor:.3,coldFactor:.6,heatFactor:.85}),
  // Core48 equip ticks are quantized to50 Core ticks by our 10-Core step.
  tuque:Object.freeze({label:'Tuque',hitPoints:80,equipTicks:5,coverage:apparelCoverage(['headgear'],['upper-head']),armorFactor:.2,coldFactor:.5,heatFactor:0}),
  parka: Object.freeze({label:'Parka',hitPoints:180,equipTicks:18,coverage:apparelCoverage(['shell'],['torso','neck','shoulders','arms']),armorFactor:.2,coldFactor:2,heatFactor:0}),
  // Core BasicShirt: OnSkin, Torso and Shoulders; Jacket: Shell, Torso, Neck,
  // Shoulders, Arms. EquipDelay 1.5 s = 90 Core ticks.
  tshirt: Object.freeze({label:'T-shirt',hitPoints:100,equipTicks:9,coverage:apparelCoverage(['skin'],['torso','shoulders']),armorFactor:.2,coldFactor:.22,heatFactor:.1}),
  jacket: Object.freeze({label:'Blouson',hitPoints:160,equipTicks:9,coverage:apparelCoverage(['shell'],['torso','neck','shoulders','arms']),armorFactor:.3,coldFactor:.8,heatFactor:.3}),
});

export interface ApparelDefinition {
  readonly label: string;
  readonly hitPoints: number;
  readonly equipTicks: number;
  readonly color: number;
  readonly coverage: ApparelCoverage;
  readonly ratings: ArmorRatings;
  readonly moveOffset: number;
  readonly family?: ApparelFamily;
  readonly material?: ApparelMaterial;
  /** Finite armor Stuff; never a material admitted by textile recipes. */
  readonly stuff?: ArmorStuff267;
  readonly coldInsulation: number;
  readonly heatInsulation: number;
}
const textileDefinition = (family: ApparelFamily, material: ApparelMaterial): ApparelDefinition => {
  const garment=APPAREL_FAMILY_DEFINITIONS[family],stuff=APPAREL_MATERIAL_DEFINITIONS[material];
  return Object.freeze({
    label:`${garment.label} en ${stuff.label}`,
    hitPoints:Math.round(garment.hitPoints*((TEXTILE_MATERIALS308 as readonly string[]).includes(material)?TEXTILE_MATERIAL_FACTS308[material as TextileMaterial308].hitPointsFactor:['plainleather','bluefur','camelhide'].includes(material)?1.3:1)),equipTicks:garment.equipTicks,color:stuff.color,coverage:garment.coverage,
    ratings:Object.freeze({sharp:stuff.armor.sharp*garment.armorFactor,blunt:stuff.armor.blunt*garment.armorFactor,heat:stuff.armor.heat*garment.armorFactor}),
    moveOffset:0,family,material,coldInsulation:stuff.coldInsulation*garment.coldFactor,heatInsulation:stuff.heatInsulation*garment.heatFactor,
  });
};

/** Every material's T-shirt and jacket (schema 312), in catalogue order. */
export type GarmentItem312=`${ApparelMaterial}-${GarmentFamily312}`;
export const GARMENT_ITEMS312:readonly GarmentItem312[]=Object.freeze(APPAREL_MATERIALS.flatMap(m=>GARMENT_FAMILIES312.map(f=>`${m}-${f}` as GarmentItem312)));
export const isGarmentItem312=(value:unknown):value is GarmentItem312=>typeof value==='string'&&(GARMENT_ITEMS312 as readonly string[]).includes(value);
export type ApparelItem=`${ApparelMaterial}-${Exclude<ApparelFamily,'tuque'>}`|'cloth-tuque'|'muffalo-wool-tuque'|TextileApparelItem308|'flak-vest'|'flak-helmet'|'recon-helmet'|'recon-armor'|'flak-pants'|'plasteel-flak-helmet'|SmithingApparel267;
/** Existing cloth ids stay canonical so old saves and reservations retain identity. */
export const APPAREL:Readonly<Record<ApparelItem,ApparelDefinition>> = Object.freeze({
  ...SMITHING_APPAREL_DEFINITIONS267,
  'foxfur-tribalwear': textileDefinition('tribalwear','foxfur'),
  'foxfur-shirt': textileDefinition('shirt','foxfur'),
  'foxfur-pants': textileDefinition('pants','foxfur'),
  'foxfur-duster': textileDefinition('duster','foxfur'),
  'foxfur-parka': textileDefinition('parka','foxfur'),
  'cloth-tribalwear': textileDefinition('tribalwear','cloth'),
  'plainleather-tribalwear': textileDefinition('tribalwear','plainleather'),
  'plainleather-shirt': textileDefinition('shirt','plainleather'),
  'plainleather-pants': textileDefinition('pants','plainleather'),
  'plainleather-duster': textileDefinition('duster','plainleather'),
  'plainleather-parka': textileDefinition('parka','plainleather'),
  'bluefur-tribalwear': textileDefinition('tribalwear','bluefur'),
  'bluefur-shirt': textileDefinition('shirt','bluefur'),
  'bluefur-pants': textileDefinition('pants','bluefur'),
  'bluefur-duster': textileDefinition('duster','bluefur'),
  'bluefur-parka': textileDefinition('parka','bluefur'),
  'camelhide-tribalwear': textileDefinition('tribalwear','camelhide'),
  'camelhide-shirt': textileDefinition('shirt','camelhide'),
  'camelhide-pants': textileDefinition('pants','camelhide'),
  'camelhide-duster': textileDefinition('duster','camelhide'),
  'camelhide-parka': textileDefinition('parka','camelhide'),
  'muffalo-wool-tribalwear': textileDefinition('tribalwear','muffalo-wool'),
  'muffalo-wool-shirt': textileDefinition('shirt','muffalo-wool'),
  'muffalo-wool-pants': textileDefinition('pants','muffalo-wool'),
  'muffalo-wool-duster': textileDefinition('duster','muffalo-wool'),
  'muffalo-wool-parka': textileDefinition('parka','muffalo-wool'),
  'cloth-shirt': textileDefinition('shirt','cloth'),
  'light-leather-tribalwear': textileDefinition('tribalwear','light-leather'),
  'light-leather-shirt': textileDefinition('shirt','light-leather'),
  'cloth-pants': textileDefinition('pants','cloth'),
  'light-leather-pants': textileDefinition('pants','light-leather'),
  'cloth-duster': textileDefinition('duster','cloth'),
  'light-leather-duster': textileDefinition('duster','light-leather'),
  'cloth-tuque':textileDefinition('tuque','cloth'),
  'muffalo-wool-tuque':textileDefinition('tuque','muffalo-wool'),
  'cloth-parka': textileDefinition('parka','cloth'),
  'light-leather-parka': textileDefinition('parka','light-leather'),
  'flak-vest': Object.freeze({label:'Gilet pare-balles',hitPoints:200,equipTicks:30,color:0x626d65,coverage:apparelCoverage(['middle'],['torso','neck']),ratings:Object.freeze({sharp:1,blunt:.36,heat:.27}),moveOffset:-.12,coldInsulation:1,heatInsulation:0}),
  'flak-pants':Object.freeze({label:'Pantalon pare-balles',hitPoints:200,equipTicks:30,color:0x707070,coverage:apparelCoverage(['skin','middle'],['legs']),ratings:Object.freeze({sharp:.55,blunt:.08,heat:.10}),moveOffset:-.12,coldInsulation:3.5,heatInsulation:1}),
  // 120 * Plasteel2.8, then MaxHitPoints round-to-five above200 =335.
  'plasteel-flak-helmet':Object.freeze({label:'Casque pare-balles en plastacier',hitPoints:335,equipTicks:9,color:0xa0b2b5,coverage:apparelCoverage(['headgear'],['upper-head']),ratings:Object.freeze({sharp:Math.fround(Math.fround(1.14)*Math.fround(.7)),blunt:Math.fround(Math.fround(.55)*Math.fround(.7)),heat:Math.fround(Math.fround(.65)*Math.fround(.7))}),moveOffset:0,coldInsulation:Math.fround(Math.fround(3)*Math.fround(.15)),heatInsulation:0}),
  // Core 1.6 Apparel_AdvancedHelmet, made from steel as the local fixed
  // metallic stuff: Steel armor .90/.45/.60 times the helmet's .70 factor.
  'flak-helmet': Object.freeze({label:'Casque pare-balles',hitPoints:120,equipTicks:9,color:0x697579,coverage:apparelCoverage(['headgear'],['upper-head']),ratings:Object.freeze({sharp:.63,blunt:.315,heat:.42}),moveOffset:0,coldInsulation:.45,heatInsulation:0}),
  // Core 1.6 Apparel_ArmorHelmetRecon: FullHead, Overhead, fixed ratings.
  'recon-armor':Object.freeze({label:'Combinaison de reconnaissance',hitPoints:280,equipTicks:66,color:0x879da4,coverage:apparelCoverage(['middle','shell'],['torso','neck','shoulders','arms','legs']),ratings:Object.freeze({sharp:.92,blunt:.4,heat:.46}),moveOffset:0,coldInsulation:64,heatInsulation:9}),
  'recon-helmet': Object.freeze({label:'Casque de reconnaissance',hitPoints:120,equipTicks:12,color:0x879da4,coverage:apparelCoverage(['headgear'],['full-head']),ratings:Object.freeze({sharp:.92,blunt:.4,heat:.46}),moveOffset:0,coldInsulation:4,heatInsulation:2}),
  ...Object.fromEntries(TEXTILE_APPAREL_ITEMS308.map(item=>{const i=item.lastIndexOf('-');return [item,textileDefinition(item.slice(i+1) as ApparelFamily,item.slice(0,i) as ApparelMaterial)];})) as Record<TextileApparelItem308,ApparelDefinition>,
  ...Object.fromEntries(GARMENT_ITEMS312.map(item=>{const i=item.lastIndexOf('-');return [item,textileDefinition(item.slice(i+1) as ApparelFamily,item.slice(0,i) as ApparelMaterial)];})) as Record<GarmentItem312,ApparelDefinition>,
});
type GarmentItemDefinition312={readonly label:string;readonly kind:'apparel';readonly stackLimit:1;readonly nutrition:0;readonly maxIngest:0;readonly color:number};
export const GARMENT_ITEM_DEFINITIONS312=Object.freeze(Object.fromEntries(GARMENT_ITEMS312.map(item=>[item,Object.freeze({label:APPAREL[item].label,kind:'apparel' as const,stackLimit:1 as const,nutrition:0 as const,maxIngest:0 as const,color:APPAREL[item].color})]))) as Readonly<Record<GarmentItem312,GarmentItemDefinition312>>;
