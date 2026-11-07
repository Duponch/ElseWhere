import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { applyCommand, createWorld } from '../src/sim/engine';
import { queryArea } from '../src/sim/designation';
import { footprintCells } from '../src/sim/definitions';
import type { AreaAction, Job, MaterialPile, World } from '../src/sim/types';
import { DesignationIconLayer, designationIconInstances, designationPreviewIconInstances,
  isIconDesignationKind,TREE_DESIGNATION_ATLAS_URL } from '../src/render/DesignationIconLayer';
import type { SceneTextureLoader } from '../src/render/scene-render-ports';

function fixture(): World {
  const world = createWorld(303, 12, 12);
  world.tiles = world.tiles.map(() => ({ terrain: 'grass' }));
  world.resources = []; world.structures = []; world.jobs = []; world.piles = [];
  world.stockpiles = []; world.growingZones = []; delete world.roofing;
  return world;
}
function chunk(world: World, x: number, z: number, requested = false): MaterialPile {
  return { id: world.nextId++, kind: 'chunk', item: 'granite-chunk', quantity: 1,
    owner: { type: 'ground', x, z }, ...requested ? { haulRequested: true as const } : {} };
}
function job(world: World, kind: Job['kind'], x: number, z: number): Job {
  return { id: world.nextId++, kind, x, z, orientation: 0, footprint: 'standard',
    status: 'pending', reservedBy: null, progress: 0, escrow: { wood: 0, food: 0 } };
}
function selection(world: World, action: AreaAction, x: number, z: number): number[] {
  const query = queryArea(world, { type: 'area', action, from: { x, z }, to: { x, z } });
  if (!query.ok) throw new Error(query.reason);
  return query.cells;
}
const positions = (world: World) => designationIconInstances(world).map(({ x, z }) => [x, z]);

test('haul-chunks preview becomes the same committed icon without a Job and without mutating the World', () => {
  const world = fixture(); world.piles = [chunk(world, 2, 3), chunk(world, 4, 3)];
  const cells = selection(world, 'haul-chunks', 2, 3), before = JSON.stringify(world);
  const preview = designationPreviewIconInstances(world, 'haul-chunks', cells);
  expect(preview).toHaveLength(1);
  expect(JSON.stringify(world)).toBe(before);
  expect(applyCommand(world, { type: 'area', action: 'haul-chunks', from: { x: 2, z: 3 }, to: { x: 2, z: 3 } }).ok).toBe(true);
  expect(world.jobs).toEqual([]);
  expect(designationIconInstances(world)).toEqual(preview);
  expect(designationPreviewIconInstances(world, 'haul-chunks', [...cells, ...cells, -1, NaN, 144])).toEqual([]);
  world.piles[0]!.owner = { type: 'pawn', pawnId: world.pawns[0]!.id };
  expect(positions(world)).toEqual([]);
});

test('only requested ground chunks are marked, once per cell; transport and flag changes refresh resident buffers', () => {
  const world = fixture();
  world.piles = [chunk(world, 2, 3, true), chunk(world, 2, 3, true), chunk(world, 4, 3),
    { ...chunk(world, 5, 3, true), owner: { type: 'pawn', pawnId: world.pawns[0]!.id } },
    { ...chunk(world, 6, 3, true), kind: 'wood', item: 'wood' }];
  expect(positions(world)).toEqual([[2, 3]]);
  const icons = new DesignationIconLayer(() => undefined);
  icons.update(world);
  const geometry = icons.mesh.geometry, position = geometry.getAttribute('designationPosition') as THREE.InstancedBufferAttribute;
  const version = position.version;
  icons.update(world); expect(position.version).toBe(version);
  world.piles[2]!.haulRequested = true;
  icons.update(world); expect(geometry.instanceCount).toBe(2);
  expect(geometry.getAttribute('designationPosition')).toBe(position);
  world.piles = []; icons.update(world);
  expect(geometry.instanceCount).toBe(0); expect(icons.mesh.visible).toBe(false);
  icons.dispose();
});

test('deconstruction preview selects a whole rotated building from a non-anchor footprint cell', () => {
  const world = fixture();
  const structure = { id: world.nextId++, kind: 'bed' as const, x: 4, z: 4, orientation: 1 as const, footprint: 'standard' as const };
  world.structures = [structure];
  const cell = footprintCells(structure).find(cell => cell.x !== structure.x || cell.z !== structure.z)!;
  const cells = selection(world, 'deconstruct', cell.x, cell.z);
  const preview = designationPreviewIconInstances(world, 'deconstruct', [...cells, ...cells]);
  expect(preview.map(({ x, z }) => [x, z])).toEqual([[structure.x, structure.z]]);
  expect(applyCommand(world, { type: 'area', action: 'deconstruct', from: cell, to: cell }).ok).toBe(true);
  expect(designationIconInstances(world)).toEqual(preview);
  world.jobs = []; expect(positions(world)).toEqual([]);
});

test('instant removal of work spots has no pending icon; floor removal preview matches its real Job', () => {
  const world = fixture();
  world.structures = [{ id: world.nextId++, kind: 'crafting-spot', x: 1, z: 1, orientation: 0, footprint: 'standard' }];
  expect(designationPreviewIconInstances(world, 'deconstruct', selection(world, 'deconstruct', 1, 1))).toEqual([]);
  world.tiles[2 * world.width + 3]!.floor = 'wood-planks';
  const preview = designationPreviewIconInstances(world, 'remove-floor', selection(world, 'remove-floor', 3, 2));
  expect(preview).toHaveLength(1);
  expect(applyCommand(world, { type: 'area', action: 'remove-floor', from: { x: 3, z: 2 }, to: { x: 3, z: 2 } }).ok).toBe(true);
  expect(designationIconInstances(world)).toEqual(preview);
});

test('roof intentions appear before scheduling, do not duplicate Jobs and disappear after completion or ignore', () => {
  const world = fixture(), build = 2 * world.width + 2, finished = build + 1, remove = build + 2;
  world.roofing = { constructed: [finished, remove], build: [build, finished], remove: [remove], cursor: 0 };
  expect(positions(world)).toEqual([[2, 2], [4, 2]]);
  expect(designationPreviewIconInstances(world, 'build-roof', [finished])).toEqual([]);
  expect(designationPreviewIconInstances(world, 'remove-roof', [build])).toEqual([]);
  world.jobs = [job(world, 'build-roof', 2, 2), job(world, 'remove-roof', 4, 2)];
  expect(positions(world)).toEqual([[2, 2], [4, 2]]);
  world.jobs = []; world.roofing.constructed = [build, finished];
  expect(positions(world)).toEqual([]);
  expect(applyCommand(world, { type: 'area', action: 'ignore-roof', from: { x: 2, z: 2 }, to: { x: 4, z: 2 } }).ok).toBe(true);
  expect(positions(world)).toEqual([]);
});

test('new removal sprites retain the historical JobLayer classification and use distinct Architect cells', () => {
  const world = fixture();
  const kinds = ['deconstruct', 'uninstall', 'remove-floor', 'build-roof', 'remove-roof'] as const;
  world.jobs = kinds.map((kind, index) => job(world, kind, index + 1, 1));
  const instances = designationIconInstances(world);
  expect(instances).toHaveLength(kinds.length);
  expect(new Set(instances.map(instance => instance.icon)).size).toBe(kinds.length);
  expect(kinds.every(kind => !isIconDesignationKind(kind))).toBe(true);
  expect(['mine', 'chop', 'harvest', 'cut'].every(isIconDesignationKind)).toBe(true);
});

test('preview clear keeps forbidden overlays and camera changes never read source collections or upload buffers', () => {
  const world = fixture(); world.piles = [chunk(world, 2, 2, true)];
  const icons = new DesignationIconLayer(() => undefined);
  const bundle={x:4,z:4,kind:'wood' as const,item:'wood' as const,quantity:10,supplied:false,forbidden:true as const};
  icons.updatePileIcons(world,[{key:'piles',bundles:[bundle]}],new Set(['piles']));
  icons.updatePreview(world, 'haul-chunks', [2 * world.width + 3]);
  expect(icons.mesh.geometry.instanceCount).toBe(3);
  icons.clearPreview(); expect(icons.mesh.geometry.instanceCount).toBe(2);
  const geometry=icons.mesh.geometry,position=geometry.getAttribute('designationPosition') as THREE.InstancedBufferAttribute,version=position.version;
  icons.updatePileIcons(world,[],new Set(['piles']));expect(position.version).toBe(version);
  expect(icons.mesh.material).toBeInstanceOf(THREE.SpriteNodeMaterial);expect(icons.mesh.material.depthTest).toBe(false);
  const quad=geometry.getAttribute('position');expect(quad.count).toBe(4);for(let i=0;i<quad.count;i++)expect(quad.getZ(i)).toBe(0);
  for (const key of ['jobs', 'piles', 'resources', 'roofing','structures']) Object.defineProperty(world, key, { get: () => { throw new Error('frame read '+key); } });
  icons.setMinCellPixels(0);
  for(const camera of [new THREE.PerspectiveCamera(),new THREE.OrthographicCamera()])for(let frame=0;frame<10;frame++)icons.present(camera,1440,.01);
  expect(icons.mesh.visible).toBe(true);expect(geometry.getAttribute('designationPosition')).toBe(position);expect(position.version).toBe(version);
  icons.dispose();
});

test('hidden forbidden objects stay hidden and clearing a visible preview never retains a filtered target',()=>{
  const world=fixture();world.site={revision:3} as World['site'];world.exploration={revision:1};
  world.tiles[2*world.width+2]!.fogged=true;world.jobs=[job(world,'chop',2,2)];
  const before=JSON.stringify(world),icons=new DesignationIconLayer(()=>undefined);
  const base={kind:'wood' as const,item:'wood' as const,quantity:10,supplied:false,forbidden:true as const};
  icons.updatePileIcons(world,[{key:'piles',bundles:[{...base,x:2,z:2},{...base,x:4,z:4}]}],new Set(['piles']));
  icons.updatePreview(world,'haul-chunks',[3*world.width+3]);expect(icons.mesh.geometry.instanceCount).toBe(2);
  icons.clearPreview();expect(icons.mesh.geometry.instanceCount).toBe(1);
  expect(icons.mesh.geometry.getAttribute('designationPosition').getX(0)).toBe(4);
  icons.updatePileIcons(world,[],new Set());expect(icons.mesh.geometry.instanceCount).toBe(0);
  expect(JSON.stringify(world)).toBe(before);icons.dispose();
});

test('the three historical vector atlases plus tree slots load once and release late loads', () => {
  const pending: { url: string; complete: (texture: THREE.Texture) => void }[] = [];
  const loader: SceneTextureLoader = (url, complete) => { pending.push({ url, complete }); };
  const icons = new DesignationIconLayer(loader);
  const mapGlyph=decodeURIComponent(TREE_DESIGNATION_ATLAS_URL).slice(decodeURIComponent(TREE_DESIGNATION_ATLAS_URL).lastIndexOf('<svg x="192"'));
  expect(mapGlyph).toContain('data-pictogram="cancel"');expect(mapGlyph).toContain('#c85a42');expect(mapGlyph).toContain('data-art="adult-hand-20261107"');expect(mapGlyph).not.toContain('<circle');
  expect(pending.map(entry => entry.url)).toEqual(['/assets/ui/elsewhere/v304/ui.svg','/assets/ui/elsewhere/v304/architect-1.svg','/assets/ui/elsewhere/v304/architect-2.svg',TREE_DESIGNATION_ATLAS_URL]);
  const loaded = new THREE.Texture(), late = new THREE.Texture();
  const loadedDispose = vi.spyOn(loaded, 'dispose'), lateDispose = vi.spyOn(late, 'dispose');
  pending[0]!.complete(loaded); icons.dispose(); pending[1]!.complete(late);
  expect(loadedDispose).toHaveBeenCalledOnce(); expect(lateDispose).toHaveBeenCalledOnce();
});
