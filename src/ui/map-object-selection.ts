import {geyserAt256,geyserOwnedId256,geyserCells256} from '../sim/local-geyser-state-256';
import {knownPosition256} from './exploration-readers-256';
import { footprintCells } from '../sim/definitions';
import type { Cell, Resource, World } from '../sim/types';
import { stockpileZoneCells } from '../sim/stockpile-zones';
import { selectedMapJob296 } from './wall-door-selection-296';
import { planAt369,planById369 } from '../sim/plans-369';

/** Core's incidental foliage remains a hover readout, not a selectable Thing. */
export const mapResourceSelectable=(resource:Resource):boolean=>!['grass','tall-grass','brambles','moss','astragalus','chokevine','dandelion','low-shrub'].includes(resource.species??'');

/** Terrain and constructed floors are readouts, never selection targets. */
export type MapObjectSelection = { kind:'geyser'|'packed'|'pile'|'structure'|'resource'|'rock'|'job'|'growing'|'stockpile'|'plan'; id:number };

export function mapObjectsAt(world:World,cell:Cell):MapObjectSelection[] {
  const same=(other:Cell)=>other.x===cell.x&&other.z===cell.z;
  const inFootprint=(object:World['structures'][number]|World['jobs'][number])=>footprintCells(object).some(same);
  const geyser=geyserAt256(world,cell);
  const harvested=geyser&&world.structures.some(s=>s.kind==='geothermal-generator'&&s.geothermal?.geyserId===geyser.id&&s.x+2===geyser.x&&s.z+2===geyser.z);
  const jobs:MapObjectSelection[]=[];
  for(const job of world.jobs)if(inFootprint(job)){
    if(job.wallDoor296?.manual!==false)jobs.push({kind:'job',id:job.id});
    if(job.wallDoor296?.plan)jobs.push({kind:'job',id:job.wallDoor296.plan.id});
  }
  return [
    ...(geyser&&!harvested?[{kind:'geyser' as const,id:geyser.id}]:[]),
    ...world.packed.filter(p=>p.owner.type==='ground'&&same(p.owner)).map(p=>({kind:'packed' as const,id:p.building.id})),
    ...world.piles.filter(p=>p.owner.type==='ground'&&same(p.owner)).map(p=>({kind:'pile' as const,id:p.id})),
    ...world.structures.filter(inFootprint).sort((a,b)=>Number(a.kind==='power-conduit')-Number(b.kind==='power-conduit')).map(s=>({kind:'structure' as const,id:s.id})),
    ...(geyser&&harvested?[{kind:'geyser' as const,id:geyser.id}]:[]),
    ...world.resources.filter(r=>same(r)&&mapResourceSelectable(r)).map(r=>({kind:'resource' as const,id:r.id})),
    ...(world.tiles[cell.z*world.width+cell.x]?.terrain==='rock'?[{kind:'rock' as const,id:cell.z*world.width+cell.x}]:[]),
    ...jobs,
    ...world.growingZones.filter(z=>z.cells.includes(cell.z*world.width+cell.x)).map(z=>({kind:'growing' as const,id:z.id})),
    ...world.stockpiles.filter(same).map(s=>({kind:'stockpile' as const,id:s.id})),
    // Schema 369: Core selects a plan after the things and the zone of a cell.
    ...(planAt369(world,cell)?[{kind:'plan' as const,id:planAt369(world,cell)!.id}]:[]),
  ].filter(selected=>mapObjectExists(world,selected));
}

function physicalMapObjectCells(world:World,selected:MapObjectSelection):Cell[] {
  switch(selected.kind) {
    case 'geyser': {const g=geyserOwnedId256(world,selected.id);return g?geyserCells256(world.width,g).map(i=>({x:i%world.width,z:Math.floor(i/world.width)})):[];}
    case 'packed': {const packed=world.packed.find(p=>p.building.id===selected.id);return packed?.owner.type==='ground'?[packed.owner]:[];}
    case 'pile': {const pile=world.piles.find(p=>p.id===selected.id);return pile?.owner.type==='ground'?[pile.owner]:[];}
    case 'structure': {const structure=world.structures.find(s=>s.id===selected.id);return structure?footprintCells(structure):[];}
    case 'resource': {const resource=world.resources.find(r=>r.id===selected.id);return resource&&mapResourceSelectable(resource)?[resource]:[];}
    case 'rock': {const tile=world.tiles[selected.id];return tile?.terrain==='rock'?[{x:selected.id%world.width,z:Math.floor(selected.id/world.width)}]:[];}
    case 'job': {const job=selectedMapJob296(world,selected.id);return job?footprintCells(job):[];}
    case 'growing': {const zone=world.growingZones.find(z=>z.id===selected.id);return zone?.cells.map(i=>({x:i%world.width,z:Math.floor(i/world.width)}))??[];}
    case 'stockpile': return stockpileZoneCells(world,selected.id);
    case 'plan': return planById369(world,selected.id)?.cells.map(i=>({x:i%world.width,z:Math.floor(i/world.width)}))??[];
  }
}

export function mapObjectCells(world:World,selected:MapObjectSelection):Cell[] {
 const cells=physicalMapObjectCells(world,selected);return cells.some(c=>knownPosition256(world,c))?cells:[];
}
export function mapObjectExists(world:World,selected:MapObjectSelection):boolean {
  if(!mapObjectCells(world,selected).length)return false;
  switch(selected.kind){
    case 'geyser':return !!geyserOwnedId256(world,selected.id);
    case 'packed':return world.packed.some(p=>p.building.id===selected.id&&p.owner.type==='ground');
    case 'pile':return world.piles.some(p=>p.id===selected.id&&p.owner.type==='ground');
    case 'structure':return world.structures.some(s=>s.id===selected.id);
    case 'resource':return world.resources.some(r=>r.id===selected.id&&mapResourceSelectable(r));
    case 'rock':return world.tiles[selected.id]?.terrain==='rock';
    case 'job':return !!selectedMapJob296(world,selected.id);
    case 'growing':return world.growingZones.some(z=>z.id===selected.id&&z.cells.length>0);
    case 'stockpile':return world.stockpiles.some(s=>s.id===selected.id);
    case 'plan':return !!planById369(world,selected.id);
  }
}

export function sameMapObject(a:MapObjectSelection|undefined,b:MapObjectSelection|undefined):boolean {
  return !!a&&!!b&&a.kind===b.kind&&a.id===b.id;
}

export function nextMapObject(world:World,cell:Cell,current:MapObjectSelection|undefined):MapObjectSelection|undefined {
  const objects=mapObjectsAt(world,cell);
  if(!objects.length)return undefined;
  const index=objects.findIndex(object=>sameMapObject(object,current));
  return objects[(index+1)%objects.length];
}
