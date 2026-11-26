import type { ConstructionMaterial } from './construction-materials.ts';
import type { Job } from './types.ts';

export interface WallDoorPlan296 { revision:1; id:number; kind:'door'|'autodoor'; material:ConstructionMaterial; forbidden379?:true }
export interface WallDoorState296 { manual:boolean; plan?:WallDoorPlan296; fromBlueprint?:true }

/** The future identity is reserved at designation, but owns no delivered goods. */
export function wallDoorBlueprint296(job:Job):Job|undefined {
  const plan=job.wallDoor296?.plan;if(!plan)return;
  return {id:plan.id,kind:plan.kind,material:plan.material,x:job.x,z:job.z,
    orientation:job.orientation,footprint:job.footprint,construction:'blueprint',
    progress:0,status:'pending',reservedBy:null,escrow:{wood:0,food:0},...plan.forbidden379?{forbidden379:true}:{}};
}
export const wallDoorHasIntent296=(job:Job):boolean=>!job.wallDoor296||job.wallDoor296.manual||!!job.wallDoor296.plan&&!job.wallDoor296.plan.forbidden379;
export const wallDoorImplicitOrphan296=(job:Job):boolean=>!!job.wallDoor296&&!job.wallDoor296.manual&&!job.wallDoor296.plan;

/** Assignment provenance belongs to this execution, never to a queued claim. */
export function startWallDoorWork296(job:Job):void {
  if(job.wallDoor296?.plan)job.wallDoor296.fromBlueprint=true;
}
