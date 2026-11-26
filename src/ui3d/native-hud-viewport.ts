import * as THREE from 'three/webgpu';

export const HUD_DISTANCE=7.5;
export const nativeHudCamera=(aspect:number)=>new THREE.PerspectiveCamera(34,aspect,.1,220);

export function lightNativeHud(scene:THREE.Scene,camera:THREE.Camera):void {
    scene.add(new THREE.AmbientLight(0xfff5e4,1.45));
    const sun=new THREE.DirectionalLight(0xfff2d6,1.9);sun.position.set(18,28,22);scene.add(sun);
    const key=new THREE.DirectionalLight(0xfffaf0,.85);key.position.set(-3,5,4);camera.add(key);
}
export function placeBottomRight(anchor:THREE.Group,halfW:number,halfH:number,scale:number):void {
  anchor.position.set(halfW-.08*scale,-halfH+.08*scale,0);
}
export function nativeManagementDock(surfaceWidth:number,width:number,height:number,count:number){
    const dockScale=Math.min(1.18,(surfaceWidth-32)/860),capacity=Math.max(1,Math.min(count,Math.floor((width-24)/(67.5*dockScale))));
    const paged=height<500&&capacity<count;
    const rows=paged?1:Math.ceil(count/capacity),columns=paged?Math.max(1,Math.floor((width-100)/(67.5*dockScale))):Math.ceil(count/rows);
  return {dockScale,paged,columns,bottomDockHeight:Math.ceil((.76+(rows-1)*.64)*100*dockScale+8)};
}
