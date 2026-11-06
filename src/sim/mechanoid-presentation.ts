import {mechRaidGroup261} from './mechanical-raid-groups-261.ts';
import {sleepingTempleMech256,mechanicalOrder256} from './temple-mech-duty-256.ts';
import { mechanoidBodyModel } from './mechanoid-anatomy.ts';
import { mechanoidDefinition,type MechanoidKind } from './mechanoid-definition.ts';
import { mechanoidGunId,mechanoidRangedProfile } from './mechanoid-ranged-profile.ts';
import { combatTargetByKey,type LivingTargetKey } from './combat-target.ts';
import { mechaAssessment,mechaMass } from './mechanoid-health.ts';
import { partMissing,remainingPartHealth } from './injury-state.ts';
import { HP_UNIT,INJURY_RULES } from './injury-rules.ts';
import type { MedicalRecord } from './injury-types.ts';
import type { Mechanoid } from './mechanoid-state.ts';
import type { Cell,World } from './types.ts';
import { ANIMAL_SPECIES } from './animal-species.ts';
import { pawnBodyLocation } from './human-corpses.ts';
import { empMechanoidActive } from './emp-state.ts';
import { structureById } from './structure-navigation.ts';

/** The authored rig names its pieces independently of the medical namespace. */
export function mechanoidPartIndex(kind:MechanoidKind,visualId:string):number {
  const id=visualId==='torso'?`${kind}-thorax`:visualId==='left-eye'?`${kind}-left-sight-sensor`:visualId==='right-eye'?`${kind}-right-sight-sensor`:`${kind}-${visualId}`;
  return mechanoidBodyModel(kind).parts.findIndex(part=>part.id===id);
}
export const scytherPartIndex=(visualId:string):number=>mechanoidPartIndex('scyther',visualId);
export function mechanoidVisualMask(actor:{mechKind:MechanoidKind;health?:MedicalRecord}):readonly [number,number] {
  let low=0,high=0;
  if(actor.health)mechanoidBodyModel(actor.mechKind).parts.forEach((part,index)=>{if(partMissing(actor.health!,part.id)){if(index<16)low+=2**index;else high+=2**(index-16);}});
  return [low,high];
}

export interface MechanoidTargetView {id:number;label:string;cell:Cell|null}
export function mechanoidTargetView(world:World,id:number):MechanoidTargetView {
  const human=world.pawns.find(p=>p.id===id);if(human){const body=pawnBodyLocation(world,human);return {id,label:human.name,cell:body?{x:body.x,z:body.z}:null};}
  const animal=world.wildlife?.animals.find(a=>a.id===id);if(animal)return {id,label:ANIMAL_SPECIES[animal.species].label,cell:{x:animal.x,z:animal.z}};
  const mech=world.mechanoids?.find(m=>m.id===id);if(mech)return {id,label:`${mechanoidDefinition(mech.mechKind).label} ${id}`,cell:{x:mech.x,z:mech.z}};
  const building=structureById(world,id);if(building)return {id,label:`Bâtiment ${id}`,cell:{x:building.x,z:building.z}};
  return {id,label:`Cible ${id} indisponible`,cell:null};
}
/** A typed ranged reference never resolves to an owner in a different namespace. */
function rangedTargetView(world:World,key:LivingTargetKey):MechanoidTargetView {
  const id=Number(key.slice(key.indexOf(':')+1));
  return combatTargetByKey(world,key)?mechanoidTargetView(world,id):{id,label:`Cible ${id} indisponible`,cell:null};
}
export function mechanoidRangedView(world:World,actor:Mechanoid) {
  const profile=mechanoidRangedProfile(actor.mechKind),profileId=mechanoidGunId(actor.mechKind);
  if(!profile||!profileId)return null;
  const stance=actor.ranged?.stance,order=actor.ranged?.order;
  return {profileId,range:profile.range,phase:stance?.phase??null,
    remainingCore:stance?.remainingCore??null,totalCore:stance?stance.phase==='warmup'?profile.warmupCoreTicks:profile.cooldownCoreTicks:null,
    suspended:!!stance&&(!!actor.stun||empMechanoidActive(actor,world.tick*10)),targetKey:stance?.targetKey??null,
    target:stance?rangedTargetView(world,stance.targetKey):null,
    orderTarget:order?rangedTargetView(world,order.targetKey):null};
}
export function mechanoidView(world:World,actor:Mechanoid) {
  const targetId=actor.melee?.order?.targetId??actor.melee?.strike?.targetId;
  const ranged=mechanoidRangedView(world,actor);
  const target=targetId==null?ranged?.orderTarget??ranged?.target??null:mechanoidTargetView(world,targetId);
  const group=mechRaidGroup261(world,actor.raid?.group);
  const action=actor.state==='dead'?'Neutralisé':actor.state==='downed'?'Incapacité mécanique':sleepingTempleMech256(actor)?actor.site263?'Mécanoïde dormant du site':'Mécanoïde dormant du temple':actor.site263&&world.tick*10<actor.site263.releaseAtCore?'Attend avant son assaut':empMechanoidActive(actor,world.tick*10)?'Neutralisé temporairement par EMP':actor.stun?'Immobilisé':
    actor.melee?.strike?'Récupère après son coup':actor.melee?.order?actor.state==='working'?'Frappe au contact':'Approche sa cible':
    ranged?.phase==='warmup'?'Prépare son tir':ranged?.phase==='cooldown'?'Récupère après son essai de tir':
    actor.state==='moving'?group?.phase==='staging'?'Rejoint le point de regroupement':'Avance vers la colonie':group?.phase==='staging'?'Se regroupe avant l’assaut':'Cherche une cible';
  const assessment=mechaAssessment(actor);
  const definition=mechanoidDefinition(actor.mechKind),parts=mechanoidBodyModel(actor.mechKind).parts.map(part=>{
    const absent=!!actor.health&&partMissing(actor.health,part.id),health=actor.health?remainingPartHealth(actor.health,part.id)/HP_UNIT:part.hp;
    const injuries=actor.health?.injuries.filter(i=>i.part===part.id).map(i=>({id:i.id,label:INJURY_RULES[i.kind].label,severity:i.severity/HP_UNIT}))??[];
    return {id:part.id,label:part.label,maximum:part.hp,health,absent,injuries};
  });
  return {id:actor.id,label:`${definition.label} ${actor.id}`,action,target,ranged,hostile:true,group:group?.phase??null,
    goal:mechanicalOrder256(actor)?.goal?{...mechanicalOrder256(actor)!.goal!}:null,capacities:assessment.capacities,parts,mass:mechaMass(actor),
    armor:definition.armor,position:{x:actor.x,z:actor.z},dead:actor.state==='dead'};
}
