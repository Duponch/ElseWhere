/** The actual continuous Legacy cliff, with only its real face seams split.
 * Triangle order, corner positions, pigment and normals stay Source-exact.
 * Texture style is deliberately absent from this model and its sparse writer. */
import * as THREE from 'three/webgpu';
import type {World} from '../../sim/types';
import {ROCK_INDICES,ROCK_VERTICES,writeRockCell} from '../RockSurface';
import {writeRockPigment} from '../rock-pigment';

export const ROCK_SURFACE_UV='rockSurfaceUv';
export const ROCK_SURFACE_VERTICES=46; // top2 triangles, upper8 triangles, lower4 quads
export const ROCK_SURFACE_FACES=14;
export const ROCK_SLAB_VERTICES=24,ROCK_SLAB_INDICES=36,ROCK_SLAB_FACES=6;
const quadUv=[[0,0],[0,1],[1,1],[1,0]]as const;
const uvForCorner=(corner:number):readonly[number,number]=>[corner>=2?1:0,corner===1||corner===2?1:0];

export class RockSurfaceModel {
 readonly geometry=new THREE.BufferGeometry();
 /** Preparation-only view: global fixed triangle slots and borrowed static
  * attributes. Source brush generation selects only explicit halo groups. */
 readonly stock=new THREE.BufferGeometry();
 readonly rawPosition:Float32Array;readonly rawColor:Float32Array;
 private readonly topOrder:Uint8Array;
 private readonly paintFaces:Float32Array;
 private closed=false;
 constructor(readonly width:number,readonly height:number,readonly capacity:number){
  if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||!Number.isSafeInteger(capacity)||capacity<1)throw Error('Actual finite rock model bounds required');
  const vertices=ROCK_SLAB_VERTICES+capacity*ROCK_SURFACE_VERTICES;
  for(const name of ['position','normal','color'])this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(vertices*3),3));
  this.geometry.setAttribute(ROCK_SURFACE_UV,new THREE.BufferAttribute(new Float32Array(vertices*3),3));
  this.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(ROCK_SLAB_INDICES+capacity*ROCK_INDICES),1));
  this.stock.setIndex(new THREE.BufferAttribute(new Uint32Array(ROCK_SLAB_INDICES+capacity*ROCK_INDICES),1));
  for(const[name,a]of Object.entries(this.geometry.attributes))this.stock.setAttribute(name,a);
  this.rawPosition=new Float32Array(capacity*ROCK_VERTICES*3);this.rawColor=new Float32Array(capacity*ROCK_VERTICES*3);this.topOrder=new Uint8Array(capacity*6);this.topOrder.fill(255);this.paintFaces=Float32Array.from({length:capacity*ROCK_SURFACE_FACES},(_,i)=>ROCK_SLAB_FACES+i);
  const slab=new THREE.BoxGeometry(width+.15,.8,height+.15).translate((width-1)/2,-.56,(height-1)/2);
  try{
   for(const name of ['position','normal'])(this.geometry.getAttribute(name).array as Float32Array).set(slab.getAttribute(name).array);
   this.geometry.index!.array.set(slab.index!.array);this.stock.index!.array.set(slab.index!.array);
   const c=new THREE.Color(0x827858),colors=this.geometry.getAttribute('color'),sourceUv=slab.getAttribute('uv'),uv=this.geometry.getAttribute(ROCK_SURFACE_UV);
   for(let v=0;v<ROCK_SLAB_VERTICES;v++){colors.setXYZ(v,c.r,c.g,c.b);uv.setXYZ(v,sourceUv.getX(v),sourceUv.getY(v),Math.floor(v/4));}
  }finally{slab.dispose();}
  this.geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-.6,-1,-.6),new THREE.Vector3(width-.4,4,height-.4));this.geometry.boundingSphere=this.geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
 }
 vertex(slot:number):number{this.assertSlot(slot);return ROCK_SLAB_VERTICES+slot*ROCK_SURFACE_VERTICES;}
 face(slot:number):number{this.assertSlot(slot);return ROCK_SLAB_FACES+slot*ROCK_SURFACE_FACES;}
 stockOffset(slot:number):number{this.assertSlot(slot);return ROCK_SLAB_INDICES+slot*ROCK_INDICES;}
 setPaintFaces(slot:number,ids:readonly number[]):void{this.assertSlot(slot);if(ids.length!==ROCK_SURFACE_FACES||ids.some(id=>!Number.isSafeInteger(id)||id<0||Math.fround(id)!==id))throw Error('Exact resident rock paint addresses required');this.paintFaces.set(ids,slot*ROCK_SURFACE_FACES);}
 setSlabPaintFaces(ids:readonly number[]):void{if(ids.length!==ROCK_SLAB_FACES||ids.some(id=>!Number.isSafeInteger(id)||id<0||Math.fround(id)!==id))throw Error('Exact slab paint addresses required');const uv=this.geometry.getAttribute(ROCK_SURFACE_UV);for(let vertex=0;vertex<ROCK_SLAB_VERTICES;vertex++)uv.setZ(vertex,ids[Math.floor(vertex/4)]!);}
 private assertSlot(slot:number):void{if(this.closed||!Number.isSafeInteger(slot)||slot<0||slot>=this.capacity)throw Error('Rock slot outside its actual model');}
 writeCell(world:World,cell:number,slot:number):number[]{
  this.assertSlot(slot);const x=cell%world.width,z=Math.floor(cell/world.width),rawBase=slot*ROCK_VERTICES,active=writeRockCell(world,x,z,this.rawPosition,rawBase),v=this.vertex(slot);
  writeRockPigment(world,x,z,this.rawColor,rawBase);
  const positions=this.geometry.getAttribute('position'),normals=this.geometry.getAttribute('normal'),colors=this.geometry.getAttribute('color'),uv=this.geometry.getAttribute(ROCK_SURFACE_UV),order:number[]=[],uvs:(readonly[number,number])[]=[],faces:number[]=[],paint=(local:number)=>this.paintFaces[slot*ROCK_SURFACE_FACES+local]!;
  if(active.length)for(let i=0;i<6;i++)this.topOrder[slot*6+i]=active[i]!-rawBase;
  for(let i=0;i<6;i++){const corner=this.topOrder[slot*6+i]===255?[0,1,2,0,2,3][i]!:this.topOrder[slot*6+i]!;order.push(corner);uvs.push(uvForCorner(corner));faces.push(paint(Math.floor(i/3)));}
  for(let side=0;side<4;side++){
   const next=(side+1)%4,quad=[side,side+4,next+4,next];
   const corners=[0,1,2,0,2,3];for(let t=0;t<corners.length;t++){const corner=corners[t]!;order.push(quad[corner]!);uvs.push(quadUv[corner]!);faces.push(paint(2+side*2+Math.floor(t/3)));}
  }
  for(let side=0;side<4;side++){
   const next=(side+1)%4,quad=[side+4,side+8,next+8,next+4];
   for(let corner=0;corner<4;corner++){order.push(quad[corner]!);uvs.push(quadUv[corner]!);faces.push(paint(10+side));}
  }
  if(order.length!==ROCK_SURFACE_VERTICES)throw Error('Actual rock face layout drift');
  for(let i=0;i<order.length;i++){const raw=(rawBase+order[i]!)*3;positions.setXYZ(v+i,this.rawPosition[raw]!,this.rawPosition[raw+1]!,this.rawPosition[raw+2]!);normals.setXYZ(v+i,0,1,0);colors.setXYZ(v+i,this.rawColor[raw]!,this.rawColor[raw+1]!,this.rawColor[raw+2]!);uv.setXYZ(v+i,uvs[i]![0],uvs[i]![1],faces[i]!);}
  const indices:number[]=[];
  if(active.length){for(let i=0;i<6;i++)indices.push(v+i);for(let at=6;at<active.length;at+=12){const side=active[at]!-rawBase,top=v+6+side*6,bottom=v+30+side*4;if(side<0||side>3)throw Error('Actual exposed rock side order changed');for(let i=0;i<6;i++)indices.push(top+i);for(const i of [0,1,2,0,2,3])indices.push(bottom+i);}}
  const destination=this.stock.index!.array;destination.fill(0,this.stockOffset(slot),this.stockOffset(slot)+ROCK_INDICES);destination.set(indices,this.stockOffset(slot));return indices;
 }
 /** UV inverse of the exact current face plane, used only when its model's
  * dirty writer prepares original Source brush anchors, never from RAF. */
 projector(face:number,edge?:readonly[THREE.Vector3,THREE.Vector3]):(point:THREE.Vector3,vector:boolean)=>readonly[number,number]{
  if(this.closed||!Number.isSafeInteger(face)||face<0||face>=ROCK_SLAB_FACES+this.capacity*ROCK_SURFACE_FACES)throw Error('Rock face outside its actual model');
  let a:number,b:number,c:number;
  if(face<ROCK_SLAB_FACES){const at=face*6;a=this.stock.index!.getX(at);b=this.stock.index!.getX(at+1);c=this.stock.index!.getX(at+2);}
  else{const relative=face-ROCK_SLAB_FACES,slot=Math.floor(relative/ROCK_SURFACE_FACES),local=relative%ROCK_SURFACE_FACES,start=this.vertex(slot)+(local<2?local*3:local<10?6+(local-2)*3:30+(local-10)*4);a=start;b=start+1;c=start+2;}
  // A coplanar trapezoid's normalized UVs can be piecewise affine. Each
  // original brush edge must use the triangle that actually emitted it.
  const quad=face<ROCK_SLAB_FACES||face>=ROCK_SLAB_FACES&&(face-ROCK_SLAB_FACES)%ROCK_SURFACE_FACES>=10;
  if(edge&&quad){const p=this.geometry.getAttribute('position'),candidates=face<ROCK_SLAB_FACES?Array.from({length:2},(_,triangle)=>Array.from({length:3},(_,i)=>this.stock.index!.getX(face*6+triangle*3+i))):[[a,b,c],[a,c,c+1]],point=new THREE.Vector3();let matched=false;
   for(const triangle of candidates)for(let side=0;side<3;side++)if(point.fromBufferAttribute(p,triangle[side]!).distanceToSquared(edge[0])<1e-12&&point.fromBufferAttribute(p,triangle[(side+1)%3]!).distanceToSquared(edge[1])<1e-12){[a,b,c]=triangle as[number,number,number];matched=true;break;}
   if(!matched)throw Error('Source rock brush edge lost its emitting triangle');
  }
  const p=this.geometry.getAttribute('position'),uv=this.geometry.getAttribute(ROCK_SURFACE_UV),origin=new THREE.Vector3().fromBufferAttribute(p,a),first=new THREE.Vector3().fromBufferAttribute(p,b).sub(origin),second=new THREE.Vector3().fromBufferAttribute(p,c).sub(origin),bb=first.dot(first),bc=first.dot(second),cc=second.dot(second),det=bb*cc-bc*bc,pu=uv.getX(a),pv=uv.getY(a),du=uv.getX(b)-pu,dv=uv.getY(b)-pv,eu=uv.getX(c)-pu,ev=uv.getY(c)-pv;
  if(!Number.isFinite(det)||Math.abs(det)<1e-24)throw Error('Actual rock face projection is degenerate');
  return(point,vector)=>{const x=point.x-(vector?0:origin.x),y=point.y-(vector?0:origin.y),z=point.z-(vector?0:origin.z),pb=x*first.x+y*first.y+z*first.z,pc=x*second.x+y*second.y+z*second.z,u=(pb*cc-pc*bc)/det,v=(pc*bb-pb*bc)/det;return[(vector?0:pu)+u*du+v*eu,(vector?0:pv)+u*dv+v*ev];};
 }
 dispose():void{if(this.closed)return;this.closed=true;this.stock.dispose();this.geometry.dispose();}
}
