import {assignPileOwner} from './pile-index.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {worldPawnsPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import {heldCore297} from './core-phase-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {prepareLinkedCasketVanish286} from './linked-storage-casket-vanish-286.ts';
import {isPlayerCasket271,newCryptosleepHolder271,type PlayerCasket271} from './cryptosleep-state-271.ts';
import {validCryptosleepBuilding271} from './cryptosleep-owner-save-271.ts';
import {prepareSuspendedHumanResume271,medicalCivilTick271} from './suspended-human-clock-271.ts';
import {prepareCryptosleepPossessionsResume271} from './cryptosleep-transfer-271.ts';
import {medicalModel} from './body-model.ts';
import {medicalPartInjuryRule,HP_UNIT,type InjuryKind} from './injury-rules.ts';
import {createMedicalRecord,medicalStatus,partMissing,remainingPartHealth,addResolvedInjury} from './injury-state.ts';
import {animalAgeConditionEffects256} from './animal-age-condition-state-256.ts';
import {alcoholModifiers265} from './alcohol-rules-265.ts';
import {healthRandom,reconcilePawnHealth} from './health.ts';
import {captureStartingPlacePhysics256} from './starting-place-physics-256.ts';
import {findStartingPlaceNear256,type StartingPlaceThing256} from './starting-place-near-256.ts';
import {planSelectedDrops,releaseWork} from './work-release.ts';
import {constructionRecipe} from './construction-materials.ts';
import {groundCapacity,planGroundPlacement,nearbyGround} from './ground-placement.ts';
import {captureStandability} from './furniture-travel.ts';
import {addMaterial,materialCanFit,refreshStock} from './materials.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {materialAllowedForPlayer256,setMaterialForbidden256} from './material-permission-256.ts';
import {cryptosleepCells271} from './cryptosleep-content-271.ts';
import {addFilth} from './filth.ts';
import {prepareRemovedFogStructure256,commitRemovedFogBlocker256,notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {releaseStructureMelee} from './melee-state.ts';
import {deconstructionAvailable,deconstructionDuration} from './deconstruction-rules.ts';
import {workProgress} from './work-progress.ts';
import {captureBombCells} from './bomb-cells.ts';
import {reconcileTemperature} from './temperature.ts';
import {ANCIENT_CASKET_FLAME_RADIUS_256} from './ancient-casket-explosive-state-256.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {actualCampRemovalAbsCore256} from './world-pawn-map-removed-256.ts';
import {preparePassedToWorld256} from './world-pawn-transition-256.ts';
import {validateWorldPawnOwners256} from './world-pawn-save-256.ts';
import {nativeWorldPawnOrderCurrent256,commitNativeWorldPawnOrder256} from './world-pawn-native-order-256.ts';
import {cancelWorldPawnGC256} from './world-pawn-gc-256.ts';
import {cleanMapRemovedHumanRecord259} from './world-lost-owners.ts';
import {unclaimDetachedActorBed256} from './actor-map-bed-256.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {captureHumanOwners} from './human-owners.ts';
import {fermentationContents265} from './fermentation-state-265.ts';
import type {WorldPawnOwner256,WorldPawnsState256} from './world-pawn-state-256.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {StructureDamageCause,StructureDamageContext} from './thing-damage.ts';
import type {BombInstigatorKey} from './mini-turret-state.ts';
import type {MiniTurretBombWave} from './bomb-state.ts';
import type {Cell,MaterialPile,Pawn,Structure,World} from './types.ts';

const stamp=(v:unknown)=>JSON.stringify(v),int=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const round=(n:number)=>{const floor=Math.floor(n);return n-floor===.5?floor+floor%2:Math.round(n);};
const adopt=<T extends object>(original:T,next:T)=>{for(const k of Object.keys(original))if(!Object.hasOwn(next,k))delete (original as Record<string,unknown>)[k];Object.assign(original,next);};
export type CryptosleepRemoval271={ok:false;reason:string}|{ok:true;commit():boolean};

/** Historic maps have no Site3 physical provenance. Reuse their existing
 * connected-floor/standability rules rather than inventing a geographic
 * header. Site3 continues through the native ranked Near reader below. */
function legacyRemovalCell271(view:World,center:Cell):Cell|null {
 const standable=captureStandability(view),occupied=new Set<number>(),add=(actor:Cell&{motion?:{end:number;from:Cell;to:Cell}|null})=>{
  occupied.add(actor.z*view.width+actor.x);if(actor.motion&&actor.motion.end>view.tick){occupied.add(actor.motion.from.z*view.width+actor.motion.from.x);occupied.add(actor.motion.to.z*view.width+actor.motion.to.x);}
 };
 for(const p of view.pawns)if(!(p.state==='dead'&&p.body?.pileId!==undefined))add(p);
 for(const a of view.wildlife?.animals??[])if(a.state!=='dead')add(a);
 for(const a of view.mechanoids??[])if(a.state!=='dead')add(a);
 return nearbyGround(view,center).find(c=>standable(c)&&!occupied.has(c.z*view.width+c.x))??null;
}

/** Core procedure on the represented human anatomy. The existing gameplay
 * word stream and integer injury kernel remain explicit adaptations; no
 * artificial downed flag, gratuitous anesthetic or fixed wound is installed. */
export function cryptosleepDamageUntilDowned271(record:MedicalRecord,random:()=>number):{record:MedicalRecord;attempts:number} {
 let next=structuredClone(record),attempts=0;if(medicalStatus(next)!=='mobile')return {record:next,attempts};
 const model=medicalModel(next),absolute=(part:typeof model.parts[number])=>{let weight=part.coverage;for(let id=part.parent;id!==null;id=model.byId[id].parent)weight*=model.byId[id].coverage;return weight;};
 while(attempts<300&&medicalStatus(next)==='mobile'){
  const negative=[...animalAgeConditionEffects256(next).partOffsets,...alcoholModifiers265(next).partOffsets].filter(p=>p.offset<0);
  const choices=model.parts.filter(p=>!p.conceptual&&!partMissing(next,p.id)&&(p.depth==='outside'||medicalPartInjuryRule(next,p.id).solid)&&!negative.some(c=>c.part===p.id)&&absolute(p)>0);
  const total=choices.reduce((n,p)=>n+absolute(p),0);if(!choices.length||!total)break;attempts++;
  let roll=random()*total,part=choices.at(-1)!;for(const candidate of choices){roll-=absolute(candidate);if(roll<0){part=candidate;break;}}
  let maximum=round(remainingPartHealth(next,part.id)/HP_UNIT)-3;if(maximum<=0||maximum<8&&attempts<250)continue;
  if(attempts>275)maximum=1+Math.floor(random()*7);
  const traits=medicalPartInjuryRule(next,part.id),violence=part.depth==='inside'?1:Math.floor(random()*5);
  const kind:InjuryKind=traits.solid?'crack':violence===0?'gunshot':violence===2?'stab':violence===3||violence===4?'cut':traits.skin?'bruise':'crush';
  const minimum=round(Math.fround(Math.fround(maximum)*Math.fround(.65))),damage=minimum+Math.floor(random()*(maximum-minimum+1));
  // WouldDie is a clinical-only prediction, not a second gameplay draw. The
  // selected original receives its actual scar/infection draws only once.
  const prediction=structuredClone(next);addResolvedInjury(prediction,part.id,kind,damage*HP_UNIT,()=>.999999999);
  if(prediction.death)continue;
  addResolvedInjury(next,part.id,kind,damage*HP_UNIT,random);
 }
 return {record:next,attempts};
}

/** Thing.Destroy(Vanish) keeps the same destroyed WorldPawn identity while
 * destroying gear. It does not manufacture clinical death or a corpse. */
function prepareVanish271(w:World,p:Pawn,draft:Pawn,items:readonly MaterialPile[],packs:World['packed']) {
 const root=registeredCampaign(w),state=root.worldPawns,factions=root.worldFactions,mapId=registeredMapId(w),now=w.tick*10;
 const physicalCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined;
 if(!state||!factions||mapId===undefined||root.tick!==w.tick||(physicalCore297===undefined?state.atCore!==now&&state.atCore!==now-10:state.atCore!==now||worldPawnsPhysicalCore297(state,w.schemaVersion)!==physicalCore297))throw Error('Actual destroyed-holder WorldPawn frontier is unavailable');
 const native=state.nativeOrder;if(!nativeWorldPawnOrderCurrent256(state,native))throw Error('Actual destroyed-holder native order is unavailable');
 cleanMapRemovedHumanRecord259(draft,w.tick);unclaimDetachedActorBed256(draft);delete draft.cryptosleepHeldAt271;delete draft.equipmentDropPending;delete draft.droppedWeaponId;delete draft.surgeryRequest;
 if(draft.mental?.wander)draft.mental.wander.nextMoveOrderIsWait=true;
 const context={seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:w.climate}:{},...w.site?{site:w.site}:{},...w.scenario?{scenario:w.scenario}:{}};
 const row:WorldPawnOwner256={kind:'human',actor:draft,factionId:factions.playerFactionId,originMapId:mapId,context,clockCore:physicalCore297===undefined?now:state.atCore,...physicalCore297!==undefined?{physicalClockCore297:physicalCore297}:{},enteredAtAbsCore:actualCampRemovalAbsCore256(root,w),mode:'dead',destroyed:true,items:[],packed:[]};
 // A real local substep may precede this tick's global WorldPawn pass. Only
 // this terminal row is staged at now; other rows are neither ticked nor moved.
 const staged:WorldPawnsState256={...state,atCore:now,...physicalCore297!==undefined?{physicalClockCore297:physicalCore297}:{},owners:state.owners.slice()},pass=preparePassedToWorld256(staged,row,factions,{float(){throw Error('Destroyed human does not draw a faction choice');}},{version:w.schemaVersion});
 if(!pass.ok)throw Error(pass.reason);pass.commit();const errors=validateWorldPawnOwners256(staged,root,new Set(),undefined,new Set(captureHumanOwners(w).people.keys()));if(errors.length)throw Error(errors[0]);
 const quantities:Partial<Record<ItemId,number>>={};for(const item of items)quantities[item.item]=(quantities[item.item]??0)+item.quantity;
 const materialLoss=new Map<ItemId,number>();let fuelTicksLost=0,fuelTicksBurned=0,batteryEnergyLost=0;
 for(const pack of packs){
  for(const cost of constructionRecipe(pack.building).ingredients)materialLoss.set(cost.item,(materialLoss.get(cost.item)??0)+cost.quantity);
  const b=pack.building,fermentation=fermentationContents265(b);if(fermentation)materialLoss.set(fermentation.item,(materialLoss.get(fermentation.item)??0)+fermentation.quantity);
  if(b.fuel){fuelTicksLost+=b.fuel.ticks;fuelTicksBurned+=b.fuel.burned;}if(b.battery)batteryEnergyLost+=b.battery.stored+(b.battery.half?.5:0);
 }
 if(!Object.values(quantities).every(int)||![...materialLoss.values(),fuelTicksLost,fuelTicksBurned,batteryEnergyLost*2].every(int))throw Error('Destroyed holder possession counters exhausted');
 const actors=captureActorBeds256(root).actors,masters=actors.filter(a=>'species'in a&&a.startingPet?.masterId===p.id).map(a=>({actor:a as import('./wildlife-state.ts').WildAnimal,before:stamp(a),after:{...(a as import('./wildlife-state.ts').WildAnimal).startingPet!}}));for(const m of masters)delete m.after.masterId;
 const membership=state.owners.slice(),at=state.atCore,order=staged.nativeOrder;
 return {quantities,materialLoss,fuelTicksLost,fuelTicksBurned,batteryEnergyLost,current:()=>root.worldPawns===state&&state.atCore===at&&(physicalCore297===undefined||physicalCore297===effectiveCore297(w)&&worldPawnsPhysicalCore297(state,w.schemaVersion)===physicalCore297)&&state.owners.length===membership.length&&state.owners.every((r,i)=>r===membership[i])&&nativeWorldPawnOrderCurrent256(state,native)&&masters.every(m=>stamp(m.actor)===m.before),commit(){
  cancelWorldPawnGC256(state);adopt(p,pass.row.actor as Pawn);pass.row.actor=p;state.owners.push(pass.row);commitNativeWorldPawnOrder256(state,native,order);for(const m of masters)m.actor.startingPet=m.after;
 }};
}

/** Paid casket only: base building removal/leavings, original clinical
 * contents, then an optional Flame wave. Destruction never calls Open. */
export function planCryptosleepRemoval271(w:World,s:Structure,mode:'deconstruct'|'kill-finalize'|'vanish',explosion?:{core:number;instigatorKey?:BombInstigatorKey},damageRng=w.rng):CryptosleepRemoval271 {
 const no=(reason:string):CryptosleepRemoval271=>({ok:false,reason});
 if(!isSchema271OrLater(w.schemaVersion)||!isPlayerCasket271(s)||!w.structures.includes(s)||!validCryptosleepBuilding271(s,w.schemaVersion,w,w.tick,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined)||s.cryptosleep.heldAt>w.tick||!int(damageRng)||damageRng>0xffffffff)return no('Actual paid player casket required');
 const c=s as PlayerCasket271,h=c.cryptosleep,p=h.human,tick=w.tick,heldItems=h.items,heldPacks=h.packed,itemMembers=[...h.items],packMembers=[...h.packed];
 const plannedCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined,physical297=plannedCore297===undefined?undefined:{version:297 as const,heldAtCore297:heldCore297(h,w.schemaVersion,h.heldAt),targetCore297:plannedCore297};
 if(explosion&&(mode!=='kill-finalize'||!int(explosion.core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?explosion.core!==effectiveCore297(w):explosion.core<Math.max(0,(tick-1)*10)||explosion.core>tick*10)||(w.bombWaves?.length??0)>=w.width*w.height))return no('Actual Flame owner/clock/capacity unavailable');
 const jobs=w.jobs.filter(j=>j.deconstruction?.structureId===c.id||j.repair?.structureId===c.id||j.fixBreakdown?.structureId===c.id),jobIds=new Set(jobs.map(j=>j.id));
 if(mode==='deconstruct'){
  const job=jobs.find(j=>j.deconstruction?.structureId===c.id),worker=job?w.pawns.find(p=>p.id===job.reservedBy&&p.jobId===job.id):undefined;
  if(!job||!worker||worker.state!=='working'||worker.moveCooldown||(worker.motion?.end??0)>tick||Math.abs(worker.x-c.x)+Math.abs(worker.z-c.z)!==1||workProgress(job)<deconstructionDuration(job)||!deconstructionAvailable(w,job,worker.id))return no('Actual completed deconstruction and contact required');
 }
 const workers=w.pawns.filter(q=>q.jobId!==null&&jobIds.has(q.jobId)||q.haul?.destination.type==='job'&&jobIds.has(q.haul.destination.jobId)||q.cryptosleepTask?.casketId===c.id),drops=planSelectedDrops(w,jobIds,new Set(workers.map(q=>q.id)));
 if(!drops)return no('Worker cargo has no actual place');
 if(w.piles.some(i=>i.owner.type==='job'&&jobIds.has(i.owner.jobId)))return no('Actual delivered maintenance cargo requires cancellation');
 const random={rng:damageRng},draw=()=>healthRandom(random),view:World={...w,structures:w.structures.filter(b=>b!==c),piles:w.piles.map(i=>({...i,owner:{...i.owner}})),packed:w.packed.map(i=>({...i,owner:{...i.owner}})),jobs:w.jobs.filter(j=>!jobIds.has(j.id)).map(j=>({...j,escrow:{...j.escrow}})),filth:w.filth?{...w.filth,items:w.filth.items.map(f=>({...f}))}:undefined};
 for(const i of view.piles){const cell=drops.get(i.id);if(cell)assignPileOwner(i,{type:'ground',...cell});}for(const i of view.packed){const cell=drops.get(i.building.id);if(cell)assignPileOwner(i,{type:'ground',...cell});}
 if(mode==='kill-finalize')for(const cell of cryptosleepCells271(c,c.orientation))addFilth(view,cell,'building-rubble',1+Math.floor(draw()*3));
 const rubble={filth:view.filth,nextId:view.nextId},products:{item:ItemId;quantity:number;cell:Cell;id:number;forbidden:boolean}[]=[],returned=new Map<ItemId,number>(),ignored=new Set<string>();
 for(const cost of mode==='vanish'?[]:constructionRecipe(c).ingredients){
  const value=Math.fround(cost.quantity*Math.fround(mode==='deconstruct'?.5:.25)),quantity=Math.floor(value)+(draw()<value%1?1:0);returned.set(cost.item,0);if(!quantity)continue;
  const forbidden=mode==='kill-finalize'&&!(w.home??[]).includes(c.z*w.width+c.x),compatible=(cell:Cell)=>!view.piles.some(i=>i.owner.type==='ground'&&i.owner.x===cell.x&&i.owner.z===cell.z&&i.item===cost.item&&materialAllowedForPlayer256(i)===forbidden);
  const places=compatible(c)&&groundCapacity(view,c,cost.item)>=quantity?[{cell:{x:c.x,z:c.z},quantity}]:planGroundPlacement(view,quantity,c,cost.item,compatible);
  // Failed leavings are lost; they cannot make an occupied casket invulnerable.
  if(!places||view.piles.length+places.length>32768||!Number.isSafeInteger(view.nextId+places.length))continue;
  let lastId:number|undefined;
  for(const part of places){if(!materialCanFit(view,ITEM_DEFINITIONS[cost.item].kind,part.quantity,{type:'ground',...part.cell},cost.item))return no('Actual casket leaving preflight inconsistent');
   const prior=new Map(view.piles.map(i=>[i.id,i.quantity]));addMaterial(view,ITEM_DEFINITIONS[cost.item].kind,part.quantity,{type:'ground',...part.cell},cost.item);const actual=view.piles.filter(i=>i.item===cost.item&&i.quantity!==(prior.get(i.id)??0)).at(-1);if(!actual)return no('Actual leaving identity missing');setMaterialForbidden256(actual,forbidden);lastId=actual.id;products.push({...part,item:cost.item,id:actual.id,forbidden});
  }returned.set(cost.item,quantity);if(lastId!==undefined)ignored.add(`pile:${lastId}`);
 }
 let humanClock:ReturnType<typeof prepareSuspendedHumanResume271>|undefined,goodsClock:ReturnType<typeof prepareCryptosleepPossessionsResume271>|undefined,draft:Pawn|undefined,cell:Cell|null=null,vanish:ReturnType<typeof prepareVanish271>|undefined;
 try{if(p){
  if(p.cryptosleepHeldAt271!==h.heldAt||p.health&&medicalCivilTick271(p.health)!==h.heldAt||w.pawns.some(q=>q.id===p.id))return no('Actual original player-casket occupant frontier changed');
  humanClock=prepareSuspendedHumanResume271(p,h.heldAt,tick,physical297);goodsClock=prepareCryptosleepPossessionsResume271(h.items,h.packed,tick-h.heldAt,physical297);draft=structuredClone(p);const resume=prepareSuspendedHumanResume271(draft,h.heldAt,tick,physical297);if(!resume.commit())throw Error('Private clinical casket resume changed');delete draft.cryptosleepHeldAt271;
  if(mode==='kill-finalize'){draft.health??=createMedicalRecord(tick);draft.health=cryptosleepDamageUntilDowned271(draft.health,draw).record;draft.state=medicalStatus(draft.health)==='downed'?'downed':'idle';}
  if(mode!=='vanish'&&w.pawns.length<w.width*w.height&&w.piles.length+h.items.length+products.length<=32768&&w.packed.length+h.packed.length<=32768){
   const ground=new Map<number,MaterialPile[]>();for(const i of view.piles)if(i.owner.type==='ground'){const key=i.owner.z*w.width+i.owner.x,list=ground.get(key)??[];list.push(i);ground.set(key,list);}
   // Physical draft columns contain the admitted base removal and leavings;
   // no held Pawn is spawned and no surrogate World validates its record.
   if(view.site?.revision===3){const thing:StartingPlaceThing256={id:p.id,category:'pawn',quantity:1,stackLimit:1,downed:draft.state==='downed',saveCompressible:false},read=captureStartingPlacePhysics256(view,undefined,c,ground,[]);cell=findStartingPlaceNear256(c,thing,probe=>read(probe,thing));}
   else cell=legacyRemovalCell271(view,c);
  }
  if(!cell)vanish=prepareVanish271(w,p,draft,h.items,h.packed);
 }}catch(error){return no(error instanceof Error?error.message:String(error));}
 // V286 counts the actual packed buildings lost with the terminal holder.
 // Historical actions retain their original ledger branch.
 const losesItems=!!vanish&&(!isSchema286OrLater(w.schemaVersion)||Object.keys(vanish.quantities).length>0);
 const losesPossessions=!!vanish&&(!isSchema286OrLater(w.schemaVersion)||losesItems||heldPacks.length>0||vanish.fuelTicksLost>0||vanish.fuelTicksBurned>0||vanish.batteryEnergyLost>0);
 const priorDestroyed=w.destroyed??{count:0,lost:{}},destroyed={...priorDestroyed,count:priorDestroyed.count+(mode==='kill-finalize'?1:0)+(isSchema286OrLater(w.schemaVersion)&&vanish?heldPacks.length:0),lost:{...priorDestroyed.lost},...losesItems?{items:{...priorDestroyed.items}}:{}};
 if(mode!=='deconstruct'&&mode!=='vanish')for(const cost of constructionRecipe(c).ingredients){const key=cost.item as keyof typeof destroyed.lost;destroyed.lost[key]=(destroyed.lost[key]??0)+cost.quantity-(returned.get(cost.item)??0);}
 if(vanish){
  for(const [item,quantity]of Object.entries(vanish.quantities))destroyed.items![item as ItemId]=(destroyed.items![item as ItemId]??0)+quantity!;
  for(const [item,quantity]of vanish.materialLoss){const key=item as keyof typeof destroyed.lost;destroyed.lost[key]=(destroyed.lost[key]??0)+quantity;}
  if(vanish.fuelTicksLost)destroyed.fuelTicksLost=(priorDestroyed.fuelTicksLost??0)+vanish.fuelTicksLost;
  if(vanish.fuelTicksBurned)destroyed.fuelTicksBurned=(priorDestroyed.fuelTicksBurned??0)+vanish.fuelTicksBurned;
  if(vanish.batteryEnergyLost)destroyed.batteryEnergyLost=(priorDestroyed.batteryEnergyLost??0)+vanish.batteryEnergyLost;
 }
 const ledger=w.deconstructed,deconstructed={...ledger};
 if(mode==='deconstruct'){
  deconstructed.count++;deconstructed.lostSteel=(ledger.lostSteel??0)+180-(returned.get('steel')??0);deconstructed.lostUranium=(ledger.lostUranium??0)+5-(returned.get('uranium')??0);deconstructed.lostComponents=(ledger.lostComponents??0)+4-(returned.get('component')??0);const advanced=(ledger.lostAdvancedComponents271??0)+1-(returned.get('advanced-component')??0);if(advanced)deconstructed.lostAdvancedComponents271=advanced;
 }
 if(![destroyed.count,...Object.values(destroyed.lost),...Object.values(destroyed.items??{}),destroyed.fuelTicksLost??0,destroyed.fuelTicksBurned??0,(destroyed.batteryEnergyLost??0)*2,deconstructed.count,deconstructed.lostSteel??0,deconstructed.lostUranium??0,deconstructed.lostComponents??0,deconstructed.lostAdvancedComponents271??0].every(int))return no('Actual casket loss counter exhausted');
 let wave:MiniTurretBombWave|undefined;if(explosion){if(!Number.isSafeInteger(view.nextId+1))return no('Actual Flame ID exhausted');wave={id:view.nextId++,sourceId:c.id,center:{x:c.x,z:c.z},...explosion.instigatorKey?{instigatorKey:explosion.instigatorKey}:{},startedAtCore:explosion.core,advancedAtCore:explosion.core,cells:captureBombCells(view,c,ANCIENT_CASKET_FLAME_RADIUS_256,true),nextCell:0,damagedThingKeys:[],casketExplosion:{player271:true,ignoredThingKeys:[...ignored].sort()}};}
 const linkedResult=vanish?prepareLinkedCasketVanish286(w,c,'cryptosleep',heldPacks):undefined;if(linkedResult&&!linkedResult.ok)return no(linkedResult.reason);const linked=linkedResult?.ok?linkedResult.plan:undefined;
 const structures=w.structures,piles=w.piles,packed=w.packed,actualJobs=w.jobs,pawns=w.pawns,collections=[structures,piles,packed,actualJobs,pawns],memberships=collections.map(a=>[...a]),source=stamp(c),records=[...structures,...piles,...packed,...actualJobs,...pawns],before=records.map(stamp),nextId=w.nextId,rng=w.rng,filth=w.filth,filthBefore=stamp(filth),destroyedBefore=stamp(w.destroyed),ledgerBefore=stamp(ledger),fog=prepareRemovedFogStructure256(w,c),tiles=w.tiles,terrainBefore=stamp([w.tiles,w.resources,w.stockpiles]),waves=w.bombWaves,wavesBefore=stamp(waves);let used=false;
 return {ok:true,commit(){
  if(used||w.tick!==tick||plannedCore297!==undefined&&plannedCore297!==effectiveCore297(w)||w.nextId!==nextId||w.rng!==rng||w.structures!==structures||w.piles!==piles||w.packed!==packed||w.jobs!==actualJobs||w.pawns!==pawns||collections.some((a,i)=>a.length!==memberships[i]!.length||a.some((v,n)=>v!==memberships[i]![n]))||!structures.includes(c)||c.cryptosleep!==h||h.human!==p||h.items!==heldItems||h.packed!==heldPacks||heldItems.length!==itemMembers.length||heldItems.some((v,i)=>v!==itemMembers[i])||heldPacks.length!==packMembers.length||heldPacks.some((v,i)=>v!==packMembers[i])||stamp(c)!==source||records.some((v,i)=>stamp(v)!==before[i])||w.filth!==filth||stamp(filth)!==filthBefore||stamp(w.destroyed)!==destroyedBefore||w.deconstructed!==ledger||stamp(ledger)!==ledgerBefore||w.tiles!==tiles||stamp([w.tiles,w.resources,w.stockpiles])!==terrainBefore||w.bombWaves!==waves||stamp(waves)!==wavesBefore||humanClock&&!humanClock.current()||goodsClock&&!goodsClock.current()||vanish&&!vanish.current()||linked&&!linked.current())return false;
  // Adopt the staged product/downing stream before real interruption/health
  // notifiers. Any further real draw remains owned and is never overwritten.
  linked?.begin();used=true;w.rng=random.rng;for(const worker of workers)if(!releaseWork(w,worker,drops))throw Error('Casket worker cargo changed within commit');w.jobs=w.jobs.filter(j=>!jobIds.has(j.id));for(const q of w.pawns)q.orders.queue=q.orders.queue.filter(o=>typeof o!=='number'||!jobIds.has(o));
  w.structures=w.structures.filter(b=>b!==c);releaseStructureMelee(w,c.id);if(rubble.filth)w.filth=rubble.filth;w.nextId=rubble.nextId;
  for(const product of products){addMaterial(w,ITEM_DEFINITIONS[product.item].kind,product.quantity,{type:'ground',...product.cell},product.item);const actual=w.piles.find(i=>i.id===product.id);if(!actual)throw Error('Casket leaving identity changed within commit');setMaterialForbidden256(actual,product.forbidden);}
  if(humanClock&&!humanClock.commit()||goodsClock&&!goodsClock.commit())throw Error('Casket suspension changed within commit');
  linked?.commit();
  if(p&&draft){if(vanish)vanish.commit();else{adopt(p,draft);Object.assign(p,cell!);w.pawns=[...w.pawns,p];w.piles=[...w.piles,...h.items];w.packed=[...w.packed,...h.packed];reconcilePawnHealth(w,p,undefined,true);notifyActualExplorationSpawn256(w,p);}}
  c.cryptosleep=newCryptosleepHolder271(tick);if(mode==='deconstruct')w.deconstructed=deconstructed;if(mode==='kill-finalize'||losesPossessions)w.destroyed=destroyed;
  for(const q of w.pawns)if(q.bombRefuge?.sourceId===c.id){q.bombRefuge.endCore=Math.min(q.bombRefuge.endCore,explosion?.core??tick*10);if(!q.moveCooldown&&(q.motion?.end??0)<=tick&&!q.melee?.strike&&!q.shooting?.stance&&!q.stun){delete q.bombRefuge;q.path=[];if(q.state!=='dead'&&q.state!=='downed')q.state='idle';}}
  if(wave){w.nextId=wave.id+1;w.bombWaves=[...(w.bombWaves??[]),wave].sort((a,b)=>a.id-b.id);const layout=reconcileTemperature(w),region=w.thermal?.regions[layout.indices[c.z*w.width+c.x]!];if(region)region.temperature=Math.min(1000,region.temperature+15*wave.cells.length/region.cells.length);}
  refreshStock(w);commitRemovedFogBlocker256(w,fog);return true;
 }};
}

export function damagePlayerCryptosleep271(w:World,s:Structure,amount:number,cause:StructureDamageCause,rng:number,external?:StructureDamageContext):boolean {
 if(!isSchema271OrLater(w.schemaVersion)||!isPlayerCasket271(s)||!w.structures.includes(s)||!validCryptosleepBuilding271(s,w.schemaVersion,w,w.tick,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined)||s.cryptosleep.heldAt>w.tick||!int(amount)||amount===0||!int(rng)||rng>0xffffffff)return false;
 const core=external?.core??(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10);if(external&&(!Number.isFinite(external.rawAmount)||external.rawAmount<0||!int(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10)))return false;
 const before=s.damage??0,damage=before+amount;if(!int(damage)||!Number.isSafeInteger(core+150))return false;
 if(external?.detonate&&(!s.casketWick||s.casketWick.endCore>core))return false;
 const detonates=!!external?.detonate||(external?.rawAmount??amount)>=250-before;
 if(detonates||damage>=250){const instigatorKey=external?.detonate?s.casketWick?.instigatorKey:external?.instigatorKey,plan=planCryptosleepRemoval271(w,s,'kill-finalize',detonates?{core,...instigatorKey?{instigatorKey}:{}}:undefined,rng);return plan.ok&&plan.commit();}
 s.damage=damage;if(cause!=='fire')w.rng=rng;if(damage>=200&&!s.casketWick){const random={rng:w.rng},duration=140+Math.floor(healthRandom(random)*11);w.rng=random.rng;s.casketWick={startedAtCore:core,endCore:core+duration,...external?.instigatorKey?{instigatorKey:external.instigatorKey}:{}};}return true;
}
