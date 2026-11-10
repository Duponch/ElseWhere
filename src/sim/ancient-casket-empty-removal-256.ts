import {assignPileOwner} from './pile-index.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isAncientCasket256,type AncientCasket256} from './ancient-casket-state-256.ts';
import {validAncientCasketBuilding256} from './ancient-casket-physical-256.ts';
import {planSelectedDrops,releaseWork} from './work-release.ts';
import {refreshStock} from './materials.ts';
import {prepareRemovedFogStructure256,commitRemovedFogBlocker256} from './exploration-runtime-256.ts';
import {releaseStructureMelee} from './melee-state.ts';
import {healthRandom} from './health.ts';
import {blockedCells} from './pathfinding.ts';
import {addFilth} from './filth.ts';
import {ensureFireState} from './fire-rules.ts';
import {deconstructionAvailable,deconstructionDuration} from './deconstruction-rules.ts';
import {workProgress} from './work-progress.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {isColonist} from './affiliation.ts';
import type {StructureDamageCause,StructureDamageContext} from './thing-damage.ts';
import type {Cell,World,Structure} from './types.ts';
import {prepareAncientCasketLeavings256,commitAncientCasketLeavings256} from './ancient-casket-leavings-256.ts';
import {ANCIENT_CASKET_FLAME_RADIUS_256,ancientDamageInstigator256} from './ancient-casket-explosive-state-256.ts';
import {shipChunkNextRandom256} from './ship-chunk-leavings-256.ts';
import {planAncientCasketRelease256} from './ancient-casket-release-256.ts';
import {captureBombCells} from './bomb-cells.ts';
import {reconcileTemperature} from './temperature.ts';
import type {MiniTurretBombWave} from './bomb-state.ts';
import type {BombInstigatorKey} from './mini-turret-state.ts';

export const actualEmptyCasket256=(s:AncientCasket256):boolean=>s.casket.humans.length===0&&s.casket.animals.length===0&&s.casket.items.length===0;
// Runtime spans a Core substep inside the new map tick; RAW's end-of-tick
// wick deadline is checked by full admission, not before its due owner slot.
const validActual=(w:World,s:Structure):s is AncientCasket256=>isAncientCasket256(s)&&w.structures.includes(s)&&w.structures.filter(b=>b.id===s.id).length===1&&validAncientCasketBuilding256(s,w.schemaVersion,w)&&s.casket.heldAt<=w.tick;
const valid=(w:World,s:Structure):s is AncientCasket256=>validActual(w,s)&&actualEmptyCasket256(s);
const stamp=(v:unknown)=>JSON.stringify(v);
const int=(n:number)=>Number.isSafeInteger(n)&&n>=0;
type Removal={ok:false;reason:string}|{ok:true;commit():boolean};
/** Actual gameplay boundary only. No fake map, historical reallocation or
 * unowned refund. References are captured until this one synchronous commit. */
export function planEmptyAncientCasketRemoval256(w:World,s:Structure,mode:'vanish'|'deconstruct'|'kill-finalize',explosion?:{core:number;instigatorKey?:BombInstigatorKey},damageRng=w.rng):Removal {
 if(!valid(w,s))return {ok:false,reason:'A real completely empty ancient casket is required; DamageUntilDowned/contents destruction is not substituted.'};
 if(explosion&&(mode!=='kill-finalize'||!int(explosion.core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?explosion.core!==effectiveCore297(w):explosion.core<Math.max(0,(w.tick-1)*10)||explosion.core>w.tick*10)||(w.bombWaves?.length??0)>=w.width*w.height))return {ok:false,reason:'Actual casket explosion owner/clock/capacity is unavailable.'};
 if(!Number.isSafeInteger(damageRng)||damageRng<0||damageRng>0xffffffff)return {ok:false,reason:'Invalid actual leaving stream.'};
 const jobs=w.jobs.filter(j=>j.repair?.structureId===s.id||j.deconstruction?.structureId===s.id||j.furniture?.structureId===s.id||j.fixBreakdown?.structureId===s.id||j.flick?.structureId===s.id),ids=new Set(jobs.map(j=>j.id));
 if(mode==='deconstruct'){
  const j=jobs.find(j=>j.kind==='deconstruct'&&j.deconstruction?.structureId===s.id),p=j?w.pawns.find(p=>p.id===j.reservedBy&&p.jobId===j.id):undefined;
  if(!j||!p||!isColonist(p)||p.prisoner||p.draft||p.burning||p.stun&&p.stun.untilCore>w.tick*10||medicalWorkRefusal(p)||p.mental?.crisis||p.state!=='working'||p.moveCooldown!==0||(p.motion?.end??0)>w.tick||Math.abs(p.x-j.x)+Math.abs(p.z-j.z)!==1||workProgress(j)<deconstructionDuration(j)||!deconstructionAvailable(w,j,p.id))return {ok:false,reason:'Actual completed paid deconstruction/contact/reservation is required.'};
 }
 // Foreign delivered ingredients are not casket contents; keep the operation
 // closed instead of destroying those originals with their reservation.
 if(w.piles.some(p=>p.owner.type==='job'&&ids.has(p.owner.jobId)))return {ok:false,reason:'Actual delivered job contents require their original cancellation transaction.'};
 const actors=w.pawns.filter(p=>p.jobId!==null&&ids.has(p.jobId)||p.haul?.destination.type==='job'&&ids.has(p.haul.destination.jobId)||p.openCasket?.casketId===s.id);
 const drops=planSelectedDrops(w,ids,new Set(actors.map(p=>p.id)));if(!drops)return {ok:false,reason:'Original worker cargo has no real floor place.'};
 // Only mutable physical piles/wrappers are previewed, never terrain/actors,
 // clock, map generation, medical records or the World campaign itself.
 const view:World={...w,structures:w.structures.filter(b=>b!==s),jobs:w.jobs.filter(j=>!ids.has(j.id)).map(j=>({...j,escrow:{...j.escrow}})),piles:w.piles.map(p=>({...p,owner:{...p.owner}})),packed:w.packed.map(p=>({...p,owner:{...p.owner}})),filth:w.filth?{...w.filth,items:w.filth.items.map(f=>({...f}))}:undefined};
 for(const p of view.piles){const at=drops.get(p.id);if(at)assignPileOwner(p,{type:'ground',...at});}
 for(const p of view.packed){const at=drops.get(p.building.id);if(at)assignPileOwner(p,{type:'ground',...at});}
 const products=mode==='vanish'?undefined:prepareAncientCasketLeavings256(view,s,mode,mode==='deconstruct'?w.rng:damageRng);
 if(products===null)return {ok:false,reason:'Actual casket leavings have no physical Near/permission/ID destination; source retained.'};
 let ledger=w.deconstructed,destroyed=w.destroyed;
 if(mode==='deconstruct'){
  const steel=products!.entries.find(e=>e.item==='steel')!.quantity,uranium=products!.entries.find(e=>e.item==='uranium')!.quantity;
  const count=ledger.count+1,lostSteel=(ledger.lostSteel??0)+180-steel,lostUranium=(ledger.lostUranium??0)+5-uranium;
  if(![count,lostSteel,lostUranium].every(int))return {ok:false,reason:'Actual deconstruction loss counter exhausted.'};
  ledger={...ledger,count,lostSteel,lostUranium};
 }else if(mode==='kill-finalize'){
  const prior=destroyed??{count:0,lost:{}},count=prior.count+1,lost={...prior.lost,steel:(prior.lost.steel??0)+155,uranium:(prior.lost.uranium??0)+2};
  if(!int(count)||!Object.values(lost).every(int))return {ok:false,reason:'Actual casket destruction loss counter exhausted.'};
  destroyed={...prior,count,lost};
 }
 let wave:MiniTurretBombWave|undefined,thermal=view.thermal;
 if(explosion){
  if(!Number.isSafeInteger(view.nextId+1))return {ok:false,reason:'Actual casket explosion identity exhausted.'};
  const center={x:s.x,z:s.z};
  wave={id:view.nextId++,sourceId:s.id,...explosion.instigatorKey?{instigatorKey:explosion.instigatorKey}:{},center,startedAtCore:explosion.core,advancedAtCore:explosion.core,cells:captureBombCells(view,center,ANCIENT_CASKET_FLAME_RADIUS_256,true),nextCell:0,damagedThingKeys:[],casketExplosion:{ignoredThingKeys:products!.ignoredThingKeys}};
  const thermalView:World={...view,...view.thermal?{thermal:structuredClone(view.thermal)}:{}};
  const layout=reconcileTemperature(thermalView),region=thermalView.thermal?.regions[layout.indices[center.z*w.width+center.x]!];
  if(region){region.temperature=Math.min(1000,region.temperature+15*wave.cells.length/region.cells.length);if(!Number.isFinite(region.temperature))return {ok:false,reason:'Actual Flame heat is invalid.'};}thermal=thermalView.thermal;
 }
 const source=stamp(s),structures=w.structures,piles=w.piles,packed=w.packed,actualJobs=w.jobs,pawns=w.pawns,collections=[structures,piles,packed,actualJobs,pawns],memberships=collections.map(a=>[...a]),records=[...structures,...piles,...packed,...actualJobs,...pawns],values=records.map(stamp),tiles=w.tiles,tileRefs=[...tiles],nextId=w.nextId,tick=w.tick,rng=w.rng,priorLedger=w.deconstructed,ledgerBefore=stamp(priorLedger),fog=prepareRemovedFogStructure256(w,s);
 const geometryBefore=stamp({width:w.width,height:w.height,tiles:w.tiles,resources:w.resources,stockpiles:w.stockpiles});
 const destructionBefore=w.destroyed,destructionStamp=stamp(w.destroyed),bombWaves=w.bombWaves,bombStamp=stamp(bombWaves),filth=w.filth,filthStamp=stamp(filth),thermalBefore=w.thermal,thermalStamp=stamp(thermalBefore),home=w.home,homeStamp=stamp(home);
 let used=false;
 return {ok:true,commit(){
  if(used||w.tick!==tick||w.rng!==rng||w.nextId!==nextId||w.structures!==structures||w.piles!==piles||w.packed!==packed||w.jobs!==actualJobs||w.pawns!==pawns||w.tiles!==tiles||tiles.length!==tileRefs.length||tiles.some((t,i)=>t!==tileRefs[i])||!valid(w,s)||stamp(s)!==source||w.deconstructed!==priorLedger||stamp(priorLedger)!==ledgerBefore||records.some((v,i)=>stamp(v)!==values[i]))return false;
  if(collections.some((a,i)=>a.length!==memberships[i]!.length||a.some((v,n)=>v!==memberships[i]![n]))||w.destroyed!==destructionBefore||stamp(w.destroyed)!==destructionStamp||w.bombWaves!==bombWaves||stamp(bombWaves)!==bombStamp||w.filth!==filth||stamp(filth)!==filthStamp||w.thermal!==thermalBefore||stamp(thermalBefore)!==thermalStamp||w.home!==home||stamp(home)!==homeStamp)return false;
  if(stamp({width:w.width,height:w.height,tiles:w.tiles,resources:w.resources,stockpiles:w.stockpiles})!==geometryBefore)return false;
  used=true;
  for(const p of actors)if(!releaseWork(w,p,drops))throw Error('Actual casket worker cargo changed inside synchronous commit');
  w.jobs=w.jobs.filter(j=>!ids.has(j.id));for(const p of w.pawns)p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!ids.has(o));
  w.structures=w.structures.filter(b=>b!==s);releaseStructureMelee(w,s.id);
  if(products)commitAncientCasketLeavings256(w,products);
  if(mode==='deconstruct')w.deconstructed=ledger;else if(mode==='kill-finalize')w.destroyed=destroyed;
  // A casket's danger intent ends with its actual source. Retire only the
  // voluntary route; committed motion/recovery remains owned and completes.
  for(const p of w.pawns)if(p.bombRefuge?.sourceId===s.id){delete p.bombRefuge;p.path=[];p.planCooldown=0;if(p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&!p.melee?.strike&&!p.shooting?.stance&&!p.stun&&p.state!=='dead'&&p.state!=='downed')p.state='idle';}
  if(wave){w.nextId=wave.id+1;w.bombWaves=[...(w.bombWaves??[]),wave].sort((a,b)=>a.id-b.id);if(thermal)w.thermal=thermal;}
  refreshStock(w);commitRemovedFogBlocker256(w,fog);return true;
 }};
}

/** Base CompExplosive PreApply precedes Ancient's group-opening override.
 * A raw lethal hit cannot be converted into a favourable free Eject. */
export function damageEmptyAncientCasket256(w:World,s:Structure,amount:number,cause:StructureDamageCause,rng:number,external?:StructureDamageContext):boolean {
 if(!validActual(w,s)||!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(rng)||rng<0||rng>0xffffffff)return false;
 if(external&&(!Number.isFinite(external.rawAmount)||external.rawAmount<0||!int(external.core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?external.core!==effectiveCore297(w):external.core<Math.max(0,(w.tick-1)*10)||external.core>w.tick*10)))return false;
 const core=external?.core??(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10),before=s.damage??0,next=before+amount,raw=external?.rawAmount??amount;
 if(!Number.isSafeInteger(next)||!Number.isSafeInteger(core+150))return false;
 if(external?.detonate&&(!s.casketWick||s.casketWick.endCore>core))return false;
 const detonates=!!external?.detonate||raw>=250-before;
 if(detonates||next>=250){
  if(!actualEmptyCasket256(s))return false; // true DamageUntilDowned/holder loss not yet composed
  const instigatorKey=external?.detonate?s.casketWick?.instigatorKey:external?.instigatorKey;
  const plan=planEmptyAncientCasketRemoval256(w,s,'kill-finalize',detonates?{core,...instigatorKey?{instigatorKey}:{}}:undefined,rng);
  return plan.ok&&plan.commit();
 }
 const instigator=ancientDamageInstigator256(w,external?.instigatorKey);
 if(!actualEmptyCasket256(s)&&!instigator.known)return false;
 const hasPawn=s.casket.humans.some(p=>p.state!=='dead')||s.casket.animals.some(a=>a.state!=='dead');
 const release=!s.casket.contentsKnown&&hasPawn&&instigator.hasFaction?planAncientCasketRelease256(w,s,cause==='fire'?w.rng:rng):undefined;
 if(release&&!release.ok)return false;
 if(next>=200&&!actualEmptyCasket256(s)&&(!release?.ok||!release.targetWillBeEmpty))return false;
 // A non-lethal HP/filth/Wick postpass has no fallible placement or item
 // allocation. Bound its only allocator before any group ejection commits.
 if(!Number.isSafeInteger(w.nextId+16))return false;
 if(release?.ok&&!release.commit().ok)return false;
 const fire=cause==='fire'?w.fires??ensureFireState({...w}):undefined,random={rng:fire?.rng??(release?w.rng:rng)};
 const trial:World={...w,filth:w.filth?{...w.filth,items:w.filth.items.map(f=>({...f}))}:undefined};
 const blocked=blockedCells(w,true),candidates:Cell[]=[];
 const cells=(s.orientation===0?[{x:s.x,z:s.z},{x:s.x,z:s.z+1}]:s.orientation===1?[{x:s.x,z:s.z},{x:s.x+1,z:s.z}]:s.orientation===2?[{x:s.x,z:s.z-1},{x:s.x,z:s.z}]:[{x:s.x-1,z:s.z},{x:s.x,z:s.z}]);
 const minX=Math.min(...cells.map(c=>c.x))-1,maxX=Math.max(...cells.map(c=>c.x))+1,minZ=Math.min(...cells.map(c=>c.z))-1,maxZ=Math.max(...cells.map(c=>c.z))+1;
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++)if(x>=0&&z>=0&&x<w.width&&z<w.height&&!blocked[z*w.width+x])candidates.push({x,z});
 if(candidates.length){const total=amount/60,floor=Math.floor(total),n=floor+(healthRandom(random)<total-floor?1:0);for(let i=0;i<n;i++){const cell=candidates[Math.floor(healthRandom(random)*candidates.length)]!;addFilth(trial,cell,'building-rubble');}}
 s.damage=next;w.nextId=trial.nextId;if(trial.filth)w.filth=trial.filth;
 if(fire){if(w.fires)w.fires.rng=random.rng;else w.fires={...fire,rng:random.rng};}else w.rng=random.rng;
 if(next>=200&&!s.casketWick){const draw=shipChunkNextRandom256(w.rng);w.rng=draw.rng;s.casketWick={startedAtCore:core,endCore:core+140+Math.abs((draw.rng|0)%11),...external?.instigatorKey?{instigatorKey:external.instigatorKey}:{}};}
 return true;
}
