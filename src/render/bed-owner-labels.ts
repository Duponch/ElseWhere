import {isBedKind,isDoubleBedKind,isGroundSleepingSpotKind,isBedrollKind} from '../sim/bed-kinds';
import {bedSlotBodyCenter,bedSlotsCount} from '../sim/bed-slots';
import {captureActorBeds256} from '../sim/actor-bed-local-256';
import {registeredCampaign,registeredMapId} from '../sim/world-map-context';
import {targetBuildingPlayerUse263} from '../sim/world-target-building-263';
import {knownBuilding256} from '../ui/exploration-readers-256';
import type {BedSlot,Pawn,Structure,World} from '../sim/types';
import type {MapLabelEntry} from './MapLabelBatch';
import {WORLD_SCALE} from '../world/scale';

export interface BedOwnerPresentation {readonly pawn:Pawn;readonly slot:BedSlot}
/** One capture for all physical beds, including owners currently away from
 * this map. Historical local aliases and explicit map/slot claims follow the
 * same ownership reader as the simulation, with no per-bed campaign capture. */
export function captureBedOwners(world:World):ReadonlyMap<number,readonly BedOwnerPresentation[]> {
  const beds=new Map(world.structures.filter(b=>isBedKind(b.kind)).map(b=>[b.id,b])),result=new Map<number,BedOwnerPresentation[]>();
  if(!beds.size)return result;
  const capture=world.schemaVersion>=256?captureActorBeds256(registeredCampaign(world)):undefined,mapId=registeredMapId(world);
  // Joined MAIN publishes travelling full originals in its actual group
  // summaries, rather than in RAW worldGroups. Knowledge-only people never
  // become owners: these are the same validated Pawn records and map claims.
  const actors=[...(capture?.actors??world.pawns)],seen=new Set(actors.map(actor=>actor.id));
  const groups=world.campaignMap?.revision===2?world.campaignMap.groups:[];
  for(const group of groups)if('members'in group.state)for(const pawn of group.state.members)if(!seen.has(pawn.id)){actors.push(pawn);seen.add(pawn.id);}
  for(const actor of actors){
    if('species'in actor||actor.state==='dead'||actor.health?.death)continue;
    const claim=actor.mapBed,id=claim?.bedId??actor.bedId,bed=id===null?undefined:beds.get(id);if(!bed)continue;
    if(capture&&(claim?claim.mapId!==mapId:capture.localMapFor(actor)!==mapId))continue;
    const slot=isDoubleBedKind(bed.kind)?claim?.slot??actor.bedSlot:0;
    if(slot!==0&&slot!==1)continue;
    let owners=result.get(bed.id);if(!owners){owners=[];result.set(bed.id,owners);}owners.push({pawn:actor,slot});
  }
  return result;
}

function inOwnBed(pawn:Pawn,bed:Structure):boolean {
  return (pawn.state==='sleeping'||pawn.state==='resting'||pawn.state==='downed')&&pawn.need?.kind==='sleep'&&pawn.need.phase==='sleep'&&pawn.need.bedId===bed.id;
}
/** Core hides medical-bed owners and names whose owner is already lying in
 * that bed. 3D adaptation: anchor above each durable slot, stagger the two
 * labels vertically instead of measuring/projecting every name per frame. */
export function bedOwnerLabelEntries(world:World):MapLabelEntry[] {
  const owners=captureBedOwners(world),entries:MapLabelEntry[]=[];
  for(const bed of world.structures){
    if(!isBedKind(bed.kind)||bed.medical||!targetBuildingPlayerUse263(world,bed)||!knownBuilding256(world,bed))continue;
    const assigned=owners.get(bed.id)??[],height=isGroundSleepingSpotKind(bed.kind)?.12:isBedrollKind(bed.kind)?.28:WORLD_SCALE.bedSurfaceHeight+.24;
    if(!assigned.length){
      const a=bedSlotBodyCenter(bed,0)!,b=bedSlotBodyCenter(bed,(bedSlotsCount(bed)-1)as BedSlot)!;
      entries.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,y:height,label:'Non attribué'});continue;
    }
    for(const owner of assigned){
      if(inOwnBed(owner.pawn,bed))continue;
      const center=bedSlotBodyCenter(bed,owner.slot);if(!center)continue;
      entries.push({x:center.x,y:height,z:center.z,label:owner.pawn.name,offsetY:isDoubleBedKind(bed.kind)?owner.slot*14:0});
    }
  }
  return entries;
}
