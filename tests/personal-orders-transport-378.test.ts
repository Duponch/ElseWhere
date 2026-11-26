import {expect,test} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/engine.ts';
import {finalizeBanishedDepartures378} from '../src/sim/pawn-identity-378.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {SnapshotEncoder,SnapshotDecoder,type SnapshotMessage} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler,setResidentDeltaValidationInterval} from '../src/bridge/resident-presentation-assembler.ts';
import {createNativeCloneResidentLane} from '../src/bridge/native-clone-resident.ts';
import {validPersonalOrdersTransport378} from '../src/bridge/personal-orders-transport-378.ts';
import {WorkerNaturalAppearance} from '../src/bridge/worker-natural-appearance.ts';
import {residentPublication,readResidentWorkerMessage} from '../src/bridge/resident-protocol.ts';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {designateHunt} from '../src/sim/hunting.ts';
import {applyPersonalAnimalOrder378} from '../src/sim/personal-animal-orders-378.ts';
import {campaignPresentation} from '../src/sim/secondary-site-presentation.ts';
import {registryCamp,preparedMap} from './helpers/world-maps-v255.ts';
import {registeredMapId,flushRegisteredMap} from '../src/sim/world-map-context.ts';
import type {World} from '../src/sim/types.ts';

const readers=[
 ['public',()=>({reader:new SnapshotDecoder(),close(){}})],
 ['resident',()=>({reader:new ResidentPresentationAssembler(),close(){}})],
 ['native clone',()=>{const lane=createNativeCloneResidentLane();return {reader:lane.reader,close:()=>lane.close()};}],
] as const;
function harness(factory:typeof readers[number][1],w=createWorld(378,20,20)){
 const lane=factory(),encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),producer=new WorkerNaturalAppearance();
 const packet=(checkpoint=false)=>{const view=campaignPresentation(w),publication=encoder.encode(view,0,1,checkpoint),natural=producer.capture(view,publication);return readResidentWorkerMessage(structuredClone(residentPublication(publication,natural))) as SnapshotMessage<true>;};
 return {...lane,w,packet};
}
test.each(readers)('%s preserves personal title and queue in checkpoints and same-tick sparse deltas',(_name,factory)=>{
 const h=harness(factory),p=h.w.pawns[0]!;p.identity378={revision:1,title:'Artisane'};p.orderedQueue378=[{type:'read-book-295',pawnId:p.id,bookId:h.w.nextId+10}];
 try{
  const first=h.reader.adopt(h.packet());expect(first.status).toBe('applied');
  p.identity378.title='Cheffe';const packet=h.packet();expect(packet.kind).toBe('delta');
  const next=h.reader.adopt(packet);expect(next.status).toBe('applied');if(next.status!=='applied')return;
  expect(next.world.pawns[0]!.identity378).toEqual({revision:1,title:'Cheffe'});expect(next.world.pawns[0]!.orderedQueue378).toEqual(p.orderedQueue378);
 }finally{h.close();}
});
test.each(readers)('%s rejects schema377 future fields and malformed378 data before adoption',(_name,factory)=>{
 for(const version of [377,378])for(const feature of ['identity','queue','hunting','handling','archive'] as const){
  const h=harness(factory);(h.w as unknown as {schemaVersion:number}).schemaVersion=version;
  try{
   const first=h.reader.adopt(h.packet());expect(first.status).toBe('applied');if(first.status!=='applied')continue;
   const before=JSON.stringify(first.world),packet=h.packet(),p=packet.world.pawns[0]!;
   if(feature==='identity')p.identity378=version===377?{revision:1,title:'Cheffe'}:{revision:1,title:''};
   if(feature==='queue')p.orderedQueue378=version===377?[{type:'read-book-295',pawnId:p.id,bookId:1}]:new Array(1);
   if(feature==='hunting')p.hunting={animalId:1,phase:'stalk',startedAt:0,progress:0,forced378:version===377?true:false as true};
   if(feature==='handling')p.animalHandling={kind:'milk',animalId:1,phase:'approach',sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0,forced378:true};
   if(feature==='archive')packet.world.banishedDepartures378=[];
   expect(h.reader.adopt(packet).status,`${version} ${feature}`).toBe('resync');expect(JSON.stringify(first.world)).toBe(before);
  }finally{h.close();}
 }
});
test.each(readers)('%s retains full banished owners and rejects archived item/packed collisions',(_name,factory)=>{
 const w=createWorld(378,20,20),p=w.pawns[0]!;w.tiles=w.tiles.map(()=>({terrain:'soil'}));w.structures=[];w.jobs=[];w.resources=[];
 p.need=null;p.haul=null;p.cooking=null;p.path=[];p.motion=null;p.moveCooldown=0;p.bedId=null;p.orders={active:null,queue:[]};
 addMaterial(w,'wood',7,{type:'inventory',pawnId:p.id},'wood');
 w.packed.push({building:{id:w.nextId++,kind:'stool',x:1,z:1,orientation:0,footprint:'standard',material:'wood',quality:'normal'},owner:{type:'inventory',pawnId:p.id}});
 expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id})).toEqual({ok:true});p.x=0;p.z=10;finalizeBanishedDepartures378(w);refreshStock(w);
 expect(w.banishedDepartures378).toHaveLength(1);const h=harness(factory,w);
 try{
  const first=h.reader.adopt(h.packet());expect(first.status).toBe('applied');if(first.status!=='applied')return;
  expect(first.world.banishedDepartures378).toEqual(w.banishedDepartures378);
  const valid=h.packet(),validResult=h.reader.adopt(valid);expect(validResult.status).toBe('applied');
  for(const feature of ['body','item','packed'] as const){const packet=h.packet(true),d=packet.world.banishedDepartures378![0]!;
   if(feature==='body')d.pawn.id=packet.world.pawns[0]!.id;
   if(feature==='item')d.items[0]!.id=packet.world.pawns[0]!.id;
   if(feature==='packed')d.packed[0]!.building.id=d.items[0]!.id;
   expect(h.reader.adopt(packet).status,feature).toBe('resync');
  }
 }finally{h.close();}
});
test.each(readers)('%s admits the real forced hunting task and retains its exact target',(_name,factory)=>{
 const w=createWorld(378,32,32),p=w.pawns[0]!;w.tiles=w.tiles.map(()=>({terrain:'soil'}));w.resources=[];w.structures=[];w.jobs=[];w.piles=[];delete p.background;delete p.traits;
 p.priorities.hunt=1;p.need=null;p.recreation.task=null;p.haul=null;p.cooking=null;p.path=[];p.orders={active:null,queue:[]};
 addMaterial(w,'weapon',1,{type:'equipment',pawnId:p.id},'revolver');w.resources.push({id:w.nextId++,kind:'berries',x:10,z:10,amount:10,growth:1,growthTick:w.tick});enableWildlife(w,1);const a=w.wildlife!.animals[0]!;a.x=p.x+1;a.z=p.z;
 expect(designateHunt(w,{type:'hunt',animalId:a.id,enabled:true})).toEqual({ok:true});expect(applyPersonalAnimalOrder378(w,{type:'order-animal-378',pawnId:p.id,animalId:a.id,action:'hunt',queue:false})).toEqual({ok:true});
 const h=harness(factory,w);try{const result=h.reader.adopt(h.packet());expect(result.status,JSON.stringify(result.status==='resync'?result.reason:'')).toBe('applied');if(result.status==='applied')expect(result.world.pawns[0]!.hunting).toEqual(p.hunting);}finally{h.close();}
});
test.each(readers)('%s preserves the selected registered map archive through projection',(_name,factory)=>{
 const root=registryCamp(),map=preparedMap(root),p=map.pawns[0]!,mapId=registeredMapId(map)!;
 map.tiles=map.tiles.map(()=>({terrain:'soil'}));map.resources=[];map.structures=[];map.jobs=[];
 expect(applyCommand(root,{type:'map-view',mapId})).toEqual({ok:true});
 expect(applyCommand(map,{type:'pawn-banish',pawnId:p.id})).toEqual({ok:true});p.x=0;p.z=Math.floor(map.height/2);p.path=[];p.motion=null;p.moveCooldown=0;finalizeBanishedDepartures378(map);flushRegisteredMap(map);
 expect(map.banishedDepartures378).toHaveLength(1);expect(applyCommand(root,{type:'map-view',mapId})).toEqual({ok:true});
 const h=harness(factory,root);try{const result=h.reader.adopt(h.packet());expect(result.status,JSON.stringify(result.status==='resync'?result.reason:'')).toBe('applied');if(result.status==='applied'){expect(result.world.banishedDepartures378![0]!.mapId).toBe(mapId);expect(result.world.banishedDepartures378![0]!.pawn).toEqual(p);}}finally{h.close();}
});
test('raw transport guards refuse hidden/accessor fields and future fields in projected offmap/holder owners',()=>{
 const w=createWorld(378,20,20),p=w.pawns[0]!;let reads=0;
 const hidden={...p};Object.defineProperty(hidden,'identity378',{value:{revision:1,title:'Cheffe'}});
 expect(validPersonalOrdersTransport378({pawns:[hidden]},378)).toBe(false);
 const getter={...p};Object.defineProperty(getter,'orderedQueue378',{enumerable:true,get(){reads++;throw Error('no getter');}});
 expect(validPersonalOrdersTransport378({pawns:[getter]},378)).toBe(false);expect(reads).toBe(0);
 for(const task of ['animalCare','animalFeed','animalRescue'])for(const version of [377,378])expect(validPersonalOrdersTransport378({pawns:[{...p,[task]:{forced378:true}}]},version)).toBe(false);
 const future={...p,identity378:{revision:1,title:'Cheffe'}};
 for(const raw of [{worldPawns:{owners:[{actor:future}]}},{worldFactions:{leaders:[{pawn:future}]}},{structures:[{cryptosleep:{human:future}}]},{campaignMap:{groups:[{state:{members:[future]}}]}}])expect(validPersonalOrdersTransport378(raw,377)).toBe(false);
});
test('resident intermediate deltas enforce personal fields while deep validation is throttled',()=>{
 setResidentDeltaValidationInterval(100000);
 const h=harness(readers[1][1]);try{
  expect(h.reader.adopt(h.packet()).status).toBe('applied');expect(h.reader.adopt(h.packet()).status).toBe('applied');
  const packet=h.packet();packet.world.pawns[0]!.identity378={revision:1,banishedAt:packet.world.tick+1};expect(h.reader.adopt(packet).status).toBe('resync');
 }finally{setResidentDeltaValidationInterval(0);h.close();}
});
