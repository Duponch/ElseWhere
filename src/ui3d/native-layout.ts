import type {NativeControl,NativeControlStyle,NativePage,NativeRow} from './native-contract';

/** CSS-pixel design tokens; neither browser layout nor DPR changes the model. */
export const NATIVE_UI={body:14,small:12,title:18,line:20,padding:18,gap:10,button:34,tab:34,scrollbar:10,bottom:82} as const;
export const NATIVE_RIGHT_DOCK_WIDTH=264;
export type NativeRegion='navigation'|'catalogue'|'details'|'graph';
export interface NativeRect {x:number;y:number;width:number;height:number}
/** Region y is absolute in the page. Row/control y remains relative to header. */
export interface NativeRegionBox extends NativeRect {contentHeight:number;contentWidth?:number}
export interface NativeControlBox extends NativeRect {control:NativeControl;style:NativeControlStyle}
export interface NativeInspectorParts {sheet:NativeRect;tabs:NativeRect;summary:NativeRect;actions:NativeRect}
export interface NativeRowBox {
  row:NativeRow;x:number;top:number;width:number;height:number;labelWidth:number;
  controlTop:number;controlHeight:number;controlColumns:number;detailLines:string[];
  /** Text lane stays clear of actions arranged beside the same record. */
  textWidth:number;inlineActions:boolean;matrixTail?:boolean;
  labelLines:string[];valueLines:string[];matrix:boolean;controls:NativeControlBox[];
}
export interface NativePageBox {
  x:number;y:number;width:number;height:number;header:number;footer:number;body:NativeRect;
  contentHeight:number;rows:NativeRowBox[];layout:NonNullable<NativePage['layout']>;
  regions:Partial<Record<NativeRegion,NativeRegionBox>>;actions:NativeControlBox[];
  inspectorParts?:NativeInspectorParts;
}
export type TextMeasure=(text:string,size:number,bold?:boolean)=>number;
/** Shared geometry for matrix controls, painted headings and their hint planes.
 * The name and activity lanes have the same width in every row. */
export function nativeMatrixColumns(row:Pick<NativeRow,'value'>,x:number,width:number,count:number,tail=!!row.value):NativeRect[]{
  if(count<=0)return [];
  const left=x+104,available=Math.max(1,width-104-(tail?192:0)),gap=6,cell=Math.max(1,(available-gap*(count-1))/count);
  return Array.from({length:count},(_,index)=>({x:left+index*(cell+gap),y:0,width:cell,height:0}));
}
/** Long single-word headings wrap instead of squeezing their glyphs. The full
 * original column label is still the tooltip and the model's authority. */
export function nativeMatrixHeadingLines(text:string,width:number,measure:TextMeasure):string[]{
  const words:string[]=[];
  for(const word of text.split(/\s+/).filter(Boolean)){
    let part='';for(const character of Array.from(word)){if(part&&measure(part+character,12,true)>width){words.push(part);part='';}part+=character;}if(part)words.push(part);
  }
  return wrapNativeText(words.join(' '),width,(value,size)=>measure(value,size,true),12);
}
/** Share the globe/dossier split with its physical scene placement. */
export function nativeVisualWidth(page:NativePage,width:number):number{return page.visual?Math.min(page.id==='world'?560:360,width*.48):0;}
export function wrapNativeText(text:string,width:number,measure:TextMeasure,size=13):string[]{
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
export function wrapNativeCardText(text:string,width:number,measure:TextMeasure,size=13):string[]{
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
  const title=lines(control.label,15,true),caption=lines(control.caption,13,false),description=lines(control.description,13,false);
  const height=Math.max(76,28+title.length*20+(caption.length?caption.length*19+4:0)+(description.length?description.length*19+4:0));
  return {title,caption,description,height,inkWidth};
}
function naturalWidth(control:NativeControl,measure:TextMeasure,style:NativeControlStyle):number {
  if(style==='icon')return 48;
  if(style==='navigation')return 96;
  if(style==='tab')return Math.max(68,Math.min(128,measure(control.label,NATIVE_UI.body,true)+22));
  if(!control.select&&!control.caption&&/^[↶↷×+−-]$/u.test(control.label))return 32;
  return Math.max(68,Math.min(240,measure(control.label,NATIVE_UI.body,true)+24+(control.icon?24:0)+(control.select?16:0)));
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
    const columns=rect.width>=190?2:1,width=Math.min(100,(rect.width-gap*(columns-1))/columns),height=96;
    controls.forEach((control,index)=>boxes.push({control,style:control.presentation??style,x:rect.x+index%columns*(width+gap),y:rect.y+Math.floor(index/columns)*(height+gap),width,height}));
    return {controls:boxes,height:Math.ceil(controls.length/columns)*(height+gap)-gap};
  }
  if(style==='tile'){
    const fit=Math.max(1,Math.floor((rect.width+gap)/(96+gap)));
    const columns=Math.min(fit,Math.max(1,tileColumnLimit??fit));
    const width=Math.min(104,(rect.width-gap*(columns-1))/columns),height=104;
    controls.forEach((control,index)=>boxes.push({control,style:control.presentation??style,x:rect.x+(index%columns)*(width+gap),y:rect.y+Math.floor(index/columns)*(height+gap),width,height}));
    return {controls:boxes,height:Math.ceil(controls.length/columns)*(height+gap)-gap};
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
function rowBox(row:NativeRow,x:number,top:number,width:number,measure:TextMeasure,table:boolean,tileColumnLimit?:number,matrixTail=!!row.value):NativeRowBox {
  if(row.tree)return storageTreeRowBox(row,x,top,width,measure);
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
    controls=nativeMatrixColumns(row,x,width,controlColumns,matrixTail).map((column,index)=>({control:row.controls![index]!,style:row.controls![index]!.presentation??'button',x:column.x,y:top+3,width:column.width,height:controlHeight}));
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
const requestedWidth=(page:NativePage,fallback:number)=>page.width?(page.width>20?page.width:page.width*100):fallback;
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
  const height=Math.min(page.height??760,760,Math.max(1,viewport.height-bottom-12));
  const contentWidth=Math.max(1,width-pad*2-12),rows:NativeRowBox[]=[];
  const actionFlow=flowNativeControls(page.actions??[],{x:pad,y:0,width:Math.max(1,width-pad*2),height:0},measure);
  const footerPad=14,footer=page.actions?.length?actionFlow.height+footerPad*2:footerPad;
  const footerTop=Math.max(header,height-footer),contentBottom=Math.max(header,footerTop-gap);
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
  const details=fixed.details!,navigation=fixed.navigation!;
  const sectionGaps=(details.boxes.length?gap:0)+(navigation.boxes.length?gap:0);
  const detailsBudget=Math.max(0,contentBottom-header-navigation.height-sectionGaps-72);
  const detailsHeight=Math.min(details.height,detailsBudget);
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={};let nextTop=header;
  for(const key of ['details','navigation'] as const){
    const section=fixed[key]!,visibleHeight=key==='details'?detailsHeight:section.height;
    regions[key]={x:pad,y:nextTop,width:contentWidth+12,height:visibleHeight,contentHeight:section.height};
    for(const box of section.boxes){const delta=nextTop-header;box.top+=delta;box.controls=box.controls.map(control=>({...control,y:control.y+delta}));rows.push(box);}
    nextTop+=visibleHeight+(section.boxes.length?gap:0);
  }
  const catalogueHeight=Math.max(0,contentBottom-nextTop);
  regions.catalogue={x:pad,y:nextTop,width:contentWidth+12,height:catalogueHeight,contentHeight:0};
  let treeTop=0;
  for(const row of page.rows.filter(row=>row.region==='catalogue')){
    const box=rowBox(row,pad,nextTop-header+treeTop,contentWidth,measure,false);rows.push(box);treeTop+=box.height;
  }
  regions.catalogue.contentHeight=treeTop;
  const actions=actionFlow.controls.map(control=>({...control,y:footerTop-header+footerPad+control.y}));
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body:{...regions.catalogue},contentHeight:treeTop,rows,layout:'storage',regions,actions};
}
function regionRows(page:NativePage,regions:Partial<Record<NativeRegion,NativeRegionBox>>,header:number,measure:TextMeasure,tileColumnLimit?:number):NativeRowBox[]{
  const rows:NativeRowBox[]=[],tops:Partial<Record<NativeRegion,number>>={};
  for(const row of page.rows){
    const key=row.region??'details',region=regions[key];if(!region)continue;
    const top=tops[key]??0,usableWidth=Math.max(24,region.width-12);
    if(key==='graph'&&row.graphNode){
      const node=row.graphNode,nodeTop=region.y-header+node.y,x=region.x+node.x;
      const box=rowBox(row,x,nodeTop,node.width,measure,false);box.width=node.width;box.height=node.height;
      box.controls=(row.controls??[]).map((control,index)=>({control,style:index===0?'research':'icon',x:index===0?x:x+node.width-24,y:index===0?nodeTop:nodeTop+node.height-26,width:index===0?node.width:22,height:index===0?node.height:19}));
      rows.push(box);region.contentHeight=Math.max(region.contentHeight,node.y+node.height);continue;
    }
    const box=rowBox(row,region.x,region.y-header+top,usableWidth,measure,false,tileColumnLimit);rows.push(box);
    tops[key]=top+box.height;region.contentHeight=tops[key]!;
  }
  return rows;
}
function structuredPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure,layout:'architect'|'research'):NativePageBox {
  const pad=NATIVE_UI.padding,gap=14,requested=requestedWidth(page,layout==='architect'?1180:1190),width=Math.min(Math.max(280,Math.min(layout==='architect'?Math.min(requested,1180):requested,viewport.width-32)),Math.max(1,viewport.width-24));
  const header=48,bottom=NATIVE_UI.bottom+12;
  const availableHeight=Math.max(1,viewport.height-bottom-12);
  const height=Math.min(availableHeight,layout==='architect'?476:Math.max(180,Math.min(page.height??780,780,viewport.height-214)));
  const body:NativeRect={x:pad,y:header,width:width-pad*2,height:height-header-pad};
  const regions:Partial<Record<NativeRegion,NativeRegionBox>>={};
  if(layout==='architect'){
    const navWidth=Math.min(width>=620?212:104,Math.max(96,width*.36));
    regions.navigation={x:pad,y:header,width:navWidth,height:body.height,contentHeight:0};
    const catalogueX=pad+navWidth+gap,remaining=width-pad-catalogueX;
    if(width<850){
      const minimumCatalogue=Math.min(48,Math.max(1,(body.height-10)*.6));
      const detailsHeight=Math.min(Math.max(1,body.height-10-minimumCatalogue),190,Math.max(110,body.height*.29)),catalogueHeight=Math.max(1,body.height-detailsHeight-10);
      regions.catalogue={x:catalogueX,y:header,width:remaining,height:catalogueHeight,contentHeight:0};
      regions.details={x:catalogueX,y:header+catalogueHeight+10,width:remaining,height:detailsHeight,contentHeight:0};
    }else{
      const detailsWidth=viewport.width>1100?250:230;
      regions.catalogue={x:catalogueX,y:header,width:remaining-detailsWidth-gap,height:body.height,contentHeight:0};
      regions.details={x:width-pad-detailsWidth,y:header,width:detailsWidth,height:body.height,contentHeight:0};
    }
  }else{
    const sidebar=Math.min(viewport.width>1100?300:viewport.width>760?260:220,Math.max(120,width*.4));
    const graphX=pad+sidebar+12,graphWidth=Math.max(60,width-pad-graphX);
    regions.details={x:pad,y:header,width:sidebar,height:body.height,contentHeight:0};
    regions.navigation={x:graphX,y:header,width:graphWidth,height:NATIVE_UI.tab,contentHeight:0};
    regions.graph={x:graphX,y:header+NATIVE_UI.tab+6,width:graphWidth,height:Math.max(1,body.height-NATIVE_UI.tab-6),contentHeight:page.research?.height??815,contentWidth:page.research?.width??850};
  }
  const tileColumnLimit=layout==='architect'?10:4;
  // The cardboard and its regions depend only on the viewport, never on the
  // selected category or construction. Their complete contents scroll inside.
  const rows=regionRows(page,regions,header,measure,tileColumnLimit);
  const primary=regions[layout==='architect'?'catalogue':'details']!;
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer:pad,body:{x:primary.x,y:primary.y,width:primary.width,height:primary.height},contentHeight:primary.contentHeight,rows,layout,regions,actions:[]};
}
/** Keep the dossier above its tabs and the portrait/action strip below them. */
function inspectorPage(page:NativePage,viewport:{width:number;height:number},measure:TextMeasure):NativePageBox {
  // A dossier is one stable physical object. Changing tab changes its contents,
  // never the paper, tabs or the portrait/action strip underneath it.
  const width=Math.min(Math.max(220,Math.min(760,viewport.width-32)),Math.max(1,viewport.width-24)),pad=NATIVE_UI.padding,header=40;
  const bodyX=pad,contentWidth=width-pad*2-12,tabsRow=page.rows.find(row=>row.id==='pawn-tabs')!;
  const tabsBox=rowBox(tabsRow,bodyX,0,contentWidth,measure,false);
  const rows:NativeRowBox[]=[];let top=0,left=0,right=0,columns=false;
  for(const row of page.rows){
    if(row===tabsRow)continue;
    if(row.column!==undefined&&!columns){columns=true;left=right=top;}
    else if(row.column===undefined&&columns){columns=false;top=Math.max(left,right);}
    const ratio=page.columnRatio??.5,columnWidth=columns?(row.column===1?contentWidth*(1-ratio)-5:contentWidth*ratio-5):contentWidth;
    const x=bodyX+(columns&&row.column===1?contentWidth*ratio+5:0),rowTop=columns?(row.column===1?right:left):top;
    const box=rowBox(row,x,rowTop,columnWidth,measure,false);rows.push(box);
    if(columns){if(row.column===1)right+=box.height;else left+=box.height;}else top+=box.height;
  }
  const contentHeight=Math.max(top,left,right),bottom=NATIVE_UI.bottom+10;
  const stripWidth=width-pad*2,summaryWidth=Math.min(260,Math.max(118,stripWidth*.4));
  const actionsX=pad+summaryWidth+12,actionsWidth=Math.max(64,width-pad-actionsX),actionColumns=(page.actions?.length??0)>4?3:2;
  const cellWidth=Math.max(24,(actionsWidth-(actionColumns-1)*NATIVE_UI.gap)/actionColumns),actions:NativeControlBox[]=[];
  for(const [index,control]of(page.actions??[]).entries()){
    const style=control.presentation??'button',buttonWidth=Math.min(cellWidth,naturalWidth(control,measure,style));
    const textWidth=Math.max(12,buttonWidth-24-(control.icon?24:0)-(control.select?16:0));
    const height=wrapNativeText(control.label,textWidth,measure,NATIVE_UI.body).length>1?42:NATIVE_UI.button;
    actions.push({control,style,x:actionsX+index%actionColumns*(cellWidth+NATIVE_UI.gap),y:13+Math.floor(index/actionColumns)*50,width:buttonWidth,height});
  }
  const stripHeight=Math.max(118,Math.ceil(actions.length/actionColumns)*50+4);
  const availableHeight=Math.max(1,viewport.height-bottom-12);
  const minimumHeight=header+8+4+tabsBox.height+4+stripHeight+40;
  if(availableHeight<minimumHeight){
    // At a large accessibility scale, keep full-sized text and controls in one
    // scrollable dossier rather than pushing its fixed strips off the screen.
    return layoutNativePage({...page,layout:'dialog',rows:page.rows.map(row=>({...row,region:undefined}))},viewport,false,measure);
  }
  const height=Math.min(availableHeight,660);
  const bodyHeight=Math.max(40,height-header-8-4-tabsBox.height-4-stripHeight);
  const sheet:NativeRect={x:0,y:0,width,height:header+bodyHeight+8};
  const tabs:NativeRect={x:pad,y:sheet.height+4,width:contentWidth,height:tabsBox.height};
  const stripY=tabs.y+tabs.height+4;
  const summary:NativeRect={x:pad,y:stripY,width:summaryWidth,height:stripHeight};
  const actionRect:NativeRect={x:actionsX,y:stripY,width:actionsWidth,height:stripHeight};
  const footer=height-header-bodyHeight;
  const tabsTop=tabs.y-header;
  if(tabsBox.row.region!=='navigation')tabsBox.row={...tabsRow,region:'navigation'};
  tabsBox.top=tabsTop;tabsBox.controls=tabsBox.controls.map(control=>({...control,y:control.y+tabsTop}));
  actions.forEach(control=>control.y+=stripY-header);
  return {x:12,y:viewport.height-bottom-height,width,height,header,footer,body:{x:bodyX,y:header,width:contentWidth,height:bodyHeight},contentHeight,rows:[tabsBox,...rows],layout:'inspector',regions:{navigation:{...tabs,contentHeight:tabs.height}},actions,inspectorParts:{sheet,tabs,summary,actions:actionRect}};
}
export function layoutNativePage(page:NativePage,viewport:{width:number;height:number},front:boolean,measure:TextMeasure):NativePageBox {
  const layout=page.layout??(front?'front':page.id.startsWith('inspect-')?'inspector':['work','schedule','animals','wildlife','assign','history'].includes(page.id)?'table':'dialog');
  if(layout==='storage')return storagePage(page,viewport,measure);
  if(layout==='architect'||layout==='research')return structuredPage(page,viewport,measure,layout);
  if(layout==='inspector'&&page.portrait&&page.rows.some(row=>row.id==='pawn-tabs'))return inspectorPage(page,viewport,measure);
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
  if(page.id==='menu')requested=368;if(page.id==='history')requested=720;if(page.id==='animals')requested=900;
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
  const height=page.id==='world'?maxHeight:Math.min(maxHeight,Math.max(header+footer+40,header+contentHeight+footer+8,page.visual?440:0));
  const actions=scrollActions?[]:actionFlow.controls.map(control=>({...control,y:height-header-footer+horizontalReserve+pad+control.y}));
  const x=front?(viewport.width-width)/2:12,y=front?(viewport.height-height)/2:viewport.height-bottom-height;
  const body={x:bodyX,y:header,width:contentWidth,height:height-header-footer};
  const nameWidth=Math.min(104,Math.max(1,body.width-1));
  return {x,y,width,height,header,footer,body,contentHeight,rows,layout,regions:matrixColumns?{
    navigation:{...body,width:nameWidth,contentHeight},
    catalogue:{...body,x:body.x+nameWidth,width:body.width-nameWidth,contentWidth:intrinsicWidth-nameWidth,contentHeight},
  }:{},actions};
}
