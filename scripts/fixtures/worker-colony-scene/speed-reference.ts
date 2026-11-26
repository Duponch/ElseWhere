import * as THREE from 'three/webgpu';
import {NativeHudCards} from '../../../src/ui3d/native-hud';
import {NativeOverlayCache} from '../../../src/ui3d/NativeOverlayCache';
import {PrototypeCardboardArt} from '../../../src/ui3d/prototype-art';

/** Browser oracle for the exact four ordinary native controls in a 768 x 512
 * viewport. Other cards are detached before the capture. The reference uses
 * the original native stage camera, light values and bottom-right coordinates. */
export function makeNativeSpeedReference(renderer:THREE.WebGPURenderer,speed:number){
  const camera=new THREE.PerspectiveCamera(34,768/512,.1,220),scene=new THREE.Scene();
  const root=new THREE.Group(),cache=new NativeOverlayCache(),art=new PrototypeCardboardArt();
  root.position.z=-7.5;camera.add(root);scene.add(camera);
  scene.add(new THREE.AmbientLight(0xfff5e4,1.45));
  const sun=new THREE.DirectionalLight(0xfff2d6,1.9);sun.position.set(18,28,22);scene.add(sun);
  const key=new THREE.DirectionalLight(0xfffaf0,.85);key.position.set(-3,5,4);camera.add(key);
  const anchors={topCenter:new THREE.Group(),topLeft:new THREE.Group(),topRight:new THREE.Group(),bottomRight:new THREE.Group()};
  root.add(anchors.bottomRight);
  const hud=new NativeHudCards(art,anchors,{selectPawn(){},showPage(){},speed(){}});
  hud.setViewport(768,512,.01,74);hud.update(undefined,speed,0);
  hud.animate(1); // Settled pose on the confirmed pause.
  const group=anchors.bottomRight.children.find(g=>g.children.some(c=>c.userData.nativeId==='hud:speed:0'))!;
  group.visible=true;
  for(const child of group.children)child.visible=String(child.userData.nativeId).startsWith('hud:speed:');
  const visH=2*Math.tan(34*Math.PI/360)*7.5,s=visH/512*100;
  anchors.bottomRight.scale.setScalar(s);anchors.bottomRight.position.set(visH*(768/512)/2-.08*s,-visH/2+.08*s,0);
  return ()=>cache.draw(renderer,scene,camera,1,false);
}
