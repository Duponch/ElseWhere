import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {buildTerrain,createTerrainPaintTexture,patchTerrainPaintTexture,TERRAIN_COLORS} from '../src/render/TerrainLayer';
import {clearGroup} from '../src/render/primitives';
import {surfaceHeightAtCell,FLOOR_SURFACE_Y,isWaterTerrain} from '../src/render/surface-height';
import {terrainSurfaceChanges} from '../src/render/terrain-state';
import {HygieneLayer} from '../src/render/HygieneLayer';
import {bridgePartsForCell} from '../src/render/bridge-parts';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {Placement} from '../src/render/primitives';
import {WORLD_SCALE} from '../src/world/scale';
import {terrainInspection,TERRAIN_LABELS} from '../src/ui/terrain-inspection';
import {mapHoverLines} from '../src/ui/map-hover-readout';
import {mapCellDetails} from '../src/ui/map-cell-details';
import {mapObjectsAt} from '../src/ui/map-object-selection';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {World} from '../src/sim/types';

const view=(width:number,height:number):World=>({seed:403,width,height,tiles:Array.from({length:width*height},()=>({terrain:'grass'}))} as World);
test('V403 shallow and legacy deep water share one resident water mesh with distinct plain pigments',()=>{
 const w=view(3,1);w.tiles[1]={terrain:'water-shallow'};w.tiles[2]={terrain:'water'};const before=JSON.stringify(w);
 const group=new THREE.Group(),land=new THREE.MeshBasicMaterial({vertexColors:true}),water=new THREE.MeshBasicMaterial({vertexColors:true});land.userData.rendererOwned=water.userData.rendererOwned=true;
 try{buildTerrain(w,group,land,water,false);const meshes=group.children as THREE.Mesh[],wet=meshes.filter(m=>m.material===water);expect(wet).toHaveLength(1);expect(meshes.filter(m=>m.material===land)).toHaveLength(1);
  const p=wet[0]!.geometry.getAttribute('position');expect(p.count).toBe(8);for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo(WORLD_SCALE.waterSurface,7);
  const c=wet[0]!.geometry.getAttribute('color');expect([c.getX(0),c.getY(0),c.getZ(0)]).not.toEqual([c.getX(4),c.getY(4),c.getZ(4)]);expect(wet[0]!.geometry.getAttribute('uv')).toBeUndefined();
  expect(TERRAIN_COLORS['water-shallow']).not.toBe(TERRAIN_COLORS.water);expect(isWaterTerrain('marsh')).toBe(false);expect(isWaterTerrain('water-shallow')).toBe(true);expect(JSON.stringify(w)).toBe(before);
 }finally{clearGroup(group);land.dispose();water.dispose();}
});
test('V403 shallow shoreline paint patches equal a complete bake and depth boundaries add no fake shore',()=>{
 const w=view(3,3),texture=createTerrainPaintTexture(w);try{w.tiles[4]={terrain:'water-shallow'};w.tiles[5]={terrain:'water'};patchTerrainPaintTexture(texture,w,[4,5]);const fresh=createTerrainPaintTexture(w);
  try{expect(texture.image.data).toEqual(fresh.image.data);const allDeep=createTerrainPaintTexture({...w,tiles:w.tiles.map(t=>t.terrain==='water-shallow'?{terrain:'water' as const}:t)});try{const a=texture.image.data as Uint8Array,b=allDeep.image.data as Uint8Array;for(let i=3;i<a.length;i+=4)expect(a[i]).toBe(b[i]);}finally{allDeep.dispose();}}
  finally{fresh.dispose();}
  const before=w,after={...w,tiles:[...w.tiles]};after.tiles[4]={terrain:'water-shallow',bridge:true};expect(terrainSurfaceChanges(before,after)).toEqual([4]);expect(surfaceHeightAtCell(before,1,1)).toBe(WORLD_SCALE.waterSurface);expect(surfaceHeightAtCell(after,1,1)).toBe(FLOOR_SURFACE_Y);
 }finally{texture.dispose();}
});
test('V403 existing deck batch appears and disappears while underlying water surface stays literal',()=>{
 const w=deconstructionCamp(0),i=8*w.width+8;w.tiles[i]={terrain:'water-shallow'};const calls:{name:string;parts:Placement[]}[]=[],sink={set(_g:THREE.Group,name:string,parts:Placement[]){calls.push({name,parts});}},layer=new HygieneLayer();
 layer.update(w,sink as unknown as BoxBatches,true);calls.length=0;const built={...w,tiles:[...w.tiles]};built.tiles[i]={terrain:'water-shallow',bridge:true};layer.update(built,sink as unknown as BoxBatches);
 expect(calls).toEqual([{name:'hygiene-floors',parts:bridgePartsForCell(8,8)}]);calls.length=0;layer.update(built,sink as unknown as BoxBatches);expect(calls).toEqual([]);layer.update({...w,tiles:[...w.tiles]},sink as unknown as BoxBatches);expect(calls).toEqual([{name:'hygiene-floors',parts:[]}]);expect(surfaceHeightAtCell(w,8,8)).toBe(WORLD_SCALE.waterSurface);layer.dispose();
});
test('V403 read-only inspection distinguishes bare/bridged shallow water from impassable legacy water',()=>{
 const w=deconstructionCamp(0),cell={x:8,z:8},i=cell.z*w.width+cell.x;w.tiles[i]={terrain:'water-shallow'};const before=JSON.stringify(w),bare=terrainInspection(w.tiles[i]!),hover=mapHoverLines(w,cell,1).join(' · ');
 for(const text of ['Eau peu profonde','Fertilité : 0 %','Terrain non cultivable','Marche : +3 ticks','Support de construction ordinaire absent'])expect(bare).toContain(text);
 // Core GenPath.SpeedPercentString: 13 / (30 + 13) for shallow water; no supports line (interactions note).
 expect(hover).toContain('Eau peu profonde (vitesse de marche 30 %)');expect(hover).not.toContain('Support');expect(mapObjectsAt(w,cell)).toEqual([]);expect(mapCellDetails(w,cell,1)?.rows).toContainEqual({label:'Terrain',value:'Eau peu profonde'});expect(JSON.stringify(w)).toBe(before);
 const bridged={...w,tiles:[...w.tiles]};bridged.tiles[i]={terrain:'water-shallow',bridge:true};const note=terrainInspection(bridged.tiles[i]!),lines=mapHoverLines(bridged,cell,1).join(' · ');expect(note).toContain('Pont en bois sur eau peu profonde');expect(note).toContain('eau peu profonde nue : +3');expect(lines).toContain('Pont (vitesse de marche 100 %)');expect(mapCellDetails(bridged,cell,1)?.heading).toBe('Pont en bois sur eau peu profonde');expect(mapObjectsAt(bridged,cell)).toEqual([]);
 const deep={...w,tiles:[...w.tiles]};deep.tiles[i]={terrain:'water'};expect(TERRAIN_LABELS.water).toBe('Eau infranchissable');expect(mapHoverLines(deep,cell,1)[0]).toBe('Eau infranchissable');
});
