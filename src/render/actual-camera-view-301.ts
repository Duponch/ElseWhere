import {Frustum,Matrix4,Vector3,type OrthographicCamera,type PerspectiveCamera} from 'three/webgpu';
import {MAX_EXTENDED_MAP_SIZE} from '../sim/map-config.ts';
import type {ActualView301} from '../sim/actual-view-301.ts';

/** Local 3D adaptation, in ground-cell units at the orbit target, NOT native pixels. */
export function actualZoomBand301(span:number):ActualView301['zoomBand'] {return span<=16?0:span<=24?1:span<=36?2:span<=54?3:4;}
/** Clip the actual map ground quad against all six camera planes. Unlike four
 * corner rays this remains conservative when the perspective horizon is visible.
 * The renderer uses WebGPU depth [0,1], as recorded on this actual camera. */
export function actualCameraView301(camera:OrthographicCamera|PerspectiveCamera,mapId:number,width:number,height:number,span:number):ActualView301|null {
 if(![mapId,width,height].every(Number.isSafeInteger)||mapId<0||width<1||height<1||width>MAX_EXTENDED_MAP_SIZE||height>MAX_EXTENDED_MAP_SIZE||!Number.isFinite(span)||span<=0)return null;
 camera.updateMatrixWorld(true);
 const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
 let polygon=[new Vector3(-.5,0,-.5),new Vector3(width-.5,0,-.5),new Vector3(width-.5,0,height-.5),new Vector3(-.5,0,height-.5)];
 for(const plane of frustum.planes){const next:Vector3[]=[];for(let i=0;i<polygon.length;i++){const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,da=plane.distanceToPoint(a),db=plane.distanceToPoint(b);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));}polygon=next;if(!polygon.length)return null;}
 const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.z);
 if(![...xs,...zs].every(Number.isFinite))return null;
 // Conservative closed-square intersection: reconstructed camera planes can
 // put an exact half-cell boundary a few Double ulps below its real value.
 // The1e-8-cell tolerance prevents that numeric error from dropping a row.
 const epsilon=1e-8;
 return {mapId,minX:Math.max(0,Math.ceil(Math.min(...xs)-.5-epsilon)-1),minZ:Math.max(0,Math.ceil(Math.min(...zs)-.5-epsilon)-1),maxX:Math.min(width-1,Math.floor(Math.max(...xs)+.5+epsilon)+1),maxZ:Math.min(height-1,Math.floor(Math.max(...zs)+.5+epsilon)+1),zoomBand:actualZoomBand301(span)};
}
