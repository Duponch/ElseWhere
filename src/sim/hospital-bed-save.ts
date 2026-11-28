import { isFurnitureQuality } from './furniture-stats.ts';
import { COMPLEX_FURNITURE_RESEARCH_COST,HOSPITAL_BED_RESEARCH_COST,MICROELECTRONICS_RESEARCH_COST } from './research.ts';
import type { Structure,World } from './types.ts';
import {developerResearchPlacement381} from './developer-import-381.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max:number):boolean=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const progress=(v:unknown,cost:number,tick:number,active=false):boolean=>object(v)&&Object.keys(v).every(k=>k==='points'||k==='completedAt')&&integer(v.points,0,cost)
  &&(v.completedAt===undefined?Number(v.points)<cost:!active&&v.points===cost&&integer(v.completedAt,0,tick));

/** Shared by strict save validation and the atomic snapshot reader. No world
 * repair, material lookup, spatial search or temporary combined collection. */
export function validHospitalBedState(w:World,version:number):boolean {
  const research=w.research,entry=research?.hospitalBed,active=research?.project==='hospital-bed';
  const unlocked=entry?.completedAt!==undefined;
  if((entry!==undefined||active)&&(version<187||!progress(entry,HOSPITAL_BED_RESEARCH_COST,w.tick,active)
    ||!progress(research?.microelectronics,MICROELECTRONICS_RESEARCH_COST,w.tick)||research?.microelectronics?.completedAt===undefined
    ||!progress(research?.complexFurniture,COMPLEX_FURNITURE_RESEARCH_COST,w.tick)||research?.complexFurniture?.completedAt===undefined))return false;
  const building=(s:Structure):boolean=>s.kind!=='hospital-bed'||version>=187&&(unlocked||developerResearchPlacement381(w,s))&&s.material==='steel'&&isFurnitureQuality(s.quality)&&s.footprint==='standard'
    &&integer(s.orientation,0,3)&&(s.damage===undefined||integer(s.damage,1,149))
    &&(s.medical===undefined||s.medical===true)&&(s.prisoner===undefined||s.prisoner===true);
  for(const s of w.structures)if(!building(s))return false;
  for(const p of w.packed??[])if(!building(p.building))return false;
  for(const job of w.jobs){
    if(job.kind==='hospital-bed'&&(version<187||!unlocked||job.material!=='steel'||job.footprint!=='standard'||!integer(job.orientation,0,3)))return false;
    if((job.furniture?.kind==='hospital-bed'||job.deconstruction?.kind==='hospital-bed')&&(version<187||!unlocked||job.footprint!=='standard'))return false;
  }
  return true;
}
