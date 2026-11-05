/** PRIVATE final-fragment graph: exactly one filtered final-colour texture.
 * The canonical ink kernel exists only in the separate Source materials. */
import * as THREE from 'three/webgpu';
import {attribute,int,storage,texture,varying} from 'three/tsl';
import {createOwnedMaterialResources435} from '../OwnedMaterialResources435';
import {rockBodyColorNode,rockStonePaintUvNode} from './RockFinalSource';
import {ROCK_SURFACE_UV} from '../models/RockSurfaceModel';
import type {RockFinalPublication} from './RockFinalRuntimeTypes';
import type {SharedSurfacePreparationStage} from './SharedSurfacePreparation';
const MAX=128*1024*1024;
/** Sparse Source IDs remain shader inputs. This separate owner never writes
 * Source headers, canonical stencils, raw UVs or the model's tag stream. */
class RockFinalLookup {
 private data:Float32Array<ArrayBufferLike>=new Float32Array(8);private attribute=new THREE.StorageBufferAttribute(this.data,4);
 readonly node=storage(this.attribute,'vec4',0).toReadOnly();private readonly allocations=[this.attribute];private closed=false;
 get buffer(){return this.attribute;}get bytes(){return this.allocations.reduce((n,a)=>n+a.array.byteLength,0);}
 stage(input:Float32Array){
  if(this.closed||input.length%8||input.byteLength>MAX||input.some(v=>!Number.isFinite(v)))throw Error('Bounded finite Rock32B address lookup required');
  let capacity=this.data.byteLength;while(capacity<input.byteLength)capacity*=2;if(capacity>MAX)throw Error('Rock address binding capacity refused before allocation');
  const before={data:this.data,attribute:this.attribute},candidateData=capacity>this.data.byteLength?new Float32Array(capacity/4):undefined,candidate=candidateData?new THREE.StorageBufferAttribute(candidateData,4):undefined,undo=candidate?undefined:this.data.slice();let published=false,committed=false,disposed=false,adopted=false;
  const rollback=()=>{if(committed)throw Error('Transferred Rock lookup cannot roll back');if(!published)return;this.data=before.data;this.attribute=before.attribute;this.node.value=before.attribute;if(undo)this.data.set(undo);this.attribute.needsUpdate=true;published=false;};
  return{publish:()=>{if(disposed||published)throw Error('Rock lookup stage unavailable');if(candidate&&candidateData){if(!adopted)this.allocations.push(candidate);adopted=true;this.attribute=candidate;this.data=candidateData;this.node.value=candidate;}this.data.fill(0);this.data.set(input);this.attribute.needsUpdate=true;published=true;},commit:()=>{if(!published)throw Error('Publish Rock lookup before commit');committed=true;},rollback,dispose:()=>{if(disposed)return;if(!committed)rollback();disposed=true;},stats:{newGpuBytes:candidate?.array.byteLength??0,undoCpuBytes:undo?.byteLength??0,inputCpuBytes:input.byteLength,capacity}};
 }
 attach(geometries:Iterable<THREE.BufferGeometry>):void{for(const geometry of new Set(geometries))for(const a of this.allocations)geometry.setAttribute('rockFinalTerminal'+a.id,a);}
 dispose():void{if(this.closed)return;this.node.dispose();this.closed=true;}
}
export class RockFinalSurface {
 readonly preparedMaterial:THREE.MeshStandardNodeMaterial;readonly bodyMaterial:THREE.MeshStandardNodeMaterial;
 private readonly lookup=new RockFinalLookup();private readonly sample:THREE.TextureNode;
 private readonly body:THREE.Node<'vec3'>;private readonly final:THREE.Node<'vec3'>;
 private readonly preparedJournal:ReturnType<typeof createOwnedMaterialResources435>;private readonly bodyJournal:ReturnType<typeof createOwnedMaterialResources435>;
 private current:RockFinalPublication={route:'source',style:'default'};private closed=false;
 constructor(private readonly source:THREE.MeshStandardNodeMaterial,private readonly stone:THREE.Texture,configure?: (material:THREE.MeshStandardNodeMaterial)=>void){
  this.preparedMaterial=source.clone();this.bodyMaterial=source.clone();
  const sourceKeys=['positionNode','maskNode','maskShadowNode','outputNode','castShadowPositionNode','receivedShadowPositionNode']as const,sourceNodes=sourceKeys.map(key=>source[key]);
  for(const m of[this.preparedMaterial,this.bodyMaterial]){
   m.userData={...source.userData,rendererOwned:true};
   if(configure){
    // Register each actual clone once, then borrow the exact existing Source
    // pose/mask/light fields. A configured Source output is already claimed.
    m.outputNode=null;m.maskNode=null;m.maskShadowNode=null;
    try{configure(m);}finally{m.copy(source);m.userData={...source.userData,rendererOwned:true};for(let i=0;i<sourceKeys.length;i++)m[sourceKeys[i]!]=sourceNodes[i]!;}
   }
   m.vertexColors=false;
  }
  this.body=rockBodyColorNode(attribute('color','vec3'),stone,rockStonePaintUvNode());
  const uv=attribute(ROCK_SURFACE_UV,'vec3'),at=uv.z.toInt().mul(2),a=this.lookup.node.element(at),b=this.lookup.node.element(at.add(int(1))),mapped=varying(uv.xy.mul(a.zw).add(a.xy),'v_rockFinalUv'),layer=varying(b.x,'v_rockFinalLayer').setInterpolation('flat','first');
  this.sample=texture(stone,mapped).depth(layer);this.final=this.sample.rgb;
  this.preparedMaterial.colorNode=this.body;this.bodyMaterial.colorNode=this.body;
  this.preparedJournal=createOwnedMaterialResources435(this.preparedMaterial,this.resources(stone,false));
  this.bodyJournal=createOwnedMaterialResources435(this.bodyMaterial,{textures:[stone],arrayTextures:[],sharedGroups:[]});
 }
 private resources(map:THREE.Texture,array:boolean){return{textures:[map],arrayTextures:array?[map]:[],sharedGroups:[],storage:[this.lookup.buffer]};}
 get lookupCpuBytes(){return this.lookup.bytes;}get lookupGpuBytes(){return this.lookup.bytes;}
 /** Upper bounds are queried only by the held admission ledger. */
 lookupStageUpperBytes(faceSpan:number){const current=this.lookup.buffer.array.byteLength,bytes=Math.max(current,32*2**Math.ceil(Math.log2(Math.max(1,faceSpan))));if(bytes>MAX)throw Error('Rock Source face span exceeds lookup binding limit');const growing=bytes>current;return{retainedGpuBytes:this.lookup.bytes+(growing?bytes:0),newCpuBytes:this.lookup.bytes+(growing?bytes:current),lookupBytes:bytes};}
 stage(binding:RockFinalPublication):SharedSurfacePreparationStage {
  if(this.closed)throw Error('Rock final surface retired');const before=this.current,previousColor=this.preparedMaterial.colorNode,previousMap=this.sample.value,lookup=binding.route==='prepared'?this.lookup.stage(binding.plan!.lookup):undefined;let published=false,committed=false,disposed=false;
  const install=(value:RockFinalPublication)=>{const pure=value.route==='prepared'&&value.style==='origami';if(pure){value.bank!.assertCurrent();this.sample.value=value.bank!.texture;}this.preparedMaterial.colorNode=pure?this.final:this.body;this.preparedMaterial.needsUpdate=true;this.preparedJournal.publish(this.resources(pure?value.bank!.texture:this.stone,pure));this.current=value;};
  const rollback=()=>{if(committed)throw Error('Transferred Rock surface cannot roll back');if(!published)return;lookup?.rollback();this.preparedMaterial.colorNode=previousColor;this.sample.value=previousMap;this.preparedMaterial.needsUpdate=true;this.preparedJournal.publish(this.resources(before.route==='prepared'&&before.style==='origami'?before.bank!.texture:this.stone,before.route==='prepared'&&before.style==='origami'));this.current=before;published=false;};
  return{publish:()=>{if(disposed||published)throw Error('Rock surface stage unavailable');published=true;lookup?.publish();install(binding);},commit:()=>{if(!published)throw Error('Publish Rock surface before commit');lookup?.commit();committed=true;},rollback,dispose:()=>{if(disposed)return;if(!committed)rollback();lookup?.dispose();disposed=true;},stats:{lookup:lookup?.stats??null,fragment:binding.route==='prepared'?'one final RGBA fetch':'Source stone body',canonicalInkInFinalFragment:false}};
 }
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{this.lookup.attach(geometries);}
 dispose():void{if(this.closed)return;this.preparedJournal.dispose();this.bodyJournal.dispose();this.lookup.dispose();this.preparedMaterial.dispose();this.bodyMaterial.dispose();this.closed=true;}
}
