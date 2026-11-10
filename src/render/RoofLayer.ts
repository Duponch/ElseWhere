import * as THREE from 'three/webgpu';
import {currentGraphicsStyle} from './graphics-style';
import {attribute,float,vec2,uv,texture} from 'three/tsl';
import {emitPitchedRoof,emptyRoofFaces,isRoofOutlineKind,pitchedRoofFaces,roofField,ROOF_CAP_CELLS,type RoofFaces} from './pitched-roof';
import {buildingMaterialColor} from './building-material-color';
import {ChunkedSurfaceMesh,regionGrid,type SurfaceSoup} from './ChunkedSurfaceMesh';
import {naturalStroke,SURFACE_STROKE_UV} from './surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';
import {roofCoverage,roofKindAt} from '../sim/roof-rules';
import type { World } from '../sim/types';
import type { BoxBatches } from './BoxBatches';
import { WORLD_SCALE } from '../world/scale';
import { woodFiberDetail } from './stylized-surfaces';
import {overlaySurfaceHeightAtCell,type GroundOverlaySurface} from './surface-height';
import {EMPTY_GROUND_OVERLAYS,GROUND_OVERLAY_RENDER_ORDER,groundOverlayPlacements,setGroundOverlayRenderOrder,type GroundOverlayRect} from './ground-overlay-surfaces';

type RoofCell = { x: number; z: number };
export interface PreparedPhysicalRoofs {readonly world:World;readonly coverage:readonly number[];readonly roofKey:string;readonly tail:string;readonly cells:readonly RoofCell[];readonly supportKey:string;readonly input:unknown}
type Point = readonly [number, number, number];

export interface RoofSlabCellBounds extends RoofCell {
  w: number; e: number; s: number; n: number; top: number; bottom: number;
  west: boolean; east: boolean; south: boolean; north: boolean;
}

/** The slab and construction ghosts use the same contour and thickness. */
export function roofSlabCellBounds(cells: readonly RoofCell[], top: number): RoofSlabCellBounds[] {
  const present = new Set(cells.map(c => `${c.x}:${c.z}`));
  const has = (x: number, z: number) => present.has(`${x}:${z}`);
  const overhang = .065;
  return cells.map(({ x, z }) => {
    const west = !has(x - 1, z), east = !has(x + 1, z), south = !has(x, z - 1), north = !has(x, z + 1);
    return { x, z, w: x - .5 - (west ? overhang : 0), e: x + .5 + (east ? overhang : 0),
      s: z - .5 - (south ? overhang : 0), n: z + .5 + (north ? overhang : 0), top, bottom: top - .31,
      west, east, south, north };
  });
}

/** Include roofed supports and corner posts in the slab, using only the
 * authoritative constructed cells as the adjacency source. */
export function roofSurfaceCells(world: World): RoofCell[] {
  const width = world.width, height = world.height;
  const built = new Set(world.roofing?.constructed ?? []), cells = new Set(roofCoverage(world));
  if (!cells.size) return [];
  for (const s of world.structures) {
    if (!isRoofOutlineKind(s.kind)) continue;
    let near = false;
    for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = s.x + dx, z = s.z + dz;
      if (x >= 0 && x < width && z >= 0 && z < height && built.has(z * width + x)) { near = true; break; }
    }
    if (near) cells.add(s.z * width + s.x);
  }
  return [...cells].sort((a, b) => a - b).map(i => ({ x: i % width, z: Math.floor(i / width) }));
}

/** One continuous upper plane. Interior tile boundaries have no sides,
 * bevels, elevation changes or material splits. Only the outer contour drops
 * into a thick, lightly overhanging fascia. */
export function roofSlabGeometry(cells: readonly RoofCell[], top: number,kindAt?:(cell:RoofCell)=>'constructed'|'natural-thin'|'natural-thick'|undefined): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], uvs: number[] = [];
  const tint = new THREE.Color();
  function triangle(a: Point, b: Point, c: Point, normal: Point, shade: number): void {
    const cross = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      .cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
    const vertices = cross.dot(new THREE.Vector3(...normal)) >= 0 ? [a, b, c] : [a, c, b];
    tint.setHex(shade);
    for (const p of vertices) {
      positions.push(...p); normals.push(...normal); colors.push(tint.r, tint.g, tint.b);
      // World-space UVs continue across all formerly separate roof cells.
      uvs.push(p[0] / 8, p[2] / 8);
    }
  }
  for (const { x,z,w, e, s, n, bottom, west, east, south, north } of roofSlabCellBounds(cells, top)) {
    const kind=kindAt?.({x,z}),topPigment=kind==='natural-thick'?0x7f8586:kind==='natural-thin'?0xa3a59a:0xe6bc83,underPigment=kind?.startsWith('natural')?0x656e70:0x806044,sidePigment=kind?.startsWith('natural')?0x7f8782:0xa77b4e;
    const sw: Point = [w, top, s], se: Point = [e, top, s];
    const ne: Point = [e, top, n], nw: Point = [w, top, n];
    triangle(sw, ne, se, [0, 1, 0], topPigment);
    triangle(sw, nw, ne, [0, 1, 0], topPigment);
    const underSW:Point=[w,bottom,s],underSE:Point=[e,bottom,s];
    const underNE:Point=[e,bottom,n],underNW:Point=[w,bottom,n];
    triangle(underSW,underSE,underNE,[0,-1,0],underPigment);
    triangle(underSW,underNE,underNW,[0,-1,0],underPigment);
    const edges: Array<{ exposed: boolean; a: Point; b: Point; normal: Point }> = [
      { exposed: south, a: sw, b: se, normal: [0, 0, -1] },
      { exposed: east, a: se, b: ne, normal: [1, 0, 0] },
      { exposed: north, a: ne, b: nw, normal: [0, 0, 1] },
      { exposed: west, a: nw, b: sw, normal: [-1, 0, 0] },
    ];
    for (const edge of edges) {
      if (!edge.exposed) continue;
      const belowA: Point = [edge.a[0], bottom, edge.a[2]];
      const belowB: Point = [edge.b[0], bottom, edge.b[2]];
      triangle(edge.a, edge.b, belowB, edge.normal, sidePigment);
      triangle(edge.a, belowB, belowA, edge.normal, sidePigment);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Natural (mountain) roof cells keep the flat slab; built roofs, with the
 * walls and doors carrying them, become pitched roofs (see pitched-roof.ts).
 * One non-indexed soup, so one mesh, one draw and one contour table. */
export function roofGeometry(world:Pick<World,'width'|'height'|'roofing'|'structures'>,cells:readonly RoofCell[],top:number):THREE.BufferGeometry {
  const natural:RoofCell[]=[],built:RoofCell[]=[];
  for(const cell of cells)(roofKindAt(world,cell.z*world.width+cell.x)?.startsWith('natural')?natural:built).push(cell);
  const slab=roofSlabGeometry(natural,top,cell=>roofKindAt(world,cell.z*world.width+cell.x));
  if(!built.length){slab.setAttribute('roofPart',new THREE.Float32BufferAttribute(new Float32Array(slab.getAttribute('position').count).fill(4),1));return slab;}
  const walls=new Map<number,number>();
  for(const s of world.structures)if(s.kind==='wall')walls.set(s.z*world.width+s.x,s.material==='wood'?0xad8455:buildingMaterialColor(s.material,0xa6916e)??0xa6916e);
  const {faces}=pitchedRoofFaces(world.width,world.height,built,{eave:top,gableColor:(x,z)=>walls.get(z*world.width+x)});
  const join=(a:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,b:readonly number[])=>{const out=new Float32Array(a.array.length+b.length);out.set(a.array as Float32Array);out.set(b,a.array.length);return out;};
  const geometry=new THREE.BufferGeometry(),n=slab.getAttribute('position').count;
  geometry.setAttribute('position',new THREE.BufferAttribute(join(slab.getAttribute('position'),faces.position),3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(join(slab.getAttribute('normal'),faces.normal),3));
  geometry.setAttribute('color',new THREE.BufferAttribute(join(slab.getAttribute('color'),faces.color),3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(join(slab.getAttribute('uv'),faces.uv),2));
  // Discriminant for contours: a pitch/fascia/gable/natural change is a line.
  const part=new Float32Array(n+faces.part.length);part.fill(4,0,n);part.set(faces.part,n);
  geometry.setAttribute('roofPart',new THREE.BufferAttribute(part,1));
  slab.dispose();geometry.computeBoundingSphere();
  return geometry;
}

/** Broad, irregular painted shade zones and baked, subordinate wood fibres. */
function roofPaint(): THREE.DataTexture {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const patchX = Math.floor((x + 5 * Math.sin(y * .071)) / 23);
    const patchY = Math.floor((y + 8 * Math.sin(x * .052)) / 19);
    const hash = ((patchX * 73856093) ^ (patchY * 19349663)) >>> 0;
    const zone = (hash % 5 - 2) * 11;
    const sweep = Math.sin(x * .075 + y * .026) * 11 + Math.sin(y * .12) * 6;
    const grain = woodFiberDetail(x * .5, y * .5) * 1.8;
    const value = Math.max(160, Math.min(255, Math.round(225 + zone + sweep + grain)));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Region side of the roof surface; a change rewrites only nearby regions. */
export const ROOF_CHUNK_SIZE=32;
/** Cells within this distance of a region can change its drawn roof or its
 * contour ring: the height window (cap + 1), the cell lattice, neighbour
 * classes and the context ring itself. */
const ROOF_DEPENDENCY_REACH=ROOF_CAP_CELLS+5;
const ROOF_FIELDS={normal:3,color:3,uv:2,roofPart:1} as const;

/** Flat slab faces of natural (mountain) roof cells, exposure decided by the
 * complete natural set: the historical slab, emitted region by region. */
function naturalSlabFaces(cells:readonly RoofCell[],natural:(x:number,z:number)=>boolean,top:number,kindAt:(cell:RoofCell)=>string|undefined,out:RoofFaces):void {
  const tint=new THREE.Color(),overhang=.065,bottom=top-.31;
  const triangle=(a:Point,b:Point,c:Point,normal:Point,shade:number)=>{
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const cross=(uy*vz-uz*vy)*normal[0]+(uz*vx-ux*vz)*normal[1]+(ux*vy-uy*vx)*normal[2];
    tint.setHex(shade);
    for(const p of cross>=0?[a,b,c]:[a,c,b]){out.position.push(p[0],p[1],p[2]);out.normal.push(normal[0],normal[1],normal[2]);out.color.push(tint.r,tint.g,tint.b);out.uv.push(p[0]/8,p[2]/8);out.part.push(4);}
    out.triangles++;
  };
  for(const {x,z} of cells){
    const west=!natural(x-1,z),east=!natural(x+1,z),south=!natural(x,z-1),north=!natural(x,z+1);
    const w=x-.5-(west?overhang:0),e=x+.5+(east?overhang:0),s=z-.5-(south?overhang:0),n=z+.5+(north?overhang:0);
    const kind=kindAt({x,z}),topPigment=kind==='natural-thick'?0x7f8586:0xa3a59a;
    const sw:Point=[w,top,s],se:Point=[e,top,s],ne:Point=[e,top,n],nw:Point=[w,top,n];
    triangle(sw,ne,se,[0,1,0],topPigment);triangle(sw,nw,ne,[0,1,0],topPigment);
    const underSW:Point=[w,bottom,s],underSE:Point=[e,bottom,s],underNE:Point=[e,bottom,n],underNW:Point=[w,bottom,n];
    triangle(underSW,underSE,underNE,[0,-1,0],0x656e70);triangle(underSW,underNE,underNW,[0,-1,0],0x656e70);
    for(const edge of [{exposed:south,a:sw,b:se,normal:[0,0,-1] as Point},{exposed:east,a:se,b:ne,normal:[1,0,0] as Point},{exposed:north,a:ne,b:nw,normal:[0,0,1] as Point},{exposed:west,a:nw,b:sw,normal:[-1,0,0] as Point}]){
      if(!edge.exposed)continue;
      const belowA:Point=[edge.a[0],bottom,edge.a[2]],belowB:Point=[edge.b[0],bottom,edge.b[2]];
      triangle(edge.a,edge.b,belowB,edge.normal,0x7f8782);triangle(edge.a,belowB,belowA,edge.normal,0x7f8782);
    }
  }
}
/** Contour coordinates as the historical roof: horizontal faces keep their
 * painted UV, vertical ones project on their own plane. */
function roofSoup(faces:RoofFaces):SurfaceSoup {
  const n=faces.triangles*3,faceUv=new Array<number>(n*2);
  for(let v=0;v<n;v++){
    const nx=faces.normal[v*3]!,ny=faces.normal[v*3+1]!;
    if(Math.abs(ny)>.5){faceUv[v*2]=faces.uv[v*2]!;faceUv[v*2+1]=faces.uv[v*2+1]!;}
    else if(Math.abs(nx)>.5){faceUv[v*2]=faces.position[v*3+2]!/8;faceUv[v*2+1]=faces.position[v*3+1]!/8;}
    else{faceUv[v*2]=faces.position[v*3]!/8;faceUv[v*2+1]=faces.position[v*3+1]!/8;}
  }
  return {triangles:faces.triangles,position:faces.position,faceUv,partition:faces.part,fields:{normal:faces.normal,color:faces.color,uv:faces.uv,roofPart:faces.part}};
}

export class RoofLayer {
  readonly surface = new THREE.Group();
  readonly areas = new THREE.Group();
  areaSurfaces:readonly GroundOverlayRect[]=EMPTY_GROUND_OVERLAYS;
  readonly paint = roofPaint();
  readonly textured = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: .94, metalness: 0, flatShading: true, vertexColors: true, map: this.paint });
  readonly plain = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: .94, metalness: 0, flatShading: true, vertexColors: true });
  readonly mesh: THREE.Mesh;
  private readonly regions=new ChunkedSurfaceMesh(ROOF_FIELDS);
  private readonly dependencies=new Map<number,string>();
  private surfaceKey = '';
  private layoutKey = '';
  private areaKey = '';
  private texturesEnabled = true;
  private warm:THREE.BufferGeometry|undefined;
  /** Diagnostics: regions rewritten by the last physical update. */
  readonly stats={lastRebuilt:0,rebuilt:0,lastUpdateMs:0};
  /** The continuous slab has world-absolute UVs and mutable unique faces.
   * No canonical repeated chart domain is proven; retain exact Source rather
   * than invent seams or allocate a per-cell atlas. This is an explicit route. */
  preparedSurfaceStatus(){return{pipeline:'continuous-roof-Source',representation:'source',fallback:'continuous-world-roof-no-canonical-domain',atlasLayers:0,visible:this.mesh.visible};}
  requestPreparedSurfaceQualityRoute(route:'source'|'prepared'|undefined):void {if(route==='prepared')throw Error('Continuous world roof has no admitted canonical prepared domain');}
  constructor(configure?: (material: THREE.MeshStandardNodeMaterial) => void,private readonly prepared?:(world:World)=>PreparedPhysicalRoofs|undefined) {
    for (const mat of [this.textured, this.plain]) { configure?.(mat); mat.userData.rendererOwned = true; }
    this.mesh = new THREE.Mesh(this.regions.geometry, this.textured);
    this.mesh.name = 'continuous-roof-coverage';
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.visible = false; this.surface.add(this.mesh);
    const context=currentGraphicsStyle(),bank=this.regions.bank;
    // Exact old roof UVs remain the Pastel source. The original Gouache
    // side-face projection supplies its own regular authored coordinates.
    const point=attribute('position','vec3'),normal=attribute('normal','vec3').abs(),paintUv=normal.y.greaterThan(.5).select(uv(),normal.x.greaterThan(.5).select(vec2(point.z,point.y).div(8),vec2(point.x,point.y).div(8))),address=attribute(SURFACE_STROKE_UV,'vec3');
    const base=attribute('color','vec3');
    // Gouache, as on every other surface: the pigment runs continuously over
    // each pitch at the historical density (one unit per unit seen from
    // above, 0.6 on vertical faces), and the paper mask is always read in its
    // painted middle band, so no cell or region border shows on a pitch.
    const horizontal=normal.y.greaterThan(.5),along=normal.x.greaterThan(.5).select(point.z,point.x);
    const planar=horizontal.select(point.xz,vec2(along,point.y));
    const mirror=(t:THREE.Node<'float'>)=>float(1).sub(t.mod(2).sub(1).abs()).mul(.3).add(.35);
    const paperUv=vec2(mirror(planar.x),mirror(planar.y)),pigmentUv=horizontal.select(point.xz,vec2(along,point.y).mul(.6));
    this.textured.roughness=.88;this.textured.metalness=.02;
    const publishStroke=()=>applySharedPaintSurface(this.textured,{context,base,pastel:base.mul(texture(this.paint,uv()).rgb),faceUv:paintUv,pigmentUv,coverage:context?(_raw,profile)=>context.faceCoverageNode(paperUv,profile):undefined,stroke:naturalStroke(context,bank,address.z,address.xy)});bank.setPreparedRepresentationPublisher(()=>{publishStroke();this.textured.needsUpdate=true;});publishStroke();
    this.surface.visible = this.areas.visible = false;
  }
  setTexturesEnabled(enabled: boolean): void {
    if (this.texturesEnabled === enabled) return;
    this.texturesEnabled = enabled;
    this.mesh.material = enabled ? this.textured : this.plain;
  }
  /** Drawn triangles and contour bank bytes (tests/diagnostics). */
  get triangles():number {return this.regions.triangles;}
  get strokeBytes():number {return this.regions.bank.cpuBytes;}
  update(world: World, batches: BoxBatches, cutaway = false, reset = false): void {
    this.updatePhysical(world,cutaway,reset);
    this.updateAreas(world,world.roofing?.build??[],world.roofing?.remove??[],batches,reset);
  }
  updatePhysical(world:World,cutaway=false,reset=false):void {
    const prepared=this.prepared?.(world),state=world.roofing;
    const key=prepared&&prepared.world===world?`${world.width}|${cutaway}|${prepared.tail}`:
      `${world.width}|${cutaway}|${roofCoverage(world).join(',')}|${state?.natural?.thin.join(',')}|${state?.natural?.thick.join(',')}|${world.structures.filter(s=>isRoofOutlineKind(s.kind)).map(s=>`${s.kind}:${s.x}:${s.z}:${s.kind==='wall'?s.material:''}`).join(',')}`;
    if (!reset && this.surfaceKey === key) return;
    const started=performance.now();
    const cells = prepared&&prepared.world===world?prepared.cells:roofSurfaceCells(world);
    const top = (cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight) + .08;
    const width=world.width,height=world.height,{columns,rows}=regionGrid(width,height,ROOF_CHUNK_SIZE);
    const layoutKey=`${width}x${height}|${top}`,full=reset||layoutKey!==this.layoutKey;
    const kindAt=(cell:RoofCell)=>roofKindAt(world,cell.z*width+cell.x);
    const naturalKind=new Uint8Array(width*height),natural:RoofCell[]=[],built:RoofCell[]=[];
    for(const cell of cells){const kind=kindAt(cell);if(kind?.startsWith('natural')){naturalKind[cell.z*width+cell.x]=kind==='natural-thick'?2:1;natural.push(cell);}else built.push(cell);}
    const walls=new Map<number,number>();
    if(built.length)for(const s of world.structures)if(s.kind==='wall')walls.set(s.z*width+s.x,s.material==='wood'?0xad8455:buildingMaterialColor(s.material,0xa6916e)??0xa6916e);
    const field=roofField(width,height,built,{eave:top,gableColor:(x,z)=>walls.get(z*width+x)});
    // Everything a region's drawn roof and contour ring depend on, hashed.
    const h1=new Uint32Array(columns*rows).fill(2166136261),h2=new Uint32Array(columns*rows).fill(5381);
    const mix=(chunk:number,value:number)=>{h1[chunk]=Math.imul(h1[chunk]!^value,16777619)>>>0;h2[chunk]=(Math.imul(h2[chunk]!,33)+value)>>>0;};
    const spread=(x:number,z:number,reach:number,values:readonly number[])=>{
      for(let cz=Math.max(0,Math.floor((z-reach)/ROOF_CHUNK_SIZE));cz<=Math.min(rows-1,Math.floor((z+reach)/ROOF_CHUNK_SIZE));cz++)
        for(let cx=Math.max(0,Math.floor((x-reach)/ROOF_CHUNK_SIZE));cx<=Math.min(columns-1,Math.floor((x+reach)/ROOF_CHUNK_SIZE));cx++)for(const v of values)mix(cz*columns+cx,v);
    };
    const signature=field.components.map((c,id)=>{const [x0,x1,z0,z1]=field.bounds[id]!;return c.form==='gable'?[1,c.ridgeAlongX?1:0,x0!,x1!,z0!,z1!]:[2,field.anchors[id]!];});
    for(const {x,z} of built){const id=field.label[z*width+x]!;spread(x,z,ROOF_DEPENDENCY_REACH,[1,x,z,...signature[id]!]);spread(x,z,2,[3,walls.get(z*width+x)??-1]);}
    for(const {x,z} of natural)spread(x,z,2,[4,x,z,naturalKind[z*width+x]!]);
    const isNatural=(x:number,z:number)=>x>=0&&z>=0&&x<width&&z<height&&naturalKind[z*width+x]!>0;
    if(full){this.regions.invalidateLayout();for(const k of this.regions.keys())if(k>=columns*rows)this.regions.set(k,roofSoup(emptyRoofFaces()));this.dependencies.clear();}
    let rebuilt=0;
    for(let chunk=0;chunk<columns*rows;chunk++){
      const dependency=`${h1[chunk]}:${h2[chunk]}`;
      if(!full&&this.dependencies.get(chunk)===dependency)continue;
      this.dependencies.set(chunk,dependency);
      const cx=chunk%columns,cz=Math.floor(chunk/columns),x0=cx*ROOF_CHUNK_SIZE,z0=cz*ROOF_CHUNK_SIZE,x1=x0+ROOF_CHUNK_SIZE,z1=z0+ROOF_CHUNK_SIZE;
      const inside=(x:number,z:number)=>x>=x0&&x<x1&&z>=z0&&z<z1,ring=(x:number,z:number)=>!inside(x,z)&&x>=x0-1&&x<=x1&&z>=z0-1&&z<=z1;
      const drawn=emptyRoofFaces(),context=emptyRoofFaces();
      naturalSlabFaces(natural.filter(c=>inside(c.x,c.z)),isNatural,top,kindAt,drawn);
      naturalSlabFaces(natural.filter(c=>ring(c.x,c.z)),isNatural,top,kindAt,context);
      if(field.components.length){emitPitchedRoof(field,inside,x0,z0,x1,z1,drawn);emitPitchedRoof(field,ring,x0-1,z0-1,x1+1,z1+1,context);}
      if(drawn.triangles||this.regions.has(chunk)){this.regions.set(chunk,roofSoup(drawn),roofSoup(context));rebuilt++;}
    }
    this.layoutKey=layoutKey;this.surfaceKey=key;
    this.regions.commit();
    // A real roof adopted during a compile preparation replaces its warm cell.
    if(this.warm&&this.regions.triangles>0){this.warm.dispose();this.warm=undefined;}
    if(!this.warm)this.mesh.geometry=this.regions.geometry;
    this.regions.setBounds(new THREE.Sphere(new THREE.Vector3(width/2,top,height/2),Math.hypot(width/2+1,4,height/2+1)));
    this.mesh.visible=this.regions.triangles>0||!!this.warm;
    this.stats.lastRebuilt=rebuilt;this.stats.rebuilt+=rebuilt;this.stats.lastUpdateMs=performance.now()-started;
  }
  updateAreas(world:GroundOverlaySurface,build:readonly number[],remove:readonly number[],batches:BoxBatches,reset=false,known?:(cell:number)=>boolean):boolean {
    if(known){build=build.filter(known);remove=remove.filter(known);}
    const areaCells=[...build,...remove];
    const areaKey=`${world.width}|${build.join(',')}|${remove.join(',')}|${areaCells.map(i=>overlaySurfaceHeightAtCell(world,i%world.width,Math.floor(i/world.width))).join(',')}`;
    if(reset||this.areaKey!==areaKey){
      this.areaKey=areaKey;
      const parts=[
        ...build.map(i => ({ i, color: 0x7abca0 })),
        ...remove.map(i => ({ i, color: 0xd49d79 })),
      ].map(({ i, color }) => ({ x: i % world.width, z: Math.floor(i / world.width), y: (overlaySurfaceHeightAtCell(world,i%world.width,Math.floor(i/world.width))??0)+.054, sx: .98, sz: .98, sy: .012, color }));
      this.areaSurfaces=parts.length?groundOverlayPlacements(parts,.48):EMPTY_GROUND_OVERLAYS;
      batches.set(this.areas,'roof-areas',parts,'overlay',false);
      setGroundOverlayRenderOrder(this.areas,'roof-areas',GROUND_OVERLAY_RENDER_ORDER.roof);
      return true;
    }
    return false;
  }
  /** Compile both passes before any roof exists: one temporary cell. */
  prepare(): () => void {
    const surface = this.surface.visible, areas = this.areas.visible;
    let warm:THREE.BufferGeometry|undefined;
    if (this.regions.triangles===0&&!this.warm) {
      const faces=emptyRoofFaces();naturalSlabFaces([{x:0,z:0}],(x,z)=>x===0&&z===0,WORLD_SCALE.wallHeight+.08,()=>'natural-thin',faces);
      const data=ChunkedSurfaceMesh.data(roofSoup(faces),ROOF_FIELDS,0);warm=new THREE.BufferGeometry();
      for(const [name,values] of Object.entries(data))warm.setAttribute(name,new THREE.BufferAttribute(values,name==='uv'?2:name==='roofPart'?1:3));
      warm.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,3,0),2);
      this.warm=warm;this.mesh.geometry=warm;this.mesh.visible=true;
    }
    this.surface.visible = this.areas.visible = true;
    return () => {
      if (warm&&this.warm===warm) {this.warm=undefined;this.mesh.geometry=this.regions.geometry;warm.dispose();this.mesh.visible=this.regions.triangles>0;}
      this.surface.visible = surface; this.areas.visible = areas;
    };
  }
  dispose(): void {
    this.surface.remove(this.mesh);this.regions.dispose();this.warm?.dispose();
    this.textured.dispose(); this.plain.dispose(); this.paint.dispose();
  }
}
