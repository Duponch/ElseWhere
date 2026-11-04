/** Real development gallery inventory and its resident actor owners. No World,
 * Canvas, device, image quality or performance result is asserted here. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {createActorCatalog} from '../src/dev/asset-catalog-actors';

test('the actual actor gallery starts in Pastel with complete human tools and weapon poses, then switches only appearance data',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{});let catalog:ReturnType<typeof createActorCatalog>|undefined;
 try{
  catalog=createActorCatalog(context);const humans=catalog.sections.find(section=>section.id==='humans')!,machines=catalog.sections.find(section=>section.id==='machines')!,animals=catalog.sections.find(section=>section.id==='animals')!;
  expect(humans.missing??[]).toEqual([]);for(const type of ['weapon-ready:','weapon-strike:','work-tool:'])expect(humans.items.filter(item=>item.id.startsWith(type)).length,type).toBeGreaterThan(0);
  expect(animals.items).toHaveLength(53);expect(machines.items).toHaveLength(6);expect(machines.group.children).toHaveLength(6);expect(humans.items.every(item=>item.status==='reference')).toBe(true);
  const body=humans.group.children.find(child=>child.name==='Colonists — procedural eight-bone GPU rig')as THREE.Mesh<THREE.InstancedBufferGeometry>,shape=body.geometry.getAttribute('aShape'),palettes=new Set(Array.from({length:body.geometry.instanceCount},(_,i)=>Math.floor(shape.getW(i)/32)));expect(palettes.size).toBeGreaterThan(1);
  const meshes:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Mesh['material'];index:THREE.BufferAttribute|null}[]=[];
  for(const section of catalog.sections)section.group.traverse(object=>{if(object instanceof THREE.Mesh)meshes.push({mesh:object,geometry:object.geometry,material:object.material,index:object.geometry.index});});
  const inventory=catalog.sections.map(section=>({section,items:section.items,rows:section.items.map(item=>({...item})),children:[...section.group.children]}));
  for(const style of ['origami','default']as const){
   context.update({...context.preferences,style});
   for(const owner of meshes){expect(owner.mesh.geometry).toBe(owner.geometry);expect(owner.mesh.material).toBe(owner.material);expect(owner.mesh.geometry.index).toBe(owner.index);}
   for(const owner of inventory){expect(owner.section.items).toBe(owner.items);expect(owner.section.items).toEqual(owner.rows);expect(owner.section.group.children).toEqual(owner.children);}
  }
 }finally{catalog?.dispose();context.dispose();flush.mockRestore();}
},60_000);
