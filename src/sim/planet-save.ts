import {canPlaceWorldSettlement} from './world-settlement-placement.ts';
import {validGeographicPlanetHeader256,planetGeography256,geographyGeometryAllowed256} from './planet-geography-256.ts';
import {planetFactionTargets256} from './planet-faction-targets-256.ts';
import {worldBiomeCanSettle} from './world-biome-properties.ts';
/** Strict immutable geography guard; no generation dependency or adoption. */
import type { PlanetState, LegacyPlanetState, PlanetTile, PlanetValidationWorld } from './planet-state.ts';

export const PLANET_TILE_COUNT = 162;
export const PLANET_ARC_COUNT = 960;
const PLANET_KEYS = ['revision', 'adoptedAt', 'generationSeed', 'tiles', 'homeTile', 'civilianTile', 'nextGroupId'] as const satisfies readonly (keyof LegacyPlanetState)[];
const TILE_KEYS = ['id', 'center', 'neighbours', 'biome', 'hilliness', 'meanTemperature', 'rainfall'] as const satisfies readonly (keyof PlanetTile)[];
const BIOMES = ['ocean', 'temperate-forest', 'boreal-forest', 'arid-shrubland', 'tundra'] as const;
const HILLS = ['flat', 'small-hills', 'large-hills', 'mountainous'] as const;
const CENTER_UNIT_EPSILON = 1e-9;
// Numerical separation, not a second saved geometry or a seed replay. The
// original subdivided sphere has short edges and strictly convex dual faces.
const GEOMETRY_EPSILON = 1e-10;
type Vector = PlanetTile['center'];
const dot = (a: Vector, b: Vector): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: Vector, b: Vector): Vector => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unit(value: Vector): Vector | undefined {
  const norm = Math.hypot(...value);
  return Number.isFinite(norm)&&norm>GEOMETRY_EPSILON?[value[0]/norm,value[1]/norm,value[2]/norm]:undefined;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= low && value <= high;
const finite = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every(key => typeof key === 'string' && expected.includes(key));
};
/** Bounds checked BEFORE enumerating slots. Reject holes/custom array fields;
 * Array.every alone would silently skip a missing tile/coordinate/neighbour. */
function denseArray(value: unknown, low: number, high: number): value is unknown[] {
  if (!Array.isArray(value) || value.length < low || value.length > high) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === value.length + 1 && keys.every(key => key === 'length'
    || typeof key === 'string' && integer(Number(key), 0, value.length - 1) && String(Number(key)) === key);
}

/** Shared by generation and save AFTER constructing the tiles array. Raw
 * unknown accepted safely; no latitude/longitude/corner authority or RNG. */
export function validatePlanetTopology(tilesValue: unknown): string[] {
  if (!denseArray(tilesValue, PLANET_TILE_COUNT, PLANET_TILE_COUNT)) return ['Invalid planet tile array.'];
  const centerKeys = new Set<string>();
  let arcs = 0, pentagons = 0, hexagons = 0;
  // Validate ALL bounded row shapes and neighbour indices before cross reads.
  for (let id = 0; id < PLANET_TILE_COUNT; id++) {
    const tile = tilesValue[id];
    if (!record(tile) || !exactKeys(tile, TILE_KEYS) || tile.id !== id
      || !denseArray(tile.center, 3, 3) || !denseArray(tile.neighbours, 5, 6))
      return [`Invalid planet tile shape at ${id}.`];
    const center = tile.center;
    if (!center.every(value => typeof value === 'number' && Number.isFinite(value))
      || Math.abs(Math.hypot(center[0] as number, center[1] as number, center[2] as number) - 1) > CENTER_UNIT_EPSILON)
      return [`Invalid planet tile center at ${id}.`];
    const key = center.join(','); // Numeric equality also identifies +0/-0; no value is normalized.
    if (centerKeys.has(key)) return [`Duplicate planet tile center at ${id}.`];
    centerKeys.add(key);
    if (typeof tile.biome !== 'string' || !BIOMES.includes(tile.biome as typeof BIOMES[number])
      || typeof tile.hilliness !== 'string' || !HILLS.includes(tile.hilliness as typeof HILLS[number])
      || !finite(tile.meanTemperature, -100, 100) || !finite(tile.rainfall, 0, 10000))
      return [`Invalid planet tile terrain or climate at ${id}.`];
    if (tile.neighbours.some(neighbour => !integer(neighbour, 0, PLANET_TILE_COUNT - 1) || neighbour === id)
      || new Set(tile.neighbours).size !== tile.neighbours.length)
      return [`Invalid planet tile neighbours at ${id}.`];
    arcs += tile.neighbours.length;
    pentagons += Number(tile.neighbours.length === 5);
    hexagons += Number(tile.neighbours.length === 6);
  }
  if (arcs !== PLANET_ARC_COUNT || pentagons !== 12 || hexagons !== 150) return ['Invalid planet degree census.'];
  const tiles = tilesValue as PlanetTile[];
  for (const tile of tiles) for (const neighbour of tile.neighbours)
    if (!tiles[neighbour]!.neighbours.includes(tile.id)) return [`Non-reciprocal planet edge at ${tile.id}:${neighbour}.`];
  if (reachableTiles(tiles, 0, false).size !== PLANET_TILE_COUNT) return ['Disconnected planet topology.'];
  return validatePlanetGeometry(tiles);
}

/** Only162 bounded stars, each of degree5/6. Graph degree/reciprocity alone
 * permits a permutation of centers that makes an edge antipodal or folds a
 * face. Check the actual embedding used by the derived dual and SVG globe.
 * No all-pairs world search, path finder, normalization of saved data or RNG. */
function validatePlanetGeometry(tiles: readonly PlanetTile[]): string[] {
  for (const tile of tiles) {
    const p=tile.center,axis:Vector=Math.abs(p[1])>.9?[1,0,0]:[0,1,0];
    const east=unit(cross(axis,p));
    if(!east)return [`Invalid planet tangent at ${tile.id}.`];
    const north=cross(p,east),ring=tile.neighbours.map(id=>tiles[id]!);
    for(const neighbour of ring){
      const separation=dot(p,neighbour.center);
      // Acute, distinct neighbors also keep every interpolated route vector
      // and center+neighbor+neighbor corner strictly away from a zero vector.
      if(separation<=GEOMETRY_EPSILON||separation>=1-GEOMETRY_EPSILON)
        return [`Invalid planet geometric edge at ${tile.id}:${neighbour.id}.`];
      if(ring.filter(other=>neighbour.neighbours.includes(other.id)).length!==2)
        return [`Non-triangulated planet star at ${tile.id}.`];
    }
    ring.sort((a,b)=>Math.atan2(dot(a.center,north),dot(a.center,east))-Math.atan2(dot(b.center,north),dot(b.center,east)));
    const corners:Vector[]=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i]!,b=ring[(i+1)%ring.length]!;
      if(!a.neighbours.includes(b.id)||dot(p,cross(a.center,b.center))<=GEOMETRY_EPSILON)
        return [`Folded or degenerate planet triangle at ${tile.id}:${a.id}:${b.id}.`];
      const corner=unit([p[0]+a.center[0]+b.center[0],p[1]+a.center[1]+b.center[1],p[2]+a.center[2]+b.center[2]]);
      if(!corner||dot(p,corner)<=GEOMETRY_EPSILON)return [`Invalid planet dual corner at ${tile.id}.`];
      corners.push(corner);
    }
    // Center and other corners must lie on the inward side of every edge;
    // this prevents a collapsed, crossed or concave dual polygon and keeps
    // its horizon clipping away from antipodal endpoint normalization.
    for(let i=0;i<corners.length;i++){
      const normal=cross(corners[i]!,corners[(i+1)%corners.length]!);
      if(Math.hypot(...normal)<=GEOMETRY_EPSILON||dot(normal,p)<=GEOMETRY_EPSILON
        ||corners.some(corner=>dot(normal,corner)<-GEOMETRY_EPSILON))
        return [`Invalid planet dual polygon at ${tile.id}.`];
    }
  }
  return [];
}

/** Only called after row/index checks; bounded162nodes/960arcs, no path search. */
function reachableTiles(tiles: readonly PlanetTile[], start: number, landOnly: boolean): Set<number> {
  const seen = new Set<number>([start]), queue = [start];
  for (let head = 0; head < queue.length; head++) for (const next of tiles[queue[head]!]!.neighbours) {
    if (seen.has(next) || landOnly && tiles[next]!.biome === 'ocean') continue;
    seen.add(next); queue.push(next);
  }
  return seen;
}

/** Owned prospective geometry has already crossed the complete cold boundary.
 * Warm validation reads the closed header and real settlement targets only;
 * no geographic column traversal, mesh allocation or PRNG occurs here. */
export function validateGeographicPlanet256(value:unknown,realWorld:PlanetValidationWorld,version:number):string[] {
 if(!integer(version,256,Number.MAX_SAFE_INTEGER))return ['Future or invalid geographic planet validation version.'];
 if(!validGeographicPlanetHeader256(value)||!integer(realWorld.tick,0,Number.MAX_SAFE_INTEGER)||value.adoptedAt>realWorld.tick)return ['Invalid geographic planet header.'];
 let geography:import('./world-geography-owner-256.ts').CampaignGeography256;try{geography=planetGeography256(value);}catch{return ['Geographic planet requires complete boundary hydration.'];}
 if(!geographyGeometryAllowed256(geography.definition,version))return ['Future planet geometry revision in a historical schema.'];
 const tiles=geography.surface.tiles,home=tiles[value.homeTile];if(!home||!worldBiomeCanSettle(home.biome)||home.hilliness==='impassable')return ['Invalid geographic starting tile.'];
 const targets=planetFactionTargets256(realWorld.worldFactions,tiles);if(!targets)return ['Geographic planet lacks its real faction settlement authority.'];
 if(!canPlaceWorldSettlement(tiles,value.homeTile,{settlementTiles:targets.occupied}))return ['Geographic starting tile overlaps a foreign settlement admission.'];
 if(value.civilianTile===null?targets.civilianTiles.length!==0:!targets.civilianTiles.includes(value.civilianTile)||value.civilianTile===value.homeTile)return ['Geographic civilian target is not a real civil settlement.'];
 return [];
}

/** Optional adoption: absence is legal after a neutral migration. Root MUST
 * separately reject ['planet','group','groupLosses'].some(key=>Object.hasOwn(realWorld,key))
 * under version<=195, INCLUDING undefined. This value-only guard cannot infer
 * whether undefined was absent or an own future field. No adoption is done. */
export function validatePlanet(value: unknown, realWorld: PlanetValidationWorld, version: number = realWorld.schemaVersion): string[] {
  if (!integer(version, 1, Number.MAX_SAFE_INTEGER)) return ['Invalid planet validation version.'];
  if (value === undefined) return [];
  if (version <= 195) return ['Future planet state in historical schema.'];
  if (!integer(realWorld.tick, 0, Number.MAX_SAFE_INTEGER)) return ['Invalid planet world clock.'];
  if(record(value)){const revision=Object.getOwnPropertyDescriptor(value,'revision');if(revision&&Object.hasOwn(revision,'value')&&revision.value===3)return validateGeographicPlanet256(value,realWorld,version);if(Object.hasOwn(value,'geography'))return ['Future geographic field in literal legacy planet.'];}
  if (!record(value) || !exactKeys(value, PLANET_KEYS)) return ['Invalid planet state shape.'];
  if (!denseArray(value.tiles, PLANET_TILE_COUNT, PLANET_TILE_COUNT)) return ['Invalid planet tile array.'];
  if (!(value.revision===1||version>=239&&value.revision===2) || !integer(value.generationSeed, 0, 0xffffffff)
    || !integer(value.adoptedAt, 0, realWorld.tick) || !integer(value.nextGroupId, 1, Number.MAX_SAFE_INTEGER)
    || !integer(value.homeTile, 0, PLANET_TILE_COUNT - 1) || !integer(value.civilianTile, 0, PLANET_TILE_COUNT - 1)
    || value.homeTile === value.civilianTile) return ['Invalid planet revision, clock, seed or indices.'];
  const errors = validatePlanetTopology(value.tiles);
  if (errors.length) return errors;
  const tiles = value.tiles as PlanetTile[];
  if(value.revision===1&&tiles.some(t=>t.biome==='tundra'))return ['Future biome in legacy planet revision.'];
  if (tiles[value.homeTile]!.biome === 'ocean' || tiles[value.civilianTile]!.biome === 'ocean')
    return ['Planet home or civilian site is ocean.'];
  if (!reachableTiles(tiles, value.homeTile, true).has(value.civilianTile))
    return ['Planet civilian site is unreachable from home by land.'];
  return [];
}
