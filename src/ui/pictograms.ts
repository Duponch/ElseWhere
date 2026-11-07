import {pictoSvg,pictoDataUrl,pictoArtwork} from './picto-artwork';
/** Public semantic IDs retain the original tool/cursor contract. */
export const PICTOGRAM_IDS=Object.freeze(['smooth-floor','build-bridge','remove-bridge','passion','pointer','mine','chop','harvest','slaughter','extract','cut','haul-chunks','uninstall','deconstruct','allow','forbid','cancel','home','clock','people','research','leaf','eye','layers','animals','wildlife','world','quests','history','factions','menu','build-roof','remove-roof','ignore-roof','growing','stockpile','remove-floor','snow-clear','remove-snow-clear','extract-tree','replant-tree','replant','select','work','schedule','assign','remove-growing','remove-stockpile','remove-home']);
export function pictogramSvg(id:string):string {const svg=pictoSvg(id);if(!svg)throw Error(`Missing pictogram: ${id}`);return svg;}
export function pictogramDataUrl(id:string):string {const url=pictoDataUrl(id);if(!url)throw Error(`Missing pictogram: ${id}`);return url;}
export const UI_ATLAS_URL='/assets/ui/elsewhere/v304/ui.svg';
export function modelIconUrl(id:string):string {
  if(pictoArtwork(id))return `/assets/ui/elsewhere/pictograms-20261107/${encodeURIComponent(id)}.svg`;
  return `/assets/ui/elsewhere/v304/${encodeURIComponent(id)}.svg`;
}
