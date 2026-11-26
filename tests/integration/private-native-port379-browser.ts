import {createNativeCloneResidentLane,createPrivateNativeCloneResidentLane379,isNativeCoreFullAdmissionTicket297,isNativeCorePhaseAdmissionTicket297,readNativeCorePhaseInput297} from '../../src/bridge/native-clone-resident';
import {ResidentVegetationAssembler} from '../../src/bridge/resident-vegetation-assembler';
import {createNativeResidentOwnerChannel379,isOrdinaryResidentOwnerArray379,isOrdinaryResidentOwnerRecord379} from '../../src/bridge/resident-owner-records-379';
import {readResidentWorkerMessage} from '../../src/bridge/resident-protocol';
import type {World} from '../../src/sim/types';

/** Real browser fixed Worker, no synthetic ports, data or admission receipts. */
export async function runPrivateNativePortContracts379(inspect?:(lane:ReturnType<typeof createPrivateNativeCloneResidentLane379>)=>void){
 let assertions=0;const check=(ok:unknown,reason:string)=>{assertions++;if(!ok)throw Error(reason);};
 await checkFreshOwnerChannel(check);
 const legacy=createNativeCloneResidentLane();check(!Object.hasOwn(legacy,'bindOutput'),'Public direct factory exposed private output binding');legacy.close();
 const lane=createPrivateNativeCloneResidentLane379(),worker=lane.createWorker(),strict=new ResidentVegetationAssembler();
 const queue:{run:()=>void;info?:object}[]=[],seen:{type:string;id?:number;epoch?:number;revision?:number}[]=[],replies=new Map<number,unknown>();
 let invalid=0,direct=0,fastFulls=0,phases=0,core=-1,last:World|undefined,lastHeader:{epoch:number;revision:number}|undefined,sequence=0,closed=false,lastPhase:object|undefined;
 const errors:string[]=[];worker.onerror=e=>{errors.push(e.message);};
 worker.addEventListener('message',e=>{if(e.isTrusted)direct++;});
 const stable=(v:unknown)=>{const seen=new Map<object,number>();const walk=(x:any):unknown=>{
  if(x===null||typeof x!=='object')return typeof x==='number'&&Object.is(x,-0)?['number','-0']:x===undefined?['undefined']:x;
  if(seen.has(x))return ['reference',seen.get(x)];seen.set(x,seen.size);
  if(ArrayBuffer.isView(x))return ['typed',x.constructor.name,[...new Uint8Array(x.buffer,x.byteOffset,x.byteLength)]];
  return [Array.isArray(x)?'array':'record',Object.keys(x).map(key=>[key,walk(x[key])])];
 };return JSON.stringify(walk(v));};
 const bind=(source:Worker)=>lane.bindOutput(source,raw=>{
  const row=readResidentWorkerMessage(raw);
  if(row.type==='snapshot'){
   const ref=readResidentWorkerMessage(structuredClone(raw));if(ref.type!=='snapshot')throw Error('Private Full lost literal reference');
   const expected=strict.adopt(ref),actual=lane.reader.adopt(row);
   check(actual.status==='applied'&&expected.status==='applied','Native/private Full refusal');
   if(actual.status!=='applied'||expected.status!=='applied')throw Error('Full not admitted');
   check(stable(actual.world)===stable(expected.world),'Exact private/public-shaped Full reconstruction differs');
   fastFulls++;last=actual.world;lastHeader={epoch:row.epoch,revision:row.revision};core=actual.world.tick*10+(actual.world.phaseCore297??0);
   seen.push({type:'snapshot',epoch:row.epoch,revision:row.revision});
  }else if(row.type==='actor-frontier-297'||row.type==='actor-phase-297'){
   const input=lane.adoptCorePhase297(row),projection=readNativeCorePhaseInput297(input);check(!!projection&&projection.core>=core,'Native private phase precedes its admitted Full');
   if(!projection)throw Error('Missing phase projection');check(projection.world===last,'Phase escaped the committed Full World');lastPhase=input;core=projection.core;phases++;seen.push({type:'phase'});
  }else if(row.type==='reply'){
   check(row.ok,'Actual request refused '+row.id);
   if(row.checkpoint)check(!!lastHeader&&lastHeader.epoch===row.checkpoint.epoch&&lastHeader.revision>=row.checkpoint.revision,'ACK preceded its exact Full');
   replies.set(row.id,row.data);seen.push({type:'reply',id:row.id});
  }else if(row.type==='fault')throw Error(row.reason);
  else seen.push({type:row.type});
 },(run,info)=>queue.push({run,info}),()=>{invalid++;});
 const wait=async(predicate:()=>boolean,drain=true)=>{
  const deadline=performance.now()+30000;
  while(!predicate()){
   if(errors.length||invalid)throw Error('Private native transport failure '+errors.join(',')+' invalid='+invalid);
   if(performance.now()>deadline)throw Error('Native private output timeout');
   const item=drain?queue.shift():undefined;
   if(item){
    const before=seen.length,full=isNativeCoreFullAdmissionTicket297(item.info,item.run),phase=isNativeCorePhaseAdmissionTicket297(item.info,item.run);
    item.run();check(seen.length===before+1,'Private output was not dispatched exactly once');
    if(full||phase){item.run();check(seen.length===before+1,'Redeemed Native output ticket dispatched again');check(!isNativeCoreFullAdmissionTicket297(item.info,item.run)&&!isNativeCorePhaseAdmissionTicket297(item.info,item.run),'Consumed Native output still live');}
   }else await new Promise(done=>setTimeout(done,2));
  }
 };
 const request=async(payload:Record<string,unknown>)=>{const id=++sequence;worker.postMessage({...payload,id});await wait(()=>replies.has(id));return {id,data:replies.get(id)};};
 try{
  let refused=false;try{bind({} as Worker);}catch{refused=true;}check(refused,'Wrong Worker bound to private output');
  bind(worker);refused=false;try{bind(worker);}catch{refused=true;}check(refused,'Private output rebound');
  check(!Reflect.ownKeys(lane).some(k=>lane[k as keyof typeof lane] instanceof MessagePort),'Private port escaped lane');
  // The genuine Worker is exposed only for commands. A synthetic message on
  // its former output does not mint the exact private port/Event receipt.
  const synthetic=new MessageEvent('message',{data:{type:'resident-publication',publication:{type:'snapshot',epoch:1,revision:1,world:{tick:0}}}});
  worker.dispatchEvent(synthetic);check(lane.takeDeferredMessage(worker,synthetic,()=>{throw Error('Synthetic dispatch');})===undefined,'Forged Worker output ticket');check(invalid===0&&queue.length===0,'Synthetic direct event affected the private stream');
  const init=await request({type:'init',seed:640,size:32,paused:true});check(!!last&&fastFulls>0,'Bootstrap failed to publish first Full');check(seen.findIndex(r=>r.type==='snapshot')<seen.findIndex(r=>r.type==='reply'&&r.id===init.id),'Init ACK preceded Full');
  await request({type:'speed',speed:6});await wait(()=>phases>0);await request({type:'speed',speed:0});
  const saved=await request({type:'save'});check(typeof saved.data==='string'&&saved.data.length>100,'Save reply did not use private stream');
  check(direct===0,'Real response escaped ordered private port');check(lane.diagnostics().fastAdoptions===fastFulls&&lane.diagnostics().strictAdoptions===0,'Fixed native proof not retained');
  inspect?.(lane);
  // Hold the actual next genuine ticket. Closing the connection must revoke
  // its authority without applying its Full or the corresponding ACK.
  worker.postMessage({type:'resync',id:++sequence});await wait(()=>queue.some(item=>isNativeCoreFullAdmissionTicket297(item.info,item.run)),false);
  const before=seen.length,held=queue.slice();lane.close();closed=true;for(const item of held){item.run();check(!isNativeCoreFullAdmissionTicket297(item.info,item.run)&&!isNativeCorePhaseAdmissionTicket297(item.info,item.run),'Closed port retained Native receipt');}
  check(seen.length===before,'Closed private port dispatched queued output');check(lastPhase&&readNativeCorePhaseInput297(lastPhase)===undefined,'Closed private port retained renderer phase token');check(errors.length===0&&invalid===0,'Unexpected native error');
  return {status:'passed',assertions,fastFulls,phases,direct,errors,ordered:seen.length};
 }finally{if(!closed)lane.close();worker.terminate();}
}

async function checkFreshOwnerChannel(check:(ok:unknown,reason:string)=>void){
 const source=createNativeResidentOwnerChannel379(),{port1,port2}=source.channel;
 try{
  const visible={path:[{x:1}]},hidden={x:2},sparse=[visible,,visible];
  const packet={type:'resident-publication',publication:{type:'snapshot',actors:sparse},ignored:hidden};
  Object.assign(visible,{cycle:packet});
  port1.dispatchEvent(new MessageEvent('message',{data:packet}));
  check(!isOrdinaryResidentOwnerRecord379(visible),'Synthetic data acquired a native clone identity');
  const arrived=new Promise<MessageEvent<typeof packet>>(resolve=>port1.addEventListener('message',resolve,{capture:true,once:true}));
  port1.start();port2.postMessage(packet);
  const event=await arrived,copy=event.data,actors=copy.publication.actors,row=actors[0]!;
  check(source.arrivalAt(event)!<=performance.now(),'Missing original native arrival');
  check(isOrdinaryResidentOwnerArray379(actors)&&actors.length===3&&!Object.hasOwn(actors,1)&&row===actors[2],'Sparse or aliased clone members lost');
  check(isOrdinaryResidentOwnerRecord379(row)&&isOrdinaryResidentOwnerRecord379(row.path[0]!),'Deep actor lane did not enroll own nested data');
  check(isOrdinaryResidentOwnerRecord379(copy.ignored),'Deep back edge did not revisit the original shallow root');
  const replacement=new Proxy({path:[]},{});
  actors[0]=replacement;
  check(!isOrdinaryResidentOwnerRecord379(replacement)&&!isOrdinaryResidentOwnerArray379(replacement.path),'Postcapture replacement acquired the prior identity');
  source.unobserve();
  const second=new Promise<MessageEvent<typeof packet>>(resolve=>port1.addEventListener('message',resolve,{once:true}));
  port2.postMessage(packet);
  check(!isOrdinaryResidentOwnerRecord379((await second).data),'Closed observer enrolled later packets');
 }finally{source.unobserve();port1.close();port2.close();}
}
