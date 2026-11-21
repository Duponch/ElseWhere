import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {isOutdoors359} from './outdoors-need-359.ts';
import {prepareGroupReform260,type GroupReformCommand260} from './group-reform-260.ts';
import {advanceGroupAnimalPersonal256,advanceGroupAnimalMeters256,advanceLegacyAnimalInterval256} from './group-animal-runtime-256.ts';
import {recalculateGroupCarried256} from './group-caravan-carry-256.ts';
import type {CampaignState} from './world-map-state.ts';
import type {World,CommandResult,Pawn} from './types.ts';
import type {GroupReorganizationCommand} from './group-reorganization-state.ts';
import type {AwayGroup} from './group-capture.ts';
import {GroupMotionRuntime,type GroupMotionOwner,type GroupMotionGeometry} from './group-motion-runtime.ts';
import {prepareGroupSplit,prepareGroupMerge,commitGroupReorganization} from './group-reorganization.ts';
import {registeredMap as importedReformMap260,withWorldGroup} from './world-map-context.ts';
import {advanceGroup,advanceGroupPersonalFrontier,type GroupPersonalFrontier256} from './group-driver.ts';
import {groupLog} from './group-authority.ts';
import {groupCoreTicks256} from './group-core-cadence-256.ts';
import {GroupRestMarks256,advanceGroupNeedMeters256} from './group-need-meters-256.ts';
import {advanceGroupRouteInterval256} from './group-route-interval-256.ts';
import {captureGroupTravel} from './group-capture.ts';
import type {GroupCaravanPhysical256} from './group-caravan-physical-256.ts';
import type {GroupForageOwner256} from './group-forage-256.ts';
import {adoptGroupProvisionClimate,groupProvisionClimateRate} from './group-provision-age.ts';
import {planetCostContext} from './planet-navigation.ts';
import {pawnBody} from './health-rules.ts';
import {hasMentalBreak} from './mental-state.ts';
import {healthRandom} from './health.ts';
import {colonyExpectation} from './colony-economy.ts';
export interface GroupCampaignGeometry256 extends GroupMotionGeometry {
 passable(root:CampaignState,tile:number):boolean;
 finalPushDestination(root:CampaignState,tile:number):boolean;
 playerDef(root:CampaignState):'PlayerColony'|'PlayerTribe';
}
/** One explicit instance belongs to one confirmed Worker generation. No DOM,
 * wall clock, process singleton or persisted DrawPos is part of simulation. */
export class GroupCampaignRuntime256 {
 readonly motion:GroupMotionRuntime;
 readonly restMarks=new GroupRestMarks256();
 #root:CampaignState|undefined;
 readonly #physicalChanged=new Set<number>();
 constructor(readonly geometry:GroupCampaignGeometry256,readonly physical:GroupCaravanPhysical256){this.motion=new GroupMotionRuntime(geometry);}
 owners(root:CampaignState,coreTick?:number):GroupMotionOwner[] {
  return (root.worldGroups?.groups??[]).flatMap(r=>{const g=r.state;if(r.localMapId!==null||!('members'in g)||coreTick!==undefined&&g.departedAt*10>=coreTick)return [];return [{id:g.id,tile:g.tile,destination:g.destination,moving:g.phase==='travelling'&&!g.paused&&g.stop===null,segment:g.segment,nextPassable:!g.segment||this.geometry.passable(root,g.segment.to),...g.travel?{travel:g.travel}:{},...g.animalOwners?.interval&&(coreTick===undefined||g.animalOwners.interval.startedAt*10<coreTick)?{animalInterval:g.animalOwners.interval}:{}}];});
 }
 bootstrap(root:CampaignState):void {this.#root=root;this.restMarks.bootstrap(Number(root.schemaVersion)>=266);this.physical.clear();this.#physicalChanged.clear();this.motion.bootstrap(this.owners(root));for(const r of root.worldGroups!.groups)if('members'in r.state&&r.state.travel)this.physical.rebuild(r.state as GroupForageOwner256);}
 setGlobeSelected(root:CampaignState,selected:boolean):void {this.authority(root);this.motion.setGlobeSelected(selected);}
 private authority(root:CampaignState):void {if(root!==this.#root||!root.worldMaps||!root.worldGroups)throw Error('Missing confirmed caravan generation');}
 /** A confirmed encounter command invalidates only its real physical capture.
  * Survivor draw positions, committed segment and cadence are never reset. */
 /** Preflight one true physical exit AFTER this tick's personal pass. */
 preparePlayerRetreat261(root:CampaignState,g:AwayGroup,targetId?:number){
  this.authority(root);if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion)))))throw Error('Actual261 retreat runtime required');
  const owner={id:g.id,tile:g.tile,destination:g.destination,moving:g.phase==='travelling'&&!g.paused&&g.stop===null,segment:g.segment,nextPassable:!g.segment||this.geometry.passable(root,g.segment.to),...g.travel?{travel:g.travel}:{}};
  const registration=targetId===undefined?this.motion.prepareRegistration(owner,[...this.owners(root),owner]):undefined;
  return {commit:()=>{if(registration)this.motion.commitRegistration(registration);if(targetId!==undefined){this.motion.remove(g.id);this.physical.remove(g.id);}this.#physicalChanged.add(targetId??g.id);}};
 }
 encounterChanged261(root:CampaignState,id:number):void {
  this.authority(root);const row=root.worldGroups!.groups.find(r=>r.state.id===id);
  if(row&&'members'in row.state)this.#physicalChanged.add(id);
  else{this.motion.remove(id);this.physical.remove(id);this.#physicalChanged.delete(id);}
 }
 /** Shape/proximity/RNG/fragment checks precede the first owner write. */
 apply(root:CampaignState,c:GroupReorganizationCommand):CommandResult {
  try{
   this.authority(root);
   const prepared=c.type==='group-split'?prepareGroupSplit(root,c):prepareGroupMerge(root,c,this.motion);
   if(prepared.kind!=='ready')return {ok:false,code:'invalid-command',reason:prepared.reason};
   const staged=[...this.owners(root),...prepared.plan.created.map(r=>{const g=r.state as AwayGroup;return {id:g.id,tile:g.tile,destination:g.destination,moving:false,segment:g.segment,nextPassable:true,...g.travel?{travel:g.travel}:{}};})];
   const registrations=prepared.plan.created.map(r=>this.motion.prepareRegistration(staged.find(g=>g.id===r.state.id)!,staged));
   const result=commitGroupReorganization(prepared.plan);if(!result.ok)return result;
   for(const r of prepared.plan.removed){this.motion.remove(r.state.id);this.physical.remove(r.state.id);}
   for(const registration of registrations)this.motion.commitRegistration(registration);
   for(const id of prepared.plan.survivors)this.#physicalChanged.add(id);
   return result;
  }catch{return {ok:false,code:'invalid-command',reason:'Le contexte confirme de mouvement ne permet pas cette operation.'};}
 }
 reform(root:CampaignState,c:GroupReformCommand260):CommandResult {
  this.authority(root);const map=importedReformMap260(root,c.originMapId);if(!map)return {ok:false,code:'invalid-command',reason:'Camp source absent.'};
  const prepared=prepareGroupReform260(map,c);if(prepared.kind!=='ready')return {ok:false,code:'invalid-command',reason:prepared.kind==='refused'?prepared.reason:'Préparation de réforme indisponible.'};if(prepared.plan.quote!==c.quote)return {ok:false,code:'invalid-command',reason:'Le manifeste, les propriétaires, la route ou l’accès ont changé. Vérifiez de nouveau la réforme.'};
  const g=prepared.plan.record.state as AwayGroup,owner={id:g.id,tile:g.tile,destination:g.destination,moving:g.phase==='travelling',segment:g.segment,nextPassable:true,travel:g.travel!},registration=this.motion.prepareRegistration(owner,[...this.owners(root),owner]);
  const result=prepared.plan.commit();if(!result.ok)return result;this.motion.commitRegistration(registration);this.#physicalChanged.add(g.id);return result;
 }
 /** Called after real local steps/departures at this single local tick. The
  * caller must replace the former whole group loop, never run both loops. */
 step(root:CampaignState):void {
  this.authority(root);
  // A newly departed actual owner is the only implicit registration allowed.
  // Load/recovery must call bootstrap before stepping or accepting a command.
  let owners=this.owners(root);
  for(const owner of owners)if(!this.motion.position(owner.id)){
   const g=root.worldGroups!.groups.find(r=>r.state.id===owner.id)!.state as AwayGroup;
   if(g.departedAt!==root.tick||g.lastPersonalTick!==root.tick)throw Error('Unconfirmed caravan motion birth');this.motion.register(owner,owners);this.#physicalChanged.add(owner.id);
  }
  for(const row of root.worldGroups!.groups.slice())if(row.localMapId===null&&'members'in row.state){
   const g=row.state;if(g.travel&&this.#physicalChanged.delete(g.id))this.physical.rebuild(g as GroupForageOwner256);
   withWorldGroup(root,g.id,w=>{const personalDue=g.lastPersonalTick!==w.tick;if(g.travel)advanceGroupPersonalFrontier(w,{resting:g.phase!=='travelling'||g.paused||g.stop!==null,clinicalRestFor256:p=>this.physical.clinicalRestFor(g as GroupForageOwner256,p)});else advanceGroup(w);const current=w.group;if(personalDue&&current&&'members'in current){const moving=current.phase==='travelling'&&!current.paused&&current.stop===null,carried=recalculateGroupCarried256(current,moving);advanceGroupAnimalPersonal256(w,current,a=>({resting:!moving||carried.has(a.id),carried:carried.has(a.id)}));}});
  }
  for(const coreTick of groupCoreTicks256(root.tick)){
   for(const row of root.worldGroups!.groups)if(row.localMapId===null&&'members'in row.state&&row.state.departedAt<root.tick)advanceGroupAnimalMeters256(row.state,coreTick,this.restMarks);
   for(const row of root.worldGroups!.groups.slice())if(row.localMapId===null&&'members'in row.state&&row.state.travel&&row.state.departedAt<root.tick)withWorldGroup(root,row.state.id,w=>{
    const g=w.group as AwayGroup,expectation=colonyExpectation(w,g.members[0]!);
    advanceGroupNeedMeters256(g,{coreTick,legacyFood:w.foodRules==='legacy',legacyRest:w.restRules==='legacy',joyToleranceFall:(expectation?.joyToleranceDropPerDay??.18)*100/6000,restMarks:this.restMarks,...isOutdoors359(w.schemaVersion)?{outdoors359:true}:{}});
   });
   this.motion.stepCore(coreTick,{owners:()=>this.owners(root,coreTick),beforeTween:(id,deltaCore)=>{
    const row=root.worldGroups!.groups.find(r=>r.state.id===id);if(!row||!('members'in row.state)||!row.state.travel)return;
    withWorldGroup(root,id,w=>{
     const g=w.group as AwayGroup,travel=captureGroupTravel(g,p=>({incapable:p.state==='downed'||hasMentalBreak(p)||pawnBody(p).capacities.moving<=0,restNeed:true}),w.schemaVersion);if(!travel)throw Error('Invalid actual caravan mass');
     const cost=planetCostContext(w,travel.mass);cost.homeCivilCore-=w.tick*10-coreTick;
     const next=advanceGroupRouteInterval256(w.planet!,g,{travel,cost,deltaCore,version:root.schemaVersion,validFinalPushDestination:tile=>this.geometry.finalPushDestination(root,tile)});if(!('members'in next.state))throw Error('Invalid caravan route result');w.group=next.state;
     if(next.state.tile!==g.tile)adoptGroupProvisionClimate(w,next.state);
     if(next.event==='arrived')groupLog(w,'La caravane est arrivee a sa destination.');
    });
   },afterTween:(id,deltaCore)=>{
    const row=root.worldGroups!.groups.find(r=>r.state.id===id);if(!row||!('members'in row.state)||!row.state.travel)return;
    withWorldGroup(root,id,w=>{const g=w.group as GroupForageOwner256,random=()=>healthRandom(w);this.physical.afterTween(w,g,coreTick,deltaCore,{restMarks:this.restMarks,nightResting:g.stop?.kind==='night',playerDef:this.geometry.playerDef(root),rotRate:groupProvisionClimateRate(w,g),availablePileSlots:Number.MAX_SAFE_INTEGER-w.nextId,random,integer:(min,max)=>min+Math.floor(random()*(max-min)),notice:(_p,message)=>groupLog(w,message)});});
   },afterAnimalTween:(id,deltaCore)=>{const row=root.worldGroups!.groups.find(r=>r.state.id===id);if(!row||!('members'in row.state)||row.state.travel||!row.state.animalOwners?.interval)return;withWorldGroup(root,id,w=>{const g=w.group as AwayGroup,moving=g.phase==='travelling'&&!g.paused&&g.stop===null;advanceLegacyAnimalInterval256(w,g,coreTick,deltaCore,recalculateGroupCarried256(g,moving),this.restMarks);});}});
  }
  const live=new Set(this.owners(root).map(o=>o.id));for(const owner of owners)if(!live.has(owner.id)){this.motion.remove(owner.id);this.physical.remove(owner.id);}
 }
}
