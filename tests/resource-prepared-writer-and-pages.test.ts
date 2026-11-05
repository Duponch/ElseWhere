import{expect,test}from'vitest';
import * as THREE from'three/webgpu';
import{attribute,float,vec2,vec3}from'three/tsl';
import{compileNaturalSurfaceModels}from'../src/render/surfaces/NaturalSurfaceModels';
import{ResourcePreparedModels}from'../src/render/surfaces/ResourcePreparedModels';
import{PreparedSurfaceAdmissionRefusal,type PreparedSurfaceVariant}from'../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
import{mergedInstances}from'../src/render/StaticGeometry';
import{StaticSceneCompiler435,setStaticSceneSource435}from'../src/render/StaticSceneCompiler435';
import{OwnedOpaqueRevisions435}from'../src/render/OwnedOpaqueRevisions435';
import{PreparedTextureSurface}from'../src/render/surfaces/PreparedTextureSurface';
import{GraphicsStyleContext}from'../src/render/graphics-style';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';

test('actual natural resource templates share unit-paint variants across placement/rotation/colour while preserving exact anisotropy',()=>{
 const box=new THREE.BoxGeometry(),bank=compileNaturalSurfaceModels([box]),values:PreparedSurfaceVariant[]=[],ids=new Map<string,number>(),models=new ResourcePreparedModels(value=>{const old=ids.get(value.key);if(old!==undefined)return old;const id=values.length;ids.set(value.key,id);values.push(value);return id;}),g=bank.geometries[0]!,before=Array.from(g.getAttribute('position').array);
 try{const item={x:2,y:.2,z:3,sx:.6,sy:.4,sz:.3,ry:.2,color:0x775533,profile:0},first=models.capture(g,item),same=models.capture(g,{...item,x:80,z:90,ry:2,color:0x334477});expect(same).toBe(first);expect(values).toHaveLength(1);expect(values[0]!.model.geometry.getAttribute('origamiPaint').getX(0)).toBe(1);
  expect(models.capture(g,{...item,sx:.7})).not.toBe(first);expect(values).toHaveLength(2);expect(models.capture(g,{...item,profile:1,referenceColor:0x775533})).not.toBe(first);expect(values).toHaveLength(3);
  expect(()=>models.capture(g,{...item,sy:0})).toThrow(PreparedSurfaceAdmissionRefusal);expect(Array.from(g.getAttribute('position').array)).toEqual(before);for(const v of values)v.model.assertCurrent();
 }finally{models.dispose();bank.dispose();box.dispose();}
});

test('the consuming merge emits identity metadata without changing a single original vertex/index bit or buffer layout',()=>{
 const box=new THREE.BoxGeometry(),bank=compileNaturalSurfaceModels([box]),material=new THREE.MeshLambertNodeMaterial(),items=[{x:2,y:.2,z:3,sx:.6,sy:.4,sz:.3,ry:.2,color:0x775533,profile:0},{x:5,y:.3,z:7,sx:.4,sy:.8,sz:.3,ry:1.2,color:0x337744,profile:0}],a=new THREE.Group(),b=new THREE.Group();let id=7;
 const plain=mergedInstances(a,[{geometry:bank.geometries[0]!.clone(),items}],material,true,true,false,true)!,prepared=mergedInstances(b,[{geometry:bank.geometries[0]!.clone(),items}],material,true,true,false,true,{identity:()=>id++})!;
 try{expect(Object.keys(prepared.geometry.attributes)).toEqual(Object.keys(plain.geometry.attributes));for(const[name,attr]of Object.entries(plain.geometry.attributes)){const x=new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength),other=prepared.geometry.getAttribute(name);expect(new Uint8Array(other.array.buffer,other.array.byteOffset,other.array.byteLength)).toEqual(x);}expect(prepared.geometry.index!.array).toEqual(plain.geometry.index!.array);const metadata=prepared.geometry.userData.preparedResourceVariantIds as Float32Array,count=bank.geometries[0]!.getAttribute('position').count;expect([...metadata.subarray(0,count)]).toEqual(new Array(count).fill(7));expect([...metadata.subarray(count)]).toEqual(new Array(count).fill(8));}
 finally{plain.geometry.dispose();prepared.geometry.dispose();material.dispose();bank.dispose();box.dispose();}
});

test('one shared final material admits all four actual spatial pages and texture publication retains every page/arena identity',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),source=new THREE.MeshLambertNodeMaterial(),pastel=new THREE.DataTexture(new Uint8Array(64*64*4),64,64);pastel.flipY=false;pastel.minFilter=THREE.LinearMipmapLinearFilter;pastel.magFilter=THREE.LinearFilter;pastel.generateMipmaps=true;
 const surface=new PreparedTextureSurface({context,sourceMaterial:source,pastelTexture:pastel,pastelUv:attribute('uv','vec2'),pastelFromSample:s=>attribute('color','vec3').mul(s.rgb),tint:vec3(1),address:()=>({uv:vec2(0),bodyLayer:float(0),inkLayer:float(1),format:float(1)})}),scene=new THREE.Scene(),group=new THREE.Group(),opaque=new OwnedOpaqueRevisions435(),compiler=new StaticSceneCompiler435(scene,8,opaque.producer('static-page')),meshes:THREE.Mesh[]=[];scene.add(group);
 const image=new THREE.DataArrayTexture(new Uint8Array(32),2,2,2);image.colorSpace=THREE.SRGBColorSpace;image.flipY=false;image.minFilter=THREE.LinearMipmapLinearFilter;image.magFilter=THREE.LinearFilter;
 try{for(let quadrant=0;quadrant<4;quadrant++)for(let role=0;role<4;role++){const geometry=new THREE.BoxGeometry(),p=geometry.getAttribute('position');geometry.translate((quadrant%2)*64+role,0,(quadrant>>1)*64);geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.count*3).fill(.7),3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,surface.material);mesh.castShadow=mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;setStaticSceneSource435(mesh,'TEST-resource:'+quadrant+':'+role,quadrant as 0|1|2|3);group.add(mesh);meshes.push(mesh);}scene.updateMatrixWorld(true);compiler.reconcile([group],[surface.material]);
  expect(compiler.snapshot()).toMatchObject({reconciles:1,pageObjects:4,sourceObjects:16,sourceActiveTriangles:192,compiledActiveTriangles:192,rejected:{}});expect(opaque.metrics()).toMatchObject({meshes:4,materials:1,registrations:4});const pages=compiler.meshes().map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,position:mesh.geometry.getAttribute('position'),index:mesh.geometry.index}));
  surface.setAssets({texture:image,assertCurrent(){}});context.update({...context.preferences,style:'origami'});context.update({...context.preferences,style:'default'});expect(compiler.snapshot().reconciles).toBe(1);for(const row of pages){expect(compiler.meshes()).toContain(row.mesh);expect(row.mesh.geometry).toBe(row.geometry);expect(row.mesh.material).toBe(row.material);expect(row.mesh.geometry.getAttribute('position')).toBe(row.position);expect(row.mesh.geometry.index).toBe(row.index);}expect(opaque.metrics().resourceInvalidations).toBeGreaterThan(0);
  const sourcePosition=meshes[0]!.geometry.getAttribute('position')as THREE.BufferAttribute,dirty=opaque.metrics().dirty;sourcePosition.setY(0,.5);sourcePosition.needsUpdate=true;compiler.patchAttribute(sourcePosition,1,1);expect(opaque.metrics().dirty).toBeGreaterThan(dirty);compiler.clear();expect(opaque.metrics().meshes).toBe(0);
 }finally{compiler.dispose();opaque.dispose();surface.dispose();for(const mesh of meshes)mesh.geometry.dispose();source.dispose();pastel.dispose();image.dispose();context.dispose();}
});
