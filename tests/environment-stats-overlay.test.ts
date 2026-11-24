import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {EnvironmentStatsOverlay,environmentRoomEdges,environmentBeautyBracket,environmentBeautyLabels} from '../src/render/EnvironmentStatsOverlay';
import {MapLabelBatch} from '../src/render/MapLabelBatch';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {CardboardPiece,CardboardPieceOptions} from '../src/ui3d/prototype-art';
import {environmentBeautyColor,paintNativeEnvironmentStats} from '../src/ui3d/native-environment-ink';
import {layoutNativeEnvironmentStats,type NativeEnvironmentStats} from '../src/ui3d/native-environment-stats';

const stats:NativeEnvironmentStats={cell:{x:2,z:1},room:{title:'Chambre',cells:[5,6,9],stats:[
 {id:'impressiveness',label:'Impression',value:'42',stage:'Convenable',related:true},
 {id:'wealth',label:'Richesse',value:'750',stage:'Médiocre',related:true},
 {id:'space',label:'Espace',value:'12',stage:'Exiguë',related:true},
 {id:'beauty',label:'Beauté',value:'2.50',stage:'Jolie',related:true},
 {id:'cleanliness',label:'Propreté',value:'0.02',stage:'Propre',related:true},
]},beauty:{average:1.12,cells:[{x:2,z:1,value:8},{x:1,z:1,value:-8},{x:1,z:2,value:2.5},{x:2,z:2,value:0}]}};

describe('map presentation of environment facts, without a GPU device',()=>{
 it('draws only exposed edges of the actual L-shaped room and the hovered cell corners',()=>{
  const edges=environmentRoomEdges(4,4,stats.room!.cells);
  expect(edges).toHaveLength(8); // 3 cells, two shared full sides.
  const [w,n,e,s]=edges[0]!;expect([w,n,e,s].every(Number.isFinite)).toBe(true);
  expect(edges.some(([x0,z0,x1,z1])=>x0===1.5&&x1===1.575&&z0===.5&&z1===1.5)).toBe(false);
  expect(environmentRoomEdges(4,4,[3,4])).toHaveLength(8); // no wrap at the row boundary
  const bracket=environmentBeautyBracket(stats.cell);expect(bracket).toHaveLength(8);
  expect(bracket.every(([x0,z0,x1,z1])=>x0>=1.5&&x1<=2.5&&z0>=.5&&z1<=1.5)).toBe(true);
 });
 it('uses the simulator-projected per-cell values and a distinct tinted glyph batch',()=>{
  const labels=environmentBeautyLabels(stats);
  expect(labels.map(({x,z,label})=>({x,z,label}))).toEqual([{x:2,z:1,label:'8'},{x:1,z:1,label:'-8'},{x:1,z:2,label:'2'}]);
  expect(labels[0]!.color).toBe(environmentBeautyColor(8,8,true));expect(labels[1]!.color).toBe(environmentBeautyColor(-8,8,true));expect(labels[0]!.color).not.toBe(labels[1]!.color);
  const ordinary=new MapLabelBatch(),overlay=new EnvironmentStatsOverlay();
  try{
   expect(ordinary.mesh.geometry.getAttribute('labelTint')).toBeUndefined();
   overlay.update(4,4,stats);const batch=overlay.group.getObjectByName('environment-beauty-glyphs') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshBasicNodeMaterial>;
   expect(batch.geometry.getAttribute('labelTint')).toBeDefined();expect(batch.material.depthTest).toBe(false);expect(batch.geometry.instanceCount).toBe(4);
   const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);overlay.present(camera,900,40);expect(batch.visible).toBe(true);
   const tint=batch.geometry.getAttribute('labelTint') as THREE.InstancedBufferAttribute,version=tint.version;overlay.update(4,4,stats);overlay.present(camera,900,40);expect(tint.version).toBe(version);
   const changed={...stats,beauty:{...stats.beauty!,cells:stats.beauty!.cells.map(cell=>({...cell,value:-cell.value}))}};
   overlay.update(4,4,changed);expect(tint.version).toBeGreaterThan(version);
  }finally{ordinary.dispose();overlay.dispose();}
 });
 it('retains room geometry during pointer movement and independently clears each mode and the map',()=>{
  const overlay=new EnvironmentStatsOverlay();try{
   expect(overlay.group.visible).toBe(false);overlay.update(4,4,stats);expect(overlay.group.visible).toBe(true);
   const edges=overlay.group.getObjectByName('environment-room-edges') as THREE.Mesh<THREE.BufferGeometry>,position=edges.geometry.getAttribute('position') as THREE.BufferAttribute,version=position.version;
   overlay.update(4,4,{...stats,cell:{x:1,z:1},room:{...stats.room!,cells:[...stats.room!.cells]}});expect(edges.geometry.getAttribute('position')).toBe(position);expect(position.version).toBe(version);
   overlay.update(4,4,{...stats,beauty:undefined});expect(edges.visible).toBe(true);expect(overlay.group.getObjectByName('environment-beauty-bracket')!.visible).toBe(false);
   overlay.update(4,4,{...stats,room:undefined});expect(edges.visible).toBe(false);expect(overlay.group.getObjectByName('environment-beauty-bracket')!.visible).toBe(true);
   overlay.update(4,4,null);expect(overlay.group.visible).toBe(false);
   overlay.update(8,8,null);expect(overlay.group.visible).toBe(false);expect(edges.visible).toBe(false);
  }finally{overlay.dispose();}
 });
});

describe('camera-fixed environmental paper',()=>{
 it('paints the actual five scores, the related markers and the beauty average',()=>{
  const layout=layoutNativeEnvironmentStats(stats,{width:1440,height:900},{x:200,y:100}),fillText=vi.fn(),fillRect=vi.fn(),ctx={fillText,fillRect,fillStyle:'',textAlign:'left',font:''} as unknown as CanvasRenderingContext2D;
  paintNativeEnvironmentStats(ctx,layout,stats,{font:()=> 'test',measure:(text,size)=>text.length*size*.43});
  const values=fillText.mock.calls.map(([value])=>value);for(const value of ['Chambre','Beauté ici : 1.1','42','750','12','2.50','0.02'])expect(values).toContain(value);
  expect(values.filter(value=>value==='*')).toHaveLength(5);expect(fillRect).toHaveBeenCalledTimes(3); // divider + alternate bands
 });
 it('repositions a noninteractive resident sheet without repainting and hides it on the UI',()=>{
  // A constructor-free stage exercises the real methods and Three transforms.
  const pieces:CardboardPiece[]=[];
  const createPiece=vi.fn((options:CardboardPieceOptions)=>{
   const piece=new THREE.Group() as CardboardPiece;piece.userData={w:options.w,h:options.h,basePos:new THREE.Vector3(),nativeId:''} as unknown as CardboardPiece['userData'];
   piece.setBaseTransform=(x,y,z=0)=>{piece.position.set(x,y,z);piece.userData.basePos.copy(piece.position);};piece.redraw=vi.fn();pieces.push(piece);return piece;
  });
  type Port={setEnvironmentStats:(stats:NativeEnvironmentStats|null)=>void;syncEnvironmentHover:()=>void;lastPointer:{x:number;y:number};pointerOverUi:boolean;environmentBlocked:boolean;environmentStatsPiece:CardboardPiece;page?:{modal:boolean}};
  const blocked=vi.fn(),stage=Object.assign(Object.create(NativeStage.prototype),{art:{createPiece},hudRoot:new THREE.Group(),environmentBlocked:false,worldVisible:true,frontVisible:false,pointerOverUi:false,width:1440,height:900,lastPointer:{x:300,y:150},uiScale:1,visH:9,textFontRevision:0,sceneRevision:0,options:{onWorldHoverBlocked:blocked},measure:(text:string,size:number)=>text.length*size*.45,font:()=> 'test',invalidate:vi.fn(),unregister:(piece:CardboardPiece)=>piece.removeFromParent()}) as Port;
  stage.setEnvironmentStats(stats);const piece=stage.environmentStatsPiece,old=piece.position.clone();expect(createPiece).toHaveBeenCalledTimes(1);expect(createPiece.mock.calls[0]![0].interactive).toBe(false);
  stage.lastPointer={x:400,y:160};stage.syncEnvironmentHover();expect(stage.environmentStatsPiece).toBe(piece);expect(piece.position.distanceTo(old)).toBeGreaterThan(0);expect(piece.redraw).not.toHaveBeenCalled();
  stage.pointerOverUi=true;stage.syncEnvironmentHover();expect(piece.visible).toBe(false);expect(blocked).toHaveBeenLastCalledWith(true);
  stage.pointerOverUi=false;stage.syncEnvironmentHover();expect(piece.visible).toBe(true);expect(blocked).toHaveBeenLastCalledWith(false);expect(createPiece).toHaveBeenCalledTimes(1);
  stage.page={modal:true};stage.syncEnvironmentHover();expect(piece.visible).toBe(false);stage.setEnvironmentStats(null);expect(piece.visible).toBe(false);
 });
});
