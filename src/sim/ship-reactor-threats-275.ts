import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {tempMapRecord261,tempMapThreatPoints261} from './temp-map-incidents-261.ts';
import {raidRandom,type RaidCalendar} from './raid-state.ts';
import {chooseRaidComposition} from './raids.ts';
import {createRaidGroup} from './raid-spawn.ts';
import {raidEntries} from './raid-space.ts';
import {createShipReactorMechanoidRaid275,mechFactionCommonality} from './mechanoid-raids.ts';
import {actualMechanicalBirthFaction259} from './mechanoid-world-faction-259.ts';
import {bornFactionForDef259} from './world-affiliation-259.ts';
import {computeThreatPoints,summaryHealthPercent} from './threat-points.ts';
import {colonyWealth} from './colony-wealth.ts';
import {isColonist} from './affiliation.ts';
import type {World} from './types.ts';

export interface ShipReactorRaidSource275 {revision:1;mapId:number;tile:number|null;atCore:number;cycle:number;points:number;factionId:number|null}
export interface ShipReactorThreatEvent275 {atCore:number;cycle:number;points:number;result:'failed'|'human'|'mechanoid';raidId?:number}
/** Local prospective owner; it outlives its reactor and never owns an actor. */
export interface ShipReactorThreats275 {revision:1;mapId:number;tile:number|null;generationAtCore:number;adoptedAtCore:number;active:boolean;seed:number;rng:number;checkedAtCore:number;opportunities:number;spawned:number;lastFaction?:'outlaws'|'mechanoid';recent:ShipReactorThreatEvent275[]}
const f=Math.fround;
const even=(v:number)=>{const low=Math.floor(v),fraction=v-low;return fraction<.5?low:fraction>.5?low+1:low%2===0?low:low+1;};
const mix=(v:number)=>{v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return (v^(v>>>16))>>>0||1;};
export const shipReactorBeacon275=(w:Pick<World,'schemaVersion'|'shipReactorThreats275'>):boolean=>isSchema275OrLater(w.schemaVersion)&&w.shipReactorThreats275?.active===true;
/** Own xorshift stream is an explicit adaptation, not Unity's seeded Rand.
 * Off30 > spacing2 means a previous cycle cannot constrain this fixed cycle. */
export function shipReactorFrequency275(scale:number):number {
 const points=[[0,.1],[.3,.5],[.6,.8],[1,1],[1.55,1.1],[2.2,1.2],[10,2]] as const;
 if(scale<=0)return f(.1);for(let i=1;i<points.length;i++){const [x,y]=points[i]!,[px,py]=points[i-1]!;if(scale<=x)return f(f(py)+f(f(y-py)*f(f(scale-px)/f(x-px))));}return 2;
}
export function shipReactorGenerationInterval275(generationAtCore:number,settleAtCore=0):number {return even(f(f(f(generationAtCore-settleAtCore)/60000)*60));}
export function shipReactorCycleHits275(seed:number,cycle:number,threatScale=.6):number[] {
 if(!Number.isSafeInteger(cycle)||cycle<0||!Number.isFinite(threatScale)||threatScale<0)return [];
 const random={rng:mix(seed^mix(cycle))},factor=shipReactorFrequency275(threatScale),min=f(factor),max=f(2*factor),sample=f(min+f(f(max-min)*f(raidRandom(random)))),floor=Math.floor(sample),count=floor+Number(raidRandom(random)<f(sample-floor));
 for(let attempt=0;attempt<101;attempt++){
  const hits=Array.from({length:count},()=>Math.floor(raidRandom(random)*60)).sort((a,b)=>a-b);
  for(let i=1;i<hits.length;i++){if(hits[i]!-hits[i-1]!<2){hits[i]=hits[i-1]!+2;for(let j=i+1;j<hits.length;j++)hits[j]=Math.max(hits[j]!,hits[i]!+j);}}
  if(!hits.length||hits.at(-1)!<=60)return hits;
 }
 // A failed disposition is not a guaranteed attack or an unbounded retry.
 return [];
}
export function shipReactorThreatMap275(w:World):{mapId:number;tile:number|null;generationAtCore:number}|undefined {
 const mapId=registeredMapId(w);if(mapId===undefined)return;
 const record=tempMapRecord261(w);if(record)return {mapId:record.id,tile:record.tile,generationAtCore:record.createdAt*10};
 if(!registeredCampaign(w).worldMaps&&!w.campaignMap&&Array.isArray(w.tiles))return {mapId,tile:w.planet?.homeTile??null,generationAtCore:0};
}
export function shipReactorThreatSeed275(w:Pick<World,'seed'>,mapId:number):number {return mix(w.seed^Math.imul(mapId+1,0x27551));}
function ensureCalendar(w:World):RaidCalendar {
 if(w.raids){w.raids.mechanoid??={adoptedAt:w.tick,rng:mix(w.seed^0x275ec1),ranged:{adoptedAt:w.tick}};return w.raids;}
 // This distinct dormant owner supplies no ordinary incident calendar.
 return w.raids={profile:'ship-reactor-raids-v1',rng:mix(w.seed^0x275ca1),nextCheck:null,serial:0,completed:0,departed:[],mechanoid:{adoptedAt:w.tick,rng:mix(w.seed^0x275ec1),ranged:{adoptedAt:w.tick}}};
}
function points(w:World):number {
 const native=tempMapThreatPoints261(w);if(native!==undefined)return Math.max(500,native);
 const people=w.pawns.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead');
 return Math.max(500,computeThreatPoints({timeFactorWholeDays:w.schemaVersion>=328,knownWealth:(w.economy?.wealth??colonyWealth(w)).knownStorytellerWealth,freeColonists:people.length,colonistHealthSum:people.reduce((n,p)=>n+(p.health?summaryHealthPercent(p.health):1),0),elapsedDays:w.tick/6000,adaptationDays:w.economy?.adaptationDays??0,seedBucket:Math.floor(w.tick/250)}).points);
}
function actualFaction(w:World,kind:'outlaws'|'mechanoid'):number|null|undefined {
 const factions=registeredCampaign(w).worldFactions;if(!factions)return kind==='outlaws'?null:undefined;
 const id=kind==='outlaws'?bornFactionForDef259(w,'Pirate'):actualMechanicalBirthFaction259(factions)?.factionId,faction=factions.factions.find(a=>a.id===id);
 if(!faction||faction.id===factions.playerFactionId||faction.lifecycle259?.defeated||faction.lifecycle259?.temporary)return;
 const aId=Math.min(factions.playerFactionId,faction.id),bId=Math.max(factions.playerFactionId,faction.id);
 return factions.relations.find(r=>r.aId===aId&&r.bId===bId)?.kind==='hostile'?faction.id:undefined;
}
/** One actual physical birth, without borrowing an active slot or agenda RNG. */
function admit(w:World,state:ShipReactorThreats275,budget:number,cycle:number,random:{rng:number}):ShipReactorThreatEvent275 {
 const event:ShipReactorThreatEvent275={atCore:w.tick*10,cycle,points:budget,result:'failed'},pirate=actualFaction(w,'outlaws'),mech=actualFaction(w,'mechanoid');
 const humanWeight=pirate===undefined?0:state.lastFaction==='outlaws'?.4:1,mechWeight=mech===undefined||w.tick<45*6000?0:mechFactionCommonality(budget)*(state.lastFaction==='mechanoid'?.4:1),total=humanWeight+mechWeight;
 if(!total)return event;const mechanical=raidRandom(random)*total<mechWeight,factionId=mechanical?mech:pirate;
 if(factionId===undefined)return event;
 const source:ShipReactorRaidSource275={revision:1,mapId:state.mapId,tile:state.tile,atCore:event.atCore,cycle,points:budget,factionId};
 ensureCalendar(w);
 const group=mechanical?createShipReactorMechanoidRaid275(w,budget,random,source):(()=>{const composition=chooseRaidComposition(budget,random),sites=raidEntries(w,random.rng,composition.roster.length);return sites?createRaidGroup(w,{count:composition.roster.length,sites,random,composition,preserveCalendarRng:true,shipReactor275:source}):null;})();
 if(group){event.result=mechanical?'mechanoid':'human';event.raidId=group.id;state.lastFaction=mechanical?'mechanoid':'outlaws';}
 return event;
}
/** Called after real reactor state advancement. No structure/terrain scan and
 * no historical replay; the caller supplies its already-known map beacon. */
export function advanceShipReactorThreats275(w:World,starting:boolean):void {
 if(!isSchema275OrLater(w.schemaVersion))return;const now=w.tick*10;
 let state=w.shipReactorThreats275;
 if(!state){if(!starting)return;const map=shipReactorThreatMap275(w);if(!map)return;const seed=shipReactorThreatSeed275(w,map.mapId);state=w.shipReactorThreats275={revision:1,...map,adoptedAtCore:now,active:true,seed,rng:mix(seed^0x275e77),checkedAtCore:Math.floor((now-1)/1000)*1000,opportunities:0,spawned:0,recent:[]};}
 state.active=starting;if(now%1000||now<=state.checkedAtCore)return;state.checkedAtCore=now;if(!starting)return;
 const interval=Math.floor(now/1000)-shipReactorGenerationInterval275(state.generationAtCore);if(interval<0)return;
 const cycle=Math.floor(interval/90),within=interval%90,hits=shipReactorCycleHits275(state.seed,cycle);
 for(const hit of hits)if(hit===within){const random={rng:state.rng},event=admit(w,state,points(w),cycle,random);state.rng=random.rng;state.opportunities++;if(event.result!=='failed')state.spawned++;state.recent.push(event);if(state.recent.length>32)state.recent.shift();}
}
