import { expect, test } from 'vitest';
import * as THREE from 'three/webgpu';
import { pawnGeometry } from '../src/render/pawn-geometry';
import { PawnLayer } from '../src/render/PawnLayer';
import { createWorld } from '../src/sim/index';
import {HUMAN_REFERENCE_SCALE} from '../src/render/origami/human-geometry';

/** Weld duplicate draw vertices so the test measures the surface, not its storage layout. */
test('the shared reference torso is one closed connected surface without an internal cap', () => {
  const geometry = pawnGeometry();
  try {
    const position = geometry.getAttribute('position');
    expect(geometry.userData.origamiHumanReference).toBe(true);
    const parts=geometry.userData.origamiHumanParts as readonly {id:string;start:number;count:number;bone:number;dye:number}[];
    const torso=parts.find(part=>part.id==='reference-torso');expect(torso).toBeDefined();
    if(!torso)throw Error('Actual reference torso absent');
    expect(torso).toMatchObject({count:36,bone:0,dye:1});
    const bone = geometry.getAttribute('boneId');
    const dye = geometry.getAttribute('dye');
    const index = geometry.index;
    const triangles: number[][] = [];
    const vertices: [number, number, number][] = [];
    const ids = new Map<string, number>();
    const welded = (source: number): number => {
      const point: [number, number, number] = [position.getX(source), position.getY(source), position.getZ(source)];
      const key = point.map(value => Math.round(value * 1e6)).join(',');
      let id = ids.get(key);
      if (id === undefined) { id = vertices.length; ids.set(key, id); vertices.push(point); }
      return id;
    };
    const vertexAt = (corner: number) => index ? index.getX(corner) : corner;
    for (let first = torso.start; first < torso.start+torso.count; first += 3) {
      const source = [0, 1, 2].map(offset => vertexAt(first + offset));
      expect(source.every(id => bone.getX(id) === 0 && dye.getX(id) === 1)).toBe(true);
      triangles.push(source.map(welded));
    }
    expect(triangles.length).toBeGreaterThan(0);
    const y = vertices.map(point => point[1]);
    const minY = Math.min(...y), maxY = Math.max(...y);
    expect(maxY - minY).toBeGreaterThan(0.3);
    expect(minY,'the Source torso meets the upper trousers at its authored base').toBeCloseTo(.56*HUMAN_REFERENCE_SCALE,6);
    expect(maxY,'the Source torso retains its authored shoulder height').toBeCloseTo(1.20*HUMAN_REFERENCE_SCALE,6);

    const edgeFaces = new Map<string, number[]>();
    const faces = new Set<string>();
    triangles.forEach((triangle, face) => {
      expect(new Set(triangle).size, `collapsed body triangle ${face}`).toBe(3);
      const faceKey = [...triangle].sort((a, b) => a - b).join(':');
      expect(faces.has(faceKey), `duplicate body triangle ${face}`).toBe(false);
      faces.add(faceKey);
      const heights = triangle.map(id => vertices[id]![1]);
      const horizontal = heights.every(height => Math.abs(height - heights[0]!) < 1e-6);
      if (horizontal) {
        const level = heights[0]!;
        expect(level < minY + 1e-6 || level > maxY - 1e-6,
          `an internal horizontal cap remains at y=${level}`).toBe(true);
      }
      for (let side = 0; side < 3; side++) {
        const a = triangle[side]!, b = triangle[(side + 1) % 3]!;
        const key = [a, b].sort((left, right) => left - right).join(':');
        const adjacent = edgeFaces.get(key) ?? [];
        adjacent.push(face);
        edgeFaces.set(key, adjacent);
      }
    });
    for (const [edge, adjacent] of edgeFaces) {
      expect(adjacent.length, `open or overlapping surface at edge ${edge}`).toBe(2);
    }
    const visited = new Set<number>([0]), pending = [0];
    const neighbours: number[][] = triangles.map(() => []);
    for (const [a, b] of edgeFaces.values()) {
      neighbours[a!]!.push(b!);
      neighbours[b!]!.push(a!);
    }
    while (pending.length) for (const neighbour of neighbours[pending.pop()!]!) {
      if (!visited.has(neighbour)) { visited.add(neighbour); pending.push(neighbour); }
    }
    expect(visited.size, 'the authored torso must remain one connected closed surface').toBe(triangles.length);
  } finally {
    geometry.dispose();
  }
});

test('the joined pawn remains in the existing WebGPU vertex-stream budget', () => {
  const layer = new PawnLayer();
  try {
    layer.update(createWorld(42, 32, 32), 1, true);
    const geometry = layer.feedbackSource!;
    // Source UV/profile and scalar bone/dye remain inspectable CPU aliases.
    // The Default shader reads pawnRigTraits instead, and never samples paint
    // merely because those UVs exist. Actual eight full WGSL variants are
    // covered separately by the common-model contract, without a device here.
    const hair=geometry.getAttribute('aHair') as THREE.InterleavedBufferAttribute;
    const hairBlood=geometry.getAttribute('aHairBlood') as THREE.InterleavedBufferAttribute;
    const blood=geometry.getAttribute('aBodyBlood') as THREE.InterleavedBufferAttribute;
    expect([hair.itemSize,hairBlood.itemSize,blood.itemSize]).toEqual([3,4,1]);
    expect(hair.data).toBe(hairBlood.data);expect(blood.data).toBe(hairBlood.data);
    expect([hair.offset,hairBlood.offset,blood.offset,hairBlood.data.stride]).toEqual([10,10,13,18]);
    const traits=geometry.getAttribute('pawnRigTraits') as THREE.InterleavedBufferAttribute;
    for(const [name,offset]of [['boneId',0],['dye',1],['origamiMaterialProfile',2]] as const){const alias=geometry.getAttribute(name) as THREE.InterleavedBufferAttribute;expect(alias.data).toBe(traits.data);expect(alias.offset).toBe(traits.offset+offset);}
    expect(traits.itemSize).toBe(3);expect(geometry.getAttribute('uv')).toBe(geometry.getAttribute('origamiPaintUv'));
    const aliases=new Set(['aFire','aHair','aBodyBlood','boneId','dye','origamiMaterialProfile','uv','origamiPaintUv']);
    const active = Object.entries(geometry.attributes).filter(([name]) => !aliases.has(name));
    expect(active.map(([name])=>name).sort()).toEqual(['position','normal','color','pawnRigTraits','bindPivot',
      'aFrom','aTo','aMotion','aTravel','aCargo','aTint','aEquipment','aSkin','aShape','aHairBlood'].sort());
    const streams = new Set(active.map(([, attribute]) => attribute instanceof THREE.InterleavedBufferAttribute
      ? attribute.data : attribute));
    expect(active.length).toBeLessThanOrEqual(16);
    expect(streams.size).toBeLessThanOrEqual(7);
    expect(streams.size).toBe(7); // One model, one appearance, five motion/cargo streams.
  } finally {
    layer.dispose();
  }
});
