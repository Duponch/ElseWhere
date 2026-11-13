import {GARMENT_ITEMS312} from './apparel-definitions.ts';
/** Tuques are prospective in V384: old saves cannot hide a new item, recipe,
 * permission or ledger in either map, an archive or a transfer container. */
const TUQUE_ITEMS=new Set(['cloth-tuque','muffalo-wool-tuque','unfinished-tuque']);
/** Schema 312 T-shirts and jackets follow the same rule before 312. */
const GARMENTS_312=new Set<string>([...GARMENT_ITEMS312,'unfinished-tshirt','unfinished-jacket']);
export function validTuqueCatalogueTransport(value:unknown,version:number):boolean {
  if(version>=312)return true;
  const tuque=version<245,blocked=(item:string)=>tuque&&TUQUE_ITEMS.has(item)||GARMENTS_312.has(item),recipe=(r:unknown)=>tuque&&r==='tuque'||r==='tshirt'||r==='jacket';
  const visit=(v:unknown):boolean=>{
    if(Array.isArray(v))return v.every(visit);
    if(!v||typeof v!=='object')return true;
    for(const [key,child] of Object.entries(v)){
      if(key==='item'&&typeof child==='string'&&blocked(child))return false;
      if(key==='recipe'&&recipe(child))return false;
      if(key==='allowedItems'&&Array.isArray(child)&&child.some(i=>blocked(String(i))))return false;
      if(['items','filters','bought','sold'].includes(key)&&child&&typeof child==='object'&&Object.keys(child).some(i=>blocked(i)))return false;
      if(!visit(child))return false;
    }
    return true;
  };
  return visit(value);
}

/** Existing validation passes revisit only domains that can own items,
 * reservations, recipes or permissions. No terrain/resource/grid traversal;
 * validateCampaignSchema forwards the same check to the secondary local map. */
const TUQUE_DOMAINS=['piles','pawns','structures','jobs','packed','stockpiles','apparelPolicies',
  'group','groupLosses','commercialTrip','civilianPost','visitors','raids','trade','orbital',
  'prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','destroyed','deconstructed'] as const;
export function validTuqueCatalogueDomains(value:unknown,version:number):boolean {
  if(version>=312||!value||typeof value!=='object'||Array.isArray(value))return true;
  const world=value as Record<string,unknown>;
  return TUQUE_DOMAINS.every(key=>validTuqueCatalogueTransport(world[key],version));
}
