/** Actual resource-template/affine identities are collected only by the existing
 * chunk writer, before its consuming merge. No World/camera/frame census. */
import * as THREE from 'three/webgpu';
import type {Placement} from '../primitives';
import type {PreparedSurfaceVariant,PreparedSurfaceModel} from '../origami/baked/surfaces/PreparedSurfaceTypes';
import {PreparedSurfaceAdmissionRefusal} from '../origami/baked/surfaces/PreparedSurfaceTypes';
const CAP=64*1024*1024;
function words(a:ArrayBufferView):Uint32Array{return new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4);}
function geometryKey(geometry:THREE.BufferGeometry):string{
 let a=2166136261,b=0x85ebca6b;for(const name of Object.keys(geometry.attributes).sort()){
  const attr=geometry.getAttribute(name);if(!(attr instanceof THREE.BufferAttribute)||!(attr.array instanceof Float32Array))throw new PreparedSurfaceAdmissionRefusal('Resource canonical ordinary float fields required');
  for(const c of name){a=Math.imul(a^c.charCodeAt(0),16777619)>>>0;}a=Math.imul(a^attr.itemSize,16777619)>>>0;
  for(const v of words(attr.array)){a=Math.imul(a^v,16777619)>>>0;b=Math.imul(b^(v+(a>>>7)),0x9e3779b1)>>>0;}
 }
 const index=geometry.index;if(index)for(let i=0;i<index.count;i++){const v=index.getX(i);a=Math.imul(a^v,16777619)>>>0;b=Math.imul(b^(v+(a>>>7)),0x9e3779b1)>>>0;}
 return a.toString(16)+':'+b.toString(16);
}
function sameGeometry(a:THREE.BufferGeometry,b:THREE.BufferGeometry):boolean{
 const names=Object.keys(a.attributes).sort(),other=Object.keys(b.attributes).sort();if(names.join('|')!==other.join('|'))return false;
 for(const name of names){const x=a.getAttribute(name),y=b.getAttribute(name);if(x.itemSize!==y.itemSize||x.count!==y.count||!(x.array instanceof Float32Array)||!(y.array instanceof Float32Array))return false;const X=words(x.array),Y=words(y.array);for(let i=0;i<X.length;i++)if(X[i]!==Y[i])return false;}
 if(!!a.index!==!!b.index||a.index?.count!==b.index?.count)return false;if(a.index&&b.index)for(let i=0;i<a.index.count;i++)if(a.index.getX(i)!==b.index.getX(i))return false;return true;
}
export class ResourcePreparedModels {
 private readonly canonical=new Map<string,{source:THREE.BufferGeometry;geometry:THREE.BufferGeometry;model:PreparedSurfaceModel}>();
 private readonly sourceKeys=new WeakMap<THREE.BufferGeometry,string>();
 /** Like sourceKeys, a captured source is unchanged while it is captured again
  * (one merge reads the same part template for every item). Its full collision
  * comparison with a given canonical record therefore runs once, not per item. */
 private readonly verified=new WeakMap<THREE.BufferGeometry,object>();
 private retained=0;private closed=false;
 constructor(private readonly register:(variant:PreparedSurfaceVariant)=>number){}
 capture(source:THREE.BufferGeometry,item:Placement,fullGrowthFactor=1):number{
  if(this.closed)throw Error('Resource canonical models closed');
  const position=source.getAttribute('position'),raw=source.getAttribute('surfaceFaceUv')??source.getAttribute('uv'),stroke=source.getAttribute('surfaceStrokeUv')??source.getAttribute('uv'),faces=source.getAttribute('surfaceStrokeFace');
  if(!position||!raw||!stroke||!faces)throw new PreparedSurfaceAdmissionRefusal('Resource canonical face fields absent');
  const sx=item.sx??1,sy=item.sy??1,sz=item.sz??1,max=Math.max(Math.abs(sx),Math.abs(sy),Math.abs(sz));
  if(![sx,sy,sz,max,fullGrowthFactor].every(Number.isFinite)||max<=0||sx===0||sy===0||sz===0||fullGrowthFactor<1)throw new PreparedSurfaceAdmissionRefusal('Resource affine/growth bound not proved');
  let sourceKey=this.sourceKeys.get(source);if(!sourceKey){sourceKey=geometryKey(source);this.sourceKeys.set(source,sourceKey);}
  const sourcePaint=source.getAttribute('origamiPaint'),profile=item.profile,reference=new THREE.Color(profile===0?0xffffff:item.referenceColor??item.color??0xffffff),referenceWords=words(new Float32Array([reference.r,reference.g,reference.b])),key=JSON.stringify(['resource-canonical-v1',sourceKey,profile??'source-profiles',[...referenceWords]]);
  let record=this.canonical.get(key);
  if(record){if(this.verified.get(source)!==record){if(!sameGeometry(record.source,source))throw Error('Resource canonical geometry hash collision');this.verified.set(source,record);}}
  else{
   const sourceCopy=source.clone(),geometry=source.clone(),surface=new Float32Array(position.count*4),paint=new Float32Array(position.count*4),chart=new Float32Array(position.count*2);
   for(let v=0;v<position.count;v++){const face=faces.getX(v),id=profile??sourcePaint?.getW(v)??0;if(!Number.isSafeInteger(face)||face<0||face>=4096||!Number.isSafeInteger(id)||id<0||id>=128)throw new PreparedSurfaceAdmissionRefusal('Resource packed face/profile not exact');surface.set([raw.getX(v),raw.getY(v),stroke.getX(v),stroke.getY(v)],v*4);paint.set([reference.r,reference.g,reference.b,id+128*(31+32*face)],v*4);chart.set([stroke.getX(v),stroke.getY(v)],v*2);}
   geometry.setAttribute('surfaceUv',new THREE.BufferAttribute(surface,4));geometry.setAttribute('origamiPaint',new THREE.BufferAttribute(paint,4));geometry.setAttribute('resourceAtlasChart',new THREE.BufferAttribute(chart,2));
   const bytes=[sourceCopy,geometry].reduce((n,g)=>n+Object.values(g.attributes).reduce((m,a)=>m+a.array.byteLength,0)+(g.index?.array.byteLength??0),0);
   if(this.retained+bytes>CAP){sourceCopy.dispose();geometry.dispose();throw new PreparedSurfaceAdmissionRefusal('Resource canonical retained CPU budget refused');}
   const model:PreparedSurfaceModel={key,geometry,chartUvAttribute:'resourceAtlasChart',faceId:v=>Math.floor(paint[v*4+3]!/4096),assertCurrent:()=>{if(this.closed||geometry.getAttribute('surfaceUv')?.array!==surface||geometry.getAttribute('origamiPaint')?.array!==paint)throw Error('Resource canonical model changed');}};
   record={source:sourceCopy,geometry,model};this.canonical.set(key,record);this.retained+=bytes;
  }
  // Rigid translation/rotation cancel the exact normalized Gram. Uniform
  // growth cancels the same normalization; its full bound still sets density.
  const linear=[sx/max,0,0,0,sy/max,0,0,0,sz/max]as const,bound=max*fullGrowthFactor;
  return this.register({key:JSON.stringify(['resource-affine-v1',key,linear,bound]),model:record.model,linear,maxUniformScale:bound,format:'bi'});
 }
 stats(){return{models:this.canonical.size,cpuBytes:this.retained};}
 dispose():void{if(this.closed)return;const errors:unknown[]=[];for(const record of this.canonical.values())for(const geometry of[record.geometry,record.source])try{geometry.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Resource canonical model cleanup');this.canonical.clear();this.closed=true;}
}
