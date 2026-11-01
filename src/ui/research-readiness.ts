import {knownBuilding256} from './exploration-readers-256';
import {isSchema276OrLater,isSchema277OrLater} from '../sim/schema-compatibility-257';
import { isColonist } from '../sim/affiliation';
import { backgroundWorkRefusal } from '../sim/colonist-backgrounds';
import { medicalWorkRefusal } from '../sim/health-rules';
import { isPowerActive } from '../sim/power-rules';
import { needsHighTechBench,needsResearchAnalyzer,researchPrerequisite,researchStationUsable,researchUnlocked,type ResearchProject } from '../sim/research';
import { structureMaxHp } from '../sim/thing-damage-rules';
import type { Pawn,Structure,World } from '../sim/types';
import { workPriority } from '../sim/work-types';
import { researchProjects } from './research-projects';

export type ResearchStationIssue='bench'|'advanced-bench'|'power'|'analyzer';
/** Ephemeral capture for one confirmed UI update, never a cache of mutable World. */
export interface ResearchStationCapture {
  readonly benchIds:readonly number[];
  readonly issues:ReadonlyMap<ResearchProject,ResearchStationIssue|undefined>;
  readonly vitalsMonitorAvailable:boolean;
}
export interface ResearchReadiness {
  readonly activeProject:ResearchProject|null;
  readonly remainingCount:number;
  readonly availableCount:number;
  readonly benchIds:readonly number[];
  readonly needProject:boolean;
  readonly localIds:readonly number[];
  /** Research background permission; temporary medical states are separate. */
  readonly capableIds:readonly number[];
  /** Player assignment remains present during sleep, draft or medical rest. */
  readonly assignedIds:readonly number[];
  readonly medicallyUnavailableIds:readonly number[];
  readonly engagedIds:readonly number[];
  readonly movingIds:readonly number[];
  readonly workingIds:readonly number[];
  readonly stationIssue:ResearchStationIssue|undefined;
}
/** The explicit version gates in selectResearch, without invoking a command. */
const minimumSchema:Partial<Record<ResearchProject,number>>={
  'long-range-mineral-scanner':298,'ship-computer':298,'ship-sensors':298,
  'tree-sowing':291,'ship-cryptosleep':277,'ship-engine':276,
  'ship-basics':275,'ship-reactor':275,prosthetics:273,cryptosleep:271,'long-blades':270,brewing:265,'geothermal-power':264,pemmican:248,'biofuel-refining':218,'nutrient-paste':217,'deep-drilling':215,'ground-scanner':215,
  'sterile-materials':211,'vitals-monitor':211,'drug-production':206,'medicine-production':206,
  hydroponics:203,'gun-turrets':193,'tube-television':190,'packaged-survival-meals':188,
  'hospital-bed':187,autodoors:143,
};
const admitted=(world:World,project:ResearchProject)=>Number.isSafeInteger(world.schemaVersion)&&Number(world.schemaVersion)<=301&&(project==='tree-sowing'?[291,292,293,294,295,296,297,298,299,300,301].includes(world.schemaVersion):project==='firefoam'?[290,291,292,293,294,295,296,297,298,299,300,301].includes(world.schemaVersion):project==='ship-cryptosleep'?isSchema277OrLater(world.schemaVersion):project==='ship-engine'?isSchema276OrLater(world.schemaVersion):world.schemaVersion>=(minimumSchema[project]??0));

const sorted=(ids:number[])=>ids.sort((a,b)=>a-b);
const local=(pawn:Pawn)=>isColonist(pawn)&&!pawn.prisoner&&!pawn.visitor&&!pawn.raid&&!pawn.podRescue&&pawn.state!=='dead'&&!pawn.health?.death;

function captureStations(world:World) {
  const retiring=new Set<number>();
  for(const job of world.jobs){
    if(job.deconstruction)retiring.add(job.deconstruction.structureId);
    if(job.kind==='uninstall'&&job.furniture)retiring.add(job.furniture.structureId);
  }
  const benches:Structure[]=[];
  let simple=false,advanced=false,poweredAdvanced=false;
  for(const structure of world.structures){
    if(!knownBuilding256(world,structure))continue;
    if((structure.kind!=='research-bench'&&structure.kind!=='hi-tech-research-bench')
      ||(structure.damage??0)>=structureMaxHp(structure)||retiring.has(structure.id))continue;
    benches.push(structure);
    if(structure.kind==='research-bench')simple=true;
    else {advanced=true;if(isPowerActive(structure))poweredAdvanced=true;}
  }
  // Only projects requiring an analyzer pay the existing spatial link predicate.
  // No paths, service claims or research-progress records are constructed here.
  let analyzer: boolean|undefined;
  const hasAnalyzer=()=>analyzer??=(poweredAdvanced&&benches.some(bench=>bench.kind==='hi-tech-research-bench'
    &&isPowerActive(bench)&&researchStationUsable(world,bench,'vitals-monitor')));
  return {benches,simple,advanced,poweredAdvanced,hasAnalyzer};
}
type StationFacts=ReturnType<typeof captureStations>;
function issue(facts:StationFacts,project:ResearchProject):ResearchStationIssue|undefined {
  if(!facts.benches.length)return needsHighTechBench(project)?'advanced-bench':'bench';
  if(needsHighTechBench(project)){
    if(!facts.advanced)return 'advanced-bench';
    if(!facts.poweredAdvanced)return 'power';
    if(needsResearchAnalyzer(project)&&!facts.hasAnalyzer())return 'analyzer';
    return undefined;
  }
  return facts.simple||facts.poweredAdvanced?undefined:'power';
}
/** Use only while the Research panel is open: all its nodes share this capture. */
export function captureResearchStationIssues(world:World):ResearchStationCapture {
  const facts=captureStations(world),issues=new Map<ResearchProject,ResearchStationIssue|undefined>();
  for(const project of researchProjects)issues.set(project.id,issue(facts,project.id));
  return {benchIds:sorted(facts.benches.map(bench=>bench.id)),issues,
    // Selection admission intentionally keeps retirement distinct from usage.
    vitalsMonitorAvailable:admitted(world,'vitals-monitor')&&!researchPrerequisite(world,'vitals-monitor')
      &&world.structures.some(bench=>knownBuilding256(world,bench)&&researchStationUsable(world,bench,'vitals-monitor'))};
}
/** Confirmed facts only. Assignment is not a promise of accessible work.
 * Without the optional panel capture, only the inspected/active project and
 * an admissible vitals-monitor selection can request the spatial link read. */
export function readResearchReadiness(world:World,inspectedProject?:ResearchProject,stationCapture?:ResearchStationCapture):ResearchReadiness {
  const activeProject=world.research?.project??null,project=inspectedProject??activeProject;
  const facts=stationCapture?undefined:captureStations(world);
  const benchIds=stationCapture?.benchIds??sorted(facts!.benches.map(bench=>bench.id));
  const benchSet=new Set(benchIds);
  const vitalsAvailable=()=>stationCapture?stationCapture.vitalsMonitorAvailable
    :world.structures.some(bench=>knownBuilding256(world,bench)&&researchStationUsable(world,bench,'vitals-monitor'));
  let remainingCount=0,availableCount=0;
  for(const candidate of researchProjects){
    if(!admitted(world,candidate.id)||researchUnlocked(world,candidate.id))continue;
    remainingCount++;
    if(researchPrerequisite(world,candidate.id))continue;
    // selectResearch permits other projects before their workstation exists.
    if(candidate.id==='vitals-monitor'&&!vitalsAvailable())continue;
    availableCount++;
  }
  const localIds:number[]=[],capableIds:number[]=[],assignedIds:number[]=[],medicallyUnavailableIds:number[]=[];
  const engagedIds:number[]=[],movingIds:number[]=[],workingIds:number[]=[];
  for(const pawn of world.pawns){
    if(!local(pawn))continue;
    localIds.push(pawn.id);
    if(backgroundWorkRefusal(pawn,'research'))continue;
    capableIds.push(pawn.id);
    if(workPriority(pawn,'research')<=0)continue;
    assignedIds.push(pawn.id);
    const medical=medicalWorkRefusal(pawn);
    if(medical)medicallyUnavailableIds.push(pawn.id);
    if(!activeProject||!pawn.research||!benchSet.has(pawn.research.stationId)||medical)continue;
    // This describes a present research task, not its future provider selection.
    if(pawn.state==='moving'){engagedIds.push(pawn.id);movingIds.push(pawn.id);}
    else if(pawn.state==='working'){engagedIds.push(pawn.id);workingIds.push(pawn.id);}
  }
  return {activeProject,remainingCount,availableCount,benchIds,needProject:benchIds.length>0&&!activeProject&&availableCount>0,
    localIds:sorted(localIds),capableIds:sorted(capableIds),assignedIds:sorted(assignedIds),medicallyUnavailableIds:sorted(medicallyUnavailableIds),
    engagedIds:sorted(engagedIds),movingIds:sorted(movingIds),workingIds:sorted(workingIds),
    stationIssue:project?(stationCapture?stationCapture.issues.get(project):issue(facts!,project)):undefined};
}

