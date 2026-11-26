// ROOT-only, short native browser smoke. All game actions use real mouse/keys.
// Example: node scripts/native-construction-smoke-379.mjs http://127.0.0.1:5297
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openNativeGameJourney,nativeGameControls} from './native-game-journey.mjs';

assert.equal(process.argv.length,3,'Pass one isolated localhost origin, e.g. http://127.0.0.1:5297');
const origin=new URL(process.argv[2]);
assert.equal(origin.pathname,'/');
assert.ok(!origin.search&&!origin.hash,'Pass an origin only');
assert.ok(origin.port&&!['5173','5184'].includes(origin.port),'Use a dedicated test server; preserve user servers');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const folder=resolve(root,'tmp/native-construction-smoke-379',new Date().toISOString().replaceAll(':','-'));
await mkdir(folder,{recursive:true});
const report={status:'running',folder,origin:origin.href,pageErrors:[],errors:[],served:[],captures:[],saves:[],scope:'Camp 32, seed42; real UI wall placement, selected ghost F permission/live inspector, worker context query, observed option order, fade/dismissal. No fixture, API commands, saves, or performance claims.'};
const persist=()=>writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2));
await persist();
// Read-only observations of the actual menu and retained page. No commands or
// World writes are added; normal UI gestures remain the only mutation path.
const hook=String.raw`
Object.defineProperty(window,'__nativeConstructionSmoke379',{get(){
 const menu=nativeUi?.floatMenu,page=nativeUi?.page;
 return {tool:currentTool,selectedPawnIds:[...selection.ids],pageId:page?.id,
  menu:menu?{id:menu.page.id,rows:menu.page.rows.map(r=>({id:r.id,label:r.label,controls:r.controls?.map(c=>({id:c.id,label:c.label,disabled:!!c.disabled,floatMenuPriority:c.floatMenuPriority,orderInPriority:c.orderInPriority}))}))}:null};
}});
`;
let journey,page;
try{
 journey=await openNativeGameJourney({root,origin,budgetMs:120000,report,persist,driverPath:fileURLToPath(import.meta.url),hook});
 page=await journey.newPage();
 const controls=nativeGameControls({page,journey,report,persist,schema:379});
 const {wait,ready,click,management,worldClick}=controls;
 const ui=()=>page.evaluate(()=>window.__lisiere.nativeUi);
 const observation=()=>page.evaluate(()=>window.__nativeConstructionSmoke379);
 const capture=async label=>{const path=resolve(folder,label+'.png');await page.screenshot({path});report.captures.push({label,path,ui:await ui(),observation:await observation()});await persist();};
 await page.goto(new URL('/?scenario=camp&size=32&seed=42&e2e',origin).href,{waitUntil:'domcontentloaded',timeout:45000});
 await wait(()=>window.__lisiere?.backend==='WebGPU'&&window.__lisiere.hasActiveMap&&!window.__lisiere.busy&&window.__lisiere.speed===1,null,45000);
 await page.keyboard.press('Space');await ready();
 assert.equal(await page.locator('button,select,dialog,input').count(),0,'native game has no hidden HTML control path');
 const baseline=await page.evaluate(()=>({tick:window.__lisiere.tick,schema:window.__lisiere.world.schemaVersion}));
 assert.equal(Number(baseline.schema),379,'Run against the corrected schema379 sources');report.baseline=baseline;

 await management('architect');await click('category-structure');await click('tool-wall-select');
 await wait(()=>window.__nativeConstructionSmoke379.tool==='wall'&&!window.__lisiere.nativeUi.page);
 // Pick the first clear, visible central soil cell in a fixed center-out order.
 // Projection and raycast are diagnostic reads, never placement shortcuts.
 const cell=await page.evaluate(()=>{
  const w=window.__lisiere.world,candidates=[];
  for(let z=4;z<w.height-4;z++)for(let x=4;x<w.width-4;x++)candidates.push({x,z});
  candidates.sort((a,b)=>(a.x-16)**2+(a.z-16)**2-((b.x-16)**2+(b.z-16)**2)||a.z-b.z||a.x-b.x);
  return candidates.find(c=>{
   const t=w.tiles[c.z*w.width+c.x],p=window.__nativeJourney.cellPoint(c);
   return t?.terrain==='soil'&&!t.fogged&&p?.visible&&!p.blocked&&p.hit?.x===c.x&&p.hit?.z===c.z&&p.x>220&&p.x<1200&&p.y>180&&p.y<720
    &&!w.structures.some(s=>Math.abs(s.x-c.x)<=3&&Math.abs(s.z-c.z)<=3)
    &&![...w.resources,...w.jobs,...w.pawns,...w.piles.filter(p=>p.owner.type==='ground').map(p=>p.owner)].some(o=>Math.abs(o.x-c.x)<=1&&Math.abs(o.z-c.z)<=1);
  });
 });
 assert.ok(cell,'clear unobstructed camp soil cell');report.cell=cell;
 await worldClick(cell);
 await wait(c=>window.__lisiere.world.jobs.some(j=>j.kind==='wall'&&j.x===c.x&&j.z===c.z),cell);
 const job=await page.evaluate(c=>window.__lisiere.world.jobs.find(j=>j.kind==='wall'&&j.x===c.x&&j.z===c.z),cell);report.jobId=job.id;
 await page.keyboard.press('Escape');await wait(()=>window.__nativeConstructionSmoke379.tool==='select');
 await worldClick(cell);
 await wait(()=>window.__lisiere.nativeUi.controls.some(c=>c.id==='object-action-material-permission'&&c.label==='Interdire'));
 const inspector=await observation(),tick=await page.evaluate(()=>window.__lisiere.tick);
 await capture('01-selected-ghost-allowed');
 await page.keyboard.press('f');
 await wait(id=>window.__lisiere.world.jobs.find(j=>j.id===id)?.forbidden379===true&&window.__lisiere.nativeUi.controls.some(c=>c.id==='object-action-material-permission'&&c.label==='Autoriser'),job.id);
 assert.equal((await observation()).pageId,inspector.pageId,'same inspector updated without reopening');
 assert.equal(await page.evaluate(()=>window.__lisiere.tick),tick,'F permission accepted while paused at the same tick');
 await capture('02-selected-ghost-forbidden-live');
 await page.keyboard.press('f');
 await wait(id=>!window.__lisiere.world.jobs.find(j=>j.id===id)?.forbidden379&&window.__lisiere.nativeUi.controls.some(c=>c.id==='object-action-material-permission'&&c.label==='Interdire'),job.id);
 assert.equal((await observation()).pageId,inspector.pageId);
 assert.equal(await page.evaluate(()=>window.__lisiere.tick),tick);
 await capture('03-selected-ghost-restored-live');

 // Select an existing worker by the native pawn projection, then right-click
 // the actual wall cell. The worker performs its normal async access query.
 await page.keyboard.press('Escape');
 const worker=await page.evaluate(()=>window.__lisiere.world.pawns.filter(p=>!p.prisoner&&!p.draft&&p.state!=='dead'&&p.priorities.build>0).sort((a,b)=>a.priorities.build-b.priorities.build||a.id-b.id).map(p=>({id:p.id,point:window.__lisiere.projectPawn(p.id)})).find(p=>p.point&&p.point.x>150&&p.point.x<1250&&p.point.y>150&&p.point.y<780));
 assert.ok(worker,'existing visible builder');await page.mouse.click(worker.point.x,worker.point.y);
 await wait(id=>window.__nativeConstructionSmoke379.selectedPawnIds.length===1&&window.__nativeConstructionSmoke379.selectedPawnIds[0]===id,worker.id);
 const workerInspector=(await ui()).basePage;
 const target=await page.evaluate(c=>window.__nativeJourney.cellPoint(c),cell);
 assert.ok(target?.visible&&!target.blocked,'ghost remains unobstructed for real right click');
 await page.mouse.click(target.x,target.y,{button:'right'});
 await wait(()=>{const m=window.__nativeConstructionSmoke379.menu;return m&&m.id==='native-orders'&&m.rows.length>0&&!m.rows.some(r=>r.id==='order-message'||r.id==='order-refusal')&&m.rows.some(r=>r.controls?.length);},null,15000);
 const completed=await observation(),menuUi=await ui();
 assert.equal(menuUi.basePage,workerInspector,'access query preserves the worker inspector');
 const options=completed.menu.rows.flatMap(r=>r.controls??[]);
 const expected=[...options].sort((a,b)=>Number(a.disabled)-Number(b.disabled)||((b.floatMenuPriority??4)-(a.floatMenuPriority??4))||((b.orderInPriority??0)-(a.orderInPriority??0)));
 const ids=new Set(options.map(c=>c.id));
 const rendered=menuUi.controls.filter(c=>ids.has(c.id)).sort((a,b)=>a.y-b.y);
 assert.equal(rendered.length,options.length,'all observed context options are on screen');
 assert.deepEqual(rendered.map(c=>c.id),expected.map(c=>c.id),'actual screen order follows observed provider priorities, disabled last, stable ties');
 report.context={workerId:worker.id,options,observedPriorities:[...new Set(options.map(c=>c.floatMenuPriority??4))],limitation:'Only naturally present camp options were exercised; complete priority permutations remain unit-tested.'};
 await capture('04-real-worker-context-query-complete');
 const box=menuUi.floatMenu,scale=menuUi.displayScale;
 assert.ok(box&&scale>0);
 const left=box.x-5-96>0,side=left?-1:1,edge=left?box.x-5:box.x+box.width+5;
 const y=(box.y+box.height/2)*scale;
 const halfX=(edge+side*47.5)*scale,farX=(edge+side*96)*scale;
 assert.ok(farX>0&&farX<1440,'fade/dismiss pointer stays inside viewport');
 await page.mouse.move(halfX,y);
 await wait(()=>{const m=window.__lisiere.nativeUi.floatMenu;return m&&Math.abs(m.opacity-.5)<.02;});
 await capture('05-real-context-half-fade');
 await page.mouse.move(farX,y);await wait(()=>!window.__lisiere.nativeUi.floatMenu);
 assert.equal((await ui()).basePage,workerInspector,'distance dismissal retains the inspector');
 await capture('06-distance-dismissal-retains-inspector');
 await ready();
 assert.deepEqual(await page.evaluate(()=>window.__lisiere.incident),{simulationStopped:false,graphicsFault:false,waiting:0});
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.errors,[]);
 await journey.verify();report.status='passed';
}catch(error){report.status='failed';report.failure=String(error?.stack??error);process.exitCode=1;}
finally{if(journey)await journey.close();else await persist();}
console.log(JSON.stringify({status:report.status,report:resolve(folder,'report.json'),failure:report.failure}));
