import {shipComputerSensorsModelBounds298} from './ship-computer-sensors-parts298';
import {joyTableModelBounds354} from './joy-table-parts354';
import {SHIP_CASKET_MODEL_BOUNDS_277} from './ship-casket-parts277';
import { knownCell256 } from '../sim/exploration-visibility-256';
import {isShipAddedKind276} from '../sim/ship-part-content-276';
import {SHIP_HULL_MODEL_BOUNDS_276} from './ship-hull-parts276';
import { isFoodWorkstation } from '../sim/food-workstations';
import { isBedKind } from '../sim/bed-kinds';
import type * as THREE from 'three/webgpu';
import { isRoofJob } from '../sim/roof-rules';
import type { BoxBatches } from './BoxBatches';
import type { Placement } from './primitives';
import type { World, Job } from '../sim/types';
import { footprintCells } from '../sim/definitions';
import { jobDuration } from '../sim/farming';
import { WORLD_SCALE } from '../world/scale';
import { hasDesignationPictogram, isIconDesignationKind } from './DesignationIconLayer';

interface JobMarkerParts {orders:Placement[];blueprints:Placement[];intentSolids:Placement[];frames:Placement[];progress:Placement[]}
/** Physical World is absent for intent-only production. No work clock or
 * progress is consulted in that branch, even when immutable records are shared. */
function readJobMarkerParts(jobs:readonly Job[],cutaway:boolean,physical?:World,visibility?:World):JobMarkerParts {
    const wallHeight = cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight;
    const orders: Placement[] = [], blueprints: Placement[] = [], intentSolids:Placement[]=[], frames: Placement[] = [], progress: Placement[] = [];
    for (const job of jobs.filter(j=>!isRoofJob(j))) {
      // Mechanical faults have their own compact mark on the appliance.
      if(job.kind==='fix-breakdown')continue;
      const cells = footprintCells(job);
      if(!physical&&visibility&&!cells.every(cell=>knownCell256(visibility,cell.z*visibility.width+cell.x)))continue;
      const future=job.wallDoor296?.plan;
      if(future){
        // The future identity owns this wire outline, never the standing wall.
        // Three placements reuse the resident plan batch and remain visible
        // around the actual wall without borrowing its roof support.
        const height=wallHeight+.12;
        for(const dx of [-.53,.53])blueprints.push({targetId:future.id,x:job.x+dx,z:job.z,y:height/2,sx:.08,sy:height,sz:.2});
        blueprints.push({targetId:future.id,x:job.x,z:job.z,y:height,sx:1.14,sy:.08,sz:.2});
      }
      // Automatic sowing is not a player designation. Explicit order icons
      // already identify their targets; neither needs a selection-like floor.
      if(job.wallDoor296?.manual!==false&&job.kind!=='sow'&&!hasDesignationPictogram(job.kind))for (const cell of cells) orders.push({ targetId:job.id, x: cell.x, y: 0.032, z: cell.z, color: physical&&job.status === 'active' ? 0xe7c17a : 0x99cfc3 });
      if(job.kind==='repair'||job.kind==='flick')continue;
      if(job.kind==='build-bridge'||job.kind==='remove-bridge'){
        blueprints.push({targetId:job.id,x:job.x,z:job.z,y:.075,sx:.94,sy:.04,sz:.94});
        if(job.kind==='remove-bridge')for(const ry of [-Math.PI/4,Math.PI/4])intentSolids.push({targetId:job.id,x:job.x,z:job.z,y:.1,sx:.85,sy:.025,sz:.05,ry,color:0xd77855});
        else if(physical&&job.construction==='frame'){
          for(const dz of [-.4,.4])frames.push({targetId:job.id,x:job.x,z:job.z+dz,y:.025,sx:1,sy:.04,sz:.08});
          const fraction=Math.floor(job.progress/jobDuration(physical!,job)*20)/20;
          if(fraction>0)progress.push({targetId:job.id,x:job.x-.5+fraction/2,z:job.z,y:.05,sx:fraction,sy:.025,sz:.92});
        }
        continue;
      }
      if(job.kind==='lay-floor'||job.kind==='remove-floor'||job.kind==='grave'){
        for(const cell of cells){blueprints.push({targetId:job.id,x:cell.x,z:cell.z,y:.09,sx:.94,sy:.08,sz:.94});
          if(job.kind==='remove-floor')for(const ry of [-Math.PI/4,Math.PI/4])intentSolids.push({targetId:job.id,x:cell.x,z:cell.z,y:.13,sx:.8,sy:.025,sz:.05,ry,color:0xd77855});}
        continue;
      }
      // Tree intentions use their actual-source billboard, never a building cube.
      if(isIconDesignationKind(job.kind)||job.kind==='smooth-floor'||job.kind === 'sow')continue;
      if(job.kind==='deconstruct'||job.kind==='uninstall') {
        if(job.wallDoor296?.manual===false)continue;
        const targetKind=(job.deconstruction??job.furniture)!.kind;
        const targetBounds=shipComputerSensorsModelBounds298(targetKind);
        const y=(targetBounds?targetBounds.height:targetKind==='ship-cryptosleep-casket'?SHIP_CASKET_MODEL_BOUNDS_277.height:isShipAddedKind276(targetKind)?SHIP_HULL_MODEL_BOUNDS_276[targetKind].height:targetKind==='ship-reactor'?3.10:targetKind==='cryptosleep-casket'?.80:targetKind==='fueled-smithy'?1.665:targetKind==='electric-smithy'?1.57:targetKind==='brewery'?1.35:targetKind==='fermenting-barrel'?1.09:targetKind==='geothermal-generator'?2.70:targetKind==='bedroll'?.19:targetKind==='torch-lamp'?1.1:targetKind==='firefoam-popper'?.97:targetKind==='spike-trap'?.625:targetKind==='electric-crematorium'?1.56:targetKind==='electric-smelter'?1.32:targetKind==='biofuel-refinery'?1.69:targetKind==='chemfuel-generator'?1.75:targetKind==='vitals-monitor'?1.14:targetKind==='mini-turret'?1.18:targetKind==='tube-television'?.81:targetKind==='sandbags'?.66:(isFoodWorkstation(targetKind)||targetKind==='machining-table'||targetKind==='hi-tech-research-bench'||targetKind==='fabrication-bench'||targetKind==='multi-analyzer'||targetKind==='drug-lab'||targetKind==='art-bench'||targetKind==='research-bench'||targetKind==='tailor-bench'||targetKind==='stonecutter')?WORLD_SCALE.stonecutterHeight:(targetKind==='vent'||targetKind==='wall'||targetKind==='cooler')?wallHeight:targetKind==='table'||targetKind==='chess-table'?WORLD_SCALE.tableHeight:targetKind==='horseshoes'?WORLD_SCALE.horseshoeHeight:targetKind==='stool'?WORLD_SCALE.stoolHeight:WORLD_SCALE.bedSurfaceHeight)+.06;
        for(const cell of cells)for(const ry of [-Math.PI/4,Math.PI/4])intentSolids.push({targetId:job.id,x:cell.x,z:cell.z,y,sx:.85,sy:.05,sz:.08,ry,color:job.kind==='uninstall'?0xd9b66c:0xd77855});
        continue;
      }
      const kind=job.furniture?.kind??job.kind;
      const x=cells.reduce((n,c)=>n+c.x,0)/cells.length,z=cells.reduce((n,c)=>n+c.z,0)/cells.length,ry=job.orientation*Math.PI/2;
      const bounds=shipComputerSensorsModelBounds298(kind)??joyTableModelBounds354(kind);
      const height = bounds?bounds.height:kind==='ship-cryptosleep-casket'?SHIP_CASKET_MODEL_BOUNDS_277.height:isShipAddedKind276(kind)?SHIP_HULL_MODEL_BOUNDS_276[kind].height:kind==='ship-reactor'?3.10:kind==='cryptosleep-casket'?.80:kind==='fueled-smithy'?1.665:kind==='electric-smithy'?1.57:kind==='brewery'?1.35:kind==='fermenting-barrel'?1.09:kind==='geothermal-generator'?2.70:kind==='bedroll'?.19:kind==='torch-lamp'?.9:kind==='firefoam-popper'?.97:kind==='spike-trap'?.625:kind==='ied-high-explosive'||kind==='ied-incendiary'?.44:kind==='electric-crematorium'?1.56:kind==='electric-smelter'?1.32:kind==='biofuel-refinery'?1.69:kind==='chemfuel-generator'?1.75:kind==='vitals-monitor'?1.14:kind==='mini-turret'?1.18:kind==='tube-television'?.81:kind==='sandbags'?.66:kind==='solar-generator'?.56:kind==='power-conduit'?.08:kind==='power-switch'?.44:kind==='battery'?1.1:kind==='multi-analyzer'?1.56:(isFoodWorkstation(kind)||kind==='machining-table'||kind==='hi-tech-research-bench'||kind==='fabrication-bench'||kind==='drug-lab'||kind==='art-bench'||kind==='research-bench'||kind==='tailor-bench'||kind==='stonecutter')?WORLD_SCALE.stonecutterHeight:kind === 'horseshoes' ? WORLD_SCALE.horseshoeHeight : (kind==='vent'||kind === 'wall'||kind==='cooler') ? wallHeight : kind === 'table'||kind==='chess-table' ? WORLD_SCALE.tableHeight : kind === 'stool' ? WORLD_SCALE.stoolHeight : WORLD_SCALE.bedSurfaceHeight;
      const width = bounds?bounds.width:kind==='ship-cryptosleep-casket'?SHIP_CASKET_MODEL_BOUNDS_277.width:isShipAddedKind276(kind)?SHIP_HULL_MODEL_BOUNDS_276[kind].width:kind==='ship-reactor'?5.86:kind==='cryptosleep-casket'?.88:kind==='fueled-smithy'||kind==='electric-smithy'?2.88:kind==='brewery'?2.86:kind==='fermenting-barrel'?.81:kind==='geothermal-generator'?5.88:kind==='torch-lamp'?.45:kind==='firefoam-popper'?.70:kind==='spike-trap'?.83:kind==='double-bed'?1.84:kind==='electric-crematorium'?2.84:kind==='electric-smelter'?2.84:kind==='biofuel-refinery'?2.86:kind==='chemfuel-generator'?1.86:kind==='vitals-monitor'?.78:kind==='mini-turret'?.87:kind==='tube-television'?.84:kind==='sandbags'?.94:kind==='solar-generator'?3.9:kind==='power-conduit'?.18:kind==='power-switch'?.7:kind==='battery'?.86:kind==='hi-tech-research-bench'||kind==='fabrication-bench'?4.85:kind==='multi-analyzer'?1.86:(isFoodWorkstation(kind)||kind==='machining-table'||kind==='drug-lab'||kind==='art-bench'||kind==='research-bench'||kind==='tailor-bench'||kind==='stonecutter')?WORLD_SCALE.stonecutterWidth:kind === 'horseshoes' ? 0.12 : (kind==='vent'||kind === 'wall'||kind==='cooler'||kind==='chess-table') ? 0.92 : kind === 'table' ? WORLD_SCALE.tableWidth : kind === 'stool' ? WORLD_SCALE.stoolWidth : WORLD_SCALE.bedWidth;
      const length = bounds?bounds.depth:kind==='ship-cryptosleep-casket'?SHIP_CASKET_MODEL_BOUNDS_277.depth:isShipAddedKind276(kind)?SHIP_HULL_MODEL_BOUNDS_276[kind].depth:kind==='ship-reactor'?6.86:kind==='cryptosleep-casket'?1.88:kind==='fueled-smithy'||kind==='electric-smithy'?.92:kind==='brewery'?.87:kind==='fermenting-barrel'?.81:kind==='geothermal-generator'?5.88:kind==='torch-lamp'?.45:kind==='firefoam-popper'?.70:kind==='spike-trap'?.83:kind==='electric-crematorium'?1.84:kind==='electric-smelter'?.84:kind==='biofuel-refinery'||kind==='chemfuel-generator'?1.86:kind==='vitals-monitor'?.60:kind==='mini-turret'?.87:kind==='tube-television'?.72:kind==='solar-generator'?3.9:kind==='power-conduit'?.18:kind==='power-switch'?.7:kind==='battery'?1.83:kind==='hi-tech-research-bench'||kind==='fabrication-bench'||kind==='multi-analyzer'?1.84:kind==='research-bench'?1.8:(isFoodWorkstation(kind)||kind==='machining-table'||kind==='drug-lab'||kind==='art-bench'||kind==='tailor-bench'||kind==='stonecutter')?WORLD_SCALE.stonecutterDepth:kind === 'horseshoes' ? 0.12 : kind === 'table' ? WORLD_SCALE.tableLength : kind === 'stool' ? WORLD_SCALE.stoolWidth : isBedKind(kind) && job.footprint !== 'legacy-single' ? WORLD_SCALE.bedLength : 0.92;
      blueprints.push({ targetId:job.id, x, z, y: height / 2, sx: width, sy: height, sz: length, ry });
      if (physical&&job.construction === 'frame') {
        // Four low corner posts distinguish a supplied frame from a bare plan.
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
          const lx = dx * (width / 2 - 0.06), lz = dz * (length / 2 - 0.06);
          frames.push({ targetId:job.id, x: x + lx * Math.cos(ry) + lz * Math.sin(ry), z: z + lz * Math.cos(ry) - lx * Math.sin(ry), y: 0.2, sx: 0.09, sy: 0.4, sz: 0.09 });
        }
      }
      const fraction = physical?Math.floor(job.progress / jobDuration(physical,job) * 20) / 20:0;
      if (fraction > 0) progress.push({ targetId:job.id, x, z, y: height * fraction / 2, sx: width - 0.06, sy: height * fraction, sz: length - 0.06, ry });
    }
    return {orders,blueprints,intentSolids,frames,progress};
  }

function writeJobMarkers(parts:JobMarkerParts,group:THREE.Group,batches:BoxBatches):void {
    const {orders,blueprints,intentSolids,frames,progress}=parts;
    batches.set(group, 'job-orders', orders.map(p => ({ ...p, sx: 0.9, sy: 0.025, sz: 0.9 })), 'overlay', false);
    batches.set(group, 'job-plans', blueprints.map(p => ({ ...p, color: 0xa7dbc9 })), 'wire', false);
    batches.set(group, 'job-solids', [...intentSolids.map(p=>({...p,color:p.color??0x9f7e52})),...frames.map(p => ({ ...p, color: p.color??0x9f7e52 })), ...progress.map(p => ({ ...p, color: 0xa6916e }))]);
  }

/** Public callers retain the historical full-world behavior. */
export function buildJobMarkers(world:World,group:THREE.Group,cutaway:boolean,batches:BoxBatches):void {
  writeJobMarkers(readJobMarkerParts(world.jobs,cutaway,world),group,batches);
}

/** Two CPU responsibilities, the same three resident GPU batches/materials. */
export class ConfirmedJobMarkers {
  private intentions=readJobMarkerParts([],false);
  private physical=readJobMarkerParts([],false);
  private active=new Set<number>();
  updatePhysical(world:World,cutaway:boolean):void {
    this.physical=readJobMarkerParts(world.jobs,cutaway,world);
    this.active=new Set(world.jobs.filter(job=>job.status==='active').map(job=>job.id));
  }
  clear():void {this.intentions=readJobMarkerParts([],false);this.physical=readJobMarkerParts([],false);this.active.clear();}
  updateIntentions(jobs:readonly Job[],cutaway:boolean,executed?:World):void {
    this.intentions=readJobMarkerParts(jobs,cutaway,undefined,executed);
  }
  present(group:THREE.Group,batches:BoxBatches):void {
    const plans=this.intentions;
    writeJobMarkers({orders:plans.orders.map(p=>({...p,color:this.active.has(p.targetId!)?0xe7c17a:0x99cfc3})),
      blueprints:plans.blueprints,intentSolids:plans.intentSolids,frames:this.physical.frames,
      progress:this.physical.progress},group,batches);
  }
}
