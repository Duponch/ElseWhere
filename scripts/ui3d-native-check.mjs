import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:5196';
const folder=resolve('tmp/ui3d-v476',`native-${new Date().toISOString().replaceAll(':','-')}`);
await mkdir(folder,{recursive:true});
const fixture=process.argv.includes('--fixture');
const game=process.argv.includes('--game');
const savesOnly=process.argv.includes('--saves-only');
if(fixture)await writeFile(resolve('tmp/ui3d-v476/native-fixture.html'),`<!doctype html><html lang="fr"><meta charset="UTF-8"><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style><body><script type="module">
import {NativeStage} from '/src/ui3d/NativeStage.ts';
const clicks=[];const stage=new NativeStage({onPanel:id=>clicks.push(id),onEscape:()=>{},onError:message=>console.error(message)});
await stage.ready;stage.setWorldVisible(false);stage.setFrontVisible(false);
window.__nativeFixture={stage,clicks,get ready(){return stage.diagnostics().renders>0;},get ui(){return stage.diagnostics();}};
</script></body></html>`);
const browser=await chromium.launch({executablePath:resolve('.playwright/chromium-1243/chrome-win64/chrome.exe'),headless:false,args:['--mute-audio','--enable-unsafe-webgpu']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await context.addInitScript(()=>{localStorage.setItem('lisiere.audio.effects.enabled.v1','false');localStorage.setItem('lisiere.audio.music.enabled.v1','false');});
const page=await context.newPage(),errors=[];
const budgetMs=game?240000:180000;
const watchdog=setTimeout(()=>{console.error(`Native UI check exceeded its total ${budgetMs/1000}s budget`);void browser.close();},budgetMs);
page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.goto(fixture?`${base}/tmp/ui3d-v476/native-fixture.html`:`${base}/?e2e`,{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>window.__nativeFixture?.ready||window.__lisiere?.nativeUi?.renders>0,null,{timeout:60000});
  const captures=[];
  if(!fixture)assert.equal(await page.locator('button,select,dialog,input').count(),0,'native UI must not retain HTML controls in the active page');
  for(const width of [1440,2547]){
    await page.setViewportSize({width,height:1000});await page.mouse.move(width/2,500);await page.waitForTimeout(600);
    const ui=await page.evaluate(()=>window.__nativeFixture?.ui??window.__lisiere?.nativeUi);
    assert.equal(ui.mode,'native-meshes');assert.equal(ui.error,null);
    await page.screenshot({path:resolve(folder,`${width}x1000.png`)});
    await page.screenshot({path:resolve(folder,`${width}x1000-toolbar.png`),clip:{x:0,y:800,width,height:200}});
    captures.push({width,ui});
  }
  if(fixture){
    const first=await page.evaluate(()=>window.__nativeFixture.ui.management[0]);
    await page.mouse.move(first.x,first.y);await page.waitForTimeout(350);
    await page.screenshot({path:resolve(folder,'hover-toolbar.png'),clip:{x:0,y:800,width:2547,height:200}});
    await page.mouse.click(first.x,first.y);assert.deepEqual(await page.evaluate(()=>window.__nativeFixture.clicks),['architect']);
    await page.mouse.move(first.x,first.y);await page.mouse.down();await page.mouse.move(100,500);await page.mouse.up();
    assert.deepEqual(await page.evaluate(()=>window.__nativeFixture.clicks),['architect']);
    await page.waitForTimeout(800);
    const before=await page.evaluate(()=>window.__nativeFixture.ui.renders);await page.waitForTimeout(400);
    assert.equal(await page.evaluate(()=>window.__nativeFixture.ui.renders),before,'settled meshes must not keep an animation loop running');
    await page.evaluate(()=>{
      const model={value:'avant'},commits=[];window.__nativeFixture.editorModel=model;window.__nativeFixture.commits=commits;
      window.__nativeFixture.stage.showPage({id:'editor-fixture',title:'Édition native',modal:true,rows:[{id:'edit-field',label:'Valeur',input:{value:model.value,onCommit:async text=>{await new Promise(resolve=>setTimeout(resolve,40));if(text==='invalide')return false;model.value=text;return true;}}}],
        actions:[{id:'edit-apply',label:'Appliquer',onActivate:()=>commits.push(model.value)}]});
    });
    const nativePoint=async id=>page.evaluate(id=>window.__nativeFixture.ui.controls.find(control=>control.id===id),id);
    let field=await nativePoint('edit-field');await page.mouse.click(field.x,field.y);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('après');
    let apply=await nativePoint('edit-apply');await page.mouse.click(apply.x,apply.y);
    await page.waitForFunction(()=>window.__nativeFixture.commits.length===1);assert.deepEqual(await page.evaluate(()=>window.__nativeFixture.commits),['après']);
    field=await nativePoint('edit-field');await page.mouse.click(field.x,field.y);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('tabulation');await page.keyboard.press('Tab');
    await page.waitForFunction(()=>window.__nativeFixture.editorModel.value==='tabulation');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__nativeFixture.commits.length===2);assert.deepEqual(await page.evaluate(()=>window.__nativeFixture.commits),['après','tabulation']);
    field=await nativePoint('edit-field');await page.mouse.click(field.x,field.y);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('invalide');
    await page.keyboard.press('Tab');await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>({tag:document.activeElement?.tagName,value:document.activeElement?.value})),{tag:'TEXTAREA',value:'invalide'},'invalid Tab retains the native field and draft');
    apply=await nativePoint('edit-apply');await page.mouse.click(apply.x,apply.y);await page.waitForTimeout(120);
    assert.deepEqual(await page.evaluate(()=>window.__nativeFixture.commits),['après','tabulation'],'rejected edit must not apply the old draft');
  }
  if(game){
    await page.setViewportSize({width:1440,height:1000});
    const click=async(id)=>{
      const deadline=Date.now()+12000;
      for(let attempt=0;Date.now()<deadline;attempt++){
        const target=await page.evaluate(id=>window.__lisiere.nativeUi.controls.find(item=>item.id===id),id);
        if(target?.disabled){await page.waitForTimeout(100);continue;}
        if(target){await page.mouse.click(target.x,target.y);await page.waitForTimeout(250);console.log(JSON.stringify({clicked:id}));return;}
        await page.mouse.move(1200,600);await page.mouse.wheel(0,attempt===0?-10000:250);await page.waitForTimeout(100);
      }
      throw Error(`Native control not reachable: ${id}`);
    };
    await click('load-game');await click('test-colonies');await click('choose-test-eclaircies-v419');await click('load-test');
    await page.waitForFunction(()=>window.__lisiere?.backend==='WebGPU'&&window.__lisiere?.hasActiveMap&&!window.__lisiere?.nativeUi.front&&!window.__lisiere.busy,null,{timeout:120000});
    await page.waitForTimeout(1200);await page.screenshot({path:resolve(folder,'game.png')});
    assert.equal(await page.locator('button,select,dialog,input,.selection-rectangle').count(),0);
    const world=await page.evaluate(()=>window.__lisiere.world);assert.equal(world.pawns.length,3);
    if(!savesOnly){
    const block=await page.evaluate(()=>window.__lisiere.nativeUi.management[0]);
    await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(block.x,block.y,{steps:10});await page.mouse.up();
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__lisiere.nativeUi.page),null,'world drag ending on native UI must cancel without clicking through');
    const tab=await page.evaluate(()=>window.__lisiere.nativeUi.management.find(item=>item.id==='work'));
    await page.mouse.click(tab.x,tab.y);await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.__lisiere.nativeUi.page),'work');
    await page.screenshot({path:resolve(folder,'work.png')});
    await click(`work-${world.pawns[0].id}-build`);
    await page.screenshot({path:resolve(folder,'priority-choice.png')});
    await click('priority-3-choose');
    await page.waitForFunction(id=>window.__lisiere.world.pawns.find(pawn=>pawn.id===id)?.priorities.build===3,world.pawns[0].id,{timeout:15000});
    await page.keyboard.press('Escape');
    await page.screenshot({path:resolve(folder,'game-after-command.png')});
    }
    const management=async id=>{const target=await page.evaluate(id=>window.__lisiere.nativeUi.management.find(item=>item.id===id),id);assert.ok(target,`management ${id}`);await page.mouse.click(target.x,target.y);await page.waitForTimeout(200);};
    const menu=async()=>{if(await page.evaluate(()=>window.__lisiere.nativeUi.page)!=='menu')await management('menu');};
    for(const id of savesOnly?[]:['architect','schedule','assign','animals','wildlife','research','quests','world','history','factions']){
      await management(id);assert.ok(await page.evaluate(()=>window.__lisiere.nativeUi.page),`native panel ${id}`);
      await page.screenshot({path:resolve(folder,`panel-${id}.png`)});await page.keyboard.press('Escape');
    }
    await menu();await click('native-manage-saves');
    assert.equal(await page.evaluate(()=>window.__lisiere.speed),0);
    await click('native-save-name');await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('Qualification carton V476');await click('native-save-create');
    const exportWorld=async name=>{const pending=page.waitForEvent('download').then(file=>({file}),error=>({error}));await click('native-save-export');const result=await pending;if(result.error)throw result.error;const path=resolve(folder,name);await result.file.saveAs(path);return JSON.parse(await readFile(path,'utf8'));};
    const beforeReload=await exportWorld('before-reload.json');
    await click('native-save-select-lisiere.named.v1.1');await click('native-save-load-lisiere.named.v1.1');
    await page.waitForFunction(()=>window.__lisiere.nativeUi.page!=='native-saves'&&window.__lisiere.hasActiveMap&&!window.__lisiere.busy,null,{timeout:120000});
    await menu();await click('native-manage-saves');const afterReload=await exportWorld('after-reload.json');
    assert.deepEqual(afterReload,beforeReload,'paused save/load must conserve the complete exported world');
    await page.keyboard.press('Escape');await menu();await click('native-options');
    assert.equal(await page.evaluate(()=>window.__lisiere.nativeUi.page),'front-options');await page.screenshot({path:resolve(folder,'options.png')});await page.keyboard.press('Escape');
    await click('help');assert.ok(await page.evaluate(()=>window.__lisiere.nativeUi.page?.includes('help')));await page.screenshot({path:resolve(folder,'help.png')});await page.keyboard.press('Escape');
    assert.equal(await page.locator('button,select,dialog,input').count(),0);
    captures.push({case:savesOnly?'save-load-complete-world':'real-world-command',ui:await page.evaluate(()=>window.__lisiere.nativeUi)});
  }
  const result={folder,fixture,captures,errors};await writeFile(resolve(folder,'report.json'),JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({folder,fixture,errors,captures:captures.length}));
}catch(error){
  await page.screenshot({path:resolve(folder,'failure.png')}).catch(()=>{});
  await writeFile(resolve(folder,'failure.json'),JSON.stringify({message:String(error),errors,ui:await page.evaluate(()=>window.__nativeFixture?.ui??window.__lisiere?.nativeUi).catch(()=>null)},null,2));
  throw error;
}finally{clearTimeout(watchdog);await browser.close();}
