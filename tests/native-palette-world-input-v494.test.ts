import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {CardboardPiece} from '../src/ui3d/prototype-art';
vi.mock('../src/ui/native-cardboard-cursors',()=>({setNativeCursor:vi.fn()}));

type Hit={piece:CardboardPiece;control?:NativeControl};
type Stage=Record<string,unknown>&{page:NativePage;worldPress?:{pointerId:number;button:number};hit(x:number,y:number):Hit|undefined;pointerDown(e:PointerEvent):void;pointerMove(e:PointerEvent):void;pointerUp(e:PointerEvent):void;dropdown?:{pieces:CardboardPiece[]};down:unknown};
const event=(point:{x:number;y:number},buttons=1)=>({clientX:point.x,clientY:point.y,pointerId:17,button:0,buttons,isPrimary:true,target:null,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()}) as unknown as PointerEvent;
function fixture(palette:'orders'|'zones'|null='zones',displayScale=1){
 // Existing constructor-free NativeStage convention, actual Three meshes and
 // CPU raycasts. No Stage constructor, renderer, graphics device or fake hit.
 const width=1200,height=800,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,width/height,.1,100);camera.position.z=8;camera.updateMatrixWorld(true);
 const pageGroup=new THREE.Group();pageGroup.position.set(-2.8,1.5,0);scene.add(pageGroup);
 const meshes:THREE.Mesh[]=[],pieces:CardboardPiece[]=[],hits=new Map<THREE.Mesh,Hit>(),activate=vi.fn(),close=vi.fn(),escape=vi.fn(),cancel=vi.fn(),errors=vi.fn();
 function add(id:string,w:number,h:number,z:number,control?:NativeControl){const piece=new THREE.Group() as CardboardPiece,mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial());piece.add(mesh);piece.position.z=z;Object.assign(piece.userData,{nativeId:id,w,h,depth:0,mesh,interactiveMeshes:[mesh],pressVal:0});mesh.userData.widgetGroup=piece;pageGroup.add(piece);meshes.push(mesh);pieces.push(piece);const hit={piece,control};hits.set(mesh,hit);return hit;}
 const backdrop=add('page:palette',3.2,2.5,0),control:NativeControl={id:'tool-home-select',label:'Zone maison',onActivate:activate},card=add(control.id,.9,.7,.02,control);
 const page:NativePage={id:palette?'map-tools-'+palette:'work',title:palette?'Palette':'Travail',rows:[],...(palette?{layout:'palette' as const,palette}:{}),onClose:close};
 const point=(x:number,y:number,z=0)=>{scene.updateMatrixWorld(true);const p=new THREE.Vector3(x,y,z).project(camera);return {x:(p.x+1)*width/2*displayScale,y:(1-p.y)*height/2*displayScale};};
 const topLeft=point(-4.4,2.75),bottomRight=point(-1.2,.25),pageBox={x:topLeft.x/displayScale,y:topLeft.y/displayScale,width:(bottomRight.x-topLeft.x)/displayScale,height:(bottomRight.y-topLeft.y)/displayScale};
 const stage=Object.assign(Object.create(NativeStage.prototype),{closed:false,worldVisible:true,frontVisible:false,standalone:false,width,height,displayScale,bottomDockHeight:96,bottomOffset:0,bottomOpen:false,scene,camera,pointer:new THREE.Vector2(),raycaster:new THREE.Raycaster(),stats:{raycasts:0},art:{interactiveMeshes:meshes},hits,insetControls:new Map(),page,pageGroup,pageBox,pageBackdrop:backdrop.piece,pagePieces:pieces,pageControls:[card],moving:new Set(),down:null,activationSerial:0,pendingActions:0,lastPointer:{x:0,y:0},options:{onError:errors,onEscape:escape,onCancelWorldInteraction:cancel,onActivate:vi.fn()},clearHint:vi.fn(),hover:vi.fn(),updateHint:vi.fn(),setPointerOverUi:vi.fn(),invalidate:vi.fn(),gesture:vi.fn(),updatePointerCursor:vi.fn()}) as Stage;
 // Closing a dropdown is a presentation boundary unrelated to this fix. The
 // real pointer handlers still decide whether/when to invoke it and consume.
 const closeDropdown=vi.fn(()=>{stage.dropdown=undefined;});stage.closeDropdown=closeDropdown;
 return {stage,page,activate,close,escape,cancel,errors,closeDropdown,card,worldFrom:point(2,-1),worldTo:point(2.5,-1.4),cardPoint:point(-2.8,1.5,.02),dispose:()=>{for(const mesh of meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}};
}
afterEach(()=>vi.restoreAllMocks());
const passed=(e:PointerEvent)=>{expect(e.preventDefault).not.toHaveBeenCalled();expect(e.stopImmediatePropagation).not.toHaveBeenCalled();};
const consumed=(e:PointerEvent)=>{expect(e.preventDefault).toHaveBeenCalledOnce();expect(e.stopImmediatePropagation).toHaveBeenCalledOnce();};

describe('native tool palette versus world drag',()=>{
 it('retains the live Orders/Zones palette and passes the complete left world drag, even across its card',()=>{
  for(const kind of ['orders','zones'] as const)for(const scale of [1,1.5]){const f=fixture(kind,scale);try{
   expect(f.stage.hit(f.worldFrom.x,f.worldFrom.y)).toBeUndefined();expect(f.stage.hit(f.cardPoint.x,f.cardPoint.y)?.control).toBe(f.card.control);
   const down=event(f.worldFrom),move=event(f.cardPoint),up=event(f.worldTo,0);f.stage.pointerDown(down);passed(down);expect(f.stage.worldPress).toEqual({pointerId:17,button:0});expect(f.stage.page).toBe(f.page);
   f.stage.pointerMove(move);passed(move);expect(f.stage.worldPress).toEqual({pointerId:17,button:0});f.stage.pointerUp(up);passed(up);expect(f.stage.worldPress).toBeUndefined();expect(f.stage.page).toBe(f.page);expect(f.close).not.toHaveBeenCalled();expect(f.escape).not.toHaveBeenCalled();expect(f.cancel).not.toHaveBeenCalled();expect(f.activate).not.toHaveBeenCalled();expect(f.errors).not.toHaveBeenCalled();
  }finally{f.dispose();}
   const release=fixture(kind,scale);try{const down=event(release.worldFrom),up=event(release.cardPoint,0);release.stage.pointerDown(down);passed(down);expect(release.stage.worldPress).toEqual({pointerId:17,button:0});expect(release.stage.hit(up.clientX,up.clientY)?.control).toBe(release.card.control);release.stage.pointerUp(up);consumed(up);expect(release.stage.worldPress).toBeUndefined();expect(release.cancel).toHaveBeenCalledOnce();expect(release.stage.page).toBe(release.page);expect(release.close).not.toHaveBeenCalled();expect(release.escape).not.toHaveBeenCalled();expect(release.activate).not.toHaveBeenCalled();expect(release.errors).not.toHaveBeenCalled();}finally{release.dispose();}
  }
 });
 it('keeps ordinary windows, an open dropdown and palette cards in UI ownership',async()=>{
  const normal=fixture(null);try{const down=event(normal.worldFrom),up=event(normal.worldTo,0);normal.stage.pointerDown(down);normal.stage.pointerUp(up);consumed(down);consumed(up);expect(normal.close).toHaveBeenCalledOnce();expect(normal.escape).toHaveBeenCalledOnce();expect(normal.stage.worldPress).toBeUndefined();expect(normal.activate).not.toHaveBeenCalled();}finally{normal.dispose();}
  const dropdown=fixture();try{dropdown.stage.dropdown={pieces:[dropdown.card.piece]};const down=event(dropdown.worldFrom),up=event(dropdown.worldTo,0);dropdown.stage.pointerDown(down);consumed(down);expect(dropdown.stage.worldPress).toBeUndefined();expect(dropdown.closeDropdown).toHaveBeenCalledOnce();dropdown.stage.pointerUp(up);expect(dropdown.activate).not.toHaveBeenCalled();expect(dropdown.cancel).not.toHaveBeenCalled();}finally{dropdown.dispose();}
  for(const disabled of [false,true]){const f=fixture();try{f.card.control!.disabled=disabled;const down=event(f.cardPoint),up=event(f.cardPoint,0);f.stage.pointerDown(down);f.stage.pointerUp(up);await Promise.resolve();consumed(down);if(!disabled)consumed(up);expect(f.stage.worldPress).toBeUndefined();expect(f.close).not.toHaveBeenCalled();expect(f.escape).not.toHaveBeenCalled();expect(f.activate).toHaveBeenCalledTimes(disabled?0:1);expect(f.errors).not.toHaveBeenCalled();}finally{f.dispose();}}
 });
 it('passes an empty-map press and release through a modeless map search without closing it',()=>{
  const f=fixture(null);try{f.stage.page.layout='map-search';f.stage.page.closeOwnsNavigation=true;const down=event(f.worldFrom),up=event(f.worldTo,0);
   f.stage.pointerDown(down);expect(down.preventDefault).not.toHaveBeenCalled();expect(f.stage.worldPress?.pointerId).toBe(17);f.stage.pointerUp(up);expect(up.preventDefault).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();expect(f.escape).not.toHaveBeenCalled();expect(f.stage.worldPress).toBeUndefined();
  }finally{f.dispose();}
 });
});
