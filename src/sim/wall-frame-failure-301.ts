import {healthRandom} from './health.ts';
import {refreshStock} from './materials.ts';
import {removeIdentity} from './collection-remove.ts';
import {WoodNearDrop301} from './wood-near-drop-301.ts';
import {takeFrameWood301,finishWoodLeavings301,type WoodLeavingsHolder301} from './wood-direct-drop-301.ts';
import type {Job,Pawn,World} from './types.ts';
import {isWoodWallFrame301} from './wall-frame-kind-301.ts';
export {isWoodWallFrame301} from './wall-frame-kind-301.ts';

/** This is a real mutation handler, not a placement preflight. The Engine calls
 * it only inside one synchronous, unpublished FinishFrame failure. A refused
 * Near can have paid partial transfers; they are never rolled back or retried.
 * The caller closes the original Job/driver before any publication. This
 * material stage never decides Succeeded/retired-busy/Wait on its own. */
export function failWoodWallFrame301(w:World,p:Pawn,j:Job):{
 blueprint:Job;original:number;recovered:number;placed:number;unplaced:number;
}{
 if(!isWoodWallFrame301(j)||!w.jobs.includes(j)||!w.pawns.includes(p)||j.reservedBy!==p.id||p.jobId!==j.id
  ||p.haul||p.need||p.cooking||p.recreation.task||p.state==='dead'||p.state==='downed')throw Error('Original active wood Wall Frame and builder required');
 const original=w.piles.filter(s=>s.owner.type==='job'&&s.owner.jobId===j.id);
 if(original.some(s=>s.kind!=='wood'||s.item!=='wood'||!Number.isSafeInteger(s.quantity)||s.quantity<1||s.quantity>75)
  ||original.reduce((sum,s)=>sum+s.quantity,0)!==5)throw Error('Complete actual Wall wood owner required');
 // Each recovered partial stack can allocate a SplitOff ID, then the new
 // Blueprint. Native Frame removal must not become a transaction retry latch.
 if(!Number.isSafeInteger(w.nextId)||!Number.isSafeInteger(w.nextId+original.length+1)
  ||w.piles.length>32768)throw RangeError('Frame failure identity/pile budget exhausted');
 const total=original.reduce((sum,s)=>sum+s.quantity,0);
 let recovered=0,placed=0,unplaced=0;
 const holders:WoodLeavingsHolder301[]=[];
 // RoundRandom is per stack, backwards, and consumes a draw for integers too.
 for(let i=original.length-1;i>=0;i--){const source=original[i]!,half=source.quantity*.5,base=Math.floor(half);
  const amount=Math.max(1,base+(healthRandom(w)<half-base?1:0));
  recovered+=amount;holders.push(takeFrameWood301(w,j,source,amount));
 }
 removeIdentity(w.jobs,j);
 // The unrecovered material is destroyed with its real Frame owner.
 w.piles=w.piles.filter(s=>s.owner.type!=='job'||s.owner.jobId!==j.id);
 // Cells.InRandomOrder enumerates even the single occupied cell via Range.
 // The project has its own RNG; this preserves the demonstrated draw order,
 // not identity of Unity's underlying PRNG or indirect cosmetic hooks.
 healthRandom(w);
 const near=new WoodNearDrop301(w,j);
 let stopped=false;
 for(const holder of holders){
  if(!stopped){const result=near.drop(holder);placed+=result.transferred;stopped=!result.success;}
  // The real end of GenLeaving owns any unplaced portion only transiently.
  // Preserve its quantity in the receipt; no saved owner, free stock credit,
  // deferred retry, or assertion of an explicit native Destroy is fabricated.
  unplaced+=finishWoodLeavings301(w,holder)?.quantity??0;
 }
 const blueprint:Job={id:w.nextId++,kind:'wall',material:'wood',construction:'blueprint',
  x:j.x,z:j.z,orientation:j.orientation,footprint:j.footprint,status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};
 w.jobs.push(blueprint);
 for(const pawn of w.pawns)pawn.orders.queue=pawn.orders.queue.filter(order=>order!==j.id);
 refreshStock(w);
 return {blueprint,original:total,recovered,placed,unplaced};
}
