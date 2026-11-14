import {mechFactionCommonality} from './mechanoid-raid-composition.ts';
import {raidRandom,type RaidComposition} from './raid-state.ts';
import type {WorldFactionDef256} from './world-faction-catalog.ts';
import type {ApparelItem} from './apparel-definitions.ts';
import type {WeaponItem} from './equipment-rules.ts';
import {TICKS_PER_DAY,type World} from './types.ts';

/** Schema 331: Cassandra's home raids come from every hostile world faction.
 * Facts read from Core 1.6 Factions_Misc.xml, Factions_Hidden.xml,
 * PawnKinds_Tribal/Outlander/Mercenary.xml and the decompiled
 * PawnGroupMakerUtility / IncidentWorker_RaidEnemy (not copied). */
export type RaidFamily331='pirate'|'tribe'|'outlander';
export const RAID_FAMILY_BY_DEF_331:Readonly<Partial<Record<WorldFactionDef256,RaidFamily331|'mechanoid'>>>=Object.freeze({
  Pirate:'pirate',TribeCivil:'tribe',TribeRough:'tribe',TribeSavage:'tribe',OutlanderCivil:'outlander',OutlanderRough:'outlander',Mechanoid:'mechanoid',
});
/** Core MinPointsToGeneratePawnGroup(Combat): the cheapest fighter of the
 * faction's combat group makers (Drifter 35, Tribal_Penitent 40, Town_Guard 60). */
export const RAID_FAMILY_MIN_POINTS_331:Readonly<Record<RaidFamily331,number>>=Object.freeze({pirate:35,tribe:40,outlander:60});

export type RaidKind331='tribal-penitent'|'tribal-warrior'|'tribal-archer'|'tribal-hunter'|'tribal-heavy-archer'|'tribal-berserker'|'tribal-chief-ranged'|'tribal-chief-melee'
  |'villager'|'town-guard'|'mercenary-gunner'|'town-councilman';
export interface RaidKindDefinition331 {core:string;cost:number;weapon:WeaponItem;apparel:ApparelItem;leader:boolean}
/** Core combatPower costs. Weapons are the Elsewhere item matching the
 * kind's Core weapon tags; three are explicit adaptations (see the note):
 * the penitent's club is a wooden mace, the warrior's ikwa a steel mace
 * (same "decent" tier), the gunners' Gun tag a fixed revolver, rifle or
 * shotgun. Tribal kinds wear tribal wear, outlanders a shirt. */
export const RAID_KINDS_331:Readonly<Record<RaidKind331,RaidKindDefinition331>>=Object.freeze({
  'tribal-penitent':{core:'Tribal_Penitent',cost:40,weapon:'wood-mace',apparel:'cloth-tribalwear',leader:false},
  'tribal-warrior':{core:'Tribal_Warrior',cost:50,weapon:'steel-mace',apparel:'cloth-tribalwear',leader:false},
  'tribal-archer':{core:'Tribal_Archer',cost:45,weapon:'short-bow',apparel:'cloth-tribalwear',leader:false},
  'tribal-hunter':{core:'Tribal_Hunter',cost:60,weapon:'recurve-bow',apparel:'cloth-tribalwear',leader:false},
  'tribal-heavy-archer':{core:'Tribal_HeavyArcher',cost:75,weapon:'greatbow',apparel:'cloth-tribalwear',leader:false},
  'tribal-berserker':{core:'Tribal_Berserker',cost:65,weapon:'steel-spear',apparel:'cloth-tribalwear',leader:false},
  'tribal-chief-ranged':{core:'Tribal_ChiefRanged',cost:85,weapon:'greatbow',apparel:'cloth-tribalwear',leader:true},
  'tribal-chief-melee':{core:'Tribal_ChiefMelee',cost:85,weapon:'steel-longsword',apparel:'cloth-tribalwear',leader:true},
  'villager':{core:'Villager',cost:45,weapon:'revolver',apparel:'cloth-shirt',leader:false},
  'town-guard':{core:'Town_Guard',cost:60,weapon:'bolt-action-rifle',apparel:'cloth-shirt',leader:false},
  'mercenary-gunner':{core:'Mercenary_Gunner',cost:85,weapon:'pump-shotgun',apparel:'cloth-shirt',leader:false},
  'town-councilman':{core:'Town_Councilman',cost:40,weapon:'revolver',apparel:'cloth-shirt',leader:true},
});
export const isRaidKind331=(v:unknown):v is RaidKind331=>typeof v==='string'&&Object.hasOwn(RAID_KINDS_331,v);

export type RaidMaker331='tribe-mixed'|'tribe-ranged'|'tribe-melee'|'outlander';
export interface RaidMakerDefinition331 {family:Exclude<RaidFamily331,'pirate'>;commonality:number;options:readonly {kind:RaidKind331;weight:number}[]}
/** Core Combat pawnGroupMakers with their commonality and option weights.
 * Left out: the tribal breach maker (breach axes), outlander grenadiers,
 * slashers (shield belt) and elites (advanced guns) Elsewhere does not have. */
export const RAID_MAKERS_331:Readonly<Record<RaidMaker331,RaidMakerDefinition331>>=Object.freeze({
  'tribe-mixed':{family:'tribe',commonality:100,options:[{kind:'tribal-penitent',weight:5},{kind:'tribal-warrior',weight:5},{kind:'tribal-archer',weight:10},{kind:'tribal-hunter',weight:10},
    {kind:'tribal-heavy-archer',weight:10},{kind:'tribal-berserker',weight:5},{kind:'tribal-chief-ranged',weight:3},{kind:'tribal-chief-melee',weight:1.5}]},
  'tribe-ranged':{family:'tribe',commonality:60,options:[{kind:'tribal-archer',weight:10},{kind:'tribal-hunter',weight:10},{kind:'tribal-heavy-archer',weight:10},{kind:'tribal-chief-ranged',weight:5}]},
  'tribe-melee':{family:'tribe',commonality:60,options:[{kind:'tribal-penitent',weight:10},{kind:'tribal-warrior',weight:10},{kind:'tribal-berserker',weight:10},{kind:'tribal-chief-melee',weight:5}]},
  'outlander':{family:'outlander',commonality:100,options:[{kind:'villager',weight:5},{kind:'town-guard',weight:10},{kind:'mercenary-gunner',weight:10},{kind:'town-councilman',weight:10}]},
});
export const isRaidMaker331=(v:unknown):v is RaidMaker331=>typeof v==='string'&&Object.hasOwn(RAID_MAKERS_331,v);

/** Core maxPawnCostPerTotalPointsCurve, floored at 1.2 times the faction's
 * minimum combat points (PawnGroupMakerUtility.MaxPawnCost). */
const MAX_PAWN_COST_331:Readonly<Record<Exclude<RaidFamily331,'pirate'>,readonly (readonly [number,number])[]>>=Object.freeze({
  tribe:[[0,35],[70,50],[800,100],[1300,150],[100000,10000]],
  outlander:[[0,35],[70,50],[700,100],[1300,150],[100000,10000]],
});
export function raidMaxPawnCost331(family:Exclude<RaidFamily331,'pirate'>,points:number):number {
  const curve=MAX_PAWN_COST_331[family];let value=curve.at(-1)![1];
  for(let i=1;i<curve.length;i++){
    const [x,y]=curve[i]!;
    if(points<=x){const [priorX,priorY]=curve[i-1]!;value=priorY+(y-priorY)*(points-priorX)/(x-priorX);break;}
  }
  return Math.max(RAID_FAMILY_MIN_POINTS_331[family]*1.2,value);
}
/** Cheapest option the spending loop could still take; the loop stops below it. */
export function cheapestRaidOption331(maker:RaidMaker331,leaderChosen:boolean,maxCost:number):number {
  return Math.min(...RAID_MAKERS_331[maker].options.map(o=>RAID_KINDS_331[o.kind]).filter(k=>k.cost<=maxCost&&!(leaderChosen&&k.leader)).map(k=>k.cost));
}
/** Core GeneratePawns for one faction: draw a combat group maker able to
 * generate something, then spend the points (ChoosePawnGenOptionsByPoints:
 * cost within the points left and the maximum pawn cost, one faction
 * leader kind at most). The cost-fraction weight curve is not applied: it
 * stays at 0.91 or more for the kept kinds (costs 40 to 85). */
export function chooseRaidComposition331(budget:number,family:Exclude<RaidFamily331,'pirate'>,random:{rng:number}):RaidComposition {
  if(!Number.isFinite(budget)||budget<RAID_FAMILY_MIN_POINTS_331[family]||budget>10000)throw new RangeError('Invalid raid budget.');
  const makers=(Object.keys(RAID_MAKERS_331) as RaidMaker331[]).filter(m=>RAID_MAKERS_331[m].family===family&&RAID_MAKERS_331[m].options.some(o=>RAID_KINDS_331[o.kind].cost<=budget));
  let maker=makers.at(-1)!;
  if(makers.length>1){
    const total=makers.reduce((sum,m)=>sum+RAID_MAKERS_331[m].commonality,0);let draw=raidRandom(random)*total;
    for(const m of makers){draw-=RAID_MAKERS_331[m].commonality;if(draw<0){maker=m;break;}}
  }
  const roster:RaidKind331[]=[],maxCost=raidMaxPawnCost331(family,budget);let remaining=budget,leader=false;
  for(;;){
    const eligible=RAID_MAKERS_331[maker].options.filter(o=>{const k=RAID_KINDS_331[o.kind];return k.cost<=remaining&&k.cost<=maxCost&&!(leader&&k.leader);});
    if(!eligible.length)break;
    const total=eligible.reduce((sum,o)=>sum+o.weight,0);let draw=raidRandom(random)*total,selected=eligible.at(-1)!;
    for(const o of eligible){draw-=o.weight;if(draw<0){selected=o;break;}}
    roster.push(selected.kind);remaining-=RAID_KINDS_331[selected.kind].cost;if(RAID_KINDS_331[selected.kind].leader)leader=true;
  }
  return {budget,roster,group331:maker};
}

export interface RaidFactionChoice331 {factionId:number;family:RaidFamily331|'mechanoid';weight:number}
/** Core TryGetRandomFactionForCombatPawnGroupWeighted with RaidEnemy's
 * FactionCanBeGroupSource: every non-player faction hostile to the player,
 * not defeated nor temporary, able to field a combat group with these points,
 * weighs its RaidCommonalityFromPoints (1 for people, the mechanoid curve
 * otherwise), times 0.4 for the faction of the previous raid. Mechanoids
 * also need the colony's prospective mechanical policy and 45 days, except
 * in Core's desperate second pass. */
export function raidFactionCandidates331(w:World,points:number,desperate:boolean):RaidFactionChoice331[] {
  const registry=w.worldFactions,s=w.raids;if(!registry||!s||!Number.isFinite(points))return [];
  const player=registry.playerFactionId,choices:RaidFactionChoice331[]=[];
  for(const f of registry.factions){
    const family=RAID_FAMILY_BY_DEF_331[f.def];
    if(!family||f.id===player||f.lifecycle259?.defeated||f.lifecycle259?.temporary)continue;
    const relation=registry.relations.find(r=>r.aId===Math.min(f.id,player)&&r.bId===Math.max(f.id,player));
    if(relation?.kind!=='hostile')continue;
    let weight:number;
    if(family==='mechanoid'){
      if(!s.mechanoid||!desperate&&w.tick<45*TICKS_PER_DAY)continue;
      weight=mechFactionCommonality(points);
    }else{if(points<RAID_FAMILY_MIN_POINTS_331[family])continue;weight=1;}
    if(f.id===s.lastFaction331)weight*=.4;
    if(weight>0)choices.push({factionId:f.id,family,weight});
  }
  return choices;
}
export function drawRaidFaction331(w:World,points:number,draw:()=>number):RaidFactionChoice331|null {
  let choices=raidFactionCandidates331(w,points,false);
  if(!choices.length)choices=raidFactionCandidates331(w,points,true);
  if(!choices.length)return null;
  let pick=draw()*choices.reduce((sum,c)=>sum+c.weight,0);
  for(const c of choices){pick-=c.weight;if(pick<0)return c;}
  return choices.at(-1)!;
}
/** The Elsewhere family of a world faction instance, if it can raid. */
export function raidFamilyOfFaction331(w:Pick<World,'worldFactions'>,factionId:number):RaidFamily331|'mechanoid'|undefined {
  const def=w.worldFactions?.factions.find(f=>f.id===factionId)?.def;return def?RAID_FAMILY_BY_DEF_331[def]:undefined;
}
