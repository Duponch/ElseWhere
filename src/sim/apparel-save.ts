import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {validApparelProvenance284} from './apparel-provenance-284.ts';
import {isSchema279OrLater} from './schema-compatibility-257.ts';
import {isOrdinaryApparel279} from './apparel-trade-279.ts';
import {isTextileApparelItem308} from './textile-apparel-308.ts';
import {validStartingApparelColor256} from './starting-apparel-color-256.ts';
import { V91_ITEM_IDS } from './biome-items.ts';
import {isCoreStartingApparel256} from './starting-gear-256.ts';
import { V120_ANIMAL_PRODUCT_ITEMS } from './animal-product-items.ts';
import { adjacent } from './pathfinding.ts';
import { APPAREL,apparelDefinition,conflictsWith,isApparelItem,newApparelState,type ApparelItem } from './apparel-rules.ts';
import { WEAPON_QUALITIES } from './equipment-rules.ts';
import {isSmithingApparel267} from './smithing-apparel-267.ts';
import type { MaterialPile,World } from './types.ts';

const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const capturedApparel=(item:ApparelItem,version:number):MaterialPile=>({id:0,kind:'apparel',item,quantity:1,owner:{type:'ground',x:0,z:0},apparel:newApparelState(item,undefined,version)});
const capturedApparelCandidates=(version:number):MaterialPile[]=>{
  const seen=new Set<string>(),out:MaterialPile[]=[];
  for(const item of Object.keys(APPAREL) as ApparelItem[]){
    if(version<267&&isSmithingApparel267(item))continue;
    if(version<256&&isCoreStartingApparel256(item))continue;
    const historical=item==='flak-vest'||item==='cloth-shirt'||version>=72&&item==='cloth-tribalwear';
    if(version<90&&!historical||version<91&&V91_ITEM_IDS.includes(item)||version<120&&V120_ANIMAL_PRODUCT_ITEMS.includes(item)||version<141&&item==='flak-helmet'||version<148&&item==='recon-helmet'||version<241&&item==='recon-armor'||version<245&&item.endsWith('-tuque')||version<178&&item.startsWith('foxfur-')||version<308&&isTextileApparelItem308(item))continue;
    const key=APPAREL[item].family??item;
    if(seen.has(key))continue;
    seen.add(key);out.push(capturedApparel(item,version));
  }
  return out;
};
export function validApparelShape(p:Record<string,unknown>,version:number):boolean {
  if(p.kind!=='apparel')return p.apparel===undefined;
  const a=p.apparel;
  if(version<63||typeof p.item!=='string'||!Object.hasOwn(APPAREL,p.item)||!record(a))return false;
  if(!validApparelProvenance284(a,version))return false;
  const item=p.item as ApparelItem,definition=APPAREL[item];
  if(version<267&&isSmithingApparel267(item))return false;
  if(!validStartingApparelColor256(a,item,version))return false;
  if(version<256&&isCoreStartingApparel256(item))return false;
  const historical=item==='flak-vest'||item==='cloth-shirt'||version>=72&&item==='cloth-tribalwear';
  if(version<90&&!historical||version<91&&V91_ITEM_IDS.includes(item)||version<120&&V120_ANIMAL_PRODUCT_ITEMS.includes(item)||version<141&&item==='flak-helmet'||version<148&&item==='recon-helmet'||version<241&&item==='recon-armor'||version<245&&item.endsWith('-tuque')||version<178&&item.startsWith('foxfur-')||version<308&&isTextileApparelItem308(item))return false;
  return Object.keys(a).every(k=>['quality','hitPoints','forbidden',...(version>=90?['material','forced']:[]),...(isSchema256Or257(version)?['birthColor']:[]),...(isSchema284OrLater(version)?['corpseWear284']:[])].includes(k))
    &&typeof a.quality==='string'&&(WEAPON_QUALITIES as readonly string[]).includes(a.quality)
    &&typeof a.hitPoints==='number'&&Number.isInteger(a.hitPoints)&&a.hitPoints>0&&a.hitPoints<=definition.hitPoints
    &&(version<90?a.material===undefined:definition.material===undefined?a.material===undefined:a.material===definition.material)
    &&(a.forbidden===undefined||a.forbidden===true)&&(a.forced===undefined||a.forced===true)
    // Ordinary garments gain inventory custody only in279; the three remaining
    // carried armor types join in284. Actual custodian and holder membership
    // remain the owning domain's responsibility.
    &&!(a.forbidden===true&&a.forced===true)&&p.quantity===1&&record(p.owner)&&typeof p.owner.type==='string'&&['ground','pawn','apparel',...(isSchema279OrLater(version)&&isOrdinaryApparel279(item)||version>=241&&item==='recon-armor'||version>=267&&isSmithingApparel267(item)||isSchema284OrLater(version)&&['flak-vest','flak-helmet','recon-helmet'].includes(item)?['inventory']:[]),...(version>=231?['starting-pod']:[]),...(isSchema284OrLater(version)?['trade-request284']:[])].includes(p.owner.type)
    &&(a.forced===undefined||p.owner.type==='apparel');
}
export function validateApparel(world:World,version:number=world.schemaVersion):string[] {
  const errors:string[]=[];
  errors.push(...validateApparelOwners259(world.pawns,world.piles,version));
  for(const pawn of world.pawns){
    const t=pawn.equipmentTask;if(t?.action!=='wear'&&t?.action!=='remove')continue;
    const pile=world.piles.find(p=>p.id===t.itemId);if(!pile||!isApparelItem(pile.item)){errors.push('Missing apparel task target.');continue;}
    if(t.action==='wear'&&t.progress>0&&(pile.owner.type!=='ground'||!adjacent(pawn,pile.owner)&&(pawn.x!==pile.owner.x||pawn.z!==pile.owner.z)))errors.push('Dressing without physical contact.');
    const base=apparelDefinition(pile).equipTicks;
    // A replacement captures the exact work for the new garment plus every
    // incompatible piece that could have been worn when the order started.
    // Reconstruct those possibilities from the versioned catalogue: current
    // ground piles are transient and cannot prove what was initially worn.
    // Materials with the same family are equivalent for duration purposes.
    const candidates=capturedApparelCandidates(version).filter(other=>conflictsWith(other,pile));
    const sums=new Set<number>([base]);
    const visit=(index:number,chosen:MaterialPile[],sum:number):void=>{
      for(let i=index;i<candidates.length;i++){
        const other=candidates[i]!;
        if(chosen.some(existing=>conflictsWith(existing,other)))continue;
        const next=sum+apparelDefinition(other).equipTicks;
        sums.add(next);visit(i+1,[...chosen,other],next);
      }
    };
    visit(0,[],base);
    const durationValid=t.action==='wear'?sums.has(t.duration!):t.duration===base;
    if(!durationValid)errors.push('Invalid captured apparel duration.');
  }
  return errors;
}

/** Same actual worn-item rules, no active map task is fabricated. */
export function validateApparelOwners259(pawns:readonly {id:number}[],piles:readonly MaterialPile[],version:number):string[]{const errors:string[]=[],byPawn=new Map<number,MaterialPile[]>();
  for(const pile of piles)if(pile.owner.type==='apparel') {
    const id=pile.owner.pawnId,pawn=pawns.find(p=>p.id===id);
    if(!pawn||!isApparelItem(pile.item)||version<267&&isSmithingApparel267(pile.item)||pile.kind!=='apparel'||!pile.apparel||pile.apparel.forbidden||version>=90&&pile.apparel.material!==APPAREL[pile.item].material){errors.push('Invalid worn apparel owner.');continue;}
    const worn=byPawn.get(pawn.id)??[];
    if(worn.some(p=>conflictsWith(p,pile)))errors.push('Incompatible worn apparel.');
    worn.push(pile);byPawn.set(pawn.id,worn);
  }
return errors;}
