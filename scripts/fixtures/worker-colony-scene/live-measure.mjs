import assert from 'node:assert/strict';

export async function withDeadline(promise,ms){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out waiting for the browser')),ms);});
  try{return await Promise.race([promise,timeout]);}finally{clearTimeout(timer);}
}

export async function measureLiveColony(page,until,initial,requestedSpeed,seconds){
  await page.locator('[data-speed="'+requestedSpeed+'"]').click();
  await page.waitForTimeout(5000);
  await until((s,g)=>s.speed===g.speed&&s.core>=g.core+60,{speed:requestedSpeed,core:initial.core});
  // Bound the exact window by two Worker states as received on the UI.
  // Poll both probes in the UI realm. No CDP command or screenshot is taken
  // while the measured window is open.
  const measure=await withDeadline(page.evaluate(async({speed,seconds})=>{
    const duration=1000*seconds;
    const startIndex=window.sceneSamples.length;
    const start=await new Promise((resolve,reject)=>{
      const deadline=performance.now()+15000;
      const check=()=>{
        if(window.sceneFailures.length||performance.now()>deadline)reject(Error(window.sceneFailures.at(-1)||'First Worker state timed out'));
        else if(window.sceneSamples.length>startIndex)resolve(window.sceneSamples[startIndex]);
        else requestAnimationFrame(check);
      };
      check();
    });
    const startAt=window.sceneTimes[startIndex];
    let last=startAt,finish=0,timer;
    const intervals=[],timerDelays=[];
    function arm(){
      const due=performance.now()+16;
      timer=setTimeout(()=>{if(!finish){timerDelays.push(Math.max(0,performance.now()-due));arm();}},16);
    }
    arm();
    const endIndex=await new Promise((resolve,reject)=>{
      function frame(){
        const now=performance.now();
        if(window.sceneFailures.length||now>startAt+duration+15000){clearTimeout(timer);reject(Error(window.sceneFailures.at(-1)||'Worker state timed out'));return;}
        const latest=window.sceneTimes.length-1;
        if(window.sceneTimes[latest]>=startAt+duration){
          let index=latest;
          while(index>startIndex&&window.sceneTimes[index-1]>=startAt+duration)index--;
          finish=window.sceneTimes[index];
          if(finish>last)intervals.push(finish-last);
          clearTimeout(timer);resolve(index);return;
        }
        intervals.push(now-last);last=now;requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const end=window.sceneSamples[endIndex],uiSeconds=(finish-startAt)/1000;
    const elapsed=(end.sampledAt-start.sampledAt)/1000;
    if(!(elapsed>0&&end.frames>start.frames&&end.core>start.core))throw Error('Worker counters did not progress');
    if(window.sceneSamples.slice(startIndex,endIndex+1).some(s=>s.speed!==speed||s.overflow))throw Error('Speed or native admission changed during measurement');
    function distribution(values){
      values.sort((a,b)=>a-b);
      const p=q=>values[Math.max(0,Math.ceil(values.length*q)-1)];
      return {count:values.length,p50:p(.5),p95:p(.95),p99:p(.99),max:p(1)};
    }
    return {speed,seconds:elapsed,uiSeconds,start,end,drawsPerSecond:(end.frames-start.frames)/elapsed,
      macroTicksPerSecond:(end.core-start.core)/10/elapsed,uiFrameIntervalsMs:distribution(intervals),
      timerDelayMs:distribution(timerDelays),timerPeriodMs:16};
  },{speed:requestedSpeed,seconds}),seconds*1000+35000);
  assert.equal(measure.end.speed,requestedSpeed);
  assert.equal(measure.end.overflow,0);
  await page.evaluate(()=>{
    window.sceneFinalRequest={baseline:window.sceneAcks.length};
    document.querySelector('[data-speed="0"]').addEventListener('click',()=>{window.sceneFinalRequest.at=performance.now();},{capture:true,once:true});
  });
  await page.locator('[data-speed="0"]').click();
  await until(s=>s.speed===0);
  await page.waitForFunction(()=>window.sceneAcks.length>window.sceneFinalRequest.baseline);
  const finalCommand=await page.evaluate(()=>{
    const {at,baseline}=window.sceneFinalRequest,ack=window.sceneAcks[baseline];
    const actual=window.sceneTimes.find((time,i)=>time>=at&&window.sceneSamples[i].speed===0);
    if(ack.error||actual===undefined)throw Error(ack.error??'Pause not confirmed');
    return {request:'pause',actualSpeedMs:actual-at,ackMs:ack.at-at};
  });
  return {measure,finalCommand};
}
