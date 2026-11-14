import {RAID_ARRIVAL_333,RAID_POD_FALL_CORE_333,RAID_POD_ROOF_CORE_333,isRaidArrivalMode333,raidArrivalAllowed333,raidMaxGroups333,raidPodOpenDelay333} from './raid-arrival-333.ts';
import {RAID_MAKERS_331,raidFamilyOfFaction331} from './raid-factions-331.ts';
import type {RaidGroup} from './raid-state.ts';
import type {World} from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const ARRIVAL_KEYS=['mode','atCore','centers','memberGroups','pods','factionId','fallbackFrom'] as const,POD_KEYS=['pawnId','cell','landAtCore','openAtCore','roofHit','openedAtCore'] as const;

/** Strict schema 333 arrival of the active Cassandra home raid. A pod not yet
 * opened holds a reserved member ID that no live, departed or other record
 * uses; it is added to `ids`. An opened pod's raider follows the ordinary
 * participant checks. */
export function raidArrivalErrors333(w:World,group:RaidGroup,version:number,cassandra:boolean,ids:Set<number>):string[] {
  const a:unknown=group.arrival333;if(a===undefined)return [];
  const fail=['Invalid raid arrival.'];
  const cell=(v:unknown):v is {x:number;z:number}=>object(v)&&Object.keys(v).length===2&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);
  const edge=(c:{x:number;z:number})=>c.x===0||c.z===0||c.x===w.width-1||c.z===w.height-1;
  if(version<333||!cassandra||group.caravan261!==undefined||group.shipReactor275!==undefined||group.originQuestId!==undefined&&a&&object(a)&&a.mode!=='edge-walk-in'
    ||!object(a)||!keys(a,ARRIVAL_KEYS)||!isRaidArrivalMode333(a.mode)||!integer(a.atCore,group.startedAt*10,group.startedAt*10+9)||!Array.isArray(a.centers)||!a.centers.every(cell))return fail;
  const mode=a.mode,def=RAID_ARRIVAL_333[mode],n=group.members.length,centers=a.centers as {x:number;z:number}[];
  const family=group.composition?.group331?RAID_MAKERS_331[group.composition.group331].family:'pirate';
  // Without a roster the raid had no points: Core weighs only the walk-in.
  if(!raidArrivalAllowed333(mode,family,group.stage330!==undefined)||!group.composition&&mode!=='edge-walk-in')return fail;
  if(a.fallbackFrom!==undefined&&(a.fallbackFrom!=='center-drop'||mode!=='edge-drop'))return fail;
  if(def.groups?centers.length<(n>1?2:1)||centers.length>raidMaxGroups333(n):centers.length!==(mode==='random-drop'?0:1))return fail;
  if(!def.drop&&!centers.every(edge)||group.stage330&&(!centers[0]||centers[0].x!==group.stage330.point.x||centers[0].z!==group.stage330.point.z))return fail;
  if(def.groups){
    const g=a.memberGroups;
    if(!Array.isArray(g)||g.length!==n||!g.every(v=>integer(v,0,centers.length-1))||centers.some((_,i)=>g[i]!==i))return fail;
  }else if(a.memberGroups!==undefined)return fail;
  if(!def.drop)return a.pods!==undefined||a.factionId!==undefined?fail:[];
  // Drops: one pod a member, in member order, within the Core clock.
  const registry=w.worldFactions;
  if(registry?a.factionId===undefined||!integer(a.factionId,1)||raidFamilyOfFaction331(w,a.factionId)!==family:a.factionId!==undefined)return fail;
  if(!Array.isArray(a.pods)||a.pods.length!==n)return fail;
  const delay=raidPodOpenDelay333({mode,...a.fallbackFrom==='center-drop'?{fallbackFrom:'center-drop' as const}:{}}),now=w.tick*10+9,cells=new Set<number>(),errors:string[]=[];
  for(let i=0;i<n;i++){
    const p:unknown=a.pods[i];
    if(!object(p)||!keys(p,POD_KEYS)||p.pawnId!==group.members[i]||!cell(p.cell)||typeof p.roofHit!=='boolean'
      ||!integer(p.landAtCore,Number(a.atCore)+RAID_POD_FALL_CORE_333[0],Number(a.atCore)+RAID_POD_FALL_CORE_333[1])||p.openAtCore!==Number(p.landAtCore)+delay+1
      ||p.roofHit&&now<Number(p.landAtCore)-RAID_POD_ROOF_CORE_333
      ||p.openedAtCore!==undefined&&(!p.roofHit||!integer(p.openedAtCore,Number(p.openAtCore),now)))return fail;
    const key=p.cell.z*w.width+p.cell.x;if(cells.has(key))return fail;cells.add(key);
    if(p.openedAtCore!==undefined)continue;
    // Still closed: only the reserved ID exists.
    const id=p.pawnId as number;
    if(ids.has(id)||!integer(id,1,w.nextId-1)||w.pawns.some(q=>q.id===id)||w.raids?.departed.some(d=>d.pawnId===id)||group.lost.includes(id))errors.push('Invalid closed raid pod.');
    ids.add(id);
  }
  return errors;
}
/** A member still inside a closed pod of this raid. */
export const inClosedRaidPod333=(group:Pick<RaidGroup,'arrival333'>,id:number):boolean=>!!group.arrival333?.pods?.some(p=>p.pawnId===id&&p.openedAtCore===undefined);
