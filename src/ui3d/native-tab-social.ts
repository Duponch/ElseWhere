import type {NativeControl} from './native-contract';
import {CardBuilder,wrapCardText,type CardMeasure,type NativeTabCard} from './native-tab-card';
import {NATIVE_INK,NATIVE_LINE} from './native-ui-scale';

/** The Social tab (RimWorld `ITab_Pawn_Social`, `SocialCardUtility`,
 * `InteractionCardUtility`) and the Log tab (`ITab_Pawn_Log`,
 * `ITab_Pawn_Log_Utility`). Core facts, Social: 540 × 510; the area starts 15
 * down, contracted by 10; the relations list takes 63 % of its height, a rule
 * across the middle of the gap of 17, then the interaction log (entries of at
 * least 26 with the text at x = 29, at most 12 concerning the person); relation
 * rows share the width as 23 % relations (grey), 41 % name, 7.5 % opinion of
 * the other (minimum 25), 8.5 % the other's opinion in brackets (minimum 35,
 * dimmed) and 20 % situation (grey), after 5 at the left, a top padding of 3.
 * Log: 630 × 510; three checkboxes at y = 2 (« Tout » x 60, « Social » x 330,
 * « Combat » x 445), a copy button of 18 × 24 at x = width − 60, the list under
 * 24, contracted by 10, entries with a gap of 20 around battles, alternating
 * bands at 3 %, headings in Medium. */
export interface SocialRowSpec {id:string;relations:string;name:string;mine?:number;his?:number;situation:string;hint:string;select?:NativeControl}
export interface InteractionSpec {id:string;text:string;faded:boolean;hint:string}
export interface SocialSpec {type:'social';rows:readonly SocialRowSpec[];interactions:readonly InteractionSpec[]}
export const SOCIAL_SIZE={width:540,height:510,top:15,pad:10,listRatio:.63,gap:17,textX:29,imageHeight:26,rowTop:3,maxEntries:12} as const;
/** `SocialCardUtility.CalculateColumnsWidths`. */
export function socialColumnWidths(rowWidth:number){
  const total=rowWidth-10;let relations=total*.23,label=total*.41,mine=total*.075,his=total*.085;const situation=total*.2;
  if(mine<25){label-=25-mine;mine=25;}
  if(his<35){label-=35-his;his=35;}
  return {relations,label,mine,his,situation};
}
/** `OpinionLabelColor`: grey under 10 in magnitude, red when negative, green. */
export function opinionInk(opinion:number,alpha=1):string{
  const ink=Math.abs(opinion)<10?NATIVE_INK.relation:opinion<0?NATIVE_INK.red:NATIVE_INK.good;
  if(alpha>=1)return ink;
  // The other's opinion is drawn at 0.4 alpha in Core; on paper a lighter mix keeps it readable.
  return `rgba(${parseInt(ink.slice(1,3),16)},${parseInt(ink.slice(3,5),16)},${parseInt(ink.slice(5,7),16)},${alpha})`;
}
export function signedInteger(value:number):string{const rounded=Math.round(value);return rounded>0?`+${rounded}`:String(rounded);}
export function layoutSocialTab(spec:SocialSpec,measure:CardMeasure):NativeTabCard{
  const S=SOCIAL_SIZE,builder=new CardBuilder(S.width,S.height,measure);
  const area={x:S.pad,y:S.top+S.pad,width:S.width-S.pad*2,height:S.height-S.top-S.pad*2};
  const relationsHeight=area.height*S.listRatio,logTop=area.y+relationsHeight+S.gap,logHeight=area.y+area.height-logTop;
  builder.line(0,Math.round((area.y+relationsHeight+logTop)/2),S.width,NATIVE_INK.line);
  // The relations: rows are laid out once to know whether the bar takes 16.
  const rowsFor=(width:number)=>{
    const c=socialColumnWidths(width);
    return spec.rows.map(row=>{
      const lines=Math.max(wrapCardText(row.relations,c.relations,measure).length,wrapCardText(row.name,c.label,measure).length);
      return {row,height:lines*NATIVE_LINE.small+S.rowTop};
    });
  };
  let rowWidth=area.width-16,rows=rowsFor(rowWidth);
  if(rows.reduce((sum,entry)=>sum+entry.height,0)<=relationsHeight){rowWidth=area.width;rows=rowsFor(rowWidth);}
  const content=rows.reduce((sum,entry)=>sum+entry.height,0)+(rows.length?30:0);
  builder.region('relations',area.x,area.y,area.width,relationsHeight,content);
  const c=socialColumnWidths(rowWidth);let y=0;
  for(const {row,height} of rows){
    const top=y+S.rowTop,x0=5,x1=x0+c.relations,x2=x1+c.label,x3=x2+c.mine,x4=x3+c.his;
    wrapCardText(row.relations,c.relations,measure).forEach((line,i)=>builder.label(x0,top+i*NATIVE_LINE.small,c.relations,line,{region:'relations',ink:NATIVE_INK.relation}));
    wrapCardText(row.name,c.label,measure).forEach((line,i)=>builder.label(x1,top+i*NATIVE_LINE.small,c.label,line,{region:'relations'}));
    if(row.mine!==undefined)builder.label(x2,top,c.mine,signedInteger(row.mine),{region:'relations',ink:opinionInk(row.mine)});
    if(row.his!==undefined)builder.label(x3,top,c.his,`(${signedInteger(row.his)})`,{region:'relations',ink:opinionInk(row.his,.55)});
    builder.label(x4,top,c.situation,row.situation,{region:'relations',ink:NATIVE_INK.relation,truncate:true});
    builder.target({id:'social:'+row.id,x:0,y,w:rowWidth,h:height,hint:row.hint,control:row.select,region:'relations',highlight:true});
    y+=height;
  }
  // The interaction log under the rule.
  const logRowWidth=area.width-16,textWidth=logRowWidth-S.textX-10+0;
  const entries=spec.interactions.slice(0,S.maxEntries).map(entry=>{const lines=wrapCardText(entry.text,textWidth+1,measure);return {entry,lines,height:Math.max(S.imageHeight,lines.length*NATIVE_LINE.small)};});
  builder.region('interactions',area.x,logTop,area.width,logHeight,entries.reduce((sum,item)=>sum+item.height,0));
  let logY=0;
  for(const {entry,lines,height} of entries){
    lines.forEach((line,i)=>builder.label(S.textX,logY+i*NATIVE_LINE.small,textWidth,line,{region:'interactions',ink:entry.faded?NATIVE_INK.relation:NATIVE_INK.text,h:Math.max(NATIVE_LINE.small,height/lines.length)}));
    builder.target({id:'interaction:'+entry.id,x:S.textX,y:logY,w:textWidth,h:height,hint:entry.hint,region:'interactions',highlight:true});
    logY+=height;
  }
  return builder.card();
}

export type LogLineSpec={kind:'header';text:string}|{kind:'gap';height:number}|{kind:'entry';id:string;text:string;hint:string};
export interface LogSpec {
  type:'log';toggles:readonly {id:string;label:string;x:number;width:number;on:boolean;control:NativeControl}[];copy:NativeControl;lines:readonly LogLineSpec[];emptyText:string;
}
export const LOG_SIZE={width:630,height:510,toolbarY:2,toolbarHeight:24,pad:10,textX:29,imageHeight:26,battleGap:20,alternate:.03} as const;
export function layoutLogTab(spec:LogSpec,measure:CardMeasure):NativeTabCard{
  const L=LOG_SIZE,builder=new CardBuilder(L.width,L.height,measure);
  for(const toggle of spec.toggles){
    builder.label(toggle.x,L.toolbarY,toggle.width-24,toggle.label,{h:L.toolbarHeight,truncate:true});
    builder.glyph('check',toggle.x+toggle.width-24,L.toolbarY,24,24,{on:toggle.on});
    builder.target({id:'log-toggle:'+toggle.id,x:toggle.x,y:L.toolbarY,w:toggle.width,h:L.toolbarHeight,hint:toggle.control.hint,control:toggle.control,highlight:true});
  }
  builder.glyph('copy',L.width-60,0,18,24);
  builder.target({id:'log-copy',x:L.width-60,y:0,w:18,h:24,hint:spec.copy.hint,control:spec.copy,highlight:true});
  const area={x:L.pad,y:24+L.pad,width:L.width-L.pad*2,height:L.height-24-L.pad*2},width=area.width-16-10+0;
  if(!spec.lines.length){builder.text(0,0,L.width,L.height,spec.emptyText,{ink:NATIVE_INK.none,align:'center'});return builder.card();}
  let y=0,alternate=false;const placed:{y:number;h:number;spec:LogLineSpec;lines:string[]}[]=[];
  for(const line of spec.lines){
    if(line.kind==='gap'){placed.push({y,h:line.height,spec:line,lines:[]});y+=line.height;continue;}
    if(line.kind==='header'){const lines=wrapCardText(line.text,width,measure,'medium');const h=lines.length*30;placed.push({y,h,spec:line,lines});y+=h;continue;}
    const lines=wrapCardText(line.text,width-L.textX,measure),h=Math.max(L.imageHeight,lines.length*NATIVE_LINE.small+4);placed.push({y,h,spec:line,lines});y+=h;
  }
  builder.region('log',area.x,area.y,area.width,area.height,y);
  for(const item of placed){
    if(item.spec.kind==='header')item.lines.forEach((line,i)=>builder.text(0,item.y+i*30,width,30,line,{role:'medium',region:'log'}));
    else if(item.spec.kind==='entry'){
      if(alternate)builder.fill(0,item.y,width,item.h,NATIVE_INK.rowAlt,'log');
      alternate=!alternate;
      item.lines.forEach((line,i)=>builder.label(L.textX,item.y+2+i*NATIVE_LINE.small,width-L.textX,line,{region:'log'}));
      builder.target({id:'log:'+item.spec.id,x:0,y:item.y,w:width,h:item.h,hint:item.spec.hint,region:'log',highlight:true});
    }
  }
  return builder.card();
}
