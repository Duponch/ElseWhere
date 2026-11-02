import * as THREE from 'three/webgpu';

/** Literal painter from the supplied Atelier HTML. TypeScript boundaries and
 * three optional read-only capture hooks surround the unchanged source draws.
 * Keep its RNG call order, Canvas2D strokes, linear-space Three color variation,
 * compositing and map sizes intact: these are the authored paint.
 */
export const REFERENCE_HTML_SHA256 = 'df28520eafe36230f13c68ab64940d0db5173829c185c0850f8cdd97357dada7';
export const REFERENCE_PAINTER_SOURCE_SHA256 = '467d502ea77a7493267380c68540dd0c5a7452c70eb6860cf4b1a1dda496fd49';
export interface ReferencePaintConfig {
  baseColor?: string;
  secondaryColor?: string | null;
  accentColor?: string | null;
  strokeStyle?: string;
  strokeCount?: number;
  gradientTip?: {color?: string} | null;
  flankStripe?: {bellyColor?: string; stripeColor?: string} | null;
  kraftEdgeWear?: boolean;
}
export interface ReferenceStrokeOptions {
  bristles?: number;
  curve?: number;
  dryBrush?: boolean;
  opacity?: number;
}

export interface ReferenceSeparatedPaintPixels {
  width:512;height:512;
  material:THREE.MeshStandardMaterial;
  /** Original opaque composite, retained as the exact identity-map oracle. */
  canonicalColorRgba:Uint8Array;canonicalBumpRgba?:Uint8Array;
  /** Opaque pigment BEFORE destination-in removes the face border. These
   * planes alone can repeat with the physical brush-density UV metric. */
  pigmentColorRgba:Uint8Array;pigmentBumpRgba?:Uint8Array;
  /** Original unpainted substrate, attached to the source face's raw UVs. */
  paperColorRgba:Uint8Array;paperBumpRgba?:Uint8Array;
  /** Use ALPHA for coverage, including antialiased mask pixels. RGB is not a
   * coverage scalar: Canvas stores the white mask unpremultiplied. */
  coverageRgba:Uint8Array;
  seed:number;seedAfter:number;
  /** PRIVATE read-only checkpoint, never a derived/skipped seed. */
  coverageSeed:number;
}
type PaintCaptureStage='paper'|'pigment'|'coverage';
type PaintCapture=(stage:PaintCaptureStage,color:HTMLCanvasElement,bump?:HTMLCanvasElement)=>void;
const referencePaintCapture=new WeakMap<GouacheCardboardPainter,PaintCapture>();
function capturedRgba(canvas:HTMLCanvasElement):Uint8Array {
  const context=canvas.getContext('2d');if(!context)throw new Error('Origami paint separation requires Canvas2D');
  const data=context.getImageData(0,0,canvas.width,canvas.height).data;
  return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
}

/** One invocation of the literal painter, with exactly its original RNG and
 * compositing. Read-only snapshots expose layers already present in the source
 * instead of trying to infer an antialiased mask from quantized final RGB.
 * The caller owns/disposes the returned material as for the canonical method.
 *
 * For mapped pigment, keep paper and coverage on raw face UV. A GPU linear-RGB
 * mix is not byte-identical to Canvas's sRGB source-over rounding. Retain the
 * canonical composite for identity, or preserve its quantization residual:
 * encodedF(raw)+M(raw)*(encodedP(mapped)-encodedP(raw)); height is analogous.
 */
export function createSeparatedReferencePaint(painter:GouacheCardboardPainter,config:ReferencePaintConfig,options:ReferencePaintRasterOptions={}):ReferenceSeparatedPaintPixels {
  const seed=painter.seed,previous=referencePaintCapture.get(painter);
  let coverageSeed=Number.NaN;
  let paperColorRgba:Uint8Array|undefined,paperBumpRgba:Uint8Array|undefined,pigmentColorRgba:Uint8Array|undefined,pigmentBumpRgba:Uint8Array|undefined,coverageRgba:Uint8Array|undefined;
  referencePaintCapture.set(painter,(stage,color,bump)=>{
    if(stage==='paper'){paperColorRgba=capturedRgba(color);if(bump)paperBumpRgba=capturedRgba(bump);}
    else if(stage==='pigment'){coverageSeed=painter.seed;pigmentColorRgba=capturedRgba(color);if(bump)pigmentBumpRgba=capturedRgba(bump);}
    else coverageRgba=capturedRgba(color);
  });
  let material:THREE.MeshStandardMaterial;
  try{material=createReferencePaintMaterial(painter,config,options);}
  finally{if(previous)referencePaintCapture.set(painter,previous);else referencePaintCapture.delete(painter);}
  if(!paperColorRgba||!pigmentColorRgba||(options.includeHeight!==false&&(!paperBumpRgba||!pigmentBumpRgba)))throw new Error('Origami painter did not expose all requested source paint layers');
  // The literal source omits its mask entirely when fill is disabled.
  coverageRgba??=new Uint8Array(512*512*4).fill(255);
  return {width:512,height:512,material,paperColorRgba,paperBumpRgba,pigmentColorRgba,pigmentBumpRgba,coverageRgba,
    canonicalColorRgba:capturedRgba(material.userData.colorCanvas as HTMLCanvasElement),canonicalBumpRgba:material.userData.bumpCanvas?capturedRgba(material.userData.bumpCanvas as HTMLCanvasElement):undefined,seed,seedAfter:painter.seed,coverageSeed};
}

/** Selective production raster options. Defaults dispatch to the literal
 * painter below; disabled channels allocate neither Canvas nor texture. */
export interface ReferencePaintRasterOptions {includeHeight?:boolean}
export function createReferencePaintMaterial(painter:GouacheCardboardPainter,config:ReferencePaintConfig,options:ReferencePaintRasterOptions={}):THREE.MeshStandardMaterial {
 return options.includeHeight===false?createColorOnlyGouacheMaterial.call(painter,config):painter.createGouacheMaterialSet(config);
}
export function createReferenceEdgeMaterial(painter:GouacheCardboardPainter,channels:{color:boolean;height:boolean}={color:true,height:true}):THREE.MeshStandardMaterial {
 return channels.color&&channels.height?painter.createPhysicalEdgeWearMaterial():createSelectiveEdgeMaterial.call(painter,channels);
}

/** The authored color draw stream with height-only random calls retained.
 * This branch has no hidden/placeholder height Canvas or drawing context. */
function drawColorOnlyStroke(this:GouacheCardboardPainter,ctx: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, angle: number, colorHex: string, options: ReferenceStrokeOptions = {}) {
        const bristles = options.bristles || 9;
        const curve = options.curve || this.randRange(-0.22, 0.22);
        const dryBrush = options.dryBrush || false;
        const opacity = options.opacity !== undefined ? options.opacity : this.randRange(0.78, 0.97);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);


        for (let b = 0; b < bristles; b++) {
          const normB = b / (bristles - 1) - 0.5;
          const offsetY = normB * width + this.randRange(-1.2, 1.2);
          const bristleWidth = (width / bristles) * this.randRange(1.15, 1.75);
          const bristleLen = length * this.randRange(0.82, 1.08);
          const startX = -bristleLen * 0.5 + this.randRange(-3, 3);
          const endX = bristleLen * 0.5 + this.randRange(-4, 4);
          const ctrlY = offsetY + length * curve;

          if (dryBrush && this.random() < 0.25) continue;

          ctx.beginPath();
          ctx.moveTo(startX, offsetY);
          ctx.quadraticCurveTo(0, ctrlY, endX, offsetY + this.randRange(-2, 2));
          ctx.strokeStyle = this.varyColor(colorHex, 0.015, 0.05, 0.045);
          ctx.globalAlpha = opacity * (1 - Math.abs(normB) * 0.25);
          ctx.lineWidth = bristleWidth;
          ctx.lineCap = 'round';
          ctx.stroke();

          this.seed += 0x6d2b79f5; // Preserve the color stream without computing height noise.
        }

        // Subtle thick paint edge pooling (gouache impasto rim)

        ctx.restore();
      }

function createColorOnlyGouacheMaterial(this:GouacheCardboardPainter,config:ReferencePaintConfig) {
        const {
          baseColor = '#c86428',
          secondaryColor = null,
          accentColor = null,
          strokeStyle = 'fur',
          strokeCount = 340,
          gradientTip = null,
          flankStripe = null,
          kraftEdgeWear = true
        } = config;

        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d')!;


        // 1. Raw Unpainted Kraft Cardboard Substrate (visible wherever paint is absent)
        ctx.fillStyle = '#c49a6c';
        ctx.fillRect(0, 0, size, size);

        // Unpainted cardboard sits slightly recessed (110) compared to thick gouache strokes (145+)

        // Matte Cardboard Pulp & Corrugated Ribbing Grain on the raw substrate
        for (let y = 0; y < size; y += 3) {
          this.seed += 0x6d2b79f5; // Preserve the color stream without computing height noise.

          ctx.fillStyle = y % 6 === 0 ? 'rgba(255,245,225,0.04)' : 'rgba(55,35,15,0.04)';
          ctx.fillRect(0, y, size, 2);
        }
        for (let i = 0; i < 360; i++) {
          ctx.fillStyle = this.random() > 0.5 ? 'rgba(245,225,195,0.12)' : 'rgba(80,52,24,0.10)';
          ctx.fillRect(this.randRange(0, size), this.randRange(0, size), this.randRange(4, 18), 1.5);
        }
        referencePaintCapture.get(this)?.('paper', colorCanvas); // Color-only separation.

        // 2. Separate Gouache Paint Layer (so unpainted contours are a true absence of paint)
        const paintCanvas = document.createElement('canvas');
        paintCanvas.width = size;
        paintCanvas.height = size;
        const pCtx = paintCanvas.getContext('2d')!;


        pCtx.fillStyle = baseColor;
        pCtx.fillRect(0, 0, size, size);


        // Subtle cardboard ribbing showing through the gouache layer
        for (let y = 0; y < size; y += 3) {
          this.seed += 0x6d2b79f5; // Preserve the color stream without computing height noise.
        }

        // 3. Layered Gouache Brushstrokes on the Paint Layer
        for (let i = 0; i < strokeCount; i++) {
          const x = this.randRange(-30, size + 30);
          const y = this.randRange(-30, size + 30);

          let chosenColor = baseColor;
          if (secondaryColor && this.random() < 0.42) {
            chosenColor = secondaryColor;
          }
          if (accentColor && this.random() < 0.14) {
            chosenColor = accentColor;
          }
          chosenColor = this.varyColor(chosenColor, 0.022, 0.08, 0.085);

          let angle = this.randRange(-0.35, 0.35);
          let len = this.randRange(34, 78);
          let wid = this.randRange(10, 24);
          let curve = this.randRange(-0.25, 0.25);

          if (strokeStyle === 'wavy') {
            angle = Math.sin(x * 0.025 + y * 0.02) * 0.65 + this.randRange(-0.25, 0.25);
            len = this.randRange(28, 60);
            wid = this.randRange(9, 19);
            curve = this.randRange(-0.38, 0.38);
          } else if (strokeStyle === 'directional') {
            angle = this.randRange(-0.18, 0.18);
            len = this.randRange(45, 92);
            wid = this.randRange(11, 22);
          } else if (strokeStyle === 'coarse') {
            angle = this.randRange(-0.5, 0.5);
            len = this.randRange(38, 84);
            wid = this.randRange(14, 28);
          }

          drawColorOnlyStroke.call(this,pCtx, x, y, len, wid, angle, chosenColor, {
            bristles: 10,
            curve,
            dryBrush: i > strokeCount * 0.72
          });

          // Seamless edge wrapping
          if (x < 60) {
            drawColorOnlyStroke.call(this,pCtx, x + size, y, len, wid, angle, chosenColor, { curve });
          } else if (x > size - 60) {
            drawColorOnlyStroke.call(this,pCtx, x - size, y, len, wid, angle, chosenColor, { curve });
          }
        }

        // 4. Optional Hand-Painted Dry-Brush Gradient (e.g., Fox white snout transition)
        if (gradientTip) {
          const tipColor = gradientTip.color || '#edeae2';
          for (let i = 0; i < 220; i++) {
            const progress = Math.pow(this.random(), 1.55);
            const gx = progress * size * 0.62;
            const gy = this.randRange(0, size);
            const len = this.randRange(28, 68);
            const wid = this.randRange(8, 20);
            const angle = this.randRange(-0.22, 0.22);
            drawColorOnlyStroke.call(this,pCtx, gx, gy, len, wid, angle, tipColor, {
              bristles: 8,
              dryBrush: true,
              opacity: this.randRange(0.65, 0.95) * (1 - progress * 0.5)
            });
          }
        }

        // Optional Gazelle / RimWorld flank stripe
        if (flankStripe) {
          for (let i = 0; i < 160; i++) {
            drawColorOnlyStroke.call(this,
              pCtx,
              this.randRange(0, size),
              this.randRange(size * 0.65, size),
              this.randRange(40, 80),
              this.randRange(14, 26),
              this.randRange(-0.15, 0.15),
              flankStripe.bellyColor || '#ede8df'
            );
          }
          for (let i = 0; i < 110; i++) {
            drawColorOnlyStroke.call(this,
              pCtx,
              this.randRange(0, size),
              this.randRange(size * 0.50, size * 0.67),
              this.randRange(36, 70),
              this.randRange(11, 20),
              this.randRange(-0.15, 0.15),
              flankStripe.stripeColor || '#38261a'
            );
          }
        }

        referencePaintCapture.get(this)?.('pigment', paintCanvas); // Color-only separation.
        // 5. Imperfect Paint Filling on Contours (Absence of paint near surface borders!)
        // Instead of painting cardboard-colored strokes, we build a paint coverage mask
        // where brushstrokes stop imperfectly before reaching the border, leaving the raw
        // unpainted Kraft cardboard canvas visible underneath.
        const imp = kraftEdgeWear ? this.fillImperfectionAmount : 0;
        if (imp > 0.01) {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = size;
          maskCanvas.height = size;
          const mCtx = maskCanvas.getContext('2d')!;

          const maxMargin = Math.round(imp * 44);
          const innerPad = Math.max(2, Math.round(maxMargin * 0.32));

          // Interior of the surface is covered by paint
          mCtx.fillStyle = '#ffffff';
          mCtx.fillRect(maxMargin, maxMargin, size - maxMargin * 2, size - maxMargin * 2);

          // Along the contour zone, the paint coverage is formed only by gouache strokes
          // that stopped short of the edge (leaving unpainted cardboard gaps at the border)
          const borderStrokeCount = Math.round(180 + (1 - imp) * 140);
          for (let i = 0; i < borderStrokeCount; i++) {
            const side = i % 4;
            const reach = innerPad + Math.pow(this.random(), 0.75) * (maxMargin - innerPad + 10);
            const sLen = this.randRange(36, 88);
            const sWid = this.randRange(12, 28);
            let bx = 0;
            let by = 0;
            let ang = 0;

            if (side === 0) {
              bx = this.randRange(innerPad, size - innerPad);
              by = reach + sWid * 0.4;
              ang = this.randRange(-0.22, 0.22);
            } else if (side === 1) {
              bx = this.randRange(innerPad, size - innerPad);
              by = size - reach - sWid * 0.4;
              ang = this.randRange(-0.22, 0.22);
            } else if (side === 2) {
              bx = reach + sWid * 0.4;
              by = this.randRange(innerPad, size - innerPad);
              ang = Math.PI * 0.5 + this.randRange(-0.22, 0.22);
            } else {
              bx = size - reach - sWid * 0.4;
              by = this.randRange(innerPad, size - innerPad);
              ang = Math.PI * 0.5 + this.randRange(-0.22, 0.22);
            }

            mCtx.save();
            mCtx.translate(bx, by);
            mCtx.rotate(ang);
            mCtx.fillStyle = '#ffffff';
            mCtx.beginPath();
            mCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, sWid, sWid * 0.45);
            mCtx.fill();
            mCtx.restore();
          }

          referencePaintCapture.get(this)?.('coverage', maskCanvas); // Color-only coverage.
          // Clip the gouache paint layer & its bump layer with the paint coverage mask
          pCtx.globalCompositeOperation = 'destination-in';
          pCtx.drawImage(maskCanvas, 0, 0);
          pCtx.globalCompositeOperation = 'source-over';

        }

        // Composite the Gouache Paint Layer over the Raw Unpainted Kraft Cardboard Base
        ctx.drawImage(paintCanvas, 0, 0);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;


        const material = new THREE.MeshStandardMaterial({
          map: colorTex,
          bumpMap: null,
          bumpScale: 0.035,
          roughness: 0.88,
          metalness: 0.02,
          flatShading: true
        });

        material.userData = {
          colorCanvas,
          baseBumpScale: 0.035,
          config
        };

        return material;
      }

function createSelectiveEdgeMaterial(this:GouacheCardboardPainter,channels:{color:boolean;height:boolean}) {
        const w = 512;
        const h = 128;

        const colorCanvas=channels.color?document.createElement('canvas'):undefined;
        if(colorCanvas){colorCanvas.width=w;colorCanvas.height=h;}
        const ctx=colorCanvas?.getContext('2d')??undefined;
        if(colorCanvas&&!ctx)throw Error('Origami requires Canvas2D for edge color');

        const alphaCanvas = document.createElement('canvas');
        alphaCanvas.width = w;
        alphaCanvas.height = h;
        const aCtx = alphaCanvas.getContext('2d')!;

        const bumpCanvas=channels.height?document.createElement('canvas'):undefined;
        if(bumpCanvas){bumpCanvas.width=w;bumpCanvas.height=h;}
        const bCtx=bumpCanvas?.getContext('2d')??undefined;
        if(bumpCanvas&&!bCtx)throw Error('Origami requires Canvas2D for edge height');

        // 1. Pure, flat, unpainted Kraft cardboard substrate (NO brush strokes on the cardboard!)
        if(ctx){
        const kraftGrad = ctx.createLinearGradient(0, 0, 0, h);
        kraftGrad.addColorStop(0.0, '#b5895a');
        kraftGrad.addColorStop(0.22, '#c79d6e');
        kraftGrad.addColorStop(1.0, '#c29868');
        ctx.fillStyle = kraftGrad;
        ctx.fillRect(0, 0, w, h);
        }

        // Subtle matte paper pulp speckles (not brushstrokes)
        if(ctx)for (let i = 0; i < 380; i++) {
          const fx = this.randRange(0, w);
          const fy = this.randRange(0, h);
          const color=this.random() > 0.5 ? 'rgba(248, 228, 198, 0.16)' : 'rgba(90, 58, 28, 0.14)';
          const width=this.randRange(2, 7);
          ctx.fillStyle=color;ctx.fillRect(fx,fy,width,1.5);
        }
        else {
          // Only the shared brush alpha needs the seed after this unused
          // color preamble. Skip it in one exact addition for authored seeds.
          // Very large external seeds retain JS's original rounding sequence.
          const nextSeed=this.seed+1520*0x6d2b79f5;
          if(Number.isSafeInteger(this.seed)&&Number.isSafeInteger(nextSeed))this.seed=nextSeed;
          else for(let i=0;i<1520;i++)this.seed+=0x6d2b79f5;
        }

        // 2. Alpha Map: White = absence of paint (raw cardboard visible),
        // Black = covered by the polygon's gouache paint strokes reaching toward the contour.
        // Start with 100% unpainted cardboard near the edge, then stamp black gouache
        // brush strokes from the interior (y = h) reaching imperfectly toward the edge (y = 0).
        aCtx.fillStyle = '#ffffff';
        aCtx.fillRect(0, 0, w, h);

        // Interior beyond the contour margin is fully painted (black = alpha 0)
        aCtx.fillStyle = '#000000';
        aCtx.fillRect(0, h * 0.78, w, h * 0.25);

        // Gouache paint strokes from the surface interior stopping irregularly before the edge (y = 0)
        for (let i = 0; i < 420; i++) {
          const bx = this.randRange(-30, w + 30);
          // Strokes start in the painted interior and reach up toward y = 4..85
          const stopY = this.randRange(4, h * 0.72);
          const sLen = this.randRange(28, 76);
          const sWid = this.randRange(10, 26);
          const ang = this.randRange(-0.28, 0.28);

          aCtx.save();
          aCtx.translate(bx, stopY + sWid * 0.5);
          aCtx.rotate(ang);
          aCtx.fillStyle = '#000000';
          aCtx.beginPath();
          aCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, h, sWid * 0.45);
          aCtx.fill();
          aCtx.restore();

          // Seamless horizontal wrap
          if (bx < 50) {
            aCtx.save();
            aCtx.translate(bx + w, stopY + sWid * 0.5);
            aCtx.rotate(ang);
            aCtx.fillStyle = '#000000';
            aCtx.beginPath();
            aCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, h, sWid * 0.45);
            aCtx.fill();
            aCtx.restore();
          }
        }

        // 3. Bump Map: Unpainted cardboard is recessed (dark gray) compared to the painted surface (light gray)
        if(bCtx){
        bCtx.fillStyle = 'rgb(165, 165, 165)';
        bCtx.fillRect(0, 0, w, h);
        bCtx.globalCompositeOperation = 'difference';
        bCtx.drawImage(alphaCanvas, 0, 0);
        bCtx.globalCompositeOperation = 'source-over';
        }

        const colorTex=colorCanvas?new THREE.CanvasTexture(colorCanvas):null;
        if(colorTex){colorTex.colorSpace=THREE.SRGBColorSpace;colorTex.wrapS=THREE.RepeatWrapping;colorTex.wrapT=THREE.ClampToEdgeWrapping;}

        const alphaTex = new THREE.CanvasTexture(alphaCanvas);
        alphaTex.wrapS = THREE.RepeatWrapping;
        alphaTex.wrapT = THREE.ClampToEdgeWrapping;

        const bumpTex=bumpCanvas?new THREE.CanvasTexture(bumpCanvas):null;
        if(bumpTex){bumpTex.wrapS=THREE.RepeatWrapping;bumpTex.wrapT=THREE.ClampToEdgeWrapping;}

        return new THREE.MeshStandardMaterial({
          map: colorTex,
          alphaMap: alphaTex,
          bumpMap: bumpTex,
          bumpScale: 0.045,
          transparent: true,
          alphaTest: 0.06,
          roughness: 0.94,
          metalness: 0.0,
          flatShading: true,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        });
      }

export class GouacheCardboardPainter {
      seed: number;
      edgeWearAmount: number;
      fillImperfectionAmount: number;
      constructor() {
        this.seed = 1337;
        this.edgeWearAmount = 0.75;
        this.fillImperfectionAmount = 0.60;
      }

      random() {
        let t = (this.seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }

      randRange(min: number, max: number) {
        return min + this.random() * (max - min);
      }

      varyColor(hexColor: string, hueShift = 0.03, satShift = 0.08, lightShift = 0.09) {
        const col = new THREE.Color(hexColor);
        const hsl = { h: 0, s: 0, l: 0 };
        col.getHSL(hsl);
        hsl.h = (hsl.h + this.randRange(-hueShift, hueShift) + 1) % 1;
        hsl.s = Math.max(0, Math.min(1, hsl.s + this.randRange(-satShift, satShift)));
        hsl.l = Math.max(0.04, Math.min(0.96, hsl.l + this.randRange(-lightShift, lightShift)));
        col.setHSL(hsl.h, hsl.s, hsl.l);
        return `#${col.getHexString()}`;
      }

      drawGouacheStroke(ctx: CanvasRenderingContext2D, bumpCtx: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, angle: number, colorHex: string, options: ReferenceStrokeOptions = {}) {
        const bristles = options.bristles || 9;
        const curve = options.curve || this.randRange(-0.22, 0.22);
        const dryBrush = options.dryBrush || false;
        const opacity = options.opacity !== undefined ? options.opacity : this.randRange(0.78, 0.97);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        bumpCtx.save();
        bumpCtx.translate(x, y);
        bumpCtx.rotate(angle);

        for (let b = 0; b < bristles; b++) {
          const normB = b / (bristles - 1) - 0.5;
          const offsetY = normB * width + this.randRange(-1.2, 1.2);
          const bristleWidth = (width / bristles) * this.randRange(1.15, 1.75);
          const bristleLen = length * this.randRange(0.82, 1.08);
          const startX = -bristleLen * 0.5 + this.randRange(-3, 3);
          const endX = bristleLen * 0.5 + this.randRange(-4, 4);
          const ctrlY = offsetY + length * curve;

          if (dryBrush && this.random() < 0.25) continue;

          ctx.beginPath();
          ctx.moveTo(startX, offsetY);
          ctx.quadraticCurveTo(0, ctrlY, endX, offsetY + this.randRange(-2, 2));
          ctx.strokeStyle = this.varyColor(colorHex, 0.015, 0.05, 0.045);
          ctx.globalAlpha = opacity * (1 - Math.abs(normB) * 0.25);
          ctx.lineWidth = bristleWidth;
          ctx.lineCap = 'round';
          ctx.stroke();

          const ridgeVal = Math.floor(145 + (b % 2 === 0 ? 45 : -30) + this.randRange(-15, 15));
          bumpCtx.beginPath();
          bumpCtx.moveTo(startX, offsetY);
          bumpCtx.quadraticCurveTo(0, ctrlY, endX, offsetY);
          bumpCtx.strokeStyle = `rgb(${ridgeVal}, ${ridgeVal}, ${ridgeVal})`;
          bumpCtx.globalAlpha = 0.65;
          bumpCtx.lineWidth = Math.max(1, bristleWidth * 0.85);
          bumpCtx.lineCap = 'round';
          bumpCtx.stroke();
        }

        // Subtle thick paint edge pooling (gouache impasto rim)
        bumpCtx.beginPath();
        bumpCtx.arc(length * 0.42, 0, width * 0.36, 0, Math.PI * 2);
        bumpCtx.strokeStyle = 'rgb(215, 215, 215)';
        bumpCtx.globalAlpha = 0.35;
        bumpCtx.lineWidth = 1.8;
        bumpCtx.stroke();

        ctx.restore();
        bumpCtx.restore();
      }

      createGouacheMaterialSet(config: ReferencePaintConfig) {
        const {
          baseColor = '#c86428',
          secondaryColor = null,
          accentColor = null,
          strokeStyle = 'fur',
          strokeCount = 340,
          gradientTip = null,
          flankStripe = null,
          kraftEdgeWear = true
        } = config;

        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d')!;

        const bumpCanvas = document.createElement('canvas');
        bumpCanvas.width = size;
        bumpCanvas.height = size;
        const bumpCtx = bumpCanvas.getContext('2d')!;

        // 1. Raw Unpainted Kraft Cardboard Substrate (visible wherever paint is absent)
        ctx.fillStyle = '#c49a6c';
        ctx.fillRect(0, 0, size, size);

        // Unpainted cardboard sits slightly recessed (110) compared to thick gouache strokes (145+)
        bumpCtx.fillStyle = 'rgb(110, 110, 110)';
        bumpCtx.fillRect(0, 0, size, size);

        // Matte Cardboard Pulp & Corrugated Ribbing Grain on the raw substrate
        for (let y = 0; y < size; y += 3) {
          const rib = Math.sin(y * 0.35) * 4;
          const v = Math.floor(110 + rib + this.randRange(-4, 4));
          bumpCtx.fillStyle = `rgb(${v},${v},${v})`;
          bumpCtx.fillRect(0, y, size, 2);

          ctx.fillStyle = y % 6 === 0 ? 'rgba(255,245,225,0.04)' : 'rgba(55,35,15,0.04)';
          ctx.fillRect(0, y, size, 2);
        }
        for (let i = 0; i < 360; i++) {
          ctx.fillStyle = this.random() > 0.5 ? 'rgba(245,225,195,0.12)' : 'rgba(80,52,24,0.10)';
          ctx.fillRect(this.randRange(0, size), this.randRange(0, size), this.randRange(4, 18), 1.5);
        }
        referencePaintCapture.get(this)?.('paper', colorCanvas, bumpCanvas); // Read-only separation hook.

        // 2. Separate Gouache Paint Layer (so unpainted contours are a true absence of paint)
        const paintCanvas = document.createElement('canvas');
        paintCanvas.width = size;
        paintCanvas.height = size;
        const pCtx = paintCanvas.getContext('2d')!;

        const paintBumpCanvas = document.createElement('canvas');
        paintBumpCanvas.width = size;
        paintBumpCanvas.height = size;
        const pBumpCtx = paintBumpCanvas.getContext('2d')!;

        pCtx.fillStyle = baseColor;
        pCtx.fillRect(0, 0, size, size);

        pBumpCtx.fillStyle = 'rgb(134, 134, 134)';
        pBumpCtx.fillRect(0, 0, size, size);

        // Subtle cardboard ribbing showing through the gouache layer
        for (let y = 0; y < size; y += 3) {
          const rib = Math.sin(y * 0.35) * 5;
          const v = Math.floor(134 + rib + this.randRange(-4, 4));
          pBumpCtx.fillStyle = `rgb(${v},${v},${v})`;
          pBumpCtx.fillRect(0, y, size, 2);
        }

        // 3. Layered Gouache Brushstrokes on the Paint Layer
        for (let i = 0; i < strokeCount; i++) {
          const x = this.randRange(-30, size + 30);
          const y = this.randRange(-30, size + 30);

          let chosenColor = baseColor;
          if (secondaryColor && this.random() < 0.42) {
            chosenColor = secondaryColor;
          }
          if (accentColor && this.random() < 0.14) {
            chosenColor = accentColor;
          }
          chosenColor = this.varyColor(chosenColor, 0.022, 0.08, 0.085);

          let angle = this.randRange(-0.35, 0.35);
          let len = this.randRange(34, 78);
          let wid = this.randRange(10, 24);
          let curve = this.randRange(-0.25, 0.25);

          if (strokeStyle === 'wavy') {
            angle = Math.sin(x * 0.025 + y * 0.02) * 0.65 + this.randRange(-0.25, 0.25);
            len = this.randRange(28, 60);
            wid = this.randRange(9, 19);
            curve = this.randRange(-0.38, 0.38);
          } else if (strokeStyle === 'directional') {
            angle = this.randRange(-0.18, 0.18);
            len = this.randRange(45, 92);
            wid = this.randRange(11, 22);
          } else if (strokeStyle === 'coarse') {
            angle = this.randRange(-0.5, 0.5);
            len = this.randRange(38, 84);
            wid = this.randRange(14, 28);
          }

          this.drawGouacheStroke(pCtx, pBumpCtx, x, y, len, wid, angle, chosenColor, {
            bristles: 10,
            curve,
            dryBrush: i > strokeCount * 0.72
          });

          // Seamless edge wrapping
          if (x < 60) {
            this.drawGouacheStroke(pCtx, pBumpCtx, x + size, y, len, wid, angle, chosenColor, { curve });
          } else if (x > size - 60) {
            this.drawGouacheStroke(pCtx, pBumpCtx, x - size, y, len, wid, angle, chosenColor, { curve });
          }
        }

        // 4. Optional Hand-Painted Dry-Brush Gradient (e.g., Fox white snout transition)
        if (gradientTip) {
          const tipColor = gradientTip.color || '#edeae2';
          for (let i = 0; i < 220; i++) {
            const progress = Math.pow(this.random(), 1.55);
            const gx = progress * size * 0.62;
            const gy = this.randRange(0, size);
            const len = this.randRange(28, 68);
            const wid = this.randRange(8, 20);
            const angle = this.randRange(-0.22, 0.22);
            this.drawGouacheStroke(pCtx, pBumpCtx, gx, gy, len, wid, angle, tipColor, {
              bristles: 8,
              dryBrush: true,
              opacity: this.randRange(0.65, 0.95) * (1 - progress * 0.5)
            });
          }
        }

        // Optional Gazelle / RimWorld flank stripe
        if (flankStripe) {
          for (let i = 0; i < 160; i++) {
            this.drawGouacheStroke(
              pCtx,
              pBumpCtx,
              this.randRange(0, size),
              this.randRange(size * 0.65, size),
              this.randRange(40, 80),
              this.randRange(14, 26),
              this.randRange(-0.15, 0.15),
              flankStripe.bellyColor || '#ede8df'
            );
          }
          for (let i = 0; i < 110; i++) {
            this.drawGouacheStroke(
              pCtx,
              pBumpCtx,
              this.randRange(0, size),
              this.randRange(size * 0.50, size * 0.67),
              this.randRange(36, 70),
              this.randRange(11, 20),
              this.randRange(-0.15, 0.15),
              flankStripe.stripeColor || '#38261a'
            );
          }
        }

        referencePaintCapture.get(this)?.('pigment', paintCanvas, paintBumpCanvas); // Read-only separation hook.
        // 5. Imperfect Paint Filling on Contours (Absence of paint near surface borders!)
        // Instead of painting cardboard-colored strokes, we build a paint coverage mask
        // where brushstrokes stop imperfectly before reaching the border, leaving the raw
        // unpainted Kraft cardboard canvas visible underneath.
        const imp = kraftEdgeWear ? this.fillImperfectionAmount : 0;
        if (imp > 0.01) {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = size;
          maskCanvas.height = size;
          const mCtx = maskCanvas.getContext('2d')!;

          const maxMargin = Math.round(imp * 44);
          const innerPad = Math.max(2, Math.round(maxMargin * 0.32));

          // Interior of the surface is covered by paint
          mCtx.fillStyle = '#ffffff';
          mCtx.fillRect(maxMargin, maxMargin, size - maxMargin * 2, size - maxMargin * 2);

          // Along the contour zone, the paint coverage is formed only by gouache strokes
          // that stopped short of the edge (leaving unpainted cardboard gaps at the border)
          const borderStrokeCount = Math.round(180 + (1 - imp) * 140);
          for (let i = 0; i < borderStrokeCount; i++) {
            const side = i % 4;
            const reach = innerPad + Math.pow(this.random(), 0.75) * (maxMargin - innerPad + 10);
            const sLen = this.randRange(36, 88);
            const sWid = this.randRange(12, 28);
            let bx = 0;
            let by = 0;
            let ang = 0;

            if (side === 0) {
              bx = this.randRange(innerPad, size - innerPad);
              by = reach + sWid * 0.4;
              ang = this.randRange(-0.22, 0.22);
            } else if (side === 1) {
              bx = this.randRange(innerPad, size - innerPad);
              by = size - reach - sWid * 0.4;
              ang = this.randRange(-0.22, 0.22);
            } else if (side === 2) {
              bx = reach + sWid * 0.4;
              by = this.randRange(innerPad, size - innerPad);
              ang = Math.PI * 0.5 + this.randRange(-0.22, 0.22);
            } else {
              bx = size - reach - sWid * 0.4;
              by = this.randRange(innerPad, size - innerPad);
              ang = Math.PI * 0.5 + this.randRange(-0.22, 0.22);
            }

            mCtx.save();
            mCtx.translate(bx, by);
            mCtx.rotate(ang);
            mCtx.fillStyle = '#ffffff';
            mCtx.beginPath();
            mCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, sWid, sWid * 0.45);
            mCtx.fill();
            mCtx.restore();
          }

          referencePaintCapture.get(this)?.('coverage', maskCanvas); // Read-only separation hook.
          // Clip the gouache paint layer & its bump layer with the paint coverage mask
          pCtx.globalCompositeOperation = 'destination-in';
          pCtx.drawImage(maskCanvas, 0, 0);
          pCtx.globalCompositeOperation = 'source-over';

          pBumpCtx.globalCompositeOperation = 'destination-in';
          pBumpCtx.drawImage(maskCanvas, 0, 0);
          pBumpCtx.globalCompositeOperation = 'source-over';
        }

        // Composite the Gouache Paint Layer over the Raw Unpainted Kraft Cardboard Base
        ctx.drawImage(paintCanvas, 0, 0);
        bumpCtx.drawImage(paintBumpCanvas, 0, 0);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;

        const bumpTex = new THREE.CanvasTexture(bumpCanvas);
        bumpTex.wrapS = THREE.RepeatWrapping;
        bumpTex.wrapT = THREE.RepeatWrapping;

        const material = new THREE.MeshStandardMaterial({
          map: colorTex,
          bumpMap: bumpTex,
          bumpScale: 0.035,
          roughness: 0.88,
          metalness: 0.02,
          flatShading: true
        });

        material.userData = {
          colorCanvas,
          bumpCanvas,
          baseBumpScale: 0.035,
          config
        };

        return material;
      }

      // Creates the specialized Physical Edge-Wear & Unpainted Contour Material:
      // Rather than painting strokes of cardboard color, the texture is pure, flat,
      // unpainted Kraft cardboard (`colorCanvas`), and `alphaCanvas` masks out where
      // the polygon's gouache brushstrokes reached vs where paint is absent near the edge (v=0).
      createPhysicalEdgeWearMaterial() {
        const w = 512;
        const h = 128;

        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = w;
        colorCanvas.height = h;
        const ctx = colorCanvas.getContext('2d')!;

        const alphaCanvas = document.createElement('canvas');
        alphaCanvas.width = w;
        alphaCanvas.height = h;
        const aCtx = alphaCanvas.getContext('2d')!;

        const bumpCanvas = document.createElement('canvas');
        bumpCanvas.width = w;
        bumpCanvas.height = h;
        const bCtx = bumpCanvas.getContext('2d')!;

        // 1. Pure, flat, unpainted Kraft cardboard substrate (NO brush strokes on the cardboard!)
        const kraftGrad = ctx.createLinearGradient(0, 0, 0, h);
        kraftGrad.addColorStop(0.0, '#b5895a');
        kraftGrad.addColorStop(0.22, '#c79d6e');
        kraftGrad.addColorStop(1.0, '#c29868');
        ctx.fillStyle = kraftGrad;
        ctx.fillRect(0, 0, w, h);

        // Subtle matte paper pulp speckles (not brushstrokes)
        for (let i = 0; i < 380; i++) {
          const fx = this.randRange(0, w);
          const fy = this.randRange(0, h);
          ctx.fillStyle = this.random() > 0.5 ? 'rgba(248, 228, 198, 0.16)' : 'rgba(90, 58, 28, 0.14)';
          ctx.fillRect(fx, fy, this.randRange(2, 7), 1.5);
        }

        // 2. Alpha Map: White = absence of paint (raw cardboard visible),
        // Black = covered by the polygon's gouache paint strokes reaching toward the contour.
        // Start with 100% unpainted cardboard near the edge, then stamp black gouache
        // brush strokes from the interior (y = h) reaching imperfectly toward the edge (y = 0).
        aCtx.fillStyle = '#ffffff';
        aCtx.fillRect(0, 0, w, h);

        // Interior beyond the contour margin is fully painted (black = alpha 0)
        aCtx.fillStyle = '#000000';
        aCtx.fillRect(0, h * 0.78, w, h * 0.25);

        // Gouache paint strokes from the surface interior stopping irregularly before the edge (y = 0)
        for (let i = 0; i < 420; i++) {
          const bx = this.randRange(-30, w + 30);
          // Strokes start in the painted interior and reach up toward y = 4..85
          const stopY = this.randRange(4, h * 0.72);
          const sLen = this.randRange(28, 76);
          const sWid = this.randRange(10, 26);
          const ang = this.randRange(-0.28, 0.28);

          aCtx.save();
          aCtx.translate(bx, stopY + sWid * 0.5);
          aCtx.rotate(ang);
          aCtx.fillStyle = '#000000';
          aCtx.beginPath();
          aCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, h, sWid * 0.45);
          aCtx.fill();
          aCtx.restore();

          // Seamless horizontal wrap
          if (bx < 50) {
            aCtx.save();
            aCtx.translate(bx + w, stopY + sWid * 0.5);
            aCtx.rotate(ang);
            aCtx.fillStyle = '#000000';
            aCtx.beginPath();
            aCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, h, sWid * 0.45);
            aCtx.fill();
            aCtx.restore();
          }
        }

        // 3. Bump Map: Unpainted cardboard is recessed (dark gray) compared to the painted surface (light gray)
        bCtx.fillStyle = 'rgb(165, 165, 165)';
        bCtx.fillRect(0, 0, w, h);
        bCtx.globalCompositeOperation = 'difference';
        bCtx.drawImage(alphaCanvas, 0, 0);
        bCtx.globalCompositeOperation = 'source-over';

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.ClampToEdgeWrapping;

        const alphaTex = new THREE.CanvasTexture(alphaCanvas);
        alphaTex.wrapS = THREE.RepeatWrapping;
        alphaTex.wrapT = THREE.ClampToEdgeWrapping;

        const bumpTex = new THREE.CanvasTexture(bumpCanvas);
        bumpTex.wrapS = THREE.RepeatWrapping;
        bumpTex.wrapT = THREE.ClampToEdgeWrapping;

        return new THREE.MeshStandardMaterial({
          map: colorTex,
          alphaMap: alphaTex,
          bumpMap: bumpTex,
          bumpScale: 0.045,
          transparent: true,
          alphaTest: 0.06,
          roughness: 0.94,
          metalness: 0.0,
          flatShading: true,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        });
      }
    }


/** PRIVATE literal coverage block, extracted without changing its draw/RNG statements. */
function replayCoverageBlock(this:GouacheCardboardPainter,kraftEdgeWear:boolean):Uint8Array {
 const size=512;let coverageRgba:Uint8Array|undefined;
        const imp = kraftEdgeWear ? this.fillImperfectionAmount : 0;
        if (imp > 0.01) {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = size;
          maskCanvas.height = size;
          const mCtx = maskCanvas.getContext('2d')!;

          const maxMargin = Math.round(imp * 44);
          const innerPad = Math.max(2, Math.round(maxMargin * 0.32));

          // Interior of the surface is covered by paint
          mCtx.fillStyle = '#ffffff';
          mCtx.fillRect(maxMargin, maxMargin, size - maxMargin * 2, size - maxMargin * 2);

          // Along the contour zone, the paint coverage is formed only by gouache strokes
          // that stopped short of the edge (leaving unpainted cardboard gaps at the border)
          const borderStrokeCount = Math.round(180 + (1 - imp) * 140);
          for (let i = 0; i < borderStrokeCount; i++) {
            const side = i % 4;
            const reach = innerPad + Math.pow(this.random(), 0.75) * (maxMargin - innerPad + 10);
            const sLen = this.randRange(36, 88);
            const sWid = this.randRange(12, 28);
            let bx = 0;
            let by = 0;
            let ang = 0;

            if (side === 0) {
              bx = this.randRange(innerPad, size - innerPad);
              by = reach + sWid * 0.4;
              ang = this.randRange(-0.22, 0.22);
            } else if (side === 1) {
              bx = this.randRange(innerPad, size - innerPad);
              by = size - reach - sWid * 0.4;
              ang = this.randRange(-0.22, 0.22);
            } else if (side === 2) {
              bx = reach + sWid * 0.4;
              by = this.randRange(innerPad, size - innerPad);
              ang = Math.PI * 0.5 + this.randRange(-0.22, 0.22);
            } else {
              bx = size - reach - sWid * 0.4;
              by = this.randRange(innerPad, size - innerPad);
              ang = Math.PI * 0.5 + this.randRange(-0.22, 0.22);
            }

            mCtx.save();
            mCtx.translate(bx, by);
            mCtx.rotate(ang);
            mCtx.fillStyle = '#ffffff';
            mCtx.beginPath();
            mCtx.roundRect(-sLen * 0.5, -sWid * 0.5, sLen, sWid, sWid * 0.45);
            mCtx.fill();
            mCtx.restore();
          }

          coverageRgba=capturedRgba(maskCanvas);
        }

 return coverageRgba??new Uint8Array(512*512*4).fill(255);
}
export function replayReferenceCoverage(coverageSeed:number,fill:number,kraftEdgeWear=true):{coverageRgba:Uint8Array;seedAfter:number}{
 if(!Number.isSafeInteger(coverageSeed)||!Number.isFinite(fill)||fill<0||fill>1)throw Error('Exact checkpoint and normalized fill required');
 const painter=new GouacheCardboardPainter();painter.seed=coverageSeed;painter.fillImperfectionAmount=fill;
 const coverageRgba=replayCoverageBlock.call(painter,kraftEdgeWear);return{coverageRgba,seedAfter:painter.seed};
}
