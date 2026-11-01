import {expect,test} from 'vitest';
import {ScenePilePresentation,type ScenePileChunks} from '../src/render/ScenePilePresentation';
import {pileParts,type PileBundle} from '../src/render/pile-parts';
import {forbiddenPileIconInstances} from '../src/render/DesignationIconLayer';
import {materialAllowedForPlayer256,setMaterialForbidden256} from '../src/sim/material-permission-256';
import {newApparelState} from '../src/sim/apparel-rules';
import {createMechaMedicalRecord} from '../src/sim/mechanoid-health';
import {SnapshotChangeJournal} from '../src/bridge/snapshots';
import type {MaterialPile,World,Structure,Job} from '../src/sim/types';

// Isolated presentation contracts. Narrow presentation-component input and test-only journal
// witness, following pile-parts-cache-v475. No World constructor, simulated
// progression, human save, full validity claim or GPU object is used here.
function world(piles:MaterialPile[],structures:Structure[]=[],jobs:Job[]=[]):World {
 return {seed:912,width:16,height:16,tick:0,schemaVersion:298,piles,structures,jobs} as unknown as World;
}
function wood(id:number,x=4,z=4):MaterialPile{return {id,kind:'wood',item:'wood',quantity:10,owner:{type:'ground',x,z}};}
function stamped(w:World){const journal=new SnapshotChangeJournal();journal.reset(w,1,1);return journal;}
function read(owner:ScenePilePresentation,w:World):ScenePileChunks {owner.prepareSupports(w);const frame=owner.read(w,new Map());if(!frame)throw Error('Expected journal-backed projection');return frame;}
function all(owner:ScenePilePresentation){return owner.inspect().flatMap(c=>c.bundles);}
function marks(bundle:PileBundle){
 const plain=pileParts([{...bundle,forbidden:undefined}]),parts=pileParts([bundle]);
 // The item mesh is independent of permission; no two-bar 3D cross remains.
 expect(parts).toEqual(plain);
 return {plain,parts,icons:forbiddenPileIconInstances([bundle])};
}
function attachedIcon(bundle:PileBundle){
 const {plain,icons}=marks(bundle);expect(icons).toHaveLength(1);const icon=icons[0]!;
 const support=bundle.surface?.y??0;
 expect(icon.y).toBeGreaterThan(support);expect(icon.y-support).toBeLessThan(.6);expect(icon.icon).toBe(83);
 expect([icon.cellX,icon.cellZ]).toEqual([bundle.x,bundle.z]);
 return icon;
}

test('same-cell allowed and forbidden material families stay separate and use the actual unified permission rule',()=>{
 const sources:MaterialPile[]=[wood(1,4),{id:3,kind:'weapon',item:'bolt-action-rifle',quantity:1,owner:{type:'ground',x:5,z:4},weapon:{quality:'normal',hitPoints:100}},
  {id:5,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'ground',x:6,z:4},apparel:newApparelState('cloth-shirt')},
  {id:7,kind:'food',item:'turkey-egg-unfertilized',quantity:1,owner:{type:'ground',x:7,z:4}}];
 const piles=sources.flatMap(p=>{const denied=structuredClone(p);denied.id=p.id+1;setMaterialForbidden256(denied,true);expect(materialAllowedForPlayer256(p)).toBe(true);expect(materialAllowedForPlayer256(denied)).toBe(false);return [p,denied];});
 const w=world(piles);stamped(w);const owner=new ScenePilePresentation();read(owner,w);const bundles=all(owner);expect(bundles).toHaveLength(8);
 for(const source of sources){const pair=bundles.filter(b=>b.item===source.item);expect(pair).toHaveLength(2);expect(pair.map(b=>b.quantity)).toEqual([source.quantity,source.quantity]);expect(pair.map(b=>b.forbidden===true)).toEqual([false,true]);
  expect(marks(pair[0]!).icons).toHaveLength(0);attachedIcon(pair[1]!);
 }
 expect(forbiddenPileIconInstances(bundles)).toHaveLength(4);
});

test('permission-only resident edits rebuild the chunk and remove the pictogram without a quantity, location, identity or tick change',()=>{
 const source=wood(1),w=world([source]),journal=stamped(w),owner=new ScenePilePresentation();const a=read(owner,w),ac=a.changedChunks[0]!;
 const firstParts=owner.placements(a,ac),firstSignature=ac.signature;expect(forbiddenPileIconInstances(ac.bundles)).toEqual([]);expect(owner.acknowledge(a)).toBe(true);
 const denied=structuredClone(source);setMaterialForbidden256(denied,true);const w2={...w,piles:[denied]};journal.append(w,w2,1,2,[],[]);
 const b=read(owner,w2);expect(b.changedChunks).toHaveLength(1);const bc=b.changedChunks[0]!;expect(bc.signature).not.toBe(firstSignature);expect(bc.bundles[0]!.forbidden).toBe(true);attachedIcon(bc.bundles[0]!);expect(owner.placements(b,bc)).toEqual(firstParts);owner.acknowledge(b);
 const allowed=structuredClone(denied);setMaterialForbidden256(allowed,false);const w3={...w2,piles:[allowed]};journal.append(w2,w3,1,3,[],[]);
 const c=read(owner,w3);expect(c.changedChunks).toHaveLength(1);const cc=c.changedChunks[0]!;expect(cc.signature).toBe(firstSignature);expect(cc.bundles[0]!.forbidden).toBeUndefined();expect(owner.placements(c,cc)).toEqual(firstParts);expect(forbiddenPileIconInstances(cc.bundles)).toEqual([]);
 expect([allowed.id,allowed.quantity,allowed.owner,w3.tick]).toEqual([source.id,source.quantity,source.owner,w.tick]);
});

test('shelf identity levels keep their own pictogram anchors and retain the item height and scale',()=>{
 const piles=[wood(1),wood(2),wood(3)];for(const p of piles)setMaterialForbidden256(p,true);
 const shelf:Structure={id:100,kind:'small-shelf',x:4,z:4,orientation:1,footprint:'standard',material:'wood',quality:'normal'};
 const w=world(piles,[shelf]);stamped(w);const owner=new ScenePilePresentation();read(owner,w);const bundles=all(owner);expect(bundles).toHaveLength(3);
 expect(bundles.map(b=>b.surface?.level).sort()).toEqual([0,1,2]);
 const icons=forbiddenPileIconInstances(bundles);expect(icons).toHaveLength(3);expect(new Set(icons.map(i=>i.y)).size).toBe(3);
 for(const b of bundles){const s=b.surface!;expect(s.shelfId).toBe(shelf.id);expect(s.scaleHeight).toBe(true);expect(s.scale).toBeLessThan(1);
  const local=pileParts([{...b,surface:undefined}]),supported=pileParts([b]);expect(supported).toHaveLength(local.length);const icon=attachedIcon(b);
  expect(icon.x).toBeCloseTo(b.x+s.x,12);expect(icon.z).toBeCloseTo(b.z+s.z,12);
  for(let i=0;i<local.length;i++){const a=local[i]!,t=supported[i]!;expect(t.x).toBeCloseTo(b.x+(a.x-b.x)*s.scale+s.x,12);expect(t.z).toBeCloseTo(b.z+(a.z-b.z)*s.scale+s.z,12);expect(t.y).toBeCloseTo(a.y*s.scale+s.y,12);
   expect(t.sx).toBeCloseTo((a.sx??1)*s.scale,12);expect(t.sy).toBeCloseTo((a.sy??1)*s.scale,12);expect(t.sz).toBeCloseTo((a.sz??1)*s.scale,12);
  }
 }
});

test('only actual ground ownership is marked; supplies and carried/inventory/equipment owners do not borrow the ground pictogram',()=>{
 const ground:MaterialPile={id:1,kind:'chunk',item:'granite-chunk',quantity:1,forbidden:true,owner:{type:'ground',x:4,z:4}},job:Job={id:200,kind:'wall',x:6,z:4,orientation:0,footprint:'standard',material:'wood',construction:'frame',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};
 const supplied={...wood(2),forbidden:true as const,owner:{type:'job' as const,jobId:job.id}},carried={...wood(3),forbidden:true as const,owner:{type:'pawn' as const,pawnId:7}},inventory={...wood(4),forbidden:true as const,owner:{type:'inventory' as const,pawnId:7}},equipped:MaterialPile={id:5,kind:'weapon',item:'revolver',quantity:1,weapon:{quality:'normal',hitPoints:100,forbidden:true},owner:{type:'equipment',pawnId:7}};
 const human:MaterialPile={id:10,kind:'corpse',item:'human-corpse',quantity:1,forbidden:true,owner:{type:'ground',x:8,z:4},humanCorpse:{pawnId:101}};
 const mech:MaterialPile={id:11,kind:'mech-corpse',item:'scyther-corpse',quantity:1,forbidden:true,owner:{type:'ground',x:9,z:4},mechCorpse:{mechKind:'scyther',health:createMechaMedicalRecord(0)}};
 const w=world([ground,supplied,carried,inventory,equipped,human,mech],[],[job]);stamped(w);const owner=new ScenePilePresentation();read(owner,w);const bundles=all(owner);expect(bundles).toHaveLength(4);
 const g=bundles.find(b=>b.item==='granite-chunk')!,j=bundles.find(b=>b.supplied)!;expect(g.forbidden).toBe(true);expect(j.forbidden).toBeUndefined();expect(marks(j).icons).toHaveLength(0);
 const {plain,icons}=marks(g);expect(icons).toHaveLength(1);expect(plain.every(p=>p.targetId===4*w.width+4)).toBe(true);
 expect(forbiddenPileIconInstances(bundles)).toHaveLength(3);
 for(const body of [human,mech]){const projected=bundles.find(b=>b.pileId===body.id)!;expect(projected.markerOnly).toBe(true);expect(projected.forbidden).toBe(true);expect(marks(projected).parts).toEqual([]);expect(attachedIcon(projected).y).toBeLessThan(.6);}
 // Dedicated body rigs own these corpses. Allow removes only their marker
 // bundles; no duplicate body geometry is created by this projection.
 setMaterialForbidden256(human,false);setMaterialForbidden256(mech,false);read(owner,w);const allowedBodies=all(owner);expect(allowedBodies.filter(b=>b.markerOnly)).toEqual([]);expect(forbiddenPileIconInstances(allowedBodies)).toHaveLength(1);
});

test('unstamped mutable Worlds cannot use resident caches and direct mutable pictogram reads the current flag on every call',()=>{
 const w=world([wood(1)]),owner=new ScenePilePresentation();expect(owner.prepareSupports(w)).toBeUndefined();expect(owner.read(w,new Map())).toBeUndefined();
 const bundle:PileBundle={x:4,z:4,kind:'wood',item:'wood',quantity:10,supplied:false},before=pileParts([bundle]);expect(marks(bundle).icons).toEqual([]);
 bundle.forbidden=true;expect(pileParts([bundle])).toEqual(before);attachedIcon(bundle);
 delete bundle.forbidden;expect(pileParts([bundle])).toEqual(before);expect(marks(bundle).icons).toEqual([]);expect(Object.isFrozen(bundle)).toBe(false);expect(Object.isFrozen(w.piles[0]!)).toBe(false);
 // SceneRenderCore's complete mutable aggregation/signature branch is reviewed
 // separately. This CPU contract does not execute or certify that GPU caller.
});

test('same raw permission alias cannot hide a change, freeze its source or poison a published/cached placement receipt',()=>{
 const raw:MaterialPile={id:1,kind:'weapon',item:'revolver',quantity:1,weapon:{quality:'normal',hitPoints:100},owner:{type:'ground',x:4,z:4}},w=world([raw]);stamped(w);const owner=new ScenePilePresentation(),a=read(owner,w),ac=a.changedChunks[0]!,oldBundle=ac.bundles[0]!;
 const original=owner.placements(a,ac);expect(oldBundle.forbidden).toBeUndefined();expect(forbiddenPileIconInstances(ac.bundles)).toEqual([]);expect(Object.isFrozen(raw)).toBe(false);expect(Object.isFrozen(raw.weapon!)).toBe(false);expect(Object.isFrozen(w.piles)).toBe(false);owner.acknowledge(a);
 raw.weapon!.forbidden=true;const b=read(owner,w),bc=b.changedChunks[0]!;expect(b.changedChunks).toHaveLength(1);expect(bc.bundles[0]!.forbidden).toBe(true);expect(oldBundle.forbidden).toBeUndefined();expect(forbiddenPileIconInstances([oldBundle])).toEqual([]);expect(()=>{bc.bundles[0]!.forbidden=undefined;}).toThrow(TypeError);
 const expected=owner.placements(b,bc),publicCopy=owner.placements(b,bc);publicCopy.at(-1)!.x=9999;expect(owner.placements(b,bc)).toEqual(expected);expect(expected).toEqual(original);attachedIcon(bc.bundles[0]!);
 const expectedIcons=forbiddenPileIconInstances(bc.bundles),publicIcons=forbiddenPileIconInstances(bc.bundles);publicIcons[0]!.x=9999;expect(forbiddenPileIconInstances(bc.bundles)).toEqual(expectedIcons);
 const inspection=owner.inspect();inspection[0]!.bundles[0]!.forbidden=undefined;expect(owner.placements(b,bc)).toEqual(expected);expect(forbiddenPileIconInstances(bc.bundles)).toEqual(expectedIcons);
 owner.acknowledge(b);expect(()=>owner.placements(b,bc)).toThrow('Stale or foreign');delete raw.weapon!.forbidden;
 const c=read(owner,w),cc=c.changedChunks[0]!;expect(c.changedChunks).toHaveLength(1);expect(owner.placements(c,cc)).toEqual(original);expect(forbiddenPileIconInstances(cc.bundles)).toEqual([]);expect(raw.weapon!.forbidden).toBeUndefined();
});
