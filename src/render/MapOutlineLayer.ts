import * as THREE from 'three/webgpu';

/** A rectangle of map cells: its first cell and its size, in cells. */
export interface MapOutlineRect {x:number;z:number;width:number;height:number}
/** Width of the drawn edge, in cells. */
const EDGE=.1;
/** Above zone and area previews (.065–.08), below standing objects. */
const LIFT=.09;

/** Outline of a rectangle of map cells (Core GenDraw.DrawFieldEdges, white,
 * as the tutorial's Instruction_PlaceStockpile draws its target): four flat
 * strips just inside the rectangle's edge. One resident mesh, built once per
 * rectangle; nothing changes per frame. Presentation only: the rectangle
 * comes from the interface and nothing is written to the World. */
export class MapOutlineLayer {
  readonly material=new THREE.MeshBasicNodeMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  readonly mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.material);
  private shown:MapOutlineRect|undefined;
  private revision=0;
  constructor(){
    // Four strips of two triangles: 24 vertices, allocated once.
    this.mesh.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(24*3),3).setUsage(THREE.DynamicDrawUsage));
    this.mesh.geometry.setDrawRange(0,0);
    this.mesh.name='Map rectangle outline';this.mesh.renderOrder=7;this.mesh.visible=false;
  }
  /** The rectangle drawn now, clamped to the map, if any. */
  get rectangle():MapOutlineRect|undefined {return this.shown?{...this.shown}:undefined;}

  /** Draws the rectangle's outline, clamped to a map of the given size.
   * `lift` raises it above snow. An empty rectangle hides the outline. */
  show(rect:MapOutlineRect,mapWidth:number,mapHeight:number,lift=0):void {
    const x0=Math.max(0,Math.floor(rect.x)),z0=Math.max(0,Math.floor(rect.z));
    const x1=Math.min(mapWidth,Math.floor(rect.x)+Math.floor(rect.width)),z1=Math.min(mapHeight,Math.floor(rect.z)+Math.floor(rect.height));
    if(!(x1>x0&&z1>z0)||![x0,z0,x1,z1,lift].every(Number.isFinite)){this.hide();return;}
    this.revision++;this.shown={x:x0,z:z0,width:x1-x0,height:z1-z0};
    // Cell c covers [c − 0.5, c + 0.5] on each axis.
    const w=x0-.5,e=x1-.5,n=z0-.5,s=z1-.5,t=Math.min(EDGE,(e-w)/2,(s-n)/2),y=LIFT+lift;
    const positions=this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute,array=positions.array as Float32Array;
    let at=0;
    const strip=(ax:number,az:number,bx:number,bz:number)=>{for(const [px,pz] of [[ax,az],[bx,az],[bx,bz],[ax,az],[bx,bz],[ax,bz]] as const){array[at++]=px;array[at++]=y;array[at++]=pz;}};
    strip(w,n,e,n+t);strip(w,s-t,e,s);strip(w,n+t,w+t,s-t);strip(e-t,n+t,e,s-t);
    positions.needsUpdate=true;
    this.mesh.geometry.setDrawRange(0,24);this.mesh.geometry.computeBoundingSphere();this.mesh.visible=true;
  }
  hide():void {
    if(!this.shown&&!this.mesh.visible)return;
    this.revision++;this.shown=undefined;this.mesh.visible=false;this.mesh.geometry.setDrawRange(0,0);
  }
  /** Compiles the material behind the loading screen with the other layers. */
  prepareForCompile():()=>void {
    const revision=this.revision,visible=this.mesh.visible,culled=this.mesh.frustumCulled,count=this.mesh.geometry.drawRange.count;
    this.mesh.visible=true;this.mesh.frustumCulled=false;if(count===0)this.mesh.geometry.setDrawRange(0,6);
    return()=>{this.mesh.frustumCulled=culled;if(revision!==this.revision)return;this.mesh.visible=visible;this.mesh.geometry.setDrawRange(0,count);};
  }
  dispose():void {this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}
