import type {ImportContext} from './convert.ts';
import {num,text,items,type XmlNode} from './xml.ts';
import {readThing,referencedThingId} from './rws-save.ts';
import type {Cell,MaterialPile} from '../../sim/types.ts';
import {animalWanderWaitEnd304} from '../../sim/animal-idle-wander-304.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {createAnimalNavigationReader} from '../../sim/wildlife-navigation.ts';
import {adultAgeTicks} from '../../sim/animal-life.ts';
import {slaughterIntent} from '../../sim/auto-slaughter.ts';
import {animalClaimed} from '../../sim/animal-rest-state.ts';
import {placeRwsMaterial} from './convert-items.ts';
import {storageCellAccepts,storageCells} from '../../sim/shelf-storage.ts';
import {validAnimalHaulField282} from '../../sim/animal-training-save-282.ts';
import {readAnimalTraining282} from '../../sim/animal-training-282.ts';
import {reservedSourcesByPile,refreshStock} from '../../sim/materials.ts';
import {animalHaulPileAllowed282} from '../../sim/animal-hauling-282.ts';
import {ITEM_DEFINITIONS} from '../../sim/items.ts';
import {designateHunt} from '../../sim/hunting.ts';
import {applyTaming} from '../../sim/animal-handling.ts';
import {designateSlaughter} from '../../sim/animal-slaughter.ts';
import {designateReleaseWild364} from '../../sim/execute-release-364.ts';

function cell(raw:string|undefined):Cell|undefined {
 const parsed=raw&&/^\(\s*(-?\d+)\s*,\s*-?\d+\s*,\s*(-?\d+)\s*\)$/.exec(raw);
 if(parsed)return {x:Number(parsed[1]),z:Number(parsed[2])};
 return undefined;
}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const adjacent=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
const bool=(value:string|undefined)=>value==='True';
const suffix=(id:string):number|undefined=>{const n=/\d+$/.exec(id);return n?Number(n[0]):undefined;};
/** Import the actual player-issued designation through its native command,
 * before any matching handler or hunting task is admitted. */
export function importAnimalDesignations(ctx:ImportContext):void {
 const {w,notes}=ctx,animals=new Set(w.wildlife?.animals.map(a=>a.id)??[]);
 for(const n of items(ctx.map.node,'designationManager/allDesignations')){
  const def=text(n,'def');if(def!=='Hunt'&&def!=='Tame'&&def!=='Slaughter'&&def!=='ReleaseAnimalToWild')continue;
  const ref=referencedThingId(text(n,'target')),id=ref?ctx.thingIds.get(ref):undefined;
  if(id===undefined||!animals.has(id)){notes.def('active-jobs',def,'dropped',undefined,'Animal cible non importé.');continue;}
  const result=def==='Hunt'?designateHunt(w,{type:'hunt',animalId:id,enabled:true}):
   def==='Tame'?applyTaming(w,{type:'tame',animalId:id,enabled:true}):
   def==='Slaughter'?designateSlaughter(w,{type:'slaughter',animalId:id,enabled:true}):
   designateReleaseWild364(w,{type:'release-wild',animalId:id,enabled:true});
  notes.def('active-jobs',def,result.ok?'exact':'dropped',undefined,result.ok?undefined:result.reason);
 }
}
/** Rebind source activity to existing native owner. A path is recovered by
 * the actual navigation kernel from Core's saved destination, never by
 * synthesizing an unproven partial physical movement edge.
 * Called after storage, area, pen and animal-human references are known. */
export function importAnimalJobs(ctx:ImportContext):void {
 const {w,notes}=ctx,owners=w.wildlife?.animals??[],byId=new Map(owners.map(a=>[a.id,a])),
  sources=new Map(ctx.map.things.flatMap(t=>{const id=ctx.thingIds.get(t.id);return id===undefined||!byId.has(id)?[]:[[id,t] as const];}));
 const nav=createAnimalNavigationReader(w),claimedMates=new Set<number>(),sleepingSpots=new Set<number>();
 const nowCore=effectiveCore297(w),sourceCore=ctx.save.ticksGame;
 const ref=(node:XmlNode,path:string)=>{const raw=referencedThingId(text(node,path));return raw?ctx.thingIds.get(raw):undefined;};
 const targetCell=(node:XmlNode,path:string)=>{const raw=cell(text(node,path));return raw?ctx.coordinates.cell(raw):undefined;};
 const translated=(core:number)=>nowCore-(sourceCore-core);
 const failure=(job:string,reason:string)=>notes.def('animals','Activité animale : '+job,'dropped',undefined,reason);
 const success=(job:string,adaptation?:string)=>notes.def('animals','Activité animale : '+job,adaptation?'adapted':'exact',undefined,adaptation);
 for(const a of owners){
  const t=sources.get(a.id);if(!t)continue;
  const n=t.node,job=text(n,'jobs/curJob/def');
  // Animal personal cargo already has a native inventory owner; unlike a
  // human's carry slot, hauling animals use that owner during delivery too.
  const cargo: {pile:MaterialPile,source:ReturnType<typeof readThing>}[]=[];
  for(const row of items(n,'inventory/innerContainer/innerList')){
   const source=readThing(row);if(!ctx.thingIds.has(source.id))placeRwsMaterial(ctx,source,{type:'inventory',pawnId:a.id});
  }
  for(const row of items(n,'carryTracker/innerContainer/innerList')){
   const source=readThing(row),existing=ctx.thingIds.get(source.id);
   const pile=existing!==undefined?w.piles.find(p=>p.id===existing):placeRwsMaterial(ctx,source,{type:'inventory',pawnId:a.id});
   if(pile?.owner.type==='inventory'&&pile.owner.pawnId===a.id)cargo.push({pile,source});
  }
  // Preserve the actual physical owner even when its former destination
  // cannot be admitted. Holding is native Near-cleanup, not a dummy pile.
  const holdCargo=()=>{
   const held=cargo[0]?.pile;
   if(held&&a.training&&!a.haul){
    const core=Math.max(a.training.sinceCore,Math.min(w.tick*10,Math.floor(nowCore/10)*10));
    a.training.lastHaulCheckCore=core;a.haul={phase:'holding',carryPileId:held.id,sinceCore:core};
    if(!validAnimalHaulField282(a,w.schemaVersion,w.tick,w.nextId,w.width,w.height,true)){
     delete a.haul;delete a.training.lastHaulCheckCore;
    }
   }
  };
  if(!job||job==='Wait_MaintainPosture'||job==='Wait'){holdCargo();continue;}
  if(claimedMates.has(a.id)){failure(job,'Partenaire déjà engagé dans l’accouplement importé.');continue;}
  // Already downed or claimed humans' medical/handling owner is authoritative.
  if(a.state==='dead'||a.state==='downed'||animalClaimed(w,a.id)){holdCargo();failure(job,'Animal non mobile ou déjà pris en charge.');continue;}
  if(job==='Wait_Wander'){
   const id=suffix(t.id),start=num(n,'jobs/curJob/startTick'),expiry=num(n,'jobs/curJob/expiryInterval');
   if(!a.wander||id===undefined||!Number.isSafeInteger(id)||start===undefined||!Number.isSafeInteger(start)||expiry===undefined||!Number.isSafeInteger(expiry)||expiry<1||expiry>240){
    failure(job,'Échéance de promenade absente ou invalide.');continue;
   }
   try {
    const deadline=translated(animalWanderWaitEnd304(id,start,expiry));
    if(deadline<0||deadline>w.tick*10+500){failure(job,'Échéance de promenade hors de la fenêtre native.');continue;}
    a.wander.job={kind:'wait',untilCore:deadline};a.state='idle';a.path=[];
    a.nextDecision=Math.max(w.tick,Math.ceil(deadline/10));success(job);
   }catch{failure(job,'Échéance de promenade indéterminable.');}
   continue;
  }
  if(job==='GotoWander'){
   const destination=targetCell(n,'jobs/curJob/targetA')??targetCell(n,'pather/destination');
   if(!a.wander||!destination||!ctx.inside(destination)){failure(job,'Destination absente ou hors carte.');continue;}
   if(same(a,destination)){
    success(job,'Animal déjà sur la destination ; mouvement suivant recalculé.');continue;
   }
   const search=nav(a).idleWanderSearch(a);
   let path:Cell[]|undefined;
   try{path=search.pathTo(destination);}finally{search.release();}
   if(!path?.length){failure(job,'Destination inaccessible sur la carte reconstruite.');continue;}
   a.wander.job={kind:'goto',destination};a.path=path;a.state='moving';a.nextDecision=w.tick;
   success(job,'Destination et activité conservées ; route restante recomputée (pas du déplacement partiel).');
   continue;
  }
  if(job==='LayDown'){
   if(!bool(text(n,'jobs/curDriver/asleep'))){failure(job,'Repos en approche ou en phase non dormante.');continue;}
   const spotId=ref(n,'jobs/curJob/targetA'),spot=spotId!==undefined?w.structures.find(s=>s.id===spotId):undefined,
    validSpot=spot&&spot.kind==='animal-sleeping-spot'&&same(a,spot)&&!!a.domestic&&!slaughterIntent(w,a)&&
      (spot.medical?a.domestic.care!=='none':a.domestic.bedId===spot.id)&&!sleepingSpots.has(spot.id);
   a.state='sleeping';a.path=[];
   if(validSpot){a.animalRest={spotId:spot.id,phase:'sleep'};sleepingSpots.add(spot.id);success(job);}
   else success(job,spotId!==undefined?'Sommeil repris, couchage physique, affectation ou exclusivité non représentable.':undefined);
   continue;
  }
  if(job==='Mate'){
   const target=ref(n,'jobs/curJob/targetA'),female=target!==undefined?byId.get(target):undefined;
   if(a.sex!=='male'||!a.domestic||a.ageTicks<adultAgeTicks(a.species)||!female||female.sex!=='female'||!female.domestic||female.species!==a.species||
    female.state==='dead'||female.state==='downed'||female.state==='sleeping'||female.pregnancy||female.ageTicks<adultAgeTicks(female.species)||claimedMates.has(female.id)){
    failure(job,'Partenaire vivant, disponible ou de même espèce non représentable.');continue;
   }
   const index=num(n,'jobs/curDriver/curToilIndex'),left=num(n,'jobs/curDriver/ticksLeftThisToil');
   let progress=0;
   if(index===1&&left!==undefined&&left>=0&&left<=500&&adjacent(a,female))progress=Math.max(0,Math.min(49,Math.floor((500-left)/10)));
   const candidate={femaleId:female.id,progress};a.mating=candidate;
   // The real animal-life kernel owns the approach, and it will compute the
   // precise route on the first actual simulation boundary. No path guessed.
   a.path=[];a.state='idle';a.nextDecision=w.tick;
   if(female.wander?.job?.kind==='goto'||female.wander?.job?.kind==='wait')delete female.wander.job;
   female.path=[];
   if(female.state==='moving')female.state='idle';
   claimedMates.add(female.id);
   success(job,'Partenaire et progression locale conservés ; reste Core inférieur au tick local non représentable.');
   continue;
  }
  if(job==='HaulToCell'){
   const sourceId=ref(n,'jobs/curJob/targetA'),target=targetCell(n,'jobs/curJob/targetB'),
    destination=target?storageCells(w).find(c=>same(c,target)):undefined;
   const item=cargo[0]?.pile??(sourceId!==undefined?w.piles.find(p=>p.id===sourceId):undefined);
   if(!a.training||!a.domestic||!readAnimalTraining282(a,'haul').learned||!readAnimalTraining282(a,'obedience').learned||!item||
      !destination||!storageCellAccepts(w,destination,item)||!animalHaulPileAllowed282(w,item)){
    holdCargo();failure(job,'Cargaison, dressage ou destination de stockage non représentable ; objet transporté conservé dans l’inventaire.');continue;
   }
   const carry=cargo[0],start=num(n,'jobs/curJob/startTick'),startedAtCore=Math.max(a.training.sinceCore,Math.min(w.tick*10,Math.floor((start===undefined?nowCore:translated(start))/10)*10));
   a.training.lastHaulCheckCore=startedAtCore;
   const base={sourcePileId:item.id,destination:{type:'stockpile' as const,stockpileId:destination.id},startedAtCore};
   if(carry){
    const raw=carry.source.pos,pickup=raw?ctx.coordinates.cell(raw):undefined;
    a.haul={...base,quantity:item.quantity,phase:'deliver',carryPileId:item.id,pickupCell:pickup&&ctx.inside(pickup)?pickup:{x:a.x,z:a.z}};
   }else if(item.owner.type==='ground'){
    const reserved=reservedSourcesByPile(w).get(item.id)??0,
     quantity=Math.min(Math.round(num(n,'jobs/curJob/count')??item.quantity),item.quantity-reserved,ITEM_DEFINITIONS[item.item].stackLimit);
    if(quantity>0)a.haul={...base,quantity,phase:'pickup',carryPileId:null};
   }
   if(!a.haul||!validAnimalHaulField282(a,w.schemaVersion,w.tick,w.nextId,w.width,w.height,true)){
    delete a.haul;holdCargo();failure(job,'Réservation ou quantité incompatible ; cargaison physique conservée.');continue;
   }
   // A native haul task can re-route on the first actual decision boundary.
   // Preserve the source task even before that path recomputation.
   if(a.wander?.job)delete a.wander.job;
   a.path=[];a.state='idle';a.nextDecision=w.tick;
   success(job,'Objet, quantité physique et destination réelles conservés ; route à reprendre sur la carte convertie.');
   continue;
  }
  else failure(job,'Famille d’activité animale non importée dans ce lot.');
 }
 refreshStock(w);
}
