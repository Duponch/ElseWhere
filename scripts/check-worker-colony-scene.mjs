// Run from the repository root: node scripts/check-worker-colony-scene.mjs
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, readdir, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {installLocalBuildRoutes} from './local-build-router.mjs';

const sources = resolve('scripts/fixtures/worker-colony-scene');
const advance = process.argv.includes('--advance');
const speedHud = process.argv.includes('--speed-hud');
const full = advance || speedHud || process.argv.includes('--full');
const dist = resolve(process.env.LISIERE_WORKER_COLONY_DIST || 'dist');
const fixture = resolve('public/test-saves/v432/les-forges-crash-test.json');
const origin = 'http://127.0.0.1:5546';
const reports = resolve('tmp/test-runs/worker-colony-scene');
await mkdir(reports, {recursive: true});
const output = await mkdtemp(join(reports, full ? 'full-' : 'run-'));
const site = join(output, 'site');
await mkdir(site);
let simulation;
if(full){
  const names=(await readdir(join(dist,'assets'))).filter(n=>/^presentation\.worker-.*\.js$/.test(n));
  assert.equal(names.length,1,'Build the current client, or select its directory with LISIERE_WORKER_COLONY_DIST');
  const bytes=await readFile(join(dist,'assets',names[0]));
  // A blob worker has no base for relative imports. Refuse a future
  // code-splitting build rather than letting its nested imports silently fail.
  assert.doesNotMatch(bytes.toString('utf8').replace(/^\s*\/\/.*$/gm,''),/\bimport\s*(?:\(|[\w*{'"\s]+from\s*["'])|import\.meta\.url/);
  simulation={url:'/assets/'+names[0],sha:createHash('sha256').update(bytes).digest('hex')};
}
await build({
  entryPoints: [join(sources, 'page.ts'), join(sources, 'worker.ts')],
  outdir: site, format: 'esm', bundle: true, platform: 'browser', target: 'es2023',
  define: {'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"',CHECK_NATIVE_SPEED_HUD:JSON.stringify(speedHud), ...(full && {FROZEN_PRESENTATION_ASSET: JSON.stringify(simulation)})},
  plugins:full?[{
    name:'frozen-full-scene',
    setup(builder){
      builder.onResolve({filter:/^\.\/scene$/},()=>({path:join(sources,'full-scene.ts')}));
      // A nested Worker module request can escape Playwright's offline route.
      // Preserve the native constructor and its real first message listener;
      // change only its asset URL in this diagnostic bundle.
      builder.onLoad({filter:/native-clone-resident\.ts$/},async ({path})=>{
        const input=await readFile(path,'utf8'),locator="new URL('./presentation.worker.ts',import.meta.url)";
        assert.equal(input.split(locator).length,2,'The native presentation Worker constructor changed');
        return {loader:'ts',resolveDir:dirname(path),contents:"import {workerURL} from 'fixture-worker-url';\n"+input.replace(locator,'workerURL()')};
      });
      builder.onResolve({filter:/^fixture-worker-url$/},()=>({path:join(sources,'simulation-asset.ts')}));
    },
  }]:[],
});
await copyFile(join(sources, 'index.html'), join(site, 'index.html'));
const inputSHA256 = createHash('sha256').update(await readFile(fixture)).digest('hex');
const cases = full ? [['first',{view:0}],['repeat',{view:0}],['second',{view:1}],...(advance?[['advanced',{view:0,advanceHour:true}]]:[])] : [
  ['first', {view: 0}], ['repeat', {view: 0}], ['second', {view: 1}],
  ...['walls','doors','pawns','shadows'].map(layer => ['without-'+layer,{view: 0, hide: layer}]),
];
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--mute-audio']});
if(speedHud)cases.push(['hud',{view:0,speedHud:true}]);
const errors = [], captures = {}, observations = {}, differences = {};
try {
  for (const realm of ['window','worker']) {
    const context = await browser.newContext({viewport: {width: 768, height: 512}, deviceScaleFactor: 1});
    try {
      await installLocalBuildRoutes(context, site, origin);
      if(full){
        await context.route(origin+'/assets/**',route=>{
          const name=decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
          if(!/^assets\/[\w.\-/]+$/.test(name)||name.split('/').includes('..'))return route.abort();
          return route.fulfill({path:join(dist,name)});
        });
      }
      await context.route(origin+'/les-forges.json', route => route.fulfill({path: fixture, contentType: 'application/json'}));
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(realm+' '+error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(realm+' '+message.text()); });
      await page.goto(origin+'/?'+realm);
      await page.waitForFunction(() => typeof window.drawColonyView === 'function');
      captures[realm] = {}; observations[realm] = {};
      for (const [name, input] of cases) {
        const data = await page.evaluate(async input => {
          let timer;
          try {
            return await Promise.race([
              window.drawColonyView(input),
              new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Frame submission timed out')), 120000);}),
            ]);
          } finally { clearTimeout(timer); }
        }, input);
        assert.equal(data.worker, realm === 'worker');
        assert.ok(data.drawCalls && data.triangles,JSON.stringify(data));
        if(full){assert.ok(data.visible>10&&data.assets.length>0&&data.world?.length===3);assert.equal(data.phase,null);assert.equal(data.core,data.tick*10);assert.equal(data.world[2],data.tick);}
        else {assert.ok(data.wallTriangles && data.doorLeaves && data.pawns && data.shadowMap, JSON.stringify(data));}
        observations[realm][name] = data;
        // Let the transferred canvas reach the compositor before capturing it.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const screenshot = await page.screenshot({path: join(output,realm+'-'+name+'.png')});
        captures[realm][name] = screenshot.toString('base64');
      }
    } finally { await context.close(); }
  }
  // Decode compositor screenshots in an ordinary 2D canvas. No extra image dependency.
  const oracle = await browser.newPage();
  const result = await oracle.evaluate(async ({captures, names}) => {
    async function rgba(base64) {
      const png = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([png],{type:'image/png'}));
      if (bitmap.width!==768 || bitmap.height!==512) throw Error('Wrong screenshot size');
      const canvas = new OffscreenCanvas(bitmap.width,bitmap.height), ctx=canvas.getContext('2d');
      ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(0,0,canvas.width,canvas.height).data;
    }
    function different(a,b) {
      let changes=0;
      for (let i=0;i<a.length;i+=4) {
        if(a[i]!==b[i] || a[i+1]!==b[i+1] || a[i+2]!==b[i+2] || a[i+3]!==b[i+3]) changes++;
      }
      return changes;
    }
    const reference=await rgba(captures.window.first), parity={}, visibleChanges={};
    for (const name of names) {
      const sample=await rgba(captures.window[name]);
      parity[name]=different(sample,await rgba(captures.worker[name]));
      visibleChanges[name]=different(reference,sample);
    }
    let hud;
    if(captures.window.hud){
      const map=await rgba(captures.window.advanced??captures.window.first),composite=await rgba(captures.window.hud);
      // Same camera and frozen Full. Allow the original controls, including
      // their cut edge, lift and shadow, to occupy their bottom-right strip.
      let inside=0,outside=0;
      for(let p=0;p<map.length;p+=4){
        if(map[p]===composite[p]&&map[p+1]===composite[p+1]&&map[p+2]===composite[p+2]&&map[p+3]===composite[p+3])continue;
        const x=(p/4)%768,y=Math.floor(p/4/768);
        if(x>=601&&y>=360&&y<455)inside++;else outside++;
      }
      hud={inside,outside};
    }
    return {parity,visibleChanges,hud};
  }, {captures,names:cases.map(c=>c[0])});
  Object.assign(differences,result);
  if(speedHud){assert.equal(result.hud.outside,0,'The HUD altered map pixels outside the speed strip');assert.ok(result.hud.inside>1000,'The native controls did not cover the map');}
  assert.deepEqual(errors,[]);
  for(const [name] of cases){
    const {worker: lhs,...native}=observations.window[name],{worker: rhs,...remote}=observations.worker[name];
    assert.deepEqual(remote,native,'Different commands or camera for '+name);
    assert.equal(result.parity[name],0,'Compositor pixel difference for '+name);
    if(name==='first'||name==='repeat') assert.equal(result.visibleChanges[name],0,'Paused image changed');
    else assert.ok(result.visibleChanges[name]>0,'No visible change for '+name);
  }
  console.log('PASS',JSON.stringify(differences));
} finally {
  await writeFile(join(output,'result.json'),JSON.stringify({inputSHA256,simulation,observations,differences,errors},null,2));
  console.log(output);
  await browser.close();
}
