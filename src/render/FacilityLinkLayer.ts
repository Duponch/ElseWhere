import * as THREE from 'three/webgpu';
import type {Cell} from '../sim/types';

/** Schema 355 facility links of the selected tool cabinet or bench, drawn like
 * Core's selection overlay: one thin ground strip per link between the two
 * footprint centers. Same material setup as the influence contour; geometry is
 * rewritten only when the selection or its links change, never per frame. */
export class FacilityLinkLayer {
  readonly material=new THREE.MeshBasicNodeMaterial({vertexColors:true,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  readonly mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.material);
  private capacity=0;
  private revision=0;
  private signature='';
  constructor(){this.mesh.name='Selected facility links';this.mesh.renderOrder=6;this.allocate(12);this.mesh.geometry.setDrawRange(0,0);this.mesh.visible=false;}
  private allocate(count:number):void {
    if(this.capacity)this.mesh.geometry.dispose();
    this.capacity=2**Math.ceil(Math.log2(Math.max(12,count)));
    for(const name of ['position','color'])this.mesh.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
  }
  update(segments:readonly (readonly [Cell,Cell])[],color=0xf4ecda):void {
    const signature=segments.map(([a,b])=>`${a.x},${a.z},${b.x},${b.z}`).join(';')+`:${color}`;
    if(signature===this.signature&&this.mesh.visible===segments.length>0)return;
    this.signature=signature;this.revision++;
    const vertices:number[]=[],colors:number[]=[],rgb=new THREE.Color(color),half=.05,y=.09;
    for(const [a,b] of segments){
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(!(length>0))continue;
      const nx=-dz/length*half,nz=dx/length*half;
      vertices.push(a.x+nx,y,a.z+nz,b.x+nx,y,b.z+nz,b.x-nx,y,b.z-nz,a.x+nx,y,a.z+nz,b.x-nx,y,b.z-nz,a.x-nx,y,a.z-nz);
      for(let i=0;i<6;i++)colors.push(rgb.r,rgb.g,rgb.b);
    }
    const count=vertices.length/3;
    if(count>this.capacity)this.allocate(count);
    for(const [name,values]of [['position',vertices],['color',colors]] as const){const attribute=this.mesh.geometry.getAttribute(name);(attribute.array as Float32Array).set(values);attribute.needsUpdate=true;}
    this.mesh.geometry.setDrawRange(0,count);this.mesh.geometry.computeBoundingSphere();this.mesh.visible=count>0;
  }
  hide():void {if(!this.mesh.visible&&!this.signature)return;this.revision++;this.signature='';this.mesh.visible=false;}
  prepareForCompile():()=>void {
    const revision=this.revision,visible=this.mesh.visible,culled=this.mesh.frustumCulled,count=this.mesh.geometry.drawRange.count;
    this.mesh.visible=true;this.mesh.frustumCulled=false;if(count===0)this.mesh.geometry.setDrawRange(0,6);
    return()=>{this.mesh.frustumCulled=culled;if(revision!==this.revision)return;this.mesh.visible=visible;this.mesh.geometry.setDrawRange(0,count);};
  }
  dispose():void {this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}
