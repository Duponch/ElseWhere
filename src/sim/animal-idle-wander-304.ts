import {schemaAtLeast} from './schema-range.ts';
import {naturalTerrainCosts256} from './natural-terrain-movement-256.ts';
import {furnitureDelay} from './furniture-travel.ts';
import {duckTerrainOverride256,duckMapHasWater256,duckWanderWaterAllowed256} from './duck-water-256.ts';
import {duckFlying256} from './duck-flight-state-256.ts';
import {notifyDuckFlightJob256} from './duck-flight-runtime-256.ts';
import {animalComfyRange256,animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import {actualNativeSevenFacts256} from './actual-animal-profile-256.ts';
import {TemperatureView,thermalLayout} from './temperature.ts';
import {groundFire} from './fire-rules.ts';
import {isPassageDoor} from './door-rules.ts';
import {filteredStructures} from './structure-navigation.ts';
import {spikeTrapKnowsOf} from './spike-trap-state.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {idleHashOffset300,idleChillBuilding300} from './idle-wander-300.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {capturePrisonTopology,prisonRoom} from './prison-space.ts';
import {footprintCells} from './definitions.ts';
import {grazingPen} from './wildlife-food.ts';
import {penRegion} from './animal-pens.ts';
import {isColonist} from './affiliation.ts';
import {isRoofed,roofIndex} from './roof-rules.ts';
import type {AnimalWanderReachability256} from './animal-confused-wander-256.ts';
import type {ActualAnimalMind256} from './animal-condition-mental-state-256.ts';
import type {InitialAnimalRandom256} from './initial-animal-age-256.ts';
import type {AnimalAreaPolicy287} from './animal-area-policy-287.ts';
import type {animalNavigation} from './wildlife-navigation.ts';
import type {Cell,Structure,World} from './types.ts';

/* Idle wander of animals, as RimWorld 1.6 (schema 304).
 *
 * JobGiver_Wander alternates a wait (Wait_Wander) and a walk (GotoWander), on
 * the animal's MindState flag nextMoveOrderIsWait (AnimalWanderState256):
 * - the wait lasts ticksBetweenWandersRange, 120~240 for every animal node of
 *   ThinkTreeDefs/Animal.xml. Its job expiry is checked on the animal's
 *   TickInterval calls (every 15 ticks at its hash phase) and needs the hash
 *   window IsHashIntervalTick(expiry, 15), so it ends at the first such tick
 *   from start + expiry: between 120 and 480 ticks;
 * - the walk goes to RCellFinder.RandomWanderDestFor(root, radius, maxDanger),
 *   at Walk urgency (animalMoveCostCore297: cost doubled, at least 50 ticks a
 *   cell), the node choosing root, radius and maxDanger:
 *     wild herd animal: JobGiver_WanderHerd, radius 5, Deadly, herd root;
 *     other wild animal: JobGiver_WanderAnywhere, radius 7, Deadly, own cell;
 *     tame roamer: 10 % JobGiver_WanderInPen (radius 10, pen marker when out of
 *       an enclosure), else JobGiver_WanderAnywhere, radius 7, Danger.None;
 *     other tame animal: JobGiver_WanderColony, radius 7, Danger.None, colony root.
 * Adaptations (stated): decisions run at our local tick (10 ticks), so a wait
 * ends at the first local tick from its RimWorld end; our regions are the
 * live 12 x 12 wander regions of the confused wander; RNG streams differ. */
export const isAnimalIdleWanderSchema304=schemaAtLeast(304);
export {ANIMAL_WANDER_WAIT_MAX_CORE304} from './animal-condition-mental-state-256.ts';
const WAIT_MIN=120,WAIT_MAX=240,ANIMAL_INTERVAL=15;
/** CanWanderToCell refuses a perceived path cost above 20 Core ticks: in
 * search units 20/30*1000 = 666.67, rounded like every cost (an integer cost
 * of 20 Core ticks is 667 units and is accepted). */
const PERCEIVED_COST_LIMIT_UNITS=667;

/** First tick from `start + expiry` at which RimWorld ends the wait: a
 * TickInterval tick of this animal ((tick + hash) % 15 == 0) inside its hash
 * window (|(tick + hash) % expiry| < 15), in signed 32-bit arithmetic. */
export function animalWanderWaitEnd304(id:number,startCore:number,expiry:number):number {
 const hash=idleHashOffset300(id);
 for(let tick=startCore+expiry,last=tick+expiry+2*ANIMAL_INTERVAL;tick<=last;tick++){
  const phase=((tick|0)+hash)|0;
  if(phase%ANIMAL_INTERVAL===0&&Math.abs(phase%expiry)<ANIMAL_INTERVAL)return tick;
 }
 throw Error('No animal wander wait end');
}

/* Herd and roamer facts of the legacy species (Core XML: Races_Animal_CowGroup
 * and PigGroup); the other legacy species are neither. */
const LEGACY_HERD_ROAM:Readonly<Record<string,{herd:boolean;roam:number|null}>>={muffalo:{herd:true,roam:2},dromedary:{herd:true,roam:3},deer:{herd:true,roam:2},gazelle:{herd:true,roam:2}};
function raceFacts(species:string):{herd:boolean;roamer:boolean} {
 if(isAnimalSpecies256(species)){const race=animalCore256(species).race as {herdAnimal?:boolean;roamMtbDays?:number|null};return {herd:race.herdAnimal===true,roamer:race.roamMtbDays!==null&&race.roamMtbDays!==undefined};}
 const legacy=LEGACY_HERD_ROAM[species];return {herd:!!legacy?.herd,roamer:legacy?.roam!==null&&legacy?.roam!==undefined};
}

type Nav=Pick<ReturnType<typeof animalNavigation>,'free'|'occupy'|'step'|'blockedGrid'|'regionKey'>;
/** A live region: the cells of one 12 x 12 block joined by cardinal steps
 * (cell indices, in index order), and their bounds. */
type Region={readonly tag:number;readonly cells:number[];x0:number;x1:number;z0:number;z1:number};
const four=[[0,-1],[1,0],[0,1],[-1,0]] as const;
const isPassageDoorStructure=(s:Structure):boolean=>isPassageDoor(s.kind);
/** Cells of the passage doors, from the shared list of the structure index. */
const passageDoorCells=(w:World):Set<number>=>new Set(filteredStructures(w,'passage-doors',isPassageDoorStructure).map(s=>s.z*w.width+s.x));
const cellOf=(w:World,i:number):Cell=>{const x=i%w.width;return {x,z:(i-x)/w.width};};
/* The temperature view of one navigation reader (one synchronous wildlife
 * pass, invalidated with it when structures change). */
const temperatureViews=new WeakMap<Nav,TemperatureView>();
/* The colonists' reserved service cells, read once per navigation reader:
 * only colonists reserve them, and the wildlife pass gives them no task. */
const reservedByNav=new WeakMap<Nav,Set<number>>();
const reservedCells=(w:World,nav:Nav):Set<number>=>{let cells=reservedByNav.get(nav);if(!cells){cells=reservedServiceCells(w);reservedByNav.set(nav,cells);}return cells;};
/** RimWorld 1.6 temperature danger of a cell for this animal: 0 None inside
 * its safe range (comfortable +/- 10), 1 Some within 80 more, 2 Deadly. */
function dangerReader(w:World,a:ActualAnimalMind256,nav:Nav):(c:Cell)=>number {
 const seven=actualNativeSevenFacts256(a),comfy=isAnimalSpecies256(a.species)?animalComfyRange256(a.species):seven?{minimum:seven.comfyMin,maximum:seven.comfyMax}:undefined;
 if(!comfy)return ()=>0;
 let temperature=temperatureViews.get(nav);if(!temperature){temperature=new TemperatureView(w,thermalLayout(w));temperatureViews.set(nav,temperature);}
 const view=temperature;
 return c=>{const t=view.at(w,c);return t>=comfy.minimum-10&&t<=comfy.maximum+10?0:t>=comfy.minimum-90&&t<=comfy.maximum+90?1:2;};
}
/* The live 12 x 12 regions of an obstacle grid: the cells of one block joined
 * by cardinal steps (for our navigation readers a cardinal step is exactly the
 * destination being free), door cells excluded. They are kept across passes
 * while the reader's grid is unchanged outside door cells (doors open and
 * close: their crossings are read at each pass), so the regions themselves
 * never depend on when they were built: cells in index order, exits in the
 * order of those cells. Built on demand. */
interface RegionCache {
 readonly key:string;readonly width:number;readonly height:number;
 /** The grid the regions were built on, door cells cleared. */
 readonly grid:Uint8Array;readonly portals:Set<number>;
 /** 0 unknown, -1 no region (blocked or door), else the region's tag. */
 readonly regionOf:Int32Array;readonly regions:Region[];
 /** Per tag, the region's boundary steps in order: pairs (cell, door), door
  * -1 for a step out of the block, else the door crossed to reach the cell. */
 readonly steps:(Int32Array|undefined)[];
}
const regionCaches=new WeakMap<World,RegionCache[]>();
/** One pass's view: the cache and the reader's current grid. */
interface RegionGraph {readonly cache:RegionCache;readonly grid:Uint8Array;readonly regionOf:Int32Array;readonly regions:Region[];readonly exits:(number[]|undefined)[]}
const graphs=new WeakMap<Nav,RegionGraph>();
function sameRegionGrid(cache:RegionCache,w:World,grid:Uint8Array,portals:Set<number>):boolean {
 if(cache.width!==w.width||cache.height!==w.height||cache.grid.length!==grid.length||cache.portals.size!==portals.size)return false;
 for(const i of portals)if(!cache.portals.has(i))return false;
 const kept=cache.grid;
 for(let i=0;i<grid.length;i++)if(grid[i]!==kept[i]&&!portals.has(i))return false;
 return true;
}
function regionGraph(w:World,nav:Nav):RegionGraph {
 let graph=graphs.get(nav);if(graph)return graph;
 const grid=nav.blockedGrid(),portals=passageDoorCells(w),key=nav.regionKey;
 let list=regionCaches.get(w);if(!list){list=[];regionCaches.set(w,list);}
 let cache=list.find(c=>c.key===key);
 if(!cache||!sameRegionGrid(cache,w,grid,portals)){
  const kept=Uint8Array.from(grid);for(const i of portals)kept[i]=0;
  const fresh:RegionCache={key,width:w.width,height:w.height,grid:kept,portals,regionOf:new Int32Array(grid.length),regions:[],steps:[]};
  if(cache)list[list.indexOf(cache)]=fresh;else list.push(fresh);cache=fresh;
 }
 graph={cache,grid,regionOf:cache.regionOf,regions:cache.regions,exits:[]};graphs.set(nav,graph);return graph;
}
function regionAt(w:World,graph:RegionGraph,c:Cell):Region|undefined {
 if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)return;
 return regionAtIndex(w,graph,c.z*w.width+c.x);
}
function regionAtIndex(w:World,graph:RegionGraph,i:number):Region|undefined {
 const {regionOf,portals}=graph.cache,grid=graph.grid,known=regionOf[i]!;if(known>0)return graph.regions[known-1];if(known<0)return;
 if(portals.has(i)||grid[i]){regionOf[i]=-1;return;}
 const W=w.width,x=i%W,z=(i-x)/W,bx=x-x%12,bz=z-z%12,bx1=Math.min(W,bx+12),bz1=Math.min(w.height,bz+12);
 const tag=graph.regions.length+1,cells=[i];regionOf[i]=tag;
 const visit=(n:number)=>{if(regionOf[n]!==0)return;if(portals.has(n)||grid[n]){regionOf[n]=-1;return;}regionOf[n]=tag;cells.push(n);};
 for(let q=0;q<cells.length;q++){
  const p=cells[q]!,px=p%W,pz=(p-px)/W;
  if(pz>bz)visit(p-W);if(px+1<bx1)visit(p+1);if(pz+1<bz1)visit(p+W);if(px>bx)visit(p-1);
 }
 cells.sort((a,b)=>a-b);
 let x0=W,x1=-1,z0=w.height,z1=-1;for(const p of cells){const px=p%W,pz=(p-px)/W;if(px<x0)x0=px;if(px>x1)x1=px;if(pz<z0)z0=pz;if(pz>z1)z1=pz;}
 const r:Region={tag,cells,x0,x1,z0,z1};graph.regions.push(r);return r;
}
/** The cells through which a region reaches its neighbours, in the order of
 * its cells (a door cell is crossed: the cell behind it, when the door and
 * that cell are free in this pass). Inside its own block a region already
 * holds every cell it can step to, except door cells, so only steps out of the
 * block or onto a door count. */
function exits(w:World,graph:RegionGraph,r:Region):number[] {
 let list=graph.exits[r.tag];if(list)return list;
 const cache=graph.cache,grid=graph.grid;
 let steps=cache.steps[r.tag];
 if(!steps){
  const found:number[]=[],W=w.width,H=w.height;
  for(const p of r.cells){
   const px=p%W,pz=(p-px)/W,bx=px-px%12,bz=pz-pz%12;
   for(const [dx,dz] of four){
    const nx=px+dx,nz=pz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;
    const n=nz*W+nx,door=cache.portals.has(n);
    if(!door){if(nx>=bx&&nx<bx+12&&nz>=bz&&nz<bz+12||cache.grid[n])continue;found.push(n,-1);continue;}
    const ex=nx+dx,ez=nz+dz;if(ex<0||ez<0||ex>=W||ez>=H)continue;found.push(ez*W+ex,n);
   }
  }
  steps=cache.steps[r.tag]=Int32Array.from(found);
 }
 list=[];const seen=new Set<number>();
 for(let k=0;k<steps.length;k+=2){
  const beyond=steps[k]!,door=steps[k+1]!;
  if(door>=0&&(grid[door]||grid[beyond]))continue;
  if(cache.regionOf[beyond]===r.tag||seen.has(beyond))continue;seen.add(beyond);list.push(beyond);
 }
 graph.exits[r.tag]=list;return list;
}
/** Breadth-first over the regions from the root's region, entering a region
 * when its extents come within `radius` of the root and `admit` accepts it,
 * at most `limit` regions (doorway cells form no region here). A region lies
 * in its block: a block out of reach is not even built. */
function nearRegions(w:World,root:Cell,radius:number,nav:Nav,limit:number,admit:(region:Region)=>boolean):Region[] {
 const graph=regionGraph(w,nav),r2=radius*radius;
 const nearBox=(x0:number,x1:number,z0:number,z1:number)=>{const dx=Math.max(x0-root.x,0,root.x-x1),dz=Math.max(z0-root.z,0,root.z-z1);return dx*dx+dz*dz<=r2;};
 const start=regionAt(w,graph,root);if(!start)return [];
 const admitted=[start],seen=new Set([start]);
 for(let q=0;q<admitted.length&&admitted.length<limit;q++)for(const c of exits(w,graph,admitted[q]!)){
  const cx=c%w.width,cz=(c-cx)/w.width,bx=cx-cx%12,bz=cz-cz%12;if(!nearBox(bx,Math.min(w.width-1,bx+11),bz,Math.min(w.height-1,bz+11)))continue;
  const r=regionAtIndex(w,graph,c);if(!r||seen.has(r))continue;seen.add(r);
  if(!nearBox(r.x0,r.x1,r.z0,r.z1)||!admit(r))continue;admitted.push(r);if(admitted.length===limit)return admitted;
 }
 return admitted;
}
/** CellFinder.RandomRegionNear(root, maxRegions, TraverseParms.For(animal))
 * .RandomCell: breadth-first over at most `maxRegions` regions from the cell's
 * region (no closed door crossed), one region drawn by its cell count, then
 * one of its cells. */
export function randomCellInRegionsNear304(w:World,nav:Nav,from:Cell,maxRegions:number,random:()=>number):Cell|undefined {
 const regions=nearRegions(w,from,Infinity,nav,maxRegions,()=>true);if(!regions.length)return;
 const total=regions.reduce((n,r)=>n+r.cells.length,0);let roll=random()*total,region=regions.at(-1)!;
 for(const r of regions){roll-=r.cells.length;if(roll<0){region=r;break;}}
 return cellOf(w,region.cells[Math.min(region.cells.length-1,Math.floor(random()*region.cells.length))]!);
}
/** CellFinder.AllRegionsNear for RandomWanderDestFor: at most 13 regions. */
const wanderRegions=(w:World,root:Cell,radius:number,nav:Nav,admit:(region:Region)=>boolean):Region[]=>nearRegions(w,root,radius,nav,13,admit);
const shuffle=<T,>(list:T[],random:InitialAnimalRandom256)=>{for(let i=0;i<list.length-1;i++){const j=random.integer(i,list.length);[list[i],list[j]]=[list[j]!,list[i]!];}};
/** CellFinder.TryFindRandomCellNear: 20 random cells of the square, then every
 * cell of it in a shuffled order. */
function randomCellNear(w:World,root:Cell,radius:number,accept:(c:Cell)=>boolean,random:InitialAnimalRandom256):Cell|undefined {
 const x0=Math.max(0,root.x-radius),x1=Math.min(w.width,root.x+radius),z0=Math.max(0,root.z-radius),z1=Math.min(w.height,root.z+radius);
 for(let n=0;n<20;n++){const c={x:random.integer(x0,x1+1),z:random.integer(z0,z1+1)};if(accept(c))return c;}
 const xs=Array.from({length:x1-x0+1},(_,i)=>x0+i),zs=Array.from({length:z1-z0+1},(_,i)=>z0+i);shuffle(xs,random);shuffle(zs,random);
 for(const x of xs)for(const z of zs){const c={x,z};if(accept(c))return c;}return;
}
export interface AnimalWanderReader304 {
 /** RaceProps.waterSeeker (ducks). */readonly water:boolean;
 readonly knowsTraps:boolean;
 /** PathGrid.PerceivedPathCostAt in navigation search units (1000 = 30 Core
  * ticks): terrain with its perceived extra, buildings, frames, piles, snow. */
 perceivedCostUnits(cell:Cell):number;
 /** Not forbidden: inside the animal's allowed area. */
 allowed(cell:Cell):boolean;
 /** The node's wanderDestValidator (roofed cells under toxic fallout). */
 validator?(cell:Cell):boolean;
 /** The water seekers' last check (draws random cells): ducks only. */
 waterSeeker?(cell:Cell):boolean;
}
/** RCellFinder.RandomWanderDestFor(pawn, root, radius, validator, maxDanger). */
export function chooseAnimalWanderDestination304(w:World,a:ActualAnimalMind256,root:Cell,radius:number,deadly:boolean,nav:Nav,reach:AnimalWanderReachability256,random:InitialAnimalRandom256,reader:AnimalWanderReader304):Cell {
 const danger=dangerReader(w,a,nav),here=danger(a),inside=(c:Cell)=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
 // Region.Allows: under Danger.None a region more dangerous than both None
 // and the animal's own region is not entered.
 const regions=wanderRegions(w,root,radius,nav,r=>deadly||danger(cellOf(w,r.cells[0]!))<=Math.max(0,here)),total=regions.reduce((n,r)=>n+r.cells.length,0);
 // From the animal's own region every cell of an admitted region is
 // reachable (the regions are joined by the steps the path search takes),
 // through admitted regions only: no path search per candidate.
 const graph=regionGraph(w,nav),own=regionAt(w,graph,a),local=!!own&&own===regionAt(w,graph,root),admittedRegions=new Set(regions);
 const doors=graph.cache.portals,fire=new Set((w.fires?.items??[]).filter(groundFire).map(f=>f.z*w.width+f.x));
 const knownTraps=new Set(reader.knowsTraps?filteredStructures(w,'spike-traps',s=>s.kind==='spike-trap').filter(s=>!!s.spikeTrap).map(s=>s.z*w.width+s.x):[]),reserved=reservedCells(w,nav);
 // CanReach(c, maxDanger): the destination no more dangerous than allowed,
 // and no deadly region crossed unless the animal stands in one.
 const reachable=(c:Cell,maxDanger:number)=>{
  const permitted=Math.max(maxDanger,here);
  if(local){const tag=graph.regionOf[c.z*w.width+c.x]!;if(tag>0&&admittedRegions.has(graph.regions[tag-1]!))return nav.free(c)&&reader.allowed(c)&&danger(c)<=permitted;}
  if(!reach.canReach(c))return false;if(danger(c)>permitted)return false;
  return permitted>=2||!!reach.pathTo(c)?.every(p=>danger(p)<2);
 };
 const maxDanger=deadly?2:0;
 // RCellFinder.CanWanderToCell, in its order (the water seekers' rule draws
 // random cells, so it stays last).
 const valid=(c:Cell,attempt:number)=>{
  if(!inside(c)||!nav.occupy(c)||!reader.allowed(c)||!reachable(c,maxDanger))return false;const i=c.z*w.width+c.x,t=w.tiles[i]!;
  if(knownTraps.has(i))return false;
  if(attempt<10){
   if(!nav.free(c))return false;
   const terrain=!t.bridge&&!t.floor?naturalTerrainCosts256(t.terrain):undefined,avoid=!!terrain&&(terrain.water||t.terrain==='mud');
   // No avoidWander terrain (water, marsh, mud) unless water for a water
   // seeker, path cost at most 20, temperature danger at most None.
   if(avoid&&!(terrain!.water&&reader.water)||reader.perceivedCostUnits(c)>PERCEIVED_COST_LIMIT_UNITS||danger(c)>0)return false;
  }else if(attempt<15&&danger(c)===2)return false;
  if(reserved.has(i)||reader.validator&&!reader.validator(c)||doors.has(i)||fire.has(i))return false;
  return !reader.waterSeeker||reader.waterSeeker(c);
 };
 if(total)for(let attempt=0;attempt<35;attempt++){
  let candidate:Cell|undefined;
  for(let ticket=0;ticket<5;ticket++){
   let roll=Math.fround(random.value()*total),region=regions.at(-1)!;for(const r of regions){roll=Math.fround(roll-r.cells.length);if(roll<=0){region=r;break;}}
   let c:Cell|undefined;for(let retry=0;retry<1000;retry++){const p={x:random.integer(region.x0,region.x1+1),z:random.integer(region.z0,region.z1+1)};if(graph.regionOf[p.z*w.width+p.x]===region.tag){c=p;break;}}c??=cellOf(w,region.cells[0]!);
   if((c.x-root.x)**2+(c.z-root.z)**2<=radius*radius){candidate=c;break;}
  }
  if(candidate&&valid(candidate,attempt))return candidate;
 }
 // Fallbacks of RandomWanderDestFor: they skip the standing, terrain, door
 // and fire checks. Squares around the root, then around the animal.
 const square=Math.floor(radius),walkable=(c:Cell)=>inside(c)&&nav.occupy(c);
 return randomCellNear(w,root,square,c=>walkable(c)&&reachable(c,0)&&reader.allowed(c)&&(!reader.validator||reader.validator(c)),random)
  ??randomCellNear(w,root,square,c=>walkable(c)&&reachable(c,0)&&reader.allowed(c),random)
  ??randomCellNear(w,root,square,c=>walkable(c)&&reachable(c,2),random)
  ??randomCellNear(w,root,20,c=>walkable(c)&&reachable(c,0)&&reader.allowed(c),random)
  ??randomCellNear(w,root,30,c=>walkable(c)&&reachable(c,2),random)
  ??randomCellNear(w,a,5,c=>walkable(c)&&reachable(c,2),random)??{x:a.x,z:a.z};
}

const eight=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]] as const;
/** GenAdjFast.AdjacentCells8Way of a building: the cells around its footprint. */
function adjacentCells(w:World,s:Structure):Cell[] {
 const own=footprintCells(s),inside=new Set(own.map(c=>c.z*w.width+c.x)),result=new Map<number,Cell>();
 for(const at of own)for(const [dx,dz] of eight){const c={x:at.x+dx,z:at.z+dz};const key=c.z*w.width+c.x;if(!inside.has(key)&&!result.has(key))result.set(key,c);}
 return [...result.values()];
}
/** WanderUtility.GetColonyWanderRoot for an animal (gather spots are only for
 * humanlikes): colonist buildings in a random order; for a wall or a chill
 * destination in the home area, one random cell around it, kept when it is
 * standable, allowed, reachable under Danger.None and outside prison cells,
 * and returned at once when the building is within 35 cells; past 80
 * buildings, a random kept cell; else a free colonist, else the animal. */
function colonyRoot(w:World,a:Cell,nav:Nav,reachable:(c:Cell)=>boolean,allowed:(c:Cell)=>boolean,random:InitialAnimalRandom256):Cell {
 const buildings=w.structures.filter(s=>targetBuildingPlayerUse263(w,s)),home=new Set(w.home??[]),candidates:Cell[]=[];
 const prison=w.structures.some(s=>s.prisoner)?capturePrisonTopology(w):undefined;
 const pick=(cells:readonly Cell[])=>cells[random.integer(0,cells.length)]!;
 // Shuffle drawn one position at a time: the same order as a full shuffle.
 for(let i=0;i<buildings.length;i++){
  if(i>80&&candidates.length)return pick(candidates);
  const j=random.integer(i,buildings.length);[buildings[i],buildings[j]]=[buildings[j]!,buildings[i]!];const s=buildings[i]!;
  if(!idleChillBuilding300(s.kind)||!allowed(s)||!home.has(s.z*w.width+s.x))continue;
  const around=adjacentCells(w,s);if(!around.length)continue;const c=pick(around);
  if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height||!nav.free(c)||!allowed(c)||!reachable(c)||prison&&prisonRoom(w,c,prison))continue;
  candidates.push(c);if((a.x-s.x)**2+(a.z-s.z)**2<=1225)return c;
 }
 const colonists=w.pawns.filter(p=>isColonist(p)&&!p.prisoner&&p.state!=='dead'&&allowed(p)&&reachable(p));
 return colonists.length?(({x,z})=>({x,z}))(pick(colonists)):{x:a.x,z:a.z};
}
/** WanderUtility.GetHerdWanderRoot with JobGiver_WanderHerd's validator:
 * GenClosest.ClosestThingReachable within 35 cells, i.e. a pawn standing in a
 * region reached from the animal's own region through regions whose extents
 * come within 35 cells (Danger.Deadly: any region), the closest one that is
 * allowed, passes a coin flip (one draw each), is of the same race and
 * faction, and has no humanlike within 15 cells; else the animal's own cell.
 * Candidates are taken by distance (the native region order is not
 * reproduced). */
function herdRoot(w:World,a:ActualAnimalMind256,nav:Nav,allowed:(c:Cell)=>boolean,random:InitialAnimalRandom256):Cell {
 const humans=w.pawns.filter(p=>p.state!=='dead');
 const mates=(w.wildlife?.animals??[]).filter(o=>o!==a&&o.state!=='dead'&&(o.x-a.x)**2+(o.z-a.z)**2<1225)
  .sort((p,q)=>(p.x-a.x)**2+(p.z-a.z)**2-((q.x-a.x)**2+(q.z-a.z)**2)||p.id-q.id);
 if(!mates.length)return {x:a.x,z:a.z};
 const graph=regionGraph(w,nav),reached=new Set(nearRegions(w,a,35,nav,Infinity,()=>true).map(r=>r.tag));
 for(const o of mates){
  if(!allowed(o)||!reached.has(graph.regionOf[o.z*w.width+o.x]!))continue;
  if(random.value()<.5)continue;
  if(o.species!==a.species||!!o.domestic!==!!a.domestic)continue;
  if(humans.some(p=>(p.x-o.x)**2+(p.z-o.z)**2<225))continue;
  return {x:o.x,z:o.z};
 }
 return {x:a.x,z:a.z};
}
/** JobGiver_WanderInPen root: the closest reachable pen marker when the animal
 * is in no enclosure (its district touches the map edge), else its cell. */
function penRoot(w:World,a:ActualAnimalMind256,reach:AnimalWanderReachability256):Cell {
 if(grazingPen(w,a))return {x:a.x,z:a.z};
 let best:Structure|undefined,distance=0;
 for(const s of w.structures)if(s.kind==='pen-marker'&&penRegion(w,s.id)&&reach.canReach(s)){const d=(s.x-a.x)**2+(s.z-a.z)**2;if(!best||d<distance){best=s;distance=d;}}
 return best?{x:best.x,z:best.z}:{x:a.x,z:a.z};
}

export interface AnimalIdleWanderServices304 {
 readonly nav:Nav;
 /** The path search of one decision; release() ends it (pooled arrays). */
 reach():AnimalWanderReachability256&{release?():void;perceivedCostUnits?(cell:Cell):number};
 readonly random:InitialAnimalRandom256;move():void;
 readonly policy:AnimalAreaPolicy287|undefined;
 /** Toxic fallout asks penned animals for roofed cells. */
 readonly roofedOnly:boolean;
}
/** One decision of an idle animal with an actual mind (schema 304): keeps its
 * current wander job, else JobGiver_Wander's next job. */
export function processAnimalIdleWander304(w:World,a:ActualAnimalMind256,services:AnimalIdleWanderServices304):void {
 const mind=a.wander;if(!mind)throw Error('Idle wander requires the animal mind');
 const core=w.tick*10,job=mind.job;
 if(job?.kind==='wait'){if(job.untilCore>core){a.nextDecision=Math.max(a.nextDecision,Math.ceil(job.untilCore/10));return;}delete mind.job;}
 else if(job?.kind==='goto'){if(a.path.length){services.move();return;}delete mind.job;}
 const random=services.random,wait=mind.nextMoveOrderIsWait&&!duckFlying256(a.flight);
 mind.nextMoveOrderIsWait=!mind.nextMoveOrderIsWait;
 const startWait=(ticks:number)=>{
  notifyDuckFlightJob256(w,a,'other',()=>random.value());a.path=[];a.state='idle';
  const until=ticks>0?core+ticks:animalWanderWaitEnd304(a.id,core,random.integer(WAIT_MIN,WAIT_MAX+1));
  mind.job={kind:'wait',untilCore:until};a.nextDecision=Math.ceil(until/10);
 };
 if(wait){startWait(0);return;}
 const reach=services.reach();
 // The search arrays go back to their pool with the decision.
 try{decideWalk(w,a,services,reach,startWait);}finally{reach.release?.();}
}
function decideWalk(w:World,a:ActualAnimalMind256,services:AnimalIdleWanderServices304,reach:ReturnType<AnimalIdleWanderServices304['reach']>,startWait:(ticks:number)=>void):void {
 const mind=a.wander!,random=services.random,policy=services.policy,allowed=(c:Cell)=>!policy||policy.has(c.z*w.width+c.x);
 const {herd,roamer}=raceFacts(a.species),tame=!!a.domestic;
 let root:Cell={x:a.x,z:a.z},radius=7;const deadly=!tame;
 if(tame&&roamer){if(random.value()<.1){radius=10;root=penRoot(w,a,reach);}}
 else if(tame){const danger=dangerReader(w,a,services.nav),here=danger(a);root=colonyRoot(w,a,services.nav,c=>reach.canReach(c)&&danger(c)<=Math.max(0,here),allowed,random);}
 else if(herd){radius=5;root=herdRoot(w,a,services.nav,allowed,random);}
 const duck=a.species==='duck',water=duck&&duckMapHasWater256(w);
 const destination=chooseAnimalWanderDestination304(w,a,root,radius,deadly,services.nav,reach,random,{
  water:duck,knowsTraps:spikeTrapKnowsOf(w,a),perceivedCostUnits:c=>reach.perceivedCostUnits?reach.perceivedCostUnits(c):Math.round(furnitureDelay(w,a,c,duckTerrainOverride256(w,a))/3*1000),allowed,
  ...services.roofedOnly?{validator:(c:Cell)=>isRoofed(w,roofIndex(w,c))}:{},
  ...duck?{waterSeeker:(c:Cell)=>duckWanderWaterAllowed256(w,a,c,water,()=>random.value())}:{},
 });
 if(destination.x===a.x&&destination.z===a.z){startWait(0);return;}
 const path=reach.pathTo(destination);
 // A path failure ends the walk as ErroredPather: a plain 250-tick wait.
 if(!path){startWait(250);return;}
 notifyDuckFlightJob256(w,a,'GotoWander',()=>random.value());
 mind.job={kind:'goto',destination:{x:destination.x,z:destination.z}};a.path=path;a.state='moving';a.nextDecision=w.tick;services.move();
}
