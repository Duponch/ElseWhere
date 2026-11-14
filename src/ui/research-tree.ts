import type {ResearchProject} from '../sim/research';
import {researchProjects,type ProjectNode} from './research-projects';

/** Existing research hierarchy and geometry, shared by the legacy reader and
 * native meshes. Importing this module does not construct a UI or read a World. */
export const researchLinks:readonly (readonly [ResearchProject,ResearchProject])[]=[
  ['recurve-bow','greatbow'],
  ['microelectronics','long-range-mineral-scanner'],['machining','long-range-mineral-scanner'],
  ['ship-basics','ship-computer'],['ship-basics','ship-sensors'],['long-range-mineral-scanner','ship-sensors'],
  ['ship-basics','ship-cryptosleep'],['cryptosleep','ship-cryptosleep'],
  ['advanced-fabrication','ship-basics'],['ship-basics','ship-reactor'],['ship-basics','ship-engine'],
  ['machining','prosthetics'],['multi-analyzer','cryptosleep'],
  ['microelectronics','deep-drilling'],['deep-drilling','ground-scanner'],
  ['hospital-bed','vitals-monitor'],['multi-analyzer','vitals-monitor'],
  ['drug-production','medicine-production'],['microelectronics','medicine-production'],
  ['gunsmithing','gun-turrets'],['complex-furniture','tube-television'],['smithing','long-blades'],
  ['smithing','machining'],['machining','gunsmithing'],
  ['smithing','plate-armor'],['complex-clothing','plate-armor'],
  ['machining','flak-armor'],['plate-armor','flak-armor'],
  ['microelectronics','multi-analyzer'],['machining','multi-analyzer'],['multi-analyzer','fabrication'],
  ['fabrication','advanced-fabrication'],['fabrication','recon-armor'],['complex-clothing','recon-armor'],
  ['microelectronics','hospital-bed'],['complex-furniture','hospital-bed'],
];
export const RESEARCH_NODE_WIDTH=142,RESEARCH_NODE_HEIGHT=66,RESEARCH_GRAPH_WIDTH=850;
export const RESEARCH_GRAPH_HEIGHT=Math.ceil(Math.max(740,...researchProjects.map(project=>22+(project.y-20)*.66+RESEARCH_NODE_HEIGHT+22)));
export const researchNodePosition=(project:Pick<ProjectNode,'x'|'y'>)=>({x:20+(project.x-24)*.82,y:22+(project.y-20)*.66});
export const researchPrerequisiteLabels:ReadonlyMap<ResearchProject,readonly string[]>=new Map<ResearchProject,string[]>([
  ['recurve-bow',[]],['greatbow',['Arc recourbé']],
  ['long-range-mineral-scanner',['Microélectronique','Usinage']],
  ['ship-computer',['Construction de vaisseau']],['ship-sensors',['Construction de vaisseau','Scanner minéral longue portée']],
  ['firefoam',['Électricité (acquise au départ)']],
  ['ship-cryptosleep',['Construction de vaisseau','Cryptosommeil']],
  ['ship-basics',['Fabrication avancée']],['ship-reactor',['Construction de vaisseau']],['ship-engine',['Construction de vaisseau']],
  ['prosthetics',['Usinage']],['cryptosleep',['Multi-analyseur']],['long-blades',['Forge']],['brewing',[]],
  ['geothermal-power',['Électricité (acquise au départ)']],['biofuel-refining',['Électricité (acquise au départ)']],
  ['nutrient-paste',['Électricité (acquise au départ)']],['deep-drilling',['Microélectronique']],['ground-scanner',['Forage profond']],
  ['sterile-materials',['Électricité (acquise au départ)']],['vitals-monitor',['Lit d’hôpital','Multi-analyseur']],
  ['drug-production',[]],['medicine-production',['Production de drogues','Microélectronique']],
  ['hydroponics',['Électricité (acquise au départ)']],['gun-turrets',['Armurerie']],
  ['tube-television',['Mobilier complexe','Électricité (acquise au départ)']],
  ['machining',['Forge']],['gunsmithing',['Usinage']],['plate-armor',['Forge','Vêtements complexes']],['flak-armor',['Usinage','Armure de plaques']],
  ['autodoors',['Électricité (acquise au départ)']],['microelectronics',['Électricité (acquise au départ)']],
  ['multi-analyzer',['Microélectronique','Usinage']],['fabrication',['Multi-analyseur']],
  ['advanced-fabrication',['Fabrication']],['recon-armor',['Fabrication','Vêtements complexes']],
  ['hospital-bed',['Microélectronique','Mobilier complexe']],
]);

export interface ResearchTreePoint {readonly x:number;readonly y:number}
type ResearchPathCommand={kind:'M'|'L';point:ResearchTreePoint}|{kind:'C';first:ResearchTreePoint;second:ResearchTreePoint;point:ResearchTreePoint};
const byId=new Map(researchProjects.map(project=>[project.id,project]));
const point=(x:number,y:number):ResearchTreePoint=>({x,y});
function linkCommands(fromId:ResearchProject,toId:ResearchProject):ResearchPathCommand[]{
  const source=byId.get(fromId),target=byId.get(toId);
  if(!source||!target)throw new Error('Recherche absente du graphe livré.');
  const from=researchNodePosition(source),to=researchNodePosition(target),w=RESEARCH_NODE_WIDTH,h=RESEARCH_NODE_HEIGHT;
  // New long links use the empty outer gutter instead of crossing old cards.
  // Authored once at module load; no World or per-frame route computation.
  if(toId==='long-range-mineral-scanner'){
    const lane=fromId==='microelectronics'?6:12,x=from.x+w/2,y=from.y+h+8,targetX=to.x+w/2,targetY=to.y-8;
    return [{kind:'M',point:point(x,from.y+h)},{kind:'L',point:point(x,y)},{kind:'L',point:point(lane,y)},
      {kind:'L',point:point(lane,targetY)},{kind:'L',point:point(targetX,targetY)},{kind:'L',point:point(targetX,to.y)}];
  }
  if(toId==='tube-television'){
    const y1=from.y+h/2,y2=to.y+h/2;
    return [{kind:'M',point:point(from.x,y1)},{kind:'L',point:point(6,y1)},{kind:'L',point:point(6,y2)},{kind:'L',point:point(to.x,y2)}];
  }
  if(to.y===from.y&&to.x<from.x){const y=from.y+h/2;return [{kind:'M',point:point(from.x,y)},{kind:'L',point:point(to.x+w,y)}];}
  if(from.x===to.x){const x=from.x+w/2;return [{kind:'M',point:point(x,from.y+h)},{kind:'L',point:point(x,to.y)}];}
  if(to.y>from.y&&to.x<from.x){
    const x1=from.x+w/2,y1=from.y+h,x2=to.x+w/2,y2=to.y,mid=(y1+y2)/2;
    return [{kind:'M',point:point(x1,y1)},{kind:'C',first:point(x1,mid),second:point(x2,mid),point:point(x2,y2)}];
  }
  const x1=from.x+w,y1=from.y+h/2,x2=to.x,y2=to.y+h/2,bend=Math.max(18,(x2-x1)/2);
  return [{kind:'M',point:point(x1,y1)},{kind:'C',first:point(x1+bend,y1),second:point(x2-bend,y2),point:point(x2,y2)}];
}
/** Keeps the legacy SVG path byte-for-byte equivalent to its former routing. */
export function researchLinkSvgPath(from:ResearchProject,to:ResearchProject):string {
  return linkCommands(from,to).map(command=>command.kind==='C'
    ?`C${command.first.x} ${command.first.y},${command.second.x} ${command.second.y},${command.point.x} ${command.point.y}`
    :`${command.kind}${command.point.x} ${command.point.y}`).join(' ');
}
/** A static polyline of those same routes, suitable for a painted 3D surface.
 * Curves are sampled once at module load, never once per game frame. */
function researchLinkPoints(from:ResearchProject,to:ResearchProject):readonly ResearchTreePoint[]{
  const commands=linkCommands(from,to),points:ResearchTreePoint[]=[];let previous=commands[0]!.point;
  for(const command of commands){
    if(command.kind==='C')for(let step=1;step<=16;step++){
      const t=step/16,u=1-t;
      points.push(point(u*u*u*previous.x+3*u*u*t*command.first.x+3*u*t*t*command.second.x+t*t*t*command.point.x,
        u*u*u*previous.y+3*u*u*t*command.first.y+3*u*t*t*command.second.y+t*t*t*command.point.y));
    }else points.push(command.point);
    previous=command.point;
  }
  return points;
}
export const researchGraphLinks=researchLinks.map(([from,to])=>({from,to,path:researchLinkPoints(from,to)}));
