import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {registerWorldProjectile297} from './register-projectile-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {landedStartingPods256,damageStartingPod256} from './starting-pod-damage-256.ts';
import { damageAnimalWithBullet } from './wildlife-health.ts';
import { animalImpactNoise } from './wildlife-noise.ts';
import { damageBarrier,isBarrier } from './barriers.ts';
import { disturbanceEvents,isLying } from './disturbance.ts';
import { advanceBulletFlight,type BulletFlight } from './bullet-flight.ts';
import { captureProjectileBatch } from './projectile-batch.ts';
import { validWorldProjectile } from './projectile-save.ts';
import { CORE_TICKS_PER_LOCAL,projectileProfile,type ProjectileProfileId } from './ranged-statistics.ts';
import { damageUnarmoredPawnWithBullet } from './bullet-damage.ts';
import { arrowHit326 } from './bows-326.ts';
import { healthRandom } from './health.ts';
import type { ProjectileScene } from './projectile-rules.ts';
import type { ProjectileRelations,WorldProjectile } from './projectile-state.ts';
import type { WeaponQuality } from './equipment-rules.ts';
import type { World } from './types.ts';
import { applyBulletStagger } from './stagger.ts';
import { advanceBombWave,applyStructureExternalDamage,startEmpExplosion } from './bomb-system.ts';
import { damageResource,damagePile } from './thing-damage.ts';
import { pileMaxHp,resourceMaxHp,structureMaxHp } from './thing-damage-rules.ts';
import type { BombInstigatorKey } from './mini-turret-state.ts';
import { damageMechanoidWithBullet,delayMechanoidImpact } from './mechanoid-impact.ts';

/** Commit a producer's validated emission and its private PRNG together.
 * Internal boundary, not a player command or a replacement for aiming/cadence. */
export function registerWorldProjectile(world:World,flight:BulletFlight,quality:WeaponQuality,relations:ProjectileRelations,rng=world.rng,at=world.tick*CORE_TICKS_PER_LOCAL,weaponItem:ProjectileProfileId='revolver'):WorldProjectile {
  if(isCorePhysicalSchema297(Number(world.schemaVersion)))return registerWorldProjectile297(world,flight,quality,relations,rng,arguments[5]===undefined?effectiveCore297(world):at,weaponItem);
  if(world.schemaVersion<55||!Number.isSafeInteger(world.nextId+1)||!Number.isSafeInteger(rng)||rng<1||rng>0xffffffff||world.projectiles&&world.projectiles.length>=world.width*world.height)throw new RangeError('Cannot register projectile');
  if(!Number.isSafeInteger(at)||at<Math.max(0,(world.tick-1)*CORE_TICKS_PER_LOCAL)||at>world.tick*CORE_TICKS_PER_LOCAL)throw new RangeError('Invalid emission time');
  if(weaponItem==='mini-turret-gun'&&!world.structures.some(s=>s.kind==='mini-turret'&&s.turret&&flight.launcherKey===`structure:${s.id}`&&s.id<world.nextId))throw new RangeError('Invalid intrinsic emission owner');
  if((weaponItem==='lancer-gun'||weaponItem==='pikeman-gun')&&(world.schemaVersion<197||quality!=='normal'||flight.equipmentKey!==null
    ||!world.mechanoids?.some(m=>m.mechKind===(weaponItem==='lancer-gun'?'lancer':'pikeman')&&m.state!=='dead'&&!m.health?.death
      &&flight.launcherKey===`mech:${m.id}`&&m.id<world.nextId)))throw new RangeError('Invalid mechanical emission owner');
  const projectile:WorldProjectile={id:world.nextId,quality,...weaponItem!=='revolver'?{weaponItem}:{},emittedAtCore:at,advancedAtCore:at,flight:{...flight,origin:{...flight.origin},destination:{...flight.destination}},relations:{friendlyPawnIds:[...new Set(relations.friendlyPawnIds)].sort((a,b)=>a-b),friendlyFireFactor:relations.friendlyFireFactor,
    ...relations.friendlyTargetKeys!==undefined?{friendlyTargetKeys:[...new Set(relations.friendlyTargetKeys)].sort()}:{}},arrival:null};
  if(projectile.flight.completed||!validWorldProjectile(projectile,{...world,tick:at/CORE_TICKS_PER_LOCAL},world.schemaVersion))throw new RangeError('Invalid projectile emission');
  world.nextId++;world.rng=rng;(world.projectiles??=[]).push(projectile);return projectile;
}

/** Run after doors/environment, before civilian actions. Core substep FIRST,
 * then persistent ID: a closer/lower-ID impact may change the next projectile's
 * admissible targets. Never finish each projectile's whole flight in sequence. */
export function advanceWorldProjectiles(world:World,beforeCore?:(core:number)=>boolean|void,afterImpact?:()=>void,disturbance=disturbanceEvents(world)):void {
  if(!world.projectiles&&!world.bombWaves&&!beforeCore)return;
  const end=world.tick*CORE_TICKS_PER_LOCAL,start=end-CORE_TICKS_PER_LOCAL;
  if(world.projectiles)world.projectiles=world.projectiles.filter(p=>!p.arrival||p.advancedAtCore>start);
  if(!world.projectiles?.length)delete world.projectiles;
  if(world.bombWaves)world.bombWaves=world.bombWaves.filter(wave=>wave.nextCell<wave.cells.length||wave.advancedAtCore>start);
  if(!world.bombWaves?.length)delete world.bombWaves;
  if(!world.projectiles&&!world.bombWaves&&!beforeCore)return;
  let batch:ReturnType<typeof captureProjectileBatch>|undefined;
  let targets:ReturnType<ReturnType<typeof captureProjectileBatch>['refresh']>|undefined;
  const scenes=new Map<WorldProjectile,ProjectileScene>();
  let neutral:ProjectileScene|undefined;
  const refresh=()=>{targets=undefined;scenes.clear();neutral=undefined;};
  const impact=()=>{if(batch&&(fixedStructures!==world.structures||fixedResources!==world.resources))batch=undefined;fixedStructures=world.structures;fixedResources=world.resources;refresh();afterImpact?.();};
  let fixedStructures=world.structures,fixedResources=world.resources;
  const neutralScene=()=>{batch??=captureProjectileBatch(world);targets??=batch.refresh(world);return neutral??=targets(new Set(),1);};
  const scene=(p:WorldProjectile)=>{
    let s=scenes.get(p);if(!s){batch??=captureProjectileBatch(world);targets??=batch.refresh(world);s=targets(new Set(p.relations.friendlyPawnIds),p.relations.friendlyFireFactor,new Set(p.relations.friendlyTargetKeys??[]));scenes.set(p,s);}return s;
  };
  for(let core=start+1;core<=end;core++) {
    if(beforeCore?.(core)){if(fixedStructures!==world.structures||fixedResources!==world.resources)batch=undefined;fixedStructures=world.structures;fixedResources=world.resources;refresh();}
    const events=[...(world.projectiles??[]),...(world.bombWaves??[])].sort((a,b)=>a.id-b.id);
    for(const event of events) {
    if('cells' in event){advanceBombWave(world,event,core,neutralScene,impact);continue;}
    const p=event;
    if(p.arrival||p.advancedAtCore>=core)continue;
    if(p.advancedAtCore!==core-1)throw new Error('Stale projectile clock');
    const randomState={rng:world.rng},next=advanceBulletFlight(p.flight,scene(p),()=>healthRandom(randomState),1);
    p.flight=next.flight;p.advancedAtCore=core;world.rng=randomState.rng;
    const a=next.arrival;if(!a)continue;
    const profile=projectileProfile(p.weaponItem??'revolver',p.quality)!;
    const pawn=a.targetKey?.startsWith('pawn:')?world.pawns.find(pawn=>`pawn:${pawn.id}`===a.targetKey):undefined;
    const animal=a.targetKey?.startsWith('animal:')?world.wildlife?.animals.find(a=>`animal:${a.id}`===next.arrival?.targetKey):undefined;
    const mech=world.schemaVersion>=194&&a.targetKey?.startsWith('mech:')?world.mechanoids?.find(m=>`mech:${m.id}`===a.targetKey):undefined;
    const barrier=a.targetKey?.startsWith('structure:')?world.structures.find(s=>`structure:${s.id}`===a.targetKey&&isBarrier(s)):undefined;
    const structure=world.schemaVersion>=193&&a.targetKey?.startsWith('structure:')?world.structures.find(s=>`structure:${s.id}`===a.targetKey&&structureMaxHp(s)>0):undefined;
    const packed=world.schemaVersion>=193&&a.targetKey?.startsWith('packed:')?world.packed.find(pack=>`packed:${pack.building.id}`===a.targetKey&&pack.owner.type==='ground'&&structureMaxHp(pack.building)>0):undefined;
    const pile=world.schemaVersion>=193&&a.targetKey?.startsWith('pile:')?world.piles.find(pile=>`pile:${pile.id}`===a.targetKey&&pile.owner.type==='ground'&&pileMaxHp(pile,world.schemaVersion)>0):undefined;
    const resource=world.schemaVersion>=193&&a.targetKey?.startsWith('resource:')?world.resources.find(r=>`resource:${r.id}`===a.targetKey&&r.kind!=='rock'&&resourceMaxHp(r)>0):undefined;
    const pod=a.targetKey?.startsWith('starting-pod:')?landedStartingPods256(world).find(p=>`starting-pod:${p.id}`===a.targetKey):undefined;
    p.arrival={...a,effect:a.kind==='exit'?'exit':pawn?'pawn':animal?'animal':mech?'mech':barrier?'barrier':structure?'structure':packed?'packed':pile?'pile':resource?'resource':pod?'starting-pod':a.targetKey?'unsupported-object':'ground'};
    const wasLying=!!pawn&&isLying(pawn);
    if(a.kind!=='exit'&&disturbance.impact({x:Math.floor(a.point.x),z:Math.floor(a.point.z)},core))impact();
    if(a.kind!=='exit'&&animalImpactNoise(world,{x:Math.floor(a.point.x),z:Math.floor(a.point.z)},p.flight.launcherKey,core))impact();
    if(p.weaponItem==='emp-launcher'){
      if(a.kind!=='exit'){if(!startEmpExplosion(world,p,core))throw new RangeError('Cannot commit EMP impact');impact();}
      continue;
    }
    if(pod){if(!damageStartingPod256(world,pod,profile.damage,core))throw new RangeError('Cannot commit Bullet active transporter impact');impact();}
    if(animal){
      const launcher=world.pawns.find(pawn=>`pawn:${pawn.id}`===p.flight.launcherKey);
      damageAnimalWithBullet(world,animal,{damage:profile.damage,...arrowHit326(p.weaponItem),stoppingPower:profile.stoppingPower,armorPenetration:profile.armorPenetration},core,launcher,launcher?.id);
      impact();
    }
    if(mech){damageMechanoidWithBullet(world,mech,{damage:profile.damage,...arrowHit326(p.weaponItem)},core,profile.armorPenetration);delayMechanoidImpact(world,mech,core,false,profile.stoppingPower);impact();}
    if(structure||packed){
      if(!applyStructureExternalDamage(world,(structure??packed?.building)!,profile.damage,profile.damage,'bullet',world.rng,core,p.flight.launcherKey as BombInstigatorKey))throw new RangeError('Cannot commit Bullet structure impact');impact();
    }else if(barrier){
      damageBarrier(world,barrier,profile.damage);impact();
    }
    if(pile){if(!damagePile(world,pile,profile.damage,'bullet'))throw new RangeError('Cannot commit Bullet pile impact');impact();}
    if(resource){if(!damageResource(world,resource,profile.damage,'bullet'))throw new RangeError('Cannot commit Bullet plant impact');impact();}
    if(pawn) {
      const result=damageUnarmoredPawnWithBullet(world,pawn,{damage:profile.damage,...arrowHit326(p.weaponItem)},profile.armorPenetration);
      applyBulletStagger(world,pawn,core,profile.stoppingPower);
      if(result?.layers.some(l=>l.severity>0))disturbance.damage(pawn,core,wasLying);
      // A fall can change posture, release a carried patient and drop objects.
      // Do not reuse a capture across the medical reconciliation.
      impact();
    }
  }}
}
