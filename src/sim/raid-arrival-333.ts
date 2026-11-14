import {isColonist,distanceSquared} from './affiliation.ts';
import {footprintCells} from './definitions.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {captureStandability} from './furniture-travel.ts';
import {blockedCells} from './pathfinding.ts';
import {raidColonyReach,raidEdgeCandidates} from './raid-space.ts';
import {raidRandom} from './raid-state.ts';
import {roofKindAt} from './roof-rules.ts';
import {RoomTopologyCache} from './room-topology.ts';
import {isWetTerrain} from './shallow-water.ts';
import type {RaidFamily331} from './raid-factions-331.ts';
import type {Cell,World} from './types.ts';

/* Schema 333: Core raid arrival modes for Cassandra's home raids. Facts read
 * from Core 1.6 PawnsArrivalModes.xml, RaidStrategies_Basic.xml,
 * Ethereal_Skyfallers.xml and the decompiled PawnsArrivalModeWorker_*,
 * PawnsArrivalModeWorkerUtility, IncidentWorker_Raid, DropCellFinder,
 * DropPodUtility, Skyfaller and ActiveTransporter (facts only, no code). */
export type RaidArrivalMode333='edge-walk-in'|'edge-walk-in-groups'|'edge-drop'|'edge-drop-groups'|'center-drop'|'random-drop';
/** One drop pod, one raider. The raider is born when the pod opens: until
 * then only its reserved ID exists, listed in the raid's members. */
export interface RaidPod333 {pawnId:number;cell:Cell;landAtCore:number;openAtCore:number;roofHit:boolean;openedAtCore?:number}
export interface RaidArrival333 {
  mode:RaidArrivalMode333;
  /** Core tick of the arrival (the launch of the pods). */
  atCore:number;
  /** Entry or drop point of each group; none for a random drop. */
  centers:Cell[];
  /** Group of each member, in member order (group modes only). */
  memberGroups?:number[];
  /** Drop modes: one pod per member, in member order. */
  pods?:RaidPod333[];
  /** Drop modes on a world with factions: the raiders' world faction. */
  factionId?:number;
  /** Core CenterDrop with no close drop spot falls back to EdgeDrop, keeping
   * the 520-tick opening delay it had already set. */
  fallbackFrom?:'center-drop';
}
type Curve=readonly (readonly [number,number])[];
interface ModeDefinition333 {weight:Curve;industrial:boolean;stage:boolean;drop:boolean;groups:boolean;factor?:Curve}
/** Core arriveModes order of ImmediateAttack; StageThenAttack keeps the four
 * edge modes in the same order. */
export const RAID_ARRIVAL_MODES_333:readonly RaidArrivalMode333[]=Object.freeze(['edge-drop','edge-walk-in','center-drop','random-drop','edge-drop-groups','edge-walk-in-groups']);
export const RAID_ARRIVAL_333:Readonly<Record<RaidArrivalMode333,ModeDefinition333>>=Object.freeze({
  'edge-walk-in':{weight:[[300,1],[700,.4]],industrial:false,stage:true,drop:false,groups:false},
  'edge-drop':{weight:[[300,0],[700,.3]],industrial:true,stage:true,drop:true,groups:false},
  'center-drop':{weight:[[300,0],[1000,3.5]],industrial:true,stage:false,drop:true,groups:false,factor:[[0,.5],[5000,.3]]},
  'random-drop':{weight:[[300,0],[1000,1.9]],industrial:true,stage:false,drop:true,groups:false,factor:[[0,.7],[5000,.45]]},
  'edge-drop-groups':{weight:[[100,0],[300,.2],[700,.5]],industrial:true,stage:true,drop:true,groups:true,factor:[[0,.9]]},
  'edge-walk-in-groups':{weight:[[100,0],[300,.3],[700,.5]],industrial:false,stage:true,drop:false,groups:true,factor:[[0,.9]]},
});
export const isRaidArrivalMode333=(v:unknown):v is RaidArrivalMode333=>typeof v==='string'&&Object.hasOwn(RAID_ARRIVAL_333,v);
/** Core DropPodIncoming falls 120 to 200 ticks (SkyfallerProperties default
 * ticksToImpactRange) and hits the roof 15 ticks before impact. */
export const RAID_POD_FALL_CORE_333=[120,200] as const,RAID_POD_ROOF_CORE_333=15;
/** Core IncidentParms.podOpenDelay 140; CenterDrop and RandomDrop set 520.
 * The pod opens once its age exceeds the delay. */
export const raidPodOpenDelay333=(a:Pick<RaidArrival333,'mode'|'fallbackFrom'>):number=>a.mode==='center-drop'||a.mode==='random-drop'||a.fallbackFrom==='center-drop'?520:140;

/** SimpleCurve.Evaluate: linear between points, flat beyond the ends. */
function evaluate(curve:Curve,x:number):number {
  if(x<=curve[0]![0])return curve[0]![1];
  for(let i=1;i<curve.length;i++){const [bx,by]=curve[i]!;if(x<=bx){const [ax,ay]=curve[i-1]!;return ay+(by-ay)*(x-ax)/(bx-ax);}}
  return curve.at(-1)![1];
}
/** CanUseWith: the strategy's arrive modes and the faction's tech level
 * (EdgeDrop, CenterDrop, RandomDrop and EdgeDropGroups need Industrial:
 * pirates and outlanders, never tribes). */
export function raidArrivalAllowed333(mode:RaidArrivalMode333,family:RaidFamily331,staged:boolean):boolean {
  const def=RAID_ARRIVAL_333[mode];return (!staged||def.stage)&&(!def.industrial||family!=='tribe');
}
export function raidArrivalWeights333(points:number,family:RaidFamily331,staged:boolean):{mode:RaidArrivalMode333;weight:number}[] {
  return RAID_ARRIVAL_MODES_333.filter(m=>raidArrivalAllowed333(m,family,staged)).map(mode=>({mode,weight:evaluate(RAID_ARRIVAL_333[mode].weight,points)}));
}
/** TryRandomElementByWeight over the allowed modes, one draw. */
export function drawRaidArrivalMode333(points:number,family:RaidFamily331,staged:boolean,draw:()=>number):RaidArrivalMode333 {
  const weights=raidArrivalWeights333(points,family,staged),total=weights.reduce((sum,w)=>sum+w.weight,0);
  let pick=draw()*total;
  for(const w of weights){if(w.weight<=0)continue;pick-=w.weight;if(pick<0)return w.mode;}
  return weights.filter(w=>w.weight>0).at(-1)?.mode??'edge-walk-in';
}
/** The arrival mode's pointsFactorCurve (AdjustedRaidPoints); 1 without one. */
export const raidArrivalPointsFactor333=(mode:RaidArrivalMode333,points:number):number=>{const f=RAID_ARRIVAL_333[mode].factor;return f?evaluate(f,points):1;};
/** Core GetMaxGroupsCount. */
export const raidMaxGroups333=(count:number):number=>count<=1?1:Math.max(2,Math.min(3,Math.floor(count/2)));

/** Read-only map facts shared by one raid's arrival planning. Discarded
 * after the decision; never a maintained index. */
export class RaidArrivalSpace333 {
  readonly w:World;
  private reach?:Uint8Array|null;
  private blocked?:Uint8Array;
  private stand?:(c:Cell)=>boolean;
  private built?:Set<number>;
  private busy?:Set<number>;
  private rooms?:ReturnType<RoomTopologyCache['read']>;
  private doors?:Set<number>;
  constructor(w:World){this.w=w;}
  /** A closed door blocks a walk that does not pass closed doors. */
  closedDoor(i:number):boolean {
    if(!this.doors){this.doors=new Set();for(const s of this.w.structures)if(s.door&&!s.door.open)for(const c of footprintCells(s))this.doors.add(c.z*this.w.width+c.x);}
    return this.doors.has(i);
  }
  colonyReach():Uint8Array|null {return this.reach===undefined?this.reach=raidColonyReach(this.w):this.reach;}
  passable(i:number):boolean {return !(this.blocked??=blockedCells(this.w))[i];}
  standable(c:Cell):boolean {return (this.stand??=captureStandability(this.w))(c);}
  /** Any structure footprint: Core edifices refuse a pod. */
  built_(i:number):boolean {
    if(!this.built){this.built=new Set();for(const s of this.w.structures)for(const c of footprintCells(s))this.built.add(c.z*this.w.width+c.x);}
    return this.built.has(i);
  }
  /** A standing actor or a ground stack: Elsewhere keeps one occupant a cell. */
  occupied(i:number):boolean {
    if(!this.busy){const w=this.w,busy=this.busy=new Set<number>();
      for(const p of w.pawns){busy.add(p.z*w.width+p.x);if(p.motion&&p.motion.end>w.tick)busy.add(p.motion.from.z*w.width+p.motion.from.x);}
      for(const a of [...w.wildlife?.animals??[],...w.mechanoids??[]]){busy.add(a.z*w.width+a.x);if(a.motion&&a.motion.end>w.tick)busy.add(a.motion.from.z*w.width+a.motion.from.x);}
      for(const p of w.piles)if(p.owner.type==='ground')busy.add(p.owner.z*w.width+p.owner.x);
    }
    return this.busy.has(i);
  }
  fogged(i:number):boolean {return foggedCell256(this.w,i);}
  /** Room not psychologically outdoors, read as a roofed enclosure that does
   * not touch the map edge. */
  indoorRoom(i:number):number|undefined {
    if(!roofKindAt(this.w,i))return undefined;
    const space=(this.rooms??=new RoomTopologyCache().read(this.w)).at(i%this.w.width,Math.floor(i/this.w.width));
    return space?.kind==='space'&&!space.touchesMapEdge?space.id:undefined;
  }
  /** DropCellFinder.CanPhysicallyDropInto: walkable ground, no water, no
   * thick roof, a thin roof only when the pod may punch it. */
  canDrop(i:number,roofPunch:boolean,indoors:boolean):boolean {
    const w=this.w,terrain=w.tiles[i]!.terrain;if(terrain==='rock'||terrain==='water'||isWetTerrain(terrain)||!this.passable(i))return false;
    const roof=roofKindAt(w,i);if(roof&&(!roofPunch||roof==='natural-thick'))return false;
    return indoors||this.indoorRoom(i)===undefined;
  }
  /** IsGoodDropSpot with fog allowed: standable, droppable, no edifice. */
  goodDropSpot(i:number,roofPunch:boolean):boolean {
    const w=this.w;return this.standable({x:i%w.width,z:Math.floor(i/w.width)})&&this.canDrop(i,roofPunch,true)&&!this.built_(i)&&!this.occupied(i);
  }
  private points?:Cell[];
  /** FreeHumanlikesSpawnedOfFaction(player) and the colony's buildings. */
  colonyPoints():Cell[] {
    const w=this.w,player=w.worldFactions?.playerFactionId;
    return this.points??=[...w.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&!p.prisoner),...w.structures.filter(s=>!Object.hasOwn(s,'factionId')||s.factionId===player&&player!==undefined)];
  }
  private distant?:number[];
  /** Static part of FindRaidDropCenterDistant: unroofed, unfogged, outdoors
   * cells five cells from the edge where a pod may drop, in map order. */
  distantCandidates():readonly number[] {
    if(!this.distant){const w=this.w,cells=this.distant=[] as number[];
      for(let z=5;z<w.height-5;z++)for(let x=5;x<w.width-5;x++){const i=z*w.width+x;if(!roofKindAt(w,i)&&!this.fogged(i)&&this.canDrop(i,true,false))cells.push(i);}}
    return this.distant;
  }
  private scattered?:{open:number[];roofed:number[]};
  /** Static part of RandomDropSpot: standable, dry, unfogged cells, unroofed
   * first, in map order. */
  scatterCandidates():{open:number[];roofed:number[]} {
    if(!this.scattered){const w=this.w,open:number[]=[],roofed:number[]=[];
      for(let i=0;i<w.width*w.height;i++){if(isWetTerrain(w.tiles[i]!.terrain)||this.fogged(i)||!this.standable(at(w,i)))continue;(roofKindAt(w,i)?roofed:open).push(i);}
      this.scattered={open,roofed};}
    return this.scattered;
  }
}
const at=(w:World,i:number):Cell=>({x:i%w.width,z:Math.floor(i/w.width)});

/** DropCellFinder.FindRaidDropCenterDistant: cells in random order, unfogged,
 * unroofed, outdoors and five cells from the edge; the first one beyond a
 * radius from every colonist and colony building (65, minus 0.2 a tried
 * cell) and connected to the colony; the 301st tried cell otherwise. */
export function raidDropCenterDistant333(space:RaidArrivalSpace333,random:{rng:number}):Cell {
  const w=space.w,reach=space.colonyReach(),points=space.colonyPoints(),cells=space.distantCandidates().slice();
  let radius=65;
  for(let k=0;k<cells.length;k++){
    const j=k+Math.floor(raidRandom(random)*(cells.length-k)),i=cells[j]!;cells[j]=cells[k]!;cells[k]=i;
    const c=at(w,i);if(k+1>300)return c;
    radius-=.2;
    if(!points.some(p=>distanceSquared(c,p)<radius*radius)&&!!reach?.[i])return c;
  }
  return at(w,Math.floor(raidRandom(random)*w.width*w.height));
}
/** Cells reachable on foot within a radius, closed doors not crossed
 * (CellFinder.RandomClosewalkCellNear). */
function closewalk(space:RaidArrivalSpace333,root:Cell,radius:number):number[] {
  const w=space.w,start=root.z*w.width+root.x,seen=new Set<number>([start]),queue=[start];
  for(let head=0;head<queue.length;head++){const i=queue[head]!,x=i%w.width,z=Math.floor(i/w.width);
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]] as const){const nx=x+dx,nz=z+dz,n=nz*w.width+nx;
      if(nx<0||nz<0||nx>=w.width||nz>=w.height||seen.has(n)||(nx-root.x)**2+(nz-root.z)**2>radius*radius||!space.passable(n)||space.closedDoor(n))continue;
      seen.add(n);queue.push(n);}
  }
  return queue;
}
/** DropCellFinder.TryFindRaidDropCenterClose for a hostile, non-mechanical
 * raid: a random free colonist, then a random cell within a 10-cell walk of
 * them where a pod may drop (roof punched, indoors allowed), unfogged; 301
 * tries at most. */
export function raidDropCenterClose333(space:RaidArrivalSpace333,random:{rng:number}):Cell|null {
  const w=space.w,colonists=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&!p.prisoner),near=new Map<number,number[]>();
  if(!colonists.length)return null;
  for(let attempt=0;attempt<=300;attempt++){
    const c=colonists[Math.floor(raidRandom(random)*colonists.length)]!;
    let cells=near.get(c.id);if(!cells){cells=closewalk(space,c,10);near.set(c.id,cells);}
    const i=cells[Math.floor(raidRandom(random)*cells.length)]!;
    if(space.canDrop(i,true,true)&&!space.fogged(i))return at(w,i);
  }
  return null;
}
/** CenterDrop's 40 % branch to DropCellFinder.TradeDropSpot, when the colony
 * has a powered orbital trade beacon: near the first unroofed beacon, a good
 * unroofed, unfogged drop spot. (Core's further search around powered
 * beacons and comms consoles is not taken: the close search follows.) */
function tradeDropSpot333(space:RaidArrivalSpace333,random:{rng:number}):Cell|null {
  const w=space.w;
  for(const b of w.structures){if(b.kind!=='orbital-beacon'||roofKindAt(w,b.z*w.width+b.x))continue;
    const spot=dropSpotNear333(space,b,random,new Set(),false,false);if(spot)return spot;}
  return null;
}
/** Resolve the drop center of EdgeDrop and CenterDrop (TryResolveRaidSpawnCenter);
 * a CenterDrop without a close spot becomes an EdgeDrop. */
export function resolveRaidArrivalCenter333(space:RaidArrivalSpace333,mode:RaidArrivalMode333,random:{rng:number}):{mode:RaidArrivalMode333;center?:Cell;fallbackFrom?:'center-drop'} {
  if(mode==='edge-drop')return {mode,center:raidDropCenterDistant333(space,random)};
  if(mode!=='center-drop')return {mode};
  const beacon=raidRandom(random)<.4;
  const traded=beacon&&space.w.structures.some(s=>s.kind==='orbital-beacon'&&s.power?.on)?tradeDropSpot333(space,random):null;
  if(traded)return {mode,center:traded};
  const close=raidDropCenterClose333(space,random);
  return close?{mode,center:close}:{mode:'edge-drop',center:raidDropCenterDistant333(space,random),fallbackFrom:'center-drop'};
}

/** DropCellFinder.TryFindDropSpotNear (radius 5 growing to 16): a random good
 * drop spot reachable from the center, in the center's room first, then in
 * any room, then anywhere, when the center is indoors. Cells another pod of
 * this raid uses are refused (IsGoodDropSpot refuses a pod on the cell). */
export function dropSpotNear333(space:RaidArrivalSpace333,center:Cell,random:{rng:number},used:ReadonlySet<number>,roofPunch=true,fog=true):Cell|null {
  const w=space.w;if(center.x<0||center.z<0||center.x>=w.width||center.z>=w.height)return null;
  const start=center.z*w.width+center.x,seen=new Set<number>([start]),queue=[start];
  for(let head=0;head<queue.length;head++){const i=queue[head]!,x=i%w.width,z=Math.floor(i/w.width);
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]] as const){const nx=x+dx,nz=z+dz,n=nz*w.width+nx;
      if(nx<0||nz<0||nx>=w.width||nz>=w.height||Math.abs(nx-center.x)>16||Math.abs(nz-center.z)>16||seen.has(n)||!space.passable(n))continue;
      seen.add(n);queue.push(n);}
  }
  const valid=queue.filter(i=>!used.has(i)&&space.goodDropSpot(i,roofPunch)&&(fog||!space.fogged(i)));
  const room=roofPunch?space.indoorRoom(start):undefined,tiers=room===undefined?[valid]:[valid.filter(i=>space.indoorRoom(i)===room),valid.filter(i=>space.indoorRoom(i)!==undefined),valid];
  for(const tier of tiers){
    if(!tier.length)continue;
    const dist=(i:number)=>Math.max(Math.abs(i%w.width-center.x),Math.abs(Math.floor(i/w.width)-center.z));
    const radius=Math.max(5,Math.min(...tier.map(dist))),pool=tier.filter(i=>dist(i)<=radius).sort((a,b)=>a-b);
    return at(w,pool[Math.floor(raidRandom(random)*pool.length)]!);
  }
  return null;
}
/** DropThingGroupsNear's last resort: a random walkable cell without a thick
 * roof (here also standable, free and not used by another pod). */
function anyDropCell(space:RaidArrivalSpace333,random:{rng:number},used:ReadonlySet<number>):Cell|null {
  const w=space.w,cells:number[]=[];
  for(let i=0;i<w.width*w.height;i++)if(!used.has(i)&&space.goodDropSpot(i,true))cells.push(i);
  return cells.length?at(w,cells[Math.floor(raidRandom(random)*cells.length)]!):null;
}
/** DropCellFinder.RandomDropSpot: standable, dry, unroofed, unfogged; a roof
 * is allowed when no such cell exists. */
function randomDropSpot(space:RaidArrivalSpace333,random:{rng:number}):Cell|null {
  const w=space.w,{open,roofed}=space.scatterCandidates(),cells=open.length?open:roofed;
  return cells.length?at(w,cells[Math.floor(raidRandom(random)*cells.length)]!):null;
}

export interface RaidArrivalLayout333 {centers:Cell[];memberGroups?:number[];sites?:Cell[];pods?:Omit<RaidPod333,'pawnId'>[]}
/** Core SplitIntoRandomGroupsNearMapEdge: 2 to GetMaxGroupsCount groups, the
 * first pawns found one each, the others join a random group. Each new
 * center is the farthest of four tries from the earlier ones. */
function splitGroups(count:number,random:{rng:number},findCenter:()=>Cell|null):{centers:Cell[];memberGroups:number[]}|null {
  const max=raidMaxGroups333(count),groups=max===1?1:2+Math.floor(raidRandom(random)*(max-1)),centers:Cell[]=[],memberGroups:number[]=[];
  for(let g=0;g<groups;g++){
    let best:Cell|null=null,bestDistance=0;
    for(let t=0;t<4;t++){
      const c=findCenter();if(!c)return null;
      if(!centers.length){best=c;break;}
      const d=Math.min(...centers.map(o=>distanceSquared(c,o)));
      if(!best||d>bestDistance){best=c;bestDistance=d;}
    }
    centers.push(best!);memberGroups.push(g);
  }
  for(let i=groups;i<count;i++)memberGroups.push(Math.floor(raidRandom(random)*groups));
  return {centers,memberGroups};
}
/** Lay the raiders out for the resolved mode: walk-in groups at edge cells,
 * one pod a raider for drops. Pods fall 120-200 Core ticks, then open after
 * the mode's delay. Null when the map has no room for them. */
export function layoutRaidArrival333(space:RaidArrivalSpace333,resolved:{mode:RaidArrivalMode333;center?:Cell;fallbackFrom?:'center-drop'},count:number,atCore:number,random:{rng:number},walkSites:readonly Cell[]):RaidArrivalLayout333|null {
  const w=space.w,mode=resolved.mode,delay=raidPodOpenDelay333(resolved);
  if(mode==='edge-walk-in')return walkSites.length===count?{centers:[{...walkSites[0]!}],sites:walkSites.map(c=>({...c}))}:null;
  if(mode==='edge-walk-in-groups'){
    const edges=raidEdgeCandidates(w);if(!edges||edges.length<count)return null;
    const split=splitGroups(count,random,()=>edges.length?{...edges[Math.floor(raidRandom(random)*edges.length)]!}:null);if(!split)return null;
    // Each raider at the nearest free edge cell to its group's entry point
    // (Core spawns within 8 cells of it; Elsewhere raiders enter at the edge).
    const used=new Set<number>(),sites:Cell[]=new Array(count);
    for(let g=0;g<split.centers.length;g++){const center=split.centers[g]!;
      const order=edges.filter(c=>!used.has(c.z*w.width+c.x)).sort((a,b)=>distanceSquared(a,center)-distanceSquared(b,center)||a.z-b.z||a.x-b.x);let k=0;
      for(let i=0;i<count;i++)if(split.memberGroups[i]===g){const c=order[k++];if(!c)return null;used.add(c.z*w.width+c.x);sites[i]={...c};}
    }
    return {centers:split.centers,memberGroups:split.memberGroups,sites};
  }
  const used=new Set<number>(),pods:Omit<RaidPod333,'pawnId'>[]=[];
  const pod=(near:Cell|null):boolean=>{
    const cell=(near?dropSpotNear333(space,near,random,used):null)??anyDropCell(space,random,used);if(!cell)return false;
    used.add(cell.z*w.width+cell.x);
    const landAtCore=atCore+RAID_POD_FALL_CORE_333[0]+Math.floor(raidRandom(random)*(RAID_POD_FALL_CORE_333[1]-RAID_POD_FALL_CORE_333[0]+1));
    pods.push({cell,landAtCore,openAtCore:landAtCore+delay+1,roofHit:false});return true;
  };
  if(mode==='edge-drop'||mode==='center-drop'){
    for(let i=0;i<count;i++)if(!pod(resolved.center!))return null;
    return {centers:[{...resolved.center!}],pods};
  }
  if(mode==='random-drop'){
    for(let i=0;i<count;i++)if(!pod(randomDropSpot(space,random)))return null;
    return {centers:[],pods};
  }
  const split=splitGroups(count,random,()=>raidDropCenterDistant333(space,random));if(!split)return null;
  // DropThingsNear per group, in group order; pods keep the member order.
  const byMember:(Omit<RaidPod333,'pawnId'>|undefined)[]=new Array(count);
  for(let g=0;g<split.centers.length;g++)for(let i=0;i<count;i++)if(split.memberGroups[i]===g){if(!pod(split.centers[g]!))return null;byMember[i]=pods.at(-1);}
  return {centers:split.centers,memberGroups:split.memberGroups,pods:byMember as Omit<RaidPod333,'pawnId'>[]};
}
/** The point a staging raider defends: its own group's arrival point. */
export function raidStagePoint333(arrival:RaidArrival333|undefined,members:readonly number[],pawnId:number):Cell|undefined {
  if(!arrival?.memberGroups)return undefined;const i=members.indexOf(pawnId);
  return i<0?undefined:arrival.centers[arrival.memberGroups[i]!];
}
/** Pods not opened yet. */
export const raidPodsPending333=(arrival:RaidArrival333|undefined):number=>arrival?.pods?arrival.pods.reduce((n,p)=>n+(p.openedAtCore===undefined?1:0),0):0;
const LABELS:Readonly<Record<RaidArrivalMode333,string>>=Object.freeze({
  'edge-walk-in':'à pied','edge-walk-in-groups':'à pied, en plusieurs groupes','edge-drop':'en capsules, à l’écart',
  'edge-drop-groups':'en capsules, en plusieurs groupes','center-drop':'en capsules, au cœur de la colonie','random-drop':'en capsules dispersées',
});
export const raidArrivalLabel333=(arrival:Pick<RaidArrival333,'mode'>):string=>LABELS[arrival.mode];
/** The French arrival sentence of the raid event. */
export function raidArrivalMessage333(arrival:RaidArrival333,label:string,count:number,staged:boolean):string {
  const groups=arrival.centers.length,then=staged?'se regroupe(nt) avant d’attaquer. Préparez la défense.':'attaque(nt) immédiatement. Mobilisez la défense.';
  const thenPods=staged?'Ils se regrouperont à leur point de chute avant d’attaquer. Préparez la défense.':'Ils attaqueront dès l’ouverture des capsules. Mobilisez la défense.';
  switch(arrival.mode){
    case 'edge-walk-in':return `Raid${label} : ${count} assaillant(s) arrive(nt) au bord de la carte et ${then}`;
    case 'edge-walk-in-groups':return `Raid${label} : ${count} assaillant(s) arrive(nt) au bord de la carte en ${groups} groupes, de plusieurs côtés à la fois, et ${then}`;
    case 'edge-drop':return `Raid${label} : ${count} assaillant(s) tombe(nt) du ciel en capsules, à l’écart de la colonie. ${thenPods}`;
    case 'edge-drop-groups':return `Raid${label} : ${count} assaillant(s) tombe(nt) du ciel en capsules, en ${groups} groupes séparés. ${thenPods}`;
    case 'center-drop':return `Raid${label} : ${count} assaillant(s) tombe(nt) du ciel en capsules près de la colonie, en plein cœur de vos positions ! ${thenPods}`;
    case 'random-drop':return `Raid${label} : ${count} assaillant(s) arrive(nt) en capsules déréglées qui s’écrasent dispersées dans toute la zone ! ${thenPods}`;
  }
}
