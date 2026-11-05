import {BufferAttribute,HemisphereLight,HemisphereLightNode,InspectorBase,InspectorNode,LightShadow,MaterialReferenceNode,ModelNode,Node,NodeMaterial,PointLight,PointLightNode,ReferenceNode,ShadowNode,StorageBufferNode,Texture,TextureNode,UniformGroupNode,UniformNode,type Renderer}from'three/webgpu';
import {frameGroup,objectGroup,renderGroup,screenSize,viewport}from'three/tsl';

export interface OwnedOpaqueCompiledDeclaration435 {
 readonly materials:readonly NodeMaterial[];
 readonly textures:ReadonlySet<Texture>;
 readonly storage:ReadonlySet<BufferAttribute>;
 /** Exact producer-owned exploration.size/enabled nodes; no value heuristic. */
 readonly objectUniforms:ReadonlySet<Node>;
 /** Exact Source-produced array textures and manually versioned shared groups. */
 readonly arrayTextures?:ReadonlySet<Texture>;
 readonly sharedGroups?:ReadonlySet<UniformGroupNode>;
 readonly renderer?:Renderer;
}
export interface OwnedOpaqueCompiledResult435 {readonly accepted:boolean;readonly reason:string;readonly objectUniforms?:number;readonly textures?:number;readonly storage?:number;readonly sharedGroups?:number}
type Record435=Record<string,unknown>;
const record=(value:unknown):value is Record435=>typeof value==='object'&&value!==null;
const noLifecycle=(node:Node)=>node.updateBeforeType==='none'&&node.updateAfterType==='none';
const shared=(group:unknown)=>group===renderGroup||group===frameGroup;
const scalarProperties=new Set(['color','opacity','emissive','emissiveIntensity']);
const shadowProperties=new Set(['normalBias','bias','radius','mapSize','intensity']);

/** One closed compatibility check of an ALREADY compiled NodeBuilderState.
 * Never call from setupObserver: NodeMaterial.setup invokes that factory before
 * bindings/update lists exist. No getNodeBuilderState/getBindings, compiler,
 * texture upload, backend lookup or dependency sampling is called here.
 *
 * Binding classes are private to Three's optimized browser module. Inspect the
 * native compiled records plus real public Node/group/resource identities;
 * importing another private constructor would create nominal duplicates.
 * The owner must admit only its actual native state, never caller-supplied rows.
 */
export function compatibleOwnedOpaqueCompiled435(state:unknown,declaration:OwnedOpaqueCompiledDeclaration435):OwnedOpaqueCompiledResult435 {
 const fail=(reason:string):OwnedOpaqueCompiledResult435=>({accepted:false,reason});
 if(!record(state)||!Array.isArray(state.bindings)||!Array.isArray(state.updateNodes)||!Array.isArray(state.updateBeforeNodes)||!Array.isArray(state.updateAfterNodes))return fail('compiled-state-missing');
 if(!declaration.materials.length||declaration.materials.some(material=>!(material instanceof NodeMaterial)||material.transparent||material.opacity!==1))return fail('material-not-opaque-owned');
 const declaredGroup=(value:unknown):value is UniformGroupNode=>value instanceof UniformGroupNode&&declaration.sharedGroups?.has(value)===true&&Object.getPrototypeOf(value)===UniformGroupNode.prototype&&value.shared===true&&value.updateType===null&&value.update===UniformGroupNode.prototype.update&&noLifecycle(value);
 const permittedShared=(value:unknown)=>shared(value)||declaredGroup(value);
 const covered=new Set<Node>(),textureNodes=new Set<TextureNode>(),declaredTexture=(value:unknown):value is Texture=>value instanceof Texture&&declaration.textures.has(value)
  &&!['isVideoTexture','isStorageTexture','isCubeTexture','is3DTexture','isFramebufferTexture'].some(flag=>Reflect.get(value,flag)===true)&&(!(Reflect.get(value,'isDataArrayTexture')===true||Reflect.get(value,'isArrayTexture')===true)||declaration.arrayTextures?.has(value)===true);
 const textureNode=(node:unknown):node is TextureNode=>node instanceof TextureNode&&Object.getPrototypeOf(node)===TextureNode.prototype&&node.update===TextureNode.prototype.update&&node.updateReference===TextureNode.prototype.updateReference&&noLifecycle(node);
 // First identify every output written by a permitted native OBJECT writer.
 for(const raw of state.updateNodes){
  if(!(raw instanceof Node))return fail('non-native-update-node');
  if(raw instanceof MaterialReferenceNode){
   const property=Reflect.get(raw,'property'),bound=Reflect.get(raw,'material'),output=Reflect.get(raw,'node');
   if(Object.getPrototypeOf(raw)!==MaterialReferenceNode.prototype||raw.update!==ReferenceNode.prototype.update||raw.updateReference!==MaterialReferenceNode.prototype.updateReference||!noLifecycle(raw)
    ||typeof property!=='string'||!scalarProperties.has(property)&&property!=='map'||bound!==null&&!declaration.materials.includes(bound)||!(output instanceof Node))return fail('material-reference-not-declared');
   if(property==='map'){if(!textureNode(output)||!declaredTexture(output.value))return fail('resource-not-declared');textureNodes.add(output);}
   else if(!(output instanceof UniformNode)||output.updateType!=='none'||output.groupNode!==objectGroup)return fail('material-object-output');
   covered.add(output);
  }else if(raw instanceof ModelNode){
   const output=Reflect.get(raw,'uniformNode');
   if(Object.getPrototypeOf(raw)!==ModelNode.prototype||raw.update!==ModelNode.prototype.update||Reflect.get(raw,'scope')!=='worldMatrix'||!noLifecycle(raw)||!(output instanceof UniformNode)||output.groupNode!==objectGroup)return fail('model-writer-not-world-matrix');
   covered.add(output);
  }else if(raw instanceof TextureNode){
   if(!textureNode(raw))return fail('texture-writer-not-native');if(!declaredTexture(raw.value))return fail('resource-not-declared');textureNodes.add(raw);
  }else if(raw instanceof UniformGroupNode){
   if(raw!==objectGroup&&!permittedShared(raw)||raw.update!==UniformGroupNode.prototype.update||!noLifecycle(raw))return fail('uniform-group-not-native');
  }else if(raw instanceof UniformNode){
   // SHARED deliberately retains all native shared-node updates. An OBJECT
   // callback would still write an object UBO which SHARED does not upload.
   if(!noLifecycle(raw)||raw.updateType!=='none'&&(!permittedShared(raw.groupNode)||raw.updateType==='object'))return fail('object-uniform-callback');
  }else if(raw instanceof ReferenceNode){
   const output=Reflect.get(raw,'node'),source=Reflect.get(raw,'object'),property=Reflect.get(raw,'property');
   if(Object.getPrototypeOf(raw)!==ReferenceNode.prototype||raw.update!==ReferenceNode.prototype.update||raw.updateReference!==ReferenceNode.prototype.updateReference||!noLifecycle(raw)||!(source instanceof LightShadow)||typeof property!=='string'||!shadowProperties.has(property)||!(output instanceof UniformNode)||output.groupNode!==renderGroup)return fail('reference-not-shared-shadow');
  }else if(raw instanceof PointLightNode||raw instanceof HemisphereLightNode){
   const point=raw instanceof PointLightNode,prototype=point?PointLightNode.prototype:HemisphereLightNode.prototype,light=Reflect.get(raw,'light');
   if(light==null)return fail('light-output-not-shared');
   const outputs=point?[Reflect.get(raw,'baseColorNode')??Reflect.get(raw,'colorNode'),Reflect.get(raw,'cutoffDistanceNode'),Reflect.get(raw,'decayExponentNode')]:[Reflect.get(raw,'baseColorNode')??Reflect.get(raw,'colorNode'),Reflect.get(raw,'lightPositionNode'),Reflect.get(raw,'groundColorNode')];
   if(Object.getPrototypeOf(raw)!==prototype||raw.update!==prototype.update||raw.updateType!=='frame'||!noLifecycle(raw)||!(point?light instanceof PointLight:light instanceof HemisphereLight)||Reflect.get(light,'colorNode')!=null||outputs.some(output=>!(output instanceof UniformNode)||output.groupNode!==renderGroup))return fail('light-output-not-shared');
  }else if(raw instanceof InspectorNode){
   const inspector=declaration.renderer?.inspector;
   if(!inspector)return fail('inspector-not-declared');
   if(Object.getPrototypeOf(raw)!==InspectorNode.prototype||raw.update!==InspectorNode.prototype.update||!noLifecycle(raw)||!(inspector instanceof InspectorBase)||Object.getPrototypeOf(inspector)!==InspectorBase.prototype||inspector.inspect!==InspectorBase.prototype.inspect)return fail('inspector-not-native-noop');
  }else if(raw===screenSize||raw===viewport){
   // These exact native singleton updates write only their renderGroup output.
   if(raw.updateType!=='render'||!noLifecycle(raw))return fail('screen-singleton-contract');
  }else return fail('update-class-not-declared');
 }
 for(const node of textureNodes)for(const field of['_matrixUniform','_flipYUniform']){const output=Reflect.get(node,field);if(output!=null){if(!(output instanceof UniformNode)||output.updateType!=='none'||output.groupNode!==objectGroup)return fail('texture-object-output');covered.add(output);}}
 for(const raw of state.updateBeforeNodes)if(!(raw instanceof ShadowNode)||Object.getPrototypeOf(raw)!==ShadowNode.prototype||raw.updateBefore!==ShadowNode.prototype.updateBefore||raw.updateBeforeType!=='render')return fail('before-callback-not-native-shadow');
 if(state.updateAfterNodes.length)return fail('after-callback-not-declared');
 let objectUniforms=0,textures=0,storage=0,sharedGroups=0;
 const checkTextureBinding=(binding:Record435):boolean=>textureNode(binding.textureNode)&&declaredTexture(binding.textureNode.value)&&binding.groupNode===objectGroup&&binding.store!==true;
 for(const group of state.bindings){
  if(!record(group)||!Array.isArray(group.bindings)||!group.bindings.length)return fail('binding-group-invalid');
  for(const raw of group.bindings){
   if(!record(raw)||typeof raw.update!=='function')return fail('binding-invalid');
   if(raw.isNodeUniformsGroup===true){
    if(!Array.isArray(raw.uniforms)||raw.groupNode!==objectGroup&&!permittedShared(raw.groupNode))return fail('binding-uniform-group-invalid');
    if(permittedShared(raw.groupNode)){sharedGroups++;for(const value of raw.uniforms){const output=record(value)&&record(value.nodeUniform)?value.nodeUniform.node:undefined;if(!(output instanceof UniformNode)||output.groupNode!==raw.groupNode)return fail('shared-uniform-output');}continue;}
    for(const value of raw.uniforms){const output=record(value)&&record(value.nodeUniform)?value.nodeUniform.node:undefined;objectUniforms++;
     if(!(output instanceof UniformNode)||output.groupNode!==objectGroup||!covered.has(output)&&(!declaration.objectUniforms.has(output)||output.updateType!=='none'||!noLifecycle(output)))return fail('object-uniform-not-declared');
    }
   }else if(raw.isStorageBuffer===true){
    const node=raw.nodeUniform,attribute=raw.attribute;
    if(!(node instanceof StorageBufferNode)||node.access!=='readOnly'||raw.access!=='readOnly'||!(attribute instanceof BufferAttribute)||!declaration.storage.has(attribute)||raw.groupNode!==objectGroup)return fail('resource-not-declared');storage++;
   }else if(raw.isSampledTexture===true||raw.isSampler===true){
    if(!checkTextureBinding(raw))return fail('resource-not-declared');textures++;
   }else return fail('binding-class-not-declared');
  }
 }
 return{accepted:true,reason:'owned-native-object-outputs',objectUniforms,textures,storage,sharedGroups};
}
