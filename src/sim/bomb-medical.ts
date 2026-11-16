import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {requireAnimalDeathCapacity256} from './animal-death-explosion-v256.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import { fragmentedApparelProtection } from './apparel-protection.ts';
import { resolveBombImpact,type BombImpactResult } from './bomb-impact.ts';
import { BOMB_AMOUNT,BOMB_AP } from './bomb-state.ts';
import { createMedicalRecord } from './injury-state.ts';
import { healthRandom,reconcilePawnHealth,updatePawnHealth } from './health.ts';
import { advanceAnimalHealth,commitAnimalImpact,delayAnimalImpact,scareAnimal } from './wildlife-health.ts';
import { isManhunterRevengeSchema348,rollManhunterOnHarm348 } from './animal-manhunter-revenge-348.ts';
import { applyBulletStagger } from './stagger.ts';
import { disturbanceEvents,isLying } from './disturbance.ts';
import type { Cell,Pawn,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
const validAmount=(amount:number)=>Number.isFinite(amount)&&amount>=0&&amount<=1000000&&Number.isSafeInteger(amount*1000);
export { damageMechanoidWithBomb } from './mechanoid-impact.ts';

export function damagePawnWithBomb(w:World,p:Pawn,core:number,amount=BOMB_AMOUNT):BombImpactResult|null {
  if(!validAmount(amount))throw new RangeError('Invalid Bomb damage amount');
  if(!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10))throw new RangeError('Invalid Bomb impact clock');
  if(w.schemaVersion<193||!w.pawns.includes(p))throw new Error('Invalid Bomb person owner');
  if(p.state==='dead')return null;
  const lying=isLying(p);updatePawnHealth(w,p);if(p.health?.death)return null;
  const random={rng:w.rng},guard=fragmentedApparelProtection(w,p,BOMB_AP,()=>healthRandom(random));
  const impact=resolveBombImpact(p.health??createMedicalRecord(w.tick),{damage:amount},()=>healthRandom(random),guard.protect);
  guard.commit();w.rng=random.rng;p.health=impact.record;reconcilePawnHealth(w,p,undefined,true);
  if(impact.layers.some(l=>l.severity>0)){if(!impact.record.death)applyBulletStagger(w,p,core,1);disturbanceEvents(w).damage(p,core,lying);}
  return impact;
}
export function damageAnimalWithBomb(w:World,a:WildAnimal,core:number,center:Cell,amount=BOMB_AMOUNT,instigator?:import('./mini-turret-state.ts').BombInstigatorKey):BombImpactResult|null {
  if(!validAmount(amount))throw new RangeError('Invalid Bomb damage amount');
  if(!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10))throw new RangeError('Invalid Bomb impact clock');
  if(w.schemaVersion<193||!w.wildlife?.animals.includes(a))throw new Error('Invalid Bomb animal owner');
  if(a.state==='dead')return null;
  requireAnimalDeathCapacity256(w,a);advanceAnimalHealth(w,a);if(a.health?.death)return null;
  const random={rng:w.rng},record=a.health??createAnimalMedicalRecord256(w,a);
  const impact=resolveBombImpact(record,{damage:amount},()=>healthRandom(random));
  commitAnimalImpact(w,a,impact.record,random,core,instigator);
  // Schema 348: the explosion's instigator may enrage the animal before its flight.
  if(isManhunterRevengeSchema348(w.schemaVersion)){const draw={rng:w.rng};rollManhunterOnHarm348(w,a,instigator,draw,core);w.rng=draw.rng;}
  if(impact.layers.some(l=>l.severity>0)){scareAnimal(w,a,center,core);delayAnimalImpact(a,core);}
  return impact;
}
