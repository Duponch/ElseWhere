import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {healthRandom} from '../src/sim/health.ts';
import {failWoodWallFrame301} from '../src/sim/wall-frame-failure-301.ts';
import type {Job,MaterialPile} from '../src/sim/types.ts';

function fixture(counts:number[]){
 const w=createWorld(1891,32,32);w.resources=[];w.structures=[];w.packed=[];w.piles=[];w.jobs=[];w.stockpiles=[];
 for(const t of w.tiles)t.terrain='soil';
 const p=w.pawns[0]!;
 p.haul=null;p.need=null;p.cooking=null;p.recreation.task=null;p.orders.active=null;p.orders.queue=[];
 delete p.idleWander300;
 const job:Job={id:w.nextId++,kind:'wall',material:'wood',construction:'frame',x:15,z:15,orientation:0,footprint:'standard',status:'active',reservedBy:p.id,progress:2,escrow:{wood:5,food:0}};
 p.jobId=job.id;p.x=14;p.z=15;p.state='working';p.path=[];p.moveCooldown=0;delete p.motion;w.jobs.push(job);
 for(const quantity of counts){const pile:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity,owner:{type:'job',jobId:job.id}};w.piles.push(pile);}
 return {w,p,job};
}
test('failure mutates the real owner, draws per stack before cell enumeration, and creates a new Blueprint only after leavings',()=>{
 const {w,p,job}=fixture([5]),oldNext=w.nextId,stream={rng:w.rng};
 const halfDraw=healthRandom(stream);healthRandom(stream);
 const expected=2+(halfDraw<.5?1:0),result=failWoodWallFrame301(w,p,job);
 expect(result).toMatchObject({original:5,recovered:expected,placed:expected,unplaced:0});
 expect(w.rng).toBe(stream.rng);expect(w.jobs.includes(job)).toBe(false);
 expect(result.blueprint).toMatchObject({id:oldNext+1,construction:'blueprint',progress:0,reservedBy:null,escrow:{wood:0,food:0}});
 expect(w.piles.map(s=>s.quantity)).toEqual([expected]);
 expect(w.piles[0]!.id).toBe(oldNext);expect(w.piles[0]!.owner).toEqual({type:'ground',x:15,z:15});
 // This material subtransaction deliberately does not pretend to finish a
 // busy driver. Core301 closes it synchronously before publication.
 expect(p.jobId).toBe(job.id);expect('postureUntilCore301'in p).toBe(false);
});
test('five one-unit stacks recover five, keep partial placement, end unplaced holders and still rebuild without a retry owner',()=>{
 const {w,p,job}=fixture([1,1,1,1,1]);for(const t of w.tiles)t.terrain='rock';w.tiles[15*w.width+15]!.terrain='soil';
 const target:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity:74,owner:{type:'ground',x:15,z:15}};w.piles.push(target);
 const stream={rng:w.rng};for(let i=0;i<6;i++)healthRandom(stream);
 const result=failWoodWallFrame301(w,p,job);
 expect(result).toMatchObject({original:5,recovered:5,placed:1,unplaced:4});
 expect(target.quantity).toBe(75);expect(w.piles).toEqual([target]);expect(w.rng).toBe(stream.rng);
 expect(w.jobs).toEqual([result.blueprint]);expect(p.jobId).toBe(job.id);
 expect(Object.keys(w).some(k=>/holder|retry|leaving/i.test(k))).toBe(false);
});
