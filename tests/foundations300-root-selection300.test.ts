import {test,expect} from 'vitest';
import {createWorld} from '../src/sim/index.ts';
import {blockedCells,reachableCells} from '../src/sim/pathfinding.ts';
import {colonyWanderRoot300,idleChillBuilding300} from '../src/sim/idle-wander-300.ts';
import type {Structure} from '../src/sim/types.ts';

test('colony root uses Home at the building and includes diagonal neighbours; Core metadata keeps walls and ship caskets admissible',()=>{
 // Explicit isolated geometry input, not a saved/played campaign.
 const w=createWorld(42,32,32),p=w.pawns[0]!;w.pawns=[p];p.x=5;p.z=5;p.path=[];delete p.motion;p.moveCooldown=0;
 w.resources=[];w.structures=[{id:w.nextId++,kind:'wall',x:14,z:14,orientation:0,footprint:'standard',material:'wood'} as Structure];
 w.home=[14*w.width+14];
 const reach=reachableCells(w,p,blockedCells(w),new Set());
 const roots=Array.from({length:32},(_,i)=>colonyWanderRoot300(w,p,reach,()=>i/32));
 expect(roots.every(c=>Math.abs(c.x-14)<=1&&Math.abs(c.z-14)<=1&&(c.x!==14||c.z!==14))).toBe(true);
 expect(roots.some(c=>Math.abs(c.x-14)===1&&Math.abs(c.z-14)===1)).toBe(true);
 for(const kind of ['wall','bed','research-bench','ship-cryptosleep-casket'])expect(idleChillBuilding300(kind)).toBe(true);
 for(const kind of ['sleeping-spot','cryptosleep-casket','door','autodoor','fence','fence-gate'])expect(idleChillBuilding300(kind)).toBe(false);
});
