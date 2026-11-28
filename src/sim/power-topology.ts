import { footprintCells } from './definitions.ts';
import { CONNECTION_RANGE,isPowerTrader } from './power-rules.ts';
import { allowsWireConnection, isPowerConnector,isPowerTransmitter, transmitsPowerNow } from './power-grid.ts';
import type { Cell, Structure, World } from './types.ts';
import { filteredStructures,structureMembershipToken } from './structure-navigation.ts';
import {structureFamily379} from './structure-family-379.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import {wallLampWallCell363} from './furniture-c-363.ts';

interface PowerFootprint { readonly minX:number;readonly maxX:number;readonly minZ:number;readonly maxZ:number }

export interface PowerTopology {
  readonly cells:ReadonlyMap<number,number>;
  readonly sources:ReadonlyMap<number,Readonly<Cell>>;
  readonly footprints:ReadonlyMap<number,PowerFootprint>;
  readonly wireParents:ReadonlySet<number>;
  readonly groups:readonly (readonly number[])[];
  readonly netOf:ReadonlyMap<number,number>;
  readonly width:number;
  readonly height:number;
}
/** Transmitting buildings form cardinal components over their actual footprint.
 * No DOM, navigation or room dependency; a wall does not interrupt a wire. */
const isPowerSwitch=(s:Structure):boolean=>s.kind==='power-switch';
export class PowerTopologyCache {
  private key='';
  private topology?:PowerTopology;
  /* Exact fast path. The key lists id/kind/x/z/orientation/footprint of the
   * transmitters; those fields are immutable and an unchanged membership token
   * means the same structures in the same order. The only live input is each
   * switch's switchOn, so the same token, size and switch states imply the
   * same key, and therefore the same cached topology. */
  private fast?:{token:object;width:number;height:number;switches:readonly Structure[];on:boolean[];owner?:object;transmitters?:readonly Structure[]};
  rebuilds=0;
  read(world:World):PowerTopology {
    const token=structureMembershipToken(world),switches=filteredStructures(world,'power-switches',isPowerSwitch),fast=this.fast;
    const owner=terrainJournalReadOwner(),family=owner?structureFamily379(world,'nominal-power-transmitters',isPowerTransmitter):undefined;
    const transmitters=family===world.structures?undefined:family;
    // Passive construction cannot change the electrical topology. The resident
    // nominal transmitter family keeps the exact original member/order proof
    // even across unrelated structure appends; the live switches remain read.
    if(this.topology&&fast&&(fast.token===token||owner!==undefined&&transmitters!==undefined&&fast.owner===owner&&fast.transmitters===transmitters)&&fast.width===world.width&&fast.height===world.height&&fast.switches===switches&&switches.every((s,i)=>(s.power?.switchOn!==false)===fast.on[i])){
      if(fast.token!==token&&verifyTerrainWriteCaches){const retained=this.topology;if(this.readKeyed(world)!==retained)throw Error('Passive append changed a retained electrical topology');}
      fast.token=token;fast.owner=owner;fast.transmitters=transmitters;return this.topology;
    }
    const topology=this.readKeyed(world,transmitters);
    this.fast={token,width:world.width,height:world.height,switches,on:switches.map(s=>s.power?.switchOn!==false),owner,transmitters};
    return topology;
  }
  private readKeyed(world:World,nominal?:readonly Structure[]):PowerTopology {
    const transmitters=(nominal??world.structures).filter(transmitsPowerNow);
    const key=`${world.width}:${world.height}|`+transmitters.map(s=>`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${s.footprint}`).join('|');
    if(this.topology&&key===this.key)return this.topology;
    const cells=new Map<number,number>(),sources=new Map<number,Cell>(),adjacent=new Map<number,Set<number>>();
    const footprints=new Map<number,PowerFootprint>(),wireParents=new Set<number>();
    for(const s of transmitters) {
      sources.set(s.id,{x:s.x,z:s.z});adjacent.set(s.id,new Set());
      if(allowsWireConnection(s.kind))wireParents.add(s.id);
      const footprint=footprintCells(s);
      footprints.set(s.id,{minX:Math.min(...footprint.map(c=>c.x)),maxX:Math.max(...footprint.map(c=>c.x)),minZ:Math.min(...footprint.map(c=>c.z)),maxZ:Math.max(...footprint.map(c=>c.z))});
      for(const c of footprint)cells.set(c.z*world.width+c.x,s.id);
    }
    for(const [i,id] of cells)for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const x=i%world.width+dx!,z=Math.floor(i/world.width)+dz!;
      if(x<0||z<0||x>=world.width||z>=world.height)continue;
      const other=cells.get(z*world.width+x);if(other!==undefined&&other!==id)adjacent.get(id)!.add(other);
    }
    const seen=new Set<number>(),groups:number[][]=[],netOf=new Map<number,number>();
    for(const id of [...sources.keys()].sort((a,b)=>a-b)) {
      if(seen.has(id))continue;
      const group=[id];seen.add(id);
      for(let i=0;i<group.length;i++)for(const next of adjacent.get(group[i]!)!)if(!seen.has(next)){seen.add(next);group.push(next);}
      group.sort((a,b)=>a-b);for(const member of group)netOf.set(member,id);groups.push(group);
    }
    this.key=key;this.rebuilds++;return this.topology={width:world.width,height:world.height,cells,sources,footprints,wireParents,groups,netOf};
  }
}
type ConnectorCell=Cell&{kind?:unknown;orientation?:number};
/** Core PowerConnectionMaker.BestTransmitterForConnector starts from the
 * actual wall for an attachment, including the natural wall case. */
export function connectorCell382(lamp:ConnectorCell,version:number):Cell {
  return lamp.kind==='wall-lamp'&&version>=382?wallLampWallCell363(lamp):lamp;
}
export function validPowerParent(topology:Pick<PowerTopology,'footprints'|'wireParents'>,lamp:ConnectorCell,id:number,version=381):boolean {
  const bounds=topology.footprints.get(id);if(!bounds||!topology.wireParents.has(id))return false;
  // This guard runs for every already connected consumer. Only attachments
  // need the shifted origin; compute it as scalars, without allocating a
  // support-cell object on every tick.
  let x=lamp.x,z=lamp.z;
  if(lamp.kind==='wall-lamp'&&version>=382){const facing=(((lamp.orientation??0)%4)+4)%4;if(facing===0)z++;else if(facing===1)x++;else if(facing===2)z--;else x--;}
  // The search window intersects any occupied source cell; ranking uses its anchor.
  return bounds.minX<=x+CONNECTION_RANGE&&bounds.maxX>=x-CONNECTION_RANGE
    &&bounds.minZ<=z+CONNECTION_RANGE&&bounds.maxZ>=z-CONNECTION_RANGE;
}
export function bestPowerParent(topology:PowerTopology,lamp:ConnectorCell,disallowedNets?:ReadonlySet<number>,version=381):number|null {
  lamp=connectorCell382(lamp,version);
  let best:number|null=null,distance=Infinity;
  for(let z=Math.max(0,lamp.z-CONNECTION_RANGE);z<=Math.min(topology.height-1,lamp.z+CONNECTION_RANGE);z++)
    for(let x=Math.max(0,lamp.x-CONNECTION_RANGE);x<=Math.min(topology.width-1,lamp.x+CONNECTION_RANGE);x++) {
      const id=topology.cells.get(z*topology.width+x);if(id===undefined||!topology.wireParents.has(id)||disallowedNets?.has(topology.netOf.get(id)!))continue;
      const source=topology.sources.get(id)!,d=(source.x-lamp.x)**2+(source.z-lamp.z)**2;
      if(d<distance){distance=d;best=id;}
    }
  return best;
}
/* The id map and the connector list depend only on membership (ids and kinds
 * are immutable), so they are shared per membership token; the same Map as
 * `new Map(structures.map(s=>[s.id,s]))`, the same connectors in array order. */
const idMaps=new WeakMap<object,ReadonlyMap<number,Structure>>();
const isConnectorKind=(s:Structure):boolean=>isPowerConnector(s.kind);
/* The structures of each topology group, per (topology, membership token):
 * a topology's groups never change once built and the id map is that of the
 * token, so `ids.map(id=>byId.get(id))` gives the same lists; each call copies them. */
const groupMembers=new WeakMap<PowerTopology,{token:object;members:readonly Structure[][]}>();
export function connectedPowerGroups(world:World,topology:PowerTopology):Structure[][] {
  const token=structureMembershipToken(world);let byId=idMaps.get(token);
  if(!byId){byId=new Map(world.structures.map(s=>[s.id,s]));idMaps.set(token,byId);}
  let cached=groupMembers.get(topology);
  if(!cached||cached.token!==token){cached={token,members:topology.groups.map(ids=>ids.map(id=>byId.get(id)!))};groupMembers.set(topology,cached);}
  const members=cached.members;
  const groups=new Map(topology.groups.map((ids,k)=>[ids[0]!,members[k]!.slice()]));
  for(const s of filteredStructures(world,'power-connectors',isConnectorKind))if(s.power?.parentId!=null) {
    const net=topology.netOf.get(s.power.parentId);if(net!==undefined)groups.get(net)!.push(s);
  }
  return [...groups.values()];
}

/** Private dispatch projection. The immutable grid still contains every
 * transmitter, including the thousands of conduits, switches and ship parts
 * that carry the actual connectivity. The ten Core dispatch substeps never
 * change those passive owners: no watts, startup, storage or EMP component.
 * Their absence cannot change the group selection, sums, RNG order or the
 * order of either startup/shedding or battery transfers. Those nominal
 * component contracts are enforced by save admission and the real producers.
 *
 * The base transmitters were sorted by id in topology.groups, while connected
 * consumers were appended in original structure order. Preserve both orders
 * without copying or traversing the passive wire members at every local tick.
 * Public readers and their malformed fixtures retain the full group path.
 */
export const isPowerDispatchKind=(kind:Structure['kind']):boolean=>kind==='battery'||isPowerTrader(kind);
interface DispatchMembership {
  readonly source:readonly Structure[];readonly base:readonly Structure[][];readonly consumers:readonly Structure[];readonly slots:ReadonlyMap<number,number>;
}
const dispatchMemberships=new WeakMap<PowerTopology,DispatchMembership>();
export function connectedPowerDispatchGroups(world:World,topology:PowerTopology):Structure[][] {
  if(!terrainJournalReadOwner())return connectedPowerGroups(world,topology);
  const source=structureFamily379(world,'power-dispatch-owners',isPowerDispatchKind);
  let membership=source===world.structures?undefined:dispatchMemberships.get(topology);
  if(!membership||membership.source!==source){
    const slots=new Map(topology.groups.map((ids,k)=>[ids[0]!,k]));
    const base:Structure[][]=topology.groups.map(()=>[]),consumers:Structure[]=[];
    for(const s of source){
      // A projected/unknown family may return the original collection. Keep
      // the nominal predicate live just as the ordinary filters do.
      if(!isPowerDispatchKind(s.kind))continue;
      if(isPowerTransmitter(s.kind)){
        const slot=slots.get(topology.netOf.get(s.id)!);
        if(slot!==undefined)base[slot]!.push(s);
      }else if(isPowerConnector(s.kind))consumers.push(s);
    }
    for(const parts of base)parts.sort((a,b)=>a.id-b.id);
    membership={source,base,consumers,slots};
    if(source!==world.structures)dispatchMemberships.set(topology,membership);
  }
  const result=membership.base.map(parts=>parts.slice());
  // Parent connectivity is live: reparenting and flicks are not immutable
  // membership. Only the passive transmitter projection/base order is held.
  for(const s of membership.consumers)if(s.power?.parentId!=null){
    const slot=membership.slots.get(topology.netOf.get(s.power.parentId)!);
    if(slot!==undefined)result[slot]!.push(s);
  }
  if(verifyTerrainWriteCaches){
    const exhaustive=connectedPowerGroups(world,topology);
    for(let i=0;i<exhaustive.length;i++){
      const parts=exhaustive[i]!,actual=result[i]!;
      if(parts.some(s=>!isPowerDispatchKind(s.kind)&&(s.battery!==undefined||s.emp!==undefined||s.power?.on)))throw Error('Passive power owner escaped its nominal component contract');
      const expected=parts.filter(s=>isPowerDispatchKind(s.kind));
      if(expected.length!==actual.length||expected.some((s,j)=>s!==actual[j]))throw Error('Resident power dispatch groups differ from the exhaustive grid');
    }
  }
  return result;
}
