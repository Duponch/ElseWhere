import * as THREE from 'three/webgpu';
import {PrototypeCardboardArt,MANAGEMENT_BUTTONS,PALETTE,drawHandBlob,drawHandRect,drawMarkerLine,type CardboardPiece,type CardboardDraw,type CardboardPieceOptions} from './prototype-art';
import {drawNativeActionIcon} from './native-action-icons';
import {applyNativeHudButtonPose} from './native-hud-art';
import {applyNativeMapToolHover} from './native-map-tool-hover';
import {createNativeTextLexicon,tokenizeNativeText,NATIVE_TEXT_STYLES,type NativeTextLexicon,type NativeTextEntity,type NativeTextSpan} from './native-rich-text';
import type {NativeControl,NativeControlStyle,NativePage,NativeRow,NativeShipCurtainPhase298} from './native-contract';
import {NativeGlobe} from './NativeGlobe';
import {NativeOverlayCache} from './NativeOverlayCache';
import {NativeDamageTracker} from './NativeDamageTracker';
import {NativeRendererStandby} from './NativeRendererStandby';
import {NativeFrontBackdrop} from './NativeFrontBackdrop';
import {normalizeNativeUiScale} from './native-preferences';
import {NativeHitPose} from './NativeHitPose';
import {NativeHoverPreview} from './native-hover-preview';
import {setNativeCursor} from '../ui/native-cardboard-cursors';
import {SHIP_FRAME_MAXIMUM_DELTA_298} from '../bridge/ship-countdown-wire-298';
import {NATIVE_UI,NATIVE_RIGHT_DOCK_WIDTH,layoutNativePage,nativeVisualWidth,nativeMatrixColumns,nativeMatrixHeadingLines,nativeTableRowScroll,wrapNativeText,nativeCardInk,type NativePageBox,type NativeRowBox,type NativeRect,type NativeRegion,type NativeRegionBox} from './native-layout';

const HUD_DISTANCE=7.5;
const PANEL_IDS=['architect','work','schedule','assign','animals','wildlife','research','quests','world','history','factions','menu'] as const;
type NativePanelId=typeof PANEL_IDS[number];
type Hit={piece:CardboardPiece;control?:NativeControl;input?:NonNullable<NativeRow['input']>;region?:NativeRect};
type PagePiece={piece:CardboardPiece;hit:Hit;geometry:string;paint:string};
export interface NativeStageOptions {
  onPanel:(panel:NativePanelId)=>void;
  onEscape:()=>void;
  onHudInspectorDismiss?:()=>void;
  onError:(message:string)=>void;
  onGesture?:()=>void;
  onActivate?:(id:string)=>void;
  onCancelWorldInteraction?:()=>void;
  onTools?:(kind:'orders'|'zones')=>void;
  onViewport?:(width:number,height:number,unitsPerPixel:number,bottomDockHeight:number,leftHudBottom:number)=>void;
  onWindowLayout?:(bounds:NativeRect|null)=>boolean;
  onPointer?:(x:number,y:number)=>void;
  onAnimate?:(dtSeconds:number)=>boolean;
  countdownFrame298?:{canFeed:()=>boolean;canPresent?:()=>boolean;feed:(rawDeltaSeconds:number)=>void};
}

/** Camera-fixed native scene. Browser DOM is only the graphics surface and the
 * optional OS text-composition endpoint; it supplies no UI layout or hit areas. */
export class NativeStage {
  readonly art=new PrototypeCardboardArt();
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,220);
  private readonly frontBackdrop=new NativeFrontBackdrop(this.camera,()=>this.invalidate());
  readonly hudRoot=new THREE.Group();
  readonly anchors={topLeft:new THREE.Group(),topCenter:new THREE.Group(),topRight:new THREE.Group(),
    bottomLeft:new THREE.Group(),bottomCenter:new THREE.Group(),bottomRight:new THREE.Group(),drawerAnchor:new THREE.Group()};
  readonly ready:Promise<void>;
  private readonly ownRenderer=new THREE.WebGPURenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
  private readonly standby=new NativeRendererStandby(this.ownRenderer);
  private readonly raycaster=new THREE.Raycaster();
  private readonly pointer=new THREE.Vector2();
  private readonly management:CardboardPiece[]=[];
  private readonly pageGroup=new THREE.Group();
  private readonly pageContent=new THREE.ClippingGroup();
  private readonly tableHeaderContent=new THREE.ClippingGroup();
  private readonly pageFooter=new THREE.ClippingGroup();
  private readonly regionGroups={navigation:new THREE.ClippingGroup(),details:new THREE.ClippingGroup(),graph:new THREE.ClippingGroup()};
  private readonly regionOffsets={navigation:0,details:0,graph:0};
  private graphX=0;
  private paletteX=0;
  private regionDrag:{pointerId:number;region:NativeRegion|undefined;axis:'x'|'y';start:number;offset:number;travel:number;max:number}|undefined;
  private pageBox:NativePageBox|undefined;
  private readonly measureContext=document.createElement('canvas').getContext('2d')!;
  private readonly toolsDock=new THREE.Group();
  private autoHideBottom=false;
  private bottomOpen=true;
  private bottomOffset=0;
  private extraAnimating=false;
  private lastPointer={x:-1,y:-1};
  private scrollbarDrag:{pointerId:number;startY:number;scroll:number;travel:number;max:number}|undefined;
  private paintDrag:{pointerId:number;group:string;indices:Set<number>;onPaint:NonNullable<NativeControl['paint']>['onPaint']}|undefined;
  private dropdown:{controlId:string;pageId:string;box:{x:number;y:number;width:number;height:number};offset:number;index:number;pieces:CardboardPiece[]}|undefined;
  private readonly pagePieces:CardboardPiece[]=[];
  private readonly retainedPagePieces=new Map<string,PagePiece>();
  private pagePieceIds=new Set<string>();
  private readonly hits=new Map<THREE.Mesh,Hit>();
  private readonly insetControls=new WeakMap<CardboardPiece,Hit[]>();
  private readonly moving=new Set<CardboardPiece>();
  private readonly disposers:Array<()=>void>=[];
  private page:NativePage|null=null;
  private pageBackdrop:CardboardPiece|undefined;
  private hovered:CardboardPiece|null=null;
  private mapToolLabel:CardboardPiece|undefined;
  private mapToolLabelOwner:CardboardPiece|undefined;
  private mapToolLabelTitle='';
  private readonly hoverPreview=new NativeHoverPreview(message=>this.options.onError(message));
  private down:{piece:CardboardPiece;controlId?:string;outsidePage?:string;pageId?:string;layout?:NativePageBox;pose:NativeHitPose;pointerId:number;x:number;y:number}|null=null;
  private hoverPose:{piece:CardboardPiece;pose:NativeHitPose;pageId?:string}|undefined;
  private dismissedPointer:number|undefined;
  private worldPress:{pointerId:number;button:number}|undefined;
  private focusIndex=-1;
  private pageControls:Hit[]=[];
  private scroll=0;
  private maxScroll=0;
  private pageSignature='';
  private textLexicon:NativeTextLexicon=createNativeTextLexicon();
  private sharedTextEntities:readonly NativeTextEntity[]|undefined;
  private inkTextEntities:readonly NativeTextEntity[]|undefined;
  private textEntityRevision=0;
  private readonly semanticInk=new Map<string,NativeTextSpan[]>();
  private lastTime=0;
  private countdownFrameAt298:number|undefined;
  private countdownFrameDriver298:'game'|'standalone'|undefined;
  private countdownFrameEligible298=false;
  private countdownFeedEligible298=false;
  // Separate from the retained UI scene: opacity never invalidates its cache.
  private readonly shipCurtainScene298=new THREE.Scene();
  private readonly shipCurtainMaterial298=new THREE.MeshBasicNodeMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
  private readonly shipCurtainMesh298=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.shipCurtainMaterial298);
  private shipCurtainOwner298:string|undefined;
  private shipCurtainPage298:string|undefined;
  private shipCurtainPhase298:NativeShipCurtainPhase298|'idle'='idle';
  private shipCurtainRemaining298=0;
  private shipCurtainPageHandoff298=false;
  private shipCurtainDisplayDirty298=false;
  private standaloneNeedsRender298=true;
  private frameId=0;
  private closed=false;
  private initialized=false;
  private worldVisible=false;
  private standalone=true;
  private frontVisible=true;
  private width=0;
  private height=0;
  private visW=1;
  private visH=1;
  private uiScale=1;
  private displayScale=1;
  private bottomDockHeight=96;
  private bottomLeftClearance=0;
  private readoutBottom=104;
  private managementPage=0;
  private managementPages=1;
  private managementPrevious:CardboardPiece|undefined;
  private managementNext:CardboardPiece|undefined;
  private viewportSignature='';
  private editor:HTMLTextAreaElement|undefined;
  private editing:Hit|undefined;
  private editingValue='';
  private editRepaint:(()=>void)|undefined;
  private editingPaintDirty=false;
  private editorCommit:Promise<boolean>|undefined;
  private editorCommitPageId:string|undefined;
  private activationSerial=0;
  private pendingActions=0;
  private textFontFamily='"Comic Sans MS", Georgia, serif';
  private textFontRevision=0;
  private fontRequest=0;
  private notice:CardboardPiece|undefined;
  private noticeTimer:ReturnType<typeof setTimeout>|undefined;
  private globe:NativeGlobe|undefined;
  private globeDrag:{pointerId:number;x:number;y:number;startX:number;startY:number}|undefined;
  private readonly selectionBox=new THREE.Group();
  private readonly selectionFill=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xf8e5ad,transparent:true,opacity:.09,depthTest:false,depthWrite:false}));
  private readonly selectionOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1,1)),new THREE.LineBasicMaterial({color:0xf8e5ad,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));
  private readonly portraitImages=new Map<string,HTMLImageElement>();
  private hintOwner:CardboardPiece|null=null;
  private hintText='';
  private hintTimer:ReturnType<typeof setTimeout>|undefined;
  private hintPiece:CardboardPiece|undefined;
  private hintScroll=0;
  private hintMaxScroll=0;
  private worldReadout:CardboardPiece|undefined;
  private worldReadoutLines:readonly string[]=[];
  private worldReadoutGeometry='';
  private worldReadoutInk='';
  private worldReadoutLayout='';
  private readoutReserveHeight=76;
  private worldReadoutScroll=0;
  private worldReadoutMaxScroll=0;
  private readoutCanPlace=true;
  private pointerOverUi=true;
  private readonly overlayCache=new NativeOverlayCache();
  private readonly damageTracker=new NativeDamageTracker();
  private readonly overlaySize=new THREE.Vector2();
  private readonly reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  private sceneRevision=0;
  private cacheRevision=0;
  private lastArtRevision=-1;
  private lastSceneRevision=-1;
  private readonly cacheEnabled=!(import.meta.env.DEV&&new URLSearchParams(location.search).get('ui-cache')==='off');
  private readonly stats={renders:0,overlayRenders:0,rebuilds:0,raycasts:0,activeAnimations:0,uiObjects:0,drawCalls:0,renderMs:0,backend:'',error:null as string|null};
  constructor(private readonly options:NativeStageOptions){
    this.raycaster.layers.enable(31);
    this.shipCurtainMesh298.position.z=-.2;this.shipCurtainMesh298.frustumCulled=false;this.shipCurtainMesh298.visible=false;
    this.shipCurtainScene298.add(this.shipCurtainMesh298);
    this.hudRoot.position.set(0,0,-HUD_DISTANCE);this.camera.add(this.hudRoot);this.scene.add(this.camera);
    Object.values(this.anchors).forEach(group=>this.hudRoot.add(group));
    this.selectionBox.add(this.selectionFill,this.selectionOutline);this.selectionBox.visible=false;this.selectionBox.position.z=.5;this.hudRoot.add(this.selectionBox);
    this.hudRoot.add(this.pageGroup);this.pageGroup.add(this.pageContent,...Object.values(this.regionGroups),this.pageFooter,this.tableHeaderContent);
    this.anchors.bottomLeft.add(this.toolsDock);this.toolsDock.visible=false;
    for(const [index,kind]of (['orders','zones'] as const).entries()){
      const control:NativeControl={id:'map-dock:'+kind,label:kind==='orders'?'Ordres':'Zones',hint:kind==='orders'?'Ordres sur la carte':'Zones sur la carte',onActivate:()=>this.options.onTools?.(kind)};
      const piece=this.art.createPiece({w:1.08,h:.46,depth:.046,bevel:.038,uvPadding:1,textureWidth:216,textureHeight:92,seed:381+index*5,bgColor:PALETTE.sageMountain,interactive:true,tooltip:control.hint,drawFn:(ctx,w,h,rng)=>{ctx.save();ctx.scale(w/108,h/46);drawHandBlob(ctx,23,23,17,PALETTE.creamPaper,PALETTE.inkDark,1.5,rng);drawNativeActionIcon(ctx,kind,23,23,11);drawHandRect(ctx,44,11,58,25,PALETTE.creamPaper,PALETTE.inkDark,1,rng);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='center';ctx.font=this.font(13,true);ctx.fillText(control.label,73,28,54);ctx.restore();}});
      piece.userData.nativeId=control.id;piece.userData.nativeMapToolPose=true;piece.setBaseTransform(.54,index===0?1.63:1.09,.08);this.toolsDock.add(piece);this.register(piece,control);
    }
    // The reference's three lights, with the world key expressed in HUD-camera
    // space. They light actual cream edges and matte painted mesh fronts.
    this.scene.add(new THREE.AmbientLight(0xfff5e4,1.45));
    const sun=new THREE.DirectionalLight(0xfff2d6,1.9);sun.position.set(18,28,22);this.scene.add(sun);
    const key=new THREE.DirectionalLight(0xfffaf0,.85);key.position.set(-3,5,4);this.camera.add(key);
    this.anchors.bottomCenter.add(this.art.createBottomShelf());
    this.anchors.bottomCenter.visible=false;
    MANAGEMENT_BUTTONS.forEach((config,index)=>{
      const piece=this.art.createManagementButton(index,config,()=>this.options.onPanel(PANEL_IDS[index]!),26);
      piece.userData.nativeId=`tab:${PANEL_IDS[index]}`;
      this.management.push(piece);this.anchors.bottomCenter.add(piece);this.register(piece);
      this.setPose(piece,0);
    });
    const canvas=this.ownRenderer.domElement;
    canvas.dataset.ui3d='native';canvas.dataset.testid='native-ui-canvas';canvas.tabIndex=0;
    canvas.setAttribute('aria-label','Interface 3D Elsewhere');
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;display:block;z-index:40;outline:none;touch-action:none';
    this.ownRenderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    this.ownRenderer.setClearColor(0xd8cbb8,1);document.body.append(canvas);
    this.listen(window,'resize',()=>{this.resize();this.rebuildPage(true);this.layoutToolsDock();this.refreshWorldReadout();this.invalidate();});
    this.listen(document,'pointermove',event=>this.pointerMove(event as PointerEvent),true);
    this.listen(document,'pointerdown',event=>this.pointerDown(event as PointerEvent),true);
    this.listen(document,'pointerup',event=>this.pointerUp(event as PointerEvent),true);
    this.listen(document,'pointercancel',()=>this.cancelPress(),true);
    this.listen(window,'blur',()=>{this.cancelPress();this.hover(null);setNativeCursor(document.documentElement,undefined);});
    this.listen(document,'keydown',event=>this.keyDown(event as KeyboardEvent),true);
    this.listen(document,'wheel',event=>this.wheel(event as WheelEvent),{capture:true,passive:false});
    this.listen(document,'contextmenu',event=>{const mouse=event as MouseEvent;if(this.frontVisible||this.page?.modal||this.hit(mouse.clientX,mouse.clientY))this.swallow(event);},true);
    this.listen(document,'visibilitychange',()=>{this.resetCountdownFrame298();if(document.hidden){this.cancelPress();this.hover(null);}else this.invalidate();});
    this.resize();this.ready=this.ownRenderer.init().then(()=>{
      if(this.closed)return;this.initialized=true;this.standby.setActive(this.frontVisible||this.standalone);this.stats.backend=this.ownRenderer.getContext() instanceof WebGL2RenderingContext?'WebGL 2':'WebGPU';this.invalidate();
    }).catch(error=>{this.stats.error=String(error);this.options.onError(String(error));});
  }
  private listen(target:EventTarget,name:string,listener:EventListener,options?:boolean|AddEventListenerOptions):void{
    target.addEventListener(name,listener,options);this.disposers.push(()=>target.removeEventListener(name,listener,options));
  }
  diagnostics(){
    this.scene.updateMatrixWorld(true);
    return {...this.stats,mapToolHover:this.mapToolLabelOwner?{id:this.mapToolLabelOwner.userData.nativeId,title:this.mapToolLabelTitle,labelVisible:!!this.mapToolLabel?.visible,value:this.mapToolLabelOwner.userData.hoverVal,scale:this.mapToolLabelOwner.scale.x}:null,displayScale:this.displayScale,logicalViewport:{width:this.width,height:this.height},bottomDockHeight:this.bottomDockHeight,cache:this.overlayCache.stats,standby:this.standby.stats,activeAnimations:this.moving.size,uiObjects:this.art.interactiveMeshes.length,
      mode:'native-meshes',page:this.page?.id??null,scroll:this.scroll,maxScroll:this.maxScroll,pageBounds:this.pageBox?{x:this.pageBox.x,y:this.pageBox.y,width:this.pageBox.width,height:this.pageBox.height}:null,dropdown:this.dropdown?{owner:this.dropdown.controlId,...this.dropdown.box}:null,bottomDock:{autoHide:this.autoHideBottom,open:this.bottomOpen,offset:this.bottomOffset,page:this.managementPage,pages:this.managementPages},front:this.frontVisible,frontBackdrop:this.frontBackdrop.diagnostics,globe:this.globeDiagnostics(),
      readout:this.worldReadout?{visible:this.worldReadout.visible,paper:this.worldReadout.userData.paper,width:this.worldReadout.userData.w*100,height:this.worldReadout.userData.h*100,lines:this.worldReadoutLines,scroll:this.worldReadoutScroll,maxScroll:this.worldReadoutMaxScroll}:null,
      tooltip:this.hintPiece?{width:this.hintPiece.userData.w*100,height:this.hintPiece.userData.h*100}:null,
      regions:this.pageBox?.regions,inspectorParts:this.pageBox?.inspectorParts,graph:this.page?.research?{x:this.graphX,y:this.regionOffsets.graph,width:this.page.research.width,height:this.page.research.height,bounds:this.pageBox?.regions.graph}:null,
      paletteOffset:this.paletteX,rows:this.pageBox?.rows.map(row=>({id:row.row.id,column:row.row.column,region:row.row.region,meter:!!row.row.meter,x:row.x-this.horizontalOffset(row.row.region),top:row.top-this.rowOffset(row.row),width:row.width,height:row.height,visible:this.rowVisible(row)}))??[],
      management:this.management.map((piece,index)=>{
        const center=piece.getWorldPosition(new THREE.Vector3()).project(this.camera);
        return {id:PANEL_IDS[index],x:(center.x+1)*this.width/2*this.displayScale,y:(1-center.y)*this.height/2*this.displayScale,
          width:piece.userData.w,height:piece.userData.h,seed:piece.userData.seed,visible:piece.visible,
          position:piece.position.toArray(),rotation:piece.rotation.toArray(),active:piece.userData.active};
      }),controls:[...this.pageControls,...(this.dropdown?.pieces.flatMap(piece=>{const hit=this.hits.get(piece.userData.mesh);return hit?.control?[hit]:[];})??[])].map(hit=>{
        const point=(hit.region?hit.piece.localToWorld(new THREE.Vector3(hit.region.x+hit.region.width/2,hit.region.y+hit.region.height/2,hit.piece.userData.depth)):hit.piece.getWorldPosition(new THREE.Vector3())).project(this.camera);
        return {id:hit.control?.id??hit.piece.userData.nativeId,label:hit.control?.label,disabled:!!hit.control?.disabled,active:!!hit.control?.active,style:hit.region?'icon':hit.piece.userData.nativeStyle,width:(hit.region?.width??hit.piece.userData.w)*100,height:(hit.region?.height??hit.piece.userData.h)*100,region:hit.piece.userData.nativeRegion,
          x:(point.x+1)*this.width/2*this.displayScale,y:(1-point.y)*this.height/2*this.displayScale};
      }),targets:this.art.interactiveMeshes.filter(mesh=>{for(let node:THREE.Object3D|null=mesh;node;node=node.parent)if(!node.visible)return false;return true;}).map(mesh=>{
        const piece=mesh.userData.widgetGroup as CardboardPiece|undefined,point=mesh.getWorldPosition(new THREE.Vector3()).project(this.camera);
        return {seed:piece?.userData.seed,nativeId:piece?.userData.nativeId??null,tooltip:piece?.userData.tooltip??'',paper:piece?.userData.paper,width:piece?.userData.w,height:piece?.userData.h,x:(point.x+1)*this.width/2*this.displayScale,y:(1-point.y)*this.height/2*this.displayScale};
      })};
  }
  private globeDiagnostics(){
    if(!this.globe)return undefined;
    const body=this.globe.getObjectByName('Native globe surface frame')??this.globe;
    const worldCenter=body.getWorldPosition(new THREE.Vector3()),worldScale=body.getWorldScale(new THREE.Vector3());
    const radius=Math.max(Math.abs(worldScale.x),Math.abs(worldScale.y),Math.abs(worldScale.z));
    const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0).normalize();
    const edge=worldCenter.clone().addScaledVector(right,radius).project(this.camera),center=worldCenter.project(this.camera);
    let visible=true;for(let object:THREE.Object3D|null=body;object;object=object.parent)if(!object.visible){visible=false;break;}
    return {visible,center:{x:(center.x+1)*this.width/2*this.displayScale,y:(1-center.y)*this.height/2*this.displayScale},radiusPixels:Math.hypot((edge.x-center.x)*this.width/2*this.displayScale,(edge.y-center.y)*this.height/2*this.displayScale),
      rotation:[body.rotation.x,body.rotation.y,body.rotation.z],scale:worldScale.toArray(),selected:this.page?.visual?.selected??null};
  }
  setWorldVisible(visible:boolean):void{
    if(this.worldVisible===visible)return;this.sceneRevision++;
    this.worldVisible=visible;this.standalone=!visible;
    this.updateOwnSurface();
    this.anchors.bottomCenter.visible=!this.frontVisible;this.toolsDock.visible=visible&&!this.frontVisible;this.updateWorldReadoutVisibility();this.invalidate();
  }
  setFrontVisible(visible:boolean):void{
    if(this.frontVisible===visible)return;this.sceneRevision++;
    this.frontVisible=visible;this.frontBackdrop.setVisible(visible);if(visible)this.resetShipCurtain298(false);this.updateOwnSurface();
    this.anchors.bottomCenter.visible=!visible;this.toolsDock.visible=this.worldVisible&&!visible;this.resize();this.rebuildPage(true);this.updateWorldReadoutVisibility();this.invalidate();
  }
  private updateOwnSurface():void{
    this.resetCountdownFrame298();
    const active=this.frontVisible||this.standalone;
    if(active){this.standby.setActive(true);this.ownRenderer.domElement.style.display='block';}
    else{this.ownRenderer.domElement.style.display='none';if(this.frameId){cancelAnimationFrame(this.frameId);this.frameId=0;}this.standby.setActive(false);}
  }
  setPanel(id:string|null):void{
    this.management.forEach((piece,index)=>{const active=PANEL_IDS[index]===id;if(piece.userData.active!==active){piece.setActive(active);this.moving.add(piece);}});this.invalidate();
  }
  getViewportMetrics(){const orders=this.toolsDock.children[0] as CardboardPiece|undefined;return {width:this.width,height:this.height,unitsPerPixel:.01,scale:this.displayScale,bottomDockHeight:this.bottomDockHeight,leftHudBottom:Math.max(40,this.height-8-(orders?orders.userData.basePos.y*100+23:this.bottomDockHeight)-12)};}
  private notifyViewport():void{
    const v=this.getViewportMetrics(),signature=JSON.stringify([v.width,v.height,v.bottomDockHeight,v.leftHudBottom]);if(signature===this.viewportSignature)return;this.viewportSignature=signature;
    this.options.onViewport?.(v.width,v.height,.01,v.bottomDockHeight,v.leftHudBottom);
  }
  hasOpenGamePage(modalOnly=false):boolean{return this.worldVisible&&!this.frontVisible&&!!this.page&&(!modalOnly||!!this.page.modal);}
  private cameraWorldPoint(x:number,y:number):boolean{
    if(!this.hasOpenGamePage()||this.dropdown||this.editor)return false;
    const box=this.pageBox,lx=x/this.displayScale,ly=y/this.displayScale;
    if(box&&lx>=box.x&&lx<=box.x+box.width&&ly>=box.y&&ly<=box.y+box.height)return false;
    // Modal activation can filter HUD controls, but camera gestures must still
    // respect every physically visible UI surface.
    return !this.hit(x,y,true)&&this.globeHit(x,y)===null;
  }
  setUiScale(value:number):void{
    const next=normalizeNativeUiScale(value);if(next===this.displayScale)return;
    this.lastPointer={x:this.lastPointer.x*this.displayScale/next,y:this.lastPointer.y*this.displayScale/next};
    this.displayScale=next;this.cancelPress();this.hover(null);this.clearHint();this.closeDropdown();
    this.resize();this.rebuildPage(true);this.layoutToolsDock();this.refreshWorldReadout();this.overlayCache.invalidate();this.invalidate();
  }
  setTextEntities(entities:readonly NativeTextEntity[]):void{if(this.sharedTextEntities===entities)return;this.sharedTextEntities=entities;if(this.page&&!this.page.textEntities){this.rebuildPage(true);this.invalidate();}}
  setAutoHideBottom(enabled:boolean):void{this.autoHideBottom=enabled;this.bottomOpen=!enabled||this.lastPointer.y>=this.height-14;this.extraAnimating=true;this.invalidate();}
  showPage(page:NativePage|null):void{
    if(this.closed)return;
    if(this.shipCurtainOwner298!==undefined&&page?.id!==this.shipCurtainPage298){
      // One handoff is expected when adopted credits disappear. Further page
      // changes cancel the visual transition instead of covering another UI.
      if(this.shipCurtainPhase298==='clear'&&this.shipCurtainPageHandoff298){this.shipCurtainPageHandoff298=false;this.shipCurtainPage298=page?.id;}
      else this.resetShipCurtain298();
    }
    const contentChanged=page?.contentKey!==this.page?.contentKey;
    const same=page?.id===this.page?.id,ownerChanged=page?.visual?.surface!==this.page?.visual?.surface||page?.visual?.roads!==this.page?.visual?.roads;
    this.page=page;if(!same){this.cancelPress();this.hover(null);this.scroll=0;this.regionOffsets.navigation=this.regionOffsets.details=this.regionOffsets.graph=this.graphX=this.paletteX=0;this.closeDropdown();}else if(contentChanged){this.cancelPress();this.scroll=0;}
    this.toolsDock.children.forEach((object,index)=>{const piece=object as CardboardPiece,active=page?.palette===(index===0?'orders':'zones');if(piece.userData.active!==active)piece.setActive(active,active?PALETTE.ochre:PALETTE.sageMountain);});
    this.rebuildPage(ownerChanged);this.layoutToolsDock();this.refreshWorldReadout();this.updateWorldReadoutVisibility();this.invalidate();
  }
  private layoutToolsDock():void{
    const box=this.pageBox,inspector=box?.layout==='inspector',side=inspector?box.x+box.width+12:8;
    this.toolsDock.visible=this.worldVisible&&!this.frontVisible&&(!this.page||box?.layout==='palette'||!!inspector&&this.width-side>=420);
    for(const [index,object]of this.toolsDock.children.entries()){const piece=object as CardboardPiece,x=(side-8)*.01+.54,y=(this.readoutBottom+this.readoutReserveHeight+12+23+(index===0?54:0))*.01;if(piece.userData.basePos.x!==x||piece.userData.basePos.y!==y)piece.setBaseTransform(x,y,.08);}
    this.notifyViewport();
  }
  /** The font service supplies glyphs only; mesh sizes and input remain native. */
  setTextFont(family:string):void{
    const name=family.trim();if(!name||/[\r\n\0]/.test(name))return;
    const chosen=`${JSON.stringify(name)}, "Segoe UI", sans-serif`;
    if(chosen===this.textFontFamily)return;
    this.textFontFamily=chosen;const request=++this.fontRequest;
    const repaint=()=>{if(this.closed||request!==this.fontRequest)return;this.textFontRevision++;this.rebuildPage(true);this.notice?.redraw();this.hintPiece?.redraw();this.refreshWorldReadout();this.editRepaint?.();this.invalidate();};
    repaint();
    const fonts=document.fonts;if(!fonts)return;
    const regular=`400 20px ${JSON.stringify(name)}`,bold=`700 20px ${JSON.stringify(name)}`;
    if(!fonts.check(regular)||!fonts.check(bold))void Promise.all([fonts.load(regular,'Éléonore, cœur, œuf, ça, où, Noël.'),fonts.load(bold,'Éléonore, cœur, œuf, ça, où, Noël.')]).then(repaint).catch(()=>{});
  }
  private font(size:number,bold=false):string{return `${bold?'bold ':''}${size}px ${this.textFontFamily}`;}
  setWorldReadout(lines:readonly string[]|null):void{
    const next=lines?.filter(line=>line.trim().length)??[];
    if(JSON.stringify(next)!==JSON.stringify(this.worldReadoutLines)){this.worldReadoutLines=[...next];this.worldReadoutScroll=0;this.refreshWorldReadout();}
    this.updateWorldReadoutVisibility();
  }
  private refreshWorldReadout():void{
    if(!this.worldReadoutLines.length)return;
    const placement=JSON.stringify([this.worldReadoutLines,this.textFontRevision,this.width,this.height,this.toolsDock.visible,this.pageBox?.x,this.pageBox?.y,this.pageBox?.width,this.pageBox?.height,this.bottomDockHeight,this.bottomLeftClearance]);
    if(placement===this.worldReadoutLayout)return;this.worldReadoutLayout=placement;
    // Use the actual free corner beside the centred management cards. Only a
    // corner narrower than a readable text lane reserves the dock's full height.
    const left=4,lowLane=this.bottomLeftClearance-24,canUseCorner=lowLane>=180;
    const maxWidth=Math.max(80,Math.min(640,this.width-NATIVE_RIGHT_DOCK_WIDTH-16,canUseCorner?lowLane:Infinity));
    const bottom=canUseCorner?2:this.bottomDockHeight+8;this.readoutBottom=bottom;
    const lines=this.worldReadoutLines.flatMap(line=>wrapNativeText(line,maxWidth,this.measure,14)),available=Math.max(42,this.height-bottom-180);
    const overflow=lines.length*19+4>available,count=overflow?Math.max(1,Math.floor((available-22)/19)):lines.length;
    this.worldReadoutMaxScroll=Math.max(0,lines.length-count);this.worldReadoutScroll=Math.min(this.worldReadoutScroll,this.worldReadoutMaxScroll);
    const width=Math.min(maxWidth,Math.max(...lines.map(line=>this.measure(line,14)))+8),height=count*19+4+(overflow?18:0);
    this.readoutReserveHeight=Math.max(this.readoutReserveHeight,height);
    const top=this.height-8-bottom-height;
    const box=this.pageBox;
    this.readoutCanPlace=!box||box.layout==='palette'||top>=box.y+box.height+8||left+8+width<=box.x-8;
    const w=width*.01,h=height*.01,geometry=width+'|'+height+'|'+overflow,ink=JSON.stringify([lines,this.textFontRevision]);
    const draw:CardboardDraw=(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.textAlign='left';ctx.font=this.font(14);ctx.lineJoin='round';ctx.strokeStyle='rgba(15,22,17,.95)';ctx.lineWidth=3;ctx.fillStyle='#fff9eb';lines.slice(this.worldReadoutScroll,this.worldReadoutScroll+count).forEach((line,i)=>{ctx.strokeText(line,3,16+i*19);ctx.fillText(line,3,16+i*19);});if(overflow){const text=`Molette : suite · ${this.worldReadoutScroll+1}–${Math.min(lines.length,this.worldReadoutScroll+count)}/${lines.length}`;ctx.font=this.font(11,true);ctx.fillStyle='#f4d589';ctx.strokeText(text,3,height-4);ctx.fillText(text,3,height-4);}ctx.restore();};
    if(!this.worldReadout||this.worldReadoutGeometry!==geometry){
      if(this.worldReadout)this.unregister(this.worldReadout);
      this.worldReadout=this.art.createPiece({w,h,paper:false,interactive:overflow,textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),drawFn:draw,seed:3751});
      this.worldReadout.userData.nativeId='world-readout';this.worldReadout.userData.nativeStatic=true;this.anchors.bottomLeft.add(this.worldReadout);
      this.worldReadout.userData.nativeReadoutScroll=overflow;if(overflow)this.register(this.worldReadout);
    }else if(this.worldReadoutInk!==ink)this.worldReadout.redraw(draw);
    this.layoutToolsDock();
    this.worldReadout.setBaseTransform((left+width/2)*.01,(bottom+height/2)*.01,.08);
    this.worldReadoutGeometry=geometry;this.worldReadoutInk=ink;this.updateWorldReadoutVisibility();this.invalidate();
  }
  private updateWorldReadoutVisibility():void{
    if(!this.worldReadout)return;
    const visible=this.worldVisible&&!this.frontVisible&&!this.pointerOverUi&&!this.page?.modal&&this.readoutCanPlace&&this.worldReadoutLines.length>0;
    if(this.worldReadout.visible!==visible){this.worldReadout.visible=visible;this.sceneRevision++;this.invalidate();}
  }
  private setPointerOverUi(over:boolean):void{if(this.pointerOverUi!==over){this.pointerOverUi=over;this.updateWorldReadoutVisibility();}}
  showNotice(message:string,error=false):void{
    clearTimeout(this.noticeTimer);if(this.notice)this.unregister(this.notice);
    const width=Math.min(this.width-32,460,Math.max(120,this.measure(message,13)+24)),lines=wrapNativeText(message,width-24,this.measure,13),height=lines.length*17+20;
    const w=width*.01,h=height*.01;
    const piece=this.art.createPiece({w,h,seed:1881,uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),bgColor:error?'#e2b59a':PALETTE.creamPaper,depth:.046,bevel:.038,surface:'panel',
      drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font(13);ctx.textAlign='left';lines.forEach((line,index)=>ctx.fillText(line,12,23+index*17,width-24));ctx.restore();}});
    piece.setBaseTransform(0,-1.0,.35);this.anchors.topCenter.add(piece);this.notice=piece;this.invalidate();
    this.noticeTimer=setTimeout(()=>{if(this.notice===piece){this.unregister(piece);this.notice=undefined;this.invalidate();}},error?8000:4000);
  }
  setSelectionRectangle(bounds:{left:number;top:number;width:number;height:number}|null):void{
    this.sceneRevision++;
    this.selectionBox.visible=!!bounds;
    if(bounds){const factor=1-this.selectionBox.position.z/HUD_DISTANCE;
      this.selectionBox.position.x=((bounds.left+bounds.width/2)/this.width/this.displayScale-.5)*this.visW*factor;
      this.selectionBox.position.y=(.5-(bounds.top+bounds.height/2)/this.height/this.displayScale)*this.visH*factor;
      this.selectionBox.scale.set(bounds.width/this.width/this.displayScale*this.visW*factor,bounds.height/this.height/this.displayScale*this.visH*factor,1);}
    this.invalidate();
  }
  private resize():void{
    this.cancelPress();this.hover(null);this.hoverPose=undefined;this.clearHint();
    this.readoutReserveHeight=76;this.worldReadoutLayout='';
    this.sceneRevision++;
    this.width=innerWidth/this.displayScale;this.height=innerHeight/this.displayScale;
    this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();
    this.frontBackdrop.resize(this.camera);
    const curtainHeight=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*.2;
    this.shipCurtainMesh298.scale.set(curtainHeight*this.camera.aspect,curtainHeight,1);
    this.standby.resize(innerWidth,innerHeight,Math.min(devicePixelRatio||1,2));
    this.visH=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*HUD_DISTANCE;this.visW=this.visH*this.camera.aspect;
    this.uiScale=this.visH/this.height*100;
    const halfW=this.visW/2,halfH=this.visH/2,s=this.uiScale;
    Object.values(this.anchors).forEach(group=>group.scale.setScalar(s));
    // Preserve each card's selected size. Reflow whole cards instead of shrinking
    // the user's scale back down when the row no longer fits.
    const dockScale=Math.min(1.18,(innerWidth-32)/860),capacity=Math.max(1,Math.min(this.management.length,Math.floor((this.width-24)/(67.5*dockScale))));
    const paged=this.height<500&&capacity<this.management.length;
    const rows=paged?1:Math.ceil(this.management.length/capacity),columns=paged?Math.max(1,Math.floor((this.width-100)/(67.5*dockScale))):Math.ceil(this.management.length/rows);
    this.managementPages=paged?Math.ceil(this.management.length/columns):1;this.managementPage=Math.min(this.managementPage,this.managementPages-1);
    const first=paged?this.managementPage*columns:0,last=paged?Math.min(first+columns,this.management.length):this.management.length;
    this.anchors.bottomCenter.scale.setScalar(s*dockScale);
    this.management.forEach((piece,index)=>{piece.visible=index>=first&&index<last;if(!piece.visible)return;const local=index-first,row=Math.floor(local/columns),count=Math.min(columns,last-first-row*columns);piece.setBaseTransform((local%columns-(count-1)/2)*.675,.325+row*.64,0,piece.userData.baseRot.z);this.setPose(piece,piece.userData.hoverVal);});
    if(paged&&!this.managementPrevious){
      const make=(direction:-1|1)=>{const control:NativeControl={id:direction<0?'dock:previous':'dock:next',label:direction<0?'‹':'›',hint:direction<0?'Boutons précédents':'Boutons suivants',onActivate:()=>{this.managementPage=(this.managementPage+direction+this.managementPages)%this.managementPages;this.hover(null);this.resize();this.refreshWorldReadout();this.invalidate();}};
        const piece=this.art.createPiece({w:.32,h:.42,seed:direction<0?48411:48412,interactive:true,bgColor:PALETTE.kraftBase,tooltip:control.hint,drawFn:(ctx,w,h)=>{ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font(32,true);ctx.textAlign='center';ctx.fillText(control.label,w/2,h*.66);}});piece.userData.nativeId=control.id;this.register(piece,control);this.anchors.bottomCenter.add(piece);return piece;};
      this.managementPrevious=make(-1);this.managementNext=make(1);
    }
    for(const [piece,direction]of [[this.managementPrevious,-1],[this.managementNext,1]] as const)if(piece){piece.visible=paged;piece.setBaseTransform(direction*(columns*.675/2+.23),.325,.08);}
    const rail=this.anchors.bottomCenter.children.find(object=>object instanceof THREE.Mesh);if(rail)rail.scale.x=Math.min(columns,this.management.length)*.675/8.6;
    this.bottomDockHeight=Math.ceil((.76+(rows-1)*.64)*100*dockScale+8);
    this.bottomLeftClearance=this.width/2-(columns*.675/2+.10)*100*dockScale-(paged?48:0);
    this.anchors.topLeft.position.set(-halfW+.08*s,halfH-.08*s,0);
    this.anchors.topCenter.position.set(0,halfH-.04*s,0);
    this.anchors.topRight.position.set(halfW-.08*s,halfH-.08*s,0);
    this.anchors.bottomLeft.position.set(-halfW+.08*s,-halfH+.08*s,0);
    this.anchors.bottomCenter.position.set(0,-halfH+(.04+this.bottomOffset)*s,0);
    this.anchors.bottomRight.position.set(halfW-.08*s,-halfH+.08*s,0);
    this.anchors.drawerAnchor.position.set(0,-halfH,0);
    this.refreshWorldReadout();
    this.notifyViewport();
  }
  /** Only presentation primitives are accepted; this is not a launch service. */
  presentShipCurtain298(ownerId:string,phase:NativeShipCurtainPhase298,fraction:number):void{
    if(this.closed)return;
    if(phase==='reset'){if(this.shipCurtainOwner298===ownerId)this.resetShipCurtain298();return;}
    if(this.frontVisible||this.page?.id!==ownerId)return;
    if(phase==='clear'){
      if(this.shipCurtainOwner298!==ownerId||this.shipCurtainPhase298!=='held')return;
      this.shipCurtainPhase298='clear';this.shipCurtainRemaining298=Math.fround(3);this.shipCurtainPageHandoff298=true;
      // Adoption begins a fresh visual interval; pre-adoption time is discarded.
      this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;
      this.setShipCurtainAlpha298(this.reducedMotion.matches?0:1);this.notifyCountdownFrameEligibility298();return;
    }
    if(phase!=='closing'&&phase!=='held'||!Number.isFinite(fraction))return;
    if(this.shipCurtainOwner298!==undefined&&this.shipCurtainOwner298!==ownerId)this.resetShipCurtain298(false);
    this.shipCurtainOwner298=ownerId;this.shipCurtainPage298=ownerId;this.shipCurtainPhase298=phase;this.shipCurtainPageHandoff298=false;
    this.setShipCurtainAlpha298(phase==='held'||this.reducedMotion.matches?1:Math.max(0,Math.min(1,fraction)));
  }
  private setShipCurtainAlpha298(alpha:number):void{
    if(this.shipCurtainMaterial298.opacity===alpha)return;
    this.shipCurtainMaterial298.opacity=alpha;this.shipCurtainMesh298.visible=alpha>0;
    this.shipCurtainDisplayDirty298=true;this.invalidate();
  }
  private resetShipCurtain298(wake=true):void{
    if(this.shipCurtainOwner298===undefined)return;
    this.shipCurtainOwner298=undefined;this.shipCurtainPage298=undefined;this.shipCurtainPhase298='idle';
    this.shipCurtainRemaining298=0;this.shipCurtainPageHandoff298=false;
    this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;this.setShipCurtainAlpha298(0);
    if(wake)this.notifyCountdownFrameEligibility298();
  }
  private advanceShipCurtain298(deltaSeconds:number,ownerId:string):void{
    if(this.shipCurtainOwner298!==ownerId||this.shipCurtainPhase298!=='clear')return;
    const delta=Math.fround(Math.min(deltaSeconds,SHIP_FRAME_MAXIMUM_DELTA_298));
    this.shipCurtainRemaining298=Math.fround(this.shipCurtainRemaining298-delta);
    if(this.shipCurtainRemaining298<=0){this.resetShipCurtain298();return;}
    this.setShipCurtainAlpha298(this.reducedMotion.matches?0:this.shipCurtainRemaining298/3);
  }
  private renderShipCurtain298(renderer:THREE.WebGPURenderer):void{
    if(!this.shipCurtainMesh298.visible)return;
    const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),auto=renderer.autoClear;
    const mrt=renderer.getMRT(),renderObject=renderer.getRenderObjectFunction(),xr=renderer.xr.enabled;
    try{
      renderer.autoClear=false;renderer.setMRT(null);renderer.setRenderObjectFunction(null);renderer.xr.enabled=false;
      renderer.render(this.shipCurtainScene298,this.camera);
    }finally{
      renderer.setRenderTarget(target,face,mip);renderer.autoClear=auto;renderer.setMRT(mrt);renderer.setRenderObjectFunction(renderObject);renderer.xr.enabled=xr;
    }
  }
  /** Called by the existing game renderer, using its device and frame loop. */
  renderOverlay(renderer:THREE.WebGPURenderer,now=performance.now()):void{
    if(this.closed||this.frontVisible||!this.worldVisible)return;
    const animated=this.moving.size>0||this.extraAnimating;
    this.animate(now);
    if(this.cacheEnabled){
      const start=performance.now(),draws=renderer.info.render.drawCalls;
      let damage;
      if(animated||this.lastArtRevision!==this.art.revision||this.lastSceneRevision!==this.sceneRevision){
        renderer.getDrawingBufferSize(this.overlaySize);
        damage=this.damageTracker.collect(this.scene,this.camera,Math.floor(this.overlaySize.x),Math.floor(this.overlaySize.y),this.globe?.visible?undefined:this.art.resourceRevision);
        this.lastArtRevision=this.art.revision;this.lastSceneRevision=this.sceneRevision;
        if(damage)this.cacheRevision++;
      }
      this.overlayCache.draw(renderer,this.scene,this.camera,this.cacheRevision,false,damage??undefined);
      this.renderShipCurtain298(renderer);this.shipCurtainDisplayDirty298=false;
      this.stats.renderMs=performance.now()-start;this.stats.drawCalls=renderer.info.render.drawCalls-draws;this.stats.overlayRenders++;return;
    }
    const auto=renderer.autoClear,target=renderer.getRenderTarget();renderer.autoClear=false;
    try{
      renderer.clearDepth();const start=performance.now(),draws=renderer.info.render.drawCalls;renderer.render(this.scene,this.camera);
      this.renderShipCurtain298(renderer);this.shipCurtainDisplayDirty298=false;
      this.stats.renderMs=performance.now()-start;this.stats.drawCalls=renderer.info.render.drawCalls-draws;this.stats.overlayRenders++;
    }finally{renderer.autoClear=auto;renderer.setRenderTarget(target);}
  }
  /** No World or admission capability: this is only the existing RAF source. */
  private countdownDriver298():'game'|'standalone'|undefined{return this.frontVisible||this.standalone?'standalone':this.worldVisible?'game':undefined;}
  private syncCountdownFrameEligibility298(wake:boolean):void{
    const present=this.shipCurtainOwner298===undefined||!this.frontVisible&&(this.options.countdownFrame298?.canPresent?.()??true);
    if(this.shipCurtainOwner298!==undefined&&!present)this.resetShipCurtain298(false);
    const available=!this.closed&&!document.hidden,feed=available&&this.options.countdownFrame298?.canFeed()===true;
    const eligible=feed||available&&present&&this.shipCurtainPhase298==='clear';
    // A new external countdown gets a fresh anchor even during a local clear.
    if(eligible!==this.countdownFrameEligible298||feed!==this.countdownFeedEligible298){
      this.countdownFrameEligible298=eligible;this.countdownFeedEligible298=feed;this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;
    }
    if(wake&&eligible&&this.countdownDriver298()==='standalone')this.scheduleStandaloneFrame298(false);
  }
  notifyCountdownFrameEligibility298():void{this.syncCountdownFrameEligibility298(true);}
  private resetCountdownFrame298():void{this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;this.notifyCountdownFrameEligibility298();}
  private sampleCountdownFrame298(driver:'game'|'standalone',now:number,ready=true):void{
    // Non-elected/manual sources neither finance nor reset the elected clock.
    if(driver!==this.countdownDriver298())return;
    this.syncCountdownFrameEligibility298(false);
    if(!ready||!this.countdownFrameEligible298||!Number.isFinite(now)){
      this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;return;
    }
    const before=this.countdownFrameAt298;
    if(this.countdownFrameDriver298!==driver||before===undefined||now<before){this.countdownFrameDriver298=driver;this.countdownFrameAt298=now;return;}
    this.countdownFrameAt298=now;if(now===before)return;
    const clearOwner=this.shipCurtainPhase298==='clear'?this.shipCurtainOwner298:undefined,delta=(now-before)/1000;
    if(this.countdownFeedEligible298)this.options.countdownFrame298!.feed(delta);
    if(clearOwner!==undefined)this.advanceShipCurtain298(delta,clearOwner);
  }
  /** MAIN invokes this only after its actual game frame/guards, never renderScene. */
  gameCountdownFrame298(now:number,ready:boolean):void{this.sampleCountdownFrame298('game',now,ready);}
  invalidate():void{this.scheduleStandaloneFrame298(true);}
  private scheduleStandaloneFrame298(needsRender:boolean):void{
    if(needsRender)this.standaloneNeedsRender298=true;
    if(this.closed||!this.initialized||!this.frontVisible&&!this.standalone||this.frameId||document.hidden)return;
    this.frameId=requestAnimationFrame(now=>{this.frameId=0;if(this.closed||!this.initialized||!this.frontVisible&&!this.standalone||document.hidden)return;
      try{
        const requested=this.standaloneNeedsRender298,animated=this.moving.size>0||this.extraAnimating,art=this.art.revision,scene=this.sceneRevision;this.standaloneNeedsRender298=false;this.animate(now);
        // Clock-only continuation keeps the static canvas. Dirty opacity, even
        // its final zero, requests one last display without dirtying UI textures.
        if(requested||this.shipCurtainDisplayDirty298||animated||this.moving.size||this.extraAnimating||art!==this.art.revision||scene!==this.sceneRevision){
          const start=performance.now(),draws=this.ownRenderer.info.render.drawCalls;this.ownRenderer.render(this.scene,this.camera);
          this.renderShipCurtain298(this.ownRenderer);this.shipCurtainDisplayDirty298=false;
          this.stats.renderMs=performance.now()-start;this.stats.renders++;this.stats.drawCalls=this.ownRenderer.info.render.drawCalls-draws;
        }
        this.sampleCountdownFrame298('standalone',now);
        if(this.moving.size||this.extraAnimating||this.countdownFrameEligible298&&this.countdownDriver298()==='standalone')this.scheduleStandaloneFrame298(false);
      }catch(error){
        this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;throw error;
      }
    });
  }
  private animate(now:number):void{
    const dt=this.lastTime?Math.min(.05,(now-this.lastTime)/1000):1/60;this.lastTime=now;
    const reduced=this.reducedMotion.matches;
    const wanted=this.autoHideBottom&&this.worldVisible&&!this.frontVisible&&!this.page?.modal&&!this.bottomOpen?-(this.bottomDockHeight-14)*.01:0;
    const next=reduced?wanted:this.bottomOffset+(wanted-this.bottomOffset)*Math.min(1,dt*15);
    if(next!==this.bottomOffset){this.bottomOffset=Math.abs(wanted-next)<.001?wanted:next;this.anchors.bottomCenter.position.y=-this.visH/2+.04*this.uiScale+this.bottomOffset*this.uiScale;this.sceneRevision++;}
    const external=this.options.onAnimate?.(dt)??false;if(external)this.sceneRevision++;
    this.extraAnimating=Math.abs(wanted-this.bottomOffset)>.001||external;
    for(const piece of this.moving){
      const ud=piece.userData;ud.hoverVal=reduced?ud.hoverTarget:ud.hoverVal+(ud.hoverTarget-ud.hoverVal)*14*dt;
      ud.pressVal=reduced?0:Math.max(0,ud.pressVal-5.5*dt);
      if(Math.abs(ud.hoverTarget-ud.hoverVal)<.001)ud.hoverVal=ud.hoverTarget;
      this.setPose(piece,ud.hoverVal);
      if(ud.hoverVal===ud.hoverTarget&&ud.pressVal===0)this.moving.delete(piece);
    }
  }
  private setPose(piece:CardboardPiece,hover:number):void{
    if(piece.userData.nativeMapToolPose){if(applyNativeMapToolHover(piece,hover))this.sceneRevision++;if(this.mapToolLabelOwner===piece)this.updateMapToolLabel();return;}
    if(piece.userData.nativeToolbarPose){if(applyNativeHudButtonPose(piece))this.sceneRevision++;return;}
    const ud=piece.userData,toolbar=String(ud.nativeId??'').startsWith('tab:'),activeLift=ud.active?(toolbar?.065:.02):0,hoverLift=hover*(toolbar?.085:.025),pressPush=ud.pressVal*(toolbar?.05:Math.min(.02,ud.depth*.5));
    const x=ud.basePos.x,y=ud.basePos.y+(ud.active&&toolbar?.045:0)+hover*(toolbar?.03:.005),z=ud.basePos.z+activeLift+hoverLift-pressPush;
    const rx=-hover*(toolbar?.14:.045)+(ud.active&&toolbar?-.1:0),ry=hover*(toolbar?.12:.035),rz=ud.baseRot.z+hover*(toolbar?.035:.012);
    const offset=.022+(activeLift+hoverLift)*.35,sy=-offset*1.15,sz=-.012-(activeLift+hoverLift)*.6;
    if(piece.position.x===x&&piece.position.y===y&&piece.position.z===z&&piece.rotation.x===rx&&piece.rotation.y===ry&&piece.rotation.z===rz&&ud.shadowMesh.position.x===offset&&ud.shadowMesh.position.y===sy&&ud.shadowMesh.position.z===sz)return;
    piece.position.set(x,y,z);piece.rotation.set(rx,ry,rz);ud.shadowMesh.position.set(offset,sy,sz);this.sceneRevision++;
  }
  private register(piece:CardboardPiece,control?:NativeControl,input?:NativeRow['input']):Hit{
    const hit:Hit={piece,control,input};
    for(const mesh of piece.userData.interactiveMeshes??[])this.hits.set(mesh,hit);
    return hit;
  }
  private unregister(piece:CardboardPiece):void{
    if(this.mapToolLabelOwner===piece)this.clearMapToolLabel();
    if(this.hintOwner===piece)this.clearHint();
    if(this.hovered===piece)this.hover(null);this.moving.delete(piece);
    for(const mesh of piece.userData.interactiveMeshes??[])this.hits.delete(mesh);
    this.art.disposePiece(piece);
  }
  private hit(x:number,y:number,includeAllUi=false):Hit|undefined{
    if(this.closed||(!this.worldVisible&&!this.frontVisible&&!this.standalone))return;
    this.pointer.set(x/(this.width*this.displayScale)*2-1,1-y/(this.height*this.displayScale)*2);this.scene.updateMatrixWorld(true);this.raycaster.setFromCamera(this.pointer,this.camera);this.stats.raycasts++;
    const acquired=this.hoverPose;
    // Only toolbar cards use this acquired hover surface. Page clipping and
    // inline controls continue to use their ordinary live intersections.
    if(acquired&&acquired.pageId===this.page?.id&&this.acquiredHitLive(acquired.piece)&&acquired.pose.intersects(this.raycaster)){
      const hit=this.hits.get(acquired.piece.userData.mesh);return hit??{piece:acquired.piece};
    }
    const objects=this.art.interactiveMeshes.filter(mesh=>{let object:THREE.Object3D|null=mesh;while(object){if(!object.visible)return false;object=object.parent;}return true;});
    let backdrop:Hit|undefined;
    for(const intersection of this.raycaster.intersectObjects(objects,false)){
      const mesh=intersection.object as THREE.Mesh;
      const found=this.hits.get(mesh)??(mesh.userData.widgetGroup?{piece:mesh.userData.widgetGroup as CardboardPiece}:undefined);if(!found)continue;
      let clipped=false;
      for(let content:THREE.Object3D|null=found.piece;content;content=content.parent){const group=content as THREE.ClippingGroup;if(group.isClippingGroup&&group.enabled&&group.clippingPlanes.some(plane=>plane.distanceToPoint(intersection.point)<0)){clipped=true;break;}}
      if(clipped)continue;
      if(this.page?.modal&&!includeAllUi){
        // Parent membership is tested explicitly below, independent of DOM.
        let parent:THREE.Object3D|null=found.piece;while(parent&&parent!==this.pageGroup)parent=parent.parent;
        if(!parent&&!this.dropdown?.pieces.includes(found.piece))continue;
      }
      // The physical paper can extend in front of its invisible text targets.
      // Keep it as an occlusion barrier while checking this page's own content.
      if(found.piece===this.pageBackdrop){backdrop=found;continue;}
      if(backdrop&&!this.belongsToPage(found))continue;
      const insets=this.insetControls.get(found.piece);
      if(insets){const local=found.piece.worldToLocal(intersection.point.clone());for(const inset of insets){const rect=inset.region!;if(local.x>=rect.x&&local.x<=rect.x+rect.width&&local.y>=rect.y&&local.y<=rect.y+rect.height)return inset;}}
      return found;
    }
    return backdrop;
  }
  private swallow(event:Event):void{event.preventDefault();event.stopImmediatePropagation();}
  private gesture():void{try{this.options.onGesture?.();}catch(error){this.options.onError(String(error));}}
  private acquiredHitLive(piece:CardboardPiece):boolean{
    if(!piece.parent||piece.userData.nativeDisabled||!this.art.interactiveMeshes.includes(piece.userData.mesh))return false;
    for(let node:THREE.Object3D|null=piece;node;node=node.parent)if(!node.visible)return false;
    return !this.dropdown&&(!this.page?.modal||this.belongsToPage({piece}));
  }
  private updatePointerCursor(hit?:Hit):void{
    setNativeCursor(document.documentElement,this.pendingActions?'wait':this.regionDrag||this.scrollbarDrag||this.globeDrag?'grabbing':hit?.control?.disabled||hit?.piece.userData.nativeDisabled?'forbidden':hit?.input?'text':hit?.piece.userData.nativeScroll||hit?.piece.userData.nativeReadoutScroll?'grab':hit&&!hit.piece.userData.nativeStatic?'link':this.frontVisible||this.page?.modal?'pointer':undefined);
  }
  private clearMapToolLabel():void {
    if(this.mapToolLabel){this.mapToolLabel.removeFromParent();this.art.disposePiece(this.mapToolLabel);this.sceneRevision++;}
    this.mapToolLabel=undefined;this.mapToolLabelOwner=undefined;this.mapToolLabelTitle='';
  }
  private showMapToolLabel(owner:CardboardPiece):void {
    const title=String(owner.userData.nativeMapToolTitle??'');if(!title)return;
    if(this.mapToolLabelOwner===owner&&this.mapToolLabelTitle===title)return;
    this.clearMapToolLabel();const width=Math.min(220,Math.max(54,this.measure(title,13,true)+20)),height=26;
    const label=this.art.createPiece({w:width*.01,h:height*.01,depth:.018,bevel:.012,uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:52,bgColor:PALETTE.creamPaper,seed:this.seed('map-tool-label:'+title),interactive:false,
      drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.font=this.font(13,true);ctx.textAlign='center';ctx.fillStyle=PALETTE.inkDark;ctx.fillText(title,width/2,18,width-12);ctx.restore();}});
    label.userData.nativeId='map-tool-hover-title';label.userData.nativeStatic=true;label.visible=false;
    (String(owner.userData.nativeId).startsWith('map-dock:')?this.toolsDock:this.pageGroup).add(label);
    this.mapToolLabel=label;this.mapToolLabelOwner=owner;this.mapToolLabelTitle=title;this.sceneRevision++;this.updateMapToolLabel();
  }
  private updateMapToolLabel():void {
    const label=this.mapToolLabel,owner=this.mapToolLabelOwner;if(!label||!owner)return;
    const u=owner.userData,h=Math.max(0,Math.min(1,u.hoverVal));
    if(!owner.parent||!u.nativeMapToolPose||h===0&&u.hoverTarget===0){this.clearMapToolLabel();return;}
    const half=this.mapToolLabel!.userData.w*.5,limit=(this.pageBox?.width??this.width)*.005;
    const x=Math.max(-limit+half,Math.min(limit-half,u.basePos.x)),y=u.basePos.y-u.h*.5*(1+h*.45)-.18,z=owner.position.z+.08,visible=h>.01;
    if(label.position.x===x&&label.position.y===y&&label.position.z===z&&label.scale.x===h&&label.visible===visible)return;
    label.setBaseTransform(x,y,z);label.scale.setScalar(h);label.visible=visible;this.sceneRevision++;
  }

  private hover(piece:CardboardPiece|null):void{
    if(piece?.userData.nativeStatic||piece?.userData.nativeDisabled)piece=null;
    if(piece===this.hovered)return;
    const mesh=piece?.userData.interactiveMeshes?.[0];
    this.hoverPreview.set(mesh?this.hits.get(mesh)?.control?.onHover:undefined);
    if(this.hovered){this.hovered.userData.hoverTarget=0;this.moving.add(this.hovered);}
    this.hovered=piece;this.hoverPose=undefined;
    if(piece){
      const id=String(piece.userData.nativeId??'');
      if(piece.userData.nativeMapToolPose||id.startsWith('tab:')||id.startsWith('hud:speed:')||id.startsWith('hud:view:')||id.startsWith('map-dock:')){
        this.scene.updateMatrixWorld(true);this.hoverPose={piece,pose:new NativeHitPose(piece.userData.interactiveMeshes??[]),pageId:this.page?.id};
      }
      piece.userData.hoverTarget=1;this.moving.add(piece);if(piece.userData.nativeMapToolPose)this.showMapToolLabel(piece);
    }this.invalidate();
  }
  private pointerMove(event:PointerEvent):void{
    this.lastPointer={x:event.clientX/this.displayScale,y:event.clientY/this.displayScale};this.options.onPointer?.(this.lastPointer.x,this.lastPointer.y);
    const bottomOpen=this.lastPointer.y>=this.height-Math.max(14,this.bottomDockHeight+this.bottomOffset*100);
    if(bottomOpen!==this.bottomOpen){this.bottomOpen=bottomOpen;this.extraAnimating=true;this.invalidate();}
    if(this.editor&&event.target===this.editor)return;
    if(this.regionDrag){const drag=this.regionDrag;if(drag.pointerId!==event.pointerId)return;const value=THREE.MathUtils.clamp(drag.offset+((drag.axis==='x'?event.clientX:event.clientY)/this.displayScale-drag.start)/Math.max(1,drag.travel)*drag.max,0,drag.max);if(drag.axis==='x')this.setHorizontalOffset(drag.region,value);else this.setRegionOffset(drag.region,value);this.rebuildPage(true);this.swallow(event);this.invalidate();return;}
    if(this.scrollbarDrag){const drag=this.scrollbarDrag;if(drag.pointerId!==event.pointerId)return;this.scroll=THREE.MathUtils.clamp(drag.scroll+(event.clientY/this.displayScale-drag.startY)/Math.max(1,drag.travel)*drag.max,0,drag.max);this.rebuildPage(true);this.swallow(event);this.invalidate();return;}
    if(this.paintDrag){const hit=this.hit(event.clientX,event.clientY),paint=hit?.control?.paint;if(paint?.group===this.paintDrag.group){this.paintDrag.indices.add(paint.index);hit!.piece.userData.pressVal=.7;this.moving.add(hit!.piece);this.invalidate();}this.swallow(event);return;}
    if(this.worldPress?.pointerId===event.pointerId&&this.worldPress.button!==0&&event.buttons!==0){this.setPointerOverUi(false);this.clearHint();this.hover(null);return;}
    if(this.dropdown){const hit=this.hit(event.clientX,event.clientY);this.setPointerOverUi(true);this.updateHint(hit,event.clientX,event.clientY);this.hover(this.dropdown.pieces.includes(hit?.piece!)?hit!.piece:null);this.swallow(event);return;}
    if(this.worldPress?.pointerId===event.pointerId&&event.buttons!==0){this.setPointerOverUi(false);this.clearHint();this.hover(null);return;}
    if(this.globeDrag){const drag=this.globeDrag;if(drag.pointerId!==event.pointerId)return;
      this.globe?.rotate((event.clientX-drag.x)*.008,(event.clientY-drag.y)*.008);this.sceneRevision++;drag.x=event.clientX;drag.y=event.clientY;this.swallow(event);this.invalidate();return;}
    if(this.globeHit(event.clientX,event.clientY)!==null){setNativeCursor(document.documentElement,'grab');this.setPointerOverUi(true);this.clearHint();this.hover(null);this.swallow(event);return;}
    const hit=this.hit(event.clientX,event.clientY);this.setPointerOverUi(!!hit&&hit.piece!==this.worldReadout||this.frontVisible||!!this.page?.modal);this.updateHint(hit,event.clientX,event.clientY);this.hover(hit?.control?.disabled?null:hit?.piece??null);
    this.updatePointerCursor(hit);
    if(hit||this.frontVisible||this.page?.modal)this.swallow(event);
  }
  private pointerDown(event:PointerEvent):void{
    if(this.editor&&event.target===this.editor)return;
    if((event.button===1||event.button===2)&&this.cameraWorldPoint(event.clientX,event.clientY)){
      this.clearHint();this.hover(null);this.setPointerOverUi(false);this.worldPress={pointerId:event.pointerId,button:event.button};setNativeCursor(document.documentElement,'grabbing');return;
    }
    this.clearHint();
    if(event.button===0&&this.globeHit(event.clientX,event.clientY)!==null){
      this.gesture();setNativeCursor(document.documentElement,'grabbing');this.setPointerOverUi(true);this.globeDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};this.swallow(event);return;
    }
    const hit=this.hit(event.clientX,event.clientY);
    const box=this.pageBox,x=event.clientX/this.displayScale,y=event.clientY/this.displayScale,inside=!!box&&x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height;
    // Map tool palettes keep empty-world presses on the renderer's gesture path.
    // Actual UI hits and release-over-UI cancellation retain their ordinary rules.
    const paletteWorldPress=event.button===0&&event.isPrimary&&!!box&&!hit&&!inside&&this.worldVisible&&!this.frontVisible&&!this.editor&&!this.dropdown&&!this.page?.modal
      &&this.page?.layout==='palette'&&(this.page.palette==='orders'||this.page.palette==='zones');
    const outside=!paletteWorldPress&&event.button===0&&this.page&&this.page.closable!==false&&!this.belongsToPage(hit)&&(!inside||!!hit)?this.page.id:undefined;
    if(outside&&(!hit||hit.piece.userData.nativeStatic||hit.control?.disabled||this.dropdown&&!this.dropdown.pieces.includes(hit.piece))){
      this.dismissPage();this.dismissedPointer=event.pointerId;this.swallow(event);return;
    }
    if(this.dropdown&&!this.dropdown.pieces.includes(hit?.piece!)){this.closeDropdown();this.swallow(event);return;}
    if(!hit&&inside){this.dismissedPointer=event.pointerId;this.swallow(event);return;}
    const scroll=hit?.piece.userData.nativeScroll as {region:NativeRegion|undefined;axis:'x'|'y';start:number;travel:number;max:number;thumb:number;isThumb:boolean}|undefined;
    if(event.button===0&&scroll){
      const coordinate=(scroll.axis==='x'?event.clientX:event.clientY)/this.displayScale;
      if(!scroll.isThumb){const next=THREE.MathUtils.clamp((coordinate-scroll.start-scroll.thumb/2)/Math.max(1,scroll.travel)*scroll.max,0,scroll.max);if(scroll.axis==='x')this.setHorizontalOffset(scroll.region,next);else this.setRegionOffset(scroll.region,next);this.rebuildPage(true);}
      this.regionDrag={pointerId:event.pointerId,region:scroll.region,axis:scroll.axis,start:coordinate,offset:scroll.axis==='x'?this.horizontalOffset(scroll.region):this.regionOffset(scroll.region),travel:scroll.travel,max:scroll.max};this.updatePointerCursor(hit);this.swallow(event);this.invalidate();return;
    }
    if(event.button===0&&(hit?.piece.userData.nativeId==='native-scrollbar'||hit?.piece.userData.nativeId==='native-scroll-thumb')&&this.pageBox){
      const box=this.pageBox,travel=box.body.height-Math.max(28,box.body.height*box.body.height/box.contentHeight);
      if(hit.piece.userData.nativeId==='native-scrollbar'){this.scroll=THREE.MathUtils.clamp((event.clientY/this.displayScale-box.y-box.body.y)/box.body.height*this.maxScroll,0,this.maxScroll);this.rebuildPage(true);}
      this.scrollbarDrag={pointerId:event.pointerId,startY:event.clientY/this.displayScale,scroll:this.scroll,travel,max:this.maxScroll};this.swallow(event);this.invalidate();return;
    }
    this.setPointerOverUi(!!hit&&hit.piece!==this.worldReadout||this.frontVisible||!!this.page?.modal);
    if(hit||this.frontVisible||this.page?.modal)this.gesture();
    if(!hit){if(this.frontVisible||this.page?.modal)this.swallow(event);else{this.worldPress={pointerId:event.pointerId,button:event.button};if(event.button!==0)setNativeCursor(document.documentElement,'grabbing');}return;}
    this.swallow(event);if(event.button!==0)return;
    if(hit.piece.userData.nativeStatic)return;
    if(hit.control?.disabled)return;
    if(hit.control?.paint){const paint=hit.control.paint;this.paintDrag={pointerId:event.pointerId,group:paint.group,indices:new Set([paint.index]),onPaint:paint.onPaint};hit.piece.userData.pressVal=.7;this.moving.add(hit.piece);this.invalidate();return;}
    const id=hit.control?.id??String(hit.piece.userData.nativeId),switchesPage=id.startsWith('tab:')||id.startsWith('map-dock:');
    this.down={piece:hit.piece,controlId:hit.control?.id,outsidePage:switchesPage?undefined:outside,pageId:this.page?.id,layout:this.pageBox,pose:new NativeHitPose(hit.piece.userData.interactiveMeshes??[]),pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    hit.piece.userData.pressVal=1;this.moving.add(hit.piece);this.invalidate();
  }
  private pointerUp(event:PointerEvent):void{
    if(this.dismissedPointer===event.pointerId){this.dismissedPointer=undefined;this.swallow(event);return;}
    if(this.regionDrag){this.regionDrag=undefined;this.updatePointerCursor(this.hit(event.clientX,event.clientY));this.swallow(event);return;}
    if(this.scrollbarDrag){this.scrollbarDrag=undefined;this.updatePointerCursor(this.hit(event.clientX,event.clientY));this.swallow(event);return;}
    if(this.paintDrag){const drag=this.paintDrag;this.paintDrag=undefined;this.swallow(event);if(drag.pointerId===event.pointerId){const values=[...drag.indices],from=Math.min(...values),to=Math.max(...values);void Promise.resolve(drag.onPaint(Array.from({length:to-from+1},(_,i)=>from+i))).catch(error=>this.options.onError(String(error)));}return;}
    if(this.worldPress?.pointerId===event.pointerId){
      const world=this.worldPress;this.worldPress=undefined;
      this.updatePointerCursor();
      if(world.button===0&&(this.hit(event.clientX,event.clientY)||this.globeHit(event.clientX,event.clientY)!==null||this.frontVisible||this.page?.modal)){
        this.options.onCancelWorldInteraction?.();this.swallow(event);
      }
      return;
    }
    if(this.globeDrag){const drag=this.globeDrag;this.globeDrag=undefined;this.swallow(event);
      if(drag.pointerId===event.pointerId&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6){
        this.globeHit(event.clientX,event.clientY);this.globe?.pick(this.raycaster);this.invalidate();}return;
    }
    const down=this.down;if(!down){if(this.frontVisible||this.page?.modal)this.swallow(event);return;}
    this.down=null;this.swallow(event);let hit=this.hit(event.clientX,event.clientY);
    if(down.pointerId!==event.pointerId||Math.hypot(event.clientX-down.x,event.clientY-down.y)>12)return;
    if(hit?.piece!==down.piece&&down.pageId===this.page?.id&&down.layout===this.pageBox&&this.acquiredHitLive(down.piece)&&!this.insetControls.has(down.piece)&&down.pose.intersects(this.raycaster))hit=this.hits.get(down.piece.userData.mesh)??{piece:down.piece};
    if(hit?.piece!==down.piece||hit?.control?.id!==down.controlId)return;
    const page=this.page,id=hit.control?.id??String(hit.piece.userData.nativeId??'');
    const dismissInspector=!!(down.outsidePage&&page&&page.id===down.outsidePage&&!this.frontVisible&&!page.modal&&page.closable!==false
      &&page.layout==='inspector'&&page.id.startsWith('inspect-pawn-')&&/^hud:speed:(0|1|3|6)$/.test(id)&&this.options.onHudInspectorDismiss);
    if(down.outsidePage&&page?.id===down.outsidePage&&!dismissInspector)this.dismissPage();
    this.activate(hit,dismissInspector);
  }
  private belongsToPage(hit:Hit|undefined):boolean{if(!hit)return false;if(this.dropdown?.pieces.includes(hit.piece))return true;for(let parent:THREE.Object3D|null=hit.piece;parent;parent=parent.parent)if(parent===this.pageGroup)return true;return false;}
  private dismissPage():void{const page=this.page;if(!page||page.closable===false)return;this.activationSerial++;this.closeDropdown();this.clearHint();try{page.onClose?.();if(!this.frontVisible||!page.onClose)this.options.onEscape();}catch(error){this.options.onError(String(error));}}
  private cancelPress():void{this.down=null;this.dismissedPointer=undefined;this.globeDrag=undefined;this.scrollbarDrag=undefined;this.regionDrag=undefined;this.paintDrag=undefined;if(this.worldPress)this.options.onCancelWorldInteraction?.();this.worldPress=undefined;}
  private globeHit(x:number,y:number):number|null{
    if(!this.globe?.visible||!this.page?.visual)return null;
    this.pointer.set(x/(this.width*this.displayScale)*2-1,1-y/(this.height*this.displayScale)*2);this.scene.updateMatrixWorld(true);this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.globe.hitTest(this.raycaster);
  }
  private activate(hit:Hit,dismissInspector=false):void{
    if(hit.control?.disabled)return;
    if(hit.input&&this.editing===hit&&this.editor){this.editor.focus({preventScroll:true});return;}
    const serial=++this.activationSerial,id=hit.control?.id??String(hit.piece.userData.nativeId??''),pageId=this.page?.id;
    const pageBound=this.pagePieces.includes(hit.piece);
    void(async()=>{
      const pending=this.editor?this.finishEdit(true):this.editorCommitPageId===pageId?this.editorCommit:undefined;
      if(pending&&!await pending)return;
      if(this.closed||serial!==this.activationSerial||pageBound&&this.page?.id!==pageId)return;
      const live=pageBound?this.pageControls.find(current=>(current.control?.id??String(current.piece.userData.nativeId??''))===id)
        :[...this.hits.values()].find(current=>current.piece===hit.piece)??(hit.piece.parent?hit:undefined);
      if(!live||live.control?.disabled)return;
      if(live.input){this.beginEdit(live);return;}
      if(live.control?.select){this.openDropdown(live);return;}
      const action=live.control?.onActivate??live.piece.userData.onClick;
      if(action){
        if(dismissInspector&&this.page&&this.page.id===pageId&&!this.frontVisible&&!this.page.modal&&this.page.closable!==false){
          this.closeDropdown();this.clearHint();this.options.onHudInspectorDismiss?.();
        }
        if(id)this.options.onActivate?.(id);const result=action(),pending=result!=null&&typeof (result as PromiseLike<unknown>).then==='function';
        if(pending){this.pendingActions++;this.updatePointerCursor();}
        void Promise.resolve(result).catch(error=>{if(!this.closed)this.options.onError(error instanceof Error?error.message:String(error));}).finally(()=>{if(pending){this.pendingActions--;if(!this.closed)this.updatePointerCursor(this.hit(this.lastPointer.x*this.displayScale,this.lastPointer.y*this.displayScale));}});
      }
    })().catch(error=>{if(!this.closed)this.options.onError(error instanceof Error?error.message:String(error));});
  }
  private closeDropdown():void{
    if(!this.dropdown)return;const pieces=this.dropdown.pieces;this.dropdown=undefined;for(const piece of pieces)this.unregister(piece);this.sceneRevision++;this.invalidate();
  }
  private openDropdown(hit:Hit):void{
    const select=hit.control?.select;if(!select||!this.page)return;
    this.closeDropdown();const center=hit.piece.getWorldPosition(new THREE.Vector3()).project(this.camera),scale=hit.piece.getWorldScale(new THREE.Vector3());
    const x=(center.x+1)*this.width/2,y=(1-center.y)*this.height/2;
    const width=Math.min(this.width-24,360,Math.max(100,hit.piece.userData.w*scale.x/this.visW*this.width,...select.options.map(option=>this.measure(option.label,13)+34)));
    const height=Math.min(this.height-24,392,select.options.length*25+10),top=y+hit.piece.userData.h*scale.y/this.visH*this.height/2+4;
    this.dropdown={controlId:hit.control!.id,pageId:this.page.id,box:{x:THREE.MathUtils.clamp(x-width/2,12,this.width-width-12),y:top+height<=this.height-12?top:Math.max(12,y-height-16),width,height},offset:0,index:Math.max(0,select.options.findIndex(option=>option.value===select.value)),pieces:[]};
    this.rebuildDropdown();
  }
  private rebuildDropdown():void{
    const state=this.dropdown;if(!state)return;
    const control=this.pageControls.find(hit=>hit.control?.id===state.controlId)?.control,select=control?.select;
    if(!select||this.page?.id!==state.pageId||control.disabled){this.closeDropdown();return;}
    for(const piece of state.pieces)this.unregister(piece);state.pieces=[];
    const {box}=state,count=Math.max(1,Math.floor((box.height-10)/25));state.offset=THREE.MathUtils.clamp(state.offset,0,Math.max(0,select.options.length-count));
    const place=(piece:CardboardPiece,x:number,y:number,z:number)=>{const factor=1-z/HUD_DISTANCE;piece.scale.setScalar(this.uiScale*factor);piece.setBaseTransform((x-this.width/2)*this.visH/this.height*factor,(this.height/2-y)*this.visH/this.height*factor,z);this.hudRoot.add(piece);state.pieces.push(piece);};
    const background=this.art.createPiece({w:box.width*.01,h:box.height*.01,uvPadding:1,bgColor:PALETTE.creamPaper,depth:.046,bevel:.038,surface:'panel',seed:938,interactive:true,drawFn:()=>{}});
    background.userData.nativeId='select-popup';background.userData.nativeStatic=true;this.register(background);place(background,box.x+box.width/2,box.y+box.height/2,1.6);
    select.options.slice(state.offset,state.offset+count).forEach((option,index)=>{
      const actual=index+state.offset,selected=actual===state.index,piece=this.art.createPiece({w:(box.width-10)*.01,h:.235,uvPadding:1,paper:selected,textureWidth:Math.ceil((box.width-10)*2),textureHeight:47,bgColor:PALETTE.ochre,seed:949+actual,interactive:true,tooltip:option.hint??option.label,drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/(box.width-10),hp/23.5);ctx.textAlign='left';ctx.fillStyle=option.disabled?'#92816a':PALETTE.inkDark;ctx.font=this.font(13);ctx.fillText((option.value===select.value?'✓ ':'')+option.label,7,16,box.width-28);ctx.restore();}});
      const optionControl:NativeControl={id:'select-option:'+state.controlId+':'+option.value,label:option.label,disabled:option.disabled,hint:option.hint??option.label,onActivate:()=>this.selectDropdown(option.value)};
      piece.userData.nativeId=optionControl.id;this.register(piece,optionControl);place(piece,box.x+box.width/2,box.y+5+index*25+11.75,1.64);
    });
    if(select.options.length>count){const piece=this.art.createPiece({w:.035,h:(box.height-12)*count/select.options.length*.01,paper:false,drawFn:(ctx,w,h)=>{ctx.fillStyle='#5f7651';ctx.fillRect(0,0,w,h);}});place(piece,box.x+box.width-4,box.y+6+(box.height-12-count/select.options.length*(box.height-12))*state.offset/(select.options.length-count)+(box.height-12)*count/select.options.length/2,1.67);}
    this.sceneRevision++;this.invalidate();
  }
  private selectDropdown(value:string):void{
    const state=this.dropdown;if(!state)return;const control=this.pageControls.find(hit=>hit.control?.id===state.controlId)?.control;
    if(this.page?.id!==state.pageId||control?.disabled||!control?.select?.options.some(option=>option.value===value&&!option.disabled)){this.closeDropdown();return;}
    const change=control.select.onChange;this.closeDropdown();void Promise.resolve(change(value)).catch(error=>this.options.onError(String(error)));
  }
  private dropdownKey(key:string):void{
    const state=this.dropdown;if(!state)return;const select=this.pageControls.find(hit=>hit.control?.id===state.controlId)?.control?.select;if(!select){this.closeDropdown();return;}
    if(key==='Enter'||key===' '){const option=select.options[state.index];if(option&&!option.disabled)this.selectDropdown(option.value);return;}
    if(key==='Home')state.index=0;else if(key==='End')state.index=select.options.length-1;else{const step=key==='ArrowUp'?-1:1;for(let i=0;i<select.options.length;i++){state.index=(state.index+step+select.options.length)%select.options.length;if(!select.options[state.index]?.disabled)break;}}
    const count=Math.floor((state.box.height-10)/25);if(state.index<state.offset)state.offset=state.index;else if(state.index>=state.offset+count)state.offset=state.index-count+1;this.rebuildDropdown();
  }
  private keyDown(event:KeyboardEvent):void{
    if(this.page?.layout==='storage'&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){
      const search=this.pageControls.find(hit=>hit.input&&String(hit.piece.userData.nativeId).endsWith('-search'));
      if(search){this.swallow(event);this.closeDropdown();this.activate(search);return;}
    }
    if(this.editor&&event.target===this.editor)return;
    if(this.dropdown){if(event.key==='Escape'||event.key==='Tab'){this.swallow(event);this.closeDropdown();return;}if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){this.swallow(event);this.dropdownKey(event.key);return;}}
    if(event.key==='Escape'){
      this.activationSerial++;if(this.paintDrag||this.scrollbarDrag||this.regionDrag){this.cancelPress();this.swallow(event);return;}
      this.swallow(event);const cancel=this.page?.onCancel;
      if(cancel){if(!event.repeat){this.gesture();this.options.onActivate?.('page:cancel');cancel();}return;}
      if(this.page?.closable===false)return;
      if(!event.repeat){this.gesture();this.options.onActivate?.('page:close');}
      if(this.page?.onClose)this.page.onClose();else this.options.onEscape();return;
    }
    if(event.key==='Tab'&&(this.page||this.frontVisible)){
      if(!event.repeat)this.gesture();
      this.swallow(event);const list=this.pageControls.filter(hit=>!hit.control?.disabled);if(!list.length)return;
      if(this.focusIndex>=0&&list[this.focusIndex])this.hover(null);
      this.focusNextControl(event.shiftKey?-1:1);return;
    }
    if((event.key==='Enter'||event.key===' ')&&this.focusIndex>=0&&this.page){
      const hit=this.pageControls.filter(item=>!item.control?.disabled)[this.focusIndex];if(hit){this.swallow(event);if(!event.repeat){this.gesture();this.activate(hit);}}return;
    }
    if(this.frontVisible||this.page?.modal){if(!event.repeat)this.gesture();this.swallow(event);}
  }
  private wheel(event:WheelEvent):void{
    if(this.cameraWorldPoint(event.clientX,event.clientY)){this.clearHint();this.hover(null);this.setPointerOverUi(false);return;}
    if(this.worldReadoutMaxScroll>0&&this.worldReadout?.visible&&this.hit(event.clientX,event.clientY)?.piece===this.worldReadout){this.swallow(event);this.worldReadoutScroll=THREE.MathUtils.clamp(this.worldReadoutScroll+Math.sign(event.deltaY)*3,0,this.worldReadoutMaxScroll);this.worldReadout.redraw();this.invalidate();return;}
    if(this.hintPiece&&this.hintMaxScroll>0&&this.hit(event.clientX,event.clientY)?.piece===this.hintOwner){this.swallow(event);this.hintScroll=THREE.MathUtils.clamp(this.hintScroll+Math.sign(event.deltaY)*3,0,this.hintMaxScroll);this.hintPiece.redraw();this.invalidate();return;}
    this.clearHint();
    if(this.dropdown){this.swallow(event);this.dropdown.offset=Math.max(0,this.dropdown.offset+Math.sign(event.deltaY)*3);this.rebuildDropdown();return;}
    if(this.globeHit(event.clientX,event.clientY)!==null){this.swallow(event);this.globe?.zoom(-event.deltaY*.001);this.sceneRevision++;this.invalidate();return;}
    const region=this.regionAt(event.clientX,event.clientY);
    if(region){
      this.swallow(event);const unit=event.deltaMode===1?18:event.deltaMode===2?this.height:1;
      if(this.pageBox?.layout==='palette')this.setHorizontalOffset(region,this.horizontalOffset(region)+(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*unit);
      else if((region==='graph'||this.pageBox?.layout==='table'&&(region==='catalogue'||region==='navigation'))&&(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))){const target=region==='navigation'?'catalogue':region;this.setHorizontalOffset(target,this.horizontalOffset(target)+(event.shiftKey?event.deltaY:event.deltaX)*unit);}
      else this.setRegionOffset(region,this.regionOffset(region)+event.deltaY*unit);
      this.hover(null);this.rebuildPage(true);this.invalidate();return;
    }
    const hit=this.hit(event.clientX,event.clientY);
    if(hit||this.frontVisible||this.page?.modal){
      this.swallow(event);if(hit&&!this.pagePieces.includes(hit.piece))return;if(this.maxScroll<=0)return;
      const delta=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*this.height:event.deltaY;
      const next=THREE.MathUtils.clamp(this.scroll+delta,0,this.maxScroll);
      if(next!==this.scroll){this.scroll=next;this.hover(null);this.rebuildPage(true);this.invalidate();}
    }
  }
  private measure=(text:string,size:number,bold=false):number=>{this.measureContext.font=this.font(size,bold);return this.measureContext.measureText(text).width;};
  private primaryRegion():NativeRegion|undefined{if(this.pageBox?.layout==='setup')return this.pageBox.regions.catalogue?'catalogue':this.pageBox.regions.details?'details':this.pageBox.regions.graph?'graph':'navigation';return this.pageBox?.layout==='storage'||this.pageBox?.layout==='architect'||this.pageBox?.layout==='world'||this.pageBox?.layout==='table'&&this.pageBox.regions.catalogue?'catalogue':this.pageBox?.layout==='research'?'details':undefined;}
  private horizontalOffset(region?:NativeRegion):number{return region==='graph'?this.graphX:region==='catalogue'&&(this.pageBox?.layout==='palette'||this.pageBox?.layout==='table')?this.paletteX:0;}
  private setHorizontalOffset(region:NativeRegion|undefined,value:number):void{const rect=region?this.pageBox?.regions[region]:undefined,next=THREE.MathUtils.clamp(value,0,Math.max(0,(rect?.contentWidth??rect?.width??0)-(rect?.width??0)));if(region==='graph')this.graphX=next;else if(region==='catalogue'&&(this.pageBox?.layout==='palette'||this.pageBox?.layout==='table'))this.paletteX=next;}
  private regionOffset(region?:NativeRegion):number{return !region||region===this.primaryRegion()||this.pageBox?.layout==='table'&&region==='navigation'?this.scroll:region==='catalogue'?this.scroll:this.regionOffsets[region];}
  private setRegionOffset(region:NativeRegion|undefined,value:number):void{
    const bounds=region?this.pageBox?.regions[region]:undefined,max=bounds?Math.max(0,bounds.contentHeight-bounds.height):this.maxScroll;
    const next=THREE.MathUtils.clamp(value,0,max);
    if(!region||region===this.primaryRegion()||region==='catalogue'||this.pageBox?.layout==='table'&&region==='navigation')this.scroll=next;else this.regionOffsets[region]=next;
  }
  private regionGroup(region?:NativeRegion):THREE.ClippingGroup{
    if(this.pageBox?.layout==='table'&&this.pageBox.regions.catalogue&&!region)return this.regionGroups.details;
    return !region||region===this.primaryRegion()||region==='catalogue'?this.pageContent:this.regionGroups[region];
  }
  private rowOffset(row:NativeRow):number{return nativeTableRowScroll(this.pageBox!,row,this.regionOffset(row.region));}
  private rowViewport(row:NativeRow):NativeRect{return this.pageBox?.tableHeader&&row.columns?this.pageBox.tableHeader:(row.region&&this.pageBox?.regions[row.region])??this.pageBox!.body;}
  private rowNameViewport(row:NativeRow):NativeRect|undefined {
    const box=this.pageBox;if(box?.layout!=='table'||row.region!=='catalogue')return;
    const name=box.regions.navigation;if(!name)return;
    return box.tableHeader&&row.columns?{...name,y:box.tableHeader.y,height:box.tableHeader.height}:name;
  }
  private focusNextControl(direction:1|-1):void{
    const page=this.page,box=this.pageBox;if(!page||!box)return;
    const logical:Array<{id:string;disabled?:boolean}>=[];
    if(page.closable!==false&&box.layout!=='palette')logical.push({id:'page:close'});
    for(const row of page.rows){if(row.input)logical.push({id:row.id});for(const control of row.controls??[])if(!control.disabled)logical.push(control);}
    for(const control of page.actions??[])if(!control.disabled)logical.push(control);
    if(!logical.length)return;
    const focused=this.pageControls.filter(hit=>!hit.control?.disabled)[this.focusIndex],current=focused?.control?.id??focused?.piece.userData.nativeId,index=logical.findIndex(control=>control.id===current);
    const next=logical[index<0?(direction===1?0:logical.length-1):(index+direction+logical.length)%logical.length]!;
    const row=box.rows.find(row=>row.row.id===next.id||row.controls.some(control=>control.control.id===next.id));
    if(row){
      const control=row.controls.find(control=>control.control.id===next.id),rect=this.rowViewport(row.row),top=box.header+(control?.y??row.top),height=control?.height??row.height,offset=this.rowOffset(row.row);
      if(top-offset<rect.y)this.setRegionOffset(row.row.region,top-rect.y-4);else if(top+height-offset>rect.y+rect.height)this.setRegionOffset(row.row.region,top+height-rect.y-rect.height+4);
      if(row.row.region==='graph'||box.layout==='palette'||box.layout==='table'&&row.row.region==='catalogue'){const left=control?.x??row.x,width=control?.width??row.width,offsetX=this.horizontalOffset(row.row.region);if(left-offsetX<rect.x)this.setHorizontalOffset(row.row.region,left-rect.x-4);else if(left+width-offsetX>rect.x+rect.width)this.setHorizontalOffset(row.row.region,left+width-rect.x-rect.width+4);}
      this.rebuildPage(true);
    }
    const list=this.pageControls.filter(hit=>!hit.control?.disabled);this.focusIndex=list.findIndex(hit=>(hit.control?.id??hit.piece.userData.nativeId)===next.id);
    if(this.focusIndex>=0)this.hover(list[this.focusIndex]!.piece);
  }
  private rowVisible(row:NativeRowBox):boolean{
    const box=this.pageBox!,region=this.rowViewport(row.row),top=box.header+row.top-this.rowOffset(row.row),left=row.x-this.horizontalOffset(row.row.region);
    return top+row.height>region.y&&top<region.y+region.height&&left+row.width>region.x&&left<region.x+region.width;
  }
  private regionAt(x:number,y:number):NativeRegion|undefined{
    const box=this.pageBox;if(!box)return;x/=this.displayScale;y/=this.displayScale;
    const heading=box.tableHeader;if(heading&&x>=box.x+heading.x&&x<=box.x+heading.x+heading.width&&y>=box.y+heading.y&&y<=box.y+heading.y+heading.height)return 'catalogue';
    for(const [key,rect]of Object.entries(box.regions))if(x>=box.x+rect.x&&x<=box.x+rect.x+rect.width&&y>=box.y+rect.y&&y<=box.y+rect.y+rect.height)return key as NativeRegion;
    return;
  }
  private drawResearchLinks(ctx:CanvasRenderingContext2D,box:NativePageBox,rng:()=>number):void{
    const graph=this.page?.research,rect=box.regions.graph;if(!graph||!rect)return;
    ctx.save();ctx.beginPath();ctx.rect(rect.x,rect.y,rect.width,rect.height);ctx.clip();
    ctx.translate(rect.x-this.graphX,rect.y-this.regionOffsets.graph);
    for(const link of graph.links){for(let i=1;i<link.path.length;i++){const a=link.path[i-1]!,b=link.path[i]!;drawMarkerLine(ctx,a.x,a.y,b.x,b.y,'#7b7259',1.5,rng);}}
    ctx.restore();
  }
  private drawScrollbars(box:NativePageBox):void{
    const primary=this.primaryRegion(),regions:Array<[NativeRegion|undefined,NativeRegionBox]>=Object.entries(box.regions).length?Object.entries(box.regions) as [NativeRegion,NativeRegionBox][]:[[undefined,{...box.body,contentHeight:box.contentHeight}]];
    if(box.inspectorParts)regions.unshift([undefined,{...box.body,contentHeight:box.contentHeight}]);
    for(const [region,rect]of regions){
      if(box.layout==='table'&&region==='navigation'&&box.regions.catalogue)continue;
      const axes:('x'|'y')[]=region==='graph'||region==='catalogue'&&box.layout==='table'?['y','x']:box.layout==='palette'?['x']:['y'];
      for(const axis of axes){
        const length=axis==='x'?rect.width:rect.height,content=axis==='x'?(rect.contentWidth??length):rect.contentHeight,max=Math.max(0,content-length);if(max<=0)continue;
        const thumb=Math.max(28,length*length/content),travel=length-thumb,offset=axis==='x'?this.horizontalOffset(region):this.regionOffset(region),primaryId=axis==='y'&&(!region||region===primary);
        const base=primaryId?'native-scroll':'native-scroll:'+region+(axis==='x'?':x':''),trackId=primaryId?'native-scrollbar':base+':track',thumbId=primaryId?'native-scroll-thumb':base+':thumb';
        const start=axis==='x'?rect.x:rect.y,cross=axis==='x'?rect.y+rect.height+4:rect.x+rect.width+4;
        const place=(id:string,isThumb:boolean)=>{
          const size=isThumb?thumb:length,position=start+(isThumb?(max?travel*offset/max:0):0)+size/2;
          const cx=axis==='x'?position:cross,cy=axis==='x'?cross:position;
          const piece=this.pagePiece(id,{w:(axis==='x'?size:8)*.01,h:(axis==='x'?8:size)*.01,paper:isThumb,uvPadding:1,textureWidth:axis==='x'?Math.ceil(size*2):16,textureHeight:axis==='x'?16:Math.ceil(size*2),depth:.012,bgColor:PALETTE.sageMountain,seed:411,interactive:true,drawFn:isThumb?()=>{}:(ctx,w,h)=>{ctx.fillStyle='rgba(68,50,29,.2)';ctx.fillRect(0,0,w,h);}},String(size),(cx-box.width/2)*.01,(box.height/2-cy)*.01,isThumb?0.12:0.1);
          piece.userData.nativeStatic=true;piece.userData.tooltip=axis==='x'?'Faire défiler horizontalement · Maj + molette':'Faire défiler · molette, cliquer ou glisser';
          piece.userData.nativeScroll={region,axis,start:(axis==='x'?box.x:box.y)+start,travel,max,thumb,isThumb};this.pageGroup.add(piece);
        };place(trackId,false);place(thumbId,true);
      }
    }
  }
  private rowHint(row:NativeRow):string{return row.hint??[row.label,row.value,row.detail,row.meter?.label,row.meter?.secondary?.label].filter(Boolean).join('\n');}
  private controlInk(control:NativeControl):unknown{
    const {hint:_hint,select,...ink}=control;
    return {...ink,select:select?{...select,options:select.options.map(({hint:_optionHint,...option})=>option)}:undefined};
  }
  private rowInk(row:NativeRow):unknown{
    const {hint:_hint,controls,columns,...ink}=row;
    // Empty hints have no input plane. Preserve that structural distinction
    // while excluding the text that only appears in a native tooltip.
    return [{...ink,controls:controls?.map(control=>this.controlInk(control)),columns:columns?.map(({hint:_columnHint,...column})=>column)},!!this.rowHint(row)];
  }
  private pageInkSignature(page:NativePage|null):string{
    return page?JSON.stringify([page.id,page.contentKey,page.title,page.subtitle,page.width,page.height,page.layout,page.tableProfile,page.setupCatalogueWidth,page.setupAnchor,page.palette,page.research,page.columnRatio,page.portrait?.url,page.visual?.selected,page.visual?.markers,page.rows.map(row=>this.rowInk(row)),page.actions?.map(control=>this.controlInk(control)),page.closable,this.textFontRevision,this.textEntityRevision,this.frontVisible,this.width,this.height,this.displayScale,this.bottomDockHeight,this.scroll,this.regionOffsets,this.graphX,this.paletteX]):'';
  }
  private rebuildPage(force=false):void{
    const page=this.page;
    const entities=page?.textEntities??this.sharedTextEntities;
    if(entities!==this.inkTextEntities){this.inkTextEntities=entities;this.textEntityRevision++;this.semanticInk.clear();}
    this.textLexicon=createNativeTextLexicon(entities);
    const signature=this.pageInkSignature(page);
    if(!force&&signature===this.pageSignature){this.rebindPage(page);return;}
    const focused=this.pageControls.filter(hit=>!hit.control?.disabled)[this.focusIndex],focusedId=focused?focused.control?.id??String(focused.piece.userData.nativeId):undefined;
    this.pageSignature=signature;this.pagePieceIds=new Set();this.pagePieces.length=0;this.pageControls=[];this.pageBackdrop=undefined;
    if(this.globe&&this.globe.visible!==!!page?.visual){this.globe.visible=!!page?.visual;this.sceneRevision++;}
    if(!page){this.pageBox=undefined;this.retirePagePieces();this.focusIndex=-1;if(this.options.onWindowLayout?.(null))this.sceneRevision++;return;}
    this.stats.rebuilds++;
    const viewport={width:this.width,height:this.height-(this.frontVisible?0:Math.max(0,this.bottomDockHeight-NATIVE_UI.bottom))};
    const measure=(text:string,size:number,bold?:boolean)=>this.measure(text,size,bold??true);
    let box=layoutNativePage(page,viewport,this.frontVisible,measure);
    // Preserve the direct time/view controls beside near-fullscreen windows.
    // Shorter windows can keep their requested width and move the entire dock
    // above them. At very large scales the HUD owner handles lack of room as
    // one whole group, never as fragments of individual cards.
    if(!this.frontVisible&&this.options.onWindowLayout&&box.layout!=='palette'&&this.width>=720&&box.x+box.width>this.width-NATIVE_RIGHT_DOCK_WIDTH&&box.y<118+197+10)
      box=layoutNativePage(page,{...viewport,width:this.width-NATIVE_RIGHT_DOCK_WIDTH},false,measure);
    this.pageBox=box;if(this.options.onWindowLayout?.(this.frontVisible||box.layout==='palette'?null:box))this.sceneRevision++;
    if(box.layout==='palette'){const index=page.palette==='orders'?0:1,piece=this.toolsDock.children[index] as CardboardPiece;box.y=this.height-8-piece.userData.basePos.y*100-box.height/2;}
    const k=.01,w=box.width*k,h=box.height*k,margin=12;
    const z=.18,factor=1-z/HUD_DISTANCE;
    this.pageGroup.scale.setScalar(this.uiScale*factor);
    this.pageGroup.position.set((box.x+box.width/2-this.width/2)*this.visH/this.height*factor,(this.height/2-box.y-box.height/2)*this.visH/this.height*factor,z);
    this.maxScroll=Math.max(0,box.contentHeight-box.body.height);this.scroll=THREE.MathUtils.clamp(this.scroll,0,this.maxScroll);
    for(const [key,rect]of Object.entries(box.regions)){
      const region=key as NativeRegion;if(region==='graph'||box.layout==='palette'||region==='catalogue'&&box.layout==='table')this.setHorizontalOffset(region,this.horizontalOffset(region));
      this.setRegionOffset(region,this.regionOffset(region));
    }
    const visible=box.rows.filter(r=>this.rowVisible(r)),sheet=box.inspectorParts?.sheet??{x:0,y:0,width:box.width,height:box.height};
    if(box.layout!=='palette'){
    const background=this.pagePiece('page:'+page.id,{w,h:sheet.height*k,cacheBackground:true,surface:'panel',uvPadding:1,bevel:.038,textureWidth:Math.ceil(box.width*2),textureHeight:Math.ceil(sheet.height*2),bgColor:'#f1e7cf',seed:2003,depth:.046,interactive:true,
      drawFn:(ctx,wp,hp,rng)=>{
        ctx.save();ctx.scale(wp/box.width,hp/sheet.height);ctx.textAlign='left';ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font(17,true);
        const title=box.inspectorParts?page.rows.find(row=>row.id==='pawn-tabs')?.controls?.find(control=>control.active)?.label??page.title:page.title;
        ctx.fillText(title,margin,27,box.width-margin*2-(page.portrait&&!box.inspectorParts&&!box.portraitRect?74:28));
        drawMarkerLine(ctx,margin,35,Math.min(box.width-48,margin+this.measure(title,17,true)+22),35,'#b58b4a',1.3,rng);
        if(page.subtitle&&!box.inspectorParts){ctx.font=this.font(13);ctx.fillStyle='#66583f';wrapNativeText(page.subtitle,box.width-margin*2-(page.portrait&&!box.portraitRect?62:0),this.measure,13).slice(0,2).forEach((line,index)=>ctx.fillText(line,margin,55+index*17));}
        for(const r of visible){if(r.row.graphNode)continue;const top=box.header+r.top-this.rowOffset(r.row),nameBand=this.rowNameViewport(r.row);
          if(nameBand){ctx.save();ctx.beginPath();ctx.rect(nameBand.x,nameBand.y,nameBand.width,nameBand.height);ctx.clip();this.drawMatrixName(ctx,r,top);ctx.restore();}
          const region=this.rowViewport(r.row);ctx.save();ctx.beginPath();ctx.rect(region.x,region.y,region.width,region.height);ctx.clip();ctx.translate(-this.horizontalOffset(r.row.region),0);this.drawPageRow(ctx,r,top,rng,box);ctx.restore();}
        this.drawResearchLinks(ctx,box,rng);
        if(box.layout==='architect'||box.layout==='research'){ctx.strokeStyle='rgba(82,62,39,.25)';ctx.lineWidth=1;for(const rect of Object.values(box.regions)){if(rect.x<=12)continue;ctx.beginPath();ctx.moveTo(rect.x-7,rect.y);ctx.lineTo(rect.x-7,rect.y+rect.height);ctx.stroke();}}
        ctx.restore();
      }},signature,0,(box.height-sheet.height)*k/2,0);
    background.userData.nativeStatic=true;this.pageBackdrop=background;this.pageGroup.add(background);
    if(page.closable!==false)this.control(this.closeControl(),w/2-.25,h/2-.23,.32,.32,.07);
    }
    this.pageGroup.updateMatrixWorld(true);
    const local=(x:number,y:number)=>new THREE.Vector3((x-box.width/2)*k,(box.height/2-y)*k,0).applyMatrix4(this.pageGroup.matrixWorld);
    const clip=(group:THREE.ClippingGroup,rect:NativeRect)=>{const tl=local(rect.x,rect.y),br=local(rect.x+rect.width,rect.y+rect.height);group.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),-tl.x),new THREE.Plane(new THREE.Vector3(-1,0,0),br.x),new THREE.Plane(new THREE.Vector3(0,-1,0),tl.y),new THREE.Plane(new THREE.Vector3(0,1,0),-br.y)];};
    this.pageFooter.visible=box.layout==='storage';
    if(this.pageFooter.visible)clip(this.pageFooter,{x:0,y:box.height-box.footer,width:box.width,height:box.footer});
    this.tableHeaderContent.visible=!!box.tableHeader;
    if(box.tableHeader)clip(this.tableHeaderContent,box.tableHeader);
    clip(this.pageContent,box.layout==='table'?box.regions.catalogue??box.body:box.body);for(const [key,group]of Object.entries(this.regionGroups))clip(group,box.regions[key as NativeRegion]??box.body);
    for(const r of visible){
      const row=r.row,offset=this.rowOffset(row),group=box.tableHeader&&row.columns?this.tableHeaderContent:this.regionGroup(row.region),top=box.header+r.top-offset,cy=top+r.height/2;
      const hint=this.rowHint(row);
      if(hint&&!row.graphNode){
        const nameBand=box.layout==='table'&&row.region==='catalogue'?box.regions.navigation:undefined,width=nameBand?.width??r.width,left=nameBand?.x??r.x-this.horizontalOffset(row.region);
        const piece=this.pagePiece('row-hint:'+row.id,{w:width*k,h:r.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},hint,(left+width/2-box.width/2)*k,(box.height/2-cy)*k,.025);
        piece.userData.tooltip=hint;piece.userData.nativeStatic=true;(nameBand?this.regionGroups.navigation:group).add(piece);
      }
      if(row.columns){
        const columns=nativeMatrixColumns(row,r.x,r.width,row.columns.length,r.matrixTail,box.matrixColumnWeights);
        row.columns.forEach((column,index)=>{const cell=columns[index]!,hintPiece=this.pagePiece('column:'+row.id+':'+index,{w:cell.width*k,h:r.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},column.hint??column.label,(cell.x-this.horizontalOffset(row.region)+cell.width/2-box.width/2)*k,(box.height/2-cy)*k,.04);hintPiece.userData.nativeStatic=true;hintPiece.userData.tooltip=column.hint??column.label;group.add(hintPiece);});
      }
      const controls=row.controls??[];
      let graphCard:CardboardPiece|undefined;const graphInset=r.controls.find(control=>control.style==='icon'),graphMain=r.controls.find(control=>control.style==='research'||control.style==='card');
      for(const cb of r.controls){
        const region=this.rowViewport(row),left=cb.x-this.horizontalOffset(row.region),ct=box.header+cb.y-offset;
        if(left+cb.width<=region.x||left>=region.x+region.width||ct+cb.height<=region.y||ct>=region.y+region.height)continue;
        if(cb.style==='icon'&&graphCard&&graphMain){
          const hit:Hit={piece:graphCard,control:cb.control,region:{x:(cb.x-graphMain.x-graphMain.width/2)*k,y:(graphMain.y+graphMain.height/2-cb.y-cb.height)*k,width:cb.width*k,height:cb.height*k}};
          this.insetControls.set(graphCard,[hit]);this.pageControls.push(hit);continue;
        }
        const piece=this.control(this.rowControl(row,cb.control),(left+cb.width/2-box.width/2)*k,(box.height/2-ct-cb.height/2)*k,cb.width*k,cb.height*k,.065,cb.style,cb.style==='research'?row.graphNode:undefined,cb.style==='research'||cb.style==='card'?graphInset?.control:undefined);
        if(cb.style==='research'||cb.style==='card'){graphCard=piece;this.insetControls.delete(piece);}
        piece.userData.nativeRegion=row.region;group.add(piece);
      }
      if(row.input){
        const rightControls=controls.length?controls.length*28+6:0,inputW=Math.max(70,r.width-r.labelWidth-rightControls-8);
        const piece=this.pagePiece(row.id,{w:inputW*k,h:.25,uvPadding:1,textureWidth:Math.ceil(inputW*2),textureHeight:50,bgColor:'#fff9eb',seed:3007,depth:.018,interactive:true,
          drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/inputW,hp/25);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='left';ctx.font=this.font(13);ctx.fillText(row.input!.value||row.input!.placeholder||'',7,17,inputW-14);ctx.restore();}},JSON.stringify([row.input.value,row.input.placeholder,this.textFontRevision]),(r.x+r.labelWidth+8+inputW/2-box.width/2)*k,(box.height/2-top-15)*k,.08,undefined,row.input);
        group.add(piece);
      }
    }
    this.drawScrollbars(box);
    for(const action of box.actions){const piece=this.control(action.control,(action.x+action.width/2-box.width/2)*k,(box.height/2-box.header-action.y-action.height/2)*k,action.width*k,action.height*k,.09,action.style);if(box.layout==='storage')this.pageFooter.add(piece);}
    if(page.visual){
      this.globe??=new NativeGlobe(tile=>{try{this.options.onActivate?.('world:select-tile');this.page?.visual?.onSelect(tile);}catch(error){this.options.onError(String(error));}});
      this.pageGroup.add(this.globe);this.globe.visible=true;const visualWidth=nativeVisualWidth(page,box.width);
      const globeRect=box.visualRect??{x:12,y:box.header,width:visualWidth,height:box.body.height};
      this.globe.position.set((-box.width/2+globeRect.x+globeRect.width/2)*k,(box.height/2-globeRect.y-globeRect.height/2)*k,.35);
      this.globe.scale.setScalar(Math.min(globeRect.width*.44,globeRect.height*.43)*k);
      this.globe.setSurface(page.visual.surface,page.visual.roads);this.globe.setSelected(page.visual.selected);this.globe.setMarkers((page.visual.markers??[]).map(marker=>({...marker,label:marker.label??('Case '+marker.tile)})));this.sceneRevision++;
    }
    if(page.portrait){
      const summary=box.inspectorParts?.summary;
      if(summary){
        const activity=page.rows.find(row=>row.id==='pawn-action')?.value??'',identity=page.rows.find(row=>row.id==='pawn-identity')?.value??'';
        const stripWidth=box.width-summary.x*2,textTop=(summary.height-74)/2;
        this.pagePiece('page:summary',{w:stripWidth*k,h:summary.height*k,uvPadding:1,depth:.046,bevel:.038,surface:'panel',bgColor:PALETTE.creamPaper,seed:2080,cacheBackground:true,textureWidth:Math.ceil(stripWidth*2),textureHeight:Math.ceil(summary.height*2),drawFn:(ctx,wp,hp)=>{
          ctx.save();ctx.scale(wp/stripWidth,hp/summary.height);ctx.textAlign='left';ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font(15,true);ctx.fillText(page.title,94,textTop+15,summary.width-106);ctx.font=this.font(12.5);this.wrap(ctx,identity,94,textTop+35,summary.width-106,17,2);this.wrap(ctx,activity,94,textTop+69,summary.width-106,17,2);ctx.restore();
        }},JSON.stringify([page.title,activity,identity,this.textFontRevision]),(summary.x+stripWidth/2-box.width/2)*k,(box.height/2-summary.y-summary.height/2)*k,.025);
      }
      const source=page.portrait.url;let image=this.portraitImages.get(source);
      if(!image){image=new Image();this.portraitImages.set(source,image);image.onload=()=>{if(!this.closed&&this.page?.portrait?.url===source){this.rebuildPage(true);this.invalidate();}};image.src=source;}
      if(image.complete&&image.naturalWidth){const portrait=image,rect=box.portraitRect;const piece=this.pagePiece('page:portrait',{w:rect?rect.width*k:summary ? .74 : .43,h:rect?rect.height*k:summary ? .82 : .47,depth:.018,bgColor:PALETTE.kraftBase,seed:2081,drawFn:(ctx,wp,hp)=>ctx.drawImage(portrait,0,0,wp,hp)},source,rect?(rect.x+rect.width/2-box.width/2)*k:summary?(summary.x+47-box.width/2)*k:w/2-.7,rect?(box.height/2-rect.y+this.regionOffset('details')-rect.height/2)*k:summary?(box.height/2-summary.y-summary.height/2)*k:h/2-.32,.07);if(rect)this.regionGroup('details').add(piece);}
      if(this.portraitImages.size>24)for(const [url,old]of this.portraitImages){if(url===source)continue;old.onload=null;old.onerror=null;this.portraitImages.delete(url);if(this.portraitImages.size<=16)break;}
    }
    this.retirePagePieces();this.focusIndex=focusedId===undefined?-1:this.pageControls.filter(hit=>!hit.control?.disabled).findIndex(hit=>(hit.control?.id??String(hit.piece.userData.nativeId))===focusedId);
    if(this.editingPaintDirty){this.editingPaintDirty=false;this.editRepaint?.();}
    this.rebindPage(page);
    this.scene.updateMatrixWorld(true);
  }
  private drawMatrixName(ctx:CanvasRenderingContext2D,r:NativeRowBox,top:number):void{
    if(r.row.columns){ctx.fillStyle='#4d5c46';ctx.font=this.font(13,true);ctx.textAlign='left';ctx.fillText(r.row.label,r.x,top+28,98);}
    else if(r.matrix)this.semanticText(ctx,r.row.label,r.x,top+r.height/2+4,98,NATIVE_UI.body,true);
  }
  private drawPageRow(ctx:CanvasRenderingContext2D,r:NativeRowBox,top:number,rng:()=>number,box:NativePageBox):void{
    const row=r.row,ink=PALETTE.inkDark,body=NATIVE_UI.body,line=NATIVE_UI.line;ctx.fillStyle=ink;ctx.textAlign='left';
    if(row.tree){
      const left=r.x+Math.max(0,row.tree.depth)*17+28;
      ctx.fillStyle=row.controls?.every(control=>control.disabled)?'#7a705f':ink;
      this.semanticText(ctx,r.labelLines[0]??row.label,left,top+18,r.labelWidth,14,row.tree.depth===0);
      return;
    }
    const record=row.presentation==='record'||!!row.controls?.length&&!!row.label&&!row.meter&&!row.columns&&!r.matrix;
    if(record||row.presentation==='summary'){
      const summary=row.presentation==='summary';drawHandRect(ctx,r.x-4,top+2,r.width+6,r.height-7,summary?'rgba(217,153,62,.12)':'rgba(255,251,235,.38)','rgba(122,95,58,.28)',.75,rng);
      ctx.fillStyle=summary?'#bd8b45':'#92a287';ctx.fillRect(r.x-3,top+8,2,Math.max(10,r.height-20));
    }
    if(row.columns){
      if(!(box.layout==='table'&&box.regions.navigation&&row.region==='catalogue'))this.drawMatrixName(ctx,r,top);
      const tail=r.matrixTail?192:0,columns=nativeMatrixColumns(row,r.x,r.width,row.columns.length,r.matrixTail,box.matrixColumnWeights);
      row.columns.forEach((column,index)=>{const cell=columns[index]!,lines=nativeMatrixHeadingLines(column.label,cell.width-5,this.measure).slice(0,2);ctx.textAlign='center';ctx.font=this.font(12,true);lines.forEach((line,lineIndex)=>ctx.fillText(line,cell.x+cell.width/2,top+28+(lineIndex-(lines.length-1)/2)*15,cell.width-4));});
      if(row.value)this.semanticText(ctx,row.value,r.x+r.width-tail+6,top+28,tail-10,12);return;
    }
    if(r.matrix){if(!(box.layout==='table'&&box.regions.navigation&&row.region==='catalogue'))this.drawMatrixName(ctx,r,top);if(row.value){const lines=wrapNativeText(row.value,176,this.measure,13);lines.slice(0,2).forEach((line,i)=>this.semanticText(ctx,line,r.x+r.width-180,top+18+i*17,176,13));}return;}
    if(row.id==='pawn-tabs'||row.id==='health-tabs')return;
    if(row.meter){
      const meter=row.meter,labelWidth=Math.min(r.width*.45,138),barX=r.x+labelWidth,barW=Math.max(40,r.width-labelWidth-8),fraction=THREE.MathUtils.clamp(meter.value/(meter.max??1),0,1);
      this.semanticText(ctx,row.label,r.x,top+18,labelWidth-5,body);
      if(meter.passion){ctx.fillStyle='#b45c29';ctx.font=this.font(10,true);ctx.fillText('♥'.repeat(meter.passion),r.x+labelWidth-24,top+24);}
      drawHandRect(ctx,barX,top+6,barW,16,'#e5d4b2','#51402c',1,rng);
      if(fraction>0)drawHandRect(ctx,barX+.8,top+6.8,Math.max(.5,(barW-1.6)*fraction),14.4,meter.color??'#63885d',null,.5,rng);
      ctx.fillStyle=ink;ctx.font=this.font(12,true);ctx.textAlign='center';ctx.strokeStyle='#f8edda';ctx.lineWidth=2;ctx.strokeText(meter.label??row.value??'',barX+barW/2,top+19,barW-4);ctx.fillText(meter.label??row.value??'',barX+barW/2,top+19,barW-4);ctx.textAlign='left';
      if(meter.secondary){const secondary=meter.secondary;ctx.fillStyle='#d2bea0';ctx.fillRect(barX,top+25,barW,4);ctx.fillStyle=secondary.color??'#987743';ctx.fillRect(barX,top+25,barW*THREE.MathUtils.clamp(secondary.value/(secondary.max??1),0,1),4);}
      return;
    }
    const baseline=top+(record?21:18),labelWidth=row.value||row.input?r.labelWidth-5:r.textWidth;
    if(row.label)r.labelLines.forEach((text,i)=>this.semanticText(ctx,text,r.x+3,baseline+i*line,labelWidth-3,body,row.emphasis==='heading'||row.presentation==='summary'||record&&!!row.value));
    if(row.value)r.valueLines.forEach((text,i)=>this.semanticText(ctx,text,r.x+r.labelWidth+6,baseline+i*line,r.textWidth-r.labelWidth-8,body));
    if(r.detailLines.length){const y=baseline+Math.max(r.labelLines.length,r.valueLines.length,1)*line+2;r.detailLines.forEach((text,i)=>this.semanticText(ctx,text,r.x+3,y+i*18,r.textWidth-5,12));}
    if(row.emphasis==='heading'){ctx.strokeStyle='rgba(103,76,38,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r.x,top+r.height-4);ctx.lineTo(r.x+r.width,top+r.height-4);ctx.stroke();}
  }
  private semanticText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,bold=false):void{
    if(!text||width<=0)return;let spans=this.semanticInk.get(text);
    if(!spans){spans=tokenizeNativeText(text,this.textLexicon);if(this.semanticInk.size>=1024)this.semanticInk.delete(this.semanticInk.keys().next().value!);this.semanticInk.set(text,spans);}
    const measured=spans.reduce((sum,span)=>sum+this.measure(span.text,size,bold||NATIVE_TEXT_STYLES[span.kind].bold),0);
    ctx.save();ctx.textAlign='left';ctx.translate(x,y);ctx.scale(Math.min(1,width/Math.max(1,measured)),1);let offset=0;
    for(const span of spans){const style=NATIVE_TEXT_STYLES[span.kind];ctx.font=this.font(size,bold||style.bold);ctx.fillStyle=style.color;ctx.fillText(span.text,offset,0);offset+=this.measure(span.text,size,bold||style.bold);}
    ctx.restore();
  }
  private wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number,maxLines=20):number{
    const words=text.split(/\s+/);let line='',lines=0;
    for(const word of words){const next=line?`${line} ${word}`:word;
      if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y,width);y+=lineHeight;line=word;if(++lines>=maxLines)return lines;}else line=next;}
    if(line&&lines<maxLines){ctx.fillText(line,x,y,width);lines++;}return lines;
  }
  private control(control:NativeControl,x:number,y:number,w:number,h:number,z:number,style:NativeControlStyle=control.presentation??'button',node?:NativeRow['graphNode'],inset?:NativeControl):CardboardPiece{
    const cssW=w*100,cssH=h*100,workCell=/^work-\d+-/.test(control.id)&&!!control.select;
    const draw:CardboardDraw=(ctx,wp,hp,rng)=>{
      ctx.save();ctx.scale(wp/cssW,hp/cssH);ctx.fillStyle=control.disabled?'#8b7b60':PALETTE.inkDark;ctx.textAlign='center';
      const ink=control.disabled?'#776c55':PALETTE.inkDark;
      const icon=(cx:number,cy:number,r:number)=>drawNativeActionIcon(ctx,control.icon??(control.label==='▶'?'play':control.id),cx,cy,r,ink,PALETTE.creamPaper);
      if(control.glyph){
        const cx=cssW/2,cy=cssH/2;
        if(control.glyph==='expand'||control.glyph==='collapse'){
          ctx.fillStyle=ink;ctx.beginPath();
          if(control.glyph==='collapse'){ctx.moveTo(cx-5,cy-3);ctx.lineTo(cx+5,cy-3);ctx.lineTo(cx,cy+4);}
          else{ctx.moveTo(cx-3,cy-5);ctx.lineTo(cx+4,cy);ctx.lineTo(cx-3,cy+5);}
          ctx.closePath();ctx.fill();
        }else{
          drawHandRect(ctx,cx-8,cy-8,16,16,PALETTE.creamPaper,ink,1,rng);
          ctx.strokeStyle=control.disabled?ink:control.glyph==='allow'?PALETTE.pineDark:control.glyph==='forbid'?PALETTE.terracotta:PALETTE.ochre;
          ctx.lineWidth=2.4;ctx.lineCap='round';ctx.beginPath();
          if(control.glyph==='allow'){ctx.moveTo(cx-5,cy);ctx.lineTo(cx-1,cy+4);ctx.lineTo(cx+6,cy-5);}
          else if(control.glyph==='forbid'){ctx.moveTo(cx-4,cy-4);ctx.lineTo(cx+4,cy+4);ctx.moveTo(cx+4,cy-4);ctx.lineTo(cx-4,cy+4);}
          else{ctx.moveTo(cx-5,cy);ctx.lineTo(cx+5,cy);}
          ctx.stroke();
        }
      }else if(style==='tile'||style==='navigation'){
        const radius=Math.min(23,cssW*.24,cssH*.24),cy=cssH*.34;drawHandBlob(ctx,cssW/2,cy,radius+5,PALETTE.creamPaper,ink,1.8,rng);icon(cssW/2,cy,radius*.77);
        const lines=wrapNativeText(control.label,cssW-13,this.measure,13).slice(0,2),bandHeight=lines.length>1?31:24,bandY=cssH-bandHeight-4;
        ctx.save();ctx.translate(cssW/2,bandY+bandHeight/2);ctx.rotate(this.seed(control.id)%2?.024:-.024);drawHandRect(ctx,-cssW*.46,-bandHeight/2,cssW*.92,bandHeight,PALETTE.creamPaper,ink,1.1,rng);ctx.font=this.font(13,true);lines.forEach((line,index)=>ctx.fillText(line,0,4+(index-(lines.length-1)/2)*14,cssW-13));ctx.restore();
        if(control.caption){ctx.font=this.font(10,true);ctx.textAlign='right';ctx.fillText(control.caption,cssW-7,14,cssW-12);}
      }else if(style==='card'){
        ctx.textAlign='left';const cardInk=nativeCardInk(control,cssW,this.measure,!!inset);let baseline=30;
        const paint=(lines:string[],size:number,bold:boolean)=>{ctx.font=this.font(size,bold);for(const line of lines){ctx.fillText(line,18,baseline);baseline+=bold?20:19;}};
        paint(cardInk.title,15,true);if(cardInk.caption.length){baseline+=4;paint(cardInk.caption,13,false);}if(cardInk.description.length){baseline+=4;ctx.fillStyle='#625139';paint(cardInk.description,13,false);}
        if(inset){drawHandRect(ctx,cssW-54,14,38,38,PALETTE.creamPaper,ink,1.2,rng);drawNativeActionIcon(ctx,inset.icon??inset.id,cssW-35,33,12,inset.disabled?'#8b7b60':ink,PALETTE.creamPaper);}
      }else if(style==='icon'){
        icon(cssW/2,cssH/2,Math.min(cssW,cssH)*.35);
      }else if(style==='research'&&node){
        icon(18,22,11);ctx.textAlign='left';ctx.font=this.font(12,true);wrapNativeText(control.label,cssW-42,this.measure,12).slice(0,2).forEach((line,index)=>ctx.fillText(line,36,19+index*15,cssW-42));
        const barWidth=cssW-38,filled=barWidth*THREE.MathUtils.clamp(node.points/Math.max(1,node.cost),0,1);
        drawHandRect(ctx,8,cssH-16,barWidth,9,'#ae9675',ink,1,rng);if(filled>0){ctx.fillStyle=node.state==='done'?'#8fa66c':node.state==='active'?'#d3a548':'#829baa';ctx.fillRect(9,cssH-15,Math.max(0,filled-2),7);}
        ctx.fillStyle=ink;ctx.font=this.font(9,true);ctx.textAlign='center';ctx.fillText(`${Math.round(node.points)}/${node.cost}`,8+barWidth/2,cssH-8,barWidth-4);
        if(inset){drawHandRect(ctx,118,40,22,19,inset.disabled?PALETTE.kraftLight:PALETTE.sageMountain,ink,1,rng);drawNativeActionIcon(ctx,'play',129,49.5,6.5,inset.disabled?'#776c55':ink,PALETTE.creamPaper);}
      }else{
        const inlineIcon=!!control.icon&&cssH>=28;if(inlineIcon)icon(17,cssH/2,10);
        const available=cssW-(control.select?24:12)-(inlineIcon?26:0),font=control.id==='page:close'?20:control.label.length<=1&&cssW<=48?17:14;
        ctx.font=this.font(font,true);let label=control.label;
        if(cssH>=39&&!control.caption){const lines=wrapNativeText(label,available,this.measure,font).slice(0,2);lines.forEach((line,index)=>ctx.fillText(line,cssW/2+(inlineIcon?12:0)-(control.select?4:0),cssH/2+4+(index-(lines.length-1)/2)*15,available));}
        else{
        while(label.length>1&&this.measure(label,font,true)>available)label=label.slice(0,-1);
        if(label!==control.label)label=label.trimEnd()+'…';
        if(workCell)ctx.font=this.font(17,true);
        ctx.fillText(label,cssW/2+(inlineIcon?12:0)-(control.select&&!workCell?4:0),control.caption?workCell?cssH*.43:14:cssH/2+4,available);
        }
        if(control.caption){ctx.font=this.font(workCell?12:11,workCell);ctx.fillStyle=workCell?'#392b20':'#5b5b42';ctx.fillText(control.caption,cssW/2,cssH-5,cssW-6);}
      }
      if(control.select){const cy=workCell?10:cssH/2;ctx.fillStyle=PALETTE.inkDark;ctx.beginPath();ctx.moveTo(cssW-12,cy-2);ctx.lineTo(cssW-5,cy-2);ctx.lineTo(cssW-8.5,cy+3);ctx.closePath();ctx.fill();}
      if(control.active&&!control.glyph)drawMarkerLine(ctx,5,cssH-3,cssW-5,cssH-3,PALETTE.inkDark,1,rng);
      ctx.restore();
    };
    const piece=this.pagePiece(control.id,{w,h,depth:.046,bevel:.038,uvPadding:1,textureWidth:Math.max(32,Math.ceil(cssW*2)),textureHeight:Math.max(32,Math.ceil(cssH*2)),bgColor:control.glyph?PALETTE.creamPaper:control.disabled?PALETTE.kraftLight:control.active?PALETTE.ochre:control.color??PALETTE.sageMountain,seed:this.seed(control.id),interactive:true,drawFn:draw},
      JSON.stringify([control.label,control.caption,control.description,control.icon,control.glyph,control.color,style,node,inset?.icon,!!inset?.disabled,!!control.active,!!control.disabled,!!control.select,this.textFontRevision]),x,y,z,control);
    piece.userData.nativeStyle=style;piece.userData.active=!!control.active;
    piece.userData.nativeMapToolPose=this.page?.layout==='palette'&&style==='icon';piece.userData.nativeMapToolTitle=control.label;
    piece.userData.nativeToolbarPose=style==='tile'||style==='navigation'||style==='tab';this.setPose(piece,piece.userData.hoverVal);
    this.pageGroup.add(piece);return piece;
  }
  private closeControl():NativeControl{return {id:'page:close',label:'×',hint:'Fermer · Échap',color:'#d7ad91',onActivate:()=>{if(this.page?.onClose)this.page.onClose();else this.options.onEscape();}};}
  private rowControl(row:NativeRow,control:NativeControl):NativeControl{
    if(control.presentation==='card'&&!control.hint)control={...control,hint:[control.label,control.caption,control.description].filter(Boolean).join('\n')};
    return row.compact&&row.value?{...control,hint:[row.value,control.hint??control.label].filter(Boolean).join(' · ')}:control;
  }
  private rebindPage(page:NativePage|null):void{
    if(!page)return;
    const controls=new Map<string,NativeControl>(),inputs=new Map<string,NonNullable<NativeRow['input']>>(),hints=new Map<string,string>();
    for(const row of page.rows){
      for(const control of row.controls??[])controls.set(control.id,this.rowControl(row,control));if(row.input)inputs.set(row.id,row.input);
      hints.set('row-hint:'+row.id,this.rowHint(row));
      row.columns?.forEach((column,index)=>hints.set('column:'+row.id+':'+index,column.hint??column.label));
    }
    for(const control of page.actions??[])controls.set(control.id,control);
    controls.set('page:close',this.closeControl());
    for(const record of this.retainedPagePieces.values()){
      const id=String(record.piece.userData.nativeId);
      const control=controls.get(id),input=inputs.get(id);
      record.hit.control=control;record.hit.input=input;
      const hint=control?.hint??control?.label??hints.get(id)??record.piece.userData.tooltip??'';
      if(this.hintOwner===record.piece&&record.piece.userData.tooltip!==hint)this.clearHint();
      record.piece.userData.tooltip=hint;record.piece.userData.nativeDisabled=!!control?.disabled;
      if(this.editing===record.hit&&input&&this.editor)this.editor.maxLength=input.maxLength??2048;
    }
    for(const hit of this.pageControls)if(hit.region&&hit.control){const control=controls.get(hit.control.id);if(control){if(this.hintOwner===hit.piece&&control.hint!==hit.control.hint)this.clearHint();hit.control=control;}}
    const dropdown=this.dropdown;
    if(dropdown){
      const owner=controls.get(dropdown.controlId),select=owner?.select;
      if(page.id!==dropdown.pageId||owner?.disabled||!select){this.closeDropdown();return;}
      const options=new Map(select.options.map(option=>['select-option:'+dropdown.controlId+':'+option.value,option]));
      for(const piece of dropdown.pieces){
        const option=options.get(String(piece.userData.nativeId));if(!option)continue;
        const hint=option.hint??option.label,hit=this.hits.get(piece.userData.mesh);
        if(this.hintOwner===piece&&piece.userData.tooltip!==hint)this.clearHint();
        piece.userData.tooltip=hint;
        if(hit?.control)hit.control.hint=hint;
      }
    }
  }
  private pagePiece(id:string,options:CardboardPieceOptions,ink:string,x:number,y:number,z:number,control?:NativeControl,input?:NativeRow['input']):CardboardPiece{
    this.pagePieceIds.add(id);
    const geometry=JSON.stringify([options.w,options.h,options.depth??.044,options.bevel??.026,options.seed??1,!!options.interactive,options.paper,options.hitOnly,options.cacheBackground,options.textureWidth,options.textureHeight,options.uvPadding]);
    const paint=JSON.stringify([options.bgColor??PALETTE.kraftBase,options.surface,ink]);
    let record=this.retainedPagePieces.get(id),created=false;
    const old=record,wasEditing=!!record&&this.editing===record.hit;
    const interaction=record?{hoverTarget:record.piece.userData.hoverTarget,hoverVal:record.piece.userData.hoverVal,pressVal:record.piece.userData.pressVal,hovered:this.hovered===record.piece,moving:this.moving.has(record.piece),pressed:this.down?.piece===record.piece}:undefined;
    if(record&&record.geometry!==geometry){this.unregister(record.piece);this.retainedPagePieces.delete(id);record=undefined;}
    if(!record){
      const piece=this.art.createPiece(options);piece.userData.nativeId=id;
      record={piece,hit:this.register(piece,control,input),geometry,paint};created=true;
      this.retainedPagePieces.set(id,record);this.pageGroup.add(piece);
      if(interaction){piece.userData.hoverTarget=interaction.hoverTarget;piece.userData.hoverVal=interaction.hoverVal;piece.userData.pressVal=interaction.pressVal;if(interaction.hovered)this.hovered=piece;if(interaction.moving)this.moving.add(piece);if(interaction.pressed&&this.down)this.down.piece=piece;}
      if(wasEditing&&old){this.editing=record.hit;this.editingPaintDirty=true;}
    }
    const {piece,hit}=record;
    hit.control=control;hit.input=input;
    if(created&&interaction?.hovered)this.hoverPreview.set(control?.onHover);
    const hint=control?.hint??control?.label??'';
    if(this.hintOwner===piece&&piece.userData.tooltip!==hint)this.clearHint();
    piece.userData.tooltip=hint;piece.userData.nativeDisabled=!!control?.disabled;
    const editing=this.editing===hit;
    if(!created&&record.paint!==paint&&!editing)piece.redraw(options.drawFn,options.bgColor);
    if(!editing)piece.userData.drawFn=options.drawFn;
    record.paint=editing?'':paint;
    if(created||piece.userData.basePos.x!==x||piece.userData.basePos.y!==y||piece.userData.basePos.z!==z){piece.setBaseTransform(x,y,z);this.setPose(piece,piece.userData.hoverVal);}
    this.pagePieces.push(piece);if(control||input)this.pageControls.push(hit);
    return piece;
  }
  private retirePagePieces():void{
    for(const [id,record]of this.retainedPagePieces)if(!this.pagePieceIds.has(id)){
      if(this.editing===record.hit)this.finishEdit(false,false);
      this.unregister(record.piece);this.retainedPagePieces.delete(id);
    }
  }
  private seed(text:string):number{let value=17;for(const c of text)value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;return value;}
  private clearHint():void{
    clearTimeout(this.hintTimer);this.hintTimer=undefined;this.hintOwner=null;this.hintText='';
    this.hintScroll=0;this.hintMaxScroll=0;
    if(this.hintPiece){this.unregister(this.hintPiece);this.hintPiece=undefined;this.invalidate();}
  }
  private updateHint(hit:Hit|undefined,x:number,y:number):void{
    x/=this.displayScale;y/=this.displayScale;
    const text=hit?.control?.hint??hit?.piece.userData.tooltip??'';
    if(!hit||!text){this.clearHint();return;}
    if(this.hintOwner===hit.piece&&this.hintText===text)return;this.clearHint();this.hintOwner=hit.piece;this.hintText=text;
    this.hintTimer=setTimeout(()=>{
      if(this.closed||this.hintOwner!==hit.piece)return;
      const maxWidth=Math.min(420,this.width-24),raw=text.split('\n'),requested=Math.min(maxWidth,Math.max(70,...raw.map(line=>this.measure(line,13)))+20);
      const lines=wrapNativeText(text,requested-20,this.measure,13),width=Math.min(maxWidth,Math.max(70,...lines.map(line=>this.measure(line,13)))+20),height=Math.min(this.height-20,lines.length*17+16);
      const count=lines.length*17+16>height?Math.max(1,Math.floor((height-30)/17)):lines.length;this.hintMaxScroll=Math.max(0,lines.length-count);this.hintScroll=0;
      const z=2,factor=1-z/HUD_DISTANCE,piece=this.art.createPiece({w:width*.01,h:height*.01,depth:.046,bevel:.038,surface:'panel',uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),seed:347,bgColor:PALETTE.creamPaper,
        drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='left';ctx.font=this.font(13);const scrolling=this.hintMaxScroll>0;lines.slice(scrolling?this.hintScroll:0,scrolling?this.hintScroll+count:lines.length).forEach((line,i)=>ctx.fillText(line,10,20+i*17,width-20));if(scrolling){ctx.font=this.font(11);ctx.fillStyle='#6b5b45';ctx.fillText('Molette : suite',10,height-7);ctx.fillStyle='#78975c';ctx.fillRect(width-6,6+(height-12)*this.hintScroll/lines.length,3,Math.max(8,(height-12)*count/lines.length));}ctx.restore();}});
      const left=THREE.MathUtils.clamp(x+16+width>this.width?x-width-12:x+16,8,this.width-width-8),top=THREE.MathUtils.clamp(y+18+height>this.height?y-height-8:y+18,8,this.height-height-8);
      piece.userData.nativeId='native-tooltip';piece.scale.setScalar(this.uiScale*factor);piece.setBaseTransform((left+width/2-this.width/2)*this.visH/this.height*factor,(this.height/2-top-height/2)*this.visH/this.height*factor,z);this.setPose(piece,0);this.hudRoot.add(piece);this.hintPiece=piece;this.invalidate();
    },350);
  }
  private beginEdit(hit:Hit):void{
    if(!hit.input)return;if(this.editing===hit&&this.editor){this.editor.focus({preventScroll:true});return;}this.finishEdit(false);this.editing=hit;this.editingValue=hit.input.value;
    // OS composition service only. Its position/size never determines a mesh,
    // visible text or pointer hit. Includes IME, Unicode selection and clipboard.
    const input=document.createElement('textarea');this.editor=input;input.value=this.editingValue;input.maxLength=hit.input.maxLength??2048;
    input.setAttribute('aria-label',hit.piece.userData.nativeId as string??'Texte');
    input.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.append(input);input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);
    const repaint=()=>{if(this.editor!==input)return;this.editingValue=input.value;const target=this.editing?.piece;if(!target)return;
      target.redraw((ctx,wp,hp)=>{const q=wp/(target.userData.w*100);ctx.font=this.font(13*q);ctx.textAlign='left';ctx.fillStyle=PALETTE.inkDark;
        const start=input.selectionStart,end=input.selectionEnd,offset=wp*.07,text=this.editingValue;
        const before=ctx.measureText(text.slice(0,start)).width,selected=ctx.measureText(text.slice(start,end)).width;
        const shift=Math.max(0,before-wp*.86);ctx.save();ctx.beginPath();ctx.rect(wp*.06,hp*.06,wp*.88,hp*.88);ctx.clip();
        if(end>start){ctx.fillStyle='#d9ae68';ctx.fillRect(offset+before-shift,hp/2-8*q,selected,17*q);ctx.fillStyle=PALETTE.inkDark;}
        ctx.fillText(text,offset-shift,hp/2+4*q);ctx.fillRect(offset+before-shift,hp/2-8*q,Math.max(1,q),17*q);ctx.restore();});this.invalidate();};
    this.editRepaint=repaint;input.addEventListener('input',repaint);input.addEventListener('select',repaint);input.addEventListener('keyup',repaint);
    input.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Tab'){
        event.preventDefault();event.stopImmediatePropagation();
        if(!event.repeat&&!event.isComposing)void this.advanceEditor(event.shiftKey?-1:1).catch(error=>{if(!this.closed)this.options.onError(String(error));});
      }else if(event.key==='Escape'){event.preventDefault();this.finishEdit(false);}
      else if(event.key==='Enter'&&!event.isComposing){event.preventDefault();this.finishEdit(true);}
    });
    input.addEventListener('blur',()=>this.finishEdit(true),{once:true});repaint();
  }
  private async advanceEditor(direction:1|-1):Promise<void>{
    const editor=this.editor,editing=this.editing;if(!editor||!editing)return;
    const fieldId=String(editing.piece.userData.nativeId??''),pageId=this.page?.id,value=editor.value;
    const selectionStart=editor.selectionStart,selectionEnd=editor.selectionEnd,serial=++this.activationSerial;
    const prior=this.pageControls.filter(hit=>!hit.control?.disabled).map(hit=>String(hit.piece.userData.nativeId??'')),priorIndex=prior.indexOf(fieldId);
    const accepted=await this.finishEdit(true);
    if(this.closed||serial!==this.activationSerial||this.page?.id!==pageId)return;
    const available=this.pageControls.filter(hit=>!hit.control?.disabled);if(!available.length)return;
    const currentIndex=available.findIndex(hit=>String(hit.piece.userData.nativeId??'')===fieldId);
    if(!accepted){
      const same=available[currentIndex];if(!same?.input)return;
      this.focusIndex=currentIndex;this.hover(same.piece);this.beginEdit(same);
      const restored=this.editor;if(restored){restored.value=value;restored.setSelectionRange(selectionStart,selectionEnd);this.editRepaint?.();}
      return;
    }
    let nextIndex=currentIndex>=0?(currentIndex+direction+available.length)%available.length:-1;
    if(nextIndex<0)for(let step=1;step<=prior.length;step++){
      const candidate=prior[(Math.max(0,priorIndex)+direction*step+prior.length*2)%prior.length];
      nextIndex=available.findIndex(hit=>String(hit.piece.userData.nativeId??'')===candidate);if(nextIndex>=0)break;
    }
    if(nextIndex<0)nextIndex=direction>0?0:available.length-1;
    const next=available[nextIndex]!;this.focusIndex=nextIndex;this.hover(next.piece);
    if(next.input)this.beginEdit(next);
  }
  private finishEdit(commit:boolean,rebuild=true):Promise<boolean>{
    const editor=this.editor,hit=this.editing;if(!editor)return this.editorCommit??Promise.resolve(true);
    const binding=hit?.input,pageId=this.page?.id,fieldId=String(hit?.piece.userData.nativeId??''),value=editor.value;
    this.editor=undefined;this.editing=undefined;this.editRepaint=undefined;this.editingPaintDirty=false;editor.remove();
    const task=(async()=>{
      let accepted=true;
      if(commit&&binding)try{
        if(binding.kind==='number'&&(!value.trim()||!Number.isFinite(Number(value))))throw Error('Saisissez un nombre valide.');
        accepted=(await binding.onCommit(value))!==false;
        // Mutable presentation drafts remain literal after Enter/blur even when
        // their controller only updates a local draft rather than rebuilding.
        if(accepted&&this.retainedPagePieces.get(fieldId)?.hit.input===binding)binding.value=value;
      }catch(error){accepted=false;if(!this.closed)this.options.onError(String(error));}
      if(rebuild&&!this.closed)try{this.rebuildPage(true);this.invalidate();}catch(error){accepted=false;this.options.onError(String(error));}
      return accepted;
    })();
    this.editorCommit=task;this.editorCommitPageId=pageId;
    const release=()=>{if(this.editorCommit===task){this.editorCommit=undefined;this.editorCommitPageId=undefined;}};
    void task.then(release,release);
    return task;
  }
  dispose():void{
    this.frontBackdrop.dispose();
    if(this.closed)return;this.hover(null);this.clearMapToolLabel();this.closed=true;this.resetShipCurtain298(false);this.countdownFrameAt298=undefined;this.countdownFrameDriver298=undefined;this.countdownFrameEligible298=false;this.countdownFeedEligible298=false;this.fontRequest++;this.clearHint();clearTimeout(this.noticeTimer);this.finishEdit(false,false);cancelAnimationFrame(this.frameId);
    setNativeCursor(document.documentElement,undefined);
    for(const dispose of this.disposers)dispose();this.disposers.length=0;this.overlayCache.dispose();for(const image of this.portraitImages.values()){image.onload=null;image.onerror=null;}this.portraitImages.clear();this.globe?.dispose();this.selectionFill.geometry.dispose();this.selectionFill.material.dispose();this.selectionOutline.geometry.dispose();this.selectionOutline.material.dispose();this.shipCurtainMesh298.geometry.dispose();this.shipCurtainMaterial298.dispose();this.shipCurtainScene298.clear();this.art.dispose();this.ownRenderer.domElement.remove();void this.ownRenderer.dispose();this.hits.clear();this.moving.clear();this.retainedPagePieces.clear();
  }
}
