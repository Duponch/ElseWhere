/** PRIVATE preparation-only model view. Model geometry and all runtime poses
 * remain producer-owned. Nothing here is a style-dependent model factory. */
import * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {SharedPaintSurfaceOptions} from '../../../surfaces/SharedPaintSurface';
import type {FaceStrokeData} from '../../../surfaces/FaceStrokeTable';
import {BODY_PROPORTIONS} from '../../../pawn-appearance-shape';
import {HUMAN_REFERENCE_SCALE,ORIGAMI_HUMAN_BIND} from '../../human-geometry';
import {PAWN_MODEL_SCALE} from '../../../../world/scale';
import {MACE_DYE269} from '../../../mace-parts269';
import {LONGSWORD_DYE270} from '../../../longsword-parts270';
import {SPEAR_DYE272} from '../../../spear-parts272';
import {actorFaceDemands,ActorAtlasAdmissionRefusal,type ActorFaceDemand,type ActorAtlasLimits,type ActorAtlasPlan} from './ActorAtlasSchema';
import type {ActorAtlasAddressCohort,ActorTextureSurfaceOptions} from './ActorTextureSurface';
import {SurfacePreparationSuperseded} from '../../../surfaces/SharedSurfacePreparation';
type A=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
export interface ActorBakeSource {
 readonly key:string;readonly kind:'human'|'animal';readonly context:GraphicsStyleContext;
 readonly geometry:THREE.InstancedBufferGeometry;readonly completeIndex:Uint16Array|Uint32Array;
 readonly sourceMaterial:THREE.MeshStandardNodeMaterial;readonly stroke:FaceStrokeData;
 readonly uvAttribute:string;readonly faceCount:number;
 /** Existing published World/producer count, not a temporary compile count. */
 ownerCount():number;
 appearanceKey(slot:number):number;appearanceSignature(slot:number):string;
 canBake(slot:number):boolean;
 faceId(vertex:number):number;
 buildMorphPosition():THREE.Node<'vec3'>;
 buildOptions(surfacePosition:THREE.Node<'vec3'>):SharedPaintSurfaceOptions;
 readonly surfaceOptions:Omit<ActorTextureSurfaceOptions,'context'|'sourceMaterial'|'faceCount'>;
 assertCurrent():void;
}
export interface ActorCohortCapture {
 readonly key:number;readonly signature:string;readonly slots:readonly number[];
 readonly representative:number;readonly instanceValues:ReadonlyMap<string,readonly number[]>;
 readonly faces:readonly ActorFaceDemand[];
}
export interface ActorModelCapture {
 readonly key:string;readonly source:ActorBakeSource;readonly cohorts:readonly ActorCohortCapture[];
 readonly attributes:ReadonlyMap<string,A>;readonly completeIndex:Uint16Array|Uint32Array;
 readonly cpuBytes:number;
 assertCurrent():void;
}
const instanced=(a:A)=>a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer;
/** Source pawnMorph scalar counterpart, used for PLANNING only. The bake itself
 * executes buildMorphPosition(), the original Source Node, at actual vertices. */
export function actorMorphPoint(source:ActorBakeSource,vertex:number,slot:number):readonly[number,number,number]{
 const p=source.geometry.getAttribute('position'),x=p.getX(vertex),y=p.getY(vertex),z=p.getZ(vertex);
 if(source.kind==='animal'){const scale=source.geometry.getAttribute('aScale')??source.geometry.getAttribute('aBiology');if(!scale)throw new ActorAtlasAdmissionRefusal('Actual animal growth stream absent');const n=scale.getX(slot);if(!(n>0)||n>1)throw new ActorAtlasAdmissionRefusal('Animal growth outside the admitted adult bound');return[x,y,z];}
 const shape=source.geometry.getAttribute('aShape'),traits=source.geometry.getAttribute('pawnRigTraits');if(!shape||!traits)throw new ActorAtlasAdmissionRefusal('Actual human morph fields absent');const body=shape.getX(slot)%10,head=shape.getY(slot),row=BODY_PROPORTIONS[body];if(!row||!Number.isSafeInteger(head)||head<0||head>=12)throw new ActorAtlasAdmissionRefusal('Actual human morph outside Source domain');
 const bone=traits.getX(vertex),dye=traits.getY(vertex),[shoulder,waist,hip,depth]=row,S=HUMAN_REFERENCE_SCALE;
 let value:readonly[number,number,number];
 if([-1,-4,-5,MACE_DYE269,LONGSWORD_DYE270,SPEAR_DYE272].includes(dye))value=[x+(shoulder-1)*.205,y,z];
 else if(dye<=-30&&dye>=-32)value=[x+(shoulder-1)*ORIGAMI_HUMAN_BIND.shoulderX,y,z+(depth-1)*.05*S];
 else if(bone===1){const lower=y<(1.23+(1.18-1.04)/.30*.38)*S,jaw=head%3,width=(head%6>=3?.87:1)*(head>=6?.97:1)*(lower?(jaw===1?.84:jaw===2?1.12:1):1);value=[x*width,y,z];}
 else{const t=THREE.MathUtils.clamp((y-.76*S)/(.44*S),0,1),torso=waist+(shoulder-waist)*t;value=[x*(bone>=4?hip:bone>=2&&bone<=3?shoulder:torso),y,z*depth];}
 return[value[0]*PAWN_MODEL_SCALE,value[1]*PAWN_MODEL_SCALE,value[2]*PAWN_MODEL_SCALE];
}
/** Snapshot one whole model and only real active appearance cohorts. Any
 * unsupported actor in this producer refuses its entire fast representation;
 * no missing face, recoloured wound or partial-human fast path is published. */
export function captureActorModel(source:ActorBakeSource,maxCohorts=4096):ActorModelCapture{
 source.assertCurrent();source.stroke.assertCurrent();const g=source.geometry,p=g.getAttribute('position'),uv=g.getAttribute(source.uvAttribute),count=source.ownerCount();
 if(!Number.isSafeInteger(count)||count<1||count>4096||!p||!uv||!source.completeIndex.length||source.completeIndex.length%3||source.completeIndex.length/3>20000||source.faceCount!==source.stroke.faceCount)throw new ActorAtlasAdmissionRefusal('Actual complete actor domain/count required');
 if(source.context.reliefEnabled||source.context.wearEnabled)throw new ActorAtlasAdmissionRefusal('Positive actor effects retain Source');
 const groups=new Map<number,{signature:string;slots:number[]}>();for(let slot=0;slot<count;slot++){
  if(!source.canBake(slot))throw new ActorAtlasAdmissionRefusal('Whole actor clinical/non-rigid Source fallback');const key=source.appearanceKey(slot),signature=source.appearanceSignature(slot);if(!Number.isSafeInteger(key)||key<0||key>0xffffffff||!signature)throw new ActorAtlasAdmissionRefusal('Exact appearance key/signature required');const old=groups.get(key);if(old){if(old.signature!==signature)throw new ActorAtlasAdmissionRefusal('Appearance key collision retains Source');old.slots.push(slot);}else{if(groups.size>=maxCohorts||source.faceCount*(groups.size+1)*32>128*1024*1024)throw new ActorAtlasAdmissionRefusal('Actual binding/appearance capacity budget');groups.set(key,{signature,slots:[slot]});}
 }
 const attributes=new Map(Object.entries(g.attributes)),pins=new Map<A,THREE.TypedArray>(),complete=source.completeIndex.slice();let cpuBytes=complete.byteLength;
 // Preparation pins only; no scans of arrays/rows in stable render frames.
 for(const a of new Set(attributes.values()))if(!instanced(a)){pins.set(a,a.array.slice());cpuBytes+=a.array.byteLength;}
 const cohorts:ActorCohortCapture[]=[],faceCache=new Map<string,readonly ActorFaceDemand[]>();
 for(const[key,group]of [...groups].sort(([a],[b])=>a-b)){let representative=group.slots[0]!;if(source.kind==='animal'){const scale=g.getAttribute('aScale')??g.getAttribute('aBiology');for(const slot of group.slots)if(scale.getX(slot)>scale.getX(representative))representative=slot;}
  const values=new Map<string,readonly number[]>();for(const[name,a]of attributes)if(instanced(a)){if(a.count<=representative)throw new ActorAtlasAdmissionRefusal('Actual owner attribute capacity invalid');const row=Array.from({length:a.itemSize},(_,c)=>a.getComponent(representative,c));if(!row.every(Number.isFinite))throw new ActorAtlasAdmissionRefusal('Nonfinite real owner attribute');values.set(name,Object.freeze(row));cpuBytes+=row.length*8;}
  const sh=g.getAttribute('aShape'),sc=g.getAttribute('aScale')??g.getAttribute('aBiology'),morphKey=source.kind==='human'?JSON.stringify([sh.getX(representative)%10,sh.getY(representative)]):String(sc.getX(representative));let faces=faceCache.get(morphKey);
  if(!faces){const planning=new THREE.BufferGeometry(),morphed=new Float64Array(p.count*3);for(let vertex=0;vertex<p.count;vertex++)morphed.set(actorMorphPoint(source,vertex,representative),vertex*3);planning.setAttribute('position',new THREE.BufferAttribute(morphed,3));planning.setAttribute('uv',uv);planning.setIndex(new THREE.BufferAttribute(complete,1));try{faces=actorFaceDemands(planning,{uvAttribute:'uv',faceId:source.faceId,maxFaces:source.faceCount,maxTriangles:20000});faceCache.set(morphKey,faces);}finally{planning.deleteAttribute('uv');planning.setIndex(null);planning.dispose();}}
  if(faces.length!==source.faceCount||faces.some((f,i)=>f.id!==i))throw new ActorAtlasAdmissionRefusal('Every complete Source face required');cpuBytes+=faces.reduce((n,f)=>n+f.triangles.length*4+128,0);cohorts.push(Object.freeze({key,signature:group.signature,slots:Object.freeze(group.slots),representative,instanceValues:values,faces}));
 }
 if(cpuBytes>32*1024*1024)throw new ActorAtlasAdmissionRefusal('Actor preparation CPU pin budget');
 // Slot/count/World/pose are lease validation only. A second identical actor
 // borrows the same paint charts and must not trigger another bake/repack.
 const key=JSON.stringify(['whole-actor-model-capture-v1',source.key,cohorts.map(c=>[c.key,c.signature])]);
 const assertCurrent=()=>{source.assertCurrent();source.stroke.assertCurrent();if(source.ownerCount()!==count||source.completeIndex.length!==complete.length||source.completeIndex.some((n,i)=>n!==complete[i]))throw new SurfacePreparationSuperseded('Actual model/owner domain changed during preparation');for(const[name,a]of attributes)if(g.getAttribute(name)!==a)throw new SurfacePreparationSuperseded('Actual Source attribute replaced');for(const[a,pin]of pins)if(a.array.length!==pin.length||a.array.some((n,i)=>!Object.is(n,pin[i])))throw new SurfacePreparationSuperseded('Actual Source static contents changed');for(const c of cohorts)for(const slot of c.slots)if(!source.canBake(slot)||source.appearanceKey(slot)!==c.key||source.appearanceSignature(slot)!==c.signature)throw new SurfacePreparationSuperseded('Actual appearance/morph/clinical eligibility changed');for(const c of cohorts)for(const[name,row]of c.instanceValues){const a=attributes.get(name)!;if(row.some((n,i)=>!Object.is(n,a.getComponent(c.representative,i))))throw new SurfacePreparationSuperseded('Actual Source owner stream changed');}};assertCurrent();
 return Object.freeze({key,source,cohorts:Object.freeze(cohorts),attributes,completeIndex:complete,cpuBytes,assertCurrent});
}
export interface ActorCohortPlan {readonly plan:ActorAtlasPlan;readonly addresses:readonly ActorAtlasAddressCohort[];readonly capture:ActorModelCapture;readonly cpuBytes:number}
/** Actual appearances are packed TOGETHER, not one minimum2k page per pawn. */
export function planActorCohorts(capture:ActorModelCapture,request:{tier:'screen'|'near-source';maxCellPixels:number;oversampling:number;paintKey:string},limits:ActorAtlasLimits):ActorCohortPlan{
 capture.assertCurrent();const n=capture.source.faceCount,total=n*capture.cohorts.length;if(!Number.isSafeInteger(total)||total>limits.maxFaces||total*32>128*1024*1024)throw new ActorAtlasAdmissionRefusal('Whole-cohort metadata byte budget before planning');
 const align=(x:number)=>Math.ceil(x/8)*8,work=capture.cohorts.flatMap((c,i)=>c.faces.map(f=>{const u=f.rawBounds[2]-f.rawBounds[0],v=f.rawBounds[3]-f.rawBounds[1],sw=Math.ceil(f.tangentU*u*request.maxCellPixels*request.oversampling),sh=Math.ceil(f.tangentV*v*request.maxCellPixels*request.oversampling),w=request.tier==='near-source'?Math.max(sw,f.sourceWidth):sw,h=request.tier==='near-source'?Math.max(sh,f.sourceHeight):sh,width=align(w+16),height=align(h+16);if(width>2048||height>2048||w<1||h<1)throw new ActorAtlasAdmissionRefusal('Required whole-actor chart exceeds page; no rescale');return{id:i*n+f.id,w,h,width,height};}));
 const area=work.reduce((s,r)=>s+r.width*r.height,0),largest=work.reduce((n,r)=>Math.max(n,r.width,r.height),0);let size=128;while(size<largest)size*=2;
 // One bank shared by actual appearances; small rigid species do not pay a
 // blind2048 minimum. Choose the smallest page able to hold the actual area
 // in <=8layers, bounded by actual maxPages and the retained memory budget.
 while(size<2048&&area>size*size*Math.min(8,limits.maxPages))size*=2;
 if(area>limits.maxPages*size*size)throw new ActorAtlasAdmissionRefusal('Actual cohort pixel area exceeds admitted pages');
 work.sort((a,b)=>b.height-a.height||b.width-a.width||a.id-b.id);const shelves:{x:number;y:number;row:number}[]=[],tiles:ActorAtlasPlan['tiles'][number][]=[];
 for(const r of work){let page=0,x=0,y=0,row=0;for(;page<shelves.length;page++){({x,y,row}=shelves[page]!);if(x+r.width>size){x=0;y+=row;row=0;}if(y+r.height<=size)break;}if(page===shelves.length){if(page>=limits.maxPages)throw new ActorAtlasAdmissionRefusal('Real whole-cohort packing exceeds pages');shelves.push({x:0,y:0,row:0});x=y=row=0;}shelves[page]={x:x+r.width,y,row:Math.max(row,r.height)};tiles.push(Object.freeze({face:r.id,page,rect:Object.freeze({x,y,width:r.width,height:r.height}),content:Object.freeze({x:x+8,y:y+8,width:r.w,height:r.h})}));}
 const retainedGpuBytes=shelves.length*size*size*4*(1+1/4+1/16+1/64),retainedCpuBytes=total*96+work.length*64,peakCpuBytes=limits.oldLiveCpuBytes+limits.externalCpuBytes+capture.cpuBytes+retainedCpuBytes+limits.compilerScratchCpuBytes,peakGpuBytes=limits.oldLiveGpuBytes+limits.externalGpuBytes+retainedGpuBytes+limits.compilerScratchGpuBytes;
 if(peakCpuBytes>limits.maxCpuBytes||retainedGpuBytes>limits.maxRetainedGpuBytes||peakGpuBytes>limits.maxPeakGpuBytes)throw new ActorAtlasAdmissionRefusal('Real whole-cohort old/new/source/scratch memory budget');
 const plan:ActorAtlasPlan=Object.freeze({key:JSON.stringify(['whole-cohort-plan-v1',capture.key,request,tiles]),size,levels:4,tier:request.tier,maxCellPixels:request.maxCellPixels,oversampling:request.oversampling,pages:shelves.length,tiles:Object.freeze(tiles),retainedGpuBytes,peakGpuBytes,retainedCpuBytes,peakCpuBytes,clinical:'no-before-ink-blood',sourcePigmentPixels:512}),tileIndex=new Map(plan.tiles.map((tile,i)=>[tile.face,i]));
 const addresses=capture.cohorts.map((c,i)=>Object.freeze({key:c.key,signature:c.signature,faces:Object.freeze(c.faces.map(f=>Object.freeze({face:f.id,tile:tileIndex.get(i*n+f.id)!,rawBounds:f.rawBounds})))}));
 return Object.freeze({plan,addresses:Object.freeze(addresses),capture,cpuBytes:capture.cpuBytes+plan.retainedCpuBytes});
}
