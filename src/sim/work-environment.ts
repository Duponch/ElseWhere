import { isBedKind } from './bed-kinds.ts';
import { isStove } from './food-workstations.ts';
import { footprintCells } from './definitions.ts';
import { cookingSpot } from './cooking-bills.ts';
import { LightEnvironment, LightEnvironmentCache, lightSpeedFactor } from './light-environment.ts';
import { type RoomSpace } from './room-topology.ts';
import { schemaAtLeast } from './schema-range.ts';
import type { Cell, Structure, World } from './types.ts';

/* RimWorld 1.6.4871 (schema 301 family): the electric crematorium derives from
 * BuildingBase, without workTableRoomRole, so it neither suffers the 0.8
 * not-in-room factor nor counts toward a workshop; RoomRoleWorker_Laboratory
 * scores 60 per research bench or drug lab (workTableRoomRole Laboratory),
 * and the multi-analyzer, a facility without that role, does not count. */
const roomRules301=schemaAtLeast(301);

export type WorkRoomRole='laboratory'|'none'|'bedroom'|'barracks'|'workshop'|'kitchen'|'dining'|'recreation';
export const ROOM_ROLE_LABEL:Record<WorkRoomRole,string>={laboratory:'Laboratoire',none:'Sans spécialisation',bedroom:'Chambre',barracks:'Dortoir',workshop:'Atelier',kitchen:'Cuisine',dining:'Salle à manger',recreation:'Salle de loisirs'};
export interface WorkRoom {
  readonly space:RoomSpace;readonly covered:number;readonly psychologicallyOutdoors:boolean;readonly role:WorkRoomRole;
}
export const lightWorkFactor=lightSpeedFactor;
export interface ProductionFactors {light:number;lighting:number;outdoors:number;roomRole:number;station:number;total:number}

/** Read-only decision snapshot. No temperature, beauty, comfort or mood implied. */
export class WorkEnvironment extends LightEnvironment {
  private rooms:ReadonlyMap<number,WorkRoom>;
  private readonly rules301:boolean;
  constructor(light:LightEnvironment,rooms:ReadonlyMap<number,WorkRoom>,rules301=false){
    super(light.topology,light.roofs,light.artificial,light.sky);this.rooms=rooms;this.rules301=rules301;
  }
  room(cell:Cell):WorkRoom|undefined {
    const space=this.topology.at(cell.x,cell.z);return space?.kind==='space'?this.rooms.get(space.id):undefined;
  }
  /** `glowIgnored`: the worker is blind, its work speed ignores darkness (schema 301). */
  production(station:Structure,worker:Cell,glowIgnored=false):ProductionFactors {
    const room=this.room(station.kind==='electric-crematorium'?cookingSpot(station):station),light=this.lightAt(worker),lighting=glowIgnored?1:lightWorkFactor(light);
    const outdoors=room?.psychologicallyOutdoors ? .8 : 1;
    const requiredRole=station.kind==='drug-lab'?'laboratory':isStove(station.kind)?'kitchen':station.kind==='fueled-smithy'||station.kind==='electric-smithy'||station.kind==='brewery'||station.kind==='electric-crematorium'||station.kind==='electric-smelter'||station.kind==='biofuel-refinery'||station.kind==='machining-table'||station.kind==='fabrication-bench'||station.kind==='art-bench'||station.kind==='stonecutter'||station.kind==='tailor-bench'||station.kind==='electric-tailor-bench'?'workshop':undefined;
    const roomRole=requiredRole&&!(this.rules301&&station.kind==='electric-crematorium')&&room&&!room.psychologicallyOutdoors&&room.role!==requiredRole ? .8 : 1;
    const base=station.kind==='campfire'||station.kind==='crafting-spot'||station.kind==='tailor-bench'||station.kind==='electric-tailor-bench'&&!station.power?.on ? .5 : 1;
    return {light,lighting,outdoors,roomRole,station:base,total:lighting*outdoors*roomRole*base};
  }
}

/** Caller owned: validates barriers on each useful read, not per pawn/frame.
 * Local glow is rebuilt only on barrier or lit-source changes. Tick and roof
 * coverage affect sky sampling without rerunning the flood. */
export class WorkEnvironmentCache {
  private readonly light=new LightEnvironmentCache();
  readonly localLight=this.light.localLight;
  readLight(world:World):LightEnvironment {return this.light.read(world);}
  read(world:World,light=this.readLight(world)):WorkEnvironment {
    const {topology,roofs}=light,rules301=roomRules301(Number(world.schemaVersion));
    const covered=new Map<number,number>(),scores=new Map<number,{beds:number;laboratory:number;workshop:number;kitchen:number;dining:number;recreation:number}>();
    for(const index of roofs){const room=topology.at(index%world.width,Math.floor(index/world.width));if(room?.kind==='space')covered.set(room.id,(covered.get(room.id)??0)+1);}
    for(const s of world.structures) {
      if(!['fueled-smithy','electric-smithy','brewery','electric-crematorium','electric-smelter','biofuel-refinery','drug-lab','machining-table','fabrication-bench','art-bench','research-bench','hi-tech-research-bench','multi-analyzer','tailor-bench','electric-tailor-bench','bed','double-bed','hospital-bed','stonecutter','table','table-square','table-long','horseshoes','chess-table','tube-television','fueled-stove','electric-stove'].includes(s.kind))continue;
      if(rules301&&(s.kind==='electric-crematorium'||s.kind==='multi-analyzer'))continue;
      const ids=new Set<number>();for(const cell of s.kind==='electric-crematorium'?[cookingSpot(s)]:footprintCells(s)){const r=topology.at(cell.x,cell.z);if(r?.kind==='space')ids.add(r.id);}
      for(const id of ids){let v=scores.get(id);if(!v){v={beds:0,laboratory:0,workshop:0,kitchen:0,dining:0,recreation:0};scores.set(id,v);}
        if(isBedKind(s.kind))v.beds++;else if(s.kind==='drug-lab'||s.kind==='research-bench'||s.kind==='hi-tech-research-bench'||s.kind==='multi-analyzer')v.laboratory+=rules301?60:54;else if(s.kind==='fueled-smithy'||s.kind==='electric-smithy'||s.kind==='brewery'||s.kind==='electric-crematorium'||s.kind==='electric-smelter'||s.kind==='biofuel-refinery'||s.kind==='machining-table'||s.kind==='fabrication-bench'||s.kind==='art-bench'||s.kind==='stonecutter'||s.kind==='tailor-bench'||s.kind==='electric-tailor-bench')v.workshop+=27;else if(isStove(s.kind))v.kitchen+=28;else if(s.kind==='table'||s.kind==='table-square'||s.kind==='table-long')v.dining+=12;else v.recreation+=7;}
    }
    const rooms=new Map<number,WorkRoom>();
    for(const space of topology.allSpaces()) {
      const count=covered.get(space.id)??0,unroofed=space.cellCount-count;
      const psychologicallyOutdoors=unroofed>=300||space.touchesMapEdge&&unroofed>=space.cellCount*.5;
      const score=scores.get(space.id);let role:WorkRoomRole='none';
      if(!space.touchesMapEdge&&score) {
        // Count physical furniture, including one double, rather than its slots.
        const values={laboratory:score.laboratory,bedroom:score.beds===1?100000:0,dining:score.dining,recreation:score.recreation,workshop:score.workshop,kitchen:score.kitchen,barracks:score.beds>1?score.beds*100100:0};
        let best=0;for(const candidate of ['laboratory','bedroom','dining','recreation','workshop','barracks','kitchen'] as const)if(values[candidate]>best){best=values[candidate];role=candidate;}
      }
      rooms.set(space.id,{space,covered:count,psychologicallyOutdoors,role});
    }
    return new WorkEnvironment(light,rooms,rules301);
  }
}
