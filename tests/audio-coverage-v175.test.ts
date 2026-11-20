import { UrgentThreatObserver, UrgentThreatDelivery } from '../src/bridge/urgent-threats';
import { expect, test } from 'vitest';
import { AudioCueRecorder } from '../src/bridge/audio-cues.ts';
import { applyCommand, deserializeWorld, serializeWorld, stepWorld } from '../src/sim/index.ts';
import { createBulletFlight } from '../src/sim/bullet-flight.ts';
import { registerWorldProjectile } from '../src/sim/projectile-system.ts';
import { medicalCamp } from './scenarios/health.ts';
import { deconstructionCamp, fixtureBuilding } from './scenarios/deconstruction.ts';
import { fireCamp, woodFire } from './scenarios/fire.ts';
import { powerFixture, fixturePower } from './scenarios/power.ts';
import type { Cell, World } from '../src/sim/types.ts';
import { animalCombatCamp } from './scenarios/animal-combat.ts';
import { startAnimalManhunter } from '../src/sim/animal-manhunter.ts';
import { sendLetter352 } from '../src/sim/letters-352.ts';

test('a real manhunter start uses one global receipt without local duplicate and reload remains silent',()=>{
  const world=animalCombatCamp(),animal=world.wildlife!.animals[0]!,recorder=new AudioCueRecorder();
  const observer=new UrgentThreatObserver(),delivery=new UrgentThreatDelivery();observer.bootstrap(world);
  recorder.capture(world);expect(recorder.drain()).toEqual([]);
  expect(startAnimalManhunter(world,animal)).toBe(true);
  recorder.capture(world);
  const cues=recorder.drain().filter(cue=>cue.kind==='ui.threat');
  expect(cues).toHaveLength(0); // Global worker receipt is the sole threat channel.
  // Schema 352: letters replace the former threat kinds. A bare manhunter
  // start sends no letter (Core notifies a wild animal's own mental state
  // to nobody), so no receipt; its producers' letters are the only source.
  expect(observer.capture(world,'any-threat')).toBe(false);expect(delivery.commit(observer.snapshot(),world.tick)).toBeUndefined();
  sendLetter352(world,{cls:'threat-small',title:'Animal enragé',text:'',targets:[{kind:'actor',id:animal.id}]});
  expect(observer.capture(world,'any-threat')).toBe(true);
  expect(delivery.commit(observer.snapshot(),world.tick)).toMatchObject({paused:true,rows:[{kind:'letter',delta:1}]});
  expect(observer.capture(world,'any-threat')).toBe(false);expect(delivery.commit(observer.snapshot(),world.tick)).toBeUndefined();
  recorder.capture(world);expect(recorder.drain()).toEqual([]);
  const resumed=deserializeWorld(serializeWorld(world));
  const reloadedObserver=new UrgentThreatObserver();reloadedObserver.bootstrap(resumed);expect(reloadedObserver.capture(resumed,'any-threat')).toBe(false);
  recorder.reset();recorder.capture(resumed);expect(recorder.drain()).toEqual([]);
  stepWorld(resumed);recorder.capture(resumed);
  expect(recorder.drain().filter(cue=>cue.kind==='ui.threat')).toEqual([]);
});

function captureTicks(world: World, recorder: AudioCueRecorder, done: () => boolean, limit = 250) {
  const heard: string[] = [];
  for (let i = 0; i < limit && !done(); i++) {
    stepWorld(world);
    recorder.capture(world);
    heard.push(...recorder.drain().map(cue => cue.kind));
  }
  expect(done()).toBe(true);
  return heard;
}

function launch(world: World, from: Cell, to: Cell, targetKey: string | null) {
  return registerWorldProjectile(world, createBulletFlight({
    origin: { x: from.x + .5, z: from.z + .5 },
    destination: { x: to.x + .5, z: to.z + .5 },
    launcherKey: `pawn:${world.pawns[0]!.id}`, equipmentKey: null,
    intendedKey: targetKey, usedKey: targetKey, flags: 7,
    preventFriendlyFire: false, speedPerCoreTick: .55,
  }), 'normal', { friendlyPawnIds: world.pawns.map(pawn => pawn.id), friendlyFireFactor: .4 });
}

test('real projectile arrivals sound once by physical effect', () => {
  for (const effect of ['ground', 'barrier', 'pawn'] as const) {
    const world = medicalCamp(2), [shooter, victim] = world.pawns;
    Object.assign(shooter!, { x: 5, z: 10 });
    Object.assign(victim!, { x: effect === 'pawn' ? 25 : 25, z: effect === 'pawn' ? 10 : 15 });
    const wall = effect === 'barrier' ? fixtureBuilding(world, 'wall', 12, 10) : undefined;
    const target = effect === 'ground' ? { x: 12, z: 10 } : effect === 'barrier'
      ? { x: 20, z: 10 } : victim!;
    const targetKey = effect === 'pawn' ? `pawn:${victim!.id}`
      : effect === 'barrier' ? `structure:${wall!.id}` : null;
    const projectile = launch(world, shooter!, target, targetKey);
    const recorder = new AudioCueRecorder();
    recorder.capture(world); expect(recorder.drain()).toEqual([]);
    const heard = captureTicks(world, recorder, () => !!projectile.arrival, 12);
    expect(projectile.arrival?.effect).toBe(effect);
    expect(heard.filter(kind => kind === `weapon.impact-${effect === 'pawn' ? 'flesh' : effect}`)).toHaveLength(1);
    recorder.capture(world); expect(recorder.drain()).toEqual([]);
    recorder.reset(); recorder.capture(world); expect(recorder.drain()).toEqual([]);
  }
});

test('a projectile already arrived on recorder initialization and a map exit remain silent', () => {
  const world = medicalCamp(2), shooter = world.pawns[0]!;
  Object.assign(shooter, { x: 5, z: 10 });
  const arrived = launch(world, shooter, { x: 6, z: 10 }, null);
  for (let i = 0; i < 4 && !arrived.arrival; i++) stepWorld(world);
  expect(arrived.arrival?.effect).toBe('ground');
  const recorder = new AudioCueRecorder();
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  const exiting = launch(world, { x: 30, z: 10 }, { x: 34, z: 10 }, null);
  captureTicks(world, recorder, () => !!exiting.arrival, 5);
  expect(exiting.arrival?.effect).toBe('exit');
  expect(recorder.drain()).toEqual([]);
  const immediate = launch(world, shooter, { x: 6, z: 11 }, null);
  const heard = captureTicks(world, recorder, () => !!immediate.arrival, 5);
  expect(immediate.arrival?.effect).toBe('ground');
  expect(heard.filter(kind => kind === 'weapon.impact-ground')).toHaveLength(1);
});

test('a confirmed fire beat sounds; the final blow is not inferred after its task disappears', () => {
  const world = fireCamp(), pawn = world.pawns[0]!;
  const fireId = woodFire(world, { x: pawn.x + 1, z: pawn.z }, .6);
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(applyCommand(world, { type: 'order-extinguish', pawnId: pawn.id, fireId }).ok).toBe(true);
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  const heard: string[] = [];
  for (let index = 0; index < 20 && world.fires?.items.some(fire => fire.id === fireId); index++) {
    stepWorld(world); recorder.capture(world);
    heard.push(...recorder.drain().map(cue => cue.kind));
  }
  expect(world.fires?.items.some(fire => fire.id === fireId)).toBe(false);
  expect(heard.filter(kind => kind === 'firefighting.beat')).toHaveLength(1);
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
});

test('power switch cues require completed contact, never the order or its cancellation', () => {
  const world = powerFixture(), pawn = world.pawns[0]!;
  pawn.schedule.fill('work'); pawn.priorities.basic = 1; pawn.priorities.build = 0; pawn.priorities.haul = 0;
  const generator = fixturePower(world, 'wood-generator', 16, 16);
  const recorder = new AudioCueRecorder();
  recorder.capture(world);
  expect(applyCommand(world, { type: 'power-flick', structureId: generator.id, on: false }).ok).toBe(true);
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  const off = captureTicks(world, recorder, () => generator.power?.switchOn === false, 200);
  expect(off.filter(kind => kind === 'power.switch-off')).toHaveLength(1);
  expect(applyCommand(world, { type: 'power-flick', structureId: generator.id, on: true }).ok).toBe(true);
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  const on = captureTicks(world, recorder, () => generator.power?.switchOn === true, 200);
  expect(on.filter(kind => kind === 'power.switch-on')).toHaveLength(1);
  expect(applyCommand(world, { type: 'power-flick', structureId: generator.id, on: false }).ok).toBe(true);
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  expect(applyCommand(world, { type: 'cancel', x: generator.x, z: generator.z }).ok).toBe(true);
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
});

test('a flick completed after resume survives skipped cue publications', () => {
  const world = powerFixture(), pawn = world.pawns[0]!;
  pawn.schedule.fill('work'); pawn.priorities.basic = 1; pawn.priorities.build = 0; pawn.priorities.haul = 0;
  const lamp = fixturePower(world, 'standing-lamp', 16, 16);
  expect(applyCommand(world, { type: 'power-flick', structureId: lamp.id, on: false }).ok).toBe(true);
  const job = world.jobs.find(candidate => candidate.flick?.structureId === lamp.id)!;
  const beforeSave = new AudioCueRecorder();
  beforeSave.capture(world); expect(beforeSave.drain()).toEqual([]);
  captureTicks(world, beforeSave, () => job.progress === 10, 200);
  expect(lamp.power?.switchOn).not.toBe(false);
  const resumed = deserializeWorld(serializeWorld(world)), afterSave = new AudioCueRecorder();
  afterSave.capture(resumed); expect(afterSave.drain()).toEqual([]);
  for (let index = 0; index < 200 && resumed.structures.find(item => item.id === lamp.id)?.power?.switchOn !== false; index++) {
    stepWorld(resumed);
    afterSave.capture(resumed); // Worker observes each tick; presentation may skip publications.
  }
  expect(resumed.structures.find(item => item.id === lamp.id)?.power?.switchOn).toBe(false);
  expect(afterSave.drain().filter(cue => cue.kind === 'power.switch-off')).toHaveLength(1);
  afterSave.capture(resumed); expect(afterSave.drain()).toEqual([]);
});

test('deconstruction sounds physical progress and ledger-backed completion, but no cancellation', () => {
  const world = deconstructionCamp(), pawn = world.pawns[0]!;
  const wall = fixtureBuilding(world, 'wall', 14, 16);
  expect(applyCommand(world, { type: 'designate', kind: 'deconstruct', x: wall.x, z: wall.z }).ok).toBe(true);
  const job = world.jobs.find(candidate => candidate.deconstruction?.structureId === wall.id)!;
  expect(applyCommand(world, { type: 'order-job', pawnId: pawn.id, jobId: job.id, queue: false }).ok).toBe(true);
  const recorder = new AudioCueRecorder();
  recorder.capture(world); expect(recorder.drain()).toEqual([]);
  const beforeSave = captureTicks(world, recorder, () => job.progress > 0, 300);
  expect(beforeSave).toContain('deconstruction.work');
  const resumed = deserializeWorld(serializeWorld(world)), resumedRecorder = new AudioCueRecorder();
  resumedRecorder.capture(resumed); expect(resumedRecorder.drain()).toEqual([]);
  const afterSave = captureTicks(resumed, resumedRecorder,
    () => !resumed.structures.some(item => item.id === wall.id), 300);
  expect(afterSave.filter(kind => kind === 'building.deconstructed')).toHaveLength(1);
  const other = fixtureBuilding(resumed, 'wall', 16, 16);
  expect(applyCommand(resumed, { type: 'designate', kind: 'deconstruct', x: other.x, z: other.z }).ok).toBe(true);
  const otherJob = resumed.jobs.find(candidate => candidate.deconstruction?.structureId === other.id)!;
  expect(applyCommand(resumed, { type: 'order-job', pawnId: pawn.id, jobId: otherJob.id, queue: false }).ok).toBe(true);
  resumedRecorder.capture(resumed); expect(resumedRecorder.drain()).toEqual([]);
  captureTicks(resumed, resumedRecorder, () => otherJob.progress > 0, 300);
  expect(applyCommand(resumed, { type: 'cancel', x: other.x, z: other.z }).ok).toBe(true);
  resumedRecorder.capture(resumed); expect(resumedRecorder.drain()).toEqual([]);
  expect(resumed.structures).toContain(other);
});
