import type {ResearchProject} from '../sim/research';
import {RESEARCH_PREREQUISITES} from '../sim/research-prerequisites';
import {researchProjects} from '../ui/research-projects';
import {NATIVE_RESEARCH} from './native-research-metrics';

/** Core MainTabWindow_Research: coordinates are project positions (Core XML,
 * 1.6), in units of 190 horizontally and 100 vertically. Keep the empty
 * positions of research not yet implemented; never invent prerequisites. */
export {NATIVE_RESEARCH};
const positions:Record<ResearchProject,readonly [number,number]>={
  'tree-sowing':[0,0],'recurve-bow':[0,.7],stonecutting:[0,1.4],devilstrand:[0,2.8],
  brewing:[0,3.5],'complex-furniture':[0,4.2],'complex-clothing':[0,4.9],
  greatbow:[1,.7],pemmican:[1,1.4],'carpet-making':[1,2.1],smithing:[1,3.5],
  'drug-production':[2,0],'plate-armor':[2,5.6],'penoxycyline-production':[3,2.8],'long-blades':[3,5.6],
  machining:[5,3.5],autodoors:[6,.3],batteries:[6,.9],hydroponics:[6,1.5],'air-conditioning':[6,2.1],
  gunsmithing:[6,3.4],'flak-armor':[6,4.1],ieds:[7,.9],firefoam:[7,1.5],'solar-power':[7,2.1],
  'biofuel-refining':[7,2.7],'blowback-operation':[7,3.4],prosthetics:[7,4.8],
  'sterile-materials':[8,.9],'nutrient-paste':[8,1.5],'gun-turrets':[8,4.1],
  'tube-television':[9,.9],'packaged-survival-meals':[9,1.5],'geothermal-power':[9,2.1],'gas-operation':[9,3.4],
  microelectronics:[10,3],'medicine-production':[11,0],'precision-rifling':[11,3.6],
  'long-range-mineral-scanner':[12,4.2],'hospital-bed':[13,1.8],'deep-drilling':[13,4.2],
  'multi-analyzer':[14,3],'ground-scanner':[14,4.2],'vitals-monitor':[15,1.8],cryptosleep:[15,2.4],
  fabrication:[16,3],'recon-armor':[17,1.1],'advanced-fabrication':[18,3],
  'ship-basics':[20,3],'ship-sensors':[21,.6],'ship-computer':[21,1.8],'ship-cryptosleep':[21,3],
  'ship-reactor':[21,4.3],'ship-engine':[21,5.4],
};
export function coreResearchNodePosition(id:ResearchProject):{x:number;y:number}{
  const [x,y]=positions[id],g=NATIVE_RESEARCH;
  return {x:Math.round(g.margin+x*g.pitchX),y:Math.round(g.margin+y*g.pitchY)};
}
const ids=new Set<ResearchProject>(researchProjects.map(project=>project.id));
/** ListProjects draws visible prerequisites from the right centre of the
 * prerequisite to the left centre of the project. Hidden prerequisites are
 * still enforced by the simulation and listed in the project dossier. */
export const coreResearchLinks=researchProjects.flatMap(project=>
  RESEARCH_PREREQUISITES[project.id].visible.filter((parent):parent is ResearchProject=>parent!=='electricity'&&ids.has(parent)).map(parent=>{
    const from=coreResearchNodePosition(parent),to=coreResearchNodePosition(project.id),g=NATIVE_RESEARCH;
    return {from:parent,to:project.id,path:[{x:from.x+g.nodeWidth,y:from.y+g.nodeHeight/2},{x:to.x,y:to.y+g.nodeHeight/2}]};
  }));
export function coreResearchExtent(projects:readonly ResearchProject[]):{width:number;height:number}{
  let width=0,height=0;
  for(const id of projects){const position=coreResearchNodePosition(id);width=Math.max(width,position.x+NATIVE_RESEARCH.nodeWidth);height=Math.max(height,position.y+NATIVE_RESEARCH.nodeHeight);}
  return {width:width+NATIVE_RESEARCH.margin,height:height+NATIVE_RESEARCH.margin};
}
