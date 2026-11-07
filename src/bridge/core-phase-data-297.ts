import {isCapturedCoreData297} from './native-message-capture';
import {ANIMAL_SPECIES_IDS} from '../sim/animal-species';
import type {World,Pawn} from '../sim/types';
import {registeredMapId,selectedRegisteredMap} from '../sim/world-map-context';
import {campaignAuthority,secondaryContext,selectedMap} from '../sim/secondary-site-context';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PresentationSegment} from '../sim/travel-timing';
import {CORE_HUMAN_REQUIRED297,CORE_HUMAN_OPTIONAL297,CORE_ANIMAL_REQUIRED297,CORE_ANIMAL_OPTIONAL297,CORE_MECH_REQUIRED297,CORE_MECH_OPTIONAL297,
 type CoreActorMode297,type CoreActorProjection297,type CorePhaseAnchor297,type CorePhaseEnvelope297,type CoreProjectileTrace297} from './core-phase-projection-297';

type Data=Record<string,unknown>;
const own=Object.hasOwn;
export const coreInteger297=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
export function coreOwnRecord297(v:unknown):v is Data {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 return Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&own(Object.getOwnPropertyDescriptor(v,k)!,'value'));
}
function exact(v:Data,keys:readonly string[]):boolean{return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>own(v,k));}
function dense(v:unknown):v is unknown[]{if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!own(d,'value'))return false;}return true;}
/** Own-data copy only. It creates no native receipt or renderer input. */
export function copyCoreData297<T>(value:T):T {
 const active=new Set<object>(),budget={left:1048576};
 const copy=(v:unknown,depth:number):unknown=>{
  if(--budget.left<0||depth>24)throw Error('Core phase payload budget exceeded');
  if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Nonfinite Core phase number');return v;}
  if(typeof v!=='object'||active.has(v))throw Error('Cyclic or non-data Core phase value');active.add(v);
  try{
   if(dense(v)){const a=v.map(x=>copy(x,depth+1));return Object.freeze(a);}
   if(!coreOwnRecord297(v))throw Error('Core phase requires plain own data');const out:Data={};
   for(const key of Object.keys(v))Object.defineProperty(out,key,{value:copy(v[key],depth+1),enumerable:true,writable:false,configurable:false});return Object.freeze(out);
  }finally{active.delete(v);}
 };
 return copy(value,0) as T;
}
function fields(kind:CoreActorProjection297['kind']):{required:readonly string[];optional:readonly string[]} {
 return kind==='human'?{required:CORE_HUMAN_REQUIRED297,optional:CORE_HUMAN_OPTIONAL297}:kind==='animal'?{required:CORE_ANIMAL_REQUIRED297,optional:CORE_ANIMAL_OPTIONAL297}:{required:CORE_MECH_REQUIRED297,optional:CORE_MECH_OPTIONAL297};
}
export function captureCoreActor297(kind:'human',index:number,actor:Pawn):CoreActorProjection297;
export function captureCoreActor297(kind:'animal',index:number,actor:WildAnimal):CoreActorProjection297;
export function captureCoreActor297(kind:'mechanical',index:number,actor:Mechanoid):CoreActorProjection297;
export function captureCoreActor297(kind:CoreActorProjection297['kind'],index:number,actor:Pawn|WildAnimal|Mechanoid):CoreActorProjection297 {
 const spec=fields(kind),source=actor as unknown as Data,data:Data={};
 for(const key of [...spec.required,...spec.optional]){const d=Object.getOwnPropertyDescriptor(source,key);if(!d){if(spec.required.includes(key))throw Error('Missing physical actor field');continue;}if(!d.enumerable||!own(d,'value'))throw Error('Physical actor field is not own data');Object.defineProperty(data,key,{value:d.value,enumerable:true,writable:true,configurable:true});}
 return copyCoreData297({kind,id:actor.id,index,fields:data}) as unknown as CoreActorProjection297;
}
/** Actual producer contexts only. A legacy secondary has no registry Map ID;
 * identity with the real weakly bound context supplies1, never a public flag. */
export function coreMapId297(w:World):number {
 const root=campaignAuthority(w);
 if(!root.worldMaps){
  if(w!==root){if(root.secondarySite&&secondaryContext(root)===w)return 1;throw Error('Core map is not its actual legacy secondary context');}
  // Projection headers and mapless roots cannot borrow a physical map ID.
  if(w.campaignMap||!Array.isArray(w.tiles))throw Error('Core map requires its actual local owner');
  return 0;
 }
 const id=registeredMapId(w);if(!coreInteger297(id))throw Error('Missing attested active Core map identity');return id;
}
/** No campaign projection/people capture. Select the actual local owner that
 * the same Engine transaction just stepped; a globe-only campaign has none. */
export function physicalVisibleCoreMap297(w:World):World|undefined {
 const root=campaignAuthority(w);if(root.worldMaps)return selectedRegisteredMap(root);
 return Array.isArray(root.tiles)?selectedMap(root):undefined;
}
export function coreAnchor297(w:World,epoch:number,revision:number,core:number,mapId=coreMapId297(w)):CorePhaseAnchor297 {
 if(!coreInteger297(epoch,1)||!coreInteger297(revision,1)||!coreInteger297(core)||!coreInteger297(mapId)||!coreInteger297(w.width,1)||!coreInteger297(w.height,1)||!coreInteger297(w.nextId,1))throw Error('Invalid Core phase anchor');
 const layout={human:w.pawns.map(a=>a.id),animal:(w.wildlife?.animals??[]).map(a=>a.id),mechanical:(w.mechanoids??[]).map(a=>a.id)};
 const ids=[...layout.human,...layout.animal,...layout.mechanical];if(new Set(ids).size!==ids.length||ids.some(id=>!coreInteger297(id,1,w.nextId-1)))throw Error('Invalid Core phase membership');
 return copyCoreData297({epoch,mapId,revision,core,width:w.width,height:w.height,nextId:w.nextId,layout});
}
const finite=(v:unknown,min=-Infinity,max=Infinity):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function cell(v:unknown,a:CorePhaseAnchor297):boolean{return coreOwnRecord297(v)&&exact(v,['x','z'])&&coreInteger297(v.x,0,a.width-1)&&coreInteger297(v.z,0,a.height-1);}
const motionKeys=['from','to','start','end','terrainDelay','speedFactor','stagger','stuns','animalFlight','snowEntryPending','edgeStart','fromFraction','toFraction','coreMove297','coreMoveWalk297','stop297'];
function segment(v:unknown,a:CorePhaseAnchor297,allowStop=true):v is PresentationSegment {
 if(!coreOwnRecord297(v)||Object.keys(v).some(k=>!motionKeys.includes(k))||!cell(v.from,a)||!cell(v.to,a)||!finite(v.start,0)||!finite(v.end,v.start))return false;
 if(own(v,'stop297'))return allowStop&&v.stop297===true&&exact(v,['from','to','start','end','fromFraction','toFraction','stop297'])&&v.start===v.end&&coreInteger297(Number(v.start)*10)&&v.fromFraction===0&&v.toFraction===0&&(v.from as Data).x===(v.to as Data).x&&(v.from as Data).z===(v.to as Data).z;
 for(const k of ['animalFlight','snowEntryPending','coreMove297','coreMoveWalk297'])if(own(v,k)&&v[k]!==true)return false;
 if(own(v,'coreMoveWalk297')&&v.coreMove297!==true)return false;
 for(const k of ['fromFraction','toFraction'])if(own(v,k)&&!finite(v[k],0,1))return false;
 if(own(v,'edgeStart')&&!finite(v.edgeStart,0,Number(v.start)))return false;
 for(const k of ['speedFactor','terrainDelay'])if(own(v,k)&&!finite(v[k],k==='speedFactor'?Number.MIN_VALUE:0))return false;
 for(const k of ['stagger','stuns'])if(own(v,k)&&(!dense(v[k])||!v[k].every(s=>coreOwnRecord297(s)&&exact(s,['start','end'])&&finite(s.start,0)&&finite(s.end,Number(s.start)))))return false;
 return true;
}
function actor(row:unknown,a:CorePhaseAnchor297):row is CoreActorProjection297 {
 if(!coreOwnRecord297(row)||!exact(row,['kind','id','index','fields'])||!['human','animal','mechanical'].includes(String(row.kind))||!coreInteger297(row.index)||!coreInteger297(row.id,1,a.nextId-1)||!coreOwnRecord297(row.fields))return false;
 const kind=row.kind as CoreActorProjection297['kind'],ids=a.layout[kind];if(ids[row.index]!==row.id)return false;
 const spec=fields(kind),v=row.fields;if(spec.required.some(k=>!own(v,k))||Object.keys(v).some(k=>!spec.required.includes(k)&&!spec.optional.includes(k)))return false;
 if(!coreInteger297(v.x,0,a.width-1)||!coreInteger297(v.z,0,a.height-1)||!dense(v.path)||v.path.length>a.width*a.height||!v.path.every(c=>cell(c,a)))return false;
 if(!['idle','moving','working','eating','sleeping','hungry','downed','dead','resting','recreating'].includes(String(v.state)))return false;
 for(const k of ['moveCooldown','planCooldown','nextDecision'])if(own(v,k)&&!finite(v[k],0))return false;
 if(own(v,'heading')&&!finite(v.heading))return false;
 if(own(v,'motion')&&v.motion!==undefined&&v.motion!==null&&!segment(v.motion,a,false))return false;
 return true;
}
export function validCoreTrace297(v:unknown,a:CorePhaseAnchor297,toCore:number):v is CoreProjectileTrace297 {
 if(!coreOwnRecord297(v)||!exact(v,['id','emittedAtCore','endCore','durationCore','delayCore','from','to','emp'])||!coreInteger297(v.id,1,a.nextId-1)||!coreInteger297(v.emittedAtCore,0,toCore)||!coreInteger297(v.endCore,Number(v.emittedAtCore))||!finite(v.durationCore,.001)||!finite(v.delayCore,0,1)||v.delayCore!==Math.ceil(v.durationCore)-v.durationCore||v.endCore>v.emittedAtCore+Math.ceil(v.durationCore)||typeof v.emp!=='boolean')return false;
 for(const p of [v.from,v.to])if(!coreOwnRecord297(p)||!exact(p,['x','z'])||!finite(p.x)||!finite(p.z))return false;return true;
}
const coreAudioKinds297=new Set(['mining.hit','woodcutting.hit','construction.hit','cooking.work','crafting.work','tailoring.work','butchering.work','research.work','weapon.gunshot','weapon.melee','weapon.impact-ground','weapon.impact-barrier','weapon.impact-flesh','weapon.explosion','door.open','door.close','haul.pickup','haul.drop','farming.sow','farming.harvest','eating.work','cleaning.work','medical.tend','maintenance.work','firefighting.beat','power.switch-on','power.switch-off','deconstruction.work','building.deconstructed','autodoor.open','autodoor.close','weather.thunder','ui.threat','ui.colonist-death','ui.click','ui.reject','ui.panel']);
const audioAnimalSpecies297=new Set<string>(ANIMAL_SPECIES_IDS.filter(s=>s!=='snow-hare'));
function audioKind297(value:string):boolean {if(coreAudioKinds297.has(value)||/^human\.hurt\.(male|female)$/.test(value))return true;const match=/^animal\.(hurt|death)\.([a-z][a-z-]{0,63})$/.exec(value);return !!match&&audioAnimalSpecies297.has(match[2]!)&&!(match[1]==='death'&&match[2]==='red-fox');}
/** Eligibility only; it neither consumes cues nor grants Native admission. */
export function validCoreAudioCues297(cues:unknown,fromCore:number,toCore:number):boolean {
 if(!coreInteger297(fromCore)||!coreInteger297(toCore,fromCore))return false;
 return !(!dense(cues)||cues.length>128||!cues.every(c=>coreOwnRecord297(c)&&exact(c,['id','tick','kind','x','z',...own(c,'intensity')?['intensity']:[]])&&typeof c.id==='string'&&c.id.length>0&&c.id.length<=256&&typeof c.kind==='string'&&audioKind297(c.kind)&&finite(c.tick,fromCore/10,toCore/10)&&finite(c.x)&&finite(c.z)&&(!own(c,'intensity')||finite(c.intensity,0,16))));
}
/** Strict representation validator. Native source, predecessor and rendering
 * authority are checked separately by the private lane owner. */
export function readCorePhaseData297(raw:unknown,a:CorePhaseAnchor297,expectedCore:number,expectedSeq:number,minimumNextId=a.nextId,knownProjectiles:ReadonlySet<number>=new Set(),actorMode:CoreActorMode297='same-civil'):CorePhaseEnvelope297 {
 const v=(isCapturedCoreData297(raw)?raw:copyCoreData297(raw)) as unknown;
 if(!coreOwnRecord297(v)||!exact(v,['type','epoch','mapId','baseRevision','phaseSeq','nextId','fromCore','toCore','speed','actors','tracks','projectiles','audioCues',...own(v,'poses297')?['poses297']:[],...own(v,'doors297')?['doors297']:[],...own(v,'piles297')?['piles297']:[]])||!(v.type==='actor-phase-297'||v.type==='actor-frontier-297'&&actorMode==='frontier')||v.epoch!==a.epoch||v.mapId!==a.mapId||v.baseRevision!==a.revision||v.phaseSeq!==expectedSeq||v.fromCore!==expectedCore||!coreInteger297(v.nextId,minimumNextId)||!coreInteger297(v.toCore,expectedCore)||v.type==='actor-phase-297'&&Math.floor(v.toCore/10)!==Math.floor(a.core/10)||(typeof v.speed!=='number'||![0,1,3,6].includes(v.speed)))throw Error('Invalid Core phase header/predecessor');
 if(!validCoreAudioCues297(v.audioCues,Number(v.fromCore),Number(v.toCore)))throw Error('Invalid confirmed Core audio cues');
 if(!dense(v.actors)||v.actors.length>a.layout.human.length+a.layout.animal.length+a.layout.mechanical.length||!v.actors.every(row=>actor(row,a))||new Set(v.actors.map(row=>Number((row as unknown as Data).id))).size!==v.actors.length)throw Error('Invalid physical actor phase');
 if(!dense(v.tracks)||v.tracks.length>a.nextId||new Set(v.tracks.map(row=>coreOwnRecord297(row)?row.id:undefined)).size!==v.tracks.length)throw Error('Invalid Core motion patches');
 for(const p of v.tracks){if(!coreOwnRecord297(p)||!exact(p,['id','drop','keep','append'])||!coreInteger297(p.id,1,a.nextId-1)||!coreInteger297(p.drop)||!coreInteger297(p.keep)||!dense(p.append)||!p.append.every(s=>segment(s,a)&&(!coreOwnRecord297(s)||s.stop297!==true||Number(s.start)*10<=Number(v.toCore))))throw Error('Invalid Core motion patch');}
 const p=v.projectiles;if(!coreOwnRecord297(p)||!exact(p,['upserted','removed'])||!dense(p.upserted)||!dense(p.removed)||!p.upserted.every(t=>validCoreTrace297(t,{...a,nextId:Number(v.nextId)},Number(v.toCore)))||!p.removed.every(id=>coreInteger297(id,1,Number(v.nextId)-1)&&(knownProjectiles.has(id)||(p.upserted as CoreProjectileTrace297[]).some(t=>t.id===id)))||new Set(p.upserted.map(t=>(t as CoreProjectileTrace297).id)).size!==p.upserted.length||new Set(p.removed).size!==p.removed.length)throw Error('Invalid Core projectile events');
 const births=(p.upserted as CoreProjectileTrace297[]).filter(t=>t.id>=minimumNextId).map(t=>t.id).sort((x,y)=>x-y);
 // A frontier World advances through calm Fulls: ids allocated to non-projectile
 // things (ground traces, items, jobs) are published by the next calm Full.
 // Same-civil phases keep the exact projectile-only allocator contract.
 const allocatorExplained=v.type==='actor-frontier-297'||births.length===Number(v.nextId)-minimumNextId&&births.every((id,i)=>id===minimumNextId+i);
 if(!allocatorExplained||(p.upserted as CoreProjectileTrace297[]).some(t=>t.id<minimumNextId&&!knownProjectiles.has(t.id)))throw Error('Unknown or skipped Core allocator birth');
 if(own(v,'poses297')){const poses=v.poses297;if(v.type!=='actor-frontier-297'||!dense(poses)||poses.length===0||poses.length>a.layout.human.length||!poses.every(row=>humanPose(row,a))||new Set(poses.map(row=>(row as Data).id)).size!==poses.length)throw Error('Invalid Core pose patches');}
 if(own(v,'doors297')){const doors=v.doors297;if(v.type!=='actor-frontier-297'||!dense(doors)||doors.length===0||doors.length>Number(v.nextId)||!doors.every(row=>doorPatch(row,Number(v.nextId)))||new Set(doors.map(row=>(row as Data).id)).size!==doors.length)throw Error('Invalid Core door patches');}
 if(own(v,'piles297')){const piles=v.piles297;if(v.type!=='actor-frontier-297'||!dense(piles)||piles.length===0||piles.length>Number(v.nextId)||!piles.every((row,i)=>pilePatch(row,Number(v.nextId))&&(i===0||Number((row as Data).id)>Number((piles[i-1] as Data).id))))throw Error('Invalid Core pile patches');}
 return v as unknown as CorePhaseEnvelope297;
}
/** Frontier pile patch: an id and the pile's complete own-data record (with
 * its identity, quantity, item, kind and owner), or null once it is gone. */
function pilePatch(row:unknown,nextId:number):boolean {
 if(!coreOwnRecord297(row)||!exact(row,['id','pile'])||!coreInteger297(row.id,1,nextId-1))return false;
 const p=row.pile;if(p===null)return true;
 return coreOwnRecord297(p)&&p.id===row.id&&finite(p.quantity,0)&&typeof p.item==='string'&&typeof p.kind==='string'&&coreOwnRecord297(p.owner)&&typeof p.owner.type==='string';
}
/** Frontier door patch: an id and the door's own-data state, of which the
 * renderer animates open/from/changedAt (and an autodoor duration). */
function doorPatch(row:unknown,nextId:number):boolean {
 if(!coreOwnRecord297(row)||!exact(row,['id','door'])||!coreInteger297(row.id,1,nextId-1))return false;
 const d=row.door;
 return coreOwnRecord297(d)&&typeof d.open==='boolean'&&finite(d.from,0,1)&&finite(d.changedAt,0)&&(!own(d,'duration')||finite(d.duration,0));
}
/** Frontier pose patch: an anchored human slot, its complete own-data record,
 * the referenced job (or null) and the Worker contact (pose, reach, facing). */
function humanPose(row:unknown,a:CorePhaseAnchor297):boolean {
 if(!coreOwnRecord297(row)||!exact(row,['id','index','actor','job','workPose','reach','yaw']))return false;
 if(!coreInteger297(row.id,1,a.nextId-1)||!coreInteger297(row.index,0,a.layout.human.length-1)||a.layout.human[row.index]!==row.id)return false;
 if(!coreOwnRecord297(row.actor)||row.actor.id!==row.id)return false;
 if(row.job!==null&&!(coreOwnRecord297(row.job)&&coreInteger297(row.job.id,1)))return false;
 const reach=row.reach;
 return coreInteger297(row.workPose,0,1023)&&coreOwnRecord297(reach)&&exact(reach,['x','z'])&&finite(reach.x,-4,4)&&finite(reach.z,-4,4)&&(row.yaw===null||finite(row.yaw));
}
