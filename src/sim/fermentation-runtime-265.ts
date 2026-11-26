import {structureFamily379} from './structure-family-379.ts';
import {splicePileEntries} from './pile-identity-directory.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {FERMENTING_CAPACITY_265,FERMENTING_DURATION_CORE_265,FERMENTING_SERVICE_TICKS_265,fermentationSpeed265,type BarrelExtractionTask265} from './fermentation-state-265.ts';
import {temperatureAt,TemperatureView} from './temperature.ts';
import type {ThermalLayout} from './thermal-topology.ts';
import {haulReservations} from './haul-reservations.ts';
import {reservedSource,addMaterial,refreshStock} from './materials.ts';
import {planGroundPlacement} from './ground-placement.ts';
import {ticksUntilRot} from './food-preservation.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {allowedAreaAllows,allowedAreaWorkAllowed} from './allowed-area-state.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {medicalWorkRefusal,pawnBody} from './health-rules.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {workPriority} from './work-types.ts';
import {routeToJob,type Reachability} from './pathfinding.ts';
import {carryStackLimit379,carryQuantityBound379} from './carry-quantity-379.ts';
import type {Cell,HaulDestination,MaterialPile,Pawn,Structure,World} from './types.ts';
const f=Math.fround;
const near=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
const blockedBarrel=(w:World,s:Structure)=>w.jobs.some(j=>j.deconstruction?.structureId===s.id||j.furniture?.structureId===s.id)||w.fires?.items.some(f=>f.attachedPawnId===undefined&&f.attachedAnimalId===undefined&&f.x===s.x&&f.z===s.z);
const actualBarrel=(w:World,id:number)=>w.structures.find(s=>s.id===id&&s.kind==='fermenting-barrel'&&s.fermentation&&targetBuildingPlayerUse263(w,s));
const capable=(w:World,p:Pawn)=>!backgroundWorkRefusal(p,'haul')&&!medicalWorkRefusal(p)&&!p.collapsePending&&(p.faction??'colony')==='colony'&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!p.draft&&!p.stun&&!p.burning&&!p.mental?.crisis&&p.state!=='dead'&&p.state!=='downed'&&pawnBody(p).capacities.manipulation>0&&allowedAreaWorkAllowed(w,p)&&workPriority(p,'haul')>0;

export function barrelFillAllowed265(w:World,s:Structure):boolean {
  if(!isSchema265OrLater(w.schemaVersion)||s.kind!=='fermenting-barrel'||!s.fermentation||s.fermentation.progress>=1||s.fermentation.wort>=25||blockedBarrel(w,s))return false;
  const t=temperatureAt(w,s);return t>=1&&t<=30;
}
export function barrelFreeCapacity265(w:World,id:number,exceptPawn?:number):number {
  const s=actualBarrel(w,id);if(!s||!barrelFillAllowed265(w,s)||w.pawns.some(p=>p.id!==exceptPawn&&p.brewing?.barrelId===id))return 0;
  // Barrel reservation is exclusive, not merely a remaining-volume promise.
  if(haulReservations(w,exceptPawn).some(h=>h.destination.type==='fermenting-barrel'&&h.destination.structureId===id))return 0;
  return FERMENTING_CAPACITY_265-s.fermentation!.wort;
}
/** Commit only after generic haul has brought its actual carried pile to the
 * barrel and spent200Core. The old pile ceases to exist at incorporation. */
export function finishBarrelFill265(w:World,p:Pawn,carry:MaterialPile):boolean {
  const task=p.haul;if(!task||task.destination.type!=='fermenting-barrel'||task.phase!=='deliver'||task.carryPileId!==carry.id||!Number.isSafeInteger(task.quantity)||task.quantity<1||task.quantity>carryQuantityBound379(w,carry.item)||(task.serviceProgress??0)<FERMENTING_SERVICE_TICKS_265||(p.motion?.end??0)>w.tick||p.moveCooldown>0||!capable(w,p)||!w.piles.includes(carry)||!materialAllowedForPlayer256(carry)||carry.item!=='wort'||carry.owner.type!=='pawn'||carry.owner.pawnId!==p.id||carry.quantity!==task.quantity||ticksUntilRot(carry,w.tick)<=0)return false;
  const s=actualBarrel(w,task.destination.structureId);
  if(!s||!near(p,s)||barrelFreeCapacity265(w,s.id,p.id)<carry.quantity)return false;
  const state=s.fermentation!,total=state.wort+carry.quantity;
  state.progress=f(f(state.progress*state.wort)/total);state.wort=total;state.ruin=0;
  splicePileEntries(w.piles,w.piles.indexOf(carry),1);refreshStock(w);return true;
}
/** Exactly once after the actual thermal step. Rare scheduling uses the
 * product's stable thing-ID phase; Unity's internal ticker slot is not copied.
 * Only installed barrels advance. Packed/transit content is deliberately idle. */
export function advanceFermentation265(w:World,layout?:ThermalLayout):void {
  if(!isSchema265OrLater(w.schemaVersion))return;
  let view:TemperatureView|undefined;
  for(const s of structureFamily379(w,'fermenting-barrels',kind=>kind==='fermenting-barrel')){
    const state=s.fermentation;if(s.kind!=='fermenting-barrel'||!state)continue;
    const from=(w.tick-1)*10+1,to=w.tick*10;
    if(Math.floor((from+s.id-1)/250)===Math.floor((to+s.id)/250))continue;
    const temperature=layout?(view??=new TemperatureView(w,layout)).at(w,s):temperatureAt(w,s);
    const progress=state.wort>0&&state.progress<1?Math.min(1,f(state.progress+f(250/FERMENTING_DURATION_CORE_265*fermentationSpeed265(temperature)))):state.progress;
    const outside=temperature<-1?-1-temperature:temperature>32?temperature-32:0;
    // Primary CompTickRare invokes the ruin reader ONCE: no ×250 here.
    const ruin=outside>0&&state.ruin<1?Math.min(1,f(state.ruin+f(outside*.00001))):state.ruin;
    if(ruin>=1&&state.wort>0&&!Number.isSafeInteger((w.spoiled.wort??0)+state.wort))continue;
    state.progress=progress;state.ruin=ruin;
    if(ruin>=1&&state.wort>0){w.spoiled.wort=(w.spoiled.wort??0)+state.wort;state.wort=0;state.progress=0;}
  }
}
export function fermentationInspection265(w:World,s:Structure){
  const state=s.fermentation;if(s.kind!=='fermenting-barrel'||!state)return undefined;
  const temperature=temperatureAt(w,s);
  return {...state,capacity:25,temperature,factor:fermentationSpeed265(temperature),fermented:state.wort>0&&state.progress>=1,fillAllowed:barrelFillAllowed265(w,s)};
}
export interface BarrelFillCandidate265 {priority:number;rank:number;distance:number;id:number;sourceId:number;quantity:number;destination:HaulDestination;target:Cell}
export function fermentationHaulCandidates265(w:World,p:Pawn,reach:Reachability):BarrelFillCandidate265[] {
  if(!isSchema265OrLater(w.schemaVersion)||!capable(w,p))return [];
  const results:BarrelFillCandidate265[]=[];
  for(const s of structureFamily379(w,'fermenting-barrels',kind=>kind==='fermenting-barrel')){
    if(s.kind!=='fermenting-barrel')continue;
    const capacity=barrelFreeCapacity265(w,s.id,p.id);if(!capacity||!allowedAreaAllows(w,p,s)||!routeToJob(w,s,reach))continue;
    for(const pile of w.piles){
      if(pile.item!=='wort'||pile.owner.type!=='ground'||!materialAllowedForPlayer256(pile)||ticksUntilRot(pile,w.tick)<=0||!allowedAreaAllows(w,p,pile.owner))continue;
      const quantity=Math.min(carryStackLimit379(w,p,pile.item),capacity,pile.quantity-reservedSource(w,pile.id,p.id));
      if(quantity<=0||!routeToJob(w,pile.owner,reach,true))continue;
      results.push({priority:workPriority(p,'haul'),rank:-1.9,distance:Math.abs(p.x-pile.owner.x)+Math.abs(p.z-pile.owner.z)+Math.abs(s.x-pile.owner.x)+Math.abs(s.z-pile.owner.z),id:pile.id,sourceId:pile.id,quantity,destination:{type:'fermenting-barrel',structureId:s.id},target:pile.owner});
    }
  }
  return results;
}
export function barrelExtractionProposal265(w:World,p:Pawn,reach:Reachability):{task:BarrelExtractionTask265;path:Cell[]}|null {
  if(!isSchema265OrLater(w.schemaVersion)||!capable(w,p))return null;
  const reserved=reservedServiceCells(w,p.id);
  for(const s of structureFamily379(w,'fermenting-barrels',kind=>kind==='fermenting-barrel').filter(s=>s.kind==='fermenting-barrel'&&s.fermentation&&s.fermentation.wort>0&&s.fermentation.progress>=1).sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.z-p.z)-Math.abs(b.x-p.x)-Math.abs(b.z-p.z)||a.id-b.id)){
    if(!targetBuildingPlayerUse263(w,s)||blockedBarrel(w,s)||!allowedAreaAllows(w,p,s)||w.pawns.some(q=>q.id!==p.id&&q.brewing?.barrelId===s.id)||haulReservations(w,p.id).some(h=>h.destination.type==='fermenting-barrel'&&h.destination.structureId===s.id))continue;
    const path=routeToJob(w,s,reach);if(!path)continue;const spot=path.at(-1)??{x:p.x,z:p.z};
    if(reserved.has(spot.z*w.width+spot.x)||!allowedAreaAllows(w,p,spot))continue;
    return {task:{barrelId:s.id,spot:{...spot},progress:0},path};
  }return null;
}
export function processBarrelExtraction265(w:World,p:Pawn,move:(target:Cell,allowTarget:boolean)=>void,wake:()=>void):void {
  const task=p.brewing;if(!task)return;const s=actualBarrel(w,task.barrelId),state=s?.fermentation;
  const stop=()=>{delete p.brewing;p.path=[];p.state='idle';p.planCooldown=0;};
  if(!capable(w,p)||!s||!state||state.wort<=0||state.progress<1||blockedBarrel(w,s)||!allowedAreaAllows(w,p,s)||!allowedAreaAllows(w,p,task.spot)){stop();return;}
  if(p.x!==task.spot.x||p.z!==task.spot.z){move(task.spot,true);return;}
  if(!near(p,s)){stop();return;}if((p.motion?.end??0)>w.tick||p.moveCooldown>0)return;
  p.path=[];p.state='working';task.progress=Math.min(FERMENTING_SERVICE_TICKS_265,task.progress+1);
  if(task.progress<FERMENTING_SERVICE_TICKS_265)return;
  const drops=planGroundPlacement(w,state.wort,p,'beer');
  if(!drops||w.piles.length+drops.length>32768||!Number.isSafeInteger(w.nextId+drops.length))return;
  for(const d of drops)addMaterial(w,'beer',d.quantity,{type:'ground',...d.cell},'beer');
  state.wort=0;state.progress=0;stop();wake();
}
