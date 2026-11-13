import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {pileIndex,pileIndexMismatch,verifyPileIndex} from './pile-index.ts';
import {APPAREL,APPAREL_MATERIALS,APPAREL_FAMILIES,type ApparelMaterial,type ApparelFamily,type ApparelItem,type ApparelDefinition} from './apparel-definitions.ts';
import {FABRIC_TEXTILES308,type FabricTextile308} from './textile-apparel-308.ts';
export * from './apparel-definitions.ts';
import {apparelCompatible,type ArmorPiece} from './armor.ts';
import {QUALITY_LABELS,WEAPON_QUALITIES,type WeaponQuality} from './equipment-rules.ts';
import {partMissing} from './injury-state.ts';
import type {ItemId} from './items.ts';
import {SCHEMA_VERSION,type MaterialPile,type Pawn,type World} from './types.ts';

export interface ApparelState {
  /** False is a documented new birth; true is corpse wear; absence stays unknown. */
  corpseWear284?:boolean;
  /** Actual prospective MakeThing ColorGenerator outcome, not a texture sample. */
  birthColor?:import("./starting-apparel-color-256.ts").StartingApparelColor256;
  quality:WeaponQuality;
  hitPoints:number;
  /** Required on V90 textile products; absent remains the neutral legacy cloth representation. */
  material?:ApparelMaterial;
  forbidden?:true;
  /** Manual orders can protect a worn garment from automatic replacement. */
  forced?:true;
}

/** Every textile garment id is `${material}-${family}`. */
const familyItems=(family:Exclude<ApparelFamily,'tuque'>)=>Object.freeze(Object.fromEntries(APPAREL_MATERIALS.map(material=>[material,`${material}-${family}`]))) as Readonly<Record<ApparelMaterial,ApparelItem>>;
const ITEM_BY_FAMILY: Readonly<Record<Exclude<ApparelFamily,'tuque'>, Readonly<Record<ApparelMaterial, ApparelItem>>>> = Object.freeze({
  tribalwear:familyItems('tribalwear'),shirt:familyItems('shirt'),pants:familyItems('pants'),duster:familyItems('duster'),parka:familyItems('parka'),
});
export function apparelItemFor(family:ApparelFamily,material:ApparelMaterial):ApparelItem {
  if(family==='tuque'){
    if(material==='cloth')return 'cloth-tuque';
    if(material==='muffalo-wool')return 'muffalo-wool-tuque';
    if((FABRIC_TEXTILES308 as readonly string[]).includes(material))return `${material as FabricTextile308}-tuque`;
    throw new RangeError('Tuque requires a fabric');
  }
  return ITEM_BY_FAMILY[family][material];
}
export const isApparelMaterial=(value:unknown):value is ApparelMaterial=>typeof value==='string'&&APPAREL_MATERIALS.includes(value as ApparelMaterial);
export const isApparelFamily=(value:unknown):value is ApparelFamily=>value==='tuque'||APPAREL_FAMILIES.some(family=>family===value);
export const isApparelItem=(item:ItemId):item is ApparelItem=>Object.hasOwn(APPAREL,item);
export const apparelDefinition=(pile:MaterialPile):ApparelDefinition=>APPAREL[pile.item as ApparelItem];
export const apparelMaterial=(pile:Pick<MaterialPile,'item'|'apparel'>):ApparelMaterial|undefined=>pile.apparel?.material??APPAREL[pile.item as ApparelItem]?.material;
export const apparelFamily=(item:ApparelItem):ApparelFamily|undefined=>APPAREL[item].family;
export const wornApparel=(world:World,pawn:Pawn):MaterialPile[]=>world.piles.filter(p=>p.owner.type==='apparel'&&p.owner.pawnId===pawn.id);
export const apparelLabel=(pile:MaterialPile):string=>`${apparelDefinition(pile).label} (${QUALITY_LABELS[pile.apparel!.quality]})`;
export const newApparelState=(item:ApparelItem,material:ApparelMaterial|undefined=APPAREL[item].material,version:number=SCHEMA_VERSION):ApparelState=>({
  quality:'normal',hitPoints:APPAREL[item].hitPoints,...material===undefined?{}:{material},...isSchema284OrLater(version)?{corpseWear284:false}:{},
});
export const hasApparelParts=(pawn:Pawn,pile:MaterialPile):boolean=>apparelDefinition(pile).coverage.parts.some(p=>!pawn.health||!partMissing(pawn.health,p));
export const conflictsWith=(a:MaterialPile,b:MaterialPile):boolean=>!apparelCompatible(apparelDefinition(a).coverage,apparelDefinition(b).coverage);
export const apparelDuration=(world:World,pawn:Pawn,pile:MaterialPile,action:'wear'|'remove'):number=>apparelDefinition(pile).equipTicks+(action==='wear'?wornApparel(world,pawn).filter(p=>conflictsWith(p,pile)).reduce((n,p)=>n+apparelDefinition(p).equipTicks,0):0);
const factors=[.6,.8,1,1.15,1.3,1.45,1.8];
export const apparelQualityFactor=(quality:WeaponQuality):number=>factors[WEAPON_QUALITIES.indexOf(quality)]!;
export function armorPiece(pile:MaterialPile):ArmorPiece {
  const d=apparelDefinition(pile),factor=apparelQualityFactor(pile.apparel!.quality);
  return {id:pile.id,hitPoints:pile.apparel!.hitPoints,coverage:d.coverage,ratings:{sharp:Math.min(2,d.ratings.sharp*factor),blunt:Math.min(2,d.ratings.blunt*factor),heat:Math.min(2,d.ratings.heat*factor)}};
}
export function apparelInsulation(pile:MaterialPile):Readonly<{cold:number;heat:number}> {
  const d=apparelDefinition(pile),factor=[.8,.9,1,1.1,1.2,1.5,1.8][WEAPON_QUALITIES.indexOf(pile.apparel?.quality??'normal')]!;
  return {cold:d.coldInsulation*factor,heat:d.heatInsulation*factor};
}
/** Relative Core base speed effect; retain the game's existing travel calibration. */
export function apparelMoveFactor(world:World,pawn:Pawn):number {
  // Inside a simulation step the pile index holds each wearer's offset, summed
  // in pile order from 0: the same additions as the scan below.
  const index=Number.isInteger(pawn.id)?pileIndex(world):undefined,usable=!!index&&!index.undefinedWorn.has(pawn.id);
  let offset=0;
  if(usable&&!verifyPileIndex)offset=index!.wornOffsets.get(pawn.id)??0;
  else{
    for(const p of world.piles)if(p.owner.type==='apparel'&&p.owner.pawnId===pawn.id)offset+=apparelDefinition(p).moveOffset;
    if(usable&&(index!.wornOffsets.get(pawn.id)??0)!==offset)pileIndexMismatch('worn apparel offset');
  }
  return Math.max(.01,(4.6+offset)/4.6);
}
