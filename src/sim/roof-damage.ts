import {incomingDamageFactor361} from './traits.ts';
import {medicalModel} from './body-model.ts';
import { apparelProtection } from './apparel-protection.ts';
import { disturbanceEvents,isLying } from './disturbance.ts';
import { BODY_COVERAGE,HUMAN_BODY } from './body-definition.ts';
import { HP_UNIT,medicalPartInjuryRule } from './injury-rules.ts';
import { createMedicalRecord,partMissing,remainingPartHealth,addResolvedInjuryBatch } from './injury-state.ts';
import { healthRandom,reconcilePawnHealth,updatePawnHealth } from './health.ts';
import type { World } from './types.ts';

/** Constructed roof only. Thin-roof Crush targets top/outside parts; it is not
 * Blunt's internal-hit worker and not mountain-roof destruction. */
export function damageFromRoofCollapse(world:World,cells:ReadonlySet<number>):void {
  const disturbance=disturbanceEvents(world);
  for(const pawn of world.pawns) {
    if(pawn.state==='dead'||!cells.has(pawn.z*world.width+pawn.x))continue;
    if(!pawn.health||pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
    if(pawn.health?.death)continue;
    const health=structuredClone(pawn.health??createMedicalRecord(world.tick)),randomState={rng:world.rng};
    const parts=HUMAN_BODY.flatMap((part,index)=>part.height==='top'&&part.depth==='outside'&&!part.conceptual&&!partMissing(health,part.id)&&BODY_COVERAGE[index]!>0?[{part,weight:BODY_COVERAGE[index]!}]:[]);
    if(!parts.length)continue;
    let amount=(15+Math.floor(healthRandom(randomState)*16))*HP_UNIT;
    let roll=healthRandom(randomState)*parts.reduce((n,p)=>n+p.weight,0),part=parts.at(-1)!.part;
    for(const candidate of parts){roll-=candidate.weight;if(roll<0){part=candidate.part;break;}}
    const protection=apparelProtection(world,pawn,'blunt',0,()=>healthRandom(randomState));
    amount=(protection.protect?.(part.id,amount/HP_UNIT).amount??amount/HP_UNIT)*HP_UNIT;
    {const tough=incomingDamageFactor361(pawn);if(tough!==1)amount=Math.round(amount*tough);}
    const hp=remainingPartHealth(health,part.id);
    if(amount>=hp) {
      const excess=(amount-hp)/(medicalModel(health).byId[part.id].hp*HP_UNIT),chance=Math.max(0,Math.min(1,(excess-.4)/.6));
      if(healthRandom(randomState)>=chance)amount=Math.max(0,hp-HP_UNIT);
    }
    const traits=medicalPartInjuryRule(health,part.id);
    const wasLying=isLying(pawn);
    if(amount>0)addResolvedInjuryBatch(health,[{part:part.id,kind:traits.solid?'crack':traits.skin?'cut':'crush',severity:amount}],()=>healthRandom(randomState));
    protection.commit();world.rng=randomState.rng;pawn.health=health;reconcilePawnHealth(world,pawn,undefined,true);
    if(amount>0)disturbance.damage(pawn,world.tick*10,wasLying);
  }
}
