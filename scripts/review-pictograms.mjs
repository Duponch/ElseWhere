import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),build=join(root,'tmp/pictograms-review-build'),out=join(root,'docs/reviews');
await mkdir(out,{recursive:true});
const html=await readFile(join(build,'pictograms-review.html'),'utf8');
const entry=(await readdir(join(build,'assets'))).find(x=>x.endsWith('.js'));
const js=await readFile(join(build,'assets',entry),'utf8');
const standalone=html.replace(/<script[^>]*src[^>]*><\/script>/,()=>`<script type="module">${js.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(join(out,'pictograms-20261107.html'),standalone);
const browsers=[resolve(root,'.playwright'),resolve(root,'../../.playwright')].find(existsSync);
if(browsers)process.env.PLAYWRIGHT_BROWSERS_PATH??=browsers;
const {chromium}=await import('@playwright/test');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 // The review is wholly local, including its script; no server or network.
 await page.setContent(standalone);await page.waitForFunction(()=>window.reviewReady);
 const result=await page.evaluate(async()=>{
  const missing=window.reviewManifest.filter(x=>!x.authored),empty=[],opaqueCorners=[],decodeErrors=[];
  for(const[id,svg]of Object.entries(window.reviewSvgs)){
   const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(svg);
   try{await image.decode();}catch{decodeErrors.push(id);continue;}
   const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,96,96);const bytes=ctx.getImageData(0,0,96,96).data;
   if(!bytes.some((n,i)=>i%4===3&&n))empty.push(id);
   if([3,95*4+3,95*96*4+3,(96*96-1)*4+3].some(i=>bytes[i]))opaqueCorners.push(id);
  }
  return {entries:window.reviewManifest.length,missing,empty,opaqueCorners,decodeErrors};
 });
 if(errors.length||result.missing.length||result.empty.length||result.opaqueCorners.length||result.decodeErrors.length)throw Error(JSON.stringify({...result,errors}));
 await page.screenshot({path:join(out,'pictograms-20261107.png')});
 await page.selectOption('#size','24');await page.selectOption('#family','navigation');await page.screenshot({path:join(root,'tmp/pictograms-24px.png')});
 await page.selectOption('#family','all');await page.selectOption('#size','32');await page.selectOption('#background','#c69d6e');await page.screenshot({path:join(root,'tmp/pictograms-32px-kraft.png')});
 await page.selectOption('#background','#35453d');await page.screenshot({path:join(root,'tmp/pictograms-32px-dark.png')});
 await page.fill('#search','double-bed');if(await page.locator('.card:visible').count()!==1)throw Error('Search did not isolate double-bed');
 await page.selectOption('#family','item');if(await page.locator('.card:visible').count()!==0)throw Error('Family and search filters are not combined');
 await page.fill('#search','');if(await page.locator('.card:visible').count()===0)throw Error('Item filter is empty');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(root,'tmp/pictograms-mobile.png')});
 const report={...result,errors,filters:true,smallSizes:[24,32],surfaces:['cream','kraft','dark'],viewports:[1280,390]};
 await writeFile(join(root,'tmp/pictograms-browser-qa.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
