import { actorObstacleWrites } from './combat-navigation.ts';
import { regionMapFor, regionSearchKey, regionTraversal, type RegionMap, type RegionTraversal } from './regions.ts';
import { RIM_WORK_GIVER_SEARCH, type RimWorkGiverId } from './work-givers-rimworld.ts';
import type { Cell, Pawn, World } from './types.ts';

/**
 * RimWorld's search order for one pawn's decision (GenClosest
 * .ClosestThingReachable as used by JobGiver_Work): a giver whose things are
 * stored in regions searches breadth first from the pawn's region, through the
 * regions the pawn may enter, at most `maxRegions` regions that are not
 * doors; the first region listing a valid thing wins, then the closest thing in
 * it; when none is found within the limit, the closest thing overall. A thing
 * is listed in the regions it can be worked from: its own cell and, when it is
 * touched, the cells around it.
 *
 * `key` gives a thing's place in that order (smaller first, Infinity beyond
 * the limit, 0 for a giver that searches the whole map); ties are then broken
 * by straight-line distance. The traversal is built once, on first use.
 */
export interface RegionSearch {key(cell:Cell,giver:RimWorkGiverId):number}
export function regionSearch(world:World,pawn:Pawn,grid:()=>Uint8Array,regions?:(grid:Uint8Array)=>RegionMap|undefined):RegionSearch {
  let state:{map:RegionMap;traversal:RegionTraversal}|undefined;
  const ready=()=>{
    if(!state){
      const blocked=grid(),map=regions?.(blocked)??regionMapFor(world,blocked),doors=new Map<number,0|1>();
      // The pawn's own door verdicts; other actors never close a region.
      actorObstacleWrites(world,pawn,(index,value)=>{const r=index>=0&&index<map.regionOf.length?map.regionOf[index]!:-1;if(r>=0&&map.doorCell[r]===index)doors.set(index,value);});
      state={map,traversal:regionTraversal(map,pawn.z*world.width+pawn.x,r=>{const cell=map.doorCell[r]!;return cell<0||(doors.get(cell)??map.grid[cell])===0;})};
    }
    return state;
  };
  const listingCells=(map:RegionMap,cell:Cell,touch:boolean):number[]=>{
    const i=cell.z*world.width+cell.x,own=i>=0&&i<map.regionOf.length?map.regionOf[i]!:-1;
    if(!touch&&own>=0)return [i];
    const cells=[i];
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const x=cell.x+dx,z=cell.z+dz;
      if((dx||dz)&&x>=0&&z>=0&&x<world.width&&z<world.height)cells.push(z*world.width+x);
    }
    return cells;
  };
  return {
    key(cell,giver){
      const search=RIM_WORK_GIVER_SEARCH[giver];if(!search.regionwise)return 0;
      const {map,traversal}=ready();
      return regionSearchKey(map,traversal,listingCells(map,cell,search.pathEnd==='touch'||search.pathEnd==='closest-touch'),search.maxRegions);
    },
  };
}
/** Total order on search keys (Infinity-safe). */
export const compareSearchKeys=(a:number,b:number):number=>a===b?0:a<b?-1:1;
