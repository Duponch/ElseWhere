import {incomingDamageFactor361} from './traits.ts';
import {landedStartingPods256,damageStartingPod256} from './starting-pod-damage-256.ts';
import {damageRoofMineable256} from './roof-mineable-damage-256.ts';
import {damageFrameFromRoof256,frameCovers256} from './roof-frame-256.ts';
/** Original physical collapse producer. Installed actors/ground things are
 * captured before each pass; mutations and dropped cargo cannot substitute a
 * different object for an earlier candidate. Existing health/retirement
 * transactions own their effects. Core ThingGrid insertion order is not stored
 * by Elsewhere: the collection order below is an explicit deterministic limit. */
import {footprintCells} from './definitions.ts';
import {seriesApparelProtection} from './apparel-protection.ts';
import {selectBulletPart} from './bullet-impact.ts';
import {medicalModel} from './body-model.ts';
import {HP_UNIT,medicalPartInjuryRule} from './injury-rules.ts';
import {createMedicalRecord,addResolvedInjuryBatch,remainingPartHealth,partMissing} from './injury-state.ts';
import {healthRandom,updatePawnHealth,reconcilePawnHealth} from './health.ts';
import {advanceAnimalHealth,commitAnimalImpact} from './wildlife-health.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {createMechaMedicalRecord,commitMechanoidImpact} from './mechanoid-health.ts';
import {carrierOf} from './rescue-state.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {destroyRetainedHumanBody256,damageRetainedHumanBody256} from './human-corpses.ts';
import {destroyRetainedAnimalBody256,damageRetainedAnimalBody256} from './corpses.ts';
import {destroyRetainedMechanoidBody256,damageRetainedMechanoidBody256} from './mechanoid-corpse.ts';
import {damagePile,damageResource,damageStructure,pileMaxHp,resourceMaxHp,structureMaxHp} from './thing-damage.ts';
import {disturbanceEvents,isLying} from './disturbance.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {BodyPartId} from './body-definition.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Mechanoid} from './mechanoid-state.ts';
import type {Cell,MaterialPile,Pawn,Resource,Structure,World} from './types.ts';

type Actor={x:number;z:number;motion?:{from:Cell;end:number}|null};
export function roofPhysicalCell256(world:World,actor:Actor):Cell {return actor.motion&&actor.motion.end>world.tick?actor.motion.from:actor;}
const cellIndex=(world:World,cell:Cell)=>cell.z*world.width+cell.x;
type Target={kind:'starting-pod';value:import('./starting-pod-state-256.ts').CoreStartingPod256}|{kind:'rock';value:import('./types.ts').Tile;index:number}|{kind:'frame';value:import('./types.ts').Job}|{kind:'human';value:Pawn}|{kind:'animal';value:WildAnimal}|{kind:'mecha';value:Mechanoid}|{kind:'resource';value:Resource}|{kind:'pile';value:MaterialPile}|{kind:'structure';value:Structure};
function targets(world:World,index:number):Target[]{
 const at=(cell:Cell)=>cellIndex(world,cell)===index,out:Target[]=[];
 if(world.tiles[index]?.terrain==='rock')out.push({kind:'rock',value:world.tiles[index]!,index});
 for(const s of world.structures)if(footprintCells(s).some(at))out.push({kind:'structure',value:s});
 for(const p of world.packed)if(p.owner.type==='ground'&&at(p.owner))out.push({kind:'structure',value:p.building});
 for(const j of world.jobs)if(frameCovers256(j,index,world.width))out.push({kind:'frame',value:j});
 for(const r of world.resources)if(at(r))out.push({kind:'resource',value:r});
 for(const p of world.piles)if(p.owner.type==='ground'&&at(p.owner))out.push({kind:'pile',value:p});
 for(const pod of landedStartingPods256(world))if(at(pod.cell))out.push({kind:'starting-pod',value:pod});
 for(const p of world.pawns)if(p.body?.lostAt===undefined&&p.body?.pileId===undefined&&!carrierOf(world,p.id)&&at(roofPhysicalCell256(world,p)))out.push({kind:'human',value:p});
 for(const a of world.wildlife?.animals??[])if(!animalCarrier(world,a.id)&&at(roofPhysicalCell256(world,a)))out.push({kind:'animal',value:a});
 for(const m of world.mechanoids??[])if(at(roofPhysicalCell256(world,m)))out.push({kind:'mecha',value:m});
 return out.reverse();
}
/** No direct death flag: localized real anatomy owns death, armor and scars. */
function hitRecord(record:MedicalRecord,amount:number,random:()=>number,thick:boolean,protect?:(part:BodyPartId,amount:number)=>{amount:number},tough=1):boolean {
 const model=medicalModel(record),brain=model.parts.find(p=>(p.id==='brain'||p.id.endsWith('-brain'))&&!partMissing(record,p.id));
 const part=thick?brain?.id??selectBulletPart(record,random,'top','outside'):selectBulletPart(record,random,'top','outside');
 if(!part)return false;let severity=(protect?.(part,amount).amount??amount)*HP_UNIT;if(tough!==1)severity=Math.round(severity*tough);
 const hp=remainingPartHealth(record,part);
 if(!thick&&severity>=hp){const excess=(severity-hp)/(model.byId[part].hp*HP_UNIT),chance=Math.max(0,Math.min(1,(excess-.4)/.6));if(random()>=chance)severity=Math.max(0,hp-HP_UNIT);}
 const traits=medicalPartInjuryRule(record,part);
 if(severity>0)addResolvedInjuryBatch(record,[{part,kind:traits.solid?'crack':traits.skin?'cut':'crush',severity:Math.round(severity)}],random);
 return severity>0;
}
function hitHuman(world:World,pawn:Pawn,amount:number,thick:boolean):boolean {
 if(!world.pawns.includes(pawn)||pawn.body?.lostAt!==undefined)return true;
 if(pawn.state==='dead'&&!thick)return damageRetainedHumanBody256(world,pawn,amount);
 if(pawn.state!=='dead'){
  if(!pawn.health||pawn.health.tick<world.tick)updatePawnHealth(world,pawn,true);
  if(!pawn.health?.death){const record=structuredClone(pawn.health??createMedicalRecord(world.tick)),random={rng:world.rng},draw=()=>healthRandom(random),wasLying=isLying(pawn);
   const armor=thick?undefined:seriesApparelProtection(world,pawn,0,draw,'blunt'),changed=hitRecord(record,amount,draw,thick,armor?.protect,incomingDamageFactor361(pawn));
   armor?.commit();world.rng=random.rng;pawn.health=record;reconcilePawnHealth(world,pawn,undefined,true,true);
   if(changed)disturbanceEvents(world).damage(pawn,world.tick*10,wasLying);
  }
 }
 return !thick||pawn.state==='dead'&&destroyRetainedHumanBody256(world,pawn);
}
function hitAnimal(world:World,animal:WildAnimal,amount:number,thick:boolean):boolean {
 if(!world.wildlife?.animals.includes(animal))return true;
 if(animal.state==='dead'&&!thick)return damageRetainedAnimalBody256(world,animal,amount);
 if(animal.state!=='dead'){advanceAnimalHealth(world,animal);if(!animal.health?.death){const record=structuredClone(animal.health??createAnimalMedicalRecord256(world,animal)),random={rng:world.rng};hitRecord(record,amount,()=>healthRandom(random),thick);commitAnimalImpact(world,animal,record,random,world.tick*10,undefined,true);}}
 // The shared impact can legitimately replace a dead owner (e.g. explosive
 // animal). Never retire a different body with the same lookup index.
 return !thick||!world.wildlife?.animals.includes(animal)||animal.state==='dead'&&destroyRetainedAnimalBody256(world,animal);
}
function hitMecha(world:World,mecha:Mechanoid,amount:number,thick:boolean):boolean {
 if(!world.mechanoids?.includes(mecha))return true;
 if(mecha.state==='dead'&&!thick)return damageRetainedMechanoidBody256(world,mecha,amount);
 if(mecha.state!=='dead'&&!mecha.health?.death){const record=structuredClone(mecha.health??createMechaMedicalRecord(world.tick,mecha.mechKind)),random={rng:world.rng};record.tick=world.tick;hitRecord(record,amount,()=>healthRandom(random),thick);if(!commitMechanoidImpact(world,mecha,record,random,world.tick*10))return false;}
 return !thick||mecha.state==='dead'&&destroyRetainedMechanoidBody256(world,mecha);
}
/** Two real passes for thick leaving rock, one for thin. Phase two (rubble and
 * vanished roof) is performed by roofing only after ALL phase-one cells. */
export function damageNaturalRoofCell256(world:World,index:number,thick:boolean,atCore=world.tick*10):void {
 if(world.schemaVersion<256)throw Error('Natural collapse in historical world');
 for(let pass=0;pass<(thick?2:1);pass++)for(const target of targets(world,index)){
  const amount=thick?99999:15+Math.floor(healthRandom(world)*16);let ok=true;
  switch(target.kind){
   case 'starting-pod':if(landedStartingPods256(world).includes(target.value))ok=damageStartingPod256(world,target.value,amount,atCore);break;
   case 'rock':if(world.tiles[target.index]===target.value)ok=damageRoofMineable256(world,target.index,target.value,amount,thick);break;
   case 'frame':if(world.jobs.includes(target.value))ok=damageFrameFromRoof256(world,target.value,amount,thick);break;
   case 'human':ok=hitHuman(world,target.value,amount,thick);break;
   case 'animal':ok=hitAnimal(world,target.value,amount,thick);break;
   case 'mecha':ok=hitMecha(world,target.value,amount,thick);break;
   case 'pile':if(world.piles.includes(target.value)&&(thick||pileMaxHp(target.value,world.schemaVersion)>0))ok=damagePile(world,target.value,amount,thick?'roof-thick':'roof');break;
   case 'resource':if(world.resources.includes(target.value)&&resourceMaxHp(target.value)>0)ok=damageResource(world,target.value,amount,'roof');break;
   case 'structure':if(world.structures.includes(target.value)||world.packed.some(p=>p.building===target.value)){
    if(thick||structureMaxHp(target.value)>0)ok=damageStructure(world,target.value,amount,thick?'roof-thick':'roof');
   }break;
  }
  if(!ok)throw Error('Roof collapse physical retirement refused; no leaving rock may be installed');
 }
}
