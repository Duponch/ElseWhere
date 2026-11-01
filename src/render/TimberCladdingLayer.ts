import * as THREE from 'three/webgpu';
import {solidExplorationMaterial256} from './ExplorationMask256';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';
import {indexTimberGeometry} from './index-timber-geometry';
import { attribute,materialColor,texture,uv,varying,vec4,vertexColor } from 'three/tsl';
import {OverviewBatch,configureOverviewMaterial} from './OverviewBatch';
import type { World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { doorOrientations, isRoomDoor } from '../sim/door-rules';
import { doorLeafTop } from './door-parts';
import { timberPatternUv } from './timber-pattern-uv';
import { woodFiberDetail } from './stylized-surfaces';
import type { Placement } from './primitives';
import { InstanceTargetTint } from './instance-target-tint';
import {currentGraphicsStyle,applyOrigamiSurface} from './graphics-style';
import {createOrigamiContour,type OrigamiContourBinding} from './origami/contours';

type Point = readonly [number, number, number];

/** Small authored solids are assembled once. Their vertex colours give the
 * bevels and recessed joints a stable, faceted shade without per-cell meshes. */
export function createTimberGeometry(roof: boolean): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], uvs: number[] = [];
  const color = new THREE.Color();
  function quad(a: Point, b: Point, c: Point, d: Point, outward: Point, tint: number, uvRect:readonly [number,number,number,number]=[0,1,0,1]): void {
    const ab = new THREE.Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
    const ac = new THREE.Vector3(c[0]-a[0], c[1]-a[1], c[2]-a[2]);
    const direction = ab.cross(ac).dot(new THREE.Vector3(...outward));
    const corners=[a,b,c,d] as const;
    const order=direction>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2];
    color.setHex(tint);
    const [u0,u1,v0,v1]=uvRect;
    const uv = [[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
    for(let i=0;i<6;i++) {
      const vertex=order[i]!;
      positions.push(...corners[vertex]!);normals.push(...outward);colors.push(color.r,color.g,color.b);uvs.push(...uv[vertex]!);
    }
  }
  function box(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,tint:number):void {
    const shade=(factor:number)=>new THREE.Color(tint).multiplyScalar(factor).getHex();
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],tint);
    quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],shade(.91));
    quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],shade(.86));
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],shade(.88));
    quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],shade(1.1));
    quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],shade(.7));
  }
  if(roof) {
    // One edge plank, instanced only where a wall borders open space. A low
    // straight base keeps its join watertight; the uneven inset top and four
    // bevels soften the silhouette without additional per-cell objects.
    box(-.5,.5,-.055,.018,.405,.56,0xaa8050);
    const a:Point=[-.478,.055,.421],b:Point=[.483,.055,.418];
    const c:Point=[.478,.055,.545],d:Point=[-.482,.055,.541];
    quad(a,b,c,d,[0,1,0],0xd6ab72);
    quad([-.5,.018,.56],[.5,.018,.56],c,d,[0,0,1],0xbb8e59);
    quad([.5,.018,.405],[-.5,.018,.405],a,b,[0,0,-1],0xb88a55);
    quad([.5,.018,.56],[.5,.018,.405],b,c,[1,0,0],0xb28350);
    quad([-.5,.018,.405],[-.5,.018,.56],d,a,[-1,0,0],0xb28350);
  } else {
    // A single broad plank covers each cell face. Three unequal height bands
    // gently bend its edge, while two bevel facets round each vertical corner.
    // The bevels stay inside the cell and every face reaches its exact corner.
    // Adjacent cells share that boundary instead of leaving a translucent slot
    // or overlapping outward-bowed boards.
    box(-.47,.47,0,.94,-.47,.47,0x725238);
    const boardTints=[0xb18858,0xa77d4e,0xb68b58,0xa57c4d];
    const levels=[
      {y:0,sway:0,depth:.49},
      {y:.32,sway:-.018,depth:.5},
      {y:.67,sway:.013,depth:.491},
      {y:.967,sway:-.011,depth:.5},
    ];
    for(let face=0;face<4;face++) {
      const sign=face%2===0?1:-1,alongX=face<2;
      const p=(u:number,depth:number,y:number):Point=>alongX?[u,y,sign*depth]:[sign*depth,y,u];
      const outward:Point=alongX?[0,0,sign]:[sign,0,0];
      const side:Point=alongX?[1,0,0]:[0,0,1];
      const tint=new THREE.Color(boardTints[face]!).multiplyScalar(face===1||face===3?.94:1).getHex();
      const dark=new THREE.Color(tint).multiplyScalar(.77).getHex();
      const light=new THREE.Color(tint).multiplyScalar(.87).getHex();
      for(let band=0;band<levels.length-1;band++) {
        const a=levels[band]!,b=levels[band+1]!;
        const frontL=(v:typeof a)=>-.445+v.sway,frontR=(v:typeof a)=>.445+v.sway;
        quad(p(frontL(a),a.depth,a.y),p(frontR(a),a.depth,a.y),p(frontR(b),b.depth,b.y),p(frontL(b),b.depth,b.y),outward,tint,[.05,.95,a.y,b.y]);
        quad(p(-.5,.5,a.y),p(frontL(a),a.depth,a.y),p(frontL(b),b.depth,b.y),p(-.5,.5,b.y),[-side[0],0,-side[2]],dark,[0,.05,a.y,b.y]);
        quad(p(frontR(a),a.depth,a.y),p(.5,.5,a.y),p(.5,.5,b.y),p(frontR(b),b.depth,b.y),side,light,[.95,1,a.y,b.y]);
      }
    }
    // One softly bevelled cap per cell, lower than the overhanging edge rail.
    box(-.5,.5,.944,.961,-.5,.5,0xcfa36b);
    const low=.961,high=.982,edge=.5,top=.464,cap=0xd6ac72;
    quad([-top,high,top],[top,high,top],[top,high,-top],[-top,high,-top],[0,1,0],cap);
    quad([-edge,low,edge],[edge,low,edge],[top,high,top],[-top,high,top],[0,0,1],cap);
    quad([edge,low,-edge],[-edge,low,-edge],[-top,high,-top],[top,high,-top],[0,0,-1],cap);
    quad([edge,low,edge],[edge,low,-edge],[top,high,-top],[top,high,top],[1,0,0],cap);
    quad([-edge,low,-edge],[-edge,low,edge],[-top,high,top],[-top,high,-top],[-1,0,0],cap);
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  indexTimberGeometry(result);
  result.computeBoundingBox();result.computeBoundingSphere();
  return result;
}

/** Broad, asymmetrical painted wood values. Small grain supports the painted
 * facets, rather than being the only feature visible at ordinary camera scale. */
function grainTexture():THREE.DataTexture {
  const width=64,height=64,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const patchX=Math.floor((x+5*Math.sin(y*.12))/19);
    const patchY=Math.floor((y+4*Math.sin(x*.09))/23);
    const patch=(((patchX*73856093)^(patchY*19349663))>>>0)%5-2;
    const painted=Math.sin(x*.085+y*.033)*12+Math.sin(x*.17-y*.08)*7;
    const grain=woodFiberDetail(x,y);
    const value=Math.max(158,Math.min(255,Math.round(226+patch*10+painted+grain)));
    const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;return texture;
}

export type TimberPlacement=Placement&{tint:number};

/** Shared authoring for finished walls and cursor ghosts. The context determines
 * connected edges; subjects restrict the produced objects without removing that
 * context or constructing any GPU materials. */
export function timberCladdingParts(world:World,cutaway:boolean,subjects:readonly World['structures'][number][]=world.structures):{walls:TimberPlacement[];eaves:TimberPlacement[]} {
    const walls=world.structures.filter(s=>s.kind==='wall'&&s.material==='wood');
    const doors=walls.length?world.structures.filter(s=>isRoomDoor(s.kind)):[];
    const axes=doors.length?doorOrientations(world):new Map<number,0|1>();
    const at=(x:number,z:number)=>`${x}:${z}`;
    const wood=new Set(walls.map(s=>at(s.x,s.z)));
    type RimCell={id:number;x:number;z:number;axis:'all'|'horizontal'|'vertical'};
    const cells:RimCell[]=walls.map(s=>({id:s.id,x:s.x,z:s.z,axis:'all'}));
    const timberDoors:typeof doors=[];
    for(const door of doors) {
      const horizontal=wood.has(at(door.x-1,door.z))&&wood.has(at(door.x+1,door.z));
      const vertical=wood.has(at(door.x,door.z-1))&&wood.has(at(door.x,door.z+1));
      if(horizontal||vertical){
        timberDoors.push(door);
        cells.push({id:door.id,x:door.x,z:door.z,axis:horizontal&&!vertical?'horizontal':vertical&&!horizontal?'vertical':(axes.get(door.z*world.width+door.x)??0)===0?'horizontal':'vertical'});
      }
    }
    const occupied=new Set(cells.map(c=>at(c.x,c.z)));
    // Timber trim must stop against masonry too. Otherwise a mixed-material
    // seam retains a supposedly exposed edge rail inside the neighboring cap.
    const solidBoundaries=new Set(world.structures.filter(s=>s.kind==='wall'||isRoomDoor(s.kind)).map(s=>at(s.x,s.z)));
    type Side='north'|'south'|'east'|'west';
    const offset:Record<Side,readonly [number,number]>={north:[0,1],south:[0,-1],east:[1,0],west:[-1,0]};
    const sides:Side[]=['north','south','east','west'];
    const exposed=new Set<string>();
    for(const c of cells)for(const side of sides) {
      if(c.axis==='horizontal'&&(side==='east'||side==='west')||c.axis==='vertical'&&(side==='north'||side==='south'))continue;
      const [dx,dz]=offset[side];if(!solidBoundaries.has(at(c.x+dx,c.z+dz)))exposed.add(`${at(c.x,c.z)}:${side}`);
    }
    const rims:{cell:RimCell;side:Side;centre:number;length:number}[]=[];
    for(const c of cells)for(const side of sides) {
      if(!exposed.has(`${at(c.x,c.z)}:${side}`))continue;
      let low=-.5,high=.5;
      if(side==='north'||side==='south') {
        // Straight runs meet at exactly the cell boundary. A free endpoint
        // reaches 0.06 further to cover the perpendicular corner board.
        if(!exposed.has(`${at(c.x-1,c.z)}:${side}`)&&(!solidBoundaries.has(at(c.x-1,c.z))||occupied.has(at(c.x-1,c.z))))low-=.06;
        if(!exposed.has(`${at(c.x+1,c.z)}:${side}`)&&(!solidBoundaries.has(at(c.x+1,c.z))||occupied.has(at(c.x+1,c.z))))high+=.06;
      } else {
        // At a corner the horizontal board owns the square intersection.
        // Trimming the vertical board makes a butt joint without coplanar faces.
        if(exposed.has(`${at(c.x,c.z)}:south`))low+=.095;
        if(exposed.has(`${at(c.x,c.z)}:north`))high-=.095;
        const outward=side==='east'?1:-1;
        // Re-entrant room corners meet a horizontal board on the diagonal
        // cell. Its 0.06 endpoint reaches this edge too.
        if(exposed.has(`${at(c.x+outward,c.z-1)}:north`))low=Math.max(low,-.44);
        if(exposed.has(`${at(c.x+outward,c.z+1)}:south`))high=Math.min(high,.44);
      }
      rims.push({cell:c,side,centre:(low+high)/2,length:high-low});
    }
    const selected=new Set(subjects.map(s=>s.id));
    const wallParts:TimberPlacement[]=[],eaveParts:TimberPlacement[]=[];
    const height=cutaway?WORLD_SCALE.wallCutawayHeight:WORLD_SCALE.wallHeight;
    for(const wall of walls)if(selected.has(wall.id)) {
      const tint=1+((((wall.x*73856093)^(wall.z*19349663)^(wall.id*83492791))>>>0)%13-6)*.007;
      const alongZ=occupied.has(at(wall.x,wall.z-1))||occupied.has(at(wall.x,wall.z+1));
      const alongX=occupied.has(at(wall.x-1,wall.z))||occupied.has(at(wall.x+1,wall.z));
      wallParts.push({key:wall.id,x:wall.x,y:0,z:wall.z,ry:alongZ&&!alongX?Math.PI/2:0,sx:1,sy:height,sz:1,tint});
    }
    // Keep the connected context and neighbouring plank orientation unchanged;
    // cutaway omits only the timber pieces spanning each doorway.
    for(const door of timberDoors)if(!cutaway&&selected.has(door.id)) {
      const from=doorLeafTop(cutaway),axis=axes.get(door.z*world.width+door.x)??0;
      wallParts.push({key:door.id,x:door.x,y:from,z:door.z,ry:axis*Math.PI/2,sx:1,sy:height-from,sz:1,tint:1});
    }
    for(const {cell,side,centre,length} of rims)if(selected.has(cell.id)&&(!cutaway||cell.axis==='all')) {
      const horizontal=side==='north'||side==='south';
      const tint=1+((((cell.x*73856093)^(cell.z*19349663))>>>0)%11-5)*.006;
      eaveParts.push({key:cell.id,x:cell.x+(horizontal?centre:0),y:height-.055,z:cell.z+(horizontal?0:centre),
        ry:side==='north'?0:side==='south'?Math.PI:side==='east'?Math.PI/2:-Math.PI/2,sx:length,sy:1,sz:1,tint});
    }
    return {walls:wallParts,eaves:eaveParts};
}

/** Presentation-only wall cladding. Call update when adopting a world or
 * changing cutaway; the layer performs no work during rendered frames. */
export class TimberCladdingLayer {
  readonly group=new THREE.Group();
  private readonly style=currentGraphicsStyle();
  private readonly contours=new Map<OverviewBatch,OrigamiContourBinding>();
  readonly wallGeometry=createTimberGeometry(false);
  readonly eaveGeometry=createTimberGeometry(true);
  readonly grain=grainTexture();
  readonly material=new THREE.MeshLambertNodeMaterial({color:0xffffff,flatShading:true,vertexColors:true,map:this.grain});
  readonly plainMaterial=new THREE.MeshLambertNodeMaterial({color:0xffffff,flatShading:true,vertexColors:true});
  /** Exactly two resident batches cover every map. Slots retain the canonical
   * V432 wall/eave order; these handles expose their complete active counts. */
  wallMesh:OverviewBatch;
  eaveMesh:OverviewBatch;
  private readonly chunks=new Map<string,{
    wall:{mesh:OverviewBatch;capacity:number;tint:InstanceTargetTint};
    eave:{mesh:OverviewBatch;capacity:number;tint:InstanceTargetTint};
  }>();
  private key='';
  private texturesEnabled=true;
  private targetPreviewIds:ReadonlySet<number>=new Set();
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetPreviewIds.size&&[...ids].every(id=>this.targetPreviewIds.has(id)))return;
    this.targetPreviewIds=new Set(ids);
    for(const chunk of this.chunks.values()){chunk.wall.tint.setTargets(ids);chunk.eave.tint.setTargets(ids);}
  }
  clearTargetPreview():void {
    this.targetPreviewIds=new Set();
    for(const chunk of this.chunks.values()){chunk.wall.tint.clear();chunk.eave.tint.clear();}
  }
  constructor(configure?: (material: THREE.NodeMaterial)=>void,private readonly ownedProducer435?:OwnedOpaqueProducer435) {
    const owner=varying(attribute('overviewMatrix3','vec4').xz,'v_timberExplorationOwner');
    solidExplorationMaterial256(this.material,owner);solidExplorationMaterial256(this.plainMaterial,owner);
    // Stable named matrix attributes avoid capacity-dependent instance UBOs.
    // Match NodeMaterial r186: tint * (base * authored vertex colour), with
    // the same grouping and alpha. Disable only its duplicate implicit path.
    for(const mat of [this.material,this.plainMaterial]){
      configureOverviewMaterial(mat);mat.vertexColors=false;
    }
    const tint=vec4(attribute('overviewColor','vec3'),1);
    this.material.colorNode=tint.mul(vec4(texture(this.grain,timberPatternUv()).rgb,1).mul(vertexColor()));
    this.plainMaterial.colorNode=tint.mul(materialColor.mul(vertexColor()));
    applyOrigamiSurface(this.material,tint.rgb.mul(materialColor.rgb).mul(vertexColor().rgb),uv(),this.style);
    this.material.map=null;
    for(const mat of [this.material,this.plainMaterial]){configure?.(mat);mat.userData.rendererOwned=true;}
    const origin=this.createChunk('0:0',256);
    this.wallMesh=origin.wall.mesh;this.eaveMesh=origin.eave.mesh;
  }
  setTexturesEnabled(enabled:boolean):void {
    if(this.texturesEnabled===enabled)return;
    this.texturesEnabled=enabled;
    for(const chunk of this.chunks.values())for(const batch of [chunk.wall,chunk.eave]){batch.mesh.material=enabled?this.material:this.plainMaterial;this.contours.get(batch.mesh)?.sync();this.ownedProducer435?.dirty(batch.mesh);}
  }
  private makeMesh(shape:THREE.BufferGeometry,name:string,capacity:number):OverviewBatch {
    const mesh=new OverviewBatch(shape,this.texturesEnabled?this.material:this.plainMaterial,capacity);
    mesh.geometry.setAttribute('timberOrdinal',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.StaticDrawUsage));
    mesh.name=name;mesh.activeCount=0;mesh.castShadow=true;mesh.receiveShadow=true;
    this.ownedProducer435?.register(mesh,[this.material,this.plainMaterial],[this.grain]);
    return mesh;
  }
  private createChunk(key:string,capacity=16){
    const wall=this.makeMesh(this.wallGeometry,'timber-vertical-planks',capacity),eave=this.makeMesh(this.eaveGeometry,'timber-eave-planks',capacity);
    const chunk={
      wall:{mesh:wall,capacity,tint:new InstanceTargetTint(()=>this.ownedProducer435?.dirty(wall))},
      eave:{mesh:eave,capacity,tint:new InstanceTargetTint(()=>this.ownedProducer435?.dirty(eave))},
    };
    for(const mesh of [chunk.wall.mesh,chunk.eave.mesh]){
      mesh.userData.timberChunk=key;this.group.add(mesh);
      if(this.style?.origami){const contour=createOrigamiContour(mesh,this.style);this.contours.set(mesh,contour);this.group.add(contour.line);}
    }
    this.chunks.set(key,chunk);return chunk;
  }
  private grow(batch:{mesh:OverviewBatch;capacity:number},count:number,shape:THREE.BufferGeometry):void {
    if(count<=batch.capacity)return;
    batch.capacity=2**Math.ceil(Math.log2(count));
    // update() immediately rewrites every live slot from canonical placements;
    // no persistent CPU mirror or copy of obsolete buffer contents is needed.
    batch.mesh.allocate(shape,batch.capacity);
    batch.mesh.geometry.setAttribute('timberOrdinal',new THREE.InstancedBufferAttribute(new Float32Array(batch.capacity),1).setUsage(THREE.StaticDrawUsage));
    this.ownedProducer435?.dirty(batch.mesh);
  }
  update(world:World,cutaway:boolean,reset=false):void {
    const walls=world.structures.filter(s=>s.kind==='wall'&&s.material==='wood');
    const doors=walls.length?world.structures.filter(s=>isRoomDoor(s.kind)):[];
    const axes=doors.length?doorOrientations(world):new Map<number,0|1>();
    const key=`${cutaway}|${walls.map(s=>`${s.id}:${s.x}:${s.z}`).join('|')}|${doors.map(s=>`${s.id}:${s.x}:${s.z}:${axes.get(s.z*world.width+s.x)??0}`).join('|')}`;
    if(!reset&&key===this.key)return;
    this.key=key;
    for(const chunk of this.chunks.values()){chunk.wall.tint.restore();chunk.eave.tint.restore();}
    const parts=timberCladdingParts(world,cutaway);
    const spatial=new Map<string,{wall:number[];eave:number[]}>();
    for(const [kind,placements]of [['wall',parts.walls],['eave',parts.eaves]]as const)for(let ordinal=0;ordinal<placements.length;ordinal++){
      // One global owner, including map borders and all map dimensions.
      // Preserve the original canonical ordinal without a spatial regrouping.
      const key='0:0';
      let entry=spatial.get(key);if(!entry){entry={wall:[],eave:[]};spatial.set(key,entry);}entry[kind].push(ordinal);
    }
    const object=new THREE.Object3D(),color=new THREE.Color();
    for(const [key,entry]of spatial){
      const chunk=this.chunks.get(key)??this.createChunk(key);
      for(const [kind,placements,shape]of [['wall',parts.walls,this.wallGeometry],['eave',parts.eaves,this.eaveGeometry]]as const){
        const batch=chunk[kind],ordinals=entry[kind];this.grow(batch,ordinals.length,shape);
        const mesh=batch.mesh,ordinalAttribute=mesh.geometry.getAttribute('timberOrdinal')as THREE.InstancedBufferAttribute,targetIds:(number|undefined)[]=[];
        for(let slot=0;slot<ordinals.length;slot++){
          const ordinal=ordinals[slot]!,p=placements[ordinal]!;
          object.position.set(p.x,p.y,p.z);object.rotation.set(0,p.ry??0,0);
          object.scale.set(p.sx??1,p.sy??1,p.sz??1);object.updateMatrix();
          mesh.setMatrixAt(slot,object.matrix);mesh.setColorAt(slot,color.setRGB(p.tint,p.tint,p.tint));
          ordinalAttribute.setX(slot,ordinal);targetIds.push(p.key);
        }
        mesh.activeCount=ordinals.length;ordinalAttribute.needsUpdate=true;
        batch.tint.setInstances(mesh.colorBuffer,targetIds);batch.tint.setTargets(this.targetPreviewIds);
      }
    }
    for(const [key,chunk]of this.chunks)for(const batch of [chunk.wall,chunk.eave]){
      const mesh=batch.mesh;
      if(!spatial.has(key)){mesh.activeCount=0;batch.tint.setInstances(mesh.colorBuffer,[]);}
      mesh.instanceMatrix.needsUpdate=true;mesh.colorBuffer.needsUpdate=true;mesh.computeBoundingSphere();
      this.contours.get(mesh)?.sync();
      this.ownedProducer435?.dirty(mesh);
    }
  }
  /** Compile empty batches for the first real and shadow passes. */
  prepareForCompile():()=>void {
    const empty=[...this.chunks.values()].flatMap(chunk=>[chunk.wall.mesh,chunk.eave.mesh]).filter(mesh=>mesh.activeCount===0);
    const saved=empty.map(mesh=>({mesh,buffer:mesh.instanceMatrix,version:mesh.instanceMatrix.version}));
    for(const mesh of empty){mesh.activeCount=1;this.contours.get(mesh)?.sync();this.ownedProducer435?.dirty(mesh);}
    return ()=>{for(const {mesh,buffer,version} of saved)if(mesh.instanceMatrix===buffer&&buffer.version===version){mesh.activeCount=0;this.contours.get(mesh)?.sync();this.ownedProducer435?.dirty(mesh);}};
  }
  dispose():void {
    for(const contour of this.contours.values())contour.dispose();this.contours.clear();
    for(const chunk of this.chunks.values())for(const batch of [chunk.wall,chunk.eave]){
      batch.tint.dispose();this.ownedProducer435?.forget(batch.mesh);this.group.remove(batch.mesh);batch.mesh.dispose();
    }
    this.chunks.clear();
    this.wallGeometry.dispose();this.eaveGeometry.dispose();this.material.dispose();this.plainMaterial.dispose();this.grain.dispose();
  }
}
