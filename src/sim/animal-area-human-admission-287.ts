import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign} from './world-map-context.ts';
import {PRIORITY_WORK_TICKS} from './priority-work-state.ts';
import {removalWritesMutable259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import type {Pawn,World} from './types.ts';

type Fields=Record<string,unknown>;
const object=(v:unknown):v is object=>v!==null&&typeof v==='object';

/** Admission for the existing human half of a prospective animal-area edit.
 * This neither executes release providers nor fabricates a World for them.
 * Carry/pair/rope and overdue clinical notifications need their own composed
 * transaction; ordinary jobs, queues and cargo retain their actual owners. */
export function animalAreaHumanPhaseMutable287(world:World,affected:readonly Pawn[],releasedIds:ReadonlySet<number>):boolean {
 const root=registeredCampaign(world),version=Object.getOwnPropertyDescriptor(root,'schemaVersion');
 if(!version||!Object.hasOwn(version,'value'))return false;
 if(Number.isInteger(version.value)&&version.value>=1&&version.value<=286)return true;
 if(!isSchema287OrLater(version.value))return false;
 const cache=new WeakMap<object,Fields|undefined>();
 const fields=(v:unknown):Fields|undefined=>{
  if(!object(v)||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return;
  if(cache.has(v))return cache.get(v);
  const out:Fields=Object.create(null);cache.set(v,undefined);
  for(const key of Reflect.ownKeys(v)){
   const d=Object.getOwnPropertyDescriptor(v,key);
   if(typeof key!=='string'||!d||!Object.hasOwn(d,'value'))return;
   out[key]=d.value;
  }
  cache.set(v,out);return out;
 };
 const list=(v:unknown):unknown[]|undefined=>{
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype)return;
  const length=Object.getOwnPropertyDescriptor(v,'length');
  if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<0)return;
  const result:unknown[]=[];
  for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!Object.hasOwn(d,'value'))return;result.push(d.value);}
  if(Reflect.ownKeys(v).length!==length.value+1)return;
  return result;
 };
 // Only actor records are walked, never a map, its terrain or campaign census.
 // Read-only/frozen clinical histories are harmless when no clinical update runs.
 const dataSeen=new Set<object>();
 const data=(value:unknown):boolean=>{
  const todo:unknown[]=[value];
  while(todo.length){const v=todo.pop();if(!object(v)||dataSeen.has(v))continue;dataSeen.add(v);
   const values=Array.isArray(v)?list(v):fields(v);if(!values)return false;
   for(const child of Array.isArray(values)?values:Object.values(values))if(object(child))todo.push(child);
  }
  return true;
 };
 // Registered maps intentionally forward shared fields through getters. Read
 // only their actual local data slots, and the real root's clock data slots.
 const pick=(v:object,keys:readonly string[]):Fields|undefined=>{const out:Fields=Object.create(null);
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return;out[key]=d.value;}return out;
 };
 const map=pick(world,['pawns','jobs','piles','packed','events']),header=pick(root,['tick']);
 if(!map||!header||!Number.isSafeInteger(header.tick))return false;
 const people=list(map.pawns),jobs=list(map.jobs),piles=list(map.piles),packs=list(map.packed),selected=list(affected);
 if(!people||!jobs||!piles||!packs||!selected)return false;
 const writes:MapRemovalWrite259[]=[],set=(o:object,key:string)=>writes.push({object:o,key,present:true}),del=(o:object,key:string)=>writes.push({object:o,key,present:false});
 const records=new Map<object,Fields>();
 for(const p of people){const f=fields(p);if(!f||!data(p))return false;records.set(p as object,f);}
 const selectedSet=new Set<object>();
 for(const p of selected){if(!object(p)||!records.has(p))return false;selectedSet.add(p);}
 for(const id of releasedIds)if(!people.some(p=>records.get(p as object)!.id===id&&selectedSet.has(p as object)))return false;
 const jobRecords=new Map<unknown,{job:object;fields:Fields}>();
 for(const job of jobs){const j=fields(job);if(!j)return false;jobRecords.set(j.id,{job:job as object,fields:j});}
 const releaseJob=(job:object,j:Fields,full:boolean):boolean=>{
  del(job,'installationWork');del(job,'clearance');set(job,'reservedBy');set(job,'status');
  if(!full)return true;
  del(job,'pickTicks');
  const tree=j.tree===undefined?undefined:fields(j.tree),repair=j.repair===undefined?undefined:fields(j.repair);
  if(j.tree!==undefined&&!tree||j.repair!==undefined&&!repair)return false;
  const reset=tree?.kind==='replant'||typeof j.kind==='string'&&['smooth-floor','remove-bridge','remove-floor','flick','repair','fix-breakdown','mine','sow','deconstruct','build-roof','remove-roof'].includes(j.kind)||!!j.furniture;
  if(tree?.kind==='replant'){set(j.tree as object,'phase');set(j.tree as object,'carryPileId');set(j.tree as object,'workCore');del(j.tree as object,'durationCore');}
  if(repair)del(j.repair as object,'warmed');
  if(reset){set(job,'progress');del(job,'workRemainder');}
  return true;
 };
 const deleted=['priorityWork','interruptedCargo','allowedAreaReturn','brewing','orbitalTrade','deepWork','animalHandling','animalCare','animalFeed','burial','cleaning','trade','firefighting','ward','heatRefuge','research','tend','feed','medicalSleep','equipmentTask','shipCasketTask277','cryptosleepTask','rescue','animalRescue','surgery','hunting','openCasket','transitExit'];
 let eventsNeeded=false;
 for(const p of people){
  const pawn=p as object,f=records.get(pawn)!,orders=fields(f.orders),recreation=fields(f.recreation);
  if(!orders||!recreation)return false;
  const queue=list(orders.queue);if(!queue)return false;
  const selected=selectedSet.has(pawn),released=selected&&releasedIds.has(f.id as number);
  const priority=f.priorityWork===undefined?undefined:fields(f.priorityWork);
  if(priority&&typeof priority.startedAt==='number'&&(header.tick as number)-priority.startedAt>=PRIORITY_WORK_TICKS)del(pawn,'priorityWork');
  if(orders.active!==null)set(f.orders as object,'active');
  if(queue.length||released)set(f.orders as object,'queue');
  for(const id of queue){const row=jobRecords.get(id);if(row&&row.fields.reservedBy===f.id&&!releaseJob(row.job,row.fields,false))return false;}
  if(!released&&queue.some(id=>typeof id!=='number'))eventsNeeded=true;
  if(!selected)continue;
  set(pawn,'path');set(pawn,'planCooldown');set(pawn,'needCooldown');
  if(f.allowedAreaReturn){del(pawn,'allowedAreaReturn');if(f.state==='moving')set(pawn,'state');}
  if(!released)continue;
  const handling=f.animalHandling===undefined?undefined:fields(f.animalHandling),raid=f.raid===undefined?undefined:fields(f.raid);
  const rescue=f.rescue===undefined?undefined:fields(f.rescue),crypt=f.cryptosleepTask===undefined?undefined:fields(f.cryptosleepTask),ship=f.shipCasketTask277===undefined?undefined:fields(f.shipCasketTask277);
  if(f.coupleTask285||f.animalRescue||handling?.kind==='lead'||raid?.kidnap261||rescue?.phase==='carry'
   ||crypt?.action==='carry'&&(crypt.phase==='carry'||crypt.phase==='closing')||ship?.action==='carry'&&(ship.phase==='carry'||ship.phase==='closing'))return false;
  const need=f.need==null?undefined:fields(f.need),health=f.health===undefined?undefined:fields(f.health);
  if(need?.kind==='sleep'&&need.medical&&health&&!health.death){const civil=health.civilTick271??health.tick;if(typeof civil!=='number'||civil<(header.tick as number))return false;}
  for(const key of deleted)del(pawn,key);
  for(const key of ['jobId','haul','cooking','need','path','planCooldown','needCooldown'])set(pawn,key);
  if(f.state!=='dead'&&f.state!=='downed')set(pawn,'state');
  set(f.orders as object,'active');set(f.recreation as object,'task');
  const rest=need?.roomRest===undefined?undefined:fields(need.roomRest),leisure=recreation.task==null?undefined:fields(recreation.task);
  if(need?.kind==='sleep'&&need.phase==='sleep'&&rest?.applied||leisure&&typeof leisure.activity==='string'&&['horseshoes','chess','watch-television','hoopstone','billiards','game-of-ur','poker'].includes(leisure.activity)&&leisure.phase==='active'&&typeof leisure.elapsed==='number'&&leisure.elapsed>0){set(pawn,'roomMemories');del(pawn,'roomMemories');}
  const shooting=f.shooting===undefined?undefined:fields(f.shooting),melee=f.melee===undefined?undefined:fields(f.melee);
  const shootingOrder=shooting?.order==null?undefined:fields(shooting.order),meleeOrder=melee?.order==null?undefined:fields(melee.order);
  if(shootingOrder?.auto||shootingOrder?.hunt){const stance=shooting?.stance==null?undefined:fields(shooting.stance);if(stance?.phase==='cooldown')set(f.shooting as object,'order');else del(pawn,'shooting');}
  if(meleeOrder?.auto){if(melee?.strike)set(f.melee as object,'order');else del(pawn,'melee');}
  const surgery=f.surgery===undefined?undefined:fields(f.surgery);
  if(surgery?.consumedMedicine){const patient=people.find(q=>records.get(q as object)!.id===surgery.patientId);if(patient)del(patient as object,'surgeryRequest');}
  const active=jobRecords.get(f.jobId);if(active&&active.fields.reservedBy===f.id&&!releaseJob(active.job,active.fields,true))return false;
 }
 for(const item of [...piles,...packs]){const row=fields(item);if(!row)return false;const owner=fields(row.owner);if(!owner)return false;
  if(owner.type==='pawn'&&releasedIds.has(owner.pawnId as number))set(item as object,'owner');
 }
 if(eventsNeeded){const events=list(map.events);if(!events||!object(map.events)||!Object.isExtensible(map.events)||Object.getOwnPropertyDescriptor(map.events,'length')?.writable!==true)return false;
  for(let i=0;i<events.length;i++){const d=Object.getOwnPropertyDescriptor(map.events,String(i));if(!d?.writable||!d.configurable)return false;}
 }
 return removalWritesMutable259(writes);
}

/** The Home caller also runs the existing maintenance reconcilers, wakes idle
 * planners, refreshes stock and appends an event. Its future Home mask is not
 * this API's input, so admit the union of their possible existing recipients.
 * Physical drop locations still belong to the caller's common-floor plan. */
export function animalAreaHomePhaseMutable287(world:World):boolean {
 const root=registeredCampaign(world),version=Object.getOwnPropertyDescriptor(root,'schemaVersion');
 if(!version||!Object.hasOwn(version,'value'))return false;
 if(Number.isInteger(version.value)&&version.value>=1&&version.value<=286)return true;
 if(!isSchema287OrLater(version.value))return false;
 const fields=(value:unknown):Fields|undefined=>{
  if(!object(value)||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return;
  const result:Fields=Object.create(null);
  for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d||!Object.hasOwn(d,'value'))return;result[key]=d.value;}
  return result;
 };
 const slot=(value:object,key:string):unknown=>{const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
 const list=(value:unknown):unknown[]|undefined=>{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return;
  const length=slot(value,'length');if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||Reflect.ownKeys(value).length!==length+1)return;
  const result:unknown[]=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value'))return;result.push(d.value);}return result;
 };
 const people=list(slot(world,'pawns')),jobs=list(slot(world,'jobs')),piles=list(slot(world,'piles')),structures=list(slot(world,'structures')),events=slot(world,'events'),eventRows=list(events);
 if(!people||!jobs||!piles||!structures||!eventRows||!object(events))return false;
 const writes:MapRemovalWrite259[]=[{object:world,key:'stock',present:true}],set=(o:object,key:string)=>writes.push({object:o,key,present:true});
 const maintenance=new Set<unknown>();
 for(const job of jobs){const f=fields(job);if(!f)return false;set(job as object,'escrow');if(f.repair||f.fixBreakdown)maintenance.add(f.id);}
 const release:Pawn[]=[];
 for(const p of people){const f=fields(p);if(!f)return false;
  const haul=f.haul==null?undefined:fields(f.haul),destination=haul?fields(haul.destination):undefined;
  if(f.haul!=null&&(!haul||!destination))return false;
  const jobId=destination?.type==='job'?destination.jobId:destination?.type==='aside'?destination.constructionId:undefined;
  if(maintenance.has(f.jobId)||jobId!==undefined&&maintenance.has(jobId))release.push(p as Pawn);
  if(f.jobId===null&&f.haul===null)set(p as object,'planCooldown');
  if(maintenance.size){if(!object(f.orders)||!fields(f.orders))return false;set(f.orders,'queue');}
 }
 if(!animalAreaHumanPhaseMutable287(world,release,new Set(release.map(p=>slot(p,'id') as number))))return false;
 if(maintenance.size)set(world,'jobs');
 for(const pile of piles){const f=fields(pile),owner=f?fields(f.owner):undefined;if(!f||!owner)return false;if(owner.type==='job'&&maintenance.has(owner.jobId))set(pile as object,'owner');}
 let creates=false,breakdown=false;
 for(const structure of structures){const f=fields(structure);if(!f)return false;if(f.damage||f.breakdown)creates=true;if(f.breakdown)breakdown=true;}
 if(creates){
  const array=slot(world,'jobs');if(!object(array)||!Object.isExtensible(array)||Object.getOwnPropertyDescriptor(array,'length')?.writable!==true)return false;
  // Shared counters on a registered map are real root data, not the forwarding
  // accessor. The actual reconciler's setter writes this precise root slot.
  set(root,'nextId');
 }
 if(breakdown)for(const p of people)set(p as object,'planCooldown');
 // event() appends then may splice the old prefix. Existing indices and length
 // must support both; same-value writes still require actual writable slots.
 if(!Object.isExtensible(events)||Object.getOwnPropertyDescriptor(events,'length')?.writable!==true)return false;
 for(let i=0;i<eventRows.length;i++){const d=Object.getOwnPropertyDescriptor(events,String(i));if(!d?.writable||!d.configurable)return false;}
 return removalWritesMutable259(writes);
}
