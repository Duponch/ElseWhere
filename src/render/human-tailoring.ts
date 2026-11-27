import * as THREE from 'three/webgpu';
import {attribute,float,Fn,If,positionGeometry,texture,vec2,varying} from 'three/tsl';
import {HUMAN_REFERENCE_SCALE} from './origami/human-geometry';
import {currentGraphicsStyle,type GraphicsStyleContext} from './graphics-style';
import {bindPersonalizedTexture} from './texture-personalization';

/** This is a small neutral paint chart, not an additional piece of clothing.
 * Both styles share these marks; actual garments still own their color. */
export const TSHIRT_PAINT_OUTFIT=7;
export const HUMAN_PAINT_CHARTS={
  plain:0,shirtFront:1,shirtBack:2,shirtSide:3,sleeve:4,tshirtFront:5,
  tunicFront:6,tunicBack:7,dusterLeft:8,dusterRight:9,dusterBack:10,
  dusterSide:11,parkaFront:12,parkaBack:13,parkaSide:14,hood:15,
  vestFront:16,vestBack:17,trouser:18,boot:19,face:20,skin:21,
  hair:22,hat:23,tuque:24,helmet:25,armorFront:26,armorBack:27,
  armorLimb:28,tunicHem:29,coatSleeve:30,tshirtSleeve:31,
} as const;
type Chart=keyof typeof HUMAN_PAINT_CHARTS;
type Point=readonly [number,number];
interface Mark {points:readonly Point[];width:number;shade:number;fill?:true}
const line=(shade:number,width:number,...points:Point[]):Mark=>({shade,width,points});
const patch=(shade:number,...points:Point[]):Mark=>({shade,width:0,points,fill:true});
function seam(...points:Point[]):Mark[]{return [line(.68,.045,...points),line(.91,.012,...points)];}
const buttons=(x:number,ys:number[]):Mark[]=>ys.map(y=>line(.45,.055,[x,y],[x+.005,y+.013]));
const pocket=(x:number,y:number,w:number,h:number):Mark[]=>[
  patch(.88,[x,y],[x+w,y],[x+w,y+h],[x,y+h]),
  ...seam([x,y+h],[x,y],[x+w*.52,y-.015],[x+w,y],[x+w,y+h]),
  line(.53,.045,[x-.02,y+h],[x+w+.02,y+h-.014]),
];
const belt=(y:number):Mark[]=>[patch(.64,[0,y-.035],[1,y-.045],[1,y+.035],[0,y+.04]),line(.86,.014,[0,y+.03],[1,y+.02])];
const hem=(y=.09):Mark[]=>[line(.74,.043,[0,y],[.48,y-.012],[1,y+.005])];
const lapel=(right:boolean):Mark[]=>{
  const point=(x:number,y:number):Point=>[right?1-x:x,y];
  return [
    patch(.72,point(.03,1),point(.42,.89),point(.66,.78),point(.36,.70),point(.58,.58),point(.11,.42)),
    ...seam(point(.42,.89),point(.66,.78),point(.36,.70),point(.58,.58),point(.11,.42)),
  ];
};
const charts:Readonly<Record<Chart,readonly Mark[]>>={
  plain:[],
  shirtFront:[
    patch(.45,[.34,1],[.66,1],[.5,.79]),
    patch(.74,[.32,.99],[.50,.79],[.27,.74],[.16,.91]),
    patch(.74,[.68,.99],[.50,.79],[.74,.74],[.85,.91]),
    patch(.86,[.47,.8],[.55,.8],[.55,.02],[.47,.02]),
    ...seam([.47,.79],[.49,.38],[.47,.03]),...buttons(.53,[.70,.53,.36,.19]),
    ...pocket(.68,.52,.20,.20),
    line(.80,.027,[.09,.30],[.25,.18],[.20,.09]),
    line(.84,.028,[.86,.20],[.77,.09]),...hem(),
  ],
  shirtBack:[...seam([0,.84],[.40,.78],[.60,.78],[1,.84]),line(.79,.033,[.46,.77],[.44,.52]),line(.83,.025,[.54,.77],[.56,.46]),...hem()],
  shirtSide:[...seam([.51,.91],[.48,.42],[.54,.09]),line(.77,.034,[.12,.35],[.4,.21]),...hem()],
  sleeve:[...hem(.12),line(.69,.04,[.68,.14],[.67,.39]),...buttons(.73,[.20]),line(.85,.035,[.10,.63],[.31,.46])],
  tshirtFront:[patch(.53,[.31,1],[.69,1],[.62,.89],[.50,.86],[.38,.89]),...seam([.30,.99],[.37,.86],[.5,.82],[.63,.86],[.70,.99]),line(.78,.035,[.09,.33],[.20,.20],[.18,.12]),line(.84,.035,[.9,.25],[.77,.12]),...hem()],
  tshirtSleeve:[...hem(.15),line(.84,.03,[.13,.59],[.33,.48])],
  tunicFront:[patch(.61,[.28,1],[.72,1],[.50,.77]),...seam([.22,.99],[.51,.73],[.76,.99]),line(.68,.043,[.20,.95],[.83,.48]),...belt(.30),line(.81,.05,[.09,.73],[.16,.59],[.31,.56])],
  tunicBack:[...seam([.2,.96],[.57,.69],[.81,.38]),...belt(.30),line(.72,.045,[.13,.32],[.09,.11]),line(.82,.035,[.75,.27],[.89,.12])],
  tunicHem:[...hem(.16),line(.70,.055,[.30,.94],[.37,.67],[.34,.14]),line(.77,.038,[.72,.92],[.64,.43],[.70,.16])],
  dusterLeft:[...lapel(true),...pocket(.09,.24,.46,.19),...buttons(.80,[.51,.39,.27]),line(.70,.04,[.83,.55],[.86,.07]),...hem()],
  dusterRight:[...lapel(false),...pocket(.45,.24,.46,.19),line(.56,.027,[.22,.48],[.32,.48]),line(.56,.027,[.22,.36],[.32,.36]),line(.56,.027,[.22,.24],[.32,.24]),line(.70,.04,[.14,.55],[.16,.07]),...hem()],
  dusterBack:[...seam([.04,.83],[.49,.74],[.95,.82]),...seam([.49,.74],[.49,.43],[.52,.05]),patch(.73,[.35,.44],[.64,.44],[.64,.38],[.35,.38]),...buttons(.61,[.411]),...hem()],
  dusterSide:[...seam([.49,.94],[.42,.56],[.48,.38],[.51,.08]),line(.8,.046,[.18,.40],[.43,.31]),...hem()],
  parkaFront:[patch(.76,[.45,1],[.56,1],[.57,.02],[.43,.02]),...seam([.5,1],[.49,.03]),...buttons(.54,[.79,.64,.49,.34,.18]),...seam([.08,.77],[.4,.72]),...seam([.61,.72],[.92,.77]),...pocket(.08,.18,.27,.23),...pocket(.65,.18,.27,.23),...hem(.12)],
  parkaBack:[...seam([.05,.75],[.51,.68],[.95,.75]),...seam([.08,.46],[.51,.42],[.92,.46]),...hem(.12),line(.83,.038,[.15,.66],[.19,.53]),line(.83,.038,[.85,.66],[.81,.53])],
  parkaSide:[...seam([.05,.73],[.95,.73]),...seam([.48,.94],[.50,.12]),...hem(.12)],
  coatSleeve:[...seam([.05,.64],[.95,.64]),...seam([0,.36],[1,.36]),patch(.76,[0,.01],[1,.01],[1,.19],[0,.19]),...buttons(.70,[.1])],
  hood:[...seam([.05,.97],[.16,.65],[.14,.19],[.04,.06]),line(.83,.05,[.5,.95],[.50,.35],[.55,.14]),...hem(.12)],
  vestFront:[patch(.68,[.42,.99],[.59,.99],[.59,.04],[.42,.04]),...seam([.5,.99],[.50,.03]),...pocket(.05,.57,.35,.24),...pocket(.60,.57,.35,.24),patch(.66,[.02,.17],[.40,.17],[.4,.34],[.02,.34]),patch(.66,[.60,.17],[.98,.17],[.98,.34],[.60,.34]),...buttons(.55,[.43,.25])],
  vestBack:[patch(.74,[.08,.15],[.92,.15],[.92,.82],[.08,.82]),...seam([.08,.15],[.92,.15],[.92,.82],[.08,.82],[.08,.15]),...seam([.08,.49],[.91,.49])],
  trouser:[...seam([.14,.99],[.15,.68],[.19,.51],[.14,.30],[.16,.06]),line(.79,.045,[.76,.98],[.79,.68],[.71,.60]),line(.85,.045,[.39,.65],[.54,.51],[.45,.45]),line(.77,.035,[.86,.28],[.69,.18]),...hem(.045)],
  boot:[patch(.58,[0,0],[1,0],[1,.20],[0,.19]),line(.83,.038,[0,.21],[1,.21]),line(.60,.07,[.04,.51],[.96,.51]),line(.79,.028,[.32,.7],[.70,.70])],
  face:[patch(.91,[.16,.37],[.33,.40],[.35,.30],[.2,.28]),patch(.91,[.84,.37],[.67,.40],[.65,.30],[.8,.28]),line(.67,.027,[.36,.23],[.5,.215],[.64,.23]),line(.9,.025,[.45,.52],[.43,.39])],
  skin:[line(.95,.075,[.28,.23],[.6,.42]),line(.92,.04,[.18,.34],[.32,.47])],
  hair:[line(.59,.045,[.19,1],[.12,.63],[.23,.30],[.19,0]),line(.75,.031,[.45,1],[.36,.61],[.43,.27],[.39,0]),line(.62,.038,[.71,1],[.66,.59],[.72,.18],[.65,0]),line(.86,.027,[.87,1],[.84,.50],[.91,0])],
  hat:[patch(.65,[0,.02],[1,.02],[1,.19],[0,.19]),line(.84,.028,[0,.2],[1,.2]),line(.77,.043,[.10,.61],[.25,.71],[.42,.68])],
  tuque:[...Array.from({length:7},(_,i)=>line(.75,.038,[(i+1)/8,.02],[(i+1)/8+.025,.49],[(i+1)/8,.98])),patch(.76,[0,.02],[1,.02],[1,.2],[0,.19]),line(.63,.045,[0,.21],[1,.21])],
  helmet:[...hem(.10),line(.71,.035,[.15,.15],[.17,.50],[.26,.82]),line(.82,.037,[.85,.12],[.83,.54],[.74,.84]),...buttons(.1,[.23]),...buttons(.9,[.23])],
  armorFront:[patch(.77,[.08,.12],[.92,.12],[.83,.83],[.51,.98],[.16,.83]),...seam([.08,.12],[.92,.12],[.83,.83],[.51,.98],[.16,.83],[.08,.12]),...seam([.11,.37],[.88,.37]),...seam([.11,.55],[.88,.55]),...buttons(.15,[.19,.47,.76]),...buttons(.85,[.19,.47,.76])],
  armorBack:[patch(.78,[.14,.16],[.86,.16],[.86,.66],[.68,.88],[.32,.88],[.14,.66]),...seam([.14,.16],[.86,.16],[.86,.66],[.68,.88],[.32,.88],[.14,.66],[.14,.16]),...seam([.21,.47],[.79,.47])],
  armorLimb:[patch(.76,[0,.09],[1,.09],[1,.27],[0,.27]),...seam([.05,.30],[.95,.30]),...seam([.16,.38],[.18,.84],[.82,.84],[.85,.38]),...buttons(.16,[.21]),...buttons(.84,[.21])],
};

// 32px tiles with two texels of repeated-edge padding. Ordinary gameplay
// retains a single sample with mipmapping; detail blends away with distance.
const SIZE=256,TILE=32,PAD=2;
function distance(x:number,y:number,a:Point,b:Point):number{
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
}
function markCoverage(mark:Mark,x:number,y:number):number{
  const {points}=mark;
  if(mark.fill){
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i]!,b=points[j]!;
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside?1:0;
  }
  let d=Infinity;
  for(let i=1;i<points.length;i++)d=Math.min(d,distance(x,y,points[i-1]!,points[i]!));
  return Math.max(0,Math.min(1,(mark.width/2+.021-d)/.042));
}
export function humanChartTone(chart:Chart,x:number,y:number):number{
  let tone=1;
  for(const mark of charts[chart]){
    const coverage=markCoverage(mark,x,y);
    tone+=(mark.shade-tone)*coverage;
  }
  return tone;
}
const cachedPixels=new Map<boolean,Uint8Array>();
export function humanTailoringPixels(personalized=true):Uint8Array{
  const cached=cachedPixels.get(personalized);if(cached)return cached;
  const pixels=new Uint8Array(SIZE*SIZE*4).fill(255);
  for(const [name,chart]of Object.entries(HUMAN_PAINT_CHARTS) as [Chart,number][]){
    for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
      const u=Math.max(0,Math.min(1,(x-PAD)/(TILE-2*PAD-1)));
      const v=Math.max(0,Math.min(1,(y-PAD)/(TILE-2*PAD-1)));
      const tone=personalized?humanChartTone(name,u,v):1;
      const salt=Math.imul(x+97*(chart+1),0x1f123bb5)^Math.imul(y+83,0x5f356495);
      const grain=((salt>>>8)&255)/255-.5;
      const wash=.91+.06*Math.sin(u*7+v*3+chart)+.035*Math.sin(v*17-u*3)+grain*.09;
      const at=((Math.floor(chart/8)*TILE+y)*SIZE+chart%8*TILE+x)*4;
      pixels[at]=Math.round(Math.max(0,Math.min(1,wash*tone))*255);
      // Opaque brush variation competes with small stitching details in
      // Gouache. A stronger neutral ink keeps the collar and closures legible
      // through those existing pigment variations without another sample.
      pixels[at+1]=Math.round(tone*tone*255);
    }
  }
  cachedPixels.set(personalized,pixels);return pixels;
}
export function createHumanTailoringTexture(context:GraphicsStyleContext|undefined=currentGraphicsStyle()):THREE.DataTexture{
  const map=new THREE.DataTexture(humanTailoringPixels(context?.personalizedTextures??true),SIZE,SIZE,THREE.RGBAFormat);
  map.name='Shared human garment and skin paint charts';
  map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.needsUpdate=true;bindPersonalizedTexture(context,map,humanTailoringPixels);return map;
}

/** Only generic washes use a physical projection. Garment seams, face marks,
 * collars and pockets deliberately retain the complete authored silhouette.
 * Coordinates are bind-space, so a moving limb never swims through its ink. */
export function humanDetailUv(chart:Chart,uv:Point,p:readonly[number,number,number],n:readonly[number,number,number]):Point{
  if(chart!=='plain'&&chart!=='skin'&&chart!=='hair')return uv;
  const span=2*HUMAN_REFERENCE_SCALE,top=Math.abs(n[1])>.8,side=Math.abs(n[0])>Math.abs(n[2]);
  return [Math.max(0,Math.min(1,(top?p[0]:side?p[2]:p[0])/span+.5)),Math.max(0,Math.min(1,top?p[2]/span+.5:p[1]/span))];
}

/** Same classification in the portrait and the GPU's vertex stage. It never
 * interpolates a chart ID across different faces, nor allocates a UV stream. */
export function humanDetailChart(dye:number,bone:number,outfit:number,x:number,y:number,z:number,nx:number,ny:number,nz:number):Chart{
  if(Math.abs(ny)>.8)return dye>=100?'hair':'plain';
  const front=nz>.8,back=nz<-.8,side=!front&&!back;
  if(dye>=100)return 'hair';
  if(dye===2){
    if(bone===1&&front&&z<.19*HUMAN_REFERENCE_SCALE&&y>1.2*HUMAN_REFERENCE_SCALE)return 'face';
    return 'skin';
  }
  if(dye===1){
    if(outfit===0)return 'skin';
    if(bone>=2&&bone<=3)return outfit===2?'skin':outfit===3||outfit===4?'coatSleeve':outfit===TSHIRT_PAINT_OUTFIT?'tshirtSleeve':'sleeve';
    if(outfit===2)return front?'tunicFront':back?'tunicBack':'tunicBack';
    if(outfit===TSHIRT_PAINT_OUTFIT)return front?'tshirtFront':back?'shirtBack':'shirtSide';
    return front?'shirtFront':back?'shirtBack':'shirtSide';
  }
  if(dye===-3)return 'tunicHem';
  if(dye===-40)return front&&z>0?(x<0?'dusterLeft':'dusterRight'):back?'dusterBack':'dusterSide';
  if(dye===-41)return front?'parkaFront':back?'parkaBack':'parkaSide';
  if(dye===-6)return 'hood';
  if(dye===-2)return front?'vestFront':'vestBack';
  if(dye===0&&bone>=4)return 'trouser';
  if(dye===3&&bone>=4)return 'boot';
  if(dye===-43||dye===-44)return 'hat';
  if(dye===-10)return 'tuque';
  if(dye===-7||dye===-8||dye===-12)return 'helmet';
  if(dye===-11||dye===-42)return bone!==0?'armorLimb':front?'armorFront':side?'armorLimb':'armorBack';
  return 'plain';
}

/** The atlas mapping is a vertex expression. ActorTextureSurface uses it
 * directly for the pure single-fetch Pastel path, and interpolates only UV. */
export function humanTailoringUvNode(){
  const c=HUMAN_PAINT_CHARTS;
  return Fn(()=>{
    const p=positionGeometry,n=attribute('normal','vec3'),traits=attribute('pawnRigTraits','vec4'),dye=traits.y,bone=traits.x;
    const outfit=attribute('aEquipment','vec4').y,front=n.z.greaterThan(.8),back=n.z.lessThan(-.8);
    const chart=float(c.plain).toVar(),pick=(name:Chart)=>float(c[name]);
    If(n.y.abs().lessThanEqual(.8),()=>{
      If(dye.equal(2),()=>{
        chart.assign(pick('skin'));
        If(bone.equal(1).and(front).and(p.z.lessThan(.19*HUMAN_REFERENCE_SCALE)).and(p.y.greaterThan(1.2*HUMAN_REFERENCE_SCALE)),()=>{chart.assign(pick('face'));});
      }).ElseIf(dye.equal(1).and(outfit.equal(0)),()=>{chart.assign(pick('skin'));})
      .ElseIf(dye.equal(1),()=>{
        If(bone.greaterThanEqual(2).and(bone.lessThanEqual(3)),()=>{
          chart.assign(outfit.equal(2).select(pick('skin'),outfit.equal(3).or(outfit.equal(4)).select(pick('coatSleeve'),outfit.equal(TSHIRT_PAINT_OUTFIT).select(pick('tshirtSleeve'),pick('sleeve')))));
        }).Else(()=>{
          chart.assign(front.select(outfit.equal(2).select(pick('tunicFront'),outfit.equal(TSHIRT_PAINT_OUTFIT).select(pick('tshirtFront'),pick('shirtFront'))),outfit.equal(2).select(pick('tunicBack'),back.select(pick('shirtBack'),pick('shirtSide')))));
        });
      }).ElseIf(dye.equal(-3),()=>{chart.assign(pick('tunicHem'));})
        .ElseIf(dye.equal(-40),()=>{chart.assign(front.and(p.z.greaterThan(0)).select(p.x.lessThan(0).select(pick('dusterLeft'),pick('dusterRight')),back.select(pick('dusterBack'),pick('dusterSide'))));})
        .ElseIf(dye.equal(-41),()=>{chart.assign(front.select(pick('parkaFront'),back.select(pick('parkaBack'),pick('parkaSide'))));})
        .ElseIf(dye.equal(-6),()=>{chart.assign(pick('hood'));})
        .ElseIf(dye.equal(-2),()=>{chart.assign(front.select(pick('vestFront'),pick('vestBack')));})
        .ElseIf(dye.equal(0).and(bone.greaterThanEqual(4)),()=>{chart.assign(pick('trouser'));})
        .ElseIf(dye.equal(3).and(bone.greaterThanEqual(4)),()=>{chart.assign(pick('boot'));})
        .ElseIf(dye.equal(-43).or(dye.equal(-44)),()=>{chart.assign(pick('hat'));})
        .ElseIf(dye.equal(-10),()=>{chart.assign(pick('tuque'));})
        .ElseIf(dye.equal(-7).or(dye.equal(-8)).or(dye.equal(-12)),()=>{chart.assign(pick('helmet'));})
        .ElseIf(dye.equal(-11).or(dye.equal(-42)),()=>{chart.assign(bone.equal(0).select(front.select(pick('armorFront'),back.select(pick('armorBack'),pick('armorLimb'))),pick('armorLimb')));});
    });
    If(dye.greaterThanEqual(100),()=>{chart.assign(pick('hair'));});
    // The dried-body palette still shows its original ribs and skeletal
    // anatomy, with no painted garment left on that collapsed rig.
    If(attribute('aShape','vec4').x.div(10).floor().mod(10).greaterThan(1.5),()=>{chart.assign(pick('plain'));});
    const authored=attribute('origamiPaintUv','vec2'),top=n.y.abs().greaterThan(.8),side=n.x.abs().greaterThan(n.z.abs());
    const physical=vec2(top.select(p.x,side.select(p.z,p.x)).div(2*HUMAN_REFERENCE_SCALE).add(.5),top.select(p.z.div(2*HUMAN_REFERENCE_SCALE).add(.5),p.y.div(2*HUMAN_REFERENCE_SCALE))).clamp(0,1);
    const generic=chart.equal(c.plain).or(chart.equal(c.skin)).or(chart.equal(c.hair));
    const uv=generic.select(physical,authored).mul(TILE-2*PAD-1).add(PAD+.5);
    return vec2(chart.mod(8),chart.div(8).floor()).mul(TILE).add(uv).div(SIZE);
  })();
}
export const humanPastelShade=(sample:THREE.Node<'vec4'>)=>sample.r;
export const humanTailoringSample=(map:THREE.Texture)=>texture(map,varying(humanTailoringUvNode(),'v_humanTailoringUv'));

/** SVG portrait detail uses the same normalized brush drawing, clipped to
 * each true projected triangle by the cached portrait builder. */
export function humanChartSvg(chart:Chart):string{
  return charts[chart].map(mark=>{
    const points=mark.points.map(([x,y])=>`${x},${y}`).join(' '),opacity=(1-mark.shade).toFixed(3);
    return mark.fill?`<polyline points="${points}" fill="#201912" opacity="${opacity}"/>`:
      `<polyline points="${points}" fill="none" stroke="#201912" stroke-width="${mark.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
  }).join('');
}
