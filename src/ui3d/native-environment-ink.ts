import {NATIVE_INK,NATIVE_TEXT,type NativeTextRole} from './native-ui-scale';
import type {NativeEnvironmentLayout,NativeEnvironmentStats} from './native-environment-stats';

/** Beauty magnitude has the reference's red–green gradient, lightened for
 * world labels and darkened for contrast on Elsewhere's original paper. */
export function environmentBeautyColor(value:number,scale:number,worldLabel=false):number {
  const t=Math.max(0,Math.min(1,(value/Math.max(1,scale)+1)*.5));
  const a=worldLabel?[255,128,128]:[150,53,41],mid=worldLabel?[218,208,128]:[84,73,58],b=worldLabel?[128,255,128]:[42,99,38];
  const from=t<.5?a:mid,to=t<.5?mid:b,f=t<.5?t*2:(t-.5)*2;
  const rgb=from.map((v,index)=>Math.round(v+(to[index]!-v)*f));return (rgb[0]!<<16)|(rgb[1]!<<8)|rgb[2]!;
}
const css=(color:number)=>`#${color.toString(16).padStart(6,'0')}`;
interface Painter {font:(role:NativeTextRole,bold?:boolean)=>string;measure:(text:string,size:number,bold?:boolean)=>number}

/** All rectangles are local to the panel, so its ink is reusable when the
 * pointer moves. No HTML, per-cell canvas or new geometry on pointer motion. */
export function paintNativeEnvironmentStats(ctx:CanvasRenderingContext2D,layout:NativeEnvironmentLayout,stats:NativeEnvironmentStats,painter:Painter):void {
  const text=(value:string,x:number,y:number,width:number,height:number,role:NativeTextRole='small',color:string=NATIVE_INK.text,bold=false)=>{
    if(width<=1||height<NATIVE_TEXT.tiny*.7)return;
    // Truncate text that cannot fit its remaining lane; never stretch glyphs.
    const size=NATIVE_TEXT[role],chars=Array.from(value);let displayed=value;
    if(painter.measure(value,size,bold)>width){while(chars.length&&painter.measure(chars.join('')+'…',size,bold)>width)chars.pop();displayed=chars.length?chars.join('').trimEnd()+'…':'';}
    ctx.font=painter.font(role,bold);ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(displayed,x,y+height/2+size*.32);
  };
  if(layout.beauty&&stats.beauty){const rect=layout.beauty,score=Math.abs(stats.beauty.average)<.05?0:stats.beauty.average;
    text(`Beauté ici : ${score.toFixed(1)}`,rect.x,rect.y,rect.width,rect.height,'small',css(environmentBeautyColor(score,40)),true);}
  if(layout.divider!==undefined){ctx.fillStyle=NATIVE_INK.line;ctx.fillRect(layout.pad,layout.divider,Math.max(1,layout.width-layout.pad*2),1);}
  if(!stats.room||!layout.title)return;
  const title=layout.title;text(stats.room.title,title.x,title.y,title.width,title.height,'medium',NATIVE_INK.text,true);
  layout.rows.forEach((rect,index)=>{
    const stat=stats.room!.stats[index];if(!stat)return;
    if(index%2===1){ctx.fillStyle=NATIVE_INK.rowAlt;ctx.fillRect(layout.pad,rect.y,Math.max(1,layout.width-layout.pad*2),rect.height);}
    const ink=stat.related?NATIVE_INK.text:NATIVE_INK.subtle;
    if(stat.related)text('*',rect.gutter.x,rect.y,rect.gutter.width,rect.height,'small',NATIVE_INK.sectionTitle,true);
    text(stat.label,rect.label.x,rect.y,rect.label.width,rect.height,'small',ink);
    // The following inter-column gap is available for a large numeric score.
    const scoreWidth=Math.max(rect.value.width,rect.stage.x-rect.value.x-6),scoreRole=painter.measure(stat.value,NATIVE_TEXT.small,stat.related)>scoreWidth?'tiny':'small';
    text(stat.value,rect.value.x,rect.y,scoreWidth,rect.height,scoreRole,ink,stat.related);
    text(stat.stage,rect.stage.x,rect.y,rect.stage.width,rect.height,'small',ink);
  });
  if(layout.note&&stats.room.stats.some(stat=>stat.related)){const r=layout.note;text('* Statistique liée au rôle de la pièce',r.x,r.y,r.width,r.height,'tiny',NATIVE_INK.subtle);}
}
