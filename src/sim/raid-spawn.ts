import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {bindBornHumanFaction259,bornFactionForDef259} from './world-affiliation-259.ts';
import { civilianAdmissionFits } from './civilian-away.ts';
import { newApparelState } from './apparel-rules.ts';
import { newWeaponState } from './equipment-rules.ts';
import { captureStandability } from './furniture-travel.ts';
import { atMapEdge } from './raid-space.ts';
import { raidRandom,type PirateRaidRole,type RaidComposition,type RaidGroup,type RaidRole } from './raid-state.ts';
import { startingPawn } from './starting-pawns.ts';
import { generatePawnBackground } from './background-generation.ts';
import {validShipReactorRaidSource275} from './ship-reactor-threat-save-275.ts';
import type {ShipReactorRaidSource275} from './ship-reactor-threats-275.ts';
import type { Cell,Pawn,World } from './types.ts';
import {RAID_KINDS_331,RAID_MAKERS_331,isRaidKind331,raidFamilyOfFaction331,type RaidFamily331} from './raid-factions-331.ts';
import type {WeaponItem} from './equipment-rules.ts';

export const RAID_ROLE_OPTIONS:readonly {role:PirateRaidRole;weight:number;weapon:'plasteel-knife'|'revolver'|'bolt-action-rifle'}[]=[
  {role:'drifter',weight:10,weapon:'plasteel-knife'},
  {role:'thrasher',weight:3,weapon:'plasteel-knife'},
  {role:'scavenger',weight:10,weapon:'revolver'},
  {role:'pirate',weight:10,weapon:'bolt-action-rifle'},
];

export interface RaidSpawnOptions {
  count:number;
  sites:readonly Cell[];
  random:{rng:number};
  composition?:RaidComposition;
  preserveCalendarRng?:boolean;
  shipReactor275?:ShipReactorRaidSource275;
  /** Schema 331 Cassandra home raid: the drawn hostile world faction. */
  faction331?:{factionId:number;family:RaidFamily331};
}
/** Pirate roles keep their historical weapons; schema 331 kinds carry theirs. */
export function raidRoleWeapon(role:RaidRole):WeaponItem|undefined {
  return isRaidKind331(role)?RAID_KINDS_331[role].weapon:RAID_ROLE_OPTIONS.find(option=>option.role===role)?.weapon;
}
/** A roster role admitted by this composition: the pirate projection, or
 * (schema 331) the options of its tribal or outlander group maker. */
export function rosterRoleFits(composition:RaidComposition,role:unknown):boolean {
  return composition.group331===undefined?RAID_ROLE_OPTIONS.some(option=>option.role===role):RAID_MAKERS_331[composition.group331].options.some(option=>option.kind===role);
}

/** The caller has already selected real entry cells. Prepare every person and
 * possession locally; no world, calendar or RNG change precedes admission. */
export function createRaidGroup(w:World,options:RaidSpawnOptions):RaidGroup|null {
  const s=w.raids,{count,sites,composition}=options;
  const scout=w.scout?.phase==='travelling'||w.scout?.phase==='awaiting-entry'?w.scout:w.commercialTrip&&'pawn' in w.commercialTrip?w.commercialTrip:undefined;
  const independent=options.shipReactor275!==undefined;
  if(independent&&!validShipReactorRaidSource275(options.shipReactor275,w,w.tick,'human'))return null;
  if(!s||!independent&&(!!s.active||!!s.mechActive)||!Number.isSafeInteger(count)||count<1||sites.length!==count
    ||s.serial>=Number.MAX_SAFE_INTEGER||w.nextId>Number.MAX_SAFE_INTEGER-count*3
    ||!civilianAdmissionFits(w,count,count*2)
    ||s.departed.length+count>w.width*w.height||!w.foodPolicies[0]
    ||!Number.isSafeInteger(options.random.rng)||options.random.rng<0||options.random.rng>0xffffffff
    ||composition&&(composition.roster.length!==count||composition.roster.some(role=>!rosterRoleFits(composition,role))))return null;
  // Schema 331: only a Cassandra home raid names its faction; a tribal or
  // outlander roster needs that faction, a pirate roster a pirate one.
  const chosen=options.faction331;
  if(chosen&&(independent||w.schemaVersion<331||s.profile!=='cassandra-raids-v1'||raidFamilyOfFaction331(w,chosen.factionId)!==chosen.family)
    ||composition&&(composition.group331===undefined?!!chosen&&chosen.family!=='pirate':!chosen||RAID_MAKERS_331[composition.group331].family!==chosen.family))return null;
  const stands=captureStandability(w),occupied=new Set(w.pawns.flatMap(p=>[p.z*w.width+p.x,...p.motion&&p.motion.end>w.tick?[p.motion.from.z*w.width+p.motion.from.x]:[]]));
  if(independent||isSchema275OrLater(w.schemaVersion)&&s.extraMechActive261?.some(g=>!!g.shipReactor275))for(const actor of [...w.mechanoids??[],...w.wildlife?.animals??[]]){occupied.add(actor.z*w.width+actor.x);if(actor.motion&&actor.motion.end>w.tick)occupied.add(actor.motion.from.z*w.width+actor.motion.from.x);}
  const used=new Set<number>();
  for(const cell of sites){const key=cell.z*w.width+cell.x;
    if(!Number.isSafeInteger(cell.x)||!Number.isSafeInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=w.width||cell.z>=w.height
      ||!atMapEdge(w,cell)||!stands(cell)||occupied.has(key)||used.has(key))return null;
    used.add(key);
  }
  const id=s.serial+1,generated:Pawn[]=[],piles:World['piles']=[];let next=w.nextId;
  for(let i=0;i<count;i++){
    const factionId=(Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions?chosen?.factionId??bornFactionForDef259(w,'Pirate'):undefined;if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions&&factionId===undefined)return null;
    const p=startingPawn(next++,`Assaillant ${id}.${i+1}`,sites[i]!.x,sites[i]!.z,0,55,w.seed,w.tick,w.schemaVersion);p.faction='outlaws';if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions&&!bindBornHumanFaction259(w,p,factionId!))return null;p.raid={group:id,exiting:false,goal:null};p.skills.shooting.level=4;p.skills.melee.level=4;p.foodPolicyId=w.foodPolicies[0]!.id;
    if(w.schemaVersion>=191)generatePawnBackground(p,w.seed,true);
    // Schema 331: tribal raiders wear tribal wear (Core Neolithic apparel tag).
    const apparel=chosen?.family==='tribe'?'cloth-tribalwear':'cloth-shirt';
    generated.push(p);piles.push({id:next++,kind:'apparel',item:apparel,quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState(apparel,undefined,w.schemaVersion)});
    const weapon=composition?raidRoleWeapon(composition.roster[i]!):id>1&&i===0?'revolver':undefined;
    if(weapon)piles.push({id:next++,kind:'weapon',item:weapon,quantity:1,owner:{type:'equipment',pawnId:p.id},weapon:newWeaponState(weapon)});
  }
  const random={rng:options.random.rng};
  const deadline=w.tick+2600+Math.floor(raidRandom(random)*1201),lossPermille=400+Math.floor(raidRandom(random)*301);
  const group:RaidGroup={id,startedAt:w.tick,deadline,lossPermille,members:generated.map(p=>p.id),lost:[],phase:'assault'};
  // Core ResolveRaidStrategy (schema 330): ImmediateAttack 1, ImmediateAttackSmart
  // (0,0)-(1000,0.5) on points, StageThenAttack 1; siege, sappers and breach are
  // absent and leave the draw. Staging lasts Core 5000-15000 ticks; the give-up
  // timer then starts with the assault.
  if(!independent&&w.schemaVersion>=330&&s.profile==='cassandra-raids-v1'){
    const smart=Math.min(.5,Math.max(0,(composition?.budget??0)/2000));
    if(raidRandom(random)*(2+smart)<1){
      const delayCore=5000+Math.floor(raidRandom(random)*10001);
      group.stage330={point:{x:sites[0]!.x,z:sites[0]!.z},untilCore:w.tick*10+delayCore};
      group.deadline=deadline+Math.ceil(delayCore/10);
    }
  }
  if(composition)group.composition=composition;
  if(independent)group.shipReactor275={...options.shipReactor275!};
  w.nextId=next;w.pawns.push(...generated);w.piles.push(...piles);if(!options.preserveCalendarRng&&!independent)s.rng=random.rng;options.random.rng=random.rng;s.serial=id;
  if(independent){s.extraActive261??=[];s.extraResults261??=s.last?[structuredClone(s.last)]:[];s.extraActive261.push(group);}else{s.nextCheck=null;s.active=group;}
  const label=chosen?` (${w.worldFactions!.factions.find(f=>f.id===chosen.factionId)!.name})`:'';
  w.events.push({tick:w.tick,type:'command',message:group.stage330?`Raid${label} : ${count} assaillant(s) arrive(nt) au bord de la carte et se regroupe(nt) avant d’attaquer. Préparez la défense.`:`Raid${label} : ${count} assaillant(s) arrive(nt) au bord de la carte et attaque(nt) immédiatement. Mobilisez la défense.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);
  return group;
}
