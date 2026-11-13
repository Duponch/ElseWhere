import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {APPAREL_MATERIALS,apparelItemFor} from './apparel-rules.ts';
import {FABRIC_TEXTILES308} from './textile-apparel-308.ts';
import {smithingMaterials267,smithingProduct267} from './smithing-content-267.ts';
import {BIOFUEL_ORGANIC_INPUTS,type ProductionRecipe} from './production-recipes.ts';
import type {ResearchState} from './research.ts';

/** Core1.6.4871 rev590, assembly SHA256 5cf1b5be399d5b1c9c56ca72c9d35b4ecf307feacf5859d04ac5a1aa5926356a.
 * Numeric facts/bindings only. XML inheritance and StatWorker_MarketValue were
 * read directly; no proprietary code, descriptions or assets are reproduced.
 * BaseMarketValue has NO Stuff: costStuff uses the native abstract guess2.
 * Recipe work separately uses GenStuff.DefaultStuffFor (steel/cloth here).
 * These are never the trade price or the delivered variant's market value.
 * Foods incl beer/kibble, silver, low density resources, sculptures, corpses,
 * unfinished goods and minified wrappers are deliberately outside this pool. */
const RAW_FAMILIES_284=[
 'cloth','hay','hops','herbal-medicine','medicine','glitterworld-medicine','component','advanced-component','chemfuel','neutroamine',
 'gold','plasteel','uranium','jade','light-leather','plainleather','bluefur','camelhide','foxfur',
 'dog-leather','bear-leather','bird-leather','chinchilla-fur','elephant-leather','guinea-pig-fur','heavy-fur','lizard-leather','panthera-fur','pig-leather','rhinoceros-leather','wolf-leather',
 'muffalo-wool','alpaca-wool','bison-wool','megasloth-wool',
] as const satisfies readonly ItemId[];
type RawFamily284=typeof RAW_FAMILIES_284[number];
export type TradeRequestFamily284=RawFamily284|'shirt'|'tribalwear'|'pants'|'duster'|'parka'|'tuque'
 |'knife'|'mace'|'longsword'|'spear'|'plate-armor'|'simple-helmet'
 |'revolver'|'bolt-action-rifle'|'emp-launcher'|'flak-vest'|'flak-helmet'|'flak-pants'|'recon-helmet'|'recon-armor'|'prosthetic-arm'|'prosthetic-leg';
export interface TradeRequestRecipe284 {
 readonly recipe:ProductionRecipe;
 readonly workCore:number;
 readonly outputUnits:number;
 /** One present non-fogged map Thing per native quota; not its full quantity. */
 readonly ingredientGroups:readonly (readonly ItemId[])[];
 readonly research:readonly Exclude<keyof ResearchState,'points'|'project'>[];
}
export interface TradeRequestContent284 {
 readonly family:TradeRequestFamily284;
 readonly label:string;
 readonly items:readonly ItemId[];
 readonly baseMarketValue:number;
 readonly baseMass:number;
 readonly recipes:readonly TradeRequestRecipe284[];
}
const recipe=(id:ProductionRecipe,workCore:number,ingredientGroups:readonly (readonly ItemId[])[],research:TradeRequestRecipe284['research']=[],outputUnits=1):TradeRequestRecipe284=>
 Object.freeze({recipe:id,workCore,outputUnits,ingredientGroups:Object.freeze(ingredientGroups.map(g=>Object.freeze([...g]))),research:Object.freeze([...research])});
const entry=(family:TradeRequestFamily284,items:readonly ItemId[],value:number,mass:number,recipes:readonly TradeRequestRecipe284[]=[],label:string=ITEM_DEFINITIONS[items[0]!].label):TradeRequestContent284=>
 Object.freeze({family,label,items:Object.freeze([...items]),baseMarketValue:value,baseMass:mass,recipes:Object.freeze([...recipes])});

// ResourceBase/Stuff/Manufactured/RawPlant/Leather XML. Unmakeable stock-only
// families remain bindings; availability must independently prove Makeable.
const RAW_VALUES_284:readonly (readonly [RawFamily284,number,number])[]=[
 ['cloth',1.5,.026],['hay',.6,.014],['hops',1.3,.03],['herbal-medicine',10,.35],['medicine',18,.5],['glitterworld-medicine',50,.5],
 ['component',32,.6],['advanced-component',200,.6],['chemfuel',2.3,.05],['neutroamine',6,.02],['gold',10,.008],['plasteel',9,.25],['uranium',6,1],['jade',5,.5],
 ['light-leather',1.9,.03],['plainleather',2.1,.03],['bluefur',2.3,.03],['camelhide',2.3,.03],['foxfur',3.5,.03],
 ['dog-leather',2,.03],['bear-leather',3.4,.03],['bird-leather',1.8,.03],['chinchilla-fur',6.5,.03],['elephant-leather',3,.03],['guinea-pig-fur',5,.03],['heavy-fur',3.3,.03],['lizard-leather',2.1,.03],['panthera-fur',3,.03],['pig-leather',1.9,.03],['rhinoceros-leather',4.2,.03],['wolf-leather',3,.03],
 ['muffalo-wool',2.7,.028],['alpaca-wool',3.8,.028],['bison-wool',2.7,.028],['megasloth-wool',2.7,.028],
];
const rawRecipes:Partial<Record<RawFamily284,readonly TradeRequestRecipe284[]>>={
 medicine:[recipe('make-medicine',700,[['herbal-medicine'],['neutroamine'],['cloth']],['medicineProduction'])],
 component:[recipe('make-component',5000,[['steel']],['fabrication'])],
 'advanced-component':[recipe('make-advanced-component',10000,[['component'],['steel'],['plasteel'],['gold']],['advancedFabrication'])],
 chemfuel:[recipe('chemfuel-from-wood',2000,[['wood']],['biofuelRefining'],35),recipe('chemfuel-from-organics',2500,[BIOFUEL_ORGANIC_INPUTS],['biofuelRefining'],35)],
};
const textiles=(family:'shirt'|'tribalwear'|'pants'|'duster'|'parka'|'tuque'):readonly ItemId[]=>
 (family==='tuque'?['cloth','muffalo-wool',...FABRIC_TEXTILES308] as const:APPAREL_MATERIALS).map(material=>apparelItemFor(family,material));
const metals=['steel','plasteel','uranium','silver','gold'] as const;
const smith=(id:Parameters<typeof smithingMaterials267>[0])=>smithingMaterials267(id).map(m=>smithingProduct267(id,m));

export const TRADE_REQUEST_CONTENT_284:readonly TradeRequestContent284[]=Object.freeze([
 ...RAW_VALUES_284.map(([id,value,mass])=>entry(id,[id],value,mass,rawRecipes[id])),
 // Apparel_Various/Headgear: default-stuff WORK is cloth or steel; abstract
 // family VALUE instead uses CostStuffCount*2 plus native WorkToMake*.0036.
 entry('shirt',textiles('shirt'),99.72,.3,[recipe('shirt',2700,[APPAREL_MATERIALS],['completedAt'])],'Chemises'),
 entry('tribalwear',textiles('tribalwear'),126.48,.5,[recipe('tribalwear',1800,[APPAREL_MATERIALS])],'Tenues tribales'),
 entry('pants',textiles('pants'),85.76,.5,[recipe('pants',1600,[APPAREL_MATERIALS],['completedAt'])],'Pantalons'),
 entry('duster',textiles('duster'),196,2,[recipe('duster',10000,[APPAREL_MATERIALS],['completedAt'])],'Cache-poussières'),
 entry('parka',textiles('parka'),188.8,2,[recipe('parka',8000,[APPAREL_MATERIALS])],'Parkas'),
 entry('tuque',textiles('tuque'),44.32,.07,[recipe('tuque',1200,[['cloth','muffalo-wool',...FABRIC_TEXTILES308]],['completedAt'])],'Tuques'),
 // Only the represented plasteel knife route is admitted locally. The native
 // family's default-stuff work is steel1800, not plasteel3960.
 entry('knife',['plasteel-knife'],66.48,.5,[recipe('make-plasteel-knife',1800,[['plasteel']])],'Couteaux'),
 entry('mace',smith('make-mace'),121.6,1.25,[recipe('make-mace',6000,[smithingMaterials267('make-mace')],['smithing'])],'Masses'),
 entry('longsword',smith('make-longsword'),264.8,2,[recipe('make-longsword',18000,[smithingMaterials267('make-longsword')],['longBlades'])],'Épées longues'),
 entry('spear',smith('make-spear'),193.2,2,[recipe('make-spear',12000,[smithingMaterials267('make-spear')],['longBlades'])],'Lances'),
 entry('plate-armor',smith('make-plate-armor'),476.8,15,[recipe('make-plate-armor',38000,[smithingMaterials267('make-plate-armor')],['plateArmor'])],'Armures de plaques'),
 entry('simple-helmet',smith('make-simple-helmet'),91.52,2,[recipe('make-simple-helmet',3200,[metals],['smithing'])],'Casques simples'),
 entry('revolver',['revolver'],135.4,1.4,[recipe('make-revolver',4000,[['steel'],['component']],['gunsmithing'])]),
 entry('bolt-action-rifle',['bolt-action-rifle'],253.2,3.5,[recipe('make-bolt-action-rifle',12000,[['steel'],['component']],['gunsmithing'])]),
 entry('emp-launcher',['emp-launcher'],506.5,3.4,[recipe('make-emp-launcher',30000,[['steel'],['component']],['gunsmithing','microelectronics'])]),
 entry('flak-vest',['flak-vest'],223.4,4,[recipe('make-flak-vest',9000,[['cloth'],['steel'],['component']],['flakArmor'])]),
 entry('flak-helmet',['flak-helmet','plasteel-flak-helmet'],262.8,1.2,[recipe('make-flak-helmet',8000,[metals,['component'],['plasteel']],['flakArmor'])]),
 entry('flak-pants',['flak-pants'],223.4,4),
 entry('recon-helmet',['recon-helmet'],526.7,1,[recipe('make-recon-helmet',15750,[['plasteel'],['advanced-component']],['reconArmor'])]),
 entry('recon-armor',['recon-armor'],1542,9,[recipe('make-recon-armor',45000,[['plasteel'],['advanced-component'],['uranium']],['reconArmor'])]),
 entry('prosthetic-arm',['prosthetic-arm'],258,5,[recipe('make-prosthetic-arm',15000,[['steel'],['component']],['prosthetics'])]),
 entry('prosthetic-leg',['prosthetic-leg'],258,8,[recipe('make-prosthetic-leg',15000,[['steel'],['component']],['prosthetics'])]),
]);
const byFamily284=new Map(TRADE_REQUEST_CONTENT_284.map(e=>[e.family,e]));
const byItem284=new Map(TRADE_REQUEST_CONTENT_284.flatMap(e=>e.items.map(item=>[item,e.family] as const)));
export const tradeRequestContent284=(family:unknown):TradeRequestContent284|undefined=>typeof family==='string'?byFamily284.get(family as TradeRequestFamily284):undefined;
export const tradeRequestFamilyForItem284=(item:ItemId):TradeRequestFamily284|undefined=>byItem284.get(item);
