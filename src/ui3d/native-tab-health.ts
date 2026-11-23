import type {NativeControl} from './native-contract';
import {CardBuilder,wrapCardText,type CardMeasure,type NativeTabCard} from './native-tab-card';
import {NATIVE_INK,NATIVE_LINE} from './native-ui-scale';

/** The Health tab (RimWorld `ITab_Pawn_Health`, `HealthCardUtility`). Core
 * facts: 630 × 430; the card starts 20 down; the summary on the left is 37.5 %
 * of the width (its top 11 lower, under two tabs of 32: « Vue d'ensemble » and
 * « Opérations »), a menu section whose content is contracted by 9; the hediff
 * list on the right contracted by 10, 22 shorter than the area for the bleeding
 * line. In the summary: policy rows of 23 (label on the left half, control on
 * the right half, 4 apart), a rule, then « Douleur » and the capacities as rows
 * of 22 at x = 17 (label left, percentage right, coloured by estimate). In the
 * list: part names on 37.5 % of the width, their hediffs after them with a
 * strip of 20 × 20 icons (info, bleeding, tended) at the right, alternating
 * bands, a scroll bar when long. */
export interface HealthSettingSpec {id:string;label:string;hint:string;kind:'select'|'check';value?:string;on?:boolean;control:NativeControl}
export interface HealthEntryItem {id:string;label:string;count:number;ink?:string;bleeding:boolean;tended:boolean;hint:string}
export interface HealthEntrySpec {id:string;part?:{label:string;ink:string;hint:string};info?:NativeControl;items:readonly HealthEntryItem[]}
export interface HealthCapacitySpec {id:string;label:string;value:string;ink:string;hint:string}
export interface HealthOperationsSpec {note:string;request?:{label:string;hint:string;cancel:NativeControl};add?:NativeControl;empty:string}
export interface HealthSpec {
  type:'health';tab:'overview'|'operations';
  tabs:{overview:NativeControl;operations?:NativeControl;operationsLabel:string};
  settings:readonly HealthSettingSpec[];pain?:{label:string;ink:string;hint:string};capacities:readonly HealthCapacitySpec[];
  entries:readonly HealthEntrySpec[];bleed?:{text:string;hint:string};operations?:HealthOperationsSpec;emptyText:string;
}
export const HEALTH_SIZE={width:630,height:430,top:20,summaryRatio:.375,tab:32,tabMax:200,tabOverlap:10} as const;
export function layoutHealthTab(spec:HealthSpec,measure:CardMeasure):NativeTabCard{
  const S=HEALTH_SIZE,builder=new CardBuilder(S.width,S.height,measure);
  const out={x:0,y:S.top,width:S.width,height:S.height-S.top},summaryWidth=Math.round(out.width*S.summaryRatio);
  const summary={x:0,y:out.y+11,width:summaryWidth,height:out.height-11},right={x:summaryWidth,y:out.y,width:out.width-summaryWidth,height:out.height};
  builder.panel(summary.x,summary.y,summary.width,summary.height);
  // `TabDrawer.DrawTabs`: tabs of at most 200, overlapping by 10, above the menu section.
  const tabs=[{control:spec.tabs.overview,label:'Vue d’ensemble',active:spec.tab==='overview'},...(spec.tabs.operations?[{control:spec.tabs.operations,label:spec.tabs.operationsLabel,active:spec.tab==='operations'}]:[])];
  const tabWidth=Math.min(S.tabMax,(summary.width+(tabs.length-1)*S.tabOverlap)/tabs.length);
  tabs.forEach((tab,index)=>{
    const x=index*(tabWidth-S.tabOverlap),y=summary.y-S.tab+1;
    builder.button(x,y,tabWidth,S.tab-1,tab.label,{active:tab.active});
    builder.target({id:'health-tab:'+index,x,y,w:tabWidth,h:S.tab-1,hint:tab.control.hint,control:tab.control});
  });
  const inner={x:summary.x+9,y:summary.y+9,width:summary.width-18,height:summary.height-18};
  let y=inner.y;
  const half=(row:number)=>({label:{x:inner.x,w:inner.width/2-4},control:{x:inner.x+inner.width/2+4,w:inner.width/2-4},y:row});
  if(spec.tab==='operations'){
    y+=2;const ops=spec.operations;
    if(ops){
      builder.label(inner.x,y,inner.width,ops.note,{h:NATIVE_LINE.small,ink:NATIVE_INK.subtle,truncate:true});y+=NATIVE_LINE.small+6;
      if(ops.request){
        const lines=wrapCardText(ops.request.label,inner.width-4,measure,'small');
        lines.forEach((line,index)=>builder.label(inner.x,y+index*NATIVE_LINE.small,inner.width,line));
        builder.target({id:'operation-request',x:inner.x,y,w:inner.width,h:lines.length*NATIVE_LINE.small,hint:ops.request.hint,highlight:true});y+=lines.length*NATIVE_LINE.small+6;
        builder.button(inner.x,y,120,29,ops.request.cancel.label,{disabled:ops.request.cancel.disabled});
        builder.target({id:'operation-cancel',x:inner.x,y,w:120,h:29,hint:ops.request.cancel.hint,control:ops.request.cancel});
      }else{
        if(ops.add){
          builder.button(inner.x,y,Math.min(inner.width,176),29,ops.add.label,{dropdown:true,disabled:ops.add.disabled});
          builder.target({id:'operation-add',x:inner.x,y,w:Math.min(inner.width,176),h:29,hint:ops.add.hint,control:ops.add});
          y+=29+10;
        }
        builder.label(inner.x,y,inner.width,ops.empty,{ink:NATIVE_INK.none,h:NATIVE_LINE.small});
      }
    }
  }else{
    y+=4;
    let any=false;
    for(const setting of spec.settings){
      const g=half(y);any=true;
      builder.label(g.label.x,y,g.label.w,setting.label,{h:23,truncate:true});
      if(setting.kind==='select')builder.button(g.control.x,y,g.control.w,23,setting.value??'',{dropdown:true,disabled:setting.control.disabled});
      else builder.glyph('check',g.control.x,y,23,23,{on:setting.on,disabled:setting.control.disabled});
      builder.target({id:'health-setting:'+setting.id,x:inner.x,y,w:inner.width,h:23,hint:setting.hint,control:setting.control,highlight:setting.kind==='check'});
      y+=23+(setting.kind==='check'?10:4);
    }
    if(any)builder.line(inner.x-8,y,inner.width);
    y+=10;
    const row=(id:string,label:string,value:string,ink:string,hint:string)=>{
      builder.label(inner.x+17,y,inner.width-34-10,label,{truncate:true});
      builder.text(inner.x+17,y,inner.width-34-10,NATIVE_LINE.small,value,{align:'right',ink});
      builder.target({id,x:inner.x+17,y,w:inner.width-34-10,h:NATIVE_LINE.small,hint,highlight:true});y+=NATIVE_LINE.small;
    };
    if(spec.pain){row('health-pain','Douleur',spec.pain.label,spec.pain.ink,spec.pain.hint);y+=6;}
    for(const capacity of spec.capacities)row('capacity:'+capacity.id,capacity.label,capacity.value,capacity.ink,capacity.hint);
  }
  // The hediff list: the area contracted by 10, a scroll view 22 shorter.
  const list={x:right.x+10,y:right.y+10,width:right.width-20,height:right.height-20},view={x:list.x,y:list.y,width:list.width,height:list.height-NATIVE_LINE.small};
  const iconWidth=Math.max(20,...spec.entries.map(entry=>20+entry.items.reduce((most,item)=>Math.max(most,(item.bleeding?25:0)+(item.tended?25:0)),0)));
  // First pass: heights, to know whether the scroll bar takes 16.
  const rowHeights=(rowWidth:number)=>{
    const partWidth=rowWidth*.375,itemWidth=rowWidth-partWidth-iconWidth;
    return spec.entries.map(entry=>{
      const partHeight=entry.part?wrapCardText(entry.part.label,partWidth,measure).length*NATIVE_LINE.small:NATIVE_LINE.small;
      let itemsHeight=0;const item=entry.items.map(entryItem=>{const lines=wrapCardText(entryItem.count>1?`${entryItem.label} x${entryItem.count}`:entryItem.label,itemWidth,measure);itemsHeight+=lines.length*NATIVE_LINE.small;return lines;});
      return {entry,partHeight,item,height:Math.max(partHeight,itemsHeight)};
    });
  };
  let rowWidth=list.width-16,rows=rowHeights(rowWidth);
  const content=rows.reduce((sum,entry)=>sum+entry.height,0);
  if(content<=view.height){rowWidth=list.width;rows=rowHeights(rowWidth);}
  const total=Math.max(view.height,rows.reduce((sum,entry)=>sum+entry.height,0));
  builder.region('hediffs',view.x,view.y,view.width,view.height,rows.reduce((sum,entry)=>sum+entry.height,0));
  if(!rows.length)builder.text(view.x,view.y,view.width,view.height,spec.emptyText,{ink:NATIVE_INK.none,align:'center'});
  let top=0;void total;
  rows.forEach((layout,index)=>{
    const {entry}=layout,partWidth=rowWidth*.375,itemWidth=rowWidth-partWidth-iconWidth;
    if(index%2===0)builder.fill(0,top,rowWidth,layout.height,NATIVE_INK.rowAlt,'hediffs');
    if(entry.part)wrapCardText(entry.part.label,partWidth,measure).forEach((line,i)=>builder.label(0,top+i*NATIVE_LINE.small,partWidth,line,{region:'hediffs',ink:entry.part!.ink}));
    else builder.label(0,top,partWidth,'Corps entier',{region:'hediffs',ink:NATIVE_INK.red});
    if(entry.part)builder.target({id:'part:'+entry.id,x:0,y:top,w:partWidth,h:layout.height,hint:entry.part.hint,region:'hediffs',highlight:true});
    let itemTop=top;
    entry.items.forEach((item,i)=>{
      const lines=layout.item[i]!,height=lines.length*NATIVE_LINE.small;
      lines.forEach((line,j)=>builder.label(partWidth,itemTop+j*NATIVE_LINE.small,itemWidth,line,{region:'hediffs',ink:item.ink}));
      builder.target({id:'hediff:'+item.id,x:partWidth,y:itemTop,w:itemWidth,h:height,hint:item.hint,region:'hediffs',highlight:true});
      // Icons from the right edge leftwards: info, bleeding, tended.
      let iconX=rowWidth-20;
      if(entry.info){builder.glyph('info',iconX,itemTop+(NATIVE_LINE.small-20)/2,20,20,{region:'hediffs'});builder.target({id:'info:'+entry.id,x:iconX,y:itemTop,w:20,h:NATIVE_LINE.small,hint:entry.info.hint,control:entry.info,region:'hediffs'});}
      iconX-=25;
      if(item.bleeding){builder.glyph('bleed',iconX,itemTop+(NATIVE_LINE.small-20)/2,20,20,{region:'hediffs'});iconX-=25;}
      if(item.tended){builder.glyph('tend',iconX,itemTop+(NATIVE_LINE.small-20)/2,20,20,{region:'hediffs'});}
      itemTop+=height;
    });
    top+=layout.height;
  });
  if(spec.bleed){
    builder.label(list.x,list.y+view.height,list.width,spec.bleed.text,{truncate:true});
    builder.target({id:'health-bleed',x:list.x,y:list.y+view.height,w:list.width,h:NATIVE_LINE.small,hint:spec.bleed.hint,highlight:true});
  }
  return builder.card();
}
