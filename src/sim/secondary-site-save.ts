import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validCorePathBudget297} from './core-path-budget-297.ts';
import {geographicLongitudeOffsetCore256} from './site-climate.ts';
import {planetTile,planetTileCount} from './planet-geography-256.ts';
import {planetTileCoordinates} from './planet-navigation.ts';
import {registeredMapId,boundWorldGroup} from './world-map-context.ts';
import { CAMPAIGN_FIELDS } from './secondary-site-state.ts';
import { campaignAuthority,isSecondaryContext,secondaryValidationContext } from './secondary-site-context.ts';
import { isBiomeId } from './biome-flora.ts';
import { tileCoordinates } from './planet-generation.ts';
import { longitudeOffsetCore } from './planet-navigation.ts';
import { calendarTick } from './calendar.ts';
import type { World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(v:Record<string,unknown>,names:readonly string[])=>Reflect.ownKeys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const point=(v:unknown,w:World)=>object(v)&&exact(v,['x','z'])&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);

/** This gate precedes owner capture or local-map validation. No arbitrary
 * nested map can become a context or smuggle future fields through migration. */
export function validSecondarySiteShape(raw:unknown,version:number):boolean {
  if(!object(raw))return false;
  if(version<255&&(Object.hasOwn(raw,'worldMaps')||Object.hasOwn(raw,'worldGroups')))return false;
  if(version>=255&&(registeredMapId(raw as unknown as World)!==undefined||boundWorldGroup(raw as unknown as World)))return !Object.hasOwn(raw,'secondarySite')&&!Object.hasOwn(raw,'campaignMap')&&validExpeditionOrigin(raw.expeditionSite,raw as unknown as World,version);
  if(['campaignPeople','campaignMap'].some(k=>Object.hasOwn(raw,k)))return false;
  if(version<240)return !Object.hasOwn(raw,'secondarySite')&&!Object.hasOwn(raw,'expeditionSite');
  if(isSecondaryContext(raw as unknown as World))return !Object.hasOwn(raw,'secondarySite')&&validExpeditionOrigin(raw.expeditionSite,raw as unknown as World,version);
  if(Object.hasOwn(raw,'expeditionSite'))return false;
  if(!Object.hasOwn(raw,'secondarySite'))return true;
  const s=raw.secondarySite,w=raw as unknown as World;
  if(!object(s)||!exact(s,['revision','tile','createdAt','selected','map','visit'])||s.revision!==1||!integer(s.tile,0,161)
    ||!integer(s.createdAt,0,Number(raw.tick))||typeof s.selected!=='boolean'||!object(s.map)||!object(raw.planet)||raw.planet.revision===3||!Array.isArray(raw.planet.tiles))return false;
  const tile=raw.planet.tiles[s.tile];
  if(!object(tile)||!isBiomeId(tile.biome)||tile.hilliness==='mountainous'||s.tile===raw.planet.homeTile||s.tile===raw.planet.civilianTile)return false;
  const map=s.map;
  if(!validCorePathBudget297(map,version,Number(raw.tick),isCorePhysicalSchema297(version)?Number(Object.getOwnPropertyDescriptor(raw,'phaseCore297')?.value):0))return false;
  if(['secondarySite',...CAMPAIGN_FIELDS].some(k=>Object.hasOwn(map,k))||map.scenario!==undefined||map.width!==raw.width||map.height!==raw.height
    ||!validExpeditionOrigin(map.expeditionSite,w,version)||!object(map.expeditionSite)||map.expeditionSite.tile!==s.tile||map.expeditionSite.createdAt!==s.createdAt)return false;
  if(!object(map.climate)||map.climate.revision!==3)return false;
  // A legacy home's later explicit climate adoption cannot reconstruct the
  // civil date that was actually observed on the expedition's creation day.
  // The local origin stays persisted; no climate or growth history is replayed.
  if((!w.climate||w.climate.adoptedAt<=s.createdAt)&&map.climate.calendarOrigin!==calendarTick(w,s.createdAt)+Number(map.expeditionSite.calendarOffset))return false;
  // The local validator owns all remaining state and exact Thing references.
  // Reject hidden/custom fields here; map record must be ordinary plain data.
  if(Object.getPrototypeOf(map)!==Object.prototype||Reflect.ownKeys(map).some(k=>typeof k!=='string'||!LOCAL_FIELDS.has(k)||k==='party292'&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))
    ||!Object.hasOwn(Object.getOwnPropertyDescriptor(map,k)!,'value')))return false;
  const size=Number(raw.width)*Number(raw.height);
  if(!['tiles','pawns','resources','structures','jobs','piles','stockpiles','growingZones','packed'].every(k=>dense(map[k],k==='piles'?32768:size*3))
    ||!Array.isArray(map.pawns)||map.pawns.some(p=>!object(p)||!integer(p.id,1,Number(raw.nextId)-1)))return false;
  if(map.scout!==undefined||map.commercialTrip!==undefined||map.groupLosses!==undefined||map.startingArrival!==undefined
    ||map.group!==undefined&&(!object(map.group)||!['gathering','loading','leaving','unloading'].includes(String(map.group.phase))))return false;
  if(s.visit===null)return true;
  return object(s.visit)&&exact(s.visit,['groupId','memberIds','homeEntry'])&&integer(s.visit.groupId,1,Number(raw.planet.nextGroupId)-1)
    &&dense(s.visit.memberIds,8)&&s.visit.memberIds.length>0&&s.visit.memberIds.every(id=>integer(id,1,Number(raw.nextId)-1)&&(map.pawns as unknown[]).some(p=>object(p)&&p.id===id))
    &&new Set(s.visit.memberIds).size===s.visit.memberIds.length&&point(s.visit.homeEntry,w);
}

export function validExpeditionOrigin(value:unknown,w:Pick<World,'tick'|'planet'>,version:number):boolean {
  if(value===undefined)return true;
  if(version<240||!object(value)||!exact(value,['tile','createdAt','calendarOffset'])||!integer(value.tile,0,version>=255?(w.planet?planetTileCount(w.planet):0)-1:161)||!integer(value.createdAt,0,w.tick)||!w.planet||version<256&&w.planet.revision===3)return false;
  const t=planetTile(w.planet,value.tile),home=planetTile(w.planet,w.planet.homeTile),offset=w.planet.revision===3?geographicLongitudeOffsetCore256:longitudeOffsetCore;
  return !!t&&!!home&&t.biome!=='ocean'&&(w.planet.revision===3?t.biome!=='lake'&&t.hilliness!=='impassable':t.hilliness!=='mountainous')&&value.tile!==w.planet.homeTile&&value.tile!==w.planet.civilianTile
    &&value.calendarOffset===(offset(planetTileCoordinates(w.planet,t.id).longitude)-offset(planetTileCoordinates(w.planet,home.id).longitude))/10;
}

// Explicit map namespace: adding another World domain requires a conscious
// partition decision. A future field is not accepted because World ignores it.
export const LOCAL_FIELDS=new Set([
  'corePathBudget297',
  'strip351',
  'plans369',
  'party292',
  'firefoam290',
  'shipReactorThreats275',
  'worldSiteThreat263','worldDefence263','expeditionSite','autoSlaughter','allowedAreas','orbital','deepResources','group','groupLosses','mechSalvage','mechanoids','rainElectrical',
  'commercialTrip','civilianPost','quests','scout','breakdown','economy','apparelWear','filth','visitors','trade','climate','wind','weather','fires',
  'prisonDepartures','site','scenario','startingArrival','hunting','butchery','flora','wildlife','heatwaves','raids','fluIncidents','miscIncidents',
  'smallIncidents','flashstorm','podRescues','home','destroyed','arrivals','projectiles','bombWaves','roofing','thermal','packed','snow','snowClearArea',
  'tailoring','deconstructed','seed','width','height','tiles','pawns','resources','structures','jobs','piles','stockpiles','growingZones','growingCursor',
  'ancientShrineWarnings','geysers','roadInfo','riverWater','exploration','environment','stock','spoiled','events','logisticsCursor','deterioration',
]);

export function secondaryMapForValidation(world:World):World|undefined {
  return isSecondaryContext(world)?undefined:secondaryValidationContext(campaignAuthority(world));
}
