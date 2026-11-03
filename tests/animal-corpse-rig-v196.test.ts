import { expect,test } from 'vitest';
import * as THREE from 'three/webgpu';
import { animalCombatCamp } from './scenarios/animal-combat';
import { validateWorld } from '../src/sim/serialization';
import { refreshStock } from '../src/sim/materials';
import { processHaul } from '../src/sim/hauling';
import { addResolvedInjury,createMedicalRecord,reconcileMedicalDeath } from '../src/sim/injury-state';
import { BLOOD_UNIT } from '../src/sim/injury-rules';
import { adultAgeTicks } from '../src/sim/animal-life';
import { createAnimalMedicalRecord256 } from '../src/sim/animal-clinical-age-v256';
import { ANIMAL_SPECIES_IDS,type AnimalSpeciesId } from '../src/sim/animal-species';
import { WildlifeLayer } from '../src/render/WildlifeLayer';
import { PawnLayer } from '../src/render/PawnLayer';
import { commonAnimalPresentationGeometry } from '../src/render/origami/animal-geometry';
import { corpseVisualMask,corpseVisualPartBit } from '../src/render/corpse-presentation';
import { pileParts } from '../src/render/pile-parts';
import { cargoGeometry } from '../src/render/pawn-geometry';
import type { CorpseState } from '../src/sim/corpses';
import { MotionTimeline } from '../src/render/MotionTimeline';
import { bodyBloodWord } from '../src/render/body-blood';

function corpse(species:AnimalSpeciesId,id:number):CorpseState {
  const health=createAnimalMedicalRecord256({tick:0,schemaVersion:263},{species,ageTicks:adultAgeTicks(species)});health.bloodLoss=BLOOD_UNIT;reconcileMedicalDeath(health);
  return {animalId:id,species,sex:'female',ageTicks:adultAgeTicks(species),health};
}
function rig(layer:WildlifeLayer,species:string):THREE.Mesh {
  return layer.mesh.children.find(m=>m.name===`Wild ${species} — GPU rig`)! as THREE.Mesh;
}

test('all species keep the full shared faceted body, coat palette and resident cross eyes at death and deposition',()=>{
  const world=animalCombatCamp(),layer=new WildlifeLayer();world.wildlife!.animals=[];world.piles=[];
  for(const [index,species] of ANIMAL_SPECIES_IDS.entries())world.piles.push({id:900+index,kind:'corpse',item:`${species}-corpse`,quantity:1,owner:{type:'ground',x:1+index%(world.width-2),z:1+Math.floor(index/(world.width-2))},corpse:corpse(species,900+index),rot:{progress:0,atTick:world.tick}});
  world.nextId=Math.max(world.nextId,900+ANIMAL_SPECIES_IDS.length);refreshStock(world);expect(validateWorld(world)).toEqual([]);
  const before=structuredClone(world);layer.update(world,undefined,true);
  for(const species of ANIMAL_SPECIES_IDS){
    const mesh=rig(layer,species),geometry=mesh.geometry as THREE.InstancedBufferGeometry;
    expect(geometry.instanceCount).toBe(1);expect(geometry.getAttribute('aAnimal').getZ(0)).toBe(2);
    expect(geometry.getAttribute('aScale').getX(0)).toBe(1);
    const bind=commonAnimalPresentationGeometry(1,species,false);if(!bind)throw Error('Missing shared species model '+species);const position=geometry.getAttribute('position'),color=geometry.getAttribute('color'),normal=geometry.getAttribute('normal'),eye=geometry.getAttribute('eyeMark');
    expect(Array.from(position.array)).toEqual(Array.from(bind.getAttribute('position').array));
    expect(Array.from(color.array)).toEqual(Array.from(bind.getAttribute('color').array));
    let open=0,cross=0;for(let vertex=0;vertex<eye.count;vertex++){
      open+=eye.getX(vertex)===0?1:0;cross+=eye.getX(vertex)===1?1:0;
      expect(Math.hypot(normal.getX(vertex),normal.getY(vertex),normal.getZ(vertex))).toBeCloseTo(1,5);
    }
    expect(open).toBeGreaterThan(0);expect(cross).toBeGreaterThan(0);bind.dispose();
  }
  expect(world).toEqual(before);layer.setTexturesEnabled(false);layer.dispose();
});

test('consumption updates the same rig mask at the same tick; corpses never duplicate in the proxy batches',()=>{
  const world=animalCombatCamp(),layer=new WildlifeLayer();world.wildlife!.animals=[];
  const body=corpse('hare',900);world.piles=[{id:900,kind:'corpse',item:'hare-corpse',quantity:1,owner:{type:'ground',x:8,z:9},corpse:body,rot:{progress:0,atTick:world.tick}}];
  world.nextId=Math.max(world.nextId,901);refreshStock(world);expect(validateWorld(world)).toEqual([]);
  layer.update(world,undefined,true);const mesh=rig(layer,'hare'),geometry=mesh.geometry,mask=geometry.getAttribute('aAbsent');
  const changed=structuredClone(world);changed.piles[0]!.corpse!.consumedParts=[{part:'head',atTick:0},{part:'left-front-paw',atTick:0}];
  expect(validateWorld(changed)).toEqual([]);
  const history=structuredClone(changed.piles[0]!.corpse!.health);layer.update(changed,undefined);
  expect(mesh.geometry).toBe(geometry);expect(geometry.getAttribute('aAbsent')).toBe(mask);
  expect(mask.getX(0)).toBe(corpseVisualMask(changed.piles[0]!.corpse!));expect(changed.piles[0]!.corpse!.health).toEqual(history);
  const bits=geometry.getAttribute('corpsePartMask'),owners=new Set(Array.from({length:bits.count},(_,i)=>bits.getX(i)));
  // The common source asset authors its front shin/paw as one primitive owned
  // by the leg. Clinical child consumption is still retained in the exact mask;
  // it cannot manufacture a separate paw mesh or remove the intact parent leg.
  const paw=corpseVisualPartBit('left-front-paw'),leg=corpseVisualPartBit('left-front-leg');
  expect(owners.has(leg)).toBe(true);expect(owners.has(paw)).toBe(false);expect(mask.getX(0)&paw).toBe(paw);expect(mask.getX(0)&leg).toBe(0);expect(owners.has(corpseVisualPartBit('head'))).toBe(true);
  expect(pileParts([{x:8,z:9,kind:'corpse',item:'hare-corpse',quantity:1,supplied:false,corpse:body}])).toEqual([]);
  const cargo=cargoGeometry(),kinds=cargo.getAttribute('cargoKind');expect(Array.from({length:kinds.count},(_,i)=>kinds.getX(i))).not.toContain(27);cargo.dispose();layer.dispose();
});

test('carried animals use the exact resident carrier edge and one shared species batch',()=>{
  const world=animalCombatCamp(),pawns=new PawnLayer(),layer=new WildlifeLayer(),pawn=world.pawns[0]!;
  world.wildlife!.animals=[];world.piles=[{id:900,kind:'corpse',item:'muffalo-corpse',quantity:1,owner:{type:'ground',x:pawn.x,z:pawn.z},corpse:corpse('muffalo',900),rot:{progress:0,atTick:world.tick}}];
  delete pawn.draft;delete pawn.shooting; pawn.priorities.haul=1; pawn.priorities.grow=1;
  pawn.haul={sourcePileId:900,carryPileId:null,quantity:1,phase:'pickup',destination:{type:'aside',x:15,z:15}};
  processHaul(world,pawn,()=>{throw new Error('Prepared pickup must occur at the corpse, without a remote shortcut.');},()=>{});
  expect(pawn.haul?.phase).toBe('deliver');expect(pawn.haul?.carryPileId).toBe(900);
  expect(world.piles[0]!.owner).toEqual({type:'pawn',pawnId:pawn.id});
  world.nextId=Math.max(world.nextId,901);refreshStock(world);expect(validateWorld(world)).toEqual([]);
  pawns.update(world,1,true);layer.update(world,undefined,true,pawns);
  const geometry=rig(layer,'muffalo').geometry,source=pawns.feedbackSource!;
  expect(geometry.getAttribute('aCarrier').getX(0)).toBe(1);
  for(const name of ['aFrom','aTo','aTravel'])for(let component=0;component<4;component++)expect(geometry.getAttribute(name).getComponent(0,component)).toBe(source.getAttribute(name).getComponent(0,component));
  const stream=geometry.getAttribute('aFrom') as THREE.InterleavedBufferAttribute;
  const frozen=stream.data.version;layer.update(world,undefined,false,pawns);expect(stream.data.version).toBe(frozen);
  const restore=layer.prepare(),count=(geometry as THREE.InstancedBufferGeometry).instanceCount;restore();expect((geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(count);
  layer.dispose();pawns.dispose();
});

test('static ground corpse skips frame/rebase uploads but same-tick adoption and reset still refresh the complete record',()=>{
  const world=animalCombatCamp(),layer=new WildlifeLayer(),timeline=new MotionTimeline();
  // The playhead is controlled solely to exercise its origin boundary; the
  // prepared simulation keeps its real tick and all clinical/checkpoint dates.
  world.wildlife!.animals=[];
  world.piles=[{id:900,kind:'corpse',item:'hare-corpse',quantity:1,owner:{type:'ground',x:8,z:9},corpse:corpse('hare',900),rot:{progress:0,atTick:world.tick}}];
  world.nextId=Math.max(world.nextId,901);refreshStock(world);expect(validateWorld(world)).toEqual([]);
  timeline.tick=1023.9;layer.update(world,timeline,true);
  const geometry=rig(layer,'hare').geometry,from=geometry.getAttribute('aFrom') as THREE.InterleavedBufferAttribute;
  const absent=geometry.getAttribute('aAbsent'),blood=geometry.getAttribute('aBodyBlood'),version=from.data.version;
  const primitives=Array.from(from.data.array),before=structuredClone(world);
  timeline.tick=1024.1;layer.update(world,timeline);layer.update(world,timeline);
  expect(rig(layer,'hare').geometry).toBe(geometry);expect(geometry.getAttribute('aFrom')).toBe(from);
  expect(from.data.version).toBe(version);expect(Array.from(from.data.array)).toEqual(primitives);expect(world).toEqual(before);

  const changed=structuredClone(world),body=changed.piles[0]!.corpse!;
  body.consumedParts=[{part:'head',atTick:changed.tick}];
  const health=createMedicalRecord(0);health.body='hare';addResolvedInjury(health,'torso','cut',2000,()=>.99);
  health.bloodLoss=BLOOD_UNIT;reconcileMedicalDeath(health);body.health=health;
  expect(changed.tick).toBe(world.tick);expect(validateWorld(changed)).toEqual([]);
  const changedBefore=structuredClone(changed);layer.update(changed,timeline);
  expect(rig(layer,'hare').geometry).toBe(geometry);expect(geometry.getAttribute('aBodyBlood')).toBe(blood);
  expect(absent.getX(0)).toBe(corpseVisualMask(body));expect(blood.getX(0)).toBe(bodyBloodWord(health));expect(blood.getX(0)).toBeGreaterThan(0);
  expect(from.data.version).toBeGreaterThan(version);expect(changed).toEqual(changedBefore);
  const confirmed=Array.from(from.data.array),adoptedVersion=from.data.version;
  layer.update(changed,timeline,true);
  expect(rig(layer,'hare').geometry).toBe(geometry);expect(from.data.version).toBeGreaterThan(adoptedVersion);
  expect(Array.from(from.data.array)).toEqual(confirmed);expect(changed).toEqual(changedBefore);layer.dispose();
});
