import { footprintCells, footprintContains } from './definitions.ts';
import type { Cell, World } from './types.ts';
import {captureFrameGeometry379} from './frame-geometry-379.ts';

// Reference frame pathCost 14 Core ticks, converted to the local 10 Hz clock.
export const FRAME_TRAVEL_DELAY=1.4;
export const FRAME_SEARCH_COST=467; // 1.4 / 3 * 1000, rounded only for search.
export function frameAt(world: World, cell: Cell): boolean {
  const frames=captureFrameGeometry379(world);
  if(frames&&Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height)return frames.byCell.has(cell.z*world.width+cell.x);
  return world.jobs.some(j=>j.construction==='frame'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge'&&footprintContains(j,cell));
}
/** Sparse snapshot owned by this synchronous search, never cached across ticks. */
export function frameCosts(world: World): ReadonlyMap<number,number>|undefined {
  const frames=captureFrameGeometry379(world);if(frames){let costs=ownedFrameCosts.get(frames);if(!costs){const created=new Map<number,number>();for(const i of frames.byCell.keys())created.set(i,FRAME_SEARCH_COST);costs=created;ownedFrameCosts.set(frames,costs);}return costs.size?costs:undefined;}
  let costs:Map<number,number>|undefined;
  for(const job of world.jobs)if(job.construction==='frame'&&job.kind!=='lay-floor'&&job.kind!=='build-bridge') {
    costs??=new Map();for(const c of footprintCells(job))costs.set(c.z*world.width+c.x,FRAME_SEARCH_COST);
  }
  return costs;
}
const ownedFrameCosts=new WeakMap<object,ReadonlyMap<number,number>>();
