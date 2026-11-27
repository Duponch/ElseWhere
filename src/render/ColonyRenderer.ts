import * as THREE from 'three/webgpu';
import {GraphicsStyleContext,withGraphicsStyle} from './graphics-style';
import type {GraphicsStylePreferences} from '../ui3d/native-preferences';
import {actualCameraView301} from './actual-camera-view-301.ts';
import type {ActualView301} from '../sim/actual-view-301.ts';
import {SceneRenderCore} from './SceneRenderCore';
import {createDomPort} from './DomScenePort';
import type {RendererLifetime} from './scene-render-ports';
import {ReentrantRenderer} from './ReentrantRenderer';
import {adapterRendererLimits} from './webgpu-device-limits';
import {MapLabelsOverlay} from './MapLabelsOverlay';
import {EnvironmentStatsOverlay} from './EnvironmentStatsOverlay';
import type {NativeEnvironmentStats} from '../ui3d/native-environment-stats';
import {PawnSelectionInput,hitActors} from './PawnSelectionInput';
import {isAreaAction} from '../sim/designation';
import {isLineBuildKind} from '../sim/construction-line';
import {isCarpetFloor355,type CarpetFloor355} from '../sim/carpet-355';
import {STRUCTURE_DEFINITIONS} from '../sim/definitions';
import {mapObjectsAt,sameMapObject,type MapObjectSelection} from '../ui/map-object-selection';
import {matchingMapObjects,mapObjectGroupTarget} from '../ui/map-object-group-selection';
import {mapObjectsInRect,boxSelection} from '../ui/map-object-rectangle';
import {cameraClipNear} from './camera-clip';
import {installMapWheelZoom} from '../ui/map-wheel';
import {DeferredMapHover} from './deferred-map-hover';
import type {AreaAction,Cell} from '../sim/types';
export class ColonyRenderer extends SceneRenderCore {
  private actualViewSample301?:{mapKey:string;at:number;view:ActualView301|null};
  /** Sample the real camera after controls updated, at most ten times/second
   * per map; incoming immutable World publications do not invalidate this bound. */
  readActualView301(now:number):ActualView301|null {
    const world=this.world;
    if(!world||!Number.isFinite(now)||this.disposed||this.preparing||this.presentationStopped||this.fatalError){this.actualViewSample301=undefined;return null;}
    const mapId=world.campaignMap?.revision===2?world.campaignMap.activeMapId:0,mapKey=[mapId,world.width,world.height].join(':');
    const old=this.actualViewSample301;if(old?.mapKey===mapKey&&now-old.at<100)return old.view;
    const rect=this.renderer.domElement.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0){this.actualViewSample301={mapKey,at:now,view:null};return null;}
    const view=actualCameraView301(this.camera,mapId,world.width,world.height,this.rig.span);
    this.actualViewSample301={mapKey,at:now,view};return view;
  }
  protected createSelectionRectanglePort():((bounds:{left:number;top:number;width:number;height:number}|null)=>void)|undefined{return undefined;}
  private readonly selectionInput:PawnSelectionInput;
  private readonly deferredHover=new DeferredMapHover();
  private areaPointer: { x:number; y:number } | undefined;
  private eyedropperPress:{pointerId:number;x:number;y:number;floor:CarpetFloor355}|undefined;
  private orderRightPress: {pointerId:number;x:number;y:number;at:number;tool:string;moved:boolean} | null = null;
  private cameraOnlyPointer:number|undefined;
  private readonly resizeObserver:ResizeObserver;
  private releaseMapWheel: (() => void) | undefined;
  protected readonly mapLabels:MapLabelsOverlay;
  private environmentOverlay:EnvironmentStatsOverlay|undefined;
  setEnvironmentStats(stats:NativeEnvironmentStats|null):void{
    const world=this.world;if(this.disposed)return;
    if(!world||!stats){this.environmentOverlay?.update(world?.width??0,world?.height??0,null);return;}
    if(!this.environmentOverlay){this.environmentOverlay=new EnvironmentStatsOverlay();this.scene.add(this.environmentOverlay.group);}
    this.environmentOverlay.update(world.width,world.height,stats);
  }
  presentEnvironment(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,height:number,cellPixels:number):void{this.environmentOverlay?.present(camera,height,cellPixels);}
  prepareEnvironmentForCompile():()=>void{return this.environmentOverlay?.prepareForCompile()??(()=>{});}
  disposeEnvironment():void{this.environmentOverlay?.dispose();this.environmentOverlay=undefined;}
  setItemLabelMinCellPixels(value:number):void {this.mapLabels.setMinCellPixels(value);}
  setBedOwnerLabelsVisible(visible:boolean):void {this.mapLabels.setBedOwnerLabelsVisible(visible);}
  /** Native game pages may keep their command context while the player looks
   * around it. The ordinary/legacy input owner keeps its existing behavior. */
  protected cameraOnlyInput():boolean{return false;}
  private beginCameraOnlyInput(event:PointerEvent):boolean{
    if((event.button!==1&&event.button!==2)||!this.cameraOnlyInput())return false;
    this.selectionInput.cancel();this.keys.clear();this.orderRightPress=null;
    this.cameraOnlyPointer=event.pointerId;this.pointerDown={x:event.clientX,y:event.clientY,button:event.button,pointerId:event.pointerId};
    this.renderer.domElement.focus({preventScroll:true});this.deferredHover.beginCamera(event);return true;
  }
  private endCameraOnlyInput(event:PointerEvent):boolean{
    if(this.cameraOnlyPointer!==event.pointerId)return false;
    this.cameraOnlyPointer=undefined;this.pointerDown=null;return true;
  }
  static async create(host: HTMLElement, onPick: (x: number, z: number, preferred?: MapObjectSelection) => void, groundGrassEnabled = true,graphics?:GraphicsStylePreferences): Promise<ColonyRenderer> {
    const graphicsContext=new GraphicsStyleContext(graphics);
    const options = { antialias: true, alpha: false, powerPreference: 'high-performance' as const };
    // Ask for the adapter's own inter-stage ceiling (default device: 16), so no
    // actor material variant fails WebGPU pipeline validation at 17 inputs.
    const requiredLimits = await adapterRendererLimits();
    let renderer = new ReentrantRenderer(requiredLimits ? { ...options, requiredLimits } : options);
    const lifetime: RendererLifetime = { closed: false };
    let view: ColonyRenderer | undefined;
    try {
      await renderer.init();
      // Three silently falls back to WebGL when a WebGPU device request fails.
      // Never let the raised limit be the cause: retry with the default request.
      if (requiredLimits && (renderer.backend as { isWebGPUBackend?: boolean } | undefined)?.isWebGPUBackend !== true) {
        const refused = renderer;
        renderer = new ReentrantRenderer(options);
        try { await refused.dispose(); refused.domElement.remove(); } catch { /* The retained default renderer owns the result. */ }
        await renderer.init();
      }
      view = withGraphicsStyle(graphicsContext,()=>new this(host, onPick, renderer, groundGrassEnabled, lifetime));
      if (view.fatalError) throw new Error(view.fatalError);
      const ready = view;
      renderer.setAnimationLoop((time) => {
        try { ready.frame(time); } catch (error) { ready.reportFailure(error instanceof Error ? error.message : String(error)); }
      });
      return view;
    } catch (error) {
      try { if (view) view.dispose(); else if (!lifetime.closed) { renderer.setAnimationLoop(null); lifetime.closed = true; await renderer.dispose(); renderer.domElement.remove(); } }
      catch { /* Preserve the initialization failure even if teardown fails. */ }
      if(!view)graphicsContext.dispose();
      throw error;
    }
  }

  protected constructor(private readonly host:HTMLElement,private readonly onPick:(x:number,z:number,preferred?:MapObjectSelection)=>void,
    renderer:THREE.WebGPURenderer,grassEnabled:boolean,lifetime:RendererLifetime){
    const dom=createDomPort(host,renderer);
    super(renderer,grassEnabled,lifetime,dom.port);
    dom.bind(this);this.mapLabels=dom.labels();this.scene.add(this.mapLabels.mesh);
    try {    this.selectionInput=new PawnSelectionInput(this.renderer.domElement,{
      rectangle:this.createSelectionRectanglePort(),
      enabled:()=>this.tool==='select'&&!document.querySelector('dialog[open]'),
      pawns:()=>this.screenPawns(),select:gesture=>this.onSelection(gesture),
      selected:()=>this.selectedPawns,
      canInspect:event=>{
        const c=this.objectTarget(event)?.cell,w=this.world;if(!c||!w)return false;
        return mapObjectsAt(w,c).length>0;
      },
      preferObjectCycle:event=>{
        const cell=this.objectTarget(event)?.cell,world=this.world,selected=this.selectedObject;
        if(!cell||!world||!selected)return false;
        const objects=mapObjectsAt(world,cell),index=objects.findIndex(object=>sameMapObject(object,selected));
        return index>=0&&(index<objects.length-1||hitActors(this.screenPawns(),event.clientX,event.clientY).length===0);
      },
      inspect:event=>{const target=this.objectTarget(event);if(target)this.onPick(target.cell.x,target.cell.z,target.preferred);else this.onSelection({ids:[],additive:false,toggle:false});},
      inspectGroup:event=>{
        const world=this.world,hit=this.objectPickAt(event.clientX,event.clientY);if(!world||!hit)return false;
        // The two ordinary clicks may have cycled the inspector. Resolve the
        // physical hit again; the final cycling slot is not the double-click target.
        if(hitActors(this.screenPawns(),event.clientX,event.clientY).length)return false;
        const target=mapObjectGroupTarget(world,[...(hit.preferred?[hit.preferred]:[]),...mapObjectsAt(world,hit.cell)]);if(!target)return false;
        this.camera.updateMatrixWorld();const point=new THREE.Vector3();
        const objects=matchingMapObjects(world,target,c=>{
          point.set(c.x,.1,c.z).project(this.camera);
          return point.z>=cameraClipNear(this.camera)&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1;
        });
        if(!objects.length)return false;
        this.onObjectSelection(objects,event.shiftKey);return true;
      },
      rectangleSelect:(x1,y1,x2,y2,shift)=>this.selectInsideBox(x1,y1,x2,y2,shift),
      lock:locked=>{this.controls.enabled=!locked;this.keys.clear();},
    });
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerCancel);
    this.renderer.domElement.addEventListener('lostpointercapture', this.onPointerCancel);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.releaseMapWheel = installMapWheelZoom(document.body,
      this.renderer.domElement, () => !!this.world && this.controls.enabled && !this.host.closest('[inert]'));
    window.addEventListener('keydown', this.onKeyDown);
    // Menus stop bubbling keyboard events; release keys held before opening one.
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    }catch(error){try{this.dispose();}catch{}throw error;}
  }
  private pick(event:PointerEvent,clamp=false):Cell|null{return this.pickAt(event.clientX,event.clientY,clamp);}
  /**
   * Core Selector.SelectInsideDragBox, its predicates in order, the first that
   * finds something wins: player colonists (colonist bar order), other
   * humanlike pawns, items counted as resources, any pawn (animals,
   * mechanoids), then any other multi-selectable thing (buildings,
   * blueprints, frames, other items, bodies); then zones, or plans when the
   * box holds some (a plan selection clears the zones). Evaluated on release.
   */
  private selectInsideBox(x1:number,y1:number,x2:number,y2:number,shift:boolean):boolean{
    const left=Math.min(x1,x2),right=Math.max(x1,x2),top=Math.min(y1,y2),bottom=Math.max(y1,y2);
    const inside=this.screenPawns().filter(p=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom),world=this.world;
    // The map objects are projected only when no person is in the box.
    let objects;
    if(world&&!inside.some(p=>(p.category??0)<=1)){
      this.camera.updateMatrixWorld();
      const rect=this.hostPort.surfaceRect(),point=new THREE.Vector3(),near=cameraClipNear(this.camera);
      objects=mapObjectsInRect(world,cell=>{
        point.set(cell.x,0,cell.z).project(this.camera);
        if(point.z<near||point.z>1)return false;
        const x=rect.left+(point.x+1)/2*rect.width,y=rect.top+(1-point.y)/2*rect.height;
        return x>=left&&x<=right&&y>=top&&y<=bottom;
      });
    }
    const chosen=boxSelection(inside,objects);
    if(!chosen)return false;
    if('pawns' in chosen)this.onSelection({ids:chosen.pawns,additive:shift,toggle:false});else this.onObjectSelection(chosen.objects,shift);
    return true;
  }
  /** Cell whose things a selection click lists: a drawn wall lamp first, then
   * the model met first along the camera ray (with that thing to select
   * first), else the ground cell. One pick per click event. */
  private objectTarget(event:PointerEvent):{cell:Cell;preferred?:MapObjectSelection}|null{
    if(this.lastObjectTarget?.event===event)return this.lastObjectTarget.target;
    const lamp=this.wallAttachmentCellAt(event.clientX,event.clientY);
    const target=lamp?{cell:lamp}:this.objectPickAt(event.clientX,event.clientY);
    this.lastObjectTarget={event,target};return target;
  }
  private lastObjectTarget:{event:PointerEvent;target:{cell:Cell;preferred?:MapObjectSelection}|null}|undefined;
  private readonly onVisibility=():void=>this.visibilityChanged();
  /** DOM methods are consumed only by the owned port; no guard writer here. */
  selectionReady():boolean{return !!this.selectionInput;}
  selectionActive():boolean{return !!this.selectionInput?.active;}
  override cancelDesignation(reason: 'interaction' | 'presentation' = 'interaction'):boolean {
    this.orderRightPress=null;const sample=this.eyedropperPress;this.eyedropperPress=undefined;
    if(sample){this.pointerDown=null;const canvas=this.renderer.domElement;if(canvas.hasPointerCapture(sample.pointerId))canvas.releasePointerCapture(sample.pointerId);}
    return super.cancelDesignation(reason)||!!sample;
  }
  cancelSelection():boolean{return this.selectionInput?.cancel()??false;}
  disposeSelection():void{this.selectionInput?.dispose();}
  disconnectResize():void{this.resizeObserver?.disconnect();}
  removeInputListeners():void{
    this.deferredHover.clear();
    this.releaseMapWheel?.();this.releaseMapWheel=undefined;
    const canvas=this.renderer.domElement;
    canvas.removeEventListener('pointerdown',this.onPointerDown,true);
    canvas.removeEventListener('pointerup',this.onPointerUp);
    canvas.removeEventListener('pointermove',this.onPointerMove);
    canvas.removeEventListener('pointerleave',this.onPointerLeave);
    canvas.removeEventListener('pointercancel',this.onPointerCancel);
    canvas.removeEventListener('lostpointercapture',this.onPointerCancel);
    canvas.removeEventListener('contextmenu',this.onContextMenu);
    window.removeEventListener('keydown',this.onKeyDown);
    window.removeEventListener('keyup',this.onKeyUp,true);
    window.removeEventListener('blur',this.onBlur);
    document.removeEventListener('visibilitychange',this.onVisibility);
  }
  private onPointerDown = (event: PointerEvent): void => {
    if(this.beginCameraOnlyInput(event))return;
    this.setDesignationControl(event.ctrlKey);
    this.onInteractionCancel('interaction');
    this.renderer.domElement.focus({preventScroll:true});
    if(this.selectionInput.down(event)){this.deferredHover.clear();return;}
    if (this.areaDrag||this.eyedropperPress) {
      if (event.button === 2) this.cancelDesignation();
      event.stopImmediatePropagation(); event.preventDefault(); return;
    }
    // OrbitControls owns right-button camera navigation. Decide whether this was a brief
    // click only on release; a hold or any pan keeps the selected tool armed.
    if (event.button === 2 && this.tool !== 'select') this.orderRightPress={
      pointerId:event.pointerId,x:event.clientX,y:event.clientY,at:event.timeStamp,tool:this.tool,moved:false,
    };
    this.pointerDown = { x: event.clientX, y: event.clientY, button: event.button, pointerId: event.pointerId };
    this.renderer.domElement.focus({ preventScroll: true });
    if(event.button===1||event.button===2)this.deferredHover.beginCamera(event);
    const from = event.button===0?this.pick(event):null;
    if(event.button===0&&event.isPrimary&&from&&event.ctrlKey&&this.tool==='lay-floor'&&isCarpetFloor355(this.selectedFloor)){
      // A colour sample is a different gesture from a floor designation.
      // Consume the entire press even if the sampled tile is not a carpet.
      event.stopImmediatePropagation();event.preventDefault();this.pointerDown=null;this.keys.clear();
      this.eyedropperPress={pointerId:event.pointerId,x:event.clientX,y:event.clientY,floor:this.selectedFloor};
      this.renderer.domElement.setPointerCapture(event.pointerId);this.hoverCell=from;this.updateHover();return;
    }
    if (event.button === 0 && event.isPrimary && from && (isAreaAction(this.tool) || isLineBuildKind(this.tool)||this.tool==='allowed-expand'||this.tool==='allowed-shrink')) {
      event.stopImmediatePropagation(); event.preventDefault();
      this.areaDrag = this.tool==='allowed-expand'||this.tool==='allowed-shrink'?{pointerId:event.pointerId,allowed:this.tool==='allowed-expand',from}:isLineBuildKind(this.tool)
        ? { pointerId: event.pointerId, kind: this.tool, from, material: this.constructionMaterial }
        : { pointerId: event.pointerId, action: this.tool as AreaAction, from };
      // The initial press never reaches OrbitControls. Keep its wheel handler
      // available; subsequent pointer presses are consumed by the drag branch.
      this.controls.enabled = true; this.keys.clear();
      this.areaPointer = { x:event.clientX, y:event.clientY };
      this.deferredHover.clear();
      this.renderer.domElement.setPointerCapture(event.pointerId);
      this.hoverCell = from; this.areaSignature = ''; this.updateHover();
    }
  };
  private onPointerUp = (event: PointerEvent): void => {
    this.deferredHover.release(event);
    if(this.endCameraOnlyInput(event))return;
    const sample=this.eyedropperPress;if(sample&&sample.pointerId===event.pointerId&&event.button===0){
      this.eyedropperPress=undefined;this.pointerDown=null;
      if(this.renderer.domElement.hasPointerCapture(event.pointerId))this.renderer.domElement.releasePointerCapture(event.pointerId);
      this.setDesignationControl(event.ctrlKey);
      if(this.tool==='lay-floor'&&this.selectedFloor===sample.floor&&Math.hypot(event.clientX-sample.x,event.clientY-sample.y)<=6&&this.pointerOnCanvas(event)){
        const cell=this.pick(event);if(cell)this.onCarpetEyedropper(cell);
      }
      return;
    }
    if(this.selectionInput.up(event))return;
    const right=this.orderRightPress;
    if(right&&event.pointerId===right.pointerId&&event.button===2){
      this.orderRightPress=null;this.pointerDown=null;
      if(this.tool===right.tool&&!right.moved&&Math.hypot(event.clientX-right.x,event.clientY-right.y)<=6
        &&event.timeStamp-right.at<250&&this.pointerOnCanvas(event)){
        this.cancelDesignation();this.onExitOrder();
      }
      return;
    }
    const drag = this.areaDrag;
    if (drag) {
      if (event.pointerId !== drag.pointerId || event.button !== 0) return;
      const raw = this.pointerOnCanvas(event) ? this.pick(event, true) : null,to=raw?this.areaDragEndpoint(drag,raw,event.ctrlKey):null;
      this.cancelDesignation();
      if (to) {
        if('allowed' in drag)this.onAllowedAreaPaint(drag.allowed,drag.from,to);
        else if ('action' in drag) this.onArea(drag.action, drag.from, to);
        else this.onBuildLine(drag.kind, drag.from, to, drag.material);
      }
      return;
    }
    const down = this.pointerDown; this.pointerDown = null;
    if(down&&down.button===2&&event.button===2&&down.pointerId===event.pointerId&&this.tool==='select'&&Math.hypot(down.x-event.clientX,down.y-event.clientY)<=6) {
      // Like the left click: a person or animal under the mouse first, then
      // the drawn model met by the camera ray (tree crown, wall face, pile
      // side), then the ground cell (Core FloatMenuContext.ClickedThings).
      const actor=hitActors(this.screenPawns(),event.clientX,event.clientY)[0]?.id;
      const cell=actor===undefined?this.objectTarget(event)?.cell??this.pick(event):this.pick(event);
      if(cell)this.onContext(cell,event.clientX,event.clientY,event.shiftKey,actor);return;
    }
    if (!down || down.pointerId !== event.pointerId || down.button !== 0 || event.button !== 0 || Math.hypot(down.x - event.clientX, down.y - event.clientY) > 6) return;
    const cell = this.pick(event);
    if (!cell) return;
    this.onPick(cell.x, cell.z);
  };
  private onPointerMove = (event: PointerEvent): void => {
    this.setDesignationControl(event.ctrlKey);
    const right=this.orderRightPress;
    if(right&&event.pointerId===right.pointerId&&Math.hypot(event.clientX-right.x,event.clientY-right.y)>6)right.moved=true;
    if(this.selectionInput.move(event)){this.deferredHover.clear();return;}
    if (this.areaDrag && event.pointerId !== this.areaDrag.pointerId) return;
    if (this.areaDrag) this.areaPointer = { x:event.clientX, y:event.clientY };
    // A second mouse button changes `buttons` through pointermove, without a new pointerdown.
    if (this.areaDrag && (event.buttons & 2)) { event.preventDefault(); this.cancelDesignation(); return; }
    if(this.areaDrag)return; // Existing RAF path presents the latest areaPointer.
    this.deferredHover.move(event);
  };
  protected refreshAreaPointer():void {
    if(!this.areaDrag){
      const point=this.deferredHover.take();if(!point)return;
      const previous=this.hoverCell;
      this.hoverCell=document.elementFromPoint(point.x,point.y)===this.renderer.domElement?this.pickAt(point.x,point.y):null;
      if(previous?.x!==this.hoverCell?.x||previous?.z!==this.hoverCell?.z)this.onHover(this.hoverCell);
      this.updateHover();return;
    }
    if (!this.areaPointer) return;
    const {x,y}=this.areaPointer;
    const next=document.elementFromPoint(x,y)===this.renderer.domElement?this.pickAt(x,y,true):null;
    if (next?.x===this.hoverCell?.x && next?.z===this.hoverCell?.z) return;
    this.hoverCell=next; this.onHover(next); this.updateHover();
  }
  private pointerOnCanvas(event: PointerEvent): boolean {
    return document.elementFromPoint(event.clientX, event.clientY) === this.renderer.domElement;
  }
  private onPointerLeave = (): void => {
    this.deferredHover.leave();
    if(this.orderRightPress)this.orderRightPress.moved=true;
    if(!this.preparing)this.recreationHints.group.visible=false;
    if(!this.preparing)this.constructionPreview.hide();
    this.hoverCell = null; if(!this.preparing)this.hover.visible = false;
    this.onHover(null);
    if (this.areaDrag) this.updateAreaPreview(); else {this.pointerDown = null;this.updateHover();}
  };
  private onPointerCancel = (event: PointerEvent): void => {
    if(this.eyedropperPress?.pointerId===event.pointerId)this.eyedropperPress=undefined;
    if(this.cameraOnlyPointer===event.pointerId)this.cameraOnlyPointer=undefined;
    this.deferredHover.cancel(event.pointerId);
    if(this.orderRightPress?.pointerId===event.pointerId)this.orderRightPress=null;
    if(this.selectionInput.active){this.selectionInput.cancel();return;}
    if (this.areaDrag?.pointerId === event.pointerId) this.cancelDesignation();
    else if (this.pointerDown?.pointerId === event.pointerId) this.pointerDown = null;
  };
  private onContextMenu = (event: Event): void => { event.preventDefault(); };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.host.closest('[inert]')) { this.keys.clear(); return; }
    if(event.key==='Control'&&!event.defaultPrevented&&!document.querySelector('dialog[open]')&&!(event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable))){this.setDesignationControl(true);return;}
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    if (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return;
    const key = event.key.toLowerCase();
    if(key==='pageup'||key==='pagedown'){event.preventDefault();if(this.world&&this.controls.enabled&&this.hostPort.canMoveCamera()){this.rig.pageZoom?.(key==='pageup'?'out':'in');this.invalidatePausedShadow();}return;}
    // Q/E rotate a bed in Architecte. Outside placement, Q retains AZERTY pan.
    if ((this.tool === 'install' || this.tool in STRUCTURE_DEFINITIONS) && (key === 'q' || key === 'e')) return;
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'q', 'a', 'd', 'z', 'w', 's'].includes(key)) {
      this.keys.add(key); if (key.startsWith('arrow')) event.preventDefault();
    }
  };
  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.key.toLowerCase());if(event.key==='Control')this.setDesignationControl(event.ctrlKey); };
  private onBlur = (): void => { this.cameraOnlyPointer=undefined;this.deferredHover.resume();this.keys.clear();this.cancelDesignation();this.setDesignationControl(false); };


}

export type {AudioFrameView} from './SceneRenderCore';
