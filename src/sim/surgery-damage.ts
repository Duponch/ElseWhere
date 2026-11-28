import {medicalModel} from './body-model.ts';
import { BODY_PARTS,HUMAN_BODY,BODY_INDEX,BODY_COVERAGE,type BodyPartId } from './body-definition.ts';
import { HP_UNIT,medicalPartInjuryRule,type InjuryKind } from './injury-rules.ts';
import { addResolvedInjuryBatch,partMissing,remainingPartHealth,type ResolvedInjury } from './injury-state.ts';
import type { MedicalRecord,MedicalRandom } from './injury-types.ts';
import { curve } from './melee-statistics.ts';

export type SurgeryDamageKind='cut'|'scratch'|'stab'|'crush';
export interface SurgeryDamageHit {part:BodyPartId;damage:number;kind:SurgeryDamageKind;layers:ResolvedInjury[]}
export function checkedSurgeryRandom(random:MedicalRandom):number {
  const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('Invalid surgery random');return value;
}
const ancestry=(part:BodyPartId):BodyPartId[]=>{
  const result:BodyPartId[]=[];
  for(let id:BodyPartId|null=part;id!==null;id=BODY_PARTS[id].parent){result.push(id);if(BODY_PARTS[id].depth==='outside')break;}
  return result;
};
const neighbours=(part:BodyPartId):BodyPartId[]=>{
  const parent=BODY_PARTS[part].parent;
  return [...new Set(HUMAN_BODY.filter(p=>p.parent===part||p.id===parent||parent&&BODY_PARTS[parent].parent&&p.parent===parent).map(p=>p.id))].filter(id=>id!==part);
};
/** Core damage workers with an explicit anatomical target (including inside).
 * This is not a melee swing: no forced internal selection, stun, armor, or XP.
 * Clinical scar/exposure rolls still use the common injury kernel. Mutates only
 * the caller's private outcome record; its original World is never consulted. */
export function applySurgeryDamage(record:MedicalRecord,part:BodyPartId,damage:number,kind:SurgeryDamageKind,random:MedicalRandom,nativeScratch382=false):SurgeryDamageHit {
  if(record.body||!BODY_PARTS[part]||BODY_PARTS[part].conceptual||!Number.isFinite(damage)||damage<0||damage>1000000||!['cut','scratch','stab','crush'].includes(kind))throw new RangeError('Invalid surgery impact');
  const hit:SurgeryDamageHit={part,damage,kind,layers:[]};
  if(record.death||!damage||partMissing(record,part))return hit;
  const draw=()=>checkedSurgeryRandom(random);
  const add=(id:BodyPartId,amount:number)=>{
    if(record.death||partMissing(record,id))return;
    const severity=Math.round(amount*HP_UNIT);if(!severity)return;
    const traits=medicalPartInjuryRule(record,id);
    const clinical:InjuryKind=traits.solid?'crack':kind==='crush'?(traits.skin?'cut':'crush'):kind==='scratch'?(nativeScratch382?'scratch':'cut'):kind;
    const layer={part:id,kind:clinical,severity};hit.layers.push(layer);addResolvedInjuryBatch(record,[layer],draw);
  };
  const preserve=(id:BodyPartId,amount:number,min:number,max:number):number=>{
    const hp=remainingPartHealth(record,id)/HP_UNIT;
    if(id==='torso'||BODY_PARTS[id].depth==='inside'||amount<hp)return amount;
    return draw()<Math.max(0,Math.min(1,((amount-hp)/medicalModel(record).byId[id].hp-min)/(max-min)))?amount:Math.max(0,hp-1);
  };
  const inner=BODY_PARTS[part].depth==='inside',chain=ancestry(part);
  if(kind==='cut'&&inner){
    const denominator=chain.length-.5;
    for(let i=0;i<chain.length;i++)add(chain[i]!,damage/denominator*(i===0?.5:1));
  }else if(kind==='scratch'&&inner){
    for(const id of chain)add(id,damage/chain.length);
  }else if(kind==='cut'){
    const extra=curve(draw(),[[0,0],[.6,1],[.9,2],[1,3]]),floor=Math.floor(extra),count=floor+(draw()<extra-floor?1:0);
    const pool=neighbours(part),targets:BodyPartId[]=[];
    for(let i=0;i<count&&pool.length;i++){
      const id=pool.splice(Math.floor(draw()*pool.length),1)[0]!;
      if(!BODY_PARTS[id].conceptual&&BODY_COVERAGE[BODY_INDEX[id]]>0)targets.push(id);
    }
    targets.push(part);
    const spread=damage*2.4/(targets.length+1.4),amount=count===0?preserve(part,spread,0,.1):spread;
    for(const id of targets)add(id,amount);
  }else if(kind==='scratch'){
    const pool=neighbours(part).filter(id=>!BODY_PARTS[id].conceptual&&BODY_PARTS[id].depth==='outside'&&!partMissing(record,id));
    const other=pool.length?pool[Math.floor(draw()*pool.length)]:undefined,amount=damage*(other===undefined?1:.67);
    add(part,preserve(part,amount,0,.7));
    if(other!==undefined&&!record.death)add(other,preserve(other,amount,0,.7));
  }else if(kind==='stab'){
    const amount=preserve(part,damage,.4,1);
    for(const id of chain)add(id,amount*(inner?(BODY_PARTS[id].depth==='outside'?.75:.4):1));
  }else{
    const amount=preserve(part,damage,.4,1);
    // Crush uses AddInjury, duplicating the full amount outward. Unlike Blunt,
    // it has no excess propagation or random bone conversion.
    for(const id of chain)if(id===part||remainingPartHealth(record,id)>0&&BODY_COVERAGE[BODY_INDEX[id]]>0)add(id,amount);
  }
  return hit;
}
