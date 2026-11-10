import {captureActorBeds256,forgetLocalActorBed256,forgetLocalBedOwners256} from './actor-bed-local-256.ts';
import {registeredCampaign} from './world-map-context.ts';
import { isBedKind } from './bed-kinds.ts';
import { filteredStructures } from './structure-navigation.ts';
import { isColonist } from './affiliation.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { canStandAt } from './furniture-travel.ts';
import { medicalRestNeeded,treatmentTarget } from './care-rules.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { processNeeds,type NeedContext } from './needs.ts';
import { captiveSurgeryRest280,patientProposal,startPatientRest } from './patient-rest.ts';
import { hasReachableCell,routeToCell } from './pathfinding.ts';
import { capturePrisonTopology,prisonBedValid,prisonerAllowedCell,prisonerEscapeRoute } from './prison-space.ts';
import { prisonDay,type PrisonerMode } from './prisoner-state.ts';
import { RoomTopologyCache,type RoomTopology } from './room-topology.ts';
import { socialRandom } from './social-state.ts';
import { planCommandDrops,releaseWork,type DropPlan } from './work-release.ts';
import type { Cell,CommandResult,Pawn,Structure,World } from './types.ts';

const rooms=new WeakMap<World,RoomTopologyCache>();
function topology(world:World){let cache=rooms.get(world);if(!cache){cache=new RoomTopologyCache();rooms.set(world,cache);}return cache.read(world);}
const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
function affectedByBeds(world:World,beds:readonly Structure[]):Pawn[] {
  const ids=new Set(beds.map(b=>b.id));
  return world.pawns.filter(p=>ids.has(p.bedId??-1)||p.need?.kind==='sleep'&&ids.has(p.need.bedId??-1)||p.rescue&&ids.has(p.rescue.bedId)||p.ward&&world.pawns.some(q=>q.id===p.ward!.patientId&&(ids.has(q.bedId??-1)||q.need?.kind==='sleep'&&ids.has(q.need.bedId??-1))));
}
/** Several interrupted actors share one prospective floor, not independent
 * greedy drop plans that might select the same empty destination. */
function planBedInterruptions(world:World,actors:readonly Pawn[]):DropPlan|null {
  const shadow={...world,piles:world.piles.map(p=>({...p,owner:{...p.owner}})),packed:world.packed.map(p=>({...p,owner:{...p.owner}}))},result:DropPlan=new Map();
  for(const actor of actors){
    const plan=planCommandDrops(shadow,{type:'clear-orders',pawnId:actor.id});if(!plan)return null;
    for(const [id,cell] of plan){result.set(id,cell);const pile=shadow.piles.find(p=>p.id===id);if(pile)pile.owner={type:'ground',...cell};const pack=shadow.packed.find(p=>p.building.id===id);if(pack)pack.owner={type:'ground',...cell};}
  }
  return result;
}
export function applyPrisonBed(world:World,command:{bedId:number;enabled:boolean}):CommandResult {
  const bed=world.structures.find(s=>isBedKind(s.kind)&&s.id===command.bedId);
  if(!bed||typeof command.enabled!=='boolean')return fail('Lit ou rôle de prison invalide.');
  if(bed.kind==='double-bed')return fail('Le lit double est réservé au couchage civil.');
  const map=topology(world),room=map.at(bed.x,bed.z);
  if(command.enabled&&(room?.kind!=='space'||room.touchesMapEdge))return fail('Un lit de prison exige une pièce fermée ne touchant pas le bord de carte.');
  const beds=room?.kind==='space'&&!room.touchesMapEdge?world.structures.filter(s=>isBedKind(s.kind)&&map.at(s.x,s.z)===room):[bed];
  if(command.enabled&&beds.some(b=>b.kind==='double-bed'))return fail('Cette pièce contient un lit double civil : retirez-le avant de la convertir en prison.');
  const changed=beds.filter(b=>!!b.prisoner!==command.enabled);if(!changed.length)return {ok:true};
  const actors=affectedByBeds(world,changed),drops=planBedInterruptions(world,actors);if(!drops)return fail('Pas de place pour conserver les cargaisons interrompues par le changement de prison.');
  const bedOwners=world.schemaVersion>=256?captureActorBeds256(registeredCampaign(world)):undefined;
  for(const b of changed){if(command.enabled)b.prisoner=true;else delete b.prisoner;if(bedOwners)forgetLocalBedOwners256(world,b.id,bedOwners);}
  for(const p of actors){p.bedId=null;delete p.bedSlot;releaseWork(world,p,drops);p.needCooldown=0;p.planCooldown=0;}
  for(const p of world.pawns)p.planCooldown=0;
  return {ok:true};
}
export function applyPrisonerMode(world:World,command:{patientId:number;mode:PrisonerMode}):CommandResult {
  const p=world.pawns.find(p=>p.id===command.patientId);
  if(!p?.prisoner||p.state==='dead'||!['maintain','reduce','recruit',...world.schemaVersion>=202?['release']:[]].includes(command.mode))return fail('Prisonnier ou mode de conversation invalide.');
  if(world.schemaVersion>=213&&isColonist(p)&&command.mode!=='maintain'&&command.mode!=='release')return fail('Ce colon appartient déjà à la colonie : maintien ou libération uniquement.');
  if(p.prisoner.mode===command.mode)return {ok:true};
  if(prisonBreakActive(p))return fail('Il faut réprimer la révolte avant de changer cette consigne.');
  if(p.prisoner.releasedAt!==undefined)return fail('Cette personne a déjà été libérée et quitte la carte.');
  p.prisoner.mode=command.mode;
  // Already completed interaction effects/closing time are kept; no rollback.
  for(const actor of world.pawns){
    if(actor.ward?.patientId===p.id&&(command.mode==='release'||actor.ward.kind==='chat'&&actor.ward.phase!=='closing')
      ||actor.rescue?.release&&actor.rescue.patientId===p.id)interruptWork(world,actor);
    actor.planCooldown=0;
  }
  return {ok:true};
}
/** Joining air spaces propagates the role to supported prison beds. Civil
 * doubles keep their role and owners when a wall merges two existing rooms.
 * No new role is introduced when no prisoner bed exists. */
export function reconcilePrisoners(world:World):void {
  const marked=filteredStructures(world,'bed-kinds',s=>isBedKind(s.kind)).filter(s=>s.prisoner);
  let captured:RoomTopology|undefined;
  if(marked.length){const map=topology(world);captured=map;const prisons=new Set<number>();
    for(const bed of marked){const room=map.at(bed.x,bed.z);if(room?.kind==='space'&&!room.touchesMapEdge)prisons.add(room.id);}
    const added=world.structures.filter(s=>{const room=map.at(s.x,s.z);return isBedKind(s.kind)&&s.kind!=='double-bed'&&!s.prisoner&&room?.kind==='space'&&prisons.has(room.id);});
    const bedOwners=added.length&&world.schemaVersion>=256?captureActorBeds256(registeredCampaign(world)):undefined;
    for(const b of added){b.prisoner=true;if(bedOwners)forgetLocalBedOwners256(world,b.id,bedOwners);}
    for(const p of affectedByBeds(world,added)){p.bedId=null;delete p.bedSlot;interruptWork(world,p);p.needCooldown=0;}
  }
  for(const p of world.pawns)if(p.prisoner){
    const day=prisonDay(world);if(p.prisoner.chatDay!==day){p.prisoner.chatDay=day;p.prisoner.chatCount=0;}
    if(p.bedId!==null&&!world.structures.some(b=>b.id===p.bedId&&b.kind!=='double-bed'&&prisonBedValid(world,b,captured??=capturePrisonTopology(world))))forgetLocalActorBed256(world,p);
    if(p.state==='dead')delete p.prisoner.escape;
  }
}
function chooseWander(world:World,p:Pawn,context:NeedContext,map:RoomTopology):void {
  const state=p.prisoner!;const candidates:Cell[]=[],seen=new Set<number>();
  for(let i=0;i<20;i++){
    const cell={x:p.x+Math.floor(socialRandom(state)*15)-7,z:p.z+Math.floor(socialRandom(state)*15)-7},id=cell.z*world.width+cell.x;
    if(!seen.has(id)&&Math.hypot(cell.x-p.x,cell.z-p.z)<=7&&prisonerAllowedCell(world,p,cell,map)&&canStandAt(world,cell)){seen.add(id);candidates.push(cell);}
  }
  if(!candidates.length){p.planCooldown=13+Math.floor(socialRandom(state)*8);return;}
  const reach=context.search(new Set(candidates.map(c=>c.z*world.width+c.x)));if(!reach)return;
  const cell=candidates.find(c=>hasReachableCell(reach,c.z*world.width+c.x));
  if(cell){const path=routeToCell(world,cell,reach);if(path?.length){p.path=path;p.state='moving';context.move(cell,true);return;}}
  p.planCooldown=13+Math.floor(socialRandom(state)*8);
}
/** Needs remain real; a guard conversation may hold an otherwise idle captive
 * nearby, while neither food nor sleep is granted by that waiting state. */
export function processPrisoner(world:World,p:Pawn,context:NeedContext):boolean {
  if(!p.prisoner)return false;
  if(p.state==='dead'||p.state==='downed')return true;
  if(p.prisoner.releasedAt!==undefined){
    // A later incapacity may need care. After recovery, the same released
    // person resumes the departure instead of becoming detained again.
    if(p.need&&!context.release()){
      processNeeds(world,p,context);
      return true;
    }
    if(!p.path.length||p.planCooldown===0){
      const route=prisonerEscapeRoute(world,p,goals=>context.search(goals));
      if(route===null)return true;
      if(route!==undefined){const goal=route.at(-1)??p;p.prisoner.escape={x:goal.x,z:goal.z};p.path=route;}
      else {p.path=[];p.planCooldown=20;}
    }
    const target=p.path.at(-1);
    if(target){p.state='moving';context.move(target,true);}else p.state='idle';
    return true;
  }
  if(p.prisoner.escape&&p.path.length){p.state='moving';context.move(p.prisoner.escape,true);return true;}
  if(p.prisoner.escape&&p.x===p.prisoner.escape.x&&p.z===p.prisoner.escape.z){p.state='idle';return true;}
  let map:RoomTopology|undefined;const enclosure=()=>map??=capturePrisonTopology(world);
  if(p.planCooldown===0&&!(world.schemaVersion>=213&&isColonist(p))){
    const route=prisonerEscapeRoute(world,p,goals=>context.search(goals),enclosure());
    if(route===null)return true;
    if(route!==undefined){
      if(!p.prisoner.escape){
        if(!context.release()){
          // A full floor must not freeze an already-carried meal forever.
          // Complete the engaged need physically, then retry the escape; no
          // escape state, food gain or drop is invented by the failed release.
          if(p.need)processNeeds(world,p,context);
          return true;
        }
        context.event(`${p.name} s’échappe par une ouverture de la prison.`);
      }
      const target=route.at(-1)??{x:p.x,z:p.z};p.prisoner.escape={...target};p.path=route;
      if(route.length){p.state='moving';context.move(target,true);}else{p.path=[];p.state='idle';}
      return true;
    }
    if(p.prisoner.escape){delete p.prisoner.escape;p.path=[];p.planCooldown=0;p.needCooldown=0;}
  }
  if(p.prisoner.escape){p.state='idle';return true;}
  if(p.planCooldown===0&&!p.need&&(medicalRestNeeded(p)||treatmentTarget(p)||captiveSurgeryRest280(p,world.schemaVersion))){
    const goals=new Set(world.structures.filter(b=>isBedKind(b.kind)&&b.prisoner&&prisonerAllowedCell(world,p,b,enclosure())).map(b=>b.z*world.width+b.x));
    if(goals.size){const reach=context.search(goals);if(!reach)return true;const proposal=patientProposal(world,p,reach);if(proposal)startPatientRest(world,p,proposal);}
  }
  if(processNeeds(world,p,context))return true;
  // The opaque needs phase may release an engagement. Capture anew for the
  // following pure destination decision instead of retaining its old context.
  map=undefined;
  if(world.pawns.some(a=>a.ward?.kind==='chat'&&a.ward.patientId===p.id&&a.ward.phase!=='approach')){p.path=[];p.state='idle';return true;}
  const target=p.path.at(-1);
  if(target&&prisonerAllowedCell(world,p,target,enclosure())){p.state='moving';context.move(target,true);return true;}
  p.path=[];p.state='idle';if(p.planCooldown===0)chooseWander(world,p,context,enclosure());
  return true;
}
