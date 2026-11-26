import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {groupPhysicalPawns256} from './group-mixed-pawns-256.ts';
import {caravanPawnCapacityGrams256} from './group-animal-capacity-256.ts';
import {planetTile} from './planet-geography-256.ts';
import type {Pawn,World} from './types.ts';
import type {AwayGroup} from './group-capture.ts';
import {LOCAL_BIOME_DATA_256} from './local-biome-data-v256.ts';
import {effectiveSkillLevel} from './work-types.ts';
import {backgroundSkillRefusal} from './colonist-backgrounds.ts';
import {pawnBody} from './health-rules.ts';
import {hasMentalBreak} from './mental-state.ts';
import {groupPlayerOwner256} from './group-route-interval-256.ts';
import {groupHashOffset256} from './group-core-cadence-256.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {freshRot,mergeRot} from './food-preservation.ts';
import {mergeThingDamage} from './thing-damage-rules.ts';
import {mergePileContamination} from './pile-condition.ts';
import {captureProspectiveGroupMass256,GROUP_FORAGED_MASS_256,type GroupWithTravelPacked256} from './group-caravan-mass-256.ts';
import {validGroupForageRevision256,type GroupForageRevision256,type GroupForagedItem256} from './group-forage-state-256.ts';
const f=Math.fround;
export type GroupForageOwner256=GroupWithTravelPacked256&{travel:{revision:1;tickDelta:number;forage:GroupForageRevision256}};
export interface GroupForageContext256 {
 coreTick:number;deltaCore:number;movingNow:boolean;nightResting:boolean;
 /** Previous carry tracker, because Core forage precedes its recalculation. */
 carriedBefore:ReadonlySet<number>;
 playerDef:'PlayerColony'|'PlayerTribe';rotRate:number;availablePileSlots:number;
 random():number;integer(min:number,maxExclusive:number):number;
}
export interface GroupForagedTransfer256 {createdPileId:number;carrierId:number;item:GroupForagedItem256;quantity:number;retainedPileId:number|null;merged:{pileId:number;absorbedPileId:number;quantity:number}[]}
function biomeFood(g:AwayGroup,w:World):{item:GroupForagedItem256|null;factor:number} {
 const key=w.planet?planetTile(w.planet,g.tile)?.biome:undefined;if(!key||!Object.hasOwn(LOCAL_BIOME_DATA_256,key))throw Error('Unknown caravan forage biome');
 const value=LOCAL_BIOME_DATA_256[key as keyof typeof LOCAL_BIOME_DATA_256].scalars,food=value.foragedFood;
 if(food!==null&&food!=='RawBerries'&&food!=='RawAgave')throw Error('Unbound caravan forage product');
 return {item:food===null?null:food==='RawBerries'?'berries':'agave-fruit',factor:value.forageability};
}
export function groupForagedNutritionPerDay256(p:Pawn,carried:ReadonlySet<number>):number {
 if(!groupPlayerOwner256(p)||p.state==='downed'||hasMentalBreak(p)||carried.has(p.id)||backgroundSkillRefusal(p,'plants'))return 0;
 const body=pawnBody(p).capacities,level=effectiveSkillLevel(p,'plants',p.skills.plants?.level??0);
 let value=f(f(.09)*level);value=f(value+f(f(f(value*Math.min(1,f(body.manipulation)))-value)*f(.5)));
 value=f(value+f(f(f(value*f(body.sight))-value)*f(.9)));return Math.max(0,value);
}
/** One actual collection receipt. No World clone/map grid or stock projection
 * is used to mint food; originals join g.items and the global Thing namespace. */
export function advanceGroupForage256(w:World,g:GroupForageOwner256,c:GroupForageContext256):readonly GroupForagedTransfer256[] {
 if(w.schemaVersion<256||w.group!==g||!validGroupForageRevision256(g.travel.forage)||!Number.isSafeInteger(c.coreTick)||c.coreTick<0||!Number.isSafeInteger(c.deltaCore)||c.deltaCore<1||c.deltaCore>16||!['PlayerColony','PlayerTribe'].includes(c.playerDef)||!Number.isSafeInteger(c.availablePileSlots)||c.availablePileSlots<0||!Number.isFinite(c.rotRate)||c.rotRate<0||c.rotRate>1)throw Error('Invalid caravan forage authority');
 let phase=(((c.coreTick|0)+groupHashOffset256(g.id))|0)%15;if(phase<0)phase+=15;if(phase>=c.deltaCore)return [];
 const rate=f(f(.0001)*(!c.movingNow&&!c.nightResting?2:1)),progress=f(g.travel.forage.progress+f(15*rate));
 if(progress<1){g.travel.forage.progress=progress;return [];}
 const {item,factor}=biomeFood(g,w);if(item===null){g.travel.forage.progress=0;return [];}
 let sum=0;for(const p of g.members)sum=f(sum+groupForagedNutritionPerDay256(p,c.carriedBefore));
 let count=f(sum/6);count=f(count*f(factor));count=f(count*f(c.playerDef==='PlayerTribe'?1.7:1));count=f(count/f(ITEM_DEFINITIONS[item].nutrition/100));
 if(!Number.isFinite(count)||count<0)throw Error('Invalid forage yield');
 const mass=captureProspectiveGroupMass256(g,w.schemaVersion);if(!mass)throw Error('Invalid caravan forage mass');
 const allowed=Math.max(0,Math.floor(f(f((mass.capacityGrams-mass.grams)/1000)/f(GROUP_FORAGED_MASS_256[item]/1000))));
 const maximum=Math.min(Math.ceil(count),allowed),stacks=Math.ceil(maximum/ITEM_DEFINITIONS[item].stackLimit);
 if(stacks>c.availablePileSlots||!Number.isSafeInteger(w.nextId+stacks*(1+g.items.length))||!Number.isSafeInteger(g.travel.forage.gathered[item]+maximum))throw Error('Caravan forage namespace exhausted');
 const draw=c.random();if(!Number.isFinite(draw)||draw<0||draw>=1)throw Error('Invalid forage random draw');
 let remaining=Math.min(Math.floor(count)+(draw<f(count-Math.floor(count))?1:0),allowed);
 const receipt:GroupForagedTransfer256[]=[],byId=new Map(mass.carriers.map(p=>[p.pawnId,{...p}]));
 while(remaining>0){
  const quantity=Math.min(remaining,ITEM_DEFINITIONS[item].stackLimit),all=groupPhysicalPawns256(g),capable=all.filter(p=>caravanPawnCapacityGrams256(p)>0),eligible=capable.filter(p=>byId.get(p.id)!.grams<=byId.get(p.id)!.capacityGrams),candidates=eligible.length?eligible:capable.length?capable:all;
  const index=c.integer(0,candidates.length);if(!Number.isSafeInteger(index)||index<0||index>=candidates.length)throw Error('Invalid forage carrier draw');
  const carrier=candidates[index]!,id=w.nextId++,line:GroupForagedTransfer256={createdPileId:id,carrierId:carrier.id,item,quantity,retainedPileId:null,merged:[]};let left=quantity;
  for(const target of g.items){if(!left)break;if(target.item!==item||target.owner.type!=='inventory'||target.owner.pawnId!==carrier.id)continue;
   const moved=Math.min(left,ITEM_DEFINITIONS[item].stackLimit-target.quantity);if(moved<=0)continue;
   const absorbedPileId=moved<left?w.nextId++:id;
   mergePileContamination(target,moved);mergeThingDamage(target,moved);mergeRot(target,moved,0,w.tick);markPileContentWrite379(target).quantity+=moved;left-=moved;line.merged.push({pileId:target.id,absorbedPileId,quantity:moved});
  }
  if(left){g.items.push({id,kind:'food',item,quantity:left,owner:{type:'inventory',pawnId:carrier.id},...freshRot(item,w.tick)});const created=g.items.at(-1)!;if(created.rot&&c.rotRate!==1)created.rot.rate=c.rotRate;line.retainedPileId=id;}
  byId.get(carrier.id)!.grams+=quantity*GROUP_FORAGED_MASS_256[item];remaining-=quantity;g.travel.forage.gathered[item]+=quantity;receipt.push(line);
 }
 g.travel.forage.progress=0;if(receipt.length){const units=receipt.reduce((n,r)=>n+r.quantity,0);w.events.push({tick:w.tick,type:'need',message:`La caravane a récolté ${units} ${ITEM_DEFINITIONS[item].label}.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
 return receipt;
}
