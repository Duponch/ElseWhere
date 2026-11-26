import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// A supplied URL permits the same check against a compiled local package.
// Large development ESM graphs can exceed Chromium's pending request budget.
const targetUrl=process.env.HARVEST_URL??'http://127.0.0.1:5173/';
const ready=async()=>{try{return (await fetch(targetUrl,{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}};
let server;
try {
  if(process.env.HARVEST_LOCAL_BUILD&&process.env.HARVEST_PREINSTRUMENTED!=='1')throw Error('Offline presentation requires a compiled probe');
  if(!process.env.HARVEST_LOCAL_BUILD&&!await ready()) {
    if(process.env.HARVEST_URL)throw Error('Configured presentation URL is not ready');
    server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--strictPort'],{stdio:'ignore',windowsHide:true});
    const until=Date.now()+20000;while(!await ready()){if(Date.now()>until||server.exitCode!==null)throw Error('Vite did not become ready');await sleep(250);}
  }
  await new Promise((ok,fail)=>{
    const run=spawn(process.execPath,['--experimental-transform-types','scripts/harvest-sync-bench.mjs','verification'],{stdio:'inherit',windowsHide:true,env:{...process.env,HARVEST_BROWSER:process.env.HARVEST_BROWSER??(process.platform==='win32'?'chrome':'chromium'),HARVEST_VERIFY:'1',HARVEST_VERIFY_SPEED:'1',HARVEST_SWITCHES:'1',HARVEST_INITIAL_SPEED:'1',HARVEST_SPEEDS:'6,1,3',HARVEST_SECONDS:'45',HARVEST_ACTIONS:'mine,chop'}});
    const timeout=setTimeout(()=>{run.kill();fail(Error('Presentation check exceeded 180 seconds'));},180000);
    run.on('error',e=>{clearTimeout(timeout);fail(e);});run.on('exit',code=>{clearTimeout(timeout);code===0?ok():fail(Error(`Presentation check failed (${code})`));});
  });
} finally {server?.kill();}
