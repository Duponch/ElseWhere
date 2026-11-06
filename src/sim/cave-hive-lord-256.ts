import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Three native insect Pawns, ordinary anatomical melee, actual map contacts.
 * The Lord owns references/duty state only; it never owns another Pawn copy. */
import type {World,Cell,Structure} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import {wildlifeRandom} from './wildlife-state.ts';
import {combatTarget,isAnimalTarget,isMechanoidTarget,type LivingTarget} from './combat-target.ts';
import {animalNavigation,moveAnimal} from './wildlife-navigation.ts';
import {animalBody} from './wildlife-health.ts';
import {meleeContact} from './melee-space.ts';
import {footprintCells} from './definitions.ts';
import {RoomTopologyCache} from './room-topology.ts';
import {caveRadialPattern256} from './local-cave-radial-256.ts';
import {processHiveMaintenance256,releaseHiveMaintenance256} from './cave-hive-maintenance-256.ts';
import {OBSERVED_HIVE_MAINTENANCE_KEY_256} from './cave-hive-think-256.ts';
import {actualCampRemovalAbsCore256} from './world-pawn-map-removed-256.ts';
import {animalMeleeTools} from './wildlife-melee.ts';
import {chooseMeleeTool} from './melee-statistics.ts';
import {damageStructure} from './thing-damage.ts';
import {healthRandom} from './health.ts';
import type {ActualHive256,HiveLord256} from './cave-hive-state-256.ts';
import {isColonist} from './affiliation.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import type {BombInstigatorKey} from './mini-turret-state.ts';
import { structureById } from './structure-navigation.ts';
export type HiveDutyJob256={kind:'maintain';hiveId:number;progressCore:number}|{kind:'attack';targetId:number;structure?:true};
export function combatTargetKeyForHive256(w:World,id:number):BombInstigatorKey|undefined {
 if(w.pawns.some(p=>p.id===id))return `pawn:${id}`;
 if(w.wildlife?.animals.some(a=>a.id===id))return `animal:${id}`;
 if(w.mechanoids?.some(m=>m.id===id))return `mech:${id}`;
 return;
}
const square=(a:Cell,b:Cell)=>(a.x-b.x)**2+(a.z-b.z)**2;
const contacts=(w:World,s:Structure):Cell[]=>{const cells=footprintCells(s),inside=new Set(cells.map(c=>c.z*w.width+c.x)),out=new Map<number,Cell>();for(const c of cells)for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){const n={x:c.x+x,z:c.z+z};if(n.x>=0&&n.z>=0&&n.x<w.width&&n.z<w.height&&!inside.has(n.z*w.width+n.x))out.set(n.z*w.width+n.x,n);}return [...out.values()];};
export const activeHiveInsect256=(a:WildAnimal):boolean=>!!a.hive&&a.hive.lordId!==null&&!a.domestic&&!['dead','downed'].includes(a.state)&&!a.health?.death;
/** One current capture shared by automatic defense and civilian fleeing.
 * Preserve the historical manhunter lane and original actor/order identities. */
export const captureAnimalCombatThreats256=(w:Pick<World,'wildlife'>):WildAnimal[]=>w.wildlife?.animals.filter(a=>(a.manhunter||activeHiveInsect256(a))&&!['dead','downed'].includes(a.state))??[];
/** The closed producer is the actual permanent Insect faction. Wild animals
 * with no faction are not silently converted into its enemies. */
export function hiveFactionEnemy256(w:World,a:WildAnimal,t:LivingTarget):boolean {
 if(!activeHiveInsect256(a)||a.id===t.id||['dead','downed'].includes(t.state)||t.health?.death)return false;
 const f=w.worldFactions?.factions.find(f=>f.id===a.hive!.factionId);if(f?.def!=='Insect')return false;
 if(!isAnimalTarget(t))return true;
 if(t.hive)return t.hive.factionId!==a.hive!.factionId;
 return !!t.domestic||!!t.manhunter;
}
export function hiveAttackTarget256(w:World,a:WildAnimal):LivingTarget|undefined {
 const j=a.hiveJob;if(j?.kind!=='attack'||j.structure)return;
 const t=combatTarget(w,j.targetId);return t&&hiveFactionEnemy256(w,a,t)?t:undefined;
}
function lordFor(w:World,a:WildAnimal):HiveLord256|undefined{return a.hive?.lordId===null?undefined:w.wildlife?.hiveLords?.find(l=>l.id===a.hive?.lordId);}
/** Resolve a real present instigator. No inferred animal faction or map label. */
export function hiveInstigatorFaction256(w:World,key:BombInstigatorKey|undefined):{hasFaction:boolean;parentFaction:boolean} {
 const none={hasFaction:false,parentFaction:false};if(!key)return none;
 const [family,value]=key.split(':'),id=Number(value),root=registeredCampaign(w),record=root.worldMaps?.sites.find(s=>s.id===registeredMapId(w)),playerParent=record?.kind==='settlement'||record?.kind==='camp';
 if(family==='pawn'){const p=w.pawns.find(p=>p.id===id);return p?{hasFaction:true,parentFaction:playerParent&&isColonist(p)}:none;}
 if(family==='mech')return {hasFaction:!!w.mechanoids?.some(m=>m.id===id),parentFaction:false};
 if(family==='animal'){const a=w.wildlife?.animals.find(a=>a.id===id),player=w.worldFactions?.playerFactionId;return a?{hasFaction:!!a.domestic||!!a.hive,parentFaction:playerParent&&(!!a.domestic||a.hive?.factionId===player)}:none;}
 const s=structureById(w,id);return s?{hasFaction:!Object.hasOwn(s,'factionId')||s.factionId!==null,parentFaction:playerParent&&(!Object.hasOwn(s,'factionId')||s.factionId===w.worldFactions?.playerFactionId)}:none;
}
function endLordJobs(w:World,id:number):void {
 for(const a of w.wildlife?.animals??[])if(a.hive?.lordId===id){delete a.hiveJob;delete a.meal;delete a.predation;delete a.exiting;if(a.wander)delete a.wander.job;a.path=[];if(!['dead','downed'].includes(a.state))a.state=(a.motion?.end??0)>w.tick?'moving':'idle';a.nextDecision=w.tick;}
}
/** Actual damage/memo producer only. Return-to-defend consumes no RNG. */
export function receiveHiveMemo256(w:World,kind:'attacked'|'burned'|'destroyed'|'despawned'|'heat-burn'|'pawn-lost',core:number,lordId?:number):void {
 if(!isSchema256Or257(w.schemaVersion)||!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<0||core>w.tick*10))return;
 // Replace only the local Lord header; private physical outcome views never
 // write another owner's Lord object through a shared header reference.
 if(!w.wildlife?.hiveLords)return;
 const changed:number[]=[];w.wildlife.hiveLords=w.wildlife.hiveLords.map(l=>{
  if(lordId!==undefined&&l.id!==lordId)return l;
  const phase=kind==='despawned'?l.phase:l.phase==='defend-expand'?(l.aggressive?'assault':'defend-aggressive'):l.phase;
  if(phase!==l.phase)changed.push(l.id);return {...l,phase,lastHarmCore:core,assignedHives:kind==='despawned'?l.assignedHives.filter(r=>w.structures.some(s=>s.id===r.hiveId&&s.kind==='insect-hive')):l.assignedHives};
 });
 for(const id of changed)endLordJobs(w,id);
}
export function notifyHivePawnHarmed256(w:World,lordId:number|null|undefined,instigatorFaction:boolean,instigatorIsParentFaction:boolean,core:number,draw:()=>number):void {
 if(lordId===null||lordId===undefined)return;let lord=w.wildlife?.hiveLords?.find(l=>l.id===lordId);if(!lord)return;
 const quiet={...lord,lastHarmCore:core};w.wildlife!.hiveLords=w.wildlife!.hiveLords!.map(l=>l===lord?quiet:l);lord=quiet;
 if(lord.phase==='defend-expand'&&instigatorFaction&&draw()<.5){receiveHiveMemo256(w,'attacked',core,lord.id);return;}
 if(lord.phase!=='assault'&&instigatorIsParentFaction&&draw()<.5){w.wildlife!.hiveLords=w.wildlife!.hiveLords!.map(l=>l.id===lord!.id?{...l,phase:'assault',lastHarmCore:core}:l);endLordJobs(w,lord.id);}
}
function focus(w:World,a:WildAnimal,nav:ReturnType<typeof animalNavigation>,take:()=>boolean):ActualHive256|undefined {
 const lord=lordFor(w,a);if(!lord)return;
 const saved=lord.assignedHives.find(r=>r.pawnId===a.id),existing=w.structures.find((s):s is ActualHive256=>s.kind==='insect-hive'&&s.id===saved?.hiveId&&s.factionId===a.hive!.factionId);if(existing)return existing;
 if(saved)lord.assignedHives=lord.assignedHives.filter(r=>r!==saved);if(!take())return;
 const reach=nav.wanderSearch(a),candidate=w.structures.filter((s):s is ActualHive256=>s.kind==='insect-hive'&&s.factionId===a.hive!.factionId&&square(a,s)<=900).sort((x,y)=>square(a,x)-square(a,y)).find(s=>contacts(w,s).some(c=>reach.canReach(c)));
 if(candidate)lord.assignedHives.push({pawnId:a.id,hiveId:candidate.id});return candidate;
}
/** Before ordinary meal/rest selection, after real fire/mental/retaliation.
 * Existing rotating quota defers a search; it never clears a captured edge. */
export function processHivePriority256(w:World,a:WildAnimal,getNav:()=>ReturnType<typeof animalNavigation>,getPhysical:()=>Uint8Array,take:()=>boolean):boolean {
 if(!activeHiveInsect256(a)||a.confusion||a.manhunter||a.burning)return false;
 const lord=lordFor(w,a);if(!lord)return false;
 const nav=getNav(),physical=getPhysical();
 if(lord.phase!=='defend-expand'&&w.tick*10-lord.lastHarmCore>=1200){lord.phase='defend-expand';for(const member of w.wildlife?.animals??[])if(member.hive?.lordId===lord.id&&member.hiveJob?.kind==='attack'&&member.hiveJob.structure)releaseHiveMaintenance256(w,member);}
 const hive=focus(w,a,nav,take),assault=lord.phase==='assault'||!hive,radius=lord.phase==='defend-expand'?10:40,acquire=lord.phase==='defend-expand'?30:50;
 if(lord.phase!=='defend-expand'&&a.hiveJob?.kind==='maintain')releaseHiveMaintenance256(w,a);
 const permitted=(t:LivingTarget)=>hiveFactionEnemy256(w,a,t)&&square(a,t)<=acquire*acquire&&(assault||!hive||square(hive,t)<=radius*radius);
 let target=hiveAttackTarget256(w,a);if(target&&!permitted(target)){releaseHiveMaintenance256(w,a);target=undefined;}
 if(target&&meleeContact(w,a,target,physical)){a.path=[];a.state='idle';return true;}
 if((!target||!a.path.length||w.tick>=a.nextDecision)&&take()){
  const candidates:LivingTarget[]=[...w.pawns,...(w.wildlife?.animals??[]),...(w.mechanoids??[])].filter(permitted);
  const route=nav.humanPursuitRoute(a,target?[target,...candidates.filter(c=>c!==target)]:candidates,physical,!!target);
  if(route){delete a.meal;delete a.predation;if(a.wander)delete a.wander.job;a.hiveJob={kind:'attack',targetId:route.targetId};a.path=route.path;a.nextDecision=w.tick+25;}
  else if(target)releaseHiveMaintenance256(w,a);
  if(!route&&assault){
   const player=w.worldFactions?.playerFactionId,buildings=w.structures.filter(s=>s.kind!=='insect-hive'&&s.kind!=='glow-pod'&&(s.factionId===undefined||s.factionId===player)).sort((x,y)=>square(a,x)-square(a,y));
   for(const building of buildings){const path=nav.route(a,contacts(w,building));if(!path)continue;delete a.meal;if(a.wander)delete a.wander.job;a.hiveJob={kind:'attack',targetId:building.id,structure:true};a.path=path;a.nextDecision=w.tick+25;break;}
  }
 }
 if(a.hiveJob?.kind==='attack'){
  const order=a.hiveJob;
  if(order.structure){const s=structureById(w,order.targetId);if(!s){releaseHiveMaintenance256(w,a);return false;}if(footprintCells(s).some(c=>meleeContact(w,a,c,physical))){a.path=[];a.state='idle';return true;}}
  if(a.path.length)moveAnimal(w,a,nav.step,animalBody(a).capacities.moving);return true;
 }
 return processHiveMaintenance256(w,a,{free:c=>nav.free(c),route:(actor,goals)=>nav.route(actor,goals),move:actor=>{moveAnimal(w,actor,nav.step,animalBody(actor).capacities.moving);},takeSearch:take},OBSERVED_HIVE_MAINTENANCE_KEY_256,actualCampRemovalAbsCore256(registeredCampaign(w),w));
}
/** JobGiver_WanderHive uses the original MindState nextMoveOrderIsWait flag.
 * No second timer/tracker, global-region scan or per-frame choice is created. */
export function processHiveWander256(w:World,a:WildAnimal,nav:ReturnType<typeof animalNavigation>,take:()=>boolean):boolean {
 if(!activeHiveInsect256(a)||a.confusion||a.manhunter||!a.wander)return false;
 const job=a.wander.job;if(job?.kind==='wait'){if(w.tick*10>=job.untilCore){delete a.wander.job;a.nextDecision=w.tick;}return true;}
 if(job?.kind==='goto'){if(a.path.length)moveAnimal(w,a,nav.step,animalBody(a).capacities.moving);else{delete a.wander.job;a.nextDecision=w.tick;}return true;}
 if(!take())return true;
 if(a.wander.nextMoveOrderIsWait){a.wander.nextMoveOrderIsWait=false;a.wander.job={kind:'wait',untilCore:w.tick*10+125+Math.floor(wildlifeRandom(w.wildlife!)*76)};a.state='idle';return true;}
 const lord=lordFor(w,a),assignment=lord?.assignedHives.find(r=>r.pawnId===a.id),hive=w.structures.find(s=>s.id===assignment?.hiveId&&s.kind==='insect-hive'),root=hive??a,search=nav.wanderSearch(a),radial=caveRadialPattern256(7.5),cells:Cell[]=[];
 for(let i=0;i<radial.count;i++){const [dx,dz]=radial.offsets[i]!,c={x:root.x+dx,z:root.z+dz};if(nav.free(c))cells.push(c);}
 while(cells.length){const at=Math.floor(wildlifeRandom(w.wildlife!)*cells.length),c=cells.splice(at,1)[0]!,path=search.pathTo(c);if(!path)continue;a.wander.nextMoveOrderIsWait=true;if(c.x===a.x&&c.z===a.z){a.wander.job={kind:'wait',untilCore:w.tick*10+125+Math.floor(wildlifeRandom(w.wildlife!)*76)};a.path=[];a.state='idle';return true;}a.wander.job={kind:'goto',destination:c};a.path=path;if(path.length)moveAnimal(w,a,nav.step,animalBody(a).capacities.moving);return true;}
 a.wander.nextMoveOrderIsWait=false;a.nextDecision=w.tick+12;return true;
}
/** Existing tool selection/cooldown and real Structure damage, no parallel
 * combat engine or manhunter alias. Called inside the ordinary Core substep. */
export function advanceHiveStructureMelee256(w:World,a:WildAnimal,core:number,getPhysical:()=>Uint8Array):boolean {
 const job=a.hiveJob;if(!activeHiveInsect256(a)||job?.kind!=='attack'||!job.structure||a.burning||a.stun||a.strike||(a.motion?.end??0)>core/10)return false;
 const target=structureById(w,job.targetId);if(!target){delete a.hiveJob;return false;}
 const physical=getPhysical();
 if(!footprintCells(target).some(c=>meleeContact(w,a,c,physical)))return false;
 const state={rng:w.rng},tool=chooseMeleeTool(animalMeleeTools(a),()=>healthRandom(state));if(!tool)return false;
 const raw=Math.max(1,tool.damage*(.8+healthRandom(state)*.4)),damage=Math.floor(raw)+Number(healthRandom(state)<raw%1);
 if(!damageStructure(w,target,damage,'melee',state.rng,{core,rawAmount:raw,instigatorKey:`animal:${a.id}`}))return false;
 a.strike={targetId:w.structures.includes(target)?target.id:null,structure:{x:target.x,z:target.z},atCore:core,untilCore:core+tool.cooldownCore,tool:tool.id,outcome:'hit'};a.path=[];a.state='idle';if(!w.structures.includes(target))delete a.hiveJob;return true;
}
