import * as THREE from 'three/webgpu';
import type { Placement } from './primitives';
import { PATTERN_SPAN,physicalPatternSpan } from './texture-variation';
const scratchColor = new THREE.Color();
const scratchReferenceColor = new THREE.Color();
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
export interface ResourceSurfaceIdentityWriter {identity(geometry:THREE.BufferGeometry,item:Placement):number}
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
/** The exact getX..getW values of the first `size` components of every item of
 * an attribute (denormalized like the accessors). A narrower attribute keeps a
 * plain array so an out-of-range accessor read stays `undefined`, as before. */
function components(attribute:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,size:1|2|3|4):ArrayLike<number>&{[index:number]:number}{
  const count=attribute.count,out:Float64Array|number[]=attribute.itemSize>=size?new Float64Array(count*size):new Array<number>(count*size);
  for(let i=0;i<count;i++){
    const at=i*size;out[at]=attribute.getX(i);
    if(size>1)out[at+1]=attribute.getY(i);
    if(size>2)out[at+2]=attribute.getZ(i);
    if(size>3)out[at+3]=attribute.getW(i);
  }
  return out;
}
/** Bit-identical to `BufferGeometry.computeBoundingSphere()` (three 0.186) for a
 * plain, non-normalized xyz Float32 position array without morph targets: same
 * Math.min/Math.max box, same (min+max)*0.5 center, same squared distances in
 * the same order. Reads the typed array directly instead of building a Vector3
 * per vertex twice. Returns undefined on NaN so the caller keeps three's report. */
export function exactBoundingSphere(positions:Float32Array):THREE.Sphere|undefined {
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let i=0;i+2<positions.length;i+=3){
    const x=positions[i]!,y=positions[i+1]!,z=positions[i+2]!;
    minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);
    maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);
  }
  const empty=maxX<minX||maxY<minY||maxZ<minZ;
  const cx=empty?0:(minX+maxX)*.5,cy=empty?0:(minY+maxY)*.5,cz=empty?0:(minZ+maxZ)*.5;
  let maxRadiusSq=0;
  for(let i=0;i+2<positions.length;i+=3){
    const dx=cx-positions[i]!,dy=cy-positions[i+1]!,dz=cz-positions[i+2]!;
    maxRadiusSq=Math.max(maxRadiusSq,dx*dx+dy*dy+dz*dz);
  }
  const radius=Math.sqrt(maxRadiusSq);
  return Number.isNaN(radius)?undefined:new THREE.Sphere(new THREE.Vector3(cx,cy,cz),radius);
}
export function mergedInstances(group: THREE.Group, parts: { geometry: THREE.BufferGeometry; items: Placement[] }[], mat: THREE.Material, shadows = true, includeUv = false,faceUv=false,packedSurface=false,prepared?:ResourceSurfaceIdentityWriter): THREE.Mesh | undefined {
  const vertexCount = parts.reduce((sum, part) => sum + part.geometry.getAttribute('position').count * part.items.length, 0);
  const indexCount = parts.reduce((sum, part) => sum + (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) * part.items.length, 0);
  if (!vertexCount) { for (const part of parts) part.geometry.dispose(); if (!mat.userData.rendererOwned) mat.dispose(); return; }
  const hasBakedUv=parts.some(part=>part.items.length>0&&part.geometry.hasAttribute('bakedUv'));
  if(hasBakedUv)for(const part of parts)if(part.items.length){const baked=part.geometry.getAttribute('bakedUv');if(!(baked instanceof THREE.BufferAttribute)||baked instanceof THREE.InstancedBufferAttribute||!(baked.array instanceof Float32Array)||baked.itemSize!==3||baked.count!==part.geometry.getAttribute('position').count)throw new Error('Prepared tree batches require ordinary bakedUv3 on every nonempty part');}
  const hasSurface=packedSurface||parts.some(part=>part.geometry.hasAttribute('surfaceStrokeFace'));
  // One ordinary vec4 keeps wind-enabled resources within WebGPU's eight
  // vertex-buffer limit. The profile word is an exact integer in Float32:
  // profile +128*(treeSlot +32*faceId), with slot31 meaning no tree cache.
  // Admission precedes the large output allocations and never quantizes IDs.
  if(hasSurface)for(const {geometry,items}of parts)if(items.length){
    const position=geometry.getAttribute('position'),raw=geometry.getAttribute('surfaceFaceUv')??geometry.getAttribute('uv'),strokeUv=geometry.getAttribute('surfaceStrokeUv')??geometry.getAttribute('uv'),strokeFace=geometry.getAttribute('surfaceStrokeFace'),sourcePaint=geometry.getAttribute('origamiPaint'),baked=geometry.getAttribute('bakedUv');
    for(const [name,a,size]of [['raw',raw,2],['stroke UV',strokeUv,2],['stroke face',strokeFace,1]] as const)if(!(a instanceof THREE.BufferAttribute)||a instanceof THREE.InstancedBufferAttribute||a.itemSize!==size||a.count!==position.count)throw Error(`Complete ordinary shared natural ${name} fields required before merge`);
    for(const item of items)if(item.profile!==undefined&&(!Number.isSafeInteger(item.profile)||item.profile<0||item.profile>=128))throw Error('Shared natural profile outside exact packed domain');
    const needsSourceProfile=items.some(item=>item.profile===undefined);
    for(let i=0;i<position.count;i++){
      const face=strokeFace!.getX(i),slot=packedSurface?(baked?.getZ(i)??31):0;
      if(!Number.isSafeInteger(face)||face<0||face>=4096||!Number.isSafeInteger(slot)||slot<0||(slot>27&&slot!==31))throw Error('Shared natural face/tree slot outside exact packed domain');
      const profile=needsSourceProfile?(sourcePaint?.getW(i)??0):0,word=profile+128*(packedSurface?slot+32*face:face);if(!Number.isSafeInteger(profile)||profile<0||profile>=128||word>=16777216)throw Error('Shared natural profile outside exact packed domain');
    }
  }
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
  const uvs = includeUv ? new Float32Array(vertexCount * 2) : undefined;
  const bakedUvs=hasBakedUv&&!packedSurface?new Float32Array(vertexCount*3):undefined;
  const hasProfiles=hasSurface||parts.some(part=>part.items.some(item=>item.profile!==undefined)||part.geometry.hasAttribute('origamiPaint'));
  const paint=hasProfiles?new Float32Array(vertexCount*4):undefined;
  const surfaceUvs=hasSurface?new Float32Array(vertexCount*4):undefined;
  const preparedIds=prepared?new Float32Array(vertexCount).fill(-1):undefined;
  const wearExpand=parts.some(part=>part.geometry.hasAttribute('origamiWearExpand'))?new Float32Array(vertexCount*3):undefined;
  const brush=parts.some(part=>resourceBrushData(part.geometry))?{base:new Float32Array(vertexCount*3),width:new Float32Array(vertexCount*3),rough:new Float32Array(vertexCount*3)}:undefined;
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vertex = 0, index = 0;
  const ranges:ResourceRange[] = [];
  for (const { geometry, items } of parts) {
    const pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv=geometry.getAttribute('uv'),sourcePaint=geometry.getAttribute('origamiPaint'),sourceExpand=geometry.getAttribute('origamiWearExpand'),sourceBakedUv=geometry.getAttribute('bakedUv');
    const sourceBrush=resourceBrushData(geometry);
    const rawFace=geometry.getAttribute('surfaceFaceUv')??uv,strokeUv=geometry.getAttribute('surfaceStrokeUv')??uv,strokeFace=geometry.getAttribute('surfaceStrokeFace');
    if(hasSurface&&items.length&&(!rawFace||!strokeUv||!strokeFace))throw Error('Complete shared natural surface fields required before merge');
    if(!items.length){geometry.dispose();continue;}
    // The template is read once per part (exact getX..getW values) instead of
    // through accessor calls for every item and vertex. Normal lengths depend
    // only on the template and the item scale, so equal scales share them.
    const count=pos.count,P=components(pos,3),N=components(normal,3),UV=uv?components(uv,2):undefined;
    const BU=sourceBakedUv?components(sourceBakedUv,3):undefined,RF=surfaceUvs?components(rawFace!,2):undefined,SU=surfaceUvs?components(strokeUv!,2):undefined,SF=strokeFace?components(strokeFace,1):undefined;
    const SPW=sourcePaint?components(sourcePaint,4):undefined,SE=sourceExpand?components(sourceExpand,3):undefined;
    const sourceIndex=geometry.index?components(geometry.index,1):undefined,indexLength=sourceIndex?sourceIndex.length:count;
    const lengthsByScale=new Map<string,Float64Array>();
    for (const item of items) {
      const preparedId=prepared?.identity(geometry,item)??-1;
      const firstIndex = index,firstVertex=vertex;
      // These vertices are baked only when a spatial chunk changes. Encode a
      // stable, resource-specific pigment crop in the existing UV stream.
      const pigmentKey=item.key??(Math.floor(item.x*257)^Math.floor(item.z*131));
      const phaseU=includeUv?noise(pigmentKey,Math.floor(item.x),191)*(1-PATTERN_SPAN):0;
      const phaseV=includeUv?noise(pigmentKey,Math.floor(item.z),311)*(1-PATTERN_SPAN):0;
      const sx = item.sx ?? 1, sy = item.sy ?? 1, sz = item.sz ?? 1;
      const cosine = Math.cos(item.ry ?? 0), sine = Math.sin(item.ry ?? 0);
      scratchColor.setHex(item.color ?? 0xffffff);
      const referenceColor=paint?scratchReferenceColor.setHex(item.referenceColor??item.color??0xffffff):undefined;
      const stonePigment=item.pigment==='stone';
      let facetX=NaN,facetZ=NaN,facetTint:readonly [number,number,number]=STONE_FACET_TINTS[0];
      const scaleKey=`${sx}|${sy}|${sz}`;let lengths=lengthsByScale.get(scaleKey);
      if(!lengths){lengths=new Float64Array(count);for(let i=0;i<count;i++)lengths[i]=Math.hypot(N[i*3]!/sx,N[i*3+1]!/sy,N[i*3+2]!/sz);lengthsByScale.set(scaleKey,lengths);}
      for (let i = 0; i < count; i++) {
        if(preparedIds)preparedIds[vertex+i]=preparedId;
        const i3=i*3,x = P[i3]! * sx, z = P[i3+2]! * sz;
        const nx = N[i3]! / sx, ny = N[i3+1]! / sy, nz = N[i3+2]! / sz;
        const length = lengths[i]!, offset = (vertex + i) * 3;
        positions[offset] = item.x + x * cosine + z * sine;
        positions[offset + 1] = item.y + P[i3+1]! * sy;
        positions[offset + 2] = item.z + z * cosine - x * sine;
        normals[offset] = (nx * cosine + nz * sine) / length;
        normals[offset + 1] = ny / length;
        normals[offset + 2] = (nz * cosine - nx * sine) / length;
        if(bakedUvs){bakedUvs[offset]=BU![i3]!;bakedUvs[offset+1]=BU![i3+1]!;bakedUvs[offset+2]=BU![i3+2]!;}
        if(surfaceUvs){const at=(vertex+i)*4;surfaceUvs[at]=RF![i*2]!;surfaceUvs[at+1]=RF![i*2+1]!;surfaceUvs[at+2]=packedSurface&&BU?BU[i3]!:SU![i*2]!;surfaceUvs[at+3]=packedSurface&&BU?BU[i3+1]!:SU![i*2+1]!;}
        if(paint){const at=(vertex+i)*4;paint[at]=referenceColor!.r;paint[at+1]=referenceColor!.g;paint[at+2]=referenceColor!.b;const profile=item.profile??SPW?.[i*4+3]??0;paint[at+3]=profile+(surfaceUvs?128*(packedSurface?(BU?.[i3+2]??31)+32*SF![i]!:SF![i]!):0);}
        if(wearExpand&&SE){const ex=SE[i3]!*sx,ey=SE[i3+1]!*sy,ez=SE[i3+2]!*sz;wearExpand[offset]=ex*cosine+ez*sine;wearExpand[offset+1]=ey;wearExpand[offset+2]=ez*cosine-ex*sine;}
        if(brush){
          const at=i3,bx=(sourceBrush?.base[at]??P[i3]!)*sx,by=(sourceBrush?.base[at+1]??P[i3+1]!)*sy,bz=(sourceBrush?.base[at+2]??P[i3+2]!)*sz;
          brush.base[offset]=item.x+bx*cosine+bz*sine;brush.base[offset+1]=item.y+by;brush.base[offset+2]=item.z+bz*cosine-bx*sine;
          for(const key of ['width','rough'] as const){const values=sourceBrush?.[key],vx=(values?.[at]??0)*sx,vy=(values?.[at+1]??0)*sy,vz=(values?.[at+2]??0)*sz;brush[key][offset]=vx*cosine+vz*sine;brush[key][offset+1]=vy;brush[key][offset+2]=vz*cosine-vx*sine;}
        }
        if(stonePigment) {
          // Dodecahedron normals are constant over each broad facet. Hashing
          // their quantized direction makes all vertices of a face share one
          // tone, stable across chunk rebuilds and independent of game PRNG.
          const nx=Math.round(N[i3]!*127),nz=Math.round(N[i3+2]!*127);
          if(nx!==facetX||nz!==facetZ){facetTint=STONE_FACET_TINTS[Math.min(5,Math.floor(noise(nx,nz,pigmentKey+701)*6))]!;facetX=nx;facetZ=nz;}
          colors[offset]=scratchColor.r*facetTint[0];colors[offset+1]=scratchColor.g*facetTint[1];colors[offset+2]=scratchColor.b*facetTint[2];
        } else {
          colors[offset] = scratchColor.r; colors[offset + 1] = scratchColor.g; colors[offset + 2] = scratchColor.b;
        }
        if(uvs){
          const uvOffset=(vertex+i)*2;
          if(faceUv||item.rawGeometry){uvs[uvOffset]=UV?.[i*2]??0;uvs[uvOffset+1]=UV?.[i*2+1]??0;}
          else{
            const [spanU,spanV]=physicalPatternSpan(sx,sy,sz,N[i3]!,N[i3+1]!);
            uvs[uvOffset]=((UV?.[i*2]??0)-.5)*spanU+PATTERN_SPAN*.5+phaseU;
            uvs[uvOffset+1]=((UV?.[i*2+1]??0)-.5)*spanV+PATTERN_SPAN*.5+phaseV;
          }
        }
      }
      for (let i = 0; i < indexLength; i++) indices[index++] = vertex + (sourceIndex ? sourceIndex[i]! : i);
      if (item.key !== undefined) ranges.push({id:item.key,start:firstIndex,count:index-firstIndex,vertexStart:firstVertex,vertexCount:count});
      vertex += count;
    }
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  if(preparedIds)geometry.userData.preparedResourceVariantIds=preparedIds;
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if(uvs)geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  if(bakedUvs)geometry.setAttribute('bakedUv',new THREE.BufferAttribute(bakedUvs,3));
  if(surfaceUvs)geometry.setAttribute('surfaceUv',new THREE.BufferAttribute(surfaceUvs,4));
  if(paint)geometry.setAttribute('origamiPaint',new THREE.BufferAttribute(paint,4));
  if(wearExpand)geometry.setAttribute('origamiWearExpand',new THREE.BufferAttribute(wearExpand,3));
  if(brush){geometry.userData.origamiBrushPrebuilt=true;geometry.userData.referenceBrushBasePositions=brush.base;geometry.userData.referenceBrushWidthOffsets=brush.width;geometry.userData.referenceBrushRoughOffsets=brush.rough;}
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const sphere=exactBoundingSphere(positions);
  if(sphere)geometry.boundingSphere=sphere;else geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = shadows; mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  if (ranges.length) mesh.userData.resourceRanges = {ranges,original:indices.slice(),originalPositions:positions.slice(),...(wearExpand?{originalWearExpandDirections:wearExpand.slice()}:{}),...(brush?{originalBrush:{base:brush.base.slice(),width:brush.width.slice(),rough:brush.rough.slice()}}:{})} satisfies ResourceRangeData;
  group.add(mesh);
  return mesh;
}
