import {expect,test} from '@playwright/test';
import {build} from 'esbuild';

/** Actual Canvas2D byte oracle. This loads source modules, without starting a
 * colony, a worker or WebGPU. The reference is the pre-retention literal paint. */
for(const software of [true,false])test(`native colonist bar retains exact pixels through overlaps, shared jitter, image loads and layout resets (${software?'software':'default'} canvas)`,async({playwright})=>{
 const browser=await playwright.chromium.launch({channel:'chromium',headless:true});
 try{
  const page=await browser.newPage();
  // A standalone source bundle keeps the browser oracle independent of the
  // game's live Vite server, save loading and WebGPU initialization.
  const {outputFiles}=await build({stdin:{contents:`
   export {NativeColonistBarRaster379} from './src/ui3d/NativeColonistBarRaster379';
   export {seededRandom,drawHandRect,drawHandBlob,PALETTE} from './src/ui3d/prototype-art';
   export {drawColonistBarState346} from './src/ui3d/native-colonist-bar-346';
   export {NATIVE_TEXT} from './src/ui3d/native-ui-scale';
   export {colonistBarLayout,BAR_MARGIN_TOP} from './src/ui3d/native-hud-rimworld';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',target:'es2023',write:false});
  const url='https://native-hud-oracle.invalid';
  await page.route(`${url}/**`,route=>route.fulfill(route.request().url().endsWith('/modules.js')?{contentType:'text/javascript',body:outputFiles[0]!.text}:{contentType:'text/html',body:'<!doctype html><title>Canvas pixel oracle</title>'}));
  await page.goto(url);
  const result=await page.evaluate(async(software)=>{
   const load=(path:string)=>import(/* @vite-ignore */path);
   const {NativeColonistBarRaster379,seededRandom,drawHandRect,drawHandBlob,PALETTE,drawColonistBarState346,NATIVE_TEXT,colonistBarLayout,BAR_MARGIN_TOP}=await load('/modules.js');
   const portrait=async(color:string)=>{const image=new Image();image.src='data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="58" height="54" viewBox="0 0 58 54"><rect width="58" height="54" fill="${color}"/><circle cx="16" cy="19" r="15" fill="rgb(220,50,100)" opacity=".35"/></svg>`);await image.decode();return image;};
   const firstImage=await portrait('#bfc'),secondImage=await portrait('#cc7');
   const cards=Array.from({length:80},(_,i)=>({name:`Pawn ${i}`,mood:55+i%22,selected:false,skin:'#f2cfb1',shirt:'#47684b',loaded:true,image:firstImage,bar:{threshold:'none',tint:false,icons:[] as {kind:string;label:string}[]}}));
   const reference=document.createElement('canvas'),retained=document.createElement('canvas'),readback=document.createElement('canvas');
   const original=reference.getContext('2d',software?{willReadFrequently:true}:undefined)!,actual=retained.getContext('2d',software?{willReadFrequently:true}:undefined)!,cache=new NativeColonistBarRaster379();
   const reader=readback.getContext('2d',{willReadFrequently:true})!;
   let slots:any[]=[],k=1,layout='',w=0,h=0;const checks:{label:string;differences:number;painted:number;full:number;max:number;range:number[];repeat:number;bands:number;portraits:number;names:number}[]=[];
   const configure=(viewport:number)=>{const bar=colonistBarLayout(cards.map(()=>0),viewport),s=bar.scale,left=bar.left-8,top=BAR_MARGIN_TOP-3*s-2,width=bar.right-bar.left+16,height=Math.max(...bar.locs.map((p:any)=>p.y))+(78-3)*s+2-top;
    const density=Math.min(1.25,4096/Math.max(width,1));w=Math.round(width*density);h=Math.round(height*density);k=w/width;
    reference.width=retained.width=readback.width=w;reference.height=retained.height=readback.height=h;layout=`${viewport}:${w}:${h}`;
    slots=cards.map((card,i)=>({id:i,key:'',card,x:bar.locs[i].x-4.5*s-left,y:bar.locs[i].y-3*s-top,sx:s*57/70,sy:s*78/96}));
   };
   // Literal old method: the oracle deliberately does not call the new painter.
   const literal=(col:any,ctx:CanvasRenderingContext2D,rng:()=>number)=>{
    ctx.save();drawHandRect(ctx,0,0,70,96,col.selected?PALETTE.ochre:PALETTE.kraftBase,'#261e18',1.4,rng);
    drawHandRect(ctx,6,6,58,54,col.selected?'#d8e4c4':'#b2c4ab','#261e18',1.2,rng);
    if(col.loaded&&col.image)ctx.drawImage(col.image,6,6,58,54);else{drawHandBlob(ctx,35,48,15,col.shirt,'#261e18',1,rng);drawHandBlob(ctx,35,26,11,col.skin,'#261e18',1,rng);}
    if(col.bar)drawColonistBarState346(ctx,col.bar);drawHandRect(ctx,5,63,60,15,PALETTE.creamPaper,PALETTE.inkDark,.8,rng);
    ctx.fillStyle=PALETTE.inkDark;ctx.font=`bold ${NATIVE_TEXT.small}px "Comic Sans MS", "Chalkboard SE", Georgia, serif`;ctx.textAlign='center';ctx.fillText(col.name,35,75,57);
    drawHandRect(ctx,10,81,50,5,'#423328',null,0,rng);if(col.mood>0)drawHandRect(ctx,10,81,50*col.mood/100,5,col.mood>70?'#639452':'#d16b3b',null,0,rng);ctx.restore();
   };
   const check=(label:string)=>{
    // Reading an accelerated source with getImageData repeatedly makes Chrome
    // migrate its raster backend to CPU. Use a separate software readback
    // canvas, as the game uploads the source without this explicit readback.
    const inspect=(ctx:CanvasRenderingContext2D)=>{if(software)return ctx.getImageData(0,0,w,h).data;reader.clearRect(0,0,w,h);reader.drawImage(ctx.canvas,0,0);return reader.getImageData(0,0,w,h).data;};
    for(const slot of slots)slot.key=JSON.stringify([slot.card.name,slot.card.mood,slot.card.selected,slot.card.skin,slot.card.shirt,slot.card.bar]);
    original.clearRect(0,0,w,h);const rng=seededRandom(4401);
    for(const slot of slots){original.save();original.scale(k,k);original.translate(slot.x,slot.y);original.scale(slot.sx,slot.sy);literal(slot.card,original,rng);original.restore();}
    const before={...cache.stats};cache.draw(actual,w,h,k,layout,slots,seededRandom(4401));
    const a=inspect(original),b=inspect(actual);let differences=0,max=0,range=[w,h,0,0];for(let i=0;i<a.length;i++)if(a[i]!==b[i]){differences++;max=Math.max(max,Math.abs(a[i]!-b[i]!));const p=Math.floor(i/4),x=p%w,y=Math.floor(p/w);range=[Math.min(x,range[0]!),Math.min(y,range[1]!),Math.max(x,range[2]!),Math.max(y,range[3]!)];}
    original.clearRect(0,0,w,h);const again=seededRandom(4401);for(const slot of slots){original.save();original.scale(k,k);original.translate(slot.x,slot.y);original.scale(slot.sx,slot.sy);literal(slot.card,original,again);original.restore();}
    const c=inspect(original);let repeat=0;for(let i=0;i<a.length;i++)if(a[i]!==c[i])repeat++;
    checks.push({label,differences,painted:cache.stats.cardPaints-before.cardPaints,full:cache.stats.fullPaints-before.fullPaints,bands:cache.stats.bandPaints-before.bandPaints,portraits:cache.stats.portraitPaints-before.portraitPaints,names:cache.stats.namePaints-before.namePaints,max,range,repeat});
   };
   for(const viewport of [1440,801,3440]){
    configure(viewport);check(`initial ${viewport}`);check(`unchanged ${viewport}`);
    cards[35]!.mood=cards[35]!.mood===57?58:57;check(`single mood ${viewport}`);
    for(const card of cards)card.mood=card.mood>=100?99:card.mood+1;check(`all moods ${viewport}`);
    cards[11]!.selected=!cards[11]!.selected;cards[52]!.selected=!cards[52]!.selected;check(`selection ${viewport}`);
    cards[18]!.bar={threshold:'extreme',tint:true,icons:[{kind:'burning',label:'En feu'},{kind:'inspired',label:'Inspiration'}]};check(`risk and icons ${viewport}`);
    cards[40]!.mood=0;check(`zero mood stream ${viewport}`);cards[40]!.mood=76;check(`positive mood stream ${viewport}`);
    cards[60]!.loaded=false;check(`portrait fallback stream ${viewport}`);cards[60]!.loaded=true;check(`portrait load stream ${viewport}`);
    cards[22]!.image=cards[22]!.image===firstImage?secondImage:firstImage;check(`replaced loaded image ${viewport}`);
    cards[33]!.name=`J\u0301\u0300\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309\u030A\u030B\u030C\u030D\u030E\u030F\u0310\u0311\u0312\u0313\u0314\u0315\u031A\u031B\u0323\u0324\u0325\u0326\u0327\u0328\u0329\u032A\u032B\u032C\u032D\u032E\u032F\u0330\u0331\u0332\u0333\u0339\u033A\u033B\u033C`;check(`glyph overhang ${viewport}`);
    cards[33]!.name='Renamed';check(`clear glyph overhang ${viewport}`);
    [slots[9],slots[10]]=[slots[10],slots[9]];check(`presentation order ${viewport}`);
   }
   k*=.99;check('scale without new layout key');
   cache.clear();check('explicit reset');const stats={...cache.stats};cache.dispose();return{checks,stats};
  },software);
  console.log('retained paint counts',JSON.stringify(result.checks.filter(row=>row.label.startsWith('single mood')||row.label.startsWith('all moods')).map(({label,painted,bands,portraits,names})=>({label,painted,bands,portraits,names}))));
  expect(result.checks.filter(row=>row.repeat>0)).toEqual([]);
  expect(result.checks.filter(row=>row.differences>0)).toEqual([]);
  for(const row of result.checks.filter(row=>row.label.startsWith('single mood'))){expect(row.full).toBe(0);expect(row.painted).toBeGreaterThan(0);expect(row.painted).toBeLessThan(8);}
  for(const row of result.checks.filter(row=>row.label.startsWith('unchanged')))expect(row.painted).toBe(0);
  for(const row of result.checks.filter(row=>row.label==='all moods 3440'||row.label==='all moods 1440')){expect(row.full).toBe(0);expect(row.bands).toBeLessThan(480);expect(row.portraits).toBeLessThan(80);}
  expect(result.checks.find(row=>row.label==='scale without new layout key')?.full).toBe(1);
  expect(result.stats.rngFallbacks).toBe(0);
 }finally{await browser.close();}
});
