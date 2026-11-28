import type {NativeControl} from './native-contract';
import {CardBuilder,type CardMeasure,type NativeTabCard} from './native-tab-card';
import {NATIVE_INK,NATIVE_LINE} from './native-ui-scale';

/** The Gear tab (RimWorld `ITab_Pawn_Gear`). Core facts: 460 × 450 (taller when
 * the content is: `min(curY + 70, screen − 35 − 165 − 30)`); the area starts 20
 * down, contracted by 10, in a scroll view 16 narrower; lines of 22 (« Masse
 * portée », « Plage de température confortable »), `Widgets.ListSeparator`
 * (label 0.8 grey, rule 0.3 grey: 3 + 20 + 2) before « Armure globale »
 * (« Tranchant », « Contondant », « Chaleur »: label cut at 120, value after),
 * « Équipement », « Vêtements » and « Inventaire »; every thing is a row of
 * 28 with the icon at x = 4, the label at x = 36, the mass in a column of 60 on
 * the right (right-aligned), the ingest and drop buttons of 24 before it and the
 * info-card button of 24 last. */
export interface GearRowSpec {id:string;label:string;icon?:string;grams?:number;hint:string;info?:NativeControl;drop?:NativeControl;ingest?:NativeControl}
export interface GearSectionSpec {id:string;label:string;rows:readonly GearRowSpec[]}
export interface GearSpec {
  type:'gear';mass?:{text:string;hint:string};comfort?:{text:string;hint:string};armor?:readonly {id:string;label:string;value:string}[];
  sections:readonly GearSectionSpec[];
  /** Lines Elsewhere keeps that RimWorld does not have as rows (lost weapon, forced outfit). */
  extras:readonly {id:string;label:string;control:NativeControl;hint:string}[];
  /** Elsewhere's portrait and its clothing toggle sit at the top right. */
  portrait?:{control:NativeControl;visible:boolean};
  /** Core's gear tab is 450 tall at least; this is the screen's bound. */
  maxHeight:number;
}
export const GEAR_SIZE={width:460,height:450,top:20,pad:10,scrollbar:16,row:28,icon:28,labelX:36,massWidth:60,button:24} as const;
/** Mass as `MassUtility` prints it: kilograms, at most two decimals. */
export function gearMassLabel(grams:number):string{return `${Number((grams/1000).toFixed(2))} kg`;}
export const GEAR_PORTRAIT={width:92,height:128,reserve:100} as const;
export function layoutGearTab(spec:GearSpec,measure:CardMeasure):NativeTabCard{
  const G=GEAR_SIZE,viewWidth=G.width-G.pad*2,inner=viewWidth-G.scrollbar,region='gear';
  // Elsewhere's portrait (and its toggle) use the top right of the first lines.
  const portraitBottom=spec.portrait?GEAR_PORTRAIT.height+34:0;
  const widthAt=(y:number)=>y<portraitBottom?inner-GEAR_PORTRAIT.reserve:inner;
  const builder=new CardBuilder(G.width,G.height,measure);
  let y=0;
  const line=(id:string,text:string,hint:string)=>{builder.label(0,y,widthAt(y),text,{region,truncate:true});builder.target({id,x:0,y,w:widthAt(y),h:NATIVE_LINE.small,hint,region,highlight:true});y+=NATIVE_LINE.small;};
  if(spec.mass)line('gear-mass',spec.mass.text,spec.mass.hint);
  if(spec.comfort)line('gear-comfort',spec.comfort.text,spec.comfort.hint);
  const separator=(label:string)=>{y+=3;const width=widthAt(y);builder.text(0,y,width,20,label,{region,ink:NATIVE_INK.sectionTitle,v:'top'});y+=20;builder.line(0,y,width,NATIVE_INK.line,region);y+=2;};
  if(spec.armor?.length){
    separator('Armure globale');
    for(const armor of spec.armor){builder.label(0,y,120,armor.label,{region,truncate:true});builder.label(120,y,widthAt(y)-120,armor.value,{region});y+=NATIVE_LINE.small;}
  }
  for(const section of spec.sections){
    // Core shows the three sections of a humanlike even when they are empty (ShouldShowEquipment/Apparel/Inventory).
    separator(section.label);
    for(const row of section.rows){
      const rowWidth=widthAt(y);let right=rowWidth;
      if(row.info){right-=G.button;builder.glyph('info',right,y,G.button,G.button,{region});builder.target({id:'gear-info:'+row.id,x:right,y,w:G.button,h:G.button,hint:row.info.hint,control:row.info,region});}
      if(row.drop){right-=G.button;builder.glyph('drop',right,y,G.button,G.button,{region,disabled:row.drop.disabled});builder.target({id:'gear-drop:'+row.id,x:right,y,w:G.button,h:G.button,hint:row.drop.hint,control:row.drop,region});}
      if(row.ingest){right-=G.button;builder.glyph('ingest',right,y,G.button,G.button,{region});builder.target({id:'gear-ingest:'+row.id,x:right,y,w:G.button,h:G.button,hint:row.ingest.hint,control:row.ingest,region});}
      if(row.grams!==undefined){right-=G.massWidth;builder.label(right,y,G.massWidth,gearMassLabel(row.grams),{region,align:'right',ink:NATIVE_INK.subtle,h:G.row});}
      const labelWidth=Math.max(20,right-G.labelX);
      builder.glyph('item',4,y,G.icon,G.icon,{region,itemIcon:row.icon??'stockpile'});
      builder.label(G.labelX,y,labelWidth,row.label,{region,truncate:true,h:G.row});
      builder.target({id:'gear-row:'+row.id,x:0,y,w:right,h:G.row,hint:row.hint,region,highlight:true});
      y+=G.row;
    }
  }
  for(const extra of spec.extras){
    const width=widthAt(y);builder.label(G.labelX,y,Math.max(1,width-G.labelX-120),extra.label,{region,truncate:true,h:G.row});
    builder.button(width-116,y+2,116,24,extra.control.label,{region,disabled:extra.control.disabled});
    builder.target({id:'gear-extra:'+extra.id,x:width-116,y:y+2,w:116,h:24,hint:extra.hint,control:extra.control,region});y+=G.row;
  }
  const content=Math.max(y,portraitBottom)+G.pad,top=G.top,view={x:G.pad,y:top+G.pad,w:viewWidth,h:G.height-top-G.pad*2};
  // Core starts at 450. Fit the possessions and the portrait instead, with a
  // real viewport bound even when the screen is shorter than that initial size.
  builder.height=Math.max(top+G.pad*2+NATIVE_LINE.small,Math.min(content+top+G.pad*2,spec.maxHeight));view.h=builder.height-top-G.pad*2;
  builder.region(region,view.x,view.y,view.w,view.h,content);
  if(spec.portrait){
    const x=inner-GEAR_PORTRAIT.width,y0=GEAR_PORTRAIT.height+4;
    builder.glyph('check',x,y0,24,24,{on:spec.portrait.visible,region});
    builder.label(x+26,y0,GEAR_PORTRAIT.width-26,'Vêtements',{h:24,role:'tiny',region});
    builder.target({id:'gear-clothing',x,y:y0,w:GEAR_PORTRAIT.width,h:24,hint:spec.portrait.control.hint,control:spec.portrait.control,region,highlight:true});
  }
  return builder.card();
}
/** Where the portrait is drawn on the tab (the stage draws the picture). */
export function gearPortraitRect(card:NativeTabCard):{x:number;y:number;width:number;height:number}{
  const region=card.regions[0]!;return {x:region.x+region.w-GEAR_SIZE.scrollbar-GEAR_PORTRAIT.width,y:region.y,width:GEAR_PORTRAIT.width,height:GEAR_PORTRAIT.height};
}
