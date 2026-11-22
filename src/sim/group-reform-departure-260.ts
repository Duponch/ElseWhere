import {preparePartyRelease292} from './party-release-292.ts';
import { wallDoorImplicitOrphan296 } from './wall-door-state-296.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {prepareCoupleRelease285} from './couple-release-285.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import type {World,Pawn,MaterialPile,Cell,Job} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {WorldGroupRecord} from './world-map-state.ts';
import type {AwayGroup} from './group-capture.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {isColonist} from './affiliation.ts';
import {registeredCampaign} from './world-map-context.ts';
import {clearReleasedPawnAssignments259,releasePawnJob259,reformHumanOrigin260} from './work-release.ts';
import {releaseAllowedAreaReturn} from './allowed-area-state.ts';
import {finishRoomRest,rememberRoomUse} from './room-experience.ts';
import {cancelAutomaticCombat} from './automatic-combat-state.ts';
import {cancelHunting} from './hunting-state.ts';
import {createPrisonerState} from './prisoner-state.ts';
import {commitCapturedGuest259} from './world-affiliation-259.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {rememberActorBedDeparture256} from './actor-map-bed-256.ts';
import {planCurrentMapArea} from './pawn-map-areas.ts';
import {removalWritesMutable259,sealRemovalOriginal259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
export interface ReformDeparture260 {
 readonly ids:ReadonlySet<number>;readonly packedIds:ReadonlySet<number>;readonly nextId:number;
 readonly items:ReadonlyMap<number,MaterialPile|null>;readonly people:readonly Pawn[];
 readonly coupleWrites285:readonly MapRemovalWrite259[];
 valueAfter(object:object,key:string):unknown;
 seal(areas?:readonly MapRemovalWrite259[],beds?:readonly MapRemovalWrite259[]):(stage:0|1|2)=>boolean;
 current():boolean;begin():void;commit():void;
}
export interface ReformDepartureInput260 {
 humanOrigins?:ReadonlyMap<number,Cell>;
 people:Pawn[];animals:WildAnimal[];captured:ReadonlySet<number>;drops:ReadonlyMap<number,Cell>;inventoryDrops:ReadonlyMap<number,Cell>;
 transfers:{original:MaterialPile;next:MaterialPile;fragment?:MaterialPile}[];intrinsic:MaterialPile[];
 packs:PackedFurniture[];packUpdates:{original:PackedFurniture;next:PackedFurniture}[];
 next:AwayGroup;record:WorldGroupRecord;nextId:number;mapId:number;
}
/** One concrete Reform write set. No World copy, temporary owner, replay or
 * generic permission to mutate a Pawn. Every value below belongs to the already
 * admitted release/transfer; all source links and descriptors are sealed first. */
export function prepareReformDeparture260(w:World,input:ReformDepartureInput260):ReformDeparture260 {
 const root=registeredCampaign(w),groups=root.worldGroups!,planet=root.planet!,{people,animals,captured,drops,inventoryDrops,transfers,intrinsic,packs,packUpdates,next,record,nextId,mapId}=input;
 const ids=new Set([...people,...animals].map(p=>p.id)),packedIds=new Set(packs.map(p=>p.building.id)),writes:MapRemovalWrite259[]=[];
 const put=(object:object,key:string,value:unknown,present=true)=>{const at=writes.findIndex(r=>r.object===object&&r.key===key),r={object,key,present,...present?{value}:{}};if(at<0)writes.push(r);else writes[at]=r;};
 const del=(object:object,key:string)=>put(object,key,undefined,false);
 const own=(o:object,k:string)=>Object.getOwnPropertyDescriptor(o,k)?.value;
 const after=(o:object,k:string)=>{const r=writes.find(r=>r.object===o&&r.key===k);return r?r.present?r.value:undefined:own(o,k);};
 // Reform always retires its actual Camp: all originals leave this local Party.
 const party=preparePartyRelease292(w,new Set(w.pawns.map(p=>p.id)),{finish:true});
 for(const r of party.writes)put(r.object,r.key,r.value,r.present);
 const couple=prepareCoupleRelease285(w,ids);
 for(const r of couple.writes)put(r.object,r.key,r.value,r.present);
 const bed=captureActorBeds256(root),jobDrafts=new Map<Job,Job>();
 const jobCopy=(job:Job)=>{let draft=jobDrafts.get(job);if(!draft){draft=structuredClone(job);jobDrafts.set(job,draft);}return draft;};
 const deleted=['priorityWork','interruptedCargo','orbitalTrade','deepWork','animalHandling','animalCare','animalFeed','burial','cleaning','trade','firefighting','ward','heatRefuge','research','tend','feed','medicalSleep','equipmentTask','rescue','animalRescue','surgery','hunting','openCasket','transitExit','allowedAreaId','allowedAreaReturn','motion'];
 for(const p of people){
  const actual=reformHumanOrigin260(w,p),origin=input.humanOrigins?input.humanOrigins.get(p.id):actual;
  if(!origin||origin.x!==actual.x||origin.z!==actual.z)throw Error('Reform human origin differs from its actual occupied cell');
  // StopDead's coordinates are part of the sealed write set, before removal
  // of motion/path. The original Pawn is never substituted by its draft.
  put(p,'x',origin.x);put(p,'z',origin.z);
  // These are the pre-existing Reform admission boundaries, not a new service.
  if(p.surgery||p.rescue||p.animalRescue||p.animalHandling?.kind==='lead')throw Error('Reform release still owns a cross-actor notifier');
  // Living local clinical records are already required at this actual clock by
  // validatePawnHealthRecord; never advance clinical state in a Reform preview.
  if(p.need?.kind==='sleep'&&p.need.medical&&p.health&&!p.health.death&&medicalCivilTick271(p.health)<w.tick)throw Error('Reform medical source must have its actual current clinical clock');
  for(const job of w.jobs)if(p.orders.queue.includes(job.id)&&jobCopy(job).reservedBy===p.id){const d=jobCopy(job);delete d.clearance;delete d.installationWork;d.reservedBy=null;d.status='pending';}
  const active=w.jobs.find(j=>j.id===p.jobId);if(active)releasePawnJob259(jobCopy(active),p.id);
  const d=couple.project(p),oldMemories=d.roomMemories;
  d.x=origin.x;d.z=origin.z;delete d.motion;d.path=[];d.moveCooldown=0;
  if((Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))){delete d.draft;del(p,'draft');}
  releaseAllowedAreaReturn(d);finishRoomRest(w,d);
  const task=d.recreation.task;if((task?.activity==='horseshoes'||task?.activity==='chess'||task?.activity==='watch-television'||task?.activity==='hoopstone'||task?.activity==='billiards'||task?.activity==='game-of-ur'||task?.activity==='poker'||task?.activity==='view-art')&&task.phase==='active'&&task.elapsed>0)rememberRoomUse(w,d,'recreation');
  cancelAutomaticCombat(d);cancelHunting(d);clearReleasedPawnAssignments259(d);
  for(const key of deleted)del(p,key);
  for(const key of ['jobId','haul','cooking','need','state','planCooldown','needCooldown'] as const)put(p,key,d[key]);
  put(p,'planCooldown',0);put(p,'path',[]);put(p,'moveCooldown',0);put(p.orders,'active',null);put(p.orders,'queue',[]);put(p.recreation,'task',null);
  if(d.roomMemories!==oldMemories){if(d.roomMemories)put(p,'roomMemories',d.roomMemories.map(m=>{const i=oldMemories?.indexOf(m)??-1;return i<0?m:p.roomMemories![i];}));else del(p,'roomMemories');}
  if(captured.has(p.id)){d.prisoner=createPrisonerState(w,d);commitCapturedGuest259(w,d);d.bedId=null;delete d.bedSlot;put(p,'prisoner',d.prisoner);put(p,'worldAffiliation259',d.worldAffiliation259);del(p,'prisonerHistory259');del(p,'draft');del(p,'flee');del(p,'equipmentDropPending');}
  if(p.allowedAreaId!==undefined)put(p,'mapAreas',planCurrentMapArea(w,p,p.allowedAreaId));
  rememberActorBedDeparture256(d,mapId,bed.refs,w.schemaVersion);
  if(d.mapBed!==undefined){const same=p.mapBed&&d.mapBed.bedId===p.mapBed.bedId&&d.mapBed.mapId===p.mapBed.mapId&&d.mapBed.slot===p.mapBed.slot;put(p,'mapBed',same?p.mapBed:d.mapBed);}else if(p.mapBed!==undefined)del(p,'mapBed');
  put(p,'bedId',null);del(p,'bedSlot');
  const prisoner=captured.has(p.id)?d.prisoner:p.prisoner;
  if(prisoner){del(prisoner,'escape');if(prisoner.breakout)del(prisoner.breakout,'active');del(p,'raid');del(p,'visitor');}
 }
 const retiredWallJobs=new Set<Job>();
 for(const [job,d] of jobDrafts){
  if(d.reservedBy===null&&wallDoorImplicitOrphan296(d)){retiredWallJobs.add(job);continue;}
  if(job.wallDoor296){if(d.wallDoor296)put(job,'wallDoor296',d.wallDoor296);else del(job,'wallDoor296');}
  for(const key of ['clearance','installationWork','reservedBy','status','pickTicks','progress','workRemainder'] as const){if(Object.hasOwn(d,key))put(job,key,d[key]&&typeof d[key]==='object'?job[key]:d[key]);else del(job,key);}
  if(job.tree?.kind==='replant'&&d.tree?.kind==='replant')for(const key of ['phase','carryPileId','workCore','durationCore'] as const){if(Object.hasOwn(d.tree,key))put(job.tree,key,d.tree[key]);else del(job.tree,key);}
  if(job.repair&&d.repair&&!Object.hasOwn(d.repair,'warmed'))del(job.repair,'warmed');
 }
 if(retiredWallJobs.size)put(w,'jobs',w.jobs.filter(j=>!retiredWallJobs.has(j)));
 for(const a of animals){
  const d=structuredClone(a);rememberActorBedDeparture256(d,mapId,bed.refs,w.schemaVersion);
  if(d.mapBed!==undefined){const same=a.mapBed&&d.mapBed.bedId===a.mapBed.bedId&&d.mapBed.mapId===a.mapBed.mapId;put(a,'mapBed',same?a.mapBed:d.mapBed);}else if(a.mapBed!==undefined)del(a,'mapBed');
  if(a.domestic){del(a.domestic,'bedId');del(a.domestic,'penMarkerId');}if(a.wander)del(a.wander,'job');
  for(const key of ['animalThermalRefuge288','motion','animalRest','meal','eggLay','flight','stagger','stun','sleepUntilCore',...(isSchema287OrLater(w.schemaVersion)?['animalAreaReturn287']:[])])del(a,key);
  put(a,'path',[]);if(a.state!=='downed')put(a,'state','idle');put(a,'nextDecision',w.tick);
 }
 // Release the same work/equipment holders to the cells already preflighted.
 for(const pile of w.piles)if(pile.owner.type==='pawn'&&ids.has(pile.owner.pawnId)||pile.owner.type==='equipment'&&captured.has(pile.owner.pawnId)){const c=drops.get(pile.id);if(!c)throw Error('Reform work drop lost its admitted cell');put(pile,'owner',{type:'ground',...c});}
 for(const pack of w.packed)if(pack.owner.type==='pawn'&&ids.has(pack.owner.pawnId)){const c=drops.get(pack.building.id);if(!c)throw Error('Reform furniture drop lost its admitted cell');put(pack,'owner',{type:'ground',...c});}
 for(const [id,cell] of inventoryDrops){const pile=w.piles.find(p=>p.id===id),pack=w.packed.find(p=>p.building.id===id);if(pile)put(pile,'owner',{type:'ground',...cell});else if(pack)put(pack,'owner',{type:'ground',...cell});else throw Error('Reform inventory drop source disappeared');}
 const originals=new Map<number,MaterialPile>(intrinsic.map(p=>[p.id,p]));
 for(const t of transfers){if(t.fragment){put(t.original,'quantity',t.next.quantity);originals.set(t.fragment.id,t.fragment);}else {
  put(t.original,'owner',t.next.owner);
  if(Number(w.schemaVersion)>=298){
   // Staging cleaned the moved clone. Seal the same deletion on the real
   // whole original when reconnecting its identity to the departing holder.
   for(const key of ['forbidden','eggForbidden'] as const)if(Object.hasOwn(t.original,key)&&!Object.hasOwn(t.next,key))del(t.original,key);
   if(t.original.apparel&&t.next.apparel&&!Object.hasOwn(t.next.apparel,'forbidden')&&Object.hasOwn(t.original.apparel,'forbidden'))del(t.original.apparel,'forbidden');
   if(t.original.weapon&&t.next.weapon&&!Object.hasOwn(t.next.weapon,'forbidden')&&Object.hasOwn(t.original.weapon,'forbidden'))del(t.original.weapon,'forbidden');
  }
  originals.set(t.original.id,t.original);
 }}
 next.items=next.items.map(p=>originals.get(p.id)!);if(next.items.some(p=>!p))throw Error('Reform future holder has no original');
 for(const p of packUpdates)put(p.original,'owner',p.next.owner);if(packs.length)next.packed=packs;
 const taken=new Set(next.items),fragments=transfers.flatMap(t=>t.fragment?[t.fragment]:[]);
 put(w,'pawns',w.pawns.filter(p=>!ids.has(p.id)));if(w.wildlife)put(w.wildlife,'animals',w.wildlife.animals.filter(a=>!ids.has(a.id)));
 const localPiles=[...w.piles,...fragments].filter(p=>!taken.has(p));put(w,'piles',localPiles);put(w,'packed',w.packed.filter(p=>!packedIds.has(p.building.id)));
 // refreshStock's exact existing wood/food effects, prepared on these actual
 // future owners. No copied World and no later unsealed escrow replacement.
 const stock={wood:0,food:0},delivered=new Map(w.jobs.map(j=>[j.id,{wood:0,food:0}]));
 for(const p of localPiles){if(p.kind!=='wood'&&p.kind!=='food')continue;const owner=after(p,'owner') as MaterialPile['owner'],quantity=after(p,'quantity') as number;
  if(owner.type==='job'){const d=delivered.get(owner.jobId);if(d)d[p.kind]+=quantity;}
  else if(owner.type==='ground'||(owner.type==='pawn'||owner.type==='equipment'||owner.type==='apparel')&&w.pawns.some(q=>!ids.has(q.id)&&q.id===owner.pawnId&&isColonist(q)))stock[p.kind]+=quantity;
 }
 put(w,'stock',stock);for(const j of w.jobs)put(j,'escrow',delivered.get(j.id)!);
 put(root,'nextId',nextId);put(planet,'nextGroupId',planet.nextGroupId+1);put(groups,'groups',[...groups.groups,record]);put(groups,'selectedGroupId',next.id);
 const scope={pawns:w.pawns,animals:w.wildlife?.animals,piles:w.piles,packed:w.packed,jobs:w.jobs,structures:w.structures,groups:groups.groups};
 const tick=root.tick,rng=root.rng,schema=root.schemaVersion,worldGroups=root.worldGroups,worldMaps=root.worldMaps;
 const stamps=writes.map(r=>Object.getOwnPropertyDescriptor(r.object,r.key));
 const stable=()=>root.tick===tick&&root.rng===rng&&root.schemaVersion===schema&&root.worldGroups===worldGroups&&root.worldMaps===worldMaps&&root.planet===planet;
 const graph=sealRemovalOriginal259(scope,writes,[]);
 const slots=(afterWrites:readonly MapRemovalWrite259[])=>writes.every((r,i)=>{const final=[...afterWrites].reverse().find(w=>w.object===r.object&&w.key===r.key),d=Object.getOwnPropertyDescriptor(r.object,r.key);if(final)return final.present?!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&Object.is(d.value,final.value):d===undefined;const old=stamps[i];return !!d===!!old&&(!d||Object.hasOwn(d,'value')&&d.enumerable===old!.enumerable&&d.writable===old!.writable&&d.configurable===old!.configurable&&Object.is(d.value,old!.value));});
 let phase:'prepared'|'begun'|'departed'='prepared';
 const current=()=>phase==='prepared'&&stable()&&party.current()&&couple.current()&&removalWritesMutable259(writes)&&slots([])&&graph(0);
 if(!current())throw Error('Reform originals or write recipients cannot be admitted');
 return {ids,packedIds,nextId,people,coupleWrites285:couple.writes,items:new Map(transfers.map(t=>[t.original.id,t.fragment?t.next:null])),valueAfter:after,
  seal(areas=[],beds=[]){const all=[...writes,...areas],check=sealRemovalOriginal259(scope,all,beds);return stage=>stable()&&slots(stage===0?[]:stage===1?all:[...all,...beds])&&check(stage);},
  current,begin(){if(!current())throw Error('Stale Reform before first mutation');phase='begun';},
  commit(){if(phase!=='begun')throw Error('Reform departure admission was not consumed');for(const r of writes){if(r.present){if(!Reflect.set(r.object,r.key,r.value))throw Error('Admitted Reform write failed');}else if(!Reflect.deleteProperty(r.object,r.key))throw Error('Admitted Reform deletion failed');}phase='departed';if(!stable()||!slots(writes)||!graph(1))throw Error('Reform produced an unplanned departure');}
 };
}
