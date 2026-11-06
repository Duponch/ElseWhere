import {actualMechanicalBirthFaction259} from './mechanoid-world-faction-259.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Finite Temple750 producers. Existing NPC bodies/AI are provisional by
 * explicit scope; real map owners, sleeping threats and production persist. */
import type {World} from './types.ts';
import type {AncientRect256} from './local-ancient-placement-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import type {HiveAdjacentRuntime256} from './cave-hive-filth-256.ts';
import {hiveReproductionFactor256} from './cave-hive-profile-256.ts';
import {spawnActualHive256} from './cave-hive-spawn-256.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import {captureRandomClosewalk256,tryRandomClosewalkCellNear256} from './random-closewalk-256.ts';
import {terrainIsWater256} from './natural-terrain-runtime-256.ts';
import type {MechanoidKind} from './mechanoid-definition.ts';
import { structuresOfKind } from './structure-navigation.ts';
export interface TempleThreatOwners256 {lordIds:{nextId:number};working:HiveAdjacentRuntime256}
const pool:readonly MechanoidKind[]=['scyther','lancer','pikeman'];
/** CanResolve/Resolve each perform their own real rectangle selection. */
function choose(w:World,rect:AncientRect256,random:WorldGenerationRandom):number|null {
 const physical=captureGeographicGenerationReachability256(w).physical,cells:number[]=[];
 for(let z=Math.max(0,rect.minZ);z<=Math.min(w.height-1,rect.maxZ);z++)for(let x=Math.max(0,rect.minX);x<=Math.min(w.width-1,rect.maxX);x++)if(physical.standable(z*w.width+x))cells.push(z*w.width+x);
 return cells.length?cells[random.integer(0,cells.length)]!:null;
}
export function spawnFunctionalTempleThreat256(w:World,rect:AncientRect256,threat:{kind:'mechs'|'hives';count:number},random:WorldGenerationRandom,owners:TempleThreatOwners256):void {
 if(!isSchema256Or257(w.schemaVersion)||w.site?.revision!==3||w.jobs.length||w.exploration||w.snow||!Number.isInteger(threat.count)||threat.count<1||threat.count>(threat.kind==='mechs'?5:2)||!owners?.lordIds||!Number.isInteger(owners.lordIds.nextId)||owners.lordIds.nextId<0||owners.lordIds.nextId>=2147483646)throw Error('Missing real Temple threat generation owners');
 if(threat.kind==='mechs'){
  if(w.worldFactions?.factions.filter(f=>f.def==='Mechanoid').length!==1)throw Error('Selected Temple mechanical faction is absent');
  const worldFaction259=w.schemaVersion>=259?actualMechanicalBirthFaction259(w.worldFactions):undefined;
  if(w.schemaVersion>=259&&!worldFaction259)throw Error('Selected Temple actual mechanical faction birth is absent');
  const group=owners.lordIds.nextId++;
  for(let i=0;i<threat.count;i++){
   const cell=choose(w,rect,random);if(cell===null)throw Error('Temple mechanical rectangle has no Standable spawn cell');
   if(!Number.isSafeInteger(w.nextId+1))throw Error('Temple mechanical identity frontier exhausted');
   const mechKind=pool[random.integer(0,pool.length)]!;
   (w.mechanoids??=[]).push({id:w.nextId++,mechKind,x:cell%w.width,z:Math.floor(cell/w.width),state:'idle',...worldFaction259?{worldFaction259:{...worldFaction259}}:{},path:[],heading:0,moveCooldown:0,planCooldown:0,temple:{group,madeAtCore:w.tick*10,awakeAtCore:null,goal:null}});
  }return;
 }
 if(w.worldFactions?.factions.filter(f=>f.def==='Insect').length!==1)throw Error('Selected Temple insect faction is absent');
 if(choose(w,rect,random)===null)return;
 const first=choose(w,rect,random);if(first===null)return;
 const context={...owners.working,runtimeWildlifeRng:w.rng,enemyReproductionRateFactor:hiveReproductionFactor256(w),lordIds:owners.lordIds};
 // No retained-Pawn argument is supplied to this non-immediate Hive birth.
 const options={spawnInsectsImmediately:false,canSpawnHives:true,canSpawnInsects:true,dormant:true,aggressive:true,spawnJellyImmediately:false} as const;
 const made=spawnActualHive256(w,first,random,context,options);if(made.status!=='ready')throw Error('Temple Hive spawn refused: '+made.reason);
 for(let i=1;i<threat.count;i++){
  const capture=captureRandomClosewalk256(w),reach=captureGeographicGenerationReachability256(w),cell=tryRandomClosewalkCellNear256(capture,first,5,random,c=>!terrainIsWater256(w.tiles[c]!.terrain)&&reach.canReach(first,c,'closed-dry')&&reach.physical.standable(c));
  if(cell===null||[...structuresOfKind(w,'insect-hive')].length>=30||context.enemyReproductionRateFactor<=0)continue;
  const child=spawnActualHive256(w,cell,random,context,options);if(child.status!=='ready')throw Error('Temple child Hive spawn refused: '+child.reason);
 }
 owners.working.adjacentPermutation.splice(0,8,...context.adjacentPermutation);owners.working.adjacentUses=context.adjacentUses;
}
