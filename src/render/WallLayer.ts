import * as THREE from 'three/webgpu';
import {attribute,float,fwidth,max,mix,normalWorldGeometry,positionWorld,smoothstep,texture,uniform,vec2,vec3} from 'three/tsl';
import type {World} from '../sim/types';
import {currentGraphicsStyle} from './graphics-style';
import {solidExplorationMaterial256} from './ExplorationMask256';
import {createSurfaceMaterial} from './SurfaceMaterials';
import {ChunkedSurfaceMesh,emptySurfaceSoup,regionGrid,type SurfaceSoup} from './ChunkedSurfaceMesh';
import {naturalStroke,SURFACE_STROKE_UV} from './surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';
import {readWallGrid,wallChunkFaces,wallChunksNear,WALL_CHUNK_SIZE,type WallFaces,type WallGrid} from './wall-network';
import {wallPaintTexture} from './wall-paint';
export {wallPaintTexture} from './wall-paint';

const FIELDS={normal:3,color:3,wallFamily:1} as const;
const tint=new THREE.Color(0x84baff);
/** The wall soup as a region soup: geometry fields by attribute name. */
export const wallSoup=(faces:WallFaces):SurfaceSoup=>({triangles:faces.triangles,position:faces.position,faceUv:faces.faceUv,partition:faces.seam,fields:{normal:faces.normal,color:faces.color,wallFamily:faces.family}});

/** Every linked wall and doorway lintel of a map in ONE resident mesh and one
 * draw. Each 32x32 region owns a reserved range of the shared buffers and a
 * region of the contour bank: a built or removed wall rewrites the regions
 * within two cells of it, never the complete map, and nothing runs per frame. */
export class WallLayer {
  readonly group=new THREE.Group();
  readonly mesh:THREE.Mesh;
  readonly timberPaint=wallPaintTexture('timber');
  readonly stonePaint=wallPaintTexture('stone');
  readonly textured=createSurfaceMaterial('diffuse',0xffffff);
  readonly plain=createSurfaceMaterial('diffuse',0xffffff);
  private readonly surface=new ChunkedSurfaceMesh(FIELDS);
  private readonly targetSize=uniform(new THREE.Vector2(1,1));
  private readonly targetMap=new THREE.DataTexture(new Uint8Array(1),1,1,THREE.RedFormat,THREE.UnsignedByteType);
  private readonly targetNode=texture(this.targetMap);
  private targetCells:number[]=[];
  private targetIds:ReadonlySet<number>=new Set();
  private grid:WallGrid|undefined;
  private texturesEnabled=true;
  private warm:THREE.BufferGeometry|undefined;
  /** Diagnostics: regions rebuilt by the last update and since creation. */
  readonly stats={lastRebuilt:0,rebuilt:0,lastUpdateMs:0,layouts:0};

  constructor(configure?:(material:THREE.NodeMaterial)=>void){
    this.targetMap.magFilter=this.targetMap.minFilter=THREE.NearestFilter;this.targetMap.generateMipmaps=false;this.targetMap.needsUpdate=true;
    for(const material of [this.textured,this.plain]){solidExplorationMaterial256(material);configure?.(material);material.userData.rendererOwned=true;}
    const context=currentGraphicsStyle(),position=positionWorld,normal=attribute('normal','vec3'),family=attribute('wallFamily','float');
    const timber=family.mod(2).greaterThan(.5),cap=family.greaterThan(1.5),vertical=normal.y.abs().lessThan(.5);
    const along=normal.x.abs().greaterThan(.5).select(position.z,position.x);
    // Coursed boards (timber) or blocks (masonry), continuous along every run.
    const courseHeight=timber.select(float(.4667),float(.35)),blockLength=timber.select(float(2.3),float(.7));
    const rows=position.y.div(courseHeight),course=rows.floor(),fy=rows.fract();
    const courseHash=course.mul(12.9898).sin().mul(43758.5453).fract();
    const offset=timber.select(courseHash.mul(blockLength),course.mod(2).mul(blockLength.mul(.5)));
    const blocks=along.add(offset).div(blockLength),fx=blocks.fract();
    const blockHash=course.mul(12.9898).add(blocks.floor().mul(78.233)).sin().mul(43758.5453).fract();
    const wy=max(fwidth(rows).mul(1.5),float(.04)),wx=max(fwidth(blocks).mul(1.5),float(.015));
    const lap=float(1).sub(smoothstep(float(0),wy,fy)),mortar=max(lap,float(1).sub(smoothstep(float(0),wy,float(1).sub(fy))));
    const joint=max(float(1).sub(smoothstep(float(0),wx,fx)),float(1).sub(smoothstep(float(0),wx,float(1).sub(fx))));
    const lines=max(timber.select(lap,mortar),joint.mul(timber.select(float(.7),float(1))));
    // Lines fade out when a course shrinks to a few pixels (far zoom).
    const fade=float(1).sub(smoothstep(float(.18),float(.45),fwidth(rows)));
    const relief=float(1).add(blockHash.sub(.5).mul(timber.select(float(.09),float(.07)))).mul(float(1).sub(lines.mul(fade).mul(timber.select(float(.2),float(.15)))));
    const pattern=vertical.and(cap.not()).select(relief,float(1));
    // Order-target preview: one data texel per cell, read just inside the face.
    const cell=positionWorld.xz.sub(normalWorldGeometry.xz.mul(.025)).add(.5).floor();
    const targeted=this.targetNode.sample(cell.add(.5).div(this.targetSize)).level(float(0)).r;
    const vertex=attribute('color','vec3');
    const tinted=(rgb:THREE.Node<'vec3'>)=>mix(rgb,vec3(tint.r,tint.g,tint.b),targeted.mul(.32));
    const base=tinted(vertex.mul(pattern));
    const planar=vertical.select(vec2(along,position.y),position.xz);
    const paint=timber.select(texture(this.timberPaint,planar.div(vec2(3.1,1.9))).rgb,texture(this.stonePaint,planar.div(2.2)).rgb);
    const address=attribute(SURFACE_STROKE_UV,'vec3'),bank=this.surface.bank;
    const publish=()=>applySharedPaintSurface(this.textured,{context,base,pastel:base.mul(paint),faceUv:planar.div(4),stroke:naturalStroke(context,bank,address.z,address.xy)});
    bank.setPreparedRepresentationPublisher(()=>{publish();this.textured.needsUpdate=true;});publish();
    this.plain.vertexColors=false;this.plain.colorNode=tinted(vertex);
    this.mesh=new THREE.Mesh(this.surface.geometry,this.textured);
    this.mesh.name='linked-walls';this.mesh.castShadow=this.mesh.receiveShadow=true;this.mesh.visible=false;
    this.group.add(this.mesh);
  }

  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;this.mesh.material=enabled?this.textured:this.plain;
  }

  /** Drawn triangles, and triangles reserved in the shared buffers. */
  get triangles():number {return this.surface.triangles;}
  get reservedTriangles():number {return this.surface.reservedTriangles;}
  /** Contour bank bytes (tests/diagnostics). */
  get strokeBytes():number {return this.surface.bank.cpuBytes;}

  update(world:Pick<World,'width'|'height'|'structures'>,cutaway:boolean,reset=false):void {
    const started=performance.now();
    const grid=readWallGrid(world,cutaway),previous=this.grid;
    const {columns,rows}=regionGrid(grid.width,grid.height,WALL_CHUNK_SIZE);
    const resized=!previous||previous.width!==grid.width||previous.height!==grid.height;
    const full=reset||resized||previous.cutaway!==cutaway;
    const dirty=new Set<number>();
    if(full){
      for(let i=0;i<columns*rows;i++)dirty.add(i);
      for(const key of this.surface.keys())if(key>=columns*rows)this.surface.set(key,emptySurfaceSoup([]));
      this.surface.invalidateLayout();
    }else{
      const changed:number[]=[];
      for(let i=0;i<grid.codes.length;i++)if(grid.codes[i]!==previous.codes[i])changed.push(i);
      wallChunksNear(grid.width,grid.height,changed,dirty);
    }
    const idsChanged=full||grid.ids.some((id,i)=>id!==previous!.ids[i]);
    this.grid=grid;
    if(resized){this.resizeTargets(grid.width,grid.height);this.surface.setBounds(new THREE.Sphere(new THREE.Vector3(grid.width/2,grid.top/2,grid.height/2),Math.hypot(grid.width/2+1,grid.top,grid.height/2+1)));}
    for(const key of dirty){
      const {drawn,context}=wallChunkFaces(grid,key%columns,Math.floor(key/columns));
      if(drawn.triangles||this.surface.has(key))this.surface.set(key,wallSoup(drawn),wallSoup(context));
    }
    this.surface.commit();
    // Real walls adopted during a compile preparation replace its warm cell.
    if(this.warm&&this.triangles>0){this.warm.dispose();this.warm=undefined;}
    if(!this.warm)this.mesh.geometry=this.surface.geometry;
    this.mesh.visible=this.triangles>0||!!this.warm;
    if(idsChanged&&this.targetIds.size)this.applyTargets();
    this.stats.lastRebuilt=dirty.size;this.stats.rebuilt+=dirty.size;this.stats.layouts=this.surface.stats.layouts;this.stats.lastUpdateMs=performance.now()-started;
  }

  private resizeTargets(width:number,height:number):void {
    this.targetMap.dispose();
    this.targetMap.image={data:new Uint8Array(width*height),width,height};this.targetMap.needsUpdate=true;
    this.targetSize.value.set(width,height);this.targetCells=[];
  }
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetIds.size&&[...ids].every(id=>this.targetIds.has(id)))return;
    this.targetIds=new Set(ids);this.applyTargets();
  }
  clearTargetPreview():void {if(!this.targetIds.size&&!this.targetCells.length)return;this.targetIds=new Set();this.applyTargets();}
  private applyTargets():void {
    const grid=this.grid,data=this.targetMap.image.data as Uint8Array;
    for(const cell of this.targetCells)data[cell]=0;
    const cells:number[]=[];
    if(grid&&this.targetIds.size&&data.length===grid.ids.length)for(let i=0;i<grid.ids.length;i++)if(grid.ids[i]!>=0&&this.targetIds.has(grid.ids[i]!)){data[i]=255;cells.push(i);}
    if(cells.length||this.targetCells.length)this.targetMap.needsUpdate=true;
    this.targetCells=cells;
  }

  /** Compile both passes before the first wall exists: one temporary cell. */
  prepare():()=>void {
    if(this.triangles>0||this.warm)return()=>{};
    const grid=readWallGrid({width:1,height:1,structures:[{id:-1,kind:'wall',material:'wood',x:0,z:0,orientation:0,footprint:'standard'}]},false);
    const data=ChunkedSurfaceMesh.data(wallSoup(wallChunkFaces(grid,0,0).drawn),FIELDS,0),warm=new THREE.BufferGeometry();
    for(const [name,values] of Object.entries(data))warm.setAttribute(name,new THREE.BufferAttribute(values,name==='wallFamily'?1:3));
    warm.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1.4,0),3);
    this.warm=warm;this.mesh.geometry=warm;const visible=this.mesh.visible;this.mesh.visible=true;
    return()=>{if(this.warm!==warm)return;this.warm=undefined;this.mesh.geometry=this.surface.geometry;warm.dispose();this.mesh.visible=visible||this.triangles>0;};
  }

  dispose():void {
    this.group.remove(this.mesh);this.surface.dispose();this.warm?.dispose();
    this.textured.dispose();this.plain.dispose();this.timberPaint.dispose();this.stonePaint.dispose();this.targetMap.dispose();
  }
}
