import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {footprintCells} from './definitions.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import type {World,Cell} from './types.ts';
import type {AncientRect256} from './local-ancient-placement-256.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {tradeCatalogueEntry} from './trade-catalogue.ts';
import {freshRot} from './food-preservation.ts';
import {newWeaponState} from './equipment-rules.ts';
import {newApparelState} from './apparel-rules.ts';
import type {MaterialPile} from './types.ts';

/** Original Elsewhere reward content, restricted to current original items.
 * This is an explicit content adaptation, not Reward_ItemsStandard's full
 * catalogue or its internal selection distribution. Value/stack/condition
 * rules remain those of the existing actual item constructors. */
const STASH_ITEMS:readonly ItemId[]=['silver','gold','plasteel','component','advanced-component','medicine','glitterworld-medicine','survival-meal','cloth','bolt-action-rifle','flak-vest'];
const VALUE_CURVE=[[300,800],[700,1500],[5000,4000]] as const;
export function itemStashValue263(points:number):number {
 if(!Number.isFinite(points)||points<0)throw Error('Invalid actual quest points');
 if(points<=300)return 800;
 for(let i=1;i<VALUE_CURVE.length;i++){const a=VALUE_CURVE[i-1]!,b=VALUE_CURVE[i]!;if(points<=b[0])return a[1]+(b[1]-a[1])*(points-a[0])/(b[0]-a[0]);}
 return 4000;
}
/** Pure draft. Only real autoaccepted quest birth commits these new originals.
 * The holder never ticks its contents; these food clocks are frozen until
 * their true map transfer, where the existing item-clock shifter is applied.
 * No arrival, reload or failed generation may call this producer again. */
function draftOriginalTargetGoods263(siteId:number,nextId:number,points:number,tick:number,rng:number,ground?:readonly Cell[],version:number=263):{items:MaterialPile[];nextId:number;rng:number;targetValue:number}|null {
 if(![siteId,nextId].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(tick)||tick<0||!Number.isInteger(rng)||rng<=0||rng>0xffffffff)return null;
 const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;return rng/4294967296;};
 const targetValue=ground?1800:itemStashValue263(points)*(.7+.6*random()),items:MaterialPile[]=[];let remaining=targetValue;
 // At most one actual stack per selection. Stop instead of awarding a more
 // expensive replacement when the remaining value cannot buy its first unit.
 for(let count=0;count<Math.min(25,ground?.length??25)&&remaining>=1;count++){
  const pool=STASH_ITEMS.filter(item=>tradeCatalogueEntry(item)!.baseMarketValue<=remaining);if(!pool.length)break;
  const item=pool[Math.floor(random()*pool.length)]!,def=ITEM_DEFINITIONS[item],unit=tradeCatalogueEntry(item)!.baseMarketValue;
  const maximum=Math.min(def.stackLimit,Math.floor(remaining/unit)),quantity=maximum===1?1:1+Math.floor(random()*maximum);
  if(!Number.isSafeInteger(nextId+1))return null;
  const frozen=freshRot(item,tick);if(!ground&&frozen.rot)frozen.rot.rate=0;
  const pile:MaterialPile={id:nextId++,kind:def.kind,item,quantity,owner:ground?{type:'ground',...ground[count]!}:{type:'world-site263',siteId},...frozen,
   ...def.kind==='weapon'?{weapon:newWeaponState(item as Parameters<typeof newWeaponState>[0])}:{},
   ...def.kind==='apparel'?{apparel:newApparelState(item as Parameters<typeof newApparelState>[0],undefined,version)}:{}};
  items.push(pile);remaining-=quantity*unit;
 }
 return items.length?{items,nextId,rng,targetValue}:null;
}

export function draftItemStashGoods263(siteId:number,nextId:number,points:number,tick:number,rng:number,version:number=263){return draftOriginalTargetGoods263(siteId,nextId,points,tick,rng,undefined,version);}
/** Fixed paid-information original. No reward lottery and no off-map duplicate. */
export function draftAiCoreSiteGoods298(siteId:number,nextId:number,rng:number,version:number):{items:MaterialPile[];nextId:number;rng:number;targetValue:number}|null {
 if(!isSchema298OrLater(version)||![siteId,nextId].every(n=>Number.isSafeInteger(n)&&n>0)||!Number.isSafeInteger(nextId+1)||!Number.isInteger(rng)||rng<=0||rng>0xffffffff)return null;
 const def=ITEM_DEFINITIONS['ai-core'];if(!def||def.kind!=='ai-core'||def.stackLimit!==1)return null;
 return {items:[{id:nextId,kind:'ai-core',item:'ai-core',quantity:1,owner:{type:'world-site263',siteId}}],nextId:nextId+1,rng,targetValue:4000};
}
/** Default Settlement loot value1800, original current content adaptation.
 * New local Things are created only by a true fresh base generation. Re-entry
 * recalls the same retained people; it never copies their gear as loot. */
export function generateForeignBaseLoot263(w:World,settlementId:number,storage:AncientRect256,rng:number):void {
 const tileId=w.site?.revision===3?w.site.tileId:undefined;
 if(!isSchema263OrLater(Number(w.schemaVersion))||tileId===undefined||!w.worldFactions?.settlements.some(s=>s.id===settlementId&&s.tile===tileId))throw Error('Actual foreign base loot parent required');
 const physical=captureActualLocalDistricts256(w),occupied=new Set(w.structures.flatMap(s=>footprintCells(s).map(c=>c.z*w.width+c.x))),cells:Cell[]=[];
 for(let z=storage.minZ+1;z<storage.maxZ;z++)for(let x=storage.minX+1;x<storage.maxX;x++){const c=z*w.width+x;if(physical.standable(c)&&!occupied.has(c)&&!w.resources.some(r=>r.x===x&&r.z===z)&&!w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z))cells.push({x,z});}
 const goods=draftOriginalTargetGoods263(settlementId,w.nextId,0,w.tick,rng,cells,w.schemaVersion);if(!goods)throw Error('No physical storage capacity for the actual base loot');w.piles.push(...goods.items);w.nextId=goods.nextId;
}
