import {seededRandom} from './prototype-art';
import {COLONIST_CARD_BANDS379,colonistCardRandomShape379,drawNativeColonistBand379,drawNativeColonistCard379,nativeColonistBandsBounds379,type NativeColonistCardInk379} from './native-colonist-card-379';

export interface NativeColonistRasterPlacement379 {id:number;key:string;x:number;y:number;sx:number;sy:number;card:NativeColonistCardInk379}
type Rect={x:number;y:number;width:number;height:number};
type CardCapture={id:number;key:string;image:CanvasImageSource|undefined;imageSource:string;loaded:boolean;randomShape:string;start:number;calls:number;bandCalls:number[];bounds:Rect;bands:Rect[];x:number;y:number;sx:number;sy:number;name:string;mood:number;otherInk:string};
const intersects=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const finiteRect=(r:Rect)=>[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>=0&&r.height>=0;
const sameRect=(a:Rect,b:Rect)=>a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
const unionRect=(a:Rect,b:Rect):Rect=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};

/** Retain the final sheet order, not independently composited card bitmaps.
 * Canvas clipping of fractional antialiased paths is not byte-equivalent to an
 * unclipped paint. A scratch sheet of the same dimensions and raster mode
 * receives all intersecting cards at their exact original transforms, in
 * order; only aligned unscaled rectangles of final pixels are copied back.
 * The source texture, meshes, hit planes and redraw cadence stay with the HUD. */
export class NativeColonistBarRaster379 {
 private context:CanvasRenderingContext2D|undefined;
 private scratch:CanvasRenderingContext2D|undefined;
 private width=0;
 private height=0;
 private scale=0;
 private layout='';
 private captures:CardCapture[]=[];
 readonly stats={fullPaints:0,partialPaints:0,cardPaints:0,bandPaints:0,portraitPaints:0,namePaints:0,rngFallbacks:0};
 constructor(private readonly seed=4401){}
 clear():void{this.context=undefined;this.layout='';this.captures=[];this.width=this.height=this.scale=0;if(this.scratch){this.scratch.canvas.width=this.scratch.canvas.height=1;this.scratch=undefined;}}
 dispose():void{this.clear();}
 private supported(ctx:CanvasRenderingContext2D):boolean {
  if(typeof ctx.getTransform!=='function'||typeof ctx.resetTransform!=='function'||typeof ctx.getContextAttributes!=='function')return false;
  const m=ctx.getTransform();return m.a===1&&m.b===0&&m.c===0&&m.d===1&&m.e===0&&m.f===0&&ctx.globalAlpha===1&&ctx.globalCompositeOperation==='source-over'&&ctx.filter==='none'
   &&ctx.shadowBlur===0&&ctx.shadowOffsetX===0&&ctx.shadowOffsetY===0&&/^rgba\(0,\s*0,\s*0,\s*0\)$/.test(ctx.shadowColor);
 }
 private paint(ctx:CanvasRenderingContext2D,k:number,slot:NativeColonistRasterPlacement379,rng:()=>number):void {
  // Keep the actual original transform operation order, including rounding.
  ctx.save();ctx.scale(k,k);ctx.translate(slot.x,slot.y);ctx.scale(slot.sx,slot.sy);drawNativeColonistCard379(slot.card,ctx,rng);ctx.restore();this.stats.cardPaints++;this.stats.bandPaints+=COLONIST_CARD_BANDS379;this.stats.portraitPaints++;this.stats.namePaints++;
 }
 private region(k:number,slot:NativeColonistRasterPlacement379,w:number,h:number,r:{left:number;top:number;right:number;bottom:number}):Rect {
  const left=Math.floor(k*(slot.x+slot.sx*r.left))-1,top=Math.floor(k*(slot.y+slot.sy*r.top))-1,right=Math.ceil(k*(slot.x+slot.sx*r.right))+1,bottom=Math.ceil(k*(slot.y+slot.sy*r.bottom))+1;
  const x=Math.max(0,left),y=Math.max(0,top);return{x,y,width:Math.max(0,Math.min(w,right)-x),height:Math.max(0,Math.min(h,bottom)-y)};
 }
 private otherInk(slot:NativeColonistRasterPlacement379):string {
  const col=slot.card;return JSON.stringify([col.name,col.selected,col.skin,col.shirt,col.bar]);
 }
 private scratchFor(ctx:CanvasRenderingContext2D,w:number,h:number):CanvasRenderingContext2D|undefined {
  const compatible=(candidate:CanvasRenderingContext2D):boolean=>{
   // The HUD owns an otherwise pristine context. The fallback remains the
   // literal paint for callers with custom state instead of guessing it.
   const fields=['imageSmoothingEnabled','imageSmoothingQuality','textBaseline','direction','lineDashOffset','fontStretch','fontKerning','fontVariantCaps','letterSpacing','textRendering','wordSpacing'] as const;
   return fields.every(key=>candidate[key]===ctx[key])&&candidate.getLineDash().join()===ctx.getLineDash().join()&&JSON.stringify(candidate.getContextAttributes())===JSON.stringify(ctx.getContextAttributes());
  };
  if(this.scratch&&this.scratch.canvas.width===w&&this.scratch.canvas.height===h&&compatible(this.scratch))return this.scratch;
  const canvas=ctx.canvas.ownerDocument.createElement('canvas');canvas.width=w;canvas.height=h;
  const made=canvas.getContext('2d',ctx.getContextAttributes());
  return this.scratch=made&&compatible(made)?made:undefined;
 }
 draw(ctx:CanvasRenderingContext2D,w:number,h:number,k:number,layout:string,slots:readonly NativeColonistRasterPlacement379[],originalRng:()=>number):void {
  const direct=()=>{this.clear();ctx.clearRect(0,0,w,h);for(const slot of slots)this.paint(ctx,k,slot,originalRng);};
  if(!this.supported(ctx)||!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<=0||h<=0||!Number.isFinite(k)||k<=0){direct();return;}
  // Only immutable, already loaded portrait images participate in retention.
  if(slots.some(({card,x,y,sx,sy})=>![x,y,sx,sy,card.mood].every(Number.isFinite)||sx<=0||sy<=0||card.mood<0||card.mood>100||card.loaded&&card.image&&!(typeof HTMLImageElement!=='undefined'&&card.image instanceof HTMLImageElement&&card.image.complete&&card.image.currentSrc.startsWith('data:image/svg+xml')))){direct();return;}
  const full=this.layout!==layout||this.context!==ctx||this.width!==w||this.height!==h||this.scale!==k||this.captures.length!==slots.length||slots.some((slot,i)=>this.captures[i]?.id!==slot.id);
  const previous=this.captures,next:CardCapture[]=[],dirty:Rect[]=[];
  let suffix=false;
  for(let i=0;i<slots.length;i++){
   const slot=slots[i]!,old=previous[i],randomShape=colonistCardRandomShape379(slot.card),imageSource=slot.card.loaded?(slot.card.image as HTMLImageElement|undefined)?.currentSrc??'':'';
   if(old&&old.randomShape!==randomShape)suffix=true;
   const geometry=full||!old||old.name!==slot.card.name||old.x!==slot.x||old.y!==slot.y||old.sx!==slot.sx||old.sy!==slot.sy;
   const differs=geometry||suffix||!old||old.key!==slot.key||old.image!==slot.card.image||old.imageSource!==imageSource||old.loaded!==slot.card.loaded;
   const otherInk=differs?this.otherInk(slot):old.otherInk;
   const bands=geometry?nativeColonistBandsBounds379(slot.card,ctx).map(b=>this.region(k,slot,w,h,b)):old.bands;
   const bounds=geometry?unionRect(bands[0]!,bands[4]!):old.bounds;
   if(!finiteRect(bounds)||bands.some(b=>!finiteRect(b))){direct();return;}
   next.push({id:slot.id,key:slot.key,image:slot.card.image,imageSource,loaded:slot.card.loaded,randomShape,start:old?.start??0,calls:old?.calls??0,bandCalls:old?.bandCalls.slice()??[],bounds,bands,x:slot.x,y:slot.y,sx:slot.sx,sy:slot.sy,name:slot.card.name,mood:slot.card.mood,otherInk});
   if(differs){
    const moodOnly=!geometry&&!suffix&&old&&old.otherInk===otherInk&&old.image===slot.card.image&&old.imageSource===imageSource&&old.loaded===slot.card.loaded&&old.mood!==slot.card.mood;
    if(moodOnly)dirty.push(bands[5]!);
    else{if(old&&!sameRect(old.bounds,bounds))dirty.push(old.bounds);dirty.push(bounds);}
   }
  }
  const raster=(complete:boolean,target:CanvasRenderingContext2D):boolean=>{
   const rng=seededRandom(this.seed);let consumed=0,unexpected=false;
   target.save();target.resetTransform();
   target.clearRect(0,0,w,h);
   try{for(let i=0;i<slots.length;i++){
    const record=next[i]!,old=previous[i],start=consumed;
    if(complete||dirty.some(rect=>intersects(record.bounds,rect))){
     const slot=slots[i]!;
     target.save();target.scale(k,k);target.translate(slot.x,slot.y);target.scale(slot.sx,slot.sy);target.save();
     for(let band=0;band<COLONIST_CARD_BANDS379;band++){
      const bandStart=consumed;
      if(complete||dirty.some(rect=>intersects(record.bands[band]!,rect))){
       drawNativeColonistBand379(slot.card,target,()=>{consumed++;return rng();},band);
       this.stats.bandPaints++;if(band===1)this.stats.portraitPaints++;if(band===4)this.stats.namePaints++;
      }else for(let n=0;n<(record.bandCalls[band]??0);n++){rng();consumed++;}
      record.bandCalls[band]=consumed-bandStart;
     }
     target.restore();target.restore();this.stats.cardPaints++;const calls=consumed-start;
     if(!complete&&old&&old.start===start&&old.randomShape===record.randomShape&&old.calls!==calls)unexpected=true;
     record.start=start;record.calls=calls;
    }else{record.start=start;for(let n=0;n<record.calls;n++){rng();consumed++;}}
   }}finally{target.restore();}
   return unexpected;
  };
  if(full||dirty.reduce((area,r)=>area+r.width*r.height,0)>w*h*.55){raster(true,ctx);this.stats.fullPaints++;}
  else if(dirty.length){
   const scratch=this.scratchFor(ctx,w,h);
   if(!scratch||raster(false,scratch)){this.stats.rngFallbacks++;raster(true,ctx);this.stats.fullPaints++;}
   else{
    for(const {x,y,width,height} of dirty)if(width>0&&height>0){ctx.clearRect(x,y,width,height);ctx.drawImage(scratch.canvas,x,y,width,height,x,y,width,height);}
    this.stats.partialPaints++;
   }
  }
  this.captures=next;this.layout=layout;this.context=ctx;this.width=w;this.height=h;this.scale=k;
 }
}
