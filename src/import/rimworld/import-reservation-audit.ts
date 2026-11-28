/** RimWorld serializes a ReservationManager separately from its jobs. Elsewhere
 * derives real claims from the current, admitted native task. Audit every source
 * receipt against that task; never restore a detached/false reservation. */
import type {ImportContext} from './convert.ts';
import type {Cell,HaulTask,Pawn,World} from '../../sim/types.ts';
import type {WildAnimal} from '../../sim/wildlife-state.ts';
import type {GapOrigin} from './gap-origin.ts';
import {at,items,text,type XmlNode} from './xml.ts';
import {referencedThingId} from './rws-save.ts';
import {storageCellById} from '../../sim/shelf-storage.ts';
import {isDiningSeat,seatAt} from '../../sim/dining.ts';

type Target={id:number}|{cell:Cell};
type Bound={kind:string;detail?:string};
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const idIs=(target:Target,id:number|null|undefined):boolean=>'id'in target&&target.id===id;
const cellIs=(target:Target,cell:Cell|undefined):boolean=>'cell'in target&&!!cell&&same(target.cell,cell);
const sourceCell=(ctx:ImportContext,raw:string):Cell|undefined=>{
 const m=/^\(\s*(-?\d+)\s*,\s*-?\d+\s*,\s*(-?\d+)\s*\)$/.exec(raw);
 if(!m)return;const c=ctx.coordinates.cell({x:Number(m[1]),z:Number(m[2])});
 return ctx.inside(c)?c:undefined;
};
const jobIdentity=(node:XmlNode|undefined):string|undefined=>{
 const id=text(node,'loadID');return id&&/^\d+$/.test(id)?'Job_'+id:undefined;
};

function haulClaim(w:World,h:HaulTask,def:string,target:Target):Bound|undefined {
 if(def!=='HaulToCell'&&def!=='Refuel')return;
 if(idIs(target,h.sourcePileId)||idIs(target,h.carryPileId))return {kind:'transport',detail:h.phase==='pickup'?`Quantité réservée par le transport natif : ${h.quantity}.`:`Quantité portée par le transport natif : ${h.quantity} ; plus de réservation autonome de la pile source.`};
 const d=h.destination;
 if(d.type==='stockpile'){
  const slot=storageCellById(w,d.stockpileId);
  if(cellIs(target,slot)||idIs(target,slot?.shelfId))return {kind:'stockage',detail:'Case de stockage réelle réservée par le transport.'};
 }
 if('structureId'in d&&idIs(target,d.structureId))return {kind:'transport',detail:'Installation de destination du transport.'};
}

/** A work seat has no independent ID claim in Elsewhere, but its actual cell
 * is the reserved workstation. Do not treat an adjacent/unrelated chair as it. */
function workSeat(w:World,target:Target,spot:Cell):boolean {
 return 'id'in target&&w.structures.some(s=>s.id===target.id&&isDiningSeat(s.kind)&&seatAt(s,spot));
}
function pawnClaim(w:World,p:Pawn,def:string,target:Target):Bound|undefined {
 if(p.haul){const claim=haulClaim(w,p.haul,def,target);if(claim)return claim;}
 if(def==='Research'&&p.research){
  if(idIs(target,p.research.stationId)||idIs(target,p.research.facilityId))return {kind:'recherche'};
  if(cellIs(target,p.research.spot)||workSeat(w,target,p.research.spot))return {kind:'place de recherche',detail:'Case de service du poste, sans réservation séparée du siège.'};
 }
 if(def==='DoBill'&&p.cooking){
  const c=p.cooking;
  if(idIs(target,c.stationId))return {kind:'facture'};
  const ingredient=c.ingredients.find(i=>idIs(target,i.pileId)||cellIs(target,i.cell));
  if(ingredient)return {kind:'ingrédient de facture',detail:`Quantité native : ${ingredient.quantity}. ${ingredient.stage==='source'?'Pile et dépôt d’ingrédient réservés par la tâche.':ingredient.stage==='held'?'Ingrédient porté et dépôt réservé par la tâche.':'Ingrédient déjà déposé, conservé par la tâche sans réservation autonome.'}`};
  if(cellIs(target,c.spot)||workSeat(w,target,c.spot))return {kind:'place de facture',detail:'Case de service du poste, sans réservation séparée du siège.'};
 }
 if(def==='LayDown'&&p.need?.kind==='sleep'&&p.need.bedId!==null&&(idIs(target,p.need.bedId)||cellIs(target,p.need.target)))return {kind:'place de lit',detail:'Le lit et sa place sont portés par la tâche de repos.'};
 if((def==='Play_Chess'||def==='Play_Horseshoes')&&p.recreation.task?.activity===(def==='Play_Chess'?'chess':'horseshoes')){
  const r=p.recreation.task;
  if(idIs(target,r.buildingId)||idIs(target,r.seatId)||cellIs(target,r.target))return {kind:'loisir'};
 }
 if((def==='Harvest'||def==='Sow'||def==='CutPlant')&&p.jobId!==null){
  const j=w.jobs.find(j=>j.id===p.jobId&&j.reservedBy===p.id);
  if(j&&(def==='Harvest'?j.kind==='harvest':def==='Sow'?j.kind==='sow':j.kind==='chop'||j.kind==='cut')&&(idIs(target,j.plantTarget?.resourceId)||cellIs(target,j)))return {kind:'travail de culture'};
 }
 if(def==='Clean'&&p.cleaning?.targets.some(id=>idIs(target,id)))return {kind:'nettoyage'};
 if((def==='OperateDeepDrill'||def==='UseGroundPenetratingScanner')&&p.deepWork?.kind===(def==='OperateDeepDrill'?'drill':'scan')&&(idIs(target,p.deepWork.structureId)||cellIs(target,p.deepWork.spot)))return {kind:'travail souterrain'};
}
function animalClaim(w:World,a:WildAnimal,def:string,target:Target):Bound|undefined {
 if(a.haul&&a.haul.phase!=='holding'){const claim=haulClaim(w,a.haul,def,target);if(claim)return claim;}
 if(def==='LayDown'&&a.animalRest){
  const spot=w.structures.find(s=>s.id===a.animalRest!.spotId);
  if(idIs(target,a.animalRest.spotId)||cellIs(target,spot))return {kind:'couchage animal'};
 }
 if(def==='Mate'&&idIs(target,a.mating?.femaleId))return {kind:'accouplement'};
}
const nativeTask=(p:Pawn|undefined,a:WildAnimal|undefined,def:string):boolean=>{
 if(p)switch(def){
  case 'HaulToCell':case 'Refuel':return !!p.haul;
  case 'Research':return !!p.research;
  case 'DoBill':return !!p.cooking;
  case 'LayDown':return p.need?.kind==='sleep';
  case 'Play_Chess':case 'Play_Horseshoes':return !!p.recreation.task;
  case 'Harvest':case 'Sow':case 'CutPlant':return p.jobId!==null;
  case 'Clean':return !!p.cleaning;
  case 'OperateDeepDrill':case 'UseGroundPenetratingScanner':return !!p.deepWork;
 }
 if(a)switch(def){
  case 'HaulToCell':return !!a.haul&&a.haul.phase!=='holding';
  case 'LayDown':return a.state==='sleeping'||!!a.animalRest;
  case 'Mate':return !!a.mating;
 }
 return false;
};

export function auditImportedReservations(ctx:ImportContext):void {
 const {w,map,notes}=ctx,rows=items(map.node,'reservationManager/reservations');
 if(!rows.length)return;
 notes.adapted('reservations','Elsewhere ne stocke pas de liste de réservations indépendante : ses vraies tâches et possessions portent les cibles et quantités. Les plafonds Core de partage (maxPawns, stackCount) ne sont pas des reçus autonomes dans ce modèle.');
 const things=new Map(map.things.map(t=>[t.id,t])),pawns=new Map(w.pawns.map(p=>[p.id,p])),animals=new Map((w.wildlife?.animals??[]).map(a=>[a.id,a]));
 // An omitted mapping can be a model/translation gap, but a missing source
 // object cannot. Check nested inventory/holder Thing records only on demand.
 let sourceIds:Set<string>|undefined;
 const sourceOwns=(id:string):boolean=>{
  if(things.has(id))return true;
  if(!sourceIds){
   sourceIds=new Set();const pending=[map.node];
   while(pending.length){const n=pending.pop()!;if(n.name==='id'&&n.text.trim())sourceIds.add(n.text.trim());for(const child of n.children)pending.push(child);}
  }
  return sourceIds.has(id);
 };
 for(const r of rows){
  notes.countBefore('reservations');
  const claimant=text(r,'claimant'),claimantId=referencedThingId(claimant),raw=text(r,'target'),jobRef=text(r,'job');
  const source=claimantId&&things.get(claimantId),job=source?at(source.node,'jobs/curJob'):undefined,def=text(job,'def');
  // Every original receipt has an individual, stable audit label, even if
  // several actors share the same source object or one actor claims two cells.
  const label=`${def??'Job inconnu'} : ${claimant??'acteur absent'} → ${raw??'cible absente'}`;
  const receipt=`${jobRef??'job absent'} ; maxPawns=${text(r,'maxPawns')??'omis'} ; stackCount=${text(r,'stackCount')??'omis'}.`;
  const miss=(reason:string,origin:GapOrigin)=>notes.def('reservations',label,'dropped',undefined,`${reason} (${receipt})`,1,origin);
  if(!claimantId||!source||!raw||!jobRef){miss('Reçu Core sans acteur, tâche ou cible identifiable.','source');continue;}
  if(!job||!def||jobIdentity(job)!==jobRef){
   // A live task from another job must never be credited to this receipt.
   const queued=items(source.node,'jobs/jobQueue/jobs').some(n=>jobIdentity(at(n,'job')??n)===jobRef);
   miss(queued?'Tâche Core en file non reprise comme tâche active ; réservation indépendante non représentée.':'Identifiant de tâche différent de la tâche courante Core (aucune réattribution supposée).',queued?'both':'source');continue;
  }
  const owner=ctx.thingIds.get(claimantId),p=owner===undefined?undefined:pawns.get(owner),a=owner===undefined?undefined:animals.get(owner);
  if(!p&&!a){miss('Acteur non repris comme propriétaire de tâche local ; voir le rapport de conversion de cet acteur.','both');continue;}
  let target:Target;
  if(raw.startsWith('(')){
   const cell=sourceCell(ctx,raw);if(!cell){miss('Case de réservation Core hors carte ou illisible.','source');continue;}target={cell};
  }else{
   const ref=referencedThingId(raw)??'',id=ctx.thingIds.get(ref);
   if(id===undefined){
    if(!sourceOwns(ref))miss('Cible référencée introuvable dans les objets et propriétaires de la carte Core.','source');
    else miss('Cible physique non reprise ; voir le rapport de conversion de cette cible.','both');
    continue;
   }
   target={id};
  }
  const bound=p?pawnClaim(w,p,def,target):animalClaim(w,a!,def,target);
  if(!bound){
   if(nativeTask(p,a,def))miss('La tâche locale ne porte pas cette cible exacte ; une réservation autonome ne peut pas être conservée.','model');
   else miss('La tâche Core correspondante n’a pas été admise localement et aucune réservation autonome n’existe dans Elsewhere ; voir la cause détaillée de cette tâche.','both');
   continue;
  }
  notes.countAfter('reservations');
  notes.def('reservations',label,'adapted',bound.kind,`Cible retrouvée dans la vraie tâche locale. ${bound.detail??''} Reçu indépendant non stocké (${receipt})`,1,'model');
 }
}
