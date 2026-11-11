import {advanceVents} from './vent.ts';
import { seasonalOutdoorTemperature } from './site-climate.ts';
import { advanceCoolers } from './cooler.ts';
import { activeHeatwave,heatwaveOffset } from './heatwave.ts';
import { coldSnapOffset } from './cold-snap.ts';
import { applyThermalSources } from './thermal-sources.ts';
import { TICKS_PER_DAY, type Cell, type World } from './types.ts';
import { ThermalTopologyCache, type ThermalLayout } from './thermal-topology.ts';

export interface ThermalRegion {cells:number[];temperature:number}
export interface ThermalState {regions:ThermalRegion[]}
export function outdoorTemperature(input:number|Pick<World,'tick'|'heatwaves'|'miscIncidents'|'gameProfile'|'climate'>):number {const tick=typeof input==='number'?input:input.tick;return (typeof input==='number'?21+7*Math.cos(2*Math.PI*(input%TICKS_PER_DAY/TICKS_PER_DAY+.32)):seasonalOutdoorTemperature(input))+heatwaveOffset(tick,typeof input==='number'?undefined:activeHeatwave(input))+(typeof input==='number'?0:coldSnapOffset(input));}
const contexts=new WeakMap<World,ThermalTopologyCache>();
export function thermalLayout(world:World):ThermalLayout {
  let cache=contexts.get(world);if(!cache){cache=new ThermalTopologyCache();contexts.set(world,cache);}return cache.read(world);
}
const sameCells=(a:number[],b:number[])=>a===b||a.length===b.length&&a.every((v,i)=>v===b[i]);

/** Cells, not a transient room ID, carry the thermal history across save/rebuild.
 * A split inherits its old air; merging mixes by overlapping air-cell volume. */
export function reconcileTemperature(world:World,layout=thermalLayout(world)):ThermalLayout {
  const old=world.thermal?.regions??[];
  if(old.length===layout.rooms.length&&old.every((r,i)=>sameCells(r.cells,layout.rooms[i]!.cells)))return layout;
  if(!layout.rooms.length){delete world.thermal;return layout;}
  const previous=new Map<number,number>();for(const r of old)for(const i of r.cells)previous.set(i,r.temperature);
  const outside=outdoorTemperature(world);
  world.thermal={regions:layout.rooms.map(r=>({cells:r.cells,temperature:r.cells.reduce((sum,i)=>sum+(previous.get(i)??outside),0)/r.cells.length}))};
  return layout;
}

/** One current cell, without allocating the all-cell view used by batch readers.
 * Read the original region lists on every call, including public in-place edits.
 * Reverse order preserves TemperatureView's last-write priority for overlaps. */
export function temperatureAt(world:World,cell:Cell):number {
  const index=cell.z*world.width+cell.x,regions=world.thermal?.regions;
  for(let i=(regions?.length??0)-1;i>=0;i--)if(regions![i]!.cells.includes(index))return regions![i]!.temperature;
  return outdoorTemperature(world);
}

export class TemperatureView {
  private temperatures?:Map<number,number>;
  /* Without a layout: region slot + 1 per cell (0: no region) and the region
   * temperatures read at construction, the same answers as a Map from cell to
   * temperature filled in region order (last region wins). The Map is kept
   * when a region cell is not an index of this map. */
  private slots?:Int32Array;private temps?:number[];
  private layout?:ThermalLayout;
  private regions:ThermalRegion[];
  readonly outside:number;
  constructor(world:World,layout?:ThermalLayout) {
    this.outside=outdoorTemperature(world);this.layout=layout;this.regions=world.thermal?.regions??[];
    if(!layout){
      const regions=this.regions,size=world.width*world.height;let valid=Number.isSafeInteger(size)&&size>=0;
      if(valid){
        const slots=new Int32Array(size),temps:number[]=[];
        fill:for(let k=0;k<regions.length;k++){const r=regions[k]!;temps.push(r.temperature);for(const i of r.cells){if(!(Number.isInteger(i)&&i>=0&&i<size)){valid=false;break fill;}slots[i]=k+1;}}
        if(valid){this.slots=slots;this.temps=temps;}
      }
      if(!valid){this.temperatures=new Map();for(const r of regions)for(const i of r.cells)this.temperatures.set(i,r.temperature);}
    }
  }
  at(world:Pick<World,'width'>,cell:Cell):number {
    const i=cell.z*world.width+cell.x;
    if(this.layout)return this.regions[this.layout.indices[i]!]?.temperature??this.outside;
    if(this.slots){const slot=this.slots[i];return slot?this.temps![slot-1]??this.outside:this.outside;}
    return this.temperatures!.get(i)??this.outside;
  }
}

/** Ten Core ticks per local step. Deterministic mean wall exchange, thin roofs
 * and door conductance; no weather, thick roofs or radiation physics implied. */
export function advanceTemperature(world:World,layout:ThermalLayout):void {
  const regions=world.thermal?.regions;if(!regions?.length){applyThermalSources(world,layout);advanceCoolers(world,layout,outdoorTemperature(world));return;}
  const outside=outdoorTemperature(world),previous=regions.map(r=>r.temperature);
  const air=(id:number)=>id>=0?previous[id]!:outside;
  for(let id=0;id<regions.length;id++) {
    const r=regions[id]!,shape=layout.rooms[id]!,difference=outside-r.temperature;
    if(shape.door)continue;
    const adjusted=Math.abs(difference)<100?difference:Math.sign(difference)*100+5*(difference-Math.sign(difference)*100);
    let change=adjusted*((1-shape.unroofed/r.cells.length)*.00005+shape.unroofed/r.cells.length*.0007)*10;
    for(const i of shape.equalize){const target=layout.indices[i]!;change+=((target===-2?(r.temperature+outside)/2:air(target))-r.temperature)*.00017*10/r.cells.length;}
    r.temperature=Math.max(-273.15,Math.min(1000,r.temperature+change));
  }
  // This call mutates air and cooler modes only. Preserve Array.find's first
  // matching ID, while avoiding a full structure scan for every portal. Never
  // retain this lookup across a call or a mutable public World edit.
  const structuresById=new Map<number,World['structures'][number]>();
  const wanted=new Set<number>();for(const door of layout.doors)if(door.neighbors.length>=2)wanted.add(door.id);
  if(wanted.size)for(const structure of world.structures)if(wanted.delete(structure.id)){
    structuresById.set(structure.id,structure);if(!wanted.size)break;
  }
  for(const door of layout.doors) {
    const neighbors=door.neighbors;if(!neighbors.length)continue;
    const mean=neighbors.reduce((n,id)=>n+(id<0?outside:regions[id]!.temperature),0)/neighbors.length;
    const own=layout.indices[door.cell]!;if(own>=0)regions[own]!.temperature=mean;
    if(neighbors.length<2)continue;
    const open=structuresById.get(door.id)!.door!.open,rate=10/(open?34:375);
    for(const id of neighbors)if(id>=0){const r=regions[id]!;r.temperature+=(mean-r.temperature)*Math.min(1,rate/r.cells.length);}
  }
  // Core also exchanges through walls for a doorway without an adjacent
  // ordinary air region. Apply after the portal mean so it cannot erase heat.
  for(let id=0;id<regions.length;id++)if(layout.rooms[id]!.isolatedDoor) {
    const r=regions[id]!,temperature=r.temperature;let change=0;
    for(const i of layout.rooms[id]!.equalize){const target=layout.indices[i]!;change+=((target===-2?(temperature+outside)/2:air(target))-temperature)*.00017*10;}
    r.temperature=Math.max(-273.15,Math.min(1000,temperature+change));
  }
  advanceVents(world,layout,outside);
  applyThermalSources(world,layout);
  advanceCoolers(world,layout,outside);
}
