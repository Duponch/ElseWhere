import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH??=resolve('../../.playwright');
const {build}=await import('vite'),{chromium}=await import('@playwright/test');
await mkdir('tmp/bare-pictograms',{recursive:true});
const entry=`import {NativeStage} from '/src/ui3d/NativeStage';
import {drawNativeSpeedIcon} from '/src/ui3d/native-hud-art';
const errors=[],stage=new NativeStage({onPanel:()=>{},onEscape:()=>{},onError:message=>errors.push(message)});
window.review={stage,errors};stage.setTextFont('Comfortaa');stage.setFrontVisible(false);
stage.showPage({id:'bare-icons',title:'Pictogrammes sans médaillon',width:1000,height:480,layout:'architect',rows:[
{id:'navigation',label:'',region:'navigation',controlStyle:'navigation',controls:['temperature','structure','floor','furniture','power'].map((icon,i)=>({id:'category-'+i,label:['Température','Structure','Sols','Mobilier','Énergie'][i],icon,presentation:'navigation',onActivate:()=>{}}))},
{id:'catalogue',label:'',region:'catalogue',controlStyle:'tile',controls:['door','wall','sandbags','fence','fence-gate','pen-marker','spike-trap'].map((icon,i)=>({id:icon,label:['Porte','Mur','Sacs de sable','Clôture','Portillon',"Marqueur d’enclos",'Piège à pointes'][i],icon,presentation:'tile',onActivate:()=>{}}))}]});
const speed=document.createElement('canvas');speed.width=384;speed.height=74;speed.style.cssText='position:fixed;top:20px;left:20px;z-index:99';document.body.append(speed);const ctx=speed.getContext('2d');
for(const [i,value]of [0,1,3,6].entries()){ctx.save();ctx.translate(i*96,0);ctx.fillStyle=value?'#a0ae8e':'#cf775e';ctx.fillRect(2,2,90,70);drawNativeSpeedIcon(ctx,96,74,value,value===0);ctx.restore();}
stage.ready.then(()=>window.reviewReady=true);`;
const entryPath=resolve('tmp/bare-pictograms/entry.ts');await writeFile(entryPath,entry);
const result=await build({configFile:false,publicDir:false,resolve:{alias:[{find:/^three$/,replacement:'three/webgpu'}]},build:{write:false,minify:false,lib:{entry:entryPath,formats:['iife'],name:'BareIconsReview'}}});
const js=(Array.isArray(result)?result[0]:result).output.find(x=>x.type==='chunk').code;
const font=await readFile('public/assets/fonts/v306/comfortaa.ttf');
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}@font-face{font-family:Comfortaa;src:url(data:font/ttf;base64,'+font.toString('base64')+')}</style></head><body><script>'+js.replace(/<\/script/gi,'<\\/script')+'</script></body></html>');
try{await page.waitForFunction(()=>window.reviewReady&&window.review.stage.diagnostics().renders>0,{}, {timeout:10000});}catch(error){console.error(JSON.stringify(await page.evaluate(()=>({ready:window.reviewReady,error:window.review?.stage.diagnostics().error,errors:window.review?.errors}))),errors);throw error;}
await page.screenshot({path:'tmp/bare-pictograms/review.png'});
const state=await page.evaluate(()=>({errors:window.review.errors,backend:window.review.stage.diagnostics().backend}));
await page.evaluate(()=>window.review.stage.dispose());if(errors.length||state.errors.length)throw Error(JSON.stringify({errors,state}));
await writeFile('tmp/bare-pictograms/report.json',JSON.stringify({scope:'offline native UI components, no simulation',...state,errors},null,2));console.log(JSON.stringify(state));
}finally{await browser.close();}
