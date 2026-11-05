/** Real Rock producer/collector and435 CPU compilation. No device, Native,
 * renderer override, Source guard relaxation or performance result. */
import{test,expect}from'vitest';
import*as THREE from'three/webgpu';
import{RockLayer}from'../src/render/RockLayer';
import{collectRockFinalInput,type RockFinalProducer}from'../src/render/surfaces/RockFinalInput';
import{StaticSceneCompiler435}from'../src/render/StaticSceneCompiler435';
import{ROCK_SURFACE_UV}from'../src/render/models/RockSurfaceModel';
import{createWorld}from'../src/sim/engine';
import{writeTestFileSync}from'./test-output';
const names=['position','normal','color',ROCK_SURFACE_UV]as const;
const words=(array:ArrayBufferView)=>new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
function fixture(){
 const world=createWorld(42,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));for(const[x,z]of[[12,12],[13,12],[13,13],[14,13]]as const)world.tiles[z*32+x]={terrain:'rock',stone:'granite'};
 const layer=new RockLayer();layer.update(world,true);let geometry=layer.mesh.geometry,revision='source-r1';
 const slots:unknown=Reflect.get(layer,'slots');if(!(slots instanceof Map))throw Error('Actual Rock writer slots required');
 const producer:RockFinalProducer={get geometry(){return geometry;},stroke:layer.rockFinalCanonicalTable(),slots,width:world.width,height:world.height,revision:()=>revision},input=collectRockFinalInput(producer,()=>{}),scene=new THREE.Scene(),root=new THREE.Group(),compiler=new StaticSceneCompiler435(scene),views:THREE.BufferGeometry[]=[],extra:THREE.BufferGeometry[]=[];
 const index=geometry.index!,count=geometry.drawRange.count,source=index.array as Uint32Array;
 if(count<=36)throw Error('Actual indexed slab and active Rock cells required');
 // These are exactly the producer's borrowed-attribute/owned-index view rules.
 // Both views share a material and shadow flags, so the real435 selects them.
 for(const selected of[source.slice(0,36),source.slice(36,count)]){const view=new THREE.BufferGeometry();for(const[name,a]of Object.entries(geometry.attributes))view.setAttribute(name,a);view.setIndex(new THREE.BufferAttribute(selected,1));view.setDrawRange(0,selected.length);view.boundingBox=geometry.boundingBox!.clone();view.boundingSphere=geometry.boundingSphere!.clone();const mesh=new THREE.Mesh(view,layer.mesh.material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);views.push(view);}
 scene.add(root);scene.updateMatrixWorld(true);
 return{layer,producer,input,compiler,root,get geometry(){return geometry;},revision:()=>{revision='source-r2';},replaceGeometry:()=>{geometry=geometry.clone();extra.push(geometry);},compile:()=>compiler.reconcile([root],layer.compiledMaterials435()),close:()=>{compiler.dispose();for(const view of views)view.dispose();for(const g of extra)g.dispose();layer.dispose();}};
}
test('real435 upload-range coalescing is accepted only after bit-exact validation and the next assertion performs no Source-array scan',()=>{
 const f=fixture(),g=f.geometry,attributes=names.map(name=>g.getAttribute(name)as THREE.BufferAttribute),before=attributes.map(a=>({version:a.version,words:words(a.array).slice()})),globalIndex=g.index!,indexWords=words(globalIndex.array).slice(),canonicalVersion=f.producer.stroke.buffer.version;
 try{
  f.input.assertCurrent();f.compile();expect(f.compiler.snapshot().pageObjects).toBe(1);expect(f.compiler.snapshot().sourceRangeCoalesces).toBe(4);
  for(let i=0;i<attributes.length;i++){expect(attributes[i]!.version).toBe(before[i]!.version+1);expect(words(attributes[i]!.array)).toEqual(before[i]!.words);}
  expect(g.index).toBe(globalIndex);expect(words(globalIndex.array)).toEqual(indexWords);expect(f.producer.stroke.buffer.version).toBe(canonicalVersion);
  const position=attributes[0]!,array=position.array,descriptor=Object.getOwnPropertyDescriptor(position,'array');let arrayReads=0;
  Object.defineProperty(position,'array',{configurable:true,enumerable:true,get(){arrayReads++;return array;}});
  try{
   expect(()=>f.input.assertCurrent()).not.toThrow();expect(arrayReads).toBeGreaterThan(0);
   arrayReads=0;expect(()=>f.input.assertCurrent()).not.toThrow();expect(arrayReads).toBe(0);
   // Index upload metadata is also verified against the compact Source remap.
   globalIndex.needsUpdate=true;expect(()=>f.input.assertCurrent()).not.toThrow();arrayReads=0;f.input.assertCurrent();expect(arrayReads).toBe(0);
  }finally{Object.defineProperty(position,'array',descriptor??{value:array,writable:true,enumerable:true,configurable:true});}
  writeTestFileSync('artifacts/rock-final-input-upload-metadata.json',JSON.stringify({source:'Actual RockLayer/RockSurfaceModel and current collectRockFinalInput',coalesces:f.compiler.snapshot().sourceRangeCoalesces,sourceVersions:attributes.map((a,i)=>({name:names[i],before:before[i]!.version,after:a.version})),sourceWordsExact:true,globalIndexReferenceExact:true,canonicalVersionExact:true,stableSecondAssertionArrayReads:0,scope:'CPU upload metadata validation only; no Native/pixel/performance claim'},null,2)+'\n');
 }finally{f.close();}
});
test('active words and strict Source identities/revision/range/canonical generation remain rejected after a valid metadata rebase',()=>{
 const results:string[]=[];
 const mutateWord=(f:ReturnType<typeof fixture>,name:typeof names[number],component=0)=>{const a=f.geometry.getAttribute(name)as THREE.BufferAttribute,vertex=f.input.arrays.sourceVertex.find(v=>v>=24)!;words(a.array)[vertex*3+component]^=1;a.needsUpdate=true;};
 const cases:readonly[ string,(f:ReturnType<typeof fixture>)=>void ][]=[
  ['active position word',f=>mutateWord(f,'position')],
  ['active normal word',f=>mutateWord(f,'normal')],
  ['active colour word',f=>mutateWord(f,'color')],
  ['active raw UV word',f=>mutateWord(f,ROCK_SURFACE_UV)],
  ['active sparse Source tag word',f=>mutateWord(f,ROCK_SURFACE_UV,2)],
  ['active index word',f=>{const a=f.geometry.index!;(a.array as Uint32Array)[0]=a.getX(1);a.needsUpdate=true;}],
  ['Source revision',f=>f.revision()],
  ['geometry reference',f=>f.replaceGeometry()],
  ['attribute reference',f=>{const a=f.geometry.getAttribute('color');f.geometry.setAttribute('color',new THREE.BufferAttribute((a.array as Float32Array).slice(),3));}],
  ['index reference',f=>f.geometry.setIndex(new THREE.BufferAttribute((f.geometry.index!.array as Uint32Array).slice(),1))],
  ['draw range',f=>f.geometry.setDrawRange(0,f.geometry.drawRange.count-3)],
  ['canonical version even with unchanged words',f=>{f.producer.stroke.buffer.needsUpdate=true;}],
  ['active canonical header word without a canonical version bump',f=>{const a=f.producer.stroke.buffer,face=f.input.arrays.faceId[0]!;words(a.array)[face*8+2]^=1;(f.geometry.getAttribute('position')as THREE.BufferAttribute).needsUpdate=true;}],
  ['active canonical edge word without a canonical version bump',f=>{const face=Array.from(f.input.arrays.faceId.keys()).find(i=>f.input.arrays.faceHeader[i*8+1]!>0);if(face===undefined)throw Error('Actual Source edge fixture required');const offset=f.input.arrays.faceHeader[face*8]!*4;words(f.producer.stroke.buffer.array)[offset]^=1;(f.geometry.getAttribute('position')as THREE.BufferAttribute).needsUpdate=true;}],
 ];
 for(const[label,mutate]of cases){const f=fixture();try{f.compile();expect(()=>f.input.assertCurrent(),label+' initial verified rebase').not.toThrow();mutate(f);expect(()=>f.input.assertCurrent(),label).toThrow(/Rock final Source input superseded/);results.push(label);}finally{f.close();}}
 writeTestFileSync('artifacts/rock-final-input-mutation-refusals.json',JSON.stringify({rejected:results,scope:'All actual active-word and strict Source identity/range/revision/canonical mutations remain refused; no frame scan added'},null,2)+'\n');
});
