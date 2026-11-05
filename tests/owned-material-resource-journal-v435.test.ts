import{expect,test,vi}from'vitest';
import * as THREE from'three/webgpu';
import{sharedUniformGroup,uniform,vec2,vec3,float}from'three/tsl';
import{createOwnedMaterialResources435,ownedMaterialResources435}from'../src/render/OwnedMaterialResources435';
import{compatibleOwnedOpaqueCompiled435}from'../src/render/OwnedOpaqueCompiled435';
import{PreparedTextureSurface}from'../src/render/surfaces/PreparedTextureSurface';
import{nativeCompiledFixture435}from'./helpers/owned-opaque-native-fixture-v435';
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';

test('native array bindings and exact manually versioned shared groups require both explicit declarations',()=>{
 const h=nativeCompiledFixture435(),map=new THREE.DataArrayTexture(new Uint8Array(8),1,1,2),read=new THREE.TextureNode(map),group=sharedUniformGroup('TEST-owned-assets',0,null),address=uniform(1).setGroup(group);
 try{h.updates.push(read,group);h.add(read,'texture','fragment');h.add(address,'float','vertex');h.textures.add(map);
  expect(compatibleOwnedOpaqueCompiled435(h.state(),h.declaration).accepted).toBe(false);
  const declaration={...h.declaration,arrayTextures:new Set<THREE.Texture>([map]),sharedGroups:new Set([group])};expect(compatibleOwnedOpaqueCompiled435(h.state(),declaration)).toMatchObject({accepted:true});
  declaration.arrayTextures.clear();expect(compatibleOwnedOpaqueCompiled435(h.state(),declaration).accepted).toBe(false);declaration.arrayTextures.add(map);declaration.sharedGroups.clear();expect(compatibleOwnedOpaqueCompiled435(h.state(),declaration).accepted).toBe(false);
  declaration.sharedGroups.add(group);group.shared=false;expect(compatibleOwnedOpaqueCompiled435(h.state(),declaration).accepted).toBe(false);
 }finally{map.dispose();h.dispose();}
});

test('resource publication changes declarations only at writers and close notifies every subscriber despite one failure',()=>{
 const material=new THREE.MeshLambertNodeMaterial(),a=new THREE.Texture(),b=new THREE.Texture(),group=sharedUniformGroup('TEST-publication',0,null),encoding=uniform(0),journal=createOwnedMaterialResources435(material,{textures:[a],arrayTextures:[a],sharedGroups:[group],objectUniforms:[encoding]}),calls:string[]=[];
 try{expect(ownedMaterialResources435(material)).toBe(journal.declaration);expect(journal.declaration.objectUniforms.has(encoding)).toBe(true);journal.declaration.subscribe(()=>{calls.push('first');if(journal.declaration.textures.size===0)throw Error('TEST close notification failure');});journal.declaration.subscribe(()=>calls.push('second'));
  journal.publish({textures:[b],arrayTextures:[b],sharedGroups:[group],objectUniforms:[encoding]});expect([...journal.declaration.textures]).toEqual([b]);expect(calls).toEqual(['first','second']);expect(()=>journal.dispose()).toThrow(AggregateError);expect(calls).toEqual(['first','second','first','second']);expect(ownedMaterialResources435(material)).toBeUndefined();expect([...journal.declaration.textures]).toEqual([]);expect([...journal.declaration.objectUniforms]).toEqual([]);expect(()=>journal.dispose()).not.toThrow();expect(calls).toHaveLength(4);
 }finally{journal.dispose();material.dispose();a.dispose();b.dispose();}
});

test('a thrown address factory retires both constructor allocations before any context subscription',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),source=new THREE.MeshLambertNodeMaterial(),pastel=new THREE.DataTexture(new Uint8Array(64*64*4),64,64);pastel.flipY=false;pastel.magFilter=THREE.LinearFilter;pastel.minFilter=THREE.LinearMipmapLinearFilter;pastel.generateMipmaps=true;
 const textures=vi.spyOn(THREE.DataArrayTexture.prototype,'dispose'),materials=vi.spyOn(THREE.MeshLambertNodeMaterial.prototype,'dispose');
 try{expect(()=>new PreparedTextureSurface({context,sourceMaterial:source,pastelTexture:pastel,pastelUv:vec2(0),pastelFromSample:s=>s.rgb,tint:vec3(1),address:()=>{throw Error('TEST address failed');}})).toThrow('TEST address failed');expect(textures).toHaveBeenCalledTimes(1);expect(materials).toHaveBeenCalledTimes(1);}
 finally{textures.mockRestore();materials.mockRestore();source.dispose();pastel.dispose();context.dispose();}
});

test('configuration registers the clone yet retains every Source node and material scalar; selecting Source on the same UUID restores its maps',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),source=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,opacity:.8,side:THREE.DoubleSide}),pastel=new THREE.DataTexture(new Uint8Array(64*64*4),64,64);pastel.flipY=false;pastel.magFilter=THREE.LinearFilter;pastel.minFilter=THREE.LinearMipmapLinearFilter;pastel.generateMipmaps=true;source.colorNode=vec3(.5);source.outputNode=vec3(.7);const output=source.outputNode,configured=new WeakSet<THREE.NodeMaterial>();
 const surface=new PreparedTextureSurface({context,sourceMaterial:source,pastelTexture:pastel,pastelUv:vec2(0),pastelFromSample:s=>s.rgb,tint:vec3(1),address:()=>({uv:vec2(0),bodyLayer:float(0),inkLayer:float(1),format:float(1)}),configure:material=>{expect(material.outputNode).toBeNull();configured.add(material);material.opacity=.1;Reflect.set(material,'roughness',.1);material.side=THREE.FrontSide;material.outputNode=vec3(.2);}});
 try{const material=surface.material,uuid=material.uuid;expect(configured.has(material)).toBe(true);expect(material.outputNode).toBe(output);expect(material.opacity).toBe(.8);expect(Reflect.get(material,'roughness')).toBe(.88);expect(material.side).toBe(THREE.DoubleSide);expect(material.userData.rendererOwned).toBe(true);surface.selectRepresentation('source');expect(surface.material.uuid).toBe(uuid);expect(surface.material.colorNode).toBe(source.colorNode);surface.selectRepresentation('pure');expect(surface.material.uuid).toBe(uuid);}
 finally{surface.dispose();source.dispose();pastel.dispose();context.dispose();}
});
