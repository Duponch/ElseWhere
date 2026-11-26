import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import type {ForeignRoster261} from './caravan-foreign-roster-261.ts';
import {civilianAdmissionFits} from './civilian-away.ts';
import {newTactics} from './tactics-state.ts';
import {processTactics} from './tactics.ts';
import {moveToward} from './travel.ts';
import {distanceSquared} from './affiliation.ts';
import type {World,Pawn,Cell} from './types.ts';
import type {NavigationGrid,SearchBudget} from './work-planner.ts';
import type {LightReader} from './light-environment.ts';

/** Actual map-parent defence, independent of a caravan raid/calendar. No
 * victory/deadline, colony-down withdrawal, kidnapping or fake trader Lord. */
export interface WorldTargetDefence263 {
 revision:1;bornAtCore:number;factionId:number;memberIds:number[];defendSpot:Cell;radius:28;
 source:{kind:'foreign-settlement';settlementId:number;settledAtCore?:number}|{kind:'outpost'|'turrets';siteId:number};
}
export function populateWorldTargetDefenders263(w:World,source:WorldTargetDefence263['source'],factionId:number,roster:Pick<ForeignRoster261,'people'|'items'|'nextId'>,cells:readonly number[],defendSpot:Cell):void {
 if(!isSchema263OrLater(Number(w.schemaVersion))||w.worldDefence263||w.pawns.length||!cells.length)throw Error('Actual unpublished263 map defender frontier required');
 if(cells.length<roster.people.length||!civilianAdmissionFits(w,roster.people.length,roster.items.length)||w.nextId<roster.nextId||!roster.people.every(p=>p.worldAffiliation259?.factionId===factionId))throw Error('Actual existing foreign producer cannot populate this base');
 for(let i=0;i<roster.people.length;i++){const p=roster.people[i]!,cell=cells[i]!;p.x=cell%w.width;p.z=Math.floor(cell/w.width);p.path=[];p.moveCooldown=0;p.planCooldown=0;if(p.state!=='downed')p.state='idle';delete p.raid;}
 w.pawns.push(...roster.people);appendPileEntries(w.piles,...roster.items);
 w.worldDefence263={revision:1,bornAtCore:w.tick*10,factionId,memberIds:roster.people.map(p=>p.id),defendSpot:{...defendSpot},radius:28,source:{...source}};
}
/** Capturing/recruiting an original ends only its old defence mandate. The
 * physical human and goods remain in their real existing owners. */
export function isWorldTargetDefender263(w:World,p:Pawn):boolean {
 const d=w.worldDefence263;return isSchema263OrLater(Number(w.schemaVersion))&&!!d&&d.memberIds.includes(p.id)&&p.faction==='outlaws'&&!p.prisoner&&p.worldAffiliation259?.factionId===d.factionId;
}
export function processWorldTargetDefender263(w:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):void {
 if(!isWorldTargetDefender263(w,p))throw Error('No actual settlement/Site defence mandate');
 if(p.melee?.strike||p.shooting?.stance?.phase==='cooldown'){p.state='idle';return;}
 const d=w.worldDefence263!;p.tactics??=newTactics();
 processTactics(w,p,getBlocked,budget,getLight,{center:d.defendSpot,radius:d.radius});
 if(p.tactics?.targetId!==null&&p.tactics?.targetId!==undefined)return;
 delete p.tactics;
 if(distanceSquared(p,d.defendSpot)>d.radius*d.radius)moveToward(w,p,d.defendSpot,false,getBlocked,budget,false,getLight);
 else{p.path=[];p.state='idle';}
}
