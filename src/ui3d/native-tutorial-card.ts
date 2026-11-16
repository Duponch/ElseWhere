import * as THREE from 'three/webgpu';
import {PALETTE,drawHandRect,type CardboardPiece,type CardboardPieceOptions,type PrototypeCardboardArt} from './prototype-art';
import {wrapNativeText} from './native-layout';
import {TUTORIAL_INTRO_HOLD_349,TUTORIAL_INTRO_SLIDE_349,type TutorialCardView349} from '../ui/tutorial-engine-349';

/** The lesson card of the tutorial (Core Lesson_Instruction.LessonOnGUI): a
 * 310 px carton card at the top right with the instruction and, for a
 * lesson that counts something, a 30 px progress bar. A white flash fades
 * over half a second when a lesson starts; the first lesson opens centered
 * on a dark overlay, then slides to its corner. Presentation only. */
const FONT='"Comic Sans MS", "Chalkboard SE", Georgia, serif';
/** Core Lesson_Instruction: 310 px wide, 17 px margins, 10 px padding, 30 px bar. */
const WIDTH=310,MARGIN=17,PAD=10,LINE=18,TEXT=13,BAR=30,BAR_GAP=17;
/** Below the help button of the top-right corner. */
const TOP=44;
/** In front of pages and drop-down lists (pages sit at 0.18, lists at 1.6). */
const Z=1.7,HUD_DISTANCE=7.5,FACTOR=1-Z/HUD_DISTANCE;
const FLASH_SECONDS=.5;
const introAt=(age:number)=>{const t=Math.max(0,Math.min(1,(age-TUTORIAL_INTRO_HOLD_349)/TUTORIAL_INTRO_SLIDE_349));return {centered:1-t,overlay:.9*(1-t)};};

export class NativeTutorialCard {
  private readonly root=new THREE.Group();
  private readonly measureCtx:CanvasRenderingContext2D;
  private panel:CardboardPiece|undefined;
  private panelKey='';
  private blocker:CardboardPiece|undefined;
  private readonly flashMaterial=new THREE.MeshBasicNodeMaterial({color:0xffffff,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
  private readonly flash=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.flashMaterial);
  private readonly overlayMaterial=new THREE.MeshBasicNodeMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
  private readonly overlay=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.overlayMaterial);
  private view:TutorialCardView349|undefined;
  private visible=false;
  private width=1440;private height=1000;private unit=.01;
  private height_=0;
  private disposed=false;

  constructor(private readonly art:PrototypeCardboardArt,hudRoot:THREE.Object3D,private readonly now:()=>number){
    const ctx=document.createElement('canvas').getContext('2d');
    if(!ctx)throw Error('Canvas 2D is required for the tutorial card.');
    this.measureCtx=ctx;
    this.flash.renderOrder=10;this.overlay.renderOrder=-1;this.flash.visible=false;this.overlay.visible=false;
    this.root.add(this.overlay,this.flash);this.root.visible=false;
    hudRoot.add(this.root);
  }
  /** Pixel conversion of the HUD (world units per CSS pixel at the HUD plane). */
  setViewport(width:number,height:number,unitsPerPixel:number):void {
    if(this.width===width&&this.height===height&&this.unit===unitsPerPixel)return;
    this.width=width;this.height=height;this.unit=unitsPerPixel;this.apply(true);
  }
  /** The card of the active lesson; hidden without one. True when it changed. */
  update(view:TutorialCardView349|undefined,visible:boolean):boolean {
    if(this.disposed)return false;
    const same=this.view===view||!!this.view&&!!view&&this.view.lesson===view.lesson&&this.view.text===view.text&&this.view.progress===view.progress&&this.view.activatedAt===view.activatedAt&&!view.intro&&!this.view.intro;
    this.view=view;
    if(same&&this.visible===visible)return false;
    this.visible=visible;this.apply(false);return true;
  }
  /** Per frame while the flash or the intro slide runs; true asks for a redraw. */
  animate():boolean {
    if(this.disposed||!this.visible||!this.view)return false;
    const age=(this.now()-this.view.activatedAt)/1000,flash=age<FLASH_SECONDS?1-age/FLASH_SECONDS:0;
    const moving=!!this.view.intro||flash>0||this.flash.visible;
    if(!moving)return false;
    this.place();
    this.flashMaterial.opacity=flash;this.flash.visible=flash>0;
    return true;
  }
  get shownHeight():number {return this.visible&&this.view?this.height_:0;}
  dispose():void {
    if(this.disposed)return;this.disposed=true;
    if(this.panel)this.art.disposePiece(this.panel);if(this.blocker)this.art.disposePiece(this.blocker);
    this.flash.geometry.dispose();this.overlay.geometry.dispose();this.flashMaterial.dispose();this.overlayMaterial.dispose();
    this.root.removeFromParent();
  }

  private measure=(text:string,size:number):number=>{this.measureCtx.font=`${size}px ${FONT}`;return this.measureCtx.measureText(text).width;};
  private apply(viewportChanged:boolean):void {
    if(this.disposed)return;
    const view=this.view,shown=this.visible&&!!view;
    this.root.visible=shown;
    if(!shown||!view){this.flash.visible=false;this.overlay.visible=false;if(this.blocker)this.blocker.visible=false;return;}
    const lines=wrapNativeText(view.text,WIDTH-2*PAD,this.measure,TEXT),bar=view.progress!==undefined;
    const height=lines.length*LINE+2*PAD+(bar?BAR+BAR_GAP:0);this.height_=height;
    const key=`${lines.join('\n')}|${bar?Math.round(view.progress!*1000):''}|${height}`;
    if(!this.panel||this.panel.userData.height!==height||viewportChanged){
      if(this.panel){this.art.disposePiece(this.panel);this.panel=undefined;}
      const draw=(c:CanvasRenderingContext2D,w:number,h:number,rng:()=>number)=>this.draw(c,w,h,lines,view.progress,height,rng);
      this.panel=this.piece({w:WIDTH*.01,h:height*.01,depth:.046,bgColor:PALETTE.creamPaper,bevel:.038,surface:'panel',seed:9601,uvPadding:1,
        textureWidth:WIDTH*2,textureHeight:Math.ceil(height*2),interactive:true,drawFn:draw});
      this.panel.userData.nativeId='hud:tutorial:card';this.panel.userData.nativeStatic=true;this.panel.userData.height=height;this.panelKey=key;
      this.root.add(this.panel);
    }else if(key!==this.panelKey){
      this.panelKey=key;const progress=view.progress;
      this.panel.redraw((c,w,h,rng)=>this.draw(c,w,h,lines,progress,height,rng));
    }
    this.place();
  }
  /** Card at the top right, or centered during the intro, at the HUD plane. */
  private place():void {
    const view=this.view;if(!view||!this.panel)return;
    const height=this.height_,k=this.unit*FACTOR;
    // The intro is timed here, every frame, from the activation (Core: 4 s
    // centered on a 90 % overlay, then a 1 s slide to the corner).
    const intro=view.intro?introAt((this.now()-view.activatedAt)/1000):undefined;
    const corner={x:this.width-MARGIN-WIDTH/2,y:TOP+height/2},center={x:this.width/2,y:this.height/2},t=intro?.centered??0;
    const x=corner.x+(center.x-corner.x)*t,y=corner.y+(center.y-corner.y)*t;
    this.root.scale.setScalar(1);this.root.position.set(0,0,Z);
    const toWorld=(px:number,py:number)=>({x:(px-this.width/2)*k,y:(this.height/2-py)*k});
    const at=toWorld(x,y),scale=100*k;
    this.panel.scale.setScalar(scale);this.panel.setBaseTransform(at.x,at.y,0);
    this.flash.position.set(at.x,at.y,.06);this.flash.scale.set(WIDTH*k,height*k,1);
    const overlay=intro?.overlay??0;
    this.overlay.visible=overlay>0;this.overlayMaterial.opacity=overlay;
    this.overlay.position.set(0,0,-.02);this.overlay.scale.set(this.width*k,this.height*k,1);
    // Core absorbInputAroundWindow: an invisible full-screen hit surface.
    if(overlay>0&&!this.blocker){
      this.blocker=this.piece({w:this.width*.01,h:this.height*.01,hitOnly:true,interactive:true,drawFn:()=>{}});
      this.blocker.userData.nativeId='hud:tutorial:intro';this.blocker.userData.nativeStatic=true;this.root.add(this.blocker);
    }
    if(this.blocker){
      this.blocker.visible=overlay>0;
      if(overlay>0){this.blocker.scale.setScalar(scale);this.blocker.setBaseTransform(0,0,-.01);}
    }
  }
  private draw(ctx:CanvasRenderingContext2D,wPx:number,hPx:number,lines:readonly string[],progress:number|undefined,height:number,rng:()=>number):void {
    ctx.save();ctx.scale(wPx/WIDTH,hPx/height);
    drawHandRect(ctx,4,6,4,height-12,PALETTE.ochre,null,0,rng);
    ctx.font=`${TEXT}px ${FONT}`;ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='left';
    lines.forEach((line,index)=>ctx.fillText(line,PAD+4,PAD+TEXT+index*LINE,WIDTH-2*PAD-4));
    if(progress!==undefined){
      const y=height-PAD-BAR,inner=WIDTH-2*PAD;
      drawHandRect(ctx,PAD,y,inner,BAR,PALETTE.kraftLight,PALETTE.inkDark,1.2,rng);
      if(progress>0)drawHandRect(ctx,PAD+2,y+2,Math.max(2,(inner-4)*Math.min(1,progress)),BAR-4,PALETTE.sageMountain,null,0,rng);
      ctx.font=`bold ${TEXT}px ${FONT}`;ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='center';
      ctx.fillText(`${Math.round(Math.min(1,progress)*100)} %`,WIDTH/2,y+BAR/2+5);
    }
    ctx.restore();
  }
  private piece(options:CardboardPieceOptions):CardboardPiece {return this.art.createPiece(options);}
}
