/** CPU-only address publication over borrowed resident Resource fields. No frame
 * work, new vertex payload, model mutation or GPU address table. */
import * as THREE from 'three/webgpu';
import {attribute,float,vec3} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import type {TreeAssetCatalog} from '../origami/baked/trees/types';
import {PreparedSurfaceAdmissionRefusal,type PreparedSurfacePlan} from '../origami/baked/surfaces/PreparedSurfaceTypes';
import type {SharedSurfacePreparationStage} from './SharedSurfacePreparation';
import type {PreparedTextureAddress} from './PreparedTextureSurface';

/** Real final Resource inputs, shared by the product and cold main/shadow gate. */
export function resourceResolvedTextureInputs(_context:GraphicsStyleContext,treeLayers:THREE.Node<'float'>){
 const paint=attribute('origamiPaint','vec4'),code=paint.w.div(128).floor().mod(32),profile=paint.w.mod(128),color=attribute('color','vec3'),generic=code.greaterThanEqual(treeLayers),layer=generic.select(treeLayers.add(code.sub(treeLayers).mul(2)),code);
 return{preResolvedUv:true as const,scalarInkLayerBase:treeLayers,pastelUv:attribute('uv','vec2'),pastelFromSample:(sample:THREE.Node<'vec4'>)=>color.mul(sample.rgb),
  tint:generic.select(profile.greaterThan(0).select(color.div(paint.xyz.max(vec3(.00001))),color),color.div(paint.xyz.max(vec3(.00001)))),
  addressWithoutBook:():PreparedTextureAddress=>({uv:attribute('uv','vec2'),bodyLayer:layer,inkLayer:layer.add(1),format:generic.select(float(1),float(0))}),
 };
}

type Attribute=THREE.BufferAttribute&{array:Float32Array};
type RecordFields={geometry:THREE.BufferGeometry;uv:Attribute;paint:Attribute;surface:Attribute;wind:Attribute;basis:Attribute;count:number;pins:readonly Float32Array[];mode:'source'|'prepared';originalUv?:Uint32Array;originalW?:Uint32Array};
type Mutation={record:RecordFields;nextUv:Uint32Array;nextW:Uint32Array;undoUv:Uint32Array;undoW:Uint32Array;oldMode:RecordFields['mode'];oldOriginalUv:Uint32Array|undefined;oldOriginalW:Uint32Array|undefined;newOriginalUv:Uint32Array|undefined;newOriginalW:Uint32Array|undefined;uvChanged:boolean;wChanged:boolean};
const words=(a:Float32Array)=>new Uint32Array(a.buffer,a.byteOffset,a.length);
const floats=(a:Uint32Array)=>new Float32Array(a.buffer,a.byteOffset,a.length);
const same=(a:Uint32Array,b:Uint32Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const MAX_VARIANT=16777215,MAX_FACE=4095;
function attributeOf(g:THREE.BufferGeometry,name:string,size:number,count?:number):Attribute{
 const a=g.getAttribute(name);if(!(a instanceof THREE.BufferAttribute)||!(a.array instanceof Float32Array)||a.itemSize!==size||a.normalized||count!==undefined&&a.count!==count)throw new PreparedSurfaceAdmissionRefusal('Actual ordinary Resource '+name+' layout required');return a as Attribute;
}
function capture(g:THREE.BufferGeometry):RecordFields{
 const uv=attributeOf(g,'uv',2),count=uv.count,paint=attributeOf(g,'origamiPaint',4,count),surface=attributeOf(g,'surfaceUv',4,count),wind=attributeOf(g,'windRoot',3,count),basis=attributeOf(g,'windBasis',4,count);return{geometry:g,uv,paint,surface,wind,basis,count,pins:[uv.array,paint.array,surface.array,wind.array,basis.array],mode:'source'};
}
function assertFields(r:RecordFields):void{const fields=[['uv',r.uv],['origamiPaint',r.paint],['surfaceUv',r.surface],['windRoot',r.wind],['windBasis',r.basis]]as const;for(let i=0;i<fields.length;i++){const[name,a]=fields[i]!;if(r.geometry.getAttribute(name)!==a||a.count!==r.count||a.array!==r.pins[i])throw Error('Resident Resource address fields replaced during preparation');}}
function packedW(r:RecordFields):Uint32Array{const result=new Uint32Array(r.count),source=words(r.paint.array);for(let v=0;v<r.count;v++)result[v]=source[v*4+3]!;return result;}

export interface ResourceResolvedAddressPresentation {readonly plan:PreparedSurfacePlan|undefined;readonly variantIds:readonly number[];readonly representation:'pure'|'source';readonly gouache:boolean;readonly catalog:TreeAssetCatalog|undefined}
export interface ResourceResolvedAddressOptions {readonly changed:()=>void;readonly patch:(attribute:THREE.BufferAttribute,start:number,count:number)=>void;readonly publishTreeLayers:(layers:number)=>void;readonly maxCpuBytes?:number;readonly maxGeometries?:number}
/** Registry-owned stages borrow these arrays; the helper owns only originals
 * and temporary CPU words. Contributors are the actual existing chunk writers. */
export class ResourceResolvedAddresses {
 private readonly records=new Map<THREE.BufferGeometry,RecordFields>();private readonly contributions=new Map<unknown,readonly THREE.BufferGeometry[]>();
 private revision=0;private pending=false;private closed=false;private treeLayers=0;private publications=0;private restored=0;
 constructor(private readonly options:ResourceResolvedAddressOptions){}
 setResidents(key:unknown,geometries:readonly THREE.BufferGeometry[]):void{
  if(this.closed)throw Error('Resource address owner closed');const next=[...new Set(geometries)],old=this.contributions.get(key)??[];
  if(next.length===old.length&&next.every((g,i)=>g===old[i])){for(const g of next)assertFields(this.records.get(g)!);return;}
  if(this.pending)throw Error('Drain the current Resource address stage before changing resident geometry');
  const added=new Map<THREE.BufferGeometry,RecordFields>();for(const g of next){const previous=this.records.get(g);if(previous)assertFields(previous);else added.set(g,capture(g));}
  const prospective=new Map(this.contributions);if(next.length)prospective.set(key,Object.freeze(next));else prospective.delete(key);
  const live=new Set([...prospective.values()].flat()),retiring=[...this.records].filter(([g])=>!live.has(g));
  // Retain the original contributor graph and records if a435 restore fails.
  for(const[,r]of retiring)this.restoreTerminal(r);
  for(const[g]of retiring)this.records.delete(g);for(const[g,r]of added)this.records.set(g,r);
  if(next.length)this.contributions.set(key,Object.freeze(next));else this.contributions.delete(key);
  this.revision++;this.options.changed();
 }
 forget(key:unknown):void{if(this.contributions.has(key))this.setResidents(key,[]);}
 clear():void{if(this.pending)throw Error('Drain Resource address stages before reset');for(const r of this.records.values())this.restoreTerminal(r);this.records.clear();this.contributions.clear();this.revision++;if(!this.closed)this.options.changed();}
 private restoreTerminal(r:RecordFields):void{if(r.mode!=='prepared')return;assertFields(r);if(!r.originalUv||!r.originalW)throw Error('Original Resource address words unavailable');words(r.uv.array).set(r.originalUv);const paint=words(r.paint.array);for(let v=0;v<r.count;v++)paint[v*4+3]=r.originalW[v]!;this.mark(r.uv);this.mark(r.paint);r.mode='source';}
 private mark(a:Attribute):void{const old=a.updateRanges[0];if(old){old.start=0;old.count=a.array.length;a.updateRanges.splice(1);}else a.addUpdateRange(0,a.array.length);a.needsUpdate=true;this.options.patch(a,0,a.array.length);}
 stage(p:ResourceResolvedAddressPresentation,assertCurrent:()=>void):SharedSurfacePreparationStage{
  if(this.closed||this.pending)throw Error('Resource address publication unavailable');assertCurrent();const revision=this.revision,records=[...this.records.values()],prepared=p.gouache&&p.representation==='pure',oldLayers=this.treeLayers,layers=prepared?(p.catalog?.pageCount??0):oldLayers;
  for(const r of records)assertFields(r);let index:ReturnType<typeof prepareIndex>|undefined;
  if(prepared){if(!p.plan)throw Error('Actual admitted Resource plan required');p.plan.assertCurrent();p.catalog?.assertCurrent();if(!Number.isSafeInteger(layers)||layers<0||layers>32)throw new PreparedSurfaceAdmissionRefusal('Bounded exact Resource tree layer count required');if(layers+p.plan.pages.length>32)throw new PreparedSurfaceAdmissionRefusal('Resource address code exceeds five slot bits');}
  const existing=records.reduce((n,r)=>n+(r.originalUv?.byteLength??0)+(r.originalW?.byteLength??0),0),vertices=records.filter(r=>prepared||r.mode==='prepared').reduce((n,r)=>n+r.count,0),newOriginals=prepared?records.filter(r=>!r.originalUv).reduce((n,r)=>n+r.count*12,0):0,peak=existing+vertices*24+newOriginals+(prepared?p.plan!.tiles.length*37:0);
  if(prepared&&records.length>(this.options.maxGeometries??4096)||peak>(this.options.maxCpuBytes??64*1024*1024))throw new PreparedSurfaceAdmissionRefusal('Bounded Resource original/candidate/rollback address CPU budget refused');
  if(prepared)index=prepareIndex(p.plan!,p.variantIds);
  const mutations:Mutation[]=[];
  for(const r of records){if(!prepared&&r.mode==='source')continue;const undoUv=words(r.uv.array).slice(),undoW=packedW(r),originalUv=r.originalUv??undoUv,originalW=r.originalW??undoW,nextUv=prepared?new Uint32Array(r.count*2):originalUv,nextW=prepared?new Uint32Array(r.count):originalW;
   if(prepared){const uv=floats(nextUv),w=floats(nextW),original=floats(originalW);for(let v=0;v<r.count;v++){const packed=original[v]!;if(!Number.isSafeInteger(packed)||packed<0||packed>16777215)throw new PreparedSurfaceAdmissionRefusal('Original Resource packed metadata is not exact');const profile=packed%128,slot=Math.floor(packed/128)%32,face=Math.floor(packed/4096),rawX=r.surface.getZ(v),rawY=r.surface.getW(v);let code:number,u:number,t:number;
     if(slot<31){const row=p.catalog?.slots[slot];if(!row?.paletteBaked||!Number.isSafeInteger(row.layer)||row.layer<0||row.layer>=layers)throw new PreparedSurfaceAdmissionRefusal('Every actual named Resource slot needs a baked palette in the current catalog');code=row.layer;u=rawX;t=rawY;}
     else{if(r.wind.getZ(v)!==0)throw new PreparedSurfaceAdmissionRefusal('Continuous anonymous Resource trees require Source addressing');const variant=r.basis.getX(v);if(!Number.isSafeInteger(variant)||variant<0||variant>MAX_VARIANT||face>MAX_FACE)throw new PreparedSurfaceAdmissionRefusal('Actual Resource variant/face address unavailable');const at=lookup(index!,variant,face);code=layers+index!.pages[at]!;u=Math.fround(Math.fround(rawX*index!.coefficients[at*4]!)+index!.coefficients[at*4+2]!);t=Math.fround(Math.fround(rawY*index!.coefficients[at*4+1]!)+index!.coefficients[at*4+3]!);}
     if(code<0||code>31||!Number.isFinite(u)||!Number.isFinite(t))throw new PreparedSurfaceAdmissionRefusal('Finite bounded Resource resolved coordinates required');uv[v*2]=u;uv[v*2+1]=t;w[v]=profile+128*(code+32*face);
   }}
   mutations.push({record:r,nextUv,nextW,undoUv,undoW,oldMode:r.mode,oldOriginalUv:r.originalUv,oldOriginalW:r.originalW,newOriginalUv:prepared?originalUv:r.originalUv,newOriginalW:prepared?originalW:r.originalW,uvChanged:!same(nextUv,undoUv),wChanged:!same(nextW,undoW)});
  }
  let published=false,committed=false,rolledBack=false,disposed=false;this.pending=true;
  const current=()=>{assertCurrent();if(this.closed||revision!==this.revision)throw Error('Resident Resource addressing superseded');for(const r of records)assertFields(r);if(prepared){p.plan!.assertCurrent();p.catalog?.assertCurrent();}};
  const restore=()=>{if(committed)throw Error('Committed Resource coordinates cannot roll back');if(!published||rolledBack)return;const errors:unknown[]=[];for(const m of mutations){try{words(m.record.uv.array).set(m.undoUv);const paint=words(m.record.paint.array);for(let v=0;v<m.record.count;v++)paint[v*4+3]=m.undoW[v]!;m.record.mode=m.oldMode;m.record.originalUv=m.oldOriginalUv;m.record.originalW=m.oldOriginalW;if(m.uvChanged)this.mark(m.record.uv);if(m.wChanged)this.mark(m.record.paint);}catch(error){errors.push(error);}}
   this.treeLayers=oldLayers;try{this.options.publishTreeLayers(oldLayers);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Resource coordinate rollback retains its stage');rolledBack=true;};
  return{publish:()=>{if(disposed||published||rolledBack)throw Error('Resource coordinate stage unavailable');current();published=true;for(const m of mutations){m.record.originalUv=m.newOriginalUv;m.record.originalW=m.newOriginalW;words(m.record.uv.array).set(m.nextUv);const paint=words(m.record.paint.array);for(let v=0;v<m.record.count;v++)paint[v*4+3]=m.nextW[v]!;m.record.mode=prepared?'prepared':'source';if(m.uvChanged)this.mark(m.record.uv);if(m.wChanged)this.mark(m.record.paint);}this.treeLayers=layers;this.options.publishTreeLayers(layers);this.publications++;if(!prepared&&mutations.length)this.restored++;},commit:()=>{if(!published||rolledBack||disposed)throw Error('Publish Resource coordinates before commit');current();committed=true;},rollback:restore,dispose:()=>{if(disposed)return;if(!committed&&!rolledBack)restore();disposed=true;this.pending=false;},stats:{scope:'CPU address mutation only',prepared,geometries:records.length,vertices,peakCpuBytes:peak,mutations:mutations.length}};
 }
 status(){return{pipeline:'resident-resolved-uv',revision:this.revision,geometries:this.records.size,vertices:[...this.records.values()].reduce((n,r)=>n+r.count,0),originalCpuBytes:[...this.records.values()].reduce((n,r)=>n+(r.originalUv?.byteLength??0)+(r.originalW?.byteLength??0),0),preparedGeometries:[...this.records.values()].filter(r=>r.mode==='prepared').length,treeLayers:this.treeLayers,pending:this.pending,publications:this.publications,restores:this.restored};}
 dispose():void{if(this.closed)return;if(this.pending)throw Error('Settle Resource coordinate stages before close');this.clear();this.closed=true;}
}

function prepareIndex(plan:PreparedSurfacePlan,ids:readonly number[]){
 if(ids.length!==plan.variants.length||ids.some(v=>!Number.isSafeInteger(v)||v<0||v>MAX_VARIANT)||new Set(ids).size!==ids.length)throw new PreparedSurfaceAdmissionRefusal('Exact admitted Resource variant IDs required');
 plan.pages.forEach((p,i)=>{if(p.format!=='bi'||p.bodyLayer!==i*2||p.inkLayer!==i*2+1)throw new PreparedSurfaceAdmissionRefusal('Resource compact codes require paired B/I pages');});
 const sourceKeys=new Float64Array(plan.tiles.length),order=new Uint32Array(plan.tiles.length);for(let i=0;i<plan.tiles.length;i++){const t=plan.tiles[i]!;if(!Number.isSafeInteger(t.variant)||t.variant<0||t.variant>=ids.length||!Number.isSafeInteger(t.face)||t.face<0||t.face>MAX_FACE||!plan.pages[t.page])throw new PreparedSurfaceAdmissionRefusal('Actual Resource tile address invalid');sourceKeys[i]=ids[t.variant]!*4096+t.face;order[i]=i;}order.sort((a,b)=>sourceKeys[a]!-sourceKeys[b]!);
 const keys=new Float64Array(order.length),coefficients=new Float32Array(order.length*4),pages=new Uint8Array(order.length);for(let i=0;i<order.length;i++){const at=order[i]!,t=plan.tiles[at]!,[u0,v0,u1,v1]=t.rawBounds,sx=t.content.width/(plan.size*(u1-u0)),sy=t.content.height/(plan.size*(v1-v0));keys[i]=sourceKeys[at]!;if(i&&keys[i]===keys[i-1])throw new PreparedSurfaceAdmissionRefusal('Duplicate Resource canonical variant/face address');coefficients.set([sx,sy,t.content.x/plan.size-u0*sx,t.content.y/plan.size-v0*sy],i*4);pages[i]=t.page;}
 return{keys,coefficients,pages,bytes:sourceKeys.byteLength+order.byteLength+keys.byteLength+coefficients.byteLength+pages.byteLength};
}
function lookup(index:ReturnType<typeof prepareIndex>,variant:number,face:number):number{const key=variant*4096+face;let low=0,high=index.keys.length;while(low<high){const middle=(low+high)>>>1;if(index.keys[middle]!<key)low=middle+1;else high=middle;}if(index.keys[low]!==key)throw new PreparedSurfaceAdmissionRefusal('Complete Resource resident variant/face coverage required');return low;}
