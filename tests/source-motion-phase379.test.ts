import {afterEach,expect,test} from 'vitest';
import {SourceMotionPhasePublisher297} from '../src/bridge/source-motion-phase-publisher-297';
import {captureCoreActor297} from '../src/bridge/core-phase-data-297';
import {captureOwnedCoreSourceData297,captureCoreActorSharedSource297,type OwnedCoreSourceData297} from '../src/bridge/core-frozen-copy-297';
import {markActorMotionSource297,actorMotionSourceStamp297,invalidateActorMotionSources297} from '../src/sim/actor-motion-source-297';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {startTravel} from '../src/sim/movement';
import {finishSnowStep} from '../src/sim/snow-surface';
import {applyBulletStagger} from '../src/sim/stagger';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Pawn} from '../src/sim/types';

class ExposedPublisher extends SourceMotionPhasePublisher297 {
 capture(pawn:Pawn,held=false){return this.captureActor297('human',0,pawn,held);}
 same(pawn:Pawn,fields:Readonly<Record<string,unknown>>){return this.sameActor297('human',pawn,fields,false);}
}
const frozen=(v:unknown):boolean=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozen);
afterEach(()=>{setResourceJournalVerification(false);invalidateActorMotionSources297();});
function setup(){
 const world=fixture(),pawn=world.pawns[0]!,owner={},publisher=new ExposedPublisher(owner);
 pawn.x=5;pawn.z=5;pawn.moveCooldown=0;delete pawn.motion;delete pawn.draft;
 const move=()=>withJournalTerrainReadScope(owner,()=>startTravel(world,pawn,{x:6,z:5},undefined,undefined,false,true));
 return {world,pawn,owner,publisher,move};
}

test('a real motion producer supplies one complete frozen subtree to every changing physical row',()=>{
 const h=setup();expect(h.move()).toBe(true);const motion=h.pawn.motion!;
 expect(actorMotionSourceStamp297(motion,h.owner)).toBeDefined();
 const first=h.publisher.capture(h.pawn);expect(first).toStrictEqual(captureCoreActor297('human',0,h.pawn));expect(frozen(first)).toBe(true);
 h.pawn.moveCooldown=Math.max(0,h.pawn.moveCooldown-.1);h.pawn.planCooldown++;
 const second=h.publisher.capture(h.pawn);expect(second).toStrictEqual(captureCoreActor297('human',0,h.pawn));
 expect(second.fields.motion).toBe(first.fields.motion);expect(second.fields).not.toBe(first.fields);expect(Object.isFrozen(motion)).toBe(false);
 expect(h.publisher.same(h.pawn,second.fields as unknown as Readonly<Record<string,unknown>>)).toBe(true);
 const copy=first.fields.motion!;motion.to.x++;invalidateActorMotionSources297();
 expect(h.publisher.capture(h.pawn)).toStrictEqual(captureCoreActor297('human',0,h.pawn));expect(copy.to.x).toBe(6);
});

test('snow completion and impact writers retire the old motion source without mutating earlier rows',()=>{
 const h=setup();h.move();const motion=h.pawn.motion!;
 motion.snowEntryPending=true;withJournalTerrainReadScope(h.owner,()=>markActorMotionSource297(motion));
 const first=h.publisher.capture(h.pawn),stamp=actorMotionSourceStamp297(motion,h.owner);
 h.world.tick=Math.ceil(motion.end);h.world.phaseCore297=0;
 withJournalTerrainReadScope(h.owner,()=>finishSnowStep(h.world,h.pawn));
 expect(actorMotionSourceStamp297(motion,h.owner)).not.toBe(stamp);
 const after=h.publisher.capture(h.pawn);expect(after).toStrictEqual(captureCoreActor297('human',0,h.pawn));
 expect(after.fields.motion).not.toBe(first.fields.motion);expect(first.fields.motion?.snowEntryPending).toBe(true);expect(after.fields.motion?.snowEntryPending).toBeUndefined();
 h.world.tick=0;motion.end=10;withJournalTerrainReadScope(h.owner,()=>markActorMotionSource297(motion));const beforeHit=h.publisher.capture(h.pawn);
 withJournalTerrainReadScope(h.owner,()=>applyBulletStagger(h.world,h.pawn,0,1));
 const hit=h.publisher.capture(h.pawn);expect(hit).toStrictEqual(captureCoreActor297('human',0,h.pawn));expect(hit.fields.motion).not.toBe(beforeHit.fields.motion);expect(beforeHit.fields.motion?.stagger).toBeUndefined();
});

test('public producers, different owners, unknown edits and counterfeit capabilities retain full discovery',()=>{
 const h=setup();expect(startTravel(h.world,h.pawn,{x:6,z:5},undefined,undefined,false,true)).toBe(true);
 expect(actorMotionSourceStamp297(h.pawn.motion!,h.owner)).toBeUndefined();const first=h.publisher.capture(h.pawn);
 h.pawn.motion!.to.x++;expect(h.publisher.capture(h.pawn)).toStrictEqual(captureCoreActor297('human',0,h.pawn));expect(first.fields.motion?.to.x).toBe(6);
 withJournalTerrainReadScope({},()=>markActorMotionSource297(h.pawn.motion));h.pawn.motion!.end++;
 expect(h.publisher.capture(h.pawn)).toStrictEqual(captureCoreActor297('human',0,h.pawn));
 expect(captureCoreActorSharedSource297('human',0,h.pawn,false,{} as OwnedCoreSourceData297)).toStrictEqual(captureCoreActor297('human',0,h.pawn));
});

test('checking mode rejects an unmarked nested write; own-data refusals and embedded depth budgets remain exact',()=>{
 const h=setup();h.move();h.publisher.capture(h.pawn);setResourceJournalVerification(true);h.pawn.motion!.to.x++;
 expect(()=>h.publisher.capture(h.pawn)).toThrow('Unmarked actor motion source write');invalidateActorMotionSources297();
 expect(h.publisher.capture(h.pawn)).toStrictEqual(captureCoreActor297('human',0,h.pawn));
 setResourceJournalVerification(false);let reads=0;Object.defineProperty(h.pawn,'motion',{enumerable:true,configurable:true,get(){reads++;throw Error('getter ran');}});
 expect(()=>h.publisher.capture(h.pawn)).toThrow('Physical actor field is not own data');expect(reads).toBe(0);
 delete h.pawn.motion;
 for(let depth=18;depth<=24;depth++){
  let source:object={end:1};for(let i=0;i<depth;i++)source={next:source};
  const pawn={...h.pawn,motion:source} as unknown as Pawn;
  let expected;try{expected=captureCoreActor297('human',0,pawn);}catch(error){expected=(error as Error).message;}
  let token:OwnedCoreSourceData297;
  try{token=captureOwnedCoreSourceData297(source);}catch(error){expect(expected).toBe((error as Error).message);continue;}
  if(typeof expected==='string')expect(()=>captureCoreActorSharedSource297('human',0,pawn,false,token)).toThrow(expected);
  else expect(captureCoreActorSharedSource297('human',0,pawn,false,token)).toStrictEqual(expected);
 }
});
