import {assessNativeAnimalBody256} from './animal-capacities-v256.ts';
import type { BodyPartId } from './body-definition.ts';
import { HUMAN_MODEL,type BodyModel } from './body-model.ts';
import { isMechanoidKind,type MechanoidKind } from './mechanoid-definition.ts';

/** Input projected from health conditions, not a saved global health bar.
 * Pain is supplied by injury/disease rules; this module never invents its cause. */
export interface BodyAssessmentInput {
  readonly damage:readonly {readonly part:BodyPartId;readonly loss:number}[];
  readonly missing:readonly BodyPartId[];
  /** Artificial root efficiency; immediate descendants count as one in limb
   * capacity products, although their natural body parts remain missing. */
  readonly artificialParts?:readonly {readonly part:BodyPartId;readonly efficiency:number}[];
  readonly pain:number;
  readonly partEfficiencyOffsets?:readonly {readonly part:BodyPartId;readonly offset:number}[];
  readonly hearingOffset?:number;
  readonly bloodPumpingOffset?:number;
  /** Condition modifiers apply after the physiological consciousness formula,
   * before its rounding and before capacities that consume consciousness. */
  readonly consciousnessOffset?:number;
  readonly consciousnessMax?:number;
  readonly movingOffset?:number;
  readonly manipulationOffset?:number;
  readonly breathingOffset?:number;
  readonly sightOffset?:number;
  readonly talkingOffset?:number;
  readonly digestionOffset?:number;
  readonly bloodFiltrationOffset?:number;
  /** Applied after each capacity's offsets and before its maximum/rounding.
   * Dependent capacities read that result, rather than an unmodified parent. */
  readonly consciousnessFactor?:number;
  readonly movingFactor?:number;
  readonly manipulationFactor?:number;
  readonly bloodFiltrationFactor?:number;
  readonly eatingFactor?:number;
  readonly talkingFactor?:number;
}
export interface BodyCapacities {
  readonly consciousness:number; readonly moving:number; readonly manipulation:number;
  readonly sight:number; readonly hearing:number; readonly talking:number; readonly eating:number;
  readonly breathing:number; readonly bloodPumping:number; readonly bloodFiltration:number; readonly digestion:number;
}
export interface BodyAssessment {
  readonly capacities:BodyCapacities;
  readonly canBeAwake:boolean;
  readonly movingCapable:boolean;
  readonly painShock:boolean;
  /** Physiological failure only: death-on-downed, blood loss and damage threshold live elsewhere. */
  readonly vitalFailure:boolean;
}
export const HEALTHY_BODY_INPUT:BodyAssessmentInput=Object.freeze({damage:Object.freeze([]),missing:Object.freeze([]),pain:0});

/** Unity-style nearest even at the published hundredth boundary. JS doubles are
 * deterministic here; this is not an assertion of bit-identical C# float math. */
export function capacityRounded(value:number):number {
  return nearestEven(Math.max(0,value)*100)/100;
}
function nearestEven(value:number):number {
  const lower=Math.floor(value),fraction=value-lower;
  return fraction===.5 ? lower+(lower%2) : Math.round(value);
}
/** Allocate only while assessing changed health, never during movement frames. */
export function bodyEfficiencies(input:BodyAssessmentInput,model=HUMAN_MODEL):Float64Array {
  const {parts:HUMAN_BODY,index:BODY_INDEX,parents:BODY_PARENTS}=model;
  const loss=new Float64Array(HUMAN_BODY.length),missing=new Uint8Array(HUMAN_BODY.length),efficiency=new Float64Array(HUMAN_BODY.length);
  for(const damage of input.damage)loss[BODY_INDEX[damage.part]]!+=damage.loss;
  for(const id of input.missing)missing[BODY_INDEX[id]]=1;
  const added=new Map<BodyPartId,number>(model.kind==='human'?(input.artificialParts??[]).map(p=>[p.part,p.efficiency] as const):[]),underAdded=new Uint8Array(HUMAN_BODY.length);
  for(let i=0;i<HUMAN_BODY.length;i++) {
    const part=HUMAN_BODY[i]!,parent=BODY_PARENTS[i]!;
    if(parent>=0&&(underAdded[parent]||added.has(HUMAN_BODY[parent]!.id))){underAdded[i]=1;efficiency[i]=1;continue;}
    if(parent>=0&&missing[parent])missing[i]=1;
    if(missing[i])continue;
    const remaining=nearestEven(Math.max(part.destroyable?0:1,part.hp-loss[i]!))/part.hp;
    // Injury efficiency on outside non-root parts reaches zero at 10% HP.
    // This is unrelated to the separate rule for indestructible internal bones.
    efficiency[i]=(part.depth==='outside'&&parent>=0 ? Math.max(0,(remaining-.1)/.9) : remaining)*(added.get(part.id)??1);
  }
  if(input.partEfficiencyOffsets)for(let i=0;i<HUMAN_BODY.length;i++){if(missing[i]||underAdded[i])continue;let offset=0;for(const row of input.partEfficiencyOffsets)if(row.part===HUMAN_BODY[i]!.id)offset=Math.fround(offset+row.offset);if(offset)efficiency[i]=Math.max(0,Math.fround(Math.fround(efficiency[i]!)+offset));}
  return efficiency;
}

function calculate(input:BodyAssessmentInput,model=HUMAN_MODEL):BodyAssessment {
  const efficiency=bodyEfficiencies(input,model),part=(id:BodyPartId)=>efficiency[model.index[id]]!;
  if(isMechanoidKind(model.kind))return calculateMechanical(part,model.kind);
  if(model.parts[0]?.nativeTags)return assessNativeAnimalBody256(input,model,efficiency);
  const human=model.kind==='human';
  const pair=(a:BodyPartId,b:BodyPartId)=>(part(a)+part(b))/2;
  const bestPair=(a:BodyPartId,b:BodyPartId)=>.75*Math.max(part(a),part(b))+.25*Math.min(part(a),part(b));
  const round=capacityRounded;
  const bloodPumping=round(part('heart')+(input.bloodPumpingOffset??0));
  const bloodFiltration=round((pair('left-kidney','right-kidney')*part('liver')+(input.bloodFiltrationOffset??0))*(input.bloodFiltrationFactor??1));
  const breathing=round(pair('left-lung','right-lung')*part('neck')*(human?pair('ribcage','sternum'):1)+(input.breathingOffset??0));
  const digestion=round(pair('stomach','liver')+(input.digestionOffset??0));
  const painOffset=Math.min(.4,Math.max(0,(input.pain-.1)*(.4/.9)));
  const naturalConsciousness=(part('brain')-(painOffset>=.01?painOffset:0))*(.8+.2*bloodPumping)*(.8+.2*breathing)*(.9+.1*bloodFiltration);
  const consciousness=round(Math.min(input.consciousnessMax??Infinity,(naturalConsciousness+(input.consciousnessOffset??0))*(input.consciousnessFactor??1)));
  const canBeAwake=consciousness>=.3;
  let arms=0,legs=0,functionalLegs=0;
  if(human)for(const side of ['left','right'] as const) {
    const fingers=(['pinky','ring-finger','middle-finger','index-finger','thumb'] as const).reduce((sum,id)=>sum+part(`${side}-${id}`),0)/5;
    arms+=part(`${side}-arm`)*part(`${side}-shoulder`)*part(`${side}-clavicle`)*part(`${side}-humerus`)*part(`${side}-radius`)*part(`${side}-hand`)*(.2+.8*fingers);
    const toes=(['little-toe','fourth-toe','middle-toe','second-toe','big-toe'] as const).reduce((sum,id)=>sum+part(`${side}-${id}`),0)/5;
    const leg=part(`${side}-leg`)*part(`${side}-femur`)*part(`${side}-tibia`)*part(`${side}-foot`)*(.6+.4*toes);
    legs+=leg;if(leg>0)functionalLegs++;
  }
  if(!human) {
    arms=part('jaw')*2;
    for(const side of ['left','right'] as const)for(const end of ['front','rear'] as const){
      const foot=(Object.hasOwn(model.byId,`${side}-${end}-hoof`)?`${side}-${end}-hoof`:`${side}-${end}-paw`) as BodyPartId;
      const leg=part(`${side}-${end}-leg`)*part(foot);legs+=leg;if(leg>0)functionalLegs++;
    }
  }
  const moving=canBeAwake&&functionalLegs>=(human?1:2)?round((legs/(human?2:4)*(human?part('pelvis'):1)*part('spine')*(.8+.2*breathing)*(.8+.2*bloodPumping)*Math.min(1,consciousness)+(input.movingOffset??0))*(input.movingFactor??1)):0;
  const capacities=Object.freeze({consciousness,moving,manipulation:canBeAwake?round((arms/2*consciousness+(input.manipulationOffset??0))*(input.manipulationFactor??1)):0,
    sight:round(bestPair('left-eye','right-eye')+(input.sightOffset??0)),hearing:round(bestPair('left-ear','right-ear')+(input.hearingOffset??0)),
    talking:human&&canBeAwake?round((part('jaw')*part('neck')*part('tongue')*consciousness+(input.talkingOffset??0))*(input.talkingFactor??1)):0,
    eating:canBeAwake?round(Math.max(.1,(human?part('jaw'):1)*part('neck')*(human?(.5+.5*part('tongue')):1)*consciousness*(input.eatingFactor??1))):0,
    breathing,bloodPumping,bloodFiltration,digestion});
  return Object.freeze({capacities,canBeAwake,movingCapable:moving>.15,painShock:input.pain>=.8,
    vitalFailure:part('torso')<=.0001||[consciousness,breathing,bloodPumping,bloodFiltration,digestion].some(value=>value<=0)});
}
/** Mechanical tags still feed the common capacity workers. The hidden neck
 * breathing capacity participates in consciousness and movement, but is not a
 * lethal biological dependency for this race. */
function calculateMechanical(readPart:(id:BodyPartId)=>number,kind:MechanoidKind):BodyAssessment {
  const part=(suffix:string)=>readPart(`${kind}-${suffix}` as BodyPartId);
  const round=capacityRounded;
  const bloodPumping=round(part('reactor'));
  const bloodFiltration=round((part('left-fluid-reprocessor')+part('right-fluid-reprocessor'))/2);
  const breathing=round(part('neck'));
  const consciousness=round(part('brain')*(.8+.2*Math.min(bloodPumping,1))*(.8+.2*Math.min(breathing,1))*(.9+.1*Math.min(bloodFiltration,1)));
  const canBeAwake=consciousness>=.3;
  let arms=0,legs=0,functionalLegs=0;
  if(kind==='pikeman'){
    arms=2*part('thorax');
    for(const side of ['left','right'] as const)for(const end of ['front','rear'] as const){
      const leg=part(`${side}-${end}-leg`)*part(`${side}-${end}-foot`);legs+=leg;if(leg>0)functionalLegs++;
    }
  }else for(const side of ['left','right'] as const){
    const fingers=(['pinky','middle-finger','index-finger','thumb'] as const).reduce((sum,id)=>sum+part(`${side}-${id}`),0)/4;
    arms+=part(`${side}-shoulder`)*part(`${side}-arm`)*part(`${side}-hand`)*(.2+.8*fingers);
    const leg=part(`${side}-leg`)*part(`${side}-foot`);legs+=leg;if(leg>0)functionalLegs++;
  }
  const moving=canBeAwake&&functionalLegs>=(kind==='pikeman'?2:1)?round(legs/(kind==='pikeman'?4:2)*(.8+.2*breathing)*(.8+.2*bloodPumping)*Math.min(consciousness,1)):0;
  const bestPair=(a:string,b:string)=>round(.75*Math.max(part(a),part(b))+.25*Math.min(part(a),part(b)));
  const capacities=Object.freeze({consciousness,moving,manipulation:canBeAwake?round(arms/2*consciousness):0,
    sight:bestPair('left-sight-sensor','right-sight-sensor'),hearing:bestPair('left-hearing-sensor','right-hearing-sensor'),
    talking:0,eating:0,breathing,bloodPumping,bloodFiltration,digestion:1});
  return Object.freeze({capacities,canBeAwake,movingCapable:moving>.15,painShock:false,
    vitalFailure:part('thorax')<=.0001||[consciousness,bloodPumping,bloodFiltration].some(value=>value<=0)});
}
export const HEALTHY_BODY:BodyAssessment=calculate(HEALTHY_BODY_INPUT);
/** Caller supplies a current health projection. No cache keyed solely by pawn ID
 * or tick: in-place injury changes must be visible within the same tick. */
export function assessBody(input:BodyAssessmentInput=HEALTHY_BODY_INPUT,model:BodyModel=HUMAN_MODEL):BodyAssessment {
  return model.kind==='human'&&!input.artificialParts?.length&&input.damage.length===0&&input.missing.length===0&&input.pain===0&&!input.manipulationOffset&&!input.movingOffset&&!input.breathingOffset&&!input.sightOffset&&!input.talkingOffset&&!input.digestionOffset&&!input.bloodFiltrationOffset&&!input.bloodPumpingOffset&&!input.hearingOffset&&!input.consciousnessOffset&&(input.consciousnessMax??1)>=1&&(input.consciousnessFactor??1)===1&&(input.movingFactor??1)===1&&(input.manipulationFactor??1)===1&&(input.bloodFiltrationFactor??1)===1&&(input.eatingFactor??1)===1&&(input.talkingFactor??1)===1?HEALTHY_BODY:calculate(input,model);
}
