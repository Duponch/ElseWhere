import { expect, test } from 'vitest';
import * as THREE from 'three/webgpu';
import { PawnLayer } from '../src/render/PawnLayer';
import { WildlifeLayer } from '../src/render/WildlifeLayer';
import { PAWN_SURFACE } from '../src/render/actor-surface';
import { createStylizedSurfaceTexture } from '../src/render/stylized-surfaces';
import { createWorld } from '../src/sim/index';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';

function hasPigmentSample(material: THREE.MeshStandardNodeMaterial): boolean {
  let found = false;
  material.colorNode?.traverse(node => { if (node.constructor.name === 'TextureNode') found = true; });
  return found;
}

test('actor texture switch preserves resident rigs and leaves plain color shaders free of pigment sampling', () => {
  const world = createWorld(42, 32, 32), pawns = new PawnLayer(), wildlife = new WildlifeLayer();
  try {
    pawns.setTexturesEnabled(false); // A saved preference may arrive before the first world.
    pawns.update(world, 1, true);
    const human = pawns.group.children[0] as THREE.Mesh;
    const humanGeometry = human.geometry, humanPlain = human.material as THREE.MeshStandardNodeMaterial;
    expect(hasPigmentSample(humanPlain)).toBe(false);
    expect(humanGeometry.hasAttribute('uv')).toBe(false);
    pawns.setTexturesEnabled(true);
    const humanTextured = human.material as THREE.MeshStandardNodeMaterial;
    expect(humanTextured).not.toBe(humanPlain);
    expect(hasPigmentSample(humanTextured)).toBe(true);
    expect(human.geometry).toBe(humanGeometry);
    const poses = humanGeometry.getAttribute('aFrom');
    world.pawns.reverse(); pawns.update(world, 1, false);
    expect(human.material).toBe(humanTextured);
    expect(human.geometry.getAttribute('aFrom')).toBe(poses);
    pawns.setTexturesEnabled(false);
    expect(human.material).toBe(humanPlain);

    const animals = wildlife.mesh.children.filter(mesh => mesh.name.startsWith('Wild ')) as THREE.Mesh[];
    expect(animals).toHaveLength(ANIMAL_SPECIES_IDS.length);
    expect(animals.map(mesh=>mesh.name)).toEqual(ANIMAL_SPECIES_IDS.map(species=>`Wild ${species} — GPU rig`));
    const animalGeometry = animals.map(mesh => mesh.geometry);
    const animalTextured = animals.map(mesh => mesh.material as THREE.MeshStandardNodeMaterial);
    expect(animalTextured.every(hasPigmentSample)).toBe(true);
    expect(animalGeometry.every(geometry => !geometry.hasAttribute('uv'))).toBe(true);
    wildlife.setTexturesEnabled(false);
    const animalPlain = animals.map(mesh => mesh.material as THREE.MeshStandardNodeMaterial);
    expect(animalPlain.every(material => !hasPigmentSample(material))).toBe(true);
    animals.forEach((mesh, index) => expect(mesh.geometry).toBe(animalGeometry[index]));
    wildlife.setTexturesEnabled(true);
    animals.forEach((mesh, index) => expect(mesh.material).toBe(animalTextured[index]));
    wildlife.setTexturesEnabled(false);
    animals.forEach((mesh, index) => expect(mesh.material).toBe(animalPlain[index]));
  } finally {
    pawns.dispose(); wildlife.dispose();
  }
});

test('the painted pawn torso contains broad visible tonal zones while keeping a neutral RGB shade', () => {
  const map = createStylizedSurfaceTexture();
  try {
    const data = map.image.data as Uint8Array, width = map.image.width as number, height = map.image.height as number;
    const tone = (x: number, y: number, z: number): number => {
      const u = Math.max(0, Math.min(1, (x + z * PAWN_SURFACE.depthShift) * PAWN_SURFACE.horizontalScale + .5));
      const v = Math.max(0, Math.min(1, y * PAWN_SURFACE.verticalScale + PAWN_SURFACE.verticalOffset));
      const pixel = (Math.round(v * (height - 1)) * width + Math.round(u * (width - 1))) * 4;
      expect(data[pixel]).toBe(data[pixel + 1]);
      expect(data[pixel]).toBe(data[pixel + 2]);
      return Math.max(PAWN_SURFACE.minShade, Math.min(PAWN_SURFACE.maxShade,
        (data[pixel]! / 255 - PAWN_SURFACE.grayPivot) * PAWN_SURFACE.grayGain + PAWN_SURFACE.grayBase));
    };
    // The torso is roughly x ±0.175, y 0.60–1.04, front z 0.11.
    const tones = [0.65, .75, .85, .95, 1].flatMap(y => [-.17, -.08, 0, .08, .17].map(x => tone(x, y, .11)));
    expect(Math.max(...tones) - Math.min(...tones)).toBeGreaterThan(.2);
    expect(Math.min(...tones)).toBeGreaterThan(.74);
    expect(Math.max(...tones)).toBeLessThanOrEqual(1.02);
  } finally { map.dispose(); }
});
