import {drawPicto,drawPictoInBox} from '../ui/picto-artwork';
import * as THREE from 'three/webgpu';

/** Literal artwork from the user's diorama_carton_hud_3d_three_js_webgpu(3).html.
 * Canvas is only a procedural paint surface; placement and interaction are meshes.
 * The host owns scene attachment, input, animation and the factory lifetime.
 */
type Paint = string | CanvasGradient | CanvasPattern;
export type CardboardDraw = (ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) => void;
export interface CardboardPieceOptions {
  /** Opt-in: identical cut shapes share geometry owned by the art factory,
   * released at its disposal rather than with the piece. */
  sharedGeometry?:boolean;
  /** Use the same cut cardboard construction for silhouettes, not a flat decal. */
  outline?:THREE.Shape|THREE.Shape[];
  surface?:'panel';
  paper?:boolean;
  cacheBackground?:boolean;
  hitOnly?:boolean;
  textureWidth?:number;
  textureHeight?:number;
  uvPadding?:number;
  w: number;
  h: number;
  depth?: number;
  bgColor?: string;
  bevel?: number;
  seed?: number;
  drawFn?: CardboardDraw;
  interactive?: boolean;
  onClick?: (() => void) | null;
  hasBorder?: boolean;
  tooltip?: string;
}
export interface CardboardPieceData {
  [key: string]: unknown;
  w: number;
  h: number;
  depth: number;
  seed: number;
  mesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  wPx: number;
  hPx: number;
  texture: THREE.CanvasTexture;
  bgColor: string;
  hasBorder: boolean;
  drawFn: CardboardDraw | undefined;
  drawTabFn?: CardboardDraw;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: THREE.Vector3;
  hoverTarget: number;
  hoverVal: number;
  pressVal: number;
  active: boolean;
  tooltip: string;
  onClick: (() => void) | null;
  interactiveMeshes?: readonly THREE.Mesh[];
  redraw(drawFn?: CardboardDraw, bgColor?: string): void;
  setBaseTransform(x: number, y: number, z?: number, rotZ?: number): void;
  releasePaint?:()=>void;
}
export interface CardboardPiece extends THREE.Group {
  userData: CardboardPieceData;
  setBaseTransform(x: number, y: number, z?: number, rotZ?: number): void;
  redraw(drawFn?: CardboardDraw, bgColor?: string): void;
  setActive(active: boolean, bgColor?: string): void;
}
export const PALETTE = {
  edgeCream: 0xf2e9d2,     // Tranche franche et mate du carton découpé (comme les montagnes)
  wallKraft: 0xc59e72,     // Carton du mur de fond
  kraftBase: '#c69d6e',    // Carton brut sous la peinture
  kraftDark: '#9d764c',
  kraftLight: '#dfC5a2',
  creamPaper: '#f3ead6',
  sageMountain: '#8fa185', // Gouache vert sauge
  pineDark: '#47684b',
  pineMid: '#688358',
  foliageLight: '#8ea352',
  ochre: '#d9993e',        // Gouache ocre jaune
  terracotta: '#c85a42',   // Gouache rouge terre cuite
  slateBlue: '#5b7c8e',    // Gouache bleu ardoise
  berryPurple: '#865d72',  // Gouache prune
  inkDark: '#261e18',      // Feutre noir/brun
  tapeHex: 0xeadfc2
};

interface RandomStream {():number;clone():RandomStream}
function randomStream(seed:number):RandomStream {
  let s = (seed % 2147483647);
  if (s <= 0) s += 2147483646;
  const next = function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  } as RandomStream;
  next.clone=()=>randomStream(s);
  return next;
}
export function seededRandom(seed: number):()=>number {
  let s = (seed % 2147483647);
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Génère un polygone découpé proprement aux ciseaux (légèrement fait main mais sans déformation excessive)
export function createCutoutRectShape(w: number, h: number, irregularity = 0.012, seed = 1) {
  const rng = seededRandom(seed * 137 + 19);
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;

  // Très légère asymétrie des coins pour garder un aspect découpé à la main mais propre
  const skew = Math.min(w, h) * 0.022;
  const corners = [
    { x: -hw + (rng() - 0.5) * skew, y: -hh + (rng() - 0.5) * skew }, // Bas-Gauche
    { x:  hw + (rng() - 0.5) * skew, y: -hh + (rng() - 0.5) * skew }, // Bas-Droite
    { x:  hw + (rng() - 0.5) * skew, y:  hh + (rng() - 0.5) * skew }, // Haut-Droite
    { x: -hw + (rng() - 0.5) * skew, y:  hh + (rng() - 0.5) * skew }  // Haut-Gauche
  ];

  const pts = [];
  for (let side = 0; side < 4; side++) {
    const p1 = corners[side];
    const p2 = corners[(side + 1) % 4];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    // Quelques points d'inflexion subtils le long de la coupe aux ciseaux
    const steps = Math.max(2, Math.min(4, Math.floor(dist / 0.45) + 1));

    const snipStart = rng() > 0.5 ? (0.015 + rng() * 0.02) : 0.005;
    pts.push({
      x: p1.x + (p2.x - p1.x) * snipStart,
      y: p1.y + (p2.y - p1.y) * snipStart
    });

    const nx = -(p2.y - p1.y) / dist;
    const ny =  (p2.x - p1.x) / dist;

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const wobble = (rng() - 0.5) * irregularity * 0.45;
      pts.push({
        x: p1.x + (p2.x - p1.x) * t + nx * wobble,
        y: p1.y + (p2.y - p1.y) * t + ny * wobble
      });
    }

    const snipEnd = rng() > 0.5 ? (0.985 - rng() * 0.02) : 0.995;
    pts.push({
      x: p1.x + (p2.x - p1.x) * snipEnd,
      y: p1.y + (p2.y - p1.y) * snipEnd
    });
  }

  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i].x, pts[i].y);
  }
  shape.closePath();
  return shape;
}

// ============================================================================
// OUTILS DE DESSIN "ENFANT" : FEUTRE TREMBLANT, GOUACHE ÉPAISSE & CRAYON
// ============================================================================

// Trace une ligne au feutre ou fusain qui tremble légèrement et dépasse aux extrémités
export function drawMarkerLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color:Paint = '#261e18', width = 3, rng = Math.random) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(3, Math.floor(dist / 16));
  const nx = -(y2 - y1) / (dist || 1);
  const ny =  (x2 - x1) / (dist || 1);

  // Léger dépassement du trait de feutre aux coins
  const over = Math.min(5, dist * 0.04);
  const sx = x1 - ((x2 - x1) / (dist || 1)) * over * rng();
  const sy = y1 - ((y2 - y1) / (dist || 1)) * over * rng();
  const ex = x2 + ((x2 - x1) / (dist || 1)) * over * rng();
  const ey = y2 + ((y2 - y1) / (dist || 1)) * over * rng();

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const jitter = (rng() - 0.5) * width * 1.1;
    ctx.lineTo(sx + (ex - sx) * t + nx * jitter, sy + (ey - sy) * t + ny * jitter);
  }
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.restore();
}

// Dessine un rectangle à main levée (4 traits de feutre pas tout à fait droits qui se croisent aux coins)
export function drawHandRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fillColor: Paint | null, strokeColor: Paint | null = '#261e18', lineWidth = 3, rng = Math.random) {
  ctx.save();
  const j = () => (rng() - 0.5) * 5;
  const tl = { x: x + j(), y: y + j() };
  const tr = { x: x + w + j(), y: y + j() };
  const br = { x: x + w + j(), y: y + h + j() };
  const bl = { x: x + j(), y: y + h + j() };

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
  }

  if (strokeColor && lineWidth > 0) {
    drawMarkerLine(ctx, tl.x, tl.y, tr.x, tr.y, strokeColor, lineWidth, rng);
    drawMarkerLine(ctx, tr.x, tr.y, br.x, br.y, strokeColor, lineWidth, rng);
    drawMarkerLine(ctx, br.x, br.y, bl.x, bl.y, strokeColor, lineWidth, rng);
    drawMarkerLine(ctx, bl.x, bl.y, tl.x, tl.y, strokeColor, lineWidth, rng);
  }
  ctx.restore();
}

// Dessine une tache / rond de gouache irrégulier entouré au feutre à main levée (façon patate)
export function drawHandBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fillColor: Paint | null, strokeColor: Paint | null = '#261e18', lineWidth = 3, rng = Math.random) {
  ctx.save();
  const numPts = 14;
  const pts = [];
  for (let i = 0; i < numPts; i++) {
    const a = (i / numPts) * Math.PI * 2;
    const rad = r * (0.88 + rng() * 0.24);
    pts.push({
      x: cx + Math.cos(a) * rad,
      y: cy + Math.sin(a) * rad
    });
  }

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= numPts; i++) {
      const p = pts[i % numPts];
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (strokeColor && lineWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    // Le trait de feutre fait un peu plus d'un tour et ne retombe pas pile en face
    for (let i = 1; i <= numPts + 2; i++) {
      const p = pts[i % numPts];
      ctx.lineTo(p.x + (rng() - 0.5) * 2.2, p.y + (rng() - 0.5) * 2.2);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Peint une vraie surface en carton kraft recouverte de coups de pinceau à la gouache irréguliers
export function paintCardboardCanvas(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, bgColor: string, drawCallback: CardboardDraw | undefined, hasBorder = true, seed = 1, rng:()=>number = seededRandom(seed * 313 + 7), surface?:'panel') {
  ctx.clearRect(0, 0, wPx, hPx);

  // 1. Fond de carton kraft brut (qui restera visible sur les bords mal peints !)
  ctx.fillStyle = PALETTE.kraftBase;
  ctx.fillRect(0, 0, wPx, hPx);

  // Ondulations internes du carton kraft + fibres de papier recyclé
  ctx.fillStyle = 'rgba(75, 45, 18, 0.06)';
  for (let y = 0; y < hPx; y += 6) {
    ctx.fillRect(0, y + (rng() - 0.5) * 2, wPx, 2.2);
  }
  const specks = Math.min(700, Math.floor((wPx * hPx) / 130));
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = (i % 3 === 0) ? 'rgba(48, 28, 12, 0.11)' : 'rgba(255, 246, 225, 0.09)';
    ctx.fillRect(rng() * wPx, rng() * hPx, 2 + rng() * 4, 1.5 + rng() * 2);
  }

  // 2. Couche de gouache appliquée au gros pinceau (laisse apparaître le carton brut aux bords)
  ctx.save();
  ctx.fillStyle = bgColor;
  const numStrokes = Math.max(6, Math.floor(hPx / 16));
  for (let s = 0; s < numStrokes; s++) {
    const sy = (s / numStrokes) * (hPx - 10) + 2 + (rng() - 0.5) * 8;
    const sh = (hPx / numStrokes) * (1.25 + rng() * 0.45);
    const marginL = 3 + rng() * Math.min(18, wPx * 0.06);
    const marginR = 3 + rng() * Math.min(18, wPx * 0.06);

    ctx.globalAlpha = 0.84 + rng() * 0.16;
    ctx.beginPath();
    ctx.moveTo(marginL, sy + (rng() - 0.5) * 4);
    ctx.lineTo(wPx - marginR, sy + (rng() - 0.5) * 5);
    ctx.lineTo(wPx - marginR + (rng() - 0.5) * 8, sy + sh + (rng() - 0.5) * 4);
    ctx.lineTo(marginL + (rng() - 0.5) * 8, sy + sh + (rng() - 0.5) * 4);
    ctx.closePath();
    ctx.fill();
  }

  // Coup de pinceau en travers pour remplir le milieu mais avec des variations de pigment
  ctx.globalAlpha = 0.92;
  drawHandRect(ctx, 8, 8, wPx - 16, hPx - 16, bgColor, null, 0, rng);

  // 3. Variations de dilution de la gouache (auréoles plus claires / plus sombres et traces de poils)
  const pigmentCount=surface?Math.min(42,Math.max(7,Math.ceil(wPx*hPx/80000))):7;
  for (let b = 0; b < pigmentCount; b++) {
    ctx.fillStyle = (b % 2 === 0) ? 'rgba(255, 248, 230, 0.08)' : surface?'rgba(74, 48, 25, 0.025)':'rgba(35, 20, 10, 0.07)';
    drawHandBlob(
      ctx,
      wPx * (0.15 + rng() * 0.7),
      hPx * (0.15 + rng() * 0.7),
      Math.min(surface?96:Infinity,Math.min(wPx, hPx) * (0.18 + rng() * 0.25)),
      ctx.fillStyle,
      null,
      0,
      rng
    );
  }

  // Stries de poils de pinceau sec
  ctx.strokeStyle = 'rgba(255, 248, 230, 0.08)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    const by = rng() * hPx;
    ctx.beginPath();
    ctx.moveTo(10 + rng() * 20, by);
    ctx.lineTo(wPx - 10 - rng() * 20, by + (rng() - 0.5) * 10);
    ctx.stroke();
  }

  // Petites éclaboussures de peinture
  for (let sp = 0; sp < 10; sp++) {
    ctx.fillStyle = (sp % 2 === 0) ? 'rgba(38, 26, 18, 0.16)' : 'rgba(250, 242, 222, 0.22)';
    ctx.beginPath();
    ctx.arc(rng() * wPx, rng() * hPx, 1.2 + rng() * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Aucun trait de cadre sur le bord des cartons : uniquement le fond peint à la gouache et le dessin interne
  if (drawCallback) drawCallback(ctx, wPx, hPx, rng);
}

/** Invisible native input planes have no painted or GPU-sampled surface. The
 * compatibility texture is never bound to a material, so it is never uploaded. */
function createHitOnlyPiece({w,h,depth=.044,seed=1,interactive=false,onClick=null,tooltip='',drawFn,bgColor=PALETTE.kraftBase}:CardboardPieceOptions):CardboardPiece {
  const group=new THREE.Group() as CardboardPiece;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas 2D is required for native input compatibility.');
  const texture=new THREE.CanvasTexture(canvas),geometry=new THREE.PlaneGeometry(w,h);
  const material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material),shadowMesh=new THREE.Mesh(geometry,material);
  mesh.layers.set(31);shadowMesh.layers.set(31);shadowMesh.visible=false;
  group.add(mesh,shadowMesh);
  group.userData={w,h,depth,seed,paper:false,hitOnly:true,mesh,shadowMesh,canvas,ctx,wPx:1,hPx:1,texture,
    bgColor,hasBorder:false,drawFn,basePos:new THREE.Vector3(),baseRot:new THREE.Euler(),baseScale:new THREE.Vector3(1,1,1),
    hoverTarget:0,hoverVal:0,pressVal:0,active:false,tooltip,onClick,
    redraw(drawFn,bgColor=group.userData.bgColor){group.userData.drawFn=drawFn;group.userData.bgColor=bgColor;},
    setBaseTransform(x,y,z=0,rotZ=0){group.position.set(x,y,z);group.rotation.set(0,0,rotZ);group.userData.basePos.set(x,y,z);group.userData.baseRot.set(0,0,rotZ);}
  };
  group.setBaseTransform=(x,y,z=0,rotZ=0)=>group.userData.setBaseTransform(x,y,z,rotZ);
  group.redraw=(draw=group.userData.drawFn,bg=group.userData.bgColor)=>group.userData.redraw(draw,bg);
  group.setActive=(active,bg)=>{group.userData.active=active;group.redraw(undefined,bg);};
  if(interactive){mesh.userData.widgetGroup=group;group.userData.interactiveMeshes=[mesh];}
  return group;
}

/** Canvas pixels up to which a piece paints on a software (CPU) canvas. */
const SOFTWARE_CANVAS_MAX_PIXELS=262_144;
interface CardboardGeometry { readonly face: THREE.BufferGeometry; readonly shadow: THREE.BufferGeometry }
type CardboardGeometryCache = (key: string, make: () => CardboardGeometry) => CardboardGeometry;
/** Distinct shared cut shapes kept; beyond it, pieces own their geometry. */
const SHARED_CARDBOARD_GEOMETRIES = 4096;
export function createCardboardPiece({
  w, h, depth = 0.044, bgColor = PALETTE.kraftBase,
  bevel = 0.026, seed = 1, drawFn, interactive = false,
  onClick = null, hasBorder = true, tooltip = '', paper = true, textureWidth, textureHeight, uvPadding, cacheBackground = false, hitOnly = false, outline, surface, sharedGeometry = false
}: CardboardPieceOptions, cardboardEdgeMat: THREE.MeshStandardMaterial, shadowMat: THREE.MeshBasicMaterial, geometryCache?: CardboardGeometryCache): CardboardPiece {
  if(hitOnly)return createHitOnlyPiece({w,h,depth,seed,interactive,onClick,tooltip,drawFn,bgColor});
  const group = new THREE.Group() as CardboardPiece;
  const makeGeometry = (): CardboardGeometry => {
    const shape = outline??createCutoutRectShape(w, h, bevel, seed);

    // bevelEnabled: false -> Arête vive et franche de carton coupé aux ciseaux (zéro reflet plastique arrondi !)
    const extrudeSettings = {
      depth: depth,
      bevelEnabled: false,
      steps: 1
    };

    const geo = paper ? new THREE.ExtrudeGeometry(shape, extrudeSettings) : new THREE.PlaneGeometry(w,h);

    // Recalibrage UV sur [0..1] avec légère marge pour couvrir tous les sommets découpés
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    const spanW = w * (uvPadding??(paper?1.08:1));
    const spanH = h * (uvPadding??(paper?1.08:1));
    for (let i = 0; i < pos.count; i++) {
      uvs.setXY(i, (pos.getX(i) + spanW / 2) / spanW, (pos.getY(i) + spanH / 2) / spanH);
    }
    uvs.needsUpdate = true;
    return { face: geo, shadow: new THREE.ShapeGeometry(shape) };
  };
  // Identical cut shapes (same size, bevel, seed and depth) share their GPU
  // buffers: a table's hundreds of cells use a handful of geometries.
  const { face: geo, shadow: shadowGeo } = sharedGeometry && !outline && geometryCache
    ? geometryCache(JSON.stringify([w, h, depth, bevel, seed, paper, uvPadding]), makeGeometry)
    : makeGeometry();

  const wPx = textureWidth??Math.max(128, Math.round(w * 280));
  const hPx = textureHeight??Math.max(84, Math.round(h * 280));
  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  // Small pieces (buttons, table cells) paint on a software canvas: Chrome
  // pays a GPU surface per accelerated canvas and a readback per upload,
  // which made hundreds of cells cost hundreds of milliseconds to show.
  const ctx = canvas.getContext('2d', wPx * hPx <= SOFTWARE_CANVAS_MAX_PIXELS ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error('Canvas 2D is required for the original cardboard paint.');

  let background:HTMLCanvasElement|undefined,backgroundKey='',backgroundFill:Paint=PALETTE.kraftBase;
  let inkRandom:RandomStream|undefined;
  const paint=(draw:CardboardDraw|undefined,bg:string)=>{
    if(paper&&cacheBackground){
      const key=JSON.stringify([wPx,hPx,seed,bg,hasBorder,surface]);
      if(backgroundKey!==key){
        background??=document.createElement('canvas');background.width=wPx;background.height=hPx;
        const backgroundCtx=background.getContext('2d',{alpha:false});
        if(!backgroundCtx)throw new Error('Canvas 2D is required for cached cardboard paint.');
        paintCardboardCanvas(backgroundCtx,wPx,hPx,bg,(_ctx,_w,_h,rng)=>{inkRandom=(rng as RandomStream).clone();},hasBorder,seed,randomStream(seed*313+7),surface);
        backgroundFill=backgroundCtx.fillStyle;backgroundKey=key;
      }
      // Copy the opaque pixels at their original resolution. Restore the live
      // ink context's state, including any transform owned by its draw callback.
      ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';ctx.drawImage(background!,0,0);ctx.restore();
      ctx.fillStyle=backgroundFill;
      draw?.(ctx,wPx,hPx,inkRandom!.clone());
    }else if(paper)paintCardboardCanvas(ctx,wPx,hPx,bg,draw,hasBorder,seed,undefined,surface);
    else{ctx.clearRect(0,0,wPx,hPx);draw?.(ctx,wPx,hPx,seededRandom(seed));}
  };
  paint(drawFn,bgColor);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // Gouache 100% mate (roughness: 0.99, metalness: 0)
  const frontMat = paper?new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.99,
    metalness: 0.0
  }):new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});

  // Matériau 0 = Face peinte à la gouache, Matériau 1 = Tranche crème franche du carton
  const mesh = new THREE.Mesh(geo, paper?[frontMat, cardboardEdgeMat]:frontMat);
  group.add(mesh);

  // Ombre portée décalée
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0.022, -0.026, -0.012);
  shadowMesh.visible=paper;
  group.add(shadowMesh);

  group.userData = {
    w, h, depth, seed, paper,
    mesh, shadowMesh,
    canvas, ctx, wPx, hPx, texture,
    bgColor, hasBorder, drawFn,
    basePos: new THREE.Vector3(),
    baseRot: new THREE.Euler(),
    baseScale: new THREE.Vector3(1, 1, 1),
    hoverTarget: 0,
    hoverVal: 0,
    pressVal: 0,
    active: false,
    tooltip,
    onClick,
    releasePaint:()=>{if(background){background.width=background.height=1;background=undefined;}inkRandom=undefined;},
    redraw(newDrawFn, newBg = group.userData.bgColor) {
      group.userData.bgColor = newBg;
      group.userData.drawFn = newDrawFn;
      paint(newDrawFn,newBg);
      texture.needsUpdate = true;
    },
    setBaseTransform(x, y, z = 0, rotZ = 0) {
      // Légère inclinaison organique pour que chaque carton semble collé à la main
      const handWarpX = paper?((seed % 7) - 3) * 0.008:0;
      const handWarpY = paper?((seed % 5) - 2) * 0.008:0;
      group.position.set(x, y, z);
      group.rotation.set(handWarpX, handWarpY, rotZ);
      group.userData.basePos.set(x, y, z);
      group.userData.baseRot.set(handWarpX, handWarpY, rotZ);
    }
  };

  group.setBaseTransform = (x, y, z = 0, rotZ = 0) => group.userData.setBaseTransform(x, y, z, rotZ);
  group.redraw = (draw = group.userData.drawFn, bg = group.userData.bgColor) => group.userData.redraw(draw, bg);
  group.setActive = (active, bg) => {
    group.userData.active = active;
    group.redraw(group.userData.drawFn, bg);
  };

  if (interactive) {
    mesh.userData.widgetGroup = group;
    group.userData.interactiveMeshes = [mesh];
  }

  return group;
}

// Crée un morceau de ruban adhésif (masking tape) déchiré en 3D collé sur un coin
export function createMaskingTape(w = 0.16, h = 0.048, rotZ = 0.3) {
  const shape = createCutoutRectShape(w, h, 0.014, Math.abs(Math.round(rotZ * 100)) + 5);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.007, bevelEnabled: false });
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.tapeHex,
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = rotZ;
  mesh.position.z = 0.046;
  return mesh;
}

/** Icon ink only. The cardboard/panel painters above keep their original hand. */
export function drawHandPaintedIcon(ctx:CanvasRenderingContext2D,iconName:string,cx:number,cy:number,r:number,strokeColor='#261e18',_accentColor='#f4ecda') {
  drawPicto(ctx,iconName,cx,cy,r,strokeColor);
}

export interface ManagementButtonConfig {
  id: string;
  label: string;
  color: string;
}

/** The reference's twelve painted tabs, without its fabricated demo contents. */
export const MANAGEMENT_BUTTONS: readonly ManagementButtonConfig[] = [
  { id: 'architecte', label: 'Architecte', color: '#8fa382' },
  { id: 'travail', label: 'Travail', color: '#c79f71' },
  { id: 'planning', label: 'Planning', color: '#d49b4b' },
  { id: 'assignations', label: 'Assignations', color: '#91a187' },
  { id: 'animaux', label: 'Animaux', color: '#c29b70' },
  { id: 'faune', label: 'Faune', color: '#688358' },
  { id: 'recherches', label: 'Recherches', color: '#5d7d8f' },
  { id: 'quetes', label: 'Quêtes', color: '#c95b44' },
  { id: 'monde', label: 'Monde', color: '#7a968b' },
  { id: 'historique', label: 'Historique', color: '#b59978' },
  { id: 'factions', label: 'Factions', color: '#865e73' },
  { id: 'menu', label: 'Menu', color: '#7c624c' }
];

export class PrototypeCardboardArt {
  revision=0;
  /** Geometry, material or texture ownership changes; transform-only poses do
   * not invalidate retained resource descriptors. */
  resourceRevision=0;
  readonly cardboardEdgeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.edgeCream,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: true
  });
  readonly shadowMat = new THREE.MeshBasicMaterial({
    color: 0x221509,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });
  private readonly pieces = new Set<CardboardPiece>();
  private readonly hitMeshes: THREE.Mesh[] = [];
  /** Shared cut-shape geometries, never disposed with a piece. */
  private readonly sharedGeometries = new Map<string, CardboardGeometry>();
  private readonly sharedGeometrySet = new Set<THREE.BufferGeometry>();
  private readonly geometryCache: CardboardGeometryCache = (key, make) => {
    const cached = this.sharedGeometries.get(key);
    if (cached) return cached;
    const made = make();
    if (this.sharedGeometries.size < SHARED_CARDBOARD_GEOMETRIES) {
      this.sharedGeometries.set(key, made);
      this.sharedGeometrySet.add(made.face);this.sharedGeometrySet.add(made.shadow);
    }
    return made;
  };
  private readonly shelves = new Set<THREE.Mesh>();

  get interactiveMeshes(): readonly THREE.Mesh[] { return this.hitMeshes; }

  createPiece(options: CardboardPieceOptions): CardboardPiece {
    const piece = createCardboardPiece(options, this.cardboardEdgeMat, this.shadowMat, this.geometryCache);
    const redraw=piece.userData.redraw,setBase=piece.userData.setBaseTransform;
    piece.userData.redraw=(...args)=>{redraw(...args);this.revision++;this.resourceRevision++;};
    piece.userData.setBaseTransform=(...args)=>{setBase(...args);this.revision++;};
    this.pieces.add(piece);
    this.hitMeshes.push(...(piece.userData.interactiveMeshes ?? []));
    this.revision++;
    this.resourceRevision++;
    return piece;
  }

  createManagementButton(index: number, cfg: ManagementButtonConfig, onActivate: () => void, labelSize=16): CardboardPiece {
    const idx = index;
    // These dimensions, offsets, stroke order and font are the literal prototype.
    const tabW = 0.63 + ((idx * 7) % 3) * 0.018;
    const tabH = 0.55 + ((idx * 5) % 3) * 0.025;
    const spacing = 0.675;
    const xPos = (idx - (MANAGEMENT_BUTTONS.length - 1) / 2) * spacing;
    let active = false;

    const drawTabFn: CardboardDraw = (ctx, wPx, hPx, rng = Math.random) => {
      // Keep the label's seeded paint identical after removing its icon disk.
      for (let point = 0; point < 14; point++) rng();
      drawPictoInBox(ctx, cfg.id, 12, 10, wPx - 24, hPx - 62, '#261e18');
      ctx.save();
      ctx.translate(wPx / 2, hPx - 27);
      ctx.rotate((idx % 2 === 0 ? -0.035 : 0.035));
      drawHandRect(ctx, -wPx * 0.44, -15, wPx * 0.88, 30, '#f4ecda', '#261e18', 2.5, rng);
      ctx.fillStyle = '#261e18';
      ctx.font = 'bold '+labelSize+'px "Comic Sans MS", "Chalkboard SE", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label, 0, 6);
      ctx.restore();
    };

    const tabBtn = this.createPiece({
      w: tabW, h: tabH, depth: 0.046, bgColor: cfg.color, bevel: 0.038, seed: 600 + idx * 31,
      hasBorder: false,
      interactive: true,
      drawFn: drawTabFn,
      onClick: onActivate
    });
    tabBtn.userData.drawTabFn = drawTabFn;
    tabBtn.setActive = (value: boolean) => {
      if (active === value) return;
      active = value;
      tabBtn.userData.active = value;
      tabBtn.redraw(drawTabFn, value ? PALETTE.ochre : cfg.color);
    };
    if (idx % 3 === 0) {
      const miniTape = createMaskingTape(0.14, 0.04, (idx % 2 === 0 ? 0.22 : -0.25));
      miniTape.position.set(0, tabH / 2 - 0.02, 0.048);
      tabBtn.add(miniTape);
    }
    const slightTilt = (idx % 2 === 0 ? 0.038 : -0.034) + ((idx % 3) - 1) * 0.012;
    const yJitter = 0.34 + ((idx * 3) % 3 - 1) * 0.015;
    tabBtn.userData.setBaseTransform(xPos, yJitter, 0, slightTilt);
    return tabBtn;
  }

  createBottomShelf(): THREE.Mesh {
    const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wallKraft, roughness: 0.94 });
    const bottomShelf = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.035, 0.055),
      [this.cardboardEdgeMat, this.cardboardEdgeMat, this.cardboardEdgeMat, this.cardboardEdgeMat, wallMat, wallMat]
    );
    bottomShelf.position.set(0, 0.51, -0.035);
    this.shelves.add(bottomShelf);
    return bottomShelf;
  }

  /** Releases only this factory's paint and geometry; shared materials live until dispose(). */
  /** Detach pieces kept for later reuse: out of the scene and of hit testing,
   * resources kept. One pass over the hit list for the whole batch. */
  parkPieces(pieces: Iterable<CardboardPiece>): void {
    const meshes = new Set<THREE.Mesh>();
    for (const piece of pieces) {
      if (!this.pieces.has(piece)) continue;
      for (const mesh of piece.userData.interactiveMeshes ?? []) meshes.add(mesh);
      piece.removeFromParent();
    }
    if (!meshes.size) return;
    let kept = 0;
    for (const mesh of this.hitMeshes) if (!meshes.has(mesh)) this.hitMeshes[kept++] = mesh;
    this.hitMeshes.length = kept;
    this.revision++;
  }

  /** A parked piece returns to hit testing; its owner re-adds it to the scene. */
  revivePiece(piece: CardboardPiece): void {
    if (!this.pieces.has(piece)) return;
    this.hitMeshes.push(...(piece.userData.interactiveMeshes ?? []));
    this.revision++;
  }

  disposePiece(piece: CardboardPiece): void {
    if (!this.pieces.delete(piece)) return;
    this.revision++;
    this.resourceRevision++;
    for (const mesh of piece.userData.interactiveMeshes ?? []) {
      const index = this.hitMeshes.indexOf(mesh);
      if (index >= 0) this.hitMeshes.splice(index, 1);
    }
    piece.userData.texture.dispose();
    piece.userData.releasePaint?.();
    this.disposeMeshes(piece);
    piece.removeFromParent();
    piece.clear();
  }

  private disposeMeshes(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material !== this.cardboardEdgeMat && material !== this.shadowMat) materials.add(material);
      }
    });
    for (const geometry of geometries) if (!this.sharedGeometrySet.has(geometry)) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  dispose(): void {
    for (const piece of this.pieces) this.disposePiece(piece);
    for (const geometry of this.sharedGeometrySet) geometry.dispose();
    this.sharedGeometrySet.clear();this.sharedGeometries.clear();
    for (const shelf of this.shelves) {
      this.disposeMeshes(shelf);
      shelf.removeFromParent();
    }
    this.shelves.clear();
    this.cardboardEdgeMat.dispose();
    this.shadowMat.dispose();
  }
}
