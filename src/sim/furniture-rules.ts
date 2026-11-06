import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {ancientRepairTarget256} from './ancient-monument-runtime-256.ts';
import {treeWorkTarget} from './tree-transfer.ts';
import { reservedSource } from './materials.ts';
import { footprintCells } from './definitions.ts';
import { constructionObstruction, constructionSiteFree } from './construction-rules.ts';
import { deconstructionAvailable } from './deconstruction-rules.ts';
import type { Cell, Job, Pawn, Structure, World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface FurnitureTarget { structureId: number; kind: Structure['kind'] }
export interface PackedFurniture { building: Structure; owner: ({type:'ground'} & Cell) | {type:'pawn';pawnId:number} | {type:'inventory';pawnId:number} }
export const minifiable = (kind: string): kind is Exclude<Structure['kind'],import('./local-road-data-256.ts').LocalRoadProp256|'ship-chunk'|'ancient-cryptosleep-casket'|'cryptosleep-casket'|'insect-hive'> => ['firefoam-popper','fueled-smithy','electric-smithy','brewery','fermenting-barrel','glow-pod','urn','shelf','small-shelf','spike-trap','electric-smelter','orbital-beacon','deep-drill','vitals-monitor','drug-lab','tube-television','art-bench','hi-tech-research-bench','multi-analyzer','fabrication-bench','small-sculpture','large-sculpture','machining-table','heater','battery','fueled-stove','electric-stove','butcher-table','research-bench','tailor-bench','electric-tailor-bench','bedroll','bed','double-bed','hospital-bed','table','table-square','table-long','stool','dining-chair','armchair','end-table','dresser','flower-pot','horseshoes','chess-table','stonecutter','standing-lamp','sun-lamp'].includes(kind);
export const packedAt = (world:World, cell:Cell) => world.packed?.find(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);
export const furnitureObject = (world:World,id:number) => structureById(world,id)??world.packed?.find(p=>p.building.id===id)?.building;
export function furnitureWorkTarget(world:World,job:Job):Cell & {kind?:Job['kind']|Structure['kind']} {
  if(job.kind==='repair')return ancientRepairTarget256(world,job);
  if(job.tree)return treeWorkTarget(world,job)??job;
  if(!job.furniture)return job;
  const source=structureById(world,job.furniture!.structureId);
  if(source)return source;
  const pack=world.packed?.find(p=>p.building.id===job.furniture!.structureId);
  return pack?.owner.type==='ground'?pack.owner:{...job,kind:job.furniture.kind};
}
export function furnitureDuration(world:World,job:Job):number {
  return (structureById(world,job.furniture?.structureId)!==undefined)?Math.ceil((job.furniture?.kind==='deep-drill'?1800:200)/17):job.kind==='install'?1:12;
}
export function furnitureReady(world:World,job:Job,pawn:Pawn):boolean {
  const id=job.furniture?.structureId;if(!id)return false;
  const source=structureById(world,id),pack=world.packed?.find(p=>p.building.id===id);
  if((source??pack?.building)&&!targetBuildingPlayerUse263(world,(source??pack!.building)))return false;
  if(source&&world.jobs.some(j=>j.fixBreakdown?.structureId===id))return false;
  if(!source&&!pack||pack?.owner.type==='inventory'||pack?.owner.type==='pawn'&&pack.owner.pawnId!==pawn.id||reservedSource(world,id,pawn.id)>0)return false;
  if(source&&!deconstructionAvailable(world,{...job,deconstruction:{structureId:id,kind:source.kind}},pawn.id))return false;
  if(job.kind==='install') {
    const obstruction=constructionObstruction(world,job);
    if(obstruction.plant||obstruction.pile)return false;
    if(obstruction.pack)return false;
    if(!constructionSiteFree(world,job,pawn.id,obstruction))return false;
  }
  return true;
}

/** Both the plan and its still physical source expose the same intent. */
export function furnitureSourceCells(world:World,job:Job):Cell[] {
  const id=job.furniture?.structureId;if(!id)return [];
  const source=structureById(world,id);if(source)return footprintCells(source);
  const pack=world.packed.find(p=>p.building.id===id);
  return pack?.owner.type==='ground'?[pack.owner]:[];
}
export function furnitureIntentAt(world:World,cell:Cell):Job|undefined {
  const pack=packedAt(world,cell),packedJob=pack&&world.jobs.find(j=>j.furniture?.structureId===pack.building.id);
  if(packedJob)return packedJob;
  const object=world.structures.find(s=>footprintCells(s).some(c=>c.x===cell.x&&c.z===cell.z));
  return object?world.jobs.find(j=>j.furniture?.structureId===object.id):undefined;
}
