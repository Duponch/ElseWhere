import {historicalCustomFoodPolicies} from './scenarios/legacy-skills';
import {expect,test} from 'vitest';
import {SnapshotDecoder,SnapshotEncoder,type SnapshotMessage} from '../src/bridge/snapshots.ts';
import {PresentationChanges} from '../src/bridge/presentation-changes.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {validShootingShape,validateShooting} from '../src/sim/shooting-save.ts';
import {ensureCommercialPost} from '../src/sim/commercial-post.ts';
import {createPrisonerState} from '../src/sim/prisoner-state.ts';
import {validPrisonerPawnShape} from '../src/sim/prisoner-save.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import type {ShootingStance} from '../src/sim/shooting-state.ts';
import {prepareShootingStun,produceShootingStunImpact,type ShootingStunPhase} from './scenarios/shooting-stun-v220.ts';

function adopt(decoder:SnapshotDecoder,packet:SnapshotMessage):World {
  const result=decoder.adopt(packet);if(result.status!=='applied')throw Error(JSON.stringify(result));return result.world;
}
function produced(phase:ShootingStunPhase) {
  const fixture=prepareShootingStun(phase==='aim'?12:26,phase);
  expect(produceShootingStunImpact(fixture).eligible).toBe(true);
  const w=fixture.world,p=w.pawns.find(p=>p.id===fixture.shooterId)!;
  expect(validateWorld(w)).toEqual([]);expect(p.shooting!.stance!.clock).toBeDefined();
  expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  return {w,p,fixture};
}
const raw=(value:unknown)=>value as Record<string,unknown>;
const clockRefusal='Phase de tir humaine invalide pour ce snapshot.';
const authorityRefusal='Référence ou autorité de tir humaine invalide.';

test.each([false,true])('real aim/cooldown clocks reject corruptions and preserve the same-revision retry (checkpoint=%s)',checkpoint=>{
  for(const phase of ['aim','cooldown'] as const){
    const {w,p}=produced(phase),encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
    const confirmed=adopt(decoder,structuredClone(encoder.encode(w,0,6))),frozen=structuredClone(confirmed);
    const good=structuredClone(encoder.encode(w,0,6,checkpoint));
    const mutate:((s:ShootingStance)=>void)[]=[
      s=>{s.clock!.lastAdvancedAtCore++;},s=>{s.clock!.lastAdvancedAtCore--;},
      s=>{s.clock!.lastAdvancedAtCore+=.5;},s=>{s.clock!.pausedCore=-1;},
      s=>{s.clock!.pausedCore=s.clock!.lastAdvancedAtCore-s.startedAtCore+1;},
      s=>{s.endsAtCore++;},s=>{s.clock!.pausedCore++;},
      s=>{raw(s).clock=undefined;},s=>{raw(s).clock={pausedCore:0};},
      s=>{raw(s.clock).extra=0;},s=>{s.clock!.lastAdvancedAtCore=Number.MAX_SAFE_INTEGER+1;},
    ];
    for(const corrupt of mutate){
      const bad=structuredClone(good),pawn=bad.world.pawns.find(q=>q.id===p.id)!;
      corrupt(pawn.shooting!.stance!);
      expect(validShootingShape(pawn.shooting,SCHEMA_VERSION,w.tick)).toBe(false);
      const forged=structuredClone(w);forged.pawns.find(q=>q.id===p.id)!.shooting=structuredClone(pawn.shooting);
      expect(()=>serializeWorld(forged)).toThrow();
      expect(decoder.adopt(bad)).toMatchObject({status:'resync',reason:clockRefusal});
      expect(confirmed).toEqual(frozen);
    }
    const resumed=deserializeWorld(serializeWorld(w));expect(adopt(decoder,good)).toEqual(w);
    stepWorld(w,2);stepWorld(resumed,2);expect(resumed).toEqual(w);
    expect(adopt(decoder,structuredClone(encoder.encode(w,0,6)))).toEqual(w);
    expect(confirmed).toEqual(frozen);
  }
});

test.each([false,true])('197 migration preserves the original stance/order and rejects own future clock before atomic retry (checkpoint=%s)',checkpoint=>{
  for(const phase of ['aim','cooldown'] as const){
    const {world:w,shooterId}=prepareShootingStun(phase==='aim'?12:26,phase);historicalCustomFoodPolicies(w);
    for(const pawn of w.pawns)if(pawn.shooting?.stance)delete pawn.shooting.stance.clock;
    // The modern prepared steps have only initialized these future calendars.
    // No real ship, cargo, discovery or operator is removed to claim schema197.
    expect(w.orbital?.ships??[]).toEqual([]);expect(w.orbital?.pending??[]).toEqual([]);
    expect(w.deepResources?.discoveries??0).toBe(0);expect(w.deepResources?.cells??[]).toEqual([]);
    expect(w.pawns.some(p=>p.orbitalTrade||p.deepWork)).toBe(false);
    delete w.orbital;delete w.deepResources;
    (w as {schemaVersion:number}).schemaVersion=197;
    const original=JSON.stringify(w.pawns.find(p=>p.id===shooterId)!.shooting),migrated=deserializeWorld(JSON.stringify(w));
    expect(migrated).toEqual({...w,schemaVersion:SCHEMA_VERSION});
    expect(JSON.stringify(migrated.pawns.find(p=>p.id===shooterId)!.shooting)).toBe(original);
    const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),confirmed=adopt(decoder,structuredClone(encoder.encode(w,0,6)));
    const frozen=structuredClone(confirmed),good=structuredClone(encoder.encode(w,0,6,checkpoint));
    for(const future of [undefined,{lastAdvancedAtCore:w.tick*10,pausedCore:0}]){
      const bad=structuredClone(good),shooting=bad.world.pawns.find(p=>p.id===shooterId)!.shooting!;
      Object.assign(shooting.stance!,{clock:future});expect(Object.hasOwn(shooting.stance!,'clock')).toBe(true);
      expect(validShootingShape(shooting,197,w.tick)).toBe(false);
      expect(decoder.adopt(bad)).toMatchObject({status:'resync',reason:clockRefusal});expect(confirmed).toEqual(frozen);
      if(future!==undefined){const forged=structuredClone(w);forged.pawns.find(p=>p.id===shooterId)!.shooting=structuredClone(shooting);expect(()=>deserializeWorld(JSON.stringify(forged))).toThrow();}
    }
    expect(adopt(decoder,good)).toEqual(w);
    // Number-only migration is followed by real prospective advancement.
    stepWorld(migrated);expect(migrated.pawns.find(p=>p.id===shooterId)!.shooting?.stance?.clock).toBeDefined();
    expect(validateWorld(migrated)).toEqual([]);
  }
});

test.each([false,true])('AimStunned retains hard mandates and rejects nonliving map/post aliases before a valid retry (checkpoint=%s)',checkpoint=>{
  const {w,p,fixture}=produced('aim');
  // Prepare the actual finite post owner through its stock producer; no travel,
  // admission or exchange is claimed. Its IDs are outside the map pile array.
  expect(ensureCommercialPost(w)).toBe(true);expect(validateWorld(w)).toEqual([]);
  const stock=w.civilianPost!.stock[0]!;
  expect(w.piles.some(i=>i.id===stock.id)).toBe(false);
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),confirmed=adopt(decoder,structuredClone(encoder.encode(w,0,6)));
  const frozen=structuredClone(confirmed),good=structuredClone(encoder.encode(w,0,6,checkpoint));
  for(const targetId of [fixture.weaponId,stock.id,w.nextId]){
    const bad=structuredClone(good),pawn=bad.world.pawns.find(q=>q.id===p.id)!;
    pawn.shooting!.order!.targetId=targetId;
    const forged=structuredClone(w);forged.pawns.find(q=>q.id===p.id)!.shooting=structuredClone(pawn.shooting);
    expect(()=>serializeWorld(forged)).toThrow();
    expect(decoder.adopt(bad)).toMatchObject({status:'resync',reason:authorityRefusal});expect(confirmed).toEqual(frozen);
  }
  const unauthorized=structuredClone(good);delete unauthorized.world.pawns.find(q=>q.id===p.id)!.draft;
  expect(decoder.adopt(unauthorized)).toMatchObject({status:'resync',reason:authorityRefusal});expect(confirmed).toEqual(frozen);
  const prisoner=structuredClone(good),npc=prisoner.world.pawns.find(q=>q.id===p.id)!;
  npc.faction='outlaws';delete npc.draft;delete npc.hostilityResponse;npc.prisoner=createPrisonerState(w,npc);
  expect(validPrisonerPawnShape(raw(npc),SCHEMA_VERSION,w)).toBe(true);
  // The prisoner record is well formed; only its retained shooting mandate is
  // illegal. AimStunned cannot convert that into an autonomous NPC permission.
  expect(decoder.adopt(prisoner)).toMatchObject({status:'resync',reason:authorityRefusal});expect(confirmed).toEqual(frozen);
  expect(adopt(decoder,good)).toEqual(w);
  const beforeRng=w.rng,xp=p.skills.shooting.xp;
  expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:false}).ok).toBe(true);
  expect(p.shooting).toBeUndefined();expect(p.stun).toBeDefined();
  expect(w.rng).toBe(beforeRng);expect(p.skills.shooting.xp).toBe(xp);
  expect(validateWorld(w)).toEqual([]);expect(adopt(decoder,structuredClone(encoder.encode(w,0,6)))).toEqual(w);
});

test('a late refusal and a refused replacement retain clocks, epoch and indices; cooldown cancellation retains its real recovery',()=>{
  const {w,p}=produced('cooldown'),encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  const confirmed=adopt(decoder,structuredClone(encoder.encode(w,0,6))),frozen=structuredClone(confirmed);
  const retry=structuredClone(encoder.encode(w,0,6)),late=structuredClone(retry);
  late.world.relationships={links:[{kind:'sibling',aId:p.id,bId:w.nextId,recordedAt:w.tick}]};
  expect(decoder.adopt(late)).toMatchObject({status:'resync',reason:'Liens, annonce ou souvenirs relationnels incohérents.'});
  expect(confirmed).toEqual(frozen);
  const replacement=structuredClone(new SnapshotEncoder().encode(w,0,6)),goodReplacement=structuredClone(replacement);
  replacement.epoch=retry.epoch+1;goodReplacement.epoch=replacement.epoch;
  replacement.world.pawns.find(q=>q.id===p.id)!.shooting!.stance!.clock!.pausedCore++;
  expect(decoder.adopt(replacement)).toMatchObject({status:'resync',reason:clockRefusal});
  expect(adopt(decoder,retry)).toEqual(w);expect(confirmed).toEqual(frozen);
  expect(adopt(decoder,goodReplacement)).toEqual(w);
  // This encoder belongs to the replacement epoch too; subsequent deltas keep
  // that epoch and the refused checkpoint consumed no accepted revision.
  const afterReplacement=new SnapshotEncoder();adopt(decoder,{...structuredClone(afterReplacement.encode(w,0,6)),epoch:goodReplacement.epoch+1});
  const before=structuredClone(p.shooting!.stance),rng=w.rng;
  expect(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:false}).ok).toBe(true);
  expect(p.shooting!.order).toBeNull();expect(p.shooting!.stance).toEqual(before);expect(w.rng).toBe(rng);
  const resumed=deserializeWorld(serializeWorld(w));stepWorld(w);stepWorld(resumed);expect(resumed).toEqual(w);
  const next=structuredClone(afterReplacement.encode(w,0,6));next.epoch=goodReplacement.epoch+1;
  expect(adopt(decoder,next)).toEqual(w);expect(validateShooting(w)).toEqual([]);
});

test('presentation ignores continuous clock payment but publishes real suspension, cancellation and emission boundaries',()=>{
  const {w,p}=produced('aim'),view=new PresentationChanges();expect(view.capture(w)).toBe(true);
  stepWorld(w);expect(validateWorld(w)).toEqual([]);
  expect(p.shooting!.stance!.clock!.pausedCore).toBe(19);
  expect(view.capture(w)).toBe(false);expect(view.capture(deserializeWorld(serializeWorld(w)))).toBe(false);
  // Schema 318: the 120-tick Blunt stun ends at 30131; the remaining six
  // warmup ticks then emit at 30137, inside the same local step.
  for(let i=0;i<10;i++)stepWorld(w);
  expect(p.stun).toBeDefined();expect(p.shooting!.stance!.phase).toBe('aim');
  stepWorld(w);expect(p.stun).toBeUndefined();expect(p.lastAttack?.atCore).toBe(30137);expect(p.shooting!.stance!.phase).toBe('cooldown');expect(view.capture(w)).toBe(true);
  const recovery=structuredClone(p.shooting!.stance);
  expect(applyCommand(w,{type:'draft-stop',pawnIds:[p.id]}).ok).toBe(true);
  expect(p.shooting!.stance).toEqual(recovery);expect(view.capture(w)).toBe(true);
});
