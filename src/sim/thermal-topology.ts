import {isShipPartKind276} from './ship-part-content-276.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {roofCells,roofIdentity,sameRoofIdentity,type RoofIdentity} from './roof-rules.ts';
import {captureStructureNavigation,structureMembershipToken,structuresOfKind,type StructureNavigationGeometry} from './structure-navigation.ts';
import {START_STRUCTURE_PHYSICS_256} from './player-start-physics-256.ts';
import { isRoomDoor } from './door-rules.ts';
import { ventFaces } from './vent.ts';
import { footprintCells,STRUCTURE_DEFINITIONS } from './definitions.ts';
import type { Structure,World } from './types.ts';
import {terrainReadScope,terrainJournalReadOwner} from './terrain-read-scope.ts';
import {terrainWriteCount,verifyTerrainWriteCaches,captureTerrainReadCursor,readTerrainJournal,type TerrainJournalCursor} from './terrain-mutation-journal.ts';

export interface ThermalRoom {cells:number[];unroofed:number;equalize:number[];door?:boolean;isolatedDoor?:boolean}
export interface ThermalDoor {id:number;cell:number;neighbors:number[]}
export interface ThermalVent {id:number;structureIndex:number;sides:readonly [number,number]}
export interface ThermalLayout {rooms:ThermalRoom[];doors:ThermalDoor[];indices:Int32Array;vents?:ThermalVent[]}
const directions=[[1,0],[-1,0],[0,1],[0,-1]] as const;

const wideRoomBarrier=(s:Structure,geographic:boolean)=>geographic||s.kind==='electric-crematorium'||isShipPartKind276(s.kind)||s.kind==='geothermal-generator';
function roomBarrierKind(s:Structure,geographic:boolean):0|1|2 {
  if(geographic){
    const fact=START_STRUCTURE_PHYSICS_256[s.kind];
    if(!fact)throw Error('Unresolved actual thermal structure');
    return fact.door?2:fact.fullFill?1:0;
  }
  if(isRoomDoor(s.kind))return 2;
  return s.kind==='vent'||s.kind==='wall'||s.kind==='cooler'||s.kind==='electric-crematorium'||isShipPartKind276(s.kind)||s.kind==='geothermal-generator'?1:0;
}

/** The geometry append writer keeps immutable entries of the entire old
 * prefix; any unknown/replacement/removal rebuild makes new entries. A new
 * door/vent always changes the layout's portal lists. Other appends only
 * invalidate that proof when they write a room/vent barrier in a cell whose
 * value was actually consulted by the complete read. This includes the roof
 * roots, early outdoor witnesses, equalization barriers and ALL vent faces.
 * No unobserved cell was used to produce the retained layout. */
function preservesThermalAppend(world:World,previous:StructureNavigationGeometry,next:StructureNavigationGeometry,geographic:boolean,hasVents:boolean,slots:Int32Array):boolean {
  const old=previous.entries,entries=next.entries,n=old.length;
  if(entries.length<=n||n!==0&&(entries[0]!==old[0]||entries[n-1]!==old[n-1]))return false;
  const checked=(cell:number)=>(slots[cell]??-1)>=0;
  for(let i=n;i<entries.length;i++){
    const {structure:s,cells}=entries[i]!;
    if(isRoomDoor(s.kind)||s.kind==='vent')return false;
    const room=roomBarrierKind(s,geographic);
    if(room&&(wideRoomBarrier(s,geographic)?cells.some(checked):checked(s.z*world.width+s.x)))return false;
    if(hasVents&&STRUCTURE_DEFINITIONS[s.kind].blocksMovement&&cells.some(checked))return false;
  }
  return true;
}

/** Only covered components can retain air. A connected witness with 3*unroofed
 * >= ALL roof cells proves outdoor temperature without exploring the whole map.
 * Every cell used by that proof (including barriers) is rechecked on each read.
 * Unvisited mutations cannot invalidate it; no tick/array-identity shortcut. */
export class ThermalTopologyCache {
  private layout?:ThermalLayout;
  private key='';
  private checks=new Map<number,number>();
  /* Exact fast path. The layout is a function of the structures (membership,
   * order, kinds, positions, orientations: one shared membership token), the
   * roof arrays (identity), the map size and the tiles actually read (terrain
   * and collapsed rock never change in place: a terrain edit replaces the
   * Tile). When all of those are identical the full validation below would
   * rebuild the same key and find every check unchanged. */
  private fast?:{token:object;geometry?:StructureNavigationGeometry;hasVents:boolean;roofs:RoofIdentity;width:number;height:number;geographic:boolean;cells:Int32Array;slots:Int32Array;tiles:World['tiles'][number][];kinds:Uint8Array;source:World['tiles'];scope:number|undefined;owner?:object;cursor?:TerrainJournalCursor;writes:number};
  read(world:World):ThermalLayout {
    const geographic=isSchema256Or257(world.schemaVersion)&&world.site?.revision===3;
    const token=structureMembershipToken(world),roofIds=roofIdentity(world),fast=this.fast,scope=terrainReadScope(),owner=terrainJournalReadOwner(),writes=terrainWriteCount(world.tiles);
    const geometry=owner?captureStructureNavigation(world):undefined;
    const sameFrame=fast&&fast.width===world.width&&fast.height===world.height&&fast.geographic===geographic&&sameRoofIdentity(fast.roofs,roofIds);
    const append=!!(fast&&sameFrame&&fast.token!==token&&owner&&fast.owner===owner&&fast.geometry&&geometry&&preservesThermalAppend(world,fast.geometry,geometry,geographic,fast.hasVents,fast.slots));
    if(this.layout&&fast&&sameFrame&&(fast.token===token||append)){
      // Every new closed simulation call still checks all observed Tiles. Only
      // subsequent reads of that same call may use its marked-write contract;
      // public reads and the next call see unmarked direct replacements too.
      const sameObservation=scope!==undefined&&fast.source===world.tiles&&(fast.scope===scope||owner!==undefined&&fast.owner===owner);
      const checked=sameObservation&&fast.writes===writes;
      if(checked&&!verifyTerrainWriteCaches){fast.token=token;fast.geometry=geometry;return this.layout;}
      let same=true;const tiles=world.tiles;
      // The exact dependency set of the thermal proof is already captured.
      // On the exclusively owned map, a closed journal edge lets us test just
      // the changed dependency cells; missing/bulk history stays exhaustive.
      const delta=sameObservation&&fast.cursor?readTerrainJournal(tiles,fast.cursor):undefined;
      if(delta){
        for(const cell of delta.indices){const k=fast.slots[cell]??-1;if(k<0)continue;const t=tiles[cell]!;
          if(((t.terrain==='rock'?1:0)|(geographic&&t.collapsedRock?2:0))!==fast.kinds[k]){same=false;break;}
          fast.tiles[k]=t;
        }
        if(same&&verifyTerrainWriteCaches)for(let k=0;k<fast.cells.length;k++){const t=tiles[fast.cells[k]!]!;
          if(((t.terrain==='rock'?1:0)|(geographic&&t.collapsedRock?2:0))!==fast.kinds[k])throw Error('Unmarked thermal terrain edit inside a terrain read scope');
        }
      }else for(let k=0;k<fast.cells.length;k++){
        const tile=tiles[fast.cells[k]!]!;
        if(tile===fast.tiles[k])continue;
        // Mining damage, floors, snow and fog also replace Tiles. Only rock
        // and (for geographic maps) collapsed rock enter the full read below.
        // Recheck each replacement against captured values, never a mutation
        // counter or the possibly edited old Tile; keep observing every cell.
        const kind=(tile.terrain==='rock'?1:0)|(geographic&&tile.collapsedRock?2:0);
        if(kind!==fast.kinds[k]){same=false;break;}
        fast.tiles[k]=tile;
      }
      if(checked&&!same)throw Error('Unmarked thermal terrain edit inside a terrain read scope');
      if(same){
        if(append&&verifyTerrainWriteCaches){const retained=this.layout;if(this.readFull(world,geographic)!==retained)throw Error('Unobserved thermal append altered a retained dependency proof');}
        fast.token=token;fast.geometry=geometry;fast.source=tiles;fast.scope=scope;fast.owner=owner;fast.writes=writes;fast.cursor=scope===undefined?undefined:delta?.cursor??captureTerrainReadCursor(tiles);return this.layout;
      }
    }
    const previousLayout=this.layout,layout=this.readFull(world,geographic);
    if(fast&&layout===previousLayout&&fast.width===world.width&&fast.height===world.height&&fast.geographic===geographic){
      // The full read returned its old layout only after the exact roof/door/
      // vent key and every dependency kind matched. Its checks Map and vent
      // faces are consequently the same dependency set. Keep their resident
      // list/slot arrays: unrelated completed furniture must not allocate and
      // index most of the map again. Refresh literal tile primitives as well
      // as references (rock and collapsed rock may be thermally equivalent).
      for(let k=0;k<fast.cells.length;k++){
        const tile=world.tiles[fast.cells[k]!]!;fast.tiles[k]=tile;fast.kinds[k]=(tile.terrain==='rock'?1:0)|(geographic&&tile.collapsedRock?2:0);
      }
      fast.token=token;fast.geometry=geometry;fast.hasVents=structuresOfKind(world,'vent').length>0;fast.roofs=roofIds;fast.source=world.tiles;fast.scope=scope;fast.owner=owner;fast.writes=writes;
      fast.cursor=scope===undefined?undefined:captureTerrainReadCursor(world.tiles);return layout;
    }
    // Remember every tile the full read depended on: checked kinds and vent faces.
    const cells=new Set<number>(this.checks.keys());
    for(const s of structuresOfKind(world,'vent'))for(const c of ventFaces(s))if(c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height)cells.add(c.z*world.width+c.x);
    const list=Int32Array.from(cells),tiles=Array.from(list,i=>world.tiles[i]!),kinds=Uint8Array.from(tiles,t=>(t.terrain==='rock'?1:0)|(geographic&&t.collapsedRock?2:0));
    // A topology renewal can touch most of a large map. A single dense
    // lookup avoids one boxed pair and Map entry per checked cell in that
    // already expensive boundary tick (slots never escape this cache).
    const slots=new Int32Array(world.tiles.length).fill(-1);for(let k=0;k<list.length;k++)slots[list[k]!]=k;
    this.fast={token,geometry,hasVents:structuresOfKind(world,'vent').length>0,roofs:roofIds,width:world.width,height:world.height,geographic,cells:list,slots,tiles,kinds,source:world.tiles,scope,owner,cursor:scope===undefined?undefined:captureTerrainReadCursor(world.tiles),writes};
    return layout;
  }
  private readFull(world:World,geographic:boolean):ThermalLayout {
    const roofs=roofCells(world),doors:World['structures']=[],vents:{s:World['structures'][number];i:number}[]=[];
    const hasVents=(structuresOfKind(world,'vent').length>0),faceSolids=new Set<number>(),buildings=new Map<number,number>();
    // Capture both room barriers and vent-face barriers in source order. The
    // final overlapping structure still wins for room topology, while every
    // blocking footprint contributes to the vent-face union. No input survives
    // this public read; in-place edits are observed by the next call.
    for(let i=0;i<world.structures.length;i++){
      const s=world.structures[i]!,door=isRoomDoor(s.kind);
      if(door)doors.push(s);if(s.kind==='vent')vents.push({s,i});
      const kind=roomBarrierKind(s,geographic);
      const face=hasVents&&STRUCTURE_DEFINITIONS[s.kind].blocksMovement;
      let cells:ReturnType<typeof footprintCells>|undefined;
      // Keep this cold path independent of the cached append geometry. In
      // checking mode it is also the oracle for the newly retained proof.
      if(face||kind&&wideRoomBarrier(s,geographic))cells=footprintCells(s);
      if(kind){
        if(wideRoomBarrier(s,geographic))for(const c of cells!)buildings.set(c.z*world.width+c.x,kind);
        else buildings.set(s.z*world.width+s.x,kind);
      }
      if(face)for(const c of cells!)faceSolids.add(c.z*world.width+c.x);
    }
    const faceKey=vents.flatMap(({s})=>ventFaces(s).map(c=>{const i=c.z*world.width+c.x;return c.x<0||c.z<0||c.x>=world.width||c.z>=world.height?'out':i+':'+(faceSolids.has(i)||world.tiles[i]!.terrain==='rock');}));
    const key=[world.width,world.height,...roofs,'doors',...doors.map(s=>s.id+'@'+s.x+':'+s.z),'vents',...vents.map(({s,i})=>i+'@'+s.id+':'+s.x+':'+s.z+':'+s.orientation),...faceKey].join(',');

    const kind=(i:number)=>buildings.get(i)??(world.tiles[i]!.terrain==='rock'||geographic&&world.tiles[i]!.collapsedRock?1:0);
    if(this.layout&&key===this.key){
      let unchanged=true;for(const [i,k] of this.checks)if(kind(i)!==k){unchanged=false;break;}
      if(unchanged)return this.layout;
    }
    const checks=new Map<number,number>();
    const read=(i:number)=>{const k=kind(i);checks.set(i,k);return k;};
    const indexAt=(x:number,z:number)=>x<0||z<0||x>=world.width||z>=world.height?undefined:z*world.width+x;
    const neighbors=(i:number)=>directions.flatMap(([dx,dz])=>{const n=indexAt(i%world.width+dx,Math.floor(i/world.width)+dz);return n===undefined?[]:[n];});
    const visited=new Set<number>(),rooms:ThermalRoom[]=[];
    for(const root of roofs) {
      const rootKind=read(root);
      if(rootKind===2){rooms.push({cells:[root],unroofed:0,equalize:[],door:true,isolatedDoor:!neighbors(root).some(i=>read(i)===0)});continue;}
      if(rootKind||visited.has(root))continue;
      const cells:number[]=[],seen=new Set([root]),queue=[root];let unroofed=0,outdoor=false;
      for(let head=0;head<queue.length;head++) {
        const i=queue[head]!;cells.push(i);visited.add(i);if(!roofs.has(i))unroofed++;
        const x=i%world.width,z=Math.floor(i/world.width);
        if(!x||!z||x===world.width-1||z===world.height-1||unroofed*3>=roofs.size){outdoor=true;break;}
        for(const next of neighbors(i))if(read(next)===0&&!seen.has(next)){seen.add(next);queue.push(next);}
      }
      if(!outdoor&&unroofed*4<cells.length)rooms.push({cells:cells.sort((a,b)=>a-b),unroofed,equalize:[]});
    }
    rooms.sort((a,b)=>a.cells[0]!-b.cells[0]!);
    const indices=new Int32Array(world.width*world.height);indices.fill(-1);
    rooms.forEach((r,id)=>r.cells.forEach(i=>indices[i]=id));
    for(let id=0;id<rooms.length;id++)if(!rooms[id]!.door||rooms[id]!.isolatedDoor)for(const i of rooms[id]!.cells) {
      const x=i%world.width,z=Math.floor(i/world.width);
      for(const [dx,dz] of directions) {
        const near=indexAt(x+dx,z+dz),far=indexAt(x+2*dx,z+2*dz);
        if(near===undefined||far===undefined||indices[near]===id||indices[far]===id)continue;
        const nearKind=read(near);
        if(nearKind===0||nearKind===2&&neighbors(near).some(n=>read(n)===0&&indices[n]!==id))continue;
        if(neighbors(far).some(n=>indices[n]===id))continue;
        if(read(far)===1)indices[far]=-2;
        rooms[id]!.equalize.push(far);
      }
    }
    const portals=doors.map(s=>({id:s.id,cell:s.z*world.width+s.x,neighbors:[...new Set(neighbors(s.z*world.width+s.x).filter(i=>read(i)!==1).map(i=>indices[i]!))]}));
    const ventPorts:ThermalVent[]=[];
    for(const {s,i} of vents){
      const sides=ventFaces(s).map(c=>{const n=indexAt(c.x,c.z);return n===undefined||faceSolids.has(n)||read(n)===1?undefined:Math.max(-1,indices[n]!);});
      if(sides[0]!==undefined&&sides[1]!==undefined)ventPorts.push({id:s.id,structureIndex:i,sides:[sides[0],sides[1]]});
    }
    this.key=key;this.checks=checks;return this.layout={rooms,doors:portals,indices,vents:ventPorts};
  }
}
