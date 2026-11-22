import { listenerPose, type AudioCamera } from './spatial.ts';
import type { Resource, World } from '../sim/types.ts';
import { plantGrowth } from '../sim/plants.ts';
import { plantLeafless } from '../sim/plant-life.ts';
import { TICKS_PER_DAY } from '../sim/types.ts';
import { calendarTick } from '../sim/calendar.ts';
import { outdoorTemperature } from '../sim/temperature.ts';
import type { WeatherKind } from '../sim/weather-definitions.ts';
import { biomeHasNightInsects, nightInsectsGain } from './game-sounds.ts';
import type { ContinuousSource } from './continuous.ts';

/** Global weather follows the map camera but softens as the listener rises. */
export function ambientCameraGain(camera: AudioCamera): number {
  const height = listenerPose(camera).y;
  return Math.max(0.15, 1 / (1 + Math.max(0, height - 2) / 32));
}

const FOLIAGE_CELL = 8;
const FOLIAGE_RADIUS = 28;
type CanopyDeposit={cell:number;right:number;lower:number;lowerRight:number;a:number;b:number;c:number;d:number};

/** Snapshot-only canopy census. Bilinear deposition keeps the listening field
 * continuous across cells; camera queries visit a bounded neighbourhood, never
 * resources. This controls one existing rustle loop, not one voice per tree. */
export class FoliageAmbience {
  private density = new Float32Array(0);
  private columns = 0;
  private rows = 0;
  private snapshotResources:readonly Resource[]|undefined;
  private snapshotTimeInvariant=false;
  private stableDeposits:WeakMap<Resource,CanopyDeposit>|undefined;

  /** Opt-in is reserved for immutable decoder snapshots; direct callers retain
   * the original census and same-tick mutation semantics. */
  adopt(world: World,immutableSnapshot=false): void {
    const columns = Math.ceil(world.width / FOLIAGE_CELL) + 1;
    const rows = Math.ceil(world.height / FOLIAGE_CELL) + 1;
    const resized=columns!==this.columns||rows!==this.rows;
    if(immutableSnapshot&&!resized&&this.snapshotResources===world.resources&&this.snapshotTimeInvariant)return;
    if (columns !== this.columns || rows !== this.rows) {
      this.columns = columns; this.rows = rows;
      this.density = new Float32Array(columns * rows);
    } else this.density.fill(0);
    if(immutableSnapshot){
      if(resized||!this.stableDeposits)this.stableDeposits=new WeakMap();
      const deposits=this.stableDeposits;
      let timeInvariant=true;
      for(const plant of world.resources){
        if(plant.kind!=='tree'&&plant.kind!=='berries'||plant.species==='saguaro')continue;
        const stable=(plant.growth??1)===1&&plant.plantLife?.leaflessAt===undefined;
        if(!stable)timeInvariant=false;
        const deposit=deposits.get(plant);
        if(!deposit){
          if(plantLeafless(world,plant))continue;
          const growth=plantGrowth(world,plant),weight=(plant.kind==='tree'?1:.15)*growth*growth;
          const gx=plant.x/FOLIAGE_CELL,gz=plant.z/FOLIAGE_CELL;
          const x=Math.floor(gx),z=Math.floor(gz),fx=gx-x,fz=gz-z;
          const cell=z*columns+x,right=z*columns+x+1,lower=(z+1)*columns+x,lowerRight=(z+1)*columns+x+1;
          const a=weight*(1-fx)*(1-fz),b=weight*fx*(1-fz),c=weight*(1-fx)*fz,d=weight*fx*fz;
          this.density[cell]!+=a;this.density[right]!+=b;this.density[lower]!+=c;this.density[lowerRight]!+=d;
          if(stable)deposits.set(plant,{cell,right,lower,lowerRight,a,b,c,d});
          continue;
        }
        // Keep unrounded JS contributions and the original per-resource order.
        this.density[deposit.cell]!+=deposit.a;this.density[deposit.right]!+=deposit.b;
        this.density[deposit.lower]!+=deposit.c;this.density[deposit.lowerRight]!+=deposit.d;
      }
      this.snapshotResources=world.resources;this.snapshotTimeInvariant=timeInvariant;
      return;
    }
    // A mutable read revokes every cached Resource witness, even if unchanged.
    this.snapshotResources=undefined;this.snapshotTimeInvariant=false;this.stableDeposits=undefined;
    for (const plant of world.resources) {
      if (plant.kind !== 'tree' && plant.kind !== 'berries') continue;
      if (plant.species === 'saguaro' || plantLeafless(world, plant)) continue;
      const growth = plantGrowth(world, plant);
      const weight = (plant.kind === 'tree' ? 1 : .15) * growth * growth;
      const gx = plant.x / FOLIAGE_CELL, gz = plant.z / FOLIAGE_CELL;
      const x = Math.floor(gx), z = Math.floor(gz), fx = gx - x, fz = gz - z;
      // Resource coordinates are validated by simulation/save boundaries.
      this.density[z * columns + x]! += weight * (1 - fx) * (1 - fz);
      this.density[z * columns + x + 1]! += weight * fx * (1 - fz);
      this.density[(z + 1) * columns + x]! += weight * (1 - fx) * fz;
      this.density[(z + 1) * columns + x + 1]! += weight * fx * fz;
    }
  }

  gain(x: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const radius2 = FOLIAGE_RADIUS * FOLIAGE_RADIUS;
    const minX = Math.max(0, Math.ceil((x - FOLIAGE_RADIUS) / FOLIAGE_CELL));
    const maxX = Math.min(this.columns - 1, Math.floor((x + FOLIAGE_RADIUS) / FOLIAGE_CELL));
    const minZ = Math.max(0, Math.ceil((z - FOLIAGE_RADIUS) / FOLIAGE_CELL));
    const maxZ = Math.min(this.rows - 1, Math.floor((z + FOLIAGE_RADIUS) / FOLIAGE_CELL));
    let canopy = 0;
    for (let iz = minZ; iz <= maxZ; iz++) for (let ix = minX; ix <= maxX; ix++) {
      const d2 = (ix * FOLIAGE_CELL - x) ** 2 + (iz * FOLIAGE_CELL - z) ** 2;
      const weight = Math.max(0, 1 - d2 / radius2);
      canopy += this.density[iz * this.columns + ix]! * weight * weight;
    }
    return 1 - Math.exp(-canopy / 24);
  }
}

/** Core WeatherDef.ambientSounds: Ambient_Wind_Clear for clear, fog (its own
 * fog wind in Core) and gentle snow; Ambient_Wind_Storm for thunderstorms and
 * hard snow. Rain keeps its own loop. */
const STORM_WEATHER: ReadonlySet<WeatherKind> = new Set(['dry-thunderstorm', 'rainy-thunderstorm', 'snow-hard']);
const CLEAR_WIND_WEATHER: ReadonlySet<WeatherKind> = new Set(['clear', 'fog', 'snow-gentle', 'foggy-rain']);

/** The biome and weather beds of the game sounds of 22 November: night insects
 * (Core Ambient_NightInsects_Standard, by hour and outdoor temperature) and the
 * weather's wind bed. Built with the other loops on a snapshot or a camera move,
 * never per image; each is one non-spatial voice. */
export function gameAmbienceSources(world: World, focus: { x: number; z: number }, weather: WeatherKind, cameraGain: number): ContinuousSource[] {
  const sources: ContinuousSource[] = [];
  if (biomeHasNightInsects(world.site?.biome)) {
    const hour = 24 * (calendarTick(world) % TICKS_PER_DAY) / TICKS_PER_DAY;
    const insects = nightInsectsGain(hour, outdoorTemperature(world)) * cameraGain;
    if (insects > .02) sources.push({ id: 'ambient:night-insects', kind: 'ambient.night-insects', x: focus.x, z: focus.z, gain: insects });
  }
  const bed = STORM_WEATHER.has(weather) ? 'weather.wind-storm' : CLEAR_WIND_WEATHER.has(weather) ? 'weather.wind-clear' : undefined;
  if (bed) sources.push({ id: `ambient:${bed}`, kind: bed, x: focus.x, z: focus.z, gain: cameraGain });
  return sources;
}
