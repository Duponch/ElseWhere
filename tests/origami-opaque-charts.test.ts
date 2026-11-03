import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { bakedChartPixel, compileBakedCharts, projectBakedChart } from '../src/render/origami/baked/charts';
import { opaqueAtlasMipmaps } from '../src/render/origami/baked/material';

const options = { texelsPerUnit: 32, paddingTexels: 4, mipLevels: 3, maxAtlasSize: 1024, maxAtlasPixels: 1024 * 1024 };
const triangleCorners = (g: THREE.BufferGeometry): number[] => Array.from({ length: g.index?.count ?? g.getAttribute('position').count }, (_, i) => g.index ? g.index.getX(i) : i);
const bytes = (array: THREE.TypedArray): number[] => [...new Uint8Array(array.buffer, array.byteOffset, array.byteLength)];

describe('private opaque baked charts: topology, exact source data and bounded physical atlas', () => {
  it('keeps six real cube faces and removes only their internal coplanar diagonals', () => {
    const source = new THREE.BoxGeometry(2, 3, 4), originalIndex = bytes(source.index!.array), result = compileBakedCharts(source, options);
    expect(result.charts).toHaveLength(6);
    expect(result.triangles).toHaveLength(12);
    for (const chart of result.charts) { expect(chart.triangles).toHaveLength(2); expect(chart.boundaryEdges).toHaveLength(4); }
    expect([...result.sourceVertex]).toEqual(triangleCorners(source));
    expect(bytes(source.index!.array)).toEqual(originalIndex);
    expect(result.geometry.index).toBeNull();
    for (let v = 0; v < result.sourceVertex.length; v++) for (const name of ['position', 'normal', 'uv']) {
      const from = source.getAttribute(name), to = result.geometry.getAttribute(name);
      for (let c = 0; c < from.itemSize; c++) expect(to.getComponent(v, c)).toBe(from.getComponent(result.sourceVertex[v]!, c));
    }
    result.geometry.dispose(); source.dispose();
  });

  it('never joins UV seams, normal seams, ownership changes, groups or coincident overlays', () => {
    for (const seam of ['uv', 'normal', 'owner', 'group', 'overlay'] as const) {
      const source = new THREE.PlaneGeometry(2, 1).toNonIndexed(); source.clearGroups();
      if (seam === 'uv') { const uv = source.getAttribute('uv'); for (let v = 3; v < 6; v++) uv.setX(v, uv.getX(v) + .25); }
      if (seam === 'normal') { const normal = source.getAttribute('normal'); for (let v = 3; v < 6; v++) normal.setXYZ(v, 0, 1, 0); }
      if (seam === 'owner') source.setAttribute('animalPart', new THREE.Float32BufferAttribute([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3, 8, 0, 0, 3, 8, 0, 0, 3, 8, 0, 0], 4));
      if (seam === 'group') { source.addGroup(0, 3, 0); source.addGroup(3, 3, 0); }
      if (seam === 'overlay') {
        for (const a of Object.values(source.attributes)) for (let c = 0; c < a.itemSize; c++) for (let v = 0; v < 3; v++) a.setComponent(v + 3, c, a.getComponent(v, c));
      }
      const result = compileBakedCharts(source, options);
      expect(result.charts, seam).toHaveLength(2);
      expect(result.charts.every(chart => chart.boundaryEdges.length === 3), seam).toBe(true);
      result.geometry.dispose(); source.dispose();
    }
  });

  it('packs deterministic disjoint rectangles with explicit mip gutters and no fixed face resolution', () => {
    const source = new THREE.BoxGeometry(1, 2, 3), first = compileBakedCharts(source, options), second = compileBakedCharts(source, options);
    expect(first.charts).toEqual(second.charts); expect(bytes(first.geometry.getAttribute('bakedUv').array)).toEqual(bytes(second.geometry.getAttribute('bakedUv').array));
    expect(new Set(first.charts.map(chart => `${chart.content.width}:${chart.content.height}`)).size).toBeGreaterThan(1);
    for (const a of first.charts) {
      expect(a.content.x - a.rect.x).toBe(4); expect(a.content.y - a.rect.y).toBe(4);
      expect(a.rect.width - a.content.width).toBeGreaterThanOrEqual(8); expect(a.rect.height - a.content.height).toBeGreaterThanOrEqual(8);
      expect(a.rect.width - a.content.width).toBeLessThan(12); expect(a.rect.height - a.content.height).toBeLessThan(12);
      for (const value of [a.rect.x, a.rect.y, a.rect.width, a.rect.height]) expect(value % 4).toBe(0);
      expect(a.rect.x + a.rect.width).toBeLessThanOrEqual(first.atlas.width); expect(a.rect.y + a.rect.height).toBeLessThanOrEqual(first.atlas.height);
      for (const b of first.charts) if (a.id !== b.id) expect(a.rect.x + a.rect.width <= b.rect.x || b.rect.x + b.rect.width <= a.rect.x || a.rect.y + a.rect.height <= b.rect.y || b.rect.y + b.rect.height <= a.rect.y).toBe(true);
      for (const triangleId of a.triangles) for (const v of first.triangles[triangleId]!.outputVertices) {
        const uv = first.geometry.getAttribute('bakedUv'), x = uv.getX(v) * first.atlas.width, y = uv.getY(v) * first.atlas.height;
        expect(x).toBeGreaterThanOrEqual(a.content.x - 1e-4); expect(x).toBeLessThanOrEqual(a.content.x + a.content.width + 1e-4);
        expect(y).toBeGreaterThanOrEqual(a.content.y - 1e-4); expect(y).toBeLessThanOrEqual(a.content.y + a.content.height + 1e-4);
      }
    }
    first.geometry.dispose(); second.geometry.dispose(); source.dispose();
  });

  it('preserves physical aspect independently of raw UV shear and reports the normalized pigment isometry', () => {
    // An analytically known 4x1 XY rectangle with sheared UV: u=x/4+y/2,v=y.
    const source = new THREE.BufferGeometry();
    source.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 4, 0, 0, 0, 1, 0, 4, 1, 0], 3));
    source.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1, 1.5, 1], 2)); source.setIndex([0, 1, 2, 2, 1, 3]);
    const result = compileBakedCharts(source, options), chart = result.charts[0]!;
    expect(result.charts).toHaveLength(1);
    const p = [[0, 0, 0], [4, 0, 0], [0, 1, 0], [4, 1, 0]] as const;
    const pixel = p.map(point => bakedChartPixel(chart, projectBakedChart(chart, point), options.texelsPerUnit));
    expect(Math.hypot(pixel[1]![0] - pixel[0]![0], pixel[1]![1] - pixel[0]![1])).toBeCloseTo(128, 10);
    expect(Math.hypot(pixel[2]![0] - pixel[0]![0], pixel[2]![1] - pixel[0]![1])).toBeCloseTo(32, 10);
    // dP/du=(4,0,0),dP/dv=(-2,1,0), determinant area factor=4.
    for (const triangle of result.triangles) { expect(triangle.metricValid).toBe(true); expect(triangle.pigmentMetric).toEqual([2, -1, .5]); }
    const output = result.geometry.getAttribute('bakedUv');
    for (let corner = 0; corner < result.sourceVertex.length; corner++) {
      const expected = pixel[result.sourceVertex[corner]!]!;
      expect(output.getX(corner) * result.atlas.width).toBeCloseTo(expected[0], 4); expect(output.getY(corner) * result.atlas.height).toBeCloseTo(expected[1], 4);
    }
    result.geometry.dispose(); source.dispose();
  });

  it('retains interleaved raw bits, normalized metadata, instance ownership, morphs and selected index ranges', () => {
    const source = new THREE.InstancedBufferGeometry(), data = new THREE.InterleavedBuffer(new Float32Array([
      -0, 0, 0, 0, 0, 11, 1, 0, 0, 1, 0, 12, 0, 1, 0, 0, 1, 13, 1, 1, 0, 1, 1, 14,
    ]), 6);
    source.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0)); source.setAttribute('uv', new THREE.InterleavedBufferAttribute(data, 2, 3));
    source.setAttribute('partWord', new THREE.InterleavedBufferAttribute(data, 1, 5));
    const normalized = new THREE.Uint8BufferAttribute([255, 0, 128, 255], 1, true); source.setAttribute('normalizedMark', normalized);
    const instance = new THREE.InstancedBufferAttribute(new Float32Array([1, 2, 3, 4]), 4); source.setAttribute('aTo', instance); source.instanceCount = 1;
    source.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0, .1, 1, 0, .2, 0, 1, .3, 1, 1, .4], 3)]; source.morphTargetsRelative = true;
    source.setIndex([2, 1, 3, 0, 1, 2]); source.setDrawRange(3, 3); source.addGroup(3, 3, 7); source.userData.origamiWear = new THREE.BufferGeometry();
    const before = bytes(data.array), result = compileBakedCharts(source, options), p = result.geometry.getAttribute('position') as THREE.InterleavedBufferAttribute;
    expect(result.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry); expect((result.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(1);
    expect(result.geometry.getAttribute('aTo')).toBe(instance); expect(result.geometry.drawRange).toEqual({ start: 3, count: 3 }); expect(result.geometry.groups).toEqual(source.groups);
    expect(p.data).toBe((result.geometry.getAttribute('uv') as THREE.InterleavedBufferAttribute).data); expect(p.data).not.toBe(data);
    const rawSource = new Uint32Array(data.array.buffer), rawOutput = new Uint32Array(p.data.array.buffer);
    for (let v = 0; v < result.sourceVertex.length; v++) for (let c = 0; c < 6; c++) expect(rawOutput[v * 6 + c]).toBe(rawSource[result.sourceVertex[v]! * 6 + c]);
    expect(result.geometry.getAttribute('normalizedMark').normalized).toBe(true);
    for (let v = 0; v < result.sourceVertex.length; v++) {
      expect(result.geometry.getAttribute('normalizedMark').array[v]).toBe(normalized.array[result.sourceVertex[v]!]!);
      expect(result.geometry.morphAttributes.position![0]!.getZ(v)).toBe(source.morphAttributes.position![0]!.getZ(result.sourceVertex[v]!));
    }
    expect(result.geometry.morphTargetsRelative).toBe(true); expect(result.geometry.userData.origamiWear).toBeUndefined(); expect(bytes(data.array)).toEqual(before);
    result.geometry.dispose(); source.userData.origamiWear.dispose(); source.dispose();
  });

  it('refuses triangle/byte budgets before reading vertices and refuses atlas/mip budgets without constructing output geometry', () => {
    const source = new THREE.PlaneGeometry(10, 1), position = source.getAttribute('position'), read = vi.spyOn(position, 'getX');
    expect(() => compileBakedCharts(source, { ...options, maxTriangles: 1 })).toThrow(/budget/);
    expect(() => compileBakedCharts(source, { ...options, maxOutputBytes: 1 })).toThrow(/budget/); expect(read).not.toHaveBeenCalled(); read.mockRestore();
    const write = vi.spyOn(THREE.BufferGeometry.prototype, 'setAttribute');
    expect(() => compileBakedCharts(source, { ...options, maxAtlasSize: 16 })).toThrow(/budget/);
    expect(() => compileBakedCharts(source, { ...options, maxAtlasPixels: 10 })).toThrow(/budget/);
    expect(() => compileBakedCharts(source, { ...options, paddingTexels: 1, mipLevels: 3 })).toThrow(/gutter/);
    expect(write).not.toHaveBeenCalled(); write.mockRestore(); source.dispose();
  });

  it('isolates actual globally generated mip3 bilinear samples at every content boundary, including a failing unaligned control', () => {
    const decode = (b: number): number => { const x = b / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
    const bilinear = (mip: { data: Uint8Array; width: number; height: number }, xBase: number, yBase: number, level: number): number[] => {
      const x = xBase / 2 ** level - .5, y = yBase / 2 ** level - .5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const tap = (dx: number, dy: number, c: number): number => decode(mip.data[(Math.max(0, Math.min(mip.height - 1, iy + dy)) * mip.width + Math.max(0, Math.min(mip.width - 1, ix + dx))) * 4 + c]!);
      return [0, 1, 2].map(c => (tap(0, 0, c) * (1 - fx) + tap(1, 0, c) * fx) * (1 - fy) + (tap(0, 1, c) * (1 - fx) + tap(1, 1, c) * fx) * fy);
    };
    const unaligned = new Uint8Array(64 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) unaligned.set(x >= 3 && x < 27 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 64 + x) * 4);
    const badMips = opaqueAtlasMipmaps(unaligned, 64, 32, 4), contaminated = bilinear(badMips[3]!, 11, 16, 3);
    // Eight base pixels from rect.x=3 does NOT isolate a global mip footprint.
    expect(contaminated[0]).toBeLessThan(.999); expect(contaminated[2]).toBeGreaterThan(.001);

    const source = new THREE.BoxGeometry(1.11, .73, .47), result = compileBakedCharts(source, { ...options, texelsPerUnit: 17, paddingTexels: 8, mipLevels: 4 });
    const data = new Uint8Array(result.atlas.width * result.atlas.height * 4); for (let i = 3; i < data.length; i += 4) data[i] = 255;
    for (const chart of result.charts) {
      const color = chart.id % 2 ? [0, 0, 255, 255] : [255, 0, 0, 255];
      for (let y = chart.rect.y; y < chart.rect.y + chart.rect.height; y++) for (let x = chart.rect.x; x < chart.rect.x + chart.rect.width; x++) data.set(color, (y * result.atlas.width + x) * 4);
    }
    const mips = opaqueAtlasMipmaps(data, result.atlas.width, result.atlas.height, 4);
    for (const chart of result.charts) {
      const x0 = chart.content.x, y0 = chart.content.y, x1 = x0 + (chart.max[0] - chart.min[0]) * result.atlas.texelsPerUnit, y1 = y0 + (chart.max[1] - chart.min[1]) * result.atlas.texelsPerUnit;
      const boundary = [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]];
      for (let level = 0; level < 4; level++) for (const [x, y] of boundary) {
        const color = bilinear(mips[level]!, x!, y!, level);
        expect(color[chart.id % 2 ? 2 : 0]).toBeCloseTo(1, 10); expect(color[chart.id % 2 ? 0 : 2]).toBeCloseTo(0, 10); expect(color[1]).toBe(0);
      }
    }
    result.geometry.dispose(); source.dispose();
  });
});
