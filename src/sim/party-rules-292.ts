import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isColonist} from './affiliation.ts';
import {activeCombatThreat,hostileTarget} from './combat-target.ts';
import {pawnBody} from './health-rules.ts';
import {medicalBleed} from './injury-state.ts';
import {BLOOD_UNIT} from './injury-rules.ts';
import {fluTendable} from './flu-state.ts';
import {infectionTargets} from './infection-state.ts';
import {immuneDiseaseTargets} from './immune-diseases-state.ts';
import {assignmentAt} from './schedule.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import {boundWorldGroup,localWorldGroups,registeredCampaign,registeredMapId} from './world-map-context.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {Pawn,World} from './types.ts';

export const PARTY_CHECK_CORE292=5000;
export const PARTY_CHANCE292=1/480;
export const PARTY_COOLDOWN_CORE292=600000;
export const PARTY_MIN_REMAINING_CORE292=1200;
export const PARTY_JOY292=.035;
/** Core uses float32 and Mathf.RoundToInt: exact halves select the even integer. */
export function partyThreshold292(count:number):number {
 const value=Math.fround(Math.fround(count)*Math.fround(.65)),low=Math.floor(value);
 return Math.min(10,Math.max(2,value-low===.5?low+low%2:Math.round(value)));
}
/** Independent, prospective stream; never consumes campaign or social RNG. */
export function partySeed292(seed:number,mapId=0):number {
 let n=(seed^Math.imul(mapId+1,0x9e3779b1)^0x70617274)>>>0;
 n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);
 return ((n^(n>>>16))>>>0)||1;
}
export function partyRoll292(rng:number):{rng:number;value:number} {
 let n=rng;n^=n<<13;n^=n>>>17;n^=n<<5;const next=(n>>>0)||1;
 return {rng:next,value:next/0x100000000};
}
export function partyHome292(world:World):boolean {
 if((Number(world.schemaVersion)!==292&&(Number(world.schemaVersion)!==293&&(Number(world.schemaVersion)!==294&&(Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion)))))))||world.expeditionSite||boundWorldGroup(world)||campaignAuthority(world)!==registeredCampaign(world)||!world.tiles?.length)return false;
 const id=registeredMapId(world);if(id===undefined)return false;
 const maps=registeredCampaign(world).worldMaps;
 return !maps||id===maps.rootMapId&&maps.sites.some(s=>s.id===id&&s.kind==='settlement');
}
export const partyCivil292=(p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue
 &&p.state!=='dead'&&!p.health?.death&&p.cryptosleepHeldAt271===undefined&&p.shipCryptosleepHeldAt277===undefined;
/** Own-actor predicate: safe at the health/mental boundary without map scans. */
export function partyCapable292(world:World,p:Pawn,body:BodyAssessment=pawnBody(p),organizer=false):boolean {
 const assignment=assignmentAt(world,p),h=p.health;
 return partyCivil292(p)&&!p.draft&&!p.mental?.crisis&&!p.social?.fight&&!p.stun&&!p.shooting&&!p.melee&&!p.flee&&!p.tactics
  &&!p.burning&&!p.bombRefuge&&!p.heatRefuge&&!p.medicalSleep&&!p.collapsePending
  &&p.state!=='downed'&&p.state!=='sleeping'&&p.state!=='resting'&&body.canBeAwake&&body.movingCapable
  &&p.hunger>0&&p.rest>0&&(assignment==='anything'||assignment==='recreation')
  &&(!h||medicalBleed(h)<=0&&!fluTendable(h)&&!infectionTargets(h).length&&!immuneDiseaseTargets(h).length)
  &&(!organizer||body.capacities.talking>0&&(!h||h.bloodLoss<=BLOOD_UNIT*.2));
}
/** Conserves every accepted assignment, queue and physical cargo. */
export function partyBusy292(p:Pawn,ownParty=false):boolean {
 return p.jobId!==null||!!(p.need||p.haul||p.cooking||p.hunting||p.research||p.burial||p.cleaning||p.openCasket||p.trade
  ||p.firefighting||p.ward||p.equipmentTask||p.feed||p.tend||p.surgery||p.rescue||p.animalCare||p.animalFeed||p.animalRescue
  ||p.animalHandling||p.cryptosleepTask||p.shipCasketTask277||p.firefoamTask290||p.strip351||p.deepWork||p.orbitalTrade||p.brewing
  ||p.coupleTask285||p.interruptedCargo||p.transitExit||p.allowedAreaReturn||p.equipmentDropPending||p.priorityWork)
  ||p.orders.active!==null||p.orders.queue.length>0||!!p.recreation.task&&!(ownParty&&p.recreation.task.activity==='party');
}
/** Initial collective feasibility also respects departures still owned here. */
export function partyDepartureIds292(world:World):ReadonlySet<number> {
 const ids=new Set<number>();
 for(const trip of [world.scout,world.commercialTrip])if(trip&&'pawnId'in trip)ids.add(trip.pawnId);
 for(const record of localWorldGroups(world))if('memberIds'in record.state)for(const id of record.state.memberIds)ids.add(id);
 if(world.group&&'memberIds'in world.group)for(const id of world.group.memberIds)ids.add(id);
 return ids;
}
/** Deliberately small local projection of DangerWatcher, not a new danger owner. */
export function partyDanger292(world:World):'None'|'Low'|'High' {
 const civil=world.pawns.find(p=>partyCivil292(p));
 if(civil&&([...world.pawns,...world.wildlife?.animals??[],...world.mechanoids??[]]).some(t=>t!==civil&&activeCombatThreat(t)&&hostileTarget(civil,t)))return 'High';
 return world.fires?.items.some(f=>f.attachedPawnId===undefined&&f.attachedAnimalId===undefined)?'Low':'None';
}
