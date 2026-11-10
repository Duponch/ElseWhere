import {assignPileOwner} from './pile-index.ts';
import { furnitureHaulCell, furnitureHaulValid } from './furniture-haul-rules.ts';
import { releaseWork } from './work-release.ts';
import { haulingWork } from './work-types.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { adjacent } from './pathfinding.ts';
import type { Cell, Pawn, World } from './types.ts';

export function processFurnitureHaul(world:World,pawn:Pawn,move:(target:Cell,allowTarget:boolean)=>void,wake:()=>void):void {
  const task=pawn.haul!;
  if(backgroundWorkRefusal(pawn,haulingWork(task.destination))){releaseWork(world,pawn);return;}
  if(!furnitureHaulValid(world,task,pawn.id)){releaseWork(world,pawn);return;}
  const pack=world.packed.find(p=>p.building.id===task.sourcePileId)!;
  const target=task.phase==='pickup'?pack.owner as Cell:furnitureHaulCell(world,task.destination)!;
  if(!(pawn.x===target.x&&pawn.z===target.z)&&!adjacent(pawn,target)){move(target,true);return;}
  pawn.path=[];
  if(task.phase==='pickup') {
    task.pickupCell={x:target.x,z:target.z};assignPileOwner(pack,{type:'pawn',pawnId:pawn.id});task.phase='deliver';task.carryPileId=pack.building.id;pawn.state='working';return;
  }
  assignPileOwner(pack,{type:'ground',x:target.x,z:target.z});pawn.haul=null;pawn.state='idle';pawn.planCooldown=0;
  if(pawn.orders.active==='haul')pawn.orders.active=null;
  wake();
}
