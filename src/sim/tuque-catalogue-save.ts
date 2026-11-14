import {GARMENT_ITEMS312} from './apparel-definitions.ts';
/** Tuques are prospective in V384: old saves cannot hide a new item, recipe,
 * permission or ledger in either map, an archive or a transfer container. */
const TUQUE_ITEMS=new Set(['cloth-tuque','muffalo-wool-tuque','unfinished-tuque']);
/** Schema 312 T-shirts and jackets follow the same rule before 312. */
const GARMENTS_312=new Set<string>([...GARMENT_ITEMS312,'unfinished-tshirt','unfinished-jacket']);
/** Schema 322 pump shotgun: item, recipe, projectiles and stances. */
function validShotgun322(value:unknown):boolean {
  const visit=(v:unknown):boolean=>{
    if(Array.isArray(v))return v.every(visit);
    if(!v||typeof v!=='object')return true;
    for(const [key,child] of Object.entries(v)){
      if((key==='item'||key==='weaponItem')&&child==='pump-shotgun'||key==='recipe'&&child==='make-pump-shotgun')return false;
      if(key==='allowedItems'&&Array.isArray(child)&&child.includes('pump-shotgun'))return false;
      if(['items','filters','bought','sold'].includes(key)&&child&&typeof child==='object'&&Object.hasOwn(child,'pump-shotgun'))return false;
      if(!visit(child))return false;
    }
    return true;
  };
  return visit(value);
}
/** Schema 326 recurve bow and greatbow: items, recipes, arrows in flight and
 * bow stances (their workpiece is the schema 316 unfinished bow). */
function validBows326(value:unknown):boolean {
  const bow=(v:unknown)=>v==='recurve-bow'||v==='greatbow',recipe=(v:unknown)=>v==='make-recurve-bow'||v==='make-greatbow';
  const visit=(v:unknown):boolean=>{
    if(Array.isArray(v))return v.every(visit);
    if(!v||typeof v!=='object')return true;
    for(const [key,child] of Object.entries(v)){
      if((key==='item'||key==='weaponItem')&&bow(child)||key==='recipe'&&recipe(child))return false;
      if(key==='allowedItems'&&Array.isArray(child)&&child.some(bow))return false;
      if(['items','filters','bought','sold'].includes(key)&&child&&typeof child==='object'&&(Object.hasOwn(child,'recurve-bow')||Object.hasOwn(child,'greatbow')))return false;
      if(!visit(child))return false;
    }
    return true;
  };
  return visit(value);
}
/** Schema 316 short bow: item, workpiece, recipe and its projectiles/stances. */
const BOW_316=new Set<string>(['short-bow','unfinished-bow']);
export function validTuqueCatalogueTransport(value:unknown,version:number):boolean {
  if(version>=326)return true;
  if(!validBows326(value))return false;
  if(version>=322)return true;
  if(version>=316)return validShotgun322(value);
  const tuque=version<245,garments=version<312,blocked=(item:string)=>tuque&&TUQUE_ITEMS.has(item)||garments&&GARMENTS_312.has(item)||BOW_316.has(item)||item==='pump-shotgun',
    recipe=(r:unknown)=>tuque&&r==='tuque'||garments&&(r==='tshirt'||r==='jacket')||r==='make-short-bow'||r==='make-pump-shotgun';
  const visit=(v:unknown):boolean=>{
    if(Array.isArray(v))return v.every(visit);
    if(!v||typeof v!=='object')return true;
    for(const [key,child] of Object.entries(v)){
      if((key==='item'||key==='weaponItem')&&typeof child==='string'&&blocked(child))return false;
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
const TUQUE_DOMAINS=['piles','pawns','structures','jobs','packed','stockpiles','apparelPolicies','projectiles',
  'group','groupLosses','commercialTrip','civilianPost','visitors','raids','trade','orbital',
  'prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','destroyed','deconstructed'] as const;
export function validTuqueCatalogueDomains(value:unknown,version:number):boolean {
  if(version>=326||!value||typeof value!=='object'||Array.isArray(value))return true;
  const world=value as Record<string,unknown>;
  return TUQUE_DOMAINS.every(key=>validTuqueCatalogueTransport(world[key],version));
}
