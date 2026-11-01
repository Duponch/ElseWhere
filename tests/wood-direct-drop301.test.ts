import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {newShelfStorage} from '../src/sim/shelf-storage.ts';
import {takeFrameWood301,readWoodLeavings301,directDropWood301,finishWoodLeavings301} from '../src/sim/wood-direct-drop-301.ts';
import type {Cell,Job,MaterialPile,World} from '../src/sim/types.ts';

// Prepared component records from an actual constructor, not a played failure,
// selector qualification, Whole/Full transaction or saved temporary holder.
function fixture(counts:readonly number[]=[5]){
 const w=createWorld(42,32,32);w.piles=[];w.packed=[];w.structures=[];w.resources=[];w.jobs=[];
 const frame:Job={id:w.nextId++,kind:'wall',material:'wood',construction:'frame',x:8,z:8,orientation:0,footprint:'standard',status:'active',reservedBy:w.pawns[0]!.id,progress:1,escrow:{wood:0,food:0}};
 w.jobs.push(frame);
 const sources=counts.map(quantity=>{const p:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity,owner:{type:'job',jobId:frame.id}};w.piles.push(p);return p;});
 refreshStock(w);return {w,frame,sources};
}
function groundWood(w:World,cell:Cell,quantity:number,damage=0,forbidden=false){
 const p:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity,owner:{type:'ground',...cell},...(damage?{damage}:{}),...(forbidden?{forbidden:true as const}:{})};w.piles.push(p);return p;
}
function shelf(w:World,cell:Cell){
 w.structures.push({id:w.nextId++,kind:'small-shelf',material:'wood',x:cell.x,z:cell.z,orientation:0,footprint:'standard',shelf:newShelfStorage([w.nextId++],w.schemaVersion)});
}
function retireFrameAndItsRemainingInputs(w:World,frame:Job){
 // Component setup for the real atomic handler's required order: no old Job
 // and no replacement Blueprint during Direct; only taken pieces survive.
 w.jobs=w.jobs.filter(j=>j!==frame);w.piles=w.piles.filter(p=>p.owner.type!=='job'||p.owner.jobId!==frame.id);refreshStock(w);
}

test('real split ID/conditions and irreversible partial merge; explicit end exposes rather than destroys remainder',()=>{
 const {w,frame,sources}=fixture(),source=sources[0]!,cell={x:5,z:5};
 source.damage=149;source.forbidden=true;const target=groundWood(w,cell,74),nextId=w.nextId,rng=w.rng;
 const holder=takeFrameWood301(w,frame,source,3),piece=readWoodLeavings301(holder).pile!;
 expect(piece.id).toBe(nextId);expect(w.nextId).toBe(nextId+1);expect(piece.quantity).toBe(3);expect(piece.damage).toBe(149);expect(piece.forbidden).toBe(true);expect('owner'in piece).toBe(false);
 expect(source.quantity).toBe(2);expect(source.forbidden).toBe(true);expect(w.piles.some(p=>p.id===piece.id)).toBe(false);
 expect(()=>takeFrameWood301(w,frame,source,1)).toThrow();
 retireFrameAndItsRemainingInputs(w,frame);
 const first=directDropWood301(w,holder,cell);
 expect(first.success).toBe(false);expect(first.transferred).toBe(1);expect(first.remaining).toBe(2);expect(first.remainder).toBe(piece);expect(first.lastResult).toBe(target);
 expect(target.quantity).toBe(75);expect(target.damage).toBe(1);expect(target.forbidden).toBeUndefined();expect(piece.forbidden).toBe(true);
 const stopped=directDropWood301(w,holder,cell);expect(stopped.success).toBe(false);expect(stopped.transferred).toBe(0);expect(stopped.remaining).toBe(2);
 const unowned=finishWoodLeavings301(w,holder);expect(unowned).toBe(piece);expect(unowned!.quantity).toBe(2);expect('owner'in unowned!).toBe(false);expect(target.quantity).toBe(75);expect(w.rng).toBe(rng);
 expect(()=>directDropWood301(w,holder,cell)).toThrow();expect(()=>finishWoodLeavings301(w,holder)).toThrow();
});

test('distinct Frame stacks create distinct holders; descending absorptions preserve target flags and consume split IDs',()=>{
 const {w,frame,sources}=fixture([2,3]),cell={x:5,z:5};shelf(w,cell);
 sources[1]!.damage=149;sources[1]!.forbidden=true;
 // Reverse array order intentionally: larger stack must receive first.
 const small=groundWood(w,cell,70),large=groundWood(w,cell,74,75,true),nextId=w.nextId;
 const a=takeFrameWood301(w,frame,sources[0]!,1),b=takeFrameWood301(w,frame,sources[1]!,2);
 expect(readWoodLeavings301(a).pile!.id).toBe(nextId);expect(readWoodLeavings301(b).pile!.id).toBe(nextId+1);expect(w.nextId).toBe(nextId+2);
 retireFrameAndItsRemainingInputs(w,frame);
 const first=directDropWood301(w,a,cell);expect(first.success).toBe(true);expect(first.lastResult).toBe(large);expect(large.quantity).toBe(75);expect(large.damage).toBe(74);expect(small.quantity).toBe(70);expect(large.forbidden).toBe(true);
 const second=directDropWood301(w,b,cell);expect(second.success).toBe(true);expect(second.lastResult).toBe(small);expect(small.quantity).toBe(72);expect(small.damage).toBe(4);expect(small.forbidden).toBeUndefined();
 expect(w.nextId).toBe(nextId+2);expect(w.piles.some(p=>p.id===nextId||p.id===nextId+1)).toBe(false);
 expect(()=>directDropWood301(w,a,cell)).toThrow();expect(finishWoodLeavings301(w,a)).toBeUndefined();expect(finishWoodLeavings301(w,b)).toBeUndefined();
});

test('two packed Items fill shelf slots but never veto a partial merge; next Direct spawns the same real remainder',()=>{
 const {w,frame,sources}=fixture(),cell={x:5,z:5};shelf(w,cell);
 sources[0]!.damage=17;sources[0]!.forbidden=true;
 const target=groundWood(w,cell,74);
 for(let i=0;i<2;i++)w.packed.push({building:{id:w.nextId++,kind:'stool',material:'wood',quality:'normal',x:0,z:0,orientation:0,footprint:'standard'},owner:{type:'ground',...cell}});
 const holder=takeFrameWood301(w,frame,sources[0]!,3),piece=readWoodLeavings301(holder).pile!;retireFrameAndItsRemainingInputs(w,frame);
 const partial=directDropWood301(w,holder,cell);expect(partial.success).toBe(false);expect(partial.transferred).toBe(1);expect(partial.remaining).toBe(2);expect(target.quantity).toBe(75);
 const nextId=w.nextId,empty={x:6,z:5},spawned=directDropWood301(w,holder,empty);
 expect(spawned.success).toBe(true);expect(spawned.transferred).toBe(2);expect(spawned.remaining).toBe(0);expect(spawned.lastResult).toBe(piece);expect(w.nextId).toBe(nextId);
 expect(w.piles.find(p=>p.id===piece.id)).toBe(piece);expect(spawned.lastResult!.owner).toEqual({type:'ground',...empty});expect(spawned.lastResult!.damage).toBe(17);expect(spawned.lastResult!.forbidden).toBe(true);
 expect(finishWoodLeavings301(w,holder)).toBeUndefined();
 // Whole transfer is an identity move, not a fabricated extra stack.
 const whole=fixture([1,4]),original=whole.sources[0]!,idBudget=whole.w.nextId,token=takeFrameWood301(whole.w,whole.frame,original,1);
 expect(readWoodLeavings301(token).pile).toBe(original);expect(whole.w.nextId).toBe(idBudget);expect(whole.w.piles.includes(original)).toBe(false);
 expect(directDropWood301(whole.w,token,{x:4,z:4}).lastResult).toBe(original);expect(whole.w.nextId).toBe(idBudget);finishWoodLeavings301(whole.w,token);
 // A later DIFFERENT Frame may legitimately consume that same physical stack;
 // single-use must not become a permanent ban on reusing its identity.
 const later:Job={...whole.frame,id:whole.w.nextId++,reservedBy:null};whole.w.jobs.push(later);original.owner={type:'job',jobId:later.id};
 const laterHolder=takeFrameWood301(whole.w,later,original,1);expect(readWoodLeavings301(laterHolder).pile).toBe(original);finishWoodLeavings301(whole.w,laterHolder);
});

