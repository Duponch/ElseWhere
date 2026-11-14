import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {landedStartingPods256,damageStartingPod256} from './starting-pod-damage-256.ts';
import { damageAnimalWithBullet } from './wildlife-health.ts';
import { animalImpactNoise } from './wildlife-noise.ts';
import { damageBarrier,isBarrier } from './barriers.ts';
import { disturbanceEvents,isLying } from './disturbance.ts';
import { advanceBulletFlight } from './bullet-flight.ts';
import {captureCoreProjectileBatch297 as captureProjectileBatch} from './core-projectile-batch-297.ts';
import { projectileProfile } from './ranged-statistics.ts';
import { damageUnarmoredPawnWithBullet } from './bullet-damage.ts';
import { arrowHit326 } from './bows-326.ts';
import { healthRandom } from './health.ts';
import type { ProjectileScene } from './projectile-rules.ts';
import type { WorldProjectile } from './projectile-state.ts';
import type { World } from './types.ts';
import { applyBulletStagger } from './stagger.ts';
import { advanceBombWave,applyStructureExternalDamage,startEmpExplosion } from './bomb-system.ts';
import { damageResource,damagePile } from './thing-damage.ts';
import { pileMaxHp,resourceMaxHp,structureMaxHp } from './thing-damage-rules.ts';
import type {LivingTargetKey} from './combat-target.ts';
import type { BombInstigatorKey } from './mini-turret-state.ts';
import { damageMechanoidWithBullet,delayMechanoidImpact } from './mechanoid-impact.ts';

import {effectiveCore297} from './core-phase-297.ts';

export interface CoreProjectileTrace297 {
  id:number; emittedAtCore:number; endCore:number; durationCore:number; delayCore:number;
  from:{x:number;z:number}; to:{x:number;z:number}; emp:boolean;
}
export interface CoreShotAudio297 {
  projectileId:number;pawnId?:number;atCore:number;x:number;z:number;
}
export interface CoreProjectileEvents297 {
  upserted:CoreProjectileTrace297[];
  /** SIM retention only. This does not revoke already confirmed presentation history. */
  removed:number[];
}
export function coreProjectileTrace297(p:WorldProjectile):CoreProjectileTrace297 {
  const durationCore=Math.max(.001,Math.hypot(p.flight.destination.x-p.flight.origin.x,p.flight.destination.z-p.flight.origin.z)/p.flight.speedPerCoreTick);
  const total=Math.ceil(durationCore);
  return {id:p.id,emittedAtCore:p.emittedAtCore,endCore:p.arrival?p.advancedAtCore:p.emittedAtCore+total,
    durationCore,delayCore:total-durationCore,from:{...p.flight.origin},to:{...p.flight.destination},emp:p.weaponItem==='emp-launcher'};
}
/** Private synchronous owner. Caller invalidates after every actual movement,
 * macro/command mutation and impact. No per-Core wire copy of flight/relations. */
export function createCoreProjectileStepper297(world:World) {
  if(!isCorePhysicalSchema297(Number(world.schemaVersion)))throw new RangeError('Core297 projectile owner requires schema297');
  let lastCore=effectiveCore297(world),lastPruneStart=Math.floor((lastCore-1)/10)*10;
  let batch:ReturnType<typeof captureProjectileBatch>|undefined;
  let targets:ReturnType<ReturnType<typeof captureProjectileBatch>['refresh']>|undefined;
  const scenes=new Map<WorldProjectile,ProjectileScene>();
  const relations=new WeakMap<WorldProjectile,{friends:ReadonlySet<number>;keys:ReadonlySet<LivingTargetKey>}>();
  const ownedRelations=(p:WorldProjectile)=>{let r=relations.get(p);if(!r){r={friends:new Set(p.relations.friendlyPawnIds),keys:new Set(p.relations.friendlyTargetKeys??[])};relations.set(p,r);}return r;};
  let neutral:ProjectileScene|undefined;
  let fixedStructures=world.structures,fixedResources=world.resources;
  const invalidate=()=>{batch=undefined;targets=undefined;scenes.clear();neutral=undefined;fixedStructures=world.structures;fixedResources=world.resources;};
  const refresh=()=>{targets=undefined;scenes.clear();neutral=undefined;};
  const neutralScene=()=>{batch??=captureProjectileBatch(world);targets??=batch.refresh(world);return neutral??=targets(new Set(),1);};
  const scene=(p:WorldProjectile)=>{
    let s=scenes.get(p);if(!s){batch??=captureProjectileBatch(world);targets??=batch.refresh(world);const r=ownedRelations(p);s=targets(r.friends,p.relations.friendlyFireFactor,r.keys);scenes.set(p,s);}return s;
  };
  return {invalidate,advance(core:number,beforeCore?:(core:number)=>boolean|void,afterImpact?:()=>void,disturbance=disturbanceEvents(world)) {
    if(!Number.isSafeInteger(core)||core!==lastCore+1||core!==effectiveCore297(world)||!isCorePhysicalSchema297(Number(world.schemaVersion)))throw new RangeError('Invalid next physical projectile Core');
    const removed:number[]=[],upserted:CoreProjectileTrace297[]=[],shotAudio297:CoreShotAudio297[]=[];let requiresFull=false;
    const windowStart=Math.floor((core-1)/10)*10;
    if(windowStart!==lastPruneStart&&world.projectiles){const kept=world.projectiles.filter(p=>{const keep=!p.arrival||p.advancedAtCore>windowStart;if(!keep){removed.push(p.id);scenes.delete(p);}return keep;});
      if(kept.length!==world.projectiles.length){if(kept.length)world.projectiles=kept;else delete world.projectiles;}}
    if(windowStart!==lastPruneStart&&world.bombWaves){const kept=world.bombWaves.filter(w=>w.nextCell<w.cells.length||w.advancedAtCore>windowStart);
      if(kept.length!==world.bombWaves.length){requiresFull=true;if(kept.length)world.bombWaves=kept;else delete world.bombWaves;}}
    lastPruneStart=windowStart;
    const impact=()=>{requiresFull=true;if(batch&&(fixedStructures!==world.structures||fixedResources!==world.resources))batch=undefined;
      fixedStructures=world.structures;fixedResources=world.resources;refresh();afterImpact?.();};
    if(beforeCore?.(core)){if(fixedStructures!==world.structures||fixedResources!==world.resources)batch=undefined;
      fixedStructures=world.structures;fixedResources=world.resources;refresh();}
    const events=[...(world.projectiles??[]),...(world.bombWaves??[])].sort((a,b)=>a.id-b.id);
    for(const event of events) {
    if('cells' in event){const before=event.advancedAtCore;advanceBombWave(world,event,core,neutralScene,impact);if(event.advancedAtCore!==before)requiresFull=true;continue;}
    const p=event;
    if(p.emittedAtCore===core){
      upserted.push(coreProjectileTrace297(p));
      const launcher=p.flight.launcherKey,pawnId=launcher?.startsWith('pawn:')?Number(launcher.slice(5)):undefined;
      const caster=pawnId===undefined?undefined:world.pawns.find(a=>a.id===pawnId);
      shotAudio297.push({projectileId:p.id,...pawnId!==undefined?{pawnId}:{},atCore:core,
        x:caster?caster.x+.5:p.flight.origin.x,z:caster?caster.z+.5:p.flight.origin.z});
    }
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
    upserted.push(coreProjectileTrace297(p));
    requiresFull=true; // Every real impact may wake actors or alter clinical/ownership domains.
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

    }
    lastCore=core;
    return {projectileEvents:{upserted,removed} satisfies CoreProjectileEvents297,shotAudio297,requiresFull};
  }};
}
