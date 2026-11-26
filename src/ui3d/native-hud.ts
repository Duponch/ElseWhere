import {drawPicto} from '../ui/picto-artwork';
import {NATIVE_TEXT} from './native-ui-scale';
import {NativeClockRaster} from './native-clock-raster';
import {clockLabel,paintClockInk} from './native-clock-ink';
import {alertsDisabled347} from '../sim/game-profile';
import * as THREE from 'three/webgpu';
import type {MaterialPile, Pawn, World} from '../sim/types';
import {TICKS_PER_DAY} from '../sim/types';
import {isColonist} from '../sim/affiliation';
import {calendarTick} from '../sim/calendar';
import {climateDate} from '../sim/site-climate';
import {outdoorTemperature} from '../sim/temperature';
import {perceivedWeather} from '../sim/weather';
import {WEATHER} from '../sim/weather-definitions';
import {windIntensity} from '../sim/wind-rules';
import {activeEclipse} from '../sim/eclipse';
import {ITEM_DEFINITIONS, type ItemId} from '../sim/items';
import {captureFoodReadability, type FoodReadability} from '../sim/food-readability';
import {appearanceOf} from '../sim/pawn-appearance';
import {apparelAppearance} from '../render/character-apparel';
import {humanLimbVisualMask} from '../render/human-anatomy-presentation';
import {portraitDataUrl, portraitExpressionOf} from '../ui/pawn-portrait';
import {colonistBarState346, type ColonistBarState346} from '../ui/colonist-bar-state-346';
import {pawnShortName} from '../ui/pawn-short-name';
import {colonistBarStateLabel346} from './native-colonist-bar-346';
import {NativeColonistBarRaster379,type NativeColonistRasterPlacement379} from './NativeColonistBarRaster379';
import {knownPosition256} from '../ui/exploration-readers-256';
import {captureHudMapRead379,type HudPortraitOwnership379,type HudResourceRecord379} from '../ui/hud-map-read-379';
import {ResidentBlightRead379} from '../ui/resident-blight-read-379';
import type {StatusAlert} from '../ui/status-alerts';
import type {NativePage, NativeRow,NativeUiState} from './native-contract';
import {liveNativePage} from './native-page-refresh';
import {NATIVE_RIGHT_DOCK_WIDTH} from './native-layout';
import {ALERT_COLUMN_WIDTH,BAR_BASE,BAR_MARGIN_TOP,NATIVE_VIEW_ACTIONS,colonistBarLayout,colonistBarVisible,globalColumn,type BarLayout,type ColumnRect} from './native-hud-rimworld';
import {NotificationFocusCycle,type NotificationTarget} from '../ui/notification-focus';
import type {NativeDomainAlert} from './native-domain-alerts';
import {weatherConditionLabel} from '../ui/weather-inspection';
import {STORAGE_FILTER_TREE,type StorageFilterNode} from '../ui/storage-filter-tree';
import {modelIconUrl} from '../ui/pictograms';
import {coreAlertPriority,type CoreAlertPriority} from '../ui/alert-priority';
import {ALERT_PULSE_LEVELS,ALERT_RECHECK_MS,AlertActivationTracker,AlertBounce,alertHoverText,alertPulseLevel,readNativeAlertRows,type HudAlert} from './native-alert-list';
import {PrototypeCardboardArt, PALETTE, createMaskingTape, drawHandRect, drawMarkerLine, type CardboardPiece, type CardboardPieceOptions} from './prototype-art';
import {applyNativeHudButtonPose,drawNativeSpeedIcon,drawNativeWeatherIcon,nativeWeatherColor,nativeWeatherIcon,nativeWeatherOutline,type NativeWeatherIcon} from './native-hud-art';

export interface NativeHudAnchors {
  topCenter: THREE.Group;
  topLeft: THREE.Group;
  topRight: THREE.Group;
  bottomRight: THREE.Group;
}
export interface NativeHudActions {
  selectPawn(id: number): void;
  speed(value: number): void;
  showPage(page: NativePage): void;
  readState?:()=>NativeUiState;
  /** The adoption owner can share its exact known-food capture with other
   * presentation readers for this World; no new authority is implied. */
  readFood?:(world:World)=>FoodReadability|undefined;
  isCurrentPage?:(page:NativePage)=>boolean;
  refresh?:()=>void;
  showViewControls?:()=>void;
  view?: (action: NativeHudViewAction)=>void;
  focus?: (target:NotificationTarget,tab?:StatusAlert['tab'])=>void;
  domain?: (alert:NativeDomainAlert)=>void;
  campaign?: (target:NonNullable<StatusAlert['campaign']>)=>void;
  context?: (target:NonNullable<StatusAlert['context']>)=>void;
  /** A High or Critical alert just appeared (Core Alert.Notify_Started). `bell`
   * is already throttled to one every 0.5 s; Critical also posts one notice. */
  alertStarted?: (started:NativeAlertStart)=>void;
}
export interface NativeAlertStart {key:string;text:string;priority:Exclude<CoreAlertPriority,'medium'>;bell:boolean;targets:readonly NotificationTarget[]}
export type NativeHudViewAction=typeof NATIVE_VIEW_ACTIONS[number];
export interface NativeHudViewState {walls:string;roofs:boolean;foliage:boolean;zones:boolean;camera:string;roomStats:boolean;beauty:boolean}
export interface NativeHudWindowBounds {x:number;y:number;width:number;height:number}
interface ResourceTag {
  id: string;
  seed: number;
  piece: CardboardPiece;
  label: string;
  value: string;
  color: string;
  item?: ItemId;
  level?: number;
  branch?: {id:string;open:boolean};
  screenWidth?: number;
  signature: string;
}
interface AlertCard {
  key: string;
  seed: number;
  width: number;
  height: number;
  lines: string[];
  color: string;
  /** Background actually painted: the pulse shade of a Critical card. */
  painted: string;
  critical: boolean;
  signature: string;
  baseX: number;
  baseY: number;
  rotation: number;
  piece: CardboardPiece;
}
interface PortraitCard {
  piece: CardboardPiece;
  pawnId: number;
  index: number;
  name: string;
  mood: number;
  skin: string;
  shirt: string;
  sleeping: boolean;
  selected: boolean;
  image?: HTMLImageElement;
  loaded: boolean;
  appearanceKey: string;
  signature: string;
  /** Core colonist bar mood-risk tint and activity icons. */
  bar?: ColonistBarState346;
}
const ROW_ICON = 22;
/** The painted card around a 48 × 48 bar cell, at scale 1 (70 × 96 art ratio). */
const BAR_CARD_W = 57, BAR_CARD_H = 78;
const FONT = '"Comic Sans MS", "Chalkboard SE", Georgia, serif';
const quadrums = ['avrimai', 'juillêt', 'septobre', 'décembary'] as const;
const speeds = [
  {speed: 0, title: 'Pause'},
  {speed: 1, title: 'Lecture ×1'},
  {speed: 3, title: 'Vitesse ×3'},
  {speed: 6, title: 'Vitesse ×6'}
] as const;
const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
const rounded = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
const amount = (value: number) => value.toLocaleString('fr-FR', {maximumFractionDigits: 2});

/** Letter projections keep the colour of their letter class (danger, warning,
 * information), including a resolved incident marked info. Every other card is
 * coloured by its explicit Core priority (alert-priority.ts): Critical red,
 * High ochre, Medium plain. Labels are never parsed. */
export function nativeHudAlertColor(alert:Pick<StatusAlert,'key'|'tab'|'priority'>&{domain?:Pick<NativeDomainAlert,'severity'>}):string {
  if(alert.domain)return alert.domain.severity==='danger'?PALETTE.terracotta:alert.domain.severity==='warning'?PALETTE.ochre:PALETTE.creamPaper;
  const priority=coreAlertPriority(alert);
  return priority==='critical'?PALETTE.terracotta:priority==='high'?PALETTE.ochre:PALETTE.creamPaper;
}
/** Critical pulse shades, from the full red (top level) towards cream, so the
 * dark ink stays readable while the card pulses. */
const mixHex=(a:string,b:string,t:number)=>{
  const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16),c=(shift:number)=>Math.round(((pa>>shift)&255)*(1-t)+((pb>>shift)&255)*t);
  return `#${((c(16)<<16)|(c(8)<<8)|c(0)).toString(16).padStart(6,'0')}`;
};
export const nativeAlertPulseColor=(level:number):string=>mixHex(PALETTE.terracotta,PALETTE.creamPaper,(1-level/(ALERT_PULSE_LEVELS-1))*.45);
/** Letter dossiers (offers, quests, trade) open on click like Core quest alerts. */
const DOSSIER_ACTIONS=new Set<NativeDomainAlert['action']['kind']>(['arrivals','quests','trade','orbital']);

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number): void {
  ctx.fillText(text, x, y, Math.max(1, width));
}
/** Wrap ink by measured glyph width, never by browser layout. The full source
 * remains on the native details page when a compact card has fewer lines. */
function inkLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Real confirmed HUD values painted on the original prototype's physical
 * cards. No hidden element, HTML layout or synthetic click is involved. */
export class NativeHudCards {
  private readonly alertFocus=new NotificationFocusCycle();
  private readonly colonistsGroup = new THREE.Group();
  private readonly resourcesGroup = new THREE.Group();
  private readonly alertsGroup = new THREE.Group();
  private readonly timeGroup = new THREE.Group();
  /** Core letter stack (schema 352), above the time board and below the alerts. */
  readonly letterLayer = new THREE.Group();
  private letterReservePx = 0;
  private readonly fpsGroup = new THREE.Group();
  private readonly ownedPieces = new Set<CardboardPiece>();
  private readonly rail: THREE.Mesh;
  private readonly tags: ResourceTag[] = [];
  private readonly resourceImages=new Map<ItemId,HTMLImageElement>();
  private readonly resourceExpanded=new Set(['foods','manufactured','raw-resources']);
  private resourcePage=0;
  private leftHudBottom=Infinity;
  private readonly speedButtons: CardboardPiece[] = [];
  private readonly activePoses=new Set<CardboardPiece>();
  private readonly viewButtons=new Map<NativeHudViewAction,CardboardPiece>();
  private readonly alertHandle: CardboardPiece;
  private readonly alertHandleGroup=new THREE.Group();
  private viewportWidth=1440;
  private viewportHeight=1000;
  private baseTimeY=30;
  private windowBounds:NativeHudWindowBounds|null=null;
  private windowDockVisible=true;
  private windowDockMode:'normal'|'above-window'|'hidden-window-space'='normal';
  private rightDockOpen=false;
  private notificationsAutoHide=false;
  private rightDockOffset=3.16;
  private viewState:NativeHudViewState={walls:'hauts',roofs:false,foliage:true,zones:true,camera:'iso',roomStats:false,beauty:false};
  private readonly column=globalColumn(NATIVE_VIEW_ACTIONS.length);
  private readonly weatherPiece: CardboardPiece;
  private readonly weatherLabelPiece: CardboardPiece;
  private readonly temperaturePiece: CardboardPiece;
  private weatherIconPiece:CardboardPiece;
  private weatherIconValue:NativeWeatherIcon='sun';
  private readonly fpsPiece: CardboardPiece;
  private readonly rosterButton: CardboardPiece;
  private readonly allAlertsButton: CardboardPiece;
  private readonly alertUpButton: CardboardPiece;
  private readonly alertDownButton: CardboardPiece;
  private readonly alertActivation=new AlertActivationTracker();
  private readonly blightReader379=new ResidentBlightRead379();
  private readonly alertBounces=new Map<string,AlertBounce>();
  private alertScroll=0;
  private alertsReadAt=-Infinity;
  private alertsPending=false;
  private alertSession='';
  private alertTick=-Infinity;
  private alertLastShown=-1;
  private lastBellAt=-Infinity;
  private pulseSeconds=0;
  private pulseLevel=-1;
  private portraits: PortraitCard[] = [];
  private alertCards: AlertCard[] = [];
  private world?: World;
  private livePageView?:NativePage;
  private colonists: Pawn[] = [];
  private resources: HudResourceRecord379[] = [];
  private alerts: HudAlert[] = [];
  private food?: FoodReadability;
  private physicalNutrition = 0;
  private selectedIds = new Set<number>();
  private portraitIds = '';
  private barLayout?: BarLayout;
  private barPiece?: CardboardPiece;
  private barBox?: {left:number;top:number;width:number;height:number};
  private barDirty=false;
  private barSelection='';
  private barScanAt=-Infinity;
  private barDrawnAt=-Infinity;
  private readonly barRaster379=new NativeColonistBarRaster379();
  private barTimer?: ReturnType<typeof setTimeout>;
  private allAlertsCount = 0;
  private readonly clockRaster=new NativeClockRaster();
  private civilMinute=-1;
  private weatherReadout = {clock: '—', date: '—', weather: '—', temperature: '—', condition: '', wind: '—'};
  private speedValue = -1;
  private fpsValue = -1;
  private shown = true;
  private disposed = false;

  /** `clock` is real time in milliseconds (alert cadence and bell throttle). */
  constructor(private readonly art: PrototypeCardboardArt, anchors: NativeHudAnchors, private readonly actions: NativeHudActions, private readonly clock:()=>number=()=>performance.now()) {
    anchors.topCenter.add(this.colonistsGroup);
    anchors.topLeft.add(this.resourcesGroup);
    anchors.topRight.add(this.alertsGroup,this.fpsGroup,this.alertHandleGroup);
    anchors.bottomRight.add(this.timeGroup);
    this.timeGroup.add(this.letterLayer);

    this.rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.035, 0.025), new THREE.MeshStandardMaterial({color: 0x7c5c3e, roughness: 0.98}));
    this.rail.position.set(0, -0.08, -0.01);
    this.colonistsGroup.add(this.rail);

    this.rosterButton=this.smallButton('≡',853,()=>this.showRoster());
    this.rosterButton.userData.tooltip='Liste complète des colons';
    this.rosterButton.userData.nativeId='hud:colonists:list';
    this.colonistsGroup.add(this.rosterButton);
    this.alertHandle=this.smallButton('‹',9281,()=>this.setRightDockOpen(!this.rightDockOpen));
    this.alertHandle.userData.nativeId='hud:alerts:handle';
    this.alertHandle.userData.tooltip='Afficher les notifications';
    this.alertHandleGroup.add(this.alertHandle);
    this.alertHandle.setBaseTransform(-.14,-.56,.1);

    // Right column laid out as RimWorld's GlobalControls (sizes in logical px).
    // Date, weather and temperature are lettering over the map in Core (text
    // with a shadow, no board): clear pieces with cream outlined letters.
    const column=this.column,at=(rect:ColumnRect)=>({x:-(rect.right+rect.width/2)/100,y:(rect.bottom+rect.height/2)/100});
    const letterPiece=(rect:ColumnRect,seed:number,id:string,draw:(ctx:CanvasRenderingContext2D,w:number,h:number)=>void)=>{
      const piece=this.makePiece({w:rect.width/100,h:rect.height/100,depth:.001,paper:false,hasBorder:false,seed,interactive:true,drawFn:(ctx,w,h)=>draw(ctx,w,h),onClick:()=>this.showWeather()});
      piece.userData.nativeId=id;const pos=at(rect);piece.setBaseTransform(pos.x,pos.y,0,0);this.timeGroup.add(piece);return piece;
    };
    this.weatherPiece=letterPiece(column.date,209,'hud:clock',(ctx,w,h)=>this.drawDate(ctx,w,h));
    this.weatherLabelPiece=letterPiece(column.weather,211,'hud:weather-label',(ctx,w,h)=>this.drawRowText(ctx,w,h,this.weatherReadout.condition||this.weatherReadout.weather,column.weather.width,30));
    this.temperaturePiece=letterPiece(column.temperature,213,'hud:temperature',(ctx,w,h)=>this.drawRowText(ctx,w,h,this.weatherReadout.temperature,column.temperature.width,0));
    this.weatherIconPiece=this.createWeatherIcon(this.weatherIconValue);

    speeds.forEach((cfg, idx) => {
      const rect=column.speed[idx]!;
      const piece = this.makePiece({w: rect.width/100, h: rect.height/100, depth: .03, bgColor: PALETTE.kraftBase, bevel: .02, hasBorder:false,seed: 310 + idx * 23, interactive: true, tooltip: cfg.title,
        drawFn: (ctx, w, h, rng) => drawNativeSpeedIcon(ctx,w,h,cfg.speed,this.speedValue===cfg.speed,rng),
        onClick: () => { if (this.world) this.actions.speed(cfg.speed); }});
      piece.userData.nativeId=`hud:speed:${cfg.speed}`;
      piece.userData.nativeToolbarPose=true;piece.userData.nativeActivePose=0;
      const pos=at(rect);piece.setBaseTransform(pos.x,pos.y,0,0);
      this.timeGroup.add(piece); this.speedButtons.push(piece);
    });

    NATIVE_VIEW_ACTIONS.forEach((action,index)=>{
      const rect=column.view[index]!;
      const button=this.makePiece({w:rect.width/100,h:rect.height/100,depth:.02,bgColor:PALETTE.creamPaper,bevel:.02,seed:9297+index*17,interactive:true,
        drawFn:(ctx,w,h,rng)=>this.drawViewControl(action,ctx,w,h,rng),onClick:()=>this.actions.view?.(action)});
      button.userData.nativeId=`hud:view:${action}`;
      const pos=at(rect);button.setBaseTransform(pos.x,pos.y,0,0);
      this.timeGroup.add(button);this.viewButtons.set(action,button);
    });
    this.setViewState(this.viewState);
    this.fpsPiece = this.makePiece({w: .72, h: .22, depth: 0.03, bgColor: PALETTE.creamPaper, seed: 929, hasBorder: false,
      drawFn: (ctx, w, h) => this.drawCaption(ctx, w, h, `${this.fpsValue < 0 ? '—' : this.fpsValue} FPS`,72,22)});
    this.fpsPiece.setBaseTransform(-.40,-.12,.08);
    this.fpsGroup.add(this.fpsPiece);
    this.allAlertsButton = this.makePiece({w: 1.46, h: .25, depth: 0.036, bgColor: PALETTE.creamPaper, seed: 973, interactive: true,
      drawFn: (ctx, w, h) => this.drawCaption(ctx, w, h, `${this.alerts.length} alertes · tout voir`,146,25), onClick: () => this.showAlerts()});
    this.allAlertsButton.userData.nativeId='hud:alerts:all';
    this.allAlertsButton.userData.tooltip='Ouvrir la liste complète des alertes · molette sur les alertes : faire défiler';
    this.allAlertsButton.setBaseTransform(-.73,-.25,0);
    this.alertUpButton=this.smallButton('▲',9311,()=>this.scrollAlerts(-1));
    this.alertUpButton.userData.nativeId='hud:alerts:up';this.alertUpButton.userData.tooltip='Alertes précédentes';
    this.alertDownButton=this.smallButton('▼',9313,()=>this.scrollAlerts(1));
    this.alertDownButton.userData.nativeId='hud:alerts:down';this.alertDownButton.userData.tooltip='Alertes suivantes';
    this.alertUpButton.visible=this.alertDownButton.visible=false;
    this.alertsGroup.add(this.allAlertsButton,this.alertUpButton,this.alertDownButton);
    this.setViewport(1440,1000,.01);
    this.setVisible(false);
  }

  /** Snapshot reading may be called at 200 ms cadence. Uploads require changed
   * visible primitives; unchanged snapshots and ticks never repaint a card. */
  update(world: World | undefined, speed: number, fps: number): void {
    if (this.disposed) return;
    const nextFps = Number.isFinite(fps) ? Math.max(0, Math.round(fps)) : -1;
    if (this.fpsValue !== nextFps) { this.fpsValue = nextFps; this.fpsPiece.redraw(); }
    if (speed !== this.speedValue) {
      this.speedValue = speed;
      this.speedButtons.forEach((piece, idx) => { const active=speeds[idx]!.speed===speed;if(piece.userData.active!==active){piece.userData.active=active;this.activePoses.add(piece);piece.redraw(undefined,active?PALETTE.terracotta:PALETTE.kraftBase);} });
    }
    if (this.world === world) return;
    this.world = world;
    if (!world) { this.alertSession=''; this.blightReader379.reset(); this.setVisible(false); return; }
    this.colonists = world.pawns.filter(p => isColonist(p) && !p.prisoner && p.state !== 'dead').sort((a, b) => a.id - b.id);
    const reading=captureHudMapRead379(world,this.colonists);
    this.food = this.actions.readFood?.(world)??captureFoodReadability(world,reading.visibility);
    this.physicalNutrition = reading.physicalNutrition;
    this.resources = reading.resources;
    this.readAlerts(world);
    this.refreshPortraits(world,reading.portraitOwnership,reading.structure);
    this.refreshResources();
    this.refreshAlerts();
    this.refreshWeather(world);
  }

  /** Core cadence: one full reading at most once a second of real time; a newer
   * snapshot in between is read by the next due animation frame. A new game, a
   * load or another map adopts its current alerts silently (no bell, as Core's
   * one-second grace after loading). Only High and Critical starts are signalled. */
  private readAlerts(world:World):void {
    const campaign=world.campaignMap,map=!campaign?'':campaign.revision===2?`m${campaign.activeMapId}`:campaign.active;
    const session=`${world.seed}:${map}`,fresh=session!==this.alertSession||world.tick<this.alertTick,now=this.clock();
    if(!fresh&&now-this.alertsReadAt<ALERT_RECHECK_MS){this.alertsPending=true;return;}
    this.alertsPending=false;this.alertsReadAt=now;this.alertSession=session;this.alertTick=world.tick;
    // Core StorytellerDef.disableAlerts (the tutorial's Tutor): no alert.
    if(fresh)this.blightReader379.reset();
    const disabled=alertsDisabled347(world);if(disabled)this.blightReader379.reset();
    const {ordered,started}=this.alertActivation.update(disabled?[]:readNativeAlertRows(world,this.food,this.speedValue<0?undefined:this.speedValue,()=>this.blightReader379.read(world)),fresh);
    this.alerts=ordered;
    if(fresh)this.alertBounces.clear();
    for(const row of started){
      if(row.priority==='medium')continue;
      this.alertBounces.set(row.key,new AlertBounce());
      const bell=now-this.lastBellAt>500;if(bell)this.lastBellAt=now;
      this.actions.alertStarted?.({key:row.key,text:row.text,priority:row.priority,bell,targets:row.targets});
    }
  }

  /** Left click: a letter dossier opens; otherwise the camera jumps to and
   * selects the next culprit (right click: the previous one), as Core's
   * Alert.OnClick. Rows without culprit open their management context, a
   * remote map, or their details. */
  private activateAlert(key:string,direction:1|-1):void {
    const alert=this.alerts.find(row=>row.key===key);
    if(!alert){if(direction>0)this.showAlerts();return;}
    const domain=alert.domain;
    if(direction>0&&domain&&DOSSIER_ACTIONS.has(domain.action.kind)&&this.actions.domain){this.actions.domain(domain);return;}
    if(alert.targets.length&&this.actions.focus){
      const target=direction>0?this.alertFocus.next(key,alert.targets):this.alertFocus.previous(key,alert.targets);
      if(target){this.actions.focus(target,alert.tab);return;}
    }
    if(direction<0)return;
    if(alert.campaign&&this.actions.campaign){this.actions.campaign(alert.campaign);return;}
    if(alert.context&&this.actions.context){this.actions.context(alert.context);return;}
    this.showAlert(key);
  }
  private scrollAlerts(direction:number):void {
    if(direction>0&&this.alertLastShown<this.alerts.length-1)this.alertScroll++;
    else if(direction<0&&this.alertScroll>0)this.alertScroll--;
    else return;
    this.refreshAlerts();
  }

  setSelection(ids: readonly number[]): void {
    if (ids.length === this.selectedIds.size && ids.every(id => this.selectedIds.has(id))) return;
    this.selectedIds = new Set(ids);
    if (this.world) this.refreshPortraits(this.world);
  }

  /** Layout is expressed in screen pixels, converted only by the native stage's
   * projection. Canvas measurements decide ink wrapping, never hit regions. */
  setViewport(width:number,height:number,unitsPerPixel:number,bottomDockHeight=96,leftHudBottom=Infinity):void {
    const barWidthChanged=this.viewportWidth!==width;
    this.viewportWidth=width;this.viewportHeight=height;
    this.leftHudBottom=leftHudBottom;
    const scale=100*unitsPerPixel;
    for(const group of [this.colonistsGroup,this.resourcesGroup,this.alertsGroup,this.timeGroup,this.fpsGroup,this.alertHandleGroup])group.scale.setScalar(scale);
    this.alertsGroup.position.x=this.rightDockOffset*scale;
    // The colonist bar follows ColonistBarDrawLocsFinder: the layout depends on
    // the screen width only, and is hidden under 800 × 500 like the game's.
    this.colonistsGroup.visible=this.shown&&!!this.world&&colonistBarVisible(width,height);
    // The bar's geometry is width-only. A guide/letters reservation or height
    // change must not dispose every portrait and restart asynchronous imagery.
    if(barWidthChanged)this.portraitIds='';
    if(this.world)this.refreshPortraits(this.world);
    // The bottom shelf remains below the legacy-sized time and view controls.
    this.baseTimeY=30+Math.max(0,bottomDockHeight-96);
    this.layoutWindowDock();
    this.refreshAlerts();
    if(this.world)this.refreshResources();
  }

  /** Logical-pixel reservation for complete cards, including their hover tilt
   * and shadow. The window owner can reserve this lane before laying out a page.
   * No pointer/hover state participates in this layout decision. */
  getWindowLayoutBudget(){return {rightReserve:NATIVE_RIGHT_DOCK_WIDTH,height:this.column.height,minimumTop:118,mode:this.windowDockMode,visible:this.windowDockVisible,shiftPx:this.timeGroup.position.y/this.timeGroup.scale.x*100-this.baseTimeY};}

  /** A page may overlap a complete dock, never slice individual cards. Prefer
   * moving the whole assembly into the space above it. At a narrow accessibility
   * viewport without that space, hide the whole assembly and its hit meshes
   * until this page closes; the normal HUD returns at its exact previous size. */
  setWindowBounds(box:NativeHudWindowBounds|null):boolean {
    this.windowBounds=box&&[box.x,box.y,box.width,box.height].every(Number.isFinite)&&box.width>0&&box.height>0?{...box}:null;
    const changed=this.layoutWindowDock();
    if(changed)this.refreshAlerts();
    return changed;
  }

  private layoutWindowDock():boolean {
    let y=this.baseTimeY,visible=true,mode:'normal'|'above-window'|'hidden-window-space'='normal';
    const box=this.windowBounds,left=this.viewportWidth-NATIVE_RIGHT_DOCK_WIDTH,top=this.viewportHeight-y-this.column.height-4,bottom=this.viewportHeight-y-4;
    if(box&&box.x<this.viewportWidth&&box.x+box.width>left&&box.y<bottom&&box.y+box.height>top){
      const raisedY=this.viewportHeight-box.y+6,raisedTop=this.viewportHeight-raisedY-this.column.height-4;
      if(this.viewportWidth>=720&&raisedTop>=118){y=Math.max(y,raisedY);mode='above-window';}
      else{visible=false;mode='hidden-window-space';}
    }
    const position=y*.01*this.timeGroup.scale.x;
    const changed=this.timeGroup.position.y!==position||this.windowDockVisible!==visible||this.windowDockMode!==mode;
    this.timeGroup.position.y=position;this.windowDockVisible=visible;this.windowDockMode=mode;
    this.timeGroup.visible=this.shown&&!!this.world&&visible;
    return changed;
  }

  /** Height the letter stack takes from the bottom of the alert column. */
  setLetterReserve(px:number):void {if(px===this.letterReservePx)return;this.letterReservePx=px;this.refreshAlerts();}

  setViewState(state:Partial<NativeHudViewState>):void {
    this.viewState={...this.viewState,...state};
    const labels:Record<NativeHudViewAction,string>={walls:`Murs : ${this.viewState.walls}`,roofs:`Toits : ${this.viewState.roofs?'visibles':'masqués'}`,
      foliage:`Feuillage : ${this.viewState.foliage?'visible':'masqué'}`,zones:`Zones : ${this.viewState.zones?'visibles':'masquées'}`,home:'Recentrer sur la colonie',camera:`Vue : ${this.viewState.camera}`,
      'room-stats':`Statistiques de pièce (G) : ${this.viewState.roomStats?'activées':'désactivées'}`,beauty:`Beauté (T) : ${this.viewState.beauty?'activée':'désactivée'}`};
    for(const [action,button] of this.viewButtons){
      const active=action==='roofs'?this.viewState.roofs:action==='foliage'?!this.viewState.foliage:action==='zones'?this.viewState.zones:action==='walls'?this.viewState.walls!=='hauts':action==='camera'?this.viewState.camera!=='iso':action==='room-stats'?this.viewState.roomStats:action==='beauty'?this.viewState.beauty:false;
      if(button.userData.tooltip!==labels[action]||button.userData.active!==active){button.userData.tooltip=labels[action];button.userData.active=active;button.redraw(undefined,active?PALETTE.sageMountain:PALETTE.creamPaper);}
    }
  }

  setRightDockOpen(open:boolean):void {
    if(this.rightDockOpen===open)return;
    this.rightDockOpen=open;
    this.alertHandle.userData.tooltip=open?'Replier les notifications':'Afficher les notifications';
    this.alertHandle.redraw((ctx,w,h)=>{ctx.font=`bold ${NATIVE_TEXT.medium*1.9}px ${FONT}`;ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='center';ctx.fillText(open?'›':'‹',w/2,h/2+12);});
  }
  getRightDockOpen():boolean{return this.rightDockOpen;}
  setNotificationsAutoHide(enabled:boolean):void {
    this.notificationsAutoHide=enabled;
    this.alertHandleGroup.visible=enabled&&this.shown&&!!this.world&&this.alerts.length>0;
    if(!enabled)this.setRightDockOpen(true);
  }

  /** Returns true through the last changed frame, so the stage invalidates its
   * composed scene even when the drawer has just reached its resting pose. */
  animate(deltaSeconds:number):boolean {
    let changed=false;
    for(const piece of this.activePoses){
      const target=Number(piece.userData.active),before=Number(piece.userData.nativeActivePose??0);
      const next=THREE.MathUtils.lerp(before,target,1-Math.exp(-Math.max(0,deltaSeconds)*16));
      piece.userData.nativeActivePose=Math.abs(next-target)<.001?target:next;
      changed=applyNativeHudButtonPose(piece)||changed;
      if(piece.userData.nativeActivePose===target)this.activePoses.delete(piece);
    }
    changed=this.animateAlerts(deltaSeconds)||changed;
    const target=this.rightDockOpen?0:3.16;
    const before=this.rightDockOffset;
    if(Math.abs(before-target)<.001){this.rightDockOffset=target;return changed;}
    this.rightDockOffset=THREE.MathUtils.lerp(before,target,1-Math.exp(-Math.max(0,deltaSeconds)*15));
    if(Math.abs(this.rightDockOffset-target)<.001)this.rightDockOffset=target;
    this.alertsGroup.position.x=this.rightDockOffset*this.alertsGroup.scale.x;
    this.alertHandle.setBaseTransform(-.14-(3.16-this.rightDockOffset),-.56,.1);
    this.alertsGroup.visible=this.shown&&!!this.world&&(this.rightDockOpen||this.rightDockOffset<3.16);
    return true;
  }

  /** Deferred alert reading, Core start bounce and Critical red pulse. The pulse
   * is quantised (alertPulseLevel), so a critical card repaints a few times a
   * second, never every frame. */
  private animateAlerts(deltaSeconds:number):boolean {
    let changed=false;
    if(this.alertsPending&&this.world&&this.clock()-this.alertsReadAt>=ALERT_RECHECK_MS){
      this.readAlerts(this.world);this.refreshAlerts();changed=true;
      // This delayed Core alert reading may finish while paused, after the
      // last snapshot refresh. Only its already-open dossier needs a refresh.
      if(this.livePageView?.id.startsWith('hud-alert')&&this.actions.isCurrentPage?.(this.livePageView))this.actions.refresh?.();
    }
    if(this.alertBounces.size){
      const cards=new Map(this.alertCards.map(card=>[card.key,card]));
      for(const [key,bounce] of this.alertBounces){
        const offset=bounce.step(deltaSeconds),card=cards.get(key);
        if(card){this.placePiece(card.piece,card.baseX-offset/100,card.baseY,.02,card.rotation);changed=true;}
        if(bounce.idle)this.alertBounces.delete(key);
      }
    }
    const critical=this.alertsGroup.visible?this.alertCards.filter(card=>card.critical):[];
    if(critical.length){
      this.pulseSeconds+=Math.max(0,deltaSeconds);
      const level=alertPulseLevel(this.pulseSeconds);
      if(level!==this.pulseLevel){
        this.pulseLevel=level;const color=nativeAlertPulseColor(level);
        for(const card of critical)if(card.painted!==color){card.painted=color;card.piece.redraw(undefined,color);changed=true;}
      }
    }
    return changed;
  }

  getRightDockBounds():{left:number;top:number;right:number;bottom:number} {
    return {left:this.viewportWidth-324+this.rightDockOffset*100,top:30,right:this.viewportWidth,bottom:Math.max(100,this.viewportHeight-370)};
  }

  private drawViewControl(action:NativeHudViewAction,ctx:CanvasRenderingContext2D,w:number,h:number,_rng:()=>number):void {
    const icons:Record<NativeHudViewAction,string>={walls:'wall',roofs:'roof',foliage:'resource-tree',zones:'zones',home:'home',camera:'camera','room-stats':'room-stats',beauty:'beauty-view'};
    drawPicto(ctx,icons[action],w/2,h/2,Math.min(w,h)*.39);
  }

  setVisible(visible: boolean): void {
    this.shown = visible;
    this.colonistsGroup.visible = visible && !!this.world && colonistBarVisible(this.viewportWidth, this.viewportHeight);
    this.resourcesGroup.visible = visible && !!this.world;
    this.alertsGroup.visible = visible && !!this.world && (this.rightDockOpen||this.rightDockOffset<3.16);
    this.timeGroup.visible = visible && !!this.world && this.windowDockVisible;
    this.alertHandleGroup.visible=this.notificationsAutoHide&&visible&&!!this.world&&this.alerts.length>0;
    // The discreet actual frame rate remains visible through pages/front screens.
    this.fpsGroup.visible = true;
  }

  get blocks(): readonly CardboardPiece[] {
    return [...this.ownedPieces].filter(piece => {
      for (let node: THREE.Object3D | null = piece; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
  }
  get stats(): {portraits: number; colonists: number; resourceTypes: number; alerts: number; page: number; pages: number} {
    return {portraits: this.portraits.length, colonists: this.colonists.length, resourceTypes: this.resources.length, alerts: this.alerts.length, page: 1, pages: 1};
  }

  private makePiece(options: CardboardPieceOptions): CardboardPiece {
    const piece = this.art.createPiece(options); this.ownedPieces.add(piece); return piece;
  }
  private dropPiece(piece: CardboardPiece): void { this.activePoses.delete(piece);this.ownedPieces.delete(piece); this.art.disposePiece(piece); }
  private placePiece(piece:CardboardPiece,x:number,y:number,z=0,rotation=0):void {
    const base=piece.userData.basePos;
    if(base.x!==x||base.y!==y||base.z!==z||piece.userData.baseRot.z!==rotation)piece.setBaseTransform(x,y,z,rotation);
  }
  private drawCaption(ctx: CanvasRenderingContext2D, w: number, h: number, label: string,width=w/2.8,height=h/2.8): void {
    ctx.save();ctx.scale(w/width,h/height);ctx.font=`bold ${NATIVE_TEXT.small}px ${FONT}`;ctx.fillStyle=PALETTE.inkDark;ctx.textAlign='center';fitText(ctx,label,width/2,height/2+4,width-12);ctx.restore();
  }
  private smallButton(label: string, seed: number, onClick: () => void): CardboardPiece {
    return this.makePiece({w: 0.34, h: 0.29, depth: 0.044, bgColor: PALETTE.kraftBase, bevel: 0.036, seed, interactive: true,
      drawFn: (ctx, w, h) => { ctx.font = `bold ${NATIVE_TEXT.medium*1.9}px ${FONT}`; ctx.fillStyle = PALETTE.inkDark; ctx.textAlign = 'center'; ctx.fillText(label, w / 2, h / 2 + 12); }, onClick});
  }
  private refreshPortraits(world: World,ownership?:HudPortraitOwnership379,structure?: (id:number)=>World['structures'][number]|undefined): void {
    // Every colonist is on the bar (no pages): ColonistBarDrawLocsFinder scales the
    // cells down and wraps them into rows until all fit, so no entry is hidden.
    const shown = this.colonists;
    const ids = `${this.viewportWidth}:${shown.map(p => p.id).join(',')}`, changed = ids !== this.portraitIds;
    if (changed) {
      this.barRaster379.clear();
      const bar = this.barLayout = colonistBarLayout(shown.map(() => 0), this.viewportWidth), scale = bar.scale;
      for (const entry of this.portraits) { if (entry.image) { entry.image.onload = null; entry.image.onerror = null; } this.dropPiece(entry.piece); }
      if (this.barPiece) { this.dropPiece(this.barPiece); this.barPiece = undefined; }
      this.portraits = []; this.portraitIds = ids; this.barDirty = true; this.barDrawnAt = -Infinity;
      const cardW = BAR_CARD_W * scale, cardH = BAR_CARD_H * scale;
      shown.forEach((pawn, idx) => {
        const loc = bar.locs[idx]!;
        const entry = {pawnId: pawn.id, index: idx, name: pawnShortName(pawn.name), mood: rounded(pawn.mood), skin: '#f2cfb1', shirt: PALETTE.sageMountain, sleeping: false, selected: this.selectedIds.has(pawn.id), loaded: false, appearanceKey: '', signature: ''} as PortraitCard;
        // One hit-only plane per card (click, tooltip, highlight); the cards are
        // painted together on the bar's single sheet below.
        entry.piece = this.makePiece({w: cardW / 100, h: cardH / 100, hitOnly: true, interactive: true, drawFn: () => {},
          onClick: () => { if (!this.world?.pawns.some(p => p.id === entry.pawnId && isColonist(p))) return; this.setSelection([entry.pawnId]); this.actions.selectPawn(entry.pawnId); }});
        entry.piece.userData.nativeId=`hud:pawn:${pawn.id}`;
        entry.piece.setBaseTransform((loc.x + BAR_BASE * scale / 2 - this.viewportWidth / 2) / 100, -(loc.y - 3 * scale + cardH / 2) / 100, .02, 0);
        this.colonistsGroup.add(entry.piece); this.portraits.push(entry);
      });
      if (shown.length) {
        const pad = 8, left = bar.left - pad, top = BAR_MARGIN_TOP - 3 * scale - 2, width = bar.right - bar.left + 2 * pad, height = Math.max(...bar.locs.map(loc => loc.y)) + (BAR_CARD_H - 3) * scale + 2 - top;
        const k = Math.min(1.25, 4096 / Math.max(width, 1));
        this.barBox = {left, top, width, height};
        this.barPiece = this.makePiece({w: width / 100, h: height / 100, depth: .001, paper: false, retainPaint: true, hasBorder: false, seed: 4401, textureWidth: Math.round(width * k), textureHeight: Math.round(height * k),
          drawFn: (ctx, w, h, rng) => this.drawBar(ctx, w, h, rng)});
        this.barPiece.setBaseTransform((left + width / 2 - this.viewportWidth / 2) / 100, -(top + height / 2) / 100, 0, 0);
        this.colonistsGroup.add(this.barPiece);
      }
      this.rail.visible = shown.length > 0 && scale > .6;
      this.rail.scale.x = Math.max(.4, (bar.right - bar.left + 16) / 340);
      this.rail.position.x = ((bar.left + bar.right) / 2 - this.viewportWidth / 2) / 100;
      this.rail.position.y = -(BAR_MARGIN_TOP - 3 * scale) / 100;
    }
    // The sheet is read at most once a second (selection and layout changes at once): 80 portraits cost 80 appearance keys per read.
    const selectionKey = [...this.selectedIds].join(), now = this.clock();
    if (changed || selectionKey !== this.barSelection || now - this.barScanAt >= 1000) {
    this.barSelection = selectionKey; this.barScanAt = now;
    const apparel = ownership?.apparel??new Map<number, MaterialPile[]>(), weapons = ownership?.weapons??new Map<number, string>();
    if(!ownership){const ownedApparel=apparel as Map<number,MaterialPile[]>,ownedWeapons=weapons as Map<number,string>,idsOnPage = new Set(shown.map(p => p.id));
    for (const pile of world.piles) {
      if (pile.owner.type === 'apparel' && idsOnPage.has(pile.owner.pawnId)) { const list = ownedApparel.get(pile.owner.pawnId) ?? []; list.push(pile); ownedApparel.set(pile.owner.pawnId, list); }
      else if (pile.owner.type === 'equipment' && idsOnPage.has(pile.owner.pawnId)) ownedWeapons.set(pile.owner.pawnId, pile.item);
    }}
    this.portraits.forEach((entry, idx) => {
      const pawn = shown[idx]!, appearance = appearanceOf(pawn, world.seed), look = apparelAppearance(apparel.get(pawn.id)), expression = portraitExpressionOf(pawn), limbMask = humanLimbVisualMask(pawn);
      entry.name = pawnShortName(pawn.name); entry.mood = rounded(pawn.mood); entry.selected = this.selectedIds.has(pawn.id); entry.sleeping = expression !== 'awake'; entry.skin = hex(appearance.skinColor); entry.shirt = look.color === undefined ? PALETTE.sageMountain : hex(look.color);
      const appearanceKey = JSON.stringify([appearance, look.signature, expression, limbMask, weapons.get(pawn.id)]);
      if (entry.appearanceKey !== appearanceKey) {
        entry.appearanceKey = appearanceKey; entry.loaded = false;
        if (entry.image) { entry.image.onload = null; entry.image.onerror = null; }
        const image = new Image(); entry.image = image;
        image.onload = () => { if (!this.disposed && entry.image === image && this.ownedPieces.has(entry.piece)) { entry.loaded = true; this.barDirty = true; this.flushBar(); } };
        image.onerror = () => { if (entry.image === image) entry.loaded = false; };
        image.src = portraitDataUrl(appearance, look, weapons.get(pawn.id), expression, limbMask);
      }
      entry.bar = colonistBarState346(world, pawn,structure);
      entry.piece.userData.tooltip = `${pawn.name} · ${pawn.state} · Moral ${entry.mood}% · Nourriture ${rounded(pawn.hunger)}% · Repos ${rounded(pawn.rest)}%${colonistBarStateLabel346(entry.bar)}`;
      const signature = JSON.stringify([entry.name, entry.mood, entry.selected, appearanceKey, entry.bar]);
      if (entry.signature !== signature) { entry.signature = signature; this.barDirty = true; }
    });
    }
    this.flushBar();
    // The list of every colonist stays one click away at the bar's right end.
    const bar = this.barLayout;
    this.rosterButton.visible = shown.length > 1 && !!bar;
    if (bar) this.placePiece(this.rosterButton,(bar.right + 24 - this.viewportWidth / 2) / 100, -(BAR_MARGIN_TOP + 14) / 100, .02);
    this.setVisible(this.shown);
  }

  /** Repaints changed ink on the bar sheet, at most once a second:
   * never per frame. */
  private flushBar():void {
    if(!this.barDirty||!this.barPiece||this.disposed)return;
    const wait=1000-(this.clock()-this.barDrawnAt);
    if(wait>0){if(this.barTimer===undefined)this.barTimer=setTimeout(()=>{this.barTimer=undefined;this.flushBar();},wait);return;}
    this.barDirty=false;this.barDrawnAt=this.clock();this.barPiece.redraw();
  }
  private drawBar(ctx:CanvasRenderingContext2D,w:number,h:number,rng:()=>number):void {
    const box=this.barBox,bar=this.barLayout;if(!box||!bar)return;
    const k=w/box.width,s=bar.scale;
    const slots:NativeColonistRasterPlacement379[]=[];
    this.portraits.forEach((col,idx)=>{
      const loc=bar.locs[idx];if(!loc)return;
      slots.push({id:col.pawnId,key:col.signature,x:loc.x-4.5*s-box.left,y:loc.y-3*s-box.top,sx:s*BAR_CARD_W/70,sy:s*BAR_CARD_H/96,card:col});
    });
    this.barRaster379.draw(ctx,w,h,k,this.portraitIds,slots,rng);
  }
  colonistPaintMetrics379():Readonly<NativeColonistBarRaster379['stats']>{return {...this.barRaster379.stats};}

  private cornerWidth():number{
    const left=colonistBarVisible(this.viewportWidth,this.viewportHeight)&&this.barLayout?.locs.length?this.barLayout.left:this.viewportWidth/2;
    return Math.max(80,left-16);
  }
  private refreshResources():void {
    const counts=new Map(this.resources.map(row=>[row.item,row.stock]));
    const quantity=(node:StorageFilterNode):number=>node.item?(node.item==='furniture'?0:counts.get(node.item)??0):(node.children??[]).reduce((sum,child)=>sum+quantity(child),0);
    type Row={id:string;label:string;value:string;color:string;item?:ItemId;level:number;branch?:{id:string;open:boolean};activate:()=>void};
    const rows:Row[]=[];
    const visit=(node:StorageFilterNode,level:number):void=>{
      const count=quantity(node);if(count<=0)return;
      const isBranch=!node.item,open=this.resourceExpanded.has(node.id),item=node.item&&node.item!=='furniture'?node.item:undefined;
      rows.push({id:node.id,label:node.label,value:amount(count),color:item?hex(ITEM_DEFINITIONS[item].color):PALETTE.creamPaper,item,level,
        branch:isBranch?{id:node.id,open}:undefined,activate:isBranch?()=>{if(this.resourceExpanded.has(node.id))this.resourceExpanded.delete(node.id);else this.resourceExpanded.add(node.id);this.resourcePage=0;this.refreshResources();}:()=>this.showResources()});
      if(isBranch&&open){
        if(node.id==='foods')rows.push({id:'fresh-nutrition',label:'Nutrition fraîche',value:amount(this.food?.freshNutrition??0),color:PALETTE.ochre,level:level+1,activate:()=>this.showResources()});
        for(const child of node.children??[])visit(child,level+1);
      }
    };
    for(const node of STORAGE_FILTER_TREE)visit(node,0);
    if(!rows.length)rows.push({id:'empty',label:'Stocks connus',value:'0',color:PALETTE.creamPaper,level:0,activate:()=>this.showResources()});
    if(this.leftHudBottom<76)rows.splice(0,rows.length,{id:'compact',label:'Stocks · ouvrir',value:'',color:PALETTE.ochre,level:0,activate:()=>this.showResources()});
    const width=Math.min(224,this.cornerWidth()),limit=Math.min(this.viewportHeight-144,this.leftHudBottom-8-28);
    const capacity=Math.max(1,Math.floor(limit/28)),pages=Math.max(1,Math.ceil(rows.length/capacity));
    this.resourcePage=Math.min(this.resourcePage,pages-1);
    const previous=new Map(this.tags.map(tag=>[tag.id,tag]));
    this.tags.length=0;
    const visible=rows.slice(this.resourcePage*capacity,(this.resourcePage+1)*capacity);
    const add=(row:Row,index:number,x=1.12,width=2.24):void=>{
      const seed=1100+index*17,signature=JSON.stringify([row.label,row.value,row.color,row.item,row.level,row.branch?.open]);
      let tag=previous.get(row.id);previous.delete(row.id);
      // The index supplies the literal brush seed, so a reordered row needs a
      // fresh cut/paint just as the original layout did.
      if(tag&&(tag.seed!==seed||tag.piece.userData.w!==width||tag.piece.userData.h!==.28)){this.dropPiece(tag.piece);tag=undefined;}
      if(!tag){
        const live={id:row.id,label:row.label,value:row.value,color:row.color,item:row.item,level:row.level,branch:row.branch,seed,screenWidth:width*100,signature} as ResourceTag;
        live.piece=this.makePiece({w:width,h:.28,depth:.001,paper:false,seed,hasBorder:false,interactive:true,
          drawFn:(ctx,w,h,rng)=>this.drawResource(live,ctx,w,h,rng),onClick:row.activate});
        tag=live;this.resourcesGroup.add(tag.piece);
      }else{
        const changed=tag.signature!==signature;
        Object.assign(tag,{label:row.label,value:row.value,color:row.color,item:row.item,level:row.level,branch:row.branch,signature});
        if(changed)tag.piece.redraw();
      }
      tag.piece.userData.nativeId=`hud:resource:${row.id}`;
      tag.piece.userData.onClick=row.activate;
      tag.piece.userData.tooltip=row.id==='compact'?'Ouvrir tous les stocks connus et leurs propriétaires':row.branch?`${row.branch.open?'Replier':'Déplier'} ${row.label}`:`${row.label} · ${row.value} comptabilisé(s) · détails des propriétaires`;
      this.placePiece(tag.piece,x,-.14-index*.28,.02);this.tags.push(tag);
      if(row.item&&!this.resourceImages.has(row.item)){
        const item=row.item,image=new Image();this.resourceImages.set(item,image);
        image.onload=()=>{if(!this.disposed&&this.resourceImages.get(item)===image)for(const current of this.tags)if(current.item===item&&this.ownedPieces.has(current.piece))current.piece.redraw();};
        image.src=modelIconUrl(`item-${item}`);
      }
    };
    visible.forEach((row,index)=>add(row,index,width/200,width/100));
    if(pages>1){
      const footer=(id:string,label:string,delta:number):Row=>({id,label,value:'',color:PALETTE.creamPaper,level:0,activate:()=>{this.resourcePage=(this.resourcePage+delta+pages)%pages;this.refreshResources();}});
      add(footer('previous',`‹ ${this.resourcePage+1}/${pages}`,-1),visible.length,width*.225/100,width*.45/100);
      add(footer('next','Suite ›',1),visible.length,width*.75/100,width*.5/100);
    }
    for(const tag of previous.values())this.dropPiece(tag.piece);
  }
  private drawResource(res:Omit<ResourceTag,'piece'>,ctx:CanvasRenderingContext2D,w:number,h:number,rng:()=>number):void {
    const screenWidth=res.screenWidth??224;
    ctx.save();ctx.scale(w/screenWidth,h/28);ctx.strokeStyle='#19242b';ctx.lineWidth=3;ctx.lineJoin='round';
    const indent=Math.min(30,(res.level??0)*9),iconX=12+indent;
    if(res.branch){
      ctx.font=`bold ${NATIVE_TEXT.small}px ${FONT}`;ctx.fillStyle='#fff8e9';ctx.textAlign='center';const glyph=res.branch.open?'⌄':'›';ctx.strokeText(glyph,iconX,19);ctx.fillText(glyph,iconX,19);
    }else{
      const image=res.item?this.resourceImages.get(res.item):undefined;
      if(image?.complete&&image.naturalWidth>0)ctx.drawImage(image,indent,2,24,24);
      else {drawPicto(ctx,res.item?'item-'+res.item:'stockpile',iconX,14,9);}
    }
    ctx.font=`${res.branch?'bold ':''}${NATIVE_TEXT.small}px ${FONT}`;ctx.textAlign='left';ctx.fillStyle='#fff8e9';
    const textX=29+indent,valueWidth=res.value?Math.min(68,ctx.measureText(res.value).width+7):0,labelWidth=Math.max(35,screenWidth-textX-valueWidth-8);
    let label=res.label;while(label.length>1&&ctx.measureText(label+(label!==res.label?'…':'')).width>labelWidth)label=label.slice(0,-1);if(label!==res.label)label=label.trimEnd()+'…';
    ctx.strokeText(label,textX,19);ctx.fillText(label,textX,19);
    if(res.value){ctx.textAlign='right';ctx.strokeText(res.value,screenWidth-2,19,68);ctx.fillText(res.value,screenWidth-2,19,68);}
    ctx.restore();
  }

  private refreshAlerts():void {
    // Core: a 154-wide column flush with the right edge, stacked upward so that
    // it ends where the letters begin (LetterStack.LastTopY), which sit 10 above
    // the global controls.
    const maxWidth=Math.min(ALERT_COLUMN_WIDTH,Math.max(80,this.viewportWidth*.4));
    const bottomPx=this.timeGroup.position.y/this.timeGroup.scale.x*100+this.column.lettersBase+this.letterReservePx;
    const availableHeight=Math.max(58,this.viewportHeight-16-bottomPx);
    const previous=new Map(this.alertCards.map(card=>[card.key,card]));
    this.alertCards=[];
    const ctx=this.allAlertsButton.userData.ctx;ctx.font=`bold ${NATIVE_TEXT.small}px ${FONT}`;
    // Core draws every active alert. Here the column ends above the time board:
    // what does not fit scrolls (wheel or arrows), the footer opens the list.
    const total=this.alerts.length,wrapped=this.alerts.map(alert=>inkLines(ctx,alert.text,maxWidth-28)),cardHeight=(lines:number)=>Math.max(28,lines*17+12);
    const fitsFrom=(start:number):boolean=>{let top=32;for(let i=start;i<total;i++){const h=cardHeight(wrapped[i]!.length);if(h>availableHeight-top-40)return false;top+=h+6;}return true;};
    this.alertScroll=Math.max(0,Math.min(this.alertScroll,total-1));
    while(this.alertScroll>0&&fitsFrom(this.alertScroll-1))this.alertScroll--;
    const pulse=nativeAlertPulseColor(this.pulseLevel<0?ALERT_PULSE_LEVELS-1:this.pulseLevel);
    let y=.32,last=this.alertScroll-1;
    for(let index=this.alertScroll;index<total;index++){
      const alert=this.alerts[index]!,idx=index-this.alertScroll,room=availableHeight-y*100-40;
      if(room<28)break;
      const originalLines=wrapped[index]!,maxLines=Math.max(1,Math.floor((room-12)/17));
      const lines=originalLines.slice(0,maxLines);
      if(lines.length<originalLines.length)lines[lines.length-1]=`${lines.at(-1)??''}…`;
      const width=maxWidth;
      const height=cardHeight(lines.length);
      const color=nativeHudAlertColor(alert),critical=!alert.domain&&coreAlertPriority(alert)==='critical',painted=critical?pulse:color;
      const seed=idx*29+53,signature=JSON.stringify([lines,color,critical]);
      let entry=previous.get(alert.key);previous.delete(alert.key);
      if(entry&&(entry.seed!==seed||entry.width!==width||entry.height!==height)){this.dropPiece(entry.piece);entry=undefined;}
      if(!entry){
        const live={key:alert.key,seed,width,height,lines,color,painted,critical,signature,baseX:0,baseY:0,rotation:0} as AlertCard;
        live.piece=this.makePiece({w:width/100,h:height/100,depth:.046,bgColor:painted,bevel:.038,surface:'panel',seed,interactive:true,
          drawFn:(ctx,w,h,rng)=>{
            ctx.save();ctx.scale(w/live.width,h/live.height);drawHandRect(ctx,4,5,4,live.height-10,live.color===PALETTE.creamPaper?PALETTE.ochre:PALETTE.creamPaper,null,0,rng);
            ctx.fillStyle=PALETTE.inkDark;ctx.font=`bold ${NATIVE_TEXT.small}px ${FONT}`;ctx.textAlign='left';
            live.lines.forEach((line,index)=>ctx.fillText(line,14,19+index*17,live.width-24));ctx.restore();
          },onClick:()=>this.activateAlert(live.key,1)});
        live.piece.userData.onSecondary=()=>this.activateAlert(live.key,-1);
        live.piece.userData.onWheel=(direction:number)=>this.scrollAlerts(direction);
        entry=live;this.alertsGroup.add(entry.piece);
      }else{
        const changed=entry.signature!==signature;
        Object.assign(entry,{lines,color,critical,signature});
        if(changed){entry.painted=painted;entry.piece.redraw(undefined,painted);}
      }
      entry.piece.userData.nativeId=`hud:alert:${alert.key}`;
      entry.piece.userData.tooltip=alertHoverText(this.world,alert);
      entry.baseX=-width/200;entry.baseY=-y-height/200;entry.rotation=idx%2===0?-.005:.005;
      this.alertCards.push(entry);y+=(height+6)/100;last=index;
    }
    for(const entry of previous.values())this.dropPiece(entry.piece);
    this.alertLastShown=last;
    // Anchor the stack to the letters: the last card ends at the column's bottom.
    const overflow=this.alertScroll>0||last<total-1,shift=Math.max(0,(this.viewportHeight-16-bottomPx-(y*100-6))/100);
    for(const entry of this.alertCards){entry.baseY-=shift;this.placePiece(entry.piece,entry.baseX-(this.alertBounces.get(entry.key)?.position??0)/100,entry.baseY,.02,entry.rotation);}
    const footerY=-(.32+shift)+.165;
    const arrows=overflow&&maxWidth>=240;
    this.allAlertsButton.visible=overflow;
    if(overflow)this.placePiece(this.allAlertsButton,-.73,footerY);
    this.alertUpButton.visible=arrows&&this.alertScroll>0;this.alertDownButton.visible=arrows&&last<total-1;
    if(arrows){this.placePiece(this.alertUpButton,-2.06,footerY,.02);this.placePiece(this.alertDownButton,-1.68,footerY,.02);}
    if(this.allAlertsCount!==this.alerts.length){this.allAlertsCount=this.alerts.length;this.allAlertsButton.redraw();}
    this.alertHandleGroup.visible=this.notificationsAutoHide&&this.shown&&!!this.world&&this.alerts.length>0;
  }

  private hoverTemperature?: string;
  /** Core GlobalControls.TemperatureString: indoors or outdoors and the air
   * temperature of the cell under the mouse, above the weather. */
  setHoverTemperature(text: string | undefined): void {
    if (text === this.hoverTemperature) return;
    this.hoverTemperature = text;
    if (this.world) this.refreshWeather(this.world);
  }
  private refreshWeather(world: World): void {
    const civil = calendarTick(world), minute = Math.floor(((civil % TICKS_PER_DAY + TICKS_PER_DAY) % TICKS_PER_DAY) * 1440 / TICKS_PER_DAY);
    const kind = world.weather ? perceivedWeather(world) : 'clear', temperature = outdoorTemperature(world);
    const date = world.climate ? climateDate(world) : undefined;
    const icon=nativeWeatherIcon(kind,minute>=360&&minute<1080,!!activeEclipse(world));
    const iconChanged=icon!==this.weatherIconValue;
    if(iconChanged){this.dropPiece(this.weatherIconPiece);this.weatherIconValue=icon;this.weatherIconPiece=this.createWeatherIcon(icon);}
    const readout = {
      clock: clockLabel(minute),
      date: date ? `${date.day} ${quadrums[date.quadrum]} ${date.year}` : `Jour ${1 + Math.floor(civil / TICKS_PER_DAY)} · historique`,
      weather: kind === 'clear' && (minute < 360 || minute >= 1080) ? 'Ciel dégagé' : WEATHER[kind].label,
      temperature: this.hoverTemperature ?? `Extérieur ${Math.round(temperature)} °C`,
      condition: weatherConditionLabel(world),
      wind: world.wind ? windIntensity(world).toFixed(2) : '—'
    };
    const previous=this.weatherReadout;
    this.weatherReadout=readout;this.civilMinute=minute;
    if(previous.clock!==readout.clock||previous.date!==readout.date)this.weatherPiece.redraw();
    if((previous.condition||previous.weather)!==(readout.condition||readout.weather))this.weatherLabelPiece.redraw();
    if(previous.temperature!==readout.temperature)this.temperaturePiece.redraw();
    if(iconChanged||previous.date!==readout.date||previous.weather!==readout.weather||previous.condition!==readout.condition||previous.temperature!==readout.temperature){
      const tip=`${readout.date} · ${readout.weather} · ${readout.temperature}${readout.condition ? ` · ${readout.condition}` : ''}`;
      for(const piece of [this.weatherPiece,this.weatherLabelPiece,this.temperaturePiece,this.weatherIconPiece])piece.userData.tooltip=tip;
    }
  }
  private createWeatherIcon(icon:NativeWeatherIcon):CardboardPiece {
    const rect=this.column.weather,size=ROW_ICON;
    const piece=this.makePiece({w:size/100,h:size/100,depth:.02,outline:nativeWeatherOutline(icon),bgColor:nativeWeatherColor(icon),bevel:.02,hasBorder:false,uvPadding:1.08,textureWidth:96,textureHeight:96,seed:224,interactive:true,
      drawFn:(ctx,w,h,rng)=>drawNativeWeatherIcon(ctx,icon,w,h,rng),onClick:()=>this.showWeather()});
    piece.userData.nativeId='hud:weather';piece.userData.weatherIcon=icon;piece.setBaseTransform(-(rect.right+rect.width-size/2-4)/100,(rect.bottom+rect.height/2)/100,.03,0);this.timeGroup.add(piece);return piece;
  }
  /** Core DateReadout: time of day over the date, right-aligned, 7 in from the edge. */
  private drawDate(ctx:CanvasRenderingContext2D,w:number,h:number):void {
    if(this.civilMinute<0)paintClockInk(ctx,w,h,this.weatherReadout.clock,this.weatherReadout.date);
    else this.clockRaster.draw(ctx,w,h,this.civilMinute,this.weatherReadout.date,this.speedValue>0);
  }
  /** One right-aligned line of the 26-high rows (weather, temperature); `inset` keeps the icon clear. */
  private drawRowText(ctx:CanvasRenderingContext2D,w:number,h:number,text:string,width:number,inset:number):void {
    ctx.save();ctx.scale(w/width,h/26);this.letters(ctx);ctx.textAlign='right';ctx.font=`${NATIVE_TEXT.small}px ${FONT}`;
    let label=text;const room=width-7-inset;while(label.length>1&&ctx.measureText(label).width>room)label=label.slice(0,-1);if(label!==text)label=label.trimEnd()+'…';
    ctx.strokeText(label,width-7,18);ctx.fillText(label,width-7,18);ctx.restore();
  }
  /** Cream letters with a dark outline, as the resource column. */
  private letters(ctx:CanvasRenderingContext2D):void {ctx.strokeStyle='#19242b';ctx.lineWidth=3;ctx.lineJoin='round';ctx.fillStyle='#fff8e9';}

  private livePage(page:NativePage,make:()=>NativePage):NativePage {
    const state=this.actions.readState?.();this.livePageView=page;
    return state?liveNativePage(page,state,()=>this.disposed||!this.world?null:make()):page;
  }
  private showRoster(): void {this.actions.showPage(this.rosterPage());}
  private rosterPage():NativePage {
    return this.livePage({id: 'hud-colonists', title: `${this.colonists.length} colons sur cette carte`, color: PALETTE.sageMountain,
      subtitle: 'Liste complète · les flèches de la barre parcourent les mêmes personnes par pages compactes.',
      rows: this.colonists.map(pawn => ({id: `pawn-${pawn.id}`, label: pawn.name, value: `Moral ${rounded(pawn.mood)}%`, detail: `${pawn.state} · Nourriture ${rounded(pawn.hunger)}% · Repos ${rounded(pawn.rest)}%`,
        controls: [{id: `select-${pawn.id}`, label: 'Sélectionner', onActivate: () => { this.setSelection([pawn.id]); this.actions.selectPawn(pawn.id); }}]}))},()=>this.rosterPage());
  }
  private showResources(): void {this.actions.showPage(this.resourcesPage());}
  private resourcesPage():NativePage {
    const rows: NativeRow[] = [
      {id: 'nutrition-fresh', label: 'Nutrition fraîche connue', value: amount(this.food?.freshNutrition ?? 0), detail: 'Sol et portions portées par les civils vivants ; accès, réservations et régime non garantis.'},
      {id: 'nutrition-physical', label: 'Nutrition physique (lecture historique)', value: amount(this.physicalNutrition), detail: 'Hors foin, stocks de chantier et inventaires ; la fraîcheur n’est pas garantie.'},
      ...this.resources.map(row => ({id: `item-${row.item}`, label: ITEM_DEFINITIONS[row.item].label, value: `${amount(row.stock)} comptabilisé(s)`,
        detail: `Sol ${amount(row.ground)} · porté ${amount(row.carried)} · inventaire ${amount(row.inventory)} · équipé ${amount(row.equipped)} · livré aux chantiers ${amount(row.delivered)}${ITEM_DEFINITIONS[row.item].nutrition ? ` · ${amount(ITEM_DEFINITIONS[row.item].nutrition / 100)} nutrition/unité` : ''}`}))
    ];
    return this.livePage({id: 'hud-resources', title: 'Stocks connus de la carte', subtitle: 'Chaque type présent est conservé dans cette liste. Les matières livrées et les inventaires sont distingués du stock comptabilisé.', color: PALETTE.kraftBase, rows},()=>this.resourcesPage());
  }
  private showAlerts(): void {this.actions.showPage(this.alertsPage());}
  private alertsPage():NativePage {
    return this.livePage({id: 'hud-alerts', title: 'Alertes actuelles', color: PALETTE.terracotta,
      rows: this.alerts.length ? this.alerts.map(alert => ({id: alert.key, label: alert.text, controls: [{id: `details-${alert.key}`, label: 'Détails', onActivate: () => this.showAlert(alert.key)}]})) : [{id: 'none', label: 'Aucune alerte actuelle'}]},()=>this.alertsPage());
  }
  private showAlert(key: string): void {this.actions.showPage(this.alertPage(key));}
  private alertPage(key:string):NativePage {
    const alert = this.alerts.find(row => row.key === key);
    if (!alert) return this.alertsPage();
    const rows: NativeRow[] = [{id: 'text', label: alert.text}];
    if (alert.explanation) rows.push({id: 'explanation', label: alert.explanation});
    if (alert.tooltip) {
      if (alert.tooltip.title) rows.push({id: 'title', label: alert.tooltip.title});
      rows.push({id: 'body', label: alert.tooltip.body});
      alert.tooltip.rows?.forEach((row, index) => rows.push({id: `detail-${index}`, label: row.label, value: row.value}));
    }
    for (const target of alert.targets) {
      if (target.kind === 'actor') {
        const pawn = this.world?.pawns.find(person => person.id === target.id);
        if (pawn && this.world && knownPosition256(this.world, pawn)) rows.push({id: target.key, label: pawn.name, controls: [{id: `select-${pawn.id}`, label: 'Voir la personne', onActivate: () => this.actions.focus?this.actions.focus(target,alert.tab):this.actions.selectPawn(pawn.id)}]});
      } else {
        const cell = target.cell;
        rows.push({id: target.key, label: target.kind === 'object' ? `${target.object.kind} #${target.object.id}` : 'Lieu', value: `(${cell.x}, ${cell.z})`,controls:this.actions.focus?[{id:`focus-${target.key}`,label:'Repérer',onActivate:()=>{const current=this.alerts.find(row=>row.key===key)?.targets.find(item=>item.key===target.key);if(current)this.actions.focus?.(current);}}]:undefined});
      }
    }
    const actions:NonNullable<NativePage['actions']>=[];
    const domain=alert.domain;
    if(domain&&['arrivals','quests','trade','orbital'].includes(domain.action.kind)&&this.actions.domain)actions.push({id:`open-domain-${key}`,label:'Ouvrir le dossier',onActivate:()=>{const current=this.alerts.find(row=>row.key===key)?.domain;if(current)this.actions.domain?.(current);}});
    if(alert.campaign&&this.actions.campaign)actions.push({id:`open-map-${key}`,label:'Voir la carte',onActivate:()=>{const current=this.alerts.find(row=>row.key===key)?.campaign;if(current)this.actions.campaign?.(current);}});
    if(alert.context&&this.actions.context)actions.push({id:`open-context-${key}`,label:'Ouvrir les réglages',onActivate:()=>{const current=this.alerts.find(row=>row.key===key)?.context;if(current)this.actions.context?.(current);}});
    if(this.actions.focus&&alert.targets.length)actions.push({id:`focus-next-${key}`,label:'Repérer la cible suivante',onActivate:()=>{const current=this.alerts.find(row=>row.key===key);if(current){const target=this.alertFocus.next(key,current.targets);if(target)this.actions.focus?.(target,current.tab);}}});
    return this.livePage({id: `hud-alert-${alert.key}`, title: domain?.title??'Alerte actuelle', subtitle: alert.text, color: PALETTE.terracotta, rows,actions},()=>this.alertPage(key));
  }
  private showWeather(): void {this.actions.showPage(this.weatherPage());}
  private weatherPage():NativePage {
    const readout = this.weatherReadout;
    return this.livePage({id: 'hud-site', title: 'Heure et conditions du site', color: PALETTE.slateBlue, rows: [
      {id: 'clock', label: 'Heure civile locale', value: readout.clock}, {id: 'date', label: 'Date', value: readout.date},
      {id: 'weather', label: 'Météo perçue', value: readout.weather}, {id: 'temperature', label: 'Température extérieure', value: readout.temperature},
      {id: 'wind', label: 'Intensité du vent', value: readout.wind}, ...(readout.condition ? [{id: 'condition', label: 'Condition active', value: readout.condition}] : [])
    ]},()=>this.weatherPage());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;if(this.barTimer!==undefined)clearTimeout(this.barTimer);
    this.clockRaster.dispose();this.barRaster379.dispose();this.blightReader379.reset();
    for (const entry of this.portraits) if (entry.image) { entry.image.onload = null; entry.image.onerror = null; }
    for(const image of this.resourceImages.values()){image.onload=null;image.onerror=null;}this.resourceImages.clear();
    for (const piece of this.ownedPieces) this.art.disposePiece(piece);
    this.ownedPieces.clear();
    this.tags.length=0;this.alertCards=[];this.alertBounces.clear();this.alertActivation.reset();
    this.activePoses.clear();
    this.rail.geometry.dispose();
    (this.rail.material as THREE.Material).dispose();
    for (const group of [this.colonistsGroup, this.resourcesGroup, this.alertsGroup, this.timeGroup, this.fpsGroup, this.alertHandleGroup]) { group.removeFromParent(); group.clear(); }
    this.world = undefined; this.colonists = []; this.resources = []; this.alerts = []; this.portraits = [];
  }
}
