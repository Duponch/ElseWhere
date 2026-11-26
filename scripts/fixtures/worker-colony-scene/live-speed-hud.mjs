import assert from 'node:assert/strict';

/** Use real mouse events at centers derived from the ordinary native layout,
 * independently of the geometry and hit data reported by the Worker. */
export async function verifyLiveSpeedHud(page,until){
  const canvas=page.locator('#surface > canvas:first-child');
  await page.waitForFunction(()=>window.speedHudPackets>0);
  const states=[];
  async function point(speed){
    const {x,y,width,height}=await canvas.boundingBox();
    const dockScale=Math.min(1.18,(width-32)/860),capacity=Math.max(1,Math.min(12,Math.floor((width-24)/(67.5*dockScale))));
    const rows=height<500&&capacity<12?1:Math.ceil(12/capacity);
    const dockHeight=Math.ceil((.76+(rows-1)*.64)*100*dockScale+8);
    return {x:x+width-8-[118,86,54,22][[0,1,3,6].indexOf(speed)],y:y+height-8-30-Math.max(0,dockHeight-96)-70};
  }
  await page.waitForFunction(()=>document.querySelector('#metrics')?.textContent.includes('dessins/s'));
  for(const speed of [1,3,6,0]){
    const at=await point(speed),acks=await page.evaluate(()=>window.sceneAcks.length);
    await page.mouse.click(at.x,at.y);
    await page.waitForFunction(n=>window.sceneAcks.length===n+1,acks);
    const confirmed=await until((s,v)=>s.speed===v,speed);
    assert.equal(await page.locator('#pick-confirm').isVisible(),false,'HUD click started a world inspection');
    states.push({speed:confirmed.speed,tick:confirmed.tick,at});
  }
  const down=await point(3),up=await point(6);
  const before=await page.evaluate(()=>({acks:window.sceneAcks.length,samples:window.sceneSamples.length}));
  await page.mouse.move(down.x,down.y);await page.mouse.down();await page.mouse.move(up.x,up.y);await page.mouse.up();
  await page.waitForFunction(n=>window.sceneSamples.length>=n+2,before.samples);
  assert.equal(before.acks,await page.evaluate(()=>window.sceneAcks.length),'A release over another button activated it');
  assert.equal(await page.locator('#pick-confirm').isVisible(),false);
  assert.equal(await page.locator('#surface canvas').count(),1,'HUD introduced another surface');
  return states;
}
