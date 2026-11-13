import {schemaAtLeast} from './schema-range.ts';

/* Schema 308: every Core leather and wool that this game already produces
 * becomes a tailoring material, as in RimWorld 1.6 where the basic garments
 * take any Fabric or Leathery stuff (the tuque only Fabric). Stuff powers,
 * insulation, hit point factor and market value are the Core values
 * (Items_Resource_Stuff_Leather.xml, LeatherBase and WoolBase); labels and
 * pastel colours are our own. */
export const isTextileApparel308=schemaAtLeast(308);
export const TEXTILE_MATERIALS308=['dog-leather','bear-leather','bird-leather','chinchilla-fur','elephant-leather','guinea-pig-fur','heavy-fur','lizard-leather',
  'panthera-fur','pig-leather','rhinoceros-leather','wolf-leather','alpaca-wool','bison-wool','megasloth-wool'] as const;
export type TextileMaterial308=typeof TEXTILE_MATERIALS308[number];
export const FABRIC_TEXTILES308=['alpaca-wool','bison-wool','megasloth-wool'] as const;
export type FabricTextile308=typeof FABRIC_TEXTILES308[number];
export const isTextileMaterial308=(value:unknown):value is TextileMaterial308=>typeof value==='string'&&(TEXTILE_MATERIALS308 as readonly string[]).includes(value);

export interface TextileMaterialFact308 {
  readonly label:string;readonly color:number;
  readonly armor:Readonly<{sharp:number;blunt:number;heat:number}>;
  readonly coldInsulation:number;readonly heatInsulation:number;
  readonly hitPointsFactor:number;readonly marketValue:number;
}
const fact=(label:string,color:number,sharp:number,blunt:number,heat:number,cold:number,hot:number,hp:number,value:number):TextileMaterialFact308=>
  Object.freeze({label,color,armor:Object.freeze({sharp,blunt,heat}),coldInsulation:cold,heatInsulation:hot,hitPointsFactor:hp,marketValue:value});
export const TEXTILE_MATERIAL_FACTS308:Readonly<Record<TextileMaterial308,TextileMaterialFact308>>=Object.freeze({
  'dog-leather':fact('cuir de chien',0xd7c28a,.81,.24,1.5,14,16,1.3,2),
  'bear-leather':fact('cuir d’ours',0x8f7b6e,1.12,.24,1.5,20,20,1.3,3.4),
  'bird-leather':fact('cuir d’oiseau',0x7f8693,.67,.14,1.5,10,10,1,1.8),
  'chinchilla-fur':fact('fourrure de chinchilla',0xc9c3b9,.67,.14,1.5,30,16,1,6.5),
  'elephant-leather':fact('cuir d’éléphant',0xa29f98,1.12,.24,1.5,14,12,1.5,3),
  'guinea-pig-fur':fact('fourrure de cochon d’Inde',0xc7a173,.67,.14,1.5,38,18,.6,5),
  'heavy-fur':fact('fourrure épaisse',0xcdb796,1.24,.24,1.5,30,14,1.5,3.3),
  'lizard-leather':fact('cuir de lézard',0x8a9670,.81,.27,1.5,12,12,1,2.1),
  'panthera-fur':fact('fourrure de félin',0x6f6f6f,.93,.24,1.5,16,24,1.3,3),
  'pig-leather':fact('cuir de porc',0xc6b4a2,.64,.24,1.5,12,12,1.3,1.9),
  'rhinoceros-leather':fact('cuir de rhinocéros',0xaeaeae,1.29,.24,1.5,14,14,1.5,4.2),
  'wolf-leather':fact('cuir de loup',0x908c84,1.02,.24,1.5,24,16,1.3,3),
  'alpaca-wool':fact('laine d’alpaga',0xc8b394,.36,0,1.1,30,16,1,3.8),
  'bison-wool':fact('laine de bison',0x8a7465,.36,0,1.1,26,12,1,2.7),
  'megasloth-wool':fact('laine de mégapareux',0xcdb796,.8,0,1.1,34,12,1,2.7),
});

const FAMILIES308=['tribalwear','shirt','pants','duster','parka'] as const;
const FAMILY_LABELS308={tribalwear:'Tenue tribale',shirt:'Chemise',pants:'Pantalon',duster:'Cache-poussière',parka:'Parka',tuque:'Tuque'} as const;
export type TextileApparelItem308=`${TextileMaterial308}-${typeof FAMILIES308[number]}`|`${FabricTextile308}-tuque`;
export const TEXTILE_APPAREL_ITEMS308:readonly TextileApparelItem308[]=Object.freeze([
  ...TEXTILE_MATERIALS308.flatMap(material=>FAMILIES308.map(family=>`${material}-${family}` as TextileApparelItem308)),
  ...FABRIC_TEXTILES308.map(material=>`${material}-tuque` as TextileApparelItem308),
]);
export const isTextileApparelItem308=(value:unknown):value is TextileApparelItem308=>typeof value==='string'&&(TEXTILE_APPAREL_ITEMS308 as readonly string[]).includes(value);
type GarmentItemDefinition308={readonly label:string;readonly kind:'apparel';readonly stackLimit:1;readonly nutrition:0;readonly maxIngest:0;readonly color:number};
export const TEXTILE_APPAREL_ITEM_DEFINITIONS308=Object.freeze(Object.fromEntries(TEXTILE_APPAREL_ITEMS308.map(item=>{
  const family=item.slice(item.lastIndexOf('-')+1) as keyof typeof FAMILY_LABELS308,material=item.slice(0,item.lastIndexOf('-')) as TextileMaterial308;
  return [item,Object.freeze({label:`${FAMILY_LABELS308[family]} en ${TEXTILE_MATERIAL_FACTS308[material].label}`,kind:'apparel' as const,stackLimit:1 as const,nutrition:0 as const,maxIngest:0 as const,color:TEXTILE_MATERIAL_FACTS308[material].color})];
}))) as Readonly<Record<TextileApparelItem308,GarmentItemDefinition308>>;
