import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Actual KillFinalize leavings, reused by the ordinary structure transaction.
 * No recipe-quarter refund is invented for Hive or GlowPod. */
import {addFilth} from './filth.ts';
import {groundCapacity,planGroundPlacement} from './ground-placement.ts';
import {materialAllowedForPlayer256,setMaterialForbidden256} from './material-permission-256.ts';
import {shipChunkNextRandom256} from './ship-chunk-leavings-256.ts';
import {mergeThingDamage} from './thing-damage-rules.ts';
import type {ItemId} from './items.ts';
import type {Cell,MaterialPile,Structure,World} from './types.ts';
export interface HiveKilledProduct256 {id:number;targetId:number|null;before:number;quantity:number;cell:Cell;forbidden:boolean}
export function planCaveHiveKill256(w:World,s:Structure,at:Cell,rng:number,spawned:boolean){
 if(!isSchema256Or257(w.schemaVersion)||s.kind!=='insect-hive'&&s.kind!=='glow-pod')throw Error('Actual Hive/GlowPod kill required');
 if(!spawned)return {rng,drops:[],returned:new Map<ItemId,number>(),hiveProducts:[] as HiveKilledProduct256[],rubble:undefined};
 const view:World={...w,piles:w.piles.map(p=>({...p,owner:{...p.owner}})),filth:w.filth?{...w.filth,items:w.filth.items.map(f=>({...f}))}:undefined};
 // BuildingNaturalBase really leaves Filth_RubbleRock, including GlowPod.
 let next=shipChunkNextRandom256(rng);rng=next.rng;addFilth(view,at,'rock-rubble',1+Math.abs((rng|0)%3));
 // MakeThing occurs under PushState(ThingID), but allocates from the REAL
 // Thing allocator. Fixed Jelly30/killedLeavingsChance1 consumes no outer Rand.
 const productId=s.kind==='insect-hive'?view.nextId++:undefined;if(!Number.isSafeInteger(view.nextId))return null;
 // leavingsRect is the actual1×1. InRandomOrder materializes even this singleton.
 next=shipChunkNextRandom256(rng);rng=next.rng;
 const products:HiveKilledProduct256[]=[];
 if(productId!==undefined){
  const forbidden=!(w.home??[]).includes(at.z*w.width+at.x);
  const placement:World={...view,piles:view.piles.map(p=>p.item==='insect-jelly'&&materialAllowedForPlayer256(p)===forbidden?{...p,quantity:75}:p)};
  const parts=groundCapacity(placement,at,'insect-jelly')>=30?[{cell:at,quantity:30}]:planGroundPlacement(placement,30,at,'insect-jelly');if(!parts)return null;
  let remaining=30;
  for(const part of parts){
   if(part.quantity<1||part.quantity>remaining||part.quantity<remaining&&!Number.isSafeInteger(view.nextId+1))return null;
   // SplitOff(partial) allocates; the last whole remainder keeps the original.
   const id=part.quantity===remaining?productId:view.nextId++,target=view.piles.find(p=>p.item==='insect-jelly'&&p.owner.type==='ground'&&p.owner.x===part.cell.x&&p.owner.z===part.cell.z&&materialAllowedForPlayer256(p)!==forbidden&&p.quantity+part.quantity<=75);
   if(!target&&view.piles.length>=32768)return null;
   products.push({id,targetId:target?.id??null,before:target?.quantity??0,quantity:part.quantity,cell:part.cell,forbidden});
   if(target){mergeThingDamage(target,part.quantity,0,60);markPileContentWrite379(target).quantity+=part.quantity;}
   else{const p:MaterialPile={id,kind:'food',item:'insect-jelly',quantity:part.quantity,owner:{type:'ground',...part.cell}};setMaterialForbidden256(p,forbidden);appendPileEntries(view.piles,p);}
   remaining-=part.quantity;
  }
  if(remaining)return null;
 }
 return {rng,drops:[],returned:new Map<ItemId,number>(),hiveProducts:products,rubble:{rng,nextId:view.nextId,filth:view.filth}};
}
/** All allocator holes were reserved by the common preflight/rubble header.
 * Commit neither creates another ID nor converts leavings into abstract stock. */
export function commitHiveKilledProducts256(w:World,rows:readonly HiveKilledProduct256[]):void {
 for(const row of rows){
  if(row.targetId!==null){const target=w.piles.find(p=>p.id===row.targetId&&p.item==='insect-jelly'&&p.owner.type==='ground'&&p.owner.x===row.cell.x&&p.owner.z===row.cell.z);if(!target||target.quantity!==row.before||materialAllowedForPlayer256(target)===row.forbidden)throw Error('Preflighted actual Jelly merge changed');mergeThingDamage(target,row.quantity,0,60);markPileContentWrite379(target).quantity+=row.quantity;}
  else{if(w.piles.some(p=>p.id===row.id))throw Error('Preflighted actual Jelly identity reused');const p:MaterialPile={id:row.id,kind:'food',item:'insect-jelly',quantity:row.quantity,owner:{type:'ground',...row.cell}};setMaterialForbidden256(p,row.forbidden);appendPileEntries(w.piles,p);}
 }
}
