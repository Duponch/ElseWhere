import {planAnimalDeathExplosion256,isExplosiveAnimal256} from './animal-death-explosion-v256.ts';
import {animalExecutionPart256} from './animal-execution-v256.ts';
import { storageCells,storageAt,storageCellAccepts } from './shelf-storage.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { equippedWeapon,isRangedWeaponItem } from './equipment-rules.ts';
import { findShotLine } from './combat-space.ts';
import { captureWorldShotGrid } from './combat-world.ts';
import { captureStandability } from './furniture-travel.ts';
import { routeToCell,routeToJob,type Reachability } from './pathfinding.ts';
import { rangedWeaponProfile } from './ranged-statistics.ts';
import { meleeContact } from './melee-space.ts';
import { reconcileAnimalHealth } from './wildlife-health.ts';
import { addResolvedInjury,remainingPartHealth } from './injury-state.ts';
import { healthRandom } from './health.ts';
import { shootingQueries,advanceShooter } from './shooting.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelHunting,type HuntingCommand,type HuntingTask } from './hunting-state.ts';
import { createGroundCapacityReader,storageCapacity } from './ground-placement.ts';
import { reservedSource } from './materials.ts';
import { pawnBody,medicallyStopped } from './health-rules.ts';
import { isColonist } from './affiliation.ts';
import {animalClaimed} from './animal-rest-state.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import { animalCorpseItem,pickUpRetainedCorpse } from './corpses.ts';
import type { NeedContext } from './needs.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { Cell,MaterialPile,Pawn,World,CommandResult } from './types.ts';

export function designateHunt(w:World,c:HuntingCommand):CommandResult {
  const a=w.wildlife?.animals.find(a=>a.id===c.animalId);
  if(!Number.isSafeInteger(c.animalId)||typeof c.enabled!=='boolean'||!a||a.state==='dead')return {ok:false,code:'invalid-command',reason:'Animal vivant introuvable.'};
  if(c.enabled&&a.domestic)return {ok:false,code:'invalid-command',reason:'Un animal domestique allié ne peut pas être chassé.'};
  if(c.enabled&&!w.hunting?.targets.includes(a.id)&&(w.hunting?.targets.length??0)>=256)return {ok:false,code:'invalid-command',reason:'Trop de cibles de chasse.'};
  const s=w.hunting??={targets:[],completed:0};
  if(c.enabled&&!s.targets.includes(a.id))s.targets.push(a.id);
  if(!c.enabled){s.targets=s.targets.filter(id=>id!==a.id);for(const p of w.pawns)if(p.hunting?.animalId===a.id){cancelHunting(p);p.path=[];p.state='idle';p.planCooldown=0;}}
  s.targets.sort((a,b)=>a-b);for(const p of w.pawns)p.planCooldown=0;
  return {ok:true};
}
export function huntingWanted(w:World,p:Pawn,animalId?:number):boolean {
  return isColonist(p)&&workPriority(p,'hunt')>0&&!p.draft&&!medicallyStopped(p)&&pawnBody(p).capacities.manipulation>0
    &&equippedWeapon(w,p)?.item!=='emp-launcher'&&isRangedWeaponItem(equippedWeapon(w,p)?.item)&&!!w.hunting?.targets.some(id=>(animalId===undefined||id===animalId)&&w.wildlife?.animals.some(a=>a.id===id&&allowedAreaAllows(w,p,a)&&!a.domestic&&a.state!=='dead')&&!w.pawns.some(o=>o.id!==p.id&&o.hunting?.animalId===id)&&(Number(w.schemaVersion)<378||!animalClaimed(w,id,p.id)));
}
/** Hunting seeks an unobstructed shot within 95% of weapon range, without
 * tactical cover scoring. All candidates share one bounded decision capture. */
function huntingPosition(w:World,p:Pawn,a:WildAnimal,reach:Reachability):{cell:Cell;path:Cell[];grid?:ReturnType<typeof captureWorldShotGrid>}|undefined {
  if(a.state==='downed'){
    const path=routeToJob(w,a,reach,false);return path?{cell:path.at(-1)??{x:p.x,z:p.z},path}:undefined;
  }
  const weapon=equippedWeapon(w,p),profile=weapon?.weapon?rangedWeaponProfile(weapon.item,weapon.weapon.quality):undefined;if(!profile)return;
  const range=Math.max(1.42,profile.range*.95),stands=captureStandability(w),margin=Math.ceil(range)+3;
  // Same three-cell lean margin as tactical posts. Preserve every candidate and
  // the current shooter; only unrelated terrain is omitted from this decision.
  const grid=captureWorldShotGrid(w,{minX:Math.min(p.x-3,a.x-margin),minZ:Math.min(p.z-3,a.z-margin),maxX:Math.max(p.x+3,a.x+margin),maxZ:Math.max(p.z+3,a.z+margin)});
  const policy=captureAllowedArea(w,p);
  const canShoot=(c:Cell)=>(!policy||allowedAreaAllows(w,p,c,policy))&&stands(c)&&findShotLine(grid,c,{cell:a,leans:false},range).ok;
  if(canShoot(p))return {cell:{x:p.x,z:p.z},path:[],grid};
  const candidates:Cell[]=[],r=Math.ceil(range);
  for(let z=Math.max(0,a.z-r);z<=Math.min(w.height-1,a.z+r);z++)for(let x=Math.max(0,a.x-r);x<=Math.min(w.width-1,a.x+r);x++)
    if((x-a.x)**2+(z-a.z)**2<=range*range)candidates.push({x,z});
  candidates.sort((a,b)=>(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.z-b.z||a.x-b.x);
  for(const cell of candidates){if(!canShoot(cell))continue;const path=routeToCell(w,cell,reach);if(path)return {cell,path,grid};}
}
export function huntingProposal(w:World,p:Pawn,reach:Reachability,animalId?:number):{task:HuntingTask;path:Cell[];target:Cell}|undefined {
  if(!huntingWanted(w,p,animalId))return;
  const targets=w.wildlife?.animals.filter(a=>(animalId===undefined||a.id===animalId)&&allowedAreaAllows(w,p,a)&&!a.domestic&&a.state!=='dead'&&w.hunting!.targets.includes(a.id)&&!w.pawns.some(o=>o.id!==p.id&&o.hunting?.animalId===a.id)&&(Number(w.schemaVersion)<378||!animalClaimed(w,a.id,p.id)))??[];
  targets.sort((a,b)=>(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.id-b.id);
  for(const a of targets){const plan=huntingPosition(w,p,a,reach);if(plan)return {task:{animalId:a.id,startedAt:w.tick,phase:'stalk',progress:0},path:plan.path,target:plan.cell};}
}
interface HuntContext extends NeedContext {candidates():Reachability|null;blocked():Uint8Array}
function stop(p:Pawn):void {cancelHunting(p);p.path=[];p.state='idle';p.planCooldown=20;}
function collect(w:World,p:Pawn,ctx:HuntContext):void {
  // A projectile may kill while its shooter is still recovering. Preserve the
  // weapon cooldown before starting the physically separate transport phase.
  if(p.shooting?.stance)return;
  const task=p.hunting!,body=w.piles.find(i=>i.id===task.animalId&&i.kind==='corpse');
  const retained=!body?w.wildlife?.animals.find(a=>a.id===task.animalId&&a.state==='dead'):undefined;
  if(!body&&!retained||body&&body.owner.type!=='ground'||reservedSource(w,task.animalId,p.id)>0){stop(p);return;}
  if(retained&&(retained.motion?.end??0)>w.tick)return;
  const sourceCell=body?.owner.type==='ground'?body.owner:retained!;
  const corpseItem=body?.item??animalCorpseItem(retained!.species);
  // A retained animal becomes the same undamaged corpse at pickup. This
  // read-only condition view prevalidates that existing conversion, without
  // allocating a pile or moving its owner before a destination is available.
  const corpse:MaterialPile=body??{id:retained!.id,kind:'corpse',item:corpseItem,quantity:1,owner:{type:'ground',x:sourceCell.x,z:sourceCell.z},
    corpse:{...retained!.animalMapAreas287?{animalMapAreas287:structuredClone(retained!.animalMapAreas287)}:{},animalId:retained!.id,species:retained!.species,sex:retained!.sex,ageTicks:retained!.ageTicks,...retained!.growthTracker?{growthTracker:retained!.growthTracker,ageCoreRemainder:retained!.ageCoreRemainder}:{},health:retained!.health!},
    rot:retained!.corpseRot??{progress:0,atTick:w.tick}};
  if(p.planCooldown>0){
    if(retained&&p.path.length){ctx.move(sourceCell,true);if(!p.path.length)p.planCooldown=0;}
    return;
  }
  const stored=storageAt(w,sourceCell),current=stored&&storageCellAccepts(w,stored,corpse)?stored:undefined;
  const facts=w.structures.some(s=>s.shelf)?createGroundCapacityReader(w):undefined;
  const zones=storageCells(w).filter(z=>allowedAreaAllows(w,p,z)&&(!current||z.priority>current.priority)&&(z.x!==sourceCell.x||z.z!==sourceCell.z)&&storageCellAccepts(w,z,corpse)&&storageCapacity(w,z,corpse,p.id,undefined,facts)>=1)
    .sort((a,b)=>b.priority-a.priority||(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.id-b.id);
  if(!zones.length){stop(p);return;}
  const reach=ctx.candidates();if(!reach)return;
  const path=routeToJob(w,sourceCell,reach,true);
  const zone=path&&zones.find(z=>routeToJob(w,z,reach,true));
  if(!zone){stop(p);return;}
  if(retained){
    if(path!.length){p.path=path!;p.state='moving';p.planCooldown=20;ctx.move(sourceCell,true);if(!p.path.length)p.planCooldown=0;return;}
    const picked=pickUpRetainedCorpse(w,p,retained.id);if(!picked){stop(p);return;}
    const forced=task.forced378===true;cancelHunting(p);p.haul={sourcePileId:picked.id,quantity:1,phase:'deliver',destination:{type:'stockpile',stockpileId:zone.id,forHunting:true},carryPileId:picked.id,pickupCell:{x:retained.x,z:retained.z}};
    if(forced)p.orders.active='haul';
    p.path=[];p.state='working';p.planCooldown=0;return;
  }
  const forced=task.forced378===true;cancelHunting(p);p.haul={sourcePileId:body!.id,quantity:1,phase:'pickup',destination:{type:'stockpile',stockpileId:zone.id,forHunting:true},carryPileId:null};
  if(forced)p.orders.active='haul';
  p.path=path!;p.state=p.path.length?'moving':'working';p.planCooldown=0;
}
export function processHunting(w:World,p:Pawn,ctx:HuntContext):void {
  if(!allowedAreaServicesAllowed(w,p)){stop(p);return;}
  const task=p.hunting!;
  if(p.draft||workPriority(p,'hunt')===0&&!(task.forced378===true&&!backgroundWorkRefusal(p,'hunt'))||!equippedWeapon(w,p)||equippedWeapon(w,p)?.item==='emp-launcher'||medicallyStopped(p)||pawnBody(p).capacities.manipulation===0){stop(p);return;}
  const a=w.wildlife?.animals.find(a=>a.id===task.animalId),corpse=w.piles.some(i=>i.id===task.animalId&&i.kind==='corpse');
  if(a?.domestic||Number(w.schemaVersion)>=378&&animalClaimed(w,task.animalId,p.id)){stop(p);return;}
  if(task.phase!=='collect'&&(a?.state==='dead'||corpse)){
    cancelShooting(p);task.phase='collect';task.progress=0;p.path=[];p.state='idle';
    if(w.hunting){w.hunting.targets=w.hunting.targets.filter(id=>id!==task.animalId);w.hunting.completed=Math.min(Number.MAX_SAFE_INTEGER,w.hunting.completed+1);}
    ctx.event(`${p.name} a achevé sa chasse.`);
  }
  if(task.phase==='collect'){collect(w,p,ctx);return;}
  if(!a||!w.hunting?.targets.includes(a.id)||w.tick-task.startedAt>500){stop(p);return;}
  if(a.state==='downed'){
    cancelShooting(p);if(p.shooting?.stance?.phase==='cooldown')return;
    if(!meleeContact(w,p,a,ctx.blocked())){task.phase='stalk';task.progress=0;ctx.move(a,false);return;}
    // The logical cell already denotes the captured edge's destination. Wait
    // for the falling animal to physically reach it before starting contact work.
    if((a.motion?.end??0)>w.tick){task.phase='stalk';task.progress=0;p.path=[];p.state='idle';return;}
    task.phase='finish';p.path=[];p.state='working';task.progress++;
    if(task.progress<18)return;
    const record=a.health!,random={rng:w.rng},part=animalExecutionPart256(record,()=>healthRandom(random));const remaining=remainingPartHealth(record,part);
    const damage=Math.min(1000,Math.max(0,Math.floor(remaining)-1000));
    if(damage>0)addResolvedInjury(record,part,'execution-cut',damage,()=>healthRandom(random));
    if(!record.death)record.death={tick:w.tick,cause:'execution'};
    const death=planAnimalDeathExplosion256(w,a,record);death.commit();a.health=record;w.rng=random.rng;reconcileAnimalHealth(w,a);
    // Publish the terminal phase before the dead animal becomes a physical pile.
    // The body conversion can happen in this same tick.
    cancelShooting(p);task.phase='collect';task.progress=0;p.state='idle';
    if(w.hunting){w.hunting.targets=w.hunting.targets.filter(id=>id!==task.animalId);w.hunting.completed=Math.min(Number.MAX_SAFE_INTEGER,w.hunting.completed+1);}
    ctx.event(`${p.name} a achevé sa chasse.`);
    return;
  }
  if(task.phase==='finish'){task.phase='stalk';task.progress=0;}
  if(p.shooting?.stance)return;
  if(p.planCooldown>0&&p.path.length){ctx.move(p.path.at(-1)!,true);return;}
  if(p.planCooldown>0)return;
  const reach=ctx.candidates();if(!reach)return;
  const position=huntingPosition(w,p,a,reach);p.planCooldown=20;
  if(!position){stop(p);return;}
  if(position.path.length){p.path=position.path;p.state='moving';ctx.move(position.cell,true);return;}
  const weapon=equippedWeapon(w,p)!;p.path=[];p.state='idle';
  p.shooting={order:{targetId:a.id,weaponId:weapon.id,startedDowned:false,hunt:true},stance:null};
  // No cover mutation occurred since choosing the shot; discard this capture
  // on return, before another actor, projectile or tick may change the world.
  advanceShooter(w,p,w.tick*10,shootingQueries(w,()=>position.grid!));
}
