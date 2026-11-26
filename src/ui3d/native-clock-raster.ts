import {CLOCK_COLUMNS,CLOCK_ROWS,clockLabel,paintClockInk,type ClockHour,type ClockSheet} from './native-clock-ink';

const sameHour=(a:ClockHour,b:ClockHour)=>
  a.hour===b.hour&&a.date===b.date&&a.width===b.width&&a.height===b.height;

function identicalRgba(a:Uint8ClampedArray,b:Uint8ClampedArray):boolean {
  const left=new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4);
  const right=new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);
  for(let i=0;i<left.length;i++)if(left[i]!==right[i])return false;
  return true;
}

/** The worker produces source artwork only. Confirmed HUD data selects an
 * exact cell synchronously. No worker response can redraw the visible HUD. */
export class NativeClockRaster {
  private worker?:Worker;
  private disabled=false;
  private sheet?:ClockSheet;
  private verified?:Pick<ClockHour,'date'|'width'|'height'>;
  private requested?:ClockHour;
  private pending=false;
  readonly stats={hits:0,direct:0,sheets:0};

  draw(ctx:CanvasRenderingContext2D,width:number,height:number,minute:number,date:string,running=true):void {
    const hour=Math.floor(minute/60);
    const sheet=this.sheet;
    if(sheet&&sheet.hour===hour&&sheet.date===date&&sheet.width===width&&sheet.height===height){
      // A load or rewind can return to the current sheet while a different
      // hour is in flight. Keep the owner's latest demand in that case too.
      this.requested=sheet;
      const {bitmap,tileWidth:w,tileHeight:h}=sheet,index=minute%60;
      try{
        ctx.drawImage(bitmap,index%CLOCK_COLUMNS*w,Math.floor(index/CLOCK_COLUMNS)*h,w,h,sheet.left,sheet.top,w,h);
        ctx.drawImage(bitmap,0,CLOCK_ROWS*h,width,height,0,0,width,height);
        if(this.verified?.date!==date||this.verified.width!==width||this.verified.height!==height){
          // Browser font fallback and bitmap compositing can differ between
          // the page and a worker. The first actual date stays drawn locally
          // and qualifies the source against this exact destination.
          const candidate=ctx.getImageData(0,0,width,height).data;
          ctx.clearRect(0,0,width,height);
          paintClockInk(ctx,width,height,clockLabel(minute),date);
          const control=ctx.getImageData(0,0,width,height).data;
          if(identicalRgba(candidate,control))this.verified={date,width,height};
          else this.dispose();
          this.stats.direct++;
          return;
        }
      }catch{
        this.dispose();
        ctx.clearRect(0,0,width,height);
        paintClockInk(ctx,width,height,clockLabel(minute),date);
        this.stats.direct++;
        return;
      }
      this.stats.hits++;
      return;
    }
    paintClockInk(ctx,width,height,clockLabel(minute),date);
    this.stats.direct++;
    if(!running||this.disabled||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return;
    this.requested={width,height,hour,date};
    if(!this.pending)this.request();
  }

  private request():void {
    try{
      if(!this.worker){
        this.worker=new Worker(new URL('./native-clock.worker.ts',import.meta.url),{type:'module',name:'Elsewhere HUD clock'});
        this.worker.onmessage=(event:MessageEvent<ClockSheet>)=>{
          const next=event.data;
          this.pending=false;
          if(this.disabled||!this.requested){next.bitmap.close();return;}
          if(!sameHour(next,this.requested)){
            next.bitmap.close();
            if(!this.sheet||!sameHour(this.sheet,this.requested))this.request();
            return;
          }
          this.sheet?.bitmap.close();this.sheet=next;this.stats.sheets++;
        };
        this.worker.onerror=(event)=>{event.preventDefault();this.dispose();};
        this.worker.onmessageerror=()=>this.dispose();
      }
      this.pending=true;
      this.worker.postMessage(this.requested);
    }catch{this.dispose();}
  }

  dispose():void {
    this.disabled=true;this.worker?.terminate();this.worker=undefined;
    this.sheet?.bitmap.close();this.sheet=undefined;this.pending=false;this.requested=undefined;
    this.verified=undefined;
  }
}
