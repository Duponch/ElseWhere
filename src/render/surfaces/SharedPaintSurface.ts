/** One opaque surface graph, with texture encoding published as data. Geometry,
 * pose, lighting and material ownership never depend on a texture-style name. */
import type * as THREE from 'three/webgpu';
import {Fn,If,float,normalView,uv,varying,vec2,vec3} from 'three/tsl';
import type {GraphicsStyleContext} from '../graphics-style';
import {GENERIC_REFERENCE_PROFILE} from '../origami/reference-profiles';
import {physicalPaintMetric,applyPhysicalPaintMetric,referencePaintBumpNormal} from '../origami/paint-metric';
import {installGlobalReliefLod} from '../origami/relief-lod';

export interface SharedPaintSurfaceOptions {
 readonly context:GraphicsStyleContext|undefined;
 /** Untouched, authored base RGB. Generic paint modulates this value only. */
 readonly base:THREE.Node<'vec3'>;
 /** Complete original Pastel color expression, including its original UV map. */
 readonly pastel:THREE.Node<'vec3'>;
 readonly faceUv?:THREE.Node<'vec2'>;
 readonly profile?:THREE.Node<'float'>;
 readonly includeGeneric?:boolean;
 /** An exact caller-supplied vertex mapping may replace the rendered-triangle
  * metric. Non-affine wind/morphs keep the actual fragment metric by default. */
 readonly pigmentUv?:THREE.Node<'vec2'>;
 /** Clinical recoloring belongs to the body, before the painted stroke. */
 readonly gouacheTransform?:(body:THREE.Node<'vec3'>)=>THREE.Node<'vec3'>;
 readonly stroke?:(body:THREE.Node<'vec3'>)=>THREE.Node<'vec3'>;
}

function paintInputs(options:SharedPaintSurfaceOptions){
 const context=options.context!,suppliedUv=options.faceUv??uv(),raw=Reflect.get(suppliedUv,'isVaryingNode')===true?suppliedUv:varying(suppliedUv),resolved=options.profile?context.resolvedPaintIdsNode(options.profile):undefined,ids=resolved
  ?varying(Fn(()=>{const value=vec2(0).toVar();If(context.surfaceEncoding.greaterThan(0),()=>{value.assign(resolved);});return value;})()).setInterpolation('flat')
  :context.genericPaintIdsNode(true);
 const metric=physicalPaintMetric(raw).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal(),pigment=options.pigmentUv??applyPhysicalPaintMetric(raw,metric,density);
 return{raw,ids,metric,density,pigment};
}

function surfaceColor(options:SharedPaintSurfaceOptions,inputs:ReturnType<typeof paintInputs>):THREE.Node<'vec3'>{
 const context=options.context!,sample=context.facePaintNode(inputs.pigment,inputs.raw,inputs.ids.x,inputs.ids.y,context.reliefEnabled,true).toVar();
 let body:THREE.Node<'vec3'>=options.profile&&options.includeGeneric===false?sample.rgb:sample.rgb.mul(inputs.ids.x.equal(GENERIC_REFERENCE_PROFILE).select(options.base,vec3(1)));
 if(options.gouacheTransform)body=options.gouacheTransform(body);
 return options.stroke?options.stroke(body):body;
}

/** Actor callers can use the expression without changing their material class.
 * The uniform branch selects data encoding, not a renderer or model factory. */
export function sharedPaintColorNode(options:SharedPaintSurfaceOptions):THREE.Node<'vec3'>{
 if(!options.context)return options.pastel;
 const inputs=paintInputs(options),painted=surfaceColor(options,inputs);
 return Fn(()=>{const result=vec3(0).toVar();If(options.context!.surfaceEncoding.equal(0),()=>{result.assign(options.pastel);}).Else(()=>{result.assign(painted);});return result;})();
}

/** Keep the caller's position, exploration, shadow and lighting nodes intact.
 * Strict zero builds no bump graph or height lookup. Positive effects use the
 * same surface family and the original source height response. */
function configureSharedPaintSurface(material:THREE.NodeMaterial,options:SharedPaintSurfaceOptions):void{
 material.vertexColors=false;
 if(!options.context){material.colorNode=options.pastel;return;}
 const context=options.context,inputs=paintInputs(options),painted=surfaceColor(options,inputs);
 material.colorNode=Fn(()=>{const result=vec3(0).toVar();If(context.surfaceEncoding.equal(0),()=>{result.assign(options.pastel);}).Else(()=>{result.assign(painted);});return result;})();
 if(context.reliefEnabled){
  // Color and normal are independently built/gated graphs. Share their vertex
  // inputs, but not a lazily initialized fragment variable owned by the other
  // graph's branch. Each positive-relief probe shares this local metric.
  const metric=physicalPaintMetric(inputs.raw).toVar(),density=metric.x.mul(metric.z).max(1e-20).sqrt().reciprocal(),pigment=options.pigmentUv??applyPhysicalPaintMetric(inputs.raw,metric,density);
  const sample=context.facePaintNode(pigment,inputs.raw,inputs.ids.x,inputs.ids.y,true,true),dx=applyPhysicalPaintMetric(inputs.raw.dFdx(),metric,density),dy=applyPhysicalPaintMetric(inputs.raw.dFdy(),metric,density),
   hx=context.faceHeightNode(pigment.add(dx),inputs.raw.add(inputs.raw.dFdx()),inputs.ids.x,inputs.ids.y),hy=context.faceHeightNode(pigment.add(dy),inputs.raw.add(inputs.raw.dFdy()),inputs.ids.x,inputs.ids.y);
  const bumped=referencePaintBumpNormal(sample.a,hx,hy,context.impasto.mul(.035));
  material.normalNode=Fn(()=>{const result=vec3(normalView).toVar();If(context.surfaceEncoding.greaterThan(float(0)),()=>{result.assign(bumped);});return result;})();
  installGlobalReliefLod(material,context.reliefLod!);
 }else{material.normalNode=null;Reflect.set(material,'normalMap',null);Reflect.set(material,'bumpMap',null);}
}

const installed=new WeakMap<THREE.NodeMaterial,{options:SharedPaintSurfaceOptions;release:()=>void}>();
/** Feature boundaries can rebuild this same material's optional graph while
 * texture-style changes publish only uniforms/images. Disposal releases the
 * refresh callback; the context never retains a retired producer material. */
export function applySharedPaintSurface(material:THREE.NodeMaterial,options:SharedPaintSurfaceOptions):void{
 configureSharedPaintSurface(material,options);
 const previous=installed.get(material);
 if(previous&&previous.options.context===options.context){previous.options=options;return;}
 previous?.release();
 if(!options.context){installed.delete(material);return;}
 const entry={options,release:()=>{}};
 const unsubscribe=options.context.trackSharedSurfaceRefresh(()=>{configureSharedPaintSurface(material,entry.options);material.needsUpdate=true;});
 const dispose=()=>{if(installed.get(material)!==entry)return;entry.release();installed.delete(material);};
 entry.release=()=>{unsubscribe();material.removeEventListener('dispose',dispose);};
 installed.set(material,entry);
 material.addEventListener('dispose',dispose);
}
