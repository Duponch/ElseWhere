import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {draftForeignRoster261} from './caravan-foreign-roster-261.ts';
import {chooseRaidComposition} from './raids.ts';
import {raidEntries} from './raid-space.ts';
import {healthRandom} from './health.ts';
import type {World} from './types.ts';
/** Forced actual foreign-parent pressure. Same current human producer, finite
 * ordinary raid controller and physical edges; no ambient Cassandra ticket. */
export function createBattlefieldPressureHumanRaid261(map:World,points:number,random:{rng:number}):boolean {
 const root=registeredCampaign(map),id=registeredMapId(map),site=root.worldMaps?.sites.find(s=>s.id===id),factionId=site?.battlefield261?.factionId,s=map.raids;
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||site?.kind!=='battlefield'||!site.campPressure||factionId===null||factionId===undefined||!s||s.profile!=='camp-pressure-v1'||s.active||s.mechActive||!Number.isSafeInteger(s.serial+1))return false;
 const draft={rng:random.rng},roster=draftForeignRoster261(map,'combat',factionId,points,draft.rng);if(!roster)return false;draft.rng=roster.rng;
 const entries=raidEntries(map,draft.rng,roster.people.length);if(!entries)return false;
 const serial=s.serial+1,deadline=map.tick+2600+Math.floor(healthRandom(draft)*1201),lossPermille=400+Math.floor(healthRandom(draft)*301);
 if(map.piles.length+roster.items.length>32768||map.pawns.length+roster.people.length>map.width*map.height)return false;
 // Composition was consumed by the current producer; capture the same roster
 // budget freshly as role evidence without rerolling or selecting new people.
 const composition=roster.composition;if(!composition)return false;
 for(let i=0;i<roster.people.length;i++){const p=roster.people[i]!;Object.assign(p,entries[i]!);p.raid={group:serial,exiting:false,goal:null};}
 map.pawns.push(...roster.people);appendPileEntries(map.piles,...roster.items);root.nextId=roster.nextId;s.serial=serial;s.nextCheck=null;s.active={id:serial,startedAt:map.tick,deadline,lossPermille,members:roster.people.map(p=>p.id),lost:[],phase:'assault',composition,caravan261:{revision:1,kind:'pressure',sourceMapId:id!,bornAtCore:map.tick*10,factionId}};random.rng=draft.rng;return true;
}
