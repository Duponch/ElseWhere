import {assignPileOwner} from './pile-index.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {spawnEnabledHivePawn256,enabledHivePoints256,enabledHiveChildCell256} from './temple-hive-production-256.ts';
import {spawnActualHive256} from './cave-hive-spawn-256.ts';
import {planNaturalHiveLoss256} from './cave-hive-loss-256.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {hasTravellingCargo,interruptWork} from './interrupted-cargo.ts';
/** A synchronous sparse transaction over ONE real map. Tiles/actors/clock are
 * shared read-only with its actual owner. Only changed components/products and
 * filth are staged; no substitute map or retained historical grid exists. */
import type {World,Structure,Cell} from './types.ts';
import {planSelectedDrops,releaseWork} from './work-release.ts';
import {planCaveHiveKill256,commitHiveKilledProducts256} from './cave-hive-leavings-256.ts';
import {notifyRemovedHiveProp256} from './cave-hive-damage-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import {healthRandom} from './health.ts';
import {refreshStock} from './materials.ts';
import {RoomTopologyCache} from './room-topology.ts';
import {captureHiveClosewalk256} from './cave-hive-closewalk-256.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {captureWorldShotGrid} from './combat-world.ts';
import {clearShotSegment} from './combat-space.ts';
import {depositHiveSlime256,type HiveAdjacentRuntime256} from './cave-hive-filth-256.ts';
import {hiveNextPawnCore256,hiveNextReproductionCore256,glowPodAgeAtCore256} from './cave-hive-clocks-256.ts';
import {hiveMtbOccurs256} from './cave-hive-think-256.ts';
import {planHiveJellyDeposit256} from './cave-hive-products-256.ts';
import {groupHashOffset256} from './group-core-cadence-256.ts';
import {consumeDisabledHiveSearch256} from './cave-hive-child-search-256.ts';
import type {ActualHive256,ActualGlowPod256} from './cave-hive-state-256.ts';
export interface HiveRuntimeFrontier256 extends HiveAdjacentRuntime256 {enemyReproductionRateFactor:number;lordIds?:{nextId:number}}
export type HiveRuntimePlan256={status:'ready';commit():boolean}|{status:'blocked';reason:string};
const hive=(s:Structure):s is ActualHive256=>s.kind==='insect-hive'&&!!s.caveHive;
const pod=(s:Structure):s is ActualGlowPod256=>s.kind==='glow-pod'&&!!s.glowPod;
const around=(s:Cell):Cell[]=>[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]].map(([x,z])=>({x:s.x+x!,z:s.z+z!}));
const near=(s:Cell,c:Cell)=>Math.max(Math.abs(s.x-c.x),Math.abs(s.z-c.z))<=1;
function productCell(w:World,s:ActualHive256,edifice:boolean,count:number,random:Pick<WorldGenerationRandom,'integer'|'value'|'float'>):Cell|null {
 const adjacent=around(s),physical=captureActualLocalDistricts256(w),grid=captureWorldShotGrid(w);
 // GenCollection.InRandomOrder draws the next index lazily. Breaking on the
 // first cell does not consume the draws of a full Fisher-Yates shuffle.
 for(let left=adjacent.length;left>0;left--){
  const at=random.integer(0,left),c=adjacent[at]!;[adjacent[at],adjacent[left-1]]=[adjacent[left-1]!,c];
  if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height||!physical.normalWalkable(c.z*w.width+c.x)||!clearShotSegment(grid,s,c))continue;
  const structure=w.structures.find(b=>b.x===c.x&&b.z===c.z);
  if(structure&&(edifice||structure.shelf||structure.kind==='hopper'||structure.door&&!structure.door.open))continue;
  if(w.packed.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z)||w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z&&(edifice||p.item!=='insect-jelly'||p.quantity>75-count)))continue;
  return c;
 }
 return null;
}
/** Called after the shared clock reaches `w.tick`, before any Hive work at that
 * boundary. A refusal leaves every original, ID, component, stream and shared
 * GenAdj permutation untouched. The parent must stop, never skip this result. */
export function planActualHiveRuntime256(w:World,frontier:HiveRuntimeFrontier256):HiveRuntimePlan256 {
 const originals=w.structures.filter(s=>hive(s)||pod(s));if(!originals.length)return {status:'ready',commit:()=>true};
 const end=w.tick*10,start=end-10;
 if(!isSchema256Or257(w.schemaVersion)||w.site?.revision!==3||w.planet?.revision!==3||start<0||!Number.isFinite(frontier.enemyReproductionRateFactor)||frontier.enemyReproductionRateFactor<0||frontier.adjacentPermutation.length!==8||new Set(frontier.adjacentPermutation).size!==8||frontier.adjacentPermutation.some(i=>!Number.isInteger(i)||i<0||i>7)||!Number.isSafeInteger(frontier.adjacentUses)||frontier.adjacentUses<0)return {status:'blocked',reason:'Missing actual Site3 Hive runtime clock/GenAdj/difficulty'};
 if(originals.some(s=>hive(s)?(s.caveHive.lastCore??s.caveHive.madeAtCore)!==start:pod(s)&&(s.glowPod.lastCore??s.glowPod.madeAtCore)!==start))return {status:'blocked',reason:'Hive/GlowPod continuation is not at its actual current Core boundary'};
 const enabled=originals.some(s=>hive(s)&&s.caveHive.temple);
 if(enabled&&(!frontier.lordIds||!Number.isInteger(frontier.lordIds.nextId)||frontier.lordIds.nextId<0||frontier.lordIds.nextId>=2147483646))return {status:'blocked',reason:'Missing actual enabled Hive Lord counter'};
 const baseLord=frontier.lordIds?.nextId,lordIds={nextId:baseLord??0},baseWildlife=w.wildlife,createdProps:Structure[]=[];
 const baseStructures=w.structures,basePiles=w.piles,baseFilth=w.filth,baseNext=w.nextId,baseUse=frontier.adjacentUses,basePermutation=[...frontier.adjacentPermutation],baseRandom=w.rng,baseJobs=w.jobs,basePacked=w.packed,baseDestroyed=w.destroyed;
 // Existing gameplay stream, copied scalar only. Generation Rand stays in its
 // original owner; the hourly maintenance check uses its separate private seed.
 const randomState={rng:baseRandom},fork=animalClinicalRandom256(()=>healthRandom(randomState)),stamps=originals.map(s=>JSON.stringify(s)),runtime={adjacentPermutation:[...frontier.adjacentPermutation],adjacentUses:frontier.adjacentUses};
 const pairs=new Map<Structure,Structure>();
 for(const s of originals)pairs.set(s,hive(s)?{...s,caveHive:{...s.caveHive,spawnedPawnIds:[...s.caveHive.spawnedPawnIds]}}:{...s,glowPod:{...(s as ActualGlowPod256).glowPod}});
 const stage:World={...w,structures:w.structures.map(s=>pairs.get(s)??s)};
 let copiedPiles=false,copiedFilth=false,copiedPacked=false,copiedWildlife=false;let wildlifeStamp:string|undefined;
 const ownWildlife=()=>{if(copiedWildlife)return;if(!w.wildlife)throw Error('Enabled Hive lost its physical wildlife owner');wildlifeStamp=JSON.stringify(w.wildlife);stage.wildlife={...w.wildlife,animals:[...w.wildlife.animals],...w.wildlife.hiveLords?{hiveLords:structuredClone(w.wildlife.hiveLords)}:{}};copiedWildlife=true;};
 const removed:{original:Structure;core:number;defeat:boolean}[]=[],removedJobs=new Set<number>();const releases=new Map<number,Cell>();
 const ownPiles=()=>{if(!copiedPiles){stage.piles=w.piles.map(p=>({...p,owner:{...p.owner}}));copiedPiles=true;}};
 const ownFilth=()=>{if(!copiedFilth){stage.filth=w.filth?{...w.filth,items:w.filth.items.map(f=>({...f}))}:undefined;copiedFilth=true;}};
 const kill=(original:Structure,s:Structure,core:number)=>{
  ownPiles();if(!copiedPacked){stage.packed=w.packed.map(p=>({...p,owner:{...p.owner}}));copiedPacked=true;}
  for(const j of stage.jobs)if(j.furniture?.structureId===s.id||j.deconstruction?.structureId===s.id||j.repair?.structureId===s.id)removedJobs.add(j.id);
  if(stage.piles.some(p=>p.owner.type==='job'&&removedJobs.has(p.owner.jobId)))throw Error('Natural building removal has an actual foreign escrow');
  const actors=new Set(w.pawns.filter(p=>p.jobId!==null&&removedJobs.has(p.jobId)&&!hasTravellingCargo(stage,p)).map(p=>p.id)),drops=planSelectedDrops(stage,removedJobs,actors);if(!drops)throw Error('Actual natural-building cargo cannot be released');
  for(const [id,c] of drops)releases.set(id,c);
  for(const p of stage.piles){const c=releases.get(p.id);if(c)assignPileOwner(p,{type:'ground',...c});}for(const p of stage.packed){const c=releases.get(p.building.id);if(c)assignPileOwner(p,{type:'ground',...c});}
  stage.structures=stage.structures.filter(b=>b!==s);
  const plan=planCaveHiveKill256(stage,s,s,randomState.rng,true);if(!plan)throw Error('Actual natural-building killed leavings cannot fit');
  randomState.rng=plan.rng;if(plan.rubble){stage.filth=plan.rubble.filth;stage.nextId=plan.rubble.nextId;copiedFilth=true;}commitHiveKilledProducts256(stage,plan.hiveProducts);
  stage.structures=stage.structures.filter(b=>b!==s);stage.jobs=stage.jobs.filter(j=>!removedJobs.has(j.id));removed.push({original,core,defeat:s.kind==='insect-hive'&&!stage.structures.some(b=>hive(b)&&!foggedCell256(stage,b.z*stage.width+b.x))});
  const lost=planNaturalHiveLoss256(stage.destroyed,s.kind as 'insect-hive'|'glow-pod');if(!lost)throw Error('Actual natural destruction counter exhausted');stage.destroyed=lost;
 };
 let failure:string|undefined;
 try {
  for(let core=start+1;core<=end;core++)for(const original of [...originals,...createdProps]){
   const s=pairs.get(original)??original;if(!stage.structures.includes(s))continue;
   if(pod(s)){
    if(core>s.glowPod.madeAtCore&&core%250===s.id%250){
     s.glowPod.ageCore+=250;
     if(s.glowPod.ageCore>=1200000){
      kill(original,s,core);
     }
    }continue;
   }
   if(!hive(s))continue;
   const c=s.caveHive;if(core<=c.madeAtCore)continue;
   if(++c.healCore>=6000){c.healCore=0;if(s.damage){s.damage--;if(!s.damage)delete s.damage;}}
   if(c.awakeAtCore===null){if(!foggedCell256(stage,s.z*w.width+s.x))c.awakeAtCore=core;continue;}
   if(c.temple){
    if(c.nextPawnSpawnCore===-1){ownWildlife();for(let attempt=0;enabledHivePoints256(stage,s)<200&&attempt<1000;attempt++)if(!spawnEnabledHivePawn256(stage,s,core,fork,lordIds))break;c.nextPawnSpawnCore=hiveNextPawnCore256(core,c.spawnedPawnIds.length,frontier.enemyReproductionRateFactor,fork);}
    if(core>=c.nextPawnSpawnCore){ownWildlife();if(frontier.enemyReproductionRateFactor>0)spawnEnabledHivePawn256(stage,s,core,fork,lordIds);c.nextPawnSpawnCore=hiveNextPawnCore256(core,c.spawnedPawnIds.length,frontier.enemyReproductionRateFactor,fork);}
   }else if(core>=c.nextPawnSpawnCore)c.nextPawnSpawnCore=hiveNextPawnCore256(core,c.spawnedPawnIds.length,frontier.enemyReproductionRateFactor,fork);
   if(!c.wasActivated){const topology=new RoomTopologyCache().read(stage),room=topology.at(s.x,s.z),count=stage.structures.filter(b=>hive(b)&&(b.x-s.x)**2+(b.z-s.z)**2<=81&&topology.at(b.x,b.z)===room).length;c.nextHiveSpawnCore=hiveNextReproductionCore256(core,count,frontier.enemyReproductionRateFactor,fork);c.wasActivated=true;}
   if(core>=c.nextHiveSpawnCore){if(c.canSpawnHives){
    const childCell=enabledHiveChildCell256(stage,s,fork);
    if(childCell!==null&&frontier.enemyReproductionRateFactor>0&&stage.structures.filter(h=>h.kind==='insect-hive').length<30){
     ownPiles();ownFilth();ownWildlife();if(!copiedPacked){stage.packed=w.packed.map(p=>({...p,owner:{...p.owner}}));copiedPacked=true;}const before=new Set(stage.structures),context={...runtime,runtimeWildlifeRng:stage.wildlife!.rng,enemyReproductionRateFactor:frontier.enemyReproductionRateFactor,lordIds,atCore:core};
     const child=spawnActualHive256(stage,childCell,fork,context,{spawnInsectsImmediately:false,canSpawnHives:true,canSpawnInsects:true,dormant:false,aggressive:true,spawnJellyImmediately:false,runtime:true,extras:false});
     runtime.adjacentPermutation.splice(0,8,...context.adjacentPermutation);runtime.adjacentUses=context.adjacentUses;if(child.status==='ready')for(const p of stage.structures)if(!before.has(p))createdProps.push(p);
    }
   }else consumeDisabledHiveSearch256(stage,s,fork);const topology=new RoomTopologyCache().read(stage),room=topology.at(s.x,s.z),count=stage.structures.filter(b=>hive(b)&&(b.x-s.x)**2+(b.z-s.z)**2<=81&&topology.at(b.x,b.z)===room).length;c.nextHiveSpawnCore=hiveNextReproductionCore256(core,count,frontier.enemyReproductionRateFactor,fork);}
   if(--c.jellyLeftCore<=0){
    c.jellyLeftCore=fork.integer(26000,30001);
    const adjacent=stage.piles.filter(p=>p.item==='insect-jelly'&&p.owner.type==='ground'&&near(s,p.owner)).reduce((n,p)=>n+p.quantity,0);
    if(adjacent<40){const cell=productCell(stage,s,false,20,fork);if(cell){ownPiles();const placement=planHiveJellyDeposit256(stage,cell,20,true);if(!placement||!placement.commit())throw Error('Actual periodic Jelly placement/allocator refused');}}
   }
   if(--c.podLeftCore<=0){
    c.podLeftCore=fork.integer(30000,60001);
    if(!stage.structures.some(b=>pod(b)&&near(s,b))){const cell=productCell(stage,s,true,1,fork);if(cell){
     if(!Number.isSafeInteger(stage.nextId+1)||stage.structures.length>=32768)throw Error('Actual periodic GlowPod capacity/identity exhausted');
     const id=stage.nextId++,made:ActualGlowPod256={id,kind:'glow-pod',...cell,orientation:0,footprint:'standard',factionId:s.factionId,glowPod:{revision:1,madeAtCore:core,ageCore:glowPodAgeAtCore256(id,core,end),lastCore:end}};stage.structures.push(made);
    }}
   }
   if(hiveMtbOccurs256(4,2500,1,fork)){
    const physical=captureHiveClosewalk256(stage),cell=physical.tryCell(s.z*w.width+s.x,5,fork);
    if(cell!==null){ownFilth();depositHiveSlime256(stage,cell,fork,runtime,isCorePhysicalSchema297(Number(stage.schemaVersion))?effectiveCore297(stage):core);}
   }
   c.maintenanceCore++;
   if(c.maintenanceCore>=120000&&((((core|0)+groupHashOffset256(s.id))|0)%250)===0){
    if((s.damage??0)+10>=130)kill(original,s,core);else s.damage=(s.damage??0)+10;
   }
  }
 }catch(error){failure=error instanceof Error?error.message:String(error);}
 if(failure)return {status:'blocked',reason:failure};
 for(const s of [...pairs.values(),...createdProps])if(stage.structures.includes(s)){if(hive(s))s.caveHive.lastCore=end;else if(pod(s))s.glowPod.lastCore=end;}
 let done=false;
 return {status:'ready',commit(){
  if(done||frontier.lordIds?.nextId!==baseLord||copiedWildlife&&(w.wildlife!==baseWildlife||JSON.stringify(w.wildlife)!==wildlifeStamp)||w.tick*10!==end||w.structures!==baseStructures||w.piles!==basePiles||w.filth!==baseFilth||w.nextId!==baseNext||frontier.adjacentUses!==baseUse||frontier.adjacentPermutation.some((v,i)=>v!==basePermutation[i])||w.rng!==baseRandom||w.jobs!==baseJobs||w.packed!==basePacked||w.destroyed!==baseDestroyed||originals.some((s,i)=>JSON.stringify(s)!==stamps[i]))return false;
  done=true;
  for(const p of w.pawns)if(p.jobId!==null&&removedJobs.has(p.jobId)){if(hasTravellingCargo(w,p))interruptWork(w,p,true);else if(!releaseWork(w,p,releases))throw Error('Preflighted Hive retirement work changed');}
  if(removedJobs.size){w.jobs=w.jobs.filter(j=>!removedJobs.has(j.id));for(const p of w.pawns)p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!removedJobs.has(o));}
  w.rng=randomState.rng;if(copiedWildlife)w.wildlife=stage.wildlife;if(frontier.lordIds)frontier.lordIds.nextId=lordIds.nextId;
  for(const [original,changed] of pairs){if(hive(original)&&hive(changed))original.caveHive=changed.caveHive;if(pod(original)&&pod(changed))original.glowPod=changed.glowPod;if(changed.damage)original.damage=changed.damage;else delete original.damage;}
  const reverse=new Map([...pairs].map(([a,b])=>[b,a]));w.structures=stage.structures.map(s=>reverse.get(s)??s);
  if(copiedPiles)w.piles=stage.piles;if(copiedFilth)w.filth=stage.filth;if(copiedPacked)w.packed=stage.packed;w.nextId=stage.nextId;if(copiedPiles)refreshStock(w);
  if(removed.length){w.destroyed=stage.destroyed;for(const row of removed)notifyRemovedHiveProp256(w,row.original,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):row.core,false,row.defeat);}
  frontier.adjacentPermutation.splice(0,8,...runtime.adjacentPermutation);frontier.adjacentUses=runtime.adjacentUses;return true;
 }};
}
