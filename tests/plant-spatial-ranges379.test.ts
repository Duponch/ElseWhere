import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import type {Resource,World} from '../src/sim/types';
import {PlantClusterLayer,plantClusterPresentation} from '../src/render/PlantClusterLayer';
import {PlantClusterSpatial379,plantClusterSwayPadding379} from '../src/render/PlantClusterSpatial379';
import type {NaturalPresentationChange} from '../src/render/NaturalResourcePresentation';

const plant=(id:number,x:number,z:number):Resource=>({id,x,z,kind:'wild-plant',species:id%2?'grass':'tall-grass',amount:1,growth:1});
const world=(resources:Resource[])=>({resources} as World);
const meshOf=(layer:PlantClusterLayer)=>layer.group.children[0] as THREE.InstancedMesh;
const slotsOf=(layer:PlantClusterLayer)=>Reflect.get(layer,'slots') as Map<number,{index:number}>;
function fixture(count=64){return Array.from({length:count},(_,i)=>plant(1000+i,(i%8)*8+1,Math.floor(i/8)*8+1)).reverse();}
function renderer(){return {backend:{isWebGPUBackend:true,device:{features:new Set(['indirect-first-instance'])}},_attributes:{update:vi.fn(),delete:vi.fn()}};}
function before(mesh:THREE.InstancedMesh,device:ReturnType<typeof renderer>,camera:THREE.Camera):void {
 mesh.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 mesh.onBeforeRender(device as unknown as Parameters<THREE.InstancedMesh['onBeforeRender']>[0],new THREE.Scene(),camera,mesh.geometry,mesh.material as THREE.Material,null as unknown as THREE.Group);
}
function selected(mesh:THREE.InstancedMesh):number[]{
 const geometry=mesh.geometry,commands=geometry.indirect;
 if(!commands)return Array.from({length:mesh.count},(_,i)=>i);
 const words=commands.itemSize,offsets=Array.isArray(geometry.indirectOffset)?geometry.indirectOffset:[geometry.indirectOffset];
 return offsets.flatMap(offset=>{const at=offset/4,first=commands.array[at+words-1]!,count=commands.array[at+1]!;return Array.from({length:count},(_,i)=>first+i);});
}
function orthographic(x:number,z:number,span=24):THREE.OrthographicCamera {
 const camera=new THREE.OrthographicCamera(-span*.65,span*.65,span*.5,-span*.5,.1,400);
 camera.position.set(x+12,70,z+16);camera.lookAt(x,0,z);camera.updateMatrixWorld(true);return camera;
}
function assertSource(layer:PlantClusterLayer,w:World,sizes=new Map<number,number>()):void {
 const mesh=meshOf(layer),matrix=new THREE.Matrix4(),object=new THREE.Object3D(),color=new THREE.Color();
 for(const resource of w.resources){
  const index=slotsOf(layer).get(resource.id)!.index,p=plantClusterPresentation(w,resource,sizes.get(resource.id)??1);
  object.position.set(resource.x,.018,resource.z);object.rotation.set(0,p.rotation,0);object.scale.set(p.scaleX,p.scaleY,p.scaleZ);object.updateMatrix();
  mesh.getMatrixAt(index,matrix);expect(matrix.elements).toEqual(Array.from(new Float32Array(object.matrix.elements)));
  expect(Array.from(mesh.instanceColor!.array).slice(index*3,index*3+3)).toEqual(Array.from(new Float32Array(color.setHex(p.color).toArray())));
  expect(mesh.geometry.getAttribute('windYaw').getX(index)).toBe(Math.fround(p.rotation));
  const basis=mesh.geometry.getAttribute('windBasis');
  expect([basis.getX(index),basis.getY(index),basis.getZ(index),basis.getW(index)]).toEqual([Math.cos(p.rotation),Math.sin(p.rotation),Math.sin(p.rotation*3.1),Math.cos(p.rotation*3.1)].map(Math.fround));
 }
}

test('plant pages retain global slots, full-prefix tombstones and immutable conservative bounds',()=>{
 const pages=new PlantClusterSpatial379(),box=(x:number,z:number)=>new THREE.Box3(new THREE.Vector3(x-.2,0,z-.2),new THREE.Vector3(x+.2,2,z+.2));
 for(let i=0;i<4;i++)pages.set(i,i<2?1:33,1,box(i<2?1:33,1));
 const first=pages.capture(4)!;expect(first.map(r=>[r.first,r.count])).toEqual([[0,2],[2,2]]);
 const original=first[0]!.bounds.clone();expect(first[0]!.bounds.containsBox(box(1,1).expandByScalar(plantClusterSwayPadding379(box(1,1))))).toBe(true);
 pages.remove(1);pages.remove(3);expect(pages.capture(3)!.map(r=>[r.first,r.count])).toEqual([[0,2],[2,1]]);
 pages.set(3,49,1,box(49,1));expect(pages.capture(4)!.map(r=>[r.first,r.count])).toEqual([[0,2],[2,1],[3,1]]);
 pages.set(1,1,1,new THREE.Box3(new THREE.Vector3(.5,0,.5),new THREE.Vector3(1.5,3,1.5)));
 expect(first[0]!.bounds.equals(original)).toBe(true);expect(pages.capture(4)![0]!.bounds.max.y).toBeGreaterThan(original.max.y);
 const builds=pages.metrics().rangeBuilds;pages.capture(4);expect(pages.metrics().rangeBuilds).toBe(builds);
 expect(pages.metrics()).toMatchObject({activeSlots:4,tombstones:0,valid:true});
 pages.set(0,NaN,1,box(1,1));expect(pages.capture(4)).toBeUndefined();
});

test('real plant source transforms, animation fields and target colors survive culling, growth, reuse and capacity replacement',()=>{
 const material=new THREE.MeshLambertNodeMaterial({vertexColors:true}),layer=new PlantClusterLayer(material),w=world(fixture()),sourceOrder=w.resources.map(p=>p.id);
 layer.update(w,true);assertSource(layer,w);
 expect(w.resources.map(p=>p.id)).toEqual(sourceOrder);
 const mesh=meshOf(layer),geometry=mesh.geometry,originalSlots=new Map([...slotsOf(layer)].map(([id,s])=>[id,s.index]));
 const attributes=[mesh.instanceMatrix,mesh.instanceColor!,geometry.getAttribute('windYaw'),geometry.getAttribute('windBasis'),geometry.getAttribute('plantAtlasBins')] as THREE.BufferAttribute[];
 const values=attributes.map(a=>Array.from(a.array)),versions=attributes.map(a=>a.version),device=renderer();
 before(mesh,device,orthographic(20,20));const nearSlots=selected(mesh);expect(nearSlots.length).toBeLessThan(mesh.count);expect(nearSlots.length).toBeGreaterThan(0);
 const commands=geometry.indirect;expect(commands).not.toBeNull();
 before(mesh,device,orthographic(45,45));expect(selected(mesh)).not.toEqual(nearSlots);expect(device._attributes.update).toHaveBeenCalledTimes(1);
 expect(attributes.map(a=>Array.from(a.array))).toEqual(values);expect(attributes.map(a=>a.version)).toEqual(versions);expect(w.resources.map(p=>p.id)).toEqual(sourceOrder);
 layer.setTargetPreview(new Set([w.resources[1]!.id]));layer.clearTargetPreview();assertSource(layer,w);
 const growing=w.resources[0]!,size=1.7;layer.update(w,false,new Map<number,NaturalPresentationChange>([[growing.id,{resource:growing,size}]]));
 assertSource(layer,w,new Map([[growing.id,size]]));before(mesh,device,orthographic(45,45));expect(geometry.indirect).toBe(commands);expect(device._attributes.update).toHaveBeenCalledTimes(1);
 for(const [id,index] of originalSlots)expect(slotsOf(layer).get(id)!.index).toBe(index);
 const removed=w.resources.find(r=>originalSlots.get(r.id)===1)!;w.resources=w.resources.filter(r=>r.id!==removed.id);
 layer.update(w,false,new Map([[removed.id,{resource:undefined,size:1}]]));
 const replacement=plant(9000,55,55);w.resources.push(replacement);layer.update(w,false,new Map([[replacement.id,{resource:replacement,size:1}]]));
 expect(slotsOf(layer).get(replacement.id)!.index).toBe(1);before(mesh,device,orthographic(45,45));expect(geometry.indirect).not.toBeNull();
 const additions=Array.from({length:80},(_,i)=>plant(10000+i,i%8+80,Math.floor(i/8)+80));w.resources.push(...additions);
 layer.update(w,false,new Map(additions.map(r=>[r.id,{resource:r,size:1}])));
 expect(meshOf(layer)).not.toBe(mesh);expect(meshOf(layer).geometry).toBe(geometry);expect(device._attributes.delete).toHaveBeenCalled();
 assertSource(layer,w,new Map([[growing.id,size]]));
 for(const [id,index] of originalSlots)if(id!==removed.id)expect(slotsOf(layer).get(id)!.index).toBe(index);
 layer.dispose();material.dispose();
});

type Clip=[number,number,number,number];
const planes=[(v:Clip)=>v[3]+v[0],(v:Clip)=>v[3]-v[0],(v:Clip)=>v[3]+v[1],(v:Clip)=>v[3]-v[1],(v:Clip)=>v[3]+v[2],(v:Clip)=>v[3]-v[2]];
function clipTriangle(input:Clip[]):Clip[]{
 let polygon=input;
 for(const distance of planes){const output:Clip[]=[];for(let i=0;i<polygon.length;i++){
  const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,da=distance(a),db=distance(b);
  if(da>=0)output.push(a);
  if((da>=0)!==(db>=0)){const t=da/(da-db);output.push(a.map((v,j)=>v+(b[j]!-v)*t) as Clip);}
 }polygon=output;if(!polygon.length)break;}return polygon;
}
/** CPU raster coverage oracle over the real tuft triangles, source matrices and
 * original near/middle wind formula. Native material/pixel checks remain GPU
 * integration checks; this specifically catches spatially dropped triangles. */
function pixels(mesh:THREE.InstancedMesh,camera:THREE.Camera,indices:readonly number[],tick:number,middle:boolean):Uint32Array {
 const width=128,height=96,result=new Uint32Array(width*height),depth=new Float64Array(width*height).fill(Infinity),geometry=mesh.geometry;
 const position=geometry.getAttribute('position'),yaw=geometry.getAttribute('windYaw'),basis=geometry.getAttribute('windBasis'),index=geometry.index;
 const project=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld),matrix=new THREE.Matrix4(),v=new THREE.Vector3(),p=new THREE.Vector4();
 const edge=(a:readonly number[],b:readonly number[],x:number,y:number)=>(x-a[0]!)*(b[1]!-a[1]!)-(y-a[1]!)*(b[0]!-a[0]!);
 for(const slot of indices){mesh.getMatrixAt(slot,matrix);const angle=yaw.getX(slot),c=middle?basis.getX(slot):Math.cos(angle),s=middle?basis.getY(slot):Math.sin(angle);
  const phase=tick*2*Math.PI/18,wave=middle?Math.sin(phase)*basis.getW(slot)+Math.cos(phase)*basis.getZ(slot):Math.sin(phase+angle*3.1);
  const vertices=Array.from({length:position.count},(_,i)=>{v.fromBufferAttribute(position,i).applyMatrix4(matrix);const bend=v.y*v.y*2*(wave*.075+.12);v.x+=(.6*c-.8*s)*bend;v.z+=(.6*s+.8*c)*bend;p.set(v.x,v.y,v.z,1).applyMatrix4(project);return p.toArray() as Clip;});
  const count=index?.count??position.count;
  for(let at=0;at<count;at+=3){const polygon=clipTriangle([0,1,2].map(i=>vertices[index?index.getX(at+i):at+i]!));
   for(let triangle=1;triangle+1<polygon.length;triangle++){
    const q=[polygon[0]!,polygon[triangle]!,polygon[triangle+1]!].map(v=>[(v[0]/v[3]+1)*width/2,(1-v[1]/v[3])*height/2,v[2]/v[3]]),[a,b,c]=q as [number[],number[],number[]],area=edge(a,b,c[0]!,c[1]!);if(Math.abs(area)<1e-12)continue;
    const x0=Math.max(0,Math.floor(Math.min(...q.map(v=>v[0]!)))),x1=Math.min(width-1,Math.ceil(Math.max(...q.map(v=>v[0]!)))),y0=Math.max(0,Math.floor(Math.min(...q.map(v=>v[1]!)))),y1=Math.min(height-1,Math.ceil(Math.max(...q.map(v=>v[1]!))));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const u=edge(b,c,x+.5,y+.5)/area,v=edge(c,a,x+.5,y+.5)/area,w=1-u-v;if(u<0||v<0||w<0)continue;const z=u*a[2]!+v*b[2]!+w*c[2]!,cell=y*width+x;if(z<=depth[cell]!){depth[cell]=z;result[cell]=slot+1;}}
   }
  }
 }return result;
}

test('selected native plant intervals preserve projected pixels across orthographic/perspective views and both maximum-wind formulas',()=>{
 const material=new THREE.MeshLambertNodeMaterial({vertexColors:true}),layer=new PlantClusterLayer(material),w=world(fixture()),device=renderer();layer.update(w,true);
 const mesh=meshOf(layer),all=Array.from({length:mesh.count},(_,i)=>i),cameras:THREE.Camera[]=[orthographic(20,20),orthographic(44,44),orthographic(5,50)];
 const perspective=new THREE.PerspectiveCamera(20,4/3,.1,400);perspective.position.set(32,70,48);perspective.lookAt(20,0,20);perspective.updateMatrixWorld(true);cameras.push(perspective);
 for(const camera of cameras){before(mesh,device,camera);const visible=selected(mesh);expect(visible.length).toBeLessThan(all.length);expect(visible.length).toBeGreaterThan(0);
  for(const middle of [false,true])for(const tick of [0,2.7,41.2]){const expected=pixels(mesh,camera,all,tick,middle);expect(expected.some(Boolean)).toBe(true);expect(pixels(mesh,camera,visible,tick,middle)).toEqual(expected);}
 }
 const beforeVersions=[mesh.instanceMatrix.version,mesh.instanceColor!.version,(mesh.geometry.getAttribute('windYaw') as THREE.BufferAttribute).version];
 before(mesh,device,orthographic(28,28,220));expect(mesh.geometry.indirect).toBeNull();
 expect([mesh.instanceMatrix.version,mesh.instanceColor!.version,(mesh.geometry.getAttribute('windYaw') as THREE.BufferAttribute).version]).toEqual(beforeVersions);
 expect(layer.spatialMetrics().draw).toMatchObject({partial:4,direct:1});
 layer.dispose();material.dispose();
});
