import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {World} from '../src/sim/types';
import {harness} from './resident-presentation-fixtures-v427';
import {readResidentCollectionDirectory379,readResidentCollectionChanges379} from '../src/bridge/resident-collection-changes-379';
import {SceneResourceIndex,readSceneResourceFrame} from '../src/render/scene-resource-index';
import {ScenePilePresentation} from '../src/render/ScenePilePresentation';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {WORLD_SCALE} from '../src/world/scale';

function fixture(){const w=createWorld(37933,32,32);w.tiles=w.tiles.map(()=>({terrain:'soil'}));w.structures=[];w.resources=[];w.piles=[];w.jobs=[];return harness(w);}
function readPiles(owner:ScenePilePresentation,w:World,hidden:ReadonlyMap<number,number>=new Map()){
 owner.prepareSupports(w);const result=owner.read(w,hidden);if(!result)throw Error('Missing pile frame');return result;
}

test('accepted collection directories retain exact target ordinals through skipped edges and reject copies, checkpoints and replaced source arrays',()=>{
 const h=fixture();h.world.piles=[0,1,2].map(i=>({id:h.world.nextId++,kind:'wood',item:'wood',quantity:5,owner:{type:'ground',x:2+i,z:2}}));
 const a=h.send(),removed=a.piles[0]!.id;h.world.piles.shift();const b=h.send();h.world.piles.push({id:h.world.nextId++,kind:'wood',item:'wood',quantity:3,owner:{type:'ground',x:8,z:2}});const c=h.send();
 const proof=readResidentCollectionChanges379(a,c,'piles')!;expect(proof.edges).toHaveLength(2);expect(proof.after.source(removed)).toBeUndefined();expect(proof.before.capturedSource(removed)).toBe(0);
 for(let i=0;i<c.piles.length;i++)expect(proof.after.source(c.piles[i]!.id)).toBe(i);
 expect(readResidentCollectionChanges379(a,a,'piles')).toBeUndefined();expect(readResidentCollectionDirectory379(structuredClone(c),'piles')).toBeUndefined();
 const old=b.piles;b.piles=old.slice();expect(readResidentCollectionDirectory379(b,'piles')).toBeUndefined();b.piles=old;expect(readResidentCollectionDirectory379(b,'piles')).toBeUndefined();
 h.send(true);expect(readResidentCollectionChanges379(a,c,'piles')).toBeUndefined();
});

test('native resource removal updates stable memberships and exact target chunks without compacting or reclassifying survivors',()=>{
 const h=fixture(),index=new SceneResourceIndex();h.world.resources=Array.from({length:128},(_,i)=>({id:h.world.nextId++,kind:'berries',x:i%32,z:Math.floor(i/32),amount:5,growth:.5,growthTick:h.world.tick}));
 const a=h.send();index.adopt(a);const initial=index.residentMetrics379()!,removed=h.world.resources.splice(3,1)[0]!.id;
 h.world.resources[4]!.x=30;h.world.resources[4]!.z=30;h.world.resources.push({id:h.world.nextId++,kind:'berries',x:31,z:31,amount:4,growth:.5,growthTick:h.world.tick});const b=h.send();h.send();
 const frame=index.adopt(b),view=readSceneResourceFrame(frame,b,a)!;expect(view).toBeDefined();expect(index.residentMetrics379()!.visits-initial.visits).toBe(2);expect(view.resourceSource(removed)).toBeUndefined();expect(view.previousResourceSource(removed)).toBe(3);
 const changed=new Map([[b.resources[4]!.id,{resource:b.resources[4],size:1}],[b.resources.at(-1)!.id,{resource:b.resources.at(-1),size:1}],[removed,{resource:undefined,size:0}]]);
 const chunks=view.chunksFor(changed)!;for(const chunk of chunks.changedChunks)expect(chunk.resources).toEqual(b.resources.filter(r=>`${Math.floor(r.x/WORLD_SCALE.resourceChunkSize)}:${Math.floor(r.z/WORLD_SCALE.resourceChunkSize)}`===chunk.key));
 // A public transition reconstructs the previous primitive order once, then
 // takes the complete original reader instead of retaining sparse authority.
 const raw=structuredClone(b);raw.resources.reverse();const publicFrame=index.adopt(raw),publicView=readSceneResourceFrame(publicFrame,raw,b)!;expect(index.residentMetrics379()).toBeUndefined();for(let i=0;i<raw.resources.length;i++)expect(publicView.resourceSource(raw.resources[i]!.id)).toBe(i);
});

test('native pile membership changes visit only changed rows while preserving exact bundle/chunk order and pending output',()=>{
 const h=fixture(),owner=new ScenePilePresentation(),literal=new ScenePilePresentation();h.world.piles=Array.from({length:96},(_,i)=>({id:h.world.nextId++,kind:'wood',item:'wood',quantity:5,owner:{type:'ground',x:i%32,z:Math.floor(i/32)}}));
 const a=h.send(),first=readPiles(owner,a);owner.acknowledge(first);const visits=owner.residentMetrics379().visits;
 h.world.piles.splice(2,1);h.world.piles[6]!.quantity=7;h.world.piles.push({id:h.world.nextId++,kind:'wood',item:'wood',quantity:3,owner:{type:'ground',x:30,z:30}});const b=h.send();
 const next=readPiles(owner,b);expect(owner.residentMetrics379().visits-visits).toBe(2);readPiles(literal,b);expect(owner.inspect()).toStrictEqual(literal.inspect());
 const pending=structuredClone(next.changedChunks);const retry=readPiles(owner,b);expect(retry.changedChunks).toStrictEqual(pending);expect(owner.acknowledge(next)).toBe(false);expect(owner.acknowledge(retry)).toBe(true);
});

test('native unchanged pile publications still honor cargo-mask changes immediately',()=>{
 const h=fixture(),owner=new ScenePilePresentation();h.world.piles=[{id:h.world.nextId++,kind:'wood',item:'wood',quantity:9,owner:{type:'ground',x:4,z:4}}];
 const a=h.send(),initial=readPiles(owner,a);owner.acknowledge(initial);const visits=owner.residentMetrics379().visits,b=h.send(),id=b.piles[0]!.id;
 const masked=readPiles(owner,b,new Map([[id,4]]));expect(owner.residentMetrics379().visits-visits).toBe(1);expect(masked.changedChunks[0]!.bundles[0]!.quantity).toBe(5);owner.acknowledge(masked);
 const released=readPiles(owner,b);expect(released.changedChunks[0]!.bundles[0]!.quantity).toBe(9);
});

test('real frontier patch IDs reconcile Full to phase view to next Full without rescanning unchanged piles',()=>{
 const h=fixture(),owner=new ScenePilePresentation(),literal=new ScenePilePresentation();h.world.piles=Array.from({length:96},(_,i)=>({id:h.world.nextId++,kind:'wood',item:'wood',quantity:5,owner:{type:'ground',x:i%32,z:Math.floor(i/32)}}));
 const a=h.send(),initial=readPiles(owner,a);owner.acknowledge(initial);const visits=owner.residentMetrics379().visits,removed=a.piles[0]!.id,updated={...a.piles[2]!,quantity:3},added:World['piles'][number]={id:h.world.nextId++,kind:'wood',item:'wood',quantity:2,owner:{type:'ground',x:30,z:30}};
 const patches=new Map<number,Readonly<World['piles'][number]>|null>([[removed,null],[updated.id,updated],[added.id,added]]);
 const view:World={...a,piles:[...a.piles.filter(p=>p.id!==removed).map(p=>p.id===updated.id?updated:p),added]};
 const supports=owner.readSupports(a)!;owner.registerView297(view,supports,a,patches);const phase=owner.read(view,new Map())!;expect(owner.residentMetrics379().visits-visits).toBe(2);owner.acknowledge(phase);
 literal.registerView297(view,supports);literal.read(view,new Map());expect(owner.inspect()).toStrictEqual(literal.inspect());
 h.world.piles=structuredClone(view.piles);const b=h.send(),next=readPiles(owner,b);expect(owner.residentMetrics379().visits-visits).toBe(4);readPiles(literal,b);expect(owner.inspect()).toStrictEqual(literal.inspect());expect(next.changedChunks).toEqual([]);
});

test('native structure signature follows sparse target IDs across removal, value edit and append instead of reading every survivor',()=>{
 const h=fixture(),signature=new ConfirmedStructurePresentationSignature();h.world.structures=Array.from({length:64},(_,i)=>({id:h.world.nextId++,kind:'wall',material:'wood',x:i%32,z:Math.floor(i/32),orientation:0,footprint:'standard'}));
 const a=h.send(),first=signature.readResident(a,'','');expect(first).toBeDefined();signature.ackFurnitureBuild();const visits=signature.residentMetrics379().visits;
 h.world.structures.splice(3,1);h.world.structures[5]!.material='steel';h.world.structures.push({id:h.world.nextId++,kind:'wall',material:'wood',x:31,z:31,orientation:0,footprint:'standard'});const b=h.send();
 const next=signature.readResident(b,'','');expect(next).not.toBe(first);expect(signature.residentMetrics379().visits-visits).toBe(2);expect(signature.changedKinds()).toEqual(new Set(['wall']));signature.ackFurnitureBuild();
 const c=h.send(),stable=signature.readResident(c,'','');expect(stable).toBe(next);expect(signature.residentMetrics379().visits-visits).toBe(2);
 const raw=structuredClone(c);expect(signature.readResident(raw,'','')).toBeUndefined();const literal=signature.read(raw.structures,'','');raw.structures[0]!.material='steel';expect(signature.read(raw.structures,'','')).not.toBe(literal);
});
