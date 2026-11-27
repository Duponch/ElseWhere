import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {blueprintStorageSettings380} from '../src/sim/blueprint-storage-380.ts';
import {validConstructionTransport379} from '../src/sim/construction-forbid-save-379.ts';
import {newShelfStorage,storageAt} from '../src/sim/shelf-storage.ts';
import {deserializeWorld,serializeWorld,validateWorld,validateCampaignSchema379} from '../src/sim/serialization.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {untilShelfZone} from './scenarios/shelf-zone-v361.ts';
import {blueprintStorageCamp380} from './scenarios/blueprint-storage-380.ts';
import {asOldSchema,asNumberOnly} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type StorageSettings,type World} from '../src/sim/types.ts';

const policy:StorageSettings={filters:{wood:false,food:true,steel:false},items:{rice:true},priority:5,quality:{min:'poor',max:'excellent'},hitPoints:{min:15,max:90},allowFresh:true,allowRotten:false};
function planned(kind:'shelf'|'small-shelf'='small-shelf'){
 const w=blueprintStorageCamp380();expect(applyCommand(w,{type:'designate',kind,x:17,z:18,orientation:1,material:'wood'}).ok).toBe(true);return{w,j:w.jobs.at(-1)!};
}
function exact(w:World){
 expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),adopted=decoder.adopt(structuredClone(encoder.encode(w,0,1)));
 expect(adopted.status).toBe('applied');if(adopted.status==='applied'){expect(adopted.world.jobs).toEqual(w.jobs);expect(adopted.world.structures).toEqual(w.structures);}
 return{encoder,decoder};
}

test.each(['shelf','small-shelf']as const)('380 %s configures its real plan, persists blueprint/frame and copies every setting to the completed paid shelf',kind=>{
 const{w,j}=planned(kind),draft=structuredClone(policy),nextId=w.nextId,pawns=structuredClone(w.pawns),rng=w.rng;
 expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:j.id,settings:draft})).toEqual({ok:true});
 expect(w.nextId).toBe(nextId);expect(w.rng).toBe(rng);expect(w.pawns).toEqual(pawns);expect(storageAt(w,j)).toBeUndefined();
 expect(j.storage380).toMatchObject(policy);expect(j.storage380!.capacity).toBe(500);
 draft.filters!.food=false;draft.items!.rice=false;draft.quality!.min='awful';draft.hitPoints!.min=0;
 expect(j.storage380!.filters.food).toBe(true);expect(j.storage380!.items!.rice).toBe(true);expect(j.storage380!.quality!.min).toBe('poor');expect(j.storage380!.hitPoints!.min).toBe(15);
 const {encoder,decoder}=exact(w),id=j.id,settings=structuredClone(j.storage380);
 addGroundMaterial(w,'wood',kind==='shelf'?20:10,{x:12,z:16},'wood');
 untilShelfZone(w,()=>w.jobs.find(job=>job.id===id)?.construction==='frame',400);expect(j.storage380).toEqual(settings);expect(storageAt(w,j)).toBeUndefined();exact(w);
 expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:id,settings:{priority:4,allowRotten:true}}).ok).toBe(true);
 const frameSettings=structuredClone(j.storage380),copy=deserializeWorld(serializeWorld(w));
 for(let tick=0;tick<400&&!w.structures.some(s=>s.kind===kind);tick++){stepWorld(w);stepWorld(copy);}
 expect(copy).toEqual(w);const shelf=w.structures.find(s=>s.kind===kind)!;expect(shelf).toBeDefined();expect(shelf.shelf!.settings).toEqual(frameSettings);
 expect(shelf.shelf!.settings).not.toBe(j.storage380);expect(shelf.shelf!.settings.filters).not.toBe(j.storage380!.filters);
 expect(shelf.shelf!.cells).toHaveLength(kind==='shelf'?2:1);expect(shelf.id).not.toBe(id);expect(w.jobs.some(job=>job.id===id)).toBe(false);
 const published=decoder.adopt(structuredClone(encoder.encode(w,0,2)));expect(published.status).toBe('applied');if(published.status==='applied'){expect(published.world.jobs).toEqual(w.jobs);expect(published.world.structures).toEqual(w.structures);}exact(w);
},60_000);

test('380 cancelling a configured ghost cannot leak policy to a new job at the same cell',()=>{
 const{w,j}=planned();expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:j.id,settings:policy}).ok).toBe(true);
 expect(applyCommand(w,{type:'cancel-job',jobId:j.id}).ok).toBe(true);
 expect(applyCommand(w,{type:'designate',kind:'small-shelf',x:j.x,z:j.z,orientation:j.orientation,material:'wood'}).ok).toBe(true);
 const replacement=w.jobs.at(-1)!;expect(replacement.id).not.toBe(j.id);expect(replacement.storage380).toBeUndefined();expect(blueprintStorageSettings380(w,replacement.id)).toEqual(newShelfStorage([],w.schemaVersion).settings);
 const before=serializeWorld(w);expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:j.id,settings:policy}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);exact(w);
});

test('380 policy command rejects wrong owners and malformed fields atomically; explicit clears and physical capacity match real shelves',()=>{
 const{w,j}=planned(),before=serializeWorld(w);
 for(const settings of [{priority:6},{filters:{wood:true,food:true,future:true}},{quality:{min:'legendary',max:'poor'}},{future:true},{[Symbol('future')]:true},null]){
  expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:j.id,settings:settings as StorageSettings}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
 }
 expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:w.pawns[0]!.id,settings:policy}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
 expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:j.id,settings:policy}).ok).toBe(true);
 expect(applyCommand(w,{type:'blueprint-storage-policy',jobId:j.id,settings:{capacity:10,items:undefined,quality:undefined,hitPoints:undefined,allowFresh:undefined}}).ok).toBe(true);
 expect(j.storage380!.capacity).toBe(500);for(const key of ['items','quality','hitPoints','allowFresh'])expect(Object.hasOwn(j.storage380!,key)).toBe(false);exact(w);
});

test('379 migrates by number only and configured/future owner fields are refused before migration or snapshot reconstruction',()=>{
 const{w,j}=planned(),current=serializeWorld(w),old=asOldSchema(current,379);
 expect(validateCampaignSchema379(JSON.parse(old))).toEqual([]);expect(serializeWorld(deserializeWorld(old))).toBe(asNumberOnly(current,379));expect(deserializeWorld(old).schemaVersion).toBe(SCHEMA_VERSION);
 const settings=newShelfStorage([],w.schemaVersion).settings;
 for(const envelope of [(value:object)=>({jobs:[value]}),(value:object)=>({secondarySite:{map:{jobs:[value]}}}),(value:object)=>({worldMaps:{sites:[{map:{jobs:[value]}}]}}),(value:object)=>({dynamic:{jobs:{upserted:[value]}}})]){
  const body={kind:'shelf',storage380:settings};expect(validConstructionTransport379(envelope(body),380)).toBe(true);expect(validConstructionTransport379(envelope(body),379)).toBe(false);
 }
 for(const body of [{kind:'bed',storage380:settings},{kind:'shelf',storage380:undefined},{kind:'shelf',storage380:{...settings,future:true}}])expect(validConstructionTransport379({jobs:[body]},380)).toBe(false);
 for(const lane of ['structures','pawns','packed'])expect(validConstructionTransport379({[lane]:[{kind:'shelf',storage380:settings}]},380)).toBe(false);
 const hostile={kind:'shelf'};Object.defineProperty(hostile,'storage380',{enumerable:true,get(){throw Error('getter executed');}});expect(validConstructionTransport379({jobs:[hostile]},380)).toBe(false);
 j.storage380=settings;exact(w);const invalid=JSON.parse(serializeWorld(w));invalid.schemaVersion=379;
 expect(validateCampaignSchema379(invalid).length).toBeGreaterThan(0);expect(()=>deserializeWorld(JSON.stringify(invalid))).toThrow();
});
