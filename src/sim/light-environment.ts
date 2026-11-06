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
  speedAt(world:World,cell:Cell):number {
    if(Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height){
      const sky=annualNaturalLight(world),index=cell.z*world.width+cell.x;
      // Roof arrays are kept sorted (see roof-rules containsRoofCell): binary search, not O(roofs).
      if(Number.isFinite(sky)&&sky>=.3&&!isRoofed(world,index))return 1;
    }
    return this.read(world).speedAt(cell);
  }
  read(world:World):LightEnvironment {
    const topology=this.topology.read(world);
    const combined=this.localLight.read(world,topology),withoutCaves=caveLightSources256(world).length?this.nonCaveLight.read(world,topology,lightSources(world,false)):combined;
    return new LightEnvironment(topology,roofCells(world),combined,annualNaturalLight(world),withoutCaves);
  }
}
