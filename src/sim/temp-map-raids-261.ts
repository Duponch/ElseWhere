import {mechRaidGroups261,multiRaid261} from './mechanical-raid-groups-261.ts';
import {journalLetter352,actors352} from './letter-producers-352.ts';
import {tempMapModern261,tempMapRecord261} from './temp-map-incidents-261.ts';
import {findTempAmbushEntry261,tempAmbushCells261} from './temp-map-entry-261.ts';
import {draftForeignRoster261} from './caravan-foreign-roster-261.ts';
import {selectCaravanFaction261,type CaravanFactionCapture261} from './caravan-faction-selection-261.ts';
import {draftManhunterRoster261,selectManhunterKind261} from './caravan-manhunter-261.ts';
import {prepareManhunterSpawn261} from './animal-scaria-261.ts';
import {bornKidnapLord261,type KidnapLord261} from './caravan-kidnap-lord-261.ts';
import {cobraCohortReason256} from './cobra-admission-256.ts';
import {civilianAdmissionFits} from './civilian-away.ts';
import {MAX_WILDLIFE} from './wildlife-state.ts';
import {registeredCampaign} from './world-map-context.ts';
import {healthRandom} from './health.ts';
import {isColonist} from './affiliation.ts';
import type {World} from './types.ts';
import type {RaidGroup,RaidResult} from './raid-state.ts';
export interface TempRaidSource261 {revision:1;mapId:number;tile:number;atCore:number;factionId:number;kidnapLord261:KidnapLord261}
export const raidGroups261=(w:World):RaidGroup[]=>[...w.raids?.active?[w.raids.active]:[],...w.raids?.extraActive261??[]];
export const raidGroup261=(w:World,id:number|undefined):RaidGroup|undefined=>id===undefined?undefined:w.raids?.active?.id===id?w.raids.active:w.raids?.extraActive261?.find(a=>a.id===id);
export const raidSource261=(w:World,id:number|undefined):RaidGroup|RaidResult|undefined=>raidGroup261(w,id)??raidResult261(w,id);
export const raidKidnapSource261=(a:RaidGroup|undefined)=>a?.caravan261?.kind==='assault'?a.caravan261:a?.tempIncident261;
function factions(w:World):CaravanFactionCapture261[]|undefined {
 const r=registeredCampaign(w).worldFactions;if(!r)return;const rows:CaravanFactionCapture261[]=[];
 for(const f of r.factions){const relation=f.id===r.playerFactionId?undefined:r.relations.find(x=>x.aId===Math.min(f.id,r.playerFactionId)&&x.bId===Math.max(f.id,r.playerFactionId));if(f.id!==r.playerFactionId&&!relation)return;
  rows.push({id:f.id,def:f.def,player:f.id===r.playerFactionId,hidden:f.hidden,hostileToPlayer:relation?.kind==='hostile',lifecycle259:f.lifecycle259});}return rows;
}
/** Each successful event owns another real Lord; pressure/mechActive never
 * masquerades as this group and cannot suppress its independent arrival. */
export function admitTempMapAssault261(w:World,points:number,random:{rng:number}):boolean {
 const site=tempMapRecord261(w),root=registeredCampaign(w),fs=factions(w);if(!tempMapModern261(w)||!site||site.tile===null||!fs)return false;
 if(!findTempAmbushEntry261(w,random))return false;
 if(!selectCaravanFaction261(fs,'combat',points,()=>healthRandom(random)).ok)return false;
 const entry=findTempAmbushEntry261(w,random);if(!entry)return false;
 const chosen=selectCaravanFaction261(fs,'combat',points,()=>healthRandom(random));if(!chosen.ok)return false;
 const roster=draftForeignRoster261(w,'combat',chosen.factionId,points,random.rng);if(!roster)return false;random.rng=roster.rng;
 const previous=w.raids;if(previous&&!Number.isSafeInteger(previous.serial+1)||!civilianAdmissionFits(w,roster.people.length,roster.items.length))return false;
 if((w.wildlife?.animals??[]).some(a=>a.species==='cobra'&&a.state!=='dead')&&cobraCohortReason256([...w.pawns,...roster.people],w.wildlife!.animals))return false;
 const cells=tempAmbushCells261(w,entry,roster.people.length,random),id=(previous?.serial??0)+1;
 if(!Number.isSafeInteger(id))return false;
 const source:TempRaidSource261={revision:1,mapId:site.id,tile:site.tile,atCore:w.tick*10,factionId:chosen.factionId,kidnapLord261:bornKidnapLord261(w.tick*10)};
 const group:RaidGroup={id,startedAt:w.tick,deadline:null,lossPermille:null,members:roster.people.map(p=>p.id),lost:[],phase:'assault',tempIncident261:source};
 for(let i=0;i<roster.people.length;i++){const p=roster.people[i]!;Object.assign(p,cells[i]!);p.raid={group:id,exiting:false,goal:null};}
 // If no calendar exists, this is a dormant owner, not a scheduled camp raid.
 const s=previous??{profile:'camp-raids-v1' as const,rng:root.rng,nextCheck:null,serial:0,completed:0,departed:[]};
 if(!s.extraActive261){s.extraActive261=[];s.extraResults261??=s.last?[structuredClone(s.last)]:[];}
 s.extraActive261.push(group);s.serial=id;w.raids=s;
 w.pawns.push(...roster.people);w.piles.push(...roster.items);root.nextId=roster.nextId;
 w.events.push({tick:w.tick,type:'command',message:'Une nouvelle embuscade arrive au bord de cette carte.'});if(w.events.length>80)w.events.shift();journalLetter352(w,'threat-big','Embuscade',actors352(group.members));return true;
}
export function admitTempMapManhunters261(w:World,points:number,random:{rng:number}):boolean {
 const site=tempMapRecord261(w),root=registeredCampaign(w);if(!tempMapModern261(w)||!site||site.tile===null||!w.wildlife)return false;
 if(!findTempAmbushEntry261(w,random)||!selectManhunterKind261(Math.fround(points*.75),undefined,()=>Math.fround(healthRandom(random))))return false;
 const entry=findTempAmbushEntry261(w,random);if(!entry)return false;
 const roster=draftManhunterRoster261(root,site.tile,points,random.rng,true);if(!roster)return false;random.rng=roster.rng;
 if(w.wildlife.animals.length+roster.animals.length>MAX_WILDLIFE)return false;
 if([...w.wildlife.animals,...roster.animals].some(a=>a.species==='cobra'&&a.state!=='dead')&&cobraCohortReason256(w.pawns,[...w.wildlife.animals,...roster.animals]))return false;
 const cells=tempAmbushCells261(w,entry,roster.animals.length,random),drafts=roster.animals.map((a,i)=>{Object.assign(a,cells[i]!);return prepareManhunterSpawn261(w,a);});if(drafts.some(a=>!a))return false;
 for(let i=0;i<roster.animals.length;i++){Object.assign(roster.animals[i]!,drafts[i]!);w.wildlife.animals.push(roster.animals[i]!);}root.nextId=roster.nextId;
 w.events.push({tick:w.tick,type:'command',message:'Une meute atteinte de scaria arrive sur cette carte.'});if(w.events.length>80)w.events.shift();journalLetter352(w,'threat-big','Meute enragée',actors352(roster.animals.map(a=>a.id)));return true;
}
/** Existing actual groups continue even when their old home agenda is dormant. */
export function advanceTempMapRaids261(w:World):void {
 const s=w.raids;if(!s?.extraActive261)return;
 for(const a of s.extraActive261.slice()){
  if(a.shipReactor275||a.concurrent341)continue; // Its ordinary human retreat controller owns it.
  const members=w.pawns.filter(p=>a.members.includes(p.id)),lost=(p:World['pawns'][number])=>p.state==='dead'||p.state==='downed'||!!p.prisoner||p.recruitment?.raidGroup===a.id;
  for(const p of members)if(lost(p)&&!a.lost.includes(p.id))a.lost.push(p.id);a.lost.sort((a,b)=>a-b);
  if(members.some(p=>!lost(p)&&!isColonist(p)))continue;
  const captured=members.filter(p=>p.state!=='dead'&&(p.prisoner||p.recruitment?.raidGroup===a.id)).length;
  const result:RaidResult={id:a.id,tick:w.tick,reason:a.members.length>members.length?'withdrawn':'defended',killed:members.filter(p=>p.state==='dead').length,downed:members.filter(p=>p.state==='downed'&&!p.prisoner&&!p.recruitment).length,escaped:a.members.length-members.length,...captured?{captured}:{},tempIncident261:structuredClone(a.tempIncident261!),memberCount261:a.members.length};
  for(const p of members)if(p.raid&&!p.prisoner){p.raid.exiting=true;p.raid.goal=null;}
  s.extraActive261=s.extraActive261.filter(g=>g!==a);(s.extraResults261??=[]).push(result);s.last={...result};s.completed++;
  if(!tempMapModern261(w)&&!s.active&&!mechRaidGroups261(w).length&&!s.extraActive261.length&&s.profile==='cassandra-raids-v1')s.nextCheck=s.cassandra!.pending[0]!;
 }
}

/** Preserve only an outcome which the actual old controller just produced. */
export function retainRaidResult261(w:World):void {
 const s=w.raids;if(!s||!multiRaid261(w)||!s.last)return;
 if(!s.extraResults261!.some(r=>r.id===s.last!.id))s.extraResults261!.push(structuredClone(s.last));
}

/** Completed collections own the scalar facts. last is a checked value mirror,
 * never a RAM alias required to survive JSON/cold load. */
export function raidResult261(w:World,id:number|undefined):RaidResult|undefined {
 if(id===undefined)return;const s=w.raids,stored=s?.extraResults261?.find(r=>r.id===id),last=s?.last?.id===id?s.last:undefined;
 if(stored&&last&&!sameRaidResult261(stored,last))throw Error('Raid result mirror differs from its actual retained outcome');
 return stored??last;
}
/** Any real future count/provenance mutation must update both value forms. */
export function mutateRaidResult261(w:World,id:number,update:(draft:RaidResult)=>void):boolean {
 const s=w.raids,result=raidResult261(w,id);if(!s||!result)return false;
 const next=structuredClone(result);update(next);if(next.id!==id)throw Error('Actual raid result identity cannot change');
 if(s.extraResults261?.some(r=>r.id===id))s.extraResults261=s.extraResults261.map(r=>r.id===id?next:r);
 if(s.last?.id===id)s.last=structuredClone(next);return true;
}

export function sameRaidResult261(a:RaidResult,b:RaidResult):boolean {
 const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical((v as Record<string,unknown>)[k])])):v;
 return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
