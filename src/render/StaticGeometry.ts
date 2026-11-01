import * as THREE from 'three/webgpu';
import type { Placement } from './primitives';
import { PATTERN_SPAN,physicalPatternSpan } from './texture-variation';
const scratchColor = new THREE.Color();
// Painted stone facets use the existing RGB vertex stream; the shared
// resource material and its UV map remain unchanged. Values are linear-space
// multipliers, with broad warm/cool pastel planes rather than tiny speckles.
const STONE_FACET_TINTS = [
  [0.73,0.79,0.84], [0.80,0.83,0.76], [0.89,0.78,0.72],
  [1.00,0.94,0.86], [1.12,1.05,0.94], [1.03,1.10,1.16],
] as const;

export interface ResourceRange { id:number;start:number;count:number;vertexStart:number;vertexCount:number }
export interface ResourceRangeData {
  ranges:ResourceRange[];
  original:Uint16Array|Uint32Array;
  originalPositions:Float32Array;
  originalWearExpandDirections?:Float32Array;
  originalBrush?:ResourceBrushData;
}
export interface ResourceBrushData {base:Float32Array;width:Float32Array;rough:Float32Array}
export function resourceBrushData(geometry:THREE.BufferGeometry):ResourceBrushData|undefined {
  const base=geometry.userData.referenceBrushBasePositions as Float32Array|undefined,width=geometry.userData.referenceBrushWidthOffsets as Float32Array|undefined,rough=geometry.userData.referenceBrushRoughOffsets as Float32Array|undefined;
  return base&&width&&rough?{base,width,rough}:undefined;
}

export function noise(x: number, z: number, salt = 0): number {
  let value = Math.imul(x + 1, 374761393) ^ Math.imul(z + 1, 668265263) ^ Math.imul(salt + 1, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Static chunk meshes batch different procedural shapes together. Their exact
 * per-cell silhouettes and colors stay intact; only submissions are combined.
 * Dynamic pawns and cargo remain GPU-instanced and are never baked here.
 */
export function mergedInstances(group: THREE.Group, parts: { geometry: THREE.BufferGeometry; items: Placement[] }[], mat: THREE.Material, shadows = true, includeUv = false,faceUv=false): THREE.Mesh | undefined {
  const vertexCount = parts.reduce((sum, part) => sum + part.geometry.getAttribute('position').count * part.items.length, 0);
  const indexCount = parts.reduce((sum, part) => sum + (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) * part.items.length, 0);
  if (!vertexCount) { for (const part of parts) part.geometry.dispose(); if (!mat.userData.rendererOwned) mat.dispose(); return; }
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
  const uvs = includeUv ? new Float32Array(vertexCount * 2) : undefined;
  const hasProfiles=parts.some(part=>part.items.some(item=>item.profile!==undefined)||part.geometry.hasAttribute('origamiPaint'));
  const paint=hasProfiles?new Float32Array(vertexCount*4):undefined;
  const wearExpand=parts.some(part=>part.geometry.hasAttribute('origamiWearExpand'))?new Float32Array(vertexCount*3):undefined;
  const brush=parts.some(part=>resourceBrushData(part.geometry))?{base:new Float32Array(vertexCount*3),width:new Float32Array(vertexCount*3),rough:new Float32Array(vertexCount*3)}:undefined;
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vertex = 0, index = 0;
  const ranges:ResourceRange[] = [];
  for (const { geometry, items } of parts) {
    const pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv=geometry.getAttribute('uv'),sourcePaint=geometry.getAttribute('origamiPaint'),sourceExpand=geometry.getAttribute('origamiWearExpand');
    const sourceBrush=resourceBrushData(geometry);
    for (const item of items) {
      const firstIndex = index,firstVertex=vertex;
      // These vertices are baked only when a spatial chunk changes. Encode a
      // stable, resource-specific pigment crop in the existing UV stream.
      const pigmentKey=item.key??(Math.floor(item.x*257)^Math.floor(item.z*131));
      const phaseU=includeUv?noise(pigmentKey,Math.floor(item.x),191)*(1-PATTERN_SPAN):0;
      const phaseV=includeUv?noise(pigmentKey,Math.floor(item.z),311)*(1-PATTERN_SPAN):0;
      const sx = item.sx ?? 1, sy = item.sy ?? 1, sz = item.sz ?? 1;
      const cosine = Math.cos(item.ry ?? 0), sine = Math.sin(item.ry ?? 0);
      scratchColor.setHex(item.color ?? 0xffffff);
      const referenceColor=paint?new THREE.Color(item.referenceColor??item.color??0xffffff):undefined;
      const stonePigment=item.pigment==='stone';
      let facetX=NaN,facetZ=NaN,facetTint:readonly [number,number,number]=STONE_FACET_TINTS[0];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) * sx, z = pos.getZ(i) * sz;
        const nx = normal.getX(i) / sx, ny = normal.getY(i) / sy, nz = normal.getZ(i) / sz;
        const length = Math.hypot(nx, ny, nz), offset = (vertex + i) * 3;
        positions[offset] = item.x + x * cosine + z * sine;
        positions[offset + 1] = item.y + pos.getY(i) * sy;
        positions[offset + 2] = item.z + z * cosine - x * sine;
        normals[offset] = (nx * cosine + nz * sine) / length;
        normals[offset + 1] = ny / length;
        normals[offset + 2] = (nz * cosine - nx * sine) / length;
        if(paint){const at=(vertex+i)*4;paint[at]=referenceColor!.r;paint[at+1]=referenceColor!.g;paint[at+2]=referenceColor!.b;paint[at+3]=item.profile??sourcePaint?.getW(i)??0;}
        if(wearExpand&&sourceExpand){const ex=sourceExpand.getX(i)*sx,ey=sourceExpand.getY(i)*sy,ez=sourceExpand.getZ(i)*sz;wearExpand[offset]=ex*cosine+ez*sine;wearExpand[offset+1]=ey;wearExpand[offset+2]=ez*cosine-ex*sine;}
        if(brush){
          const at=i*3,bx=(sourceBrush?.base[at]??pos.getX(i))*sx,by=(sourceBrush?.base[at+1]??pos.getY(i))*sy,bz=(sourceBrush?.base[at+2]??pos.getZ(i))*sz;
          brush.base[offset]=item.x+bx*cosine+bz*sine;brush.base[offset+1]=item.y+by;brush.base[offset+2]=item.z+bz*cosine-bx*sine;
          for(const key of ['width','rough'] as const){const values=sourceBrush?.[key],vx=(values?.[at]??0)*sx,vy=(values?.[at+1]??0)*sy,vz=(values?.[at+2]??0)*sz;brush[key][offset]=vx*cosine+vz*sine;brush[key][offset+1]=vy;brush[key][offset+2]=vz*cosine-vx*sine;}
        }
        if(stonePigment) {
          // Dodecahedron normals are constant over each broad facet. Hashing
          // their quantized direction makes all vertices of a face share one
          // tone, stable across chunk rebuilds and independent of game PRNG.
          const nx=Math.round(normal.getX(i)*127),nz=Math.round(normal.getZ(i)*127);
          if(nx!==facetX||nz!==facetZ){facetTint=STONE_FACET_TINTS[Math.min(5,Math.floor(noise(nx,nz,pigmentKey+701)*6))]!;facetX=nx;facetZ=nz;}
          colors[offset]=scratchColor.r*facetTint[0];colors[offset+1]=scratchColor.g*facetTint[1];colors[offset+2]=scratchColor.b*facetTint[2];
        } else {
          colors[offset] = scratchColor.r; colors[offset + 1] = scratchColor.g; colors[offset + 2] = scratchColor.b;
        }
        if(uvs){
          const uvOffset=(vertex+i)*2;
          const [spanU,spanV]=physicalPatternSpan(sx,sy,sz,normal.getX(i),normal.getY(i));
          uvs[uvOffset]=faceUv||item.rawGeometry?(uv?.getX(i)??0):((uv?.getX(i)??0)-.5)*spanU+PATTERN_SPAN*.5+phaseU;
          uvs[uvOffset+1]=faceUv||item.rawGeometry?(uv?.getY(i)??0):((uv?.getY(i)??0)-.5)*spanV+PATTERN_SPAN*.5+phaseV;
        }
      }
      for (let i = 0; i < (geometry.index?.count ?? pos.count); i++) indices[index++] = vertex + (geometry.index?.getX(i) ?? i);
      if (item.key !== undefined) ranges.push({id:item.key,start:firstIndex,count:index-firstIndex,vertexStart:firstVertex,vertexCount:pos.count});
      vertex += pos.count;
    }
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if(uvs)geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  if(paint)geometry.setAttribute('origamiPaint',new THREE.BufferAttribute(paint,4));
  if(wearExpand)geometry.setAttribute('origamiWearExpand',new THREE.BufferAttribute(wearExpand,3));
  if(brush){geometry.userData.origamiBrushPrebuilt=true;geometry.userData.referenceBrushBasePositions=brush.base;geometry.userData.referenceBrushWidthOffsets=brush.width;geometry.userData.referenceBrushRoughOffsets=brush.rough;}
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = shadows; mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  if (ranges.length) mesh.userData.resourceRanges = {ranges,original:indices.slice(),originalPositions:positions.slice(),...(wearExpand?{originalWearExpandDirections:wearExpand.slice()}:{}),...(brush?{originalBrush:{base:brush.base.slice(),width:brush.width.slice(),rough:brush.rough.slice()}}:{})} satisfies ResourceRangeData;
  group.add(mesh);
  return mesh;
}
