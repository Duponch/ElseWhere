import * as THREE from 'three/webgpu';

/** Geometry recipes transcribed from the user supplied gouache/cardboard HTML
 * (atelier...(6).html, eight animal builders). The transient groups are consumed
 * only at batch compilation. Reference edge lines/material draw calls and its
 * clocks/scene/UI are deliberately not retained. */
export type OrigamiAnimalReference='fox'|'camel'|'hare'|'dog'|'buffalo'|'gazelle'|'deer'|'elephant';
export interface ReferencePigment {baseColor:string;secondaryColor?:string;accentColor?:string;strokeStyle?:string;strokeCount?:number;gradientTip?:{color:string};flankStripe?:{bellyColor:string;stripeColor:string}}
interface LegDimensions {upperW?:number;upperD?:number;upperH?:number;sockW?:number;sockH?:number;hoofH?:number}
const pigmentMaterials=new Map<string,THREE.MeshBasicMaterial>();
function registerGouacheMat(config:ReferencePigment):THREE.MeshBasicMaterial {
 const key=JSON.stringify(config),cached=pigmentMaterials.get(key);if(cached)return cached;
 const material=new THREE.MeshBasicMaterial({color:config.baseColor});material.userData.pigment=config;pigmentMaterials.set(key,material);return material;
}
function createCardboardPart(geometry:THREE.BufferGeometry,material:THREE.MeshBasicMaterial,options:{pos?:number[];rot?:number[];scale?:number[];castShadow?:boolean;receiveShadow?:boolean;edgeAngle?:number}={}):THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial> {
 const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.computeVertexNormals();
 const mesh=new THREE.Mesh(g,material),p=options.pos??[0,0,0],r=options.rot??[0,0,0],s=options.scale??[1,1,1];
 mesh.position.set(p[0],p[1],p[2]);mesh.rotation.set(r[0],r[1],r[2]);mesh.scale.set(s[0],s[1],s[2]);return mesh;
}
// Creates a tapered horizontal box (along X axis)
function createTaperedBoxGeometry(lengthX:number, heightY:number, depthZ:number, frontScaleY = 0.5, frontScaleZ = 0.5, frontDropY = 0) {
  const geo = new THREE.BoxGeometry(lengthX, heightY, depthZ);
  const pos = geo.attributes.position;
  const halfX = lengthX * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    if (vx > halfX * 0.2) {
      pos.setY(i, vy * frontScaleY + frontDropY);
      pos.setZ(i, vz * frontScaleZ);
    }
  }
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

// Creates a vertical prism with flat horizontal top and bottom faces (Y axis)
function createVerticalPrismGeometry(topX:number, topZ:number, bottomX:number, bottomZ:number, heightY:number, shearX = 0, shearZ = 0) {
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
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

// Extrudes a 2D cardboard silhouette cutout plate
function createCardboardCutoutPlate(points2D:readonly number[][], thickness = 0.045, centerGeo = true) {
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
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  nonIndexed.computeVertexNormals();
  nonIndexed.userData.paperCutout = true;
  return nonIndexed;
}

// Shared Materials (Eyes, hooves, pink inner ears)
const matCharcoalGouache = registerGouacheMat({
  baseColor: '#1a1917',
  secondaryColor: '#2c2926',
  strokeStyle: 'coarse',
  strokeCount: 180
});

const matCreamWhiteGouache = registerGouacheMat({
  baseColor: '#e8e3d8',
  secondaryColor: '#d5cebf',
  strokeStyle: 'directional',
  strokeCount: 240
});

const matPinkEarGouache = registerGouacheMat({
  baseColor: '#d99b8e',
  secondaryColor: '#c48375',
  strokeStyle: 'directional',
  strokeCount: 140
});

// Helper for 4-legged animal articulated cardboard legs
function createArticulatedLeg(upperMat:THREE.MeshBasicMaterial, sockMat:THREE.MeshBasicMaterial, hoofMat:THREE.MeshBasicMaterial, dims:LegDimensions = {}) {
  const {
    upperW = 0.22,
    upperD = 0.24,
    upperH = 0.42,
    sockW = 0.17,
    sockH = 0.28,
    hoofH = 0.10
  } = dims;

  const legGroup = new THREE.Group();

  const upperGeo = createVerticalPrismGeometry(
    upperW,
    upperD,
    sockW * 1.08,
    sockW * 1.12,
    upperH + 0.05
  );
  const upperMesh = createCardboardPart(upperGeo, upperMat, {
    pos: [0, -upperH * 0.5 + 0.02, 0]
  });
  upperMesh.name = 'upperMesh';
  legGroup.add(upperMesh);

  const sockGeo = createVerticalPrismGeometry(
    sockW * 1.02,
    sockW * 1.02,
    sockW * 0.92,
    sockW * 0.92,
    sockH + 0.03
  );
  const sockMesh = createCardboardPart(sockGeo, sockMat, {
    pos: [0, -upperH - sockH * 0.5 + 0.01, 0]
  });
  sockMesh.name = 'sockMesh';
  legGroup.add(sockMesh);

  const hoofGeo = new THREE.BoxGeometry(sockW * 1.12, hoofH, sockW * 1.06);
  const hoofMesh = createCardboardPart(hoofGeo, hoofMat, {
    pos: [0.015, -upperH - sockH - hoofH * 0.5 + 0.01, 0]
  });
  hoofMesh.name = 'hoofMesh';
  legGroup.add(hoofMesh);

  return legGroup;
}

// ============================================================================
// 3. THE 8 LOW-POLY GOUACHE & CARDBOARD ANIMAL BUILDERS
// ============================================================================

// 1. LE RENARD (FOX)
function buildFox() {
  const group = new THREE.Group();

  const matFoxBody = registerGouacheMat({
    baseColor: '#b35b28',
    secondaryColor: '#9a491c',
    accentColor: '#cc6f35',
    strokeStyle: 'wavy',
    strokeCount: 420
  });

  const matFoxSnout = registerGouacheMat({
    baseColor: '#b35b28',
    secondaryColor: '#9a491c',
    strokeStyle: 'directional',
    strokeCount: 300,
    gradientTip: { color: '#e6e2d8' }
  });

  const bodyY = 0.68;

  const torsoGeo = createTaperedBoxGeometry(1.32, 0.48, 0.50, 0.92, 0.90, 0.02);
  const torso = createCardboardPart(torsoGeo, matFoxBody, { pos: [0, bodyY, 0] });
  torso.name = 'torso';
  group.add(torso);

  const furSpikePts = [
    [-0.55, 0],
    [-0.45, 0.11],
    [-0.35, 0.01],
    [-0.22, 0.13],
    [-0.10, 0.01],
    [0.04, 0.12],
    [0.16, 0.01],
    [0.30, 0.11],
    [0.42, 0.01],
    [0.54, 0.09],
    [0.60, 0]
  ];
  const crestGeo = createCardboardCutoutPlate(furSpikePts, 0.035);
  const crestLeft = createCardboardPart(crestGeo, matFoxBody, {
    pos: [0.02, bodyY + 0.25, 0.07],
    rot: [0.22, 0, 0]
  });
  crestLeft.name = 'crestLeft';
  const crestRight = createCardboardPart(crestGeo, matFoxBody, {
    pos: [0.02, bodyY + 0.25, -0.07],
    rot: [-0.22, 0, 0]
  });
  crestRight.name = 'crestRight';
  group.add(crestLeft, crestRight);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.66, bodyY + 0.14, 0);
  group.add(headGroup);

  const cranium = createCardboardPart(new THREE.BoxGeometry(0.42, 0.38, 0.44), matFoxBody, {
    pos: [0.08, 0, 0]
  });
  cranium.name = 'cranium';
  headGroup.add(cranium);

  const snoutGeo = createTaperedBoxGeometry(0.56, 0.30, 0.34, 0.30, 0.26, -0.04);
  const snout = createCardboardPart(snoutGeo, matFoxSnout, {
    pos: [0.44, -0.03, 0]
  });
  snout.name = 'snout';
  headGroup.add(snout);

  const nose = createCardboardPart(new THREE.BoxGeometry(0.09, 0.09, 0.09), matCharcoalGouache, {
    pos: [0.73, -0.05, 0]
  });
  nose.name = 'nose';
  headGroup.add(nose);

  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.05, 0.05, 0.03), matCharcoalGouache, {
      pos: [0.30, 0.04, side * 0.20]
    });
  eye.name = 'eye';
    headGroup.add(eye);

    const earGeo = createTaperedBoxGeometry(0.28, 0.16, 0.06, 0.18, 0.5, 0);
    const earOuter = createCardboardPart(earGeo, matCharcoalGouache, {
      pos: [0.08, 0.28, side * 0.14],
      rot: [side * 0.18, 0, Math.PI * 0.46]
    });
  earOuter.name = 'earOuter';
    const earInner = createCardboardPart(new THREE.BoxGeometry(0.04, 0.16, 0.07), matPinkEarGouache, {
      pos: [0.11, 0.26, side * 0.14],
      rot: [side * 0.18, 0, -0.1]
    });
  earInner.name = 'earInner';
    headGroup.add(earOuter, earInner);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.62, bodyY + 0.02, 0);
  group.add(tailGroup);

  const tailMainGeo = createTaperedBoxGeometry(0.76, 0.28, 0.28, 0.85, 0.85, 0);
  const tailMain = createCardboardPart(tailMainGeo, matFoxBody, {
    pos: [-0.36, -0.05, 0],
    rot: [0, 0, 0.14]
  });
  tailMain.name = 'tailMain';
  const tailTip = createCardboardPart(new THREE.BoxGeometry(0.26, 0.23, 0.23), matCreamWhiteGouache, {
    pos: [-0.82, -0.11, 0],
    rot: [0, 0, 0.14]
  });
  tailTip.name = 'tailTip';
  tailGroup.add(tailMain, tailTip);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.44, 0.48, 0.15],
    [0.44, 0.48, -0.15],
    [-0.44, 0.48, 0.15],
    [-0.44, 0.48, -0.15]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matFoxBody, matCharcoalGouache, matCharcoalGouache, {
      upperW: 0.19,
      upperD: 0.21,
      upperH: 0.24,
      sockW: 0.14,
      sockH: 0.17,
      hoofH: 0.07
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, tailGroup, legs, primaryMaterial: matFoxBody };
  return group;
}

// 2. LE DROMADAIRE (CAMEL)
function buildCamel() {
  const group = new THREE.Group();

  const matCamelTan = registerGouacheMat({
    baseColor: '#8d7960',
    secondaryColor: '#78654e',
    accentColor: '#a38d72',
    strokeStyle: 'directional',
    strokeCount: 380
  });

  const matCamelMuzzle = registerGouacheMat({
    baseColor: '#8a7d7b',
    secondaryColor: '#736765',
    strokeStyle: 'directional',
    strokeCount: 200
  });

  const bodyY = 1.24;

  const torsoGeo = createTaperedBoxGeometry(1.42, 0.62, 0.68, 0.94, 0.92, 0);
  const torso = createCardboardPart(torsoGeo, matCamelTan, { pos: [0, bodyY, 0] });
  torso.name = 'torso';
  group.add(torso);

  const humpGeo = createTaperedBoxGeometry(0.62, 0.88, 0.62, 0.22, 0.45, 0);
  const hump = createCardboardPart(humpGeo, matCamelTan, {
    pos: [-0.04, bodyY + 0.48, 0],
    rot: [0, 0, Math.PI * 0.5]
  });
  hump.name = 'hump';
  group.add(hump);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.64, bodyY + 0.02, 0);
  group.add(headGroup);

  const neckGeo = createVerticalPrismGeometry(0.28, 0.28, 0.34, 0.32, 0.78, 0.18, 0);
  const neck = createCardboardPart(neckGeo, matCamelTan, {
    pos: [0.12, 0.28, 0]
  });
  neck.name = 'neck';
  headGroup.add(neck);

  const skull = createCardboardPart(new THREE.BoxGeometry(0.36, 0.26, 0.30), matCamelTan, {
    pos: [0.34, 0.68, 0]
  });
  skull.name = 'skull';
  const muzzle = createCardboardPart(
    createTaperedBoxGeometry(0.30, 0.22, 0.25, 0.72, 0.75, -0.02),
    matCamelMuzzle,
    { pos: [0.60, 0.65, 0] }
  );
  muzzle.name = 'muzzle';
  headGroup.add(skull, muzzle);

  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.045, 0.045, 0.03), matCharcoalGouache, {
      pos: [0.42, 0.69, side * 0.15]
    });
  eye.name = 'eye';
    const ear = createCardboardPart(new THREE.BoxGeometry(0.08, 0.12, 0.06), matCamelTan, {
      pos: [0.22, 0.82, side * 0.16],
      rot: [side * 0.35, 0, -0.2]
    });
  ear.name = 'ear';
    headGroup.add(eye, ear);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.72, bodyY + 0.10, 0);
  const tailBar = createCardboardPart(new THREE.BoxGeometry(0.10, 0.46, 0.10), matCharcoalGouache, {
    pos: [-0.04, -0.20, 0],
    rot: [0, 0, -0.15]
  });
  tailBar.name = 'tailBar';
  tailGroup.add(tailBar);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.46, 0.96, 0.20],
    [0.46, 0.96, -0.20],
    [-0.46, 0.96, 0.20],
    [-0.46, 0.96, -0.20]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matCamelTan, matCamelTan, matCharcoalGouache, {
      upperW: 0.18,
      upperD: 0.18,
      upperH: 0.56,
      sockW: 0.14,
      sockH: 0.30,
      hoofH: 0.10
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, tailGroup, legs, primaryMaterial: matCamelTan };
  return group;
}

// 3. LE LIÈVRE (HARE)
function buildHare() {
  const group = new THREE.Group();

  const matHareSand = registerGouacheMat({
    baseColor: '#b5a789',
    secondaryColor: '#9e9073',
    accentColor: '#cabd9f',
    strokeStyle: 'directional',
    strokeCount: 320
  });

  const bodyY = 0.42;

  const rump = createCardboardPart(
    createTaperedBoxGeometry(0.68, 0.44, 0.44, 0.82, 0.85, 0.04),
    matHareSand,
    { pos: [-0.05, bodyY, 0], rot: [0, 0, -0.14] }
  );
  rump.name = 'rump';
  group.add(rump);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.28, bodyY + 0.12, 0);
  group.add(headGroup);

  const headMesh = createCardboardPart(
    createTaperedBoxGeometry(0.42, 0.32, 0.32, 0.58, 0.62, -0.04),
    matHareSand,
    { pos: [0.12, 0, 0], rot: [0, 0, -0.18] }
  );
  headMesh.name = 'headMesh';
  headGroup.add(headMesh);

  const ears:THREE.Object3D[] = [];
  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.045, 0.045, 0.03), matCharcoalGouache, {
      pos: [0.16, 0.04, side * 0.15]
    });
  eye.name = 'eye';
    headGroup.add(eye);

    const earPivot = new THREE.Group();
    earPivot.position.set(-0.02, 0.14, side * 0.09);
    earPivot.rotation.set(side * 0.16, 0, 0.32);

    const earOuter = createCardboardPart(
      createTaperedBoxGeometry(0.48, 0.12, 0.05, 0.45, 0.6, 0),
      matHareSand,
      { pos: [0, 0.22, 0], rot: [0, 0, Math.PI * 0.5] }
    );
  earOuter.name = 'earOuter';
    const earInner = createCardboardPart(new THREE.BoxGeometry(0.03, 0.34, 0.06), matPinkEarGouache, {
      pos: [0.03, 0.20, 0]
    });
  earInner.name = 'earInner';
    earPivot.add(earOuter, earInner);
    headGroup.add(earPivot);
    ears.push(earPivot);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.42, bodyY + 0.06, 0);
  const puffTail = createCardboardPart(new THREE.BoxGeometry(0.18, 0.18, 0.18), matCreamWhiteGouache, {
    pos: [-0.06, 0, 0]
  });
  puffTail.name = 'puffTail';
  tailGroup.add(puffTail);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  [-1, 1].forEach((side) => {
    const frontLeg = createCardboardPart(new THREE.BoxGeometry(0.12, 0.36, 0.12), matHareSand, {
      pos: [0.22, 0.18, side * 0.13]
    });
  frontLeg.name = 'frontLeg';
    group.add(frontLeg);
    legs.push(frontLeg);

    const haunch = createCardboardPart(new THREE.BoxGeometry(0.32, 0.24, 0.14), matHareSand, {
      pos: [-0.16, 0.15, side * 0.19]
    });
  haunch.name = 'haunch';
    const foot = createCardboardPart(new THREE.BoxGeometry(0.34, 0.09, 0.13), matHareSand, {
      pos: [-0.12, 0.045, side * 0.19]
    });
  foot.name = 'foot';
    group.add(haunch, foot);
  });

  group.userData = { headGroup, tailGroup, ears, legs, primaryMaterial: matHareSand };
  return group;
}

// 4. LE CHIEN (SHEPHERD DOG)
function buildDog() {
  const group = new THREE.Group();

  const matDogOchre = registerGouacheMat({
    baseColor: '#c98844',
    secondaryColor: '#b07130',
    accentColor: '#debfd0',
    strokeStyle: 'wavy',
    strokeCount: 380
  });

  const matDogSaddle = registerGouacheMat({
    baseColor: '#3b2d23',
    secondaryColor: '#291f18',
    strokeStyle: 'wavy',
    strokeCount: 300
  });

  const matDogCollar = registerGouacheMat({
    baseColor: '#b8332a',
    secondaryColor: '#8f221b',
    strokeStyle: 'directional',
    strokeCount: 140
  });

  const bodyY = 0.74;

  const chest = createCardboardPart(new THREE.BoxGeometry(0.68, 0.52, 0.52), matDogOchre, {
    pos: [0.26, bodyY + 0.02, 0]
  });
  chest.name = 'chest';
  const waist = createCardboardPart(
    createTaperedBoxGeometry(0.72, 0.46, 0.46, 0.88, 0.88, 0),
    matDogSaddle,
    { pos: [-0.30, bodyY, 0] }
  );
  waist.name = 'waist';
  group.add(chest, waist);

  const collar = createCardboardPart(new THREE.BoxGeometry(0.14, 0.44, 0.46), matDogCollar, {
    pos: [0.56, bodyY + 0.12, 0],
    rot: [0, 0, -0.35]
  });
  collar.name = 'collar';
  group.add(collar);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.66, bodyY + 0.28, 0);
  group.add(headGroup);

  const skull = createCardboardPart(new THREE.BoxGeometry(0.42, 0.38, 0.42), matDogOchre, {
    pos: [0.06, 0.04, 0]
  });
  skull.name = 'skull';
  const muzzle = createCardboardPart(
    createTaperedBoxGeometry(0.36, 0.24, 0.26, 0.72, 0.75, -0.02),
    matDogSaddle,
    { pos: [0.36, -0.02, 0] }
  );
  muzzle.name = 'muzzle';
  const nose = createCardboardPart(new THREE.BoxGeometry(0.08, 0.08, 0.10), matCharcoalGouache, {
    pos: [0.54, 0.01, 0]
  });
  nose.name = 'nose';
  headGroup.add(skull, muzzle, nose);

  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.05, 0.05, 0.03), matCharcoalGouache, {
      pos: [0.24, 0.08, side * 0.20]
    });
  eye.name = 'eye';
    const earBase = createCardboardPart(new THREE.BoxGeometry(0.16, 0.14, 0.08), matDogSaddle, {
      pos: [0.02, 0.24, side * 0.18],
      rot: [side * 0.25, 0, 0.2]
    });
  earBase.name = 'earBase';
    const earFlap = createCardboardPart(new THREE.BoxGeometry(0.16, 0.22, 0.06), matDogSaddle, {
      pos: [0.06, 0.14, side * 0.25],
      rot: [side * 0.35, 0, -0.35]
    });
  earFlap.name = 'earFlap';
    headGroup.add(eye, earBase, earFlap);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.64, bodyY + 0.14, 0);
  const tailSeg1 = createCardboardPart(new THREE.BoxGeometry(0.44, 0.16, 0.16), matDogSaddle, {
    pos: [-0.18, 0.10, 0],
    rot: [0, 0, -0.52]
  });
  tailSeg1.name = 'tailSeg1';
  const tailSeg2 = createCardboardPart(new THREE.BoxGeometry(0.30, 0.13, 0.13), matCreamWhiteGouache, {
    pos: [-0.42, 0.28, 0],
    rot: [0, 0, -0.82]
  });
  tailSeg2.name = 'tailSeg2';
  tailGroup.add(tailSeg1, tailSeg2);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.42, 0.52, 0.16],
    [0.42, 0.52, -0.16],
    [-0.44, 0.52, 0.16],
    [-0.44, 0.52, -0.16]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matDogOchre, matDogOchre, matCreamWhiteGouache, {
      upperW: 0.19,
      upperD: 0.20,
      upperH: 0.28,
      sockW: 0.15,
      sockH: 0.17,
      hoofH: 0.07
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, tailGroup, legs, primaryMaterial: matDogOchre };
  return group;
}

// 5. LE BUFFLE (CAPE BUFFALO)
function buildBuffalo() {
  const group = new THREE.Group();

  const matBuffaloDark = registerGouacheMat({
    baseColor: '#362d28',
    secondaryColor: '#261f1b',
    accentColor: '#4d4039',
    strokeStyle: 'coarse',
    strokeCount: 440
  });

  const matBuffaloHorn = registerGouacheMat({
    baseColor: '#756d61',
    secondaryColor: '#575046',
    strokeStyle: 'directional',
    strokeCount: 220
  });

  const bodyY = 0.96;

  const forequarters = createCardboardPart(
    createTaperedBoxGeometry(0.95, 0.88, 0.84, 0.96, 0.96, 0.04),
    matBuffaloDark,
    { pos: [0.32, bodyY + 0.08, 0] }
  );
  forequarters.name = 'forequarters';
  const hindquarters = createCardboardPart(
    createTaperedBoxGeometry(0.96, 0.72, 0.72, 0.90, 0.90, 0),
    matBuffaloDark,
    { pos: [-0.46, bodyY - 0.02, 0] }
  );
  hindquarters.name = 'hindquarters';
  group.add(forequarters, hindquarters);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.82, bodyY + 0.02, 0);
  group.add(headGroup);

  const headBox = createCardboardPart(
    createTaperedBoxGeometry(0.58, 0.48, 0.48, 0.72, 0.78, -0.05),
    matBuffaloDark,
    { pos: [0.22, -0.06, 0], rot: [0, 0, -0.22] }
  );
  headBox.name = 'headBox';
  headGroup.add(headBox);

  const boss = createCardboardPart(new THREE.BoxGeometry(0.28, 0.18, 0.64), matBuffaloHorn, {
    pos: [0.14, 0.20, 0],
    rot: [0, 0, -0.15]
  });
  boss.name = 'boss';
  headGroup.add(boss);

  [-1, 1].forEach((side) => {
    const hornSweep = createCardboardPart(new THREE.BoxGeometry(0.22, 0.14, 0.34), matBuffaloHorn, {
      pos: [0.12, 0.10, side * 0.42],
      rot: [side * 0.45, 0, 0]
    });
  hornSweep.name = 'hornSweep';
    const hornTip = createCardboardPart(
      createTaperedBoxGeometry(0.32, 0.12, 0.12, 0.35, 0.35, 0),
      matBuffaloHorn,
      {
        pos: [0.18, 0.24, side * 0.56],
        rot: [0, -side * 0.3, Math.PI * 0.45]
      }
    );
  hornTip.name = 'hornTip';
    const eye = createCardboardPart(new THREE.BoxGeometry(0.05, 0.05, 0.03), matCharcoalGouache, {
      pos: [0.26, 0.0, side * 0.24]
    });
  eye.name = 'eye';
    const ear = createCardboardPart(new THREE.BoxGeometry(0.12, 0.10, 0.22), matBuffaloDark, {
      pos: [0.06, 0.02, side * 0.32],
      rot: [-side * 0.3, 0, 0]
    });
  ear.name = 'ear';
    headGroup.add(hornSweep, hornTip, eye, ear);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.92, bodyY + 0.05, 0);
  const tailRod = createCardboardPart(new THREE.BoxGeometry(0.10, 0.52, 0.10), matBuffaloDark, {
    pos: [-0.06, -0.22, 0],
    rot: [0, 0, -0.18]
  });
  tailRod.name = 'tailRod';
  const tailTuft = createCardboardPart(new THREE.BoxGeometry(0.16, 0.18, 0.16), matCharcoalGouache, {
    pos: [-0.10, -0.48, 0]
  });
  tailTuft.name = 'tailTuft';
  tailGroup.add(tailRod, tailTuft);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.52, 0.62, 0.26],
    [0.52, 0.62, -0.26],
    [-0.58, 0.62, 0.24],
    [-0.58, 0.62, -0.24]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matBuffaloDark, matBuffaloDark, matCharcoalGouache, {
      upperW: 0.28,
      upperD: 0.28,
      upperH: 0.34,
      sockW: 0.22,
      sockH: 0.18,
      hoofH: 0.10
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, tailGroup, legs, primaryMaterial: matBuffaloDark };
  return group;
}

// 6. LA GAZELLE (THOMSON'S GAZELLE)
function buildGazelle() {
  const group = new THREE.Group();

  const matGazelleFlank = registerGouacheMat({
    baseColor: '#c98e4b',
    secondaryColor: '#b57b3a',
    strokeStyle: 'directional',
    strokeCount: 340,
    flankStripe: {
      bellyColor: '#f0ece1',
      stripeColor: '#2b1e16'
    }
  });

  const matGazelleTan = registerGouacheMat({
    baseColor: '#c98e4b',
    secondaryColor: '#b57b3a',
    strokeStyle: 'directional',
    strokeCount: 280
  });

  const bodyY = 0.94;

  const torsoGeo = createTaperedBoxGeometry(1.06, 0.44, 0.42, 0.92, 0.90, 0.02);
  const torso = createCardboardPart(torsoGeo, matGazelleFlank, { pos: [0, bodyY, 0] });
  torso.name = 'torso';
  group.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.46, bodyY + 0.12, 0);
  group.add(headGroup);

  const neckGeo = createVerticalPrismGeometry(0.18, 0.18, 0.22, 0.22, 0.56, 0.15, 0);
  const neck = createCardboardPart(neckGeo, matGazelleTan, {
    pos: [0.06, 0.22, 0]
  });
  neck.name = 'neck';
  headGroup.add(neck);

  const headMesh = createCardboardPart(
    createTaperedBoxGeometry(0.40, 0.22, 0.22, 0.52, 0.56, -0.02),
    matGazelleTan,
    { pos: [0.28, 0.48, 0], rot: [0, 0, -0.12] }
  );
  headMesh.name = 'headMesh';
  headGroup.add(headMesh);

  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.04, 0.04, 0.03), matCharcoalGouache, {
      pos: [0.26, 0.51, side * 0.11]
    });
  eye.name = 'eye';
    const ear = createCardboardPart(
      createTaperedBoxGeometry(0.24, 0.08, 0.04, 0.35, 0.5, 0),
      matGazelleTan,
      {
        pos: [0.10, 0.62, side * 0.11],
        rot: [side * 0.32, -side * 0.25, 0.65]
      }
    );
  ear.name = 'ear';

    // Articulated 2-segment gazelle horn where the upper phalange fits seamlessly into the lower one
    const hornRoot = new THREE.Group();
    hornRoot.position.set(0.15, 0.57, side * 0.055);
    hornRoot.rotation.set(side * 0.10, 0, 0.42);

    const h1 = 0.22;
    const hornSeg1 = createCardboardPart(
      createVerticalPrismGeometry(0.044, 0.044, 0.054, 0.054, h1),
      matCharcoalGouache,
      { pos: [0, h1 * 0.5, 0] }
    );
  hornSeg1.name = 'hornSeg1';
    hornRoot.add(hornSeg1);

    const hornUpperPivot = new THREE.Group();
    hornUpperPivot.position.set(0, h1, 0);
    hornUpperPivot.rotation.set(0, 0, 0.22);

    const h2 = 0.22;
    const hornSeg2 = createCardboardPart(
      createVerticalPrismGeometry(0.016, 0.016, 0.044, 0.044, h2),
      matCharcoalGouache,
      { pos: [0, h2 * 0.5 - 0.004, 0] }
    );
  hornSeg2.name = 'hornSeg2';
    hornUpperPivot.add(hornSeg2);
    hornRoot.add(hornUpperPivot);

    headGroup.add(eye, ear, hornRoot);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.54, bodyY + 0.06, 0);
  const tail = createCardboardPart(new THREE.BoxGeometry(0.08, 0.26, 0.08), matCharcoalGouache, {
    pos: [-0.04, -0.10, 0],
    rot: [0, 0, -0.25]
  });
  tail.name = 'tail';
  tailGroup.add(tail);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.36, 0.74, 0.13],
    [0.36, 0.74, -0.13],
    [-0.36, 0.74, 0.13],
    [-0.36, 0.74, -0.13]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matGazelleTan, matGazelleTan, matCharcoalGouache, {
      upperW: 0.13,
      upperD: 0.14,
      upperH: 0.42,
      sockW: 0.09,
      sockH: 0.24,
      hoofH: 0.08
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, tailGroup, legs, primaryMaterial: matGazelleFlank };
  return group;
}

// 7. LE CERF (RED STAG DEER)
function buildDeer() {
  const group = new THREE.Group();

  const matDeerAuburn = registerGouacheMat({
    baseColor: '#8c4927',
    secondaryColor: '#73381b',
    accentColor: '#a85c34',
    strokeStyle: 'wavy',
    strokeCount: 400
  });

  const matDeerMane = registerGouacheMat({
    baseColor: '#592e18',
    secondaryColor: '#42200f',
    strokeStyle: 'coarse',
    strokeCount: 300
  });

  const matAntlerCream = registerGouacheMat({
    baseColor: '#ded5c1',
    secondaryColor: '#c4b89f',
    strokeStyle: 'directional',
    strokeCount: 220
  });

  const bodyY = 1.08;

  const torsoGeo = createTaperedBoxGeometry(1.32, 0.56, 0.54, 0.95, 0.92, 0.03);
  const torso = createCardboardPart(torsoGeo, matDeerAuburn, { pos: [0, bodyY, 0] });
  torso.name = 'torso';
  group.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.52, bodyY + 0.18, 0);
  group.add(headGroup);

  const neckGeo = createVerticalPrismGeometry(0.26, 0.24, 0.38, 0.34, 0.56, 0.16, 0);
  const neck = createCardboardPart(neckGeo, matDeerMane, {
    pos: [0.02, 0.22, 0]
  });
  neck.name = 'neck';
  headGroup.add(neck);

  const ruffGeo = createVerticalPrismGeometry(0.32, 0.28, 0.44, 0.40, 0.26, 0.06, 0);
  const neckRuff = createCardboardPart(ruffGeo, matDeerMane, {
    pos: [0.02, 0.06, 0]
  });
  neckRuff.name = 'neckRuff';
  headGroup.add(neckRuff);

  const headMesh = createCardboardPart(
    createTaperedBoxGeometry(0.50, 0.26, 0.26, 0.54, 0.58, -0.02),
    matDeerAuburn,
    { pos: [0.30, 0.52, 0], rot: [0, 0, -0.06] }
  );
  headMesh.name = 'headMesh';
  const nose = createCardboardPart(new THREE.BoxGeometry(0.07, 0.07, 0.08), matCharcoalGouache, {
    pos: [0.55, 0.50, 0]
  });
  nose.name = 'nose';
  headGroup.add(headMesh, nose);

  const antlerPts = [
    [0, 0],
    [0.08, 0],
    [0.14, 0.18],
    [0.32, 0.24],
    [0.30, 0.31],
    [0.16, 0.27],
    [0.22, 0.46],
    [0.42, 0.54],
    [0.39, 0.61],
    [0.22, 0.55],
    [0.26, 0.78],
    [0.16, 0.84],
    [0.12, 0.65],
    [-0.02, 0.74],
    [-0.08, 0.68],
    [0.08, 0.52],
    [0.04, 0.25]
  ];
  const antlerCutoutGeo = createCardboardCutoutPlate(antlerPts, 0.055, false);

  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.045, 0.045, 0.03), matCharcoalGouache, {
      pos: [0.28, 0.55, side * 0.13]
    });
  eye.name = 'eye';
    const ear = createCardboardPart(new THREE.BoxGeometry(0.22, 0.09, 0.06), matDeerAuburn, {
      pos: [0.12, 0.58, side * 0.16],
      rot: [side * 0.4, -side * 0.35, 0.25]
    });
  ear.name = 'ear';
    const pedicle = createCardboardPart(new THREE.BoxGeometry(0.08, 0.06, 0.07), matDeerMane, {
      pos: [0.19, 0.64, side * 0.065]
    });
  pedicle.name = 'pedicle';
    const antler = createCardboardPart(antlerCutoutGeo, matAntlerCream, {
      pos: [0.19, 0.65, side * 0.065],
      rot: [side * 0.28, -side * 0.22, 0.16]
    });
  antler.name = 'antler';
    headGroup.add(eye, ear, pedicle, antler);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.66, bodyY + 0.14, 0);
  const tail = createCardboardPart(
    createTaperedBoxGeometry(0.24, 0.14, 0.14, 0.4, 0.5, 0),
    matCreamWhiteGouache,
    { pos: [-0.08, -0.02, 0], rot: [0, 0, 2.6] }
  );
  tail.name = 'tail';
  tailGroup.add(tail);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.44, 0.84, 0.16],
    [0.44, 0.84, -0.16],
    [-0.46, 0.84, 0.16],
    [-0.46, 0.84, -0.16]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matDeerAuburn, matDeerMane, matCharcoalGouache, {
      upperW: 0.17,
      upperD: 0.18,
      upperH: 0.48,
      sockW: 0.12,
      sockH: 0.26,
      hoofH: 0.09
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, tailGroup, legs, primaryMaterial: matDeerAuburn };
  return group;
}

// 8. L'ÉLÉPHANT (AFRICAN ELEPHANT)
function buildElephant() {
  const group = new THREE.Group();

  const matElephantSlate = registerGouacheMat({
    baseColor: '#6f7378',
    secondaryColor: '#5c6066',
    accentColor: '#868b91',
    strokeStyle: 'coarse',
    strokeCount: 460
  });

  const bodyY = 1.28;

  const torsoGeo = createTaperedBoxGeometry(1.78, 1.12, 1.08, 0.94, 0.94, -0.04);
  const torso = createCardboardPart(torsoGeo, matElephantSlate, {
    pos: [-0.06, bodyY, 0],
    rot: [0, 0, -0.05]
  });
  torso.name = 'torso';
  group.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.84, bodyY + 0.16, 0);
  group.add(headGroup);

  const cranium = createCardboardPart(
    createTaperedBoxGeometry(0.68, 0.74, 0.72, 0.82, 0.84, -0.06),
    matElephantSlate,
    { pos: [0.16, 0, 0] }
  );
  cranium.name = 'cranium';
  headGroup.add(cranium);

  const trunkGroup = new THREE.Group();
  trunkGroup.position.set(0.46, -0.10, 0);
  headGroup.add(trunkGroup);

  const tSeg1 = createCardboardPart(new THREE.BoxGeometry(0.24, 0.44, 0.24), matElephantSlate, {
    pos: [0.04, -0.18, 0],
    rot: [0, 0, 0.15]
  });
  tSeg1.name = 'tSeg1';
  const tSeg2 = createCardboardPart(new THREE.BoxGeometry(0.20, 0.40, 0.20), matElephantSlate, {
    pos: [0.09, -0.52, 0],
    rot: [0, 0, 0.05]
  });
  tSeg2.name = 'tSeg2';
  const tSeg3 = createCardboardPart(new THREE.BoxGeometry(0.16, 0.30, 0.16), matElephantSlate, {
    pos: [0.16, -0.78, 0],
    rot: [0, 0, 0.48]
  });
  tSeg3.name = 'tSeg3';
  trunkGroup.add(tSeg1, tSeg2, tSeg3);

  const earPts = [
    [0, 0.42],
    [0.46, 0.34],
    [0.54, -0.10],
    [0.32, -0.48],
    [0.04, -0.38],
    [-0.04, 0.05]
  ];
  const earCutoutGeo = createCardboardCutoutPlate(earPts, 0.06);

  const ears:THREE.Object3D[] = [];
  [-1, 1].forEach((side) => {
    const eye = createCardboardPart(new THREE.BoxGeometry(0.055, 0.055, 0.03), matCharcoalGouache, {
      pos: [0.34, 0.06, side * 0.35]
    });
  eye.name = 'eye';
    headGroup.add(eye);

    const tusk1 = createCardboardPart(new THREE.BoxGeometry(0.36, 0.09, 0.09), matCreamWhiteGouache, {
      pos: [0.46, -0.28, side * 0.22],
      rot: [0, -side * 0.12, -0.32]
    });
  tusk1.name = 'tusk1';
    const tusk2 = createCardboardPart(
      createTaperedBoxGeometry(0.28, 0.08, 0.08, 0.28, 0.28, 0),
      matCreamWhiteGouache,
      {
        pos: [0.68, -0.28, side * 0.25],
        rot: [0, -side * 0.18, 0.22]
      }
    );
  tusk2.name = 'tusk2';
    headGroup.add(tusk1, tusk2);

    const earPivot = new THREE.Group();
    earPivot.position.set(0.02, 0.04, side * 0.36);
    earPivot.rotation.y = -side * 0.42;

    const earPlate = createCardboardPart(earCutoutGeo, matElephantSlate, {
      pos: [0.22, -0.04, 0],
      rot: [0, Math.PI * 0.5, 0]
    });
  earPlate.name = 'earPlate';
    earPivot.add(earPlate);
    headGroup.add(earPivot);
    ears.push(earPivot);
  });

  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.94, bodyY + 0.08, 0);
  const tailRod = createCardboardPart(new THREE.BoxGeometry(0.10, 0.56, 0.10), matElephantSlate, {
    pos: [-0.06, -0.24, 0],
    rot: [0, 0, -0.14]
  });
  tailRod.name = 'tailRod';
  const tailTuft = createCardboardPart(new THREE.BoxGeometry(0.14, 0.18, 0.14), matCharcoalGouache, {
    pos: [-0.10, -0.52, 0]
  });
  tailTuft.name = 'tailTuft';
  tailGroup.add(tailRod, tailTuft);
  group.add(tailGroup);

  const legs:THREE.Object3D[] = [];
  const legCoords = [
    [0.52, 0.80, 0.32],
    [0.52, 0.80, -0.32],
    [-0.56, 0.80, 0.32],
    [-0.56, 0.80, -0.32]
  ];
  legCoords.forEach((coord) => {
    const leg = createArticulatedLeg(matElephantSlate, matElephantSlate, matCreamWhiteGouache, {
      upperW: 0.36,
      upperD: 0.36,
      upperH: 0.48,
      sockW: 0.32,
      sockH: 0.22,
      hoofH: 0.09
    });
    leg.position.set(coord[0],coord[1],coord[2]);
    group.add(leg);
    legs.push(leg);
  });

  group.userData = { headGroup, trunkGroup, tailGroup, ears, legs, primaryMaterial: matElephantSlate };
  return group;
}


export function buildOrigamiAnimalReference(kind:OrigamiAnimalReference):THREE.Group {
 return {fox:buildFox,camel:buildCamel,hare:buildHare,dog:buildDog,buffalo:buildBuffalo,gazelle:buildGazelle,deer:buildDeer,elephant:buildElephant}[kind]();
}
