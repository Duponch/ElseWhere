// Measurement tool (not product code). Writes a Vite config for a profiling
// build of the real client: the shared perf build config (bundled, not minified,
// with the window.__perf hook appended to src/main.ts) plus a per-frame
// attribution of complete publications on the main thread, read by
// scripts/perf-client-publication.mjs:
//   drain  admission queue drained before the frame (all Worker messages adopted then)
//   adopt  resident reader of a complete publication (ResidentVegetationAssembler.adopt)
//   recv   receiveMainSnapshot (HUD, selection, renderer.setWorld), fulls: its calls
//   hud    renderState (the HUD refresh)
// Usage:
//   node scripts/perf-client-publication-config.mjs <shared perf config> <out config>
//   PERF_ROOT=<tree> PERF_OUT=<dir> npx vite build --config <out config>
//   PERF_ROOT=<tree> PERF_OUT=<dir> npx vite preview --config <out config> --port <port>
// The shared config lives outside the repository (tmp/perf/vite.perfbuild.config.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [base, out] = process.argv.slice(2);
if (!base || !out) throw Error('Usage: perf-client-publication-config <shared perf config> <out config>');
let src = readFileSync(base, 'utf8');
const hook = `
window.__c2={cur:null};{const st=window.__c2;const z=()=>({drain:0,adopt:0,recv:0,fulls:0,hud:0});st.cur=z();st.z=z;
 const oD=drainMainAdmissionsBeforeFrame;drainMainAdmissionsBeforeFrame=()=>{const t=performance.now();try{return oD();}finally{st.cur.drain+=performance.now()-t;}};
 const oR=receiveMainSnapshot;receiveMainSnapshot=function(...a){const t=performance.now();try{return oR.apply(this,a);}finally{st.cur.recv+=performance.now()-t;st.cur.fulls++;}};
 const oA=__C2RVA.prototype.adopt;__C2RVA.prototype.adopt=function(...a){const t=performance.now();try{return oA.apply(this,a);}finally{st.cur.adopt+=performance.now()-t;}};
 const oS=renderState;renderState=function(...a){const t=performance.now();try{return oS.apply(this,a);}finally{st.cur.hud+=performance.now()-t;}};}
`;
const anchor = 'const __origStop=client.stop', importAnchor = "import {startingOriginalRequestFromRoster256 as __startingOriginalRequestFromRoster256} from './sim/starting-original-request-256';";
if (!src.includes(anchor) || !src.includes(importAnchor)) throw Error('Unexpected shared perf config: hook anchors not found');
src = src.replace(anchor, hook.replace(/\n/g, ' ') + anchor);
src = src.replace(importAnchor, importAnchor + "import {ResidentVegetationAssembler as __C2RVA} from './bridge/resident-vegetation-assembler';");
writeFileSync(resolve(out), src);
console.log('written', resolve(out));
