import * as THREE from 'three/webgpu';
import {packMaxRectsNoRotation} from './rectangle-pack';

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
export interface BakedChartOptions {
  texelsPerUnit: number;
  /** Gutter on EACH side. Must cover 2^(mipLevels-1) base pixels. */
  paddingTexels?: number;
  mipLevels?: number;
  maxAtlasSize?: number;
  maxAtlasPixels?: number;
  /** Planning bound for output attributes/maps plus 512 bytes per triangle.
   * JS object/Map allocator overhead is not a measured memory guarantee. */
  maxOutputBytes?: number;
  maxTriangles?: number;
  rawUvAttribute?: string;
  positionTolerance?: number;
  uvTolerance?: number;
  planeTolerance?: number;
}
export interface PixelRect { x: number; y: number; width: number; height: number }
export interface BakedTriangle {
  id: number;
  sourceTriangle: number;
  sourceVertices: readonly [number, number, number];
  outputVertices: readonly [number, number, number];
  chartId: number;
  rawUv: readonly [Vec2, Vec2, Vec2];
  /** Upper triangular UV isometry divided by sqrt(A*D), matching pigment density. */
  pigmentMetric: readonly [number, number, number];
  metricValid: boolean;
}
export interface BakedChart {
  id: number;
  triangles: number[];
  origin: Vec3;
  axisU: Vec3;
  axisV: Vec3;
  normal: Vec3;
  min: Vec2;
  max: Vec2;
  rect: PixelRect;
  content: PixelRect;
  /** Topological chart boundaries, NOT necessarily painted folds. */
  boundaryEdges: { triangle: number; fromCorner: number; toCorner: number }[];
}
export interface BakedChartSet {
  /** Owned copy. No source material, companion geometry or userData cache is retained. */
  geometry: THREE.BufferGeometry;
  /** Output vertex -> source vertex. Triangle/index reference order is unchanged. */
  sourceVertex: Uint32Array;
  triangleChart: Uint32Array;
  charts: BakedChart[];
  triangles: BakedTriangle[];
  atlas: { width: number; height: number; texelsPerUnit: number; paddingTexels: number; mipLevels: number };
  estimatedOutputBytes: number;
}
type Edge = { triangle: number; a: number; b: number; from: number; to: number };
type WorkTriangle = { vertices: readonly [number, number, number]; points: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; normal: THREE.Vector3; partition: string };
const instanced = (a: Attribute): boolean => a instanceof THREE.InstancedBufferAttribute || a instanceof THREE.InterleavedBufferAttribute && a.data instanceof THREE.InstancedInterleavedBuffer;
const rawIndex = (a: Attribute, vertex: number, component: number): number => a instanceof THREE.InterleavedBufferAttribute ? vertex * a.data.stride + a.offset + component : vertex * a.itemSize + component;
const rawWord = (a: Attribute, vertex: number, component: number): number => a.array[rawIndex(a, vertex, component)]!;
const numberKey = (value: number): string => Object.is(value, -0) ? '-0' : String(value);
const tuple = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
const integer = (value: number, min: number, name: string): number => { if (!Number.isSafeInteger(value) || value < min) throw new Error(`Baked charts: invalid ${name}`); return value; };
const positive = (value: number, name: string): number => { if (!Number.isFinite(value) || value <= 0) throw new Error(`Baked charts: invalid ${name}`); return value; };
const powerOfTwo = (value: number): number => 2 ** Math.ceil(Math.log2(Math.max(1, value)));

/** Rest-surface metric only. Rigid poses preserve it; non-affine wind/morphs do not. */
function metric(points: readonly THREE.Vector3[], uv: readonly Vec2[]): { value: readonly [number, number, number]; valid: boolean } {
  const du = new THREE.Vector2(uv[1]![0] - uv[0]![0], uv[1]![1] - uv[0]![1]), dv = new THREE.Vector2(uv[2]![0] - uv[0]![0], uv[2]![1] - uv[0]![1]);
  const determinant = du.x * dv.y - du.y * dv.x;
  const invalid = { value: [1, 0, 1] as const, valid: false };
  if (Math.abs(determinant) <= Math.max(1e-30, du.length() * dv.length() * 1e-7)) return invalid;
  const p = points[1]!.clone().sub(points[0]!), q = points[2]!.clone().sub(points[0]!);
  const tangent = p.clone().multiplyScalar(dv.y).addScaledVector(q, -du.y).divideScalar(determinant);
  const bitangent = q.clone().multiplyScalar(du.x).addScaledVector(p, -dv.x).divideScalar(determinant);
  let a = tangent.length(); if (!(a > 1e-10)) return invalid;
  tangent.divideScalar(a); let c = tangent.dot(bitangent), d = bitangent.addScaledVector(tangent, -c).length();
  if (!(d > 1e-10) || ![a, c, d].every(Number.isFinite)) return invalid;
  a = Math.min(1e6, a); c = Math.max(-1e6, Math.min(1e6, c)); d = Math.min(1e6, d);
  const density = 1 / Math.sqrt(a * d);
  return { value: [a * density, c * density, d * density], valid: true };
}

/** Project source-space position to the chart's orthonormal physical plane. */
export function projectBakedChart(chart: BakedChart, position: Vec3): [number, number] {
  const x = position[0] - chart.origin[0], y = position[1] - chart.origin[1], z = position[2] - chart.origin[2];
  return [x * chart.axisU[0] + y * chart.axisU[1] + z * chart.axisU[2], x * chart.axisV[0] + y * chart.axisV[1] + z * chart.axisV[2]];
}
export function bakedChartPixel(chart: BakedChart, point: Vec2, texelsPerUnit: number): [number, number] {
  return [chart.content.x + (point[0] - chart.min[0]) * texelsPerUnit, chart.content.y + (point[1] - chart.min[1]) * texelsPerUnit];
}

/**
 * Private opaque-surface prototype. Expands triangle corners in original index
 * order; no welding, coordinate deformation, winding, normal or rig changes.
 * All static source bytes (including interleaved padding) are copied exactly.
 * Instanced attributes are borrowed unchanged; disposing this geometry must not
 * dispose its owning mesh's instance streams. Source userData is intentionally
 * NOT copied: cached companions/vertex ranges need explicit owner adaptation.
 * Vertex-index-dependent SSBO shaders require sourceVertex indirection and are
 * not automatically admitted by this geometry-only API.
 */
export function compileBakedCharts(source: THREE.BufferGeometry, options: BakedChartOptions): BakedChartSet {
  const density = positive(options.texelsPerUnit, 'texelsPerUnit'), mipLevels = integer(options.mipLevels ?? 1, 1, 'mipLevels');
  if (mipLevels > 13) throw new Error('Baked charts: mipLevels exceed bounded atlas domain');
  const quantum = 2 ** (mipLevels - 1), padding = integer(options.paddingTexels ?? quantum, 1, 'paddingTexels');
  if (padding < quantum) throw new Error('Baked charts: insufficient mip gutter');
  const maxSize = integer(options.maxAtlasSize ?? 4096, 1, 'maxAtlasSize'), maxPixels = integer(options.maxAtlasPixels ?? 16_777_216, 1, 'maxAtlasPixels');
  if (maxSize > 16384) throw new Error('Baked charts: maxAtlasSize exceeds prototype bound');
  const atlasLimit = Math.floor(maxSize / quantum) * quantum;
  if (atlasLimit < quantum) throw new Error('Baked charts: atlas mip alignment budget refused');
  const align = (value: number): number => Math.ceil(value / quantum) * quantum;
  const maxBytes = integer(options.maxOutputBytes ?? 128 * 1024 * 1024, 1, 'maxOutputBytes'), maxTriangles = integer(options.maxTriangles ?? 200_000, 1, 'maxTriangles');
  const positionTolerance = positive(options.positionTolerance ?? 1e-7, 'positionTolerance'), uvTolerance = positive(options.uvTolerance ?? 1e-7, 'uvTolerance'), planeTolerance = positive(options.planeTolerance ?? 1e-6, 'planeTolerance');
  const rawUvName = options.rawUvAttribute ?? 'uv', position = source.getAttribute('position'), uv = source.getAttribute(rawUvName);
  if (!position || position.itemSize !== 3 || !uv || uv.itemSize !== 2 || instanced(position) || instanced(uv)) throw new Error('Baked charts: static position.xyz and raw UV.xy required');
  if (source.hasAttribute('bakedUv')) throw new Error('Baked charts: bakedUv already exists');
  const count = source.index?.count ?? position.count;
  integer(count, 0, 'corner count'); if (count % 3 || count / 3 > maxTriangles) throw new Error('Baked charts: triangle budget/alignment refused');
  const validateRange = (start: number, length: number): void => {
    integer(start, 0, 'range start'); if (start % 3 || length !== Infinity && (!Number.isSafeInteger(length) || length < 0 || length % 3)) throw new Error('Baked charts: partial triangle range refused');
  };
  validateRange(source.drawRange.start, source.drawRange.count);
  for (const group of source.groups) validateRange(group.start, group.count);
  const staticAttributes = Object.entries(source.attributes).filter(([, a]) => !instanced(a));
  const morphNames = ['position', 'normal', 'color'] as const;
  const morphAttributes: Attribute[] = []; for (const name of morphNames) { const attributes = source.morphAttributes[name]; if (attributes) morphAttributes.push(...attributes); }
  const allStatic = [...staticAttributes.map(([, a]) => a), ...morphAttributes];
  const buffers = new Set<THREE.InterleavedBuffer>(); let bytesPerCorner = 8 + 4;
  for (const attribute of allStatic) {
    if (attribute instanceof THREE.Float16BufferAttribute) throw new Error('Baked charts: Float16 attributes require a dedicated clone adapter');
    if (attribute.count !== position.count) throw new Error('Baked charts: attribute count mismatch');
    if (attribute instanceof THREE.InterleavedBufferAttribute) { if (!buffers.has(attribute.data)) { buffers.add(attribute.data); bytesPerCorner += attribute.data.stride * attribute.array.BYTES_PER_ELEMENT; } }
    else bytesPerCorner += attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
  }
  const estimatedOutputBytes = count * bytesPerCorner + count / 3 * 512;
  if (!Number.isSafeInteger(estimatedOutputBytes) || estimatedOutputBytes > maxBytes) throw new Error('Baked charts: output byte budget refused before allocation');
  // Only after admission above do we allocate triangle-sized working storage.
  const triangles: BakedTriangle[] = [], work: WorkTriangle[] = [], edges = new Map<string, Edge[]>(), parents = new Int32Array(count / 3);
  const semantic = staticAttributes.filter(([name]) => !['position', 'normal', 'tangent'].includes(name) && !/uv/i.test(name));
  const continuity = staticAttributes.filter(([name]) => /uv/i.test(name) || name === 'normal' || name === 'tangent');
  const pointKey = (p: THREE.Vector3): string => [p.x, p.y, p.z].map(v => Math.round(v / positionTolerance)).join(',');
  for (let id = 0; id < count / 3; id++) {
    const vertices = [0, 1, 2].map(corner => source.index ? source.index.getX(id * 3 + corner) : id * 3 + corner) as [number, number, number];
    if (vertices.some(vertex => !Number.isSafeInteger(vertex) || vertex < 0 || vertex >= position.count)) throw new Error('Baked charts: invalid source index');
    const points = vertices.map(vertex => new THREE.Vector3().fromBufferAttribute(position, vertex)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const rawUv = vertices.map(vertex => [uv.getX(vertex), uv.getY(vertex)] as const) as [Vec2, Vec2, Vec2];
    if (!points.every(p => [p.x, p.y, p.z].every(Number.isFinite)) || !rawUv.flat().every(Number.isFinite)) throw new Error('Baked charts: non-finite position/UV');
    const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
    // Differing third-corner ownership is conservatively a new chart, even if
    // shared endpoints happen to match. This includes bone weights/paint IDs.
    const partition = semantic.map(([name, a]) => `${name}:${vertices.map(v => Array.from({ length: a.itemSize }, (_, c) => numberKey(rawWord(a, v, c))).join(',')).sort().join(';')}`).join('|')
      + '/' + source.groups.map((group, g) => id * 3 >= group.start && id * 3 + 3 <= group.start + group.count ? `${g}:${group.materialIndex ?? 0}` : '').filter(Boolean).join(',');
    const paint = metric(points, rawUv); parents[id] = id;
    work.push({ vertices, points, normal, partition });
    triangles.push({ id, sourceTriangle: id, sourceVertices: vertices, outputVertices: [id * 3, id * 3 + 1, id * 3 + 2], chartId: -1, rawUv, pigmentMetric: paint.value, metricValid: paint.valid });
    for (let from = 0; from < 3; from++) {
      const to = (from + 1) % 3, ka = pointKey(points[from]!), kb = pointKey(points[to]!), key = ka < kb ? `${ka}/${kb}` : `${kb}/${ka}`;
      const bucket = edges.get(key) ?? []; bucket.push({ triangle: id, a: vertices[from]!, b: vertices[to]!, from, to }); edges.set(key, bucket);
    }
  }
  const root = (id: number): number => { let r = id; while (parents[r] !== r) r = parents[r]!; while (id !== r) { const next = parents[id]!; parents[id] = r; id = next; } return r; };
  const joined = new Set<string>();
  for (const bucket of edges.values()) {
    // More than two incidents is ambiguous (overlays/non-manifold): never weld.
    if (bucket.length !== 2) continue;
    const [a, b] = bucket as [Edge, Edge], ta = work[a.triangle]!, tb = work[b.triangle]!;
    if (ta.partition !== tb.partition || ta.normal.lengthSq() === 0 || ta.normal.dot(tb.normal) < 1 - 1e-10) continue;
    if (tb.points.some(p => Math.abs(ta.normal.dot(p.clone().sub(ta.points[0]))) > planeTolerance)) continue;
    const match = (va: number, vb: number): boolean => {
      const pa = new THREE.Vector3().fromBufferAttribute(position, va), pb = new THREE.Vector3().fromBufferAttribute(position, vb);
      if (pa.distanceToSquared(pb) > positionTolerance * positionTolerance) return false;
      return continuity.every(([, attribute]) => Array.from({ length: attribute.itemSize }, (_, c) => Math.abs(attribute.getComponent(va, c) - attribute.getComponent(vb, c)) <= uvTolerance).every(Boolean));
    };
    // Opposite half-edges only: coincident same-winding triangles are overlays.
    if (!match(a.a, b.b) || !match(a.b, b.a)) continue;
    const ar = root(a.triangle), br = root(b.triangle); if (ar !== br) parents[Math.max(ar, br)] = Math.min(ar, br);
    joined.add(`${a.triangle}:${a.from}`); joined.add(`${b.triangle}:${b.from}`);
  }
  const charts: BakedChart[] = [], roots = new Map<number, BakedChart>();
  for (const triangle of triangles) {
    const r = root(triangle.id); let chart = roots.get(r);
    if (!chart) {
      const first = work[r]!, u = first.points[1].clone().sub(first.points[0]); if (u.lengthSq() < 1e-30) u.set(1, 0, 0); u.normalize();
      const n = first.normal.clone(); if (n.lengthSq() === 0) { n.set(0, 0, 1); if (Math.abs(n.dot(u)) > .99) n.set(0, 1, 0); n.addScaledVector(u, -n.dot(u)).normalize(); }
      chart = { id: charts.length, triangles: [], origin: tuple(first.points[0]), axisU: tuple(u), axisV: tuple(n.clone().cross(u).normalize()), normal: tuple(n), min: [Infinity, Infinity], max: [-Infinity, -Infinity], rect: { x: 0, y: 0, width: 0, height: 0 }, content: { x: 0, y: 0, width: 0, height: 0 }, boundaryEdges: [] };
      roots.set(r, chart); charts.push(chart);
    }
    // Pairwise tolerances must not chain into a curved component. Refuse such
    // input rather than silently flattening an accumulated series of bends.
    const current = work[triangle.id]!;
    if (current.normal.lengthSq() > 0 && current.normal.dot(new THREE.Vector3(...chart.normal)) < 1 - 1e-10
      || current.points.some(p => Math.abs((p.x - chart!.origin[0]) * chart!.normal[0] + (p.y - chart!.origin[1]) * chart!.normal[1] + (p.z - chart!.origin[2]) * chart!.normal[2]) > planeTolerance)) throw new Error('Baked charts: transitive non-planar chart refused');
    triangle.chartId = chart.id; chart.triangles.push(triangle.id);
    for (const point of work[triangle.id]!.points) { const q = projectBakedChart(chart, tuple(point)); chart.min = [Math.min(chart.min[0], q[0]), Math.min(chart.min[1], q[1])]; chart.max = [Math.max(chart.max[0], q[0]), Math.max(chart.max[1], q[1])]; }
    for (let from = 0; from < 3; from++) if (!joined.has(`${triangle.id}:${from}`)) chart.boundaryEdges.push({ triangle: triangle.id, fromCorner: from, toCorner: (from + 1) % 3 });
  }
  let area = 0, widest = 1;
  for (const chart of charts) {
    chart.content.width = Math.max(1, Math.ceil((chart.max[0] - chart.min[0]) * density)); chart.content.height = Math.max(1, Math.ceil((chart.max[1] - chart.min[1]) * density));
    // Global box-filtered mips also sample across rectangle boundaries. Align
    // BOTH ends to the coarsest admitted level, so that one quantum of gutter
    // isolates even bilinear taps on a content boundary at that mip level.
    // The content coordinates/density stay exact; only the outer padding grows.
    chart.rect.width = align(chart.content.width + 2 * padding); chart.rect.height = align(chart.content.height + 2 * padding);
    if (!Number.isSafeInteger(chart.rect.width * chart.rect.height) || chart.rect.width > atlasLimit || chart.rect.height > atlasLimit) throw new Error('Baked charts: chart exceeds atlas dimension budget');
    area += chart.rect.width * chart.rect.height; widest = Math.max(widest, chart.rect.width);
  }
  if (area > maxPixels) throw new Error('Baked charts: atlas pixel budget refused');
  const ordered = [...charts].sort((a, b) => b.rect.height - a.rect.height || b.rect.width - a.rect.width || a.id - b.id);
  let width = Math.min(atlasLimit, powerOfTwo(Math.max(quantum, widest, Math.sqrt(area)))), height = quantum;
  for (;;) {
    let x = 0, y = 0, row = 0;
    for (const chart of ordered) { if (x + chart.rect.width > width) { x = 0; y += row; row = 0; } chart.rect.x = x; chart.rect.y = y; x += chart.rect.width; row = Math.max(row, chart.rect.height); }
    height = powerOfTwo(Math.max(quantum, y + row));
    if (height <= atlasLimit && width * height <= maxPixels) break;
    if (width === atlasLimit) {
      // Preserve every already admitted shelf layout. Only a rejected atlas
      // tries a denser placement; density, chart dimensions and mip gutters
      // remain unchanged, with no extra texture or work during rendering.
      const fallbackHeight = Math.min(atlasLimit, 2 ** Math.floor(Math.log2(maxPixels / width)));
      if (fallbackHeight < quantum) throw new Error('Baked charts: packed atlas budget refused');
      const packed = packMaxRectsNoRotation(charts.map(chart => ({id: chart.id, width: chart.rect.width, height: chart.rect.height})), {width, height: fallbackHeight, quantum, maxPixels});
      if (!packed) throw new Error('Baked charts: packed atlas budget refused');
      for (const placement of packed.placements) {
        const chart = charts[placement.id]!;
        chart.rect.x = placement.x; chart.rect.y = placement.y;
      }
      height = fallbackHeight;
      break;
    }
    width = Math.min(atlasLimit, width * 2);
  }
  for (const chart of charts) { chart.content.x = chart.rect.x + padding; chart.content.y = chart.rect.y + padding; }
  const sourceVertex = new Uint32Array(count), triangleChart = new Uint32Array(triangles.length), bakedUv = new Float32Array(count * 2);
  for (const triangle of triangles) {
    const chart = charts[triangle.chartId]!; triangleChart[triangle.id] = chart.id;
    for (let c = 0; c < 3; c++) { const output = triangle.id * 3 + c; sourceVertex[output] = triangle.sourceVertices[c]!; const p = bakedChartPixel(chart, projectBakedChart(chart, tuple(work[triangle.id]!.points[c]!)), density); bakedUv[output * 2] = p[0] / width; bakedUv[output * 2 + 1] = p[1] / height; }
  }
  const copied = new Map<THREE.InterleavedBuffer, THREE.InterleavedBuffer>();
  const expand = (attribute: Attribute): Attribute => {
    if (instanced(attribute)) return attribute;
    const Constructor = attribute.array.constructor as THREE.TypedArrayConstructor;
    const stride = attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.stride : attribute.itemSize;
    const copyArray = (): THREE.TypedArray => {
      const output = new Constructor(count * stride), bytes = attribute.array.BYTES_PER_ELEMENT;
      const src = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength), dst = new Uint8Array(output.buffer, output.byteOffset, output.byteLength);
      for (let v = 0; v < count; v++) { const first = sourceVertex[v]! * stride * bytes; dst.set(src.subarray(first, first + stride * bytes), v * stride * bytes); }
      return output;
    };
    if (attribute instanceof THREE.InterleavedBufferAttribute) {
      let data = copied.get(attribute.data); if (!data) { data = new THREE.InterleavedBuffer(copyArray(), stride); data.setUsage(attribute.data.usage); copied.set(attribute.data, data); }
      const result = new THREE.InterleavedBufferAttribute(data, attribute.itemSize, attribute.offset, attribute.normalized); result.name = attribute.name; return result;
    }
    const result = new THREE.BufferAttribute(copyArray(), attribute.itemSize, attribute.normalized); result.name = attribute.name; result.setUsage(attribute.usage); result.gpuType = attribute.gpuType; return result;
  };
  const geometry = source instanceof THREE.InstancedBufferGeometry ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, expand(attribute));
  for (const name of morphNames) { const attributes = source.morphAttributes[name]; if (attributes) geometry.morphAttributes[name] = attributes.map(expand); }
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  if (geometry instanceof THREE.InstancedBufferGeometry && source instanceof THREE.InstancedBufferGeometry) geometry.instanceCount = source.instanceCount;
  geometry.name = `${source.name} — opaque baked UV charts`; geometry.setAttribute('bakedUv', new THREE.BufferAttribute(bakedUv, 2));
  geometry.setDrawRange(source.drawRange.start, source.drawRange.count); for (const group of source.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.boundingBox = source.boundingBox?.clone() ?? null; geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  return { geometry, sourceVertex, triangleChart, charts, triangles, atlas: { width, height, texelsPerUnit: density, paddingTexels: padding, mipLevels }, estimatedOutputBytes };
}
