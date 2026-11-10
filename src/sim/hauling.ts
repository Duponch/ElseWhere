import {validAiCorePile298} from './victory-content-save-298.ts';
import {finishBarrelFill265} from './fermentation-runtime-265.ts';
import {FERMENTING_SERVICE_TICKS_265} from './fermentation-state-265.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { processFurnitureHaul } from './furniture-hauling.ts';
import { constructionSiteFree } from './construction-rules.ts';
import { copyPileCondition } from './pile-condition.ts';
import { refuelable, FUEL_UNIT_TICKS, REFUEL_WORK_TICKS } from './fuel.ts';
import { reloadableTurret,turretReloadPawnReason,TURRET_RELOAD_WORK_TICKS } from './mini-turret-reload.ts';
import { destinationCell, destinationValid } from './work-planner.ts';
import { releaseWork } from './work-release.ts';
import { footprintCells } from './definitions.ts';
import { adjacent, workNeighbours } from './pathfinding.ts';
import { woodWallTouch301 } from './wall-frame-kind-301.ts';
import { transferPile } from './materials.ts';
import {planConstructionPlantRetirement,commitConstructionPlantRetirement} from './plant-retirement.ts';
import { haulingWork } from './work-types.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import type { Cell, Job, Pawn, World } from './types.ts';
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
const nearby = (a: Cell, b: Cell) => sameCell(a, b) || adjacent(a, b);

export function processHaul(world: World, pawn: Pawn, move: (target: Cell, allowTarget: boolean) => void, wake: () => void): void {
  const task = pawn.haul!;
  if(backgroundWorkRefusal(pawn,haulingWork(task.destination))){releaseWork(world,pawn);return;}
  if(task.destination.type==='turret'&&turretReloadPawnReason(pawn)){releaseWork(world,pawn);return;}
  if(task.whole){processFurnitureHaul(world,pawn,move,wake);return;}
  if (!destinationValid(world, pawn)) { releaseWork(world, pawn); return; }
  if (task.phase === 'pickup') {
    const source = world.piles.find(item => item.id === task.sourcePileId);
    if (!source || !eggAllowedForPlayer256(source)||source.owner.type !== 'ground' || source.quantity < task.quantity) { releaseWork(world, pawn); return; }
    if (!nearby(pawn, source.owner)) { move(source.owner, true); return; }
    const aiCore298=source.kind==='ai-core'||source.item==='ai-core';
    if(aiCore298&&(!validAiCorePile298(source,world.schemaVersion)||task.quantity!==1)){releaseWork(world,pawn);return;}
    if (!aiCore298&&source.kind!=='book'&&source.kind!=='plant'&&source.kind!=='corpse'&&source.kind!=='mech-corpse'&&source.kind!=='unfinished'&&source.kind!=='weapon'&&source.kind!=='apparel'&&(!Number.isSafeInteger(world.nextId + 1) || (source.quantity > task.quantity && world.piles.length >= 32768))) { releaseWork(world, pawn); return; }
    task.pickupCell={x:source.owner.x,z:source.owner.z};
    if(aiCore298||source.kind==='book'||source.kind==='plant'||source.kind==='corpse'||source.kind==='mech-corpse'||source.kind==='unfinished'||source.kind==='weapon'||source.kind==='apparel'){
      source.owner={type:'pawn',pawnId:pawn.id};task.carryPileId=source.id;task.phase='deliver';pawn.path=[];pawn.planCooldown=0;pawn.state='working';return;
    }
    source.quantity -= task.quantity;
    if (!source.quantity) world.piles.splice(world.piles.indexOf(source), 1);
    const carryId = world.nextId++;
    world.piles.push({ id: carryId, kind: source.kind, item: source.item, quantity: task.quantity, owner: { type: 'pawn', pawnId: pawn.id }, ...copyPileCondition(source) });
    task.carryPileId = carryId; task.phase = 'deliver'; pawn.path = []; pawn.planCooldown = 0; pawn.state = 'working'; return;
  }
  const target = destinationCell(world, task.destination);
  const carry = world.piles.find(item => item.id === task.carryPileId);
  if (!target || !carry) { releaseWork(world, pawn); return; }
  if((carry.kind==='ai-core'||carry.item==='ai-core')&&(!validAiCorePile298(carry,world.schemaVersion)||task.quantity!==1)){releaseWork(world,pawn);return;}
  // A wood wall Frame (schema 301+) is touched from its eight neighbours, the
  // same goals the route to it uses: arriving diagonally is arriving.
  const touch = task.destination.type === 'job' && woodWallTouch301(world, target as Job);
  const atTarget = task.destination.type === 'job' ? footprintCells(target as Job).some(cell => touch ? workNeighbours(cell, undefined, true).some(next => sameCell(next, pawn)) : adjacent(pawn, cell)) && !footprintCells(target as Job).some(cell => sameCell(pawn, cell)) : task.destination.type==='fuel'?footprintCells(target as Job).some(cell=>nearby(pawn,cell)):nearby(pawn, target);
  if (!atTarget) { move(target, task.destination.type !== 'job'); return; }
  if(task.destination.type==='job'&&!constructionSiteFree(world,target as Job,pawn.id)){releaseWork(world,pawn);return;}
  if(task.destination.type==='job'&&(target as Job).kind!=='fix-breakdown'&&(target as Job).kind!=='lay-floor'){
    // transferPile to this live job cannot fail after these exact source/owner
    // checks. Retire before payment so the target signature stays unchanged.
    if(!world.piles.includes(carry)||carry.owner.type!=='pawn'||carry.owner.pawnId!==pawn.id)return;
    const retirement=planConstructionPlantRetirement(world,target as Job,(target as Job).id,'frame');
    if(!retirement||retirement.actors.has(pawn.id)||!commitConstructionPlantRetirement(world,retirement)){pawn.path=[];pawn.state='working';return;}
  }
  if(task.destination.type==='fermenting-barrel'){
    if((pawn.motion?.end??0)>world.tick||pawn.moveCooldown>0)return;
    pawn.state='working';pawn.path=[];task.serviceProgress=(task.serviceProgress??0)+1;
    if(task.serviceProgress<FERMENTING_SERVICE_TICKS_265)return;
    if(!finishBarrelFill265(world,pawn,carry)){releaseWork(world,pawn);return;}
  } else if (task.destination.type==='turret') {
    pawn.state='working';pawn.path=[];task.serviceProgress=(task.serviceProgress??0)+1;
    if(task.serviceProgress<TURRET_RELOAD_WORK_TICKS)return;
    const turret=reloadableTurret(world,task.destination.structureId)!;
    turret.turret!.ammoQ=Math.min(240,turret.turret!.ammoQ+carry.quantity*3);
    world.piles.splice(world.piles.indexOf(carry),1);
  } else if (task.destination.type==='fuel') {
    pawn.state='working';pawn.path=[];task.serviceProgress=(task.serviceProgress??0)+1;
    if(task.serviceProgress<REFUEL_WORK_TICKS)return;
    const fire=refuelable(world,task.destination.structureId)!;
    fire.fuel!.ticks+=carry.quantity*FUEL_UNIT_TICKS;
    world.piles.splice(world.piles.indexOf(carry),1);
  } else if(!transferPile(world,carry,task.destination.type === 'job' ? { type:'job',jobId:task.destination.jobId } : {type:'ground',x:target.x,z:target.z})) {releaseWork(world,pawn);return;}
  if(task.destination.type==='job'&&(target as Job).kind!=='fix-breakdown')(target as Job).construction='frame';
  pawn.haul = null; if(pawn.orders.active==='haul')pawn.orders.active=null;
  pawn.path = []; pawn.state = 'idle'; pawn.planCooldown = 0; wake();
}
