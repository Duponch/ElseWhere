import {TREE_CARGO_MODELS} from './tree-presentation';
import * as THREE from 'three/webgpu';
import { PAWN_MODEL_SCALE } from '../world/scale';
import {ITEM_VISUAL_IDS,itemCargoKind,itemGeometry,centreItemParts} from './item-presentation';
import {placementGeometry} from './item-portrait';
import {origamiHumanGeometry} from './origami/human-geometry';

// Disjoint from weapon tags; -4 is the bolt-action rifle, not the parka hood.
export const PARKA_HOOD_DYE = -6;
export const FLAK_HELMET_DYE = -7;
export const RECON_HELMET_DYE = -8;
export const RECON_ARMOR_DYE = -9;
export const TUQUE_DYE = -10;
export const PLATE_ARMOR_DYE = -11;
export const SIMPLE_HELMET_DYE = -12;
// Face variants are resident in the same pawn batch. The vertex shader shows
// exactly one of them; portraits project the open-eye variant at rest.
export const PAWN_EYE_OPEN = 60;
export const PAWN_EYE_CLOSED = 61;
export const PAWN_EYE_CROSS = 62;
/** Presentation-only resident work props; never equipment or inventory. */
export const WORK_AXE_DYE = -30;
export const WORK_PICKAXE_DYE = -31;
export const WORK_SICKLE_DYE = -32;

/** Eight rigid bones, authored entirely in code. Each vertex has one bone influence.
 * The bind position/pivot and animation state are evaluated in the vertex shader.
 * There is no per-pawn AnimationMixer, bone Object3D tree or CPU bone update.
 * This deliberately small prototype rig is not yet the future glTF atlas importer.
 */
export function pawnGeometry(includeSmithing=false,includeMace=false,includeLongsword=false,includeSpear=false): THREE.InstancedBufferGeometry {
  // Bind anatomy has no texture-style context or companion render owner.
  return origamiHumanGeometry(includeSmithing,includeMace,includeLongsword,includeSpear,false,false);
}

/** Cargo is a second instanced batch sharing the pawn pose attributes. Its
 * attachment and interpolation stay on the GPU, including during camera motion.
 * Parts share the ground model. Individual logs are not individual items.
 */
export function cargoGeometry(): THREE.InstancedBufferGeometry {
  const data: number[] = [];
  const ranges:CargoGeometryRange[]=[],byKind:Record<number,CargoGeometryRange>={};
  const begin=(kind:number)=>({kind,start:data.length/13,count:0,materialIndex:0});
  const finish=(range:CargoGeometryRange)=>{range.count=data.length/13-range.start;Object.freeze(range);ranges.push(range);byKind[range.kind]=range;};
  const part = (size: number[], center: number[], kind: number, color: number,corpsePartMask=0) => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed();
    const positions = box.getAttribute('position'), normals = box.getAttribute('normal'),uv=box.getAttribute('uv');
    const tint = new THREE.Color(color);
    for (let i = 0; i < positions.count; i++) data.push(
      positions.getX(i) + center[0], positions.getY(i) + center[1], positions.getZ(i) + center[2],
      normals.getX(i), normals.getY(i), normals.getZ(i), tint.r, tint.g, tint.b, kind,corpsePartMask,uv.getX(i),uv.getY(i),
    );
    box.dispose();
  };
  // Packed furniture keeps its historical attachment and shader kind.
  const packedRange=begin(4);
  part([0.60,0.44,0.46],[0,0,0],4,0xb6996c);
  part([0.12,0.46,0.48],[0,0,0],4,0x6f634e);
  finish(packedRange);
  // Immutable all-item geometry is built once for the two resident cargo
  // batches. No meshes, selection, or portrait work is performed per frame.
  const transform=new THREE.Matrix4(),rotation=new THREE.Quaternion(),point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  for(const model of [...ITEM_VISUAL_IDS.filter(item=>item!=='minified-tree').map(item=>({item,kind:itemCargoKind(item),traits:undefined})),...TREE_CARGO_MODELS.map(model=>({item:'minified-tree' as const,kind:model.kind,traits:model.traits}))]){
    const {item,traits}=model;
    const kind=model.kind;
    const range=begin(kind);
    for(const p of centreItemParts(itemGeometry(item,undefined,undefined,traits),true)){
      const source=placementGeometry(p),positions=source.getAttribute('position'),normals=source.getAttribute('normal'),uv=source.getAttribute('uv'),index=source.getIndex(),tint=new THREE.Color(p.color??0xb8ac96);
      rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),p.ry??0);
      transform.compose(new THREE.Vector3(p.x,p.y,p.z),rotation,new THREE.Vector3(p.sx??1,p.sy??1,p.sz??1));normalMatrix.getNormalMatrix(transform);
      for(let i=0;i<(index?.count??positions.count);i++){
        const vertex=index?index.getX(i):i;
        point.fromBufferAttribute(positions,vertex).applyMatrix4(transform);normal.fromBufferAttribute(normals,vertex).applyMatrix3(normalMatrix).normalize();
        data.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,tint.r,tint.g,tint.b,kind,0,uv?.getX(vertex)??0,uv?.getY(vertex)??0);
      }
    }
    finish(range);
  }
  const vertices = new THREE.InterleavedBuffer(new Float32Array(data), 13);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(vertices, 3, 0));
  geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(vertices, 3, 3));
  geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(vertices, 3, 6));
  geometry.setAttribute('cargoKind', new THREE.InterleavedBufferAttribute(vertices, 1, 9));
  geometry.setAttribute('corpsePartMask', new THREE.InterleavedBufferAttribute(vertices, 1, 10));
  geometry.setAttribute('uv',new THREE.InterleavedBufferAttribute(vertices,2,11));
  geometry.userData.cargoRanges=Object.freeze(ranges);
  geometry.userData.cargoRangesByKind=Object.freeze(byKind);
  geometry.instanceCount = 0;
  return geometry;
}

export interface CargoGeometryRange {kind:number;start:number;count:number;materialIndex:number}
const activeCargoKinds=new WeakMap<THREE.BufferGeometry,string>();

type CargoGroups=THREE.BufferGeometry['groups'];
interface CargoCompilePreparation {
  groups:CargoGroups;saved:CargoGroups;override:CargoGroups[number]|undefined;
  count:number;warmCount:number;
}
const cargoCompilePreparations=new WeakMap<THREE.InstancedBufferGeometry,CargoCompilePreparation>();
function ownsCargoCompileGroups(geometry:THREE.InstancedBufferGeometry,state:CargoCompilePreparation):boolean {
  const expected=state.override?[state.override]:state.saved;
  return geometry.groups===state.groups&&geometry.groups.length===expected.length&&
    geometry.groups.every((group,index)=>group===expected[index]);
}
/** The producer has already written its new instanceCount before selection.
 * Retire only the temporary groups, even on an unchanged-kind cache hit. */
function releaseCargoCompileGroups(geometry:THREE.InstancedBufferGeometry):void {
  const state=cargoCompilePreparations.get(geometry);
  if(!state)return;
  cargoCompilePreparations.delete(geometry);
  if(state.override&&ownsCargoCompileGroups(geometry,state))
    geometry.groups.splice(0,geometry.groups.length,...state.saved);
}
/** One real packed range warms the existing material/attributes, including its
 * shadow pass. A later producer selection owns the new groups and count. */
export function prepareCargoGeometryForCompile(geometry:THREE.InstancedBufferGeometry):(stillOwned?:boolean)=>void {
  if(cargoCompilePreparations.has(geometry))throw new Error('Cargo geometry is already preparing');
  const groups=geometry.groups,saved=[...groups],count=geometry.instanceCount;
  const packed=(geometry.userData.cargoRangesByKind as Record<number,CargoGeometryRange>|undefined)?.[4];
  if(!groups.length&&(!packed||!Number.isInteger(packed.count)||packed.count<=0))throw new Error('Packed cargo preparation range is missing');
  // A unique immutable copy distinguishes the override from a real selection.
  const override=groups.length?undefined:Object.freeze({...packed!});
  const state:CargoCompilePreparation={groups,saved,override,count,warmCount:Math.max(1,count)};
  if(override)groups.splice(0,groups.length,override);
  geometry.instanceCount=state.warmCount;
  cargoCompilePreparations.set(geometry,state);
  return(stillOwned=true)=>{
    if(cargoCompilePreparations.get(geometry)!==state)return;
    cargoCompilePreparations.delete(geometry);
    if(!stillOwned||!ownsCargoCompileGroups(geometry,state))return;
    if(override)groups.splice(0,groups.length,...saved);
    if(geometry.instanceCount===state.warmCount)geometry.instanceCount=count;
  };
}

/** Groups only change where the producer changes cargo kinds. A single-entry
 * material array makes Three submit these ranges with the same shader/material.
 * Source vertices and the actor instance order never change. Immutable range
 * metadata survives the population-growth clone; selection is geometry-local
 * because Three's clone shares userData but copies the groups array. */
export function selectCargoGeometryKinds(geometry:THREE.InstancedBufferGeometry,kinds:ReadonlySet<number>):void {
  releaseCargoCompileGroups(geometry);
  const byKind=geometry.userData.cargoRangesByKind as Record<number,CargoGeometryRange>|undefined;
  if(!byKind)throw new Error('Cargo geometry ranges are missing');
  const selected:CargoGeometryRange[]=[];
  for(const kind of kinds){const range=byKind[kind];if(range&&range.count)selected.push(range);}
  selected.sort((a,b)=>a.start-b.start);
  const signature=selected.map(range=>range.kind).join(',');
  if(activeCargoKinds.get(geometry)===signature)return;
  geometry.groups.splice(0,geometry.groups.length,...selected);
  activeCargoKinds.set(geometry,signature);
}

/** Owns GPU actor/cargo batches; receives snapshots, never simulates gameplay. */
