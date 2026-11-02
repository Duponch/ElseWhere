import type {Node,NodeMaterial} from 'three/webgpu';
import {Fn,If,normalView,renderGroup,uniform,vec3} from 'three/tsl';

export interface GlobalReliefThresholds {
 /** Same pixel units as the already-published rig.pixelsPerCell value. */
 readonly disableAt:number;
 readonly enableAt:number;
}
export type GlobalReliefTier='full'|'flat';
/** Physical drawing pixels per world cell, after the renderer's real DPR cap.
 * Conservative hysteresis prevents rapid toggling around a zoom level. */
export const ORIGAMI_RELIEF_LOD_THRESHOLDS:Readonly<GlobalReliefThresholds>=Object.freeze({disableAt:48,enableAt:64});

/** One renderer-owned decision and one shared uniform. No actor,
 * geometry, texture, clock, simulation or renderer lifecycle is retained. */
export class GlobalReliefLod {
 readonly enabled=uniform(1).setName('origamiGlobalReliefEnabled').setGroup(renderGroup);
 private full=true;
 private readonly disableAt:number;
 private readonly enableAt:number;
 private readonly wrapped=new WeakMap<Node<'vec3'>,Node<'vec3'>>();
 constructor(thresholds:GlobalReliefThresholds=ORIGAMI_RELIEF_LOD_THRESHOLDS){
  const {disableAt,enableAt}=thresholds;
  if(!Number.isFinite(disableAt)||!Number.isFinite(enableAt)||disableAt<0||enableAt<=disableAt)throw Error('Finite ordered relief thresholds required');
  this.disableAt=disableAt;this.enableAt=enableAt;
 }
 get tier():GlobalReliefTier{return this.full?'full':'flat';}
 /** O(1), after controls and the existing pixelsPerCell calculation. Invalid
  * projection data and perspective conservatively select complete relief.
  * There is no iteration, allocation or uniform write for a stable tier. */
 update(mode:'orthographic'|'perspective',pixelsPerCell:number):boolean{
  let next=true;
  if(mode==='orthographic'&&Number.isFinite(pixelsPerCell)&&pixelsPerCell>0){
   next=this.full?pixelsPerCell>this.disableAt:pixelsPerCell>=this.enableAt;
  }
  if(next===this.full)return false;
  this.full=next;this.enabled.value=next?1:0;return true;
 }
 /** Install before compilation only. The exact source normal graph is the
  * branch body. Dedicated height probes remain inside the uniform branch;
  * the colour's shared RGBA sample is retained independently of this gate. */
 wrapNormal(original:Node<'vec3'>|null):Node<'vec3'>|null{
  if(original===null)return null;
  const cached=this.wrapped.get(original);if(cached)return cached;
  const wrapped=Fn(()=>{
   const result=normalView.toVar();
   If(this.enabled.greaterThan(.5),()=>{result.assign(vec3(original));});
   return result;
  })();
  this.wrapped.set(original,wrapped);this.wrapped.set(wrapped,wrapped);return wrapped;
 }
}

/** Caller passes context.reliefEnabled. In particular, preference impasto0
 * allocates no LOD owner, uniform, cache or wrapper graph at all. */
export function createGlobalReliefLod(reliefEnabled:boolean,thresholds:GlobalReliefThresholds=ORIGAMI_RELIEF_LOD_THRESHOLDS):GlobalReliefLod|undefined{
 return reliefEnabled?new GlobalReliefLod(thresholds):undefined;
}
export function installGlobalReliefLod(material:NodeMaterial,gate:GlobalReliefLod|undefined):void{
 if(!gate||material.normalNode===null)return;
 if(Reflect.get(material,'normalMap')||Reflect.get(material,'bumpMap'))throw Error('Relief gate requires no stock normal/bump-map fallback');
 // r186 declares this material slot as unparameterized Node; its semantic
 // output is the vec3 normal expected by setupNormal(). Narrow at that seam.
 material.normalNode=gate.wrapNormal(material.normalNode as Node<'vec3'>);material.needsUpdate=true;
}
