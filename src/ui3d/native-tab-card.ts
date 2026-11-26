import type {NativeControl} from './native-contract';
import {NATIVE_INK,NATIVE_LINE,NATIVE_TEXT,NATIVE_WINDOW,type NativeTextRole} from './native-ui-scale';

/** The inner pages of the inspector tabs (RimWorld `ITab_Pawn_*`,
 * `NeedsCardUtility`, `HealthCardUtility`, `SocialCardUtility`): one fixed card
 * per tab, in the tab's own points. A tab's pure layout function returns a
 * display list (rectangles, texts, bars, glyphs), the hit targets that carry a
 * tooltip or an action, and its scroll regions. The list is computed once per
 * change of the page (selection, thought, wound...), then painted on the page's
 * ink plane: no per-frame search or allocation. Scrolling regions (RimWorld
 * `Widgets.BeginScrollView`) keep their offset here, outside the page data. */
export interface CardRect {x:number;y:number;width:number;height:number}
export type CardMeasure=(text:string,role:NativeTextRole,bold?:boolean)=>number;
interface CardBase {region?:string}
export interface CardText extends CardBase {k:'text';x:number;y:number;w:number;h:number;text:string;role:NativeTextRole;ink:string;align:'left'|'center'|'right';v:'top'|'middle'|'bottom';bold?:boolean;truncate?:boolean}
export interface CardFill extends CardBase {k:'fill';x:number;y:number;w:number;h:number;color:string}
export interface CardLine extends CardBase {k:'line';x:number;y:number;w:number;color:string}
export interface CardPanel extends CardBase {k:'panel';x:number;y:number;w:number;h:number}
export interface CardBar extends CardBase {
  k:'bar';x:number;y:number;w:number;h:number;fill:number;color:string;border:boolean;
  /** `Need.threshPercents`: ticks on the lower half of the bar. */
  ticks?:readonly number[];
  /** `NeedDef.showUnitTicks`: full-height dividers at each whole unit. */
  divisions?:readonly number[];
  /** `GUIChangeArrow`, from -3 to 3: arrows beside the bar's end. */
  arrow?:number;
  /** `CurInstantLevel`: a small triangle under the bar. */
  marker?:number;
}
export type CardGlyphKind='info'|'drop'|'ingest'|'bleed'|'tend'|'check'|'radio'|'copy';
export interface CardGlyph extends CardBase {k:'glyph';glyph:CardGlyphKind;x:number;y:number;w:number;h:number;on?:boolean;disabled?:boolean}
export interface CardButton extends CardBase {k:'button';x:number;y:number;w:number;h:number;label:string;disabled?:boolean;active?:boolean;dropdown?:boolean;ink?:string}
export type CardItem=CardText|CardFill|CardLine|CardPanel|CardBar|CardGlyph|CardButton;
export interface CardTarget {id:string;x:number;y:number;w:number;h:number;hint?:string;control?:NativeControl;region?:string;highlight?:boolean}
export interface CardRegion {id:string;x:number;y:number;w:number;h:number;contentHeight:number}
export interface NativeTabCard {width:number;height:number;items:CardItem[];targets:CardTarget[];regions:CardRegion[]}

/** Scroll offsets of the open card's regions, by region id. Reset on a change
 * of selection or tab (`ITab.OnOpen` resets the thought scroll in Core). */
const offsets=new Map<string,number>();
export function cardScroll(id:string):number{return offsets.get(id)??0;}
export function resetCardScroll():void{offsets.clear();}
/** For the page's ink signature: the scroll offsets repaint the card. */
export function cardScrollKey():string{let key='';for(const [id,value] of offsets)key+=id+':'+value+';';return key;}
export function setCardScroll(card:NativeTabCard,id:string,value:number):boolean{
  const region=card.regions.find(entry=>entry.id===id);if(!region)return false;
  const next=Math.min(Math.max(0,value),Math.max(0,region.contentHeight-region.h)),before=offsets.get(id)??0;
  if(next===before)return false;
  if(next)offsets.set(id,next);else offsets.delete(id);return true;
}
/** The offset actually applied: clamped to the region as it is now laid out. */
export function appliedScroll(region:CardRegion):number{return Math.min(Math.max(0,offsets.get(region.id)??0),Math.max(0,region.contentHeight-region.h));}

/** `Widgets.Label(rect.Truncate)`-like: ends with an ellipsis when too wide. */
export function ellipsize(text:string,width:number,measure:CardMeasure,role:NativeTextRole='small',bold=false):string{
  if(measure(text,role,bold)<=width)return text;
  const chars=Array.from(text);while(chars.length&&measure(chars.join('')+'…',role,bold)>width)chars.pop();return chars.join('').trimEnd()+'…';
}
/** Greedy word wrap of `Text.CalcHeight`; an over-long word breaks. */
export function wrapCardText(text:string,width:number,measure:CardMeasure,role:NativeTextRole='small',bold=false):string[]{
  const lines:string[]=[];
  for(const paragraph of text.split('\n')){
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)){
      const next=line?line+' '+word:word;
      if(line&&measure(next,role,bold)>width){lines.push(line);line=word;}else line=next;
      while(measure(line,role,bold)>width&&line.length>1){let cut=line.length-1;while(cut>1&&measure(line.slice(0,cut),role,bold)>width)cut--;lines.push(line.slice(0,cut));line=line.slice(cut);}
    }
    lines.push(line);
  }
  return lines;
}

/** Accumulates one card. Every method takes points in the card's own space;
 * `region` places the item in a scrolling viewport (coordinates then relative
 * to the viewport's content, whose top is 0). */
export class CardBuilder {
  readonly items:CardItem[]=[];readonly targets:CardTarget[]=[];readonly regions:CardRegion[]=[];
  constructor(readonly width:number,public height:number,readonly measure:CardMeasure){}
  text(x:number,y:number,w:number,h:number,text:string,options:{role?:NativeTextRole;ink?:string;align?:CardText['align'];v?:CardText['v'];bold?:boolean;truncate?:boolean;region?:string}={}):void{
    this.items.push({k:'text',x,y,w,h,text,role:options.role??'small',ink:options.ink??NATIVE_INK.text,align:options.align??'left',v:options.v??'middle',bold:options.bold,truncate:options.truncate,region:options.region});
  }
  fill(x:number,y:number,w:number,h:number,color:string,region?:string):void{this.items.push({k:'fill',x,y,w,h,color,region});}
  line(x:number,y:number,w:number,color:string=NATIVE_INK.line,region?:string):void{this.items.push({k:'line',x,y,w,color,region});}
  panel(x:number,y:number,w:number,h:number,region?:string):void{this.items.push({k:'panel',x,y,w,h,region});}
  bar(item:Omit<CardBar,'k'>):void{this.items.push({k:'bar',...item});}
  glyph(glyph:CardGlyphKind,x:number,y:number,w:number,h:number,options:{on?:boolean;disabled?:boolean;region?:string}={}):void{this.items.push({k:'glyph',glyph,x,y,w,h,on:options.on,disabled:options.disabled,region:options.region});}
  button(x:number,y:number,w:number,h:number,label:string,options:{disabled?:boolean;active?:boolean;dropdown?:boolean;ink?:string;region?:string}={}):void{this.items.push({k:'button',x,y,w,h,label,disabled:options.disabled,active:options.active,dropdown:options.dropdown,ink:options.ink,region:options.region});}
  target(target:CardTarget):void{this.targets.push(target);}
  region(id:string,x:number,y:number,w:number,h:number,contentHeight:number):void{this.regions.push({id,x,y,w,h,contentHeight});}
  /** `Widgets.Label` in the scale's Small role, a line of 22 by default. */
  label(x:number,y:number,w:number,text:string,options:{h?:number;ink?:string;align?:CardText['align'];role?:NativeTextRole;truncate?:boolean;region?:string;bold?:boolean}={}):void{
    this.text(x,y,w,options.h??NATIVE_LINE.small,text,{role:options.role,ink:options.ink,align:options.align,truncate:options.truncate,region:options.region,bold:options.bold});
  }
  card():NativeTabCard{return {width:this.width,height:this.height,items:this.items,targets:this.targets,regions:this.regions};}
}

/** Targets in card points with the scroll offsets applied and each rectangle
 * clipped to its viewport; a target scrolled out of view is dropped. Regions
 * also get one target of their own, under the rows', that receives the wheel. */
export function nativeTabTargets(card:NativeTabCard):CardTarget[]{
  const result:CardTarget[]=[];
  for(const region of card.regions)result.push({id:'region:'+region.id,x:region.x,y:region.y,w:region.w,h:region.h,region:region.id});
  for(const target of card.targets){
    if(!target.region){result.push(target);continue;}
    const region=card.regions.find(entry=>entry.id===target.region);if(!region){result.push(target);continue;}
    const offset=appliedScroll(region),top=Math.max(region.y,region.y+target.y-offset),bottom=Math.min(region.y+region.h,region.y+target.y-offset+target.h);
    if(bottom-top<2)continue;
    result.push({...target,x:region.x+target.x,y:top,w:Math.min(target.w,region.w-target.x),h:bottom-top});
  }
  return result;
}

export interface CardPainter {font:(role:NativeTextRole,bold?:boolean)=>string;measure:CardMeasure;rng:()=>number}
const BASELINE=.36;
function paintText(ctx:CanvasRenderingContext2D,item:CardText,ox:number,oy:number,paint:CardPainter):void{
  ctx.font=paint.font(item.role,item.bold);ctx.fillStyle=item.ink;ctx.textAlign=item.align;
  const text=item.truncate?ellipsize(item.text,item.w,paint.measure,item.role,item.bold):item.text,size=NATIVE_TEXT[item.role];
  const y=item.v==='middle'?oy+item.y+item.h/2+size*BASELINE:item.v==='top'?oy+item.y+size*.95:oy+item.y+item.h-size*.2;
  const x=item.align==='left'?ox+item.x:item.align==='center'?ox+item.x+item.w/2:ox+item.x+item.w;
  ctx.fillText(text,x,y,Math.max(1,item.w));
}
/** `Widgets.FillableBar` with Need.DrawOnGUI's ticks, divisions, arrows and
 * instant marker, on the paper: a frame of 3 when the bar is taller than 15
 * and wider than 20, a track, the fill. */
function paintBar(ctx:CanvasRenderingContext2D,bar:CardBar,ox:number,oy:number):void{
  let x=ox+bar.x,y=oy+bar.y,w=bar.w,h=bar.h;
  if(bar.border){ctx.fillStyle=NATIVE_INK.barFrame;ctx.fillRect(x,y,w,h);x+=3;y+=3;w-=6;h-=6;}
  ctx.fillStyle=NATIVE_INK.barBack;ctx.fillRect(x,y,w,h);
  ctx.fillStyle=bar.color;ctx.fillRect(x,y,w*Math.min(1,Math.max(0,bar.fill)),h);
  for(const at of bar.ticks??[]){
    const width=w>60?2:1,passed=at<bar.fill;
    ctx.fillStyle=passed?NATIVE_INK.tickPassed:NATIVE_INK.tickAhead;ctx.globalAlpha=passed?.9:.6;
    ctx.fillRect(x+w*at-(width-1),y+h/2,width,h/2);ctx.globalAlpha=1;
  }
  for(const at of bar.divisions??[]){
    const passed=at<bar.fill;ctx.fillStyle=passed?NATIVE_INK.tickPassed:NATIVE_INK.tickAhead;ctx.globalAlpha=passed?.9:.5;
    ctx.fillRect(x+w*at-2,y,3,h);ctx.globalAlpha=1;
  }
  if(bar.marker!==undefined&&bar.marker>=0){
    const size=w<150?6:12,cx=x+w*Math.min(1,bar.marker),top=y+h;
    ctx.fillStyle=NATIVE_INK.marker;ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx-size/2,top+size);ctx.lineTo(cx+size/2,top+size);ctx.closePath();ctx.fill();
  }
  const arrows=Math.min(3,Math.abs(bar.arrow??0));
  if(arrows){
    const height=Math.min(16,bar.h),cy=oy+bar.y+bar.h/2,up=(bar.arrow??0)>0;
    ctx.fillStyle=NATIVE_INK.arrow;
    for(let index=0;index<arrows;index++){
      const left=up?ox+bar.x+bar.w+2+index*8:ox+bar.x-10-index*8;
      ctx.beginPath();
      if(up){ctx.moveTo(left,cy-height/2);ctx.lineTo(left+8,cy);ctx.lineTo(left,cy+height/2);}else{ctx.moveTo(left+8,cy-height/2);ctx.lineTo(left,cy);ctx.lineTo(left+8,cy+height/2);}
      ctx.closePath();ctx.fill();
    }
  }
}
/** Small pictograms of RimWorld's tab buttons, in Elsewhere's ink. */
export function paintCardGlyph(ctx:CanvasRenderingContext2D,item:CardGlyph,ox:number,oy:number):void{
  const x=ox+item.x,y=oy+item.y,w=item.w,h=item.h,cx=x+w/2,cy=y+h/2,s=Math.min(w,h),ink=item.disabled?NATIVE_INK.disabled:NATIVE_INK.text;
  ctx.save();ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=1.6;ctx.lineJoin='round';ctx.lineCap='round';
  switch(item.glyph){
    case 'info':
      ctx.beginPath();ctx.arc(cx,cy,s*.42,0,Math.PI*2);ctx.stroke();ctx.fillRect(cx-1,cy-1,2,s*.26);ctx.beginPath();ctx.arc(cx,cy-s*.2,1.4,0,Math.PI*2);ctx.fill();break;
    case 'drop':
      ctx.beginPath();ctx.moveTo(cx,cy-s*.36);ctx.lineTo(cx,cy+s*.1);ctx.moveTo(cx-s*.22,cy-s*.12);ctx.lineTo(cx,cy+s*.12);ctx.lineTo(cx+s*.22,cy-s*.12);ctx.moveTo(cx-s*.34,cy+s*.3);ctx.lineTo(cx+s*.34,cy+s*.3);ctx.stroke();break;
    case 'ingest':
      ctx.beginPath();ctx.moveTo(cx-s*.14,cy-s*.36);ctx.lineTo(cx-s*.14,cy+s*.36);ctx.moveTo(cx+s*.14,cy-s*.36);ctx.lineTo(cx+s*.14,cy+s*.36);ctx.moveTo(cx-s*.14,cy-s*.1);ctx.lineTo(cx+s*.14,cy-s*.1);ctx.stroke();break;
    case 'bleed':
      ctx.fillStyle=NATIVE_INK.negative;ctx.beginPath();ctx.moveTo(cx,cy-s*.4);ctx.bezierCurveTo(cx+s*.34,cy,cx+s*.3,cy+s*.38,cx,cy+s*.38);ctx.bezierCurveTo(cx-s*.3,cy+s*.38,cx-s*.34,cy,cx,cy-s*.4);ctx.fill();break;
    case 'tend':
      ctx.strokeStyle=NATIVE_INK.positive;ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(cx-s*.3,cy);ctx.lineTo(cx+s*.3,cy);ctx.moveTo(cx,cy-s*.3);ctx.lineTo(cx,cy+s*.3);ctx.stroke();break;
    case 'check':
      ctx.strokeRect(x+s*.15,y+s*.15,s*.7,s*.7);
      if(item.on){ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(x+s*.25,cy);ctx.lineTo(cx-s*.05,y+s*.72);ctx.lineTo(x+s*.78,y+s*.28);ctx.stroke();}break;
    case 'radio':
      ctx.beginPath();ctx.arc(cx,cy,s*.36,0,Math.PI*2);ctx.stroke();if(item.on){ctx.beginPath();ctx.arc(cx,cy,s*.2,0,Math.PI*2);ctx.fill();}break;
    case 'copy':
      ctx.strokeRect(x+s*.28,y+s*.1,s*.5,s*.55);ctx.strokeRect(x+s*.12,y+s*.3,s*.5,s*.58);break;
  }
  ctx.restore();
}
function paintItem(ctx:CanvasRenderingContext2D,item:CardItem,ox:number,oy:number,paint:CardPainter):void{
  switch(item.k){
    case 'text':paintText(ctx,item,ox,oy,paint);break;
    case 'fill':ctx.fillStyle=item.color;ctx.fillRect(ox+item.x,oy+item.y,item.w,item.h);break;
    case 'line':ctx.fillStyle=item.color;ctx.fillRect(ox+item.x,oy+item.y,item.w,1);break;
    case 'panel':ctx.fillStyle=NATIVE_INK.panelFill;ctx.fillRect(ox+item.x,oy+item.y,item.w,item.h);ctx.strokeStyle=NATIVE_INK.panelEdge;ctx.lineWidth=1;ctx.strokeRect(ox+item.x+.5,oy+item.y+.5,item.w-1,item.h-1);break;
    case 'bar':paintBar(ctx,item,ox,oy);break;
    case 'glyph':paintCardGlyph(ctx,item,ox,oy);break;
    case 'button':{
      ctx.fillStyle=item.active?NATIVE_INK.buttonActive:NATIVE_INK.buttonFill;ctx.fillRect(ox+item.x,oy+item.y,item.w,item.h);
      ctx.strokeStyle=NATIVE_INK.buttonEdge;ctx.lineWidth=1;ctx.strokeRect(ox+item.x+.5,oy+item.y+.5,item.w-1,item.h-1);
      const ink=item.disabled?NATIVE_INK.disabled:item.ink??NATIVE_INK.text;
      ctx.font=paint.font('small');ctx.fillStyle=ink;ctx.textAlign='center';
      const room=item.w-(item.dropdown?26:12),text=ellipsize(item.label,room,paint.measure);
      ctx.fillText(text,ox+item.x+(item.dropdown?(item.w-14)/2:item.w/2),oy+item.y+item.h/2+NATIVE_TEXT.small*BASELINE);
      if(item.dropdown){ctx.beginPath();ctx.moveTo(ox+item.x+item.w-18,oy+item.y+item.h/2-3);ctx.lineTo(ox+item.x+item.w-8,oy+item.y+item.h/2-3);ctx.lineTo(ox+item.x+item.w-13,oy+item.y+item.h/2+4);ctx.closePath();ctx.fill();}
      ctx.textAlign='left';
      break;}
  }
}
/** Paints the card at (ox, oy) of the page's ink plane. Items of a region are
 * clipped to its viewport and moved by its scroll offset; a thin scroll bar of
 * `NATIVE_WINDOW.scrollbar` is drawn when the content is taller. */
export function paintNativeTabCard(ctx:CanvasRenderingContext2D,card:NativeTabCard,ox:number,oy:number,paint:CardPainter):void{
  ctx.save();ctx.textAlign='left';
  for(const item of card.items)if(!item.region)paintItem(ctx,item,ox,oy,paint);
  for(const region of card.regions){
    const offset=appliedScroll(region);
    ctx.save();ctx.beginPath();ctx.rect(ox+region.x,oy+region.y,region.w,region.h);ctx.clip();
    for(const item of card.items)if(item.region===region.id)paintItem(ctx,item,ox+region.x,oy+region.y-offset,paint);
    ctx.restore();
    if(region.contentHeight>region.h){
      const track=NATIVE_WINDOW.scrollbar,max=region.contentHeight-region.h,thumb=Math.max(28,region.h*region.h/region.contentHeight),top=oy+region.y+(region.h-thumb)*(offset/max);
      ctx.fillStyle=NATIVE_INK.scrollTrack;ctx.fillRect(ox+region.x+region.w-track,oy+region.y,track,region.h);
      ctx.fillStyle=NATIVE_INK.scrollThumb;ctx.fillRect(ox+region.x+region.w-track,top,track,thumb);
    }
  }
  ctx.restore();
}
