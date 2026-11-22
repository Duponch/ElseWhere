import {giveBornTraits361} from './trait-generation-361.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {chooseRaidComposition} from './raids.ts';
import {RAID_ROLE_OPTIONS} from './raid-spawn.ts';
import {groupProfiles} from './visitors.ts';
import {visitorPoints} from './visitor-state.ts';
import {startingPawn} from './starting-pawns.ts';
import {generateBornBackground} from './background-generation.ts';
import {generateVisitorStock} from './trade-stock.ts';
import {newApparelState} from './apparel-rules.ts';
import {newWeaponState} from './equipment-rules.ts';
import {freshRot} from './food-preservation.ts';
import {bindBornHumanFaction259} from './world-affiliation-259.ts';
import {healthRandom} from './health.ts';
import {draftCaravanMeetingRoster338} from './caravan-meeting-roster-338.ts';
import type {Pawn,MaterialPile,World} from './types.ts';

export interface ForeignRoster261 {people:Pawn[];items:MaterialPile[];nextId:number;rng:number;composition?:import('./raid-state.ts').RaidComposition;meeting?:{traderId:number;guardIds:number[];caravanKind338?:import('./trader-caravans-332.ts').CaravanTraderKind332}}
/** Only current Elsewhere human constructors/content are used. Off-map originals
 * have no fake spawn/Lord/calendar/visitor membership. Their later physical map
 * entry installs the real controller once. No new biology, names or equipment
 * distribution is claimed as native parity. Preparing never writes the source. */
export function draftForeignRoster261(w:World,kind:'combat'|'trader',factionId:number,points:number,initialRng:number):ForeignRoster261|null {
 if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||!w.worldFactions||!w.worldFactions.factions.some(f=>f.id===factionId&&f.id!==w.worldFactions!.playerFactionId)||!w.foodPolicies[0]||!Number.isSafeInteger(initialRng)||initialRng<1||initialRng>0xffffffff)return null;
 const random={rng:initialRng};
 // Schema 338: the met caravan is a Core Trader group of the faction's caravan trader kinds.
 if(kind==='trader'&&Number(w.schemaVersion)>=338)return draftCaravanMeetingRoster338(w,factionId,random);
 const composition=kind==='combat'?Number.isFinite(points)&&points>=35&&points<=10000?chooseRaidComposition(points,random):undefined:undefined;
 if(kind==='combat'&&!composition?.roster.length)return null;
 const profiles=kind==='combat'?composition!.roster.map(role=>({label:'Assaillant',guard:true,weapon:RAID_ROLE_OPTIONS.find(r=>r.role===role)!.weapon}))
  :groupProfiles(random,visitorPoints(random,'visitor')).map((label,i)=>({label,guard:label==='Garde',weapon:undefined,...i===0?{trader:true}:{}}));
 if(!profiles.length||profiles.length>256||!Number.isSafeInteger(w.nextId+profiles.length*3))return null;
 const people:Pawn[]=[],items:MaterialPile[]=[];let nextId=w.nextId;
 for(let i=0;i<profiles.length;i++){
  const role=profiles[i]!,trader=kind==='trader'&&i===0;
  const p=startingPawn(nextId++,`${role.label} ${w.nextId}.${i+1}`,0,0,0,55,w.seed,w.tick,w.schemaVersion);
  p.faction=kind==='combat'?'outlaws':'outlanders';
  if(!bindBornHumanFaction259(w,p,factionId))return null;
  p.foodPolicyId=w.foodPolicies[0]!.id;
  if(kind==='combat'){p.skills.shooting.level=4;p.skills.melee.level=4;}
  else {delete p.apparelPolicyId;delete p.apparelAutomation;delete p.nextApparelCheckAt;for(const value of Object.values(p.skills))if(typeof value==='object'){value.level=0;value.passion=0;}for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;}
  generateBornBackground(w,p,w.seed,role.guard,trader,{violent:kind==='combat'||!trader});giveBornTraits361(w,p,p.faction==='outlaws');
  people.push(p);items.push({id:nextId++,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState('cloth-shirt',undefined,w.schemaVersion)});
  if(role.weapon)items.push({id:nextId++,kind:'weapon',item:role.weapon,quantity:1,owner:{type:'equipment',pawnId:p.id},weapon:newWeaponState(role.weapon)});
  if(trader){const stock=generateVisitorStock(random.rng,p.id,nextId,w.tick,w.schemaVersion);items.push(...stock.piles);nextId=stock.nextId;random.rng=stock.rng;}
  if(kind==='trader'){
   const foodDraw=healthRandom(random),item=foodDraw<.75?'simple-meal':'survival-meal',quantity=healthRandom(random)<5/6?3:2;
   items.push({id:nextId++,kind:'food',item,quantity,owner:{type:'inventory',pawnId:p.id},...freshRot(item,w.tick)});
  }
 }
 if(!Number.isSafeInteger(nextId))return null;
 return {people,items,nextId,rng:random.rng,...composition?{composition}:{},...kind==='trader'?{meeting:{traderId:people[0]!.id,guardIds:people.filter((_p,i)=>i!==0&&profiles[i]!.guard).map(p=>p.id)}}:{}};
}
