/** Shared tree MODEL data. No material, texture style, painter, simulation
 * random state or render-preparation setting belongs to this catalogue. */
import * as THREE from 'three/webgpu';
import {appendFlora,type FloraParts} from '../flora-presentation';
import {noise} from '../StaticGeometry';
import {PATTERN_SPAN,physicalPatternSpan} from '../texture-variation';
import {WORLD_SCALE} from '../../world/scale';
import type {Resource,World} from '../../sim/types';
import type {ForestrySpecies291} from '../../sim/forestry-content-291';
import type {Placement} from '../primitives';
// This geometry-only chart compiler has no material/painter dependency.
import {compileBakedCharts,type BakedChartSet} from '../origami/baked/charts';

export type TreeModelSpecies=ForestrySpecies291;
export type TreeModelVariant='broadleaf'|'conical';
export type TreePrimitiveKind='trunk'|'crown'|'cone'|'cactus';
const speciesRecord:Readonly<Record<TreeModelSpecies,true>>=Object.freeze({oak:true,poplar:true,pine:true,birch:true,saguaro:true,drago:true,bamboo:true,cecropia:true,cypress:true,maple:true,palm:true,teak:true,willow:true});
export const TREE_MODEL_SPECIES=Object.freeze(Object.keys(speciesRecord) as TreeModelSpecies[]);
export const isTreeModelSpecies=(s:unknown):s is TreeModelSpecies=>typeof s==='string'&&Object.hasOwn(speciesRecord,s);
export const treeModelVariant=(world:Pick<World,'site'>):TreeModelVariant=>world.site!==undefined?'broadleaf':'conical';
export interface TreeModelPlacementRow {readonly id:string;readonly slot:string;readonly primitiveKind:TreePrimitiveKind;readonly canopy:boolean;readonly item:Placement}
export interface TreeModelFaceSlot {readonly id:number;readonly key:string;readonly triangles:readonly number[];readonly origin:readonly[number,number,number];readonly axisU:readonly[number,number,number];readonly axisV:readonly[number,number,number];readonly min:readonly[number,number];readonly max:readonly[number,number]}
export interface TreeModelPart {
 readonly id:string;readonly slot:string;readonly key:string;readonly canopy:boolean;readonly primitiveKind:TreePrimitiveKind;
 /** Borrowed immutable primitives; geometry expands the ORIGINAL index order.
  * uv remains the original primitive UV. modelSurfaceUv stores local planar
  * face XY and a face-local integer, not a compact texture-array layer. */
 readonly primitive:THREE.BufferGeometry;readonly geometry:THREE.BufferGeometry;readonly sourceCorner:Uint32Array;
 readonly canonicalPlacement:Readonly<Placement>;readonly faceSlots:readonly TreeModelFaceSlot[];
}
export interface TreeModel {
 readonly key:string;readonly species:TreeModelSpecies|undefined;readonly variant:TreeModelVariant;
 /** Stable global model address, never a compact cohort-page index: 0..27. */
 readonly surfaceSlot:number;readonly parts:readonly TreeModelPart[];readonly cpuBytes:number;
 assertCurrent():void;place(resource:Resource,turn:number,size:number):readonly{part:TreeModelPart;item:Placement}[]|undefined;
 createAtlasLayout():TreeModelAtlasLayout;
 retain():{assertCurrent():void;release():void};
}
export interface TreeModelCanonicalPart {readonly key:string;readonly geometry:THREE.BufferGeometry;readonly primitive:THREE.BufferGeometry;readonly sourceCorner:Uint32Array;readonly scale:readonly[number,number,number];readonly vertexOffset:number;readonly triangleOffset:number}
export interface TreeModelAtlasLayout {readonly charts:BakedChartSet;readonly canonicalParts:readonly TreeModelCanonicalPart[];readonly sourceAtlas:Readonly<{width:number;height:number}>;readonly slot:number}
const empty=():FloraParts=>({trunks:[],crowns:[],cones:[],bushes:[],blades:[],cacti:[],fruit:[]});
const validVariant=(v:TreeModelVariant)=>{if(v!=='broadleaf'&&v!=='conical')throw Error('Unknown tree model variant');};
/** Actual Legacy primitive factories, now shared by every surface treatment. */
export function createTreePrimitive(kind:TreePrimitiveKind,variant:TreeModelVariant):THREE.BufferGeometry{
 validVariant(variant);switch(kind){case'trunk':return new THREE.CylinderGeometry(.1,.16,1,5);case'crown':return variant==='broadleaf'?new THREE.IcosahedronGeometry(1,0):new THREE.ConeGeometry(1,1,6);case'cone':return new THREE.ConeGeometry(1,1,6);case'cactus':return new THREE.CylinderGeometry(.5,.5,1,5);}
}
/** Unquantized Legacy placement source. Explicit size bypasses floraSize;
 * kind=tree makes hydroponic support independent of World. The anonymous
 * historical path intentionally ignores size, exactly as ResourceLayer did. */
export function treeModelPlacements(resource:Resource,turn:number,size:number,variant:TreeModelVariant):readonly TreeModelPlacementRow[]{
 validVariant(variant);if(resource.kind!=='tree'||!Number.isFinite(turn)||!Number.isFinite(size)||size<0||!Number.isFinite(resource.x)||!Number.isFinite(resource.z))throw Error('Finite actual tree placement required');
 const shape=resource.species??'anonymous',rows:{kind:TreePrimitiveKind;canopy:boolean;item:Placement}[]=[];
 if(resource.species!==undefined){
  if(!isTreeModelSpecies(resource.species))throw Error('Unknown actual tree model species');const p=empty();Reflect.apply(appendFlora,undefined,[p,undefined,resource,turn,size]);
  if(p.bushes.length||p.blades.length||p.fruit.length)throw Error('Tree source emitted a non-tree primitive');
  rows.push(...p.trunks.map(item=>({kind:'trunk' as const,canopy:false,item})),...p.crowns.map(item=>({kind:'crown' as const,canopy:true,item})),...p.cones.map(item=>({kind:'cone' as const,canopy:true,item})),...p.cacti.map(item=>({kind:'cactus' as const,canopy:false,item})));
 }else{
  const {x,z,id}=resource,n=noise(x,z,77),height=WORLD_SCALE.treeMinHeight+n*(WORLD_SCALE.treeMaxHeight-WORLD_SCALE.treeMinHeight),radius=.8+n*.32,broadleaf=variant==='broadleaf';
  rows.push({kind:'trunk',canopy:false,item:{x,y:height*.25,z,sx:1.1,sy:height*.5,sz:1.1,ry:turn,color:0x70573e,key:id}},
   {kind:'crown',canopy:true,item:{x,y:height*(broadleaf?.62:.53),z,sx:radius,sy:height*(broadleaf?.21:.35),sz:radius,ry:turn,color:n>.65?0x657d56:0x526e50,key:id}},
   {kind:'crown',canopy:true,item:{x,y:height*(broadleaf?.83:.70),z,sx:radius*.72,sy:height*(broadleaf?.14:.34),sz:radius*.72,ry:turn+.3,color:n>.65?0x81925b:0x688557,key:id}});
 }
 const counts=new Map<string,number>();return rows.map(({kind,canopy,item},i)=>{const role=kind==='cactus'?'cactus':canopy?'canopy':'trunk',ordinal=counts.get(role)??0;counts.set(role,ordinal+1);return Object.freeze({id:`${shape}:${kind}:${i}`,slot:`${role}:${ordinal}`,primitiveKind:kind,canopy,item});});
}
/** Existing Pastel UV writer, including its per-resource crop and metric.
 * Pure construction work, never a per-frame operation. Source raw UV unchanged. */
export function treePastelUv(geometry:THREE.BufferGeometry,item:Readonly<Placement>):Float32Array{
 const uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal'),position=geometry.getAttribute('position');if(!uv||!normal||!position||uv.count!==position.count||normal.count!==position.count)throw Error('Source tree UV/normal streams required');
 const key=item.key??(Math.floor(item.x*257)^Math.floor(item.z*131)),phaseU=noise(key,Math.floor(item.x),191)*(1-PATTERN_SPAN),phaseV=noise(key,Math.floor(item.z),311)*(1-PATTERN_SPAN),out=new Float32Array(position.count*2);
 for(let i=0;i<position.count;i++){const[u,v]=physicalPatternSpan(item.sx??1,item.sy??1,item.sz??1,normal.getX(i),normal.getY(i));out[i*2]=item.rawGeometry?uv.getX(i):(uv.getX(i)-.5)*u+PATTERN_SPAN*.5+phaseU;out[i*2+1]=item.rawGeometry?uv.getY(i):(uv.getY(i)-.5)*v+PATTERN_SPAN*.5+phaseV;}return out;
}
/** Palette identity is intentionally separate from geometric identity. */
export function treeModelPaletteKey(rows:readonly TreeModelPlacementRow[]):string{return JSON.stringify(rows.map(row=>[row.slot,row.item.color??0xffffff]));}
const tuple=(v:THREE.Vector3):[number,number,number]=>[v.x,v.y,v.z];
function faceCoordinates(geometry:THREE.BufferGeometry,scale:readonly[number,number,number],partSlot:string){
 const p=geometry.getAttribute('position'),faces:{normal:THREE.Vector3;d:number;origin:THREE.Vector3;u:THREE.Vector3;v:THREE.Vector3;triangles:number[];vertices:number[]}[]=[];
 const point=(i:number)=>new THREE.Vector3(Math.fround(p.getX(i)*scale[0]),Math.fround(p.getY(i)*scale[1]),Math.fround(p.getZ(i)*scale[2]));
 for(let at=0;at<p.count;at+=3){const a=point(at),b=point(at+1),c=point(at+2),normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a));if(normal.lengthSq()<1e-20)throw Error('Degenerate tree model face');normal.normalize();const d=normal.dot(a);let face=faces.find(f=>f.normal.dot(normal)>1-1e-10&&Math.abs(f.d-d)<1e-6);if(!face){const u=b.clone().sub(a).normalize(),v=new THREE.Vector3().crossVectors(normal,u).normalize();face={normal,d,origin:a,u,v,triangles:[],vertices:[]};faces.push(face);}face.triangles.push(at/3);face.vertices.push(at,at+1,at+2);}
 const out=new Float32Array(p.count*3),slots:TreeModelFaceSlot[]=[];for(let id=0;id<faces.length;id++){const f=faces[id]!,min=new THREE.Vector2(Infinity,Infinity),max=new THREE.Vector2(-Infinity,-Infinity),coords=f.vertices.map(i=>{const d=point(i).sub(f.origin),q=new THREE.Vector2(d.dot(f.u),d.dot(f.v));min.min(q);max.max(q);return q;});for(let j=0;j<f.vertices.length;j++){const at=f.vertices[j]!*3,q=coords[j]!;out[at]=(q.x-min.x)/Math.max(1e-12,max.x-min.x);out[at+1]=(q.y-min.y)/Math.max(1e-12,max.y-min.y);out[at+2]=id;}slots.push(Object.freeze({id,key:`${partSlot}:face:${id}`,triangles:Object.freeze(f.triangles),origin:tuple(f.origin),axisU:tuple(f.u),axisV:tuple(f.v),min:[min.x,min.y] as const,max:[max.x,max.y] as const}));}geometry.setAttribute('modelSurfaceUv',new THREE.BufferAttribute(out,3));return Object.freeze(slots);
}
function geometryBytes(geometries:Iterable<THREE.BufferGeometry>,maps:Iterable<Uint32Array>){const seen=new Set<ArrayBufferLike>();for(const g of geometries){for(const a of Object.values(g.attributes))seen.add(a.array.buffer);if(g.index)seen.add(g.index.array.buffer);}for(const a of maps)seen.add(a.buffer);return[...seen].reduce((n,b)=>n+b.byteLength,0);}
/** Fixed layout belongs to the MODEL and exists before either texture can be
 * drawn. Semantic canonical-part IDs partition faces; no palette participates. */
function createAtlasLayout(parts:readonly TreeModelPart[],slot:number,owned:Set<THREE.BufferGeometry>,maxBytes:number):TreeModelAtlasLayout{
 const canonical:TreeModelCanonicalPart[]=[],seen=new Set<string>();let vertexOffset=0,triangleOffset=0;
 for(const p of parts)if(!seen.has(p.key)){seen.add(p.key);canonical.push(Object.freeze({key:p.key,geometry:p.geometry,primitive:p.primitive,sourceCorner:p.sourceCorner,scale:[p.canonicalPlacement.sx??1,p.canonicalPlacement.sy??1,p.canonicalPlacement.sz??1] as const,vertexOffset,triangleOffset}));vertexOffset+=p.geometry.getAttribute('position').count;triangleOffset+=p.geometry.getAttribute('position').count/3;}
 const positions:number[]=[],normals:number[]=[],uv:number[]=[],semantic:number[]=[],merged=new THREE.BufferGeometry();
 try{
  for(let part=0;part<canonical.length;part++){const c=canonical[part]!,g=c.geometry.clone();try{g.applyMatrix4(new THREE.Matrix4().makeScale(...c.scale));const p=g.getAttribute('position'),n=g.getAttribute('normal'),u=g.getAttribute('uv');for(let v=0;v<p.count;v++){positions.push(p.getX(v),p.getY(v),p.getZ(v));normals.push(n.getX(v),n.getY(v),n.getZ(v));uv.push(u.getX(v),u.getY(v));semantic.push(part);}}finally{g.dispose();}}
  merged.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));merged.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));merged.setAttribute('treeCanonicalPart',new THREE.Float32BufferAttribute(semantic,1));
  const charts=compileBakedCharts(merged,{texelsPerUnit:256,paddingTexels:8,mipLevels:4,maxAtlasSize:2048,maxAtlasPixels:2048**2,maxOutputBytes:maxBytes,maxTriangles:100});owned.add(charts.geometry);
  const sourceAtlas=Object.freeze({width:charts.atlas.width,height:charts.atlas.height}),baked=charts.geometry.getAttribute('bakedUv');for(let v=0;v<baked.count;v++)baked.setXY(v,baked.getX(v)*sourceAtlas.width/2048,baked.getY(v)*sourceAtlas.height/2048);charts.atlas.width=charts.atlas.height=2048;
  const sourceUv=new Float32Array(vertexOffset*2).fill(NaN);for(let v=0;v<charts.sourceVertex.length;v++){const at=charts.sourceVertex[v]!*2;if(Number.isFinite(sourceUv[at]!)&&(sourceUv[at]!==baked.getX(v)||sourceUv[at+1]!==baked.getY(v)))throw Error('Tree model UV seam requires original corner duplication');sourceUv[at]=baked.getX(v);sourceUv[at+1]=baked.getY(v);}if(sourceUv.some(v=>!Number.isFinite(v)))throw Error('Tree model atlas provenance incomplete');
  for(const c of canonical){const count=c.geometry.getAttribute('position').count,data=new Float32Array(count*3);for(let v=0;v<count;v++){data[v*3]=sourceUv[(c.vertexOffset+v)*2]!;data[v*3+1]=sourceUv[(c.vertexOffset+v)*2+1]!;data[v*3+2]=slot;}c.geometry.setAttribute('bakedUv',new THREE.BufferAttribute(data,3));}
  return Object.freeze({charts,canonicalParts:Object.freeze(canonical),sourceAtlas,slot});
 }finally{merged.dispose();}
}
/** Finite shape/variant library. Continuous variation is placement data, never
 * a new per-tree model/cache entry. Returned models/geometry are borrowed. */
export class TreeModels {
 private readonly models=new Map<string,TreeModel>();private readonly owned=new Set<THREE.BufferGeometry>();private closed=false;private retired=false;private holds=0;private bytes=0;
 constructor(private readonly maxCpuBytes=8*1024*1024){if(!Number.isSafeInteger(maxCpuBytes)||maxCpuBytes<1)throw Error('Explicit tree-model CPU budget required');}
 get(species:TreeModelSpecies|undefined,variant:TreeModelVariant='broadleaf'):TreeModel{
  if(this.closed)throw Error('Tree model library retired');validVariant(variant);if(species!==undefined&&!isTreeModelSpecies(species))throw Error('Unknown tree model species');const key=JSON.stringify(['tree-model-v1',species??'anonymous',variant]),cached=this.models.get(key);if(cached)return cached;
  if(this.bytes+256*1024>this.maxCpuBytes)throw Error('Tree-model budget refused BEFORE geometry allocation');
  const resource:Resource={id:1,kind:'tree',...(species?{species}:{}),x:0,z:0,amount:1,growth:1},rows=treeModelPlacements(resource,0,1,variant),parts:TreeModelPart[]=[],geometries=new Set<THREE.BufferGeometry>(),canons=new Map<string,{primitive:THREE.BufferGeometry;geometry:THREE.BufferGeometry;sourceCorner:Uint32Array;faceSlots:readonly TreeModelFaceSlot[]}>();let delivered=false;
  try{for(const row of rows){const scale=[row.item.sx??1,row.item.sy??1,row.item.sz??1] as const,shapeKey=JSON.stringify([row.primitiveKind,scale]);let canon=canons.get(shapeKey);if(!canon){const primitive=createTreePrimitive(row.primitiveKind,variant);geometries.add(primitive);const geometry=primitive.index?primitive.toNonIndexed():primitive.clone();geometries.add(geometry);const count=geometry.getAttribute('position').count,sourceCorner=Uint32Array.from({length:count},(_,v)=>primitive.index?.getX(v)??v),faceSlots=faceCoordinates(geometry,scale,row.slot);canon={primitive,geometry,sourceCorner,faceSlots};canons.set(shapeKey,canon);}parts.push(Object.freeze({...canon,faceSlots:Object.freeze(canon.faceSlots.map(f=>Object.freeze({...f,key:`${row.slot}:face:${f.id}`}))),id:row.id,slot:row.slot,key:JSON.stringify([key,shapeKey]),primitiveKind:row.primitiveKind,canopy:row.canopy,canonicalPlacement:Object.freeze({...row.item})}));}
   const surfaceSlot=(species===undefined?26:TREE_MODEL_SPECIES.indexOf(species)*2)+(variant==='conical'?1:0),layout=createAtlasLayout(parts,surfaceSlot,geometries,this.maxCpuBytes),cpuBytes=geometryBytes(geometries,[...canons.values()].map(c=>c.sourceCorner).concat([layout.charts.sourceVertex,layout.charts.triangleChart]))+parts.reduce((n,p)=>n+p.faceSlots.length*512+p.key.length*2+512,4096)+layout.charts.triangles.length*1024;if(this.bytes+cpuBytes>this.maxCpuBytes)throw Error('Tree-model retained budget exceeded');const assertCurrent=()=>{if(this.closed||this.retired)throw Error('Tree model library retired');},model:TreeModel={key,species,variant,surfaceSlot,parts:Object.freeze(parts),cpuBytes,assertCurrent,createAtlasLayout:()=>{assertCurrent();return layout;},retain:()=>{assertCurrent();this.holds++;let held=true;return{assertCurrent:()=>{if(!held)throw Error('Tree model lease released');assertCurrent();},release:()=>{if(!held)return;held=false;this.holds--;if(this.closed&&!this.holds)this.retire();}};},place:(r,turn,size)=>{assertCurrent();if(r.kind!=='tree'||r.species!==species)return undefined;const placed=treeModelPlacements(r,turn,size,variant);if(placed.length!==parts.length||placed.some((row,i)=>row.slot!==parts[i]!.slot||row.primitiveKind!==parts[i]!.primitiveKind))throw Error('Actual tree semantic slots changed');return placed.map((row,i)=>({part:parts[i]!,item:row.item}));}};for(const g of geometries)this.owned.add(g);this.bytes+=cpuBytes;this.models.set(key,model);delivered=true;return model;
  }finally{if(!delivered)for(const g of geometries)g.dispose();}
 }
 snapshot(){return{models:this.models.size,cpuBytes:this.bytes,leases:this.holds,closing:this.closed,scope:'Geometry/placement/UV only; no pixels or renderer resources'};}
 private retire(){if(this.retired)return;this.retired=true;const errors:unknown[]=[];for(const g of this.owned)try{g.dispose();}catch(e){errors.push(e);}this.owned.clear();this.models.clear();this.bytes=0;if(errors.length)throw new AggregateError(errors,'Tree model geometry cleanup');}
 dispose(){if(this.closed)return;this.closed=true;if(!this.holds)this.retire();}
}
