import * as THREE from 'three/webgpu';

/** The reference's physical face-coplanar edge strips. Build before transforming
 * a part, then transform the surface, lines and strips together into the GPU batch.
 * The original triangles, rounding, miter widths, UV spans and fold-wrap are kept.
 */
export function createPhysicalEdgeWearGeometry(nonIndexedGeo: THREE.BufferGeometry, edgesGeo: THREE.BufferGeometry, wearScale = 0.75): THREE.BufferGeometry | null {
      const edgePos = edgesGeo.attributes.position;
      if (!edgePos || edgePos.count === 0) return null;

      const vKey = (x: number, y: number, z: number) =>
        `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
      const eKey = (k1: string, k2: string) => (k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`);

      const sharpEdges = new Set();
      for (let i = 0; i < edgePos.count; i += 2) {
        const k1 = vKey(edgePos.getX(i), edgePos.getY(i), edgePos.getZ(i));
        const k2 = vKey(edgePos.getX(i + 1), edgePos.getY(i + 1), edgePos.getZ(i + 1));
        sharpEdges.add(eKey(k1, k2));
      }

      const triPos = nonIndexedGeo.attributes.position;
      const triCount = triPos.count / 3;

      const basePositions = [];
      const expandDirs = [];
      const normals = [];
      const uvs = [];

      const v0 = new THREE.Vector3();
      const v1 = new THREE.Vector3();
      const v2 = new THREE.Vector3();
      const e1 = new THREE.Vector3();
      const e2 = new THREE.Vector3();
      const faceNormal = new THREE.Vector3();
      const edgeVec = new THREE.Vector3();
      const dirE = new THREE.Vector3();
      const toOpp = new THREE.Vector3();
      const inward = new THREE.Vector3();
      const inwardDir = new THREE.Vector3();
      const miterA = new THREE.Vector3();
      const miterB = new THREE.Vector3();

      for (let t = 0; t < triCount; t++) {
        const i0 = t * 3;
        v0.fromBufferAttribute(triPos, i0);
        v1.fromBufferAttribute(triPos, i0 + 1);
        v2.fromBufferAttribute(triPos, i0 + 2);

        e1.subVectors(v1, v0);
        e2.subVectors(v2, v0);
        faceNormal.crossVectors(e1, e2);
        if (faceNormal.lengthSq() < 1e-10) continue;
        faceNormal.normalize();

        const verts = [v0, v1, v2];
        const keys = [
          vKey(v0.x, v0.y, v0.z),
          vKey(v1.x, v1.y, v1.z),
          vKey(v2.x, v2.y, v2.z)
        ];

        for (let s = 0; s < 3; s++) {
          const sNext = (s + 1) % 3;
          const sOpp = (s + 2) % 3;

          if (!sharpEdges.has(eKey(keys[s], keys[sNext]))) continue;

          const va = verts[s];
          const vb = verts[sNext];
          const vc = verts[sOpp];

          edgeVec.subVectors(vb, va);
          const edgeLen = edgeVec.length();
          if (edgeLen < 1e-4) continue;
          dirE.copy(edgeVec).divideScalar(edgeLen);

          toOpp.subVectors(vc, va);
          const projA = toOpp.dot(dirE);
          inward.copy(toOpp).addScaledVector(dirE, -projA);
          const triHeight = inward.length();
          if (triHeight < 1e-4) continue;
          inwardDir.copy(inward).divideScalar(triHeight);

          const maxWearWidth = Math.min(0.085, triHeight * 0.42, edgeLen * 0.38);

          const slopeA = Math.max(0, Math.min(1.2, projA / triHeight));
          const projB = dirE.dot(e2.subVectors(vb, vc));
          const slopeB = Math.max(0, Math.min(1.2, projB / triHeight));

          miterA.copy(inwardDir).addScaledVector(dirE, slopeA).multiplyScalar(maxWearWidth);
          miterB.copy(inwardDir).addScaledVector(dirE, -slopeB).multiplyScalar(maxWearWidth);

          const epsN = 0.0022;
          const foldWrap = -0.08;
          const oaX = va.x + faceNormal.x * epsN;
          const oaY = va.y + faceNormal.y * epsN;
          const oaZ = va.z + faceNormal.z * epsN;
          const obX = vb.x + faceNormal.x * epsN;
          const obY = vb.y + faceNormal.y * epsN;
          const obZ = vb.z + faceNormal.z * epsN;

          const uSpan = Math.max(0.35, edgeLen * 1.65);

          basePositions.push(oaX, oaY, oaZ, obX, obY, obZ, obX, obY, obZ);
          expandDirs.push(
            miterA.x * foldWrap, miterA.y * foldWrap, miterA.z * foldWrap,
            miterB.x * foldWrap, miterB.y * foldWrap, miterB.z * foldWrap,
            miterB.x, miterB.y, miterB.z
          );

          basePositions.push(oaX, oaY, oaZ, obX, obY, obZ, oaX, oaY, oaZ);
          expandDirs.push(
            miterA.x * foldWrap, miterA.y * foldWrap, miterA.z * foldWrap,
            miterB.x, miterB.y, miterB.z,
            miterA.x, miterA.y, miterA.z
          );

          for (let k = 0; k < 6; k++) {
            normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
          }

          uvs.push(
            0, 0,
            uSpan, 0,
            uSpan, 1,
            0, 0,
            uSpan, 1,
            0, 1
          );
        }
      }

      if (basePositions.length === 0) return null;

      const wearGeo = new THREE.BufferGeometry();
      const basePosArray = new Float32Array(basePositions);
      const expandDirArray = new Float32Array(expandDirs);
      const livePosArray = new Float32Array(basePositions.length);

      for (let i = 0; i < livePosArray.length; i++) {
        livePosArray[i] = basePosArray[i] + expandDirArray[i] * wearScale;
      }

      wearGeo.setAttribute('position', new THREE.BufferAttribute(livePosArray, 3));
      wearGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
      wearGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));

      wearGeo.userData = {
        basePosArray,
        expandDirArray
      };

      return wearGeo;
    }

export interface ReferenceEdgeGeometry {
  surface: THREE.BufferGeometry;
  lines: THREE.EdgesGeometry;
  wear: THREE.BufferGeometry | null;
}

/** The original createCardboardPart preparation, with no scene objects.
 * includeWear defaults true for canonical callers. Product wear0 skips the
 * physical wear generator entirely, rather than allocating hidden triangles. */
export function createReferenceEdgeGeometry(geometry: THREE.BufferGeometry, edgeAngle = 22, includeWear = true): ReferenceEdgeGeometry {
  const surface = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  surface.computeVertexNormals();
  const lines = new THREE.EdgesGeometry(surface, edgeAngle);
  return {surface, lines, wear: includeWear ? createPhysicalEdgeWearGeometry(surface, lines) : null};
}

export interface ReferenceEdgeVisuals {
  lineOpacity: number;
  wearOpacity: number;
  contourSpan: number;
  showLines: boolean;
  showWear: boolean;
}

/** Original syncCardboardEdgeVisuals formulas; inputs are 0..1 preferences. */
export function referenceEdgeVisuals(edgeOpacity = .65, wearFactor = .75, fillImpFactor = .60): ReferenceEdgeVisuals {
  const contourSpan = wearFactor * (0.2 + fillImpFactor * 1.15);
  const lineOpacity = edgeOpacity * (1.0 - Math.min(1, contourSpan) * 0.45);
  const wearOpacity = Math.min(1.0, edgeOpacity * 1.25 * Math.min(1.0, fillImpFactor * 1.15));
  return {
    lineOpacity, wearOpacity, contourSpan,
    showLines: edgeOpacity * 100 > 1 && lineOpacity > .02,
    showWear: edgeOpacity * 100 > 1 && wearFactor * 100 > 1 && fillImpFactor * 100 > 1,
  };
}

/** Apply to pre-transform geometry; batches retain transformed base and vector
 * streams, or multiply expansion in their GPU vertex stage. */
export function applyReferenceWearScale(geometry: THREE.BufferGeometry, contourSpan: number): void {
  const {basePosArray, expandDirArray} = geometry.userData as {basePosArray: Float32Array; expandDirArray: Float32Array};
  const position = geometry.getAttribute('position');
  const arr = position.array;
  for (let i = 0; i < arr.length; i++) {
    arr[i] = basePosArray[i] + expandDirArray[i] * contourSpan;
  }
  position.needsUpdate = true;
}

/** Authored line color; one shared LineBasicMaterial can serve every part. */
export function createReferenceKraftLineMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({color: 0xd7b384, transparent: true, opacity: 0.42});
}
