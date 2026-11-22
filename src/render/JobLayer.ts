import {shipComputerSensorsModelBounds298} from './ship-computer-sensors-parts298';
import {SHIP_CASKET_MODEL_BOUNDS_277} from './ship-casket-parts277';
import { knownCell256 } from '../sim/exploration-visibility-256';
import {isShipAddedKind276} from '../sim/ship-part-content-276';
import {SHIP_HULL_MODEL_BOUNDS_276} from './ship-hull-parts276';
import { isFoodWorkstation } from '../sim/food-workstations';
import type * as THREE from 'three/webgpu';
import { isRoofJob } from '../sim/roof-rules';
import type { BoxBatches } from './BoxBatches';
import type { Placement } from './primitives';
import type { World, Job } from '../sim/types';
import { footprintCells, STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { jobDuration } from '../sim/farming';
import { WORLD_SCALE } from '../world/scale';
import { hasDesignationPictogram } from './DesignationIconLayer';
import { buildingMaterialColor } from './building-material-color';
import { constructionGhostSpec, type ConstructionGhosts } from './construction-ghosts';
import type { ConstructionPreviewPlacement, ConstructionPreviewSpec } from './construction-preview-parts';

/** Ghosts are produced from the World that owns their context (the physical
 * World, or the executed World under confirmed intentions). */
interface JobMarkerParts {orders:Placement[];intentSolids:Placement[];frames:Placement[];progress:Placement[];
  ghosts:{world?:World;specs:ConstructionPreviewSpec[];outline:ConstructionPreviewPlacement[]}}
/** Core Frame.DrawAt: four corner marks of min(width,length)*0.38 inside the
 * footprint, then ceil(percent*width*length*4) half-cell tiles laid row by row
 * from the lower corner (here at floor level, under the ghost). */
function frameMarks(job:Job,cells:readonly {x:number;z:number}[],percent:number|undefined,frame:boolean,frames:Placement[],progress:Placement[]):void {
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const c of cells){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x);minZ=Math.min(minZ,c.z);maxZ=Math.max(maxZ,c.z);}
  const width=maxX-minX+1,length=maxZ-minZ+1,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,color=buildingMaterialColor(job.material,FRAME_WOOD)??FRAME_WOOD;
  if(frame){
    const size=Math.min(width,length)*.38,bar=.07;
    for(const dx of [-1,1])for(const dz of [-1,1]){
      const ox=cx+dx*(width/2-size/2),oz=cz+dz*(length/2-size/2);
      frames.push({targetId:job.id,x:ox,z:oz+dz*(size-bar)/2,y:FRAME_MARK_Y,sx:size,sy:.016,sz:bar,color});
      frames.push({targetId:job.id,x:ox+dx*(size-bar)/2,z:oz,y:FRAME_MARK_Y,sx:bar,sy:.016,sz:size,color});
    }
  }
  if(!percent||percent<=0)return;
  const columns=width*2,count=Math.min(columns*length*2,Math.ceil(percent*width*length*4));
  for(let j=0;j<count;j++){
    const row=Math.floor(j/columns),column=j-row*columns;
    progress.push({targetId:job.id,x:minX-.25+column*.5,z:minZ-.25+row*.5,y:FRAME_TILE_Y,sx:.44,sy:.012,sz:.44,color});
  }
}
/** Above a laid floor and the lifted floor ghost, under every furniture base. */
const FRAME_TILE_Y=.08,FRAME_MARK_Y=.088,FRAME_WOOD=0xb59b74;
/** Physical World is absent for intent-only production. No work clock or
 * progress is consulted in that branch, even when immutable records are shared. */
function readJobMarkerParts(jobs:readonly Job[],cutaway:boolean,physical?:World,visibility?:World):JobMarkerParts {
    const wallHeight = cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight;
    const orders: Placement[] = [], intentSolids:Placement[]=[], frames: Placement[] = [], progress: Placement[] = [];
    const ghostWorld=physical??visibility,specs:ConstructionPreviewSpec[]=[],outline:ConstructionPreviewPlacement[]=[];
    for (const job of jobs.filter(j=>!isRoofJob(j))) {
      // Mechanical faults have their own compact mark on the appliance.
      if(job.kind==='fix-breakdown')continue;
      const cells = footprintCells(job);
      if(!physical&&visibility&&!cells.every(cell=>knownCell256(visibility,cell.z*visibility.width+cell.x)))continue;
      const future=job.wallDoor296?.plan;
      if(future){
        // The future door owns a ghost frame around the standing wall: the
        // door model itself would hide inside the wall it replaces.
        const height=wallHeight+.12;
        for(const dx of [-.53,.53])outline.push({key:future.id,x:job.x+dx,z:job.z,y:height/2,sx:.08,sy:height,sz:.2,color:0xa7dbc9});
        outline.push({key:future.id,x:job.x,z:job.z,y:height,sx:1.14,sy:.08,sz:.2,color:0xa7dbc9});
      }
      // A placed construction is shown by the ghost of what it builds, like
      // the placement cursor, never by a tinted cell.
      if(constructsSomething(job)){
        const ghost=ghostWorld&&job.wallDoor296?.manual!==false?constructionGhostSpec(job,ghostWorld):undefined;
        if(ghost)specs.push(ghost);
        if(physical)frameMarks(job,cells,job.progress/jobDuration(physical,job),job.construction==='frame',frames,progress);
        continue;
      }
      // Automatic sowing is not a player designation. Explicit order icons
      // already identify their targets; neither needs a selection-like floor.
      if(job.wallDoor296?.manual!==false&&job.kind!=='sow'&&!hasDesignationPictogram(job.kind))for (const cell of cells) orders.push({ targetId:job.id, x: cell.x, y: 0.032, z: cell.z, color: physical&&job.status === 'active' ? 0xe7c17a : 0x99cfc3 });
      if(job.kind==='repair'||job.kind==='flick')continue;
      if(job.kind==='remove-bridge'){
        for(const ry of [-Math.PI/4,Math.PI/4])intentSolids.push({targetId:job.id,x:job.x,z:job.z,y:.1,sx:.85,sy:.025,sz:.05,ry,color:0xd77855});
        continue;
      }
      if(job.kind==='remove-floor'){
        for(const cell of cells)for(const ry of [-Math.PI/4,Math.PI/4])intentSolids.push({targetId:job.id,x:cell.x,z:cell.z,y:.13,sx:.8,sy:.025,sz:.05,ry,color:0xd77855});
        continue;
      }
      if(job.kind==='deconstruct'||job.kind==='uninstall') {
        if(job.wallDoor296?.manual===false)continue;
        const targetKind=(job.deconstruction??job.furniture)!.kind;
        const targetBounds=shipComputerSensorsModelBounds298(targetKind);
        const y=(targetBounds?targetBounds.height:targetKind==='ship-cryptosleep-casket'?SHIP_CASKET_MODEL_BOUNDS_277.height:isShipAddedKind276(targetKind)?SHIP_HULL_MODEL_BOUNDS_276[targetKind].height:targetKind==='ship-reactor'?3.10:targetKind==='cryptosleep-casket'?.80:targetKind==='fueled-smithy'?1.665:targetKind==='electric-smithy'?1.57:targetKind==='brewery'?1.35:targetKind==='fermenting-barrel'?1.09:targetKind==='geothermal-generator'?2.70:targetKind==='bedroll'?.19:targetKind==='torch-lamp'?1.1:targetKind==='firefoam-popper'?.97:targetKind==='spike-trap'?.625:targetKind==='electric-crematorium'?1.56:targetKind==='electric-smelter'?1.32:targetKind==='biofuel-refinery'?1.69:targetKind==='chemfuel-generator'?1.75:targetKind==='vitals-monitor'?1.14:targetKind==='mini-turret'?1.18:targetKind==='tube-television'?.81:targetKind==='sandbags'?.66:(isFoodWorkstation(targetKind)||targetKind==='machining-table'||targetKind==='hi-tech-research-bench'||targetKind==='fabrication-bench'||targetKind==='multi-analyzer'||targetKind==='drug-lab'||targetKind==='art-bench'||targetKind==='research-bench'||targetKind==='tailor-bench'||targetKind==='stonecutter')?WORLD_SCALE.stonecutterHeight:(targetKind==='vent'||targetKind==='wall'||targetKind==='cooler')?wallHeight:targetKind==='table'||targetKind==='chess-table'?WORLD_SCALE.tableHeight:targetKind==='horseshoes'?WORLD_SCALE.horseshoeHeight:targetKind==='stool'?WORLD_SCALE.stoolHeight:WORLD_SCALE.bedSurfaceHeight)+.06;
        for(const cell of cells)for(const ry of [-Math.PI/4,Math.PI/4])intentSolids.push({targetId:job.id,x:cell.x,z:cell.z,y,sx:.85,sy:.05,sz:.08,ry,color:job.kind==='uninstall'?0xd9b66c:0xd77855});
      }
    }
    return {orders,intentSolids,frames,progress,ghosts:{world:ghostWorld,specs,outline}};
  }
/** Orders that build something: a building (or the installed one), a floor
 * or a bridge. They are drawn by their ghost and never tint their cells. */
function constructsSomething(job:Job):boolean {
  return job.kind==='lay-floor'||job.kind==='build-bridge'||job.kind==='install'||Object.hasOwn(STRUCTURE_DEFINITIONS,job.kind);
}

function writeJobMarkers(parts:JobMarkerParts,group:THREE.Group,batches:BoxBatches,ghosts?:ConstructionGhosts,cutaway=false):void {
    const {orders,intentSolids,frames,progress}=parts;
    batches.set(group, 'job-orders', orders.map(p => ({ ...p, sx: 0.9, sy: 0.025, sz: 0.9 })), 'overlay', false);
    batches.set(group, 'job-solids', [...intentSolids.map(p=>({...p,color:p.color??0x9f7e52})),...frames.map(p => ({ ...p, color: p.color??0x9f7e52 })), ...progress.map(p => ({ ...p, color: p.color??0xa6916e }))]);
    ghosts?.present(parts.ghosts.world,parts.ghosts.specs,parts.ghosts.outline,cutaway);
  }

/** Public callers retain the historical full-world behavior. */
export function buildJobMarkers(world:World,group:THREE.Group,cutaway:boolean,batches:BoxBatches,ghosts?:ConstructionGhosts):void {
  writeJobMarkers(readJobMarkerParts(world.jobs,cutaway,world),group,batches,ghosts,cutaway);
}

/** Two CPU responsibilities, the same three resident GPU batches/materials. */
export class ConfirmedJobMarkers {
  private intentions=readJobMarkerParts([],false);
  private physical=readJobMarkerParts([],false);
  private active=new Set<number>();
  private cutaway=false;
  updatePhysical(world:World,cutaway:boolean):void {
    this.physical=readJobMarkerParts(world.jobs,cutaway,world);
    this.active=new Set(world.jobs.filter(job=>job.status==='active').map(job=>job.id));
  }
  clear():void {this.intentions=readJobMarkerParts([],false);this.physical=readJobMarkerParts([],false);this.active.clear();}
  updateIntentions(jobs:readonly Job[],cutaway:boolean,executed?:World):void {
    this.intentions=readJobMarkerParts(jobs,cutaway,undefined,executed);this.cutaway=cutaway;
  }
  /** Ghosts follow the intentions (a new order shows at once), frame marks
   * and progress the physical World. */
  present(group:THREE.Group,batches:BoxBatches,ghosts?:ConstructionGhosts):void {
    const plans=this.intentions;
    writeJobMarkers({orders:plans.orders.map(p=>({...p,color:this.active.has(p.targetId!)?0xe7c17a:0x99cfc3})),
      intentSolids:plans.intentSolids,frames:this.physical.frames,
      progress:this.physical.progress,ghosts:plans.ghosts},group,batches,ghosts,this.cutaway);
  }
}
