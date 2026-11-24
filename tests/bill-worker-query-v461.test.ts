import {mockRequestId298} from './request-id-binding298';
import {afterEach,expect,test,vi} from 'vitest';
import {SimulationClient} from '../src/bridge/SimulationClient';
import type {Request,Response} from '../src/bridge/protocol';
import type {SnapshotEncoder} from '../src/bridge/snapshots';
import type {MotionRecorder} from '../src/bridge/motion-tracks';
import {createWorld} from '../src/sim/engine';
import {newCookingBill} from '../src/sim/cooking-bills';
import {finalizeInitialWorldRegistry} from '../src/sim/world-map-context';
import type {World} from '../src/sim/types';
import type {BillWorkerOptions283} from '../src/sim/bill-worker-state-283';
import {nativeOrderPage,type NativeOrderClient} from '../src/ui3d/native-orders';
import type {NativePage} from '../src/ui3d/native-contract';
import type {OrderOption} from '../src/sim/player-orders';

// Transport scheduling only is doubled. The query and human/map owners below
// are the real implementations; no simulated work or campaign is claimed.
const loaded=vi.hoisted(()=>({world:undefined as unknown}));
vi.mock('../src/sim/serialization',async importOriginal=>({
 ...await importOriginal<typeof import('../src/sim/serialization')>(),
 deserializeCampaign:()=>loaded.world,
}));

class Port {
 static current:Port;
 onmessage?:(event:MessageEvent<Response>)=>void;onerror?:unknown;onmessageerror?:unknown;
 requests:Request[]=[];terminate(){}
 constructor(){Port.current=this;}
 postMessage(request:Request){this.requests.push(structuredClone(request));}
 deliver(response:unknown){this.onmessage!({data:response} as MessageEvent<Response>);}
}
class Client extends SimulationClient {protected override createWorker():Worker{return new Port() as unknown as Worker;}}
const options=():BillWorkerOptions283=>({structureId:11,billId:12,skill:'cooking',candidates:[{pawnId:3,name:'Alix',level:7,description:'sur carte · métier activé',enabled:true}],selected:{pawnId:4,name:'Noé',level:null,description:'hors carte ou contenu',enabled:false}});
afterEach(()=>{loaded.world=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});

test('client metadata settles on its correlated JSON reply without world adoption or another request',async()=>{
 const client=new Client(),port=Port.current,snapshot=vi.fn(),fault=vi.fn();client.onSnapshot=snapshot;client.onFault=fault;
 const promise=client.billWorkerOptions(11,12),request=port.requests[0]!;
 expect(request).toMatchObject({type:'bill-worker-options',structureId:11,billId:12});
 port.deliver({type:'reply',id:mockRequestId298(request)+1,ok:true,data:JSON.stringify(options())});
 port.deliver({type:'reply',id:mockRequestId298(request),ok:true,data:JSON.stringify(options()),checkpoint:{epoch:99,revision:99}});
 expect(await promise).toEqual(options());expect(port.requests).toHaveLength(1);expect(snapshot).not.toHaveBeenCalled();expect(fault).not.toHaveBeenCalled();expect(client.hasActiveMap).toBe(false);
 client.dispose();
});

test('client rejects malformed, wrong-target and duplicate-candidate JSON while preserving transport state',async()=>{
 const invalid:unknown[]=[null,{...options(),structureId:99},{...options(),skill:['cooking']},{...options(),extra:1},{...options(),candidates:[options().candidates[0],options().candidates[0]]},{...options(),selected:{...options().selected,level:21}}];
 const client=new Client(),port=Port.current,snapshot=vi.fn();client.onSnapshot=snapshot;
 for(const value of invalid){const result=client.billWorkerOptions(11,12),rejected=expect(result).rejects.toThrow('liste des personnes'),request=port.requests.at(-1)!;port.deliver({type:'reply',id:mockRequestId298(request),ok:true,data:JSON.stringify(value)});await rejected;}
 const malformed=client.billWorkerOptions(11,12),rejected=expect(malformed).rejects.toThrow('illisible');port.deliver({type:'reply',id:mockRequestId298(port.requests.at(-1)!),ok:true,data:'{'});await rejected;
 const before=port.requests.length;await expect(client.billWorkerOptions(0,12)).rejects.toThrow('invalide');expect(port.requests).toHaveLength(before);expect(snapshot).not.toHaveBeenCalled();expect(client.hasActiveMap).toBe(false);client.dispose();
});

async function runtime(){
 const world=createWorld(461,32,32);
 const bill=newCookingBill(world.nextId++),station={id:world.nextId++,kind:'campfire' as const,x:15,z:8,orientation:0 as const,footprint:'standard' as const,bills:[bill],fuel:{ticks:6000,burned:0,autoRefuel:false}};
 world.structures.push(station);finalizeInitialWorldRegistry(world);loaded.world=world;
 let revision=0;const packets:Response[]=[],encode=vi.fn((view:World,_ms:number,speed:number,checkpoint:boolean)=>({type:'snapshot',kind:checkpoint?'checkpoint':'delta',epoch:1,revision:++revision,world:view,stepMs:0,speed})),capture=vi.fn();
 const encoder={discardDraftPreview(){},encode} as unknown as SnapshotEncoder<true>;
 const recorder={reset(){},capture,snapshot(){return [];}} as unknown as MotionRecorder;
 const scope={onmessage:undefined as unknown as (event:MessageEvent<Request>)=>void} as unknown as DedicatedWorkerGlobalScope;
 vi.stubGlobal('setInterval',()=>1);
 const {startSimulationWorker}=await import('../src/bridge/simulation-runtime');
 startSimulationWorker(scope,packet=>packets.push(structuredClone(packet)),encoder,undefined,()=>recorder);
 const request=(packet:Request)=>scope.onmessage!({data:packet} as MessageEvent<Request>);
 request({type:'load',id:1,data:'declared real source owner fixture'});
 expect(packets.at(-1),JSON.stringify(packets)).toMatchObject({type:'reply',id:1,ok:true});
 packets.length=0;encode.mockClear();capture.mockClear();
 return {world,bill,station,packets,encode,capture,request};
}

test('worker queries actual humans and replies once without capture, publication, revision or whole-world mutation',async()=>{
 const f=await runtime(),before=JSON.stringify(f.world),pawn=f.world.pawns[0]!;
 f.request({type:'bill-worker-options',id:2,structureId:f.station.id,billId:f.bill.id});
 expect(f.packets).toHaveLength(1);const reply=f.packets[0]!;expect(reply).toMatchObject({type:'reply',id:2,ok:true});if(reply.type!=='reply')throw Error('Missing metadata reply');
 const view=JSON.parse(reply.data!) as BillWorkerOptions283;
 expect(view).toMatchObject({structureId:f.station.id,billId:f.bill.id,skill:'cooking'});expect(view.candidates.find(p=>p.pawnId===pawn.id)).toMatchObject({name:pawn.name,level:pawn.skills.cooking?.level??0});
 expect(reply.checkpoint).toBeUndefined();expect(f.encode).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
});

test('worker missing/invalid targets refuse without a fault, publication or source mutation',async()=>{
 const f=await runtime(),before=JSON.stringify(f.world);
 for(const [structureId,billId] of [[f.world.nextId+100,f.bill.id],[f.station.id,f.world.nextId+101],[f.station.id,0]])f.request({type:'bill-worker-options',id:2,structureId:structureId!,billId:billId!});
 expect(f.packets).toHaveLength(3);for(const packet of f.packets)expect(packet).toMatchObject({type:'reply',ok:false,outcome:'refused'});
 expect(f.packets.some(p=>p.type==='fault'||p.type==='snapshot')).toBe(false);expect(f.encode).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
});

test('worker uses the authoritative active-map selection and refuses metadata when no local map is selected',async()=>{
 const f=await runtime();expect(f.world.worldMaps).toBeDefined();f.world.worldMaps!.selectedMapId=null;const before=JSON.stringify(f.world);
 f.request({type:'bill-worker-options',id:2,structureId:f.station.id,billId:f.bill.id});
 expect(f.packets).toEqual([{type:'reply',id:2,ok:false,outcome:'refused',reason:'Aucune carte locale sélectionnée.'}]);expect(f.encode).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
});

test('civilian ground-pile orders settle through the real worker query without a publication',async()=>{
 const f=await runtime(),pawn=f.world.pawns[0]!;
 // A food pile is a guaranteed order provider even when a policy disables eating.
 const pile={id:f.world.nextId++,kind:'food' as const,item:'survival-meal' as const,quantity:3,owner:{type:'ground' as const,x:pawn.x,z:pawn.z}};
 f.world.piles.push(pile);
 const pages:NativePage[]=[];
 const client:NativeOrderClient={
  command:async()=>undefined,currentWorld:()=>f.world,currentSelectedPawnIds:()=>[pawn.id],
  orderOptions:async(pawnId,x,z,queue)=>{
   f.request({type:'order-options',id:2,pawnId,x,z,queue:queue??false});
   expect(f.packets).toHaveLength(1);
   const reply=f.packets[0]!;expect(reply).toMatchObject({type:'reply',id:2,ok:true});
   if(reply.type!=='reply')throw Error('Missing order reply');
   return JSON.parse(reply.data!) as OrderOption[];
  },
 };
 await nativeOrderPage(f.world,[pawn.id],pile.owner,300,200,false,undefined,client,page=>pages.push(page));
 expect(pages[0]?.rows[0]?.label).toBe('Vérification des accès…');
 expect(pages.at(-1)?.floatMenu).toEqual({x:300,y:200});
 expect(pages.at(-1)?.rows.some(row=>row.label.startsWith('Consommer'))).toBe(true);
 expect(f.encode).not.toHaveBeenCalled();expect(f.capture).not.toHaveBeenCalled();
});
