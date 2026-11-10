import {assignPileOwner} from './pile-index.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {captureStartingPlacePhysics256} from './starting-place-physics-256.ts';
import {findStartingPlaceNear256,planStartingPlaceDirect256,type StartingPlaceThing256} from './starting-place-near-256.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {canMergeEggPile256} from './animal-egg-permission-v256.ts';
import {mergePileContamination,mergePileEgg256} from './pile-condition.ts';
import {mergeThingDamage,pileMaxHp} from './thing-damage-rules.ts';
import {mergeRot,rotAge} from './food-preservation.ts';
import type {CoreStartingArrivalPending256} from './starting-pod-state-256.ts';
import type {World,MaterialPile,Cell} from './types.ts';

/** Creation-only GenPlace consumer, over the ACTUAL unpublished map and its
 * real arrival owner. This is not an atomic transaction on a running campaign:
 * the factory discards the entire unpublished candidate on an exception. */
export function captureStartingGeneratedPlacement256(world:World,arrival:CoreStartingArrivalPending256,center:Readonly<Cell>){
 if(!isSchema256Or257(world.schemaVersion)||world.tick!==0||world.site?.revision!==3||world.startingArrival!==arrival)throw Error('Starting placement requires its actual unpublished map');
 const ground=new Map<number,MaterialPile[]>();
 for(const p of world.piles)if(p.owner.type==='ground'){const i=p.owner.z*world.width+p.owner.x,list=ground.get(i)??[];list.push(p);ground.set(i,list);}
 const read=captureStartingPlacePhysics256(world,arrival,center,ground,[]);
 return (source:MaterialPile):void=>{
  if(world.piles.some(p=>p.id===source.id)||!Number.isSafeInteger(source.id)||source.id<1||source.id>=world.nextId)throw Error('Generated Thing has no unique allocated identity');
  const limit=ITEM_DEFINITIONS[source.item].stackLimit;
  for(;;){
   const thing:StartingPlaceThing256={id:source.id,quantity:source.quantity,stackLimit:limit,category:'item',downed:false,saveCompressible:false},cell=findStartingPlaceNear256(center,thing,c=>read(c,thing,source));
   if(!cell)throw Error('Actual starting scatter GenPlace.Near exhausted');
   const key=cell.z*world.width+cell.x,targets=(ground.get(key)??[]).slice().sort((a,b)=>b.quantity-a.quantity),
    plan=planStartingPlaceDirect256(thing,read(cell,thing,source),targets.map(p=>({id:p.id,quantity:p.quantity,stackLimit:ITEM_DEFINITIONS[p.item].stackLimit,compatible:p.item===source.item&&canMergeEggPile256(p,source)})),world.nextId);
   const before=source.quantity;world.nextId=plan.nextId;
   for(const op of plan.operations){
    if(op.kind==='absorb'){
     const target=targets.find(p=>p.id===op.targetId)!;
     mergePileEgg256(target,op.quantity,source.egg);mergePileContamination(target,op.quantity,source.foodPoison);mergeThingDamage(target,op.quantity,source.damage,pileMaxHp(target,256));mergeRot(target,op.quantity,rotAge(source,0),0);target.quantity+=op.quantity;
    }else {
     const next:MaterialPile=op.split?{...structuredClone(source),id:op.id,quantity:op.quantity,owner:{type:'ground',...cell}}:source;
     next.quantity=op.quantity;assignPileOwner(next,{type:'ground',...cell});world.piles.push(next);const list=ground.get(key)??[];list.push(next);ground.set(key,list);
    }
   }
   // The source is the last spawned original, or an unspawned remainder. An
   // entirely absorbed source retires; it never becomes a second map owner.
   if(plan.complete)return;
   source.quantity=plan.remaining;if(source.quantity===before)throw Error('Starting scatter placement made no progress');
  }
 };
}
