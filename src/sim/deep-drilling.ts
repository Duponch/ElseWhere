import { deepWorkReason,deepWorkSpot,deepResearchSpeed,type DeepWorkTask,type DeepDrillState } from './deep-drilling-rules.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { DEEP_RESOURCES,deepSeed,deepRandom,deepResourceAt,nextDeepResource,deepRockItem,discoverDeepDeposit } from './deep-resources.ts';
import { miningWorkSpeed,miningYield,miningSkill } from './mining-skills.ts';
import { intellectualSkill } from './research.ts';
import { learnSkill } from './skills.ts';
import { routeToCell,type Reachability } from './pathfinding.ts';
import { planGroundPlacement } from './ground-placement.ts';
import { addMaterial,materialIdentityCount } from './materials.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { releaseWork } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface DeepWorkProposal {task:DeepWorkTask;path:Cell[]}
export function deepWorkWanted(world:World,pawn:Pawn):boolean {
  return world.schemaVersion>=215&&!!world.deepResources&&world.structures.some(s=>(s.kind==='deep-drill'||s.kind==='ground-scanner')&&!deepWorkReason(world,pawn,s));
}
export function deepWorkProposal(world:World,pawn:Pawn,s:Structure,reach:Reachability):DeepWorkProposal|undefined {
  if(deepWorkReason(world,pawn,s))return;
  const spot=deepWorkSpot(s),path=routeToCell(world,spot,reach);if(!path)return;
  return {task:{structureId:s.id,kind:s.kind==='deep-drill'?'drill':'scan',spot},path};
}
export function startDeepWork(pawn:Pawn,proposal:DeepWorkProposal):void {
  pawn.deepWork=proposal.task;pawn.path=proposal.path;pawn.state='moving';pawn.planCooldown=0;
}
function stop(world:World,pawn:Pawn):void {if(!releaseWork(world,pawn))interruptWork(world,pawn);}
export function reconcileDeepWork(world:World,pawn:Pawn):boolean {
  const task=pawn.deepWork;if(!task)return false;
  const s=structureById(world,task.structureId),spot=s&&deepWorkSpot(s);
  if(!s||deepWorkReason(world,pawn,s,true)||task.kind!==(s.kind==='deep-drill'?'drill':'scan')||!spot||spot.x!==task.spot.x||spot.z!==task.spot.z){stop(world,pawn);return false;}
  return true;
}
export function deepWorkInProgress(world:World,structureId:number):boolean {
  return world.pawns.some(p=>p.deepWork?.structureId===structureId&&p.state==='working'&&p.moveCooldown===0&&(!p.motion||p.motion.end<=world.tick)&&!p.path.length&&p.x===p.deepWork.spot.x&&p.z===p.deepWork.spot.z);
}
function drillTick(world:World,pawn:Pawn,s:Structure,light:number):boolean {
  const policy=captureAllowedArea(world,pawn);
  const source=s.deepDrill??{progress:0,yieldPct:0,rng:deepSeed(world.seed,s.id^0x280d111)},draft:DeepDrillState={...source};
  const rate=Math.fround(miningWorkSpeed(pawn,undefined,light)),yieldFactor=Math.fround(miningYield(pawn));
  for(let sub=0;sub<10;sub++){
    draft.progress=Math.fround(draft.progress+rate);
    draft.yieldPct=Math.fround(draft.yieldPct+Math.fround(Math.fround(rate*yieldFactor)/10000));
    if(draft.progress>10000){
      const resource=nextDeepResource(world,s),item=resource?.item??deepRockItem(world,s),raw=resource?Math.min(resource.count,DEEP_RESOURCES[resource.item].portion):0;
      const exact=Math.fround(raw*draft.yieldPct),floor=Math.floor(exact),roll=deepRandom(draft),quantity=resource?Math.max(1,floor+(roll<exact-floor?1:0)):1;
      const interaction=deepWorkSpot(s),plan=planGroundPlacement(world,quantity,interaction,item,c=>(!policy||allowedAreaAllows(world,pawn,c,policy))&&(c.x!==s.x||c.z!==s.z)&&(c.x!==interaction.x||c.z!==interaction.z));
      const identities=plan?.reduce((n,part)=>n+materialIdentityCount(world,part.quantity,{type:'ground',...part.cell},item),0)??0;
      if(!plan||world.piles.length+identities>32768||!Number.isSafeInteger(world.nextId+identities))return false;
      if(resource){const live=deepResourceAt(world,resource.cell)!;live.count-=raw;
        if(!live.count)world.deepResources!.cells=world.deepResources!.cells.filter(c=>c!==live);}
      for(const part of plan)addMaterial(world,ITEM_DEFINITIONS[item].kind,part.quantity,{type:'ground',...part.cell},item);
      draft.progress=0;draft.yieldPct=0;
    }
  }
  draft.lastUsedAt=world.tick;s.deepDrill=draft;
  pawn.skills.mining??={...miningSkill(pawn)};learnSkill(pawn.skills.mining,650,pawn);return true;
}
function scannerTick(world:World,pawn:Pawn,s:Structure,light:number,ctx:NeedContext):void {
  const state=s.deepScanner??={daysWorking:0},speed=Math.fround(deepResearchSpeed(pawn,light));
  state.lastScanAt=world.tick;state.lastUserSpeed=speed;
  for(let sub=0;sub<10;sub++){
    state.daysWorking=Math.fround(state.daysWorking+Math.fround(speed/60000));
    const core=(world.tick-1)*10+sub+1;
    if((core+s.id)%59!==0)continue;
    const resources=world.deepResources!,roll=deepRandom(resources),chance=Math.fround(59/Math.fround(Math.fround(3/speed)*60000));
    if(roll<chance||state.daysWorking>=6){
      const found=discoverDeepDeposit(world);state.daysWorking=0;
      if(found)ctx.event(`${pawn.name} a découvert un gisement souterrain.`);
    }
  }
  pawn.skills.intellectual??={...intellectualSkill(pawn)};learnSkill(pawn.skills.intellectual,350,pawn);
}
export function processDeepWork(world:World,pawn:Pawn,ctx:NeedContext,light:()=>number=()=>1):boolean {
  if(!reconcileDeepWork(world,pawn))return false;
  const task=pawn.deepWork!,s=structureById(world,task.structureId)!;
  if(pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick||(pawn.stun?.untilCore??0)>world.tick*10)return true;
  if(pawn.x!==task.spot.x||pawn.z!==task.spot.z){ctx.move(task.spot,true);return true;}
  pawn.path=[];pawn.state='working';
  if(task.kind==='drill')drillTick(world,pawn,s,light());else scannerTick(world,pawn,s,light(),ctx);
  return true;
}
