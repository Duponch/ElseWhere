import type {World,Command,Cell,Orientation} from '../sim/types';
import type {CampaignSummary} from '../sim/world-map-state';
import type {Panel,Tool,ArchitectCategory} from '../ui/layout';
import type {SavedColony} from '../ui/game-session';
import type {MapObjectSelection} from '../ui/map-object-selection';
import type {ConstructionMaterial} from '../sim/construction-materials';
import type {BillWorkerOptions283} from '../sim/bill-worker-state-283';
import type {StorageControlSettings} from '../ui/storage-item-controls';
import type {CampEntryProgressMessage256,CaravanEncounterProgressMessage261} from '../bridge/protocol';
import type {WorldPhysicalSurface} from '../sim/world-surface-geography';
import type {WorldRoadLink} from '../sim/world-roads';
import type {NativeTextEntity} from './native-rich-text';

/** Presentation-only curtain events; no owner object or simulation permission. */
export type NativeShipCurtainPhase298='closing'|'held'|'clear'|'reset';

/** Pointer facts of one activation, for controls whose meaning depends on
 * them (Core tables: Shift-click on a column header). Keyboard activation has
 * none. */
export interface NativeGesture {shift:boolean}
/** Renderer-neutral native interface. No element, HTML, CSS, browser layout or
 * synthetic click is an authority for a visible control. */
export interface NativeControl {
  id:string;
  label:string;
  icon?:string;
  /** Compact ink glyph; label remains the full accessible action name. */
  glyph?:'expand'|'collapse'|'allow'|'forbid'|'mixed';
  color?:string;
  disabled?:boolean;
  active?:boolean;
  hint?:string;
  caption?:string;
  /** Wrapped secondary information on a full-row painted card. */
  description?:string;
  presentation?:NativeControlStyle;
  /** Widest intrinsic width of a text button, CSS pixels (default 240), for a
   * long label that must stay whole. Layout only. */
  maxWidth?:number;
  /** Drawn mark in place of the label text (the label stays the accessible name). */
  mark?:'check';
  /** Highlight tag (Core UIHighlighter): the control pulses while a shown
   * notion or lesson names it. Existing controls also get one from their id
   * (src/ui/native-highlight-tags.ts). Presentation only. */
  highlight?:string;
  select?:{value:string;options:readonly {value:string;label:string;hint?:string;disabled?:boolean}[];onChange:(value:string)=>void|Promise<unknown>};
  paint?:{group:string;index:number;onPaint:(indices:readonly number[])=>void|Promise<unknown>};
  onActivate:(gesture?:NativeGesture)=>void|Promise<unknown>;
  /** Right click (secondary button) on the control, when it has its own meaning. */
  onSecondary?:(gesture?:NativeGesture)=>void|Promise<unknown>;
  /** View-only pointer/focus preview, released by the native hover owner. */
  onHover?:(hovered:boolean)=>void;
}
export type NativeControlStyle='button'|'tab'|'tile'|'icon'|'navigation'|'research'|'card';
export interface NativeRow {
  presentation?:'record'|'summary'|'plain';
  id:string;
  label:string;
  value?:string;
  detail?:string;
  hint?:string;
  emphasis?:'heading'|'muted'|'normal';
  column?:0|1;
  /** Pregame dossier lane only; existing column semantics stay unchanged. */
  setupColumn?:0|1|2;
  labelWidth?:number;
  dense?:boolean;
  region?:'navigation'|'catalogue'|'details'|'graph';
  controlStyle?:NativeControlStyle;
  graphNode?:{x:number;y:number;width:number;height:number;points:number;cost:number;state:'done'|'active'|'locked'|'available'};
  /** A column with a control is an interactive header (sort, Shift-click). */
  columns?:readonly {label:string;hint?:string;control?:NativeControl}[];
  meter?:{value:number;max?:number;label?:string;color?:string;passion?:0|1|2;secondary?:{value:number;max?:number;label?:string;color?:string}};
  controls?:NativeControl[];
  /** Equal-width cells are used by work and schedule matrices. */
  compact?:boolean;
  tree?:{depth:number;state:'all'|'none'|'mixed';branch:boolean;expanded:boolean};
  input?:{
    value:string;placeholder?:string;maxLength?:number;kind?:'text'|'number';
    onCommit:(value:string)=>void|boolean|Promise<unknown>;
  };
  /** The Bio card (Core `CharacterCardUtility`): one fixed 480 × 455 card. */
  bio?:import('./native-bio-card').NativeBioCard;
  /** The inside of an inspector tab (Core `ITab_Pawn_*`): one fixed card, laid
   * out once from this data (`native-tab-layout.ts`). */
  card?:import('./native-tab-layout').NativeTabSpec;
  /** A line of the inspect pane (Core `InspectPaneUtility`, 432 × 165) rather
   * than of the open inspector tab. */
  inspectPane?:true;
  /** Inspect pane gauges (Core `InspectPaneFiller`: 93 × 16, 6 apart). A gauge
   * with a select opens it on click (allowed area). */
  gauges?:readonly {id:string;label:string;fill:number;color:string;hint:string;select?:NativeControl['select']}[];
}
export interface NativePage {
  textEntities?:readonly NativeTextEntity[];
  id:string;
  title:string;
  /** Changes only when a search scope changes; expansion preserves its position. */
  contentKey?:string;
  subtitle?:string;
  color?:string;
  rows:NativeRow[];
  actions?:NativeControl[];
  onClose?:()=>void;
  /** Explicit cancel gesture, independent of outside-click/close-button policy. */
  onCancel?:()=>void;
  /** True for front screens/confirmations. Captures world input until closed. */
  modal?:boolean;
  /** Core FloatMenu (CSS pixels of the opening click): drawn at the mouse,
   * not modal; a press outside it closes it and is consumed, and it vanishes
   * once the mouse is more than 95 px from it. Escape closes only it. */
  floatMenu?:{x:number;y:number};
  closable?:boolean;
  width?:number;
  height?:number;
  columnRatio?:number;
  layout?:'inspector'|'table'|'tools'|'dialog'|'front'|'architect'|'palette'|'research'|'storage'|'world'|'setup';
  /** Opt-in fixed roster toolbar/headings; presentation only, never persisted. */
  tableProfile?:'colonists'|'factions';
  /** Pregame choice rail, CSS pixels; no persisted or mechanical state. */
  setupCatalogueWidth?:number;
  /** Pregame paper anchor only; no screen-ID classification. */
  setupAnchor?:'center'|'right';
  palette?:'orders'|'zones';
  research?:{width:number;height:number;selected:string;links:readonly {from:string;to:string;path:readonly {x:number;y:number}[]}[]};
  visual?:{
    kind:'planet';surface:WorldPhysicalSurface;roads?:readonly (readonly WorldRoadLink[])[];
    selected:number|null;markers?:readonly {tile:number;label?:string;color?:number}[];
    onSelect:(tile:number)=>void;
  };
  portrait?:{url:string;label:string};
  /** The open inspector tab's window (Core `ITab.size` and its inner margin);
   * absent when no tab is open: only the inspect pane and its tabs show. */
  inspectTab?:{id:string;width:number;height:number;margin:number};
  /** The facts the pane does not show, for the info card behind the (i) button. */
  inspectInfo?:readonly NativeRow[];
}
export interface NativeUiState {
  world?:World;
  epoch?:number;
  campaign?:CampaignSummary;
  panel:Panel;
  category:ArchitectCategory;
  tool:Tool;
  orientation:Orientation;
  selectedPawnIds:readonly number[];
  selectedCell?:Cell;
  selectedObjects:readonly MapObjectSelection[];
  constructionMaterial:ConstructionMaterial;
  creationStorage:StorageControlSettings;
  selectedAnimalId?:number;
  selectedMechanoidId?:number;
  lightLevel?:number;
  campProgress?:CampEntryProgressMessage256;
  caravanProgress?:CaravanEncounterProgressMessage261;
  speed:number;
  hasGame:boolean;
  busy:boolean;
  fault?:string;
  saves:readonly SavedColony[];
  /** Schema 369: the colour of the Planifier tool. */
  planColor369?:import('../sim/plans-369').PlanColor369;
}
export interface NativeUiActions {
  command:(command:Command)=>Promise<unknown>;
  /** Opens an archived letter (History, schema 352). */
  openLetter352?:(id:number)=>void;
  panel:(panel:Panel)=>void|Promise<unknown>;
  category:(category:ArchitectCategory)=>void;
  tool:(tool:Tool)=>void;
  selectPawn:(id:number)=>void;
  speed:(speed:number)=>void|Promise<unknown>;
  rotate:(direction:number)=>void;
  material:(material:ConstructionMaterial)=>void;
  creationStorage:(settings:StorageControlSettings)=>void;
  front:(page:'home'|'create'|'load')=>void|Promise<unknown>;
  save:()=>void|Promise<unknown>;
  exportSave:()=>void|Promise<unknown>;
  showPage:(page:NativePage)=>void;
  refresh:()=>void;
  clearSelection?:()=>void;
  selectObject?:(object:MapObjectSelection)=>void;
  placeFurniture?:(structureId:number)=>void;
  replant?:(pileId:number)=>void;
  readBillWorkers?:(structureId:number,billId:number)=>Promise<BillWorkerOptions283>;
  cancelCampEntry?:(id:number,groupId:number)=>Promise<unknown>;
  readState?:()=>NativeUiState;
  closePage?:()=>void;
  /** Existing Main flows; presentation entry points only. */
  openSaveManager?:()=>void|Promise<unknown>;
  openOptions?:()=>void|Promise<unknown>;
  openHelp?:()=>void|Promise<unknown>;
  openVisitorTrade?:()=>void;
  openOrbitalTrade?:(consoleId?:number)=>void;
  openFactionComms298?:(consoleId?:number)=>void;
  /** The Factions tab, as its bottom card opens it (the Bio card's faction chip). */
  openFactions?:()=>void;
  /** Opens a scoped confirmation; the Worker retains launch authority. */
  launchShip298?:(computerId:number)=>void;
  resizeZone?:(kind:'stockpile'|'growing',id:number,shrink:boolean)=>void;
  /** Schema 369: the plan tools. `planColor369` picks the Planifier colour
   * (Core's colour grid); `editPlan369` arms Planifier on a plan (expand) or
   * Retirer le plan (shrink), as the plan gizmos do. */
  planColor369?:(color:import('../sim/plans-369').PlanColor369)=>void;
  editPlan369?:(planId:number,shrink:boolean)=>void;
  paintAllowedArea?:(id:number,enabled:boolean)=>void;
  /** View only; undefined restores the active allowed-area paint target. */
  previewAllowedArea?:(id:number|undefined)=>void;
  pawnActivity?:(pawnId:number)=>string;
}
