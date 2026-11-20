import type { World } from './types.ts';

/** Schema 355: Core RimWorld 1.6 carpets and the CarpetMaking research.
 *
 * TerrainTemplateDef Carpet (TerrainDefs/Terrain_Floors.xml), expanded by
 * TerrainDefGenerator_Carpet into one TerrainDef per ColorDef of colorType
 * Structure (ColorDefs/ColorDefs.xml, 63 colours, DefDatabase order), named
 * "Carpet" + the colour defName without "Structure_": 7 Cloth per cell,
 * WorkToBuild 800, Beauty 2, Flammability 0.32, CleaningTimeFactor 2, no
 * Cleanliness stat (0), no construction skill, research CarpetMaking, Floors
 * category through the Floor_Carpet dropdown, burnedDef BurnedCarpet
 * (Terrain_Floors_Burned.xml: BurnedFloorBase, Beauty -6, pathCost 1).
 *
 * ResearchProjectDef CarpetMaking (ResearchProjects_1.xml): 800 points,
 * Medieval, no prerequisite and no research building. */
export const CARPET_SCHEMA_355=355 as const;
export const isCarpetSchema355=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=CARPET_SCHEMA_355;

export const CARPET_COLOR_IDS_355=Object.freeze(['red','red-subtle','auburn','scarlet','burgundy','plum','dark-mauve','magenta','magenta-subtle',
  'purple','purple-subtle','purple-muted','purple-deep','grape','indigo','indigo-light','blue','blue-subtle','blue-ice','marine','blue-sky','dusk',
  'moss','moss-bright','teal','green','sage','green-faded','green-forest','green-pine','green-swamp','green-muddy','green-marsh','viridian','viridian-subtle',
  'olive','olive-dark','mustard','lime-pale','brown-faded','brown-subtle','brown-light','brown-dark','brown-dirt','umber-burnt','brown-wood','orange',
  'red-pastel','pink','blue-pastel','green-pastel','yellow-pastel','orange-pastel','white','cream','gray-light','limestone','marble','sandstone','granite',
  'grey-dark','slate','black'] as const);
export type CarpetColor355=typeof CARPET_COLOR_IDS_355[number];
export type CarpetFloor355=`carpet-${CarpetColor355}`;
export interface CarpetColorFacts355 {readonly id:CarpetColor355;readonly core:string;readonly label:string;readonly rgb:readonly [number,number,number];readonly color:number}
const facts=(id:CarpetColor355,core:string,label:string,r:number,g:number,b:number):CarpetColorFacts355=>Object.freeze({id,core,label,rgb:Object.freeze([r,g,b] as const),color:(r<<16)|(g<<8)|b});
/** Core ColorDef label, colour and order; French label written for Elsewhere. */
export const CARPET_COLORS_355:Readonly<Record<CarpetColor355,CarpetColorFacts355>>=Object.freeze({
  red:facts('red','Red','rouge',118,49,57),'red-subtle':facts('red-subtle','RedSubtle','rouge discret',132,84,72),
  auburn:facts('auburn','Auburn','auburn',138,51,36),scarlet:facts('scarlet','Scarlet','écarlate',163,41,42),
  burgundy:facts('burgundy','Burgundy','bordeaux',91,41,45),plum:facts('plum','Plum','prune',90,38,60),
  'dark-mauve':facts('dark-mauve','DarkMauve','mauve foncé',131,78,101),magenta:facts('magenta','Magenta','magenta',119,50,80),
  'magenta-subtle':facts('magenta-subtle','MagentaSubtle','magenta discret',101,67,82),purple:facts('purple','Purple','violet',99,50,119),
  'purple-subtle':facts('purple-subtle','PurpleSubtle','violet discret',90,72,97),'purple-muted':facts('purple-muted','PurpleMuted','violet sourd',116,78,131),
  'purple-deep':facts('purple-deep','PurpleDeep','violet profond',75,38,90),grape:facts('grape','Grape','raisin',108,52,97),
  indigo:facts('indigo','Indigo','indigo',125,73,125),'indigo-light':facts('indigo-light','IndigoLight','indigo clair',144,86,139),
  blue:facts('blue','Blue','bleu',24,65,121),'blue-subtle':facts('blue-subtle','BlueSubtle','bleu discret',67,81,101),
  'blue-ice':facts('blue-ice','BlueIce','bleu glacier',140,148,174),marine:facts('marine','Marine','bleu marine',38,59,90),
  'blue-sky':facts('blue-sky','BlueSky','bleu ciel',95,133,191),dusk:facts('dusk','Dusk','crépuscule',78,100,131),
  moss:facts('moss','Moss','mousse',38,89,90),'moss-bright':facts('moss-bright','MossBright','mousse vive',78,130,131),
  teal:facts('teal','Teal','sarcelle',50,118,119),green:facts('green','Green','vert',89,105,62),
  sage:facts('sage','Sage','sauge',74,110,80),'green-faded':facts('green-faded','GreenFaded','vert passé',86,93,76),
  'green-forest':facts('green-forest','GreenForest','vert forêt',78,131,105),'green-pine':facts('green-pine','GreenPine','vert pin',38,90,64),
  'green-swamp':facts('green-swamp','GreenSwamp','vert marécage',112,131,78),'green-muddy':facts('green-muddy','GreenMuddy','vert boueux',96,97,72),
  'green-marsh':facts('green-marsh','GreenMarsh','vert des marais',130,131,78),viridian:facts('viridian','Viridian','viridien',50,119,84),
  'viridian-subtle':facts('viridian-subtle','ViridianSubtle','viridien discret',74,94,84),olive:facts('olive','Olive','olive',118,119,50),
  'olive-dark':facts('olive-dark','OliveDark','olive foncé',69,88,36),mustard:facts('mustard','Mustard','moutarde',163,131,49),
  'lime-pale':facts('lime-pale','LimePale','citron vert pâle',166,166,90),'brown-faded':facts('brown-faded','BrownFaded','brun passé',86,76,57),
  'brown-subtle':facts('brown-subtle','BrownSubtle','brun discret',101,88,67),'brown-light':facts('brown-light','BrownLight','brun clair',131,110,78),
  'brown-dark':facts('brown-dark','BrownDark','brun foncé',90,69,38),'brown-dirt':facts('brown-dirt','BrownDirt','brun terre',119,91,50),
  'umber-burnt':facts('umber-burnt','UmberBurnt','terre d’ombre brûlée',90,58,32),'brown-wood':facts('brown-wood','BrownWood','brun bois',108,78,55),
  orange:facts('orange','Orange','orange',167,96,39),'red-pastel':facts('red-pastel','RedPastel','rouge pastel',201,112,112),
  pink:facts('pink','Pink','rose pastel',241,192,218),'blue-pastel':facts('blue-pastel','BluePastel','bleu pastel',126,164,204),
  'green-pastel':facts('green-pastel','GreenPastel','vert pastel',161,213,180),'yellow-pastel':facts('yellow-pastel','YellowPastel','jaune pastel',204,204,100),
  'orange-pastel':facts('orange-pastel','OrangePastel','orange pastel',191,137,33),white:facts('white','White','blanc',184,184,184),
  cream:facts('cream','Cream','crème',195,192,176),'gray-light':facts('gray-light','GrayLight','gris clair',166,166,166),
  limestone:facts('limestone','Limestone','calcaire',158,153,135),marble:facts('marble','Marble','marbre',132,135,132),
  sandstone:facts('sandstone','Sandstone','grès',126,104,94),granite:facts('granite','Granite','granite',105,95,97),
  'grey-dark':facts('grey-dark','GreyDark','gris foncé',81,81,81),slate:facts('slate','Slate','ardoise',70,70,70),
  black:facts('black','Black','noir',60,60,60),
});
export const CARPET_FLOORS_355=Object.freeze(CARPET_COLOR_IDS_355.map(id=>`carpet-${id}` as const));
const CARPETS=new Set<string>(CARPET_FLOORS_355);
export const isCarpetFloor355=(v:unknown):v is CarpetFloor355=>typeof v==='string'&&CARPETS.has(v);
export const carpetColor355=(floor:CarpetFloor355):CarpetColorFacts355=>CARPET_COLORS_355[floor.slice(7) as CarpetColor355];
/** Core "carpet ({0})" with the French colour. */
export const carpetLabel355=(floor:CarpetFloor355):string=>`Tapis (${carpetColor355(floor).label})`;
export const CARPET_FACTS_355=Object.freeze({cloth:7,coreWork:800,beauty:2,flammability:.32,cleaningTime:2,cleanliness:0,skill:0} as const);
export const BURNED_CARPET_FACTS_355=Object.freeze({beauty:-6,pathCost:1} as const);

export const CARPET_RESEARCH_SCALE_355=1_000_000;
/** Core CarpetMaking: 800 points, Medieval, no prerequisite, any research bench. */
export const CARPET_RESEARCH_355=Object.freeze({project:'carpet-making',recordKey:'carpetMaking',label:'Fabrication de tapis',points:800,scaledCost:800*CARPET_RESEARCH_SCALE_355,techLevel:'Medieval'} as const);
export type CarpetResearch355=typeof CARPET_RESEARCH_355.project;
export const isCarpetResearch355=(v:unknown):v is CarpetResearch355=>v==='carpet-making';
export const carpetMakingUnlocked355=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isCarpetSchema355(w.schemaVersion)&&w.research?.carpetMaking?.completedAt!==undefined;
