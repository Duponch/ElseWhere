import {assignPileOwner} from './pile-index.ts';
import {initializeFirefoamPopper290} from './firefoam-290.ts';
import {pauseGlowPod256,resumeGlowPod256} from './cave-glowpod-minification-256.ts';
import {prepareLinkedShelfInstall286,adoptLinkedShelfInstallWrites286} from './linked-storage-lifecycle-286.ts';
import {normalizeBillWorkersAtInstall283} from './bill-worker-owners-283.ts';
import {clearSnowForStructure} from './snow-surface.ts';
import {shelfAt} from './shelf-storage.ts';
import {planShelfRemoval,commitShelfRemoval} from './shelf-retirement.ts';
import {prepareBedOwnershipTransition256} from './actor-bed-transition-256.ts';
import { groundCapacity, groundPile, groundPileCells, nearbyGround } from './ground-placement.ts';
import { MAX_STACK, footprintCells } from './definitions.ts';
import { furnitureDuration, furnitureReady, furnitureWorkTarget, packedAt, type PackedFurniture } from './furniture-rules.ts';
import type { Cell, Job, Pawn, Structure, World } from './types.ts';
import { advanceWork, resetWork, workProgress } from './work-progress.ts';
import {planSelectedDrops,releaseWork,type DropPlan} from './work-release.ts';
import {initialSpikeTrapState} from './spike-trap-state.ts';
import {planConstructionPlantRetirement,commitConstructionPlantRetirement} from './plant-retirement.ts';
import { structureById } from './structure-navigation.ts';

/** A whole object needs a completely unreserved slot, never a compatible stack.
 * A full wood-slot capacity also excludes every typed inbound reservation. */
export function furnitureDropCell(world:World,origin:Cell,exceptPawn?:number):Cell|undefined {
  const free=(c:Cell)=>!shelfAt(world,c)&&!groundPile(world,c)&&!packedAt(world,c)&&groundCapacity(world,c,'wood',exceptPawn)===MAX_STACK;
  if(free(origin))return {x:origin.x,z:origin.z};
  const occupied=groundPileCells(world);
  return nearbyGround(world,origin).find(c=>!shelfAt(world,c)&&!occupied.has(c.z*world.width+c.x)&&!packedAt(world,c)&&groundCapacity(world,c,'wood',exceptPawn)===MAX_STACK);
}
export function releaseFurniture(world:World,pawn:Pawn,plan?:ReadonlyMap<number,Cell>):boolean {
  const pack=world.packed?.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);if(!pack)return true;
  const cell=plan?.get(pack.building.id)??furnitureDropCell(world,pawn,pawn.id);if(!cell)return false;
  assignPileOwner(pack,{type:'ground',...cell});return true;
}

interface FlowerWithdrawalPlan {ids:Set<number>;actors:Set<number>;drops:DropPlan}
/** Internal cultivation jobs belong to the installed pot, not its minified
 * wrapper. Preflight only this exact pot and actual workers, retaining unrelated
 * queued intents and captured travel; never drop at a future logical arrival. */
function planFlowerWithdrawal(world:World,source:Structure):FlowerWithdrawalPlan|null {
  const ids=new Set(world.jobs.filter(j=>j.flowerPotId===source.id).map(j=>j.id));
  const actors=new Set(world.pawns.filter(p=>p.jobId!==null&&ids.has(p.jobId)).map(p=>p.id));
  if(world.pawns.some(p=>actors.has(p.id)&&(p.motion?.end??0)>world.tick
    &&(world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||world.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))))return null;
  const drops=planSelectedDrops(world,ids,actors);return drops?{ids,actors,drops}:null;
}
function flowerWithdrawalView(world:World,plan:FlowerWithdrawalPlan):World {
  if(!plan.drops.size)return world;
  return {...world,piles:world.piles.map(p=>{const c=plan.drops.get(p.id);return c?{...p,owner:{type:'ground' as const,...c}}:p;}),
    packed:world.packed.map(p=>{const c=plan.drops.get(p.building.id);return c?{...p,owner:{type:'ground' as const,...c}}:p;})};
}
function commitFlowerWithdrawal(world:World,plan:FlowerWithdrawalPlan):void {
  for(const pawn of world.pawns)if(plan.actors.has(pawn.id)&&!releaseWork(world,pawn,plan.drops))throw Error('Preflighted flower-pot work could not release its cargo.');
  if(!plan.ids.size)return;
  for(const pawn of world.pawns)pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order!=='number'||!plan.ids.has(order));
  world.jobs=world.jobs.filter(j=>!plan.ids.has(j.id));
}

function detach(world:World,job:Job,owner:PackedFurniture['owner']):PackedFurniture {
  const building=structureById(world,job.furniture!.structureId)!;
  const bedOwnership=prepareBedOwnershipTransition256(world,building,'pack');
  world.structures=world.structures.filter(s=>s!==building);
  if(building.spikeTrap)building.spikeTrap.touching=[];
  if(building.firefoam290)delete building.firefoam290.wick;
  for(const p of world.pawns)if(p.need?.kind==='eat'&&p.need.dining?.tableId===building.id)p.need.dining.tableId=null;
  if(building.power){building.power.parentId=null;building.power.on=false;}
  pauseGlowPod256(world,building);
  const pack={building,owner};world.packed.push(pack);bedOwnership?.commit();return pack;
}
/** Returns true only after an authoritative topology/ownership transition. */
export function advanceFurniture(world:World,pawn:Pawn,job:Job,move:(target:Cell & {kind?:Job['kind']|Structure['kind']})=>void,release:()=>boolean,workRate:()=>number=()=>1):boolean {
  if(!furnitureReady(world,job,pawn)){release();return false;}
  const target=furnitureWorkTarget(world,job),cells='kind' in target?footprintCells(target as Job):[target];
  if(!cells.some(c=>Math.abs(c.x-pawn.x)+Math.abs(c.z-pawn.z)===1)||cells.some(c=>c.x===pawn.x&&c.z===pawn.z)) {move(target);return false;}
  pawn.path=[];pawn.state='working';
  const id=job.furniture!.structureId,source=structureById(world,id);
  let pack=world.packed.find(p=>p.building.id===id);
  if(source) {
    const flower=source.kind==='flower-pot'?planFlowerWithdrawal(world,source):undefined;
    if(flower===null)return false;
    advanceWork(job,workRate());
    if(workProgress(job)<furnitureDuration(world,job))return false;
    const removal=planShelfRemoval(world,source);if(!removal){release();return false;}
    if(job.kind==='uninstall') {
      const view=flower?flowerWithdrawalView(removal.view,flower):removal.view;
      const cell=furnitureDropCell(view,source);
      if(!cell){release();return false;}
      if(flower)commitFlowerWithdrawal(world,flower);
      commitShelfRemoval(world,removal);detach(world,job,{type:'ground',...cell});
    } else {
      if(flower)commitFlowerWithdrawal(world,flower);
      commitShelfRemoval(world,removal);pack=detach(world,job,{type:'pawn',pawnId:pawn.id});resetWork(job);return true;
    }
  } else if(pack?.owner.type==='ground') {
    assignPileOwner(pack,{type:'pawn',pawnId:pawn.id});resetWork(job);return true;
  } else if(pack?.owner.type==='pawn') {
    const bedOwnership=prepareBedOwnershipTransition256(world,pack.building,'install');
    // The consulted hauling driver has no timed install work for a blueprint.
    // The 150 WorkTotal field is inspection text, not its execution duration.
    // The same object is installed, not a replacement with copied attributes.
    const retirement=planConstructionPlantRetirement(world,job,job.id);
    const linked=prepareLinkedShelfInstall286(world,pack.building);
    if(!retirement||retirement.actors.has(pawn.id)||!linked.ok||!linked.current()||!commitConstructionPlantRetirement(world,retirement))return false;
    adoptLinkedShelfInstallWrites286(linked);
    Object.assign(pack.building,{x:job.x,z:job.z,orientation:job.orientation});resumeGlowPod256(world,pack.building);
    if(pack.building.kind==='spike-trap')pack.building.spikeTrap=initialSpikeTrapState(world,pack.building);
    if(pack.building.kind==='firefoam-popper')initializeFirefoamPopper290(world,pack.building);
    world.packed=world.packed.filter(p=>p!==pack);world.structures.push(pack.building);clearSnowForStructure(world,pack.building);normalizeBillWorkersAtInstall283(world,pack.building);
    bedOwnership?.commit();
  } else {release();return false;}
  world.jobs=world.jobs.filter(j=>j!==job);pawn.jobId=null;pawn.path=[];pawn.state='idle';pawn.planCooldown=0;
  world.events.push({tick:world.tick,type:'job',message:`${pawn.name} a ${job.kind==='uninstall'?'désinstallé':'installé'} le meuble.`});
  if(world.events.length>80)world.events.shift();return true;
}
