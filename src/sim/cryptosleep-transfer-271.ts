import {filterPileEntries} from './pile-identity-directory.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,heldCore297,captureOccupiedHeldCore297,suspensionDeltas297,type SuspensionClock297} from './core-phase-297.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {isPlayerCasket271,newCryptosleepHolder271,cryptosleepInteraction271,type PlayerCasket271} from './cryptosleep-state-271.ts';
import {cryptosleepHuman271,cryptosleepActorCapable271} from './cryptosleep-intent-271.ts';
import {prepareSuspendedHumanResume271,medicalCivilTick271} from './suspended-human-clock-271.ts';
import {planPawnDrops,releaseWork} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {nearbyGround} from './ground-placement.ts';
import {canStandAt} from './furniture-travel.ts';
import {refreshStock} from './materials.ts';
import {reconcilePawnHealth} from './health.ts';
import {createMedicalRecord} from './injury-state.ts';
import {cancelAlcoholSpatial265} from './alcohol-state-265.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import {cancelCryptosleepVomit256,addCryptosleepSickness256} from './cryptosleep-sickness-256.ts';
import {ancientCasketEjectionRandom256} from './ancient-casket-release-256.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import type {MaterialPile,Pawn,World,Cell} from './types.ts';
import type {PackedFurniture} from './furniture-rules.ts';

export type CryptosleepTransferPlan271={ok:false;reason:string}|{ok:true;commit():boolean};
const fail=(reason:string):CryptosleepTransferPlan271=>({ok:false,reason});
const personal=(p:MaterialPile,id:number)=>['inventory','equipment','apparel'].includes(p.owner.type)&&'pawnId'in p.owner&&p.owner.pawnId===id;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const installed=(w:World,c:PlayerCasket271)=>isSchema271OrLater(w.schemaVersion)&&isPlayerCasket271(c)&&w.structures.includes(c);
/** Only cold owner transitions seal whole records. Ordinary ticks, transport
 * and rendering neither clone nor enumerate these suspended originals. */
const seal=(p:Pawn,items:readonly MaterialPile[],packed:readonly PackedFurniture[])=>JSON.stringify([p,items,packed]);
type Write={object:object;key:string;before:number|undefined;after:number;present:boolean};
export function prepareCryptosleepPossessionsResume271(items:readonly MaterialPile[],packs:readonly PackedFurniture[],delta:number,physical297?:SuspensionClock297){
 if(!Number.isSafeInteger(delta)||delta<0||!Number.isSafeInteger(delta*10))throw Error('Invalid actual possession suspension interval');
 const deltaCore297=physical297===undefined?{civil:delta,core:delta*10}:suspensionDeltas297(Math.floor(Number(Object.getOwnPropertyDescriptor(physical297,'heldAtCore297')?.value)/10),Math.floor(Number(Object.getOwnPropertyDescriptor(physical297,'targetCore297')?.value)/10),physical297);if(deltaCore297.civil!==delta)throw Error('Possession civil/physical owner mismatch');
 const writes:Write[]=[];
 const add=(o:object,k:string,d:number)=>{const before=(o as Record<string,unknown>)[k];if(typeof before!=='number'||!Number.isSafeInteger(before)||!Number.isSafeInteger(before+d))throw Error('Possession suspension clock exhausted');writes.push({object:o,key:k,before,after:before+d,present:true});};
 for(const p of items){
  if(p.rot)add(p.rot,'atTick',delta);if(p.egg)add(p.egg,'atTick',delta);if(p.humanCorpse?.nextBileTick!==undefined)add(p.humanCorpse,'nextBileTick',delta);
  if(p.plantPack&&delta){const tree=p.plantPack,old=tree.suspendedTicks271;if(!Number.isSafeInteger((old??0)+delta))throw Error('Actual tree suspension clock exhausted');writes.push({object:tree,key:'suspendedTicks271',before:old,after:(old??0)+delta,present:Object.hasOwn(tree,'suspendedTicks271')});if(tree.pendingExpiry)add(tree.pendingExpiry,'retryAt',delta);}
 }
 // Packed batteries retain the same remaining disable interval while their
 // comp does not tick. All factual Thing IDs and quantities remain unchanged.
 for(const p of packs)if(p.building.emp){add(p.building.emp,'sinceCore',deltaCore297.core);add(p.building.emp,'untilCore',deltaCore297.core);}
 let done=false;const current=()=>!done&&writes.every(v=>Object.hasOwn(v.object,v.key)===v.present&&(v.object as Record<string,unknown>)[v.key]===v.before);
 return {current,commit(){if(!current())return false;done=true;for(const v of writes)(v.object as Record<string,unknown>)[v.key]=v.after;return true;}};
}
/** The transfer consumes work already earned by a real service at contact.
 * A directly called plan cannot insert or open a distant original. */
function completedService271(w:World,c:PlayerCasket271,p:Pawn,opening=false){
 const worker=w.pawns.find(q=>{const t=q.cryptosleepTask;return t?.casketId===c.id&&t.lastWorkedAt===w.tick&&t.progressCore===(opening?300:500)&&(opening?t.action==='open'&&t.phase==='opening':t.phase==='closing'&&(t.action==='enter'&&q===p||t.action==='carry'&&t.patientId===p.id));});
 if(!worker||!cryptosleepActorCapable271(w,worker))return;
 const task=worker.cryptosleepTask!,cell=cryptosleepInteraction271(c),taskStamp=JSON.stringify(task);
 const current=()=>w.pawns.includes(worker)&&worker.cryptosleepTask===task&&JSON.stringify(task)===taskStamp&&cryptosleepActorCapable271(w,worker)&&worker.x===cell.x&&worker.z===cell.z&&worker.moveCooldown===0&&(worker.motion?.end??0)<=w.tick&&!worker.path.length;
 return current()?{current}:undefined;
}
export function planCryptosleepEntry271(w:World,c:PlayerCasket271,p:Pawn):CryptosleepTransferPlan271 {
 const preparedCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined;
 if(!installed(w,c)||c.cryptosleep.human||!w.pawns.includes(p)||!cryptosleepHuman271(p)||p.cryptosleepHeldAt271!==undefined)return fail('Le caisson exige son véritable occupant local vivant.');
 if(p.health&&medicalCivilTick271(p.health)!==w.tick)return fail('La dernière étape médicale du patient doit être achevée.');
 if(p.mental?.crisis||p.social?.fight||p.burning||p.flee||p.stun)return fail('Terminez la crise ou l’état physique du patient avant le cryptosommeil.');
 const service=completedService271(w,c,p);if(!service)return fail('La fermeture doit être achevée au contact du caisson.');
 const items=w.piles.filter(i=>personal(i,p.id)),packed=w.packed.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id);
 const drops=planPawnDrops(w,new Set([p.id]));if(!drops)return fail('La cargaison de travail doit pouvoir être déposée.');
 const tick=w.tick,rng=w.rng,nextId=w.nextId,holder=c.cryptosleep,pawns=w.pawns,piles=w.piles,packs=w.packed,stamp=seal(p,items,packed),building=JSON.stringify([c.id,c.x,c.z,c.orientation,c.footprint,c.material]);let done=false;
 return {ok:true,commit(){
  if(done||isCorePhysicalSchema297(Number(w.schemaVersion))&&effectiveCore297(w)!==preparedCore297||w.tick!==tick||w.rng!==rng||w.nextId!==nextId||!installed(w,c)||c.cryptosleep!==holder||holder.human||w.pawns!==pawns||w.piles!==piles||w.packed!==packs||!w.pawns.includes(p)||seal(p,items,packed)!==stamp||JSON.stringify([c.id,c.x,c.z,c.orientation,c.footprint,c.material])!==building||!service.current())return false;
  const actualItems=w.piles.filter(i=>personal(i,p.id)),actualPacked=w.packed.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id);
  if(actualItems.length!==items.length||actualItems.some((i,n)=>i!==items[n])||actualPacked.length!==packed.length||actualPacked.some((i,n)=>i!==packed[n]))return false;
  if(!releaseWork(w,p,drops,true))return false;done=true;clearQueuedOrders(w,p);delete p.priorityWork;
  // DeSpawn ends spatial jobs, never their disease or factual history.
  if(p.health){cancelAlcoholSpatial265(p.health);cancelToxicVomit256(p.health);cancelCryptosleepVomit256(p.health);for(const illness of [p.health.foodPoisoning,p.health.flu,p.health.immuneDiseases?.malaria])if(illness)delete illness.vomit;}
  delete p.motion;delete p.medicalSleep;delete p.draft;delete p.shooting;delete p.melee;delete p.bombRefuge;delete p.heatRefuge;delete p.allowedAreaReturn;delete p.transitExit;
  p.path=[];p.moveCooldown=0;p.planCooldown=0;p.collapsePending=false;p.restZeroTicks=0;p.cryptosleepHeldAt271=tick;
  if(p.state!=='downed')p.state='idle';
  c.cryptosleep={revision:1,heldAt:tick,...isCorePhysicalSchema297(Number(w.schemaVersion))?captureOccupiedHeldCore297(w):{},human:p,items,packed};
  // Replace arrays: the engine's opening population is a stable borrowed view.
  w.pawns=w.pawns.filter(q=>q!==p);w.piles=filterPileEntries(w.piles,i=>!items.includes(i));w.packed=w.packed.filter(i=>!packed.includes(i));refreshStock(w);return true;
 }};
}
/** Opening needs a real local worker; destruction callers own their separate
 * building transaction and never receive Open's sickness or Slime. */
export function planCryptosleepRelease271(w:World,c:PlayerCasket271,mode:'open'|'deconstruct'|'kill-finalize'='open'):CryptosleepTransferPlan271 {
 const preparedCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined;
 if(!installed(w,c)||!c.cryptosleep.human)return fail('Le caisson occupé doit être présent sur sa véritable carte.');
 const h=c.cryptosleep,p=h.human!,items=h.items,packed=h.packed;
 if(p.cryptosleepHeldAt271!==h.heldAt||w.pawns.some(q=>q.id===p.id)||w.piles.some(i=>items.some(j=>j.id===i.id))||w.packed.some(i=>packed.some(j=>j.building.id===i.building.id)))return fail('Le détenteur réel ou ses biens ont changé.');
 const occupied=(cell:Cell)=>w.pawns.some(q=>same(q,cell)||q.motion&&(q.motion.end>effectiveLocal297(w))&&(same(q.motion.from,cell)||same(q.motion.to,cell)))||!!w.wildlife?.animals.some(a=>same(a,cell))||!!w.mechanoids?.some(a=>same(a,cell));
 const origin=mode==='open'?cryptosleepInteraction271(c):c,cell=nearbyGround(w,origin).find(v=>canStandAt(w,v)&&!occupied(v));
 if(!cell)return fail('Aucune case réelle ne permet de sortir l’occupant.');
 if(w.pawns.length>=w.width*w.height||w.piles.length+items.length>32768||w.packed.length+packed.length>32768)return fail('La capacité de la carte ne permet pas cette sortie.');
 const service=mode==='open'?completedService271(w,c,p,true):undefined;if(mode==='open'&&!service)return fail('L’ouverture doit être achevée au contact du caisson.');
 let humanClock:ReturnType<typeof prepareSuspendedHumanResume271>,itemClock:ReturnType<typeof prepareCryptosleepPossessionsResume271>;
 const physical297:SuspensionClock297|undefined=isCorePhysicalSchema297(Number(w.schemaVersion))?{version:297,heldAtCore297:heldCore297(h,297,h.heldAt),targetCore297:preparedCore297!}:undefined;
 try{humanClock=prepareSuspendedHumanResume271(p,h.heldAt,w.tick,physical297);itemClock=prepareCryptosleepPossessionsResume271(items,packed,w.tick-h.heldAt,physical297);}catch(error){return fail(String(error));}
 const tick=w.tick,rng=w.rng,nextId=w.nextId,stamp=seal(p,items,packed),pawns=w.pawns,piles=w.piles,packs=w.packed,building=JSON.stringify([c.id,c.x,c.z,c.orientation,c.footprint,c.material]);let done=false;
 return {ok:true,commit(){
  if(done||isCorePhysicalSchema297(Number(w.schemaVersion))&&effectiveCore297(w)!==preparedCore297||!installed(w,c)||c.cryptosleep!==h||h.human!==p||w.tick!==tick||w.rng!==rng||w.nextId!==nextId||w.pawns!==pawns||w.piles!==piles||w.packed!==packs||seal(p,items,packed)!==stamp||JSON.stringify([c.id,c.x,c.z,c.orientation,c.footprint,c.material])!==building||mode==='open'&&!service!.current()||!humanClock.current()||!itemClock.current()||occupied(cell)||!canStandAt(w,cell))return false;
  done=true;if(!humanClock.commit()||!itemClock.commit())throw Error('Cryptosleep originals changed within synchronous commit');
  delete p.cryptosleepHeldAt271;Object.assign(p,cell);w.pawns=[...w.pawns,p];w.piles=[...w.piles,...items];w.packed=[...w.packed,...packed];c.cryptosleep=newCryptosleepHolder271(tick);
  if(mode==='open'){
   p.health??=createMedicalRecord(tick);addCryptosleepSickness256(p.health,ancientCasketEjectionRandom256(w),w.schemaVersion);
   const feet=p.filthFeet??={carried:[]},slime=feet.carried.find(f=>f.kind==='slime');if(slime)slime.thickness=Math.min(5,slime.thickness+1);else feet.carried.push({kind:'slime',thickness:1});
  }
  reconcilePawnHealth(w,p);notifyActualExplorationSpawn256(w,p);refreshStock(w);return true;
 }};
}
