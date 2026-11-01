import {expect,it} from 'vitest';
import {applyNativeMapToolHover} from '../src/ui3d/native-map-tool-hover';
import type {CardboardPiece} from '../src/ui3d/prototype-art';
function vector(x=0,y=0,z=0){return{x,y,z,set(a:number,b:number,c:number){this.x=a;this.y=b;this.z=c;return this;}};}
function piece(){return{position:vector(2,3,.08),rotation:vector(0,0,.01),scale:vector(1,1,1),userData:{basePos:vector(2,3,.08),baseRot:vector(0,0,.01),baseScale:vector(1,1,1),pressVal:0,active:false,shadowMesh:{position:vector()}}} as unknown as CardboardPiece;}
it('enlarges only the focused tool about its fixed centre and restores its unchanged layout basis',()=>{
 const focus=piece(),neighbour=piece(),before=JSON.stringify(neighbour),basis=JSON.stringify([focus.userData.basePos,focus.userData.baseRot,focus.userData.baseScale]);
 for(const h of[0,.2,.6,1]){applyNativeMapToolHover(focus,h);expect([focus.position.x,focus.position.y]).toEqual([2,3]);}
 expect(focus.scale.x).toBeGreaterThan(1);expect(focus.position.z).toBeGreaterThan(.08);expect(JSON.stringify(neighbour)).toBe(before);
 expect(applyNativeMapToolHover(focus,1)).toBe(false);applyNativeMapToolHover(focus,0);expect([focus.scale.x,focus.scale.y,focus.scale.z]).toEqual([1,1,1]);expect(focus.position.z).toBe(.08);expect(JSON.stringify([focus.userData.basePos,focus.userData.baseRot,focus.userData.baseScale])).toBe(basis);
});
it('preserves nonunit base scale and active depth through bounded hover and press states',()=>{
 const focus=piece();focus.userData.baseScale.set(2,3,4);focus.userData.active=true;focus.userData.pressVal=1;
 applyNativeMapToolHover(focus,2);expect(focus.scale.y/focus.scale.x).toBeCloseTo(1.5);expect(focus.scale.z/focus.scale.x).toBeCloseTo(2);expect(focus.position.z).toBeGreaterThan(.08);
 focus.userData.pressVal=0;applyNativeMapToolHover(focus,-1);expect([focus.scale.x,focus.scale.y,focus.scale.z]).toEqual([2,3,4]);expect(focus.position.z).toBeGreaterThan(.08);expect([focus.position.x,focus.position.y]).toEqual([2,3]);
});
