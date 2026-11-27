import {pileLabelAnchor} from '../src/render/map-label-anchors';
import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, OrthographicCamera } from 'three/webgpu';
import { createWorld } from '../src/sim/engine';
import type { World } from '../src/sim/types';
import { MapLabelsOverlay, PILE_LABEL_MIN_CELL_PIXELS } from '../src/render/MapLabelsOverlay';
import {itemLabelMinCellPixels,itemLabelVisibilityLabel} from '../src/ui/item-label-visibility';
import {WORLD_SCALE} from '../src/world/scale';

afterEach(() => vi.unstubAllGlobals());

test('item-label option bounds, always visible and unchanged setting preserve resident labels',()=>{
  expect(itemLabelMinCellPixels(null)).toBe(96);expect(itemLabelMinCellPixels('')).toBe(96);expect(itemLabelMinCellPixels(NaN)).toBe(96);
  expect(itemLabelMinCellPixels(-1)).toBe(0);expect(itemLabelMinCellPixels(300)).toBe(160);expect(itemLabelMinCellPixels('40.8')).toBe(41);
  expect(itemLabelVisibilityLabel(0)).toBe('Toujours visibles');
  const {overlay,camera,world}=overlayFixture();overlay.draw(world,camera,20,800,600);expect(overlay.mesh.visible).toBe(false);
  overlay.setMinCellPixels(0);overlay.draw(world,camera,20,800,600);expect(overlay.mesh.visible).toBe(true);
  expect(overlay['chunks'].flatMap(chunk=>chunk.entries).map(entry=>entry.label)).toEqual(['2']);expect(overlay.mesh.geometry.instanceCount).toBe(1);
  const resident=residentLabels(overlay);overlay.setMinCellPixels(0);overlay.draw(world,camera,20,800,600);expectResidentLabels(overlay,resident);
  overlay.setMinCellPixels(160);overlay.draw(world,camera,120,800,600);expect(overlay.mesh.visible).toBe(false);expectResidentLabels(overlay,resident);overlay.dispose();
});

function overlayFixture() {
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), strokeText: vi.fn(), fillText: vi.fn(),
    measureText: (text:string)=>({width:7*text.length}),
  };
  const canvas = {
    className: '', hidden: false, width: 0, height: 0,
    setAttribute: vi.fn(), getContext: vi.fn(() => context), remove: vi.fn(),
  };
  const display = { devicePixelRatio: 1 };
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  vi.stubGlobal('window', display);
  const overlay = new MapLabelsOverlay();
  const camera = new OrthographicCamera(-6, 6, 6, -6, .1, 100);
  camera.position.set(4, 16, 4);
  camera.lookAt(4, 0, 4);
  camera.updateProjectionMatrix();
  let world: World = createWorld(190, 8, 8);
  world.piles = [{ id: 10, kind: 'wood', item: 'wood', quantity: 2,
    owner: { type: 'ground', x: 4, z: 4 } }];
  world.packed = [];
  return { overlay, context, canvas, camera, display, world };
}

function residentLabels(overlay:MapLabelsOverlay) {
  return {geometry:overlay.mesh.geometry,attributes:Object.entries(overlay.mesh.geometry.attributes).map(([name,attribute])=>{
    if(!(attribute instanceof BufferAttribute))throw Error(`Expected resident buffer attribute ${name}`);
    return {name,attribute,version:attribute.version};
  })};
}
function expectResidentLabels(overlay:MapLabelsOverlay,resident:ReturnType<typeof residentLabels>):void {
  expect(overlay.mesh.geometry).toBe(resident.geometry);
  for(const {name,attribute,version} of resident.attributes){expect(overlay.mesh.geometry.getAttribute(name)).toBe(attribute);expect(attribute.version).toBe(version);}
}

test('stable snapshots keep the indexed labels and GPU buffers; quantities and packed quality update them', () => {
  const { overlay, camera, world: initial } = overlayFixture();
  let world = initial;
  overlay.draw(world, camera, 120, 800, 600);
  expect(overlay['chunks'].flatMap(chunk=>chunk.entries).map(entry=>entry.label)).toEqual(['2']);
  const anchor=overlay.mesh.geometry.getAttribute('labelAnchor');
  expect([anchor.getX(0),anchor.getY(0),anchor.getZ(0)]).toEqual([4,Math.fround(pileLabelAnchor(world.piles[0]!).y),4]);
  const resident=residentLabels(overlay);
  const chunks = overlay['chunks'];

  // A worker snapshot replaces World and often packed, even if labels did not change.
  world = { ...world, tick: world.tick + 1, packed: world.packed.slice() };
  overlay.draw(world, camera, 120, 800, 600);
  world = { ...world, piles: world.piles.map(p => ({ ...p })), packed: world.packed.slice() };
  overlay.draw(world, camera, 120, 800, 600);
  expect(overlay['chunks']).toBe(chunks);
  expectResidentLabels(overlay,resident);

  const glyph=overlay.mesh.geometry.getAttribute('labelGlyph');if(!(glyph instanceof BufferAttribute))throw Error('Expected glyph buffer');const glyphVersion=glyph.version;
  world = { ...world, piles: [{ ...world.piles[0]!, quantity: 3 }] };
  overlay.draw(world, camera, 120, 800, 600);
  expect(overlay['chunks'].flatMap(chunk=>chunk.entries).map(entry=>entry.label)).toEqual(['3']);
  expect(glyph.version).toBeGreaterThan(glyphVersion);

  world = { ...world, packed: [{ building: { id: 11, kind: 'stool', x: 5, z: 4,
    orientation: 0, footprint: 'standard', quality: 'good' },
    owner: { type: 'ground', x: 5, z: 4 } }] };
  overlay.draw(world, camera, 120, 800, 600);
  expect(overlay['chunks'].flatMap(chunk=>chunk.entries).map(entry=>entry.label)).toEqual(['3','bon']);
  expect(overlay.mesh.geometry.instanceCount).toBe(4);
  const packedChunks = overlay['chunks'];
  const packedResident=residentLabels(overlay);
  world = { ...world, packed: world.packed.map(p => ({ ...p, building: { ...p.building, damage: 1 } })) };
  overlay.draw(world, camera, 120, 800, 600);
  expect(overlay['chunks']).toBe(packedChunks);
  expectResidentLabels(overlay,packedResident);
  overlay.dispose();
});

test('camera, zoom, viewport, DPR and visibility transitions retain GPU attributes and the source index', () => {
  const { overlay, camera, display, world } = overlayFixture();
  overlay.draw(world, camera, 120, 800, 600);
  const chunks = overlay['chunks'];
  const resident=residentLabels(overlay);
  camera.position.x += 1;
  overlay.draw(world, camera, 120, 800, 600);
  expectResidentLabels(overlay,resident);
  expect(overlay['chunks']).toBe(chunks);

  camera.zoom = 1.5;
  camera.updateProjectionMatrix();
  overlay.draw(world, camera, 120, 800, 600);
  expectResidentLabels(overlay,resident);
  overlay.draw(world, camera, 120, 801, 600);
  expectResidentLabels(overlay,resident);
  display.devicePixelRatio = 1.5;
  overlay.draw(world, camera, 120, 801, 600);
  expectResidentLabels(overlay,resident);expect(overlay['chunks']).toBe(chunks);

  overlay.draw(world, camera, PILE_LABEL_MIN_CELL_PIXELS - 1, 801, 600);
  expect(overlay.mesh.visible).toBe(false);
  expectResidentLabels(overlay,resident);
  overlay.draw(world, camera, PILE_LABEL_MIN_CELL_PIXELS, 801, 600);
  expect(overlay.mesh.visible).toBe(true);
  expectResidentLabels(overlay,resident);
  overlay.draw(world, camera, PILE_LABEL_MIN_CELL_PIXELS, 801, 600);
  expectResidentLabels(overlay,resident);

  const wider = createWorld(191, 9, 8);
  wider.piles = world.piles; wider.packed = world.packed;
  overlay.draw(wider, camera, 120, 801, 600);
  expect(overlay['chunks']).not.toBe(chunks);
  expect(overlay['chunks'].flatMap(chunk=>chunk.entries).map(entry=>entry.label)).toEqual(['2']);
  overlay.dispose();
});

test('block captions clear their real top and follow changed supports or items even when the caption is identical',()=>{
  const {overlay,camera,world:initial}=overlayFixture();
  let world:World={...initial,structures:[],piles:[{id:10,kind:'blocks',item:'granite-blocks',quantity:75,owner:{type:'ground',x:4,z:4}}]};
  const entry=()=>overlay['chunks'].flatMap(chunk=>chunk.entries)[0]!;
  overlay.draw(world,camera,120,800,600);expect(entry().label).toBe('75');expect(entry().y).toBeCloseTo(.61,12);
  const ground=overlay['chunks'];
  world={...world,structures:[{id:40,kind:'table',x:4,z:4,orientation:0,footprint:'standard'}]};
  overlay.draw(world,camera,120,800,600);expect(entry().y).toBeCloseTo(WORLD_SCALE.tableHeight+.61,12);expect(overlay['chunks']).not.toBe(ground);
  const supported=overlay['chunks'],resident=residentLabels(overlay);
  world={...world,structures:world.structures.map(structure=>({...structure,damage:1}))};
  overlay.draw(world,camera,120,800,600);expect(overlay['chunks']).toBe(supported);expectResidentLabels(overlay,resident);
  world={...world,structures:[{id:40,kind:'stool',x:4,z:4,orientation:0,footprint:'standard'}]};
  overlay.draw(world,camera,120,800,600);expect(entry().y).toBeCloseTo(WORLD_SCALE.stoolHeight+.61,12);
  world={...world,structures:[],piles:[{...world.piles[0]!,kind:'wood',item:'wood'}]};
  overlay.draw(world,camera,120,800,600);expect(entry().label).toBe('75');expect(entry().y).toBeCloseTo(.43700159311294556,12);
  const anchor=overlay.mesh.geometry.getAttribute('labelAnchor');expect(anchor.getY(0)).toBe(Math.fround(entry().y));overlay.dispose();
});

test('packed quality captions clear the actual parcel or bedroll and the surface that carries it',()=>{
  const {overlay,camera,world:initial}=overlayFixture();
  let world:World={...initial,piles:[],structures:[],packed:[{building:{id:41,kind:'stool',x:4,z:4,orientation:0,footprint:'standard',quality:'good'},owner:{type:'ground',x:4,z:4}}]};
  const entry=()=>overlay['chunks'].flatMap(chunk=>chunk.entries)[0]!;
  overlay.draw(world,camera,120,800,600);expect(entry().label).toBe('bon');expect(entry().y).toBeCloseTo(.525,12);
  world={...world,packed:world.packed.map((packed):World['packed'][number]=>({...packed,building:{...packed.building,kind:'bedroll'}}))};
  overlay.draw(world,camera,120,800,600);expect(entry().label).toBe('bon');expect(entry().y).toBeCloseTo(.405,12);
  world={...world,structures:[{id:40,kind:'table',x:4,z:4,orientation:0,footprint:'standard'}]};
  overlay.draw(world,camera,120,800,600);expect(entry().y).toBeCloseTo(WORLD_SCALE.tableHeight+.385*.8+.02,12);
  const anchor=overlay.mesh.geometry.getAttribute('labelAnchor');expect(anchor.getY(0)).toBe(Math.fround(entry().y));overlay.dispose();
});
