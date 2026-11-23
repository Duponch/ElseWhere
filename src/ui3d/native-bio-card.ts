import type {NativeControl} from './native-contract';
import {NATIVE_CHIP,NATIVE_INK,NATIVE_LINE,NATIVE_TEXT,type NativeTextRole} from './native-ui-scale';
import {drawHandRect} from './prototype-art';

/** The Bio card (RimWorld `CharacterCardUtility.DrawCharacterCard`, the
 * « Personnage » inspector tab and the new-game pawn page). Pure layout first:
 * every rectangle is in card points, computed once per change of the card
 * (selection, trait, skill), then painted on the page's ink plane with no
 * per-frame search. Tooltips are hit planes over the returned rectangles. */
export interface NativeBioChip {id:string;label:string;hint:string;ink?:'text'|'subtle'|'royal';onActivate?:()=>void;
  /** Faction chip: the colour of its 20 × 20 icon. */
  color?:string}
export interface NativeBioSkill {id:string;label:string;level:number;passion:0|1|2;disabled:boolean;hint:string}
export interface NativeBioCard {
  /** Omitted: no name zone (`showName` false), as on the new-game page whose
   * name has its own field. */
  name?:string;
  /** 30 × 30 buttons, right to left from x = width − 85, 40 apart. */
  buttons?:readonly NativeControl[];
  /** `Pawn.MainDesc`: « Homme, 37 ans (93) »; the age details in its tooltip. */
  description:{label:string;hint:string};
  faction?:NativeBioChip;
  /** Childhood then adulthood (Core's two `BackstorySlot`s). */
  stories:readonly {phase:string;chip:NativeBioChip}[];
  traits:readonly NativeBioChip[];
  /** Tooltip of the « Traits » title (profile effects kept from the old card). */
  traitsHint?:string;
  incapable:readonly NativeBioChip[];
  skills:readonly NativeBioSkill[];
  /** `Page_ConfigureStartingPawns`: the top stack leaves room for the portrait. */
  creation?:boolean;
}
export interface BioRect {x:number;y:number;width:number;height:number}
export interface BioChipBox {rect:BioRect;item:NativeBioChip;align:'center'|'left'}
export interface BioSkillBox {row:BioRect;label:BioRect;icon:BioRect;bar?:BioRect;fill:number;number:BioRect;item:NativeBioSkill}
export interface NativeBioLayout {
  width:number;height:number;
  name?:BioRect;
  buttons:{control:NativeControl;rect:BioRect}[];
  description:{rect:BioRect;label:string;hint:string};
  faction?:BioChipBox;
  /** Top of both columns (87 for a plain colonist). */
  columnsTop:number;
  left:BioRect;right:BioRect;
  /** Calculated heights of the three left sections, Core's share algorithm. */
  sections:number[];
  /** True only when even the minimum heights overflow (Core then scrolls). */
  overflow:boolean;
  storyLabels:{rect:BioRect;text:string}[];
  chips:BioChipBox[];
  titles:{rect:BioRect;text:string;hint?:string}[];
  nones:BioRect[];
  skills:BioSkillBox[];
}
export type BioMeasure=(text:string,role:NativeTextRole,bold?:boolean)=>number;
/** `CharacterCardUtility.BasePawnCardSize` and the 17-point margin of the
 * « Personnage » tab around it (`ITab_Pawn_Character`). */
export const NATIVE_BIO_SIZE={width:480,height:455,tabMargin:17,left:250,right:258,skillWidth:230,skillHeight:24,skillPitch:27} as const;
const row=NATIVE_CHIP.height;
interface StackItem {width:number;index:number}
/** `GenUI.DrawElementStack`: rows of `rowHeight`, wrapping when the next element
 * would pass the width. With order optimisation Core picks, while the first
 * row fills, the widest element that still fits (wider than the head of the
 * list); the rest keeps its order. Returns positions and the used height. */
export function nativeElementStack(widths:readonly number[],width:number,rowHeight:number,rowMargin:number=NATIVE_CHIP.rowMargin,itemMargin:number=NATIVE_CHIP.itemMargin,reorder=false):{rects:BioRect[];height:number;order:number[]}{
  let list:StackItem[]=widths.map((w,index)=>({width:w,index}));
  if(reorder){
    const picked:StackItem[]=[];let used=0;
    while(list.length){
      let best=0;
      for(let j=0;j<list.length;j++)if(list[best]!.width<list[j]!.width&&list[j]!.width<width-used)best=j;
      used+=list[best]!.width+itemMargin;picked.push(list[best]!);list.splice(best,1);
    }
    list=picked;
  }
  const rects:BioRect[]=new Array(widths.length);let x=0,y=0;
  for(const item of list){
    if(x+item.width>width){x=0;y+=rowHeight+rowMargin;}
    rects[item.index]={x,y,width:item.width,height:rowHeight};x+=item.width+itemMargin;
  }
  return {rects,height:y+rowHeight,order:list.map(item=>item.index)};
}
/** `GenUI.DrawElementStackVertical`: columns of `height`, each element placed
 * after the accumulated width of its row index. */
export function nativeElementStackVertical(widths:readonly number[],height:number,rowHeight:number,itemMargin:number=NATIVE_CHIP.itemMargin):{rects:BioRect[];width:number}{
  const space:number[]=[],rects:BioRect[]=[];let index=0,y=0,used=0;
  for(const w of widths){
    if(y+rowHeight>height){y=0;index=0;}
    rects.push({x:space[index]??0,y,width:w,height:rowHeight});
    y+=rowHeight+itemMargin;space[index]=(space[index]??0)+w+itemMargin;used=Math.max(used,space[index]!);index++;
  }
  return {rects,width:used};
}
/** Elsewhere adaptation: a chip never passes the left column (French titles in
 * the default font are wider than Core's English ones); the full text stays in
 * its tooltip and the label is ellipsised like Core's `Truncate`. */
const STORY_CHIP_MAX=NATIVE_BIO_SIZE.left-90-NATIVE_CHIP.itemMargin;
export function layoutNativeBioCard(card:NativeBioCard,measure:BioMeasure):NativeBioLayout{
  const {width,height,left:leftWidth}=NATIVE_BIO_SIZE;
  const nameHeight=card.name!==undefined?30:0;
  const buttons=(card.buttons??[]).map((control,index)=>({control,rect:{x:width-85-40*index,y:0,width:30,height:30}}));
  const name=card.name!==undefined?{x:0,y:0,width:Math.max(60,(buttons.at(-1)?.rect.x??width)-4),height:30}:undefined;
  // DoTopStack: one stack of 22 at y = name + 10; +10 after it, +15 more when it
  // used less than 78 (the rows then start at 87 for a plain colonist).
  const start=nameHeight+10,stackWidth=width-10-(card.creation?20+92:0);
  const items=[measure(card.description.label,'small')+5,...(card.faction?[measure(card.faction.label,'small')+22+15]:[])];
  const top=nativeElementStack(items,stackWidth,row);
  let y=start+top.height+10;if(y-start<78)y+=15;
  const description={rect:{...top.rects[0]!,y:start+top.rects[0]!.y},label:card.description.label,hint:card.description.hint};
  const faction:BioChipBox|undefined=card.faction?{rect:{...top.rects[1]!,y:start+top.rects[1]!.y},item:card.faction,align:'left'}:undefined;
  const left:BioRect={x:0,y,width:leftWidth,height:height-y},right:BioRect={x:leftWidth,y,width:NATIVE_BIO_SIZE.right,height:height-y};
  // DoLeftSection: minimum heights, then equal shares of the column.
  const chipWidth=(item:NativeBioChip)=>measure(item.label,'small')+NATIVE_CHIP.textPad;
  const traitStack=nativeElementStack(card.traits.map(chipWidth),leftWidth-5,row);
  const incapableWidths=card.incapable.map(chipWidth),incapableMeasure=nativeElementStack(incapableWidths,leftWidth-5,row);
  const minimum=[2*row,30+(card.traits.length?traitStack.height:row),30+(card.incapable.length?incapableMeasure.height+12:row)];
  const share=left.height/minimum.length;let excess=0;
  const sizes=minimum.map(value=>{if(value>share){excess+=value-share;return value;}return share;});
  let overflow=false;
  if(excess>0){const first=minimum[0]!+12;excess-=sizes[0]!-first;sizes[0]=first;}
  while(excess>0){
    let shrunk=false;
    for(let index=0;index<sizes.length&&excess>0;index++)if(sizes[index]!-minimum[index]!>0){sizes[index]=sizes[index]!-1;excess-=1;shrunk=true;}
    if(shrunk)continue;
    sizes.forEach((_,index)=>sizes[index]=index?Math.max(minimum[index]!,share):minimum[index]!+22);overflow=true;break;
  }
  const chips:BioChipBox[]=[],titles:NativeBioLayout['titles']=[],nones:BioRect[]=[],storyLabels:NativeBioLayout['storyLabels']=[];
  let sectionTop=y;
  // Section 1: one 22 row per story, chip at x 90, step 26.
  let storyY=sectionTop;
  for(const story of card.stories){
    storyLabels.push({rect:{x:0,y:storyY,width:leftWidth,height:row},text:story.phase});
    chips.push({rect:{x:90,y:storyY,width:Math.min(STORY_CHIP_MAX,chipWidth(story.chip)),height:row},item:story.chip,align:'center'});
    storyY+=row+4;
  }
  sectionTop+=sizes[0]!;
  // Section 2: « Traits » title (200 × 30), stack 24 below.
  titles.push({rect:{x:0,y:sectionTop,width:200,height:30},text:'Traits',hint:card.traitsHint});
  if(card.traits.length)traitStack.rects.forEach((rect,index)=>chips.push({rect:{...rect,y:sectionTop+24+rect.y},item:card.traits[index]!,align:'left'}));
  else nones.push({x:0,y:sectionTop+24,width:leftWidth,height:24});
  sectionTop+=sizes[1]!;
  // Section 3: « Incapable de » (200 × 24); one column when every chip fits
  // stacked in it, else rows with Core's order optimisation (row margin 5).
  titles.push({rect:{x:0,y:sectionTop,width:200,height:24},text:'Incapable de'});
  if(card.incapable.length){
    const drawHeight=left.height/4,vertical=nativeElementStackVertical(incapableWidths,incapableMeasure.height,row).width<=leftWidth;
    const rects=vertical?nativeElementStackVertical(incapableWidths,drawHeight,row).rects:nativeElementStack(incapableWidths,leftWidth-5,row,5,NATIVE_CHIP.itemMargin,true).rects;
    rects.forEach((rect,index)=>chips.push({rect:{...rect,y:sectionTop+24+rect.y},item:card.incapable[index]!,align:'left'}));
  }else nones.push({x:0,y:sectionTop+24,width:leftWidth,height:24});
  // SkillUI.DrawSkillsOf: the longest label of the game measured once, rows of
  // 230 × 24 every 27; passion icon after the label, bar to the row's end
  // (fill = level / 20, at least 1 %), level 4 to the right of the icon.
  const labelWidth=Math.max(0,...card.skills.map(skill=>measure(skill.label,'small')));
  const skills=card.skills.map((item,index):BioSkillBox=>{
    const rowRect={x:leftWidth,y:y+index*NATIVE_BIO_SIZE.skillPitch,width:NATIVE_BIO_SIZE.skillWidth,height:NATIVE_BIO_SIZE.skillHeight};
    const label={x:rowRect.x+6,y:rowRect.y,width:labelWidth+6,height:rowRect.height};
    const icon={x:label.x+label.width,y:rowRect.y,width:24,height:24};
    const bar=item.disabled?undefined:{x:icon.x+24,y:rowRect.y,width:rowRect.x+rowRect.width-(icon.x+24),height:rowRect.height};
    return {row:rowRect,label,icon,bar,fill:Math.max(.01,item.level/20),number:{x:icon.x+24+4,y:rowRect.y+3,width:60,height:rowRect.height-3},item};
  });
  return {width,height,name,buttons,description,faction,columnsTop:y,left,right,sections:sizes,overflow,storyLabels,chips,titles,nones,skills};
}
/** Every rectangle that carries a tooltip or an action, in card points. */
export function nativeBioTargets(layout:NativeBioLayout):{id:string;rect:BioRect;hint:string;onActivate?:()=>void}[]{
  const targets:{id:string;rect:BioRect;hint:string;onActivate?:()=>void}[]=[{id:'bio-description',rect:layout.description.rect,hint:layout.description.hint}];
  if(layout.faction)targets.push({id:layout.faction.item.id,rect:layout.faction.rect,hint:layout.faction.item.hint,onActivate:layout.faction.item.onActivate});
  for(const chip of layout.chips)targets.push({id:chip.item.id,rect:chip.rect,hint:chip.item.hint,onActivate:chip.item.onActivate});
  for(const title of layout.titles)if(title.hint)targets.push({id:'bio-title-'+title.text,rect:title.rect,hint:title.hint});
  for(const skill of layout.skills)targets.push({id:skill.item.id,rect:skill.row,hint:skill.item.hint});
  return targets;
}
export interface BioPainter {font:(role:NativeTextRole,bold?:boolean)=>string;measure:BioMeasure;rng:()=>number}
function ellipsis(text:string,width:number,measure:BioMeasure):string{
  if(measure(text,'small')<=width)return text;
  const chars=Array.from(text);while(chars.length&&measure(chars.join('')+'…','small')>width)chars.pop();return chars.join('').trimEnd()+'…';
}
/** One small (passion) or two (burning passion) flames in a 24 × 24 square,
 * in Elsewhere's paint: ochre body, yellow heart, brown outline. */
export function drawNativePassion(ctx:CanvasRenderingContext2D,x:number,y:number,passion:1|2):void{
  const flame=(cx:number,base:number,h:number)=>{
    const w=h*.62,path=new Path2D();
    path.moveTo(cx,base-h);path.bezierCurveTo(cx+w*.15,base-h*.62,cx+w*.62,base-h*.52,cx+w*.5,base-h*.22);
    path.bezierCurveTo(cx+w*.45,base,cx-w*.45,base,cx-w*.5,base-h*.22);path.bezierCurveTo(cx-w*.58,base-h*.46,cx-w*.12,base-h*.55,cx,base-h);path.closePath();
    ctx.fillStyle='#d9772b';ctx.fill(path);ctx.lineWidth=1;ctx.strokeStyle='#7a3b12';ctx.stroke(path);
    const heart=new Path2D();heart.moveTo(cx,base-h*.55);heart.bezierCurveTo(cx+w*.3,base-h*.3,cx+w*.25,base-h*.06,cx,base-h*.06);heart.bezierCurveTo(cx-w*.25,base-h*.06,cx-w*.3,base-h*.3,cx,base-h*.55);
    ctx.fillStyle='#f3c24f';ctx.fill(heart);
  };
  ctx.save();
  if(passion===2){flame(x+9,y+20,17);flame(x+16,y+21,13);}else flame(x+12,y+19,13);
  ctx.restore();
}
/** Paints the card at its origin (ox, oy) of the page's ink plane. */
export function paintNativeBioCard(ctx:CanvasRenderingContext2D,layout:NativeBioLayout,card:NativeBioCard,ox:number,oy:number,paint:BioPainter):void{
  const middle=(rect:BioRect,role:NativeTextRole='small')=>oy+rect.y+rect.height/2+NATIVE_TEXT[role]*.36;
  ctx.save();ctx.textAlign='left';
  if(layout.name&&card.name!==undefined){ctx.font=paint.font('medium');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(card.name,ox,oy+NATIVE_TEXT.medium+2,layout.name.width);}
  ctx.font=paint.font('small');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(layout.description.label,ox+layout.description.rect.x,middle(layout.description.rect));
  const chip=(box:BioChipBox,color:string|null)=>{
    const r=box.rect;drawHandRect(ctx,ox+r.x,oy+r.y,r.width,r.height,NATIVE_INK.chipFill,NATIVE_INK.chipEdge,.8,paint.rng);
    if(color===null)return;
    ctx.font=paint.font('small');ctx.fillStyle=color;
    if(box.align==='center'){const text=ellipsis(box.item.label,r.width-NATIVE_CHIP.textInset*2,paint.measure);ctx.textAlign='center';ctx.fillText(text,ox+r.x+r.width/2,middle(r));ctx.textAlign='left';}
    else ctx.fillText(ellipsis(box.item.label,r.width-NATIVE_CHIP.textInset*2,paint.measure),ox+r.x+NATIVE_CHIP.textInset,middle(r));
  };
  if(layout.faction){
    const r=layout.faction.rect;chip(layout.faction,null);
    // Faction icon of 20 × 20 at (1, 1): the colony's colour on a small banner.
    ctx.fillStyle=layout.faction.item.color??'#7d6a45';ctx.beginPath();ctx.moveTo(ox+r.x+5,oy+r.y+4);ctx.lineTo(ox+r.x+17,oy+r.y+4);ctx.lineTo(ox+r.x+17,oy+r.y+15);ctx.lineTo(ox+r.x+11,oy+r.y+11);ctx.lineTo(ox+r.x+5,oy+r.y+15);ctx.closePath();ctx.fill();
    ctx.strokeStyle=NATIVE_INK.text;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=NATIVE_INK.text;ctx.fillText(ellipsis(layout.faction.item.label,r.width-r.height-10,paint.measure),ox+r.x+r.height+5,middle(r));
  }
  for(const label of layout.storyLabels){ctx.font=paint.font('small');ctx.fillStyle=NATIVE_INK.text;ctx.fillText(label.text,ox+label.rect.x,middle(label.rect),88);}
  for(const box of layout.chips)chip(box,box.item.ink==='subtle'?NATIVE_INK.subtle:box.item.ink==='royal'?NATIVE_INK.royal:NATIVE_INK.text);
  for(const title of layout.titles){ctx.font=paint.font('small');ctx.fillStyle=NATIVE_INK.sectionTitle;ctx.fillText(title.text,ox+title.rect.x,oy+title.rect.y+NATIVE_LINE.small/2+NATIVE_TEXT.small*.36);}
  for(const none of layout.nones){ctx.font=paint.font('small');ctx.fillStyle=NATIVE_INK.none;ctx.fillText('Aucun',ox+none.x,oy+none.y+NATIVE_LINE.small/2+NATIVE_TEXT.small*.36);}
  for(const skill of layout.skills){
    ctx.font=paint.font('small');ctx.fillStyle=skill.item.disabled?NATIVE_INK.disabled:NATIVE_INK.text;
    ctx.fillText(skill.item.label,ox+skill.label.x,middle(skill.label),skill.label.width);
    if(skill.bar){ctx.fillStyle=NATIVE_INK.skillFill;ctx.fillRect(ox+skill.bar.x,oy+skill.bar.y,skill.bar.width*skill.fill,skill.bar.height);}
    if(!skill.item.disabled&&skill.item.passion)drawNativePassion(ctx,ox+skill.icon.x,oy+skill.icon.y,skill.item.passion);
    ctx.font=paint.font('small');ctx.fillStyle=skill.item.disabled?NATIVE_INK.disabled:NATIVE_INK.text;
    ctx.fillText(skill.item.disabled?'-':String(skill.item.level),ox+skill.number.x,middle(skill.number));
  }
  ctx.restore();
}
