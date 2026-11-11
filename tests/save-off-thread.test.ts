import {mockRequestId298} from './request-id-binding298';
import {afterEach,expect,test,vi} from 'vitest';
import {SimulationClient} from '../src/bridge/SimulationClient';
import {SimulationRequestError} from '../src/bridge/protocol';
import type {Request,Response} from '../src/bridge/protocol';
import type {SaveCheckReply,SaveCheckRequest} from '../src/bridge/save-check';
import {deconstructionCamp} from './scenarios/deconstruction';
import {deserializeCampaign,savedCampaignRefusal,serializeCampaign,serializeCampaignUnchecked} from '../src/sim/serialization';

// A save asks the simulation Worker for its text only and has the text
// validated off that thread (src/bridge/save-check.ts); same text, same refusal.
class Port {
 static current:Port;
 onmessage?:(event:MessageEvent<Response>)=>void;onerror?:unknown;onmessageerror?:unknown;
 requests:Request[]=[];terminate(){}
 constructor(){Port.current=this;}
 postMessage(request:Request){this.requests.push(structuredClone(request));}
 deliver(response:unknown){this.onmessage!({data:response} as MessageEvent<Response>);}
}
/** Runs the real check, asynchronously, like the dedicated Worker. */
class Checker {
 static fail=false;
 onmessage?:(event:MessageEvent<SaveCheckReply>)=>void;onerror?:(event:unknown)=>void;
 checked=0;terminate(){}
 postMessage(request:SaveCheckRequest){this.checked++;queueMicrotask(()=>{
  if(Checker.fail){this.onerror!({});return;}
  this.onmessage!({data:{id:request.id,refusal:savedCampaignRefusal(request.text)??null}} as MessageEvent<SaveCheckReply>);
 });}
}
let checker:Checker|undefined;
class Client extends SimulationClient {
 protected override createWorker():Worker{return new Port() as unknown as Worker;}
 protected override createSaveChecker():Worker|undefined{return checker as unknown as Worker|undefined;}
}
afterEach(()=>{checker=undefined;Checker.fail=false;});
const reply=(port:Port,request:Request,data:string)=>port.deliver({type:'reply',id:mockRequestId298(request),ok:true,data});
const invalid=()=>{const w=deconstructionCamp(1);w.pawns[0]!.x=-3;return w;};

test('the unchecked save text is the checked one, and the text check is the load contract',()=>{
 const w=deconstructionCamp(1),text=serializeCampaignUnchecked(w);
 expect(text).toBe(serializeCampaign(w));expect(savedCampaignRefusal(text)).toBeUndefined();
 expect(deserializeCampaign(text)).toEqual(deserializeCampaign(serializeCampaign(w)));
 // The same invalid world is refused both ways, with the same leading form.
 const bad=invalid();expect(()=>serializeCampaign(bad)).toThrow('Cannot save invalid world: Invalid pawns identity or cell.');
 expect(savedCampaignRefusal(serializeCampaignUnchecked(bad))).toBe('Cannot save invalid world: Invalid pawns identity or cell.');
 expect(savedCampaignRefusal('{')).toMatch(/^Cannot save invalid world: /);
});

test('a client save takes the text from the Worker and validates it off the simulation thread',async()=>{
 checker=new Checker();const client=new Client(),port=Port.current;
 const text=serializeCampaignUnchecked(deconstructionCamp(1));
 const saving=client.save();expect(port.requests[0]).toMatchObject({type:'save',check:'deferred'});
 reply(port,port.requests[0]!,text);
 expect(await saving).toBe(text);expect(checker.checked).toBe(1);expect(port.requests).toHaveLength(1);
 // An invalid world is refused with the in-Worker message, nothing kept.
 const refused=client.save();await Promise.resolve();reply(port,port.requests[1]!,serializeCampaignUnchecked(invalid()));
 await expect(refused).rejects.toBeInstanceOf(SimulationRequestError);
 await expect(refused).rejects.toMatchObject({outcome:'refused'});
 await expect(refused).rejects.toThrow(/^Cannot save invalid world: /);
 client.dispose();
});

test('without a checker, or when it fails, the save keeps the in-Worker validation',async()=>{
 const client=new Client(),port=Port.current,text=serializeCampaignUnchecked(deconstructionCamp(1));
 const saving=client.save();expect(port.requests[0]).toEqual(expect.objectContaining({type:'save'}));expect(port.requests[0]).not.toHaveProperty('check');
 reply(port,port.requests[0]!,text);expect(await saving).toBe(text);client.dispose();
 Checker.fail=true;checker=new Checker();const second=new Client(),port2=Port.current;
 const retried=second.save();reply(port2,port2.requests[0]!,text);
 await vi.waitFor(()=>expect(port2.requests).toHaveLength(2));
 expect(port2.requests[1]).not.toHaveProperty('check');reply(port2,port2.requests[1]!,text);
 expect(await retried).toBe(text);second.dispose();
});
