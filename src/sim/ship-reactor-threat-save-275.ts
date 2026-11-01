import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {shipReactorThreatMap275,shipReactorThreatSeed275,shipReactorGenerationInterval275,shipReactorCycleHits275} from './ship-reactor-threats-275.ts';
import {registeredCampaign} from './world-map-context.ts';
import {validComposition} from './raid-save.ts';
import type {World} from './types.ts';
import type {ShipReactorRaidSource275} from './ship-reactor-threats-275.ts';
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const fields=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k)));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));return !!d?.enumerable&&Object.hasOwn(d,'value');}).every(Boolean);
const budget=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=500&&v<=10000;
function actualOpportunity(w:World,atCore:number,cycle:number):boolean {
 const owner=w.shipReactorThreats275;if(!owner)return false;const interval=atCore/1000-shipReactorGenerationInterval275(owner.generationAtCore);
 return interval>=0&&cycle===Math.floor(interval/90)&&shipReactorCycleHits275(owner.seed,cycle).includes(interval%90);
}
/** Historical provenance remains independent of a reactor's current presence. */
export function validShipReactorRaidSource275(v:unknown,w:World,atTick=w.tick,kind?:'human'|'mechanoid'):v is ShipReactorRaidSource275 {
 const owner=w.shipReactorThreats275,map=shipReactorThreatMap275(w);
 if(!isSchema275OrLater(w.schemaVersion)||!plain(owner)||!map||owner.mapId!==map.mapId||owner.tile!==map.tile||owner.generationAtCore!==map.generationAtCore||owner.seed!==shipReactorThreatSeed275(w,map.mapId)||!int(owner.adoptedAtCore,map.generationAtCore,w.tick*10)||!plain(v)||!fields(v,['revision','mapId','tile','atCore','cycle','points','factionId'])||v.revision!==1||v.mapId!==owner.mapId||v.mapId!==map.mapId||v.tile!==owner.tile||v.tile!==map.tile||!int(v.atCore,owner.adoptedAtCore,atTick*10)||v.atCore%1000||!int(v.cycle)||!budget(v.points)||!actualOpportunity(w,v.atCore,v.cycle))return false;
 const factions=registeredCampaign(w).worldFactions;
 if(v.factionId===null){if(factions||kind==='mechanoid')return false;}
 else {const faction=factions?.factions.find(f=>f.id===v.factionId);if(!int(v.factionId,1)||!faction||kind&&faction.def!==(kind==='mechanoid'?'Mechanoid':'Pirate'))return false;}
 return true;
}
export function validateShipReactorThreats275(w:World,version:number=w.schemaVersion):string[] {
 const own=Object.getOwnPropertyDescriptor(w,'shipReactorThreats275');if(!own)return 'shipReactorThreats275'in w?['Inherited ship reactor pressure owner.']:[];
 const state:unknown=own.value,map=shipReactorThreatMap275(w),now=w.tick*10;
 if(!isSchema275OrLater(version)||!own.enumerable||!Object.hasOwn(own,'value')||!plain(state)||!fields(state,['revision','mapId','tile','generationAtCore','adoptedAtCore','active','seed','rng','checkedAtCore','opportunities','spawned','recent'],['lastFaction'])||state.revision!==1||!map||state.mapId!==map.mapId||state.tile!==map.tile||state.generationAtCore!==map.generationAtCore||!int(state.adoptedAtCore,map.generationAtCore,now)||state.adoptedAtCore%10||typeof state.active!=='boolean'||state.seed!==shipReactorThreatSeed275(w,map.mapId)||!int(state.rng,1,0xffffffff)||!int(state.checkedAtCore,Math.floor((state.adoptedAtCore-1)/1000)*1000,Math.floor(now/1000)*1000)||state.checkedAtCore%1000||!int(state.opportunities)||!int(state.spawned,0,state.opportunities)||!dense(state.recent,32)||state.recent.length>state.opportunities||state.lastFaction!==undefined&&!['outlaws','mechanoid'].includes(String(state.lastFaction)))return ['Invalid or future ship reactor pressure owner.'];
 const recent=state.recent;let successes=0;const births=new Map<number,{atCore:number;mechanical:boolean}>();
 for(const group of [...w.raids?.extraActive261??[],...w.raids?.extraMechActive261??[],...w.raids?.extraResults261??[]])if(group?.shipReactor275)births.set(group.id,{atCore:group.shipReactor275.atCore,mechanical:'stage'in group||'mechanoid'in group&&group.mechanoid===true});
 for(let i=0;i<recent.length;i++){
  const e=recent[i];if(!plain(e)||!fields(e,['atCore','cycle','points','result'],['raidId'])||!int(e.atCore,state.adoptedAtCore,state.checkedAtCore)||e.atCore%1000||i>0&&e.atCore<=Number((recent[i-1] as Record<string,unknown>).atCore)||!int(e.cycle)||!budget(e.points)||!actualOpportunity(w,e.atCore,e.cycle)||!['failed','human','mechanoid'].includes(String(e.result))||(e.result==='failed'?Object.hasOwn(e,'raidId'):!int(e.raidId,1,w.raids?.serial??0)))return ['Invalid actual ship reactor pressure event.'];
  if(e.result!=='failed'){const birth=births.get(Number(e.raidId));if(!birth||birth.atCore!==e.atCore||birth.mechanical!==(e.result==='mechanoid'))return ['Ship reactor event lost its actual raid provenance.'];successes++;}
 }
 if(successes>state.spawned||state.opportunities===0&&(state.spawned!==0||state.lastFaction!==undefined)||state.spawned>0&&(!w.raids||state.spawned>w.raids.serial)||state.spawned===0&&state.lastFaction!==undefined)return ['Ship reactor pressure counters lack their actual births.'];
 return [];
}
/** Delta-only continuity after full next-world validation. A map replacement
 * is a checkpoint and has no predecessor here; cold RAW cannot prove history. */
export function validShipReactorThreatContinuation275(previous:Pick<World,'schemaVersion'|'tick'|'shipReactorThreats275'>,next:Pick<World,'schemaVersion'|'tick'|'shipReactorThreats275'>):boolean {
 if(!int(previous.schemaVersion,1,300)||!int(next.schemaVersion,1,300)||!int(previous.tick)||!int(next.tick,previous.tick))return false;
 const a=previous.shipReactorThreats275,b=next.shipReactorThreats275;
 if(!a)return !b||b.adoptedAtCore>=previous.tick*10;
 if(!b||a.revision!==b.revision||a.mapId!==b.mapId||a.tile!==b.tile||a.generationAtCore!==b.generationAtCore||a.adoptedAtCore!==b.adoptedAtCore||a.seed!==b.seed
  ||b.checkedAtCore<a.checkedAtCore||b.opportunities<a.opportunities||b.spawned<a.spawned)return false;
 const added=b.opportunities-a.opportunities,births=b.spawned-a.spawned;
 if(births>added||added===0&&a.rng!==b.rng||births===0&&a.lastFaction!==b.lastFaction)return false;
 // New occurrences append once, retaining the overlapping suffix when the
 // 32-row window prunes its oldest entries. Work is bounded by that window.
 const retained=Math.min(a.recent.length,Math.max(0,32-added)),drop=a.recent.length-retained;
 if(b.recent.length!==Math.min(32,a.recent.length+added))return false;
 for(let i=0;i<retained;i++){
  const old=a.recent[drop+i]!,row=b.recent[i]!;
  if(old.atCore!==row.atCore||old.cycle!==row.cycle||old.points!==row.points||old.result!==row.result||old.raidId!==row.raidId)return false;
 }
 for(let i=retained;i<b.recent.length;i++)if(b.recent[i]!.atCore<=a.checkedAtCore)return false;
 return true;
}
export function validShipReactorHumanGroup275(v:unknown,w:World):boolean {
 if(!plain(v)||!fields(v,['id','startedAt','deadline','lossPermille','members','lost','phase','composition','shipReactor275'],['reason'])||!int(v.id,1,w.raids?.serial??0)||!int(v.startedAt,0,w.tick)||!int(v.deadline,v.startedAt+2600,v.startedAt+3800)||!int(v.lossPermille,400,700)||!dense(v.members,w.width*w.height)||!v.members.length||!v.members.every(id=>int(id,1,w.nextId-1))||new Set(v.members).size!==v.members.length||!dense(v.lost,v.members.length)||!v.lost.every((id,i)=>(v.members as unknown[]).includes(id)&&(i===0||Number(id)>Number((v.lost as unknown[])[i-1])))||!validComposition(v.composition,v.members.length,275,true,true)||!validShipReactorRaidSource275(v.shipReactor275,w,w.tick,'human')||v.shipReactor275.atCore!==v.startedAt*10)return false;
 if(v.phase==='assault')return v.reason===undefined;
 return v.phase==='withdraw'&&['losses','timeout','colony-down'].includes(String(v.reason))&&(v.reason!=='timeout'||w.tick>=v.deadline)&&(v.reason!=='losses'||v.lost.length*1000>=v.members.length*v.lossPermille);
}
