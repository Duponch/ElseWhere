import {extractTreeDefinition} from './tree-transfer-rules.ts';
import {clearingDuration,prospectivePlantWorkCore256} from './gathering.ts';
import {terrainGroundFertility256,terrainHasProspectiveRules256} from './natural-terrain-runtime-256.ts';
import {workOutputPending} from './construction-plants.ts';
import { furnitureDuration,packedAt } from './furniture-rules.ts';
import { constructionRecipe } from './construction-materials.ts';
import { deconstructionDuration } from './deconstruction-rules.ts';
import { footprintCells, footprintContains, JOB_DURATION, STRUCTURE_DEFINITIONS } from './definitions.ts';
import { captureStructureNavigation } from './structure-navigation.ts';
import {geyserBlocksPlantOrFloor256} from './local-geyser-state-256.ts';
import { isCrop, isPlant, plantGrowth, PLANT_DEFINITIONS, sowingTemperatureAllowed } from './plants.ts';
import { TemperatureView, outdoorTemperature,temperatureAt } from './temperature.ts';
import { releaseWork, type DropPlan } from './work-release.ts';
import { isGrowingTerrain } from './soil.ts';
import { createPlantLife } from './plant-life.ts';
import { sowDaylily } from './flower-pot.ts';
import { plantSkill } from './plant-skills.ts';
import { hydroponicBasinAt,hydroponicCropAllowed,hydroponicSowingAllowed } from './hydroponics.ts';
import {isRoofed} from './roof-rules.ts';
import {FLORA_DEFINITIONS} from './biome-flora.ts';
import {choppable,plantCanYieldNow} from './plants.ts';
import {isForestrySpecies291,forestSowingChoices291,growingPlantMinFertility291,growingPlantSowSkill291,growingPlantSowTicks291} from './forestry-content-291.ts';
import type { GrowingZone, Job, JobKind, Pawn, Resource, World } from './types.ts';

export const FARM_SCAN_INTERVAL = 10;
export const FARM_SCAN_BUDGET = 512;
export const FARM_QUEUE_LIMIT = 128;
const index = (world: World, cell: { x: number; z: number }) => cell.z * world.width + cell.x;

// Derived indices contain no continuation state. Producers replace the arrays;
// save/resume reconstructs these indices and retains the serialized scan cursor.
const resourcesCache = new WeakMap<World, { source: Resource[]; cells: Map<number, Resource> }>();
export const resourceAt = (world: World, cell: number): Resource | undefined => resourceCells(world).get(cell);
function resourceCells(world: World): Map<number, Resource> {
  let cached = resourcesCache.get(world);
  if (!cached || cached.source !== world.resources) {
    // Same last-wins cell map, without an intermediate [cell, resource] pair per plant.
    const cells = new Map<number, Resource>();
    for (const r of world.resources) cells.set(index(world, r), r);
    cached = { source: world.resources, cells };
    resourcesCache.set(world, cached);
  }
  return cached.cells;
}
const zonesCache = new WeakMap<World, { source: GrowingZone[]; entries: { zone: GrowingZone; cell: number }[]; byCell: Map<number, GrowingZone>; byId: Map<number,GrowingZone> }>();
function zoneCells(world: World) {
  let cached = zonesCache.get(world);
  if (!cached || cached.source !== world.growingZones) {
    const entries = world.growingZones.flatMap(zone => zone.cells.map(cell => ({ zone, cell })));
    cached = { source: world.growingZones, entries, byCell: new Map(entries.map(e => [e.cell, e.zone])), byId:new Map(world.growingZones.map(zone=>[zone.id,zone])) };
    zonesCache.set(world, cached);
  }
  return cached;
}
export const growingZoneAt = (world: World, cell: number): GrowingZone | undefined => zoneCells(world).byCell.get(cell);
// Index all sowing intentions once; the live reservation on each Job remains
// authoritative. A planner can accept another job during this same tick.
const sowIndices=new WeakMap<World,{source:Job[];length:number;cells:Map<number,Job[]>}>();
function sowCells(world:World):Map<number,Job[]>{
 let entry=sowIndices.get(world);if(!entry||entry.source!==world.jobs||entry.length!==world.jobs.length){
  const cells=new Map<number,Job[]>();for(const job of world.jobs)if(job.kind==='sow'&&job.growingZoneId!==undefined){const cell=index(world,job),rows=cells.get(cell)??[];rows.push(job);cells.set(cell,rows);}
  entry={source:world.jobs,length:world.jobs.length,cells};sowIndices.set(world,entry);
 }return entry.cells;
}
function adjacentCells291(world:World,cell:number):number[]{
 const x=cell%world.width,z=Math.floor(cell/world.width),cells:number[]=[];
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(dx||dz){const nx=x+dx,nz=z+dz;if(nx>=0&&nz>=0&&nx<world.width&&nz<world.height)cells.push(nz*world.width+nx);}return cells;
}
const sameGrowingPlant291=(resource:Resource,zone:GrowingZone):boolean=>isForestrySpecies291(zone.plant)?resource.kind==='tree'&&resource.species===zone.plant:resource.kind===zone.plant;
/** Trees block their neighbours. A newly planted tree additionally respects
 * every cultivated crop and the actual sown provenance of transplanted trees. */
function sowBlocker291(world:World,zone:GrowingZone,cell:number,resources:Map<number,Resource>,sows:Map<number,Job[]>,ownJob?:number):{cell:number;resource?:Resource}|undefined{
 const forest=isForestrySpecies291(zone.plant);
 for(const next of adjacentCells291(world,cell)){
  const resource=resources.get(next);
  if(resource&&(resource.kind==='tree'||forest&&(isCrop(resource)||resource.sown291===true)))return {cell:next,resource};
  for(const job of sows.get(next)??[]){if(job.id===ownJob||job.reservedBy===null)continue;const other=zoneCells(world).byId.get(job.growingZoneId!);if(other&&(forest||isForestrySpecies291(other.plant)))return {cell:next};}
 }return;
}
/** Admission only: accepted work keeps its captured reservation even if the
 * worker later loses a level. Clearing and harvesting have no sowing minimum. */
export function sowingJobAllowed(world:World,pawn:Pawn,job:Pick<Job,'kind'|'growingZoneId'>):boolean {
  if(job.kind!=='sow'||job.growingZoneId===undefined)return true;
  const zone=zoneCells(world).byId.get(job.growingZoneId);
  if(!zone)return true;
  if(!hydroponicSowingAllowed(world,zone)||plantSkill(pawn).level<growingPlantSowSkill291(zone.plant))return false;
  if(world.schemaVersion<291)return true;
  const actual=job as Job,cell=index(world,actual);
  if(isForestrySpecies291(zone.plant)){
    if(!forestSowingChoices291(world).includes(zone.plant)||isRoofed(world,cell))return false;
    const temperature=temperatureAt(world,actual);if(!(temperature>0&&temperature<FLORA_DEFINITIONS[zone.plant].maxGrowthTemperature))return false;
  }
  return !sowBlocker291(world,zone,cell,resourceCells(world),sowCells(world),actual.id);
}
/** Presentation may supply the already captured target; omission keeps the
 * simulation's existing spatial cache. null means the target is absent. */
export function jobDuration(world: World, job: Job, capturedResource?:Resource|null): number {
  if(job.tree?.kind==='extract')return extractTreeDefinition(world.resources.find(r=>r.id===job.tree!.resourceId)??{kind:'tree'})?.workCore??800;
  if(job.tree?.kind==='replant')return job.tree.durationCore??800;
  if(job.flowerPotId!==undefined&&job.kind==='sow')return 54;
  if(job.kind==='sow'&&job.growingZoneId!==undefined&&zoneCells(world).byId.get(job.growingZoneId)?.plant==='haygrass')return 17;
  if(job.kind==='sow'&&job.growingZoneId!==undefined&&zoneCells(world).byId.get(job.growingZoneId)?.plant==='healroot')return 80;
  if(world.schemaVersion>=291&&job.kind==='sow'&&job.growingZoneId!==undefined){const plant=zoneCells(world).byId.get(job.growingZoneId)?.plant;if(plant&&isForestrySpecies291(plant))return growingPlantSowTicks291(plant);}
  if(job.kind==='build-bridge'||job.kind==='remove-bridge'||job.kind==='lay-floor'||job.kind==='remove-floor'||job.kind==='grave')return constructionRecipe(job).work;
  if(job.kind==='mine'&&job.pickTicks!==undefined)return job.pickTicks/10;
  if(job.furniture)return furnitureDuration(world,job);
  if(job.kind==='repair')return job.repair?.warmed?20:80;
  if(job.kind==='deconstruct')return deconstructionDuration(job);
  if(job.material!==undefined)return constructionRecipe(job).work;
  if(world.schemaVersion>=256&&job.flowerPotId===undefined&&['harvest','cut','chop'].includes(job.kind)){
    const source=capturedResource===undefined?resourceCells(world).get(index(world,job)):capturedResource;
    const core=source&&prospectivePlantWorkCore256(source);if(core!==undefined&&core!==null)return core/10;
  }
  if(job.kind==='harvest'||job.kind==='cut'){
    const resource=capturedResource===undefined?resourceCells(world).get(index(world,job)):capturedResource;
    // Only a paid ground CUT boundary keeps its healthy duration after an
    // actual infection. Nonterminal and historical blighted work stays literal.
    if(world.schemaVersion>=235&&job.kind==='cut'&&job.flowerPotId===undefined&&resource?.blight&&workOutputPending(job,clearingDuration(resource)))return clearingDuration(resource);
    if(job.kind==='cut'&&resource?.blight)return (resource.kind==='healroot'?40:20)/(3.3-2.3*plantGrowth(world,resource));
    if(job.kind==='harvest'&&(resource?.species==='healroot-wild'||resource?.kind==='healroot'))return 40;
    if(isCrop(resource??{kind:'rock'}))return 20;
  }
  return JOB_DURATION[job.kind];
}
interface Context { resources: Map<number, Resource>; fixed: Set<number>; hydroBlocked?:Set<number>; temperatures:TemperatureView;sows:Map<number,Job[]>;forestry:ReadonlySet<string> }
function placedAndPlannedCells(world:World,planned:readonly Job[],placed:(s:World['structures'][number])=>boolean):Set<number> {
  const cells=new Set<number>();
  for(const {structure,cells:footprint} of captureStructureNavigation(world).entries)if(placed(structure))for(const i of footprint)cells.add(i);
  for(const job of planned)for(const c of footprintCells(job))cells.add(index(world,c));
  return cells;
}
function context(world: World, queriedCells?:readonly number[]): Context {
  const planned=world.jobs.filter(j => j.kind==='replant-tree'||j.kind==='install'||j.kind!=='power-conduit'&&j.kind in STRUCTURE_DEFINITIONS);
  // Placed footprints come from the shared structure index (same cells as
  // footprintCells/footprintContains); only planned jobs are scanned here.
  // Validation asks about at most five cells: point queries, no expansion.
  const geometry=captureStructureNavigation(world),cellOf=(i:number)=>({x:i%world.width,z:Math.floor(i/world.width)});
  const occupiedAt=(i:number,placed:(s:World['structures'][number])=>boolean)=>{const c=cellOf(i);return geometry.at(c).some(placed)||planned.some(j=>footprintContains(j,c));};
  const notConduit=(s:World['structures'][number])=>s.kind!=='power-conduit',notConduitOrBasin=(s:World['structures'][number])=>s.kind!=='power-conduit'&&s.kind!=='hydroponics-basin';
  const fixed=queriedCells?new Set(queriedCells.filter(i=>occupiedAt(i,notConduit))):placedAndPlannedCells(world,planned,notConduit);
  const hydroBlocked=world.growingZones.some(z=>z.basinId!==undefined)
    ?(queriedCells?new Set(queriedCells.filter(i=>occupiedAt(i,notConduitOrBasin))):placedAndPlannedCells(world,planned,notConduitOrBasin)):undefined;
  let temperatures:TemperatureView|undefined,forestry:ReadonlySet<string>|undefined;
  return {
    resources: resourceCells(world),
    get temperatures(){return temperatures??=new TemperatureView(world);},get forestry(){return forestry??=new Set(forestSowingChoices291(world));},fixed,hydroBlocked,sows:sowCells(world),
  };
}
function intention(world: World, zone: GrowingZone, cell: number, ctx: Context, committed=false,ownJob?:number): { kind: JobKind; cell: number } | null {
  const position={x:cell%world.width,z:Math.floor(cell/world.width)};
  if(geyserBlocksPlantOrFloor256(world,position))return null;
  const basin=zone.basinId===undefined?undefined:hydroponicBasinAt(world,position);
  if(zone.basinId!==undefined&&(!basin||basin.id!==zone.basinId||!hydroponicCropAllowed(zone.plant)))return null;
  if (ctx.fixed.has(cell)&&(!basin||ctx.hydroBlocked?.has(cell))||!basin&&(world.tiles[cell]!.floor||world.tiles[cell]!.bridge&&terrainHasProspectiveRules256(world.tiles[cell]!.terrain,world))) return null;
  const plant = ctx.resources.get(cell);
  if(plant?.blight)return zone.allowCut?{kind:'cut',cell}:null;
  const forest=world.schemaVersion>=291&&isForestrySpecies291(zone.plant);
  if(world.schemaVersion>=291&&plant?.kind==='tree'&&(sameGrowingPlant291(plant,zone)||zone.allowCut)&&plantGrowth(world,plant)>.999&&plantCanYieldNow(world,plant))return {kind:'chop',cell};
  if(forest&&plant&&sameGrowingPlant291(plant,zone))return null;
  if (plant?.kind === zone.plant || (!zone.allowSow && zone.allowCut && plant && isPlant(plant)&&(world.schemaVersion<291||plant.kind!=='tree'))) {
    return plantGrowth(world, plant) >= 1 ? { kind: 'harvest', cell } : null;
  }
  if (!zone.allowSow) return null;
  if(forest&&(!ctx.forestry.has(zone.plant)||!committed&&isRoofed(world,cell)))return null;
  const soil=world.tiles[cell]!;
  if(!basin&&(forest||terrainHasProspectiveRules256(soil.terrain,world))&&terrainGroundFertility256(soil)<growingPlantMinFertility291(zone.plant))return null;
  // Temperature gates new sowing work, not harvesting or an accepted job.
  if(!committed){const temperature=ctx.temperatures.at(world,position);if(forest?!(temperature>0&&temperature<FLORA_DEFINITIONS[zone.plant as import('./forestry-content-291.ts').ForestrySpecies291].maxGrowthTemperature):!sowingTemperatureAllowed(temperature))return null;}
  if (plant) return zone.allowCut && plant.kind !== 'rock' ? { kind: plant.kind === 'tree'&&(world.schemaVersion<291||choppable(world,plant)) ? 'chop' : 'cut', cell } : null;
  // A sowing intention stays pending while its floor items are hauled aside.
  if (!basin&&!isGrowingTerrain(world.tiles[cell]!.terrain)||basin&&!hydroponicSowingAllowed(world,zone)) return null;
  if(world.schemaVersion>=291){
    const blocker=sowBlocker291(world,zone,cell,ctx.resources,ctx.sows,ownJob);if(!blocker)return {kind:'sow',cell};
    if(!blocker.resource||!zone.allowCut)return null;
    const other=growingZoneAt(world,blocker.cell);if(other&&sameGrowingPlant291(blocker.resource,other))return null;
    return {kind:blocker.resource.kind==='tree'&&choppable(world,blocker.resource)?'chop':'cut',cell:blocker.cell};
  }
  const x = cell % world.width, z = Math.floor(cell / world.width);
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const nx = x + dx!, nz = z + dz!;
    if (nx < 0 || nz < 0 || nx >= world.width || nz >= world.height) continue;
    const neighbor = nz * world.width + nx;
    if (ctx.resources.get(neighbor)?.kind !== 'tree') continue;
    const other = growingZoneAt(world, neighbor);
    if (!zone.allowCut || (other && !other.allowCut)) return null;
    return { kind: 'chop', cell: neighbor };
  }
  return { kind: 'sow', cell };
}

/** Cancel generated work and zone-bound clearance; independent designations survive. */
export function cancelGrowingJobs(world: World, zoneIds: ReadonlySet<number>,drops?:DropPlan): void {
  const ids = new Set(world.jobs.filter(j => j.growingZoneId !== undefined && zoneIds.has(j.growingZoneId)).map(j => j.id));
  for (const pawn of world.pawns) if (pawn.jobId !== null && ids.has(pawn.jobId)||pawn.haul?.destination.type==='aside'&&zoneIds.has(pawn.haul.destination.growingZoneId??-1)) releaseWork(world, pawn,drops);
  for(const pawn of world.pawns)pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||!('destination' in o)||o.destination.type!=='aside'||!zoneIds.has(o.destination.growingZoneId??-1));
  world.jobs = world.jobs.filter(j => !ids.has(j.id));
}
export function growingJobValid(world: World, job: Job, shared?:Context): boolean {
  if(job.flowerPotId!==undefined){if(geyserBlocksPlantOrFloor256(world,job))return false;const pot=world.structures.find(s=>s.id===job.flowerPotId&&s.kind==='flower-pot'&&s.x===job.x&&s.z===job.z);return !!pot&&(job.kind==='sow'?!!pot.flower?.allowSow&&!pot.flower.plant:job.kind==='cut'&&!!pot.flower?.plant);}
  if (job.growingZoneId === undefined) return job.kind !== 'sow';
  const zone = world.growingZones.find(z => z.id === job.growingZoneId);
  if (!zone) return false;
  const target = index(world, job);
  // Tree clearing can originate in a neighbouring cell outside the zone.
  const origins = world.schemaVersion>=291&&(job.kind==='chop'||job.kind==='cut')?[target,...adjacentCells291(world,target)]:job.kind === 'chop' ? [target, target - world.width, target + 1, target + world.width, target - 1] : [target];
  const ctx=shared??context(world,origins);
  return origins.some(cell => growingZoneAt(world, cell)?.id === zone.id && (() => {
    const desired = intention(world, zone, cell, ctx,job.reservedBy!==null,job.id);
    return desired?.kind === job.kind && desired.cell === target;
  })());
}

/** Bounded rotating discovery; work execution and reservations use the ordinary planner. */
export function scheduleGrowing(world: World): void {
  // Discard stale sowing/preparation intents before a planner can accept one.
  // Accepted work keeps its own interruption contract, including queued orders.
  if((!sowingTemperatureAllowed(outdoorTemperature(world))||world.thermal?.regions.some(r=>!sowingTemperatureAllowed(r.temperature))||world.growingZones.some(z=>z.basinId!==undefined&&!hydroponicSowingAllowed(world,z)))
    &&world.jobs.some(j=>j.growingZoneId!==undefined&&j.reservedBy===null)) {
    const ctx=context(world);
    const allowed=(j:Job)=>j.growingZoneId===undefined||j.reservedBy!==null||growingJobValid(world,j,ctx);
    if(world.jobs.some(j=>!allowed(j)))world.jobs=world.jobs.filter(allowed);
  }
  if (!world.growingZones.length || world.tick % FARM_SCAN_INTERVAL) return;
  const { entries } = zoneCells(world);
  if (!entries.length) return;
  let count = world.jobs.filter(j => j.growingZoneId !== undefined).length;
  if (count >= FARM_QUEUE_LIMIT) {
    if (world.tick % 100) return;
    // Unreachable intentions must not monopolize the bounded queue forever.
    // Keep owned work; rescan unclaimed automatic work from the saved cursor.
    world.jobs = world.jobs.filter(j => j.growingZoneId === undefined || j.reservedBy !== null);
    count = world.jobs.filter(j => j.growingZoneId !== undefined).length;
  }
  const ctx = context(world), occupied = new Set(world.jobs.map(j => index(world, j)));
  const budget = Math.min(FARM_SCAN_BUDGET, entries.length);
  for (let n = 0; n < budget && count < FARM_QUEUE_LIMIT; n++) {
    const { zone, cell } = entries[world.growingCursor % entries.length]!;
    world.growingCursor = (world.growingCursor + 1) % entries.length;
    const desired = intention(world, zone, cell, ctx);
    if (!desired || occupied.has(desired.cell)) continue;
    if (!Number.isSafeInteger(world.nextId + 1)) return;
    world.jobs.push({ id: world.nextId++, growingZoneId: zone.id, kind: desired.kind, x: desired.cell % world.width, z: Math.floor(desired.cell / world.width), orientation: 0, footprint: 'standard', status: 'pending', reservedBy: null, progress: 0, escrow: { wood: 0, food: 0 } });
    occupied.add(desired.cell); count++;
    for (const pawn of world.pawns) if (pawn.jobId === null && !pawn.haul) pawn.planCooldown = 0;
  }
}
export function finishSowing(world: World, job: Job): void {
  if(geyserBlocksPlantOrFloor256(world,job))return;
  if(job.flowerPotId!==undefined){const pot=world.structures.find(s=>s.id===job.flowerPotId&&s.kind==='flower-pot');if(pot?.flower&&!pot.flower.plant)pot.flower={...pot.flower,plant:sowDaylily(world.tick)};return;}
  const zone=world.growingZones.find(z=>z.id===job.growingZoneId);
  if(!zone||zone.basinId!==undefined&&(!hydroponicSowingAllowed(world,zone)||!zone.cells.includes(index(world,job))))return;
  const kind=zone.plant;
  if(world.schemaVersion>=291&&(!growingJobValid(world,job)||packedAt(world,job)||world.piles.some(p=>p.owner.type==='ground'&&p.owner.x===job.x&&p.owner.z===job.z)||!Number.isSafeInteger(world.nextId+1)))return;
  const forest=world.schemaVersion>=291&&isForestrySpecies291(kind);
  const plant:Resource={ id: world.nextId++, kind:forest?'tree':kind as import('./crops.ts').CropKind,...(forest?{species:kind as import('./forestry-content-291.ts').ForestrySpecies291,sown291:true as const}:{}), x: job.x, z: job.z, amount:forest?FLORA_DEFINITIONS[kind as import('./forestry-content-291.ts').ForestrySpecies291].yield:PLANT_DEFINITIONS[kind as import('./crops.ts').CropKind].yield, growth: .0001, growthTick: world.tick };
  if(world.climate||forest)plant.plantLife=createPlantLife(world,plant,true);
  world.resources = [...world.resources,plant];
}
