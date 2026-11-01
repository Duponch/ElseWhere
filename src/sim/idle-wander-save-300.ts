import {effectiveCore297} from './core-phase-297.ts';
import type {HumanOwnershipCapture} from './human-owners.ts';
import type {World} from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const malformed=Symbol('malformed idle field');
/** An inherited field, accessor or nonenumerable field is never a task value. */
function data(v:Record<string,unknown>,key:string):unknown {
 const d=Object.getOwnPropertyDescriptor(v,key);
 if(!d)return key in v?malformed:undefined;
 return d.enumerable&&Object.hasOwn(d,'value')?d.value:malformed;
}
function keys(v:Record<string,unknown>,expected:readonly string[]):boolean {
 const actual=Reflect.ownKeys(v);return actual.length===expected.length&&actual.every(key=>typeof key==='string'&&expected.includes(key)&&data(v,key)!==malformed);
}
function length(v:unknown):number|undefined {
 if(!Array.isArray(v))return;
 const d=Object.getOwnPropertyDescriptor(v,'length');return d&&Object.hasOwn(d,'value')&&integer(d.value)?d.value:undefined;
}
export interface IdleWanderOwner300 {readonly core:number;readonly width:number;readonly height:number}
const competing=['priorityWork','draft','interruptedCargo','rescue','animalHandling','animalCare','animalFeed','animalRescue','ward','feed','tend','surgery','hunting','orbitalTrade','deepWork','brewing','research','burial','cleaning','equipmentTask','equipmentDropPending','trade','medicalSleep','collapsePending','flee','bombRefuge','heatRefuge','burning','firefighting','vomiting','allowedAreaReturn','transitExit','coupleTask285','factionComms298','shipCasketTask277','cryptosleepTask','openCasket','firefoamTask290','visitor','raid','prisoner','podRescue'] as const;

/** Shape and actual local owner only. No permission/Native/World validity is
 * minted. Old absence is neutral and the clinical wander bit is never changed. */
export function validIdleWanderPawn300(value:unknown,version:number,owner?:IdleWanderOwner300):boolean {
 try{
  if(!object(value)||!integer(version,1,300))return false;
  if(!('idleWander300'in value))return true;
  if(version!==300||!owner||!integer(owner.core)||!integer(owner.width,1)||!integer(owner.height,1))return false;
  const task=data(value,'idleWander300');if(!object(task))return false;
  const cell=(v:unknown):v is Record<string,unknown>=>object(v)&&keys(v,['x','z'])&&integer(data(v,'x'),0,owner.width-1)&&integer(data(v,'z'),0,owner.height-1);
  const same=(a:Record<string,unknown>,b:Record<string,unknown>)=>data(a,'x')===data(b,'x')&&data(a,'z')===data(b,'z');
  const x=data(value,'x'),z=data(value,'z');if(!integer(x,0,owner.width-1)||!integer(z,0,owner.height-1))return false;
  for(const key of ['jobId','haul','need','cooking'])if(data(value,key)!==null)return false;
  for(const key of competing){const v=data(value,key);if(v!==undefined&&v!==null&&v!==false)return false;}
  // Combat history may persist after its active order/stance/strike. Match
  // allowedAreaOtherActivity without reading an accessor or treating passive
  // combat history as another job. A valid stun suspends, but owns no new job.
  for(const [key,leaves]of [['shooting',['order','stance']],['melee',['order','strike']]] as const){
   const r=data(value,key);if(r===undefined||r===null)continue;if(!object(r))return false;
   for(const leaf of leaves){const v=data(r,leaf);if(v!==undefined&&v!==null&&v!==false)return false;}
  }
  const tactics=data(value,'tactics');if(tactics!==undefined&&tactics!==null){if(!object(tactics))return false;const target=data(tactics,'targetId'),post=data(tactics,'post');if(target!==undefined&&target!==null||post!==undefined&&post!==null&&post!==false)return false;}
  const stun=data(value,'stun');if(stun!==undefined&&stun!==null){
   if(!object(stun)||!keys(stun,['sinceCore','untilCore']))return false;
   const since=data(stun,'sinceCore'),until=data(stun,'untilCore');
   if(!integer(since,0,owner.core)||!integer(until,owner.core+1,owner.core+45)||until-since<45)return false;
  }
  const social=data(value,'social');if(social!==undefined&&social!==null){if(!object(social))return false;const fight=data(social,'fight');if(fight!==undefined&&fight!==null&&fight!==false)return false;}
  const health=data(value,'health');if(health!==undefined&&health!==null){if(!object(health))return false;const death=data(health,'death');if(death!==undefined&&death!==null&&death!==false)return false;}
  const faction=data(value,'faction');if(faction!==undefined&&faction!=='colony')return false;
  const orders=data(value,'orders'),joy=data(value,'recreation'),mental=data(value,'mental');
  if(!object(orders)||data(orders,'active')!==null||length(data(orders,'queue'))!==0||!object(joy)||data(joy,'task')!==null||!object(mental))return false;
  const crisis=data(mental,'crisis'),wander=data(mental,'wander');
  if(crisis!==undefined&&crisis!==null||!object(wander)||typeof data(wander,'nextMoveOrderIsWait')!=='boolean')return false;
  const path=data(value,'path'),count=length(path),motion=data(value,'motion');if(count===undefined)return false;
  let active=false;
  if(motion!==undefined&&motion!==null){if(!object(motion))return false;const start=data(motion,'start'),end=data(motion,'end');if(typeof start!=='number'||!Number.isFinite(start)||typeof end!=='number'||!Number.isFinite(end))return false;active=start<=owner.core/10&&end>owner.core/10;}
  const kind=data(task,'kind');
  if(kind==='wait'){
   const at=data(task,'at');return keys(task,['kind','startedAtCore','expiryIntervalCore','at'])&&integer(data(task,'startedAtCore'),0,owner.core)&&integer(data(task,'expiryIntervalCore'),125,200)&&cell(at)&&data(at,'x')===x&&data(at,'z')===z&&data(value,'state')==='idle'&&data(value,'moveCooldown')===0&&count===0&&!active;
  }
  if(kind!=='move'||!keys(task,['kind','target'])||data(value,'state')!=='moving')return false;
  const target=data(task,'target');if(!cell(target))return false;
  if(count){const d=Object.getOwnPropertyDescriptor(path!,String(count-1));return !!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&cell(d.value)&&same(d.value,target);}
  if(!active||!object(motion))return false;
  const to=data(motion,'to');return cell(to)&&same(to,target)&&x===data(target,'x')&&z===data(target,'z');
 }catch{return false;}
}

/** Reuse the caller's existing owner capture. No second census is created. */
export function validIdleWanderOwners300(w:World,version:number,readOwners:()=>HumanOwnershipCapture):boolean {
 try{
  const local=Number(version)===300?{core:effectiveCore297(w),width:w.width,height:w.height}:undefined;
  for(const slot of readOwners().pawnOwners)if(slot.pawn&&!validIdleWanderPawn300(slot.pawn,version,slot.kind==='map'?local:undefined))return false;
  // These are other owners, never the selected map's local actors.
  for(const row of (w.campaignMap?.revision===2?w.campaignMap.groups:[]))if('members'in row.state)for(const p of row.state.members)if(!validIdleWanderPawn300(p,version))return false;
  for(const loss of (w.campaignMap?.revision===2?w.campaignMap.groupLosses:[]))if(!validIdleWanderPawn300(loss.pawn,version))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!validIdleWanderPawn300(row.actor,version))return false;
  for(const row of w.worldFactions?.leaders??[])if(!validIdleWanderPawn300(row.pawn,version))return false;
  return true;
 }catch{return false;}
}

/** MAIN's already guarded holder containers, without a HumanOwnershipCapture.
 * The task belongs only to the current local map. Held/archive/away copies may
 * retain their ordinary/clinical bit, never a live map wander task. */
export function validIdleWanderProjection300(w:World,version:number):boolean {
 try{
  const local=Number(version)===300?{core:effectiveCore297(w),width:w.width,height:w.height}:undefined;
  const away=(p:unknown)=>validIdleWanderPawn300(p,version);
  const building=(s:Pick<World['structures'][number],'cryptosleep'|'shipCryptosleep277'|'casket'>):boolean=>{
   if(s.cryptosleep?.human&&!away(s.cryptosleep.human))return false;
   if(s.shipCryptosleep277?.occupant?.kind==='human'&&!away(s.shipCryptosleep277.occupant.pawn))return false;
   if(s.casket)for(const p of s.casket.humans)if(!away(p))return false;
   return true;
  };
  const group=(g:NonNullable<World['group']>):boolean=>!('members'in g)||g.members.every(away);
  for(const p of w.pawns)if(!validIdleWanderPawn300(p,version,local))return false;
  for(const s of w.structures)if(!building(s))return false;
  for(const p of w.packed)if(!building(p.building))return false;
  if(w.startingArrival&&w.startingArrival.phase!=='opened')for(const p of w.startingArrival.pods)if(!away(p.pawn))return false;
  if(w.scout&&'pawn'in w.scout&&!away(w.scout.pawn))return false;
  if(w.commercialTrip&&'pawn'in w.commercialTrip&&!away(w.commercialTrip.pawn))return false;
  if(w.group&&!group(w.group))return false;
  for(const l of w.groupLosses??[])if(!away(l.pawn))return false;
  for(const d of w.visitors?.departed??[])if(!away(d.pawn))return false;
  for(const d of w.podRescues?.departed??[])if(!away(d.pawn))return false;
  for(const row of (w.campaignMap?.revision===2?w.campaignMap.groups:[]))if(!group(row.state))return false;
  for(const l of (w.campaignMap?.revision===2?w.campaignMap.groupLosses:[]))if(!away(l.pawn))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!away(row.actor))return false;
  for(const h of w.worldPawns?.heldCaskets259??[])if(!building(h.casket))return false;
  for(const h of w.worldPawns?.heldPlayerCaskets271??[])if(!building(h.casket))return false;
  for(const h of w.worldPawns?.heldShipCaskets277??[])if(!building(h.casket))return false;
  for(const l of w.worldFactions?.leaders??[])if(!away(l.pawn))return false;
  return true;
 }catch{return false;}
}
