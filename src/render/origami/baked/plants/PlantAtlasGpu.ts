/** Exclusive preparation on the existing renderer. No readback, runtime ribbon,
 * legacy coverage reconstruction or global paint-bank binding in the final graph. */
import * as THREE from 'three/webgpu';
import {Fn,If,attribute,varying,texture,textureLoad,vec2,vec3,vec4,ivec2,float,int,workingToColorSpace,colorSpaceToWorking,mix} from 'three/tsl';
import type {GraphicsStyleContext} from '../../../graphics-style';
import {queryFaceStrokeCoverage,type FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
import {PLANT_PAGE_BYTES,PlantAtlasAdmissionRefusal,type PlantAtlasPlan} from './PlantAtlasPlan';
import {inkOccupancyPackingNode,inkOccupancyPreparationWitness} from '../../../surfaces/InkOccupancyPacking';

export interface PlantAtlasGpuResult {texture:THREE.Texture;gpuBytes:number;cpuBytes:number;stats:Readonly<Record<string,unknown>>;dispose():void}
type Source=ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;
const running=new WeakSet<THREE.WebGPURenderer>(),size=2048,levels=4,passes=16;
const mipBytes=(w:number,h:number)=>{let bytes=0;for(;;){bytes+=w*h*4;if(w===1&&h===1)return bytes;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}};
const clip=(u:number,v:number)=>[u*2-1,1-v*2,.5];
function target(width:number,height:number,kind:'linear'|'srgb'|'mask'='linear',depth=1){const t=new THREE.RenderTarget(width,height,{depth,samples:0,type:kind==='linear'?THREE.HalfFloatType:THREE.UnsignedByteType,format:kind==='mask'?THREE.RedFormat:THREE.RGBAFormat,colorSpace:kind==='srgb'?THREE.SRGBColorSpace:THREE.NoColorSpace,depthBuffer:false,stencilBuffer:false,generateMipmaps:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});t.texture.flipY=false;t.texture.wrapS=t.texture.wrapT=THREE.ClampToEdgeWrapping;return t;}
function finiteMips(t:THREE.RenderTarget){t.texture.mipmaps=Array.from({length:levels},(_,l)=>({data:new Uint8Array(0),width:size/2**l,height:size/2**l}));t.texture.minFilter=THREE.LinearMipmapLinearFilter;t.texture.magFilter=THREE.LinearFilter;}
function material(fragment:THREE.Node<'vec4'>){const m=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,transparent:false,side:THREE.DoubleSide,toneMapped:false,fog:false});m.vertexNode=vec4(attribute('position','vec3'),1);m.fragmentNode=fragment;return m;}
function scene(g:THREE.BufferGeometry,m:THREE.NodeMaterial){const s=new THREE.Scene(),mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;s.add(mesh);return s;}
function quad(){const uv=[0,0,1,0,1,1,0,0,1,1,0,1],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(Array.from({length:6},(_,i)=>clip(uv[i*2]!,uv[i*2+1]!)).flat(),3));g.setAttribute('bakeUv',new THREE.Float32BufferAttribute(uv,2));return g;}
function pageGeometry(plan:PlantAtlasPlan,page:number){
 const p:number[]=[],uv:number[]=[],face:number[]=[],aspect:number[]=[],bp:number[]=[],bu:number[]=[],bounds:number[]=[],sourceUv=plan.geometry.getAttribute('uv'),index=plan.geometry.index;
 for(const tile of plan.tiles.filter(t=>t.page===page)){const f=plan.faces[tile.face]!,r=tile.rect,c=tile.content,[loU,loV,hiU,hiV]=f.rawBounds;
  for(const triangle of f.triangles)for(let corner=0;corner<3;corner++){const v=index?.getX(triangle*3+corner)??triangle*3+corner,u=sourceUv.getX(v),w=sourceUv.getY(v),x=(c.x+(u-loU)/(hiU-loU)*c.width)/size,y=(c.y+(w-loV)/(hiV-loV)*c.height)/size;p.push(...clip(x,y));uv.push(u,w);face.push(f.id);aspect.push(tile.aspect);}
  for(const[x,y]of [[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]]){bp.push(...clip(x!/size,y!/size));bu.push(x!/size,y!/size);bounds.push(r.x,r.y,r.x+r.width-1,r.y+r.height-1);}
 }
 const body=new THREE.BufferGeometry();for(const[name,values,n]of [['position',p,3],['bakeRawUv',uv,2],['bakeFace',face,1],['bakeAspect',aspect,1]]as const)body.setAttribute(name,new THREE.Float32BufferAttribute(values,n));
 const charts=new THREE.BufferGeometry();for(const[name,values,n]of [['position',bp,3],['bakeUv',bu,2],['bakeBounds',bounds,4]]as const)charts.setAttribute(name,new THREE.Float32BufferAttribute(values,n));return{body,charts,bytes:[p,uv,face,aspect,bp,bu,bounds].reduce((n,a)=>n+a.length*4,0)};
}

/** Exact current P512/KM512 composition. Endpoint branches preserve the Source
 * shortcut; mixed coverage uses installed r186 encoded-sRGB transfer nodes. */
export function plantAtlasBodyNode(p:THREE.Texture,km:THREE.Texture,raw:THREE.Node<'vec2'>,aspect:THREE.Node<'float'>):THREE.Node<'vec3'>{
 return Fn(()=>{const pigment=texture(p,vec2(raw.x.mul(aspect),raw.y.div(aspect))).toVar(),paper=texture(km,raw).toVar(),result=vec3(0).toVar();
  If(paper.a.equal(1),()=>{result.assign(pigment.rgb);}).ElseIf(paper.a.equal(0),()=>{result.assign(paper.rgb);}).Else(()=>{const encodedP=vec4(workingToColorSpace(vec4(pigment.rgb,1),THREE.SRGBColorSpace)as unknown as THREE.Node<'vec4'>).rgb,encodedK=vec4(workingToColorSpace(vec4(paper.rgb,1),THREE.SRGBColorSpace)as unknown as THREE.Node<'vec4'>).rgb;result.assign(vec4(colorSpaceToWorking(vec4(mix(encodedK,encodedP,paper.a),1),THREE.SRGBColorSpace)as unknown as THREE.Node<'vec4'>).rgb);});return result;})();
}
/** Shared Source stroke kernel, with a synthetic isometric face whose metric
 * after density normalization is[a,0,1/a]. B remains tint-independent. */
export function plantAtlasTerms(p:THREE.Texture,km:THREE.Texture,alpha:THREE.Texture,stroke:FaceStrokeData,settings:{edgeWidth:number},paint:Source['paint']){
 const raw=varying(attribute('bakeRawUv','vec2')),aspect=varying(attribute('bakeAspect','float')).setInterpolation('flat','first'),body=plantAtlasBodyNode(p,km,raw,aspect),ink=queryFaceStrokeCoverage({table:stroke,faceId:attribute('bakeFace','float'),faceUv:raw,enabled:float(1),opacity:float(paint.lineOpacity),width:float(settings.edgeWidth),irregularity:float(paint.strokeImperfection),brushColor:vec3(...paint.brushColorLinear),surfacePosition:vec3(raw.x.mul(aspect),raw.y.div(aspect),0),samplePigment:(uv,dx,dy)=>texture(p,uv).grad(dx,dy).rgb,sampleDry:(uv,dx,dy)=>texture(alpha,uv).grad(dx,dy).g});
 return{base:vec4(body.mul(float(1).sub(ink.a)),1),ink};
}

/** Pure byte admission over borrowed Source views; allocates no GPU object. */
export function planPlantGpuPreparation(plan:PlantAtlasPlan,source:Source,stroke:FaceStrokeData,settings:{edgeWidth:number}){
 if(plan.size!==size||plan.levels!==levels||plan.depth!==plan.pages*2||plan.pages<1||plan.pages>2||!Number.isFinite(settings.edgeWidth)||settings.edgeWidth<.5||settings.edgeWidth>5)throw Error('Exact bounded plant atlas domain required');
 source.assertCurrent();stroke.assertCurrent();const pixels=source.paint.readProfile(0),edge=source.paint.edgeAlpha;if(pixels.orientation!=='upload-bottom-up'||pixels.pigment.length!==512*512*4||pixels.paper.length!==512*512*4||pixels.coverage.length!==512*512||edge.data.length!==edge.width*edge.height*4)throw Error('Exact Source512 pigment/paper/coverage and full brush alpha required');
 const sourceGpuBytes=mipBytes(512,512)*2+mipBytes(edge.width,edge.height),geometryBytes=plan.tiles.reduce((n,t)=>n+plan.faces[t.face]!.triangles.length*3*7*4+6*9*4,0)+6*5*4,peak=plan.existingLiveGpuBytes+plan.retainedGpuBytes+PLANT_PAGE_BYTES+size*size*(32+16+1+2)+sourceGpuBytes+geometryBytes,cpuBytes=512*512*4+geometryBytes*4+levels*plan.depth*64;
 if(plan.retainedGpuBytes!==plan.depth*size*size*4*(1+1/4+1/16+1/64)||peak>plan.peakGpuBytes||cpuBytes>plan.maxCpuBytes)throw new PlantAtlasAdmissionRefusal('Plant atlas actual old-live/new/source/mask peak refused BEFORE allocation');
 return{pixels,edge,peak,cpuBytes,sourceGpuBytes,geometryBytes};
}
export async function preparePlantAtlasGpu(renderer:THREE.WebGPURenderer,plan:PlantAtlasPlan,source:Source,stroke:FaceStrokeData,settings:{edgeWidth:number},assertExclusive:()=>void):Promise<PlantAtlasGpuResult>{
 if(!renderer.initialized||!Reflect.get(renderer.backend,'isWebGPUBackend'))throw Error('Plant atlas needs the existing initialized WebGPU renderer');if(running.has(renderer))throw Error('Plant atlas renderer already leased');
 const check=()=>{assertExclusive();source.assertCurrent();stroke.assertCurrent();};check();
 const{pixels,edge,peak,cpuBytes}=planPlantGpuPreparation(plan,source,stroke,settings);
 const witness=inkOccupancyPreparationWitness(renderer);
 const old={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),autoClear:renderer.autoClear,color:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha()},cleanup:(()=>void)[]=[],own=<T extends{dispose():void}>(v:T):T=>{cleanup.push(()=>v.dispose());return v;},camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);let output:THREE.RenderTarget|undefined,delivered:THREE.RenderTarget|undefined,failure:unknown;
 running.add(renderer);
 const render=async(s:THREE.Scene,t:THREE.RenderTarget)=>{check();renderer.setRenderTarget(t);await renderer.renderAsync(s,camera);check();};
 try{
  renderer.autoClear=true;renderer.setClearColor(0,0);const kmBytes=new Uint8Array(512*512*4);for(let i=0;i<pixels.coverage.length;i++){kmBytes[i*4]=pixels.paper[i*4]!;kmBytes[i*4+1]=pixels.paper[i*4+1]!;kmBytes[i*4+2]=pixels.paper[i*4+2]!;kmBytes[i*4+3]=pixels.coverage[i]!;}
  const dataTexture=(data:Uint8Array,width:number,height:number,srgb:boolean,repeat:boolean)=>{const t=own(new THREE.DataTexture(data,width,height,THREE.RGBAFormat));t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.wrapS=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;t.wrapT=srgb&&repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  const p=dataTexture(pixels.pigment,512,512,true,true),km=dataTexture(kmBytes,512,512,true,false),alpha=dataTexture(edge.data,edge.width,edge.height,false,true),work=own(target(size*2,size*2)),a=own(target(size,size)),b=own(target(size,size)),mask0=own(target(size,size,'mask')),mask1=own(target(size,size,'mask')),page=own(target(size,size,'srgb')),mip=own(target(size/2,size/2,'srgb')),full=own(quad());finiteMips(page);output=target(size,size,'srgb',plan.depth);finiteMips(output);if(!output.texture.isArrayTexture)throw Error('Actual layered plant RenderTarget flag absent');renderer.initRenderTarget(output);
  const pixel=(width:number,height:number)=>ivec2(varying(attribute('bakeUv','vec2')).mul(vec2(width,height))),load=(t:THREE.Texture,xy:THREE.Node<'ivec2'>,level=0)=>textureLoad(t,xy,int(level)),sum4=(t:THREE.Texture,xy:THREE.Node<'ivec2'>,level=0)=>load(t,xy,level).add(load(t,xy.add(ivec2(1,0)),level)).add(load(t,xy.add(ivec2(0,1)),level)).add(load(t,xy.add(ivec2(1,1)),level));
  for(let at=0;at<plan.pages;at++){
   const geom=pageGeometry(plan,at);own(geom.body);own(geom.charts);
   const seedMask=own(material(vec4(sum4(work.texture,pixel(size,size).mul(2)).a.div(255),0,0,1)));
   // Store exact covered-subpixel COUNT0..4 as byte0..4. UNORM is decoded
   // by round(*255), avoiding .25/.5 quantization errors during I resolve.
   for(const term of [0,1]as const){
    const terms=plantAtlasTerms(p,km,alpha,stroke,settings,source.paint),rawMat=own(material(term===0?terms.base:terms.ink));await render(scene(geom.body,rawMat),work);
    const resolve=own(material(Fn(()=>{const xy=pixel(size,size),sum=sum4(work.texture,xy.mul(2)).toVar(),count=term===0?sum.a:load(mask0.texture,xy).r.mul(255).round(),valid=count.greaterThan(0),div=count.max(1);return term===0?vec4(sum.rgb.div(div),valid.select(1,0)):sum.div(div);})()));await render(scene(full,resolve),a);if(term===0)await render(scene(full,seedMask),mask0);
    const dilate=(color:THREE.Texture,mask?:THREE.Texture)=>own(material(Fn(()=>{const xy=pixel(size,size),r=varying(attribute('bakeBounds','vec4')).setInterpolation('flat','first'),lo=r.xy,hi=r.zw,result=load(color,xy).toVar(),valid=(q:THREE.Node<'ivec2'>)=>mask?load(mask,q).r.greaterThan(.5/255):load(color,q).a.greaterThan(.5),points=[ivec2(-1,0),ivec2(1,0),ivec2(0,-1),ivec2(0,1)].map(d=>ivec2(vec2(xy.add(d)).clamp(lo,hi)));If(valid(xy).not(),()=>{const chain=If(valid(points[0]!),()=>{result.assign(load(color,points[0]!));});for(let i=1;i<4;i++)chain.ElseIf(valid(points[i]!),()=>{result.assign(load(color,points[i]!));});});return result;})()));
    const spreadMask=(from:THREE.Texture)=>own(material(Fn(()=>{const xy=pixel(size,size),r=varying(attribute('bakeBounds','vec4')).setInterpolation('flat','first'),result=load(from,xy).r.toVar(),points=[ivec2(-1,0),ivec2(1,0),ivec2(0,-1),ivec2(0,1)].map(d=>ivec2(vec2(xy.add(d)).clamp(r.xy,r.zw)));If(result.lessThan(.5/255),()=>{const chain=If(load(from,points[0]!).r.greaterThan(.5/255),()=>{result.assign(load(from,points[0]!).r);});for(let i=1;i<4;i++)chain.ElseIf(load(from,points[i]!).r.greaterThan(.5/255),()=>{result.assign(load(from,points[i]!).r);});});return vec4(result,0,0,1);})()));
    const ab=scene(geom.charts,dilate(a.texture,term===1?mask0.texture:undefined)),ba=scene(geom.charts,dilate(b.texture,term===1?mask1.texture:undefined)),mab=term===1?scene(geom.charts,spreadMask(mask0.texture)):undefined,mba=term===1?scene(geom.charts,spreadMask(mask1.texture)):undefined;let current=a;
    for(let pass=0;pass<passes;pass++){const next=current===a?b:a;await render(current===a?ab:ba,next);if(term===1)await render(current===a?mab!:mba!,current===a?mask1:mask0);current=next;}
    const finalMat=own(material(load(current.texture,pixel(size,size))));await render(scene(full,finalMat),page);
    for(let level=1;level<levels;level++){const n=size/2**level;mip.viewport.set(0,0,n,n);const mat=own(material(sum4(page.texture,pixel(n,n).mul(2),level-1).mul(.25)));await render(scene(full,mat),mip);renderer.copyTextureToTexture(mip.texture,page.texture,new THREE.Box2(new THREE.Vector2(0,0),new THREE.Vector2(n,n)),new THREE.Vector2(0,0),0,level);check();}
    for(let level=0;level<levels;level++){const n=size/2**level;renderer.copyTextureToTexture(page.texture,output.texture,new THREE.Box2(new THREE.Vector2(0,0),new THREE.Vector2(n,n)),new THREE.Vector3(0,0,at*2+term),level,level);check();}
   }
   // Body RGB and Ink RGB keep their independently resolved retained mips.
   // Pack occupancy from ACTUAL stored Ink.rgb, never its quantized alpha.
   // Reuse the existing RGBA8 targets: no extra atlas layer or scratch target.
   for(let level=0;level<levels;level++){
    const n=size/2**level,destination=level===0?page:mip;destination.viewport.set(0,0,n,n);
    if(witness){check();await witness({phase:'before',family:'plant',page:at,bank:output.texture,bodyLayer:at*2,inkLayer:at*2+1,level,width:n,height:n,scratch:page,renderer,assertCurrent:check});check();}
    const packing=own(material(inkOccupancyPackingNode(output.texture,float(at*2),float(at*2+1),level,[n,n],varying(attribute('bakeUv','vec2')))));
    packing.name='Plant ink occupancy page'+at+' mip'+level;
    await render(scene(full,packing),destination);
    if(witness){check();await witness({phase:'packed',family:'plant',page:at,bank:output.texture,bodyLayer:at*2,inkLayer:at*2+1,level,width:n,height:n,scratch:destination,renderer,assertCurrent:check});check();}
    renderer.copyTextureToTexture(destination.texture,output.texture,new THREE.Box2(new THREE.Vector2(0,0),new THREE.Vector2(n,n)),new THREE.Vector3(0,0,at*2),0,level);check();
   }
   page.viewport.set(0,0,size,size);
  }
  check();const retained=output;let closed=false;delivered=retained;output=undefined;return{texture:retained.texture,gpuBytes:plan.retainedGpuBytes,cpuBytes:levels*plan.depth*64,stats:Object.freeze({scope:'Private GPU BI preparation; no Native quality or performance admission',pages:plan.pages,depth:plan.depth,levels,retainedGpuBytes:plan.retainedGpuBytes,peakGpuBytes:peak,preparationCpuBytes:cpuBytes,sourceProfile:0,sourcePixels:512,legacyCoverage:false,runtimeRibbons:false,inkOccupancy:'Body.a=1 iff stored Ink.rgb is nonzero at this retained mip',occupancyPackingPasses:plan.pages*levels,occupancyReusesScratch:true,kernel:'queryFaceStrokeCoverage actual Source',syntheticMetric:'[sqrt(ratio),0,1/sqrt(ratio)]',workingScale:2,mask:'two R8 targets, exact integer covered-subpixel counts0..4',readback:witness?'Optional preparation witness registered':false,orientation:'row0/v0 via clipY; Native corner proof pending',halfFloatRounding:'Native delta pending'}),dispose(){if(closed)return;closed=true;retained.dispose();}};
 }catch(error){failure=error;throw error;}finally{
  const failures:unknown[]=[];try{renderer.setRenderTarget(old.target,old.face,old.mip);renderer.autoClear=old.autoClear;renderer.setClearColor(old.color,old.alpha);}catch(error){failures.push(error);}for(const close of cleanup.reverse())try{close();}catch(error){failures.push(error);}if(output)try{output.dispose();}catch(error){failures.push(error);}running.delete(renderer);if(failures.length){if(delivered)try{delivered.dispose();}catch(error){failures.push(error);}throw new AggregateError(failure===undefined?failures:[failure,...failures],'Plant atlas preparation cleanup failed');}
 }
}
