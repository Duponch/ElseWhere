import { expect,test,vi } from 'vitest';
import { Group } from 'three/webgpu';
import { PresentationChanges } from '../src/bridge/presentation-changes.ts';
import { AudioCueRecorder } from '../src/bridge/audio-cues.ts';
import { parseAudioManifest } from '../src/audio/AudioDirector.ts';
import { miniTurretTargets,miniTurretView,miniTurretRadiusCells } from '../src/sim/mini-turret-presentation.ts';
import { miniTurretBaseParts,miniTurretTopParts,MINI_TURRET_TOP_PART_COUNT } from '../src/render/mini-turret-parts.ts';
import { MiniTurretLayer } from '../src/render/MiniTurretLayer.ts';
import type { BoxBatches } from '../src/render/BoxBatches.ts';
import { placementMaterial } from '../src/ui/construction-controls.ts';
import { buildingLabels } from '../src/ui/building-labels.ts';
import { researchProjects,researchLinks } from '../src/ui/research-panel.ts';
import { campTurret,miniTurretCamp } from './scenarios/mini-turret-v212.ts';
import { producedTurretServiceCheckpoint } from './helpers/mini-turret-v212.ts';

test('confirmed public/private target, quarter shots and service are pure facts, including a missing historical target',()=>{
  const w=miniTurretCamp(),s=campTurret(w),p=w.pawns[1]!;p.name='<b>Cible</b> & acier';
  Object.assign(s.turret!,{ammoQ:7,targetKey:`pawn:${p.id}`,burst:{targetKey:`pawn:${p.id}`,shotsLeft:1,delayCore:8}});s.power!.on=false;
  const before=JSON.stringify(w),v=miniTurretView(w,s)!;
  expect(v).toMatchObject({shots:1,reserve:1.75,phase:'burst',active:false});expect(v.phaseLabel).toContain('suspendue');
  expect(v.aim).toMatchObject({label:p.name,cell:{x:p.x,z:p.z}});expect(JSON.stringify(w)).toBe(before);
  w.pawns=w.pawns.filter(a=>a.id!==p.id);expect(miniTurretView(w,s)!.burstTarget).toMatchObject({cell:null});
  expect(miniTurretView(w,s)!.burstTarget!.label).toContain('indisponible');
});

test('only the global top changes on a confirmed aim; empty historical scenes allocate no turret batch',()=>{
  const w=miniTurretCamp(),s=campTurret(w),p=w.pawns[1]!;s.turret!.targetKey=`pawn:${p.id}`;
  const bases=miniTurretBaseParts(w),top=miniTurretTopParts(w);expect(bases).toHaveLength(3);expect(top).toHaveLength(MINI_TURRET_TOP_PART_COUNT);
  p.z+=4;expect(miniTurretBaseParts(w)).toEqual(bases);expect(miniTurretTopParts(w)[1]!.ry).not.toBe(top[1]!.ry);
  const layer=new MiniTurretLayer(),set=vi.fn(),group=new Group(),batches={set} as unknown as BoxBatches;
  const empty={...w,structures:[]};expect(layer.update(empty,group,batches)).toBe(false);expect(set).not.toHaveBeenCalled();
  expect(layer.update(w,group,batches)).toBe(true);expect(layer.update(structuredClone(w),group,batches)).toBe(false);expect(set).toHaveBeenCalledTimes(1);
  expect(layer.update(empty,group,batches)).toBe(true);expect(set.mock.calls.at(-1)![2]).toEqual([]);
});

test('phase boundaries publish immediately but a remaining timer alone stays periodic',()=>{
  const w=miniTurretCamp(),s=campTurret(w),capture=new PresentationChanges();capture.capture(w);
  s.turret!.cooldownCore=288;expect(capture.capture(w)).toBe(true);s.turret!.cooldownCore=287;expect(capture.capture(w)).toBe(false);
  s.turret!.ammoQ-=4;expect(capture.capture(w)).toBe(true);s.turret!.holdFire=true;expect(capture.capture(w)).toBe(true);
  s.turret!.cooldownCore=0;expect(capture.capture(w)).toBe(true);
});

test('range and danger are different bounded geometric indications, without a target or World mutation',()=>{
  const w=miniTurretCamp(),center=campTurret(w),before=JSON.stringify(w);
  const range=miniTurretRadiusCells(w,center,28.9),danger=miniTurretRadiusCells(w,center,3.9);
  expect(range.length).toBeGreaterThan(danger.length);expect(range.length).toBeLessThanOrEqual(3481);expect(danger.length).toBeLessThanOrEqual(81);
  expect(range.every(i=>i>=0&&i<w.width*w.height)).toBe(true);expect(JSON.stringify(w)).toBe(before);
  expect(miniTurretTargets(w).get(`pawn:${w.pawns[1]!.id}`)?.cell).toEqual({x:44,z:32});
});

test('a real produced shot retains structure origin and reuses an explicit explosion asset without replay on load',()=>{
  const {world}=producedTurretServiceCheckpoint();expect(world.projectiles?.some(p=>p.weaponItem==='mini-turret-gun')).toBe(true);
  const capture=new AudioCueRecorder();capture.capture(world);expect(capture.drain().some(c=>c.kind==='weapon.gunshot')).toBe(false);
  const wave={id:world.nextId++,sourceId:campTurret(world).id,center:{x:16,z:32},startedAtCore:world.tick*10,advancedAtCore:world.tick*10,cells:[32*world.width+16],nextCell:0,damagedThingKeys:[]};
  world.structures=world.structures.filter(s=>s.id!==wave.sourceId);world.bombWaves=[wave];capture.capture(world);expect(capture.drain()).toContainEqual(expect.objectContaining({id:`bomb:${wave.id}`,kind:'weapon.explosion',x:16,z:32}));
  capture.capture(structuredClone(world));expect(capture.drain().filter(c=>c.kind==='weapon.explosion')).toEqual([]);
  const manifest=parseAudioManifest({version:1,events:{'weapon.impact-barrier':{variants:[{src:'/assets/audio/barrier.mp3',gain:1}],gain:1}}});
  expect(manifest.events['weapon.explosion']?.variants).toEqual(manifest.events['weapon.impact-barrier']?.variants);
});

test('recipe presentation uses steel, a fixed gun and its real prerequisite',()=>{
  expect(placementMaterial('mini-turret','wood')).toBe('steel');expect(buildingLabels['mini-turret']).toBe('Mini-tourelle automatique');
  expect(researchProjects.find(p=>p.id==='gun-turrets')).toMatchObject({cost:500});
  // Schema 340: Core BlowbackOperation sits between Gunsmithing and the turrets.
  expect(researchLinks).toContainEqual(['blowback-operation','gun-turrets']);expect(researchLinks).toContainEqual(['gunsmithing','blowback-operation']);
});
