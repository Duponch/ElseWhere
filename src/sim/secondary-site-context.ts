import {registeredCampaign,registeredMap,registeredMapForValidation,registeredMapId,registeredMaps,selectedRegisteredMap,captureLocalMap,flushRegisteredMap,boundWorldGroup} from './world-map-context.ts';
import { CAMPAIGN_FIELDS, type SecondaryMap } from './secondary-site-state.ts';
import type { World } from './types.ts';

const shared=new Set<string>(CAMPAIGN_FIELDS);
const contexts=new WeakMap<World,{map:SecondaryMap;view:World}>();
const authorities=new WeakMap<World,World>();
export const campaignAuthority=(world:World):World=>(registeredCampaign(authorities.get(world)??world) as World);
export const isSecondaryContext=(world:World):boolean=>authorities.has(world)||!!boundWorldGroup(world)||registeredMapId(world)!==undefined&&registeredMapId(world)!==world.worldMaps?.rootMapId;

/** Transfer references to a serializable LOCAL record. Shared accessors never
 * enter the record or its JSON. The discarded generator owns no live people. */
export function captureSecondaryMap(world:World):SecondaryMap {
  if(world.schemaVersion>=255)return captureLocalMap(world) as SecondaryMap;
  const data:Record<string,unknown>={};
  for(const key of Object.keys(world))if(!shared.has(key)&&!['secondarySite','campaignPeople','campaignMap'].includes(key))data[key]=(world as unknown as Record<string,unknown>)[key];
  return data as unknown as SecondaryMap;
}

/** Stable plain-object context, so existing WeakMap caches remain map-local
 * and worker structured cloning can read the same normal World contract.
 * Arrays are original local references. Global fields forward on every read
 * and write; no second RNG, nextId, tick, research or policy registry exists. */
export function secondaryContext(world:World):World|undefined {
  const root=campaignAuthority(world);if(root.worldMaps){const other=root.worldMaps.sites.find(s=>s.id!==root.worldMaps!.rootMapId);return other?registeredMap(root,other.id):undefined;}const site=root.secondarySite;
  if(!site)return undefined;
  let cached=contexts.get(root);
  if(!cached||cached.map!==site.map||Object.hasOwn(cached.view,'phaseCore297')!==Object.hasOwn(root,'phaseCore297')){
    const view={...site.map} as World;
    for(const key of CAMPAIGN_FIELDS)if((key!=='worldPawns'&&key!=='worldFactions'&&key!=='worldSites263'&&key!=='linkedStorage286'&&key!=='phaseCore297'&&key!=='developerTest381')||Object.hasOwn(root,key))Object.defineProperty(view,key,{enumerable:true,configurable:false,
      get:()=>root[key],set:value=>{(root as unknown as Record<string,unknown>)[key]=value;}});
    authorities.set(view,root);cached={map:site.map,view};contexts.set(root,cached);
  }
  return cached.view;
}

/** Existing systems can replace arrays or add/delete optional local fields.
 * Flush at the end of a synchronous command/tick, never after an await. */
export function flushSecondaryContext(world:World):void {
  const root=campaignAuthority(world);if(root.worldMaps){for(const map of registeredMaps(root))flushRegisteredMap(map);return;}const cached=contexts.get(root);
  if(!cached||cached.map!==root.secondarySite?.map)return;
  const data=captureSecondaryMap(cached.view) as unknown as Record<string,unknown>;
  const target=cached.map as unknown as Record<string,unknown>;
  for(const key of Object.keys(target))if(!Object.hasOwn(data,key))delete target[key];
  Object.assign(target,data);
}
export function selectedMap(world:World):World {
  const root=campaignAuthority(world);if(root.worldMaps){const map=selectedRegisteredMap(root);if(!map)throw Error('Aucune carte locale sélectionnée.');return map;}
  return root.secondarySite?.selected?secondaryContext(root)!:root;
}

/** The context has no secondarySite field, preventing recursive save/capture.
 * This helper supplies the OTHER actual map, not a projected pawn union. */
export function otherCampaignMap(world:World):World|undefined {
  const root=campaignAuthority(world);if(root.worldMaps)return registeredMaps(root).find(map=>registeredMapId(map)!==registeredMapId(world));
  return world===root?secondaryContext(root):root;
}

/** Descriptor-safe, read-only validation boundary. Existing guards require
 * plain data rather than runtime forwarding accessors. Physical records and
 * shared values stay original references; branding preserves their map owner
 * and global person knowledge. This view is never stepped or persisted. */
export function secondaryValidationContext(world:World):World|undefined {
  const root=campaignAuthority(world);if(root.worldMaps){const other=root.worldMaps.sites.find(s=>s.id!==registeredMapId(world));return other?registeredMapForValidation(root,other.id):undefined;}const site=root.secondarySite;
  if(!site)return undefined;
  const cached=contexts.get(root);
  let view:World;
  // A running producer may have replaced local fields before its final flush.
  if(cached?.map===site.map)view={...cached.view};
  else{
    // Reading an imported world must not install a runtime view that could
    // retain old fields while a strictly validated migration edits the map.
    view={...site.map} as World;
    for(const key of CAMPAIGN_FIELDS)if((key!=='worldSites263'&&key!=='phaseCore297'&&key!=='developerTest381')||Object.hasOwn(root,key))(view as unknown as Record<string,unknown>)[key]=root[key];
  }
  authorities.set(view,root);return view;
}
