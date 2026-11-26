import {afterEach,expect,test} from 'vitest';
import {MotionRecorder,MOTION_HISTORY_TICKS} from '../src/bridge/motion-tracks';
import {advanceWorldCore297} from '../src/sim/engine';
import {startTravel} from '../src/sim/movement';
import {takePhysicalMotionSelection379} from '../src/sim/core-motion-publication-receipt-379';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {physicalVisibleCoreMap297} from '../src/bridge/core-phase-data-297';
import {fixture} from './resident-presentation-fixtures-v427';

afterEach(()=>setResourceJournalVerification(false));
function setup(){
 const root=fixture(),world=physicalVisibleCoreMap297(root)!,owner={},pawn=world.pawns[0]!,old=new MotionRecorder(true),current=new MotionRecorder(true);
 pawn.x=5;pawn.z=5;pawn.path=[];pawn.state='moving';delete pawn.motion;pawn.moveCooldown=0;delete pawn.draft;
 world.tiles[5*world.width+5]={terrain:'soil'};world.tiles[5*world.width+6]={terrain:'soil'};world.tiles[5*world.width+7]={terrain:'soil'};
 expect(withJournalTerrainReadScope(owner,()=>startTravel(world,pawn,{x:6,z:5},undefined,undefined,false,true))).toBe(true);
 pawn.path=[{x:7,z:5}];old.capture(world);current.capture(world);
 const step=()=>withJournalTerrainReadScope(owner,()=>advanceWorldCore297(root));
 return {root,world,owner,pawn,old,current,step};
}

test('the actual physical cooldown writer keeps its actor row but omits its unchanged history, with a one-use genuine receipt',()=>{
 const h=setup(),first=h.step(),row=first.maps[0]!;
 expect(first.localTickCompleted).toBe(false);expect(h.pawn.moveCooldown).toBeGreaterThan(0);expect(row.actorsChanged).toContain(h.pawn.id);
 expect(row.world===h.world).toBe(true);expect(row.requiresHardFull297).toBe(false);
 expect(takePhysicalMotionSelection379({...row},h.world,h.owner,row.actorsChanged)).toBeUndefined();
 const selected=takePhysicalMotionSelection379(row,h.world,h.owner,row.actorsChanged);expect(selected).toBeDefined();expect(selected).not.toContain(h.pawn.id);
 expect(takePhysicalMotionSelection379(row,h.world,h.owner,row.actorsChanged)).toBeUndefined();
 const publicStep=advanceWorldCore297(h.root),publicRow=publicStep.maps[0]!;
 expect(takePhysicalMotionSelection379(publicRow,h.world,h.owner,publicRow.actorsChanged)).toBeUndefined();
});

test('proof-selected recorder produces the same histories through real movement, arrival, new edge and macro expiry boundaries',()=>{
 const h=setup();setResourceJournalVerification(true);
 for(let i=0;i<24;i++){
  const result=h.step(),row=result.maps[0]!;
  if(result.localTickCompleted||row.requiresHardFull297){h.old.capture(h.world);h.current.capture(h.world);}
  else {h.old.capturePhysical(h.world,row.actorsChanged);h.current.capturePhysicalFromCore379(h.world,row,h.owner);}
  expect(structuredClone(h.current.snapshot())).toStrictEqual(structuredClone(h.old.snapshot()));
 }
 // A stale physical result is not a certificate across an integer expiry
 // boundary; the Recorder's old roster check takes the complete capture.
 const result=h.step(),row=result.maps[0]!;h.world.tick+=MOTION_HISTORY_TICKS+1;
 h.old.capturePhysical(h.world,row.actorsChanged);h.current.capturePhysicalFromCore379(h.world,row,h.owner);
 expect(structuredClone(h.current.snapshot())).toStrictEqual(structuredClone(h.old.snapshot()));
});

test('checking executes the independent old capture for every omitted actor and refuses an unmarked changed edge',()=>{
 const h=setup();setResourceJournalVerification(true);const result=h.step(),row=result.maps[0]!;
 expect(row.core).toBe(effectiveCore297(h.world));expect(h.pawn.motion).toBeDefined();
 // An external writer illegally changes the committed motion after the
 // closed Engine receipt. Real runtime has no such interleaving; the checking
 // oracle must detect it before publishing the stale history.
 h.pawn.motion!.end+=1;
 expect(()=>h.current.capturePhysicalFromCore379(h.world,row,h.owner)).toThrow('Unmarked physical motion history write');
});
