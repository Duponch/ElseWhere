import {isSchema273OrLater} from './schema-compatibility-257.ts';
import { allowedAreaAllows,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { isApparelMaterial,APPAREL_MATERIAL_DEFINITIONS } from './apparel-rules.ts';
import { isTextileMaterial308 } from './textile-apparel-308.ts';
import { healthRandom } from './health.ts';
import { releaseAssignments } from './work-release.ts';
import { isCookingOrder } from './order-types.ts';
import { groundCapacity,planGroundPlacement } from './ground-placement.ts';
import { addGroundMaterial,refreshStock } from './materials.ts';
import { ingredientPlaceFree } from './cooking-bills.ts';
import {isSchema267OrLater,isSchema269OrLater,isSchema270OrLater,isSchema272OrLater} from './schema-compatibility-257.ts';
import { isSmithingWorkpiece267 } from './smithing-content-267.ts';
import { productionWorkTotal,isTailoring,unfinishedItem,PRODUCTION_RECIPES,tailoringMaterialFromIngredients,tailoringMaterialAllowed,type TailoringMaterial,type TailoringRecipe } from './production-recipes.ts';
import type { Cell,CommandResult,MaterialPile,Pawn,World } from './types.ts';

export interface UnfinishedState {
  recipe:TailoringRecipe;
  authorId:number;
  progress:number;
  /** V90 owner of all incorporated units. Legacy objects omit it and are cloth. */
  material?:TailoringMaterial;
  /** V90 total; cloth remains readable for the two legacy recipes. */
  units?:20|40|45|60|80;
  cloth?:60|45;
  parts:number[];
  billId?:number;
}
export interface TailoringLedger {completed:number;cancelled:number;lostCloth:number;lostLeather?:number}
export const unfinishedMaterial=(state:UnfinishedState):TailoringMaterial=>state.material??'cloth';
export const unfinishedUnits=(state:UnfinishedState):number=>state.units??state.cloth??PRODUCTION_RECIPES[state.recipe].units;

export function detachMissingBills(world:World):void {
  if(!world.piles.some(p=>p.unfinished?.billId))return;
  const bills=new Set([...world.structures,...world.packed.map(p=>p.building)].flatMap(s=>s.bills?.map(b=>b.id)??[]));
  for(const p of world.piles)if(p.unfinished?.billId&&!bills.has(p.unfinished.billId))delete p.unfinished.billId;
}
/** Consume staged ingredients only after proving a physical place for the work.
 * The unfinished object, not a cancelled task, owns progress and one material. */
export function beginUnfinished(world:World,pawn:Pawn):MaterialPile|null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task=pawn.cooking!,recipe=task.recipe;
  if(!isTailoring(recipe))return null;
  const item=unfinishedItem(recipe),units=PRODUCTION_RECIPES[recipe].units,existing=task.ingredients.length===1?world.piles.find(p=>p.id===task.ingredients[0]!.pileId&&p.unfinished):undefined;
  if(existing){if(existing.unfinished!.authorId!==pawn.id)return null;existing.unfinished!.billId=task.billId;return existing;}
  const material=tailoringMaterialFromIngredients(task.ingredients);
  if(!material||!tailoringMaterialAllowed(recipe,material)||task.ingredients.some(i=>i.item!==material)||task.ingredients.reduce((n,i)=>n+i.quantity,0)!==units)return null;
  const used=new Map<number,number>();for(const i of task.ingredients)used.set(i.pileId,(used.get(i.pileId)??0)+i.quantity);
  const piles=world.piles.map(p=>used.has(p.id)?{...p,quantity:p.quantity-used.get(p.id)!}:p).filter(p=>p.quantity>0),shadow={...world,piles};
  if(piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  const s=task.spot,cells:Cell[]=[{x:s.x,z:s.z+1},{x:s.x+1,z:s.z},{x:s.x-1,z:s.z},{x:s.x,z:s.z-1}];
  const cell=cells.find(c=>allowedAreaAllows(world,pawn,c)&&ingredientPlaceFree(shadow,c,s,recipe)&&groundCapacity(shadow,c,item,pawn.id)>=1);
  if(!cell)return null;
  const legacyCloth=material==='cloth'&&(recipe==='tribalwear'||recipe==='shirt')?{cloth:units as 45|60}:{};
  const pile:MaterialPile={id:world.nextId++,item,kind:'unfinished',quantity:1,owner:{type:'ground',...cell},unfinished:{recipe,authorId:pawn.id,progress:0,material,units,parts:[...used.values()],billId:task.billId,...legacyCloth}};
  world.piles=[...piles,pile];task.ingredients=[{pileId:pile.id,item,quantity:1,stage:'placed',cell:{...cell}}];refreshStock(world);return pile;
}
export function cancelUnfinished(world:World,itemId:number):CommandResult {
  const pile=world.piles.find(p=>p.id===itemId);
  if(!pile?.unfinished||pile.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Ouvrage inachevé introuvable au sol.'};
  const material=unfinishedMaterial(pile.unfinished),units=unfinishedUnits(pile.unfinished),random={rng:world.rng};let refund=0;
  for(const n of pile.unfinished.parts){const raw=n*.75,whole=Math.floor(raw);refund+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);}
  const shadow={...world,piles:world.piles.filter(p=>p!==pile)},placements=planGroundPlacement(shadow,refund,pile.owner,material);
  const materialLabel=APPAREL_MATERIAL_DEFINITIONS[material].label;
  if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(world.nextId+placements.length))return {ok:false,code:'occupied',reason:`Aucune place pour conserver le ${materialLabel} récupéré.`};
  const ledger=world.tailoring,loss=units-refund,lossBefore=material==='cloth'?(ledger?.lostCloth??0):(ledger?.lostLeather??0);
  if(!Number.isSafeInteger((ledger?.cancelled??0)+1)||!Number.isSafeInteger(lossBefore+loss))return {ok:false,code:'invalid-command',reason:'Limite du bilan textile atteinte.'};
  // A ground unfinished work has no companion carried ingredients. Cancel only
  // tasks referring to it; unrelated current jobs survive removal from a queue.
  for(const pawn of world.pawns){
    if(pawn.cooking?.ingredients.some(i=>i.pileId===itemId)||pawn.haul?.sourcePileId===itemId)releaseAssignments(world,pawn);
    pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===itemId):o.sourcePileId!==itemId));
  }
  world.piles=shadow.piles;addGroundMaterial(world,'textile',refund,pile.owner,material);world.rng=random.rng;
  const next=world.tailoring??={completed:0,cancelled:0,lostCloth:0};next.cancelled++;
  if(material==='cloth')next.lostCloth+=loss;else next.lostLeather=(next.lostLeather??0)+loss;
  return {ok:true};
}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):boolean=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
export function validUnfinishedShape(p:Record<string,unknown>,version:number):boolean {
  if(isSmithingWorkpiece267(p.item))return isSchema267OrLater(version)&&(p.item!=='unfinished-knife'||version===268||isSchema269OrLater(version))&&(p.item!=='unfinished-mace'||isSchema269OrLater(version))&&(p.item!=='unfinished-longsword'||isSchema270OrLater(version))&&(p.item!=='unfinished-spear'||isSchema272OrLater(version))&&!Object.hasOwn(p,'unfinished');
  if(p.item==='unfinished-prosthetic')return isSchema273OrLater(version)&&!Object.hasOwn(p,'unfinished');
  if(p.item==='unfinished-flak-vest'||p.item==='unfinished-flak-helmet'||p.item==='unfinished-recon-helmet'||p.item==='unfinished-recon-armor'||p.item==='unfinished-gun'||p.item==='unfinished-sculpture'||p.item==='unfinished-component')return p.unfinished===undefined;
  if(p.kind!=='unfinished')return p.unfinished===undefined;
  const u=p.unfinished;
  if(version<72||!record(p.owner)||!['ground','pawn'].includes(String(p.owner.type))||p.quantity!==1||!record(u)||!isTailoring(u.recipe)||u.recipe==='tuque'&&version<245)return false;
  const recipe=u.recipe,legacy=version<90,units=PRODUCTION_RECIPES[recipe].units;
  if(legacy)return (p.item==='unfinished-tribalwear'||version>=73&&p.item==='unfinished-shirt')
    &&Object.keys(u).every(k=>['recipe','authorId','progress','cloth','parts','billId'].includes(k))&&(version>=73||recipe==='tribalwear')&&p.item===unfinishedItem(recipe)
    &&u.cloth===units&&int(u.authorId,1)&&Array.isArray(u.parts)&&u.parts.length>0&&u.parts.length<=60&&u.parts.every(n=>int(n,1,60))&&u.parts.reduce((a:number,b:number)=>a+b,0)===u.cloth
    &&int(u.progress,0,productionWorkTotal(recipe))&&(u.billId===undefined||int(u.billId,1));
  const material=u.material,storedUnits=u.units;
  return p.item===unfinishedItem(recipe)&&Object.keys(u).every(k=>['recipe','authorId','progress','material','units','cloth','parts','billId'].includes(k))
    &&(isApparelMaterial(material)&&tailoringMaterialAllowed(recipe,material)&&(version>=91||material==='cloth'||material==='light-leather')&&(version>=120||material!=='muffalo-wool')&&(version>=178||material!=='foxfur')&&(version>=308||!isTextileMaterial308(material)))&&storedUnits===units&&(u.cloth===undefined||material==='cloth'&&(recipe==='tribalwear'||recipe==='shirt')&&u.cloth===units)
    &&int(u.authorId,1)&&Array.isArray(u.parts)&&u.parts.length>0&&u.parts.length<=80&&u.parts.every(n=>int(n,1,75))&&u.parts.reduce((a:number,b:number)=>a+b,0)===storedUnits
    &&int(u.progress,0,productionWorkTotal(recipe))&&(u.billId===undefined||int(u.billId,1));
}
export function validateUnfinished(world:World,version:number):string[] {
  const errors:string[]=[],ledger=world.tailoring;
  if(ledger!==undefined&&(version<72||!record(ledger)||Object.keys(ledger).some(k=>!['completed','cancelled','lostCloth',...(version>=90?['lostLeather']:[])].includes(k))||!int(ledger.completed)||!int(ledger.cancelled)||!int(ledger.lostCloth)||(ledger.lostLeather!==undefined&&!int(ledger.lostLeather))||ledger.lostCloth+(ledger.lostLeather??0)>ledger.cancelled*(version>=90?80:60)))errors.push('Invalid textile ledger.');
  const bills=new Set<number>();
  for(const p of world.piles)if(p.unfinished){const u=p.unfinished;
    if(!world.pawns.some(a=>a.id===u.authorId))errors.push('Missing unfinished author.');
    if(u.billId!==undefined){
      if(bills.has(u.billId)||![...world.structures,...world.packed.map(p=>p.building)].some(s=>s.bills?.some(b=>b.id===u.billId&&b.recipe===u.recipe)))errors.push('Invalid unfinished bound bill.');
      bills.add(u.billId);
    }
  }return errors;
}
