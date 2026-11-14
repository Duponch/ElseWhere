import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {shipCasketHumanReferences277,shipCasketTerminalParticipant277} from './ship-casket-notifications-277.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {sameRaidResult261} from './temp-map-raids-261.ts';
import {validCaravanRaidProvenance261} from './caravan-raid-save-261.ts';
import {validMechComposition} from './mechanoid-raid-save.ts';
import {validComposition} from './raid-save.ts';
import {CASSANDRA_CYCLE_START} from './cassandra-raids.ts';
import {registeredCampaign} from './world-map-context.ts';
import {tempMapRecord261} from './temp-map-incidents-261.ts';
import {validKidnapLord261} from './caravan-kidnap-lord-save-261.ts';
import {validateShipReactorThreats275,validShipReactorRaidSource275,validShipReactorHumanGroup275} from './ship-reactor-threat-save-275.ts';
import type {World} from './types.ts';
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k)!;return typeof k==='string'&&d.enumerable&&Object.hasOwn(d,'value');});
const int=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const fields=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k)));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));return !!d&&d.enumerable&&Object.hasOwn(d,'value');}).every(Boolean);
export function validTempRaidSource261(v:unknown,w:World,members?:readonly number[],atTick=w.tick):boolean {
 const site=tempMapRecord261(w);if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||!site?.tempIncidents261||!plain(v)||!fields(v,['revision','mapId','tile','atCore','factionId','kidnapLord261'])||v.revision!==1||v.mapId!==site.id||v.tile!==site.tile||!int(v.atCore,site.tempIncidents261.adoptedAtCore+1,atTick*10)||v.atCore%1000||!int(v.factionId,1)||!w.worldFactions?.factions.some(f=>f.id===v.factionId&&f.id!==w.worldFactions!.playerFactionId)||!validKidnapLord261(v.kidnapLord261,w,v.atCore/10,members,atTick))return false;
 return ['camp','battlefield'].includes(site.kind)||site.kind==='settlement'&&int((site as typeof site&{settledAt?:number}).settledAt,v.atCore/10,w.tick);
}
/** Supplemental guards never validate old mono state on a manufactured World.
 * All identities remain references to the same local/WorldPawn originals. */
export function validateTempRaidCollections261(w:World,version:number):string[] {
 const s=w.raids;if(!s)return [];const has=(k:string)=>Object.hasOwn(s,k),extra:unknown=has('extraActive261')?s.extraActive261:[],mechanical:unknown=has('extraMechActive261')?s.extraMechActive261:[],results:unknown=s.extraResults261;
 const collectionKeys=['extraActive261','extraMechActive261','extraResults261'];
 if(!collectionKeys.some(has))return collectionKeys.some(k=>k in s)?['Inherited multi-raid state.']:[];
 const marker=tempMapRecord261(w)?.tempIncidents261,ship=isSchema275OrLater(version)&&Object.hasOwn(w,'shipReactorThreats275')&&validateShipReactorThreats275(w,version).length===0;
 if((version!==261&&(Number(version)!==262&&!isSchema263OrLater(Number(version))))||!marker&&!ship||!has('extraResults261')||!has('extraActive261')&&!has('extraMechActive261')||!dense(extra,s.serial)||!dense(mechanical,s.serial)||!dense(results,s.serial)||collectionKeys.some(k=>k in s&&!has(k)||has(k)&&(()=>{const d=Object.getOwnPropertyDescriptor(s,k);return !d||!d.enumerable||!Object.hasOwn(d,'value');})()))return ['Invalid prospective multi-raid owner.'];
 const witnesses=Number(!!s.active)+Number(!!s.mechActive)+extra.length+mechanical.length+results.length;
 const mechanicalProof=!!marker&&witnesses>=2&&(mechanical.length>0||s.mechActive?.source260==='camp-pressure'&&s.mechActive.startedAt*10>marker.adoptedAtCore&&(!!s.active||extra.length>0||results.length>0)||results.some(r=>plain(r)&&r.mechanoid===true&&int(r.tick,Math.floor(marker.adoptedAtCore/10)+1,w.tick)));
 const shipProof=ship&&[...extra,...mechanical,...results].some(r=>plain(r)&&validShipReactorRaidSource275(r.shipReactor275,w));
 if(!shipProof&&(!extra.length&&!results.length&&!mechanicalProof||has('extraMechActive261')&&!mechanicalProof))return ['Multi-raid owner has no actual prospective birth.'];
 const errors:string[]=[],groups=new Set<number>(),members=new Set<number>();
 for(const g of [...s.active?[s.active]:[],...s.mechActive?[s.mechActive]:[]]){if(!plain(g)||!int(g.id,1,s.serial)||!dense(g.members,w.width*w.height))return ['Invalid real primary Lord in multi mode.'];if(groups.has(g.id))errors.push('Primary Lords share one group ID.');groups.add(g.id);for(const id of g.members){if(members.has(id))errors.push('Primary Lords share one original.');members.add(id);}}
 for(const raw of mechanical){
  const reactor=plain(raw)&&Object.hasOwn(raw,'shipReactor275');
  if(!plain(raw)||(reactor?!ship||raw.source260!==undefined||!validShipReactorRaidSource275(raw.shipReactor275,w,w.tick,'mechanoid')||raw.shipReactor275.atCore!==Number(raw.startedAt)*10:!marker||raw.source260!=='camp-pressure')||!int(raw.id,1,s.serial)||groups.has(raw.id)||!int(raw.startedAt,reactor?0:Math.floor(marker!.adoptedAtCore/10)+1,w.tick)||!dense(raw.members,w.width*w.height)||!raw.members.length||!dense(raw.lost,raw.members.length)||!plain(raw.composition)||!dense(raw.composition.roster,raw.members.length)||!plain(raw.stage)){errors.push('Invalid independent mechanical Lord.');continue;}
  groups.add(raw.id);for(const id of raw.members){if(!int(id,1,w.nextId-1)||members.has(id))errors.push('Mechanical Lords share one original.');else members.add(id);}
 }

 for(const raw of extra){
  if(plain(raw)&&Object.hasOwn(raw,'shipReactor275')){
   if(!ship||!validShipReactorHumanGroup275(raw,w)||groups.has(Number(raw.id))){errors.push('Invalid independent ship reactor human Lord.');continue;}
   groups.add(Number(raw.id));
   for(const id of raw.members as number[]){if(members.has(id)){errors.push('Raid Lords share one original.');continue;}members.add(id);const pawn=[...w.pawns,...shipCasketHumanReferences277(w)].find(p=>p.id===id);if(pawn?pawn.raid?.group!==raw.id&&pawn.recruitment?.raidGroup!==raw.id:!s.departed.some(d=>d.group===raw.id&&d.pawnId===id)&&!shipCasketTerminalParticipant277(w,id,'human',Number(raw.id)))errors.push('Ship reactor Lord lost an original participant.');}
   continue;
  }
  if(!plain(raw)||!fields(raw,['id','startedAt','deadline','lossPermille','members','lost','phase','tempIncident261'])||!int(raw.id,1,s.serial)||groups.has(raw.id)||!int(raw.startedAt,0,w.tick)||raw.deadline!==null||raw.lossPermille!==null||raw.phase!=='assault'||!dense(raw.members,w.width*w.height)||!raw.members.length||!raw.members.every(id=>int(id,1,w.nextId-1))||new Set(raw.members).size!==raw.members.length||!dense(raw.lost,raw.members.length)||!raw.lost.every((id,i)=>raw.members instanceof Array&&raw.members.includes(id)&&(i===0||Number(id)>Number((raw.lost as unknown[])[i-1])))||!validTempRaidSource261(raw.tempIncident261,w,raw.members as number[])||!plain(raw.tempIncident261)||raw.tempIncident261.atCore!==raw.startedAt*10){errors.push('Invalid independent TempMap Lord.');continue;}
  groups.add(raw.id);
  for(const id of raw.members as number[]){
   if(members.has(id)){errors.push('Raid Lords share one original.');continue;}members.add(id);
   const pawn=[...w.pawns,...shipCasketHumanReferences277(w)].find(p=>p.id===id),row=registeredCampaign(w).worldPawns?.owners.find(r=>r.actor.id===id);
   if(pawn?pawn.raid?.group!==raw.id&&pawn.recruitment?.raidGroup!==raw.id:row?row.originMapId!==tempMapRecord261(w)!.id:!(raw.lost as number[]).includes(id))errors.push('TempMap Lord lost an unrecorded original.');
  }
 }
 const resultIds=new Set<number>();
 for(const raw of results){
  if(!plain(raw)||!fields(raw,['id','tick','reason','killed','downed','escaped'],['captured','composition','originQuestId','caravan261','memberCount261','mechanoid','mechComposition','tempIncident261',...(isSchema277OrLater(version)?['destroyed277']:[]),...(isSchema275OrLater(version)?['shipReactor275']:[])])||!int(raw.id,1,s.serial)||groups.has(raw.id)||resultIds.has(raw.id)||!int(raw.tick,0,w.tick)||!['defended','withdrawn','colony-down'].includes(String(raw.reason))){errors.push('Invalid retained actual raid result.');continue;}
  resultIds.add(raw.id);
  const temp=Object.hasOwn(raw,'tempIncident261'),caravan=Object.hasOwn(raw,'caravan261'),mech=Object.hasOwn(raw,'mechanoid')||Object.hasOwn(raw,'mechComposition');
  const reactor=Object.hasOwn(raw,'shipReactor275');
  const composition=raw.composition,count=temp||caravan?raw.memberCount261:mech&&plain(raw.mechComposition)&&Array.isArray(raw.mechComposition.roster)?raw.mechComposition.roster.length:plain(composition)&&Array.isArray(composition.roster)?composition.roster.length:raw.id===1?1:2;
  if(!int(count,1,w.nextId-1)||!['killed','downed','escaped'].every(k=>int(raw[k],0,count))||Object.hasOwn(raw,'destroyed277')&&(!isSchema277OrLater(version)||!int(raw.destroyed277,1,count))||Object.hasOwn(raw,'captured')&&!int(raw.captured,1,count)||Number(raw.killed)+Number(raw.downed)+Number(raw.escaped)+Number(raw.captured??0)+Number(raw.destroyed277??0)!==count){errors.push('Retained raid counts do not conserve their actual cohort.');continue;}
  if(reactor&&(!ship||temp||caravan||raw.originQuestId!==undefined||raw.memberCount261!==undefined||!validShipReactorRaidSource275(raw.shipReactor275,w,raw.tick,mech?'mechanoid':'human')))errors.push('Invalid retained ship reactor raid provenance.');
  if(temp){if(reactor||caravan||mech||composition!==undefined||raw.originQuestId!==undefined||raw.reason==='colony-down'||!validTempRaidSource261(raw.tempIncident261,w,undefined,raw.tick)||plain(raw.tempIncident261)&&Number(raw.tempIncident261.atCore)>raw.tick*10)errors.push('Invalid independent TempMap raid result.');}
  else if(caravan){const source=raw.caravan261;if(mech||raw.originQuestId!==undefined||!plain(source)||!int(source.bornAtCore,0,raw.tick*10)||!validCaravanRaidProvenance261(source,w,Number(source.bornAtCore)/10,undefined,raw.tick)||source.kind==='pressure'&&!validComposition(composition,count,version,true,true))errors.push('Invalid retained caravan raid result.');}
  else if(mech){if(raw.mechanoid!==true||!validMechComposition(raw.mechComposition,!!s.mechanoid?.ranged)||!s.mechanoid||raw.tick<s.mechanoid.adoptedAt||raw.reason!=='defended'||raw.downed!==0||raw.escaped!==0||raw.captured!==undefined||Number(raw.killed)+Number(raw.destroyed277??0)!==count||composition!==undefined||raw.originQuestId!==undefined||raw.memberCount261!==undefined)errors.push('Invalid retained mechanical result.');}
  else if(raw.memberCount261!==undefined)errors.push('Unowned retained cohort count.');
  if(!temp&&!mech&&composition!==undefined){
   const quest=raw.originQuestId!==undefined;
   if(quest?(!int(raw.originQuestId,1,w.quests?.serial??0)||!plain(composition)||!fields(composition,['budget','roster'])||composition.budget!==35||!dense(composition.roster,1)||composition.roster.length!==1||composition.roster[0]!=='drifter'):(!reactor&&!caravan&&(raw.tick<CASSANDRA_CYCLE_START||!w.economy||raw.tick<w.economy.adoptedAt)||!validComposition(composition,count,version,true,true,!reactor&&!caravan&&s.profile==='cassandra-raids-v1')))errors.push('Invalid retained real raid composition.');
  }else if(raw.originQuestId!==undefined&&!temp)errors.push('Retained quest lost its actual composition.');
 }
 if(results.length>s.completed)errors.push('Retained results exceed real completions.');
 if(s.last&&!results.some(r=>plain(r)&&r.id===s.last!.id&&sameRaidResult261(r as unknown as import('./raid-state.ts').RaidResult,s.last!)))errors.push('Multi-raid last outcome lacks its true retained result.');
 return errors;
}
