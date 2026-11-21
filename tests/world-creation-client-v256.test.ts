import {mockRequestId298} from './request-id-binding298';
import {afterEach,expect,test,vi} from 'vitest';
import {SimulationClient} from '../src/bridge/SimulationClient';
import {defaultWorldGenerationSettings,worldGenerationKey} from '../src/sim/world-generation-settings';
import {WORLD_FACTION_DEFINITIONS_256} from '../src/sim/world-faction-catalog';
import type {Request,Response} from '../src/bridge/protocol';
import {startingOriginalRequestFromRoster256} from '../src/sim/starting-original-request-256';
import type {WorldCreationRequest256,WorldCreationTicket256} from '../src/ui/world-creation-contract';
// Authority/decoder are transport mocks here. These unit witnesses do not
// generate a local World or claim to validate geometry, owners or native UI.
const decoder=vi.hoisted(()=>({prepared:0,authorized:0,discarded:0,adopted:0,owner:undefined as unknown,receipt:undefined as unknown}));
vi.mock('../src/bridge/snapshots',()=>({SnapshotDecoder:class {
 prepareDraftPreview(packet:{id:number}){decoder.prepared++;const receipt={id:packet.id,owner:decoder.owner};decoder.receipt=receipt;return receipt;}
 authorizeDraftPreview(receipt:unknown){expect(receipt).toBe(decoder.receipt);decoder.authorized++;}
 discardDraftPreview(){decoder.discarded++;}
 adopt(packet:{world:unknown}){decoder.adopted++;return {status:'applied',world:packet.world,replaced:true};}
}}));
class Transport {
 static current:Transport;static instances=0;requests:Request[]=[];onmessage?:(e:MessageEvent<Response>)=>void;onerror?:unknown;onmessageerror?:unknown;terminate=vi.fn();
 constructor(){Transport.current=this;Transport.instances++;}postMessage(p:Request){this.requests.push(structuredClone(p));}deliver(p:unknown){this.onmessage!({data:p} as MessageEvent<Response>);}
}
const actualParty=()=>startingOriginalRequestFromRoster256(7,Array.from({length:8},(_,i)=>({serial:i+1,generation:i,nameOverride:'Original '+(i+1)})));
const startContext=()=>({signal:new AbortController().signal,onProgress:()=>{}});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){vi.stubGlobal('Worker',Transport);const client=new SimulationClient(),worker=Transport.current,controller=new AbortController(),progress=vi.fn();const input:WorldCreationRequest256={seed:' literal \uD83C\uDF32 ',settings:defaultWorldGenerationSettings(),player:{scenario:'crashlanded',playerDef:'PlayerColony',playerName:'Colonie choisie'}};return {client,worker,controller,progress,input};}
function deliverPreview(worker:Transport,request:Extract<Request,{type:'world-draft-generate'}>){
 const input=request.request,defs=[...input.settings.factions,'PlayerColony' as const];decoder.owner={surface:{seedText:input.seed,settings:{coverage:.3,rainfall:3,temperature:3,population:3},tiles:[{id:0},{id:1},{id:2}]},definition:{factions:[...input.settings.factions]}};
 worker.deliver({type:'world-draft-preview',id:request.id,generation:request.generation,key:worldGenerationKey(input.seed,input.settings),request:input,geography:{kind:'definition',id:9,definition:{}},factions:defs.map((def,i)=>({id:i+1,def,name:def==='PlayerColony'?input.player.playerName:'Faction '+i,hidden:WORLD_FACTION_DEFINITIONS_256[def].hidden})),settlements:[]});
 worker.deliver({type:'reply',id:request.id,ok:true});
}
async function prepared(){const f=fixture(),promise=f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress}),request=f.worker.requests.at(-1)!;if(request.type!=='world-draft-generate')throw Error('No generate request');deliverPreview(f.worker,request);const preview=await promise;return {...f,preview,request};}
async function confirmed(){const f=await prepared(),site={generation:f.preview.generation,key:f.preview.key,tile:1,size:250 as const,season:'auto' as const},promise=f.client.confirmWorldDraftSite256(site),request=f.worker.requests.at(-1)!,ticket:WorldCreationTicket256={...site,ticket:'9:site',player:{...f.input.player}};f.worker.deliver({type:'reply',id:mockRequestId298(request),ok:true,data:JSON.stringify(ticket)});return {...f,ticket:await promise};}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();Object.assign(decoder,{prepared:0,authorized:0,discarded:0,adopted:0,owner:undefined,receipt:undefined});Transport.instances=0;});
test('literal parameters/player survive transport copy; preview does not adopt an active World and abort remains effective after preview ACK',async()=>{
 const f=fixture(),promise=f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress}),request=f.worker.requests.at(-1)!;if(request.type!=='world-draft-generate')throw Error('No generate request');const seed=f.input.seed;f.input.seed='later edit';f.input.settings.factions.reverse();
 f.worker.deliver({type:'world-draft-progress',id:request.id,generation:request.generation+1,progress:{phase:'terrain',completed:1,total:2}});expect(f.progress).not.toHaveBeenCalled();f.worker.deliver({type:'world-draft-progress',id:request.id,generation:request.generation,progress:{phase:'terrain',completed:1,total:2}});expect(f.progress).toHaveBeenCalledOnce();deliverPreview(f.worker,request);const preview=await promise;expect(preview.request.seed).toBe(seed);expect(preview.request.player.playerName).toBe('Colonie choisie');expect(decoder.prepared).toBe(1);expect(decoder.adopted).toBe(0);
 f.controller.abort();const cancel=f.worker.requests.at(-1)!;expect(cancel).toMatchObject({type:'world-draft-cancel',generation:preview.generation});f.worker.deliver({type:'reply',id:mockRequestId298(cancel),ok:true});await expect(f.client.confirmWorldDraftSite256({generation:preview.generation,key:preview.key,tile:1,size:250,season:'auto'})).rejects.toThrow('perdue');f.client.dispose();
});
test('confirmed ticket keeps its exact worker and start resolves only after matching accepted replacement checkpoint',async()=>{
 const f=await confirmed(),resolved=vi.fn();expect(f.client.hasConfirmedWorldDraft256(f.ticket)).toBe(true);const start=f.client.startWorldDraft256(f.ticket,actualParty(),startContext()).then(resolved),request=f.worker.requests.at(-1)!;expect(request).toMatchObject({type:'world-draft-start',ticket:f.ticket,maxSettlements:1,threatPauseMode:'major'});expect(decoder.authorized).toBe(1);expect(Transport.instances).toBe(1);
 await expect(f.client.startWorldDraft256(f.ticket,actualParty(),startContext())).rejects.toThrow('perdue');await expect(f.client.load('other')).rejects.toThrow('attend');expect(decoder.discarded).toBe(0);
 f.worker.deliver({type:'reply',id:mockRequestId298(request),ok:true,checkpoint:{epoch:4,revision:1}});await flush();expect(resolved).not.toHaveBeenCalled();f.worker.deliver({type:'snapshot',kind:'checkpoint',epoch:4,revision:1,speed:0,stepMs:0,world:{tick:0},urgentThreats:{generation:1,serial:0,pauseRevision:0,urgentHeld:false,rows:[]}});await start;expect(resolved).toHaveBeenCalledOnce();expect(f.client.hasConfirmedWorldDraft256(f.ticket)).toBe(false);f.client.dispose();
});
test('new generation rejects a late old preview without restoring it or clearing the newer draft',async()=>{
 const f=fixture(),first=f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress}),failure=expect(first).rejects.toThrow(),one=f.worker.requests.at(-1)!;if(one.type!=='world-draft-generate')throw Error('No first generate');const next=new AbortController(),second=f.client.generateWorldDraft256({...f.input,seed:'second'},{signal:next.signal,onProgress:()=>{}}),two=f.worker.requests.at(-1)!;if(two.type!=='world-draft-generate')throw Error('No next generate');deliverPreview(f.worker,one);await failure;expect(decoder.prepared).toBe(0);deliverPreview(f.worker,two);expect((await second).request.seed).toBe('second');expect(decoder.prepared).toBe(1);f.client.dispose();
});
test('abort during generation ignores late progress/preview and never obtains a usable site ticket',async()=>{
 const f=fixture(),promise=f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress}),failure=expect(promise).rejects.toThrow(),request=f.worker.requests.at(-1)!;if(request.type!=='world-draft-generate')throw Error('No generate');f.controller.abort();f.worker.deliver({type:'world-draft-progress',id:request.id,generation:request.generation,progress:{phase:'terrain',completed:1,total:2}});deliverPreview(f.worker,request);await failure;expect(f.progress).not.toHaveBeenCalled();expect(decoder.prepared).toBe(0);expect(decoder.adopted).toBe(0);f.client.dispose();
});

test('a stopped connection restarts before new generation, while a later lost ticket can never restart itself',async()=>{
 const f=fixture();f.client.stop('Connexion perdue');expect(f.worker.terminate).toHaveBeenCalledOnce();const promise=f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress}),worker=Transport.current,request=worker.requests.at(-1)!;expect(worker).not.toBe(f.worker);expect(Transport.instances).toBe(2);if(request.type!=='world-draft-generate')throw Error('No cold generate');deliverPreview(worker,request);const preview=await promise,site={generation:preview.generation,key:preview.key,tile:1,size:250 as const,season:'auto' as const},confirm=f.client.confirmWorldDraftSite256(site),ticket={...site,ticket:'cold:site',player:{...f.input.player}};worker.deliver({type:'reply',id:mockRequestId298(worker.requests.at(-1)!),ok:true,data:JSON.stringify(ticket)});const confirmed=await confirm;f.client.stop('Connexion perdue encore');await expect(f.client.startWorldDraft256(confirmed,actualParty(),startContext())).rejects.toThrow('perdue');expect(Transport.instances).toBe(2);f.client.dispose();
});

test('local start carries all eight chooser entries and correlates progress/cancel to its operation without releasing authorization early',async()=>{
 const f=await confirmed(),controller=new AbortController(),progress=vi.fn(),settled=vi.fn(),party=actualParty();
 const pending=f.client.startWorldDraft256(f.ticket,party,{signal:controller.signal,onProgress:progress}).then(settled),failure=expect(pending).rejects.toThrow();
 const request=f.worker.requests.at(-1)!;if(request.type!=='world-draft-start')throw Error('No local start');expect(request.startingParty.roster).toEqual(party.roster);expect(request.startingParty.selected).toEqual(party.roster.slice(0,3));
 f.worker.deliver({type:'world-draft-progress',id:request.id+99,generation:f.ticket.generation,progress:{phase:'Plants900',completed:12,total:20}});expect(progress).not.toHaveBeenCalled();
 f.worker.deliver({type:'world-draft-progress',id:request.id,generation:f.ticket.generation,progress:{phase:'Plants900',completed:12,total:20}});expect(progress).toHaveBeenCalledOnce();
 controller.abort();const cancel=f.worker.requests.at(-1)!;expect(cancel).toMatchObject({type:'world-draft-cancel',generation:f.ticket.generation,operationId:request.id});
 f.worker.deliver({type:'reply',id:mockRequestId298(cancel),ok:true,data:JSON.stringify({cancelRequested:true})});await flush();expect(settled).not.toHaveBeenCalled();expect(decoder.discarded).toBe(0);await expect(f.client.setSpeed(1)).rejects.toThrow('attend');
 f.worker.deliver({type:'reply',id:request.id,ok:false,outcome:'refused',data:JSON.stringify({worldCreation:'cancelled'}),reason:'La création de la colonie a été annulée.'});await failure;expect(decoder.discarded).toBe(1);f.client.dispose();
});
test('a cancellation received too late preserves the real replacement checkpoint and never claims rollback',async()=>{
 const f=await confirmed(),controller=new AbortController(),resolved=vi.fn(),pending=f.client.startWorldDraft256(f.ticket,actualParty(),{signal:controller.signal,onProgress:()=>{}}).then(resolved),request=f.worker.requests.at(-1)!;
 controller.abort();const cancel=f.worker.requests.at(-1)!;
 f.worker.deliver({type:'reply',id:mockRequestId298(cancel),ok:false,outcome:'refused',reason:'Déjà terminée ; aucune annulation garantie.'});await flush();expect(resolved).not.toHaveBeenCalled();expect(decoder.discarded).toBe(0);
 f.worker.deliver({type:'reply',id:mockRequestId298(request),ok:true,checkpoint:{epoch:8,revision:1}});await flush();expect(resolved).not.toHaveBeenCalled();
 f.worker.deliver({type:'snapshot',kind:'checkpoint',epoch:8,revision:1,speed:0,stepMs:0,world:{tick:0},urgentThreats:{generation:1,serial:0,pauseRevision:0,urgentHeld:false,rows:[]}});await pending;expect(resolved).toHaveBeenCalledOnce();f.client.dispose();
});
test('local start timeout remains pending and does not issue cancellation, restart or a second mutation',async()=>{
 vi.useFakeTimers();const f=await confirmed(),settled=vi.fn(),pending=f.client.startWorldDraft256(f.ticket,actualParty(),startContext()).then(settled),request=f.worker.requests.at(-1)!;
 const status=vi.fn();f.client.onRequestStatus=status;await vi.advanceTimersByTimeAsync(15001);expect(status).toHaveBeenCalledWith(expect.objectContaining({id:mockRequestId298(request),state:'waiting'}));expect(settled).not.toHaveBeenCalled();expect(f.worker.requests.filter(r=>r.type==='world-draft-cancel')).toEqual([]);expect(Transport.instances).toBe(1);
 await expect(f.client.load('other')).rejects.toThrow('attend');f.worker.deliver({type:'reply',id:mockRequestId298(request),ok:false,outcome:'refused',reason:'Producteur sélectionné non disponible.'});await expect(pending).rejects.toThrow('sélectionné');f.client.dispose();
});
test('an active Camp preparation excludes generation before touching its preview or worker',async()=>{
 const f=fixture(),camp=f.client.command({type:'group-enter',groupId:4,mode:'camp'}),campRequest=f.worker.requests.at(-1)!;
 await expect(f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress})).rejects.toThrow('La préparation de la carte locale attend encore sa décision.');expect(f.worker.requests).toHaveLength(1);expect(decoder.prepared).toBe(0);
 f.worker.deliver({type:'reply',id:mockRequestId298(campRequest),ok:false,outcome:'refused',reason:'Camp indisponible.'});await expect(camp).rejects.toThrow('Camp');f.client.dispose();
});

test('a three-entry historical preview cannot consume the confirmed new-world ticket',async()=>{
 const f=await confirmed(),party=actualParty(),legacy={version:party.version,seed:party.seed,selected:party.selected};
 const invoke=f.client.startWorldDraft256.bind(f.client) as (ticket:WorldCreationTicket256,payload:unknown,context:ReturnType<typeof startContext>)=>Promise<void>;
 await expect(invoke(f.ticket,legacy,startContext())).rejects.toThrow('huit');expect(decoder.authorized).toBe(0);expect(f.client.hasConfirmedWorldDraft256(f.ticket)).toBe(true);expect(f.worker.requests.some(r=>r.type==='world-draft-start')).toBe(false);f.client.dispose();
});

test('site confirmation retains200/winter and rejects changed size or season before sending a start',async()=>{
 const f=await prepared(),site={generation:f.preview.generation,key:f.preview.key,tile:1,size:200 as const,season:'winter' as const},promise=f.client.confirmWorldDraftSite256(site),sent=f.worker.requests.at(-1)!;
 expect(sent).toMatchObject({type:'world-draft-confirm',request:site});f.worker.deliver({type:'reply',id:mockRequestId298(sent),ok:true,data:JSON.stringify({...site,ticket:'200:winter',player:f.input.player})});const ticket=await promise;
 expect(f.client.hasConfirmedWorldDraft256(ticket)).toBe(true);expect(f.client.hasConfirmedWorldDraft256({...ticket,size:225})).toBe(false);expect(f.client.hasConfirmedWorldDraft256({...ticket,season:'summer'})).toBe(false);
 await expect(f.client.startWorldDraft256({...ticket,season:'summer'},actualParty(),startContext())).rejects.toThrow('perdue');expect(f.worker.requests.some(r=>r.type==='world-draft-start')).toBe(false);f.client.dispose();
});

test('worker reply cannot silently substitute the requested season',async()=>{
 const f=await prepared(),site={generation:f.preview.generation,key:f.preview.key,tile:1,size:225 as const,season:'winter' as const},promise=f.client.confirmWorldDraftSite256(site),sent=f.worker.requests.at(-1)!;
 f.worker.deliver({type:'reply',id:mockRequestId298(sent),ok:true,data:JSON.stringify({...site,season:'auto',ticket:'wrong-season',player:f.input.player})});await expect(promise).rejects.toThrow('périmée');expect(f.worker.requests.some(r=>r.type==='world-draft-start')).toBe(false);f.client.dispose();
});

test.each([275,300,325] as const)('ordinary size%s survives confirmation and refuses a substituted ticket before local start',async(size)=>{
 const f=await prepared(),site={generation:f.preview.generation,key:f.preview.key,tile:1,size,season:'winter' as const},promise=f.client.confirmWorldDraftSite256(site),sent=f.worker.requests.at(-1)!;
 expect(sent).toMatchObject({type:'world-draft-confirm',request:site});f.worker.deliver({type:'reply',id:mockRequestId298(sent),ok:true,data:JSON.stringify({...site,ticket:`${size}:winter`,player:f.input.player})});const ticket=await promise;
 expect(ticket.size).toBe(size);expect(f.client.hasConfirmedWorldDraft256(ticket)).toBe(true);expect(f.client.hasConfirmedWorldDraft256({...ticket,size:250})).toBe(false);
 await expect(f.client.startWorldDraft256({...ticket,size:250},actualParty(),startContext())).rejects.toThrow('perdue');expect(f.worker.requests.some(r=>r.type==='world-draft-start')).toBe(false);f.client.dispose();
});

test('worker reply cannot silently replace the325 request with a legacy250 size',async()=>{
 const f=await prepared(),site={generation:f.preview.generation,key:f.preview.key,tile:1,size:325 as const,season:'winter' as const},promise=f.client.confirmWorldDraftSite256(site),sent=f.worker.requests.at(-1)!;
 f.worker.deliver({type:'reply',id:mockRequestId298(sent),ok:true,data:JSON.stringify({...site,size:250,ticket:'wrong-size',player:f.input.player})});await expect(promise).rejects.toThrow('périmée');expect(f.worker.requests.some(r=>r.type==='world-draft-start')).toBe(false);f.client.dispose();
});
test('the tutorial scenario reaches the Worker like Atterrissage forcé, another one is refused before sending',async()=>{
 // Found on screen on 21 November 2026: the client refused « tutorial » that the Worker accepts (schema 349).
 const f=fixture();f.input.player={...f.input.player,scenario:'tutorial'};
 const promise=f.client.generateWorldDraft256(f.input,{signal:f.controller.signal,onProgress:f.progress}),request=f.worker.requests.at(-1)!;
 if(request.type!=='world-draft-generate')throw Error('No generate request');
 expect(request.request.player.scenario).toBe('tutorial');deliverPreview(f.worker,request);await promise;f.client.dispose();
 const g=fixture();g.input.player={...g.input.player,scenario:'lost-tribe'};
 await expect(g.client.generateWorldDraft256(g.input,{signal:g.controller.signal,onProgress:g.progress})).rejects.toThrow('Paramètres de création invalides.');
 expect(g.worker.requests.some(r=>r.type==='world-draft-generate')).toBe(false);g.client.dispose();
});
