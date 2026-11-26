// Run after npm run build. No external network or private save data is used.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,readFile,readdir,realpath,stat,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname,extname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {chromium} from '@playwright/test';
import {measureLiveColony,withDeadline} from './fixtures/worker-colony-scene/live-measure.mjs';
import {installLocalBuildRoutes} from './local-build-router.mjs';
import {verifyLiveSpeedHud} from './fixtures/worker-colony-scene/live-speed-hud.mjs';

const root=await realpath(resolve(process.env.LISIERE_WORKER_COLONY_DIST||'dist'));
const measure=process.argv.includes('--measure');
const speedHud=process.argv.includes('--speed-hud');
if(speedHud)assert.equal(measure,false,'Run HUD qualification outside timed windows');
const entry='/worker-colony.html'+(speedHud?'?hud=speed':'');
const referenceFile=process.argv.find(a=>a.startsWith('--pick-reference='))?.slice('--pick-reference='.length);
let reference,referenceSimulation,referenceCamera,referencePng;
if(referenceFile){
  const report=JSON.parse(await readFile(referenceFile,'utf8'));
  const save=await readFile(join(root,'test-saves/v432/les-forges-crash-test.json'));
  assert.equal(createHash('sha256').update(save).digest('hex'),report.inputSHA256,'The selection oracle used a different colony');
  assert.equal(report.differences?.parity?.first,0,'Use a completed Window/Worker pixel oracle');
  reference=report.observations?.window?.first?.pickReference;
  referenceCamera=report.observations?.window?.first?.camera;
  referenceSimulation=report.simulation?.sha;
  assert.ok(reference?.actor&&reference?.map,'Missing Window picking reference');
  assert.equal(measure,false,'Run picking checks outside timed windows');
  if(!speedHud)referencePng=await readFile(join(dirname(referenceFile),'window-first.png'));
}
const argument=(key,fallback)=>Number(process.argv.find(a=>a.startsWith('--'+key+'='))?.split('=')[1]??fallback);
const requestedSpeed=argument('speed',6),seconds=argument('seconds',60);
assert.ok([1,3,6].includes(requestedSpeed)&&Number.isFinite(seconds)&&seconds>=1);
await stat(join(root,'worker-colony.html'));
const assets=join(root,'assets'),assetNames=await readdir(assets);
const simulations=assetNames.filter(n=>/^presentation\.worker-[\w-]+\.js$/.test(n));
assert.equal(simulations.length,1,'Build must contain one presentation Worker');
const simulationBytes=await readFile(join(assets,simulations[0]));
const simulationSHA256=createHash('sha256').update(simulationBytes).digest('hex');
if(referenceFile)assert.equal(referenceSimulation,simulationSHA256,'The selection oracle used a different simulation build');
const directory=resolve('tmp/test-runs/worker-colony-live');
await mkdir(directory,{recursive:true});
const output=await mkdtemp(join(directory,'run-'));
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=await realpath(resolve(root,'.'+pathname)),part=relative(root,path);
    if(!part||part==='..'||part.startsWith('..'+sep)||isAbsolute(part)||!(await stat(path)).isFile())throw Error('Missing asset');
    res.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});
    createReadStream(path).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404);res.end();}
});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
const origin='http://127.0.0.1:'+server.address().port;
const errors=[],steps={};
let transport='loopback',failure;
let browser,page,states=[];
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio',...(measure?['--disable-frame-rate-limit','--disable-gpu-vsync']:[])]});
  page=await browser.newPage({viewport:measure?{width:1440,height:1000}:{width:1000,height:700},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.text().startsWith('Colony stage '))console.log(m.text());});
  page.on('requestfailed',r=>console.error('requestfailed',r.url(),r.failure()));
  // Observe replies to the UI without touching the nested producer or changing
  // any MessageEvent, postMessage, acknowledgement, or native provenance check.
  await page.addInitScript(()=>{
    window.sceneSamples=[];window.sceneTimes=[];window.sceneAcks=[];window.sceneFailures=[];window.sceneProgress=[];window.speedHudPackets=0;
    window.Worker=new Proxy(window.Worker,{construct(target,args){
      const worker=Reflect.construct(target,args);
      worker.addEventListener('message',({data})=>{
        if(data.type==='state'){window.sceneSamples.push(data.state);window.sceneTimes.push(performance.now());}
        else if(data.type==='speed-hud-hits')window.speedHudPackets++;
        else if(data.type==='ready')window.sceneGraphics=data.graphics;
        else if(data.type==='ack')window.sceneAcks.push({id:data.id,error:data.error,at:performance.now()});
        else if(data.type==='fatal')window.sceneFailures.push(data.message);
        else if(data.type==='progress'){window.sceneProgress.push(data.message);console.info('Colony stage '+data.message);}
      });
      return worker;
    }});
  });
  try{
    await page.goto(origin+entry,{timeout:10000});
  }catch(error){
    if(!String(error).includes('ERR_NETWORK_ACCESS_DENIED'))throw error;
    // Chromium's nested module-Worker request escapes Playwright routing in a
    // network-denied profile. Retain the exact dist simulation bytes inside a
    // local Blob. Change just the URL in the real render module in this run.
    const workers=assetNames.filter(n=>/^worker-[\w-]+\.js$/.test(n)&&!n.startsWith('worker-colony-'));
    assert.equal(workers.length,1);
    const source=await readFile(join(assets,workers[0]),'utf8');
    assert.doesNotMatch(simulationBytes.toString('utf8').replace(/^\s*\/\/.*$/gm,''),/\bimport\s*(?:\(|[\w*{'"\s]+from\s*["'])|import\.meta\.url/);
    const locator=/new URL\(\s*\/\* @vite-ignore \*\/\s*`\/assets\/presentation\.worker-[\w-]+\.js`,``\+self\.location\.href\)/g;
    assert.equal([...source.matchAll(locator)].length,1,'Build nested URL changed');
    await installLocalBuildRoutes(page.context(),root,origin);
    transport='offline-blob';
    await page.goto(origin+entry,{timeout:15000});
    const blob=await page.evaluate(async({url,sha})=>{
      const response=await fetch(url);
      if(!response.ok)throw Error('Simulation asset unavailable');
      const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
      if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==sha)throw Error('Simulation asset changed');
      return URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));
    },{url:'/assets/'+simulations[0],sha:simulationSHA256});
    // Only the short shared-origin Blob URL enters the render module's heap.
    await page.context().route(origin+'/assets/'+workers[0],route=>route.fulfill({contentType:'text/javascript',body:source.replace(locator,()=>JSON.stringify(blob))}));
  }
  await page.getByRole('button',{name:'Ouvrir',exact:true}).click();
  async function until(test,arg,timeout=45000){
    const deadline=performance.now()+timeout;
    while(performance.now()<deadline){
      const {state,failure}=await page.evaluate(()=>({state:window.sceneSamples.at(-1),failure:window.sceneFailures.at(-1)}));
      if(failure)throw Error(failure);
      if(state&&test(state,arg))return state;
      await new Promise(done=>setTimeout(done,75));
    }
    throw Error('No matching colony state within '+timeout+' ms');
  }
  steps.loaded=await until(s=>s.speed===0&&s.frames>=2&&s.triangles>10000,null,180000);
  steps.graphics=await page.evaluate(()=>window.sceneGraphics);
  assert.equal(steps.graphics?.backend,'webgpu');
  console.log('Submitted native world',JSON.stringify(steps.loaded));
  const initial=steps.loaded;
  if(reference){
    await page.waitForFunction(()=>document.querySelector('#metrics')?.textContent.includes('dessins/s'));
    await page.setViewportSize({width:reference.width,height:720});
    const surface=await page.locator('#surface').boundingBox();
    await page.setViewportSize({width:reference.width,height:720+reference.height-Math.round(surface.height)});
    const resized=await until((s,g)=>s.width===g.width&&s.height===g.height&&s.tick===g.tick,reference);
    await until((s,g)=>s.width===g.width&&s.height===g.height&&s.frames>=g.frames+45,resized);
    const canvas=page.locator('#surface > canvas:first-child'),confirmation=page.locator('#pick-confirm');
    async function choose(point,checkPixels=false){
      const before=await page.locator('#pick-result').getAttribute('data-frame');
      if(checkPixels){
        const beforePick=await canvas.screenshot({path:join(output,'before-pick.png')});
        const rect=await canvas.boundingBox();
        await page.mouse.move(rect.x+point.x,rect.y+point.y);
        await page.mouse.down();
        const pinned=page.locator('.picked-frame');await pinned.waitFor({state:'visible'});
        const pixels=await pinned.evaluate(async(layer,{displayed,reference})=>{
          const copy=layer.getContext('2d').getImageData(0,0,layer.width,layer.height).data;
          async function compare(png){
            const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0));
            const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
            if(bitmap.width!==layer.width||bitmap.height!==layer.height)throw Error('Capture and view dimensions differ');
            const raster=new OffscreenCanvas(bitmap.width,bitmap.height),ink=raster.getContext('2d');
            ink.drawImage(bitmap,0,0);bitmap.close();
            const source=ink.getImageData(0,0,layer.width,layer.height).data;
            let different=0;
            for(let i=0;i<source.length;i+=4)if(source[i]!==copy[i]||source[i+1]!==copy[i+1]||source[i+2]!==copy[i+2]||source[i+3]!==copy[i+3])different++;
            return {different,total:layer.width*layer.height};
          }
          return {displayed:await compare(displayed),reference:reference&&await compare(reference)};
        },{displayed:beforePick.toString('base64'),reference:referencePng?.toString('base64')});
        steps.pickPixels=pixels.displayed;
        if(referencePng)steps.windowPixels={...pixels.reference,sha256:createHash('sha256').update(referencePng).digest('hex')};
        await page.mouse.up();
        assert.equal(steps.pickPixels.different,0,'The shown selection image differs from the paused scene');
        if(referencePng)assert.equal(steps.windowPixels.different,0,'The built Worker page differs from the reference Window scene');
      }else await canvas.click({position:{x:point.x,y:point.y}});
      await page.waitForFunction(previous=>{
        const result=document.querySelector('#pick-result')?.dataset.frame;
        return !document.querySelector('#pick-confirm')?.hidden||(result&&result!==previous);
      },before);
      if(await confirmation.isVisible())await confirmation.click();
      await page.waitForFunction(previous=>{
        const result=document.querySelector('#pick-result')?.dataset.frame;
        return result&&result!==previous;
      },before);
      return page.locator('#pick-result').evaluate(element=>({...element.dataset}));
    }
    const actor=await choose(reference.actor,true),map=await choose(reference.map);
    assert.equal(Number(actor.id),reference.actor.id);
    assert.equal(actor.kind,reference.actor.kind);
    assert.equal(Number(actor.tick),reference.tick);
    assert.deepEqual(JSON.parse(actor.camera),referenceCamera);
    assert.equal(Number(map.x),reference.map.cell.x);
    assert.equal(Number(map.z),reference.map.cell.z);
    if(reference.map.object)assert.equal(Number(map.id),reference.map.object.id);
    assert.equal(map.kind,reference.map.object?.kind??'terrain');
    assert.equal(Number(map.tick),reference.tick);
    steps.picking={reference,actor,map};
    const rect=await canvas.boundingBox();
    await page.mouse.move(rect.x+reference.actor.x,rect.y+reference.actor.y);await page.mouse.down();
    await page.locator('.picked-frame').waitFor({state:'visible'});
    const size=page.viewportSize();
    await page.setViewportSize({width:size.width+24,height:size.height+12});
    await page.locator('.picked-frame').waitFor({state:'detached'});
    await page.mouse.up();
    assert.equal(await page.locator('#pick-result').getAttribute('data-frame'),null);
    steps.pickCancelledOnResize=true;
  }
  if(speedHud)steps.nativeSpeedClicks=await verifyLiveSpeedHud(page,until);
  if(measure){
    Object.assign(steps,await measureLiveColony(page,until,initial,requestedSpeed,seconds));
  }else{
    for(const speed of [1,3,6]){
      const start=await page.evaluate(()=>window.sceneSamples.at(-1));
      await page.locator('[data-speed="'+speed+'"]').click();
      const end=await until((s,g)=>s.speed===g.speed&&s.core>=g.core+120&&s.phases>=g.phases+8&&s.fulls>=g.fulls+2,{...start,speed});
      assert.ok(end.frames>start.frames&&end.overflow===0);
      assert.equal(await page.locator('[data-speed="'+speed+'"]').getAttribute('aria-pressed'),'true');
      steps['x'+speed]={start,end};
    }
    await page.locator('[data-speed="0"]').click();
    const paused=await until(s=>s.speed===0&&s.queueDepth===0);
    steps.paused=await until((s,p)=>s.frames>=p.frames+10&&s.core===p.core&&s.tick===p.tick,paused);
    const canvas=page.locator('#surface canvas'),bounds=await canvas.boundingBox();
    const x=Math.round(bounds.x+bounds.width/2),y=Math.round(bounds.y+bounds.height/2);
    await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+80,y+12,{steps:5});await page.mouse.up({button:'right'});
    steps.orbit=await until((s,p)=>Math.abs(s.camera.position[0]-p[0])>1,paused.camera.position);
    await canvas.focus();await page.keyboard.press('ArrowRight');await page.mouse.wheel(0,-120);
    steps.panZoom=await until((s,p)=>Math.abs(s.camera.target[0]-p.target[0])>.01&&s.camera.zoom>p.zoom,steps.orbit.camera);
    await page.setViewportSize({width:864,height:610});
    steps.resized=await until((s,p)=>s.width!==p.width&&s.height!==p.height,initial);
    await page.screenshot({path:join(output,'paused-camera.png')});
    await page.keyboard.press('Space');
    await until((s,c)=>s.speed===1&&s.core>c,paused.core);
    // Mid-run replacement terminates both Workers before serving the new source.
    const targets=await browser.newBrowserCDPSession();
    const workerIds=async()=>(await targets.send('Target.getTargets')).targetInfos.filter(t=>t.type==='worker').map(t=>t.targetId);
    const closingWorkers=await workerIds();
    assert.ok(closingWorkers.length>=2,'Expected the render Worker and its native simulation Worker');
    const count=await page.evaluate(()=>window.sceneSamples.length);
    await page.locator('#file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.waitForFunction(()=>window.sceneFailures.length>0,null,{timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#speed').disabled);
    assert.equal(await page.locator('[data-speed="1"]').isDisabled(),true);
    steps.failure=await page.locator('#status').textContent();
    assert.equal(steps.failure,'Cette sauvegarde est illisible ou incompatible avec cette version.');
    const closeDeadline=performance.now()+10000;
    while((await workerIds()).some(id=>closingWorkers.includes(id))){
      if(performance.now()>closeDeadline)throw Error('A replaced Worker remained alive');
      await new Promise(done=>setTimeout(done,100));
    }
    steps.closedWorkerCount=closingWorkers.length;
    await targets.detach();
    await page.locator('#file').setInputFiles(join(root,'test-saves/v432/les-forges-crash-test.json'));
    await page.waitForFunction(n=>window.sceneSamples.length>n&&window.sceneSamples.at(-1).speed===0&&window.sceneSamples.at(-1).frames>1,count,{timeout:180000});
    steps.reloaded=await page.evaluate(()=>window.sceneSamples.at(-1));
    assert.equal(steps.reloaded.tick,initial.tick);
    states=await page.evaluate(()=>window.sceneSamples);
    for(const [i,s] of states.slice(1,count).entries()){
      assert.ok(s.core>=states[i].core&&s.fulls>=states[i].fulls&&s.phases>=states[i].phases&&s.frames>=states[i].frames);
      assert.equal(s.overflow,0);
    }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS',output);
}catch(error){
  failure=String(error);throw error;
}finally{
  let status;
  if(page&&!page.isClosed()){
    const diagnostic=await withDeadline(page.evaluate(()=>({
      states:window.sceneSamples??[],
      status:{text:document.querySelector('#status')?.textContent,failures:window.sceneFailures,progress:window.sceneProgress},
    })),3000).catch(()=>undefined);
    if(diagnostic){states=diagnostic.states;status=diagnostic.status;}
  }
  await writeFile(join(output,'result.json'),JSON.stringify({passed:!failure,failure,transport,simulationSHA256,status,steps,states,errors},null,2));
  console.log('Report',output);
  await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));
}
