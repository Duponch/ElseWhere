import {roofCells,isRoofed} from './roof-rules.ts';
import {caveLightSources256} from './cave-flora-256.ts';
import {lightSources} from './light-sources.ts';
import { annualNaturalLight } from './environment.ts';
import { LocalLightCache } from './local-light.ts';
import { RoomTopologyCache, type RoomTopology } from './room-topology.ts';
import type { Cell, World } from './types.ts';

export const lightSpeedFactor = (glow:number):number => .8 + .2 * Math.min(1, Math.max(0, glow) / .3);
export type LightReader = (() => LightEnvironment) & {readonly speedAt?:(cell:Cell)=>number};

/** A synchronous decision snapshot; movement does not need furniture roles. */
export class LightEnvironment {
  readonly topology:RoomTopology;
  readonly roofs:ReadonlySet<number>;
  readonly artificial:Float32Array;
  readonly sky:number;
  constructor(topology:RoomTopology,roofs:ReadonlySet<number>,artificial:Float32Array,sky:number,readonly withoutCaves:Float32Array=artificial) {
    this.topology=topology;this.roofs=roofs;this.artificial=artificial;this.sky=sky;
  }
  lightAt(cell:Cell):number {
    if(!this.topology.at(cell.x,cell.z))return 0;
    const index=cell.z*this.topology.width+cell.x;
    return Math.max(this.roofs.has(index)?0:this.sky,this.artificial[index]??0);
  }
  lightAtIgnoringCavePlants(cell:Cell):number {
    if(!this.topology.at(cell.x,cell.z))return 0;const index=cell.z*this.topology.width+cell.x;
    return Math.max(this.roofs.has(index)?0:this.sky,this.withoutCaves[index]??0);
  }
  speedAt(cell:Cell):number {return lightSpeedFactor(this.lightAt(cell));}
}

/** Caller owned. Sharing is allowed only until a source/roof/barrier mutation. */
export class LightEnvironmentCache {
  private readonly topology=new RoomTopologyCache();
  readonly localLight=new LocalLightCache();
  private readonly nonCaveLight=new LocalLightCache();
  /** The last snapshot, returned again while all of its inputs are the same objects/values. */
  private last?:LightEnvironment;
  /** `environment`, when given, supplies the snapshot instead of read(world):
   * a caller that holds one for a pass where no light input can change. */
  speedAt(world:World,cell:Cell,environment?:()=>LightEnvironment):number {
    if(Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height){
      const sky=annualNaturalLight(world),index=cell.z*world.width+cell.x;
      // Roof arrays are kept sorted (see roof-rules containsRoofCell): binary search, not O(roofs).
      if(Number.isFinite(sky)&&sky>=.3&&!isRoofed(world,index))return 1;
    }
    return (environment?environment():this.read(world)).speedAt(cell);
  }
  read(world:World):LightEnvironment {
    const topology=this.topology.read(world);
    const combined=this.localLight.read(world,topology),withoutCaves=caveLightSources256(world).length?this.nonCaveLight.read(world,topology,lightSources(world,false)):combined;
    const roofs=roofCells(world),sky=annualNaturalLight(world),last=this.last;
    if(last&&last.topology===topology&&last.roofs===roofs&&last.artificial===combined&&last.withoutCaves===withoutCaves&&last.sky===sky)return last;
    return this.last=new LightEnvironment(topology,roofs,combined,sky,withoutCaves);
  }
}

/* One cache per map, shared by its readers (Core movement, human move speed,
 * surface environment, work environment). read() checks every input on each
 * call (barriers and rock tiles, light sources and their activity, the
 * opaque cells around the sources, roofs, sky light) and a reused light map
 * is exactly the one a fresh build would give (sameLightObstacles), so a
 * shared cache gives the same answers as one cache per reader. It only
 * avoids rebuilding the same room topology and light map once per reader,
 * and from scratch each time a reader dropped its own cache. */
const sharedCaches=new WeakMap<World,LightEnvironmentCache>();
export function sharedLightEnvironmentCache(world:World):LightEnvironmentCache {
  let cache=sharedCaches.get(world);if(!cache){cache=new LightEnvironmentCache();sharedCaches.set(world,cache);}
  return cache;
}
