import type {NativeControl,NativeControlStyle,NativePage,NativeRow} from './native-contract';
import {NATIVE_GAP,NATIVE_LINE,NATIVE_TEXT,NATIVE_WINDOW} from './native-ui-scale';
import {layoutNativeBioCard,NATIVE_BIO_SIZE,type NativeBioLayout} from './native-bio-card';
import {layoutNativeTab} from './native-tab-layout';
import {appliedScroll,type NativeTabCard} from './native-tab-card';
import {gearPortraitRect} from './native-tab-gear';
import {ARCHITECT_WINDOW,FLOAT_MENU,architectCategoryRect,compareFloatMenuOptions,floatMenuLabelWidth,floatMenuOptionSize,floatMenuOrigin,layoutFloatMenu} from './native-float-menu';
import {PAWN_TABLE,pawnTableSpec,type PawnTableKind,type PawnTableSpec} from './native-pawn-table';
import {NATIVE_RESEARCH} from './native-research-metrics';
import {factionTableColumns,historyColumns,NATIVE_FACTIONS,NATIVE_HISTORY,NATIVE_MENU,NATIVE_QUESTS} from './native-main-tab-metrics';
import {NATIVE_INFO,NATIVE_MESSAGE,NATIVE_OPTIONS,NATIVE_TRADE,nativeTradeColumns} from './native-dialog-metrics';
import {NATIVE_CREATION,NATIVE_FILE_LIST,NATIVE_HOME,nativeFileColumns} from './native-front-metrics';
import {NATIVE_MAP_SEARCH} from './native-map-search-metrics';

/** Design tokens in RimWorld interface points (see native-ui-scale.ts); neither
 * browser layout nor DPR changes the model. `body` and `small` are both the
 * game's Small text (RimWorld writes nearly everything in Small); `bottom` is
 * Elsewhere's own bottom dock of cards, not a RimWorld size. */
export const NATIVE_UI={body:NATIVE_TEXT.small,small:NATIVE_TEXT.small,title:NATIVE_TEXT.medium,line:NATIVE_LINE.small,padding:NATIVE_WINDOW.margin,gap:NATIVE_GAP.small,button:NATIVE_WINDOW.button,tab:NATIVE_WINDOW.tab,scrollbar:NATIVE_WINDOW.scrollbar,bottom:82} as const;
export const NATIVE_RIGHT_DOCK_WIDTH=264;
/** Distance between two wrapped lines of Small text (tooltips, cards, pane). */
export const NATIVE_LEADING=18;
export type NativeRegion='navigation'|'catalogue'|'details'|'graph'|'toolbar';
export interface NativeRect {x:number;y:number;width:number;height:number}
/** Region y is absolute in the page. Row/control y remains relative to header. */
export interface NativeRegionBox extends NativeRect {contentHeight:number;contentWidth?:number}
export interface NativeControlBox extends NativeRect {control:NativeControl;style:NativeControlStyle;region?:NativeRegion;hitOnly?:boolean}
/** Core inspect pane parts, in page-box points: the open tab's window (height 0
 * when no tab is open), the 72 × 30 tab strip, the 432 × 165 pane (`summary`)
 * with its name, gauges and lines, and the gizmo area to its right. */
export interface NativeInspectorParts {
  sheet:NativeRect;tabs:NativeRect;summary:NativeRect;actions:NativeRect;
  name?:NativeRect;
  gauges?:{rowId:string;gauge:NonNullable<NativeRow['gauges']>[number];rect:NativeRect}[];
  lines?:{row:NativeRow;rect:NativeRect;lines:string[]}[];
}
export interface NativeRowBox {
  row:NativeRow;x:number;top:number;width:number;height:number;labelWidth:number;
  controlTop:number;controlHeight:number;controlColumns:number;detailLines:string[];
  /** Text lane stays clear of actions arranged beside the same record. */
  textWidth:number;inlineActions:boolean;matrixTail?:boolean;
  labelLines:string[];valueLines:string[];matrix:boolean;controls:NativeControlBox[];
  /** Optional explicitly sized input, in the same page coordinates as controls. */
  inputRect?:NativeRect;
  /** Laid out Bio card, card points from (x, top). */
  bio?:NativeBioLayout;
  /** Laid out inspector-tab card (needs, health, gear...), tab points from (x, top). */
  card?:NativeTabCard;
}
export interface NativePageBox {
  x:number;y:number;width:number;height:number;header:number;footer:number;body:NativeRect;
  contentHeight:number;rows:NativeRowBox[];layout:NonNullable<NativePage['layout']>;
  regions:Partial<Record<NativeRegion,NativeRegionBox>>;actions:NativeControlBox[];
  inspectorParts?:NativeInspectorParts;
  infoParts?:{title:NativeRect;icon:NativeRect};
  /** Explicit useful globe area for the World browser only. */
  visualRect?:NativeRect;
  /** Fixed portrait in the pregame dossier; absent for existing layouts. */
  portraitRect?:NativeRect;
  /** Fixed column headings for the two long animal catalogues only. */
  tableHeader?:NativeRect;
  matrixColumnWeights?:readonly number[];
  /** Exact pixel columns of a RimWorld pawn table (`native-pawn-table.ts`). */
  matrixSpec?:PawnTableSpec;
}
export type TextMeasure=(text:string,size:number,bold?:boolean)=>number;
/** The renderer uses the same vertical rule for ink, hints and controls. */
export function nativeTableRowScroll(box:Pick<NativePageBox,'tableHeader'>,row:NativeRow,offset:number):number{return box.tableHeader&&row.columns?0:offset;}
/** Shared geometry for matrix controls, painted headings and their hint planes.
 * The name and activity lanes have the same width in every row. */
export function nativeMatrixColumns(row:Pick<NativeRow,'value'>,x:number,width:number,count:number,tail=!!row.value,weights?:readonly number[]|PawnTableSpec):NativeRect[]{
  if(count<=0)return [];
  if(weights&&!Array.isArray(weights)){const spec=weights as PawnTableSpec;let at=x+spec.name;return Array.from({length:count},(_,index)=>{const w=spec.widths[index]??1,box={x:at,y:0,width:w,height:0};at+=w;return box;});}
  weights=weights as readonly number[]|undefined;
  const left=x+104,available=Math.max(1,width-104-(tail?192:0)),gap=6,cell=Math.max(1,(available-gap*(count-1))/count);
  if(weights?.length!==count||weights.some(value=>!Number.isFinite(value)||value<=0))return Array.from({length:count},(_,index)=>({x:left+index*(cell+gap),y:0,width:cell,height:0}));
  const unit=Math.max(1,(available-gap*(count-1))/weights.reduce((sum,value)=>sum+value,0));let offset=0;
  return weights.map(value=>{const width=unit*value,box={x:left+offset,y:0,width,height:0};offset+=width+gap;return box;});
}
/** Long single-word headings wrap instead of squeezing their glyphs. The full
 * original column label is still the tooltip and the model's authority. */
export function nativeMatrixHeadingLines(text:string,width:number,measure:TextMeasure):string[]{
  const words:string[]=[];
  for(const word of text.split(/\s+/).filter(Boolean)){
    let part='';for(const character of Array.from(word)){if(part&&measure(part+character,NATIVE_TEXT.small,true)>width){words.push(part);part='';}part+=character;}if(part)words.push(part);
  }
  return wrapNativeText(words.join(' '),width,(value,size)=>measure(value,size,true),NATIVE_TEXT.small);
}
/** Share the globe/dossier split with its physical scene placement. */
export function nativeVisualWidth(page:NativePage,width:number):number{return page.visual?Math.min(page.id==='world'?560:360,width*.48):0;}
export function wrapNativeText(text:string,width:number,measure:TextMeasure,size:number=NATIVE_TEXT.small):string[]{
  const lines:string[]=[];
  for(const paragraph of text.split('\n')){
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      const next=line?line+' '+word:word;
      if(line&&measure(next,size)>width){lines.push(line);line=word;}else line=next;
    }
    lines.push(line);
  }
  return lines;
}
/** File names and seeds can be one long token. Card text wraps these without
 * compressing its glyphs; the complete string remains in its native tooltip. */
export function wrapNativeCardText(text:string,width:number,measure:TextMeasure,size:number=NATIVE_TEXT.small):string[]{
  const parts:string[]=[];
  for(const paragraph of text.split('\n')){
    const words:string[]=[];
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      let part='';for(const character of Array.from(word)){if(part&&measure(part+character,size)>width){words.push(part);part='';}part+=character;}if(part)words.push(part);
    }
    parts.push(...wrapNativeText(words.join(' '),width,measure,size));
  }
  return parts;
}
/** A save catalogue stays a catalogue, even when its provenance is a long
 * report. Complete text is retained by the control and its scrollable tooltip. */
export function nativeCardInk(control:NativeControl,width:number,measure:TextMeasure,secondary=false){
  const inkWidth=Math.max(40,width-36-(secondary?54:0));
  const lines=(text:string|undefined,size:number,bold:boolean)=>{
    if(!text)return [];
    const full=wrapNativeCardText(text,inkWidth,(value,s)=>measure(value,s,bold),size),visible=full.slice(0,2);
    if(full.length>2){const last=Array.from(visible[1]!);while(last.length&&measure(last.join('')+'…',size,bold)>inkWidth)last.pop();visible[1]=last.join('').trimEnd()+'…';}
    return visible;
  };
  const title=lines(control.label,NATIVE_TEXT.small,true),caption=lines(control.caption,NATIVE_TEXT.small,false),description=lines(control.description,NATIVE_TEXT.small,false);
  const height=Math.max(76,28+title.length*NATIVE_LEADING+(caption.length?caption.length*NATIVE_LEADING+4:0)+(description.length?description.length*NATIVE_LEADING+4:0));
  return {title,caption,description,height,inkWidth};
}
function naturalWidth(control:NativeControl,measure:TextMeasure,style:NativeControlStyle):number {
  if(style==='icon')return 48;
  if(style==='navigation')return 96;
  if(style==='tab')return Math.max(68,Math.min(128,measure(control.label,NATIVE_UI.body,true)+22));
  if(!control.select&&!control.caption&&/^[↶↷×+−-]$/u.test(control.label))return 32;
  return Math.max(68,Math.min(control.maxWidth??240,measure(control.label,NATIVE_UI.body,true)+24+(control.icon?24:0)+(control.select?16:0)));
}
/** Text actions use intrinsic width. Only named matrices and tile grids fill cells. */
export function flowNativeControls(controls:readonly NativeControl[],rect:NativeRect,measure:TextMeasure,style:NativeControlStyle='button',tileColumnLimit?:number):{controls:NativeControlBox[];height:number}{
  const boxes:NativeControlBox[]=[];
  if(!controls.length)return {controls:boxes,height:0};
  const gap=style==='icon'?6:NATIVE_UI.gap;
  if(style==='card'){
    let top=rect.y;
    for(let index=0;index<controls.length;){
      const control=controls[index++]!,secondary=controls[index]?.presentation==='icon'?controls[index++]:undefined;
      const {height}=nativeCardInk(control,rect.width,measure,!!secondary);
      boxes.push({control,style:'card',x:rect.x,y:top,width:rect.width,height});
      if(secondary)boxes.push({control:secondary,style:'icon',x:rect.x+rect.width-54,y:top+14,width:38,height:38});
      top+=height+12;
    }
    return {controls:boxes,height:top-rect.y-12};
  }
  if(style==='navigation'){
    // Core MainTabWindow_Architect: two columns of 32-high buttons, no gap.
    const columns=rect.width>=190?ARCHITECT_WINDOW.columns:1,rowHeight=ARCHITECT_WINDOW.rowHeight;
    controls.forEach((control,index)=>{
      const cell=columns===2?architectCategoryRect(index,rect.width):{x:0,y:Math.floor(index/columns)*rowHeight,width:rect.width,height:rowHeight+1};
      boxes.push({control,style:control.presentation??style,x:rect.x+cell.x,y:rect.y+cell.y,width:cell.width,height:cell.height});
    });
    return {controls:boxes,height:Math.ceil(controls.length/columns)*rowHeight};
  }
  if(style==='tile'){
    // Core GizmoGridDrawer: 75 × 75 gizmos, 5 apart, 14 between rows.
    const size=ARCHITECT_WINDOW.gizmo,gapX=ARCHITECT_WINDOW.gizmoGapX,gapY=ARCHITECT_WINDOW.gizmoGapY;
    const fit=Math.max(1,Math.floor((rect.width+gapX)/(size+gapX)));
    const columns=Math.min(fit,Math.max(1,tileColumnLimit??fit));
    controls.forEach((control,index)=>boxes.push({control,style:control.presentation??style,x:rect.x+(index%columns)*(size+gapX),y:rect.y+Math.floor(index/columns)*(size+gapY),width:size,height:size}));
    return {controls:boxes,height:Math.ceil(controls.length/columns)*(size+gapY)-gapY};
  }
  let x=rect.x,y=rect.y,lineHeight=0;
  for(const control of controls){
    const actualStyle=control.presentation??style,width=Math.min(rect.width,naturalWidth(control,measure,actualStyle));
    const height=actualStyle==='icon'?46:actualStyle==='tab'?NATIVE_UI.tab:control.caption?40:NATIVE_UI.button;
    if(x>rect.x&&x+width>rect.x+rect.width+.01){x=rect.x;y+=lineHeight+gap;lineHeight=0;}
    boxes.push({control,style:actualStyle,x,y,width,height});x+=width+gap;lineHeight=Math.max(lineHeight,height);
  }
  return {controls:boxes,height:y-rect.y+lineHeight};
}
function rowBox(row:NativeRow,x:number,top:number,width:number,measure:TextMeasure,table:boolean,tileColumnLimit?:number,matrixTail=!!row.value,matrixWeights?:readonly number[]|PawnTableSpec):NativeRowBox {
  if(row.tree)return storageTreeRowBox(row,x,top,width,measure);
  if(row.bio)return bioRowBox(row,x,top,measure);
  if(row.card)return cardRowBox(row,x,top,measure);
  const matrix=!!row.compact&&!!row.controls?.length&&table;
  const isTabs=row.controlStyle==='tab'||row.id==='pawn-tabs'||row.id==='health-tabs';
  const rowControls=row.controls??[],onlyButtons=!row.label&&!row.value&&!row.detail||isTabs;
  const actionWidth=rowControls.reduce((total,control,index)=>total+naturalWidth(control,measure,control.presentation??'button')+(index?NATIVE_UI.gap:0),0);
  const inlineActions=!matrix&&!row.input&&!row.meter&&!onlyButtons&&rowControls.length>0&&rowControls.length<=2&&(!row.controlStyle||row.controlStyle==='button')&&actionWidth<=Math.min(width*.65,width-140);
  const textWidth=inlineActions?width-actionWidth-14:width;
  const selectValue=!matrix&&rowControls.length===1&&!!rowControls[0]?.select&&rowControls[0].label===row.value;
  const labelWidth=row.labelWidth??(matrix?104:selectValue?textWidth:Math.min(180,textWidth*.43));
  let labelLines=wrapNativeText(row.label,row.value||row.input||row.meter?labelWidth:textWidth,measure,NATIVE_UI.body);
  const valueLines=row.value&&!selectValue&&!(row.input&&row.input.value===row.value)?wrapNativeText(row.value,Math.max(60,textWidth-labelWidth-8),measure,NATIVE_UI.body):[];
  const detailLines=row.detail?wrapNativeText(row.detail,textWidth,measure,NATIVE_UI.small):[];
  let height=Math.max(28,Math.max(labelLines.length,valueLines.length)*NATIVE_UI.line+8);
  let controlTop=0,controlHeight:number=NATIVE_UI.button,controlColumns=row.controls?.length??0,controls:NativeControlBox[]=[];
  if(row.emphasis==='heading')height=row.id==='heading-bio-skills'?28:34;
  if(row.columns)height=48;
  else if(matrix){
    height=row.controls!.some(control=>control.caption)?48:42;controlHeight=height-6;controlTop=3;
    controls=nativeMatrixColumns(row,x,width,controlColumns,matrixTail,matrixWeights).map((column,index)=>({control:row.controls![index]!,style:row.controls![index]!.presentation??'button',x:column.x,y:top+3,width:column.width,height:controlHeight}));
  }else if(row.meter)height=row.meter.secondary?34:row.dense?25:28;
  else if(row.input){
    height=Math.max(36,labelLines.length*NATIVE_UI.line+8);controlHeight=26;controlTop=4;
    const count=row.controls?.length??0,left=x+width-Math.max(0,count*28-2);
    controls=(row.controls??[]).map((control,index)=>({control,style:control.presentation??'button',x:left+index*28,y:top+4,width:26,height:26}));
  }
  else if(row.controls?.length){
    const plainFlow=onlyButtons&&!!row.controlStyle;
    if(inlineActions){
      controlTop=6;
      const flow=flowNativeControls(row.controls,{x:x+width-actionWidth,y:top+controlTop,width:actionWidth,height:0},measure);
      controls=flow.controls;controlHeight=controls[0]?.height??NATIVE_UI.button;controlColumns=controls.length;
      height=Math.max(height+(detailLines.length?detailLines.length*18+4:0),flow.height+12);
    }else{
    controlTop=onlyButtons?(isTabs||plainFlow?0:4):height+detailLines.length*18+6;
    const left=x;
    const flow=flowNativeControls(row.controls,{x:left,y:top+controlTop,width:Math.max(1,width-(left-x)),height:0},measure,isTabs?'tab':row.controlStyle??'button',tileColumnLimit);
    controls=flow.controls;controlHeight=controls[0]?.height??NATIVE_UI.button;
    controlColumns=controls.filter(control=>control.y===controls[0]?.y).length;
    height=isTabs||plainFlow?flow.height:Math.max(labelLines.length*NATIVE_UI.line+8,controlTop+flow.height+(onlyButtons?8:10));
    }
  }
  if(detailLines.length&&!row.controls?.length)height+=detailLines.length*18+4;
  if(row.presentation==='record'&&!row.meter&&!isTabs&&!matrix)height+=8;
  return {row,x,top,width,height,labelWidth,controlTop,controlHeight,controlColumns,detailLines,labelLines,valueLines,matrix,controls,textWidth,inlineActions,matrixTail};
}
/** One fixed card: its own rectangles, its buttons as icon controls. */
function bioRowBox(row:NativeRow,x:number,top:number,measure:TextMeasure):NativeRowBox {
  const bio=layoutNativeBioCard(row.bio!,(text,role,bold)=>measure(text,NATIVE_TEXT[role],!!bold));
  const controls=bio.buttons.map(({control,rect}):NativeControlBox=>({control,style:'icon',x:x+rect.x,y:top+rect.y,width:rect.width,height:rect.height}));
  return {row,x,top,width:NATIVE_BIO_SIZE.width,height:NATIVE_BIO_SIZE.height,labelWidth:0,controlTop:0,controlHeight:30,controlColumns:controls.length,detailLines:[],
    textWidth:NATIVE_BIO_SIZE.width,inlineActions:false,labelLines:[],valueLines:[],matrix:false,controls,bio,
    ...(row.input?{inputRect:{x:x+8,y:top+2.5,width:(bio.buttons[0]?.rect.x??NATIVE_BIO_SIZE.width)-16,height:25}}:{})};
}
/** One fixed inspector-tab card: its own rectangles, no flowing rows. */
let cardMemo=new Map<object,NativeTabCard>();
function cardLayoutOf(row:NativeRow,measure:TextMeasure,maxHeight?:number):NativeTabCard {
  let card=cardMemo.get(row.card!);
  if(!card){const spec=row.card!,bounded=spec.type==='gear'&&maxHeight!==undefined?{...spec,maxHeight:Math.min(spec.maxHeight,maxHeight)}:spec;card=layoutNativeTab(bounded,(text,role,bold)=>measure(text,NATIVE_TEXT[role],!!bold));cardMemo.set(row.card!,card);}
  return card;
}
function cardRowBox(row:NativeRow,x:number,top:number,measure:TextMeasure):NativeRowBox {
  const card=cardLayoutOf(row,measure);
  return {row,x,top,width:card.width,height:card.height,labelWidth:0,controlTop:0,controlHeight:30,controlColumns:0,detailLines:[],
    textWidth:card.width,inlineActions:false,labelLines:[],valueLines:[],matrix:false,controls:[],card};
}
const requestedWidth=(page:NativePage,fallback:number)=>page.width?(page.width>20?page.width:page.width*100):fallback;
const infoWrap=(value:string,width:number,measure:TextMeasure):string[]=>!value.includes('\n')&&measure(value,NATIVE_TEXT.small)<=width?[value]:value.split(/\s+/).some(word=>measure(word,NATIVE_TEXT.small)>width)?wrapNativeCardText(value,width,measure):wrapNativeText(value,width,measure);
/** Storage rows keep disclosure and permission as independent hit targets. */
function storageTreeRowBox(row:NativeRow,x:number,top:number,width:number,measure:TextMeasure):NativeRowBox {
  const indent=Math.max(0,row.tree!.depth)*17,controlSize=24,controlTop=1.5;
  const labelLeft=indent+controlSize+4,permissionLeft=Math.max(0,width-controlSize);
  const labelWidth=Math.max(0,permissionLeft-labelLeft-6),controls:NativeControlBox[]=[];
  const rowControls=row.controls??[],permission=rowControls[rowControls.length-1];
  if(row.tree!.branch&&(row.controls?.length??0)>1){
    const control=row.controls![0]!;
    controls.push({control,style:control.presentation??'button',x:x+indent,y:top+controlTop,width:controlSize,height:controlSize});
  }
  if(permission)controls.push({control:permission,style:permission.presentation??'button',x:x+permissionLeft,y:top+controlTop,width:controlSize,height:controlSize});
  return {row,x,top,width,height:27,labelWidth,controlTop,controlHeight:controlSize,controlColumns:controls.length,detailLines:[],
    textWidth:labelWidth,inlineActions:true,labelLines:[storageSingleLine(row.label,labelWidth,measure)],valueLines:[],matrix:false,controls};
}
/** Only the visible ink is shortened; the row retains the complete tooltip text. */
function storageSingleLine(text:string,width:number,measure:TextMeasure):string {
  if(width<=0)return '';
  const line=text.replace(/\s+/g,' ').trim();if(measure(line,NATIVE_UI.body)<=width)return line;
  const chars=Array.from(line);while(chars.length&&measure(chars.join('')+'…',NATIVE_UI.body)>width)chars.pop();
  return chars.length?chars.join('').trimEnd()+'…':measure('…',NATIVE_UI.body)<=width?'…':'';
}
/** Compact settings and toolbar rows are exclusive to the storage page. */
function storageFixedRowBox(row:NativeRow,x:number,top:number,width:number,measure:TextMeasure):NativeRowBox {
  if(row.input){
    const wanted=row.label?(row.labelWidth??(width<260?80:130)):0,right=row.controls?.length?row.controls.length*28+6:0;
    const labelWidth=Math.min(wanted,Math.max(0,width-right-78));
    const box=rowBox({...row,labelWidth},x,top,width,measure,false);
    box.height=32;box.labelLines=row.label?[storageSingleLine(row.label,box.labelWidth-5,measure)]:[];
    return box;
  }
  if(row.controls?.length){
    const labelWidth=row.label?100:0,gap=6,left=x+(row.label?labelWidth+8:0);
    const columns=row.controls.length,cell=Math.max(1,(width-(left-x)-gap*(columns-1))/columns);
    const controls:NativeControlBox[]=row.controls.map((control,index)=>({control,style:control.presentation??'button',x:left+index*(cell+gap),y:top,width:cell,height:32}));
    return {row,x,top,width,height:32,labelWidth,controlTop:0,controlHeight:32,controlColumns:columns,detailLines:[],textWidth:labelWidth,
      inlineActions:true,labelLines:row.label?[storageSingleLine(row.label,labelWidth-5,measure)]:[],valueLines:[],matrix:false,controls};
  }
  return rowBox(row,x,top,width,measure,false);
}
/** Search and footer stay fixed. Only a short viewport makes settings scroll. */
function storagePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const pad=NATIVE_UI.padding,gap=6,header=page.subtitle?76:48,bottom=NATIVE_UI.bottom+10;
  const width=Math.min(Math.max(220,Math.min(requestedWidth(page,480),viewport.width-32)),Math.max(1,viewport.width-24));
  const maximumHeight=Math.min(page.height??760,760,Math.max(1,viewport.height-bottom-12));
  const contentWidth=Math.max(1,width-pad*2-12),rows:NativeRowBox[]=[];
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:Math.max(1,width-pad*2),height:0},measure);
  const footerPad=14,footer=page.actions?.length?actionFlow.height+footerPad*2:footerPad;
  const fixed:Partial<Record<'details'|'navigation',{boxes:NativeRowBox[];height:number}>>={};
  for(const key of ['details','navigation'] as const){
    const fixedRows=page.rows.filter(row=>(row.region??'details')===key),boxes:NativeRowBox[]=[];
    let top=0,left=0,right=0,columns=false;
    for(const row of fixedRows){
      const inColumns=key==='details'&&row.column!==undefined&&contentWidth>=426;
      if(inColumns&&!columns){columns=true;left=right=top;}
      else if(!inColumns&&columns){columns=false;top=Math.max(left,right);}
      const columnWidth=columns?(contentWidth-gap)/2:contentWidth;
      const x=pad+(columns&&row.column===1?columnWidth+gap:0),rowTop=columns?(row.column===1?right:left):top;
      const box=storageFixedRowBox({...row,region:key},x,rowTop,columnWidth,measure);boxes.push(box);
      if(columns){if(row.column===1)right+=box.height+gap;else left+=box.height+gap;}else top+=box.height+gap;
    }
    const contentHeight=Math.max(top,left,right)-(boxes.length?gap:0);
    fixed[key]={boxes,height:contentHeight};
  }
  // Measure each tree row once, before deciding the paper height. Search may
  // leave no rows; it must not reserve an empty viewport-sized catalogue.
  const treeBoxes:NativeRowBox[]=[];let treeTop=0;
  for(const row of page.rows.filter(row=>row.region==='catalogue')){const box=rowBox(row,pad,treeTop,contentWidth,measure,false);treeBoxes.push(box);treeTop+=box.height;}
  const details=fixed.details!,navigation=fixed.navigation!;
  const sectionGaps=(details.boxes.length?gap:0)+(navigation.boxes.length?gap:0);
  const height=Math.min(maximumHeight,header+footer+gap+details.height+navigation.height+sectionGaps+Math.max(1,treeTop));
  const footerTop=Math.max(header,height-footer),contentBottom=Math.max(header,footerTop-gap);
  const detailsBudget=Math.max(0,contentBottom-header-navigation.height-sectionGaps-Math.min(72,treeTop));
  const detailsHeight=Math.min(details.height,detailsBudget);
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={};let nextTop=header;
  for(const key of ['details','navigation'] as const){
    const section=fixed[key]!,visibleHeight=key==='details'?detailsHeight:section.height;
    regions[key]={x:pad,y:nextTop,width:contentWidth+12,height:visibleHeight,contentHeight:section.height};
    for(const box of section.boxes){const delta=nextTop-header;box.top+=delta;box.controls=box.controls.map(control=>({...control,y:control.y+delta}));rows.push(box);}
    nextTop+=visibleHeight+(section.boxes.length?gap:0);
  }
  const catalogueHeight=Math.max(0,contentBottom-nextTop);
  regions.catalogue={x:pad,y:nextTop,width:contentWidth+12,height:catalogueHeight,contentHeight:treeTop};
  const treeDelta=nextTop-header;
  for(const box of treeBoxes){box.top+=treeDelta;box.controls=box.controls.map(control=>({...control,y:control.y+treeDelta}));rows.push(box);}
  const actions=actionFlow.controls.map(control=>({...control,y:footerTop-header+footerPad+control.y}));
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body:{...regions.catalogue},contentHeight:treeTop,rows,layout:'storage',regions,actions};
}
/** A message's whole text is laid out only for the selected dossier. The
 * list has fixed cells; do not wrap or flow every archived message to throw
 * that geometry away, especially for long histories. */
function historyMessageBox(row:NativeRow,x:number,top:number,width:number):NativeRowBox{
  const h=NATIVE_HISTORY,c=historyColumns(width),controls:NativeControlBox[]=[];
  for(const control of row.controls??[]){
    if(control.id.startsWith('history-select-'))controls.push({control,style:'history-row',x:x+c.messageX,y:top,width:c.message,height:h.rowHeight});
    else{
      const isPin=control.icon==='history-pin',left=isPin?0:c.iconX,cell=isPin?c.pin:c.icon,size=Math.min(h.pinSize,cell);
      controls.push({control,style:'icon',x:x+left+(cell-size)/2,y:top+(h.rowHeight-size)/2,width:size,height:size});
    }
  }
  return {row,x,top,width,height:h.rowHeight,labelWidth:c.date,textWidth:c.message,controlTop:0,controlHeight:h.rowHeight,controlColumns:controls.length,
    detailLines:[],labelLines:[],valueLines:[],matrix:false,inlineActions:true,controls};
}
function regionRows(page:NativePage,regions:Partial<Record<NativeRegion,NativeRegionBox>>,header:number,measure:TextMeasure,tileColumnLimit?:number):NativeRowBox[]{
  const rows:NativeRowBox[]=[],tops:Partial<Record<NativeRegion,number>>={};
  const researchSearch=page.layout==='research'&&page.rows.some(row=>row.id==='research-search');
  for(const row of page.rows){
    const key=row.region??'details',region=regions[key];if(!region)continue;
    const top=tops[key]??0,usableWidth=Math.max(24,region.width-(page.layout==='architect'&&key!=='catalogue'?0:12));
    if(researchSearch&&key==='navigation'&&(row.id==='research-tabs'||row.id==='research-search')){
      const r=NATIVE_RESEARCH,inline=usableWidth>=r.searchWidth+r.tabMin+4;
      if(row.id==='research-tabs'){
        const width=inline?usableWidth-r.searchWidth-4:usableWidth,box=rowBox(row,region.x,region.y-header+top,width,measure,false);
        let x=0,y=0;
        box.controls=(row.controls??[]).map(control=>{
          const w=Math.min(width,Math.max(r.tabMin,Math.min(r.tabMax,measure(control.label,NATIVE_TEXT.small,true)+24)));
          if(x>0&&x+w>width){x=0;y+=r.tabHeight;}
          const result:NativeControlBox={control,style:'tab',x:region.x+x,y:box.top+y,width:w,height:r.tabHeight};x+=w;return result;
        });
        box.height=y+r.tabHeight;box.controlHeight=r.tabHeight;
        rows.push(box);tops[key]=top+box.height;region.contentHeight=tops[key]!;
      }else{
        const width=Math.min(r.searchWidth,usableWidth),start=inline?Math.max(0,(r.tabHeight-r.searchHeight)/2):top+4;
        const box=rowBox(row,region.x+usableWidth-width,region.y-header+start,width,measure,false);
        box.height=r.searchHeight;box.labelWidth=0;box.inputRect={x:box.x,y:box.top,width,height:r.searchHeight};
        rows.push(box);tops[key]=Math.max(top,start+box.height);region.contentHeight=tops[key]!;
      }
      continue;
    }
    if(key==='graph'&&row.graphNode){
      const node=row.graphNode,nodeTop=region.y-header+node.y,x=region.x+node.x;
      const box=rowBox(row,x,nodeTop,node.width,measure,false);box.width=node.width;box.height=node.height;
      box.controls=(row.controls??[]).map((control,index)=>({control,style:index===0?'research':'icon',x:index===0?x:x+node.width-24,y:index===0?nodeTop:nodeTop+node.height-22,width:index===0?node.width:22,height:index===0?node.height:19}));
      rows.push(box);region.contentHeight=Math.max(region.contentHeight,node.y+node.height);continue;
    }
    const box=page.layout==='history'&&row.historyEntry?historyMessageBox(row,region.x,region.y-header+top,usableWidth)
      :rowBox(row,region.x,region.y-header+top,usableWidth,measure,false,tileColumnLimit);
    if(page.layout==='history'&&row.historyGraph)box.height=NATIVE_HISTORY.graphHeight;
    if(page.layout==='quests'&&(key==='navigation'||key==='toolbar')){
      if(row.id.startsWith('quests-entry-')&&row.controls?.length===1){
        box.height=box.controlHeight=NATIVE_QUESTS.rowHeight;
        box.controls=[{control:row.controls[0]!,style:'button',x:box.x,y:box.top,width:box.width,height:box.height}];
      }else if(row.id==='quests-search'&&row.input){
        box.height=NATIVE_QUESTS.searchHeight;box.labelWidth=0;box.inputRect={x:box.x,y:box.top,width:box.width,height:box.height};
      }
    }
    if(page.layout==='research'&&key==='details'){
      if(row.id==='research-selected-title')box.height=Math.max(box.height,NATIVE_RESEARCH.titleHeight);
      if(row.id==='research-selected-action'&&row.controls?.length===1){
        box.height=box.controlHeight=NATIVE_RESEARCH.startHeight;
        box.controls=[{control:row.controls[0]!,style:'button',x:box.x,y:box.top,width:box.width,height:box.height}];
      }
    }
    rows.push(box);
    tops[key]=top+box.height;region.contentHeight=tops[key]!;
  }
  return rows;
}
/** Core `FloatMenu`: the options are the whole window, one full-width box each
 * (Small text, 4 / 6 margins, one point of overlap), columns of up to 90 % of the
 * screen height, opened at the mouse; the title floats above. */
function floatMenuPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const menu=page.floatMenu!;
  const options:{id:string;control:NativeControl;lines:number;row:NativeRow}[]=[];
  const rowOf=(row:NativeRow,control:NativeControl):void=>{options.push({id:row.id,control,lines:0,row});};
  for(const row of page.rows){
    const text=row.label+(row.value?` (${row.value})`:'');
    if(row.controls?.length){
      for(const control of row.controls)rowOf(row,{...control,label:row.controls.length===1||control.disabled&&control.label==='Indisponible'?text:control.label,
        hint:[control.hint??row.value,row.detail].filter(Boolean).join(' · ')||undefined});
    }else rowOf(row,{id:`${row.id}-option`,label:text,hint:row.detail,disabled:true,onActivate:()=>{}});
  }
  for(const action of page.actions??[])rowOf({id:action.id,label:action.label},action);
  options.sort((a,b)=>compareFloatMenuOptions(a.control,b.control));
  const tiny=options.length>60,role=tiny?'tiny':'small',size=NATIVE_TEXT[role],line=NATIVE_LINE[role];
  const wrapWidth=Math.max(1,Math.min(floatMenuLabelWidth(tiny),viewport.width-FLOAT_MENU.scrollbar-2*(tiny?3:6)-4)),sizes=options.map(option=>{
    const lines=wrapNativeText(option.control.label,wrapWidth,measure,size);option.lines=lines.length;
    return floatMenuOptionSize(measure(option.control.label,size),lines.length,tiny,line);
  });
  const header=page.title?Math.min(FLOAT_MENU.titleOffsetY,Math.max(0,viewport.height-2)):0;
  const laid=layoutFloatMenu(sizes,viewport.width,Math.max(1,Math.min(viewport.height,(viewport.height-header-1)/FLOAT_MENU.screenFraction)));
  const origin=floatMenuOrigin(menu.x,menu.y,laid.width,laid.height,viewport.width,viewport.height);
  const rows:NativeRowBox[]=options.map((option,index)=>{
    const place=laid.placements[index]!,control:NativeControlBox={control:option.control,style:'option',x:place.x,y:place.y,width:place.width,height:place.height};
    return {row:{id:option.id,label:'',...option.row.region?{region:option.row.region}:{}},x:place.x,top:place.y,width:place.width,height:place.height,labelWidth:0,controlTop:0,controlHeight:place.height,controlColumns:1,
      detailLines:[],textWidth:place.width,inlineActions:false,labelLines:[],valueLines:[],matrix:false,controls:[control]};
  });
  const body={x:0,y:header,width:laid.width,height:laid.height};
  return {x:origin.x,y:Math.max(0,Math.min(origin.y-header,viewport.height-header-laid.height)),width:laid.width,height:header+laid.height,header,footer:0,body,contentHeight:laid.viewHeight+1,rows,layout:'dialog',regions:{},actions:[]};
}
function structuredPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure,layout:'architect'|'research'):NativePageBox {
  const pad=NATIVE_UI.padding,gap=14;
  // The Core Architect has no paper around its grid: the window is as wide as its columns of gizmos.
  const toolCount=layout==='architect'?page.rows.filter(row=>row.region==='catalogue').reduce((sum,row)=>sum+(row.controls?.length??0),0):0;
  const gridWidth=Math.max(1,Math.min(10,toolCount))*(ARCHITECT_WINDOW.gizmo+ARCHITECT_WINDOW.gizmoGapX)-ARCHITECT_WINDOW.gizmoGapX+12;
  const requested=layout==='architect'?pad*2+ARCHITECT_WINDOW.gridStart+gridWidth:viewport.width-24,width=Math.min(Math.max(280,Math.min(layout==='architect'?Math.min(requested,1180):requested,viewport.width-(layout==='architect'?32:24))),Math.max(1,viewport.width-24));
  const header=48,bottom=NATIVE_UI.bottom+12,availableHeight=Math.max(1,viewport.height-bottom-12);
  const maximumHeight=Math.min(availableHeight,page.height??(layout==='architect'?900:780));
  let height=maximumHeight;
  const body:NativeRect={x:pad,y:header,width:width-pad*2,height:Math.max(0,height-header-pad)};
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={};
  if(layout==='architect'){
    // Core MainTabWindow_Architect: a 200 wide window of categories with the
    // 200 × 270 information box above it, the designator grid to its right.
    // Give the grid at least one complete gizmo at reduced logical widths.
    const left=Math.min(ARCHITECT_WINDOW.width,Math.max(1,width-pad*2-10-ARCHITECT_WINDOW.gizmo-12)),infoHeight=ARCHITECT_WINDOW.infoHeight;
    regions.details={x:pad,y:header,width:left,height:infoHeight,contentHeight:0};
    regions.navigation={x:pad,y:header+infoHeight+gap,width:left,height:Math.max(0,body.height-infoHeight-gap),contentHeight:0};
    const catalogueX=pad+left+10;
    regions.catalogue={x:catalogueX,y:header,width:Math.max(1,width-pad-catalogueX),height:body.height,contentHeight:0};
  }else{
    const r=NATIVE_RESEARCH,sidebar=Math.min(Math.max(r.leftMin,Math.round(body.width*r.leftFraction)),Math.max(88,body.width-r.gap-160));
    const graphX=pad+sidebar+r.gap,graphWidth=Math.max(1,width-pad-graphX);
    regions.details={x:pad,y:header,width:sidebar,height:body.height,contentHeight:0};
    regions.navigation={x:graphX,y:header,width:graphWidth,height:NATIVE_UI.tab,contentHeight:0};
    regions.graph={x:graphX,y:header+NATIVE_UI.tab+6,width:graphWidth,height:Math.max(1,body.height-NATIVE_UI.tab-6),contentHeight:0,contentWidth:page.research?.width??850};
  }
  const tileColumnLimit=layout==='architect'?10:4,rows=regionRows(page,regions,header,measure,tileColumnLimit);
  const oldTops:Partial<Record<NativeRegion,number>>={},needed:Partial<Record<NativeRegion,number>>={};
  for(const[key,region]of Object.entries(regions)){oldTops[key as NativeRegion]=region!.y;needed[key as NativeRegion]=0;}
  for(const row of rows){const key=row.row.region??'details',region=regions[key]!;needed[key]=Math.max(needed[key]??0,header+row.top+row.height-region.y);}
  // Retain the actual graph and all its routes; declared canvas padding alone
  // must not inflate a sparse graph or add empty vertical scrolling.
  let graphNeed=needed.graph??0;
  for(const link of page.research?.links??[])for(const point of link.path)graphNeed=Math.max(graphNeed,point.y);
  if(graphNeed>0)graphNeed+=page.rows.some(row=>row.id==='research-search')?NATIVE_RESEARCH.margin:12;
  const navNeed=needed.navigation??0,catalogueNeed=needed.catalogue??0,detailNeed=needed.details??0;
  const infoNeed=detailNeed>0?ARCHITECT_WINDOW.infoHeight:1,navWanted=Math.max(1,navNeed);
  const requiredBody=layout==='architect'?Math.max(infoNeed+(detailNeed&&navNeed?gap:0)+navWanted,catalogueNeed):
    Math.max(detailNeed,navNeed+graphNeed+(navNeed&&graphNeed?6:0));
  height=Math.min(maximumHeight,header+pad+Math.max(32,requiredBody));body.height=Math.max(0,height-header-pad);
  if(layout==='architect'){
    // The Core dimensions are targets, not a licence to overflow small
    // logical viewports. Keep a scrollable category row and an information
    // slice even when the height is less than 270 + one row.
    const splitGap=detailNeed&&navNeed?Math.min(gap,Math.max(0,body.height-2*(ARCHITECT_WINDOW.rowHeight+1))):0;
    const available=Math.max(0,body.height-splitGap);
    const navMinimum=Math.min(navWanted,Math.max(1,Math.min(ARCHITECT_WINDOW.rowHeight+1,Math.floor(available*.5))));
    const infoHeight=Math.min(infoNeed,Math.max(0,available-navMinimum));
    const navigationHeight=Math.min(navWanted,Math.max(0,available-infoHeight));
    regions.details!.height=infoHeight;
    regions.navigation!.y=header+infoHeight+splitGap;regions.navigation!.height=navigationHeight;
    regions.catalogue!.height=Math.min(body.height,Math.max(1,catalogueNeed));
  }else{
    const graphGap=navNeed>0&&graphNeed>0?6:0;
    const navigationMinimum=Math.min(Math.max(1,navNeed),NATIVE_UI.tab,Math.max(1,body.height-graphGap-1));
    const navigationBudget=graphNeed>0?Math.max(navigationMinimum,body.height-graphGap-Math.min(graphNeed,Math.max(24,body.height*.5))):Math.max(1,body.height-1);
    const navigationHeight=Math.min(Math.max(1,navNeed),navigationBudget);
    regions.details!.height=body.height;regions.navigation!.height=navigationHeight;
    regions.graph!.y=header+navigationHeight+graphGap;regions.graph!.height=Math.max(1,body.height-navigationHeight-graphGap);regions.graph!.contentHeight=graphNeed;
  }
  // Only origins move. No row is remeasured, scaled, dropped or reassigned.
  for(const row of rows){const key=row.row.region??'details',delta=regions[key]!.y-oldTops[key]!;if(delta){row.top+=delta;for(const control of row.controls)control.y+=delta;if(row.inputRect)row.inputRect.y+=delta;}}
  const primary=regions[layout==='architect'?'catalogue':'details']!;
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer:pad,body:{x:primary.x,y:primary.y,width:primary.width,height:primary.height},contentHeight:primary.contentHeight,rows,layout,regions,actions:[]};
}
/** Core MainTabWindow_Quests: one 36% list and one independent selected
 * dossier, separated by 17 points. Neither side expands for a long history. */
function questsPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const q=NATIVE_QUESTS,pad=NATIVE_UI.padding,header=48,bottom=NATIVE_UI.bottom+12;
  const width=Math.max(1,Math.min(q.width,viewport.width-24)),
    height=Math.max(1,Math.min(q.height,viewport.height-bottom-12)),bodyHeight=Math.max(0,height-header-pad);
  const innerWidth=Math.max(0,width-2*pad),gap=Math.min(q.gap,Math.max(0,innerWidth-2));
  const rail=Math.max(1,Math.min(Math.round(innerWidth*q.leftFraction),innerWidth-gap-1));
  const tab=page.rows.find(row=>row.id==='quests-tabs'),search=page.rows.find(row=>row.id==='quests-search');
  const tabHeight=tab?rowBox(tab,pad,0,Math.max(24,rail-12),measure,false).height:0;
  const fixed=!!tab&&!!search&&bodyHeight>=tabHeight+q.searchHeight+q.rowHeight+8;
  const navY=header+(fixed?tabHeight+4:0),navHeight=bodyHeight-(fixed?tabHeight+q.searchHeight+8:0);
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={
    navigation:{x:pad,y:navY,width:rail,height:navHeight,contentHeight:0},
    details:{x:pad+rail+gap,y:header,width:Math.max(1,innerWidth-rail-gap),height:bodyHeight,contentHeight:0},
  };
  if(fixed)regions.toolbar={x:pad,y:header,width:rail,height:bodyHeight,contentHeight:0};
  const laid=fixed?page:{...page,rows:page.rows.map(row=>row.region==='toolbar'?{...row,region:'navigation' as const}:row)};
  const rows=regionRows(laid,regions,header,measure),details=regions.details!;
  if(fixed){
    const field=rows.find(row=>row.row.id==='quests-search')!,delta=bodyHeight-q.searchHeight-field.top;
    field.top+=delta;if(field.inputRect)field.inputRect.y+=delta;
    regions.toolbar!.contentHeight=bodyHeight;
  }
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer:pad,
    body:{x:details.x,y:details.y,width:details.width,height:details.height},contentHeight:details.contentHeight,
    rows,layout:'quests',regions,actions:[]};
}
/** History keeps the header and filters above a half-width message list and
 * its independently scrolling selected text. Graphs and statistics use the
 * full paper. The screen may shrink, never the stored message text. */
function historyPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const h=NATIVE_HISTORY,pad=NATIVE_UI.padding,header=48,bottom=NATIVE_UI.bottom+12;
  const width=Math.max(1,Math.min(h.width,viewport.width-24)),height=Math.max(1,Math.min(h.height,viewport.height-bottom-12));
  const inner=Math.max(24,width-2*pad),space=Math.max(0,height-header-pad),messages=page.historyMode==='messages';
  const tab=page.rows.find(row=>row.id==='history-tabs'),search=page.rows.find(row=>row.id==='history-search'),filter=page.rows.find(row=>row.id==='history-filters');
  const searchW=Math.min(h.searchWidth,inner),inline=!!search&&inner>=searchW+320,
    searchX=pad+(inline?Math.min(h.searchX,inner-searchW):0);
  const toolbarRows:NativeRowBox[]=[];
  let used=0;
  if(tab){
    const tabBox=rowBox(tab,pad,0,inline?Math.max(24,searchX-pad-8):inner,measure,false);
    toolbarRows.push(tabBox);used=tabBox.height;
  }
  if(search){
    const top=inline?h.searchY:used+4,box=rowBox(search,searchX,top,searchW,measure,false);
    box.height=h.searchHeight;box.labelWidth=0;box.inputRect={x:searchX,y:top,width:searchW,height:h.searchHeight};
    toolbarRows.push(box);used=Math.max(used,top+box.height);
  }
  if(filter){const box=rowBox(filter,pad,used+4,inner,measure,false);toolbarRows.push(box);used+=4+box.height;}
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:inner,height:0},measure);
  const footerWanted=actionFlow.height? actionFlow.height+8:0,overflow=footerWanted>space/3,footer=overflow?0:footerWanted;
  const toolbarHeight=Math.min(used,Math.max(1,space-footer-36)),contentY=header+toolbarHeight+4,
    contentHeight=Math.max(0,space-toolbarHeight-footer-4);
  const gap=Math.min(h.detailGap,Math.max(0,inner-2)),rail=messages?Math.max(1,Math.round((inner-gap)/2)):0;
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={
    details:{x:pad+(messages?rail+gap:0),y:contentY,width:messages?Math.max(1,inner-rail-gap):inner,height:contentHeight,contentHeight:0},
    toolbar:{x:pad,y:header,width:inner,height:toolbarHeight,contentHeight:used},
  };
  if(messages)regions.navigation={x:pad,y:contentY,width:rail,height:contentHeight,contentHeight:0};
  const contentRows=page.rows.filter(row=>row.region!=='toolbar');
  if(overflow&&page.actions?.length)contentRows.push({id:'history-overflow-actions',label:'',region:messages?'navigation':'details',controls:page.actions});
  const rows=[...toolbarRows,...regionRows({...page,rows:contentRows},regions,header,measure)],details=regions.details!;
  const actions=overflow?[]:actionFlow.controls.map(control=>({...control,y:height-pad-footer-header+4+control.y}));
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer:pad+footer,body:{x:details.x,y:details.y,width:details.width,height:details.height},contentHeight:details.contentHeight,rows,layout:'history',regions,actions};
}
/** Core inspect pane (`InspectPaneUtility`, `InspectPaneFiller`,
 * `GizmoGridDrawer`): a pane 72 × max(6, tabs) wide and 165 high at the bottom
 * left, its 72 × 30 tabs right-aligned on top of it, the open tab's window
 * resting on the tabs from the left edge, and the 75 × 75 gizmos from the pane's
 * right + 14, their bottom 14 above the pane's bottom, 5 apart. */
export const NATIVE_INSPECT={tabWidth:72,tabHeight:30,paneHeight:165,paneInner:12,paneTop:8,gaugeWidth:93,gaugeHeight:16,gaugeGap:6,gizmo:75,gizmoGap:5,gizmoStart:14,gizmoRowGap:14} as const;
function inspectorPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const I=NATIVE_INSPECT,tabsRow=page.rows.find(row=>row.id==='pawn-tabs')!,tabCount=tabsRow.controls?.length??0;
  const paneWidth=I.tabWidth*Math.max(6,tabCount),lower=I.tabHeight+I.paneHeight,bottom=NATIVE_UI.bottom+10;
  const special=new Set(['inspect-close','inspect-tab-close','inspect-info']);
  const gizmos=(page.actions??[]).filter(control=>!special.has(control.id));
  const gizmoLeft=paneWidth+I.gizmoStart,gizmoRoom=Math.max(I.gizmo,viewport.width-12-gizmoLeft-NATIVE_RIGHT_DOCK_WIDTH);
  const available=Math.max(1,viewport.height-bottom-12),tab=page.inspectTab;
  cardMemo=new Map();
  const cardRow=tab?page.rows.find(row=>row.card&&!row.inspectPane):undefined,cardHeight=cardRow?cardLayoutOf(cardRow,measure,Math.max(40,available-lower)).height:undefined;
  // Rows of gizmos upwards; on a short screen, longer rows rather than off-screen ones.
  const maxRows=Math.max(1,Math.floor(Math.max(available,lower)/(I.gizmo+I.gizmoRowGap)));
  const perRow=Math.max(1,Math.floor((gizmoRoom+I.gizmoGap)/(I.gizmo+I.gizmoGap)),Math.ceil(gizmos.length/maxRows)),gizmoRows=Math.ceil(gizmos.length/perRow);
  const gizmoHeight=gizmoRows?gizmoRows*(I.gizmo+I.gizmoRowGap):0;
  if(available<lower+40||viewport.width<paneWidth+24)return layoutNativePage({...page,layout:'dialog',inspectTab:undefined,rows:page.rows.map(row=>({...row,region:undefined,inspectPane:undefined}))},viewport,false,measure);
  const sheetWidth=tab?Math.min(tab.width,viewport.width-24):0,sheetHeight=tab?Math.max(40,Math.min(cardHeight??tab.height,available-lower)):0;
  const height=Math.max(sheetHeight+lower,gizmoHeight),width=Math.max(sheetWidth,paneWidth,gizmos.length?gizmoLeft+Math.min(gizmos.length,perRow)*(I.gizmo+I.gizmoGap)-I.gizmoGap:0);
  const sheet:NativeRect={x:0,y:height-lower-sheetHeight,width:sheetWidth,height:sheetHeight};
  const tabs:NativeRect={x:0,y:height-lower,width:paneWidth,height:I.tabHeight};
  const summary:NativeRect={x:0,y:height-I.paneHeight,width:paneWidth,height:I.paneHeight};
  const actionRect:NativeRect={x:gizmoLeft,y:height-gizmoHeight,width:Math.max(0,width-gizmoLeft),height:gizmoHeight};
  const margin=tab?.margin??NATIVE_UI.padding,header=sheet.y+margin;
  const bio=page.rows.some(row=>(row.bio||row.card)&&!row.inspectPane),contentWidth=Math.max(1,sheetWidth-margin*2-(bio?0:12));
  // The open tab's rows: the two-column flow of the generic tabs, or the card.
  const rows:NativeRowBox[]=[];let top=0,left=0,right=0,columns=false;
  for(const row of page.rows){
    if(row===tabsRow||row.inspectPane||!tab)continue;
    if(row.column!==undefined&&!columns){columns=true;left=right=top;}
    else if(row.column===undefined&&columns){columns=false;top=Math.max(left,right);}
    const ratio=page.columnRatio??.5,columnWidth=columns?(row.column===1?contentWidth*(1-ratio)-5:contentWidth*ratio-5):contentWidth;
    const x=margin+(columns&&row.column===1?contentWidth*ratio+5:0),rowTop=columns?(row.column===1?right:left):top;
    const box=rowBox(row,x,rowTop,columnWidth,measure,false);rows.push(box);
    if(columns){if(row.column===1)right+=box.height;else left+=box.height;}else top+=box.height;
  }
  const contentHeight=Math.max(top,left,right),bodyHeight=Math.max(0,sheetHeight-margin*2);
  // Tabs: 72 × 30 from the pane's right edge leftwards; declared left to right.
  const tabsBox=rowBox({...tabsRow,region:'navigation'},0,tabs.y-header,paneWidth,measure,false);
  tabsBox.controls=(tabsRow.controls??[]).map((control,index):NativeControlBox=>({control,style:'tab',x:paneWidth-I.tabWidth*(tabCount-index),y:tabs.y-header,width:I.tabWidth,height:I.tabHeight}));
  tabsBox.x=0;tabsBox.width=paneWidth;tabsBox.height=I.tabHeight;tabsBox.top=tabs.y-header;tabsBox.controlTop=0;tabsBox.controlHeight=I.tabHeight;
  // Gizmos, bottom row first; close buttons (18 with a margin of 4) at the
  // pane's and the tab window's top right corners.
  const actions:NativeControlBox[]=gizmos.map((control,index)=>{const rowIndex=Math.floor(index/perRow),column=index%perRow;
    return {control,style:'tile',x:gizmoLeft+column*(I.gizmo+I.gizmoGap),y:height-I.gizmoRowGap-I.gizmo-rowIndex*(I.gizmo+I.gizmoRowGap)-header,width:I.gizmo,height:I.gizmo};});
  const close=(control:NativeControl|undefined,rect:NativeRect)=>{if(control)actions.push({control:{...control,label:'×',hint:control.hint??'Fermer · Échap',color:control.color??'#d7ad91'},style:'button',x:rect.x+rect.width-NATIVE_WINDOW.closeMargin-NATIVE_WINDOW.close,y:rect.y+NATIVE_WINDOW.closeMargin-header,width:NATIVE_WINDOW.close,height:NATIVE_WINDOW.close});};
  close(page.actions?.find(control=>control.id==='inspect-close'),summary);
  // The (i) button of `InspectPaneUtility` (Widgets.InfoCardButton), left of the close button.
  const infoControl=page.actions?.find(control=>control.id==='inspect-info');
  if(infoControl)actions.push({control:{...infoControl,hint:infoControl.hint??'Informations'},style:'button',x:summary.x+summary.width-NATIVE_WINDOW.closeMargin*2-NATIVE_WINDOW.close*2,y:summary.y+NATIVE_WINDOW.closeMargin-header,width:NATIVE_WINDOW.close,height:NATIVE_WINDOW.close});
  if(tab)close(page.actions?.find(control=>control.id==='inspect-tab-close'),sheet);
  // Pane content: rect contracted by 12, top raised by 4: name in Medium,
  // gauges at 26 + 3, inspect lines after 18 more (Small, wrapped).
  const inner={x:I.paneInner,y:summary.y+I.paneTop,width:paneWidth-I.paneInner*2,height:I.paneHeight-I.paneInner*2+10};
  const name:NativeRect={x:inner.x,y:inner.y,width:inner.width-(NATIVE_WINDOW.close+NATIVE_WINDOW.closeMargin)*(infoControl?2:1),height:NATIVE_LINE.medium};
  const gauges:NonNullable<NativeInspectorParts['gauges']>=[],lines:NonNullable<NativeInspectorParts['lines']>=[];
  let lineTop=inner.y+26;
  for(const row of page.rows){
    if(!row.inspectPane)continue;
    if(row.gauges){lineTop=inner.y+26+3;row.gauges.forEach((gauge,index)=>gauges.push({rowId:row.id,gauge,rect:{x:inner.x+index*(I.gaugeWidth+I.gaugeGap),y:lineTop,width:I.gaugeWidth,height:I.gaugeHeight}}));lineTop+=18;continue;}
    const text=row.label&&row.value?`${row.label} : ${row.value}`:row.value??row.label;
    const inset=4,lineHeight=NATIVE_LINE.small,textWidth=inner.width-inset*2;
    const wrapped=wrapNativeText(text,textWidth,(value,size)=>measure(value,size,false),NATIVE_TEXT.small),room=Math.floor((inner.y+inner.height-lineTop)/lineHeight);
    if(room<=0)break;const shown=wrapped.slice(0,room);
    lines.push({row,rect:{x:inner.x+inset,y:lineTop,width:textWidth,height:shown.length*lineHeight},lines:shown});lineTop+=shown.length*lineHeight;
  }
  const gearCard=cardRow&&tab?.id==='gear'?cardLayoutOf(cardRow,measure):undefined,gearRegion=gearCard?.regions[0];
  const portraitRect=gearCard&&gearRegion&&page.portrait?(appliedScroll(gearRegion)>0?undefined:(rect=>({x:sheet.x+rect.x,y:sheet.y+rect.y,width:rect.width,height:rect.height}))(gearPortraitRect(gearCard))):tab?.id==='gear'&&page.portrait?{x:sheetWidth-margin-92,y:sheet.y+margin,width:92,height:128}:undefined;
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer:height-header-bodyHeight,body:{x:margin,y:header,width:contentWidth,height:bodyHeight},contentHeight,rows:[tabsBox,...rows],layout:'inspector',
    regions:{navigation:{...tabs,contentHeight:tabs.height}},actions,portraitRect,inspectorParts:{sheet,tabs,summary,actions:actionRect,name,gauges,lines}};
}
/** Animal catalogues pin their measured toolbar and headings above the list.
 * Other table layouts keep their existing geometry and scroll owners. */
function animalTablePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  if((page.id==='animals'||page.id==='wildlife')&&page.rows.some(row=>row.columns))return pawnTablePage(page,viewport,measure,page.id);
  const pad=NATIVE_UI.padding,gap=4,header=page.subtitle?76:48,bottom=NATIVE_UI.bottom+10;
  const width=Math.min(Math.max(220,Math.min(requestedWidth(page,page.id==='animals'?1640:1280),viewport.width-32)),Math.max(1,viewport.width-24));
  const contentWidth=Math.max(1,width-pad*2-12),nameWidth=Math.min(104,Math.max(1,contentWidth-1));
  const columns=Math.max(0,...page.rows.map(row=>row.columns?.length??0));
  const matrixRow=(row:NativeRow)=>!!row.columns||!!row.compact&&row.controls?.length===columns;
  const tail=page.rows.some(row=>matrixRow(row)&&!!row.value);
  const weights=page.id==='animals'?[.55,.7,.7,1.6,1.55,1,.9,.55,.7,.7]:[.7,.9,.8,1.1,.9,.75,.75];
  const intrinsicWidth=Math.max(contentWidth,page.id==='animals'?1140:1000,104+(tail?192:0)+columns*42+Math.max(0,columns-1)*6);
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:width-pad*2,height:0},measure);
  const horizontalReserve=intrinsicWidth>contentWidth?12:0;
  const footer=(page.actions?.length?actionFlow.height+pad*2:pad)+horizontalReserve;
  const maxHeight=Math.min(page.height??900,Math.max(1,viewport.height-bottom-12));
  const rows:NativeRowBox[]=[];let toolbarHeight=0;
  for(const row of page.rows.filter(row=>row.region==='navigation')){
    const box=rowBox({...row,region:'details'},pad,toolbarHeight,contentWidth,measure,false);rows.push(box);toolbarHeight+=box.height+gap;
  }
  const headingY=header+toolbarHeight;let headingHeight=0;
  for(const row of page.rows.filter(row=>!!row.columns)){
    const box=rowBox({...row,region:'catalogue'},pad,toolbarHeight+headingHeight,intrinsicWidth,measure,true,undefined,tail,weights);rows.push(box);headingHeight+=box.height;
  }
  const bodyY=headingY+headingHeight+gap;
  let contentHeight=0;
  for(const row of page.rows.filter(row=>row.region!=='navigation'&&!row.columns)){
    const matrix=matrixRow(row),x=pad+(matrix?0:nameWidth),rowWidth=matrix?intrinsicWidth:Math.max(1,contentWidth-nameWidth);
    const box=rowBox({...row,region:'catalogue'},x,bodyY-header+contentHeight,rowWidth,measure,true,undefined,matrix?tail:undefined,matrix?weights:undefined);
    if(matrix){box.height=34;box.controlTop=3;box.controlHeight=28;for(const control of box.controls)control.height=28;}
    rows.push(box);contentHeight+=box.height+gap;
  }
  const height=Math.min(maxHeight,bodyY+Math.max(28,contentHeight)+footer),bodyHeight=Math.max(0,height-footer-bodyY);
  const body={x:pad,y:bodyY,width:contentWidth,height:bodyHeight};
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body,contentHeight,rows,layout:'table',
    matrixColumnWeights:weights,tableHeader:{x:pad+nameWidth,y:headingY,width:contentWidth-nameWidth,height:headingHeight},
    regions:{details:{x:pad,y:header,width:contentWidth,height:toolbarHeight,contentHeight:toolbarHeight},
      navigation:{...body,width:nameWidth,contentHeight},
      catalogue:{...body,x:pad+nameWidth,width:contentWidth-nameWidth,contentWidth:intrinsicWidth-nameWidth,contentHeight}},
    actions:actionFlow.controls.map(control=>({...control,y:height-header-footer+horizontalReserve+pad+control.y}))};
}
/** Work, Schedule and Assign as `PawnTable` lays them out: rows of 30, the work
 * header of 50 with its label above a vertical line, 25 × 25 work boxes, column
 * widths from the worker classes (`native-pawn-table.ts`), the window as wide as
 * the optimal widths ask (up to the screen). */
function pawnTablePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure,kind:PawnTableKind):NativePageBox {
 const pad=NATIVE_UI.padding,gap=0,header=page.subtitle?76:48,bottom=NATIVE_UI.bottom+10;
 const heading=page.rows.find(row=>!!row.columns)!,labels=heading.columns!.map(column=>column.label.replace(/ [↑↓]$/,'')),tail=!!heading.value;
 const screen=Math.max(300,viewport.width-24-pad*2-12);
 const {spec,target}=pawnTableSpec(kind,labels,screen,word=>measure(word,NATIVE_TEXT.small,true),tail);
 const width=Math.min(target+pad*2+12,Math.max(1,viewport.width-24)),contentWidth=Math.max(1,width-pad*2-12),nameWidth=Math.min(spec.name,Math.max(1,contentWidth-1));
 const intrinsicWidth=Math.max(contentWidth,spec.total);
 const columns=Math.max(0,...page.rows.map(row=>row.columns?.length??0));
 const matrixRow=(row:NativeRow)=>!!row.columns||!!row.compact&&row.controls?.length===columns;
 const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:width-pad*2,height:0},measure),horizontalReserve=intrinsicWidth>contentWidth?12:0;
 const footer=(page.actions?.length?actionFlow.height+pad*2:pad)+horizontalReserve,maxHeight=Math.min(page.height??900,Math.max(1,viewport.height-bottom-12));
 const rows:NativeRowBox[]=[];let toolbarHeight=0;
 for(const row of page.rows.filter(row=>row.region==='navigation')){const box=rowBox({...row,region:'details'},pad,toolbarHeight,contentWidth,measure,false);rows.push(box);toolbarHeight+=box.height+4;}
 const headingY=header+toolbarHeight;let headingHeight=0;
 for(const row of page.rows.filter(row=>!!row.columns)){const box=rowBox({...row,region:'catalogue'},pad,toolbarHeight+headingHeight,intrinsicWidth,measure,true,undefined,tail,spec);box.height=spec.headerHeight;rows.push(box);headingHeight+=box.height;}
 const bodyY=headingY+headingHeight+gap;let contentHeight=0;
 for(const row of page.rows.filter(row=>row.region!=='navigation'&&!row.columns)){
  const matrix=matrixRow(row),x=pad+(matrix?0:nameWidth),rowWidth=matrix?intrinsicWidth:Math.max(1,contentWidth-nameWidth),top=bodyY-header+contentHeight;
  const box=rowBox({...row,region:'catalogue'},x,top,rowWidth,measure,true,undefined,matrix?tail:undefined,matrix?spec:undefined);
  if(matrix){
   box.height=PAWN_TABLE.rowHeight;box.controlTop=2;box.controlHeight=PAWN_TABLE.rowHeight-4;
   for(const control of box.controls){
    if(/^work-\d+-/.test(control.control.id)){const size=PAWN_TABLE.workBox;control.x+=(control.width-size)/2;control.width=size;control.y=top+PAWN_TABLE.workBoxTop;control.height=size;}
    else{control.y=top+2;control.height=box.controlHeight;}
   }
  }
  rows.push(box);contentHeight+=box.height;
 }
 const height=Math.min(maxHeight,bodyY+Math.max(28,contentHeight)+footer),bodyHeight=Math.max(0,height-footer-bodyY);
 const body={x:pad,y:bodyY,width:contentWidth,height:bodyHeight};
 return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body,contentHeight,rows,layout:'table',matrixSpec:spec,
  tableHeader:{x:pad+nameWidth,y:headingY,width:contentWidth-nameWidth,height:headingHeight},
  regions:{details:{x:pad,y:header,width:contentWidth,height:toolbarHeight,contentHeight:toolbarHeight},navigation:{...body,width:nameWidth,contentHeight},catalogue:{...body,x:pad+nameWidth,width:contentWidth-nameWidth,contentWidth:intrinsicWidth-nameWidth,contentHeight}},
  actions:actionFlow.controls.map(control=>({...control,y:height-header-footer+horizontalReserve+pad+control.y}))};
}
/** The opt-in profile pins the roster toolbar and headings; other tables keep
 * their own layout. Equal work cells retain skill captions at a readable size. */
function colonistTablePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
 if(page.tableProfile==='colonists'&&(page.id==='work'||page.id==='schedule'||page.id==='assign'))return pawnTablePage(page,viewport,measure,page.id);
 const pad=NATIVE_UI.padding,gap=4,header=page.subtitle?76:48,bottom=NATIVE_UI.bottom+10;
 const width=Math.min(Math.max(220,Math.min(requestedWidth(page,1480),viewport.width-32)),Math.max(1,viewport.width-24));
 const contentWidth=Math.max(1,width-pad*2-12),nameWidth=Math.min(104,Math.max(1,contentWidth-1));
 const columns=Math.max(0,...page.rows.map(row=>row.columns?.length??0));
 const matrixRow=(row:NativeRow)=>!!row.columns||!!row.compact&&row.controls?.length===columns;
 const tail=page.rows.some(row=>matrixRow(row)&&!!row.value);
 const weights=page.id==='schedule'?[...Array.from({length:24},()=>1),2.25,2.25]:page.id==='assign'?[1.6,.9,1.4,1.6,.7,.9,1.5,1.3].slice(0,columns):undefined;
 const minimum=page.id==='schedule'?1136:page.id==='work'?1180:1176;
 const intrinsicWidth=Math.max(contentWidth,minimum);
 const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:width-pad*2,height:0},measure),horizontalReserve=intrinsicWidth>contentWidth?12:0;
 const footer=(page.actions?.length?actionFlow.height+pad*2:pad)+horizontalReserve,maxHeight=Math.min(page.height??900,Math.max(1,viewport.height-bottom-12));
 const rows:NativeRowBox[]=[];let toolbarHeight=0;
 for(const row of page.rows.filter(row=>row.region==='navigation')){const box=rowBox({...row,region:'details'},pad,toolbarHeight,contentWidth,measure,false);rows.push(box);toolbarHeight+=box.height+gap;}
 const headingY=header+toolbarHeight;let headingHeight=0;
 for(const row of page.rows.filter(row=>!!row.columns)){const box=rowBox({...row,region:'catalogue'},pad,toolbarHeight+headingHeight,intrinsicWidth,measure,true,undefined,tail,weights);rows.push(box);headingHeight+=box.height;}
 const bodyY=headingY+headingHeight+gap;let contentHeight=0;
 for(const row of page.rows.filter(row=>row.region!=='navigation'&&!row.columns)){
  const matrix=matrixRow(row),x=pad+(matrix?0:nameWidth),rowWidth=matrix?intrinsicWidth:Math.max(1,contentWidth-nameWidth);
  const box=rowBox({...row,region:'catalogue'},x,bodyY-header+contentHeight,rowWidth,measure,true,undefined,matrix?tail:undefined,matrix?weights:undefined);
  if(matrix){box.height=page.id==='work'?44:34;box.controlTop=3;box.controlHeight=box.height-6;for(const control of box.controls)control.height=box.controlHeight;}
  rows.push(box);contentHeight+=box.height+gap;
 }
 const height=Math.min(maxHeight,bodyY+Math.max(28,contentHeight)+footer),bodyHeight=Math.max(0,height-footer-bodyY);
  const body={x:pad,y:bodyY,width:contentWidth,height:bodyHeight};
 return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body,contentHeight,rows,layout:'table',matrixColumnWeights:weights,
  tableHeader:{x:pad+nameWidth,y:headingY,width:contentWidth-nameWidth,height:headingHeight},
  regions:{details:{x:pad,y:header,width:contentWidth,height:toolbarHeight,contentHeight:toolbarHeight},navigation:{...body,width:nameWidth,contentHeight},catalogue:{...body,x:pad+nameWidth,width:contentWidth-nameWidth,contentWidth:intrinsicWidth-nameWidth,contentHeight}},
  actions:actionFlow.controls.map(control=>({...control,y:height-header-footer+horizontalReserve+pad+control.y}))};
}
/** Core FactionUIUtility rows. The identity band is kept fixed, including its
 * clickable type and leader, while the comparison columns scroll together. */
function factionsPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox{
  const f=NATIVE_FACTIONS,pad=NATIVE_UI.padding,header=48,bottom=NATIVE_UI.bottom+10;
  const width=Math.max(1,Math.min(f.width,viewport.width-24)),height=Math.max(1,Math.min(f.height,viewport.height-bottom-12));
  if(height<300||width<300)return layoutNativePage({...page,id:page.id,layout:'dialog',tableProfile:undefined,
    rows:page.rows.filter(row=>!row.columns).map(row=>({...row,region:undefined,factionEntry:undefined}))},viewport,false,measure);
  const contentWidth=Math.max(1,width-pad*2-12),spec=factionTableColumns(contentWidth),nameWidth=spec.name,horizontalReserve=spec.total>contentWidth?12:0;
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:width-pad*2,height:0},measure);
  const footer=(actionFlow.height?actionFlow.height+pad*2:pad)+horizontalReserve,rows:NativeRowBox[]=[];
  let used=0;
  for(const row of page.rows.filter(row=>row.region==='navigation')){
    const box=rowBox({...row,region:'details'},pad,used,contentWidth,measure,false);rows.push(box);used+=box.height+4;
  }
  const toolbarHeight=Math.min(used,Math.max(20,height-header-footer-f.headerHeight-f.rowHeight/2));
  const heading=page.rows.find(row=>row.columns)!,headingY=header+toolbarHeight;
  const head=rowBox({...heading,region:'catalogue'},pad,toolbarHeight,spec.total,measure,true,undefined,false,spec);
  head.height=f.headerHeight;rows.push(head);
  const bodyY=headingY+f.headerHeight,bodyHeight=Math.max(1,height-footer-bodyY),body={x:pad,y:bodyY,width:contentWidth,height:bodyHeight};
  let contentHeight=0;
  for(const row of page.rows.filter(row=>row.region!=='navigation'&&!row.columns)){
    const top=bodyY-header+contentHeight,display={...row,region:'catalogue' as const};
    if(!row.factionEntry){const box=rowBox(display,pad+nameWidth,top,Math.max(1,contentWidth-nameWidth),measure,false);rows.push(box);contentHeight+=box.height;continue;}
    const cells=nativeMatrixColumns(row,pad,spec.total,spec.widths.length,false,spec),controls:NativeControlBox[]=[];
    const field=(index:number,x:number,y:number,w:number,h:number,region?:NativeRegion,hitOnly=true)=>{
      const control=row.controls?.[index];if(control)controls.push({control,style:hitOnly?'button':'icon',hitOnly,region,x,y:top+y,width:w,height:h});
    };
    // The base identity includes the title and type, and a separate leader hit.
    field(0,pad,0,nameWidth,52,'navigation');
    field(2,pad,52,nameWidth,28,'navigation');
    const cell=(index:number,col:number)=>{const c=cells[col]!;field(index,c.x,0,c.width,f.rowHeight);};
    const info=cells[0]!;field(5,info.x+(info.width-24)/2,(f.rowHeight-24)/2,24,24,undefined,false);
    cell(1,2);cell(6,3);cell(7,4);cell(3,5);cell(4,6);
    rows.push({row:display,x:pad,top,width:spec.total,height:f.rowHeight,labelWidth:nameWidth,textWidth:nameWidth,matrix:true,
      controlTop:0,controlHeight:f.rowHeight,controlColumns:controls.length,controls,labelLines:[],valueLines:[],detailLines:[],inlineActions:false,matrixTail:false});
    contentHeight+=f.rowHeight;
  }
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body,contentHeight,rows,layout:'table',matrixSpec:spec,
    tableHeader:{x:pad+nameWidth,y:headingY,width:contentWidth-nameWidth,height:f.headerHeight},
    regions:{details:{x:pad,y:header,width:contentWidth,height:toolbarHeight,contentHeight:used},
      navigation:{...body,width:nameWidth,contentHeight},catalogue:{...body,x:pad+nameWidth,width:contentWidth-nameWidth,contentWidth:spec.total-nameWidth,contentHeight}},
    actions:actionFlow.controls.map(control=>({...control,y:height-header-footer+horizontalReserve+pad+control.y}))};
}
/** MainTabWindow_Menu: a right-anchored 450 × 390 paper. The 170-point
 * primary game actions stay separate from the 145-point supplementary lane.
 * The latter holds Elsewhere's extra game/help tools, not fake web links. */
function menuPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox{
 const m=NATIVE_MENU,pad=NATIVE_UI.padding,header=48,bottom=NATIVE_UI.bottom+10;
 const width=Math.max(1,Math.min(m.width,viewport.width-24)),height=Math.max(1,Math.min(m.height,viewport.height-bottom-12)),inner=Math.max(1,width-pad*2);
 const space=Math.max(0,height-header-pad),split=inner>=m.primaryWidth+m.columnGap+m.secondaryWidth+24;
 const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:inner,height:0},measure);
 const needed=actionFlow.height? actionFlow.height+8:0,overflow=needed>space/3,footer=overflow?0:needed;
 const room=Math.max(0,space-footer),body={x:pad,y:header,width:split?m.primaryWidth+12:inner,height:room};
 const regions:Partial<Record<NativeRegion,NativeRegionBox>>={navigation:{...body,contentHeight:0}};
 if(split)regions.details={x:pad+m.primaryWidth+m.columnGap,y:header,width:m.secondaryWidth+12,height:room,contentHeight:0};
 const rows:NativeRowBox[]=[];
 const items=overflow&&page.actions?.length?[...page.rows,{id:'menu-overflow-actions',label:'',region:'navigation' as const,controls:page.actions}]:page.rows;
 for(const row of [...items.filter(row=>row.region==='navigation'),...items.filter(row=>row.region!=='navigation')]){
  const key=split&&row.region!=='navigation'?'details':'navigation',region=regions[key]!,display={...row,region:key as NativeRegion},top=region.contentHeight,w=Math.max(1,region.width-12);
  const box=rowBox({...display,controls:undefined},region.x,top,w,measure,false);
  box.row=display;
  if(row.controls?.length){
   const labelHeight=row.label||row.value||row.detail?box.height+4:0;
   box.controls=row.controls.map((control,index)=>({control,style:'button',x:region.x,y:top+labelHeight+index*(m.optionHeight+m.optionGap),width:w,height:m.optionHeight}));
   box.height=labelHeight+row.controls.length*(m.optionHeight+m.optionGap)-m.optionGap;box.controlTop=labelHeight;box.controlHeight=m.optionHeight;box.controlColumns=1;
  }
  rows.push(box);region.contentHeight=top+box.height+m.optionGap;
 }
 const actions=overflow?[]:actionFlow.controls.map(control=>({...control,x:Math.floor((width-control.width)/2),y:height-pad-footer-header+4+control.y}));
 return {x:Math.max(0,viewport.width-width-12),y:viewport.height-bottom-height,width,height,header,footer:pad+footer,body,contentHeight:regions.navigation!.contentHeight,rows,regions,actions,layout:'menu'};
}
/** World navigation is independent from the long catalogue and the globe. */
function worldPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const pad=NATIVE_UI.padding,gap=10,header=page.subtitle?76:48,bottom=NATIVE_UI.bottom+10;
  const width=Math.min(Math.max(220,Math.min(requestedWidth(page,1120),viewport.width-32)),Math.max(1,viewport.width-24));
  const innerWidth=Math.max(1,width-pad*2-12),wide=width>=850,visualWidth=page.visual&&wide?nativeVisualWidth(page,width):0;
  const maximumHeight=Math.min(page.height??740,Math.max(1,viewport.height-bottom-12));
  const rows:NativeRowBox[]=[];let navigationHeight=0,contentHeight=0;
  for(const row of page.rows.filter(row=>row.region==='navigation')){
    const box=rowBox(row,pad,navigationHeight,innerWidth,measure,false);rows.push(box);navigationHeight+=box.height+3;
  }
  if(navigationHeight)navigationHeight-=3;
  const contentX=pad+(visualWidth?visualWidth+gap:0),contentWidth=Math.max(1,innerWidth-(visualWidth?visualWidth+gap:0));
  const contentRows:NativeRowBox[]=[];
  for(const row of page.rows.filter(row=>row.region!=='navigation')){
    const box=rowBox({...row,region:'catalogue'},contentX,contentHeight,Math.max(1,contentWidth-12),measure,false);contentRows.push(box);contentHeight+=box.height+3;
  }
  if(contentHeight)contentHeight-=3;
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:innerWidth,height:0},measure);
  const footer=page.actions?.length?actionFlow.height+pad*2:pad;
  const navigationContentHeight=navigationHeight;
  navigationHeight=Math.min(navigationHeight,Math.max(0,maximumHeight-header-footer-40-(navigationHeight?gap:0)));
  const contentTop=header+navigationHeight+(navigationHeight?gap:0);
  const usefulHeight=page.visual?(wide?Math.max(320,contentHeight):180+gap+Math.max(28,contentHeight)):Math.max(28,contentHeight);
  const height=Math.min(maximumHeight,contentTop+usefulHeight+footer),space=Math.max(0,height-footer-contentTop);
  let bodyY=contentTop,bodyHeight=space,visualRect:NativeRect|undefined;
  if(page.visual){
    if(wide)visualRect={x:pad,y:contentTop,width:visualWidth,height:space};
    else{
      const splitGap=space>12?gap:0,globeHeight=Math.min(180,Math.max(0,(space-splitGap)*.42));
      visualRect={x:pad,y:contentTop,width:innerWidth,height:globeHeight};bodyY+=globeHeight+splitGap;bodyHeight=Math.max(0,space-globeHeight-splitGap);
    }
  }
  const body={x:contentX,y:bodyY,width:contentWidth,height:bodyHeight};
  for(const box of contentRows){const delta=bodyY-header;box.top+=delta;for(const control of box.controls)control.y+=delta;rows.push(box);}
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={
    navigation:{x:pad,y:header,width:innerWidth,height:navigationHeight,contentHeight:navigationContentHeight},
    catalogue:{...body,contentHeight},
  };
  const actions=actionFlow.controls.map(control=>({...control,y:height-header-footer+pad+control.y}));
  return{x:12,y:viewport.height-bottom-height,width,height,header,footer,body,contentHeight,rows,layout:'world',regions,actions,visualRect};
}

/** MainMenuDrawer's two lanes. The actual game actions stay in the 170-point
 * lane; a supplementary local action can use the 145-point one. */
function homePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const m=NATIVE_HOME,width=Math.max(1,Math.min(m.width,viewport.width-24)),height=Math.max(1,Math.min(m.height,viewport.height-24));
  const pad=Math.min(NATIVE_UI.padding,width/4,height/4),inner=Math.max(1,width-pad*2),header=Math.min(page.subtitle?76:48,height/2),footer=pad;
  const rows:NativeRowBox[]=[],regions:Partial<Record<NativeRegion,NativeRegionBox>>={};
  let noticeNeed=0;
  for(const row of page.rows.filter(row=>row.region==='navigation')){const box=rowBox(row,pad,noticeNeed,Math.max(1,inner-NATIVE_WINDOW.scrollbar),measure,false);rows.push(box);noticeNeed+=box.height+m.buttonGap;}
  const space=Math.max(0,height-header-footer),noticeHeight=Math.min(noticeNeed,space/3),noticeGap=noticeHeight?Math.min(m.buttonGap,space-noticeHeight):0;
  if(noticeNeed)regions.navigation={x:pad,y:header,width:Math.max(1,inner-NATIVE_WINDOW.scrollbar),height:noticeHeight,contentHeight:noticeNeed};
  const top=header+noticeHeight+noticeGap,room=Math.max(0,space-noticeHeight-noticeGap),split=inner>=m.gameWidth+m.columnGap+m.extraWidth;
  const catalogue:NativeRegionBox={x:pad,y:top,width:split?m.gameWidth:Math.min(m.gameWidth,inner),height:room,contentHeight:0};
  regions.catalogue=catalogue;
  if(split&&page.rows.some(row=>row.region==='details'))regions.details={x:pad+m.gameWidth+m.columnGap,y:top,width:m.extraWidth,height:room,contentHeight:0};
  for(const source of page.rows.filter(row=>row.region!=='navigation')){
    const key=source.region==='details'&&regions.details?'details':'catalogue',region=regions[key]!,row={...source,region:key as NativeRegion},rowTop=region.y-header+region.contentHeight;
    const box=rowBox(row,region.x,rowTop,region.width,measure,false);
    if(row.controls?.length){const h=Math.max(1,Math.min(m.buttonHeight,room));box.controls=row.controls.map((control,index)=>({control,style:'button',x:region.x,y:rowTop+index*(h+m.buttonGap),height:h,width:region.width}));box.controlTop=0;box.controlHeight=h;box.controlColumns=1;box.height=row.controls.length*(h+m.buttonGap)-m.buttonGap;}
    rows.push(box);region.contentHeight+=box.height+m.buttonGap;
  }
  for(const region of [catalogue,regions.details])if(region&&region.contentHeight)region.contentHeight-=m.buttonGap;
  // The user's previous illustrated backdrop and right-hand menu placement
  // are retained; the reference's vertical offset and dimensions are used.
  return{x:page.setupAnchor==='right'?Math.max(0,viewport.width-width-24):(viewport.width-width)/2,y:Math.max(0,Math.min(viewport.height-height,(viewport.height-height)/2+m.offsetY)),width,height,header,footer,body:catalogue,contentHeight:catalogue.contentHeight,rows,layout:'home',regions,actions:[]};
}

/** Dialog_FileList: compact, actual saved records with an explicit action on
 * each row. Elsewhere's search, import tools and selected metadata are kept
 * in independent lanes instead of moving the real load action off screen. */
function filesPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const m=NATIVE_FILE_LIST,width=Math.max(1,Math.min(m.width,viewport.width-24)),height=Math.max(1,Math.min(m.height,viewport.height-24));
  const pad=Math.min(NATIVE_UI.padding,width/4,height/4),inner=Math.max(1,width-pad*2),usable=Math.max(1,inner-NATIVE_WINDOW.scrollbar);
  const buttonHeight=Math.min(m.actionHeight,height/4),footer=pad+buttonHeight+8,header=Math.min(page.subtitle?76:48,Math.max(0,height-footer-1));
  const rows:NativeRowBox[]=[],regions:Partial<Record<NativeRegion,NativeRegionBox>>={},space=Math.max(0,height-header-footer),gap=8;
  const actions=page.actions??[],first=actions[0],last=actions.length>1?actions.at(-1):undefined,extras=actions.slice(1,-1);
  // The managed-save form owns the Core name field + create button below
  // the records, independently of selection and list scroll.
  const toolbar:NativeRowBox[]=[];let toolbarNeed=0;
  for(const row of page.rows.filter(row=>row.region==='toolbar')){
    const box=rowBox(row,pad,toolbarNeed,usable,measure,false);
    if(row.input&&row.controls?.length===1){
      const h=Math.max(1,Math.min(m.nameFieldHeight,space*.3)),fieldGap=Math.min(m.nameFieldGap,usable*.08),fieldWidth=Math.max(1,Math.min(m.nameFieldWidth,usable-fieldGap-Math.min(120,usable*.35)));
      box.height=h;box.labelLines=[];box.detailLines=[];box.valueLines=[];box.labelWidth=0;box.controlTop=0;box.controlHeight=h;
      box.inputRect={x:pad,y:toolbarNeed,width:fieldWidth,height:h};box.controls=[{control:row.controls[0]!,style:'button',x:pad+fieldWidth+fieldGap,y:toolbarNeed,width:Math.max(1,usable-fieldWidth-fieldGap),height:h}];
    }
    toolbar.push(box);toolbarNeed+=box.height+4;
  }
  const toolbarHeight=Math.min(Math.max(0,toolbarNeed-4),space*.3),toolbarGap=toolbarHeight?Math.min(gap,space*.08):0,bodySpace=Math.max(0,space-toolbarHeight-toolbarGap);
  let navigationNeed=0;
  const navigation=[...page.rows.filter(row=>row.region==='navigation'),...(extras.length?[{id:'file-list-tools',label:'',region:'navigation' as const,controlStyle:'button' as const,controls:extras}]:[])];
  for(const row of navigation){const box=rowBox(row,pad,navigationNeed,usable,measure,false);rows.push(box);navigationNeed+=box.height+4;}
  if(navigationNeed)navigationNeed-=4;
  const navigationHeight=Math.min(navigationNeed,Math.max(0,bodySpace*.4));
  if(navigationNeed)regions.navigation={x:pad,y:header,width:usable,height:navigationHeight,contentHeight:navigationNeed};
  const bodyTop=header+navigationHeight+(navigationHeight?Math.min(gap,bodySpace*.1):0),available=Math.max(0,header+bodySpace-bodyTop);
  const detailRows=page.rows.filter(row=>row.region==='details');let detailNeed=0;
  const details=detailRows.map(row=>{const box=rowBox(row,pad,detailNeed,usable,measure,false);detailNeed+=box.height+4;return box;});
  const detailsHeight=Math.min(156,Math.max(0,detailNeed-4),available*.36),detailsGap=detailsHeight?Math.min(gap,available*.1):0;
  const catalogue:NativeRegionBox={x:pad,y:bodyTop,width:usable,height:Math.max(0,available-detailsHeight-detailsGap),contentHeight:0};regions.catalogue=catalogue;
  if(details.length)regions.details={x:pad,y:bodyTop+catalogue.height+detailsGap,width:usable,height:detailsHeight,contentHeight:Math.max(0,detailNeed-4)};
  let listNeed=0;
  for(const source of page.rows.filter(row=>row.region!=='navigation'&&row.region!=='details'&&row.region!=='toolbar')){
    const row={...source,region:'catalogue' as const},top=bodyTop-header+listNeed;
    if(row.fileEntry&&row.controls?.length===2){const c=nativeFileColumns(usable,row.fileEntry.manage),h=Math.max(1,Math.min(m.actionHeight,m.rowHeight,catalogue.height)),y=top+(m.rowHeight-h)/2;
      const controls:NativeControlBox[]=row.fileEntry.manage?[
        {control:row.controls[0]!,style:'button',x:pad+c.actionX,y,width:c.action,height:h},{control:row.controls[1]!,style:'icon',x:pad+c.manageX,y,width:c.manage,height:h},
      ]:[
        {control:row.controls[0]!,style:'history-row',x:pad+c.inset,y,width:c.name,height:h},{control:row.controls[1]!,style:'button',x:pad+c.actionX,y,width:c.action,height:h},
      ];rows.push({row,x:pad,top,width:usable,height:m.rowHeight,labelWidth:c.name,textWidth:c.name,inlineActions:true,controlTop:y-top,controlHeight:h,controlColumns:2,labelLines:[],valueLines:[],detailLines:[],matrix:false,controls});listNeed+=m.rowHeight;
    }else{const box=rowBox(row,pad,top,usable,measure,false);rows.push(box);listNeed+=box.height+4;}
  }
  catalogue.contentHeight=listNeed;
  if(regions.details)for(const box of details){const delta=regions.details.y-header;box.top+=delta;for(const control of box.controls)control.y+=delta;if(box.inputRect)box.inputRect.y+=delta;rows.push(box);}
  if(toolbar.length){regions.toolbar={x:pad,y:height-footer-toolbarHeight,width:usable,height:toolbarHeight,contentHeight:Math.max(0,toolbarNeed-4)};
    for(const box of toolbar){const delta=regions.toolbar.y-header;box.top+=delta;for(const control of box.controls)control.y+=delta;if(box.inputRect)box.inputRect.y+=delta;rows.push(box);}}
  const actionWidth=Math.min(m.actionWidth,Math.max(1,inner/(last?2:1)-4)),y=height-pad-buttonHeight-header;
  const footerActions:NativeControlBox[]=[];if(first)footerActions.push({control:first,style:'button',x:pad,y,width:actionWidth,height:buttonHeight});
  if(last)footerActions.push({control:last,style:'button',x:width-pad-actionWidth,y,width:actionWidth,height:buttonHeight});
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body:catalogue,contentHeight:listNeed,rows,layout:'files',regions,actions:footerActions};
}

/** One physical stock record per row. Neither the numeric editor nor the
 * note about refusal is permitted to acquire a neighbour's controls. */
function tradeRowBox(row:NativeRow,x:number,top:number,width:number,visibleHeight:number):NativeRowBox {
  const m=NATIVE_TRADE,c=nativeTradeColumns(width),height=c.compact?m.compactRowHeight:m.rowHeight;
  const h=Math.max(1,Math.min(26,visibleHeight)),gap=Math.min(6,c.adjust*.045),button=Math.max(1,Math.min(26,(c.adjust-gap*2)*.24));
  const fieldWidth=Math.max(1,Math.min(100,c.adjust-2*button-2*gap)),left=x+c.adjustX+(c.adjust-(2*button+2*gap+fieldWidth))/2,y=top+height-h-2;
  const controls:NativeControlBox[]=(row.controls??[]).map((control,index)=>({control,style:'button',x:index===0?left:left+button+2*gap+fieldWidth,y,width:button,height:h}));
  return{row,x,top,width,height,labelWidth:c.name,textWidth:c.name,controlTop:y-top,controlHeight:h,controlColumns:controls.length,labelLines:[],valueLines:[],detailLines:[],matrix:false,inlineActions:true,controls,
    ...(row.input?{inputRect:{x:left+button+gap,y,width:fieldWidth,height:h}}:{})};
}

/** Search and its actual native select controls share the wide toolbar. On
 * a small sheet the input is on its own line, not under a 26-point button. */
function tradeSearchBox(row:NativeRow,x:number,top:number,width:number,measure:TextMeasure):NativeRowBox {
  const box=rowBox(row,x,top,width,measure,false),count=row.controls?.length??0,stack=width<500,gap=Math.min(8,width*.025),height=32;
  const actionWidth=Math.max(1,Math.min(164,(width-(stack?0:Math.min(270,width*.46))-gap*(count+(stack?-1:0)))/Math.max(1,count))),actionsWidth=count*actionWidth+Math.max(0,count-1)*gap;
  const fieldWidth=stack?width:Math.max(1,width-actionsWidth-gap),left=stack?x:x+fieldWidth+gap;
  box.height=height+(stack?height+gap:0);box.controlHeight=height;box.controlTop=stack?height+gap:0;box.labelLines=[];box.detailLines=[];box.valueLines=[];box.labelWidth=0;
  box.inputRect={x,y:top,width:fieldWidth,height};box.controls=(row.controls??[]).map((control,index)=>({control,style:'button',x:left+index*(actionWidth+gap),y:top+box.controlTop,width:actionWidth,height}));
  return box;
}

/** Dialog_Trade's fixed stock headings and three bottom actions. The richer
 * Elsewhere-specific contact and cash-shortfall facts are independent regions
 * so neither a large inventory nor a small viewport conceals the quote. */
function tradePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const m=NATIVE_TRADE,width=Math.max(1,Math.min(m.width,viewport.width-24)),height=Math.max(1,Math.min(page.height??viewport.height,viewport.height-24));
  const pad=Math.min(NATIVE_UI.padding,width/4,height/4),inner=Math.max(1,width-2*pad),usable=Math.max(1,inner-NATIVE_WINDOW.scrollbar),buttonHeight=Math.min(m.footerHeight,height/4),footer=pad+buttonHeight+8,header=Math.min(m.titleHeight,Math.max(0,height-footer-1));
  const rows:NativeRowBox[]=[],regions:Partial<Record<NativeRegion,NativeRegionBox>>={},space=Math.max(0,height-header-footer),gap=Math.min(6,space*.04);
  const navigation:NativeRowBox[]=[],details:NativeRowBox[]=[];let navigationNeed=0,detailNeed=0;
  for(const row of page.rows){
    if(row.region==='navigation'){const box=row.input&&row.controls?.length?tradeSearchBox(row,pad,navigationNeed,usable,measure):rowBox(row,pad,navigationNeed,usable,measure,false);navigation.push(box);navigationNeed+=box.height+4;}
    if(row.region==='details'){const box=rowBox(row,pad,detailNeed,usable,measure,false);details.push(box);detailNeed+=box.height+4;}
  }
  navigationNeed=Math.max(0,navigationNeed-4);detailNeed=Math.max(0,detailNeed-4);
  const hasHeading=page.rows.some(row=>row.tradeHeading),headingHeight=hasHeading?Math.min(m.headingHeight,space*.19):0;
  const available=Math.max(0,space-headingHeight-(navigationNeed?gap:0)-(detailNeed?gap:0)),navigationHeight=Math.min(navigationNeed,available*.37),detailHeight=Math.min(detailNeed,available*.30);
  if(navigation.length){regions.navigation={x:pad,y:header,width:usable,height:navigationHeight,contentHeight:navigationNeed};rows.push(...navigation);}
  const headingTop=header+navigationHeight+(navigationNeed?gap:0),bodyTop=headingTop+headingHeight,bodyHeight=Math.max(0,available-navigationHeight-detailHeight);
  if(hasHeading){regions.toolbar={x:pad,y:headingTop,width:usable,height:headingHeight,contentHeight:headingHeight};}
  const catalogue:NativeRegionBox={x:pad,y:bodyTop,width:usable,height:bodyHeight,contentHeight:0};regions.catalogue=catalogue;
  let listNeed=0;
  for(const source of page.rows){
    if(source.tradeHeading){const row={...source,region:'toolbar' as const};rows.push({row,x:pad,top:headingTop-header,width:usable,height:headingHeight,labelWidth:0,textWidth:usable,inlineActions:false,controlTop:0,controlHeight:0,controlColumns:0,labelLines:[],valueLines:[],detailLines:[],matrix:false,controls:[]});continue;}
    if(source.region==='navigation'||source.region==='details')continue;
    const row={...source,region:'catalogue' as const},top=bodyTop-header+listNeed;
    const box=row.tradeEntry?tradeRowBox(row,pad,top,usable,catalogue.height):rowBox(row,pad,top,usable,measure,false);rows.push(box);listNeed+=box.height+(row.tradeEntry?0:4);
  }
  catalogue.contentHeight=listNeed;
  if(details.length){regions.details={x:pad,y:bodyTop+bodyHeight+gap,width:usable,height:detailHeight,contentHeight:detailNeed};
    for(const box of details){const delta=regions.details.y-header;box.top+=delta;for(const control of box.controls)control.y+=delta;if(box.inputRect)box.inputRect.y+=delta;rows.push(box);}}
  const controls=page.actions??[],count=controls.length,buttonGap=Math.min(m.footerGap,inner/(Math.max(1,count)*12)),buttonWidth=Math.max(1,Math.min(m.footerWidth,(inner-buttonGap*Math.max(0,count-1))/Math.max(1,count))),totalWidth=count*buttonWidth+Math.max(0,count-1)*buttonGap;
  const actions=controls.map((control,index):NativeControlBox=>({control,style:control.presentation??'button',x:pad+(inner-totalWidth)/2+index*(buttonWidth+buttonGap),y:height-pad-buttonHeight-header,width:buttonWidth,height:buttonHeight}));
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body:catalogue,contentHeight:listNeed,rows,layout:'trade',regions,actions};
}

/** Core Dialog_InfoCard: a 950 × 760 window with independently scrollable
 * statistics and explanation. In a narrow viewport they stack; fixed Bio
 * and Health cards can be panned without changing the common text scale. */
function infoPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  cardMemo=new Map();
  const m=NATIVE_INFO,width=Math.max(1,Math.min(m.width,viewport.width-24)),height=Math.max(1,Math.min(m.height,viewport.height-24));
  const pad=Math.min(m.margin,width/8,height/8),inset=Math.min(m.cardInset,width/12,height/12),left=pad+inset,inner=Math.max(1,width-2*left);
  const tabs=page.rows.find(row=>row.id==='info-tabs'),search=page.rows.find(row=>row.id==='info-search'),buttonHeight=Math.min(m.closeHeight,height/5);
  const footer=Math.min(pad*2+m.footerReserve,height*.30),header=Math.min(pad+m.titleHeight+inset+18+(tabs?m.tabBand:0),Math.max(1,(height-footer)*.46));
  const bodyHeight=Math.max(1,height-header-footer),tabHeight=tabs?Math.min(m.tabHeight,header*.36):0,tabY=header-Math.min(m.tabBand,tabHeight+8);
  const iconSize=Math.min(m.iconSize,Math.max(1,(tabs?tabY:header)-pad-4)),iconX=pad+Math.min(m.iconOffset,pad/2),titleX=pad+iconSize+Math.min(18,pad);
  const infoParts={title:{x:titleX,y:pad,width:Math.max(1,width-titleX-pad-20),height:iconSize},icon:{x:iconX,y:pad,width:iconSize,height:iconSize}};
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={},rows:NativeRowBox[]=[];
  if(tabs){
    const y=tabY,controls=tabs.controls??[],gap=Math.min(4,inner/24),cell=Math.max(1,Math.min(200,(inner-gap*Math.max(0,controls.length-1))/Math.max(1,controls.length)));
    const item=rowBox(tabs,left,y-header,inner,measure,false);item.height=tabHeight;item.controls=controls.map((control,index)=>({control,style:'tab',x:left+index*(cell+gap),y:y-header,width:cell,height:tabHeight}));
    regions.navigation={x:left,y,width:inner,height:tabHeight,contentHeight:tabHeight};rows.push(item);
  }
  const stats=page.infoCard?.section!=='bio'&&page.infoCard?.section!=='health',stack=inner<m.compactBelow,detailInset=Math.min(m.detailInset,inner/16,bodyHeight/14),bar=Math.min(NATIVE_WINDOW.scrollbar,inner/12);
  if(stats){
    const half=inner/2,upper=stack?bodyHeight*.54:bodyHeight,regionWidth=stack?inner:half;
    const catalogue:NativeRegionBox={x:left,y:header,width:Math.max(1,regionWidth-bar),height:Math.max(1,upper),contentHeight:0};regions.catalogue=catalogue;
    const details:NativeRegionBox={x:(stack?left:left+half)+detailInset,y:(stack?header+upper:header)+detailInset,width:Math.max(1,regionWidth-detailInset*2-bar),height:Math.max(1,(stack?bodyHeight-upper:bodyHeight)-detailInset*2),contentHeight:0};regions.details=details;
    let top=0;
    for(const row of page.rows.filter(row=>row.region==='catalogue')){
      const indent=row.infoEntry?Math.min(m.rowInset,catalogue.width/12):0,x=catalogue.x+indent,w=Math.max(1,catalogue.width-indent);
      if(row.infoEntry){
        const labelWidth=w*(1-m.valueFraction),labelLines=infoWrap(row.label,Math.max(1,labelWidth-8),measure),valueLines=row.value?infoWrap(row.value,Math.max(1,w-labelWidth-8),measure):[],h=Math.max(1,labelLines.length,valueLines.length)*NATIVE_LINE.small;
        const controls:NativeControlBox[]=(row.controls??[]).map(control=>({control,style:'button',x,y:top,width:w,height:h,hitOnly:true}));
        rows.push({row,x,top,width:w,height:h,labelWidth,controlTop:0,controlHeight:h,controlColumns:controls.length,detailLines:[],labelLines,valueLines,textWidth:w,inlineActions:true,matrix:false,controls});top+=h;
      }else if(row.infoHeading){
        const labelLines=infoWrap(row.label,w,measure),h=Math.max(m.categoryHeight,labelLines.length*NATIVE_LINE.small+3);
        rows.push({row,x,top,width:w,height:h,labelWidth:w,controlTop:0,controlHeight:0,controlColumns:0,detailLines:[],labelLines,valueLines:[],textWidth:w,inlineActions:false,matrix:false,controls:[]});top+=h;
      }else{const item=rowBox(row,x,top,w,measure,false);rows.push(item);top+=item.height;}
    }
    catalogue.contentHeight=top;
  }else regions.details={x:left,y:header,width:Math.max(1,inner-bar),height:Math.max(1,bodyHeight-10),contentHeight:0};
  const details=regions.details!;let detailTop=0,detailWidth=details.width;
  for(const row of page.rows.filter(row=>row.region==='details')){
    const fixed=row.bio?NATIVE_BIO_SIZE.width:row.card?cardLayoutOf(row,measure).width:0;
    const rowWidth=Math.max(details.width,fixed),x=details.x+Math.max(0,(details.width-fixed)/2)*(fixed?1:0),top=details.y-header+detailTop,item=rowBox(row,x,top,rowWidth,measure,false);
    if(!fixed&&!row.controls?.length&&!row.meter){
      item.labelLines=infoWrap(row.label,Math.max(1,row.value?Math.min(item.labelWidth,rowWidth*.40):rowWidth-2),measure);
      item.valueLines=row.value?infoWrap(row.value,Math.max(1,rowWidth-item.labelWidth-8),measure):[];
      item.height=Math.max(row.emphasis==='heading'?34:28,Math.max(item.labelLines.length,item.valueLines.length)*NATIVE_LINE.small+8);
    }
    detailWidth=Math.max(detailWidth,item.width);detailTop+=item.height+4;rows.push(item);
  }
  details.contentHeight=Math.max(0,detailTop-4);if(detailWidth>details.width)details.contentWidth=detailWidth;
  const closeWidth=Math.min(m.closeWidth,Math.max(1,(width-2*pad)*.38)),buttonY=height-pad-buttonHeight;
  const closeX=search&&width<620?width-pad-closeWidth:(width-closeWidth)/2;
  const actions=(page.actions??[]).map((control):NativeControlBox=>({control,style:'button',x:closeX,y:buttonY-header,width:closeWidth,height:buttonHeight}));
  if(search){
    const w=Math.max(1,Math.min(m.searchWidth,closeX-pad-8)),h=Math.min(m.searchHeight,buttonHeight),y=buttonY+(buttonHeight-h)/2,box=rowBox(search,pad,y-header,w,measure,false);
    const clear=search.controls?.[0],clearWidth=clear?Math.min(h,w*.24):0,gap=clear?Math.min(4,w*.04):0;
    box.height=h;box.labelLines=[];box.valueLines=[];box.inputRect={x:pad,y:y-header,width:Math.max(1,w-clearWidth-gap),height:h};
    box.controls=clear?[{control:clear,style:'icon',x:pad+w-clearWidth,y:y-header,width:clearWidth,height:h}]:[];
    regions.toolbar={x:pad,y,width:w,height:h,contentHeight:h};rows.push(box);
  }
  const body=regions.catalogue??details;
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body,contentHeight:body.contentHeight,rows,layout:'info',regions,actions,infoParts};
}

/** Core Page.DoBottomButtons. The full-screen site page centres its choices;
 * the ordinary Page keeps Back and Next at opposite edges. */
function creationActions(controls:readonly NativeControl[],innerWidth:number,pad:number,site:boolean):{controls:NativeControlBox[];height:number}{
  const m=NATIVE_CREATION;if(!controls.length)return{controls:[],height:0};
  const gap=Math.min(10,innerWidth/24),columns=innerWidth>=controls.length*(m.buttonWidth+gap)-gap?controls.length:Math.min(controls.length,Math.max(2,Math.floor((innerWidth+gap)/117)));
  const width=Math.max(1,Math.min(m.buttonWidth,(innerWidth-gap*(columns-1))/columns)),rows=Math.ceil(controls.length/columns);
  const boxes=controls.map((control,index):NativeControlBox=>{
    const line=Math.floor(index/columns),col=index%columns,n=Math.min(columns,controls.length-line*columns),total=n*width+(n-1)*gap;
    let x=pad+(innerWidth-total)/2+col*(width+gap);
    if(!site&&rows===1&&n>1)x=pad+col*(innerWidth-width)/(n-1);
    return{control,style:control.presentation??'button',x,y:line*(m.buttonHeight+gap),width,height:m.buttonHeight};
  });
  return{controls:boxes,height:rows*m.buttonHeight+(rows-1)*gap};
}

/** Page_SelectStartingSite has no fixed 1020-point sheet. Keep the globe in
 * the full screen with a separate dossier and the Core four-button footer.
 * On short screens the selectors and facts share one scrolled dossier. */
function startingSitePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox{
  const m=NATIVE_CREATION,width=Math.max(1,viewport.width-24),height=Math.max(1,viewport.height-24),pad=Math.min(NATIVE_UI.padding,width/4,height/4);
  const innerWidth=Math.max(1,width-pad*2),flow=creationActions(page.actions??[],innerWidth,pad,true),footer=pad+m.footerGap+flow.height;
  const header=Math.min(pad+m.titleHeight,Math.max(0,height-footer-12)),room=Math.max(0,height-header-footer),gap=Math.min(m.columnGap,room*.12);
  const wide=width>=850,visualWidth=wide?Math.min(innerWidth-280-gap,Math.floor(innerWidth*.64)):innerWidth;
  const visualHeight=wide?room:Math.max(0,(room-gap)*.58);
  const visualRect={x:pad,y:header,width:Math.max(1,visualWidth),height:visualHeight};
  const details:NativeRegionBox=wide?{x:pad+visualWidth+gap,y:header,width:Math.max(1,innerWidth-visualWidth-gap),height:room,contentHeight:0}:
    {x:pad,y:header+visualHeight+gap,width:innerWidth,height:Math.max(0,room-visualHeight-gap),contentHeight:0};
  const rows:NativeRowBox[]=[];let top=0;
  for(const source of page.rows){const row={...source,region:'details' as const},box=rowBox(row,details.x,details.y-header+top,Math.max(1,details.width-NATIVE_WINDOW.scrollbar),measure,false);rows.push(box);top+=box.height+3;}
  details.contentHeight=Math.max(0,top-3);
  const actions=flow.controls.map(control=>({...control,y:height-pad-flow.height-header+control.y}));
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body:details,contentHeight:details.contentHeight,rows,layout:'setup',regions:{graph:{...visualRect,contentHeight:0},details},actions,visualRect};
}

/** Pregame choices and their dossier share one opt-in regional layout.
 * No screen IDs, commands, generation state or simulation owners are inferred. */
function setupPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const profile=page.setupProfile,core=!!profile,m=NATIVE_CREATION;
  if(profile==='site'&&page.visual)return startingSitePage(page,viewport,measure);
  const pad=NATIVE_UI.padding,gap=profile==='story'?8:core?m.columnGap:10;
  const width=core?Math.max(1,Math.min(m.width,viewport.width-24)):Math.min(Math.max(220,Math.min(requestedWidth(page,1160),viewport.width-32)),Math.max(1,viewport.width-24));
  const innerWidth=Math.max(1,width-pad*2-(core?0:12)),maximumHeight=Math.max(1,Math.min(page.height??760,viewport.height-24));
  const actionFlow=core?creationActions(page.actions??[],innerWidth,pad,false):flowNativeControls(page.actions??[],{x:pad,y:0,width:innerWidth,height:0},measure);
  const footer=page.actions?.length?actionFlow.height+pad+(core?m.footerGap:pad):pad;
  const header=core?Math.min(pad+m.titleHeight,Math.max(0,maximumHeight-footer-24)):page.subtitle?76:48;
  // Very short screens cannot dedicate a zero-height ribbon to notices.
  // Move those same rows into the scrollable list/dossier, without losing them.
  const collapseNavigation=core&&maximumHeight-header-footer<120;
  const navTarget=page.rows.some(row=>row.region==='catalogue')?'catalogue':'details';
  const sourceRows=collapseNavigation?page.rows.map(row=>row.region==='navigation'?{...row,region:navTarget as NativeRegion}:row):page.rows;
  const has=(key:NativeRegion)=>sourceRows.some(row=>(row.region??'details')===key);
  const catalogue=has('catalogue'),details=has('details')||!!page.portrait,summary=!page.visual&&has('graph');
  const wide=width>=(page.visual?900:profile==='pawns'?490:760),rail=profile==='scenario'?Math.round(innerWidth*m.scenarioFraction):profile==='world'?Math.floor((innerWidth-gap)/2):Math.min(page.setupCatalogueWidth??240,innerWidth*.44);
  const navigationRows:NativeRowBox[]=[];let navigationNeed=0;
  for(const row of sourceRows.filter(row=>row.region==='navigation')){
    const box=rowBox(row,pad,navigationNeed,innerWidth,measure,false);navigationRows.push(box);navigationNeed+=box.height+3;
  }
  if(navigationNeed)navigationNeed-=3;
  const navigationHeight=Math.min(navigationNeed,Math.max(0,maximumHeight-header-footer-60));
  const bodyTop=header+navigationHeight+(navigationHeight?gap:0),maximumBody=Math.max(0,maximumHeight-footer-bodyTop);

  function geometry(space:number,needs:Partial<Record<NativeRegion,number>>={}){
    const regions:Partial<Record<NativeRegion,NativeRegionBox>>={};
    if(navigationNeed)regions.navigation={x:pad,y:header,width:innerWidth,height:navigationHeight,contentHeight:navigationNeed};
    let area:NativeRect={x:pad,y:bodyTop,width:innerWidth,height:space},visualRect:NativeRect|undefined;
    if(page.visual){
      if(wide){const ratio=Number.isFinite(page.columnRatio)?Math.max(.35,Math.min(.7,page.columnRatio!)):.54,globeWidth=Math.max(1,innerWidth*ratio);visualRect={...area,width:globeWidth};area={x:pad+globeWidth+gap,y:bodyTop,width:Math.max(1,innerWidth-globeWidth-gap),height:space};}
      else{const visualHeight=Math.min(220,Math.max(0,(space-gap)*.38));visualRect={...area,height:visualHeight};area={x:pad,y:bodyTop+visualHeight+(visualHeight?gap:0),width:innerWidth,height:Math.max(0,space-visualHeight-(visualHeight?gap:0))};}
      regions.graph={...visualRect,contentHeight:0};
    }
    const hasDossier=details||summary;
    if(catalogue&&hasDossier){
      if(wide&&!page.visual){regions.catalogue={...area,width:rail,contentHeight:0};area={...area,x:area.x+rail+gap,width:Math.max(1,area.width-rail-gap)};}
      else{
        const catalogueNeed=needs.catalogue??180,dossierNeed=(needs.details??180)+(summary?127:0);
        const splitGap=core?Math.min(gap,area.height*.12):gap,available=Math.max(0,area.height-splitGap),share=catalogueNeed/Math.max(1,catalogueNeed+dossierNeed);
        const catalogueHeight=Math.min(available*.56,Math.max(Math.min(76,available*.3),available*share));
        regions.catalogue={...area,height:catalogueHeight,contentHeight:0};area={...area,y:area.y+catalogueHeight+splitGap,height:Math.max(0,available-catalogueHeight)};
      }
    }else if(catalogue){regions.catalogue={...area,contentHeight:0};}
    if(summary){
      const summaryGap=core?Math.min(gap,area.height*.12):gap,summaryHeight=Math.min(m.summaryHeight,Math.max(0,(area.height-summaryGap)*.42));
      regions.graph={x:area.x,y:area.y+area.height-summaryHeight,width:area.width,height:summaryHeight,contentHeight:0};
      area={...area,height:Math.max(0,area.height-summaryHeight-(summaryHeight?summaryGap:0))};
    }
    let portraitRect:NativeRect|undefined;
    if(details){
      if(profile==='pawns'&&page.rows.some(row=>row.bio)){
        // Preserve the exact Bio card at every scale. The right dossier and
        // portrait are part of the same independently pannable paper.
        const contentWidth=Math.max(area.width,NATIVE_BIO_SIZE.width+gap+180+NATIVE_WINDOW.scrollbar);
        if(page.portrait)portraitRect={x:area.x+contentWidth-m.portraitWidth-NATIVE_WINDOW.scrollbar,y:area.y,width:m.portraitWidth,height:m.portraitHeight};
        regions.details={...area,contentHeight:0,contentWidth};
      }else{
        if(page.portrait){const portraitHeight=Math.min(m.portraitHeight,Math.max(0,area.height)),portraitWidth=portraitHeight*m.portraitWidth/m.portraitHeight;portraitRect={x:area.x+area.width-portraitWidth-12,y:area.y,width:portraitWidth,height:portraitHeight};}
        regions.details={...area,contentHeight:0};
      }
    }
    return{regions,visualRect,portraitRect};
  }

  function buildRows(regions:Partial<Record<NativeRegion,NativeRegionBox>>,portraitRect?:NativeRect){
    const rows:NativeRowBox[]=navigationRows.map(box=>({...box,row:{...box.row,region:'navigation'}}));
    for(const key of ['catalogue','details','graph'] as const){
      const region=regions[key];if(!region||key==='graph'&&page.visual)continue;
      const source=sourceRows.filter(row=>(row.region??'details')===key);
      if(profile==='pawns'&&key==='details'&&source.some(row=>row.bio)){
        const bio=source.find(row=>row.bio)!,bioBox=bioRowBox({...bio,region:key},region.x,region.y-header,measure);
        rows.push(bioBox);
        const rightX=region.x+NATIVE_BIO_SIZE.width+gap,rightWidth=Math.max(1,(region.contentWidth??region.width)-NATIVE_BIO_SIZE.width-gap-NATIVE_WINDOW.scrollbar);
        let rightTop=portraitRect?portraitRect.height+8:0;
        for(const row of source.filter(row=>row!==bio)){
          const box=rowBox({...row,region:key},rightX,region.y-header+rightTop,rightWidth,measure,false);
          rows.push(box);rightTop+=box.height+(row.dense?1:3);
        }
        region.contentHeight=Math.max(bioBox.height,rightTop);continue;
      }
      const setupColumns=key==='details'&&source.some(row=>row.setupColumn!==undefined);
      const presentLanes=setupColumns?Math.max(...source.map(row=>(row.setupColumn??0)+1)):1;
      const count=setupColumns?Math.min(presentLanes,region.width>=760?3:region.width>=520?2:1):1;
      if(key==='graph'&&!page.visual){
        const count=region.width>=640?4:region.width>=360?2:1,cellWidth=Math.max(1,(region.width-12-gap*(count-1))/count);let top=0;
        for(let index=0;index<source.length;){
          const sourceRow=source[index]!;
          if(!sourceRow.dense||sourceRow.emphasis==='heading'){
            const box=rowBox({...sourceRow,region:key},region.x,region.y-header+top,Math.max(1,region.width-12),measure,false);rows.push(box);top+=box.height+2;index++;continue;
          }
          let rowHeight=0;
          for(let column=0;column<count&&index<source.length;column++){
            const entry=source[index]!;if(!entry.dense||entry.emphasis==='heading')break;
            const box=rowBox({...entry,region:key},region.x+column*(cellWidth+gap),region.y-header+top,cellWidth,measure,false);rows.push(box);rowHeight=Math.max(rowHeight,box.height);index++;
          }
          top+=rowHeight+2;
        }
        region.contentHeight=top;continue;
      }
      let top=0,inColumns=false,portraitPlaced=false;const lanes=Array.from({length:count},()=>0);
      for(const sourceRow of source){
        const row={...sourceRow,region:key},explicit=setupColumns?row.setupColumn:undefined,useColumn=explicit!==undefined;
        const column=setupColumns&&count===2&&explicit===2?0:Math.min(count-1,explicit??0);
        if(useColumn&&!inColumns){
          inColumns=true;lanes.fill(top);
          if(key==='details'&&portraitRect&&!portraitPlaced){lanes[count-1]=Math.max(top,portraitRect.height+8);portraitPlaced=true;}
        }else if(!useColumn&&inColumns){inColumns=false;top=Math.max(...lanes);}
        const rowTop=useColumn?lanes[column]!:top;
        const portraitInset=key==='details'&&portraitRect&&!useColumn&&rowTop<portraitRect.height?portraitRect.width+12:0;
        const columnWidth=useColumn?(region.width-12-gap*(count-1))/count:Math.max(1,region.width-12-portraitInset);
        const x=region.x+(useColumn?column*(columnWidth+gap):0);
        const box=rowBox(row,x,region.y-header+rowTop,columnWidth,measure,false);
        let pitchGap=row.dense?1:3;
        if(core&&key==='catalogue'&&row.controls?.length===1&&!row.label&&!row.value&&!row.input&&(profile==='scenario'||profile==='story'||profile==='pawns'&&row.controls[0]!.portraitUrl)){
          const nominal=profile==='scenario'?m.scenarioHeight:profile==='story'?m.storytellerHeight:m.rosterHeight,controlHeight=Math.max(1,Math.min(nominal-8,region.height)),controlTop=(nominal-controlHeight)/2;
          box.width=Math.max(1,region.width-NATIVE_WINDOW.scrollbar);box.height=nominal;box.controlTop=controlTop;box.controlHeight=controlHeight;box.controlColumns=1;
          box.controls=[{control:row.controls[0]!,style:profile==='pawns'?'candidate':'scenario-choice',x:region.x+4,y:region.y-header+rowTop+controlTop,width:Math.max(1,box.width-8),height:controlHeight}];pitchGap=profile==='story'?m.storytellerGap:0;
        }else if(profile==='story'&&key==='details'&&row.controls?.length===1&&row.controls[0]!.presentation==='radio'){
          const h=Math.min(m.radioHeight,Math.max(1,region.height));box.height=m.radioHeight;box.controlTop=0;box.controlHeight=h;box.controlColumns=1;
          box.controls=[{control:row.controls[0]!,style:'radio',x,y:box.top,width:Math.max(1,columnWidth),height:h}];pitchGap=m.radioGap;
        }else if(core&&key==='catalogue'&&profile==='pawns'&&row.emphasis==='heading'){
          box.height=Math.max(m.rosterHeadingHeight,box.labelLines.length*NATIVE_LINE.small);pitchGap=0;
        }else if(profile==='world'&&key==='catalogue'&&(row.input||row.controls?.length===1)&&columnWidth>=300){
          // The world parameter listing reserves a 200-point label followed
          // by a 30-point field. Keep our numeric ± controls beside that field.
          const labelWidth=Math.min(m.worldLabelWidth,Math.floor(columnWidth*.47)),fieldX=x+labelWidth,fieldWidth=Math.max(1,columnWidth-labelWidth),fieldHeight=m.worldFieldHeight;
          box.labelWidth=labelWidth;box.textWidth=columnWidth;box.labelLines=wrapNativeText(row.label,labelWidth-6,measure,NATIVE_TEXT.small);box.valueLines=[];
          box.height=Math.max(fieldHeight,box.labelLines.length*NATIVE_LINE.small);box.controlTop=0;box.controlHeight=fieldHeight;
          if(row.input){
            const controls=row.controls??[],tail=controls.length*fieldHeight;
            box.inputRect={x:fieldX,y:box.top,width:Math.max(1,fieldWidth-tail-(controls.length?6:0)),height:fieldHeight};
            box.controls=controls.map((control,i)=>({control,style:'button',x:x+columnWidth-tail+i*fieldHeight,y:box.top,width:fieldHeight-2,height:fieldHeight}));
          }else box.controls=[{control:row.controls![0]!,style:'button',x:fieldX,y:box.top,width:fieldWidth,height:fieldHeight}];
          pitchGap=m.worldRowPitch-m.worldFieldHeight;
        }else if(key==='catalogue'&&row.compact&&row.controlStyle==='button'&&row.controls?.length===1&&!row.label&&!row.value&&!row.input){
          const control=box.controls[0];if(control){control.x=region.x;control.width=Math.max(1,region.width-12);control.y=region.y-header+rowTop+3;control.height=NATIVE_UI.button;box.height=NATIVE_UI.button+6;}
        }
        // A single-line dense fact keeps the14px font; only unused padding shrinks.
        if(row.dense&&!row.input&&!row.meter&&!row.controls?.length&&!row.detail&&box.labelLines.length===1&&box.valueLines.length<=1)box.height=24;
        rows.push(box);const next=rowTop+box.height+pitchGap;
        if(useColumn)lanes[column]=next;else top=next;
      }
      region.contentHeight=Math.max(top,...lanes,key==='details'?(portraitRect?.height??0):0);
    }
    return rows;
  }
  if(core){
    const final=geometry(maximumBody),rows=buildRows(final.regions,final.portraitRect),height=maximumHeight;
    const primary=final.regions.catalogue??final.regions.details??final.regions.graph??{x:pad,y:bodyTop,width:innerWidth,height:maximumBody,contentHeight:0};
    const actions=actionFlow.controls.map(control=>({...control,y:height-header-actionFlow.height-pad+control.y}));
    return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body:{x:primary.x,y:primary.y,width:primary.width,height:primary.height},contentHeight:primary.contentHeight,rows,layout:'setup',regions:final.regions,actions,visualRect:final.visualRect,portraitRect:final.portraitRect};
  }
  const initial=geometry(maximumBody);buildRows(initial.regions,initial.portraitRect);
  const needs=Object.fromEntries(Object.entries(initial.regions).map(([key,region])=>[key,region!.contentHeight])) as Partial<Record<NativeRegion,number>>;
  const dossierNeed=(needs.details??0)+(summary?127+gap:0);
  const catalogueNeed=needs.catalogue??0;
  let usefulBody=wide&&!page.visual?Math.max(catalogueNeed,dossierNeed):catalogueNeed+dossierNeed+(catalogue&&details?gap:0);
  if(page.visual)usefulBody=wide?Math.max(320,usefulBody):220+gap+usefulBody;
  const height=Math.min(maximumHeight,bodyTop+Math.max(28,usefulBody)+footer),space=Math.max(0,height-footer-bodyTop);
  const final=geometry(space,needs),rows=buildRows(final.regions,final.portraitRect);
  const primary=final.regions.catalogue??final.regions.details??final.regions.graph??{x:pad,y:bodyTop,width:innerWidth,height:space,contentHeight:0};
  const actions=actionFlow.controls.map(control=>({...control,y:height-header-footer+pad+control.y}));
  // Keep declaration/keyboard order. When one line fits, anchor the final action
  // to the opposite edge without changing its callback or inventing Enter behavior.
  if(actions.length>=2&&actions.every(action=>action.y===actions[0]!.y))actions[actions.length-1]!.x=pad+innerWidth-actions[actions.length-1]!.width;
  return{x:page.setupAnchor==='right'?Math.max(12,viewport.width-width-24):(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body:{x:primary.x,y:primary.y,width:primary.width,height:primary.height},contentHeight:primary.contentHeight,rows,layout:'setup',regions:final.regions,actions,visualRect:final.visualRect,portraitRect:final.portraitRect};
}

/** A message is a centred window, not a pregame dossier or an inspector.
 * The buttons stay outside the scrolling text and keep their real callbacks. */
function messagePage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const m=NATIVE_MESSAGE,width=Math.max(1,Math.min(m.width,viewport.width-24)),height=Math.max(1,Math.min(m.height,viewport.height-24));
  const pad=Math.min(NATIVE_UI.padding,width/4,height/4),inner=Math.max(1,width-pad*2),buttonHeight=Math.min(m.buttonHeight,height/4);
  const count=page.actions?.length??0,footer=pad+(count?buttonHeight+m.bodyGap:0);
  const header=Math.min(pad+m.titleHeight,Math.max(0,height-footer-1));
  const body={x:pad,y:header,width:Math.max(1,inner-NATIVE_WINDOW.scrollbar),height:Math.max(0,height-header-footer)};
  const rows:NativeRowBox[]=[];let top=0;
  for(const row of page.rows){const box=rowBox({...row,region:undefined},body.x,top,body.width,measure,false);rows.push(box);top+=box.height+m.bodyGap;}
  const lanes=Math.max(2,count),laneWidth=inner/lanes,buttonGap=Math.min(m.buttonGap,laneWidth/4);
  const actions=(page.actions??[]).map((control,index):NativeControlBox=>{
    const lane=count===1?lanes-1:index;
    return{control,style:control.presentation??'button',x:pad+lane*laneWidth+(lane===lanes-1?buttonGap:0),y:height-pad-buttonHeight-header,width:laneWidth-buttonGap,height:buttonHeight};
  });
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body,contentHeight:Math.max(0,top-m.bodyGap),rows,layout:'message',regions:{},actions};
}

/** Dialog_Options: fixed category rail, independent settings scroll, fixed OK.
 * Below the room needed by the rail and its dossier, both remain scrollable
 * in a vertical arrangement rather than forcing narrow text and inputs. */
function optionsPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  const o=NATIVE_OPTIONS,width=Math.max(1,Math.min(o.width,viewport.width-24)),height=Math.max(1,Math.min(o.height,viewport.height-24));
  const pad=Math.min(NATIVE_UI.padding,width/4,height/4),inner=Math.max(1,width-pad*2),okayHeight=Math.min(o.okayHeight,height/4);
  const footer=Math.min(pad+o.bottomSpace,Math.max(pad+okayHeight,height*.4)),header=Math.min(48,Math.max(0,height-footer-1));
  const rows:NativeRowBox[]=[],regions:Partial<Record<NativeRegion,NativeRegionBox>>={};
  const usableWidth=Math.max(1,inner-NATIVE_WINDOW.scrollbar),space=Math.max(0,height-header-footer);
  let noticeTop=0;
  for(const row of page.rows.filter(row=>row.region==='navigation')){
    const box=rowBox(row,pad,noticeTop,usableWidth,measure,false);rows.push(box);noticeTop+=box.height+o.listingGap;
  }
  const noticeHeight=Math.min(Math.max(0,noticeTop-o.listingGap),space/3),noticeGap=noticeHeight?Math.min(o.listingGap,space-noticeHeight):0;
  if(noticeTop)regions.navigation={x:pad,y:header,width:usableWidth,height:noticeHeight,contentHeight:Math.max(0,noticeTop-o.listingGap)};
  const bodyTop=header+noticeHeight+noticeGap,available=Math.max(0,space-noticeHeight-noticeGap);
  const categories=page.rows.filter(row=>row.region==='catalogue');
  const wide=inner>=o.categoryWidth+o.sectionGap+300||(height<400&&inner>=o.categoryWidth+o.sectionGap+180+NATIVE_WINDOW.scrollbar);
  const railWidth=wide?o.categoryWidth:usableWidth,railNeed=Math.max(0,categories.length*(o.categoryHeight+o.categoryGap)-o.categoryGap);
  const stackGap=wide?0:Math.min(o.sectionGap,available*.12),stackSpace=available-stackGap;
  const railHeight=wide?available:Math.min(railNeed,Math.max(Math.min(30,stackSpace/2),stackSpace*.45));
  const catalogue:NativeRegionBox={x:pad,y:bodyTop,width:railWidth,height:railHeight,contentHeight:railNeed};
  const details:NativeRegionBox={x:wide?pad+o.categoryWidth+o.sectionGap:pad,y:wide?bodyTop:bodyTop+railHeight+stackGap,
    width:wide?Math.max(1,usableWidth-o.categoryWidth-o.sectionGap):usableWidth,height:wide?available:Math.max(0,available-railHeight-stackGap),contentHeight:0};
  regions.catalogue=catalogue;regions.details=details;
  for(const [index,row] of categories.entries()){
    const top=catalogue.y-header+index*(o.categoryHeight+o.categoryGap),inset=Math.min(o.categoryInset,railWidth/4);
    const controlHeight=Math.max(1,Math.min(o.categoryHeight-o.categoryInset*2,railHeight)),controlTop=(o.categoryHeight-controlHeight)/2;
    const control=row.controls?.[0];
    if(!control||row.controls?.length!==1){rows.push(rowBox(row,catalogue.x,top,railWidth,measure,false));continue;}
    rows.push({row,x:catalogue.x,top,width:railWidth,height:o.categoryHeight,labelWidth:0,textWidth:railWidth,inlineActions:false,matrix:false,
      labelLines:[],valueLines:[],detailLines:[],controlTop,controlHeight,controlColumns:1,
      controls:[{control,style:'button',x:catalogue.x+inset,y:top+controlTop,width:railWidth-2*inset,height:controlHeight}]});
  }
  let top=0;
  for(const source of page.rows.filter(row=>row.region!=='catalogue'&&row.region!=='navigation')){
    const row={...source,region:'details' as const},rowTop=details.y-header+top;
    const box=rowBox(row,details.x,rowTop,details.width,measure,false);
    if(row.input){
      const count=box.controls.length,tail=count?count*28+6:0,remaining=details.width-box.labelWidth-tail-14;
      if(remaining>=55)box.inputRect={x:details.x+box.labelWidth+8,y:rowTop+3,width:remaining,height:26};
      else{
        // A large interface scale can make the entire window very narrow.
        // Keep the label and formatted value above the editable field.
        const laneTop=rowTop+box.height,inputWidth=Math.max(1,details.width-tail-4);
        box.inputRect={x:details.x+2,y:laneTop,width:inputWidth,height:26};
        for(const control of box.controls)control.y=laneTop;
        box.controlTop=laneTop-rowTop;box.height+=30;
      }
    }
    rows.push(box);top+=box.height+o.listingGap;
  }
  details.contentHeight=Math.max(0,top-o.listingGap);
  const okayWidth=Math.min(o.okayWidth,inner),actions=(page.actions??[]).map((control):NativeControlBox=>({control,style:'button',x:(width-okayWidth)/2,y:height-pad-okayHeight-header,width:okayWidth,height:okayHeight}));
  return{x:(viewport.width-width)/2,y:(viewport.height-height)/2,width,height,header,footer,body:catalogue,contentHeight:catalogue.contentHeight,rows,layout:'options',regions,actions};
}

/** Core's small modeless search window. Only the result list scrolls; the
 * status and search editor stay at the bottom. No other layout opts into it. */
function mapSearchPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure,offset=0):NativePageBox {
  const m=NATIVE_MAP_SEARCH,width=Math.max(1,Math.min(m.width,viewport.width)),entries=page.mapSearchCount===undefined?page.rows.filter(row=>row.mapSearchEntry):page.rows,count=page.mapSearchCount??entries.length;
  const height=Math.max(1,Math.min(m.minimumHeight+count*m.rowHeight,viewport.height/2,viewport.height-m.bottom));
  const pad=Math.min(m.margin,width/4,height/5),inner=Math.max(1,width-2*pad),searchHeight=Math.min(m.searchHeight,height/3),statusHeight=Math.min(m.statusHeight,height/3);
  const searchY=height-pad-searchHeight,statusY=searchY-statusHeight,listHeight=Math.max(0,statusY-pad),scroll=count*m.rowHeight>listHeight;
  const catalogue:NativeRegionBox={x:pad,y:pad,width:Math.max(1,inner-(scroll?NATIVE_WINDOW.scrollbar:0)),height:listHeight,contentHeight:count*m.rowHeight};
  const toolbar:NativeRegionBox={x:pad,y:statusY,width:inner,height:statusHeight+searchHeight,contentHeight:statusHeight+searchHeight};
  const start=Math.max(0,Math.min(Math.max(0,count*m.rowHeight-listHeight),offset)),first=Math.floor(start/m.rowHeight),last=Math.min(count,Math.ceil((start+listHeight)/m.rowHeight));
  const rows:NativeRowBox[]=entries.slice(first,last).map((row,local)=>{const index=first+local;
    const top=pad+index*m.rowHeight,w=catalogue.width;
    const controls:NativeControlBox[]=(row.controls??[]).map(control=>({control,style:'button',x:pad,y:top,width:w,height:m.rowHeight,hitOnly:true}));
    return{row,x:pad,top,width:w,height:m.rowHeight,labelWidth:Math.max(1,w-2*m.rowHeight-8),controlTop:0,controlHeight:m.rowHeight,controlColumns:controls.length,detailLines:[],labelLines:[row.label],valueLines:[],textWidth:w,inlineActions:true,matrix:false,controls};
  });
  for(const row of page.mapSearchCount===undefined?page.rows.filter(row=>!row.mapSearchEntry):page.rows.slice(count)){
    const top=row.input?searchY:statusY,h=row.input?searchHeight:statusHeight,box=rowBox(row,pad,top,inner,measure,false);
    box.height=h;box.labelLines=row.input?[]:[row.label];box.valueLines=[];box.controls=[];box.detailLines=[];
    if(row.input)box.inputRect={x:pad,y:searchY,width:inner,height:searchHeight};rows.push(box);
  }
  return{x:viewport.width-width,y:Math.max(0,viewport.height-height-m.bottom),width,height,header:0,footer:height-statusY,body:catalogue,contentHeight:catalogue.contentHeight,rows,layout:'map-search',regions:{catalogue,toolbar},actions:[]};
}

export function layoutNativePage(page:NativePage,viewport:{width:number;height:number},front:boolean,measure:TextMeasure,mapSearchOffset=0):NativePageBox {
  const layout=page.layout??(front?'front':page.id.startsWith('inspect-')?'inspector':['work','schedule','animals','wildlife','assign','history'].includes(page.id)?'table':'dialog');
  if(page.floatMenu)return floatMenuPage(page,viewport,measure);
  if(layout==='map-search')return mapSearchPage(page,viewport,measure,mapSearchOffset);
  if(layout==='quests')return questsPage(page,viewport,measure);
  if(layout==='history')return historyPage(page,viewport,measure);
  if(layout==='menu')return menuPage(page,viewport,measure);
  if(layout==='home')return homePage(page,viewport,measure);
  if(layout==='files')return filesPage(page,viewport,measure);
  if(layout==='trade')return tradePage(page,viewport,measure);
  if(layout==='info')return infoPage(page,viewport,measure);
  if(layout==='message')return messagePage(page,viewport,measure);
  if(layout==='options')return optionsPage(page,viewport,measure);
  if(layout==='setup')return setupPage(page,viewport,measure);
  if(layout==='storage')return storagePage(page,viewport,measure);
  if(layout==='world')return worldPage(page,viewport,measure);
  if(layout==='table'&&page.tableProfile==='colonists'&&['work','schedule','assign'].includes(page.id)&&page.rows.some(row=>row.columns))return colonistTablePage(page,viewport,measure);
  if(layout==='table'&&page.tableProfile==='factions'&&page.id==='factions'&&page.rows.some(row=>row.columns))return factionsPage(page,viewport,measure);
  if(layout==='table'&&(page.id==='animals'||page.id==='wildlife')&&page.rows.some(row=>row.columns))return animalTablePage(page,viewport,measure);
  if(layout==='architect'||layout==='research')return structuredPage(page,viewport,measure,layout);
  if(layout==='inspector'&&page.rows.some(row=>row.id==='pawn-tabs'))return inspectorPage(page,viewport,measure);
  if(layout==='palette'){
    const x=Math.min(128,Math.max(12,viewport.width-120)),available=Math.max(48,viewport.width-x-16);
    const count=page.rows.reduce((sum,row)=>sum+(row.controls?.length??0),0),gap=6;
    const wanted=Math.max(48,count*48+Math.max(0,count-1)*gap),width=Math.min(wanted,available);
    const iconWidth=Math.max(42,Math.min(48,(width-Math.max(0,count-1)*gap)/Math.max(1,count))),contentWidth=Math.max(width,count*iconWidth+Math.max(0,count-1)*gap);
    const height=46,body={x:0,y:0,width,height},rows:NativeRowBox[]=[];let index=0;
    // A tray is a single physical strip. Narrow viewports pan the strip instead
    // of moving the final action to a second, apparently unrelated line.
    for(const row of page.rows){
      const box=rowBox(row,0,0,contentWidth,measure,false);
      box.controls=(row.controls??[]).map(control=>({control,style:control.presentation??'icon',x:index++*(iconWidth+gap),y:0,width:iconWidth,height}));
      box.height=height;box.width=contentWidth;box.controlTop=0;box.controlHeight=height;box.controlColumns=count;rows.push(box);
    }
    return {x,y:viewport.height-NATIVE_UI.bottom-12-height-(page.palette==='orders'?54:0),width,height,header:0,footer:0,body,contentHeight:height,rows,layout,regions:{catalogue:{...body,contentHeight:height,contentWidth}},actions:[]};
  }
  let requested=requestedWidth(page,layout==='inspector'?680:layout==='tools'?350:760);
  if(page.id==='menu')requested=450;if(page.id==='history')requested=720;if(page.id==='animals')requested=900;
  const width=Math.min(Math.max(220,Math.min(requested,viewport.width-32)),Math.max(1,viewport.width-24)),pad=NATIVE_UI.padding;
  const visual=nativeVisualWidth(page,width),contentWidth=width-pad*2-(visual?visual+10:0)-12,bodyX=pad+visual+(visual?10:0);
  const matrixColumns=layout==='table'?Math.max(0,...page.rows.map(row=>row.columns?.length??0)):0;
  const matrixRow=(row:NativeRow)=>matrixColumns>0&&(!!row.columns||!!row.compact&&row.controls?.length===matrixColumns);
  const matrixTail=page.rows.some(row=>matrixRow(row)&&!!row.value);
  const intrinsicWidth=matrixColumns?Math.max(contentWidth,page.id==='work'?1320:0,...page.rows.filter(matrixRow).map(row=>104+(matrixTail?192:0)+matrixColumns*42+Math.max(0,matrixColumns-1)*6)):contentWidth;
  const horizontalReserve=intrinsicWidth>contentWidth?12:0;
  const header=page.subtitle?76:page.portrait?58:48;
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:width-pad*2,height:0},measure);
  const bottom=front?20:NATIVE_UI.bottom+10,availableHeight=Math.max(1,viewport.height-bottom-(front?20:12));
  const scrollActions=header+actionFlow.height+8+32>availableHeight;
  const footer=(page.actions?.length&&!scrollActions?actionFlow.height+pad*2:pad)+horizontalReserve;
  const effectiveRows:readonly NativeRow[]=scrollActions&&page.actions?.length?[...page.rows,{id:'page-overflow-actions',label:'Actions',controls:page.actions,controlStyle:'button'}]:page.rows;
  const rows:NativeRowBox[]=[];let top=0,left=0,right=0,columns=false;
  const rowGap=front?12:matrixColumns?4:3;
  for(const row of effectiveRows){
    if(row.column!==undefined&&!columns){columns=true;left=right=top;}
    else if(row.column===undefined&&columns){columns=false;top=Math.max(left,right);}
    const ratio=page.columnRatio??.5,columnWidth=columns?(row.column===1?contentWidth*(1-ratio)-5:contentWidth*ratio-5):matrixRow(row)?intrinsicWidth:contentWidth;
    const x=bodyX+(columns&&row.column===1?contentWidth*ratio+5:0),rowTop=columns?(row.column===1?right:left):top;
    const displayRow=matrixRow(row)?{...row,region:'catalogue' as const}:row;
    const box=rowBox(displayRow,x,rowTop,columnWidth,measure,layout==='table',undefined,matrixRow(row)?matrixTail:undefined);rows.push(box);
    if(columns){if(row.column===1)right+=box.height+rowGap;else left+=box.height+rowGap;}else top+=box.height+rowGap;
  }
  const contentHeight=Math.max(top,left,right);
  const maxHeight=Math.min(availableHeight,Math.max(header+footer+32,150,Math.min(page.height??(front?760:layout==='inspector'?600:layout==='tools'?560:720),viewport.height-bottom-(front?20:110))));
  const height=page.id==='world'&&page.visual?maxHeight:Math.min(maxHeight,Math.max(header+footer+40,header+contentHeight+footer+8,page.visual?440:0));
  const actions=scrollActions?[]:actionFlow.controls.map(control=>({...control,y:height-header-footer+horizontalReserve+pad+control.y}));
  const x=front?(viewport.width-width)/2:12;
  const y=front?(viewport.height-height)/2:viewport.height-bottom-height;
  const body={x:bodyX,y:header,width:contentWidth,height:height-header-footer};
  const nameWidth=Math.min(104,Math.max(1,body.width-1));
  return {x,y,width,height,header,footer,body,contentHeight,rows,layout,regions:matrixColumns?{
    navigation:{...body,width:nameWidth,contentHeight},
    catalogue:{...body,x:body.x+nameWidth,width:body.width-nameWidth,contentWidth:intrinsicWidth-nameWidth,contentHeight},
  }:{},actions};
}
