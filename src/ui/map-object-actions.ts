import {isSchema256Or257} from '../sim/schema-compatibility-257.ts';
import {materialAllowedForPlayer256} from '../sim/material-permission-256';
import {roadPropCanClaim256,roadPropCanDeconstruct256} from '../sim/local-road-prop-ownership-256';
import { footprintCells } from '../sim/definitions';
import { stripInspectorAction351 } from '../sim/strip-351';
import { choppable, harvestable, isPlant } from '../sim/plants';
import { sharesConstructionLayer } from '../sim/power-grid';
import { extractTreeReason,isMinifiedTree,isPlantDesignationJob } from '../sim/tree-transfer';
import {treePackLive} from '../sim/tree-transfer-rules';
import { isRoofJob } from '../sim/roof-rules';
import type { Cell, Command, Job, MaterialPile, Resource, Structure, World } from '../sim/types';
import { mapObjectCells, type MapObjectSelection } from './map-object-selection';
import { mapObjectGroupCells } from './map-object-group-selection';

export type MapObjectActionId = 'strip' | 'material-permission' | 'claim' | 'mine' | 'chop' | 'harvest' | 'cut' | 'haul-chunks' | 'deconstruct' | 'cancel' | 'extract' | 'replant';
export interface MapObjectAction { id: MapObjectActionId; label: string; command?: Command; placementPileId?:number }
export interface MapObjectGroupAction { id: MapObjectActionId; label: string; commands: Command[] }
const same = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
const contains = (job: Job, cell: Cell) => footprintCells(job).some(target => same(target, cell));
const cancellable = (job: Job) => job.kind !== 'repair' && job.kind !== 'fix-breakdown';
interface GroupLookups {
  resources?: Map<number, Resource>;
  firstResources?: Map<string, Resource>;
  piles?: Map<number, MaterialPile>;
  structures?: Map<number, Structure>;
}
const cellKey = (cell: Cell) => `${cell.x}:${cell.z}`;

/** A presentation offer, never command authority. Worker execution rechecks
 * eligibility, ownership and conservative drops against its current World.
 * No generic engine import or whole-map area index is needed for this menu. */
export function mapObjectActions(world: World, selected: MapObjectSelection): MapObjectAction[] {
  if (selected.kind === 'growing' || selected.kind === 'stockpile' || selected.kind === 'plan') return [];
  return actionsFor(world, selected, mapObjectCells(world, selected));
}

function actionsFor(world: World, selected: MapObjectSelection, cells: readonly Cell[], lookups?: GroupLookups): MapObjectAction[] {
  const cell = cells[0];
  if (!cell) return [];
  const actions: MapObjectAction[] = [];
  const blocked = (kind: Job['kind']|Structure['kind'], targets: readonly Cell[], deconstruct = false) => world.jobs.some(job => !isRoofJob(job)
    && !(deconstruct&&job.wallDoor296?.manual===false)
    && !(deconstruct && ['repair', 'fix-breakdown', 'flick'].includes(job.kind))
    && sharesConstructionLayer(job.furniture?.kind ?? job.deconstruction?.kind ?? job.flick?.kind ?? job.fixBreakdown?.kind ?? job.kind, kind)
    && footprintCells(job).some(at => targets.some(target => same(at, target))));
  const designate = (id: 'mine' | 'chop' | 'harvest' | 'cut', label: string) => {
    const plant=['chop','cut','harvest'].includes(id);
    if (!(plant?world.jobs.some(job=>isPlantDesignationJob(job)&&contains(job,cell)):blocked(id,[cell]))) actions.push({ id, label, command: { type: 'designate', kind: id, x: cell.x, z: cell.z } });
  };
  let ownsJob: ((job: Job) => boolean) | undefined;
  if (selected.kind === 'rock' || selected.kind === 'resource') {
    const resource = selected.kind === 'resource' ? lookups?.resources
      ? lookups.resources.get(selected.id) : world.resources.find(resource => resource.id === selected.id) : undefined;
    if (selected.kind === 'rock' || resource?.kind === 'rock') {
      if (world.tiles[cell.z * world.width + cell.x]?.terrain === 'rock') designate('mine', 'Miner');
      ownsJob = job => job.kind === 'mine'&&contains(job,cell);
    } else if (resource && (lookups?.firstResources ? lookups.firstResources.get(cellKey(cell))
      : world.resources.find(resource => same(resource, cell)))?.id === selected.id) {
      if (choppable(world, resource)) designate('chop', 'Abattre');
      if (harvestable(world, resource)) designate('harvest', 'Récolter');
      if (isPlant(resource)||resource.kind==='tree') designate('cut', resource.blight ? 'Couper ce plant malade' : 'Couper');
      if (!extractTreeReason(world,resource)) actions.push({id:'extract',label:'Déraciner',command:{type:'extract-tree',resourceId:resource.id}});
      ownsJob = job => isPlantDesignationJob(job)&&contains(job,resource);
    }
  } else if (selected.kind === 'pile') {
    const pile = lookups?.piles ? lookups.piles.get(selected.id) : world.piles.find(pile => pile.id === selected.id);
    if(isSchema256Or257(world.schemaVersion)&&pile&&pile.owner.type==='ground'&&!pile.apparel&&!pile.weapon&&!Object.hasOwn(pile,'eggForbidden')){const forbidden=!materialAllowedForPlayer256(pile);actions.push({id:'material-permission',label:forbidden?'Autoriser':'Interdire',command:{type:'material-forbid',pileId:pile.id,forbidden:!forbidden}});}
    const strip351 = pile?.humanCorpse ? stripInspectorAction351(world, pile.humanCorpse.pawnId) : undefined;
    if (strip351) actions.push({ id: 'strip', label: strip351.label, command: strip351.command });
    if (pile?.kind === 'chunk' && pile.owner.type === 'ground' && !pile.haulRequested) {
      actions.push({ id: 'haul-chunks', label: 'Transporter',
        command: { type: 'area', action: 'haul-chunks', from: { x: cell.x, z: cell.z }, to: { x: cell.x, z: cell.z } } });
    }
    if(pile?.kind==='chunk'&&pile.owner.type==='ground'&&pile.haulRequested)actions.push({id:'cancel',label:'Annuler l’ordre',command:{type:'cancel-pile',pileId:pile.id}});
    if(pile&&isMinifiedTree(pile))ownsJob=job=>job.tree?.kind==='replant'&&job.tree.sourcePileId===pile.id;
    if(pile&&isMinifiedTree(pile)&&treePackLive(pile,world.tick)&&pile.owner.type==='ground'&&!world.jobs.some(j=>j.tree?.kind==='replant'&&j.tree.sourcePileId===pile.id))actions.push({id:'replant',label:'Replanter',placementPileId:pile.id});
  } else if (selected.kind === 'structure') {
    const structure = lookups?.structures ? lookups.structures.get(selected.id) : world.structures.find(structure => structure.id === selected.id);
    if(structure&&roadPropCanClaim256(world,structure))actions.push({id:'claim',label:'Revendiquer',command:{type:'claim-road-prop',structureId:structure.id}});
    if (structure && roadPropCanDeconstruct256(world,structure)&&!world.jobs.some(job => job.furniture?.structureId === structure.id) && !blocked(structure.kind, cells, true)) {
      actions.push({ id: 'deconstruct', label: structure.kind==='sleeping-spot'||structure.kind==='double-sleeping-spot'?'Retirer l’emplacement':'Déconstruire',
        command: { type: 'designate', kind: 'deconstruct', targetId: structure.id, x: structure.x, z: structure.z } });
    }
    ownsJob = job => job.deconstruction?.structureId === selected.id&&job.wallDoor296?.manual!==false || job.furniture?.structureId === selected.id || job.flick?.structureId === selected.id;
  } else if (selected.kind === 'packed') ownsJob = job => job.furniture?.structureId === selected.id;
  else if (selected.kind === 'job') {
    if(world.jobs.some(job=>job.wallDoor296?.plan?.id===selected.id))actions.push({id:'cancel',label:'Annuler le plan de porte',command:{type:'cancel-job',jobId:selected.id}});
    else ownsJob = job => job.id === selected.id&&job.wallDoor296?.manual!==false;
  }
  // Each inspector cancels its own identity, even under another blueprint.
  const owned=ownsJob&&world.jobs.find(job=>cancellable(job)&&ownsJob!(job));
  if(owned)actions.push({id:'cancel',label:'Annuler l’ordre',command:selected.kind==='resource'&&owned.kind!=='mine'?{type:'cancel-resource',resourceId:selected.id}:{type:'cancel-job',jobId:owned.id}});
  return actions;
}

/** Group UI keeps action order and submits each physical coordinate/target once.
 * Co-located buildings retain distinct targetIds; no aggregate command invented. */
export function mapObjectGroupActions(world: World, selected: readonly MapObjectSelection[]): MapObjectGroupAction[] {
  const groups = new Map<MapObjectActionId, MapObjectGroupAction>(), seen = new Set<string>();
  const objects = selected.filter(object => object.kind !== 'growing' && object.kind !== 'stockpile');
  const cells = mapObjectGroupCells(world, objects), lookups: GroupLookups = {};
  const idsFor = (kind: MapObjectSelection['kind']) => new Set(objects.filter(object => object.kind === kind).map(object => object.id));
  const resources = idsFor('resource'), piles = idsFor('pile'), structures = idsFor('structure');
  if (resources.size) {
    lookups.resources = new Map(); lookups.firstResources = new Map();
    const wantedCells = new Set(objects.flatMap((object, index) => object.kind === 'resource' ? cells[index]!.map(cellKey) : []));
    for (const resource of world.resources) {
      if (resources.has(resource.id) && !lookups.resources.has(resource.id)) lookups.resources.set(resource.id, resource);
      const key = cellKey(resource);
      if (wantedCells.has(key) && !lookups.firstResources.has(key)) lookups.firstResources.set(key, resource);
    }
  }
  if (piles.size) {
    lookups.piles = new Map();
    for (const pile of world.piles) if (piles.has(pile.id) && !lookups.piles.has(pile.id)) lookups.piles.set(pile.id, pile);
  }
  if (structures.size) {
    lookups.structures = new Map();
    for (const structure of world.structures) if (structures.has(structure.id) && !lookups.structures.has(structure.id)) lookups.structures.set(structure.id, structure);
  }
  for (let index = 0; index < objects.length; index++) for (const action of actionsFor(world, objects[index]!, cells[index]!, lookups)) {
    if(!action.command)continue;
    const key = JSON.stringify(action.command);
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groups.get(action.id);
    if (group) {
      const first=group.commands[0];
      // actionsFor creates this envelope locally; normalize before exposure.
      if(action.id==='material-permission'&&first?.type==='material-forbid'&&action.command.type==='material-forbid')action.command.forbidden=first.forbidden;
      group.commands.push(action.command);
      if(group.label!==action.label)group.label=action.id==='deconstruct'?'Déconstruire':action.id==='cut'?'Couper':group.label;
    }
    else groups.set(action.id, { id: action.id, label: action.label, commands: [action.command] });
  }
  return [...groups.values()];
}
