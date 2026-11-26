import{expect,test}from'vitest';
import{DataTexture,FloatType,MaterialReferenceNode,Matrix3,Node,RGBAFormat,TextureNode,UniformNode,Vector2}from'three/webgpu';
import{ivec2,objectGroup,renderGroup}from'three/tsl';
import{compatibleOwnedOpaqueCompiled435}from'../src/render/OwnedOpaqueCompiled435';
import{isExactMetadataTextureNode435,metadataTexel}from'../src/render/surfaces/MetadataTexel';
import{asRecord435,nativeCompiledFixture435}from'./helpers/owned-opaque-native-fixture-v435';

test('actual WGSL builder bindings admit the six native object outputs from the acquired Box/Timber census',()=>{
 const h=nativeCompiledFixture435();try{const state=h.state(),result=compatibleOwnedOpaqueCompiled435(state,h.declaration);expect(result).toMatchObject({accepted:true,objectUniforms:6,sharedGroups:1});
  expect(Array.isArray(state.bindings)).toBe(true);for(const group of state.bindings){expect(asRecord435(group)).toBe(true);if(asRecord435(group)&&Array.isArray(group.bindings))for(const binding of group.bindings){expect(asRecord435(binding)&&typeof binding.update==='function').toBe(true);}}
 }finally{h.dispose();}
});

test('Timber plain adds only its native material color; another equal-valued object uniform is refused by identity',()=>{
 const h=nativeCompiledFixture435({color:true});try{expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:true,objectUniforms:7});
  const foreign=new UniformNode(new Vector2(250,250));h.add(foreign,'vec2');expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'object-uniform-not-declared'});
 }finally{h.dispose();}
});

test('command-only live data policy keeps undeclared physical object uniforms dynamic without granting frozen ownership',()=>{
 const h=nativeCompiledFixture435();try{
  const fogDistance=new UniformNode(32).setName('liveFogDistance');h.add(fogDistance,'float');const state=h.state();
  expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:false,reason:'object-uniform-not-declared'});
  expect(compatibleOwnedOpaqueCompiled435(state,{...h.declaration,liveObjectUniforms:true})).toMatchObject({accepted:true,reason:'native-live-object-inputs',liveObjectUniforms:1});
  let physical:Record<string,unknown>|undefined;
  for(const group of state.bindings)if(asRecord435(group)&&Array.isArray(group.bindings))for(const binding of group.bindings)if(asRecord435(binding)&&binding.groupNode===objectGroup&&Array.isArray(binding.uniforms)&&binding.uniforms.some(uniform=>asRecord435(uniform)&&asRecord435(uniform.nodeUniform)&&uniform.nodeUniform.node===fogDistance))physical=binding;
  if(!physical||typeof physical.update!=='function')throw Error('Actual native live object UBO absent');
  expect(Reflect.apply(physical.update,physical,[])).toBe(true);expect(Reflect.apply(physical.update,physical,[])).toBe(false);
  fogDistance.value=74;expect(Reflect.apply(physical.update,physical,[])).toBe(true);expect(Reflect.apply(physical.update,physical,[])).toBe(false);
  // A data policy cannot admit lifecycle code, even an ordinary UniformNode.
  fogDistance.onObjectUpdate(()=>100);h.updates.push(fogDistance);
  expect(compatibleOwnedOpaqueCompiled435(h.state(),{...h.declaration,liveObjectUniforms:true})).toMatchObject({accepted:false,reason:'object-uniform-callback'});
 }finally{h.dispose();}
});

test('real texture+sampler and read-only storage bindings require exact declared resources, with retry after explicit declaration',()=>{
 const h=nativeCompiledFixture435({texture:true,storage:true});try{const state=h.state();expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:true,storage:1});
  h.textures.clear();expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:false,reason:'resource-not-declared'});h.textures.add(h.map);
  h.buffers.clear();expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:false,reason:'resource-not-declared'});h.buffers.add(h.attribute);
  expect(compatibleOwnedOpaqueCompiled435(state,h.declaration).accepted).toBe(true);h.storage.setAccess('readWrite');expect(compatibleOwnedOpaqueCompiled435(state,h.declaration).accepted).toBe(false);
 }finally{h.dispose();}
});

test('native texture UV-matrix output is covered only through its declared source texture',()=>{
 const h=nativeCompiledFixture435({texture:true});try{const matrix=new UniformNode(new Matrix3());Reflect.set(h.texture,'_matrixUniform',matrix);h.add(matrix,'mat3');
  expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration).accepted).toBe(true);h.textures.clear();expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'resource-not-declared'});
 }finally{h.dispose();}
});

test('actual private integer metadata Source texture class is admitted only with its exact native writer shape and declared table identity',()=>{
 const h=nativeCompiledFixture435(),map=new DataTexture(new Float32Array([1,2,3,4]),1,1,RGBAFormat,FloatType);
 try{
  const source=metadataTexel(map,ivec2(0)),read:unknown=Reflect.get(source,'node');
  if(!(read instanceof TextureNode))throw Error('Actual metadata Source node missing');
  expect(isExactMetadataTextureNode435(read)).toBe(true);h.add(read,'texture','fragment','sourceMetadata');
  expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'resource-not-declared',detail:'texture-binding-value'});
  h.textures.add(map);expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration).accepted).toBe(true);
  read.sampler=true;expect(isExactMetadataTextureNode435(read)).toBe(false);expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'resource-not-declared',detail:'texture-binding-node-shape'});read.sampler=false;
  class ForeignMetadata extends TextureNode {setupUV(_builder:never,coordinates:Node):Node{return coordinates;}}
  const foreign=new ForeignMetadata(map,ivec2(0));foreign.sampler=false;expect(isExactMetadataTextureNode435(foreign)).toBe(false);h.add(foreign,'texture','fragment','foreignMetadata');
  expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'resource-not-declared',detail:'texture-binding-node-shape'});
 }finally{map.dispose();h.dispose();}
});

test('foreign object callback, changed model scope and arbitrary native Reference properties remain FULL fallback',()=>{
 const h=nativeCompiledFixture435();try{const callback=new UniformNode(1).onObjectUpdate(()=>2);h.updates.push(callback);h.add(callback,'float');expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'object-uniform-callback'});h.updates.pop();
  Reflect.set(h.model,'scope','viewPosition');expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'model-writer-not-world-matrix'});Reflect.set(h.model,'scope','worldMatrix');
  const unsupported=new MaterialReferenceNode('roughness','float');h.updates.push(unsupported);expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration)).toMatchObject({accepted:false,reason:'material-reference-not-declared'});
 }finally{h.dispose();}
});

test('only exact native render/frame shared groups qualify; an object group cannot be relabelled shared',()=>{
 const h=nativeCompiledFixture435();try{const state=h.state();expect(compatibleOwnedOpaqueCompiled435(state,h.declaration).accepted).toBe(true);
  const groups=state.bindings;if(!Array.isArray(groups))throw Error('Native groups absent');const group=groups.find(g=>asRecord435(g)&&g.name==='object');if(!asRecord435(group)||!Array.isArray(group.bindings))throw Error('Native object group absent');
  const binding=group.bindings.find(b=>asRecord435(b)&&b.isNodeUniformsGroup===true);if(!asRecord435(binding))throw Error('Native UBO absent');Reflect.set(binding,'groupNode',renderGroup);expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:false,reason:'shared-uniform-output'});Reflect.set(binding,'groupNode',objectGroup);
  h.after.push(new Node());expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:false,reason:'after-callback-not-declared'});
 }finally{h.dispose();}
});

test('a fake binding flag is insufficient and validation never invokes update/compile/upload methods',()=>{
 const h=nativeCompiledFixture435();try{const state=h.state();if(!Array.isArray(state.bindings))throw Error('Native groups absent');state.bindings.push({bindings:[{isNodeUniformsGroup:true,groupNode:objectGroup,uniforms:[]}]});
  expect(compatibleOwnedOpaqueCompiled435(state,h.declaration)).toMatchObject({accepted:false,reason:'binding-invalid'});
  const untouched=h.state();const source=h.map.version;expect(compatibleOwnedOpaqueCompiled435(untouched,h.declaration).accepted).toBe(true);expect(h.map.version).toBe(source);
 }finally{h.dispose();}
});
