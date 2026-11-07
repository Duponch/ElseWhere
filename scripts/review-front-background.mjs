import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH??=resolve('../../.playwright');
const {chromium}=await import('@playwright/test');
const {build}=await import('vite');
const output=resolve('tmp/front-menu-background-qa');
await mkdir(output,{recursive:true});
// Offline component review: actual native renderer and front-menu producers,
// with metadata-only UI service stubs. No World or simulation is constructed.
const image=await readFile('public/assets/ui/elsewhere/menu/background-20261107.webp');
const font=await readFile('public/assets/fonts/v306/comfortaa.ttf');
const entry=`
import {NativeStage} from '/src/ui3d/NativeStage.ts';
import {createNativeFrontMenu} from '/src/ui3d/native-front.ts';
import {DEFAULT_LIGHTING_SETTINGS} from '/src/render/lighting-settings.ts';
const errors=[],yes=()=>true,no=()=>false,noop=async()=>{};
const stage=new NativeStage({onPanel:()=>{},onEscape:()=>{},onError:message=>errors.push(message)});
stage.setTextFont('Comfortaa');
const menu=createNativeFrontMenu({onStart:noop,onLoad:noop,onResume:noop,
getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,
getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,
getLightingSettings:()=>DEFAULT_LIGHTING_SETTINGS,onLightingSettingsChange:yes,
getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>.5,onSoundVolumeChange:yes,onTestSound:noop,
getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>.5,onMusicVolumeChange:yes,
getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop,getUiFont:()=>'comfortaa'
},page=>{stage.setFrontVisible(!!page);stage.showPage(page);});
window.__review={get nativeUi(){return stage.diagnostics();},errors,menu,stage};
stage.ready.then(()=>{menu.showHome(false);window.reviewReady=true;});`;
const entryPath=resolve(output,'entry.ts');await writeFile(entryPath,entry);
const result=await build({configFile:false,publicDir:false,resolve:{alias:[{find:/^three$/,replacement:'three/webgpu'}]},
plugins:[{name:'offline-front-review',enforce:'pre',
transform:(code,id)=>id.replaceAll('\\','/').endsWith('/ui/front-menu-background.ts')?code.replace("'/assets/ui/elsewhere/menu/background-20261107.webp'",JSON.stringify('data:image/webp;base64,'+image.toString('base64'))):undefined}],
build:{write:false,minify:false,lib:{entry:entryPath,formats:['iife'],name:'FrontReview'}}});
const js=(Array.isArray(result)?result[0]:result).output.find(file=>file.type==='chunk').code;
const html=`<!doctype html><html lang="fr"><meta charset="UTF-8"><style>html,body{margin:0;overflow:hidden}@font-face{font-family:Comfortaa;src:url(data:font/ttf;base64,${font.toString('base64')})}</style><body><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],requests=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error('Browser:',error.message);});
  page.on('response',response=>{if(response.url().includes('background-20261107'))requests.push({status:response.status(),url:response.url()});});
  await page.setContent(html);
  try {
    await page.waitForFunction(()=>window.__review?.nativeUi?.page==='front-home'&&window.__review.nativeUi.frontBackdrop.state==='ready'&&window.__review.nativeUi.controls.some(c=>c.id==='new-game'&&!c.disabled),{},{timeout:25000});
  } catch(error) {
    console.error(JSON.stringify(await page.evaluate(()=>({ready:window.reviewReady,backdrop:window.__review?.nativeUi.frontBackdrop,error:window.__review?.nativeUi.error,errors:window.__review?.errors})),null,2));
    throw error;
  }
  const observed=[];
  for(const [width,height]of [[1920,1080],[1280,720],[2560,1080]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(([w,h])=>window.__review.nativeUi.logicalViewport.width*window.__review.nativeUi.displayScale===w&&window.__review.nativeUi.logicalViewport.height*window.__review.nativeUi.displayScale===h,[width,height]);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const state=await page.evaluate(()=>window.__review.nativeUi);
    if(state.error||!state.frontBackdrop.visible)throw Error('Artwork is not visible: '+JSON.stringify(state));
    observed.push({width,height,backend:state.backend,frontBackdrop:state.frontBackdrop,pageBounds:state.pageBounds});
    await page.screenshot({path:resolve(output,`home-${width}x${height}.png`)});
  }
  await page.setViewportSize({width:1920,height:1080});
  async function click(id,next){
    const control=await page.evaluate(id=>window.__review.nativeUi.controls.find(c=>c.id===id&&!c.disabled),id);
    if(!control)throw Error('Missing enabled control '+id);
    await page.mouse.click(control.x,control.y);
    await page.waitForFunction(id=>window.__review.nativeUi.page===id,next);
    if(!await page.evaluate(()=>window.__review.nativeUi.frontBackdrop.visible))throw Error('Artwork lost after '+id);
  }
  await click('options','front-options');
  await page.screenshot({path:resolve(output,'options-1920x1080.png')});
  await click('front-back','front-home');
  await click('load-game','front-load');
  await page.screenshot({path:resolve(output,'load-1920x1080.png')});
  await click('front-back','front-home');
  await click('new-game','front-scenario');
  await page.screenshot({path:resolve(output,'scenario-1920x1080.png')});
  await click('front-back','front-home');
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  await page.evaluate(()=>window.__review.menu.hide());
  const hiddenOnClose=await page.evaluate(()=>!window.__review.nativeUi.frontBackdrop.visible);
  if(!hiddenOnClose)throw Error('Artwork remains visible after closing the front menu');
  await page.evaluate(()=>window.__review.menu.showHome(false));
  await page.waitForFunction(()=>window.__review.nativeUi.frontBackdrop.visible);
  const stageErrors=await page.evaluate(()=>window.__review.errors);
  await page.evaluate(()=>window.__review.stage.dispose());
  if(await page.locator('canvas[data-ui3d=native]').count())throw Error('Native canvas survived disposal');
  if(stageErrors.length)throw Error(JSON.stringify(stageErrors));
  const report={scope:'offline native menu component; UI service stubs; no World or simulation',viewports:observed,navigation:['home','options','home','load','home','scenario','home'],hiddenOnClose,restoredOnReopen:true,canvasRemovedOnDispose:true,requests,errors,stageErrors};
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser?.close();}
