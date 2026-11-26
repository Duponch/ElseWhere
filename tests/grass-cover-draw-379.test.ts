import {expect,test} from 'vitest';
import {Box3,Float32BufferAttribute,Frustum,Group,InstancedBufferGeometry,Matrix4,Mesh,MeshBasicMaterial,OrthographicCamera,PerspectiveCamera,Scene,Vector3,WebGLCoordinateSystem,WebGPUCoordinateSystem} from 'three/webgpu';
import {GrassCoverDraw379,GRASS_FRUSTUM_MAX_Y379,GRASS_FRUSTUM_MIN_Y379,GRASS_FRUSTUM_RADIUS379,grassClipPlanes379,grassDrawSpans379,grassFrustumRows379} from '../src/render/GrassCoverDraw379.ts';

test('all drawable original blade slots survive sparse native draws in all three overlapping bands',()=>{
  const width=17,height=13,mask=new Uint8Array(width*height*4);
  const bands=[1,2,14,9,4, 5,4,7,5,11, 8,6,2,1,0];
  const literal:number[]=[];let offset=0;
  for(const id of [37,39,41,48,56,62,74,79,82,95,100,103,107,110,137,142,145,157,171])mask[id*4+3]=255;
  for(let b=0;b<15;b+=5)for(let z=0;z<bands[b+3]!;z++)for(let x=0;x<bands[b+2]!;x++)for(let n=0;n<bands[b+4]!;n++){
    if(mask[((bands[b+1]!+z)*width+bands[b]!+x)*4+3])literal.push(offset);offset++;
  }
  const all=new Set(literal);
  for(const limit of [1,3,12,1000]){
    const spans=grassDrawSpans379(mask,width,bands,limit),submitted=spans.flatMap(s=>Array.from({length:s.count},(_,i)=>s.first+i));
    expect(spans.length).toBeLessThanOrEqual(limit);expect(submitted.filter(i=>all.has(i))).toEqual(literal);
    if(limit===1000)expect(submitted).toEqual(literal);
    expect(submitted[0]).toBe(literal[0]);expect(submitted.at(-1)).toBe(literal.at(-1));
  }
  mask.fill(0);expect(grassDrawSpans379(mask,width,bands)).toEqual([]);
  mask.fill(255);expect(grassDrawSpans379(mask,width,bands)).toEqual([{first:0,count:offset}]);
});

test('analytic grass row intervals retain every possible blade AABB across perspective, orbit, near/far and reversed depth',()=>{
  // Middle lookup has two independently bounded decoded sine/cos components;
  // do not assume the full-precision sine's smaller sway bound.
  expect(GRASS_FRUSTUM_RADIUS379).toBeGreaterThan(.48+Math.hypot(.033,.029)*1.21+(.07*2+.04)*2);
  expect(GRASS_FRUSTUM_MIN_Y379).toBeLessThan(.021);expect(GRASS_FRUSTUM_MAX_Y379).toBeGreaterThan(.021+.21+.17);
  const width=64,height=64,mask=new Uint8Array(width*height*4),bands=[0,0,64,64,2,15,20,24,15,13,25,21,8,9,23];
  for(let i=0;i<width*height;i++)if((i*17)%11!==0)mask[i*4+3]=255;
  let savings=0;
  for(const coords of [WebGPUCoordinateSystem,WebGLCoordinateSystem])for(const reverse of [false,true])for(const perspective of [false,true])for(const angle of [0,.37,1.03,2.4]){
    const camera=perspective?new PerspectiveCamera(48,1.6,.1,180):new OrthographicCamera(-13,13,9,-9,.1,180);
    camera.coordinateSystem=coords;Reflect.set(camera,'_reversedDepth',reverse);camera.position.set(32+25*Math.sin(angle),perspective?9:30,32+25*Math.cos(angle));camera.lookAt(32,0,32);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const planes=grassClipPlanes379(camera.projectionMatrix,camera.matrixWorldInverse,coords,reverse);expect(planes).toBeDefined();const rows=grassFrustumRows379(planes!,bands),native=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),coords,reverse),box=new Box3();
    const required:number[]=[];let offset=0;
    for(let b=0;b<bands.length;b+=5)for(let row=0;row<bands[b+3]!;row++)for(let col=0;col<bands[b+2]!;col++){
      const x=bands[b]!+col,z=bands[b+1]!+row,r=GRASS_FRUSTUM_RADIUS379,slots=bands[b+4]!;box.min.set(x-r,GRASS_FRUSTUM_MIN_Y379,z-r);box.max.set(x+r,GRASS_FRUSTUM_MAX_Y379,z+r);
      if(native.intersectsBox(box)){
        expect(rows[b/5]![row*2]!).toBeLessThanOrEqual(col);expect(rows[b/5]![row*2+1]!).toBeGreaterThan(col);
        if(mask[(z*width+x)*4+3])for(let i=0;i<slots;i++)required.push(offset+i);
      }
      offset+=slots;
    }
    const spans=grassDrawSpans379(mask,width,bands,12,rows),selected=spans.flatMap(s=>Array.from({length:s.count},(_,i)=>s.first+i)),requiredSet=new Set(required);
    expect(selected.filter(i=>requiredSet.has(i))).toEqual(required);expect(spans.length).toBeLessThanOrEqual(12);
    expect(selected.every((value,i)=>value>=0&&value<offset&&(!i||value>selected[i-1]!))).toBe(true);
    savings=Math.max(savings,1-selected.length/offset);
  }
  expect(savings).toBeGreaterThan(.3);
  expect(grassClipPlanes379(new Matrix4().makeScale(1e8,1,1),new Matrix4(),WebGPUCoordinateSystem,false)).toBeUndefined();
});

test('actual grass indirect callback keeps native camera slots resident, revokes on orbit and refuses foreign transform',()=>{
  const width=64,mask=new Uint8Array(width*width*4).fill(255),geometry=new InstancedBufferGeometry().setAttribute('position',new Float32BufferAttribute([-.033,0,0,.033,0,0,-.00375,1,.029,.00375,1,.029],3));geometry.setIndex([0,2,1,1,2,3]);geometry.instanceCount=width*width*4;
  const material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material),scene=new Scene(),camera=new OrthographicCamera(-12,12,8,-8,.1,100),draw=new GrassCoverDraw379(mesh);scene.add(mesh);scene.updateMatrixWorld();camera.coordinateSystem=WebGPUCoordinateSystem;
  let uploads=0;const renderer={backend:{isWebGPUBackend:true,device:{features:new Set(['indirect-first-instance'])}},_attributes:{update(){uploads++;},delete(){}}}as unknown as Parameters<Mesh['onBeforeRender']>[0];
  const submit=()=>mesh.onBeforeRender(renderer,scene,camera,geometry,material,null as unknown as Group),orient=(angle:number)=>{camera.position.set(32+22*Math.sin(angle),25,32+22*Math.cos(angle));camera.lookAt(32,0,32);camera.updateProjectionMatrix();camera.updateMatrixWorld();};
  try{
    draw.setMask(mask,width,1);draw.setBand(0,0,0,width,width,4);draw.setBand(5,0,0,0,0,0);draw.setBand(10,0,0,0,0,0);orient(0);submit();expect(geometry.indirect).not.toBeNull();expect(draw.metrics().submitted).toBeLessThan(geometry.instanceCount*.7);const first=geometry.indirect!.array.slice();submit();expect(draw.metrics().frustumPlans).toBe(1);expect(uploads).toBe(1);
    orient(1.03);submit();expect(draw.metrics().frustumPlans).toBe(2);expect(uploads).toBe(2);expect(geometry.indirect!.array).not.toEqual(first);
    mesh.position.x=1;scene.updateMatrixWorld();submit();expect(geometry.indirect).toBeNull();expect(draw.metrics().submitted).toBe(geometry.instanceCount);expect(geometry.instanceCount).toBe(width*width*4);
  }finally{draw.dispose();material.dispose();geometry.dispose();}
});
