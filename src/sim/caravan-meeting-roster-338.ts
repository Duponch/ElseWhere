import {giveBornTraits361} from './trait-generation-361.ts';
import {startingPawn} from './starting-pawns.ts';
import {isBlowbackSchema340,isGunKind340} from './blowback-340.ts';
import {gunKindWeapon342} from './guns-342.ts';
import {generateBornBackground} from './background-generation.ts';
import {newApparelState} from './apparel-rules.ts';
import {newWeaponState} from './equipment-rules.ts';
import {freshRot} from './food-preservation.ts';
import {bindBornHumanFaction259} from './world-affiliation-259.ts';
import {healthRandom} from './health.ts';
import {populationIntent320} from './population-intent-320.ts';
import {CARAVAN_FAMILY_BY_DEF_332,CARAVAN_GUARDS_332,CARAVAN_MAX_MEMBERS_332,CARAVAN_TRADERS_332,CARAVAN_TRADER_KINDS_332,
  caravanApparel332,caravanGuardPoints332,chooseCaravanGuards332,drawCaravanTraderKind332,generateCaravanStock332} from './trader-caravans-332.ts';
import type {ForeignRoster261} from './caravan-foreign-roster-261.ts';
import type {MaterialPile,Pawn,World} from './types.ts';

/** Schema 338: Core IncidentWorker_CaravanMeeting generates the met caravan
 * with PawnGroupKindDefOf.Trader, the faction's caravanTraderKinds (drawn by
 * CalculatedCommonality, the slaver weight following the population intent)
 * and TraderCaravanUtility.GenerateGuardPoints (550 to 1000). The schema 332
 * home trader caravan already reproduces that group (kinds, trader and guard
 * kinds, weapons, wares); this reuses it off-map. As at home, Core's pack
 * animals are not generated and the trader carries the wares. The draws come
 * from the meeting's speculative campaign stream, committed only with the
 * real pending encounter. */
export function draftCaravanMeetingRoster338(w:World,factionId:number,random:{rng:number}):ForeignRoster261|null {
 const faction=w.worldFactions?.factions.find(f=>f.id===factionId),family=faction&&CARAVAN_FAMILY_BY_DEF_332[faction.def];
 if(!family||!w.foodPolicies[0])return null;
 const draw=()=>healthRandom(random);
 const kind=drawCaravanTraderKind332(family,populationIntent320(w),draw);if(!kind)return null;
 const trader=CARAVAN_TRADERS_332[family],guards=chooseCaravanGuards332(caravanGuardPoints332(draw)-trader.cost,family,draw);
 const count=1+guards.length;if(count>CARAVAN_MAX_MEMBERS_332||!Number.isSafeInteger(w.nextId+count*4))return null;
 const label=CARAVAN_TRADER_KINDS_332[kind].label,apparel=caravanApparel332(family),people:Pawn[]=[],items:MaterialPile[]=[];let nextId=w.nextId;
 for(let i=0;i<count;i++){
  const guard=i?guards[i-1]!:undefined,name=guard?CARAVAN_GUARDS_332[guard].label:label.charAt(0).toUpperCase()+label.slice(1);
  const p=startingPawn(nextId++,`${name} ${w.nextId}.${i+1}`,0,0,0,55,w.seed,w.tick,w.schemaVersion);
  p.faction='outlanders';if(!bindBornHumanFaction259(w,p,factionId))return null;p.foodPolicyId=w.foodPolicies[0]!.id;
  delete p.apparelPolicyId;delete p.apparelAutomation;delete p.nextApparelCheckAt;
  for(const value of Object.values(p.skills))if(typeof value==='object'){value.level=0;value.passion=0;}
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  generateBornBackground(w,p,w.seed,!!guard,!guard,{kind:guard?CARAVAN_GUARDS_332[guard].core:trader.core});giveBornTraits361(w,p);
  people.push(p);
  items.push({id:nextId++,kind:'apparel',item:apparel,quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState(apparel,undefined,w.schemaVersion)});
  // Schema 340: Gun-tagged Core kinds draw their gun, as in visitors.ts.
  const fixedWeapon=guard?CARAVAN_GUARDS_332[guard].weapon:trader.weapon,coreKind=guard?CARAVAN_GUARDS_332[guard].core:trader.core;
  const weapon=isBlowbackSchema340(w.schemaVersion)&&isGunKind340(coreKind)?gunKindWeapon342(coreKind,fixedWeapon,w.seed,p.id,w.schemaVersion):fixedWeapon;
  items.push({id:nextId++,kind:'weapon',item:weapon,quantity:1,owner:{type:'equipment',pawnId:p.id},weapon:newWeaponState(weapon)});
  if(!guard){const stock=generateCaravanStock332(random.rng,p.id,nextId,w.tick,kind,w.schemaVersion);items.push(...stock.piles);nextId=stock.nextId;random.rng=stock.rng;}
  // The same personal provisions as the historical met traders.
  const foodDraw=draw(),item=foodDraw<.75?'simple-meal':'survival-meal',quantity=draw()<5/6?3:2;
  items.push({id:nextId++,kind:'food',item,quantity,owner:{type:'inventory',pawnId:p.id},...freshRot(item,w.tick)});
 }
 if(!Number.isSafeInteger(nextId))return null;
 return {people,items,nextId,rng:random.rng,meeting:{traderId:people[0]!.id,guardIds:people.slice(1).map(p=>p.id),caravanKind338:kind}};
}
