import {markPileWrite} from './pile-index.ts';
import {medicalCivilTick271,medicalElapsedTicks271} from './suspended-human-clock-271.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {advanceOffmapThermal259} from './offmap-thermal-259.ts';
import {commitToxicDeath256} from './toxic-buildup-256.ts';
import {applyLiveAnimalBirthday256} from './animal-live-birthday-256.ts';
import {caravanAnimalConditionFrontier256} from './animal-condition-medical-frontier-256.ts';
import {advanceTrackedAnimalAge256,synchronizeAnimalGrowthMedical256,attachNewbornAnimalGrowth256} from './animal-growth-runtime-256.ts';
import {healthRandom} from './health.ts';
import {unclaimDetachedActorBed256} from './actor-map-bed-256.ts';
import type {World,MaterialPile} from './types.ts';
import type {AwayGroup} from './group-capture.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {GroupAnimalOwners256,GroupAnimalOrigin256} from './group-animal-state-256.ts';
import {animalBodySize,animalNutritionMax,animalFoodPerDay,animalGrowthFactor,gestationTicks} from './animal-life.ts';
import {animalSpecies} from './animal-species.ts';
import {animalCore256,isAnimalSpecies256,animalLifeStageData256} from './animal-core-v256.ts';
import {drawAnimalLitter256} from './animal-reproduction-v256.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {advanceMedical} from './injury-evolution.ts';
import {medicalStatus} from './injury-state.ts';
import {malnutritionRate,malnutritionModifiers} from './malnutrition.ts';
import {animalProductDefinition} from './animal-products.ts';
import {ANIMAL_EGG_CONTENT_256,eggSpeciesForItem256,isEggSpecies256} from './animal-egg-content-v256.ts';
import {evolveFertilizedEgg256} from './animal-egg-state-v256.ts';
import {freshRot} from './food-preservation.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {caravanAnimalWantFood256,recordCaravanInventoryEffect256} from './group-animal-food-256.ts';
import {animalMechanicalReadiness256} from './animal-readiness-v256.ts';
type Group=AwayGroup&{animalOwners?:GroupAnimalOwners256};
export interface AnimalBiologicalContext256 {
 random():number;temperature:number;
 clinicalRest(a:WildAnimal):{resting:boolean;carried:boolean};
 originForInventory(holderId:number):GroupAnimalOrigin256|undefined;
 /** Death transfers actual possessions before retiring the original. */
 retire(a:WildAnimal,origin:GroupAnimalOrigin256):void;
}
function origin(g:Group,a:WildAnimal):GroupAnimalOrigin256 {const o=g.animalOwners?.origins.find(o=>o.pawnId===a.id);if(!o)throw Error('Missing actual animal provenance');return o;}
function newborn(id:number,tick:number,species:WildAnimal['species'],o:GroupAnimalOrigin256,random:()=>number,cell:{x:number;z:number},parents?:WildAnimal['parents'],domestic?:WildAnimal['domestic']):WildAnimal {
 const a:WildAnimal={id,species,sex:random()<.5?'female':'male',ageTicks:0,x:cell.x,z:cell.z,food:0,rest:1,state:'idle',path:[],nextDecision:tick+1,...parents?{parents}:{}};
 attachNewbornAnimalGrowth256(a,tick*10,256);a.food=animalNutritionMax(a)*.45;if(isEggSpecies256(species))a.eggLayer={progress:0,fertilizations:0};
 if(domestic)a.domestic={since:tick,care:domestic.care,tameness:domestic.tameness,nextDecay:Math.max(tick,domestic.nextDecay),...animalProductDefinition(a)?{productFullness:0}:{}};
 return a;
}
function prepareNewborns(w:World,g:Group,species:WildAnimal['species'],o:GroupAnimalOrigin256,count:number,randomState:{rng:number},cell:{x:number;z:number},parents?:WildAnimal['parents'],domestic?:WildAnimal['domestic']):WildAnimal[] {
 if(!Number.isSafeInteger(count)||count<1||!Number.isSafeInteger(w.nextId+count))throw Error('Actual birth identities exhausted');
 
 const babies:WildAnimal[]=[];for(let n=0;n<count;n++)babies.push(newborn(w.nextId+n,w.tick,species,o,()=>healthRandom(randomState),cell,parents,domestic));return babies;
}
function commitNewborns(w:World,g:Group,o:GroupAnimalOrigin256,babies:WildAnimal[],randomState:{rng:number}):void {
 g.animalOwners??={revision:1,members:[],origins:[],order:g.members.map(p=>p.id),...!g.travel?{interval:{revision:1,startedAt:w.tick,atCore:w.tick*10,tickDelta:0}}:{}};g.animalOwners.order.push(...babies.map(a=>a.id));g.animalOwners.members.push(...babies);g.animalOwners.origins.push(...babies.map(a=>({pawnId:a.id,originMapId:o.originMapId,context:o.context})));w.nextId+=babies.length;w.rng=randomState.rng;
}
/** One real local clock frontier, not a fake World or catch-up loop. The
 * shared Core runtime owns all interval callbacks and rest marks. */
export function advanceCaravanAnimalBiology256(w:World,g:Group,c:AnimalBiologicalContext256):void {
 const owners=g.animalOwners;if(w.schemaVersion<256||w.group!==g||g.lastPersonalTick!==w.tick)throw Error('Invalid caravan animal frontier');
 const residents=[...owners?.members??[]];
 for(const a of residents){if(a.state==='dead'||a.health?.death)throw Error('Terminal animal still active');const o=origin(g,a),oldAge=a.ageTicks;if(!Number.isSafeInteger(oldAge+1))throw Error('Animal age exhausted');if(a.growthTracker){const oldAgeCore=a.ageTicks*10+(a.ageCoreRemainder??0);advanceTrackedAnimalAge256(a,{atCore:w.tick*10,deltaCore:10,hungerMultiplier:animalGrowthFactor(a),suspended:false});synchronizeAnimalGrowthMedical256(a);applyLiveAnimalBirthday256(w,a,oldAgeCore,c.random);}else a.ageTicks++;
  if(a.food<=0)a.health??=createAnimalMedicalRecord256(w,a,w.tick-1);
  if(a.health){if(medicalCivilTick271(a.health)!==w.tick-1&&medicalCivilTick271(a.health)!==w.tick)throw Error('Animal clinical frontier skipped');const rest=c.clinicalRest(a);
   const conditionFrontier=caravanAnimalConditionFrontier256(a,a.health,c.random);
   advanceMedical(a.health,medicalElapsedTicks271(a.health,w.tick),{phase:a.id%60,toxicOwner:{id:a.id,spawned:false,awake:a.state!=='sleeping'},cryptosleepSicknessSpawned:false,posture:rest.resting?'ground':'standing',starving:a.food<=0,malnutritionRate:malnutritionRate(a.id),hunger:a.food/animalNutritionMax(a)*100,rest:a.rest*100,restingBonus:rest.resting&&a.state!=='downed',infectionSeed:(o.context.seed^Math.imul(a.id,0x9e3779b1))>>>0},c.random,conditionFrontier);conditionFrontier?.commit();
  }
  if(Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))advanceOffmapThermal259(a,g.items,w.tick*10,c.temperature,()=>createAnimalMedicalRecord256(w,a,w.tick));
  if(a.health){const status=medicalStatus(a.health);if(status==='dead'){commitToxicDeath256(a.health,c.random);a.state='dead';if(isAnimalSpecies256(a.species))a.ageTicks=a.health.tick-a.health.animalBirthTick!;unclaimDetachedActorBed256(a);c.retire(a,o);continue;}a.state=status==='downed'?'downed':'idle';
  }
  const product=animalProductDefinition(a);if(product&&a.domestic)a.domestic.productFullness=Math.min(1,(a.domestic.productFullness??0)+animalGrowthFactor(a)/(product.days*6000));
  const pregnancy=a.pregnancy;if(pregnancy){const factor=animalGrowthFactor(a),accrue=factor===1||factor===.5&&(w.tick+a.id)%2===0||factor===.25&&(w.tick+a.id)%4===0;if(accrue)pregnancy.progress=Math.min(gestationTicks(a.species),pregnancy.progress+1);
   if(pregnancy.progress>=gestationTicks(a.species)){const randomState={rng:w.rng},random=()=>healthRandom(randomState);const count=isAnimalSpecies256(a.species)?drawAnimalLitter256(a.species,random):a.species==='hare'||a.species==='snow-hare'?1+(random()<.5?1:0):1;
    const babies=prepareNewborns(w,g,a.species,o,count,randomState,a,{motherId:a.id,fatherId:pregnancy.fatherId},a.domestic);commitNewborns(w,g,o,babies,randomState);delete a.pregnancy;
   }
  }
 }
 for(const p of [...g.items]){const species=eggSpeciesForItem256(p.item);if(!species||!p.egg||p.owner.type!=='inventory')continue;const o=c.originForInventory(p.owner.pawnId);if(!o)throw Error('Fertilized egg has no real group holder');
  const result=evolveFertilizedEgg256(p.egg,species,{tick:w.tick,temperature:c.temperature,suspended:false});
  if(result.action==='ruin'){const item=ANIMAL_EGG_CONTENT_256[species].unfertilizedItem;recordCaravanInventoryEffect256(g,p.item,-p.quantity);recordCaravanInventoryEffect256(g,item,p.quantity);p.item=item;markPileWrite();delete p.egg;Object.assign(p,freshRot(item,w.tick));}
  else if(result.action==='hatch'){if(!animalMechanicalReadiness256(species).ok)throw Error('Unimplemented real hatcher species');
   const egg=result.state,randomState={rng:w.rng},holder=[...g.members,...g.animalOwners?.members??[]].find(a=>a.id===(p.owner as {pawnId:number}).pawnId);if(!holder)throw Error('Actual egg inventory holder absent');
   const babies=prepareNewborns(w,g,species,o,p.quantity,randomState,holder,egg.motherId!==undefined&&egg.fatherId!==undefined?{motherId:egg.motherId,fatherId:egg.fatherId}:undefined,egg.faction==='player'?{since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+6000}:undefined);
   recordCaravanInventoryEffect256(g,p.item,-p.quantity);commitNewborns(w,g,o,babies,randomState);g.items.splice(g.items.indexOf(p),1);
  }else p.egg=result.state;
 }
}
export function advanceCaravanAnimalNeed150256(a:WildAnimal,coreTick:number,restEffectiveness:number|undefined):void {
 if(a.state==='dead'||a.health?.death)return;
 if(groupPawnInterval256(a.id,coreTick,150,1)){const max=animalNutritionMax(a),ratio=a.food/max,want=caravanAnimalWantFood256(a),category=ratio<=0?0:ratio<want*.4?.25:ratio<want*.8?.5:1;
  a.food=Math.max(0,Math.fround(a.food-Math.fround(animalFoodPerDay(a)/60000*150*category*malnutritionModifiers(a.health?.malnutrition).hungerFactor)));
  const factor=a.rest>=.28?1:a.rest>=.14?.7:a.rest>=.01?.3:.6;a.rest=restEffectiveness===undefined?Math.max(0,Math.fround(a.rest-Math.fround(1.5833333e-5*150*factor))):Math.min(1,Math.fround(a.rest+Math.fround(.005714286*restEffectiveness)));
 }
 if(isEggSpecies256(a.species)&&a.eggLayer&&groupPawnInterval256(a.id,coreTick,2500,1)){const def=ANIMAL_EGG_CONTENT_256[a.species];if((!def.femaleOnly||a.sex==='female')&&animalLifeStageData256(a.species,a.ageTicks,a.growthTracker?.value).milkable){const inc=Math.fround(Math.fround(2500/Math.fround(def.intervalDays*60000))*animalGrowthFactor(a));a.eggLayer.progress=Math.min(a.eggLayer.fertilizations?1:def.unfertilizedProgressMaximum,Math.fround(a.eggLayer.progress+inc));}}
}
