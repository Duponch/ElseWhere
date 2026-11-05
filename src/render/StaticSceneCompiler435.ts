import * as THREE from 'three/webgpu';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';
import {createSourceOwnedRenderHook435} from './SourceOwnedRenderHooks435';
import {StaticGeometryArena435,staticArenaBlockReserve435} from './StaticGeometryArena435';
import type {StaticArenaAllocation435} from './StaticGeometryArena435';
import {markResidentAttributeRange} from './resident-attribute-range';

type SourceTag={key:string;quadrant:0|1|2|3;partitions:2|4};
const sourceTags=new WeakMap<THREE.Mesh,SourceTag>();
const hiddenSourceLayers=new WeakMap<THREE.Object3D,number>();
/** Producer companions retain the intended layer selection while the compiler
 * temporarily suppresses only their original opaque surface draw. */
export function staticSceneSourceLayers435(source:THREE.Object3D):number{return source.layers.mask===0?(hiddenSourceLayers.get(source)??0):source.layers.mask;}
/** Called by the resource producer when constructing its body/canopy mesh.
 * A stable chunk/role key survives geometry replacement; no geometry hash or
 * mutable position/bounds determines slot identity or the spatial page. */
export function setStaticSceneSource435(source:THREE.Mesh,key:string,quadrant:0|1|2|3,partitions:2|4=4):void{if(quadrant>=partitions)throw new RangeError('Static source bucket outside its producer partition.');sourceTags.set(source,{key,quadrant,partitions});}

type Choice={source:THREE.Mesh;root:THREE.Object3D;material:THREE.NodeMaterial;key:string;sourceKey:string;signature:string;names:string[];attributes:THREE.BufferAttribute[];index:THREE.BufferAttribute;start:number;count:number;layers:number;quadrant:0|1|2|3|undefined;partitions:2|4|undefined};
type CopyRun={sourceStart:number;count:number;slotStart:number};
type Mapping={remap:Int32Array;vertexCount:number;sourceRuns:CopyRun[];slotRuns:CopyRun[]};
type Block=Mapping&{key:string;attributes:THREE.BufferAttribute[];names:string[];versions:number[];allocation:StaticArenaAllocation435};
type CachedSource={signature:string;stamp:string;block:Block;offset:number;indices:Uint32Array};
type Page={key:string;root:THREE.Object3D;mesh:THREE.Mesh;arena:StaticGeometryArena435;choices:Choice[];blocks:Map<string,Block>;sources:Map<string,CachedSource>;indices:number;indexOrder:string;quadrant:number|undefined};
const identity=new THREE.Matrix4();
function identityChain(object:THREE.Object3D):boolean{for(let at:THREE.Object3D|null=object;at;at=at.parent)if(!at.matrix.equals(identity)||!at.matrixWorld.equals(identity))return false;return true;}
function visibleBelow(object:THREE.Object3D,root:THREE.Object3D):boolean{for(let at:THREE.Object3D|null=object;at&&at!==root;at=at.parent)if(!at.visible)return false;return true;}
function visibleChain(object:THREE.Object3D):boolean{for(let at:THREE.Object3D|null=object;at;at=at.parent)if(!at.visible)return false;return true;}
function words(attribute:THREE.BufferAttribute):Uint32Array{return new Uint32Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.length);}

/** Genuine resident geometry pages, bounded to eight. Producers retain their
 * CPU authority; adoption patches changed blocks and compacts typed indices.
 * Cameras only change native page culling/visibility, never arena contents. */
export class StaticSceneCompiler435 {
 private readonly pages=new Map<string,Page>();
 private readonly containers=new Map<THREE.Object3D,THREE.Group>();
 private readonly hidden=new Map<THREE.Mesh,number>();
 private readonly blockedRoots=new Set<THREE.Object3D>();
 private readonly links=new Map<THREE.BufferAttribute,{page:Page;block:Block;attribute:number}[]>();
 private readonly ids=new WeakMap<object,number>();private nextId=1;private disposed=false;
 readonly stats={reconciles:0,rebuilds:0,blockReplacements:0,blockRelocations:0,indexPatches:0,indexSourceRemaps:0,attributePatches:0,patchVertexVisits:0,sourceRangeCoalesces:0,copiedBytes:0,bulkSetCalls:0,bulkCopiedWords:0,copyRunVisits:0,runSearchSteps:0,referenceSorts:0,eligibleObjects:0,candidateFamilies:0,unmergedNativeObjects:0,sourceObjects:0,pageObjects:0,sourceActiveTriangles:0,compiledActiveTriangles:0,fallbacks:0,rejected:{}as Record<string,number>};
 private readonly offered=new Map<THREE.Camera,{entries:number;triangles:number}>();
 constructor(private readonly scene:THREE.Scene,private readonly maxPages=8,private readonly ownedProducer435?:OwnedOpaqueProducer435){if(!Number.isInteger(maxPages)||maxPages<1||maxPages>8)throw new RangeError('Static compiler page budget must be1..8.');}
 private id(value:object):number{let id=this.ids.get(value);if(id===undefined){id=this.nextId++;this.ids.set(value,id);}return id;}
 private reject(reason:string):null{this.stats.rejected[reason]=(this.stats.rejected[reason]??0)+1;return null;}
 private choice(source:THREE.Mesh,root:THREE.Object3D,knownMaterials:ReadonlySet<THREE.NodeMaterial>):Choice|null{
  const geometry=source.geometry,material=source.material;
  if(Array.isArray(material)||!(material instanceof THREE.NodeMaterial)||material.transparent||material.opacity!==1||!material.visible||Reflect.get(material,'wireframe')||Reflect.get(material,'transmission')||material.backdropNode)return this.reject('non-opaque-or-foreign-material');
  if(!knownMaterials.has(material))return this.reject('unowned-material-program');
  if(geometry instanceof THREE.InstancedBufferGeometry||source instanceof THREE.InstancedMesh||source instanceof THREE.BatchedMesh||source instanceof THREE.SkinnedMesh||Object.keys(geometry.morphAttributes).length)return this.reject('non-ordinary-geometry');
  if(source.customDepthMaterial||source.customDistanceMaterial||geometry.indirect!==null)return this.reject('custom-shadow-or-indirect');
  if(!identityChain(source))return this.reject('transformed-source-or-parent');
  for(let at:THREE.Object3D|null=source.parent;at;at=at.parent)if((at instanceof THREE.Group&&at.renderOrder!==0)||Reflect.get(at,'isClippingGroup'))return this.reject('group-order-or-clipping');
  if(source.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||source.onAfterRender!==THREE.Object3D.prototype.onAfterRender||source.onBeforeShadow!==THREE.Object3D.prototype.onBeforeShadow||source.onAfterShadow!==THREE.Object3D.prototype.onAfterShadow)return this.reject('custom-callback');
  const position=geometry.getAttribute('position'),index=geometry.index;
  if(!(position instanceof THREE.BufferAttribute)||!index||!geometry.boundingSphere||!source.layers.mask)return this.reject('missing-position-index-bounds-layer');
  const names=Object.keys(geometry.attributes).sort(),attributes:THREE.BufferAttribute[]=[];
  for(const name of names){const a=geometry.getAttribute(name);if(!(a instanceof THREE.BufferAttribute)||a instanceof THREE.InstancedBufferAttribute||!(a.array instanceof Float32Array)||a.count!==position.count||a.normalized||a.gpuType!==THREE.FloatType)return this.reject('unsupported-layout');attributes.push(a);}
  if(!(index.array instanceof Uint16Array)&&!(index.array instanceof Uint32Array))return this.reject('unsupported-index');
  const start=geometry.drawRange.start,count=Math.min(geometry.drawRange.count,index.count-start);
  if(!Number.isInteger(start)||start<0||!Number.isInteger(count)||count<0||start%3||count%3)return this.reject('invalid-triangle-range');
  // Empty retained producers must not consume a spatial family/page budget.
  // They remain resident and can be admitted again when their index restores.
  if(count===0)return null;
  const tag=sourceTags.get(source),layout=names.map((name,i)=>`${name}:${attributes[i]!.itemSize}`).join(','),layers=source.layers.mask;
  const key=[this.id(root),material.uuid,source.castShadow,source.receiveShadow,source.renderOrder,source.frustumCulled,layers,layout].join('|');
  const signature=[this.id(geometry),this.id(index),...attributes.map(a=>this.id(a)),position.count].join(':');
  return{source,root,material,key,sourceKey:tag?`owned:${tag.key}`:`object:${this.id(source)}`,signature,names,attributes,index,start,count,layers,quadrant:tag?.quadrant,partitions:tag?.partitions};
 }
 private restoreSources():void{for(const[source,layers]of this.hidden){if(source.layers.mask===0)source.layers.mask=layers;hiddenSourceLayers.delete(source);}this.hidden.clear();}
 private release(page:Page):void{this.ownedProducer435?.forget(page.mesh);page.mesh.removeFromParent();page.arena.dispose();}
 private container(root:THREE.Object3D):THREE.Group{
  let group=this.containers.get(root);if(!group){group=new THREE.Group();group.name='compiled-static-world435';group.matrixAutoUpdate=false;this.scene.add(group);this.containers.set(root,group);}return group;
 }
 private blockKey(choice:Choice):string{return choice.sourceKey.startsWith('owned:')?choice.sourceKey:`attributes:${choice.attributes.map(a=>this.id(a)).join(':')}`;}
 private stamp(choice:Choice):string{return`${this.id(choice.index)}:${choice.index.version}:${choice.start}:${choice.count}`;}
 private groups(choices:readonly Choice[]):Map<string,Choice[]>{const grouped=new Map<string,Choice[]>();for(const choice of choices){const key=this.blockKey(choice),rows=grouped.get(key)??[];rows.push(choice);grouped.set(key,rows);}return grouped;}
 private appendReferences(block:Mapping,choices:readonly Choice[]):void{
  const added:number[]=[];let ascending=true,previous=-1;
  for(const choice of choices)for(let i=choice.start;i<choice.start+choice.count;i++){
   const vertex=choice.index.getX(i);if(!Number.isInteger(vertex)||vertex<0||vertex>=block.remap.length)throw new Error('Static arena source index outside its attribute owner.');
   if(block.remap[vertex]===-1){block.remap[vertex]=-2;added.push(vertex);if(vertex<previous)ascending=false;previous=vertex;}
  }
  if(!added.length)return;
  // Native numeric sorting occurs only when real index membership introduces
  // previously unseen vertices. Existing source->slot mappings never move.
  const ordered=Uint32Array.from(added);if(!ascending){ordered.sort();this.stats.referenceSorts++;}
  const runs:CopyRun[]=[];
  for(const vertex of ordered){const slot=block.vertexCount++;block.remap[vertex]=slot;const last=runs[runs.length-1];if(last&&last.sourceStart+last.count===vertex)last.count++;else runs.push({sourceStart:vertex,count:1,slotStart:slot});}
  for(const run of runs)block.slotRuns.push(run);
  const previousRuns=block.sourceRuns,merged:CopyRun[]=[];let old=0,addedRun=0;
  while(old<previousRuns.length&&addedRun<runs.length)merged.push(previousRuns[old]!.sourceStart<runs[addedRun]!.sourceStart?previousRuns[old++]!:runs[addedRun++]!);
  while(old<previousRuns.length)merged.push(previousRuns[old++]!);while(addedRun<runs.length)merged.push(runs[addedRun++]!);block.sourceRuns=merged;
 }
 private newMapping(choices:readonly Choice[]):Mapping{const result:Mapping={remap:new Int32Array(choices[0]!.attributes[0]!.count).fill(-1),vertexCount:0,sourceRuns:[],slotRuns:[]};this.appendReferences(result,choices);return result;}
 private retainedVersion(attribute:THREE.BufferAttribute):number{if(attribute.updateRanges.length>1){const first=attribute.updateRanges[0]!;markResidentAttributeRange(attribute,first.start,first.count);this.stats.sourceRangeCoalesces++;}return attribute.version;}
 private create(key:string,choices:Choice[],quadrant:number|undefined):Page{
  const first=choices[0]!,grouped=this.groups(choices),planned=new Map<string,Mapping>();let capacity=0;
  for(const[blockKey,rows]of grouped){const mapping=this.newMapping(rows);planned.set(blockKey,mapping);capacity+=staticArenaBlockReserve435(mapping.vertexCount);}
  const arena=new StaticGeometryArena435(first.names.map((name,i)=>({name,itemSize:first.attributes[i]!.itemSize})),capacity,choices.reduce((n,c)=>n+c.count,0));
  const mesh=new THREE.Mesh(arena.geometry,first.material);mesh.name=`compiled-static-page435:${key}`;mesh.matrixAutoUpdate=false;mesh.castShadow=first.source.castShadow;mesh.receiveShadow=first.source.receiveShadow;mesh.renderOrder=first.source.renderOrder;mesh.frustumCulled=first.source.frustumCulled;mesh.layers.mask=first.layers;
  const page:Page={key,root:first.root,mesh,arena,choices,blocks:new Map(),sources:new Map(),indices:0,indexOrder:'',quadrant};
  for(const[blockKey,rows]of grouped){const source=rows[0]!,mapping=planned.get(blockKey)!,block:Block={key:blockKey,attributes:source.attributes,names:source.names,...mapping,versions:source.attributes.map(a=>this.retainedVersion(a)),allocation:arena.allocate(mapping.vertexCount)};page.blocks.set(blockKey,block);for(let a=0;a<block.attributes.length;a++)this.copyVertices(page,block,a,0,block.vertexCount);}
  mesh.onBeforeRender=createSourceOwnedRenderHook435<THREE.Mesh,Parameters<THREE.Mesh['onBeforeRender']>,void>((_renderer,_scene,camera)=>{const previous=this.offered.get(camera)??{entries:0,triangles:0};previous.entries++;previous.triangles+=page.indices/3;this.offered.set(camera,previous);});
  this.container(first.root).add(mesh);this.writeIndices(page,choices);this.bounds(page);this.ownedProducer435?.register(mesh,[first.material],[],{beforeRender:mesh.onBeforeRender});this.stats.rebuilds++;return page;
 }
 private bounds(page:Page):void{const sphere=new THREE.Sphere();for(const c of page.choices)if(c.count)sphere.union(c.source.geometry.boundingSphere!);page.arena.geometry.boundingSphere=sphere;}
 private mark(attribute:THREE.BufferAttribute,start:number,end:number):void{const previous=attribute.updateRanges[0];if(previous){const priorEnd=previous.start+previous.count;previous.start=Math.min(previous.start,start);previous.count=Math.max(priorEnd,end)-previous.start;attribute.updateRanges.splice(1);}else attribute.addUpdateRange(start,end-start);attribute.needsUpdate=true;}
 /** Locate only intersecting runs. Source and slot directories have the same
  * immutable run records, ordered independently for their lookup coordinate. */
 private firstRun(runs:readonly CopyRun[],first:number,bySource:boolean):number{
  let low=0,high=runs.length;while(low<high){this.stats.runSearchSteps++;const middle=(low+high)>>>1,run=runs[middle]!,start=bySource?run.sourceStart:run.slotStart;if(start+run.count<=first)low=middle+1;else high=middle;}return low;
 }
 /** Copy compact slots with native word spans, including appended suffixes or
  * relocated blocks. No JavaScript vertex/component copy loop remains here. */
 private copyVertices(page:Page,block:Block,a:number,first:number,last:number):void{
  if(last<=first)return;
  const source=block.attributes[a]!,target=page.arena.geometry.getAttribute(block.names[a]!) as THREE.BufferAttribute,from=words(source),to=words(target),size=source.itemSize;
  for(let i=this.firstRun(block.slotRuns,first,false);i<block.slotRuns.length;i++){
   const run=block.slotRuns[i]!;if(run.slotStart>=last)break;this.stats.copyRunVisits++;
   const lo=Math.max(first,run.slotStart),hi=Math.min(last,run.slotStart+run.count),sourceFirst=run.sourceStart+lo-run.slotStart,count=(hi-lo)*size;
   to.set(from.subarray(sourceFirst*size,sourceFirst*size+count),(block.allocation.offset+lo)*size);this.stats.bulkSetCalls++;this.stats.bulkCopiedWords+=count;
  }
  this.mark(target,(block.allocation.offset+first)*size,(block.allocation.offset+last)*size);this.stats.copiedBytes+=(last-first)*size*4;this.stats.attributePatches++;
 }
 /** Partial writer receipts never acknowledge the global attribute version. */
 private copyRange(page:Page,block:Block,a:number,start:number,count:number):void{
  const source=block.attributes[a]!,target=page.arena.geometry.getAttribute(block.names[a]!) as THREE.BufferAttribute,from=words(source),to=words(target),size=source.itemSize;
  const first=Math.max(0,Math.floor(start/size)),last=Math.min(source.count,Math.ceil((start+count)/size));let low=Infinity,high=-1,copied=0;this.stats.patchVertexVisits+=Math.max(0,last-first);
  for(let i=this.firstRun(block.sourceRuns,first,true);i<block.sourceRuns.length;i++){
   const run=block.sourceRuns[i]!;if(run.sourceStart>=last)break;this.stats.copyRunVisits++;
   const lo=Math.max(first,run.sourceStart),hi=Math.min(last,run.sourceStart+run.count),offset=(block.allocation.offset+run.slotStart+lo-run.sourceStart)*size,count=(hi-lo)*size;
   to.set(from.subarray(lo*size,lo*size+count),offset);low=Math.min(low,offset);high=Math.max(high,offset+count);copied+=count*4;this.stats.bulkSetCalls++;this.stats.bulkCopiedWords+=count;
  }
  if(copied){this.mark(target,low,high);this.stats.copiedBytes+=copied;this.stats.attributePatches++;}
 }
 patchAttribute(attribute:THREE.BufferAttribute,start:number,count:number):void{const dirty=new Set<THREE.Mesh>();for(const link of this.links.get(attribute)??[]){this.copyRange(link.page,link.block,link.attribute,start,count);dirty.add(link.page.mesh);}for(const mesh of dirty)this.ownedProducer435?.dirty(mesh);}
 private completeVersions(page:Page,block:Block):void{
  for(let a=0;a<block.attributes.length;a++){const source=block.attributes[a]!;if(source.version===block.versions[a])continue;
   const version=this.retainedVersion(source);if(source.updateRanges.length)for(const range of source.updateRanges)this.copyRange(page,block,a,range.start,range.count);else this.copyVertices(page,block,a,0,block.vertexCount);block.versions[a]=version;}
 }
 private update(page:Page,choices:Choice[]):void{
  const grouped=this.groups(choices),oldGeometry=page.arena.geometry,growthBytes=page.arena.stats.growthCopiedBytes;page.choices=choices;
  for(const[key,block]of page.blocks)if(!grouped.has(key)){page.arena.release(block.allocation);page.blocks.delete(key);}
  for(const[key,rows]of grouped){const first=rows[0]!,old=page.blocks.get(key),same=old&&old.attributes.length===first.attributes.length&&old.attributes.every((attribute,i)=>attribute===first.attributes[i]);
   if(!old||!same){const mapping=this.newMapping(rows),allocation=page.arena.allocate(mapping.vertexCount,old?.allocation),block:Block={key,attributes:first.attributes,names:first.names,...mapping,versions:first.attributes.map(a=>this.retainedVersion(a)),allocation};page.blocks.set(key,block);for(let a=0;a<block.attributes.length;a++)this.copyVertices(page,block,a,0,block.vertexCount);this.stats.blockReplacements++;if(old&&old.allocation.offset!==allocation.offset)this.stats.blockRelocations++;continue;}
   const block=old,indicesChanged=rows.some(choice=>{const cached=page.sources.get(choice.sourceKey);return!cached||cached.block!==block||cached.signature!==choice.signature||cached.stamp!==this.stamp(choice);});
   if(indicesChanged){const before=block.vertexCount;this.appendReferences(block,rows);if(block.vertexCount>before){const prior=block.allocation,next=page.arena.allocate(block.vertexCount,prior);block.allocation=next;const relocated=next!==prior;if(relocated)this.stats.blockRelocations++;for(let a=0;a<block.attributes.length;a++)this.copyVertices(page,block,a,relocated?0:before,block.vertexCount);}}
   this.completeVersions(page,block);
  }
  this.writeIndices(page,choices);this.bounds(page);page.mesh.geometry=page.arena.geometry;this.ownedProducer435?.dirty(page.mesh);
  if(oldGeometry!==page.arena.geometry)this.stats.rebuilds++;this.stats.copiedBytes+=page.arena.stats.growthCopiedBytes-growthBytes;
 }
 /** Recompute only changed source sequences; assemble active page indices with
  * native TypedArray.set, without walking/copying every forest vertex. */
 private writeIndices(page:Page,choices:readonly Choice[]):void{
  const next=new Map<string,CachedSource>();let changed=false,total=0;
  for(const choice of choices){if(next.has(choice.sourceKey))throw new Error('Duplicate static arena producer source key.');const block=page.blocks.get(this.blockKey(choice))!,stamp=this.stamp(choice),cached=page.sources.get(choice.sourceKey);
   if(cached&&cached.signature===choice.signature&&cached.stamp===stamp&&cached.block===block&&cached.offset===block.allocation.offset)next.set(choice.sourceKey,cached);
   else{const indices=new Uint32Array(choice.count);for(let i=0;i<choice.count;i++){const local=block.remap[choice.index.getX(choice.start+i)]!;if(local<0)throw new Error('Static arena index lacks an allocated vertex.');indices[i]=block.allocation.offset+local;}next.set(choice.sourceKey,{signature:choice.signature,stamp,block,offset:block.allocation.offset,indices});changed=true;this.stats.indexSourceRemaps++;}
   total+=choice.count;
  }
  const order=choices.map(choice=>choice.sourceKey).join('|');if(order!==page.indexOrder||next.size!==page.sources.size||total!==page.indices)changed=true;
  page.sources=next;page.indexOrder=order;if(!changed)return;
  page.arena.ensureIndices(total);const index=page.arena.geometry.index!,out=index.array as Uint32Array;let at=0;for(const choice of choices){const indices=next.get(choice.sourceKey)!.indices;out.set(indices,at);at+=indices.length;}
  page.indices=at;page.arena.geometry.setDrawRange(0,at);page.mesh.geometry=page.arena.geometry;page.mesh.visible=at>0;if(at)this.mark(index,0,at);this.stats.indexPatches++;this.stats.copiedBytes+=at*4;
 }
 /** Spatial buckets come from producer chunk keys. Resource families may use
  * their four quadrants while pages remain; at most one terrain family uses
  * two fixed halves. All families share the same eight-page ceiling. */
 private selected(grouped:Map<string,Choice[]>):{key:string;choices:Choice[];quadrant:number|undefined}[]{
  const families=[...grouped].filter(([,choices])=>choices.length>1).sort((a,b)=>b[1].length-a[1].length);let remaining=this.maxPages,terrainSplit=false;
  const selected:{key:string;choices:Choice[];quadrant:number|undefined}[]=[];
  for(const[key,choices]of families){if(!remaining)break;const partitions=choices[0]!.partitions;if(partitions&&choices.every(c=>c.quadrant!==undefined&&c.partitions===partitions)){
    const buckets=new Map<number,Choice[]>();for(const choice of choices){const q=choice.quadrant!,rows=buckets.get(q)??[];rows.push(choice);buckets.set(q,rows);}
    // Never collapse an oversized spatial family back into a full-map page.
    // Excess families retain native draws; a second resource family may use
    // genuinely free pages without removing the separate terrain restriction.
    if(buckets.size>remaining||(partitions===2&&buckets.size>1&&terrainSplit))continue;
    for(const[q,rows]of[...buckets].sort((a,b)=>a[0]-b[0]))selected.push({key:`${key}|quadrant:${q}`,choices:rows,quadrant:q});remaining-=buckets.size;if(partitions===2&&buckets.size>1)terrainSplit=true;continue;
   }selected.push({key,choices,quadrant:undefined});remaining--;
  }return selected;
 }
 reconcile(roots:readonly THREE.Object3D[],materials:readonly THREE.NodeMaterial[]):void{
  if(this.disposed)return;this.restoreSources();this.stats.reconciles++;this.stats.rejected={};const grouped=new Map<string,Choice[]>(),knownMaterials=new Set(materials);
  for(const root of roots)root.traverse(object=>{if(!(object instanceof THREE.Mesh)||!visibleBelow(object,root))return;const choice=this.choice(object,root,knownMaterials);if(choice){const rows=grouped.get(choice.key)??[];rows.push(choice);grouped.set(choice.key,rows);}});
  const selected=this.selected(grouped),active=new Set<string>();this.stats.eligibleObjects=[...grouped.values()].reduce((n,c)=>n+c.length,0);this.stats.candidateFamilies=grouped.size;
  try{
   for(const item of selected){active.add(item.key);const old=this.pages.get(item.key);if(old)this.update(old,item.choices);else this.pages.set(item.key,this.create(item.key,item.choices,item.quadrant));}
   for(const[key,page]of this.pages)if(!active.has(key)){this.release(page);this.pages.delete(key);}
   this.links.clear();for(const page of this.pages.values())for(const block of page.blocks.values())for(let a=0;a<block.attributes.length;a++){const attribute=block.attributes[a]!,links=this.links.get(attribute)??[];links.push({page,block,attribute:a});this.links.set(attribute,links);}
   this.blockedRoots.clear();for(const page of this.pages.values())for(const choice of page.choices){this.hidden.set(choice.source,choice.layers);hiddenSourceLayers.set(choice.source,choice.layers);choice.source.layers.mask=0;}
   this.stats.sourceObjects=this.hidden.size;this.stats.unmergedNativeObjects=this.stats.eligibleObjects-this.hidden.size;this.stats.pageObjects=this.pages.size;this.stats.sourceActiveTriangles=[...this.pages.values()].reduce((n,p)=>n+p.choices.reduce((m,c)=>m+c.count/3,0),0);this.stats.compiledActiveTriangles=[...this.pages.values()].reduce((n,p)=>n+p.indices/3,0);this.syncVisibility();
  }catch(error){this.clear();this.stats.fallbacks++;throw error;}
 }
 syncVisibility():void{for(const[root,group]of this.containers){const valid=identityChain(root);if(!valid&&!this.blockedRoots.has(root)){this.blockedRoots.add(root);for(const page of this.pages.values())if(page.root===root)for(const{source}of page.choices){const layers=this.hidden.get(source);if(layers!==undefined&&source.layers.mask===0)source.layers.mask=layers;hiddenSourceLayers.delete(source);}this.stats.fallbacks++;}group.visible=valid&&!this.blockedRoots.has(root)&&visibleChain(root);}}
 meshes():readonly THREE.Mesh[]{return[...this.pages.values()].map(p=>p.mesh);}
 snapshot(){return{...this.stats,offeredToNativeOnly:true,cameras:[...this.offered].map(([camera,data])=>({uuid:camera.uuid,type:camera.type,...data})),pages:[...this.pages.values()].map(p=>({mesh:p.mesh.uuid,material:(p.mesh.material as THREE.Material).uuid,root:p.root.name||p.root.type,quadrant:p.quadrant,sources:p.choices.length,vertices:[...p.blocks.values()].reduce((n,b)=>n+b.vertexCount,0),indexCount:p.indices,vertexCapacity:p.arena.vertexCapacity,indexCapacity:p.arena.indexCapacity,bufferBytes:Object.values(p.arena.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+p.arena.geometry.index!.array.byteLength,uniqueAttributeBlocks:p.blocks.size,sourceAttributeVertices:p.choices.reduce((n,c)=>n+c.attributes[0]!.count,0),arena:{...p.arena.stats},blocks:[...p.blocks.values()].map(b=>({key:b.key,offset:b.allocation.offset,capacity:b.allocation.capacity,vertices:b.vertexCount,runs:b.sourceRuns.length})),bounds:p.arena.geometry.boundingSphere?{center:p.arena.geometry.boundingSphere.center.toArray(),radius:p.arena.geometry.boundingSphere.radius}:null}))};}
 clear():void{this.restoreSources();for(const page of this.pages.values())this.release(page);this.pages.clear();this.links.clear();this.blockedRoots.clear();for(const group of this.containers.values())group.removeFromParent();this.containers.clear();this.offered.clear();this.stats.eligibleObjects=this.stats.candidateFamilies=this.stats.unmergedNativeObjects=this.stats.sourceObjects=this.stats.pageObjects=this.stats.sourceActiveTriangles=this.stats.compiledActiveTriangles=0;}
 dispose():void{this.clear();this.disposed=true;}
}
