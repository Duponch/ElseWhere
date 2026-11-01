import * as THREE from 'three/webgpu';
import {uniform,texture,uv,mix,vec2,vec3,normalMap} from 'three/tsl';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,normalizeGraphicsStylePreferences,type GraphicsStylePreferences} from '../ui3d/native-preferences';

/** Construction scope only. It is restored synchronously, before any await.
 * Every renderer retains its own context; one view cannot restyle another. */
let constructing:GraphicsStyleContext|undefined;
export function currentGraphicsStyle():GraphicsStyleContext|undefined{return constructing;}
export function withGraphicsStyle<T>(context:GraphicsStyleContext,create:()=>T):T{
 const previous=constructing;constructing=context;try{return create();}finally{constructing=previous;}
}
const hash=(x:number,y:number):number=>{let h=Math.imul(x+19,374761393)^Math.imul(y+71,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};

/** One small mipmapped paint atlas per renderer. RGBA packs the paint wash,
 * bristle gradients and interrupted contour. No live canvas,
 * per-part materials, edge meshes or texture upload during ordinary frames. */
function createGouacheAtlas():THREE.DataTexture{
 const size=256,data=new Uint8Array(size*size*4),height=new Float32Array(size*size),pigment=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const grain=hash(x,y),brush=Math.sin(x*.21+Math.sin(y*.047)*2.3),fibres=Math.sin(x*1.7+y*.027);
  const broad=Math.sin(x*.031+y*.023)*Math.sin(y*.041-x*.017);
  const dry=hash(Math.floor(x/3),Math.floor(y/17));
  const value=.82+broad*.10+brush*.055+fibres*.025+(grain-.5)*.07;
  const distance=Math.min(x,y,size-1-x,size-1-y)/size;
  const boundary=.012+(.5+.5*Math.sin((x+y)*.093))* .025+dry*.025;
  const at=(y*size+x)*4;
  pigment[y*size+x]=value;
  height[y*size+x]=.5+brush*.13+fibres*.10+(grain-.5)*.25;
  data[at+2]=Math.round(Math.max(0,Math.min(1,1-distance/Math.max(.001,boundary)))*255);
 }
 // The reference's curved, broken bristle strokes are rasterised once into
 // this shared neutral pigment field. Species/clothing colors stay in their
 // existing vertex/instance streams instead of requiring one atlas per hue.
 for(let stroke=0;stroke<170;stroke++){
  const cx=hash(stroke,31)*size,cy=hash(stroke,47)*size;
  const length=18+hash(stroke,59)*58,width=3+hash(stroke,67)*9;
  const angle=(hash(stroke,73)-.5)*1.4,c=Math.cos(angle),s=Math.sin(angle),curve=(hash(stroke,89)-.5)*.44*length;
  const shade=.61+hash(stroke,97)*.44;
  for(let bristle=0;bristle<9;bristle++){
   if(hash(stroke*9+bristle,101)<.13)continue;
   const offset=(bristle/8-.5)*width,reach=length*(.82+hash(stroke*9+bristle,107)*.26);
   const steps=Math.ceil(reach),ridge=.43+(bristle%2?.12:.30);
   for(let step=0;step<=steps;step++){
    const t=step/steps,along=(t-.5)*reach,across=offset+curve*2*t*(1-t);
    const x=Math.round(cx+along*c-across*s),y=Math.round(cy+along*s+across*c);
    const radius=bristle%3===0?1:0;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
     const px=(x+dx+size*2)%size,py=(y+dy+size*2)%size,index=py*size+px;
     if(hash(px+stroke,py+bristle)<.08)continue;
     const opacity=radius&&dx*dx+dy*dy>1?.17:.43;
     pigment[index]=pigment[index]!+(shade-pigment[index]!)*opacity;
     height[index]=height[index]!+(ridge-height[index]!)*opacity;
    }
   }
  }
 }
 // Bake signed height gradients so the fragment graph shares ONE RGBA read
 // between pigment and relief. A bumpMap would perform three height reads.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(y*size+x)*4;
  data[at]=Math.round(Math.max(0,Math.min(1,pigment[y*size+x]!))*255);
  const dx=height[y*size+(x+1)%size]!-height[y*size+(x+size-1)%size]!;
  const dy=height[((y+1)%size)*size+x]!-height[((y+size-1)%size)*size+x]!;
  data[at+1]=Math.round(Math.max(0,Math.min(1,.5-dx*.5))*255);
  data[at+3]=Math.round(Math.max(0,Math.min(1,.5-dy*.5))*255);
 }
 const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 map.name='Origami — gouache, bristles and kraft contour';map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 return map;
}
export class GraphicsStyleContext{
 preferences:GraphicsStylePreferences;
 readonly impasto=uniform(1);readonly edges=uniform(.65);readonly wear=uniform(.75);readonly contour=uniform(.60);
 private atlas?:THREE.DataTexture;
 constructor(settings:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES}){this.preferences=normalizeGraphicsStylePreferences(settings);this.update(settings);}
 get origami():boolean{return this.preferences.style==='origami';}
 update(settings:GraphicsStylePreferences):void{this.preferences=normalizeGraphicsStylePreferences(settings);this.impasto.value=this.preferences.impasto;this.edges.value=this.preferences.edges;this.wear.value=this.preferences.wear;this.contour.value=this.preferences.contourImperfection;}
 get paint():THREE.DataTexture{return this.atlas??=createGouacheAtlas();}
 dispose():void{this.atlas?.dispose();this.atlas=undefined;}
}

/** Explicitly used by textured variants only: disabling textures still selects
 * the existing pigment-free pipeline. It replaces the old pigment sample. */
function paintNode(base:THREE.Node<'vec3'>,sample:THREE.Node<'vec4'>,context:GraphicsStyleContext):THREE.Node<'vec3'>{
 const painted=base.mul(sample.r.mul(.72).add(.32));
 const kraft=vec3(.61,.43,.25).mul(sample.r.mul(.22).add(.78));
 const missing=sample.b.mul(context.contour.mul(.82).add(context.wear.mul(.18)));
 const fold=sample.b.pow(3).mul(context.edges).mul(.32);
 return mix(painted,kraft,missing.add(fold).clamp(0,1));
}
export function applyOrigamiSurface(material:THREE.NodeMaterial,base:THREE.Node<'vec3'>,coordinates:THREE.Node<'vec2'>=uv(),context=currentGraphicsStyle()):void{
 if(!context?.origami)return;
 const sample=texture(context.paint,coordinates);
 material.colorNode=paintNode(base,sample,context);
 material.normalNode=normalMap(vec3(sample.g,sample.a,1),vec2(context.impasto.mul(.3)));
}
