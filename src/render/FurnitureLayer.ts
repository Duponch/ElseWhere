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
import { habitatParts } from './habitat-parts';
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
import { furniturePlacementZone, hiddenFurnitureSlot, furnitureZoneSlack, furnitureStructureValues, sameFurnitureValues, structureCells, zonesNear, zoneSubjects, samePlacement } from './furniture-zones';

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



/** Structure kinds drawn only by their own batch, which no furniture producer
 * reads: adding, removing or changing one leaves every furniture placement
 * unchanged (tests/furniture-independent-kinds.test.ts). */
export const FURNITURE_INDEPENDENT_KINDS:ReadonlySet<unknown>=new Set(['sandbags']);

type FurnitureBatches=Pick<BoxBatches,'set'|'furnitureStamp'|'patchFurniture'|'patchFurnitureBatch'>;
type SunLampCapture={id:number;active:boolean};
/** One zone of the resident furniture batch: its live placements (historical
 * producer order, restricted to the zone) from `start`, then reserved slots
 * up to `capacity`. */
type FurnitureSegment={key:string;start:number;capacity:number;items:readonly Placement[]};
type StructureCapture={values:readonly unknown[];cells:readonly {x:number;z:number}[];parentId:number|null|undefined};
type FurnitureState={group:THREE.Group;batches:FurnitureBatches;cutaway:boolean;width:number;height:number;
  colorManagementEnabled:boolean;workingColorSpace:string;
  stamp:object;total:number;segments:Map<string,FurnitureSegment>;
  structures:Map<number,StructureCapture>;packed:Map<number,{key:string;x:number;z:number}>;sunLamps:SunLampCapture[]};

/** Placements of the historical build, without writing them. */
function captureFurniture(world:World,cutaway:boolean,contextWorld:World=world):{furniture:Placement[];sandbags:Placement[]} {
  const out={furniture:[] as Placement[],sandbags:[] as Placement[]};
  const sink={set(_group:THREE.Group,key:string,items:Placement[]):void{if(key==='furniture')out.furniture=items;else if(key==='sandbags')out.sandbags=items;}};
  // The public body uses only set; this capture sink certifies no batch.
  buildFurniture(world,undefined as unknown as THREE.Group,cutaway,sink as unknown as BoxBatches,contextWorld);
  return out;
}
function groundPacked(world:World):Map<number,{key:string;x:number;z:number}> {
  const packed=new Map<number,{key:string;x:number;z:number}>();
  for(const p of world.packed??[])if(p.owner.type==='ground')packed.set(p.building.id,{key:`${p.building.kind}:${p.building.material}:${p.owner.x}:${p.owner.z}`,x:p.owner.x,z:p.owner.z});
  return packed;
}
const zoneOrder=(a:string,b:string):number=>{const [ax,az]=a.split(':').map(Number) as [number,number],[bx,bz]=b.split(':').map(Number) as [number,number];return az-bz||ax-bx;};

/** Renderer-owned zone layout of the resident furniture batch, never a retained
 * World or source structure. A structure change rewrites only the zones within
 * reach of it (tests/furniture-zones.test.ts); anything else lays all out. */
export class FurniturePresentation {
  private state:FurnitureState|undefined;

  clear():void {this.state=undefined;}

  /** Diagnostics/tests: the current zone layout of the resident batch. */
  layout():{total:number;segments:{key:string;start:number;capacity:number;count:number}[]}|undefined {
    const s=this.state;if(!s)return;
    return {total:s.total,segments:[...s.segments.values()].sort((a,b)=>a.start-b.start).map(g=>({key:g.key,start:g.start,capacity:g.capacity,count:g.items.length}))};
  }

  private owns(state:FurnitureState|undefined,world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches):state is FurnitureState {
    return !!state&&state.group===group&&state.batches===batches&&state.cutaway===cutaway&&state.width===world.width&&state.height===world.height&&
      state.colorManagementEnabled===ColorManagement.enabled&&state.workingColorSpace===ColorManagement.workingColorSpace&&batches.furnitureStamp()===state.stamp;
  }
  /** A complete build recolours the sun lamps on their schedule: a lamp that
   * changed state keeps that complete build. */
  private sunLampsUnchanged(state:FurnitureState,world:World):boolean {
    if(!state.sunLamps.length)return true;
    const byId=new Map(world.structures.map(s=>[s.id,s] as const));
    for(const lamp of state.sunLamps){
      const structure=byId.get(lamp.id);
      if(!structure||structure.kind!=='sun-lamp'||sunLampActive(world,structure)!==lamp.active)return false;
    }
    return true;
  }

  /** Native resident path for a change limited to independent kinds (see
   * FURNITURE_INDEPENDENT_KINDS): only their own batch is rebuilt, the owned
   * furniture batch stays. Returns false, changing nothing, when the furniture
   * batch is not owned for these settings, when another kind changed, or when
   * a sun lamp changed state (a full build would recolor it). */
  updateIndependent(world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches,kinds:ReadonlySet<unknown>):boolean {
    const state=this.state;
    if(!this.owns(state,world,group,cutaway,batches)||kinds.size===0)return false;
    for(const kind of kinds)if(!FURNITURE_INDEPENDENT_KINDS.has(kind))return false;
    if(!this.sunLampsUnchanged(state,world))return false;
    // Captures of the independent structures follow the World, so a later zone
    // diff does not see them as new. Prepared before the write, applied after.
    const present=new Set<number>(),added:[number,StructureCapture][]=[];
    for(const s of world.structures)if(FURNITURE_INDEPENDENT_KINDS.has(s.kind)){
      present.add(s.id);const values=furnitureStructureValues(s);if(!values)return false;
      const old=state.structures.get(s.id);if(!old||!sameFurnitureValues(old.values,values))added.push([s.id,{values,cells:structureCells(s),parentId:s.power?.parentId}]);
    }
    batches.set(group,'sandbags',sandbagParts(world));
    for(const [id,capture] of state.structures)if(FURNITURE_INDEPENDENT_KINDS.has(capture.values[1])&&!present.has(id))state.structures.delete(id);
    for(const [id,capture] of added)state.structures.set(id,capture);
    return true;
  }

  /** `flowerChanges` or `changedKinds` (structure signature receipts) declare
   * that only structure slots changed since the last build: the zones within
   * reach of the changed structures are rewritten. Without them (reset, legacy
   * text, door axes or packed furniture), or when a zone overflows its reserved
   * slots, the whole batch is laid out again. */
  update(world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches,
    flowerChanges?:readonly number[],readonlyNative=false,changedKinds?:ReadonlySet<unknown>):void {
    if(!readonlyNative){this.clear();buildFurniture(world,group,cutaway,batches as BoxBatches);return;}
    const state=this.state;
    // Keep only a local predecessor until every read/patch/capture succeeds.
    // A thrown producer or resident patch cannot leave that cache authorized.
    this.clear();
    if((flowerChanges!==undefined||changedKinds!==undefined)&&this.owns(state,world,group,cutaway,batches)&&this.sunLampsUnchanged(state,world)){
      const next=this.patchZones(state,world,group,cutaway,batches);
      if(next){this.state=next;return;}
    }
    // Clear first: exceptions and a refused resident patch cannot keep a cache
    // authorized against a partially modified or replaced batch.
    this.clear();
    this.layOut(world,group,cutaway,batches);
  }

  private capture(world:World,previous?:Map<number,StructureCapture>):Map<number,StructureCapture>|undefined {
    const structures=new Map<number,StructureCapture>();
    for(const s of world.structures){
      const values=furnitureStructureValues(s);if(!values||structures.has(s.id))return;
      const old=previous?.get(s.id);
      // Kind, position, orientation and footprint are immutable: same cells.
      const cells=old&&old.values[1]===values[1]&&old.values[3]===values[3]&&old.values[4]===values[4]&&old.values[5]===values[5]&&old.values[6]===values[6]?old.cells:structureCells(s);
      structures.set(s.id,{values,cells,parentId:s.power?.parentId});
    }
    return structures;
  }

  private layOut(world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches):void {
    const structures=this.capture(world);
    const {furniture,sandbags}=captureFurniture(world,cutaway);
    const byId=new Map(world.structures.map(s=>[s.id,s] as const)),zones=new Map<string,Placement[]>();
    for(const p of furniture){const key=furniturePlacementZone(p,byId);let list=zones.get(key);if(!list){list=[];zones.set(key,list);}list.push(p);}
    const laid:Placement[]=[],segments=new Map<string,FurnitureSegment>();
    for(const key of [...zones.keys()].sort(zoneOrder)){
      const items=zones.get(key)!,capacity=items.length+furnitureZoneSlack(items.length),start=laid.length;
      for(const p of items)laid.push(p);
      for(let i=items.length;i<capacity;i++)laid.push(hiddenFurnitureSlot(key));
      segments.set(key,{key,start,capacity,items});
    }
    batches.set(group,'furniture',laid);
    batches.set(group,'sandbags',sandbags);
    const stamp=batches.furnitureStamp();if(stamp===undefined||!structures)return;
    const sunLamps=world.structures.filter(s=>s.kind==='sun-lamp').map(s=>({id:s.id,active:sunLampActive(world,s)}));
    this.state={group,batches,cutaway,width:world.width,height:world.height,
      colorManagementEnabled:ColorManagement.enabled,workingColorSpace:ColorManagement.workingColorSpace,
      stamp,total:laid.length,segments,structures,packed:groundPacked(world),sunLamps};
  }

  /** Rewrite the zones within reach of every changed structure or packed
   * parcel; undefined (nothing written) when the whole batch must be laid out. */
  private patchZones(state:FurnitureState,world:World,group:THREE.Group,cutaway:boolean,batches:FurnitureBatches):FurnitureState|undefined {
    const structures=this.capture(world,state.structures);if(!structures)return;
    const dirty=new Set<string>(),changed=new Set<number>();
    for(const [id,now] of structures){
      const old=state.structures.get(id);
      if(old&&sameFurnitureValues(old.values,now.values))continue;
      changed.add(id);if(old)zonesNear(old.cells,dirty);zonesNear(now.cells,dirty);
    }
    for(const [id,old] of state.structures)if(!structures.has(id)){changed.add(id);zonesNear(old.cells,dirty);}
    // A power lead is drawn by the consumer towards its saved parent.
    if(changed.size)for(const capture of structures.values())if(capture.parentId!=null&&changed.has(capture.parentId))zonesNear(capture.cells,dirty);
    const packed=groundPacked(world);
    for(const [id,now] of packed){const old=state.packed.get(id);if(old?.key===now.key)continue;zonesNear([now],dirty);if(old)zonesNear([old],dirty);}
    for(const [id,old] of state.packed)if(!packed.has(id))zonesNear([old],dirty);
    if(!dirty.size)return {...state,structures,packed};
    // Every dirty zone in one partial build: its subjects are the structures
    // within reach; the complete World stays the context of every producer.
    const subjects=zoneSubjects(world,dirty,s=>structures.get(s.id)?.cells??structureCells(s));
    const {furniture}=captureFurniture({...world,...subjects},cutaway,world);
    const byId=new Map(world.structures.map(s=>[s.id,s] as const)),fresh=new Map<string,Placement[]>();
    for(const key of dirty)fresh.set(key,[]);
    for(const p of furniture)fresh.get(furniturePlacementZone(p,byId))?.push(p);
    const segments=new Map(state.segments),patches:{start:number;items:Placement[]}[]=[];
    for(const [key,items] of fresh){
      const segment=state.segments.get(key);
      if(!segment){if(items.length)return;continue;}
      if(items.length>segment.capacity)return;
      // Only the slots whose placement differs are written.
      let run:{start:number;items:Placement[]}|undefined;
      for(let i=0;i<segment.capacity;i++){
        const next=i<items.length?items[i]:undefined,old=i<segment.items.length?segment.items[i]:undefined;
        if(next&&old?samePlacement(next,old):!next&&!old){run=undefined;continue;}
        const value=next??hiddenFurnitureSlot(key);
        if(run)run.items.push(value);else{run={start:segment.start+i,items:[value]};patches.push(run);}
      }
      segments.set(key,{...segment,items});
    }
    patches.sort((a,b)=>a.start-b.start);
    if(patches.length&&!batches.patchFurnitureBatch(group,'furniture',patches,state.total,state.stamp))return;
    // The sandbag batch is its own; a change of one of them rebuilds it too.
    if([...changed].some(id=>FURNITURE_INDEPENDENT_KINDS.has((structures.get(id)??state.structures.get(id))?.values[1])))batches.set(group,'sandbags',sandbagParts(world));
    return {...state,segments,structures,packed};
  }
}
