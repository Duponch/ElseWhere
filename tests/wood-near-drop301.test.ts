import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import type {Job,MaterialPile,World} from '../src/sim/types.ts';
import {takeFrameWood301,readWoodLeavings301} from '../src/sim/wood-direct-drop-301.ts';
import {WoodNearDrop301} from '../src/sim/wood-near-drop-301.ts';

function fixture(){
 const w=createWorld(1701,32,32);
 w.resources=[];w.structures=[];w.packed=[];w.piles=[];w.jobs=[];w.stockpiles=[];
 for(const t of w.tiles)t.terrain='soil';
 const frame:Job={id:w.nextId++,kind:'wall',material:'wood',construction:'frame',x:15,z:15,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:5,food:0}};
 w.jobs.push(frame);
 const source:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity:5,owner:{type:'job',jobId:frame.id},forbidden:true};
 w.piles.push(source);
 return {w,frame,source};
}
const ground=(w:World,x:number,z:number,n:number):MaterialPile=>{const p:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity:n,owner:{type:'ground',x,z}};w.piles.push(p);return p;};

test('an empty Perfect origin wins before a remote partial stack; actual identity and forbidden flag survive',()=>{
 const {w,frame,source}=fixture(),other=ground(w,16,15,70),id=source.id,rng=w.rng;
 const holder=takeFrameWood301(w,frame,source,5);w.jobs=[];
 const result=new WoodNearDrop301(w,frame).drop(holder);
 expect(result).toEqual({success:true,transferred:5,remaining:0});
 expect(w.piles.find(p=>p.id===id)).toMatchObject({quantity:5,forbidden:true,owner:{type:'ground',x:15,z:15}});
 expect(other.quantity).toBe(70);expect(w.rng).toBe(rng);
});
test('a selectable plant origin is only Okay, so an ordinary neighbouring Perfect cell wins',()=>{
 const {w,frame,source}=fixture(),plant=createWorld(1702,32,32).resources.find(r=>r.kind==='tree')!;
 expect(plant).toBeDefined();w.resources=[{...plant,x:15,z:15}];
 const holder=takeFrameWood301(w,frame,source,5);w.jobs=[];
 const near=new WoodNearDrop301(w,frame);
 expect(near.quality(frame,holder)).toBe(3);
 const chosen=near.choose(holder)!;
 expect(chosen).not.toEqual({x:15,z:15});expect(near.quality(chosen,holder)).toBe(4);
});
test('Near keeps a real partial absorption when the only available cell fills, rather than reverting a failed full plan',()=>{
 const {w,frame,source}=fixture();for(const t of w.tiles)t.terrain='rock';w.tiles[15*w.width+15]!.terrain='soil';
 const target=ground(w,15,15,74),holder=takeFrameWood301(w,frame,source,5);w.jobs=[];
 const result=new WoodNearDrop301(w,frame).drop(holder);
 expect(result).toEqual({success:false,transferred:1,remaining:4});
 expect(target.quantity).toBe(75);expect(target.forbidden).toBeUndefined();
 expect(readWoodLeavings301(holder).pile).toMatchObject({id:source.id,quantity:4,forbidden:true});
 expect(w.piles.some(p=>p.id===source.id)).toBe(false);
});
test('a ResearchBench is Building, not Building_WorkTable: no invented table penalty at an otherwise Perfect origin',()=>{
 const {w,frame,source}=fixture(),holder=takeFrameWood301(w,frame,source,5);w.jobs=[];
 w.structures.push({id:w.nextId++,kind:'research-bench',material:'wood',x:15,z:15,orientation:0,footprint:'standard'});
 expect(new WoodNearDrop301(w,frame).quality(frame,holder)).toBe(4);
});
