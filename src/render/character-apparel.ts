import {packStartingApparelTint256,startingApparelTintHex256} from '../sim/starting-apparel-color-256';
import {GARMENT_ITEMS312,type GarmentItem312} from '../sim/apparel-definitions';
import { APPAREL,apparelLabel,type ApparelItem } from '../sim/apparel-rules';
import {isSmithingApparel267} from '../sim/smithing-apparel-267';
import {itemCargoKind} from './item-presentation';
import {TEXTILE_APPAREL_ITEMS308,type TextileApparelItem308} from '../sim/textile-apparel-308';
import type { World,MaterialPile } from '../sim/types';

/** One snapshot projection for map and portraits; no render-owned inventory. */
export function apparelProjection(world:World):ReadonlyMap<number,readonly MaterialPile[]> {
  const result=new Map<number,MaterialPile[]>();
  for(const pile of world.piles)if(pile.owner.type==='apparel'){
    const list=result.get(pile.owner.pawnId)??[];list.push(pile);result.set(pile.owner.pawnId,list);
  }
  return result;
}
export function apparelAppearance(pieces:readonly MaterialPile[]=[]) {
  const family=(name:string)=>pieces.find(p=>APPAREL[p.item as ApparelItem]?.family===name);
  const tuque=family('tuque'),vest=pieces.find(p=>p.item==='flak-vest');
  const shirt=family('shirt')??family('tshirt'),tribal=family('tribalwear'),pants=pieces.find(p=>p.item==='flak-pants')??family('pants'),outer=family('duster')??family('parka')??family('jacket');
  const plate=pieces.find(p=>isSmithingApparel267(p.item)&&p.item.endsWith('-plate-armor'));
  const simple=pieces.find(p=>isSmithingApparel267(p.item)&&p.item.endsWith('-simple-helmet'));
  const recon=pieces.find(p=>p.item==='recon-armor'),top=plate??recon??outer??tribal??shirt,definition=top?APPAREL[top.item as ApparelItem]:undefined;
  return {shirt:!!shirt,tribal:!!tribal,vest:pieces.some(p=>p.item==='flak-vest')&&!outer&&!plate,
    helmet:!!simple||pieces.some(p=>p.item==='flak-helmet'||p.item==='plasteel-flak-helmet'||p.item==='recon-helmet'),
    plateArmor:!!plate,simpleHelmet:!!simple,simpleHelmetColor:simple?APPAREL[simple.item as ApparelItem].color:undefined,
    simpleHelmetMaterial:simple?SIMPLE_HELMET_ITEMS267.indexOf(simple.item as typeof SIMPLE_HELMET_ITEMS267[number])+1:0,
    plasteelHelmet:pieces.some(p=>p.item==='plasteel-flak-helmet'),
    reconHelmet:pieces.some(p=>p.item==='recon-helmet'),tuque:tuque?(tuque.item==='cloth-tuque'?1:2):0,
    silhouette:plate?6:recon?5:outer?(definition!.family==='parka'||definition!.family==='jacket'?4:3):tribal?2:shirt?1:0,
    pants:pants?(pants.item==='flak-pants'?(pants.apparel?.birthColor?(pants.apparel.birthColor.r===Math.fround(.62)?9:10):8):(['cloth','light-leather','plainleather','bluefur','camelhide','muffalo-wool','foxfur'].indexOf(legacyPantsMaterial308(APPAREL[pants.item as ApparelItem].material??'cloth'))+1)):0,
    ...(vest?.apparel?.birthColor&&!outer?{vestTintCode:packStartingApparelTint256(vest.apparel.birthColor),vestTintColor:startingApparelTintHex256(vest.apparel.birthColor)}:{}),
    color:definition?.color,signature:pieces.map(p=>p.item+(p.apparel?.birthColor?':'+Object.values(p.apparel.birthColor).join(','):'')).sort().join(' '),description:pieces.map(apparelLabel).join(', ')||'Aucun vêtement équipé'};
}
/** Mutually exclusive codes preserve every historical equipment integer.
 * Simple helmet pigment occupies exact sixteenths in the existing pants word. */
export const SIMPLE_HELMET_ITEMS267=['steel-simple-helmet','plasteel-simple-helmet','uranium-simple-helmet','silver-simple-helmet','gold-simple-helmet'] as const;
export const SIMPLE_HELMET_COLORS267=Object.freeze(SIMPLE_HELMET_ITEMS267.map(item=>APPAREL[item].color));
export const APPAREL_CARGO:Readonly<Record<ApparelItem,number>>=Object.freeze({
  ...Object.fromEntries(TEXTILE_APPAREL_ITEMS308.map(item=>[item,itemCargoKind(item)])) as Record<TextileApparelItem308,number>,
  ...Object.fromEntries(GARMENT_ITEMS312.map(item=>[item,itemCargoKind(item)])) as Record<GarmentItem312,number>,
  'wood-plate-armor':itemCargoKind('wood-plate-armor'),'steel-plate-armor':itemCargoKind('steel-plate-armor'),
  'plasteel-plate-armor':itemCargoKind('plasteel-plate-armor'),'uranium-plate-armor':itemCargoKind('uranium-plate-armor'),
  'silver-plate-armor':itemCargoKind('silver-plate-armor'),'gold-plate-armor':itemCargoKind('gold-plate-armor'),
  'steel-simple-helmet':itemCargoKind('steel-simple-helmet'),'plasteel-simple-helmet':itemCargoKind('plasteel-simple-helmet'),
  'uranium-simple-helmet':itemCargoKind('uranium-simple-helmet'),'silver-simple-helmet':itemCargoKind('silver-simple-helmet'),'gold-simple-helmet':itemCargoKind('gold-simple-helmet'),
  'foxfur-tribalwear':76,'foxfur-shirt':77,'foxfur-pants':78,'foxfur-duster':79,'foxfur-parka':80,
  'plainleather-tribalwear':39,
  'plainleather-shirt':40,
  'plainleather-pants':41,
  'plainleather-duster':42,
  'plainleather-parka':43,
  'bluefur-tribalwear':44,
  'bluefur-shirt':45,
  'bluefur-pants':46,
  'bluefur-duster':47,
  'bluefur-parka':48,
  'camelhide-tribalwear':49,
  'camelhide-shirt':50,
  'camelhide-pants':51,
  'camelhide-duster':52,
  'camelhide-parka':53,
  'muffalo-wool-tribalwear':54,
  'muffalo-wool-shirt':55,
  'muffalo-wool-pants':56,
  'muffalo-wool-duster':57,
  'muffalo-wool-parka':58,
  'flak-helmet':59,
  'flak-pants':84,'plasteel-flak-helmet':85,
  'recon-helmet':72,'recon-armor':81,'cloth-tuque':82,'muffalo-wool-tuque':83,
  'cloth-shirt':22,'flak-vest':23,'cloth-tribalwear':26,'light-leather-shirt':31,'light-leather-tribalwear':32,
  'cloth-pants':33,'light-leather-pants':34,'cloth-duster':35,'light-leather-duster':36,'cloth-parka':37,'light-leather-parka':38,
});
/** Folded ground/cargo meshes share dimensions and colors, in world units. */
export function foldedApparel(item:ApparelItem) {
  const color=APPAREL[item].color;
  if(item.endsWith('-tuque'))return [{size:[.34,.18,.33],center:[0,.045,0],color},{size:[.40,.06,.37],center:[0,-.045,0],color}];
  if(item==='flak-helmet'||item==='plasteel-flak-helmet')return [{size:[.34,.14,.33],center:[0,.04,0],color},
    {size:[.42,.035,.36],center:[0,-.01,.03],color:0x424e51}];
  if(item==='recon-armor')return [{size:[.46,.16,.58],center:[0,0,0],color},{size:[.30,.04,.32],center:[0,.1,0],color:0x536a74}];
  if(item==='recon-helmet')return [{size:[.36,.19,.35],center:[0,.025,0],color},
    {size:[.39,.045,.29],center:[0,-.085,.025],color:0x536a74},
    {size:[.29,.045,.035],center:[0,.015,.19],color:0x344a57}];
  return [{size:[.42,.12,.48],center:[0,0,0],color},
    {size:[.16,.025,.12],center:[0,.073,-.12],color:item==='flak-vest'?0x3d4945:0xf0e8d5}];
}

/** The pants colour code holds sixteen values (simple helmet pigment shares
 * the word): the schema 308 leathers and wools reuse the nearest of the seven
 * historical pants colours (leathers by family, wools as wool). */
const PANTS_COLOUR_FALLBACK308:Readonly<Record<string,string>>=Object.freeze({
  'dog-leather':'camelhide','bear-leather':'plainleather','bird-leather':'bluefur','chinchilla-fur':'muffalo-wool','elephant-leather':'muffalo-wool',
  'guinea-pig-fur':'foxfur','heavy-fur':'camelhide','lizard-leather':'plainleather','panthera-fur':'bluefur','pig-leather':'light-leather',
  'rhinoceros-leather':'muffalo-wool','wolf-leather':'bluefur','alpaca-wool':'camelhide','bison-wool':'plainleather','megasloth-wool':'camelhide',
});
export const legacyPantsMaterial308=(material:string):string=>PANTS_COLOUR_FALLBACK308[material]??material;
