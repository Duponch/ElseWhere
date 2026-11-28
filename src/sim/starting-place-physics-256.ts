import {captureStartingDropPhysics256} from './starting-drop-physics-256.ts';
import {START_STRUCTURE_PHYSICS_256} from './player-start-physics-256.ts';
import {STARTING_PLACE_PLANTS_256,STARTING_PLACE_STRUCTURES_256} from './starting-place-facts-256.ts';
import {footprintCells} from './definitions.ts';
import {groundMaxStacks,shelfAt,shelfStorageCells,storageCellAccepts} from './shelf-storage.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {canMergeEggPile256} from './animal-egg-permission-v256.ts';
import type {StartingPlaceCell256,StartingPlaceThing256} from './starting-place-near-256.ts';
import type {CoreStartingArrivalPending256} from './starting-pod-state-256.ts';
import type {World,MaterialPile,Cell} from './types.ts';

/** One pod-open decision. Small mutable working lists contain the actual
 * planned stack outcomes, never another World or an alternate terrain grid.
 * The caller discards this capture immediately after any physical edit. */
export function captureStartingPlacePhysics256(world:World,arrival:CoreStartingArrivalPending256|undefined,center:Readonly<Cell>,
 ground:ReadonlyMap<number,readonly MaterialPile[]>,spawned:readonly {cell:Readonly<Cell>;downed:boolean}[]) {
 const capture=captureStartingDropPhysics256(world,center),w=world.width,h=world.height,n=w*h;
 const inBounds=(c:Readonly<Cell>)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<w&&c.z<h;
 const full=new Uint8Array(n),doors=new Uint8Array(n),work=new Uint8Array(n),prevent=new Uint8Array(n),plants=new Uint8Array(n);
 for(const structure of world.structures){const extra=STARTING_PLACE_STRUCTURES_256[structure.kind as keyof typeof STARTING_PLACE_STRUCTURES_256],base=START_STRUCTURE_PHYSICS_256[structure.kind];if(!base||!extra)throw Error('Starting placement lacks actual structure flags: '+structure.kind);
  for(const c of footprintCells(structure)){const i=c.z*w+c.x;if(base.fullFill)full[i]=1;if(base.door)doors[i]=1;if(extra.workTable)work[i]=1;if(extra.preventDropping)prevent[i]=1;}
 }
 for(const resource of world.resources){const id=resource.species??resource.kind,extra=STARTING_PLACE_PLANTS_256[id as keyof typeof STARTING_PLACE_PLANTS_256];if(!extra&&!['ambrosia','tinctoria','burned-stump','chopped-stump','smashed-stump'].includes(id))throw Error('Starting placement lacks actual plant selection flag: '+id);if(!extra||extra.selectable)plants[resource.z*w+resource.x]=1;}
 const occupied=new Map<number,{downed:boolean}[]>(),add=(c:Readonly<Cell>,downed:boolean)=>{const i=c.z*w+c.x,list=occupied.get(i)??[];list.push({downed});occupied.set(i,list);};
 for(const pawn of world.pawns)if(!(pawn.state==='dead'&&pawn.body?.pileId!==undefined))add(pawn,pawn.state==='downed');
 for(const animal of world.wildlife?.animals??[])if(animal.state!=='dead')add(animal,animal.state==='downed');
 for(const robot of world.mechanoids??[])if(robot.state!=='dead')add(robot,robot.state==='downed');
 // Deliberately read this small live plan on every probe: a previously planned
 // entrant can affect the NEXT entrant's quality before any original moves.
 const itemPods=new Map<number,number>();for(const p of arrival?.pods??[])if(p.phase==='landed'){const i=p.cell.z*w+p.cell.x;itemPods.set(i,(itemPods.get(i)??0)+1);}
 const packed=new Map<number,number>();for(const p of world.packed)if(p.owner.type==='ground'){const i=p.owner.z*w+p.owner.x;packed.set(i,(packed.get(i)??0)+1);}
 return (cell:Readonly<Cell>,thing:StartingPlaceThing256,source?:MaterialPile):StartingPlaceCell256=>{
  if(!inBounds(cell))return {canSpawn:false,sameRoom:false,passDoorsReachable:false,itemCount:0,maxItems:0,haulDestinationAccepts:false,saveCompressiblePresent:false,matchingStackSpace:0,fullFill:false,preventDropping:false,door:false,workTable:false,downedPawn:false,anyPawn:false,selectablePlant:false};
  const i=cell.z*w+cell.x,piles=ground.get(i)??[],actors=[...(occupied.get(i)??[]),...spawned.filter(a=>a.cell.x===cell.x&&a.cell.z===cell.z)],shelf=shelfAt(world,cell),storage=shelf?shelfStorageCells(shelf).find(c=>c.x===cell.x&&c.z===cell.z):undefined;
  let matchingStackSpace=0;if(source)for(const target of piles)if(target.item===source.item&&canMergeEggPile256(target,source))matchingStackSpace+=Math.max(0,ITEM_DEFINITIONS[target.item].stackLimit-target.quantity);
  return {canSpawn:capture.physical.normalWalkable(i),sameRoom:capture.readers.roomAt(cell)?.id===capture.readers.roomAt(center)?.id,
   passDoorsReachable:capture.readers.passDoorsReachable(center,cell),itemCount:piles.length+(itemPods.get(i)??0)+(packed.get(i)??0),maxItems:groundMaxStacks(world,cell),
   haulDestinationAccepts:!storage||!source||storageCellAccepts(world,storage,source),saveCompressiblePresent:false,matchingStackSpace,
   fullFill:!!full[i],preventDropping:!!prevent[i],door:!!doors[i],workTable:!!work[i],downedPawn:actors.some(a=>a.downed),anyPawn:actors.length>0,selectablePlant:!!plants[i]};
 };
}
