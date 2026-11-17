import {isColonist} from './affiliation.ts';
import {isAggressiveCrisis} from './aggressive-crisis.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {furnitureDropCell} from './furniture-transfer.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {adjacent,blockedCells,reachableCells,routeToJob,type Reachability} from './pathfinding.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {assignPileOwner} from './pile-index.ts';
import {prisonBreakActive} from './prison-break-state.ts';
import {carrierOf} from './rescue-state.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {initialWorldGoodwill256} from './world-faction-catalog.ts';
import {validWorldRelationKind274,worldGoodwillChange274,worldNaturalGoodwill274} from './world-diplomacy-274.ts';
import {horizontalDistanceSquared} from './work-givers-rimworld.ts';
import {isStrip351,MAX_STRIP_DESIGNATIONS_351,STRIP_CORE_TICKS_351,STRIP_GOODWILL_351,validStripDesignations351,validStripTaskField351,type StripDesignation351} from './strip-state-351.ts';
import type {NeedContext} from './needs.ts';
import type {AreaCommand,Cell,Command,CommandResult,MaterialPile,Pawn,World} from './types.ts';

/** The strippable thing of one person: the living pawn where it stands, or its
 * corpse where it lies (in place, or as a ground corpse pile). A carried pawn,
 * a carried, buried or lost corpse and a casket occupant are not spawned. */
export interface StripTarget351 {pawn:Pawn;dead:boolean;cell:Cell;pile?:MaterialPile}
export function stripTarget351(w:World,targetId:number):StripTarget351|undefined {
 const pawn=w.pawns.find(p=>p.id===targetId);if(!pawn)return;
 if(pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined)return;
 if(pawn.state==='dead'){
  const body=pawn.body;if(body?.lostAt!==undefined)return;
  if(body?.pileId===undefined)return {pawn,dead:true,cell:{x:pawn.x,z:pawn.z}};
  const pile=w.piles.find(p=>p.id===body.pileId);if(!pile||pile.owner.type!=='ground')return;
  return {pawn,dead:true,cell:{x:pile.owner.x,z:pile.owner.z},pile};
 }
 if(carrierOf(w,pawn.id))return;
 return {pawn,dead:false,cell:{x:pawn.x,z:pawn.z}};
}
const stripped=(p:MaterialPile|{owner:MaterialPile['owner']},id:number):boolean=>(p.owner.type==='equipment'||p.owner.type==='apparel'||p.owner.type==='inventory')&&p.owner.pawnId===id;
/** Pawn.AnythingToStrip: equipment, inventory (minified furniture included) or worn apparel. */
export const anythingToStrip351=(w:World,id:number):boolean=>w.piles.some(p=>stripped(p,id))||(w.packed??[]).some(p=>p.owner.type==='inventory'&&p.owner.pawnId===id);
/** Pawn_GuestTracker.PrisonerIsSecure for a prisoner of the colony. */
export const prisonerSecure351=(p:Pawn):boolean=>!!p.prisoner&&p.prisoner.releasedAt===undefined&&!p.prisoner.escape&&!prisonBreakActive(p)&&!isAggressiveCrisis(p.mental);
/** StrippableUtility.CanBeStrippedByColony, as a refusal (undefined: accepted). */
export function stripRefusal351(w:World,t:StripTarget351|undefined):string|undefined {
 if(!t)return 'Il n’y a ici ni corps ni personne à dépouiller.';
 if(!anythingToStrip351(w,t.pawn.id))return 'Rien à retirer : ni équipement, ni vêtement, ni inventaire.';
 if(t.dead||t.pawn.state==='downed'||prisonerSecure351(t.pawn))return undefined;
 return 'Seuls un corps, une personne à terre ou un prisonnier détenu peuvent être dépouillés.';
}
export const stripDesignated351=(w:World,targetId:number):boolean=>!!w.strip351?.some(d=>d.targetId===targetId);
/** Other jobs reserving the same pawn or corpse (Core reservation of TargetA). */
export function stripTargetClaimed351(w:World,targetId:number,except?:number):Pawn|undefined {
 return w.pawns.find(p=>p.id!==except&&(p.strip351?.targetId===targetId||p.burial?.bodyPawnId===targetId||p.rescue?.patientId===targetId
  ||p.tend?.patientId===targetId&&p.id!==targetId||p.feed?.patientId===targetId||p.surgery?.patientId===targetId||p.ward?.patientId===targetId));
}
const known=(w:World,c:Cell)=>!foggedCell256(w,c.z*w.width+c.x);
function event(w:World,message:string):void {w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.shift();}
const targetLabel=(t:StripTarget351)=>t.dead?`le corps de ${t.pawn.name}`:t.pawn.name;

interface GoodwillPlan351 {relation:NonNullable<World['worldFactions']>['relations'][number];factionName:string;before:number;after:number;kindAfter:'hostile'|'neutral'|'ally'}
/** Faction.Notify_MemberStripped then TryAffectGoodwillWith(-40): a living
 * member of a visible faction that is not hostile to the player. */
function memberStrippedPlan351(w:World,t:StripTarget351):GoodwillPlan351|undefined {
 if(t.dead||isColonist(t.pawn))return;
 const registry=w.worldFactions,factionId=t.pawn.worldAffiliation259?.factionId;if(!registry||typeof factionId!=='number')return;
 const player=registry.factions.find(f=>f.id===registry.playerFactionId),faction=registry.factions.find(f=>f.id===factionId);
 if(!player||!faction||player===faction||faction.hidden)return;
 const a=Math.min(player.id,faction.id),b=Math.max(player.id,faction.id),relation=registry.relations.find(r=>r.aId===a&&r.bId===b);
 if(!relation||relation.kind==='hostile'||!validWorldRelationKind274(relation.goodwill,relation.kind,w.schemaVersion))return;
 // CanChangeGoodwillFor: both visible and lasting, neither defeated, no permanent enmity.
 if(player.hidden||player.lifecycle259?.temporary||faction.lifecycle259?.temporary||player.lifecycle259?.defeated||faction.lifecycle259?.defeated)return;
 if(initialWorldGoodwill256(player.def,faction.def)===-100)return;
 const natural=worldNaturalGoodwill274(faction);if(natural===undefined)return;
 const change=worldGoodwillChange274(relation.goodwill,relation.kind,natural,STRIP_GOODWILL_351);
 if(!change||change.goodwillAfter===relation.goodwill)return;
 return {relation,factionName:faction.name,before:relation.goodwill,after:change.goodwillAfter,kindAfter:change.kindAfter};
}
/** StrippableUtility.CheckSendStrippingImpactsGoodwillMessage. */
export function stripGoodwillWarning351(w:World,t:StripTarget351):string|undefined {
 const plan=memberStrippedPlan351(w,t);
 return plan?`Dépouiller ${t.pawn.name} fâchera ${plan.factionName} (relations ${plan.before} → ${plan.after}).`:undefined;
}

/** A designation as Designator_Strip.CanDesignateThing accepts it. */
export function stripDesignationRefusal351(w:World,targetId:number):string|undefined {
 if(!isStrip351(w.schemaVersion))return 'Dépouiller n’existe pas dans cette partie historique.';
 if(stripDesignated351(w,targetId))return 'Déjà désigné pour être dépouillé.';
 const t=stripTarget351(w,targetId);if(t&&!known(w,t.cell))return 'Cette cible n’est pas connue sur la carte actuelle.';
 return stripRefusal351(w,t);
}
function addDesignation(w:World,t:StripTarget351):void {
 (w.strip351??=[]).push({targetId:t.pawn.id,dead:t.dead,colony:isColonist(t.pawn)});
 const warning=stripGoodwillWarning351(w,t);if(warning)event(w,warning);
}
const wake=(w:World)=>{for(const p of w.pawns)if(isColonist(p)&&!p.prisoner)p.planCooldown=0;};
/** Inspector gizmo (reverse designator) and its cancellation. */
export function designateStrip351(w:World,c:{type:'strip-designate';targetId:number;enabled:boolean}):CommandResult {
 const fail=(reason:string,code:CommandResult['code']='invalid-command'):CommandResult=>({ok:false,code,reason});
 if(!isStrip351(w.schemaVersion))return fail('Dépouiller n’existe pas dans cette partie historique.');
 if(!c||Reflect.ownKeys(c).length!==3||!Number.isSafeInteger(c.targetId)||c.targetId<1||typeof c.enabled!=='boolean')return fail('Ordre de dépouillement invalide.');
 if(!c.enabled){
  if(!stripDesignated351(w,c.targetId))return fail('Aucun dépouillement désigné sur cette cible.','missing-target');
  w.strip351=w.strip351!.filter(d=>d.targetId!==c.targetId);if(!w.strip351.length)delete w.strip351;
  return {ok:true};
 }
 const reason=stripDesignationRefusal351(w,c.targetId);if(reason)return fail(reason,'missing-target');
 if((w.strip351?.length??0)>=MAX_STRIP_DESIGNATIONS_351)return fail('Trop de dépouillements désignés.');
 addDesignation(w,stripTarget351(w,c.targetId)!);wake(w);
 return {ok:true};
}
/** Rectangle designator (FilledRectangle): every unfogged cell, every
 * strippable thing not designated yet, in row-major cell order. */
function areaTargets(w:World,command:AreaCommand):{ok:false;reason:string;code:CommandResult['code']}|{ok:true;cells:number[];targets:StripTarget351[];selected:number;skipped:number;bounds:{minX:number;maxX:number;minZ:number;maxZ:number}} {
 const inside=(c:unknown):c is Cell=>!!c&&typeof c==='object'&&Number.isInteger((c as Cell).x)&&Number.isInteger((c as Cell).z)&&(c as Cell).x>=0&&(c as Cell).z>=0&&(c as Cell).x<w.width&&(c as Cell).z<w.height;
 if(!inside(command.from)||!inside(command.to))return {ok:false,code:'out-of-bounds',reason:'Rectangle hors de la carte.'};
 const bounds={minX:Math.min(command.from.x,command.to.x),maxX:Math.max(command.from.x,command.to.x),minZ:Math.min(command.from.z,command.to.z),maxZ:Math.max(command.from.z,command.to.z)};
 const byCell=new Map<number,StripTarget351[]>();
 if(isStrip351(w.schemaVersion))for(const p of w.pawns){
  const t=stripTarget351(w,p.id);if(!t||t.cell.x<bounds.minX||t.cell.x>bounds.maxX||t.cell.z<bounds.minZ||t.cell.z>bounds.maxZ)continue;
  if(stripDesignated351(w,p.id)||stripRefusal351(w,t))continue;
  const key=t.cell.z*w.width+t.cell.x;let list=byCell.get(key);if(!list)byCell.set(key,list=[]);list.push(t);
 }
 const cells:number[]=[],targets:StripTarget351[]=[];let skipped=0;
 for(let z=bounds.minZ;z<=bounds.maxZ;z++)for(let x=bounds.minX;x<=bounds.maxX;x++){
  const key=z*w.width+x,list=byCell.get(key);
  if(!list||foggedCell256(w,key)){skipped++;continue;}
  cells.push(key);targets.push(...list);
 }
 return {ok:true,cells,targets,selected:(bounds.maxX-bounds.minX+1)*(bounds.maxZ-bounds.minZ+1),skipped,bounds};
}
/** Read-only preview for the rectangle tool (queryArea contract). */
export function queryStripArea351(w:World,command:AreaCommand):{ok:false;reason:string;code:CommandResult['code']}|{ok:true;bounds:{minX:number;maxX:number;minZ:number;maxZ:number};cells:number[];selected:number;skipped:number} {
 if(!isStrip351(w.schemaVersion))return {ok:false,code:'invalid-command',reason:'Dépouiller n’existe pas dans cette partie historique.'};
 const r=areaTargets(w,command);if(!r.ok)return r;
 return {ok:true,bounds:r.bounds,cells:r.cells,selected:r.selected,skipped:r.skipped};
}
export function applyStripArea351(w:World,command:AreaCommand):CommandResult {
 if(!isStrip351(w.schemaVersion))return {ok:false,code:'invalid-command',reason:'Dépouiller n’existe pas dans cette partie historique.'};
 const r=areaTargets(w,command);if(!r.ok)return r;
 if(!r.targets.length)return {ok:false,code:'missing-target',reason:'Aucune case compatible dans ce rectangle.'};
 if((w.strip351?.length??0)+r.targets.length>MAX_STRIP_DESIGNATIONS_351)return {ok:false,code:'invalid-command',reason:'Trop de dépouillements désignés.'};
 for(const t of r.targets)addDesignation(w,t);
 wake(w);
 return {ok:true,affected:r.targets.length,skipped:r.skipped};
}
/** Designator_Cancel removes the designations of the things in its cells. */
export function cancelStripDesignationsIn351(w:World,from:Cell,to:Cell):number {
 if(!w.strip351)return 0;
 const minX=Math.min(from.x,to.x),maxX=Math.max(from.x,to.x),minZ=Math.min(from.z,to.z),maxZ=Math.max(from.z,to.z);
 const before=w.strip351.length;
 w.strip351=w.strip351.filter(d=>{const t=stripTarget351(w,d.targetId);return !t||t.cell.x<minX||t.cell.x>maxX||t.cell.z<minZ||t.cell.z>maxZ;});
 const removed=before-w.strip351.length;if(!w.strip351.length)delete w.strip351;
 return removed;
}
/** The Cancel tool (cell or rectangle) also removes Strip designations. Only
 * after the ordinary cancellation succeeded or found nothing else to cancel. */
export function stripCancel351(w:World,command:Command,result:CommandResult):CommandResult {
 if(!isStrip351(w.schemaVersion)||!w.strip351)return result;
 const rect=command.type==='area'&&command.action==='cancel'?{from:command.from,to:command.to}:command.type==='cancel'?{from:{x:command.x,z:command.z},to:{x:command.x,z:command.z}}:undefined;
 if(!rect||!result.ok&&result.code!=='missing-target')return result;
 const removed=cancelStripDesignationsIn351(w,rect.from,rect.to);
 if(!removed)return result;
 if(result.ok)return typeof result.affected==='number'?{...result,affected:result.affected+removed}:result;
 return {ok:true,affected:removed,skipped:0};
}
/** Designations live on spawned things: they go when the thing despawns
 * (leaves, is carried, buried, destroyed), when a living pawn dies (its corpse
 * is a new thing) and when it joins or leaves the player's faction. A target
 * that merely stops being strippable keeps its designation, as in Core. */
export function reconcileStrip351(w:World):void {
 const list=w.strip351;if(!list)return;
 const kept=list.filter(d=>{const t=stripTarget351(w,d.targetId);return !!t&&t.dead===d.dead&&(d.dead||isColonist(t.pawn)===d.colony);});
 if(kept.length===list.length)return;
 if(kept.length)w.strip351=kept;else delete w.strip351;
}

/** WorkGiver_Strip: the closest designated target the pawn may strip. */
export interface StripProposal351 {targetId:number;cell:Cell;path:Cell[]}
export function stripWanted351(w:World):boolean {return isStrip351(w.schemaVersion)&&!!w.strip351?.length;}
export function stripProposal351(w:World,pawn:Pawn,reach:Reachability,allows:(cell:Cell)=>boolean):StripProposal351|undefined {
 if(!stripWanted351(w))return;
 const candidates:{t:StripTarget351;d:number;order:number}[]=[];
 w.strip351!.forEach((d,order)=>{
  const t=stripTarget351(w,d.targetId);if(!t||t.pawn===pawn)return;
  // Forbidden corpses and targets outside the allowed area are forbidden to the worker.
  if(t.pile&&!materialAllowedForPlayer256(t.pile)||!allows(t.cell))return;
  if(stripTargetClaimed351(w,t.pawn.id,pawn.id)||stripRefusal351(w,t)||isAggressiveCrisis(t.pawn.mental))return;
  candidates.push({t,d:horizontalDistanceSquared(pawn,t.cell),order});
 });
 candidates.sort((a,b)=>a.d-b.d||a.order-b.order);
 for(const {t} of candidates){const path=routeToJob(w,t.cell,reach,true);if(path)return {targetId:t.pawn.id,cell:t.cell,path};}
 return undefined;
}
export function startStrip351(w:World,pawn:Pawn,proposal:StripProposal351,forced=false):void {
 pawn.strip351={targetId:proposal.targetId,phase:'approach',progressCore:0,lastWorkedAt:w.tick,...forced?{forced:true as const}:{}};
 pawn.path=proposal.path;pawn.state=proposal.path.length?'moving':'working';pawn.planCooldown=0;
}
export function releaseStrip351(w:World,pawn:Pawn):void {
 if(!pawn.strip351)return;delete pawn.strip351;pawn.path=[];pawn.planCooldown=0;
 if(pawn.moveCooldown===0&&(pawn.motion?.end??0)<=w.tick&&(pawn.state==='working'||pawn.state==='moving'))pawn.state='idle';
}

/** Pawn.Strip: equipment, then worn apparel (both unforbidden), then the
 * inventory, each near the target cell, keeping every identity and count.
 * One transaction: when a thing cannot be placed, nothing moves. */
export function commitStrip351(w:World,t:StripTarget351):{ok:true;dropped:number}|{ok:false} {
 const id=t.pawn.id,origin=t.cell;
 const piles=[...w.piles.filter(p=>p.owner.type==='equipment'&&p.owner.pawnId===id),...w.piles.filter(p=>p.owner.type==='apparel'&&p.owner.pawnId===id),...w.piles.filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===id)];
 const packs=(w.packed??[]).filter(p=>p.owner.type==='inventory'&&p.owner.pawnId===id);
 const moved:{target:{owner:MaterialPile['owner']};owner:MaterialPile['owner']}[]=[];
 const rollback=()=>{for(const m of moved.reverse())assignPileOwner(m.target,m.owner);};
 for(const pile of piles){const owner=pile.owner;if(!dropRetainingIdentity(w,pile,origin)){rollback();return {ok:false};}moved.push({target:pile,owner});}
 for(const pack of packs){const owner=pack.owner,cell=furnitureDropCell(w,origin,id);if(!cell){rollback();return {ok:false};}assignPileOwner(pack,{type:'ground',...cell});moved.push({target:pack,owner});}
 for(const pile of piles){if(pile.owner.type!=='ground')continue;const was=moved.find(m=>m.target===pile)!.owner.type;
  if(was==='equipment'&&pile.weapon)delete pile.weapon.forbidden;
  if(was==='apparel'&&pile.apparel){delete pile.apparel.forbidden;delete pile.apparel.forced;}}
 return {ok:true,dropped:piles.length+packs.length};
}
/** The goodwill consequence, after a committed strip of a living member. */
function notifyMemberStripped351(w:World,t:StripTarget351):void {
 const plan=memberStrippedPlan351(w,t);if(!plan)return;
 const kindChanged=plan.relation.kind!==plan.kindAfter;
 plan.relation.goodwill=plan.after;plan.relation.kind=plan.kindAfter;
 // Local actors of the faction follow the relation, as peace talks do.
 if(kindChanged&&plan.kindAfter!=='ally')for(const p of w.pawns)if(p.worldAffiliation259?.factionId===t.pawn.worldAffiliation259?.factionId&&!p.prisoner&&!p.raid)p.faction=plan.kindAfter==='hostile'?'outlaws':'outlanders';
 event(w,`Relations avec ${plan.factionName} : ${plan.before} → ${plan.after} (membre dépouillé).`);
}

/** JobDriver_Strip, one local tick. False when the job ended without acting,
 * so that the engine may give the pawn something else this tick. */
export function processStrip351(w:World,pawn:Pawn,context:NeedContext):boolean {
 const task=pawn.strip351;if(!task)return false;
 const t=stripTarget351(w,task.targetId);
 const cancel=():false=>{releaseStrip351(w,pawn);return false;};
 // FailOnDespawnedOrNull, FailOnAggroMentalState, FailOn(!CanBeStrippedByColony), reservation.
 if(!t||t.pawn===pawn||stripRefusal351(w,t)||isAggressiveCrisis(t.pawn.mental)||stripTargetClaimed351(w,t.pawn.id,pawn.id))return cancel();
 // Goto toil: FailOnDespawnedNullOrForbidden; the allowed area forbids too.
 if(task.phase==='approach'&&!task.forced&&t.pile&&!materialAllowedForPlayer256(t.pile))return cancel();
 if(allowedAreaReason(w,pawn,t.cell))return cancel();
 const settled=pawn.moveCooldown===0&&!(pawn.motion&&pawn.motion.end>w.tick);
 const contact=settled&&(pawn.x===t.cell.x&&pawn.z===t.cell.z||adjacent(pawn,t.cell));
 if(!contact){
  // A target that walked off (a prisoner) is reached again before the wait resumes.
  if(task.phase==='strip'){task.phase='approach';task.progressCore=0;}
  context.move(t.cell,false);return true;
 }
 pawn.path=[];pawn.state='working';
 if(task.phase==='approach'){task.phase='strip';task.progressCore=0;task.lastWorkedAt=w.tick;return true;}
 if(w.tick>task.lastWorkedAt){task.lastWorkedAt=w.tick;task.progressCore+=10;}
 if(task.progressCore<STRIP_CORE_TICKS_351)return true;
 // Final toil: Strip, and the designation goes with it. A failed placement
 // keeps both the designation and every worn thing.
 const result=commitStrip351(w,t);
 if(!result.ok)context.event(`${pawn.name} ne trouve pas de place au sol pour les affaires de ${t.pawn.name}.`);
 else{
  if(w.strip351){w.strip351=w.strip351.filter(d=>d.targetId!==t.pawn.id);if(!w.strip351.length)delete w.strip351;}
  context.event(`${pawn.name} dépouille ${targetLabel(t)} (${result.dropped} objet${result.dropped>1?'s':''} au sol).`);notifyMemberStripped351(w,t);
 }
 releaseStrip351(w,pawn);return true;
}

/** FloatMenuOptionProvider_Strip (drafted and undrafted, one pawn): the menu
 * query and the committed order share these checks. Read only. */
export type StripOrderIntent351={ok:false;reason:string}|{ok:true;pawn:Pawn;target:StripTarget351;path:Cell[]};
export function stripOrderIntent351(w:World,pawnId:number,targetId:number):StripOrderIntent351 {
 const no=(reason:string):StripOrderIntent351=>({ok:false,reason});
 if(!isStrip351(w.schemaVersion))return no('Dépouiller n’existe pas dans cette partie historique.');
 const p=w.pawns.find(q=>q.id===pawnId);
 if(!p||!isColonist(p)||p.prisoner||p.state==='dead'||p.state==='downed'||p.burning)return no('Un colon libre et capable est requis.');
 const medical=medicalWorkRefusal(p);if(medical)return no(medical);
 if(carrierOf(w,p.id))return no('Ce colon est transporté.');
 const t=stripTarget351(w,targetId);if(t&&t.pawn===p)return no('Un colon ne se dépouille pas lui-même.');
 const refusal=stripRefusal351(w,t);if(refusal)return no(refusal);
 if(isAggressiveCrisis(t!.pawn.mental))return no(`${t!.pawn.name} est en crise violente.`);
 const claim=stripTargetClaimed351(w,t!.pawn.id,p.id);if(claim)return no(`Réservé par ${claim.name}.`);
 const area=allowedAreaReason(w,p,t!.cell);if(area)return no(area);
 const path=routeToJob(w,t!.cell,reachableCells(w,p,blockedCells(w),new Set()),true);
 if(path===null)return no('Aucun chemin jusqu’à la cible.');
 return {ok:true,pawn:p,target:t!,path};
}
/** The strippable things of one cell, in pawn array order. */
export function stripTargetsAt351(w:World,cell:Cell):StripTarget351[] {
 if(!isStrip351(w.schemaVersion))return [];
 const result:StripTarget351[]=[];
 for(const p of w.pawns){const t=stripTarget351(w,p.id);if(t&&t.cell.x===cell.x&&t.cell.z===cell.z&&!stripRefusal351(w,t))result.push(t);}
 return result;
}

/** Inspector gizmo: the reverse Strip designator when it would be accepted,
 * or the cancellation of an existing designation. Read only. */
export function stripInspectorAction351(w:World,targetId:number):{label:string;command:{type:'strip-designate';targetId:number;enabled:boolean}}|undefined {
 if(!isStrip351(w.schemaVersion))return;
 if(stripDesignated351(w,targetId))return {label:'Annuler le dépouillement',command:{type:'strip-designate',targetId,enabled:false}};
 return stripDesignationRefusal351(w,targetId)?undefined:{label:'Dépouiller',command:{type:'strip-designate',targetId,enabled:true}};
}
/** Strict save validation of the world and pawn fields and their owners. */
export function validateStrip351(w:World,version:number):string[] {
 const errors:string[]=[];
 if(!validStripDesignations351(w,version,w.nextId))errors.push('Invalid or future strip designations.');
 for(const p of w.pawns)if(!validStripTaskField351(p,version,w.tick,w.nextId))errors.push('Invalid or future strip job.');
 if(errors.length||!isStrip351(version))return errors;
 const ids=new Set(w.pawns.map(p=>p.id));
 for(const d of w.strip351??[]as StripDesignation351[])if(!ids.has(d.targetId))errors.push('Strip designation on an absent person.');
 const claimed=new Set<number>();
 for(const p of w.pawns){
  const task=p.strip351;if(!task)continue;
  if(!ids.has(task.targetId)||task.targetId===p.id||claimed.has(task.targetId)||!isColonist(p)||p.prisoner||p.state==='dead'||p.state==='downed')errors.push('Invalid strip job owner or target.');
  claimed.add(task.targetId);
 }
 return errors;
}
