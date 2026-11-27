import * as THREE from 'three/webgpu';
import {mechanicalPaint,mechanicalFacePaintUv,type MechanicalPaintChart} from './mechanical-surface-art';

type Point=readonly [number,number,number];
export interface ScytherVisualPart {readonly part:string;readonly bone:number;readonly size:Point;readonly center:Point;readonly pivot:Point;readonly color:number;readonly roll?:number}
const body=0xa3b4b0,joint=0x627a79,blade=0xc8d3c8,sensor=0xc8a981;
/** Original faceted silhouette, authored here; no extracted game asset. The
 * eighteen boxes are shared by every living Scyther and mechanical carcass. */
export const SCYTHER_VISUAL_PARTS:readonly ScytherVisualPart[]=Object.freeze([
  {part:'torso',bone:0,size:[.62,.61,.36],center:[0,1.12,0],pivot:[0,0,0],color:body},
  {part:'torso',bone:0,size:[.30,.35,.12],center:[0,1.10,-.23],pivot:[0,0,0],color:joint},
  {part:'neck',bone:0,size:[.16,.16,.15],center:[0,1.48,.025],pivot:[0,0,0],color:joint},
  {part:'head',bone:5,size:[.36,.27,.29],center:[0,1.67,.055],pivot:[0,1.48,.025],color:body},
  {part:'left-eye',bone:5,size:[.065,.055,.022],center:[-.10,1.69,.211],pivot:[0,1.48,.025],color:sensor},
  {part:'right-eye',bone:5,size:[.065,.055,.022],center:[.10,1.69,.211],pivot:[0,1.48,.025],color:sensor},
  ...([-1,1] as const).flatMap((side)=>{
    const name=side===-1?'left':'right',arm=side===-1?1:2,leg=side===-1?3:4;
    const shoulder:Point=[side*.39,1.34,.02],hip:Point=[side*.18,.84,0];
    return [
      {part:`${name}-shoulder`,bone:arm,size:[.22,.22,.25],center:[side*.39,1.33,.02],pivot:shoulder,color:joint},
      {part:`${name}-arm`,bone:arm,size:[.17,.47,.17],center:[side*.48,1.04,.08],pivot:shoulder,color:body},
      {part:`${name}-hand`,bone:arm,size:[.19,.16,.19],center:[side*.52,.75,.12],pivot:shoulder,color:joint},
      {part:`${name}-blade`,bone:arm,size:[.075,.57,.19],center:[side*.57,.57,.35],pivot:shoulder,color:blade,roll:-.42},
      {part:`${name}-leg`,bone:leg,size:[.20,.63,.20],center:[side*.18,.48,0],pivot:hip,color:body},
      {part:`${name}-foot`,bone:leg,size:[.26,.13,.36],center:[side*.18,.10,.08],pivot:hip,color:joint},
    ] satisfies ScytherVisualPart[];
  }),
]);
export const SCYTHER_MAX_VISUAL_BOXES=20;

/** Anatomical indices are provided by the immutable clinical model. Two exact
 * 16-bit portions avoid storing an unsigned 32-bit mask in a float. */
export function scytherGeometry(capacity:number,partIndex:(id:string)=>number):THREE.InstancedBufferGeometry {
  return mechanicalGeometry(SCYTHER_VISUAL_PARTS,capacity,partIndex);
}

/** Front faces have a visor or panel, backs have ventilation. Narrow pieces
 * use recessed seams and joints instead of repeating the large body panel. */
function paintChart(part: ScytherVisualPart, face: number): MechanicalPaintChart {
  const name=part.part, [sx,sy,sz]=part.size;
  if(name.endsWith('-eye'))return mechanicalPaint.sensor;
  if(name.endsWith('-blade'))return mechanicalPaint.edge;
  if(name==='head')return face===4?mechanicalPaint.head:mechanicalPaint.panel;
  if(name==='neck'||name.endsWith('-hand')||name.endsWith('-shoulder'))return mechanicalPaint.joint;
  if(name.endsWith('-foot'))return mechanicalPaint.rim;
  if(name==='torso'){
    if(sx<=.23&&sz>=.4)return face===4||face===5?mechanicalPaint.cap:mechanicalPaint.housing;
    if(sx<.35&&sy<.36&&part.center[2]<0)return mechanicalPaint.vent;
    return face===5||face===2?mechanicalPaint.vent:mechanicalPaint.panel;
  }
  return sy>sx*1.5?mechanicalPaint.limb:mechanicalPaint.joint;
}

/** Shared format, authored silhouette and clinical indices supplied per race. */
export function mechanicalGeometry(parts:readonly ScytherVisualPart[],capacity:number,partIndex:(id:string)=>number):THREE.InstancedBufferGeometry {
  if(parts.length>SCYTHER_MAX_VISUAL_BOXES)throw Error('Mechanical geometry exceeds its resident shape budget.');
  const vertices:number[]=[],paintUvs:number[]=[];
  for(const part of parts){
    const index=partIndex(part.part);if(!Number.isInteger(index)||index<0||index>=32)throw Error(`Missing mechanical visual part ${part.part}.`);
    const box=new THREE.BoxGeometry(...part.size).toNonIndexed();if(part.roll)box.rotateX(part.roll);
    const positions=box.getAttribute('position'),normals=box.getAttribute('normal'),uv=box.getAttribute('uv'),color=new THREE.Color(part.color);
    for(let i=0;i<uv.count;i++){
      const face=Math.floor(i/6),[sx,sy,sz]=part.size;
      // Axis pairs are defined by BoxGeometry before a blade's local roll.
      const width=face<2?sz:sx,height=face===2||face===3?sz:sy;
      paintUvs.push(...mechanicalFacePaintUv(paintChart(part,face),uv.getX(i),uv.getY(i),width,height));
    }
    for(let i=0;i<positions.count;i++)vertices.push(
      positions.getX(i)+part.center[0],positions.getY(i)+part.center[1],positions.getZ(i)+part.center[2],
      normals.getX(i),normals.getY(i),normals.getZ(i),color.r,color.g,color.b,
      part.bone,2**(index%16),index>=16?1:0,Math.sign(part.center[0]),...part.pivot,
    );
    box.dispose();
  }
  const geometry=new THREE.InstancedBufferGeometry(),data=new THREE.InterleavedBuffer(new Float32Array(vertices),16);
  for(const [name,size,offset] of [['position',3,0],['normal',3,3],['color',3,6],['mechPart',4,9],['bindPivot',3,13]] as const)
    geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(data,size,offset));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(paintUvs,2));
  const instances=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*34),34).setUsage(THREE.StaticDrawUsage);
  for(const [name,size,offset] of [['aFrom',4,0],['aTo',4,4],['aTravel',4,8],['aRig',4,12],['aMask',2,16],['aGait',2,18],['aCarrier',4,20],['aCorpseHandoff',2,24],['aCorpseFrom',4,26],['aCorpseTo',4,30]] as const)
    geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(instances,size,offset));
  geometry.instanceCount=0;geometry.computeBoundingBox();return geometry;
}
