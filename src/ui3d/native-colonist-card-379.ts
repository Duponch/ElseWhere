import {NATIVE_TEXT,NATIVE_INK} from './native-ui-scale';
import {PALETTE,drawHandBlob,drawHandRect} from './prototype-art';
import {drawColonistBarState346} from './native-colonist-bar-346';
import type {ColonistBarState346} from '../ui/colonist-bar-state-346';

export interface NativeColonistCardInk379 {
 name:string;mood:number;selected:boolean;skin:string;shirt:string;loaded:boolean;image?:CanvasImageSource;bar?:ColonistBarState346;
}
export interface ColonistInkBounds379 {left:number;top:number;right:number;bottom:number}
const FONT='"Comic Sans MS", "Chalkboard SE", Georgia, serif';
const NAME_FONT=`bold ${NATIVE_TEXT.small}px ${FONT}`;
export const COLONIST_CARD_BANDS379=6;

/** Ordered, independent ink stages. The sheet can omit a stage which cannot
 * touch the copied region, but must still advance its exact original jitter
 * stream. These operations are the literal painter, never a separate image. */
export function drawNativeColonistBand379(col:NativeColonistCardInk379,ctx:CanvasRenderingContext2D,rng:()=>number,band:number):void {
 const originalPaper=PALETTE.creamPaper==='#f3ead6'&&PALETTE.inkDark==='#261e18';
 switch(band){
  case 0:drawHandRect(ctx,0,0,70,96,col.selected?PALETTE.ochre:PALETTE.kraftBase,PALETTE.inkDark,1.4,rng);break;
  case 1:
   drawHandRect(ctx,6,6,58,54,originalPaper?(col.selected?'#d8e4c4':'#b2c4ab'):(col.selected?PALETTE.sageMountain:PALETTE.kraftLight),PALETTE.inkDark,1.2,rng);
   if(col.loaded&&col.image)ctx.drawImage(col.image,6,6,58,54);
   else{drawHandBlob(ctx,35,48,15,col.shirt,'#261e18',1,rng);drawHandBlob(ctx,35,26,11,col.skin,'#261e18',1,rng);}
   break;
  case 2:if(col.bar)drawColonistBarState346(ctx,col.bar);break;
  case 3:drawHandRect(ctx,5,63,60,15,PALETTE.creamPaper,PALETTE.inkDark,.8,rng);break;
  case 4:ctx.fillStyle=PALETTE.inkDark;ctx.font=NAME_FONT;ctx.textAlign='center';ctx.fillText(col.name,35,75,57);break;
  case 5:
   drawHandRect(ctx,10,81,50,5,originalPaper?'#423328':NATIVE_INK.barBack,null,0,rng);
   if(col.mood>0)drawHandRect(ctx,10,81,50*col.mood/100,5,col.mood>70?'#639452':'#d16b3b',null,0,rng);
   break;
 }
}

/** The original painter, with the same operations, RNG order and styles. */
export function drawNativeColonistCard379(col:NativeColonistCardInk379,ctx:CanvasRenderingContext2D,rng:()=>number):void {
 ctx.save();for(let band=0;band<COLONIST_CARD_BANDS379;band++)drawNativeColonistBand379(col,ctx,rng,band);ctx.restore();
}

/** Only these branches change the shared hand-jitter stream's consumption.
 * Actual counts are measured from the original painter, never reconstructed. */
export function colonistCardRandomShape379(col:NativeColonistCardInk379):string {
 return`${col.loaded&&col.image?'image':'fallback'}:${col.mood>0?'mood':'empty'}`;
}

/** A ten-unit halo covers the original corner jitter, marker overshoot and
 * stroke radius. Measure the actual name too: stacked Unicode accents and
 * unusual glyph bearings must not escape a dirty region. */
function nativeColonistNameBounds379(col:NativeColonistCardInk379,ctx:CanvasRenderingContext2D):ColonistInkBounds379 {
 ctx.save();ctx.font=NAME_FONT;ctx.textAlign='center';const text=ctx.measureText(col.name);ctx.restore();
 const compression=text.width>57?57/text.width:1;
 return{left:35-text.actualBoundingBoxLeft*compression-2,right:35+text.actualBoundingBoxRight*compression+2,top:75-text.actualBoundingBoxAscent-2,bottom:75+text.actualBoundingBoxDescent+2};
}
export const COLONIST_MOOD_BOUNDS379:ColonistInkBounds379={left:7,top:78,right:63,bottom:89};
export function nativeColonistBandsBounds379(col:NativeColonistCardInk379,ctx:CanvasRenderingContext2D):ColonistInkBounds379[] {
 return[
  {left:-10,top:-10,right:80,bottom:106},
  {left:-4,top:-4,right:74,bottom:70},
  // The risk border and custom activity icons are allowed their full extent.
  {left:-10,top:-10,right:80,bottom:106},
  {left:-5,top:53,right:75,bottom:88},
  nativeColonistNameBounds379(col,ctx),COLONIST_MOOD_BOUNDS379
 ];
}
export function nativeColonistCardBounds379(col:NativeColonistCardInk379,ctx:CanvasRenderingContext2D):ColonistInkBounds379 {
 const text=nativeColonistNameBounds379(col,ctx);
 return{left:Math.min(-10,text.left),right:Math.max(80,text.right),top:Math.min(-10,text.top),bottom:Math.max(106,text.bottom)};
}
