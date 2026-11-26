import {constructionMaterials,validConstructionMaterial,type ConstructionMaterial} from '../sim/construction-materials';
import {constructionMaterialLines,CONSTRUCTION_STUFF_KINDS} from './construction-material-presentation';
import {coreSlotGroupCells} from './alert-census';
import {knownPile256} from './exploration-readers-256';
import type {World} from '../sim/types';

/** Core4871 CountAsResource/Middle order for supported Stuff, Leather, Stone
 * definitions. Jade/devilstrand cannot suggest a default; explicit picks work. */
const SUGGESTED_STUFF_ORDER:readonly ConstructionMaterial[]=['steel','wood','cloth','alpaca-wool','megasloth-wool','muffalo-wool','bison-wool','plainleather','dog-leather','wolf-leather','panthera-fur','camelhide','bluefur','bear-leather','guinea-pig-fur','pig-leather','light-leather','bird-leather','chinchilla-fur','foxfur','lizard-leather','elephant-leather','heavy-fur','rhinoceros-leather','sandstone-blocks','granite-blocks','limestone-blocks','slate-blocks','marble-blocks'];
export function countedConstructionMaterials(world:World):ReadonlyMap<ConstructionMaterial,number> {
 const cells=coreSlotGroupCells(world),result=new Map<ConstructionMaterial,number>();
 for(const pile of world.piles)if(pile.owner.type==='ground'&&cells.has(pile.owner.z*world.width+pile.owner.x)&&knownPile256(world,pile)){
  const item=pile.item as ConstructionMaterial;if(SUGGESTED_STUFF_ORDER.includes(item)||item==='jade'||item==='devilstrand')result.set(item,(result.get(item)??0)+pile.quantity);
 }
 return result;
}
/** GenStuff.DefaultStuffFor non-apparel/non-weapon branch. None of the Core
 * building definitions overrides defaultStuff. Never called for a placed plan. */
export function defaultConstructionMaterial(world:World,tool:string,counts?:ReadonlyMap<ConstructionMaterial,number>):ConstructionMaterial|undefined {
 const allowed=constructionMaterials(tool).filter(material=>validConstructionMaterial(tool,material,Number(world.schemaVersion)));if(!allowed.length)return;
 const fallback=(['wood','steel','granite-blocks','cloth','plainleather'] as const).find(material=>allowed.includes(material))??allowed[0]!;
 if(!CONSTRUCTION_STUFF_KINDS.has(tool)||allowed.length===1)return fallback;
 const stored=counts??countedConstructionMaterials(world);
 // Stuff excludes fixed costList entries. Alternate Stuff recipes expose the
 // base count without a same-ThingDef fixed addition (wood/steel/cloth).
 const stuffRecipes=tool==='electric-tailor-bench'?allowed.filter(material=>material!=='steel'):allowed;
 const stuffCount=Math.min(...stuffRecipes.map(material=>constructionMaterialLines({kind:tool as import('../sim/types').JobKind,material}).find(line=>line.item===material)?.required??Infinity));
 if((stored.get(fallback)??0)>=stuffCount)return fallback;
 return SUGGESTED_STUFF_ORDER.find(material=>allowed.includes(material)&&(stored.get(material)??0)>=stuffCount)??fallback;
}
/** Each Designator_Build owns its explicit choice. The renderer's current
 * material is a projection, never a global preference for every building. */
export class ConstructionMaterialChoices {
 private readonly explicit=new Map<string,ConstructionMaterial>();
 reset():void {this.explicit.clear();}
 choose(tool:string,material:ConstructionMaterial):boolean {
  if(!constructionMaterials(tool).includes(material))return false;this.explicit.set(tool,material);return true;
 }
 resolve(world:World,tool:string,counts?:ReadonlyMap<ConstructionMaterial,number>):ConstructionMaterial|undefined {
  const own=this.explicit.get(tool);return own&&validConstructionMaterial(tool,own,Number(world.schemaVersion))?own:defaultConstructionMaterial(world,tool,counts);
 }
}
