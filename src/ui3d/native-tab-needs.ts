import {CardBuilder,type CardMeasure,type NativeTabCard} from './native-tab-card';
import {NATIVE_INK} from './native-ui-scale';

/** The Needs tab (RimWorld `ITab_Pawn_Needs`, `NeedsCardUtility`, `Need.DrawOnGUI`,
 * `Need_Mood`). Core facts: a needs column of 225 (each need `min(70, 520 / n)`
 * high; a minor need is 0.73 as wide and 0.666 as high, at least 30, after a gap
 * of 10), then the mood bar on 80 % of the remaining width and its thought list
 * (rows of 20 every 24, the offset in a column of 32 at x = 235). The window is
 * 580 × 520, or 225 wide when the person has no mood. */
export interface NeedBarSpec {id:string;label:string;major:boolean;level:number;thresholds:readonly number[];arrow:number;marker?:number;hint:string;unavailable?:boolean}
export interface NeedThoughtSpec {id:string;label:string;count:number;offset:number;hint:string}
export interface NeedsSpec {type:'needs';needs:readonly NeedBarSpec[];mood?:NeedBarSpec;thoughts:readonly NeedThoughtSpec[]}
export const NEEDS_FULL={width:580,height:520,column:225,moodX:235,numberWidth:32,thoughtHeight:20,thoughtPitch:24} as const;
/** `Need.DrawOnGUI`: label in the top half, the bar below it with a margin of
 * 29 each side and 14 under, `rect.height > 70` centred. */
export function needBarGeometry(rect:{x:number;y:number;width:number;height:number}){
  let {y,height}=rect;const {x,width}=rect;
  if(height>70){y+=(height-70)/2;height=70;}
  let under=14;const margin=14+15;
  if(height<50)under*=Math.max(0,Math.min(1,height/50));
  const labelRect={x:x+margin+width*.1,y,width:width-margin-width*.1,height:height/2};
  const bar={x:x+margin,y:y+height/2,width:width-margin*2,height:height/2-under};
  return {outer:{x,y,width,height},label:labelRect,bar,smallLabel:height<=55};
}
function drawNeed(builder:CardBuilder,need:NeedBarSpec,rect:{x:number;y:number;width:number;height:number},ids:string):void{
  const g=needBarGeometry(rect);
  builder.text(g.label.x,g.label.y,g.label.width,g.label.height,need.label,{role:g.smallLabel?'tiny':'small',v:'bottom'});
  if(need.unavailable)builder.text(g.bar.x,g.bar.y,g.bar.width,g.bar.height,'—',{ink:NATIVE_INK.none,align:'center'});
  else builder.bar({x:g.bar.x,y:g.bar.y,w:g.bar.width,h:g.bar.height,fill:need.level,color:NATIVE_INK.barFill,border:g.bar.height>15&&g.bar.width>20,ticks:need.thresholds,arrow:need.arrow,marker:need.marker});
  builder.target({id:ids+need.id,x:g.outer.x,y:g.outer.y,w:g.outer.width,h:g.outer.height,hint:need.hint,highlight:true});
}
/** Rounded with Core's « ##0 » format: no decimals, a minus sign, 0 alone. */
export function thoughtOffsetLabel(value:number):string{const rounded=Math.round(value);return Object.is(rounded,-0)||rounded===0?'0':String(rounded);}
export function layoutNeedsTab(spec:NeedsSpec,measure:CardMeasure):NativeTabCard{
  const count=spec.needs.length,full=!!spec.mood;
  const width=full?NEEDS_FULL.width:NEEDS_FULL.column,height=full?NEEDS_FULL.height:count*Math.min(70,NEEDS_FULL.height/Math.max(1,count));
  const builder=new CardBuilder(width,height,measure);
  const column={x:0,y:0,width:NEEDS_FULL.column,height};
  let y=0;
  spec.needs.forEach((need,index)=>{
    const rect={x:column.x,y:column.y+y,width:column.width,height:Math.min(70,column.height/Math.max(1,count))};
    if(!need.major){
      if(index>0&&spec.needs[index-1]!.major)rect.y+=10;
      rect.width*=.73;rect.height=Math.max(rect.height*.666,30);
    }
    drawNeed(builder,need,rect,'need:');y=rect.y+rect.height-column.y;
  });
  if(spec.mood){
    const rightWidth=width-NEEDS_FULL.column;
    drawNeed(builder,spec.mood,{x:NEEDS_FULL.column,y:0,width:rightWidth*.8,height:70},'');
    // The thought listing: (0, 80, w, h − 70 − 10) contracted by 10, rows of 20
    // every 24, the scroll view 16 narrower than the list.
    const listing={x:NEEDS_FULL.column+10,y:90,width:rightWidth-20,height:height-70-10-20},rowWidth=listing.width-16;
    builder.region('thoughts',listing.x,listing.y,listing.width,listing.height,spec.thoughts.length*NEEDS_FULL.thoughtPitch);
    spec.thoughts.forEach((thought,index)=>{
      const top=index*NEEDS_FULL.thoughtPitch,label=thought.count>1?`${thought.label} x${thought.count}`:thought.label,ink=thought.offset===0?NATIVE_INK.none:thought.offset>0?NATIVE_INK.positive:NATIVE_INK.negative;
      builder.text(10,top-3,225,NEEDS_FULL.thoughtHeight+6,label,{region:'thoughts',truncate:true});
      builder.text(235,top,NEEDS_FULL.numberWidth,NEEDS_FULL.thoughtHeight,thoughtOffsetLabel(thought.offset),{region:'thoughts',ink,align:'center'});
      builder.target({id:'thought:'+thought.id,x:0,y:top,w:rowWidth,h:NEEDS_FULL.thoughtHeight,hint:thought.hint,region:'thoughts',highlight:true});
    });
  }
  return builder.card();
}
