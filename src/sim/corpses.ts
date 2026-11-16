import {noteBondedAnimalDeaths350} from './mood-pool-memories-350.ts';
import {toxicCorpseRot256} from './toxic-victim-256.ts';
import {planAnimalBodyRetirement256} from './animal-body-retirement-256.ts';
import {retainedCorpseDamage256,type RetainedCorpseDamage256} from './retained-corpse-damage-256.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {neutralLossPlan} from './destruction-losses.ts';
import { corpseCoverage,corpsePartAbsent,type ConsumedPart } from './corpse-anatomy.ts';
import { groundCapacity } from './ground-placement.ts';
import { rotAge,rotRateAtTemperature,type RotState } from './food-preservation.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { TemperatureView } from './temperature.ts';
import { TICKS_PER_DAY,type MaterialPile,type MaterialOwner,type Pawn,type World } from './types.ts';
import type { MedicalRecord } from './injury-types.ts';
import type { ThermalLayout } from './thermal-topology.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { adjacent } from './pathfinding.ts';
import { reservedSource } from './materials.ts';
import {actualAnimalProfile256} from './actual-animal-profile-256.ts';
import { animalSpecies,type AnimalSpeciesId,type AnimalMeatItem,type AnimalLeatherItem } from './animal-species.ts';
import { adultAgeTicks,bodySizeAtAge } from './animal-life.ts';

/** One corpse owns the original animal identity and frozen medical record. It is
 * not food, not a stack of abstract meat, and never also a live wildlife actor. */
export type { ConsumedPart } from './corpse-anatomy.ts';
export interface CorpseState {animalMapAreas287?:import('./animal-area-state-287.ts').AnimalMapAreas287;growthTracker?:import("./animal-growth-runtime-256.ts").AnimalGrowthTracker256;ageCoreRemainder?:number;animalId:number;species:AnimalSpeciesId;sex:'female'|'male';ageTicks:number;health:MedicalRecord;facing?:number;consumedParts?:ConsumedPart[]}
export const CORPSE_ROT_TICKS=2.5*TICKS_PER_DAY;
export const CORPSE_DESSICATION_TICKS=5*TICKS_PER_DAY;
export const corpseStage=(p:MaterialPile,tick:number):'fresh'|'rotting'|'desiccated'=>rotAge(p,tick)>=CORPSE_DESSICATION_TICKS?'desiccated':rotAge(p,tick)>=CORPSE_ROT_TICKS?'rotting':'fresh';
export const corpseFresh=(p:MaterialPile,tick:number):boolean=>p.kind==='corpse'&&!!p.corpse&&corpseStage(p,tick)==='fresh';

/** Before worker/spot efficiency and stochastic integer rounding. Missing whole
 * subtrees lose their coverage once; ordinary wounds have one global penalty. */
export function corpseYield(p:Pick<MaterialPile,'corpse'>):{meat:number;leather:number} {
  const c=p.corpse;if(!c)return {meat:0,leather:0};
  const definition=actualAnimalProfile256(c);
  const h=c.health,coverage=corpseCoverage(c);
  const injury=h.injuries.some(i=>!corpsePartAbsent(c,i.part)&&i.kind!=='execution-cut'&&(!i.scar||i.scar.threshold!==i.severity))?.66:1;
  const size=bodySizeAtAge(c.species,c.ageTicks??adultAgeTicks(c.species),c.growthTracker?.value)/definition.bodySize;
  const curve=(raw:number)=>raw<=5?raw*14/5:raw<=40?14+(raw-5)*26/35:raw;
  return {meat:curve(definition.rawMeat*size*coverage*injury),leather:curve(definition.rawLeather*size*coverage*injury)};
}
export function corpseProducts(p:Pick<MaterialPile,'corpse'>):{meat:{item:AnimalMeatItem;quantity:number};leather:{item:AnimalLeatherItem|null;quantity:number}}|undefined {
  if(!p.corpse)return;
  const definition=actualAnimalProfile256(p.corpse),yielded=corpseYield(p);
  return {meat:{item:definition.meatItem,quantity:yielded.meat},leather:{item:definition.leatherItem,quantity:yielded.leather}};
}
export const animalCorpseItem=(species:AnimalSpeciesId)=>animalSpecies(species).corpseItem;

function thermalAnchor(rot:RotState,tick:number,rate:number):RotState {
  if(rate===(rot.rate??1))return rot;
  const next={...rot,progress:rot.progress+(tick-rot.atTick)*(rot.rate??1),atTick:tick};
  if(rate===1)delete next.rate;else next.rate=rate;return next;
}
function corpsePile(a:WildAnimal,owner:MaterialOwner,rot:RotState):MaterialPile {
  return {...retainedCorpseDamage256(a)?{damage:retainedCorpseDamage256(a)}:{},id:a.id,kind:'corpse',item:animalCorpseItem(a.species),quantity:1,owner,rot:toxicCorpseRot256(a.health,rot),
    corpse:{...a.animalMapAreas287?{animalMapAreas287:structuredClone(a.animalMapAreas287)}:{},animalId:a.id,species:a.species,sex:a.sex,ageTicks:a.ageTicks,...a.growthTracker?{growthTracker:a.growthTracker,ageCoreRemainder:a.ageCoreRemainder}:{},health:a.health!,...a.motion?{facing:Math.atan2(a.motion.to.x-a.motion.from.x,a.motion.to.z-a.motion.from.z)}:a.arrivalRotation!==undefined?{facing:(a.arrivalRotation===3?-1:a.arrivalRotation)*Math.PI/2}:{}}};
}
function releaseBodyTargets(w:World,id:number):void {
  for(const animal of w.wildlife?.animals??[])if(animal.threat?.targetId===id||animal.retaliation?.targetId===id){
    delete animal.threat;delete animal.retaliation;animal.path=[];
    if((animal.motion?.end??0)<=w.tick)animal.state='idle';
    animal.nextDecision=Math.min(animal.nextDecision,w.tick);
  }
  for(const p of w.pawns){
    if(p.melee?.order?.targetId===id){cancelMelee(p);p.path=[];}
    if(p.shooting?.order?.targetId===id){cancelShooting(p);p.path=[];}
  }
}
/** A retained body can be lifted by its hunter without first making a second
 * pile on an occupied floor. The caller prevalidates the delivery destination. */
export function pickUpRetainedCorpse(w:World,p:Pawn,id:number):MaterialPile|null {
  const a=w.wildlife?.animals.find(a=>a.id===id);
  if(w.schemaVersion<79||!a||a.state!=='dead'||!a.health?.death||p.hunting?.animalId!==id||p.hunting.phase!=='collect'
    ||(a.motion?.end??0)>w.tick||(p.motion?.end??0)>w.tick||p.shooting?.stance
    ||!(a.x===p.x&&a.z===p.z||adjacent(p,a))||w.piles.length>=32768
    ||w.piles.some(i=>i.id===id||i.owner.type==='pawn'&&i.owner.pawnId===p.id)
    ||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||reservedSource(w,id,p.id)>0)return null;
  const view=new TemperatureView(w),sourceRot=thermalAnchor(a.corpseRot??toxicCorpseRot256(a.health,{progress:0,atTick:w.tick}),w.tick,rotRateAtTemperature(view.at(w,a)));
  const pile=corpsePile(a,{type:'pawn',pawnId:p.id},thermalAnchor(sourceRot,w.tick,rotRateAtTemperature(view.at(w,p))));
  w.piles.push(pile);w.wildlife!.animals.splice(w.wildlife!.animals.indexOf(a),1);releaseBodyTargets(w,id);
  return pile;
}

/** Finish the captured fall before replacing its actor with an indivisible pile.
 * A blocked cell retains its corpse, age and identity until space exists; it is
 * never teleported to a distant free tile or discarded to satisfy pile limits. */
export function advanceCorpses(w:World,layout?:ThermalLayout):void {
  if(w.schemaVersion<79||!w.wildlife?.animals.some(a=>a.state==='dead'))return;
  // Schema 350: a bonded animal's death is mourned before its body leaves the list.
  noteBondedAnimalDeaths350(w);
  const view=new TemperatureView(w,layout),removed=new Set<number>();
  for(const a of w.wildlife.animals) {
    if(a.state!=='dead'||!a.health?.death)continue;
    // Old saves have no thermal history: start at the first V79 observation.
    a.corpseRot=thermalAnchor(a.corpseRot??toxicCorpseRot256(a.health,{progress:0,atTick:w.tick}),w.tick,rotRateAtTemperature(view.at(w,a)));
    const pile=corpsePile(a,{type:'ground',x:a.x,z:a.z},a.corpseRot);
    if((a.motion?.end??0)>w.tick||w.piles.length>=32768||groundCapacity(w,a,pile)<1)continue;
    w.piles.push(pile);
    removed.add(a.id);
    releaseBodyTargets(w,a.id);
  }
  if(removed.size)w.wildlife.animals=w.wildlife.animals.filter(a=>!removed.has(a.id));
}

/** Retire this actual dead owner, never a fabricated temporary corpse pile. */
export function destroyRetainedAnimalBody256(w:World,a:WildAnimal):boolean {
 if(w.schemaVersion<256||!w.wildlife?.animals.includes(a)||a.state!=='dead'||!a.health?.death)return false;
 const plan=planAnimalBodyRetirement256(w,a.id,true);if(!plan||!plan.commit())return false;
 w.wildlife.animals.splice(w.wildlife.animals.indexOf(a),1);releaseBodyTargets(w,a.id);
 for(const p of w.pawns)if(p.hunting?.animalId===a.id||p.animalRescue?.animalId===a.id||p.animalHandling?.animalId===a.id||p.animalFeed?.animalId===a.id||p.animalCare?.animalId===a.id)interruptWork(w,p,true);
 return true;
}

export function damageRetainedAnimalBody256(w:World,a:WildAnimal,amount:number):boolean {
 if(w.schemaVersion<256||!w.wildlife?.animals.includes(a)||a.state!=='dead'||!a.health?.death||!Number.isSafeInteger(amount)||amount<=0)return false;
 const damage=retainedCorpseDamage256(a)+amount;if(damage>=100)return destroyRetainedAnimalBody256(w,a);(a as WildAnimal&RetainedCorpseDamage256).corpseDamage=damage;return true;
}
