import {constructionMaterials,constructionRecipe,newConstructionRecipe379,deliveredMaterial,type ConstructionMaterial} from '../sim/construction-materials';
import {isBuildableFloor} from '../sim/flooring';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import type {Job,JobKind,World} from '../sim/types';
import {itemTitle} from '../lore/lore-text';

export type ConstructionDisplayObject=Parameters<typeof constructionRecipe>[0];
export interface ConstructionMaterialLine {item:ItemId;label:string;required:number;delivered:number;remaining:number}
/** These are ThingDef.MadeFromStuff, distinct from a fixed steel/wood costList. */
export const CONSTRUCTION_STUFF_KINDS:ReadonlySet<string>=new Set(['egg-box','bedroll','double-bedroll','shelf','small-shelf','spike-trap','electric-crematorium','drug-lab','art-bench','research-bench','tailor-bench','electric-tailor-bench','door','autodoor','wall','fence','fence-gate','pen-marker','bed','double-bed','hospital-bed','table','table-square','table-long','table-large','stool','dining-chair','armchair','couch','end-table','dresser','flower-pot','horseshoes','chess-table','hoopstone-ring','billiards-table','game-of-ur-board','poker-table','stonecutter','small-sculpture','large-sculpture','column','urn','stele-large','stele-grand','sarcophagus']);
export const constructionMaterialLabel=(item:ItemId):string=>itemTitle(item,ITEM_DEFINITIONS[item].label);
/** Resolve the same valid material as placement without inventing Stuff for a
 * fixed-cost building or a historical record whose material is absent. */
export function constructionToolObject(tool:string,material?:ConstructionMaterial):ConstructionDisplayObject {
 if(isBuildableFloor(tool))return {kind:'lay-floor',floor:tool};
 const allowed=constructionMaterials(tool),chosen=allowed.length?(material&&allowed.includes(material)?material:allowed.includes('wood')?'wood':allowed[0]):undefined;
 return {kind:tool as JobKind,...chosen?{material:chosen}:{}};
}
/** The actual recipe owns every item and amount, including duplicate fixed
 * costs merged with Stuff. Deliveries count only items physically in the job. */
export function constructionMaterialLines(entity:ConstructionDisplayObject,world?:World,job?:Job,preview=false):ConstructionMaterialLine[] {
 const recipe=preview?newConstructionRecipe379(entity,world?.schemaVersion):constructionRecipe(entity);if(!recipe)return [];
 const amounts=new Map<ItemId,number>();for(const cost of recipe.ingredients)amounts.set(cost.item,(amounts.get(cost.item)??0)+cost.quantity);
 return [...amounts].map(([item,required])=>{const delivered=world&&job?deliveredMaterial(world,job,item):0;return {item,label:constructionMaterialLabel(item),required,delivered,remaining:Math.max(0,required-delivered)};});
}
export const constructionCostText=(entity:ConstructionDisplayObject,preview=false):string=>constructionMaterialLines(entity,undefined,undefined,preview).map(line=>`${line.required} ${line.label}`).join(' + ');
export const constructionDeliveryText=(world:World,job:Job):string=>constructionMaterialLines(job,world,job).map(line=>`${line.label} : ${line.delivered} / ${line.required}`).join(' · ');
/** Resource names use the stack label; a made-from-Stuff Thing uses its Stuff
 * noun (a marble wall, rather than a wall made of "marble blocks"). */
export function constructionStuffLabel(material:ConstructionMaterial):string {
 const blocks:Partial<Record<ConstructionMaterial,string>>={'granite-blocks':'granite','limestone-blocks':'calcaire','marble-blocks':'marbre','sandstone-blocks':'grès','slate-blocks':'ardoise'};
 return blocks[material]??constructionMaterialLabel(material).toLocaleLowerCase('fr');
}
export function constructionThingLabel(label:string,entity:{kind:string;material?:ConstructionMaterial}):string {
 return entity.material&&CONSTRUCTION_STUFF_KINDS.has(entity.kind)?`${label} en ${constructionStuffLabel(entity.material)}`:label;
}
