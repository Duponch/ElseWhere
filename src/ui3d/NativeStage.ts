import * as THREE from 'three/webgpu';
import {PAWN_TABLE,workLabelDown} from './native-pawn-table';
import {PrototypeCardboardArt,MANAGEMENT_BUTTONS,PALETTE,drawHandRect,drawMarkerLine,type CardboardPiece,type CardboardDraw,type CardboardPieceOptions} from './prototype-art';
import {drawNativeActionIcon,drawNativeActionIconInBox} from './native-action-icons';
import {applyNativeHudButtonPose} from './native-hud-art';
import {applyNativeMapToolHover} from './native-map-tool-hover';
import {createNativeTextLexicon,tokenizeNativeText,NATIVE_TEXT_STYLES,type NativeTextLexicon,type NativeTextEntity,type NativeTextSpan} from './native-rich-text';
import type {NativeControl,NativeControlStyle,NativeGesture,NativePage,NativeRow,NativeShipCurtainPhase298} from './native-contract';
import {NativeGlobe} from './NativeGlobe';
import {NativeOverlayCache} from './NativeOverlayCache';
import {NativeDamageTracker} from './NativeDamageTracker';
import {NativeRendererStandby} from './NativeRendererStandby';
import {NativeFrontBackdrop} from './NativeFrontBackdrop';
import {normalizeNativeUiScale} from './native-preferences';
import {NativeHitPose} from './NativeHitPose';
import {NativeHoverPreview} from './native-hover-preview';
import {NativeHighlightPass,type NativeHighlightCandidate,type NativeHighlightPiece} from './native-highlight';
import {setNativeCursor} from '../ui/native-cardboard-cursors';
import {SHIP_FRAME_MAXIMUM_DELTA_298} from '../bridge/ship-countdown-wire-298';
import {FLOAT_MENU,TOOLTIP_BOX,tooltipBoxSize,floatMenuOpacity,floatMenuVanishes,pressOutsideFloatMenu,mouseAttachedTipPosition,tipTextAction,TOOLTIP_DELAY_MS} from './native-float-menu';
import {retainNativeOpacityMaterials,applyNativeOpacity,type NativeOpacityMaterial} from './native-piece-opacity';
import {NATIVE_LINE,NATIVE_TEXT,NATIVE_INK,NATIVE_WINDOW,type NativeTextRole} from './native-ui-scale';
import {NATIVE_RESEARCH} from './native-research-metrics';
import {historyColumns,NATIVE_FACTIONS,NATIVE_HISTORY} from './native-main-tab-metrics';
import {NATIVE_CREATION,nativeFileColumns} from './native-front-metrics';
import {nativeTradeColumns} from './native-dialog-metrics';
import {layoutNativeEnvironmentStats,type NativeEnvironmentStats,type NativeEnvironmentLayout} from './native-environment-stats';
import {paintNativeEnvironmentStats} from './native-environment-ink';
import {NATIVE_MAP_SEARCH} from './native-map-search-metrics';
import {paintNativeBioCard,nativeBioTargets} from './native-bio-card';
import {paintNativeTabCard,nativeTabTargets,setCardScroll,cardScrollKey,cardScroll} from './native-tab-card';
import {NATIVE_UI,NATIVE_LEADING,NATIVE_RIGHT_DOCK_WIDTH,layoutNativePage,nativeVisualWidth,nativeMatrixColumns,nativeMatrixHeadingLines,nativeTableRowScroll,wrapNativeText,nativeCardInk,type NativePageBox,type NativeRowBox,type NativeRect,type NativeRegion,type NativeRegionBox} from './native-layout';

const HUD_DISTANCE=7.5;
const tradeNumber=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2});
const PANEL_IDS=['architect','work','schedule','assign','animals','wildlife','research','quests','world','history','factions','menu'] as const;
type NativePanelId=typeof PANEL_IDS[number];
type Hit={piece:CardboardPiece;control?:NativeControl;input?:NonNullable<NativeRow['input']>;region?:NativeRect};
type PagePiece={piece:CardboardPiece;hit:Hit;geometry:string;paint:string};
type FloatMenuView={page:NativePage;box?:NativePageBox;pieces:CardboardPiece[];controls:Hit[];materials:NativeOpacityMaterial[];opacity:number;scroll:number;focus?:string};
/** Parked page pieces: at most this many, and this many canvas pixels (each
 * pixel exists once on the CPU canvas and once in the GPU texture). Large
 * pieces (page sheets, repainted with their rows anyway) are not parked. */
/** Hand-cut outline variants of controls: same-size controls share geometry. */
const CONTROL_CUT_VARIANTS=16;
const PARKED_PAGE_PIECES=6000,PARKED_PAGE_PIXELS=16_000_000,PARKED_PIECE_MAX_PIXELS=250_000;
const pagePiecePixels=(piece:CardboardPiece):number=>(piece.userData.wPx??0)*(piece.userData.hPx??0);
export interface NativeStageOptions {
  onPanel:(panel:NativePanelId)=>void;
  onEscape:()=>void;
  onHudInspectorDismiss?:()=>void;
  onError:(message:string)=>void;
  onGesture?:()=>void;
  onActivate?:(id:string)=>void;
  /** Core TutorSystem.AllowAction: false refuses this activation (the
   * caller shows why). Asked before any control acts. */
  allowActivate?:(id:string,control:NativeControl|undefined)=>boolean;
  onCancelWorldInteraction?:()=>void;
  onTools?:(kind:'orders'|'zones')=>void;
  onViewport?:(width:number,height:number,unitsPerPixel:number,bottomDockHeight:number,leftHudBottom:number)=>void;
  onWindowLayout?:(bounds:NativeRect|null)=>boolean;
  onPointer?:(x:number,y:number)=>void;
  /** True while the mouse belongs to a window/HUD instead of the map. */
  onWorldHoverBlocked?:(blocked:boolean)=>void;
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
  private readonly regionGroups={navigation:new THREE.ClippingGroup(),details:new THREE.ClippingGroup(),graph:new THREE.ClippingGroup(),toolbar:new THREE.ClippingGroup()};
  private readonly regionOffsets={navigation:0,details:0,graph:0,toolbar:0};
  private graphX=0;
  private researchFocusKey:string|undefined;
  private infoFocusKey:string|undefined;
  private paletteX=0;
  private setupDetailsX=0;
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
  /** FloatMenuMap is a separate Super-layer window, not the inspect pane. */
  private floatMenu:FloatMenuView|undefined;
  private floatMenuDrag:{pointerId:number;y:number;offset:number;travel:number;max:number}|undefined;
  private readonly pagePieces:CardboardPiece[]=[];
  private readonly retainedPagePieces=new Map<string,PagePiece>();
  /** Pieces of closed pages, kept so that reopening a page needs no geometry,
   * paint or texture upload. Least recently parked first; bounded in pixels. */
  private readonly parkedPagePieces=new Map<string,PagePiece>();
  private parkedPagePixels=0;
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
  private mapSearchInkPage:NativePage|undefined;
  private mapSearchInkRevision=0;
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
  /** Pulsing frames of highlighted controls, drawn after the cached image. */
  private readonly highlight=new NativeHighlightPass();
  private readonly highlightPoint=new THREE.Vector3();
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
  private devBarGroup?:THREE.Group;
  private devBarPieces:CardboardPiece[]=[];
  private notice:CardboardPiece|undefined;
  private noticeTimer:ReturnType<typeof setTimeout>|undefined;
  private globe:NativeGlobe|undefined;
  private globeDrag:{pointerId:number;x:number;y:number;startX:number;startY:number}|undefined;
  private readonly selectionBox=new THREE.Group();
  /** Core `Widgets.DrawHighlight` under the mouse over a Bio chip or skill row:
   * one shared plane moved to the hovered rectangle, never a repaint. */
  private rowHighlight?:THREE.Mesh;
  private readonly selectionFill=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xf8e5ad,transparent:true,opacity:.09,depthTest:false,depthWrite:false}));
  private readonly selectionOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1,1)),new THREE.LineBasicMaterial({color:0xf8e5ad,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));
  private readonly portraitImages=new Map<string,HTMLImageElement>();
  private portraitRepaintQueued=false;
  private hintOwner:CardboardPiece|null=null;
  private hintText='';
  private hintTimer:ReturnType<typeof setTimeout>|undefined;
  /** Core TooltipHandler: a tip lives while the mouse stays over its region,
   * re-reads its text, follows the mouse and survives a repaint of the region. */
  private hintHit:Hit|undefined;
  private hintAt={x:0,y:0};
  private hintSize={width:0,height:0};
  private hintReacquire:string|undefined;
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
  private environmentBlocked=true;
  private environmentStats:NativeEnvironmentStats|null=null;
  private environmentStatsPiece:CardboardPiece|undefined;
  private environmentStatsLayout:NativeEnvironmentLayout|undefined;
  private environmentStatsInk='';
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
      const piece=this.art.createPiece({w:1.08,h:.46,depth:.046,bevel:.038,uvPadding:1,textureWidth:216,textureHeight:92,seed:381+index*5,bgColor:PALETTE.sageMountain,interactive:true,tooltip:control.hint,drawFn:(ctx,w,h,rng)=>{ctx.save();ctx.scale(w/108,h/46);/* Preserve the seeded label paint after removing the icon disk. */for(let point=0;point<14;point++)rng();drawNativeActionIconInBox(ctx,kind,7,7,30,32);drawHandRect(ctx,44,11,58,25,PALETTE.creamPaper,PALETTE.inkDark,1,rng);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='center';ctx.font=this.font('small',true);ctx.fillText(control.label,73,28,54);ctx.restore();}});
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
    this.listen(window,'resize',()=>{this.resize();this.rebuildPage(true);this.layoutToolsDock();this.refreshWorldReadout();this.refreshEnvironmentStats();this.invalidate();});
    this.listen(document,'pointermove',event=>this.pointerMove(event as PointerEvent),true);
    this.listen(document,'pointerdown',event=>this.pointerDown(event as PointerEvent),true);
    this.listen(document,'pointerup',event=>this.pointerUp(event as PointerEvent),true);
    this.listen(document,'pointercancel',()=>this.cancelPress(),true);
    this.listen(window,'blur',()=>{this.cancelPress();this.setPointerOverUi(true);this.hover(null);setNativeCursor(document.documentElement,undefined);});
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
      mode:'native-meshes',highlight:this.highlight.diagnostics,page:this.floatMenu?.page.id??this.page?.id??null,basePage:this.page?.id??null,scroll:this.scroll,maxScroll:this.maxScroll,pageBounds:this.pageBox?{x:this.pageBox.x,y:this.pageBox.y,width:this.pageBox.width,height:this.pageBox.height}:null,floatMenu:this.floatMenu?.box?{id:this.floatMenu.page.id,x:this.floatMenu.box.x,y:this.floatMenu.box.y,width:this.floatMenu.box.width,height:this.floatMenu.box.height,scroll:this.floatMenu.scroll,opacity:this.floatMenu.opacity}:null,dropdown:this.dropdown?{owner:this.dropdown.controlId,...this.dropdown.box}:null,bottomDock:{autoHide:this.autoHideBottom,open:this.bottomOpen,offset:this.bottomOffset,page:this.managementPage,pages:this.managementPages},front:this.frontVisible,frontBackdrop:this.frontBackdrop.diagnostics,globe:this.globeDiagnostics(),
      readout:this.worldReadout?{visible:this.worldReadout.visible,paper:this.worldReadout.userData.paper,width:this.worldReadout.userData.w*100,height:this.worldReadout.userData.h*100,lines:this.worldReadoutLines,scroll:this.worldReadoutScroll,maxScroll:this.worldReadoutMaxScroll}:null,
      environmentStats:this.environmentStatsPiece?.visible&&this.environmentStatsLayout?{layout:this.environmentStatsLayout,room:this.environmentStats?.room?.title,stats:this.environmentStats?.room?.stats,beauty:this.environmentStats?.beauty?.average}:null,
      tooltip:this.hintPiece?{width:this.hintPiece.userData.w*100,height:this.hintPiece.userData.h*100}:null,
      regions:this.pageBox?.regions,inspectorParts:this.pageBox?.inspectorParts,graph:this.page?.research?{x:this.graphX,y:this.regionOffsets.graph,width:this.page.research.width,height:this.page.research.height,bounds:this.pageBox?.regions.graph}:null,
      paletteOffset:this.paletteX,rows:this.pageBox?.rows.map(row=>({id:row.row.id,column:row.row.column,region:row.row.region,meter:!!row.row.meter,x:row.x-this.horizontalOffset(row.row.region),top:row.top-this.rowOffset(row.row),width:row.width,height:row.height,visible:this.rowVisible(row)}))??[],
      management:this.management.map((piece,index)=>{
        const center=piece.getWorldPosition(new THREE.Vector3()).project(this.camera);
        return {id:PANEL_IDS[index],x:(center.x+1)*this.width/2*this.displayScale,y:(1-center.y)*this.height/2*this.displayScale,
          width:piece.userData.w,height:piece.userData.h,seed:piece.userData.seed,visible:piece.visible,
          position:piece.position.toArray(),rotation:piece.rotation.toArray(),active:piece.userData.active};
      }),controls:[...this.pageControls,...(this.floatMenu?.controls??[]),...(this.dropdown?.pieces.flatMap(piece=>{const hit=this.hits.get(piece.userData.mesh);return hit?.control?[hit]:[];})??[])].map(hit=>{
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
    if(!visible)this.closeFloatMenu();
    this.worldVisible=visible;this.standalone=!visible;
    this.updateOwnSurface();
    this.anchors.bottomCenter.visible=!this.frontVisible;this.toolsDock.visible=visible&&!this.frontVisible;this.updateDevBarVisibility();this.updateWorldReadoutVisibility();this.syncEnvironmentHover();this.invalidate();
  }
  setFrontVisible(visible:boolean):void{
    if(this.frontVisible===visible)return;this.sceneRevision++;
    if(visible)this.closeFloatMenu();
    this.frontVisible=visible;this.frontBackdrop.setVisible(visible);if(visible)this.resetShipCurtain298(false);this.updateOwnSurface();
    this.anchors.bottomCenter.visible=!visible;this.toolsDock.visible=this.worldVisible&&!visible;this.updateDevBarVisibility();this.resize();this.rebuildPage(true);this.updateWorldReadoutVisibility();this.syncEnvironmentHover();this.invalidate();
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
  /** World units per CSS pixel at the HUD plane, for a piece added straight to
   * `hudRoot` (the anchors and pages carry this scale themselves through uiScale,
   * so they work in the logical 0.01 unit of getViewportMetrics). */
  hudUnitsPerPixel():number{return this.visH/this.height;}
  getViewportMetrics(){const orders=this.toolsDock.children[0] as CardboardPiece|undefined;return {width:this.width,height:this.height,unitsPerPixel:.01,scale:this.displayScale,bottomDockHeight:this.bottomDockHeight,leftHudBottom:Math.max(40,this.height-8-(orders?orders.userData.basePos.y*100+23:this.bottomDockHeight)-12)};}
  private notifyViewport():void{
    const v=this.getViewportMetrics(),signature=JSON.stringify([v.width,v.height,v.bottomDockHeight,v.leftHudBottom]);if(signature===this.viewportSignature)return;this.viewportSignature=signature;
    this.options.onViewport?.(v.width,v.height,.01,v.bottomDockHeight,v.leftHudBottom);
  }
  hasOpenGamePage(modalOnly=false):boolean{return this.worldVisible&&!this.frontVisible&&(modalOnly?!!this.page?.modal:!!this.page||!!this.floatMenu);}
  allowsMapGizmoShortcuts():boolean{return this.worldVisible&&!this.frontVisible&&!this.floatMenu&&!this.dropdown&&!this.editor&&!this.page?.modal&&this.page?.layout==='inspector';}
  allowsMapSearch():boolean{return this.worldVisible&&!this.frontVisible&&!this.floatMenu&&!this.dropdown&&!this.editor&&!this.page?.modal;}
  focusMapSearchInput():void{
    if(this.page?.layout!=='map-search')return;const hit=this.pageControls.find(hit=>hit.input&&hit.piece.userData.nativeId==='map-search-input');if(hit)this.beginEdit(hit);
  }
  private cameraWorldPoint(x:number,y:number):boolean{
    if(!this.hasOpenGamePage()||this.dropdown||this.editor)return false;
    const lx=x/this.displayScale,ly=y/this.displayScale;
    if(this.pageContains(lx,ly)||this.floatMenu?.box&&!pressOutsideFloatMenu(this.floatMenu.box,lx,ly))return false;
    // Modal activation can filter HUD controls, but camera gestures must still
    // respect every physically visible UI surface.
    return !this.hit(x,y,true)&&this.globeHit(x,y)===null;
  }
  setUiScale(value:number):void{
    const next=normalizeNativeUiScale(value);if(next===this.displayScale)return;
    this.lastPointer={x:this.lastPointer.x*this.displayScale/next,y:this.lastPointer.y*this.displayScale/next};
    this.displayScale=next;this.cancelPress();this.hover(null);this.clearHint();this.closeDropdown();
    this.resize();this.rebuildPage(true);this.layoutToolsDock();this.refreshWorldReadout();this.refreshEnvironmentStats();this.overlayCache.invalidate();this.invalidate();
  }
  setTextEntities(entities:readonly NativeTextEntity[]):void{if(this.sharedTextEntities===entities)return;this.sharedTextEntities=entities;if(this.page&&!this.page.textEntities){this.rebuildPage(true);this.invalidate();}}
  setAutoHideBottom(enabled:boolean):void{this.autoHideBottom=enabled;this.bottomOpen=!enabled||this.lastPointer.y>=this.height-14;this.extraAnimating=true;this.invalidate();}
  /** Builds a page's pieces without showing it and parks them, so that its
   * first real opening reuses them. Only while no page is shown in game: no
   * frame is rendered in between, and the empty page is restored at once. */
  prewarmPage(page:NativePage):boolean{
    if(this.closed||this.page||this.floatMenu||this.frontVisible||!this.worldVisible||this.shipCurtainOwner298!==undefined)return false;
    const scroll=this.scroll;
    this.page=page;
    try{
      this.rebuildPage(true);
      // Upload the new pieces' paint now, not at the page's first frame.
      const renderer=this.overlayRenderer;
      if(renderer)for(const piece of this.pagePieces)renderer.initTexture(piece.userData.texture);
    }
    finally{this.page=null;this.rebuildPage(true);this.scroll=scroll;this.invalidate();}
    return true;
  }
  /** Native id of the control under the pointer (read by the learning helper). */
  get hoveredNativeId():string|undefined{const id=this.hovered?.userData.nativeId;return typeof id==='string'&&id?id:undefined;}
  /** Id of the page shown, if any (read by the learning helper). */
  get shownPageId():string|undefined{return this.floatMenu?.page.id??this.page?.id??undefined;}
  showPage(page:NativePage|null):void{
    if(this.closed)return;
    if(page?.floatMenu){this.showFloatMenu(page);return;}
    if(page?.layout==='map-search'&&page===this.page)return;
    if(page?.layout!=='map-search')this.mapSearchInkPage=undefined;
    if(this.floatMenu&&(this.frontVisible||page?.modal||page?.id!==this.page?.id))this.closeFloatMenu();
    if(this.shipCurtainOwner298!==undefined&&page?.id!==this.shipCurtainPage298){
      // One handoff is expected when adopted credits disappear. Further page
      // changes cancel the visual transition instead of covering another UI.
      if(this.shipCurtainPhase298==='clear'&&this.shipCurtainPageHandoff298){this.shipCurtainPageHandoff298=false;this.shipCurtainPage298=page?.id;}
      else this.resetShipCurtain298();
    }
    const contentChanged=page?.contentKey!==this.page?.contentKey,navigationChanged=page?.navigationKey!==this.page?.navigationKey,detailsChanged=page?.detailsKey!==this.page?.detailsKey;
    const same=page?.id===this.page?.id,ownerChanged=page?.visual?.surface!==this.page?.visual?.surface||page?.visual?.roads!==this.page?.visual?.roads;
    this.page=page;if(!same){this.cancelPress();this.hover(null);this.scroll=0;this.regionOffsets.navigation=this.regionOffsets.details=this.regionOffsets.graph=this.regionOffsets.toolbar=this.graphX=this.paletteX=this.setupDetailsX=0;this.researchFocusKey=this.infoFocusKey=undefined;this.closeDropdown();}else if(contentChanged){this.cancelPress();this.scroll=0;this.infoFocusKey=undefined;}
    if(navigationChanged&&page?.navigationKey!==undefined)this.regionOffsets.navigation=0;
    if(page?.detailsKey!==undefined&&(detailsChanged||contentChanged)){this.regionOffsets.details=0;this.setupDetailsX=0;}
    this.toolsDock.children.forEach((object,index)=>{const piece=object as CardboardPiece,active=page?.palette===(index===0?'orders':'zones');if(piece.userData.active!==active)piece.setActive(active,active?PALETTE.ochre:PALETTE.sageMountain);});
    this.rebuildPage(ownerChanged);this.layoutToolsDock();this.refreshWorldReadout();this.updateWorldReadoutVisibility();this.syncEnvironmentHover();this.invalidate();
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
    const repaint=()=>{if(this.closed||request!==this.fontRequest)return;this.textFontRevision++;this.rebuildPage(true);this.rebuildFloatMenu();this.notice?.redraw();this.hintPiece?.redraw();this.refreshWorldReadout();this.refreshEnvironmentStats();this.editRepaint?.();this.invalidate();};
    repaint();
    const fonts=document.fonts;if(!fonts)return;
    const regular=`400 20px ${JSON.stringify(name)}`,bold=`700 20px ${JSON.stringify(name)}`;
    if(!fonts.check(regular)||!fonts.check(bold))void Promise.all([fonts.load(regular,'Éléonore, cœur, œuf, ça, où, Noël.'),fonts.load(bold,'Éléonore, cœur, œuf, ça, où, Noël.')]).then(repaint).catch(()=>{});
  }
  /** Every text is drawn in a role of the interface scale (native-ui-scale.ts);
   * `scale` only follows a painted texture's own resolution or a glyph. */
  private font(role:NativeTextRole,bold=false,scale=1):string{return this.fontPx(NATIVE_TEXT[role]*scale,bold);}
  private fontPx(size:number,bold=false):string{return `${bold?'bold ':''}${size}px ${this.textFontFamily}`;}
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
    // Core MouseoverReadout.BotLeft (15, 65): 15 px from the left, the first
    // (bottom) line 65 px above the screen's bottom edge, lines 19 px apart.
    const left=15,lowLane=this.bottomLeftClearance-24,canUseCorner=lowLane>=180;
    const maxWidth=Math.max(80,Math.min(640,this.width-NATIVE_RIGHT_DOCK_WIDTH-16,canUseCorner?lowLane-11:Infinity));
    const bottom=canUseCorner?46:this.bottomDockHeight+8;this.readoutBottom=bottom;
    const lines=this.worldReadoutLines.flatMap(line=>wrapNativeText(line,maxWidth,this.measure,NATIVE_TEXT.small)),available=Math.max(42,this.height-bottom-180);
    const overflow=lines.length*19+4>available,count=overflow?Math.max(1,Math.floor((available-22)/19)):lines.length;
    this.worldReadoutMaxScroll=Math.max(0,lines.length-count);this.worldReadoutScroll=Math.min(this.worldReadoutScroll,this.worldReadoutMaxScroll);
    const width=Math.min(maxWidth,Math.max(...lines.map(line=>this.measure(line,NATIVE_TEXT.small)))+8),height=count*19+4+(overflow?18:0);
    this.readoutReserveHeight=Math.max(this.readoutReserveHeight,height);
    const top=this.height-8-bottom-height;
    const box=this.pageBox;
    this.readoutCanPlace=!box||box.layout==='palette'||top>=box.y+box.height+8||left+8+width<=box.x-8;
    const w=width*.01,h=height*.01,geometry=width+'|'+height+'|'+overflow,ink=JSON.stringify([lines,this.textFontRevision]);
    const draw:CardboardDraw=(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.textAlign='left';ctx.font=this.font('small');ctx.lineJoin='round';ctx.strokeStyle='rgba(15,22,17,.95)';ctx.lineWidth=3;ctx.fillStyle='#fff9eb';lines.slice(this.worldReadoutScroll,this.worldReadoutScroll+count).forEach((line,i)=>{ctx.strokeText(line,3,16+i*19);ctx.fillText(line,3,16+i*19);});if(overflow){const text=`Molette : suite · ${this.worldReadoutScroll+1}–${Math.min(lines.length,this.worldReadoutScroll+count)}/${lines.length}`;ctx.font=this.font('tiny',true);ctx.fillStyle='#f4d589';ctx.strokeText(text,3,height-4);ctx.fillText(text,3,height-4);}ctx.restore();};
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
  private setPointerOverUi(over:boolean):void{if(this.pointerOverUi!==over){this.pointerOverUi=over;this.updateWorldReadoutVisibility();}this.syncEnvironmentHover();}
  private syncEnvironmentHover():void{
    const blocked=!this.worldVisible||this.frontVisible||this.pointerOverUi||!!this.page?.modal||!!this.floatMenu||!!this.dropdown||!!this.worldPress;
    if(blocked!==this.environmentBlocked){this.environmentBlocked=blocked;this.options?.onWorldHoverBlocked?.(blocked);}
    this.refreshEnvironmentStats();
  }
  setEnvironmentStats(stats:NativeEnvironmentStats|null):void{
    if(stats===this.environmentStats)return;this.environmentStats=stats;this.refreshEnvironmentStats();
  }
  /** Camera-fixed, click-through environment sheet. Only content/scale alters
   * its texture; pointer movement just changes the existing plane's pose. */
  private refreshEnvironmentStats():void{
    const stats=this.environmentStats;
    if(!stats||this.environmentBlocked||this.closed){if(this.environmentStatsPiece?.visible){this.environmentStatsPiece.visible=false;this.sceneRevision++;this.invalidate();}this.environmentStatsLayout=undefined;return;}
    const layout=layoutNativeEnvironmentStats(stats,{width:this.width,height:this.height},this.lastPointer),{width,height}=layout;
    if(width<=0||height<=0)return;this.environmentStatsLayout=layout;
    const ink=JSON.stringify([width,height,stats.room?.title,stats.room?.stats,stats.beauty?.average,this.textFontRevision]);
    const z=1.5,factor=1-z/HUD_DISTANCE,w=width*.01,h=height*.01;
    const draw:CardboardDraw=(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);paintNativeEnvironmentStats(ctx,layout,stats,{font:(role,bold)=>this.font(role,bold),measure:this.measure});ctx.restore();};
    let piece=this.environmentStatsPiece,changed=false;
    if(!piece||piece.userData.w!==w||piece.userData.h!==h){
      if(piece)this.unregister(piece);
      piece=this.art.createPiece({w,h,depth:.025,bevel:.018,surface:'panel',uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),bgColor:PALETTE.creamPaper,seed:75157,interactive:false,drawFn:draw});
      piece.userData.nativeId='environment-stats';piece.userData.nativeStatic=true;this.hudRoot.add(piece);this.environmentStatsPiece=piece;changed=true;
    }else if(this.environmentStatsInk!==ink){piece.redraw(draw);changed=true;}
    this.environmentStatsInk=ink;
    const x=(layout.x+width/2-this.width/2)*this.visH/this.height*factor,y=(this.height/2-layout.y-height/2)*this.visH/this.height*factor,scale=this.uiScale*factor;
    if(piece.scale.x!==scale){piece.scale.setScalar(scale);changed=true;}
    if(piece.userData.basePos.x!==x||piece.userData.basePos.y!==y||piece.userData.basePos.z!==z){piece.setBaseTransform(x,y,z);changed=true;}
    if(!piece.visible){piece.visible=true;changed=true;}if(changed){this.sceneRevision++;this.invalidate();}
  }
  showNotice(message:string,error=false):void{
    clearTimeout(this.noticeTimer);if(this.notice)this.unregister(this.notice);
    const width=Math.min(this.width-32,460,Math.max(120,this.measure(message,NATIVE_TEXT.small)+24)),lines=wrapNativeText(message,width-24,this.measure,NATIVE_TEXT.small),height=lines.length*17+20;
    const w=width*.01,h=height*.01;
    const piece=this.art.createPiece({w,h,seed:1881,uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),bgColor:error?'#e2b59a':PALETTE.creamPaper,depth:.046,bevel:.038,surface:'panel',
      drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font('small');ctx.textAlign='left';lines.forEach((line,index)=>ctx.fillText(line,12,23+index*17,width-24));ctx.restore();}});
    piece.setBaseTransform(0,-1.0,.35);this.anchors.topCenter.add(piece);this.notice=piece;this.invalidate();
    this.noticeTimer=setTimeout(()=>{if(this.notice===piece){this.unregister(piece);this.notice=undefined;this.invalidate();}},error?8000:4000);
  }
  /** Developer mode toolbar (Core's DebugWindowsOpener row at the top of the
   * screen): a few cardboard buttons at the top centre, only over the map.
   * Rebuilt when its buttons change; null removes it. Presentation only. */
  setDevBar(buttons:readonly {id:string;label:string;hint:string;active?:boolean;onActivate:()=>void|Promise<unknown>}[]|null):void{
    for(const piece of this.devBarPieces)this.unregister(piece);
    this.devBarPieces=[];
    if(!buttons?.length){if(this.devBarGroup)this.devBarGroup.visible=false;this.invalidate();return;}
    if(!this.devBarGroup){this.devBarGroup=new THREE.Group();this.anchors.topCenter.add(this.devBarGroup);}
    const height=26,gap=6,widths=buttons.map(button=>Math.ceil(this.measure(button.label,NATIVE_TEXT.small,true))+24);
    const total=widths.reduce((sum,width)=>sum+width,0)+gap*(buttons.length-1);
    let left=-total/2;
    buttons.forEach((button,index)=>{
      const width=widths[index]!,w=width*.01,h=height*.01;
      const piece=this.art.createPiece({w,h,seed:6101+index,uvPadding:1,textureWidth:width*2,textureHeight:height*2,bgColor:button.active?PALETTE.sageMountain:PALETTE.creamPaper,depth:.036,bevel:.03,interactive:true,tooltip:button.hint,
        drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font('small',true);ctx.textAlign='center';ctx.fillText(button.label,width/2,height/2+5,width-12);ctx.restore();}});
      piece.userData.nativeId=button.id;
      // Just under the colonist bar, which owns the very top of the screen.
      piece.setBaseTransform((left+width/2)*.01,-1.28,.2);
      left+=width+gap;
      this.devBarGroup!.add(piece);this.devBarPieces.push(piece);
      this.register(piece,{id:button.id,label:button.label,hint:button.hint,onActivate:button.onActivate});
    });
    this.updateDevBarVisibility();this.sceneRevision++;this.invalidate();
  }
  private updateDevBarVisibility():void{if(this.devBarGroup)this.devBarGroup.visible=this.devBarPieces.length>0&&this.worldVisible&&!this.frontVisible;}
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
        const piece=this.art.createPiece({w:.32,h:.42,seed:direction<0?48411:48412,interactive:true,bgColor:PALETTE.kraftBase,tooltip:control.hint,drawFn:(ctx,w,h)=>{ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font('medium',true,1.6);ctx.textAlign='center';ctx.fillText(control.label,w/2,h*.66);}});piece.userData.nativeId=control.id;this.register(piece,control);this.anchors.bottomCenter.add(piece);return piece;};
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
    this.rebuildFloatMenu();
    this.refreshWorldReadout();
    this.refreshEnvironmentStats();
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
  /** Renderer drawing this interface in game: page warm-ups upload to it. */
  private overlayRenderer:THREE.WebGPURenderer|undefined;
  renderOverlay(renderer:THREE.WebGPURenderer,now=performance.now()):void{
    this.overlayRenderer=renderer;
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
      this.renderHighlights(renderer,now);
      this.renderShipCurtain298(renderer);this.shipCurtainDisplayDirty298=false;
      this.stats.renderMs=performance.now()-start;this.stats.drawCalls=renderer.info.render.drawCalls-draws;this.stats.overlayRenders++;return;
    }
    const auto=renderer.autoClear,target=renderer.getRenderTarget();renderer.autoClear=false;
    try{
      renderer.clearDepth();const start=performance.now(),draws=renderer.info.render.drawCalls;renderer.render(this.scene,this.camera);
      this.renderHighlights(renderer,now);
      this.renderShipCurtain298(renderer);this.shipCurtainDisplayDirty298=false;
      this.stats.renderMs=performance.now()-start;this.stats.drawCalls=renderer.info.render.drawCalls-draws;this.stats.overlayRenders++;
    }finally{renderer.autoClear=auto;renderer.setRenderTarget(target);}
  }
  /** Tags whose controls pulse (Core UIHighlighter), from the learning
   * helper today and the tutorial later. Presentation only. */
  setHighlightTags(tags:readonly string[]):void{if(this.highlight.setTags(tags))this.invalidate();}
  /** In game only, after the cached interface: nothing when no tag is set.
   * Controls are looked up when pieces are created or parked or the page is
   * rebuilt; each frame follows the highlighted ones only. */
  private renderHighlights(renderer:THREE.WebGPURenderer,now:number):void{
    const pass=this.highlight;if(!pass?.active)return;
    pass.sync(this.art.pieceRevision,visit=>this.visitHighlightCandidates(visit));
    if(pass.update(now/1000,this.scene,(piece,center)=>this.highlightCovered(piece,center),this.reducedMotion.matches))pass.render(renderer,this.camera);
  }
  private visitHighlightCandidates(visit:(candidate:NativeHighlightCandidate)=>void):void{
    for(const hit of this.pageControls)if(hit.region&&hit.control)visit({piece:hit.piece,control:hit.control,region:hit.region});
    const seen=new Set<CardboardPiece>();
    for(const mesh of this.art.interactiveMeshes){
      const piece=mesh.userData.widgetGroup as CardboardPiece|undefined;if(!piece||seen.has(piece))continue;seen.add(piece);
      visit({piece,control:this.hits.get(mesh)?.control});
    }
  }
  /** A page covers the HUD below it, a modal page every control but its
   * own, and an open list the controls under it. */
  private highlightCovered(piece:NativeHighlightPiece,center:THREE.Vector3):boolean{
    const point=this.highlightPoint.copy(center).project(this.camera),x=(point.x+1)*this.width/2,y=(1-point.y)*this.height/2;
    const inside=(box:{x:number;y:number;width:number;height:number})=>x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height;
    const list=this.dropdown;if(list&&!list.pieces.includes(piece as CardboardPiece)&&inside(list.box))return true;
    const menu=this.floatMenu;if(menu?.box&&inside(menu.box))return !menu.pieces.includes(piece as CardboardPiece);
    const page=this.page,box=this.pageBox;if(!page||!box)return false;
    for(let node:THREE.Object3D|null=piece;node;node=node.parent)if(node===this.pageGroup)return false;
    return !!page.modal||this.pageContains(x,y);
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
    if(this.hintOwner||this.hintReacquire!==undefined)this.refreshHint();
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
    if(this.hintOwner===piece)this.clearHint(true);
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
    this.clearMapToolLabel();const width=Math.min(220,Math.max(54,this.measure(title,NATIVE_TEXT.small,true)+20)),height=26;
    const label=this.art.createPiece({w:width*.01,h:height*.01,depth:.018,bevel:.012,uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:52,bgColor:PALETTE.creamPaper,seed:this.seed('map-tool-label:'+title),interactive:false,
      drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.font=this.font('small',true);ctx.textAlign='center';ctx.fillStyle=PALETTE.inkDark;ctx.fillText(title,width/2,18,width-12);ctx.restore();}});
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
    this.showRowHighlight(piece?.userData.nativeHighlight?piece:null);
    if(piece?.userData.nativeStatic||piece?.userData.nativeDisabled)piece=null;
    if(piece===this.hovered)return;
    const mesh=piece?.userData.interactiveMeshes?.[0];
    // A HUD card without a page control may carry its own view-only preview
    // (the letter stack highlights the letter's targets).
    const own=piece?.userData.onHover;
    this.hoverPreview.set(mesh?this.hits.get(mesh)?.control?.onHover??(typeof own==='function'?own as (hovered:boolean)=>void:undefined):undefined);
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
    // Core FloatMenu.UpdateBaseColor (vanishIfMouseDistant): the menu closes
    // once the mouse is more than 95 px from its rectangle grown by 5 px.
    if(this.floatMenuDrag){
      const drag=this.floatMenuDrag;if(drag.pointerId!==event.pointerId)return;
      this.setFloatMenuScroll(drag.offset+(this.lastPointer.y-drag.y)*drag.max/Math.max(1,drag.travel));this.swallow(event);return;
    }
    const menu=this.floatMenu;
    if(menu?.box){
      if(floatMenuVanishes(menu.box,this.lastPointer.x,this.lastPointer.y))this.closeFloatMenu();
      else this.setFloatMenuOpacity(floatMenuOpacity(menu.box,this.lastPointer.x,this.lastPointer.y));
    }
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
  /** Core WindowStack.CloseWindowsBecauseClicked: a press outside a float
   * menu (closeOnClickedOutside) closes it and the event is used. */
  private floatMenuOutside(event:PointerEvent):boolean{
    const box=this.floatMenu?.box;
    if(!box||!this.worldVisible||this.frontVisible)return false;
    if(!pressOutsideFloatMenu(box,event.clientX/this.displayScale,event.clientY/this.displayScale))return false;
    this.closeFloatMenu();this.dismissedPointer=event.pointerId;return true;
  }
  /** Closes only the float menu: the selection and the inspector stay. */
  private closeFloatMenu():void{
    const page=this.floatMenu?.page;if(!page)return;
    this.hideFloatMenu(page);
    try{page.onClose?.();}catch(error){this.options.onError(String(error));}
  }
  isFloatMenuCurrent(page:NativePage):boolean{return this.floatMenu?.page===page;}
  /** The host may retire only the window it owns; a later click has its own
   * menu and the ordinary inspect pane never changes ownership. */
  hideFloatMenu(page?:NativePage):void{
    const menu=this.floatMenu;if(!menu||page&&menu.page!==page)return;
    this.floatMenu=undefined;this.floatMenuDrag=undefined;this.activationSerial++;
    if(this.down&&menu.pieces.includes(this.down.piece))this.down=null;
    for(const piece of menu.pieces)this.unregister(piece);
    this.hoverPose=undefined;this.clearHint();this.highlight?.invalidate();this.syncEnvironmentHover();this.sceneRevision++;this.invalidate();
  }
  showFloatMenu(page:NativePage):void{
    if(this.closed||!page.floatMenu||this.frontVisible)return;
    if(this.floatMenu?.page===page)return;
    this.hideFloatMenu();this.closeDropdown();this.hover(null);this.hoverPose=undefined;this.clearHint();
    this.floatMenu={page,pieces:[],controls:[],materials:[],opacity:1,scroll:0};this.rebuildFloatMenu();this.syncEnvironmentHover();
  }
  private setFloatMenuOpacity(opacity:number):void{
    const menu=this.floatMenu;if(!menu||menu.opacity===opacity)return;
    menu.opacity=opacity;
    if(applyNativeOpacity(menu.materials,opacity)){this.art.resourceRevision++;this.sceneRevision++;this.invalidate();}
  }
  private setFloatMenuScroll(offset:number):void{
    const menu=this.floatMenu,box=menu?.box;if(!menu||!box)return;
    const next=THREE.MathUtils.clamp(offset,0,Math.max(0,box.contentHeight-box.body.height));
    if(next!==menu.scroll){menu.scroll=next;this.rebuildFloatMenu();}
  }
  private rebuildFloatMenu():void{
    const menu=this.floatMenu;if(!menu)return;
    for(const piece of menu.pieces)this.unregister(piece);menu.pieces=[];menu.controls=[];menu.materials=[];
    const page=menu.page,anchor=page.floatMenu!;
    const box=layoutNativePage({...page,floatMenu:{x:anchor.x/this.displayScale,y:anchor.y/this.displayScale}},
      {width:this.width,height:this.height},false,this.measure);
    menu.box=box;
    // An asynchronous option reply or a resize can replace the window while
    // the pointer is stationary. Keep the same distance rule then, too.
    if(floatMenuVanishes(box,this.lastPointer.x,this.lastPointer.y)){this.closeFloatMenu();return;}
    menu.opacity=floatMenuOpacity(box,this.lastPointer.x,this.lastPointer.y);
    const max=Math.max(0,box.contentHeight-box.body.height);menu.scroll=THREE.MathUtils.clamp(menu.scroll,0,max);
    const sharedMaterials=new Set([this.art.cardboardEdgeMat,this.art.shadowMat]);
    const place=(piece:CardboardPiece,x:number,y:number,z:number,control?:NativeControl)=>{
      const materials=retainNativeOpacityMaterials(piece,sharedMaterials);
      applyNativeOpacity(materials,menu.opacity);menu.materials.push(...materials);
      const factor=1-z/HUD_DISTANCE;piece.scale.setScalar(this.uiScale*factor);
      piece.setBaseTransform((x-this.width/2)*this.visH/this.height*factor,(this.height/2-y)*this.visH/this.height*factor,z);
      this.hudRoot.add(piece);menu.pieces.push(piece);const hit=this.register(piece,control);if(control)menu.controls.push(hit);
    };
    const background=this.art.createPiece({w:box.width*.01,h:box.height*.01,depth:.046,bevel:.038,uvPadding:1,surface:'panel',textureWidth:Math.ceil(box.width*2),textureHeight:Math.ceil(box.height*2),seed:938,bgColor:PALETTE.creamPaper,interactive:true,
      drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/box.width,hp/box.height);ctx.font=this.font('small',true);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='left';ctx.textBaseline='middle';
        if(box.header)ctx.fillText(page.title,Math.min(30,box.width*.1),box.header/2,box.width-Math.min(30,box.width*.1)-4);
        if(max>0){const thumb=Math.min(box.body.height,Math.max(12,box.body.height*box.body.height/box.contentHeight)),travel=box.body.height-thumb,x=box.width-FLOAT_MENU.scrollbar;
          ctx.fillStyle=NATIVE_INK.scrollTrack;ctx.fillRect(x,box.header,FLOAT_MENU.scrollbar,box.body.height);
          ctx.fillStyle=NATIVE_INK.scrollThumb;ctx.fillRect(x+2,box.header+travel*menu.scroll/max,FLOAT_MENU.scrollbar-4,thumb);}
        ctx.restore();}});
    background.userData.nativeId='float-menu-background';background.userData.nativeStatic=true;
    place(background,box.x+box.width/2,box.y+box.height/2,1.5);
    const tiny=box.rows.length>60,role=tiny?'tiny':'small',inset=tiny?3:FLOAT_MENU.inset,line=NATIVE_LINE[role];
    for(const row of box.rows)for(const option of row.controls){
      const top=option.y-menu.scroll,start=Math.max(0,top),end=Math.min(box.body.height,top+option.height),height=end-start;
      if(height<=0)continue;
      const control=option.control,width=option.width,cut=start-top,lines=wrapNativeText(control.label,Math.max(1,width-2*inset-4),this.measure,NATIVE_TEXT[role]);
      const piece=this.art.createPiece({w:width*.01,h:height*.01,depth:.028,bevel:Math.min(.018,width*.0025,height*.0025),uvPadding:1,textureWidth:Math.max(8,Math.ceil(width*2)),textureHeight:Math.max(8,Math.ceil(height*2)),sharedGeometry:true,seed:this.seed(control.id)%CONTROL_CUT_VARIANTS+1,
        bgColor:control.disabled?PALETTE.kraftLight:control.active?PALETTE.ochre:PALETTE.creamPaper,interactive:true,tooltip:control.hint??control.label,
        drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.translate(0,-cut);ctx.font=this.font(role);ctx.fillStyle=control.disabled?NATIVE_INK.disabled:PALETTE.inkDark;ctx.textAlign='left';ctx.textBaseline='middle';
          const first=option.height/2-(lines.length-1)*line/2;
          lines.forEach((text,index)=>ctx.fillText(text,inset,first+index*line,Math.max(1,width-2*inset-4)));ctx.restore();}});
      piece.userData.nativeId=control.id;piece.userData.nativeStyle='option';piece.userData.nativeDisabled=!!control.disabled;
      place(piece,box.x+option.x+width/2,box.y+box.header+start+height/2,1.56,control);
    }
    this.highlight?.invalidate();this.sceneRevision++;this.invalidate();
  }
  private floatMenuFocus(direction:1|-1):void{
    const menu=this.floatMenu,box=menu?.box;if(!menu||!box)return;
    const options=box.rows.flatMap(row=>row.controls).filter(option=>!option.control.disabled);if(!options.length)return;
    const index=options.findIndex(option=>option.control.id===menu.focus),next=options[index<0?(direction>0?0:options.length-1):(index+direction+options.length)%options.length]!;
    menu.focus=next.control.id;
    if(next.y<menu.scroll)this.setFloatMenuScroll(next.y);
    else if(next.y+next.height>menu.scroll+box.body.height)this.setFloatMenuScroll(next.y+next.height-box.body.height);
    this.hover(menu.controls.find(hit=>hit.control?.id===menu.focus)?.piece??null);
  }
  private pointerDown(event:PointerEvent):void{
    if(this.editor&&event.target===this.editor)return;
    if(this.floatMenuOutside(event)){this.swallow(event);return;}
    const menu=this.floatMenu,menuBox=menu?.box;
    if(menu&&menuBox){
      const x=event.clientX/this.displayScale,y=event.clientY/this.displayScale;
      this.setPointerOverUi(true);this.gesture();this.swallow(event);
      const max=menuBox.contentHeight-menuBox.body.height;
      if(event.button===0&&max>0&&x>=menuBox.x+menuBox.width-FLOAT_MENU.scrollbar&&y>=menuBox.y+menuBox.header){
        const thumb=Math.min(menuBox.body.height,Math.max(12,menuBox.body.height*menuBox.body.height/menuBox.contentHeight)),travel=menuBox.body.height-thumb;
        const relative=y-menuBox.y-menuBox.header,position=travel*menu.scroll/max;
        if(relative<position||relative>position+thumb)this.setFloatMenuScroll((relative-thumb/2)*max/Math.max(1,travel));
        this.floatMenuDrag={pointerId:event.pointerId,y,offset:menu.scroll,travel,max};return;
      }
      const hit=this.hit(event.clientX,event.clientY);
      this.updateHint(hit,event.clientX,event.clientY);
      if(event.button===0&&hit?.control&&!hit.control.disabled&&menu.pieces.includes(hit.piece)){
        this.down={piece:hit.piece,controlId:hit.control.id,pageId:this.page?.id,layout:this.pageBox,pose:new NativeHitPose(hit.piece.userData.interactiveMeshes??[]),pointerId:event.pointerId,x:event.clientX,y:event.clientY};
        hit.piece.userData.pressVal=1;this.moving.add(hit.piece);this.invalidate();
      }
      return;
    }
    if((event.button===1||event.button===2)&&this.cameraWorldPoint(event.clientX,event.clientY)){
      this.clearHint();this.hover(null);this.setPointerOverUi(false);this.worldPress={pointerId:event.pointerId,button:event.button};setNativeCursor(document.documentElement,'grabbing');return;
    }
    if(event.button===0&&this.globeHit(event.clientX,event.clientY)!==null){
      this.clearHint();
      this.gesture();setNativeCursor(document.documentElement,'grabbing');this.setPointerOverUi(true);this.globeDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};this.swallow(event);return;
    }
    const hit=this.hit(event.clientX,event.clientY);
    this.updateHint(hit,event.clientX,event.clientY);
    const box=this.pageBox,x=event.clientX/this.displayScale,y=event.clientY/this.displayScale,inside=this.pageContains(x,y);
    // Map tool palettes keep empty-world presses on the renderer's gesture path.
    // Actual UI hits and release-over-UI cancellation retain their ordinary rules.
    const paletteWorldPress=event.button===0&&event.isPrimary&&!!box&&!hit&&!inside&&this.worldVisible&&!this.frontVisible&&!this.editor&&!this.dropdown&&!this.page?.modal
      &&this.page?.layout==='palette'&&(this.page.palette==='orders'||this.page.palette==='zones');
    // The selection inspector is Core's non-modal inspect pane: a left click in
    // the map selects (or cycles, or clears) through the renderer, which then
    // replaces or closes the inspector, instead of only closing it.
    const inspectorWorldPress=event.button===0&&event.isPrimary&&!!box&&!hit&&!inside&&this.worldVisible&&!this.frontVisible&&!this.editor&&!this.dropdown&&!this.page?.modal
      &&this.page?.layout==='inspector';
    const searchWorldPress=event.button===0&&event.isPrimary&&!!box&&!hit&&!inside&&this.worldVisible&&!this.frontVisible&&!this.dropdown&&this.page?.layout==='map-search';
    if(searchWorldPress&&this.editor)void this.finishEdit(true);
    const outside=!paletteWorldPress&&!inspectorWorldPress&&!searchWorldPress&&event.button===0&&this.page&&this.page.closable!==false&&!this.belongsToPage(hit)&&(!inside||!!hit)?this.page.id:undefined;
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
    this.swallow(event);
    // Right click on a HUD alert card: previous culprit (Core Alert.OnClick).
    if(event.button===2&&!hit.control?.disabled&&typeof hit.piece.userData.onSecondary==='function'){hit.piece.userData.onSecondary();this.invalidate();return;}
    // Right click on a control that has its own secondary meaning (Core work
    // cells and columns), acted on press like Core's MouseDown.
    if(event.button===2&&!hit.control?.disabled&&hit.control?.onSecondary){this.secondary(hit,{shift:event.shiftKey});return;}
    if(event.button!==0)return;
    if(hit.piece.userData.nativeStatic)return;
    if(hit.control?.disabled)return;
    if(hit.control?.paint){const paint=hit.control.paint;this.paintDrag={pointerId:event.pointerId,group:paint.group,indices:new Set([paint.index]),onPaint:paint.onPaint};hit.piece.userData.pressVal=.7;this.moving.add(hit.piece);this.invalidate();return;}
    const id=hit.control?.id??String(hit.piece.userData.nativeId),switchesPage=id.startsWith('tab:')||id.startsWith('map-dock:')||id.startsWith('dev-bar-')||id.startsWith('hud:speed:');
    this.down={piece:hit.piece,controlId:hit.control?.id,outsidePage:switchesPage?undefined:outside,pageId:this.page?.id,layout:this.pageBox,pose:new NativeHitPose(hit.piece.userData.interactiveMeshes??[]),pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    hit.piece.userData.pressVal=1;this.moving.add(hit.piece);this.invalidate();
  }
  private pointerUp(event:PointerEvent):void{
    if(this.dismissedPointer===event.pointerId){this.dismissedPointer=undefined;this.swallow(event);return;}
    if(this.floatMenuDrag){if(this.floatMenuDrag.pointerId===event.pointerId)this.floatMenuDrag=undefined;this.swallow(event);return;}
    if(this.regionDrag){this.regionDrag=undefined;this.updatePointerCursor(this.hit(event.clientX,event.clientY));this.swallow(event);return;}
    if(this.scrollbarDrag){this.scrollbarDrag=undefined;this.updatePointerCursor(this.hit(event.clientX,event.clientY));this.swallow(event);return;}
    if(this.paintDrag){const drag=this.paintDrag;this.paintDrag=undefined;this.swallow(event);if(drag.pointerId===event.pointerId){const values=[...drag.indices],from=Math.min(...values),to=Math.max(...values);void Promise.resolve(drag.onPaint(Array.from({length:to-from+1},(_,i)=>from+i))).catch(error=>this.options.onError(String(error)));}return;}
    if(this.worldPress?.pointerId===event.pointerId){
      const world=this.worldPress;this.worldPress=undefined;this.syncEnvironmentHover();
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
    // Core: the time controls never close the inspect pane (second lot of the windows: V486 hid it).
    if(down.outsidePage&&page?.id===down.outsidePage)this.dismissPage();
    this.activate(hit,false,{shift:event.shiftKey});
  }
  private belongsToPage(hit:Hit|undefined):boolean{if(!hit)return false;if(this.dropdown?.pieces.includes(hit.piece))return true;for(let parent:THREE.Object3D|null=hit.piece;parent;parent=parent.parent)if(parent===this.pageGroup)return true;return false;}
  private dismissPage():void{const page=this.page;if(!page||page.closable===false)return;this.activationSerial++;this.closeDropdown();this.clearHint();try{page.onClose?.();if((!this.frontVisible||!page.onClose)&&!(page.closeOwnsNavigation&&page.onClose))this.options.onEscape();}catch(error){this.options.onError(String(error));}}
  private cancelPress():void{this.down=null;this.dismissedPointer=undefined;this.globeDrag=undefined;this.scrollbarDrag=undefined;this.regionDrag=undefined;this.floatMenuDrag=undefined;this.paintDrag=undefined;if(this.worldPress)this.options.onCancelWorldInteraction?.();this.worldPress=undefined;}
  private globeHit(x:number,y:number):number|null{
    if(!this.globe?.visible||!this.page?.visual)return null;
    const box=this.pageBox,r=box?.visualRect;if(this.page.setupProfile==='site'&&box&&r){const px=x/this.displayScale-box.x,py=y/this.displayScale-box.y;if(px<r.x||px>r.x+r.width||py<r.y||py>r.y+r.height)return null;}
    this.pointer.set(x/(this.width*this.displayScale)*2-1,1-y/(this.height*this.displayScale)*2);this.scene.updateMatrixWorld(true);this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.globe.hitTest(this.raycaster);
  }
  private secondary(hit:Hit,gesture:NativeGesture):void{
    const action=hit.control?.onSecondary;if(!action)return;
    ++this.activationSerial;const id=hit.control!.id;
    if(this.options.allowActivate&&!this.options.allowActivate(id,hit.control)){this.invalidate();return;}
    try{
      this.options.onActivate?.(id);const result=action(gesture),pending=result!=null&&typeof (result as PromiseLike<unknown>).then==='function';
      if(pending){this.pendingActions++;this.updatePointerCursor();}
      void Promise.resolve(result).catch(error=>{if(!this.closed)this.options.onError(error instanceof Error?error.message:String(error));}).finally(()=>{if(pending){this.pendingActions--;if(!this.closed)this.updatePointerCursor(this.hit(this.lastPointer.x*this.displayScale,this.lastPointer.y*this.displayScale));}});
    }catch(error){if(!this.closed)this.options.onError(error instanceof Error?error.message:String(error));}
    this.invalidate();
  }
  private activate(hit:Hit,dismissInspector=false,gesture?:NativeGesture):void{
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
      if(this.options.allowActivate&&!this.options.allowActivate(id,live.control))return;
      if(live.input){this.beginEdit(live);return;}
      if(live.control?.select){this.openDropdown(live);return;}
      const action=live.control?.onActivate??live.piece.userData.onClick;
      if(action){
        if(dismissInspector&&this.page&&this.page.id===pageId&&!this.frontVisible&&!this.page.modal&&this.page.closable!==false){
          this.closeDropdown();this.clearHint();this.options.onHudInspectorDismiss?.();
        }
        if(id)this.options.onActivate?.(id);const result=action(gesture),pending=result!=null&&typeof (result as PromiseLike<unknown>).then==='function';
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
    const width=Math.min(this.width-24,360,Math.max(100,hit.piece.userData.w*scale.x/this.visW*this.width,...select.options.map(option=>this.measure(option.label,NATIVE_TEXT.small)+34)));
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
      const actual=index+state.offset,selected=actual===state.index,piece=this.art.createPiece({w:(box.width-10)*.01,h:.235,uvPadding:1,paper:selected,textureWidth:Math.ceil((box.width-10)*2),textureHeight:47,bgColor:PALETTE.ochre,seed:949+actual,interactive:true,tooltip:option.hint??option.label,drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/(box.width-10),hp/23.5);ctx.textAlign='left';ctx.fillStyle=option.disabled?'#92816a':PALETTE.inkDark;ctx.font=this.font('small');ctx.fillText((option.value===select.value?'✓ ':'')+option.label,7,16,box.width-28);ctx.restore();}});
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
    if(this.floatMenu){
      if(event.key==='Escape'){this.swallow(event);this.closeFloatMenu();return;}
      if(event.key==='Tab'||event.key==='ArrowDown'||event.key==='ArrowUp'){
        this.swallow(event);this.floatMenuFocus(event.key==='ArrowUp'||event.key==='Tab'&&event.shiftKey?-1:1);return;
      }
      if(event.key==='Enter'||event.key===' '){
        this.swallow(event);const hit=this.floatMenu.controls.find(item=>item.control?.id===this.floatMenu?.focus);
        if(hit&&!event.repeat){this.gesture();this.activate(hit,false,{shift:event.shiftKey});}return;
      }
    }
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
    const menu=this.floatMenu,box=menu?.box;
    if(menu&&box&&!pressOutsideFloatMenu(box,event.clientX/this.displayScale,event.clientY/this.displayScale)){
      this.swallow(event);this.setFloatMenuScroll(menu.scroll+(event.deltaMode===1?event.deltaY*NATIVE_LINE.small:event.deltaMode===2?event.deltaY*box.body.height:event.deltaY)/this.displayScale);return;
    }
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
      else if((region==='graph'||this.pageBox?.layout==='table'&&(region==='catalogue'||region==='navigation')||region==='details'&&(this.page?.setupProfile==='pawns'||this.pageBox?.layout==='info'))&&(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))){const target=region==='navigation'?'catalogue':region;this.setHorizontalOffset(target,this.horizontalOffset(target)+(event.shiftKey?event.deltaY:event.deltaX)*unit);}
      else this.setRegionOffset(region,this.regionOffset(region)+event.deltaY*unit);
      this.hover(null);this.rebuildPage(true);this.invalidate();return;
    }
    const hit=this.hit(event.clientX,event.clientY);
    if(hit||this.frontVisible||this.page?.modal){
      this.swallow(event);
      if(hit&&!this.pagePieces.includes(hit.piece)){if(typeof hit.piece.userData.onWheel==='function'&&event.deltaY){hit.piece.userData.onWheel(Math.sign(event.deltaY));this.invalidate();}return;}
      if(hit&&this.wheelCardRegion(hit,event))return;
      if(this.maxScroll<=0)return;
      const delta=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*this.height:event.deltaY;
      const next=THREE.MathUtils.clamp(this.scroll+delta,0,this.maxScroll);
      if(next!==this.scroll){this.scroll=next;this.hover(null);this.rebuildPage(true);this.invalidate();}
    }
  }
  private measure=(text:string,size:number,bold=false):number=>{this.measureContext.font=this.fontPx(size,bold);return this.measureContext.measureText(text).width;};
  private primaryRegion():NativeRegion|undefined{if(this.pageBox?.layout==='menu')return 'navigation';if(this.pageBox?.layout==='setup'||this.pageBox?.layout==='options'||this.pageBox?.layout==='home'||this.pageBox?.layout==='files'||this.pageBox?.layout==='trade'||this.pageBox?.layout==='info'||this.pageBox?.layout==='map-search')return this.pageBox.regions.catalogue?'catalogue':this.pageBox.regions.details?'details':this.pageBox.regions.graph?'graph':'navigation';return this.pageBox?.layout==='storage'||this.pageBox?.layout==='architect'||this.pageBox?.layout==='world'||this.pageBox?.layout==='table'&&this.pageBox.regions.catalogue?'catalogue':this.pageBox?.layout==='research'||this.pageBox?.layout==='quests'||this.pageBox?.layout==='history'?'details':undefined;}
  private horizontalOffset(region?:NativeRegion):number{return region==='graph'?this.graphX:region==='details'&&(this.page?.setupProfile==='pawns'||this.pageBox?.layout==='info')?this.setupDetailsX:region==='catalogue'&&(this.pageBox?.layout==='palette'||this.pageBox?.layout==='table')?this.paletteX:0;}
  private setHorizontalOffset(region:NativeRegion|undefined,value:number):void{const rect=region?this.pageBox?.regions[region]:undefined,next=THREE.MathUtils.clamp(value,0,Math.max(0,(rect?.contentWidth??rect?.width??0)-(rect?.width??0)));if(region==='graph')this.graphX=next;else if(region==='details'&&(this.page?.setupProfile==='pawns'||this.pageBox?.layout==='info'))this.setupDetailsX=next;else if(region==='catalogue'&&(this.pageBox?.layout==='palette'||this.pageBox?.layout==='table'))this.paletteX=next;}
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
    if(!row&&box.layout==='map-search'){
      const entry=page.rows.find(row=>row.controls?.some(control=>control.id===next.id))?.mapSearchEntry;
      if(entry){this.setRegionOffset('catalogue',entry.index*NATIVE_MAP_SEARCH.rowHeight);this.rebuildPage(true);}
    }
    if(row){
      const control=row.controls.find(control=>control.control.id===next.id),rect=(control?.region&&box.regions[control.region])||this.rowViewport(row.row),top=box.header+(control?.y??row.inputRect?.y??row.top),height=control?.height??row.inputRect?.height??(row.row.input?26:row.height),offset=this.rowOffset(row.row);
      if(top-offset<rect.y)this.setRegionOffset(row.row.region,top-rect.y-4);else if(top+height-offset>rect.y+rect.height)this.setRegionOffset(row.row.region,top+height-rect.y-rect.height+4);
      if(!control?.region&&(row.row.region==='graph'||box.layout==='palette'||box.layout==='table'&&row.row.region==='catalogue'||row.row.region==='details'&&(page.setupProfile==='pawns'||box.layout==='info'))){const left=control?.x??row.inputRect?.x??row.x,width=control?.width??row.inputRect?.width??Math.min(row.width,rect.width),offsetX=this.horizontalOffset(row.row.region);if(left-offsetX<rect.x)this.setHorizontalOffset(row.row.region,left-rect.x-4);else if(left+width-offsetX>rect.x+rect.width)this.setHorizontalOffset(row.row.region,left+width-rect.x-rect.width+4);}
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
    for(const selected of [false,true])for(const link of graph.links){
      if((link.from===graph.selected||link.to===graph.selected)!==selected)continue;
      for(let i=1;i<link.path.length;i++){const a=link.path[i-1]!,b=link.path[i]!;drawMarkerLine(ctx,a.x,a.y,b.x,b.y,selected?'#986b2e':'#7b7259',selected?4:2,rng);}
    }
    ctx.restore();
  }
  private drawScrollbars(box:NativePageBox):void{
    const primary=this.primaryRegion(),regions:Array<[NativeRegion|undefined,NativeRegionBox]>=Object.entries(box.regions).length?Object.entries(box.regions) as [NativeRegion,NativeRegionBox][]:[[undefined,{...box.body,contentHeight:box.contentHeight}]];
    if(box.inspectorParts)regions.unshift([undefined,{...box.body,contentHeight:box.contentHeight}]);
    for(const [region,rect]of regions){
      if(box.layout==='table'&&region==='navigation'&&box.regions.catalogue)continue;
      const axes:('x'|'y')[]=region==='graph'||region==='catalogue'&&box.layout==='table'||region==='details'&&(this.page?.setupProfile==='pawns'||box.layout==='info')?['y','x']:box.layout==='palette'?['x']:['y'];
      for(const axis of axes){
        const length=axis==='x'?rect.width:rect.height,content=axis==='x'?(rect.contentWidth??length):rect.contentHeight,max=Math.max(0,content-length);if(max<=0||length<=0)continue;
        const thumb=Math.min(length,Math.max(28,length*length/content)),travel=length-thumb,offset=axis==='x'?this.horizontalOffset(region):this.regionOffset(region),primaryId=axis==='y'&&(!region||region===primary);
        const base=primaryId?'native-scroll':'native-scroll:'+region+(axis==='x'?':x':''),trackId=primaryId?'native-scrollbar':base+':track',thumbId=primaryId?'native-scroll-thumb':base+':thumb';
        const thickness=NATIVE_WINDOW.scrollbar,start=axis==='x'?rect.x:rect.y,cross=(axis==='x'?rect.y+rect.height:rect.x+rect.width)+thickness/2;
        const place=(id:string,isThumb:boolean)=>{
          const size=isThumb?thumb:length,position=start+(isThumb?(max?travel*offset/max:0):0)+size/2;
          const cx=axis==='x'?position:cross,cy=axis==='x'?cross:position;
          const piece=this.pagePiece(id,{w:(axis==='x'?size:thickness)*.01,h:(axis==='x'?thickness:size)*.01,paper:isThumb,uvPadding:1,textureWidth:axis==='x'?Math.ceil(size*2):thickness*2,textureHeight:axis==='x'?thickness*2:Math.ceil(size*2),depth:.012,bgColor:PALETTE.sageMountain,seed:411,interactive:true,drawFn:isThumb?()=>{}:(ctx,w,h)=>{ctx.fillStyle='rgba(68,50,29,.2)';ctx.fillRect(0,0,w,h);}},String(size),(cx-box.width/2)*.01,(box.height/2-cy)*.01,isThumb?0.12:0.1);
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
    if(page?.layout==='map-search'){
      // The search owner publishes immutable page objects. Scrolling renders
      // a visible slice; don't serialize thousands of off-screen callbacks/
      // records again just to decide whether that slice changed.
      if(this.mapSearchInkPage!==page){this.mapSearchInkPage=page;this.mapSearchInkRevision=(this.mapSearchInkRevision??0)+1;}
      return JSON.stringify(['map-search',this.mapSearchInkRevision,this.textFontRevision,this.textEntityRevision,this.width,this.height,this.displayScale,this.bottomDockHeight,this.scroll]);
    }
    return page?JSON.stringify([page.id,page.floatMenu,page.contentKey,page.detailsKey,page.title,page.subtitle,page.width,page.height,page.layout,page.tableProfile,page.setupCatalogueWidth,page.setupProfile,page.setupAnchor,page.palette,page.research,page.infoCard,page.inspectTab,page.historyMode,page.columnRatio,page.portrait?.url,page.visual?.selected,page.visual?.markers,page.rows.map(row=>this.rowInk(row)),page.actions?.map(control=>this.controlInk(control)),page.closable,this.textFontRevision,this.textEntityRevision,this.frontVisible,this.width,this.height,this.displayScale,this.bottomDockHeight,this.scroll,this.regionOffsets,this.graphX,this.paletteX,this.setupDetailsX,cardScrollKey()]):'';
  }
  private rebuildPage(force=false):void{
    const page=this.page;
    // Page controls are rebound or rebuilt: highlighted ones are looked up again.
    if(page||this.pageControls.length)this.highlight?.invalidate();
    const entities=page?.textEntities??this.sharedTextEntities;
    if(entities!==this.inkTextEntities){this.inkTextEntities=entities;this.textEntityRevision++;this.semanticInk.clear();}
    this.textLexicon=createNativeTextLexicon(entities);
    const signature=this.pageInkSignature(page);
    if(!force&&signature===this.pageSignature){this.rebindPage(page);return;}
    if(this.rowHighlight)this.rowHighlight.visible=false;
    const focused=this.pageControls.filter(hit=>!hit.control?.disabled)[this.focusIndex],focusedId=focused?focused.control?.id??String(focused.piece.userData.nativeId):undefined;
    this.pageSignature=signature;this.pagePieceIds=new Set();this.pagePieces.length=0;this.pageControls=[];this.pageBackdrop=undefined;
    if(this.globe&&this.globe.visible!==!!page?.visual){this.globe.visible=!!page?.visual;this.sceneRevision++;}
    if(!page){this.pageBox=undefined;this.retirePagePieces();this.focusIndex=-1;if(this.options.onWindowLayout?.(null))this.sceneRevision++;return;}
    this.stats.rebuilds++;
    const viewport={width:this.width,height:this.height-(this.frontVisible?0:Math.max(0,this.bottomDockHeight-NATIVE_UI.bottom))};
    const measure=(text:string,size:number,bold?:boolean)=>this.measure(text,size,bold??true);
    // A float menu's anchor is the click in CSS pixels; the layout works in stage units.
    const laid=page.floatMenu?{...page,floatMenu:{x:page.floatMenu.x/this.displayScale,y:page.floatMenu.y/this.displayScale}}:page;
    let box=layoutNativePage(laid,viewport,this.frontVisible,measure,page.layout==='map-search'?this.scroll:0);
    // Preserve the direct time/view controls beside near-fullscreen windows.
    // Shorter windows can keep their requested width and move the entire dock
    // above them. At very large scales the HUD owner handles lack of room as
    // one whole group, never as fragments of individual cards.
    // A float menu stays at the mouse (Core FloatMenu, WindowLayer.Super).
    if(!this.frontVisible&&!page.floatMenu&&this.options.onWindowLayout&&box.layout!=='palette'&&box.layout!=='menu'&&box.layout!=='message'&&box.layout!=='trade'&&box.layout!=='info'&&box.layout!=='map-search'&&this.width>=720&&box.x+box.width>this.width-NATIVE_RIGHT_DOCK_WIDTH&&box.y<118+197+10)
      box=layoutNativePage(laid,{...viewport,width:this.width-NATIVE_RIGHT_DOCK_WIDTH},false,measure);
    this.pageBox=box;if(this.options.onWindowLayout?.(this.frontVisible||box.layout==='palette'||page.floatMenu?null:box))this.sceneRevision++;
    if(box.layout==='palette'){const index=page.palette==='orders'?0:1,piece=this.toolsDock.children[index] as CardboardPiece;box.y=this.height-8-piece.userData.basePos.y*100-box.height/2;}
    const k=.01,w=box.width*k,h=box.height*k,margin=12;
    const z=.18,factor=1-z/HUD_DISTANCE;
    this.pageGroup.scale.setScalar(this.uiScale*factor);
    this.pageGroup.position.set((box.x+box.width/2-this.width/2)*this.visH/this.height*factor,(this.height/2-box.y-box.height/2)*this.visH/this.height*factor,z);
    this.maxScroll=Math.max(0,box.contentHeight-box.body.height);this.scroll=THREE.MathUtils.clamp(this.scroll,0,this.maxScroll);
    for(const [key,rect]of Object.entries(box.regions)){
      const region=key as NativeRegion;if(region==='graph'||box.layout==='palette'||region==='catalogue'&&box.layout==='table'||region==='details'&&(page.setupProfile==='pawns'||box.layout==='info'))this.setHorizontalOffset(region,this.horizontalOffset(region));
      this.setRegionOffset(region,this.regionOffset(region));
    }
    const focus=page.research?.focus,graph=box.regions.graph;
    if(focus&&graph&&focus.key!==this.researchFocusKey){
      this.researchFocusKey=focus.key;
      this.setHorizontalOffset('graph',focus.x+(NATIVE_RESEARCH.nodeWidth-graph.width)/2);
      this.setRegionOffset('graph',focus.y+(NATIVE_RESEARCH.nodeHeight-graph.height)/2);
      this.pageSignature=this.pageInkSignature(page);
    }
    const infoFocus=page.infoCard?.focusRow,catalogue=box.regions.catalogue,infoKey=infoFocus?JSON.stringify([page.id,page.contentKey,infoFocus]):undefined;
    if(infoKey&&infoKey!==this.infoFocusKey&&catalogue){
      this.infoFocusKey=infoKey;const target=box.rows.find(row=>row.row.id===infoFocus&&row.row.region==='catalogue');
      if(target)this.setRegionOffset('catalogue',box.header+target.top-catalogue.y-(catalogue.height-target.height)/2);
      this.pageSignature=this.pageInkSignature(page);
    }
    const visible=box.rows.filter(r=>this.rowVisible(r)),sheet=box.inspectorParts?.sheet??{x:0,y:0,width:box.width,height:box.height};
    // The inspect pane's open tab is its own window (no title, Core ITab);
    // without an open tab there is no sheet at all.
    const composite=!!box.inspectorParts,openSite=page.setupProfile==='site'&&!!page.visual;
    const paintRows=(ctx:CanvasRenderingContext2D,rng:()=>number)=>{
      for(const r of visible){if(r.row.graphNode)continue;const top=box.header+r.top-this.rowOffset(r.row),nameBand=this.rowNameViewport(r.row);
        if(nameBand){ctx.save();ctx.beginPath();ctx.rect(nameBand.x,nameBand.y,nameBand.width,nameBand.height);ctx.clip();this.drawMatrixName(ctx,r,top);ctx.restore();}
        const region=this.rowViewport(r.row);ctx.save();ctx.beginPath();ctx.rect(region.x,region.y,region.width,region.height);ctx.clip();ctx.translate(-this.horizontalOffset(r.row.region),0);this.drawPageRow(ctx,r,top,rng,box);ctx.restore();}
    };
    if(openSite){
      // No opaque full-screen sheet or full-screen texture upload per site
      // selection. Only the two small paper panels are painted; the globe
      // and illustrated backdrop are free in their own resident layers.
      const panel=(id:string,r:NativeRect,ink:string,draw:CardboardDraw)=>{
        const piece=this.pagePiece(id,{w:r.width*k,h:r.height*k,cacheBackground:true,surface:'panel',uvPadding:1,bevel:.038,
          textureWidth:Math.min(4096,Math.ceil(r.width*2)),textureHeight:Math.min(4096,Math.ceil(r.height*2)),bgColor:'#f1e7cf',seed:2003,depth:.046,interactive:true,
          drawFn:(ctx,wp,hp,rng)=>{ctx.save();ctx.scale(wp/r.width,hp/r.height);ctx.translate(-r.x,-r.y);draw(ctx,wp,hp,rng);ctx.restore();}},ink,(r.x+r.width/2-box.width/2)*k,(box.height/2-r.y-r.height/2)*k,0);
        piece.userData.nativeStatic=true;this.pageGroup.add(piece);return piece;
      };
      const titleRect={x:6,y:4,width:Math.max(1,Math.min(box.width-12,this.measure(page.title,NATIVE_TEXT.medium)+60)),height:42};
      panel('page:site-title',titleRect,JSON.stringify([page.title,this.textFontRevision]),(ctx,_w,_h,rng)=>{
        ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font('medium');ctx.textAlign='left';ctx.fillText(page.title,margin,27,Math.max(1,titleRect.width-2*margin));
        drawMarkerLine(ctx,margin,35,titleRect.x+titleRect.width-margin,35,'#b58b4a',1.3,rng);
      });
      const details=box.regions.details;if(details&&details.width>0&&details.height>0)this.pageBackdrop=panel('page:'+page.id,details,signature,(ctx,_w,_h,rng)=>paintRows(ctx,rng));
      if(page.closable!==false)this.control(this.closeControl(),w/2-.25,h/2-.23,.32,.32,.07);
    }else if(box.layout!=='palette'&&sheet.height>0){
    const background=this.pagePiece('page:'+page.id,{w:sheet.width*k,h:sheet.height*k,cacheBackground:true,surface:'panel',uvPadding:1,bevel:.038,textureWidth:Math.ceil(sheet.width*2),textureHeight:Math.ceil(sheet.height*2),bgColor:'#f1e7cf',seed:2003,depth:.046,interactive:true,
      drawFn:(ctx,wp,hp,rng)=>{
        ctx.save();ctx.scale(wp/sheet.width,hp/sheet.height);ctx.translate(-sheet.x,-sheet.y);ctx.textAlign='left';ctx.fillStyle=PALETTE.inkDark;ctx.font=this.font('medium');
        if(box.infoParts){
          const {title,icon}=box.infoParts;
          drawNativeActionIconInBox(ctx,page.infoCard?.icon??'information',icon.x,icon.y,icon.width,icon.height,NATIVE_INK.text);
          ctx.fillText(page.title,title.x,title.y+title.height/2+NATIVE_TEXT.medium*.34,title.width);
        }else if(!composite&&box.layout!=='map-search'){
        const title=page.title;
        ctx.fillText(title,margin,27,box.width-margin*2-(page.portrait&&!box.portraitRect?74:28));
        drawMarkerLine(ctx,margin,35,Math.min(box.width-48,margin+this.measure(title,NATIVE_TEXT.medium)+22),35,'#b58b4a',1.3,rng);
        }
        if(page.subtitle&&!box.inspectorParts){ctx.font=this.font('small');ctx.fillStyle='#66583f';wrapNativeText(page.subtitle,box.width-margin*2-(page.portrait&&!box.portraitRect?62:0),this.measure,NATIVE_TEXT.small).slice(0,2).forEach((line,index)=>ctx.fillText(line,margin,55+index*17));}
        if(box.layout==='info'&&box.regions.catalogue&&box.regions.details){const right=box.regions.details;ctx.fillStyle=NATIVE_INK.panelFill;ctx.fillRect(right.x-4,right.y-4,right.width+8,right.height+8);}
        paintRows(ctx,rng);
        this.drawResearchLinks(ctx,box,rng);
        if(box.layout==='architect'||box.layout==='research'){ctx.strokeStyle='rgba(82,62,39,.25)';ctx.lineWidth=1;for(const rect of Object.values(box.regions)){if(rect.x<=12)continue;ctx.beginPath();ctx.moveTo(rect.x-7,rect.y);ctx.lineTo(rect.x-7,rect.y+rect.height);ctx.stroke();}}
        ctx.restore();
      }},signature,(sheet.x+sheet.width/2-box.width/2)*k,(box.height/2-sheet.y-sheet.height/2)*k,0);
    background.userData.nativeStatic=true;this.pageBackdrop=background;this.pageGroup.add(background);
    if(page.closable!==false&&!composite){
      if(box.infoParts||box.layout==='map-search'){const size=NATIVE_WINDOW.close*k,offset=(NATIVE_WINDOW.closeMargin+NATIVE_WINDOW.close/2)*k;this.control(this.closeControl(),w/2-offset,h/2-offset,size,size,.07);}
      else this.control(this.closeControl(),w/2-.25,h/2-.23,.32,.32,.07);
    }
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
      if(r.bio)this.bioTargets(r,box,cy-r.height/2,group);
      if(r.card)this.cardTargets(r,box,cy-r.height/2,group);
      const hint=row.bio||row.card?undefined:this.rowHint(row);
      if(hint&&!row.graphNode){
        const nameBand=box.layout==='table'&&row.region==='catalogue'?box.regions.navigation:undefined,width=nameBand?.width??r.width,left=nameBand?.x??r.x-this.horizontalOffset(row.region);
        const piece=this.pagePiece('row-hint:'+row.id,{w:width*k,h:r.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},hint,(left+width/2-box.width/2)*k,(box.height/2-cy)*k,.025);
        piece.userData.tooltip=hint;piece.userData.nativeStatic=true;(nameBand?this.regionGroups.navigation:group).add(piece);
      }
      if(row.columns){
        const columns=nativeMatrixColumns(row,r.x,r.width,row.columns.length,r.matrixTail,box.matrixSpec??box.matrixColumnWeights);
        // A header column with a control is interactive (Core work columns:
        // click sorts, Shift-click sets the column); others only carry a hint.
        row.columns.forEach((column,index)=>{const cell=columns[index]!,hint=column.control?.hint??column.hint??column.label,hintPiece=this.pagePiece(column.control?.id??'column:'+row.id+':'+index,{w:cell.width*k,h:r.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},hint,(cell.x-this.horizontalOffset(row.region)+cell.width/2-box.width/2)*k,(box.height/2-cy)*k,.04,column.control);if(!column.control)hintPiece.userData.nativeStatic=true;hintPiece.userData.tooltip=hint;group.add(hintPiece);});
      }
      const controls=row.controls??[];
      let graphCard:CardboardPiece|undefined;const graphInset=r.controls.find(control=>control.style==='icon'),graphMain=r.controls.find(control=>control.style==='research'||control.style==='card');
      for(const cb of r.controls){
        const region=(cb.region&&box.regions[cb.region])||this.rowViewport(row),left=cb.x-this.horizontalOffset(cb.region??row.region),ct=box.header+cb.y-offset;
        if(left+cb.width<=region.x||left>=region.x+region.width||ct+cb.height<=region.y||ct>=region.y+region.height)continue;
        if(cb.hitOnly){
          const control=this.rowControl(row,cb.control),hint=control.hint??control.label;
          const piece=this.pagePiece(control.id,{w:cb.width*k,h:cb.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},hint,
            (left+cb.width/2-box.width/2)*k,(box.height/2-ct-cb.height/2)*k,.04,control);
          piece.userData.tooltip=hint;piece.userData.nativeHighlight=true;piece.userData.nativeRegion=cb.region??row.region;
          (cb.region?this.regionGroup(cb.region):group).add(piece);continue;
        }
        if(cb.style==='icon'&&graphCard&&graphMain){
          const hit:Hit={piece:graphCard,control:cb.control,region:{x:(cb.x-graphMain.x-graphMain.width/2)*k,y:(graphMain.y+graphMain.height/2-cb.y-cb.height)*k,width:cb.width*k,height:cb.height*k}};
          this.insetControls.set(graphCard,[hit]);this.pageControls.push(hit);continue;
        }
        const piece=this.control(this.rowControl(row,cb.control),(left+cb.width/2-box.width/2)*k,(box.height/2-ct-cb.height/2)*k,cb.width*k,cb.height*k,.065,cb.style,cb.style==='research'?row.graphNode:undefined,cb.style==='research'||cb.style==='card'?graphInset?.control:undefined);
        if(cb.style==='research'||cb.style==='card'){graphCard=piece;this.insetControls.delete(piece);}
        piece.userData.nativeRegion=cb.region??row.region;(cb.region?this.regionGroup(cb.region):group).add(piece);
      }
      if(row.input){
        // In a Bio card the field fills the name zone, left of its buttons (x 395).
        const rightControls=controls.length?controls.length*28+6:0,inputW=r.inputRect?.width??(r.bio?(r.bio.buttons[0]?.rect.x??r.width)-16:Math.max(70,r.width-r.labelWidth-rightControls-8)),inputH=r.inputRect?.height??25;
        const inputX=r.inputRect?r.inputRect.x-this.horizontalOffset(row.region):r.x+r.labelWidth+8,inputY=r.inputRect?box.header+r.inputRect.y-offset:top+15-inputH/2;
        const piece=this.pagePiece(row.id,{w:inputW*k,h:inputH*k,uvPadding:1,textureWidth:Math.ceil(inputW*2),textureHeight:Math.ceil(inputH*2),bgColor:'#fff9eb',seed:3007,depth:.018,interactive:true,
          drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/inputW,hp/inputH);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='left';ctx.font=this.font('small');ctx.fillText(row.input!.value||row.input!.placeholder||'',7,inputH/2+4.5,inputW-14);ctx.restore();}},JSON.stringify([row.input.value,row.input.placeholder,this.textFontRevision]),(inputX+inputW/2-box.width/2)*k,(box.height/2-inputY-inputH/2)*k,.08,undefined,row.input);
        piece.userData.nativeRegion=row.region;group.add(piece);
      }
    }
    this.drawScrollbars(box);
    for(const action of box.actions){const piece=this.control(action.control,(action.x+action.width/2-box.width/2)*k,(box.height/2-box.header-action.y-action.height/2)*k,action.width*k,action.height*k,.09,action.style);if(box.layout==='storage')this.pageFooter.add(piece);}
    if(page.visual){
      this.globe??=new NativeGlobe(tile=>{try{this.options.onActivate?.('world:select-tile');this.page?.visual?.onSelect(tile);}catch(error){this.options.onError(String(error));}});
      (openSite?this.regionGroups.graph:this.pageGroup).add(this.globe);this.globe.visible=true;const visualWidth=nativeVisualWidth(page,box.width);
      const globeRect=box.visualRect??{x:12,y:box.header,width:visualWidth,height:box.body.height};
      this.globe.position.set((-box.width/2+globeRect.x+globeRect.width/2)*k,(box.height/2-globeRect.y-globeRect.height/2)*k,.35);
      this.globe.scale.setScalar(Math.min(globeRect.width*.44,globeRect.height*.43)*k);
      this.globe.setSurface(page.visual.surface,page.visual.roads);this.globe.setSelected(page.visual.selected);this.globe.setMarkers((page.visual.markers??[]).map(marker=>({...marker,label:marker.label??('Case '+marker.tile)})));this.sceneRevision++;
    }
    if(box.inspectorParts)this.drawInspectPane(page,box);
    if(page.portrait&&(!box.inspectorParts||box.portraitRect)){
      const source=page.portrait.url,image=this.portraitImage(source);
      if(image.complete&&image.naturalWidth){const portrait=image,rect=box.portraitRect;const piece=this.pagePiece('page:portrait',{w:rect?rect.width*k:.43,h:rect?rect.height*k:.47,depth:.018,bgColor:PALETTE.kraftBase,seed:2081,drawFn:(ctx,wp,hp)=>ctx.drawImage(portrait,0,0,wp,hp)},source,rect?(rect.x+rect.width/2-box.width/2-this.horizontalOffset('details'))*k:w/2-.7,rect?(box.height/2-rect.y+this.regionOffset('details')-rect.height/2)*k:h/2-.32,.07);if(rect)this.regionGroup('details').add(piece);}
    }
    if(this.portraitImages.size>24){const active=new Set([page.portrait?.url,...page.rows.flatMap(row=>row.controls?.map(control=>control.portraitUrl)??[])]);for(const [url,old]of this.portraitImages){if(active.has(url))continue;old.onload=null;old.onerror=null;this.portraitImages.delete(url);if(this.portraitImages.size<=16)break;}}
    this.retirePagePieces();this.focusIndex=focusedId===undefined?-1:this.pageControls.filter(hit=>!hit.control?.disabled).findIndex(hit=>(hit.control?.id??String(hit.piece.userData.nativeId))===focusedId);
    if(this.editingPaintDirty){this.editingPaintDirty=false;this.editRepaint?.();}
    this.rebindPage(page);
    this.scene.updateMatrixWorld(true);
  }
  private portraitImage(source:string):HTMLImageElement{
    let image=this.portraitImages.get(source);if(image)return image;
    image=new Image();this.portraitImages.set(source,image);
    image.onload=()=>{
      const page=this.page;if(this.closed||!page||page.portrait?.url!==source&&!page.rows.some(row=>row.controls?.some(control=>control.portraitUrl===source))||this.portraitRepaintQueued)return;
      this.portraitRepaintQueued=true;queueMicrotask(()=>{this.portraitRepaintQueued=false;if(!this.closed&&this.page){this.rebuildPage(true);this.invalidate();}});
    };image.src=source;return image;
  }
  /** Core inspect pane (`InspectPaneUtility`, `InspectPaneFiller`): the name
   * in Medium, gauges of 93 × 16 with Tiny labels, then the inspect lines in
   * Small. One paper piece repainted only when its ink changes; the gauges and
   * lines carry hit planes (tooltip, or the allowed area's list). */
  private drawInspectPane(page:NativePage,box:NativePageBox):void{
    const parts=box.inspectorParts!,pane=parts.summary,k=.01;
    const ink=JSON.stringify([page.title,parts.gauges?.map(({gauge})=>[gauge.label,Math.round(gauge.fill*200),gauge.color]),parts.lines?.map(line=>line.lines),this.textFontRevision]);
    this.pagePiece('page:summary',{w:pane.width*k,h:pane.height*k,uvPadding:1,depth:.046,bevel:.038,surface:'panel',bgColor:PALETTE.creamPaper,seed:2080,cacheBackground:true,textureWidth:Math.ceil(pane.width*2),textureHeight:Math.ceil(pane.height*2),drawFn:(ctx,wp,hp,rng)=>{
      ctx.save();ctx.scale(wp/pane.width,hp/pane.height);ctx.translate(-pane.x,-pane.y);ctx.textAlign='left';
      if(parts.name){ctx.font=this.font('medium');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(page.title,parts.name.x,parts.name.y+NATIVE_TEXT.medium,parts.name.width);}
      for(const {gauge,rect} of parts.gauges??[]){
        ctx.fillStyle=NATIVE_INK.gaugeBack;ctx.fillRect(rect.x,rect.y,rect.width,rect.height);
        ctx.fillStyle=gauge.color;ctx.fillRect(rect.x,rect.y,rect.width*THREE.MathUtils.clamp(gauge.fill,0,1),rect.height);
        drawHandRect(ctx,rect.x,rect.y,rect.width,rect.height,null,PALETTE.inkDark,.8,rng);
        ctx.font=this.font('tiny');ctx.textAlign='center';ctx.fillStyle=NATIVE_INK.text;ctx.fillText(gauge.label,rect.x+rect.width/2,rect.y+rect.height/2+NATIVE_TEXT.tiny*.36,rect.width-4);ctx.textAlign='left';
      }
      for(const line of parts.lines??[])line.lines.forEach((text,index)=>this.semanticText(ctx,text,line.rect.x,line.rect.y+index*NATIVE_LEADING+NATIVE_TEXT.small,line.rect.width,NATIVE_TEXT.small));
      ctx.restore();
    }},ink,(pane.x+pane.width/2-box.width/2)*k,(box.height/2-pane.y-pane.height/2)*k,.025).userData.nativeStatic=true;
    const target=(id:string,rect:NativeRect,hint:string,control?:NativeControl)=>{
      const piece=this.pagePiece(id,{w:rect.width*k,h:rect.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},hint,(rect.x+rect.width/2-box.width/2)*k,(box.height/2-rect.y-rect.height/2)*k,.04,control);
      piece.userData.tooltip=hint;if(!control)piece.userData.nativeStatic=true;
    };
    for(const {gauge,rect} of parts.gauges??[])target(gauge.select?'pane-gauge:'+gauge.id:'pane-gauge-hint:'+gauge.id,rect,gauge.hint,gauge.select?{id:'pane-gauge:'+gauge.id,label:gauge.label,hint:gauge.hint,select:gauge.select,onActivate:()=>{}}:undefined);
    for(const line of parts.lines??[]){const hint=this.rowHint(line.row);if(hint)target('pane-line:'+line.row.id,line.rect,hint);}
  }
  /** Tooltip planes over the Bio card's chips and skill rows, and the faction
   * chip's click (Core opens the Factions tab). */
  private bioTargets(r:NativeRowBox,box:NativePageBox,rowTop:number,group:THREE.Object3D):void{
    const k=.01;
    for(const target of nativeBioTargets(r.bio!)){
      const rect=target.rect,x=r.x+rect.x-this.horizontalOffset(r.row.region),y=rowTop+rect.y;
      const control:NativeControl|undefined=target.onActivate?{id:'bio:'+target.id,label:target.id,hint:target.hint,onActivate:target.onActivate}:undefined;
      const piece=this.pagePiece('bio:'+target.id,{w:rect.width*k,h:rect.height*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},target.hint,(x+rect.width/2-box.width/2)*k,(box.height/2-y-rect.height/2)*k,.03,control);
      piece.userData.tooltip=target.hint;piece.userData.nativeHighlight=true;if(!control)piece.userData.nativeStatic=true;group.add(piece);
    }
  }
  /** Hit planes over an inspector-tab card (Core's tooltips, the clickable
   * rows and buttons, the scroll regions' wheel areas). */
  private cardTargets(r:NativeRowBox,box:NativePageBox,rowTop:number,group:THREE.Object3D):void{
    const k=.01;
    for(const target of nativeTabTargets(r.card!)){
      const x=r.x+target.x-this.horizontalOffset(r.row.region),y=rowTop+target.y,wheel=target.id.startsWith('region:');
      const control:NativeControl|undefined=target.control;
      const piece=this.pagePiece('card:'+target.id,{w:target.w*k,h:target.h*k,paper:false,hitOnly:true,interactive:true,drawFn:()=>{}},target.hint??'',(x+target.w/2-box.width/2)*k,(box.height/2-y-target.h/2)*k,wheel?.02:.03,control);
      if(target.hint)piece.userData.tooltip=target.hint;
      if(target.highlight)piece.userData.nativeHighlight=true;
      if(target.region)piece.userData.cardRegion=target.region;
      piece.userData.nativeRegion=r.row.region;
      if(!control)piece.userData.nativeStatic=true;
      group.add(piece);
    }
  }
  /** Wheel over a card's scroll region: moves it, never the page. */
  private wheelCardRegion(hit:Hit,event:WheelEvent):boolean{
    if(this.pageBox?.layout==='info'&&(event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)))return false;
    const id=hit.piece.userData.cardRegion as string|undefined;if(!id)return false;
    const card=this.pageBox?.rows.find(row=>row.card)?.card;if(!card)return false;
    const unit=event.deltaMode===1?18:event.deltaMode===2?this.height:1,region=card.regions.find(entry=>entry.id===id);if(!region)return false;
    const current=Math.min(cardScroll(id),Math.max(0,region.contentHeight-region.h));
    if(setCardScroll(card,id,current+event.deltaY*unit)){this.hover(null);this.rebuildPage(true);this.invalidate();}else if(this.pageBox?.layout==='info')return false;
    return true;
  }
  private showRowHighlight(piece:CardboardPiece|null):void{
    const parent=piece?.parent;
    if(!piece||!parent){if(this.rowHighlight?.visible){this.rowHighlight.visible=false;this.invalidate();}return;}
    this.rowHighlight??=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:new THREE.Color(NATIVE_INK.highlightPlane),transparent:true,opacity:.16,depthWrite:false}));
    const plane=this.rowHighlight;if(plane.parent!==parent)parent.add(plane);
    plane.position.set(piece.position.x,piece.position.y,piece.position.z+.002);plane.scale.set(piece.userData.w,piece.userData.h,1);plane.visible=true;this.invalidate();
  }
  /** Inside a visible part of the page: the whole box, or only the inspect
   * pane's actual pieces (open tab, tabs, pane, gizmos). */
  private pageContains(x:number,y:number):boolean{
    const box=this.pageBox;if(!box)return false;
    const inside=(rect:NativeRect)=>x>=box.x+rect.x&&x<=box.x+rect.x+rect.width&&y>=box.y+rect.y&&y<=box.y+rect.y+rect.height;
    const parts=box.inspectorParts;if(!parts)return inside({x:0,y:0,width:box.width,height:box.height});
    return inside(parts.sheet)||inside(parts.tabs)||inside(parts.summary)||box.actions.some(action=>inside({x:action.x,y:box.header+action.y,width:action.width,height:action.height}));
  }
  /** PawnTable headings: the work label is written whole above a vertical line of
   * 2 (every other label lowered by 20), the other headings wrap by words only. */
  private drawPawnTableHeading(ctx:CanvasRenderingContext2D,r:NativeRowBox,top:number,labels:readonly string[],columns:readonly NativeRect[],work:boolean):void{
    ctx.textAlign='center';ctx.font=this.font('small',true);
    labels.forEach((label,index)=>{
      const cell=columns[index]!,cx=cell.x+cell.width/2;
      if(work&&index>=2){
        const y=top+(workLabelDown(index-2)?PAWN_TABLE.workLabelShift:0);ctx.fillStyle=PALETTE.inkDark;ctx.fillText(label,cx,y+16);
        ctx.fillStyle='rgba(58,44,29,.3)';const from=y+PAWN_TABLE.headerLine-3;ctx.fillRect(cx-1,from,2,top+r.height-from);return;
      }
      ctx.fillStyle=PALETTE.inkDark;
      const lines=wrapNativeText(label,Math.max(1,cell.width-2),(value,size)=>this.measure(value,size,true),NATIVE_TEXT.small).slice(0,2);
      lines.forEach((line,i)=>ctx.fillText(line,cx,top+r.height/2+4+(i-(lines.length-1)/2)*15,cell.width));
    });
    ctx.textAlign='left';
  }
  private drawMatrixName(ctx:CanvasRenderingContext2D,r:NativeRowBox,top:number):void{
    const nameWidth=(this.pageBox?.matrixSpec?.name??104)-6;
    const faction=r.row.factionEntry;
    if(faction){
      const f=NATIVE_FACTIONS,left=r.x+Math.min(f.iconX,nameWidth*.13),size=Math.min(f.iconSize,nameWidth*.23),textX=r.x+Math.min(f.identityX,left-r.x+size+24),w=Math.max(1,nameWidth-(textX-r.x));
      drawNativeActionIconInBox(ctx,'pen-marker',left,top+(r.height-size)/2,size,size,faction.color);
      this.semanticText(ctx,r.row.label,textX,top+24,w,NATIVE_TEXT.small,true);
      this.semanticText(ctx,r.row.controls?.[0]?.label??'',textX,top+44,w,NATIVE_TEXT.small);
      const leader=r.row.controls?.[2]?.label;
      if(leader)this.semanticText(ctx,faction.leaderTitle+' : '+leader,textX,top+65,w,NATIVE_TEXT.small);
      ctx.fillStyle='rgba(103,76,38,.17)';ctx.fillRect(r.x,top+r.height-1,nameWidth,1);return;
    }
    if(r.row.columns){ctx.fillStyle='#4d5c46';ctx.font=this.font('small',true);ctx.textAlign='left';ctx.fillText(r.row.label,r.x,this.pageBox?.matrixSpec?top+r.height/2+4:top+28,nameWidth);}
    else if(r.matrix)this.semanticText(ctx,r.row.label,r.x,top+r.height/2+4,nameWidth,NATIVE_UI.body,true);
  }
  private drawPageRow(ctx:CanvasRenderingContext2D,r:NativeRowBox,top:number,rng:()=>number,box:NativePageBox):void{
    const row=r.row,ink=PALETTE.inkDark,body=NATIVE_UI.body,line=NATIVE_UI.line;ctx.fillStyle=ink;ctx.textAlign='left';
    if(row.mapSearchEntry){
      const entry=row.mapSearchEntry,icon=Math.min(23,r.height-4),marker=entry.holder?' ↳':'';
      if(entry.index%2){ctx.fillStyle=NATIVE_INK.rowAlt;ctx.fillRect(r.x,top,r.width,r.height);}
      if(entry.icon)drawNativeActionIconInBox(ctx,entry.icon,r.x+2,top+(r.height-icon)/2,icon,icon,NATIVE_INK.text);
      const left=r.x+(entry.icon?icon+7:4),available=Math.max(1,r.x+r.width-left-4),size=NATIVE_TEXT.small;let label=row.label+marker;
      if(this.measure(label,size,false)>available){const chars=Array.from(row.label);while(chars.length&&this.measure(chars.join('')+'…'+marker,size,false)>available)chars.pop();label=chars.join('')+'…'+marker;}
      ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(label,left,top+r.height/2+size*.32,available);return;
    }
    if(row.infoHeading){ctx.fillStyle=NATIVE_INK.separator;ctx.font=this.font('small',true);r.labelLines.forEach((text,index)=>ctx.fillText(text,r.x+2,top+16+index*line,Math.max(1,r.width-4)));ctx.fillStyle=NATIVE_INK.line;ctx.fillRect(r.x,top+r.height-2,r.width,1);return;}
    if(row.infoEntry){
      const entry=row.infoEntry;if(entry.selected||entry.match==='match'){ctx.fillStyle=entry.selected?NATIVE_INK.buttonActive:NATIVE_INK.highlight;ctx.fillRect(r.x,top,r.width,r.height);}
      ctx.fillStyle=entry.match==='muted'?NATIVE_INK.disabled:NATIVE_INK.text;ctx.font=this.font('small',entry.selected||entry.match==='match');
      r.labelLines.forEach((text,index)=>ctx.fillText(text,r.x+3,top+16+index*line,Math.max(1,r.labelWidth-6)));
      ctx.textAlign='right';r.valueLines.forEach((text,index)=>ctx.fillText(text,r.x+r.width-3,top+16+index*line,Math.max(1,r.width-r.labelWidth-6)));ctx.textAlign='left';return;
    }
    if(row.fileEntry){
      const file=row.fileEntry,c=nativeFileColumns(r.width,file.manage),selected=file.manage&&row.controls?.[1]?.active;
      if(file.index%2===1||selected){ctx.fillStyle=selected?NATIVE_INK.highlight:NATIVE_INK.rowAlt;ctx.fillRect(r.x,top,r.width,r.height);}
      if(file.manage){ctx.font=this.font('small',!!selected);ctx.fillStyle=NATIVE_INK.text;ctx.fillText(row.label,r.x+c.inset,top+r.height/2+4,c.name);}
      if(c.info){const x=r.x+c.infoX+3;ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(file.date,x,top+15,c.info-6);ctx.font=this.font('tiny');ctx.fillStyle=NATIVE_INK.subtle;ctx.fillText(file.kind,x,top+31,c.info-6);}
      return;
    }
    if(row.tradeHeading||row.tradeEntry){
      const c=nativeTradeColumns(r.width),facts=row.tradeEntry;
      const text=(label:string,x:number,width:number,y:number,role:NativeTextRole='small',color:string=NATIVE_INK.text,bold=false,centre=true)=>{
        if(width<=3)return;ctx.textAlign=centre?'center':'left';ctx.font=this.font(role,bold);ctx.fillStyle=color;ctx.fillText(label,r.x+x+(centre?width/2:3),top+y,width-3);
      };
      if(row.tradeHeading){
        const heading=typeof row.tradeHeading==='object'?row.tradeHeading:undefined,gift=!!heading?.gift;
        ctx.fillStyle=NATIVE_INK.panelFill;ctx.fillRect(r.x,top,r.width,r.height);
        const y=r.height/2+4;
        if(c.compact){text(gift?'Bien · stock · valeur':'Bien · stock · prix',0,c.adjustX,y,'small',NATIVE_INK.text,true,false);text(gift?'Quantité donnée':'Quantité',c.adjustX,c.adjust,y,'small',NATIVE_INK.text,true);}
        else if(r.height>=30){
          text('Marchandise',0,c.name,y,'small',NATIVE_INK.text,true,false);text(heading?.source??'Colonie',c.sellCountX,c.count+c.price,12,'tiny',NATIVE_INK.subtle,true);text(heading?.partner??'Marchand',c.buyPriceX,c.price+c.count,12,'tiny',NATIVE_INK.subtle,true);
          text('Stock',c.sellCountX,c.count,r.height-5);text(gift?'Valeur/u':'Vente/u',c.sellPriceX,c.price,r.height-5);text(gift?'Quantité donnée':'Quantité',c.adjustX,c.adjust,y,'small',NATIVE_INK.text,true);
          if(gift)text('Sans paiement',c.buyPriceX,c.price+c.count,r.height-5);else{text('Achat/u',c.buyPriceX,c.price,r.height-5);text('Stock',c.buyCountX,c.count,r.height-5);}
        }else{
          text('Bien',0,c.name,y,'small',NATIVE_INK.text,true,false);text('Stock',c.sellCountX,c.count,y);text(gift?'Valeur/u':'Vente/u',c.sellPriceX,c.price,y);text('Qté',c.adjustX,c.adjust,y);
          if(gift)text('Sans paiement',c.buyPriceX,c.price+c.count,y);else{text('Achat/u',c.buyPriceX,c.price,y);text('Stock',c.buyCountX,c.count,y);}
        }
        ctx.fillStyle=NATIVE_INK.panelEdge;ctx.fillRect(r.x,top+r.height-1,r.width,1);return;
      }
      if(!facts)return;
      if(facts.index%2||facts.quantity){ctx.fillStyle=facts.quantity?NATIVE_INK.highlight:NATIVE_INK.rowAlt;ctx.fillRect(r.x,top,r.width,r.height);}
      const shade=facts.refused?NATIVE_INK.subtle:NATIVE_INK.text,nameY=c.compact?18:r.height/2+4,iconSize=Math.min(24,c.name/6),inset=facts.icon?iconSize+7:0;
      if(facts.icon)drawNativeActionIconInBox(ctx,facts.icon,r.x+3,top+(c.compact?2:(r.height-iconSize)/2),iconSize,iconSize,shade);
      text(row.label,inset,c.name-inset,nameY,'small',shade,!!facts.quantity,false);
      const count=tradeNumber.format(facts.available),price=facts.refused||facts.unitPrice===null?'—':tradeNumber.format(facts.unitPrice),y=r.height/2+4,outgoing=facts.side!=='buy';
      if(c.compact)text(`${facts.side==='gift'?'Don':facts.side==='sell'?'Vente':'Achat'} ${count} · ${price}/u`,0,c.adjustX,r.height-9,'small',shade,false,false);
      else{
        text(outgoing?count:'—',c.sellCountX,c.count,y,'small',outgoing?shade:NATIVE_INK.subtle);
        text(outgoing?price:'—',c.sellPriceX,c.price,y,'small',outgoing?shade:NATIVE_INK.subtle);
        text(facts.side==='buy'?price:'—',c.buyPriceX,c.price,y,'small',facts.side==='buy'?shade:NATIVE_INK.subtle);
        text(facts.side==='buy'?count:'—',c.buyCountX,c.count,y,'small',facts.side==='buy'?shade:NATIVE_INK.subtle);
      }
      if(facts.refused){const left=r.controls[0],right=r.controls[1],x=left?left.x+left.width-r.x:c.adjustX,w=right?right.x-r.x-x:c.adjust; text('Refusé',x,w,r.height-9,'tiny',NATIVE_INK.negative,true);}
      return;
    }
    if(row.factionEntry&&box.matrixSpec){
      const f=NATIVE_FACTIONS,facts=row.factionEntry,cols=nativeMatrixColumns(row,r.x,r.width,box.matrixSpec.widths.length,false,box.matrixSpec);
      const centered=(text:string,col:number,y:number,role:NativeTextRole='small',color:string=NATIVE_INK.text,bold=false)=>{
        const cell=cols[col]!;ctx.textAlign='center';ctx.font=this.font(role,bold);ctx.fillStyle=color;ctx.fillText(text,cell.x+cell.width/2,y,Math.max(1,cell.width-4));
      };
      const signed=(value:number)=>(value>0?'+':'')+value;
      const relColor=facts.relation==='hostile'?NATIVE_INK.negative:facts.relation==='ally'?NATIVE_INK.positive:NATIVE_INK.text;
      const relation=({your:'Votre faction',hostile:'Hostile',neutral:'Neutre',ally:'Alliée',unknown:'Inconnue'} as const)[facts.relation],hasNumber=facts.goodwill!==undefined&&!facts.permanentEnemy;
      centered(relation,2,top+(hasNumber?31:44),'small',relColor);
      if(hasNumber)centered(signed(facts.goodwill!),2,top+56,'medium',relColor,true);
      if(facts.naturalGoodwill!==undefined){
        const cell=cols[3]!,natural=facts.naturalGoodwill,shade=natural<0?NATIVE_INK.negative:natural>0?NATIVE_INK.positive:NATIVE_INK.subtle;
        drawHandRect(ctx,cell.x+7,top+30,cell.width-14,20,PALETTE.creamPaper,shade,1,rng);centered(signed(natural),3,top+45,'small',shade,true);
      }
      const enemy=cols[4]!,capacity=Math.max(1,Math.floor((enemy.width-8)/(f.enemySize+f.enemyGap))),shown=Math.min(facts.enemies.length,capacity-(facts.enemies.length>capacity?1:0));
      for(let i=0;i<shown;i++){
        const other=facts.enemies[i]!,x=enemy.x+4+i*(f.enemySize+f.enemyGap);
        drawNativeActionIconInBox(ctx,'pen-marker',x,top+29,f.enemySize,f.enemySize,other.color);
      }
      if(!facts.enemies.length)centered('—',4,top+44,'small',NATIVE_INK.none);
      else if(shown<facts.enemies.length){
        ctx.fillStyle=NATIVE_INK.subtle;ctx.font=this.font('small');ctx.textAlign='left';ctx.fillText('+'+(facts.enemies.length-shown),enemy.x+4+shown*(f.enemySize+f.enemyGap),top+44);
      }
      centered(row.controls?.[3]?.label??'',5,top+44);centered(row.controls?.[4]?.label??'',6,top+44);
      ctx.fillStyle='rgba(103,76,38,.17)';ctx.fillRect(cols[0]!.x,top+r.height-1,r.width-box.matrixSpec.name,1);return;
    }
    if(row.historyEntry){
      const c=historyColumns(r.width);
      ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(row.label,r.x+c.dateX+2,top+NATIVE_HISTORY.rowHeight/2+4,Math.max(1,c.date-4));
      if(row.historyEntry.kind==='journal')drawNativeActionIcon(ctx,'historique',r.x+c.iconX+c.icon/2,top+NATIVE_HISTORY.rowHeight/2,Math.min(9,c.icon/3),NATIVE_INK.subtle,PALETTE.creamPaper);
      return;
    }
    if(row.historyGraph){
      const graph=row.historyGraph,inner=Math.max(1,r.width-24),x=r.x+12;
      drawHandRect(ctx,r.x,top,r.width,r.height,PALETTE.creamPaper,ink,1,rng);
      ctx.font=this.font('medium',true);ctx.fillStyle=ink;ctx.fillText(row.label,x,top+32,inner);
      ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.subtle;ctx.fillText(graph.sample,x,top+58,inner);
      ctx.font=this.font('medium',true);ctx.fillStyle=ink;ctx.fillText(Math.round(graph.total).toLocaleString('fr-FR')+' argent'+(graph.complete?'':' au minimum'),x,top+95,inner);
      graph.bars.forEach((bar,i)=>{
        const y=top+135+i*65;
        ctx.textAlign='left';ctx.font=this.font('small',true);ctx.fillStyle=ink;ctx.fillText(bar.label,x,y,inner*.65);
        ctx.textAlign='right';ctx.font=this.font('small');ctx.fillText(Math.round(bar.value).toLocaleString('fr-FR'),x+inner,y,inner*.35);
        drawHandRect(ctx,x,y+9,inner,20,'#e5d9bf',ink,1,rng);
        ctx.fillStyle=bar.color;ctx.fillRect(x,y+10,inner*Math.max(0,Math.min(1,bar.value/Math.max(1,graph.total))),18);
      });
      ctx.textAlign='left';ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.subtle;ctx.fillText('Dernier relevé uniquement · aucun historique temporel enregistré',x,top+r.height-20,inner);
      return;
    }
    if(r.card&&row.card){paintNativeTabCard(ctx,r.card,r.x,top,{font:(role,bold)=>this.font(role,bold),measure:(text,role,bold)=>this.measure(text,NATIVE_TEXT[role],!!bold),rng});return;}
    if(r.bio&&row.bio){paintNativeBioCard(ctx,r.bio,row.bio,r.x,top,{font:(role,bold)=>this.font(role,bold),measure:(text,role,bold)=>this.measure(text,NATIVE_TEXT[role],!!bold),rng});return;}
    if(row.tree){
      const left=r.x+Math.max(0,row.tree.depth)*17+28;
      ctx.fillStyle=row.controls?.every(control=>control.disabled)?'#7a705f':ink;
      this.semanticText(ctx,r.labelLines[0]??row.label,left,top+18,r.labelWidth,NATIVE_TEXT.small,row.tree.depth===0);
      return;
    }
    const record=row.presentation==='record'||!!row.controls?.length&&!!row.label&&!row.meter&&!row.columns&&!r.matrix;
    if(record||row.presentation==='summary'){
      const summary=row.presentation==='summary';drawHandRect(ctx,r.x-4,top+2,r.width+6,r.height-7,summary?'rgba(217,153,62,.12)':'rgba(255,251,235,.38)','rgba(122,95,58,.28)',.75,rng);
      ctx.fillStyle=summary?'#bd8b45':'#92a287';ctx.fillRect(r.x-3,top+8,2,Math.max(10,r.height-20));
    }
    if(row.columns){
      if(!(box.layout==='table'&&box.regions.navigation&&row.region==='catalogue'))this.drawMatrixName(ctx,r,top);
      const spec=box.matrixSpec,tail=spec?spec.tail:r.matrixTail?192:0,columns=nativeMatrixColumns(row,r.x,r.width,row.columns.length,r.matrixTail,spec??box.matrixColumnWeights);
      if(spec){this.drawPawnTableHeading(ctx,r,top,row.columns.map(c=>c.label),columns,row.id==='work-headings');if(row.value)this.semanticText(ctx,row.value,r.x+r.width-tail+6,top+r.height/2+4,tail-10,NATIVE_TEXT.small);return;}
      row.columns.forEach((column,index)=>{const cell=columns[index]!,lines=nativeMatrixHeadingLines(column.label,cell.width-5,this.measure).slice(0,2);ctx.textAlign='center';ctx.font=this.font('small',true);lines.forEach((line,lineIndex)=>ctx.fillText(line,cell.x+cell.width/2,top+28+(lineIndex-(lines.length-1)/2)*15,cell.width-4));});
      if(row.value)this.semanticText(ctx,row.value,r.x+r.width-tail+6,top+28,tail-10,NATIVE_TEXT.small);return;
    }
    if(r.matrix){if(!(box.layout==='table'&&box.regions.navigation&&row.region==='catalogue'))this.drawMatrixName(ctx,r,top);if(row.value&&box.matrixSpec){this.semanticText(ctx,row.value,r.x+r.width-box.matrixSpec.tail+6,top+r.height/2+4,box.matrixSpec.tail-10,NATIVE_TEXT.small);}else if(row.value){const lines=wrapNativeText(row.value,176,this.measure,NATIVE_TEXT.small);lines.slice(0,2).forEach((line,i)=>this.semanticText(ctx,line,r.x+r.width-180,top+18+i*17,176,NATIVE_TEXT.small));}return;}
    if(row.id==='pawn-tabs'||row.id==='health-tabs')return;
    if(row.meter){
      const meter=row.meter,labelWidth=Math.min(r.width*.45,138),barX=r.x+labelWidth,barW=Math.max(40,r.width-labelWidth-8),fraction=THREE.MathUtils.clamp(meter.value/(meter.max??1),0,1);
      this.semanticText(ctx,row.label,r.x,top+18,labelWidth-5,body);
      if(meter.passion){ctx.fillStyle='#b45c29';ctx.font=this.font('tiny',true);ctx.fillText('♥'.repeat(meter.passion),r.x+labelWidth-24,top+24);}
      drawHandRect(ctx,barX,top+6,barW,16,'#e5d4b2','#51402c',1,rng);
      if(fraction>0)drawHandRect(ctx,barX+.8,top+6.8,Math.max(.5,(barW-1.6)*fraction),14.4,meter.color??'#63885d',null,.5,rng);
      ctx.fillStyle=ink;ctx.font=this.font('small',true);ctx.textAlign='center';ctx.strokeStyle='#f8edda';ctx.lineWidth=2;ctx.strokeText(meter.label??row.value??'',barX+barW/2,top+19,barW-4);ctx.fillText(meter.label??row.value??'',barX+barW/2,top+19,barW-4);ctx.textAlign='left';
      if(meter.secondary){const secondary=meter.secondary;ctx.fillStyle='#d2bea0';ctx.fillRect(barX,top+25,barW,4);ctx.fillStyle=secondary.color??'#987743';ctx.fillRect(barX,top+25,barW*THREE.MathUtils.clamp(secondary.value/(secondary.max??1),0,1),4);}
      return;
    }
    const baseline=top+(record?21:18),labelWidth=row.value||row.input?r.labelWidth-5:r.textWidth;
    if(row.label)r.labelLines.forEach((text,i)=>this.semanticText(ctx,text,r.x+3,baseline+i*line,labelWidth-3,body,row.emphasis==='heading'||row.presentation==='summary'||record&&!!row.value));
    if(row.value)r.valueLines.forEach((text,i)=>this.semanticText(ctx,text,r.x+r.labelWidth+6,baseline+i*line,r.textWidth-r.labelWidth-8,body));
    if(r.detailLines.length){const y=baseline+Math.max(r.labelLines.length,r.valueLines.length,1)*line+2;r.detailLines.forEach((text,i)=>this.semanticText(ctx,text,r.x+3,y+i*18,r.textWidth-5,NATIVE_TEXT.small));}
    if(row.emphasis==='heading'){ctx.strokeStyle='rgba(103,76,38,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r.x,top+r.height-4);ctx.lineTo(r.x+r.width,top+r.height-4);ctx.stroke();}
  }
  private semanticText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,bold=false):void{
    if(!text||width<=0)return;let spans=this.semanticInk.get(text);
    if(!spans){spans=tokenizeNativeText(text,this.textLexicon);if(this.semanticInk.size>=1024)this.semanticInk.delete(this.semanticInk.keys().next().value!);this.semanticInk.set(text,spans);}
    const measured=spans.reduce((sum,span)=>sum+this.measure(span.text,size,bold||NATIVE_TEXT_STYLES[span.kind].bold),0);
    ctx.save();ctx.textAlign='left';ctx.translate(x,y);ctx.scale(Math.min(1,width/Math.max(1,measured)),1);let offset=0;
    for(const span of spans){const style=NATIVE_TEXT_STYLES[span.kind];ctx.font=this.fontPx(size,bold||style.bold);ctx.fillStyle=style.color;ctx.fillText(span.text,offset,0);offset+=this.measure(span.text,size,bold||style.bold);}
    ctx.restore();
  }
  private wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number,maxLines=20):number{
    const words=text.split(/\s+/);let line='',lines=0;
    for(const word of words){const next=line?`${line} ${word}`:word;
      if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y,width);y+=lineHeight;line=word;if(++lines>=maxLines)return lines;}else line=next;}
    if(line&&lines<maxLines){ctx.fillText(line,x,y,width);lines++;}return lines;
  }
  private control(control:NativeControl,x:number,y:number,w:number,h:number,z:number,style:NativeControlStyle=control.presentation??'button',node?:NativeRow['graphNode'],inset?:NativeControl):CardboardPiece{
    const cssW=w*100,cssH=h*100,workCell=/^work-\d+-/.test(control.id)&&(!!control.select||!!control.onSecondary);
    const portrait=style==='candidate'&&control.portraitUrl?this.portraitImage(control.portraitUrl):undefined,portraitReady=!!portrait?.complete&&!!portrait.naturalWidth;
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
      }else if(style==='option'){
        // Core FloatMenuOption: the label on the left (6 in, text centred
        // vertically), one 22-point line each, wrapped inside the column.
        ctx.textAlign='left';ctx.font=this.font('small');ctx.fillStyle=ink;
        const lines=wrapNativeText(control.label,cssW-FLOAT_MENU.inset*2-4,this.measure,NATIVE_TEXT.small),first=cssH/2-(lines.length-1)*NATIVE_LINE.small/2+4;
        lines.forEach((line,index)=>ctx.fillText(line,FLOAT_MENU.inset,first+index*NATIVE_LINE.small,cssW-FLOAT_MENU.inset*2-4));
      }else if(style==='navigation'&&cssH<=48){
        // Core DoCategoryButton: a label-only button of 32, Small text.
        ctx.font=this.font('small',!!control.active);ctx.fillStyle=ink;ctx.fillText(control.label,cssW/2,cssH/2+4,cssW-10);
      }else if(style==='tile'||style==='navigation'){
        /* Preserve the seeded label paint after removing the icon disk. */for(let point=0;point<14;point++)rng();
        // A 75-point gizmo labels in Tiny (Core Command), larger tiles in Small.
        const labelRole:NativeTextRole=cssW<=80?'tiny':'small',lines=wrapNativeText(control.label,cssW-13,this.measure,NATIVE_TEXT[labelRole]).slice(0,2),bandHeight=lines.length>1?(labelRole==='tiny'?25:31):24,bandY=cssH-bandHeight-4;
        const iconTop=control.caption?21:9;
        drawNativeActionIconInBox(ctx,control.icon??control.id,9,iconTop,cssW-18,bandY-iconTop-8,ink);
        ctx.save();ctx.translate(cssW/2,bandY+bandHeight/2);ctx.rotate(this.seed(control.id)%2?.024:-.024);drawHandRect(ctx,-cssW*.46,-bandHeight/2,cssW*.92,bandHeight,PALETTE.creamPaper,ink,1.1,rng);ctx.font=this.font(labelRole,true);lines.forEach((line,index)=>ctx.fillText(line,0,4+(index-(lines.length-1)/2)*(labelRole==='tiny'?11:14),cssW-13));ctx.restore();
        if(control.caption){ctx.font=this.font('tiny',true);ctx.textAlign='right';ctx.fillText(control.caption,cssW-7,14,cssW-12);}
      }else if(style==='card'){
        ctx.textAlign='left';const cardInk=nativeCardInk(control,cssW,this.measure,!!inset);let baseline=30;
        const paint=(lines:string[],bold:boolean)=>{ctx.font=this.font('small',bold);for(const line of lines){ctx.fillText(line,18,baseline);baseline+=NATIVE_LEADING;}};
        paint(cardInk.title,true);if(cardInk.caption.length){baseline+=4;paint(cardInk.caption,false);}if(cardInk.description.length){baseline+=4;ctx.fillStyle='#625139';paint(cardInk.description,false);}
        if(inset){drawHandRect(ctx,cssW-54,14,38,38,PALETTE.creamPaper,ink,1.2,rng);drawNativeActionIcon(ctx,inset.icon??inset.id,cssW-35,33,12,inset.disabled?'#8b7b60':ink,PALETTE.creamPaper);}
      }else if(style==='icon'){
        if(control.icon==='history-pin'){
          const cx=cssW/2,cy=cssH/2;ctx.save();ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1.6;ctx.lineJoin='round';
          ctx.beginPath();ctx.moveTo(cx-5,cy-6);ctx.lineTo(cx+5,cy-6);ctx.lineTo(cx+2,cy);ctx.lineTo(cx+5,cy+3);ctx.lineTo(cx-5,cy+3);ctx.lineTo(cx-2,cy);ctx.closePath();
          if(control.active)ctx.fill();else ctx.stroke();
          ctx.beginPath();ctx.moveTo(cx,cy+3);ctx.lineTo(cx,cy+8);ctx.stroke();ctx.restore();
        }else if(control.icon==='history-letter'){
          const left=cssW*.18,top=cssH*.24,right=cssW*.82,bottom=cssH*.76;
          ctx.save();ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.strokeRect(left,top,right-left,bottom-top);ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(cssW/2,cssH*.53);ctx.lineTo(right,top);ctx.stroke();ctx.restore();
        }else drawNativeActionIconInBox(ctx,control.icon??(control.label==='▶'?'play':control.id),6,6,cssW-12,cssH-12,ink);
      }else if(style==='candidate'||style==='scenario-choice'){
        if(portraitReady&&portrait){
          const size=Math.min(NATIVE_CREATION.selectorPortraitWidth,cssW*.73);ctx.save();ctx.globalAlpha=.23;ctx.drawImage(portrait,cssW-size+2,(cssH-size)/2,size,size);ctx.restore();
        }
        const inset=6,space=Math.max(1,cssW-inset*2),oneLine=(text:string,role:NativeTextRole,bold:boolean)=>{
          let short=text;while(short.length>1&&this.measure(short,NATIVE_TEXT[role],bold)>space)short=short.slice(0,-1);
          if(short!==text){while(short.length>1&&this.measure(short+'…',NATIVE_TEXT[role],bold)>space)short=short.slice(0,-1);short=short.trimEnd()+'…';}return short;
        };
        ctx.font=this.font('small',true);ctx.fillStyle=ink;
        if(style==='scenario-choice'&&cssH>=100){
          if(control.icon)drawNativeActionIconInBox(ctx,control.icon,12,6,cssW-24,cssH-62,ink);
          ctx.textAlign='center';const lines=wrapNativeText(control.label,space,this.measure,NATIVE_TEXT.small).slice(0,2);lines.forEach((line,index)=>ctx.fillText(line,cssW/2,cssH-42+index*NATIVE_LINE.small*.72,space));
          if(control.caption){ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.subtle;ctx.fillText(oneLine(control.caption,'small',false),cssW/2,cssH-9,space);}
        }else{
          ctx.textAlign='left';ctx.fillText(oneLine(control.label,'small',true),inset,control.caption?cssH*.36:cssH/2+4,space);
          if(control.caption){ctx.font=this.font('small');ctx.fillStyle=NATIVE_INK.subtle;ctx.fillText(oneLine(control.caption,'small',false),inset,cssH*.76,space);}
        }
      }else if(style==='radio'){
        const radius=Math.min(8,cssH*.35),cx=12,cy=cssH/2;ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
        if(control.active){ctx.fillStyle=ink;ctx.beginPath();ctx.arc(cx,cy,radius*.55,0,Math.PI*2);ctx.fill();}
        ctx.textAlign='left';ctx.font=this.font('small');ctx.fillStyle=ink;ctx.fillText(control.label,27,cy+4,Math.max(1,cssW-32));
      }else if(style==='history-row'){
        ctx.font=this.font('small');ctx.textAlign='left';ctx.fillStyle=ink;
        const lines=wrapNativeText(control.label,Math.max(1,cssW-8),this.measure,NATIVE_TEXT.small);
        let label=lines[0]??'';if(lines.length>1){while(label.length&&this.measure(label+'…',NATIVE_TEXT.small)>cssW-8)label=label.slice(0,-1);label=label.trimEnd()+'…';}
        ctx.fillText(label,4,cssH/2+4,Math.max(1,cssW-8));
      }else if(style==='research'&&node){
        ctx.textAlign='center';ctx.font=this.font('small',true);ctx.fillStyle=node.searchMatch===false?NATIVE_INK.subtle:ink;
        const lines=wrapNativeText(control.label,cssW-12,this.measure,NATIVE_TEXT.small).slice(0,2);
        lines.forEach((line,index)=>ctx.fillText(line,cssW/2,17+(index-(lines.length-1)/2)*15,cssW-12));
        const barWidth=cssW-38,filled=barWidth*THREE.MathUtils.clamp(node.points/Math.max(1,node.cost),0,1);
        drawHandRect(ctx,8,cssH-16,barWidth,9,'#ae9675',ink,1,rng);if(filled>0){ctx.fillStyle=node.state==='done'?'#8fa66c':node.state==='active'?'#d3a548':'#829baa';ctx.fillRect(9,cssH-15,Math.max(0,filled-2),7);}
        ctx.fillStyle=ink;ctx.font=this.font('tiny',true);ctx.textAlign='center';ctx.fillText(`${Math.round(node.points)}/${node.cost}`,8+barWidth/2,cssH-8,barWidth-4);
        if(inset){drawHandRect(ctx,cssW-24,cssH-22,22,19,inset.disabled?PALETTE.kraftLight:PALETTE.sageMountain,ink,1,rng);drawNativeActionIcon(ctx,'play',cssW-13,cssH-12.5,6.5,inset.disabled?'#776c55':ink,PALETTE.creamPaper);}
      }else{
        const inlineIcon=!!control.icon&&cssH>=28;if(inlineIcon)icon(17,cssH/2,10);
        const available=workCell?cssW-2:cssW-(control.select?24:12)-(inlineIcon?26:0),font:NativeTextRole=control.id==='page:close'||control.label.length<=1&&cssW<=48?'medium':'small';
        ctx.font=this.font(font,true);let label=control.label;
        if(cssH>=39&&!control.caption){const lines=wrapNativeText(label,available,this.measure,NATIVE_TEXT[font]).slice(0,2);lines.forEach((line,index)=>ctx.fillText(line,cssW/2+(inlineIcon?12:0)-(control.select?4:0),cssH/2+4+(index-(lines.length-1)/2)*15,available));}
        else{
        while(label.length>1&&this.measure(label,NATIVE_TEXT[font],true)>available)label=label.slice(0,-1);
        if(label!==control.label)label=label.trimEnd()+'…';
        if(workCell)ctx.font=this.font('medium',true);
        if(control.mark==='check'){const cx=cssW/2,cy=control.caption&&workCell?cssH*.43-5:cssH/2;ctx.save();ctx.strokeStyle=ink;ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(cx-6,cy);ctx.lineTo(cx-1.5,cy+5);ctx.lineTo(cx+7,cy-6);ctx.stroke();ctx.restore();}
        else ctx.fillText(label,cssW/2+(inlineIcon?12:0)-(control.select&&!workCell?4:0),control.caption?workCell?cssH*.43:14:cssH/2+4,available);
        }
        if(workCell&&control.passion){ctx.save();ctx.globalAlpha=.4;ctx.font=this.font('tiny',true);ctx.fillStyle=ink;ctx.fillText('♨'.repeat(control.passion),cssW/2,cssH-3,cssW-2);ctx.restore();}
        if(control.caption){ctx.font=this.font(workCell?'small':'tiny',workCell);ctx.fillStyle=workCell?'#392b20':'#5b5b42';ctx.fillText(control.caption,cssW/2,cssH-5,cssW-6);}
      }
      if(control.select){const cy=workCell?10:cssH/2;ctx.fillStyle=PALETTE.inkDark;ctx.beginPath();ctx.moveTo(cssW-12,cy-2);ctx.lineTo(cssW-5,cy-2);ctx.lineTo(cssW-8.5,cy+3);ctx.closePath();ctx.fill();}
      if(control.active&&!control.glyph&&style!=='radio')drawMarkerLine(ctx,5,cssH-3,cssW-5,cssH-3,PALETTE.inkDark,1,rng);
      ctx.restore();
    };
    const piece=this.pagePiece(control.id,{w,h,depth:.046,bevel:.038,uvPadding:1,textureWidth:Math.max(32,Math.ceil(cssW*2)),textureHeight:Math.max(32,Math.ceil(cssH*2)),bgColor:control.glyph||style==='radio'&&!control.disabled||(style==='option'||style==='history-row')&&!control.active&&!control.disabled?PALETTE.creamPaper:control.disabled?PALETTE.kraftLight:control.active?PALETTE.ochre:control.color??PALETTE.sageMountain,seed:this.seed(control.id)%CONTROL_CUT_VARIANTS+1,sharedGeometry:true,interactive:true,drawFn:draw},
      JSON.stringify([control.label,control.caption,control.passion,control.description,control.icon,control.glyph,control.color,style,node,inset?.icon,!!inset?.disabled,!!control.active,!!control.disabled,!!control.select,this.textFontRevision,control.mark,control.portraitUrl,portraitReady]),x,y,z,control);
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
    const controls=new Map<string,NativeControl>(),cardControls=new Map<string,NativeControl>(),inputs=new Map<string,NonNullable<NativeRow['input']>>(),hints=new Map<string,string>();
    // Targets inside a fixed card are keyed by their target rectangles, not
    // by row.controls. When its ink has not changed, refresh the callbacks
    // from the current spec without re-laying-out or losing those hit planes.
    const collectCardControls=(value:unknown):void=>{if(typeof value!=='object'||value===null)return;const candidate=value as Partial<NativeControl>;if(typeof candidate.id==='string'&&typeof candidate.onActivate==='function'){cardControls.set(candidate.id,candidate as NativeControl);return;}for(const child of Object.values(value))collectCardControls(child);};
    for(const row of page.rows){
      for(const control of row.controls??[])controls.set(control.id,this.rowControl(row,control));if(row.input)inputs.set(row.id,row.input);
      hints.set('row-hint:'+row.id,this.rowHint(row));
      row.columns?.forEach((column,index)=>{if(column.control)controls.set(column.control.id,column.control);else hints.set('column:'+row.id+':'+index,column.hint??column.label);});
      if(row.card)collectCardControls(row.card);
      if(row.bio){
        for(const control of row.bio.buttons??[])controls.set(control.id,control);
        for(const chip of [row.bio.faction,...row.bio.stories.map(story=>story.chip),...row.bio.traits,...row.bio.incapable])if(chip?.onActivate)controls.set('bio:'+chip.id,{id:'bio:'+chip.id,label:chip.id,hint:chip.hint,onActivate:chip.onActivate});
      }
    }
    for(const control of page.actions??[])controls.set(control.id,control);
    controls.set('page:close',this.closeControl());
    for(const record of this.retainedPagePieces.values()){
      const id=String(record.piece.userData.nativeId);
      const control=controls.get(id)??(id.startsWith('card:')&&record.hit.control?cardControls.get(record.hit.control.id):undefined),input=inputs.get(id);
      record.hit.control=control;record.hit.input=input;
      const hint=control?.hint??control?.label??hints.get(id)??record.piece.userData.tooltip??'';
      // A changed text is re-read by the shown tip (animate), not dropped.
      record.piece.userData.tooltip=hint;record.piece.userData.nativeDisabled=!!control?.disabled;
      if(this.editing===record.hit&&input&&this.editor)this.editor.maxLength=input.maxLength??2048;
    }
    for(const hit of this.pageControls)if(hit.region&&hit.control){const control=controls.get(hit.control.id);if(control)hit.control=control;}
    const dropdown=this.dropdown;
    if(dropdown){
      const owner=controls.get(dropdown.controlId),select=owner?.select;
      if(page.id!==dropdown.pageId||owner?.disabled||!select){this.closeDropdown();return;}
      const options=new Map(select.options.map(option=>['select-option:'+dropdown.controlId+':'+option.value,option]));
      for(const piece of dropdown.pieces){
        const option=options.get(String(piece.userData.nativeId));if(!option)continue;
        const hint=option.hint??option.label,hit=this.hits.get(piece.userData.mesh);
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
    if(!record){
      const parked=this.parkedPagePieces.get(id);
      if(parked){
        this.parkedPagePieces.delete(id);this.parkedPagePixels-=pagePiecePixels(parked.piece);
        if(parked.geometry===geometry){
          this.art.revivePiece(parked.piece);parked.hit=this.register(parked.piece,control,input);
          this.retainedPagePieces.set(id,parked);this.pageGroup.add(parked.piece);record=parked;
          this.setPose(parked.piece,0);
        }else this.art.disposePiece(parked.piece);
      }
    }
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
    const parked:CardboardPiece[]=[];
    for(const [id,record]of this.retainedPagePieces)if(!this.pagePieceIds.has(id)){
      if(this.editing===record.hit)this.finishEdit(false,false);
      this.retainedPagePieces.delete(id);
      const piece=record.piece;
      if(this.mapToolLabelOwner===piece)this.clearMapToolLabel();
      if(this.hintOwner===piece)this.clearHint(true);
      if(this.hovered===piece)this.hover(null);this.moving.delete(piece);
      for(const mesh of piece.userData.interactiveMeshes??[])this.hits.delete(mesh);
      piece.userData.hoverTarget=piece.userData.hoverVal=piece.userData.pressVal=0;
      const previous=this.parkedPagePieces.get(id);
      if(previous){this.parkedPagePieces.delete(id);this.parkedPagePixels-=pagePiecePixels(previous.piece);this.art.disposePiece(previous.piece);}
      if(pagePiecePixels(piece)>PARKED_PIECE_MAX_PIXELS){this.art.disposePiece(piece);continue;}
      this.parkedPagePieces.set(id,record);this.parkedPagePixels+=pagePiecePixels(piece);parked.push(piece);
    }
    if(!parked.length)return;
    this.art.parkPieces(parked);
    for(const [id,record]of this.parkedPagePieces){
      if(this.parkedPagePieces.size<=PARKED_PAGE_PIECES&&this.parkedPagePixels<=PARKED_PAGE_PIXELS)break;
      this.parkedPagePieces.delete(id);this.parkedPagePixels-=pagePiecePixels(record.piece);this.art.disposePiece(record.piece);
    }
    this.sceneRevision++;
  }
  private seed(text:string):number{let value=17;for(const c of text)value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;return value;}
  /** `reacquire`: the owner piece was repainted or replaced while its tip was
   * shown; the next frame gives the tip back to the region with the same id
   * still under the mouse, without a new delay (Core keeps an ActiveTip by
   * its uniqueId while the region is drawn under the mouse each frame). */
  private clearHint(reacquire=false):void{
    const id=reacquire&&this.hintOwner&&this.hintPiece?String(this.hintOwner.userData.nativeId??''):'';
    clearTimeout(this.hintTimer);this.hintTimer=undefined;this.hintOwner=null;this.hintHit=undefined;this.hintText='';
    this.hintScroll=0;this.hintMaxScroll=0;
    if(this.hintPiece){this.unregister(this.hintPiece);this.hintPiece=undefined;this.invalidate();}
    this.hintReacquire=id||undefined;
  }
  private hintTextOf(hit:Hit):string{return hit.control?.hint??hit.piece.userData.tooltip??'';}
  private updateHint(hit:Hit|undefined,x:number,y:number,immediate=false):void{
    x/=this.displayScale;y/=this.displayScale;
    const text=hit?this.hintTextOf(hit):'';
    if(!hit||!text){this.clearHint();return;}
    if(this.hintOwner===hit.piece){
      this.hintHit=hit;this.hintAt={x,y};
      if(this.hintText!==text){this.hintText=text;if(this.hintPiece)this.showHint();}
      this.placeHint();return;
    }
    this.clearHint();this.hintOwner=hit.piece;this.hintHit=hit;this.hintText=text;this.hintAt={x,y};
    if(immediate){this.showHint();return;}
    // Core TipSignal.delay: 0.45 s from the first frame over the region.
    this.hintTimer=setTimeout(()=>{this.hintTimer=undefined;if(!this.closed&&this.hintOwner===hit.piece)this.showHint();},TOOLTIP_DELAY_MS);
  }
  /** Paints the tip of the current owner with its current text. */
  private showHint():void{
    if(this.hintPiece){this.unregister(this.hintPiece);this.hintPiece=undefined;}
    const text=this.hintText;
    // Core ActiveTip: Small text wrapped at 260, 4 of margin, line of 22.
    const line=NATIVE_LINE.small,margin=TOOLTIP_BOX.margin,limit=Math.min(TOOLTIP_BOX.maxTextWidth,this.width-2*margin-8);
    const lines=wrapNativeText(text,limit,this.measure,NATIVE_TEXT.small),widest=Math.max(0,...lines.map(entry=>this.measure(entry,NATIVE_TEXT.small)));
    const natural=tooltipBoxSize(widest,lines.length*line),width=Math.min(natural.width,this.width-8),height=Math.min(this.height-20,natural.height);
    const count=natural.height>height?Math.max(1,Math.floor((height-2*margin-line)/line)):lines.length;this.hintMaxScroll=Math.max(0,lines.length-count);this.hintScroll=Math.min(this.hintScroll,this.hintMaxScroll);
    const z=2,factor=1-z/HUD_DISTANCE,piece=this.art.createPiece({w:width*.01,h:height*.01,depth:.046,bevel:.038,surface:'panel',uvPadding:1,textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),seed:347,bgColor:PALETTE.creamPaper,
      drawFn:(ctx,wp,hp)=>{ctx.save();ctx.scale(wp/width,hp/height);ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='left';ctx.font=this.font('small');const scrolling=this.hintMaxScroll>0;lines.slice(scrolling?this.hintScroll:0,scrolling?this.hintScroll+count:lines.length).forEach((entry,i)=>ctx.fillText(entry,margin,margin+16+i*line,width-2*margin));if(scrolling){ctx.font=this.font('tiny');ctx.fillStyle='#6b5b45';ctx.fillText('Molette : suite',margin,height-margin-2);ctx.fillStyle='#78975c';ctx.fillRect(width-6,6+(height-12)*this.hintScroll/lines.length,3,Math.max(8,(height-12)*count/lines.length));}ctx.restore();}});
    piece.userData.nativeId='native-tooltip';piece.scale.setScalar(this.uiScale*factor);this.hudRoot.add(piece);this.hintPiece=piece;this.hintSize={width,height};
    this.placeHint(true);
  }
  /** Core GenUI.GetMouseAttachedWindowPos: 16 px right of the mouse (or 4 px
   * left of it when it would leave the screen), 14 px below (or 5 px above). */
  private placeHint(force=false):void{
    const piece=this.hintPiece;if(!piece)return;
    const {x,y}=this.hintAt,{width,height}=this.hintSize,at=mouseAttachedTipPosition(x,y,width,height,this.width,this.height);
    const left=THREE.MathUtils.clamp(at.left,8,Math.max(8,this.width-width-8)),top=THREE.MathUtils.clamp(at.top,8,Math.max(8,this.height-height-8));
    const z=2,factor=1-z/HUD_DISTANCE,px=(left+width/2-this.width/2)*this.visH/this.height*factor,py=(this.height/2-top-height/2)*this.visH/this.height*factor;
    if(!force&&piece.userData.basePos.x===px&&piece.userData.basePos.y===py)return;
    piece.setBaseTransform(px,py,z);this.setPose(piece,0);this.invalidate();
  }
  /** Per frame, O(1): a shown tip re-reads its owner's text; a tip whose
   * owner was repainted comes back on the same region under the mouse. */
  private refreshHint():void{
    if(this.hintReacquire!==undefined){
      const id=this.hintReacquire;this.hintReacquire=undefined;
      const hit=this.hit(this.lastPointer.x*this.displayScale,this.lastPointer.y*this.displayScale);
      if(hit&&String(hit.piece.userData.nativeId??'')===id)this.updateHint(hit,this.lastPointer.x*this.displayScale,this.lastPointer.y*this.displayScale,true);
      return;
    }
    const hit=this.hintHit;if(!hit||!this.hintPiece)return;
    const text=this.hintTextOf(hit),action=tipTextAction(this.hintText,text);
    if(action==='keep')return;
    if(action==='clear'){this.clearHint();return;}
    this.hintText=text;this.showHint();
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
      target.redraw((ctx,wp,hp)=>{const q=wp/(target.userData.w*100);ctx.font=this.font('small',false,q);ctx.textAlign='left';ctx.fillStyle=PALETTE.inkDark;
        const start=input.selectionStart,end=input.selectionEnd,offset=wp*.07,text=this.editingValue;
        const before=ctx.measureText(text.slice(0,start)).width,selected=ctx.measureText(text.slice(start,end)).width;
        const shift=Math.max(0,before-wp*.86);ctx.save();ctx.beginPath();ctx.rect(wp*.06,hp*.06,wp*.88,hp*.88);ctx.clip();
        if(end>start){ctx.fillStyle='#d9ae68';ctx.fillRect(offset+before-shift,hp/2-8*q,selected,17*q);ctx.fillStyle=PALETTE.inkDark;}
        ctx.fillText(text,offset-shift,hp/2+4*q);ctx.fillRect(offset+before-shift,hp/2-8*q,Math.max(1,q),17*q);ctx.restore();});this.invalidate();};
    this.editRepaint=repaint;input.addEventListener('input',()=>{
      const current=this.editing?.input;if(current?.onChange&&current.value!==input.value)try{current.onChange(input.value);}catch(error){this.options.onError(String(error));}
      repaint();
    });input.addEventListener('select',repaint);input.addEventListener('keyup',repaint);
    input.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Tab'){
        event.preventDefault();event.stopImmediatePropagation();
        if(!event.repeat&&!event.isComposing)void this.advanceEditor(event.shiftKey?-1:1).catch(error=>{if(!this.closed)this.options.onError(String(error));});
      }else if(event.key==='Escape'){event.preventDefault();const close=this.page?.layout==='map-search'?this.page.onClose:undefined;this.finishEdit(false);close?.();}
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
    for(const dispose of this.disposers)dispose();this.disposers.length=0;this.overlayCache.dispose();for(const image of this.portraitImages.values()){image.onload=null;image.onerror=null;}this.portraitImages.clear();this.globe?.dispose();this.selectionFill.geometry.dispose();this.selectionFill.material.dispose();this.selectionOutline.geometry.dispose();this.selectionOutline.material.dispose();this.shipCurtainMesh298.geometry.dispose();this.shipCurtainMaterial298.dispose();this.shipCurtainScene298.clear();this.highlight.dispose();this.art.dispose();this.ownRenderer.domElement.remove();void this.ownRenderer.dispose();this.hits.clear();this.moving.clear();this.retainedPagePieces.clear();this.parkedPagePieces.clear();this.parkedPagePixels=0;
  }
}
