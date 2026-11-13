import { expect,test } from 'vitest';
import { stepWorld } from '../src/sim/engine.ts';
import { serializeWorld,deserializeWorld,validateWorld } from '../src/sim/serialization.ts';
import { applyEmpEffect,advanceEmp } from '../src/sim/emp-effects.ts';
import { empMechanoidActive } from '../src/sim/emp-state.ts';
import { empStunDuration } from '../src/sim/emp-rules.ts';
import { advanceMechanoidCombat } from '../src/sim/mechanoid-combat.ts';
import { damageMechanoidWithBullet,delayMechanoidImpact } from '../src/sim/mechanoid-impact.ts';
import { travelPieces } from '../src/sim/travel-timing.ts';
import { miningCamp } from './scenarios/mining.ts';
import { fixtureMechanoid,mechanoidCombatCamp } from './scenarios/mechanoid-combat-v213.ts';
import { rangedMechanoidCamp,prepareRangedDecision } from './scenarios/ranged-mechanoid-v219.ts';

test.each([[45,1350],[50,1500],[62,1860],[75,2250]])('EMP dose %i owns %i Core ticks without health, stagger, IDs or RNG', (damage,duration)=>{
  const w=miningCamp(0),m=fixtureMechanoid(w,15,15),before=structuredClone(w),core=w.tick*10;
  expect(empStunDuration(damage)).toBe(duration);
  expect(applyEmpEffect(w,m,damage,core)).toBe(true);
  expect(m.emp).toEqual({lastAtCore:core,adaptedUntilCore:core+2200,stunUntilCore:core+duration});
  expect(m.health).toBeUndefined();expect(m.stun).toBeUndefined();expect(m.stagger).toBeUndefined();
  expect(w.rng).toBe(before.rng);expect(w.nextId).toBe(before.nextId);expect(w.piles).toEqual(before.piles);
  expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('adaptation rejects every intermediate hit without renewal, including after the normal stun has ended',()=>{
  const w=miningCamp(0),m=fixtureMechanoid(w,15,15),core=w.tick*10;
  expect(applyEmpEffect(w,m,50,core)).toBe(true);const accepted=structuredClone(m.emp);
  w.tick+=149;expect(applyEmpEffect(w,m,75,w.tick*10)).toBe(false);expect(m.emp).toEqual(accepted);
  w.tick++;expect(empMechanoidActive(m,w.tick*10)).toBe(false);expect(advanceEmp(w)).toBe(false);
  expect(applyEmpEffect(w,m,50,w.tick*10)).toBe(false);expect(m.emp).toEqual(accepted);
  w.tick+=70;expect(applyEmpEffect(w,m,50,w.tick*10)).toBe(true);
  expect(m.emp).toEqual({lastAtCore:core+2200,adaptedUntilCore:core+4400,stunUntilCore:core+3700});
});

test('legendary stun outlives adaptation and admits a second hit at exactly 2200 Core',()=>{
  const w=miningCamp(0),m=fixtureMechanoid(w,15,15),core=w.tick*10;
  expect(applyEmpEffect(w,m,75,core)).toBe(true);w.tick+=220;
  expect(empMechanoidActive(m,w.tick*10)).toBe(true);expect(advanceEmp(w)).toBe(false);
  expect(applyEmpEffect(w,m,45,w.tick*10)).toBe(true);
  expect(m.emp?.stunUntilCore).toBe(core+2200+1350);
  w.tick+=220;expect(advanceEmp(w)).toBe(true);expect(m.emp).toBeUndefined();
});

test('flesh, incapacitated/absent owners, future clock, unknown dose and pre208 contact are rejected atomically',()=>{
  const w=miningCamp(1),m=fixtureMechanoid(w,15,15),core=w.tick*10;
  for(const attempt of [()=>applyEmpEffect(w,w.pawns[0]!,50,core),()=>applyEmpEffect(w,{...m},50,core),
    ()=>applyEmpEffect(w,m,50,core+1),()=>applyEmpEffect(w,m,49,core)]){
    const before=structuredClone(w);expect(attempt()).toBe(false);expect(w).toEqual(before);
  }
  m.state='downed';const stopped=structuredClone(w);expect(applyEmpEffect(w,m,50,core)).toBe(false);expect(w).toEqual(stopped);
  m.state='idle';w.schemaVersion=207 as typeof w.schemaVersion;const old=structuredClone(w);expect(applyEmpEffect(w,m,50,core)).toBe(false);expect(w).toEqual(old);
});

test('an actual ranged warmup keeps aim and its remaining duration across EMP, duplicate passage and save/reload',()=>{
  const {w,m}=rangedMechanoidCamp();prepareRangedDecision(w,m);stepWorld(w,3);
  const remaining=m.ranged!.stance!.remainingCore,core=w.tick*10,target=m.ranged!.order!.targetKey;
  expect(applyEmpEffect(w,m,50,core)).toBe(true);expect(validateWorld(w)).toEqual([]);
  const peer=deserializeWorld(serializeWorld(w));
  for(let i=0;i<10;i++){stepWorld(w);stepWorld(peer);expect(peer).toEqual(w);expect(validateWorld(w)).toEqual([]);
    expect(m.ranged?.stance).toMatchObject({phase:'warmup',remainingCore:remaining,lastAdvancedAtCore:w.tick*10});
    expect(m.ranged?.order?.targetKey).toBe(target);
  }
  const once=structuredClone(w);advanceMechanoidCombat(w,m,w.tick*10);expect(w).toEqual(once);
  expect(w.projectiles).toBeUndefined();expect(m.health).toBeUndefined();
});

test('EMP suspends the exact committed edge and keeps its route and elapsed position',()=>{
  const {w,m,victim}=rangedMechanoidCamp();Object.assign(victim,{x:90,z:48});Object.assign(w.pawns[1]!,{x:90,z:51});
  prepareRangedDecision(w,m);stepWorld(w);
  expect(m.motion!.end).toBeGreaterThan(w.tick);
  const before=structuredClone(m.motion!),path=structuredClone(m.path),core=w.tick*10;
  expect(applyEmpEffect(w,m,50,core)).toBe(true);
  expect(m.motion?.from).toEqual(before.from);expect(m.motion?.to).toEqual(before.to);expect(m.motion?.start).toBe(before.start);
  expect(m.motion?.end).toBeCloseTo(before.end+150,8);expect(m.path).toEqual(path);expect(m.stun).toBeUndefined();
  const stopped=travelPieces(m.motion!).find(p=>p.start===w.tick&&p.end===(core+1500)/10)!;
  expect(stopped.fromFraction).toBeCloseTo((w.tick-before.start)/(before.end-before.start),8);
  expect(stopped.toFraction).toBe(stopped.fromFraction);
  expect(validateWorld(w)).toEqual([]);const peer=deserializeWorld(serializeWorld(w));
  stepWorld(w,3);stepWorld(peer,3);expect(peer).toEqual(w);expect(m.path).toEqual(path);
});

test('death interrupts EMP suspension without losing adaptation, the elapsed edge or the existing 45-Core interval',()=>{
  const {w,m,victim}=rangedMechanoidCamp();Object.assign(victim,{x:90,z:48});Object.assign(w.pawns[1]!,{x:90,z:51});
  prepareRangedDecision(w,m);stepWorld(w);const core=w.tick*10;
  delayMechanoidImpact(w,m,core,true);const historical=m.stun!.untilCore;
  expect(applyEmpEffect(w,m,50,core)).toBe(true);
  expect(damageMechanoidWithBullet(w,m,{damage:100,part:'lancer-brain'},core,3)).toBeDefined();
  expect(m.state).toBe('dead');expect(m.emp?.stunUntilCore).toBe(core);expect(m.emp?.adaptedUntilCore).toBe(core+2200);
  expect(empMechanoidActive(m,core)).toBe(false);expect(m.motion?.stuns?.at(-1)?.end).toBe(historical/10);
  expect(m.stun).toBeUndefined();expect(m.health?.death).toBeDefined();
});

test('a real melee recovery pauses once per EMP Core and resumes its remaining physical cooldown after reload',()=>{
  const {w,m,victim}=mechanoidCombatCamp();m.x=victim.x-1;m.z=victim.z;
  for(let i=0;i<8&&!m.melee?.strike;i++)stepWorld(w);
  expect(m.melee?.strike).toBeTruthy();const strike=m.melee!.strike!,at=strike.atCore,originalEnd=strike.untilCore,core=w.tick*10;
  expect(applyEmpEffect(w,m,50,core)).toBe(true);expect(validateWorld(w)).toEqual([]);
  const peer=deserializeWorld(serializeWorld(w));
  for(let i=0;i<6;i++){stepWorld(w);stepWorld(peer);expect(peer).toEqual(w);expect(validateWorld(w)).toEqual([]);}
  expect(m.melee?.strike).toMatchObject({atCore:at,untilCore:originalEnd+60,empPause:{ticks:60,lastAtCore:w.tick*10}});
  const once=structuredClone(w);advanceMechanoidCombat(w,m,w.tick*10);expect(w).toEqual(once);
  // Prevent another attack after recovery; stop retains the actual cooldown.
  m.melee!.order=null;peer.mechanoids!.find(p=>p.id===m.id)!.melee!.order=null;
  for(let i=0;i<155&&m.melee?.strike;i++){stepWorld(w);stepWorld(peer);expect(peer).toEqual(w);}
  expect(m.melee?.strike?.atCore).not.toBe(at);expect(m.health).toBeUndefined();
});

test('a Blunt impact stun (120 Core from schema 318) does not introduce the new EMP melee recovery clock',()=>{
  const {w,m,victim}=mechanoidCombatCamp();m.x=victim.x-1;m.z=victim.z;
  for(let i=0;i<8&&!m.melee?.strike;i++)stepWorld(w);
  expect(m.melee?.strike).toBeTruthy();const end=m.melee!.strike!.untilCore,core=w.tick*10;
  delayMechanoidImpact(w,m,core,true);expect(m.stun?.untilCore).toBe(core+120);expect(m.emp).toBeUndefined();
  stepWorld(w,3);expect(m.melee?.strike?.untilCore).toBe(end);expect(m.melee?.strike?.empPause).toBeUndefined();
  expect(validateWorld(w)).toEqual([]);
});
