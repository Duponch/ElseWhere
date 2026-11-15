import * as THREE from 'three/webgpu';
import {PALETTE,drawHandBlob,drawHandRect,type CardboardPiece,type CardboardPieceOptions,type PrototypeCardboardArt} from './prototype-art';
import {wrapNativeText} from './native-layout';
import {GUIDANCE_STATUS_LABELS,guidanceTabLabel,readGuidanceCard,readGuidanceGesture,startingArrivalPending,type GuidanceCardMode,type GuidanceCardModel,type GuidanceCardSession} from '../ui/guidance-card';
import type {FirstDayGuideAction,FirstDayGuideSection,FirstDayGuideStatus} from '../ui/first-day-guide';
import type {FirstGesturesLearning} from '../ui/first-gestures-learning';
import type {World} from '../sim/types';

/** Player actions offered by the card. Each one is an existing interface
 * route; none is a game command or a learning record by itself. */
export interface NativeGuidanceActions {
  openHelp():void;
  expand():void;
  collapse():void;
  close():void;
  guide(action:FirstDayGuideAction):void;
  startGestures():void;
  declareGesture():void;
  invalidate?():void;
}
export interface NativeGuidanceView {visible:boolean;mode:GuidanceCardMode;model:GuidanceCardModel}
export interface NativeGuidanceAnchors {topLeft:THREE.Group;topRight:THREE.Group}

const FONT='"Comic Sans MS", "Chalkboard SE", Georgia, serif';
const STATUS_COLORS:Record<FirstDayGuideStatus,string>={ready:PALETTE.sageMountain,started:PALETTE.ochre,missing:PALETTE.terracotta,optional:PALETTE.kraftLight};
/** Resource rows kept above the card before it shortens itself. */
const MIN_RESOURCES=140;
const PAD=10,ROW=18,BUTTON=24,TAB=28,COMPACT_CHECKS=4;

type Ink={kind:'text';text:string;x:number;y:number;size:number;bold?:boolean;color:string;width:number}
  |{kind:'dot';x:number;y:number;color:string}|{kind:'rule';y:number};
interface ButtonBox {id:string;label:string;hint:string;x:number;y:number;width:number;height:number;color:string;onClick:()=>void}
interface RowBox {id:string;hint:string;y:number;onClick:()=>void}
interface CardLayout {variant:'full'|'compact'|'tab'|'none';width:number;height:number;ink:Ink[];buttons:ButtonBox[];rows:RowBox[]}

/** The advice card of the native play view: compact first-day facts and the
 * four optional gestures, painted on the same cardboard as the HUD. It sits
 * at the bottom of the left column, above the Orders and Zones dock; the
 * resource list keeps the space above it. Pages still cover it. A small help
 * button beside the frame-rate counter opens the survival notebook. */
export class NativeGuidanceCard {
  private readonly cardGroup=new THREE.Group();
  private readonly helpGroup=new THREE.Group();
  private readonly helpButton:CardboardPiece;
  private readonly measureCtx:CanvasRenderingContext2D;
  private readonly owned=new Set<CardboardPiece>();
  private panel:CardboardPiece|undefined;
  private panelInk='';
  private readonly buttons=new Map<string,CardboardPiece>();
  private readonly rows=new Map<string,CardboardPiece>();
  private view:NativeGuidanceView|undefined;
  private viewportWidth=1440;
  private viewportHeight=1000;
  private leftHudBottom=Infinity;
  private hudVisible=false;
  private reserve=0;
  private variant:CardLayout['variant']='none';
  private disposed=false;

  constructor(private readonly art:PrototypeCardboardArt,anchors:NativeGuidanceAnchors,private readonly actions:NativeGuidanceActions){
    anchors.topLeft.add(this.cardGroup);anchors.topRight.add(this.helpGroup);
    const ctx=document.createElement('canvas').getContext('2d');
    if(!ctx)throw Error('Canvas 2D is required for the native advice card.');
    this.measureCtx=ctx;
    this.helpButton=this.piece({w:.52,h:.24,depth:.036,bgColor:PALETTE.kraftLight,bevel:.03,seed:9411,interactive:true,hasBorder:false,uvPadding:1,textureWidth:104,textureHeight:48,
      tooltip:'Aide · carnet de survie (H)',drawFn:(c,w,h)=>this.drawLabel(c,w,h,'Aide',52,24),onClick:()=>this.actions.openHelp()});
    this.helpButton.userData.nativeId='hud:help';
    this.helpButton.setBaseTransform(-1.06,-.12,.02);
    this.helpGroup.add(this.helpButton);
    this.setViewport(1440,1000,.01);
    this.apply();
  }

  /** Same pixel conversion as the HUD cards; leftHudBottom is the free bottom
   * of the left column, in screen pixels from the top. */
  setViewport(width:number,height:number,unitsPerPixel:number,leftHudBottom=Infinity):void {
    const scale=100*unitsPerPixel;
    this.cardGroup.scale.setScalar(scale);this.helpGroup.scale.setScalar(scale);
    if(this.viewportWidth===width&&this.viewportHeight===height&&this.leftHudBottom===leftHudBottom)return;
    this.viewportWidth=width;this.viewportHeight=height;this.leftHudBottom=leftHudBottom;
    this.apply();
  }
  /** Follows the HUD: hidden with the front menu and the loading screens. */
  setHudVisible(visible:boolean):void {
    if(this.hudVisible===visible)return;
    this.hudVisible=visible;this.apply();
  }
  /** Called at the snapshot cadence: an unchanged view repaints nothing. */
  update(view:NativeGuidanceView):void {
    if(this.disposed)return;
    const before=this.view;this.view=view;
    if(before&&before.visible===view.visible&&before.mode===view.mode&&(before.model===view.model||view.mode!=='expanded'&&guidanceTabLabel(before.model.gesture)===guidanceTabLabel(view.model.gesture)))return;
    this.apply();
  }
  /** Pixels used at the bottom of the left column, 0 when nothing is shown. */
  get reservedHeight():number {return this.reserve;}
  get shownVariant():CardLayout['variant'] {return this.variant;}

  dispose():void {
    if(this.disposed)return;this.disposed=true;
    for(const piece of this.owned)this.art.disposePiece(piece);
    this.owned.clear();this.buttons.clear();this.rows.clear();this.panel=undefined;
    this.cardGroup.removeFromParent();this.helpGroup.removeFromParent();
  }

  private apply():void {
    if(this.disposed)return;
    const shown=this.hudVisible&&!!this.view?.visible;
    const layout=shown&&this.view?this.layout(this.view):{variant:'none' as const,width:0,height:0,ink:[],buttons:[],rows:[]};
    this.variant=layout.variant;this.reserve=layout.variant==='none'?0:layout.height+12;
    this.render(layout);
    // Group visibility is not a paint change: ask for one frame only then.
    const card=layout.variant!=='none';
    if(this.helpGroup.visible!==this.hudVisible||this.cardGroup.visible!==card){
      this.helpGroup.visible=this.hudVisible;this.cardGroup.visible=card;this.actions.invalidate?.();
    }
  }
  /** Bottom of the free left column, in pixels below the HUD anchor. */
  private columnBottom():number {return (Number.isFinite(this.leftHudBottom)?this.leftHudBottom:this.viewportHeight-110)-16;}

  private text(text:string,size:number,bold=false):number {this.measureCtx.font=`${bold?'bold ':''}${size}px ${FONT}`;return this.measureCtx.measureText(text).width;}
  private wrap(text:string,width:number,size:number,bold=false,max=Infinity):string[] {
    const lines=wrapNativeText(text,width,(value,s)=>this.text(value,s,bold),size).filter(line=>line.length>0);
    if(lines.length<=max)return lines;
    const kept=lines.slice(0,max);kept[max-1]=`${kept[max-1]}…`;return kept;
  }

  private layout(view:NativeGuidanceView):CardLayout {
    const width=Math.round(Math.min(236,Math.max(150,this.viewportWidth-16)));
    const bottom=this.columnBottom(),space=bottom-12-MIN_RESOURCES;
    const tab=():CardLayout=>bottom-12-60>=TAB?this.tabLayout(view,width):{variant:'none',width,height:0,ink:[],buttons:[],rows:[]};
    if(view.mode==='collapsed')return tab();
    const full=this.cardLayout(view,width,false);
    if(full.height<=space)return full;
    const compact=this.cardLayout(view,width,true);
    return compact.height<=space?compact:tab();
  }

  private tabLayout(view:NativeGuidanceView,width:number):CardLayout {
    const label=`${guidanceTabLabel(view.model.gesture)} ›`;
    return {variant:'tab',width,height:TAB,ink:[],rows:[],buttons:[
      {id:'hud:guidance:tab',label,hint:'Déplier la carte de conseils',x:0,y:0,width:width-30,height:TAB,color:PALETTE.kraftBase,onClick:()=>this.actions.expand()},
      {id:'hud:guidance:tab-close',label:'×',hint:'Fermer la carte de conseils · Aide la rouvre',x:width-26,y:2,width:26,height:TAB-4,color:PALETTE.kraftLight,onClick:()=>this.actions.close()},
    ]};
  }

  private cardLayout(view:NativeGuidanceView,width:number,compact:boolean):CardLayout {
    const ink:Ink[]=[],buttons:ButtonBox[]=[],rows:RowBox[]=[],inner=width-2*PAD,{gesture,checks,ready}=view.model;
    const lines=(text:string,y:number,size:number,options:{bold?:boolean;color?:string;max?:number}={}):number=>{
      const step=size+3;
      for(const line of this.wrap(text,inner,size,options.bold,options.max)){ink.push({kind:'text',text:line,x:PAD,y:y+size,size,bold:options.bold,color:options.color??PALETTE.inkDark,width:inner});y+=step;}
      return y;
    };
    ink.push({kind:'text',text:'Conseils',x:PAD,y:20,size:15,bold:true,color:PALETTE.inkDark,width:inner-60});
    buttons.push({id:'hud:guidance:collapse',label:'–',hint:'Replier la carte de conseils',x:width-56,y:5,width:22,height:20,color:PALETTE.kraftLight,onClick:()=>this.actions.collapse()});
    buttons.push({id:'hud:guidance:close',label:'×',hint:'Fermer la carte de conseils · Aide la rouvre',x:width-30,y:5,width:22,height:20,color:PALETTE.kraftLight,onClick:()=>this.actions.close()});
    let y=lines(`Premiers gestes · ${gesture.learned}/${gesture.total}`,30,13,{bold:true});
    const buttonRow=(entries:{id:string;label:string;hint:string;onClick:()=>void}[]):void=>{
      const gap=6,each=(inner-gap*(entries.length-1))/entries.length;
      entries.forEach((entry,index)=>buttons.push({...entry,x:PAD+index*(each+gap),y:y+3,width:each,height:BUTTON,color:index===0?PALETTE.ochre:PALETTE.creamPaper}));
      y+=BUTTON+6;
    };
    if(gesture.state==='active'&&gesture.current){
      const current=gesture.current,action=current.action;
      y=lines(`Geste ${current.position} sur ${gesture.total} : ${current.title}`,y,12,{bold:true,max:2});
      y=lines(current.instruction,y,12,{max:compact?2:3});
      buttonRow([{id:'hud:guidance:gesture-action',label:current.actionLabel,hint:current.instruction,onClick:()=>this.actions.guide({...action})},
        {id:'hud:guidance:gesture-declare',label:'Déjà connu',hint:'Je connais déjà ce geste · déclaration personnelle, aucune commande au jeu.',onClick:()=>this.actions.declareGesture()}]);
    }else if(gesture.state==='complete')y=lines('Les quatre gestes sont repérés.',y,12,{color:PALETTE.pineDark});
    else{
      y=lines(gesture.state==='paused'?'Parcours interrompu ; vos repères sont conservés.':'Quatre repères facultatifs pour bien démarrer.',y,12,{max:2});
      const paused=gesture.state==='paused';
      buttonRow([{id:'hud:guidance:gesture-start',label:paused?'Reprendre':'Commencer',hint:`${paused?'Reprendre au prochain geste à découvrir':'Commencer le parcours des premiers gestes'} · les commandes habituelles restent disponibles.`,onClick:()=>this.actions.startGestures()}]);
    }
    if(!gesture.saved)y=lines('Repères non enregistrés dans ce navigateur : ils seront perdus au rechargement.',y,11,{color:PALETTE.terracotta,max:2});
    ink.push({kind:'rule',y:y+3});y+=8;
    y=lines(`Préparations · ${ready}/${checks.length} disponibles`,y,13,{bold:true});
    // Short column: only the first unfinished preparations; the notebook keeps them all.
    const unfinished=checks.filter(check=>check.status!=='ready'),listed=compact?unfinished.slice(0,COMPACT_CHECKS):checks;
    if(!listed.length)y=lines(checks.length?'Toutes les préparations sont disponibles.':'Aucune carte locale active.',y,12,{color:PALETTE.pineDark});
    for(const check of listed){
      ink.push({kind:'dot',x:PAD+6,y:y+ROW/2,color:STATUS_COLORS[check.status]});
      ink.push({kind:'text',text:check.title,x:PAD+18,y:y+13,size:12,color:PALETTE.inkDark,width:inner-18});
      const action=check.action;
      rows.push({id:`hud:guidance:check:${check.id}`,hint:`${check.title} · ${GUIDANCE_STATUS_LABELS[check.status]}\n${check.detail}\nClic : ${check.actionLabel}`,y,onClick:()=>this.actions.guide({...action})});
      y+=ROW;
    }
    if(compact&&unfinished.length>listed.length)y=lines(`Et ${unfinished.length-listed.length} autre(s) dans le carnet.`,y,11,{color:PALETTE.kraftDark});
    y+=4;
    buttons.push({id:'hud:guidance:help',label:'Carnet de survie (H)',hint:'Ouvrir l’aide : premiers gestes, commandes et conseils détaillés',x:PAD,y,width:inner,height:BUTTON,color:PALETTE.creamPaper,onClick:()=>this.actions.openHelp()});
    y+=BUTTON+PAD;
    return {variant:compact?'compact':'full',width,height:Math.ceil(y),ink,buttons,rows};
  }

  private render(layout:CardLayout):void {
    const top=this.columnBottom()-layout.height,unit=.01;
    const place=(piece:CardboardPiece,x:number,y:number,w:number,h:number,z:number)=>{
      const px=(x+w/2)*unit,py=-(top+y+h/2)*unit,base=piece.userData.basePos;
      if(base.x!==px||base.y!==py||base.z!==z)piece.setBaseTransform(px,py,z);
    };
    // Panel: one painted sheet with all ink; it only blocks world clicks.
    if(layout.variant==='full'||layout.variant==='compact'){
      const geometry=`${layout.width}|${layout.height}`;
      if(this.panel&&this.panel.userData.geometry!==geometry){this.drop(this.panel);this.panel=undefined;}
      if(!this.panel){
        const ink=layout.ink,width=layout.width,height=layout.height;
        this.panel=this.piece({w:width*unit,h:height*unit,depth:.046,bgColor:PALETTE.creamPaper,bevel:.038,surface:'panel',seed:9433,uvPadding:1,
          textureWidth:Math.ceil(width*2),textureHeight:Math.ceil(height*2),interactive:true,drawFn:(c,w,h,rng)=>this.drawInk(c,w,h,width,height,ink,rng)});
        this.panel.userData.nativeId='hud:guidance:card';this.panel.userData.nativeStatic=true;this.panel.userData.geometry=geometry;
        this.panelInk=JSON.stringify(ink);this.cardGroup.add(this.panel);
      }else{
        const signature=JSON.stringify(layout.ink);
        if(signature!==this.panelInk){const ink=layout.ink,width=layout.width,height=layout.height;this.panelInk=signature;this.panel.redraw((c,w,h,rng)=>this.drawInk(c,w,h,width,height,ink,rng));}
      }
      place(this.panel,0,0,layout.width,layout.height,0);
    }else if(this.panel){this.drop(this.panel);this.panel=undefined;this.panelInk='';}

    const liveButtons=new Set<string>();
    for(const box of layout.buttons){
      liveButtons.add(box.id);
      let piece=this.buttons.get(box.id);
      const geometry=`${box.width}|${box.height}`;
      if(piece&&piece.userData.geometry!==geometry){this.drop(piece);this.buttons.delete(box.id);piece=undefined;}
      if(!piece){
        const label={text:box.label};
        piece=this.piece({w:box.width*unit,h:box.height*unit,depth:.03,bgColor:box.color,bevel:.02,seed:9450+this.buttons.size*7,hasBorder:false,uvPadding:1,
          textureWidth:Math.ceil(box.width*2),textureHeight:Math.ceil(box.height*2),interactive:true,drawFn:(c,w,h)=>this.drawLabel(c,w,h,label.text,box.width,box.height)});
        piece.userData.geometry=geometry;piece.userData.label=label;this.buttons.set(box.id,piece);this.cardGroup.add(piece);
      }
      const label=piece.userData.label as {text:string};
      if(label.text!==box.label||piece.userData.bgColor!==box.color){label.text=box.label;piece.redraw(undefined,box.color);}
      piece.userData.nativeId=box.id;piece.userData.tooltip=box.hint;piece.userData.onClick=box.onClick;
      place(piece,box.x,box.y,box.width,box.height,layout.variant==='tab'?0:.06);
    }
    for(const [id,piece] of this.buttons)if(!liveButtons.has(id)){this.drop(piece);this.buttons.delete(id);}

    const liveRows=new Set<string>(),inner=layout.width-2*PAD;
    for(const row of layout.rows){
      liveRows.add(row.id);
      let piece=this.rows.get(row.id);
      if(piece&&piece.userData.w!==inner*unit){this.drop(piece);this.rows.delete(row.id);piece=undefined;}
      if(!piece){piece=this.piece({w:inner*unit,h:ROW*unit,hitOnly:true,interactive:true,drawFn:()=>{}});this.rows.set(row.id,piece);this.cardGroup.add(piece);}
      piece.userData.nativeId=row.id;piece.userData.tooltip=row.hint;piece.userData.onClick=row.onClick;
      place(piece,PAD,row.y,inner,ROW,.06);
    }
    for(const [id,piece] of this.rows)if(!liveRows.has(id)){this.drop(piece);this.rows.delete(id);}
  }

  private drawInk(ctx:CanvasRenderingContext2D,wPx:number,hPx:number,width:number,height:number,ink:readonly Ink[],rng:()=>number):void {
    ctx.save();ctx.scale(wPx/width,hPx/height);
    drawHandRect(ctx,4,6,4,height-12,PALETTE.ochre,null,0,rng);
    for(const op of ink){
      if(op.kind==='text'){ctx.font=`${op.bold?'bold ':''}${op.size}px ${FONT}`;ctx.fillStyle=op.color;ctx.textAlign='left';ctx.fillText(op.text,op.x,op.y,op.width);}
      else if(op.kind==='dot')drawHandBlob(ctx,op.x,op.y,5,op.color,PALETTE.inkDark,1,rng);
      else drawHandRect(ctx,PAD,op.y,width-2*PAD,1.5,PALETTE.kraftDark,null,0,rng);
    }
    ctx.restore();
  }
  private drawLabel(ctx:CanvasRenderingContext2D,wPx:number,hPx:number,label:string,width:number,height:number):void {
    ctx.save();ctx.scale(wPx/width,hPx/height);ctx.font=`bold ${label.length<=2?16:12}px ${FONT}`;ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='center';
    ctx.fillText(label,width/2,height/2+(label.length<=2?6:4),width-8);ctx.restore();
  }
  private piece(options:CardboardPieceOptions):CardboardPiece {const piece=this.art.createPiece(options);this.owned.add(piece);return piece;}
  private drop(piece:CardboardPiece):void {this.owned.delete(piece);this.art.disposePiece(piece);}
}

export interface NativeGuidanceOptions {
  session:GuidanceCardSession;
  learning:()=>FirstGesturesLearning|undefined;
  /** Confirmed local map snapshot, if any. */
  world:()=>World|undefined;
  /** Front menu, loading screen or colony replacement in progress. */
  blocked:()=>boolean;
  /** First-day facts of the confirmed snapshot (Aide → Conseils actuels). */
  sections:(world:World)=>readonly FirstDayGuideSection[];
  now:()=>number;
  openHelp:()=>void;
  guide:(action:FirstDayGuideAction)=>void;
  invalidate?:()=>void;
  /** After each update; the owner may give the left column back to the HUD. */
  afterSync?:()=>void;
}
/** Minimum real time between two readings of the colony by the card. */
export const GUIDANCE_READ_INTERVAL_MS=1000;

/** Wires the card to its session and to the first-gestures memory. The card
 * reads the colony only while expanded, at most once per second of real time
 * (or at once after a gesture or an expansion); collapsed or closed, it reads
 * the browser knowledge only. Collapse, close and reopen never write it. */
export function createNativeGuidance(art:PrototypeCardboardArt,anchors:NativeGuidanceAnchors,options:NativeGuidanceOptions):{card:NativeGuidanceCard;sync:(force?:boolean)=>void} {
  let cached:{model:GuidanceCardModel;world:World;at:number;learning:string}|undefined;
  const sync=(force=false):void=>{
    const world=options.world(),session=options.session;
    const visible=session.sync({world:!!world,arrivalPending:startingArrivalPending(world),blocked:options.blocked()});
    const learning=options.learning(),view=learning?{state:learning.state,current:learning.current,saved:learning.saved}:undefined;
    const key=view?JSON.stringify([view.state,view.saved]):'';
    let model:GuidanceCardModel;
    if(visible&&session.mode==='expanded'&&world){
      const now=options.now();
      if(force||!cached||cached.learning!==key||cached.world!==world&&now-cached.at>=GUIDANCE_READ_INTERVAL_MS){
        model=readGuidanceCard({learning:view,sections:options.sections(world)});cached={model,world,at:now,learning:key};
      }else model=cached.model;
    }else{model={gesture:readGuidanceGesture(view),checks:[],ready:0};cached=undefined;}
    card.update({visible,mode:session.mode,model});
    options.afterSync?.();
  };
  const card=new NativeGuidanceCard(art,anchors,{
    openHelp:()=>options.openHelp(),
    expand:()=>{options.session.expand();sync(true);},
    collapse:()=>{options.session.collapse();sync();},
    close:()=>{options.session.close();sync();},
    guide:action=>options.guide(action),
    startGestures:()=>{options.learning()?.start();sync(true);},
    declareGesture:()=>{options.learning()?.declareCurrentKnown();sync(true);},
    invalidate:()=>options.invalidate?.(),
  });
  return {card,sync};
}
