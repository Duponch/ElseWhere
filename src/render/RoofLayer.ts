import * as THREE from 'three/webgpu';
import {currentGraphicsStyle} from './graphics-style';
import {attribute,vec2,uv,texture} from 'three/tsl';
import {compileFaceStrokeTable} from './surfaces/FaceStrokeTable';
import {MutableFaceStrokeBank,type FaceStrokeBankRegion} from './surfaces/MutableFaceStrokeBank';
import {naturalStroke,SURFACE_STROKE_UV} from './surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from './surfaces/SharedPaintSurface';
import {roofCoverage,roofKindAt} from '../sim/roof-rules';
import { isRoomDoor } from '../sim/door-rules';
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
    if (s.kind !== 'wall' && !isRoomDoor(s.kind)) continue;
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

export class RoofLayer {
  readonly surface = new THREE.Group();
  readonly areas = new THREE.Group();
  areaSurfaces:readonly GroundOverlayRect[]=EMPTY_GROUND_OVERLAYS;
  readonly paint = roofPaint();
  readonly textured = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: .94, metalness: 0, flatShading: true, vertexColors: true, map: this.paint });
  readonly plain = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: .94, metalness: 0, flatShading: true, vertexColors: true });
  readonly mesh: THREE.Mesh;
  private readonly strokeBank=new MutableFaceStrokeBank();
  private surfaceRegion?:FaceStrokeBankRegion;
  private surfaceKey = '';
  private areaKey = '';
  private texturesEnabled = true;
  /** The continuous slab has world-absolute UVs and mutable unique faces.
   * No canonical repeated chart domain is proven; retain exact Source rather
   * than invent seams or allocate a per-cell atlas. This is an explicit route. */
  preparedSurfaceStatus(){return{pipeline:'continuous-roof-Source',representation:'source',fallback:'continuous-world-roof-no-canonical-domain',atlasLayers:0,visible:this.mesh.visible};}
  requestPreparedSurfaceQualityRoute(route:'source'|'prepared'|undefined):void {if(route==='prepared')throw Error('Continuous world roof has no admitted canonical prepared domain');}
  constructor(configure?: (material: THREE.MeshStandardNodeMaterial) => void,private readonly prepared?:(world:World)=>PreparedPhysicalRoofs|undefined) {
    for (const mat of [this.textured, this.plain]) { configure?.(mat); mat.userData.rendererOwned = true; }
    this.mesh = new THREE.Mesh(roofSlabGeometry([], WORLD_SCALE.wallHeight + .08), this.textured);
    this.mesh.name = 'continuous-roof-coverage';
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.visible = false; this.surface.add(this.mesh);
    this.mesh.geometry.setAttribute(SURFACE_STROKE_UV,new THREE.Float32BufferAttribute([],3));
    const context=currentGraphicsStyle();
    // Exact old roof UVs remain the Pastel source. The original Gouache
    // side-face projection supplies its own regular authored coordinates.
    const point=attribute('position','vec3'),normal=attribute('normal','vec3').abs(),paintUv=normal.y.greaterThan(.5).select(uv(),normal.x.greaterThan(.5).select(vec2(point.z,point.y).div(8),vec2(point.x,point.y).div(8))),address=attribute(SURFACE_STROKE_UV,'vec3'),base=attribute('color','vec3');
    this.textured.roughness=.88;this.textured.metalness=.02;
    const publishStroke=()=>applySharedPaintSurface(this.textured,{context,base,pastel:base.mul(texture(this.paint,uv()).rgb),faceUv:paintUv,stroke:naturalStroke(context,this.strokeBank,address.z,address.xy)});this.strokeBank.setPreparedRepresentationPublisher(()=>{publishStroke();this.textured.needsUpdate=true;});publishStroke();
    this.surface.visible = this.areas.visible = false;
  }
  setTexturesEnabled(enabled: boolean): void {
    if (this.texturesEnabled === enabled) return;
    this.texturesEnabled = enabled;
    this.mesh.material = enabled ? this.textured : this.plain;
  }
  update(world: World, batches: BoxBatches, cutaway = false, reset = false): void {
    this.updatePhysical(world,cutaway,reset);
    this.updateAreas(world,world.roofing?.build??[],world.roofing?.remove??[],batches,reset);
  }
  updatePhysical(world:World,cutaway=false,reset=false):void {
    const prepared=this.prepared?.(world),state=world.roofing;
    const key=prepared&&prepared.world===world?`${world.width}|${cutaway}|${prepared.tail}`:
      `${world.width}|${cutaway}|${roofCoverage(world).join(',')}|${state?.natural?.thin.join(',')}|${state?.natural?.thick.join(',')}|${world.structures.filter(s=>s.kind==='wall'||isRoomDoor(s.kind)).map(s=>`${s.kind}:${s.x}:${s.z}`).join(',')}`;
    if (reset || this.surfaceKey !== key) {
      const cells = prepared&&prepared.world===world?prepared.cells:roofSurfaceCells(world);
      const top = (cutaway ? WORLD_SCALE.wallCutawayHeight : WORLD_SCALE.wallHeight) + .08;
      const old = this.mesh.geometry,region=this.surfaceRegion,next=this.prepareSurfaceGeometry(roofSlabGeometry(cells, top,cell=>roofKindAt(world,cell.z*world.width+cell.x)));
      // Publish the identity only after bounded geometry/table admission has
      // succeeded. A refused allocation must leave the previous roof retryable.
      this.mesh.geometry=next.geometry;this.surfaceRegion=next.region;this.surfaceKey=key;region?.release();old.dispose();this.mesh.visible=cells.length>0;
    }
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
  prepare(): () => void {
    const surface = this.surface.visible, areas = this.areas.visible;
    const empty = this.mesh.geometry.getAttribute('position').count === 0;
    const original = this.mesh.geometry,originalRegion=this.surfaceRegion;
    let warm:THREE.BufferGeometry|undefined;
    if (empty) {
      const next=this.prepareSurfaceGeometry(roofSlabGeometry([{ x: 0, z: 0 }], WORLD_SCALE.wallHeight + .08));warm=next.geometry;
      this.mesh.geometry = warm;this.surfaceRegion=next.region;
      this.mesh.visible = true;
    }
    this.surface.visible = this.areas.visible = true;
    return () => {
      if (warm) {
        if(this.mesh.geometry===warm){this.surfaceRegion?.release();warm.dispose();this.mesh.geometry=original;this.surfaceRegion=originalRegion;this.mesh.visible=false;}
        else original.dispose(); // A newer world replaced and disposed warm.
      }
      this.surface.visible = surface; this.areas.visible = areas;
    };
  }
  dispose(): void {
    this.surfaceRegion?.release();this.surfaceRegion=undefined;
    this.surface.remove(this.mesh); this.mesh.geometry.dispose();
    this.textured.dispose(); this.plain.dispose(); this.paint.dispose();this.strokeBank.dispose();
  }

  private prepareSurfaceGeometry(geometry:THREE.BufferGeometry):{geometry:THREE.BufferGeometry;region?:FaceStrokeBankRegion}{
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),author=geometry.getAttribute('uv'),raw=new Float32Array(p.count*2);
    for(let v=0;v<p.count;v++){if(Math.abs(n.getY(v))>.5)raw.set([author.getX(v),author.getY(v)],v*2);else if(Math.abs(n.getX(v))>.5)raw.set([p.getZ(v)/8,p.getY(v)/8],v*2);else raw.set([p.getX(v)/8,p.getY(v)/8],v*2);}
    if(!p.count){geometry.setAttribute(SURFACE_STROKE_UV,new THREE.Float32BufferAttribute([],3));return{geometry};}
    geometry.setAttribute(SURFACE_STROKE_UV,new THREE.BufferAttribute(raw,2));let table:ReturnType<typeof compileFaceStrokeTable>|undefined,region:FaceStrokeBankRegion|undefined;
    try{table=compileFaceStrokeTable(geometry,{uvAttribute:SURFACE_STROKE_UV,maxTriangles:2000000,maxCpuBytes:256*1024*1024,mergeCoplanar:false,maxEdgesPerFace:3});region=this.strokeBank.publish(table);const address=new Float32Array(p.count*3);for(let v=0;v<p.count;v++)address.set([raw[v*2]!,raw[v*2+1]!,table.faceIds[v]!+region.faceOffset],v*3);geometry.setAttribute(SURFACE_STROKE_UV,new THREE.BufferAttribute(address,3));return{geometry,region};}catch(error){region?.release();geometry.dispose();throw error;}finally{table?.dispose();}
  }
}
