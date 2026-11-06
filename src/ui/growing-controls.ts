import type { Command, GrowingZone,World } from '../sim/types';
import { CROP_KINDS, type CropKind } from '../sim/crops';
import {FLORA_DEFINITIONS} from '../sim/biome-flora';
import {forestNativeSpecies291,forestSowingChoices291,growingPlantLabel291,isForestrySpecies291,treeSowingUnlocked291,type GrowingPlant291} from '../sim/forestry-content-291';
import {isSchema291OrLater} from '../sim/schema-compatibility-257.ts';

const CULTURE_HELP:Record<CropKind,string>={
  hops:'Culture 3 pour semer ; sol et hydroponie. Un plant mûr peut donner 8 houblons. Cinq jours de croissance pondérée et sensibilité à la fertilité de 70 % ; la lumière, le froid et la nuit modifient la durée réelle. Le houblon se conserve 30 jours à température ambiante. La recherche Brassage de bière débloque la brasserie et le tonneau, sans conditionner le semis du houblon.',
  haygrass:'Le foin mûr donne jusqu’à 18 unités. Sept jours de croissance pondérée, sensibilité à la fertilité de 60 %. Sol uniquement, sans hydroponie. Semis 17 ticks et récolte 20 ticks nominaux ; la durée et le rendement dépendent du récolteur et du milieu. Le foin nourrit les herbivores et entre dans les croquettes, mais ne se mange pas par les humains. Conservation : 60 jours à température ambiante.',
  rice:'Le riz mûr donne 6 unités. Cycle court, sensible à la fertilité : utile pour les premières récoltes.',
  potato:'Un plant mûr donne 11 pommes de terre. Cycle intermédiaire, moins pénalisé par le gravier ; le gain en terre riche est aussi plus faible. Conservation : 30 jours à température ambiante.',
  corn:'Un plant mûr donne 22 unités de maïs. Cycle long et sensible à la fertilité : prévoyez de quoi manger avant la récolte. Conservation : 60 jours à température ambiante.',
  cotton:'Le coton mûr donne 10 tissus. Cycle plus long que le riz ; le tissu sert à confectionner une tenue tribale, puis une chemise après recherche.',
  healroot:'Plantes 8 requis pour commencer le semis seulement ; récolte et dégagement restent accessibles sans ce minimum. Une racine mûre intacte peut donner une dose de médicament à base de plantes, selon le récolteur. Sept jours de croissance nominale, modulés par sol, lumière, température et repos. Travail de base : semis 80 ticks, récolte 40 ticks ; la durée réelle dépend du colon et du milieu. La coupe de dégagement ne donne aucune dose.',
};

export const growingCultureHelp=(kind:GrowingPlant291,_world?:World):string=>{
  if(!isForestrySpecies291(kind))return CULTURE_HELP[kind];
  const def=FLORA_DEFINITIONS[kind];
  return `Culture 6 pour commencer le semis ; recherche Semis d’arbres et essence indigène du biome. Sol sans toit, hors hydroponie. Travail nominal de semis : 400 ticks, modulé par le colon. ${def.growDays} jours de croissance pondérée ; la nuit, le sol et le climat modifient la durée réelle. À maturité, jusqu’à ${def.yield} bois avant effets du récolteur. Les huit cases voisines imposent l’espacement ; les plantes encore voulues par leur propre zone sont conservées. La coupe automatique attend la maturité, puis le semis peut recommencer. Le plant apparaît à la finition du semis, comme les autres cultures locales.`;
};
export const growingCultureChoices=(zone:Pick<GrowingZone,'basinId'>,world?:World):readonly GrowingPlant291[]=>
  zone.basinId===undefined?[...CROP_KINDS,...(world?forestSowingChoices291(world):[])]:CROP_KINDS.filter(kind=>kind!=='corn'&&kind!=='haygrass');

export function growingControls(zone: GrowingZone, send: (command: Command) => void,world?:World): HTMLElement {
  const panel = document.createElement('div'); panel.className = 'storage-settings';
  const heading = document.createElement('p'); heading.textContent = `${zone.basinId===undefined?'Zone de culture':'Bac hydroponique'} · ${growingPlantLabel291(zone.plant)} · ${zone.cells.length} cases`;
  panel.append(heading);
  const choice=document.createElement('label'),plant=document.createElement('select');plant.id='growing-plant';
  for(const kind of growingCultureChoices(zone,world)){const option=document.createElement('option');option.value=kind;option.textContent=growingPlantLabel291(kind);plant.append(option);}
  plant.value=zone.plant;choice.append('Culture ',plant);panel.append(choice);
  const help=document.createElement('p');help.className='muted';
  const updateHelp=()=>{help.textContent=growingCultureHelp(plant.value as GrowingPlant291,world);};
  updateHelp();plant.addEventListener('change',updateHelp);
  panel.append(help);
  if(zone.basinId===undefined&&world&&isSchema291OrLater(world.schemaVersion)){
    const forest=document.createElement('p');forest.className='muted';
    const native=forestNativeSpecies291(world);
    forest.textContent=!native.length?'Aucune essence à semer parmi les arbres livrés de ce biome.':treeSowingUnlocked291(world)?'Essences indigènes disponibles. Le choix de la zone ne remplace ni la compétence du cultivateur ni son trajet.':'Pour semer les arbres indigènes, recherchez Semis d’arbres (1 000 points). Culture 6 sera requise pour commencer le travail.';
    panel.append(forest);
  }
  if(zone.basinId!==undefined) {
    const care=document.createElement('p');care.className='muted';
    care.textContent='Fertilité 280 % · 70 W en continu, même la nuit. Sans alimentation : nouveaux semis suspendus et plantes qui dépérissent. Prévoir une lumière horticole sous toit et une température adaptée. Retirer le bac détruit ses plantes.';
    panel.append(care);
  }
  const controls = new Map<string, HTMLInputElement>();
  for (const [field, title] of [['allowSow', 'Autoriser les semis'], ['allowCut', 'Couper les plantes indésirables']] as const) {
    const label = document.createElement('label'), checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = zone[field]; checkbox.id = `growing-${field}`;
    controls.set(field, checkbox); label.append(checkbox, title); panel.append(label);
  }
  const commit=()=>send({type:'growing-policy',zoneId:zone.id,plant:plant.value as GrowingZone['plant'],allowSow:controls.get('allowSow')!.checked,allowCut:controls.get('allowCut')!.checked});
  plant.addEventListener('change',commit);
  for(const input of controls.values())input.addEventListener('change',commit);
  return panel;
}
