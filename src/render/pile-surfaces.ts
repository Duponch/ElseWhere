import { isFoodWorkstation } from '../sim/food-workstations';
import { footprintCells } from '../sim/definitions';
import type { World, Structure } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import {isShelfKind} from '../sim/shelf-storage';
import {SHELF_ITEM_SCALE,SHELF_LEVELS} from './shelf-presentation';

export interface PileSurface { x:number;y:number;z:number;scale:number;scaleHeight?:boolean;shelfId?:number;level?:number }
export interface PileSurfaceReadPair {readonly cells:ReadonlyMap<number,PileSurface>;readonly identities:ReadonlyMap<number,PileSurface>}
export type PileShelfCell=Pick<Structure,'id'|'orientation'>;
type SurfaceReads={cells?:ReadonlyMap<number,PileSurface>;identities?:ReadonlyMap<number,PileSurface>};
let retained:((world:World)=>PileSurfaceReadPair|undefined)|undefined;
let application:WeakMap<World,SurfaceReads>|undefined;
/** One synchronous scene application owns these read-only derivations. Nothing
 * survives the boundary: external mutable Worlds still get fresh reads. Old and
 * current cargo snapshots have separate entries; nested renders restore scope. */
export function withPileSurfaceReads<T>(read:()=>T,resolve?:((world:World)=>PileSurfaceReadPair|undefined)):T {
  const previous=application,previousRetained=retained;application=new WeakMap();retained=resolve;
  try{return read();}finally{application=previous;retained=previousRetained;}
}
function entry(world:World):SurfaceReads|undefined {
  if(!application)return;
  let value=application.get(world);if(!value){const prepared=retained?.(world);value=prepared?{cells:prepared.cells,identities:prepared.identities}:{};application.set(world,value);}return value;
}
/** Seat top of a chair model (habitat-parts), moved forward from the backrest
 * (local -z at orientation zero) along the chair's own rotation. */
function seatSurface(s:Structure,y:number,forward:number):PileSurface {
  const angle=(s.orientation??0)*Math.PI/2;
  return {x:Math.sin(angle)*forward,y,z:Math.cos(angle)*forward,scale:.55,scaleHeight:true};
}
const workSurface=(kind:Structure['kind']):boolean=>isFoodWorkstation(kind)||kind==='machining-table'||kind==='hi-tech-research-bench'||kind==='fabrication-bench'||kind==='multi-analyzer'||kind==='stonecutter'||kind==='drug-lab'||kind==='art-bench'||kind==='research-bench'||kind==='tailor-bench';
function pileSurfaceClass(kind:Structure['kind']):'work'|'smelter'|'smithy'|'crematorium'|'table'|'stool'|'dining-chair'|'armchair'|'couch'|'end-table'|'hopper'|'horseshoes'|undefined {
  switch(kind){
    case 'electric-crematorium':return 'crematorium';
    case 'fueled-smithy':case 'electric-smithy':return 'smithy';
    case 'electric-smelter':return 'smelter';
    case 'table':case 'stool':case 'dining-chair':case 'armchair':case 'couch':case 'end-table':case 'hopper':case 'horseshoes':return kind;
    default:return workSurface(kind)?'work':undefined;
  }
}
/** Shared classification of structures that contribute physical pile support.
 * The confirmed owner need not rebuild support maps for unrelated geometry. */
export const isPileSupportMember379=(s:Pick<Structure,'kind'>):boolean=>isShelfKind(s.kind)||pileSurfaceClass(s.kind)!==undefined;
/** Presentation only. Built per snapshot, never per frame/pile; no extra mesh. */
export function pileSurfaces(world:World):ReadonlyMap<number,PileSurface> {
  const cached=entry(world);if(cached?.cells)return cached.cells;
  const surfaces=new Map<number,PileSurface>();
  for(const s of world.structures) {
    const type=pileSurfaceClass(s.kind);if(!type)continue;
    if(type==='crematorium'){
      for(const cell of footprintCells(s))surfaces.set(cell.z*world.width+cell.x,{x:0,y:1.405,z:0,scale:.65});
      continue;
    }
    if(type==='smithy'){
      for(const cell of footprintCells(s))surfaces.set(cell.z*world.width+cell.x,{x:0,y:.87,z:0,scale:.65});
      continue;
    }
    if(type==='smelter'){
      const angle=s.orientation*Math.PI/2,c=Math.cos(angle),n=Math.sin(angle);
      for(const cell of footprintCells(s)){
        const along=(cell.x-s.x)*c-(cell.z-s.z)*n;
        surfaces.set(cell.z*world.width+cell.x,Math.abs(along)<.5
          ?{x:.64*c,y:.87,z:-.64*n,scale:.65}
          :{x:0,y:along<0?1.33:.87,z:0,scale:.65});
      }
      continue;
    }
    const surface=type==='work'?{x:0,y:WORLD_SCALE.stonecutterHeight,z:0,scale:.65}:type==='table'?{x:0,y:WORLD_SCALE.tableHeight,z:0,scale:.8}
      :type==='stool'?{x:0,y:WORLD_SCALE.stoolHeight,z:0,scale:.5}
      // Core lets an item lie on a Standable seat (DiningChair, Armchair, Couch:
      // no blocking passability, ordinary drop spot) and draws it above the
      // seat (Item altitude over Building). The pile sits on the seat in front
      // of the backrest instead of crossing the chair from the floor.
      :type==='dining-chair'?seatSurface(s,WORLD_SCALE.stoolHeight+.08,.03)
      :type==='armchair'?seatSurface(s,.44,.08):type==='couch'?seatSurface(s,.51,.08)
      :type==='end-table'?{x:0,y:WORLD_SCALE.tableHeight,z:0,scale:.6,scaleHeight:true}
      :type==='hopper'?{x:0,y:.14,z:0,scale:.72}:type==='horseshoes'?{x:-.18,y:0,z:.15,scale:.6}:undefined;
    if(surface)for(const c of footprintCells(s))surfaces.set(c.z*world.width+c.x,surface);
  }
  if(cached)cached.cells=surfaces;return surfaces;
}

/** Keyed by actual pile identity, so three stacks on one shelf cell never
 * collapse into one presentation bundle. No world state is changed. */
export function pileShelfCells(world:World):ReadonlyMap<number,PileShelfCell>{
  const cells=new Map<number,PileShelfCell>();
  for(const s of world.structures)if(isShelfKind(s.kind))for(const cell of footprintCells(s))cells.set(cell.z*world.width+cell.x,{id:s.id,orientation:s.orientation});
  return cells;
}
/** Shared exact shelf arithmetic; the owner may retain the closed geometry
 * input, while the public reader always derives it from its current World. */
export function pileIdentitySurfacesFromCells(width:number,piles:World['piles'],cells:ReadonlyMap<number,PileShelfCell>):ReadonlyMap<number,PileSurface>{
  const result=new Map<number,PileSurface>(),byCell=new Map<number,number[]>();
  if(!cells.size)return result;
  for(const pile of piles)if(pile.owner.type==='ground'){
    const key=pile.owner.z*width+pile.owner.x;
    if(cells.has(key)){const ids=byCell.get(key)??[];ids.push(pile.id);byCell.set(key,ids);}
  }
  for(const [cell,ids]of byCell){
    const shelf=cells.get(cell)!,angle=shelf.orientation*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);ids.sort((a,b)=>a-b);
    for(let level=0;level<ids.length;level++){
      const dx=(level-1)*.13,dz=.16-level*.12;
      result.set(ids[level]!,{x:dx*c+dz*s,y:SHELF_LEVELS[Math.min(level,2)]!,z:dz*c-dx*s,scale:SHELF_ITEM_SCALE,scaleHeight:true,shelfId:shelf.id,level});
    }
  }
  return result;
}
export function pileIdentitySurfaces(world:World):ReadonlyMap<number,PileSurface>{
  const cached=entry(world);if(cached?.identities)return cached.identities;
  const result=pileIdentitySurfacesFromCells(world.width,world.piles,pileShelfCells(world));
  if(cached)cached.identities=result;return result;
}
