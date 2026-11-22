import {isJoyTableKind354,JOY_TABLES_354} from './joy-tables-354.ts';import {STRAW_MATTING_365,BURNED_STRAW_MATTING_365} from './straw-couch-365.ts';import {CARPET_FLOORS_355,CARPET_FACTS_355,BURNED_CARPET_FACTS_355,type CarpetFloor355} from './carpet-355.ts';
import {isShipCasketKind277,SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {isIedTrapKind357,IED_COMMON_357} from './ied-traps-357.ts';
import {SCHEMA_VERSION} from './types.ts';
import {hasSmoothedStoneSubstrate281,SMOOTHED_STONE_FACTS_281} from './smooth-floor-terrain-281.ts';
import {naturalWallBeauty373,isRockBeautySchema373} from './rock-beauty-373.ts';
import {isShipPartKind276} from './ship-part-content-276.ts';
import {isAncientMonumentKind256,ANCIENT_MONUMENT_DEFS_256} from './ancient-monument-props-256.ts';
import { coreBeauty311,furnitureBeautyFactor311,QUALITY_BEAUTY,furnitureQuality} from './furniture-stats.ts';
import { furnitureBeauty,isFurnitureMaterial,isHabitatFurnitureKind,isSculptureKind,sculptureBeauty,FURNITURE_MATERIALS,type FurnitureLike } from './furniture-stats.ts';
import type { RoomSpace,RoomTopology } from './room-topology.ts';

export interface BeautyCell {x:number;z:number}
export interface BeautyTile {terrain:string;floor?:string;collapsedRock?:{terrain:string};stone?:string;ore?:string;smoothedWall367?:true}
export interface BeautyStructure extends BeautyCell,FurnitureLike {id?:number;baseBeauty?:number;beautyCell?:BeautyCell}
export interface BeautyFilth extends BeautyCell {kind:string}
/** One physical ground object/stack. Quantity never multiplies Beauty. */
export interface BeautyObject extends BeautyCell {id?:number;kind?:string;beauty?:number;visible?:boolean}
export interface BeautyInput {
  width:number;height:number;tiles:readonly BeautyTile[];
  structures:readonly BeautyStructure[];
  filth?:readonly BeautyFilth[];
  objects?:readonly BeautyObject[];
  /** Schema whose Beauty rules apply (current when absent). */
  version?:number;
}

export const FLOOR_BEAUTY=Object.freeze({
  'ancient-tile':0,'ancient-concrete':-1,
  'broken-asphalt':-1,'granite-flagstone':0,'limestone-flagstone':0,'marble-flagstone':0,'sandstone-flagstone':0,'slate-flagstone':0,
  'wood-planks':0,'granite-tile':1,'limestone-tile':1,'marble-tile':1,'sandstone-tile':1,'slate-tile':1,'steel-tile':0,'sterile-tile':-1,'burned-wood':-6,
  // Schema 355: every Core carpet colour Beauty 2, BurnedCarpet -6.
  ...Object.fromEntries(CARPET_FLOORS_355.map(id=>[id,CARPET_FACTS_355.beauty])) as Record<CarpetFloor355,2>,'burned-carpet':BURNED_CARPET_FACTS_355.beauty,
  // Schema 365: StrawMatting Beauty -1, BurnedStrawMatting -6.
  'straw-matting':STRAW_MATTING_365.beauty,'burned-straw-matting':BURNED_STRAW_MATTING_365.beauty,
} as const);
export const FILTH_BEAUTY=Object.freeze({firefoam:-25,slime:-25,dirt:-15,trash:-15,blood:-30,ash:-10,vomit:-40,'corpse-bile':-50,'rock-rubble':-15,'building-rubble':-15} as const);
export type BeautyBand='hideous'|'ugly'|'neutral'|'pretty'|'beautiful'|'very-beautiful'|'extremely-beautiful'|'unbelievably-beautiful';
export const BEAUTY_BAND_LABEL:Readonly<Record<BeautyBand,string>>=Object.freeze({
  hideous:'hideuse',ugly:'laide',neutral:'neutre',pretty:'jolie',beautiful:'belle',
  'very-beautiful':'très belle','extremely-beautiful':'extrêmement belle','unbelievably-beautiful':'incroyablement belle',
});

export function floorBeauty(tile:BeautyTile,outdoors=false):number {
  if(tile.terrain==='packed-dirt'&&!tile.floor)return -1;
  if(tile.floor&&Object.hasOwn(FLOOR_BEAUTY,tile.floor))return FLOOR_BEAUTY[tile.floor as keyof typeof FLOOR_BEAUTY];
  if(tile.floor)return 0;
  if(hasSmoothedStoneSubstrate281(tile))return SMOOTHED_STONE_FACTS_281.beauty;
  if(tile.terrain==='grass'||tile.terrain==='soil'||tile.terrain==='rich-soil'||tile.terrain==='gravel')return outdoors?0:-3;
  if(tile.terrain==='rough-stone')return -1;
  return 0;
}
export function filthBeauty(filth:Pick<BeautyFilth,'kind'>,outdoors=false):number {
  if(outdoors&&filth.kind==='rock-rubble')return -4;
  if(outdoors&&(filth.kind==='dirt'||filth.kind==='trash'))return -1;
  return Object.hasOwn(FILTH_BEAUTY,filth.kind)?FILTH_BEAUTY[filth.kind as keyof typeof FILTH_BEAUTY]:0;
}
export function groundObjectBeauty(object:BeautyObject):number {return object.visible===false?0:object.beauty??-4;}
/** Schema 311: Core Beauty of power buildings that had none here. */
const POWER_BEAUTY311:Readonly<Record<string,number>>=Object.freeze({'wind-turbine':-12,battery:-15,'wood-generator':-20,'power-conduit':-2,'power-switch':-2});
export function structureBeauty(structure:BeautyStructure,version:number=SCHEMA_VERSION):number {
  const v311=Number(version)>=311;
  if(v311&&Object.hasOwn(POWER_BEAUTY311,structure.kind))return POWER_BEAUTY311[structure.kind]!;
  if(structure.kind==='firefoam-popper')return -8;
  if(isAncientMonumentKind256(structure.kind)){const m=isFurnitureMaterial(structure.material)?FURNITURE_MATERIALS[structure.material]:undefined,d=ANCIENT_MONUMENT_DEFS_256[structure.kind];if(v311)return coreBeauty311(d.beauty,furnitureBeautyFactor311(structure.material,version),m?.beautyOffset??0,d.quality?QUALITY_BEAUTY[furnitureQuality(structure.quality)]:1);return d.beauty*(m?.beautyFactor??1)*(d.quality?QUALITY_BEAUTY[furnitureQuality(structure.quality)]:1)+(m?.beautyOffset??0);}
  if(isShipCasketKind277(structure.kind))return SHIP_CASKET_CONTENT_277.beauty;
  if(isShipPartKind276(structure.kind))return 0; // Fixed inputs, no Stuff or Beauty override.
  if(structure.kind==='ship-chunk')return -20;
  if(structure.kind==='brewery'||structure.kind==='fermenting-barrel')return 0;
  if(structure.kind==='geothermal-generator')return -30;
  if(structure.kind==='chemfuel-generator')return -20;
  if(structure.kind==='deep-drill')return -25;
  if(structure.kind==='ground-scanner')return -8;
  // Fixed electronics are not stuffed furniture; steel is ingredient provenance.
  if(structure.kind==='spike-trap')return -18;
  if(isIedTrapKind357(structure.kind))return IED_COMMON_357.beauty;
  if(structure.kind==='mini-turret')return -20;
  if(structure.kind==='tube-television')return 0;
  // Schema 355 ToolCabinet: no Beauty stat and steel is a fixed cost, not its stuff.
  if(structure.kind==='tool-cabinet')return 0;
  if(structure.kind==='sandbags'||structure.kind==='ancient-road-barrier')return -10;
  if(structure.kind==='ancient-road-lamp')return 0;
  if(isJoyTableKind354(structure.kind)){
    // Schema 354: Beauty 0 (2 for the Game of Ur board), stuff factor and offset, quality factor when the def has CompQuality.
    const f=JOY_TABLES_354[structure.kind],m=isFurnitureMaterial(structure.material)?FURNITURE_MATERIALS[structure.material]:undefined;
    return coreBeauty311(f.beauty,furnitureBeautyFactor311(structure.material,version),m?.beautyOffset??0,f.quality?QUALITY_BEAUTY[furnitureQuality(structure.quality)]:1);
  }
  if(isHabitatFurnitureKind(structure.kind))return furnitureBeauty(structure,version);
  if(isSculptureKind(structure.kind))return sculptureBeauty(structure,version);
  const material=isFurnitureMaterial(structure.material)?FURNITURE_MATERIALS[structure.material]:undefined;
  const base=structure.kind==='electric-crematorium'?-10:structure.baseBeauty??0;
  if(v311)return coreBeauty311(base,furnitureBeautyFactor311(structure.material,version),material?.beautyOffset??0,1);
  return (base>0?base*(material?.beautyFactor??1):base)+(material?.beautyOffset??0);
}
export function beautyBand(value:number):BeautyBand {
  return value < -3.5?'hideous':value<0?'ugly':value<2.4?'neutral':value<5?'pretty':value<15?'beautiful':value<50?'very-beautiful':value<100?'extremely-beautiful':'unbelievably-beautiful';
}
export const weightedBeautySize=(cells:number):number=>cells<40?20+cells/2:cells;

/** Immutable derived field. Terrain and things remain separate because room
 * beauty includes boundary things, never the terrain underneath the wall. */
export class BeautyMap {
  readonly width:number;readonly height:number;
  /** Schema whose Beauty rules built this map (current when absent). */
  readonly version:number|undefined;
  private readonly terrainInside:Float64Array;private readonly terrainOutside:Float64Array;
  private readonly thingsInside:Float64Array;private readonly thingsOutside:Float64Array;
  constructor(width:number,height:number,terrainInside:Float64Array,terrainOutside:Float64Array,thingsInside:Float64Array,thingsOutside:Float64Array,version?:number){
    this.width=width;this.height=height;this.terrainInside=terrainInside;this.terrainOutside=terrainOutside;this.thingsInside=thingsInside;this.thingsOutside=thingsOutside;this.version=version;
  }
  indexAt(x:number,z:number):number {return Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<this.width&&z<this.height?z*this.width+x:-1;}
  index(cell:BeautyCell):number {return Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<this.width&&cell.z<this.height?cell.z*this.width+cell.x:-1;}
  atIndex(index:number,outdoors=false):number {return index<0||index>=this.width*this.height?0:(outdoors?this.terrainOutside[index]!+this.thingsOutside[index]!:this.terrainInside[index]!+this.thingsInside[index]!);}
  thingsAtIndex(index:number,outdoors=false):number {return index<0||index>=this.width*this.height?0:(outdoors?this.thingsOutside:this.thingsInside)[index]!;}
  terrain(cell:BeautyCell,outdoors=false):number {const i=this.index(cell);return i<0?0:(outdoors?this.terrainOutside:this.terrainInside)[i]!;}
  things(cell:BeautyCell,outdoors=false):number {const i=this.index(cell);return i<0?0:(outdoors?this.thingsOutside:this.thingsInside)[i]!;}
  at(cell:BeautyCell,outdoors=false):number {return this.terrain(cell,outdoors)+this.things(cell,outdoors);}
}

/** Caller-owned cache with explicit invalidation for in-place simulation edits.
 * A rebuild scans contributors once; pawn and room reads use the snapshot. */
export class BeautyMapCache {
  private dirty=true;private map:BeautyMap|undefined;
  private tiles:readonly BeautyTile[]|undefined;private structures:readonly BeautyStructure[]|undefined;
  private filth:readonly BeautyFilth[]|undefined;private objects:readonly BeautyObject[]|undefined;private version:number|undefined;
  private width=-1;private height=-1;private invalidated=new Set<number>();
  rebuilds=0;
  invalidateAll():void {this.dirty=true;this.invalidated.clear();}
  invalidateCell(cell:BeautyCell):void {this.dirty=true;if(this.width>0&&cell.x>=0&&cell.z>=0&&cell.x<this.width&&cell.z<this.height)this.invalidated.add(cell.z*this.width+cell.x);}
  invalidateStructure(structure:BeautyStructure):void {this.invalidateCell(structure.beautyCell??structure);}
  invalidatedCells():readonly number[]{return [...this.invalidated].sort((a,b)=>a-b);}
  read(input:BeautyInput):BeautyMap {
    const changed=this.width!==input.width||this.height!==input.height||this.tiles!==input.tiles||this.structures!==input.structures||this.filth!==input.filth||this.objects!==input.objects||this.version!==input.version;
    if(!changed&&!this.dirty)return this.map!;
    if(!Number.isInteger(input.width)||!Number.isInteger(input.height)||input.width<1||input.height<1||input.tiles.length!==input.width*input.height)throw new RangeError('Invalid beauty map dimensions.');
    const size=input.width*input.height,inside=new Float64Array(size),outside=new Float64Array(size),thingsIn=new Float64Array(size),thingsOut=new Float64Array(size);
    const rules=input.version??SCHEMA_VERSION;
    for(let i=0;i<size;i++){
      const tile=input.tiles[i]!,value=floorBeauty(tile,false);inside[i]=value;
      outside[i]=!tile.floor&&(tile.terrain==='grass'||tile.terrain==='soil'||tile.terrain==='rich-soil'||tile.terrain==='gravel')?0:value;
      // Schema 367: a smoothed wall is a full-fill building at its cell;
      // schema 373: a rough natural rock too (UglyRockBase Beauty).
      if(tile.terrain==='rock'){const wall=naturalWallBeauty373(tile,rules);if(wall!==0){thingsIn[i]=wall;thingsOut[i]=wall;}}
    }
    const index=(cell:BeautyCell)=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<input.width&&cell.z<input.height?cell.z*input.width+cell.x:-1;
    for(const structure of input.structures){const i=index(structure.beautyCell??structure);if(i<0)continue;const value=structureBeauty(structure,input.version);thingsIn[i]+=value;thingsOut[i]+=value;}
    for(const filth of input.filth??[]){const i=index(filth);if(i<0)continue;thingsIn[i]+=filthBeauty(filth,false);thingsOut[i]+=filthBeauty(filth,true);}
    for(const object of input.objects??[]){const i=index(object);if(i<0)continue;const value=groundObjectBeauty(object);thingsIn[i]+=value;thingsOut[i]+=value;}
    this.width=input.width;this.height=input.height;this.tiles=input.tiles;this.structures=input.structures;this.filth=input.filth;this.objects=input.objects;this.version=input.version;
    this.map=new BeautyMap(input.width,input.height,inside,outside,thingsIn,thingsOut,input.version);this.dirty=false;this.invalidated.clear();this.rebuilds++;return this.map;
  }
}

export interface BeautyRoom {readonly id:number;readonly cells:ReadonlySet<number>;readonly adjacent:ReadonlySet<number>;readonly total:number;readonly beauty:number;readonly band:BeautyBand}
const CARDINAL=[[-1,0],[1,0],[0,-1],[0,1]] as const;
const AROUND=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;
const DEFAULT_PERCEPTION_RADIUS=8.9;
const DEFAULT_PERCEPTION_OFFSETS=(()=>{
  const reach=Math.ceil(DEFAULT_PERCEPTION_RADIUS),squared=DEFAULT_PERCEPTION_RADIUS*DEFAULT_PERCEPTION_RADIUS,out:number[]=[];
  for(let dz=-reach;dz<=reach;dz++)for(let dx=-reach;dx<=reach;dx++)if(dx*dx+dz*dz<=squared)out.push(dx,dz);
  return new Int8Array(out);
})();

/** Marks in `needed` every in-map cell that `perceived(cell)` (default radius,
 * no visibility test) can read for this cell; nothing when it reads none. */
export function markDefaultPerceptionCells(width:number,height:number,cell:BeautyCell,needed:Uint8Array):void {
  if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=width||cell.z>=height)return;
  for(let offset=0;offset<DEFAULT_PERCEPTION_OFFSETS.length;offset+=2){
    const x=cell.x+DEFAULT_PERCEPTION_OFFSETS[offset]!,z=cell.z+DEFAULT_PERCEPTION_OFFSETS[offset+1]!;
    if(x>=0&&z>=0&&x<width&&z<height)needed[z*width+x]=1;
  }
}

/** A single capture is reusable by every pawn/UI query in the decision pass.
 * Each enclosed room floods once and is then retained by its topology id. */
export class RoomBeautyCapture {
  readonly map:BeautyMap;readonly topology:RoomTopology;
  /** Fog of the captured map (schema 373 perception skips fogged cells). */
  private readonly fogged:((index:number)=>boolean)|undefined;
  private rooms=new Map<number,BeautyRoom>();
  constructor(map:BeautyMap,topology:RoomTopology,fogged?:(index:number)=>boolean){this.map=map;this.topology=topology;this.fogged=fogged;}
  room(cell:BeautyCell):BeautyRoom|null {
    const space=this.topology.at(cell.x,cell.z);if(!space||space.kind!=='space'||space.touchesMapEdge)return null;
    const cached=this.rooms.get(space.id);if(cached)return cached;
    const width=this.map.width,cells=new Set<number>(),adjacent=new Set<number>(),queue=[cell.z*width+cell.x];cells.add(queue[0]!);
    for(let head=0;head<queue.length;head++){
      const i=queue[head]!,x=i%width,z=Math.floor(i/width);
      for(const [dx,dz] of CARDINAL){const nx=x+dx,nz=z+dz,next=this.topology.at(nx,nz);if(next?.kind==='space'&&next.id===space.id){const n=nz*width+nx;if(!cells.has(n)){cells.add(n);queue.push(n);}}}
      for(const [dx,dz] of AROUND){const nx=x+dx,nz=z+dz,next=this.topology.at(nx,nz);if(next&&(next.kind==='solid'||next.kind==='doorway'))adjacent.add(nz*width+nx);}
    }
    let total=0;for(const i of cells)total+=this.map.atIndex(i,false);
    for(const i of adjacent)total+=this.map.thingsAtIndex(i,false);
    const beauty=total/weightedBeautySize(cells.size),result={id:space.id,cells,adjacent,total,beauty,band:beautyBand(beauty)} as const;
    this.rooms.set(space.id,result);return result;
  }
  /** Radius-limited perception; it never traverses the whole map. Visibility
   * is injected so the central line-of-sight owner remains authoritative. */
  perceived(cell:BeautyCell,visible?:((from:BeautyCell,to:BeautyCell)=>boolean),radius=DEFAULT_PERCEPTION_RADIUS):number {
    if(this.map.index(cell)<0||!Number.isFinite(radius)||radius<0)return 0;
    if(isRockBeautySchema373(this.map.version??SCHEMA_VERSION))return this.perceived373(cell,visible,radius);
    const origin=this.topology.at(cell.x,cell.z);
    if(visible===undefined&&radius===DEFAULT_PERCEPTION_RADIUS){
      let total=0,count=0;
      for(let offset=0;offset<DEFAULT_PERCEPTION_OFFSETS.length;offset+=2){
        const dx=DEFAULT_PERCEPTION_OFFSETS[offset]!,dz=DEFAULT_PERCEPTION_OFFSETS[offset+1]!;
        const x=cell.x+dx,z=cell.z+dz,index=this.map.indexAt(x,z);if(index<0)continue;
        const space=this.topology.at(x,z);if(space?.kind!=='space'||origin?.kind!=='space'||space.id!==origin.id)continue;
        const outdoors=space.touchesMapEdge;total+=this.map.atIndex(index,outdoors);count++;
      }
      return count?total/count:0;
    }
    const reach=Math.ceil(radius),squared=radius*radius;let total=0,count=0;
    for(let dz=-reach;dz<=reach;dz++)for(let dx=-reach;dx<=reach;dx++){
      if(dx*dx+dz*dz>squared)continue;const target={x:cell.x+dx,z:cell.z+dz};if(this.map.index(target)<0||visible&&!visible(cell,target))continue;
      const space=this.topology.at(target.x,target.z);if(space?.kind!=='space'||origin?.kind!=='space'||space.id!==origin.id)continue;
      const outdoors=space.touchesMapEdge;total+=this.map.at(target,outdoors);count++;
    }
    return count?total/count:0;
  }
  /** Schema 373, BeautyUtility.AverageBeautyPerceptible: the cells of the
   * perception radius that are not fogged and either belong to a visible
   * room or touch one of its cells (eight neighbours), so the walls and doors
   * bordering the room count, each cell once, in the average. The visible
   * rooms are the perceiver's room; from a doorway, the door and the rooms
   * on its sides (the door region's neighbours). A solid or doorway cell
   * counts its things, as in the room's bordering-things rule; a wall cell
   * has no room and gives nothing to see from. */
  private perceived373(cell:BeautyCell,visible:((from:BeautyCell,to:BeautyCell)=>boolean)|undefined,radius:number):number {
    const map=this.map,topology=this.topology,width=map.width,height=map.height,originIndex=map.index(cell),origin=topology.labelAt(originIndex)!;
    if(origin===-1)return 0;
    const rooms:number[]=[],doors:number[]=[];
    if(origin>0)rooms.push(origin);
    else{
      doors.push(originIndex);
      for(const [dx,dz] of CARDINAL){
        const x=cell.x+dx,z=cell.z+dz;if(x<0||z<0||x>=width||z>=height)continue;
        const n=z*width+x,label=topology.labelAt(n)!;
        if(label>0){if(!rooms.includes(label))rooms.push(label);}else if(label===-2)doors.push(n);
      }
    }
    const seen=(index:number):boolean=>{const label=topology.labelAt(index)!;return label>0?rooms.includes(label):label===-2&&doors.includes(index);};
    const fogged=this.fogged;let total=0,count=0;
    const read=(x:number,z:number):void=>{
      const index=map.indexAt(x,z);if(index<0||fogged?.(index))return;
      if(!seen(index)){
        let touches=false;
        for(const [ax,az] of AROUND){const nx=x+ax,nz=z+az;if(nx>=0&&nz>=0&&nx<width&&nz<height&&seen(nz*width+nx)){touches=true;break;}}
        if(!touches)return;
      }
      const label=topology.labelAt(index)!;
      if(label>0)total+=map.atIndex(index,(topology.at(x,z) as RoomSpace).touchesMapEdge);
      else total+=map.thingsAtIndex(index,false);
      count++;
    };
    if(visible===undefined&&radius===DEFAULT_PERCEPTION_RADIUS){
      for(let offset=0;offset<DEFAULT_PERCEPTION_OFFSETS.length;offset+=2)read(cell.x+DEFAULT_PERCEPTION_OFFSETS[offset]!,cell.z+DEFAULT_PERCEPTION_OFFSETS[offset+1]!);
    }else{
      const reach=Math.ceil(radius),squared=radius*radius;
      for(let dz=-reach;dz<=reach;dz++)for(let dx=-reach;dx<=reach;dx++){
        if(dx*dx+dz*dz>squared)continue;const target={x:cell.x+dx,z:cell.z+dz};if(map.index(target)<0||visible&&!visible(cell,target))continue;
        read(target.x,target.z);
      }
    }
    return count?total/count:0;
  }
}

export const captureRoomBeauty=(input:BeautyInput,topology:RoomTopology,cache=new BeautyMapCache()):RoomBeautyCapture=>new RoomBeautyCapture(cache.read(input),topology);
