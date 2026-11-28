import {isSchema256Or257} from '../sim/schema-compatibility-257.ts';
import {materialAllowedForPlayer256} from '../sim/material-permission-256';
import {eggSpeciesForItem256} from '../sim/animal-egg-content-v256';
import {eggAllowedForPlayer256} from '../sim/animal-egg-permission-v256';
import {targetBuildingPlayerUse263} from '../sim/world-target-building-263';
import {actualDeviceSwitch,canFlickDevice} from '../sim/power-flick';
import {roadPropCanClaim256,roadPropCanDeconstruct256} from '../sim/local-road-prop-ownership-256';
import { footprintCells } from '../sim/definitions';
import { stripInspectorAction351 } from '../sim/strip-351';
import { smoothWallReason367 } from '../sim/smooth-wall-367';
import { choppable, harvestable, isPlant } from '../sim/plants';
import { sharesConstructionLayer } from '../sim/power-grid';
import { extractTreeReason,isMinifiedTree,isPlantDesignationJob } from '../sim/tree-transfer';
import {treePackLive} from '../sim/tree-transfer-rules';
import { isRoofJob } from '../sim/roof-rules';
import type { Cell, Command, Job, MaterialPile, Resource, Structure, World } from '../sim/types';
import { mapObjectCells, type MapObjectSelection } from './map-object-selection';
import { mapObjectGroupCells } from './map-object-group-selection';
import {constructionForbidTarget379} from '../sim/construction-forbid-379';

export type MapObjectActionId = 'strip' | 'material-permission' | 'power-toggle' | 'claim' | 'mine' | 'smooth-wall' |'chop' | 'harvest' | 'cut' | 'haul-chunks' | 'deconstruct' | 'cancel' | 'extract' | 'replant';
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
  flicks?: Map<number, boolean>;
  removing?: Set<number>;
}
const cellKey = (cell: Cell) => `${cell.x}:${cell.z}`;

interface ToggleFact {active:boolean;command:(active:boolean)=>Command}
/** CompFlickable's gizmo reflects the requested switch, not the energized
 * circuit nor the physical switch awaiting a colonist. A second click/key
 * therefore cancels the outstanding designation instead of repeating it. */
export function requestedPowerToggle(world:World,structure:Structure,lookups?:GroupLookups):ToggleFact|undefined {
  if(!targetBuildingPlayerUse263(world,structure)||!canFlickDevice(structure)||structure.kind==='vent'&&world.schemaVersion<244)return;
  const blocked=lookups?.removing?lookups.removing.has(structure.id):world.jobs.some(j=>(j.deconstruction?.structureId??j.furniture?.structureId)===structure.id);
  if(blocked)return;
  const pending=lookups?.flicks?lookups.flicks.get(structure.id):world.jobs.find(j=>j.flick?.structureId===structure.id)?.flick?.on;
  return {active:pending??actualDeviceSwitch(structure),command:on=>({type:'power-flick',structureId:structure.id,on})};
}
function permissionToggle(world:World,object:MapObjectSelection,lookups:GroupLookups):ToggleFact|undefined {
  if(object.kind==='job'&&Number(world.schemaVersion)>=379){
    const job=constructionForbidTarget379(world,object.id);if(!job)return;
    return {active:!job.forbidden379,command:active=>({type:'construction-forbid-379',jobId:object.id,forbidden:!active})};
  }
  if(object.kind==='structure'){
    const s=lookups.structures?.get(object.id);if(!s?.door||!targetBuildingPlayerUse263(world,s))return;
    return {active:!s.door.forbidden,command:active=>({type:'door-policy',structureId:s.id,setting:'forbidden',value:!active})};
  }
  if(object.kind!=='pile')return;
  const pile=lookups.piles?.get(object.id);if(!pile||pile.owner.type!=='ground')return;
  if(pile.apparel)return {active:!pile.apparel.forbidden,command:allowed=>({type:'apparel-permission',itemId:pile.id,allowed})};
  if(pile.weapon)return {active:!pile.weapon.forbidden,command:allowed=>({type:'weapon-permission',itemId:pile.id,allowed})};
  if(world.schemaVersion>=256&&eggSpeciesForItem256(pile.item))return {active:eggAllowedForPlayer256(pile),command:active=>({type:'egg-forbid',pileId:pile.id,forbidden:!active})};
  if(isSchema256Or257(world.schemaVersion))return {active:materialAllowedForPlayer256(pile),command:active=>({type:'material-forbid',pileId:pile.id,forbidden:!active})};
}

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
  const blocked = (kind: Job['kind']|Structure['kind'], targets: readonly Cell[], deconstruct = false,orientation?:number) => world.jobs.some(job => !isRoofJob(job)
    && !(deconstruct&&job.wallDoor296?.manual===false)
    && !(deconstruct && ['repair', 'fix-breakdown', 'flick'].includes(job.kind))
    && sharesConstructionLayer(job.furniture?.kind ?? job.deconstruction?.kind ?? job.flick?.kind ?? job.fixBreakdown?.kind ?? (world.schemaVersion>=382&&job.repair?world.structures.find(s=>s.id===job.repair!.structureId)?.kind:undefined) ?? job.kind, kind,world.schemaVersion,job.orientation,orientation)
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
      // Core ReverseDesignatorDatabase: Designator_SmoothWalls is a gizmo of
      // the selected natural rock wall, offered only where it may designate.
      if (selected.kind === 'rock' && !smoothWallReason367(world, cell))
        actions.push({ id: 'smooth-wall', label: 'Lisser le mur', command: { type: 'area', action: 'smooth-wall', from: { x: cell.x, z: cell.z }, to: { x: cell.x, z: cell.z } } });
      ownsJob = job => (job.kind === 'mine' || job.kind === 'smooth-wall')&&contains(job,cell);
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
    if (structure && roadPropCanDeconstruct256(world,structure)&&!world.jobs.some(job => job.furniture?.structureId === structure.id) && !blocked(structure.kind, cells, true,structure.orientation)) {
      actions.push({ id: 'deconstruct', label: structure.kind==='sleeping-spot'||structure.kind==='double-sleeping-spot'?'Retirer l’emplacement':'Déconstruire',
        command: { type: 'designate', kind: 'deconstruct', targetId: structure.id, x: structure.x, z: structure.z } });
    }
    ownsJob = job => job.deconstruction?.structureId === selected.id&&job.wallDoor296?.manual!==false || job.furniture?.structureId === selected.id || job.flick?.structureId === selected.id;
  } else if (selected.kind === 'packed') ownsJob = job => job.furniture?.structureId === selected.id;
  else if (selected.kind === 'job') {
    const permission=permissionToggle(world,selected,lookups??{});
    if(permission)actions.push({id:'material-permission',label:permission.active?'Interdire':'Autoriser',command:permission.command(!permission.active)});
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
    lookups.flicks=new Map();lookups.removing=new Set();for(const job of world.jobs){if(job.flick&&structures.has(job.flick.structureId))lookups.flicks.set(job.flick.structureId,job.flick.on);const removing=job.deconstruction?.structureId??job.furniture?.structureId;if(removing!==undefined&&structures.has(removing))lookups.removing.add(removing);}
  }
  const permissions=new Map<string,ToggleFact>(),power=new Map<string,ToggleFact>();
  for (let index = 0; index < objects.length; index++) {
   const object=objects[index]!,key=`${object.kind}:${object.id}`;if(cells[index]!.length){const permit=permissionToggle(world,object,lookups);if(permit)permissions.set(key,permit);if(object.kind==='structure'){const structure=lookups.structures?.get(object.id),flick=structure&&requestedPowerToggle(world,structure,lookups);if(flick)power.set(key,flick);}}
   for (const action of actionsFor(world, object, cells[index]!, lookups)) {
    if(!action.command||action.id==='material-permission')continue;
    const key = JSON.stringify(action.command);
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groups.get(action.id);
    if (group) {
      group.commands.push(action.command);
      if(group.label!==action.label)group.label=action.id==='deconstruct'?'Déconstruire':action.id==='cut'?'Couper':group.label;
    }
    else groups.set(action.id, { id: action.id, label: action.label, commands: [action.command] });
   }
  }
  // Command_Toggle.activateIfAmbiguous: CompForbiddable explicitly selects
  // the active (allowed) gizmo, whereas CompFlickable prefers the inactive
  // (requested off) state. The other toggles inherit only if their state
  // agrees; hence only changed targets receive a command, independent of order.
  for(const [id,facts,activateIfMixed] of [['material-permission',permissions,false],['power-toggle',power,true]] as const){
    const values=[...facts.values()];if(!values.length)continue;
    const desired=activateIfMixed?values.some(fact=>!fact.active):!values.some(fact=>fact.active);
    groups.set(id,{id,label:id==='material-permission'?(desired?'Autoriser':'Interdire'):(desired?'Demander la mise en marche / ouverture':'Demander l’arrêt / fermeture'),commands:values.filter(fact=>fact.active!==desired).map(fact=>fact.command(desired))});
  }
  return [...groups.values()];
}

/** Reverse designators and grouped toggle gizmos, not global placement
 * modes. The caller must own the visible inspector and an actual selection. */
export function mapSelectionShortcut(world:World,selected:readonly MapObjectSelection[],key:string):MapObjectGroupAction|undefined {
  const letter=key.toLowerCase(),id=letter==='f'?'material-permission':letter==='v'?'power-toggle':letter==='c'?'cancel':letter==='x'?'deconstruct':undefined;
  return id?mapObjectGroupActions(world,selected).find(action=>action.id===id):undefined;
}
