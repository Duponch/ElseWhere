/** Reconstruct actual policy registries and their assignments. Core source
 * IDs are retained: labels may be translated or contain underscores, and are
 * not a reliable reference key by themselves. */
import type {Pawn} from '../../sim/types.ts';
import type {ImportContext} from './convert.ts';
import {referencedThingId,type RwsThing} from './rws-save.ts';
import {at,items,text,num,type XmlNode} from './xml.ts';
import {ITEM_MAP,APPAREL_MAP,QUALITY_MAP} from './map-items.ts';
import {isDropped} from './mapping.ts';
import {FOOD_ITEMS,type FoodPolicy,type FoodItemId,validPolicyName} from '../../sim/food-policy.ts';
import {APPAREL,type ApparelItem} from '../../sim/apparel-rules.ts';
import {APPAREL_POLICY_MATERIALS267,validApparelPolicy,type ApparelPolicy} from '../../sim/apparel-policy.ts';
import {WEAPON_QUALITIES} from '../../sim/equipment-rules.ts';
import {validBeerPolicy265,validDrugPolicyRegistry265,type DrugPolicy265,type BeerPolicy265} from '../../sim/alcohol-policy-265.ts';
import {validPenoxycylinePolicy337,type PenoxycylinePolicy337} from '../../sim/penoxycyline-337.ts';
type Human={thing:RwsThing;pawn:Pawn};
const policyId=(reference:string|undefined):number|undefined=>{
 const m=reference&&/_(\d+)$/.exec(reference);return m?Number(m[1]):undefined;
};
const defs=(filter:XmlNode|undefined)=>items(filter,'allowedDefs').map(d=>d.text.trim());
const validId=(v:number|undefined):v is number=>Number.isSafeInteger(v)&&v!>0&&v!<Number.MAX_SAFE_INTEGER-1;
const filterRange=(v:string|undefined):[number,number]=>{
 const m=v?.split('~').map(Number);return m?.length===2&&m.every(Number.isFinite)&&m[0]!>=0&&m[1]!<=1&&m[0]!<=m[1]!?[m[0]!,m[1]!]:[0,1];
};
const safeRegistry=<T extends {id:number}>(rows:T[],base:readonly T[]):T[]=>{
 // Generated external identities keep their mandatory default policy ID 1.
 // Preserve it only when the actual source registry no longer contains it.
 const unique=rows.filter((r,i)=>rows.findIndex(v=>v.id===r.id)===i).slice(0,32);
 if(!unique.some(r=>r.id===1)&&base.some(r=>r.id===1)){
  if(unique.length===32)unique.pop();
  unique.push(structuredClone(base.find(r=>r.id===1)!));
 }
 return unique;
};
const nextId=(rows:readonly {id:number}[])=>Math.max(1,...rows.map(r=>r.id))+1;
function sourceFood(ctx:ImportContext):FoodPolicy[] {
 const rows:FoodPolicy[]=[];
 for(const policy of items(ctx.save.game,'foodRestrictionDatabase/foodRestrictions')){
  const id=num(policy,'id'),name=text(policy,'label'),filter=at(policy,'filter');if(!validId(id)||!validPolicyName(name)||!filter)continue;
  const allowed=new Set<FoodItemId>();
  let omitted=0,adapted=0;
  for(const d of defs(filter)){
   const m=ITEM_MAP[d];if(!m||isDropped(m)||!(FOOD_ITEMS as readonly string[]).includes(m.to)){omitted++;continue;}
   if('adapt' in m)adapted++;allowed.add(m.to as FoodItemId);
  }
  rows.push({id,name,allowed:[...allowed]});
  const special=items(filter,'disallowedSpecialFilters').length;
  ctx.notes.def('policies',`Nourriture : ${name}`,omitted||adapted||special?'adapted':'exact',`${allowed.size} aliments`,omitted||adapted||special?`${omitted} définitions sans équivalent alimentaire, ${adapted} adaptées, ${special} filtres spéciaux non repris.`:undefined);
 }
 return rows;
}
const allApparel=Object.keys(APPAREL) as ApparelItem[];
function apparelForDef(def:string):ApparelItem[] {
 const m=APPAREL_MAP[def];if(!m||isDropped(m))return [];
 if('item'in m.to)return def==='Apparel_AdvancedHelmet'?['flak-helmet','plasteel-flak-helmet']:[m.to.item];
 if('family'in m.to){const family=m.to.family;return allApparel.filter(i=>APPAREL[i].family===family);}
 const armor=m.to.armor;return allApparel.filter(i=>i.endsWith('-'+armor));
}
function sourceApparel(ctx:ImportContext):ApparelPolicy[] {
 const rows:ApparelPolicy[]=[];
 for(const policy of items(ctx.save.game,'outfitDatabase/outfits')){
  const id=num(policy,'id'),label=text(policy,'label'),filter=at(policy,'filter');if(!validId(id)||!validPolicyName(label)||!filter)continue;
  const allowed=new Set<ApparelItem>();let missing=0,adapted=0;
  for(const d of defs(filter)){
   const matches=apparelForDef(d);if(!matches.length){missing++;continue;}if('adapt'in APPAREL_MAP[d]!)adapted++;
   for(const i of matches)allowed.add(i);
  }
  const [minHitPointsPercent,maxHitPointsPercent]=filterRange(text(filter,'allowedHitPointsPercents'));
  const [lo,hi]=text(filter,'allowedQualityLevels')?.split('~')??[];
  const minQuality=QUALITY_MAP[lo??'Awful']??'awful',maxQuality=QUALITY_MAP[hi??'Legendary']??'legendary';
  const tainted=items(filter,'disallowedSpecialFilters').some(d=>d.text.trim()==='AllowDeadmansApparel');
  const row:ApparelPolicy={id,label,allowedItems:[...allowed],allowedMaterials:[...APPAREL_POLICY_MATERIALS267],minQuality,maxQuality,minHitPointsPercent,maxHitPointsPercent,...tainted?{taintedAllowed374:false}:{}};
  if(!validApparelPolicy(row,ctx.w.schemaVersion)){ctx.notes.def('policies',`Tenue : ${label}`,'dropped',undefined,'Filtre non représentable.');continue;}
  // Core ThingFilter also has special/mental-break filters that EW does not
  // expose; keep known item, quality, durability and corpse-wear semantics.
  const unsupported=items(filter,'disallowedSpecialFilters').filter(d=>d.text.trim()!=='AllowDeadmansApparel').length+((text(filter,'allowedMentalBreakChance')??'0~1')!=='0~1'?1:0);
  ctx.notes.def('policies',`Tenue : ${label}`,missing||adapted||unsupported?'adapted':'exact',`${allowed.size} vêtements`,missing||adapted||unsupported?`${missing} définitions absentes, ${adapted} adaptées, ${unsupported} filtres spéciaux non repris.`:undefined);
  rows.push(row);
 }
 return rows;
}
function sourceDrug(ctx:ImportContext):DrugPolicy265[] {
 const rows:DrugPolicy265[]=[];
 for(const policy of items(ctx.save.game,'drugPolicyDatabase/policies')){
  const id=num(policy,'id'),name=text(policy,'label');if(!validId(id)||!validPolicyName(name))continue;
  const entries=items(policy,'drugs'),beerNode=entries.find(d=>text(d,'drug')==='Beer'),penNode=entries.find(d=>text(d,'drug')==='Penoxycyline');
  // Core explicit records omit default numbers, but missing entries are not
  // a licence to add a recreational or scheduled dose.
  const numeric=(n:XmlNode|undefined,key:string,def=1)=>num(n,key)??def;
  const scaled=(n:XmlNode|undefined,key:string)=>numeric(n,key,1);
  const beer:BeerPolicy265={allowedForAddiction:text(beerNode,'allowedForAddiction')==='True',allowedForJoy:text(beerNode,'allowedForJoy')==='True',allowScheduled:text(beerNode,'allowScheduled')==='True',
   daysFrequency:numeric(beerNode,'daysFrequency'),onlyIfMoodBelow:scaled(beerNode,'onlyIfMoodBelow'),onlyIfJoyBelow:scaled(beerNode,'onlyIfJoyBelow'),takeToInventory:numeric(beerNode,'takeToInventory',0)};
  const penoxycyline337:PenoxycylinePolicy337={allowScheduled:text(penNode,'allowScheduled')==='True',daysFrequency:numeric(penNode,'daysFrequency'),onlyIfMoodBelow:scaled(penNode,'onlyIfMoodBelow'),onlyIfJoyBelow:scaled(penNode,'onlyIfJoyBelow')};
  if(!validBeerPolicy265(beer)||!validPenoxycylinePolicy337(penoxycyline337)){
   ctx.notes.def('policies',`Drogues : ${name}`,'dropped',undefined,'Paramètres hors des domaines admis pour bière et pénoxycycline.');continue;
  }
  rows.push({id,name,beer,penoxycyline337});
  const missing=entries.filter(n=>!['Beer','Penoxycyline'].includes(text(n,'drug')??'')).length;
  ctx.notes.def('policies',`Drogues : ${name}`,missing?'adapted':'exact','bière et pénoxycycline',missing?`${missing} autres drogues sans règle correspondante.`:undefined);
 }
 return rows;
}
export function importHumanPolicies(ctx:ImportContext,humans:readonly Human[]):void {
 const {w}=ctx,food=sourceFood(ctx),apparel=sourceApparel(ctx),drugs=sourceDrug(ctx);
 if(food.length){w.foodPolicies=safeRegistry(food,w.foodPolicies);w.nextFoodPolicyId=nextId(w.foodPolicies);}
 if(apparel.length){w.apparelPolicies=safeRegistry(apparel,w.apparelPolicies??[]);w.nextApparelPolicyId=nextId(w.apparelPolicies);}
 if(drugs.length){
  const registry=safeRegistry(drugs,w.drugPolicies??[]),next=nextId(registry);
  if(validDrugPolicyRegistry265(registry,next,w.schemaVersion)){w.drugPolicies=registry;w.nextDrugPolicyId=next;}
 }
 const reading=new Map<number,boolean>();
 for(const n of items(ctx.save.game,'readingPolicyDatabase/readingPolicies')){
  const id=num(n,'id');if(validId(id))reading.set(id,defs(at(n,'defFilter')).includes('Novel'));
 }
 for(const {thing,pawn} of humans){
  const node=thing.node,foodId=policyId(text(node,'foodRestriction/curRestriction')),apparelId=policyId(text(node,'outfits/curOutfit')),drugId=policyId(text(node,'drugs/curAssignedDrugs')),readingId=policyId(text(node,'reading/curAssignment'));
  if(foodId!==undefined&&w.foodPolicies.some(p=>p.id===foodId))pawn.foodPolicyId=foodId;
  else if(foodId!==undefined)ctx.notes.def('policies','Affectation alimentaire','dropped',undefined,'Politique source non représentée.');
  if(apparelId!==undefined&&w.apparelPolicies?.some(p=>p.id===apparelId))pawn.apparelPolicyId=apparelId;
  else if(apparelId!==undefined)ctx.notes.def('policies','Affectation vestimentaire','dropped',undefined,'Politique source non représentée.');
  if(drugId!==undefined&&w.drugPolicies?.some(p=>p.id===drugId))pawn.drugPolicyId=drugId;
  else if(drugId!==undefined)ctx.notes.def('policies','Affectation de drogues','dropped',undefined,'Politique source non représentée.');
  if(readingId!==undefined&&reading.has(readingId))pawn.readingPolicy295=reading.get(readingId)?1:2;
  else if(readingId!==undefined)ctx.notes.def('policies','Affectation de lecture','dropped',undefined,'Politique source non représentée.');
  for(const forced of items(node,'outfits/overrideHandler/forcedAps')){
   const ref=referencedThingId(text(forced)),id=ref&&ctx.thingIds.get(ref);
   const pile=typeof id==='number'?w.piles.find(p=>p.id===id):undefined;
   if(pile?.apparel&&pile.owner.type==='apparel'&&pile.owner.pawnId===pawn.id&&!pile.apparel.forbidden){
    pile.apparel.forced=true;ctx.notes.def('policies','Vêtement forcé','exact',pile.item);
   }else ctx.notes.def('policies','Vêtement forcé','dropped',undefined,'Vêtement correspondant non repris ou état incompatible.');
  }
 }
 if(reading.size)ctx.notes.def('policies','Lecture','adapted','romans autorisés/interdits','Les affectations sont reprises pour les romans ; manuels, schémas et effets de lecture ne sont pas encore représentés.',reading.size);
}
