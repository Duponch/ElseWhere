import {geyserOwnedId256,geyserCells256,type GeyserWorld256} from '../sim/local-geyser-state-256';
import {knownPosition256} from './exploration-readers-256';
import { apparelFamily, isApparelItem } from '../sim/apparel-rules';
import { footprintCells, STRUCTURE_DEFINITIONS } from '../sim/definitions';
import type { Cell, Job, MaterialPile, Resource, World } from '../sim/types';
import { mapObjectCells, mapResourceSelectable, sameMapObject, type MapObjectSelection } from './map-object-selection';
import { selectedMapJob296, selectableMapJobs296 } from './wall-door-selection-296';
import {resourceNeverMultiSelect4871} from './map-plant-multiselect-facts';

/** Installed Core 1.6 Selector.MaxNumSelected, not a world-distance radius. */
export const MAX_MAP_OBJECT_SELECTION = 200;

interface Identity { definition:string; faction:'colony'|null }
interface Candidate { selected:MapObjectSelection; identity:Identity; cells:Cell[] }
const playerDefinition=(definition:string):Identity=>({definition,faction:'colony'});
const naturalDefinition=(definition:string):Identity=>({definition,faction:null});
const sameIdentity=(a:Identity,b:Identity)=>a.definition===b.definition&&a.faction===b.faction;
const cellOf=(cell:Cell):Cell=>({x:cell.x,z:cell.z});

function pileIdentity(pile:MaterialPile):Identity {
  // Stuff is encoded in textile ItemIds locally, but is not part of Core's
  // ThingDef equality. Different raw leathers/blocks/chunks retain their defs.
  const family=isApparelItem(pile.item)?apparelFamily(pile.item):undefined;
  return naturalDefinition(family?`apparel:${family}`:`item:${pile.item}`);
}
function resourceIdentity(resource:Resource):Identity {
  // Untyped historical plants and rocks are not assigned invented species.
  return naturalDefinition(resource.kind==='rock'
    ? `loose-rock:${resource.stone??'legacy'}`
    : `plant:${resource.species??`legacy-${resource.kind}`}`);
}
function jobIdentity(job:Job):Identity {
  if(Object.hasOwn(STRUCTURE_DEFINITIONS,job.kind)) {
    return playerDefinition(`construction:${job.construction??'blueprint'}:${job.kind}`);
  }
  if(job.kind==='install')return playerDefinition(`installation:${job.furniture?.kind??'legacy'}`);
  if(job.kind==='lay-floor')return playerDefinition(`floor-construction:${job.construction??'blueprint'}:${job.floor??'legacy'}`);
  // These are map-order targets in Elsewhere, not selectable Core Things.
  return playerDefinition(`order:${job.kind}`);
}

function targetIdentity(world:GeyserWorld256,target:MapObjectSelection):Identity|undefined {
  switch(target.kind) {
    case 'geyser':return geyserOwnedId256(world,target.id)?naturalDefinition('SteamGeyser'):undefined;
    case 'structure': {const object=world.structures.find(s=>s.id===target.id);return object?playerDefinition(`building:${object.kind}`):undefined;}
    case 'packed': {const object=world.packed.find(p=>p.building.id===target.id&&p.owner.type==='ground');return object?playerDefinition(`building:${object.building.kind}`):undefined;}
    case 'pile': {const object=world.piles.find(p=>p.id===target.id&&p.owner.type==='ground');return object?pileIdentity(object):undefined;}
    case 'resource': {const object=world.resources.find(r=>r.id===target.id);return object&&mapResourceSelectable(object)?resourceIdentity(object):undefined;}
    case 'rock': {const tile=world.tiles[target.id];return tile?.terrain==='rock'?naturalDefinition(`mineable:${tile.ore??tile.stone??'legacy'}`):undefined;}
    case 'job': {const object=selectedMapJob296(world,target.id);return object?jobIdentity(object):undefined;}
    // Zones keep their own editing and selection pipeline.
    case 'growing': case 'stockpile': return undefined;
  }
}

/** The first eligible Thing under the mouse, independent of the previous
 * ordinary-click cycling slot. Actor priority remains in ColonyRenderer.
 * Singleselect/selectable flags and the physical candidate order are unchanged.
 */
export function mapObjectGroupTarget(world:GeyserWorld256,underMouse:readonly MapObjectSelection[]):MapObjectSelection|undefined {
  return underMouse.find(target=>{
    if(target.kind==='resource'){
      const resource=world.resources.find(value=>value.id===target.id);
      if(!resource||resourceNeverMultiSelect4871(resource))return false;
    }
    return !!targetIdentity(world,target)&&mapObjectCells(world,target).length>0;
  });
}

/**
 * Same physical ThingDef/faction on the current screen, up to Core's 200 cap.
 * The renderer supplies its camera/viewport test; there is no circular radius.
 * Installed and ground-minified furniture share their inner definition. Stuff,
 * quality, damage, rotation and stack size do not discriminate the group.
 * Confirmed concrete plant definitions keep Core's neverMultiSelect flags.
 * Unresolved historical non-tree plants and non-plant extensions remain
 * explicit local behavior, not a new claim of exhaustive Core equivalence.
 */
export function matchingMapObjects(world:GeyserWorld256,target:MapObjectSelection,visibleCell:(cell:Cell)=>boolean):MapObjectSelection[] {
  if(target.kind==='resource'){
    const resource=world.resources.find(value=>value.id===target.id);
    if(!resource||resourceNeverMultiSelect4871(resource))return [];
  }
  if(!mapObjectCells(world,target).length)return [];
  const identity=targetIdentity(world,target);if(!identity)return [];
  const candidates:Candidate[]=[];
  const add=(selected:MapObjectSelection,value:Identity,cells:Cell[])=>{
    if(sameIdentity(identity,value))candidates.push({selected,identity:value,cells});
  };
  switch(target.kind) {
    case 'geyser':
      for(const g of world.geysers?.items??[])add({kind:'geyser',id:g.id},naturalDefinition('SteamGeyser'),geyserCells256(world.width,g).map(i=>({x:i%world.width,z:Math.floor(i/world.width)})));
      break;
    case 'structure': case 'packed':
      for(const object of world.structures)add({kind:'structure',id:object.id},playerDefinition(`building:${object.kind}`),footprintCells(object));
      for(const object of world.packed)if(object.owner.type==='ground')add({kind:'packed',id:object.building.id},playerDefinition(`building:${object.building.kind}`),[cellOf(object.owner)]);
      break;
    case 'pile':
      for(const object of world.piles)if(object.owner.type==='ground')add({kind:'pile',id:object.id},pileIdentity(object),[cellOf(object.owner)]);
      break;
    case 'resource':
      for(const object of world.resources)if(mapResourceSelectable(object)&&!resourceNeverMultiSelect4871(object))add({kind:'resource',id:object.id},resourceIdentity(object),[cellOf(object)]);
      break;
    case 'rock':
      for(let id=0;id<world.tiles.length;id++) {
        const tile=world.tiles[id]!;
        if(tile.terrain==='rock')add({kind:'rock',id},naturalDefinition(`mineable:${tile.ore??tile.stone??'legacy'}`),[{x:id%world.width,z:Math.floor(id/world.width)}]);
      }
      break;
    case 'job':
      for(const object of selectableMapJobs296(world))add({kind:'job',id:object.id},jobIdentity(object),footprintCells(object));
      break;
  }
  const visible=candidates.flatMap(candidate=>{
    let firstCell=Infinity;
    for(const cell of candidate.cells)if(cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height&&knownPosition256(world,cell)&&visibleCell(cell)) {
      firstCell=Math.min(firstCell,cell.z*world.width+cell.x);
    }
    return Number.isFinite(firstCell)?[{selected:candidate.selected,firstCell}]:[];
  });
  // Core's first click already retained the clicked target. Preserve it even
  // when the on-screen population reaches the cap; then traverse z/x cells.
  if(!visible.some(candidate=>sameMapObject(candidate.selected,target)))return [];
  visible.sort((a,b)=>Number(sameMapObject(b.selected,target))-Number(sameMapObject(a.selected,target))||a.firstCell-b.firstCell);
  const result:MapObjectSelection[]=[],seen=new Set<string>();
  for(const candidate of visible) {
    const key=`${candidate.selected.kind}:${candidate.selected.id}`;
    if(seen.has(key))continue;
    seen.add(key);result.push(candidate.selected);
    if(result.length===MAX_MAP_OBJECT_SELECTION)break;
  }
  return result;
}

/** One adoption-local scan per requested family, avoiding N repeated finds. */
export function mapObjectGroupCells(world:GeyserWorld256,selections:readonly MapObjectSelection[]):Cell[][] {
  const indexes=new Map<MapObjectSelection['kind'],Map<number,Cell[]>>();
  for(const selected of selections) {
    let index=indexes.get(selected.kind);if(!index)indexes.set(selected.kind,index=new Map());
    index.set(selected.id,[]);
  }
  const geysers=indexes.get('geyser');
  if(geysers)for(const g of world.geysers?.items??[])if(geysers.has(g.id))geysers.set(g.id,geyserCells256(world.width,g).map(i=>({x:i%world.width,z:Math.floor(i/world.width)})));
  const structures=indexes.get('structure');
  if(structures)for(const object of world.structures)if(structures.has(object.id))structures.set(object.id,footprintCells(object));
  const jobs=indexes.get('job');
  if(jobs)for(const object of selectableMapJobs296(world))if(jobs.has(object.id))jobs.set(object.id,footprintCells(object));
  const resources=indexes.get('resource');
  if(resources)for(const object of world.resources)if(resources.has(object.id)&&mapResourceSelectable(object))resources.set(object.id,[cellOf(object)]);
  const piles=indexes.get('pile');
  if(piles)for(const object of world.piles)if(piles.has(object.id)&&object.owner.type==='ground')piles.set(object.id,[cellOf(object.owner)]);
  const packed=indexes.get('packed');
  if(packed)for(const object of world.packed)if(packed.has(object.building.id)&&object.owner.type==='ground')packed.set(object.building.id,[cellOf(object.owner)]);
  const rocks=indexes.get('rock');
  if(rocks)for(const id of rocks.keys())if(world.tiles[id]?.terrain==='rock')rocks.set(id,[{x:id%world.width,z:Math.floor(id/world.width)}]);
  for(const selected of selections)if(selected.kind==='growing'||selected.kind==='stockpile')indexes.get(selected.kind)!.set(selected.id,mapObjectCells(world,selected));
  return selections.map(selected=>{const cells=indexes.get(selected.kind)!.get(selected.id)!;return cells.some(c=>knownPosition256(world,c))?cells.map(cellOf):[];});
}
