import {createPrivateNativeCloneResidentLane379,readNativeCorePhaseInput297,ownsPrivateNativeAuxSection379} from '../../src/bridge/native-clone-resident';
import {readResidentWorkerMessage} from '../../src/bridge/resident-protocol';
import {setResourceJournalVerification} from '../../src/sim/resource-mutation-journal';
import type {NativeSnapshotDispatch379} from '../../src/bridge/native-snapshot-dispatch-379';
import type {World} from '../../src/sim/types';

/** Only the genuine native Full can expose its one-use opaque operations. The
 * production motion/resource owners also run their independent literal-value
 * preparation oracles in this test; no synthetic lease is ever minted. */
export async function runOpaqueNativePortContracts379(){
 let assertions=0;const check=(ok:unknown,why:string)=>{assertions++;if(!ok)throw Error(why);};
 const lane=createPrivateNativeCloneResidentLane379(),worker=lane.createWorker(),queue:(()=>void)[]=[],replies=new Map<number,unknown>();
 let invalid=0,direct=0,fulls=0,phases=0,sequence=0,last:World|undefined,first:World|undefined,firstResources:string|undefined,lastHeader:{epoch:number;revision:number}|undefined,lastView:NativeSnapshotDispatch379|undefined,lastToken:unknown,lastPhase:object|undefined,core=-1;
 const errors:string[]=[];worker.onerror=e=>{errors.push(e.message);};worker.addEventListener('message',e=>{if(e.isTrusted)direct++;});
 setResourceJournalVerification(true);
 lane.bindOwnedOutput379(worker,value=>{
  const opaque=lane.readOwnedSnapshotDispatch379(value);
  if(opaque){
   check(!!value&&typeof value==='object'&&Object.isFrozen(value)&&Reflect.ownKeys(value).length===0,'Opaque native token exposed a raw Full');
   check(Object.isFrozen(opaque)&&!Object.hasOwn(opaque,'world')&&!Object.hasOwn(opaque,'publication')&&!Object.hasOwn(opaque,'auxiliary'),'Opaque operations leaked raw fields');
   check(lane.readOwnedSnapshotDispatch379({...value as object})===undefined&&lane.readOwnedSnapshotDispatch379(new Proxy(value as object,{}))===undefined,'A copied/wrapped token grants authority');
   // This is a valid scalar change and a well-shaped alternate resource
   // graph, not just invalid data. Neither can replace the private source.
   check(!Reflect.defineProperty(value as object,'publication',{value:{world:{tick:125},resources:{growth:new Float64Array([1,.5,0,1])}}})&&!Reflect.set(opaque,'epoch',opaque.epoch+1),'Valid output mutation became an input mutation');
   check(!ownsPrivateNativeAuxSection379(value,'motion',{})&&!ownsPrivateNativeAuxSection379(opaque,'resources',{}),'Opaque dispatch itself leaked a subsection lease');
   check(opaque.acceptsUrgent(()=>true),'Genuine urgent header unavailable');
   const result=opaque.adopt(candidate=>{
    // A planar growth change is well-formed domain data but cannot mutate
    // the private immutable candidate row after section preparation.
    const resource=candidate.resources.find(row=>typeof row.growth==='number');
    if(resource){const growth=resource.growth!;check(!Reflect.set(resource,'growth',growth===.5?.6:.5)&&resource.growth===growth,'Valid growth mutation replaced the prepared resident row');}
    return true;
   });check(result.status==='applied','Opaque Full preparation/oracle refused: '+(result.status==='resync'?result.reason:result.status));
   if(result.status!=='applied')throw Error('Opaque Full was not applied');
   const projection=readNativeCorePhaseInput297(opaque.coreInput());
   check(projection?.world===result.world&&projection.core>=core,'Opaque adoption did not mint the exact committed Core projection');
   if(!projection)throw Error('Missing opaque Core projection');core=projection.core;
   check(opaque.motion()===opaque.motion(),'Opaque motion read lost immutable identity');
   let again=false;try{opaque.adopt(()=>true);}catch{again=true;}check(again,'Opaque Full adopted twice');
   if(first===undefined){first=result.world;firstResources=JSON.stringify(first.resources);}else check(JSON.stringify(first.resources)===firstResources,'Later Full mutated the first retained resource graph');
   last=result.world;lastHeader={epoch:opaque.epoch,revision:opaque.revision};lastView=opaque;lastToken=value;fulls++;return;
  }
  const row=readResidentWorkerMessage(value);
  if(row.type==='snapshot')throw Error('Modern native Full escaped opaque dispatch');
  if(row.type==='actor-phase-297'||row.type==='actor-frontier-297'){
   lastPhase=lane.adoptCorePhase297(row);const p=readNativeCorePhaseInput297(lastPhase);check(!!p&&p.world===last&&p.core>=core,'Phase lost its exact opaque Full');if(p)core=p.core;phases++;
  }else if(row.type==='reply'){
   check(row.ok,'Opaque stream request rejected '+row.id);if(row.checkpoint)check(!!lastHeader&&lastHeader.epoch===row.checkpoint.epoch&&lastHeader.revision>=row.checkpoint.revision,'Opaque ACK preceded Full');replies.set(row.id,row.data);
  }else if(row.type==='fault')throw Error(row.reason);
 },run=>queue.push(run),()=>{invalid++;});
 const wait=async(predicate:()=>boolean)=>{const deadline=performance.now()+45000;while(!predicate()){
  if(invalid||errors.length)throw Error('Opaque stream invalid '+invalid+' '+errors.join(','));if(performance.now()>deadline)throw Error('Opaque stream timeout');
  const run=queue.shift();if(run){run();if(lastView){check(lane.readOwnedSnapshotDispatch379(lastToken)===undefined,'Opaque receipt remained addressable after dispatch');let expired=false;try{lastView.motion();}catch{expired=true;}check(expired,'Opaque read remained valid outside its receipt');}}else await new Promise(done=>setTimeout(done,2));
 }};
 const request=async(payload:Record<string,unknown>)=>{const id=++sequence;worker.postMessage({...payload,id});await wait(()=>replies.has(id));return replies.get(id);};
 try{
  const fake=new MessageEvent('message',{data:{type:'resident-publication',publication:{type:'snapshot',epoch:1,revision:1,world:{tick:0}}}});worker.dispatchEvent(fake);check(!lane.takeDeferredMessage(worker,fake,()=>{throw Error('Forged opaque dispatch');}),'Synthetic worker event minted private authority');
  await request({type:'init',seed:641,size:32,paused:true});check(!!last,'Opaque first Full missing');const initial=last!.tick;
  await request({type:'speed',speed:6});await wait(()=>!!last&&last.tick>=initial+220&&phases>0);await request({type:'speed',speed:0});
  const save=await request({type:'save'});check(typeof save==='string'&&save.length>100,'Opaque stream dropped save');
  const diag=lane.privateAuxiliaryDiagnostics379();check(diag.opaqueFulls===fulls&&diag.motion===fulls&&diag.resources===fulls,'Real private motion/resources lease coverage incomplete '+JSON.stringify(diag));
  check(lane.diagnostics().fastAdoptions===fulls&&lane.diagnostics().strictAdoptions===0&&direct===0,'Opaque Full fell back to public/old source');
  lane.close();check(lastPhase&&readNativeCorePhaseInput297(lastPhase)===undefined,'Close retained opaque phase authority');
  return {status:'passed',assertions,fulls,phases,finalTick:last?.tick,privateAuxiliary:diag,direct,errors};
 }finally{lane.close();worker.terminate();setResourceJournalVerification(false);}
}
