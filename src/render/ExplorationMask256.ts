/** One resident DATA mask; pigments and BoxMesh layouts remain unchanged. */
import * as THREE from 'three/webgpu';
import {attribute,convert,float,normalWorldGeometry,positionWorld,texture,uniform,varying,vec2} from 'three/tsl';
import {ExplorationField256} from './ExplorationField256';
import type {World} from '../sim/types';
export function actorExplorationMaterial256<T extends THREE.NodeMaterial>(material:T):T {material.userData.explorationActor=true;return material;}
// Continuous rock and ground carry their unknown pigment themselves. Props
// and actors retain their fragment/shadow visibility masks.
export function opaqueRockExplorationMaterial256<T extends THREE.NodeMaterial>(material:T):T {material.userData.explorationOpaqueRock=true;return material;}
/** Ground carries the unknown pigment in the ordinary terrain bake itself. */
export function opaqueGroundExplorationMaterial256<T extends THREE.NodeMaterial>(material:T):T {material.userData.explorationOpaqueGround=true;return material;}
/** Closed opaque props sample just inside their own surface, never the cell
 * beyond an exactly-on-the-grid wall face. Actors keep their owner mask. */
const solidOwners=new WeakMap<THREE.NodeMaterial,THREE.Node>();
export function solidExplorationMaterial256<T extends THREE.NodeMaterial>(material:T,owner?:THREE.Node):T {material.userData.explorationSolid=true;if(owner)solidOwners.set(material,owner);return material;}
export class ExplorationMask256 {
 readonly field=new ExplorationField256();
 /** Exact producer nodes for the private compiled-program contract; no graph mutation. */
 ownedObjectUniforms435():readonly THREE.Node[]{return [this.size,this.enabled];}
 readonly map=new THREE.DataTexture(this.field.data,1,1,THREE.RGBAFormat,THREE.UnsignedByteType);
 private readonly size=uniform(new THREE.Vector2(1,1));
 private readonly enabled=uniform(false);
 private readonly sample=texture(this.map);
 private readonly cell=positionWorld.xz.add(.5).floor();
 private readonly inside=this.cell.x.greaterThanEqual(0).and(this.cell.y.greaterThanEqual(0)).and(this.cell.x.lessThan(this.size.x)).and(this.cell.y.lessThan(this.size.y));
 private readonly seen=this.sample.sample(this.cell.add(.5).div(this.size)).level(float(0)).r.greaterThan(.5);
 private readonly visible=this.enabled.not().or(this.inside.not()).or(this.seen);
 /** Unknown ground must not reveal the private roof/lamp field either. */
 readonly knownGround=this.visible;
 private readonly configured=new WeakSet<THREE.NodeMaterial>();
 constructor(){
  this.map.minFilter=this.map.magFilter=THREE.NearestFilter;this.map.generateMipmaps=false;this.map.flipY=false;this.map.onUpdate=()=>this.map.clearUpdateRanges();this.map.needsUpdate=true;
 }
 /** Existing shader masks are composed, including alpha/selection cutouts.
  * Renderer r186 forwards maskShadowNode (or maskNode) to its shadow pass. */
 readonly configure=(material:THREE.NodeMaterial):void=>{
  if(this.configured.has(material)||material.userData.explorationIntent)return;
  if(material.userData.explorationOpaqueRock||material.userData.explorationOpaqueGround){this.configured.add(material);return;}
  const mask=material.maskNode,shadow=material.maskShadowNode??mask;
  let visible=this.visible;
  if(material.userData.explorationSolid){
   const owner=solidOwners.get(material);
   const cell=(owner?vec2(owner as ReturnType<typeof vec2>):positionWorld.xz.sub(normalWorldGeometry.xz.mul(.025))).add(.5).floor();
   const inside=cell.x.greaterThanEqual(0).and(cell.y.greaterThanEqual(0)).and(cell.x.lessThan(this.size.x)).and(cell.y.lessThan(this.size.y));
   const known=this.sample.sample(cell.add(.5).div(this.size)).level(float(0)).r.greaterThan(.5);
   visible=this.enabled.not().or(inside.not()).or(known);
  }
  if(material.userData.explorationActor){
   const anchor=varying(attribute('aTo','vec4').xz,'v_explorationOwner').add(.5).floor();
   const inside=anchor.x.greaterThanEqual(0).and(anchor.y.greaterThanEqual(0)).and(anchor.x.lessThan(this.size.x)).and(anchor.y.lessThan(this.size.y));
   const known=this.sample.sample(anchor.add(.5).div(this.size)).level(float(0)).r.greaterThan(.5);
   visible=visible.and(this.enabled.not().or(inside.not()).or(known));
  }
  material.maskNode=mask?new THREE.OperatorNode('&&',convert(mask,'bool'),visible):visible;
  material.maskShadowNode=shadow?new THREE.OperatorNode('&&',convert(shadow,'bool'),visible):visible;
  this.configured.add(material);material.needsUpdate=true;
 };
 /** Adopt an already composed clone without composing visibility a second
  * time. Colour may change; pose, masks and exploration ownership may not. */
 readonly adoptConfiguredClone=(source:THREE.NodeMaterial,next:THREE.NodeMaterial):boolean=>{
  if(source===next||!this.configured.has(source))return false;
  for(const key of ['positionNode','normalNode','maskNode','maskShadowNode','outputNode','opacityNode'] as const)if(source[key]!==next[key])return false;
  for(const key of ['explorationActor','explorationIntent','explorationOpaqueRock','explorationOpaqueGround','explorationSolid'])if(source.userData[key]!==next.userData[key])return false;
  const owner=solidOwners.get(source),other=solidOwners.get(next);if(other!==undefined&&other!==owner)return false;
  if(owner)solidOwners.set(next,owner);this.configured.add(next);return true;
 };
 /** Rare adoption/settings/preparation traversal covers unlit VFX and sprites.
  * Standard-material variants register at creation via EnvironmentLighting. */
 bind(root:THREE.Object3D):void {root.traverse(object=>{if(object instanceof THREE.Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])if(m instanceof THREE.NodeMaterial){if(object.geometry.getAttribute('aTo'))actorExplorationMaterial256(m);this.configure(m);}});}
 adopt(world:World,reset:boolean,changed:readonly number[]|null):boolean {
  const resized=this.field.width!==world.width||this.field.height!==world.height,dirty=this.field.adopt(world,reset,changed);
  this.enabled.value=this.field.enabled;
  if(!dirty)return false;
  if(resized){this.map.dispose();this.map.clearUpdateRanges();}this.map.image={data:this.field.data,width:this.field.width,height:this.field.height};this.size.value.set(this.field.width,this.field.height);
  for(const r of this.field.ranges)this.map.addUpdateRange(r.start,r.count);this.map.needsUpdate=true;
  return true;
 }
 dispose():void {this.map.dispose();}
}
