import {assignPileOwner} from './pile-index.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {worldPawnsPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import {heldCore297} from './core-phase-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {prepareLinkedCasketVanish286} from './linked-storage-casket-vanish-286.ts';
import {isShipCasket277,newShipCasketHolder277,shipCasketActor277,type ShipCasket277,type ShipCasketOccupant277} from './ship-casket-state-277.ts';
import {prepareShipCasketResume277,prepareShipCasketPossessionsResume277,cleanShipCasketTerminalHuman277} from './ship-casket-clock-277.ts';
import {prepareShipCasketTerminal277,prepareShipCasketSpawn277} from './ship-casket-notifications-277.ts';
import {cryptosleepDamageUntilDowned271} from './cryptosleep-removal-271.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {createMechaMedicalRecord} from './mechanoid-health.ts';
import {reconcileAnimalHealth} from './wildlife-health.ts';
import {cleanMapRemovedMechanical259} from './world-pawn-mechanical-259.ts';
import {MAX_WILDLIFE,type WildAnimal} from './wildlife-state.ts';
import type {Mechanoid} from './mechanoid-state.ts';
import {validShipCasketBuilding277} from './ship-casket-owner-save-277.ts';
import {createMedicalRecord,medicalStatus} from './injury-state.ts';
import {healthRandom,reconcilePawnHealth} from './health.ts';
import {markCorpseWornApparel284} from './apparel-provenance-284.ts';
import {captureStartingPlacePhysics256} from './starting-place-physics-256.ts';
import {findStartingPlaceNear256,type StartingPlaceThing256} from './starting-place-near-256.ts';
import {planSelectedDrops,releaseWork} from './work-release.ts';
import {constructionRecipe} from './construction-materials.ts';
import {groundCapacity,planGroundPlacement,nearbyGround} from './ground-placement.ts';
import {captureStandability} from './furniture-travel.ts';
import {addMaterial,materialCanFit,refreshStock} from './materials.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {materialAllowedForPlayer256,setMaterialForbidden256} from './material-permission-256.ts';
import {shipCasketCells277} from './ship-casket-geometry-277.ts';
import {SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {addFilth} from './filth.ts';
import {prepareRemovedFogStructure256,commitRemovedFogBlocker256,notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {releaseStructureMelee} from './melee-state.ts';
import {deconstructionAvailable,deconstructionDuration} from './deconstruction-rules.ts';
import {workProgress} from './work-progress.ts';
import {captureBombCells} from './bomb-cells.ts';
import {reconcileTemperature} from './temperature.ts';
import {bombInstigatorKey} from './bomb-state.ts';
import {ANCIENT_CASKET_FLAME_RADIUS_256} from './ancient-casket-explosive-state-256.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {actualCampRemovalAbsCore256} from './world-pawn-map-removed-256.ts';
import {preparePassedToWorld256} from './world-pawn-transition-256.ts';
import {validateWorldPawnOwners256} from './world-pawn-save-256.ts';
import {nativeWorldPawnOrderCurrent256,commitNativeWorldPawnOrder256} from './world-pawn-native-order-256.ts';
import {cancelWorldPawnGC256} from './world-pawn-gc-256.ts';
import {cleanMapRemovedAnimal256} from './world-lost-owners.ts';
import {unclaimDetachedActorBed256} from './actor-map-bed-256.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {captureHumanOwners} from './human-owners.ts';
import {fermentationContents265} from './fermentation-state-265.ts';
import type {WorldPawnOwner256,WorldPawnsState256} from './world-pawn-state-256.ts';
import type {StructureDamageCause,StructureDamageContext} from './thing-damage.ts';
import type {BombInstigatorKey} from './mini-turret-state.ts';
import type {MiniTurretBombWave} from './bomb-state.ts';
import type {Cell,MaterialPile,Pawn,Structure,World} from './types.ts';

const stamp=(v:unknown)=>JSON.stringify(v),int=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const adopt=<T extends object>(original:T,next:T)=>{for(const k of Object.keys(original))if(!Object.hasOwn(next,k))delete (original as Record<string,unknown>)[k];Object.assign(original,next);};
/** Preserve real faction/dossier/cohort objects across the single actor
 * adoption. Clinical and movement results remain the prepared draft values. */
function adoptActor277(original:Pawn|WildAnimal|Mechanoid,next:Pawn|WildAnimal|Mechanoid):void {
 const a=original as unknown as Record<string,unknown>,b=next as unknown as Record<string,unknown>,retained=new Map<string,object>();
 for(const key of ['worldAffiliation259','prisoner','prisonerHistory259','visitor','raid','podRescue','worldFaction259','temple','site263']){
  const before=a[key],after=b[key];if(before&&after&&typeof before==='object'&&typeof after==='object'){adopt(before,after);retained.set(key,before);}
 }
 adopt(original,next);for(const [key,value]of retained)a[key]=value;
}
export type ShipCasketRemoval277={ok:false;reason:string}|{ok:true;commit():boolean};

/** Historic maps have no Site3 physical provenance. Reuse their existing
 * connected-floor/standability rules rather than inventing a geographic
 * header. Site3 continues through the native ranked Near reader below. */
function legacyRemovalCell277(view:World,center:Cell):Cell|null {
 const standable=captureStandability(view),occupied=new Set<number>(),add=(actor:Cell&{motion?:{end:number;from:Cell;to:Cell}|null})=>{
  occupied.add(actor.z*view.width+actor.x);if(actor.motion&&actor.motion.end>view.tick){occupied.add(actor.motion.from.z*view.width+actor.motion.from.x);occupied.add(actor.motion.to.z*view.width+actor.motion.to.x);}
 };
 for(const p of view.pawns)if(!(p.state==='dead'&&p.body?.pileId!==undefined))add(p);
 for(const a of view.wildlife?.animals??[])if(a.state!=='dead')add(a);
 for(const a of view.mechanoids??[])if(a.state!=='dead')add(a);
 return nearbyGround(view,center).find(c=>standable(c)&&!occupied.has(c.z*view.width+c.x))??null;
}

/** Thing.Destroy(Vanish) keeps the same destroyed WorldPawn identity while
 * destroying gear. It does not manufacture clinical death or a corpse. */
function prepareVanish277(w:World,original:ShipCasketOccupant277,occupant:ShipCasketOccupant277,items:readonly MaterialPile[],packs:World['packed']) {
 const p=shipCasketActor277({revision:1,heldAt:w.tick,occupant:original,items:[],packed:[]})!;
 const draft=shipCasketActor277({revision:1,heldAt:w.tick,occupant,items:[],packed:[]})!;
 const root=registeredCampaign(w),state=root.worldPawns,factions=root.worldFactions,mapId=registeredMapId(w),now=w.tick*10;
 const physicalCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined;
 if(!state||!factions||mapId===undefined||root.tick!==w.tick||(physicalCore297===undefined?state.atCore!==now&&state.atCore!==now-10:state.atCore!==now||worldPawnsPhysicalCore297(state,w.schemaVersion)!==physicalCore297))throw Error('Actual destroyed-holder WorldPawn frontier is unavailable');
 const native=state.nativeOrder;if(!nativeWorldPawnOrderCurrent256(state,native))throw Error('Actual destroyed-holder native order is unavailable');
 const terminal=prepareShipCasketTerminal277(w,original);
 if(occupant.kind==='human'){cleanShipCasketTerminalHuman277(occupant.pawn,w.tick);if(occupant.pawn.mental?.wander)occupant.pawn.mental.wander.nextMoveOrderIsWait=true;}
 else if(occupant.kind==='animal')cleanMapRemovedAnimal256(occupant.animal,w.tick);
 else cleanMapRemovedMechanical259(occupant.mech,w.tick);
 if(occupant.kind!=='mechanical')unclaimDetachedActorBed256(occupant.kind==='human'?occupant.pawn:occupant.animal);delete draft.shipCryptosleepHeldAt277;
 const context={seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:w.climate}:{},...w.site?{site:w.site}:{},...w.scenario?{scenario:w.scenario}:{}};
 const common={originMapId:mapId,context,clockCore:physicalCore297===undefined?now:state.atCore,...physicalCore297!==undefined?{physicalClockCore297:physicalCore297}:{},enteredAtAbsCore:actualCampRemovalAbsCore256(root,w),mode:'dead' as const,...draft.health?.death?{}:{destroyed:true as const},items:[],packed:[],shipCasketTerminal277:terminal.receipt};
 const row:WorldPawnOwner256=occupant.kind==='human'?{...common,kind:'human',actor:occupant.pawn,factionId:occupant.pawn.worldAffiliation259?.factionId??null}
  :occupant.kind==='animal'?{...common,kind:'animal',actor:occupant.animal,factionId:occupant.animal.domestic?factions.playerFactionId:null}
  :{...common,kind:'mechanical',actor:occupant.mech,factionId:occupant.mech.worldFaction259?.factionId??null,mechanicalTimersAtCore259:physicalCore297??now};
 // A real local substep may precede this tick's global WorldPawn pass. Only
 // this terminal row is staged at now; other rows are neither ticked nor moved.
 const staged:WorldPawnsState256={...state,atCore:now,...physicalCore297!==undefined?{physicalClockCore297:physicalCore297}:{},owners:state.owners.slice()},pass=preparePassedToWorld256(staged,row,factions,{float(){throw Error('Destroyed actor does not draw a faction choice');}},{version:w.schemaVersion,situation:'Free'});
 if(!pass.ok)throw Error(pass.reason);pass.commit();pass.row.shipCasketTerminal277=terminal.receipt;const errors=validateWorldPawnOwners256(staged,root,new Set(),undefined,new Set(captureHumanOwners(w).people.keys()));if(errors.length)throw Error(errors[0]);
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
 return {quantities,materialLoss,fuelTicksLost,fuelTicksBurned,batteryEnergyLost,current:()=>terminal.current()&&root.worldPawns===state&&state.atCore===at&&(physicalCore297===undefined||physicalCore297===effectiveCore297(w)&&worldPawnsPhysicalCore297(state,w.schemaVersion)===physicalCore297)&&state.owners.length===membership.length&&state.owners.every((r,i)=>r===membership[i])&&nativeWorldPawnOrderCurrent256(state,native)&&masters.every(m=>stamp(m.actor)===m.before),commit(){
  cancelWorldPawnGC256(state);adoptActor277(p,pass.row.actor);if(pass.row.kind==='human')pass.row.actor=p as Pawn;else if(pass.row.kind==='animal')pass.row.actor=p as WildAnimal;else pass.row.actor=p as Mechanoid;state.owners.push(pass.row);commitNativeWorldPawnOrder256(state,native,order);if(!terminal.commit())throw Error('Actual spatial terminal notification changed within commit');for(const m of masters)m.actor.startingPet=m.after;
 }};
}

/** Paid casket only: base building removal/leavings, original clinical
 * contents, then an optional Flame wave. Destruction never calls Open. */
export function planShipCasketRemoval277(w:World,s:Structure,mode:'deconstruct'|'kill-finalize'|'vanish',explosion?:{core:number;instigatorKey?:BombInstigatorKey},damageRng=w.rng):ShipCasketRemoval277 {
 const no=(reason:string):ShipCasketRemoval277=>({ok:false,reason});
 if(!['deconstruct','kill-finalize','vanish'].includes(mode)||!isSchema277OrLater(w.schemaVersion)||!isShipCasket277(s)||!w.structures.includes(s)||!validShipCasketBuilding277(s,w.schemaVersion,w,w.tick,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined)||s.shipCryptosleep277.heldAt>w.tick||!int(damageRng)||damageRng>0xffffffff)return no('Actual paid spatial casket required');
 const c=s as ShipCasket277,h=c.shipCryptosleep277,occupant=h.occupant,p=shipCasketActor277(h),tick=w.tick,heldItems=h.items,heldPacks=h.packed,itemMembers=[...h.items],packMembers=[...h.packed];
 const plannedCore297=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined,physical297=plannedCore297===undefined?undefined:{version:297 as const,heldAtCore297:heldCore297(h,w.schemaVersion,h.heldAt),targetCore297:plannedCore297};
 const validInstigator=(key:unknown)=>bombInstigatorKey(key,w.schemaVersion)&&Number(key.slice(key.indexOf(':')+1))<w.nextId;
 if(explosion&&(mode!=='kill-finalize'||!int(explosion.core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?explosion.core!==effectiveCore297(w):explosion.core<Math.max(0,(tick-1)*10)||explosion.core>tick*10)||(w.bombWaves?.length??0)>=w.width*w.height||Object.hasOwn(explosion,'instigatorKey')&&!validInstigator(explosion.instigatorKey)))return no('Actual Flame owner/clock/capacity unavailable');
 const jobs=w.jobs.filter(j=>j.deconstruction?.structureId===c.id||j.repair?.structureId===c.id||j.fixBreakdown?.structureId===c.id),jobIds=new Set(jobs.map(j=>j.id));
 if(mode==='deconstruct'){
  const job=jobs.find(j=>j.deconstruction?.structureId===c.id),worker=job?w.pawns.find(p=>p.id===job.reservedBy&&p.jobId===job.id):undefined;
  if(!job||!worker||worker.state!=='working'||worker.moveCooldown||(worker.motion?.end??0)>tick||!shipCasketCells277(c,c.orientation).some(cell=>Math.abs(worker.x-cell.x)+Math.abs(worker.z-cell.z)===1)||workProgress(job)<deconstructionDuration(job)||!deconstructionAvailable(w,job,worker.id))return no('Actual completed deconstruction and contact required');
 }
 const workers=w.pawns.filter(q=>q.jobId!==null&&jobIds.has(q.jobId)||q.haul?.destination.type==='job'&&jobIds.has(q.haul.destination.jobId)||q.shipCasketTask277?.casketId===c.id),drops=planSelectedDrops(w,jobIds,new Set(workers.map(q=>q.id)));
 if(!drops)return no('Worker cargo has no actual place');
 if(w.piles.some(i=>i.owner.type==='job'&&jobIds.has(i.owner.jobId)))return no('Actual delivered maintenance cargo requires cancellation');
 const random={rng:damageRng},draw=()=>healthRandom(random),view:World={...w,structures:w.structures.filter(b=>b!==c),piles:w.piles.map(i=>({...i,owner:{...i.owner}})),packed:w.packed.map(i=>({...i,owner:{...i.owner}})),jobs:w.jobs.filter(j=>!jobIds.has(j.id)).map(j=>({...j,escrow:{...j.escrow}})),filth:w.filth?{...w.filth,items:w.filth.items.map(f=>({...f}))}:undefined};
 for(const i of view.piles){const cell=drops.get(i.id);if(cell)assignPileOwner(i,{type:'ground',...cell});}for(const i of view.packed){const cell=drops.get(i.building.id);if(cell)assignPileOwner(i,{type:'ground',...cell});}
 if(mode==='kill-finalize')for(const cell of shipCasketCells277(c,c.orientation))addFilth(view,cell,'building-rubble',1+Math.floor(draw()*3));
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
 let actorClock:ReturnType<typeof prepareShipCasketResume277>|undefined,goodsClock:ReturnType<typeof prepareShipCasketPossessionsResume277>|undefined,draft:Pawn|WildAnimal|Mechanoid|undefined,draftOccupant:ShipCasketOccupant277|undefined,cell:Cell|null=null,vanish:ReturnType<typeof prepareVanish277>|undefined,spawn:ReturnType<typeof prepareShipCasketSpawn277>|undefined;
 try{if(p&&occupant){
  if(p.shipCryptosleepHeldAt277!==h.heldAt||p.health?.death||[...w.pawns,...w.wildlife?.animals??[],...w.mechanoids??[]].some(q=>q.id===p.id))return no('Actual original spatial-casket occupant frontier changed');
  actorClock=prepareShipCasketResume277(occupant,h.heldAt,tick,physical297);goodsClock=prepareShipCasketPossessionsResume277(h.items,h.packed,tick-h.heldAt,physical297);
  draftOccupant=structuredClone(occupant);const resume=prepareShipCasketResume277(draftOccupant,h.heldAt,tick,physical297);if(!resume.commit())throw Error('Private spatial casket resume changed');
  draft=shipCasketActor277({revision:1,heldAt:tick,occupant:draftOccupant,items:[],packed:[]})!;delete draft.shipCryptosleepHeldAt277;
  if(mode==='kill-finalize'){
   draft.health??=draftOccupant.kind==='human'?createMedicalRecord(tick):draftOccupant.kind==='animal'?createAnimalMedicalRecord256(w,draftOccupant.animal):createMechaMedicalRecord(tick,draftOccupant.mech.mechKind);
   // Mechanical medicine is sparse, with no organic evolution. A new real
   // impact moves its record to now; every existing injury date stays literal.
   if(draftOccupant.kind==='mechanical')draft.health.tick=tick;
   draft.health=cryptosleepDamageUntilDowned271(draft.health,draw).record;const status=medicalStatus(draft.health);draft.state=status==='mobile'?'idle':status;
  }
  const actorCount=occupant.kind==='human'?w.pawns.length:occupant.kind==='animal'?w.wildlife?.animals.length??MAX_WILDLIFE:w.mechanoids?.length??0,actorLimit=occupant.kind==='animal'?MAX_WILDLIFE:w.width*w.height;
  if(mode!=='vanish'&&actorCount<actorLimit&&w.piles.length+h.items.length+products.length<=32768&&w.packed.length+h.packed.length<=32768){
   const ground=new Map<number,MaterialPile[]>();for(const i of view.piles)if(i.owner.type==='ground'){const key=i.owner.z*w.width+i.owner.x,list=ground.get(key)??[];list.push(i);ground.set(key,list);}
   // The read-only physical columns include actual base removal and leavings,
   // never a fake spawned occupant or a surrogate World for owner validation.
   if(view.site?.revision===3){const thing:StartingPlaceThing256={id:p.id,category:'pawn',quantity:1,stackLimit:1,downed:draft.state==='downed',saveCompressible:false},read=captureStartingPlacePhysics256(view,undefined,c,ground,[]);cell=findStartingPlaceNear256(c,thing,probe=>read(probe,thing));}
   else cell=legacyRemovalCell277(view,c);
  }
  if(!cell)vanish=prepareVanish277(w,occupant,draftOccupant,h.items,h.packed);else spawn=prepareShipCasketSpawn277(w,occupant);
 }}catch(error){return no(error instanceof Error?error.message:String(error));}
 // A destroyed terminal actor can have no possessions at all (notably a
 // mechanical original). Its WorldPawn receipt is still real, but an empty
 // material ledger would invent a counter and violate the strict save shape.
 const losesItems=!!vanish&&Object.keys(vanish.quantities).length>0;
 const losesPossessions=!!vanish&&(losesItems||vanish.materialLoss.size>0||isSchema286OrLater(w.schemaVersion)&&heldPacks.length>0||vanish.fuelTicksLost>0||vanish.fuelTicksBurned>0||vanish.batteryEnergyLost>0);
 // The family introduced in V286 counts the original packed buildings destroyed by this Vanish;
 // earlier action branches keep their historical counters unchanged.
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
  const costs=new Map(constructionRecipe(c).ingredients.map(row=>[row.item,row.quantity]));
  deconstructed.count++;deconstructed.lostSteel=(ledger.lostSteel??0)+(costs.get('steel')??0)-(returned.get('steel')??0);deconstructed.lostUranium=(ledger.lostUranium??0)+(costs.get('uranium')??0)-(returned.get('uranium')??0);deconstructed.lostComponents=(ledger.lostComponents??0)+(costs.get('component')??0)-(returned.get('component')??0);const advanced=(ledger.lostAdvancedComponents271??0)+(costs.get('advanced-component')??0)-(returned.get('advanced-component')??0);if(advanced)deconstructed.lostAdvancedComponents271=advanced;
 }
 if(![destroyed.count,...Object.values(destroyed.lost),...Object.values(destroyed.items??{}),destroyed.fuelTicksLost??0,destroyed.fuelTicksBurned??0,(destroyed.batteryEnergyLost??0)*2,deconstructed.count,deconstructed.lostSteel??0,deconstructed.lostUranium??0,deconstructed.lostComponents??0,deconstructed.lostAdvancedComponents271??0].every(int))return no('Actual casket loss counter exhausted');
 let wave:MiniTurretBombWave|undefined;if(explosion){if(!Number.isSafeInteger(view.nextId+1))return no('Actual Flame ID exhausted');wave={id:view.nextId++,sourceId:c.id,center:{x:c.x,z:c.z},...explosion.instigatorKey?{instigatorKey:explosion.instigatorKey}:{},startedAtCore:explosion.core,advancedAtCore:explosion.core,cells:captureBombCells(view,c,ANCIENT_CASKET_FLAME_RADIUS_256,true),nextCell:0,damagedThingKeys:[],casketExplosion:{ship277:true,ignoredThingKeys:[...ignored].sort()}};}
 const linkedResult=vanish?prepareLinkedCasketVanish286(w,c,'shipCryptosleep277',heldPacks):undefined;if(linkedResult&&!linkedResult.ok)return no(linkedResult.reason);const linked=linkedResult?.ok?linkedResult.plan:undefined;
 const structures=w.structures,piles=w.piles,packed=w.packed,actualJobs=w.jobs,pawns=w.pawns,wildlife=w.wildlife,animals=wildlife?.animals,mechs=w.mechanoids,collections=[structures,piles,packed,actualJobs,pawns,...animals?[animals]:[],...mechs?[mechs]:[]],memberships=collections.map(a=>[...a]),source=stamp(c),records=[...structures,...piles,...packed,...actualJobs,...pawns,...animals??[],...mechs??[]],before=records.map(stamp),nextId=w.nextId,rng=w.rng,filth=w.filth,filthBefore=stamp(filth),destroyedBefore=stamp(w.destroyed),ledgerBefore=stamp(ledger),fog=prepareRemovedFogStructure256(w,c),tiles=w.tiles,terrainBefore=stamp([w.tiles,w.resources,w.stockpiles]),waves=w.bombWaves,wavesBefore=stamp(waves);let used=false;
 return {ok:true,commit(){
  if(used||w.tick!==tick||plannedCore297!==undefined&&plannedCore297!==effectiveCore297(w)||w.nextId!==nextId||w.rng!==rng||w.structures!==structures||w.piles!==piles||w.packed!==packed||w.jobs!==actualJobs||w.pawns!==pawns||w.wildlife!==wildlife||w.wildlife?.animals!==animals||w.mechanoids!==mechs||collections.some((a,i)=>a.length!==memberships[i]!.length||a.some((v,n)=>v!==memberships[i]![n]))||!structures.includes(c)||c.shipCryptosleep277!==h||h.occupant!==occupant||shipCasketActor277(h)!==p||h.items!==heldItems||h.packed!==heldPacks||heldItems.length!==itemMembers.length||heldItems.some((v,i)=>v!==itemMembers[i])||heldPacks.length!==packMembers.length||heldPacks.some((v,i)=>v!==packMembers[i])||stamp(c)!==source||records.some((v,i)=>stamp(v)!==before[i])||w.filth!==filth||stamp(filth)!==filthBefore||stamp(w.destroyed)!==destroyedBefore||w.deconstructed!==ledger||stamp(ledger)!==ledgerBefore||w.tiles!==tiles||stamp([w.tiles,w.resources,w.stockpiles])!==terrainBefore||w.bombWaves!==waves||stamp(waves)!==wavesBefore||actorClock&&!actorClock.current()||goodsClock&&!goodsClock.current()||vanish&&!vanish.current()||spawn&&!spawn.current()||linked&&!linked.current())return false;
  // Adopt the staged product/downing stream before real interruption/health
  // notifiers. Any further real draw remains owned and is never overwritten.
  linked?.begin();used=true;w.rng=random.rng;for(const worker of workers)if(!releaseWork(w,worker,drops))throw Error('Casket worker cargo changed within commit');w.jobs=w.jobs.filter(j=>!jobIds.has(j.id));for(const q of w.pawns)q.orders.queue=q.orders.queue.filter(o=>typeof o!=='number'||!jobIds.has(o));
  w.structures=w.structures.filter(b=>b!==c);releaseStructureMelee(w,c.id);if(rubble.filth)w.filth=rubble.filth;w.nextId=rubble.nextId;
  for(const product of products){addMaterial(w,ITEM_DEFINITIONS[product.item].kind,product.quantity,{type:'ground',...product.cell},product.item);const actual=w.piles.find(i=>i.id===product.id);if(!actual)throw Error('Casket leaving identity changed within commit');setMaterialForbidden256(actual,product.forbidden);}
  if(actorClock&&!actorClock.commit()||goodsClock&&!goodsClock.commit())throw Error('Casket suspension changed within commit');
  linked?.commit();
  if(p&&draft&&occupant){if(vanish)vanish.commit();else{
   adoptActor277(p,draft);Object.assign(p,cell!);w.piles=[...w.piles,...h.items];w.packed=[...w.packed,...h.packed];
   if(occupant.kind==='human')w.pawns=[...w.pawns,occupant.pawn];
   else if(occupant.kind==='animal')w.wildlife!.animals.push(occupant.animal);
   else w.mechanoids=[...(w.mechanoids??[]),occupant.mech];
   if(spawn&&!spawn.commit())throw Error('Actual spatial spawn notification changed within commit');
    if(occupant.kind==='human'){markCorpseWornApparel284(h.items,occupant.pawn,w.schemaVersion);reconcilePawnHealth(w,occupant.pawn,undefined,true);}else if(occupant.kind==='animal')reconcileAnimalHealth(w,occupant.animal);
   notifyActualExplorationSpawn256(w,p);
  }}
  c.shipCryptosleep277=newShipCasketHolder277(tick);if(mode==='deconstruct')w.deconstructed=deconstructed;if(mode==='kill-finalize'||losesPossessions)w.destroyed=destroyed;
  for(const q of w.pawns)if(q.bombRefuge?.sourceId===c.id){q.bombRefuge.endCore=Math.min(q.bombRefuge.endCore,explosion?.core??tick*10);if(!q.moveCooldown&&(q.motion?.end??0)<=tick&&!q.melee?.strike&&!q.shooting?.stance&&!q.stun){delete q.bombRefuge;q.path=[];if(q.state!=='dead'&&q.state!=='downed')q.state='idle';}}
  if(wave){w.nextId=wave.id+1;w.bombWaves=[...(w.bombWaves??[]),wave].sort((a,b)=>a.id-b.id);const layout=reconcileTemperature(w),region=w.thermal?.regions[layout.indices[c.z*w.width+c.x]!];if(region)region.temperature=Math.min(1000,region.temperature+15*wave.cells.length/region.cells.length);}
  refreshStock(w);commitRemovedFogBlocker256(w,fog);return true;
 }};
}

export function damageShipCasket277(w:World,s:Structure,amount:number,cause:StructureDamageCause,rng:number,external?:StructureDamageContext):boolean {
 if(!isSchema277OrLater(w.schemaVersion)||!isShipCasket277(s)||!w.structures.includes(s)||!validShipCasketBuilding277(s,w.schemaVersion,w,w.tick,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined)||s.shipCryptosleep277.heldAt>w.tick||!int(amount)||amount===0||!int(rng)||rng>0xffffffff)return false;
 const core=external?.core??(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10);if(external&&(!Number.isFinite(external.rawAmount)||external.rawAmount<0||!int(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10)||Object.hasOwn(external,'instigatorKey')&&(!bombInstigatorKey(external.instigatorKey,w.schemaVersion)||Number(external.instigatorKey.slice(external.instigatorKey.indexOf(':')+1))>=w.nextId)))return false;
 const max=SHIP_CASKET_CONTENT_277.maxHitPoints,before=s.damage??0,damage=before+amount;if(!int(damage)||!Number.isSafeInteger(core+150))return false;
 if(external?.detonate&&(!s.casketWick||s.casketWick.endCore>core))return false;
 const detonates=!!external?.detonate||(external?.rawAmount??amount)>=max-before;
 if(detonates||damage>=max){const instigatorKey=external?.detonate?s.casketWick?.instigatorKey:external?.instigatorKey,plan=planShipCasketRemoval277(w,s,'kill-finalize',detonates?{core,...instigatorKey?{instigatorKey}:{}}:undefined,rng);return plan.ok&&plan.commit();}
 s.damage=damage;if(cause!=='fire')w.rng=rng;if(damage>=max-SHIP_CASKET_CONTENT_277.wickRemainingHitPoints&&!s.casketWick){const random={rng:w.rng},duration=140+Math.floor(healthRandom(random)*11);w.rng=random.rng;s.casketWick={startedAtCore:core,endCore:core+duration,...external?.instigatorKey?{instigatorKey:external.instigatorKey}:{}};}return true;
}
