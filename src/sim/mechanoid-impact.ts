import {meleeStunCore318} from './stun.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import type { ArmorCategory } from './armor.ts';
import type { ImpactProtection } from './apparel-protection.ts';
import { mechanoidDefinition,type MechanoidKind } from './mechanoid-definition.ts';
import { commitMechanoidImpact,createMechaMedicalRecord } from './mechanoid-health.ts';
import { medicalModel } from './body-model.ts';
import { healthRandom } from './health.ts';
import { resolveUnarmoredBullet,validateUnarmoredBullet,type UnarmoredBullet,type BulletImpactResult } from './bullet-impact.ts';
import { resolveBombImpact,type BombImpactResult } from './bomb-impact.ts';
import { BOMB_AMOUNT,BOMB_AP } from './bomb-state.ts';
import { mergeSlowIntervals,travelEnd } from './travel-timing.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import type { World } from './types.ts';

/** Natural mechanical armor has no garment or durability transaction. */
export function mechanoidProtection(category:ArmorCategory,penetration:number,random:()=>number,kind:MechanoidKind='scyther'):ImpactProtection {
  if(!Number.isFinite(penetration)||penetration<0)throw new RangeError('Invalid mechanical penetration');
  return (_part,amount)=>{
    const draw=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new RangeError('Invalid mechanical armor random');return n;};
    const effective=Math.max(0,mechanoidDefinition(kind).armor[category]-penetration),roll=draw();
    if(roll<effective/2)return {amount:0,converted:false};
    if(roll<effective){const half=amount/2;return {amount:Math.floor(half)+Number(draw()<half%1),converted:category==='sharp'};}
    return {amount,converted:false};
  };
}
const impactRecord=(w:World,m:Mechanoid)=>({...structuredClone(m.health??createMechaMedicalRecord(w.tick,m.mechKind)),tick:w.tick});
function owner(w:World,m:Mechanoid,core:number):void {
  if(w.schemaVersion<194||!w.mechanoids?.includes(m))throw new RangeError('Invalid mechanical impact owner');
  if(!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10))throw new RangeError('Invalid mechanical impact clock');
}
export function damageMechanoidWithBullet(w:World,m:Mechanoid,hit:UnarmoredBullet,core:number,penetration=0):BulletImpactResult|null {
  owner(w,m,core);const record=impactRecord(w,m);validateUnarmoredBullet(hit,medicalModel(record));
  if(m.state==='dead'||record.death||!hit.damage)return null;
  const random={rng:w.rng},draw=()=>healthRandom(random);
  const impact=resolveUnarmoredBullet(record,hit,draw,mechanoidProtection('sharp',penetration,draw,m.mechKind));
  if(impact.selected&&!commitMechanoidImpact(w,m,impact.record,random,core))throw new Error('Mechanical Bullet transaction refused');
  return impact;
}
export function damageMechanoidWithBomb(w:World,m:Mechanoid,core:number,amount=BOMB_AMOUNT):BombImpactResult|null {
  owner(w,m,core);const record=impactRecord(w,m),hit={damage:amount};validateUnarmoredBullet(hit,medicalModel(record));
  if(m.state==='dead'||record.death||!amount)return null;
  const random={rng:w.rng},draw=()=>healthRandom(random);
  const impact=resolveBombImpact(record,hit,draw,mechanoidProtection('sharp',BOMB_AP,draw,m.mechKind));
  if(!commitMechanoidImpact(w,m,impact.record,random,core))throw new Error('Mechanical Bomb transaction refused');
  if(impact.layers.some(l=>l.severity>0))delayMechanoidImpact(w,m,core);
  return impact;
}
/** Preserve the captured edge and elapsed fraction; no biological disturbance. */
export function delayMechanoidImpact(w:World,m:Mechanoid,core:number,stun=false,stoppingPower=1):void {
  owner(w,m,core);if(m.state==='dead'||m.state==='downed')return;
  if(stoppingPower+.001>=1){const previous=m.stagger;m.stagger={sinceCore:previous&&previous.untilCore>=core?previous.sinceCore:core,untilCore:Math.max(previous?.untilCore??0,core+95)};}
  if(stun){const previous=m.stun;m.stun={sinceCore:previous&&previous.untilCore>=core?previous.sinceCore:core,untilCore:Math.max(previous?.untilCore??0,core+meleeStunCore318(w.schemaVersion))};}
  const motion=m.motion;if(!motion||motion.end<=core/10)return;
  const next={...motion};
  if(m.stagger)next.stagger=mergeSlowIntervals([...(motion.stagger??[]),{start:Math.max(motion.start,core/10),end:m.stagger.untilCore/10}]);
  if(m.stun)next.stuns=mergeSlowIntervals([...(motion.stuns??[]),{start:Math.max(motion.start,core/10),end:m.stun.untilCore/10}]);
  next.end=travelEnd(next);m.motion=next;m.moveCooldown=Math.max(0,next.end-(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveLocal297(w):w.tick));
}
