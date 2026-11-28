import {excavatedCollapsedRock256} from './collapsed-rocks-256.ts';
import {terrainSupportsFloor256} from './natural-terrain-runtime-256.ts';
import { isBuildableFloor,isFloorKind,floorAvailable } from './flooring.ts';
import { footprintContains } from './definitions.ts';
import {sterileMaterialsUnlocked} from './research.ts';
import {developerFloorException381} from './developer-import-381.ts';
import type { World } from './types.ts';
export function validateFlooring(w:World,version:number):string[] {
  const errors:string[]=[],plans=new Set<number>();
  for(let i=0;i<w.tiles.length;i++){
    const actual=w.tiles[i]!,tile=actual.collapsedRock?excavatedCollapsedRock256(actual):actual;if(tile.floor!==undefined&&(version<89||!floorAvailable(tile.floor,version)||tile.floor==='sterile-tile'&&(version<211||!sterileMaterialsUnlocked(w))||!terrainSupportsFloor256(tile,{schemaVersion:version,site:w.site})&&!developerFloorException381(w,i,tile)))errors.push('Invalid constructed floor.');
  }
  for(const job of w.jobs){
    if(job.kind!=='lay-floor'&&job.kind!=='remove-floor'){if(job.floor!==undefined)errors.push('Unexpected floor target.');continue;}
    const index=job.z*w.width+job.x,tile=w.tiles[index];
    if(version<89||tile&&!terrainSupportsFloor256(tile,{schemaVersion:version,site:w.site})||job.floor!==undefined&&!floorAvailable(job.floor,version)||job.floor==='sterile-tile'&&version<211||!tile||plans.has(index)||job.orientation!==0||job.footprint!=='standard'||job.material!==undefined||job.kind==='lay-floor'&&(!isBuildableFloor(job.floor)||tile.floor!==undefined)||job.kind==='remove-floor'&&(!isFloorKind(job.floor)||tile.floor!==job.floor))errors.push('Invalid floor work.');
    plans.add(index);
    if(job.kind==='lay-floor'&&[...w.structures,...w.jobs].some(s=>s.kind==='grave'&&footprintContains(s,job)))errors.push('Floor would remove a grave terrain support.');
  }
  for(const s of [...w.structures,...(w.packed??[]).map(p=>p.building)])if('floor' in s)errors.push('Floor belongs to terrain, not a structure.');
  return errors;
}
