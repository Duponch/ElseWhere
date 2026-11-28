import * as THREE from 'three/webgpu';
import {BoxMesh,configureBoxMaterial} from './BoxMesh';
import {GROUND_OVERLAY_RENDER_ORDER} from './ground-overlay-surfaces';
import {footprintCells} from '../sim/definitions';
import {knownCell256} from '../sim/exploration-visibility-256';
import {isPowerTransmitter} from '../sim/power-grid';
import type {World} from '../sim/types';

interface WireMark {x:number;z:number;sx:number;sz:number}
/** No physical model and no new cell owner. The electric overlay reveals
 * these paths while selecting/placing power equipment or removing it. */
export function hiddenConduitMarks382(w:World):WireMark[] {
 const hidden=w.structures.filter(s=>s.kind==='hidden-conduit'&&knownCell256(w,s.z*w.width+s.x));
 if(!hidden.length)return [];
 const transmitters=new Set<number>();
 for(const s of w.structures)if(isPowerTransmitter(s.kind))for(const cell of footprintCells(s)){
  const index=cell.z*w.width+cell.x;if(knownCell256(w,index))transmitters.add(index);
 }
 const marks:WireMark[]=[];
 for(const s of hidden){
  marks.push({x:s.x,z:s.z,sx:.19,sz:.19});
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]] as const){
   const x=s.x+dx,z=s.z+dz;if(x<0||z<0||x>=w.width||z>=w.height||!transmitters.has(z*w.width+x))continue;
   marks.push({x:s.x+.25*dx,z:s.z+.25*dz,sx:dx?.55:.11,sz:dz?.55:.11});
  }
 }
 return marks;
}

/** Lazily allocated only on entering the power overlay. One resident draw,
 * absent when hidden; no frame/tick scan and no per-conduit Object3D. */
export class HiddenConduitOverlay382 {
 private readonly material=new THREE.MeshBasicNodeMaterial({transparent:true,opacity:.72,depthTest:false,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
 private readonly base=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
 readonly mesh:BoxMesh;
 private signature='';
 private readonly matrix=new THREE.Matrix4();
 private readonly color=new THREE.Color(0x79c1c1);
 constructor(){configureBoxMaterial(this.material);this.mesh=new BoxMesh(this.base,this.material,16);this.mesh.renderOrder=GROUND_OVERLAY_RENDER_ORDER.deep+.5;this.mesh.activeCount=0;}
 hide():void {this.mesh.visible=false;}
 update(w:World):void {
  const marks=hiddenConduitMarks382(w),signature=marks.map(p=>`${p.x}:${p.z}:${p.sx}:${p.sz}`).join('|');
  if(signature!==this.signature){
   this.signature=signature;
   if(marks.length>this.mesh.instanceMatrix.count)this.mesh.allocate(this.base,2**Math.ceil(Math.log2(marks.length)));
   marks.forEach((p,i)=>{
    this.matrix.makeScale(p.sx,1,p.sz).setPosition(p.x,.09,p.z);this.mesh.setMatrixAt(i,this.matrix);this.mesh.setColorAt(i,this.color);
   });
   this.mesh.activeCount=marks.length;this.mesh.instanceMatrix.needsUpdate=true;this.mesh.colorBuffer.needsUpdate=true;this.mesh.computeBoundingSphere();
  }
  this.mesh.visible=marks.length>0;
 }
 dispose():void {this.mesh.removeFromParent();this.mesh.dispose();this.base.dispose();this.material.dispose();}
}
