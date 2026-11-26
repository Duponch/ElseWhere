// Measurement tool (not product code). Real client in Chromium, against a
// profiling build made with scripts/perf-client-publication-config.mjs: loads a
// save, then records every animation frame for `seconds` at each speed:
// frame interval, RAF work, admission drain, resident adoption, receiveMainSnapshot,
// renderer.applyWorld / setWorld / renderScene / phases, HUD, and per Worker
// message the first `data` read (structured-clone deserialization, lazy in
// Chromium) and the listener time, split between complete publications
// (resident-publication) and actor phase packets. Long tasks are listed too.
// Usage: node scripts/perf-client-publication.mjs <port> <save URL path> <seconds> <speeds csv> <out.json>
//   CHROME=<chrome.exe> to choose the browser (default: the project's Playwright Chromium)
//   PROFILE=1 also writes a main-thread CPU profile of each window (diagnosis only: it adds overhead).
//   PERF_ORBIT=1 measures continuous real right-button camera dragging instead
//   of a stationary view. Use one speed per run for the same starting view.
// Then: node scripts/perf-client-publication-summary.mjs out.json [...]
// The selected browser can use WebGPU or a fallback. Each report includes the
// actual backend and adapter; a WebGL-only run cannot qualify native WebGPU.
// RAF and CPU timing here are not independent hardware GPU-timestamp counters.
// In Git Bash, set MSYS_NO_PATHCONV=1 so the save path is not rewritten.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import {installLocalBuildRoutes} from './local-build-router.mjs';
const [port = '5311', save = '/test-saves/v432/les-forges-crash-test.json', secs = '20', speeds = '1,3', out] = process.argv.slice(2);
if (!out) throw Error('Usage: perf-client-publication <port> <save> <seconds> <speeds> <out.json>');
const channel=process.env.PERF_BROWSER_CHANNEL;
const orbit=process.env.PERF_ORBIT==='1';
const uncapped=process.env.PERF_UNCAPPED==='1';
const cadenceProbe=process.env.PERF_CADENCE==='1';
if(orbit&&speeds.split(',').length!==1)throw Error('Orbit comparisons require one speed and the same starting camera');
if(channel!==undefined&&!['chrome','chromium'].includes(channel))throw Error('Unknown benchmark browser channel');
const args=['--mute-audio',...uncapped?['--disable-frame-rate-limit','--disable-gpu-vsync']:[]];
const browser = await chromium.launch(channel?{channel,headless:true,args}:{ executablePath: process.env.CHROME ?? 'E:/Code/RimWorld/.playwright/chromium-1243/chrome-win64/chrome.exe', headless: true, args: [...args, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
// Offline native benchmark: serve only a frozen, existing local build through
// Playwright's fixture router, with no TCP connection or external requests.
// The real Chromium renderer, workers, scripts, assets and input are unchanged.
// A missing asset is a real fixture error, never substituted with a mock.
if(process.env.PERF_LOCAL_BUILD)await installLocalBuildRoutes(ctx,process.env.PERF_LOCAL_BUILD,`http://127.0.0.1:${port}`);
// Both measurements use this browser and its viewport. The blank tab and
// the actively submitting WebGPU canvas can have different compositor clocks.
let cadence;
if(cadenceProbe){
  const tab=await ctx.newPage();
  const url=`http://127.0.0.1:${port}/perf-cadence`;
  await tab.route(url,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><canvas width="1440" height="1000"></canvas>'}));
  await tab.goto(url);
  cadence=await tab.evaluate(async()=>{
    async function sample(submit){
      return new Promise(resolve=>{
        let start,last,frames=0;const intervals=[];
        function observe(t){
          submit?.();
          if(start===undefined)start=t;else{frames++;intervals.push(t-last);}last=t;
          if(t-start<2000){requestAnimationFrame(observe);return;}
          intervals.sort((a,b)=>a-b);resolve({frames,wallMs:t-start,fps:frames*1000/(t-start),medianIntervalMs:intervals[Math.floor(intervals.length/2)]});
        }
        requestAnimationFrame(observe);
      });
    }
    const blank=await sample(),adapter=await navigator.gpu?.requestAdapter();
    if(!adapter)return {blank};
    const device=await adapter.requestDevice(),context=document.querySelector('canvas').getContext('webgpu');
    context.configure({device,format:navigator.gpu.getPreferredCanvasFormat()});
    let flip=0;
    const gpuClear=await sample(()=>{
      const encoder=device.createCommandEncoder(),view=context.getCurrentTexture().createView();
      const pass=encoder.beginRenderPass({colorAttachments:[{view,clearValue:{r:(flip++ & 1)*.1,g:.2,b:.3,a:1},loadOp:'clear',storeOp:'store'}]});
      pass.end();device.queue.submit([encoder.finish()]);
    });
    await device.queue.onSubmittedWorkDone();device.destroy();
    return {blank,gpuClear};
  });
  await tab.close();
}
await ctx.addInitScript(() => {
  for (const [k, v] of Object.entries({ 'lisiere.audio.effects.enabled.v1': 'false', 'lisiere.audio.music.enabled.v1': 'false', 'lisiere.autosave-minutes.v1': '0', 'lisiere.presentation.threat-pause.v1': 'never' })) localStorage.setItem(k, v);
  const zero = () => ({ cb: 0, frame: 0, apply: 0, applyN: 0, setWorld: 0, render: 0, draws: 0, phases: 0, phaseSet: 0, phaseN: 0, deserFull: 0, deserPhase: 0, listenFull: 0, listenPhase: 0, onmsgFull: 0, onmsgPhase: 0, nFull: 0, nPhase: 0 });
  const st = window.__fa = { on: false, frames: [], cur: zero(), zero, last: 0, tasks: [], types: new WeakMap(), publishedCore: -1 };
  // Chromium deserializes a message at the first `data` read.
  const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data'), get = desc.get, seen = new WeakSet();
  Object.defineProperty(MessageEvent.prototype, 'data', { ...desc, get() {
    if (seen.has(this)) return get.call(this);
    seen.add(this); const t = performance.now(); const v = get.call(this); const d = performance.now() - t;
    const type = v && typeof v === 'object' ? v.type : undefined; st.types.set(this, type);
    if (type === 'resident-publication') {
      st.cur.deserFull += d;
      const w=v.publication?.world;
      if(Number.isSafeInteger(w?.tick))st.publishedCore=Math.max(st.publishedCore,w.tick*10+(w.phaseCore297??0));
    } else if (type === 'actor-frontier-297' || type === 'actor-phase-297') {
      st.cur.deserPhase += d;
      if(Number.isSafeInteger(v.toCore))st.publishedCore=Math.max(st.publishedCore,v.toCore);
    }
    return v;
  } });
  const timed = (fn, key) => function (ev) { const t = performance.now(); try { return fn.call(this, ev); } finally { const d = performance.now() - t, type = st.types.get(ev); if (type === 'resident-publication') { st.cur[key + 'Full'] += d; if (key === 'listen') st.cur.nFull++; } else if (type === 'actor-frontier-297' || type === 'actor-phase-297') { st.cur[key + 'Phase'] += d; if (key === 'listen') st.cur.nPhase++; } } };
  // Fixed MAIN may own one private MessagePort for the ordered Worker output.
  // Other application channels use the same instrumentation but only actual
  // resident/phase discriminants contribute to these counters.
  for(const proto of [Worker.prototype,MessagePort.prototype]){
    const add=proto.addEventListener;
    proto.addEventListener=function(type,fn,opts){return add.call(this,type,type==='message'&&typeof fn==='function'?timed(fn,'listen'):fn,opts);};
    const om=Object.getOwnPropertyDescriptor(proto,'onmessage');
    if(om?.set)Object.defineProperty(proto,'onmessage',{...om,set(fn){om.set.call(this,typeof fn==='function'?timed(fn,'onmsg'):fn);}});
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const t = performance.now(); try { cb(ts); } finally { st.cur.cb += performance.now() - t; } });
  // One record per animation frame, closed before the frame's callbacks run:
  // work between two frames (messages, timers, HUD) lands in the next record.
  const tick = ts => { const c2 = window.__c2; if (st.on) st.frames.push({ dt: ts - st.last, ...st.cur, ...(c2 ? c2.cur : {}) }); st.last = ts; st.cur = zero(); if (c2) c2.cur = c2.z(); raf(tick); };
  raf(tick);
  try { new PerformanceObserver(l => { if (st.on) for (const e of l.getEntries()) st.tasks.push(e.duration); }).observe({ type: 'longtask', buffered: false }); } catch { }
});
const page = await ctx.newPage(); page.setDefaultTimeout(process.env.PERF_LOCAL_BUILD?120000:900000);
const errors = []; const reportError=e=>{errors.push(String(e).slice(0,300));if(process.env.PERF_LOCAL_BUILD)console.log('[local build error]',String(e).slice(0,300));};
page.on('pageerror', reportError); page.on('console', m => { if (m.type() === 'error') reportError(m.text()); });
page.on('crash', () => console.log('[crash]', new Date().toISOString()));
await page.goto(`http://127.0.0.1:${port}/?e2e=1`, { waitUntil: 'domcontentloaded' });
if(process.env.PERF_LOCAL_BUILD)console.log('Frozen build document loaded');
await page.waitForFunction(() => window.__perf?.ready && window.__c2);
if(process.env.PERF_LOCAL_BUILD)console.log('Native client ready');
const t0 = Date.now();
await page.evaluate(u => window.__perf.loadUrl(u), save);
await page.waitForFunction(() => window.__perf?.view?.backend && !!window.__perf.world && !window.__perf.blocked);
if(process.env.PERF_LOCAL_BUILD)console.log('Native colony loaded');
const loadS = (Date.now() - t0) / 1000;
await page.evaluate(() => {
  const v = window.__perf.view, st = window.__fa;
  const wrap = (name, key, count) => { const f = v[name]; if (typeof f !== 'function') return; v[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { st.cur[key] += performance.now() - t; if (count) st.cur[count]++; } }; };
  wrap('frame', 'frame'); wrap('applyWorld', 'apply', 'applyN'); wrap('setWorld', 'setWorld'); wrap('renderScene', 'render','draws'); wrap('presentCorePhases297', 'phases'); wrap('setCorePhase297', 'phaseSet', 'phaseN');
});
const rendererInfo=await page.evaluate(()=>{
  const view=window.__perf.view,context=view.renderer.getContext(),device=context?.getConfiguration?.()?.device;
  // SceneRenderCore.backend is the display string, not Three's backend
  // object. Read the actual renderer backend and adapter as well.
  const native=view.renderer.backend?.isWebGPUBackend===true;
  return {backend:native?'webgpu':'webgl',rendererBackend:view.backend,...device?.adapterInfo?{adapter:{vendor:device.adapterInfo.vendor,architecture:device.adapterInfo.architecture}}:{}};
});
const result = { loadS,...rendererInfo,compositor:uncapped?'uncapped':'standard',...cadence?{cadence}:{},...orbit?{cameraMotion:'right-button-orbit'}:{} };
const graphicsCounters=()=>{const view=window.__perf.view,opaque=view.ownedOpaqueRevisionMetrics435?.();return {calls:view.stats?.drawCalls,triangles:view.stats?.triangles,matrix:view.worldCoordinateMatrixMetrics?.(),commands:opaque?.drawCommands,opaque,boxes:view.boxes?.spatialMetrics379?.(),plants:view.plants?.spatialMetrics?.(),grass:view.grass?.coverDrawMetrics?.()};};
// Diagnostic outside the timed window. Count the actual element/instance
// ranges of visible meshes in each real pass, including shadows. The renderer
// remains in charge of culling, sorting, submitting and presenting the scene.
async function captureSceneGeometry(){
  const view=window.__perf.view,backend=view.renderer.backend;
  if(!backend.isWebGPUBackend)return;
  const groups=new Map(),names=new Map(),rows=new Map();
  for(const [name,part] of Object.entries(view)){
    if(part?.isObject3D)groups.set(part,name);
    else if(part?.group?.isObject3D)groups.set(part.group,name);
  }
  const describe=o=>{
    let name=names.get(o);if(name)return name;
    const path=[];for(let a=o;a;a=a.parent){if(groups.has(a)){path.push(groups.get(a));break;}if(a.name)path.push(a.name);}
    name=path.reverse().join('/')||'scene';names.set(o,name);return name;
  };
  const original=backend.draw;
  backend.draw=function(ro,info){
    const p=ro.getDrawParameters();
    if(p){const object=ro.object,material=ro.material,pass=ro.context?.renderTarget?'target':'screen';
      const key=[describe(object),material.name||material.type,...Object.keys(object.userData).sort().slice(0,4),pass].join('|');
      const row=rows.get(key)??{key,draws:0,triangles:0,instances:0};
      const indirect=ro.getIndirect?.();
      if(indirect){
        const offset=ro.getIndirectOffset(),list=Array.isArray(offset)?offset:[offset];
        for(const bytes of list){const at=bytes/4,count=indirect.array[at],instances=indirect.array[at+1];row.draws++;row.instances+=instances;row.triangles+=object.isMesh?count*instances/3:0;}
      }else{row.draws++;row.triangles+=object.isMesh?p.vertexCount*p.instanceCount/3:0;row.instances+=p.instanceCount;}
      rows.set(key,row);}
    return original.call(this,ro,info);
  };
  try{for(let i=0;i<14;i++)await new Promise(resolve=>requestAnimationFrame(resolve));}
  finally{backend.draw=original;}
  return [...rows.values()].sort((a,b)=>b.triangles-a.triangles).slice(0,40);
}
// Attribution is deliberately outside the performance window. A render-
// object can execute a nested shadow pass; charge that pass to its own mesh.
async function captureSceneCpu(){
  const view=window.__perf.view,renderer=view.renderer,backend=renderer.backend;
  if(!backend.isWebGPUBackend)return;
  const originals=[],groups=new Map(),names=new WeakMap(),rows=new Map();
  for(const [name,part] of Object.entries(view)){if(part?.isObject3D)groups.set(part,name);else if(part?.group?.isObject3D)groups.set(part.group,name);}
  const describe=object=>{let name=names.get(object);if(name)return name;const path=[];for(let o=object;o;o=o.parent){if(groups.has(o)){path.push(groups.get(o));break;}if(o.name)path.push(o.name);}name=(path.reverse().join('/')||'scene')+'|'+object.material?.type;names.set(object,name);return name;};
  const wrap=(owner,key,make)=>{const fn=owner[key];if(typeof fn!=='function')return;const own=Object.getOwnPropertyDescriptor(owner,key);owner[key]=make(fn);originals.push(()=>own?Object.defineProperty(owner,key,own):delete owner[key]);};
  let active;
  wrap(renderer,'renderObject',fn=>function(...a){const o=a[0],k=describe(o),row=rows.get(k)??{key:k,ms:0,draws:0,attributes:0,bindings:0,bytes:0};rows.set(k,row);const outer=active;active=row;const t=performance.now();try{return fn.apply(this,a);}finally{const elapsed=performance.now()-t;row.ms+=elapsed;row.draws++;if(outer)outer.ms-=elapsed;active=outer;}});
  wrap(backend,'updateAttribute',fn=>function(attr,...args){if(active){active.attributes++;const size=attr.array?.BYTES_PER_ELEMENT??0;active.bytes+=attr.updateRanges?.length?attr.updateRanges.reduce((n,r)=>n+r.count*size,0):attr.array?.byteLength??0;}return fn.call(this,attr,...args);});
  wrap(backend,'updateBinding',fn=>function(...args){if(active)active.bindings++;return fn.apply(this,args);});
  try{for(let i=0;i<120;i++)await new Promise(done=>requestAnimationFrame(done));}finally{for(const reset of originals.reverse())reset();}
  return [...rows.values()].sort((a,b)=>b.ms-a.ms).slice(0,60);
}
for (const speed of speeds.split(',').map(Number)) {
  await page.evaluate(s => window.__perf.speedTo(s), speed);
  await page.waitForTimeout(5000);
  const cdp = process.env.PROFILE ? await ctx.newCDPSession(page) : undefined;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  let drag;
  if(orbit){
    drag=await page.evaluate(()=>{const r=window.__perf.view.renderer.domElement.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.43,amplitude:Math.min(210,r.width*.2)};});
    if(!(drag.amplitude>0))throw Error('No visible renderer surface for the orbit');
    await page.mouse.move(drag.x-drag.amplitude,drag.y);await page.mouse.down({button:'right'});
  }
  const graphicsStart=await page.evaluate(graphicsCounters);
  await page.evaluate(() => { const st = window.__fa; st.frames = []; st.tasks = []; st.on = true; st.t0 = performance.now(); st.tick0 = window.__perf.world?.tick; st.core0=st.publishedCore; });
  if(drag){
    const start=performance.now(),duration=Number(secs)*1000,period=8000;
    const angles=[];let sampleAt=0;
    // Position is a function of elapsed time, not frame/input throughput.
    // The same drag sweeps the same angular span even when a Full blocks MAIN.
    while(performance.now()-start<duration){const elapsed=performance.now()-start,phase=(elapsed%period)/(period/2),unit=phase<=1?phase:2-phase;await page.mouse.move(drag.x-drag.amplitude+2*drag.amplitude*unit,drag.y);
      if(elapsed>=sampleAt){angles.push(await page.evaluate(()=>{const v=window.__perf.view.captureGraphicsView();return Math.atan2(v.position[0]-v.target[0],v.position[2]-v.target[2]);}));sampleAt=elapsed+1000;}
      await new Promise(done=>setTimeout(done,16));}
    result.orbitAngleSpanRad=Math.max(0,...angles.flatMap(a=>angles.map(b=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))))));
    if(result.orbitAngleSpanRad<.2)throw Error('Right-button input did not actually rotate the camera');
  }else await page.waitForTimeout(Number(secs) * 1000);
  const raw = await page.evaluate(() => { const st = window.__fa; st.on = false; return { frames: st.frames.slice(1), tasks: st.tasks, wallS: (performance.now() - st.t0) / 1000, ticks: (window.__perf.world?.tick ?? 0) - st.tick0, ...(st.core0>=0&&st.publishedCore>=st.core0?{publishedCoreTicks:st.publishedCore-st.core0}:{}) }; });
  if(drag)await page.mouse.up({button:'right'});
  if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(`${out}.x${speed}.cpuprofile`, JSON.stringify(profile)); await cdp.detach(); }
  result['x' + speed] = {...raw,graphicsStart,graphicsEnd:await page.evaluate(graphicsCounters)};
  if(process.env.PERF_SCENE_CENSUS==='1')result['x'+speed].sceneGeometry=await page.evaluate(captureSceneGeometry);
  if(process.env.PERF_SCENE_CPU==='1')result['x'+speed].sceneCpu=await page.evaluate(captureSceneCpu);
  console.log('speed', speed, 'frames', raw.frames.length, 'ticks', raw.ticks);
}
result.errors = errors.slice(0, 5);
writeFileSync(out, JSON.stringify(result));
await browser.close();
