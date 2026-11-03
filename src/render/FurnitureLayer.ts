import {cryptosleepParts271} from './cryptosleep-parts-271';
import {smithyParts267} from './smithy-parts267';
import {brewingParts265} from './brewing-parts265';
import {ancientCasketParts256} from './ancient-casket-parts-256';
import {shipChunkParts256} from './ship-chunk-parts-256';
import {ancientMonumentParts256} from './ancient-monument-parts-256';
import {localRoadPropParts256} from './local-road-prop-parts-256';
import {bedrollParts,packedBedrollParts} from './bedroll-parts';
import {ventParts} from './vent-parts';
import { foodWorkstationParts } from './food-workstation-parts';
import { graveParts } from './grave-parts';
import { electricalParts } from './electrical-parts';
import { passiveCoolerParts } from './passive-cooler-parts';
import { doorParts } from './door-parts';
import { pileSurfaces } from './pile-surfaces';
import { buildingMaterialColor } from './building-material-color';
import type * as THREE from 'three/webgpu';
import type { BoxBatches } from './BoxBatches';
import type { World } from '../sim/types';
import { recreationParts } from './recreation-parts';
import { campfireParts } from './campfire-parts';
import { torchLampParts } from './torch-lamp-parts';
import { researchTailorParts } from './research-tailor-parts';
import { industryParts } from './industry-parts';
import { hospitalBedParts } from './hospital-bed-parts';
import { hydroponicsParts } from './hydroponics-parts';
import { sandbagParts } from './sandbag-parts';
import { miniTurretBaseParts } from './mini-turret-parts';
import {animalSleepingSpotParts} from './animal-sleeping-spot-parts';
import {sleepingSpotParts} from './sleeping-spot-parts';
import { craftingSpotParts } from './crafting-spot-parts';
import { stonecutterParts } from './stonecutter-parts';
import { footprintCells } from '../sim/definitions';
import { habitatParts, habitatPartsForStructure } from './habitat-parts';
import { sunLampActive } from '../sim/sun-lamp';
import { ColorManagement } from 'three/webgpu';
import { artParts } from './art-parts';
import { drugLabParts } from './drug-lab-parts';
import { vitalsMonitorParts } from './vitals-monitor-parts';
import { deepDrillingParts } from './deep-drilling-parts';
import { orbitalParts } from './orbital-parts';
import { nutrientPasteParts } from './nutrient-paste-parts';
import { biofuelParts } from './biofuel-parts';
import {smeltingParts} from './smelting-parts';
import {doubleBedParts} from './double-bed-parts';
import {crematoriumParts} from './crematorium-parts';
import {firefoamParts290} from './firefoam-parts-290';
import {spikeTrapParts} from './spike-trap-parts';
import { penParts } from './pen-parts';
import { WORLD_SCALE } from '../world/scale';
import type { Placement } from './primitives';

/** Procedural furniture batches rebuilt only when structure content changes. */
export function buildFurniture(world: World, group: THREE.Group, cutaway: boolean, batches: BoxBatches, contextWorld:World=world): void {
    const wallHeight = cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight;
    const walls: Placement[] = [], wallCaps: Placement[] = [], bedFrames: Placement[] = [], bedding: Placement[] = [], pillows: Placement[] = [], headboards: Placement[] = [], woodParts: Placement[] = [];
    for (const structure of world.structures) {
      const { x, z } = structure;
      const color = buildingMaterialColor(structure.material);
      if (structure.kind === 'wall') {
        // The timber batch supplies its own planks and overhanging trim.
        if (structure.material === 'wood') continue;
        walls.push({ targetId:structure.id, x, z, color, y: (wallHeight - 0.09) / 2 }); wallCaps.push({ targetId:structure.id, x, z, color, y: wallHeight - 0.045 });
      } else if (structure.kind === 'bed') {
        const cells = footprintCells(structure), last = cells[cells.length - 1]!;
        const cx = (x + last.x) / 2, cz = (z + last.z) / 2, ry = structure.orientation * Math.PI / 2;
        const length = structure.footprint === 'legacy-single' ? 0.93 : WORLD_SCALE.bedLength;
        bedFrames.push({ targetId:structure.id, color, x: cx, z: cz, y: WORLD_SCALE.bedFrameHeight / 2 + 0.04, sx: WORLD_SCALE.bedWidth, sy: WORLD_SCALE.bedFrameHeight, sz: length, ry });
        bedding.push({ targetId:structure.id, color:structure.medical?0x91c2d2:0xc7a977, x: cx, z: cz, y: WORLD_SCALE.bedSurfaceHeight - 0.045, sx: WORLD_SCALE.bedWidth - 0.06, sy: 0.14, sz: length - 0.1, ry });
        pillows.push({ targetId:structure.id, x: cx - Math.sin(ry) * length * 0.33, z: cz - Math.cos(ry) * length * 0.33, y: WORLD_SCALE.bedSurfaceHeight + 0.07, sx: 0.6, sy: 0.12, sz: 0.27, ry });
        headboards.push({ targetId:structure.id, color, x: cx - Math.sin(ry) * (length / 2 - 0.05), z: cz - Math.cos(ry) * (length / 2 - 0.05), y: 0.35, sx: WORLD_SCALE.bedWidth, sy: 0.63, sz: 0.08, ry });
      }
    }
    for (const structure of world.structures) {
      if (structure.kind !== 'table' && structure.kind !== 'stool') continue;
      const table = structure.kind === 'table';
      const color = buildingMaterialColor(structure.material,0xa38559);
      const cells = footprintCells(structure), last = cells[cells.length - 1]!;
      const x = (structure.x + last.x) / 2, z = (structure.z + last.z) / 2, ry = structure.orientation * Math.PI / 2;
      const width = table ? WORLD_SCALE.tableWidth : WORLD_SCALE.stoolWidth;
      const length = table ? WORLD_SCALE.tableLength : WORLD_SCALE.stoolWidth;
      const height = table ? WORLD_SCALE.tableHeight : WORLD_SCALE.stoolHeight;
      woodParts.push({ targetId:structure.id, color, x, z, y: height - 0.045, sx: width, sy: 0.09, sz: length, ry });
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        const lx = dx * (width / 2 - 0.085), lz = dz * (length / 2 - 0.085);
        woodParts.push({ targetId:structure.id, color, x: x + lx * Math.cos(ry) + lz * Math.sin(ry), z: z + lz * Math.cos(ry) - lx * Math.sin(ry), y: (height - 0.09) / 2, sx: 0.09, sy: height - 0.09, sz: 0.09, ry });
      }
    }
    const surfaces=pileSurfaces(world);
    const parcels:Placement[]=[];
    for(const p of world.packed)if(p.owner.type==='ground') {
      const s=surfaces.get(p.owner.z*world.width+p.owner.x),scale=s?.scale??1;
      const x=p.owner.x+(s?.x??0),z=p.owner.z+(s?.z??0),y=s?.y??0;
      if(p.building.kind==='bedroll'){parcels.push(...packedBedrollParts(p.building,x,z,y,scale));continue;}
      parcels.push({targetId:p.building.id,x,z,y:y+.24*scale,sx:.64*scale,sy:.48*scale,sz:.64*scale,color:0xb6996c},
        {targetId:p.building.id,x,z,y:y+.49*scale,sx:.13*scale,sy:.03*scale,sz:.67*scale,color:buildingMaterialColor(p.building.material,0x6f634e)});
    }
    batches.set(group, 'furniture', [
      ...smithyParts267(world), ...brewingParts265(world), ...ventParts(world,cutaway), ...graveParts(world), ...foodWorkstationParts(world), ...electricalParts(contextWorld,cutaway,world.structures), ...passiveCoolerParts(world), ...doorParts(contextWorld,cutaway,world.structures), ...penParts(contextWorld,world.structures,cutaway), ...campfireParts(world), ...torchLampParts(world), ...recreationParts(world), ...stonecutterParts(world), ...craftingSpotParts(world), ...animalSleepingSpotParts(world), ...researchTailorParts(world), ...industryParts(world), ...habitatParts(world), ...artParts(world), ...drugLabParts(world),
      ...shipChunkParts256(world), ...ancientCasketParts256(world), ...cryptosleepParts271(world), ...ancientMonumentParts256(world), ...localRoadPropParts256(world), ...bedrollParts(world), ...hospitalBedParts(world), ...doubleBedParts(world), ...sleepingSpotParts(world), ...vitalsMonitorParts(world), ...deepDrillingParts(world), ...orbitalParts(world), ...nutrientPasteParts(world), ...biofuelParts(world), ...smeltingParts(world), ...crematoriumParts(world), ...firefoamParts290(world), ...spikeTrapParts(world), ...hydroponicsParts(world), ...miniTurretBaseParts(world), ...parcels,
      ...woodParts.map(p => ({ ...p, color: p.color ?? 0xa38559 })),
      ...walls.map(p => ({ ...p, sx: 1, sy: wallHeight - 0.09, sz: 1, color: p.color ?? 0xa6916e })),
      ...wallCaps.map(p => ({ ...p, sx: 1, sy: 0.09, sz: 1, color: p.color ?? 0xc3af86 })),
      ...bedFrames.map(p => ({ ...p, color: p.color ?? 0x795d41 })), ...bedding.map(p => ({ ...p, color: p.color??0xc7a977 })),
      ...pillows.map(p => ({ ...p, color: 0xe5d8b7 })), ...headboards.map(p => ({ ...p, color: p.color ?? 0x795d41 })),
    ]);
    batches.set(group,'sandbags',sandbagParts(world));
}



type FurnitureBatches=Pick<BoxBatches,'set'|'furnitureStamp'|'patchFurniture'|'patchFurnitureBatch'>;
type FurnitureSpan={start:number;count:number};
type SunLampCapture={ordinal:number;id:number;active:boolean};
type FurnitureState={group:THREE.Group;batches:FurnitureBatches;cutaway:boolean;width:number;height:number;
  colorManagementEnabled:boolean;workingColorSpace:string;
  stamp:object;items:Placement[];spans:Map<number,FurnitureSpan>;sunLamps:SunLampCapture[]};

/** Capture the shared authored model after the real set succeeds. Both visual
 * styles keep the same producer order, placements and furniture spans. */
function buildFurnitureOwned(world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches):Placement[]|undefined {
  let owned:Placement[]|undefined;
  const sink:Pick<BoxBatches,'set'>={
    set(...args:Parameters<BoxBatches['set']>):void {
      batches.set(...args);
      if(args[0]===group&&args[1]==='furniture')owned=args[2];
    },
  };
  // The unchanged public body uses only set. This local nominal cast supplies
  // that explicit port; it certifies no source World, Mesh or private capacity.
  buildFurniture(world,group,cutaway,sink as BoxBatches);
  return owned;
}

/** Renderer-owned list and spans, never a retained World or source structure. */
export class FurniturePresentation {
  private state:FurnitureState|undefined;

  clear():void {this.state=undefined;}

  update(world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches,
    flowerChanges?:readonly number[],readonlyNative=false):void {
    if(!readonlyNative){this.clear();buildFurniture(world,group,cutaway,batches as BoxBatches);return;}
    const state=this.state;
    // Keep only a local predecessor until every read/patch/capture succeeds.
    // A thrown producer or resident patch cannot leave that cache authorized.
    this.clear();
    if(state&&state.group===group&&state.batches===batches&&state.cutaway===cutaway&&
      state.width===world.width&&state.height===world.height&&flowerChanges!==undefined&&flowerChanges.length>0&&
      state.colorManagementEnabled===ColorManagement.enabled&&state.workingColorSpace===ColorManagement.workingColorSpace){
      const patches:{start:number;items:Placement[]}[]=[];
      let possible=true,last=-1;
      for(const ordinal of flowerChanges){
        if(!Number.isSafeInteger(ordinal)||ordinal<=last){possible=false;break;}last=ordinal;
        const structure=world.structures[ordinal];
        if(!structure||structure.kind!=='flower-pot'){possible=false;break;}
        const span=state.spans.get(structure.id);
        if(!span||span.count!==6){possible=false;break;}
        const items=habitatPartsForStructure(structure);
        if(items.length!==6){possible=false;break;}
        patches.push({start:span.start,items});
      }
      // A flower-triggered historical full build also recomputes civil lamp
      // colors. Preserve that visible dependency rather than silently freezing it.
      if(possible)for(const lamp of state.sunLamps){
        const structure=world.structures[lamp.ordinal];
        if(!structure||structure.id!==lamp.id||structure.kind!=='sun-lamp'||sunLampActive(world,structure)!==lamp.active){possible=false;break;}
      }
      if(possible){
        if(batches.patchFurnitureBatch(group,'furniture',patches,state.items.length,state.stamp)){
          for(const patch of patches)for(let i=0;i<patch.items.length;i++)state.items[patch.start+i]=patch.items[i]!;
          this.state=state;
          return;
        }
      }
    }
    // Clear first: exceptions and a refused resident patch cannot keep a cache
    // authorized against a partially modified or replaced batch.
    this.clear();
    const items=buildFurnitureOwned(world,group,cutaway,batches);if(items===undefined)return;
    const stamp=batches.furnitureStamp();if(stamp===undefined)return;
    const potIds=new Set<number>(),sunLamps:SunLampCapture[]=[];
    for(let ordinal=0;ordinal<world.structures.length;ordinal++){
      const structure=world.structures[ordinal]!;
      if(structure.kind==='flower-pot')potIds.add(structure.id);
      else if(structure.kind==='sun-lamp')sunLamps.push({ordinal,id:structure.id,active:sunLampActive(world,structure)});
    }
    const spans=new Map<number,FurnitureSpan>();
    for(let i=0;i<items.length;){
      const id=items[i]!.key;
      if(id===undefined||!potIds.has(id)){i++;continue;}
      if(!Number.isSafeInteger(id)||spans.has(id))return;
      let next=i+1;while(next<items.length&&items[next]!.key===id)next++;
      spans.set(id,{start:i,count:next-i});i=next;
    }
    this.state={group,batches,cutaway,width:world.width,height:world.height,
      colorManagementEnabled:ColorManagement.enabled,workingColorSpace:ColorManagement.workingColorSpace,
      stamp,items,spans,sunLamps};
  }
}
