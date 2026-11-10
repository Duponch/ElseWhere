import {expect,test} from 'vitest';
import {processHaul} from '../src/sim/hauling.ts';
import {addMaterial} from '../src/sim/materials.ts';
import type {Job,Pawn,World} from '../src/sim/types.ts';
import {fixture} from './wall-fixture301.ts';

/** A hauler carrying wood to an unreserved wall Frame. The wide fixture keeps
 * the four cells (x,z),(x+1,z),(x,z-1),(x+1,z-1) free soil, the Frame at
 * (x+1,z), so (x,z-1) touches it diagonally. */
function carrying(material:'wood'|'steel',at:(j:Job)=>{x:number;z:number}){
 const {w,p,j}=fixture(true);
 w.piles=w.piles.filter(q=>!(q.owner.type==='job'&&q.owner.jobId===j.id));
 j.status='pending';j.reservedBy=null;p.jobId=null;j.material=material;
 const cell=at(j);p.x=cell.x;p.z=cell.z;p.state='moving';p.path=[];
 const carryId=w.nextId;addMaterial(w,material,5,{type:'pawn',pawnId:p.id},material);
 expect(w.piles.find(q=>q.id===carryId)?.owner).toEqual({type:'pawn',pawnId:p.id});
 p.haul={sourcePileId:carryId,quantity:5,phase:'deliver',destination:{type:'job',jobId:j.id,forConstruction:true},carryPileId:carryId,pickupCell:{x:cell.x,z:cell.z}};
 return {w,p,j};
}
function deliver(w:World,p:Pawn){
 const moves:{x:number;z:number}[]=[];
 processHaul(w,p,target=>{moves.push({x:target.x,z:target.z});},()=>{});
 return moves;
}
const delivered=(w:World,j:Job)=>w.piles.filter(q=>q.owner.type==='job'&&q.owner.jobId===j.id).reduce((n,q)=>n+q.quantity,0);

test('a wood wall Frame takes its delivery from a diagonal touch cell, the goal its route aims at',()=>{
 const {w,p,j}=carrying('wood',j=>({x:j.x-1,z:j.z-1}));
 expect(deliver(w,p)).toEqual([]);
 expect(p.haul).toBeNull();expect(delivered(w,j)).toBe(5);
});

test('the cardinal contact still delivers, and a distant hauler still walks',()=>{
 const near=carrying('wood',j=>({x:j.x-1,z:j.z}));
 expect(deliver(near.w,near.p)).toEqual([]);expect(delivered(near.w,near.j)).toBe(5);
 const far=carrying('wood',j=>({x:j.x-1,z:j.z+2}));
 expect(deliver(far.w,far.p)).toEqual([{x:far.j.x,z:far.j.z}]);
 expect(far.p.haul?.phase).toBe('deliver');expect(delivered(far.w,far.j)).toBe(0);
});

test('other construction keeps its historical cardinal contact',()=>{
 const {w,p,j}=carrying('steel',j=>({x:j.x-1,z:j.z-1}));
 expect(deliver(w,p)).toEqual([{x:j.x,z:j.z}]);
 expect(p.haul?.phase).toBe('deliver');expect(delivered(w,j)).toBe(0);
});
