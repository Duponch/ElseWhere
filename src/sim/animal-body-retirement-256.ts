import {filterPileEntries} from './pile-identity-directory.ts';
import type {World,MaterialPile} from './types.ts';
import {prepareLinkedShelfRetirement286} from './linked-storage-lifecycle-286.ts';
import {animalContentsOwner256} from './animal-local-contents-256.ts';
import {neutralLossPlan} from './destruction-losses.ts';
import {ensureFireState} from './fire-rules.ts';
import {constructionRecipe,type ConstructionMaterial} from './construction-materials.ts';
import {prepareBedOwnershipTransition256} from './actor-bed-transition-256.ts';
export interface AnimalBodyRetirement256 {readonly pileIds:ReadonlySet<number>;current():boolean;commit():boolean}
/** Physical contents only. Caller owns body consumption/product counters.
 * includeBody is true for destruction/cremation, false for recipe/ingestion. */
export function planAnimalBodyRetirement256(w:World,id:number,includeBody:boolean,cause:'fire'|'neutral'='neutral'):AnimalBodyRetirement256|null {
 return planAnimalContentsRetirement256(w,id,includeBody,cause,false);
}
/** Skyfaller.Destroy destroys held contents. The living original is removed by
 * the caller only after this same preflight commits; no corpse is created. */
export function planHeldDuckContentsRetirement256(w:World,id:number):AnimalBodyRetirement256|null {
 const owner=animalContentsOwner256(w,id);if(owner?.kind!=='animal'||owner.animal.species!=='duck'||owner.animal.state==='dead'||owner.animal.health?.death||!owner.holder)return null;
 return planAnimalContentsRetirement256(w,id,false,'neutral',true);
}
function planAnimalContentsRetirement256(w:World,id:number,includeBody:boolean,cause:'fire'|'neutral',allowHeldDuck:boolean):AnimalBodyRetirement256|null {
 if(w.schemaVersion<256)return null;const owner=animalContentsOwner256(w,id);if(!owner||owner.kind==='animal'&&!(allowHeldDuck&&owner.holder&&owner.animal.species==='duck')&&(owner.animal.state!=='dead'||!owner.animal.health?.death))return null;
 const body=owner.kind==='corpse'?owner.pile:undefined,items=w.piles.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===id||includeBody&&p===body),packs=w.packed.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===id),delta:Partial<Record<MaterialPile['item'],number>>={};
 for(const p of items){if(!Number.isSafeInteger(p.quantity)||p.quantity<1)return null;delta[p.item]=(delta[p.item]??0)+p.quantity;if(!Number.isSafeInteger(delta[p.item]))return null;}
 if(includeBody&&!body){const a=owner.kind==='animal'?owner.animal:undefined;if(!a)return null;const item=importedCorpseItem(a.species);delta[item]=(delta[item]??0)+1;}
 if(!items.length&&!packs.length&&!includeBody){let done=false;return {pileIds:new Set(),current:()=>!done,commit(){if(done)return false;done=true;return true;}};}
 const beforeDestroyed=w.destroyed,beforeFire=w.fires,destroyedSignature=JSON.stringify(w.destroyed),fireSignature=JSON.stringify(w.fires),piles=w.piles,packed=w.packed,lost={...w.destroyed?.lost},count=(w.destroyed?.count??0)+packs.length;
 if(!Number.isSafeInteger(count))return null;for(const pack of packs)for(const cost of constructionRecipe(pack.building).ingredients){const item=cost.item as ConstructionMaterial|'component';lost[item]=(lost[item]??0)+cost.quantity;if(!Number.isSafeInteger(lost[item]))return null;}
 const neutral=cause==='fire'?undefined:neutralLossPlan(w,{items:delta});if(neutral===null)return null;
 if(cause==='fire'){for(const [item,n] of Object.entries(delta))if(!Number.isSafeInteger((w.fires?.ledger.items[item as MaterialPile['item']]??0)+n!))return null;if(!Number.isSafeInteger((w.fires?.ledger.structures??0)+packs.length))return null;}
 const beds=packs.map(p=>prepareBedOwnershipTransition256(w,p.building,'destroy')),pileIds=new Set(items.map(p=>p.id)),packSet=new Set(packs),signatures=items.map(p=>JSON.stringify(p)),packSignatures=packs.map(p=>JSON.stringify(p));
 const linked=prepareLinkedShelfRetirement286(w,packs.map(p=>p.building));if(!linked.ok)return null;
 const current=()=>{const actual=animalContentsOwner256(w,id);return linked.current()&&!!actual&&actual.kind===owner.kind&&(actual.kind==='animal'&&owner.kind==='animal'?actual.animal===owner.animal&&actual.holder===owner.holder:actual.kind==='corpse'&&owner.kind==='corpse'&&actual.pile===owner.pile)&&w.piles===piles&&w.packed===packed&&w.destroyed===beforeDestroyed&&w.fires===beforeFire&&JSON.stringify(w.destroyed)===destroyedSignature&&JSON.stringify(w.fires)===fireSignature&&items.every((p,i)=>w.piles.includes(p)&&JSON.stringify(p)===signatures[i])&&packs.every((p,i)=>w.packed.includes(p)&&JSON.stringify(p)===packSignatures[i]);};
 let committed=false;return {pileIds,current,commit(){if(committed||!current()||!linked.commit())return false;const ledger=cause==='fire'?ensureFireState(w).ledger:undefined;
  if(ledger){for(const [item,n]of Object.entries(delta))ledger.items[item as MaterialPile['item']]=(ledger.items[item as MaterialPile['item']]??0)+n!;ledger.structures+=packs.length;}
  if(neutral)w.destroyed=neutral;if(packs.length)w.destroyed={...w.destroyed,count,lost};
  w.piles=filterPileEntries(w.piles,p=>!pileIds.has(p.id));w.packed=w.packed.filter(p=>!packSet.has(p));for(const b of beds)b?.commit();committed=true;return true;
 }};
}
import {animalCorpseItem as importedCorpseItem} from './corpses.ts';
