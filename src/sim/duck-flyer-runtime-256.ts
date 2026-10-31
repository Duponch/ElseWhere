import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {wildlifeRandom,MAX_WILDLIFE,type WildAnimal} from './wildlife-state.ts';
import {canAutoExtinguishDuckForHolder256,autoExtinguishDuckForHolder256} from './fire.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {planHeldDuckContentsRetirement256} from './animal-body-retirement-256.ts';
import {isRoofed} from './roof-rules.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {notifyDuckFlightJob256} from './duck-flight-runtime-256.ts';
import {detachDuckTargetOrders256} from './duck-retirement-256.ts';
import {animalNavigation} from './wildlife-navigation.ts';
import {caveRadialPattern256} from './local-cave-radial-256.ts';
import {rotAge} from './food-preservation.ts';
import {neutralLossPlan} from './destruction-losses.ts';
import type {World,Cell} from './types.ts';
import type {DuckFlyer256} from './duck-flyer-state-256.ts';
export interface DuckFlyerServices256 {
 /** Full atomic forced roof transaction, never damageNaturalRoofCell phase1. */
 hitRoof(world:World,cell:Cell,atCore:number):boolean;
}
export const duckPhysicalOwnerCount256=(w:Pick<World,'wildlife'>):number=>(w.wildlife?.animals.length??0)+(w.wildlife?.flyers?.length??0);
/** Original+clock read only. Namespace/map-removal captures must include both IDs. */
export {captureDuckFlyerOwners256} from './duck-owner-capture-256.ts';
/** The held Pawn and its nested contents do not tick inside Skyfaller. Anchor
 * existing food age at the real transfer, without creating or refreshing food. */
function suspendDuckContents256(w:World,a:WildAnimal):void {
 for(const p of w.piles)if(p.owner.type==='inventory'&&p.owner.pawnId===a.id&&p.rot)p.rot={progress:rotAge(p,w.tick),atTick:w.tick,rate:0};
}
export function holdNewDuckArrival256(w:World,a:WildAnimal):boolean {
 const s=w.wildlife;if(w.schemaVersion<256||!s||a.species!=='duck'||!s.animals.includes(a)||a.health!==undefined||a.flight!==undefined||a.burning!==undefined||w.fires?.items.some(f=>f.attachedAnimalId===a.id)||w.piles.some(p=>p.owner.type==='inventory'&&p.owner.pawnId===a.id)||w.packed.some(p=>p.owner.type==='inventory'&&p.owner.pawnId===a.id)||a.domestic||!Number.isSafeInteger(w.nextId+1)||duckPhysicalOwnerCount256(w)>MAX_WILDLIFE)return false;
 const totalCore=600+Math.floor(wildlifeRandom(s)*51),now=w.tick*10;
 const holder:DuckFlyer256={revision:1,id:w.nextId,kind:'arrival',cell:{x:a.x,z:a.z},startedAtCore:now,atCore:now,totalCore,remainingCore:totalCore,personalTick:w.tick,animal:a,roofHit:false};
 w.nextId++;suspendDuckContents256(w,a);s.animals.splice(s.animals.indexOf(a),1);(s.flyers??=[]).push(holder);return true;
}
/** The real flee/exit producer calls once. Override1, like Rand.Chance(1), does
 * not spend a chance draw. Wait is real0..9Core, persisted independently. */
/** Legitimate attached Fire is supported until actual holder addition. An
 * inconsistent source refuses before RNG, identity allocation or path stop. */
export function duckFlyExitUnsupportedReason256(w:World,a:WildAnimal):string|undefined {return a.health?.cryptosleepSickness?'Cryptosleep sickness requires a real active clinical holder clock':canAutoExtinguishDuckForHolder256(w,a)?undefined:'Invalid actual Duck attached Fire owner';}
export function beginDuckFlyExit256(w:World,a:WildAnimal,core:number,cause:'flee'|'exit'):boolean {
 const s=w.wildlife;if(w.schemaVersion<256||a.species!=='duck'||!s||!s.animals.includes(a)||a.state==='dead'||a.state==='downed'||a.domestic||a.manhunter||animalCarrier(w,a.id)||!Number.isSafeInteger(w.nextId+1))return false;
 if(duckFlyExitUnsupportedReason256(w,a))return false;
 if(a.exitFlight)return true;
 if(!Number.isSafeInteger(core)||!Number.isSafeInteger(core+9)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10)||!Number.isSafeInteger((s.exitedAnimals??0)+(s.flyers?.filter(f=>f.kind==='leaving').length??0)+s.animals.filter(other=>!!other.exitFlight).length+1))return false;
 const occupied=a.motion&&a.motion.end>core/10?a.motion.from:a;if(isRoofed(w,occupied.z*w.width+occupied.x))return false;
 if(cause==='flee'&&wildlifeRandom(s)>=.25)return false;
 const wait=Math.floor(wildlifeRandom(s)*10);notifyDuckFlightJob256(w,a,'other',()=>wildlifeRandom(s));
 // A real forced new job stops the pather at the occupied cell. This is not an
 // ordinary mid-edge interruption or completion of the anticipated destination.
 a.x=occupied.x;a.z=occupied.z;for(const fire of w.fires?.items??[])if(fire.attachedAnimalId===a.id){fire.x=a.x;fire.z=a.z;}delete a.animalThermalRefuge288;delete a.motion;a.path=[];delete a.meal;delete a.mating;delete a.eggLay;delete a.animalRest;delete a.flee;delete a.threat;delete a.retaliation;delete a.predation;delete a.exiting;
 a.state='idle';a.nextDecision=w.tick;a.exitFlight={revision:1,startedAtCore:core,readyAtCore:core+wait};return true;
}
/** End-of-step transfer reserves the holder ID BEFORE removing the spawned owner. */
export function commitDuckFlyExits256(w:World):void {
 const s=w.wildlife;if(w.schemaVersion<256||!s)return;const removed=new Set<number>();
 for(const a of s.animals){const job=a.exitFlight;if(!job||job.readyAtCore>w.tick*10)continue;if(a.state==='dead'||a.state==='downed'||a.domestic||animalCarrier(w,a.id)||duckFlyExitUnsupportedReason256(w,a)){delete a.exitFlight;continue;}if(!Number.isSafeInteger(w.nextId+1)||!Number.isSafeInteger((s.exitedAnimals??0)+(s.flyers?.filter(f=>f.kind==='leaving').length??0)+1))continue;
  const now=w.tick*10,flipped=wildlifeRandom(s)<.5,holder:DuckFlyer256={revision:1,id:w.nextId,kind:'leaving',cell:{x:a.x,z:a.z},startedAtCore:now,atCore:now,totalCore:220,remainingCore:220,personalTick:w.tick,animal:a,flipped};
  w.nextId++;detachDuckTargetOrders256(w,a);if(!autoExtinguishDuckForHolder256(w,a))throw Error('Duck attached Fire owner changed during holder commit');suspendDuckContents256(w,a);if(a.wander)delete a.wander.job;delete a.exitFlight;delete a.flight;delete a.taming;delete a.animalThermalRefuge288;delete a.animalRest;a.path=[];delete a.motion;a.state='idle';a.nextDecision=w.tick;(s.flyers??=[]).push(holder);removed.add(a.id);
 }
 if(removed.size)s.animals=s.animals.filter(a=>!removed.has(a.id));
}
function planReleaseArrival(w:World,f:Extract<DuckFlyer256,{kind:'arrival'}>):(()=>void)|undefined {
 const s=w.wildlife!,a=f.animal;
 // This exact producer is healthy; a future clinical incoming producer needs
 // an explicit suspension adapter rather than changing birth/bornAt.
 if(a.health!==undefined||a.flight!==undefined)throw Error('Unsupported clinical Duck arrival producer');
 const nav=animalNavigation(w,false,true,a);let cell:Cell|undefined;
 for(const [dx,dz] of caveRadialPattern256(128).offsets){const c={x:f.cell.x+dx,z:f.cell.z+dz};if(nav.occupy(c)){cell=c;break;}}
 if(!cell){const loss=neutralLossPlan(w,{items:{'duck-corpse':1}});if(!loss)return;return ()=>{w.destroyed=loss;};}
 const destination=cell;return ()=>{a.x=destination.x;a.z=destination.z;a.state='idle';a.path=[];a.nextDecision=w.tick+1;s.animals.push(a);notifyActualExplorationSpawn256(w,a);};
}
export function advanceDuckFlyers256(w:World,services?:DuckFlyerServices256):void {
 let s=w.wildlife;if(w.schemaVersion<256||!s?.flyers?.length)return;const finished=new Set<number>();
 for(const f of s.flyers){const now=w.tick*10;if(f.atCore===now)continue;if(f.atCore!==now-10)throw Error('Duck flyer clock discontinuity');
  for(let core=f.atCore+1;core<=now;core++){
   const left=f.remainingCore-1;
   if(f.kind==='arrival'&&left<=15&&!f.roofHit){if(isRoofed(w,f.cell.z*w.width+f.cell.x)){if(!services)throw Error('Duck arrival requires atomic HitRoof service');if(!services.hitRoof(w,f.cell,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):core)){f.remainingCore=Math.max(0,f.remainingCore-(now-f.atCore));f.atCore=now;break;}s=w.wildlife!;}f.roofHit=true;}
   f.remainingCore=Math.max(0,left);f.atCore=core;
   if(left<=0){const release=f.kind==='arrival'?planReleaseArrival(w,f):undefined,retire=f.kind==='leaving'?planHeldDuckContentsRetirement256(w,f.animal.id):undefined,exits=s.exitedAnimals??0;if(f.kind==='arrival'&&!release||f.kind==='leaving'&&(!retire||!Number.isSafeInteger(exits+1))){f.atCore=now;break;}if(retire&&!retire.commit()){f.atCore=now;break;}s.flyers=s.flyers!.filter(holder=>holder!==f);if(!s.flyers.length)delete s.flyers;if(release)release();else{s.exitedAnimals=exits+1;w.events.push({tick:w.tick,type:'need',message:`Canard ${f.animal.id} a quitté la carte en vol.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);}finished.add(f.id);break;}
  }
 }
 if(finished.size&&s.flyers){s.flyers=s.flyers.filter(f=>!finished.has(f.id));if(!s.flyers.length)delete s.flyers;}
}
