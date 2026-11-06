import {isShipPartKind276} from './ship-part-content-276.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {roofCells,roofIdentity,sameRoofIdentity,type RoofIdentity} from './roof-rules.ts';
import {structureMembershipToken} from './structure-navigation.ts';
import {START_STRUCTURE_PHYSICS_256} from './player-start-physics-256.ts';
import { isRoomDoor } from './door-rules.ts';
import { ventFaces } from './vent.ts';
import { footprintCells,STRUCTURE_DEFINITIONS } from './definitions.ts';
import type { World } from './types.ts';

export interface ThermalRoom {cells:number[];unroofed:number;equalize:number[];door?:boolean;isolatedDoor?:boolean}
export interface ThermalDoor {id:number;cell:number;neighbors:number[]}
export interface ThermalVent {id:number;structureIndex:number;sides:readonly [number,number]}
export interface ThermalLayout {rooms:ThermalRoom[];doors:ThermalDoor[];indices:Int32Array;vents?:ThermalVent[]}
const directions=[[1,0],[-1,0],[0,1],[0,-1]] as const;

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
  private fast?:{token:object;roofs:RoofIdentity;width:number;height:number;geographic:boolean;cells:Int32Array;tiles:World['tiles'][number][]};
  read(world:World):ThermalLayout {
    const geographic=isSchema256Or257(world.schemaVersion)&&world.site?.revision===3;
    const token=structureMembershipToken(world),roofIds=roofIdentity(world),fast=this.fast;
    if(this.layout&&fast&&fast.token===token&&fast.width===world.width&&fast.height===world.height&&fast.geographic===geographic&&sameRoofIdentity(fast.roofs,roofIds)){
      let same=true;const tiles=world.tiles;
      for(let k=0;k<fast.cells.length;k++)if(tiles[fast.cells[k]!]!==fast.tiles[k]){same=false;break;}
      if(same)return this.layout;
    }
    const layout=this.readFull(world,geographic);
    // Remember every tile the full read depended on: checked kinds and vent faces.
    const cells=new Set<number>(this.checks.keys());
    for(const s of world.structures)if(s.kind==='vent')for(const c of ventFaces(s))if(c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height)cells.add(c.z*world.width+c.x);
    const list=Int32Array.from(cells);
    this.fast={token,roofs:roofIds,width:world.width,height:world.height,geographic,cells:list,tiles:Array.from(list,i=>world.tiles[i]!)};
    return layout;
  }
  private readFull(world:World,geographic:boolean):ThermalLayout {
    const roofs=roofCells(world),doors:World['structures']=[],vents:{s:World['structures'][number];i:number}[]=[];
    const hasVents=world.structures.some(s=>s.kind==='vent'),faceSolids=new Set<number>(),buildings=new Map<number,number>();
    // Capture both room barriers and vent-face barriers in source order. The
    // final overlapping structure still wins for room topology, while every
    // blocking footprint contributes to the vent-face union. No input survives
    // this public read; in-place edits are observed by the next call.
    for(let i=0;i<world.structures.length;i++){
      const s=world.structures[i]!,door=isRoomDoor(s.kind);
      if(door)doors.push(s);if(s.kind==='vent')vents.push({s,i});
      const fact=geographic?START_STRUCTURE_PHYSICS_256[s.kind]:undefined;
      if(geographic&&!fact)throw Error('Unresolved actual thermal structure');
      const room=geographic?fact!.door||fact!.fullFill:s.kind==='vent'||s.kind==='wall'||s.kind==='cooler'||s.kind==='electric-crematorium'||isShipPartKind276(s.kind)||s.kind==='geothermal-generator'||door;
      const face=hasVents&&STRUCTURE_DEFINITIONS[s.kind].blocksMovement;
      let cells:ReturnType<typeof footprintCells>|undefined;
      if(face||room&&(geographic||s.kind==='electric-crematorium'||isShipPartKind276(s.kind)||s.kind==='geothermal-generator'))cells=footprintCells(s);
      if(room){
        const kind=(geographic?fact!.door:door)?2:1;
        if(geographic||s.kind==='electric-crematorium'||isShipPartKind276(s.kind)||s.kind==='geothermal-generator')for(const c of cells!)buildings.set(c.z*world.width+c.x,kind);
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
