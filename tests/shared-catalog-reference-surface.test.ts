/** Actual unbound gallery reference; no GPU, pixel or performance claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {createCatalogReferenceAcacia} from '../src/dev/asset-catalog-environment';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import {mergedInstances} from '../src/render/StaticGeometry';

function words(g:THREE.BufferGeometry,name:string){const a=g.getAttribute(name),total=g.index?.count??a.count,data=new Float32Array(total*a.itemSize);for(let i=0;i<total;i++)for(let c=0;c<a.itemSize;c++)data[i*a.itemSize+c]=a.getComponent(g.index?.getX(i)??i,c);return new Uint32Array(data.buffer);}

test('gallery acacia keeps its seven canonical parts and one opaque body across styles and optional wear boundaries',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),reference=new ReferenceFloraLibrary(false,false),source=reference.recipe('acacia'),group=new THREE.Group(),material=new THREE.MeshLambertNodeMaterial({vertexColors:true});material.userData.rendererOwned=true;
 const canonical=mergedInstances(group,source.parts.map((part,index)=>({geometry:part.geometry.clone(),items:[{x:0,y:0,z:0,key:index,color:part.baseColor,referenceColor:part.baseColor,profile:part.profileId,rawGeometry:true}]})),material,true,true,true)!,actual=withGraphicsStyle(context,()=>createCatalogReferenceAcacia(context)),geometry=actual.body.geometry,bodyMaterial=actual.body.material as THREE.MeshLambertNodeMaterial,color=bodyMaterial.colorNode,attributes={...geometry.attributes},index=geometry.index;
 try{
  expect(source.parts).toHaveLength(7);for(const field of ['position','normal','color','uv'])expect(words(geometry,field),field).toEqual(words(canonical.geometry,field));expect(bodyMaterial).toBeInstanceOf(THREE.MeshLambertNodeMaterial);expect(bodyMaterial.transparent).toBe(false);expect(actual.group.children).toEqual([actual.body]);
  for(const style of ['origami','default','origami'] as const){context.update({...context.preferences,style});expect(actual.body.geometry).toBe(geometry);expect(actual.body.material).toBe(bodyMaterial);expect(bodyMaterial.colorNode).toBe(color);expect(geometry.index).toBe(index);for(const[name,a]of Object.entries(attributes))expect(geometry.getAttribute(name)).toBe(a);}
  context.update({...context.preferences,wear:.75,edges:.65});const wear=actual.group.children.find(o=>o!==actual.body);expect(wear).toBeInstanceOf(THREE.Mesh);expect(wear!.visible).toBe(true);context.update({...context.preferences,style:'default'});expect(wear!.visible).toBe(false);expect(actual.body.geometry).toBe(geometry);
  context.update({...context.preferences,wear:0});expect(actual.group.children).toEqual([actual.body]);expect(actual.body.material).toBe(bodyMaterial);
 }finally{actual.dispose();canonical.geometry.dispose();material.dispose();reference.dispose();context.dispose();}
},60000);
