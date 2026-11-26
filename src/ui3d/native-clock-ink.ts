import {NATIVE_TEXT} from './native-ui-scale';

type InkContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const FAMILY = '"Comic Sans MS", "Chalkboard SE", Georgia, serif';
const RIGHT = 193;

export function clockLabel(minute:number):string {
  return `${String(Math.floor(minute/60)).padStart(2,'0')}h${String(minute%60).padStart(2,'0')}`;
}

export function paintClockInk(ctx:InkContext,w:number,h:number,time?:string,date?:string):void {
  ctx.save();
  ctx.scale(w/200,h/48);
  ctx.strokeStyle='#19242b';ctx.lineWidth=3;ctx.lineJoin='round';ctx.fillStyle='#fff8e9';ctx.textAlign='right';
  if(time!==undefined){
    ctx.font=`bold ${NATIVE_TEXT.small}px ${FAMILY}`;
    ctx.strokeText(time,RIGHT,19);ctx.fillText(time,RIGHT,19);
  }
  if(date!==undefined){
    ctx.font=`${NATIVE_TEXT.small}px ${FAMILY}`;
    ctx.strokeText(date,RIGHT,41);ctx.fillText(date,RIGHT,41);
  }
  ctx.restore();
}

export interface ClockHour {hour:number;date:string;width:number;height:number}
export interface ClockSheet extends ClockHour {
  bitmap:ImageBitmap;left:number;top:number;tileWidth:number;tileHeight:number;
}
export const CLOCK_COLUMNS=8;
export const CLOCK_ROWS=Math.ceil(60/CLOCK_COLUMNS);

/** The atlas contains the sixty actual clock strings for an hour and one
 * separate date. Only whole, unscaled device pixels are copied to the HUD. */
export function rasterClockHour(request:ClockHour):ClockSheet {
  const {hour,date,width,height}=request;
  const canvas=new OffscreenCanvas(width,height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas 2D indisponible');
  ctx.font=`bold ${NATIVE_TEXT.small}px ${FAMILY}`;ctx.textAlign='right';
  const labels=Array.from({length:60},(_,minute)=>clockLabel(hour*60+minute));
  let minX=RIGHT,minY=19,maxX=RIGHT,maxY=19;
  for(const label of labels){
    const m=ctx.measureText(label);
    minX=Math.min(minX,RIGHT-m.actualBoundingBoxLeft);maxX=Math.max(maxX,RIGHT+m.actualBoundingBoxRight);
    minY=Math.min(minY,19-m.actualBoundingBoxAscent);maxY=Math.max(maxY,19+m.actualBoundingBoxDescent);
  }
  // Half the round stroke plus antialiasing in both axes.
  const left=Math.max(0,Math.floor((minX-3)*width/200)),top=Math.max(0,Math.floor((minY-3)*height/48));
  const tileWidth=Math.min(width,Math.ceil((maxX+3)*width/200))-left;
  const tileHeight=Math.min(height,Math.ceil((maxY+3)*height/48))-top;
  ctx.font=`${NATIVE_TEXT.small}px ${FAMILY}`;
  const dateTop=Math.floor((41-ctx.measureText(date).actualBoundingBoxAscent-3)*height/48);
  // Adjacent lines can be cached separately only if their coverage is disjoint.
  if(!(tileWidth>0&&tileHeight>0&&dateTop>=top+tileHeight))throw Error('Clock font bounds overlap');
  const dateY=tileHeight*CLOCK_ROWS;
  canvas.width=Math.max(width,tileWidth*CLOCK_COLUMNS);canvas.height=dateY+height;
  for(const [index,label] of labels.entries()){
    ctx.save();
    ctx.translate(index%CLOCK_COLUMNS*tileWidth-left,Math.floor(index/CLOCK_COLUMNS)*tileHeight-top);
    paintClockInk(ctx,width,height,label);
    ctx.restore();
  }
  ctx.save();ctx.translate(0,dateY);paintClockInk(ctx,width,height,undefined,date);ctx.restore();
  return {...request,bitmap:canvas.transferToImageBitmap(),left,top,tileWidth,tileHeight};
}
