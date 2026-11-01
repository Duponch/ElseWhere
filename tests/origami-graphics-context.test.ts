import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { attribute, vec3 } from 'three/tsl';
import {
  applyOrigamiSurface, currentGraphicsStyle, GraphicsStyleContext, withGraphicsStyle,
} from '../src/render/graphics-style';
import { DEFAULT_GRAPHICS_STYLE_PREFERENCES } from '../src/ui3d/native-preferences';
import { ResourceLayer } from '../src/render/ResourceLayer';
import { PlantClusterLayer } from '../src/render/PlantClusterLayer';

const folded = () => new GraphicsStyleContext({ ...DEFAULT_GRAPHICS_STYLE_PREFERENCES, style: 'origami' });
function samples(material: THREE.NodeMaterial): Set<THREE.Node> {
  const result = new Set<THREE.Node>();
  for (const root of [material.colorNode, material.normalNode]) root?.traverse(node => {
    if (Reflect.get(node, 'isTextureNode') === true) result.add(node);
  });
  return result;
}

test('renderer construction contexts nest and restore the exact previous scope after throws', () => {
  const initial = currentGraphicsStyle(), outer = folded(), inner = new GraphicsStyleContext();
  try {
    withGraphicsStyle(outer, () => {
      expect(currentGraphicsStyle()).toBe(outer);
      expect(() => withGraphicsStyle(inner, () => {
        expect(currentGraphicsStyle()).toBe(inner); throw new Error('Inner construction failed');
      })).toThrow('Inner construction failed');
      expect(currentGraphicsStyle()).toBe(outer);
    });
    expect(currentGraphicsStyle()).toBe(initial);
    expect(() => withGraphicsStyle(outer, () => { throw new Error('Outer construction failed'); })).toThrow();
    expect(currentGraphicsStyle()).toBe(initial);
  } finally { outer.dispose(); inner.dispose(); }
});

test('default/plain paths neither allocate a paint atlas nor replace authored material nodes', () => {
  const context = new GraphicsStyleContext(), material = new THREE.MeshLambertNodeMaterial();
  const color = vec3(.4, .5, .6), normal = vec3(0, 1, 0);
  material.colorNode = color; material.normalNode = normal;
  try {
    expect(Reflect.get(context, 'atlas')).toBeUndefined();
    withGraphicsStyle(context, () => applyOrigamiSurface(material, vec3(1)));
    expect(material.colorNode).toBe(color); expect(material.normalNode).toBe(normal);
    expect(Reflect.get(context, 'atlas')).toBeUndefined();
    context.update({ ...DEFAULT_GRAPHICS_STYLE_PREFERENCES, impasto: 2 });
    expect(Reflect.get(context, 'atlas')).toBeUndefined();
    context.dispose(); expect(Reflect.get(context, 'atlas')).toBeUndefined();
  } finally { material.dispose(); context.dispose(); }
});

test('one lazy renderer atlas serves the shared paint and relief sample across materials', () => {
  const context = folded(), a = new THREE.MeshLambertNodeMaterial(), b = new THREE.MeshLambertNodeMaterial();
  try {
    expect(Reflect.get(context, 'atlas')).toBeUndefined();
    withGraphicsStyle(context, () => {
      applyOrigamiSurface(a, attribute('color', 'vec3'));
      applyOrigamiSurface(b, attribute('color', 'vec3'));
    });
    const atlas = context.paint;
    expect(context.paint).toBe(atlas);
    const pixels = atlas.image.data;
    expect(pixels).not.toBeNull();
    expect(pixels!.byteLength).toBeLessThanOrEqual(256 * 256 * 4);
    for (const material of [a, b]) {
      const reads = samples(material);
      expect(reads.size).toBe(1);
      expect(Reflect.get([...reads][0]!, 'value')).toBe(atlas);
    }
  } finally { a.dispose(); b.dispose(); context.dispose(); }
});

test('slider changes update existing uniforms without replacing nodes/textures or uploading the atlas', () => {
  const context = folded(), material = new THREE.MeshLambertNodeMaterial();
  try {
    applyOrigamiSurface(material, attribute('color', 'vec3'), undefined, context);
    const paint = context.paint, color = material.colorNode, normal = material.normalNode, version = paint.version;
    const uniforms = [context.impasto, context.edges, context.wear, context.contour];
    context.update({ style: 'origami', impasto: 1.7, edges: .24, wear: .18, contourImperfection: .81 });
    [context.impasto, context.edges, context.wear, context.contour].forEach((node, i) => expect(node).toBe(uniforms[i]));
    expect(uniforms.map(node => node.value)).toEqual([1.7, .24, .18, .81]);
    expect(material.colorNode).toBe(color); expect(material.normalNode).toBe(normal);
    expect(context.paint).toBe(paint); expect(paint.version).toBe(version);
  } finally { material.dispose(); context.dispose(); }
});

test('the context owns exactly one texture disposal and material disposal cannot retire its shared atlas', () => {
  const context = folded(), a = new THREE.MeshLambertNodeMaterial(), b = new THREE.MeshLambertNodeMaterial();
  applyOrigamiSurface(a, vec3(1), undefined, context); applyOrigamiSurface(b, vec3(1), undefined, context);
  const atlas = context.paint, disposed = vi.fn(); atlas.addEventListener('dispose', disposed);
  a.dispose(); b.dispose(); expect(disposed).not.toHaveBeenCalled();
  context.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
  context.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
  expect(Reflect.get(context, 'atlas')).toBeUndefined();
});

test('vegetation clones inherit the already authored surface before their wind material is constructed', () => {
  const context = folded(), plain = new THREE.MeshLambertNodeMaterial({ vertexColors: true });
  const textured = new THREE.MeshLambertNodeMaterial({ vertexColors: true });
  plain.userData.rendererOwned = textured.userData.rendererOwned = true;
  const result = withGraphicsStyle(context, () => {
    // Same construction seam as SceneRenderCore's textured material field.
    applyOrigamiSurface(textured, attribute('color', 'vec3'));
    return { resources: new ResourceLayer(new THREE.Group(), plain, textured), plants: new PlantClusterLayer(plain, textured) };
  });
  try {
    const wind = Reflect.get(result.resources, 'windTextured') as THREE.NodeMaterial;
    const tuft = (result.plants.group.children[0] as THREE.Mesh).material as THREE.NodeMaterial;
    for (const material of [wind, tuft]) {
      expect(material).not.toBe(textured);
      expect(material.colorNode).toBe(textured.colorNode); expect(material.normalNode).toBe(textured.normalNode);
      expect(material.positionNode).not.toBeNull();
      expect([...samples(material)].every(node => Reflect.get(node, 'value') === context.paint)).toBe(true);
    }
    const plainWind = Reflect.get(result.resources, 'windPlain') as THREE.NodeMaterial;
    expect(plainWind.colorNode).toBeNull(); expect(plainWind.normalNode).toBeNull();
  } finally { result.resources.dispose(); result.plants.dispose(); plain.dispose(); textured.dispose(); context.dispose(); }
});
