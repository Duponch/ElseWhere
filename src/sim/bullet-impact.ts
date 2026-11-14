import type { BodyPart,BodyPartId } from './body-definition.ts';
import { HUMAN_MODEL,medicalModel,modelHasPart } from './body-model.ts';
import type { ImpactProtection } from './apparel-protection.ts';
import { HP_UNIT,injuryPartRules } from './injury-rules.ts';
import { addResolvedInjuryBatch,partMissing,remainingPartHealth,type ResolvedInjury } from './injury-state.ts';
import type { MedicalRandom,MedicalRecord } from './injury-types.ts';

/** Natural adult hit input. Optional protection resolves once after exact part
 * selection; ordinary Core instant-kill setting, no implants/difficulty overrides. */
export interface UnarmoredBullet {
  /** Damage in HP from the projectile, not milli-HP or a pawn's global health. */
  damage:number;
  part?:BodyPartId;
  height?:BodyPart['height'];
  depth?:BodyPart['depth'];
  /** Schema 316 arrows: Core Arrow damage makes a Cut (Crack on a solid
   * part) instead of a Gunshot. Absent for every bullet. */
  injury?:'cut';
  /** Projectile stopping power (Core default 0.5); used from schema 318 for
   * the bullet stagger of an animal. Absent: the historical stagger. */
  stoppingPower?:number;
  /** Projectile armor penetration; used from schema 321 against an animal's
   * natural armor. Absent: no natural armor roll. */
  armorPenetration?:number;
}
export interface BulletImpactResult {
  record:MedicalRecord;
  selected:BodyPartId|null;
  preserved:boolean;
  /** Resolved layers in application order, including layers destroyed later. */
  layers:readonly ResolvedInjury[];
}
export function validateUnarmoredBullet(hit:UnarmoredBullet,model=HUMAN_MODEL):void {
  const BODY_PARTS=model.byId;
  // Bound the producer to an integer milli-HP envelope before allocating/RNG.
  if(!Number.isFinite(hit.damage)||hit.damage<0||!Number.isSafeInteger(hit.damage*HP_UNIT)||hit.damage>1000000||
    hit.part!==undefined&&(!modelHasPart(model,hit.part)||BODY_PARTS[hit.part].conceptual)||
    hit.height!==undefined&&!['top','middle','bottom'].includes(hit.height)||hit.depth!==undefined&&!['inside','outside'].includes(hit.depth)||
    hit.injury!==undefined&&hit.injury!=='cut'||hit.stoppingPower!==undefined&&(!Number.isFinite(hit.stoppingPower)||hit.stoppingPower<0)||hit.armorPenetration!==undefined&&(!Number.isFinite(hit.armorPenetration)||hit.armorPenetration<0))throw new Error('Invalid unarmored bullet');
}
const draw=(random:MedicalRandom):number=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new Error('Invalid impact random draw');return n;};

/** Coverage is the natural body's own exposed share, not uniform part count.
 * Height falls back to all heights when empty; depth remains constrained.
 * Current natural body has no Bullet-specific weight override. */
export function selectBulletPart(record:MedicalRecord,random:MedicalRandom,height?:BodyPart['height'],depth?:BodyPart['depth']):BodyPartId|null {
  const {parts:HUMAN_BODY,byId:BODY_PARTS,index:BODY_INDEX,coverage:BODY_COVERAGE}=medicalModel(record);
  const candidates=HUMAN_BODY.filter((p,i)=>!p.conceptual&&BODY_COVERAGE[i]>0&&(!depth||p.depth===depth)&&!partMissing(record,p.id));
  const sameHeight=height?candidates.filter(p=>p.height===height):candidates;
  const eligible=sameHeight.length?sameHeight:candidates;
  const total=eligible.reduce((n,p)=>n+BODY_COVERAGE[BODY_INDEX[p.id]],0);
  if(!total)return null;
  let roll=draw(random)*total;
  for(const p of eligible){roll-=BODY_COVERAGE[BODY_INDEX[p.id]];if(roll<0)return p.id;}
  return eligible.at(-1)!.id;
}

/** Owned copy plus explicit draw source: no World, clock, render or hidden RNG.
 * Resolve first, then commit the returned record and caller PRNG together. */
export function resolveUnarmoredBullet(record:MedicalRecord,hit:UnarmoredBullet,random:MedicalRandom,protect?:ImpactProtection,smallPawn324=false):BulletImpactResult {
  const model=medicalModel(record),{byId:BODY_PARTS,index:BODY_INDEX,coverage:BODY_COVERAGE}=model;
  const PART_INJURY_RULES=injuryPartRules(model,record);
  validateUnarmoredBullet(hit,model);
  const next:MedicalRecord={...record,injuries:record.injuries.map(i=>({...i,...(i.scar?{scar:{...i.scar}}:{}),...(i.infection?{infection:{...i.infection}}:{})})),missing:record.missing.map(m=>({...m})),...(record.death?{death:{...record.death}}:{}),
    ...(record.infections?{infections:{...record.infections,cases:record.infections.cases.map(c=>({...c,...(c.tend?{tend:{...c.tend}}:{})}))}}:{}),...(record.artificialParts?{artificialParts:record.artificialParts.map(p=>({...p}))}:{})};
  const result:BulletImpactResult={record:next,selected:null,preserved:false,layers:[]};
  if(record.death||!hit.damage||hit.part&&partMissing(record,hit.part))return result;
  const part=hit.part??selectBulletPart(next,random,hit.height,hit.depth);result.selected=part;
  if(!part)return result;
  const layers:ResolvedInjury[]=[];
  // One Core ApplyDamageToPart: armor, outside preservation, inside-to-outside
  // duplication. Returns the last part the hit touched (Core LastHitPart).
  const apply=(part:BodyPartId):BodyPartId=>{
    const guarded=protect?.(part,hit.damage),damage=guarded?.amount??hit.damage;
    if(!damage)return part;
    const kind=(id:BodyPartId)=>!guarded?.converted?(hit.injury==='cut'?PART_INJURY_RULES[id].solid?'crack' as const:'cut' as const:'gunshot' as const):PART_INJURY_RULES[id].solid?'crack' as const:PART_INJURY_RULES[id].skin?'bruise' as const:'crush' as const;
    let severity=damage*HP_UNIT;
    const definition=BODY_PARTS[part],hp=remainingPartHealth(next,part);
    if(definition.depth==='outside'&&definition.parent!==null&&severity>=hp) {
      const destructionChance=Math.min(1,(severity-hp)/(definition.hp*HP_UNIT*.7));
      if(draw(random)>=destructionChance){severity=Math.max(0,hp-HP_UNIT);result.preserved=true;}
    }
    const local:ResolvedInjury[]=[{part,kind:kind(part),severity}];
    if(definition.depth==='inside')for(let parent=definition.parent;parent!==null;parent=BODY_PARTS[parent].parent) {
      const outer=BODY_PARTS[parent];
      // Reference propagation repeats damage, not an excess remainder. No second
      // armor or outside-preservation roll for these duplicated layers.
      if(remainingPartHealth(next,parent)>0&&BODY_COVERAGE[BODY_INDEX[parent]]>0)local.push({part:parent,kind:kind(parent),severity:Math.max(HP_UNIT,severity)});
      if(outer.depth==='outside')break;
    }
    addResolvedInjuryBatch(next,local,()=>draw(random));
    layers.push(...local);return local.at(-1)!.part;
  };
  const last=apply(part);
  // Core ApplySmallPawnDamagePropagation (schema 324): a creature of health
  // scale 0.5 or less hit for 10 damage or more takes the full hit a second
  // time on the parent of the last part touched. Skipped on a dead record.
  const parent=BODY_PARTS[last].parent;
  if(smallPawn324&&model.healthScale<=.5001&&hit.damage>=10&&!next.death&&parent!==null&&remainingPartHealth(next,parent)>0&&BODY_COVERAGE[BODY_INDEX[parent]]>0)apply(parent);
  result.layers=layers;return result;
}
