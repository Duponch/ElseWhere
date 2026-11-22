import { expect, test } from '@playwright/test';
import { adulthoodDefinition, childhoodDefinition } from '../../src/sim/colonist-backgrounds.ts';
import { previewBackgroundSkills } from '../../src/sim/background-generation.ts';
import { serializeWorld, validateWorld } from '../../src/sim/serialization.ts';
import { backgroundNativeFixture } from '../helpers/backgrounds-v210.ts';
import { testOutputPath, writeTestFileSync } from '../test-output.ts';
import { expectWorld, observeErrors, panel, pause, saveKey, settledCells, world } from './helpers';
import { inspectPerson, perform, revealCells } from './player-actions';

test('native biographies: exact offer, literal text, keyboard explanations, refused order, capable builder and saved continuation',async({playwright})=>{
  test.setTimeout(120000);
  const fixture=backgroundNativeFixture(),initial=fixture.world,offer=structuredClone(initial.arrivals!.pending!);
  expect(validateWorld(initial)).toEqual([]);
  const browser=await playwright.chromium.launch({channel:'chromium',args:[]});
  try{
    const page=await browser.newPage({baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000}}),errors=observeErrors(page);
    page.setDefaultTimeout(15000);
    await page.addInitScript(({key,data})=>localStorage.setItem(key,data),{key:saveKey,data:serializeWorld(initial)});
    await page.goto('/?scenario=camp&e2e&size=32');await expect(page.locator('#loading')).toHaveCount(0);await pause(page);
    await panel(page,'menu');await page.locator('#load').click();await expectWorld(page,initial);await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>window.__lisiere.backend)).toBe('WebGPU');
    const hardware=await page.evaluate(async()=>{
      const adapter=await navigator.gpu?.requestAdapter(),info=adapter?.info;
      return {vendor:info?.vendor??null,architecture:info?.architecture??null,device:info?.device??null,description:info?.description??null,
        isFallbackAdapter:(info as unknown as {isFallbackAdapter?:boolean}|undefined)?.isFallbackAdapter??(adapter as unknown as {isFallbackAdapter?:boolean}|null)?.isFallbackAdapter??null,
        adapterAvailable:!!adapter};
    });
    expect(hardware.isFallbackAdapter).not.toBe(true);expect(JSON.stringify(hardware)).not.toMatch(/swiftshader|llvmpipe|lavapipe|software adapter|basic render driver/i);
    const hardwareLimit=!hardware.adapterAvailable?'Adaptateur de diagnostic indisponible ; seul le backend WebGPU de Lisière est confirmé.':hardware.isFallbackAdapter===null?'Indicateur de repli indisponible ; identité de l’adaptateur relevée, absence de repli non certifiée par ce signal.':null;
    const speedHitTest=()=>page.locator('[data-speed]').evaluateAll(buttons=>buttons.map(button=>{
      const rect=button.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
      return {speed:button.getAttribute('data-speed'),visible:rect.width>0&&rect.height>0,hit:document.elementFromPoint(x,y)?.closest('[data-speed]')===button};
    }));
    const letter=page.locator('#arrival-letter');await letter.focus();await page.keyboard.press('Enter');
    const dialog=page.locator('#arrival-dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText(offer.name);
    await expect(dialog.locator('i')).toHaveCount(0);
    await expect(dialog.locator('[data-background-stories]')).toContainText(childhoodDefinition(offer.background!.childhood).label);
    if(offer.background!.adulthood)await expect(dialog.locator('[data-background-stories]')).toContainText(adulthoodDefinition(offer.background!.adulthood).label);
    const preview=previewBackgroundSkills(offer.profile,offer.background!);
    const story=dialog.locator('[data-background-stories] li').first();await story.focus();await expect(story).toBeFocused();
    await expect(page.locator('#game-tooltip')).toBeVisible();await expect(page.locator('#game-tooltip')).toContainText('Gains à la création');
    await page.keyboard.press('Escape');await expect(page.locator('#game-tooltip')).toBeHidden();await expect(dialog).toBeVisible();
    await expectWorld(page,initial);
    await page.locator('#postpone-arrival').focus();await page.keyboard.press('Enter');await expect(dialog).toBeHidden();
    await panel(page,'menu');await page.locator('#save').click();await page.locator('#load').click();await expectWorld(page,initial);await page.keyboard.press('Escape');

    await page.setViewportSize({width:1280,height:720});await inspectPerson(page,fixture.restrictedId,'bio');
    const compactBioSpeeds=await speedHitTest();expect(compactBioSpeeds.length).toBeGreaterThanOrEqual(4);expect(compactBioSpeeds.every(b=>b.visible&&b.hit)).toBe(true);
    const bio=page.locator('[data-colonist-panel="bio"]');
    await expect(bio.locator('[data-bio-name]')).toHaveText('<b>Prudent</b> & calme');await expect(bio.locator('[data-bio-name] b')).toHaveCount(0);
    await expect(bio.locator('[data-background-stories]')).toContainText('Éducation pacifique');
    await expect(bio.locator('[data-background-stories]')).toContainText('Négociant');
    await expect(bio.locator('[data-background-restrictions]')).toContainText('Construction');
    await expect(bio.locator('[data-background-restrictions]')).toContainText('Combat');
    const skill=bio.locator('[data-skill-entry="construction"]');await expect(skill).toHaveAttribute('aria-disabled','true');
    await skill.focus();await expect(page.locator('#game-tooltip')).toContainText('n’apprend pas et n’oublie pas');await page.keyboard.press('Escape');
    await panel(page,'work');
    const compactWorkSpeeds=await speedHitTest();expect(compactWorkSpeeds.every(b=>b.visible&&b.hit)).toBe(true);
    const priority=page.locator(`[data-owner="${fixture.restrictedId}"][data-work="build"]`),cell=priority.locator('..');
    await expect(priority).toBeDisabled();await expect(priority).toHaveValue('2');await expect(cell).toHaveAttribute('aria-disabled','true');
    await cell.focus();await expect(cell).toBeFocused();await expect(page.locator('#game-tooltip')).toContainText('Négociant');
    await page.keyboard.press('ArrowUp');await expectWorld(page,initial);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await page.setViewportSize({width:1440,height:1000});

    await inspectPerson(page,fixture.restrictedId);const job=initial.jobs.find(j=>j.id===fixture.jobId)!;
    await revealCells(page,[job]);const [point]=await settledCells(page,[job]),bounds=(await page.locator('#viewport canvas').boundingBox())!;
    await page.mouse.click(bounds.x+point!.x,bounds.y+point!.y,{button:'right'});
    const refused=page.locator(`[data-order-job="${fixture.jobId}"]:not([data-order-haul])`);
    await expect(refused).toBeDisabled();await expect(refused).toContainText('Incapacité liée au passé');await expect(refused).toContainText('Négociant');
    await page.keyboard.press('Escape');await expectWorld(page,initial);
    await perform(page,{reason:'Confier le cadre à la personne qui peut construire.',command:{type:'order-job',pawnId:fixture.builderId,jobId:fixture.jobId,queue:false}},{value:0});
    await expect.poll(async()=>(await world(page)).pawns.find(p=>p.id===fixture.builderId)!.orders.active).toBe(fixture.jobId);
    const ordered=await world(page);await panel(page,'menu');await page.locator('#save').click();await page.locator('#load').click();await expectWorld(page,ordered);await page.keyboard.press('Escape');
    await page.locator('[data-speed="6"]').click();
    await expect.poll(async()=>(await world(page)).structures.some(s=>s.kind==='bed'&&s.x===job.x&&s.z===job.z),{timeout:30000}).toBe(true);
    await pause(page);const built=await world(page),builder=built.pawns.find(p=>p.id===fixture.builderId)!;
    expect(builder.skills.construction.xp).toBeGreaterThan(initial.pawns.find(p=>p.id===fixture.builderId)!.skills.construction.xp);
    expect(built.pawns.find(p=>p.id===fixture.restrictedId)!.skills.construction).toEqual(initial.pawns.find(p=>p.id===fixture.restrictedId)!.skills.construction);
    expect(built.jobs.some(j=>j.id===fixture.jobId)).toBe(false);expect(validateWorld(built)).toEqual([]);

    await page.locator('#arrival-letter').focus();await page.keyboard.press('Enter');await page.locator('#accept-arrival').focus();await page.keyboard.press('Enter');
    await expect.poll(async()=>(await world(page)).pawns.length).toBe(3);
    const joined=await world(page),newcomer=joined.pawns.at(-1)!;
    expect(newcomer.name).toBe(offer.name);expect(newcomer.age).toEqual(offer.age);expect(newcomer.background).toEqual(offer.background);expect(newcomer.skills).toEqual(preview);
    await inspectPerson(page,newcomer.id,'bio');await expect(page.locator('[data-colonist-panel="bio"] [data-bio-name]')).toHaveText(offer.name);
    await expect(page.locator('[data-colonist-panel="bio"] [data-bio-name] i')).toHaveCount(0);
    await page.screenshot({path:testOutputPath('artifacts/backgrounds-v210-native.png')});
    await panel(page,'menu');await page.locator('#save').click();await page.locator('#load').click();await expectWorld(page,joined);expect(errors).toEqual([]);
    writeTestFileSync('artifacts/backgrounds-v210-native.json',JSON.stringify({date:new Date().toISOString(),preparedFixture:true,backend:'WebGPU',hardware,hardwareLimit,compactViewport:{width:1280,height:720,bio:compactBioSpeeds,work:compactWorkSpeeds},offer,orderedTick:ordered.tick,builtTick:built.tick,joinedTick:joined.tick,builderId:builder.id,newcomerId:newcomer.id,literalText:true,keyboardExplanation:true,refusedWork:true,errors},null,2)+'\n');
  }finally{await browser.close();}
});
