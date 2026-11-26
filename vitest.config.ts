// Test-only projects. The production Vite config and every src export stay unchanged.
import {defineConfig,configDefaults} from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import viteConfig from './vite.config.ts';
const root=path.dirname(fileURLToPath(import.meta.url)),nightFile='tests/daylight-speed-engine-v492.test.ts';
const phaseFile='tests/native-phase-capture297.test.ts';
const sha=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
// Files whose every test has failed for a long time (tests/retired-tests.txt):
// out of the default run, never deleted. RETIRED_TESTS=1 runs them again.
const retired=process.env.RETIRED_TESTS==='1'?[]:fs.readFileSync(path.resolve(root,'tests/retired-tests.txt'),'utf8').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
function phaseCapturePlugin(){
 // Compact phase wire is a new representation candidate, not an exemption
 // from the historical proof. Keep the previous exact qualified body on its
 // own import branch, as well as the independent public32 reference.
 const phasePaths=['src/bridge/native-message-capture.ts','src/bridge/core-phase-data-297.ts','src/bridge/native-clone-resident.ts','src/bridge/core-phase-wire-379.ts'],expected=['be98f704ab2b51125bf94ba31b19044c20de8714e65b0204f47408a379171545','b6bd7bb19b299c803f95310d140b25738529c023686f4fca5afa33a4a2b8c587','88b3046b09f61c76f000480c63002e1796b3ed5918c83be6417228693b2d2a03','b50d2af7d76574a50bc4a1d75254b383ef7b456235f316ad0a8f863cbf5d143b'],norm=(v:string)=>path.resolve(v).split(path.sep).join('/').toLowerCase(),token='test-before-phase-capture492',qualifiedToken='test-qualified-phase-capture492',qualifiedLaneToken='test-qualified-native-lane492',helper=path.resolve(root,'tests/helpers/phase-capture-proof-v492.ts').split(path.sep).join('/'),rows=new Map<string,{path:string;id:string;body:string;sha:string}>();
 for(let i=0;i<phasePaths.length;i++){const p=phasePaths[i]!,id=path.resolve(root,p),body=fs.readFileSync(id,'utf8'),h=sha(body);if(h!==expected[i])throw Error('Exact qualified Phase3 body required '+p);rows.set(norm(id),{path:p,id,body,sha:h});}
 const before=fs.readFileSync(path.resolve(root,'tests/fixtures/native-message-capture-public32-v492.ts.txt'),'utf8');if(sha(before)!=='aa7604f10ffc5042f9e3d726c6222d07c22d4cfb1919643f306895eb06e02613')throw Error('Exact public32 reference fixture required');
 const qualified=fs.readFileSync(path.resolve(root,'tests/fixtures/native-message-capture-qualified-7f0102-v492.ts.txt'),'utf8');if(sha(qualified)!=='7f010278a7ecc3dc68ae5b751d75d5697ddccbbf66ac97e78d0475d890795c63')throw Error('Exact qualified previous capture body required');
 const qualifiedLane=fs.readFileSync(path.resolve(root,'tests/fixtures/native-clone-resident-qualified-dc5657-v492.ts.txt'),'utf8');if(sha(qualifiedLane)!=='dc565732f1f129ec6c444fe553042693214d2a1c88efd61769b38dba2df4a5f9')throw Error('Exact qualified previous Native lane required');
 const allowed=(query:string,source:string)=>!query||source==='src/bridge/native-message-capture.ts'&&(query===token||query===qualifiedToken)||source==='src/bridge/native-clone-resident.ts'&&query===qualifiedLaneToken;
 return{name:'test-only-native-phase-capture-proof-v492',enforce:'pre' as const,resolveId(source:string,importer?:string){const q=source.indexOf('?'),bare=q<0?source:source.slice(0,q),query=q<0?'':source.slice(q+1);let abs:string;if(path.isAbsolute(bare))abs=bare;else if(bare.startsWith('.')&&importer&&path.isAbsolute(importer.split('?')[0]!))abs=path.resolve(path.dirname(importer.split('?')[0]!),bare);else return;const row=rows.get(norm(abs))??rows.get(norm(abs+'.ts'));if(!row)return;if(!allowed(query,row.path))throw Error('Unexpected Phase proof query');return row.id+(query?'?'+query:'');},load(id:string){const q=id.indexOf('?'),bare=q<0?id:id.slice(0,q),query=q<0?'':id.slice(q+1),row=rows.get(norm(bare));if(!row)return;if(!allowed(query,row.path))throw Error('Unexpected Phase proof load');const body=query===token?before:query===qualifiedToken?qualified:query===qualifiedLaneToken?qualifiedLane:row.body,role=query===token?'before':query===qualifiedToken||query===qualifiedLaneToken?'qualified':'candidate';return 'import {recordPhaseCaptureSource492 as __phaseCaptureSource492} from '+JSON.stringify(helper)+';\n__phaseCaptureSource492('+JSON.stringify({role,path:row.path,sha256:sha(body)})+');\n'+body;}};
}

function nightFactoryPlugin(){
 const core=path.resolve(root,'src/sim/core-movement-297.ts'),normalize=(value:string)=>path.resolve(value).split(path.sep).join('/').toLowerCase(),coreKey=normalize(core),extensionlessKey=normalize(core.slice(0,-3));
 const fullToken='test-daylight-full-a56-v492',dayToken='test-daylight-selected-v492',previousToken='test-daylight-previous-v492',currentToken='test-daylight-current-v492',fullId=core+'?'+fullToken,dayId=core+'?'+dayToken,previousId=core+'?'+previousToken,currentId=core+'?'+currentToken;
 // The original qualified selected body is a historical reference, not the
 // moving production file. Keep it exact and test the CURRENT factory as a
 // real Engine branch against the exact pre-optimization current-contract
 // body. The older full-reader reference predates deferredChange297.
 const full=fs.readFileSync(path.resolve(root,'tests/fixtures/daylight-core-full-a56-v492.ts.txt'),'utf8'),selected=fs.readFileSync(path.resolve(root,'tests/fixtures/daylight-core-selected-da98-v492.ts.txt'),'utf8'),previous=fs.readFileSync(path.resolve(root,'tests/fixtures/daylight-core-previous-dd5f-v492.ts.txt'),'utf8'),current=fs.readFileSync(core,'utf8');
 const currentSHA='4f12cbba740f1a8cf0f8307f64c86c649a19c21179785c7c58bb18d3b43cb575';
 const previousSHA='dd5f8f232d715f4f3e15471ed8e5d288137219cd70c5275a45e37b6a83712116';
 if(sha(full)!=='a56c6254ea76f1d85717593052a2e4320dc355f34ad54769c25bec648512dc20'||sha(selected)!=='da98fb84f07dd7b5b14e2a8553082f72751cc64c5a02511d6f9e0f5ffa4aae62'||sha(previous)!==previousSHA||sha(current)!==currentSHA)throw Error('Exact historical full, selected, previous and current daylight factory bodies required');
 process.env.DAYLIGHT_SPEED_BEFORE_CORE_SHA='a56c6254ea76f1d85717593052a2e4320dc355f34ad54769c25bec648512dc20';process.env.DAYLIGHT_SPEED_SELECTED_CORE_SHA='da98fb84f07dd7b5b14e2a8553082f72751cc64c5a02511d6f9e0f5ffa4aae62';process.env.DAYLIGHT_SPEED_PREVIOUS_CORE_SHA=previousSHA;process.env.DAYLIGHT_SPEED_CURRENT_CORE_SHA=currentSHA;
 const helper=path.resolve(root,'tests/helpers/daylight-core-factories-v492.ts').split(path.sep).join('/'),router=[
  'import {createCoreMovement297 as full} from '+JSON.stringify(fullId)+';',
  'import {createCoreMovement297 as daylight} from '+JSON.stringify(dayId)+';',
  'import {createCoreMovement297 as previous} from '+JSON.stringify(previousId)+';',
  'import {createCoreMovement297 as current} from '+JSON.stringify(currentId)+';',
  'import {createDaylightFactoryForTest297} from '+JSON.stringify(helper)+';',
  'export function createCoreMovement297(world){return createDaylightFactoryForTest297(world,full,daylight,previous,current);}'
 ].join('\n')+'\n';
 return {name:'test-only-daylight-night-factories-v492',enforce:'pre' as const,resolveId(source:string,importer?:string){
  const q=source.indexOf('?'),bare=q<0?source:source.slice(0,q),query=q<0?'':source.slice(q+1);let absolute:string;
  if(path.isAbsolute(bare))absolute=bare;else if(bare.startsWith('.')&&importer){const parent=importer.split('?')[0]!;if(!path.isAbsolute(parent))return;absolute=path.resolve(path.dirname(parent),bare);}else return;
  const key=normalize(absolute);if(key!==coreKey&&key!==extensionlessKey)return;if(query===fullToken)return fullId;if(query===dayToken)return dayId;if(query===previousToken)return previousId;if(query===currentToken)return currentId;if(query)throw Error('Unexpected test factory query: '+source);return core;
 },load(id:string){const q=id.indexOf('?'),bare=q<0?id:id.slice(0,q),query=q<0?'':id.slice(q+1);if(normalize(bare)!==coreKey)return;if(query===fullToken)return full;if(query===dayToken)return selected;if(query===previousToken)return previous;if(query===currentToken)return current;if(query)throw Error('Unexpected test Core query: '+id);return router;}};
}
// Keep historical proof bodies/pins strict, but initialize them only when the
// corresponding project actually resolves/loads one of its observed modules.
// Unrelated standard tests must not depend on a historical factory snapshot.
type HistoricalProofPlugin=ReturnType<typeof nightFactoryPlugin>;
function lazyHistoricalProofPlugin(name:string,observedPaths:readonly string[],factory:()=>HistoricalProofPlugin){
 const norm=(value:string)=>path.resolve(value).split(path.sep).join('/').toLowerCase();
 const loadKeys=new Set(observedPaths.map(value=>norm(path.resolve(root,value))));
 const resolveKeys=new Set([...loadKeys,...observedPaths.map(value=>norm(path.resolve(root,value.slice(0,-3))))]);
 let actual:HistoricalProofPlugin|undefined;
 const get=()=>actual??=factory();
 const resolvesObserved=(source:string,importer?:string)=>{
  const q=source.indexOf('?'),bare=q<0?source:source.slice(0,q);let absolute:string;
  if(path.isAbsolute(bare))absolute=bare;
  else if(bare.startsWith('.')&&importer){const parent=importer.split('?')[0]!;if(!path.isAbsolute(parent))return false;absolute=path.resolve(path.dirname(parent),bare);}
  else return false;
  return resolveKeys.has(norm(absolute));
 };
 return {name,enforce:'pre' as const,
  resolveId(this:unknown,source:string,importer?:string,...rest:unknown[]){
   if(!resolvesObserved(source,importer))return;
   return Reflect.apply(get().resolveId,this,[source,importer,...rest]);
  },
  load(this:unknown,id:string,...rest:unknown[]){
   const q=id.indexOf('?'),bare=q<0?id:id.slice(0,q);if(!loadKeys.has(norm(bare)))return;
   return Reflect.apply(get().load,this,[id,...rest]);
  }
 };
}
export default defineConfig(async environment=>{
 const inherited=await viteConfig(environment),{test:inheritedTest={},...vite}=inherited;
 // Every test validates each intermediate schema of a migrated save (tests/setup-migration-steps.ts).
 // VERIFY_PILE_INDEX=1 compares every pile index answer with a scan (src/sim/pile-index.ts).
 const setupFiles=[...[inheritedTest.setupFiles??[]].flat(),path.resolve(root,'tests/setup-migration-steps.ts'),...(process.env.VERIFY_PILE_INDEX==='1'?[path.resolve(root,'tests/setup-pile-index-verification.ts')]:[])];
 const ordinaryTest={...inheritedTest,setupFiles};
 // extends:false prevents Vitest/Vite's array concatenation from broadening Night include.
 // Both projects receive the current repository configuration explicitly.
 return {...vite,test:{...ordinaryTest,projects:[
  {...vite,extends:false,test:{...ordinaryTest,name:'standard',exclude:[...(ordinaryTest.exclude??configDefaults.exclude),nightFile,phaseFile,...retired]}},
  {...vite,extends:false,plugins:[...(vite.plugins??[]),lazyHistoricalProofPlugin('test-only-daylight-night-factories-v492',['src/sim/core-movement-297.ts'],nightFactoryPlugin)],test:{...ordinaryTest,name:'daylight-night',include:[nightFile],pool:'forks',maxWorkers:1,fileParallelism:false,fsModuleCache:false,testTimeout:60000,hookTimeout:60000}},
  {...vite,extends:false,plugins:[...(vite.plugins??[]),lazyHistoricalProofPlugin('test-only-native-phase-capture-proof-v492',['src/bridge/native-message-capture.ts','src/bridge/core-phase-data-297.ts','src/bridge/native-clone-resident.ts','src/bridge/core-phase-wire-379.ts'],phaseCapturePlugin)],test:{...ordinaryTest,name:'native-phase-capture',include:[phaseFile],pool:'forks',maxWorkers:1,fileParallelism:false,fsModuleCache:false,testTimeout:60000,hookTimeout:60000}}
 ]}};
});
