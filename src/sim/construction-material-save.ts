import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {validConstructionMarkers379} from './construction-state-379.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
import {isShipAddedKind276} from './ship-part-content-276.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import { constructionRecipe, validConstructionMaterial } from './construction-materials.ts';
import type { World } from './types.ts';

/** Runs after collection shapes, before any planner-based order validation. */
export function validateConstructionMaterials(world:World,version:number,packedRecords?:readonly PackedFurniture[]):string[];
export function validateConstructionMaterials(world:Pick<World,'tick'>,version:number,packedRecords:readonly PackedFurniture[]):string[];
export function validateConstructionMaterials(world:World|Pick<World,'tick'>,version:number,packedRecords?:readonly PackedFurniture[]):string[] {
  const local='structures'in world?world:undefined;if(!packedRecords&&!local)return ['Material validation requires an actual map or explicit packed records.'];
  const errors:string[]=[];
  for(const entity of packedRecords?packedRecords.map(p=>p.building):[...local!.jobs,...local!.structures,...(local!.packed??[]).map(p=>p.building)]) {
    if(!validConstructionMarkers379(entity,version))errors.push('Invalid or future construction permission/material provenance.');
    if(entity.kind==='torch-lamp'&&(version<249||entity.material!=='wood'||entity.orientation!==0||entity.footprint!=='standard'))errors.push('Torch lamp requires V249, wood and fixed orientation.');
    if(entity.kind==='egg-box'&&(version<374||entity.material!=='wood'&&entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Egg box requires V374, wood or steel and its standard footprint.');
    if(entity.kind==='tool-cabinet'&&(version<355||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Tool cabinet requires V355, steel and its standard footprint.');
    if(entity.kind==='vitals-monitor'&&(version<211||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Vitals monitor requires V211 and steel.');
    if(entity.kind==='drug-lab'&&(version<206||!validConstructionMaterial(entity.kind,entity.material,version)||entity.footprint!=='standard'))errors.push('Drug lab requires V206, wood or steel and its standard footprint.');
    if(entity.kind==='hydroponics-basin'&&(version<203||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Hydroponics basin requires V203 and steel.');
    if(entity.kind==='mini-turret'&&(version<193||entity.material!=='steel'||entity.orientation!==0||entity.footprint!=='standard'))errors.push('Mini turret requires V193, steel and fixed orientation.');
    if(isShipCasketKind277(entity.kind)&&(!isSchema277OrLater(version)||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Ship cryptosleep casket requires V277, steel and its standard footprint.');
    if(isShipAddedKind276(entity.kind)&&(!isSchema276OrLater(version)||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Ship beam/engine requires V276, steel and its standard footprint.');
    if(entity.kind==='ship-reactor'&&(!isSchema275OrLater(version)||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Ship reactor requires V275, steel and its standard footprint.');
    if(entity.kind==='cryptosleep-casket'&&(!isSchema271OrLater(version)||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Ordinary cryptosleep casket requires V271, steel and its standard footprint.');
    if(entity.kind==='tube-television'&&(version<190||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Tube television requires V190 and steel.');
    if(entity.kind==='sandbags'&&(version<189||entity.material!=='cloth'||entity.orientation!==0||entity.footprint!=='standard'))errors.push('Sandbags require V189, cloth and fixed orientation.');
    if(entity.kind==='barricade'&&(version<382||!validConstructionMaterial(entity.kind,entity.material,version)||entity.orientation!==0||entity.footprint!=='standard'))errors.push('Barricades require V382, valid Stuff and fixed orientation.');
    if(['grave','lay-floor','remove-floor'].includes(entity.kind)&&(version<89||entity.material!==undefined))errors.push('Terrain work requires V89 without a building material.');
    if(['fueled-stove','electric-stove','butcher-table'].includes(entity.kind)&&(version<84||entity.material!==(entity.kind==='butcher-table'?'wood':'steel')||entity.footprint!=='standard'))errors.push('Food workstation requires V84 and its fixed material.');
    if(entity.kind==='sun-lamp'&&(version<177||entity.material!=='steel'||entity.orientation!==0||entity.footprint!=='standard'))errors.push('Sun lamp requires V177, steel and fixed orientation.');
    if(entity.kind==='vent'&&(version<244||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Vent requires V244, steel and its standard footprint.');
    if(entity.kind==='cooler'&&(version<75||entity.material!=='steel'||entity.footprint!=='standard'))errors.push('Cooler requires V75 and steel.');
    if(entity.kind==='passive-cooler'&&(version<40||entity.material!=='wood'||entity.orientation!==0))errors.push('Passive cooler requires V40, wood and fixed orientation.');
    if((entity.kind==='door'||entity.kind==='autodoor')&&(version<(entity.kind==='autodoor'?143:34)||entity.material===undefined))errors.push('Door requires its schema and an explicit material.');
    if((entity.kind==='research-bench'||entity.kind==='tailor-bench')&&(version<73||entity.material===undefined))errors.push('Research and tailoring benches require V73 and explicit materials.');
    if(entity.kind==='machining-table'&&(version<101||entity.material!=='steel'))errors.push('Machining table requires V101 and steel.');
    if(entity.kind==='art-bench'&&(version<104||entity.material!=='wood'&&entity.material!=='steel'))errors.push('Art bench requires V104 and wood or steel.');
    if(entity.kind==='chess-table'&&(version<122||!validConstructionMaterial(entity.kind,entity.material,version)))errors.push('Chess table requires V122, complex furniture and a hard material.');
    if((entity.kind==='small-sculpture'||entity.kind==='large-sculpture')&&(version<104||!validConstructionMaterial(entity.kind,entity.material,version)||entity.orientation!==0||entity.footprint!=='standard'))errors.push('Sculpture requires V104, its material and fixed orientation.');
    if(entity.kind==='electric-tailor-bench'&&(version<90||entity.material===undefined))errors.push('Electric tailoring bench requires V90 and explicit materials.');
    if(entity.kind==='stonecutter'&&(version<31||entity.material===undefined))errors.push('Stonecutter requires V31 and an explicit material.');
    if(entity.material!==undefined&&(version<30||!validConstructionMaterial(entity.kind,entity.material,version)||entity.footprint==='legacy-single'))errors.push('Invalid or future construction material.');
  }
  if(packedRecords)return errors;
  if(local!.jobs.some(job=>job.kind==='small-sculpture'||job.kind==='large-sculpture'))errors.push('Sculptures cannot be construction jobs.');
  // V2–V4 do not have ItemId; their kind/escrow checks remain in validateSchema.
  if(errors.length||version<5)return errors;
  const delivered=new Map<number,Map<string,number>>();
  for(const p of local!.piles)if(p.owner.type==='job') {
    const amounts=delivered.get(p.owner.jobId)??new Map<string,number>();amounts.set(p.item,(amounts.get(p.item)??0)+p.quantity);delivered.set(p.owner.jobId,amounts);
  }
  for(const job of local!.jobs)for(const [item,quantity] of delivered.get(job.id)??[]) {
    if(job.kind==='smooth-floor'){errors.push('Natural floor smoothing cannot receive construction materials.');continue;}
    if(job.kind==='smooth-wall'){errors.push('Natural wall smoothing cannot receive construction materials.');continue;}
    if(quantity>(constructionRecipe(job).ingredients.find(c=>c.item===item)?.quantity??0))errors.push('Unrequested or excess construction material.');
    if(job.construction==='blueprint')errors.push('Blueprint already contains construction materials.');
  }
  return errors;
}
