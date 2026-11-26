import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {FLOAT_MENU_PRIORITY as P,compareFloatMenuOptions,floatMenuDistance,floatMenuOpacity,floatMenuVanishes} from '../src/ui3d/native-float-menu';
import {layoutNativePage} from '../src/ui3d/native-layout';
import {applyNativeOpacity,retainNativeOpacityMaterials} from '../src/ui3d/native-piece-opacity';
import {NativeDamageTracker} from '../src/ui3d/NativeDamageTracker';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';

describe('Core 1.6.4871 FloatMenu priority, fade and retained materials',()=>{
  it('sorts real provider metadata, then descending orderInPriority, with disabled last and exact ties stable',()=>{
    const option=(id:string,floatMenuPriority?:number,orderInPriority?:number,disabled=false):NativeControl=>({id,label:id,floatMenuPriority,orderInPriority,disabled,onActivate:()=>{}});
    const controls=[option('Z work'),option('A work'),option('disabled rescue',P.RescueOrCapture,0,true),option('move',P.GoHere),option('friendly attack',P.VeryLow),
      option('equip',P.High),option('rescue',P.RescueOrCapture),option('hostile attack',P.AttackEnemy),option('work preferred',P.Default,2),option('work late',P.Default,-1)];
    const expected=['rescue','hostile attack','equip','work preferred','Z work','A work','work late','friendly attack','move','disabled rescue'];
    expect([...controls].sort(compareFloatMenuOptions).map(c=>c.id)).toEqual(expected);
    const page:NativePage={id:'provider-options',title:'Ada',floatMenu:{x:300,y:200},rows:controls.map(control=>({id:control.id,label:control.label,controls:[control]}))};
    const box=layoutNativePage(page,{width:1000,height:720},false,(text,size)=>text.length*size*.5);
    expect(box.rows.map(row=>row.controls[0]!.control.id)).toEqual(expected);
    expect(page.rows.map(row=>row.controls![0])).toEqual(controls);
  });
  it('fades linearly from the rectangle expanded by5, with Euclidean corner distances and closure strictly past95',()=>{
    const box={x:200,y:100,width:150,height:80};
    expect(floatMenuOpacity(box,195,100)).toBe(1);
    expect(floatMenuOpacity(box,195-47.5,100)).toBe(.5);
    expect(floatMenuDistance(box,195-30,95-40)).toBe(50);
    expect(floatMenuOpacity(box,195-95,100)).toBe(0);expect(floatMenuVanishes(box,195-95,100)).toBe(false);
    expect(floatMenuVanishes(box,195-95.01,100)).toBe(true);expect(floatMenuOpacity(box,195-100,100)).toBe(0);
  });
  it('fades front, edge and shadow without repainting, preserves shared art and invalidates retained damage only on changes',()=>{
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,20);camera.position.z=5;
    const piece=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,.1),front=new THREE.MeshBasicMaterial(),edge=new THREE.MeshBasicMaterial(),shadow=new THREE.MeshBasicMaterial({transparent:true,opacity:.34});
    const face=new THREE.Mesh(geometry,[front,edge]),shadowMesh=new THREE.Mesh(geometry,shadow);shadowMesh.position.set(.1,-.1,-.2);piece.add(face,shadowMesh);scene.add(piece);
    const materials=retainNativeOpacityMaterials(piece,new Set([edge,shadow])),tracker=new NativeDamageTracker();
    expect(materials).toHaveLength(3);expect(face.material[0]).toBe(front);expect(face.material[1]).not.toBe(edge);expect(shadowMesh.material).not.toBe(shadow);
    const redraw=vi.fn(),art={resourceRevision:10},invalidate=vi.fn(),menu={opacity:1,materials};
    const stage=Object.assign(Object.create(NativeStage.prototype),{floatMenu:menu,art,sceneRevision:0,invalidate,redraw}) as {setFloatMenuOpacity:(opacity:number)=>void;sceneRevision:number};
    expect(tracker.collect(scene,camera,800,600,art.resourceRevision)?.full).toBe(true);
    expect(tracker.collect(scene,camera,800,600,art.resourceRevision)).toBeNull();
    stage.setFloatMenuOpacity(.5);
    expect(materials.map(entry=>entry.material.opacity)).toEqual([.5,.5,.17]);expect(edge.opacity).toBe(1);expect(shadow.opacity).toBe(.34);
    expect(art.resourceRevision).toBe(11);expect(stage.sceneRevision).toBe(1);expect(invalidate).toHaveBeenCalledOnce();expect(redraw).not.toHaveBeenCalled();
    const damage=tracker.collect(scene,camera,800,600,art.resourceRevision);expect(damage?.full).not.toBe(true);expect(damage?.objects?.has(face)).toBe(true);
    stage.setFloatMenuOpacity(.5);expect(art.resourceRevision).toBe(11);expect(invalidate).toHaveBeenCalledOnce();
    expect(tracker.collect(scene,camera,800,600,art.resourceRevision)).toBeNull();
    expect(applyNativeOpacity(materials,1)).toBe(true);expect(materials.map(entry=>entry.material.opacity)).toEqual([1,1,.34]);
    geometry.dispose();for(const material of new Set([...materials.map(entry=>entry.material),edge,shadow]))material.dispose();
  });
});
