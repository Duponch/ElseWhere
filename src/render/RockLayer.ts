import * as THREE from 'three/webgpu';
import type { World } from '../sim/types';
import { ROCK_INDICES, ROCK_VERTICES, writeRockCell } from './RockSurface';
import { writeRockPigment } from './rock-pigment';
import { WORLD_SCALE } from '../world/scale';
import { STONE_KINDS } from '../sim/geology';
import { material } from './primitives';
import { opaqueRockExplorationMaterial256 } from './ExplorationMask256';
import { foggedCell256 } from '../sim/exploration-state-256';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { positionLocal, texture, varying, vec2 } from 'three/tsl';
import {currentGraphicsStyle} from './graphics-style';
import {createOrigamiContour,type OrigamiContourBinding} from './origami/contours';

/** One resident surface shared by close/distant views, including the map slab.
 * Cell slots survive excavation/restoration. Only affected vertices are uploaded;
 * the small active index list is compacted in-place, without reallocating buffers.
 * Keep default StaticDrawUsage: r186 otherwise uploads unchanged attributes on
 * every frame. Mining marks exact ranges and increments needsUpdate explicitly. */
export class RockLayer {
  private readonly graphicsStyle=currentGraphicsStyle();
  private readonly contours=new Map<THREE.Mesh,OrigamiContourBinding>();
  readonly group=new THREE.Group();
  readonly mesh:THREE.Mesh;
  readonly stats={updatedCells:0,indexCount:0,bufferBytes:0,contourBufferBytes:0};
  private slots=new Map<number,{slot:number;indices:number[]}>();
  private rockMask=new Uint8Array(0);
  private tiles:World['tiles']|undefined;
  private capacity=0;
  private seed=0;
  private width=0;
  private height=0;
  private readonly local=new THREE.Group();
  private readonly chunks=new Map<string,{cells:Set<number>;mesh:THREE.Mesh;capacity:number}>();
  private distant=false;
  private texturesEnabled=true;
  private readonly stonePaint=createStylizedSurfaceTexture('stone');
  // Clean dedicated materials: shared props already have exploration masks.
  private readonly plainMaterial=opaqueRockExplorationMaterial256(material(0xffffff,{vertexColors:true}));
  private readonly texturedMaterial=opaqueRockExplorationMaterial256(material(0xffffff,{vertexColors:true}));
  compiledMaterials435():readonly THREE.NodeMaterial[]{return[this.plainMaterial,this.texturedMaterial];}
  constructor(configure?: (material:THREE.MeshStandardNodeMaterial)=>void) {
    // Coordinates come from the existing world-space position attribute, so
    // even a vast continuous cliff adds no UV buffer, vertices or draw calls.
    // The varying moves coordinate arithmetic out of the fragment stage.
    // A full repeat spans roughly 38 world cells. Top faces use x/z directly;
    // height gently offsets side faces without introducing a visible cell grid.
    const paintedUv=varying(positionLocal.xz.mul(.026).add(positionLocal.y.mul(vec2(.009,.007))));
    // NodeMaterial applies vertexColors after colorNode; multiplying the
    // color attribute here too would darken the stone twice.
    this.texturedMaterial.colorNode=texture(this.stonePaint,paintedUv).rgb;
    configure?.(this.plainMaterial);configure?.(this.texturedMaterial);
    this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.texturedMaterial);
    this.mesh.name='Continuous rock surface';this.mesh.castShadow=true;this.mesh.receiveShadow=true;
    this.mesh.matrixAutoUpdate=false;
    this.group.add(this.mesh,this.local);this.setDistant(false);
  }
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    const chosen=enabled?this.texturedMaterial:this.plainMaterial;
    this.mesh.material=chosen;
    this.local.traverse(object=>{if(object instanceof THREE.Mesh)object.material=chosen;});
    for(const binding of this.contours.values())binding.sync();
  }
  setDistant(distant:boolean):void {
    const changed=this.distant!==distant;this.distant=distant;this.mesh.visible=distant;this.mesh.castShadow=false;this.local.visible=!distant;
    if(this.graphicsStyle?.origami){if(distant&&(changed||!this.contours.has(this.mesh)))this.syncContour(this.mesh);else if(!distant&&changed)for(const object of this.local.children)if(object instanceof THREE.Mesh)this.syncContour(object);}
  }
  private syncContour(mesh:THREE.Mesh):void {
    const context=this.graphicsStyle;if(!context?.origami)return;let binding=this.contours.get(mesh);
    if(!binding){binding=createOrigamiContour(mesh,context,(mesh.material as THREE.NodeMaterial).positionNode);mesh.add(binding.line);this.contours.set(mesh,binding);}binding.sync();
    this.stats.contourBufferBytes=[...this.contours.values()].reduce((sum,item)=>sum+Object.values(item.line.geometry.attributes).reduce((total,a)=>total+a.array.byteLength,0),0);
  }
  private clearLocal():void {for(const object of this.local.children)if(object instanceof THREE.Mesh){this.contours.get(object)?.dispose();this.contours.delete(object);object.geometry.dispose();}this.local.clear();this.chunks.clear();}
  private viewGeometry(indices:Uint32Array,box:THREE.Box3):THREE.BufferGeometry {
    const geometry=new THREE.BufferGeometry();
    for(const name of ['position','normal','color'])geometry.setAttribute(name,this.mesh.geometry.getAttribute(name));
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new THREE.Sphere());return geometry;
  }
  private updateLocal(dirty:Set<number>,reset:boolean):void {
    const size=WORLD_SCALE.chunkSize,keys=new Set<string>();
    if(reset) {
      this.clearLocal();
      const slab=this.viewGeometry((this.mesh.geometry.index!.array as Uint32Array).slice(0,36),new THREE.Box3(new THREE.Vector3(-.6,-1,-.6),new THREE.Vector3(this.width-.4,0,this.height-.4)));
      const mesh=new THREE.Mesh(slab,this.mesh.material);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;this.local.add(mesh);
      if(!this.distant)this.syncContour(mesh);
    }
    for(const i of dirty) {
      const cx=Math.floor(i%this.width/size),cz=Math.floor(Math.floor(i/this.width)/size),key=`${cx}:${cz}`;keys.add(key);
      let chunk=this.chunks.get(key);
      if(!chunk) {
        const bounds=new THREE.Box3(new THREE.Vector3(cx*size-.8,-.01,cz*size-.8),new THREE.Vector3((cx+1)*size+.3,4,(cz+1)*size+.3));
        const mesh=new THREE.Mesh(this.viewGeometry(new Uint32Array(0),bounds),this.mesh.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;
        chunk={cells:new Set(),mesh,capacity:0};this.chunks.set(key,chunk);this.local.add(mesh);
      }
      chunk.cells.add(i);
    }
    for(const key of keys) {
      const c=this.chunks.get(key)!;
      if(c.cells.size>c.capacity) {c.capacity=2**Math.ceil(Math.log2(c.cells.size));c.mesh.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(c.capacity*ROCK_INDICES),1));}
      const indices=c.mesh.geometry.index!;let count=0;
      for(const cell of c.cells){const faces=this.slots.get(cell)!.indices;(indices.array as Uint32Array).set(faces,count);count+=faces.length;}
      c.mesh.geometry.setDrawRange(0,count);indices.clearUpdateRanges();indices.addUpdateRange(0,count);indices.needsUpdate=true;
      if(!this.distant)this.syncContour(c.mesh);
    }
    this.stats.bufferBytes = Object.values(this.mesh.geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,0) + this.mesh.geometry.index!.array.byteLength + this.local.children.reduce((sum,m)=>sum+(m as THREE.Mesh).geometry.index!.array.byteLength,0);
    this.setDistant(this.distant);
  }
  private allocate(world:World,capacity:number):void {
    this.capacity=capacity;
    const vertices=24+capacity*ROCK_VERTICES;
    const g=new THREE.BufferGeometry();
    for(const name of ['position','normal','color'])g.setAttribute(name,new THREE.BufferAttribute(new Float32Array(vertices*3),3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(36+capacity*ROCK_INDICES),1));
    const slab=new THREE.BoxGeometry(world.width+.15,.8,world.height+.15).translate((world.width-1)/2,-.56,(world.height-1)/2);
    for(const name of ['position','normal']) (g.getAttribute(name).array as Float32Array).set(slab.getAttribute(name).array);
    (g.index!.array as Uint32Array).set(slab.index!.array);
    const colors=g.getAttribute('color'),c=new THREE.Color(0x827858);
    for(let i=0;i<24;i++)colors.setXYZ(i,c.r,c.g,c.b);
    slab.dispose();this.mesh.geometry.dispose();this.mesh.geometry=g;
    // Known envelope remains conservative after any local deletion or restoration.
    g.boundingBox=new THREE.Box3(new THREE.Vector3(-.6,-1,-.6),new THREE.Vector3(world.width-.4,4,world.height-.4));
    g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());
    this.stats.bufferBytes=vertices*36+(36+capacity*ROCK_INDICES)*4;
  }
  update(world:World,reset=false,changedTiles?:readonly number[]):void {
    this.stats.updatedCells=0;
    if(!reset&&this.tiles===world.tiles)return;
    reset ||= world.width!==this.width||world.height!==this.height||world.seed!==this.seed;
    const changed:number[]=[];
    if(reset) {this.slots.clear();this.rockMask=new Uint8Array(world.tiles.length);this.width=world.width;this.height=world.height;this.seed=world.seed;}
    const inspect=reset?undefined:changedTiles;
    for(let n=0;n<(inspect?.length??world.tiles.length);n++) {
      const i=inspect?inspect[n]!:n;
      const tile=world.tiles[i]!;
      const fogged=foggedCell256(world,i);
      const rock=tile.terrain==='rock'?(fogged?1:tile.ore?tile.ore==='machinery'?9:tile.ore==='gold'?10:tile.ore==='plasteel'?11:tile.ore==='uranium'?12:tile.ore==='jade'?13:8:tile.stone?2+STONE_KINDS.indexOf(tile.stone):1):0;
      const state=rock+(rock&&fogged?16:0);
      if(state!==this.rockMask[i]) {changed.push(i);this.rockMask[i]=state;}
      if(rock&&!this.slots.has(i))this.slots.set(i,{slot:this.slots.size,indices:[]});
    }
    let reallocated=false;
    if(reset||this.slots.size>this.capacity) {this.allocate(world,Math.max(16,2**Math.ceil(Math.log2(Math.max(1,this.slots.size)))));reallocated=true;}
    const dirty=new Set<number>();
    if(reallocated)for(const i of this.slots.keys())dirty.add(i);
    else for(const i of changed)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
      const x=i%world.width+dx,z=Math.floor(i/world.width)+dz;
      if(x>=0&&z>=0&&x<world.width&&z<world.height&&this.slots.has(z*world.width+x))dirty.add(z*world.width+x);
    }
    if(dirty.size||reallocated) {
      const g=this.mesh.geometry,position=g.getAttribute('position') as THREE.BufferAttribute,normal=g.getAttribute('normal') as THREE.BufferAttribute,color=g.getAttribute('color') as THREE.BufferAttribute;
      for(const attribute of [position,normal,color])attribute.clearUpdateRanges();
      for(const i of dirty) {
        const record=this.slots.get(i)!,v=24+record.slot*ROCK_VERTICES,x=i%world.width,z=Math.floor(i/world.width);
        record.indices=writeRockCell(world,x,z,position.array as Float32Array,v);
        writeRockPigment(world,x,z,color.array as Float32Array,v);
        for(let k=0;k<ROCK_VERTICES;k++)normal.setXYZ(v+k,0,1,0);
        for(const attribute of [position,normal,color])attribute.addUpdateRange(v*3,ROCK_VERTICES*3);
      }
      let offset=36;const indices=g.index!;
      for(const {indices:active} of this.slots.values()){(indices.array as Uint32Array).set(active,offset);offset+=active.length;}
      indices.clearUpdateRanges();indices.addUpdateRange(0,offset);indices.needsUpdate=true;g.setDrawRange(0,offset);
      for(const attribute of [position,normal,color])attribute.needsUpdate=true;
      this.stats.updatedCells=dirty.size;this.stats.indexCount=offset;
      this.updateLocal(dirty,reallocated);
      if(this.distant)this.syncContour(this.mesh);
    }
    this.tiles=world.tiles;
  }
  dispose():void {this.clearLocal();for(const binding of this.contours.values())binding.dispose();this.contours.clear();this.mesh.geometry.dispose();this.plainMaterial.dispose();this.texturedMaterial.dispose();this.stonePaint.dispose();}
}
