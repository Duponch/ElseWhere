/** Resume only jobs whose actual actor, target and present stage can be
 * expressed by the simulation. Core does not save the complete path; the
 * local motor will find its next route from the already imported cell. */
import type {ImportContext} from './convert.ts';
import type {Cell,Job,Pawn,HaulDestination} from '../../sim/types.ts';
import type {CookingIngredient,CookingTask} from '../../sim/cooking-types.ts';
import type {ProductionIngredient} from '../../sim/production-recipes.ts';
import {at,items,num,text,type XmlNode} from './xml.ts';
import {referencedThingId} from './rws-save.ts';
import {workPriority,haulingWork,workType} from '../../sim/work-types.ts';
import {storageCells,storageCellAccepts} from '../../sim/shelf-storage.ts';
import {groundCapacity,storageCapacity} from '../../sim/ground-placement.ts';
import {reservedSource} from '../../sim/materials.ts';
import {fuelCapacity,fuelItem} from '../../sim/fuel.ts';
import {cookingSpot,ingredientPlaceFree,ingredientWithinReach,componentWorkpiecePlaceFree} from '../../sim/cooking-bills.ts';
import {productionResearchUnlocked,productionWorkerQualified} from '../../sim/machining.ts';
import {billWork,PRODUCTION_RECIPES,productionWorkTotal} from '../../sim/production-recipes.ts';
import {validateCooking} from '../../sim/cooking-save.ts';
import {validateResearch} from '../../sim/research-save.ts';
import {nearbyResearchFacility,needsResearchAnalyzer} from '../../sim/research.ts';
import {validateRecreation} from '../../sim/recreation-save.ts';
import {isDiningSeat,seatAt} from '../../sim/dining.ts';
import {recreationSiteValid} from '../../sim/recreation-space.ts';
import {footprintCells} from '../../sim/definitions.ts';
import {growingJobValid,jobDuration} from '../../sim/farming.ts';
import {setWorkUnits} from '../../sim/work-progress.ts';
import {canStandAt} from '../../sim/furniture-travel.ts';
import {pawnBedSlot,bedSlotCell} from '../../sim/bed-slots.ts';
import {isColonist} from '../../sim/affiliation.ts';
import {medicalWorkRefusal} from '../../sim/health-rules.ts';
import {validateFilth} from '../../sim/filth-save.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {patientWork} from '../../sim/patient-rest.ts';
import {validateCare} from '../../sim/care-save.ts';
import {isDoubleBedKind} from '../../sim/bed-kinds.ts';
import {deepWorkReason,deepWorkSpot} from '../../sim/deep-drilling-rules.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const parseCell=(ctx:ImportContext,raw:string|undefined):Cell|undefined=>{
 const m=raw&&/^\(\s*(-?\d+),\s*-?\d+,\s*(-?\d+)\s*\)$/.exec(raw);
 if(!m)return;const p=ctx.coordinates.cell({x:Number(m[1]),z:Number(m[2])});return ctx.inside(p)?p:undefined;
};
const ownerId=(ctx:ImportContext,ref:string|undefined)=>ref?ctx.thingIds.get(referencedThingId(ref)??''):undefined;
const pileAt=(ctx:ImportContext,ref:string|undefined)=>ctx.w.piles.find(p=>p.id===ownerId(ctx,ref));
const stationAt=(ctx:ImportContext,ref:string|undefined)=>ctx.w.structures.find(s=>s.id===ownerId(ctx,ref));
type JobContext={ctx:ImportContext;p:Pawn;node:XmlNode;job:XmlNode;driver:XmlNode|undefined;def:string;forced:boolean;toil:number|undefined};
type Outcome={ok:true;detail?:string}|{ok:false;reason:string};
const reject=(reason:string):Outcome=>({ok:false,reason});
const accept=(detail?:string):Outcome=>({ok:true,...detail?{detail}:{}});
const moving=(p:Pawn)=>{p.path=[];p.moveCooldown=0;p.state='moving';};
const working=(p:Pawn)=>{p.path=[];p.moveCooldown=0;p.state='working';};
/** Pure domain guards check the exact same transport invariants as the save
 * decoder; if a converted geometry or policy clashes, leave the actor and
 * its actual carried object untouched. No synthetic reservation is made. */
function guarded(p:Pawn,apply:()=>void,check:()=>string[]):Outcome {
 const old={...p,orders:{...p.orders},recreation:{...p.recreation}};
 apply();const errors=check();if(!errors.length)return accept();
 for(const key of Object.keys(p) as (keyof Pawn)[])if(!Object.hasOwn(old,key))delete (p as unknown as Record<string,unknown>)[key];
 Object.assign(p,old);return reject(errors.join(' '));
}

function haul(j:JobContext):Outcome {
 const {ctx,p,job,def,forced}=j,w=ctx.w,pile=pileAt(ctx,text(job,'targetA'));
 if(!pile)return reject('Pile exacte absente.');
 const held=pile.owner.type==='pawn'&&pile.owner.pawnId===p.id;
 if(!held&&pile.owner.type!=='ground')return reject('La pile n’est ni au sol ni portée par son acteur.');
 if(!held&&p.interruptedCargo)return reject('Un autre objet est réellement porté.');
 let destination:HaulDestination,capacity:number;
 if(def==='Refuel'){
  // Core Refuel has the building in A and the fuel in B; its dispatch below
  // normalizes them to the same real references used by this function.
  const s=stationAt(ctx,text(job,'targetB'));
  if(!s?.fuel||fuelItem(s.kind)!==pile.item)return reject('Combustible ou réservoir non représenté.');
  destination={type:'fuel',structureId:s.id,...forced?{forced:true}:{}};capacity=fuelCapacity(w,s.id,p.id,forced);
 }else{
  const target=parseCell(ctx,text(job,'targetB'));
  const zone=target&&storageCells(w).find(s=>same(target,s));
  if(!zone||!storageCellAccepts(w,zone,pile))return reject('La case de stockage exacte n’accepte pas cette pile dans le modèle actuel.');
  if(pile.owner.type==='ground'&&same(pile.owner,zone))return reject('La source correspond déjà à la destination.');
  destination={type:'stockpile',stockpileId:zone.id};capacity=storageCapacity(w,zone,pile,p.id);
 }
 if(!forced&&!workPriority(p,haulingWork(destination)))return reject('Priorité de transport interdite à cet acteur.');
 if(!held&&pile.forbidden)return reject('Pile source interdite.');
 const requested=num(job,'count');if(!held&&(!Number.isSafeInteger(requested)||requested!<=0))return reject('Quantité source absente.');
 const available=held?pile.quantity:pile.quantity-reservedSource(w,pile.id);
 const quantity=held?available:Math.min(available,capacity,requested!);
 if(!Number.isSafeInteger(quantity)||quantity<=0||capacity<quantity)return reject('La réservation exacte excède la capacité disponible.');
 p.haul={sourcePileId:pile.id,quantity,phase:held?'deliver':'pickup',destination,carryPileId:held?pile.id:null};
 if(held)delete p.interruptedCargo;
 if(forced)p.orders.active='haul';moving(p);
 return accept(requested!==quantity?`Quantité réelle ${quantity}; quota Core ${requested??'absent'} (la suite opportuniste est recalculée).`:undefined);
}

function research(j:JobContext):Outcome {
 const {ctx,p,job,driver,toil}=j,w=ctx.w,s=stationAt(ctx,text(job,'targetA'));
 if(!s||!['research-bench','hi-tech-research-bench'].includes(s.kind)||!w.research?.project)return reject('Table ou projet de recherche absent.');
 if(p.interruptedCargo||!workPriority(p,'research')||j.forced)return reject('Occupation, priorité ou recherche forcée incompatible.');
 const spot=cookingSpot(s),ticks=num(driver,'ticksLeftThisToil');
 if(!canStandAt(w,spot))return reject('Place de travail non accessible.');
 if(toil!==0&&toil!==1)return reject('Stade de recherche inconnu.');
 if(toil===1&&(ticks===undefined||ticks<1||ticks>4000))return reject('Horloge de recherche non identifiable.');
 const worked=toil===1?Math.floor((4000-ticks!)/10):0,facility=needsResearchAnalyzer(w.research.project)?nearbyResearchFacility(w,s):undefined;
 const result=guarded(p,()=>{p.research={stationId:s.id,spot,worked,...facility?{facilityId:facility.id}:{}};if(toil===1&&same(p,spot))working(p);else moving(p);},()=>validateResearch(w,w.schemaVersion));
 if(!result.ok)return result;
 return accept(toil===1&&!same(p,spot)?'Le poste Core diffère de la place de travail Elsewhere; reprise vers le poste réel.':undefined);
}

function recreation(j:JobContext):Outcome {
 const {ctx,p,job,driver,toil,def}=j,w=ctx.w,building=stationAt(ctx,text(job,'targetA')),target=parseCell(ctx,text(job,'targetB'));
 if(!building||!target||p.interruptedCargo)return reject('Jeu, place ou occupation originale indisponible.');
 const activity=def==='Play_Chess'?'chess':'horseshoes',seat=activity==='chess'?w.structures.find(s=>isDiningSeat(s.kind)&&seatAt(s,target)):undefined;
 if(activity==='chess'&&!seat)return reject('Le siège exact de jeu d’échecs n’existe pas.');
 const ticks=num(driver,'ticksLeftThisToil');
 if(toil!==0&&toil!==1||toil===1&&(ticks===undefined||ticks<=0||ticks>4000||!same(p,target)))return reject('Phase de jeu non représentable à la position actuelle.');
 const task={activity,buildingId:building.id,target,...seat?{seatId:seat.id}:{},phase:toil===1?'active':'travel',elapsed:toil===1?Math.floor((4000-ticks!)/10):0} as const;
 if(!recreationSiteValid(w,task))return reject('Le jeu ou la place Core contrevient à la géométrie Elsewhere.');
 return guarded(p,()=>{p.recreation.task=task;if(toil===1){working(p);p.state='recreating';}else moving(p);},()=>validateRecreation(w,w.schemaVersion));
}

function growing(j:JobContext):Outcome {
 const {ctx,p,job,driver,def,toil}=j,w=ctx.w,id=ownerId(ctx,text(job,'targetA'));
 const resource=w.resources.find(r=>r.id===id),target=resource??parseCell(ctx,text(job,'targetA'));
 if(!target||p.interruptedCargo||def!=='Sow'&&!resource)return reject('Plante/case exacte absente.');
 const zone=w.growingZones.find(z=>z.cells.includes(ctx.index(target)));
 const existing=w.jobs.find(t=>same(t,target)&&t.kind===(def==='Sow'?'sow':def==='CutPlant'?'cut':'harvest')&&t.status==='pending'&&t.reservedBy===null&&(!resource||t.plantTarget?.resourceId===resource.id));
 const kind=existing?.kind??(def==='Sow'?'sow':def==='CutPlant'?(resource?.kind==='tree'?'chop':'cut'):'harvest');
 if(!existing&&w.jobs.some(t=>same(t,target)))return reject('Une autre désignation existe déjà pour cette case.');
 const order:Job=existing?{...existing,status:'active',reservedBy:p.id}:{id:w.nextId,kind,x:target.x,z:target.z,orientation:0,footprint:'standard',status:'active',reservedBy:p.id,progress:0,escrow:{wood:0,food:0},
  ...zone?{growingZoneId:zone.id}:{},...resource?{plantTarget:{resourceId:resource.id}}:{}};
 if(!j.forced&&!workPriority(p,workType(order)))return reject('Priorité de culture interdite.');
 if(!growingJobValid(w,order))return reject('La plante ou la zone ne permet pas ce travail selon le moteur actuel.');
 const work=num(driver,'workDone');
 if(work!==undefined){if(work<0)return reject('Progression Core invalide.');setWorkUnits(order,Math.round(work*1000));}
 if(order.progress>=jobDuration(w,order))return reject('Progression source au-delà de la durée locale.');
 const here=Math.abs(p.x-target.x)+Math.abs(p.z-target.z)<=1;
 if(work!==undefined&&work>0&&!here)return reject('Travail déjà engagé, mais hors de portée locale.');
 if(existing)Object.assign(existing,order);else{w.nextId++;w.jobs.push(order);}p.jobId=order.id;if(j.forced)p.orders.active=order.id;
 if(toil===5&&here)working(p);else moving(p);
 return accept(items(job,'targetQueueA').length?'La tête de la tournée est réservée; les cibles suivantes restent des intentions automatiques (pas d’ordre joueur inventé).':undefined);
}

function sleeping(j:JobContext):Outcome {
 const {ctx,p,job,driver,toil}=j,w=ctx.w,bed=stationAt(ctx,text(job,'targetA'));
 if(p.interruptedCargo)return reject('Un objet est encore porté.');
 const medicalTag=text(j.node,'mindState/lastJobTag')==='RestingForMedicalReasons';
 const medical=medicalTag?patientWork(p,w.schemaVersion):undefined;
 if(medicalTag&&(!medical||!bed))return reject('Repos médical Core sans condition ou lit médical représenté.');
 const target=bed?(()=>{const slot=pawnBedSlot(p,bed);return slot===undefined?medical&&bed.medical&&!isDoubleBedKind(bed.kind)?bedSlotCell(bed,0):undefined:bedSlotCell(bed,slot);})():parseCell(ctx,text(job,'targetA'));
 if(!target)return reject('Attribution du lit ou case de repos exacte absente.');
 if(w.pawns.some(o=>o.id!==p.id&&o.need?.kind==='sleep'&&same(o.need.target,target)))return reject('Place de sommeil déjà réservée.');
 if(toil!==1&&toil!==2)return reject('Stade de sommeil inconnu.');
 const asleep=text(driver,'asleep')==='True';
 if(toil===2&&!asleep&&!medical)return reject('Acteur étendu mais pas endormi; horloge/état de repos Core distinct.');
 if(toil===2&&!same(p,target))return reject('Dormeur hors de sa vraie place dans le modèle Elsewhere.');
 if(!bed&&!canStandAt(w,target))return reject('Case de sommeil libre inaccessible.');
 if(p.state==='downed'&&toil!==2)return reject('Patient au sol incapable de poursuivre le déplacement.');
 const downed=p.state==='downed';
 return guarded(p,()=>{p.need={kind:'sleep',phase:toil===2?'sleep':'travel',bedId:bed?.id??null,target,...medical?{medical}:{}};
  if(toil===2){working(p);p.state=downed?'downed':asleep?'sleeping':'resting';}else moving(p);},()=>validateCare(w));
}

function cleaning(j:JobContext):Outcome {
 const {ctx,p,job,driver,forced}=j,w=ctx.w;
 if(p.interruptedCargo||!forced&&!workPriority(p,'clean'))return reject('Nettoyage interdit ou objet porté.');
 const ids=[text(job,'targetA'),...items(job,'targetQueueA').map(n=>text(n))].map(ref=>ownerId(ctx,ref));
 if(!ids.length||ids.some(id=>id===undefined||!w.filth?.items.some(f=>f.id===id)))return reject('Une salissure exacte est absente du modèle.');
 const progress=num(driver,'cleaningWorkDone')??0;
 if(progress<0)return reject('Progression de nettoyage invalide.');
 return guarded(p,()=>{p.cleaning={targets:[...new Set(ids as number[])],forced,phase:progress>0?'clean':'approach',progress};if(progress>0)working(p);else moving(p);},()=>validateFilth(w,w.schemaVersion));
}

function idleWait(j:JobContext):Outcome {
 const {ctx,p,job,node,toil}=j;
 const startedAtCore=num(job,'startTick'),expiryIntervalCore=num(job,'expiryInterval'),alternation=text(node,'mindState/nextMoveOrderIsWait');
 if(toil!==0||startedAtCore===undefined||!Number.isSafeInteger(startedAtCore)||startedAtCore<0||startedAtCore>effectiveCore297(ctx.w)||expiryIntervalCore===undefined||!Number.isSafeInteger(expiryIntervalCore)||expiryIntervalCore<125||expiryIntervalCore>200||!p.mental?.wander||!['True','False'].includes(alternation??'')||p.interruptedCargo)return reject('Intervalle, alternance ou propriétaire du repos de promenade absent.');
 p.mental.wander.nextMoveOrderIsWait=alternation==='True';p.idleWander300={kind:'wait',at:{x:p.x,z:p.z},startedAtCore,expiryIntervalCore};p.path=[];p.moveCooldown=0;p.state='idle';return accept('Pause de promenade: début, intervalle et alternance repris dans les ticks Core.');
}

function deepWork(j:JobContext):Outcome {
 const {ctx,p,job,toil,def}=j,s=stationAt(ctx,text(job,'targetA'));
 if(!s||s.kind!==(def==='OperateDeepDrill'?'deep-drill':'ground-scanner')||toil!==0&&toil!==1)return reject('Installation ou stade de travail profond absent.');
 const reason=deepWorkReason(ctx.w,p,s);if(reason)return reject(reason);
 const spot=deepWorkSpot(s);p.deepWork={structureId:s.id,spot,kind:s.kind==='deep-drill'?'drill':'scan'};
 if(toil===1&&same(p,spot))working(p);else moving(p);return accept(toil===1&&!same(p,spot)?'Place de travail recalculée par la géométrie locale.':undefined);
}

function production(j:JobContext):Outcome {
 const {ctx,p,job,toil,node}=j,w=ctx.w,s=stationAt(ctx,text(job,'targetA')),billId=ctx.thingIds.get(text(job,'bill')??''),bill=s?.bills?.find(b=>b.id===billId);
 if(!s||!bill)return reject('Établi/facture exacts absents.');
 const recipe=bill.recipe;
 if(bill.suspended||!productionResearchUnlocked(w,recipe)||!productionWorkerQualified(p,recipe)||!j.forced&&!workPriority(p,billWork(bill)))return reject('Facture suspendue, recherche, qualification ou priorité incompatible.');
 if(toil!==4&&toil!==7&&toil!==14)return reject('Stade de facture autre que collecte ou travail.');
 const targetB=pileAt(ctx,text(job,'targetB'));
 const workpiece=targetB&&(targetB.unfinished??targetB.artWork??targetB.smithingWork??targetB.gunWork??targetB.flakWork??targetB.prostheticWork273??targetB.componentWork);
 const boundPiece=workpiece&&workpiece.recipe===recipe&&workpiece.authorId===p.id&&(workpiece.billId===undefined||workpiece.billId===bill.id);
 const placed=items(job,'placedThings').map(n=>({ref:text(n,'thing'),quantity:num(n,'count'),placed:true}));
 const gatheredRefs=[text(job,'targetB'),...items(job,'targetQueueB').map(n=>text(n))];
 const gatheredQuantities=[num(job,'count'),...items(job,'countQueue').map(n=>Number(text(n)))];
 if(gatheredRefs.length!==gatheredQuantities.length)return reject('Compte d’ingrédients non identifiable.');
 const entries=boundPiece?[{ref:text(job,'targetB'),quantity:1,placed:toil===14}]:[...placed,...toil===14?[]:gatheredRefs.map((ref,i)=>({ref,quantity:gatheredQuantities[i],placed:false}))];
 if(!entries.length)return reject('Ni ouvrage existant ni ingrédients placés identifiables.');
 const spot=cookingSpot(s);if(!canStandAt(w,spot))return reject('Place de travail inaccessible.');
 const ingredients:CookingIngredient[]=[],incoming=new Map<number,{item:string;quantity:number}>();
 let actionCell:Cell|undefined;
 for(const entry of entries){
  const pile=pileAt(ctx,entry.ref),quantity=entry.quantity;if(!pile||quantity===undefined||!Number.isSafeInteger(quantity)||quantity<=0)return reject('Ingrédient ou quantité exacte absent.');
  const held=pile.owner.type==='pawn'&&pile.owner.pawnId===p.id;
  if(held?pile.quantity!==quantity:pile.owner.type!=='ground'||pile.forbidden||pile.quantity-reservedSource(w,pile.id)<quantity)return reject('Quantité ou possession de l’ingrédient non conforme.');
  if(!boundPiece&&!PRODUCTION_RECIPES[recipe].inputs.includes(pile.item as ProductionIngredient))return reject('Ingrédient Core non accepté par cette recette Elsewhere.');
  const legalPlace=(c:Cell)=>ctx.inside(c)&&(pile.item==='unfinished-component'?componentWorkpiecePlaceFree(w,c,spot,recipe,s):ingredientWithinReach(c,spot,s)&&ingredientPlaceFree(w,c,spot,recipe,s));
  if(entry.placed){
   if(pile.owner.type!=='ground'||!legalPlace(pile.owner))return reject('Ingrédient déjà placé dans Core, mais hors de la géométrie Elsewhere.');
   ingredients.push({pileId:pile.id,item:pile.item as ProductionIngredient,quantity,stage:'placed',cell:{x:pile.owner.x,z:pile.owner.z}});continue;
  }
  const sourceDestination=held?parseCell(ctx,text(node,'pather/destination')):undefined;
  const candidates=[...sourceDestination?[sourceDestination]:[],{x:s.x,z:s.z},spot,...footprintCells(s),{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z+1},{x:spot.x,z:spot.z-1}];
  const cell=candidates.find(c=>{if(!legalPlace(c))return false;const old=incoming.get(ctx.index(c));return (!old||old.item===pile.item)&&groundCapacity(w,c,pile,p.id)>=quantity+(old?.quantity??0);});
  if(!cell)return reject('Réservation réelle impossible dans la géométrie de dépôt de l’établi.');
  const old=incoming.get(ctx.index(cell));incoming.set(ctx.index(cell),{item:pile.item,quantity:(old?.quantity??0)+quantity});
  ingredients.push({pileId:pile.id,item:pile.item as ProductionIngredient,quantity,stage:held?'held':'source',cell:{x:cell.x,z:cell.z}});
  if(!actionCell)actionCell=held?cell:pile.owner.type==='ground'?{x:pile.owner.x,z:pile.owner.z}:undefined;
 }
 if(new Set(ingredients.map(i=>i.pileId)).size!==ingredients.length||p.interruptedCargo&&!ingredients.some(i=>i.stage==='held'))return reject('Une autre possession ou réservation empêche la reprise.');
 let phase:'gather'|'work'='gather',progress=0,workTicks:number|undefined;
 if(toil===14){
  if(!same(p,spot)&&!boundPiece)return reject('Facture en travail sans ouvrage persistent et place Core différente du poste local.');
  if(same(p,spot)){
   const remaining=num(j.driver,'workLeft');if(remaining===undefined||remaining<0)return reject('Travail restant absent.');
   const done=boundPiece?workpiece.progress:Math.round(productionWorkTotal(recipe)-remaining*1000);
   if(done<0||done>productionWorkTotal(recipe))return reject('Progression source au-delà du total local.');
   phase='work';progress=done;
   const work=num(j.driver,'ticksSpentDoingRecipeWork');
   if(billWork(bill)==='cook'||recipe==='make-medicine'||recipe==='smash-mechanoid'||recipe==='shred-mechanoid')workTicks=work!==undefined&&work>=10?Math.floor(work/10):undefined;
  }
 }
 const task:CookingTask={...recipe==='simple-meal'?{}:{recipe},stationId:s.id,billId:bill.id,spot,actionCell:actionCell??spot,phase,ingredients,progress,productId:null,storageId:null,...workTicks!==undefined?{workTicks}:{}};
 const result=guarded(p,()=>{p.cooking=task;if(ingredients.some(i=>i.stage==='held'))delete p.interruptedCargo;if(j.forced)p.orders.active='cook';if(phase==='work')working(p);else moving(p);},()=>validateCooking(w,w.schemaVersion,new Set()));
 return result.ok?accept(phase==='work'?'Progression et ingrédients déjà déposés conservés.':'Quantités et propriétaires conservés; cases de dépôt compatibles réservées par le moteur, pas de trajectoire Core inventée.'):result;
}

/** Public hook, called after owners/absolute clock/final geometry. */
export function importActiveJobs(ctx:ImportContext):void {
 const {w,notes}=ctx;
 for(const t of ctx.map.things){
  if(t.cls!=='Pawn'||t.def!=='Human')continue;
  const job=at(t.node,'jobs/curJob'),def=text(job,'def');if(!job||!def)continue;
  const p=w.pawns.find(p=>p.id===ctx.thingIds.get(t.id));
  if(t.faction!==undefined&&ctx.save.playerFaction!==undefined?t.faction!==ctx.save.playerFaction:!p||!isColonist(p))continue;
  notes.countBefore('active-jobs');
  if(!p||!isColonist(p)){notes.def('active-jobs',def,'dropped',undefined,'Acteur d’origine non repris.');continue;}
  let result:Outcome;
  const driver=at(t.node,'jobs/curDriver'),j={ctx,p,node:t.node,job,driver,def,toil:num(driver,'curToilIndex'),forced:text(job,'playerForced')==='True'};
  if(p.state==='downed'&&def!=='LayDown'||p.state==='dead'||p.mental?.crisis||p.draft||p.jobId!==null||p.haul||p.cooking||p.need||p.research||p.recreation.task||p.cleaning||p.orders.active!==null||medicalWorkRefusal(p)&&def!=='LayDown')result=reject('Acteur déjà occupé, mobilisé ou incapable dans le modèle chargé.');
  else switch(def){
   case 'HaulToCell': result=haul(j);break;
   case 'Refuel':{
    // Keep original job and swap only the field names to our haul helper.
    const a=at(job,'targetA'),b=at(job,'targetB');
    if(!a||!b){result=reject('Cibles exactes de réapprovisionnement absentes.');break;}
    const normalized={...job,children:job.children.map(n=>n===a?{...n,text:b.text}:n===b?{...n,text:a.text}:n)};
    result=haul({...j,job:normalized});break;
   }
   case 'Research':result=research(j);break;
   case 'Play_Horseshoes':case 'Play_Chess':result=recreation(j);break;
   case 'Harvest':case 'Sow':case 'CutPlant':result=growing(j);break;
   case 'LayDown':result=sleeping(j);break;
   case 'Clean':result=cleaning(j);break;
   case 'Wait_Wander':result=idleWait(j);break;
   case 'OperateDeepDrill':case 'UseGroundPenetratingScanner':result=deepWork(j);break;
   case 'DoBill':result=production(j);break;
   default: result=reject('Type ou stade du JobDriver Core non traduit.');
  }
  if(result.ok){notes.countAfter('active-jobs');notes.def('active-jobs',def,'adapted',def,result.detail??'Tâche reprise sur ses cibles réelles; chemin Core recalculé.');}
  else {notes.def('active-jobs',def,'dropped',undefined,result.reason);notes.lost('active-jobs',`${p.name} — ${def}: ${result.reason}`);}
  const queued=items(t.node,'jobs/jobQueue/jobs');if(queued.length)notes.lost('active-jobs',`${p.name} — ${queued.length} jobs en file Core, non transformés en ordres forcés.`);
 }
}
