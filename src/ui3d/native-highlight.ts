import * as THREE from 'three/webgpu';
import {highlightOnlyWhileClosed,nativeHighlightTag} from '../ui/native-highlight-tags';

/** Core UIHighlighter.HighlightOpportunity: a pulse of 1.2 per second whose
 * brightness goes from 1 − 0.7 to 1 (Pulser.PulseBrightness). */
export const HIGHLIGHT_PULSE_FREQUENCY=1.2;
export const HIGHLIGHT_PULSE_AMPLITUDE=.7;
export function highlightPulse(seconds:number):number {
  const t=(1-Math.cos(seconds*Math.PI*2*HIGHLIGHT_PULSE_FREQUENCY))*.5;
  return 1-HIGHLIGHT_PULSE_AMPLITUDE+HIGHLIGHT_PULSE_AMPLITUDE*t;
}
/** Felt-pen ink outside, gouache marigold inside, in interface pixels. */
const INK='#261e18',GLOW='#ffcf52';
const GAP=3,INK_WIDTH=1.5,GLOW_WIDTH=3.5,PIXEL=.01;
/** Two rings of four mitred strips, two triangles each. */
const FRAME_VERTICES=48;

/** A native piece as the pass reads it: its cut size and state. */
export interface NativeHighlightPiece extends THREE.Object3D {
  userData:{[key:string]:unknown;w:number;h:number;depth?:number;nativeId?:unknown;active?:unknown;nativeHighlight?:unknown};
}
export interface NativeHighlightCandidate {
  piece:NativeHighlightPiece;
  control?:{id:string;active?:boolean;highlight?:string};
  /** A control painted inside a larger piece, in the piece's local units
   * (left and bottom edges, then size). */
  region?:{x:number;y:number;width:number;height:number};
}
interface Target {candidate:NativeHighlightCandidate;id:string;tag:string;closedOnly:boolean;local:Float32Array;matrix:THREE.Matrix4;visible:boolean}
/** Hides a target this frame (a page covers it, for instance). */
export type NativeHighlightCovered=(piece:NativeHighlightPiece,center:THREE.Vector3)=>boolean;

/** The pulse of highlighted native controls. One small scene drawn after the
 * cached interface: a single mesh holding the frames of every highlighted
 * control and a material whose opacity is the pulse (one uniform). The
 * retained interface image is never repainted for it, the frames' vertices
 * are rewritten only when a highlighted control moves, appears or hides, and
 * nothing is drawn while no tag is active. Controls are looked up only when
 * the tags, the pieces or the page change; each frame only follows the few
 * highlighted ones. Never reads or writes the World. */
export class NativeHighlightPass {
  readonly scene=new THREE.Scene();
  readonly material=new THREE.MeshBasicNodeMaterial({vertexColors:true,transparent:true,opacity:1,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  readonly mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.material);
  private readonly frames=new Map<string,Float32Array>();
  private tags:ReadonlySet<string>=new Set();
  private tagKey='';
  private targets:Target[]=[];
  private stale=true;
  private revision=Number.NaN;
  /** Frames in the buffer, in target order, and their matrices then. */
  private written:Target[]=[];
  private readonly writtenMatrices:THREE.Matrix4[]=[];
  private capacity=0;
  private uploads=0;
  private readonly center=new THREE.Vector3();
  private readonly offset=new THREE.Matrix4();
  private readonly vertex=new THREE.Vector3();

  constructor(){
    // The frames are written in interface (camera-parented) world space.
    this.scene.matrixWorldAutoUpdate=false;
    this.mesh.matrixAutoUpdate=false;this.mesh.frustumCulled=false;this.mesh.renderOrder=10;this.mesh.name='Native highlight frames';
    this.mesh.visible=false;this.scene.add(this.mesh);
  }

  /** Active tags, in any order. True when the set changed. */
  setTags(tags:readonly string[]):boolean {
    const next=[...new Set(tags.filter(tag=>typeof tag==='string'&&tag.length>0))].sort(),key=next.join('|');
    if(key===this.tagKey)return false;
    this.tagKey=key;this.tags=new Set(next);this.stale=true;
    if(!next.length)this.clearTargets();
    return true;
  }
  get active():boolean {return this.tags.size>0;}
  get activeTags():readonly string[] {return [...this.tags];}
  /** Controls were rebuilt (a page, its rows): look them up again. */
  invalidate():void {this.stale=true;}

  /** Looks controls up again when the tags, the piece revision or the page
   * changed; otherwise keeps the current targets. */
  sync(revision:number,enumerate:(visit:(candidate:NativeHighlightCandidate)=>void)=>void):void {
    if(!this.active||!this.stale&&revision===this.revision)return;
    this.stale=false;this.revision=revision;
    const next:Target[]=[];
    enumerate(candidate=>{
      const id=candidate.control?.id??(typeof candidate.piece.userData.nativeId==='string'?candidate.piece.userData.nativeId:'');
      const explicit=candidate.control?.highlight??(typeof candidate.piece.userData.nativeHighlight==='string'?candidate.piece.userData.nativeHighlight:undefined);
      const derived=id?nativeHighlightTag(id):undefined;
      const tag=explicit!==undefined&&this.tags.has(explicit)?explicit:derived!==undefined&&this.tags.has(derived)?derived:undefined;
      if(!tag)return;
      const local=this.frame(candidate.region?.width??candidate.piece.userData.w,candidate.region?.height??candidate.piece.userData.h);
      next.push({candidate,id,tag,closedOnly:highlightOnlyWhileClosed(tag),local,matrix:new THREE.Matrix4(),visible:false});
    });
    // The same controls rebound (a page refresh): keep the written frames.
    const same=next.length===this.targets.length&&next.every((target,index)=>{
      const old=this.targets[index]!;
      return old.candidate.piece===target.candidate.piece&&old.local===target.local&&old.tag===target.tag&&sameRegion(old.candidate.region,target.candidate.region);
    });
    if(same)this.targets.forEach((old,index)=>{const target=next[index]!;old.candidate=target.candidate;old.id=target.id;old.closedOnly=target.closedOnly;});
    else{this.targets=next;this.written=[];}
    if(this.frames.size>256)this.pruneFrames();
  }

  /** One frame: the pulse and the place of each visible highlighted control.
   * `root` is the interface scene: a detached or hidden control is skipped.
   * Returns the number of frames to draw. */
  update(seconds:number,root:THREE.Object3D,covered?:NativeHighlightCovered,reducedMotion=false):number {
    this.material.opacity=reducedMotion?1:highlightPulse(seconds);
    const shown:Target[]=[];
    for(const target of this.targets){
      const {piece,control,region}=target.candidate;
      let show=connected(piece,root)&&!(target.closedOnly&&(control?.active??piece.userData.active===true));
      if(show){
        const depth=typeof piece.userData.depth==='number'?piece.userData.depth:0;
        this.offset.makeTranslation(region?region.x+region.width/2:0,region?region.y+region.height/2:0,depth+.004);
        target.matrix.multiplyMatrices(piece.matrixWorld,this.offset);
        this.center.setFromMatrixPosition(target.matrix);
        show=!clipped(piece,this.center)&&!covered?.(piece,this.center);
      }
      target.visible=show;
      if(show)shown.push(target);
    }
    // Rewrite the vertices only when a frame appears, hides or moves.
    let changed=shown.length!==this.written.length;
    for(let i=0;!changed&&i<shown.length;i++)changed=shown[i]!==this.written[i]||!shown[i]!.matrix.equals(this.writtenMatrices[i]!);
    if(changed)this.write(shown);
    this.mesh.visible=shown.length>0;
    return shown.length;
  }

  /** Draws the visible frames over the current target, keeping its state. */
  render(renderer:THREE.WebGPURenderer,camera:THREE.Camera):void {
    if(!this.mesh.visible)return;
    const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),auto=renderer.autoClear;
    const mrt=renderer.getMRT(),renderObject=renderer.getRenderObjectFunction(),xr=renderer.xr.enabled;
    try{
      renderer.autoClear=false;renderer.setMRT(null);renderer.setRenderObjectFunction(null);renderer.xr.enabled=false;
      renderer.render(this.scene,camera);
    }finally{
      renderer.setRenderTarget(target,face,mip);renderer.autoClear=auto;renderer.setMRT(mrt);renderer.setRenderObjectFunction(renderObject);renderer.xr.enabled=xr;
    }
  }

  /** Highlighted controls now: id, tag and whether a frame is drawn; vertex
   * rewrites since creation. */
  get diagnostics():{tags:readonly string[];targets:{id:string;tag:string;visible:boolean}[];opacity:number;uploads:number} {
    return {tags:this.activeTags,targets:this.targets.map(target=>({id:target.id,tag:target.tag,visible:target.visible})),opacity:this.material.opacity,uploads:this.uploads};
  }

  dispose():void {
    this.clearTargets();this.frames.clear();
    this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();
  }

  private clearTargets():void {this.targets=[];this.written=[];this.revision=Number.NaN;this.mesh.visible=false;this.mesh.geometry.setDrawRange(0,0);}
  private write(shown:readonly Target[]):void {
    const count=shown.length*FRAME_VERTICES;
    if(count>this.capacity)this.allocate(count);
    const geometry=this.mesh.geometry,positions=geometry.getAttribute('position') as THREE.BufferAttribute,array=positions.array as Float32Array;
    shown.forEach((target,index)=>{
      const local=target.local,base=index*FRAME_VERTICES*3;
      for(let at=0;at<local.length;at+=3){this.vertex.set(local[at]!,local[at+1]!,local[at+2]!).applyMatrix4(target.matrix);array[base+at]=this.vertex.x;array[base+at+1]=this.vertex.y;array[base+at+2]=this.vertex.z;}
      (this.writtenMatrices[index]??=new THREE.Matrix4()).copy(target.matrix);
    });
    this.written=[...shown];
    positions.needsUpdate=true;geometry.setDrawRange(0,count);this.uploads++;
  }
  /** Room for `count` vertices (powers of two frames); colours repeat. */
  private allocate(count:number):void {
    this.capacity=FRAME_VERTICES*2**Math.ceil(Math.log2(Math.max(4,count/FRAME_VERTICES)));
    const colors=new Float32Array(this.capacity*3),pattern=framePattern();
    for(let at=0;at<colors.length;at+=pattern.length)colors.set(pattern,at);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    this.mesh.geometry.dispose();this.mesh.geometry=geometry;
  }
  /** Local vertices of the two rings around a w × h control. */
  private frame(w:number,h:number):Float32Array {
    const key=`${w.toFixed(4)}|${h.toFixed(4)}`;
    let frame=this.frames.get(key);
    if(frame)return frame;
    const positions:number[]=[];
    const ring=(inner:number,outer:number)=>{
      const ix=w/2+inner*PIXEL,iy=h/2+inner*PIXEL,ox=w/2+outer*PIXEL,oy=h/2+outer*PIXEL;
      const corners=[[-ix,-iy,-ox,-oy],[ix,-iy,ox,-oy],[ix,iy,ox,oy],[-ix,iy,-ox,oy]] as const;
      for(let side=0;side<4;side++){
        const a=corners[side]!,b=corners[(side+1)%4]!;
        positions.push(a[0],a[1],0,b[0],b[1],0,b[2],b[3],0,a[0],a[1],0,b[2],b[3],0,a[2],a[3],0);
      }
    };
    ring(GAP,GAP+GLOW_WIDTH);ring(GAP+GLOW_WIDTH,GAP+GLOW_WIDTH+INK_WIDTH);
    frame=new Float32Array(positions);
    this.frames.set(key,frame);
    return frame;
  }
  private pruneFrames():void {
    const used=new Set(this.targets.map(target=>target.local));
    for(const [key,frame] of this.frames)if(!used.has(frame))this.frames.delete(key);
  }
}

/** Colours of one frame: marigold ring then ink ring, 24 vertices each. */
let pattern:Float32Array|undefined;
function framePattern():Float32Array {
  if(pattern)return pattern;
  const glow=new THREE.Color(GLOW),ink=new THREE.Color(INK),values:number[]=[];
  for(let vertex=0;vertex<FRAME_VERTICES;vertex++){const color=vertex<FRAME_VERTICES/2?glow:ink;values.push(color.r,color.g,color.b);}
  return pattern=new Float32Array(values);
}
const sameRegion=(a:NativeHighlightCandidate['region'],b:NativeHighlightCandidate['region']):boolean=>a===b||!!a&&!!b&&a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
/** In the interface scene, with every ancestor visible. */
function connected(object:THREE.Object3D,root:THREE.Object3D):boolean {
  for(let node:THREE.Object3D|null=object;node;node=node.parent){if(!node.visible)return false;if(node===root)return true;}
  return false;
}
/** Outside an enabled clipping group of a scrolled page. */
function clipped(object:THREE.Object3D,point:THREE.Vector3):boolean {
  for(let node:THREE.Object3D|null=object;node;node=node.parent){
    const group=node as THREE.ClippingGroup;
    if(group.isClippingGroup&&group.enabled&&group.clippingPlanes.some(plane=>plane.distanceToPoint(point)<0))return true;
  }
  return false;
}
