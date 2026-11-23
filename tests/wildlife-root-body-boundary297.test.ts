import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {ANIMAL_POSTURE_DOWNED} from '../src/render/actor-idle-gestures';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {damageAnimalWithBullet} from '../src/sim/wildlife-health.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {animalRescueCamp} from './helpers/animal-rescue-v310';
import type {World} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

function clinical(kind:'dead'|'downed'):{world:World;animal:WildAnimal}{
 if(kind==='downed'){
  // Existing prepared clinical helper uses real injuries and reconciliation,
  // and validates before return. No played Raw is edited to force a state.
  const {world,animalId}=animalRescueCamp(),animal=world.wildlife!.animals.find(a=>a.id===animalId)!;
  expect(animal.state).toBe('downed');expect(animal.health?.death).toBeUndefined();return {world,animal};
 }
 const bytes=readFileSync('public/test-saves/v419/les-eclaircies.json');
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('49e5d50abfac5a2ac0e609378877bb645da3e4559286cff706a33dc00f0df19f');
 const world=deserializeWorld(bytes.toString('utf8')),animal=world.wildlife!.animals.find(a=>a.species==='hare'&&a.state!=='dead')!;
 if(!animal)throw Error('Pinned public scene has no original living hare');
 // Actual projectile injury/death transaction commits medical state and RNG.
 // It keeps any captured falling edge through the existing health producer.
 damageAnimalWithBullet(world,animal,{part:'heart',damage:1000},effectiveCore297(world));
 expect(animal.state).toBe('dead');expect(animal.health?.death).toBeDefined();return {world,animal};
}

test.each(['dead','downed'] as const)('a real clinical %s animal keeps falling/rest primitives outside the free-live root tweener',kind=>{
 const {world,animal}=clinical(kind);expect(validateWorld(world)).toEqual([]);
 const raw=serializeWorld(world),core=effectiveCore297(world),rng=world.rng,nextId=world.nextId;
 const layer=new WildlifeLayer(),timeline=new MotionTimeline();timeline.tick=core/10;
 for(const a of world.wildlife!.animals)if(a.motion)timeline.tracks.set(a.id,[a.motion]);
 try{
  layer.update(world,timeline,true,undefined,undefined,1/60,1);layer.presentAnimations();
  const mesh=layer.mesh.children.find(c=>c.name.startsWith(`Wild ${animal.species} `)) as THREE.Mesh|undefined;
  if(!mesh)throw Error('Actual clinical species mesh absent');
  const slot=world.wildlife!.animals.filter(a=>a.species===animal.species).findIndex(a=>a.id===animal.id),g=mesh.geometry;
  // A downed animal is posed 1.25 for Core's downed wiggle (actor-idle-gestures.ts).
  expect(g.getAttribute('aAnimal').getZ(slot)).toBe(kind==='dead'?2:ANIMAL_POSTURE_DOWNED);
  // Free-root smoothing encodes equal displayed endpoints with marker2.
  // A clinical actor must retain the ordinary falling/rest marker0..1.
  expect(g.getAttribute('aTravel').getW(slot)).toBeLessThanOrEqual(1);
  const before=['aFrom','aTo','aTravel'].map(name=>{const s=g.getAttribute(name);return [s.getX(slot),s.getY(slot),s.getZ(slot),s.getW(slot)];});
  for(let n=0;n<12;n++)layer.update(world,timeline,false,undefined,undefined,1/60,0);
  expect(['aFrom','aTo','aTravel'].map(name=>{const s=g.getAttribute(name);return [s.getX(slot),s.getY(slot),s.getZ(slot),s.getW(slot)];})).toEqual(before);
  expect(effectiveCore297(world)).toBe(core);expect(world.rng).toBe(rng);expect(world.nextId).toBe(nextId);
  expect(serializeWorld(world)===raw,'Every actual clinical Whole byte remains unchanged by rendering').toBe(true);
  expect(serializeWorld(deserializeWorld(raw))===raw).toBe(true);
 }finally{layer.dispose();}
},120000);
