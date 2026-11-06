import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {notifySiteAmbushExplosion263} from './world-site-ambush-state-263.ts';
import {landedStartingPods256,damageStartingPod256} from './starting-pod-damage-256.ts';
import {destroyBridge} from './bridge.ts';
import {actualBombWick256} from './ancient-casket-explosive-state-256.ts';
import { BOMB_AMOUNT,BOMB_RADIUS,bombCellCore,validBombWaveShape,type MiniTurretBombWave } from './bomb-state.ts';
import { SHOT_LAYER,structureShotLayer } from './combat-content.ts';
import { STRUCTURE_DEFINITIONS } from './definitions.ts';
import { isRoomDoor } from './door-rules.ts';
import { damageStructure,damageResource,damagePile,type StructureDamageCause } from './thing-damage.ts';
import { structureMaxHp,resourceMaxHp,pileMaxHp } from './thing-damage-rules.ts';
import { damagePawnWithBomb,damageAnimalWithBomb,damageMechanoidWithBomb } from './bomb-medical.ts';
import { destroyFireFromBomb,applyFlameWaveCell } from './fire.ts';
import { captureBombCells } from './bomb-cells.ts';
import { reconcileTemperature } from './temperature.ts';
import { firePosition } from './fire-rules.ts';
import { captureWorldProjectileTargets } from './projectile-world.ts';
import type { ProjectileScene } from './projectile-rules.ts';
import type { BombInstigatorKey } from './mini-turret-state.ts';
import type { Structure,World } from './types.ts';
import type { WorldProjectile } from './projectile-state.ts';
import { projectileProfile } from './ranged-statistics.ts';
import { applyEmpEffect } from './emp-effects.ts';
import { structureById } from './structure-navigation.ts';

/** Arrival owns the centre; the normal event queue advances this new wave on
 * the next Core substep. No thermal, flame or physical damage is emitted. */
export function startEmpExplosion(w:World,p:WorldProjectile,core:number):boolean {
  if(w.schemaVersion<208||p.weaponItem!=='emp-launcher'||!w.projectiles?.includes(p)||p.arrival?.kind!=='impact'
    ||p.advancedAtCore!==core||!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10)
    ||!Number.isSafeInteger(w.nextId+1)||(w.bombWaves?.length??0)>=w.width*w.height
    ||w.bombWaves?.some(wave=>wave.emp&&wave.sourceId===p.id))return false;
  const center={x:Math.floor(p.arrival.point.x),z:Math.floor(p.arrival.point.z)};
  if(center.x<0||center.z<0||center.x>=w.width||center.z>=w.height)return false;
  const wave:MiniTurretBombWave={id:w.nextId,sourceId:p.id,instigatorKey:p.flight.launcherKey as BombInstigatorKey,center,
    startedAtCore:core,advancedAtCore:core,cells:captureBombCells(w,center,1.1,true),nextCell:0,damagedThingKeys:[],emp:{quality:p.quality}};
  if(!validBombWaveShape(wave,w.schemaVersion))return false;
  w.nextId++;(w.bombWaves??=[]).push(wave);return true;
}

/** Prepare both geometries and the thermal result before reserving any ID.
 * The caller commits its battery drain/report only after this returns true.
 * Emission owns no fire/combat draw; seed records the incident's private draw. */
export function startShortCircuitDischarge(w:World,conduit:Structure,flameRadius:number,bombRadius:number|undefined,seed:number):boolean {
  const count=bombRadius===undefined?1:2,core=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10;
  if(w.schemaVersion<201||conduit.kind!=='power-conduit'||!w.structures.includes(conduit)
    ||!Number.isSafeInteger(conduit.id)||conduit.id<1||conduit.id>=w.nextId
    ||!Number.isSafeInteger(conduit.x)||!Number.isSafeInteger(conduit.z)||conduit.x<0||conduit.z<0||conduit.x>=w.width||conduit.z>=w.height
    ||!Number.isFinite(flameRadius)||flameRadius<1.5||flameRadius>14.9
    ||(flameRadius>3.5?bombRadius!==flameRadius*.3:bombRadius!==undefined)
    ||!Number.isSafeInteger(seed)||seed<1||seed>0xffffffff||!Number.isSafeInteger(w.nextId+count)
    ||!Number.isSafeInteger(core)||core<0||!Number.isSafeInteger(core+22)
    ||(w.bombWaves?.length??0)+count>w.width*w.height)return false;
  const center={x:conduit.x,z:conduit.z};
  const prepare=(damage:'flame'|'bomb',radius:number,id:number):MiniTurretBombWave=>({id,sourceId:conduit.id,center:{...center},
    startedAtCore:core,advancedAtCore:core,cells:captureBombCells(w,center,radius,true),nextCell:0,damagedThingKeys:[],shortCircuit:{damage,radius,seed}});
  const waves=[prepare('flame',flameRadius,w.nextId)];
  if(bombRadius!==undefined)waves.push(prepare('bomb',bombRadius,w.nextId+1));
  if(waves.some(wave=>!validBombWaveShape(wave,w.schemaVersion)))return false;
  const draft={...w,...w.thermal?{thermal:structuredClone(w.thermal)}:{}},layout=reconcileTemperature(draft);
  const region=draft.thermal?.regions[layout.indices[center.z*w.width+center.x]!];
  if(region)for(const wave of waves){region.temperature=Math.min(1000,region.temperature+(wave.shortCircuit!.damage==='flame'?15:5)*wave.cells.length/region.cells.length);if(!Number.isFinite(region.temperature))return false;}
  w.nextId+=count;w.bombWaves=[...(w.bombWaves??[]),...waves].sort((a,b)=>a.id-b.id);
  if(draft.thermal)w.thermal=draft.thermal;else delete w.thermal;
  return true;
}

export function applyStructureExternalDamage(w:World,s:Structure,rawAmount:number,appliedAmount:number,cause:StructureDamageCause,rng=w.rng,core=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10,instigatorKey?:BombInstigatorKey):boolean {
  if(!Number.isFinite(rawAmount)||rawAmount<0||!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10))return false;
  return damageStructure(w,s,appliedAmount,cause,rng,{core,rawAmount,...instigatorKey?{instigatorKey}:{}});
}
/** Called in the source's global-ID owner slot. No recursive wave draining. */
export function advanceBombWick(w:World,s:Structure,core:number):boolean {
  const wick=actualBombWick256(s);if(!wick||!w.structures.includes(s)||wick.endCore>core)return false;
  if(!damageStructure(w,s,structureMaxHp(s)-(s.damage??0),'bomb',w.rng,{core,rawAmount:0,detonate:true,...wick.instigatorKey?{instigatorKey:wick.instigatorKey}:{}}))throw new RangeError('Cannot commit Bomb detonation');
  return true;
}
export function advanceBombWicks(w:World,core:number):boolean {
  let changed=false;for(const s of [...w.structures].sort((a,b)=>a.id-b.id))if(advanceBombWick(w,s,core))changed=true;return changed;
}
const idOf=(key:string)=>Number(key.slice(key.indexOf(':')+1));
function layer(w:World,key:string,shortCircuit=false):number {
  if(key.startsWith('pawn:')||key.startsWith('animal:')||key.startsWith('mech:'))return SHOT_LAYER.pawn;
  if(key.startsWith('pile:')||key.startsWith('packed:')||key.startsWith('starting-pod:'))return SHOT_LAYER.item;
  if(key.startsWith('structure:')){const s=w.structures.find(s=>s.id===idOf(key));return shortCircuit&&s?.kind==='power-conduit'?5:s?structureShotLayer(s.kind):SHOT_LAYER.building;}
  if(key.startsWith('resource:'))return w.resources.find(r=>r.id===idOf(key))?.kind==='tree'?SHOT_LAYER.building:SHOT_LAYER.lowPlant;
  return SHOT_LAYER.building;
}
/** Definition passability stays impassable even while an ordinary door is open. */
export const bombBuildingFactor=(s:Structure)=>isRoomDoor(s.kind)||STRUCTURE_DEFINITIONS[s.kind].blocksMovement?4:2;
/** A wave borrows the common scene until the next mutation. Every cell captures
 * its Things before damage; new salvage is not a second target in that cell. */
export function advanceBombWave(w:World,wave:MiniTurretBombWave,core:number,readScene?:()=>ProjectileScene,afterImpact?:()=>void):boolean {
  if(wave.nextCell===wave.cells.length||wave.advancedAtCore>=core)return false;
  if(wave.advancedAtCore!==core-1)throw new Error('Stale Bomb wave clock');
  let local:ProjectileScene|undefined;const scene=()=>readScene?.()??(local??=captureWorldProjectileTargets(w).scene(new Set(),1));
  const affected=new Set(wave.damagedThingKeys);let changed=false;
  const invalidate=()=>{changed=true;local=undefined;afterImpact?.();};
  while(wave.nextCell<wave.cells.length&&bombCellCore(w,wave,wave.cells[wave.nextCell]!)<=core){
    const index=wave.cells[wave.nextCell]!,cell={x:index%w.width,z:Math.floor(index/w.width)},snapshot=[...scene().at(cell)];
    notifySiteAmbushExplosion263(w,cell,core);
    const altitude=(key:string)=>layer(w,key,!!wave.shortCircuit||!!wave.animalDeath||!!wave.casketExplosion);
    const full=snapshot.reduce((max,t)=>t.fill>.99?Math.max(max,altitude(t.key)):max,-Infinity);
    if(wave.emp){
      const amount=projectileProfile('emp-launcher',wave.emp.quality)!.damage;
      for(const t of snapshot){
        if(affected.has(t.key)||altitude(t.key)<full)continue;
        const id=idOf(t.key),target=t.key.startsWith('mech:')?w.mechanoids?.find(m=>m.id===id)
          :t.key.startsWith('structure:')?structureById(w,id):undefined;
        if(target&&applyEmpEffect(w,target,amount,core)){affected.add(t.key);invalidate();}
      }
      wave.nextCell++;continue;
    }
    if(wave.shortCircuit?.damage==='flame'||wave.animalDeath||wave.casketExplosion) {
      const ignored=new Set(wave.casketExplosion?.ignoredThingKeys??[]);
      const allowed=new Set(snapshot.filter(t=>altitude(t.key)>=full&&!ignored.has(t.key)).map(t=>t.key.startsWith('packed:')?`structure:${idOf(t.key)}`:t.key));
      if(applyFlameWaveCell(w,cell,core,affected,allowed,wave.casketExplosion?wave.instigatorKey:undefined))invalidate();
      wave.nextCell++;continue;
    }
    const fireIds=(w.fires?.items??[]).filter(f=>{const p=firePosition(w,f);return p?.x===cell.x&&p.z===cell.z;}).map(f=>f.id);
    for(const t of snapshot){
      const key=t.key.startsWith('packed:')?`structure:${idOf(t.key)}`:t.key;
      if(affected.has(key)||altitude(t.key)<full)continue;
      const id=idOf(t.key);let attempted=false;
      if(t.key.startsWith('pawn:')){const p=w.pawns.find(p=>p.id===id);if(p&&p.state!=='dead'){damagePawnWithBomb(w,p,core);attempted=true;}}
      else if(t.key.startsWith('animal:')){const a=w.wildlife?.animals.find(a=>a.id===id);if(a&&a.state!=='dead'){damageAnimalWithBomb(w,a,core,wave.center,undefined,wave.instigatorKey);attempted=true;}}
      else if(t.key.startsWith('mech:')){const m=w.mechanoids?.find(m=>m.id===id);if(m&&m.state!=='dead'){damageMechanoidWithBomb(w,m,core);attempted=true;}}
      else if(t.key.startsWith('structure:')||t.key.startsWith('packed:')){
        const packed=t.key.startsWith('packed:')?w.packed.find(p=>p.building.id===id&&p.owner.type==='ground'):undefined;
        const s=packed?.building??(t.key.startsWith('structure:')?structureById(w,id):undefined);
        if(s&&structureMaxHp(s)>0){if(!applyStructureExternalDamage(w,s,BOMB_AMOUNT,BOMB_AMOUNT*(packed?1:bombBuildingFactor(s)),'bomb',w.rng,core,wave.instigatorKey))throw new RangeError('Cannot commit Bomb structure impact');attempted=true;}
      }else if(t.key.startsWith('starting-pod:')){
        const p=landedStartingPods256(w).find(p=>p.id===id);if(p){if(!damageStartingPod256(w,p,BOMB_AMOUNT,core))throw new RangeError('Cannot commit Bomb active transporter impact');attempted=true;}
      }else if(t.key.startsWith('resource:')){
        const r=w.resources.find(r=>r.id===id);if(r&&r.kind!=='rock'&&resourceMaxHp(r)>0){if(!damageResource(w,r,BOMB_AMOUNT*4,'bomb'))throw new RangeError('Cannot commit Bomb plant impact');attempted=true;}
      }else if(t.key.startsWith('pile:')){
        const p=w.piles.find(p=>p.id===id&&p.owner.type==='ground');if(p&&pileMaxHp(p,w.schemaVersion)>0){if(!damagePile(w,p,BOMB_AMOUNT*(p.kind==='corpse'||p.kind==='mech-corpse'?.5:1),'bomb'))throw new RangeError('Cannot commit Bomb pile impact');attempted=true;}
      }
      if(attempted){affected.add(key);invalidate();}
    }
    if(w.tiles[index]?.bridge&&BOMB_AMOUNT>=35){if(!destroyBridge(w,cell,'bomb',BOMB_AMOUNT))throw new RangeError('Cannot retire Bomb-hit bridge support');invalidate();}
    for(const id of fireIds)if(!affected.has(`fire:${id}`)&&destroyFireFromBomb(w,id)){affected.add(`fire:${id}`);invalidate();}
    wave.nextCell++;
  }
  wave.advancedAtCore=core;wave.damagedThingKeys=[...affected].sort();return changed;
}
export { BOMB_RADIUS };
