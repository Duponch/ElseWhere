import { constructionRecipe, constructionMaterials, validConstructionMaterial, deliveredMaterial, type ConstructionMaterial } from '../sim/construction-materials';
import { BUILDING_MATERIALS } from '../sim/building-materials';
import { ITEM_DEFINITIONS } from '../sim/items';
import { footprintCells } from '../sim/definitions';
import type { Job, JobKind, Structure, World } from '../sim/types';

const stuffable = new Set<string>(['bedroll','shelf','small-shelf','spike-trap','electric-crematorium','drug-lab','art-bench','research-bench','tailor-bench','electric-tailor-bench','door','autodoor','wall','fence','fence-gate','pen-marker','bed','double-bed','hospital-bed','table','table-square','table-long','stool','dining-chair','armchair','end-table','dresser','flower-pot','horseshoes','chess-table','hoopstone-ring','billiards-table','game-of-ur-board','poker-table','stonecutter']);
export const defaultPlacementMaterial = (tool:string):ConstructionMaterial =>
  validConstructionMaterial(tool,'wood')?'wood':constructionMaterials(tool)[0]!;
export const placementMaterial = (tool:string, material:ConstructionMaterial):ConstructionMaterial|undefined =>
  tool==='brewery'||tool==='fermenting-barrel'?'wood':tool==='torch-lamp'?'wood':tool==='sandbags'?'cloth':tool==='vent'||tool==='tool-cabinet'?'steel':(tool==='firefoam-popper'||tool==='ship-cryptosleep-casket'||tool==='ship-beam'||tool==='ship-engine'||tool==='ship-reactor'||tool==='cryptosleep-casket'||tool==='fueled-smithy'||tool==='electric-smithy'||tool==='geothermal-generator'||tool==='electric-smelter'||tool==='biofuel-refinery'||tool==='chemfuel-generator'||tool==='nutrient-paste-dispenser'||tool==='hopper'||tool==='orbital-beacon'||tool==='comms-console'||tool==='deep-drill'||tool==='ground-scanner'||tool==='vitals-monitor'||tool==='hydroponics-basin'||tool==='tube-television'||tool==='mini-turret')?'steel':tool==='machining-table'||tool==='hi-tech-research-bench'||tool==='multi-analyzer'||tool==='fabrication-bench'||tool==='heater'||tool==='wind-turbine'||tool==='power-conduit'||tool==='power-switch'||tool==='battery'||tool==='solar-generator'||tool==='fueled-stove'||tool==='electric-stove'||tool==='cooler'||tool==='wood-generator'||tool==='standing-lamp'||tool==='sun-lamp'?'steel':stuffable.has(tool) ? validConstructionMaterial(tool,material)?material:defaultPlacementMaterial(tool) : tool === 'butcher-table' || tool === 'campfire' || tool === 'passive-cooler' ? 'wood' : undefined;

export function constructionControls(onChange:()=>void) {
  const control = document.getElementById('construction-material-controls')!;
  const select = document.getElementById('construction-material') as HTMLSelectElement;
  let previousTool='';
  select.onchange = onChange;
  return {
    material(tool:string) { return placementMaterial(tool, select.value as ConstructionMaterial); },
    update(tool:string, hint:string):string {
      control.hidden = !stuffable.has(tool);
      if(stuffable.has(tool)&&tool!==previousTool) {
        const preferred=select.value;
        select.replaceChildren(...constructionMaterials(tool).map(material=>{
          const option=document.createElement('option');option.value=material;option.textContent=ITEM_DEFINITIONS[material].label;return option;
        }));
        select.value=validConstructionMaterial(tool,preferred)?preferred:defaultPlacementMaterial(tool);previousTool=tool;
      }
      const material = placementMaterial(tool, select.value as ConstructionMaterial);
      if (!material&&tool!=='build-bridge') return hint;
      const recipe = constructionRecipe({ kind:tool as JobKind, material });
      const rest=(tool==='bed'||tool==='double-bed')&&material&&BUILDING_MATERIALS[material].restFactor<1?' · Efficacité du repos : 90 %':'';
      return `${recipe.ingredients.map(c => `${c.quantity} ${ITEM_DEFINITIONS[c.item].label}`).join(' + ')} à livrer${rest} · ${hint}`;
    },
  };
}

export function constructionDeliveryLabel(world:World, job:Job):string {
  return constructionRecipe(job).ingredients.map(c => `${deliveredMaterial(world, job, c.item)}/${c.quantity} ${ITEM_DEFINITIONS[c.item].label}`).join(' + ');
}

export function structureFootprintLabel(structure:Structure):string {
  const cells=footprintCells(structure),xs=cells.map(c=>c.x),zs=cells.map(c=>c.z);
  return `${Math.max(...xs)-Math.min(...xs)+1} × ${Math.max(...zs)-Math.min(...zs)+1}`;
}
