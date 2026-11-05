/** CPU preparation boundary only. Never traversed from RAF; no sparse mirror. */
import * as THREE from 'three/webgpu';
import {ROCK_SURFACE_UV} from '../models/RockSurfaceModel';
import {RockStrokeTable} from './RockStrokeTable';
import {RockFinalAdmissionRefusal,type RockFinalInput,type RockFinalPanel} from './RockFinalRuntimeTypes';
const LIMIT=8*1024*1024;
const uint=(v:number)=>Number.isSafeInteger(v)&&v>=0;
export interface RockFinalProducer {readonly geometry:THREE.BufferGeometry;readonly stroke:RockStrokeTable;readonly slots:ReadonlyMap<number,{readonly slot:number;readonly indices:readonly number[]}>;readonly width:number;readonly height:number;revision():string}
export function collectRockFinalInput(producer:RockFinalProducer,assertExclusive:()=>void):RockFinalInput {
 assertExclusive();const {geometry,stroke,slots,width,height}=producer,index=geometry.index;
 const field=(name:string)=>{const a=geometry.getAttribute(name);if(!(a instanceof THREE.BufferAttribute)||a.itemSize!==3||!(a.array instanceof Float32Array))throw new RockFinalAdmissionRefusal('Contiguous actual Rock Source field required: '+name);return a;};
 const position=field('position'),normal=field('normal'),color=field('color'),rawUv=field(ROCK_SURFACE_UV),count=geometry.drawRange.count,rows=stroke.buffer.array,revision=producer.revision();
 if(stroke.representationKey!=='single'||!index||!(index.array instanceof Uint32Array)||!(rows instanceof Float32Array)||geometry.drawRange.start!==0||!uint(count)||count<36||count%3||count>index.count||!uint(width)||!width||!uint(height)||!height)throw new RockFinalAdmissionRefusal('Actual bounded contiguous indexed Rock producer required');
 const fields=[position,normal,color,rawUv],versions=[index.version,...fields.map(a=>a.version),stroke.buffer.version],sourceIndex=index.array,sourceBuffer=stroke.buffer;
 /** Upload bookkeeping can advance an attribute version without changing a
  * single Source word (real435 range coalescing). Read only indexed vertices,
  * indices and their exact canonical records; never reassemble/copy the map. */
 const compareActive=()=>{
  let wordsCompared=0;const fail=(array:string,word:number,before:unknown,after:unknown,reason='word')=>({performed:true,equal:false,arrays:13,wordsCompared,diffFirst:{array,word,before,after,reason}});
  const names=['position','normal','color','rockSurfaceUv']as const;
  for(let field=0;field<fields.length;field++){
   const attribute=fields[field]!,data=attribute.array,saved=arrays[names[field]!]!;
   if(!(data instanceof Float32Array)||attribute.itemSize!==3||attribute.normalized)return fail(names[field]!,0,'Float32 item3 unnormalized',data.constructor.name,'schema');
   const before=new Uint32Array(saved.buffer,saved.byteOffset,saved.byteLength/4),after=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);
   for(let v=0;v<arrays.sourceVertex.length;v++)for(let c=0;c<3;c++){const at=v*3+c,source=arrays.sourceVertex[v]!*3+c;wordsCompared++;if(before[at]!==after[source])return fail(names[field]!,at,before[at],after[source]??null);}
  }
  const liveIndex=index.array;if(!(liveIndex instanceof Uint32Array))return fail('indices',0,'Uint32Array',liveIndex.constructor.name,'schema');
  for(let corner=0;corner<arrays.indices.length;corner++){const expected=arrays.sourceVertex[arrays.indices[corner]!]!;wordsCompared++;if(liveIndex[corner]!==expected)return fail('indices',corner,expected,liveIndex[corner]??null);}
  const headerWords=new Uint32Array(arrays.faceHeader.buffer,arrays.faceHeader.byteOffset,arrays.faceHeader.byteLength/4),edgeWords=new Uint32Array(arrays.canonicalEdges.buffer,arrays.canonicalEdges.byteOffset,arrays.canonicalEdges.byteLength/4),liveRows=new Uint32Array(rows.buffer,rows.byteOffset,rows.byteLength/4);
  for(let face=0;face<arrays.faceId.length;face++){
   const source=arrays.faceId[face]!*8;for(let word=0;word<8;word++){const at=face*8+word;wordsCompared++;if(headerWords[at]!==liveRows[source+word])return fail('faceHeader',at,headerWords[at],liveRows[source+word]??null);}
   const first=arrays.faceEdgeOffset[face]!*36,last=arrays.faceEdgeOffset[face+1]!*36,row=arrays.faceHeader[face*8]!*4;
   for(let at=first;at<last;at++){wordsCompared++;if(edgeWords[at]!==liveRows[row+at-first])return fail('canonicalEdges',at,edgeWords[at],liveRows[row+at-first]??null);}
  }
  // Index and full raw-UV words above also certify the derived triangle-face
  // arrays. Certify the writer panel directory without allocating a new copy.
  let panel=1,offset=36;
  for(const[cell,record]of slots){if(!record.indices.length)continue;const top=panels[panel++];if(!top||top.kind!=='top'||top.cell!==cell||top.slot!==record.slot||top.firstTriangle!==offset/3||top.triangleCount!==2)return fail('trianglePanel',offset/3,'captured top writer','changed writer','panel');
   for(let at=0;at<record.indices.length;at++){const expected=arrays.sourceVertex[arrays.indices[offset+at]!]!;if(record.indices[at]!==expected)return fail('indices',offset+at,expected,record.indices[at]??null,'writer');}
   for(let at=6;at<record.indices.length;at+=12){const side=(record.indices[at]!-24-record.slot*46-6)/6,next=panels[panel++];if(!next||next.kind!=='side'||next.cell!==cell||next.slot!==record.slot||next.side!==side||next.firstTriangle!==(offset+at)/3||next.triangleCount!==4)return fail('trianglePanel',(offset+at)/3,'captured side writer','changed writer','panel');}
   offset+=record.indices.length;
  }
  if(panel!==panels.length||offset!==count)return fail('trianglePanel',offset/3,count,offset,'coverage');
  return{performed:true,equal:true,arrays:13,wordsCompared,diffFirst:null};
 };
 const current=()=>{
  assertExclusive();const names=['position','normal','color',ROCK_SURFACE_UV]as const,nextGeometry=producer.geometry,nextIndex=geometry.index,nextRevision=producer.revision(),nextBuffer=stroke.buffer,nextRows=nextBuffer.array,nextCount=geometry.drawRange.count,nextFields=names.map(name=>geometry.getAttribute(name)),nextVersions=[index.version,...fields.map(a=>a.version),nextBuffer.version];
  // References, writer revision, range and canonical version remain strict.
  // Rebase upload-only attribute/index versions ONLY after active-bit proof.
  const changedGuards:string[]=[];
  if(nextGeometry!==geometry)changedGuards.push('geometryRef');if(nextIndex!==index)changedGuards.push('indexRef');if(nextRevision!==revision)changedGuards.push('producerRevision');if(nextBuffer!==sourceBuffer)changedGuards.push('canonicalBufferRef');if(nextRows!==rows)changedGuards.push('canonicalRowsRef');if(nextCount!==count)changedGuards.push('drawRangeCount');
  for(let i=0;i<fields.length;i++)if(nextFields[i]!==fields[i])changedGuards.push('attributeRef:'+names[i]);
  const versionNames=['index',...names,'canonical']as const;for(let i=0;i<versions.length;i++)if(nextVersions[i]!==versions[i])changedGuards.push('version:'+versionNames[i]);
  if(!changedGuards.length)return;
  let activeComparison:unknown={performed:false,reason:'Strict reference/revision/count/canonical guard changed'};
  if(changedGuards.every(name=>name.startsWith('version:'))&&!changedGuards.includes('version:canonical')){
   try{
    const proof=compareActive();activeComparison=proof;if(proof.equal){for(let i=0;i<versions.length-1;i++)versions[i]=nextVersions[i]!;return;}
   }catch(error){activeComparison={performed:true,equal:null,comparisonError:String(error instanceof Error?error.message:error).slice(0,256)};}
  }
  const details={schema:'rock-final-input-refusal-v1',changedGuards,versions:{names:versionNames,before:versions,after:nextVersions},refs:{geometry:[geometry.id,nextGeometry.id],index:[index.id,nextIndex?.id??null],canonical:[sourceBuffer.id,nextBuffer.id],attributes:fields.map((a,i)=>({name:names[i],before:a.id,after:nextFields[i]?Reflect.get(nextFields[i]!,'id')??null:null})),canonicalRowsSame:nextRows===rows},revision:{before:String(revision).slice(0,192),after:String(nextRevision).slice(0,192)},drawRangeCount:{before:count,after:nextCount},activeComparison};
  throw Error('Rock final Source input superseded '+JSON.stringify(details));
 };
 // Upper bound before ANY dense attribute/canonical allocation. Four edges/face
 // is the real Source limit; reserved model vertices/faces never enter demand.
 if(count*56+count/3*(8+4+32+4+4+4*36*4)+4>LIMIT)throw new RockFinalAdmissionRefusal('Actual indexed Rock preparation exceeds bounded CPU input');
 const panels:RockFinalPanel[]=[],triangleFace=new Uint32Array(count/3),trianglePanel=new Uint32Array(count/3),facePanels=new Map<number,number>();
 const add=(kind:RockFinalPanel['kind'],cell:number,slot:number,side:number,start:number,length:number)=>{const id=panels.length;panels.push(Object.freeze({id,stableKey:`${cell}:${kind}:${side}`,kind,cell,slot,side,firstTriangle:start/3,triangleCount:length/3}));for(let at=start;at<start+length;at+=3){const face=rawUv.getZ(sourceIndex[at]!);if(!uint(face)||Math.fround(face)!==face||face>=stroke.faceCount||rawUv.getZ(sourceIndex[at+1]!)!==face||rawUv.getZ(sourceIndex[at+2]!)!==face)throw new RockFinalAdmissionRefusal('Exact constant Source face ID required');const prior=facePanels.get(face);if(prior!==undefined&&prior!==id)throw Error('Source face crossed Rock panels');facePanels.set(face,id);triangleFace[at/3]=face;trianglePanel[at/3]=id;}};
 for(let at=0;at<36;at++)if(sourceIndex[at]!>=24)throw new RockFinalAdmissionRefusal('Actual six-face slab order required');add('slab',-1,-1,-1,0,36);
 let at=36;for(const[cell,record]of slots){const values=record.indices;if(!values.length)continue;const base=24+record.slot*46;if(!uint(cell)||cell>=width*height||!uint(record.slot)||values.length<6||(values.length-6)%12||values.length>54||at+values.length>count||values.some((v,j)=>sourceIndex[at+j]!==v))throw Error('Current Rock writer indices required');for(let j=0;j<6;j++)if(values[j]!==base+j)throw Error('Rock top split changed');add('top',cell,record.slot,-1,at,6);for(let j=6;j<values.length;j+=12){const side=(values[j]!-base-6)/6;if(!uint(side)||side>3)throw Error('Rock side association changed');const expected=[0,1,2,3,4,5].map(k=>base+6+side*6+k).concat([0,1,2,0,2,3].map(k=>base+30+side*4+k));if(expected.some((v,k)=>v!==values[j+k]))throw Error('Rock upper/lower split changed');add('side',cell,record.slot,side,at+j,12);}at+=values.length;}if(at!==count)throw Error('Every actual Rock index must have a writer panel');
 const unique=[...new Set(sourceIndex.subarray(0,count))].sort((a,b)=>a-b),sourceVertex=Uint32Array.from(unique),remap=new Map(unique.map((v,i)=>[v,i])),indices=Uint32Array.from(sourceIndex.subarray(0,count),v=>remap.get(v)!),copy=(a:THREE.BufferAttribute)=>{const out=new Float32Array(unique.length*3);for(let i=0;i<unique.length;i++){const v=unique[i]!;if(v>=a.count)throw Error('Actual Rock vertex outside Source field');out.set((a.array as Float32Array).subarray(v*3,v*3+3),i*3);}return out;};
 const faceId=Uint32Array.from([...facePanels.keys()].sort((a,b)=>a-b)),faceHeader=new Float32Array(faceId.length*8),faceEdgeOffset=new Uint32Array(faceId.length+1),facePanel=new Uint32Array(faceId.length);let edges=0;
 for(let i=0;i<faceId.length;i++){const offset=faceId[i]!*8,h=rows.subarray(offset,offset+8),row=h[0]!,n=h[1]!;if(h.length!==8||!uint(row)||!uint(n)||n>4||row*4+n*36>rows.length||h.some(v=>!Number.isFinite(v)))throw Error('Actual Source canonical Rock header required');faceHeader.set(h,i*8);faceEdgeOffset[i]=edges;edges+=n;facePanel[i]=facePanels.get(faceId[i]!)!;}faceEdgeOffset[faceId.length]=edges;
 const canonicalEdges=new Float32Array(edges*36);for(let i=0;i<faceId.length;i++)canonicalEdges.set(rows.subarray(faceHeader[i*8]!*4,faceHeader[i*8]!*4+faceHeader[i*8+1]!*36),faceEdgeOffset[i]!*36);
 const arrays=Object.freeze({position:copy(position),normal:copy(normal),color:copy(color),rockSurfaceUv:copy(rawUv),sourceVertex,indices,triangleFace,trianglePanel,faceId,faceHeader,faceEdgeOffset,facePanel,canonicalEdges}),cpuBytes=Object.values(arrays).reduce((n,a)=>n+a.byteLength,0);
 if(cpuBytes>LIMIT||Object.values(arrays).some(a=>a instanceof Float32Array&&a.some(v=>!Number.isFinite(v))))throw new RockFinalAdmissionRefusal('Bounded finite actual Rock preparation refused');current();return{arrays,panels:Object.freeze(panels),faceSpan:stroke.faceCount,cpuBytes,width,height,revision:()=>revision,assertCurrent:current};
}
