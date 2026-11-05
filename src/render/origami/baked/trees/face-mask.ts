/** Convex tree-face coverage. Only mask coordinates change; pigment/paper stay Source.
 * True convex physical chart boundaries, not UV bboxes or triangle diagonals. */
import * as THREE from 'three/webgpu';
import {Fn,If,attribute,float,texture,varying,vec2} from 'three/tsl';
import {projectBakedChart,type BakedChartSet,type Vec2} from '../charts';
export interface LegacyFaceMask {chart:number;edges:readonly (readonly[number,number,number,number])[];span:number;center:Vec2}
const key=(p:Vec2)=>p.map(v=>Math.round(v*1e7)).join(':'),cross=(a:Vec2,b:Vec2)=>a[0]*b[1]-a[1]*b[0];
function edgePoint(charts:BakedChartSet,triangle:number,corner:number):Vec2{const t=charts.triangles[triangle],p=charts.geometry.getAttribute('position');if(!t)throw Error('Legacy mask body triangle missing');const v=t.outputVertices[corner]!,chart=charts.charts[t.chartId]!;return projectBakedChart(chart,[p.getX(v),p.getY(v),p.getZ(v)]);}
/** Source painter: imp>0.01, maxMargin=round(imp*44), white fillRect. Half a
 * texel is the hardware bilinear centre guard, not a visual threshold. */
export function legacyMaskMargin(fill:number,size:number){if(!Number.isFinite(fill)||fill<0||fill>1||!Number.isSafeInteger(size)||size<128)throw Error('Legacy mask Source domain refused');return{pixels:fill>.01?Math.round(fill*44):0,safe:(fill>.01?Math.round(fill*44)+.5:0)/size};}
export function compileLegacyFaceMasks(charts:BakedChartSet):readonly LegacyFaceMask[]{
 if(charts.triangles.length>100||charts.charts.length>100)throw Error('Tree mask admits at most100triangles');
 return Object.freeze(charts.charts.map(chart=>{const remaining=chart.boundaryEdges.map(e=>({a:edgePoint(charts,e.triangle,e.fromCorner),b:edgePoint(charts,e.triangle,e.toCorner)}));if(remaining.length<3||remaining.length>6)throw Error('Legacy mask requires true3/4/5/6-edge chart boundary');
  const ring:Vec2[]=[remaining[0]!.a];let next=remaining[0]!.b;remaining.splice(0,1);while(remaining.length){ring.push(next);const i=remaining.findIndex(e=>key(e.a)===key(next));if(i<0)throw Error('Legacy mask boundary is not one oriented closed ring');next=remaining[i]!.b;remaining.splice(i,1);}if(key(next)!==key(ring[0]!))throw Error('Legacy mask boundary open');
  let sign=0,twiceArea=0,cx=0,cy=0;for(let i=0;i<ring.length;i++){const a=ring[i]!,b=ring[(i+1)%ring.length]!,c=ring[(i+2)%ring.length]!,turn=cross([b[0]-a[0],b[1]-a[1]],[c[0]-b[0],c[1]-b[1]]);if(Math.abs(turn)<1e-12)throw Error('Legacy mask collinear chart edge refused');if(sign&&Math.sign(turn)!==sign)throw Error('Legacy mask nonconvex chart refused');sign=Math.sign(turn);const w=cross(a,b);twiceArea+=w;cx+=(a[0]+b[0])*w;cy+=(a[1]+b[1])*w;}if(Math.abs(twiceArea)<1e-12)throw Error('Legacy mask degenerate chart');const center:Vec2=[cx/(3*twiceArea),cy/(3*twiceArea)];
  const edges=ring.map((a,i)=>[a[0],a[1],ring[(i+1)%ring.length]![0],ring[(i+1)%ring.length]![1]] as const),radius=Math.min(...edges.map(([ax,ay,bx,by])=>Math.abs((bx-ax)*(center[1]-ay)-(by-ay)*(center[0]-ax))/Math.hypot(bx-ax,by-ay)));if(!(radius>1e-8))throw Error('Legacy mask interior radius refused');
  return Object.freeze({chart:chart.id,edges:Object.freeze(edges),span:radius*2,center});
 }));
}
/** Barycentric position -> true physical plane. No new raster/display geometry. */
export function maskPoint(charts:BakedChartSet,triangle:number,bary:readonly[number,number,number]):Vec2{if(Math.abs(bary.reduce((n,v)=>n+v,0)-1)>1e-10||bary.some(v=>v<0))throw Error('Interior barycentrics required');const p=[0,0];for(let c=0;c<3;c++){const q=edgePoint(charts,triangle,c);p[0]+=q[0]*bary[c]!;p[1]+=q[1]*bary[c]!;}return[p[0]!,p[1]!];}
/** Coverage combines actual edge strips; order-independent MIN avoids seams
 * where the nearest edge switches. Outside ALL Source bands coverage is ONE. */
export function legacyMaskSamples(model:LegacyFaceMask,p:Vec2,fill:number,size=512):Vec2[]{const margin=legacyMaskMargin(fill,size);if(!margin.pixels)return[];const out:Vec2[]=[];for(const[ax,ay,bx,by]of model.edges){const ex=bx-ax,ey=by-ay,l=Math.hypot(ex,ey),d=Math.abs(ex*(p[1]-ay)-ey*(p[0]-ax))/l/model.span;if(d>=margin.safe)continue;const along=THREE.MathUtils.clamp(((p[0]-ax)*ex+(p[1]-ay)*ey)/(l*l),0,1);out.push([margin.safe+along*(1-2*margin.safe),Math.min(.5,d)]);}return out;}
export function attachLegacyMaskAttributes(body:THREE.BufferGeometry,charts:BakedChartSet):THREE.BufferGeometry{
 const models=compileLegacyFaceMasks(charts),count=body.getAttribute('position').count;if(body.index||count!==charts.triangles.length*3)throw Error('Legacy mask bake corner stream changed');const extra=new Map<string,{size:number;values:Float32Array}>();for(const[n,size]of [['bakeMaskPoint',2],['bakeMaskInfo',2],...Array.from({length:6},(_,i)=>['bakeMaskEdge'+i,4])] as [string,number][])extra.set(n,{size,values:new Float32Array(count*size)});
 for(const t of charts.triangles){const m=models[t.chartId]!;for(let c=0;c<3;c++){const v=t.id*3+c;extra.get('bakeMaskPoint')!.values.set(edgePoint(charts,t.id,c),v*2);extra.get('bakeMaskInfo')!.values.set([m.edges.length,m.span],v*2);for(let i=0;i<6;i++)extra.get('bakeMaskEdge'+i)!.values.set(m.edges[i]??[0,0,0,0],v*4);}}
 const old=Object.entries(body.attributes),stride=old.reduce((n,[,a])=>n+a.itemSize,0)+28,data=new Float32Array(count*stride),packed=new THREE.InterleavedBuffer(data,stride),g=new THREE.BufferGeometry();let offset=0;for(const[n,a]of old){for(let v=0;v<count;v++)for(let c=0;c<a.itemSize;c++)data[v*stride+offset+c]=a.getComponent(v,c);g.setAttribute(n,new THREE.InterleavedBufferAttribute(packed,a.itemSize,offset));offset+=a.itemSize;}for(const[n,a]of extra){for(let v=0;v<count;v++)data.set(a.values.subarray(v*a.size,(v+1)*a.size),v*stride+offset);g.setAttribute(n,new THREE.InterleavedBufferAttribute(packed,a.size,offset));offset+=a.size;}if(Object.keys(g.attributes).length>16)throw Error('Legacy bake attribute budget exceeded');body.dispose();return g;
}
export interface LegacyCoverageInputs {readonly point:THREE.Node<'vec2'>;readonly info:THREE.Node<'vec2'>;readonly edges:readonly THREE.Node<'vec4'>[];readonly fill:number|THREE.Node<'float'>;readonly margin?:THREE.Node<'float'>;readonly size:number;readonly sample:(coordinates:THREE.Node<'vec2'>)=>THREE.Node<'float'>}
/** Shared exact algebra for offline tree bake and complete runtime fallback. */
export function legacyCoverageFromInputs(input:LegacyCoverageInputs):THREE.Node<'float'>{
 const numeric=typeof input.fill==='number'?legacyMaskMargin(input.fill,input.size):undefined,fill=typeof input.fill==='number'?float(input.fill):input.fill,margin=input.margin??(numeric?float(numeric.safe):fill.greaterThan(.01).select(fill.mul(44).add(.5).floor().add(.5).div(input.size),float(0))),point=input.point,info=input.info;
 if(input.edges.length!==6)throw Error('Six bounded actual polygon edges required');
 return Fn(()=>{const coverage=float(1).toVar(numeric?'privateLegacyFaceCoverage':undefined);if(numeric?.pixels===0)return coverage;for(let i=0;i<6;i++){const edge=input.edges[i]!,e=edge.zw.sub(edge.xy),q=point.sub(edge.xy),length=e.length().max(1e-12),distance=e.x.mul(q.y).sub(e.y.mul(q.x)).abs().div(length).div(info.y);
  If(info.x.greaterThan(i).and(distance.lessThan(margin)),()=>{const along=q.dot(e).div(length.mul(length)).clamp(0,1),coords=vec2(numeric?along.mul(1-2*numeric.safe).add(numeric.safe):along.mul(float(1).sub(margin.mul(2))).add(margin),distance.min(.5)),sample=input.sample(coords);coverage.assign(coverage.min(sample));});}return coverage;})();
}
export function legacyCoverageNode(km:THREE.DataArrayTexture,layer:THREE.Node<'float'>,fill:number,size:number):THREE.Node<'float'>{
 const point=varying(attribute('bakeMaskPoint','vec2'),'v_legacyMaskPoint'),info=varying(attribute('bakeMaskInfo','vec2'),'v_legacyMaskInfo').setInterpolation('flat'),edges=Array.from({length:6},(_,i)=>varying(attribute('bakeMaskEdge'+i,'vec4'),'v_legacyMaskEdge'+i).setInterpolation('flat'));
 return legacyCoverageFromInputs({point,info,edges,fill,size,sample:coords=>texture(km,coords).depth(layer).level(float(0)).a});
}
