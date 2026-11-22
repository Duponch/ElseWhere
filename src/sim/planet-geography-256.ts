import type {PlanetState,GeographicPlanetState} from './planet-state.ts';
import {ownedCampaignGeography256,restoreCampaignGeography256,isCampaignGeography256,type CampaignGeography256} from './world-geography-owner-256.ts';
import type {WorldSurfaceTile} from './world-surface-geography.ts';
import {CORE_PLANET_GEOMETRY_SCHEMA} from './world-surface-storage.ts';
/** Geometry revision 2 is a schema 376 field: an older save holding it is
 * refused before any mesh is built. */
export function geographyGeometryAllowed256(geography:unknown,version:number):boolean {
 if(!geography||typeof geography!=='object')return true;
 const surface=Object.getOwnPropertyDescriptor(geography,'surface')?.value;
 if(!surface||typeof surface!=='object')return true;
 const revision=Object.getOwnPropertyDescriptor(surface,'geometryRevision');
 return !revision||!Object.hasOwn(revision,'value')||revision.value!==2||version>=CORE_PLANET_GEOMETRY_SCHEMA;
}
export const GEOGRAPHIC_PLANET_KEYS_256=['revision','adoptedAt','generationSeed','geography','homeTile','civilianTile','nextGroupId'] as const;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
/** Header only: no column walk or restoration may hide in a hot accessor. */
export function validGeographicPlanetHeader256(v:unknown):v is GeographicPlanetState {
 return record(v)&&Reflect.ownKeys(v).length===GEOGRAPHIC_PLANET_KEYS_256.length&&GEOGRAPHIC_PLANET_KEYS_256.every(k=>Object.hasOwn(v,k))&&v.revision===3&&int(v.adoptedAt)&&int(v.generationSeed,0,0xffffffff)&&int(v.homeTile)&&(v.civilianTile===null||int(v.civilianTile))&&int(v.nextGroupId,1)&&!!v.geography&&typeof v.geography==='object';
}
export function planetGeography256(p:GeographicPlanetState):CampaignGeography256 {
 if(!validGeographicPlanetHeader256(p))throw Error('Invalid geographic planet header');
 const owner=ownedCampaignGeography256(p.geography);
 if(!owner||!isCampaignGeography256(owner)||owner.surface.generationSeed!==p.generationSeed)throw Error('Campaign geography was not restored at its boundary');return owner;
}
export type PlanetRuntimeTile=import('./planet-state.ts').PlanetTile|WorldSurfaceTile;
/** The returned original geometry is immutable for revision3. Legacy arrays
 * remain the exact literal historical arrays, without wrapping or generation. */
export function planetTiles(p:PlanetState):readonly PlanetRuntimeTile[] {return p.revision===3?planetGeography256(p).surface.tiles:p.tiles;}
export function planetTileCount(p:PlanetState):number {return p.revision===3?planetGeography256(p).surface.tiles.length:p.tiles.length;}
export function planetTile(p:PlanetState,id:number):PlanetRuntimeTile|undefined {if(!int(id))return;return p.revision===3?planetGeography256(p).surface.tiles[id]:p.tiles[id];}
/** External RAW cold boundary. Returns a staged header/owner and never mutates
 * the input or an accepted World. The caller adopts it only after all guards.
 * Restoration rebuilds only the recorded geometric algorithm; no generator,
 * climate, faction, road, river or PRNG stage is rerun here. */
export function preparePlanetHydration256(value:unknown,version:number):{planet:GeographicPlanetState;owner:CampaignGeography256} {
 if(!int(version,256)||!validGeographicPlanetHeader256(value))throw Error('Invalid prospective planet header');
 if(!geographyGeometryAllowed256(value.geography,version))throw Error('Future planet geometry revision in a historical save');
 const known=ownedCampaignGeography256(value.geography),owner=known??restoreCampaignGeography256(value.geography);
 if(owner.surface.generationSeed!==value.generationSeed)throw Error('Planet/geography generation seed disagreement');
 const count=owner.surface.tiles.length;if(value.homeTile>=count||value.civilianTile!==null&&value.civilianTile>=count)throw Error('Planet index outside actual geography');
 return {planet:{revision:3,adoptedAt:value.adoptedAt,generationSeed:value.generationSeed,geography:owner.definition,homeTile:value.homeTile,civilianTile:value.civilianTile,nextGroupId:value.nextGroupId},owner};
}
/** A pending transport definition must be installed from its confirmed owner,
 * never from an untrusted equal object. Connection-level ID admission remains
 * GeographyDecoder256's responsibility before this narrow composition. */
export function bindPlanetGeography256(header:Omit<GeographicPlanetState,'geography'>,owner:CampaignGeography256):GeographicPlanetState {
 if(!isCampaignGeography256(owner))throw Error('Unowned geographic definition');
 const keys=GEOGRAPHIC_PLANET_KEYS_256.filter(k=>k!=='geography');if(!record(header)||Reflect.ownKeys(header).length!==keys.length||!keys.every(k=>Object.hasOwn(header,k)))throw Error('Invalid geographic transport header');
 const candidate={...header,geography:owner.definition};if(!validGeographicPlanetHeader256(candidate)||candidate.generationSeed!==owner.surface.generationSeed||candidate.homeTile>=owner.surface.tiles.length||candidate.civilianTile!==null&&candidate.civilianTile>=owner.surface.tiles.length)throw Error('Invalid planet/geography binding');return candidate;
}

export type PlanetGeographicHeader256=Omit<GeographicPlanetState,'geography'>;
/** Connection transport sends this scalar header beside GeographyEncoder256's
 * definition/reference. It must not duplicate the columns inside world.planet. */
export function planetGeographicHeader256(p:GeographicPlanetState):PlanetGeographicHeader256 {
 planetGeography256(p);return {revision:3,adoptedAt:p.adoptedAt,generationSeed:p.generationSeed,homeTile:p.homeTile,civilianTile:p.civilianTile,nextGroupId:p.nextGroupId};
}
