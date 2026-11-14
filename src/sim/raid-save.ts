import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {shipCasketHumanReferences277,shipCasketTerminalParticipant277} from './ship-casket-notifications-277.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {isSchema272OrLater} from './schema-compatibility-257.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isMaceItem269} from './mace-content-269.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {multiRaid261} from './mechanical-raid-groups-261.ts';
import {validateTempRaidCollections261,validTempRaidSource261} from './temp-map-raids-save-261.ts';
import {raidGroup261} from './temp-map-raids-261.ts';
import {tempMapModern261,tempMapAdoptedAtCore261} from './temp-map-incidents-261.ts';
import {kidnapDutyExiting261} from './caravan-kidnap-lord-save-261.ts';
import {validatePhysicalKidnaps261} from './caravan-kidnap-save-261.ts';
import {validCaravanRaidProvenance261} from './caravan-raid-save-261.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {validateShipReactorThreats275,validShipReactorRaidSource275} from './ship-reactor-threat-save-275.ts';
import { validateMechanoidRaids } from './mechanoid-raid-save.ts';
import { validApparelShape,validateApparel } from './apparel-save.ts';
import { bombRefugeRouteTarget } from './bomb-refuge-route.ts';
import { CASSANDRA_CYCLE_START,validCassandraAgenda } from './cassandra-raids.ts';
import { validWeaponShape,validateEquipment } from './equipment-save.ts';
import { RAID_ROLE_COST,pirateMaxPawnCost } from './raid-state.ts';
import { TICKS_PER_DAY,type World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
export function validComposition(value:unknown,count:number,version:number,cassandra:boolean,economy:boolean):boolean {
  if(version<105||!cassandra||!economy||!object(value)||!keys(value,['budget','roster'])||
    typeof value.budget!=='number'||!Number.isFinite(value.budget)||value.budget<35||value.budget>10000||
    !Array.isArray(value.roster)||value.roster.length!==count||count<1||count>Math.floor(value.budget/35))return false;
  let spent=0;
  const maxCost=pirateMaxPawnCost(value.budget);
  for(const role of value.roster){if(typeof role!=='string'||!Object.hasOwn(RAID_ROLE_COST,role))return false;
    const cost=RAID_ROLE_COST[role as keyof typeof RAID_ROLE_COST];if(cost>maxCost)return false;spent+=cost;}
  return spent<=value.budget&&value.budget-spent<35;
}
/** V183's announced pursuit is the one bounded 35-point drifter. Its raid
 * does not depend on the ambient wealth budget or Cassandra cycle. */
function validQuestComposition(value:unknown):boolean {
  return object(value)&&Object.keys(value).length===2&&keys(value,['budget','roster'])
    &&value.budget===35&&Array.isArray(value.roster)&&value.roster.length===1&&value.roster[0]==='drifter';
}
export function validateRaids(w:World,version:number,ids:Set<number>):string[] {
  const errors:string[]=[],state:unknown=w.raids;
  const cell=(v:unknown):boolean=>object(v)&&Object.keys(v).length===2&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);
  if(version<68)return state!==undefined||w.pawns.some(p=>p.raid!==undefined)?['Legacy save contains raid state.']:[];
  if(state===undefined)return w.pawns.some(p=>p.raid!==undefined)?['Raider without calendar.']:[];
  if(!object(state)||!keys(state,['profile','rng','nextCheck','serial','completed','active','last','departed','cassandra',...(version>=194?['mechanoid','mechActive']:[]),...((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))?['extraActive261','extraResults261','extraMechActive261']:[])])||!['camp-raids-v1','cassandra-raids-v1',...version>=260?['camp-pressure-v1']:[],...(isSchema275OrLater(version)?['ship-reactor-raids-v1']:[])].includes(String(state.profile))||!integer(state.rng,1,4294967295)||!integer(state.serial,0)||!integer(state.completed,0,state.serial)||!Array.isArray(state.departed)||state.departed.length>w.width*w.height)return ['Invalid raid calendar.'];
  const shipOwner=isSchema275OrLater(version)&&Object.hasOwn(w,'shipReactorThreats275')&&validateShipReactorThreats275(w,version).length===0,shipOnly=state.profile==='ship-reactor-raids-v1';
  if(shipOnly&&(!shipOwner||state.nextCheck!==null||state.cassandra!==undefined||state.active!==undefined||state.mechActive!==undefined))return ['Invalid dormant ship reactor raid owner.'];
  const collectionErrors=validateTempRaidCollections261(w,version);if(collectionErrors.length)return collectionErrors;
  const shipHumanIds=new Set(shipOwner?[...w.raids?.extraActive261??[],...w.raids?.extraResults261??[]].filter(g=>g.shipReactor275&&!('mechanoid'in g&&g.mechanoid)).map(g=>g.id):[]);
  const modern=(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&tempMapModern261(w),multi=(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&multiRaid261(w),agendaTick=modern?tempMapAdoptedAtCore261(w)!/10:w.tick;
  const pressure=state.profile==='camp-pressure-v1';if(pressure){const root=registeredCampaign(w),mapId=registeredMapId(w),site=root.worldMaps?.sites.find(m=>m.id===mapId);if(version<260||state.active!==undefined&&!((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&object(state.active)&&state.active.caravan261!==undefined)||state.cassandra!==undefined||state.nextCheck!==null||!state.mechanoid||state.departed.some(d=>!object(d)||!shipHumanIds.has(Number(d.group)))||(site?!(site.kind==='camp'||(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&site.kind==='battlefield')||!site.campPressure:!w.expeditionSite&&!(w.campaignMap?.revision===2&&w.campaignMap.maps.some(m=>w.campaignMap?.revision===2&&(m.kind==='camp'||(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&m.kind==='battlefield')&&m.id===w.campaignMap.activeMapId))))return ['Invalid prospective Camp raid owner.'];}
  const cassandra=state.profile==='cassandra-raids-v1';
  if(cassandra?version<82||!w.gameProfile||!validCassandraAgenda(state.cassandra,agendaTick,version):state.cassandra!==undefined)return ['Invalid Cassandra raid agenda.'];
  const s=w.raids!,a:unknown=s.active,last:unknown=s.last;
  // Cassandra's already-validated agenda fixes its exact future window. The
  // gap from an early opportunity to the next cycle's late opportunity can
  // exceed one cycle; a rolling cycle-length bound would reject that save.
  errors.push(...validateMechanoidRaids(w,version,ids));
  const ongoing=a!==undefined||s.mechActive!==undefined||(multi&&((s.extraActive261?.length??0)+(s.extraMechActive261?.length??0)>0));
  const ongoingCount=Number(a!==undefined)+Number(s.mechActive!==undefined)+(multi?(s.extraActive261?.length??0)+(s.extraMechActive261?.length??0):0);
  const shipLeavesOrdinaryFree=shipOwner&&!s.active&&!s.mechActive&&(s.extraActive261??[]).every(g=>!!g.shipReactor275)&&(s.extraMechActive261??[]).every(g=>!!g.shipReactor275);
  const validNext=shipOnly?s.nextCheck===null:modern?(s.nextCheck===null||cassandra&&s.nextCheck===s.cassandra!.pending[0]||!cassandra&&integer(s.nextCheck,agendaTick+1,agendaTick+8*TICKS_PER_DAY)):pressure?s.nextCheck===null:!ongoing||shipLeavesOrdinaryFree?(cassandra?s.nextCheck===s.cassandra!.pending[0]:integer(s.nextCheck,w.tick+1,w.tick+8*TICKS_PER_DAY)):s.nextCheck===null;
  if(s.completed!==s.serial-(multi?ongoingCount:ongoing?1:0)||!validNext)errors.push('Invalid raid schedule or count.');
  const lastCount=object(last)&&(last.caravan261!==undefined||last.tempIncident261!==undefined)&&integer(last.memberCount261,1,w.nextId-1)?last.memberCount261:object(last)&&object(last.mechComposition)&&Array.isArray(last.mechComposition.roster)?last.mechComposition.roster.length:object(last)&&object(last.composition)&&Array.isArray(last.composition.roster)?last.composition.roster.length:(multi&&object(last)?last.id:s.completed)===1?1:2;
  const questLast=object(last)&&last.originQuestId!==undefined,pressureLast=object(last)&&object(last.caravan261)&&last.caravan261.kind==='pressure',reactorLast=object(last)&&Object.hasOwn(last,'shipReactor275');
  const lastKeys=['id','tick','reason','killed','downed','escaped',...(isSchema277OrLater(version)?['destroyed277']:[])];
  if(version>=86)lastKeys.push('captured');
  if(version>=105)lastKeys.push('composition');
  if(version>=172)lastKeys.push('originQuestId');
  if(version>=194)lastKeys.push('mechanoid','mechComposition');
  if(version===261||Number(version)===262||isSchema263OrLater(Number(version)))lastKeys.push('caravan261','memberCount261','tempIncident261');
  if(isSchema275OrLater(version))lastKeys.push('shipReactor275');
  if(s.completed===0?last!==undefined:!object(last)||!keys(last,lastKeys)||(multi?!integer(last.id,1,s.serial)||last.id===s.active?.id||last.id===s.mechActive?.id||(s.extraActive261??[]).some(g=>g.id===last.id)||(s.extraMechActive261??[]).some(g=>g.id===last.id):last.id!==s.completed)||!integer(last.tick,0,w.tick)||!['defended','withdrawn','colony-down'].includes(String(last.reason))||!['killed','downed','escaped'].every(k=>integer(last[k],0,lastCount))||last.destroyed277!==undefined&&(!isSchema277OrLater(version)||!integer(last.destroyed277,1,lastCount))||last.captured!==undefined&&(version<86||!integer(last.captured,1,lastCount))||questLast&&(!integer(last.originQuestId,1,w.quests?.serial??0)||!validQuestComposition(last.composition))||last.composition!==undefined&&!pressureLast&&!reactorLast&&(questLast?!validQuestComposition(last.composition):last.tick<CASSANDRA_CYCLE_START||!w.economy||last.tick<w.economy.adoptedAt||!validComposition(last.composition,lastCount,version,cassandra,true))||Number(last.killed)+Number(last.downed)+Number(last.escaped)+Number(last.captured??0)+Number(last.destroyed277??0)!==lastCount)errors.push('Invalid raid outcome.');
  if(reactorLast&&object(last)&&(!shipOwner||last.caravan261!==undefined||last.tempIncident261!==undefined||last.originQuestId!==undefined||last.memberCount261!==undefined||!validShipReactorRaidSource275(last.shipReactor275,w,Number(last.tick),last.mechanoid===true?'mechanoid':'human')||last.mechanoid!==true&&!validComposition(last.composition,lastCount,version,true,true)))errors.push('Invalid retained ship reactor raid outcome.');
  if(object(last)&&Object.hasOwn(last,'tempIncident261')&&(!validTempRaidSource261(last.tempIncident261,w,undefined,Number(last.tick))||!integer(last.memberCount261,1,w.nextId-1)))errors.push('Invalid real TempMap raid outcome.');
  if(object(last)&&last.tempIncident261===undefined&&(last.caravan261!==undefined||last.memberCount261!==undefined)&&(!integer(last.memberCount261,1,w.nextId-1)||!object(last.caravan261)||!integer(last.caravan261.bornAtCore,0,w.tick*10)||!validCaravanRaidProvenance261(last.caravan261,w,Number(last.caravan261.bornAtCore)/10,undefined,Number(last.tick))))errors.push('Invalid actual caravan raid result provenance.');
  if(pressureLast&&object(last)&&!validComposition(last.composition,lastCount,version,true,true))errors.push('Invalid forced human pressure composition.');
  for(const d of s.departed){
    if(!object(d)||!keys(d,['group','pawnId','name','cell','tick','items',...(version>=202?['reason','capturedAt','releasedAt']:[])])||!integer(d.group,1,s.serial)||!integer(d.pawnId,1,w.nextId-1)||ids.has(d.pawnId)||typeof d.name!=='string'||!d.name.trim()||d.name.length>48||!integer(d.tick,0,w.tick)||!cell(d.cell)||!(d.cell.x===0||d.cell.z===0||d.cell.x===w.width-1||d.cell.z===w.height-1)||!Array.isArray(d.items)||d.items.length>3){errors.push('Invalid raid departure.');continue;}
    if(d.reason===undefined?d.capturedAt!==undefined||d.releasedAt!==undefined:
      version<202||d.reason!=='released'||!integer(d.capturedAt,0,d.tick)||!integer(d.releasedAt,Number(d.capturedAt),d.tick))errors.push('Invalid released raider departure.');
    ids.add(d.pawnId);
    let valid=true;
    for(const i of d.items){
      if(!object(i)||!keys(i,['id','kind','item','quantity','owner','apparel','weapon'])||!integer(i.id,1,w.nextId-1)||ids.has(i.id)||!object(i.owner)||!keys(i.owner,['type','pawnId'])||!('pawnId' in i.owner)||i.owner.pawnId!==d.pawnId||!(i.kind==='weapon'&&(['revolver',...(version>=88?['bolt-action-rifle','plasteel-knife']:[]),...(version>=208?['emp-launcher']:[]),...(version>=316?['short-bow']:[]),...(version>=322?['pump-shotgun']:[]),...(version>=326?['recurve-bow','greatbow']:[])].includes(String(i.item))||version>=269&&isMaceItem269(i.item)||isSchema272OrLater(version)&&isSpearItem272(i.item)||version>=270&&isLongswordItem270(i.item))&&i.owner.type==='equipment'||i.kind==='apparel'&&i.owner.type==='apparel')||!validWeaponShape(i,version>=86?version:68)||!validApparelShape(i,version>=86?version:68)){valid=false;continue;}
      ids.add(i.id);
    }
    if(!valid){errors.push('Invalid exported raid equipment.');continue;}
    // Reuse physical ownership/layer contracts on a minimal owner, not a second
    // weaker interpretation of the same apparel and primary-equipment data.
    const owner={...w.pawns[0]!,id:d.pawnId,state:'idle' as const,health:undefined,need:null,equipmentTask:undefined,equipmentDropPending:undefined,droppedWeaponId:undefined};
    const exported={...w,pawns:[owner],piles:d.items};
    errors.push(...validateApparel(exported),...validateEquipment(exported));
  }
  if(a!==undefined){
    const pressureHuman=object(a)&&object(a.caravan261)&&a.caravan261.kind==='pressure';const caravan=object(a)&&a.caravan261!==undefined&&!pressureHuman;
    const expectedCount=caravan&&object(a)&&Array.isArray(a.members)?a.members.length:object(a)&&object(a.composition)&&Array.isArray(a.composition.roster)?a.composition.roster.length:Number(object(a)?a.id:s.serial)===1?1:2;
    const questGroup=object(a)&&a.originQuestId!==undefined;
    if(!object(a)||!keys(a,['id','startedAt','deadline','lossPermille','members','lost','phase','reason',...(version>=105?['composition']:[]),...(version>=172?['originQuestId']:[]),...(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))?['caravan261']:[]])||(multi?!integer(a.id,1,s.serial):a.id!==s.serial)||!integer(a.startedAt,0,w.tick)||!(caravan?a.deadline===null&&a.lossPermille===null&&validCaravanRaidProvenance261(a.caravan261,w,a.startedAt,Array.isArray(a.members)?a.members as number[]:undefined):integer(a.deadline,a.startedAt+2600,a.startedAt+3800)&&integer(a.lossPermille,400,700))||!['assault','withdraw'].includes(String(a.phase))||!Array.isArray(a.members)||a.members.length!==expectedCount||questGroup&&(!integer(a.originQuestId,1,w.quests?.serial??0)||!validQuestComposition(a.composition))||a.composition===undefined&&version>=105&&cassandra&&!questGroup&&a.startedAt>=CASSANDRA_CYCLE_START&&!!w.economy&&a.startedAt>w.economy.adoptedAt||a.composition!==undefined&&!pressureHuman&&(questGroup?!validQuestComposition(a.composition):a.startedAt<CASSANDRA_CYCLE_START||!w.economy||a.startedAt<w.economy.adoptedAt||!validComposition(a.composition,expectedCount,version,cassandra,true))||new Set(a.members).size!==a.members.length||!a.members.every(id=>integer(id,1,w.nextId-1))||!Array.isArray(a.lost)||!a.lost.every((id,i)=>a.members instanceof Array&&a.members.includes(id)&&(i===0||Number(id)>Number((a.lost as unknown[])[i-1])))||!(a.phase==='assault'?a.reason===undefined:(caravan?['trader-lost','non-hostile']:['losses','timeout','colony-down']).includes(String(a.reason))))return [...errors,'Invalid active raid group.'];
    if(object(a)&&a.caravan261!==undefined&&(!validCaravanRaidProvenance261(a.caravan261,w,Number(a.startedAt),Array.isArray(a.members)?a.members as number[]:undefined)||pressureHuman&&!validComposition(a.composition,expectedCount,version,true,true)))return [...errors,'Invalid actual incident raid provenance.'];
    const group=s.active!;
    if(group.phase==='withdraw'&&(group.reason==='timeout'&&group.deadline!==null&&w.tick<group.deadline||group.reason==='losses'&&group.lossPermille!==null&&group.lost.length*1000<group.members.length*group.lossPermille))errors.push('Premature raid withdrawal.');
    for(const id of a.members)if(![...w.pawns,...shipCasketHumanReferences277(w)].some(p=>p.id===id&&(p.raid?.group===a.id||version>=86&&p.recruitment?.raidGroup===a.id))&&!shipCasketTerminalParticipant277(w,Number(id),'human',Number(a.id))&&!s.departed.some(d=>d.pawnId===id&&d.group===a.id)&&!(a.caravan261!==undefined&&registeredCampaign(w).worldPawns?.owners.some(r=>r.actor.id===id)))errors.push('Missing raid participant.');
  }
  for(const p of [...w.pawns,...shipCasketHumanReferences277(w)]){const r:unknown=p.raid;if(r===undefined)continue;
    const owner=object(r)?raidGroup261(w,Number(r.group)):undefined;
    if(!object(r)||!keys(r,['group','exiting','goal',...((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))?['kidnap261']:[])])||!integer(r.group,1,s.serial)||typeof r.exiting!=='boolean'||r.goal!==null&&!cell(r.goal)||p.faction!=='outlaws'||(owner?!owner.members.includes(p.id)||(p.prisoner?!r.exiting||r.goal!==null:r.exiting!==(owner.phase==='withdraw'||(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&(kidnapDutyExiting261(w,p.id)||object(r.kidnap261)&&r.kidnap261.phase==='carry'))):!r.exiting)){errors.push('Invalid raider mandate.');continue;}
    if(p.prisoner&&(!r.exiting||r.goal!==null))errors.push('Captive retains a raid navigation mandate.');
    const goal=bombRefugeRouteTarget(p,r.goal as {x:number;z:number}|null,version);
    if(!(version>=87&&p.burning)&&!p.prisoner&&p.path.length&&!p.melee&&!p.tactics&&!p.need&&(!goal||p.path.at(-1)!.x!==goal.x||p.path.at(-1)!.z!==goal.z))errors.push('Raid route misses its goal.');
    if(r.exiting&&(p.tactics?.targetId!=null||p.shooting?.order||p.melee?.order&&!p.melee.order.structure))errors.push('Retreating raider retains a human target.');
  }
  errors.push(...validatePhysicalKidnaps261(w,version));
  return errors;
}
