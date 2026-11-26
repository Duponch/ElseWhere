import {appendStructureEntries} from './structure-navigation.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {captureHiveClosewalk256} from './cave-hive-closewalk-256.ts';
import {planTempleHiveItemsAside256} from './temple-hive-items-256.ts';
import {findActualHiveLord256} from './cave-hive-lord-search-256.ts';
import {hiveNextReproductionCore256,hiveNextPawnCore256} from './cave-hive-clocks-256.ts';
/** Original HiveUtility/CompSpawnerPawn join, including enabled Temple births. The caller owns
 * an UNPUBLISHED actual map. Failure invalidates that whole candidate, never
 * publishes the newly allocated hive or a prefix of its occupants. */
import type {World,Structure} from './types.ts';
import {MAX_WILDLIFE,type WildAnimal} from './wildlife-state.ts';
import {duckPhysicalOwnerCount256} from './duck-flyer-runtime-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import {captureRandomClosewalk256,tryRandomClosewalkCellNear256,randomClosewalkCellNear256} from './random-closewalk-256.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import {RoomTopologyCache} from './room-topology.ts';
import {CAVE_INSECT_DATA_256} from './cave-insect-data-256.ts';
import type {CaveInsectSpecies256} from './cave-insect-constructor-256.ts';
import {createFunctionalHiveInsect256} from './temple-hive-production-256.ts';
import {depositHiveSlime256,type HiveAdjacentRuntime256} from './cave-hive-filth-256.ts';
import type {ActualHive256,HiveLord256,ActualGlowPod256} from './cave-hive-state-256.ts';
import {terrainIsWater256} from './natural-terrain-runtime-256.ts';
const kinds=['megascarab','spelopede','megaspider'] as const,f=Math.fround;
export interface HiveSpawnContext256 extends HiveAdjacentRuntime256 {readonly unspawnedAnimals?:readonly WildAnimal[];readonly atCore?:number;readonly runtimeWildlifeRng:number;readonly enemyReproductionRateFactor:number;readonly lordIds:{nextId:number}}
export interface HiveSpawnOptions256 {spawnInsectsImmediately:boolean;canSpawnHives:boolean;canSpawnInsects:boolean;runtime?:true;extras?:false;dormant:boolean;aggressive:boolean;spawnJellyImmediately:false}
export const CAVE_HIVE_INITIAL_OPTIONS_256=Object.freeze({spawnInsectsImmediately:true,canSpawnHives:false,canSpawnInsects:false,dormant:false,aggressive:false,spawnJellyImmediately:false} as const);
type Spawn256={status:'ready';hive:ActualHive256}|{status:'blocked';reason:string};
const allocate=(w:World)=>{if(!Number.isSafeInteger(w.nextId)||w.nextId<1||!Number.isSafeInteger(w.nextId+1))throw Error('Exhausted actual Hive identity allocator');return w.nextId++;};
function kind(points:number,random:Pick<WorldGenerationRandom,'integer'|'float'|'value'>):CaveInsectSpecies256|null {const available=kinds.filter(k=>f(points+CAVE_INSECT_DATA_256[k].kind.combatPower)<=500);return available.length?available[random.integer(0,available.length)]!:null;}
function roomHiveCount(w:World,cell:number):number {const topology=new RoomTopologyCache().read(w),room=topology.at(cell%w.width,Math.floor(cell/w.width));let count=0;for(const h of w.structures)if(h.kind==='insect-hive'&&(h.x-cell%w.width)**2+(h.z-Math.floor(cell/w.width))**2<=81&&topology.at(h.x,h.z)===room)count++;return count;}
function nextPawnTick(w:World,count:number,random:Pick<WorldGenerationRandom,'integer'|'float'|'value'>,enemy:number):number {return hiveNextPawnCore256(w.tick*10,count,enemy,random);}
/** Core's square20 attempts then shuffled X/Z fallback; default maxTries.
 * No dependence on view, wall time, a second PRNG or a map-shaped proxy. */
function chooseDefendSpot(w:World,source:ActualHive256,random:Pick<WorldGenerationRandom,'integer'|'float'|'value'>):number|null {const physical=captureGeographicGenerationReachability256(w),lowX=Math.max(0,source.x-5),highX=Math.min(w.width,source.x+5),lowZ=Math.max(0,source.z-5),highZ=Math.min(w.height,source.z+5),root=source.z*w.width+source.x;
 const valid=(x:number,z:number)=>x>=0&&x<w.width&&z>=0&&z<w.height&&physical.physical.standable(z*w.width+x)&&physical.canReach(z*w.width+x,root,'destroy');
 for(let attempt=0;attempt<20;attempt++){const x=random.integer(lowX,highX+1),z=random.integer(lowZ,highZ+1);if(valid(x,z))return z*w.width+x;}
 const xs=Array.from({length:highX-lowX+1},(_,i)=>lowX+i),zs=Array.from({length:highZ-lowZ+1},(_,i)=>lowZ+i);
 for(const a of [xs,zs])for(let i=a.length-1;i>0;i--){const at=random.integer(0,i+1);[a[i],a[at]]=[a[at]!,a[i]!];}
 for(const x of xs)for(const z of zs)if(valid(x,z))return z*w.width+x;return null;
}
export function spawnActualHive256(w:World,cell:number,random:Pick<WorldGenerationRandom,'integer'|'float'|'value'>,context:HiveSpawnContext256,options:HiveSpawnOptions256=CAVE_HIVE_INITIAL_OPTIONS_256):Spawn256 {
 if(!isSchema256Or257(w.schemaVersion)||w.site?.revision!==3||w.planet?.revision!==3||!options.runtime&&(w.jobs.length||w.exploration||w.snow)||!Number.isSafeInteger(cell)||cell<0||cell>=w.width*w.height||!Number.isSafeInteger(context.runtimeWildlifeRng)||context.runtimeWildlifeRng<1||context.runtimeWildlifeRng>4294967295||!Number.isFinite(context.enemyReproductionRateFactor)||context.enemyReproductionRateFactor<0||!context.lordIds||!Number.isInteger(context.lordIds.nextId)||context.lordIds.nextId<0||context.lordIds.nextId>=2147483646||typeof options.canSpawnHives!=='boolean'||typeof options.canSpawnInsects!=='boolean'||options.spawnJellyImmediately!==false||typeof options.spawnInsectsImmediately!=='boolean'||typeof options.dormant!=='boolean'||typeof options.aggressive!=='boolean')throw Error('Missing actual unpublished Hive creation frontier');
 const madeAtCore=context.atCore??w.tick*10;
 if(!Number.isSafeInteger(madeAtCore)||madeAtCore<Math.max(0,(w.tick-1)*10)||madeAtCore>w.tick*10||options.runtime&&!options.canSpawnHives||options.canSpawnHives!==options.canSpawnInsects)throw Error('Invalid actual enabled Hive birth frontier');
 if(options.canSpawnHives?options.spawnInsectsImmediately:options.dormant||!options.spawnInsectsImmediately||options.runtime)throw Error('Hive spawn lane is neither existing1120 nor enabled Temple');
 const faction=w.worldFactions?.factions.filter(f=>f.def==='Insect');if(!faction||faction.length!==1)return {status:'blocked',reason:'Actual unique Insect faction is absent'};
 const x=cell%w.width,z=Math.floor(cell/w.width),before=options.runtime?captureHiveClosewalk256(w).reach:captureGeographicGenerationReachability256(w);
 if(!before.physical.standable(cell)||before.physical.edifice(cell)||!options.canSpawnHives&&(w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z)||w.packed.some(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z)||w.pawns.some(p=>p.x===x&&p.z===z)||w.wildlife?.animals.some(a=>a.x===x&&a.z===z)))return {status:'blocked',reason:'Actual selected Hive cell is no longer admitted/Standable'};
 const aside=options.canSpawnHives?planTempleHiveItemsAside256(w,cell):undefined;if(aside===null)return {status:'blocked',reason:'Selected Temple Hive cannot preserve every displaced ground original'};
 if(aside&&!aside.commit())throw Error('Stale Temple Hive ground-owner placement');
 w.wildlife??={profile:'geographic-fauna-v3',rng:context.runtimeWildlifeRng,animals:[],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 w.wildlife.hiveLords??=[];
 const hiveId=allocate(w),chosenKind=kind(0,random),hive:ActualHive256={id:hiveId,kind:'insect-hive',x,z,orientation:0,footprint:'standard',factionId:faction[0]!.id,caveHive:{revision:1,madeAtCore,awakeAtCore:options.dormant&&!options.spawnInsectsImmediately?null:madeAtCore,...options.canSpawnHives?{temple:true as const}:{},chosenKind,spawnedPawnIds:[],canSpawnPawns:options.canSpawnInsects,nextPawnSpawnCore:-1,canSpawnHives:options.canSpawnHives,nextHiveSpawnCore:-1,wasActivated:false,jellyLeftCore:0,podLeftCore:0,healCore:0,maintenanceCore:0}};
 // MakeThing allocates before Initialize(chosenKind); allocator and RNG are
 // independent but retain this explicit original identity at the one spawn.
 appendStructureEntries(w,hive);
 const c=hive.caveHive;
 c.nextHiveSpawnCore=hiveNextReproductionCore256(madeAtCore,roomHiveCount(w,cell),context.enemyReproductionRateFactor,random);
 c.jellyLeftCore=random.integer(26000,30001);c.podLeftCore=random.integer(30000,60001);
 let closewalk=captureRandomClosewalk256(w,options.runtime?captureHiveClosewalk256(w).reach:undefined);
 for(let deposit=0;deposit<10;deposit++){const near=tryRandomClosewalkCellNear256(closewalk,cell,5,random);if(near!==null)depositHiveSlime256(w,near,random,context,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):madeAtCore);}
 if(options.spawnInsectsImmediately){
  const target=random.float(200,500);let points=0;
  for(let attempts=0;points<target&&attempts<1000;attempts++){
   c.chosenKind=kind(points,random);if(c.chosenKind===null)break;
   if(duckPhysicalOwnerCount256(w)>=MAX_WILDLIFE)return {status:'blocked',reason:'Actual wildlife capacity cannot admit the complete selected insect cohort'};
   const animal=createFunctionalHiveInsect256({species:c.chosenKind,id:allocate(w),cell:{x,z},tick:w.tick,random}),position=randomClosewalkCellNear256(closewalk,cell,2,random);animal.x=position%w.width;animal.z=Math.floor(position/w.width);animal.arrivalRotation=0;
   w.wildlife.animals.push(animal);c.spawnedPawnIds.push(animal.id);
   let lord=findActualHiveLord256(w,hive);if(!lord){chooseDefendSpot(w,hive,random);lord={id:context.lordIds.nextId++,factionId:hive.factionId,aggressive:options.aggressive,phase:'defend-expand',lastHarmCore:w.tick*10,memberIds:[],assignedHives:[]};w.wildlife.hiveLords.push(lord);}
   animal.hive={factionId:hive.factionId,lordId:lord.id,spawnerId:hive.id};lord.memberIds.push(animal.id);
   // GenClosest chooses an actual same-faction reachable Hive, not an
   // invented association with whichever spawner happened to create us.
   const reachable=captureGeographicGenerationReachability256(w),focus=w.structures.filter((s):s is ActualHive256=>s.kind==='insect-hive'&&s.factionId===hive.factionId&&(s.x-animal.x)**2+(s.z-animal.z)**2<=900).sort((a,b)=>(a.x-animal.x)**2+(a.z-animal.z)**2-((b.x-animal.x)**2+(b.z-animal.z)**2)).find(s=>reachable.canReach(animal.z*w.width+animal.x,s.z*w.width+s.x,'closed'));
   if(focus)lord.assignedHives.push({pawnId:animal.id,hiveId:focus.id});
   points=f(points+CAVE_INSECT_DATA_256[c.chosenKind].kind.combatPower);
  }
  c.nextPawnSpawnCore=nextPawnTick(w,c.spawnedPawnIds.length,random,context.enemyReproductionRateFactor);
 }
 // HiveUtility wakes immediate occupants even if a caller also requested
 // dormant. The1120 contract is awake; Temple components retain their true dormancy.
 if(options.extras===false)return {status:'ready',hive};
 const extras=random.integer(0,3);
 for(let pod=0;pod<extras;pod++){
  closewalk=captureRandomClosewalk256(w,options.runtime?captureHiveClosewalk256(w).reach:undefined);const reach=captureGeographicGenerationReachability256(w);
  const near=tryRandomClosewalkCellNear256(closewalk,cell,5,random,i=>!terrainIsWater256(w.tiles[i]!.terrain)&&reach.canReach(cell,i,'closed-dry')&&!reach.physical.edifice(i));
  if(near===null)continue;
  const glow:ActualGlowPod256={id:allocate(w),kind:'glow-pod',x:near%w.width,z:Math.floor(near/w.width),orientation:0,footprint:'standard',factionId:hive.factionId,glowPod:{revision:1,madeAtCore,ageCore:-1}};appendStructureEntries(w,glow);
 }
 return {status:'ready',hive};
}
