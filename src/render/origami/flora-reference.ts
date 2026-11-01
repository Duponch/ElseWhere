import * as THREE from 'three/webgpu';
import {registerReferencePaintProfile} from './reference-profiles';
import type {ReferencePaintConfig} from './reference-painter';

/** Literal six flora constructors, dimensions, cutouts, UVs and transforms from
 * the supplied Atelier. The temporary Groups are compiled into resident batches;
 * these MeshBasicMaterial objects are metadata carriers and never rendered.
 */
export type OrigamiFloraReference = 'poplar' | 'oak' | 'pine' | 'cactus' | 'acacia' | 'bush';
export const ORIGAMI_FLORA_REFERENCES: readonly OrigamiFloraReference[] = ['poplar','oak','pine','cactus','acacia','bush'];
type FloraMaterial = THREE.MeshBasicMaterial;
type FloraMesh = THREE.Mesh<THREE.BufferGeometry, FloraMaterial>;
const materials = new Map<string, FloraMaterial>();
function registerGouacheMat(key: string, config: ReferencePaintConfig): FloraMaterial {
  const prior = materials.get(key);
  if (prior) return prior;
  const material = new THREE.MeshBasicMaterial({color: config.baseColor});
  material.userData.referencePaintKey = key;
  material.userData.referencePaintConfig = config;
  material.userData.referencePaintIndex = registerReferencePaintProfile(key, config);
  materials.set(key, material);
  return material;
}
interface PartOptions {pos?: number[]; rot?: number[]; scale?: number[]; castShadow?: boolean; receiveShadow?: boolean; edgeAngle?: number}
function createCardboardPart(geometry: THREE.BufferGeometry, material: FloraMaterial, options: PartOptions = {}): FloraMesh {
  const {pos = [0,0,0], rot = [0,0,0], scale = [1,1,1], castShadow = true, receiveShadow = true, edgeAngle = 22} = options;
  const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0],pos[1],pos[2]);
  mesh.rotation.set(rot[0],rot[1],rot[2]);
  mesh.scale.set(scale[0],scale[1],scale[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.userData.referenceEdgeAngle = edgeAngle;
  return mesh;
}

    // Creates a vertical prism with flat horizontal top and bottom faces (Y axis)
    function createVerticalPrismGeometry(topX: number, topZ: number, bottomX: number, bottomZ: number, heightY: number, shearX = 0, shearZ = 0) {
      const geo = new THREE.BoxGeometry(1, heightY, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        if (vy > 0) {
          pos.setX(i, vx * topX + shearX);
          pos.setZ(i, vz * topZ + shearZ);
        } else {
          pos.setX(i, vx * bottomX);
          pos.setZ(i, vz * bottomZ);
        }
      }
      const nonIndexed = geo.toNonIndexed();
      nonIndexed.computeVertexNormals();
      return nonIndexed;
    }

    // Extrudes a 2D cardboard silhouette cutout plate
    function createCardboardCutoutPlate(points2D: number[][], thickness = 0.045, centerGeo = true) {
      const shape = new THREE.Shape();
      points2D.forEach((pt, idx) => {
        if (idx === 0) shape.moveTo(pt[0], pt[1]);
        else shape.lineTo(pt[0], pt[1]);
      });
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false
      });
      if (centerGeo) {
        geo.center();
      } else {
        geo.translate(-0.04, 0, -thickness * 0.5);
      }
      const nonIndexed = geo.toNonIndexed();
      nonIndexed.computeVertexNormals();
      return nonIndexed;
    }

    const matPinkEarGouache = registerGouacheMat('matPinkEarGouache', {
      baseColor: '#d99b8e',
      secondaryColor: '#c48375',
      strokeStyle: 'directional',
      strokeCount: 140
    });

    const matTrunkBark = registerGouacheMat('matTrunkBark', {
      baseColor: '#5e432d',
      secondaryColor: '#75553a',
      strokeStyle: 'directional',
      strokeCount: 300
    });
    const matPoplarGreen = registerGouacheMat('matPoplarGreen', {
      baseColor: '#6d8c3a',
      secondaryColor: '#88ab49',
      strokeStyle: 'wavy',
      strokeCount: 360
    });
    const matOakGreen = registerGouacheMat('matOakGreen', {
      baseColor: '#486b2f',
      secondaryColor: '#5f873f',
      strokeStyle: 'wavy',
      strokeCount: 380
    });
    const matPineGreen = registerGouacheMat('matPineGreen', {
      baseColor: '#294f3a',
      secondaryColor: '#39694e',
      strokeStyle: 'coarse',
      strokeCount: 360
    });
    const matCactusGreen = registerGouacheMat('matCactusGreen', {
      baseColor: '#4e7846',
      secondaryColor: '#66945b',
      strokeStyle: 'directional',
      strokeCount: 340
    });
    const matAcaciaGreen = registerGouacheMat('matAcaciaGreen', {
      baseColor: '#788a36',
      secondaryColor: '#94a846',
      strokeStyle: 'wavy',
      strokeCount: 360
    });
    const matBushGreen = registerGouacheMat('matBushGreen', {
      baseColor: '#3f632b',
      secondaryColor: '#55803c',
      strokeStyle: 'wavy',
      strokeCount: 340
    });
    const matBerryRed = registerGouacheMat('matBerryRed', {
      baseColor: '#c43b2d',
      secondaryColor: '#e05344',
      strokeStyle: 'directional',
      strokeCount: 160
    });

    // 1. PEUPLIER (POPLAR TREE)
    function buildPoplarTree() {
      const group = new THREE.Group();
      const swayPivot = new THREE.Group();
      group.add(swayPivot);

      const trunk = createCardboardPart(
        createVerticalPrismGeometry(0.18, 0.18, 0.30, 0.30, 1.35),
        matTrunkBark,
        { pos: [0, 0.65, 0] }
      );
      swayPivot.add(trunk);

      const tiers = [
        { y: 1.35, wT: 0.72, wB: 0.52, h: 0.78 },
        { y: 2.02, wT: 0.66, wB: 0.78, h: 0.82 },
        { y: 2.72, wT: 0.46, wB: 0.68, h: 0.78 },
        { y: 3.32, wT: 0.12, wB: 0.48, h: 0.64 }
      ];
      tiers.forEach((t, idx) => {
        const block = createCardboardPart(
          createVerticalPrismGeometry(t.wT, t.wT, t.wB, t.wB, t.h),
          matPoplarGreen,
          { pos: [0, t.y, 0], rot: [0, idx * 0.45, 0] }
        );
        swayPivot.add(block);
      });

      const finPts = [
        [0.0, -1.1],
        [0.46, -0.65],
        [0.34, -0.15],
        [0.48, 0.35],
        [0.28, 0.85],
        [0.0, 1.25]
      ];
      const finGeo = createCardboardCutoutPlate(finPts, 0.055);
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + 0.35;
        const fin = createCardboardPart(finGeo, matPoplarGreen, {
          pos: [Math.cos(angle) * 0.22, 2.25, Math.sin(angle) * 0.22],
          rot: [0, -angle, 0]
        });
        swayPivot.add(fin);
      }

      group.userData = { swayPivot, primaryMaterial: matPoplarGreen };
      return group;
    }

    // 2. CHÊNE (OAK TREE)
    function buildOakTree() {
      const group = new THREE.Group();
      const swayPivot = new THREE.Group();
      group.add(swayPivot);

      const trunk = createCardboardPart(
        createVerticalPrismGeometry(0.38, 0.38, 0.56, 0.56, 1.45, 0.04, -0.02),
        matTrunkBark,
        { pos: [0, 0.70, 0] }
      );
      swayPivot.add(trunk);

      const branchConfigs = [
        { pos: [-0.32, 1.42, 0.12], rot: [0.2, 0, 0.62] },
        { pos: [0.34, 1.38, -0.14], rot: [-0.25, 0, -0.58] },
        { pos: [0.04, 1.46, 0.28], rot: [0.55, 0, -0.12] }
      ];
      branchConfigs.forEach((b) => {
        const br = createCardboardPart(
          createVerticalPrismGeometry(0.16, 0.16, 0.24, 0.24, 0.72),
          matTrunkBark,
          { pos: b.pos, rot: b.rot }
        );
        swayPivot.add(br);
      });

      const crownClusters = [
        { pos: [0, 2.18, 0], s: [1.35, 0.92, 1.28], rot: [0.1, 0.3, 0] },
        { pos: [-0.68, 1.88, 0.24], s: [0.92, 0.72, 0.88], rot: [0, 0.8, 0.15] },
        { pos: [0.66, 1.84, -0.22], s: [0.95, 0.74, 0.90], rot: [-0.12, 0.5, -0.1] },
        { pos: [0.12, 1.92, 0.62], s: [0.85, 0.68, 0.82], rot: [0.2, -0.4, 0] },
        { pos: [-0.18, 1.95, -0.58], s: [0.88, 0.70, 0.84], rot: [-0.15, 0.2, 0.1] }
      ];
      crownClusters.forEach((c) => {
        const puffGeo = createVerticalPrismGeometry(0.76, 0.76, 0.86, 0.86, 0.88, 0.04, 0.04);
        const puff = createCardboardPart(puffGeo, matOakGreen, {
          pos: c.pos,
          scale: c.s,
          rot: c.rot
        });
        swayPivot.add(puff);
      });

      group.userData = { swayPivot, primaryMaterial: matOakGreen };
      return group;
    }

    // 3. SAPIN (PINE / FIR TREE)
    function buildPineTree() {
      const group = new THREE.Group();
      const swayPivot = new THREE.Group();
      group.add(swayPivot);

      const trunk = createCardboardPart(
        createVerticalPrismGeometry(0.24, 0.24, 0.36, 0.36, 1.15),
        matTrunkBark,
        { pos: [0, 0.55, 0] }
      );
      swayPivot.add(trunk);

      const pineTiers = [
        { y: 1.22, rBottom: 1.12, rTop: 0.38, h: 0.92, rotY: 0.0 },
        { y: 1.86, rBottom: 0.92, rTop: 0.30, h: 0.86, rotY: 0.42 },
        { y: 2.46, rBottom: 0.68, rTop: 0.20, h: 0.78, rotY: 0.84 },
        { y: 3.04, rBottom: 0.44, rTop: 0.04, h: 0.72, rotY: 1.26 }
      ];
      pineTiers.forEach((pt) => {
        const coneGeo = new THREE.CylinderGeometry(pt.rTop, pt.rBottom, pt.h, 6);
        const cone = createCardboardPart(coneGeo, matPineGreen, {
          pos: [0, pt.y, 0],
          rot: [0, pt.rotY, 0],
          edgeAngle: 15
        });
        swayPivot.add(cone);
      });

      group.userData = { swayPivot, primaryMaterial: matPineGreen };
      return group;
    }

    // 4. CACTUS (SAGUARO CACTUS)
    function buildCactus() {
      const group = new THREE.Group();
      const swayPivot = new THREE.Group();
      group.add(swayPivot);

      const stemGeo = new THREE.CylinderGeometry(0.24, 0.28, 2.25, 6);
      const stem = createCardboardPart(stemGeo, matCactusGreen, {
        pos: [0, 1.10, 0],
        edgeAngle: 14
      });
      swayPivot.add(stem);

      const leftH = createCardboardPart(new THREE.BoxGeometry(0.46, 0.26, 0.26), matCactusGreen, {
        pos: [-0.32, 0.95, 0]
      });
      const leftV = createCardboardPart(
        createVerticalPrismGeometry(0.24, 0.24, 0.26, 0.26, 0.76),
        matCactusGreen,
        { pos: [-0.48, 1.38, 0] }
      );

      const rightH = createCardboardPart(new THREE.BoxGeometry(0.48, 0.26, 0.26), matCactusGreen, {
        pos: [0.34, 1.28, 0]
      });
      const rightV = createCardboardPart(
        createVerticalPrismGeometry(0.24, 0.24, 0.26, 0.26, 0.84),
        matCactusGreen,
        { pos: [0.50, 1.74, 0] }
      );
      swayPivot.add(leftH, leftV, rightH, rightV);

      const flower = createCardboardPart(
        createVerticalPrismGeometry(0.22, 0.22, 0.10, 0.10, 0.16),
        matPinkEarGouache,
        { pos: [0, 2.28, 0], rot: [0, 0.4, 0] }
      );
      swayPivot.add(flower);

      group.userData = { swayPivot, primaryMaterial: matCactusGreen };
      return group;
    }

    // 5. ACACIA (SAVANNA UMBRELLA TREE)
    function buildAcaciaTree() {
      const group = new THREE.Group();
      const swayPivot = new THREE.Group();
      group.add(swayPivot);

      const baseTrunk = createCardboardPart(
        createVerticalPrismGeometry(0.26, 0.26, 0.38, 0.38, 1.25, 0.14, 0.04),
        matTrunkBark,
        { pos: [0, 0.60, 0] }
      );
      const branchMain = createCardboardPart(
        createVerticalPrismGeometry(0.18, 0.18, 0.24, 0.24, 1.20, 0.42, 0.08),
        matTrunkBark,
        { pos: [0.22, 1.72, 0.04] }
      );
      const branchSide = createCardboardPart(
        createVerticalPrismGeometry(0.15, 0.15, 0.20, 0.20, 0.95, -0.58, -0.14),
        matTrunkBark,
        { pos: [-0.14, 1.52, -0.06] }
      );
      const branchHigh = createCardboardPart(
        createVerticalPrismGeometry(0.14, 0.14, 0.18, 0.18, 0.75, -0.28, 0.38),
        matTrunkBark,
        { pos: [0.12, 1.88, 0.18] }
      );
      swayPivot.add(baseTrunk, branchMain, branchSide, branchHigh);

      const canopy1 = createCardboardPart(
        createVerticalPrismGeometry(1.65, 1.45, 1.95, 1.72, 0.28),
        matAcaciaGreen,
        { pos: [0.58, 2.34, 0.10], rot: [0, 0.25, 0] }
      );
      const canopy2 = createCardboardPart(
        createVerticalPrismGeometry(1.25, 1.15, 1.48, 1.35, 0.24),
        matAcaciaGreen,
        { pos: [-0.68, 1.98, -0.18], rot: [0, -0.4, 0] }
      );
      const canopy3 = createCardboardPart(
        createVerticalPrismGeometry(1.10, 1.05, 1.32, 1.22, 0.22),
        matAcaciaGreen,
        { pos: [-0.12, 2.58, 0.52], rot: [0, 0.65, 0] }
      );
      swayPivot.add(canopy1, canopy2, canopy3);

      group.userData = { swayPivot, primaryMaterial: matAcaciaGreen };
      return group;
    }

    // 6. BUISSON (CARD-CUT BERRY BUSH)
    function buildBush() {
      const group = new THREE.Group();
      const swayPivot = new THREE.Group();
      group.add(swayPivot);

      const mounds = [
        { pos: [0, 0.36, 0], wT: 0.62, wB: 0.78, h: 0.68, rotY: 0.2 },
        { pos: [-0.38, 0.28, 0.18], wT: 0.46, wB: 0.58, h: 0.52, rotY: 0.75 },
        { pos: [0.36, 0.26, -0.14], wT: 0.44, wB: 0.56, h: 0.48, rotY: -0.55 },
        { pos: [0.06, 0.24, 0.36], wT: 0.40, wB: 0.50, h: 0.44, rotY: 1.1 }
      ];
      mounds.forEach((m) => {
        const mound = createCardboardPart(
          createVerticalPrismGeometry(m.wT, m.wT, m.wB, m.wB, m.h),
          matBushGreen,
          { pos: m.pos, rot: [0, m.rotY, 0] }
        );
        swayPivot.add(mound);
      });

      const leafPts = [
        [-0.45, 0],
        [-0.32, 0.32],
        [-0.12, 0.08],
        [0.0, 0.42],
        [0.14, 0.10],
        [0.36, 0.34],
        [0.45, 0]
      ];
      const leafCutout = createCardboardCutoutPlate(leafPts, 0.045);
      const crest1 = createCardboardPart(leafCutout, matBushGreen, {
        pos: [0, 0.68, 0],
        rot: [0, 0.4, 0]
      });
      const crest2 = createCardboardPart(leafCutout, matBushGreen, {
        pos: [0, 0.68, 0],
        rot: [0, 1.97, 0]
      });
      swayPivot.add(crest1, crest2);

      const berryCoords = [
        [-0.22, 0.52, 0.32],
        [0.24, 0.48, 0.26],
        [0.05, 0.64, -0.28],
        [-0.44, 0.38, -0.12],
        [0.42, 0.36, -0.22],
        [0.16, 0.34, 0.52]
      ];
      berryCoords.forEach((bc) => {
        const berry = createCardboardPart(new THREE.BoxGeometry(0.095, 0.095, 0.095), matBerryRed, {
          pos: bc,
          rot: [0.3, 0.5, 0.2]
        });
        swayPivot.add(berry);
      });

      group.userData = { swayPivot, primaryMaterial: matBushGreen };
      return group;
    }


const builders: Record<OrigamiFloraReference, () => THREE.Group> = {
  poplar: buildPoplarTree, oak: buildOakTree, pine: buildPineTree,
  cactus: buildCactus, acacia: buildAcaciaTree, bush: buildBush,
};
export function buildOrigamiFloraReference(name: OrigamiFloraReference): THREE.Group {
  return builders[name]();
}

export interface OrigamiFloraReferencePart {
  id: string;
  /** World-baked source part, preserving the original source UV buffer values. */
  geometry: THREE.BufferGeometry;
  /** Before the source part transform, for exact physical wear widths/miters. */
  sourceGeometry: THREE.BufferGeometry;
  partMatrix: THREE.Matrix4;
  profileId: number;
  profileKey: string;
  baseColor: number;
  canopy: boolean;
  fruit: boolean;
  edgeAngle: number;
}

/** Assets are compiled once per resource geometry vocabulary, not per entity.
 * Canopy/fruit tags route to the existing visibility identities; they create no
 * crop, harvest state or simulation definition. Acacia remains an unbound asset.
 */
export function compileOrigamiFloraReference(name: OrigamiFloraReference): OrigamiFloraReferencePart[] {
  const root = buildOrigamiFloraReference(name);
  root.updateMatrixWorld(true);
  const parts: OrigamiFloraReferencePart[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object as FloraMesh;
    const sourceGeometry = mesh.geometry.clone();
    const partMatrix = mesh.matrixWorld.clone();
    const geometry = sourceGeometry.clone().applyMatrix4(partMatrix);
    const profileKey = mesh.material.userData.referencePaintKey as string;
    const fruit = profileKey === 'matBerryRed';
    parts.push({
      id: name + ':' + parts.length, geometry, sourceGeometry, partMatrix,
      profileId: mesh.material.userData.referencePaintIndex as number,
      profileKey, baseColor: mesh.material.color.getHex(),
      canopy: !fruit && profileKey !== 'matTrunkBark' && profileKey !== 'matCactusGreen',
      fruit, edgeAngle: mesh.userData.referenceEdgeAngle as number,
    });
    mesh.geometry.dispose();
  });
  root.clear();
  return parts;
}

export function disposeOrigamiFloraReferenceParts(parts: readonly OrigamiFloraReferencePart[]): void {
  for (const part of parts) {part.geometry.dispose(); part.sourceGeometry.dispose();}
}
