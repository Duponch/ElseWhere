import type {World} from './types.ts';

/** Schema 358: Core RimWorld 1.6 devilstrand, its research, crop and fabric.
 *
 * ResearchProjectDef Devilstrand (ResearchProjects_1.xml): 800 points,
 * Neolithic, no prerequisite and no research building.
 *
 * ThingDef Plant_Devilstrand (Plants_Cultivated_Farm.xml, PlantBase over
 * PlantBaseNonEdible): growDays 22.5, sowWork 400, harvestWork 200 (base),
 * harvestYield 6 DevilstrandCloth, fertilityMin 0.5, fertilitySensitivity 1
 * (base), sowMinSkill 10, sowTags Ground only (no hydroponics),
 * sowResearchPrerequisites Devilstrand, neverBlightable, dieIfLeafless,
 * harvestMinGrowth 0.65 and the default growth temperatures 0/6/42/58 (class
 * defaults), MaxHitPoints 85, Nutrition 0.2, pathCost 14, lifespan
 * growDays x 8 (class default lifespanDaysPerGrowDays).
 *
 * ThingDef DevilstrandCloth (Items_Resource_Stuff.xml, ResourceBase): stack
 * 75, MaxHitPoints 100, MarketValue 5.5, Mass 0.032, Flammability 0.4,
 * DeteriorationRate 3, StuffPower_Armor Sharp 1.40 / Blunt 0.36 / Heat 3.00,
 * StuffPower_Insulation Cold 20 / Heat 24; stuffProps Fabric, commonality
 * 0.20, colour (180,60,60), statFactors Flammability 0.4, MaxHitPoints 1.3,
 * Beauty 3.2; thing category Textiles. Facts only, nothing copied. */
export const DEVILSTRAND_SCHEMA_358=358 as const;
export const isDevilstrandSchema358=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=DEVILSTRAND_SCHEMA_358;

export const DEVILSTRAND_RESEARCH_SCALE_358=1_000_000;
export const DEVILSTRAND_RESEARCH_358=Object.freeze({project:'devilstrand',recordKey:'devilstrand',label:'Soie du diable',points:800,scaledCost:800*DEVILSTRAND_RESEARCH_SCALE_358,techLevel:'Neolithic'} as const);
export type DevilstrandResearch358=typeof DEVILSTRAND_RESEARCH_358.project;
export const isDevilstrandResearch358=(v:unknown):v is DevilstrandResearch358=>v==='devilstrand';
export const devilstrandUnlocked358=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isDevilstrandSchema358(w.schemaVersion)&&w.research?.devilstrand?.completedAt!==undefined;

/** Plant facts; work in Core ticks (the local work unit is ten of them). */
export const DEVILSTRAND_PLANT_358=Object.freeze({label:'Soie du diable',growDays:22.5,fertilityMin:.5,fertilitySensitivity:1,
  sowWorkCore:400,harvestWorkCore:200,harvestYield:6,sowMinSkill:10,maxHitPoints:85,nutrition:.2,pathCost:14} as const);
/** Local sowing work: Core 400 / 10. */
export const DEVILSTRAND_SOW_TICKS_358=DEVILSTRAND_PLANT_358.sowWorkCore/10;

/** The fabric. `color` is Core's stuff colour (180,60,60). */
export const DEVILSTRAND_FABRIC_358=Object.freeze({label:'Soie du diable',stackLimit:75,maxHitPoints:100,marketValue:5.5,mass:.032,flammability:.4,deteriorationRate:3,
  armor:Object.freeze({sharp:1.4,blunt:.36,heat:3}),coldInsulation:20,heatInsulation:24,commonality:.2,color:0xb43c3c,
  stuffFactors:Object.freeze({flammability:.4,maxHitPoints:1.3,beauty:3.2})} as const);

/** Every garment made of devilstrand. The tribal wear, button-down shirt,
 * pants, duster, parka and tuque are listed here; the T-shirt, jacket and the
 * two hats come from the families that every tailoring material makes. */
export const DEVILSTRAND_APPAREL_FAMILIES_358=['tribalwear','shirt','pants','duster','parka','tuque','tshirt','jacket','cowboy-hat','bowler-hat'] as const;
export type DevilstrandApparel358=`devilstrand-${typeof DEVILSTRAND_APPAREL_FAMILIES_358[number]}`;
export const DEVILSTRAND_APPAREL_ITEMS_358:readonly DevilstrandApparel358[]=Object.freeze(DEVILSTRAND_APPAREL_FAMILIES_358.map(f=>`devilstrand-${f}` as DevilstrandApparel358));
const APPAREL_SET=new Set<unknown>(DEVILSTRAND_APPAREL_ITEMS_358);
export const isDevilstrandApparel358=(v:unknown):v is DevilstrandApparel358=>APPAREL_SET.has(v);
/** The fabric and every devilstrand garment: absent from saves before 358. */
export const isDevilstrandItem358=(v:unknown):boolean=>v==='devilstrand'||APPAREL_SET.has(v);

/** Before 358 a save holds no devilstrand item, garment, material, plant,
 * growing zone or research entry, in any domain, archive or transfer. */
export function validDevilstrandTransport358(value:unknown,version:number):boolean {
  if(isDevilstrandSchema358(version))return true;
  const visit=(v:unknown):boolean=>{
    if(Array.isArray(v))return v.every(visit);
    if(!v||typeof v!=='object')return true;
    for(const [key,child] of Object.entries(v)){
      if(['item','weaponItem','material','plant','product'].includes(key)&&isDevilstrandItem358(child)||key==='kind'&&child==='devilstrand'||key==='project'&&child==='devilstrand')return false;
      if((key==='allowedItems'||key==='allowedMaterials')&&Array.isArray(child)&&child.some(isDevilstrandItem358))return false;
      if(['items','filters','bought','sold','lost','lostTextiles'].includes(key)&&child&&typeof child==='object'&&Object.keys(child).some(isDevilstrandItem358))return false;
      if(!visit(child))return false;
    }
    return true;
  };
  return visit(value);
}
