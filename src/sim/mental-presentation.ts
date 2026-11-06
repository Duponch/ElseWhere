import {knownCell256} from './exploration-visibility-256.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';
import { MENTAL_CRISIS_CATALOG,mentalCrisisLabel } from './mental-catalog.ts';
import { animalSpecies } from './animal-species.ts';
import { structureById } from './structure-navigation.ts';

export { mentalCrisisLabel } from './mental-catalog.ts';
export type MentalCrisisKind=keyof typeof MENTAL_CRISIS_CATALOG;

const descriptions:Readonly<Record<MentalCrisisKind,string>>={
  'sad-wander':'ne travaille plus et refuse les ordres. Cherche encore nourriture et sommeil en cas de besoin extrême.',
  'food-binge':'cherche à manger même rassasié, sans suivre son régime ; les repas restent physiques.',
  'drug-binge':'cherche de la bière sans suivre sa politique de drogues ; chaque prise exige une bière physique, un déplacement et le contact. Refuse les ordres sans devenir hostile.',
  'confused-wander':'se déplace sans but pendant un épisode de confusion lié à la santé.',
  tantrum:'Refuse les ordres et s’en prend aux bâtiments accessibles.',
  berserk:'Refuse les ordres et devient hostile à tous. Ne poursuit pas une victime à terre.',
  'murderous-rage':'Refuse les ordres et cherche à tuer sa cible, même à terre.',
};
export interface MentalTargetView {type:'pawn'|'animal'|'structure';id:number;cell:Cell;label:string}
export interface MentalCrisisView {
  kind:MentalCrisisKind;label:string;symbol:string;description:string;activity:string;
  target?:MentalTargetView;
}

/** Pure projection of a confirmed snapshot. No navigation, phase inference,
 * retargeting, random call or durable personal history is produced here. */
export function mentalCrisisView(world:World,pawn:Pawn,structureLabel?:(structure:Structure)=>string):MentalCrisisView|undefined {
  const crisis=pawn.mental?.crisis;if(!crisis)return;
  const kind=crisis.kind;
  let target:MentalTargetView|undefined;
  if(kind==='tantrum'&&crisis.targetId!==null){
    const structure=structureById(world,crisis.targetId);
    if(structure)target={type:'structure',id:structure.id,cell:{x:structure.x,z:structure.z},label:structureLabel?.(structure)??`Bâtiment ${structure.id}`};
  }else if((kind==='berserk'||kind==='murderous-rage')&&crisis.targetId!==null){
    const person=world.pawns.find(p=>p.id===crisis.targetId);
    if(person)target={type:'pawn',id:person.id,cell:{x:person.x,z:person.z},label:person.name};
    else if(kind==='berserk'){
      const animal=world.wildlife?.animals.find(a=>a.id===crisis.targetId);
      if(animal)target={type:'animal',id:animal.id,cell:{x:animal.x,z:animal.z},label:`${animalSpecies(animal.species).label} ${animal.id}`};
    }
  }
  const aggressive=kind==='tantrum'||kind==='berserk'||kind==='murderous-rage';
  const activity=!aggressive?'':pawn.interruptedCargo?'Cargaison conservée : attend un dépôt sûr.':pawn.melee?.strike?'Récupère après sa frappe.':pawn.path.length||pawn.moveCooldown>0?'Se déplace.':'';
  if(target&&!knownCell256(world,target.cell.z*world.width+target.cell.x))target=undefined;
  return {kind,label:mentalCrisisLabel(kind),symbol:aggressive?'!':'↝',description:descriptions[kind],activity,...target?{target}:{}};
}

export function mentalCrisisStatus(world:World,pawn:Pawn):string {
  const view=mentalCrisisView(world,pawn);if(!view)return '';
  const target=view.target?` Cible : ${view.target.label}${view.target.type==='structure'?` (${view.target.cell.x}, ${view.target.cell.z})`:''}.`:'';
  return `${view.label} : ${view.description}${target}${view.activity?` ${view.activity}`:''}`;
}
export const mentalCrisisRefusal=(pawn:Pawn):string=>pawn.mental?.crisis?`${mentalCrisisLabel(pawn.mental.crisis.kind)} : ce colon ne peut pas obéir pendant sa crise.`:'';
