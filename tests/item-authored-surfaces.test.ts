import {test,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {createItemGeometry,ITEM_SHAPES} from '../src/render/item-geometry';
import {itemGeometry} from '../src/render/item-presentation';
import {itemSurfaceTile,paintItemSurfaceDesign} from '../src/render/item-surface-design';
import {ItemMeshAtlas} from '../src/render/item-mesh-atlas';
import {compileNaturalSurfaceModels} from '../src/render/surfaces/NaturalSurfaceModels';

test('loose apparel charts follow the actual broad faces; small ambiguous shapes stay generic',()=>{
  expect(itemSurfaceTile('item-shirt',0,1,0)).toBe(32);
  expect(itemSurfaceTile('item-shirt',0,-1,0)).toBe(33);
  expect(itemSurfaceTile('item-shirt',1,0,0)).toBe(0);
  expect(itemSurfaceTile('item-coat',0,1,0)).toBe(35);
  expect(itemSurfaceTile('item-coat',0,-1,0)).toBe(36);
  expect(itemSurfaceTile('item-pants',0,1,0)).toBe(34);
  expect(itemSurfaceTile('item-vest',0,1,0)).toBe(37);
  expect(itemSurfaceTile('item-nugget',0,1,0)).toBe(0);
  expect(itemSurfaceTile('item-round',0,1,0)).toBe(0);
  expect(itemSurfaceTile('item-leaf',0,1,0)).toBe(0);
});

test('a neutral garment drawing is recognisably attached to its material-independent UV',()=>{
  expect(paintItemSurfaceDesign(32,.505,.44)).toBeLessThan(.4); // shirt button
  expect(paintItemSurfaceDesign(33,.505,.44)).toBeGreaterThan(.75); // back
  expect(paintItemSurfaceDesign(55,.505,.44)).toBeGreaterThan(.75); // T-shirt
  expect(paintItemSurfaceDesign(35,.54,.58)).toBeLessThan(.35); // coat button
  expect(paintItemSurfaceDesign(32,.63,.33)).toBeLessThan(.5); // pocket flap
  expect(paintItemSurfaceDesign(34,.5,.14)).toBeLessThan(.5); // belt
  expect(paintItemSurfaceDesign(32,.6,.80)).toBeGreaterThan(.95); // blank cloth
  for(let tile=32;tile<64;tile++)for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const value=paintItemSurfaceDesign(tile,(x+.5)/32,(y+.5)/32);
    expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(1);
  }
});

test('explicit details follow the item role instead of confusing identical physical primitives',()=>{
  const tiles=(item:Parameters<typeof itemGeometry>[0])=>itemGeometry(item).map(p=>p.surfaceDesign).filter(n=>n!==undefined);
  expect(tiles('wood')).toContain(43);
  expect(tiles('wood')).toContain(53);
  expect(tiles('corn')).toContain(56);
  expect(tiles('corn')).not.toContain(43);
  expect(tiles('cloth-parka')).toContain(52);
  expect(tiles('cloth-tshirt')).toContain(55);
  expect(tiles('cloth-jacket')).toContain(59);
  expect(tiles('recon-armor')).toContain(47);
  expect(tiles('novel')).toContain(41);
  expect(tiles('chemfuel')).toContain(42);
  expect(tiles('berries')).toEqual([46]);
  expect(itemGeometry('potato').every(p=>p.surfaceDesign===undefined)).toBe(true);
});

test('surface charts occupy only the existing spare component of the borrowed model atlas',()=>{
  const source=[new THREE.BoxGeometry(1,1,1),...ITEM_SHAPES.map(shape=>createItemGeometry(shape))];
  const models=compileNaturalSurfaceModels(source),atlas=new ItemMeshAtlas(models.geometries);
  try {
    const values=atlas.data.array,shirt=atlas.slot('item-shirt'),start=shirt*atlas.verticesPerSlot*12;
    const chartWords=new Set<number>();
    for(let vertex=0;vertex<atlas.vertexCounts[shirt]!;vertex+=3){
      const tile=values[start+vertex*12+11]!;
      chartWords.add(tile);
      expect(values[start+(vertex+1)*12+11]).toBe(tile);
      expect(values[start+(vertex+2)*12+11]).toBe(tile);
    }
    expect(chartWords).toEqual(new Set([0,32,33]));
    expect(values.length).toBe(atlas.shapes.length*atlas.verticesPerSlot*12);
  }finally{atlas.dispose();models.dispose();source.forEach(g=>g.dispose());}
});
