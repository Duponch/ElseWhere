import {PALETTE} from './prototype-art';
import {drawPicto,drawPictoInBox,pictoSemanticId} from '../ui/picto-artwork';

type OriginalIcon='architecte'|'travail'|'planning'|'assignations'|'animaux'|'faune'|'recherches'|'quetes'|'monde'|'historique'|'factions'|'menu'|'ordres'|'zones';
export type NativeActionIconKind=OriginalIcon|'wall'|'floor'|'floor-remove'|'bridge'|'bridge-remove'|'chair'|'bed'|'medical-bed'|'animal-bed'|'table'|'shelf'|'door'|'fence'|'flag'|'grave'|'thermometer'|'flame'|'lamp'|'horseshoe'|'chess'|'television'|'workbench'|'anvil'|'sword'|'gun'|'shield'|'shirt'|'power'|'wire'|'battery'|'solar'|'wind'|'rocket'|'reactor'|'casket'|'computer'|'sensors'|'mine'|'haul'|'axe'|'harvest'|'scissors'|'uninstall'|'deconstruct'|'cancel'|'growing'|'growing-remove'|'stockpile'|'stockpile-remove'|'roof'|'roof-remove'|'roof-ignore'|'home'|'home-remove'|'snow'|'snow-remove'|'pot'|'food'|'barrel'|'drop'|'drill'|'radar'|'chip'|'cross'|'limb'|'paint'|'foam'|'play'|'pause'|'save'|'load'|'export'|'copy'|'paste'|'back'|'rotate-left'|'rotate-right'|'information'|'plus'|'minus'|'check'|'fallback';

// Semantic IDs belong to the catalogue, never to text translated for display.
// Every delivered tool/project has an explicit entry or a floor-material rule.
const families:Readonly<Record<string,NativeActionIconKind>>={
  architecte:'architecte',architect:'architecte',travail:'travail',work:'travail',planning:'planning',schedule:'planning',assignations:'assignations',assign:'assignations',animaux:'animaux',animals:'animaux',faune:'faune',wildlife:'faune',recherches:'recherches',research:'recherches',quetes:'quetes',quests:'quetes',monde:'monde',world:'monde',historique:'historique',history:'historique',factions:'factions',menu:'menu',ordres:'ordres',orders:'ordres',zones:'zones',
  structure:'wall',floors:'floor',furniture:'chair',temperature:'thermometer',recreation:'horseshoe',production:'workbench',power:'power',ship:'rocket',
  allow:'check',forbid:'cancel',
  select:'information',mine:'mine','haul-chunks':'haul',haul:'haul',chop:'axe',harvest:'harvest',cut:'scissors',uninstall:'uninstall',deconstruct:'deconstruct',cancel:'cancel',
  wall:'wall',door:'door',autodoor:'door','mini-turret':'gun',sandbags:'wall',fence:'fence','fence-gate':'fence','pen-marker':'flag','spike-trap':'sword','firefoam-popper':'foam',
  'build-bridge':'bridge','remove-bridge':'bridge-remove','smooth-floor':'floor','remove-floor':'floor-remove','wood-planks':'floor',
  'animal-sleeping-spot':'animal-bed','sleeping-spot':'bed',bedroll:'bed',bed:'bed','double-bed':'bed','hospital-bed':'medical-bed','vitals-monitor':'cross',
  table:'table','table-square':'table','table-long':'table','dining-chair':'chair',armchair:'chair','end-table':'table',dresser:'shelf',shelf:'shelf','small-shelf':'shelf',stool:'chair',grave:'grave','flower-pot':'growing',
  horseshoes:'horseshoe','chess-table':'chess','tube-television':'television','torch-lamp':'flame',vent:'thermometer',heater:'thermometer',cooler:'thermometer','passive-cooler':'thermometer',campfire:'flame','standing-lamp':'lamp','sun-lamp':'lamp',
  'wind-turbine':'wind','wood-generator':'power','chemfuel-generator':'power','power-conduit':'wire','power-switch':'wire',battery:'battery','geothermal-generator':'power','solar-generator':'solar',
  'hydroponics-basin':'growing','deep-drill':'drill','ground-scanner':'radar','orbital-beacon':'radar','comms-console':'television','nutrient-paste-dispenser':'pot',hopper:'stockpile','research-bench':'recherches','hi-tech-research-bench':'recherches','multi-analyzer':'radar',
  'tailor-bench':'shirt','electric-tailor-bench':'shirt','drug-lab':'recherches','electric-crematorium':'flame','electric-smelter':'flame','fueled-smithy':'anvil','electric-smithy':'anvil',brewery:'barrel','fermenting-barrel':'barrel','biofuel-refinery':'drop','art-bench':'paint','machining-table':'workbench','fabrication-bench':'chip','crafting-spot':'workbench','fueled-stove':'pot','electric-stove':'pot','butcher-table':'food','butcher-spot':'food',stonecutter:'mine',
  growing:'growing','remove-growing':'growing-remove',stockpile:'stockpile','remove-stockpile':'stockpile-remove','build-roof':'roof','remove-roof':'roof-remove','ignore-roof':'roof-ignore','snow-clear':'snow','remove-snow-clear':'snow-remove',home:'home','remove-home':'home-remove',
  'ai-core':'chip','ship-computer':'computer','ship-sensors':'sensors','long-range-mineral-scanner':'radar',
  'ship-cryptosleep-casket':'casket','ship-beam':'rocket','ship-reactor':'reactor','ship-engine':'rocket',
  'recurve-bow':'gun',greatbow:'gun',
  'tree-sowing':'faune',firefoam:'foam','ship-cryptosleep':'casket','ship-basics':'rocket',prosthetics:'limb',cryptosleep:'casket','long-blades':'sword',brewing:'barrel','geothermal-power':'power','biofuel-refining':'drop','nutrient-paste':'pot','deep-drilling':'drill','sterile-materials':'floor','drug-production':'recherches','medicine-production':'cross',hydroponics:'growing','gun-turrets':'gun','complex-furniture':'chair',stonecutting:'mine',smithing:'anvil',machining:'workbench',gunsmithing:'gun','complex-clothing':'shirt',pemmican:'food','packaged-survival-meals':'food',autodoors:'door','plate-armor':'shield','flak-armor':'shield',batteries:'battery','solar-power':'solar','air-conditioning':'thermometer',microelectronics:'chip',fabrication:'workbench','advanced-fabrication':'chip','recon-armor':'shield',
  'cryptosleep-casket':'casket',
  settings:'travail',options:'travail',save:'save',load:'load',export:'export',resume:'play',start:'play',pause:'pause',close:'cancel',back:'back',copy:'copy',paste:'paste',delete:'cancel',remove:'cancel',plus:'plus',minus:'minus',check:'check',information:'information',info:'information',
  'rotate-left':'rotate-left','rotate-right':'rotate-right','clear-orders':'cancel','manage-work':'travail','toggle-draft':'shield',mobilize:'shield','target-shot':'ordres','target-melee':'sword','fire-at-will':'gun',
};
function semanticId(id:string):string {
  let result=id;
  if(result.startsWith('tool-'))result=result.slice(5).replace(/-select$/,'');
  else if(result.startsWith('category-'))result=result.slice(9);
  else if(result.startsWith('map-dock:'))result=result.slice(9);
  else if(result.startsWith('tab:'))result=result.slice(4);
  else if(result.startsWith('menu-'))result=result.slice(5);
  else if(result.startsWith('page:'))result=result.slice(5);
  else if(result.startsWith('research-node-'))result=result.slice(14);
  else if(result.startsWith('research-'))result=result.slice(9).replace(/-select$/,'');
  return result;
}
export function nativeActionIconKind(id:string):NativeActionIconKind {
  const exact=Object.hasOwn(families,id)?families[id]:undefined;if(exact)return exact;
  const key=semanticId(id),known=Object.hasOwn(families,key)?families[key]:undefined;
  if(known)return known;
  if(key.endsWith('-tile')||key.endsWith('-flagstone'))return 'floor';
  return 'fallback';
}

/** Paint only at the existing owner's texture update; no image loading or GPU allocation. */
export function drawNativeActionIcon(ctx:CanvasRenderingContext2D,id:string,cx:number,cy:number,r:number,ink='#261e18',_accent='#f4ecda'):void {
  if(!Number.isFinite(cx+cy+r)||r<=0)return;
  const semantic=pictoSemanticId(id);
  if(semantic==='forbid')ink=PALETTE.terracotta;else if(semantic==='allow')ink=PALETTE.pineDark;
  if(drawPicto(ctx,semantic,cx,cy,r,ink))return;
  const kind=nativeActionIconKind(id);
  if(!drawPicto(ctx,kind,cx,cy,r,ink))drawPicto(ctx,'information',cx,cy,r,ink);
}

export function drawNativeActionIconInBox(ctx:CanvasRenderingContext2D,id:string,x:number,y:number,width:number,height:number,ink='#261e18'):void {
 const semantic=pictoSemanticId(id);
 if(semantic==='forbid')ink=PALETTE.terracotta;else if(semantic==='allow')ink=PALETTE.pineDark;
 if(drawPictoInBox(ctx,semantic,x,y,width,height,ink))return;
 if(!drawPictoInBox(ctx,nativeActionIconKind(id),x,y,width,height,ink))drawPictoInBox(ctx,'information',x,y,width,height,ink);
}
