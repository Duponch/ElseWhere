import {BoxGeometry,DataTexture,InspectorBase,MaterialReferenceNode,Matrix4,Mesh,MeshLambertNodeMaterial,ModelNode,Node,NodeMaterialObserver,Renderer,StorageBufferAttribute,StorageBufferNode,Texture,TextureNode,UniformNode,Vector2,WebGPUBackend,WGSLNodeBuilder}from'three/webgpu';
import {attribute,context,objectGroup,renderGroup}from'three/tsl';
import type{OwnedOpaqueCompiledDeclaration435}from'../../src/render/OwnedOpaqueCompiled435';

/** These are REAL r186 WGSL binding/uniform/sampler/storage objects, created
 * by the real builder methods. No isNodeUniformsGroup/isSampler flag is forged.
 * This fixture does not compile a shader or submit GPU work. Its layout mirrors
 * the acquired V435 Box/Timber census; actual program coverage remains ROOT's.
 */
export function nativeCompiledFixture435(options:{texture?:boolean;storage?:boolean;color?:boolean}={}){
 const renderer:Renderer=Object.create(Renderer.prototype);renderer.backend=new WebGPUBackend();renderer.contextNode=context();Reflect.set(renderer,'_mrt',null);Reflect.set(renderer,'_inspector',new InspectorBase());
 // registerDeclaration reads this native Renderer constructor configuration.
 // Keep its actual defaults; this fixture must never request shader compilation.
 renderer.debug={checkShaderErrors:true,diagnostics:{keywords:false},onNodeBuilderCreated:null,onShaderError:null,getShaderAsync:async()=>{throw Error('Binding-layout fixture must not compile shaders');}};
 // The native capability query reads only device.features.has(). No method of
 // this feature-only backing record creates/submits/allocates a GPU resource.
 Reflect.set(renderer.backend,'device',{features:new Set<string>()});Reflect.set(renderer.backend,'renderer',renderer);
 const material=new MeshLambertNodeMaterial({color:0xffffff});material.colorNode=attribute('color','vec3');const mesh=new Mesh(new BoxGeometry(),material),builder=new WGSLNodeBuilder(mesh,renderer);
 function call(name:string,args:readonly unknown[]=[]):unknown{const method:unknown=Reflect.get(builder,name);if(typeof method!=='function')throw Error('Pinned builder method absent: '+name);return Reflect.apply(method,builder,args);}
 const updates:Node[]=[objectGroup,renderGroup],before:Node[]=[],after:Node[]=[];
 const add=(node:Node,type:string,stage:'vertex'|'fragment'='fragment',name?:string)=>{
  const previousShader=call('getShaderStage'),previousBuild=call('getBuildStage'),previousContext=call('getContext');let scopedStack=false;
  try{
   // Native declarations belong to a shader/generate flow. Use the builder's
   // own stack API (which also scopes the global TSL stack), never fabricated
   // NodeUniformsGroup/sampler rows or compiler-cache flags.
   call('setShaderStage',[stage]);call('setBuildStage',['generate']);call('addStack');scopedStack=true;
   if(node instanceof UniformNode&&!(node instanceof TextureNode)&&!(node instanceof StorageBufferNode)){
    if(!asRecord435(previousContext))throw Error('Native builder context missing');
    call('setContext',[{...previousContext,nodeName:name}]);
    // The actual UniformNode build/generate path chooses its native input
    // representation (notably bool -> uint) and emits the bool expression.
    // Passing bool straight to getUniformFromNode bypasses that conversion.
    return call('flowStagesNode',[node,type]);
   }
   return call('getUniformFromNode',[node,type,stage,name]);
  }finally{if(scopedStack)call('removeStack');call('setContext',[previousContext]);call('setBuildStage',[previousBuild]);call('setShaderStage',[previousShader]);}
 };
 const model=new ModelNode('worldMatrix'),world:unknown=Reflect.get(model,'uniformNode');if(!(world instanceof UniformNode))throw Error('Native model output missing');world.value=new Matrix4();updates.push(model);add(world,'mat4','vertex','worldMatrix');
 const enabled=new UniformNode(false),size=new UniformNode(new Vector2(250,250));add(enabled,'bool','fragment','explorationEnabled');add(size,'vec2','fragment','explorationSize');
 const refs:MaterialReferenceNode[]=[];
 for(const [property,type]of [['opacity','float'],['emissive','color'],['emissiveIntensity','float'],...(options.color?[['color','color']]:[])]as const){
  const ref=new MaterialReferenceNode(property,type);Reflect.apply(ref.updateReference,ref,[{material}]);Reflect.apply(ref.update,ref,[{}]);const output:unknown=Reflect.get(ref,'node');if(!(output instanceof UniformNode))throw Error('Native reference output missing');refs.push(ref);updates.push(ref);add(output,type,'fragment',property);
 }
 const projection=new UniformNode(new Matrix4()).setGroup(renderGroup);add(projection,'mat4','vertex','cameraProjectionMatrix');
 const map=new DataTexture(new Uint8Array([255,255,255,255]),1,1),texture=new TextureNode(map);if(options.texture){updates.push(texture);add(texture,'texture','fragment','ownedSurface');}
 const storageAttribute=new StorageBufferAttribute(new Float32Array([1,2,3,4]),4),storage=new StorageBufferNode(storageAttribute,'vec4',1).toReadOnly();if(options.storage)add(storage,'storageBuffer','vertex','itemAtlas');
 const textures=new Set<Texture>(options.texture?[map]:[]),buffers=new Set(options.storage?[storageAttribute]:[]),objectUniforms=new Set<Node>([enabled,size]);
 const declaration:OwnedOpaqueCompiledDeclaration435={materials:[material],textures,storage:buffers,objectUniforms,renderer};
 function state(){Reflect.set(builder,'bindGroups',null);const bindings=call('getBindings');if(!Array.isArray(bindings))throw Error('Native binding list missing');return{bindings,updateNodes:updates,updateBeforeNodes:before,updateAfterNodes:after};}
 function nativeObserver(){return new NodeMaterialObserver(builder);}
 return{renderer,material,mesh,builder,model,world,enabled,size,projection,refs,map,texture,attribute:storageAttribute,storage,updates,before,after,add,state,declaration,textures,buffers,objectUniforms,nativeObserver,
  dispose(){mesh.geometry.dispose();material.dispose();map.dispose();}};
}

export const asRecord435=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object';
