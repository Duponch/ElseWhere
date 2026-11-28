/** Import graphical player intentions, not guessed work or finished effects.
 * Core Designation.ExposeData writes def, target (a cell or Thing reference)
 * and colorDef. Plan.ExposeData instead saves actual plan groups since 1.6.
 * The installed Core DesignationDefs and PlanManager Scribe layout are the
 * source authority; ordinary Elsewhere commands remain the work authority. */
import type {ImportContext} from './convert.ts';
import {items,num,text,type XmlNode} from './xml.ts';
import {referencedThingId} from './rws-save.ts';
import type {Cell,Command,CommandResult,JobKind} from '../../sim/types.ts';
import {applyCommand} from '../../sim/engine.ts';
import {isGroundSleepingSpotKind} from '../../sim/bed-kinds.ts';
import {actualDeviceSwitch,canFlickDevice} from '../../sim/power-flick.ts';
import {isPlanColor369,addPlanCells369,validatePlans369,type Plan369,type PlanColor369} from '../../sim/plans-369.ts';
import type {GapOrigin} from './gap-origin.ts';

const CELL_ACTIONS:Readonly<Record<string,JobKind>>={Mine:'mine',SmoothFloor:'smooth-floor',SmoothWall:'smooth-wall',RemoveFloor:'remove-floor',RemoveFoundation:'remove-bridge'};
const THING_ACTIONS:Readonly<Record<string,JobKind>>={CutPlant:'cut',HarvestPlant:'harvest',Deconstruct:'deconstruct',Uninstall:'uninstall'};
const DELEGATED=new Set(['Haul','Hunt','Tame','Slaughter','ReleaseAnimalToWild']);
const ABSENT:Readonly<Record<string,string>>={MineVein:'Extension automatique du filon non représentée.',PaintBuilding:'Peinture des bâtiments non représentée.',PaintFloor:'Peinture du sol non représentée.',RemovePaintBuilding:'Retrait de peinture du bâtiment non représenté.',RemovePaintFloor:'Retrait de peinture du sol non représenté.',Open:'Ordre d’ouverture générique sans acteur non représenté (les ordres de caisson actuels exigent une personne).',EjectFuel:'Ordre d’éjection du combustible non représenté.',ExtractSkull:'Ordre d’extraction de crâne non représenté.',FillIn:'Ordre de comblement non représenté.'};
type Outcome={ok:true;to:string;note?:string}|{ok:false;reason:string;origin:GapOrigin};
const failure=(reason:string,origin:GapOrigin='model'):Outcome=>({ok:false,reason,origin});
const success=(to:string,note?:string):Outcome=>({ok:true,to,...note?{note}:{}});

function sourceCell(ctx:ImportContext,raw:string|undefined):Cell|undefined {
 const m=raw&&/^\(\s*(-?\d+),\s*-?\d+,\s*(-?\d+)\s*\)$/.exec(raw);
 if(!m)return;const cell=ctx.coordinates.cell({x:Number(m[1]),z:Number(m[2])});return ctx.inside(cell)?cell:undefined;
}
function planColor(raw:string|undefined):PlanColor369|undefined {
 const id=raw?.replace(/^Plan/,'').toLowerCase();return isPlanColor369(id)?id:undefined;
}
function command(ctx:ImportContext,c:Command,to:string):Outcome {
 const r:CommandResult=applyCommand(ctx.w,c);
 return r.ok?success(to):failure(r.reason??'Ordre refusé par les règles d’admission Elsewhere.');
}
function missingSource(ctx:ImportContext,id:string|undefined):Outcome {
 return failure('Cible physique non reprise; aucun ordre placé sur une autre cible.',id&&ctx.map.things.some(t=>t.id===id)?'unresolved':'source');
}

function importDesignation(ctx:ImportContext,node:XmlNode,def:string):Outcome {
 const w=ctx.w,raw=text(node,'target');
 const cellKind=Object.hasOwn(CELL_ACTIONS,def)?CELL_ACTIONS[def]:undefined;
 if(cellKind){
  const cell=sourceCell(ctx,raw);if(!cell)return failure('Case source absente ou hors carte.','source');
  if(cellKind==='remove-bridge'&&!w.tiles[ctx.index(cell)]?.bridge)return failure('Fondation Core différente d’un pont représenté.');
  if((cellKind==='mine'||cellKind==='smooth-wall')&&w.jobs.some(j=>j.x===cell.x&&j.z===cell.z&&(j.kind==='mine'||j.kind==='smooth-wall')))return failure('Désignations de roche incompatibles sur la même case.','source');
  return command(ctx,{type:'designate',kind:cellKind,...cell},cellKind);
 }
 if(def==='Plan'){
  const cell=sourceCell(ctx,raw);if(!cell)return failure('Case du plan source absente.','source');
  const rawColor=text(node,'colorDef'),color=planColor(rawColor)??(!rawColor||rawColor==='null'?'gray':undefined);if(!color)return failure('Couleur de plan non représentée.');
  const i=ctx.index(cell);if(w.plans369?.plans.some(p=>p.cells.includes(i)))return failure('Plan historique superposé à un plan 1.6; aucune cellule remplacée.','source');
  addPlanCells369(w,[i],color);return success('plan','Ancienne désignation Plan convertie dans un groupe de plan 1.6.');
 }
 if(Object.hasOwn(ABSENT,def))return failure(ABSENT[def]!);
 const kind=Object.hasOwn(THING_ACTIONS,def)?THING_ACTIONS[def]:undefined;
 if(!kind&&!['ExtractTree','Flick','Strip'].includes(def))return failure('Type de désignation Core non identifié.','unresolved');
 const sourceId=referencedThingId(raw),targetId=sourceId?ctx.thingIds.get(sourceId):undefined;
 if(targetId===undefined)return missingSource(ctx,sourceId);
 if(kind==='cut'||kind==='harvest'||def==='ExtractTree'){
  const plant=w.resources.find(r=>r.id===targetId);if(!plant)return missingSource(ctx,sourceId);
  return def==='ExtractTree'?command(ctx,{type:'extract-tree',resourceId:targetId},'extract-tree'):command(ctx,{type:'designate',kind:kind!,targetId,x:plant.x,z:plant.z},kind!);
 }
 if(kind==='deconstruct'||kind==='uninstall'){
  const s=w.structures.find(s=>s.id===targetId);if(!s)return missingSource(ctx,sourceId);
  // Some native commands remove these spots immediately. Import must never
  // finish a still-pending source order while deserializing it.
  if(kind==='deconstruct'&&(isGroundSleepingSpotKind(s.kind)||['animal-sleeping-spot','crafting-spot','butcher-spot'].includes(s.kind)))return failure('Retrait immédiat dans Elsewhere : attente du chantier Core non représentée.');
  return command(ctx,{type:'designate',kind,targetId,x:s.x,z:s.z},kind);
 }
 if(def==='Flick'){
  const s=w.structures.find(s=>s.id===targetId),source=ctx.map.things.find(t=>t.id===sourceId);
  if(!s||!source)return missingSource(ctx,sourceId);
  // Core wantSwitchOn is Scribe default true (explicit false is written).
  const rawWant=text(source.node,'wantSwitchOn');
  if(rawWant!==undefined&&rawWant!=='True'&&rawWant!=='False')return failure('État demandé de l’interrupteur illisible.','source');
  const want=rawWant!=='False';
  if(!canFlickDevice(s))return failure('Interrupteur commandable non représenté.');
  if(actualDeviceSwitch(s)===want)return failure('Désignation obsolète : l’interrupteur est déjà dans l’état demandé.','source');
  return command(ctx,{type:'power-flick',structureId:targetId,on:want},'flick');
 }
 if(def==='Strip'){
  // A Core Corpse target points to its distinct physical owner. Elsewhere
  // strip designation uses the human identity inside that owner, never a
  // nearby actor or the material ID itself.
  const human=w.pawns.find(p=>p.id===targetId),body=w.pawns.find(p=>p.body?.pileId===targetId);
  const pawn=human??body;if(!pawn)return missingSource(ctx,sourceId);
  return command(ctx,{type:'strip-designate',targetId:pawn.id,enabled:true},'strip');
 }
 return failure('Ordre sans traduction identifiée.','unresolved');
}

/** A saved Plan is already a grouped visual owner; replaying brush actions
 * would merge adjacent same-colour plans that Core still saves distinctly.
 * Admit the exact shape/colour/hidden flag under the native validator. */
function importPlans(ctx:ImportContext):void {
 const {w,notes}=ctx,rows=items(ctx.map.node,'planManager/allPlans');if(!rows.length)return;
 const usedCells=new Set<number>(),usedNumbers=new Set<number>(),usedIds=new Set<number>();
 const entries:Plan369[]=[];
 const numbered=(raw:string|undefined,base:string|undefined):number|undefined=>{
  if(!raw)return;
  const labelPrefix=base??'Plan';if(!raw.startsWith(labelPrefix+' '))return;
  const suffix=raw.slice(labelPrefix.length+1);if(suffix==='X')return 0;
  return /^\d+$/.test(suffix)&&Number(suffix)>=1&&Number(suffix)<=1000?Number(suffix):undefined;
 };
 // Reserve actual saved automatic numbers before naming adapted custom labels.
 for(const row of rows){const n=numbered(text(row,'label'),text(row,'baseLabel'));if(n!==undefined)usedNumbers.add(n);}
 const ordered=[...rows].sort((a,b)=>(num(a,'ID')??Number.MAX_SAFE_INTEGER)-(num(b,'ID')??Number.MAX_SAFE_INTEGER));
 for(const row of ordered){
  notes.countBefore('designations');
  const lose=(why:string,origin:GapOrigin='source')=>notes.def('designations','Plan','dropped',undefined,why,1,origin);
  const sourceId=num(row,'ID'),color=planColor(text(row,'color'));if(sourceId===undefined||!Number.isSafeInteger(sourceId)||sourceId<0||usedIds.has(sourceId)){lose('Identité du plan Core absente ou dupliquée.');continue;}
  if(!color){lose('Couleur de plan non représentée.','model');continue;}
  const rawCells=items(row,'cells'),cells=rawCells.map(n=>sourceCell(ctx,text(n)));
  if(!cells.length||cells.some(c=>c===undefined)){lose('Case ou liste de cases du plan invalide.');continue;}
  const indices=(cells as Cell[]).map(c=>ctx.index(c)).sort((a,b)=>a-b);
  if(new Set(indices).size!==indices.length||indices.some(i=>usedCells.has(i))){lose('Plan présentant des cases dupliquées ou superposées.');continue;}
  const label=numbered(text(row,'label'),text(row,'baseLabel'));let n=label;
  if(n===undefined){n=0;for(let v=1;v<=1000;v++)if(!usedNumbers.has(v)){n=v;break;}}
  const plan:Plan369={id:entries.length+1,n,color,cells:indices,...text(row,'hidden')==='True'?{hidden:true}:{}};
  const errors=validatePlans369({...w,plans369:{nextId:plan.id+1,plans:[plan]}},w.schemaVersion);
  if(errors.length){lose('Le groupe de plan Core ne possède pas une géométrie native valide : '+errors.join(' '));continue;}
  for(const i of indices)usedCells.add(i);usedNumbers.add(n);usedIds.add(sourceId);entries.push(plan);
  notes.countAfter('designations');notes.def('designations','Plan',label===undefined?'adapted':'exact','plan',label===undefined?'Nom personnalisé non représenté : numéro de plan réattribué.':undefined,1,label===undefined?'model':undefined);
 }
 if(entries.length)w.plans369={nextId:entries.length+1,plans:entries};
}

/** Hook after spatial owners and construction plans, before imported history
 * and active jobs. Other owned designation families have their own hooks. */
export function importRwsDesignations(ctx:ImportContext):void {
 importPlans(ctx);
 for(const node of items(ctx.map.node,'designationManager/allDesignations')){
  const def=text(node,'def');if(!def||DELEGATED.has(def))continue;
  ctx.notes.countBefore('designations');const result=importDesignation(ctx,node,def);
  if(result.ok){ctx.notes.countAfter('designations');ctx.notes.def('designations',def,result.note?'adapted':'exact',result.to,result.note,1,result.note?'model':undefined);}
  else ctx.notes.def('designations',def,'dropped',undefined,result.reason,1,result.origin);
 }
}
